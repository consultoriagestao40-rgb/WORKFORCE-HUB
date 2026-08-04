const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const pam = await prisma.employee.findFirst({
        where: { name: { contains: "PAMELLA" } }
    });
    if (pam) {
        const copy = { ...pam };
        if (copy.extraFields && typeof copy.extraFields === 'object') {
            const extra = { ...copy.extraFields };
            delete extra.attachments;
            copy.extraFields = extra;
        }
        console.log("PAMELLA DATA:", JSON.stringify(copy, null, 2));
    } else {
        console.log("NOT FOUND");
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
