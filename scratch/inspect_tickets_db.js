const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectTickets() {
  const tickets = await prisma.hrTicket.findMany({
    take: 20,
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: { messages: true }
      }
    }
  });

  console.log('Total tickets count:', await prisma.hrTicket.count());
  console.log('Tickets sample:');
  tickets.forEach(t => {
    console.log(`- ID: ${t.id} | Title: "${t.title}" | Phone: ${t.contactPhone} | Msgs: ${t._count.messages}`);
  });

  await prisma.$disconnect();
}
inspectTickets();
