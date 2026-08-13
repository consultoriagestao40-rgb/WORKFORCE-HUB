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
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function populateAllTickets() {
  console.log("=================================================");
  console.log("🔄 SINCRONIZANDO HISTÓRICO DE MENSAGENS NO SISTEMA");
  console.log("=================================================\n");

  // 1. Obter todos os tickets do banco
  const tickets = await prisma.hrTicket.findMany({
    include: {
      messages: true
    }
  });

  console.log(`📋 Total de tickets no sistema: ${tickets.length}`);

  // 2. Buscar chats e grupos do Z-API
  console.log("🔍 Buscando lista de chats e grupos do Z-API...");
  const zapiChats = await fetchZapi("chats?page=1&pageSize=100") || [];
  const zapiGroups = await fetchZapi("groups") || [];

  const zapiChatMap = new Map();
  for (const c of zapiChats) {
    if (c.phone) zapiChatMap.set(c.phone.replace(/\D/g, ''), c);
  }
  for (const g of zapiGroups) {
    if (g.phone) zapiChatMap.set(g.phone, g);
  }

  let updatedCount = 0;
  let createdMsgsCount = 0;

  for (const ticket of tickets) {
    if (ticket.messages.length > 0) continue; // Já tem mensagens

    const phone = ticket.contactPhone;
    const isGroup = phone.length > 13 || ticket.title.toLowerCase().includes('grupo') || ticket.title.includes('Taxas') || ticket.title.includes('Mesa') || ticket.title.includes('RH - ATESTADO');

    let textContent = null;
    let senderName = ticket.contactName || "Contato WhatsApp";

    // 1. Tentar encontrar no mapa do Z-API
    const cleanPhone = phone.replace(/\D/g, '');
    const zapiData = zapiChatMap.get(cleanPhone) || zapiChatMap.get(`${phone}-group`) || zapiChatMap.get(phone);

    if (zapiData) {
      if (zapiData.name) senderName = zapiData.name;
      if (zapiData.lastMessage?.text?.message) textContent = zapiData.lastMessage.text.message;
      else if (zapiData.lastMessage?.text) textContent = zapiData.lastMessage.text;
    }

    // 2. Se for Grupo, buscar dados do Grupo via Z-API
    if (isGroup || phone.includes('120363')) {
      const groupPhone = phone.endsWith('-group') ? phone : `${phone}-group`;
      const groupMeta = await fetchZapi(`group-metadata/${groupPhone}`);
      if (groupMeta) {
        const count = groupMeta.participants ? groupMeta.participants.length : 0;
        const desc = groupMeta.description ? ` - ${groupMeta.description.slice(0, 100)}` : '';
        textContent = textContent || `👥 [Grupo de WhatsApp]: ${groupMeta.subject || ticket.contactName} (${count} participantes)${desc}`;
      } else {
        textContent = textContent || `👥 [Grupo de WhatsApp]: ${ticket.contactName}`;
      }
    }

    // 3. Tentar encontrar mensagens de recrutamento vinculadas
    if (!textContent) {
      const candidateMsgs = await prisma.recruitmentWhatsAppMessage.findMany({
        where: {
          candidate: { phone: { contains: cleanPhone.slice(-8) } }
        },
        orderBy: { createdAt: 'asc' }
      });

      if (candidateMsgs.length > 0) {
        for (const cm of candidateMsgs) {
          await prisma.hrTicketMessage.create({
            data: {
              ticketId: ticket.id,
              senderType: cm.senderType === 'RECRUITER' ? 'ATTENDANT' : 'EMPLOYEE',
              senderName: cm.senderName || senderName,
              messageType: cm.messageType,
              content: cm.content,
              mediaUrl: cm.mediaUrl,
              mediaFileName: cm.mediaFileName,
              mediaMimeType: cm.mediaMimeType,
              status: 'DELIVERED',
              createdAt: cm.createdAt
            }
          });
          createdMsgsCount++;
        }
        updatedCount++;
        continue;
      }
    }

    // Fallback padrão se não tiver mensagem nenhuma
    if (!textContent) {
      textContent = `Atendimento iniciado via WhatsApp com ${senderName}`;
    }

    await prisma.hrTicketMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: "EMPLOYEE",
        senderName,
        content: textContent,
        status: "DELIVERED",
        createdAt: ticket.createdAt || new Date()
      }
    });

    createdMsgsCount++;
    updatedCount++;
  }

  console.log("\n=================================================");
  console.log(`✅ Sincronização concluída!`);
  console.log(`📊 Tickets atualizados com histórico: ${updatedCount}`);
  console.log(`💬 Novas mensagens inseridas no banco: ${createdMsgsCount}`);
  console.log("=================================================");

  await prisma.$disconnect();
}

populateAllTickets().catch(err => {
  console.error("ERRO:", err);
  process.exit(1);
});
