import React from "react";
import { prisma } from "@/lib/db";
import PunchInconsistenciesClient from "@/components/admin/PunchInconsistenciesClient";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Inconsistências de Ponto | Workforce Hub",
    description: "Batidas faltantes no cartão de ponto (Secullum) para análise e disparo ao gestor do contrato."
};

export default async function PunchInconsistenciesPage() {
    const clients = await prisma.client.findMany({
        select: {
            id: true,
            name: true,
            accountManager: { select: { id: true, name: true, phone: true } }
        },
        orderBy: { name: "asc" }
    });

    const managersMap = new Map<string, { id: string; name: string; hasPhone: boolean }>();
    for (const c of clients) {
        const m = c.accountManager;
        if (m && !managersMap.has(m.id)) {
            managersMap.set(m.id, { id: m.id, name: m.name || "Sem nome", hasPhone: Boolean(m.phone && m.phone.replace(/\D/g, "").length >= 10) });
        }
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <PunchInconsistenciesClient
                clients={clients.map(c => ({ id: c.id, name: c.name }))}
                managers={Array.from(managersMap.values()).sort((a, b) => a.name.localeCompare(b.name))}
            />
        </div>
    );
}
