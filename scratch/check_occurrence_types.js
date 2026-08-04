const fs = require('fs');
if (fs.existsSync('.env')) {
    const lines = fs.readFileSync('.env', 'utf-8').split('\n');
    for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            } else if (value.startsWith("'") && value.endsWith("'")) {
                value = value.substring(1, value.length - 1);
            }
            process.env[key] = value;
        }
    }
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("DATABASE_URL:", process.env.DATABASE_URL);
    const usersCount = await prisma.user.count();
    const employeesCount = await prisma.employee.count();
    const occurrencesCount = await prisma.occurrence.count();
    console.log("Users:", usersCount);
    console.log("Employees:", employeesCount);
    console.log("Occurrences:", occurrencesCount);

    if (occurrencesCount > 0) {
        const sampleOcc = await prisma.occurrence.findFirst();
        console.log("Sample Occurrence:", sampleOcc);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
