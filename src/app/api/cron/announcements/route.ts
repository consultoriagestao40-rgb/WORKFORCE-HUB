import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendAnnouncement } from "@/lib/announcements";
import { isAnnouncementDue, todayInSaoPaulo } from "@/lib/announcement-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron diário das 08h00 (11:00 UTC): envia os avisos programados que vencem hoje.
 * Um aviso sai quando hoje está dentro do período e já passou o intervalo (ex.: 3 dias) desde o último envio.
 */
export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get("authorization");
        if (process.env.NODE_ENV === "production" && process.env.CRON_SECRET) {
            if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        // Respeita a chave geral "Status Geral" das notificações do RH
        const config = await prisma.rhNotificationConfig.findFirst();
        if (config && !config.isActive) {
            return NextResponse.json({ success: true, message: "Notificações desativadas globalmente" });
        }

        const today = todayInSaoPaulo();
        const candidates = await prisma.announcement.findMany({
            where: { isActive: true, startDate: { lte: today }, endDate: { gte: today } },
        });

        const sent: Array<{ id: string; title: string; whatsappSent: number; whatsappFailed: number; inAppCount: number }> = [];
        for (const a of candidates) {
            if (!isAnnouncementDue(a, today)) continue;
            try {
                const r = await sendAnnouncement(a.id);
                sent.push({ id: a.id, title: a.title, ...r });
            } catch (err) {
                console.error(`[cron/announcements] Falha ao enviar aviso ${a.id}:`, err);
            }
        }

        return NextResponse.json({ success: true, today, checked: candidates.length, sent });
    } catch (error: any) {
        console.error("[cron/announcements] Erro:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
