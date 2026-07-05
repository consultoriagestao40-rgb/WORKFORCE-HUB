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
    getAdminClientKpis 
} from "@/app/admin/requests/actions";
import { 
    Award, Building, Calendar, Users, DollarSign, 
    Activity, Plus, Clock, Save, Info, AlertTriangle, 
    CheckCircle2, TrendingUp, TrendingDown, Star, Landmark
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

    // Visit Dialog State
    const [logVisitOpen, setLogVisitOpen] = useState<boolean>(false);
    const [visitClientId, setVisitClientId] = useState<string>("");
    const [visitorName, setVisitorName] = useState<string>("");
    const [visitorRole, setVisitorRole] = useState<string>("SUPERVISOR");
    const [visitDate, setVisitDate] = useState<string>(new Date().toISOString().substring(0, 10));
    const [visitNotes, setVisitNotes] = useState<string>("");
    const [savingVisit, setSavingVisit] = useState<boolean>(false);

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

    useEffect(() => {
        loadPerformanceData();
    }, [loadPerformanceData]);

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
            } else {
                toast.error("Erro ao registrar visita.");
            }
        } catch (e) {
            toast.error("Erro de conexão ao salvar visita.");
        } finally {
            setSavingVisit(false);
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
                    <p className="text-xs text-slate-400 font-medium">Curva ABC, SLAs consolidados, satisfação NPS e controle da régua de visitas de relacionamento.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
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
                                        <span className="text-xs text-red-500 font-bold">
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
                                                                    onClick={() => setSelectedClientId(c.id)}
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
                /* ================= VISÃO DRILL-DOWN (CONTRATO INDIVIDUAL) ================= */
                <div className="space-y-6">
                    {/* Barra de Retorno */}
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setSelectedClientId("all")}
                            className="font-bold text-xs"
                        >
                            ⬅ Voltar para Visão Consolidada
                        </Button>
                        <span className="text-xs text-slate-500 font-bold">
                            Análise Individual do Contrato
                        </span>
                    </div>

                    {loadingClientKpis ? (
                        <div className="text-center py-20 text-slate-400 font-semibold italic text-sm">
                            Carregando dados operacionais do contrato...
                        </div>
                    ) : clientKpiData ? (
                        <div className="space-y-6">
                            {/* KPI Blocks do Cliente */}
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

                            {/* Evolução Mensal do NPS por Quesito */}
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

                            {/* Detalhes de Visitas do Contrato */}
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
                                    {/* Obter cliente selecionado do initialClients */}
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
                    ) : null}
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
                                    <Label className="text-xs font-bold text-slate-650">Quem Visitou *</Label>
                                    <Input
                                        placeholder="Nome do Visitante"
                                        value={visitorName}
                                        onChange={(e) => setVisitorName(e.target.value)}
                                        className="h-10 rounded-xl"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-650">Cargo / Nível *</Label>
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
                                <Label className="text-xs font-bold text-slate-650">Data da Visita *</Label>
                                <Input
                                    type="date"
                                    value={visitDate}
                                    onChange={(e) => setVisitDate(e.target.value)}
                                    className="h-10 rounded-xl"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-650">Observações e Feedback</Label>
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
        </div>
    );
}
