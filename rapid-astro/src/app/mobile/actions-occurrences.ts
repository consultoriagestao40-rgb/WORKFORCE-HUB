"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createOccurrence(formData: FormData) {
    const postoId = formData.get("postoId") as string;
    const employeeId = formData.get("employeeId") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const type = formData.get("type") as string;
    const dateStr = formData.get("date") as string;

    if (!postoId || !title || !description || !type) {
        return { error: "Preencha todos os campos obrigatórios." };
    }

    try {
        await prisma.occurrence.create({
            data: {
                postoId,
                employeeId: employeeId || null,
                title,
                description,
                type,
                date: dateStr ? new Date(dateStr) : new Date(),
            }
        });

        revalidatePath(`/mobile/site/${postoId}`);
        revalidatePath("/admin/occurrences"); // Future path
    } catch (e: any) {
        return { error: "Erro ao criar ocorrência: " + e.message };
    }
}

import { getCurrentUserRole } from "@/lib/auth";

export async function deleteOccurrence(id: string) {
    const userRole = await getCurrentUserRole();
    if (userRole !== 'ADMIN') {
        return { error: "Apenas administradores podem excluir ocorrências." };
    }

    try {
        const occurrence = await prisma.occurrence.delete({ where: { id } });
        revalidatePath(`/mobile/site/${occurrence.postoId}`);
        revalidatePath("/admin/occurrences");
        return { success: true };
    } catch (e: any) {
        return { error: "Erro ao excluir: " + e.message };
    }
}
