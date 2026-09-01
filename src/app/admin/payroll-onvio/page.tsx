"use client";

import { useState, useEffect } from "react";
import {
    Search,
    RefreshCw,
    Info,
    ChevronLeft,
    ChevronRight,
    FileSpreadsheet,
    CheckSquare,
    Square,
    Building2,
    AlertCircle,
    ClipboardList,
    Calendar,
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
    { code: "25",   label: "25 - ADICIONAL NOTURNO (INFOR)",        field: "adicionalNoturnoHours", unit: "h"  },
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

    const [isLoading, setIsLoading]     = useState(true);
    const [allItems, setAllItems]       = useState<PayrollPreviewItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm]   = useState("");
    const [isExporting, setIsExporting] = useState(false);

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

    // Filtros
    const filtered = allItems.filter(i => {
        const matchCompany = selectedCompany === "all" || i.companyName === selectedCompany;
        const matchSearch  = !searchTerm || i.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
        return matchCompany && matchSearch;
    });

    // Seleção
    const allChecked  = filtered.length > 0 && selectedIds.size === filtered.length;
    const someChecked = selectedIds.size > 0 && selectedIds.size < filtered.length;

    const toggleSelectAll = () =>
        setSelectedIds(allChecked ? new Set() : new Set(filtered.map(i => i.employeeId)));
    const toggleSelect = (id: string) =>
        setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

    // Valor de rubrica
    const getVal = (item: PayrollPreviewItem, field: RubricaField): number => {
        const v = (item as any)[field];
        return typeof v === "number" ? v : 0;
    };
    const formatVal = (val: number, unit: string) => {
        if (val === 0) return "";
        if (unit === "h") return val.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    // Exportação Excel
    const handleExportExcel = () => {
        setIsExporting(true);
        try {
            const header = ["Nome", "Empresa", ...RUBRICAS.map(r => r.label)];
            const rows = filtered.map(item => [
                item.employeeName,
                item.companyName,
                ...RUBRICAS.map(r => { const v = getVal(item, r.field); return v === 0 ? "" : v; }),
            ]);
            const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
            ws["!cols"] = [{ wch: 35 }, { wch: 28 }, ...RUBRICAS.map(() => ({ wch: 22 }))];
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
                            Padrão <span className="text-orange-400">Onvio</span> • Competência:{" "}
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
                                <SelectTrigger className="h-8 border-none bg-transparent hover:bg-slate-700 text-white font-bold text-xs rounded-xl w-[100px] cursor-pointer">
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
                            disabled={isExporting || filtered.length === 0}
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

            {/* ── Painel de Filtros ────────────────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    {/* Busca */}
                    <div className="flex flex-col gap-1.5 md:col-span-1">
                        <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">Pesquisar Colaborador</Label>
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                            <Input
                                placeholder="Buscar por nome..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 text-xs h-9 rounded-xl bg-slate-50 border-slate-200"
                            />
                        </div>
                    </div>

                    {/* Filtro Empresa */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">Filtrar por Empresa</Label>
                        <Combobox
                            options={[
                                { value: "all", label: "Todas as Empresas" },
                                ...uniqueCompanies.map(c => ({ value: c, label: c }))
                            ]}
                            value={selectedCompany}
                            onChange={setSelectedCompany}
                            placeholder="Todas as Empresas"
                            searchPlaceholder="Buscar empresa..."
                            className="h-9"
                        />
                    </div>

                    {/* Contagem */}
                    <div className="flex items-end gap-2 pb-0.5">
                        <div className="bg-orange-50 border border-orange-200/60 rounded-2xl px-4 py-2 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-orange-500" />
                            <div>
                                <p className="text-[10px] font-black text-orange-600 uppercase tracking-wider">Funcionários</p>
                                <p className="text-lg font-black text-slate-800">{filtered.length}</p>
                            </div>
                        </div>
                        {selectedIds.size > 0 && (
                            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl px-4 py-2">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Selecionados</p>
                                <p className="text-lg font-black text-slate-800">{selectedIds.size}</p>
                            </div>
                        )}
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
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <AlertCircle className="w-8 h-8 text-slate-300" />
                        <span className="text-xs text-slate-400 font-bold">Nenhum funcionário encontrado.</span>
                    </div>
                ) : (
                    <>
                        {/* Cabeçalho laranja padrão Onvio */}
                        <div
                            className="flex items-center justify-between px-5 py-3"
                            style={{ background: "linear-gradient(90deg, #f37021 0%, #e05a0a 100%)" }}
                        >
                            <span className="text-white font-black text-sm tracking-wide">Rubricas</span>
                            <span className="text-white/70 text-xs font-semibold">
                                {MESES[selectedMonth - 1]}/{selectedYear}
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse" style={{ minWidth: "2000px" }}>
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    {/* Checkbox */}
                                    <th className="py-3 px-4 sticky left-0 z-20 w-9" style={{ backgroundColor: "#f8fafc" }}>
                                        <button onClick={toggleSelectAll} className="text-slate-400 hover:text-orange-500 transition-colors">
                                            {allChecked
                                                ? <CheckSquare className="w-4 h-4 text-orange-500" />
                                                : someChecked
                                                    ? <CheckSquare className="w-4 h-4 text-orange-300" />
                                                    : <Square className="w-4 h-4" />}
                                        </button>
                                    </th>
                                    {/* Nome */}
                                    <th className="py-3 px-4 sticky left-9 z-20 text-left min-w-[200px] whitespace-nowrap" style={{ backgroundColor: "#f8fafc", boxShadow: "4px 0 6px -2px rgba(0,0,0,0.06)" }}>
                                        Nome
                                    </th>
                                    {/* Empresa */}
                                    <th className="py-3 px-4 text-left min-w-[160px] whitespace-nowrap border-l border-slate-100">
                                        Empresa
                                    </th>
                                    {/* Rubricas */}
                                    {RUBRICAS.map(r => (
                                        <th
                                            key={r.code}
                                            title={r.label}
                                            className="py-3 px-4 text-left min-w-[150px] border-l border-slate-100 whitespace-nowrap"
                                        >
                                            <span className="block truncate max-w-[145px]">{r.label}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody>
                                {filtered.map((item, idx) => {
                                    const isSelected = selectedIds.has(item.employeeId);
                                    return (
                                        <tr
                                            key={item.employeeId}
                                            className={`border-b border-slate-100 transition-colors ${
                                                isSelected
                                                    ? "bg-orange-50"
                                                    : idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                                            } hover:bg-orange-50/60`}
                                        >
                                            {/* Checkbox */}
                                            <td
                                                className="py-2.5 px-4 sticky left-0 z-10"
                                                style={{ backgroundColor: isSelected ? "#fff7ed" : idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}
                                            >
                                                <button onClick={() => toggleSelect(item.employeeId)} className="text-slate-300 hover:text-orange-500 transition-colors">
                                                    {isSelected
                                                        ? <CheckSquare className="w-4 h-4 text-orange-500" />
                                                        : <Square className="w-4 h-4" />}
                                                </button>
                                            </td>

                                            {/* Nome */}
                                            <td
                                                className="py-2.5 px-4 sticky left-9 z-10 font-bold text-slate-700 whitespace-nowrap"
                                                style={{
                                                    backgroundColor: isSelected ? "#fff7ed" : idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                                                    boxShadow: "4px 0 6px -2px rgba(0,0,0,0.06)"
                                                }}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className="truncate max-w-[180px]" title={item.employeeName}>
                                                        {item.employeeName}
                                                    </span>
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
                                                const display = formatVal(val, r.unit);
                                                return (
                                                    <td key={r.code} className="py-2.5 px-4 border-l border-slate-100 text-right">
                                                        {display
                                                            ? <span className="font-mono font-bold text-emerald-600">{display}</span>
                                                            : <span className="text-slate-200">—</span>}
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
                                    <td className="py-3 px-4 sticky left-0 z-10" style={{ backgroundColor: "#f8fafc" }} />
                                    <td className="py-3 px-4 sticky left-9 z-10 text-[10px] text-slate-500 uppercase tracking-widest whitespace-nowrap" style={{ backgroundColor: "#f8fafc", boxShadow: "4px 0 6px -2px rgba(0,0,0,0.06)" }}>
                                        Totais ({filtered.length})
                                    </td>
                                    <td className="py-3 px-4 border-l border-slate-100" />
                                    {RUBRICAS.map(r => {
                                        const total = filtered.reduce((acc, item) => acc + getVal(item, r.field), 0);
                                        return (
                                            <td key={r.code} className="py-3 px-4 text-right border-l border-slate-100">
                                                {total > 0
                                                    ? <span className="font-mono text-orange-600">{formatVal(total, r.unit)}</span>
                                                    : <span className="text-slate-200">—</span>}
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
                    placeholder="Adicione uma observação para este lançamento..."
                    className="w-full max-w-2xl bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-300 px-4 py-3 outline-none focus:border-orange-400 transition-colors resize-none"
                />
            </div>
        </div>
    );
}
