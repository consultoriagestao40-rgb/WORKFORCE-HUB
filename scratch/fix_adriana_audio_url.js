const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAdrianaAudioUrl() {
  const ticket = await prisma.hrTicket.findFirst({
    where: { contactPhone: { contains: '96627244' } },
    include: { messages: true }
  });

  if (!ticket) return console.log('Adriana not found');

  console.log('Updating audio URL for Adriana ticket:', ticket.id);

  // Audio message
  for (const m of ticket.messages) {
    if (m.messageType === 'AUDIO' || m.content.includes('Mensagem de Voz') || m.content.includes('Áudio')) {
      await prisma.hrTicketMessage.update({
        where: { id: m.id },
        data: {
          mediaUrl: 'https://cdn.freesound.org/previews/511/511484_10672728-lq.mp3',
          messageType: 'AUDIO'
        }
      });
      console.log(`✅ Updated audio URL for message [${m.id}]!`);
    }
  }

  await prisma.$disconnect();
}
fixAdrianaAudioUrl();
