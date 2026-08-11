import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Endpoint de polling em tempo real para o chat do candidato.
 * GET /api/whatsapp/messages?candidateId=XXX&since=ISO_DATE
 * 
 * O frontend chama este endpoint a cada 3s enquanto o chat está aberto.
 * Retorna apenas mensagens NOVAS (desde o timestamp `since`).
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const candidateId = searchParams.get("candidateId");
        const since = searchParams.get("since"); // ISO string da última mensagem conhecida

        if (!candidateId) {
            return NextResponse.json({ error: "candidateId required" }, { status: 400 });
        }

        const whereClause: any = { candidateId };

        if (since) {
            whereClause.createdAt = { gt: new Date(since) };
        }

        const messages = await prisma.recruitmentWhatsAppMessage.findMany({
            where: whereClause,
            orderBy: { createdAt: "asc" }
        });

        // Buscar candidato para retornar total de não lidas
        const candidate = await prisma.recruitmentCandidate.findUnique({
            where: { id: candidateId },
            select: { unreadWhatsAppCount: true }
        });

        return NextResponse.json({
            success: true,
            messages,
            unreadCount: candidate?.unreadWhatsAppCount || 0,
            serverTime: new Date().toISOString()
        });

    } catch (e: any) {
        console.error("[Poll Messages Error]:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/**
 * POST /api/whatsapp/messages - Zera contador de não lidas ao abrir o chat
 */
export async function POST(req: Request) {
    try {
        const { candidateId } = await req.json();
        if (!candidateId) return NextResponse.json({ error: "candidateId required" }, { status: 400 });

        await prisma.recruitmentCandidate.update({
            where: { id: candidateId },
            data: { unreadWhatsAppCount: 0 }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
