const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const client = await prisma.client.findFirst({
        where: { name: { contains: 'penha', mode: 'insensitive' } }
    });
    if (!client) {
        console.log("Cliente Penha não encontrado");
        return;
    }

    const assignments = await prisma.assignment.findMany({
        where: { posto: { clientId: client.id } },
        include: {
            posto: { include: { role: true } },
            employee: true
        },
        orderBy: { startDate: 'asc' }
    });

    const assignmentsByPosto = {};
    assignments.forEach((a) => {
        if (!assignmentsByPosto[a.postoId]) {
            assignmentsByPosto[a.postoId] = [];
        }
        assignmentsByPosto[a.postoId].push(a);
    });

    const transitions = [];
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
                        postoName: current.posto.name,
                        exitedEmployee: current.employee.name,
                        exitDate: exitDate.toISOString().split('T')[0],
                        enteredEmployee: next.employee.name,
                        entryDate: entryDate.toISOString().split('T')[0],
                        diffDays
                    });
                }
            }
        }
    });

    console.log("=== TRANSIÇÕES DE REPOSIÇÃO ===");
    console.log(JSON.stringify(transitions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
