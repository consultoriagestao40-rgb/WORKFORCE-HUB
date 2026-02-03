
import 'dotenv/config';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Debugging AMERICA EMBALAGEM...");

    // 1. Find Client
    const client = await prisma.client.findFirst({
        where: { name: { contains: 'AMERICA', mode: 'insensitive' } },
        include: {
            postos: {
                include: {
                    role: true,
                    assignments: { where: { endDate: null } },
                    vacancies: {
                        include: {
                            candidates: true
                        }
                    }
                }
            }
        }
    });

    if (!client) {
        console.log("Client not found.");
        return;
    }

    console.log(`CLIENT: ${client.name} (ID: ${client.id})`);
    console.log(`TOTAL POSTOS: ${client.postos.length}`);

    // 2. Iterate Postos to find GAPS
    for (const p of client.postos) {
        const isOccupied = p.assignments.length > 0;
        const statusStr = isOccupied ? "OCCUPIED" : "EMPTY (VAGO)";

        console.log(`\nPOSTO: ${p.role.name} | ${p.startTime} - ${p.endTime} | ${statusStr}`);
        console.log(`  ID: ${p.id}`);

        if (p.vacancies.length === 0) {
            console.log("  VACANCIES: [NONE]");
        } else {
            p.vacancies.forEach(v => {
                console.log(`  VACANCY: ${v.id} | Status: ${v.status} | Candidates: ${v.candidates.length}`);
                if (v.status === 'CLOSED') {
                    console.log(`    -> Closed at: ${v.updatedAt.toISOString()}`); // Use ISO string for clarity
                }
            });
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
