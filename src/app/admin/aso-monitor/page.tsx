export const dynamic = "force-dynamic";

import { getAsoMonitorData } from "@/actions/aso";
import { AsoMonitorClient } from "@/components/admin/AsoMonitorClient";

export const metadata = {
    title: "Monitor de ASO | Work Force Hub",
    description: "Controle centralizado de vencimentos e exames ocupacionais (ASO)"
};

export default async function AsoMonitorPage() {
    const { items, stats } = await getAsoMonitorData();

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <AsoMonitorClient initialItems={items} stats={stats} />
        </div>
    );
}
