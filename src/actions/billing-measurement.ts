"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB por arquivo (base64 no banco)
const MAX_FILES = 5;

type Access =
    | { ok: false; error: string }
    | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; side: "CLIENT" | "INTERNAL" };

async function checkAccess(clientId: string): Promise<Access> {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Não autorizado." };
    if (user.role === "CLIENTE") {
        if (!(user.clientIds || []).includes(clientId)) return { ok: false, error: "Sem permissão para este contrato." };
        return { ok: true, user, side: "CLIENT" };
    }
    return { ok: true, user, side: "INTERNAL" };
}

function isUncoveredAbsence(a: { status: string; coveredById: string | null; coverageType: string | null }) {
    return a.status === "FALTA" && !a.coveredById && !a.coverageType;
}

/** Situação de cada mês do ano (para os selos da tabela de faturamento). */
export async function getMeasurementStatuses(clientId: string, year: number) {
    const access = await checkAccess(clientId);
    if (!access.ok) return { success: false as const, error: access.error };

    const list = await prisma.billingMeasurement.findMany({
        where: { clientId, year },
        select: { month: true, status: true },
    });
    const statuses: Record<number, string> = {};
    list.forEach(m => { statuses[m.month] = m.status; });
    return { success: true as const, statuses };
}

/** Relatório completo do mês + medição (status, histórico e anexos sem o conteúdo). */
export async function getMeasurementDetail(clientId: string, year: number, month: number) {
    try {
        const access = await checkAccess(clientId);
        if (!access.ok) return { success: false as const, error: access.error };

        const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
        const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

        const [attendances, measurement] = await Promise.all([
            prisma.attendance.findMany({
                where: { posto: { clientId }, date: { gte: start, lte: end } },
                include: {
                    posto: { include: { role: { select: { name: true } } } },
                    employee: { select: { name: true } },
                    coveredBy: { select: { name: true } },
                },
                orderBy: [{ date: "asc" }],
            }),
            prisma.billingMeasurement.findUnique({
                where: { clientId_year_month: { clientId, year, month } },
                include: {
                    events: {
                        orderBy: { createdAt: "asc" },
                        include: { attachments: { select: { id: true, fileName: true, mimeType: true, size: true } } },
                    },
                },
            }),
        ]);

        const rows = attendances.map(a => ({
            id: a.id,
            date: a.date.toISOString(),
            roleName: a.posto.role?.name || "-",
            employeeName: a.employee?.name || "Vaga em aberto",
            status: a.status,
            coveredByName: a.coveredBy?.name || null,
            coverageType: a.coverageType,
            notes: a.notes,
            glosa: isUncoveredAbsence(a) ? a.posto.billingValue / 30 : 0,
        }));

        const active = rows.filter(r => r.status !== "FOLGA");
        const glosaRows = rows.filter(r => r.glosa > 0);
        const glosaTotal = glosaRows.reduce((s, r) => s + r.glosa, 0);

        const postos = await prisma.posto.findMany({ where: { clientId }, select: { billingValue: true } });
        const expected = postos.reduce((s, p) => s + p.billingValue, 0);

        return {
            success: true as const,
            side: access.side,
            summary: {
                expected,
                glosaTotal,
                net: Math.max(0, expected - glosaTotal),
                shifts: active.length,
                present: rows.filter(r => r.status === "PRESENTE_PONTO" || r.status === "PRESENTE_MANUAL").length,
                coveredAbsences: rows.filter(r => r.status === "FALTA" && (r.coveredByName || r.coverageType)).length,
                uncoveredAbsences: glosaRows.length,
            },
            rows,
            glosaRows,
            measurement: measurement
                ? {
                      id: measurement.id,
                      status: measurement.status,
                      approvedAt: measurement.approvedAt?.toISOString() || null,
                      approvedByName: measurement.approvedByName,
                      events: measurement.events.map(e => ({
                          id: e.id,
                          type: e.type,
                          side: e.side,
                          authorName: e.authorName,
                          message: e.message,
                          createdAt: e.createdAt.toISOString(),
                          attachments: e.attachments,
                      })),
                  }
                : null,
        };
    } catch (error) {
        console.error("Erro ao carregar medição:", error);
        return { success: false as const, error: "Erro ao carregar a medição do mês." };
    }
}

export interface MeasurementFileInput {
    name: string;
    mimeType?: string;
    size: number;
    data: string; // base64 (sem prefixo data:)
}

/**
 * Registra uma interação na medição.
 * - CLIENTE: REVISION_REQUEST (exige justificativa) | APPROVAL | COMMENT
 * - INTERNO: RESPONSE (exige texto) | COMMENT
 */
export async function postMeasurementEvent(input: {
    clientId: string;
    year: number;
    month: number;
    type: "REVISION_REQUEST" | "APPROVAL" | "RESPONSE" | "COMMENT";
    message?: string;
    files?: MeasurementFileInput[];
}) {
    try {
        const access = await checkAccess(input.clientId);
        if (!access.ok) return { success: false as const, error: access.error };
        const { user, side } = access;

        const message = (input.message || "").trim();
        const files = input.files || [];

        if (files.length > MAX_FILES) return { success: false as const, error: `Máximo de ${MAX_FILES} anexos por mensagem.` };
        for (const f of files) {
            if (f.size > MAX_FILE_BYTES) return { success: false as const, error: `O arquivo "${f.name}" excede 4 MB.` };
        }

        if (side === "CLIENT" && input.type === "RESPONSE") return { success: false as const, error: "Ação não permitida." };
        if (side === "INTERNAL" && (input.type === "REVISION_REQUEST" || input.type === "APPROVAL")) {
            return { success: false as const, error: "Somente o cliente pode solicitar revisão ou aprovar a medição." };
        }
        if ((input.type === "REVISION_REQUEST" || input.type === "RESPONSE") && !message) {
            return { success: false as const, error: input.type === "REVISION_REQUEST" ? "Descreva o motivo da revisão." : "Escreva a resposta." };
        }
        if (input.type === "COMMENT" && !message && files.length === 0) {
            return { success: false as const, error: "Escreva uma mensagem ou anexe um arquivo." };
        }

        const where = { clientId_year_month: { clientId: input.clientId, year: input.year, month: input.month } };
        const existing = await prisma.billingMeasurement.findUnique({ where });
        if (existing?.status === "APPROVED") {
            return { success: false as const, error: "Esta medição já foi aprovada pelo cliente." };
        }

        let nextStatus = existing?.status || "PENDING";
        if (input.type === "REVISION_REQUEST") nextStatus = "REVISION_REQUESTED";
        if (input.type === "APPROVAL") nextStatus = "APPROVED";
        if (input.type === "RESPONSE") nextStatus = "PENDING"; // respondida: volta para nova análise do cliente

        await prisma.$transaction(async tx => {
            const measurement = await tx.billingMeasurement.upsert({
                where,
                create: {
                    clientId: input.clientId,
                    year: input.year,
                    month: input.month,
                    status: nextStatus,
                    ...(input.type === "APPROVAL"
                        ? { approvedAt: new Date(), approvedById: user.id, approvedByName: user.name || null }
                        : {}),
                },
                update: {
                    status: nextStatus,
                    ...(input.type === "APPROVAL"
                        ? { approvedAt: new Date(), approvedById: user.id, approvedByName: user.name || null }
                        : {}),
                },
            });

            await tx.billingMeasurementEvent.create({
                data: {
                    measurementId: measurement.id,
                    type: input.type,
                    side,
                    authorId: user.id,
                    authorName: user.name || (side === "CLIENT" ? "Cliente" : "Equipe interna"),
                    message: message || null,
                    attachments: {
                        create: files.map(f => ({
                            fileName: f.name,
                            mimeType: f.mimeType || null,
                            size: f.size,
                            fileData: f.data,
                        })),
                    },
                },
            });
        });

        revalidatePath("/client/dashboard");
        revalidatePath("/admin/performance");
        return { success: true as const };
    } catch (error) {
        console.error("Erro ao registrar interação da medição:", error);
        return { success: false as const, error: "Erro ao registrar a interação." };
    }
}

/** Download sob demanda de um anexo (evita carregar base64 na listagem). */
export async function getMeasurementAttachment(attachmentId: string) {
    try {
        const att = await prisma.billingMeasurementAttachment.findUnique({
            where: { id: attachmentId },
            include: { event: { include: { measurement: { select: { clientId: true } } } } },
        });
        if (!att) return { success: false as const, error: "Anexo não encontrado." };

        const access = await checkAccess(att.event.measurement.clientId);
        if (!access.ok) return { success: false as const, error: access.error };

        return { success: true as const, fileName: att.fileName, mimeType: att.mimeType || "application/octet-stream", data: att.fileData };
    } catch (error) {
        console.error("Erro ao baixar anexo da medição:", error);
        return { success: false as const, error: "Erro ao baixar o anexo." };
    }
}
