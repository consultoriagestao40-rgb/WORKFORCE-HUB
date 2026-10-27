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

        const extraItems = await prisma.billingExtraItem.findMany({
            where: { clientId, year, month },
            orderBy: { createdAt: "asc" },
        });

        const [attendances, measurement] = await Promise.all([
            prisma.attendance.findMany({
                where: { posto: { clientId }, date: { gte: start, lte: end } },
                include: {
                    posto: { include: { role: { select: { name: true } }, client: { select: { name: true } } } },
                    employee: { select: { name: true } },
                    coveredBy: { select: { name: true } },
                },
                orderBy: [{ date: "desc" }],
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

        const decisions = await prisma.billingGlosaDecision.findMany({
            where: { attendanceId: { in: attendances.map(a => a.id) } },
        });
        const decisionMap = new Map(decisions.map(d => [d.attendanceId, d]));

        const rows = attendances.map(a => ({
            id: a.id,
            date: a.date.toISOString(),
            clientName: a.posto.client?.name || "-",
            roleName: a.posto.role?.name || "-",
            employeeName: a.employee?.name || "Vaga em aberto",
            status: a.status,
            coveredByName: a.coveredBy?.name || null,
            coverageType: a.coverageType,
            notes: a.notes,
            uncovered: isUncoveredAbsence(a),
            dailyValue: a.posto.billingValue / 30,
            decision: isUncoveredAbsence(a) ? (decisionMap.get(a.id)?.decision || "GLOSA") : null,
            decisionReason: decisionMap.get(a.id)?.reason || null,
            decidedByName: decisionMap.get(a.id)?.decidedByName || null,
            decidedAt: decisionMap.get(a.id)?.decidedAt?.toISOString() || null,
            glosa: isUncoveredAbsence(a) && (decisionMap.get(a.id)?.decision || "GLOSA") !== "ABONO" ? a.posto.billingValue / 30 : 0,
        }));

        const active = rows.filter(r => r.status !== "FOLGA");
        const glosaRows = rows.filter(r => r.uncovered); // faltas sem cobertura (glosadas ou abonadas)
        const glosaTotal = glosaRows.reduce((s, r) => s + r.glosa, 0);
        const abonoTotal = glosaRows.filter(r => r.decision === "ABONO").reduce((s, r) => s + r.dailyValue, 0);

        const postos = await prisma.posto.findMany({ where: { clientId }, select: { billingValue: true } });
        const expected = postos.reduce((s, p) => s + p.billingValue, 0);

        return {
            success: true as const,
            side: access.side,
            summary: {
                expected,
                glosaTotal,
                abonoTotal,
                abonoCount: glosaRows.filter(r => r.decision === "ABONO").length,
                extrasApproved: extraItems.filter(i => i.status === "APPROVED").reduce((a, i) => a + i.total, 0),
                extrasPending: extraItems.filter(i => i.status === "PENDING").reduce((a, i) => a + i.total, 0),
                extrasPendingCount: extraItems.filter(i => i.status === "PENDING").length,
                net: Math.max(0, expected - glosaTotal) + extraItems.filter(i => i.status === "APPROVED").reduce((a, i) => a + i.total, 0),
                shifts: active.length,
                present: rows.filter(r => r.status === "PRESENTE_PONTO" || r.status === "PRESENTE_MANUAL").length,
                coveredAbsences: rows.filter(r => r.status === "FALTA" && (r.coveredByName || r.coverageType)).length,
                uncoveredAbsences: glosaRows.length,
                effectiveness: active.length > 0 ? ((active.length - glosaRows.length) / active.length) * 100 : 100,
            },
            rows,
            glosaRows,
            extras: extraItems.map(i => ({
                id: i.id, type: i.type, description: i.description, requestedBy: i.requestedBy, referenceDate: i.referenceDate,
                quantity: i.quantity, unitValue: i.unitValue, total: i.total, status: i.status, decisionNote: i.decisionNote,
                createdByName: i.createdByName, decidedByName: i.decidedByName, decidedAt: i.decidedAt?.toISOString() || null,
            })),
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

        if (input.type === "APPROVAL") {
            const pending = await prisma.billingExtraItem.count({ where: { clientId: input.clientId, year: input.year, month: input.month, status: "PENDING" } });
            if (pending > 0) return { success: false as const, error: `Há ${pending} item(ns) extra(s) pendente(s) de decisão. Aprove ou recuse cada um antes de aprovar a medição.` };
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

/** Decisão do gestor sobre uma falta sem cobertura: glosar (padrão) ou abonar (exige justificativa). */
export async function setGlosaDecision(input: { attendanceId: string; decision: "GLOSA" | "ABONO"; reason?: string }) {
    try {
        const user = await getCurrentUser();
        if (!user) return { success: false as const, error: "Não autorizado." };
        if (user.role === "CLIENTE") return { success: false as const, error: "Somente a equipe interna decide sobre glosa ou abono." };

        const reason = (input.reason || "").trim();
        if (input.decision === "ABONO" && !reason) return { success: false as const, error: "Informe a justificativa do abono." };

        const att = await prisma.attendance.findUnique({
            where: { id: input.attendanceId },
            include: { posto: { select: { clientId: true } } },
        });
        if (!att) return { success: false as const, error: "Lançamento não encontrado." };
        if (!isUncoveredAbsence(att)) return { success: false as const, error: "Só é possível decidir sobre falta sem cobertura." };

        const clientId = att.posto.clientId;
        const d = att.date;
        const measurement = await prisma.billingMeasurement.findUnique({
            where: { clientId_year_month: { clientId, year: d.getUTCFullYear(), month: d.getUTCMonth() } },
            select: { id: true, status: true },
        });
        if (measurement?.status === "APPROVED") return { success: false as const, error: "A medição deste mês já foi aprovada pelo cliente." };

        await prisma.$transaction(async tx => {
            await tx.billingGlosaDecision.upsert({
                where: { attendanceId: input.attendanceId },
                create: {
                    attendanceId: input.attendanceId, clientId, decision: input.decision, reason: reason || null,
                    decidedById: user.id, decidedByName: user.name || null,
                },
                update: {
                    decision: input.decision, reason: reason || null,
                    decidedById: user.id, decidedByName: user.name || null, decidedAt: new Date(),
                },
            });

            // Registra no histórico da medição para o cliente acompanhar
            const m = measurement || await tx.billingMeasurement.create({
                data: { clientId, year: d.getUTCFullYear(), month: d.getUTCMonth(), status: "PENDING" },
                select: { id: true, status: true },
            });
            await tx.billingMeasurementEvent.create({
                data: {
                    measurementId: m.id,
                    type: "COMMENT",
                    side: "INTERNAL",
                    authorId: user.id,
                    authorName: user.name || "Equipe interna",
                    message: `${input.decision === "ABONO" ? "Falta ABONADA" : "Falta GLOSADA"} em ${d.toLocaleDateString("pt-BR", { timeZone: "UTC" })}${reason ? `: ${reason}` : "."}`,
                },
            });
        });

        revalidatePath("/client/dashboard");
        revalidatePath("/admin/performance");
        return { success: true as const };
    } catch (error) {
        console.error("Erro ao registrar decisão de glosa:", error);
        return { success: false as const, error: "Erro ao registrar a decisão." };
    }
}

async function logExtraEvent(clientId: string, year: number, month: number, side: "CLIENT" | "INTERNAL", user: { id: string; name?: string | null }, message: string) {
    const m = await prisma.billingMeasurement.upsert({
        where: { clientId_year_month: { clientId, year, month } },
        create: { clientId, year, month, status: "PENDING" },
        update: {},
        select: { id: true },
    });
    await prisma.billingMeasurementEvent.create({
        data: {
            measurementId: m.id, type: "COMMENT", side, authorId: user.id,
            authorName: user.name || (side === "CLIENT" ? "Cliente" : "Equipe interna"), message,
        },
    });
}

const brlFmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Gestor lança serviço extra / horas extras para aprovação do cliente. */
export async function addExtraItem(input: {
    clientId: string; year: number; month: number;
    type: "SERVICO_EXTRA" | "HORA_EXTRA";
    description: string; requestedBy?: string; referenceDate?: string;
    quantity: number; unitValue: number;
}) {
    try {
        const access = await checkAccess(input.clientId);
        if (!access.ok) return { success: false as const, error: access.error };
        if (access.side !== "INTERNAL") return { success: false as const, error: "Somente a equipe interna lança itens extras." };

        const description = (input.description || "").trim();
        if (!description) return { success: false as const, error: "Informe a descrição do item." };
        if (!(input.quantity > 0)) return { success: false as const, error: "A quantidade deve ser maior que zero." };
        if (!(input.unitValue > 0)) return { success: false as const, error: "Informe o valor unitário." };

        const m = await prisma.billingMeasurement.findUnique({
            where: { clientId_year_month: { clientId: input.clientId, year: input.year, month: input.month } },
            select: { status: true },
        });
        if (m?.status === "APPROVED") return { success: false as const, error: "A medição deste mês já foi aprovada pelo cliente." };

        const total = Math.round(input.quantity * input.unitValue * 100) / 100;
        await prisma.billingExtraItem.create({
            data: {
                clientId: input.clientId, year: input.year, month: input.month, type: input.type, description,
                requestedBy: (input.requestedBy || "").trim() || null, referenceDate: input.referenceDate || null,
                quantity: input.quantity, unitValue: input.unitValue, total,
                createdById: access.user.id, createdByName: access.user.name || null,
            },
        });
        await logExtraEvent(input.clientId, input.year, input.month, "INTERNAL", access.user,
            `Lançado ${input.type === "HORA_EXTRA" ? "horas extras" : "serviço extra"}: ${description} (${input.quantity} x ${brlFmt(input.unitValue)} = ${brlFmt(total)}). Aguardando aprovação do cliente.`);

        revalidatePath("/client/dashboard");
        revalidatePath("/admin/performance");
        return { success: true as const };
    } catch (error) {
        console.error("Erro ao lançar item extra:", error);
        return { success: false as const, error: "Erro ao lançar o item extra." };
    }
}

export async function deleteExtraItem(id: string) {
    try {
        const item = await prisma.billingExtraItem.findUnique({ where: { id } });
        if (!item) return { success: false as const, error: "Item não encontrado." };
        const access = await checkAccess(item.clientId);
        if (!access.ok) return { success: false as const, error: access.error };
        if (access.side !== "INTERNAL") return { success: false as const, error: "Somente a equipe interna remove itens extras." };
        if (item.status === "APPROVED") return { success: false as const, error: "Item já aprovado pelo cliente não pode ser removido." };

        await prisma.billingExtraItem.delete({ where: { id } });
        await logExtraEvent(item.clientId, item.year, item.month, "INTERNAL", access.user, `Removido item extra: ${item.description} (${brlFmt(item.total)}).`);
        revalidatePath("/client/dashboard");
        revalidatePath("/admin/performance");
        return { success: true as const };
    } catch (error) {
        console.error("Erro ao remover item extra:", error);
        return { success: false as const, error: "Erro ao remover o item extra." };
    }
}

/** Cliente aprova ou recusa (com motivo) um item extra. */
export async function decideExtraItem(input: { id: string; decision: "APPROVE" | "REJECT"; note?: string }) {
    try {
        const item = await prisma.billingExtraItem.findUnique({ where: { id: input.id } });
        if (!item) return { success: false as const, error: "Item não encontrado." };
        const access = await checkAccess(item.clientId);
        if (!access.ok) return { success: false as const, error: access.error };
        if (access.side !== "CLIENT") return { success: false as const, error: "Somente o cliente aprova ou recusa os itens extras." };

        const note = (input.note || "").trim();
        if (input.decision === "REJECT" && !note) return { success: false as const, error: "Informe o motivo da recusa." };

        const m = await prisma.billingMeasurement.findUnique({
            where: { clientId_year_month: { clientId: item.clientId, year: item.year, month: item.month } },
            select: { status: true },
        });
        if (m?.status === "APPROVED") return { success: false as const, error: "A medição deste mês já foi aprovada." };

        await prisma.billingExtraItem.update({
            where: { id: input.id },
            data: {
                status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED",
                decisionNote: note || null,
                decidedById: access.user.id, decidedByName: access.user.name || null, decidedAt: new Date(),
            },
        });
        await logExtraEvent(item.clientId, item.year, item.month, "CLIENT", access.user,
            `${input.decision === "APPROVE" ? "Aprovou" : "Recusou"} o item extra "${item.description}" (${brlFmt(item.total)})${note ? `: ${note}` : "."}`);

        revalidatePath("/client/dashboard");
        revalidatePath("/admin/performance");
        return { success: true as const };
    } catch (error) {
        console.error("Erro ao decidir item extra:", error);
        return { success: false as const, error: "Erro ao registrar a decisão." };
    }
}
