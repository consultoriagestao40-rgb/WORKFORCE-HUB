const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const employees = await prisma.employee.findMany({
        take: 5,
        select: {
            name: true,
            cpf: true
        }
    });

    console.log("CPFs no Banco de Dados:");
    console.log(JSON.stringify(employees, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
