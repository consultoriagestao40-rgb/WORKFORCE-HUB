import { prisma } from "@/lib/db";

/**
 * Mês de início do contrato (chave ano*12+mês): primeira presença/apontamento lançado
 * nos postos do cliente; se ainda não houver, a data de cadastro do cliente.
 */
export async function getContractStart(clientIds: string[]): Promise<{ key: number; year: number; month: number; date: Date }> {
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
    return { key: year * 12 + month, year, month, date: new Date(Date.UTC(year, month, d.getUTCDate())) };
}

/** Soma dos itens extras APROVADOS pelo cliente, por mês (0-11) do ano. */
export async function getApprovedExtrasByMonth(clientIds: string[], year: number): Promise<Record<number, number>> {
    const items = await prisma.billingExtraItem.findMany({
        where: { clientId: { in: clientIds }, year, status: "APPROVED" },
        select: { month: true, total: true },
    });
    const map: Record<number, number> = {};
    items.forEach(i => { map[i.month] = (map[i.month] || 0) + i.total; });
    return map;
}

export function applyContractStart<T extends { monthIndex: number; netBilling: number }>(
    months: T[], year: number, startKey: number, extras: Record<number, number> = {}
) {
    return months.map(m => {
        if (year * 12 + m.monthIndex < startKey) {
            return { ...m, expectedBilling: 0, glosas: 0, netBilling: 0, effectiveness: null, totalShifts: 0, vacantShifts: 0, beforeStart: true, extras: 0 };
        }
        const ex = extras[m.monthIndex] || 0;
        return { ...m, netBilling: m.netBilling + ex, extras: ex, beforeStart: false };
    });
}
