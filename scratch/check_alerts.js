const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
    const config = await prisma.benefitsConfig.findFirst();
    console.log("BenefitsConfig:", config);
    
    const users = await prisma.user.findMany({
        select: { id: true, name: true, role: true }
    });
    console.log("Users in DB:", users);
}

run().catch(console.error).finally(() => prisma.$disconnect());
