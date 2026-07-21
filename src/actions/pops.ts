"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getPopDocuments(clientId?: string, postoId?: string) {
    try {
        const where: any = {};
        if (clientId) where.clientId = clientId;
        if (postoId) where.postoId = postoId;

        const pops = await prisma.popDocument.findMany({
            where,
            include: {
                client: { select: { id: true, name: true } },
                posto: { select: { id: true, schedule: true, role: { select: { name: true } } } },
                author: { select: { id: true, name: true } },
                approvedBy: { select: { id: true, name: true } },
                revisions: {
                    include: {
                        author: { select: { id: true, name: true } },
                        approvedBy: { select: { id: true, name: true } }
                    },
                    orderBy: { version: 'desc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return pops;
    } catch (e: any) {
        console.error("Error in getPopDocuments:", e);
        return [];
    }
}

export async function createPopDocument(formData: FormData) {
    try {
        const user = await getCurrentUser();
        if (!user) return { error: "Não autorizado." };

        const clientId = formData.get("clientId") as string;
        const postoId = (formData.get("postoId") as string) || null;
        const title = formData.get("title") as string;
        const category = (formData.get("category") as string) || "Operacional";
        const description = (formData.get("description") as string) || "";
        const content = (formData.get("content") as string) || "";
        const fileUrl = (formData.get("fileUrl") as string) || null;
        let code = (formData.get("code") as string) || "";

        if (!clientId || !title) {
            return { error: "Cliente e Título do POP são obrigatórios." };
        }

        // Auto-generate code if empty
        if (!code) {
            const count = await prisma.popDocument.count({ where: { clientId } });
            code = `POP-${String(count + 1).padStart(3, '0')}`;
        }

        const pop = await prisma.$transaction(async (tx) => {
            const newPop = await tx.popDocument.create({
                data: {
                    code,
                    title,
                    category,
                    description,
                    content,
                    fileUrl,
                    version: 1, // Rev. 00
                    status: "PENDING_APPROVAL",
                    clientId,
                    postoId: postoId === "all" ? null : postoId,
                    authorId: user.id
                }
            });

            await tx.popRevision.create({
                data: {
                    popDocumentId: newPop.id,
                    version: 1,
                    changeReason: "Emissão Inicial do POP (Rev. 00)",
                    title,
                    content,
                    fileUrl,
                    authorId: user.id,
                    status: "PENDING_APPROVAL"
                }
            });

            return newPop;
        });

        revalidatePath("/admin/performance");
        revalidatePath("/client/dashboard");

        return { success: true, pop };
    } catch (e: any) {
        console.error("Error in createPopDocument:", e);
        return { error: e.message || "Erro ao criar documento POP." };
    }
}

export async function updatePopDocument(formData: FormData) {
    try {
        const user = await getCurrentUser();
        if (!user) return { error: "Não autorizado." };

        const id = formData.get("id") as string;
        const title = formData.get("title") as string;
        const category = (formData.get("category") as string) || "Operacional";
        const description = (formData.get("description") as string) || "";
        const content = (formData.get("content") as string) || "";
        const fileUrl = (formData.get("fileUrl") as string) || null;
        const postoId = (formData.get("postoId") as string) || null;
        const changeReason = (formData.get("changeReason") as string) || "Revisão e atualização do procedimento";

        if (!id || !title) {
            return { error: "ID do documento e Título são obrigatórios." };
        }

        const currentPop = await prisma.popDocument.findUnique({ where: { id } });
        if (!currentPop) return { error: "Documento POP não encontrado." };

        const newVersion = currentPop.version + 1;

        const updated = await prisma.$transaction(async (tx) => {
            const pop = await tx.popDocument.update({
                where: { id },
                data: {
                    title,
                    category,
                    description,
                    content,
                    fileUrl,
                    postoId: postoId === "all" ? null : postoId,
                    version: newVersion,
                    status: "PENDING_APPROVAL", // Nova revisão exige novo aceite do cliente
                    approvedAt: null,
                    approvedById: null,
                    rejectionReason: null
                }
            });

            await tx.popRevision.create({
                data: {
                    popDocumentId: id,
                    version: newVersion,
                    changeReason: `Rev. ${String(newVersion - 1).padStart(2, '0')}: ${changeReason}`,
                    title,
                    content,
                    fileUrl,
                    authorId: user.id,
                    status: "PENDING_APPROVAL"
                }
            });

            return pop;
        });

        revalidatePath("/admin/performance");
        revalidatePath("/client/dashboard");

        return { success: true, updated };
    } catch (e: any) {
        console.error("Error in updatePopDocument:", e);
        return { error: e.message || "Erro ao atualizar revisão do POP." };
    }
}

export async function approvePopDocument(id: string) {
    try {
        const user = await getCurrentUser();
        if (!user) return { error: "Não autorizado." };

        const pop = await prisma.popDocument.findUnique({ where: { id } });
        if (!pop) return { error: "Documento POP não encontrado." };

        const now = new Date();

        await prisma.$transaction(async (tx) => {
            await tx.popDocument.update({
                where: { id },
                data: {
                    status: "APPROVED",
                    approvedAt: now,
                    approvedById: user.id,
                    rejectionReason: null
                }
            });

            // Update current revision entry
            const lastRevision = await tx.popRevision.findFirst({
                where: { popDocumentId: id, version: pop.version }
            });

            if (lastRevision) {
                await tx.popRevision.update({
                    where: { id: lastRevision.id },
                    data: {
                        status: "APPROVED",
                        approvedAt: now,
                        approvedById: user.id
                    }
                });
            }
        });

        revalidatePath("/admin/performance");
        revalidatePath("/client/dashboard");

        return { success: true };
    } catch (e: any) {
        console.error("Error in approvePopDocument:", e);
        return { error: e.message || "Erro ao registrar aceite do POP." };
    }
}

export async function rejectPopDocument(id: string, reason: string) {
    try {
        const user = await getCurrentUser();
        if (!user) return { error: "Não autorizado." };

        if (!reason || !reason.trim()) {
            return { error: "Por favor informe a justificativa da solicitação de revisão." };
        }

        const pop = await prisma.popDocument.findUnique({ where: { id } });
        if (!pop) return { error: "Documento POP não encontrado." };

        await prisma.$transaction(async (tx) => {
            await tx.popDocument.update({
                where: { id },
                data: {
                    status: "REJECTED",
                    rejectionReason: reason
                }
            });

            const lastRevision = await tx.popRevision.findFirst({
                where: { popDocumentId: id, version: pop.version }
            });

            if (lastRevision) {
                await tx.popRevision.update({
                    where: { id: lastRevision.id },
                    data: {
                        status: "REJECTED"
                    }
                });
            }
        });

        revalidatePath("/admin/performance");
        revalidatePath("/client/dashboard");

        return { success: true };
    } catch (e: any) {
        console.error("Error in rejectPopDocument:", e);
        return { error: e.message || "Erro ao rejeitar/solicitar revisão do POP." };
    }
}

export async function deletePopDocument(id: string) {
    try {
        const user = await getCurrentUser();
        if (!user) return { error: "Não autorizado." };

        await prisma.popDocument.delete({
            where: { id }
        });

        revalidatePath("/admin/performance");
        revalidatePath("/client/dashboard");

        return { success: true };
    } catch (e: any) {
        console.error("Error in deletePopDocument:", e);
        return { error: e.message || "Erro ao excluir documento POP." };
    }
}
