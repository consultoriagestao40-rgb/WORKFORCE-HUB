"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID || "3B3060E58F49F09E0D3396825B9A6B2F";
const ZAPI_TOKEN = process.env.ZAPI_TOKEN || "B7D14605963E820FEE720C73";
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || "F75962b9f8d1a49f5ad38ea822ef4a44bS";

export async function sendZapiTextMessage(data: {
    candidateId: string;
    phone: string;
    message: string;
}) {
    try {
        const user = await getCurrentUser();
        const cleanPhone = data.phone.replace(/\D/g, "");
        const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

        // 1. Enviar mensagem real via API do Z-API
        const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
        
        let zapiMsgId: string | null = null;
        let isSuccess = false;

        try {
            const zapiRes = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Client-Token": ZAPI_CLIENT_TOKEN
                },
                body: JSON.stringify({
                    phone: finalPhone,
                    message: data.message
                })
            });

            if (zapiRes.ok) {
                const resJson = await zapiRes.json();
                zapiMsgId = resJson.messageId || resJson.id || null;
                isSuccess = true;
            } else {
                console.error("[Z-API Send Error]:", await zapiRes.text());
            }
        } catch (zapiErr) {
            console.error("[Z-API Exception]:", zapiErr);
        }

        // 2. Registrar a mensagem enviada no banco de dados do candidato
        const newMsg = await prisma.recruitmentWhatsAppMessage.create({
            data: {
                candidateId: data.candidateId,
                senderType: "RECRUITER",
                senderName: user?.name || "RH WorkForce Hub",
                messageType: "TEXT",
                content: data.message,
                status: isSuccess ? "SENT" : "FAILED",
                zapiMessageId: zapiMsgId
            }
        });

        revalidatePath("/admin/recrutamento");

        return {
            success: true,
            message: newMsg
        };
    } catch (e: any) {
        console.error("[sendZapiTextMessage Exception]:", e);
        return { success: false, error: e.message };
    }
}

export async function sendZapiMediaFileMessage(data: {
    candidateId: string;
    phone: string;
    fileBase64: string;
    fileName: string;
    mimeType: string;
    caption?: string;
}) {
    try {
        const user = await getCurrentUser();
        const cleanPhone = data.phone.replace(/\D/g, "");
        const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

        const isImage = data.mimeType.startsWith("image/");
        const endpoint = isImage ? "send-image" : "send-document";
        const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/${endpoint}`;

        const dataUrl = `data:${data.mimeType};base64,${data.fileBase64}`;

        let zapiMsgId: string | null = null;
        let isSuccess = false;

        try {
            const zapiRes = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Client-Token": ZAPI_CLIENT_TOKEN
                },
                body: JSON.stringify(isImage ? {
                    phone: finalPhone,
                    image: dataUrl,
                    caption: data.caption || data.fileName
                } : {
                    phone: finalPhone,
                    document: dataUrl,
                    fileName: data.fileName,
                    caption: data.caption || data.fileName
                })
            });

            if (zapiRes.ok) {
                const resJson = await zapiRes.json();
                zapiMsgId = resJson.messageId || resJson.id || null;
                isSuccess = true;
            } else {
                console.error("[Z-API Send Media Error]:", await zapiRes.text());
            }
        } catch (zapiErr) {
            console.error("[Z-API Media Exception]:", zapiErr);
        }

        const newMsg = await prisma.recruitmentWhatsAppMessage.create({
            data: {
                candidateId: data.candidateId,
                senderType: "RECRUITER",
                senderName: user?.name || "RH WorkForce Hub",
                messageType: isImage ? "IMAGE" : "DOCUMENT",
                content: data.caption || `📎 Arquivo enviado: ${data.fileName}`,
                mediaUrl: dataUrl,
                mediaFileName: data.fileName,
                mediaMimeType: data.mimeType,
                status: isSuccess ? "SENT" : "FAILED",
                zapiMessageId: zapiMsgId
            }
        });

        revalidatePath("/admin/recrutamento");

        return {
            success: true,
            message: newMsg
        };
    } catch (e: any) {
        console.error("[sendZapiMediaFileMessage Exception]:", e);
        return { success: false, error: e.message };
    }
}

export async function getCandidateWhatsAppMessagesAction(candidateId: string) {
    try {
        const messages = await prisma.recruitmentWhatsAppMessage.findMany({
            where: { candidateId },
            orderBy: { createdAt: "asc" }
        });

        // Zerar contador de nao lidas ao abrir o chat
        await prisma.recruitmentCandidate.update({
            where: { id: candidateId },
            data: { unreadWhatsAppCount: 0 }
        });

        return {
            success: true,
            messages
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function addCandidateNoteAction(candidateId: string, noteText: string) {
    try {
        const user = await getCurrentUser();
        const candidate = await prisma.recruitmentCandidate.findUnique({
            where: { id: candidateId }
        });

        if (!candidate) return { success: false, error: "Candidato não encontrado" };

        const extra = (candidate.extraFields as Record<string, any>) || {};
        const notesList: any[] = Array.isArray(extra.internalNotes) ? extra.internalNotes : [];

        const newNote = {
            id: `note_${Date.now()}`,
            text: noteText,
            authorName: user?.name || "RH WorkForce Hub",
            createdAt: new Date().toISOString()
        };

        await prisma.recruitmentCandidate.update({
            where: { id: candidateId },
            data: {
                extraFields: {
                    ...extra,
                    internalNotes: [...notesList, newNote]
                }
            }
        });

        return { success: true, note: newNote };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
