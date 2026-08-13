const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEmpty() {
  const emptyTickets = await prisma.hrTicket.findMany({
    where: { messages: { none: {} } },
    select: { id: true, title: true, contactPhone: true }
  });
  console.log('Total tickets with 0 messages:', emptyTickets.length);
  console.log('Sample empty tickets:', emptyTickets.slice(0, 15));
  await prisma.$disconnect();
}
checkEmpty();
