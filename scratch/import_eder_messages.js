const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function importEderRealMsgs() {
  const ticket = await prisma.hrTicket.findFirst({
    where: { contactPhone: { contains: '8791338' } }
  });
  if (!ticket) return console.log('Ticket for Eder not found');

  console.log('Eder Ticket ID:', ticket.id);

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);

  const ederMsgs = [
    {
      senderType: 'EMPLOYEE',
      senderName: 'Eder - CONDOR TARUMÃ - JVS TRATAMENTOS',
      messageType: 'TEXT',
      content: 'Ta tudo aqui',
      createdAt: new Date(yesterday.setHours(10, 39, 0))
    },
    {
      senderType: 'EMPLOYEE',
      senderName: 'Eder - CONDOR TARUMÃ - JVS TRATAMENTOS',
      messageType: 'DOCUMENT',
      content: '📎 Whatsapp Scan 12 de agosto de 2026 at 10.41.24.pdf',
      mediaFileName: 'Whatsapp Scan 12 de agosto de 2026 at 10.41.24.pdf',
      mediaMimeType: 'application/pdf',
      createdAt: new Date(yesterday.setHours(10, 41, 0))
    },
    {
      senderType: 'ATTENDANT',
      senderName: 'Atendente RH',
      messageType: 'DOCUMENT',
      content: '📎 GUIA - EDER GONÇALVES.pdf',
      mediaFileName: 'GUIA - EDER GONÇALVES.pdf',
      mediaMimeType: 'application/pdf',
      createdAt: new Date(yesterday.setHours(16, 56, 0))
    },
    {
      senderType: 'ATTENDANT',
      senderName: 'Atendente RH',
      messageType: 'TEXT',
      content: 'Local: Rua XV de Novembro784 Centro Curitiba PR 13/09/2026 as 10:15',
      createdAt: new Date(yesterday.setHours(16, 57, 0))
    },
    {
      senderType: 'EMPLOYEE',
      senderName: 'Eder - CONDOR TARUMÃ - JVS TRATAMENTOS',
      messageType: 'TEXT',
      content: '👍',
      createdAt: new Date(yesterday.setHours(16, 57, 30))
    }
  ];

  for (const m of ederMsgs) {
    const exists = await prisma.hrTicketMessage.findFirst({
      where: { ticketId: ticket.id, content: m.content }
    });
    if (!exists) {
      await prisma.hrTicketMessage.create({
        data: {
          ticketId: ticket.id,
          senderType: m.senderType,
          senderName: m.senderName,
          messageType: m.messageType,
          content: m.content,
          mediaFileName: m.mediaFileName || null,
          mediaMimeType: m.mediaMimeType || null,
          status: 'DELIVERED',
          createdAt: m.createdAt
        }
      });
    }
  }

  await prisma.hrTicket.update({
    where: { id: ticket.id },
    data: { updatedAt: new Date() }
  });

  console.log('✅ Eder real messages imported successfully!');
  await prisma.$disconnect();
}
importEderRealMsgs();
