
import 'dotenv/config';
import { PrismaClient } from "@prisma/client";

// Instantiate PrismaClient directly to avoid any module resolution issues with src/lib/db
const prisma = new PrismaClient();

async function main() {
    console.log("Searching for PENHA...");

    // Find client with Penha in name
    const clients = await prisma.client.findMany({
        where: { name: { contains: 'PENHA', mode: 'insensitive' } },
        include: {
            postos: {
                include: {
                    vacancies: {
                        include: {
                            candidates: {
                                include: { stage: true }
                            }
                        }
                    },
                    assignments: true
                }
            }
        }
    });

    console.log(`Found ${clients.length} clients.`);

    for (const client of clients) {
        console.log(`\nCLIENT: ${client.name} (${client.id})`);
        console.log(`POSTOS: ${client.postos.length}`);

        for (const posto of client.postos) {
            console.log(`  POSTO: ${posto.id} | Role: ${posto.roleId} | Assignments: ${posto.assignments.length}`);

            // assignments detail
            const activeAssign = posto.assignments.find(a => !a.endDate);
            if (activeAssign) console.log(`    -> ACTIVE ASSIGNMENT: ${activeAssign.employeeId}`);
            console.log(`    SCHEDULE: ${posto.schedule} | ${posto.startTime} - ${posto.endTime}`);

            console.log(`    VACANCIES: ${posto.vacancies.length}`);
            for (const v of posto.vacancies) {
                console.log(`      VACANCY: ${v.id} | Status: ${v.status} | Title: ${v.title}`);
                console.log(`      CANDIDATES: ${v.candidates.length}`);
                for (const c of v.candidates) {
                    console.log(`        - ${c.name} | Stage: ${c.stage.name}`);
                }
            }
        }
    }

    // 2. Find ALL vacancies for this client (or associated company) directly
    // This catches "Orphan" vacancies or those linked correctly but missed in the previous loop

    console.log(`\n\n--- ALL VACANCIES FOR PENHA DIRECT CHECK ---`);

    const allVacancies = await prisma.vacancy.findMany({
        where: {
            posto: {
                client: {
                    name: { contains: 'PENHA', mode: 'insensitive' }
                }
            }
        },
        include: {
            posto: true,
            candidates: { include: { stage: true } }
        }
    });

    console.log(`Found ${allVacancies.length} total vacancies linked to PENHA postos.`);

    // Check for Duplicates (Multiple OPEN vacancies for same Posto)
    const vacanciesByPosto: Record<string, typeof allVacancies> = {};
    for (const v of allVacancies) {
        if (!v.postoId) continue;
        if (!vacanciesByPosto[v.postoId]) vacanciesByPosto[v.postoId] = [];
        vacanciesByPosto[v.postoId].push(v);
    }

    console.log(`\n--- DUPLICATE CHECK ---`);
    for (const [postoId, vacs] of Object.entries(vacanciesByPosto)) {
        const openVacs = vacs.filter(v => v.status === 'OPEN');
        if (openVacs.length > 1) {
            console.log(`[ALERT] Posto ${postoId} has ${openVacs.length} OPEN vacancies!`);
            openVacs.forEach(v => console.log(`  - ${v.id} : ${v.title}`));
        } else if (openVacs.length === 1) {
            const v = openVacs[0];
            // Check if "Phantom" (Open but has candidate in filling stage)
            const hasFillingCandidate = v.candidates.some(c =>
                ['Admissão', 'Posto', 'Contratado', 'Oferta'].includes(c.stage.name)
            );
            if (hasFillingCandidate) {
                console.log(`[ALERT] PHANTOM VACANCY detected at Posto ${postoId}`);
                console.log(`  - ${v.id} is OPEN but has candidates in advanced stages.`);
            }
        }
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
