const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixEstherMissingText() {
  const ticket = await prisma.hrTicket.findFirst({
    where: { contactPhone: { contains: '98953852' } }
  });

  if (!ticket) return console.log('Esther Almeida not found');

  console.log('Inserting missing text message for Esther Almeida:', ticket.id);

  const msg1 = await prisma.hrTicketMessage.create({
    data: {
      ticketId: ticket.id,
      senderType: 'EMPLOYEE',
      senderName: 'Esther Almeida 💙💛🖤',
      messageType: 'TEXT',
      content: 'Ola têm vaga pra limpeza de 4 ou 6 horas',
      status: 'RECEIVED',
      createdAt: new Date('2026-08-13T14:45:00.000Z')
    }
  });

  await prisma.hrTicket.update({
    where: { id: ticket.id },
    data: { updatedAt: new Date() }
  });

  console.log(`✅ Text message inserted for Esther Almeida: [${msg1.id}]!`);
  await prisma.$disconnect();
}

fixEstherMissingText();
