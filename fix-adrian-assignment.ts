
import 'dotenv/config';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Fixing Adrian Pena Ramirez Assignment...");

    // 1. Get Adrian's IDs
    const candidateName = "ADRIAN PENA RAMIREZ";
    const candidate = await prisma.recruitmentCandidate.findFirst({
        where: { name: { equals: candidateName, mode: 'insensitive' } }
    });

    const employee = await prisma.employee.findFirst({
        where: { name: { equals: candidateName, mode: 'insensitive' } },
        include: { assignments: { where: { endDate: null } } }
    });

    if (!candidate || !employee) {
        console.error("Candidate or Employee not found.");
        return;
    }

    console.log(`Found Candidate: ${candidate.id}`);
    console.log(`Found Employee: ${employee.id}`);

    const activeAssignment = employee.assignments[0];
    if (!activeAssignment) {
        console.error("No active assignment to move!");
        // Might need to create one? But user said he is allocated.
        return;
    }
    console.log(`Current Assignment Posto: ${activeAssignment.postoId}`);

    // 2. Target Posto and Vacancy (The Empty 07:00 - 19:00)
    // From debug log:
    // POSTO: eb3e0748-9677-4870-ba10-6ddcd5a93413
    // VACANCY: ab485589-81ab-42f6-9312-8c08f98bd0de

    const targetPostoId = "eb3e0748-9677-4870-ba10-6ddcd5a93413";
    const targetVacancyId = "ab485589-81ab-42f6-9312-8c08f98bd0de";

    // 3. Perform Updates
    await prisma.$transaction([
        // A. Move Assignment
        prisma.assignment.update({
            where: { id: activeAssignment.id },
            data: { postoId: targetPostoId }
        }),
        // B. Move Candidate to correct Vacancy
        prisma.recruitmentCandidate.update({
            where: { id: candidate.id },
            data: { vacancyId: targetVacancyId }
        }),
        // C. Close the Target Vacancy (since it's now filled)
        prisma.vacancy.update({
            where: { id: targetVacancyId },
            data: { status: 'CLOSED' }
        })
    ]);

    console.log("SUCCESS: Adrian moved to Posto 07:00-19:00 (eb3e...) and Vacancy Closed.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
