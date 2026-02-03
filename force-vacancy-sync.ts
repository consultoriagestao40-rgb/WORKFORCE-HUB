
import 'dotenv/config';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("FORCING VACANCY SYNC (Standalone)...");

    // 1. Find all Postos that are seemingly empty (all assignments ended)
    const vacantPostos = await prisma.posto.findMany({
        where: {
            // Logic: Every assignment has an endDate (no active assignment)
            // OR no assignments at all
            assignments: {
                every: {
                    endDate: { not: null }
                }
            }
        },
        include: {
            client: true,
            role: true,
            vacancies: {
                include: {
                    candidates: { include: { stage: true } }
                }
            }
        }
    });

    console.log(`Found ${vacantPostos.length} potentially empty postos.`);

    let createdCount = 0;

    for (const p of vacantPostos) {
        if (p.client.name === 'ROTATIVO') continue;

        // --- THE CORRECTED LOGIC ---

        // 1. Check for Active Vacancy (OPEN or HOLD)
        const hasActiveVacancy = p.vacancies.some(v => v.status === 'OPEN' || v.status === 'HOLD');
        if (hasActiveVacancy) {
            // console.log(`  Skipping Posto ${p.id} (Has active vacancy)`);
            continue;
        }

        // 2. Check for "Zombie" Candidates in OPEN/HOLD vacancies only
        // (We ignore candidates in CLOSED vacancies)
        const hasFillingCandidate = p.vacancies.some(v =>
            (v.status === 'OPEN' || v.status === 'HOLD') &&
            v.candidates.some(c =>
                c.stage?.name && ['Admissão', 'Posto', 'Contratado', 'Oferta'].includes(c.stage.name)
            )
        );

        if (hasFillingCandidate) {
            // console.log(`  Skipping Posto ${p.id} (Has filling candidate)`);
            continue;
        }

        // If we got here, it's a gap!
        console.log(`  Creating Vacancy for Posto: ${p.role.name} - ${p.client.name} (ID: ${p.id})`);

        await prisma.vacancy.create({
            data: {
                title: `${p.role.name} - ${p.client.name}`,
                description: `Vaga aberta automaticamente por script de correção.\nHorário: ${p.startTime} - ${p.endTime}\nEscala: ${p.schedule}`,
                postoId: p.id,
                roleId: p.roleId || undefined,
                companyId: p.client.companyId || undefined,
                priority: "URGENT",
                status: "OPEN"
            }
        });
        createdCount++;
    }

    console.log(`\nSYNC COMPLETE. Created ${createdCount} new vacancies.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
