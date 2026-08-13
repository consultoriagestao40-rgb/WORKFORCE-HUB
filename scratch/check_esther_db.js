const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEstherDb() {
  const ticket = await prisma.hrTicket.findFirst({
    where: { contactPhone: { contains: '98953852' } },
    include: { messages: { orderBy: { createdAt: 'asc' } } }
  });

  console.log('Ticket Esther Almeida:', ticket?.id, ticket?.contactName);
  if (ticket) {
    ticket.messages.forEach(m => {
      console.log(`- [${m.createdAt.toISOString()}] Type: ${m.messageType} | Content: ${m.content}`);
    });
  }

  await prisma.$disconnect();
}

checkEstherDb();
