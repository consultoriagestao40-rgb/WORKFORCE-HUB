"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getBenefitsConfig } from "@/actions/benefits";
import { SecullumApiClient } from "@/lib/secullum";
import { getCurrentUser } from "@/lib/auth";
import { spDateParts } from "@/lib/punch-time";
import {
    analyzeBatidaDay,
    COLUMN_LABEL,
    COLUMN_TO_PUNCH_TYPE,
    PUNCH_COLUMNS,
    type PunchColumn
} from "@/lib/punch-inconsistency";

export type InconsistencyRow = {
    key: string;                 // employeeId_YYYY-MM-DD
    employeeId: string;
    employeeName: string;
    folha: string | null;
    date: string;                // YYYY-MM-DD
    weekday: number;
    clientId: string | null;
    clientName: string | null;
    postoName: string | null;
    managerId: string | null;
    managerName: string | null;
    managerHasPhone: boolean;
    kind: "SEM_BATIDAS" | "INCOMPLETA";
    workedOnDayOff: boolean;
    expected: Partial<Record<PunchColumn, string>>;
    actual: Partial<Record<PunchColumn, string>>;
    missing: PunchColumn[];
    status: "NOVO" | "ENVIADO" | "IGNORADO";
    adjustment: { id: string; code: string; status: string; secullumStatus: string | null } | null;
    ignored: { reason: string | null; userName: string | null } | null;
};

async function getSecullumClient() {
    const config = await getBenefitsConfig();
    const bankId = config?.secullumCompanyId?.trim();
    const token = config?.secullumApiToken?.trim();
    const apiUrl = config?.secullumApiUrl?.trim();
    if (!bankId || !token) return null;
    return new SecullumApiClient(token, bankId, apiUrl);
}

/** Dia (YYYY-MM-DD) no fuso de São Paulo */
function todaySP(): string {
    return spDateParts(new Date()).dateStr;
}

/**
 * Varre o cartão de ponto (Secullum) no período e devolve as inconsistências por colaborador/dia.
 * Não grava nada: é uma leitura ao vivo do Secullum cruzada com contratos/gestores do Hub.
 */
export async function scanPunchInconsistencies(params: { startDate: string; endDate: string }): Promise<{
    success: boolean;
    message?: string;
    rows: InconsistencyRow[];
    unmatched: number;
}> {
    try {
        const user = await getCurrentUser();
        if (!user) return { success: false, message: "Usuário não autenticado.", rows: [], unmatched: 0 };

        const client = await getSecullumClient();
        if (!client) return { success: false, message: "Secullum não configurado em Benefícios.", rows: [], unmatched: 0 };

        // Nunca analisar o dia de hoje (jornada em andamento) nem o futuro
        const today = todaySP();
        const start = params.startDate;
        let end = params.endDate;
        if (end >= today) {
            const y = new Date(`${today}T12:00:00Z`);
            y.setUTCDate(y.getUTCDate() - 1);
            end = y.toISOString().slice(0, 10);
        }
        if (start > end) return { success: true, rows: [], unmatched: 0 };

        // Autentica uma vez antes (chamadas paralelas de token falham no Secullum)
        await client.getAuthToken();
        const batidas = await client.getBatidas(start, end);
        const funcionarios = await client.getFuncionarios();
        const funcById = new Map<number, any>(funcionarios.map((f: any) => [f.Id, f]));

        // Colaboradores do Hub (por CPF) com alocação ativa -> posto -> contrato -> gestor
        const employees = await prisma.employee.findMany({
            select: {
                id: true,
                name: true,
                cpf: true,
                status: true,
                admissionDate: true,
                assignments: {
                    where: { endDate: null },
                    orderBy: { startDate: "desc" },
                    take: 1,
                    select: {
                        posto: {
                            select: {
                                role: { select: { name: true } },
                                client: {
                                    select: {
                                        id: true,
                                        name: true,
                                        accountManager: { select: { id: true, name: true, phone: true } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        const empByCpf = new Map(employees.map(e => [(e.cpf || "").replace(/\D/g, ""), e]));

        // Ajustes já existentes e itens ignorados no período
        const rangeStart = new Date(`${start}T00:00:00-03:00`);
        const rangeEnd = new Date(`${end}T23:59:59-03:00`);
        const [adjustments, ignores] = await Promise.all([
            prisma.attendancePunchAdjustment.findMany({
                where: { date: { gte: new Date(rangeStart.getTime() - 86400000), lte: new Date(rangeEnd.getTime() + 86400000) } },
                select: { id: true, code: true, status: true, secullumStatus: true, employeeId: true, date: true, createdAt: true },
                orderBy: { createdAt: "desc" }
            }),
            (prisma as any).punchInconsistencyIgnore.findMany({ where: { date: { gte: start, lte: end } } })
        ]);
        const adjByKey = new Map<string, (typeof adjustments)[number]>();
        for (const a of adjustments) {
            const k = `${a.employeeId}_${spDateParts(a.date).dateStr}`;
            if (!adjByKey.has(k)) adjByKey.set(k, a); // mais recente primeiro
        }
        const ignByKey = new Map<string, any>((ignores as any[]).map(i => [`${i.employeeId}_${i.date}`, i]));

        const rows: InconsistencyRow[] = [];
        const unmatchedFuncs = new Set<number>();

        for (const b of batidas as any[]) {
            const date = String(b.Data || "").slice(0, 10);
            if (!date || date < start || date > end) continue;

            const func = funcById.get(b.FuncionarioId);
            // Demitido até a data: não é inconsistência
            if (func?.Demissao && String(func.Demissao).slice(0, 10) <= date) continue;
            if (func?.Admissao && String(func.Admissao).slice(0, 10) > date) continue;

            const result = analyzeBatidaDay(b);
            if (!result) continue;

            const cpf = String(func?.Cpf || "").replace(/\D/g, "");
            const emp = cpf ? empByCpf.get(cpf) : undefined;
            if (!emp) {
                unmatchedFuncs.add(b.FuncionarioId);
                continue;
            }
            if (/deslig|demit|inativ/i.test(emp.status || "")) continue;
            if (emp.admissionDate && spDateParts(emp.admissionDate).dateStr > date) continue;

            const posto = emp.assignments[0]?.posto;
            const c = posto?.client;
            const key = `${emp.id}_${date}`;
            const adj = adjByKey.get(key) || null;
            const ign = ignByKey.get(key) || null;

            rows.push({
                key,
                employeeId: emp.id,
                employeeName: emp.name,
                folha: func?.NumeroFolha || null,
                date,
                weekday: new Date(`${date}T12:00:00Z`).getUTCDay(),
                clientId: c?.id || null,
                clientName: c?.name || null,
                postoName: posto?.role?.name || null,
                managerId: c?.accountManager?.id || null,
                managerName: c?.accountManager?.name || null,
                managerHasPhone: Boolean(c?.accountManager?.phone && c.accountManager.phone.replace(/\D/g, "").length >= 10),
                kind: result.kind,
                workedOnDayOff: result.workedOnDayOff,
                expected: result.expected,
                actual: result.actual,
                missing: result.missing,
                status: adj ? "ENVIADO" : ign ? "IGNORADO" : "NOVO",
                adjustment: adj ? { id: adj.id, code: adj.code, status: adj.status, secullumStatus: adj.secullumStatus } : null,
                ignored: ign ? { reason: ign.reason, userName: ign.userName } : null
            });
        }

        rows.sort((a, b) => (a.date === b.date ? a.employeeName.localeCompare(b.employeeName) : a.date < b.date ? 1 : -1));
        return { success: true, rows, unmatched: unmatchedFuncs.size };
    } catch (error: any) {
        console.error("[scanPunchInconsistencies] Erro:", error);
        return { success: false, message: error.message || "Erro ao buscar inconsistências.", rows: [], unmatched: 0 };
    }
}

/**
 * Cria UM ajuste por colaborador/dia e dispara o menu de tratativa no WhatsApp do gestor do contrato.
 */
export async function dispatchInconsistencies(items: Array<{
    employeeId: string;
    date: string;
    missing: PunchColumn[];
    expected: Partial<Record<PunchColumn, string>>;
    kind: "SEM_BATIDAS" | "INCOMPLETA";
}>): Promise<{ success: boolean; results: Array<{ key: string; ok: boolean; code?: string; message?: string }> }> {
    const user = await getCurrentUser();
    if (!user) return { success: false, results: items.map(i => ({ key: `${i.employeeId}_${i.date}`, ok: false, message: "Usuário não autenticado." })) };

    const { createPunchAdjustmentAlert } = await import("@/actions/punch-adjustments");
    const { sendPunchAdjustmentWhatsAppAlert } = await import("@/lib/punch-whatsapp");
    const results: Array<{ key: string; ok: boolean; code?: string; message?: string }> = [];

    for (const item of items) {
        const key = `${item.employeeId}_${item.date}`;
        try {
            // Evita duplicar: já existe ajuste para esse colaborador/dia?
            const dayStart = new Date(`${item.date}T00:00:00-03:00`);
            const dayEnd = new Date(`${item.date}T23:59:59-03:00`);
            const existing = await prisma.attendancePunchAdjustment.findFirst({
                where: { employeeId: item.employeeId, date: { gte: dayStart, lte: dayEnd } },
                select: { code: true }
            });
            if (existing) {
                results.push({ key, ok: false, code: existing.code, message: `Já existe o ajuste #${existing.code} para este dia.` });
                continue;
            }

            const missing = PUNCH_COLUMNS.filter(c => item.missing.includes(c));
            const punchType = item.kind === "SEM_BATIDAS" ? "SEM_BATIDAS" : missing.map(c => COLUMN_TO_PUNCH_TYPE[c]).join(",");
            const expectedTime = item.kind === "SEM_BATIDAS"
                ? PUNCH_COLUMNS.filter(c => item.expected[c]).map(c => item.expected[c]).join(" / ")
                : missing.map(c => `${COLUMN_LABEL[c]} ${item.expected[c] || "—"}`).join(" | ");

            const created = await createPunchAdjustmentAlert({
                employeeId: item.employeeId,
                // meio-dia em SP: garante que o dia do cartão não "vire" por fuso
                date: new Date(`${item.date}T12:00:00-03:00`),
                punchType,
                expectedTime: expectedTime || "Não informado",
                notes: `Tela de Inconsistências (${user.name || "RH"})`,
                source: "INCONSISTENCY_SCAN"
            });
            if (!created.success || !created.adjustment) {
                results.push({ key, ok: false, message: created.message || "Falha ao criar ajuste." });
                continue;
            }

            const sent = await sendPunchAdjustmentWhatsAppAlert(created.adjustment.id);
            results.push({
                key,
                ok: sent.success,
                code: created.adjustment.code,
                message: sent.success ? sent.message : `Ajuste #${created.adjustment.code} criado, mas o WhatsApp falhou: ${sent.message || "erro"}`
            });
        } catch (error: any) {
            results.push({ key, ok: false, message: error.message });
        }
    }

    revalidatePath("/admin/punch-adjustments");
    return { success: results.every(r => r.ok), results };
}

export async function ignoreInconsistency(employeeId: string, date: string, reason: string) {
    const user = await getCurrentUser();
    if (!user) return { success: false, message: "Usuário não autenticado." };
    await (prisma as any).punchInconsistencyIgnore.upsert({
        where: { employeeId_date: { employeeId, date } },
        update: { reason, userName: user.name || null },
        create: { employeeId, date, reason, userName: user.name || null }
    });
    return { success: true };
}

export async function unignoreInconsistency(employeeId: string, date: string) {
    const user = await getCurrentUser();
    if (!user) return { success: false, message: "Usuário não autenticado." };
    await (prisma as any).punchInconsistencyIgnore.deleteMany({ where: { employeeId, date } });
    return { success: true };
}
