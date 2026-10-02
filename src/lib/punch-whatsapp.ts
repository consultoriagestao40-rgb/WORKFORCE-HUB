import { prisma } from "@/lib/db";
import { processManagerWhatsAppResponse } from "@/actions/punch-adjustments";

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID || "3F1993DFB59E83474F059E648AE68DF9";
const ZAPI_TOKEN = process.env.ZAPI_TOKEN || "81087A6B5C1CAB8AAAC801C4";
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || "F5c1b8f27f6b049c98c4e779d00f67552S";

export const DEFAULT_OPERATIONS_GROUP = "120363412937009664-group";

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

export const STANDARDIZED_PUNCH_REASONS = [
    {
        id: "ABONO",
        optionNumber: "4",
        title: "Abono do Gestor",
        description: "Não trabalhou; abono do gestor s/ desconto",
        secullumCode: "ABONO",
        secullumName: "ABONO (NÃO TRABALHOU / ABONADO PELO GESTOR)"
    },
    {
        id: "ESQUECIMENTO",
        optionNumber: "1",
        title: "Esquecimento de Bater Ponto",
        description: "Trabalhou normalmente; esqueceu de registrar",
        secullumCode: "S/ REG.",
        secullumName: "SEM REGISTRO DE PONTO (ESQUECIMENTO)"
    },
    {
        id: "PROB_APARELHO",
        optionNumber: "3",
        title: "Problema no Aparelho / Celular",
        description: "Aparelho descarregou, defeito ou sem celular",
        secullumCode: "S/ REG.",
        secullumName: "SEM REGISTRO DE PONTO (PROBLEMA DE APARELHO)"
    },
    {
        id: "SISTEMA",
        optionNumber: "5",
        title: "Instabilidade no Sistema Secullum",
        description: "Sistema de ponto fora do ar ou c/ lentidão",
        secullumCode: "S/ REG.",
        secullumName: "SEM REGISTRO DE PONTO (INSTABILIDADE DO SISTEMA)"
    }
];

/**
 * Dispara o alerta de inconsistência de ponto no WhatsApp.
 * Em grupos, envia texto formatado com opções numeradas (1 a 5),
 * pois WhatsApp bloqueia o envio de respostas interativas (botões/listas) por membros de grupos.
 */
export async function sendPunchAdjustmentWhatsAppAlert(
    adjustmentId: string,
    targetGroupOverride?: string
): Promise<{ success: boolean; message?: string; zapiId?: string }> {
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
            : `\n👉 Atenção líderes da operação:`;

        const optionsGuide = 
`\n*Responda a esta mensagem com a opção desejada:*\n` +
`1️⃣ *1* — 🕒 *Esqueceu de bater* (Ajustar no horário previsto: ${adj.expectedTime})\n` +
`2️⃣ *2* — ❌ *Confirmar Falta* (Ausência sem justificativa)\n` +
`3️⃣ *3* — 📱 *Problema de Celular / Aparelho* (Ajustar no horário previsto)\n` +
`4️⃣ *4* — 🩺 *Atestado Médico / Abono do Gestor*\n` +
`5️⃣ *5* — 💻 *Sistema Secullum Fora do Ar* (Ajustar no horário previsto)\n\n` +
`💬 _Basta responder citando com o número (ex: *1* ou *2*) ou digitar *#${adj.code} 1*._`;

        const fullMessage = `${headerAlert}\n\n${colabInfo}${managerCallout}\n${optionsGuide}`;

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
 * PARSER DO WEBHOOK: Processa respostas de gestores no WhatsApp
 * Suporta:
 * 1. Respostas citando a mensagem original (ex: "> ... #AJ1011 ... \n 1" ou "2")
 * 2. Mensagens diretas (ex: "#AJ1011 1", "#AJ1011 falta", "#AJ1011_1")
 * 3. Botões/menus legados caso enviados
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

    let candidateCode = codeMatch[1].toUpperCase();

    // Buscar o registro no banco pelo código exato
    let adjustment = await prisma.attendancePunchAdjustment.findUnique({
        where: { code: candidateCode },
        include: {
            employee: true,
            client: { include: { accountManager: true } }
        }
    });

    // Se não encontrou e o código tinha sufixo (ex: AJ1011_1 -> AJ1011)
    if (!adjustment && candidateCode.includes("_")) {
        const baseCode = candidateCode.split("_")[0];
        adjustment = await prisma.attendancePunchAdjustment.findUnique({
            where: { code: baseCode },
            include: {
                employee: true,
                client: { include: { accountManager: true } }
            }
        });
        if (adjustment) {
            candidateCode = baseCode;
        }
    }

    if (!adjustment) {
        return { handled: false };
    }

    const cleanSender = params.senderPhone.replace(/\D/g, "");
    const mentionTag = cleanSender ? `@${cleanSender.startsWith("55") ? cleanSender : `55${cleanSender}`}` : (params.senderName || "Líder");

    // Separar linhas citadas do texto escrito pelo usuário
    const lines = rawText.split("\n");
    const replyLines = lines.filter(l => !l.trim().startsWith(">"));
    const userReply = replyLines.join(" ").trim().toLowerCase();

    // 2. IDENTIFICAR AÇÃO

    // A. FALTA (Opção 2, "falta", "ausência", "não veio", "_falta", etc.)
    const isFalta = 
        userReply === "2" ||
        userReply.startsWith("2 ") ||
        userReply.endsWith(" 2") ||
        userReply.includes("_falta") ||
        userReply.includes("falta") ||
        userReply.includes("ausente") ||
        userReply.includes("ausencia") ||
        userReply.includes("não veio") ||
        userReply.includes("nao veio") ||
        rawText.includes("_falta");

    if (isFalta) {
        await processManagerWhatsAppResponse({
            code: candidateCode,
            senderPhone: params.senderPhone,
            senderName: params.senderName,
            action: "FALTA"
        });

        const replyMsg = 
`❌ *Falta Confirmada — #${candidateCode}*

👤 *Colaborador:* ${adjustment.employee.name}
📅 *Data:* ${adjustment.date.toLocaleDateString("pt-BR")}
⏰ *Horário:* ${adjustment.expectedTime}
✍️ *Registrado por:* ${mentionTag}

👉 *Ausência registrada no Workforce Hub. O RH foi notificado para o fechamento da folha.*`;

        return {
            handled: true,
            replyText: replyMsg
        };
    }

    // B. AJUSTE — Seleção do Motivo
    let matchedReason = STANDARDIZED_PUNCH_REASONS.find(r => rawText.includes(`_MOT_${r.id}`));

    if (!matchedReason) {
        // Opção 1: Esquecimento de bater ponto
        if (
            userReply === "1" ||
            userReply.startsWith("1 ") ||
            userReply.endsWith(" 1") ||
            userReply.includes("_1") ||
            userReply.includes("esquece") ||
            userReply.includes("esqueceu") ||
            userReply.includes("normal") ||
            userReply.includes("trabalhou") ||
            userReply.includes("trabalho") ||
            userReply.includes("_ajustar") ||
            userReply === "ajustar" ||
            userReply === "ajustar ponto" ||
            userReply === "ok" ||
            userReply === "sim"
        ) {
            matchedReason = STANDARDIZED_PUNCH_REASONS[1]; // Esquecimento
        }
        // Opção 3: Problema no celular / aparelho
        else if (
            userReply === "3" ||
            userReply.startsWith("3 ") ||
            userReply.endsWith(" 3") ||
            userReply.includes("_3") ||
            userReply.includes("celular") ||
            userReply.includes("aparelho") ||
            userReply.includes("bateria") ||
            userReply.includes("descarregou")
        ) {
            matchedReason = STANDARDIZED_PUNCH_REASONS[2]; // Problema Aparelho
        }
        // Opção 4: Abono do gestor / atestado
        else if (
            userReply === "4" ||
            userReply.startsWith("4 ") ||
            userReply.endsWith(" 4") ||
            userReply.includes("_4") ||
            userReply.includes("abono") ||
            userReply.includes("abonar") ||
            userReply.includes("atestado") ||
            userReply.includes("medico") ||
            userReply.includes("médico")
        ) {
            matchedReason = STANDARDIZED_PUNCH_REASONS[0]; // Abono
        }
        // Opção 5: Instabilidade no Sistema Secullum
        else if (
            userReply === "5" ||
            userReply.startsWith("5 ") ||
            userReply.endsWith(" 5") ||
            userReply.includes("_5") ||
            userReply.includes("sistema") ||
            userReply.includes("instabilidade") ||
            userReply.includes("secullum") ||
            userReply.includes("fora do ar") ||
            userReply.includes("fora")
        ) {
            matchedReason = STANDARDIZED_PUNCH_REASONS[3]; // Instabilidade Sistema
        }
    }

    if (matchedReason) {
        // GATILHO OFICIAL: O gestor confirmou o ajuste e o motivo!
        // Promove o status para PENDING_AUDIT para entrar no Workforce Hub
        await processManagerWhatsAppResponse({
            code: candidateCode,
            senderPhone: params.senderPhone,
            senderName: params.senderName,
            action: "AJUSTAR",
            reasonIdOrCode: matchedReason.secullumCode
        });

        // Gravar também a descrição padronizada
        await prisma.attendancePunchAdjustment.update({
            where: { id: adjustment.id },
            data: {
                secullumReasonName: matchedReason.secullumName,
                notes: matchedReason.description
            }
        });

        const replyMsg = 
`✅ *Ajuste Solicitado com Sucesso — #${candidateCode}*

👤 *Colaborador:* ${adjustment.employee.name}
📅 *Data:* ${adjustment.date.toLocaleDateString("pt-BR")}
⏰ *Horário Ajustado:* ${adjustment.expectedTime}
📋 *Motivo:* ${matchedReason.title}
✍️ *Solicitado por:* ${mentionTag}

👉 *Registrado no Workforce Hub para validação e injeção no Secullum pelo RH.*`;

        return {
            handled: true,
            replyText: replyMsg
        };
    }

    // Se o usuário digitou o código mas não colocou número ou opção válida, orienta:
    const guidanceMsg = 
`ℹ️ *Ajuste de Ponto #${candidateCode}* (${adjustment.employee.name})

Para registrar a tratativa, responda citando com o número:
1️⃣ *1* — 🕒 Esqueceu de bater (Ajustar Horário)
2️⃣ *2* — ❌ Confirmar Falta (Sem justificativa)
3️⃣ *3* — 📱 Problema no Celular / Aparelho
4️⃣ *4* — 🩺 Atestado Médico / Abono do Gestor
5️⃣ *5* — 💻 Sistema Secullum Fora do Ar`;

    return {
        handled: true,
        replyText: guidanceMsg
    };
}



