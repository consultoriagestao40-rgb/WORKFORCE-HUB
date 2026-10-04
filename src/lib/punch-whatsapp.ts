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

function nowBr(): string {
    return new Date().toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
}

export const STANDARDIZED_PUNCH_REASONS = [
    {
        id: "ABONO",
        title: "🩺 Abono",
        description: "Não trabalhou; abono do gestor s/ desconto",
        secullumCode: "ABONO",
        secullumName: "ABONO (NÃO TRABALHOU / ABONADO PELO GESTOR)"
    },
    {
        id: "ESQUECIMENTO",
        title: "🕒 Esquecimento",
        description: "Trabalhou normalmente; esqueceu de registrar",
        secullumCode: "S/ REG.",
        secullumName: "SEM REGISTRO DE PONTO (ESQUECIMENTO)"
    },
    {
        id: "PROB_APARELHO",
        title: "📱 Problema Aparelho",
        description: "Aparelho descarregou, defeito ou sem celular",
        secullumCode: "S/ REG.",
        secullumName: "SEM REGISTRO DE PONTO (PROBLEMA DE APARELHO)"
    },
    {
        id: "SISTEMA",
        title: "💻 Instab. Sistema",
        description: "Sistema de ponto fora do ar ou c/ lentidão",
        secullumCode: "S/ REG.",
        secullumName: "SEM REGISTRO DE PONTO (INSTABILIDADE DO SISTEMA)"
    }
];

/**
 * ETAPA 1: Dispara o alerta inicial no WhatsApp com MENU INTERATIVO:
 * [ Definir Tratativa 👇 ] -> [ ✅ Ajustar Ponto ] | [ ❌ Confirmar Falta ]
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
                posto: { include: { role: true, client: true } }
            }
        });

        if (!adj) {
            return { success: false, message: "Ajuste não encontrado." };
        }

        // Buscar o posto ativo do colaborador caso não esteja preenchido no ajuste
        let posto = adj.posto;
        let client = adj.client;

        if (!posto) {
            const activeAssignment = await prisma.assignment.findFirst({
                where: { employeeId: adj.employeeId, endDate: null },
                orderBy: { startDate: "desc" },
                include: {
                    posto: {
                        include: {
                            role: true,
                            client: { include: { accountManager: true } }
                        }
                    }
                }
            });
            if (activeAssignment?.posto) {
                posto = activeAssignment.posto;
                if (!client) client = activeAssignment.posto.client;
            }
        }

        const groupTarget = targetGroupOverride || adj.whatsappGroupId || DEFAULT_OPERATIONS_GROUP;

        // O alerta com menu vai no PRIVADO do Gestor do Contrato (usuário do sistema).
        // Menus interativos funcionam no privado; em grupos o iPhone falha ao responder.
        const manager = client?.accountManager || adj.client?.accountManager;
        let managerPhone: string | null = null;
        if (manager?.phone) {
            const cleanPhone = manager.phone.replace(/\D/g, "");
            if (cleanPhone.length >= 10) {
                managerPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
            }
        }

        const tipoMap: Record<string, string> = {
            "ENTRADA_1": "Entrada 1",
            "SAIDA_1": "Saída Almoço",
            "ENTRADA_2": "Retorno Almoço",
            "SAIDA_2": "Saída Final"
        };
        const tipoText = tipoMap[adj.punchType] || adj.punchType;
        const dataFormatada = adj.date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

        const postoNome = posto?.role?.name || "Não informado";
        const postoEscala = posto?.schedule ? ` (${posto.schedule}${posto.startTime && posto.endTime ? ` — ${posto.startTime} às ${posto.endTime}` : ""})` : "";
        const postoInfo = `${postoNome}${postoEscala}`;

        const colabInfo =
`👤 *Colaborador:* ${adj.employee.name}
🏢 *Cliente/Contrato:* ${client?.name || "Geral"}
📍 *Posto / Função:* ${postoInfo}
📅 *Data:* ${dataFormatada} | *Marcação:* ${tipoText}
⏰ *Horário Previsto:* ${adj.expectedTime}`;

        // Sem gestor com WhatsApp cadastrado: avisa o grupo (texto) para alguém cadastrar/tratar
        if (!managerPhone) {
            const fallbackMsg = `🚨 *INCONSISTÊNCIA DE PONTO — #${adj.code}*\n\n${colabInfo}\n\n` +
                `⚠️ *Contrato sem Gestor com WhatsApp cadastrado.* Cadastre o gestor do contrato (com telefone) no Workforce Hub para que ele receba o menu de tratativa no privado.`;
            const res = await sendZapiWithMentions({ target: groupTarget, message: fallbackMsg });
            if (res.success) {
                await prisma.attendancePunchAdjustment.update({
                    where: { id: adjustmentId },
                    data: {
                        whatsappGroupId: groupTarget,
                        whatsappMessageId: res.zapiId,
                        postoId: posto?.id || adj.postoId || null,
                        clientId: client?.id || adj.clientId || null
                    }
                });
            }
            return { success: res.success, zapiId: res.zapiId, message: "Sem gestor com telefone: aviso enviado ao grupo." };
        }

        const firstName = (manager?.name || "").split(" ")[0];
        const fullMessage = `🚨 *INCONSISTÊNCIA DE PONTO — #${adj.code}*\n\n` +
            `Olá${firstName ? ` ${firstName}` : ""}, você é o gestor deste contrato.\n\n` +
            `${colabInfo}\n\n_Toque no menu abaixo para definir a tratativa:_ 👇`;

        const sendRes = await sendZapiOptionList({
            target: managerPhone,
            message: fullMessage,
            title: "Tratativa de Ponto",
            buttonLabel: "Definir Tratativa 👇",
            options: [
                { id: `${adj.code}_ajustar`, title: "✅ Ajustar Ponto", description: "Escolher motivo no Secullum" },
                { id: `${adj.code}_falta`, title: "❌ Confirmar Falta", description: "Registrar falta injustificada" }
            ]
        });

        if (sendRes.success) {
            await prisma.attendancePunchAdjustment.update({
                where: { id: adjustmentId },
                data: {
                    // whatsappGroupId continua sendo o grupo: é onde a decisão final é espelhada
                    whatsappGroupId: groupTarget,
                    whatsappMessageId: sendRes.zapiId,
                    managerMentionedPhone: managerPhone,
                    postoId: posto?.id || adj.postoId || null,
                    clientId: client?.id || adj.clientId || null
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
 * ETAPA 2: Dispara o MENU CLICÁVEL com os 4 MOTIVOS OPERACIONAIS PADRONIZADOS
 * (Abono, Esquecimento, Problema Aparelho, Instabilidade Sistema)
 */
export async function sendReasonsOptionList(params: {
    code: string;
    groupPhone: string;
    employeeName: string;
    expectedTime: string;
    postoName?: string;
}) {
    const options = STANDARDIZED_PUNCH_REASONS.map(r => ({
        id: `${params.code}_MOT_${r.id}`,
        title: r.title,
        description: r.description
    }));

    const postoText = params.postoName ? ` | Posto: ${params.postoName}` : "";

    const message = `📋 *Ajuste #${params.code} — Horário: ${params.expectedTime}*\n` +
        `👤 ${params.employeeName}${postoText}\n\n` +
        `_Toque no menu abaixo para definir o motivo do ajuste:_ 👇`;

    return sendZapiOptionList({
        target: params.groupPhone,
        message,
        title: "Motivo do Ajuste",
        buttonLabel: "Escolher Motivo 👇",
        options
    });
}

/**
 * PARSER DO WEBHOOK: Processa cliques nos Menus de Opções e Botões
 */
export async function tryParsePunchAdjustmentReply(params: {
    messageText: string;
    senderPhone: string;
    senderName?: string;
    groupPhone?: string;
}): Promise<{ handled: boolean; replyText?: string }> {
    const rawText = (params.messageText || "").trim();

    // 1. Extrair código AJ... do texto, da citação ou do ID do botão
    const codeMatch = rawText.match(/#?(AJ\d+)/i);
    let candidateCode = codeMatch ? codeMatch[1].toUpperCase() : null;

    let adjustment = null;

    if (candidateCode) {
        adjustment = await prisma.attendancePunchAdjustment.findUnique({
            where: { code: candidateCode },
            include: {
                employee: true,
                client: { include: { accountManager: true } },
                posto: { include: { role: true, client: true } }
            }
        });

        if (!adjustment && candidateCode.includes("_")) {
            const baseCode = candidateCode.split("_")[0];
            adjustment = await prisma.attendancePunchAdjustment.findUnique({
                where: { code: baseCode },
                include: {
                    employee: true,
                    client: { include: { accountManager: true } },
                    posto: { include: { role: true, client: true } }
                }
            });
            if (adjustment) {
                candidateCode = baseCode;
            }
        }
    }

    // Se não achou código explícito no texto (ex: o usuário clicou no menu ou digitou 1, 2, ajustar, falta, esquecimento)
    if (!adjustment) {
        const isMenuClick = 
            rawText.includes("_falta") || 
            rawText.includes("_ajustar") || 
            rawText.includes("_MOT_") ||
            rawText.toLowerCase().includes("ajustar") || 
            rawText.toLowerCase().includes("falta") ||
            rawText.trim() === "1" ||
            rawText.trim() === "2" ||
            rawText.trim() === "3" ||
            rawText.trim() === "4" ||
            STANDARDIZED_PUNCH_REASONS.some(r => rawText.toLowerCase().includes(r.title.toLowerCase()));

        if (isMenuClick) {
            const targetGroupId = params.groupPhone || DEFAULT_OPERATIONS_GROUP;
            adjustment = await prisma.attendancePunchAdjustment.findFirst({
                where: {
                    OR: [
                        { whatsappGroupId: { contains: "120363412937009664" } },
                        { whatsappGroupId: targetGroupId },
                        { whatsappGroupId: DEFAULT_OPERATIONS_GROUP }
                    ],
                    status: { in: ["PENDING_RESPONSE", "PENDING_REASON"] }
                },
                orderBy: { updatedAt: "desc" },
                include: {
                    employee: true,
                    client: { include: { accountManager: true } },
                    posto: { include: { role: true, client: true } }
                }
            });
            if (adjustment) {
                candidateCode = adjustment.code;
            }
        }
    }

    if (!adjustment || !candidateCode) {
        return { handled: false };
    }

    // Resolver Posto e Cliente caso não estejam salvos diretamente
    let posto = adjustment.posto;
    let client = adjustment.client;

    if (!posto) {
        const activeAssignment = await prisma.assignment.findFirst({
            where: { employeeId: adjustment.employeeId, endDate: null },
            orderBy: { startDate: "desc" },
            include: {
                posto: {
                    include: {
                        role: true,
                        client: { include: { accountManager: true } }
                    }
                }
            }
        });
        if (activeAssignment?.posto) {
            posto = activeAssignment.posto;
            if (!client) client = activeAssignment.posto.client;
        }
    }

    const postoNome = posto?.role?.name || "Não informado";
    const cleanSender = params.senderPhone.replace(/\D/g, "");
    const mentionTag = cleanSender ? `@${cleanSender.startsWith("55") ? cleanSender : `55${cleanSender}`}` : (params.senderName || "Líder");
    const targetGroup = params.groupPhone || adjustment.whatsappGroupId || DEFAULT_OPERATIONS_GROUP;

    // -------------------------------------------------------------
    // ETAPA 2 (PRIORIDADE): CLIQUE NO MENU DE MOTIVOS OU NÚMERO/NOME DO MOTIVO
    // -------------------------------------------------------------
    let matchedReason = STANDARDIZED_PUNCH_REASONS.find(r => rawText.includes(`_MOT_${r.id}`));

    if (!matchedReason) {
        const cleanTrim = rawText.trim();
        const upper = rawText.toUpperCase();

        // Se o ajuste está em PENDING_REASON, números 1..4 são os motivos da lista
        if (adjustment.status === "PENDING_REASON") {
            if (cleanTrim === "1" || cleanTrim.startsWith("1 ")) matchedReason = STANDARDIZED_PUNCH_REASONS[0];
            else if (cleanTrim === "2" || cleanTrim.startsWith("2 ")) matchedReason = STANDARDIZED_PUNCH_REASONS[1];
            else if (cleanTrim === "3" || cleanTrim.startsWith("3 ")) matchedReason = STANDARDIZED_PUNCH_REASONS[2];
            else if (cleanTrim === "4" || cleanTrim.startsWith("4 ")) matchedReason = STANDARDIZED_PUNCH_REASONS[3];
        }

        if (!matchedReason) {
            if (upper.includes("ABONO")) matchedReason = STANDARDIZED_PUNCH_REASONS[0];
            else if (upper.includes("ESQUEC") || upper.includes("ESQUECEU")) matchedReason = STANDARDIZED_PUNCH_REASONS[1];
            else if (upper.includes("APARELHO") || upper.includes("CELULAR") || cleanTrim === "3") matchedReason = STANDARDIZED_PUNCH_REASONS[2];
            else if (upper.includes("SISTEMA") || upper.includes("INSTABILIDADE") || upper.includes("FORA") || cleanTrim === "4") matchedReason = STANDARDIZED_PUNCH_REASONS[3];
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

        // Gravar também a descrição padronizada e garantir posto/cliente
        await prisma.attendancePunchAdjustment.update({
            where: { id: adjustment.id },
            data: {
                secullumReasonName: matchedReason.secullumName,
                notes: matchedReason.description,
                postoId: posto?.id || adjustment.postoId || null,
                clientId: client?.id || adjustment.clientId || null
            }
        });

        const replyMsg = `✅ *Ajuste #${candidateCode} Solicitado com Sucesso!*\n\n` +
            `👤 *Colaborador:* ${adjustment.employee.name}\n` +
            `🏢 *Cliente:* ${client?.name || "Geral"}\n` +
            `📍 *Posto:* ${postoNome}\n` +
            `⏰ *Horário:* ${adjustment.expectedTime}\n` +
            `📋 *Motivo:* ${matchedReason.title} (${matchedReason.description})\n` +
            `✍️ *Solicitado por:* ${mentionTag}\n` +
            `🕒 *Solicitado em:* ${nowBr()}\n\n` +
            `👉 *Registrado no Workforce Hub para conferência e injeção no Secullum pelo RH.*`;

        return {
            handled: true,
            replyText: replyMsg
        };
    }

    // -------------------------------------------------------------
    // ETAPA 1.A: CLIQUE NO MENU / DIGITAR: "Confirmar Falta" (Opção 2, _falta, texto Falta)
    // -------------------------------------------------------------
    const isFalta = rawText.includes("_falta") || 
                    rawText.toLowerCase().includes("confirmar falta") || 
                    rawText.toLowerCase().includes("falta") ||
                    (adjustment.status !== "PENDING_REASON" && (rawText.trim() === "2" || rawText.startsWith("2 ")));

    if (isFalta) {
        await processManagerWhatsAppResponse({
            code: candidateCode,
            senderPhone: params.senderPhone,
            senderName: params.senderName,
            action: "FALTA"
        });

        const replyMsg = `❌ *Falta confirmada para #${candidateCode}!*\n\n` +
            `👤 *Colaborador:* ${adjustment.employee.name}\n` +
            `🏢 *Cliente:* ${client?.name || "Geral"}\n` +
            `📍 *Posto:* ${postoNome}\n` +
            `🕒 *Registrado em:* ${nowBr()}\n` +
            `✍️ *Registrado por:* ${mentionTag}. O RH foi notificado.`;

        return {
            handled: true,
            replyText: replyMsg
        };
    }

    // -------------------------------------------------------------
    // ETAPA 1.B: CLIQUE NO MENU / DIGITAR: "Ajustar Ponto" (Opção 1, _ajustar, texto Ajustar)
    // Dispara a ETAPA 2: Menu Interativo dos 4 Motivos Padronizados!
    // -------------------------------------------------------------
    const isAjustar = (
        rawText.includes("_ajustar") || 
        rawText.toLowerCase().includes("ajustar ponto") ||
        rawText.toLowerCase().includes("ajustar") || 
        (adjustment.status !== "PENDING_REASON" && (rawText.trim() === "1" || rawText.startsWith("1 ")))
    );

    if (isAjustar) {
        // Marca o ajuste como aguardando definição de motivo
        await prisma.attendancePunchAdjustment.update({
            where: { id: adjustment.id },
            data: { status: "PENDING_REASON" }
        });

        if (targetGroup) {
            await sendReasonsOptionList({
                code: candidateCode,
                groupPhone: targetGroup,
                employeeName: adjustment.employee.name,
                expectedTime: adjustment.expectedTime,
                postoName: postoNome
            });
        }
        return {
            handled: true
        };
    }

    return { handled: false };
}





