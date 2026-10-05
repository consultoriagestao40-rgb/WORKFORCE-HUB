"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Users, Building, ClipboardList, LayoutDashboard, History, Clock, Calendar, Building2, ShieldAlert, Briefcase, DollarSign, LogOut, Inbox, AlertCircle, BarChart, UserPlus, Landmark, CreditCard, Calculator, Scale, Shirt, Headphones, FileText, Scissors, BellRing, HeartPulse } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SidebarNavProps {
    user?: {
        name: string;
        role: string;
    } | null;
    isCollapsed?: boolean;
}

export function SidebarNav({ user, isCollapsed = false }: SidebarNavProps) {
    const role = user?.role;
    const isSupervisor = role === "SUPERVISOR";
    const [atestadosPendentes, setAtestadosPendentes] = useState(0);

    // Busca o número de atestados pendentes de validação
    useEffect(() => {
        if (isSupervisor) return;
        const fetchCount = async () => {
            try {
                const res = await fetch("/api/admin/atestados/count", { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    setAtestadosPendentes(data.count || 0);
                }
            } catch {
                // silencioso
            }
        };
        fetchCount();
        // Atualiza a cada 60 segundos
        const interval = setInterval(fetchCount, 60000);
        return () => clearInterval(interval);
    }, [isSupervisor]);

    if (isSupervisor) return null;

    const NavLink = ({ href, icon: Icon, label, colorClass = "", badge }: { href?: string; icon: any; label: string; colorClass?: string; badge?: number }) => {
        const content = (
            <div className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/10 rounded-2xl transition-all duration-300 group cursor-pointer",
                isCollapsed && "justify-center px-2"
            )}>
                <Icon className={cn("w-5 h-5 group-hover:scale-110 transition-transform flex-shrink-0", colorClass)} />
                {!isCollapsed && <span className="animate-in fade-in duration-300 flex-1">{label}</span>}
                {badge && badge > 0 && !isCollapsed && (
                    <span className="ml-auto bg-amber-500 text-slate-950 text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
                        {badge > 99 ? "99+" : badge}
                    </span>
                )}
                {badge && badge > 0 && isCollapsed && (
                    <span className="absolute top-1 right-1 bg-amber-500 text-slate-950 text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                        {badge > 9 ? "9+" : badge}
                    </span>
                )}
            </div>
        );

        if (isCollapsed) {
            return (
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="relative">
                                {href ? <Link href={href}>{content}</Link> : content}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-slate-900 text-white border-slate-800">
                            {label} {badge && badge > 0 ? `(${badge} pendente${badge > 1 ? "s" : ""})` : ""}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        }

        return href ? <Link href={href}>{content}</Link> : content;
    };

    const SectionHeader = ({ title }: { title: string }) => {
        if (isCollapsed) return <div className="h-px bg-white/5 my-4 mx-2" />;
        return <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 px-3 animate-in fade-in duration-300">{title}</div>;
    };

    return (
        <nav className="relative z-10 space-y-1.5 flex-1 overflow-x-hidden pr-0 sidebar-scrollbar flex flex-col">
            <div className="flex-1 space-y-1.5">
                <SectionHeader title="Gestão Core" />

                <NavLink href="/admin" icon={LayoutDashboard} label="Dashboard Overview" />

                <NavLink href="/admin/companies" icon={Building2} label="Minhas Empresas" />
                <NavLink href="/admin/clients" icon={Building} label="Cliente & Contrato" />
                <NavLink href="/admin/performance" icon={Landmark} label="Gestão de Contratos" />
                <NavLink href="/admin/reports" icon={BarChart} label="Relatórios" />
                <NavLink href="/admin/notificacoes-rh" icon={BellRing} label="Notificações & WhatsApp" colorClass="text-emerald-400 font-bold" />

                {role === 'ADMIN' && (
                    <NavLink href="/admin/users" icon={ShieldAlert} label="Gestão de Acessos" colorClass="text-indigo-400" />
                )}

                <NavLink href="/admin/employees" icon={Users} label="Colaboradores" />

                {!isCollapsed && <div className="h-px bg-white/5 my-6 mx-3" />}

                <SectionHeader title="Estrutura & Cargos" />
                <NavLink href="/admin/schedules" icon={Clock} label="Escalas de Posto" />
                <NavLink href="/admin/roles" icon={Briefcase} label="Cargos & Ordens de Serviço" colorClass="text-emerald-400 font-bold" />
                <NavLink href="/admin/allowance-types" icon={DollarSign} label="Tipos de Adicionais" />
                <NavLink href="/admin/situations" icon={ShieldAlert} label="Situações de RH" colorClass="text-primary" />

                <SectionHeader title="Operação" />

                <NavLink href="/admin/operations" icon={Clock} label="Mesa de Operações" colorClass="text-indigo-400" />
                <NavLink href="/admin/punch-adjustments" icon={Clock} label="Ajustes de Ponto" colorClass="text-cyan-400 font-bold" />
                <NavLink href="/admin/atendimento" icon={Headphones} label="Atendimento RH" colorClass="text-emerald-400 font-bold" />
                <NavLink href="/admin/atestados" icon={FileText} label="Gestão de Atestados" colorClass="text-sky-400 font-bold" badge={atestadosPendentes} />
                <NavLink href="/admin/disciplinary" icon={Scale} label="Gestão de Medidas" colorClass="text-rose-500" />
                <NavLink href="/admin/epi" icon={Shirt} label="EPIs & Uniformes" colorClass="text-amber-400" />
                <NavLink href="/admin/requests" icon={Inbox} label="Central de Solicitações" colorClass="text-orange-400" />
                <NavLink href="/admin/occurrences" icon={AlertCircle} label="Livro de Ocorrências" colorClass="text-red-400" />
                <NavLink href="/admin/roster" icon={Calendar} label="Escalas" />
                <NavLink href="/admin/dimensionamento" icon={BarChart} label="Dimensionamento" />
                <NavLink href="/admin/recrutamento" icon={UserPlus} label="Recrutamento" colorClass="text-pink-500" />
                <NavLink href="/admin/probation-monitor" icon={Clock} label="Monitor de Experiência" colorClass="text-amber-500" />
                <NavLink href="/admin/vacation-monitor" icon={Calendar} label="Monitor de Férias" colorClass="text-emerald-400" />
                <NavLink href="/admin/aso-monitor" icon={HeartPulse} label="Monitor de ASO" colorClass="text-rose-400 font-bold" />
                <NavLink href="/admin/dismissal-monitor" icon={ShieldAlert} label="Monitor de Desligamento" colorClass="text-rose-500" />
                <NavLink href="/admin/financial-costs" icon={DollarSign} label="Gestão de Custos" colorClass="text-emerald-500" />
                <NavLink href="/admin/payroll-preview" icon={Calculator} label="Prévia de Folha" colorClass="text-sky-400" />
                <NavLink href="/admin/payroll-audit" icon={ShieldAlert} label="Auditoria de Folha" colorClass="text-purple-400 font-bold" />
                <NavLink href="/admin/benefits" icon={CreditCard} label="Compra de Benefícios" colorClass="text-orange-400" />
                <NavLink href="/admin/holerites" icon={Scissors} label="Separador de Holerites" colorClass="text-teal-400 font-bold" />

                {!isCollapsed && <div className="h-px bg-white/5 my-6 mx-3" />}

                <NavLink href="/admin/history" icon={History} label="Auditoria" />

                <div className={cn(
                    "mt-8 p-4 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl border border-white/5 transition-all duration-300",
                    isCollapsed && "p-2 bg-none border-none justify-center flex"
                )}>
                    {!isCollapsed && <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Supervisor Mobile</div>}
                    <Link href="/mobile" className="inline-flex items-center text-xs font-bold text-white hover:underline gap-1">
                        {isCollapsed ? <ClipboardList className="w-5 h-5 text-primary" /> : <>Acessar Monitoramento <ClipboardList className="w-3 h-3" /></>}
                    </Link>
                </div>
            </div>

            <div className="pt-4 mt-4 border-t border-white/5 space-y-3">
                <form action={async () => {
                    const { logout } = await import("@/app/actions");
                    await logout();
                }}>
                    <button type="submit" className={cn(
                        "flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-2xl transition-all duration-300 w-full text-left group",
                        isCollapsed && "justify-center px-2"
                    )}>
                        <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        {!isCollapsed && <span>Sair do Sistema</span>}
                    </button>
                </form>

                {user && !isCollapsed && (
                    <div className="px-4 pb-2 animate-in fade-in duration-300">
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Logado como</p>
                        <p className="text-xs font-bold text-white truncate">{user.name}</p>
                    </div>
                )}
            </div>
        </nav>
    );
}
