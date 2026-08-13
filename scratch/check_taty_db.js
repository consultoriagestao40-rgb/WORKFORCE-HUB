const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTaty() {
  const ticket = await prisma.hrTicket.findFirst({
    where: { contactPhone: { contains: '98931338' } },
    include: { messages: { orderBy: { createdAt: 'asc' } } }
  });
  console.log('Ticket Taty:', ticket?.id, ticket?.title, ticket?.contactPhone);
  console.log('HR Messages Count:', ticket?.messages.length);
  ticket?.messages.forEach(m => {
    console.log(`- [${m.createdAt.toISOString()}] ${m.senderType} (${m.senderName}): ${m.content}`);
  });

  const candidateMsgs = await prisma.recruitmentWhatsAppMessage.findMany({
    where: { candidate: { phone: { contains: '98931338' } } }
  });
  console.log('Candidate Msgs Count:', candidateMsgs.length);

  await prisma.$disconnect();
}
checkTaty();
