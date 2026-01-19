import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Checking for orphaned vacancies...");

    // Find vacancies that are OPEN, have NO postoId (orphan), and look like auto-generated ones
    const orphans = await prisma.vacancy.findMany({
        where: {
            status: 'OPEN',
            postoId: null,
            description: {
                contains: "Vaga aberta automaticamente"
            }
        }
    });

    console.log(`Found ${orphans.length} orphaned vacancies.`);

    for (const v of orphans) {
        console.log(`- Closing orphan vacancy: ${v.title} (${v.id}) - Created at: ${v.createdAt}`);

        await prisma.vacancy.update({
            where: { id: v.id },
            data: { status: 'CLOSED' }
        });

        // Optional: log to system log?
        // But we don't have easy access to 'Log' model with 'SYSTEM' user here easily without a real user ID.
        // We'll just rely on script output.
    }

    console.log("Cleanup complete.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
