"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function saveCandidateWhatsAppMessageAction(data: {
    candidateId: string;
    content: string;
    direction?: "SENT" | "RECEIVED";
}) {
    try {
        const user = await getCurrentUser();
        const candidate = await prisma.recruitmentCandidate.findUnique({
            where: { id: data.candidateId }
        });

        if (!candidate) {
            return { success: false, error: "Candidato não encontrado." };
        }

        const extra = (candidate.extraFields as Record<string, any>) || {};
        const history: any[] = Array.isArray(extra.whatsappHistory) ? extra.whatsappHistory : [];

        const newMessageItem = {
            id: `wa_msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            content: data.content,
            senderName: user?.name || "RH WorkForce Hub",
            createdAt: new Date().toISOString(),
            direction: data.direction || "SENT"
        };

        const updatedHistory = [...history, newMessageItem];

        await prisma.recruitmentCandidate.update({
            where: { id: data.candidateId },
            data: {
                extraFields: {
                    ...extra,
                    whatsappHistory: updatedHistory,
                    lastWhatsAppMessageAt: new Date().toISOString()
                }
            }
        });

        revalidatePath("/admin/recrutamento");

        return {
            success: true,
            messageItem: newMessageItem
        };
    } catch (e: any) {
        console.error("[saveCandidateWhatsAppMessageAction Error]:", e);
        return { success: false, error: e.message || "Erro ao salvar mensagem no histórico." };
    }
}

export async function getCandidateWhatsAppHistoryAction(candidateId: string) {
    try {
        const candidate = await prisma.recruitmentCandidate.findUnique({
            where: { id: candidateId },
            select: { extraFields: true }
        });

        if (!candidate) {
            return { success: false, error: "Candidato não encontrado." };
        }

        const extra = (candidate.extraFields as Record<string, any>) || {};
        const history: any[] = Array.isArray(extra.whatsappHistory) ? extra.whatsappHistory : [];

        return {
            success: true,
            messages: history
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
