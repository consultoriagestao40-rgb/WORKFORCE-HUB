const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTaxasUp() {
  const ticket = await prisma.hrTicket.findFirst({
    where: { title: { contains: 'Taxas Up' } },
    include: { messages: true }
  });
  console.log('Taxas Up Ticket ID:', ticket?.id);
  console.log('Taxas Up Title:', ticket?.title);
  console.log('Taxas Up Phone:', ticket?.contactPhone);
  console.log('Taxas Up Messages Count:', ticket?.messages.length);
  console.log('Taxas Up Messages:', ticket?.messages);
  await prisma.$disconnect();
}
checkTaxasUp();
