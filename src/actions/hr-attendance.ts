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

export async function getHrTickets(filters?: {
    stageId?: string;
    labelId?: string;
    status?: string;
    assigneeId?: string;
    search?: string;
}) {
    const user = await getCurrentUser();
    if (!user) return [];
    const isAdmin = user.role === "ADMIN";

    const where: Record<string, unknown> = {};
    if (filters?.stageId) where.stageId = filters.stageId;
    if (filters?.status) where.status = filters.status;
    else where.status = "OPEN";

    if (filters?.labelId) where.labels = { some: { id: filters.labelId } };

    // Visibilidade: tickets privados só aparecem para o atendente responsável (ou admin)
    if (!isAdmin) {
        where.OR = [
            { isPrivate: false },
            { assigneeId: user.id },
            { participantIds: { has: user.id } },
        ];
    }

    if (filters?.search) {
        where.OR = [
            { contactName: { contains: filters.search, mode: "insensitive" } },
            { contactPhone: { contains: filters.search } },
            { title: { contains: filters.search, mode: "insensitive" } },
        ];
    }

    return prisma.hrTicket.findMany({
        where,
        include: {
            stage: true,
            assignee: { select: { id: true, name: true } },
            labels: true,
            employee: { select: { id: true, name: true, phone: true } },
            messages: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { content: true, createdAt: true, senderType: true },
            },
            _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: "desc" },
    });
}

export async function getHrTicketDetail(ticketId: string) {
    const user = await getCurrentUser();
    if (!user) return null;
    const isAdmin = user.role === "ADMIN";

    const ticket = await prisma.hrTicket.findUnique({
        where: { id: ticketId },
        include: {
            stage: true,
            assignee: { select: { id: true, name: true } },
            labels: true,
            employee: { select: { id: true, name: true, phone: true, birthDate: true } },
            messages: { orderBy: { createdAt: "asc" } },
            notes: {
                include: { author: { select: { id: true, name: true } } },
                orderBy: { createdAt: "asc" },
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
        // Se nao tem nenhuma mensagem no banco, consultar a ultima mensagem do Z-API
        try {
            const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/chats/${ticket.contactPhone}`;
            const res = await fetch(url, { headers: zapiHeaders(), next: { revalidate: 0 } });
            if (res.ok) {
                const chatData = await res.json();
                if (chatData && (chatData.lastMessage || chatData.name)) {
                    const text = chatData.lastMessage?.text?.message || chatData.lastMessage?.text || "Atendimento iniciado via WhatsApp";
                    const initialMsg = await prisma.hrTicketMessage.create({
                        data: {
                            ticketId: ticket.id,
                            senderType: "EMPLOYEE",
                            senderName: ticket.contactName,
                            content: text,
                            status: "DELIVERED"
                        }
                    });
                    ticket.messages = [initialMsg as any];
                }
            }
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
    await prisma.hrTicket.update({
        where: { id: ticketId },
        data: { assigneeId: user.id, isPrivate: true, updatedAt: new Date() },
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
            content: data.message, // salva sem carimbo no banco
            status: zapiMessageId ? "SENT" : "FAILED",
            zapiMessageId,
        },
    });

    await prisma.hrTicket.update({ where: { id: data.ticketId }, data: { updatedAt: new Date() } });

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

    const isImage = data.mimeType.startsWith("image/");
    const isAudio = data.mimeType.startsWith("audio/");

    let endpoint = "send-document/by-url";
    let body: Record<string, unknown> = {
        phone: finalPhone,
        document: data.fileUrl,
        fileName: data.fileName,
        caption: data.caption || "",
    };

    if (isImage) {
        endpoint = "send-image";
        body = { phone: finalPhone, image: data.fileUrl, caption: data.caption || "" };
    } else if (isAudio) {
        endpoint = "send-audio";
        body = { phone: finalPhone, audio: data.fileUrl };
    }

    let zapiMessageId: string | null = null;
    try {
        const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/${endpoint}`;
        const res = await fetch(url, {
            method: "POST",
            headers: zapiHeaders(),
            body: JSON.stringify(body),
        });
        if (res.ok) {
            const json = await res.json();
            zapiMessageId = json.zaapId || json.messageId || json.id || null;
        }
    } catch (e) {
        console.error("[HR sendFile] Z-API error:", e);
    }

    const messageType = isImage ? "IMAGE" : isAudio ? "AUDIO" : "DOCUMENT";
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


