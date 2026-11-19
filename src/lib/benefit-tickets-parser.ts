import { prisma } from "@/lib/db";
import { sendZapiRaw } from "@/lib/rh-notifications";

export interface ParsedBenefitRequest {
    employeeName: string | null;
    cpf: string | null;
    category: "VT" | "VA" | "ASSIDUIDADE" | "AJUDA_CUSTO" | "OUTROS";
    typeId: string | null;
    title: string;
    description: string;
    slaHours: number;
}

/** Extrai CPF de 11 dígitos com ou sem pontuação */
function extractCpf(text: string): string | null {
    // 1. Formato 000.000.000-00
    const formatted = text.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
    if (formatted) {
        return formatted[0].replace(/\D/g, "");
    }
    // 2. 11 dígitos soltos precedidos de 'cpf'
    const matchNearCpf = text.match(/cpf\s*:?[\s]*(\d{11})/i);
    if (matchNearCpf) {
        return matchNearCpf[1];
    }
    return null;
}

/** Tenta extrair nome do funcionário */
function extractName(text: string, foundCpf: string | null): string | null {
    // Padrão comum: "Nome, CPF ..." ou "o Fulano de Tal, CPF..." ou "Colaborador: Fulano"
    const regex1 = /(?:o|a|colaborador|funcionário|funcionario)?\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)+)/;
    const match = text.match(regex1);
    if (match && match[1]) {
        const candidate = match[1].trim();
        // Evitar pegar palavras como "Bom Dia", "Grupo De Beneficios"
        if (!/^(bom dia|boa tarde|boa noite|grupo de|prezados)/i.test(candidate)) {
            return candidate;
        }
    }
    return null;
}

/** Normaliza texto removendo acentos para casamentos robustos */
function normalizeText(text: string): string {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Identifica a categoria do chamado com base no texto tolerando erros de digitação */
async function detectCategoryAndType(text: string): Promise<{
    category: "VT" | "VA" | "ASSIDUIDADE" | "AJUDA_CUSTO" | "OUTROS";
    typeId: string | null;
    typeName: string;
    slaHours: number;
}> {
    const norm = normalizeText(text);
    const types = await (prisma as any).benefitTicketType.findMany({
        where: { isActive: true }
    });

    // 1. Procurar nas palavras-chave cadastradas
    for (const t of types) {
        const kws = t.keywords || [];
        for (const kw of kws) {
            const cleanKw = normalizeText(kw);
            if (cleanKw && norm.includes(cleanKw)) {
                return {
                    category: t.category as any,
                    typeId: t.id,
                    typeName: t.name,
                    slaHours: t.slaHours
                };
            }
        }
    }

    // 2. Fallbacks diretos com alta tolerância a digitação (ex: 'transpote', 'tranporte', 'recarga', etc)
    // Vale Transporte (VT)
    if (/\b(vt)\b/i.test(norm) || /transp\w*|passag\w*|urbs|metrocard|metro card|recarga|onibus|linha\b/i.test(norm)) {
        const vtType = types.find((t: any) => t.category === "VT");
        return {
            category: "VT",
            typeId: vtType?.id || null,
            typeName: vtType?.name || "Vale Transporte (VT)",
            slaHours: vtType?.slaHours || 24
        };
    }

    // Vale Alimentação / Refeição (VA/VR/Caju)
    if (/\b(va|vr)\b/i.test(norm) || /alimenta\w*|refei\w*|caju|ticket refeicao|vale aliment\w*/i.test(norm)) {
        const vaType = types.find((t: any) => t.category === "VA");
        return {
            category: "VA",
            typeId: vaType?.id || null,
            typeName: vaType?.name || "Vale Alimentação (VA)",
            slaHours: vaType?.slaHours || 24
        };
    }

    // Assiduidade
    if (/assidu\w*|premio\w*|bonus\w*/i.test(norm)) {
        const assType = types.find((t: any) => t.category === "ASSIDUIDADE");
        return {
            category: "ASSIDUIDADE",
            typeId: assType?.id || null,
            typeName: assType?.name || "Prêmio Assiduidade",
            slaHours: assType?.slaHours || 48
        };
    }

    // Ajuda de Custo
    if (/ajuda\s+de\s+custo|combustivel|km|reembolso/i.test(norm)) {
        const ajType = types.find((t: any) => t.category === "AJUDA_CUSTO");
        return {
            category: "AJUDA_CUSTO",
            typeId: ajType?.id || null,
            typeName: ajType?.name || "Ajuda de Custo",
            slaHours: ajType?.slaHours || 24
        };
    }

    const defaultType = types.find((t: any) => t.category === "OUTROS");
    return {
        category: "OUTROS",
        typeId: defaultType?.id || null,
        typeName: defaultType?.name || "Outros Benefícios",
        slaHours: defaultType?.slaHours || 24
    };
}

/** Formata data estimada de SLA no fuso de SP */
function formatDueEstimate(dueAt: Date): string {
    return dueAt.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

/** Processa mensagem recebida no Grupo de Benefícios */
export async function tryProcessBenefitGroupMessage(params: {
    messageText: string;
    senderPhone: string;
    senderName: string;
    groupPhone: string;
    groupName?: string;
    messageId?: string;
}): Promise<{ handled: boolean; replyText?: string }> {
    const text = params.messageText.trim();
    if (!text || text.length < 8) return { handled: false };

    // 1. Extração de CPF ou Nome
    const cleanCpf = extractCpf(text);
    const extractedName = extractName(text, cleanCpf);

    if (!cleanCpf && !extractedName) {
        // Mensagem sem identificação clara de funcionário (ex: "Bom dia pessoal")
        return { handled: false };
    }

    // 2. Localizar funcionário no banco de dados
    let employee: any = null;
    if (cleanCpf) {
        employee = await (prisma as any).employee.findUnique({
            where: { cpf: cleanCpf },
            include: {
                assignments: {
                    where: { endDate: null },
                    take: 1,
                    include: { posto: { include: { client: true } } }
                }
            }
        });
    }

    if (!employee && extractedName) {
        employee = await (prisma as any).employee.findFirst({
            where: {
                name: { contains: extractedName, mode: "insensitive" },
                status: "Ativo"
            },
            include: {
                assignments: {
                    where: { endDate: null },
                    take: 1,
                    include: { posto: { include: { client: true } } }
                }
            }
        });
    }

    // Se não encontrou o funcionário e não tem CPF claro, ignora
    if (!employee && !cleanCpf) {
        return { handled: false };
    }

    const finalEmployeeName = employee?.name || extractedName || "Colaborador Informado";
    const finalCpf = employee?.cpf || cleanCpf || null;
    const finalPhone = employee?.phone || null;
    const postoName = employee?.assignments?.[0]?.posto?.name || null;
    const clientName = employee?.assignments?.[0]?.posto?.client?.name || null;

    // 3. Detectar categoria e tipo
    const detection = await detectCategoryAndType(text);

    // 4. Inteligência Anti-Duplicidade: verificar se já existe chamado ABERTO recente
    const recentOpenTicket = await (prisma as any).benefitTicket.findFirst({
        where: {
            OR: [
                finalCpf ? { employeeCpf: finalCpf } : { employeeName: finalEmployeeName },
                employee ? { employeeId: employee.id } : { employeeName: finalEmployeeName }
            ],
            category: detection.category,
            status: { in: ["OPEN", "IN_PROGRESS"] }
        },
        orderBy: { createdAt: "desc" }
    });

    if (recentOpenTicket) {
        const dueFormatted = formatDueEstimate(new Date(recentOpenTicket.dueAt));
        const statusLabel = recentOpenTicket.status === "IN_PROGRESS" ? "EM ANÁLISE PELO DP" : "AGUARDANDO ATENDIMENTO";
        const replyText = `⚠️ *[SOLICITAÇÃO JÁ EM ANDAMENTO]*\n\n` +
            `Olá, *${params.senderName}*!\n` +
            `Constatamos que já existe um chamado em aberto para este colaborador sobre *${detection.typeName}*:\n\n` +
            `🎫 *Ticket:* #${recentOpenTicket.ticketNumber}\n` +
            `👤 *Colaborador:* ${recentOpenTicket.employeeName}\n` +
            `📊 *Status Atual:* ${statusLabel}\n` +
            `⏱️ *Previsão de Conclusão / SLA:* até ${dueFormatted}\n\n` +
            `_Nossa equipe já está atuando na tratativa para não gerar duplicidade de processos._ 🤝`;

        return { handled: true, replyText };
    }

    // 5. Calcular DueAt com base no SLA
    const now = new Date();
    const dueAt = new Date(now.getTime() + detection.slaHours * 60 * 60 * 1000);

    // 6. Gerar Número de Ticket Sequencial
    const lastTicket = await (prisma as any).benefitTicket.findFirst({
        orderBy: { code: "desc" }
    });
    const nextCode = (lastTicket?.code || 1000) + 1;
    const ticketNumber = `TK-${nextCode}`;

    // 6.5. Obter Usuário Padrão Responsável (Késia Miranda / DP)
    const defaultAssignee = await (prisma as any).user.findFirst({
        where: {
            OR: [
                { email: "dp@grupojvsserv.com.br" },
                { role: "COORD_RH" },
                { name: { contains: "Kesia", mode: "insensitive" } }
            ],
            isActive: true
        }
    });

    // 7. Criar Ticket no Banco de Dados
    const createdTicket = await (prisma as any).benefitTicket.create({
        data: {
            ticketNumber,
            typeId: detection.typeId,
            category: detection.category,
            title: `Pendência: ${detection.typeName} - ${finalEmployeeName}`,
            description: text,
            employeeId: employee?.id || null,
            employeeName: finalEmployeeName,
            employeeCpf: finalCpf,
            employeePhone: finalPhone,
            postoName,
            clientName,
            sourceGroupJid: params.groupPhone,
            sourceGroupName: params.groupName || "GRUPO DE BENEFÍCIOS JVS",
            requestedByPhone: params.senderPhone,
            requestedByName: params.senderName,
            sourceMessageId: params.messageId || null,
            assigneeId: defaultAssignee?.id || null,
            stage: "TRIAGEM_DP",
            status: "OPEN",
            priority: "MEDIUM",
            slaHours: detection.slaHours,
            dueAt
        }
    });

    // 8. Criar primeira anotação automática
    await (prisma as any).benefitTicketNote.create({
        data: {
            ticketId: createdTicket.id,
            userName: "Robô de Atendimento WhatsApp",
            content: `Ticket aberto automaticamente via mensagem no grupo "${params.groupName || 'GRUPO DE BENEFÍCIOS JVS'}" enviada por ${params.senderName} (${params.senderPhone}).\nResponsável Inicial: ${defaultAssignee?.name || 'Coordenação DP (Késia)'}.\nMensagem original: "${text}"`
        }
    });

    // 8.5. Notificar Késia no WhatsApp Particular sobre o novo chamado
    if (defaultAssignee?.phone) {
        const cleanKesiaPhone = defaultAssignee.phone.replace(/\D/g, "");
        const kesiaNotifyMsg = `🎫 *[NOVO CHAMADO DE BENEFÍCIOS ATRIBUÍDO A VOCÊ]* 🎫\n\n` +
            `Olá, *${defaultAssignee.name}*!\nUm novo chamado foi aberto no grupo e atribuído a você:\n\n` +
            `🔖 *Ticket:* #${ticketNumber}\n` +
            `👤 *Colaborador:* ${finalEmployeeName} ${maskedCpfStr ? `(CPF: ${maskedCpfStr})` : ""}\n` +
            `🏢 *Posto/Cliente:* ${postoName || clientName || "Geral"}\n` +
            `🏷️ *Tipo:* ${detection.typeName}\n` +
            `⏱️ *SLA:* até ${dueStr}\n` +
            `💬 *Solicitado por:* ${params.senderName}\n\n` +
            `👉 *Acesse o portal para tratar:* https://workforce-hub-henna.vercel.app/admin/tickets-beneficios`;

        try {
            await sendZapiRaw(cleanKesiaPhone, kesiaNotifyMsg);
        } catch (kErr) {
            console.error("[benefit-tickets] Erro ao avisar Késia no privado:", kErr);
        }
    }

    // 9. Resposta Oficial e Instantânea no Grupo
    const dueStr = formatDueEstimate(dueAt);
    const maskedCpfStr = finalCpf ? finalCpf.replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, "$1.***.***-$4") : "Não informado";

    const replyText = `🎫 *[CHAMADO REGISTRADO COM SUCESSO]* 🎫\n\n` +
        `Olá, *${params.senderName}*! Sua solicitação foi recebida e registrada em nosso sistema:\n\n` +
        `🔖 *Número do Ticket:* #${ticketNumber}\n` +
        `👤 *Colaborador:* ${finalEmployeeName}\n` +
        `📄 *CPF:* ${maskedCpfStr}\n` +
        (postoName ? `📍 *Posto:* ${postoName}\n` : "") +
        `📌 *Assunto:* ${detection.typeName}\n` +
        `⏱️ *Previsão de Retorno (SLA):* até ${dueStr} (${detection.slaHours}h úteis)\n` +
        `👩‍💼 *Responsável:* ${defaultAssignee?.name || "Késia Miranda (Coord. DP)"}\n\n` +
        `_Assim que a verificação ou recarga for efetuada, o encerramento com o comprovante será notificado aqui no grupo._ ✅`;

    return { handled: true, replyText };
}
