import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateRoles() {
    console.log('🔄 Iniciando migração de cargos...');

    // Conectar ao banco com o schema antigo
    const employees = await prisma.$queryRaw<Array<{ id: string; role: string }>>`
    SELECT id, role FROM Employee
  `;

    console.log(`📊 Encontrados ${employees.length} colaboradores`);

    // Extrair cargos únicos
    const uniqueRoles = [...new Set(employees.map(e => e.role))];
    console.log(`📋 Cargos únicos encontrados: ${uniqueRoles.join(', ')}`);

    // Criar mapeamento role -> roleId
    const roleMap: Record<string, string> = {};

    for (const roleName of uniqueRoles) {
        // Criar cada cargo
        const roleId = crypto.randomUUID();
        roleMap[roleName] = roleId;

        await prisma.$executeRaw`
      INSERT INTO Role (id, name, createdAt, updatedAt)
      VALUES (${roleId}, ${roleName}, datetime('now'), datetime('now'))
    `;

        console.log(`✅ Cargo criado: ${roleName}`);
    }

    console.log('✅ Todos os cargos foram criados!');
    console.log('🔄 Migração concluída com sucesso!');

    await prisma.$disconnect();
}

migrateRoles()
    .catch((e) => {
        console.error('❌ Erro na migração:', e);
        process.exit(1);
    });
