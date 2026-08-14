"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID || "3F1993DFB59E83474F059E648AE68DF9";
const ZAPI_TOKEN = process.env.ZAPI_TOKEN || "81087A6B5C1CAB8AAAC801C4";
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || "F5c1b8f27f6b049c98c4e779d00f67552S";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function zapiHeaders() {
    return {
        "Content-Type": "application/json",
        "Client-Token": ZAPI_CLIENT_TOKEN,
    };
}

/** Busca foto de perfil do WhatsApp via Z-API */
async function fetchZapiProfilePic(phone: string): Promise<string | null> {
    try {
        const cleanPhone = phone.replace(/\D/g, "");
        const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
        const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/profile-picture?phone=${finalPhone}`;
        const res = await fetch(url, { headers: zapiHeaders(), next: { revalidate: 0 } });
        if (!res.ok) return null;
        const data = await res.json();
        // Z-API retorna a chave "link" com a URL da foto no WhatsApp
        if (data.link && data.link !== "null") return data.link;
        return data.profilePictureUrl || data.picture || data.url || null;
    } catch {
        return null;
    }
}


/** Busca nome do contato no WhatsApp via Z-API */
async function fetchZapiContactName(phone: string): Promise<string | null> {
    try {
        const cleanPhone = phone.replace(/\D/g, "");
        const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
        const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/contacts/${finalPhone}`;
        const res = await fetch(url, { headers: zapiHeaders(), next: { revalidate: 0 } });
        if (!res.ok) return null;
        const data = await res.json();
        return data.name || data.pushName || null;
    } catch {
        return null;
    }
}

// ─── CONTROLE DE ACESSO ──────────────────────────────────────────────────────

export async function checkHrAttendanceAccess() {
    const user = await getCurrentUser();
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    const perm = await prisma.hrAccessPermission.findUnique({ where: { userId: user.id } });
    return !!perm;
}

export async function getHrAccessPermissions() {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") return { error: "Sem permissão" };
    const users = await prisma.user.findMany({
        where: { isActive: true, role: { not: "CLIENTE" } },
        select: {
            id: true, name: true, username: true, role: true,
            hrAccessPermission: { select: { id: true } },
        },
        orderBy: { name: "asc" },
    });
    return { users };
}

export async function toggleHrAccessPermission(targetUserId: string) {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") return { error: "Sem permissão" };

    const existing = await prisma.hrAccessPermission.findUnique({ where: { userId: targetUserId } });
    if (existing) {
        await prisma.hrAccessPermission.delete({ where: { userId: targetUserId } });
        return { granted: false };
    } else {
        await prisma.hrAccessPermission.create({ data: { userId: targetUserId } });
        return { granted: true };
    }
}

// ─── PIPELINE ────────────────────────────────────────────────────────────────

export async function getHrPipelineStages() {
    return prisma.hrPipelineStage.findMany({ orderBy: { order: "asc" } });
}

export async function saveHrPipelineStages(stages: { id?: string; name: string; color: string; order: number; isDefault?: boolean }[]) {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "COORD_RH"].includes(user.role)) return { error: "Sem permissão" };

    // Upsert each stage
    for (const s of stages) {
        if (s.id) {
            await prisma.hrPipelineStage.update({
                where: { id: s.id },
                data: { name: s.name, color: s.color, order: s.order, isDefault: s.isDefault ?? false },
            });
        } else {
            await prisma.hrPipelineStage.create({
                data: { name: s.name, color: s.color, order: s.order, isDefault: s.isDefault ?? false },
            });
        }
    }
    revalidatePath("/admin/atendimento");
    return { success: true };
}

export async function deleteHrPipelineStage(stageId: string) {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "COORD_RH"].includes(user.role)) return { error: "Sem permissão" };
    // Move tickets da etapa para primeira etapa disponível
    const firstStage = await prisma.hrPipelineStage.findFirst({
        where: { id: { not: stageId } }, orderBy: { order: "asc" },
    });
    if (firstStage) {
        await prisma.hrTicket.updateMany({ where: { stageId }, data: { stageId: firstStage.id } });
    }
    await prisma.hrPipelineStage.delete({ where: { id: stageId } });
    revalidatePath("/admin/atendimento");
    return { success: true };
}

// ─── ETIQUETAS ────────────────────────────────────────────────────────────────

export async function getHrLabels() {
    return prisma.hrTicketLabel.findMany({ orderBy: { name: "asc" } });
}

export async function createHrLabel(data: { name: string; color: string }) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };
    const label = await prisma.hrTicketLabel.create({ data });
    revalidatePath("/admin/atendimento");
    return { label };
}

export async function updateHrLabel(id: string, data: { name?: string; color?: string }) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };
    const label = await prisma.hrTicketLabel.update({ where: { id }, data });
    revalidatePath("/admin/atendimento");
    return { label };
}

export async function deleteHrLabel(id: string) {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "COORD_RH"].includes(user.role)) return { error: "Sem permissão" };
    await prisma.hrTicketLabel.delete({ where: { id } });
    revalidatePath("/admin/atendimento");
    return { success: true };
}

// ─── TICKETS ─────────────────────────────────────────────────────────────────

// ─── TICKETS ─────────────────────────────────────────────────────────────────

export async function getHrTickets(filters?: {
    stageId?: string;
    labelId?: string;
    status?: string;
    assigneeId?: string;
    search?: string;
    filterMode?: "my" | "unassigned" | "all" | "closed" | "groups";
}) {
    const user = await getCurrentUser();
    if (!user) return [];
    const isAdmin = user.role === "ADMIN";

    const where: Record<string, unknown> = {};
    if (filters?.stageId) where.stageId = filters.stageId;
    
    // Status filter
    if (filters?.filterMode === "closed") {
        where.status = "CLOSED";
    } else if (filters?.status) {
        where.status = filters.status;
    } else {
        where.status = "OPEN";
    }

    // Filter mode
    if (filters?.filterMode === "my") {
        where.assigneeId = user.id;
    } else if (filters?.filterMode === "unassigned") {
        where.assigneeId = null;
    } else if (filters?.filterMode === "groups") {
        where.OR = [
            { contactPhone: { contains: "-group" } },
            { contactName: { contains: "grupo", mode: "insensitive" } },
            { contactName: { contains: "rh -", mode: "insensitive" } },
            { title: { contains: "grupo", mode: "insensitive" } }
        ];
    }

    if (filters?.labelId) where.labels = { some: { id: filters.labelId } };

    // Visibilidade: tickets privados só aparecem para o atendente responsável (ou admin)
    if (!isAdmin && filters?.filterMode !== "unassigned") {
        const visibilityConditions = [
            { isPrivate: false },
            { assigneeId: user.id },
            { participantIds: { has: user.id } },
        ];
        if (where.OR) {
            where.AND = [{ OR: where.OR }, { OR: visibilityConditions }];
            delete where.OR;
        } else {
            where.OR = visibilityConditions;
        }
    }

    if (filters?.search) {
        const searchConditions = [
            { contactName: { contains: filters.search, mode: "insensitive" } },
            { contactPhone: { contains: filters.search } },
            { title: { contains: filters.search, mode: "insensitive" } },
            { employee: { name: { contains: filters.search, mode: "insensitive" } } },
            { employee: { cpf: { contains: filters.search } } }
        ];
        if (where.AND) {
            (where.AND as any[]).push({ OR: searchConditions });
        } else if (where.OR) {
            where.AND = [{ OR: where.OR }, { OR: searchConditions }];
            delete where.OR;
        } else {
            where.OR = searchConditions;
        }
    }

    return prisma.hrTicket.findMany({
        where,
        include: {
            stage: true,
            assignee: { select: { id: true, name: true, username: true } },
            labels: true,
            employee: {
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    cpf: true,
                    salary: true,
                    admissionDate: true,
                    role: { select: { name: true } },
                    company: { select: { name: true } }
                }
            },
            messages: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { content: true, createdAt: true, senderType: true, senderName: true, status: true },
            },
            _count: {
                select: {
                    messages: true,
                    notes: true,
                    activities: true,
                    attachments: true
                }
            },
        },
        orderBy: { updatedAt: "desc" },
    });
}

export async function getHrTicketDetail(ticketId: string) {
    const user = await getCurrentUser();
    if (!user) return null;

    const ticket = await prisma.hrTicket.findUnique({
        where: { id: ticketId },
        include: {
            stage: true,
            assignee: { select: { id: true, name: true, username: true } },
            labels: true,
            employee: {
                include: {
                    role: true,
                    company: true,
                    situation: true,
                    assignments: {
                        where: { endDate: null },
                        include: {
                            posto: {
                                include: { client: true }
                            }
                        },
                        take: 1
                    }
                }
            },
            messages: { orderBy: { createdAt: "asc" } },
            notes: {
                include: { author: { select: { id: true, name: true } } },
                orderBy: { createdAt: "desc" },
            },
            attachments: {
                include: { uploadedBy: { select: { id: true, name: true } } },
                orderBy: { createdAt: "desc" },
            },
            activities: {
                include: { assignee: { select: { id: true, name: true } } },
                orderBy: { dueAt: "asc" },
            },
            scheduledMsgs: { where: { status: "PENDING" }, orderBy: { scheduledAt: "asc" } },
            transfers: {
                include: {
                    fromUser: { select: { id: true, name: true } },
                    toUser: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
            },
        },
    });

    if (!ticket) return null;

    if (ticket && ticket.messages.length === 0) {
        // Se nao tem nenhuma mensagem no banco, consultar o Z-API (tratando grupos e chats normais)
        try {
            const isGroup = ticket.contactPhone.length > 13 || ticket.contactPhone.includes("120363") || ticket.title.toLowerCase().includes("grupo") || ticket.title.includes("Taxas");
            const phoneToQuery = isGroup ? (ticket.contactPhone.endsWith("-group") ? ticket.contactPhone : `${ticket.contactPhone}-group`) : ticket.contactPhone;

            const endpoint = isGroup ? `group-metadata/${phoneToQuery}` : `chats/${phoneToQuery}`;
            const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/${endpoint}`;
            const res = await fetch(url, { headers: zapiHeaders(), next: { revalidate: 0 } });
            
            let messageContent = "Atendimento iniciado via WhatsApp";

            if (res.ok) {
                const data = await res.json();
                if (isGroup && data) {
                    const count = data.participants ? data.participants.length : 0;
                    messageContent = `👥 [Grupo de WhatsApp]: ${data.subject || ticket.contactName} (${count} participantes)`;
                } else if (data && (data.lastMessage || data.name)) {
                    messageContent = data.lastMessage?.text?.message || data.lastMessage?.text || `Atendimento iniciado via WhatsApp com ${ticket.contactName}`;
                }
            }

            const initialMsg = await prisma.hrTicketMessage.create({
                data: {
                    ticketId: ticket.id,
                    senderType: "EMPLOYEE",
                    senderName: ticket.contactName,
                    content: messageContent,
                    status: "DELIVERED"
                }
            });
            ticket.messages = [initialMsg as any];
        } catch (e) {
            console.error("[Z-API Last Msg Error]", e);
        }
    }

    return ticket;
}


export async function updateContactInfo(ticketId: string, data: { name?: string; phone?: string }) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };

    const updateData: Record<string, string> = {};
    if (data.name) updateData.contactName = data.name;
    if (data.phone) updateData.contactPhone = data.phone;

    await prisma.hrTicket.update({ where: { id: ticketId }, data: updateData });
    revalidatePath("/admin/atendimento");
    return { success: true };
}

/** Atualiza foto de perfil e nome do contato via Z-API */

export async function refreshContactInfo(ticketId: string) {
    const ticket = await prisma.hrTicket.findUnique({ where: { id: ticketId }, select: { contactPhone: true } });
    if (!ticket) return;

    const [photoUrl, name] = await Promise.all([
        fetchZapiProfilePic(ticket.contactPhone),
        fetchZapiContactName(ticket.contactPhone),
    ]);

    const updateData: Record<string, string> = {};
    if (photoUrl) updateData.contactPhotoUrl = photoUrl;
    if (name) updateData.contactName = name;

    if (Object.keys(updateData).length > 0) {
        await prisma.hrTicket.update({ where: { id: ticketId }, data: updateData });
    }
}

export async function updateHrTicketStage(ticketId: string, stageId: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };
    await prisma.hrTicket.update({ where: { id: ticketId }, data: { stageId, updatedAt: new Date() } });
    revalidatePath("/admin/atendimento");
    return { success: true };
}

export async function updateHrTicketTitle(ticketId: string, title: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };
    await prisma.hrTicket.update({ where: { id: ticketId }, data: { title } });
    revalidatePath("/admin/atendimento");
    return { success: true };
}

export async function applyLabelToTicket(ticketId: string, labelId: string, apply: boolean) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };
    await prisma.hrTicket.update({
        where: { id: ticketId },
        data: {
            labels: apply ? { connect: { id: labelId } } : { disconnect: { id: labelId } },
        },
    });
    return { success: true };
}

export async function assumeHrTicket(ticketId: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };

    const ticket = await prisma.hrTicket.findUnique({
        where: { id: ticketId },
        include: { stage: true }
    });
    if (!ticket) return { error: "Atendimento não encontrado" };

    // Se estiver em INBOX ou etapa inicial, avançar automaticamente para 'Em Atendimento'
    let nextStageId = ticket.stageId;
    if (ticket.stage?.name?.toUpperCase() === "INBOX" || ticket.stage?.isDefault) {
        const inProgressStage = await prisma.hrPipelineStage.findFirst({
            where: {
                OR: [
                    { name: { contains: "Em Atendimento", mode: "insensitive" } },
                    { name: { contains: "Atendimento", mode: "insensitive" } },
                    { order: 1 }
                ]
            },
            orderBy: { order: "asc" }
        });
        if (inProgressStage) {
            nextStageId = inProgressStage.id;
        }
    }

    await prisma.hrTicket.update({
        where: { id: ticketId },
        data: {
            assigneeId: user.id,
            stageId: nextStageId,
            isPrivate: true,
            status: "OPEN",
            updatedAt: new Date()
        },
    });

    // Registrar evento de sistema no chat
    await prisma.hrTicketMessage.create({
        data: {
            ticketId,
            senderType: "SYSTEM",
            senderName: "Sistema",
            messageType: "SYSTEM",
            content: `🚀 ${user.name} iniciou o atendimento e assumiu a responsabilidade`,
            status: "DELIVERED"
        }
    });

    revalidatePath("/admin/atendimento");
    return { success: true };
}

export async function transferHrTicket(ticketId: string, toUserId: string, reason?: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };

    await prisma.$transaction([
        prisma.hrTicket.update({
            where: { id: ticketId },
            data: { assigneeId: toUserId, isPrivate: true, status: "OPEN", updatedAt: new Date() },
        }),
        prisma.hrTicketTransfer.create({
            data: { ticketId, fromUserId: user.id, toUserId, reason },
        }),
    ]);

    revalidatePath("/admin/atendimento");
    return { success: true };
}

export async function addParticipantToTicket(ticketId: string, userId: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };
    const ticket = await prisma.hrTicket.findUnique({ where: { id: ticketId }, select: { participantIds: true } });
    if (!ticket) return { error: "Ticket não encontrado" };
    const ids = ticket.participantIds.includes(userId)
        ? ticket.participantIds
        : [...ticket.participantIds, userId];
    await prisma.hrTicket.update({ where: { id: ticketId }, data: { participantIds: ids } });
    revalidatePath("/admin/atendimento");
    return { success: true };
}

export async function removeParticipantFromTicket(ticketId: string, userId: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };
    const ticket = await prisma.hrTicket.findUnique({ where: { id: ticketId }, select: { participantIds: true } });
    if (!ticket) return { error: "Ticket não encontrado" };
    const ids = ticket.participantIds.filter(id => id !== userId);
    await prisma.hrTicket.update({ where: { id: ticketId }, data: { participantIds: ids } });
    revalidatePath("/admin/atendimento");
    return { success: true };
}

export async function closeHrTicket(ticketId: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };
    await prisma.hrTicket.update({
        where: { id: ticketId },
        data: { status: "CLOSED", closedAt: new Date(), isPrivate: false, updatedAt: new Date() },
    });
    // Adiciona mensagem de sistema
    await prisma.hrTicketMessage.create({
        data: {
            ticketId,
            senderType: "SYSTEM",
            senderName: "Sistema",
            content: `Atendimento encerrado por ${user.name}`,
            status: "SENT",
        },
    });
    revalidatePath("/admin/atendimento");
    return { success: true };
}

export async function closeHrTicketWithReason(ticketId: string, data: { reason?: string; resolutionNote?: string }) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };

    const reasonText = data.reason ? `Motivo: ${data.reason}` : "";
    const noteText = data.resolutionNote ? ` | Nota: ${data.resolutionNote}` : "";
    const content = `🔒 Atendimento encerrado por ${user.name} (${reasonText}${noteText})`;

    await prisma.$transaction([
        prisma.hrTicket.update({
            where: { id: ticketId },
            data: { status: "CLOSED", closedAt: new Date(), isPrivate: false, updatedAt: new Date() },
        }),
        prisma.hrTicketMessage.create({
            data: {
                ticketId,
                senderType: "SYSTEM",
                senderName: "Sistema",
                content,
                status: "SENT",
            },
        }),
        ...(data.resolutionNote ? [
            prisma.hrTicketNote.create({
                data: {
                    ticketId,
                    content: `[Resolução de Encerramento] ${data.reason ? `(${data.reason}) ` : ""}${data.resolutionNote}`,
                    authorId: user.id
                }
            })
        ] : [])
    ]);

    revalidatePath("/admin/atendimento");
    return { success: true };
}

export async function reopenHrTicket(ticketId: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };

    await prisma.$transaction([
        prisma.hrTicket.update({
            where: { id: ticketId },
            data: { status: "OPEN", closedAt: null, updatedAt: new Date() },
        }),
        prisma.hrTicketMessage.create({
            data: {
                ticketId,
                senderType: "SYSTEM",
                senderName: "Sistema",
                content: `🔓 Atendimento reaberto por ${user.name}`,
                status: "SENT",
            },
        })
    ]);

    revalidatePath("/admin/atendimento");
    return { success: true };
}

// ─── MENSAGENS ────────────────────────────────────────────────────────────────

export async function sendHrWhatsAppMessage(data: {
    ticketId: string;
    phone: string;
    message: string;
    stamp?: string;
}) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };

    const cleanPhone = data.phone.replace(/\D/g, "");
    const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    // Formatar mensagem com carimbo se houver
    let messageToSend = data.message;
    if (data.stamp) {
        messageToSend = `${data.stamp}\n\n${data.message}`;
    }

    let zapiMessageId: string | null = null;

    try {
        const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
        const res = await fetch(url, {
            method: "POST",
            headers: zapiHeaders(),
            body: JSON.stringify({ phone: finalPhone, message: messageToSend }),
        });
        if (res.ok) {
            const json = await res.json();
            zapiMessageId = json.zaapId || json.messageId || json.id || null;
        }
    } catch (e) {
        console.error("[HR sendMessage] Z-API error:", e);
    }

    const saved = await prisma.hrTicketMessage.create({
        data: {
            ticketId: data.ticketId,
            senderType: "ATTENDANT",
            senderName: user.name,
            messageType: "TEXT",
            content: data.message,
            status: zapiMessageId ? "SENT" : "FAILED",
            zapiMessageId,
        },
    });

    const ticket = await prisma.hrTicket.findUnique({ where: { id: data.ticketId } });
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (ticket && !ticket.assigneeId) {
        updateData.assigneeId = user.id;
    }
    await prisma.hrTicket.update({ where: { id: data.ticketId }, data: updateData });

    return { success: true, message: saved };
}

export async function sendHrWhatsAppFile(data: {
    ticketId: string;
    phone: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    caption?: string;
}) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };

    const cleanPhone = data.phone.replace(/\D/g, "");
    const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    const isBase64 = data.fileUrl.startsWith("data:");
    const mime = (data.mimeType || "").toLowerCase();
    const ext = (data.fileName || "").split(".").pop()?.toLowerCase() || "";

    const isImage = mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext);
    const isAudio = mime.startsWith("audio/") || ["mp3", "ogg", "wav", "m4a", "opus", "aac", "webm"].includes(ext);
    const isVideo = mime.startsWith("video/") || ["mp4", "mov", "avi", "mkv"].includes(ext);

    let zapiMessageId: string | null = null;

    // Tentativa 1: Endpoint Específico
    try {
        let endpoint = "";
        let body: Record<string, unknown> = {};

        if (isImage) {
            endpoint = isBase64 ? "send-image/by-base64" : "send-image";
            body = { phone: finalPhone, image: data.fileUrl, caption: data.caption || "" };
        } else if (isAudio) {
            endpoint = isBase64 ? "send-audio/by-base64" : "send-audio";
            body = { phone: finalPhone, audio: data.fileUrl };
        } else if (isVideo) {
            endpoint = isBase64 ? "send-video/by-base64" : "send-video";
            body = { phone: finalPhone, video: data.fileUrl, caption: data.caption || "" };
        } else {
            endpoint = isBase64 ? "send-document/by-base64" : "send-document/by-url";
            body = {
                phone: finalPhone,
                document: data.fileUrl,
                fileName: data.fileName,
                caption: data.caption || "",
            };
        }

        const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/${endpoint}`;
        const res = await fetch(url, {
            method: "POST",
            headers: zapiHeaders(),
            body: JSON.stringify(body),
        });

        if (res.ok) {
            const json = await res.json();
            zapiMessageId = json.zaapId || json.messageId || json.id || null;
        } else {
            console.warn(`[HR sendFile Primary Failed (${endpoint})]:`, await res.text());
        }
    } catch (e) {
        console.error("[HR sendFile Primary Exception]:", e);
    }

    // Fallback Inteligente: Se falhou e for base64, tentar como Documento genérico
    if (!zapiMessageId && isBase64) {
        try {
            const fallbackUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-document/by-base64`;
            const fallbackRes = await fetch(fallbackUrl, {
                method: "POST",
                headers: zapiHeaders(),
                body: JSON.stringify({
                    phone: finalPhone,
                    document: data.fileUrl,
                    fileName: data.fileName,
                    caption: data.caption || ""
                }),
            });
            if (fallbackRes.ok) {
                const json = await fallbackRes.json();
                zapiMessageId = json.zaapId || json.messageId || json.id || null;
            }
        } catch (fbErr) {
            console.error("[HR sendFile Fallback Error]:", fbErr);
        }
    }

    const messageType = isImage ? "IMAGE" : isAudio ? "AUDIO" : isVideo ? "VIDEO" : "DOCUMENT";
    
    // Gravar mensagem no histórico
    const saved = await prisma.hrTicketMessage.create({
        data: {
            ticketId: data.ticketId,
            senderType: "ATTENDANT",
            senderName: user.name,
            messageType,
            content: data.caption || `📎 ${data.fileName}`,
            mediaUrl: data.fileUrl,
            mediaFileName: data.fileName,
            mediaMimeType: data.mimeType,
            status: zapiMessageId ? "SENT" : "FAILED",
            zapiMessageId,
        },
    });

    // Gravar também na tabela de anexos do CRM
    try {
        await prisma.hrTicketAttachment.create({
            data: {
                ticketId: data.ticketId,
                fileName: data.fileName,
                fileUrl: data.fileUrl,
                mimeType: data.mimeType,
                uploadedById: user.id
            }
        });
    } catch (attErr) {
        console.error("[HR Attachment Log Error]:", attErr);
    }

    await prisma.hrTicket.update({ where: { id: data.ticketId }, data: { updatedAt: new Date() } });

    return { success: true, message: saved };
}

export async function getHrTicketMessages(ticketId: string, since?: string) {
    const where: Record<string, unknown> = { ticketId };
    if (since) where.createdAt = { gt: new Date(since) };
    return prisma.hrTicketMessage.findMany({ where, orderBy: { createdAt: "asc" } });
}

export async function markHrTicketRead(ticketId: string) {
    // Atualizar apenas o unreadCount sem alterar o updatedAt (data da ultima mensagem)
    await prisma.$executeRawUnsafe(
        `UPDATE "HrTicket" SET "unreadCount" = 0 WHERE "id" = $1`,
        ticketId
    );
}


// ─── ANOTAÇÕES ────────────────────────────────────────────────────────────────

export async function addHrTicketNote(ticketId: string, content: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };
    const note = await prisma.hrTicketNote.create({
        data: { ticketId, content, authorId: user.id },
        include: { author: { select: { id: true, name: true } } },
    });
    return { note };
}

export async function deleteHrTicketNote(noteId: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };
    await prisma.hrTicketNote.delete({ where: { id: noteId } });
    return { success: true };
}

// ─── ATIVIDADES ────────────────────────────────────────────────────────────────

export async function addHrTicketActivity(data: {
    ticketId: string;
    title: string;
    description?: string;
    dueAt: string;
    assigneeId?: string;
}) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };
    const activity = await prisma.hrTicketActivity.create({
        data: {
            ticketId: data.ticketId,
            title: data.title,
            description: data.description,
            dueAt: new Date(data.dueAt),
            assigneeId: data.assigneeId || user.id,
        },
        include: { assignee: { select: { id: true, name: true } } },
    });
    return { activity };
}

export async function completeHrTicketActivity(activityId: string) {
    const activity = await prisma.hrTicketActivity.update({
        where: { id: activityId },
        data: { completedAt: new Date() },
    });
    return { activity };
}

// ─── AGENDAMENTO DE MENSAGENS ─────────────────────────────────────────────────

export async function scheduleHrMessage(data: {
    ticketId?: string;
    phone: string;
    message: string;
    scheduledAt: string;
    isRecurring?: boolean;
    recurrenceRule?: string;
}) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };
    const scheduled = await prisma.hrScheduledMessage.create({
        data: {
            ticketId: data.ticketId,
            phone: data.phone,
            message: data.message,
            scheduledAt: new Date(data.scheduledAt),
            isRecurring: data.isRecurring ?? false,
            recurrenceRule: data.recurrenceRule,
            createdById: user.id,
            status: "PENDING",
        },
    });
    return { scheduled };
}

export async function cancelScheduledMessage(id: string) {
    await prisma.hrScheduledMessage.update({ where: { id }, data: { status: "CANCELLED" } });
    return { success: true };
}

// ─── ATTACHMENTS ──────────────────────────────────────────────────────────────

export async function addHrTicketAttachment(data: {
    ticketId: string;
    fileName: string;
    fileUrl: string;
    mimeType?: string;
}) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };
    const att = await prisma.hrTicketAttachment.create({
        data: { ...data, uploadedById: user.id },
        include: { uploadedBy: { select: { id: true, name: true } } },
    });
    return { attachment: att };
}

// ─── CARIMBO ──────────────────────────────────────────────────────────────────

export async function updateTicketStamp(ticketId: string, stamp: string) {
    await prisma.hrTicket.update({ where: { id: ticketId }, data: { attendantStamp: stamp } });
    return { success: true };
}

// ─── SEED DE PIPELINE PADRÃO ─────────────────────────────────────────────────

export async function seedDefaultPipeline() {
    // Garantir que a primeira etapa seja INBOX e atualizar se existir com outro nome
    const firstStage = await prisma.hrPipelineStage.findFirst({ orderBy: { order: "asc" } });
    if (firstStage && firstStage.name !== "INBOX") {
        await prisma.hrPipelineStage.update({
            where: { id: firstStage.id },
            data: { name: "INBOX", isDefault: true }
        });
    }

    const count = await prisma.hrPipelineStage.count();
    if (count > 0) return;

    const defaultStages = [
        { name: "INBOX", color: "#6366f1", order: 0, isDefault: true },
        { name: "Em Atendimento", color: "#f59e0b", order: 1, isDefault: false },
        { name: "Aguardando Retorno", color: "#3b82f6", order: 2, isDefault: false },
        { name: "Aguardando Documento", color: "#8b5cf6", order: 3, isDefault: false },
        { name: "Concluído Internamente", color: "#10b981", order: 4, isDefault: false },
    ];

    await prisma.hrPipelineStage.createMany({ data: defaultStages });
}

/** Sincroniza conversas ativas do celular via Z-API para a coluna INBOX */
export async function syncZapiChats() {
    try {
        const user = await getCurrentUser();
        if (!user) return { error: "Não autenticado" };

        // 1. Garantir que temos a etapa INBOX
        let inboxStage = await prisma.hrPipelineStage.findFirst({ where: { name: "INBOX" } });
        if (!inboxStage) {
            inboxStage = await prisma.hrPipelineStage.findFirst({ orderBy: { order: "asc" } });
        }
        if (!inboxStage) {
            inboxStage = await prisma.hrPipelineStage.create({
                data: { name: "INBOX", color: "#6366f1", order: 0, isDefault: true }
            });
        }

        // 2. Buscar conversas ativas do celular via Z-API (paginado ate 250 conversas)
        let createdCount = 0;

        for (let page = 1; page <= 5; page++) {
            const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/chats?page=${page}&pageSize=50`;
            const res = await fetch(url, {
                headers: zapiHeaders(),
                next: { revalidate: 0 }
            });

            if (!res.ok) break;
            const chats = await res.json();
            if (!Array.isArray(chats) || chats.length === 0) break;

            for (const c of chats) {
                const phone = c.phone?.replace(/\D/g, "");
                if (!phone) continue;


                const phoneShort = phone.startsWith("55") ? phone.slice(2) : phone;
                const phoneSearch = phoneShort.slice(-9);

                const existingTicket = await prisma.hrTicket.findFirst({
                    where: {
                        OR: [
                            { contactPhone: { contains: phoneSearch } },
                            { contactPhone: { contains: phone } }
                        ]
                    }
                });

                const photoUrl = await fetchZapiProfilePic(phone);

                if (!existingTicket) {
                    const employee = await prisma.employee.findFirst({
                        where: {
                            OR: [
                                { phone: { contains: phoneSearch } },
                                { phone: { contains: phone } }
                            ]
                        }
                    });

                    const contactName = c.name || (employee ? employee.name : `Contato (${phone.slice(-4)})`);
                    const lastMsgPreview = c.lastMessage?.text?.message || c.lastMessage?.text || null;

                    const newTicket = await prisma.hrTicket.create({
                        data: {
                            title: `Atendimento: ${contactName}`,
                            employeeId: employee?.id || null,
                            contactPhone: phone,
                            contactName,
                            contactPhotoUrl: photoUrl,
                            stageId: inboxStage.id,
                            status: "OPEN",
                            unreadCount: parseInt(c.messagesUnread || c.unread || "0", 10)
                        }
                    });

                    if (lastMsgPreview && typeof lastMsgPreview === "string") {
                        await prisma.hrTicketMessage.create({
                            data: {
                                ticketId: newTicket.id,
                                senderType: "EMPLOYEE",
                                senderName: contactName,
                                content: lastMsgPreview,
                                status: "DELIVERED"
                            }
                        });
                    }
                    createdCount++;
                } else {
                    if (photoUrl && existingTicket.contactPhotoUrl !== photoUrl) {
                        await prisma.hrTicket.update({
                            where: { id: existingTicket.id },
                            data: { contactPhotoUrl: photoUrl }
                        });
                    }
                }


            }
        }


        revalidatePath("/admin/atendimento");
        return { success: true, count: createdCount };

    } catch (e: any) {
        console.error("[Z-API Sync Error]:", e.message);
        return { error: e.message };
    }
}

/** Sincroniza histórico dos últimos 30 dias de uma conversa específica diretamente via Z-API */
export async function syncTicketWhatsAppHistory(ticketId: string, days = 30) {
    try {
        const user = await getCurrentUser();
        if (!user) return { error: "Não autenticado" };

        const ticket = await prisma.hrTicket.findUnique({ where: { id: ticketId } });
        if (!ticket) return { error: "Ticket não encontrado" };

        const phone = ticket.contactPhone.replace(/\D/g, "");
        const isGroup = ticket.contactPhone.includes("-group") || ticket.contactPhone.length > 13;
        const phoneToQuery = isGroup ? (ticket.contactPhone.endsWith("-group") ? ticket.contactPhone : `${ticket.contactPhone}-group`) : (phone.startsWith("55") ? phone : `55${phone}`);

        let totalImported = 0;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        for (let page = 1; page <= 5; page++) {
            const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/chat-messages/${phoneToQuery}?page=${page}&pageSize=50`;
            const res = await fetch(url, { headers: zapiHeaders(), next: { revalidate: 0 } });

            if (!res.ok) {
                const altUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/messages?phone=${phoneToQuery}&page=${page}&pageSize=50`;
                const altRes = await fetch(altUrl, { headers: zapiHeaders(), next: { revalidate: 0 } });
                if (!altRes.ok) break;
                const msgs = await altRes.json();
                if (!Array.isArray(msgs) || msgs.length === 0) break;
                const inserted = await insertZapiMessages(ticket.id, ticket.contactName, msgs, cutoffDate);
                totalImported += inserted;
                if (inserted === 0) break;
                continue;
            }

            const msgs = await res.json();
            if (!Array.isArray(msgs) || msgs.length === 0) break;
            const inserted = await insertZapiMessages(ticket.id, ticket.contactName, msgs, cutoffDate);
            totalImported += inserted;
            if (inserted === 0 && msgs.length > 0) {
                // If all messages on this page were older than cutoffDate or already exist
                const oldestOnPage = msgs[msgs.length - 1];
                const oldestDate = oldestOnPage?.momment ? new Date(oldestOnPage.momment) : (oldestOnPage?.timestamp ? new Date(oldestOnPage.timestamp * 1000) : null);
                if (oldestDate && oldestDate < cutoffDate) break;
            }
        }

        revalidatePath("/admin/atendimento");
        return { success: true, count: totalImported };
    } catch (e: any) {
        console.error("[Sync 30 Days Error]:", e.message);
        return { error: e.message };
    }
}

async function insertZapiMessages(ticketId: string, contactName: string, msgs: any[], minDate: Date) {
    let count = 0;
    for (const m of msgs) {
        let text = m.text?.message || m.text || m.body || m.caption || (m.image ? "📷 Foto" : m.audio ? "🎙️ Áudio" : m.document ? `📎 ${m.document?.fileName || "Documento"}` : null);
        
        // Tratar notificações de grupo se houver
        const isGroupNotification = m.type === "GroupNotification" || m.notificationType || m.action;
        if (isGroupNotification && !text) {
            const actor = m.senderName || m.author || "Um participante";
            if (m.action === "leave" || m.action === "remove") {
                text = `🚪 ${actor} saiu do grupo`;
            } else if (m.action === "add") {
                text = `➕ ${actor} entrou no grupo`;
            } else {
                text = `ℹ️ ${actor} atualizou o grupo`;
            }
        }

        if (!text) continue;

        // Detecção ultra-robusta de mensagens enviadas por nós (fromMe)
        const isFromMe = m.fromMe === true || 
                         m.fromMe === "true" || 
                         m.isSentByMe === true || 
                         m.sentByMe === true || 
                         m.key?.fromMe === true || 
                         m.status === "PENDING" || 
                         m.status === "SERVER_ACK" || 
                         m.status === "DELIVERY_ACK" || 
                         m.status === "READ" ||
                         m.senderType === "ATTENDANT";

        const msgDate = m.momment ? new Date(m.momment) : (m.timestamp ? new Date(m.timestamp * 1000) : (m.createdAt ? new Date(m.createdAt) : new Date()));
        
        if (msgDate < minDate) continue;

        const msgId = m.zaapId || m.messageId || m.id || null;

        let messageType = isGroupNotification ? "SYSTEM" : "TEXT";
        let mediaUrl: string | null = null;
        let mediaFileName: string | null = null;
        let mediaMimeType: string | null = null;

        if (m.image) {
            messageType = "IMAGE";
            mediaUrl = m.image.imageUrl || m.image.url || m.image;
        } else if (m.audio) {
            messageType = "AUDIO";
            mediaUrl = m.audio.audioUrl || m.audio.url || m.audio;
            mediaMimeType = "audio/ogg";
        } else if (m.document) {
            messageType = "DOCUMENT";
            mediaUrl = m.document.documentUrl || m.document.url || m.document;
            mediaFileName = m.document.fileName || "documento.pdf";
        }

        const senderType = isGroupNotification ? "SYSTEM" : (isFromMe ? "ATTENDANT" : "EMPLOYEE");
        const senderName = isFromMe ? "Atendente RH" : (m.senderName || m.author || contactName);

        const exists = await prisma.hrTicketMessage.findFirst({
            where: {
                ticketId,
                OR: [
                    ...(msgId ? [{ zapiMessageId: String(msgId) }] : []),
                    { createdAt: { gte: new Date(msgDate.getTime() - 4000), lte: new Date(msgDate.getTime() + 4000) } }
                ]
            }
        });

        if (exists) {
            // Se já existe mas tinha conteúdo genérico "Mensagem enviada" ou senderType incorreto, atualizar!
            if (exists.content === "Mensagem enviada" || exists.senderType !== senderType || (mediaUrl && !exists.mediaUrl)) {
                await prisma.hrTicketMessage.update({
                    where: { id: exists.id },
                    data: {
                        senderType,
                        senderName,
                        messageType,
                        content: String(text),
                        mediaUrl: typeof mediaUrl === "string" ? mediaUrl : exists.mediaUrl,
                        mediaFileName: typeof mediaFileName === "string" ? mediaFileName : exists.mediaFileName,
                        mediaMimeType: mediaMimeType || exists.mediaMimeType,
                        status: isFromMe ? "SENT" : "DELIVERED"
                    }
                });
                count++;
            }
        } else {
            await prisma.hrTicketMessage.create({
                data: {
                    ticketId,
                    senderType,
                    senderName,
                    messageType,
                    content: String(text),
                    mediaUrl: typeof mediaUrl === "string" ? mediaUrl : null,
                    mediaFileName: typeof mediaFileName === "string" ? mediaFileName : null,
                    mediaMimeType,
                    status: isFromMe ? "SENT" : "DELIVERED",
                    zapiMessageId: msgId ? String(msgId) : null,
                    createdAt: msgDate
                }
            });
            count++;
        }
    }
    return count;
}

/** Respostas Rápidas / Templates de Atendimento RH */
export async function getHrQuickReplies() {
    return [
        {
            id: "1",
            title: "📄 Solicitação de Atestado Médico",
            category: "Atestados",
            content: "Olá! Por favor, nos envie a foto legível do seu atestado médico contendo data de emissão, carimbo com CRM do médico e a quantidade de dias de afastamento para lançamento no sistema."
        },
        {
            id: "2",
            title: "📋 Documentação de Admissão",
            category: "Admissão",
            content: "Olá! Para darmos andamento na sua admissão, por favor envie as fotos de: RG, CPF, Comprovante de Residência atualizado, Título de Eleitor e Carteira de Trabalho digital."
        },
        {
            id: "3",
            title: "🚌 Informações sobre Vale Transporte",
            category: "Benefícios",
            content: "Olá! O seu benefício de Vale Transporte é calculado e recarregado mensalmente de acordo com a sua escala. Caso precise de alteração de rota ou suporte no cartão, envie os detalhes aqui."
        },
        {
            id: "4",
            title: "🏖️ Programação de Férias",
            category: "Férias",
            content: "Olá! Informamos que o seu período de férias foi registrado. O adiantamento com 1/3 constitucional será creditado em sua conta bancária até 2 dias antes do início do descanso."
        },
        {
            id: "5",
            title: "💰 Holerite / Comprovante de Pagamento",
            category: "Financeiro",
            content: "Olá! O seu demonstrativo de pagamento já foi emitido pelo DP e está disponível. Segue para conferência. Qualquer dúvida sobre os valores, estamos à disposição!"
        },
        {
            id: "6",
            title: "✅ Encerramento de Atendimento",
            category: "Finalização",
            content: "Ficamos felizes em te atender! O seu chamado foi concluído. Caso precise de mais alguma informação, basta nos enviar uma nova mensagem por aqui. Tenha um excelente dia!"
        }
    ];
}


