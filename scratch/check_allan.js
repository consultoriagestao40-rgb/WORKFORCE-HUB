const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const count = await prisma.employee.count();
    console.log("Total employees:", count);
    const firstEmp = await prisma.employee.findFirst();
    console.log("First employee:", firstEmp);
    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
