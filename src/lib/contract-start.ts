import { prisma } from "@/lib/db";

/**
 * Mês de início do contrato (chave ano*12+mês): primeira presença/apontamento lançado
 * nos postos do cliente; se ainda não houver, a data de cadastro do cliente.
 */
export async function getContractStart(clientIds: string[]): Promise<{ key: number; year: number; month: number }> {
    const first = await prisma.attendance.findFirst({
        where: { posto: { clientId: { in: clientIds } } },
        orderBy: { date: "asc" },
        select: { date: true },
    });
    let d = first?.date;
    if (!d) {
        const c = await prisma.client.findFirst({
            where: { id: { in: clientIds } },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
        });
        d = c?.createdAt || new Date();
    }
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    return { key: year * 12 + month, year, month };
}

export function applyContractStart<T extends { monthIndex: number }>(months: T[], year: number, startKey: number) {
    return months.map(m =>
        year * 12 + m.monthIndex < startKey
            ? { ...m, expectedBilling: 0, glosas: 0, netBilling: 0, effectiveness: null, totalShifts: 0, vacantShifts: 0, beforeStart: true }
            : { ...m, beforeStart: false }
    );
}
