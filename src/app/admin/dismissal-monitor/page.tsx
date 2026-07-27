export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { DashboardFilters } from "@/components/admin/DashboardFilters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, differenceInDays } from "date-fns";
import { AlertCircle, Calendar, Clock, ArrowLeft, ArrowUpRight, CheckCircle2, UserX } from "lucide-react";
import Link from "next/link";
import { DismissalMonitorActions } from "@/components/admin/DismissalMonitorActions";

async function getDismissalProcessData(companyId?: string, search?: string) {
    const where: any = {
        situation: {
            name: {
                in: ['Aviso Prévio', 'Processo de Rescisão', 'Processo de abandono']
            }
        },
        status: 'Ativo' // Only show active employees currently in process
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
            situation: { select: { name: true, color: true } },
            extraFields: true,
            assignments: {
                where: { endDate: null },
                include: { posto: { include: { client: true } } }
            }
        },
        orderBy: { name: 'asc' }
    });

    const today = new Date();

    return employees.map((emp: any) => {
        const extra = emp.extraFields as any || {};
        const proc = extra.dismissalProcess || {};

        let type = proc.type || emp.situation?.name || "Desconhecido";
        let startDate = proc.startDate ? new Date(proc.startDate) : null;
        let endDate = proc.endDate ? new Date(proc.endDate) : null;

        let dateLabel = "-";
        let daysCount = 0;
        let counterLabel = "Dias";
        let statusBadge = "NO_PRAZO"; // NO_PRAZO, A_VENCER, ALERTA

        if (type === "Aviso Prévio") {
            if (startDate && endDate) {
                dateLabel = `${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`;
                daysCount = differenceInDays(endDate, today);
                counterLabel = daysCount >= 0 ? "Restantes" : "Atrasados";
                if (daysCount <= 5 && daysCount >= 0) statusBadge = "A_VENCER";
                if (daysCount < 0) statusBadge = "ALERTA";
            }
        } else if (type === "Processo de Rescisão") {
            if (endDate) {
                dateLabel = `Previsto: ${format(endDate, 'dd/MM/yyyy')}`;
                daysCount = differenceInDays(endDate, today);
                counterLabel = daysCount >= 0 ? "Restantes" : "Atrasados";
                if (daysCount <= 5 && daysCount >= 0) statusBadge = "A_VENCER";
                if (daysCount < 0) statusBadge = "ALERTA";
            }
        } else if (type === "Processo de abandono") {
            if (startDate) {
                dateLabel = `Iniciado em: ${format(startDate, 'dd/MM/yyyy')}`;
                const daysElapsed = differenceInDays(today, startDate);
                daysCount = 30 - daysElapsed;
                if (daysCount <= 0) {
                    daysCount = Math.abs(daysCount);
                    counterLabel = "Completo!";
                    statusBadge = "ALERTA";
                } else {
                    counterLabel = "Restam p/ 30d";
                    if (daysCount <= 5) statusBadge = "A_VENCER";
                }
            }
        }

        const currentAssignment = emp.assignments[0];
        const postoLabel = currentAssignment?.posto?.client?.name || 'Rotativo / Sem Posto';

        return {
            ...emp,
            type,
            startDate,
            endDate,
            dateLabel,
            daysCount,
            counterLabel,
            statusBadge,
            postoLabel
        };
    });
}

export default async function DismissalMonitorPage({ 
    searchParams 
}: { 
    searchParams: Promise<{ companyId?: string, search?: string }> 
}) {
    const { companyId, search } = await searchParams;

    const companies = await prisma.company.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
    });

    const employees = await getDismissalProcessData(companyId, search);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/admin/employees">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-slate-200">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Monitor de Desligamento</h1>
                    <p className="text-slate-500">Gestão de prazos de Aviso Prévio, Abandono de Posto e Processos de Rescisão</p>
                </div>
            </div>

            <DashboardFilters companies={companies} clients={[]} />

            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Colaborador</th>
                                <th className="px-6 py-4">Empresa / Posto</th>
                                <th className="px-6 py-4">Processo</th>
                                <th className="px-6 py-4">Cronograma</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-center">Contador</th>
                                <th className="px-6 py-4 text-right">Ações</th>
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
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded w-fit mb-1">
                                            {emp.company?.name || 'S/ Empresa'}
                                        </div>
                                        <div className="text-xs text-slate-500 font-medium">{emp.postoLabel}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span 
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                                            style={{ 
                                                backgroundColor: `${emp.situation?.color}15` || '#f1f5f9',
                                                color: emp.situation?.color || '#475569'
                                            }}
                                        >
                                            <span 
                                                className="w-1.5 h-1.5 rounded-full" 
                                                style={{ backgroundColor: emp.situation?.color || '#475569' }}
                                            />
                                            {emp.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            {emp.dateLabel}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {emp.statusBadge === 'NO_PRAZO' && (
                                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0">🔵 Em dia</Badge>
                                        )}
                                        {emp.statusBadge === 'A_VENCER' && (
                                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0">🟡 Próximo</Badge>
                                        )}
                                        {emp.statusBadge === 'ALERTA' && (
                                            <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0">🔴 Alerta / Concluído</Badge>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className={`text-lg font-black ${emp.statusBadge === 'ALERTA' ? 'text-red-600' : 'text-slate-800'}`}>
                                                {emp.daysCount}
                                            </span>
                                            <span className="text-[9px] text-slate-400 uppercase font-black">
                                                {emp.counterLabel}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end items-center gap-2">
                                            <Link href={`/admin/employees/${emp.id}`}>
                                                <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-slate-200">
                                                    Ver Perfil
                                                </Button>
                                            </Link>
                                            <DismissalMonitorActions 
                                                employeeId={emp.id}
                                                employeeName={emp.name}
                                                situationName={emp.type}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {employees.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-slate-500 font-medium">
                                        Nenhum colaborador com processo de desligamento ou aviso prévio em andamento.
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
