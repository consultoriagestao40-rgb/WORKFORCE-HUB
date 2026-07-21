"use client";

import { useState, useEffect } from "react";
import { 
    DollarSign, 
    CreditCard, 
    Bus, 
    Utensils, 
    AlertCircle, 
    Download, 
    Settings, 
    Search, 
    Calendar, 
    CheckCircle2, 
    XCircle,
    UserCheck,
    Clock,
    RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getBenefitsCalculation, updateBenefitsConfig, BenefitsCalculationItem } from "@/actions/benefits";

export default function BenefitsPage() {
    const today = new Date();
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);

    const [isLoading, setIsLoading] = useState(true);
    const [items, setItems] = useState<BenefitsCalculationItem[]>([]);
    const [config, setConfig] = useState<any>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterOption, setFilterOption] = useState<"ALL" | "VT_ONLY" | "VA_ONLY" | "NON_VT">("ALL");
    const [activeTab, setActiveTab] = useState<"BUY" | "ALERTS" | "CONFIG">("BUY");

    // Config Modal State
    const [configModalOpen, setConfigModalOpen] = useState(false);
    const [configFormData, setConfigFormData] = useState({
        payrollCutoffStartDay: 26,
        payrollCutoffEndDay: 25,
        payrollPaymentDay: 5,
        vtFractionDays: 5,
        vaFractionDays: 10,
        vaCardDeliveryEstimateDays: 10
    });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await getBenefitsCalculation(selectedYear, selectedMonth);
            setItems(res.items || []);
            setConfig(res.config);
            if (res.config) {
                setConfigFormData({
                    payrollCutoffStartDay: res.config.payrollCutoffStartDay,
                    payrollCutoffEndDay: res.config.payrollCutoffEndDay,
                    payrollPaymentDay: res.config.payrollPaymentDay,
                    vtFractionDays: res.config.vtFractionDays,
                    vaFractionDays: res.config.vaFractionDays,
                    vaCardDeliveryEstimateDays: res.config.vaCardDeliveryEstimateDays
                });
            }
        } catch (err: any) {
            toast.error("Erro ao carregar cálculos de benefícios.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedYear, selectedMonth]);

    const handleConfigSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await updateBenefitsConfig(configFormData);
            if (res.success) {
                toast.success("Configurações de benefícios salvas com sucesso!");
                setConfigModalOpen(false);
                loadData();
            }
        } catch (err: any) {
            toast.error(err.message || "Erro ao salvar configurações.");
        }
    };

    // Export CSV
    const exportToCSV = () => {
        if (items.length === 0) {
            toast.error("Nenhum dado disponível para exportar.");
            return;
        }

        const headers = [
            "Colaborador",
            "CPF",
            "Posto",
            "Cliente",
            "Data Admissão",
            "Optante VT",
            "VT R$/Dia",
            "VT Faltas/Abatimentos (26-25)",
            "VT Valor Total (R$)",
            "VT Destino Depósito",
            "VA Mensal Base (R$)",
            "VA Faltas/Abatimentos (26-25)",
            "VA Valor Total (R$)",
            "VA Destino Depósito",
            "Observações / Lote"
        ];

        const rows = filteredItems.map(item => [
            `"${item.employeeName}"`,
            `"${item.employeeCpf}"`,
            `"${item.postoName}"`,
            `"${item.clientName}"`,
            `"${item.admissionDate}"`,
            `"${item.vtOptIn ? 'Sim' : 'Não'}"`,
            item.vtDailyValue.toFixed(2),
            item.vtOccurrencesDeducted,
            item.vtTotalValue.toFixed(2),
            `"${item.vtDestination}"`,
            item.vaMonthlyValue.toFixed(2),
            item.vaOccurrencesDeducted,
            item.vaTotalValue.toFixed(2),
            `"${item.vaDestination}"`,
            `"${item.vtBatchNote || item.vaBatchNote || ''}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `compra_beneficios_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Planilha de benefícios baixada com sucesso!");
    };

    // Filter Items
    const filteredItems = items.filter(item => {
        const matchesSearch = 
            item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.employeeCpf.includes(searchTerm) ||
            item.postoName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.clientName.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        if (filterOption === "VT_ONLY") return item.vtOptIn && item.vtTotalValue > 0;
        if (filterOption === "VA_ONLY") return item.vaTotalValue > 0;
        if (filterOption === "NON_VT") return !item.vtOptIn;

        return true;
    });

    // Totals
    const totalVT = items.reduce((acc, curr) => acc + (curr.vtOptIn ? curr.vtTotalValue : 0), 0);
    const totalVA = items.reduce((acc, curr) => acc + curr.vaTotalValue, 0);
    const vtOptInCount = items.filter(i => i.vtOptIn).length;
    const alertCount = items.filter(i => i.vtNeedsAlert || i.vaNeedsAlert).length;
    const totalOccurrencesDeducted = items.reduce((acc, curr) => acc + curr.vtOccurrencesDeducted, 0);

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto min-h-screen">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-orange-500/10 text-orange-600 rounded-2xl">
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900">Compra de Benefícios (VT e VA)</h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Gestão mensal de compra de vales. Fechamento de faltas de {config?.payrollCutoffStartDay || 26} a {config?.payrollCutoffEndDay || 25}, pagamento no {config?.payrollPaymentDay || 5}º dia útil.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Month/Year Selector */}
                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                        <Select value={String(selectedMonth)} onValueChange={val => setSelectedMonth(Number(val))}>
                            <SelectTrigger className="w-[130px] h-9 text-xs font-bold border-none bg-transparent shadow-none">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {monthNames.map((m, idx) => (
                                    <SelectItem key={idx + 1} value={String(idx + 1)}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={String(selectedYear)} onValueChange={val => setSelectedYear(Number(val))}>
                            <SelectTrigger className="w-[90px] h-9 text-xs font-bold border-none bg-transparent shadow-none">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2025">2025</SelectItem>
                                <SelectItem value="2026">2026</SelectItem>
                                <SelectItem value="2027">2027</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button 
                        variant="outline" 
                        onClick={() => setConfigModalOpen(true)}
                        className="font-bold text-xs gap-2 rounded-2xl h-11 border-slate-200"
                    >
                        <Settings className="w-4 h-4 text-slate-600" /> Configurações
                    </Button>

                    <Button 
                        onClick={exportToCSV}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 rounded-2xl shadow-md h-11 px-5"
                    >
                        <Download className="w-4 h-4" /> Exportar Planilha (CSV)
                    </Button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {/* Total VT */}
                <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-3xl text-white shadow-md relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                        <Bus className="w-32 h-32" />
                    </div>
                    <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
                        <Bus className="w-4 h-4" /> Total Vale Transporte (VT)
                    </div>
                    <div className="text-3xl font-black">R$ {totalVT.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="text-[11px] text-indigo-200 mt-2 font-medium flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> {vtOptInCount} colaboradores optantes ({items.length - vtOptInCount} dispensados)
                    </div>
                </div>

                {/* Total VA */}
                <div className="bg-gradient-to-br from-orange-600 to-amber-600 p-6 rounded-3xl text-white shadow-md relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                        <Utensils className="w-32 h-32" />
                    </div>
                    <div className="flex items-center gap-2 text-orange-100 text-xs font-bold uppercase tracking-wider mb-2">
                        <Utensils className="w-4 h-4" /> Total Vale Alimentação (VA)
                    </div>
                    <div className="text-3xl font-black">R$ {totalVA.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="text-[11px] text-orange-100 mt-2 font-medium">
                        Mês de referência: {monthNames[selectedMonth - 1]} / {selectedYear}
                    </div>
                </div>

                {/* Faltas / Abatimentos */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        <AlertCircle className="w-4 h-4 text-red-500" /> Abatimentos Ocorrências
                    </div>
                    <div className="text-3xl font-black text-slate-800">{totalOccurrencesDeducted}</div>
                    <div className="text-[11px] text-slate-500 font-medium">
                        Faltas e atestados descontados na janela {config?.payrollCutoffStartDay || 26} a {config?.payrollCutoffEndDay || 25}.
                    </div>
                </div>

                {/* Alertas de Admissão Recente */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
                    <div className="flex items-center gap-2 text-amber-600 text-xs font-bold uppercase tracking-wider">
                        <Clock className="w-4 h-4 text-amber-500" /> Alertas de Admissão
                    </div>
                    <div className="text-3xl font-black text-amber-600">{alertCount}</div>
                    <div className="text-[11px] text-slate-500 font-medium">
                        Admissões com lotes fracionados (5d VT / 10d VA) no mês.
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 gap-6">
                <button
                    onClick={() => setActiveTab("BUY")}
                    className={`pb-3 text-sm font-bold tracking-tight transition-all relative ${
                        activeTab === "BUY" ? "text-orange-600 border-b-2 border-orange-500 font-black" : "text-slate-400 hover:text-slate-600"
                    }`}
                >
                    <CreditCard className="w-4 h-4 inline mr-2" /> Quadro de Compra ({filteredItems.length})
                </button>

                <button
                    onClick={() => setActiveTab("ALERTS")}
                    className={`pb-3 text-sm font-bold tracking-tight transition-all relative ${
                        activeTab === "ALERTS" ? "text-orange-600 border-b-2 border-orange-500 font-black" : "text-slate-400 hover:text-slate-600"
                    }`}
                >
                    <Clock className="w-4 h-4 inline mr-2" /> Alertas de Admissão ({alertCount})
                </button>
            </div>

            {/* TAB 1: QUADRO DE COMPRA */}
            {activeTab === "BUY" && (
                <div className="space-y-4">
                    {/* Filters & Search */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                        <div className="relative w-full md:w-96">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                            <Input
                                placeholder="Buscar por nome, CPF, posto ou cliente..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 text-xs rounded-xl bg-slate-50 border-slate-200"
                            />
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Filtrar por:</span>
                            <Select value={filterOption} onValueChange={(val: any) => setFilterOption(val)}>
                                <SelectTrigger className="w-[200px] h-9 text-xs font-bold rounded-xl border-slate-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Todos os Colaboradores</SelectItem>
                                    <SelectItem value="VT_ONLY">Apenas com VT &gt; R$0</SelectItem>
                                    <SelectItem value="VA_ONLY">Apenas com VA &gt; R$0</SelectItem>
                                    <SelectItem value="NON_VT">Não Optantes pelo VT</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                        <th className="py-4 px-4">Colaborador / CPF</th>
                                        <th className="py-4 px-4">Posto & Cliente</th>
                                        <th className="py-4 px-4">Optante VT?</th>
                                        <th className="py-4 px-4 text-center">Faltas (26-25)</th>
                                        <th className="py-4 px-4 text-right">VT a Comprar</th>
                                        <th className="py-4 px-4">Destino VT</th>
                                        <th className="py-4 px-4 text-right">VA a Comprar</th>
                                        <th className="py-4 px-4">Destino VA</th>
                                        <th className="py-4 px-4">Observação / Lote</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={9} className="text-center py-12 text-slate-400 font-medium">
                                                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
                                                Calculando benefícios do mês...
                                            </td>
                                        </tr>
                                    ) : filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="text-center py-12 text-slate-400 font-medium">
                                                Nenhum colaborador encontrado com os filtros aplicados.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredItems.map(item => (
                                            <tr key={item.employeeId} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-3.5 px-4 font-bold text-slate-900">
                                                    <div>{item.employeeName}</div>
                                                    <div className="text-[10px] font-mono text-slate-400">{item.employeeCpf}</div>
                                                </td>

                                                <td className="py-3.5 px-4">
                                                    <div className="font-semibold text-slate-800">{item.postoName}</div>
                                                    <div className="text-[10px] text-slate-400 font-medium">{item.clientName}</div>
                                                </td>

                                                <td className="py-3.5 px-4">
                                                    {item.vtOptIn ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                                            <CheckCircle2 className="w-3 h-3 mr-1" /> Sim (Optante)
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500">
                                                            <XCircle className="w-3 h-3 mr-1" /> Não Optante
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-4 text-center font-bold">
                                                    {item.vtOccurrencesDeducted > 0 ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700">
                                                            -{item.vtOccurrencesDeducted} dia(s)
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 font-medium">0</span>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-4 text-right font-black text-indigo-700">
                                                    {item.vtOptIn ? `R$ ${item.vtTotalValue.toFixed(2)}` : "R$ 0,00"}
                                                </td>

                                                <td className="py-3.5 px-4">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                                                        {item.vtDestination}
                                                    </span>
                                                </td>

                                                <td className="py-3.5 px-4 text-right font-black text-orange-600">
                                                    R$ {item.vaTotalValue.toFixed(2)}
                                                </td>

                                                <td className="py-3.5 px-4">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200/60">
                                                        {item.vaDestination}
                                                    </span>
                                                </td>

                                                <td className="py-3.5 px-4 text-[11px] text-slate-500 font-medium max-w-[200px]">
                                                    {item.vtNeedsAlert || item.vaNeedsAlert ? (
                                                        <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 inline-block">
                                                            ⚠️ {item.vtBatchNote || item.vaBatchNote}
                                                        </span>
                                                    ) : (
                                                        item.vtBatchNote || item.vaBatchNote || "-"
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: ALERTAS DE ADMISSÃO RECENTE */}
            {activeTab === "ALERTS" && (
                <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 p-5 rounded-3xl text-amber-900 space-y-1">
                        <h3 className="font-black text-sm flex items-center gap-2">
                            <Clock className="w-5 h-5 text-amber-600" /> Regra de Fracionamento de Admissões Recentes
                        </h3>
                        <p className="text-xs text-amber-700 font-medium">
                            Para novos colaboradores admitidos no mês corrente, o <strong>VT é liberado em lotes de {config?.vtFractionDays || 5} em {config?.vtFractionDays || 5} dias</strong> para evitar compras desnecessárias em caso de desligamento precoce. O <strong>VA é pago em lotes de {config?.vaFractionDays || 10} dias após {config?.vaCardDeliveryEstimateDays || 10} dias da chegada do cartão</strong>.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {items.filter(i => i.vtNeedsAlert || i.vaNeedsAlert).length === 0 ? (
                            <div className="col-span-2 bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400 font-medium">
                                Nenhum alerta de lote fracionado pendente para o mês selecionado.
                            </div>
                        ) : (
                            items.filter(i => i.vtNeedsAlert || i.vaNeedsAlert).map(item => (
                                <div key={item.employeeId} className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-slate-900 text-sm">{item.employeeName}</h4>
                                            <p className="text-xs text-slate-500 font-semibold">{item.postoName} ({item.clientName})</p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Admissão: {item.admissionDate}</p>
                                        </div>
                                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-black text-[10px] rounded-xl uppercase tracking-wider">
                                            Admissão Recente
                                        </span>
                                    </div>

                                    <div className="space-y-2 border-t border-slate-100 pt-3">
                                        {item.vtNeedsAlert && (
                                            <div className="flex justify-between items-center bg-indigo-50/60 p-2.5 rounded-2xl text-xs font-bold text-indigo-900 border border-indigo-100">
                                                <span className="flex items-center gap-1.5">
                                                    <Bus className="w-4 h-4 text-indigo-600" /> VT Lote {config?.vtFractionDays || 5} Dias:
                                                </span>
                                                <span className="font-black text-indigo-700">R$ {item.vtTotalValue.toFixed(2)} ({item.vtDestination})</span>
                                            </div>
                                        )}

                                        {item.vaNeedsAlert && (
                                            <div className="flex justify-between items-center bg-orange-50/60 p-2.5 rounded-2xl text-xs font-bold text-orange-900 border border-orange-100">
                                                <span className="flex items-center gap-1.5">
                                                    <Utensils className="w-4 h-4 text-orange-600" /> VA Lote Fracionado:
                                                </span>
                                                <span className="font-black text-orange-700">R$ {item.vaTotalValue.toFixed(2)} ({item.vaDestination})</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* CONFIG MODAL */}
            <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-black">
                            <Settings className="w-5 h-5 text-orange-500" /> Configurações Globais de Benefícios
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Defina as datas de corte de ocorrências, fracionamentos e prazos padrão de liberação.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleConfigSubmit} className="space-y-4 py-2 text-xs">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="font-bold text-slate-700">Dia Início Janela de Folha (Anterior)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={configFormData.payrollCutoffStartDay}
                                    onChange={e => setConfigFormData({ ...configFormData, payrollCutoffStartDay: Number(e.target.value) })}
                                />
                                <span className="text-[10px] text-slate-400">Padrão: 26</span>
                            </div>

                            <div className="space-y-1">
                                <Label className="font-bold text-slate-700">Dia Fim Janela de Folha (Atual)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={configFormData.payrollCutoffEndDay}
                                    onChange={e => setConfigFormData({ ...configFormData, payrollCutoffEndDay: Number(e.target.value) })}
                                />
                                <span className="text-[10px] text-slate-400">Padrão: 25</span>
                            </div>

                            <div className="space-y-1">
                                <Label className="font-bold text-slate-700">Dia do Pagamento da Folha</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={configFormData.payrollPaymentDay}
                                    onChange={e => setConfigFormData({ ...configFormData, payrollPaymentDay: Number(e.target.value) })}
                                />
                                <span className="text-[10px] text-slate-400">Padrão: 5º dia útil</span>
                            </div>

                            <div className="space-y-1">
                                <Label className="font-bold text-slate-700">Lote VT Admissão (Dias)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={30}
                                    value={configFormData.vtFractionDays}
                                    onChange={e => setConfigFormData({ ...configFormData, vtFractionDays: Number(e.target.value) })}
                                />
                                <span className="text-[10px] text-slate-400">Padrão: 5 dias</span>
                            </div>

                            <div className="space-y-1">
                                <Label className="font-bold text-slate-700">Lote VA Admissão (Dias)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={30}
                                    value={configFormData.vaFractionDays}
                                    onChange={e => setConfigFormData({ ...configFormData, vaFractionDays: Number(e.target.value) })}
                                />
                                <span className="text-[10px] text-slate-400">Padrão: 10 dias</span>
                            </div>

                            <div className="space-y-1">
                                <Label className="font-bold text-slate-700">Estimativa Entrega Cartão VA (Dias)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={30}
                                    value={configFormData.vaCardDeliveryEstimateDays}
                                    onChange={e => setConfigFormData({ ...configFormData, vaCardDeliveryEstimateDays: Number(e.target.value) })}
                                />
                                <span className="text-[10px] text-slate-400">Padrão: 10 dias</span>
                            </div>
                        </div>

                        <DialogFooter className="pt-4 border-t border-slate-100">
                            <Button type="button" variant="outline" onClick={() => setConfigModalOpen(false)}>Cancelar</Button>
                            <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white font-bold">Salvar Configurações</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
