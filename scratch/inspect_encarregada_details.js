const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectEncarregadaDetails() {
  const ticket = await prisma.hrTicket.findFirst({
    where: { contactName: { contains: 'Encarregada' } },
    include: { messages: { orderBy: { createdAt: 'asc' } } }
  });

  console.log('Ticket:', ticket.title, '| Phone:', ticket.contactPhone);
  ticket.messages.forEach(m => {
    console.log(`- ID: ${m.id} | Type: ${m.senderType} | Name: ${m.senderName} | Content: "${m.content}" | Date: ${m.createdAt.toISOString()}`);
  });

  await prisma.$disconnect();
}
inspectEncarregadaDetails();
