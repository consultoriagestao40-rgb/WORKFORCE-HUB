const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMessageDirections() {
  console.log("🛠️ Corrigindo direções das mensagens (Remetente vs Atendente)...");

  // Buscar todos os tickets com mensagens
  const tickets = await prisma.hrTicket.findMany({
    include: {
      messages: { orderBy: { createdAt: 'asc' } }
    }
  });

  let totalFixed = 0;

  for (const ticket of tickets) {
    const msgs = ticket.messages;
    if (msgs.length <= 1) {
      // Se tiver só 1 mensagem no ticket, garantir que ela é do Contato/Funcionário (Balão Branco à esquerda)
      if (msgs.length === 1 && msgs[0].senderType === 'ATTENDANT') {
        await prisma.hrTicketMessage.update({
          where: { id: msgs[0].id },
          data: {
            senderType: 'EMPLOYEE',
            senderName: ticket.contactName || 'Contato WhatsApp'
          }
        });
        totalFixed++;
      }
      continue;
    }

    // Se todas as mensagens do ticket estiverem como ATTENDANT (como na Encarregada),
    // alternar mensagens curtas de perguntas/respostas para EMPLOYEE (esquerda) e ATTENDANT (direita)
    const allAttendant = msgs.every(m => m.senderType === 'ATTENDANT');

    if (allAttendant) {
      for (let i = 0; i < msgs.length; i++) {
        // Alternar: índices pares (0, 2, 4...) -> EMPLOYEE (Mensagem Recebida / Esquerda)
        // índices ímpares (1, 3, 5...) -> ATTENDANT (Mensagem Enviada / Direita)
        const isEmployeeMsg = (i % 2 === 0);

        await prisma.hrTicketMessage.update({
          where: { id: msgs[i].id },
          data: {
            senderType: isEmployeeMsg ? 'EMPLOYEE' : 'ATTENDANT',
            senderName: isEmployeeMsg ? (ticket.contactName || 'Contato') : 'Atendente RH'
          }
        });
        totalFixed++;
      }
    }
  }

  console.log(`✅ Concluído! ${totalFixed} mensagens tiveram a direção/remetente corrigida!`);
  await prisma.$disconnect();
}

fixMessageDirections().catch(err => {
  console.error("ERRO ao corrigir mensagens:", err);
  process.exit(1);
});
