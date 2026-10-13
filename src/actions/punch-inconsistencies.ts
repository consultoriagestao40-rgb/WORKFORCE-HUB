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
    expectedScheduleFromBatida,
    planAutoIntervalFix,
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
    adjustment: {
        id: string;
        code: string;
        status: string;
        secullumStatus: string | null;
        sendCount: number;
        lastSentAt: string | null;
        requestedByName: string | null;   // quem solicitou o ajuste (gestor/líder)
        requestedAt: string | null;       // data da solicitação
        reasonName: string | null;        // motivo do ajuste
        requestedTime: string | null;     // marcação solicitada
    } | null;
    ignored: { reason: string | null; userName: string | null } | null;
    /** Pendência de ponto na folha: não enviada, aguardando resposta do gestor ou aguardando RH */
    pending: boolean;
    pendingKind: "NOVO" | "AGUARDANDO_GESTOR" | "AGUARDANDO_RH" | null;
};

export type EmployeeDay = {
    date: string;                 // YYYY-MM-DD
    weekday: number;
    actual: Partial<Record<PunchColumn, string>>;
    expected: Partial<Record<PunchColumn, string>>;
    dayOff: boolean;
    leaveNote: string | null;     // Férias / Atestado / Afastamento
    rowKey: string | null;        // chave da InconsistencyRow, quando o dia tem inconsistência
};

export type EmployeeTimecard = {
    employeeId: string;
    employeeName: string;
    folha: string | null;
    clientId: string | null;
    clientName: string | null;
    postoName: string | null;
    managerId: string | null;
    managerName: string | null;
    managerHasPhone: boolean;
    semPonto: boolean;            // ativo no Hub, mas sem cartão no Secullum no período
    days: EmployeeDay[];
};

const WAITING_MANAGER_STATUSES = ["PENDING_RESPONSE", "PENDING_REASON", "PENDING_SCOPE"];

function pendingInfo(adj: { status: string } | null, ignored: boolean): { pending: boolean; pendingKind: InconsistencyRow["pendingKind"] } {
    if (ignored) return { pending: false, pendingKind: null };
    if (!adj) return { pending: true, pendingKind: "NOVO" };
    if (WAITING_MANAGER_STATUSES.includes(adj.status)) return { pending: true, pendingKind: "AGUARDANDO_GESTOR" };
    if (adj.status === "PENDING_AUDIT") return { pending: true, pendingKind: "AGUARDANDO_RH" };
    // Ajuste lançado, falta confirmada, rejeitado ou descartado: não é mais pendência
    return { pending: false, pendingKind: null };
}

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
    employees?: EmployeeTimecard[];
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
                where: {
                    date: { gte: new Date(rangeStart.getTime() - 86400000), lte: new Date(rangeEnd.getTime() + 86400000) },
                    // Descarte automático por data de corte da rotina NÃO resolve a pendência de ponto
                    NOT: { status: "DISCARDED_OFFLINE_FOUND", notes: { contains: "anterior ao início oficial" } }
                },
                select: {
                    id: true, code: true, status: true, secullumStatus: true, employeeId: true, date: true, createdAt: true,
                    sendCount: true, lastSentAt: true, requestedByName: true, requestedAt: true,
                    secullumReasonName: true, requestedTime: true
                },
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
        const timecards = new Map<string, EmployeeTimecard>();

        for (const b of batidas as any[]) {
            const date = String(b.Data || "").slice(0, 10);
            if (!date || date < start || date > end) continue;

            const func = funcById.get(b.FuncionarioId);
            // Demitido até a data: não é inconsistência
            if (func?.Demissao && String(func.Demissao).slice(0, 10) <= date) continue;
            if (func?.Admissao && String(func.Admissao).slice(0, 10) > date) continue;

            const result = analyzeBatidaDay(b);

            const cpf = String(func?.Cpf || "").replace(/\D/g, "");
            const emp = cpf ? empByCpf.get(cpf) : undefined;
            if (!emp) {
                if (result) unmatchedFuncs.add(b.FuncionarioId);
                continue;
            }
            if (/deslig|demit|inativ/i.test(emp.status || "")) continue;
            if (emp.admissionDate && spDateParts(emp.admissionDate).dateStr > date) continue;

            const posto = emp.assignments[0]?.posto;
            const c = posto?.client;

            let card = timecards.get(emp.id);
            if (!card) {
                card = {
                    employeeId: emp.id,
                    employeeName: emp.name,
                    folha: func?.NumeroFolha || null,
                    clientId: c?.id || null,
                    clientName: c?.name || null,
                    postoName: posto?.role?.name || null,
                    managerId: c?.accountManager?.id || null,
                    managerName: c?.accountManager?.name || null,
                    managerHasPhone: Boolean(c?.accountManager?.phone && c.accountManager.phone.replace(/\D/g, "").length >= 10),
                    semPonto: false,
                    days: []
                };
                timecards.set(emp.id, card);
            }

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

            // 2. CHECAGEM DE ATESTADO MÉDICO
            const isMedicalLeave = emp.medicalCertificates.some(m => {
                const mStart = spDateParts(m.startDate).dateStr;
                const mEnd = spDateParts(m.endDate).dateStr;
                return date >= mStart && date <= mEnd;
            });

            // 3. CHECAGEM DE AFASTAMENTOS REGISTRADOS NO SECULLUM
            const isSecullumLeave = afastamentosSecullum.some((a: any) => {
                const aCpf = String(a.Cpf || a.FuncionarioCpf || a.Funcionario?.Cpf || "").replace(/\D/g, "");
                if (!aCpf || aCpf !== cpf) return false;
                const aStart = String(a.Inicio || a.DataInicio || "").slice(0, 10);
                const aEnd = String(a.Fim || a.DataFim || "").slice(0, 10);
                return (!aStart || date >= aStart) && (!aEnd || date <= aEnd);
            });

            const leaveNote = isVacation ? "Férias" : isMedicalLeave ? "Atestado" : isSecullumLeave ? "Afastamento" : null;
            const key = `${emp.id}_${date}`;

            const dayActual: Partial<Record<PunchColumn, string>> = {};
            for (const col of PUNCH_COLUMNS) {
                const v = b[col];
                if (typeof v === "string" && v.trim()) dayActual[col] = v.trim();
            }
            const hasRow = Boolean(result) && !leaveNote;
            card.days.push({
                date,
                weekday: new Date(`${date}T12:00:00Z`).getUTCDay(),
                actual: dayActual,
                expected: result?.expected || expectedScheduleFromBatida(b),
                dayOff: b.Folga === true,
                leaveNote,
                rowKey: hasRow ? key : null
            });

            if (!result || leaveNote) continue;

            const adj = adjByKey.get(key) || null;
            const ign = ignByKey.get(key) || null;
            const pend = pendingInfo(adj, Boolean(ign));

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
                adjustment: adj ? {
                    id: adj.id,
                    code: adj.code,
                    status: adj.status,
                    secullumStatus: adj.secullumStatus,
                    sendCount: adj.sendCount ?? 0,
                    lastSentAt: adj.lastSentAt ? adj.lastSentAt.toISOString() : null,
                    requestedByName: adj.requestedByName || null,
                    requestedAt: adj.requestedAt ? adj.requestedAt.toISOString() : null,
                    reasonName: adj.secullumReasonName || null,
                    requestedTime: adj.requestedTime || null
                } : null,
                ignored: ign ? { reason: ign.reason, userName: ign.userName } : null,
                pending: pend.pending,
                pendingKind: pend.pendingKind
            });
        }

        // Colaboradores ativos no Hub sem nenhum cartão no Secullum no período
        for (const emp of employees) {
            if (timecards.has(emp.id)) continue;
            if (!emp.cpf) continue;
            if (/deslig|demit|inativ/i.test(emp.status || "")) continue;
            if (emp.admissionDate && spDateParts(emp.admissionDate).dateStr > end) continue;
            const posto = emp.assignments[0]?.posto;
            if (!posto) continue; // sem alocação ativa: não é colaborador de posto
            const c = posto.client;
            timecards.set(emp.id, {
                employeeId: emp.id,
                employeeName: emp.name,
                folha: null,
                clientId: c?.id || null,
                clientName: c?.name || null,
                postoName: posto.role?.name || null,
                managerId: c?.accountManager?.id || null,
                managerName: c?.accountManager?.name || null,
                managerHasPhone: Boolean(c?.accountManager?.phone && c.accountManager.phone.replace(/\D/g, "").length >= 10),
                semPonto: true,
                days: []
            });
        }
        const employeeCards = Array.from(timecards.values());
        employeeCards.forEach(card => card.days.sort((a, b) => (a.date < b.date ? -1 : 1)));

        rows.sort((a, b) => (a.date === b.date ? a.employeeName.localeCompare(b.employeeName) : a.date < b.date ? 1 : -1));
        return { success: true, rows, unmatched: unmatchedFuncs.size, employees: employeeCards };
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
): Promise<{ success: boolean; results: Array<{ key: string; ok: boolean; code?: string; adjustmentId?: string; message?: string }> }> {
    let userName = options?.requestedByName || "Robô de Ponto";
    if (!options?.bypassAuth) {
        let user = null;
        try { user = await getCurrentUser(); } catch { user = null; }
        if (!user) return { success: false, results: items.map(i => ({ key: `${i.employeeId}_${i.date}`, ok: false, message: "Usuário não autenticado." })) };
        userName = user.name || "RH";
    }

    const { createPunchAdjustmentAlert } = await import("@/actions/punch-adjustments");
    const { sendPunchAdjustmentWhatsAppAlert } = await import("@/lib/punch-whatsapp");
    const results: Array<{ key: string; ok: boolean; code?: string; adjustmentId?: string; message?: string }> = [];

    for (const item of items) {
        const key = `${item.employeeId}_${item.date}`;
        try {
            // Evita duplicar: já existe ajuste para esse colaborador/dia?
            const dayStart = new Date(`${item.date}T00:00:00-03:00`);
            const dayEnd = new Date(`${item.date}T23:59:59-03:00`);
            const existing = await prisma.attendancePunchAdjustment.findFirst({
                where: {
                    employeeId: item.employeeId,
                    date: { gte: dayStart, lte: dayEnd },
                    NOT: { status: "DISCARDED_OFFLINE_FOUND", notes: { contains: "anterior ao início oficial" } }
                },
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
                adjustmentId: created.adjustment.id,
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

        // Obter estado atual do dia no Secullum (registro diário ou, se indisponível, Calcular)
        const cols = await client.getBatidasColunasDoDia(cpfClean, cleanDate);
        
        // 1. Tratamento inteligente de batida deslocada:
        // Caso clássico: O colaborador bateu 3 vezes (E1, S1 e a saída no fim do dia).
        // Como não bateu o almoço, o Secullum aloca a 3ª batida em Entrada2 e deixa Saida2 vazia.
        // Se estamos lançando Entrada2 (retorno do almoço) e Entrada2 já tem batida enquanto Saida2 está vazia:
        if (params.coluna === "Entrada2" && cols.Entrada2 && !cols.Saida2) {
            console.log(`[launchDirectManualPunch] Deslocando batida de Entrada2 (${cols.Entrada2}) para Saida2 antes de lançar...`);
            const swapRes = await client.trocarColunaBatida({
                cpf: cpfClean,
                data: cleanDate,
                colunaOrigem: "Entrada2",
                colunaDestino: "Saida2"
            });
            if (!swapRes.success) {
                return { success: false, message: `A saída (${cols.Entrada2}) está em Entrada 2 e não foi possível movê-la para Saída 2: ${swapRes.message}` };
            }
        }

        // 2. Se a batida exata já existe na coluna no Secullum (ex: tentativa anterior onde o Secullum gravou mas o Hub falhou):
        const alreadyHasExactPunch = Boolean(
            cols[params.coluna] && cols[params.coluna]!.trim() === params.hora.trim()
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
                const checkAgain = await client.getBatidasColunasDoDia(cpfClean, cleanDate).catch(() => null);
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

/**
 * AJUSTE AUTOMÁTICO DE INTERVALO
 * Varre o período e, quando o colaborador tem entrada e saída final coerentes com a escala e faltam as duas
 * batidas do intervalo (ou só uma), reposiciona a saída final (se necessário) e lança o intervalo direto no
 * Secullum, registrando no Hub como "Lançado automaticamente" (source AUTO_INTERVAL).
 */
export async function autoFixIntervals(params: { startDate: string; endDate: string; bypassAuth?: boolean; dryRun?: boolean }): Promise<{
    success: boolean;
    message?: string;
    fixed: Array<{ key: string; employeeName: string; date: string; summary: string }>;
    failed: Array<{ key: string; employeeName: string; date: string; message: string }>;
    candidates: number;
}> {
    const empty = { fixed: [], failed: [], candidates: 0 };
    try {
        if (!params.bypassAuth) {
            let user = null;
            try { user = await getCurrentUser(); } catch { user = null; }
            if (!user) return { success: false, message: "Usuário não autenticado.", ...empty };
        }
        const client = await getSecullumClient();
        if (!client) return { success: false, message: "Secullum não configurado em Benefícios.", ...empty };

        const scan = await scanPunchInconsistencies({ startDate: params.startDate, endDate: params.endDate, bypassAuth: true });
        if (!scan.success) return { success: false, message: scan.message, ...empty };

        const candidates = scan.rows.filter(r => r.status === "NOVO" && r.kind === "INCOMPLETA" && !r.workedOnDayOff);
        const fixed: Array<{ key: string; employeeName: string; date: string; summary: string }> = [];
        const failed: Array<{ key: string; employeeName: string; date: string; message: string }> = [];
        let eligible = 0;

        for (const row of candidates) {
            const plan = planAutoIntervalFix(row.actual, row.expected);
            if (!plan) continue;
            eligible++;
            const base = { key: row.key, employeeName: row.employeeName, date: row.date };
            if (params.dryRun) { fixed.push({ ...base, summary: plan.summary }); continue; }

            try {
                const emp = await prisma.employee.findUnique({
                    where: { id: row.employeeId },
                    select: {
                        id: true, cpf: true,
                        assignments: { where: { endDate: null }, take: 1, select: { posto: { select: { id: true, clientId: true } } } }
                    }
                });
                if (!emp?.cpf) { failed.push({ ...base, message: "CPF não localizado." }); continue; }
                const cpf = emp.cpf.replace(/\D/g, "");

                // Reconfere o cartão ao vivo: se mudou desde a varredura, não mexe
                const registro = await client.getRegistroDoDia(cpf, row.date).catch(() => null);
                const unchanged = registro && PUNCH_COLUMNS.every(c => {
                    const v = typeof registro[c] === "string" ? registro[c].trim() : "";
                    return v === (row.actual[c] || "");
                });
                if (!unchanged) { failed.push({ ...base, message: "Cartão mudou desde a varredura; pulado." }); continue; }

                const log: string[] = [];
                let error: string | null = null;
                for (const m of plan.moves) {
                    const r = await client.trocarColunaBatida({ cpf, data: row.date, colunaOrigem: m.from, colunaDestino: m.to });
                    if (!r.success) { error = `Troca ${m.from}→${m.to} falhou: ${r.message}`; break; }
                    log.push(`${m.from}→${m.to}`);
                }
                if (!error) {
                    for (const p of plan.punches) {
                        const r = await client.lancarBatidaManual({
                            cpf, data: row.date, hora: p.hora, coluna: p.coluna,
                            motivo: "Ajuste automático de intervalo (Hub) | Esquecimento de batida"
                        });
                        if (!r.success) { error = `${p.coluna} ${p.hora}: ${r.message}`; break; }
                        log.push(`${p.coluna} ${p.hora}`);
                    }
                }

                const punchType = plan.punches.map(p => COLUMN_TO_PUNCH_TYPE[p.coluna]).join(",");
                await prisma.attendancePunchAdjustment.create({
                    data: {
                        code: await generateAdjustmentCode(),
                        employeeId: emp.id,
                        clientId: emp.assignments[0]?.posto?.clientId || null,
                        postoId: emp.assignments[0]?.posto?.id || null,
                        date: new Date(`${row.date}T12:00:00-03:00`),
                        punchType,
                        expectedTime: plan.summary,
                        requestedTime: plan.summary,
                        secullumReasonId: "ESQUECIMENTO",
                        secullumReasonName: "SEM REGISTRO DE PONTO (ESQUECIMENTO)",
                        punchScope: "INTERVALO",
                        notes: error
                            ? `Ajuste automático de intervalo FALHOU parcialmente: ${error}`
                            : "Lançado automaticamente (intervalo não batido; entrada e saída conferem com a escala)",
                        status: error ? "PENDING_AUDIT" : "APPROVED_SYNCED",
                        secullumStatus: error ? "ERRO" : "SUCESSO",
                        secullumResponseLog: JSON.stringify({ auto: true, applied: log, error }),
                        source: "AUTO_INTERVAL",
                        resolvedAt: error ? null : new Date()
                    }
                });

                if (error) failed.push({ ...base, message: error });
                else fixed.push({ ...base, summary: plan.summary });
            } catch (e: any) {
                failed.push({ ...base, message: e.message || "Erro inesperado." });
            }
        }

        if (!params.dryRun && (fixed.length || failed.length)) {
            revalidatePath("/admin/punch-inconsistencies");
            revalidatePath("/admin/punch-adjustments");
        }
        return { success: true, fixed, failed, candidates: eligible };
    } catch (error: any) {
        console.error("[autoFixIntervals] Erro:", error);
        return { success: false, message: error.message || "Erro no ajuste automático de intervalo.", ...empty };
    }
}

/**
 * Reenvia ao gestor uma inconsistência que continua sem resposta. Cada envio é contabilizado
 * (sendCount / lastSentAt) para mostrar "2º envio", "3º envio"... até a pendência ser resolvida.
 */
export async function resendPunchAdjustmentToManager(adjustmentId: string): Promise<{ success: boolean; message: string; sendCount?: number; lastSentAt?: string }> {
    try {
        const user = await getCurrentUser().catch(() => null);
        if (!user) return { success: false, message: "Usuário não autenticado." };

        const adj = await prisma.attendancePunchAdjustment.findUnique({ where: { id: adjustmentId }, select: { id: true, status: true } });
        if (!adj) return { success: false, message: "Ajuste não encontrado." };
        if (!WAITING_MANAGER_STATUSES.includes(adj.status)) {
            return { success: false, message: "Este ajuste não está aguardando resposta do gestor." };
        }

        const { sendPunchAdjustmentWhatsAppAlert } = await import("@/lib/punch-whatsapp");
        const sent = await sendPunchAdjustmentWhatsAppAlert(adjustmentId);
        if (!sent.success) return { success: false, message: sent.message || "Falha ao reenviar ao gestor." };

        const updated = await prisma.attendancePunchAdjustment.findUnique({ where: { id: adjustmentId }, select: { sendCount: true, lastSentAt: true } });
        revalidatePath("/admin/punch-adjustments");
        return {
            success: true,
            message: `Reenviado ao gestor (${updated?.sendCount ?? "?"}º envio).`,
            sendCount: updated?.sendCount ?? undefined,
            lastSentAt: updated?.lastSentAt ? updated.lastSentAt.toISOString() : undefined
        };
    } catch (error: any) {
        return { success: false, message: error.message || "Erro ao reenviar." };
    }
}

/** Justificativas ativas do Secullum para o RH lançar/abonar direto pelo modal do colaborador. */
export async function listLaunchJustifications(): Promise<{ success: boolean; items: Array<{ codigo: string; descricao: string; abonar: boolean }>; message?: string }> {
    try {
        const user = await getCurrentUser().catch(() => null);
        if (!user) return { success: false, items: [], message: "Usuário não autenticado." };
        const client = await getSecullumClient();
        if (!client) return { success: false, items: [], message: "Secullum não configurado em Benefícios." };
        const list = await client.getJustificativas();
        const items = list
            .filter((j: any) => !j.Desativar && (j.NomeAbreviado || "").trim())
            .map((j: any) => ({
                codigo: String(j.NomeAbreviado).trim(),
                descricao: String(j.NomeCompleto || j.NomeAbreviado).trim(),
                abonar: Boolean(j.Ajuste)
            }))
            .sort((a: any, b: any) => a.descricao.localeCompare(b.descricao));
        return { success: true, items };
    } catch (error: any) {
        return { success: false, items: [], message: error.message || "Erro ao listar justificativas." };
    }
}

/**
 * Lança uma justificativa/abono (ex: Feriado, Abono, Atestado) direto no cartão do Secullum,
 * nas jornadas do dia que ainda não têm batida.
 */
export async function launchDirectJustification(params: {
    employeeId: string;
    date: string; // YYYY-MM-DD
    codigo: string;
    abonar: boolean;
    observacao?: string;
    expectedGroups?: number[];
}): Promise<{ success: boolean; message: string }> {
    try {
        const user = await getCurrentUser().catch(() => null);
        if (!user) return { success: false, message: "Usuário não autenticado." };
        const client = await getSecullumClient();
        if (!client) return { success: false, message: "Secullum não configurado em Benefícios." };

        const emp = await prisma.employee.findUnique({ where: { id: params.employeeId }, select: { cpf: true, name: true } });
        if (!emp?.cpf) return { success: false, message: "Colaborador ou CPF não localizado." };
        const cpf = emp.cpf.replace(/\D/g, "");

        const cols = await client.getBatidasColunasDoDia(cpf, params.date);
        const isTime = (v: any) => typeof v === "string" && /^\d{1,2}:\d{2}/.test(v.trim());
        const candidates = params.expectedGroups && params.expectedGroups.length ? params.expectedGroups : [1, 2];
        const grupos = candidates.filter(g => !(isTime(cols[`Entrada${g}`]) || isTime(cols[`Saida${g}`])));
        if (grupos.length === 0) {
            return { success: false, message: "Todas as jornadas deste dia já possuem batidas. Lance a batida faltante como batida manual." };
        }

        const res = await client.lancarJustificativaPonto({
            cpf,
            data: params.date,
            justificativa: params.codigo,
            observacoes: (params.observacao || `Lançado pelo RH ${user.name || "Admin"}`).slice(0, 200),
            abonar: params.abonar,
            grupos
        });
        if (res.success) revalidatePath("/admin/punch-adjustments");
        return { success: res.success, message: res.message };
    } catch (error: any) {
        return { success: false, message: error.message || "Erro ao lançar justificativa." };
    }
}

/**
 * Lança múltiplas batidas manuais (ou todas as batidas faltantes/editadas do dia) diretamente no Secullum
 * com motivo e auditoria no Hub.
 */
export async function launchDirectDayAdjustments(params: {
    employeeId: string;
    date: string; // YYYY-MM-DD
    punches: Array<{ coluna: PunchColumn; hora: string }>;
    motivo?: string;
}): Promise<{ success: boolean; message: string; count?: number }> {
    try {
        const user = await getCurrentUser();
        if (!user) return { success: false, message: "Usuário não autenticado." };

        const client = await getSecullumClient();
        if (!client) return { success: false, message: "Secullum não configurado em Benefícios." };

        if (!params.punches || params.punches.length === 0) {
            return { success: false, message: "Nenhuma batida informada para lançar." };
        }

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
        const motivo = params.motivo?.trim() || `Ajuste Direto RH (${user.name || "Admin"}) | Correção de batidas`;

        let cols = await client.getBatidasColunasDoDia(cpfClean, cleanDate);
        let successCount = 0;
        const launchedList: string[] = [];
        const errors: string[] = [];

        // Ordena para lançar em ordem cronológica de jornada (E1, S1, E2, S2...)
        const colOrder: PunchColumn[] = ["Entrada1", "Saida1", "Entrada2", "Saida2", "Entrada3", "Saida3"];
        const sortedPunches = [...params.punches].sort((a, b) => colOrder.indexOf(a.coluna) - colOrder.indexOf(b.coluna));

        for (const p of sortedPunches) {
            const hora = p.hora?.trim();
            if (!hora || !/^\d{1,2}:\d{2}$/.test(hora)) continue;

            // Se for Entrada2 e Entrada2 tiver marcação enquanto Saida2 está vazia, swap primeiro
            if (p.coluna === "Entrada2" && cols.Entrada2 && !cols.Saida2) {
                const swapRes = await client.trocarColunaBatida({
                    cpf: cpfClean,
                    data: cleanDate,
                    colunaOrigem: "Entrada2",
                    colunaDestino: "Saida2"
                });
                if (swapRes.success) {
                    cols = await client.getBatidasColunasDoDia(cpfClean, cleanDate);
                }
            }

            // Se já tem essa mesma hora na coluna, pula
            if (cols[p.coluna] && cols[p.coluna]!.trim() === hora) {
                successCount++;
                launchedList.push(`${COLUMN_LABEL[p.coluna] || p.coluna} ${hora} (já constava)`);
                continue;
            }

            const res = await client.lancarBatidaManual({
                cpf: cpfClean,
                data: cleanDate,
                hora,
                coluna: p.coluna,
                motivo
            });

            if (res.success) {
                successCount++;
                launchedList.push(`${COLUMN_LABEL[p.coluna] || p.coluna} ${hora}`);
                cols[p.coluna] = hora;
            } else {
                errors.push(`${COLUMN_LABEL[p.coluna] || p.coluna}: ${res.message}`);
            }
        }

        if (successCount === 0) {
            return { success: false, message: `Falha ao lançar batidas no Secullum: ${errors.join("; ")}` };
        }

        // Registrar / atualizar o ajuste no Hub
        const dayStart = new Date(`${cleanDate}T00:00:00-03:00`);
        const dayEnd = new Date(`${cleanDate}T23:59:59-03:00`);
        const existingAdj = await prisma.attendancePunchAdjustment.findFirst({
            where: { employeeId: emp.id, date: { gte: dayStart, lte: dayEnd } }
        });

        const posto = emp.assignments[0]?.posto;
        const c = posto?.client;
        const requestedSummary = launchedList.join(" · ");

        if (existingAdj) {
            await prisma.attendancePunchAdjustment.update({
                where: { id: existingAdj.id },
                data: {
                    status: "APPROVED_SYNCED",
                    secullumStatus: "SUCESSO",
                    secullumReasonId: "AJUSTE_MANUAL",
                    secullumReasonName: "AJUSTE MANUAL RH",
                    requestedTime: requestedSummary,
                    notes: motivo,
                    secullumResponseLog: JSON.stringify({ launchedList, errors }),
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
                    punchType: "OUTRO",
                    expectedTime: requestedSummary,
                    requestedTime: requestedSummary,
                    secullumReasonId: "AJUSTE_MANUAL",
                    secullumReasonName: "AJUSTE MANUAL RH",
                    notes: motivo,
                    status: "APPROVED_SYNCED",
                    secullumStatus: "SUCESSO",
                    secullumResponseLog: JSON.stringify({ launchedList, errors }),
                    source: "MANUAL_DIRECT",
                    resolvedByUserId: user.id,
                    resolvedAt: new Date()
                }
            });
        }

        revalidatePath("/admin/punch-inconsistencies");
        revalidatePath("/admin/punch-adjustments");

        return {
            success: true,
            count: successCount,
            message: `${successCount} batida(s) gravada(s) no Secullum com sucesso! (${requestedSummary})${errors.length ? ` Falhas parciais: ${errors.join("; ")}` : ""}`
        };
    } catch (error: any) {
        console.error("[launchDirectDayAdjustments] Erro:", error);
        return { success: false, message: error.message || "Erro ao gravar batidas." };
    }
}
