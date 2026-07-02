export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ClientDashboard } from "@/components/client/ClientDashboard";

export default async function ClientDashboardPage() {
    const user = await getCurrentUser();
    if (!user || user.role !== "CLIENTE") {
        redirect("/login");
    }

    // Buscar as empresas/contratos aos quais o cliente tem permissão
    const clientIds = user.clientIds || [];
    const clientContracts = await prisma.client.findMany({
        where: { id: { in: clientIds } },
        include: { company: true },
        orderBy: { name: "asc" }
    });

    return (
        <ClientDashboard 
            userName={user.name} 
            contracts={clientContracts.map(c => ({
                id: c.id,
                name: c.name,
                companyName: c.company?.name || "-"
            }))} 
        />
    );
}
