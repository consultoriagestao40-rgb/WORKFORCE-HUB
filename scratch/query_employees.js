require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const rawCount = await prisma.$queryRaw`SELECT COUNT(*) FROM "Employee"`;
    console.log("Raw count:", rawCount);
    
    const prismaCount = await prisma.employee.count();
    console.log("Prisma count:", prismaCount);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
