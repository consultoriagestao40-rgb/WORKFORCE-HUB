
import { prisma } from '../src/lib/db';

async function main() {
    console.log('Checking for duplicate assignments...');

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

    // 3. Find employees with > 1 active assignment
    let found = 0;
    for (const [employeeId, assignments] of employeeAssignments.entries()) {
        if (assignments.length > 1) {
            found++;
            console.log(`\n⚠️  Employee: ${assignments[0].employee.name} (${employeeId}) has ${assignments.length} active assignments:`);
            assignments.forEach(a => {
                console.log(`   - Posto: ${a.posto.client.name} (ID: ${a.postoId}) | Start: ${a.startDate.toISOString()}`);
            });
        }
    }

    if (found === 0) {
        console.log('\n✅ No duplicate active assignments found.');
    } else {
        console.log(`\nFound ${found} employees with duplicate assignments.`);
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
