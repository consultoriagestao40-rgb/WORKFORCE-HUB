export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { OperationsDesk } from "@/components/admin/OperationsDesk";

import { getCurrentUser } from "@/lib/auth";

export default async function OperationsPage() {
    const [companies, clients, systemUsers, currentUser] = await Promise.all([
        prisma.company.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        }),
        prisma.client.findMany({
            where: { isActive: true },
            select: { id: true, name: true, companyId: true, accountManagerId: true },
            orderBy: { name: 'asc' }
        }),
        prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        }),
        getCurrentUser()
    ]);

    return (
        <div className="space-y-6">
            <OperationsDesk 
                companies={companies} 
                clients={clients} 
                systemUsers={systemUsers} 
                currentUser={currentUser ? { id: currentUser.id, name: currentUser.name || "" } : null}
            />
        </div>
    );
}
