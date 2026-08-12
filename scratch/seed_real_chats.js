const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function seedRealChats() {
  let inboxStage = await prisma.hrPipelineStage.findFirst({ where: { name: "INBOX" } });
  if (!inboxStage) inboxStage = await prisma.hrPipelineStage.findFirst({ orderBy: { order: "asc" } });

  // 1. GRUPO DE OPERAÇÕES 🌐🎯
  let t1 = await prisma.hrTicket.findFirst({ where: { contactName: { contains: "GRUPO DE OPERAÇÕES" } } });
  if (!t1) {
    t1 = await prisma.hrTicket.create({
      data: {
        title: "Atendimento: GRUPO DE OPERAÇÕES 🌐🎯",
        contactName: "GRUPO DE OPERAÇÕES 🌐🎯",
        contactPhone: "554199033372-group",
        contactPhotoUrl: "https://pps.whatsapp.net/v/t61.24694-24/534423917_1642128296765154_8551994864828375320_n.jpg",
        stageId: inboxStage.id,
        status: "OPEN",
        unreadCount: 0,
        updatedAt: new Date()
      }
    });
  } else {
    await prisma.hrTicket.update({ where: { id: t1.id }, data: { updatedAt: new Date() } });
  }

  await prisma.hrTicketMessage.deleteMany({ where: { ticketId: t1.id } });
  await prisma.hrTicketMessage.create({
    data: {
      ticketId: t1.id,
      senderType: "ATTENDANT",
      senderName: "Você",
      content: "Atenção as admissões ⚠️📌\n\nNOME: MICHELE FIRME TOME DA ROSA\nCONTRATO: PENHA\nFUNÇÃO: ASG\nDATA: 12/08\nHORÁRIO: 09h às 18H\nCONTATO: 41 9903-3372\n\nNOME: MARCIA DE LIMA\nCONTRATO: SPATIUM LABORIS\nFUNÇÃO: PORTEIRO\nDATA: 12/08\nHORÁRIO: 10h às 19H\nCONTATO: 41 9759-4297\n\nNOME: RAFAEL RICARDO DOS SANTOS CHEVONICA\nCONTRATO: PENHA",
      status: "READ"
    }
  });

  // 2. RH - ATESTADO & FALTA
  let t2 = await prisma.hrTicket.findFirst({ where: { contactName: { contains: "RH - ATESTADO" } } });
  if (!t2) {
    t2 = await prisma.hrTicket.create({
      data: {
        title: "Atendimento: RH - ATESTADO & FALTA",
        contactName: "RH - ATESTADO & FALTA",
        contactPhone: "554197594297-group",
        contactPhotoUrl: null,
        stageId: inboxStage.id,
        status: "OPEN",
        unreadCount: 0,
        updatedAt: new Date(Date.now() - 60000)
      }
    });
  } else {
    await prisma.hrTicket.update({ where: { id: t2.id }, data: { updatedAt: new Date(Date.now() - 60000) } });
  }
  await prisma.hrTicketMessage.deleteMany({ where: { ticketId: t2.id } });
  await prisma.hrTicketMessage.create({
    data: {
      ticketId: t2.id,
      senderType: "ATTENDANT",
      senderName: "Você",
      content: "Você reagiu com 👍 a: 📱 Whatsapp Scan 11 ...",
      status: "READ"
    }
  });

  // 3. Grupo Adm
  let t3 = await prisma.hrTicket.findFirst({ where: { contactName: { contains: "Grupo Adm" } } });
  if (!t3) {
    t3 = await prisma.hrTicket.create({
      data: {
        title: "Atendimento: Grupo Adm",
        contactName: "Grupo Adm",
        contactPhone: "554198047817-group",
        contactPhotoUrl: null,
        stageId: inboxStage.id,
        status: "OPEN",
        unreadCount: 0,
        updatedAt: new Date(Date.now() - 120000)
      }
    });
  } else {
    await prisma.hrTicket.update({ where: { id: t3.id }, data: { updatedAt: new Date(Date.now() - 120000) } });
  }
  await prisma.hrTicketMessage.deleteMany({ where: { ticketId: t3.id } });
  await prisma.hrTicketMessage.create({
    data: {
      ticketId: t3.id,
      senderType: "ATTENDANT",
      senderName: "Você",
      content: "@Financeiro - Steffany amanhã m...",
      status: "READ"
    }
  });

  // 4. +55 41 9761-3732
  let t4 = await prisma.hrTicket.findFirst({ where: { contactPhone: { contains: "554197613732" } } });
  if (!t4) {
    t4 = await prisma.hrTicket.create({
      data: {
        title: "Atendimento: +55 41 9761-3732",
        contactName: "+55 41 9761-3732",
        contactPhone: "554197613732",
        contactPhotoUrl: "https://pps.whatsapp.net/v/t61.24694-24/620182411_2009676843046537_4325018300866913740_n.jpg",
        stageId: inboxStage.id,
        status: "OPEN",
        unreadCount: 2,
        updatedAt: new Date(Date.now() - 180000)
      }
    });
  } else {
    await prisma.hrTicket.update({ where: { id: t4.id }, data: { updatedAt: new Date(Date.now() - 180000) } });
  }
  await prisma.hrTicketMessage.deleteMany({ where: { ticketId: t4.id } });
  await prisma.hrTicketMessage.create({
    data: {
      ticketId: t4.id,
      senderType: "EMPLOYEE",
      senderName: "+55 41 9761-3732",
      content: "Oi tenho interesse na vaga como faço",
      status: "DELIVERED"
    }
  });

  // 5. Cristiano Silva
  let t5 = await prisma.hrTicket.findFirst({ where: { contactName: { contains: "Cristiano Silva" } } });
  if (t5) {
    await prisma.hrTicket.update({ where: { id: t5.id }, data: { updatedAt: new Date(Date.now() - 240000) } });
    await prisma.hrTicketMessage.deleteMany({ where: { ticketId: t5.id } });
    await prisma.hrTicketMessage.create({
      data: {
        ticketId: t5.id,
        senderType: "EMPLOYEE",
        senderName: "Cristiano Silva",
        content: "Boa noite",
        status: "DELIVERED"
      }
    });
  }

  console.log("Real chats seeded successfully!");
}
seedRealChats();
