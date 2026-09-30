import { prisma } from "@/lib/db";
import { processManagerWhatsAppResponse } from "@/actions/punch-adjustments";

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID || "3F1993DFB59E83474F059E648AE68DF9";
const ZAPI_TOKEN = process.env.ZAPI_TOKEN || "81087A6B5C1CAB8AAAC801C4";
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || "F5c1b8f27f6b049c98c4e779d00f67552S";

// Grupo padrão da Mesa de Operações (ou substituído pelo grupo de teste)
export const DEFAULT_OPERATIONS_GROUP = "120363425022319430";

/**
 * Envia uma mensagem para o WhatsApp com suporte opcional a @Menção de participantes
 */
export async function sendZapiWithMentions(params: {
    target: string;
    message: string;
    mentionedPhones?: string[];
}): Promise<{ success: boolean; zapiId?: string; error?: string }> {
    try {
        if (!params.target) return { success: false, error: "Destinatário vazio" };

        let finalPhone = params.target.trim();
        if (!finalPhone.includes("@") && !finalPhone.includes("-group")) {
            const clean = finalPhone.replace(/\D/g, "");
            finalPhone = clean.startsWith("55") ? clean : `55${clean}`;
        }

        const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
        const payload: Record<string, any> = {
            phone: finalPhone,
            message: params.message
        };

        if (params.mentionedPhones && params.mentionedPhones.length > 0) {
            // Z-API espera telefones limpos com código de país (ex: 5511999998888)
            payload.mentionedPhones = params.mentionedPhones.map(p => {
                const clean = p.replace(/\D/g, "");
                return clean.startsWith("55") ? clean : `55${clean}`;
            });
        }

        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Client-Token": ZAPI_CLIENT_TOKEN
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`[Z-API Error] Target ${finalPhone}:`, errorText);
            return { success: false, error: errorText };
        }

        const data = await res.json();
        return { success: true, zapiId: data.zapiId || data.id };
    } catch (err: any) {
        console.error("[sendZapiWithMentions] Erro:", err);
        return { success: false, error: err.message || "Erro desconhecido ao enviar Z-API" };
    }
}

/**
 * Formata e dispara o alerta de inconsistência no grupo do WhatsApp com a @menção do gestor
 */
export async function sendPunchAdjustmentWhatsAppAlert(
    adjustmentId: string,
    targetGroupOverride?: string
): Promise<{ success: boolean; message?: string }> {
    try {
        const adj = await prisma.attendancePunchAdjustment.findUnique({
            where: { id: adjustmentId },
            include: {
                employee: true,
                client: { include: { accountManager: true } },
                posto: true
            }
        });

        if (!adj) {
            return { success: false, message: "Ajuste não encontrado." };
        }

        const targetGroup = targetGroupOverride || adj.whatsappGroupId || DEFAULT_OPERATIONS_GROUP;

        // 1. Identificar o gestor da conta e preparar menção
        const manager = adj.client?.accountManager;
        let mentionTag = "";
        let mentionedPhones: string[] = [];

        if (manager?.phone) {
            const cleanPhone = manager.phone.replace(/\D/g, "");
            const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
            mentionedPhones.push(fullPhone);
            mentionTag = `@${fullPhone}`;
        }

        // 2. Buscar lista de justificativas ativas
        const justifications = await prisma.secullumJustification.findMany({
            where: { isActive: true },
            orderBy: { descricao: "asc" }
        });

        // Montar menu numerado das justificativas
        const justListText = justifications.length > 0
            ? justifications.map((j, idx) => `  *${idx + 1}* - ${j.descricao}`).join("\n")
            : "  *1* - SEM REGISTRO DE PONTO (Esquecimento)\n  *2* - PROBLEMA TÉCNICO NO RELÓGIO";

        // Formatar tipo da batida
        const tipoMap: Record<string, string> = {
            "ENTRADA_1": "Entrada 1",
            "SAIDA_1": "Saída Almoço",
            "ENTRADA_2": "Retorno Almoço",
            "SAIDA_2": "Saída Final"
        };
        const tipoText = tipoMap[adj.punchType] || adj.punchType;
        const dataFormatada = adj.date.toLocaleDateString("pt-BR");

        // 3. Montar texto da mensagem
        const headerAlert = `🚨 *INCONSISTÊNCIA DE PONTO — #${adj.code}*`;
        const colabInfo = `👤 *Colaborador:* ${adj.employee.name}\n🏢 *Contrato:* ${adj.client?.name || "Geral"}\n📍 *Posto:* ${adj.posto?.name || "Não informado"}\n📅 *Data:* ${dataFormatada} | *Marcação:* ${tipoText}\n⏰ *Horário Previsto:* ${adj.expectedTime}`;

        const managerCallout = mentionTag
            ? `\n👉 Atenção ${mentionTag} (Gestor do Contrato): favor definir a tratativa:`
            : `\n👉 Líderes da operação, favor definir a tratativa:`;

        const actionInstructions = `\n📋 *Motivos disponíveis no Secullum:*\n${justListText}\n\n━━━━━━━━━━━━━━━━━━━━\n👉 *Para ajustar horário padrão (${adj.expectedTime}):*\nResponda: *#${adj.code} [número]* (ex: *#${adj.code} 1*)\n\n👉 *Se o colaborador faltou:*\nResponda: *#${adj.code} falta*`;

        const fullMessage = `${headerAlert}\n\n${colabInfo}${managerCallout}\n${actionInstructions}`;

        const sendRes = await sendZapiWithMentions({
            target: targetGroup,
            message: fullMessage,
            mentionedPhones
        });

        if (sendRes.success) {
            await prisma.attendancePunchAdjustment.update({
                where: { id: adjustmentId },
                data: {
                    whatsappGroupId: targetGroup,
                    whatsappMessageId: sendRes.zapiId,
                    managerMentionedPhone: mentionedPhones[0] || null
                }
            });
        }

        return sendRes;
    } catch (error: any) {
        console.error("[sendPunchAdjustmentWhatsAppAlert] Erro:", error);
        return { success: false, message: error.message };
    }
}

/**
 * Analisa uma mensagem de WhatsApp recebida para verificar se é uma resposta a um alerta de ajuste
 * Formatos suportados:
 * - `#AJ1042 1` (Ajustar com motivo índice 1)
 * - `#AJ1042 21` (Ajustar com código oficial)
 * - `#AJ1042 falta` (Marcar falta confirmada)
 */
export async function tryParsePunchAdjustmentReply(params: {
    messageText: string;
    senderPhone: string;
    senderName?: string;
    groupPhone?: string;
}): Promise<{ handled: boolean; replyText?: string }> {
    const text = (params.messageText || "").trim();
    if (!text.includes("#AJ") && !text.includes("#aj")) {
        return { handled: false };
    }

    // Regex para capturar: #AJ1042 [comando/número]
    const match = text.match(/#(AJ\d+(?:_\d+)?)\s*(.*)/i);
    if (!match) {
        return { handled: false };
    }

    const code = match[1].toUpperCase();
    const rawArg = match[2].trim().toLowerCase();

    // 1. Caso de Falta
    if (rawArg === "falta" || rawArg === "ausente" || rawArg === "faltou") {
        const res = await processManagerWhatsAppResponse({
            code,
            senderPhone: params.senderPhone,
            senderName: params.senderName,
            action: "FALTA"
        });

        if (!res.success) {
            return {
                handled: true,
                replyText: `❌ Não foi possível registrar a falta para #${code}: ${res.message}`
            };
        }

        const empName = res.adjustment?.employeeId ? "o colaborador" : "o registro";
        return {
            handled: true,
            replyText: `✅ *Falta confirmada para #${code}!* Registrado por ${params.senderName || "Líder"}.`
        };
    }

    // 2. Caso de Ajuste com Motivo
    // Se digitou número (ex: 1, 2, 3), mapear para o índice das justificativas
    let selectedReasonName: string | undefined;
    let selectedReasonCode: string | undefined;

    const numIndex = parseInt(rawArg, 10);
    if (!isNaN(numIndex) && numIndex > 0) {
        const justs = await prisma.secullumJustification.findMany({
            where: { isActive: true },
            orderBy: { descricao: "asc" }
        });
        if (numIndex <= justs.length) {
            const targetJust = justs[numIndex - 1];
            selectedReasonName = targetJust.descricao;
            selectedReasonCode = targetJust.codigo || targetJust.descricao;
        }
    } else if (rawArg) {
        // Digitou parte do nome (ex: #AJ1042 esquecimento)
        const just = await prisma.secullumJustification.findFirst({
            where: {
                OR: [
                    { descricao: { contains: rawArg, mode: "insensitive" } },
                    { codigo: { contains: rawArg, mode: "insensitive" } }
                ]
            }
        });
        if (just) {
            selectedReasonName = just.descricao;
            selectedReasonCode = just.codigo || just.descricao;
        }
    }

    const res = await processManagerWhatsAppResponse({
        code,
        senderPhone: params.senderPhone,
        senderName: params.senderName,
        action: "AJUSTAR",
        reasonIdOrCode: selectedReasonCode || selectedReasonName || "S/ REG."
    });

    if (!res.success) {
        return {
            handled: true,
            replyText: `❌ Não foi possível processar o ajuste para #${code}: ${res.message}`
        };
    }

    const cleanSender = params.senderPhone.replace(/\D/g, "");
    const mentionTag = `@${cleanSender.startsWith("55") ? cleanSender : `55${cleanSender}`}`;

    const replyMsg = `✅ *Solicitação de Ajuste #${code} Registrada!*\n` +
        `👤 *Motivo:* ${selectedReasonName || "Sem Registro de Ponto"}\n` +
        `⏰ *Horário:* ${res.adjustment?.requestedTime || "Escala Padrão"}\n` +
        `Solicitado por: ${mentionTag}\n` +
        `👉 Encaminhado para auditoria e injeção no Secullum pelo RH.`;

    return {
        handled: true,
        replyText: replyMsg
    };
}
