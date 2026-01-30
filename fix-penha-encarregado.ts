
import 'dotenv/config';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Fixing Encarregado Vacancy for Penha...");

    // Target Candidate: ILCEA KOZIEL
    const candidateName = "ILCEA KOZIEL";
    const candidate = await prisma.recruitmentCandidate.findFirst({
        where: { name: { contains: candidateName, mode: 'insensitive' } },
        include: { vacancy: { include: { posto: true } } }
    });

    if (!candidate) {
        console.error("Candidate not found!");
        return;
    }

    console.log(`Found Candidate: ${candidate.name} (ID: ${candidate.id})`);
    console.log(`Current Vacancy: ${candidate.vacancyId} (Status: ${candidate.vacancy.status})`);
    console.log(`Current Posto: ${candidate.vacancy.postoId} (Assignments: ${await prisma.assignment.count({ where: { postoId: candidate.vacancy.postoId, endDate: null } })})`);

    // Target Vacancy: The one for the EMPTY Posto (d7841ecc)
    // From debug log: Vacancy ID 81462dab-4ad2-4eaa-9d78-6f0cdb1c4e97
    const targetVacancyId = "81462dab-4ad2-4eaa-9d78-6f0cdb1c4e97";

    const targetVacancy = await prisma.vacancy.findUnique({
        where: { id: targetVacancyId },
        include: { posto: true }
    });

    if (!targetVacancy) {
        console.error("Target Vacancy not found!");
        return;
    }

    console.log(`Target Vacancy: ${targetVacancy.id} (Status: ${targetVacancy.status})`);
    console.log(`Target Posto: ${targetVacancy.postoId} (Assignments: ${await prisma.assignment.count({ where: { postoId: targetVacancy.postoId, endDate: null } })})`);

    // Move Candidate
    await prisma.recruitmentCandidate.update({
        where: { id: candidate.id },
        data: { vacancyId: targetVacancyId }
    });

    console.log("\nSUCCESS: Candidate moved to correct vacancy.");
    console.log("This should resolve the duplicate visual.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
