const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("=== EXECUTANDO QUERIES NO BANCO REEMBOLSA FACIL ===")

    try {
        // 1. Consultar despesas pendentes
        const despesas = await prisma.$queryRawUnsafe(`
            SELECT d.id, d.status, d.tipo, d.descricao, d."valorSolicitado", d."valorComprovado", u.nome as solicitante_nome, cc.nome as cc_nome, cc."aprovadorN1Id", cc."aprovadorN2Id"
            FROM "Despesa" d
            JOIN "User" u ON d."solicitanteId" = u.id
            LEFT JOIN "CentroCusto" cc ON d."centroCustoId" = cc.id
            WHERE d.status IN ('AGUARDANDO_APROVACAO', 'AGUARDANDO_APROVACAO_N1', 'AGUARDANDO_APROVACAO_N2')
        `)

        console.log("\n--- Despesas Aguardando Aprovação ---")
        console.log(despesas)

        // 2. Consultar usuários admin e aprovadores
        const usuarios = await prisma.$queryRawUnsafe(`
            SELECT id, nome, email, role FROM "User" 
            WHERE role IN ('ADMIN', 'APROVADOR', 'APROVADOR_N1', 'APROVADOR_N2')
        `)

        console.log("\n--- Usuários de Gestão ---")
        console.log(usuarios)

        // 3. Consultar centros de custo
        const centros = await prisma.$queryRawUnsafe(`
            SELECT id, nome, "aprovadorN1Id", "aprovadorN2Id" FROM "CentroCusto"
        `)

        console.log("\n--- Centros de Custo ---")
        console.log(centros)

    } catch (err) {
        console.error("Erro na query raw:", err)
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
