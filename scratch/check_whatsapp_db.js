const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDbHistory() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ticketCount = await prisma.hrTicket.count();
    const ticketMsgsCount = await prisma.hrTicketMessage.count({
      where: { createdAt: { gte: thirtyDaysAgo } }
    });
    const candidateMsgsCount = await prisma.recruitmentWhatsAppMessage.count({
      where: { createdAt: { gte: thirtyDaysAgo } }
    });

    console.log('Total HR Tickets:', ticketCount);
    console.log('HR Messages (last 30 days):', ticketMsgsCount);
    console.log('Recruitment Messages (last 30 days):', candidateMsgsCount);

    const sampleHrMsgs = await prisma.hrTicketMessage.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: { id: true, messageType: true, content: true, mediaUrl: true, createdAt: true }
    });
    console.log('Sample HR Messages:', JSON.stringify(sampleHrMsgs, null, 2));

  } catch (e) {
    console.error('DB Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
checkDbHistory();
