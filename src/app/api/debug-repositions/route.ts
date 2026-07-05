import { NextResponse } from 'next/server';
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const client = await prisma.client.findFirst({
            where: { name: { contains: "penha", mode: 'insensitive' } }
        });
        if (!client) {
            return NextResponse.json({ error: "Cliente Penha não encontrado" });
        }

        const assignments = await prisma.assignment.findMany({
            where: { posto: { clientId: client.id } },
            include: {
                posto: { include: { role: true } },
                employee: true
            },
            orderBy: { startDate: 'asc' }
        });

        // Agrupar por postoId e ordenar
        const assignmentsByPosto: { [key: string]: any[] } = {};
        assignments.forEach((a: any) => {
            if (!assignmentsByPosto[a.postoId]) {
                assignmentsByPosto[a.postoId] = [];
            }
            assignmentsByPosto[a.postoId].push(a);
        });

        const transitions: any[] = [];
        Object.keys(assignmentsByPosto).forEach((postoId) => {
            const list = assignmentsByPosto[postoId].sort((x, y) => new Date(x.startDate).getTime() - new Date(y.startDate).getTime());
            for (let i = 0; i < list.length - 1; i++) {
                const current = list[i];
                const next = list[i + 1];
                if (current.endDate) {
                    const exitDate = new Date(current.endDate);
                    const entryDate = new Date(next.startDate);
                    if (entryDate >= exitDate) {
                        const diffTime = Math.abs(entryDate.getTime() - exitDate.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        transitions.push({
                            id: `${current.id}-${next.id}`,
                            postoName: current.posto?.name || "Posto",
                            roleName: current.posto?.role?.name || "-",
                            exitedEmployee: current.employee?.name || "-",
                            exitDate: exitDate.toISOString().split('T')[0],
                            enteredEmployee: next.employee?.name || "-",
                            entryDate: entryDate.toISOString().split('T')[0],
                            entryMonth: entryDate.getMonth(), // Mês da entrada
                            entryYear: entryDate.getFullYear(),
                            diffDays
                        });
                    }
                }
            }
        });

        return NextResponse.json({
            clientName: client.name,
            totalTransitionsCount: transitions.length,
            transitions
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message, stack: err.stack });
    }
}
