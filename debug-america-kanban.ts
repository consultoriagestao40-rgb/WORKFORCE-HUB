
import 'dotenv/config';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("DEBUGGING KANBAN CANDIDATES FOR AMERICA EMBALAGEM...");

    const candidates = await prisma.recruitmentCandidate.findMany({
        where: {
            vacancy: {
                posto: {
                    client: { name: { contains: 'AMERICA', mode: 'insensitive' } }
                }
            },
            // Filter only active stages (not archived/rehired/rejected if you have those stages, 
            // but for now just check 'Posto' stage or similar)
            stage: {
                name: { in: ['Seleção', 'Entrevista Técnica', 'Admissão', 'Posto', 'Oferta', 'Contratado'] }
            }
        },
        include: {
            stage: true,
            vacancy: {
                include: {
                    posto: {
                        include: {
                            assignments: { where: { endDate: null }, include: { employee: true } }
                        }
                    }
                }
            }
        }
    });

    console.log(`Found ${candidates.length} active candidates in Kanban.`);

    for (const c of candidates) {
        const posto = c.vacancy.posto;
        const isOccupied = posto && posto.assignments.length > 0;
        const occupantName = isOccupied ? posto.assignments[0].employee.name : "NONE";

        console.log(`\nCANDIDATE: ${c.name} | Stage: ${c.stage.name}`);
        console.log(`  Linked Vacancy: ${c.vacancy.id} (Status: ${c.vacancy.status})`);
        if (posto) {
            console.log(`  Target Posto: ${posto.id}`);
            console.log(`  Posto Status: ${isOccupied ? "OCCUPIED" : "EMPTY (Vago)"}`);
            console.log(`  Current Occupant: ${occupantName}`);

            if (isOccupied) {
                console.log(`  [POTENTIAL ZOMBIE]: Candidate is vying for an OCCUPIED posto.`);
                // If the occupant is the candidate themselves, it's definitely a zombie process that wasn't finalized.
            } else {
                console.log(`  [VALID?]: Candidate is filling an EMPTY posto.`);
            }
        } else {
            console.log(`  [ERROR]: No Posto linked.`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
