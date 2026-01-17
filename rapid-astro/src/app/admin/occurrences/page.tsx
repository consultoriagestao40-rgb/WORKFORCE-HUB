import { prisma } from "@/lib/db";
import { OccurrencesList } from "@/components/admin/OccurrencesList";
import { getCurrentUserRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OccurrencesPage() {
    const occurrences = await prisma.occurrence.findMany({
        orderBy: { date: 'desc' },
        include: {
            posto: {
                include: { client: true }
            },
            employee: true
        }
    });

    const allPostos = await prisma.posto.findMany({
        select: { id: true, client: { select: { name: true } } },
        orderBy: { client: { name: 'asc' } }
    });

    // Using a simpler query for employees to avoid massive payload, usually we filter by Posto but on global add form we might need all?
    // It's a lot of employees. Ideally it should be an Autocomplete. 
    // For MVP, limit to 200 or active ones.
    const allEmployees = await prisma.employee.findMany({
        select: { id: true, name: true },
        where: { NOT: { situation: { name: 'Desligado' } } },
        orderBy: { name: 'asc' }
    });

    const userRole = await getCurrentUserRole();

    return (
        <OccurrencesList
            initialOccurrences={occurrences}
            postos={allPostos}
            employees={allEmployees}
            userRole={userRole}
        />
    );
}
