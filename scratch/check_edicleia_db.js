const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEdicleia() {
  const ticket = await prisma.hrTicket.findFirst({
    where: { contactPhone: { contains: '91132582' } },
    include: { messages: { orderBy: { createdAt: 'asc' } } }
  });
  console.log('Ticket Edicleia:', ticket?.id, ticket?.contactName, ticket?.contactPhone);
  ticket?.messages.forEach(m => {
    console.log(`- [${m.createdAt.toISOString()}] ID: ${m.id} | Type: ${m.senderType} | Name: ${m.senderName} | Content: ${m.content}`);
  });
  await prisma.$disconnect();
}
checkEdicleia();
