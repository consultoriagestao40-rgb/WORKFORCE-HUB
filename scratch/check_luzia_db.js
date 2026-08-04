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
    const luzia = await prisma.employee.findFirst({
        where: {
            name: { contains: 'LUZIA', mode: 'insensitive' }
        },
        include: {
            assignments: {
                include: {
                    posto: true
                }
            }
        }
    });
    console.log("Luzia Employee record:", JSON.stringify(luzia, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
