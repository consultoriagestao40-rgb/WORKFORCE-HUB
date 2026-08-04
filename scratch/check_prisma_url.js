require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

console.log("DATABASE_URL from process.env:", process.env.DATABASE_URL);

async function main() {
    // Check datasource info or connect
    const result = await prisma.$queryRaw`SELECT current_database(), current_schema()`;
    console.log("Connection result:", result);
    
    // Check if there are any tables or query one row from Employee
    const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
    console.log("Tables in schema:", tables);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
