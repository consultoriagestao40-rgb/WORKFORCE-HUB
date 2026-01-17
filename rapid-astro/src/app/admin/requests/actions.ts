"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCurrentUserRole, getCurrentUser } from "@/lib/auth";

export async function getAdminRequests() {
    // Optionally check permissions
    // const role = await getCurrentUserRole();
    // if (!['ADMIN', 'COORD_RH', 'ASSIST_RH'].includes(role)) return [];

    return await prisma.request.findMany({
        include: {
            requester: { select: { name: true } },
            resolver: { select: { name: true } },
            employee: { select: { name: true, role: { select: { name: true } } } }
        },
        orderBy: [
            { status: 'asc' }, // PENDENTE first
            { createdAt: 'desc' }
        ]
    });
}

export async function updateRequestStatus(id: string, newStatus: string) {
    const userRole = await getCurrentUserRole();
    if (userRole === 'SUPERVISOR') throw new Error("Unauthorized");

    await prisma.request.update({
        where: { id },
        data: { status: newStatus as any }
    });

    revalidatePath("/admin/requests");
    revalidatePath("/mobile/requests");
}

export async function resolveRequest(formData: FormData) {
    const user = await getCurrentUser();
    if (!user || user.role === 'SUPERVISOR') throw new Error("Unauthorized");

    const id = formData.get("id") as string;
    const notes = formData.get("notes") as string;

    await prisma.request.update({
        where: { id },
        data: {
            status: "CONCLUIDO",
            resolutionNotes: notes,
            resolverId: user.id
        }
    });

    revalidatePath("/admin/requests");
    revalidatePath("/mobile/requests");
}

export async function deleteRequest(id: string) {
    const restriction = await getCurrentUserRole();
    if (restriction !== 'ADMIN') throw new Error("Unauthorized");

    await prisma.request.delete({
        where: { id }
    });

    revalidatePath("/admin/requests");
}
