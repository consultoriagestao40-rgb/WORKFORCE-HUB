"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Search,
    RefreshCw,
    Info,
    FileSpreadsheet,
    CheckSquare,
    Square,
    Building2,
    AlertCircle,
    ClipboardList,
    Calendar,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    CheckCircle2,
    Clock,
    RotateCcw
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { toast } from "sonner";
import { getPayrollPreview, PayrollPreviewItem } from "@/actions/payroll";
import * as XLSX from "xlsx";

// ─── Mapeamento exato das Rubricas Onvio ────────────────────────────────────
const RUBRICAS = [
    { code: "25",   label: "25 - ADICIONAL NOTURNO (HORAS)",        field: "adicionalNoturnoHours", unit: "h"  },
    { code: "40",   label: "40 - HORAS FALTAS",                     field: "faltasCount",           unit: "h"  },
    { code: "42",   label: "42 - HORAS FALTAS DSR",                 field: "dsrDeductionsCount",    unit: "h"  },
    { code: "269",  label: "269 - Informativo AUXILIO COMBUSTIVEL",  field: "ajudaCusto",            unit: "R$" },
    { code: "272",  label: "272 - PREMIO DE ASSIDUIDADE",           field: "absenteismoAward",      unit: "R$" },
    { code: "273",  label: "273 - ADICIONAL DE SOBREAVISO",         field: "outrosAdicionais",      unit: "R$" },
    { code: "150",  label: "150 - HORAS EXTRAS",                    field: "extras50Hours",         unit: "h"  },
    { code: "200",  label: "200 - HORAS EXTRAS 100%",               field: "extras100Hours",        unit: "h"  },
    { code: "8069", label: "8069 - HORAS FALTAS PARCIAL",           field: "atrasosHours",          unit: "h"  },
    { code: "201",  label: "201 - HORAS EXTRAS NOTURNAS 100%",      field: "horasExtras100Value",   unit: "R$" },
    { code: "202",  label: "202 - HORAS EXTRAS NOTURNAS 50%",       field: "horasExtras50Value",    unit: "R$" },
    { code: "205",  label: "205 - EMPRESTIMO",                      field: "emprestimos",           unit: "R$" },
    { code: "230",  label: "230 - ADICIONAL DE VIAGENS",            field: "adicionalViagem",       unit: "R$" },
    { code: "52",   label: "52 - MENSALIDADE SINDICAL",             field: "sindicato",             unit: "R$" },
    { code: "274",  label: "274 - DESCONTO CONVENIOS SINDICATO",    field: "convenios",             unit: "R$" },
    { code: "210",  label: "210 - DESCONTO VALE ALIMENTAÇÃO",       field: "vaPayrollDiscount",     unit: "R$" },
] as const;

type RubricaField = typeof RUBRICAS[number]["field"];

const MESES = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

export default function PayrollOnvioPage() {
    const today = new Date();
    const [selectedYear, setSelectedYear]       = useState<number>(today.getFullYear());
    const [selectedMonth, setSelectedMonth]     = useState<number>(today.getMonth() + 1);
    const [selectedCompany, setSelectedCompany] = useState<string>("all");
    const [statusFilter, setStatusFilter]       = useState<"all" | "pending" | "launched">("all");

    const [isLoading, setIsLoading]     = useState(true);
    const [allItems, setAllItems]       = useState<PayrollPreviewItem[]>([]);
    const [searchTerm, setSearchTerm]   = useState("");
    const [isExporting, setIsExporting] = useState(false);

    // Checklist persistente no localStorage por competência (ano/mês)
    const [launchedIds, setLaunchedIds] = useState<Set<string>>(new Set());

    // Ordenação
    const [sortField, setSortField] = useState<string>("name");
    const [sortDir, setSortDir]     = useState<"asc" | "desc">("asc");

    // Carregar marcações salvas no localStorage
    useEffect(() => {
        try {
            const key = `onvio_lancados_${selectedYear}_${selectedMonth}`;
            const stored = localStorage.getItem(key);
            if (stored) {
                setLaunchedIds(new Set(JSON.parse(stored)));
            } else {
                setLaunchedIds(new Set());
            }
        } catch {
            setLaunchedIds(new Set());
        }
    }, [selectedYear, selectedMonth]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await getPayrollPreview(selectedYear, selectedMonth);
            setAllItems((res.items || []).sort((a, b) => a.employeeName.localeCompare(b.employeeName)));
        } catch {
            toast.error("Erro ao carregar dados de folha.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [selectedYear, selectedMonth]);

    // Empresas únicas
    const uniqueCompanies = Array.from(new Set(allItems.map(i => i.companyName))).sort();

    // Valor de rubrica numérico
    const getVal = (item: PayrollPreviewItem, field: RubricaField): number => {
        const v = (item as any)[field];
        return typeof v === "number" ? v : 0;
    };

    // Toggle de checklist individual (Lançado no Onvio)
    const toggleLaunched = (id: string) => {
        setLaunchedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            try {
                localStorage.setItem(
                    `onvio_lancados_${selectedYear}_${selectedMonth}`,
                    JSON.stringify(Array.from(next))
                );
            } catch (e) {
                console.error("Erro ao salvar no localStorage", e);
            }
            return next;
        });
    };

    // Limpar todas as marcações da competência
    const handleClearLaunched = () => {
        if (launchedIds.size === 0) return;
        if (confirm("Deseja realmente desmarcar todos os colaboradores desta competência?")) {
            setLaunchedIds(new Set());
            try {
                localStorage.removeItem(`onvio_lancados_${selectedYear}_${selectedMonth}`);
                toast.success("Marcações reiniciadas para esta competência.");
            } catch (e) {
                console.error(e);
            }
        }
    };

    // Filtragem base
    const filtered = allItems.filter(i => {
        const matchCompany = selectedCompany === "all" || i.companyName === selectedCompany;
        const matchSearch  = !searchTerm || i.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
        const isDone       = launchedIds.has(i.employeeId);
        const matchStatus  = statusFilter === "all" || (statusFilter === "launched" ? isDone : !isDone);
        return matchCompany && matchSearch && matchStatus;
    });

    // Ordenação
    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDir(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            // Campos de texto e status iniciam em 'asc'; rubricas numéricas iniciam em 'desc' (maiores primeiro)
            setSortDir(field === "name" || field === "company" || field === "launched" ? "asc" : "desc");
        }
    };

    const sortedFiltered = useMemo(() => {
        return [...filtered].sort((a, b) => {
            if (sortField === "launched") {
                const aDone = launchedIds.has(a.employeeId) ? 1 : 0;
                const bDone = launchedIds.has(b.employeeId) ? 1 : 0;
                return sortDir === "asc" ? aDone - bDone : bDone - aDone;
            }
            if (sortField === "name") {
                const cmp = a.employeeName.localeCompare(b.employeeName);
                return sortDir === "asc" ? cmp : -cmp;
            }
            if (sortField === "company") {
                const cmp = a.companyName.localeCompare(b.companyName);
                return sortDir === "asc" ? cmp : -cmp;
            }
            const valA = getVal(a, sortField as RubricaField);
            const valB = getVal(b, sortField as RubricaField);
            return sortDir === "asc" ? valA - valB : valB - valA;
        });
    }, [filtered, sortField, sortDir, launchedIds]);

    // Marcação de todos os visíveis
    const allFilteredLaunched = sortedFiltered.length > 0 && sortedFiltered.every(i => launchedIds.has(i.employeeId));
    const someFilteredLaunched = sortedFiltered.some(i => launchedIds.has(i.employeeId)) && !allFilteredLaunched;

    const toggleAllFilteredLaunched = () => {
        setLaunchedIds(prev => {
            const next = new Set(prev);
            if (allFilteredLaunched) {
                sortedFiltered.forEach(i => next.delete(i.employeeId));
            } else {
                sortedFiltered.forEach(i => next.add(i.employeeId));
            }
            try {
                localStorage.setItem(
                    `onvio_lancados_${selectedYear}_${selectedMonth}`,
                    JSON.stringify(Array.from(next))
                );
            } catch (e) {
                console.error(e);
            }
            return next;
        });
    };

    // Estatísticas de progresso
    const totalCount = allItems.length;
    const launchedTotal = allItems.filter(i => launchedIds.has(i.employeeId)).length;
    const pendingTotal = totalCount - launchedTotal;
    const percentDone = totalCount > 0 ? Math.round((launchedTotal / totalCount) * 100) : 0;

    // Ícone de classificação
    const renderSortIcon = (field: string) => {
        if (sortField === field) {
            return sortDir === "asc" ? (
                <ArrowUp className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            ) : (
                <ArrowDown className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            );
        }
        return <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />;
    };

    // Exportação Excel
    const handleExportExcel = () => {
        setIsExporting(true);
        try {
            const header = ["Nome", "Empresa", "Lançado no Onvio", ...RUBRICAS.map(r => r.label)];
            const rows = sortedFiltered.map(item => [
                item.employeeName,
                item.companyName,
                launchedIds.has(item.employeeId) ? "SIM" : "NÃO",
                ...RUBRICAS.map(r => { 
                    const v = getVal(item, r.field); 
                    return v === 0 ? "" : v; 
                }),
            ]);
            const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
            ws["!cols"] = [{ wch: 35 }, { wch: 28 }, { wch: 18 }, ...RUBRICAS.map(() => ({ wch: 22 }))];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Rubricas");
            XLSX.writeFile(wb, `Lancamento_Rubricas_Onvio_${String(selectedMonth).padStart(2,"0")}_${selectedYear}.xlsx`);
            toast.success("Planilha exportada com sucesso!");
        } catch {
            toast.error("Erro ao exportar planilha.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-6">

            {/* ── Header padrão do sistema ─────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-6 shadow-xl border border-slate-800">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#1e293b,transparent)]" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className="bg-orange-500/10 p-2 rounded-xl border border-orange-400/20 text-orange-400">
                                <ClipboardList className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Financeiro &amp; DP</span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tight">Lançamento de Rubricas</h1>
                        <p className="text-xs text-slate-400 font-semibold mt-1">
                            Padrão <span className="text-orange-400 font-bold">Onvio</span> • Competência:{" "}
                            <span className="text-white font-bold underline decoration-orange-400">
                                {MESES[selectedMonth - 1]}/{selectedYear}
                            </span>
                        </p>
                    </div>

                    <div className="flex items-center gap-3 self-start md:self-center flex-wrap">
                        {/* Seletor mês/ano */}
                        <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-2xl border border-slate-700/60 backdrop-blur-sm">
                            <Calendar className="w-4 h-4 text-orange-400 ml-1" />
                            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
                                <SelectTrigger className="h-8 border-none bg-transparent hover:bg-slate-700 text-white font-bold text-xs rounded-xl w-[105px] cursor-pointer">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                                    {MESES.map((m, i) => (
                                        <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                                <SelectTrigger className="h-8 border-none bg-transparent hover:bg-slate-700 text-white font-bold text-xs rounded-xl w-[80px] cursor-pointer">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                                    <SelectItem value="2025">2025</SelectItem>
                                    <SelectItem value="2026">2026</SelectItem>
                                    <SelectItem value="2027">2027</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Exportar Excel */}
                        <button
                            onClick={handleExportExcel}
                            disabled={isExporting || sortedFiltered.length === 0}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/50 text-white font-bold text-xs h-11 px-4 rounded-2xl border border-emerald-500/30 transition-all cursor-pointer shadow-lg shadow-slate-950/20 active:scale-[0.98] disabled:cursor-not-allowed"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>{isExporting ? "Exportando..." : "Exportar Excel"}</span>
                        </button>

                        {/* Refresh */}
                        <button
                            onClick={loadData}
                            disabled={isLoading}
                            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold text-xs h-11 px-4 rounded-2xl border border-slate-600/30 transition-all cursor-pointer shadow-lg shadow-slate-950/20 active:scale-[0.98] disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Painel de Progresso & Filtros ────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-5 space-y-4">
                {/* Linha superior: KPIs de Lançamento */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Total Funcionários */}
                    <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-200/60 flex items-center justify-center text-slate-700">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total de Colaboradores</p>
                                <p className="text-xl font-black text-slate-900">{totalCount}</p>
                            </div>
                        </div>
                    </div>

                    {/* Lançados no Onvio */}
                    <div className="bg-emerald-50 border border-emerald-200/70 rounded-2xl p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Lançados no Onvio</p>
                                <p className="text-xl font-black text-emerald-900">
                                    {launchedTotal} <span className="text-xs font-bold text-emerald-600">({percentDone}%)</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Pendentes */}
                    <div className="bg-amber-50 border border-amber-200/70 rounded-2xl p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Pendentes de Lançamento</p>
                                <p className="text-xl font-black text-amber-900">{pendingTotal}</p>
                            </div>
                        </div>
                        {launchedTotal > 0 && (
                            <button
                                onClick={handleClearLaunched}
                                title="Desmarcar todos os colaboradores desta competência"
                                className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-red-500 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-xs transition-colors"
                            >
                                <RotateCcw className="w-3 h-3" />
                                <span>Reiniciar</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Barra de progresso */}
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${percentDone}%` }}
                    />
                </div>

                {/* Filtros e Tabs */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
                    {/* Tabs de Status */}
                    <div className="inline-flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/60 self-start">
                        <button
                            onClick={() => setStatusFilter("all")}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                statusFilter === "all"
                                    ? "bg-white text-slate-900 shadow-xs"
                                    : "text-slate-500 hover:text-slate-900"
                            }`}
                        >
                            Todos ({totalCount})
                        </button>
                        <button
                            onClick={() => setStatusFilter("pending")}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                statusFilter === "pending"
                                    ? "bg-white text-amber-700 shadow-xs"
                                    : "text-slate-500 hover:text-amber-700"
                            }`}
                        >
                            Pendentes ({pendingTotal})
                        </button>
                        <button
                            onClick={() => setStatusFilter("launched")}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                statusFilter === "launched"
                                    ? "bg-white text-emerald-700 shadow-xs"
                                    : "text-slate-500 hover:text-emerald-700"
                            }`}
                        >
                            Lançados ({launchedTotal})
                        </button>
                    </div>

                    {/* Busca e Empresa */}
                    <div className="flex items-center gap-3 flex-1 lg:max-w-xl">
                        <div className="relative flex-1">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                            <Input
                                placeholder="Buscar colaborador por nome..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 text-xs h-9 rounded-xl bg-slate-50 border-slate-200"
                            />
                        </div>
                        <div className="w-[200px]">
                            <Combobox
                                options={[
                                    { value: "all", label: "Todas as Empresas" },
                                    ...uniqueCompanies.map(c => ({ value: c, label: c }))
                                ]}
                                value={selectedCompany}
                                onChange={setSelectedCompany}
                                placeholder="Todas as Empresas"
                                searchPlaceholder="Buscar empresa..."
                                className="h-9 text-xs"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Tabela de Rubricas ───────────────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-8 h-8 rounded-full border-4 border-slate-100 border-t-orange-500 animate-spin" />
                        <span className="text-xs text-slate-400 font-bold">Carregando rubricas...</span>
                    </div>
                ) : sortedFiltered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <AlertCircle className="w-8 h-8 text-slate-300" />
                        <span className="text-xs text-slate-400 font-bold">
                            {statusFilter === "pending"
                                ? "Parabéns! Todos os colaboradores já foram marcados como lançados."
                                : "Nenhum colaborador encontrado com os filtros aplicados."}
                        </span>
                    </div>
                ) : (
                    <>
                        {/* Cabeçalho laranja padrão Onvio */}
                        <div
                            className="flex items-center justify-between px-5 py-3"
                            style={{ background: "linear-gradient(90deg, #f37021 0%, #e05a0a 100%)" }}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-white font-black text-sm tracking-wide">Rubricas Onvio</span>
                                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {sortedFiltered.length} exibidos
                                </span>
                            </div>
                            <span className="text-white/80 text-xs font-semibold">
                                {MESES[selectedMonth - 1]}/{selectedYear}
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse" style={{ minWidth: "2100px" }}>
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                    {/* Checkbox (Lançado no Onvio) com Ordenação */}
                                    <th
                                        className="py-3 px-3 sticky left-0 z-20 w-14 text-center cursor-pointer select-none hover:bg-slate-100 transition-colors"
                                        style={{ backgroundColor: "#f8fafc" }}
                                    >
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={toggleAllFilteredLaunched}
                                                title={allFilteredLaunched ? "Desmarcar todos os visíveis" : "Marcar todos os visíveis como Lançados no Onvio"}
                                                className="text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                                            >
                                                {allFilteredLaunched ? (
                                                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                                                ) : someFilteredLaunched ? (
                                                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                                                ) : (
                                                    <Square className="w-4 h-4" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleSort("launched")}
                                                title="Classificar por status de lançamento"
                                                className="text-slate-400 hover:text-emerald-600 cursor-pointer"
                                            >
                                                {renderSortIcon("launched")}
                                            </button>
                                        </div>
                                    </th>

                                    {/* Nome */}
                                    <th
                                        onClick={() => handleSort("name")}
                                        className="py-3 px-4 sticky left-14 z-20 text-left min-w-[220px] whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors group"
                                        style={{ backgroundColor: "#f8fafc", boxShadow: "4px 0 6px -2px rgba(0,0,0,0.06)" }}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Nome do Colaborador</span>
                                            {renderSortIcon("name")}
                                        </div>
                                    </th>

                                    {/* Empresa */}
                                    <th
                                        onClick={() => handleSort("company")}
                                        className="py-3 px-4 text-left min-w-[160px] whitespace-nowrap border-l border-slate-100 cursor-pointer select-none hover:bg-slate-100 transition-colors group"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Empresa</span>
                                            {renderSortIcon("company")}
                                        </div>
                                    </th>

                                    {/* Rubricas */}
                                    {RUBRICAS.map(r => (
                                        <th
                                            key={r.code}
                                            title={`${r.label} - Clique para classificar`}
                                            onClick={() => handleSort(r.field)}
                                            className="py-3 px-4 text-right min-w-[155px] border-l border-slate-100 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors group"
                                        >
                                            <div className="flex items-center justify-end gap-1.5">
                                                <span className="truncate max-w-[130px]">{r.label}</span>
                                                {renderSortIcon(r.field)}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody>
                                {sortedFiltered.map((item, idx) => {
                                    const isLaunched = launchedIds.has(item.employeeId);
                                    return (
                                        <tr
                                            key={item.employeeId}
                                            className={`border-b border-slate-100 transition-colors ${
                                                isLaunched
                                                    ? "bg-emerald-50/40 hover:bg-emerald-50/70"
                                                    : idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                                            } hover:bg-orange-50/50`}
                                        >
                                            {/* Checkbox (Lançado no Onvio) */}
                                            <td
                                                className="py-2.5 px-3 sticky left-0 z-10 text-center"
                                                style={{
                                                    backgroundColor: isLaunched ? "#ecfdf5" : idx % 2 === 0 ? "#ffffff" : "#f8fafc"
                                                }}
                                            >
                                                <button
                                                    onClick={() => toggleLaunched(item.employeeId)}
                                                    title={isLaunched ? "Clique para desmarcar" : "Marcar como lançado no Onvio"}
                                                    className="cursor-pointer transition-transform active:scale-90"
                                                >
                                                    {isLaunched ? (
                                                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                                                    ) : (
                                                        <Square className="w-4 h-4 text-slate-300 hover:text-emerald-500" />
                                                    )}
                                                </button>
                                            </td>

                                            {/* Nome */}
                                            <td
                                                className="py-2.5 px-4 sticky left-14 z-10 font-bold whitespace-nowrap"
                                                style={{
                                                    backgroundColor: isLaunched ? "#ecfdf5" : idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                                                    boxShadow: "4px 0 6px -2px rgba(0,0,0,0.06)"
                                                }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={`truncate max-w-[185px] ${isLaunched ? "text-emerald-950 font-semibold" : "text-slate-800"}`}
                                                        title={item.employeeName}
                                                    >
                                                        {item.employeeName}
                                                    </span>
                                                    {isLaunched && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                            <CheckCircle2 className="w-2.5 h-2.5" />
                                                            Lançado
                                                        </span>
                                                    )}
                                                    <span title={`${item.companyName} • ${item.postoName}`} className="text-slate-300 hover:text-orange-500 cursor-default transition-colors">
                                                        <Info className="w-3 h-3" />
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Empresa */}
                                            <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap border-l border-slate-100 truncate max-w-[160px]" title={item.companyName}>
                                                {item.companyName}
                                            </td>

                                            {/* Rubricas */}
                                            {RUBRICAS.map(r => {
                                                const val = getVal(item, r.field);
                                                return (
                                                    <td key={r.code} className="py-2.5 px-4 border-l border-slate-100 text-right whitespace-nowrap">
                                                        {val > 0 ? (
                                                            r.unit === "h" ? (
                                                                <span className="font-mono font-bold text-emerald-600">
                                                                    {val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    <span className="text-[10px] text-slate-400 font-normal ml-0.5">h</span>
                                                                </span>
                                                            ) : (
                                                                <span className="font-mono font-bold text-emerald-600">
                                                                    {val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="text-slate-200">—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>

                            {/* Totais */}
                            <tfoot>
                                <tr className="border-t-2 border-slate-200 bg-slate-50 font-black">
                                    <td className="py-3 px-3 sticky left-0 z-10 text-center" style={{ backgroundColor: "#f8fafc" }}>
                                        <span className="text-[10px] text-slate-400 font-bold">{launchedTotal}/{sortedFiltered.length}</span>
                                    </td>
                                    <td className="py-3 px-4 sticky left-14 z-10 text-[10px] text-slate-500 uppercase tracking-widest whitespace-nowrap" style={{ backgroundColor: "#f8fafc", boxShadow: "4px 0 6px -2px rgba(0,0,0,0.06)" }}>
                                        Totais ({sortedFiltered.length})
                                    </td>
                                    <td className="py-3 px-4 border-l border-slate-100" />
                                    {RUBRICAS.map(r => {
                                        const total = sortedFiltered.reduce((acc, item) => acc + getVal(item, r.field), 0);
                                        return (
                                            <td key={r.code} className="py-3 px-4 text-right border-l border-slate-100 whitespace-nowrap">
                                                {total > 0 ? (
                                                    r.unit === "h" ? (
                                                        <span className="font-mono text-orange-600">
                                                            {total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            <span className="text-[10px] text-slate-400 font-normal ml-0.5">h</span>
                                                        </span>
                                                    ) : (
                                                        <span className="font-mono text-orange-600">
                                                            {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="text-slate-200">—</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tfoot>

                        </table>
                        </div>
                    </>
                )}
            </div>

            {/* Descrição opcional */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-5">
                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">
                    Descrição <span className="font-normal text-slate-400 normal-case">— opcional</span>
                </Label>
                <textarea
                    rows={3}
                    placeholder="Adicione uma observação para este lote de rubricas..."
                    className="w-full max-w-2xl bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-300 px-4 py-3 outline-none focus:border-orange-400 transition-colors resize-none"
                />
            </div>
        </div>
    );
}
