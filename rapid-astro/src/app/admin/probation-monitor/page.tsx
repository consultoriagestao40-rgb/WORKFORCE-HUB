
import { ProbationActions } from "@/components/admin/ProbationActions";

import { prisma } from "@/lib/db";
import { DashboardFilters } from "@/components/admin/DashboardFilters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, addDays, differenceInDays } from "date-fns";
import { CheckCircle2, XCircle, ArrowUpRight } from "lucide-react";

async function getProbationData(companyId?: string, search?: string) {
    const where: any = {
        OR: [
            { situation: { name: 'Ativo' } },
            { situation: null } // Include employees without situation defined yet if they are recent
        ],
        probationStatus: null // Only show employees pending probation action
    };

    if (companyId && companyId !== 'all') {
        where.companyId = companyId;
    }

    if (search) {
        where.name = { contains: search, mode: 'insensitive' };
    }

    const employees = await prisma.employee.findMany({
        where,
        select: {
            id: true,
            name: true,
            admissionDate: true,
            company: { select: { name: true } },
            role: { select: { name: true } },
            situation: { select: { name: true } },
            assignments: {
                where: { endDate: null },
                include: { posto: { include: { client: true } } }
            }
        },
        orderBy: { admissionDate: 'desc' }
    });

    const today = new Date();

    return employees.map((emp: any) => {
        const d45 = addDays(emp.admissionDate, 45);
        const d90 = addDays(emp.admissionDate, 90);

        let status = 'NONE';
        let deadline = null;
        let daysLeft = 0;
        let period = '';

        const daysSinceHiring = differenceInDays(today, emp.admissionDate);

        // Logic adjusted to be inclusive of the period
        if (daysSinceHiring <= 45) {
            status = '45_DAYS';
            deadline = d45;
            daysLeft = differenceInDays(d45, today);
            period = '1º Período';
        } else if (daysSinceHiring <= 90) {
            status = '90_DAYS';
            deadline = d90;
            daysLeft = differenceInDays(d90, today);
            period = '2º Período';
        } else {
            return null; // Expired probation
        }

        let statusBadge = 'NO_PRAZO';
        if (daysLeft <= 5) statusBadge = 'A_VENCER';
        if (daysLeft < 0) statusBadge = 'VENCIDO';

        const currentAssignment = emp.assignments[0];
        const postoLabel = currentAssignment ? currentAssignment.posto.client.name : 'Sem Posto';

        return {
            ...emp,
            statusBadge,
            deadline,
            daysLeft,
            period,
            postoLabel
        };
    }).filter(Boolean).sort((a: any, b: any) => (a?.daysLeft || 0) - (b?.daysLeft || 0));
}

export default async function ProbationMonitorPage({ searchParams }: { searchParams: Promise<{ companyId?: string, search?: string }> }) {
    const { companyId, search } = await searchParams;

    const companies = await prisma.company.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
    });

    const employees = await getProbationData(companyId, search);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Colaboradores em Experiência</h1>
                <p className="text-slate-500">Total: {employees.length} exibidos</p>
            </div>

            <DashboardFilters companies={companies} clients={[]} />

            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Colaborador</th>
                                <th className="px-6 py-4">Empresa</th>
                                <th className="px-6 py-4">Posto</th>
                                <th className="px-6 py-4">Período/Vencimento</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-center">Dias</th>
                                <th className="px-6 py-4 text-right">Ações Rápidas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {employees.map((emp: any) => (
                                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900">{emp.name}</div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            {emp.role.name}
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                            Adm: {format(emp.admissionDate, 'dd/MM/yyyy')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-blue-700 bg-blue-50 px-3 py-1 rounded-full w-fit max-w-[150px] truncate" title={emp.company?.name || 'S/ Empresa'}>
                                            {emp.company?.name || 'S/ Empresa'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-semibold text-slate-600 truncate max-w-[150px] inline-block" title={emp.postoLabel}>
                                            {emp.postoLabel}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant="secondary" className="mb-1 bg-slate-100 text-slate-600 hover:bg-slate-200 border-0">
                                            {emp.period}
                                        </Badge>
                                        <div className="text-xs text-slate-500">
                                            Vence: {format(emp.deadline, 'dd/MM/yyyy')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {emp.statusBadge === 'A_VENCER' && (
                                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0">🟡 A Vencer</Badge>
                                        )}
                                        {emp.statusBadge === 'NO_PRAZO' && (
                                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0">🔵 Em dia</Badge>
                                        )}
                                        {emp.statusBadge === 'VENCIDO' && (
                                            <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0">🔴 Vencido</Badge>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-lg font-bold text-slate-700">{Math.max(0, emp.daysLeft)}</span>
                                            <span className="text-[9px] text-slate-400 uppercase font-bold">Dias</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <ProbationActions employeeId={emp.id} employeeName={emp.name} />
                                    </td>
                                </tr>
                            ))}
                            {employees.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-slate-500">
                                        Nenhum colaborador em período de experiência.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
