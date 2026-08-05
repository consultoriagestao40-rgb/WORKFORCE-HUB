const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const postos = await prisma.posto.findMany({
    where: { client: { name: { contains: 'ERASTO' } } },
    include: {
      assignments: { where: { endDate: null } },
      vacancies: { where: { status: 'OPEN' } }
    }
  });
  console.log(JSON.stringify(postos.map(p => ({
    id: p.id,
    roleId: p.roleId,
    activeAssignments: p.assignments.length,
    openVacancies: p.vacancies.length
  })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
