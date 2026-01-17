export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Activity,
    ArrowUpRight,
    Banknote,
    CreditCard,
    TrendingUp,
    TrendingDown,
    Users,
    UserX,
    Zap,
    AlertCircle,
    CheckCircle2
} from "lucide-react";
import { VacantPostosDialog } from "@/components/admin/VacantPostosDialog";
import { getEmployeesOnVacation } from "@/app/actions";
import { VacationSummaryCard } from "@/components/admin/VacationSummaryCard";

async function getAdminStats() {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [postos, budgetAgg, cashExposureAgg, vagoDaysCount, extraCostsAgg, recentCoverages, recentAssignments, vacationEmployees, monthlyCoverages, companies] = await Promise.all([
        // 1. Postos & Assignments (fetch ALL assignments touching this month)
        prisma.posto.findMany({
            include: {
                assignments: {
                    where: {
                        OR: [
                            { endDate: null }, // Currently active
                            { endDate: { gte: firstDayOfMonth } } // Ended this month or later
                        ]
                    },
                    include: {
                        employee: {
                            include: { situation: true }
                        }
                    }
                },
                role: true,
                client: {
                    include: {
                        company: true
                    }
                }
            }
        }),
        prisma.posto.aggregate({ _sum: { billingValue: true } }),
        prisma.coverage.aggregate({
            _sum: { costValue: true },
            where: { type: 'DIARISTA', date: { gte: firstDayOfMonth } }
        }),
        prisma.coverage.count({
            where: { type: 'VAGO', date: { gte: firstDayOfMonth } }
        }),
        prisma.coverage.aggregate({
            _sum: { costValue: true },
            where: { type: { notIn: ['DIARISTA', 'VAGO'] }, date: { gte: firstDayOfMonth } }
        }),
        prisma.coverage.findMany({
            include: {
                posto: { select: { role: { select: { name: true } }, client: { select: { name: true } } } },
                coveringEmployee: { select: { name: true } }
            },
            orderBy: { date: 'desc' },
            take: 8
        }),
        // 7. Recent Assignments
        prisma.assignment.findMany({
            where: { createdAt: { gte: firstDayOfMonth } }, // Show assignments from this month
            include: {
                posto: { select: { role: { select: { name: true } }, client: { select: { name: true } }, billingValue: true } },
                employee: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 5
        }),
        getEmployeesOnVacation(),
        // 8. All Monthly Coverages (for Glosa Check)
        prisma.coverage.findMany({
            where: { date: { gte: firstDayOfMonth, lte: now } },
            select: { postoId: true, date: true }
        }),
        // 9. Fetch Companies
        prisma.company.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, name: true }
        })
    ]);


    const totalVagas = postos.length;
    let occupiedCount = 0;
    let totalPayrollGross = 0;

    const vacantPostos: any[] = [];

    // Calculate Occupancy & Payroll (Snapshot based on ACTIVE assignments)
    postos.forEach(p => {
        // Active assignment = endDate is null OR endDate > now
        const activeAssignment = p.assignments.find(a => a.endDate === null || new Date(a.endDate) > now);

        if (activeAssignment) {
            occupiedCount++;
            const emp = activeAssignment.employee;
            totalPayrollGross += emp.salary + emp.insalubridade + emp.periculosidade + emp.gratificacao + emp.outrosAdicionais;
        } else {
            vacantPostos.push(p);
        }
    });

    const vacancyIndex = totalVagas > 0 ? ((totalVagas - occupiedCount) / totalVagas) * 100 : 0;
    const totalBudget = budgetAgg._sum.billingValue || 0;
    const cashExposure = cashExposureAgg._sum.costValue || 0;
    const extraCosts = extraCostsAgg._sum.costValue || 0;

    // --- ACCURATE REVENUE LOSS (GLOSA) CALCULATION ---
    // Accumulate daily loss from first day of month up to today 

    let glosaAccumulated = 0;
    const checkDate = new Date(firstDayOfMonth);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Loop through each day of the month until today
    while (checkDate <= todayEnd) {
        const checkTime = checkDate.getTime();
        const checkStr = checkDate.toDateString();

        for (const p of postos) {
            // 0. Skip if posto didn't exist yet
            // We normalize posto creation to start of day to be fair, or exact time.
            // If created 'today', it should count? Assuming checkDate is start of day.
            // If posto created Jan 10 14:00. CheckDate Jan 10 00:00.
            // We should probably count Jan 10 if created on Jan 10? 
            // Let's use strict > to avoid "day of creation" issues or use setHours on creation.
            const postoCreated = new Date(p.createdAt);
            postoCreated.setHours(0, 0, 0, 0);
            if (checkTime < postoCreated.getTime()) continue;

            // 1. Is there an assignment covering this date?
            // Start <= CheckTime AND (End is null OR End >= CheckTime)
            // We use start of days comparisons to be safe
            const hasAssignment = p.assignments.some(a => {
                const start = new Date(a.startDate);
                start.setHours(0, 0, 0, 0);
                const end = a.endDate ? new Date(a.endDate) : null;
                if (end) end.setHours(23, 59, 59, 999);

                // Is checkDate within start and end?
                if (checkTime < start.getTime()) return false;
                if (end && checkTime > end.getTime()) return false;
                return true;
            });

            if (!hasAssignment) {
                // 2. Is there a coverage for this date?
                // Coverage date matches checkDate (ignoring time)
                const hasCoverage = monthlyCoverages.some(c =>
                    c.postoId === p.id && new Date(c.date).toDateString() === checkStr
                );

                if (!hasCoverage) {
                    // NO ASSIGNMENT AND NO COVERAGE = REVENUE LOSS
                    glosaAccumulated += (p.billingValue / 30);
                }
            }
        }

        // Next Day
        checkDate.setDate(checkDate.getDate() + 1);
    }

    const glosaProjetada = glosaAccumulated;

    const ENCARGOS_MULTIPLIER = 1.6;
    const estimatedPayrollCostWithEncargos = totalPayrollGross * ENCARGOS_MULTIPLIER;
    const totalRealized = estimatedPayrollCostWithEncargos + extraCosts + cashExposure;
    const deviation = totalBudget > 0 ? ((totalRealized - totalBudget) / totalBudget) * 100 : 0;

    const recentActivity = [
        ...recentCoverages.map(c => ({
            id: c.id,
            type: c.type,
            date: c.date,
            clientName: c.posto.client.name,
            roleName: c.posto.role.name,
            value: c.costValue,
            status: c.paymentStatus
        })),
        ...recentAssignments.map(a => ({
            id: a.id,
            type: 'Alocação',
            date: a.createdAt,
            clientName: a.posto.client.name,
            roleName: a.posto.role.name,
            value: a.posto.billingValue,
            status: 'Ativo'
        }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

    return { totalVagas, vacancyIndex, occupiedCount, cashExposure, glosaProjetada, vagoDaysCount, recentActivity, totalBudget, totalRealized, deviation, vacantPostos, vacationEmployees, companies };
}

export default async function AdminDashboard() {
    const data = await getAdminStats();

    return (
        <div className="space-y-10">
            {/* Mission Control Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-[0.3em] mb-2">
                        <Zap className="fill-current w-3 h-3" /> Sistema Ativo
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Central de Comando</h2>
                    <p className="text-slate-500 font-medium">Pulso Financeiro e de Pessoal em Tempo Real</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white p-3 rounded-2xl shadow-premium border border-slate-200/50 flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Saúde Operacional</p>
                            <p className="text-lg font-black text-slate-800">{(100 - data.vacancyIndex).toFixed(1)}%</p>
                        </div>
                        <Activity className="w-8 h-8 text-emerald-500 bg-emerald-50 p-1.5 rounded-xl" />
                    </div>
                </div>
            </div>

            {/* Strategic Pulse Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50 overflow-hidden relative group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
                    <CardHeader className="pb-2 space-y-0">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Folha vs Orçamento</CardDescription>
                        <CardTitle className={`text-2xl font-black flex items-center gap-2 ${data.deviation > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {data.deviation.toFixed(1)}%
                            {data.deviation > 0 ? <ArrowUpRight className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                            <div className={`h-full ${data.deviation > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(Math.max(100 + data.deviation, 5), 100)}%` }} />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 italic">Meta: {data.totalBudget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50 overflow-hidden relative group">
                    <CardHeader className="pb-2 space-y-0">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Exposição de Caixa</CardDescription>
                        <CardTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            {data.cashExposure.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            <CreditCard className="w-5 h-5 text-primary" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] border-primary/20 bg-primary/5 text-primary font-bold px-1.5 py-0">DIARISTAS</Badge>
                            <span className="text-[10px] text-slate-400 font-medium italic">Pendente de Aprovação</span>
                        </div>
                    </CardContent>
                </Card>

                <VacantPostosDialog
                    vagoDaysCount={data.vagoDaysCount}
                    glosaProjetada={data.glosaProjetada}
                    vacantPostos={data.vacantPostos}
                    companies={data.companies}
                />

                <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50 overflow-hidden relative group">
                    <CardHeader className="pb-2 space-y-0">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Revenue Loss (Glosa)</CardDescription>
                        <CardTitle className="text-2xl font-black text-amber-600 flex items-center gap-2">
                            {data.glosaProjetada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            <AlertCircle className="w-5 h-5" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">Vagas em aberto: {data.totalVagas - data.occupiedCount}</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-premium bg-slate-900 text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[60px]" />
                    <CardHeader className="pb-2 space-y-0">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-500">Força de Trabalho</CardDescription>
                        <CardTitle className="text-3xl font-black text-white flex items-center gap-3">
                            {data.occupiedCount}
                            <Users className="w-6 h-6 text-primary" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-emerald-400 font-black">● {data.occupiedCount} ATIVOS</span>
                            <span className="text-slate-500 font-bold">/ {data.totalVagas} SLOTS</span>
                        </div>
                    </CardContent>
                </Card>

                <VacationSummaryCard employeesOnVacation={data.vacationEmployees} />
            </div>

            {/* Operational Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Real-time Ocurrences */}
                <Card className="lg:col-span-2 border-none shadow-premium overflow-hidden">
                    <CardHeader className="border-b border-slate-100 bg-white/50">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-lg font-black text-slate-800">Pulso Operacional</CardTitle>
                                <CardDescription>Últimos movimentos e ajustes operacionais</CardDescription>
                            </div>
                            <Activity className="w-5 h-5 text-primary animate-pulse" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest pl-6">Data & Time</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Site / Role</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Type</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right pr-6">Value / Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(data.recentActivity || []).map((item: any) => (
                                    <TableRow key={`${item.type}-${item.id}`} className="group hover:bg-slate-50 transition-colors">
                                        <TableCell className="pl-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-800">{format(new Date(item.date), 'dd MMM', { locale: ptBR })}</span>
                                                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">{format(new Date(item.date), 'HH:mm')}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-900 leading-tight">{item.clientName}</span>
                                                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">{item.roleName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                className={`text-[10px] font-black uppercase px-2 py-0 border-none rounded-full
                                                ${item.type === 'Diarista' ? 'bg-indigo-100 text-indigo-700' :
                                                        item.type === 'Alocação' ? 'bg-emerald-100 text-emerald-700' :
                                                            'bg-rose-100 text-rose-700'}`}
                                            >
                                                {item.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-black text-slate-800">
                                                    {item.value ? item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                                                </span>
                                                <span className={`text-[10px] font-black uppercase tracking-widest 
                                                  ${item.status === 'Pago' || item.status === 'Ativo' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                    {item.status}
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {data.recentActivity.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-slate-400 font-medium">
                                            Nenhuma atividade recente registrada.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Quick Insights / Action Cards */}
                <div className="space-y-6">
                    <Card className="border-none shadow-premium bg-gradient-to-br from-primary to-accent text-white p-6 relative overflow-hidden group">
                        <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                        <h3 className="text-xl font-black tracking-tighter mb-1">Saúde Financeira</h3>
                        <p className="text-sm text-white/70 mb-6 font-medium leading-relaxed">Estimativa de folha bruta atual em {data.totalRealized.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        <div className="flex gap-2">
                            <Badge className="bg-white/20 hover:bg-white/30 text-white font-black border-none text-[10px] uppercase">Encargos 60% Inc.</Badge>
                            {data.deviation < 0 && <Badge className="bg-emerald-400 text-white font-black border-none text-[10px] uppercase">Abaixo do Orçamento</Badge>}
                        </div>
                    </Card>

                    <Card className="border-none shadow-premium bg-white p-6 border-l-4 border-l-primary">
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-primary shadow-inner">
                                <Users className="w-5 h-5 font-black" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Staff Alerts</span>
                        </div>
                        <h4 className="font-black text-slate-900 mb-2">Verificação de Capacidade</h4>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed mb-4">
                            Sua força de trabalho está em <span className="text-primary font-black">{(100 - data.vacancyIndex).toFixed(0)}%</span> de capacidade.
                            {data.vacancyIndex > 5 ? ' Considere contratações urgentes para vagas em aberto.' : ' Alocação de pessoal dentro dos limites ideais.'}
                        </p>
                        <Link href="/admin/employees" className="text-xs font-black text-primary flex items-center gap-1 group">
                            Gerenciar Equipe <ArrowUpRight className="w-3 h-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </Link>
                    </Card>

                    <div className="text-center p-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">End of Transmission</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
