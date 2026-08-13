const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findLeticia() {
  console.log("🔍 Buscando Letícia Medeiros no banco de dados...");

  const candidate = await prisma.recruitmentCandidate.findFirst({
    where: {
      OR: [
        { name: { contains: 'Letícia' } },
        { phone: { contains: '91478124' } }
      ]
    },
    include: { whatsappMessages: true }
  });
  console.log('Candidato:', JSON.stringify(candidate, null, 2));

  const employee = await prisma.employee.findFirst({
    where: {
      OR: [
        { name: { contains: 'Letícia' } },
        { phone: { contains: '91478124' } }
      ]
    }
  });
  console.log('Employee:', JSON.stringify(employee, null, 2));

  const ticket = await prisma.hrTicket.findFirst({
    where: {
      OR: [
        { contactName: { contains: 'Letícia' } },
        { contactPhone: { contains: '91478124' } }
      ]
    },
    include: { messages: true }
  });
  console.log('Ticket:', JSON.stringify(ticket, null, 2));

  await prisma.$disconnect();
}
findLeticia();
