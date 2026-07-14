const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const counts = {
        users: await prisma.user.count(),
        companies: await prisma.company.count(),
        clients: await prisma.client.count(),
        postos: await prisma.posto.count(),
        roles: await prisma.role.count(),
        employees: await prisma.employee.count(),
        vacancies: await prisma.vacancy.count(),
        candidates: await prisma.recruitmentCandidate.count()
    };

    console.log("Contagem de registros por tabela no banco de dados:");
    console.log(JSON.stringify(counts, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
