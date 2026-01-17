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

    if (!type || !description || !dueDateStr) {
        throw new Error("Missing fields");
    }

    const dueDate = new Date(dueDateStr);

    await prisma.request.create({
        data: {
            type,
            description,
            dueDate,
            requesterId: user.id,
            employeeId: employeeId || null,
            status: "PENDENTE"
        }
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
