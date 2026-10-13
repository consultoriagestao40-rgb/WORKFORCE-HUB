"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getBenefitsConfig } from "@/actions/benefits";
import { SecullumApiClient } from "@/lib/secullum";
import { getCurrentUser } from "@/lib/auth";
import { planPunches, spDateParts, PUNCH_TYPE_TO_SECULLUM_COLUMN } from "@/lib/punch-time";
import { expectedScheduleFromBatida } from "@/lib/punch-inconsistency";

export interface PunchAdjustmentFilter {
    status?: string;
    startDate?: string;
    endDate?: string;
    clientId?: string;
    search?: string;
}

/**
 * Sincroniza todas as justificativas cadastradas no Secullum Ponto Web
 */
export async function syncSecullumJustifications() {
    try {
        const config = await getBenefitsConfig();
        const bankId = config?.secullumCompanyId?.trim();
        const token = config?.secullumApiToken?.trim();
        const apiUrl = config?.secullumApiUrl?.trim();

        if (!bankId || !token) {
            return { success: false, message: "Secullum não configurado em Benefícios." };
        }

        const client = new SecullumApiClient(token, bankId, apiUrl);
        const rawJusts = await client.getJustificativas();

        if (!Array.isArray(rawJusts) || rawJusts.length === 0) {
            return { success: false, message: "Nenhuma justificativa retornada pelo Secullum." };
        }

        let syncedCount = 0;
        for (const j of rawJusts) {
            const secId = j.Id;
            const cod = (j.NomeAbreviado || "").trim();
            const desc = (j.NomeCompleto || cod).trim();
            const desativar = Boolean(j.Desativar);
            const abonar = Boolean(j.Ajuste);

            await prisma.secullumJustification.upsert({
                where: { secullumId: secId },
                update: {
                    codigo: cod,
                    descricao: desc,
                    abonar,
                    isActive: !desativar
                },
                create: {
                    secullumId: secId,
                    codigo: cod,
                    descricao: desc,
                    abonar,
                    isActive: !desativar
                }
            });
            syncedCount++;
        }

        return { success: true, count: syncedCount, message: `${syncedCount} justificativas sincronizadas.` };
    } catch (error: any) {
        console.error("[syncSecullumJustifications] Erro:", error);
        return { success: false, message: error.message || "Erro desconhecido ao sincronizar justificativas." };
    }
}

/**
 * Retorna as justificativas ativas cadastradas
 */
export async function getSecullumJustifications() {
    try {
        const list = await prisma.secullumJustification.findMany({
            where: { isActive: true },
            orderBy: { descricao: "asc" }
        });
        return list;
    } catch (error) {
        console.error("[getSecullumJustifications] Erro:", error);
        return [];
    }
}

/**
 * Gera um código curto sequencial e amigável para mensagens de WhatsApp (ex: AJ1042)
 */
export async function generateAdjustmentCode(): Promise<string> {
    const count = await prisma.attendancePunchAdjustment.count();
    let nextNum = 1000 + count + 1;

    // Garantir unicidade avançando a sequência (sem sufixos aleatórios, que quebram o parser do WhatsApp)
    for (let i = 0; i < 500; i++) {
        const code = `AJ${nextNum}`;
        const exists = await prisma.attendancePunchAdjustment.findUnique({ where: { code } });
        if (!exists) return code;
        nextNum++;
    }
    return `AJ${Date.now().toString().slice(-7)}`;
}

/**
 * Cria uma nova solicitação/alerta de inconsistência de batida
 * (Normalmente disparada pelo Nexus Operacional ou pelo cron diário)
 */
export async function createPunchAdjustmentAlert(params: {
    employeeId: string;
    clientId?: string;
    postoId?: string;
    date: Date | string;
    punchType: string; // ENTRADA_1 | SAIDA_1 | ... | lista "ENTRADA_2,SAIDA_2" | SEM_BATIDAS
    expectedTime: string;
    notes?: string;
    whatsappGroupId?: string;
    whatsappMessageId?: string;
    source?: string;
}) {
    try {
        const occDate = typeof params.date === "string" ? new Date(params.date) : params.date;
        const code = await generateAdjustmentCode();

        // 1. Identificar se o contrato tem Gerente de Conta cadastrado
        let accountManagerPhone: string | null = null;
        let clientId = params.clientId;
        let postoId = params.postoId;

        // Se o posto não foi informado, buscar o posto ativo do colaborador na alocação
        if (!postoId) {
            const activeAssignment = await prisma.assignment.findFirst({
                where: { employeeId: params.employeeId, endDate: null },
                orderBy: { startDate: "desc" },
                include: { posto: { include: { client: { include: { accountManager: true } } } } }
            });
            if (activeAssignment?.posto) {
                postoId = activeAssignment.postoId;
                if (!clientId) clientId = activeAssignment.posto.clientId;
                if (!accountManagerPhone) accountManagerPhone = activeAssignment.posto.client?.accountManager?.phone || null;
            }
        }

        if (!clientId && postoId) {
            const posto = await prisma.posto.findUnique({
                where: { id: postoId },
                include: { client: { include: { accountManager: true } } }
            });
            clientId = posto?.clientId;
            if (!accountManagerPhone) accountManagerPhone = posto?.client?.accountManager?.phone || null;
        } else if (clientId && !accountManagerPhone) {
            const client = await prisma.client.findUnique({
                where: { id: clientId },
                include: { accountManager: true }
            });
            accountManagerPhone = client?.accountManager?.phone || null;
        }

        const adjustment = await prisma.attendancePunchAdjustment.create({
            data: {
                code,
                employeeId: params.employeeId,
                clientId,
                postoId,
                date: occDate,
                punchType: params.punchType,
                expectedTime: params.expectedTime,
                requestedTime: params.expectedTime, // Por padrão sugere o horário da escala
                notes: params.notes,
                whatsappGroupId: params.whatsappGroupId,
                whatsappMessageId: params.whatsappMessageId,
                managerMentionedPhone: accountManagerPhone,
                status: "PENDING_RESPONSE",
                source: params.source || "NEXUS_ALERT"
            },
            include: {
                employee: { select: { id: true, name: true, cpf: true } },
                client: { select: { id: true, name: true, accountManager: true } },
                posto: { select: { id: true, role: { select: { name: true } } } }
            }
        });

        return { success: true, adjustment };
    } catch (error: any) {
        console.error("[createPunchAdjustmentAlert] Erro:", error);
        return { success: false, message: error.message };
    }
}

/**
 * Registra a resposta dada pelo Supervisor/Gestor no WhatsApp
 */
export async function processManagerWhatsAppResponse(params: {
    code: string;
    senderPhone: string;
    senderName?: string;
    action: "AJUSTAR" | "FALTA";
    reasonIdOrCode?: string;
    customTime?: string;
}) {
    try {
        const cleanCode = params.code.trim().toUpperCase();
        const adjustment = await prisma.attendancePunchAdjustment.findUnique({
            where: { code: cleanCode },
            include: {
                client: { include: { accountManager: true } },
                employee: true
            }
        });

        if (!adjustment) {
            return { success: false, message: `Código de inconsistência ${cleanCode} não encontrado.` };
        }

        const cleanSenderPhone = params.senderPhone.replace(/\D/g, "").slice(-9);

        // Cruzar telefone do remetente com os usuários do sistema
        const matchingUser = await prisma.user.findFirst({
            where: { phone: { contains: cleanSenderPhone } }
        });

        // Verificar se é o próprio gestor do contrato
        const isAccountManager = Boolean(
            adjustment.client?.accountManager?.phone && 
            adjustment.client.accountManager.phone.replace(/\D/g, "").includes(cleanSenderPhone)
        );

        if (params.action === "FALTA") {
            const updated = await prisma.attendancePunchAdjustment.update({
                where: { id: adjustment.id },
                data: {
                    // Falta confirmada pelo gestor: segue para aprovação do RH, que lança a FALTA no cartão do Secullum
                    status: "PENDING_AUDIT",
                    secullumReasonId: "FALTA",
                    secullumReasonName: "FALTA CONFIRMADA PELO GESTOR",
                    requestedByPhone: params.senderPhone,
                    requestedByName: params.senderName || matchingUser?.name || "Líder WhatsApp",
                    requestedByUserId: matchingUser?.id || null,
                    isAccountManager,
                    notes: `${adjustment.notes || ""} | Falta confirmada pelo supervisor no WhatsApp`.trim(),
                    requestedAt: new Date(),
                    updatedAt: new Date()
                }
            });
            return { success: true, status: "PENDING_AUDIT", adjustment: updated };
        }

        // Caso de Ajuste: Buscar motivo do Secullum
        let reasonName = "ESQUECIMENTO DE MARCAÇÃO";
        let reasonCode = "S/ REG.";

        if (params.reasonIdOrCode) {
            const just = await prisma.secullumJustification.findFirst({
                where: {
                    OR: [
                        { codigo: { equals: params.reasonIdOrCode, mode: "insensitive" } },
                        { descricao: { contains: params.reasonIdOrCode, mode: "insensitive" } }
                    ]
                }
            });
            if (just) {
                reasonName = just.descricao;
                reasonCode = just.codigo || just.descricao;
            }
        }

        const updated = await prisma.attendancePunchAdjustment.update({
            where: { id: adjustment.id },
            data: {
                status: "PENDING_AUDIT",
                requestedTime: params.customTime || adjustment.expectedTime,
                secullumReasonId: reasonCode,
                secullumReasonName: reasonName,
                requestedByPhone: params.senderPhone,
                requestedByName: params.senderName || matchingUser?.name || "Líder WhatsApp",
                requestedByUserId: matchingUser?.id || null,
                isAccountManager,
                requestedAt: new Date(),
                updatedAt: new Date()
            }
        });

        return { success: true, status: "PENDING_AUDIT", adjustment: updated };
    } catch (error: any) {
        console.error("[processManagerWhatsAppResponse] Erro:", error);
        return { success: false, message: error.message };
    }
}

/**
 * Consulta a API do Secullum em tempo real para verificar se o colaborador
 * já possui batidas naquela data (Detecção de Batida Off-line / Sincronizada com atraso)
 */
export async function checkPunchAgainstSecullum(adjustmentId: string) {
    try {
        const user = await getCurrentUser().catch(() => null);
        const adj = await prisma.attendancePunchAdjustment.findUnique({
            where: { id: adjustmentId },
            include: { employee: true }
        });

        if (!adj || !adj.employee.cpf) {
            return { hasPunch: false, message: "Colaborador ou CPF não localizado." };
        }

        const config = await getBenefitsConfig();
        const bankId = config?.secullumCompanyId?.trim();
        const token = config?.secullumApiToken?.trim();
        const apiUrl = config?.secullumApiUrl?.trim();

        if (!bankId || !token) {
            return { hasPunch: false, message: "Secullum não configurado." };
        }

        const client = new SecullumApiClient(token, bankId, apiUrl);
        const { dateStr } = spDateParts(adj.date);
        const cleanCpf = adj.employee.cpf.replace(/\D/g, "");

        // 1. Buscar registro detalhado do cartão ponto do colaborador nesta data
        const registro = await client.getRegistroDoDia(cleanCpf, dateStr).catch(() => null);

        let detectedPunchTimes: string[] = [];

        if (registro) {
            const cols = [
                { key: "Entrada1", label: "E1" },
                { key: "Saida1", label: "S1" },
                { key: "Entrada2", label: "E2" },
                { key: "Saida2", label: "S2" },
                { key: "Entrada3", label: "E3" },
                { key: "Saida3", label: "S3" },
            ];
            for (const col of cols) {
                const val = registro[col.key];
                if (typeof val === "string" && /^\d{1,2}:\d{2}/.test(val.trim())) {
                    detectedPunchTimes.push(`${col.label}: ${val.trim()}`);
                }
            }
        }

        // 2. Se não encontrou no registro, consultar o endpoint Calcular
        if (detectedPunchTimes.length === 0) {
            const calcData = await client.getCalculos(cleanCpf, dateStr, dateStr).catch(() => null);
            if (calcData) {
                if (Array.isArray(calcData.Linhas) && Array.isArray(calcData.Colunas)) {
                    for (const linha of calcData.Linhas) {
                        if (String(linha.Key || "").startsWith(dateStr) && Array.isArray(linha.Value)) {
                            calcData.Colunas.forEach((colName: string, idx: number) => {
                                const val = linha.Value[idx];
                                if (typeof val === "string" && /^\d{1,2}:\d{2}/.test(val.trim())) {
                                    if (/Entrada\s*1/i.test(colName)) detectedPunchTimes.push(`E1: ${val.trim()}`);
                                    else if (/Sa[ií]da\s*1/i.test(colName)) detectedPunchTimes.push(`S1: ${val.trim()}`);
                                    else if (/Entrada\s*2/i.test(colName)) detectedPunchTimes.push(`E2: ${val.trim()}`);
                                    else if (/Sa[ií]da\s*2/i.test(colName)) detectedPunchTimes.push(`S2: ${val.trim()}`);
                                    else if (/Entrada\s*3/i.test(colName)) detectedPunchTimes.push(`E3: ${val.trim()}`);
                                    else if (/Sa[ií]da\s*3/i.test(colName)) detectedPunchTimes.push(`S3: ${val.trim()}`);
                                }
                            });
                        }
                    }
                } else if (Array.isArray(calcData.Dias)) {
                    for (const dia of calcData.Dias) {
                        if (dia.Data && dia.Data.startsWith(dateStr)) {
                            if (dia.Entrada1) detectedPunchTimes.push(`E1: ${dia.Entrada1}`);
                            if (dia.Saida1) detectedPunchTimes.push(`S1: ${dia.Saida1}`);
                            if (dia.Entrada2) detectedPunchTimes.push(`E2: ${dia.Entrada2}`);
                            if (dia.Saida2) detectedPunchTimes.push(`S2: ${dia.Saida2}`);
                        }
                    }
                }
            }
        }

        // Dia incompleto (quantidade ímpar de batidas, ex: E1, S1, E2 sem a saída final): a batida
        // existente não resolve o ajuste, então NÃO descarta.
        const isIncompleteDay = detectedPunchTimes.length % 2 === 1;
        const hasPunch = detectedPunchTimes.length > 0 && !isIncompleteDay;

        let updatedAdj = null;
        if (hasPunch) {
            const punchSummary = detectedPunchTimes.join(" | ");
            updatedAdj = await prisma.attendancePunchAdjustment.update({
                where: { id: adjustmentId },
                data: {
                    status: "DISCARDED_OFFLINE_FOUND",
                    secullumStatus: "SUCESSO",
                    secullumResponseLog: `Batidas detectadas no Secullum: ${punchSummary}`,
                    resolvedByUserId: user?.id || null,
                    resolvedAt: new Date(),
                    notes: adj.notes ? `${adj.notes} | Batidas offline detectadas no Secullum (${punchSummary})` : `Batidas offline detectadas no Secullum (${punchSummary})`,
                    updatedAt: new Date()
                }
            });
            revalidatePath("/admin/punch-adjustments");
            revalidatePath("/admin/operations");
            revalidatePath("/admin/requests");
        }

        return {
            hasPunch,
            punches: detectedPunchTimes,
            message: hasPunch 
                ? `Batida encontrada no Secullum: ${detectedPunchTimes.join(" | ")}`
                : isIncompleteDay
                    ? `Dia incompleto no Secullum (${detectedPunchTimes.join(" | ")}). Ajuste mantido para lançamento.`
                    : "Nenhuma batida registrada no Secullum nesta data.",
            adjustment: updatedAdj
        };
    } catch (error: any) {
        console.error("[checkPunchAgainstSecullum] Erro:", error);
        return { hasPunch: false, error: error.message };
    }
}

/**
 * Aprova a solicitação e injeta o ajuste/justificativa no Secullum
 */
export async function approveAndSyncPunchAdjustment(adjustmentId: string) {
    try {
        const user = await getCurrentUser();
        const adj = await prisma.attendancePunchAdjustment.findUnique({
            where: { id: adjustmentId },
            include: { employee: true, client: true }
        });

        if (!adj || !adj.employee.cpf) {
            return { success: false, message: "Registro ou CPF do colaborador não encontrado." };
        }

        const config = await getBenefitsConfig();
        const bankId = config?.secullumCompanyId?.trim();
        const token = config?.secullumApiToken?.trim();
        const apiUrl = config?.secullumApiUrl?.trim();

        if (!bankId || !token) {
            return { success: false, message: "Credenciais do Secullum não configuradas." };
        }

        const client = new SecullumApiClient(token, bankId, apiUrl);
        const { dateStr, weekday } = spDateParts(adj.date);
        const obs = `Ajuste via Hub por ${adj.requestedByName || "Gestor"} | Conf. RH ${user?.name || "Admin"}`;

        // Abono (não trabalhou) => justificativa no cartão. Demais motivos (trabalhou e não registrou)
        // => incluir a BATIDA no horário cadastrado no Secullum, com variação de minutos.
        const isAbono = (adj.secullumReasonId || "").toUpperCase().includes("ABONO");
        const isFalta = (adj.secullumReasonId || "").toUpperCase() === "FALTA";
        let res: { success: boolean; message: string; raw?: any };
        let insertedTime: string | null = null;

        if (isFalta) {
            // Falta confirmada pelo gestor: lança a justificativa FALTA (sem abonar) nas jornadas sem batida
            const cols = await client.getBatidasColunasDoDia(adj.employee.cpf, dateStr);
            const registro = await client.getRegistroDoDia(adj.employee.cpf, dateStr).catch(() => null);
            const hasG1 = !!(cols.Entrada1 || cols.Saida1);
            const hasG2 = !!(cols.Entrada2 || cols.Saida2);
            const hasG3 = !!(cols.Entrada3 || cols.Saida3);

            const allowedGroups: number[] = [];
            if (!hasG1) allowedGroups.push(1);
            if (!hasG2) allowedGroups.push(2);
            if (!hasG3 && (registro?.MemoriaEntrada3 || registro?.MemoriaSaida3)) allowedGroups.push(3);

            if (allowedGroups.length === 0) {
                const failMsg = "Não é possível lançar a Falta: o colaborador já possui batidas em todas as jornadas deste dia no Secullum.";
                await prisma.attendancePunchAdjustment.update({
                    where: { id: adjustmentId },
                    data: { secullumStatus: "ERRO", secullumResponseLog: failMsg }
                });
                return { success: false, message: failMsg };
            }

            res = await client.lancarJustificativaPonto({
                cpf: adj.employee.cpf,
                data: dateStr,
                justificativa: "FALTA",
                observacoes: `Falta confirmada pelo gestor ${adj.requestedByName || ""} | Conf. RH ${user?.name || "Admin"}`.slice(0, 200),
                abonar: false,
                grupos: allowedGroups
            });
        } else if (isAbono) {
            const registro = await client.getRegistroDoDia(adj.employee.cpf, dateStr).catch(() => null);
            const isTimeVal = (v: any) => typeof v === "string" && /^\d{1,2}:\d{2}/.test(v.trim());
            
            // Grupos que já possuem batidas (originais do relógio ou manuais)
            const hasPunchesG1 = isTimeVal(registro?.Entrada1) || isTimeVal(registro?.Saida1);
            const hasPunchesG2 = isTimeVal(registro?.Entrada2) || isTimeVal(registro?.Saida2);
            const hasPunchesG3 = isTimeVal(registro?.Entrada3) || isTimeVal(registro?.Saida3);

            const allowedGroups: number[] = [];
            if (!hasPunchesG1) allowedGroups.push(1);
            if (!hasPunchesG2) allowedGroups.push(2);
            if (!hasPunchesG3 && (registro?.MemoriaEntrada3 || registro?.MemoriaSaida3)) allowedGroups.push(3);

            if (allowedGroups.length === 0) {
                const failMsg = "Não é possível lançar Abono porque todas as jornadas deste dia já possuem batidas registradas no Secullum (o Secullum proíbe sobrescrever batidas originais com abono). Lance a batida faltante como batida manual.";
                await prisma.attendancePunchAdjustment.update({
                    where: { id: adjustmentId },
                    data: { secullumStatus: "ERRO", secullumResponseLog: failMsg }
                });
                return { success: false, message: failMsg };
            }

            res = await client.lancarJustificativaPonto({
                cpf: adj.employee.cpf,
                data: dateStr,
                justificativa: (adj.secullumReasonId || "ABONO").slice(0, 7),
                observacoes: obs,
                abonar: true,
                grupos: allowedGroups
            });
        } else {
            const fallbackColumn = PUNCH_TYPE_TO_SECULLUM_COLUMN[adj.punchType] || null;
            const fail = async (msg: string) => {
                await prisma.attendancePunchAdjustment.update({
                    where: { id: adjustmentId },
                    data: { secullumStatus: "ERRO", secullumResponseLog: msg }
                });
                return { success: false, message: msg };
            };

            // Horário previsto do dia: primeiro o do próprio cartão (Memoria*), depois o Horário cadastrado
            const registro = await client.getRegistroDoDia(adj.employee.cpf, dateStr).catch(() => null);
            const memoriaDia = expectedScheduleFromBatida(registro);
            const horario = Object.keys(memoriaDia).length ? null : await client.getHorarioDoFuncionario(adj.employee.cpf);
            const dia: Record<string, any> | undefined = Object.keys(memoriaDia).length
                ? memoriaDia
                : horario?.dias.find(d => d.DiaSemana === weekday);
            // Horários informados na solicitação (ex: "Entrada 2 13:35"), usados como fallback quando o
            // Secullum não expõe o horário previsto do dia (ex: horário sem Dias detalhados).
            const requestedByColumn: Record<string, string> = {};
            const reqRe = /(Entrada|Sa[ií]da)\s*([123])\s+(\d{1,2}:\d{2})/gi;
            let reqMatch: RegExpExecArray | null;
            const reqText = adj.requestedTime || adj.expectedTime || "";
            while ((reqMatch = reqRe.exec(reqText)) !== null) {
                const col = `${/^entrada/i.test(reqMatch[1]) ? "Entrada" : "Saida"}${reqMatch[2]}`;
                requestedByColumn[col] = reqMatch[3].padStart(5, "0");
            }
            const hasRequested = Object.keys(requestedByColumn).length > 0;
            if (!dia && !hasRequested) return fail("Não foi possível ler o horário previsto do colaborador no Secullum.");

            // Batidas já existentes no dia (não sobrescrever)
            const existing: Record<string, string | null> = {};
            for (const c of ["Entrada1", "Saida1", "Entrada2", "Saida2", "Entrada3", "Saida3"]) {
                const v = registro?.[c];
                existing[c] = typeof v === "string" && v.trim() ? v.trim() : null;
            }
            if (!registro) {
                try {
                    const calc = await client.getCalculos(adj.employee.cpf.replace(/\D/g, ""), dateStr, dateStr);
                    if (Array.isArray(calc?.Linhas) && Array.isArray(calc?.Colunas)) {
                        for (const linha of calc.Linhas) {
                            if (String(linha.Key || "").startsWith(dateStr) && Array.isArray(linha.Value)) {
                                calc.Colunas.forEach((colName: string, idx: number) => {
                                    const val = linha.Value[idx];
                                    if (typeof val === "string" && /^\d{1,2}:\d{2}/.test(val.trim())) {
                                        if (/Entrada\s*1/i.test(colName)) existing["Entrada1"] = val.trim();
                                        else if (/Sa[ií]da\s*1/i.test(colName)) existing["Saida1"] = val.trim();
                                        else if (/Entrada\s*2/i.test(colName)) existing["Entrada2"] = val.trim();
                                        else if (/Sa[ií]da\s*2/i.test(colName)) existing["Saida2"] = val.trim();
                                        else if (/Entrada\s*3/i.test(colName)) existing["Entrada3"] = val.trim();
                                        else if (/Sa[ií]da\s*3/i.test(colName)) existing["Saida3"] = val.trim();
                                    }
                                });
                            }
                        }
                    } else if (Array.isArray(calc?.Dias)) {
                        const d = calc.Dias.find((x: any) => String(x.Data || "").startsWith(dateStr));
                        for (const c of Object.keys(existing)) {
                            const v = d?.[c];
                            existing[c] = typeof v === "string" && /^\d{1,2}:\d{2}/.test(v) ? v : null;
                        }
                    }
                } catch (e) {
                    console.warn("[approve] Não foi possível ler batidas existentes:", e);
                }
            }

            // Batida deslocada: colaborador não bateu o retorno do intervalo e o Secullum colocou a
            // saída em Entrada2 (E1, S1, E2 preenchidos e S2 vazio). Move a saída para Saida2 e libera
            // Entrada2 para o ajuste lançar o retorno do intervalo.
            const needsReturn = adj.punchScope === "INTERVALO" || adj.punchScope === "TODOS" || fallbackColumn === "Entrada2";
            if (needsReturn && existing["Entrada1"] && existing["Saida1"] && existing["Entrada2"] && !existing["Saida2"]) {
                const swap = await client.trocarColunaBatida({
                    cpf: adj.employee.cpf,
                    data: dateStr,
                    colunaOrigem: "Entrada2",
                    colunaDestino: "Saida2"
                });
                if (!swap.success) {
                    return fail(`Batida de saída está em Entrada2 e não foi possível movê-la para Saída 2: ${swap.message}`);
                }
                existing["Saida2"] = existing["Entrada2"];
                existing["Entrada2"] = null;
            }

            let plan = planPunches({ scheduleDay: dia, scope: adj.punchScope, fallbackColumn, existing });
            if ((!dia || plan.error) && hasRequested) {
                const cols = Object.keys(requestedByColumn);
                plan = {
                    punches: cols
                        .filter(c => !existing[c])
                        .map(c => ({ coluna: c, hora: requestedByColumn[c], previsto: requestedByColumn[c] })),
                    skipped: cols.filter(c => !!existing[c])
                };
            }
            if (plan.error) return fail(`${plan.error}${horario ? ` (horário "${horario.descricao}")` : ""}`);
            
            if (plan.punches.length === 0) {
                // Se todas as marcações já existem no cartão ponto do Secullum, finalizar como SUCESSO!
                if (plan.skipped.length > 0) {
                    const existingDetails = plan.skipped
                        .map(c => `${c.replace("Entrada", "E").replace("Saida", "S")}: ${existing[c] || "OK"}`)
                        .join(" | ");
                    const successMsg = `Marcações já constavam no cartão ponto do Secullum (${existingDetails}).`;

                    const updated = await prisma.attendancePunchAdjustment.update({
                        where: { id: adjustmentId },
                        data: {
                            status: "APPROVED_SYNCED",
                            resolvedByUserId: user?.id || null,
                            resolvedAt: new Date(),
                            secullumStatus: "SUCESSO",
                            secullumResponseLog: JSON.stringify({ message: successMsg, existing: existingDetails }),
                            updatedAt: new Date()
                        }
                    });

                    revalidatePath("/admin/punch-adjustments");
                    revalidatePath("/admin/operations");
                    revalidatePath("/admin/requests");

                    return {
                        success: true,
                        message: `Marcações já identificadas no Secullum (${existingDetails}). Ajuste finalizado com sucesso!`,
                        adjustment: updated
                    };
                }

                return fail(`Nada a lançar: nenhuma marcação aplicável para esta data.`);
            }

            const done: string[] = [];
            const errors: string[] = [];
            for (const p of plan.punches) {
                const r = await client.lancarBatidaManual({
                    cpf: adj.employee.cpf,
                    data: dateStr,
                    hora: p.hora,
                    coluna: p.coluna,
                    motivo: `${adj.secullumReasonName || "Ajuste de ponto"} | ${obs}`
                });
                if (r.success) done.push(`${p.coluna} ${p.hora} (prev. ${p.previsto})`);
                else errors.push(`${p.coluna}: ${r.message}`);
            }

            insertedTime = plan.punches
                .filter(p => done.some(d => d.startsWith(`${p.coluna} `)))
                .map(p => `${p.coluna.replace("Entrada", "E").replace("Saida", "S")} ${p.hora}`)
                .join(" | ") || null;

            const skippedTxt = plan.skipped.length ? ` Já existiam: ${plan.skipped.join(", ")}.` : "";
            if (errors.length && !done.length) {
                res = { success: false, message: errors.join(" ; ") };
            } else if (errors.length) {
                // Parcial: registra como erro para o RH revisar, mas informa o que entrou
                res = { success: false, message: `Parcial — incluídas: ${done.join(", ")}. Falharam: ${errors.join(" ; ")}` };
            } else {
                res = { success: true, message: `Incluídas: ${done.join(", ")}.${skippedTxt}` };
            }
        }

        if (!res.success) {
            await prisma.attendancePunchAdjustment.update({
                where: { id: adjustmentId },
                data: {
                    secullumStatus: "ERRO",
                    secullumResponseLog: res.message
                }
            });
            return { success: false, message: `Erro ao enviar para Secullum: ${res.message}` };
        }

        // Atualizar status no Hub
        const updated = await prisma.attendancePunchAdjustment.update({
            where: { id: adjustmentId },
            data: {
                status: "APPROVED_SYNCED",
                resolvedByUserId: user?.id || null,
                resolvedAt: new Date(),
                secullumStatus: "SUCESSO",
                ...(insertedTime ? { requestedTime: insertedTime } : {}),
                secullumResponseLog: JSON.stringify({ message: res.message, raw: res.raw ?? null })
            }
        });

        revalidatePath("/admin/operations");
        revalidatePath("/admin/requests");

        return { success: true, message: res.message || "Ponto ajustado e gravado no Secullum com sucesso!", adjustment: updated };
    } catch (error: any) {
        console.error("[approveAndSyncPunchAdjustment] Erro:", error);
        return { success: false, message: error.message };
    }
}

/**
 * Descarta a solicitação (ex: quando a batida offline já subiu ou foi rejeitada pelo RH)
 */
export async function discardPunchAdjustment(adjustmentId: string, reason: string) {
    try {
        const user = await getCurrentUser();
        const updated = await prisma.attendancePunchAdjustment.update({
            where: { id: adjustmentId },
            data: {
                status: reason === "OFFLINE_FOUND" ? "DISCARDED_OFFLINE_FOUND" : "REJECTED",
                resolvedByUserId: user?.id || null,
                resolvedAt: new Date(),
                notes: reason,
                updatedAt: new Date()
            }
        });

        revalidatePath("/admin/operations");
        revalidatePath("/admin/requests");

        return { success: true, adjustment: updated };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * Exclui definitivamente uma ocorrência de ajuste de ponto
 */
export async function deletePunchAdjustment(adjustmentId: string) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return { success: false, message: "Usuário não autenticado." };
        }
        await prisma.attendancePunchAdjustment.delete({ where: { id: adjustmentId } });

        revalidatePath("/admin/punch-adjustments");
        revalidatePath("/admin/operations");
        revalidatePath("/admin/requests");

        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * Busca inconsistências pendentes de dias anteriores para o Lembrete Matinal (D+1)
 */
export async function getPendingAdjustmentsForD1() {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);

        // Busca registros pendentes de resposta das últimas 48 horas
        const pendings = await prisma.attendancePunchAdjustment.findMany({
            where: {
                status: "PENDING_RESPONSE",
                date: { lte: endOfYesterday }
            },
            include: {
                employee: { select: { name: true } },
                client: {
                    select: {
                        name: true,
                        accountManager: { select: { id: true, name: true, phone: true } }
                    }
                },
                posto: { select: { id: true, role: { select: { name: true } } } }
            },
            orderBy: [{ clientId: "asc" }, { date: "asc" }]
        });

        return pendings;
    } catch (error) {
        console.error("[getPendingAdjustmentsForD1] Erro:", error);
        return [];
    }
}

/**
 * Server Action para disparar alerta via WhatsApp sem vazar Prisma para o bundle cliente
 */
export async function sendPunchAdjustmentAlertAction(adjustmentId: string, targetGroup?: string) {
    const { sendPunchAdjustmentWhatsAppAlert } = await import("@/lib/punch-whatsapp");
    return await sendPunchAdjustmentWhatsAppAlert(adjustmentId, targetGroup);
}
