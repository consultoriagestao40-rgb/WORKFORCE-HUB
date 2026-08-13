const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function importAdrianaReal() {
  const ticket = await prisma.hrTicket.findFirst({
    where: { contactPhone: { contains: '96627244' } }
  });
  if (!ticket) return console.log('Ticket for Adriana not found');

  console.log('Adriana Ticket ID:', ticket.id);

  const today = new Date();
  const adrianaMsgs = [
    {
      senderType: 'ATTENDANT',
      senderName: 'Atendente RH',
      messageType: 'CONTACT',
      content: '👤 Francis - Supervisor (Contato)',
      createdAt: new Date('2026-08-13T10:53:00.000Z')
    },
    {
      senderType: 'ATTENDANT',
      senderName: 'Atendente RH',
      messageType: 'TEXT',
      content: 'Veja com o seu supervisor se tem outro posto que possa te realocar',
      createdAt: new Date('2026-08-13T10:53:15.000Z')
    },
    {
      senderType: 'ATTENDANT',
      senderName: 'Atendente RH',
      messageType: 'TEXT',
      content: 'Bom dia',
      createdAt: new Date('2026-08-13T10:53:30.000Z')
    },
    {
      senderType: 'EMPLOYEE',
      senderName: 'Adriana WITZENMANN Cardoso',
      messageType: 'TEXT',
      content: 'Bom dia',
      createdAt: new Date('2026-08-13T11:10:00.000Z')
    },
    {
      senderType: 'EMPLOYEE',
      senderName: 'Adriana WITZENMANN Cardoso',
      messageType: 'TEXT',
      content: 'Como fica meu contrato',
      createdAt: new Date('2026-08-13T11:10:15.000Z')
    },
    {
      senderType: 'EMPLOYEE',
      senderName: 'Adriana WITZENMANN Cardoso',
      messageType: 'TEXT',
      content: 'Supervisor nem responde',
      createdAt: new Date('2026-08-13T11:10:30.000Z')
    },
    {
      senderType: 'ATTENDANT',
      senderName: 'Atendente RH',
      messageType: 'AUDIO',
      content: '🎙️ Mensagem de Voz (0:23)',
      createdAt: new Date('2026-08-13T12:15:00.000Z')
    },
    {
      senderType: 'EMPLOYEE',
      senderName: 'Adriana WITZENMANN Cardoso',
      messageType: 'TEXT',
      content: 'Não vou lá não',
      createdAt: new Date('2026-08-13T12:16:00.000Z')
    },
    {
      senderType: 'EMPLOYEE',
      senderName: 'Adriana WITZENMANN Cardoso',
      messageType: 'TEXT',
      content: 'Nem fui mas',
      createdAt: new Date('2026-08-13T12:16:15.000Z')
    },
    {
      senderType: 'EMPLOYEE',
      senderName: 'Adriana WITZENMANN Cardoso',
      messageType: 'TEXT',
      content: 'Veja o que faz',
      createdAt: new Date('2026-08-13T12:17:00.000Z')
    },
    {
      senderType: 'EMPLOYEE',
      senderName: 'Adriana WITZENMANN Cardoso',
      messageType: 'TEXT',
      content: 'Ou me dispensar',
      createdAt: new Date('2026-08-13T12:17:15.000Z')
    }
  ];

  for (const m of adrianaMsgs) {
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
          status: m.senderType === 'ATTENDANT' ? 'SENT' : 'RECEIVED',
          createdAt: m.createdAt
        }
      });
    }
  }

  await prisma.hrTicket.update({
    where: { id: ticket.id },
    data: { updatedAt: new Date() }
  });

  console.log('✅ Adriana real messages imported successfully!');
  await prisma.$disconnect();
}
importAdrianaReal();
