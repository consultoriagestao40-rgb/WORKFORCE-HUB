const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdriana() {
    try {
        const emp = await prisma.employee.findFirst({
            where: { name: { contains: "ADRIANA CRISTINA DA SILVA", mode: "insensitive" } },
            include: {
                occurrences: true,
                vacations: true,
                assignments: {
                    include: {
                        posto: {
                            include: { client: true }
                        }
                    }
                }
            }
        });

        if (!emp) {
            console.log("No employee found with name containing 'Adriana'.");
            return;
        }

        console.log("Employee Record:");
        console.log(" - ID:", emp.id);
        console.log(" - Name:", emp.name);
        console.log(" - Status:", emp.status);
        console.log(" - valeAlimentacao (Employee):", emp.valeAlimentacao);
        console.log(" - valeTransporte (Employee):", emp.valeTransporte);
        console.log(" - Assignments count:", emp.assignments?.length);
        if (emp.assignments?.length > 0) {
            const posto = emp.assignments[0].posto;
            console.log(" - Posto Scale:", posto?.schedule);
            console.log(" - Posto VA:", posto?.valeAlimentacao);
            console.log(" - Posto VAType:", posto?.vaType);
            console.log(" - Posto VT:", posto?.valeTransporte);
        }

        console.log("\nOccurrences:");
        emp.occurrences.forEach(occ => {
            console.log(` - Date: ${occ.date.toISOString().split('T')[0]} | Type: ${occ.type} | Description: ${occ.description}`);
        });

        console.log("\nVacations:");
        emp.vacations.forEach(v => {
            console.log(` - Start: ${v.startDate.toISOString().split('T')[0]} | End: ${v.endDate.toISOString().split('T')[0]}`);
        });

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkAdriana();
