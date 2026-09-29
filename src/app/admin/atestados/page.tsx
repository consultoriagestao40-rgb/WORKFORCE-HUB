import { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getAtestados, getAtestadosStats, getEmployeesSimpleList } from "@/actions/atestados";
import { AtestadosClient } from "@/components/admin/AtestadosClient";

export const metadata: Metadata = {
    title: "Gestão de Atestados Médicos | WorkForce Hub",
    description: "Validação inteligente de atestados médicos com OCR IA e integração automática com Secullum Ponto Web."
};

export const dynamic = "force-dynamic";

export default async function AtestadosPage() {
    const [atestados, stats, employees, companies] = await Promise.all([
        getAtestados(),
        getAtestadosStats(),
        getEmployeesSimpleList(),
        prisma.company.findMany({
            select: { id: true, name: true },
            orderBy: { name: "asc" }
        })
    ]);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <AtestadosClient
                initialAtestados={atestados as any}
                stats={stats}
                employees={employees as any}
                companies={companies}
            />
        </div>
    );
}
