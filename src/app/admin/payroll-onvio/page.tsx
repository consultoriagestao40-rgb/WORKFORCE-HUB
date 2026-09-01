"use client";

import { useState, useEffect, useRef } from "react";
import {
    Search,
    Download,
    RefreshCw,
    Users,
    UserPlus,
    Trash2,
    Info,
    ChevronLeft,
    ChevronRight,
    FileSpreadsheet,
    CheckSquare,
    Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getPayrollPreview, PayrollPreviewItem } from "@/actions/payroll";
import * as XLSX from "xlsx";

// ─── Mapeamento exato das Rubricas Onvio ────────────────────────────────────
const RUBRICAS = [
    { code: "25", label: "25 - ADICIONAL NOTURNO (INFOR)", field: "adicionalNoturnoHours", unit: "h" },
    { code: "40", label: "40 - HORAS FALTAS", field: "faltasCount", unit: "h" },
    { code: "42", label: "42 - HORAS FALTAS DSR", field: "dsrDeductionsCount", unit: "h" },
    { code: "269", label: "269 - Informativo AUXILIO COMBUSTIVEL", field: "ajudaCusto", unit: "R$" },
    { code: "272", label: "272 - PREMIO DE ASSIDUIDADE", field: "absenteismoAward", unit: "R$" },
    { code: "273", label: "273 - ADICIONAL DE SOBREAVISO", field: "outrosAdicionais", unit: "R$" },
    { code: "150", label: "150 - HORAS EXTRAS", field: "extras50Hours", unit: "h" },
    { code: "200", label: "200 - HORAS EXTRAS 100%", field: "extras100Hours", unit: "h" },
    { code: "8069", label: "8069 - HORAS FALTAS PARCIAL", field: "atrasosHours", unit: "h" },
    { code: "201", label: "201 - HORAS EXTRAS NOTURNAS 100%", field: "horasExtras100Value", unit: "R$" },
    { code: "202", label: "202 - HORAS EXTRAS NOTURNAS 50%", field: "horasExtras50Value", unit: "R$" },
    { code: "205", label: "205 - EMPRESTIMO", field: "emprestimos", unit: "R$" },
    { code: "230", label: "230 - ADICIONAL DE VIAGENS", field: "adicionalViagem", unit: "R$" },
    { code: "52", label: "52 - MENSALIDADE SINDICAL", field: "sindicato", unit: "R$" },
    { code: "274", label: "274 - DESCONTO CONVENIOS SINDICATO", field: "convenios", unit: "R$" },
    { code: "210", label: "210 - DESCONTO VALE ALIMENTAÇÃO", field: "vaPayrollDiscount", unit: "R$" },
] as const;

type RubricaField = typeof RUBRICAS[number]["field"];
type TipoLancamento = "ADIANTAMENTO" | "MENSAL" | "PLR";
type FiltroTipo = "Empregado" | "Contribuinte" | "Estagiário";

export default function PayrollOnvioPage() {
    const today = new Date();
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
    const [tipoLancamento, setTipoLancamento] = useState<TipoLancamento>("MENSAL");
    const [filtroTipos, setFiltroTipos] = useState<FiltroTipo[]>(["Empregado", "Contribuinte", "Estagiário"]);

    const [isLoading, setIsLoading] = useState(true);
    const [items, setItems] = useState<PayrollPreviewItem[]>([]);
    const [displayedItems, setDisplayedItems] = useState<PayrollPreviewItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const [addSearchTerm, setAddSearchTerm] = useState("");

    // All employees from full data (before displayed filter)
    const [allEmployees, setAllEmployees] = useState<PayrollPreviewItem[]>([]);
    const [isExporting, setIsExporting] = useState(false);

    const competenciaLabel = `${String(selectedMonth).padStart(2, "0")}/${selectedYear}`;

    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await getPayrollPreview(selectedYear, selectedMonth);
            const all = res.items || [];
            setAllEmployees(all);
            // Initially show all in alphabetical order
            setDisplayedItems(all.sort((a, b) => a.employeeName.localeCompare(b.employeeName)));
            setItems(all);
        } catch {
            toast.error("Erro ao carregar dados de folha.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedYear, selectedMonth]);

    // ─── Navegação de competência ──────────────────────────────────────────────
    const prevMonth = () => {
        if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
        else setSelectedMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
        else setSelectedMonth(m => m + 1);
    };

    // ─── Seleção ──────────────────────────────────────────────────────────────
    const toggleSelectAll = () => {
        if (selectedIds.size === displayedItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(displayedItems.map(i => i.employeeId)));
        }
    };
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // ─── Adicionar todos ──────────────────────────────────────────────────────
    const handleAddAll = () => {
        setDisplayedItems(allEmployees.sort((a, b) => a.employeeName.localeCompare(b.employeeName)));
        toast.success(`${allEmployees.length} funcionários adicionados à tabela.`);
    };

    // ─── Excluir selecionados ─────────────────────────────────────────────────
    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) { toast.warning("Nenhum funcionário selecionado."); return; }
        setDisplayedItems(prev => prev.filter(i => !selectedIds.has(i.employeeId)));
        toast.success(`${selectedIds.size} funcionário(s) removido(s) da visualização.`);
        setSelectedIds(new Set());
    };

    // ─── Add modal ────────────────────────────────────────────────────────────
    const filteredForAdd = allEmployees.filter(e =>
        e.employeeName.toLowerCase().includes(addSearchTerm.toLowerCase()) &&
        !displayedItems.find(d => d.employeeId === e.employeeId)
    );

    const handleAddEmployee = (emp: PayrollPreviewItem) => {
        setDisplayedItems(prev =>
            [...prev, emp].sort((a, b) => a.employeeName.localeCompare(b.employeeName))
        );
        toast.success(`${emp.employeeName} adicionado.`);
    };

    // ─── Pesquisa ─────────────────────────────────────────────────────────────
    const filtered = displayedItems.filter(i =>
        i.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ─── Valor formatado de rubrica ───────────────────────────────────────────
    const getVal = (item: PayrollPreviewItem, field: RubricaField): number => {
        const v = (item as any)[field];
        return typeof v === "number" ? v : 0;
    };

    const formatVal = (val: number, unit: string) => {
        if (val === 0) return "";
        if (unit === "h") return val.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    // ─── Exportação Excel ─────────────────────────────────────────────────────
    const handleExportExcel = () => {
        setIsExporting(true);
        try {
            const wsData: any[][] = [];

            // Cabeçalho
            const header = ["Nome", ...RUBRICAS.map(r => r.label)];
            wsData.push(header);

            // Dados
            filtered.forEach(item => {
                const row: any[] = [item.employeeName];
                RUBRICAS.forEach(rubrica => {
                    const v = getVal(item, rubrica.field);
                    row.push(v === 0 ? "" : v);
                });
                wsData.push(row);
            });

            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Estilo de largura de colunas
            ws["!cols"] = [{ wch: 35 }, ...RUBRICAS.map(() => ({ wch: 22 }))];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Rubricas");
            XLSX.writeFile(wb, `Lancamento_Rubricas_Onvio_${String(selectedMonth).padStart(2, "0")}_${selectedYear}.xlsx`);
            toast.success("Planilha exportada com sucesso!");
        } catch {
            toast.error("Erro ao exportar planilha.");
        } finally {
            setIsExporting(false);
        }
    };

    const allChecked = displayedItems.length > 0 && selectedIds.size === displayedItems.length;
    const someChecked = selectedIds.size > 0 && selectedIds.size < displayedItems.length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
            {/* ── Cabeçalho da Página ─────────────────────────────────────── */}
            <div className="border-b border-white/5 bg-slate-900/60 backdrop-blur-sm sticky top-0 z-20">
                <div className="max-w-full px-6 py-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-lg font-bold text-white tracking-tight">Lançamento de Rubricas</h1>
                            <p className="text-xs text-slate-400 mt-0.5">Competência: <span className="text-orange-400 font-semibold">{competenciaLabel}</span></p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Tipo de lançamento */}
                            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
                                {(["ADIANTAMENTO", "MENSAL", "PLR"] as TipoLancamento[]).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setTipoLancamento(t)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${tipoLancamento === t
                                            ? "bg-orange-500 text-white shadow"
                                            : "text-slate-400 hover:text-white hover:bg-slate-700"
                                            }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>

                            {/* Competência */}
                            <div className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1.5">
                                <button onClick={prevMonth} className="text-slate-400 hover:text-white p-1 rounded transition-colors">
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-sm font-semibold text-orange-400 min-w-[60px] text-center">{competenciaLabel}</span>
                                <button onClick={nextMonth} className="text-slate-400 hover:text-white p-1 rounded transition-colors">
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Filtro por tipo */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Filtrar por:</span>
                                {(["Empregado", "Contribuinte", "Estagiário"] as FiltroTipo[]).map(ft => (
                                    <button
                                        key={ft}
                                        onClick={() => setFiltroTipos(prev =>
                                            prev.includes(ft) ? prev.filter(x => x !== ft) : [...prev, ft]
                                        )}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${filtroTipos.includes(ft)
                                            ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                                            : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
                                            }`}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${filtroTipos.includes(ft) ? "bg-orange-400" : "bg-slate-600"}`} />
                                        {ft}
                                    </button>
                                ))}
                            </div>

                            {/* Busca */}
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar funcionário..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="bg-slate-800 border border-slate-700 text-sm text-white pl-8 pr-3 py-1.5 rounded-lg outline-none focus:border-orange-500 transition-colors w-52 placeholder:text-slate-500"
                                />
                            </div>

                            {/* Refresh */}
                            <button
                                onClick={loadData}
                                disabled={isLoading}
                                className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-orange-500 transition-all disabled:opacity-50"
                                title="Atualizar dados"
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Conteúdo Principal ──────────────────────────────────────── */}
            <div className="p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <RefreshCw className="w-8 h-8 text-orange-400 animate-spin mx-auto mb-3" />
                            <p className="text-slate-400 text-sm">Carregando rubricas...</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-900/50 rounded-xl border border-white/5 overflow-hidden shadow-2xl">
                        {/* ── Cabeçalho da Tabela (Laranja – Padrão Onvio) ── */}
                        <div
                            className="flex items-center justify-between px-4 py-3"
                            style={{ background: "linear-gradient(90deg, #f37021 0%, #e05a0a 100%)" }}
                        >
                            <span className="text-white font-bold text-sm tracking-wide">Rubricas</span>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleAddAll}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-white/90 hover:text-white transition-colors hover:underline"
                                >
                                    <Users className="w-3.5 h-3.5" />
                                    Adicionar todos os funcionários
                                </button>
                                <span className="text-white/40">|</span>
                                <button
                                    onClick={() => { setShowAddModal(true); setAddSearchTerm(""); }}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-white/90 hover:text-white transition-colors hover:underline"
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    Adicionar funcionários
                                </button>
                                <span className="text-white/40">|</span>
                                <button
                                    onClick={handleDeleteSelected}
                                    className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${selectedIds.size > 0 ? "text-white hover:underline" : "text-white/40 cursor-not-allowed"}`}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Excluir
                                </button>
                                <span className="text-white/40">|</span>
                                <button
                                    onClick={handleExportExcel}
                                    disabled={isExporting || filtered.length === 0}
                                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                    {isExporting ? "Exportando..." : "Exportar Excel"}
                                </button>
                            </div>
                        </div>

                        {/* ── Tabela ──────────────────────────────────────── */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse" style={{ minWidth: "1800px" }}>
                                {/* thead */}
                                <thead>
                                    <tr className="bg-slate-800/70 border-b border-white/5">
                                        <th className="sticky left-0 z-10 bg-slate-800 px-3 py-2 text-left w-8">
                                            <button onClick={toggleSelectAll} className="text-slate-400 hover:text-orange-400 transition-colors">
                                                {allChecked
                                                    ? <CheckSquare className="w-4 h-4 text-orange-400" />
                                                    : someChecked
                                                        ? <CheckSquare className="w-4 h-4 text-orange-300/60" />
                                                        : <Square className="w-4 h-4" />
                                                }
                                            </button>
                                        </th>
                                        <th className="sticky left-8 z-10 bg-slate-800 px-3 py-2 text-left font-semibold text-slate-300 whitespace-nowrap min-w-[220px]">
                                            Nome
                                        </th>
                                        {RUBRICAS.map(r => (
                                            <th
                                                key={r.code}
                                                className="px-3 py-2 text-left font-semibold text-slate-300 whitespace-nowrap min-w-[160px] border-l border-white/5"
                                                title={r.label}
                                            >
                                                <span className="block truncate max-w-[155px]">{r.label}</span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                {/* tbody */}
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={RUBRICAS.length + 2} className="text-center py-16 text-slate-500">
                                                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                                <p>Nenhum funcionário encontrado.</p>
                                                <p className="text-xs mt-1 text-slate-600">Clique em "Adicionar todos os funcionários" para começar.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((item, idx) => {
                                            const isSelected = selectedIds.has(item.employeeId);
                                            return (
                                                <tr
                                                    key={item.employeeId}
                                                    className={`border-b border-white/5 transition-colors group ${isSelected
                                                        ? "bg-orange-500/10"
                                                        : idx % 2 === 0 ? "bg-transparent" : "bg-slate-800/20"
                                                        } hover:bg-orange-500/5`}
                                                >
                                                    {/* Checkbox */}
                                                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                                                        <button onClick={() => toggleSelect(item.employeeId)} className="text-slate-500 hover:text-orange-400 transition-colors">
                                                            {isSelected
                                                                ? <CheckSquare className="w-4 h-4 text-orange-400" />
                                                                : <Square className="w-4 h-4" />
                                                            }
                                                        </button>
                                                    </td>

                                                    {/* Nome */}
                                                    <td className="sticky left-8 z-10 bg-inherit px-3 py-2 font-medium text-slate-200 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <span className="truncate max-w-[190px]" title={item.employeeName}>
                                                                {item.employeeName}
                                                            </span>
                                                            <button
                                                                title={`Empresa: ${item.companyName} | Posto: ${item.postoName}`}
                                                                className="text-slate-600 hover:text-orange-400 transition-colors flex-shrink-0"
                                                            >
                                                                <Info className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </td>

                                                    {/* Colunas de Rubricas */}
                                                    {RUBRICAS.map(r => {
                                                        const val = getVal(item, r.field);
                                                        const display = formatVal(val, r.unit);
                                                        return (
                                                            <td key={r.code} className="px-3 py-2 text-slate-300 border-l border-white/5 text-right">
                                                                {display ? (
                                                                    <span className={`font-mono text-xs ${val > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                                                        {display}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-700">—</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>

                                {/* Totais */}
                                {filtered.length > 0 && (
                                    <tfoot>
                                        <tr className="border-t-2 border-orange-500/30 bg-slate-800/60 font-semibold">
                                            <td className="sticky left-0 z-10 bg-slate-800 px-3 py-2" />
                                            <td className="sticky left-8 z-10 bg-slate-800 px-3 py-2 text-slate-300 text-xs uppercase tracking-wider">
                                                Totais ({filtered.length})
                                            </td>
                                            {RUBRICAS.map(r => {
                                                const total = filtered.reduce((acc, item) => acc + getVal(item, r.field), 0);
                                                return (
                                                    <td key={r.code} className="px-3 py-2 text-right border-l border-white/5">
                                                        {total > 0 ? (
                                                            <span className="font-mono text-xs text-orange-300">
                                                                {formatVal(total, r.unit)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-700">—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {/* Status bar */}
                        <div className="px-4 py-2.5 border-t border-white/5 bg-slate-900/30 flex items-center justify-between text-xs text-slate-500">
                            <span>{filtered.length} funcionário(s) exibidos • {selectedIds.size} selecionado(s)</span>
                            <span className="text-slate-600">Competência: <span className="text-orange-400/70">{competenciaLabel}</span> • Tipo: <span className="text-orange-400/70">{tipoLancamento}</span></span>
                        </div>
                    </div>
                )}

                {/* Descrição opcional */}
                <div className="mt-6">
                    <label className="block text-xs font-semibold text-slate-400 mb-2">
                        Descrição <span className="text-slate-600 font-normal">— opcional</span>
                    </label>
                    <textarea
                        rows={4}
                        placeholder="Adicione uma descrição ou observação para este lançamento..."
                        className="w-full max-w-2xl bg-slate-800/60 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 px-4 py-3 outline-none focus:border-orange-500/60 transition-colors resize-none"
                    />
                </div>
            </div>

            {/* ── Modal: Adicionar Funcionários ────────────────────────────── */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
                    <div className="relative bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5"
                            style={{ background: "linear-gradient(90deg, #f37021 0%, #e05a0a 100%)" }}>
                            <div className="flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-white" />
                                <h3 className="text-sm font-bold text-white">Adicionar Funcionários</h3>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="text-white/70 hover:text-white text-lg leading-none">×</button>
                        </div>
                        {/* Search */}
                        <div className="p-4">
                            <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Buscar funcionário..."
                                    value={addSearchTerm}
                                    onChange={e => setAddSearchTerm(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 text-sm text-white pl-9 pr-3 py-2 rounded-lg outline-none focus:border-orange-500 transition-colors placeholder:text-slate-500"
                                />
                            </div>
                            <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                                {filteredForAdd.length === 0 ? (
                                    <p className="text-center text-slate-500 py-8 text-sm">Nenhum funcionário disponível para adicionar.</p>
                                ) : (
                                    filteredForAdd.map(emp => (
                                        <button
                                            key={emp.employeeId}
                                            onClick={() => { handleAddEmployee(emp); }}
                                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-orange-500/10 border border-transparent hover:border-orange-500/30 transition-all text-left group"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-slate-200 group-hover:text-white">{emp.employeeName}</p>
                                                <p className="text-xs text-slate-500">{emp.companyName}</p>
                                            </div>
                                            <UserPlus className="w-3.5 h-3.5 text-slate-600 group-hover:text-orange-400 transition-colors flex-shrink-0" />
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="px-4 pb-4">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 font-semibold transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
