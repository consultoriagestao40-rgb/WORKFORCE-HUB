"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, AlertTriangle, CheckCircle, Clock, ArrowUpRight, Filter, Download, Briefcase, ListTodo, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { VacationProcessTable } from "@/components/admin/VacationProcessTable";
import { VacationProcessItem, VacationWorkflowMetrics } from "@/actions/vacation-workflow";

type VacationStatus = 'critical' | 'warning' | 'ok';

interface EmployeeVacationData {
    id: string;
    name: string;
    cpf: string;
    role: { name: string };
    admissionDate: Date;
    totalVacationDaysTaken: number;
    lastVacationStart: Date | null;
    daysRemaining: number;
    daysUntilLimit: number;
    concessiveLimitDate: Date;
    status: VacationStatus;
    postoLabel: string;
    companyName: string;
}

interface VacationMonitorClientProps {
    vacationData: EmployeeVacationData[];
    stats: {
        critical: number;
        warning: number;
        ok: number;
        totalPendingDays: number;
    };
    processesData: {
        processes: VacationProcessItem[];
        metrics: VacationWorkflowMetrics;
    };
}

export function VacationMonitorClient({ vacationData, stats, processesData }: VacationMonitorClientProps) {
    const [mainTab, setMainTab] = useState<"ESTEIRA" | "RADAR">("ESTEIRA");
    const [statusFilter, setStatusFilter] = useState<"all" | VacationStatus>("all");
    const [companyFilter, setCompanyFilter] = useState("all");
    const [clientFilter, setClientFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");

    // Extract unique values for filters
    const companies = useMemo(() => {
        const unique = new Set(vacationData.map(item => item.companyName));
        return Array.from(unique).sort();
    }, [vacationData]);

    const clients = useMemo(() => {
        let filtered = vacationData;
        if (companyFilter !== "all") {
            filtered = filtered.filter(item => item.companyName === companyFilter);
        }
        const unique = new Set(filtered.map(item => item.postoLabel));
        return Array.from(unique).sort();
    }, [vacationData, companyFilter]);

    // Reset client filter when company changes
    const handleCompanyChange = (value: string) => {
        setCompanyFilter(value);
        setClientFilter("all");
    };

    const filteredData = vacationData.filter(emp => {
        const matchesStatus = statusFilter === "all" || emp.status === statusFilter;
        const matchesCompany = companyFilter === "all" || emp.companyName === companyFilter;
        const matchesClient = clientFilter === "all" || emp.postoLabel === clientFilter;
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.cpf.includes(searchTerm);

        return matchesStatus && matchesSearch && matchesCompany && matchesClient;
    });

    const handleExport = () => {
        const dataToExport = filteredData.map(emp => ({
            "Colaborador": emp.name,
            "CPF": emp.cpf,
            "Cargo": emp.role.name,
            "Status": emp.status === 'critical' ? "Crítico" : emp.status === 'warning' ? "Atenção" : "Regular",
            "Dias Pendentes": emp.daysRemaining,
            "Prazo Concessivo": format(new Date(emp.concessiveLimitDate), 'dd/MM/yyyy'),
            "Dias até Vencimento": emp.daysUntilLimit,
            "Últimas Férias": emp.lastVacationStart ? format(new Date(emp.lastVacationStart), 'dd/MM/yyyy') : "Nunca"
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);

        const wscols = [
            { wch: 30 }, // Nome
            { wch: 15 }, // CPF
            { wch: 20 }, // Cargo
            { wch: 10 }, // Status
            { wch: 15 }, // Dias Pendentes
            { wch: 15 }, // Prazo
            { wch: 15 }, // Dias ate vencimento
            { wch: 15 }  // Ultima ferias
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Férias");
        XLSX.writeFile(wb, `Relatorio_Ferias_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Top Header */}
            <div>
                <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-[0.3em] mb-2">
                    <Calendar className="fill-current w-3 h-3" /> Gestão de Férias & DP
                </div>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Monitor de Férias CLT</h2>
                        <p className="text-slate-500 font-medium text-sm">
                            Esteira de acompanhamento de processos, prazos de pagamento D-2 e controle de períodos aquisitivos
                        </p>
                    </div>

                    {/* Botões Principais de Navegação de Aba */}
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80 shadow-inner">
                        <button
                            onClick={() => setMainTab("ESTEIRA")}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                mainTab === "ESTEIRA"
                                    ? "bg-white text-indigo-700 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                            }`}
                        >
                            <ListTodo className="w-4 h-4 text-indigo-600" />
                            <span>Esteira de Tarefas DP</span>
                            {processesData.metrics.totalProcesses > 0 && (
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                    processesData.metrics.criticalPayment > 0 
                                        ? "bg-rose-500 text-white animate-pulse" 
                                        : "bg-indigo-100 text-indigo-800"
                                }`}>
                                    {processesData.metrics.totalProcesses}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => setMainTab("RADAR")}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                mainTab === "RADAR"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                            }`}
                        >
                            <ShieldAlert className="w-4 h-4 text-amber-600" />
                            <span>Radar Aquisitivo CLT</span>
                            {stats.critical > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white">
                                    {stats.critical}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* CONTEÚDO DA ABA SELECIONADA */}
            {mainTab === "ESTEIRA" ? (
                /* 🎯 ABA 1: ESTEIRA DE FÉRIAS E TAREFAS OPERACIONAIS */
                <VacationProcessTable 
                    processes={processesData.processes} 
                    metrics={processesData.metrics} 
                />
            ) : (
                /* 📊 ABA 2: RADAR DE PERÍODOS AQUISITIVOS CLT (ORIGINAL) */
                <div className="space-y-6">
                    {/* Cards de Estatísticas */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="border-none shadow-sm bg-gradient-to-br from-red-500 to-red-600 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
                            <CardHeader className="pb-2">
                                <CardDescription className="text-white/70 text-[10px] font-black uppercase tracking-widest">Crítico</CardDescription>
                                <CardTitle className="text-3xl font-black">{stats.critical}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    <span className="text-xs font-bold">Férias Vencidas</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm bg-gradient-to-br from-amber-500 to-orange-600 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
                            <CardHeader className="pb-2">
                                <CardDescription className="text-white/70 text-[10px] font-black uppercase tracking-widest">Atenção</CardDescription>
                                <CardTitle className="text-3xl font-black">{stats.warning}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    <span className="text-xs font-bold">{"<90 dias p/ prazo"}</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm bg-gradient-to-br from-emerald-500 to-green-600 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
                            <CardHeader className="pb-2">
                                <CardDescription className="text-white/70 text-[10px] font-black uppercase tracking-widest">Regular</CardDescription>
                                <CardTitle className="text-3xl font-black">{stats.ok}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="text-xs font-bold">Dentro do Prazo</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm bg-slate-900 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-full blur-2xl -mr-8 -mt-8" />
                            <CardHeader className="pb-2">
                                <CardDescription className="text-white/70 text-[10px] font-black uppercase tracking-widest">Total Pendente</CardDescription>
                                <CardTitle className="text-3xl font-black">{stats.totalPendingDays}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-primary" />
                                    <span className="text-xs font-bold">Dias de Férias Acumulados</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Tabela de Colaboradores e Prazos Aquisitivos */}
                    <Card className="border border-slate-200/80 shadow-xs bg-white">
                        <CardHeader className="border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
                            <div>
                                <CardTitle className="text-base font-bold text-slate-800">Colaboradores CLT & Períodos Aquisitivos</CardTitle>
                                <CardDescription className="font-semibold text-xs text-slate-400">Total: {filteredData.length} exibidos</CardDescription>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 w-full">
                                {/* Company Filter */}
                                <div className="relative">
                                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 z-10" />
                                    <select
                                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none text-slate-600 font-medium"
                                        value={companyFilter}
                                        onChange={(e) => handleCompanyChange(e.target.value)}
                                    >
                                        <option value="all">Todas as Empresas</option>
                                        {companies.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Client Filter */}
                                <div className="relative">
                                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 z-10" />
                                    <select
                                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none text-slate-600 font-medium"
                                        value={clientFilter}
                                        onChange={(e) => setClientFilter(e.target.value)}
                                    >
                                        <option value="all">Todos os Postos / Clientes</option>
                                        {clients.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Status Filter */}
                                <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                                    <SelectTrigger className="w-full bg-white border-slate-200 h-8 text-xs font-medium">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos os Status</SelectItem>
                                        <SelectItem value="critical">🔴 Crítico (Vencido)</SelectItem>
                                        <SelectItem value="warning">🟡 Atenção (&lt;90 dias)</SelectItem>
                                        <SelectItem value="ok">🟢 Regular</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Search Input */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <Input
                                        placeholder="Buscar colaborador..."
                                        className="pl-9 bg-white border-slate-200 h-8 text-xs font-medium"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                {/* Export Button */}
                                <Button
                                    variant="outline"
                                    onClick={handleExport}
                                    className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700 h-8 text-xs font-semibold flex items-center justify-center gap-2"
                                >
                                    <Download className="w-3.5 h-3.5 text-slate-500" />
                                    Exportar Excel
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="p-0">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="p-4">Colaborador</th>
                                        <th className="p-4">Posto / Cliente</th>
                                        <th className="p-4 text-center">Status</th>
                                        <th className="p-4 text-center">Dias Pendentes</th>
                                        <th className="p-4">Limite Concessivo</th>
                                        <th className="p-4">Últimas Férias</th>
                                        <th className="p-4 text-right pr-6">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {filteredData.map(emp => (
                                        <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-900">{emp.name}</div>
                                                <div className="text-[11px] text-slate-400 font-mono">{emp.cpf} • {emp.role.name}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className="font-semibold text-slate-700">{emp.postoLabel}</span>
                                                <div className="text-[10px] text-slate-400 uppercase tracking-widest">{emp.companyName}</div>
                                            </td>
                                            <td className="p-4 text-center">
                                                {emp.status === 'critical' && (
                                                    <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-200 shadow-none font-bold text-[10px] uppercase">🔴 Crítico</Badge>
                                                )}
                                                {emp.status === 'warning' && (
                                                    <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-200 shadow-none font-bold text-[10px] uppercase">🟡 Atenção</Badge>
                                                )}
                                                {emp.status === 'ok' && (
                                                    <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-200 shadow-none font-bold text-[10px] uppercase">🟢 Regular</Badge>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="font-black text-base text-slate-900">{emp.daysRemaining}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">dias</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {emp.daysRemaining > 0 ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-700">{format(new Date(emp.concessiveLimitDate), 'dd/MM/yyyy')}</span>
                                                        <span className={`text-[10px] font-bold uppercase tracking-wide ${emp.daysUntilLimit < 0 ? 'text-red-500' : emp.daysUntilLimit <= 90 ? 'text-amber-500' : 'text-slate-400'}`}>
                                                            {emp.daysUntilLimit < 0 ? 'Vencido!' : `${emp.daysUntilLimit} dias restantes`}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs font-bold">-</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {emp.lastVacationStart ? (
                                                    <span className="text-xs font-medium text-slate-600">{format(new Date(emp.lastVacationStart), 'dd/MM/yyyy')}</span>
                                                ) : (
                                                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Nunca</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right pr-6">
                                                <Link href={`/admin/employees/${emp.id}`}>
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-all cursor-pointer">
                                                        <ArrowUpRight className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredData.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                                                Nenhum registro encontrado com os filtros selecionados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
