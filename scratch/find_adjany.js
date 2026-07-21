import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function findEmployees() {
    try {
        const emps = await prisma.employee.findMany({
            take: 5
        });
        console.log("First 5 employees:");
        emps.forEach(e => console.log(` - ${e.name} | CPF: ${e.cpf}`));

        const adjany = await prisma.employee.findFirst({
            where: {
                name: {
                    contains: "ADJANY"
                }
            }
        });
        console.log("Case-sensitive ADJANY match:", adjany?.name, "| CPF:", adjany?.cpf);

    } catch (e) {
        console.error(e.message);
    } finally {
        await prisma.$disconnect();
    }
}

findEmployees();
