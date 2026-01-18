const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("=== USER ROLE DIAGNOSTIC ===\n");

    // Find current logged in user (or search by name)
    const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true }
    });

    console.log("All users and their roles:");
    users.forEach(u => {
        console.log(`  ${u.name} (${u.email}): role = ${u.role}`);
    });

    console.log("\n=== NOTIFICATION CHECK ===\n");

    // Check recent notifications
    const recentNotifs = await prisma.notification.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, role: true } } }
    });

    console.log("Last 10 notifications:");
    recentNotifs.forEach(n => {
        console.log(`  [${n.createdAt.toISOString()}] ${n.user.name} (${n.user.role}): ${n.title}`);
    });

    console.log("\n=== ROLE FILTER TEST ===\n");

    // Test the actual filter used in notifications
    const targetUsers = await prisma.user.findMany({
        where: {
            role: { in: ['ADMIN', 'COORD_RH', 'ASSIST_RH', 'SUPERVISOR'] }
        },
        select: { id: true, name: true, role: true }
    });

    console.log("Users who SHOULD receive notifications:");
    targetUsers.forEach(u => {
        console.log(`  ✓ ${u.name} (${u.role})`);
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
