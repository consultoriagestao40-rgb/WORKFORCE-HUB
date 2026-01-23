"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";

export async function createRequest(formData: FormData) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const type = formData.get("type") as any; // Enum validation?
    const description = formData.get("description") as string;
    const dueDateStr = formData.get("dueDate") as string;
    const employeeId = formData.get("employeeId") as string;

    if (!type || !description) {
        throw new Error("Missing fields");
    }

    // Default dueDate from form, but try to override with SLA Config
    let dueDate = dueDateStr ? new Date(dueDateStr) : new Date();

    const slaConfig = await prisma.requestStageConfiguration.findUnique({
        where: { status: 'PENDENTE' }
    });

    if (slaConfig) {
        const today = new Date();
        today.setDate(today.getDate() + slaConfig.slaDays);
        dueDate = today;
    }

    await prisma.$transaction(async (tx) => {
        const newRequest = await tx.request.create({
            data: {
                type,
                description,
                dueDate,
                requesterId: user.id,
                employeeId: employeeId || null,
                status: "PENDENTE"
            }
        });

        await tx.log.create({
            data: {
                action: "SOLICITACAO_CRIADA",
                details: `Nova solicitação (${type}) criada por mobile: ${description.substring(0, 100)}...`,
                employeeId: employeeId || null,
                userId: user.id
            }
        });
    });

    revalidatePath("/mobile/requests");
    revalidatePath("/admin/requests");
}

export async function getMobileRequests() {
    const user = await getCurrentUser();
    if (!user) return [];

    return await prisma.request.findMany({
        where: { requesterId: user.id },
        include: {
            employee: { select: { name: true, role: { select: { name: true } } } }
        },
        orderBy: { createdAt: 'desc' }
    });
}

export async function cancelRequest(id: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const request = await prisma.request.findUnique({
        where: { id }
    });

    if (!request) throw new Error("Request not found");
    if (request.requesterId !== user.id) throw new Error("Unauthorized");
    if (request.status !== "PENDENTE") throw new Error("Only pending requests can be canceled");

    await prisma.request.update({
        where: { id },
        data: { status: "CANCELADO" }
    });

    revalidatePath("/mobile/requests");
    revalidatePath("/admin/requests");
}
