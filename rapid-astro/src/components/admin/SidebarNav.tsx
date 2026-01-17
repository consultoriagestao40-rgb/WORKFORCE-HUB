"use client";

import Link from "next/link";
import { Users, Building, ClipboardList, LayoutDashboard, History, Clock, Calendar, Building2, ShieldAlert, Briefcase, DollarSign, LogOut, Inbox, AlertCircle, BarChart, UserPlus } from "lucide-react";

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
    const isAssistRH = role === "ASSIST_RH";
    const isSupervisor = role === "SUPERVISOR";

    if (isSupervisor) return null;

    const NavLink = ({ href, icon: Icon, label, colorClass = "" }: { href?: string; icon: any; label: string; colorClass?: string }) => {
        const content = (
            <div className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/10 rounded-2xl transition-all duration-300 group cursor-pointer",
                isCollapsed && "justify-center px-2"
            )}>
                <Icon className={cn("w-5 h-5 group-hover:scale-110 transition-transform", colorClass)} />
                {!isCollapsed && <span className="animate-in fade-in duration-300">{label}</span>}
            </div>
        );

        if (isCollapsed) {
            return (
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            {href ? <Link href={href}>{content}</Link> : content}
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-slate-900 text-white border-slate-800">
                            {label}
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
        <nav className="relative z-10 space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden pr-0 scrollbar-none flex flex-col">
            <div className="flex-1 space-y-1.5">
                <SectionHeader title="Gestão Core" />

                <NavLink href="/admin" icon={LayoutDashboard} label="Dashboard Overview" />

                {!isAssistRH && (
                    <>
                        <NavLink href="/admin/companies" icon={Building2} label="Minhas Empresas" />
                        <NavLink href="/admin/clients" icon={Building} label="Cliente & Contrato" />
                    </>
                )}

                {role === 'ADMIN' && (
                    <NavLink href="/admin/users" icon={ShieldAlert} label="Gestão de Acessos" colorClass="text-indigo-400" />
                )}

                <NavLink href="/admin/employees" icon={Users} label="Colaboradores" />

                {!isCollapsed && <div className="h-px bg-white/5 my-6 mx-3" />}

                {!isAssistRH && (
                    <>
                        <SectionHeader title="Estrutura & Cargos" />
                        <NavLink href="/admin/schedules" icon={Clock} label="Escalas de Posto" />
                        <NavLink href="/admin/roles" icon={Briefcase} label="Cargos/Funções" />
                        <NavLink href="/admin/allowance-types" icon={DollarSign} label="Tipos de Adicionais" />
                        <NavLink href="/admin/situations" icon={ShieldAlert} label="Situações de RH" colorClass="text-primary" />
                    </>
                )}

                <SectionHeader title="Operação" />

                <NavLink href="/admin/requests" icon={Inbox} label="Central de Solicitações" colorClass="text-orange-400" />
                <NavLink href="/admin/occurrences" icon={AlertCircle} label="Livro de Ocorrências" colorClass="text-red-400" />
                <NavLink href="/admin/roster" icon={Calendar} label="Escalas" />
                <NavLink href="/admin/dimensionamento" icon={BarChart} label="Dimensionamento" />
                <NavLink href="/admin/recrutamento" icon={UserPlus} label="Recrutamento" colorClass="text-pink-500" />
                <NavLink href="/admin/probation-monitor" icon={Clock} label="Monitor de Experiência" colorClass="text-amber-500" />
                <NavLink href="/admin/vacation-monitor" icon={Calendar} label="Monitor de Férias" colorClass="text-emerald-400" />

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
