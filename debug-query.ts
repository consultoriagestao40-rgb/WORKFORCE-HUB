
import 'dotenv/config';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Testing getRecruitmentBoardData logic for Penha...");

    // 1. Fetch Open Vacancies for the "R&S" column (MIMIC EXACT QUERY)
    const openVacancies = await prisma.vacancy.findMany({
        where: {
            status: 'OPEN',
            candidates: {
                none: {} // Only show vacancies with zero candidates
            },
            posto: {
                client: { name: { contains: 'PENHA' } }
            }
        },
        include: {
            posto: true,
            candidates: true
        }
    });

    console.log(`\nQuery Result (vacancies with candidates: none): ${openVacancies.length}`);
    openVacancies.forEach(v => {
        console.log(`- ${v.id} | ${v.title} | Candidates: ${v.candidates.length}`);
    });

    // 2. Fetch specific vacancy to see why it might be matching
    // Target Vacancy: 81462dab-4ad2-4eaa-9d78-6f0cdb1c4e97 (Should have Ilcea)
    const targetId = "81462dab-4ad2-4eaa-9d78-6f0cdb1c4e97";
    const target = await prisma.vacancy.findUnique({
        where: { id: targetId },
        include: { candidates: true }
    });

    console.log(`\nTarget Check (${targetId}):`);
    if (target) {
        console.log(`Status: ${target.status}`);
        console.log(`Candidates: ${target.candidates.length}`);
        target.candidates.forEach(c => console.log(`  - ${c.name} (${c.stageId})`));

        if (target.status === 'OPEN' && target.candidates.length > 0) {
            console.log("CONCLUSION: Vacancy IS Open and HAS candidates. The 'none' query SHOULD exclude it.");
            const shouldExclude = await prisma.vacancy.findFirst({
                where: {
                    id: targetId,
                    candidates: { none: {} }
                }
            });
            console.log(`Does 'none' query find it? ${!!shouldExclude ? 'YES (BUG)' : 'NO (CORRECT)'}`);
        }
    } else {
        console.log("Target vacancy not found.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
