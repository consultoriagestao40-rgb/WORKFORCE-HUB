"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getMonthlyDocsData(clientId: string, month: string) {
    try {
        if (!clientId || clientId === "all") return [];
        return await prisma.monthlyDocumentRequirement.findMany({
            where: { clientId },
            include: {
                files: {
                    where: { month }
                }
            },
            orderBy: { name: "asc" }
        });
    } catch (e: any) {
        console.error("Error in getMonthlyDocsData:", e);
        return [];
    }
}

export async function createDocumentRequirement(clientId: string, name: string, description?: string) {
    try {
        if (!clientId || clientId === "all") {
            return { error: "ID do cliente inválido." };
        }
        if (!name.trim()) {
            return { error: "O nome do documento é obrigatório." };
        }

        await prisma.monthlyDocumentRequirement.create({
            data: {
                clientId,
                name: name.trim(),
                description: description?.trim() || null
            }
        });

        revalidatePath("/admin/performance");
        return { success: true };
    } catch (e: any) {
        console.error("Error in createDocumentRequirement:", e);
        if (e.code === "P2002") {
            return { error: "Já existe uma exigência com este nome cadastrada para este cliente." };
        }
        return { error: e.message || "Erro ao criar exigência de documento." };
    }
}

export async function deleteDocumentRequirement(requirementId: string) {
    try {
        if (!requirementId) {
            return { error: "ID do requisito inválido." };
        }

        await prisma.monthlyDocumentRequirement.delete({
            where: { id: requirementId }
        });

        revalidatePath("/admin/performance");
        return { success: true };
    } catch (e: any) {
        console.error("Error in deleteDocumentRequirement:", e);
        return { error: e.message || "Erro ao excluir exigência." };
    }
}

export async function uploadMonthlyDocumentFile(
    requirementId: string,
    month: string,
    fileName: string,
    fileData: string
) {
    try {
        if (!requirementId) {
            return { error: "ID do requisito inválido." };
        }
        if (!month) {
            return { error: "Mês inválido." };
        }
        if (!fileName || !fileData) {
            return { error: "Arquivo ou dados inválidos." };
        }

        await prisma.monthlyDocumentFile.upsert({
            where: {
                requirementId_month: {
                    requirementId,
                    month
                }
            },
            update: {
                fileName,
                fileData,
                uploadedAt: new Date()
            },
            create: {
                requirementId,
                month,
                fileName,
                fileData
            }
        });

        revalidatePath("/admin/performance");
        return { success: true };
    } catch (e: any) {
        console.error("Error in uploadMonthlyDocumentFile:", e);
        return { error: e.message || "Erro ao realizar upload do arquivo." };
    }
}

export async function deleteMonthlyDocumentFile(fileId: string) {
    try {
        if (!fileId) {
            return { error: "ID do arquivo inválido." };
        }

        await prisma.monthlyDocumentFile.delete({
            where: { id: fileId }
        });

        revalidatePath("/admin/performance");
        return { success: true };
    } catch (e: any) {
        console.error("Error in deleteMonthlyDocumentFile:", e);
        return { error: e.message || "Erro ao excluir arquivo." };
    }
}
