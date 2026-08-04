const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("Checking DB employees...");
    const count = await prisma.employee.count();
    console.log("Total count:", count);
    
    const sample = await prisma.employee.findMany({
        take: 5,
        select: { name: true, cpf: true }
    });
    console.log("Samples:", sample);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
