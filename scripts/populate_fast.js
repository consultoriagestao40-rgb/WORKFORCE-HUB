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

async function runFastPopulate() {
  console.log("⚡ [FAST] Iniciando povoamento rápido do banco de dados...");

  // 1. Obter tickets sem mensagem
  const emptyTickets = await prisma.hrTicket.findMany({
    where: { messages: { none: {} } },
    select: { id: true, title: true, contactPhone: true, contactName: true, createdAt: true }
  });

  console.log(`📋 Tickets sem mensagens para atualizar: ${emptyTickets.length}`);
  if (emptyTickets.length === 0) {
    console.log("✅ Todos os tickets já possuem mensagens!");
    await prisma.$disconnect();
    return;
  }

  // 2. Buscar chats e grupos do Z-API em paralelo
  console.log("🔍 Buscando Z-API chats e grupos...");
  const [zapiChatsPage1, zapiChatsPage2, zapiGroups] = await Promise.all([
    fetchZapi("chats?page=1&pageSize=100"),
    fetchZapi("chats?page=2&pageSize=100"),
    fetchZapi("groups")
  ]);

  const zapiMap = new Map();
  if (Array.isArray(zapiChatsPage1)) {
    zapiChatsPage1.forEach(c => {
      if (c.phone) zapiMap.set(c.phone.replace(/\D/g, ''), c);
    });
  }
  if (Array.isArray(zapiChatsPage2)) {
    zapiChatsPage2.forEach(c => {
      if (c.phone) zapiMap.set(c.phone.replace(/\D/g, ''), c);
    });
  }
  if (Array.isArray(zapiGroups)) {
    zapiGroups.forEach(g => {
      if (g.phone) zapiMap.set(g.phone, g);
    });
  }

  console.log(`✅ Z-API respondeu com ${zapiMap.size} conversas catalogadas.`);

  const newMessagesData = [];

  for (const ticket of emptyTickets) {
    const phone = ticket.contactPhone || '';
    const cleanPhone = phone.replace(/\D/g, '');
    const isGroup = phone.length > 13 || phone.includes('120363') || ticket.title.toLowerCase().includes('grupo') || ticket.title.includes('Taxas') || ticket.title.includes('Mesa');

    let textContent = null;
    let senderName = ticket.contactName || "Contato WhatsApp";

    const zapiData = zapiMap.get(cleanPhone) || zapiMap.get(`${cleanPhone}-group`) || zapiMap.get(phone);

    if (zapiData) {
      if (zapiData.name) senderName = zapiData.name;
      if (zapiData.lastMessage?.text?.message) textContent = zapiData.lastMessage.text.message;
      else if (zapiData.lastMessage?.text) textContent = zapiData.lastMessage.text;
    }

    if (isGroup && !textContent) {
      textContent = `👥 [Grupo de WhatsApp]: ${ticket.contactName}`;
    }

    if (!textContent) {
      textContent = `Atendimento iniciado via WhatsApp com ${senderName}`;
    }

    newMessagesData.push({
      ticketId: ticket.id,
      senderType: "EMPLOYEE",
      senderName,
      messageType: "TEXT",
      content: textContent,
      status: "DELIVERED",
      createdAt: ticket.createdAt || new Date()
    });
  }

  console.log(`🚀 Inserindo em lote ${newMessagesData.length} mensagens no banco de dados...`);
  const result = await prisma.hrTicketMessage.createMany({
    data: newMessagesData,
    skipDuplicates: true
  });

  console.log(`✅ SUCESSO! ${result.count} mensagens inseridas no banco de dados!`);
  await prisma.$disconnect();
}

runFastPopulate().catch(err => {
  console.error("ERRO FAST POPULATE:", err);
  process.exit(1);
});
