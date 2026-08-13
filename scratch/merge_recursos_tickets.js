const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function mergeRecursosTickets() {
  console.log("🛠️ Analisando e mesclando os 10 tickets duplicados 'Recursos Humanos'...");

  const recursosTickets = await prisma.hrTicket.findMany({
    where: {
      OR: [
        { contactName: 'Recursos Humanos' },
        { title: { contains: 'Recursos Humanos' } }
      ]
    },
    include: { messages: true }
  });

  console.log(`Encontrados ${recursosTickets.length} tickets de Recursos Humanos.`);

  for (const ticket of recursosTickets) {
    console.log(`\nTicket ID: ${ticket.id} | Phone: ${ticket.contactPhone} | Msgs: ${ticket.messages.length}`);
    
    const cleanPhone = ticket.contactPhone?.replace(/\D/g, "");
    if (!cleanPhone) continue;
    const phoneSearch = cleanPhone.slice(-8);

    // Buscar se existe um ticket real (com nome diferente de Recursos Humanos) para esse mesmo telefone
    const realTicket = await prisma.hrTicket.findFirst({
      where: {
        id: { not: ticket.id },
        contactName: { not: 'Recursos Humanos' },
        OR: [
          { contactPhone: { contains: phoneSearch } },
          { contactPhone: { contains: cleanPhone } }
        ]
      }
    });

    if (realTicket) {
      console.log(`  👉 Encontrado ticket real para mesclar: ${realTicket.contactName} (${realTicket.id})`);
      // Mover mensagens para o ticket real
      for (const msg of ticket.messages) {
        await prisma.hrTicketMessage.update({
          where: { id: msg.id },
          data: {
            ticketId: realTicket.id,
            senderType: 'ATTENDANT',
            senderName: 'Atendente RH'
          }
        });
      }
      // Deletar o ticket duplicado Recursos Humanos
      await prisma.hrTicket.delete({ where: { id: ticket.id } });
      console.log(`  ✅ ${ticket.messages.length} mensagens movidas para ${realTicket.contactName} e ticket duplicado removido!`);
    } else {
      // Se não houver outro ticket, buscar no cadastro de funcionários ou contatos o nome real
      const employee = await prisma.employee.findFirst({
        where: {
          OR: [
            { phone: { contains: phoneSearch } },
            { phone: { contains: cleanPhone } }
          ]
        }
      });
      if (employee) {
        await prisma.hrTicket.update({
          where: { id: ticket.id },
          data: { contactName: employee.name, title: `Atendimento: ${employee.name}` }
        });
        console.log(`  ✅ Nome atualizado para o funcionário real: ${employee.name}`);
      }
    }
  }

  await prisma.$disconnect();
}

mergeRecursosTickets().catch(err => {
  console.error("Erro na mesclagem:", err);
  process.exit(1);
});
