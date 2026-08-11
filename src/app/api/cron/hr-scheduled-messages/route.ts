import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID || "3F1993DFB59E83474F059E648AE68DF9";
const ZAPI_TOKEN = process.env.ZAPI_TOKEN || "81087A6B5C1CAB8AAAC801C4";
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || "F5c1b8f27f6b049c98c4e779d00f67552S";

/**
 * Cron Endpoint: Dispara mensagens agendadas e mensagens de aniversário pendentes
 * Pode ser chamado periodicamente pela Vercel Cron ou externo.
 */
export async function GET() {
    try {
        const now = new Date();

        // 1. Processar mensagens agendadas normais
        const pendingMsgs = await prisma.hrScheduledMessage.findMany({
            where: {
                status: "PENDING",
                scheduledAt: { lte: now }
            },
            take: 20
        });

        let sentCount = 0;

        for (const item of pendingMsgs) {
            const cleanPhone = item.phone.replace(/\D/g, "");
            const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

            try {
                const res = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Client-Token": ZAPI_CLIENT_TOKEN
                    },
                    body: JSON.stringify({ phone: finalPhone, message: item.message })
                });

                if (res.ok) {
                    await prisma.hrScheduledMessage.update({
                        where: { id: item.id },
                        data: { status: "SENT", sentAt: new Date() }
                    });

                    if (item.ticketId) {
                        await prisma.hrTicketMessage.create({
                            data: {
                                ticketId: item.ticketId,
                                senderType: "SYSTEM",
                                senderName: "Agendamento Automático",
                                content: `[Mensagem Agendada Enviada]: ${item.message}`,
                                status: "SENT"
                            }
                        });
                    }
                    sentCount++;
                } else {
                    await prisma.hrScheduledMessage.update({
                        where: { id: item.id },
                        data: { status: "FAILED" }
                    });
                }
            } catch (e) {
                console.error(`[Cron Scheduled Msg Error] ID ${item.id}:`, e);
            }
        }

        return NextResponse.json({
            success: true,
            processedCount: pendingMsgs.length,
            sentCount,
            timestamp: now.toISOString()
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
