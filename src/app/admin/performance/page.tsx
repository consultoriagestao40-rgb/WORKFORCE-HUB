export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getCurrentUserRole } from "@/lib/auth";
import { PerformanceDashboard } from "@/components/admin/PerformanceDashboard";

export default async function PerformancePage() {
    const clients = await prisma.client.findMany({
        orderBy: { name: "asc" },
        include: { company: true }
    });

    const userRole = await getCurrentUserRole();

    return (
        <PerformanceDashboard
            initialClients={clients}
            userRole={userRole || "GESTOR"}
        />
    );
}
