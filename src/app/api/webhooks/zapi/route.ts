import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * WEBHOOK Z-API - Recebe TODAS as mensagens em tempo real (enviadas e recebidas)
 * 
 * Configure no painel Z-API:
 *   On Message Received URL: https://workforce-hub-hanna.vercel.app/api/webhooks/zapi
 *   On Message Send URL:     https://workforce-hub-hanna.vercel.app/api/webhooks/zapi
 *   
 * Ambos apontam para este mesmo endpoint.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log("[Z-API Webhook]:", JSON.stringify(body).slice(0, 500));

        // Ignorar mensagens de status, acks e pings
        const eventType = body.type || body.event || "";
        if (eventType === "ReadReceipt" || eventType === "DeliveryReceipt" || eventType === "presence") {
            return NextResponse.json({ status: "ack_ignored" });
        }

        // Extrair o telefone do remetente ou destinatário
        // Z-API pode enviar: phone, from, to, sender, senderPhone
        const isFromMe = body.fromMe === true || body.from === "me" || body.isSentByMe === true;
        const phone = isFromMe
            ? (body.to || body.phone || body.recipient || "")
            : (body.phone || body.from || body.sender || body.senderPhone || "");

        if (!phone) {
            console.log("[Z-API Webhook] Ignorando: sem telefone identificado");
            return NextResponse.json({ status: "ignored_no_phone" });
        }

        const cleanPhone = phone.toString().replace(/\D/g, "");
        // Remover o @c.us ou @g.us do identificador
        const phoneWithoutSuffix = cleanPhone.replace(/@.+$/, "");
        // Remover código de país 55 para busca mais ampla
        const phoneShort = phoneWithoutSuffix.startsWith("55")
            ? phoneWithoutSuffix.slice(2)
            : phoneWithoutSuffix;

        // Buscar candidato pelo telefone (últimos 8+ dígitos)
        const phoneSearch = phoneShort.slice(-9); // últimos 9 dígitos
        const candidates = await prisma.recruitmentCandidate.findMany({
            where: {
                OR: [
                    { phone: { contains: phoneSearch } },
                    { phone: { contains: phoneWithoutSuffix } },
                    { phone: { contains: phoneShort } }
                ]
            },
            take: 1
        });

        if (candidates.length === 0) {
            console.log(`[Z-API Webhook] Candidato não encontrado para telefone: ${phone} / ${phoneSearch}`);
            return NextResponse.json({ status: "candidate_not_found", phone: phoneSearch });
        }

        const candidate = candidates[0];

        // Determinar tipo de mensagem
        let messageType = "TEXT";
        let content = "";
        let mediaUrl: string | undefined;
        let mediaFileName: string | undefined;
        let mediaMimeType: string | undefined;

        // Texto simples
        if (body.text?.message) {
            content = body.text.message;
        } else if (body.message && typeof body.message === "string") {
            content = body.message;
        } else if (body.body && typeof body.body === "string") {
            content = body.body;
        }

        // Imagem
        if (body.image) {
            messageType = "IMAGE";
            mediaUrl = body.image.imageUrl || body.image.url || body.image.base64;
            content = body.image.caption || "📷 Imagem";
        }

        // Documento / PDF
        if (body.document) {
            messageType = "DOCUMENT";
            mediaUrl = body.document.documentUrl || body.document.url;
            mediaFileName = body.document.fileName || body.document.name || "documento";
            mediaMimeType = body.document.mimeType || "application/pdf";
            content = body.document.caption || `📎 ${mediaFileName}`;
        }

        // Áudio
        if (body.audio) {
            messageType = "AUDIO";
            mediaUrl = body.audio.audioUrl || body.audio.url;
            content = "🎙️ Áudio";
        }

        // Sticker
        if (body.sticker) {
            messageType = "IMAGE";
            mediaUrl = body.sticker.stickerUrl || body.sticker.url;
            content = "🎨 Sticker";
        }

        // Video
        if (body.video) {
            messageType = "VIDEO";
            mediaUrl = body.video.videoUrl || body.video.url;
            content = body.video.caption || "🎥 Vídeo";
        }

        if (!content && !mediaUrl) {
            console.log("[Z-API Webhook] Payload sem conteúdo reconhecido:", JSON.stringify(body).slice(0, 200));
            return NextResponse.json({ status: "empty_content" });
        }

        // Verificar duplicata pelo zapiMessageId
        const msgId = body.messageId || body.id || body.msgId || null;
        if (msgId) {
            const exists = await prisma.recruitmentWhatsAppMessage.findFirst({
                where: { zapiMessageId: msgId }
            });
            if (exists) {
                console.log(`[Z-API Webhook] Mensagem duplicada ignorada: ${msgId}`);
                return NextResponse.json({ status: "duplicate_ignored" });
            }
        }

        // Salvar mensagem no banco
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

        // Incrementar não lidas SOMENTE para mensagens recebidas do candidato
        if (!isFromMe) {
            await prisma.recruitmentCandidate.update({
                where: { id: candidate.id },
                data: { unreadWhatsAppCount: { increment: 1 } }
            });
        }

        console.log(`[Z-API Webhook] ✅ Mensagem salva: ${isFromMe ? "→ Enviada" : "← Recebida"} | ${candidate.name} | ${content.slice(0, 60)}`);
        return NextResponse.json({ status: "success", candidateId: candidate.id });

    } catch (e: any) {
        console.error("[Z-API Webhook Exception]:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({
        status: "active",
        endpoint: "Z-API Webhook Receiver - Workforce Hub Recruitment",
        version: "2.0",
        timestamp: new Date().toISOString()
    });
}
