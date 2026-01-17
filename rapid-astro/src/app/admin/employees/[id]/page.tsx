import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft,
    MapPin,
    Calendar,
    Clock,
    Banknote,
    ShieldAlert,
    Award,
    MoreHorizontal,
    User,
    UserX,
    Briefcase,
    Zap,
    HeartPulse,
    Gem,
    History as HistoryIcon,
    ChevronRight,
    CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { format, differenceInMonths, differenceInYears, addYears, isBefore, isAfter, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EditEmployeeSheet } from "@/components/admin/EditEmployeeSheet";
import { calculateMonthlyPayroll } from "@/lib/payroll";
import { getEmployeeTimeline } from "@/app/actions";
import { EmployeeTimeline } from "@/components/admin/EmployeeTimeline";

async function getEmployeeDetails(id: string) {
    const [employee, situations, roles, companies] = await Promise.all([
        prisma.employee.findUnique({
            where: { id },
            include: {
                role: true,
                situation: true,
                company: true, // Include company
                assignments: {
                    include: {
                        posto: {
                            include: { client: true, role: true }
                        }
                    },
                    orderBy: { startDate: 'desc' }
                },
                vacations: {
                    orderBy: { startDate: 'desc' }
                }
            }
        }),
        prisma.situation.findMany({ orderBy: { name: 'asc' } }),
        prisma.role.findMany({ orderBy: { name: 'asc' } }),
        prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
    ]);
    return { employee, situations, roles, companies };
}

export default async function EmployeeProfilePage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const { employee, situations, roles, companies } = await getEmployeeDetails(params.id);
    const timelineEvents = employee ? await getEmployeeTimeline(employee.id) : [];

    if (!employee) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <UserX className="w-16 h-16 text-slate-300" />
            <p className="text-xl font-black text-slate-400 italic uppercase tracking-widest">Colaborador não encontrado</p>
            <Link href="/admin/employees"><Button variant="link">Voltar para a lista</Button></Link>
        </div>
    );

    // ... [existing logic] ...
    const currentAssignment = employee.assignments.find(a => !a.endDate);
    const isNightShift = currentAssignment?.posto.isNightShift || false;

    const payroll = calculateMonthlyPayroll({
        baseSalary: employee.salary,
        insalubridade: employee.insalubridade,
        periculosidade: employee.periculosidade,
        gratificacao: employee.gratificacao,
        otherAdditions: employee.outrosAdicionais,
        workload: employee.workload,
        isNightShift
    });

    // Vacation Logic
    const admissionDate = new Date(employee.admissionDate);
    const today = new Date();
    const fullYearsWorked = differenceInYears(today, admissionDate);
    const totalDaysEarned = fullYearsWorked * 30;
    const daysRemaining = totalDaysEarned - employee.totalVacationDaysTaken;
    const earliestPendingPeriodYear = Math.floor(employee.totalVacationDaysTaken / 30) + 1;
    const concessiveLimitDate = addYears(admissionDate, earliestPendingPeriodYear + 1);

    const isCritical = daysRemaining > 0 && isBefore(concessiveLimitDate, today);
    const isWarning = daysRemaining > 0 && isBefore(concessiveLimitDate, addYears(today, 0.2));

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
                <Link href="/admin/employees">
                    <Button variant="ghost" className="gap-2 text-slate-500 font-black text-xs uppercase tracking-widest hover:text-primary transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Voltar para Equipe
                    </Button>
                </Link>
                <div className="flex gap-3">
                    <EditEmployeeSheet employee={employee} situations={situations} roles={roles} companies={companies} />
                </div>
            </div>

            {/* Premium Profile Header */}
            <div className="relative group">
                {/* Visual Backdrop */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/5 to-transparent rounded-[2.5rem] -z-10 blur-xl group-hover:blur-2xl transition-all duration-700" />

                <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-10 shadow-premium border border-white/40 flex flex-col md:flex-row items-center md:items-start gap-10 relative overflow-hidden">
                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />

                    {/* Avatar Hub */}
                    <div className="relative">
                        <div className="w-40 h-40 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-400 text-6xl font-black shadow-inner-premium border-4 border-white overflow-hidden group-hover:rotate-3 transition-transform duration-500">
                            {employee.name.charAt(0)}
                        </div>
                        <div className="absolute -bottom-3 -right-3 h-12 w-12 bg-white rounded-2xl shadow-premium flex items-center justify-center border-2 border-slate-50">
                            <div className="h-6 w-6 rounded-full animate-pulse" style={{ backgroundColor: employee.situation?.color || '#94a3b8' }} title={employee.situation?.name || 'Status'} />
                        </div>
                    </div>

                    {/* Essence Info */}
                    <div className="flex-1 text-center md:text-left space-y-4">
                        <div className="space-y-1">
                            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-primary/20 bg-primary/5 text-primary">
                                {employee.type} Specialist
                            </Badge>
                            <h1 className="text-5xl font-black text-slate-900 tracking-tighter">{employee.name}</h1>
                            <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 text-slate-500 font-bold">
                                <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-slate-400" /> {employee.role.name}</span>
                                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> {currentAssignment?.posto.client.name || 'Disponível (Reserva)'}</span>
                                <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-slate-400" /> {employee.company?.name || 'Sem Empresa Vinculada'}</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-center md:justify-start gap-3">
                            <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex flex-col">
                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Admissão</span>
                                <span className="text-xs font-black text-slate-800">{format(admissionDate, 'dd MMM yyyy')}</span>
                            </div>
                            <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex flex-col">
                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Document</span>
                                <span className="text-xs font-black text-slate-800">{employee.cpf}</span>
                            </div>
                            <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex flex-col">
                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Workload</span>
                                <span className="text-xs font-black text-slate-800">{employee.workload}h/m</span>
                            </div>
                        </div>
                    </div>

                    {/* Mini Stats Hub */}
                    <div className="w-full md:w-auto grid grid-cols-2 gap-4">
                        <div className="bg-primary text-white p-5 rounded-[2rem] shadow-lg shadow-primary/20 flex flex-col items-center justify-center gap-1">
                            <span className="text-[10px] font-black uppercase opacity-70 tracking-widest">Tempo de Casa</span>
                            <span className="text-2xl font-black">{fullYearsWorked}<span className="text-xs opacity-70 ml-1">Anos</span></span>
                        </div>
                        <div className="bg-slate-950 text-white p-5 rounded-[2rem] shadow-lg flex flex-col items-center justify-center gap-1">
                            <span className="text-[10px] font-black uppercase opacity-70 tracking-widest">Efficiency</span>
                            <span className="text-2xl font-black text-emerald-400">98<span className="text-xs opacity-70 ml-1">%</span></span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Logic & Finance */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Vacation Status Tile */}
                    <Card className="border-none shadow-premium overflow-hidden bg-gradient-to-br from-white to-slate-50/50 relative">
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-accent/5 rounded-full blur-3xl" />
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-xl font-black text-slate-800">CLT Vacation Portal</CardTitle>
                                    <CardDescription className="font-bold text-[10px] uppercase tracking-widest">Management of Acquisitive & Concessive Periods</CardDescription>
                                </div>
                                <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center text-accent">
                                    <Zap className="w-5 h-5 fill-current" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {daysRemaining > 0 ? (
                                <div className={`p-6 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all
                                    ${isCritical ? 'bg-rose-50 border-rose-100 text-rose-900 group shadow-lg shadow-rose-500/10' :
                                        isWarning ? 'bg-amber-50 border-amber-100 text-amber-900 shadow-lg shadow-amber-500/10' :
                                            'bg-emerald-50 border-emerald-100 text-emerald-900'}`}>
                                    <div className="flex items-center gap-5">
                                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center
                                            ${isCritical ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 animate-pulse' :
                                                isWarning ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                            <HeartPulse className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black tracking-tight leading-tight">
                                                {isCritical ? 'Urgente: Férias Vencidas' : isWarning ? 'Aviso: Prazo Terminando' : 'Dias de Férias Disponíveis'}
                                            </h4>
                                            <p className="text-xs font-bold opacity-70 uppercase tracking-widest">
                                                {daysRemaining} Dias pendentes de gozo
                                            </p>
                                        </div>
                                    </div>
                                    <div className="bg-white/40 backdrop-blur px-6 py-3 rounded-2xl border border-white/40">
                                        <span className="text-[10px] font-black block uppercase opacity-60">Prazo Concessivo</span>
                                        <span className="text-lg font-black">{format(concessiveLimitDate, 'dd MMM yyyy')}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-6 rounded-3xl bg-slate-100 border border-slate-200 flex items-center gap-4">
                                    <CheckCircle2 className="w-6 h-6 text-slate-400" />
                                    <p className="text-sm font-bold text-slate-500">Todos os períodos de férias estão em dia. Sem pendências.</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-white rounded-2xl shadow-inner-premium border border-slate-100">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Adquirido</span>
                                    <span className="text-xl font-black text-slate-800">{totalDaysEarned} <small className="text-xs text-slate-400">Dias</small></span>
                                </div>
                                <div className="p-4 bg-white rounded-2xl shadow-inner-premium border border-slate-100">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Consumido</span>
                                    <span className="text-xl font-black text-slate-800 text-primary">{employee.totalVacationDaysTaken} <small className="text-xs text-slate-400">Dias</small></span>
                                </div>
                                <div className="p-4 bg-white rounded-2xl shadow-inner-premium border border-slate-100">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Saldo</span>
                                    <span className="text-xl font-black text-emerald-600">{daysRemaining} <small className="text-xs text-slate-400">Dias</small></span>
                                </div>
                                <div className="p-4 bg-white rounded-2xl shadow-inner-premium border border-slate-100">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Próximo Crédito</span>
                                    <span className="text-xl font-black text-slate-400">---</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Modern Payroll Tiles */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <Gem className="w-5 h-5 text-primary" /> Pacote de Remuneração
                            </h3>
                            <Badge className="bg-slate-900 text-white font-black text-[10px] uppercase border-none px-3">Gross: R$ {payroll.totalGross.toLocaleString()}</Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {[
                                { label: 'Base Salary', value: employee.salary, icon: <Banknote className="w-4 h-4" /> },
                                { label: 'Insalubridade', value: employee.insalubridade, icon: <ShieldAlert className="w-4 h-4 text-orange-500" /> },
                                { label: 'Periculosidade', value: employee.periculosidade, icon: <ShieldAlert className="w-4 h-4 text-rose-500" /> },
                                { label: 'Gratificação CCT', value: employee.gratificacao, icon: <Award className="w-4 h-4 text-amber-500" /> },
                                { label: 'Adicional Noturno', value: payroll.nightShiftPremium, icon: <Clock className="w-4 h-4 text-indigo-500" />, sub: isNightShift ? 'Posto Ativo' : 'Inativo' },
                                { label: 'Other / DSR', value: employee.outrosAdicionais + payroll.dsrPremium, icon: <MoreHorizontal className="w-4 h-4 text-slate-500" /> },
                                { label: 'Vale Alimentação', value: employee.valeAlimentacao || 0, icon: <Gem className="w-4 h-4 text-emerald-500" />, highlight: true },
                                { label: 'Vale Transporte', value: employee.valeTransporte || 0, icon: <Gem className="w-4 h-4 text-blue-500" />, highlight: true }
                            ].map((item, idx) => (
                                <div key={idx} className="bg-white p-5 rounded-3xl shadow-premium border border-slate-100 group hover:border-primary/20 transition-all hover:-translate-y-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                            {item.icon}
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mt-0.5">{item.label}</span>
                                    </div>
                                    <div className="text-xl font-black text-slate-900 tracking-tight">R$ {item.value.toLocaleString()}</div>
                                    {item.sub && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{item.sub}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Timeline & Sidebars */}
                <div className="space-y-8">
                    <Card className="border-none shadow-premium overflow-hidden bg-slate-900 text-white p-8">
                        <div className="flex items-center gap-3 mb-8">
                            <HistoryIcon className="w-6 h-6 text-primary" />
                            <h3 className="text-xl font-black tracking-tighter">Histórico de Carreira</h3>
                        </div>

                        <EmployeeTimeline events={timelineEvents} />
                    </Card>

                    {/* Quick Access Sidebar Card */}
                    <div className="bg-gradient-to-br from-slate-50 to-white p-8 rounded-[2.5rem] shadow-premium border border-slate-100 flex flex-col gap-6">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Operational Tools</h5>

                        <Button className="w-full bg-slate-900 text-white rounded-2xl h-14 font-black justify-between group hover:bg-black">
                            Record Vacation <Zap className="w-4 h-4 fill-primary text-primary group-hover:scale-125 transition-transform" />
                        </Button>

                        <Button variant="outline" className="w-full border-slate-200 text-slate-900 rounded-2xl h-14 font-black justify-between group">
                            Generate Report <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Button>

                        <div className="mt-4 p-5 bg-primary/5 rounded-3xl border border-primary/10">
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Visão de RH</p>
                            <p className="text-xs text-slate-600 font-bold leading-relaxed">Este colaborador consumiu {((employee.totalVacationDaysTaken / totalDaysEarned) * 100).toFixed(0)}% de seu crédito total de férias adquirido.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
