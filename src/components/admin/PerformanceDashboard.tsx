"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
    getConsolidatedPerformanceData, 
    createContractVisit, 
    getAdminClientKpis,
    getClientDetailedData,
    updatePostoBilling,
    upsertSlaConfigItem,
    deleteSlaConfigItem,
    updateSlaMonthlyValue,
    upsertNpsQuestion,
    deleteNpsQuestion
} from "@/app/admin/requests/actions";
import { 
    Award, Building, Calendar, Users, DollarSign, 
    Activity, Plus, Clock, Save, Info, AlertTriangle, 
    CheckCircle2, TrendingUp, TrendingDown, Star, Landmark, Trash2, Edit3, Settings, ShieldCheck, HelpCircle
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

    // Consolidated View Data
    const [consolidatedData, setConsolidatedData] = useState<any>(null);
    const [loadingConsolidated, setLoadingConsolidated] = useState<boolean>(false);

    // Single Client KPI History (Drill-down)
    const [clientKpiData, setClientKpiData] = useState<any>(null);
    const [loadingClientKpis, setLoadingClientKpis] = useState<boolean>(false);

    // Single Client Details (Lazy loaded)
    const [detailedData, setDetailedData] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
    const [activeSubTab, setActiveSubTab] = useState<string>("dashboard");

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
            } else {
                toast.error("Erro ao carregar detalhes operacionais do contrato.");
            }
        } catch (e) {
            toast.error("Erro de conexão ao carregar detalhes.");
        } finally {
            setLoadingDetails(false);
        }
    }, [selectedClientId, selectedYear, selectedMonth]);

    useEffect(() => {
        loadPerformanceData();
        loadClientDetails();
    }, [loadPerformanceData, loadClientDetails]);

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

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
    };

    return (
        <div className="space-y-6">
            {/* Header com Filtros */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-premium">
                <div className="space-y-1">
                    <h1 className="text-xl font-black uppercase tracking-wider text-primary">Central de Gestão e Performance de Contratos</h1>
                    <p className="text-xs text-slate-400 font-medium">Parametrização de NPS e SLA, lançamentos de faturamento por posto, curva ABC e auditoria operacional.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={selectedClientId}
                        onChange={(e) => {
                            setSelectedClientId(e.target.value);
                            setActiveSubTab("dashboard");
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
                /* ================= VISÃO CONSOLIDADA ================= */
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
                                        <span className="text-xs text-red-500 font-bold col">
                                            ({consolidatedData.vacantSlotsCombined || 0} vagas)
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-semibold text-slate-500">Efetividade: {consolidatedData.avgEffectivenessCombined?.toFixed(1)}%</p>
                                </CardContent>
                            </Card>
                        </div>
                    ) : null}

                    {/* Gráfico da Curva ABC */}
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

                            {/* Tabela de Saúde de Contratos */}
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
                                                                        setActiveSubTab("dashboard");
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
                /* ================= VISÃO DETALHADA E PARAMETRIZAÇÃO INDIVIDUAL ================= */
                <div className="space-y-6">
                    {/* Barra de Retorno e Abas de Sub-Navegação */}
                    <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setSelectedClientId("all")}
                                    className="font-bold text-xs"
                                >
                                    ⬅ Voltar Consolidados
                                </Button>
                                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                    Contrato: {initialClients.find(cl => cl.id === selectedClientId)?.name}
                                </h2>
                            </div>
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                                Ano Base: {selectedYear} | Mês Base: {monthNames[selectedMonth]}
                            </span>
                        </div>

                        {/* Abas */}
                        <div className="flex flex-wrap items-center gap-2">
                            <Button 
                                variant={activeSubTab === "dashboard" ? "default" : "ghost"}
                                size="sm" 
                                onClick={() => setActiveSubTab("dashboard")}
                                className="font-bold text-xs"
                            >
                                📊 Dashboard & Visitas
                            </Button>
                            <Button 
                                variant={activeSubTab === "param" ? "default" : "ghost"}
                                size="sm" 
                                onClick={() => setActiveSubTab("param")}
                                className="font-bold text-xs"
                            >
                                ⚙️ Parametrizações & Lançamentos
                            </Button>
                            <Button 
                                variant={activeSubTab === "npsAudit" ? "default" : "ghost"}
                                size="sm" 
                                onClick={() => setActiveSubTab("npsAudit")}
                                className="font-bold text-xs"
                            >
                                💬 Auditoria NPS ({detailedData?.npsResponses?.length || 0})
                            </Button>
                            <Button 
                                variant={activeSubTab === "attendance" ? "default" : "ghost"}
                                size="sm" 
                                onClick={() => setActiveSubTab("attendance")}
                                className="font-bold text-xs"
                            >
                                📋 Relatório de Presenças ({detailedData?.attendances?.length || 0})
                            </Button>
                        </div>
                    </div>

                    {loadingClientKpis || loadingDetails ? (
                        <div className="text-center py-20 text-slate-400 font-semibold italic text-sm">
                            Buscando dados operacionais do contrato...
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* SUB-TAB 1: DASHBOARD & RESULTADOS */}
                            {activeSubTab === "dashboard" && clientKpiData && (
                                <div className="space-y-6">
                                    {/* Quick KPI Summary */}
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
                                            <CardContent className="pt-4 space-y-1">
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Efetividade Operacional</span>
                                                <p className="text-xl font-black text-slate-800">
                                                    {clientKpiData.summary?.effectiveness?.toFixed(1)}%
                                                </p>
                                                <p className="text-[9px] text-slate-400 font-semibold">Postos cobertos no mês</p>
                                            </CardContent>
                                        </Card>

                                        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
                                            <CardContent className="pt-4 space-y-1">
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Absenteísmo</span>
                                                <p className="text-xl font-black text-slate-800">
                                                    {clientKpiData.summary?.absenteeism?.toFixed(1)}%
                                                </p>
                                                <p className="text-[9px] text-slate-400 font-semibold">Total de faltas / atrasos</p>
                                            </CardContent>
                                        </Card>

                                        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
                                            <CardContent className="pt-4 space-y-1">
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">SLA de Chamados</span>
                                                <p className="text-xl font-black text-slate-800">
                                                    {clientKpiData.summary?.slaCompliance?.toFixed(1)}%
                                                </p>
                                                <p className="text-[9px] text-slate-400 font-semibold">Solicitações atendidas no prazo</p>
                                            </CardContent>
                                        </Card>

                                        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
                                            <CardContent className="pt-4 space-y-1">
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">NPS Geral (Média)</span>
                                                <p className="text-xl font-black text-slate-800">
                                                    {clientKpiData.summary?.avgNpsRating?.toFixed(1)}/10
                                                </p>
                                                <p className="text-[9px] text-slate-400 font-semibold">Satisfação calculada</p>
                                            </CardContent>
                                        </Card>

                                        <Card className="bg-white border border-slate-300 shadow-sm rounded-xl bg-slate-50/50">
                                            <CardContent className="pt-4 space-y-1">
                                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Desempenho Geral</span>
                                                <p className="text-xl font-black text-primary">
                                                    {clientKpiData.summary?.contractScore?.toFixed(1)}/10
                                                </p>
                                                <p className="text-[9px] text-slate-500 font-semibold">Nota consolidada do contrato</p>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* NPS Quesitos Evolution */}
                                    {clientKpiData.npsEvolution && clientKpiData.npsEvolution.length > 0 && (
                                        <Card className="bg-white rounded-2xl shadow-sm border border-slate-200">
                                            <CardHeader>
                                                <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider">Histórico de Evolução do NPS Quesito a Quesito</CardTitle>
                                                <CardDescription>Acompanhe a nota média do cliente para cada item avaliado.</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                                                    <Table>
                                                        <TableHeader className="bg-slate-50">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-slate-800 text-xs py-3">Quesito / Indicador</TableHead>
                                                                {monthNames.map((m, i) => (
                                                                    <TableHead key={i} className="font-bold text-slate-800 text-xs text-center py-3">{m}</TableHead>
                                                                ))}
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {clientKpiData.npsEvolution.map((item: any) => (
                                                                <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                                    <TableCell className="text-xs font-bold text-slate-700 py-3.5 max-w-[285px] truncate" title={item.text}>
                                                                        {item.text}
                                                                    </TableCell>
                                                                    {item.monthlyScores.map((score: number | null, sIdx: number) => (
                                                                        <TableCell key={sIdx} className="text-xs text-center py-3.5">
                                                                            {score !== null ? (
                                                                                <span className={`px-2 py-0.5 rounded font-black text-[11px] ${
                                                                                    score >= 9 ? "bg-emerald-50 text-emerald-600" :
                                                                                    score >= 7 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                                                                                }`}>
                                                                                    {score.toFixed(1)}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-slate-300 font-medium">-</span>
                                                                            )}
                                                                        </TableCell>
                                                                    ))}
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Visits Management */}
                                    <Card className="border-slate-200/60 shadow-sm rounded-2xl">
                                        <CardHeader className="flex flex-row items-center justify-between">
                                            <div>
                                                <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider">Histórico de Visitas de Relacionamento</CardTitle>
                                                <CardDescription>Agenda de supervisão, gerência e diretoria registrada para o contrato.</CardDescription>
                                            </div>
                                            <Button size="sm" onClick={() => {
                                                setVisitClientId(selectedClientId);
                                                setLogVisitOpen(true);
                                            }} className="gap-1 bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs rounded-xl">
                                                <Plus className="w-4 h-4" /> Nova Visita
                                            </Button>
                                        </CardHeader>
                                        <CardContent>
                                            {(() => {
                                                const c = initialClients.find(client => client.id === selectedClientId);
                                                const visits = c?.visits || [];
                                                if (visits.length === 0) {
                                                    return (
                                                        <div className="text-center py-10 text-slate-400 font-semibold italic text-xs">
                                                            Nenhuma visita registrada para este contrato até o momento.
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div className="space-y-4">
                                                        {visits.map((v: any) => (
                                                            <div key={v.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
                                                                <div className="flex justify-between items-center flex-wrap gap-2 text-xs">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                                            v.visitorRole === "DIRETOR" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                                                                            v.visitorRole === "GERENTE" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                                                            "bg-slate-100 text-slate-700 border border-slate-200"
                                                                        }`}>
                                                                            {v.visitorRole}
                                                                        </span>
                                                                        <span className="font-bold text-slate-800">{v.visitorName}</span>
                                                                    </div>
                                                                    <span className="text-slate-400 font-semibold">
                                                                        Visitado em {new Date(v.visitDate).toLocaleDateString('pt-BR')}
                                                                    </span>
                                                                </div>
                                                                {v.notes && (
                                                                    <p className="text-xs text-slate-650 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100/50">
                                                                        {v.notes}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            {/* SUB-TAB 2: PARAMETRIZAÇÕES E LANÇAMENTOS */}
                            {activeSubTab === "param" && detailedData && (
                                <div className="space-y-8">
                                    {/* 1. Lançamento de Faturamento por Posto */}
                                    <Card className="border-slate-250/60 shadow-sm rounded-2xl">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                <DollarSign className="w-5 h-5 text-emerald-500" />
                                                Lançamento e Ajuste de Faturamento por Posto
                                            </CardTitle>
                                            <CardDescription>
                                                Edite o faturamento mensal de cada posto de trabalho. A soma desses valores compõe o faturamento total do contrato.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {detailedData.postos.length === 0 ? (
                                                <div className="text-center py-6 text-slate-400 italic text-xs">
                                                    Nenhum posto de trabalho cadastrado neste contrato para alterar faturamento.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                                                    <Table>
                                                        <TableHeader className="bg-slate-50">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-slate-800 text-xs">Posto / Função</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs">Escala / Horário</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-right">Faturamento Atual</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center">Ações</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {detailedData.postos.map((p: any) => (
                                                                <TableRow key={p.id} className="hover:bg-slate-50/50">
                                                                    <TableCell className="text-xs font-bold text-slate-700">
                                                                        {p.role?.name || "Posto"}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-slate-500 font-semibold">
                                                                        {p.schedule} ({p.startTime} - {p.endTime})
                                                                    </TableCell>
                                                                    <TableCell className="text-right text-xs font-black text-slate-800">
                                                                        {editingPostoId === p.id ? (
                                                                            <Input
                                                                                type="number"
                                                                                value={editBillingVal}
                                                                                onChange={(e) => setEditBillingVal(Number(e.target.value))}
                                                                                className="w-32 h-8 text-right font-black"
                                                                            />
                                                                        ) : (
                                                                            formatCurrency(p.billingValue)
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-center">
                                                                        {editingPostoId === p.id ? (
                                                                            <div className="flex justify-center gap-1.5">
                                                                                <Button 
                                                                                    size="sm" 
                                                                                    onClick={() => handleSavePostoBilling(p.id)}
                                                                                    className="h-7 text-[10px] font-bold rounded-lg bg-emerald-600 text-white"
                                                                                >
                                                                                    Salvar
                                                                                </Button>
                                                                                <Button 
                                                                                    size="sm" 
                                                                                    variant="outline" 
                                                                                    onClick={() => setEditingPostoId(null)}
                                                                                    className="h-7 text-[10px] font-bold rounded-lg"
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
                                                                                <Edit3 className="w-3.5 h-3.5 mr-1" /> Editar
                                                                            </Button>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* 2. Parametrização do SLA */}
                                    <Card className="border-slate-250/60 shadow-sm rounded-2xl">
                                        <CardHeader className="flex flex-row items-center justify-between">
                                            <div>
                                                <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                    <Award className="w-5 h-5 text-primary" />
                                                    Parametrização de SLAs do Contrato
                                                </CardTitle>
                                                <CardDescription>
                                                    Configure os quesitos operacionais, metas, pesos para média ponderada ou lance notas manuais do mês.
                                                </CardDescription>
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
                                                className="gap-1 bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs rounded-xl"
                                            >
                                                <Plus className="w-4 h-4" /> Adicionar SLA
                                            </Button>
                                        </CardHeader>
                                        <CardContent>
                                            {detailedData.slaConfigItems.length === 0 ? (
                                                <div className="text-center py-6 text-slate-400 italic text-xs">
                                                    Nenhum indicador de SLA configurado neste contrato. Adicione um para iniciar.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                                                    <Table>
                                                        <TableHeader className="bg-slate-50">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-slate-800 text-xs">Indicador</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs">Origem da Métrica</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center">Meta (%)</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center">Peso</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-right">Valor deste Mês</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center">Ações</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {detailedData.slaConfigItems.map((item: any) => {
                                                                const mVal = item.monthlyValues[0]?.value;
                                                                return (
                                                                    <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                                        <TableCell className="text-xs font-bold text-slate-700">
                                                                            {item.name}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-slate-500 font-semibold">
                                                                            {item.metricType === "MANUAL" ? "Lançamento Manual" : 
                                                                             item.metricType === "EFETIVIDADE" ? "Efetividade de Escala Nexus" :
                                                                             item.metricType === "SLA_CHAMADOS" ? "Mesa de Operações" :
                                                                             item.metricType === "NPS" ? "Pesquisa NPS" : "Reclamações Registradas"}
                                                                        </TableCell>
                                                                        <TableCell className="text-center text-xs font-bold text-slate-600">
                                                                            {item.targetValue}%
                                                                        </TableCell>
                                                                        <TableCell className="text-center text-xs font-bold text-slate-800">
                                                                            {item.weight}
                                                                        </TableCell>
                                                                        <TableCell className="text-right text-xs">
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
                                                                        <TableCell className="text-center">
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
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* 3. Parametrização NPS */}
                                    <Card className="border-slate-250/60 shadow-sm rounded-2xl">
                                        <CardHeader className="flex flex-row items-center justify-between">
                                            <div>
                                                <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                    <Star className="w-5 h-5 text-amber-500" />
                                                    Parametrização do Questionário NPS
                                                </CardTitle>
                                                <CardDescription>
                                                    Gerencie as perguntas de satisfação e os respectivos pesos para compor a avaliação do cliente.
                                                </CardDescription>
                                            </div>
                                            <Button 
                                                size="sm" 
                                                onClick={() => {
                                                    setEditingNpsQ(null);
                                                    setNpsQText("");
                                                    setNpsQWeight(1);
                                                    setNpsDialogOpen(true);
                                                }}
                                                className="gap-1 bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs rounded-xl"
                                            >
                                                <Plus className="w-4 h-4" /> Adicionar Pergunta
                                            </Button>
                                        </CardHeader>
                                        <CardContent>
                                            {detailedData.npsQuestions.length === 0 ? (
                                                <div className="text-center py-6 text-slate-400 italic text-xs">
                                                    Nenhuma pergunta customizada configurada. O cliente responderá às perguntas padrão do sistema.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto border border-slate-100 rounded-xl">
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
                                                                    <TableCell className="text-xs font-bold text-slate-700">
                                                                        {q.text}
                                                                    </TableCell>
                                                                    <TableCell className="text-center text-xs font-black text-slate-800">
                                                                        {q.weight}
                                                                    </TableCell>
                                                                    <TableCell className="text-center">
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
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            {/* SUB-TAB 3: AUDITORIA DE NPS */}
                            {activeSubTab === "npsAudit" && detailedData && (
                                <Card className="border-slate-200/60 shadow-sm rounded-2xl">
                                    <CardHeader>
                                        <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                            <Star className="w-5 h-5 text-amber-500" />
                                            Auditoria de Avaliações NPS Recebidas no Mês
                                        </CardTitle>
                                        <CardDescription>
                                            Histórico detalhado de envios e respostas individuais por item dos questionários respondidos.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {detailedData.npsResponses.length === 0 ? (
                                            <div className="text-center py-10 text-slate-400 font-semibold italic text-xs">
                                                Nenhum questionário NPS respondido pelo cliente neste mês de referência.
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                {detailedData.npsResponses.map((resp: any) => {
                                                    // Calculate ponderated score
                                                    let totalScore = 0;
                                                    let totalWeight = 0;
                                                    resp.answers.forEach((ans: any) => {
                                                        const w = ans.question?.weight || 1.0;
                                                        totalScore += ans.score * w;
                                                        totalWeight += w;
                                                    });
                                                    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 10;

                                                    return (
                                                        <div key={resp.id} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
                                                            <div className="flex justify-between items-center flex-wrap gap-3">
                                                                <div className="space-y-0.5">
                                                                    <span className="text-xs text-slate-400 font-bold">Enviado em {new Date(resp.createdAt).toLocaleDateString('pt-BR')}</span>
                                                                    <p className="text-xs font-black text-slate-800">Avaliação do Contrato</p>
                                                                </div>
                                                                <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                                                                    finalScore >= 9 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                                                    finalScore >= 7 ? "bg-amber-50 text-amber-700 border-amber-200" :
                                                                    "bg-red-50 text-red-700 border-red-200"
                                                                }`}>
                                                                    Nota Final: {finalScore.toFixed(1)} / 10
                                                                </span>
                                                            </div>

                                                            {/* Answers Grid */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                                                {resp.answers.map((ans: any) => (
                                                                    <div key={ans.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-100 last:border-0 gap-2">
                                                                        <span className="font-semibold text-slate-650 line-clamp-2">{ans.question?.text || "Item"}</span>
                                                                        <span className={`px-2 py-0.5 rounded font-black ${
                                                                            ans.score >= 9 ? "bg-emerald-50 text-emerald-600" :
                                                                            ans.score >= 7 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                                                                        }`}>
                                                                            {ans.score}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {resp.feedback && (
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Comentário / Sugestão</span>
                                                                    <p className="text-xs text-slate-700 font-medium bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                                        "{resp.feedback}"
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* SUB-TAB 4: RELATÓRIO DE PRESENÇAS E COBERTURAS */}
                            {activeSubTab === "attendance" && detailedData && (
                                <Card className="border-slate-200/60 shadow-sm rounded-2xl">
                                    <CardHeader>
                                        <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                            <Users className="w-5 h-5 text-indigo-500" />
                                            Relatório Operacional de Presenças e Cobertura
                                        </CardTitle>
                                        <CardDescription>
                                            Detalhamento diário do controle de presença, faltas e acionamento de reservas técnicas no mês.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {detailedData.attendances.length === 0 ? (
                                            <div className="text-center py-10 text-slate-400 font-semibold italic text-xs">
                                                Nenhum registro de presença encontrado para este contrato no mês selecionado.
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto border border-slate-150 rounded-xl">
                                                <Table>
                                                    <TableHeader className="bg-slate-50">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3">Data</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3">Posto / Função</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3">Colaborador Titular</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3 text-center">Status</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3">Cobertura</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs py-3">Notas</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {detailedData.attendances.map((att: any) => {
                                                            let statusBadge = (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    Presente
                                                                </span>
                                                            );
                                                            if (att.status === "FALTA") {
                                                                statusBadge = (
                                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-50 text-red-700 border border-red-200">
                                                                        Falta
                                                                    </span>
                                                                );
                                                            } else if (att.status === "FOLGA") {
                                                                statusBadge = (
                                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                                                                        Folga
                                                                    </span>
                                                                );
                                                            }

                                                            return (
                                                                <TableRow key={att.id} className="hover:bg-slate-50/50">
                                                                    <TableCell className="text-xs font-bold text-slate-600">
                                                                        {new Date(att.date).toLocaleDateString('pt-BR')}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs font-bold text-slate-700">
                                                                        {att.posto?.role?.name || "Posto"}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-slate-650 font-medium">
                                                                        {att.employee?.name || "Sem titular escalado"}
                                                                    </TableCell>
                                                                    <TableCell className="text-center">
                                                                        {statusBadge}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs font-bold">
                                                                        {att.coveredBy ? (
                                                                            <span className="text-indigo-600">
                                                                                Coberto por {att.coveredBy.name} ({att.coverageType})
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-slate-400 italic font-semibold">Sem cobertura</span>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-slate-500 font-semibold max-w-[200px] truncate" title={att.notes}>
                                                                        {att.notes || "-"}
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
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
