
import 'dotenv/config';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Debugging Adrian Pena Ramirez...");

    // 1. Find Candidate
    const candidate = await prisma.recruitmentCandidate.findFirst({
        where: { name: { contains: "ADRIAN", mode: 'insensitive' } },
        include: {
            vacancy: {
                include: { posto: true }
            }
        }
    });

    if (!candidate) {
        console.log("Candidate ADRIAN not found.");
    } else {
        console.log(`\nCANDIDATE: ${candidate.name} (ID: ${candidate.id})`);
        console.log(`Stage: ${candidate.stageId}`);
        console.log(`Vacancy: ${candidate.vacancyId} (Status: ${candidate.vacancy?.status})`);
        console.log(`Intended Posto: ${candidate.vacancy?.postoId}`);
    }

    // 2. Find Employee
    const employee = await prisma.employee.findFirst({
        where: { name: { equals: "ADRIAN PENA RAMIREZ", mode: 'insensitive' } },
        include: {
            assignments: {
                where: { endDate: null },
                include: { posto: { include: { client: true } } }
            }
        }
    });

    if (!employee) {
        console.log("\nEMPLOYEE record NOT found for Adrian.");
    } else {
        console.log(`\nEMPLOYEE: ${employee.name} (ID: ${employee.id})`);
        console.log(`Status: ${employee.status}`);
        console.log(`Active Assignments: ${employee.assignments.length}`);

        if (employee.assignments.length > 0) {
            employee.assignments.forEach(a => {
                console.log(`  - Assigned to: ${a.posto.client.name} (PostoID: ${a.postoId})`);
                console.log(`    Start: ${a.startDate}`);
            });
        } else {
            console.log("  - No active assignments found in DB.");
        }
    }

    // 3. Check the Posto that SHOULD be his (from Vacancy)
    if (candidate?.vacancy?.postoId) {
        const postoId = candidate.vacancy.postoId;
        const posto = await prisma.posto.findUnique({
            where: { id: postoId },
            include: {
                assignments: {
                    where: { endDate: null },
                    include: { employee: true }
                },
                client: true
            }
        });

        console.log(`\nCHECKING POSTO (${postoId}) linked to Vacancy:`);
        if (posto) {
            console.log(`Client: ${posto.client.name}`);
            console.log(`Occupant(s): ${posto.assignments.length}`);
            posto.assignments.forEach(a => {
                console.log(`  - Occupant: ${a.employee.name} (EmpID: ${a.employeeId})`);
            });

            if (posto.assignments.length === 0) console.log("  - POSTO IS EMPTY (In database)");
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
