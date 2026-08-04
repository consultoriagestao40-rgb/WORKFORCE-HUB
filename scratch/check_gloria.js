const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
    const gloria = await prisma.employee.findFirst({
        where: { name: { contains: "GLORIA FERREIRA" } },
        include: { situation: true }
    });
    console.log("Gloria:", gloria);
}

run().catch(console.error).finally(() => prisma.$disconnect());
