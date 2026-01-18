
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("=== USERS ===");
    const users = await prisma.user.findMany();
    users.forEach(u => console.log(`${u.id}: ${u.name} (${u.email})`));

    console.log("\n=== VACANCIES ===");
    const vacancies = await prisma.vacancy.findMany({
        include: {
            recruiter: true,
            participants: true
        }
    });

    vacancies.forEach(v => {
        console.log(`VACANCY: ${v.title} (${v.id})`);
        console.log(`  - Recruiter: ${v.recruiter ? v.recruiter.name + ' (' + v.recruiter.id + ')' : 'NONE'}`);
        console.log(`  - Participants: ${v.participants.length > 0 ? v.participants.map(p => p.name).join(', ') : 'NONE'}`);
    });

    console.log("\n=== LATEST NOTIFICATIONS (Last 10) ===");
    const notifications = await prisma.notification.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: true }
    });

    notifications.forEach(n => {
        console.log(`[${n.createdAt.toISOString()}] To: ${n.user.name} | Type: ${n.type} | Title: ${n.title}`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
