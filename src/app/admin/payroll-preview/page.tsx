"use client";

import { useState, useEffect } from "react";
import { 
    DollarSign, 
    Calculator, 
    Search, 
    Calendar, 
    Info, 
    Building2, 
    Building, 
    User, 
    AlertCircle, 
    ChevronDown, 
    ChevronRight,
    TrendingDown,
    TrendingUp,
    Percent
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { getPayrollPreview, PayrollPreviewItem } from "@/actions/payroll";

export default function PayrollPreviewPage() {
    const today = new Date();
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);

    const [isLoading, setIsLoading] = useState(true);
    const [items, setItems] = useState<PayrollPreviewItem[]>([]);

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCompany, setSelectedCompany] = useState<string>("all");
    const [selectedClient, setSelectedClient] = useState<string>("all");
    const [groupedView, setGroupedView] = useState<"colaborador" | "empresa" | "contrato">("colaborador");
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await getPayrollPreview(selectedYear, selectedMonth);
            setItems(res.items || []);
        } catch (err: any) {
            toast.error("Erro ao carregar prévia de folha de pagamento.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedYear, selectedMonth]);

    const getOccurrencesWindowLabel = () => {
        let startMonth = selectedMonth - 1;
        let startYear = selectedYear;
        if (startMonth <= 0) {
            startMonth += 12;
            startYear -= 1;
        }
        
        const formatZero = (n: number) => String(n).padStart(2, '0');
        return `26/${formatZero(startMonth)}/${startYear} a 25/${formatZero(selectedMonth)}/${selectedYear}`;
    };

    const getPaydayLabel = () => {
        let payMonth = selectedMonth + 1;
        let payYear = selectedYear;
        if (payMonth > 12) {
            payMonth = 1;
            payYear += 1;
        }
        const monthsList = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];
        return `5º Dia Útil de ${monthsList[payMonth - 1]} / ${payYear}`;
    };

    // Filters logic
    const filteredItems = items.filter(item => {
        const matchesSearch = 
            item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.employeeCpf.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''));
        
        const matchesCompany = selectedCompany === "all" || item.companyName === selectedCompany;
        const matchesClient = selectedClient === "all" || item.clientName === selectedClient;

        return matchesSearch && matchesCompany && matchesClient;
    });

    // Unique filter options computed dynamically
    const uniqueCompanies = Array.from(new Set(items.map(item => item.companyName || "Sem Empresa"))).sort();
    const uniqueClients = Array.from(new Set(items.map(item => item.clientName || "Interno"))).sort();

    // Grouping calculations
    const groupedByCompany = filteredItems.reduce((acc, item) => {
        const group = item.companyName;
        if (!acc[group]) {
            acc[group] = {
                name: group,
                count: 0,
                baseSalary: 0,
                insalubridade: 0,
                periculosidade: 0,
                gratificacao: 0,
                outrosAdicionais: 0,
                totalGrossSalary: 0,
                faltasCount: 0,
                atestadosCount: 0,
                dsrDeductionsCount: 0,
                faltaDeduction: 0,
                dsrDeduction: 0,
                vtPayrollDiscount: 0,
                vaPayrollDiscount: 0,
                totalDeductions: 0,
                netSalary: 0,
                items: []
            };
        }
        acc[group].count += 1;
        acc[group].baseSalary += item.baseSalary;
        acc[group].insalubridade += item.insalubridade;
        acc[group].periculosidade += item.periculosidade;
        acc[group].gratificacao += item.gratificacao;
        acc[group].outrosAdicionais += item.outrosAdicionais;
        acc[group].totalGrossSalary += item.totalGrossSalary;
        acc[group].faltasCount += item.faltasCount;
        acc[group].atestadosCount += item.atestadosCount;
        acc[group].dsrDeductionsCount += item.dsrDeductionsCount;
        acc[group].faltaDeduction += item.faltaDeduction;
        acc[group].dsrDeduction += item.dsrDeduction;
        acc[group].vtPayrollDiscount += item.vtPayrollDiscount;
        acc[group].vaPayrollDiscount += item.vaPayrollDiscount;
        acc[group].totalDeductions += item.totalDeductions;
        acc[group].netSalary += item.netSalary;
        acc[group].items.push(item);
        return acc;
    }, {} as Record<string, any>);

    const groupedByClient = filteredItems.reduce((acc, item) => {
        const group = item.clientName;
        if (!acc[group]) {
            acc[group] = {
                name: group,
                count: 0,
                baseSalary: 0,
                insalubridade: 0,
                periculosidade: 0,
                gratificacao: 0,
                outrosAdicionais: 0,
                totalGrossSalary: 0,
                faltasCount: 0,
                atestadosCount: 0,
                dsrDeductionsCount: 0,
                faltaDeduction: 0,
                dsrDeduction: 0,
                vtPayrollDiscount: 0,
                vaPayrollDiscount: 0,
                totalDeductions: 0,
                netSalary: 0,
                items: []
            };
        }
        acc[group].count += 1;
        acc[group].baseSalary += item.baseSalary;
        acc[group].insalubridade += item.insalubridade;
        acc[group].periculosidade += item.periculosidade;
        acc[group].gratificacao += item.gratificacao;
        acc[group].outrosAdicionais += item.outrosAdicionais;
        acc[group].totalGrossSalary += item.totalGrossSalary;
        acc[group].faltasCount += item.faltasCount;
        acc[group].atestadosCount += item.atestadosCount;
        acc[group].dsrDeductionsCount += item.dsrDeductionsCount;
        acc[group].faltaDeduction += item.faltaDeduction;
        acc[group].dsrDeduction += item.dsrDeduction;
        acc[group].vtPayrollDiscount += item.vtPayrollDiscount;
        acc[group].vaPayrollDiscount += item.vaPayrollDiscount;
        acc[group].totalDeductions += item.totalDeductions;
        acc[group].netSalary += item.netSalary;
        acc[group].items.push(item);
        return acc;
    }, {} as Record<string, any>);

    // Total metrics card values
    const totalActiveCount = filteredItems.length;
    const totalGrossSum = filteredItems.reduce((sum, item) => sum + item.totalGrossSalary, 0);
    const totalDeductionsSum = filteredItems.reduce((sum, item) => sum + item.totalDeductions, 0);
    const totalNetSum = filteredItems.reduce((sum, item) => sum + item.netSalary, 0);

    const toggleGroup = (groupName: string) => {
        setExpandedGroups(prev => 
            prev.includes(groupName) 
                ? prev.filter(g => g !== groupName) 
                : [...prev, groupName]
        );
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <div className="space-y-6">
            {/* Header com gradiente */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-6 shadow-xl border border-slate-800">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#1e293b,transparent)]" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className="bg-sky-500/10 p-2 rounded-xl border border-sky-400/20 text-sky-400">
                                <Calculator className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Financeiro & DP</span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tight">Prévia de Folha de Pagamento</h1>
                        <p className="text-xs text-slate-400 font-semibold mt-1">
                            Competência de Apuração: <span className="text-white underline decoration-sky-400 font-bold">{getOccurrencesWindowLabel()}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                            Previsão de Pagamento: <span className="text-slate-300 font-bold">{getPaydayLabel()}</span>
                        </p>
                    </div>

                    {/* Ano / Mês Selector */}
                    <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-2xl border border-slate-700/60 w-fit backdrop-blur-sm self-start md:self-center">
                        <Calendar className="w-4 h-4 text-sky-400 ml-1.5" />
                        <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
                            <SelectTrigger className="h-8 border-none bg-transparent hover:bg-slate-700 text-white font-bold text-xs rounded-xl w-[100px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                                <SelectItem value="1">Janeiro</SelectItem>
                                <SelectItem value="2">Fevereiro</SelectItem>
                                <SelectItem value="3">Março</SelectItem>
                                <SelectItem value="4">Abril</SelectItem>
                                <SelectItem value="5">Maio</SelectItem>
                                <SelectItem value="6">Junho</SelectItem>
                                <SelectItem value="7">Julho</SelectItem>
                                <SelectItem value="8">Agosto</SelectItem>
                                <SelectItem value="9">Setembro</SelectItem>
                                <SelectItem value="10">Outubro</SelectItem>
                                <SelectItem value="11">Novembro</SelectItem>
                                <SelectItem value="12">Dezembro</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                            <SelectTrigger className="h-8 border-none bg-transparent hover:bg-slate-700 text-white font-bold text-xs rounded-xl w-[80px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                                <SelectItem value="2025">2025</SelectItem>
                                <SelectItem value="2026">2026</SelectItem>
                                <SelectItem value="2027">2027</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Colaboradores */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Colaboradores Calculados</span>
                        <h3 className="text-2xl font-black text-slate-800">{totalActiveCount}</h3>
                        <span className="text-[9px] font-bold text-slate-400 block mt-1">Status Ativos e Alocados</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-slate-500">
                        <User className="w-5 h-5" />
                    </div>
                </div>

                {/* Salário Bruto */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Total Proventos Brutos</span>
                        <h3 className="text-2xl font-black text-slate-800">{formatCurrency(totalGrossSum)}</h3>
                        <div className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 mt-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>Salários + Adicionais</span>
                        </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl text-emerald-600">
                        <DollarSign className="w-5 h-5" />
                    </div>
                </div>

                {/* Total Descontos */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Total Descontos Folha</span>
                        <h3 className="text-2xl font-black text-red-600">{formatCurrency(totalDeductionsSum)}</h3>
                        <div className="flex items-center gap-0.5 text-[9px] font-bold text-red-500 mt-1">
                            <TrendingDown className="w-3 h-3" />
                            <span>Faltas + DSR + VT + VA</span>
                        </div>
                    </div>
                    <div className="bg-red-50 border border-red-100 p-3 rounded-2xl text-red-500">
                        <TrendingDown className="w-5 h-5" />
                    </div>
                </div>

                {/* Salário Líquido */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Folha Líquida Estimada</span>
                        <h3 className="text-2xl font-black text-sky-600">{formatCurrency(totalNetSum)}</h3>
                        <div className="flex items-center gap-0.5 text-[9px] font-bold text-sky-500 mt-1">
                            <Info className="w-3 h-3" />
                            <span>Previsão de Desembolso</span>
                        </div>
                    </div>
                    <div className="bg-sky-50 border border-sky-100 p-3 rounded-2xl text-sky-600">
                        <Calculator className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Painel de Filtros e Busca */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3 items-end">
                    {/* Pesquisa por nome */}
                    <div className="flex flex-col gap-1.5 w-full col-span-1 md:col-span-2 lg:col-span-2">
                        <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">Pesquisar Colaborador</Label>
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                            <Input 
                                placeholder="Buscar por nome ou CPF..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 text-xs h-9 rounded-xl bg-slate-50 border-slate-200"
                            />
                        </div>
                    </div>

                    {/* Filtro Empresa */}
                    <div className="flex flex-col gap-1.5 w-full col-span-1">
                        <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">Filtrar por Empresa</Label>
                        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                            <SelectTrigger className="w-full h-9 text-xs font-bold rounded-xl border-slate-200 bg-slate-50">
                                <SelectValue placeholder="Todas as Empresas" />
                            </SelectTrigger>
                            <SelectContent className="text-xs">
                                <SelectItem value="all">Todas as Empresas</SelectItem>
                                {uniqueCompanies.map(c => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Filtro Cliente */}
                    <div className="flex flex-col gap-1.5 w-full col-span-1">
                        <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">Filtrar por Contrato</Label>
                        <Select value={selectedClient} onValueChange={setSelectedClient}>
                            <SelectTrigger className="w-full h-9 text-xs font-bold rounded-xl border-slate-200 bg-slate-50">
                                <SelectValue placeholder="Todos os Contratos" />
                            </SelectTrigger>
                            <SelectContent className="text-xs">
                                <SelectItem value="all">Todos os Contratos</SelectItem>
                                {uniqueClients.map(c => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Agrupamento */}
                    <div className="flex flex-col gap-1.5 w-full col-span-1">
                        <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">Modo de Agrupamento</Label>
                        <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                            <button
                                onClick={() => setGroupedView("colaborador")}
                                className={`flex-1 text-center py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${groupedView === "colaborador" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                Colab.
                            </button>
                            <button
                                onClick={() => setGroupedView("empresa")}
                                className={`flex-1 text-center py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${groupedView === "empresa" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                Empresa
                            </button>
                            <button
                                onClick={() => setGroupedView("contrato")}
                                className={`flex-1 text-center py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${groupedView === "contrato" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                Contrato
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Listagem de Dados */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-8 h-8 rounded-full border-4 border-slate-100 border-t-sky-500 animate-spin" />
                        <span className="text-xs text-slate-400 font-bold">Processando premissas de folha de pagamento...</span>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <AlertCircle className="w-8 h-8 text-slate-300" />
                        <span className="text-xs text-slate-400 font-bold">Nenhum registro encontrado com os filtros atuais.</span>
                    </div>
                ) : groupedView === "colaborador" ? (
                    /* LISTAGEM POR COLABORADOR */
                    <div className="overflow-auto max-h-[calc(100vh-280px)] border border-slate-200/60 rounded-3xl relative">
                        <table className="text-left border-collapse" style={{ minWidth: "2100px", tableLayout: "fixed" }}>
                            <colgroup>
                                <col style={{ width: "280px" }} /> {/* Colaborador */}
                                <col style={{ width: "220px" }} /> {/* Empresa / Posto */}
                                <col style={{ width: "130px" }} /> {/* Salário Base */}
                                <col style={{ width: "130px" }} /> {/* Insalubridade */}
                                <col style={{ width: "130px" }} /> {/* Periculosidade */}
                                <col style={{ width: "140px" }} /> {/* Outros Adicionais */}
                                <col style={{ width: "150px" }} /> {/* Proventos Brutos */}
                                <col style={{ width: "100px" }} /> {/* Faltas */}
                                <col style={{ width: "100px" }} /> {/* Atestados */}
                                <col style={{ width: "100px" }} /> {/* DSR */}
                                <col style={{ width: "140px" }} /> {/* Desc. Faltas */}
                                <col style={{ width: "140px" }} /> {/* Desc. DSR */}
                                <col style={{ width: "130px" }} /> {/* Desc. VT */}
                                <col style={{ width: "130px" }} /> {/* Desc. VA */}
                                <col style={{ width: "160px" }} /> {/* Líquido Final */}
                            </colgroup>
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    <th className="py-3 px-4 sticky left-0 z-20" style={{ position: "sticky", top: 0, left: 0, backgroundColor: "#f8fafc", zIndex: 30 }}>Colaborador / CPF / Função</th>
                                    <th className="py-3 px-4" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Empresa / Posto</th>
                                    <th className="py-3 px-4 text-right" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Salário Base</th>
                                    <th className="py-3 px-4 text-right" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Insalubridade</th>
                                    <th className="py-3 px-4 text-right" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Periculosidade</th>
                                    <th className="py-3 px-4 text-right" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Outros Adicionais</th>
                                    <th className="py-3 px-4 text-right bg-slate-100/50" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Proventos Brutos</th>
                                    <th className="py-3 px-4 text-center" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Faltas</th>
                                    <th className="py-3 px-4 text-center" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Atestados</th>
                                    <th className="py-3 px-4 text-center" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>DSR</th>
                                    <th className="py-3 px-4 text-right text-red-500 bg-red-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Desc. Faltas</th>
                                    <th className="py-3 px-4 text-right text-red-500 bg-red-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Desc. DSR</th>
                                    <th className="py-3 px-4 text-right text-orange-500 bg-orange-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Desc. VT</th>
                                    <th className="py-3 px-4 text-right text-orange-500 bg-orange-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Desc. VA</th>
                                    <th className="py-3 px-4 text-right font-bold text-sky-900 sticky right-0 z-20 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)]" style={{ position: "sticky", top: 0, right: 0, backgroundColor: "#f1f5f9", zIndex: 30 }}>Líquido Final</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-650">
                                {filteredItems.map(item => (
                                    <tr key={item.employeeId} className="hover:bg-slate-50/60 transition-colors group">
                                        {/* Colaborador */}
                                        <td className="py-3 px-4 sticky left-0 z-10 whitespace-nowrap" style={{ position: "sticky", left: 0, backgroundColor: "#ffffff", zIndex: 10 }}>
                                            <div>
                                                <div className="font-bold text-slate-900 text-[13px]">{item.employeeName}</div>
                                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">CPF: {item.employeeCpf} | {item.postoName}</div>
                                            </div>
                                        </td>
                                        {/* Empresa */}
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-slate-800 text-[11px] font-bold">{item.companyName}</div>
                                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">{item.clientName}</div>
                                            </div>
                                        </td>
                                        {/* Salário Base */}
                                        <td className="py-3 px-4 text-right font-medium text-slate-800 whitespace-nowrap">
                                            {formatCurrency(item.baseSalary)}
                                        </td>
                                        {/* Insalubridade */}
                                        <td className="py-3 px-4 text-right font-medium text-slate-850 whitespace-nowrap">
                                            {item.insalubridade > 0 ? formatCurrency(item.insalubridade) : "-"}
                                        </td>
                                        {/* Periculosidade */}
                                        <td className="py-3 px-4 text-right font-medium text-slate-850 whitespace-nowrap">
                                            {item.periculosidade > 0 ? formatCurrency(item.periculosidade) : "-"}
                                        </td>
                                        {/* Outros Adicionais */}
                                        <td className="py-3 px-4 text-right font-medium text-slate-850 whitespace-nowrap">
                                            {item.gratificacao + item.outrosAdicionais > 0 ? formatCurrency(item.gratificacao + item.outrosAdicionais) : "-"}
                                        </td>
                                        {/* Provento Bruto */}
                                        <td className="py-3 px-4 text-right bg-slate-100/30 whitespace-nowrap">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <button className="font-bold text-slate-800 hover:text-slate-950 underline decoration-dashed cursor-pointer">
                                                        {formatCurrency(item.totalGrossSalary)}
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 p-3 text-xs space-y-2.5">
                                                    <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Composição do Salário Bruto</div>
                                                    
                                                    {item.isAdmittedThisMonth && (
                                                        <div className="bg-sky-50 p-2.5 rounded-xl border border-sky-100 text-[10px] space-y-1 text-sky-850 font-medium">
                                                            <div className="font-black text-sky-950 flex items-center gap-1">
                                                                <Info className="w-3.5 h-3.5 text-sky-500" />
                                                                <span>Admissão Proporcional (Pró-rata)</span>
                                                            </div>
                                                            <div className="flex justify-between"><span>Data de Admissão:</span><span className="font-bold">{item.admissionDate}</span></div>
                                                            <div className="flex justify-between"><span>Dias Proporcionais:</span><span className="font-bold">{item.daysWorked} de {item.totalDaysInMonth} dias</span></div>
                                                            <div className="flex justify-between"><span>Salário Base Cheio:</span><span className="font-bold">{formatCurrency(item.originalSalary)}</span></div>
                                                            <div className="flex justify-between"><span>Valor Diário:</span><span className="font-bold">{formatCurrency(Math.round((item.originalSalary / item.totalDaysInMonth) * 100) / 100)}/dia</span></div>
                                                        </div>
                                                    )}

                                                    <div className="space-y-1 text-[10px] text-slate-650 font-medium">
                                                        <div className="flex justify-between"><span>Salário Base Pago:</span><span className="font-bold text-slate-800">{formatCurrency(item.baseSalary)}</span></div>
                                                        {item.insalubridade > 0 && <div className="flex justify-between"><span>Insalubridade:</span><span className="font-bold text-slate-800">{formatCurrency(item.insalubridade)}</span></div>}
                                                        {item.periculosidade > 0 && <div className="flex justify-between"><span>Periculosidade:</span><span className="font-bold text-slate-800">{formatCurrency(item.periculosidade)}</span></div>}
                                                        {item.gratificacao > 0 && <div className="flex justify-between"><span>Gratificação CCT:</span><span className="font-bold text-slate-800">{formatCurrency(item.gratificacao)}</span></div>}
                                                        {item.outrosAdicionais > 0 && <div className="flex justify-between"><span>Outros Adicionais:</span><span className="font-bold text-slate-800">{formatCurrency(item.outrosAdicionais)}</span></div>}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </td>
                                        {/* Faltas */}
                                        <td className="py-3 px-4 text-center whitespace-nowrap">
                                            {item.faltasCount > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="bg-red-50 hover:bg-red-100 text-red-650 font-bold px-2 py-0.5 rounded-lg border border-red-200/50 cursor-pointer text-xs">
                                                            {item.faltasCount} {item.faltasCount === 1 ? 'falta' : 'faltas'}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-72 p-3 text-xs space-y-2">
                                                        <div className="font-bold text-slate-900 border-b pb-1 text-[11px] flex justify-between">
                                                            <span>Rubrica: Desconto Faltas</span>
                                                            <span className="text-red-600">-{formatCurrency(item.faltaDeduction)}</span>
                                                        </div>
                                                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                                            {item.occurrencesList.filter(occ => occ.rawType === "FALTA" || occ.rawType === "FALTA_INJUSTIFICADA").map(occ => (
                                                                <div key={occ.id} className="p-1.5 rounded-lg border border-slate-100 bg-slate-50 text-[10px] space-y-0.5">
                                                                    <div className="flex justify-between font-bold text-slate-800">
                                                                        <span>{occ.date}</span>
                                                                        <span className="text-red-500">{occ.type}</span>
                                                                    </div>
                                                                    {occ.notes && <p className="text-slate-400 italic text-[9px] leading-tight">Nota: {occ.notes}</p>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="text-[9px] text-slate-500 italic pt-1 border-t leading-normal">
                                                            Fórmula CLT: (Salário Base + Adicionais Fixos) / 30 por falta injustificada.
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <span className="text-slate-350 text-xs">-</span>
                                            )}
                                        </td>
                                        {/* Atestados */}
                                        <td className="py-3 px-4 text-center whitespace-nowrap">
                                            {item.atestadosCount > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="bg-emerald-50 hover:bg-emerald-100 text-emerald-650 font-bold px-2 py-0.5 rounded-lg border border-emerald-200/50 cursor-pointer text-xs">
                                                            {item.atestadosCount} {item.atestadosCount === 1 ? 'atestado' : 'atestados'}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-72 p-3 text-xs space-y-2">
                                                        <div className="font-bold text-slate-900 border-b pb-1 text-[11px] flex justify-between">
                                                            <span>Atestados Médicos (Abonados)</span>
                                                            <span className="text-emerald-600">Abonado</span>
                                                        </div>
                                                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                                            {item.occurrencesList.filter(occ => occ.rawType === "ATESTADO").map(occ => (
                                                                <div key={occ.id} className="p-1.5 rounded-lg border border-slate-100 bg-slate-50 text-[10px] space-y-0.5">
                                                                    <div className="flex justify-between font-bold text-slate-800">
                                                                        <span>{occ.date}</span>
                                                                        <span className="text-emerald-500">{occ.type}</span>
                                                                    </div>
                                                                    {occ.notes && <p className="text-slate-400 italic text-[9px] leading-tight">Nota: {occ.notes}</p>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="text-[9px] text-slate-500 italic pt-1 border-t leading-normal">
                                                            Atestados médicos justificam e abonam a falta, mantendo a remuneração integral do dia.
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <span className="text-slate-350 text-xs">-</span>
                                            )}
                                        </td>
                                        {/* DSR */}
                                        <td className="py-3 px-4 text-center whitespace-nowrap">
                                            {item.dsrDeductionsCount > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="bg-red-50 hover:bg-red-100 text-red-650 font-bold px-2 py-0.5 rounded-lg border border-red-200/50 cursor-pointer text-xs">
                                                            {item.dsrDeductionsCount} {item.dsrDeductionsCount === 1 ? 'dia' : 'dias'}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-72 p-3 text-xs space-y-2">
                                                        <div className="font-bold text-slate-900 border-b pb-1 text-[11px] flex justify-between">
                                                            <span>Perda de DSR (CLT)</span>
                                                            <span className="text-red-600">-{formatCurrency(item.dsrDeduction)}</span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-650 leading-normal font-medium">
                                                            Pela Lei nº 605/49, a falta injustificada na semana retira do colaborador o direito de receber pelo descanso semanal remunerado daquela semana.
                                                        </p>
                                                        <div className="text-[9px] text-slate-500 italic pt-1 border-t leading-normal">
                                                            Fórmula CLT: (Salário Base + Adicionais Fixos) / 30 por semana com falta.
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <span className="text-slate-350 text-xs">-</span>
                                            )}
                                        </td>
                                        {/* Desconto Faltas */}
                                        <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/10 whitespace-nowrap">
                                            {item.faltaDeduction > 0 ? `-${formatCurrency(item.faltaDeduction)}` : "-"}
                                        </td>
                                        {/* Desconto DSR */}
                                        <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/10 whitespace-nowrap">
                                            {item.dsrDeduction > 0 ? `-${formatCurrency(item.dsrDeduction)}` : "-"}
                                        </td>
                                        {/* Desconto VT */}
                                        <td className="py-3 px-4 text-right text-orange-600 bg-orange-50/5 whitespace-nowrap">
                                            {item.vtPayrollDiscount > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="underline decoration-dashed cursor-pointer font-bold">
                                                            -{formatCurrency(item.vtPayrollDiscount)}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-60 p-3 text-xs space-y-1.5">
                                                        <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Desconto VT em Folha</div>
                                                        <div className="space-y-1 text-[10px] text-slate-650 font-medium">
                                                            <div className="flex justify-between"><span>Salário Base:</span><span>{formatCurrency(item.baseSalary)}</span></div>
                                                            <div className="flex justify-between"><span>Alíquota CCT:</span><span>{item.vtDiscountPercentage}%</span></div>
                                                            <div className="flex justify-between text-orange-600 border-t border-slate-100 pt-1 font-bold">
                                                                <span>Desconto Calculado:</span>
                                                                <span>{formatCurrency(item.vtPayrollDiscount)}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-[9px] text-slate-450 italic leading-normal border-t pt-1">
                                                            Nota: O desconto é limitado ao teto do valor do VT creditado para compra no mês.
                                                        </p>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <span className="text-slate-350">-</span>
                                            )}
                                        </td>
                                        {/* Desconto VA */}
                                        <td className="py-3 px-4 text-right text-orange-600 bg-orange-50/5 whitespace-nowrap">
                                            {item.vaPayrollDiscount > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="underline decoration-dashed cursor-pointer font-bold">
                                                            -{formatCurrency(item.vaPayrollDiscount)}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-60 p-3 text-xs space-y-1.5">
                                                        <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Desconto VA em Folha</div>
                                                        <div className="space-y-1 text-[10px] text-slate-650 font-medium">
                                                            <div className="flex justify-between"><span>Alíquota Desconto:</span><span>{item.vaDiscountPercentage}%</span></div>
                                                            <div className="flex justify-between text-orange-600 border-t border-slate-100 pt-1 font-bold">
                                                                <span>Desconto Calculado:</span>
                                                                <span>{formatCurrency(item.vaPayrollDiscount)}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-[9px] text-slate-450 italic leading-normal border-t pt-1">
                                                            Nota: Percentual sobre o VA base (descontado em folha do colaborador).
                                                        </p>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <span className="text-slate-350">-</span>
                                            )}
                                        </td>
                                        {/* Salário Líquido */}
                                        <td className="py-3 px-4 text-right font-black text-[13px] text-sky-700 sticky right-0 z-10 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)] whitespace-nowrap" style={{ position: "sticky", right: 0, backgroundColor: "#f0f9ff", zIndex: 10 }}>
                                            {formatCurrency(item.netSalary)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* VISÕES AGRUPADAS (EMPRESA OU CONTRATO) */
                    <div className="overflow-auto max-h-[calc(100vh-280px)] border border-slate-200/60 rounded-3xl relative">
                        <table className="text-left border-collapse" style={{ minWidth: "1400px", tableLayout: "fixed" }}>
                            <colgroup>
                                <col style={{ width: "60px" }} /> {/* Toggle button */}
                                <col style={{ width: "350px" }} /> {/* Group Name */}
                                <col style={{ width: "120px" }} /> {/* Qtd Ativos */}
                                <col style={{ width: "160px" }} /> {/* Proventos Brutos */}
                                <col style={{ width: "160px" }} /> {/* Total Desc. Faltas */}
                                <col style={{ width: "160px" }} /> {/* Total Desc. DSR */}
                                <col style={{ width: "130px" }} /> {/* Total Desc. VT */}
                                <col style={{ width: "130px" }} /> {/* Total Desc. VA */}
                                <col style={{ width: "170px" }} /> {/* Líquido Consolidado */}
                            </colgroup>
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    <th className="py-3 px-4 w-6" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}></th>
                                    <th className="py-3 px-4" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>{groupedView === "empresa" ? "Empresa" : "Contrato / Cliente"}</th>
                                    <th className="py-3 px-4 text-center" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Qtd Ativos</th>
                                    <th className="py-3 px-4 text-right" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Proventos Brutos</th>
                                    <th className="py-3 px-4 text-right text-red-500 bg-red-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Total Desc. Faltas</th>
                                    <th className="py-3 px-4 text-right text-red-500 bg-red-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Total Desc. DSR</th>
                                    <th className="py-3 px-4 text-right text-orange-500 bg-orange-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Total Desc. VT</th>
                                    <th className="py-3 px-4 text-right text-orange-500 bg-orange-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Total Desc. VA</th>
                                    <th className="py-3 px-4 text-right font-bold text-sky-900 sticky right-0 z-20 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)]" style={{ position: "sticky", top: 0, right: 0, backgroundColor: "#f1f5f9", zIndex: 30 }}>Líquido Consolidado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-650">
                                {Object.values(groupedView === "empresa" ? groupedByCompany : groupedByClient).map((group: any) => {
                                    const isExpanded = expandedGroups.includes(group.name);
                                    return (
                                        <>
                                            <tr key={group.name} className="hover:bg-slate-50 bg-slate-50/10 font-bold text-slate-800">
                                                {/* Botão de expansão */}
                                                <td className="py-3 px-4 text-center">
                                                    <button 
                                                        onClick={() => toggleGroup(group.name)}
                                                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
                                                    >
                                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                                {/* Nome do grupo */}
                                                <td className="py-3 px-4 font-black text-[13px] text-slate-900 whitespace-nowrap">
                                                    {group.name}
                                                </td>
                                                {/* Quantidade */}
                                                <td className="py-3 px-4 text-center whitespace-nowrap">
                                                    <span className="bg-slate-150 px-2 py-0.5 rounded-lg border border-slate-200/50">
                                                        {group.count}
                                                    </span>
                                                </td>
                                                {/* Proventos Brutos */}
                                                <td className="py-3 px-4 text-right font-black whitespace-nowrap">
                                                    {formatCurrency(group.totalGrossSalary)}
                                                </td>
                                                {/* Desconto Faltas */}
                                                <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/10 whitespace-nowrap">
                                                    {group.faltaDeduction > 0 ? `-${formatCurrency(group.faltaDeduction)}` : "-"}
                                                </td>
                                                {/* Desconto DSR */}
                                                <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/10 whitespace-nowrap">
                                                    {group.dsrDeduction > 0 ? `-${formatCurrency(group.dsrDeduction)}` : "-"}
                                                </td>
                                                {/* Desconto VT */}
                                                <td className="py-3 px-4 text-right text-orange-600 font-bold bg-orange-50/5 whitespace-nowrap">
                                                    {group.vtPayrollDiscount > 0 ? `-${formatCurrency(group.vtPayrollDiscount)}` : "-"}
                                                </td>
                                                {/* Desconto VA */}
                                                <td className="py-3 px-4 text-right text-orange-600 font-bold bg-orange-50/5 whitespace-nowrap">
                                                    {group.vaPayrollDiscount > 0 ? `-${formatCurrency(group.vaPayrollDiscount)}` : "-"}
                                                </td>
                                                {/* Líquido */}
                                                <td className="py-3 px-4 text-right font-black text-sky-700 text-[13px] sticky right-0 z-10 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)] whitespace-nowrap" style={{ position: "sticky", right: 0, backgroundColor: "#f0f9ff", zIndex: 10 }}>
                                                    {formatCurrency(group.netSalary)}
                                                </td>
                                            </tr>

                                            {/* Expandível individual do grupo */}
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={9} className="p-0 bg-slate-50/30">
                                                        <div className="overflow-hidden border-t border-b border-slate-100 pl-12 pr-4 py-3">
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">Detalhamento dos Colaboradores</span>
                                                            <div className="overflow-x-auto">
                                                                <table className="text-left border-collapse bg-white rounded-2xl border border-slate-200/60 overflow-hidden text-[11px]" style={{ minWidth: "1900px", tableLayout: "fixed" }}>
                                                                    <colgroup>
                                                                        <col style={{ width: "260px" }} /> {/* Colaborador */}
                                                                        <col style={{ width: "120px" }} /> {/* Salário Base */}
                                                                        <col style={{ width: "120px" }} /> {/* Insalubridade */}
                                                                        <col style={{ width: "120px" }} /> {/* Periculosidade */}
                                                                        <col style={{ width: "130px" }} /> {/* Outros Adicionais */}
                                                                        <col style={{ width: "140px" }} /> {/* Provento Bruto */}
                                                                        <col style={{ width: "90px" }} /> {/* Faltas */}
                                                                        <col style={{ width: "90px" }} /> {/* Atestados */}
                                                                        <col style={{ width: "90px" }} /> {/* DSR */}
                                                                        <col style={{ width: "130px" }} /> {/* Desc. Faltas */}
                                                                        <col style={{ width: "130px" }} /> {/* Desc. DSR */}
                                                                        <col style={{ width: "120px" }} /> {/* Desc. VT */}
                                                                        <col style={{ width: "120px" }} /> {/* Desc. VA */}
                                                                        <col style={{ width: "140px" }} /> {/* Líquido Final */}
                                                                    </colgroup>
                                                                    <thead>
                                                                        <tr className="border-b border-slate-100 bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                                                            <th className="py-2.5 px-3">Colaborador / CPF / Função</th>
                                                                            <th className="py-2.5 px-3 text-right">Salário Base</th>
                                                                            <th className="py-2.5 px-3 text-right">Insalubridade</th>
                                                                            <th className="py-2.5 px-3 text-right">Periculosidade</th>
                                                                            <th className="py-2.5 px-3 text-right">Outros Adicionais</th>
                                                                            <th className="py-2.5 px-3 text-right bg-slate-100/50">Provento Bruto</th>
                                                                            <th className="py-2.5 px-3 text-center">Faltas</th>
                                                                            <th className="py-2.5 px-3 text-center">Atestados</th>
                                                                            <th className="py-2.5 px-3 text-center">DSR</th>
                                                                            <th className="py-2.5 px-3 text-right text-red-500 bg-red-50/10">Desc. Faltas</th>
                                                                            <th className="py-2.5 px-3 text-right text-red-500 bg-red-50/10">Desc. DSR</th>
                                                                            <th className="py-2.5 px-3 text-right text-orange-650 bg-orange-50/5">Desc. VT</th>
                                                                            <th className="py-2.5 px-3 text-right text-orange-655 bg-orange-50/5">Desc. VA</th>
                                                                            <th className="py-2.5 px-3 text-right font-bold text-sky-900 sticky right-0 z-20 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)]" style={{ position: "sticky", right: 0, backgroundColor: "#f1f5f9", zIndex: 20 }}>Líquido Final</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-650">
                                                                        {group.items.map((sub: PayrollPreviewItem) => (
                                                                            <tr key={sub.employeeId} className="hover:bg-slate-50/80 transition-colors">
                                                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                                                    <div>
                                                                                        <div className="font-bold text-slate-850">{sub.employeeName}</div>
                                                                                        <div className="text-[9px] text-slate-400 font-medium">CPF: {sub.employeeCpf} | {sub.postoName}</div>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                                                                                    {formatCurrency(sub.baseSalary)}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                                                                                    {sub.insalubridade > 0 ? formatCurrency(sub.insalubridade) : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                                                                                    {sub.periculosidade > 0 ? formatCurrency(sub.periculosidade) : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                                                                                    {sub.gratificacao + sub.outrosAdicionais > 0 ? formatCurrency(sub.gratificacao + sub.outrosAdicionais) : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right bg-slate-100/30 whitespace-nowrap">
                                                                                    <Popover>
                                                                                        <PopoverTrigger asChild>
                                                                                            <button className="font-bold text-slate-700 hover:text-slate-850 underline decoration-dashed cursor-pointer">
                                                                                                {formatCurrency(sub.totalGrossSalary)}
                                                                                            </button>
                                                                                        </PopoverTrigger>
                                                                                        <PopoverContent className="w-64 p-3 text-xs space-y-2.5">
                                                                                            <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Composição do Salário Bruto</div>
                                                                                            
                                                                                            {sub.isAdmittedThisMonth && (
                                                                                                <div className="bg-sky-50 p-2.5 rounded-xl border border-sky-100 text-[10px] space-y-1 text-sky-850 font-medium">
                                                                                                    <div className="font-black text-sky-950 flex items-center gap-1">
                                                                                                        <Info className="w-3.5 h-3.5 text-sky-500" />
                                                                                                        <span>Admissão Proporcional (Pró-rata)</span>
                                                                                                    </div>
                                                                                                    <div className="flex justify-between"><span>Data de Admissão:</span><span className="font-bold">{sub.admissionDate}</span></div>
                                                                                                    <div className="flex justify-between"><span>Dias Proporcionais:</span><span className="font-bold">{sub.daysWorked} de {sub.totalDaysInMonth} dias</span></div>
                                                                                                    <div className="flex justify-between"><span>Salário Base Cheio:</span><span className="font-bold">{formatCurrency(sub.originalSalary)}</span></div>
                                                                                                    <div className="flex justify-between"><span>Valor Diário:</span><span className="font-bold">{formatCurrency(Math.round((sub.originalSalary / sub.totalDaysInMonth) * 100) / 100)}/dia</span></div>
                                                                                                </div>
                                                                                            )}

                                                                                            <div className="space-y-1 text-[10px] text-slate-655 font-medium">
                                                                                                <div className="flex justify-between"><span>Salário Base Pago:</span><span className="font-bold text-slate-800">{formatCurrency(sub.baseSalary)}</span></div>
                                                                                                {sub.insalubridade > 0 && <div className="flex justify-between"><span>Insalubridade:</span><span className="font-bold text-slate-800">{formatCurrency(sub.insalubridade)}</span></div>}
                                                                                                {sub.periculosidade > 0 && <div className="flex justify-between"><span>Periculosidade:</span><span className="font-bold text-slate-800">{formatCurrency(sub.periculosidade)}</span></div>}
                                                                                                {sub.gratificacao > 0 && <div className="flex justify-between"><span>Gratificação CCT:</span><span className="font-bold text-slate-800">{formatCurrency(sub.gratificacao)}</span></div>}
                                                                                                {sub.outrosAdicionais > 0 && <div className="flex justify-between"><span>Outros Adicionais:</span><span className="font-bold text-slate-800">{formatCurrency(sub.outrosAdicionais)}</span></div>}
                                                                                            </div>
                                                                                        </PopoverContent>
                                                                                    </Popover>
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                                    {sub.faltasCount > 0 ? (
                                                                                        <Popover>
                                                                                            <PopoverTrigger asChild>
                                                                                                <button className="bg-red-50 hover:bg-red-100 text-red-655 font-bold px-1.5 py-0.5 rounded text-[10px] border border-red-200/50 cursor-pointer">
                                                                                                    {sub.faltasCount} {sub.faltasCount === 1 ? 'falta' : 'faltas'}
                                                                                                </button>
                                                                                            </PopoverTrigger>
                                                                                            <PopoverContent className="w-72 p-3 text-xs space-y-2">
                                                                                                <div className="font-bold text-slate-900 border-b pb-1 text-[11px] flex justify-between">
                                                                                                    <span>Desconto Faltas</span>
                                                                                                    <span className="text-red-500">-{formatCurrency(sub.faltaDeduction)}</span>
                                                                                                </div>
                                                                                                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                                                                                    {sub.occurrencesList.filter(o => o.rawType === "FALTA" || o.rawType === "FALTA_INJUSTIFICADA").map(occ => (
                                                                                                        <div key={occ.id} className="p-1 rounded bg-slate-50 border border-slate-100 text-[10px]">
                                                                                                            <div className="flex justify-between font-bold text-slate-800">
                                                                                                                <span>{occ.date}</span>
                                                                                                                <span className="text-red-500">{occ.type}</span>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            </PopoverContent>
                                                                                        </Popover>
                                                                                    ) : (
                                                                                        <span className="text-slate-355">-</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                                    {sub.atestadosCount > 0 ? (
                                                                                        <Popover>
                                                                                            <PopoverTrigger asChild>
                                                                                                <button className="bg-emerald-50 hover:bg-emerald-100 text-emerald-655 font-bold px-1.5 py-0.5 rounded text-[10px] border border-emerald-200/50 cursor-pointer">
                                                                                                    {sub.atestadosCount} {sub.atestadosCount === 1 ? 'atestado' : 'atestados'}
                                                                                                </button>
                                                                                            </PopoverTrigger>
                                                                                            <PopoverContent className="w-72 p-3 text-xs space-y-2">
                                                                                                <div className="font-bold text-slate-900 border-b pb-1 text-[11px] flex justify-between">
                                                                                                    <span>Atestados Médicos (Abonados)</span>
                                                                                                    <span className="text-emerald-500">Abonado</span>
                                                                                                </div>
                                                                                                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                                                                                    {sub.occurrencesList.filter(o => o.rawType === "ATESTADO").map(occ => (
                                                                                                        <div key={occ.id} className="p-1 rounded bg-slate-50 border border-slate-100 text-[10px]">
                                                                                                            <div className="flex justify-between font-bold text-slate-800">
                                                                                                                <span>{occ.date}</span>
                                                                                                                <span className="text-emerald-500">{occ.type}</span>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            </PopoverContent>
                                                                                        </Popover>
                                                                                    ) : (
                                                                                        <span className="text-slate-355">-</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                                    {sub.dsrDeductionsCount > 0 ? (
                                                                                        <Popover>
                                                                                            <PopoverTrigger asChild>
                                                                                                <button className="bg-red-50 hover:bg-red-100 text-red-655 font-bold px-1.5 py-0.5 rounded text-[10px] border border-red-200/50 cursor-pointer">
                                                                                                    {sub.dsrDeductionsCount} {sub.dsrDeductionsCount === 1 ? 'dia' : 'dias'}
                                                                                                </button>
                                                                                            </PopoverTrigger>
                                                                                            <PopoverContent className="w-72 p-3 text-xs space-y-2">
                                                                                                <div className="font-bold text-slate-900 border-b pb-1 text-[11px] flex justify-between">
                                                                                                    <span>Dedução de DSR</span>
                                                                                                    <span className="text-red-500">-{formatCurrency(sub.dsrDeduction)}</span>
                                                                                                </div>
                                                                                            </PopoverContent>
                                                                                        </Popover>
                                                                                    ) : (
                                                                                        <span className="text-slate-355">-</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right text-red-500 whitespace-nowrap">
                                                                                    {sub.faltaDeduction > 0 ? `-${formatCurrency(sub.faltaDeduction)}` : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right text-red-500 whitespace-nowrap">
                                                                                    {sub.dsrDeduction > 0 ? `-${formatCurrency(sub.dsrDeduction)}` : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right text-orange-600 whitespace-nowrap">
                                                                                    {sub.vtPayrollDiscount > 0 ? `-${formatCurrency(sub.vtPayrollDiscount)}` : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right text-orange-600 whitespace-nowrap">
                                                                                    {sub.vaPayrollDiscount > 0 ? `-${formatCurrency(sub.vaPayrollDiscount)}` : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right font-bold text-sky-900 sticky right-0 z-10 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)] whitespace-nowrap" style={{ position: "sticky", right: 0, backgroundColor: "#f0f9ff", zIndex: 10 }}>
                                                                                    {formatCurrency(sub.netSalary)}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
