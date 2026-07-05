"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { 
    getConsolidatedPerformanceData, 
    createContractVisit, 
    getAdminClientKpis,
    getClientDetailedData,
    getAdminClientBilling,
    updatePostoBilling,
    upsertSlaConfigItem,
    deleteSlaConfigItem,
    updateSlaMonthlyValue,
    upsertNpsQuestion,
    deleteNpsQuestion,
    getPostoRoutines
} from "@/app/admin/requests/actions";
import { 
    Award, Building, Calendar, Users, DollarSign, 
    Plus, Clock, LogOut, CheckCircle2, Star, 
    Trash2, Edit3, Settings, HelpCircle, 
    Inbox, FileText, Smile, BarChart2, ClipboardList, 
    ChevronLeft, ChevronRight, RefreshCw, X, Download, UserCheck, UserX
} from "lucide-react";

interface PerformanceDashboardProps {
    initialClients: any[];
    userRole: string;
    userName: string;
}

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function PerformanceDashboard({ initialClients, userRole, userName }: PerformanceDashboardProps) {
    const [selectedClientId, setSelectedClientId] = useState<string>("all");
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [date, setDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));

    // Active client-like tab
    const [activeTab, setActiveTab] = useState<"presence" | "requests" | "billing" | "monthly_report" | "nps" | "kpis" | "sla" | "service_plan">("presence");

    // Sorting state for consolidated contracts list
    const [sortBy, setSortBy] = useState<"abc" | "billing" | "name">("abc");

    // Consolidated Group Data
    const [consolidatedData, setConsolidatedData] = useState<any>(null);
    const [loadingConsolidated, setLoadingConsolidated] = useState<boolean>(false);

    // Client-specific KPI History
    const [clientKpiData, setClientKpiData] = useState<any>(null);
    const [loadingClientKpis, setLoadingClientKpis] = useState<boolean>(false);

    // Client-specific Billing History
    const [billingData, setBillingData] = useState<any[]>([]);
    const [loadingBilling, setLoadingBilling] = useState<boolean>(false);

    // Client-specific detailed operations
    const [detailedData, setDetailedData] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

    // Posto routines
    const [selectedPostoId, setSelectedPostoId] = useState<string>("");
    const [routines, setRoutines] = useState<any[]>([]);
    const [loadingRoutines, setLoadingRoutines] = useState<boolean>(false);

    // Visit Log Dialog State
    const [logVisitOpen, setLogVisitOpen] = useState<boolean>(false);
    const [visitClientId, setVisitClientId] = useState<string>("");
    const [visitorName, setVisitorName] = useState<string>("");
    const [visitorRole, setVisitorRole] = useState<string>("SUPERVISOR");
    const [visitDate, setVisitDate] = useState<string>(new Date().toISOString().substring(0, 10));
    const [visitNotes, setVisitNotes] = useState<string>("");
    const [savingVisit, setSavingVisit] = useState<boolean>(false);

    // Inline Billing Edit
    const [editingPostoId, setEditingPostoId] = useState<string | null>(null);
    const [editBillingVal, setEditBillingVal] = useState<number>(0);

    // SLA Config Dialog State
    const [slaDialogOpen, setSlaDialogOpen] = useState<boolean>(false);
    const [editingSlaItem, setEditingSlaItem] = useState<any | null>(null);
    const [slaName, setSlaName] = useState<string>("");
    const [slaMetricType, setSlaMetricType] = useState<string>("EFETIVIDADE");
    const [slaWeight, setSlaWeight] = useState<number>(1);
    const [slaTarget, setSlaTarget] = useState<number>(90);
    const [savingSla, setSavingSla] = useState<boolean>(false);

    // SLA Manual value State
    const [editingSlaValueId, setEditingSlaValueId] = useState<string | null>(null);
    const [manualSlaValue, setManualSlaValue] = useState<number>(0);

    // NPS Question Dialog State
    const [npsDialogOpen, setNpsDialogOpen] = useState<boolean>(false);
    const [editingNpsQ, setEditingNpsQ] = useState<any | null>(null);
    const [npsQText, setNpsQText] = useState<string>("");
    const [npsQWeight, setNpsQWeight] = useState<number>(1);
    const [savingNpsQ, setSavingNpsQ] = useState<boolean>(false);

    const loadPerformanceData = useCallback(async () => {
        if (selectedClientId === "all") {
            setLoadingConsolidated(true);
            try {
                const res = await getConsolidatedPerformanceData(selectedYear, selectedMonth);
                if (res.success) {
                    setConsolidatedData(res);
                } else {
                    toast.error("Erro ao carregar dados consolidados.");
                }
            } catch (e) {
                toast.error("Erro ao conectar.");
            } finally {
                setLoadingConsolidated(false);
            }
        } else {
            setLoadingClientKpis(true);
            try {
                const res = await getAdminClientKpis(selectedClientId, selectedYear);
                if (res.success) {
                    setClientKpiData(res);
                } else {
                    toast.error("Erro ao carregar KPIs do contrato.");
                }
            } catch (e) {
                toast.error("Erro de conexão ao carregar KPIs.");
            } finally {
                setLoadingClientKpis(false);
            }
        }
    }, [selectedClientId, selectedYear, selectedMonth]);

    const loadClientDetails = useCallback(async () => {
        if (selectedClientId === "all") {
            setDetailedData(null);
            return;
        }
        setLoadingDetails(true);
        try {
            const res = await getClientDetailedData(selectedClientId, selectedYear, selectedMonth);
            if (res.success) {
                setDetailedData(res);
                if (res.postos && res.postos.length > 0) {
                    setSelectedPostoId(res.postos[0].id);
                }
            } else {
                toast.error("Erro ao buscar detalhes do contrato.");
            }
        } catch (e) {
            toast.error("Erro de conexão.");
        } finally {
            setLoadingDetails(false);
        }
    }, [selectedClientId, selectedYear, selectedMonth]);

    const loadBillingData = useCallback(async () => {
        if (selectedClientId === "all") {
            setBillingData([]);
            return;
        }
        setLoadingBilling(true);
        try {
            const res = await getAdminClientBilling(selectedClientId, selectedYear);
            if (res.success && res.months) {
                setBillingData(res.months);
            } else {
                toast.error("Erro ao carregar faturamento.");
            }
        } catch (e) {
            toast.error("Erro ao buscar faturamento.");
        } finally {
            setLoadingBilling(false);
        }
    }, [selectedClientId, selectedYear]);

    const loadRoutines = useCallback(async () => {
        if (!selectedPostoId || selectedClientId === "all") {
            setRoutines([]);
            return;
        }
        setLoadingRoutines(true);
        try {
            const res = await getPostoRoutines(selectedPostoId);
            if (res.success && res.routines) {
                setRoutines(res.routines);
            }
        } catch (e) {
            toast.error("Erro ao carregar rotinas.");
        } finally {
            setLoadingRoutines(false);
        }
    }, [selectedPostoId, selectedClientId]);

    useEffect(() => {
        loadPerformanceData();
        loadClientDetails();
        loadBillingData();
    }, [loadPerformanceData, loadClientDetails, loadBillingData]);

    useEffect(() => {
        loadRoutines();
    }, [loadRoutines]);

    const handleSaveVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!visitClientId || !visitorName || !visitDate) {
            toast.error("Preencha todos os campos obrigatórios.");
            return;
        }
        setSavingVisit(true);
        try {
            const res = await createContractVisit({
                clientId: visitClientId,
                visitorRole,
                visitorName,
                visitDate,
                notes: visitNotes
            });
            if (res.success) {
                toast.success("Visita de relacionamento registrada!");
                setLogVisitOpen(false);
                setVisitorName("");
                setVisitNotes("");
                loadPerformanceData();
                loadClientDetails();
            } else {
                toast.error("Erro ao salvar visita.");
            }
        } catch (e) {
            toast.error("Erro de conexão.");
        } finally {
            setSavingVisit(false);
        }
    };

    // Billing Handlers
    const handleSavePostoBilling = async (postoId: string) => {
        try {
            const res = await updatePostoBilling(postoId, editBillingVal);
            if (res.success) {
                toast.success("Faturamento do posto atualizado!");
                setEditingPostoId(null);
                loadPerformanceData();
                loadClientDetails();
                loadBillingData();
            } else {
                toast.error("Erro ao atualizar faturamento.");
            }
        } catch (e) {
            toast.error("Erro de conexão.");
        }
    };

    // SLA Handlers
    const handleSaveSlaItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!slaName) return;
        setSavingSla(true);
        try {
            const res = await upsertSlaConfigItem({
                id: editingSlaItem?.id,
                clientId: selectedClientId,
                name: slaName,
                metricType: slaMetricType,
                weight: Number(slaWeight),
                targetValue: Number(slaTarget)
            });
            if (res.success) {
                toast.success("Indicador de SLA configurado!");
                setSlaDialogOpen(false);
                setSlaName("");
                setEditingSlaItem(null);
                loadPerformanceData();
                loadClientDetails();
            } else {
                toast.error("Erro ao salvar SLA.");
            }
        } catch (e) {
            toast.error("Erro de conexão.");
        } finally {
            setSavingSla(false);
        }
    };

    const handleDeleteSlaItemClick = async (id: string) => {
        if (!confirm("Excluir este indicador de SLA?")) return;
        try {
            const res = await deleteSlaConfigItem(id);
            if (res.success) {
                toast.success("SLA excluído.");
                loadPerformanceData();
                loadClientDetails();
            } else {
                toast.error("Erro ao excluir.");
            }
        } catch (e) {
            toast.error("Erro de conexão.");
        }
    };

    const handleSaveManualSlaValue = async (configItemId: string) => {
        try {
            const res = await updateSlaMonthlyValue(configItemId, selectedMonth, selectedYear, manualSlaValue);
            if (res.success) {
                toast.success("Nota mensal lançada com sucesso!");
                setEditingSlaValueId(null);
                loadPerformanceData();
                loadClientDetails();
            } else {
                toast.error("Erro ao salvar nota.");
            }
        } catch (e) {
            toast.error("Erro de conexão.");
        }
    };

    // NPS Handlers
    const handleSaveNpsQ = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!npsQText) return;
        setSavingNpsQ(true);
        try {
            const res = await upsertNpsQuestion({
                id: editingNpsQ?.id,
                clientId: selectedClientId,
                text: npsQText,
                weight: Number(npsQWeight)
            });
            if (res.success) {
                toast.success("Pergunta de NPS configurada!");
                setNpsDialogOpen(false);
                setNpsQText("");
                setEditingNpsQ(null);
                loadClientDetails();
            } else {
                toast.error("Erro ao salvar pergunta.");
            }
        } catch (e) {
            toast.error("Erro de conexão.");
        } finally {
            setSavingNpsQ(false);
        }
    };

    const handleDeleteNpsQClick = async (id: string) => {
        if (!confirm("Excluir esta pergunta do NPS?")) return;
        try {
            const res = await deleteNpsQuestion(id);
            if (res.success) {
                toast.success("Pergunta excluída.");
                loadClientDetails();
            } else {
                toast.error("Erro ao excluir.");
            }
        } catch (e) {
            toast.error("Erro de conexão.");
        }
    };

    const handlePrevDay = () => {
        const d = new Date(date + "T12:00:00");
        d.setDate(d.getDate() - 1);
        setDate(format(d, "yyyy-MM-dd"));
    };

    const handleNextDay = () => {
        const d = new Date(date + "T12:00:00");
        d.setDate(d.getDate() + 1);
        setDate(format(d, "yyyy-MM-dd"));
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
    };

    const handleExportExcel = () => {
        let excelData: any[] = [];
        let filename = `relatorio-presenca-${date}.xlsx`;

        if (selectedClientId === "all" && consolidatedData) {
            excelData = consolidatedData.clients.map((c: any) => ({
                Contrato: c.name,
                Empresa: c.companyName,
                ClasseABC: c.class,
                Faturamento: c.billing,
                SLA: `${c.slaCompliance.toFixed(1)}%`,
                NPS: c.npsCount > 0 ? c.npsRating.toFixed(1) : "Pendente",
                VagasEmAberto: c.vacantSlots
            }));
            filename = `consolidado-contratos-${selectedYear}-${selectedMonth + 1}.xlsx`;
        } else if (detailedData) {
            const dailyAtts = detailedData.attendances.filter((a: any) => 
                format(new Date(a.date), "yyyy-MM-dd") === date
            );
            excelData = dailyAtts.map((a: any) => ({
                Posto: a.posto?.role?.name,
                Escala: a.posto?.schedule,
                Horario: `${a.posto?.startTime} - ${a.posto?.endTime}`,
                Colaborador: a.employee?.name || "Vaga em Aberto",
                Status: a.status,
                Cobertura: a.coveredBy ? `Coberto por ${a.coveredBy.name} (${a.coverageType})` : "-"
            }));
            filename = `presenca-${selectedClientId}-${date}.xlsx`;
        }

        if (excelData.length === 0) {
            toast.error("Nenhum dado para exportar.");
            return;
        }

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dados");
        XLSX.writeFile(wb, filename);
        toast.success("Planilha exportada com sucesso!");
    };

    const menuItems = [
        { id: "presence", label: "Presença Diária", icon: Calendar },
        { id: "requests", label: "Solicitações", icon: Inbox },
        { id: "billing", label: "Faturamento Mensal", icon: DollarSign },
        { id: "monthly_report", label: "Relatório Mensal", icon: FileText },
        { id: "nps", label: "NPS / Avaliação", icon: Smile },
        { id: "kpis", label: "Indicadores (KPIs)", icon: BarChart2 },
        { id: "sla", label: "SLA / Desempenho", icon: Award },
        { id: "service_plan", label: "Plano de Serviços", icon: ClipboardList }
    ];

    // Sorting Logic for consolidated view
    const getSortedClients = () => {
        if (!consolidatedData || !consolidatedData.clients) return [];
        return [...consolidatedData.clients].sort((a: any, b: any) => {
            if (sortBy === "abc") {
                const order: Record<string, number> = { A: 1, B: 2, C: 3 };
                const ordA = order[a.class] || 99;
                const ordB = order[b.class] || 99;
                if (ordA !== ordB) return ordA - ordB;
                return b.billing - a.billing; // secondary sort by billing desc
            }
            if (sortBy === "billing") {
                return b.billing - a.billing;
            }
            return a.name.localeCompare(b.name);
        });
    };

    const sortedClients = getSortedClients();

    return (
        <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans text-slate-800">
            {/* Left Sidebar - Idêntica à do Cliente, Imagem 3 */}
            <aside className="w-64 bg-slate-950 text-white flex flex-col shrink-0 border-r border-slate-900">
                {/* Brand / Logo */}
                <div className="h-16 flex items-center px-6 border-b border-slate-850 shrink-0 gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shrink-0">
                        WH
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-black tracking-widest leading-none text-white uppercase">WORKFORCE HUB</span>
                        <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">Portal do Gestor</span>
                    </div>
                </div>

                {/* Logged in User Card */}
                <div className="p-4 border-b border-slate-850 bg-slate-900/20">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Acesso Gestor</span>
                    <span className="text-xs font-bold text-slate-200 mt-0.5 truncate block">Olá, {userName}</span>
                    {selectedClientId !== "all" && (
                        <div className="mt-2 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400 uppercase tracking-wider truncate">
                            🏢 {initialClients.find(c => c.id === selectedClientId)?.name}
                        </div>
                    )}
                </div>

                {/* Sidebar Navigation Options */}
                <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const active = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as any)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-left ${
                                    active
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20 font-black"
                                        : "text-slate-400 hover:bg-slate-900/40 hover:text-white"
                                }`}
                            >
                                <Icon className="w-4 h-4 shrink-0" />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* Exit Back to Main Admin Area */}
                <div className="p-3 border-t border-slate-850">
                    <button
                        onClick={() => window.location.href = "/admin/requests"}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 transition-colors text-left"
                    >
                        <LogOut className="w-4 h-4 shrink-0" />
                        <span>Voltar ao Admin</span>
                    </button>
                </div>
            </aside>

            {/* Main Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header Bar - Idêntica à do Cliente, Imagem 3 */}
                <header className="h-16 bg-slate-950 border-b border-slate-850 flex items-center justify-between px-6 shrink-0 text-white shadow-md">
                    <h2 className="text-sm font-black tracking-widest text-slate-100 uppercase">
                        {menuItems.find(m => m.id === activeTab)?.label}
                    </h2>
                    
                    <div className="flex items-center gap-3">
                        <select
                            value={selectedClientId}
                            onChange={(e) => {
                                setSelectedClientId(e.target.value);
                                setActiveTab("presence");
                            }}
                            className="h-9 rounded-xl border border-slate-800 bg-slate-900 text-white text-[11px] font-bold px-3 outline-none cursor-pointer"
                        >
                            <option value="all">Todos os Contratos (Consolidado)</option>
                            {initialClients.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>

                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="h-9 rounded-xl border border-slate-800 bg-slate-900 text-white text-[11px] font-bold px-3 outline-none cursor-pointer"
                        >
                            {monthNames.map((name, i) => (
                                <option key={i} value={i}>{name}</option>
                            ))}
                        </select>

                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="h-9 rounded-xl border border-slate-800 bg-slate-900 text-white text-[11px] font-bold px-3 outline-none cursor-pointer"
                        >
                            <option value={2026}>2026</option>
                            <option value={2025}>2025</option>
                        </select>
                    </div>
                </header>

                {/* Sub-Contents Area */}
                <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-100">
                    
                    {loadingConsolidated || loadingClientKpis || loadingDetails || loadingBilling ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-3">
                            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                            <span className="text-xs text-slate-500 font-bold">Processando dados consolidados operacionais do grupo...</span>
                        </div>
                    ) : (
                        <div>
                            {selectedClientId === "all" ? (
                                /* ==================== CONSOLIDATED VIEW (GRUPO) ==================== */
                                <div className="space-y-6">
                                    
                                    {/* TAB 1: PRESENÇA DIÁRIA CONSOLIDADA */}
                                    {activeTab === "presence" && consolidatedData && (
                                        <div className="space-y-6">
                                            {/* Date Picker Header */}
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
                                                <div className="space-y-0.5">
                                                    <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Status de Presença Diário</h3>
                                                    <p className="text-[11px] text-slate-400 font-semibold">Monitore a lotação e o cumprimento de escalas em tempo real dos seus contratos.</p>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                                                        <Button variant="ghost" size="icon" onClick={handlePrevDay} className="h-8 w-8 rounded-lg hover:bg-white">
                                                            <ChevronLeft className="w-4 h-4 text-slate-600" />
                                                        </Button>
                                                        <input 
                                                            type="date" 
                                                            value={date} 
                                                            onChange={(e) => setDate(e.target.value)}
                                                            className="bg-transparent text-xs font-bold text-slate-750 px-2 outline-none cursor-pointer"
                                                        />
                                                        <Button variant="ghost" size="icon" onClick={handleNextDay} className="h-8 w-8 rounded-lg hover:bg-white">
                                                            <ChevronRight className="w-4 h-4 text-slate-600" />
                                                        </Button>
                                                    </div>
                                                    
                                                    <select
                                                        value={sortBy}
                                                        onChange={(e: any) => setSortBy(e.target.value)}
                                                        className="h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold px-3 outline-none cursor-pointer shadow-premium"
                                                    >
                                                        <option value="abc">Classificar: Curva ABC</option>
                                                        <option value="billing">Classificar: Faturamento</option>
                                                        <option value="name">Classificar: Nome do Contrato</option>
                                                    </select>

                                                    <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5 h-9 rounded-xl font-bold border-slate-200 bg-white shadow-sm">
                                                        <Download className="w-3.5 h-3.5" /> Exportar Planilha
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Metrics Cards Grid - Idêntica ao Portal do Cliente, Imagem 3 */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                                <Card className="border-none shadow-sm bg-slate-900 text-white p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-300">Postos em Escala</span>
                                                    <span className="text-xl font-black mt-1">
                                                        {consolidatedData.activeHeadcount || 0}
                                                    </span>
                                                </Card>

                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Presentes</span>
                                                    <span className="text-xl font-black mt-1 text-emerald-600">
                                                        {consolidatedData.presentCountCombined || 0}
                                                    </span>
                                                </Card>

                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Aguardando/Atrasados</span>
                                                    <span className="text-xl font-black mt-1 text-amber-600">
                                                        {consolidatedData.lateCountCombined || 0}
                                                    </span>
                                                </Card>

                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cobertos</span>
                                                    <span className="text-xl font-black mt-1 text-blue-600">
                                                        {consolidatedData.coveredCountCombined || 0}
                                                    </span>
                                                </Card>

                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Vagos (Sem Cobertura)</span>
                                                    <span className="text-xl font-black mt-1 text-red-600">
                                                        {consolidatedData.vacantSlotsCombined || 0}
                                                    </span>
                                                </Card>
                                            </div>

                                            {/* Consolidated Contracts Table (Tabela Principal) */}
                                            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
                                                <Table>
                                                    <TableHeader className="bg-slate-50">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3.5 pl-6">Contrato / Unidade</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">Curva ABC</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-right py-3.5">Faturamento</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">Total de Postos</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3.5">Status de Presença</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">Ação</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {sortedClients.map((c: any) => (
                                                            <TableRow key={c.id} className="hover:bg-slate-50/50">
                                                                <TableCell className="py-3 pl-6">
                                                                    <span className="text-xs font-bold text-slate-800 block">{c.name}</span>
                                                                    <span className="text-[10px] text-slate-400 font-semibold">{c.companyName}</span>
                                                                </TableCell>
                                                                <TableCell className="text-center py-3">
                                                                    <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${
                                                                        c.class === "A" ? "bg-emerald-50 text-emerald-700 border-emerald-250" :
                                                                        c.class === "B" ? "bg-amber-50 text-amber-700 border-amber-250" :
                                                                        "bg-slate-100 text-slate-700 border-slate-200"
                                                                    }`}>
                                                                        Classe {c.class}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-right text-xs font-black text-slate-800 py-3">
                                                                    {formatCurrency(c.billing)}
                                                                </TableCell>
                                                                <TableCell className="text-center text-xs font-medium text-slate-500 py-3">
                                                                    {c.totalSlots} Postos
                                                                </TableCell>
                                                                <TableCell className="py-3">
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-[9px] font-bold">
                                                                            {c.presentCount || 0} Presentes
                                                                        </Badge>
                                                                        {c.lateCount > 0 && (
                                                                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 text-[9px] font-bold">
                                                                                {c.lateCount} Atrasados
                                                                            </Badge>
                                                                        )}
                                                                        {c.vacantSlots > 0 && (
                                                                            <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50 text-[9px] font-bold">
                                                                                {c.vacantSlots} Vagos
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-center py-3">
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm" 
                                                                        onClick={() => {
                                                                            setSelectedClientId(c.id);
                                                                            setActiveTab("presence");
                                                                        }}
                                                                        className="text-blue-600 font-bold text-xs hover:text-blue-700 p-0 h-auto"
                                                                    >
                                                                        Ver Detalhes →
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </Card>

                                            {/* Visitas & Semáforo da Régua de Visitas */}
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                <Card className="lg:col-span-1 border-slate-200 shadow-sm rounded-2xl bg-white">
                                                    <CardHeader>
                                                        <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">Status Régua de Visitas</CardTitle>
                                                        <CardDescription>Classificação por conformidade e dias máximos decorridos.</CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="space-y-4">
                                                        {["A", "B", "C"].map(classLetter => {
                                                            const clsClients = consolidatedData.clients.filter((c: any) => c.class === classLetter);
                                                            const countOk = clsClients.filter((c: any) => c.visitCompliance?.supervisor?.status === "OK").length;
                                                            return (
                                                                <div key={classLetter} className="flex justify-between items-center text-xs p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                                                                    <span className="font-bold text-slate-700">Classe {classLetter}</span>
                                                                    <span className="font-black text-slate-900">{countOk} / {clsClients.length} em dia</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </CardContent>
                                                </Card>

                                                <Card className="lg:col-span-2 border-slate-200 shadow-sm rounded-2xl bg-white">
                                                    <CardHeader className="flex flex-row items-center justify-between">
                                                        <div>
                                                            <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">Régua de Relacionamento</CardTitle>
                                                            <CardDescription>Prazos máximos para Supervisor (15 dias), Gerente (30 dias) e Diretor (60 dias).</CardDescription>
                                                        </div>
                                                        <Button 
                                                            size="sm" 
                                                            onClick={() => {
                                                                if (initialClients.length > 0) {
                                                                    setVisitClientId(initialClients[0].id);
                                                                    setLogVisitOpen(true);
                                                                }
                                                            }}
                                                            className="gap-1 bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs rounded-xl"
                                                        >
                                                            Registrar Visita
                                                        </Button>
                                                    </CardHeader>
                                                    <CardContent className="p-0">
                                                        <Table>
                                                            <TableHeader className="bg-slate-50">
                                                                <TableRow>
                                                                    <TableHead className="font-bold text-slate-800 text-xs pl-6">Contrato</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs text-center">ABC</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs text-center">Supervisor</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs text-center">Gerente</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs text-center">Diretor</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {sortedClients.slice(0, 10).map((c: any) => {
                                                                    const renderBall = (status: "OK" | "WARNING" | "CRITICAL", dateStr: string | null) => {
                                                                        let color = "bg-emerald-500";
                                                                        if (status === "WARNING") color = "bg-amber-400";
                                                                        else if (status === "CRITICAL") color = "bg-red-500";
                                                                        return (
                                                                            <div className="flex flex-col items-center gap-0.5 justify-center">
                                                                                <span className={`w-3 h-3 rounded-full ${color}`} />
                                                                                <span className="text-[9px] font-semibold text-slate-400">{dateStr ? new Date(dateStr).toLocaleDateString('pt-BR') : 'N/D'}</span>
                                                                            </div>
                                                                        );
                                                                    };
                                                                    return (
                                                                        <TableRow key={c.id} className="hover:bg-slate-50/50">
                                                                            <TableCell className="text-xs font-bold text-slate-700 pl-6 py-2">
                                                                                {c.name}
                                                                            </TableCell>
                                                                            <TableCell className="text-center py-2">
                                                                                <span className="text-[10px] font-black text-slate-500">Classe {c.class}</span>
                                                                            </TableCell>
                                                                            <TableCell className="py-2">{renderBall(c.visitCompliance.supervisor.status, c.visitCompliance.supervisor.lastDate)}</TableCell>
                                                                            <TableCell className="py-2">{renderBall(c.visitCompliance.gerente.status, c.visitCompliance.gerente.lastDate)}</TableCell>
                                                                            <TableCell className="py-2">{renderBall(c.visitCompliance.diretor.status, c.visitCompliance.diretor.lastDate)}</TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                            </TableBody>
                                                        </Table>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 2: CENTRAL DE CHAMADOS (CONSOLIDADA) */}
                                    {activeTab === "requests" && (
                                        <div className="space-y-6">
                                            <div className="space-y-1">
                                                <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Chamados de Todos os Clientes</h3>
                                                <p className="text-[11px] text-slate-400 font-semibold">Audite os chamados abertos e o cumprimento do SLA contratual.</p>
                                            </div>

                                            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
                                                <Table>
                                                    <TableHeader className="bg-slate-50">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3.5 pl-6">Contrato</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3.5">Assunto</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3.5 text-center">Status</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3.5">Solicitante</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3.5">Data</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3.5">Prazo SLA</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {consolidatedData.clients.map((c: any) => 
                                                            c.recentRequests?.map((r: any) => (
                                                                <TableRow key={r.id} className="hover:bg-slate-50/50">
                                                                    <TableCell className="text-xs font-bold text-slate-800 pl-6 py-3">
                                                                        {c.name}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-slate-655 py-3 truncate max-w-xs" title={r.description}>
                                                                        {r.description}
                                                                    </TableCell>
                                                                    <TableCell className="text-center py-3">
                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                                                            r.status === "CONCLUIDO" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                                                                        }`}>
                                                                            {r.status}
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-slate-650 font-semibold py-3">
                                                                        {r.requester?.name || "Cliente"}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-slate-500 py-3">
                                                                        {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs font-bold text-slate-700 py-3">
                                                                        {new Date(r.dueDate).toLocaleDateString("pt-BR")}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </Card>
                                        </div>
                                    )}

                                    {/* TAB 3: FATURAMENTO CONSOLIDADO (BILLING) */}
                                    {activeTab === "billing" && (
                                        <div className="space-y-6">
                                            {/* Cards de Faturamento Geral */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                <Card className="border-none shadow-sm bg-slate-900 text-white p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-300">Faturamento Bruto Previsto</span>
                                                    <span className="text-lg font-black mt-1">{formatCurrency(consolidatedData.totalBilling || 0)}</span>
                                                </Card>
                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Glosas por Ausências</span>
                                                    <span className="text-lg font-black mt-1 text-red-600">
                                                        {formatCurrency(consolidatedData.totalGlosasCombined || 0)}
                                                    </span>
                                                </Card>
                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Faturamento Líquido Real</span>
                                                    <span className="text-lg font-black mt-1 text-emerald-600">
                                                        {formatCurrency(Math.max(0, (consolidatedData.totalBilling || 0) - (consolidatedData.totalGlosasCombined || 0)))}
                                                    </span>
                                                </Card>
                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Efetividade Geral do Mês</span>
                                                    <span className="text-lg font-black mt-1 text-blue-600">
                                                        {consolidatedData.avgEffectivenessCombined?.toFixed(1)}%
                                                    </span>
                                                </Card>
                                            </div>

                                            {/* Tabela de Faturamento */}
                                            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
                                                <Table>
                                                    <TableHeader className="bg-slate-50">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3.5 pl-6">Contrato</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3.5 text-center">Classe ABC</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-right py-3.5">Faturamento Previsto</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-right py-3.5">Desconto Glosas</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-right py-3.5">Valor Líquido</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">Efetividade</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {sortedClients.map((c: any) => {
                                                            const cBilling = c.billing || 0;
                                                            const cGlosas = c.glosasTotal || 0;
                                                            const cNet = Math.max(0, cBilling - cGlosas);
                                                            return (
                                                                <TableRow key={c.id} className="hover:bg-slate-50/50">
                                                                    <TableCell className="font-bold text-xs text-slate-800 py-3 pl-6">
                                                                        {c.name}
                                                                    </TableCell>
                                                                    <TableCell className="text-center py-3">
                                                                        <span className="text-[10px] font-bold">Classe {c.class}</span>
                                                                    </TableCell>
                                                                    <TableCell className="text-right text-xs font-semibold text-slate-700 py-3">
                                                                        {formatCurrency(cBilling)}
                                                                    </TableCell>
                                                                    <TableCell className="text-right text-xs font-semibold text-red-650 py-3">
                                                                        -{formatCurrency(cGlosas)}
                                                                    </TableCell>
                                                                    <TableCell className="text-right text-xs font-black text-emerald-600 py-3">
                                                                        {formatCurrency(cNet)}
                                                                    </TableCell>
                                                                    <TableCell className="text-center text-xs font-black text-blue-600 py-3">
                                                                        {c.effectiveness?.toFixed(1) || "100.0"}%
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </Card>
                                        </div>
                                    )}

                                    {/* TAB 4: RELATÓRIO MENSAL CONSOLIDADO */}
                                    {activeTab === "monthly_report" && (
                                        <div className="space-y-6">
                                            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
                                                <CardHeader>
                                                    <CardTitle className="text-xs font-black uppercase text-slate-800">Demonstrativo Mensal consolidado de Glosas</CardTitle>
                                                    <CardDescription>Todos os apontamentos de faltas não cobertas que geraram desconto.</CardDescription>
                                                </CardHeader>
                                                <CardContent className="p-0">
                                                    <Table>
                                                        <TableHeader className="bg-slate-50">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-slate-800 text-xs pl-6 py-3.5">Contrato</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3.5">Posto / Função</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3.5 text-center">Faltas Sem Cobertura</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-right pr-6 py-3.5">Glosas Consolidadas</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {sortedClients.map((c: any) => (
                                                                <TableRow key={c.id} className="hover:bg-slate-50/50">
                                                                    <TableCell className="text-xs font-bold text-slate-850 pl-6 py-3">
                                                                        {c.name}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-slate-500 py-3">
                                                                        Múltiplos postos
                                                                    </TableCell>
                                                                    <TableCell className="text-center text-xs font-black text-red-500 py-3">
                                                                        {c.vacantSlots} ocorrências
                                                                    </TableCell>
                                                                    <TableCell className="text-right pr-6 text-xs font-black text-red-650 py-3">
                                                                        {formatCurrency(c.glosasTotal || 0)}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    )}

                                    {/* TAB 5: NPS / AVALIAÇÃO CONSOLIDADA */}
                                    {activeTab === "nps" && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
                                                    <CardHeader>
                                                        <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">Média NPS Geral do Grupo</CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="pt-2 text-center space-y-2">
                                                        <span className="text-4xl font-black text-blue-600">
                                                            {consolidatedData.groupNpsScore ? (consolidatedData.groupNpsScore > 0 ? "+" : "") + consolidatedData.groupNpsScore.toFixed(0) : "100"}
                                                        </span>
                                                        <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Zona de Qualidade Excelente</p>
                                                    </CardContent>
                                                </Card>

                                                <Card className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
                                                    <TableHeader className="bg-slate-50">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-slate-800 text-xs pl-6 py-3">Contrato</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-center py-3">Avaliação</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-center py-3">Envios</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {sortedClients.map((c: any) => (
                                                            <TableRow key={c.id} className="hover:bg-slate-50/50">
                                                                <TableCell className="text-xs font-bold text-slate-700 pl-6 py-2.5">
                                                                    {c.name}
                                                                </TableCell>
                                                                <TableCell className="text-center text-xs font-black py-2.5">
                                                                    {c.npsCount > 0 ? `${c.npsRating.toFixed(1)}/10` : "Pendente"}
                                                                </TableCell>
                                                                <TableCell className="text-center text-xs font-bold text-slate-450 py-2.5">
                                                                    {c.npsCount} respostas
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Card>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 6: INDICADORES KPIS CONSOLIDADOS */}
                                    {activeTab === "kpis" && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-550">Efetividade Escala Grupo</span>
                                                    <span className="text-xl font-black mt-1 text-emerald-600">
                                                        {consolidatedData.avgEffectivenessCombined?.toFixed(1)}%
                                                    </span>
                                                </Card>
                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-550">Nível Cumprimento SLA</span>
                                                    <span className="text-xl font-black mt-1 text-blue-600">
                                                        {consolidatedData.avgSlaCombined?.toFixed(1)}%
                                                    </span>
                                                </Card>
                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-550">NPS Consolidado</span>
                                                    <span className="text-xl font-black mt-1 text-amber-500">
                                                        {consolidatedData.groupNpsScore?.toFixed(0)}
                                                    </span>
                                                </Card>
                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-550">Absenteísmo Médio</span>
                                                    <span className="text-xl font-black mt-1 text-red-500">
                                                        {(100 - (consolidatedData.avgEffectivenessCombined || 100)).toFixed(1)}%
                                                    </span>
                                                </Card>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 7: SLA CONSOLIDADO */}
                                    {activeTab === "sla" && (
                                        <div className="space-y-6">
                                            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
                                                <Table>
                                                    <TableHeader className="bg-slate-50">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3.5 pl-6">Contrato</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3.5 text-center">Cumprimento de SLA</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3.5 text-center">Classe ABC</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {sortedClients.map((c: any) => (
                                                            <TableRow key={c.id} className="hover:bg-slate-50/50">
                                                                <TableCell className="text-xs font-bold text-slate-700 py-3 pl-6">
                                                                    {c.name}
                                                                </TableCell>
                                                                <TableCell className="text-center py-3">
                                                                    <span className={`px-2 py-0.5 rounded font-black text-xs ${
                                                                        c.slaCompliance >= 90 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                                                    }`}>
                                                                        {c.slaCompliance.toFixed(1)}%
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-center text-xs font-semibold py-3 text-slate-550">
                                                                    Classe {c.class}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </Card>
                                        </div>
                                    )}

                                    {/* TAB 8: PLANO DE SERVIÇOS CONSOLIDADO */}
                                    {activeTab === "service_plan" && (
                                        <div className="text-center py-20 text-slate-400 font-semibold italic text-xs">
                                            Selecione um contrato individual no seletor do cabeçalho superior para consultar os Planos de Serviços e check-lists de tarefas das equipes.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* ==================== INDIVIDUAL CLIENT VIEW (DETALHADO) ==================== */
                                <div className="space-y-6">
                                    
                                    {/* TAB 1: PRESENÇA DIÁRIA INDIVIDUAL */}
                                    {activeTab === "presence" && detailedData && (
                                        <div className="space-y-6">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/50 shadow-sm">
                                                <div className="space-y-0.5">
                                                    <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Status de Presença Diário</h3>
                                                    <p className="text-[11px] text-slate-400 font-semibold">Acompanhe a lotação e as escalas de trabalho deste contrato.</p>
                                                </div>
                                                <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                                                    <Button variant="ghost" size="icon" onClick={handlePrevDay} className="h-7 w-7 rounded">
                                                        <ChevronLeft className="w-3.5 h-3.5 text-slate-655" />
                                                    </Button>
                                                    <input 
                                                        type="date" 
                                                        value={date} 
                                                        onChange={(e) => setDate(e.target.value)}
                                                        className="bg-transparent text-[11px] font-bold text-slate-700 px-2 outline-none cursor-pointer"
                                                    />
                                                    <Button variant="ghost" size="icon" onClick={handleNextDay} className="h-7 w-7 rounded">
                                                        <ChevronRight className="w-3.5 h-3.5 text-slate-655" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Metrics Cards Grid for Client */}
                                            {(() => {
                                                const dailyAtts = detailedData.attendances.filter((a: any) => 
                                                    format(new Date(a.date), "yyyy-MM-dd") === date
                                                );
                                                const scaleCount = dailyAtts.filter((a: any) => a.status !== "FOLGA").length;
                                                const presCount = dailyAtts.filter((a: any) => a.status === "PRESENTE_PONTO" || a.status === "PRESENTE_MANUAL").length;
                                                const lateCount = dailyAtts.filter((a: any) => a.status === "ATRASADO" || a.status === "AGUARDANDO").length;
                                                const covCount = dailyAtts.filter((a: any) => a.coveredBy).length;
                                                const vacCount = dailyAtts.filter((a: any) => a.status === "FALTA" && !a.coveredBy).length;

                                                return (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                                        <Card className="border-none shadow-sm bg-slate-900 text-white p-4 py-3 flex flex-col justify-between h-20">
                                                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-350">Postos em Escala</span>
                                                            <span className="text-xl font-black mt-1">{scaleCount}</span>
                                                        </Card>
                                                        <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Presentes</span>
                                                            <span className="text-xl font-black mt-1 text-emerald-600">{presCount}</span>
                                                        </Card>
                                                        <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Aguardando/Atrasados</span>
                                                            <span className="text-xl font-black mt-1 text-amber-600">{lateCount}</span>
                                                        </Card>
                                                        <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cobertos</span>
                                                            <span className="text-xl font-black mt-1 text-blue-600">{covCount}</span>
                                                        </Card>
                                                        <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Vagos (Sem Cobertura)</span>
                                                            <span className="text-xl font-black mt-1 text-red-600">{vacCount}</span>
                                                        </Card>
                                                    </div>
                                                );
                                            })()}

                                            {/* Daily attendances log list */}
                                            <Card className="border border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
                                                {(() => {
                                                    const dailyAtts = detailedData.attendances.filter((a: any) => 
                                                        format(new Date(a.date), "yyyy-MM-dd") === date
                                                    );

                                                    if (dailyAtts.length === 0) {
                                                        return (
                                                            <div className="text-center py-10 text-slate-400 font-semibold italic text-xs">
                                                                Nenhum apontamento operacional cadastrado neste dia.
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <Table>
                                                            <TableHeader className="bg-slate-50">
                                                                <TableRow>
                                                                    <TableHead className="font-bold text-slate-800 text-xs py-3.5 pl-6">Posto / Função</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs py-3.5">Escala</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs py-3.5">Horário</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs py-3.5">Colaborador Titular</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs py-3.5 text-center">Status</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs py-3.5">Cobertura</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {dailyAtts.map((att: any) => (
                                                                    <TableRow key={att.id} className="hover:bg-slate-50/50">
                                                                        <TableCell className="text-xs font-bold text-slate-800 py-3 pl-6">
                                                                            {att.posto?.role?.name || "Posto"}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-slate-500 font-bold py-3">
                                                                            {att.posto?.schedule}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-slate-500 font-medium py-3">
                                                                            {att.posto?.startTime} - {att.posto?.endTime}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-slate-700 font-semibold py-3">
                                                                            {att.employee?.name || "Vaga em Aberto"}
                                                                        </TableCell>
                                                                        <TableCell className="text-center py-3">
                                                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                                                                att.status === "PRESENTE_PONTO" || att.status === "PRESENTE_MANUAL" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                                                                att.status === "FALTA" ? "bg-red-50 text-red-700 border-red-200" :
                                                                                "bg-slate-100 text-slate-700 border-slate-200"
                                                                            }`}>
                                                                                {att.status === "FALTA" ? "Falta" : att.status === "FOLGA" ? "Folga" : "Presente"}
                                                                            </span>
                                                                        </TableCell>
                                                                        <TableCell className="text-xs font-bold text-indigo-650 py-3">
                                                                            {att.coveredBy ? `Coberto por ${att.coveredBy.name} (${att.coverageType})` : "-"}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    );
                                                })()}
                                            </Card>
                                        </div>
                                    )}

                                    {/* TAB 2: CENTRAL DE CHAMADOS INDIVIDUAL */}
                                    {activeTab === "requests" && detailedData && (
                                        <div className="space-y-6">
                                            <div className="space-y-0.5">
                                                <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Central de Solicitações do Cliente</h3>
                                                <p className="text-[11px] text-slate-400 font-semibold">Controle operacional e prazos acordados (SLA) para a conclusão de chamados.</p>
                                            </div>

                                            <Card className="border border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
                                                {detailedData.requests && detailedData.requests.length > 0 ? (
                                                    <Table>
                                                        <TableHeader className="bg-slate-50">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3.5 pl-6">Assunto / Descrição</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3.5">Tipo</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3.5 text-center">Status</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3.5">Solicitante</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3.5">Data</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3.5">Prazo SLA</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {detailedData.requests.map((r: any) => (
                                                                <TableRow key={r.id} className="hover:bg-slate-50/50">
                                                                    <TableCell className="text-xs font-bold text-slate-700 py-3 pl-6 max-w-xs truncate" title={r.description}>
                                                                        {r.description}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-slate-655 font-semibold py-3">
                                                                        {r.type === "MOVIMENTACAO" ? "Movimentação de Pessoal" : 
                                                                         r.type === "UNIFORME" ? "Solicitação de Uniforme" : "Outros Serviços"}
                                                                    </TableCell>
                                                                    <TableCell className="text-center py-3">
                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                                                            r.status === "CONCLUIDO" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                                                            r.status === "PENDENTE" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                                                            "bg-red-50 text-red-700 border-red-200"
                                                                        }`}>
                                                                            {r.status}
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-slate-655 font-semibold py-3">
                                                                        {r.requesterName}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-slate-500 py-3">
                                                                        {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs font-bold text-slate-700 py-3">
                                                                        {new Date(r.dueDate).toLocaleDateString("pt-BR")}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                ) : (
                                                    <div className="p-6 text-center text-slate-400 italic text-xs">
                                                        Nenhuma solicitação registrada pelo cliente para este contrato no mês selecionado.
                                                    </div>
                                                )}
                                            </Card>
                                        </div>
                                    )}

                                    {/* TAB 3: FATURAMENTO INDIVIDUAL E AJUSTES DE QUADRO */}
                                    {activeTab === "billing" && (
                                        <div className="space-y-6">
                                            {/* Cards do Contrato */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                <Card className="border-none shadow-sm bg-slate-900 text-white p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-350">Faturamento Bruto (Mensal)</span>
                                                    <span className="text-lg font-black mt-1">
                                                        {billingData[0]?.expectedBilling.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00"}
                                                    </span>
                                                </Card>
                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Desconto Glosas por Faltas</span>
                                                    <span className="text-lg font-black mt-1 text-red-600">
                                                        {billingData.reduce((sum, m) => sum + m.glosas, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                    </span>
                                                </Card>
                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Faturamento Líquido</span>
                                                    <span className="text-lg font-black mt-1 text-emerald-600">
                                                        {billingData.reduce((sum, m) => sum + m.netBilling, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                    </span>
                                                </Card>
                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Efetividade Operacional</span>
                                                    <span className="text-lg font-black mt-1 text-blue-600">
                                                        {(billingData.length > 0 
                                                            ? (billingData.reduce((sum, m) => sum + m.effectiveness, 0) / billingData.length).toFixed(1) 
                                                            : "100.0")}%
                                                    </span>
                                                </Card>
                                            </div>

                                            {/* Monthly billing breakdown */}
                                            <Card className="border border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
                                                <Table>
                                                    <TableHeader className="bg-slate-50">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3">Mês</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-right pr-6">Faturamento Previsto</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-right pr-6">Desconto de Glosas</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-right pr-6">Faturamento Líquido</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-center">Efetividade</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {billingData.map((m) => (
                                                            <TableRow key={m.monthIndex} className="hover:bg-slate-50/50">
                                                                <TableCell className="font-bold text-xs text-slate-900 py-3">{m.name}</TableCell>
                                                                <TableCell className="text-right pr-6 text-xs text-slate-700 font-semibold py-3">{formatCurrency(m.expectedBilling)}</TableCell>
                                                                <TableCell className="text-right pr-6 text-xs text-red-650 font-semibold py-3">-{formatCurrency(m.glosas)}</TableCell>
                                                                <TableCell className="text-right pr-6 text-xs text-emerald-600 font-black py-3">{formatCurrency(m.netBilling)}</TableCell>
                                                                <TableCell className="text-center text-xs font-black text-blue-600 py-3">{m.effectiveness.toFixed(1)}%</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </Card>

                                            {/* Posto Billing Management */}
                                            {detailedData && (
                                                <Card className="border border-slate-200 shadow-sm rounded-xl bg-white">
                                                    <CardHeader>
                                                        <CardTitle className="text-xs font-black uppercase text-slate-800 tracking-wider">Ajuste e Lançamento de Quadro (Faturamento por Posto)</CardTitle>
                                                        <CardDescription>Edite o faturamento dos postos. Glosas são geradas automaticamente na proporção de 1/30 avos por falta.</CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="p-0 border-t border-slate-100">
                                                        <Table>
                                                            <TableHeader className="bg-slate-50">
                                                                <TableRow>
                                                                    <TableHead className="font-bold text-slate-800 text-xs pl-6">Posto / Função</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs">Escala</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs text-right pr-6">Faturamento do Posto</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs text-center">Ações</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {detailedData.postos.map((p: any) => (
                                                                    <TableRow key={p.id} className="hover:bg-slate-50/50">
                                                                        <TableCell className="text-xs font-bold text-slate-700 pl-6 py-2.5">{p.role?.name}</TableCell>
                                                                        <TableCell className="text-xs text-slate-550 font-bold py-2.5">{p.schedule}</TableCell>
                                                                        <TableCell className="text-right pr-6 text-xs font-black text-slate-800 py-2.5">
                                                                            {editingPostoId === p.id ? (
                                                                                <Input 
                                                                                    type="number"
                                                                                    value={editBillingVal}
                                                                                    onChange={(e) => setEditBillingVal(Number(e.target.value))}
                                                                                    className="w-28 h-8 text-right font-bold inline-block"
                                                                                />
                                                                            ) : (
                                                                                formatCurrency(p.billingValue)
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell className="text-center py-2.5">
                                                                            {editingPostoId === p.id ? (
                                                                                <div className="flex justify-center gap-1">
                                                                                    <Button size="sm" onClick={() => handleSavePostoBilling(p.id)} className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold">Salvar</Button>
                                                                                    <Button size="sm" variant="outline" onClick={() => setEditingPostoId(null)} className="h-7 text-[10px] rounded font-bold">Cancelar</Button>
                                                                                </div>
                                                                            ) : (
                                                                                <Button size="sm" variant="ghost" onClick={() => { setEditingPostoId(p.id); setEditBillingVal(p.billingValue); }} className="h-7 text-xs font-semibold rounded hover:bg-slate-100">Editar</Button>
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </div>
                                    )}

                                    {/* TAB 4: RELATÓRIO MENSAL INDIVIDUAL (MONTHLY REPORT) */}
                                    {activeTab === "monthly_report" && detailedData && (
                                        <Card className="border border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
                                            <CardHeader>
                                                <CardTitle className="text-xs font-black uppercase text-slate-800">Relatório Completo de Lançamentos</CardTitle>
                                                <CardDescription>Log diário contendo os faturamentos previstos e eventuais glosas.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <Table>
                                                    <TableHeader className="bg-slate-50">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-slate-800 text-xs pl-6 py-3.5">Data</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3.5">Posto</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3.5">Colaborador</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3.5 text-center">Status</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-right pr-6 py-3.5">Valor da Glosa</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {detailedData.attendances.map((a: any) => {
                                                            const isGlosa = a.status === "FALTA" && !a.coveredById && !a.coverageType;
                                                            const glVal = isGlosa ? a.posto?.billingValue / 30 : 0;
                                                            return (
                                                                <TableRow key={a.id} className="hover:bg-slate-50/50">
                                                                    <TableCell className="text-xs text-slate-500 pl-6 py-3">{new Date(a.date).toLocaleDateString("pt-BR")}</TableCell>
                                                                    <TableCell className="text-xs font-bold text-slate-700 py-3">{a.posto?.role?.name}</TableCell>
                                                                    <TableCell className="text-xs text-slate-650 py-3">{a.employee?.name || "Vaga em Aberto"}</TableCell>
                                                                    <TableCell className="text-center py-3">
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                                                            isGlosa ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-100 text-slate-700 border-slate-200"
                                                                        }`}>
                                                                            {a.status === "FALTA" ? (isGlosa ? "Glosa" : "Coberto") : a.status === "FOLGA" ? "Folga" : "Presente"}
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell className="text-right pr-6 text-xs font-black text-red-600 py-3">
                                                                        {glVal > 0 ? `-${formatCurrency(glVal)}` : "R$ 0,00"}
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* TAB 5: NPS / AVALIAÇÃO INDIVIDUAL */}
                                    {activeTab === "nps" && detailedData && (
                                        <div className="space-y-6">
                                            {/* Configuração de perguntas */}
                                            <Card className="border border-slate-200 shadow-sm bg-white rounded-xl">
                                                <CardHeader className="flex flex-row items-center justify-between">
                                                    <div>
                                                        <CardTitle className="text-xs font-black uppercase text-slate-800 tracking-wider">Perguntas Configuradas do NPS</CardTitle>
                                                        <CardDescription>Customize o questionário que o cliente irá avaliar.</CardDescription>
                                                    </div>
                                                    <Button 
                                                        size="sm"
                                                        onClick={() => {
                                                            setEditingNpsQ(null);
                                                            setNpsQText("");
                                                            setNpsQWeight(1);
                                                            setNpsDialogOpen(true);
                                                        }}
                                                        className="gap-1 bg-slate-900 text-white font-bold text-xs rounded-xl"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" /> Adicionar Pergunta
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="p-0 border-t border-slate-100">
                                                    <Table>
                                                        <TableHeader className="bg-slate-50">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-slate-800 text-xs pl-6">Texto da Pergunta</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center w-24">Peso</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center w-28">Ações</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {detailedData.npsQuestions.map((q: any) => (
                                                                <TableRow key={q.id} className="hover:bg-slate-50/50">
                                                                    <TableCell className="text-xs font-bold text-slate-700 pl-6 py-3">{q.text}</TableCell>
                                                                    <TableCell className="text-center text-xs font-black py-3">{q.weight}</TableCell>
                                                                    <TableCell className="text-center py-3">
                                                                        <div className="flex justify-center gap-1">
                                                                            <Button size="sm" variant="ghost" onClick={() => { setEditingNpsQ(q); setNpsQText(q.text); setNpsQWeight(q.weight); setNpsDialogOpen(true); }} className="h-7 w-7 p-0 rounded hover:bg-slate-100">✏️</Button>
                                                                            <Button size="sm" variant="ghost" onClick={() => handleDeleteNpsQClick(q.id)} className="h-7 w-7 p-0 rounded hover:bg-red-50">🗑️</Button>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </CardContent>
                                            </Card>

                                            {/* Histórico de Respostas */}
                                            <Card className="border border-slate-200 shadow-sm bg-white rounded-xl">
                                                <CardHeader>
                                                    <CardTitle className="text-xs font-black uppercase text-slate-800 tracking-wider">Histórico de Notas do Cliente</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    {detailedData.npsResponses.length === 0 ? (
                                                        <div className="text-center py-6 text-slate-400 italic text-xs">Nenhum envio de NPS registrado este mês.</div>
                                                    ) : (
                                                        <div className="space-y-4">
                                                            {detailedData.npsResponses.map((r: any) => {
                                                                let sumS = 0; let sumW = 0;
                                                                r.answers.forEach((an: any) => {
                                                                    const w = an.question?.weight || 1.0;
                                                                    sumS += an.score * w; sumW += w;
                                                                });
                                                                const finalNpsVal = sumW > 0 ? sumS / sumW : 10;
                                                                return (
                                                                    <div key={r.id} className="p-3 rounded-lg border border-slate-200 space-y-2">
                                                                        <div className="flex justify-between items-center text-xs">
                                                                            <span className="font-bold text-slate-500">Enviado em {new Date(r.createdAt).toLocaleDateString('pt-BR')}</span>
                                                                            <span className="font-black text-blue-600">Nota Ponderada: {finalNpsVal.toFixed(1)}/10</span>
                                                                        </div>
                                                                        {r.feedback && (
                                                                            <p className="text-xs text-slate-650 bg-slate-50 p-2 rounded">"{r.feedback}"</p>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </div>
                                    )}

                                    {/* TAB 6: INDICADORES KPIS INDIVIDUAIS */}
                                    {activeTab === "kpis" && clientKpiData && (
                                        <div className="space-y-6">
                                            {/* KPIs Grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Efetividade Escala</span>
                                                    <span className="text-xl font-black mt-1 text-emerald-600">{clientKpiData.summary?.effectiveness?.toFixed(1) || "100.0"}%</span>
                                                </Card>
                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cumprimento SLA</span>
                                                    <span className="text-xl font-black mt-1 text-blue-600">{clientKpiData.summary?.slaCompliance?.toFixed(1) || "100.0"}%</span>
                                                </Card>
                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Nota NPS Média</span>
                                                    <span className="text-xl font-black mt-1 text-amber-500">{clientKpiData.summary?.npsRating?.toFixed(1) || "10.0"}/10</span>
                                                </Card>
                                                <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Nível Absenteísmo</span>
                                                    <span className="text-xl font-black mt-1 text-red-500">{clientKpiData.summary?.absenteism?.toFixed(1) || "0.0"}%</span>
                                                </Card>
                                            </div>

                                            {/* Item by Item NPS History */}
                                            <Card className="border border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
                                                <CardHeader>
                                                    <CardTitle className="text-xs font-black uppercase text-slate-800">Evolução NPS por Item Avaliado</CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-0 border-t border-slate-100">
                                                    {clientKpiData.npsEvolution && clientKpiData.npsEvolution.length > 0 ? (
                                                        <Table>
                                                            <TableHeader className="bg-slate-50">
                                                                <TableRow>
                                                                    <TableHead className="font-bold text-slate-800 text-xs pl-6 py-3">Quesito / Pergunta</TableHead>
                                                                    {monthNames.map((m, i) => (
                                                                        <TableHead key={i} className="font-bold text-slate-800 text-xs text-center py-3">{m}</TableHead>
                                                                    ))}
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                    {clientKpiData.npsEvolution.map((item: any) => (
                                                                        <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                                            <TableCell className="text-xs font-bold text-slate-700 pl-6 py-3 max-w-[280px] truncate" title={item.text}>{item.text}</TableCell>
                                                                            {item.monthlyScores.map((score: number | null, sIdx: number) => (
                                                                                <TableCell key={sIdx} className="text-xs text-center py-3">
                                                                                    {score !== null ? (
                                                                                        <span className={`px-2 py-0.5 rounded font-black text-[11px] ${
                                                                                            score >= 9 ? "bg-emerald-50 text-emerald-600" :
                                                                                            score >= 7 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                                                                                        }`}>{score.toFixed(1)}</span>
                                                                                    ) : <span className="text-slate-300">-</span>}
                                                                                </TableCell>
                                                                            ))}
                                                                        </TableRow>
                                                                    ))}
                                                            </TableBody>
                                                        </Table>
                                                    ) : (
                                                        <div className="text-center py-10 text-slate-400 italic text-xs">Nenhum feedback consolidado no período.</div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </div>
                                    )}

                                    {/* TAB 7: SLA / DESEMPENHO INDIVIDUAL */}
                                    {activeTab === "sla" && detailedData && (
                                        <div className="space-y-6">
                                            <Card className="border border-slate-200 shadow-sm bg-white rounded-xl">
                                                <CardHeader className="flex flex-row items-center justify-between">
                                                    <div>
                                                        <CardTitle className="text-xs font-black uppercase text-slate-800 tracking-wider">Parametrização de SLAs e Notas Mensais</CardTitle>
                                                        <CardDescription>Crie itens de SLA, pesos ponderados e lance as notas manuais.</CardDescription>
                                                    </div>
                                                    <Button 
                                                        size="sm"
                                                        onClick={() => {
                                                            setEditingSlaItem(null);
                                                            setSlaName("");
                                                            setSlaMetricType("EFETIVIDADE");
                                                            setSlaWeight(1);
                                                            setSlaTarget(90);
                                                            setSlaDialogOpen(true);
                                                        }}
                                                        className="gap-1 bg-slate-900 text-white font-bold text-xs rounded-xl"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" /> Adicionar SLA
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="p-0 border-t border-slate-100">
                                                    <Table>
                                                        <TableHeader className="bg-slate-50">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-slate-800 text-xs pl-6 py-3">Indicador</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3">Métrica</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center py-3">Meta (%)</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center py-3">Peso</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-right pr-6 py-3">Nota Lançada</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center py-3">Ações</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {detailedData.slaConfigItems.map((item: any) => {
                                                                const mVal = item.monthlyValues[0]?.value;
                                                                return (
                                                                    <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                                        <TableCell className="text-xs font-bold text-slate-700 pl-6 py-3">{item.name}</TableCell>
                                                                        <TableCell className="text-xs text-slate-500 font-semibold py-3">
                                                                            {item.metricType === "MANUAL" ? "Lançamento Manual" : 
                                                                             item.metricType === "EFETIVIDADE" ? "Efetividade Escala" :
                                                                             item.metricType === "SLA_CHAMADOS" ? "Chamados no Prazo" : "Nota NPS"}
                                                                        </TableCell>
                                                                        <TableCell className="text-center text-xs font-bold py-3">{item.targetValue}%</TableCell>
                                                                        <TableCell className="text-center text-xs font-bold py-3">{item.weight}</TableCell>
                                                                        <TableCell className="text-right pr-6 py-3 text-xs">
                                                                            {item.metricType === "MANUAL" ? (
                                                                                editingSlaValueId === item.id ? (
                                                                                    <div className="flex justify-end items-center gap-1">
                                                                                        <Input type="number" value={manualSlaValue} onChange={(e) => setManualSlaValue(Number(e.target.value))} className="w-16 h-7 text-right" />
                                                                                        <Button size="sm" onClick={() => handleSaveManualSlaValue(item.id)} className="h-7 bg-emerald-650 text-white rounded">✓</Button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex justify-end items-center gap-1.5 font-black text-slate-850">
                                                                                        <span>{mVal !== undefined ? `${mVal}%` : "Pendente"}</span>
                                                                                        <Button size="sm" variant="ghost" onClick={() => { setEditingSlaValueId(item.id); setManualSlaValue(mVal || item.targetValue); }} className="h-6 w-6 p-0 rounded">✏️</Button>
                                                                                    </div>
                                                                                )
                                                                            ) : <span className="text-slate-400 italic">Automático</span>}
                                                                        </TableCell>
                                                                        <TableCell className="text-center py-3">
                                                                            <div className="flex justify-center gap-1">
                                                                                <Button size="sm" variant="ghost" onClick={() => { setEditingSlaItem(item); setSlaName(item.name); setSlaMetricType(item.metricType); setSlaWeight(item.weight); setSlaTarget(item.targetValue); setSlaDialogOpen(true); }} className="h-7 w-7 p-0 rounded">✏️</Button>
                                                                                <Button size="sm" variant="ghost" onClick={() => handleDeleteSlaItemClick(item.id)} className="h-7 w-7 p-0 rounded hover:bg-red-50">🗑️</Button>
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    )}

                                    {/* TAB 8: PLANO DE SERVIÇOS INDIVIDUAL */}
                                    {activeTab === "service_plan" && detailedData && (
                                        <div className="space-y-6">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/50 shadow-sm">
                                                <div className="space-y-0.5">
                                                    <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Instruções de Trabalho por Posto</h3>
                                                    <p className="text-[11px] text-slate-400 font-semibold">Consulte as rotinas diárias e atividades cadastradas.</p>
                                                </div>
                                                <select
                                                    value={selectedPostoId}
                                                    onChange={(e) => setSelectedPostoId(e.target.value)}
                                                    className="h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold px-3 outline-none cursor-pointer"
                                                >
                                                    {detailedData.postos.map((p: any) => (
                                                        <option key={p.id} value={p.id}>{p.role?.name || "Posto"} ({p.schedule})</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <Card className="border border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
                                                <CardContent className="p-0">
                                                    {loadingRoutines ? (
                                                        <div className="text-center py-10 text-slate-450 italic text-xs animate-pulse">Carregando rotinas...</div>
                                                    ) : routines.length === 0 ? (
                                                        <div className="text-center py-10 text-slate-400 font-semibold italic text-xs">Nenhuma rotina associada a este posto.</div>
                                                    ) : (
                                                        <Table>
                                                            <TableHeader className="bg-slate-50">
                                                                <TableRow>
                                                                    <TableHead className="font-bold text-slate-800 text-xs pl-6">Horário</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs">Duração</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs">Local</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs">Descrição da Atividade</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {routines.map((r: any) => (
                                                                    <TableRow key={r.id} className="hover:bg-slate-50/50">
                                                                        <TableCell className="text-xs font-bold text-slate-700 pl-6 py-3">{r.startTime} - {r.endTime}</TableCell>
                                                                        <TableCell className="text-xs text-slate-500 font-semibold py-3">{r.duration}</TableCell>
                                                                        <TableCell className="text-xs text-slate-700 font-semibold py-3">{r.location}</TableCell>
                                                                        <TableCell className="text-xs text-slate-600 font-medium py-3">{r.activity}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Visit Form Dialog */}
            <Dialog open={logVisitOpen} onOpenChange={setLogVisitOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={handleSaveVisit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="text-md font-bold text-slate-800">Registrar Visita ao Contrato</DialogTitle>
                            <DialogDescription>Insira o apontamento da visita comercial realizada.</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            {selectedClientId === "all" && (
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-650">Selecione o Contrato *</Label>
                                    <select
                                        value={visitClientId}
                                        onChange={(e) => setVisitClientId(e.target.value)}
                                        className="w-full h-10 border border-slate-200 rounded-xl text-xs font-semibold px-3 outline-none focus:border-primary bg-white"
                                        required
                                    >
                                        <option value="">-- Selecione um Contrato --</option>
                                        {initialClients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-655">Visitante *</Label>
                                    <Input
                                        placeholder="Nome"
                                        value={visitorName}
                                        onChange={(e) => setVisitorName(e.target.value)}
                                        className="h-10 rounded-xl"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-655">Cargo *</Label>
                                    <select
                                        value={visitorRole}
                                        onChange={(e) => setVisitorRole(e.target.value)}
                                        className="w-full h-10 border border-slate-200 rounded-xl text-xs font-semibold px-3 outline-none focus:border-primary bg-white"
                                        required
                                    >
                                        <option value="SUPERVISOR">Supervisor</option>
                                        <option value="GERENTE">Gerente</option>
                                        <option value="DIRETOR">Diretor</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Data *</Label>
                                <Input
                                    type="date"
                                    value={visitDate}
                                    onChange={(e) => setVisitDate(e.target.value)}
                                    className="h-10 rounded-xl"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Observações</Label>
                                <textarea
                                    placeholder="Destaque as observações..."
                                    rows={3}
                                    value={visitNotes}
                                    onChange={(e) => setVisitNotes(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl text-xs font-semibold p-3 outline-none focus:border-primary resize-none"
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-2 border-t border-slate-105">
                            <Button type="button" variant="outline" onClick={() => setLogVisitOpen(false)} className="h-10 text-xs font-bold rounded-xl">Cancelar</Button>
                            <Button type="submit" disabled={savingVisit} className="h-10 text-xs font-bold rounded-xl bg-blue-650 text-white hover:bg-blue-700">
                                {savingVisit ? "Salvando..." : "Registrar"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* SLA Config Dialog */}
            <Dialog open={slaDialogOpen} onOpenChange={setSlaDialogOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={handleSaveSlaItem} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="text-md font-bold text-slate-800">
                                {editingSlaItem ? "Editar SLA" : "Adicionar SLA"}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Nome do Indicador *</Label>
                                <Input
                                    placeholder="Ex: Pontualidade"
                                    value={slaName}
                                    onChange={(e) => setSlaName(e.target.value)}
                                    className="h-10 rounded-xl"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Origem da Métrica *</Label>
                                <select
                                    value={slaMetricType}
                                    onChange={(e) => setSlaMetricType(e.target.value)}
                                    className="w-full h-10 border border-slate-200 rounded-xl text-xs font-semibold px-3 outline-none bg-white"
                                    required
                                >
                                    <option value="EFETIVIDADE">Automático: Efetividade de Escala</option>
                                    <option value="SLA_CHAMADOS">Automático: Chamados no Prazo</option>
                                    <option value="NPS">Automático: Nota NPS do Cliente</option>
                                    <option value="MANUAL">Lançamento Manual</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-655">Meta (%) *</Label>
                                    <Input
                                        type="number"
                                        value={slaTarget}
                                        onChange={(e) => setSlaTarget(Number(e.target.value))}
                                        className="h-10 rounded-xl"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-655">Peso *</Label>
                                    <Input
                                        type="number"
                                        value={slaWeight}
                                        onChange={(e) => setSlaWeight(Number(e.target.value))}
                                        className="h-10 rounded-xl"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="pt-2 border-t border-slate-100">
                            <Button type="button" variant="outline" onClick={() => setSlaDialogOpen(false)} className="h-10 text-xs font-bold rounded-xl">Cancelar</Button>
                            <Button type="submit" disabled={savingSla} className="h-10 text-xs font-bold rounded-xl bg-blue-650 text-white hover:bg-blue-700">Salvar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* NPS Question Dialog */}
            <Dialog open={npsDialogOpen} onOpenChange={setNpsDialogOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={handleSaveNpsQ} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="text-md font-bold text-slate-800">
                                {editingNpsQ ? "Editar Pergunta NPS" : "Adicionar Pergunta NPS"}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Pergunta *</Label>
                                <textarea
                                    placeholder="Ex: Qualidade do atendimento?"
                                    rows={3}
                                    value={npsQText}
                                    onChange={(e) => setNpsQText(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl text-xs font-semibold p-3 outline-none resize-none"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Peso *</Label>
                                <Input
                                    type="number"
                                    value={npsQWeight}
                                    onChange={(e) => setNpsQWeight(Number(e.target.value))}
                                    className="h-10 rounded-xl"
                                    required
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-2 border-t border-slate-100">
                            <Button type="button" variant="outline" onClick={() => setNpsDialogOpen(false)} className="h-10 text-xs font-bold rounded-xl">Cancelar</Button>
                            <Button type="submit" disabled={savingNpsQ} className="h-10 text-xs font-bold rounded-xl bg-blue-650 text-white hover:bg-blue-700">Salvar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
