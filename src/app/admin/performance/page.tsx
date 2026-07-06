export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getCurrentUserRole, getCurrentUser } from "@/lib/auth";
import { PerformanceDashboard } from "@/components/admin/PerformanceDashboard";

export default async function PerformancePage() {
    const clients = await prisma.client.findMany({
        where: { monitorInOperations: true },
        orderBy: { name: "asc" },
        include: { company: true }
    });

    const userRole = await getCurrentUserRole();
    const user = await getCurrentUser();

    return (
        <PerformanceDashboard
            initialClients={clients}
            userRole={userRole || "GESTOR"}
            userName={user?.name || "Gestor"}
        />
    );
}
