const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function searchEder() {
  const tickets = await prisma.hrTicket.findMany({
    where: {
      OR: [
        { contactName: { contains: 'Eder' } },
        { contactName: { contains: 'CONDOR' } },
        { contactPhone: { contains: '8791' } }
      ]
    }
  });
  console.log('Eder Tickets count:', tickets.length);
  tickets.forEach(t => console.log(`- ID: ${t.id} | Name: ${t.contactName} | Phone: ${t.contactPhone}`));
  await prisma.$disconnect();
}
searchEder();
