export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { GlobalRoster } from "@/components/admin/GlobalRoster";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

import { DashboardFilters } from "@/components/admin/DashboardFilters";

async function getRosterData(companyId?: string, clientId?: string, search?: string) {


    const whereClause: any = { endDate: null };
    const postoFilter: any = {};

    if (companyId && companyId !== 'all') {
        postoFilter.client = { companyId };
    }

    if (clientId && clientId !== 'all') {
        postoFilter.clientId = clientId;
    }

    if (Object.keys(postoFilter).length > 0) {
        whereClause.posto = postoFilter;
    }

    if (search) {
        whereClause.OR = [
            { employee: { name: { contains: search, mode: 'insensitive' } } },
            { posto: { client: { name: { contains: search, mode: 'insensitive' } } } }
        ];
    }

    const assignments = await prisma.assignment.findMany({
        where: whereClause,
        include: {
            employee: true,
            posto: {
                include: { client: true, role: true }
            }
        },
        orderBy: {
            posto: {
                client: { name: 'asc' }
            }
        }
    });

    return assignments.map(a => ({
        id: a.id,
        employeeName: a.employee.name,
        siteName: a.posto.client.name,
        role: a.posto.role.name,
        schedule: a.posto.schedule,
        startDate: a.startDate
    }));
}

// Next.js 15+ searchParams is a Promise
export default async function RosterPage({ searchParams }: { searchParams: Promise<{ companyId?: string, clientId?: string, search?: string }> }) {
    const { companyId, clientId, search } = await searchParams;

    // Needs to fetch companies and clients for the filter
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

    const data = await getRosterData(companyId, clientId, search);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <CalendarDays className="w-8 h-8 text-blue-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Quadro Geral de Lotação</h1>
                        <p className="text-slate-500">Visualização automática das escalas mensais</p>
                    </div>
                </div>
            </div>

            <DashboardFilters companies={companies} clients={clients} />

            <GlobalRoster data={data} />

            <Card className="bg-blue-50 border-blue-100">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-semibold text-blue-800">💡 Como funciona?</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-blue-700 leading-relaxed">
                    Este quadro projeta os dias de trabalho ("T") e folga baseado no tipo de escala e na data de início da lotação do colaborador.
                    Escalas do tipo <strong>12x36 Par</strong> e <strong>12x36 Ímpar</strong> seguem o calendário oficial do mês, enquanto outras escalas seguem o ciclo a partir da data de início.
                </CardContent>
            </Card>
        </div>
    );
}
