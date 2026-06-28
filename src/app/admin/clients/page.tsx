export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { getCurrentUserRole } from "@/lib/auth";
import { ClientsList } from "./ClientsList";

async function getClients() {
    return await prisma.client.findMany({
        orderBy: { name: 'asc' },
        include: {
            company: { select: { id: true, name: true } },
            _count: { select: { postos: true } }
        }
    });
}

async function getCompanies() {
    return await prisma.company.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true }
    });
}

async function getVacantStats() {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [postos, monthlyCoverages] = await Promise.all([
        prisma.posto.findMany({
            include: {
                assignments: {
                    include: {
                        employee: {
                            include: { situation: true }
                        }
                    }
                },
                role: true,
                client: {
                    include: {
                        company: true
                    }
                }
            }
        }),
        prisma.coverage.findMany({
            where: { date: { gte: firstDayOfMonth, lte: now } },
            select: { postoId: true, date: true }
        })
    ]);

    const vacantPostos: any[] = [];
    let occupiedCount = 0;

    postos.forEach(p => {
        const activeAssignment = p.assignments.find(a => a.endDate === null || new Date(a.endDate) > now);
        if (activeAssignment) {
            occupiedCount++;
        } else {
            vacantPostos.push(p);
        }
    });

    // Calcular dias de vacância total
    let totalVagoDays = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    vacantPostos.forEach(p => {
        const endedAssignments = p.assignments.filter((a: any) => a.endDate);
        let vacantSinceDate: Date;
        if (endedAssignments.length > 0) {
            const sorted = [...endedAssignments].sort((a, b) => new Date(b.endDate!).getTime() - new Date(a.endDate!).getTime());
            vacantSinceDate = new Date(sorted[0].endDate);
        } else {
            vacantSinceDate = new Date(p.createdAt);
        }

        const vacantDateClean = new Date(vacantSinceDate);
        vacantDateClean.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(today.getTime() - vacantDateClean.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        totalVagoDays += diffDays;
    });

    // Calcular Glosa Global Projetada
    let glosaAccumulated = 0;
    const checkDate = new Date(firstDayOfMonth);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    while (checkDate <= todayEnd) {
        const checkTime = checkDate.getTime();
        const checkStr = checkDate.toDateString();

        for (const p of postos) {
            const postoCreated = new Date(p.createdAt);
            postoCreated.setHours(0, 0, 0, 0);
            if (checkTime < postoCreated.getTime()) continue;

            const hasAssignment = p.assignments.some(a => {
                const start = new Date(a.startDate);
                start.setHours(0, 0, 0, 0);
                const end = a.endDate ? new Date(a.endDate) : null;
                if (end) end.setHours(23, 59, 59, 999);

                if (checkTime < start.getTime()) return false;
                if (end && checkTime > end.getTime()) return false;
                return true;
            });

            if (!hasAssignment) {
                const hasCoverage = monthlyCoverages.some(c =>
                    c.postoId === p.id && new Date(c.date).toDateString() === checkStr
                );

                if (!hasCoverage) {
                    glosaAccumulated += (p.billingValue / 30);
                }
            }
        }
        checkDate.setDate(checkDate.getDate() + 1);
    }

    return {
        vagoDaysCount: totalVagoDays,
        glosaProjetada: glosaAccumulated,
        vacantPostos
    };
}

export default async function ClientsPage() {
    const [clients, companies, vacantStats, userRole] = await Promise.all([
        getClients(),
        getCompanies(),
        getVacantStats(),
        getCurrentUserRole()
    ]);

    return (
        <ClientsList
            initialClients={clients}
            companies={companies}
            userRole={userRole}
            vagoDaysCount={vacantStats.vagoDaysCount}
            glosaProjetada={vacantStats.glosaProjetada}
            vacantPostos={vacantStats.vacantPostos}
        />
    );
}
