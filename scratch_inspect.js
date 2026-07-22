const { PrismaClient } = require("@prisma/client");

async function main() {
    console.log("=== INSPECTING DB EMPLOYEES ===");
    const prisma = new PrismaClient();

    try {
        const employeeCount = await prisma.employee.count();
        console.log(`Total employees in DB: ${employeeCount}`);

        const activeCount = await prisma.employee.count({ where: { status: "Ativo" } });
        console.log(`Employees with status 'Ativo': ${activeCount}`);

        const desligadoCount = await prisma.employee.count({ where: { status: "Desligado" } });
        console.log(`Employees with status 'Desligado': ${desligadoCount}`);

        // Let's print unique status values
        const statuses = await prisma.employee.groupBy({
            by: ['status'],
            _count: {
                _all: true
            }
        });
        console.log("Employees by status:", statuses);

        // Let's print unique situation names
        const situations = await prisma.employee.groupBy({
            by: ['situationId'],
            _count: {
                _all: true
            }
        });
        console.log("Employees by situationId:", situations);
    } catch (err) {
        console.error("Error:", err.message);
    }
    await prisma.$disconnect();
}

main().catch(console.error);
