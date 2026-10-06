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
import { generateAdjustmentCode } from "./punch-adjustments";

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
export async function scanPunchInconsistencies(params: { startDate: string; endDate: string; bypassAuth?: boolean }): Promise<{
    success: boolean;
    message?: string;
    rows: InconsistencyRow[];
    unmatched: number;
}> {
    try {
        if (!params.bypassAuth) {
            let user = null;
            try { user = await getCurrentUser(); } catch { user = null; }
            if (!user) return { success: false, message: "Usuário não autenticado.", rows: [], unmatched: 0 };
        }

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
        const [batidas, funcionarios, afastamentosSecullum] = await Promise.all([
            client.getBatidas(start, end),
            client.getFuncionarios(),
            client.getAfastamentos(start, end).catch(() => [])
        ]);
        const funcById = new Map<number, any>(funcionarios.map((f: any) => [f.Id, f]));

        // Colaboradores do Hub (por CPF) com alocação ativa -> posto -> contrato -> gestor
        // + Férias e atestados médicos cadastrados
        const employees = await prisma.employee.findMany({
            select: {
                id: true,
                name: true,
                cpf: true,
                status: true,
                admissionDate: true,
                lastVacationStart: true,
                lastVacationEnd: true,
                vacations: {
                    select: { startDate: true, endDate: true }
                },
                medicalCertificates: {
                    where: { status: { not: "REJEITADO" } },
                    select: { startDate: true, endDate: true }
                },
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

            // 1. CHECAGEM DE FÉRIAS (Tabela Vacation e campos do Employee)
            const isVacation = emp.vacations.some(v => {
                const vStart = spDateParts(v.startDate).dateStr;
                const vEnd = spDateParts(v.endDate).dateStr;
                return date >= vStart && date <= vEnd;
            }) || (emp.lastVacationStart && emp.lastVacationEnd && (() => {
                const lvStart = spDateParts(emp.lastVacationStart).dateStr;
                const lvEnd = spDateParts(emp.lastVacationEnd).dateStr;
                return date >= lvStart && date <= lvEnd;
            })());
            if (isVacation) continue;

            // 2. CHECAGEM DE ATESTADO MÉDICO
            const isMedicalLeave = emp.medicalCertificates.some(m => {
                const mStart = spDateParts(m.startDate).dateStr;
                const mEnd = spDateParts(m.endDate).dateStr;
                return date >= mStart && date <= mEnd;
            });
            if (isMedicalLeave) continue;

            // 3. CHECAGEM DE AFASTAMENTOS REGISTRADOS NO SECULLUM
            const isSecullumLeave = afastamentosSecullum.some((a: any) => {
                const aCpf = String(a.Cpf || a.FuncionarioCpf || a.Funcionario?.Cpf || "").replace(/\D/g, "");
                if (!aCpf || aCpf !== cpf) return false;
                const aStart = String(a.Inicio || a.DataInicio || "").slice(0, 10);
                const aEnd = String(a.Fim || a.DataFim || "").slice(0, 10);
                return (!aStart || date >= aStart) && (!aEnd || date <= aEnd);
            });
            if (isSecullumLeave) continue;

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
export async function dispatchInconsistencies(
    items: Array<{
        employeeId: string;
        date: string;
        missing: PunchColumn[];
        expected: Partial<Record<PunchColumn, string>>;
        kind: "SEM_BATIDAS" | "INCOMPLETA";
    }>,
    options?: { bypassAuth?: boolean; requestedByName?: string }
): Promise<{ success: boolean; results: Array<{ key: string; ok: boolean; code?: string; message?: string }> }> {
    let userName = options?.requestedByName || "Robô de Ponto";
    if (!options?.bypassAuth) {
        let user = null;
        try { user = await getCurrentUser(); } catch { user = null; }
        if (!user) return { success: false, results: items.map(i => ({ key: `${i.employeeId}_${i.date}`, ok: false, message: "Usuário não autenticado." })) };
        userName = user.name || "RH";
    }

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
                notes: `Tela de Inconsistências (${userName})`,
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

/**
 * Lança uma batida manual DIRETO no Secullum (ex: caso de 1 batida faltando por esquecimento)
 * sem precisar enviar para o gestor via WhatsApp.
 */
export async function launchDirectManualPunch(params: {
    employeeId: string;
    date: string; // YYYY-MM-DD
    coluna: PunchColumn;
    hora: string; // HH:mm
    motivo?: string;
}): Promise<{ success: boolean; message: string }> {
    try {
        const user = await getCurrentUser();
        if (!user) return { success: false, message: "Usuário não autenticado." };

        const client = await getSecullumClient();
        if (!client) return { success: false, message: "Secullum não configurado em Benefícios." };

        const emp = await prisma.employee.findUnique({
            where: { id: params.employeeId },
            include: {
                assignments: {
                    where: { endDate: null },
                    take: 1,
                    include: { posto: { include: { client: true } } }
                }
            }
        });
        if (!emp || !emp.cpf) return { success: false, message: "Colaborador ou CPF não localizado." };

        const cpfClean = emp.cpf.replace(/\D/g, "");
        const cleanDate = params.date;
        const motivo = params.motivo || `Ajuste Direto RH (${user.name || "Admin"}) | Esquecimento de batida`;

        // Obter estado atual do dia no Secullum
        const registro = await client.getRegistroDoDia(cpfClean, cleanDate).catch(() => null);
        
        // 1. Tratamento inteligente de batida deslocada:
        // Caso clássico: O colaborador bateu 3 vezes (E1, S1 e a saída no fim do dia).
        // Como não bateu o almoço, o Secullum aloca a 3ª batida em Entrada2 e deixa Saida2 vazia.
        // Se estamos lançando Entrada2 (retorno do almoço) e Entrada2 já tem batida enquanto Saida2 está vazia:
        if (params.coluna === "Entrada2" && registro?.Entrada2 && !registro?.Saida2) {
            console.log(`[launchDirectManualPunch] Deslocando batida de Entrada2 (${registro.Entrada2}) para Saida2 antes de lançar...`);
            const swapRes = await client.trocarColunaBatida({
                cpf: cpfClean,
                data: cleanDate,
                colunaOrigem: "Entrada2",
                colunaDestino: "Saida2"
            });
            if (!swapRes.success) {
                console.warn("[launchDirectManualPunch] Aviso ao trocar coluna:", swapRes.message);
            }
        }

        // 2. Se a batida exata já existe na coluna no Secullum (ex: tentativa anterior onde o Secullum gravou mas o Hub falhou):
        const alreadyHasExactPunch = Boolean(
            registro && (registro[params.coluna] === params.hora || registro[params.coluna]?.trim() === params.hora.trim())
        );

        let resMessage = "Batida incluída com sucesso.";
        let resRaw: any = null;

        if (alreadyHasExactPunch) {
            console.log(`[launchDirectManualPunch] Marcação ${params.coluna} (${params.hora}) já confirmada no Secullum.`);
            resMessage = `Marcação ${COLUMN_LABEL[params.coluna] || params.coluna} (${params.hora}) já confirmada no Secullum.`;
        } else {
            // Lançar batida manual no Secullum
            const res = await client.lancarBatidaManual({
                cpf: cpfClean,
                data: cleanDate,
                hora: params.hora,
                coluna: params.coluna,
                motivo
            });

            if (!res.success) {
                // Se der erro de não poder sobrescrever, checa se a batida acabou entrando
                const checkAgain = await client.getRegistroDoDia(cpfClean, cleanDate).catch(() => null);
                if (checkAgain && checkAgain[params.coluna]?.trim() === params.hora.trim()) {
                    resMessage = `Marcação ${COLUMN_LABEL[params.coluna] || params.coluna} (${params.hora}) confirmada no Secullum.`;
                } else {
                    return { success: false, message: `Erro Secullum: ${res.message}` };
                }
            } else {
                resMessage = res.message;
                resRaw = res.raw;
            }
        }

        // Criar ou atualizar o registro de ajuste no Hub como SUCESSO / APPROVED_SYNCED
        const dayStart = new Date(`${cleanDate}T00:00:00-03:00`);
        const dayEnd = new Date(`${cleanDate}T23:59:59-03:00`);
        const existingAdj = await prisma.attendancePunchAdjustment.findFirst({
            where: { employeeId: emp.id, date: { gte: dayStart, lte: dayEnd } }
        });

        const posto = emp.assignments[0]?.posto;
        const c = posto?.client;

        if (existingAdj) {
            await prisma.attendancePunchAdjustment.update({
                where: { id: existingAdj.id },
                data: {
                    status: "APPROVED_SYNCED",
                    secullumStatus: "SUCESSO",
                    secullumReasonId: "ESQUECIMENTO",
                    secullumReasonName: "SEM REGISTRO DE PONTO (ESQUECIMENTO)",
                    requestedTime: `${params.coluna} ${params.hora}`,
                    secullumResponseLog: JSON.stringify({ message: resMessage, raw: resRaw }),
                    resolvedByUserId: user.id,
                    resolvedAt: new Date()
                }
            });
        } else {
            const code = await generateAdjustmentCode();
            await prisma.attendancePunchAdjustment.create({
                data: {
                    code,
                    employeeId: emp.id,
                    clientId: c?.id || null,
                    postoId: posto?.id || null,
                    date: new Date(`${cleanDate}T12:00:00-03:00`),
                    punchType: COLUMN_TO_PUNCH_TYPE[params.coluna] || params.coluna,
                    expectedTime: `${COLUMN_LABEL[params.coluna] || params.coluna} ${params.hora}`,
                    requestedTime: `${COLUMN_LABEL[params.coluna] || params.coluna} ${params.hora}`,
                    secullumReasonId: "ESQUECIMENTO",
                    secullumReasonName: "SEM REGISTRO DE PONTO (ESQUECIMENTO)",
                    notes: motivo,
                    status: "APPROVED_SYNCED",
                    secullumStatus: "SUCESSO",
                    secullumResponseLog: JSON.stringify({ message: resMessage, raw: resRaw }),
                    source: "MANUAL_DIRECT",
                    resolvedByUserId: user.id,
                    resolvedAt: new Date()
                }
            });
        }

        revalidatePath("/admin/punch-inconsistencies");
        revalidatePath("/admin/punch-adjustments");
        return { success: true, message: `Batida ${COLUMN_LABEL[params.coluna] || params.coluna} (${params.hora}) incluída no Secullum com sucesso!` };
    } catch (error: any) {
        console.error("[launchDirectManualPunch] Erro:", error);
        return { success: false, message: error.message || "Erro ao lançar batida manual." };
    }
}

