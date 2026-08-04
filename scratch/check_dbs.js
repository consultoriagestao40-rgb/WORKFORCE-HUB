require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const dbs = await prisma.$queryRaw`SELECT datname FROM pg_database`;
    console.log("Databases on host:", dbs);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
