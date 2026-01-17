
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Fixing orphaned logs...");
    const logs = await prisma.log.findMany({
        where: { employeeId: null },
    });

    console.log(`Found ${logs.length} orphaned logs.`);

    for (const log of logs) {
        // Log details format: "Colaborador NAME movido..." or "desvinculado..."
        // Extract name? No, names are not unique. 
        // Better: We can't easily link back without ID.
        // Wait, for LOTACAO/DESVINCULACAO, we might not have enough info in 'details' unless name is unique.
        // However, I can try to regex the name.

        // Let's look at recent assignments for the name.
        // "Colaborador Maria Santos movido para..."
        const match = log.details.match(/Colaborador (.*?) (movido|desvinculado)/);
        if (match && match[1]) {
            const name = match[1];
            // Find employee by name (risky if duplicates, but best effort)
            const emp = await prisma.employee.findFirst({ where: { name } });
            if (emp) {
                await prisma.log.update({
                    where: { id: log.id },
                    data: { employeeId: emp.id }
                });
                console.log(`Linked log ${log.id} to ${emp.name}`);
            }
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
