"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface EpiItemInput {
    name: string;
    type: string; // "EPI" | "UNIFORME"
    caNumber?: string | null;
    unit: string;
    stockQuantity: number;
    minStockQuantity: number;
    size?: string | null;
}

export interface EpiDeliveryInput {
    employeeId: string;
    epiItemId: string;
    quantity: number;
    deliveryDate: string;
    merCode: number;
    notes?: string | null;
}

export async function getEpiItems() {
    try {
        return await prisma.epiItem.findMany({
            orderBy: { name: "asc" }
        });
    } catch (e: any) {
        console.error("Error fetching EPI items:", e);
        throw new Error(e.message || "Erro ao buscar itens de EPI/Uniforme.");
    }
}

export async function createEpiItem(input: EpiItemInput) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");

        const newItem = await prisma.epiItem.create({
            data: {
                name: input.name,
                type: input.type,
                caNumber: input.caNumber || null,
                unit: input.unit || "unidade",
                stockQuantity: input.stockQuantity || 0,
                minStockQuantity: input.minStockQuantity || 0,
                size: input.size || null
            }
        });

        revalidatePath("/admin/disciplinary"); // generic revalidation
        return newItem;
    } catch (e: any) {
        console.error("Error creating EPI item:", e);
        throw new Error(e.message || "Erro ao cadastrar item de EPI/Uniforme.");
    }
}

export async function updateEpiItem(id: string, input: Partial<EpiItemInput>) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");

        const updated = await prisma.epiItem.update({
            where: { id },
            data: {
                name: input.name,
                type: input.type,
                caNumber: input.caNumber !== undefined ? input.caNumber : undefined,
                unit: input.unit,
                stockQuantity: input.stockQuantity,
                minStockQuantity: input.minStockQuantity,
                size: input.size !== undefined ? input.size : undefined
            }
        });

        return updated;
    } catch (e: any) {
        console.error("Error updating EPI item:", e);
        throw new Error(e.message || "Erro ao atualizar item de EPI/Uniforme.");
    }
}

export async function deleteEpiItem(id: string) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");

        // Check if there are active deliveries linked to this item
        const count = await prisma.epiDelivery.count({
            where: { epiItemId: id }
        });

        if (count > 0) {
            throw new Error("Este item não pode ser excluído pois existem fichas de entrega vinculadas a ele.");
        }

        await prisma.epiItem.delete({
            where: { id }
        });

        return { success: true };
    } catch (e: any) {
        console.error("Error deleting EPI item:", e);
        throw new Error(e.message || "Erro ao excluir item de EPI/Uniforme.");
    }
}

export async function getEmployeeEpiDeliveries(employeeId: string) {
    try {
        return await prisma.epiDelivery.findMany({
            where: { employeeId },
            include: {
                epiItem: true,
                deliveredBy: {
                    select: { name: true }
                }
            },
            orderBy: { deliveryDate: "desc" }
        });
    } catch (e: any) {
        console.error("Error fetching employee deliveries:", e);
        throw new Error(e.message || "Erro ao carregar entregas do colaborador.");
    }
}

export async function createEpiDelivery(input: EpiDeliveryInput) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");

        // Validate stock
        const epiItem = await prisma.epiItem.findUnique({
            where: { id: input.epiItemId }
        });

        if (!epiItem) {
            throw new Error("Item de EPI/Uniforme não encontrado.");
        }

        if (epiItem.stockQuantity < input.quantity) {
            throw new Error(`Estoque insuficiente! Saldo atual: ${epiItem.stockQuantity} ${epiItem.unit}(s).`);
        }

        const delivery = await prisma.$transaction(async (tx) => {
            // Deduct stock
            await tx.epiItem.update({
                where: { id: input.epiItemId },
                data: {
                    stockQuantity: {
                        decrement: input.quantity
                    }
                }
            });

            // Create delivery log
            return await tx.epiDelivery.create({
                data: {
                    employeeId: input.employeeId,
                    epiItemId: input.epiItemId,
                    quantity: input.quantity,
                    deliveryDate: new Date(input.deliveryDate + "T12:00:00"),
                    merCode: input.merCode,
                    deliveredById: user.id,
                    notes: input.notes || null
                },
                include: {
                    epiItem: true
                }
            });
        });

        return delivery;
    } catch (e: any) {
        console.error("Error registering EPI delivery:", e);
        throw new Error(e.message || "Erro ao registrar entrega de EPI.");
    }
}

export async function deleteEpiDelivery(id: string) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");

        const delivery = await prisma.epiDelivery.findUnique({
            where: { id }
        });

        if (!delivery) {
            throw new Error("Registro de entrega não encontrado.");
        }

        await prisma.$transaction(async (tx) => {
            // Restore stock
            await tx.epiItem.update({
                where: { id: delivery.epiItemId },
                data: {
                    stockQuantity: {
                        increment: delivery.quantity
                    }
                }
            });

            // Delete delivery
            await tx.epiDelivery.delete({
                where: { id }
            });
        });

        return { success: true };
    } catch (e: any) {
        console.error("Error deleting EPI delivery:", e);
        throw new Error(e.message || "Erro ao cancelar entrega de EPI.");
    }
}

export async function getEpiPrintData(employeeId: string) {
    try {
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: {
                company: true,
                assignments: {
                    where: { endDate: null },
                    include: {
                        posto: {
                            include: {
                                role: true
                            }
                        }
                    }
                },
                role: true,
                epiDeliveries: {
                    include: {
                        epiItem: true,
                        deliveredBy: true
                    },
                    orderBy: { deliveryDate: "asc" }
                }
            }
        });

        if (!employee) throw new Error("Colaborador não encontrado.");

        return employee;
    } catch (e: any) {
        console.error("Error getting EPI print data:", e);
        throw new Error("Erro ao obter dados da ficha de entrega.");
    }
}

export async function updateEmployeeSizes(employeeId: string, sizes: { camiseta?: string; calca?: string; luvas?: string; sapato?: string }) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");

        const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!employee) throw new Error("Colaborador não encontrado.");

        const extra = (employee.extraFields as any) || {};
        extra.camisetaTamanho = sizes.camiseta;
        extra.calcaTamanho = sizes.calca;
        extra.luvasTamanho = sizes.luvas;
        extra.sapatoTamanho = sizes.sapato;

        await prisma.employee.update({
            where: { id: employeeId },
            data: { extraFields: extra }
        });

        return { success: true };
    } catch (e: any) {
        console.error("Error updating employee sizes:", e);
        throw new Error("Erro ao salvar tamanhos do colaborador.");
    }
}
