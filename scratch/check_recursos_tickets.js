const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRecursosTickets() {
  const tickets = await prisma.hrTicket.findMany({
    where: {
      OR: [
        { contactName: { contains: 'Recursos' } },
        { title: { contains: 'Recursos' } }
      ]
    },
    include: { messages: true }
  });

  console.log(`Found ${tickets.length} tickets for 'Recursos':`);
  tickets.forEach(t => {
    console.log(`- ID: ${t.id} | Name: ${t.contactName} | Phone: ${t.contactPhone} | Msgs: ${t.messages.length} | CreatedAt: ${t.createdAt.toISOString()}`);
  });

  await prisma.$disconnect();
}
checkRecursosTickets();
