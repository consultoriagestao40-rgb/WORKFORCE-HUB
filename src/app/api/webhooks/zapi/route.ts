import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Webhook para receber mensagens, arquivos e status do Z-API em tempo real
export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log("[Z-API Webhook Received]:", JSON.stringify(body, null, 2));

        // 1. Tratamento de mensagens recebidas (Text, Image, Document, Audio)
        const phone = body.phone || body.from || body.sender || "";
        if (!phone) {
            return NextResponse.json({ status: "ignored_no_phone" });
        }

        const cleanPhone = phone.replace(/\D/g, "");
        const searchPhone = cleanPhone.startsWith("55") ? cleanPhone.slice(2) : cleanPhone;

        // Localizar candidato correspondente no banco pelo telefone (últimos dígitos)
        const candidates = await prisma.recruitmentCandidate.findMany({
            where: {
                OR: [
                    { phone: { contains: searchPhone } },
                    { phone: { contains: cleanPhone } }
                ]
            }
        });

        if (candidates.length === 0) {
            console.log(`[Z-API Webhook]: Candidato não localizado para o telefone: ${phone}`);
            return NextResponse.json({ status: "candidate_not_found" });
        }

        const candidate = candidates[0];

        // Determinar tipo de mensagem recebida
        let messageType = "TEXT";
        let content = body.text?.message || body.message || body.body || "";
        let mediaUrl: string | undefined = undefined;
        let mediaFileName: string | undefined = undefined;
        let mediaMimeType: string | undefined = undefined;

        if (body.image) {
            messageType = "IMAGE";
            mediaUrl = body.image.imageUrl || body.image.url;
            content = body.image.caption || "📷 Imagem recebida pelo WhatsApp";
        } else if (body.document) {
            messageType = "DOCUMENT";
            mediaUrl = body.document.documentUrl || body.document.url;
            mediaFileName = body.document.fileName || "documento.pdf";
            mediaMimeType = body.document.mimeType || "application/pdf";
            content = body.document.caption || `📎 Arquivo: ${mediaFileName}`;
        } else if (body.audio) {
            messageType = "AUDIO";
            mediaUrl = body.audio.audioUrl || body.audio.url;
            content = "🎙️ Mensagem de áudio recebida";
        }

        if (!content && !mediaUrl) {
            return NextResponse.json({ status: "empty_payload" });
        }

        // Inserir mensagem no banco de dados do candidato
        await prisma.recruitmentWhatsAppMessage.create({
            data: {
                candidateId: candidate.id,
                senderType: "CANDIDATE",
                senderName: candidate.name,
                messageType,
                content,
                mediaUrl,
                mediaFileName,
                mediaMimeType,
                status: "RECEIVED",
                zapiMessageId: body.messageId || body.id || null
            }
        });

        // Incrementar contador de mensagens nao lidas
        await prisma.recruitmentCandidate.update({
            where: { id: candidate.id },
            data: {
                unreadWhatsAppCount: { increment: 1 }
            }
        });

        return NextResponse.json({ status: "success" });
    } catch (e: any) {
        console.error("[Z-API Webhook Exception]:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ status: "Z-API Webhook Endpoint Active" });
}
