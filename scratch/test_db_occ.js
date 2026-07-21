import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkOccurrences() {
    try {
        const emp = await prisma.employee.findFirst({
            where: {
                name: {
                    contains: "ADJANY",
                    mode: 'insensitive'
                }
            },
            include: {
                occurrences: true,
                assignments: {
                    include: {
                        posto: true
                    }
                }
            }
        });

        console.log("Employee Adjany:");
        console.log(" - Name:", emp?.name);
        console.log(" - CPF:", emp?.cpf);
        console.log(" - VT Opt-In:", emp?.vtOptIn);
        console.log(" - valeTransporte:", emp?.valeTransporte);
        console.log(" - Active Posto Vale:", emp?.assignments?.[0]?.posto?.valeTransporte);
        console.log("\nOccurrences list:");
        emp?.occurrences?.forEach(occ => {
            console.log(` - ID: ${occ.id} | Date: ${occ.date.toISOString()} | Type: ${occ.type} | Title: ${occ.title}`);
        });

    } catch (e) {
        console.error(e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkOccurrences();
