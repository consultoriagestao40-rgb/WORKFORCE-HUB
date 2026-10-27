"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export interface ClientServicePlanPosto {
    id: string;
    roleName: string;
    schedule: string;
    startTime: string;
    endTime: string;
    isReservaTecnica: boolean;
    employees: Array<{ id: string; name: string }>;
    routines: Array<{ id: string; startTime: string; duration: string; endTime: string; location: string; activity: string }>;
}

/**
 * Plano de Serviços do portal do cliente: devolve TODOS os postos ativos do contrato,
 * com os colaboradores alocados hoje e as rotinas de trabalho realmente cadastradas em cada posto.
 */
export async function getClientServicePlan(clientId: string) {
    try {
        const user = await getCurrentUser();
        if (!user) return { success: false as const, error: "Não autorizado." };

        if (user.role === "CLIENTE") {
            if (!(user.clientIds || []).includes(clientId)) {
                return { success: false as const, error: "Sem permissão para este contrato." };
            }
        } else if (!["ADMIN", "COORD_RH", "ASSIST_RH"].includes(String(user.role))) {
            return { success: false as const, error: "Sem permissão." };
        }

        const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: { id: true, name: true, address: true },
        });
        if (!client) return { success: false as const, error: "Contrato não encontrado." };

        const postos = await prisma.posto.findMany({
            where: { clientId, status: "ATIVO" },
            include: {
                role: { select: { name: true } },
                workRoutines: { orderBy: { startTime: "asc" } },
                assignments: {
                    where: { endDate: null },
                    include: { employee: { select: { id: true, name: true, status: true } } },
                },
            },
            orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
        });

        const result: ClientServicePlanPosto[] = postos.map(p => ({
            id: p.id,
            roleName: p.role?.name || "Função não informada",
            schedule: p.schedule || "",
            startTime: p.startTime,
            endTime: p.endTime,
            isReservaTecnica: p.isReservaTecnica,
            employees: p.assignments
                .filter(a => a.employee && a.employee.status === "Ativo")
                .map(a => ({ id: a.employee.id, name: a.employee.name }))
                .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
            routines: p.workRoutines.map(r => ({
                id: r.id,
                startTime: r.startTime,
                duration: r.duration,
                endTime: r.endTime,
                location: r.location,
                activity: r.activity,
            })),
        }));

        return {
            success: true as const,
            client: { id: client.id, name: client.name, address: client.address },
            postos: result,
        };
    } catch (error) {
        console.error("Erro ao buscar plano de serviços do cliente:", error);
        return { success: false as const, error: "Erro ao carregar o plano de serviços." };
    }
}
