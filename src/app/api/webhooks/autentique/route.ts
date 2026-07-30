import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log("Autentique Webhook Payload Received:", JSON.stringify(body));

        const eventType = body?.event?.type;
        const docId = body?.event?.data?.id || body?.event?.data?.object?.id;

        if (!docId) {
            return NextResponse.json({ message: "No document ID found. Checked body.event.data.id and body.event.data.object.id." }, { status: 400 });
        }

        // Check if the event indicates document was signed or completed
        if (eventType === "document.signed" || eventType === "document.finished" || eventType === "document.completed" || eventType === "document.updated") {
            console.log(`Document signed/finished: ${docId}. Marking deliveries as ASSINADO.`);
            
            await prisma.epiDelivery.updateMany({
                where: {
                    recipientSignature: `ENVIADO_AUTENTIQUE_${docId}`
                },
                data: {
                    recipientSignature: "ASSINADO"
                }
            });
            
            return NextResponse.json({ success: true, message: "Status updated successfully." });
        }

        return NextResponse.json({ message: "Event ignored." });
    } catch (e: any) {
        console.error("Autentique Webhook error:", e);
        return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 });
    }
}
