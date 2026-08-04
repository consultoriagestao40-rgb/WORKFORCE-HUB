const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const cand = await prisma.recruitmentCandidate.findFirst({
        where: { name: { contains: "PAMELLA" } }
    });
    console.log("CANDIDATE PAMELLA:", JSON.stringify(cand, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
