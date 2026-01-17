"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, AlertTriangle, CheckCircle, Clock, ArrowUpRight, Filter, Download, Briefcase } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

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
}

export function VacationMonitorClient({ vacationData, stats }: VacationMonitorClientProps) {
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

        // Auto-width columns
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
        <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-[0.3em] mb-2">
                    <Calendar className="fill-current w-3 h-3" /> Gestão de Férias
                </div>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Monitor de Férias CLT</h2>
                        <p className="text-slate-500 font-medium">Controle centralizado de períodos aquisitivos e prazos concessivos</p>
                    </div>
                </div>
            </div>

            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="border-none shadow-premium bg-gradient-to-br from-red-500 to-red-600 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-white/70 text-[10px] font-black uppercase tracking-widest">Crítico</CardDescription>
                        <CardTitle className="text-4xl font-black">{stats.critical}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-sm font-bold">Férias Vencidas</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-premium bg-gradient-to-br from-amber-500 to-orange-600 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-white/70 text-[10px] font-black uppercase tracking-widest">Atenção</CardDescription>
                        <CardTitle className="text-4xl font-black">{stats.warning}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-bold">{"<90 dias p/ prazo"}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-premium bg-gradient-to-br from-emerald-500 to-green-600 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-white/70 text-[10px] font-black uppercase tracking-widest">Regular</CardDescription>
                        <CardTitle className="text-4xl font-black">{stats.ok}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-bold">Dentro do Prazo</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-premium bg-slate-900 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-full blur-2xl -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-white/70 text-[10px] font-black uppercase tracking-widest">Total Pendente</CardDescription>
                        <CardTitle className="text-4xl font-black">{stats.totalPendingDays}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            <span className="text-sm font-bold">Dias de Férias</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabela de Colaboradores */}
            <Card className="border-none shadow-premium bg-white/50 backdrop-blur-md">
                <CardHeader className="border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 p-6">
                    <div>
                        <CardTitle className="text-lg font-black text-slate-800">Colaboradores CLT</CardTitle>
                        <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Total: {filteredData.length} Exibidos</CardDescription>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 w-full">
                        {/* Company Filter */}
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 z-10" />
                            <select
                                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none text-slate-600 font-medium"
                                value={companyFilter}
                                onChange={(e) => handleCompanyChange(e.target.value)}
                            >
                                <option value="all">Todas as Empresas</option>
                                {companies.map(company => (
                                    <option key={company} value={company}>{company}</option>
                                ))}
                            </select>
                        </div>

                        {/* Client Filter */}
                        <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 z-10" />
                            <select
                                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none text-slate-600 font-medium disabled:opacity-50"
                                value={clientFilter}
                                onChange={(e) => setClientFilter(e.target.value)}
                                disabled={clients.length === 0}
                            >
                                <option value="all">Todos os Contratos</option>
                                {clients.map(client => (
                                    <option key={client} value={client}>{client}</option>
                                ))}
                            </select>
                        </div>

                        {/* Status Filter */}
                        <div className="relative">
                            <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 z-10" />
                            <select
                                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none text-slate-600 font-medium"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                            >
                                <option value="all">Todos os Status</option>
                                <option value="critical">🔴 Crítico</option>
                                <option value="warning">🟡 Atenção</option>
                                <option value="ok">🟢 Regular</option>
                            </select>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Buscar colaborador..."
                                className="pl-9 bg-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Excel Export */}
                        <Button variant="outline" className="gap-2 bg-white hover:bg-slate-50 border-slate-200 text-slate-600 w-full" onClick={handleExport}>
                            <Download className="w-4 h-4" />
                            Excel
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <table className="w-full">
                        <thead className="bg-slate-50/80 border-b border-slate-100">
                            <tr>
                                <th className="text-left p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider pl-6">Colaborador</th>
                                <th className="text-left p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Cargo</th>
                                <th className="text-left p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Posto</th>
                                <th className="text-center p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="text-center p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Dias Pendentes</th>
                                <th className="text-left p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Prazo Concessivo</th>
                                <th className="text-left p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Última Férias</th>
                                <th className="text-right p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider pr-6">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.map((emp) => (
                                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="p-4 pl-6">
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-900 group-hover:text-primary transition-colors">{emp.name}</span>
                                            <span className="text-[11px] text-slate-400 font-bold">{emp.cpf}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">{emp.role.name}</span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                            <span className="truncate max-w-[150px]" title={emp.postoLabel}>
                                                {emp.postoLabel}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        {emp.status === 'critical' && (
                                            <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-200 shadow-none font-black text-[10px] uppercase">🔴 Crítico</Badge>
                                        )}
                                        {emp.status === 'warning' && (
                                            <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-200 shadow-none font-black text-[10px] uppercase">🟡 Atenção</Badge>
                                        )}
                                        {emp.status === 'ok' && (
                                            <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-200 shadow-none font-black text-[10px] uppercase">🟢 Regular</Badge>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <span className="font-black text-lg text-slate-900">{emp.daysRemaining}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">dias</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {emp.daysRemaining > 0 ? (
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-700">{format(new Date(emp.concessiveLimitDate), 'dd/MM/yyyy')}</span>
                                                <span className={`text-[10px] font-black uppercase tracking-wide ${emp.daysUntilLimit < 0 ? 'text-red-500' : emp.daysUntilLimit <= 90 ? 'text-amber-500' : 'text-slate-400'}`}>
                                                    {emp.daysUntilLimit < 0 ? 'Vencido!' : `${emp.daysUntilLimit} dias restantes`}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm font-bold">-</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        {emp.lastVacationStart ? (
                                            <span className="text-sm font-medium text-slate-600">{format(new Date(emp.lastVacationStart), 'dd/MM/yyyy')}</span>
                                        ) : (
                                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Nunca</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right pr-6">
                                        <Link href={`/admin/employees/${emp.id}`}>
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-slate-100 text-slate-400 hover:text-primary transition-all">
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
    );
}
