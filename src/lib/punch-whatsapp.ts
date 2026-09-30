import { prisma } from "@/lib/db";
import { processManagerWhatsAppResponse } from "@/actions/punch-adjustments";

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID || "3F1993DFB59E83474F059E648AE68DF9";
const ZAPI_TOKEN = process.env.ZAPI_TOKEN || "81087A6B5C1CAB8AAAC801C4";
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || "F5c1b8f27f6b049c98c4e779d00f67552S";

export const DEFAULT_OPERATIONS_GROUP = "120363425022319430";

function normalizePhone(target: string): string {
    let finalPhone = target.trim();
    if (finalPhone.includes("@g.us") || finalPhone.includes("-group") || finalPhone.startsWith("120363")) {
        // Garantir formato aceito pela Z-API para grupos
        if (finalPhone.startsWith("120363") && !finalPhone.includes("@") && !finalPhone.includes("-group")) {
            return `${finalPhone}-group`;
        }
        return finalPhone;
    }
    if (!finalPhone.includes("@")) {
        const clean = finalPhone.replace(/\D/g, "");
        finalPhone = clean.startsWith("55") ? clean : `55${clean}`;
    }
    return finalPhone;
}

/**
 * Envia uma mensagem para o WhatsApp com suporte a @Menção de participantes
 */
export async function sendZapiWithMentions(params: {
    target: string;
    message: string;
    mentionedPhones?: string[];
}): Promise<{ success: boolean; zapiId?: string; error?: string }> {
    try {
        if (!params.target) return { success: false, error: "Destinatário vazio" };
        const finalPhone = normalizePhone(params.target);

        const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
        const payload: Record<string, any> = {
            phone: finalPhone,
            message: params.message
        };

        if (params.mentionedPhones && params.mentionedPhones.length > 0) {
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
 * Envia mensagem com BOTÕES CLICÁVEIS (send-button-list)
 */
export async function sendZapiButtonList(params: {
    target: string;
    message: string;
    buttons: Array<{ id: string; label: string }>;
}): Promise<{ success: boolean; zapiId?: string; error?: string }> {
    try {
        if (!params.target) return { success: false, error: "Destinatário vazio" };
        const finalPhone = normalizePhone(params.target);

        const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-button-list`;
        const payload = {
            phone: finalPhone,
            message: params.message,
            buttonList: {
                buttons: params.buttons
            }
        };

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
            console.warn(`[Z-API send-button-list Warning] Fallback text:`, errorText);
            // Fallback para mensagem de texto caso botões não sejam aceitos
            return sendZapiWithMentions({
                target: params.target,
                message: `${params.message}\n\n👉 Responda:\n${params.buttons.map(b => `• *${b.label}* (digite: ${b.id})`).join("\n")}`
            });
        }

        const data = await res.json();
        return { success: true, zapiId: data.messageId || data.id || data.zaapId };
    } catch (err: any) {
        console.error("[sendZapiButtonList] Erro:", err);
        return { success: false, error: err.message };
    }
}

/**
 * Envia MENU DE LISTA INTERATIVA CLICÁVEL (send-option-list)
 */
export async function sendZapiOptionList(params: {
    target: string;
    message: string;
    title: string;
    buttonLabel: string;
    options: Array<{ id: string; title: string; description?: string }>;
}): Promise<{ success: boolean; zapiId?: string; error?: string }> {
    try {
        if (!params.target) return { success: false, error: "Destinatário vazio" };
        const finalPhone = normalizePhone(params.target);

        const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-option-list`;
        const payload = {
            phone: finalPhone,
            message: params.message,
            optionList: {
                title: params.title.slice(0, 50),
                buttonLabel: params.buttonLabel.slice(0, 20),
                options: params.options.slice(0, 10).map(opt => ({
                    id: opt.id,
                    title: opt.title.slice(0, 100),
                    description: (opt.description || "").slice(0, 100)
                }))
            }
        };

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
            console.warn(`[Z-API send-option-list Warning] Fallback text:`, errorText);
            return sendZapiWithMentions({
                target: params.target,
                message: `${params.message}\n\n${params.options.map((o, idx) => `${idx + 1} - ${o.title}`).join("\n")}`
            });
        }

        const data = await res.json();
        return { success: true, zapiId: data.messageId || data.id || data.zaapId };
    } catch (err: any) {
        console.error("[sendZapiOptionList] Erro:", err);
        return { success: false, error: err.message };
    }
}

/**
 * ETAPA 1: Dispara o alerta inicial no WhatsApp com 2 BOTÕES CLICÁVEIS:
 * [✅ Ajustar Ponto] | [❌ Confirmar Falta]
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
                posto: { include: { role: true } }
            }
        });

        if (!adj) {
            return { success: false, message: "Ajuste não encontrado." };
        }

        const targetGroup = targetGroupOverride || adj.whatsappGroupId || DEFAULT_OPERATIONS_GROUP;

        // Identificar o gestor da conta e preparar menção
        const manager = adj.client?.accountManager;
        let mentionTag = "";
        let mentionedPhones: string[] = [];

        if (manager?.phone) {
            const cleanPhone = manager.phone.replace(/\D/g, "");
            const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
            mentionedPhones.push(fullPhone);
            mentionTag = `@${fullPhone}`;
        }

        const tipoMap: Record<string, string> = {
            "ENTRADA_1": "Entrada 1",
            "SAIDA_1": "Saída Almoço",
            "ENTRADA_2": "Retorno Almoço",
            "SAIDA_2": "Saída Final"
        };
        const tipoText = tipoMap[adj.punchType] || adj.punchType;
        const dataFormatada = adj.date.toLocaleDateString("pt-BR");

        // Texto limpo e direto (sem a lista de 24 motivos poluindo a tela)
        const headerAlert = `🚨 *INCONSISTÊNCIA DE PONTO — #${adj.code}*`;
        const colabInfo = `👤 *Colaborador:* ${adj.employee.name}\n🏢 *Contrato:* ${adj.client?.name || "Geral"}\n📍 *Posto:* ${adj.posto?.role?.name || "Não informado"}\n📅 *Data:* ${dataFormatada} | *Marcação:* ${tipoText}\n⏰ *Horário Previsto:* ${adj.expectedTime}`;

        const managerCallout = mentionTag
            ? `\n👉 Atenção ${mentionTag} (Gestor do Contrato):`
            : `\n👉 Líderes da operação:`;

        const instructionText = `\n_Clique em um dos botões abaixo para definir a tratativa:_`;

        const fullMessage = `${headerAlert}\n\n${colabInfo}${managerCallout}${instructionText}`;

        // Dispara com BOTÕES CLICÁVEIS
        const sendRes = await sendZapiButtonList({
            target: targetGroup,
            message: fullMessage,
            buttons: [
                { id: `#${adj.code}_ajustar`, label: "✅ Ajustar Ponto" },
                { id: `#${adj.code}_falta`, label: "❌ Confirmar Falta" }
            ]
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
 * ETAPA 2: Dispara o MENU CLICÁVEL de Motivos do Secullum
 * (Acionado quando o gestor clica no botão "✅ Ajustar Ponto")
 */
export async function sendReasonsOptionList(params: {
    code: string;
    groupPhone: string;
    employeeName: string;
    expectedTime: string;
}) {
    const rawJusts = await prisma.secullumJustification.findMany({
        where: { isActive: true },
        orderBy: { descricao: "asc" }
    });

    // Ordenar para garantir os motivos operacionais mais usados no topo (máximo 10 no menu WhatsApp)
    const priorityKeywords = ["REGISTRO", "ESQUECIMENTO", "RELÓGIO", "REP", "TROCA", "DECLAR", "INTEGR", "VIAGEM", "FOLGA", "ABONO"];
    const sortedJusts = [...rawJusts].sort((a, b) => {
        const aDesc = a.descricao.toUpperCase();
        const bDesc = b.descricao.toUpperCase();
        const aPri = priorityKeywords.findIndex(k => aDesc.includes(k));
        const bPri = priorityKeywords.findIndex(k => bDesc.includes(k));
        if (aPri !== -1 && bPri === -1) return -1;
        if (bPri !== -1 && aPri === -1) return 1;
        if (aPri !== -1 && bPri !== -1) return aPri - bPri;
        return aDesc.localeCompare(bDesc);
    });

    const topOptions = sortedJusts.slice(0, 10).map(j => ({
        id: `#${params.code}_MOT_${j.id}`,
        title: j.descricao.slice(0, 24),
        description: `Motivo Secullum (${j.codigo || "Oficial"})`
    }));

    return sendZapiOptionList({
        target: params.groupPhone,
        message: `📋 *Ajuste #${params.code} — Horário: ${params.expectedTime}*\n_Colaborador: ${params.employeeName}_\n\nToque no botão abaixo para escolher o motivo oficial do ponto:`,
        title: "Motivos de Ponto Secullum",
        buttonLabel: "Escolher Motivo 👇",
        options: topOptions
    });
}

/**
 * PARSER DO WEBHOOK: Processa cliques nos Botões e seleções no Menu de Opções
 */
export async function tryParsePunchAdjustmentReply(params: {
    messageText: string;
    senderPhone: string;
    senderName?: string;
    groupPhone?: string;
}): Promise<{ handled: boolean; replyText?: string }> {
    const text = (params.messageText || "").trim();

    // 1. Verificar se a mensagem contém referência ao código #AJ...
    const codeMatch = text.match(/#(AJ\d+(?:_\d+)?)/i);
    if (!codeMatch) {
        return { handled: false };
    }

    const code = codeMatch[1].toUpperCase();

    // Buscar o registro no banco
    const adjustment = await prisma.attendancePunchAdjustment.findUnique({
        where: { code },
        include: {
            employee: true,
            client: { include: { accountManager: true } }
        }
    });

    if (!adjustment) {
        return { handled: false };
    }

    // A. CLIQUE NO BOTÃO: "Confirmar Falta" (#AJ1001_falta ou texto "Confirmar Falta")
    if (text.includes("_falta") || text.toLowerCase().includes("confirmar falta") || text.toLowerCase().includes("falta")) {
        const res = await processManagerWhatsAppResponse({
            code,
            senderPhone: params.senderPhone,
            senderName: params.senderName,
            action: "FALTA"
        });

        const cleanSender = params.senderPhone.replace(/\D/g, "");
        const mentionTag = `@${cleanSender.startsWith("55") ? cleanSender : `55${cleanSender}`}`;

        return {
            handled: true,
            replyText: `❌ *Falta confirmada para #${code}!* (${adjustment.employee.name})\nRegistrado por: ${mentionTag}. O RH foi notificado.`
        };
    }

    // B. CLIQUE NO BOTÃO: "Ajustar Ponto" (#AJ1001_ajustar ou texto "Ajustar Ponto")
    // Dispara a ETAPA 2: Menu Interativo de Motivos Clicável!
    if (text.includes("_ajustar") || text.toLowerCase().includes("ajustar ponto") || text.toLowerCase().endsWith("ajustar")) {
        if (params.groupPhone) {
            await sendReasonsOptionList({
                code,
                groupPhone: params.groupPhone,
                employeeName: adjustment.employee.name,
                expectedTime: adjustment.expectedTime
            });
        }
        return {
            handled: true,
            replyText: undefined // A própria sendReasonsOptionList já enviou o menu interativo
        };
    }

    // C. CLIQUE NO MENU DE MOTIVOS: (#AJ1001_MOT_uuid ou seleção de um motivo)
    if (text.includes("_MOT_")) {
        const motIdMatch = text.match(/_MOT_([a-zA-Z0-9_-]+)/);
        const justificationId = motIdMatch ? motIdMatch[1] : undefined;

        let selectedReasonName = "SEM REGISTRO DE PONTO";
        let selectedReasonCode = "S/ REG.";

        if (justificationId) {
            const just = await prisma.secullumJustification.findUnique({
                where: { id: justificationId }
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
            reasonIdOrCode: selectedReasonCode || selectedReasonName
        });

        const cleanSender = params.senderPhone.replace(/\D/g, "");
        const mentionTag = `@${cleanSender.startsWith("55") ? cleanSender : `55${cleanSender}`}`;

        const replyMsg = `✅ *Ajuste #${code} Solicitado com Sucesso!*\n\n` +
            `👤 *Colaborador:* ${adjustment.employee.name}\n` +
            `⏰ *Horário:* ${adjustment.expectedTime}\n` +
            `📋 *Motivo Selecionado:* ${selectedReasonName}\n` +
            `Solicitado por: ${mentionTag}\n\n` +
            `👉 *Enviado para auditoria e gravação no Secullum pelo RH.*`;

        return {
            handled: true,
            replyText: replyMsg
        };
    }

    return { handled: false };
}
