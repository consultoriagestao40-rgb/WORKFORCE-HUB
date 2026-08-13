const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteRecursosDuplicates() {
  console.log("🧹 Deletando tickets duplicados 'Recursos Humanos'...");

  // Buscar tickets com nome 'Recursos Humanos' que possuem poucas mensagens ou telefones invertidos
  const recursos = await prisma.hrTicket.findMany({
    where: { contactName: 'Recursos Humanos' },
    include: { messages: true }
  });

  for (const t of recursos) {
    await prisma.hrTicketMessage.deleteMany({ where: { ticketId: t.id } });
    await prisma.hrTicket.delete({ where: { id: t.id } });
    console.log(`Deleted duplicate ticket ${t.id}`);
  }

  console.log('✅ Todos os 10 tickets duplicados Recursos Humanos foram removidos!');
  await prisma.$disconnect();
}

deleteRecursosDuplicates().catch(e => { console.error(e); process.exit(1); });
