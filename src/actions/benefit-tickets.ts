"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendZapiRaw } from "@/lib/rh-notifications";
import { calculateBusinessDueAt } from "@/lib/business-days";

export interface BenefitTicketTypeItem {
    id: string;
    name: string;
    category: string;
    slaHours: number;
    color: string;
    keywords: string[];
    isActive: boolean;
}

export interface BenefitTicketItem {
    id: string;
    code: number;
    ticketNumber: string;
    typeId: string | null;
    typeName?: string;
    typeColor?: string;
    category: string;
    title: string;
    description: string | null;
    employeeId: string | null;
    employeeName: string;
    employeeCpf: string | null;
    employeePhone: string | null;
    postoName: string | null;
    clientName: string | null;
    sourceGroupJid: string;
    sourceGroupName: string | null;
    requestedByPhone: string | null;
    requestedByName: string | null;
    sourceMessageId: string | null;
    assigneeId: string | null;
    assigneeName?: string | null;
    stage: string;
    status: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    slaHours: number;
    dueAt: string;
    resolvedAt: string | null;
    resolvedByUserName?: string | null;
    resolutionNotes: string | null;
    resolutionNotifiedAt: string | null;
    hrTicketId: string | null;
    createdAt: string;
    updatedAt: string;
    notesCount: number;
    attachmentsCount: number;
    isOverdue: boolean;
    remainingHours: number;
}

/** 1. Listar Tipos de Chamados de Benefícios */
export async function getBenefitTicketTypes(): Promise<BenefitTicketTypeItem[]> {
    const types = await (prisma as any).benefitTicketType.findMany({
        orderBy: { name: "asc" }
    });
    return types.map((t: any) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        slaHours: t.slaHours,
        color: t.color,
        keywords: t.keywords || [],
        isActive: t.isActive
    }));
}

/** 2. Salvar / Criar Tipo de Chamado de Benefício */
export async function saveBenefitTicketType(data: {
    id?: string;
    name: string;
    category: string;
    slaHours: number;
    color: string;
    keywords: string[];
    isActive: boolean;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    if (data.id) {
        await (prisma as any).benefitTicketType.update({
            where: { id: data.id },
            data: {
                name: data.name,
                category: data.category,
                slaHours: Number(data.slaHours),
                color: data.color,
                keywords: data.keywords,
                isActive: data.isActive,
                updatedAt: new Date()
            }
        });
    } else {
        await (prisma as any).benefitTicketType.create({
            data: {
                name: data.name,
                category: data.category,
                slaHours: Number(data.slaHours),
                color: data.color,
                keywords: data.keywords,
                isActive: data.isActive
            }
        });
    }

    revalidatePath("/admin/tickets-beneficios");
    return { success: true };
}

/** 3. Obter Tickets e Métricas/KPIs */
export async function getBenefitTickets(params?: {
    status?: string;
    category?: string;
    search?: string;
    page?: number;
    pageSize?: number;
}) {
    const now = new Date();
    const where: any = {};

    if (params?.status && params.status !== "ALL") {
        where.status = params.status;
    }
    if (params?.category && params.category !== "ALL") {
        where.category = params.category;
    }
    if (params?.search) {
        const q = params.search.trim();
        where.OR = [
            { ticketNumber: { contains: q, mode: "insensitive" } },
            { employeeName: { contains: q, mode: "insensitive" } },
            { employeeCpf: { contains: q } },
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } }
        ];
    }

    const [tickets, totalCount, allTicketsForKpi] = await Promise.all([
        (prisma as any).benefitTicket.findMany({
            where,
            include: {
                type: true,
                assignee: { select: { id: true, name: true, phone: true } },
                resolvedByUser: { select: { name: true } },
                _count: { select: { notes: true, attachments: true } }
            },
            orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }]
        }),
        (prisma as any).benefitTicket.count({ where }),
        (prisma as any).benefitTicket.findMany({
            select: {
                id: true,
                status: true,
                category: true,
                slaHours: true,
                dueAt: true,
                createdAt: true,
                resolvedAt: true,
                clientName: true
            }
        })
    ]);

    // Cálculo dos Indicadores (KPIs)
    let totalOpen = 0;
    let totalInProgress = 0;
    let totalResolved = 0;
    let totalOverdue = 0;
    let sumResolutionHours = 0;
    let resolvedCountWithTime = 0;

    const categoryCounts: Record<string, number> = {
        VT: 0,
        VA: 0,
        ASSIDUIDADE: 0,
        AJUDA_CUSTO: 0,
        OUTROS: 0
    };

    const clientCounts: Record<string, number> = {};

    for (const t of allTicketsForKpi) {
        if (t.status === "OPEN") totalOpen++;
        else if (t.status === "IN_PROGRESS") totalInProgress++;
        else if (t.status === "RESOLVED") totalResolved++;

        if ((t.status === "OPEN" || t.status === "IN_PROGRESS") && new Date(t.dueAt) < now) {
            totalOverdue++;
        }

        if (t.category && categoryCounts[t.category] !== undefined) {
            categoryCounts[t.category]++;
        } else if (t.category) {
            categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
        }

        if (t.clientName) {
            clientCounts[t.clientName] = (clientCounts[t.clientName] || 0) + 1;
        }

        if (t.status === "RESOLVED" && t.resolvedAt) {
            const hours = (new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60);
            if (hours >= 0) {
                sumResolutionHours += hours;
                resolvedCountWithTime++;
            }
        }
    }

    const avgResolutionHours = resolvedCountWithTime > 0
        ? Math.round((sumResolutionHours / resolvedCountWithTime) * 10) / 10
        : 0;

    const formattedTickets: BenefitTicketItem[] = tickets.map((t: any) => {
        const dueDate = new Date(t.dueAt);
        const isOverdue = (t.status === "OPEN" || t.status === "IN_PROGRESS") && dueDate < now;
        const remainingHours = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60));

        return {
            id: t.id,
            code: t.code,
            ticketNumber: t.ticketNumber,
            typeId: t.typeId,
            typeName: t.type?.name || t.category,
            typeColor: t.type?.color || "#3b82f6",
            category: t.category,
            title: t.title,
            description: t.description,
            employeeId: t.employeeId,
            employeeName: t.employeeName,
            employeeCpf: t.employeeCpf,
            employeePhone: t.employeePhone,
            postoName: t.postoName,
            clientName: t.clientName,
            sourceGroupJid: t.sourceGroupJid,
            sourceGroupName: t.sourceGroupName,
            requestedByPhone: t.requestedByPhone,
            requestedByName: t.requestedByName,
            sourceMessageId: t.sourceMessageId,
            assigneeId: t.assigneeId,
            assigneeName: t.assignee?.name || "Késia Miranda (Coord. DP)",
            stage: t.stage || "TRIAGEM_DP",
            status: t.status,
            priority: t.priority,
            slaHours: t.slaHours,
            dueAt: t.dueAt.toISOString(),
            resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
            resolvedByUserName: t.resolvedByUser?.name,
            resolutionNotes: t.resolutionNotes,
            resolutionNotifiedAt: t.resolutionNotifiedAt ? t.resolutionNotifiedAt.toISOString() : null,
            hrTicketId: t.hrTicketId,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
            notesCount: t._count.notes,
            attachmentsCount: t._count.attachments,
            isOverdue,
            remainingHours
        };
    });

    return {
        tickets: formattedTickets,
        totalCount,
        kpis: {
            totalTickets: allTicketsForKpi.length,
            totalOpen,
            totalInProgress,
            totalResolved,
            totalOverdue,
            avgResolutionHours,
            categoryCounts,
            clientRecurrence: Object.entries(clientCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count]) => ({ name, count }))
        }
    };
}

/** 4. Obter Detalhes Completos de um Ticket (Anotações, Anexos, Chat) */
export async function getBenefitTicketDetails(ticketId: string) {
    const ticket = await (prisma as any).benefitTicket.findUnique({
        where: { id: ticketId },
        include: {
            type: true,
            assignee: { select: { id: true, name: true, phone: true, role: true } },
            resolvedByUser: { select: { id: true, name: true, email: true } },
            notes: {
                orderBy: { createdAt: "desc" },
                include: { user: { select: { name: true } } }
            },
            attachments: {
                orderBy: { createdAt: "desc" },
                include: { uploadedBy: { select: { name: true } } }
            },
            hrTicket: {
                include: {
                    messages: {
                        orderBy: { createdAt: "asc" },
                        take: 50
                    }
                }
            }
        }
    });

    if (!ticket) return null;

    return {
        ...ticket,
        dueAt: ticket.dueAt.toISOString(),
        resolvedAt: ticket.resolvedAt?.toISOString() || null,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        notes: ticket.notes.map((n: any) => ({
            ...n,
            createdAt: n.createdAt.toISOString()
        })),
        attachments: ticket.attachments.map((a: any) => ({
            ...a,
            createdAt: a.createdAt.toISOString()
        })),
        chatMessages: (ticket.hrTicket?.messages || []).map((m: any) => ({
            id: m.id,
            senderType: m.senderType,
            senderName: m.senderName,
            content: m.content,
            mediaUrl: m.mediaUrl,
            mediaFileName: m.mediaFileName,
            createdAt: m.createdAt.toISOString()
        }))
    };
}

/** 5. Adicionar Anotação Interna no Ticket */
export async function addBenefitTicketNote(ticketId: string, content: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const note = await (prisma as any).benefitTicketNote.create({
        data: {
            ticketId,
            userId: user.id,
            userName: user.name || "Equipe Benefícios",
            content: content.trim()
        }
    });

    revalidatePath(`/admin/tickets-beneficios`);
    return { success: true, note };
}

/** 6. Fazer Upload de Comprovante / Anexo no Ticket */
export async function addBenefitTicketAttachment(data: {
    ticketId: string;
    fileName: string;
    fileUrl: string;
    mimeType?: string;
    isProofOfResolution?: boolean;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const attachment = await (prisma as any).benefitTicketAttachment.create({
        data: {
            ticketId: data.ticketId,
            fileName: data.fileName,
            fileUrl: data.fileUrl,
            mimeType: data.mimeType || "application/octet-stream",
            uploadedById: user.id,
            uploadedByName: user.name || "Equipe Benefícios",
            isProofOfResolution: !!data.isProofOfResolution
        }
    });

    revalidatePath(`/admin/tickets-beneficios`);
    return { success: true, attachment };
}

/** 7. Enviar Mensagem no WhatsApp do Colaborador (Chat dentro do Card) */
export async function sendBenefitTicketChatMessage(ticketId: string, messageText: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const ticket = await (prisma as any).benefitTicket.findUnique({
        where: { id: ticketId },
        include: { employee: true, hrTicket: true }
    });

    if (!ticket) throw new Error("Ticket não encontrado");

    const phone = ticket.employeePhone || ticket.employee?.phone;
    if (!phone) throw new Error("Colaborador não possui telefone cadastrado");

    // 1. Garantir que existe HrTicket vinculado
    let hrTicketId = ticket.hrTicketId;
    if (!hrTicketId) {
        // Obter estágio padrão
        const defaultStage = await (prisma as any).hrPipelineStage.findFirst({
            where: { name: { contains: "Atendimento", mode: "insensitive" } }
        }) || await (prisma as any).hrPipelineStage.findFirst();

        const cleanPhone = phone.replace(/\D/g, "");
        const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

        const createdHr = await (prisma as any).hrTicket.create({
            data: {
                title: `Benefícios: ${ticket.employeeName}`,
                employeeId: ticket.employeeId,
                contactPhone: formattedPhone,
                contactName: ticket.employeeName,
                stageId: defaultStage?.id || "d87570c7-64a5-4b0d-8d95-da51d8cf04a2",
                assigneeId: user.id,
                status: "OPEN"
            }
        });
        hrTicketId = createdHr.id;

        await (prisma as any).benefitTicket.update({
            where: { id: ticketId },
            data: { hrTicketId }
        });
    }

    // 2. Disparar via Z-API
    const sendRes = await sendZapiRaw(phone, messageText);
    if (!sendRes.success) {
        throw new Error(sendRes.error || "Falha ao enviar mensagem pelo WhatsApp");
    }

    // 3. Gravar na tabela de mensagens do Atendimento
    await (prisma as any).hrTicketMessage.create({
        data: {
            ticketId: hrTicketId,
            senderType: "ATTENDANT",
            senderName: user.name || "Benefícios JVS",
            content: messageText,
            status: "SENT",
            zapiMessageId: sendRes.zapiId || null
        }
    });

    revalidatePath(`/admin/tickets-beneficios`);
    return { success: true };
}

/** 8. Baixar / Concluir Ticket com Solução e Disparo Automático no Grupo */
export async function resolveBenefitTicket(data: {
    ticketId: string;
    resolutionNotes: string;
    notifyGroup: boolean;
    proofFileUrl?: string;
    proofFileName?: string;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const ticket = await (prisma as any).benefitTicket.findUnique({
        where: { id: data.ticketId }
    });
    if (!ticket) throw new Error("Ticket não encontrado");

    const resolvedAt = new Date();

    // 1. Atualizar o Ticket
    await (prisma as any).benefitTicket.update({
        where: { id: data.ticketId },
        data: {
            status: "RESOLVED",
            resolvedAt,
            resolvedByUserId: user.id,
            resolutionNotes: data.resolutionNotes.trim(),
            resolutionNotifiedAt: data.notifyGroup ? resolvedAt : null,
            updatedAt: resolvedAt
        }
    });

    // 2. Adicionar comprovante de resolução se houver
    if (data.proofFileUrl && data.proofFileName) {
        await (prisma as any).benefitTicketAttachment.create({
            data: {
                ticketId: data.ticketId,
                fileName: data.proofFileName,
                fileUrl: data.proofFileUrl,
                mimeType: "application/pdf",
                uploadedById: user.id,
                uploadedByName: user.name || "Benefícios JVS",
                isProofOfResolution: true
            }
        });
    }

    // 3. Adicionar anotação interna registrando o encerramento
    await (prisma as any).benefitTicketNote.create({
        data: {
            ticketId: data.ticketId,
            userId: user.id,
            userName: user.name || "Benefícios JVS",
            content: `🔒 Chamado concluído e baixado por ${user.name}.\nSolução: ${data.resolutionNotes}`
        }
    });

    // 4. Disparar Mensagem Automática no Grupo com a Solução
    if (data.notifyGroup && ticket.sourceGroupJid) {
        const maskCpf = ticket.employeeCpf ? ticket.employeeCpf.replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, "$1.***.***-$4") : "";
        const groupMsg = `✅ *[SOLICITAÇÃO DE BENEFÍCIOS RESOLVIDA]* ✅\n\n` +
            `🎫 *Ticket:* #${ticket.ticketNumber}\n` +
            `👤 *Colaborador:* ${ticket.employeeName} ${maskCpf ? `(${maskCpf})` : ""}\n` +
            `🏢 *Posto/Cliente:* ${ticket.postoName || ticket.clientName || "Geral"}\n` +
            `🏷️ *Tipo:* ${ticket.title}\n` +
            `👨‍💻 *Atendido por:* ${user.name || "Equipe de Benefícios"}\n\n` +
            `📝 *Parecer / Solução:* \n${data.resolutionNotes.trim()}\n\n` +
            `👉 *Status:* CONCLUÍDO E BAIXADO NO SISTEMA.`;

        try {
            await sendZapiRaw(ticket.sourceGroupJid, groupMsg);
        } catch (sendErr) {
            console.error("[resolveBenefitTicket] Erro ao notificar grupo:", sendErr);
        }
    }

    revalidatePath(`/admin/tickets-beneficios`);
    return { success: true };
}

/** 9. Alterar Status de Ticket Manualmente pelo Operador */
export async function updateBenefitTicketStatus(ticketId: string, status: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const ticket = await (prisma as any).benefitTicket.findUnique({
        where: { id: ticketId }
    });
    if (!ticket) throw new Error("Ticket não encontrado");

    await (prisma as any).benefitTicket.update({
        where: { id: ticketId },
        data: {
            status,
            updatedAt: new Date()
        }
    });

    await (prisma as any).benefitTicketNote.create({
        data: {
            ticketId,
            userId: user.id,
            userName: user.name || "Sistema",
            content: `🔄 Status do chamado alterado para "${status}" por ${user.name}.`
        }
    });

    revalidatePath(`/admin/tickets-beneficios`);
    return { success: true };
}

/** 9.1. Alterar Tipo/Motivo e SLA de Ticket Manualmente pelo Operador */
export async function updateBenefitTicketTypeAndSla(data: {
    ticketId: string;
    typeId: string;
    slaHours?: number;
    reason?: string;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const [ticket, typeObj] = await Promise.all([
        (prisma as any).benefitTicket.findUnique({ where: { id: data.ticketId } }),
        (prisma as any).benefitTicketType.findUnique({ where: { id: data.typeId } })
    ]);

    if (!ticket) throw new Error("Ticket não encontrado");
    if (!typeObj) throw new Error("Tipo de benefício não encontrado");

    const slaHours = data.slaHours && data.slaHours > 0 ? Number(data.slaHours) : typeObj.slaHours || 24;
    const createdAt = new Date(ticket.createdAt);
    const cityGuess = ticket.clientName || ticket.postoName || "Curitiba";
    const newDueAt = await calculateBusinessDueAt(createdAt, slaHours, cityGuess);

    await (prisma as any).benefitTicket.update({
        where: { id: data.ticketId },
        data: {
            typeId: typeObj.id,
            category: typeObj.category,
            title: `Pendência: ${typeObj.name} - ${ticket.employeeName}`,
            slaHours,
            dueAt: newDueAt,
            updatedAt: new Date()
        }
    });

    await (prisma as any).benefitTicketNote.create({
        data: {
            ticketId: data.ticketId,
            userId: user.id,
            userName: user.name || "Sistema",
            content: `✏️ Tipo/Motivo do chamado reclassificado para "${typeObj.name}" (SLA ajustado para ${slaHours}h) por ${user.name}.${data.reason ? `\nMotivo: ${data.reason}` : ""}`
        }
    });

    revalidatePath(`/admin/tickets-beneficios`);
    return { success: true };
}

/** 9.2. Obter Status Configuráveis */
export async function getBenefitTicketStatusList() {
    try {
        const statuses = await (prisma as any).benefitTicketStatusConfig.findMany({
            where: { isActive: true },
            orderBy: { order: "asc" }
        });

        if (statuses.length > 0) return statuses;
    } catch (e) {
        // Tabela ainda criando ou primeira migração
    }

    // Default Fallbacks
    return [
        { id: "s1", code: "OPEN", name: "Aberto", color: "#3b82f6", order: 1, isDefault: true },
        { id: "s2", code: "IN_PROGRESS", name: "Em Atendimento (DP)", color: "#f59e0b", order: 2, isDefault: false },
        { id: "s3", code: "WAITING_PAYMENT", name: "Aguardando Pagamento (Financeiro)", color: "#8b5cf6", order: 3, isDefault: false },
        { id: "s4", code: "RESOLVED", name: "Concluído", color: "#10b981", order: 4, isDefault: false },
        { id: "s5", code: "CANCELLED", name: "Cancelado", color: "#ef4444", order: 5, isDefault: false }
    ];
}

/** 9.3. Salvar ou Criar Novo Status Configurável */
export async function saveBenefitTicketStatusConfig(data: {
    id?: string;
    code: string;
    name: string;
    color: string;
    order: number;
    isActive?: boolean;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    if (data.id) {
        await (prisma as any).benefitTicketStatusConfig.update({
            where: { id: data.id },
            data: {
                name: data.name,
                color: data.color,
                order: Number(data.order),
                isActive: data.isActive ?? true,
                updatedAt: new Date()
            }
        });
    } else {
        await (prisma as any).benefitTicketStatusConfig.create({
            data: {
                code: data.code.toUpperCase().trim().replace(/\s+/g, "_"),
                name: data.name,
                color: data.color,
                order: Number(data.order),
                isActive: data.isActive ?? true
            }
        });
    }

    revalidatePath("/admin/tickets-beneficios");
    return { success: true };
}

/** 10. Transferir Ticket para o Financeiro ou Outro Responsável com Notificação no WhatsApp Particular */
export async function transferBenefitTicket(data: {
    ticketId: string;
    targetUserId: string;
    transferReason?: string;
    targetStage?: "TRIAGEM_DP" | "AGUARDANDO_FINANCEIRO";
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const [ticket, targetUser] = await Promise.all([
        (prisma as any).benefitTicket.findUnique({
            where: { id: data.ticketId }
        }),
        (prisma as any).user.findUnique({
            where: { id: data.targetUserId }
        })
    ]);

    if (!ticket) throw new Error("Ticket não encontrado");
    if (!targetUser) throw new Error("Usuário de destino não encontrado");

    const stage = data.targetStage || "AGUARDANDO_FINANCEIRO";
    const reasonText = data.transferReason?.trim() || "Solicitação de pagamento / recarga financeira";

    // 1. Atualizar Ticket no banco
    await (prisma as any).benefitTicket.update({
        where: { id: data.ticketId },
        data: {
            assigneeId: targetUser.id,
            stage,
            status: "IN_PROGRESS",
            updatedAt: new Date()
        }
    });

    // 2. Registrar Anotação Interna
    await (prisma as any).benefitTicketNote.create({
        data: {
            ticketId: data.ticketId,
            userId: user.id,
            userName: user.name || "Sistema",
            content: `🔀 Chamado transferido por ${user.name} para ${targetUser.name} (${stage === "AGUARDANDO_FINANCEIRO" ? "Financeiro" : "DP"}).\nMotivo: ${reasonText}`
        }
    });

    // 3. Notificar o Responsável no WhatsApp Particular
    if (targetUser.phone) {
        const cleanPhone = targetUser.phone.replace(/\D/g, "");
        if (cleanPhone.length >= 10) {
            const maskCpf = ticket.employeeCpf ? ticket.employeeCpf.replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, "$1.***.***-$4") : "";
            const msg = `🔔 *[WORKFORCE HUB - CHAMADO DE BENEFÍCIOS TRANSFERIDO]* 🔔\n\n` +
                `Olá, *${targetUser.name}*!\n` +
                `*${user.name}* transferiu um chamado de benefícios para sua responsabilidade:\n\n` +
                `🎫 *Ticket:* #${ticket.ticketNumber}\n` +
                `👤 *Colaborador:* ${ticket.employeeName} ${maskCpf ? `(${maskCpf})` : ""}\n` +
                `🏢 *Posto/Cliente:* ${ticket.postoName || ticket.clientName || "Geral"}\n` +
                `🏷️ *Tipo:* ${ticket.title}\n` +
                `📌 *Etapa:* ${stage === "AGUARDANDO_FINANCEIRO" ? "Aguardando Pagamento Financeiro" : "Análise DP"}\n` +
                `💬 *Instrução / Recarga:* ${reasonText}\n\n` +
                `👉 *Acesse para baixar e anexar o comprovante:* https://workforce-hub-henna.vercel.app/admin/tickets-beneficios`;

            try {
                await sendZapiRaw(cleanPhone, msg);
            } catch (pErr) {
                console.error("[transferBenefitTicket] Erro ao enviar WhatsApp particular:", pErr);
            }
        }
    }

    revalidatePath(`/admin/tickets-beneficios`);
    return { success: true };
}

/** 11. Buscar Lista de Usuários Habilitados para Atribuição / Financeiro */
export async function getBenefitAssignableUsers() {
    try {
        const users = await (prisma as any).user.findMany({
            where: {
                isActive: true,
                role: { in: ["ADMIN", "COORD_RH", "ASSIST_RH"] }
            },
            select: {
                id: true,
                name: true,
                phone: true,
                role: true,
                email: true
            },
            orderBy: { name: "asc" }
        });

        return users || [];
    } catch (err) {
        console.error("[getBenefitAssignableUsers] Erro ao buscar usuários:", err);
        return [];
    }
}
