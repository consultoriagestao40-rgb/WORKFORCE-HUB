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

export default async function ClientsPage() {
    const [clients, companies, userRole] = await Promise.all([
        getClients(),
        getCompanies(),
        getCurrentUserRole()
    ]);

    return (
        <ClientsList
            initialClients={clients}
            companies={companies}
            userRole={userRole}
        />
    );
}
