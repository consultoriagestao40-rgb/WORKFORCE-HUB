import React from "react";
import { prisma } from "@/lib/db";
import PunchAdjustmentsClient from "@/components/admin/PunchAdjustmentsClient";

export const dynamic = "force-dynamic";

export default async function PunchAdjustmentsPage() {
    // 1. Buscar todas as solicitações / alertas de ajuste de batida
    const adjustments = await prisma.attendancePunchAdjustment.findMany({
        include: {
            employee: { select: { id: true, name: true, cpf: true } },
            client: {
                select: {
                    id: true,
                    name: true,
                    accountManager: { select: { id: true, name: true, phone: true } }
                }
            },
            posto: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 200
    });

    // 2. Buscar justificativas ativas sincronizadas do Secullum
    const justifications = await prisma.secullumJustification.findMany({
        where: { isActive: true },
        orderBy: { descricao: "asc" }
    });

    // 3. Buscar grupos do WhatsApp cadastrados na Z-API
    const { fetchZapiGroups } = await import("@/lib/rh-notifications");
    const whatsappGroups = await fetchZapiGroups();

    // 4. Buscar colaboradores ativos para o seletor de testes
    const employees = await prisma.employee.findMany({
        where: { status: "ATIVO" },
        select: {
            id: true,
            name: true,
            cpf: true,
            company: { select: { name: true } }
        },
        orderBy: { name: "asc" },
        take: 150
    });

    const employeesList = employees.map(e => ({
        id: e.id,
        name: e.name,
        cpf: e.cpf,
        companyName: e.company?.name
    }));

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <PunchAdjustmentsClient
                initialAdjustments={adjustments as any}
                justifications={justifications}
                employeesList={employeesList}
                whatsappGroups={whatsappGroups}
            />
        </div>
    );
}
