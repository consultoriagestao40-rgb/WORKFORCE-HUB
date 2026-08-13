const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectEncarregada() {
  const ticket = await prisma.hrTicket.findFirst({
    where: {
      OR: [
        { contactName: { contains: 'Encarregada' } },
        { title: { contains: 'Encarregada' } },
        { contactPhone: { contains: '219039691493570' } }
      ]
    },
    include: { messages: { orderBy: { createdAt: 'asc' } } }
  });

  console.log('Ticket ID:', ticket?.id);
  console.log('Title:', ticket?.title);
  console.log('Contact Phone:', ticket?.contactPhone);
  console.log('Contact Name:', ticket?.contactName);
  console.log('Messages count:', ticket?.messages.length);
  console.log('Messages:');
  ticket?.messages.forEach((m, idx) => {
    console.log(`[${idx+1}] ID: ${m.id} | SenderType: "${m.senderType}" | SenderName: "${m.senderName}" | Content: "${m.content}" | Status: "${m.status}" | zapiId: ${m.zapiMessageId}`);
  });

  await prisma.$disconnect();
}
inspectEncarregada();
