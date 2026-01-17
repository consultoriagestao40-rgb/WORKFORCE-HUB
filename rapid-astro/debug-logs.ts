
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Checking Logs...");
    const logs = await prisma.log.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: { employee: true }
    });

    console.log("Last 10 Logs:");
    logs.forEach(l => {
        console.log(`[${l.timestamp.toISOString()}] Action: ${l.action} | EmpID: ${l.employeeId} | Details: ${l.details}`);
    });

    const empId = "7931745e-7537-4ab7-ba30-977081a8bf91"; // ID from user screenshot roughly
    // Or just search by action
    const roleLogs = await prisma.log.findMany({
        where: { action: "PROMOCAO_CARGO" },
        orderBy: { timestamp: 'desc' }
    });
    console.log("\nRole Logs:", roleLogs);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
