import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log("Autentique Webhook Payload Received:", JSON.stringify(body));

        const rawEventType = body?.event?.type || body?.event?.name || body?.type || "";
        const eventType = String(rawEventType).toLowerCase().trim();
        
        const docId = body?.event?.data?.id 
            || body?.event?.data?.object?.id 
            || body?.event?.data?.document?.id 
            || body?.data?.id 
            || body?.document?.id 
            || body?.id;

        if (!docId) {
            return NextResponse.json({ message: "No document ID found in webhook payload." }, { status: 400 });
        }

        const signatures: any[] = body?.event?.data?.signatures 
            || body?.data?.signatures 
            || body?.event?.data?.object?.signatures 
            || body?.document?.signatures 
            || [];

        const hasSignedSignature = Array.isArray(signatures) && signatures.some((s: any) => s?.signed && s?.signed?.created_at);
        const allSignaturesSigned = Array.isArray(signatures) && signatures.length > 0 && signatures.every((s: any) => s?.signed && s?.signed?.created_at);
        const hasViewedSignature = Array.isArray(signatures) && signatures.some((s: any) => s?.viewed && s?.viewed?.created_at);

        // Distinguir ASSINADO vs VISUALIZADO
        const isSigned = 
            eventType === "document.finished" ||
            eventType === "document.completed" ||
            eventType === "document.signed" ||
            eventType === "signature.signed" ||
            allSignaturesSigned ||
            (eventType === "document.updated" && hasSignedSignature);

        const isViewed = 
            !isSigned && (
                eventType === "document.viewed" ||
                eventType === "signature.viewed" ||
                hasViewedSignature ||
                eventType === "document.updated"
            );

        console.log(`Autentique Webhook Process: docId=${docId}, eventType=${eventType}, isSigned=${isSigned}, isViewed=${isViewed}`);

        if (isSigned) {
            // 1. EPI Deliveries -> ASSINADO_AUTENTIQUE_<docId>
            const updatedEpis = await prisma.epiDelivery.updateMany({
                where: {
                    OR: [
                        { recipientSignature: `ENVIADO_AUTENTIQUE_${docId}` },
                        { recipientSignature: `VISUALIZADO_AUTENTIQUE_${docId}` },
                        { recipientSignature: `ASSINADO_AUTENTIQUE_${docId}` }
                    ]
                },
                data: {
                    recipientSignature: `ASSINADO_AUTENTIQUE_${docId}`
                }
            });

            // 2. Employees (Dismissal Process & Kit Admissão)
            const employees = await prisma.employee.findMany({
                where: {
                    extraFields: { not: Prisma.JsonNull }
                },
                select: { id: true, name: true, extraFields: true }
            });

            for (const emp of employees) {
                const extra = (emp.extraFields as Record<string, any>) || {};
                let changed = false;

                if (extra.dismissalProcess && extra.dismissalProcess.autentiqueDocId === docId) {
                    extra.dismissalProcess.autentiqueStatus = 'ASSINADO';
                    extra.dismissalProcess.autentiqueSignedAt = new Date().toISOString();
                    changed = true;

                    await prisma.log.create({
                        data: {
                            action: "AUTENTIQUE_AVISO_ASSINADO",
                            details: `Aviso de desligamento assinado com sucesso via Autentique pelo colaborador ${emp.name}. DocID: ${docId}`,
                            employeeId: emp.id
                        }
                    });
                }

                if (extra.kitAdmissaoProcess && extra.kitAdmissaoProcess.autentiqueDocId === docId) {
                    extra.kitAdmissaoProcess.autentiqueStatus = 'ASSINADO';
                    extra.kitAdmissaoProcess.autentiqueSignedAt = new Date().toISOString();
                    changed = true;

                    await prisma.log.create({
                        data: {
                            action: "AUTENTIQUE_KIT_ASSINADO",
                            details: `Kit de Admissão assinado com sucesso via Autentique pelo colaborador ${emp.name}. DocID: ${docId}`,
                            employeeId: emp.id
                        }
                    });
                }

                if (changed) {
                    await prisma.employee.update({
                        where: { id: emp.id },
                        data: { extraFields: extra }
                    });
                }
            }

            try {
                revalidatePath("/admin/epi");
                revalidatePath("/admin/dismissal-monitor");
                revalidatePath("/admin/employees");
            } catch (revalErr) {
                console.warn("Revalidation warning in webhook:", revalErr);
            }

            return NextResponse.json({
                success: true,
                event: "ASSINADO",
                docId,
                updatedEpisCount: updatedEpis.count
            });
        }

        if (isViewed) {
            // 1. EPI Deliveries -> VISUALIZADO_AUTENTIQUE_<docId> (apenas se ainda estiver em ENVIADO)
            const updatedEpis = await prisma.epiDelivery.updateMany({
                where: {
                    recipientSignature: `ENVIADO_AUTENTIQUE_${docId}`
                },
                data: {
                    recipientSignature: `VISUALIZADO_AUTENTIQUE_${docId}`
                }
            });

            // 2. Employees (Dismissal Process & Kit Admissão)
            const employees = await prisma.employee.findMany({
                where: {
                    extraFields: { not: Prisma.JsonNull }
                },
                select: { id: true, name: true, extraFields: true }
            });

            for (const emp of employees) {
                const extra = (emp.extraFields as Record<string, any>) || {};
                let changed = false;

                if (extra.dismissalProcess && extra.dismissalProcess.autentiqueDocId === docId) {
                    if (extra.dismissalProcess.autentiqueStatus !== 'ASSINADO') {
                        extra.dismissalProcess.autentiqueStatus = 'VISUALIZADO';
                        if (!extra.dismissalProcess.autentiqueViewedAt) {
                            extra.dismissalProcess.autentiqueViewedAt = new Date().toISOString();
                        }
                        changed = true;

                        await prisma.log.create({
                            data: {
                                action: "AUTENTIQUE_AVISO_VISUALIZADO",
                                details: `Aviso de desligamento visualizado no WhatsApp pelo colaborador ${emp.name}. DocID: ${docId}`,
                                employeeId: emp.id
                            }
                        });
                    }
                }

                if (extra.kitAdmissaoProcess && extra.kitAdmissaoProcess.autentiqueDocId === docId) {
                    if (extra.kitAdmissaoProcess.autentiqueStatus !== 'ASSINADO') {
                        extra.kitAdmissaoProcess.autentiqueStatus = 'VISUALIZADO';
                        if (!extra.kitAdmissaoProcess.autentiqueViewedAt) {
                            extra.kitAdmissaoProcess.autentiqueViewedAt = new Date().toISOString();
                        }
                        changed = true;

                        await prisma.log.create({
                            data: {
                                action: "AUTENTIQUE_KIT_VISUALIZADO",
                                details: `Kit de Admissão visualizado no WhatsApp pelo colaborador ${emp.name}. DocID: ${docId}`,
                                employeeId: emp.id
                            }
                        });
                    }
                }

                if (changed) {
                    await prisma.employee.update({
                        where: { id: emp.id },
                        data: { extraFields: extra }
                    });
                }
            }

            try {
                revalidatePath("/admin/epi");
                revalidatePath("/admin/dismissal-monitor");
                revalidatePath("/admin/employees");
            } catch (revalErr) {
                console.warn("Revalidation warning in webhook:", revalErr);
            }

            return NextResponse.json({
                success: true,
                event: "VISUALIZADO",
                docId,
                updatedEpisCount: updatedEpis.count
            });
        }

        return NextResponse.json({ message: "Event ignored (neither signed nor viewed).", eventType });
    } catch (e: any) {
        console.error("Autentique Webhook error:", e);
        return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 });
    }
}
