const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID || "3F1993DFB59E83474F059E648AE68DF9";
const ZAPI_TOKEN = process.env.ZAPI_TOKEN || "81087A6B5C1CAB8AAAC801C4";
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || "F5c1b8f27f6b049c98c4e779d00f67552S";

const headers = {
  "Content-Type": "application/json",
  "Client-Token": ZAPI_CLIENT_TOKEN
};

async function fetchZapi(endpoint) {
  try {
    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function syncAllAvailableHistory() {
  console.log("=================================================");
  console.log("🔄 SINCRONIZANDO MENSAGENS E HISTÓRICO COMPLETO");
  console.log("=================================================\n");

  // 1. Vincular mensagens de candidatos que tenham o mesmo telefone
  const candidateMsgs = await prisma.recruitmentWhatsAppMessage.findMany({
    include: { candidate: true },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`📋 Total de mensagens de candidatos no sistema: ${candidateMsgs.length}`);

  let linkedCount = 0;
  for (const cm of candidateMsgs) {
    if (!cm.candidate?.phone) continue;
    const phone = cm.candidate.phone.replace(/\D/g, '');
    const phoneShort = phone.slice(-8);

    const ticket = await prisma.hrTicket.findFirst({
      where: {
        OR: [
          { contactPhone: { contains: phoneShort } },
          { contactPhone: { contains: phone } }
        ]
      }
    });

    if (ticket) {
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
            senderName: cm.senderName || (cm.senderType === 'RECRUITER' ? 'Recrutador RH' : ticket.contactName),
            messageType: cm.messageType,
            content: cm.content,
            mediaUrl: cm.mediaUrl,
            mediaFileName: cm.mediaFileName,
            mediaMimeType: cm.mediaMimeType,
            status: 'DELIVERED',
            createdAt: cm.createdAt
          }
        });
        linkedCount++;
      }
    }
  }

  console.log(`✅ ${linkedCount} mensagens de candidatos vinculadas aos tickets de atendimento!`);

  // 2. Garantir fotos de perfil atualizadas para todos os contatos
  console.log("🖼️ Atualizando fotos de perfil do Z-API...");
  const ticketsNoPhoto = await prisma.hrTicket.findMany({
    where: {
      OR: [
        { contactPhotoUrl: null },
        { contactPhotoUrl: 'null' }
      ]
    },
    take: 50
  });

  let photoUpdated = 0;
  for (const t of ticketsNoPhoto) {
    const cleanPhone = t.contactPhone?.replace(/\D/g, '');
    if (!cleanPhone) continue;
    const finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const photoData = await fetchZapi(`profile-picture?phone=${finalPhone}`);
    if (photoData) {
      const photoUrl = photoData.link || photoData.profilePictureUrl || photoData.picture || photoData.url;
      if (photoUrl && photoUrl !== 'null') {
        await prisma.hrTicket.update({
          where: { id: t.id },
          data: { contactPhotoUrl: photoUrl }
        });
        photoUpdated++;
      }
    }
  }

  console.log(`✅ ${photoUpdated} fotos de perfil atualizadas!`);

  console.log("\n=================================================");
  console.log("🎉 SINCRONIZAÇÃO GERAL CONCLUÍDA COM SUCESSO!");
  console.log("=================================================");

  await prisma.$disconnect();
}

syncAllAvailableHistory().catch(err => {
  console.error("ERRO:", err);
  process.exit(1);
});
