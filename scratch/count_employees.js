const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const count = await prisma.employee.count();
    console.log(`Total de colaboradores no banco local: ${count}`);
    if (count > 0) {
        const first = await prisma.employee.findFirst();
        console.log("Primeiro colaborador no banco:", first);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
