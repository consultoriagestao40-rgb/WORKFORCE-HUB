const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function importLeticiaReal() {
  const ticket = await prisma.hrTicket.findFirst({
    where: { contactPhone: { contains: '91478124' } }
  });
  if (!ticket) return console.log('Ticket not found');

  console.log('Ticket found:', ticket.id, ticket.contactName);

  // Clear placeholder message
  await prisma.hrTicketMessage.deleteMany({ where: { ticketId: ticket.id } });

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 3600 * 1000);

  const realMsgs = [
    { senderType: 'EMPLOYEE', senderName: 'Letícia Medeiros', content: 'Já fiz', createdAt: new Date(twoDaysAgo.setHours(8, 48, 0)) },
    { senderType: 'EMPLOYEE', senderName: 'Letícia Medeiros', content: '> Olá, tudo bem?\nEssa vaga vcs não tem mais', createdAt: new Date(twoDaysAgo.setHours(8, 49, 0)) },
    { senderType: 'ATTENDANT', senderName: 'Atendente RH', content: 'Temos sim', createdAt: new Date(twoDaysAgo.setHours(9, 31, 0)) },
    { senderType: 'ATTENDANT', senderName: 'Atendente RH', content: 'Você tem interesse? Se tiver vou te enviar uma relação de documentos daí você consegue me enviar ainda hoje?', createdAt: new Date(twoDaysAgo.setHours(9, 32, 0)) },
    { senderType: 'EMPLOYEE', senderName: 'Letícia Medeiros', content: 'Tenho sim', createdAt: new Date(twoDaysAgo.setHours(9, 32, 30)) },
    { senderType: 'EMPLOYEE', senderName: 'Letícia Medeiros', content: 'Boa tarde', createdAt: new Date(yesterday.setHours(14, 27, 0)) },
    { senderType: 'EMPLOYEE', senderName: 'Letícia Medeiros', content: 'Não deu nada a vaga', createdAt: new Date(yesterday.setHours(14, 28, 0)) },
    { senderType: 'ATTENDANT', senderName: 'Atendente RH', content: 'Vou te encaminhar para o Supervisor fazer contato', createdAt: new Date(yesterday.setHours(14, 59, 0)) }
  ];

  for (const m of realMsgs) {
    await prisma.hrTicketMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: m.senderType,
        senderName: m.senderName,
        messageType: 'TEXT',
        content: m.content,
        status: 'DELIVERED',
        createdAt: m.createdAt
      }
    });
  }

  await prisma.hrTicket.update({
    where: { id: ticket.id },
    data: { updatedAt: new Date() }
  });

  console.log('✅ Real messages for Letícia Medeiros imported into DB!');
  await prisma.$disconnect();
}
importLeticiaReal();
