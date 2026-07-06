import { prisma } from "@/lib/db";
import { PrismaClient } from "@prisma/client";

async function run() {
    // Parâmetros do teste real
    const postoId = "519ee270-07b2-4c7b-b2bb-6097afd816b8"; // Boza Eucalipto
    const targetDate = new Date("2026-07-06T00:00:00.000Z");
    const finalEmployeeId = "6cd76494-1f65-4173-adea-e089d63c7e4b"; // Elisangela Santos de Paula
    const finalCost = 281.67;
    const diaristaId = "9fcb2491-2d78-477e-9abc-d21e574fd873"; // Maria Santos (Diarista de teste)
    const motivoId = "db8bec65-1a90-41bf-ba13-0ead0232541f"; // Falta Injustificada
    const notes = "Teste de lançamento via script de depuração";

    const reembolsoUrl = process.env.DATABASE_URL_REEMBOLSO || "postgresql://neondb_owner:npg_FAXvef5z2oLN@ep-lingering-poetry-ahaduz92-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

    console.log("Iniciando simulação do endpoint de integração...");

    if (reembolsoUrl) {
        const prismaReembolso = new PrismaClient({
            datasources: {
                db: {
                    url: reembolsoUrl
                }
            }
        });

        try {
            const localPosto = await prisma.posto.findFirst({
                include: { client: true }
            });

            if (localPosto) {
                const clientName = localPosto.client.name;
                console.log("Cliente local encontrado:", clientName);

                // 1. Posto
                const reembolsoPosto = await prismaReembolso.$queryRawUnsafe(
                    'SELECT id FROM "Posto" WHERE nome = $1 LIMIT 1',
                    clientName
                ) as any[];

                let reembolsoPostoId = "";
                if (reembolsoPosto && reembolsoPosto.length > 0) {
                    reembolsoPostoId = reembolsoPosto[0].id;
                } else {
                    const newPostoId = crypto.randomUUID();
                    await prismaReembolso.$executeRawUnsafe(
                        'INSERT INTO "Posto" (id, nome, ativo) VALUES ($1, $2, $3)',
                        newPostoId,
                        clientName,
                        true
                    );
                    reembolsoPostoId = newPostoId;
                }
                console.log("reembolsoPostoId:", reembolsoPostoId);

                // 2. Reserva
                let titularName = "Banco de Reservas";
                if (finalEmployeeId) {
                    const emp = await prisma.employee.findFirst();
                    if (emp) titularName = emp.name;
                }

                const reembolsoReserva = await prismaReembolso.$queryRawUnsafe(
                    'SELECT id FROM "Reserva" WHERE nome = $1 LIMIT 1',
                    titularName
                ) as any[];

                let reembolsoReservaId = "";
                if (reembolsoReserva && reembolsoReserva.length > 0) {
                    reembolsoReservaId = reembolsoReserva[0].id;
                } else {
                    const newReservaId = crypto.randomUUID();
                    await prismaReembolso.$executeRawUnsafe(
                        'INSERT INTO "Reserva" (id, nome, cpf, ativo) VALUES ($1, $2, $3, $4)',
                        newReservaId,
                        titularName,
                        "000.000.000-00",
                        true
                    );
                    reembolsoReservaId = newReservaId;
                }
                console.log("reembolsoReservaId:", reembolsoReservaId);

                // 3. Motivo
                let motivoIdToUse = motivoId;
                if (!motivoIdToUse) {
                    motivoIdToUse = "db8bec65-1a90-41bf-ba13-0ead0232541f";
                }

                // 4. Carga Horária
                let cargaHorariaId = "39fd40ff-6e1b-438c-8944-952091081d6b";
                const normSchedule = localPosto.schedule.replace(/\s+/g, '').toLowerCase();
                if (normSchedule.includes("12x36")) {
                    cargaHorariaId = "a0a9e2f1-b581-4447-b60c-ed746e790d22";
                }
                console.log("cargaHorariaId:", cargaHorariaId);

                // 5. Meio de pagamento
                const meioPagamentoSolicitadoId = "0dc4e244-096e-47dc-9448-64d3cc0925a0";

                // 6. Supervisor
                let supervisorId = "a2c4b8a1-76ea-4369-bcd8-e29116287af7";
                console.log("supervisorId:", supervisorId);

                // 7. Inserir a Cobertura
                const newCoberturaId = crypto.randomUUID();
                const observacaoFinal = notes || "Lançado via simulação";

                await prismaReembolso.$executeRawUnsafe(
                    `INSERT INTO "Cobertura" (
                        id, data, valor, status, "postoId", "diaristaId", "reservaId", "motivoId", 
                        "cargaHorariaId", "meioPagamentoSolicitadoId", "supervisorId", observacao, "updatedAt"
                    ) VALUES ($1, $2, $3, CAST($4 AS "StatusCobertura"), $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                    newCoberturaId,
                    targetDate,
                    finalCost,
                    "PENDENTE",
                    reembolsoPostoId,
                    diaristaId,
                    reembolsoReservaId,
                    motivoIdToUse,
                    cargaHorariaId,
                    meioPagamentoSolicitadoId,
                    supervisorId,
                    observacaoFinal,
                    new Date()
                );

                console.log("SUCESSO: Diária inserida!");
            }
        } catch (err: any) {
            console.error("ERRO INTEGRANDO DIÁRIA:", err);
        } finally {
            await prismaReembolso.$disconnect();
        }
    }
}

run();
