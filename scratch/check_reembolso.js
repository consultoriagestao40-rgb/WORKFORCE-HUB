require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

console.log("Checking DATABASE_URL_REEMBOLSO...");
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL_REEMBOLSO
        }
    }
});

async function main() {
    const count = await prisma.$queryRaw`SELECT COUNT(*) FROM "Employee"`;
    console.log("Count in REEMBOLSO:", count);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
