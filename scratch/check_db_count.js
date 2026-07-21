import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkCount() {
    try {
        console.log("DATABASE_URL:", process.env.DATABASE_URL);
        const empCount = await prisma.employee.count();
        const clientCount = await prisma.client.count();
        const userCount = await prisma.user.count();
        console.log("Count:");
        console.log(" - Employee count:", empCount);
        console.log(" - Client count:", clientCount);
        console.log(" - User count:", userCount);
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkCount();
