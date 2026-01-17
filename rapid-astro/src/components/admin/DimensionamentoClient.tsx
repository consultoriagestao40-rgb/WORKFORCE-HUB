"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Search,
    Download,
    Briefcase,
    Users,
    AlertCircle,
    Filter,
    XCircle
} from "lucide-react";
import * as XLSX from "xlsx";
import { format } from "date-fns";

interface DimensionamentoItem {
    companyName: string;
    clientName: string;
    totalPostos: number;
    occupiedPostos: number;
    difference: number;
}

interface DimensionamentoClientProps {
    data: DimensionamentoItem[];
}

export function DimensionamentoClient({ data }: DimensionamentoClientProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [companyFilter, setCompanyFilter] = useState("all");
    const [clientFilter, setClientFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");

    // Extract unique values for filters
    const companies = useMemo(() => {
        const unique = new Set(data.map(item => item.companyName));
        return Array.from(unique).sort();
    }, [data]);

    const clients = useMemo(() => {
        let filtered = data;
        if (companyFilter !== "all") {
            filtered = filtered.filter(item => item.companyName === companyFilter);
        }
        const unique = new Set(filtered.map(item => item.clientName));
        return Array.from(unique).sort();
    }, [data, companyFilter]);

    // Reset client filter when company changes
    const handleCompanyChange = (value: string) => {
        setCompanyFilter(value);
        setClientFilter("all");
    };

    // Filter Logic
    const filteredData = data.filter(item => {
        const matchesSearch =
            item.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.clientName.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCompany = companyFilter === "all" || item.companyName === companyFilter;
        const matchesClient = clientFilter === "all" || item.clientName === clientFilter;

        let matchesStatus = true;
        if (statusFilter === "vagas") matchesStatus = item.difference < 0;
        else if (statusFilter === "excesso") matchesStatus = item.difference > 0;
        else if (statusFilter === "ok") matchesStatus = item.difference === 0;

        return matchesSearch && matchesCompany && matchesClient && matchesStatus;
    });

    // Stats Calculation
    const totalPostos = filteredData.reduce((sum, item) => sum + item.totalPostos, 0);
    const totalAlocados = filteredData.reduce((sum, item) => sum + item.occupiedPostos, 0);
    const vagasEmAberto = filteredData.reduce((sum, item) => sum + (item.difference < 0 ? Math.abs(item.difference) : 0), 0);
    const excesso = filteredData.reduce((sum, item) => sum + (item.difference > 0 ? item.difference : 0), 0);

    // Export Logic
    const handleExport = () => {
        const dataToExport = filteredData.map(item => ({
            "Empresa": item.companyName,
            "Cliente/Contrato": item.clientName,
            "Postos Contratados": item.totalPostos,
            "Alocados": item.occupiedPostos,
            "Diferença": item.difference,
            "Status": item.difference === 0 ? "OK" : item.difference < 0 ? "Vagas em Aberto" : "Excesso"
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);

        // Auto-width columns
        const wscols = [
            { wch: 30 }, // Empresa
            { wch: 40 }, // Cliente
            { wch: 15 }, // Postos
            { wch: 15 }, // Alocados
            { wch: 10 }, // Diferença
            { wch: 20 }  // Status
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Dimensionamento");
        XLSX.writeFile(wb, `Dimensionamento_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
    };

    return (
        <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div>
                <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-[0.3em] mb-2">
                    <Briefcase className="fill-current w-3 h-3" /> Relatórios
                </div>
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Dimensionamento</h2>
                    <p className="text-slate-500 font-medium">Comparativo de vagas contratuais vs. quadro alocado</p>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="border-none shadow-premium bg-slate-900 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-white/70 text-[10px] font-black uppercase tracking-widest">Postos Cadastrados</CardDescription>
                        <CardTitle className="text-4xl font-black">{totalPostos}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-bold text-slate-400">Vagas Totais</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-premium bg-white relative overflow-hidden text-slate-900">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Alocados</CardDescription>
                        <CardTitle className="text-4xl font-black">{totalAlocados}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-bold text-slate-500">Funcionários Ativos</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-premium bg-gradient-to-br from-orange-500 to-amber-600 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-white/70 text-[10px] font-black uppercase tracking-widest">Vagas em Aberto</CardDescription>
                        <CardTitle className="text-4xl font-black">{vagasEmAberto}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm font-bold">Postos sem cobertura</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-premium bg-gradient-to-br from-blue-500 to-indigo-600 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-white/70 text-[10px] font-black uppercase tracking-widest">Excesso</CardDescription>
                        <CardTitle className="text-4xl font-black">{excesso}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span className="text-sm font-bold">Acima do contratado</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table Section */}
            <div className="space-y-4">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-800">Quadro de Vagas</h3>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-full">Total: {filteredData.length} Contratos</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" className="gap-2 bg-white hover:bg-slate-50 border-slate-200 text-slate-600" onClick={handleExport}>
                                <Download className="w-4 h-4" />
                                Excel
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                        {/* Company Filter */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Empresa</label>
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
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
                        </div>

                        {/* Client Filter */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Cliente / Contrato</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
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
                        </div>

                        {/* Status Filter */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Status</label>
                            <div className="relative">
                                <AlertCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <select
                                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none text-slate-600 font-medium"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <option value="all">Todos os Status</option>
                                    <option value="vagas">🔴 Vagas em Aberto</option>
                                    <option value="excesso">🔵 Excesso de Pessoal</option>
                                    <option value="ok">🟢 Quadro Completo</option>
                                </select>
                            </div>
                        </div>

                        {/* Text Search */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Busca Rápida</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <Input
                                    placeholder="Buscar..."
                                    className="pl-9 bg-white border-slate-200 h-[38px]"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50/80 border-b border-slate-100">
                            <tr>
                                <th className="text-left p-4 pl-6 text-[10px] font-black text-slate-400 uppercase tracking-wider">Empresa</th>
                                <th className="text-left p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Cliente / Contrato</th>
                                <th className="text-center p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Postos</th>
                                <th className="text-center p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Alocados</th>
                                <th className="text-right p-4 pr-6 text-[10px] font-black text-slate-400 uppercase tracking-wider">Diferença</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="p-4 pl-6 font-bold text-slate-500 text-xs uppercase tracking-wide">
                                        {row.companyName}
                                    </td>
                                    <td className="p-4 font-black text-slate-800 text-sm group-hover:text-primary transition-colors">
                                        {row.clientName}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="inline-flex items-center justify-center min-w-[32px] h-[32px] rounded-lg bg-slate-100 text-slate-600 font-bold text-xs border border-slate-200">
                                            {row.totalPostos}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="inline-flex items-center justify-center min-w-[32px] h-[32px] rounded-lg bg-slate-100 text-slate-600 font-bold text-xs border border-slate-200">
                                            {row.occupiedPostos}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right pr-6">
                                        {row.difference < 0 ? (
                                            <Badge className="bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200 shadow-none font-black text-[10px] uppercase">
                                                {row.difference} Vagas
                                            </Badge>
                                        ) : row.difference === 0 ? (
                                            <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 shadow-none font-black text-[10px] uppercase">
                                                OK
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 shadow-none font-black text-[10px] uppercase">
                                                +{row.difference} Excesso
                                            </Badge>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-slate-400 font-medium">
                                        Nenhum contrato encontrado com os filtros atuais.
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
