export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { getCurrentUserRole } from "@/lib/auth";
import { FinancialCostsClient } from "@/components/admin/FinancialCostsClient";

async function getFinancialCostsData() {
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    const [activeEmployees, dismissedEmployees] = await Promise.all([
        prisma.employee.findMany({
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
        }),
        prisma.employee.findMany({
            where: {
                OR: [
                    { status: 'Demitido' },
                    { status: { not: 'Ativo' } },
                    { dismissalReason: { not: null } }
                ]
            },
            select: {
                admissionDate: true,
                updatedAt: true
            }
        })
    ]);

    // Calcular Tempo Médio de Permanência (TMP) em meses
    let totalStayMonths = 0;
    let dismissedInLastYear = 0;
    const dismissedCount = dismissedEmployees.length;

    dismissedEmployees.forEach(emp => {
        const admission = new Date(emp.admissionDate);
        const dismissal = new Date(emp.updatedAt);
        
        // Diferença em meses
        const diffTime = Math.abs(dismissal.getTime() - admission.getTime());
        const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.4375); // Média de dias por mês
        totalStayMonths += diffMonths;

        if (dismissal >= oneYearAgo) {
            dismissedInLastYear++;
        }
    });

    const averageStayMonths = dismissedCount > 0 ? totalStayMonths / dismissedCount : 18; // Default 18 meses
    
    // Turnover anual simplificado: (Demitidos no último ano / Ativos atuais) * 100
    const activeCount = activeEmployees.length;
    const turnoverRate = activeCount > 0 ? (dismissedInLastYear / activeCount) * 100 : 0;

    return {
        activeEmployees,
        turnoverRate,
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
            turnoverRate={data.turnoverRate}
            averageStayMonths={data.averageStayMonths}
            userRole={userRole || ""}
        />
    );
}
