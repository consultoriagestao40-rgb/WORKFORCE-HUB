const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function importEdinaReal() {
  const ticket = await prisma.hrTicket.findFirst({
    where: { contactPhone: { contains: '996847822' } }
  });
  if (!ticket) return console.log('Ticket for Edina not found');

  console.log('Edina Ticket ID:', ticket.id);

  // Tuesday August 11th, 2026
  const tuesday = new Date('2026-08-11T12:00:00.000Z');

  const edinaMsgs = [
    {
      senderType: 'EMPLOYEE',
      senderName: 'EDINA DA SILVA',
      messageType: 'DOCUMENT',
      content: '📎 Currículo Edina.pdf',
      mediaFileName: 'Currículo Edina.pdf',
      mediaMimeType: 'application/pdf',
      createdAt: new Date('2026-08-11T10:25:00.000Z')
    },
    {
      senderType: 'EMPLOYEE',
      senderName: 'EDINA DA SILVA',
      messageType: 'TEXT',
      content: 'Bom dia',
      createdAt: new Date('2026-08-11T12:11:00.000Z')
    },
    {
      senderType: 'EMPLOYEE',
      senderName: 'EDINA DA SILVA',
      messageType: 'TEXT',
      content: 'Estão contratando para limpeza',
      createdAt: new Date('2026-08-11T12:12:00.000Z')
    },
    {
      senderType: 'EMPLOYEE',
      senderName: 'EDINA DA SILVA',
      messageType: 'DOCUMENT',
      content: '📎 Currículo Edina.pdf',
      mediaFileName: 'Currículo Edina.pdf',
      mediaMimeType: 'application/pdf',
      createdAt: new Date('2026-08-11T12:12:30.000Z')
    },
    {
      senderType: 'ATTENDANT',
      senderName: 'Atendente RH',
      messageType: 'TEXT',
      content: 'Olá Edina, Tudo bem?',
      createdAt: new Date('2026-08-11T15:35:00.000Z')
    },
    {
      senderType: 'EMPLOYEE',
      senderName: 'EDINA DA SILVA',
      messageType: 'TEXT',
      content: 'Boa tarde tudo bem',
      createdAt: new Date('2026-08-11T16:53:00.000Z')
    }
  ];

  for (const m of edinaMsgs) {
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

  console.log('✅ Edina real messages imported successfully!');
  await prisma.$disconnect();
}
importEdinaReal();
