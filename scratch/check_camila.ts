import { prisma } from "../src/lib/db";

async function main() {
    const employee = await prisma.employee.findFirst({
        where: { name: { contains: "Camila Carolina", mode: "insensitive" } },
        include: {
            assignments: {
                include: {
                    posto: true
                }
            }
        }
    });
    console.log("EMPLOYEE:", JSON.stringify(employee, null, 2));
}

main().catch(console.error);
