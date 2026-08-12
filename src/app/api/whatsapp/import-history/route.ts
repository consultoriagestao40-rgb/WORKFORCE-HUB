import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Endpoint para Importação Massiva de Histórico do WhatsApp Web para o Banco de Dados.
 * POST /api/whatsapp/import-history
 * 
 * Payload:
 * {
 *   phone: "120363424323061540" | "554198931338",
 *   contactName: "Taxas Up! Serviços",
 *   isGroup: true,
 *   messages: [
 *     {
 *       senderType: "EMPLOYEE" | "ATTENDANT",
 *       senderName: "Nome do Contato",
 *       content: "Texto da mensagem",
 *       createdAt: "2026-07-31T10:50:00Z"
 *     }
 *   ]
 * }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { phone, contactName, isGroup, messages } = body;

        if (!phone || !Array.isArray(messages)) {
            return NextResponse.json({ error: "Telefone e array de mensagens são obrigatórios." }, { status: 400 });
        }

        const cleanPhone = phone.replace(/\D/g, "");
        const phoneSearch = cleanPhone.slice(-9);

        // 1. Encontrar ou criar o ticket de atendimento
        let ticket = await prisma.hrTicket.findFirst({
            where: {
                OR: [
                    { contactPhone: { contains: phoneSearch } },
                    { contactPhone: { contains: cleanPhone } }
                ]
            }
        });

        if (!ticket) {
            let inboxStage = await prisma.hrPipelineStage.findFirst({ where: { isDefault: true } });
            if (!inboxStage) inboxStage = await prisma.hrPipelineStage.findFirst({ orderBy: { order: "asc" } });
            if (!inboxStage) {
                inboxStage = await prisma.hrPipelineStage.create({
                    data: { name: "INBOX", color: "#6366f1", order: 0, isDefault: true }
                });
            }

            ticket = await prisma.hrTicket.create({
                data: {
                    title: `Atendimento: ${contactName || phone}`,
                    contactPhone: cleanPhone,
                    contactName: contactName || `Contato (${cleanPhone.slice(-4)})`,
                    stageId: inboxStage.id,
                    status: "OPEN"
                }
            });
        }

        // 2. Inserir mensagens no banco de dados sem duplicar
        let insertedCount = 0;

        for (const m of messages) {
            if (!m.content) continue;

            const msgDate = m.createdAt ? new Date(m.createdAt) : new Date();

            const exists = await prisma.hrTicketMessage.findFirst({
                where: {
                    ticketId: ticket.id,
                    content: m.content
                }
            });

            if (!exists) {
                await prisma.hrTicketMessage.create({
                    data: {
                        ticketId: ticket.id,
                        senderType: m.senderType || "EMPLOYEE",
                        senderName: m.senderName || ticket.contactName,
                        messageType: m.messageType || "TEXT",
                        content: m.content,
                        mediaUrl: m.mediaUrl || null,
                        mediaFileName: m.mediaFileName || null,
                        mediaMimeType: m.mediaMimeType || null,
                        status: "DELIVERED",
                        createdAt: msgDate
                    }
                });
                insertedCount++;
            }
        }

        await prisma.hrTicket.update({
            where: { id: ticket.id },
            data: { updatedAt: new Date() }
        });

        return NextResponse.json({
            success: true,
            ticketId: ticket.id,
            totalInserted: insertedCount
        });

    } catch (e: any) {
        console.error("[Import History Error]:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
