"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getBenefitsConfig } from "@/actions/benefits";
import { SecullumApiClient } from "@/lib/secullum";
import { getCurrentUser } from "@/lib/auth";

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
async function generateAdjustmentCode(): Promise<string> {
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
    punchType: "ENTRADA_1" | "SAIDA_1" | "ENTRADA_2" | "SAIDA_2";
    expectedTime: string;
    notes?: string;
    whatsappGroupId?: string;
    whatsappMessageId?: string;
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
                source: "NEXUS_ALERT"
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
                    status: "CONFIRMED_ABSENCE",
                    requestedByPhone: params.senderPhone,
                    requestedByName: params.senderName || matchingUser?.name || "Líder WhatsApp",
                    requestedByUserId: matchingUser?.id || null,
                    isAccountManager,
                    notes: `${adjustment.notes || ""} | Falta confirmada pelo supervisor no WhatsApp`.trim(),
                    requestedAt: new Date(),
                    updatedAt: new Date()
                }
            });
            return { success: true, status: "CONFIRMED_ABSENCE", adjustment: updated };
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
        const dateStr = adj.date.toISOString().split("T")[0];

        const batidas = await client.getBatidas(dateStr, dateStr);
        const cleanCpf = adj.employee.cpf.replace(/\D/g, "");

        const empBatidas = batidas.filter(b => {
            const bCpf = b.Funcionario?.NumeroPis || ""; // fallback ou CPF se vier
            return b.FuncionarioId && (b.Entrada1 || b.Saida1 || b.Entrada2 || b.Saida2);
        });

        // Também buscar cálculos do dia específico para o CPF
        const calcData = await client.getCalculos(cleanCpf, dateStr, dateStr);

        let detectedPunchTimes: string[] = [];
        if (calcData && Array.isArray(calcData.Dias)) {
            for (const dia of calcData.Dias) {
                if (dia.Data && dia.Data.startsWith(dateStr)) {
                    if (dia.Entrada1) detectedPunchTimes.push(`E1: ${dia.Entrada1}`);
                    if (dia.Saida1) detectedPunchTimes.push(`S1: ${dia.Saida1}`);
                    if (dia.Entrada2) detectedPunchTimes.push(`E2: ${dia.Entrada2}`);
                    if (dia.Saida2) detectedPunchTimes.push(`S2: ${dia.Saida2}`);
                }
            }
        }

        const hasPunch = detectedPunchTimes.length > 0;

        return {
            hasPunch,
            punches: detectedPunchTimes,
            message: hasPunch 
                ? `Batida encontrada no Secullum: ${detectedPunchTimes.join(" | ")}`
                : "Nenhuma batida registrada no Secullum nesta data."
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
        const dateStr = adj.date.toISOString().split("T")[0];

        // Lança a justificativa / abono no cartão de ponto do Secullum
        const justCode = (adj.secullumReasonId || "S/ REG.").slice(0, 7);
        const obs = `Ajuste via Hub por ${adj.requestedByName || "Gestor"} | Conf. RH ${user?.name || "Admin"}`;

        const res = await client.lancarJustificativaPonto({
            cpf: adj.employee.cpf,
            data: dateStr,
            justificativa: justCode,
            observacoes: obs,
            abonar: true
        });

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
                secullumResponseLog: JSON.stringify(res.raw || res.message)
            }
        });

        revalidatePath("/admin/operations");
        revalidatePath("/admin/requests");

        return { success: true, message: "Ponto ajustado e gravado no Secullum com sucesso!", adjustment: updated };
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
