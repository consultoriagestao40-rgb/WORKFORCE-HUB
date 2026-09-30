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
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Client-Token": ZAPI_CLIENT_TOKEN
            },
            body: JSON.stringify({
                phone: finalPhone,
                message: params.message,
                optionList: {
                    title: params.title.slice(0, 50),
                    buttonLabel: params.buttonLabel.slice(0, 20),
                    options: params.options.map(opt => ({
                        id: opt.id,
                        title: opt.title.slice(0, 24),
                        description: (opt.description || "").slice(0, 72)
                    }))
                }
            })
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.warn(`[Z-API send-option-list Warning]:`, errorText);
            return { success: false, error: errorText };
        }

        const data = await res.json();
        return { success: true, zapiId: data.messageId || data.id || data.zaapId };
    } catch (err: any) {
        console.error("[sendZapiOptionList] Erro:", err);
        return { success: false, error: err.message };
    }
}

/**
 * ETAPA 1: Dispara o alerta inicial no WhatsApp com MENU INTERATIVO:
 * [ Definir Tratativa 👇 ] -> [ ✅ Ajustar Ponto ] | [ ❌ Confirmar Falta ]
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

        const headerAlert = `🚨 *INCONSISTÊNCIA DE PONTO — #${adj.code}*`;
        const colabInfo = `👤 *Colaborador:* ${adj.employee.name}\n🏢 *Contrato:* ${adj.client?.name || "Geral"}\n📍 *Posto:* ${adj.posto?.role?.name || "Não informado"}\n📅 *Data:* ${dataFormatada} | *Marcação:* ${tipoText}\n⏰ *Horário Previsto:* ${adj.expectedTime}`;

        const managerCallout = mentionTag
            ? `\n👉 Atenção ${mentionTag} (Gestor do Contrato):`
            : `\n👉 Líderes da operação:`;

        const instructionText = `\n_Toque no botão abaixo para definir a tratativa:_`;

        const fullMessage = `${headerAlert}\n\n${colabInfo}${managerCallout}${instructionText}`;

        // Dispara com MENU INTERATIVO CLICÁVEL (Garantido em grupos)
        const sendRes = await sendZapiOptionList({
            target: targetGroup,
            message: fullMessage,
            title: "Tratativa de Ponto",
            buttonLabel: "Definir Tratativa 👇",
            options: [
                { id: `#${adj.code}_ajustar`, title: "✅ Ajustar Ponto", description: "Escolher motivo no Secullum" },
                { id: `#${adj.code}_falta`, title: "❌ Confirmar Falta", description: "Registrar ausência injustificada" }
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
 * ETAPA 2: Dispara o MENU CLICÁVEL com TODOS OS 24 MOTIVOS NATIVOS DO SECULLUM
 * Acionado quando o gestor clica no botão "✅ Ajustar Ponto"
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

    const options = rawJusts.map(j => ({
        id: `#${params.code}_MOT_${j.id}`,
        title: j.descricao.slice(0, 24),
        description: `Código Secullum: ${j.codigo || j.descricao}`.slice(0, 72)
    }));

    return sendZapiOptionList({
        target: params.groupPhone,
        message: `📋 *Ajuste #${params.code} — Horário: ${params.expectedTime}*\n_Colaborador: ${params.employeeName}_\n\nToque no botão abaixo para escolher o motivo oficial do ponto:`,
        title: "Motivos Secullum",
        buttonLabel: "Escolher Motivo 👇",
        options
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
    const rawText = (params.messageText || "").trim();

    // 1. Extrair código #AJ... do texto ou da citação
    const codeMatch = rawText.match(/#(AJ\d+(?:_\d+)?)/i);
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

    const cleanSender = params.senderPhone.replace(/\D/g, "");
    const mentionTag = `@${cleanSender.startsWith("55") ? cleanSender : `55${cleanSender}`}`;
    const targetGroup = params.groupPhone || adjustment.whatsappGroupId || DEFAULT_OPERATIONS_GROUP;

    // A. CLIQUE NO BOTÃO: "Confirmar Falta" (#AJ..._falta ou texto Falta)
    if (rawText.includes("_falta") || rawText.toLowerCase().includes("confirmar falta") || rawText.toLowerCase().includes("falta")) {
        await processManagerWhatsAppResponse({
            code,
            senderPhone: params.senderPhone,
            senderName: params.senderName,
            action: "FALTA"
        });

        return {
            handled: true,
            replyText: `❌ *Falta confirmada para #${code}!* (${adjustment.employee.name})\nRegistrado por: ${mentionTag}. O RH foi notificado.`
        };
    }

    // B. CLIQUE NO BOTÃO: "Ajustar Ponto" (#AJ..._ajustar ou texto Ajustar Ponto)
    // Dispara a ETAPA 2: Menu Interativo de Motivos Clicável!
    if (rawText.includes("_ajustar") || rawText.toLowerCase().includes("ajustar ponto") || rawText.toLowerCase().endsWith("ajustar")) {
        if (targetGroup) {
            await sendReasonsOptionList({
                code,
                groupPhone: targetGroup,
                employeeName: adjustment.employee.name,
                expectedTime: adjustment.expectedTime
            });
        }
        return {
            handled: true,
            replyText: undefined
        };
    }

    // C. CLIQUE NO MENU DE MOTIVOS: (#AJ..._MOT_uuid ou seleção do motivo ex: "AT. ACO")
    let selectedReasonName = "";
    let selectedReasonCode = "";

    const rawJusts = await prisma.secullumJustification.findMany({
        where: { isActive: true }
    });

    if (rawText.includes("_MOT_")) {
        const motIdMatch = rawText.match(/_MOT_([a-zA-Z0-9_-]+)/);
        const justificationId = motIdMatch ? motIdMatch[1] : undefined;
        if (justificationId) {
            const just = rawJusts.find(j => j.id === justificationId);
            if (just) {
                selectedReasonName = just.descricao;
                selectedReasonCode = just.codigo || just.descricao;
            }
        }
    }

    // Se o WhatsApp enviou o nome/código do motivo selecionado diretamente
    if (!selectedReasonName) {
        const upper = rawText.toUpperCase();
        const found = rawJusts.find(j => 
            upper.includes(j.descricao.toUpperCase()) || 
            (j.codigo && upper.includes(j.codigo.toUpperCase()))
        );
        if (found) {
            selectedReasonName = found.descricao;
            selectedReasonCode = found.codigo || found.descricao;
        }
    }

    if (selectedReasonName) {
        // GATILHO OFICIAL: O gestor confirmou o ajuste e o motivo!
        // Promove o status para PENDING_AUDIT para entrar no Workforce Hub
        await processManagerWhatsAppResponse({
            code,
            senderPhone: params.senderPhone,
            senderName: params.senderName,
            action: "AJUSTAR",
            reasonIdOrCode: selectedReasonCode || selectedReasonName
        });

        const replyMsg = `✅ *Ajuste #${code} Solicitado com Sucesso!*\n\n` +
            `👤 *Colaborador:* ${adjustment.employee.name}\n` +
            `⏰ *Horário:* ${adjustment.expectedTime}\n` +
            `📋 *Motivo Selecionado:* ${selectedReasonName}\n` +
            `Solicitado por: ${mentionTag}\n\n` +
            `👉 *Registrado no Workforce Hub para conferência e injeção no Secullum pelo RH.*`;

        return {
            handled: true,
            replyText: replyMsg
        };
    }

    return { handled: false };
}

