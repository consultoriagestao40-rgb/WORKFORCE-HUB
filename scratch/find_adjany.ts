import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function findAdjany() {
    try {
        const emp = await prisma.employee.findFirst({
            where: {
                name: {
                    contains: "ADJANY",
                    mode: 'insensitive'
                }
            }
        });
        console.log("Employee Adjany Info:");
        console.log("Name:", emp?.name);
        console.log("CPF:", emp?.cpf);
    } catch (e: any) {
        console.error(e.message);
    } finally {
        await prisma.$disconnect();
    }
}

findAdjany();
