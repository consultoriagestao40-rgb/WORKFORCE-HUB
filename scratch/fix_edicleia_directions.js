const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixEdicleiaDirections() {
  const ticket = await prisma.hrTicket.findFirst({
    where: { contactPhone: { contains: '91132582' } },
    include: { messages: { orderBy: { createdAt: 'asc' } } }
  });

  if (!ticket) return console.log('Edicleia not found');

  console.log('Fixing message directions for Edicleia:', ticket.id);

  // Messages "Bom dia" and "Vou providenciar" sent by RH Attendant
  for (const m of ticket.messages) {
    if (m.content === 'Bom dia' || m.content === 'Vou providenciar' || m.content.includes('Você:')) {
      await prisma.hrTicketMessage.update({
        where: { id: m.id },
        data: {
          senderType: 'ATTENDANT',
          senderName: 'Atendente RH',
          status: 'SENT'
        }
      });
      console.log(`Updated message [${m.content}] => ATTENDANT (Right Green Bubble)`);
    }
  }

  await prisma.$disconnect();
}
fixEdicleiaDirections();
