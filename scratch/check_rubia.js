const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const rubia = await prisma.employee.findFirst({
        where: { name: { contains: "RUBIA" } }
    });
    if (rubia) {
        const copy = { ...rubia };
        if (copy.extraFields && typeof copy.extraFields === 'object') {
            const extra = { ...copy.extraFields };
            delete extra.attachments;
            copy.extraFields = extra;
        }
        console.log("RUBIA DATA:", JSON.stringify(copy, null, 2));
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
