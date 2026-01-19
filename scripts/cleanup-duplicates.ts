
import { prisma } from '../src/lib/db';

async function main() {
    console.log('Starting cleanup of duplicate assignments...');

    // 1. Get all active assignments
    const activeAssignments = await prisma.assignment.findMany({
        where: { endDate: null },
        include: {
            employee: true,
            posto: { include: { client: true } }
        }
    });

    // 2. Group by employee
    const employeeAssignments = new Map<string, typeof activeAssignments>();

    for (const assignment of activeAssignments) {
        const existing = employeeAssignments.get(assignment.employeeId) || [];
        existing.push(assignment);
        employeeAssignments.set(assignment.employeeId, existing);
    }

    // 3. Process employees with duplicates
    for (const [employeeId, assignments] of employeeAssignments.entries()) {
        if (assignments.length > 1) {
            const name = assignments[0].employee.name;
            console.log(`\nProcessing ${name} (${employeeId})...`);

            // Identify the "real" assignment (not Rotativo)
            const realAssignments = assignments.filter(a => a.posto.client.name !== 'ROTATIVO');
            const rotativoAssignments = assignments.filter(a => a.posto.client.name === 'ROTATIVO');

            if (realAssignments.length > 0) {
                // If they have a real assignment, close ALL Rotativo assignments
                if (rotativoAssignments.length > 0) {
                    console.log(`  - Found ${realAssignments.length} real assignment(s) and ${rotativoAssignments.length} Rotativo assignment(s).`);
                    console.log(`  - Closing ${rotativoAssignments.length} Rotativo assignment(s)...`);

                    for (const rotativo of rotativoAssignments) {
                        await prisma.assignment.update({
                            where: { id: rotativo.id },
                            data: { endDate: new Date() }
                        });
                        await prisma.log.create({
                            data: {
                                action: "CORRECAO_SISTEMA",
                                details: `Fechamento automático de vínculo duplicado no Rotativo.`,
                                employeeId: employeeId,
                                userId: null // System action
                            }
                        });
                    }
                    console.log(`  ✅ Closed Rotativo assignments.`);
                } else {
                    console.log(`  ⚠️  Has multiple assignments but none are confirmed Rotativo (Check manually):`);
                    assignments.forEach(a => console.log(`    - ${a.posto.client.name}`));
                }
            } else {
                // If ONLY Rotativo assignments (duplicates within Rotativo)
                if (rotativoAssignments.length > 1) {
                    console.log(`  - Found ${rotativoAssignments.length} Rotativo assignments (no regular post).`);
                    console.log(`  - Keeping the most recent one.`);

                    // Sort by startDate desc
                    rotativoAssignments.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
                    const toKeep = rotativoAssignments[0];
                    const toClose = rotativoAssignments.slice(1);

                    for (const rotativo of toClose) {
                        await prisma.assignment.update({
                            where: { id: rotativo.id },
                            data: { endDate: new Date() }
                        });
                    }
                    console.log(`  ✅ Closed ${toClose.length} redundant Rotativo assignments.`);
                }
            }
        }
    }

    console.log('\nCleanup finished.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
