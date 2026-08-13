const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillYesterdayAllChats() {
  console.log("🔄 Verificando e sincronizando todas as mensagens de ontem para os tickets de atendimento...");

  // 1. Vincular todas as mensagens da tabela RecruitmentWhatsAppMessage nos HrTickets
  const allCandidateMsgs = await prisma.recruitmentWhatsAppMessage.findMany({
    include: { candidate: true },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`📋 Total de mensagens de candidatos no sistema: ${allCandidateMsgs.length}`);

  let inboxStage = await prisma.hrPipelineStage.findFirst({ where: { isDefault: true } })
      || await prisma.hrPipelineStage.findFirst({ orderBy: { order: "asc" } });

  let insertedCount = 0;
  for (const cm of allCandidateMsgs) {
    if (!cm.candidate?.phone) continue;
    const phone = cm.candidate.phone.replace(/\D/g, '');
    const phoneSearch = phone.slice(-9);

    let ticket = await prisma.hrTicket.findFirst({
      where: {
        OR: [
          { contactPhone: { contains: phoneSearch } },
          { contactPhone: { contains: phone } }
        ]
      }
    });

    if (!ticket) {
      ticket = await prisma.hrTicket.create({
        data: {
          title: `Atendimento: ${cm.candidate.name}`,
          contactPhone: phone,
          contactName: cm.candidate.name,
          stageId: inboxStage?.id || "",
          status: "OPEN"
        }
      });
    }

    const exists = await prisma.hrTicketMessage.findFirst({
      where: {
        ticketId: ticket.id,
        content: cm.content
      }
    });

    if (!exists) {
      await prisma.hrTicketMessage.create({
        data: {
          ticketId: ticket.id,
          senderType: cm.senderType === 'RECRUITER' ? 'ATTENDANT' : 'EMPLOYEE',
          senderName: cm.senderName || (cm.senderType === 'RECRUITER' ? 'Recrutador RH' : cm.candidate.name),
          messageType: cm.messageType,
          content: cm.content,
          mediaUrl: cm.mediaUrl,
          mediaFileName: cm.mediaFileName,
          mediaMimeType: cm.mediaMimeType,
          status: 'DELIVERED',
          createdAt: cm.createdAt
        }
      });
      insertedCount++;
    }
  }

  console.log(`✅ ${insertedCount} mensagens sincronizadas para o Atendimento RH!`);

  // 2. Atualizar a data dinâmica dos divisores no código
  await prisma.$disconnect();
}

backfillYesterdayAllChats().catch(e => {
  console.error(e);
  process.exit(1);
});
