const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setAdrianaStaticAudio() {
  const ticket = await prisma.hrTicket.findFirst({
    where: { contactPhone: { contains: '96627244' } },
    include: { messages: true }
  });

  if (!ticket) return console.log('Adriana ticket not found');

  console.log('Setting static audio for Adriana ticket:', ticket.id);

  for (const m of ticket.messages) {
    if (m.messageType === 'AUDIO' || m.content.includes('Mensagem de Voz') || m.content.includes('Áudio')) {
      await prisma.hrTicketMessage.update({
        where: { id: m.id },
        data: {
          mediaUrl: '/sample-voice.mp3',
          messageType: 'AUDIO'
        }
      });
      console.log(`✅ Set mediaUrl to '/sample-voice.mp3' for message [${m.id}]!`);
    }
  }

  await prisma.$disconnect();
}
setAdrianaStaticAudio();
