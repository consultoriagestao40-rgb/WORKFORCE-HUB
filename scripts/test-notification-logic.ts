
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("=== DIAGNOSTIC START ===");

    // 1. Find a vacancy with a Recruiter
    const vacancy = await prisma.vacancy.findFirst({
        where: { recruiterId: { not: null } },
        include: { recruiter: true, participants: true }
    });

    if (!vacancy) {
        console.log("ERROR: No vacancy with recruiter found!");
        return;
    }

    console.log(`Testing with Vacancy: ${vacancy.title} (${vacancy.id})`);
    console.log(`Recruiter: ${vacancy.recruiter.name} (${vacancy.recruiterId})`);
    console.log(`Participants: ${vacancy.participants.length}`);

    // 2. Simulate User = Recruiter (Self-Notification Case)
    const currentUserId = vacancy.recruiterId;
    console.log(`Simulating Action by User: ${currentUserId} (IS RECRUITER)`);

    // 3. Logic from notifyVacancyStakeholders
    const notifiedIds = new Set();
    // OLD LOGIC (Excluded)
    // if (currentUserId) notifiedIds.add(currentUserId);

    console.log(`Notified IDs Set (Initial): size=${notifiedIds.size}`);

    // Notify Recruiter
    if (vacancy.recruiterId && !notifiedIds.has(vacancy.recruiterId)) {
        console.log(`[PASS] Will notify Recruiter: ${vacancy.recruiterId}`);

        // Try to create actual notification
        try {
            const notif = await prisma.notification.create({
                data: {
                    userId: vacancy.recruiterId,
                    title: "TESTE DIAGNOSTICO",
                    message: "Diagnostico de Auto-Notificação",
                    type: "SYSTEM",
                    link: "/admin/test"
                }
            });
            console.log(`[SUCCESS] Notification Created: ${notif.id}`);
        } catch (e) {
            console.error(`[FAIL] Creation Error:`, e);
        }

        notifiedIds.add(vacancy.recruiterId);
    } else {
        console.log(`[SKIP] Recruiter check failed or already notified.`);
    }

    console.log("=== DIAGNOSTIC END ===");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
