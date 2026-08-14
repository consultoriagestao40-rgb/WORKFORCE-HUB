import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID || "3F1993DFB59E83474F059E648AE68DF9";
const ZAPI_TOKEN = process.env.ZAPI_TOKEN || "81087A6B5C1CAB8AAAC801C4";
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || "F5c1b8f27f6b049c98c4e779d00f67552S";

async function fetchZapiProfilePic(phone: string): Promise<string | null> {
    try {
        const cleanPhone = phone.replace(/\D/g, "");
        const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
        const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/profile-picture?phone=${finalPhone}`;
        const res = await fetch(url, {
            headers: { "Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN },
            next: { revalidate: 0 }
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.link && data.link !== "null") return data.link;
        return data.profilePictureUrl || data.picture || data.url || null;
    } catch {
        return null;
    }
}


/**
 * WEBHOOK Z-API — Central de Atendimento RH + Recrutamento
 * Recebe todas as mensagens (enviadas e recebidas)
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log("[Z-API Webhook]:", JSON.stringify(body).slice(0, 500));

        // Ignorar acks, presenças e recibos de leitura
        const eventType = body.type || body.event || "";
        if (["ReadReceipt", "DeliveryReceipt", "presence"].includes(eventType)) {
            return NextResponse.json({ status: "ack_ignored" });
        }

        const isFromMe = body.fromMe === true || body.fromMe === "true" || body.from === "me" || body.isSentByMe === true || body.isSentByMe === "true";
        const rawPhone = isFromMe
            ? (body.to || body.phone || body.recipient || "")
            : (body.phone || body.from || body.sender || body.senderPhone || "");

        if (!rawPhone) {
            return NextResponse.json({ status: "ignored_no_phone" });
        }

        const cleanPhone = rawPhone.toString().replace(/\D/g, "").replace(/@.+$/, "");
        const phoneShort = cleanPhone.startsWith("55") ? cleanPhone.slice(2) : cleanPhone;
        const phoneSearch = phoneShort.slice(-9);

        // 1. Verificar se o número pertence a um Candidato do Recrutamento
        const candidates = await prisma.recruitmentCandidate.findMany({
            where: {
                OR: [
                    { phone: { contains: phoneSearch } },
                    { phone: { contains: cleanPhone } },
                    { phone: { contains: phoneShort } }
                ]
            },
            take: 1
        });

        if (candidates.length > 0) {
            const candidate = candidates[0];
            return await processCandidateMessage(candidate, body, isFromMe);
        }

        // 2. Se NÃO for candidato, tratar como Atendimento de Funcionário/RH
        return await processHrAttendanceMessage(cleanPhone, phoneSearch, phoneShort, body, isFromMe);

    } catch (e: any) {
        console.error("[Z-API Webhook Exception]:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/** Processa mensagem de Candidato no Recrutamento */
async function processCandidateMessage(candidate: any, body: any, isFromMe: boolean) {
    const { messageType, content, mediaUrl, mediaFileName, mediaMimeType, msgId } = parseMessageBody(body);

    if (msgId) {
        const exists = await prisma.recruitmentWhatsAppMessage.findFirst({ where: { zapiMessageId: msgId } });
        if (exists) return NextResponse.json({ status: "duplicate_candidate_ignored" });
    }

    await prisma.recruitmentWhatsAppMessage.create({
        data: {
            candidateId: candidate.id,
            senderType: isFromMe ? "RECRUITER" : "CANDIDATE",
            senderName: isFromMe ? "RH WorkForce Hub" : candidate.name,
            messageType,
            content,
            mediaUrl,
            mediaFileName,
            mediaMimeType,
            status: isFromMe ? "SENT" : "RECEIVED",
            zapiMessageId: msgId
        }
    });

    // Também salvar no Ticket de Atendimento RH para aparecer no /admin/atendimento
    const cleanPhone = candidate.phone.replace(/\D/g, "");
    const phoneSearch = cleanPhone.slice(-9);

    let ticket = await prisma.hrTicket.findFirst({
        where: {
            OR: [
                { contactPhone: { contains: phoneSearch } },
                { contactPhone: { contains: cleanPhone } }
            ]
        }
    });

    if (!ticket) {
        let inboxStage = await prisma.hrPipelineStage.findFirst({ where: { isDefault: true } })
            || await prisma.hrPipelineStage.findFirst({ orderBy: { order: "asc" } });
        ticket = await prisma.hrTicket.create({
            data: {
                title: `Atendimento: ${candidate.name}`,
                contactPhone: cleanPhone,
                contactName: candidate.name,
                stageId: inboxStage?.id || "",
                status: "OPEN",
                unreadCount: isFromMe ? 0 : 1
            }
        });
    } else {
        await prisma.hrTicket.update({
            where: { id: ticket.id },
            data: { updatedAt: new Date(), unreadCount: isFromMe ? ticket.unreadCount : { increment: 1 } }
        });
    }

    await prisma.hrTicketMessage.create({
        data: {
            ticketId: ticket.id,
            senderType: isFromMe ? "ATTENDANT" : "EMPLOYEE",
            senderName: isFromMe ? "Atendente RH" : candidate.name,
            messageType,
            content,
            mediaUrl,
            mediaFileName,
            mediaMimeType,
            status: isFromMe ? "SENT" : "RECEIVED",
            zapiMessageId: msgId
        }
    });

    if (!isFromMe) {
        await prisma.recruitmentCandidate.update({
            where: { id: candidate.id },
            data: { unreadWhatsAppCount: { increment: 1 } }
        });
    }

    return NextResponse.json({ status: "candidate_success", candidateId: candidate.id });
}

/** Processa mensagem da Central de Atendimento RH */
async function processHrAttendanceMessage(cleanPhone: string, phoneSearch: string, phoneShort: string, body: any, isFromMe: boolean) {
    const { messageType, content, mediaUrl, mediaFileName, mediaMimeType, msgId } = parseMessageBody(body);

    // Buscar se o remetente é um funcionário cadastrado no sistema
    const employees = await prisma.employee.findMany({
        where: {
            OR: [
                { phone: { contains: phoneSearch } },
                { phone: { contains: cleanPhone } },
                { phone: { contains: phoneShort } }
            ]
        },
        take: 1
    });

    const employee = employees.length > 0 ? employees[0] : null;
    const contactName = body.senderName || body.pushName || (employee ? employee.name : `Contato (${cleanPhone.slice(-4)})`);

    // Buscar foto de perfil no Z-API se o remetente for o funcionário
    let contactPhotoUrl: string | null = null;
    if (!isFromMe) {
        contactPhotoUrl = await fetchZapiProfilePic(cleanPhone);
    }

    // Buscar se já existe um ticket em aberto para esse telefone
    let ticket = await prisma.hrTicket.findFirst({
        where: {
            contactPhone: { contains: phoneSearch },
            status: "OPEN"
        },
        orderBy: { updatedAt: "desc" }
    });

    // Se não existir ticket aberto, criar um novo ticket
    if (!ticket) {
        // Garantir etapa padrão
        let defaultStage = await prisma.hrPipelineStage.findFirst({ where: { isDefault: true } });
        if (!defaultStage) {
            defaultStage = await prisma.hrPipelineStage.findFirst({ orderBy: { order: "asc" } });
        }

        if (!defaultStage) {
            // Criar etapa padrão caso não exista
            defaultStage = await prisma.hrPipelineStage.create({
                data: { name: "Novo", color: "#6366f1", order: 0, isDefault: true }
            });
        }

        ticket = await prisma.hrTicket.create({
            data: {
                title: content ? `Atendimento: ${content.slice(0, 30)}...` : "Novo Atendimento",
                employeeId: employee?.id || null,
                contactPhone: cleanPhone,
                contactName,
                contactPhotoUrl,
                stageId: defaultStage.id,
                status: "OPEN",
                isPrivate: false,
                unreadCount: isFromMe ? 0 : 1
            }
        });
    } else {
        // Atualizar foto e contadores no ticket existente
        const updateData: any = { updatedAt: new Date() };
        if (contactPhotoUrl) updateData.contactPhotoUrl = contactPhotoUrl;
        if (!isFromMe) updateData.unreadCount = { increment: 1 };
        await prisma.hrTicket.update({ where: { id: ticket.id }, data: updateData });
    }

    // Verificar duplicação por msgId
    if (msgId) {
        const exists = await prisma.hrTicketMessage.findFirst({ where: { zapiMessageId: msgId } });
        if (exists) return NextResponse.json({ status: "duplicate_hr_ignored" });
    }

    // Salvar mensagem no ticket
    await prisma.hrTicketMessage.create({
        data: {
            ticketId: ticket.id,
            senderType: isFromMe ? "ATTENDANT" : "EMPLOYEE",
            senderName: isFromMe ? "Atendente RH" : contactName,
            messageType,
            content,
            mediaUrl,
            mediaFileName,
            mediaMimeType,
            status: isFromMe ? "SENT" : "RECEIVED",
            zapiMessageId: msgId
        }
    });

    console.log(`[Z-API HR Webhook] ✅ Mensagem salva no ticket ${ticket.id} | ${contactName}: ${content.slice(0, 50)}`);
    return NextResponse.json({ status: "hr_ticket_success", ticketId: ticket.id });
}

/** Helper para extrair tipo e conteúdo do body da mensagem do Z-API */
function parseMessageBody(body: any) {
    let messageType = "TEXT";
    let content = "";
    let mediaUrl: string | undefined;
    let mediaFileName: string | undefined;
    let mediaMimeType: string | undefined;

    // 1. Extração de texto de múltiplos formatos Z-API / Baileys
    if (typeof body.text === "string") content = body.text;
    else if (body.text?.message) content = body.text.message;
    else if (typeof body.message === "string") content = body.message;
    else if (typeof body.body === "string") content = body.body;
    else if (typeof body.caption === "string") content = body.caption;
    else if (typeof body.content === "string") content = body.content;
    else if (body.message?.conversation) content = body.message.conversation;
    else if (body.message?.extendedTextMessage?.text) content = body.message.extendedTextMessage.text;
    else if (body.message?.imageMessage?.caption) content = body.message.imageMessage.caption;
    else if (body.message?.documentMessage?.caption) content = body.message.documentMessage.caption;
    else if (body.message?.videoMessage?.caption) content = body.message.videoMessage.caption;
    else if (body.message?.buttonsResponseMessage?.selectedDisplayText) content = body.message.buttonsResponseMessage.selectedDisplayText;
    else if (body.message?.listResponseMessage?.title) content = body.message.listResponseMessage.title;
    else if (body.message?.templateButtonReplyMessage?.selectedDisplayText) content = body.message.templateButtonReplyMessage.selectedDisplayText;

    // 2. Tratar Notificações de Grupo (Entrou, Saiu, Removido, Convidado, etc.)
    const eventType = body.type || body.event || body.notificationType || "";
    const action = body.action || body.subType || "";
    const participantName = body.senderName || body.pushName || body.participantPhone || body.author || "Um participante";

    if (eventType === "GroupNotification" || eventType === "group_notification" || eventType === "group-update" || action) {
        messageType = "SYSTEM";
        if (action === "leave" || action === "remove" || eventType.toLowerCase().includes("leave") || eventType.toLowerCase().includes("remove")) {
            content = `🚪 ${participantName} saiu do grupo`;
        } else if (action === "add" || action === "invite" || eventType.toLowerCase().includes("add")) {
            content = `➕ ${participantName} entrou no grupo`;
        } else if (action === "promote" || action === "admin") {
            content = `⭐ ${participantName} agora é administrador do grupo`;
        } else if (action === "demote") {
            content = `👤 ${participantName} não é mais administrador`;
        } else if (body.groupInviteMessage || body.inviteCode) {
            content = `✉️ Convite enviado para o grupo`;
        }
    }

    // 3. Mídias
    if (body.image || body.message?.imageMessage) {
        messageType = "IMAGE";
        const img = body.image || body.message?.imageMessage;
        mediaUrl = img.imageUrl || img.url || img.base64 || (typeof img === "string" ? img : undefined);
        content = img.caption || content || "📷 Imagem";
    } else if (body.document || body.message?.documentMessage) {
        messageType = "DOCUMENT";
        const doc = body.document || body.message?.documentMessage;
        mediaUrl = doc.documentUrl || doc.url;
        mediaFileName = doc.fileName || doc.name || doc.title || "documento";
        mediaMimeType = doc.mimeType || doc.mimetype || "application/pdf";
        content = doc.caption || content || `📎 ${mediaFileName}`;
    } else if (body.audio || body.ptt || body.type === "audio" || body.type === "ptt" || body.message?.audioMessage) {
        messageType = "AUDIO";
        const aud = body.audio || body.ptt || body.message?.audioMessage;
        mediaUrl = aud?.audioUrl || aud?.url || (typeof aud === "string" ? aud : undefined) || body.mediaUrl || body.url || body.file;
        content = "🎙️ Mensagem de Voz";
    } else if (body.sticker || body.message?.stickerMessage) {
        messageType = "IMAGE";
        const stk = body.sticker || body.message?.stickerMessage;
        mediaUrl = stk.stickerUrl || stk.url;
        content = "🎨 Figurinha";
    } else if (body.video || body.message?.videoMessage) {
        messageType = "VIDEO";
        const vid = body.video || body.message?.videoMessage;
        mediaUrl = vid.videoUrl || vid.url;
        content = vid.caption || "🎥 Vídeo";
    } else if (body.contact || body.vcard || body.message?.contactMessage) {
        messageType = "CONTACT";
        const cName = body.contact?.displayName || body.contact?.name || body.vcard?.displayName || "Contato";
        content = `👤 ${cName} (Contato compartilhado)`;
    } else if (body.reaction || body.message?.reactionMessage) {
        messageType = "SYSTEM";
        const emoji = body.reaction?.text || body.message?.reactionMessage?.text || "👍";
        content = `Reação: ${emoji}`;
    }

    // 4. Tratar Mensagem Citada (Quoted Message)
    if (body.quotedMessage) {
        const quotedText = body.quotedMessage.text || body.quotedMessage.body || body.quotedMessage.caption || body.quotedMessage.content || "Mensagem";
        content = `> ${quotedText}\n${content}`;
    }

    const msgId = body.messageId || body.id || body.msgId || body.zaapId || null;

    if (!content) {
        content = messageType === "IMAGE" ? "📷 Imagem" : messageType === "AUDIO" ? "🎙️ Áudio" : messageType === "DOCUMENT" ? "📎 Documento" : "💬 Mensagem";
    }

    return { messageType, content, mediaUrl, mediaFileName, mediaMimeType, msgId };
}


export async function GET() {
    return NextResponse.json({
        status: "active",
        endpoint: "Z-API Webhook Receiver — HR Attendance & Recruitment",
        version: "3.0",
        timestamp: new Date().toISOString()
    });
}
