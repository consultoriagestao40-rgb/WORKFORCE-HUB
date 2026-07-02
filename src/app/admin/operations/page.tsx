export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { OperationsDesk } from "@/components/admin/OperationsDesk";

export default async function OperationsPage() {
    const [companies, clients] = await Promise.all([
        prisma.company.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        }),
        prisma.client.findMany({
            select: { id: true, name: true, companyId: true },
            orderBy: { name: 'asc' }
        })
    ]);

    return (
        <div className="space-y-6">
            <OperationsDesk companies={companies} clients={clients} />
        </div>
    );
}
