export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { getCurrentUserRole } from "@/lib/auth";
import { FinancialCostsClient } from "@/components/admin/FinancialCostsClient";

async function getFinancialCostsData() {
    const today = new Date();

    const activeEmployees = await prisma.employee.findMany({
        where: { status: 'Ativo' },
        include: {
            role: true,
            situation: true,
            vacations: {
                orderBy: { endDate: 'desc' },
                take: 1
            }
        },
        orderBy: { name: 'asc' }
    });

    // Filtrar no servidor para garantir apenas funcionários realmente ativos (excluindo afastados e demitidos na situação)
    const filteredActive = activeEmployees.filter(emp => {
        if (emp.situation) {
            const sitName = emp.situation.name.toLowerCase();
            if (sitName.includes('afastado') || 
                sitName.includes('afastamento') || 
                sitName.includes('demitido') || 
                sitName.includes('desligado') || 
                sitName.includes('inativo')) {
                return false;
            }
        }
        return true;
    });

    // Calcular Tempo Médio de Permanência (TMP) dos funcionários ativos
    let totalStayMonths = 0;
    const activeCount = filteredActive.length;

    filteredActive.forEach(emp => {
        const admission = new Date(emp.admissionDate);
        const diffTime = Math.abs(today.getTime() - admission.getTime());
        const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.4375); // Média de dias por mês
        totalStayMonths += diffMonths;
    });

    const averageStayMonths = activeCount > 0 ? totalStayMonths / activeCount : 18;

    return {
        activeEmployees: filteredActive,
        averageStayMonths,
        activeCount
    };
}

export default async function FinancialCostsPage() {
    const [data, userRole] = await Promise.all([
        getFinancialCostsData(),
        getCurrentUserRole()
    ]);

    if (userRole === "SUPERVISOR") {
        return <div className="p-8 text-center text-slate-500 font-bold">Acesso não autorizado.</div>;
    }

    return (
        <FinancialCostsClient
            employees={data.activeEmployees}
            averageStayMonths={data.averageStayMonths}
            userRole={userRole || ""}
        />
    );
}
