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

export const BOT_PHONE = "554135030020";

/**
 * ETAPA 1: Dispara o alerta inicial no WhatsApp com LINKS DE 1 TOQUE (wa.me) e suporte a resposta rápida
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

        const headerAlert = `🚨 *INCONSISTÊNCIA DE PONTO — #${adj.code}*`;
        const colabInfo = `👤 *Colaborador:* ${adj.employee.name}\n🏢 *Contrato:* ${adj.client?.name || "Geral"}\n📍 *Posto:* ${adj.posto?.role?.name || "Não informado"}\n📅 *Data:* ${dataFormatada} | *Marcação:* ${tipoText}\n⏰ *Horário Previsto:* ${adj.expectedTime}`;

        const managerCallout = mentionTag
            ? `\n👉 Atenção ${mentionTag} (Gestor do Contrato):`
            : `\n👉 Líderes da operação:`;

        const linkAjustar = `https://wa.me/${BOT_PHONE}?text=%23${adj.code}%201`;
        const linkFalta = `https://wa.me/${BOT_PHONE}?text=%23${adj.code}%202`;

        const optionsText = `\n👇 *Defina a tratativa em 1 toque (sem precisar digitar):*\n\n` +
            `🟢 *[ 1. SOLICITAR AJUSTE DE PONTO ]*\n👉 ${linkAjustar}\n\n` +
            `🔴 *[ 2. CONFIRMAR FALTA ]*\n👉 ${linkFalta}\n\n` +
            `💡 _Ou responda no grupo citando esta mensagem com:_ *1* (Ajustar) ou *2* (Falta)`;

        const fullMessage = `${headerAlert}\n\n${colabInfo}${managerCallout}${optionsText}`;

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
 * ETAPA 2: Envia os 24 MOTIVOS OFICIAIS DO SECULLUM com links rápidos de 1 clique
 */
export async function sendReasonsWhatsAppList(params: {
    code: string;
    targetPhone: string;
    employeeName: string;
    expectedTime: string;
}) {
    const rawJusts = await prisma.secullumJustification.findMany({
        where: { isActive: true },
        orderBy: { descricao: "asc" }
    });

    const lines = rawJusts.map((j, idx) => `*${idx + 1}* - ${j.descricao}`);

    // Identificar índices dos motivos operacionais mais comuns
    const findIndex = (kw: string) => rawJusts.findIndex(j => j.descricao.toUpperCase().includes(kw)) + 1;
    const idxSemRegistro = findIndex("REGISTRO") || 20;
    const idxAtestado = findIndex("ATESTADO") || 6;
    const idxDeclaracao = findIndex("DECLAR") || 10;
    const idxTroca = findIndex("TROCA") || 22;
    const idxFolga = findIndex("FOLGA") || 13;

    const linkSemReg = `https://wa.me/${BOT_PHONE}?text=%23${params.code}%20${idxSemRegistro}`;
    const linkAtestado = `https://wa.me/${BOT_PHONE}?text=%23${params.code}%20${idxAtestado}`;
    const linkDeclaracao = `https://wa.me/${BOT_PHONE}?text=%23${params.code}%20${idxDeclaracao}`;
    const linkTroca = `https://wa.me/${BOT_PHONE}?text=%23${params.code}%20${idxTroca}`;
    const linkFolga = `https://wa.me/${BOT_PHONE}?text=%23${params.code}%20${idxFolga}`;

    const msg = `📋 *Ajuste #${params.code} — Horário: ${params.expectedTime}*\n` +
        `👤 _Colaborador: ${params.employeeName}_\n\n` +
        `👇 *Toque no motivo para confirmar em 1 clique:*\n` +
        `• 🟢 *Sem Registro de Ponto:* ${linkSemReg}\n` +
        `• 🏥 *Atestado Médico:* ${linkAtestado}\n` +
        `• 📄 *Declaração de Horas:* ${linkDeclaracao}\n` +
        `• 🔄 *Troca de Plantão:* ${linkTroca}\n` +
        `• 🏖️ *Folga:* ${linkFolga}\n\n` +
        `📋 *Todos os 24 Motivos Secullum:*\n` +
        lines.join("\n") +
        `\n\n👉 *Ou responda citando com o número do motivo (ex:* #${params.code} ${idxSemRegistro} *ou apenas* ${idxSemRegistro}*)*`;

    return sendZapiWithMentions({
        target: params.targetPhone,
        message: msg
    });
}

/**
 * PARSER DO WEBHOOK: Processa comandos #AJ... em grupos ou privado
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

    // Isolar o texto real do usuário excluindo linhas citadas (> ...)
    const lines = rawText.split("\n");
    const userLines = lines.filter(l => !l.trim().startsWith(">"));
    let userText = (userLines.length > 0 ? userLines.join(" ") : rawText)
        .replace(/#(AJ\d+(?:_\d+)?)/ig, "")
        .trim();

    const cleanSender = params.senderPhone.replace(/\D/g, "");
    const mentionTag = `@${cleanSender.startsWith("55") ? cleanSender : `55${cleanSender}`}`;
    const targetDestination = params.groupPhone || params.senderPhone;

    // A. OPÇÃO FALTA (2, falta, não)
    if (userText === "2" || userText.toLowerCase().includes("falta") || userText.toLowerCase().includes("não") || rawText.includes("_falta")) {
        await processManagerWhatsAppResponse({
            code,
            senderPhone: params.senderPhone,
            senderName: params.senderName,
            action: "FALTA"
        });

        return {
            handled: true,
            replyText: `❌ *Falta confirmada para #${code}!* (${adjustment.employee.name})\nConfirmado por: ${mentionTag}. O RH foi notificado.`
        };
    }

    // B. OPÇÃO AJUSTAR — ETAPA 1 (1, ajustar, sim)
    if (userText === "1" || userText.toLowerCase().includes("ajustar") || userText.toLowerCase().includes("sim") || rawText.includes("_ajustar")) {
        await sendReasonsWhatsAppList({
            code,
            targetPhone: targetDestination,
            employeeName: adjustment.employee.name,
            expectedTime: adjustment.expectedTime
        });

        return {
            handled: true,
            replyText: undefined // A própria sendReasonsWhatsAppList já disparou o menu completo
        };
    }

    // C. OPÇÃO MOTIVO ESCOLHIDO (número de 1 a 24 ou texto do motivo)
    const rawJusts = await prisma.secullumJustification.findMany({
        where: { isActive: true },
        orderBy: { descricao: "asc" }
    });

    let selectedJust: { id: string; codigo: string | null; descricao: string } | null = null;

    // Checar se digitou número (ex: 20 ou #AJ1004 20)
    const numMatch = userText.match(/^\s*(\d{1,2})\b/);
    if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        if (num >= 1 && num <= rawJusts.length) {
            selectedJust = rawJusts[num - 1];
        }
    }

    // Checar por texto do motivo se não for número
    if (!selectedJust && userText.length >= 3) {
        const searchUpper = userText.toUpperCase();
        selectedJust = rawJusts.find(j => 
            searchUpper.includes(j.descricao.toUpperCase()) || 
            (j.codigo && searchUpper.includes(j.codigo.toUpperCase()))
        ) || null;
    }

    if (selectedJust) {
        await processManagerWhatsAppResponse({
            code,
            senderPhone: params.senderPhone,
            senderName: params.senderName,
            action: "AJUSTAR",
            reasonIdOrCode: selectedJust.codigo || selectedJust.descricao
        });

        const replyMsg = `✅ *Ajuste #${code} Solicitado com Sucesso!*\n\n` +
            `👤 *Colaborador:* ${adjustment.employee.name}\n` +
            `⏰ *Horário:* ${adjustment.expectedTime}\n` +
            `📋 *Motivo Selecionado:* ${selectedJust.descricao} (${selectedJust.codigo || "Oficial"})\n` +
            `Solicitado por: ${mentionTag}\n\n` +
            `👉 *Enviado para auditoria e gravação no Secullum pelo RH.*`;

        return {
            handled: true,
            replyText: replyMsg
        };
    }

    return { handled: false };
}

