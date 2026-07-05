"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { toast } from "sonner";
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
    Activity, Plus, Clock, Save, Info, AlertTriangle, 
    CheckCircle2, TrendingUp, TrendingDown, Star, Landmark, 
    Trash2, Edit3, Settings, ShieldCheck, HelpCircle, 
    Inbox, FileText, Smile, BarChart2, ClipboardList, 
    ChevronLeft, ChevronRight, RefreshCw, X, Download 
} from "lucide-react";

interface PerformanceDashboardProps {
    initialClients: any[];
    userRole: string;
}

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function PerformanceDashboard({ initialClients, userRole }: PerformanceDashboardProps) {
    const [selectedClientId, setSelectedClientId] = useState<string>("all");
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [date, setDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));

    // Active sub-tab (mimicking client dashboard menu: presence, requests, billing, monthly_report, nps, kpis, sla, service_plan)
    const [activeTab, setActiveTab] = useState<"presence" | "requests" | "billing" | "monthly_report" | "nps" | "kpis" | "sla" | "service_plan">("presence");

    // Consolidated View Data
    const [consolidatedData, setConsolidatedData] = useState<any>(null);
    const [loadingConsolidated, setLoadingConsolidated] = useState<boolean>(false);

    // Single Client KPI History (kpis tab)
    const [clientKpiData, setClientKpiData] = useState<any>(null);
    const [loadingClientKpis, setLoadingClientKpis] = useState<boolean>(false);

    // Single Client Billing History (billing tab)
    const [billingData, setBillingData] = useState<any[]>([]);
    const [loadingBilling, setLoadingBilling] = useState<boolean>(false);

    // Single Client Details (lazy loaded for detailed operations)
    const [detailedData, setDetailedData] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

    // Posto routines for Plan of Services
    const [selectedPostoId, setSelectedPostoId] = useState<string>("");
    const [routines, setRoutines] = useState<any[]>([]);
    const [loadingRoutines, setLoadingRoutines] = useState<boolean>(false);

    // Visit Dialog State
    const [logVisitOpen, setLogVisitOpen] = useState<boolean>(false);
    const [visitClientId, setVisitClientId] = useState<string>("");
    const [visitorName, setVisitorName] = useState<string>("");
    const [visitorRole, setVisitorRole] = useState<string>("SUPERVISOR");
    const [visitDate, setVisitDate] = useState<string>(new Date().toISOString().substring(0, 10));
    const [visitNotes, setVisitNotes] = useState<string>("");
    const [savingVisit, setSavingVisit] = useState<boolean>(false);

    // Posto Billing Edit State
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

    // SLA Manual Value State
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
                toast.error("Erro de conexão ao carregar dados.");
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
                if (res.postos && res.postos.length > 0 && !selectedPostoId) {
                    setSelectedPostoId(res.postos[0].id);
                }
            } else {
                toast.error("Erro ao carregar detalhes operacionais do contrato.");
            }
        } catch (e) {
            toast.error("Erro de conexão ao carregar detalhes.");
        } finally {
            setLoadingDetails(false);
        }
    }, [selectedClientId, selectedYear, selectedMonth, selectedPostoId]);

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
                toast.error("Erro ao carregar demonstrativo de faturamento.");
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
            toast.error("Erro ao carregar rotinas de trabalho.");
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
            toast.error("Por favor, preencha todos os campos obrigatórios.");
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
                toast.success("Visita registrada com sucesso!");
                setLogVisitOpen(false);
                setVisitorName("");
                setVisitNotes("");
                loadPerformanceData();
                loadClientDetails();
            } else {
                toast.error("Erro ao registrar visita.");
            }
        } catch (e) {
            toast.error("Erro de conexão ao salvar visita.");
        } finally {
            setSavingVisit(false);
        }
    };

    // Billing Handlers
    const handleSavePostoBilling = async (postoId: string) => {
        try {
            const res = await updatePostoBilling(postoId, editBillingVal);
            if (res.success) {
                toast.success("Faturamento do posto atualizado com sucesso!");
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
                toast.success("Quesito de SLA salvo com sucesso!");
                setSlaDialogOpen(false);
                setSlaName("");
                setEditingSlaItem(null);
                loadPerformanceData();
                loadClientDetails();
            } else {
                toast.error("Erro ao salvar quesito de SLA.");
            }
        } catch (e) {
            toast.error("Erro de conexão.");
        } finally {
            setSavingSla(false);
        }
    };

    const handleDeleteSlaItemClick = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este item de SLA?")) return;
        try {
            const res = await deleteSlaConfigItem(id);
            if (res.success) {
                toast.success("Quesito excluído.");
                loadPerformanceData();
                loadClientDetails();
            } else {
                toast.error("Erro ao deletar.");
            }
        } catch (e) {
            toast.error("Erro de conexão.");
        }
    };

    const handleSaveManualSlaValue = async (configItemId: string) => {
        try {
            const res = await updateSlaMonthlyValue(configItemId, selectedMonth, selectedYear, manualSlaValue);
            if (res.success) {
                toast.success("Nota manual registrada.");
                setEditingSlaValueId(null);
                loadPerformanceData();
                loadClientDetails();
            } else {
                toast.error("Erro ao salvar nota manual.");
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
                toast.success("Pergunta NPS salva com sucesso!");
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
        if (!confirm("Tem certeza que deseja excluir esta pergunta do questionário NPS?")) return;
        try {
            const res = await deleteNpsQuestion(id);
            if (res.success) {
                toast.success("Pergunta NPS excluída.");
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

    const menuItems = [
        { id: "presence", label: "Status de Presença", icon: Calendar },
        { id: "requests", label: "Central de Chamados", icon: Inbox },
        { id: "billing", label: "Demonstrativo Faturamento", icon: DollarSign },
        { id: "monthly_report", label: "Relatório de Lançamentos", icon: FileText },
        { id: "nps", label: "NPS / Avaliação", icon: Smile },
        { id: "kpis", label: "Indicadores (KPIs)", icon: BarChart2 },
        { id: "sla", label: "SLA / Desempenho", icon: Award },
        { id: "service_plan", label: "Plano de Serviços", icon: ClipboardList }
    ];

    return (
        <div className="space-y-6">
            {/* Header com Filtros Gerais */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-premium">
                <div className="space-y-1">
                    <h1 className="text-xl font-black uppercase tracking-wider text-primary">Painel de Gestão e Performance</h1>
                    <p className="text-xs text-slate-400 font-medium">Controle total de faturamentos, parametrizações operacionais e relatórios consolidados.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={selectedClientId}
                        onChange={(e) => {
                            setSelectedClientId(e.target.value);
                            setActiveTab("presence");
                        }}
                        className="h-10 rounded-xl border border-slate-700 bg-slate-800 text-white text-xs font-bold px-3 outline-none cursor-pointer shadow-premium"
                    >
                        <option value="all">📊 Todos os Contratos (Consolidado)</option>
                        {initialClients.map((c) => (
                            <option key={c.id} value={c.id}>🏢 {c.name}</option>
                        ))}
                    </select>

                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="h-10 rounded-xl border border-slate-700 bg-slate-800 text-white text-xs font-bold px-3 outline-none cursor-pointer shadow-premium"
                    >
                        {monthNames.map((name, i) => (
                            <option key={i} value={i}>{name}</option>
                        ))}
                    </select>

                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="h-10 rounded-xl border border-slate-700 bg-slate-800 text-white text-xs font-bold px-3 outline-none cursor-pointer shadow-premium"
                    >
                        <option value={2026}>2026</option>
                        <option value={2025}>2025</option>
                    </select>
                </div>
            </div>

            {selectedClientId === "all" ? (
                /* ================= VISÃO CONSOLIDADA (GRUPO) ================= */
                <div className="space-y-6">
                    {/* Grid de Cards de Métricas Consolidadas */}
                    {loadingConsolidated ? (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {[...Array(4)].map((_, i) => (
                                <Card key={i} className="animate-pulse bg-white border border-slate-100 p-6 rounded-2xl h-28" />
                            ))}
                        </div>
                    ) : consolidatedData ? (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <Card className="bg-white border-slate-200/60 shadow-sm relative overflow-hidden rounded-2xl">
                                <CardContent className="pt-6 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">SLA Geral do Grupo</span>
                                        <Award className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-2xl font-black text-slate-800">
                                            {consolidatedData.avgSlaCombined ? consolidatedData.avgSlaCombined.toFixed(1) : "0.0"}%
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-semibold text-slate-500">Média geral ponderada de conformidade</p>
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-slate-200/60 shadow-sm relative overflow-hidden rounded-2xl">
                                <CardContent className="pt-6 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">NPS Consolidado</span>
                                        <Star className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className={`text-2xl font-black ${
                                            consolidatedData.groupNpsScore >= 50 ? "text-emerald-600" :
                                            consolidatedData.groupNpsScore >= 0 ? "text-amber-500" : "text-red-500"
                                        }`}>
                                            {consolidatedData.groupNpsScore ? (consolidatedData.groupNpsScore > 0 ? "+" : "") + consolidatedData.groupNpsScore.toFixed(0) : "100"}
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-semibold text-slate-500">
                                        {consolidatedData.groupNpsCount || 0} avaliações respondidas no mês
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-slate-200/60 shadow-sm relative overflow-hidden rounded-2xl">
                                <CardContent className="pt-6 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Faturamento do Grupo</span>
                                        <DollarSign className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-2xl font-black text-slate-800">
                                            {formatCurrency(consolidatedData.totalBilling || 0)}
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-semibold text-slate-500">Soma de todos os contratos ativos</p>
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-slate-200/60 shadow-sm relative overflow-hidden rounded-2xl">
                                <CardContent className="pt-6 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Headcount / Cobertura</span>
                                        <Users className="w-5 h-5 text-indigo-500" />
                                    </div>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-2xl font-black text-slate-800">
                                            {consolidatedData.activeHeadcount || 0} / { (consolidatedData.activeHeadcount || 0) + (consolidatedData.vacantSlotsCombined || 0) }
                                        </span>
                                        <span className="text-xs text-red-500 font-bold">
                                            ({consolidatedData.vacantSlotsCombined || 0} vagas)
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-semibold text-slate-500">Efetividade: {consolidatedData.avgEffectivenessCombined?.toFixed(1)}%</p>
                                </CardContent>
                            </Card>
                        </div>
                    ) : null}

                    {/* Gráfico da Curva ABC e Tabela */}
                    {consolidatedData && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <Card className="lg:col-span-1 border-slate-200/60 shadow-sm rounded-2xl">
                                <CardHeader>
                                    <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider">Distribuição da Curva ABC</CardTitle>
                                    <CardDescription>Classificação de Pareto com base no faturamento mensal.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {["A", "B", "C"].map(letter => {
                                        const clientsInClass = consolidatedData.clients.filter((c: any) => c.class === letter);
                                        const classBilling = clientsInClass.reduce((sum: number, c: any) => sum + c.billing, 0);
                                        const pct = consolidatedData.totalBilling > 0 ? (classBilling / consolidatedData.totalBilling) * 100 : 0;
                                        
                                        let classColor = "bg-emerald-600";
                                        let label = "Classe A (VIP - Top 70%)";
                                        if (letter === "B") {
                                            classColor = "bg-amber-500";
                                            label = "Classe B (Médio - 20%)";
                                        } else if (letter === "C") {
                                            classColor = "bg-slate-500";
                                            label = "Classe C (Operacional - 10%)";
                                        }

                                        return (
                                            <div key={letter} className="space-y-1.5 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="font-bold text-slate-700">{label}</span>
                                                    <span className="font-black text-slate-900">{formatCurrency(classBilling)} ({pct.toFixed(0)}%)</span>
                                                </div>
                                                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                                    <div className={`${classColor} h-full`} style={{ width: `${pct}%` }} />
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-semibold">{clientsInClass.length} contratos ativos nesta classe</p>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>

                            <Card className="lg:col-span-2 border-slate-200/60 shadow-sm rounded-2xl">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider">Controle Geral de Contratos e Visitas</CardTitle>
                                        <CardDescription>Resumo de SLA, NPS, classificação de faturamento e semáforo da régua de visitas.</CardDescription>
                                    </div>
                                    <Button size="sm" onClick={() => {
                                        if (initialClients.length > 0) {
                                            setVisitClientId(initialClients[0].id);
                                            setLogVisitOpen(true);
                                        }
                                    }} className="gap-1 bg-primary text-slate-900 hover:bg-primary/90 font-bold text-xs rounded-xl shadow-premium">
                                        <Plus className="w-4 h-4" /> Registrar Visita
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto border border-slate-100 rounded-xl">
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="font-bold text-slate-800 text-xs">Contrato</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs text-center">Curva ABC</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs text-right">Faturamento</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs text-center">SLA (%)</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs text-center">NPS (Média)</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs text-center">Vagas</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs text-center">Visitas (S / G / D)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {consolidatedData.clients.map((c: any) => {
                                                    const renderLight = (status: "OK" | "WARNING" | "CRITICAL", label: string) => {
                                                        let color = "bg-emerald-500 border-emerald-600 shadow-emerald-100";
                                                        if (status === "WARNING") color = "bg-amber-400 border-amber-500 shadow-amber-100";
                                                        else if (status === "CRITICAL") color = "bg-red-500 border-red-600 shadow-red-100";
                                                        return (
                                                            <span 
                                                                title={`${label}: Status ${status}`}
                                                                className={`inline-block w-3.5 h-3.5 rounded-full border shadow-sm ${color}`}
                                                            />
                                                        );
                                                    };

                                                    return (
                                                        <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <TableCell className="py-3">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedClientId(c.id);
                                                                        setActiveTab("presence");
                                                                    }}
                                                                    className="text-xs font-bold text-slate-700 hover:text-primary transition-colors text-left"
                                                                >
                                                                    {c.name}
                                                                </button>
                                                                <p className="text-[10px] text-slate-400 font-semibold">{c.companyName}</p>
                                                            </TableCell>
                                                            <TableCell className="text-center py-3">
                                                                <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${
                                                                    c.class === "A" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                                                    c.class === "B" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                                                    "bg-slate-100 text-slate-700 border-slate-200"
                                                                }`}>
                                                                    {c.class}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs font-bold text-slate-800 py-3">
                                                                {formatCurrency(c.billing)}
                                                            </TableCell>
                                                            <TableCell className="text-center py-3">
                                                                <span className={`px-2 py-0.5 rounded font-black text-xs ${
                                                                    c.slaCompliance >= 90 ? "bg-emerald-50 text-emerald-600" :
                                                                    c.slaCompliance >= 80 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                                                                }`}>
                                                                    {c.slaCompliance.toFixed(1)}%
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-center py-3">
                                                                <span className="text-xs font-bold text-slate-700">
                                                                    {c.npsCount > 0 ? `${c.npsRating.toFixed(1)}/10` : "-"}
                                                                </span>
                                                                {c.npsCount > 0 && (
                                                                    <p className="text-[9px] text-slate-400 font-semibold">({c.npsCount} envios)</p>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-center text-xs font-black text-slate-800 py-3">
                                                                {c.vacantSlots > 0 ? (
                                                                    <span className="text-red-500">{c.vacantSlots} / {c.totalSlots}</span>
                                                                ) : (
                                                                    <span className="text-slate-500">{c.vacantSlots} / {c.totalSlots}</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-center py-3">
                                                                <div className="flex justify-center items-center gap-1.5">
                                                                    {renderLight(c.visitCompliance.supervisor.status, "Supervisor")}
                                                                    {renderLight(c.visitCompliance.gerente.status, "Gerente")}
                                                                    {renderLight(c.visitCompliance.diretor.status, "Diretor")}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            ) : (
                /* ================= PORTAL DO CLIENTE FRAME (GESTÃO COMPLETA) ================= */
                <div className="flex flex-col md:flex-row bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-premium min-h-[680px]">
                    {/* Lateral Navigation (Same as Client Sidebar) */}
                    <aside className="w-full md:w-60 bg-slate-900 text-white flex flex-col border-r border-slate-800 shrink-0">
                        <div className="p-4 border-b border-slate-800 bg-slate-950/40">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Visão do Cliente (Editável)</span>
                            <span className="text-xs font-bold text-slate-200 mt-1 block">
                                {initialClients.find(cl => cl.id === selectedClientId)?.name}
                            </span>
                        </div>
                        <nav className="flex-1 p-3 space-y-1">
                            {menuItems.map((item) => {
                                const Icon = item.icon;
                                const active = activeTab === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveTab(item.id as any)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-left ${
                                            active
                                                ? "bg-primary text-slate-900 shadow-md shadow-primary/20 font-black"
                                                : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                                        }`}
                                    >
                                        <Icon className="w-4 h-4 shrink-0" />
                                        <span>{item.label}</span>
                                    </button>
                                );
                            })}
                        </nav>
                        <div className="p-3 border-t border-slate-800">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setSelectedClientId("all")}
                                className="w-full h-9 text-xs font-bold text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white rounded-xl"
                            >
                                ⬅ Voltar Consolidados
                            </Button>
                        </div>
                    </aside>

                    {/* Main Active Tab Content */}
                    <main className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50">
                        {loadingDetails || loadingClientKpis || loadingBilling ? (
                            <div className="text-center py-20 text-slate-450 italic font-semibold text-xs animate-pulse">
                                Buscando dados e gerando relatórios operacionais do contrato...
                            </div>
                        ) : (
                            <div>
                                {/* TAB 1: STATUS DE PRESENÇA (PRESENCE) */}
                                {activeTab === "presence" && detailedData && (
                                    <div className="space-y-6">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/50 shadow-sm">
                                            <div className="space-y-0.5">
                                                <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Status de Presença Diário</h3>
                                                <p className="text-[11px] text-slate-400 font-medium">Monitore a escala e conformidade de postos em tempo real.</p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
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
                                        </div>

                                        {/* Attendance Log Table */}
                                        <Card className="border-slate-200 shadow-sm rounded-xl">
                                            <CardContent className="p-0">
                                                {(() => {
                                                    const dailyAtts = detailedData.attendances.filter((a: any) => 
                                                        format(new Date(a.date), "yyyy-MM-dd") === date
                                                    );

                                                    if (dailyAtts.length === 0) {
                                                        return (
                                                            <div className="text-center py-10 text-slate-400 font-semibold italic text-xs">
                                                                Nenhum registro de presença para este dia.
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
                                                                        <TableCell className="text-xs font-bold text-slate-700 py-3 pl-6">
                                                                            {att.posto?.role?.name || "Posto"}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-slate-655 font-semibold py-3">
                                                                            {att.posto?.schedule}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-slate-655 font-medium py-3">
                                                                            {att.posto?.startTime} - {att.posto?.endTime}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-slate-700 font-medium py-3">
                                                                            {att.employee?.name || "Vaga em Aberto"}
                                                                        </TableCell>
                                                                        <TableCell className="text-center py-3">
                                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                                                                att.status === "PRESENTE_PONTO" || att.status === "PRESENTE_MANUAL" ? "bg-emerald-50 text-emerald-700 border-emerald-250" :
                                                                                att.status === "FALTA" ? "bg-red-50 text-red-700 border-red-250" :
                                                                                "bg-slate-100 text-slate-700 border-slate-200"
                                                                            }`}>
                                                                                {att.status === "FALTA" ? "Falta" : att.status === "FOLGA" ? "Folga" : "Presente"}
                                                                            </span>
                                                                        </TableCell>
                                                                        <TableCell className="text-xs font-bold py-3 text-indigo-600">
                                                                            {att.coveredBy ? `Coberto por ${att.coveredBy.name} (${att.coverageType})` : "-"}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    );
                                                })()}
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* TAB 2: CENTRAL DE CHAMADOS (REQUESTS) */}
                                {activeTab === "requests" && (
                                    <div className="space-y-6">
                                        <div className="space-y-1">
                                            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Central de Solicitações do Cliente</h3>
                                            <p className="text-[11px] text-slate-400 font-medium">Chamados registrados, prazos acordados em contrato e resoluções.</p>
                                        </div>

                                        <Card className="border-slate-200 shadow-sm rounded-xl">
                                            <CardContent className="p-0">
                                                {detailedData?.requests && detailedData.requests.length > 0 ? (
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
                                                                    <TableCell className="text-xs text-slate-500 font-medium py-3">
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
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* TAB 3: DEMONSTRATIVO FATURAMENTO (BILLING) */}
                                {activeTab === "billing" && (
                                    <div className="space-y-6">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/50 shadow-sm">
                                            <div className="space-y-0.5">
                                                <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Faturamento Mensal e Efetividade</h3>
                                                <p className="text-[11px] text-slate-400 font-medium">Demonstrativo consolidado de faturamento e glosas por faltas não cobertas.</p>
                                            </div>
                                        </div>

                                        {/* Billing Metrics Cards Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <Card className="border-none shadow-sm bg-slate-900 text-white p-4 py-3 flex flex-col justify-between h-20">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Bruto Previsto (Mensal)</span>
                                                <span className="text-lg font-black leading-none mt-1">
                                                    {billingData[0]?.expectedBilling.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00"}
                                                </span>
                                            </Card>

                                            <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total de Glosas (Acumulado)</span>
                                                <span className="text-lg font-black leading-none mt-1 text-red-600">
                                                    {billingData.reduce((sum, m) => sum + m.glosas, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                </span>
                                            </Card>

                                            <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total Líquido (Acumulado)</span>
                                                <span className="text-lg font-black leading-none mt-1 text-emerald-600">
                                                    {billingData.reduce((sum, m) => sum + m.netBilling, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                </span>
                                            </Card>

                                            <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-20">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Efetividade Operacional</span>
                                                <span className="text-lg font-black leading-none mt-1 text-blue-600">
                                                    {(billingData.length > 0 
                                                        ? (billingData.reduce((sum, m) => sum + m.effectiveness, 0) / billingData.length).toFixed(1) 
                                                        : "100.0")}%
                                                </span>
                                            </Card>
                                        </div>

                                        {/* Billing Table */}
                                        <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
                                            <Table>
                                                <TableHeader className="bg-slate-50">
                                                    <TableRow>
                                                        <TableHead className="font-bold text-slate-800 text-xs">Mês</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs text-right pr-6">Faturamento Previsto</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs text-right pr-6">Desconto de Glosas</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs text-right pr-6">Faturamento Líquido</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs text-center">Efetividade Operacional</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs text-center">Escalas / Faltas</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {billingData.map((m) => (
                                                        <TableRow key={m.monthIndex} className="hover:bg-slate-50/50">
                                                            <TableCell className="font-bold text-xs text-slate-900 py-3">
                                                                {m.name}
                                                            </TableCell>
                                                            <TableCell className="text-right pr-6 font-semibold text-xs text-slate-700 py-3">
                                                                {m.expectedBilling.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                            </TableCell>
                                                            <TableCell className="text-right pr-6 font-semibold text-xs text-red-600 py-3">
                                                                -{m.glosas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                            </TableCell>
                                                            <TableCell className="text-right pr-6 font-black text-xs text-emerald-600 py-3">
                                                                {m.netBilling.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                            </TableCell>
                                                            <TableCell className="text-center font-black text-xs text-blue-600 py-3">
                                                                {m.effectiveness.toFixed(1)}%
                                                            </TableCell>
                                                            <TableCell className="text-center text-xs font-medium text-slate-500 py-3">
                                                                {m.totalShifts - m.vacantShifts} / {m.totalShifts} ({m.vacantShifts} faltas)
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </Card>

                                        {/* Inline Posto Billing Update */}
                                        {detailedData && (
                                            <Card className="border-slate-200 shadow-sm rounded-xl">
                                                <CardHeader>
                                                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                                        <DollarSign className="w-4 h-4 text-emerald-500" />
                                                        Lançamento e Ajuste de Faturamento por Posto (Quadro Inicial)
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Atualize o faturamento mensal de cada posto do contrato. Ausências sem cobertura sofrerão glosas baseadas no valor diário (Faturamento do Posto / 30).
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="overflow-x-auto border border-slate-100 rounded-lg">
                                                        <Table>
                                                            <TableHeader className="bg-slate-50">
                                                                <TableRow>
                                                                    <TableHead className="font-bold text-slate-800 text-xs">Posto / Função</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs">Horário / Escala</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs text-right">Faturamento</TableHead>
                                                                    <TableHead className="font-bold text-slate-800 text-xs text-center">Ações</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {detailedData.postos.map((p: any) => (
                                                                    <TableRow key={p.id} className="hover:bg-slate-50/50">
                                                                        <TableCell className="text-xs font-bold text-slate-700 py-2.5">
                                                                            {p.role?.name}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-slate-500 font-semibold py-2.5">
                                                                            {p.schedule} ({p.startTime} - {p.endTime})
                                                                        </TableCell>
                                                                        <TableCell className="text-right text-xs font-black text-slate-800 py-2.5">
                                                                            {editingPostoId === p.id ? (
                                                                                <Input 
                                                                                    type="number"
                                                                                    value={editBillingVal}
                                                                                    onChange={(e) => setEditBillingVal(Number(e.target.value))}
                                                                                    className="w-28 h-8 text-right font-black"
                                                                                />
                                                                            ) : (
                                                                                formatCurrency(p.billingValue)
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell className="text-center py-2.5">
                                                                            {editingPostoId === p.id ? (
                                                                                <div className="flex justify-center gap-1">
                                                                                    <Button 
                                                                                        size="sm"
                                                                                        onClick={() => handleSavePostoBilling(p.id)}
                                                                                        className="h-7 text-[10px] bg-emerald-600 text-white rounded font-bold"
                                                                                    >
                                                                                        Salvar
                                                                                    </Button>
                                                                                    <Button 
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        onClick={() => setEditingPostoId(null)}
                                                                                        className="h-7 text-[10px] rounded font-bold"
                                                                                    >
                                                                                        Cancelar
                                                                                    </Button>
                                                                                </div>
                                                                            ) : (
                                                                                <Button 
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    onClick={() => {
                                                                                        setEditingPostoId(p.id);
                                                                                        setEditBillingVal(p.billingValue);
                                                                                    }}
                                                                                    className="h-7 text-xs font-bold rounded-lg"
                                                                                >
                                                                                    Editar
                                                                                </Button>
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}
                                    </div>
                                )}

                                {/* TAB 4: RELATÓRIO DE LANÇAMENTOS (MONTHLY REPORT) */}
                                {activeTab === "monthly_report" && detailedData && (
                                    <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
                                        <CardHeader>
                                            <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800">Relatório Consolidado de Escalas do Mês</CardTitle>
                                            <CardDescription>Visualização diária do faturamento previsto e glosas correspondentes de cada escala de trabalho.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <Table>
                                                <TableHeader className="bg-slate-50">
                                                    <TableRow>
                                                        <TableHead className="font-bold text-slate-800 text-xs py-3.5 pl-6">Data</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs py-3.5">Posto / Função</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs py-3.5">Colaborador Titular</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs py-3.5 text-center">Status</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs py-3.5 text-right pr-6">Glosas Aplicadas</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {detailedData.attendances.map((a: any) => {
                                                        const isGlosa = a.status === "FALTA" && !a.coveredById && !a.coverageType;
                                                        const glVal = isGlosa ? a.posto?.billingValue / 30 : 0;

                                                        return (
                                                            <TableRow key={a.id} className="hover:bg-slate-50/50">
                                                                <TableCell className="text-xs font-bold text-slate-600 py-3 pl-6">
                                                                    {new Date(a.date).toLocaleDateString("pt-BR")}
                                                                </TableCell>
                                                                <TableCell className="text-xs font-bold text-slate-700 py-3">
                                                                    {a.posto?.role?.name || "Posto"}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-slate-655 font-medium py-3">
                                                                    {a.employee?.name || "Vaga em Aberto"}
                                                                </TableCell>
                                                                <TableCell className="text-center py-3">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                                                        isGlosa ? "bg-red-50 text-red-700 border-red-200 animate-pulse" : "bg-slate-100 text-slate-700 border-slate-200"
                                                                    }`}>
                                                                        {a.status === "FALTA" ? (isGlosa ? "Glosado" : "Coberto") : a.status === "FOLGA" ? "Folga" : "Presente"}
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

                                {/* TAB 5: NPS / AVALIAÇÃO (NPS) */}
                                {activeTab === "nps" && detailedData && (
                                    <div className="space-y-6">
                                        <Card className="border-slate-200 shadow-sm rounded-xl">
                                            <CardHeader className="flex flex-row items-center justify-between">
                                                <div>
                                                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800">Configuração das Perguntas do Questionário NPS</CardTitle>
                                                    <CardDescription>Configure e ajuste os quesitos que o cliente irá avaliar, juntamente com seus pesos.</CardDescription>
                                                </div>
                                                <Button 
                                                    size="sm" 
                                                    onClick={() => {
                                                        setEditingNpsQ(null);
                                                        setNpsQText("");
                                                        setNpsQWeight(1);
                                                        setNpsDialogOpen(true);
                                                    }}
                                                    className="gap-1 bg-slate-900 text-white hover:bg-slate-850 font-bold text-xs rounded-xl"
                                                >
                                                    <Plus className="w-4 h-4" /> Adicionar Pergunta
                                                </Button>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="overflow-x-auto border border-slate-100 rounded-lg bg-white">
                                                    <Table>
                                                        <TableHeader className="bg-slate-50">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-slate-800 text-xs">Texto da Pergunta</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center w-24">Peso</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center w-28">Ações</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {detailedData.npsQuestions.map((q: any) => (
                                                                <TableRow key={q.id} className="hover:bg-slate-50/50">
                                                                    <TableCell className="text-xs font-bold text-slate-700 py-3">
                                                                        {q.text}
                                                                    </TableCell>
                                                                    <TableCell className="text-center text-xs font-black text-slate-800 py-3">
                                                                        {q.weight}
                                                                    </TableCell>
                                                                    <TableCell className="text-center py-3">
                                                                        <div className="flex justify-center gap-2">
                                                                            <Button 
                                                                                size="sm" 
                                                                                variant="ghost" 
                                                                                onClick={() => {
                                                                                    setEditingNpsQ(q);
                                                                                    setNpsQText(q.text);
                                                                                    setNpsQWeight(q.weight);
                                                                                    setNpsDialogOpen(true);
                                                                                }}
                                                                                className="h-7 w-7 p-0 rounded"
                                                                            >
                                                                                <Edit3 className="w-3.5 h-3.5 text-slate-655" />
                                                                            </Button>
                                                                            <Button 
                                                                                size="sm" 
                                                                                variant="ghost" 
                                                                                onClick={() => handleDeleteNpsQClick(q.id)}
                                                                                className="h-7 w-7 p-0 rounded hover:bg-red-50"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                                            </Button>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* NPS Detailed Answers Auditing */}
                                        <Card className="border-slate-200 shadow-sm rounded-xl">
                                            <CardHeader>
                                                <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800">Avaliações NPS Enviadas pelo Cliente</CardTitle>
                                                <CardDescription>Respostas e feedback qualitativo registrados recentemente.</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                {detailedData.npsResponses.length === 0 ? (
                                                    <div className="text-center py-6 text-slate-400 italic text-xs">
                                                        Nenhuma avaliação NPS registrada pelo cliente no mês.
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        {detailedData.npsResponses.map((resp: any) => {
                                                            let sumScore = 0;
                                                            let sumWeight = 0;
                                                            resp.answers.forEach((ans: any) => {
                                                                const w = ans.question?.weight || 1.0;
                                                                sumScore += ans.score * w;
                                                                sumWeight += w;
                                                            });
                                                            const avgScore = sumWeight > 0 ? sumScore / sumWeight : 10;

                                                            return (
                                                                <div key={resp.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
                                                                    <div className="flex justify-between items-center text-xs flex-wrap gap-2">
                                                                        <span className="font-bold text-slate-700">
                                                                            Enviado em {new Date(resp.createdAt).toLocaleDateString('pt-BR')}
                                                                        </span>
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                                                            avgScore >= 9 ? "bg-emerald-50 text-emerald-700 border-emerald-250" :
                                                                            avgScore >= 7 ? "bg-amber-50 text-amber-700 border-amber-250" :
                                                                            "bg-red-50 text-red-700 border-red-250"
                                                                        }`}>
                                                                            Nota Ponderada: {avgScore.toFixed(1)} / 10
                                                                        </span>
                                                                    </div>
                                                                    {resp.feedback && (
                                                                        <p className="text-xs text-slate-655 font-medium bg-slate-50 p-2.5 rounded border border-slate-100">
                                                                            "{resp.feedback}"
                                                                        </p>
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

                                {/* TAB 6: EVOLUÇÃO NPS (KPIS) */}
                                {activeTab === "kpis" && clientKpiData && (
                                    <div className="space-y-6">
                                        <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
                                            <CardHeader>
                                                <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800">Histórico de Evolução do NPS Quesito a Quesito</CardTitle>
                                                <CardDescription>Média histórica das avaliações do cliente dividida por cada pergunta configurada.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                {clientKpiData.npsEvolution && clientKpiData.npsEvolution.length > 0 ? (
                                                    <Table>
                                                        <TableHeader className="bg-slate-50">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3 pl-6">Quesito / Indicador</TableHead>
                                                                {monthNames.map((m, i) => (
                                                                    <TableHead key={i} className="font-bold text-slate-800 text-xs text-center py-3">{m}</TableHead>
                                                                ))}
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {clientKpiData.npsEvolution.map((item: any) => (
                                                                <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                                    <TableCell className="text-xs font-bold text-slate-700 py-3 pl-6 max-w-[300px] truncate" title={item.text}>
                                                                        {item.text}
                                                                    </TableCell>
                                                                    {item.monthlyScores.map((score: number | null, sIdx: number) => (
                                                                        <TableCell key={sIdx} className="text-xs text-center py-3">
                                                                            {score !== null ? (
                                                                                <span className={`px-2 py-0.5 rounded font-black text-[11px] ${
                                                                                    score >= 9 ? "bg-emerald-50 text-emerald-600" :
                                                                                    score >= 7 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                                                                                }`}>
                                                                                    {score.toFixed(1)}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-slate-350 font-bold">-</span>
                                                                            )}
                                                                        </TableCell>
                                                                    ))}
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                ) : (
                                                    <div className="text-center py-10 text-slate-400 italic text-xs">
                                                        Nenhuma evolução NPS disponível para este contrato no ano selecionado.
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* TAB 7: NÍVEL DE SERVIÇO (SLA) */}
                                {activeTab === "sla" && detailedData && (
                                    <div className="space-y-6">
                                        <Card className="border-slate-200 shadow-sm rounded-xl">
                                            <CardHeader className="flex flex-row items-center justify-between">
                                                <div>
                                                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800">Parametrização de SLAs do Contrato</CardTitle>
                                                    <CardDescription>Configure indicadores de SLA (pesos, metas, tipos) e faça lançamentos de notas manuais.</CardDescription>
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
                                                    className="gap-1 bg-slate-900 text-white hover:bg-slate-850 font-bold text-xs rounded-xl"
                                                >
                                                    <Plus className="w-4 h-4" /> Adicionar SLA
                                                </Button>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="overflow-x-auto border border-slate-100 rounded-lg bg-white">
                                                    <Table>
                                                        <TableHeader className="bg-slate-50">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3">Indicador</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3">Origem</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center py-3">Meta (%)</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center py-3">Peso</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-right py-3">Nota Mensal</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center py-3">Ações</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {detailedData.slaConfigItems.map((item: any) => {
                                                                const mVal = item.monthlyValues[0]?.value;
                                                                return (
                                                                    <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                                        <TableCell className="text-xs font-bold text-slate-700 py-3">
                                                                            {item.name}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-slate-500 font-semibold py-3">
                                                                            {item.metricType === "MANUAL" ? "Lançamento Manual" : 
                                                                             item.metricType === "EFETIVIDADE" ? "Efetividade Escala" :
                                                                             item.metricType === "SLA_CHAMADOS" ? "Mesa de Operações" :
                                                                             item.metricType === "NPS" ? "Nota NPS" : "Glosas por Reclamações"}
                                                                        </TableCell>
                                                                        <TableCell className="text-center text-xs font-bold text-slate-600 py-3">
                                                                            {item.targetValue}%
                                                                        </TableCell>
                                                                        <TableCell className="text-center text-xs font-bold text-slate-800 py-3">
                                                                            {item.weight}
                                                                        </TableCell>
                                                                        <TableCell className="text-right py-3 text-xs">
                                                                            {item.metricType === "MANUAL" ? (
                                                                                editingSlaValueId === item.id ? (
                                                                                    <div className="flex justify-end items-center gap-1">
                                                                                        <Input
                                                                                            type="number"
                                                                                            value={manualSlaValue}
                                                                                            onChange={(e) => setManualSlaValue(Number(e.target.value))}
                                                                                            className="w-16 h-7 text-right text-xs"
                                                                                        />
                                                                                        <Button 
                                                                                            size="sm" 
                                                                                            onClick={() => handleSaveManualSlaValue(item.id)}
                                                                                            className="h-7 bg-emerald-600 text-white rounded"
                                                                                        >
                                                                                            ✓
                                                                                        </Button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex justify-end items-center gap-1.5 font-black text-slate-800">
                                                                                        <span>{mVal !== undefined ? `${mVal}%` : "Pendente"}</span>
                                                                                        <Button 
                                                                                            size="sm" 
                                                                                            variant="ghost" 
                                                                                            onClick={() => {
                                                                                                setEditingSlaValueId(item.id);
                                                                                                setManualSlaValue(mVal || item.targetValue);
                                                                                            }}
                                                                                            className="h-6 w-6 p-0 rounded-md"
                                                                                        >
                                                                                            ✏️
                                                                                        </Button>
                                                                                    </div>
                                                                                )
                                                                            ) : (
                                                                                <span className="font-semibold text-slate-400 italic">Automático</span>
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell className="text-center py-3">
                                                                            <div className="flex justify-center gap-2">
                                                                                <Button 
                                                                                    size="sm" 
                                                                                    variant="ghost" 
                                                                                    onClick={() => {
                                                                                        setEditingSlaItem(item);
                                                                                        setSlaName(item.name);
                                                                                        setSlaMetricType(item.metricType);
                                                                                        setSlaWeight(item.weight);
                                                                                        setSlaTarget(item.targetValue);
                                                                                        setSlaDialogOpen(true);
                                                                                    }}
                                                                                    className="h-7 w-7 p-0 rounded"
                                                                                >
                                                                                    <Edit3 className="w-3.5 h-3.5 text-slate-650" />
                                                                                </Button>
                                                                                <Button 
                                                                                    size="sm" 
                                                                                    variant="ghost" 
                                                                                    onClick={() => handleDeleteSlaItemClick(item.id)}
                                                                                    className="h-7 w-7 p-0 rounded hover:bg-red-50"
                                                                                >
                                                                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                                                </Button>
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* TAB 8: PLANO DE SERVIÇOS (SERVICE PLAN) */}
                                {activeTab === "service_plan" && detailedData && (
                                    <div className="space-y-6">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/50 shadow-sm">
                                            <div className="space-y-0.5">
                                                <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Checklist de Rotina do Posto</h3>
                                                <p className="text-[11px] text-slate-400 font-medium">Plano de trabalho diário e rotinas de serviços do colaborador.</p>
                                            </div>
                                            <select
                                                value={selectedPostoId}
                                                onChange={(e) => setSelectedPostoId(e.target.value)}
                                                className="h-9 rounded-xl border border-slate-200 bg-white text-xs font-bold px-3 outline-none cursor-pointer"
                                            >
                                                {detailedData.postos.map((p: any) => (
                                                    <option key={p.id} value={p.id}>🏢 {p.role?.name || "Posto"} ({p.schedule})</option>
                                                ))}
                                            </select>
                                        </div>

                                        <Card className="border-slate-200 shadow-sm rounded-xl bg-white">
                                            <CardContent className="p-0">
                                                {loadingRoutines ? (
                                                    <div className="text-center py-10 text-slate-450 italic text-xs animate-pulse">
                                                        Buscando rotinas de trabalho...
                                                    </div>
                                                ) : routines.length === 0 ? (
                                                    <div className="text-center py-10 text-slate-400 font-semibold italic text-xs">
                                                        Nenhuma rotina configurada para este posto de trabalho.
                                                    </div>
                                                ) : (
                                                    <Table>
                                                        <TableHeader className="bg-slate-50">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3.5 pl-6">Horário</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3.5">Duração</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3.5">Local</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3.5">Atividade / Instrução de Trabalho</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {routines.map((r: any) => (
                                                                <TableRow key={r.id} className="hover:bg-slate-50/50">
                                                                    <TableCell className="text-xs font-bold text-slate-700 py-3 pl-6">{r.startTime} - {r.endTime}</TableCell>
                                                                    <TableCell className="text-xs text-slate-655 font-semibold py-3">{r.duration}</TableCell>
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
                    </main>
                </div>
            )}

            {/* Modal de Registro de Visitas */}
            <Dialog open={logVisitOpen} onOpenChange={setLogVisitOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={handleSaveVisit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="text-md font-bold text-slate-800">Registrar Visita ao Contrato</DialogTitle>
                            <DialogDescription>Preencha os dados da visita de relacionamento realizada no posto.</DialogDescription>
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
                                    <Label className="text-xs font-bold text-slate-655">Quem Visitou *</Label>
                                    <Input
                                        placeholder="Nome do Visitante"
                                        value={visitorName}
                                        onChange={(e) => setVisitorName(e.target.value)}
                                        className="h-10 rounded-xl"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-655">Cargo / Nível *</Label>
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
                                <Label className="text-xs font-bold text-slate-655">Data da Visita *</Label>
                                <Input
                                    type="date"
                                    value={visitDate}
                                    onChange={(e) => setVisitDate(e.target.value)}
                                    className="h-10 rounded-xl"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Observações e Feedback</Label>
                                <textarea
                                    placeholder="Destaque as principais observações colhidas com o cliente na visita..."
                                    rows={3}
                                    value={visitNotes}
                                    onChange={(e) => setVisitNotes(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl text-xs font-semibold p-3 outline-none focus:border-primary resize-none"
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-2 border-t border-slate-100">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setLogVisitOpen(false)}
                                className="h-10 text-xs font-bold rounded-xl"
                            >
                                Cancelar
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={savingVisit}
                                className="h-10 text-xs font-bold rounded-xl bg-primary text-slate-900 hover:bg-primary/90"
                            >
                                {savingVisit ? "Registrando..." : "Registrar Visita"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal de SLA Config (Add / Edit) */}
            <Dialog open={slaDialogOpen} onOpenChange={setSlaDialogOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={handleSaveSlaItem} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="text-md font-bold text-slate-800">
                                {editingSlaItem ? "Editar Indicador de SLA" : "Adicionar Indicador de SLA"}
                            </DialogTitle>
                            <DialogDescription>
                                Parametrise o nome do indicador, tipo de métrica, peso e meta almejada.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Nome do Indicador *</Label>
                                <Input
                                    placeholder="Ex: Efetividade Operacional, Atendimento..."
                                    value={slaName}
                                    onChange={(e) => setSlaName(e.target.value)}
                                    className="h-10 rounded-xl"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Origem / Tipo de Métrica *</Label>
                                <select
                                    value={slaMetricType}
                                    onChange={(e) => setSlaMetricType(e.target.value)}
                                    className="w-full h-10 border border-slate-200 rounded-xl text-xs font-semibold px-3 outline-none focus:border-primary bg-white"
                                    required
                                >
                                    <option value="EFETIVIDADE">Automático: Efetividade de Escala Nexus</option>
                                    <option value="SLA_CHAMADOS">Automático: Resolução de Chamados no Prazo</option>
                                    <option value="NPS">Automático: Nota de Avaliação NPS do Cliente</option>
                                    <option value="RECLAMACOES">Automático: Desconto por Reclamações</option>
                                    <option value="MANUAL">Lançamento Manual pelo Gestor</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-655">Meta Alvo (%) *</Label>
                                    <Input
                                        type="number"
                                        value={slaTarget}
                                        onChange={(e) => setSlaTarget(Number(e.target.value))}
                                        className="h-10 rounded-xl"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-655">Peso na Média Ponderada *</Label>
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
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setSlaDialogOpen(false)}
                                className="h-10 text-xs font-bold rounded-xl"
                            >
                                Cancelar
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={savingSla}
                                className="h-10 text-xs font-bold rounded-xl bg-primary text-slate-900 hover:bg-primary/90"
                            >
                                {savingSla ? "Salvando..." : "Salvar Indicador"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal de NPS Question (Add / Edit) */}
            <Dialog open={npsDialogOpen} onOpenChange={setNpsDialogOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={handleSaveNpsQ} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="text-md font-bold text-slate-800">
                                {editingNpsQ ? "Editar Pergunta NPS" : "Adicionar Pergunta NPS"}
                            </DialogTitle>
                            <DialogDescription>
                                Escreva o texto da pergunta que o cliente responderá e o peso correspondente.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Texto da Pergunta *</Label>
                                <textarea
                                    placeholder="Ex: Como você avalia a postura e apresentação pessoal da equipe?"
                                    rows={3}
                                    value={npsQText}
                                    onChange={(e) => setNpsQText(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl text-xs font-semibold p-3 outline-none focus:border-primary resize-none"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Peso da Pergunta *</Label>
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
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setNpsDialogOpen(false)}
                                className="h-10 text-xs font-bold rounded-xl"
                            >
                                Cancelar
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={savingNpsQ}
                                className="h-10 text-xs font-bold rounded-xl bg-primary text-slate-900 hover:bg-primary/90"
                            >
                                {savingNpsQ ? "Salvando..." : "Salvar Pergunta"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
