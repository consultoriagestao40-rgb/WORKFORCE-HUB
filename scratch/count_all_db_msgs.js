const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function countAll() {
  const hrCount = await prisma.hrTicketMessage.count();
  const candidateCount = await prisma.recruitmentWhatsAppMessage.count();
  console.log('Total HR Ticket Messages in DB:', hrCount);
  console.log('Total Candidate Messages in DB:', candidateCount);
  await prisma.$disconnect();
}
countAll();
