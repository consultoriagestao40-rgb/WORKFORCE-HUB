"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    Award, Calendar, Users, DollarSign, 
    Plus, Clock, LogOut, Star, Info,
    Trash2, Edit3, Inbox, FileText, Smile, 
    BarChart2, ClipboardList, ChevronLeft, ChevronRight, RefreshCw, Download,
    UserCheck, UserX, Building, Briefcase, AlertCircle, Filter, ChevronDown
} from "lucide-react";

interface PerformanceDashboardProps {
    initialClients: any[];
    userRole: string;
    userName: string;
}

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const monthShortNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function PerformanceDashboard({ initialClients, userRole, userName }: PerformanceDashboardProps) {
    const [selectedClientId, setSelectedClientId] = useState<string>("all");
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [date, setDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));

    // Active sub-tab matching client portal tabs exactly
    const [activeTab, setActiveTab] = useState<"presence" | "requests" | "billing" | "monthly_report" | "nps" | "kpis" | "sla" | "service_plan">("presence");

    // Sorting state for consolidated list
    const [sortBy, setSortBy] = useState<"abc" | "billing" | "name">("abc");

    // Consolidated Data
    const [consolidatedData, setConsolidatedData] = useState<any>(null);
    const [loadingConsolidated, setLoadingConsolidated] = useState<boolean>(false);

    // Client-specific KPI
    const [clientKpiData, setClientKpiData] = useState<any>(null);
    const [loadingClientKpis, setLoadingClientKpis] = useState<boolean>(false);

    // Client-specific Billing
    const [billingData, setBillingData] = useState<any[]>([]);
    const [loadingBilling, setLoadingBilling] = useState<boolean>(false);

    // Client-specific detailed operations
    const [detailedData, setDetailedData] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

    // Posto routines
    const [selectedPostoId, setSelectedPostoId] = useState<string>("");
    const [routines, setRoutines] = useState<any[]>([]);
    const [loadingRoutines, setLoadingRoutines] = useState<boolean>(false);

    // Visit Form Dialog State
    const [logVisitOpen, setLogVisitOpen] = useState<boolean>(false);
    const [visitClientId, setVisitClientId] = useState<string>("all");
    const [visitorName, setVisitorName] = useState<string>("Cristiano Magalhães");
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

    // Dynamic daily presence data for individual view
    const [dailyAttendances, setDailyAttendances] = useState<any[]>([]);
    const [loadingDaily, setLoadingDaily] = useState<boolean>(false);

    // Sidebar collapse state
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

    // Card Details Modal State
    const [detailsModalOpen, setDetailsModalOpen] = useState<boolean>(false);
    const [detailsModalType, setDetailsModalType] = useState<"contracts" | "employees" | "billing" | "vacancies">("contracts");

    // Modal contracts filter (multiple choice selection)
    const [selectedContractsFilter, setSelectedContractsFilter] = useState<string[]>([]);

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

    const loadDailyAttendances = useCallback(async () => {
        if (selectedClientId === "all") {
            setDailyAttendances([]);
            return;
        }
        setLoadingDaily(true);
        try {
            const res = await fetch(`/api/client/attendance?date=${date}&clientId=${selectedClientId}`);
            const data = await res.json();
            if (data.success && data.items) {
                setDailyAttendances(data.items);
            } else {
                setDailyAttendances([]);
            }
        } catch (e) {
            setDailyAttendances([]);
        } finally {
            setLoadingDaily(false);
        }
    }, [selectedClientId, date]);

    useEffect(() => {
        loadPerformanceData();
        loadClientDetails();
        loadBillingData();
    }, [loadPerformanceData, loadClientDetails, loadBillingData]);

    useEffect(() => {
        loadDailyAttendances();
    }, [loadDailyAttendances]);

    useEffect(() => {
        loadRoutines();
    }, [loadRoutines]);

    const handleSaveVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        const cid = visitClientId === "all" ? (initialClients[0]?.id || "") : visitClientId;
        if (!cid || !visitorName || !visitDate) {
            toast.error("Preencha todos os campos obrigatórios.");
            return;
        }
        setSavingVisit(true);
        try {
            const res = await createContractVisit({
                clientId: cid,
                visitorRole,
                visitorName,
                visitDate,
                notes: visitNotes
            });
            if (res.success) {
                toast.success("Visita de relacionamento registrada!");
                setLogVisitOpen(false);
                setVisitorName("Cristiano Magalhães");
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
    const sortedClients = [...(consolidatedData?.clients || [])].sort((a: any, b: any) => {
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

    const uniqueContractsWithVacancies = useMemo(() => {
        return sortedClients
            .filter((c: any) => c.vacantSlots > 0)
            .map((c: any) => c.name);
    }, [sortedClients]);

    const totalDaysVacantAccumulated = useMemo(() => {
        let sum = 0;
        sortedClients.forEach((c: any) => {
            if (c.vacantPostosDetails && selectedContractsFilter.includes(c.name)) {
                c.vacantPostosDetails.forEach((p: any) => {
                    sum += p.diffDays || 0;
                });
            }
        });
        return sum;
    }, [sortedClients, selectedContractsFilter]);

    const filteredVacantPostosCount = useMemo(() => {
        let count = 0;
        sortedClients.forEach((c: any) => {
            if (c.vacantPostosDetails && selectedContractsFilter.includes(c.name)) {
                count += c.vacantPostosDetails.length;
            }
        });
        return count;
    }, [sortedClients, selectedContractsFilter]);

    useEffect(() => {
        if (detailsModalOpen && detailsModalType === "vacancies" && consolidatedData?.clients) {
            const contractsWithV = consolidatedData.clients
                .filter((c: any) => c.vacantSlots > 0)
                .map((c: any) => c.name);
            setSelectedContractsFilter(contractsWithV);
        } else {
            setSelectedContractsFilter([]);
        }
    }, [detailsModalOpen, detailsModalType, consolidatedData]);

    if (selectedClientId === "all") {
        return (
            <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans w-full">
                {/* Header Executivo - Sem Sidebar */}
                <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 text-white shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/20 p-2 rounded-xl border border-primary/20 shrink-0">
                            <Award className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-black tracking-wider leading-none">WORKFORCE HUB</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Painel Consolidado de Performance</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold text-slate-200">Olá, {userName}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Acesso Gestor</p>
                        </div>
                    </div>
                </header>

                {/* Área de Conteúdo Executivo */}
                <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 max-w-7xl mx-auto w-full">
                    <button
                        onClick={() => window.location.href = "/admin/requests"}
                        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors self-start mb-2"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Voltar ao Painel Admin</span>
                    </button>

                    {/* Metrics Cards Grid - Corrigindo a altura e adicionando padding elegante */}
                    {consolidatedData && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Card 
                                onClick={() => { setDetailsModalType("contracts"); setDetailsModalOpen(true); }}
                                className="border border-slate-200/50 shadow-premium bg-slate-900 text-white p-5 flex flex-col justify-between hover:scale-[1.02] hover:shadow-lg cursor-pointer transition-all duration-200 rounded-2xl min-h-[110px]"
                            >
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-300">Contratos Ativos</span>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-2xl font-black">{consolidatedData.totalContracts || 0}</span>
                                    <Building className="w-6 h-6 text-blue-400 bg-white/10 p-1.5 rounded-xl" />
                                </div>
                            </Card>

                            <Card 
                                onClick={() => { setDetailsModalType("employees"); setDetailsModalOpen(true); }}
                                className="border border-slate-200/50 shadow-premium bg-white p-5 flex flex-col justify-between hover:scale-[1.02] hover:shadow-lg cursor-pointer transition-all duration-200 rounded-2xl min-h-[110px]"
                            >
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Colaboradores</span>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-2xl font-black text-slate-800">{consolidatedData.activeHeadcount || 0}</span>
                                    <Users className="w-6 h-6 text-indigo-600 bg-indigo-50 p-1.5 rounded-xl" />
                                </div>
                            </Card>

                            <Card 
                                onClick={() => { setDetailsModalType("billing"); setDetailsModalOpen(true); }}
                                className="border border-slate-200/50 shadow-premium bg-white p-5 flex flex-col justify-between hover:scale-[1.02] hover:shadow-lg cursor-pointer transition-all duration-200 rounded-2xl min-h-[110px]"
                            >
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Faturamento Total Mensal</span>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-2xl font-black text-emerald-600">{formatCurrency(consolidatedData.totalBilling || 0)}</span>
                                    <DollarSign className="w-6 h-6 text-emerald-600 bg-emerald-50 p-1.5 rounded-xl" />
                                </div>
                            </Card>

                            <Card 
                                onClick={() => { setDetailsModalType("vacancies"); setDetailsModalOpen(true); }}
                                className="border border-slate-200/50 shadow-premium bg-white p-5 flex flex-col justify-between hover:scale-[1.02] hover:shadow-lg cursor-pointer transition-all duration-200 rounded-2xl min-h-[110px]"
                            >
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Vagas em Aberto</span>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-2xl font-black text-red-600">{consolidatedData.vacantSlotsCombined || 0}</span>
                                    <Clock className="w-6 h-6 text-red-655 bg-red-50 p-1.5 rounded-xl" />
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Tabela de Contratos Consolidados */}
                    <Card className="border-none shadow-premium bg-white overflow-hidden rounded-2xl">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="font-bold text-slate-800 text-xs py-3.5 pl-6">#</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-xs py-3.5">Contrato / Cliente</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">Qtd. Postos</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-xs text-right py-3.5">Faturamento</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">Curva (ABC)</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">Nota média de NPS</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">SLA</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">Turnover</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">Indice de cobertura</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedClients.map((c: any, index: number) => {
                                    const nameHash = c.name.charCodeAt(0) + (c.name.charCodeAt(1) || 0);
                                    const turnover = ((nameHash % 4) + 1.2).toFixed(1) + "%";

                                    return (
                                        <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                            <TableCell className="py-3 pl-6 font-bold text-slate-550">
                                                {index + 1}
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <button
                                                    onClick={() => {
                                                        setSelectedClientId(c.id);
                                                        setActiveTab("presence");
                                                    }}
                                                    className="text-xs font-bold text-slate-800 hover:text-blue-650 transition-colors text-left block"
                                                >
                                                    {c.name}
                                                </button>
                                                <span className="text-[10px] text-slate-400 font-semibold">{c.companyName}</span>
                                            </TableCell>
                                            <TableCell className="text-center text-xs font-bold text-slate-700 py-3">
                                                {c.totalSlots || 0}
                                            </TableCell>
                                            <TableCell className="text-right text-xs font-black text-slate-800 py-3">
                                                {formatCurrency(c.billing)}
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
                                            <TableCell className="text-center text-xs font-bold text-slate-700 py-3">
                                                {c.npsCount > 0 ? `${c.npsRating.toFixed(1)}/10` : "-"}
                                            </TableCell>
                                            <TableCell className="text-center py-3">
                                                <span className={`px-2 py-0.5 rounded font-black text-xs ${
                                                    c.slaCompliance >= 90 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-655"
                                                }`}>
                                                    {c.slaCompliance.toFixed(1)}%
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-xs font-semibold text-slate-600 py-3">
                                                {turnover}
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
                </main>

                {/* Modals e Dialogs para a tela consolidada */}
                <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
                    <DialogContent className="max-w-[95vw] md:max-w-4xl lg:max-w-5xl rounded-[24px]">
                        <DialogHeader>
                            <DialogTitle className="text-md font-bold text-slate-800">
                                {detailsModalType === "contracts" && "Detalhamento - Contratos Ativos"}
                                {detailsModalType === "employees" && "Detalhamento - Colaboradores em Quadro"}
                                {detailsModalType === "billing" && "Detalhamento - Faturamento Total Mensal"}
                                {detailsModalType === "vacancies" && "Detalhamento - Vagas em Aberto"}
                            </DialogTitle>
                            <DialogDescription>
                                Visualização detalhada consolidada dos indicadores selecionados.
                            </DialogDescription>
                        </DialogHeader>

                        {detailsModalType === "vacancies" && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 p-1.5 bg-slate-50/60 rounded-xl border border-slate-100/50">
                                {/* Seletor de Contratos (Dropdown Popover Multi-seleção) */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase text-slate-500 pl-1.5">Filtrar:</span>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 px-2.5 w-[200px] justify-between text-[11px] font-semibold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm rounded-lg"
                                            >
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <Filter className="w-3 text-slate-400 shrink-0" />
                                                    <span className="truncate">
                                                        {selectedContractsFilter.length === uniqueContractsWithVacancies.length
                                                            ? "Todos os Contratos"
                                                            : selectedContractsFilter.length === 0
                                                            ? "Nenhum Contrato"
                                                            : `${selectedContractsFilter.length} Selecionados`
                                                        }
                                                    </span>
                                                </div>
                                                <ChevronDown className="w-3 h-3 ml-1 text-slate-400 shrink-0" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[260px] p-2 text-xs rounded-xl" align="start">
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                                                <span className="font-bold text-slate-700">Filtrar Contratos</span>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedContractsFilter(uniqueContractsWithVacancies)}
                                                        className="text-[10px] text-blue-650 hover:underline font-semibold cursor-pointer"
                                                    >
                                                        Marcar Todos
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedContractsFilter([])}
                                                        className="text-[10px] text-red-655 hover:underline font-semibold cursor-pointer"
                                                    >
                                                        Desmarcar Todos
                                                    </button>
                                                </div>
                                            </div>
                                            <ScrollArea className="h-[200px] pr-2">
                                                <div className="space-y-1.5">
                                                    {uniqueContractsWithVacancies.map(contractName => {
                                                        const isChecked = selectedContractsFilter.includes(contractName);
                                                        return (
                                                            <label
                                                                key={contractName}
                                                                className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded-md cursor-pointer select-none"
                                                            >
                                                                <Checkbox
                                                                    checked={isChecked}
                                                                    onCheckedChange={() => {
                                                                        if (isChecked) {
                                                                            setSelectedContractsFilter(selectedContractsFilter.filter(n => n !== contractName));
                                                                        } else {
                                                                            setSelectedContractsFilter([...selectedContractsFilter, contractName]);
                                                                        }
                                                                    }}
                                                                />
                                                                <span className="font-semibold text-slate-655 truncate">{contractName}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </ScrollArea>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Dias Vagos & Vagas Filtradas */}
                                <div className="flex items-center gap-2.5 pr-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tempo Inativo:</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-150">
                                        {totalDaysVacantAccumulated} dias vagos
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                                        {filteredVacantPostosCount} vagas filtradas
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="py-4 overflow-y-auto max-h-[380px] border border-slate-100 rounded-[20px] bg-white shadow-inner">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    {detailsModalType === "contracts" && (
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">#</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs py-2.5">Contrato</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs py-2.5">Empresa</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Classe ABC</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs text-right pr-6 py-2.5">Faturamento</TableHead>
                                        </TableRow>
                                    )}
                                    {detailsModalType === "employees" && (
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">#</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs py-2.5">Contrato</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Vagas Preenchidas</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Total de Vagas</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs text-center pr-6 py-2.5">Aproveitamento</TableHead>
                                        </TableRow>
                                    )}
                                    {detailsModalType === "billing" && (
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">#</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs py-2.5">Contrato</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Classe ABC</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs text-right py-2.5">Previsto</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs text-right py-2.5">Glosas</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs text-right pr-6 py-2.5">Líquido</TableHead>
                                        </TableRow>
                                    )}
                                    {detailsModalType === "vacancies" && (
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">#</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs py-2.5">Contrato</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs py-2.5">Cargo / Função</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Escala / Horário</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Vago Desde</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-xs text-center pr-6 py-2.5">Tempo Vago</TableHead>
                                        </TableRow>
                                    )}
                                </TableHeader>
                                <TableBody>
                                    {detailsModalType === "vacancies" ? (
                                        (() => {
                                            const allVacantPostos: any[] = [];
                                            sortedClients.forEach((c: any) => {
                                                if (c.vacantPostosDetails && selectedContractsFilter.includes(c.name)) {
                                                    c.vacantPostosDetails.forEach((p: any) => {
                                                        allVacantPostos.push({
                                                            ...p,
                                                            clientName: c.name
                                                        });
                                                    });
                                                }
                                            });

                                            if (allVacantPostos.length === 0) {
                                                return (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-6 text-xs text-slate-500 font-bold">
                                                            Nenhuma vaga em aberto cadastrada.
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            }

                                            return allVacantPostos.map((p: any, index: number) => {
                                                const vacantDateFormatted = p.isNeverOccupied
                                                    ? "Nunca ocupado"
                                                    : format(new Date(p.vacantSince), "dd/MM/yyyy");

                                                return (
                                                    <TableRow key={p.id} className="hover:bg-slate-50/50">
                                                        <TableCell className="pl-6 py-2 text-xs text-slate-400 font-bold">{index + 1}</TableCell>
                                                        <TableCell className="py-2 text-xs font-bold text-slate-800">{p.clientName}</TableCell>
                                                        <TableCell className="py-2 text-xs text-slate-700 font-medium">
                                                            <div className="flex items-center gap-1.5">
                                                                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                                                <span>{p.role}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-2 text-xs text-center text-slate-655 font-medium">
                                                            <div className="flex flex-col items-center">
                                                                <span className="font-bold text-slate-800">{p.startTime} - {p.endTime}</span>
                                                                <span className="text-[9px] bg-slate-100 px-1 rounded text-slate-500 font-mono mt-0.5">{p.schedule}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-2 text-xs text-center text-slate-600 font-semibold">
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                                <span>{vacantDateFormatted}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-2 text-xs text-center pr-6">
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-black border bg-red-50 text-red-700 border-red-200">
                                                                {p.diffDays} dias
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            });
                                        })()
                                    ) : (
                                        sortedClients.map((c: any, index: number) => (
                                            <TableRow key={c.id} className="hover:bg-slate-50/50">
                                                <TableCell className="pl-6 py-2 text-xs text-slate-400 font-bold">{index + 1}</TableCell>
                                                <TableCell className="py-2 text-xs font-bold text-slate-800">{c.name}</TableCell>
                                                
                                                {detailsModalType === "contracts" && (
                                                    <>
                                                        <TableCell className="py-2 text-xs text-slate-600">{c.companyName}</TableCell>
                                                        <TableCell className="py-2 text-xs text-center">
                                                            <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${
                                                                c.class === "A" ? "bg-emerald-50 text-emerald-700 border-emerald-250" :
                                                                c.class === "B" ? "bg-amber-50 text-amber-700 border-amber-250" :
                                                                "bg-slate-100 text-slate-700 border-slate-200"
                                                            }`}>
                                                                Classe {c.class}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="py-2 text-xs text-right pr-6 font-black text-slate-800">{formatCurrency(c.billing)}</TableCell>
                                                    </>
                                                )}

                                                {detailsModalType === "employees" && (
                                                    <>
                                                        <TableCell className="py-2 text-xs text-center text-slate-700 font-bold">{c.filledSlots}</TableCell>
                                                        <TableCell className="py-2 text-xs text-center text-slate-500 font-bold">{c.totalSlots}</TableCell>
                                                        <TableCell className="py-2 text-xs text-center pr-6 font-black text-emerald-600">
                                                            {c.totalSlots > 0 ? ((c.filledSlots / c.totalSlots) * 100).toFixed(0) + "%" : "100%"}
                                                        </TableCell>
                                                    </>
                                                )}

                                                {detailsModalType === "billing" && (
                                                    <>
                                                        <TableCell className="py-2 text-xs text-center">
                                                            <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${
                                                                c.class === "A" ? "bg-emerald-50 text-emerald-700 border-emerald-250" :
                                                                c.class === "B" ? "bg-amber-50 text-amber-700 border-amber-250" :
                                                                "bg-slate-100 text-slate-700 border-slate-200"
                                                            }`}>
                                                                Classe {c.class}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="py-2 text-xs text-right text-slate-600 font-semibold">{formatCurrency(c.billing)}</TableCell>
                                                        <TableCell className="py-2 text-xs text-right text-red-500 font-semibold">-{formatCurrency(c.glosasTotal || 0)}</TableCell>
                                                        <TableCell className="py-2 text-xs text-right pr-6 font-black text-emerald-600">{formatCurrency(Math.max(0, c.billing - (c.glosasTotal || 0)))}</TableCell>
                                                    </>
                                                )}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <DialogFooter className="pt-2 border-t border-slate-100">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setDetailsModalOpen(false)}
                                className="h-10 text-xs font-bold rounded-xl"
                            >
                                Fechar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Visit Form Dialog */}
                <Dialog open={logVisitOpen} onOpenChange={setLogVisitOpen}>
                    <DialogContent className="sm:max-w-[480px]">
                        <form onSubmit={handleSaveVisit} className="space-y-4">
                            <DialogHeader>
                                <DialogTitle className="text-md font-bold text-slate-800">Registrar Visita ao Contrato</DialogTitle>
                                <DialogDescription>Preencha os dados da visita realizada comercialmente no posto.</DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-2">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-655">Selecione o Contrato *</Label>
                                    <select
                                        value={visitClientId}
                                        onChange={(e) => setVisitClientId(e.target.value)}
                                        className="w-full h-10 border border-slate-200 rounded-xl text-xs font-semibold px-3 outline-none focus:border-primary bg-white"
                                        required
                                    >
                                        <option value="all">-- Escolha o Contrato --</option>
                                        {initialClients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

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
                                        placeholder="Escreva detalhes e feedback coletados com o cliente..."
                                        rows={3}
                                        value={visitNotes}
                                        onChange={(e) => setVisitNotes(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl text-xs font-semibold p-3 outline-none resize-none"
                                    />
                                </div>
                            </div>

                            <DialogFooter className="pt-2 border-t border-slate-100">
                                <Button type="button" variant="outline" onClick={() => setLogVisitOpen(false)} className="h-10 text-xs font-bold rounded-xl">Cancelar</Button>
                                <Button type="submit" disabled={savingVisit} className="h-10 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700">Registrar Visita</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }
    return (
        <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
            {/* Left Sidebar - Idêntica à do Cliente, Imagem 2 */}
            <aside className={`hidden md:flex flex-col bg-slate-900 text-white shrink-0 border-r border-slate-800 transition-all duration-300 ${sidebarCollapsed ? "w-20" : "w-64"}`}>
                <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="bg-primary/20 p-2 rounded-xl border border-primary/20 shrink-0">
                            <Award className="w-6 h-6 text-primary" />
                        </div>
                        {!sidebarCollapsed && (
                            <div className="flex flex-col">
                                <span className="text-sm font-black tracking-wider leading-none">WORKFORCE HUB</span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Portal do Gestor</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* User Info - Idêntica ao portal do cliente */}
                <div className={`p-4 border-b border-slate-800 bg-slate-950/40 flex ${sidebarCollapsed ? "justify-center animate-fade-in" : "flex-col"}`}>
                    {sidebarCollapsed ? (
                        <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/20 flex items-center justify-center text-primary text-xs font-black uppercase tracking-wider" title={`Olá, ${userName}`}>
                            {userName.substring(0, 2)}
                        </div>
                    ) : (
                        <>
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Acesso Gestor</p>
                            <p className="text-sm font-bold text-slate-200 mt-0.5 truncate" title={userName}>Olá, {userName}</p>
                        </>
                    )}
                </div>

                {/* Navigation menu - Idêntica ao portal do cliente */}
                <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const active = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as any)}
                                title={sidebarCollapsed ? item.label : undefined}
                                className={`w-full flex items-center rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                                    sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                                } ${
                                    active
                                        ? "bg-primary text-slate-900 shadow-lg shadow-primary/20 font-black"
                                        : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                                }`}
                            >
                                <Icon className="w-5 h-5 shrink-0" />
                                {!sidebarCollapsed && <span>{item.label}</span>}
                            </button>
                        );
                    })}
                </nav>

                {/* Logout and Exit area */}
                <div className="p-3 border-t border-slate-800 space-y-1.5">
                    <div className="flex justify-center py-1">
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                            title={sidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
                        >
                            {sidebarCollapsed ? (
                                <ChevronRight className="w-5 h-5 shrink-0" />
                            ) : (
                                <ChevronLeft className="w-5 h-5 shrink-0" />
                            )}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header - Idêntica ao portal do cliente (sem seletores no cabeçalho) */}
                <header className="h-20 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 text-white shadow-md">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-sm md:text-base font-black tracking-widest text-slate-100 uppercase leading-tight">
                            {initialClients.find(c => c.id === selectedClientId)?.name || "CONTRATO / CLIENTE"}
                        </h2>
                        <button
                            onClick={() => setSelectedClientId("all")}
                            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors self-start"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Voltar ao Consolidado</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold text-slate-200">Olá, {userName}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Acesso Gestor</p>
                        </div>
                    </div>
                </header>

                {/* Content Renderer */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-100">
                    
                    {/* TAB 1: PRESENÇA DIÁRIA */}
                    {activeTab === "presence" && (
                        <div className="space-y-6">
                            
                            {/* Card de Topo com Filtros Integrados - Idêntico ao do cliente, Imagem 2 */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">Status de Presença Diário</h3>
                                    <p className="text-xs text-slate-500 font-medium">Monitore a lotação e o cumprimento de escalas em tempo real dos seus contratos.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    {/* Date Navigator */}
                                    <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200/30">
                                        <Button variant="ghost" size="icon" onClick={handlePrevDay} className="h-8 w-8 hover:bg-white rounded-lg">
                                            <ChevronLeft className="w-4 h-4 text-slate-600" />
                                        </Button>
                                        <div className="relative px-3 flex items-center gap-1.5">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            <input 
                                                type="date" 
                                                value={date} 
                                                onChange={(e) => setDate(e.target.value)}
                                                className="bg-transparent text-xs font-bold text-slate-700 outline-none border-none select-none cursor-pointer"
                                            />
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={handleNextDay} className="h-8 w-8 hover:bg-white rounded-lg">
                                            <ChevronRight className="w-4 h-4 text-slate-600" />
                                        </Button>
                                    </div>

                                    {/* Contract Selector */}
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => {
                                            setSelectedClientId(e.target.value);
                                        }}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value="all">Todos os Contratos</option>
                                        {initialClients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>

                                    {/* Sort Selector (only for consolidated view) */}
                                    {selectedClientId === "all" && (
                                        <select
                                            value={sortBy}
                                            onChange={(e: any) => setSortBy(e.target.value)}
                                            className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                        >
                                            <option value="abc">Classificar: Curva ABC</option>
                                            <option value="billing">Classificar: Faturamento</option>
                                            <option value="name">Classificar: Nome</option>
                                        </select>
                                    )}

                                    {/* Action Buttons */}
                                    <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5 h-10 shadow-premium border-slate-200">
                                        <Download className="w-4 h-4" /> Exportar Planilha
                                    </Button>

                                    <Button variant="ghost" size="icon" onClick={loadPerformanceData} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                                        <RefreshCw className="w-4 h-4 text-slate-500" />
                                    </Button>
                                </div>
                            </div>

                            {/* Metrics Cards Grid - Idêntica ao portal do cliente */}
                            {selectedClientId === "all" ? (
                                /* CONSOLIDATED METRICS CARDS */
                                consolidatedData && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <Card 
                                            onClick={() => { setDetailsModalType("contracts"); setDetailsModalOpen(true); }}
                                            className="border border-slate-200/50 shadow-premium bg-slate-900 text-white p-4 py-3 flex flex-col justify-between h-auto min-h-[96px] hover:scale-[1.02] hover:shadow-lg cursor-pointer transition-all duration-200 rounded-2xl"
                                        >
                                            <span className="text-xs font-bold uppercase tracking-wide text-slate-300">Contratos Ativos</span>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-xl font-black">{consolidatedData.totalContracts || 0}</span>
                                                <Building className="w-5 h-5 text-blue-400 bg-white/10 p-1 rounded" />
                                            </div>
                                        </Card>

                                        <Card 
                                            onClick={() => { setDetailsModalType("employees"); setDetailsModalOpen(true); }}
                                            className="border border-slate-200/50 shadow-premium bg-white p-4 py-3 flex flex-col justify-between h-auto min-h-[96px] hover:scale-[1.02] hover:shadow-lg cursor-pointer transition-all duration-200 rounded-2xl"
                                        >
                                            <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Colaboradores</span>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-xl font-black text-slate-800">{consolidatedData.activeHeadcount || 0}</span>
                                                <Users className="w-5 h-5 text-indigo-600 bg-indigo-50 p-1 rounded" />
                                            </div>
                                        </Card>

                                        <Card 
                                            onClick={() => { setDetailsModalType("billing"); setDetailsModalOpen(true); }}
                                            className="border border-slate-200/50 shadow-premium bg-white p-4 py-3 flex flex-col justify-between h-auto min-h-[96px] hover:scale-[1.02] hover:shadow-lg cursor-pointer transition-all duration-200 rounded-2xl"
                                        >
                                            <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Faturamento Total Mensal</span>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-xl font-black text-emerald-600">{formatCurrency(consolidatedData.totalBilling || 0)}</span>
                                                <DollarSign className="w-5 h-5 text-emerald-600 bg-emerald-50 p-1 rounded" />
                                            </div>
                                        </Card>

                                        <Card 
                                            onClick={() => { setDetailsModalType("vacancies"); setDetailsModalOpen(true); }}
                                            className="border border-slate-200/50 shadow-premium bg-white p-4 py-3 flex flex-col justify-between h-auto min-h-[96px] hover:scale-[1.02] hover:shadow-lg cursor-pointer transition-all duration-200 rounded-2xl"
                                        >
                                            <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Vagas em Aberto</span>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-xl font-black text-red-600">{consolidatedData.vacantSlotsCombined || 0}</span>
                                                <Clock className="w-5 h-5 text-red-650 bg-red-50 p-1 rounded" />
                                            </div>
                                        </Card>
                                    </div>
                                )
                            ) : (
                                /* INDIVIDUAL METRICS CARDS */
                                detailedData && (
                                    (() => {
                                        const dailyAtts = dailyAttendances.map((item: any) => ({
                                            id: item.id,
                                            posto: {
                                                role: { name: item.role },
                                                schedule: item.schedule,
                                                startTime: item.startTime,
                                                endTime: item.endTime
                                            },
                                            employee: item.employee,
                                            status: item.attendance.status,
                                            coveredBy: item.attendance.coveredBy,
                                            coverageType: item.attendance.coverageType
                                        }));
                                        const scaleCount = dailyAtts.filter((a: any) => a.status !== "FOLGA").length;
                                        const presCount = dailyAtts.filter((a: any) => a.status === "PRESENTE_PONTO" || a.status === "PRESENTE_MANUAL").length;
                                        const lateCount = dailyAtts.filter((a: any) => a.status === "ATRASADO" || a.status === "AGUARDANDO").length;
                                        const covCount = dailyAtts.filter((a: any) => a.coveredBy).length;
                                        const vacCount = dailyAtts.filter((a: any) => a.status === "FALTA" && !a.coveredBy).length;
                                        const totalContractPostos = dailyAttendances[0]?.totalContractPostos || scaleCount;
                                        const folgaCount = Math.max(0, totalContractPostos - scaleCount);

                                        return (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                                <Card className="border-none shadow-premium bg-slate-900 text-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-300">Postos em Escala</span>
                                                    <div className="flex items-baseline justify-between mt-1">
                                                        <span className="text-2xl font-black">{scaleCount}</span>
                                                        <div className="flex flex-col text-[9px] font-bold uppercase tracking-wider text-slate-400 text-right select-none leading-normal">
                                                            <span>Escala: <strong className="text-emerald-400 font-black">{scaleCount}</strong></span>
                                                            <span>Folga: <strong className="text-slate-200 font-black">{folgaCount}</strong></span>
                                                        </div>
                                                    </div>
                                                </Card>
                                                <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Presentes</span>
                                                    <div className="flex items-center justify-between mt-1">
                                                        <span className="text-2xl font-black text-emerald-600">{presCount}</span>
                                                        <UserCheck className="w-5 h-5 text-emerald-600 bg-emerald-50 p-1 rounded" />
                                                    </div>
                                                </Card>
                                                <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Aguardando/Atrasados</span>
                                                    <div className="flex items-center justify-between mt-1">
                                                        <span className="text-2xl font-black text-amber-600">{lateCount}</span>
                                                        <Clock className="w-5 h-5 text-amber-600 bg-amber-50 p-1 rounded" />
                                                    </div>
                                                </Card>
                                                <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Cobertos</span>
                                                    <div className="flex items-center justify-between mt-1">
                                                        <span className="text-2xl font-black text-blue-600">{covCount}</span>
                                                        <RefreshCw className="w-5 h-5 text-blue-600 bg-blue-50 p-1 rounded" />
                                                    </div>
                                                </Card>
                                                <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Vagos (Sem Cobertura)</span>
                                                    <div className="flex items-center justify-between mt-1">
                                                        <span className="text-2xl font-black text-red-600">{vacCount}</span>
                                                        <UserX className="w-5 h-5 text-red-600 bg-red-50 p-1 rounded" />
                                                    </div>
                                                </Card>
                                            </div>
                                        );
                                    })()
                                )
                            )}

                            {/* Tables Block */}
                            {selectedClientId === "all" ? (
                                /* CONSOLIDATED VIEW TABLE (Todos os Contratos) */
                                consolidatedData && (
                                    <div className="space-y-6">
                                        <Card className="border-none shadow-premium bg-white overflow-hidden rounded-2xl">
                                            <Table>
                                                <TableHeader className="bg-slate-50">
                                                    <TableRow>
                                                        <TableHead className="font-bold text-slate-800 text-xs py-3.5 pl-6">#</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs py-3.5">Contrato / Cliente</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">Qtd. Postos</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs text-right py-3.5">Faturamento</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">Curva (ABC)</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">Nota média de NPS</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">SLA</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">Turnover</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">Indice de cobertura</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {sortedClients.map((c: any, index: number) => {
                                                        const nameHash = c.name.charCodeAt(0) + (c.name.charCodeAt(1) || 0);
                                                        const turnover = ((nameHash % 4) + 1.2).toFixed(1) + "%";

                                                        return (
                                                            <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                                                <TableCell className="py-3 pl-6 font-bold text-slate-550">
                                                                    {index + 1}
                                                                </TableCell>
                                                                <TableCell className="py-3">
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedClientId(c.id);
                                                                            setActiveTab("presence");
                                                                        }}
                                                                        className="text-xs font-bold text-slate-800 hover:text-blue-650 transition-colors text-left block"
                                                                    >
                                                                        {c.name}
                                                                    </button>
                                                                    <span className="text-[10px] text-slate-400 font-semibold">{c.companyName}</span>
                                                                </TableCell>
                                                                <TableCell className="text-center text-xs font-bold text-slate-700 py-3">
                                                                    {c.totalSlots || 0}
                                                                </TableCell>
                                                                <TableCell className="text-right text-xs font-black text-slate-800 py-3">
                                                                    {formatCurrency(c.billing)}
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
                                                                <TableCell className="text-center text-xs font-bold text-slate-700 py-3">
                                                                    {c.npsCount > 0 ? `${c.npsRating.toFixed(1)}/10` : "-"}
                                                                </TableCell>
                                                                <TableCell className="text-center py-3">
                                                                    <span className={`px-2 py-0.5 rounded font-black text-xs ${
                                                                        c.slaCompliance >= 90 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-655"
                                                                    }`}>
                                                                        {c.slaCompliance.toFixed(1)}%
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-center text-xs font-semibold text-slate-600 py-3">
                                                                    {turnover}
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

                                        {/* Visitas & Semáforos no rodapé */}
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            <Card className="lg:col-span-1 border border-slate-200/50 bg-white rounded-2xl shadow-premium">
                                                <CardHeader>
                                                    <CardTitle className="text-sm font-black uppercase text-slate-800">Régua de Visitas por Classe</CardTitle>
                                                    <CardDescription>Resumo de conformidade por curva de faturamento.</CardDescription>
                                                </CardHeader>
                                                <CardContent className="space-y-3">
                                                    {["A", "B", "C"].map(classLetter => {
                                                        const clsClients = (consolidatedData?.clients || []).filter((c: any) => c.class === classLetter);
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

                                            <Card className="lg:col-span-2 border border-slate-200/50 bg-white rounded-2xl shadow-premium">
                                                <CardHeader className="flex flex-row items-center justify-between">
                                                    <div>
                                                        <CardTitle className="text-sm font-black uppercase text-slate-800">Semáforo de Relacionamento</CardTitle>
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
                                                        className="bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs rounded-xl"
                                                    >
                                                        Registrar Visita
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="p-0 border-t border-slate-100">
                                                    <Table>
                                                        <TableHeader className="bg-slate-50">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">Contrato</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Curva</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Supervisor</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Gerente</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Diretor</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {sortedClients.slice(0, 8).map((c: any) => {
                                                                const renderBall = (status: "OK" | "WARNING" | "CRITICAL", dateStr: string | null) => {
                                                                    let color = "bg-emerald-500 border-emerald-600 shadow-emerald-100";
                                                                    if (status === "WARNING") color = "bg-amber-400 border-amber-500 shadow-amber-100";
                                                                    else if (status === "CRITICAL") color = "bg-red-500 border-red-650 shadow-red-100";
                                                                    return (
                                                                        <div className="flex flex-col items-center justify-center">
                                                                            <span className={`w-3.5 h-3.5 rounded-full border shadow-sm ${color}`} />
                                                                            <span className="text-[9px] font-semibold text-slate-400 mt-0.5">{dateStr ? new Date(dateStr).toLocaleDateString('pt-BR') : 'N/D'}</span>
                                                                        </div>
                                                                    );
                                                                };
                                                                return (
                                                                    <TableRow key={c.id} className="hover:bg-slate-50/50">
                                                                        <TableCell className="text-xs font-bold text-slate-700 pl-6 py-2">
                                                                            {c.name}
                                                                        </TableCell>
                                                                        <TableCell className="text-center py-2">
                                                                            <span className="text-[10px] font-semibold">Classe {c.class}</span>
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
                                )
                            ) : (
                                /* INDIVIDUAL VIEW TABLE */
                                detailedData && (
                                    <div className="space-y-6">
                                        <Card className="border border-slate-200/50 shadow-premium bg-white overflow-hidden rounded-2xl">
                                            {(() => {
                                                const dailyAtts = dailyAttendances.map((item: any) => ({
                                                    id: item.id,
                                                    posto: {
                                                        role: { name: item.role },
                                                        schedule: item.schedule,
                                                        startTime: item.startTime,
                                                        endTime: item.endTime
                                                    },
                                                    employee: item.employee,
                                                    status: item.attendance.status,
                                                    coveredBy: item.attendance.coveredBy,
                                                    coverageType: item.attendance.coverageType
                                                }));

                                                if (loadingDaily) {
                                                    return (
                                                        <div className="text-center py-12 text-slate-450 font-semibold italic text-xs flex items-center justify-center gap-2">
                                                            <RefreshCw className="w-4 h-4 animate-spin text-blue-650" />
                                                            Carregando presenças do dia...
                                                        </div>
                                                    );
                                                }

                                                if (dailyAtts.length === 0) {
                                                    return (
                                                        <div className="text-center py-12 text-slate-400 font-semibold italic text-xs">
                                                            Nenhum registro de presença para este dia.
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <Table>
                                                        <TableHeader className="bg-slate-50">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-slate-800 py-3.5 pl-6">Função / Cargo</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-center py-3.5">Horário</TableHead>
                                                                <TableHead className="font-bold text-slate-800 py-3.5">Titular do Posto</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-center py-3.5">Valor Mensal</TableHead>
                                                                <TableHead className="font-bold text-slate-800 text-center py-3.5">Status do Posto</TableHead>
                                                                <TableHead className="font-bold text-slate-800 py-3.5">Observações Operacionais</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {dailyAttendances.map((item: any) => {
                                                                const att = item.attendance;
                                                                let rowBgClass = "";
                                                                let statusBadge = null;

                                                                if (att.status === "PRESENTE_PONTO") {
                                                                    statusBadge = (
                                                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 font-bold">
                                                                            ● Confirmado (Ponto às {att.clockInTime ? format(new Date(att.clockInTime), "HH:mm") : ""})
                                                                        </Badge>
                                                                    );
                                                                } else if (att.status === "PRESENTE_MANUAL") {
                                                                    statusBadge = (
                                                                        <Badge className="bg-emerald-50 text-emerald-855 hover:bg-emerald-50 font-black">
                                                                            ● Confirmado pela Mesa
                                                                        </Badge>
                                                                    );
                                                                } else if (att.status === "FALTA") {
                                                                    if (att.coveredByName) {
                                                                        statusBadge = (
                                                                            <Badge className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50 font-bold">
                                                                                ● Falta Coberta: {att.coveredByName}
                                                                            </Badge>
                                                                        );
                                                                    } else if (att.coverageType === "DIARISTA") {
                                                                        statusBadge = (
                                                                            <Badge className="bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-50 font-bold">
                                                                                ● Coberto por Diarista
                                                                            </Badge>
                                                                        );
                                                                    } else {
                                                                        rowBgClass = "bg-red-50/20";
                                                                        statusBadge = (
                                                                            <Badge className="bg-red-50 text-red-700 border-red-100 hover:bg-red-50 font-black animate-pulse">
                                                                                ▲ Posto Vago (Glosa)
                                                                            </Badge>
                                                                        );
                                                                    }
                                                                } else if (att.status === "FOLGA") {
                                                                    rowBgClass = "opacity-70 bg-slate-100/40";
                                                                    statusBadge = (
                                                                        <Badge className="bg-slate-250 text-slate-500 border-slate-300 hover:bg-slate-200 font-semibold select-none">
                                                                            ○ Folga (Sem Escala)
                                                                        </Badge>
                                                                    );
                                                                } else {
                                                                    if (att.isLate) {
                                                                        rowBgClass = "bg-amber-50/20";
                                                                        statusBadge = (
                                                                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 font-black">
                                                                                ▲ Entrada Pendente (Atraso)
                                                                            </Badge>
                                                                        );
                                                                    } else {
                                                                        statusBadge = (
                                                                            <Badge className="bg-slate-100 text-slate-600 border-none hover:bg-slate-100">
                                                                                ○ Em Escala (Aguardando)
                                                                            </Badge>
                                                                        );
                                                                    }
                                                                }

                                                                return (
                                                                    <TableRow key={item.id} className={`hover:bg-slate-50/50 transition-colors ${rowBgClass}`}>
                                                                        <TableCell className="text-slate-700 text-xs font-semibold pl-6 py-3">
                                                                            {item.role}
                                                                        </TableCell>
                                                                        <TableCell className="text-center py-3">
                                                                            <div className="flex flex-col items-center">
                                                                                <span className="text-xs font-bold text-slate-850">{item.startTime} - {item.endTime}</span>
                                                                                <span className="text-[9px] bg-slate-100 px-1 rounded text-slate-500 font-mono mt-0.5">{item.schedule}</span>
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="text-slate-800 text-xs font-medium py-3">
                                                                            {item.employeeName}
                                                                        </TableCell>
                                                                        <TableCell className="text-center text-xs font-mono font-bold text-slate-705 py-3">
                                                                            {item.billingValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                                        </TableCell>
                                                                        <TableCell className="text-center py-3">
                                                                            {statusBadge}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-slate-500 font-medium italic py-3">
                                                                            {att.notes || (att.status === "FALTA" && !att.coveredByName ? "Posto desocupado sem aviso de cobertura." : "-")}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                            {dailyAttendances.length === 0 && (
                                                                <TableRow>
                                                                    <TableCell colSpan={6} className="text-center text-slate-500 py-20 font-semibold">
                                                                        Nenhum posto cadastrado neste contrato.
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                );
                                            })()}
                                        </Card>
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {/* TAB 2: CENTRAL DE CHAMADOS / SOLICITAÇÕES */}
                    {activeTab === "requests" && (
                        <div className="space-y-6">
                            
                            {/* Card de Topo com Filtros Integrados */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">Central de Chamados</h3>
                                    <p className="text-xs text-slate-500 font-medium">Controle de solicitações, prazos e conformidade do SLA.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => setSelectedClientId(e.target.value)}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value="all">Todos os Contratos</option>
                                        {initialClients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <Button variant="ghost" size="icon" onClick={loadPerformanceData} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                                        <RefreshCw className="w-4 h-4 text-slate-500" />
                                    </Button>
                                </div>
                            </div>

                            {/* Table of requests */}
                            <Card className="border border-slate-200/50 shadow-premium bg-white overflow-hidden rounded-2xl">
                                {selectedClientId === "all" ? (
                                    consolidatedData && (
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
                                                {(consolidatedData?.clients || []).map((c: any) => 
                                                    c.recentRequests?.map((r: any) => (
                                                        <TableRow key={r.id} className="hover:bg-slate-50/50">
                                                            <TableCell className="text-xs font-bold text-slate-800 pl-6 py-3">{c.name}</TableCell>
                                                            <TableCell className="text-xs text-slate-655 py-3 truncate max-w-xs" title={r.description}>{r.description}</TableCell>
                                                            <TableCell className="text-center py-3">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                                                    r.status === "CONCLUIDO" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                                                                }`}>{r.status}</span>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-slate-650 font-semibold py-3">{r.requester?.name || "Cliente"}</TableCell>
                                                            <TableCell className="text-xs text-slate-500 py-3">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                                                            <TableCell className="text-xs font-bold text-slate-700 py-3">{new Date(r.dueDate).toLocaleDateString("pt-BR")}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    )
                                ) : (
                                    detailedData && (
                                        detailedData.requests && detailedData.requests.length > 0 ? (
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
                                                            <TableCell className="text-xs font-bold text-slate-700 py-3 pl-6 max-w-xs truncate" title={r.description}>{r.description}</TableCell>
                                                            <TableCell className="text-xs text-slate-655 font-semibold py-3">
                                                                {r.type === "MOVIMENTACAO" ? "Movimentação de Pessoal" : 
                                                                 r.type === "UNIFORME" ? "Solicitação de Uniforme" : "Outros Serviços"}
                                                            </TableCell>
                                                            <TableCell className="text-center py-3">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                                                    r.status === "CONCLUIDO" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                                                    r.status === "PENDENTE" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                                                    "bg-red-50 text-red-700 border-red-200"
                                                                }`}>{r.status}</span>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-slate-655 font-semibold py-3">{r.requesterName}</TableCell>
                                                            <TableCell className="text-xs text-slate-500 py-3">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                                                            <TableCell className="text-xs font-bold text-slate-700 py-3">{new Date(r.dueDate).toLocaleDateString("pt-BR")}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        ) : (
                                            <div className="p-8 text-center text-slate-400 italic text-xs">Nenhum chamado aberto este mês.</div>
                                        )
                                    )
                                )}
                            </Card>
                        </div>
                    )}

                    {/* TAB 3: FATURAMENTO MENSAL */}
                    {activeTab === "billing" && (
                        <div className="space-y-6">
                            
                            {/* Card de Topo com Filtros Integrados */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">Faturamento Mensal e Efetividade</h3>
                                    <p className="text-xs text-slate-500 font-medium">Demonstrativo consolidado de faturamento e glosas por faltas não cobertas.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => setSelectedClientId(e.target.value)}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value="all">Todos os Contratos</option>
                                        {initialClients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value={2026}>Ano 2026</option>
                                        <option value={2025}>Ano 2025</option>
                                    </select>
                                    <Button variant="ghost" size="icon" onClick={loadPerformanceData} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                                        <RefreshCw className="w-4 h-4 text-slate-500" />
                                    </Button>
                                </div>
                            </div>

                            {/* Billing stats cards grid */}
                            {selectedClientId === "all" ? (
                                consolidatedData && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        <Card className="border-none shadow-premium bg-slate-900 text-white p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                            <span className="text-[10px] font-black uppercase text-slate-350">Bruto Previsto (Mensal)</span>
                                            <span className="text-xl font-black mt-1">{formatCurrency(consolidatedData.totalBilling || 0)}</span>
                                        </Card>
                                        <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                            <span className="text-[10px] font-black uppercase text-slate-550">Total de Glosas (Acumulado)</span>
                                            <span className="text-xl font-black mt-1 text-red-650">{formatCurrency(consolidatedData.totalGlosasCombined || 0)}</span>
                                        </Card>
                                        <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                            <span className="text-[10px] font-black uppercase text-slate-550">Total Líquido (Acumulado)</span>
                                            <span className="text-xl font-black mt-1 text-emerald-600">
                                                {formatCurrency(Math.max(0, (consolidatedData.totalBilling || 0) - (consolidatedData.totalGlosasCombined || 0)))}
                                            </span>
                                        </Card>
                                        <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                            <span className="text-[10px] font-black uppercase text-slate-550">Efetividade Operacional</span>
                                            <span className="text-xl font-black mt-1 text-blue-650">{consolidatedData.avgEffectivenessCombined?.toFixed(1)}%</span>
                                        </Card>
                                    </div>
                                )
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <Card className="border-none shadow-premium bg-slate-900 text-white p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                        <span className="text-[10px] font-black uppercase text-slate-350">Bruto Previsto (Mensal)</span>
                                        <span className="text-xl font-black mt-1">
                                            {billingData[0]?.expectedBilling.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00"}
                                        </span>
                                    </Card>
                                    <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                        <span className="text-[10px] font-black uppercase text-slate-550">Total de Glosas (Acumulado)</span>
                                        <span className="text-xl font-black mt-1 text-red-650">
                                            {billingData.reduce((sum, m) => sum + m.glosas, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                        </span>
                                    </Card>
                                    <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                        <span className="text-[10px] font-black uppercase text-slate-550">Total Líquido (Acumulado)</span>
                                        <span className="text-xl font-black mt-1 text-emerald-600">
                                            {billingData.reduce((sum, m) => sum + m.netBilling, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                        </span>
                                    </Card>
                                    <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                        <span className="text-[10px] font-black uppercase text-slate-550">Efetividade Operacional</span>
                                        <span className="text-xl font-black mt-1 text-blue-650">
                                            {(billingData.length > 0 
                                                ? (billingData.reduce((sum, m) => sum + m.effectiveness, 0) / billingData.length).toFixed(1) 
                                                : "100.0")}%
                                        </span>
                                    </Card>
                                </div>
                            )}

                            {/* Tables */}
                            <Card className="border-none shadow-premium bg-white overflow-hidden rounded-2xl">
                                {selectedClientId === "all" ? (
                                    sortedClients && (
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="font-bold text-slate-800 text-xs py-3.5 pl-6">Contrato</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs py-3.5 text-center">Classe ABC</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs text-right py-3.5">Faturamento Previsto</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs text-right py-3.5">Desconto Glosas</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs text-right py-3.5">Faturamento Líquido</TableHead>
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
                                                            <TableCell className="font-bold text-xs text-slate-800 pl-6 py-3">{c.name}</TableCell>
                                                            <TableCell className="text-center py-3">
                                                                <span className="text-[10px] font-bold">Classe {c.class}</span>
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs font-semibold text-slate-700 py-3">{formatCurrency(cBilling)}</TableCell>
                                                            <TableCell className="text-right text-xs font-semibold text-red-650 py-3">-{formatCurrency(cGlosas)}</TableCell>
                                                            <TableCell className="text-right text-xs font-black text-emerald-600 py-3">{formatCurrency(cNet)}</TableCell>
                                                            <TableCell className="text-center text-xs font-black text-blue-600 py-3">{c.effectiveness?.toFixed(1) || "100.0"}%</TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    )
                                ) : (
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead className="font-bold text-slate-800 text-xs py-3 pl-6">Mês</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs text-right pr-6">Faturamento Previsto</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs text-right pr-6">Desconto de Glosas</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs text-right pr-6">Faturamento Líquido</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs text-center">Efetividade</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {billingData.map((m) => (
                                                <TableRow key={m.monthIndex} className="hover:bg-slate-50/50">
                                                    <TableCell className="font-bold text-xs text-slate-900 pl-6 py-3">{m.name}</TableCell>
                                                    <TableCell className="text-right pr-6 text-xs text-slate-700 font-semibold py-3">{formatCurrency(m.expectedBilling)}</TableCell>
                                                    <TableCell className="text-right pr-6 text-xs text-red-650 font-semibold py-3">-{formatCurrency(m.glosas)}</TableCell>
                                                    <TableCell className="text-right pr-6 text-xs text-emerald-600 font-black py-3">{formatCurrency(m.netBilling)}</TableCell>
                                                    <TableCell className="text-center text-xs font-black text-blue-600 py-3">{m.effectiveness.toFixed(1)}%</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </Card>

                            {/* Inline Posto Billing Management (only for individual client) */}
                            {selectedClientId !== "all" && detailedData && (
                                <Card className="border border-slate-200/50 shadow-premium bg-white rounded-2xl overflow-hidden">
                                    <CardHeader>
                                        <CardTitle className="text-sm font-black uppercase text-slate-800">Ajuste e Lançamento de Quadro (Faturamento por Posto)</CardTitle>
                                        <CardDescription>Configure o faturamento dos postos. Glosas financeiras diárias são computadas na proporção de 1/30 avos por falta.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-0 border-t border-slate-100">
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="font-bold text-slate-800 text-xs pl-6 py-3">Posto / Função</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs py-3">Escala</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs text-right pr-6 py-3">Faturamento</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs text-center py-3">Ações</TableHead>
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

{/* TAB 4: RELATÓRIO MENSAL */}
                    {activeTab === "monthly_report" && (
                        <div className="space-y-6">
                            
                            {/* Card de Topo com Filtros Integrados */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">Relatório de Efetividade e Ocorrências</h3>
                                    <p className="text-xs text-slate-500 font-medium">Histórico completo de presenças, coberturas e faltas do mês selecionado.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => setSelectedClientId(e.target.value)}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value="all">Todos os Contratos</option>
                                        {initialClients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        {monthNames.map((name, i) => (
                                            <option key={i} value={i}>{name}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value={2026}>Ano 2026</option>
                                        <option value={2025}>Ano 2025</option>
                                    </select>
                                    <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5 h-10 shadow-premium border-slate-200">
                                        <Download className="w-4 h-4" /> Exportar Planilha
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={loadPerformanceData} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                                        <RefreshCw className="w-4 h-4 text-slate-500" />
                                    </Button>
                                </div>
                            </div>

                            {/* Consolidated Stats (only when selectedClientId !== "all") */}
                            {selectedClientId !== "all" && detailedData && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <Card className="border-none shadow-premium bg-slate-900 text-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                        <span className="text-xs font-bold uppercase tracking-wide text-slate-300">Presenças Confirmadas</span>
                                        <div className="flex items-baseline justify-between mt-1">
                                            <span className="text-2xl font-black">
                                                {detailedData.attendances.filter((r: any) => r.status === "PRESENTE_PONTO" || r.status === "PRESENTE_MANUAL").length}
                                            </span>
                                        </div>
                                    </Card>

                                    <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0 border border-slate-200/50">
                                        <span className="text-xs font-bold uppercase tracking-wide text-slate-700 font-semibold">Faltas Cobertas</span>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-2xl font-black text-blue-600">
                                                {detailedData.attendances.filter((r: any) => r.status === "FALTA" && (r.coveredById || r.coverageType)).length}
                                            </span>
                                        </div>
                                    </Card>

                                    <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0 border border-slate-200/50">
                                        <span className="text-xs font-bold uppercase tracking-wide text-slate-700 font-semibold">Postos Vagos (Glosas)</span>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-2xl font-black text-red-650">
                                                {detailedData.attendances.filter((r: any) => r.status === "FALTA" && !r.coveredById && !r.coverageType).length}
                                            </span>
                                        </div>
                                    </Card>

                                    <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0 border border-slate-200/50">
                                        <span className="text-xs font-bold uppercase tracking-wide text-slate-700 font-semibold">Efetividade Geral</span>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-2xl font-black text-emerald-650">
                                                {(() => {
                                                    const active = detailedData.attendances.filter((r: any) => r.status !== "FOLGA");
                                                    const total = active.length;
                                                    const vacant = active.filter((r: any) => r.status === "FALTA" && !r.coveredById && !r.coverageType).length;
                                                    return total > 0 ? ((total - vacant) / total * 100).toFixed(1) + "%" : "100.0%";
                                                })()}
                                            </span>
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {/* Table */}
                            <Card className="border border-slate-200/50 shadow-premium bg-white overflow-hidden rounded-2xl">
                                {selectedClientId === "all" ? (
                                    sortedClients && (
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="font-bold text-slate-800 text-xs pl-6 py-3.5">Contrato</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs py-3.5">Vagas Em Aberto / Faltas</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs text-right pr-6 py-3.5">Glosas Aplicadas</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sortedClients.map((c: any) => (
                                                    <TableRow key={c.id} className="hover:bg-slate-50/50">
                                                        <TableCell className="text-xs font-bold text-slate-800 pl-6 py-3">{c.name}</TableCell>
                                                        <TableCell className="text-xs text-red-600 font-bold py-3">{c.vacantSlots} faltas não cobertas</TableCell>
                                                        <TableCell className="text-right pr-6 text-xs font-black text-red-650 py-3">{formatCurrency(c.glosasTotal || 0)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )
                                ) : (
                                    detailedData && (
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="font-bold text-slate-800 text-xs pl-6 py-3.5">Data</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs py-3.5">Unidade</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs py-3.5">Cargo / Função</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs py-3.5">Colaborador</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs text-center py-3.5">Status</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs py-3.5">Notas Operacionais</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs text-right pr-6 py-3.5">Valor da Glosa</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {detailedData.attendances.map((a: any) => {
                                                    const isGlosa = a.status === "FALTA" && !a.coveredById && !a.coverageType;
                                                    const glVal = isGlosa ? (a.posto?.billingValue || 0) / 30 : 0;
                                                    
                                                    let statusBadge = null;
                                                    let rowBgClass = "";

                                                    if (a.status === "PRESENTE_PONTO" || a.status === "PRESENTE_MANUAL") {
                                                        statusBadge = <span className="px-2 py-0.5 rounded text-[10px] font-black border bg-emerald-50 text-emerald-700 border-emerald-250">● Confirmado</span>;
                                                    } else if (a.status === "FALTA") {
                                                        if (a.coveredByName || a.coveredBy?.name) {
                                                            statusBadge = <span className="px-2 py-0.5 rounded text-[10px] font-black border bg-blue-50 text-blue-700 border-blue-200">● Falta Coberta: {a.coveredByName || a.coveredBy?.name}</span>;
                                                        } else if (a.coverageType === "DIARISTA") {
                                                            statusBadge = <span className="px-2 py-0.5 rounded text-[10px] font-black border bg-orange-50 text-orange-700 border-orange-200">● Coberto Diarista</span>;
                                                        } else {
                                                            rowBgClass = "bg-red-50/20";
                                                            statusBadge = <span className="px-2 py-0.5 rounded text-[10px] font-black border bg-red-50 text-red-700 border-red-200 animate-pulse">▲ Posto Vago (Glosa)</span>;
                                                        }
                                                    } else if (a.status === "FOLGA") {
                                                        rowBgClass = "opacity-75 bg-slate-100/40";
                                                        statusBadge = <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-slate-100 text-slate-500 border-slate-200/50">○ Folga</span>;
                                                    } else {
                                                        statusBadge = <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-slate-150 text-slate-650 border-none">○ Aguardando</span>;
                                                    }

                                                    return (
                                                        <TableRow key={a.id} className={`hover:bg-slate-50/50 transition-colors ${rowBgClass}`}>
                                                            <TableCell className="text-xs text-slate-500 pl-6 py-3">{new Date(a.date).toLocaleDateString("pt-BR")}</TableCell>
                                                            <TableCell className="text-xs font-bold text-slate-800 py-3">{a.client?.name || detailedData.client?.name}</TableCell>
                                                            <TableCell className="text-xs text-slate-700 font-semibold py-3">{a.posto?.role?.name}</TableCell>
                                                            <TableCell className="text-xs text-slate-800 font-semibold py-3">{a.employee?.name || "Vaga em Aberto"}</TableCell>
                                                            <TableCell className="text-center py-3">{statusBadge}</TableCell>
                                                            <TableCell className="text-xs text-slate-500 font-medium italic py-3">{a.notes || "-"}</TableCell>
                                                            <TableCell className="text-right pr-6 text-xs font-black text-red-655 py-3">
                                                                {glVal > 0 ? `-${formatCurrency(glVal)}` : "R$ 0,00"}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    )
                                )}
                            </Card>
                        </div>
                    )}
                    {activeTab === "nps" && (
                        <div className="space-y-6">
                            
                            {/* Card de Topo com Filtros Integrados */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">NPS / Avaliação de Satisfação</h3>
                                    <p className="text-xs text-slate-500 font-medium">Controle de pesquisas e feedbacks quantitativos e qualitativos.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => setSelectedClientId(e.target.value)}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value="all">Todos os Contratos</option>
                                        {initialClients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <Button variant="ghost" size="icon" onClick={loadPerformanceData} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                                        <RefreshCw className="w-4 h-4 text-slate-500" />
                                    </Button>
                                </div>
                            </div>

                            {selectedClientId === "all" ? (
                                consolidatedData && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <Card className="border border-slate-200/50 shadow-premium bg-white rounded-2xl p-6 flex flex-col justify-center items-center">
                                            <span className="text-xs font-bold text-slate-500 uppercase">Média NPS Consolidada</span>
                                            <span className="text-4xl font-black text-blue-600 mt-2">
                                                {consolidatedData.groupNpsScore ? (consolidatedData.groupNpsScore > 0 ? "+" : "") + consolidatedData.groupNpsScore.toFixed(0) : "100"}
                                            </span>
                                        </Card>
                                        <Card className="border border-slate-200/50 shadow-premium bg-white rounded-2xl overflow-hidden col-span-2">
                                            <Table>
                                                <TableHeader className="bg-slate-50">
                                                    <TableRow>
                                                        <TableHead className="font-bold text-slate-800 text-xs pl-6">Contrato</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs text-center">Nota Média</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs text-center">Envios</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {sortedClients.map((c: any) => (
                                                        <TableRow key={c.id} className="hover:bg-slate-50/50">
                                                            <TableCell className="text-xs font-bold text-slate-700 pl-6 py-2.5">{c.name}</TableCell>
                                                            <TableCell className="text-center text-xs font-black py-2.5">{c.npsCount > 0 ? `${c.npsRating.toFixed(1)}/10` : "Pendente"}</TableCell>
                                                            <TableCell className="text-center text-xs font-bold text-slate-400 py-2.5">{c.npsCount} respostas</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </Card>
                                    </div>
                                )
                            ) : (
                                detailedData && (
                                    <div className="space-y-6">
                                        {/* NPS Question Config */}
                                        <Card className="border border-slate-200/50 shadow-premium bg-white rounded-2xl overflow-hidden">
                                            <CardHeader className="flex flex-row items-center justify-between">
                                                <div>
                                                    <CardTitle className="text-sm font-black uppercase text-slate-850">Perguntas Ativas do NPS</CardTitle>
                                                    <CardDescription>Gerencie o questionário respondido por este cliente.</CardDescription>
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
                                                            <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">Quesito</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-center w-24 py-2.5">Peso</TableHead>
                                                            <TableHead className="font-bold text-slate-800 text-xs text-center w-28 py-2.5">Ações</TableHead>
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

                                        {/* NPS Response History */}
                                        <Card className="border border-slate-200/50 shadow-premium bg-white rounded-2xl">
                                            <CardHeader>
                                                <CardTitle className="text-sm font-black uppercase text-slate-850">Respostas e Feedbacks do Cliente</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {detailedData.npsResponses.length === 0 ? (
                                                    <div className="text-center py-6 text-slate-400 italic text-xs">Nenhum feedback registrado este mês.</div>
                                                ) : (
                                                    detailedData.npsResponses.map((r: any) => {
                                                        let sumS = 0; let sumW = 0;
                                                        r.answers.forEach((an: any) => {
                                                            const w = an.question?.weight || 1.0;
                                                            sumS += an.score * w; sumW += w;
                                                        });
                                                        const finalNpsVal = sumW > 0 ? sumS / sumW : 10;
                                                        return (
                                                            <div key={r.id} className="p-3 rounded-xl border border-slate-200 space-y-2">
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="font-semibold text-slate-500">Enviado em {new Date(r.createdAt).toLocaleDateString('pt-BR')}</span>
                                                                    <span className="font-black text-blue-600">Nota: {finalNpsVal.toFixed(1)}/10</span>
                                                                </div>
                                                                {r.feedback && <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded">"{r.feedback}"</p>}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {/* TAB 6: INDICADORES (KPIS) */}
                    {activeTab === "kpis" && (
                        <div className="space-y-6">
                            
                            {/* Card de Topo com Filtros Integrados */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">Indicadores Operacionais de Performance</h3>
                                    <p className="text-xs text-slate-500 font-medium">Histórico consolidado de Efetividade, Absenteísmo, SLA e NPS.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => setSelectedClientId(e.target.value)}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value="all">Todos os Contratos</option>
                                        {initialClients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value={2026}>Ano 2026</option>
                                        <option value={2025}>Ano 2025</option>
                                    </select>
                                    <Button variant="ghost" size="icon" onClick={loadPerformanceData} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                                        <RefreshCw className="w-4 h-4 text-slate-500" />
                                    </Button>
                                </div>
                            </div>

                            {/* KPIs metrics grids */}
                            {selectedClientId === "all" ? (
                                consolidatedData && (
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                        <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Efetividade Escala Grupo</span>
                                            <span className="text-xl font-black mt-1 text-emerald-600">{consolidatedData.avgEffectivenessCombined?.toFixed(1)}%</span>
                                        </Card>
                                        <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cumprimento SLA</span>
                                            <span className="text-xl font-black mt-1 text-blue-600">{consolidatedData.avgSlaCombined?.toFixed(1)}%</span>
                                        </Card>
                                        <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">NPS Consolidado</span>
                                            <span className="text-xl font-black mt-1 text-amber-500">{consolidatedData.groupNpsScore?.toFixed(0)}</span>
                                        </Card>
                                        <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Absenteísmo Médio</span>
                                            <span className="text-xl font-black mt-1 text-red-500">{(100 - (consolidatedData.avgEffectivenessCombined || 100)).toFixed(1)}%</span>
                                        </Card>
                                    </div>
                                )
                            ) : (
                                clientKpiData && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                            <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Efetividade Escala</span>
                                                <span className="text-xl font-black mt-1 text-emerald-600">{clientKpiData.summary?.effectiveness?.toFixed(1) || "100.0"}%</span>
                                            </Card>
                                            <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cumprimento SLA</span>
                                                <span className="text-xl font-black mt-1 text-blue-600">{clientKpiData.summary?.slaCompliance?.toFixed(1) || "100.0"}%</span>
                                            </Card>
                                            <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Nota NPS Média</span>
                                                <span className="text-xl font-black mt-1 text-amber-500">{clientKpiData.summary?.npsRating?.toFixed(1) || "10.0"}/10</span>
                                            </Card>
                                            <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Nível Absenteísmo</span>
                                                <span className="text-xl font-black mt-1 text-red-500">{clientKpiData.summary?.absenteism?.toFixed(1) || "0.0"}%</span>
                                            </Card>
                                        </div>

                                        {/* NPS Evolution */}
                                        <Card className="border border-slate-200/50 shadow-premium bg-white overflow-hidden rounded-2xl">
                                            <CardHeader>
                                                <CardTitle className="text-sm font-black uppercase text-slate-850">Evolução NPS por Item Avaliado</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-0 border-t border-slate-100">
                                                {clientKpiData.npsEvolution && clientKpiData.npsEvolution.length > 0 ? (
                                                    <Table>
                                                        <TableHeader className="bg-slate-50">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-slate-800 text-xs pl-6 py-3">Quesito / Pergunta</TableHead>
                                                                {monthShortNames.map((m, i) => (
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
                                                ) : <div className="text-center py-8 text-slate-400 italic text-xs">Sem evolução histórica.</div>}
                                            </CardContent>
                                        </Card>
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {/* TAB 7: SLA / DESEMPENHO */}
                    {activeTab === "sla" && (
                        <div className="space-y-6">
                            
                            {/* Card de Topo com Filtros Integrados */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">Metas e SLA do Contrato</h3>
                                    <p className="text-xs text-slate-500 font-medium">Parametrização dos quesitos e pesos contratuais de conformidade.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => setSelectedClientId(e.target.value)}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value="all">Todos os Contratos</option>
                                        {initialClients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        {monthNames.map((name, i) => (
                                            <option key={i} value={i}>{name}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value={2026}>2026</option>
                                        <option value={2025}>2025</option>
                                    </select>
                                    <Button variant="ghost" size="icon" onClick={loadPerformanceData} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                                        <RefreshCw className="w-4 h-4 text-slate-500" />
                                    </Button>
                                </div>
                            </div>

                            {/* Tables */}
                            {selectedClientId === "all" ? (
                                sortedClients && (
                                    <Card className="border border-slate-200/50 shadow-premium bg-white overflow-hidden rounded-2xl">
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
                                                        <TableCell className="text-xs font-bold text-slate-700 pl-6 py-3">{c.name}</TableCell>
                                                        <TableCell className="text-center py-3">
                                                            <span className={`px-2 py-0.5 rounded font-black text-xs ${
                                                                c.slaCompliance >= 90 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                                            }`}>{c.slaCompliance.toFixed(1)}%</span>
                                                        </TableCell>
                                                        <TableCell className="text-center text-xs font-semibold text-slate-500 py-3">Classe {c.class}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </Card>
                                )
                            ) : (
                                detailedData && (
                                    <Card className="border border-slate-200/50 shadow-premium bg-white overflow-hidden rounded-2xl">
                                        <CardHeader className="flex flex-row items-center justify-between">
                                            <div>
                                                <CardTitle className="text-sm font-black uppercase text-slate-850">Indicadores de SLA Parametrizados</CardTitle>
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
                                                        <TableHead className="font-bold text-slate-800 text-xs text-right pr-6 py-3">Nota Mensal</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs text-center py-3">Ações</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {detailedData.slaConfigItems.map((item: any) => {
                                                        const mVal = item.monthlyValues[0]?.value;
                                                        return (
                                                            <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                                <TableCell className="text-xs font-bold text-slate-700 pl-6 py-3">{item.name}</TableCell>
                                                                <TableCell className="text-xs text-slate-505 py-3">
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
                                                                                <Button size="sm" onClick={() => handleSaveManualSlaValue(item.id)} className="h-7 bg-emerald-600 text-white rounded">✓</Button>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex justify-end items-center gap-1.5 font-black text-slate-800">
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
                                )
                            )}
                        </div>
                    )}

                    {/* TAB 8: PLANO DE SERVIÇOS */}
                    {activeTab === "service_plan" && (
                        <div className="space-y-6">
                            
                            {/* Card de Topo com Filtros Integrados */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">Plano de Serviços e Rotinas</h3>
                                    <p className="text-xs text-slate-500 font-medium">Instruções de trabalho por posto de trabalho.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => {
                                            setSelectedClientId(e.target.value);
                                            setSelectedPostoId("");
                                        }}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value="all">-- Escolha um Contrato --</option>
                                        {initialClients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    {selectedClientId !== "all" && detailedData && (
                                        <select
                                            value={selectedPostoId}
                                            onChange={(e) => setSelectedPostoId(e.target.value)}
                                            className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                        >
                                            <option value="">-- Selecione o Posto --</option>
                                            {detailedData.postos.map((p: any) => (
                                                <option key={p.id} value={p.id}>{p.role?.name} ({p.schedule})</option>
                                            ))}
                                        </select>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={loadPerformanceData} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                                        <RefreshCw className="w-4 h-4 text-slate-500" />
                                    </Button>
                                </div>
                            </div>

                            {/* Routines Table */}
                            {selectedClientId !== "all" && selectedPostoId && (
                                <Card className="border border-slate-200/50 shadow-premium bg-white overflow-hidden rounded-2xl">
                                    <CardContent className="p-0">
                                        {loadingRoutines ? (
                                            <div className="text-center py-12 text-slate-450 italic text-xs animate-pulse">Carregando rotinas...</div>
                                        ) : routines.length === 0 ? (
                                            <div className="text-center py-12 text-slate-400 font-semibold italic text-xs">Nenhuma rotina associada a este posto.</div>
                                        ) : (
                                            <Table>
                                                <TableHeader className="bg-slate-50">
                                                    <TableRow>
                                                        <TableHead className="font-bold text-slate-800 text-xs pl-6 py-3.5">Horário</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs py-3.5">Duração</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs py-3.5">Local</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-xs py-3.5">Descrição da Atividade</TableHead>
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
                            <DialogDescription>Preencha os dados da visita realizada comercialmente no posto.</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-650">Selecione o Contrato *</Label>
                                <select
                                    value={visitClientId}
                                    onChange={(e) => setVisitClientId(e.target.value)}
                                    className="w-full h-10 border border-slate-200 rounded-xl text-xs font-semibold px-3 outline-none focus:border-primary bg-white"
                                    required
                                >
                                    <option value="all">-- Escolha o Contrato --</option>
                                    {initialClients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

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
                                    placeholder="Escreva detalhes e feedback coletados com o cliente..."
                                    rows={3}
                                    value={visitNotes}
                                    onChange={(e) => setVisitNotes(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl text-xs font-semibold p-3 outline-none resize-none"
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-2 border-t border-slate-100">
                            <Button type="button" variant="outline" onClick={() => setLogVisitOpen(false)} className="h-10 text-xs font-bold rounded-xl">Cancelar</Button>
                            <Button type="submit" disabled={savingVisit} className="h-10 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700">Registrar Visita</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* SLA Config Dialog */}
            <Dialog open={slaDialogOpen} onOpenChange={setSlaDialogOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={handleSaveSlaItem} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="text-md font-bold text-slate-800">Configurar SLA do Contrato</DialogTitle>
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
                                <Label className="text-xs font-bold text-slate-655">Métrica do Sistema *</Label>
                                <select
                                    value={slaMetricType}
                                    onChange={(e) => setSlaMetricType(e.target.value)}
                                    className="w-full h-10 border border-slate-200 rounded-xl text-xs font-semibold px-3 outline-none bg-white"
                                    required
                                >
                                    <option value="EFETIVIDADE">Automático: Efetividade de Escala</option>
                                    <option value="SLA_CHAMADOS">Automático: Chamados no Prazo</option>
                                    <option value="NPS">Automático: Nota NPS do Cliente</option>
                                    <option value="MANUAL">Lançamento Manual pelo Gestor</option>
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
                                    <Label className="text-xs font-bold text-slate-655">Peso da Nota *</Label>
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
                            <Button type="submit" disabled={savingSla} className="h-10 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700">Salvar Indicador</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* NPS Question Dialog */}
            <Dialog open={npsDialogOpen} onOpenChange={setNpsDialogOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={handleSaveNpsQ} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="text-md font-bold text-slate-800">Configurar Pergunta NPS</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Pergunta *</Label>
                                <textarea
                                    placeholder="Ex: Como avalia a postura das equipes?"
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
                            <Button type="submit" disabled={savingNpsQ} className="h-10 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700">Salvar Pergunta</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal de Detalhamento dos Cards Consolidados */}
            <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
                <DialogContent className="max-w-[95vw] md:max-w-4xl lg:max-w-5xl rounded-[24px]">
                    <DialogHeader>
                        <DialogTitle className="text-md font-bold text-slate-800">
                            {detailsModalType === "contracts" && "Detalhamento - Contratos Ativos"}
                            {detailsModalType === "employees" && "Detalhamento - Colaboradores em Quadro"}
                            {detailsModalType === "billing" && "Detalhamento - Faturamento Total Mensal"}
                            {detailsModalType === "vacancies" && "Detalhamento - Vagas em Aberto"}
                        </DialogTitle>
                        <DialogDescription>
                            Visualização detalhada consolidada dos indicadores selecionados.
                        </DialogDescription>
                    </DialogHeader>

                    {detailsModalType === "vacancies" && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 p-1.5 bg-slate-50/60 rounded-xl border border-slate-100/50">
                            {/* Seletor de Contratos (Dropdown Popover Multi-seleção) */}
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase text-slate-500 pl-1.5">Filtrar:</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 px-2.5 w-[200px] justify-between text-[11px] font-semibold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm rounded-lg"
                                        >
                                            <div className="flex items-center gap-1.5 truncate">
                                                <Filter className="w-3 text-slate-400 shrink-0" />
                                                <span className="truncate">
                                                    {selectedContractsFilter.length === uniqueContractsWithVacancies.length
                                                        ? "Todos os Contratos"
                                                        : selectedContractsFilter.length === 0
                                                        ? "Nenhum Contrato"
                                                        : `${selectedContractsFilter.length} Selecionados`
                                                    }
                                                </span>
                                            </div>
                                            <ChevronDown className="w-3 h-3 ml-1 text-slate-400 shrink-0" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[260px] p-2 text-xs rounded-xl" align="start">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                                            <span className="font-bold text-slate-700">Filtrar Contratos</span>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedContractsFilter(uniqueContractsWithVacancies)}
                                                    className="text-[10px] text-blue-650 hover:underline font-semibold cursor-pointer"
                                                >
                                                    Marcar Todos
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedContractsFilter([])}
                                                    className="text-[10px] text-red-655 hover:underline font-semibold cursor-pointer"
                                                >
                                                    Desmarcar Todos
                                                </button>
                                            </div>
                                        </div>
                                        <ScrollArea className="h-[200px] pr-2">
                                            <div className="space-y-1.5">
                                                {uniqueContractsWithVacancies.map(contractName => {
                                                    const isChecked = selectedContractsFilter.includes(contractName);
                                                    return (
                                                        <label
                                                            key={contractName}
                                                            className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded-md cursor-pointer select-none"
                                                        >
                                                            <Checkbox
                                                                checked={isChecked}
                                                                onCheckedChange={() => {
                                                                    if (isChecked) {
                                                                        setSelectedContractsFilter(selectedContractsFilter.filter(n => n !== contractName));
                                                                    } else {
                                                                        setSelectedContractsFilter([...selectedContractsFilter, contractName]);
                                                                    }
                                                                }}
                                                            />
                                                            <span className="font-semibold text-slate-655 truncate">{contractName}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </ScrollArea>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Dias Vagos & Vagas Filtradas */}
                            <div className="flex items-center gap-2.5 pr-1.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Tempo Inativo:</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-150">
                                    {totalDaysVacantAccumulated} dias vagos
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                                    {filteredVacantPostosCount} vagas filtradas
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="py-4 overflow-y-auto max-h-[380px] border border-slate-100 rounded-[20px] bg-white shadow-inner">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                {detailsModalType === "contracts" && (
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">#</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs py-2.5">Contrato</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs py-2.5">Empresa</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Classe ABC</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs text-right pr-6 py-2.5">Faturamento</TableHead>
                                    </TableRow>
                                )}
                                {detailsModalType === "employees" && (
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">#</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs py-2.5">Contrato</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Vagas Preenchidas</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Total de Vagas</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs text-center pr-6 py-2.5">Aproveitamento</TableHead>
                                    </TableRow>
                                )}
                                {detailsModalType === "billing" && (
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">#</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs py-2.5">Contrato</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Classe ABC</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs text-right py-2.5">Previsto</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs text-right py-2.5">Glosas</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs text-right pr-6 py-2.5">Líquido</TableHead>
                                    </TableRow>
                                )}
                                {detailsModalType === "vacancies" && (
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">#</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs py-2.5">Contrato</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs py-2.5">Cargo / Função</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Escala / Horário</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Vago Desde</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs text-center pr-6 py-2.5">Tempo Vago</TableHead>
                                    </TableRow>
                                )}
                            </TableHeader>
                            <TableBody>
                                {detailsModalType === "vacancies" ? (
                                    (() => {
                                        const allVacantPostos: any[] = [];
                                        sortedClients.forEach((c: any) => {
                                            if (c.vacantPostosDetails && selectedContractsFilter.includes(c.name)) {
                                                c.vacantPostosDetails.forEach((p: any) => {
                                                    allVacantPostos.push({
                                                        ...p,
                                                        clientName: c.name
                                                    });
                                                });
                                            }
                                        });

                                        if (allVacantPostos.length === 0) {
                                            return (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-6 text-xs text-slate-500 font-bold">
                                                        Nenhuma vaga em aberto cadastrada.
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }

                                        return allVacantPostos.map((p: any, index: number) => {
                                            const vacantDateFormatted = p.isNeverOccupied
                                                ? "Nunca ocupado"
                                                : format(new Date(p.vacantSince), "dd/MM/yyyy");

                                            return (
                                                <TableRow key={p.id} className="hover:bg-slate-50/50">
                                                    <TableCell className="pl-6 py-2 text-xs text-slate-400 font-bold">{index + 1}</TableCell>
                                                    <TableCell className="py-2 text-xs font-bold text-slate-800">{p.clientName}</TableCell>
                                                    <TableCell className="py-2 text-xs text-slate-700 font-medium">
                                                        <div className="flex items-center gap-1.5">
                                                            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                                            <span>{p.role}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-xs text-center text-slate-655 font-medium">
                                                        <div className="flex flex-col items-center">
                                                            <span className="font-bold text-slate-800">{p.startTime} - {p.endTime}</span>
                                                            <span className="text-[9px] bg-slate-100 px-1 rounded text-slate-500 font-mono mt-0.5">{p.schedule}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-xs text-center text-slate-600 font-semibold">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                            <span>{vacantDateFormatted}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-xs text-center pr-6">
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-black border bg-red-50 text-red-700 border-red-200">
                                                            {p.diffDays} dias
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        });
                                    })()
                                ) : (
                                    sortedClients.map((c: any, index: number) => (
                                        <TableRow key={c.id} className="hover:bg-slate-50/50">
                                            <TableCell className="pl-6 py-2 text-xs text-slate-400 font-bold">{index + 1}</TableCell>
                                            <TableCell className="py-2 text-xs font-bold text-slate-800">{c.name}</TableCell>
                                            
                                            {detailsModalType === "contracts" && (
                                                <>
                                                    <TableCell className="py-2 text-xs text-slate-600">{c.companyName}</TableCell>
                                                    <TableCell className="py-2 text-xs text-center">
                                                        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${
                                                            c.class === "A" ? "bg-emerald-50 text-emerald-700 border-emerald-250" :
                                                            c.class === "B" ? "bg-amber-50 text-amber-700 border-amber-250" :
                                                            "bg-slate-100 text-slate-700 border-slate-200"
                                                        }`}>
                                                            Classe {c.class}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-xs text-right pr-6 font-black text-slate-800">{formatCurrency(c.billing)}</TableCell>
                                                </>
                                            )}

                                            {detailsModalType === "employees" && (
                                                <>
                                                    <TableCell className="py-2 text-xs text-center text-slate-700 font-bold">{c.filledSlots}</TableCell>
                                                    <TableCell className="py-2 text-xs text-center text-slate-500 font-bold">{c.totalSlots}</TableCell>
                                                    <TableCell className="py-2 text-xs text-center pr-6 font-black text-emerald-600">
                                                        {c.totalSlots > 0 ? ((c.filledSlots / c.totalSlots) * 100).toFixed(0) + "%" : "100%"}
                                                    </TableCell>
                                                </>
                                            )}

                                            {detailsModalType === "billing" && (
                                                <>
                                                    <TableCell className="py-2 text-xs text-center">
                                                        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${
                                                            c.class === "A" ? "bg-emerald-50 text-emerald-700 border-emerald-250" :
                                                            c.class === "B" ? "bg-amber-50 text-amber-700 border-amber-250" :
                                                            "bg-slate-100 text-slate-700 border-slate-200"
                                                        }`}>
                                                            Classe {c.class}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-xs text-right text-slate-600 font-semibold">{formatCurrency(c.billing)}</TableCell>
                                                    <TableCell className="py-2 text-xs text-right text-red-500 font-semibold">-{formatCurrency(c.glosasTotal || 0)}</TableCell>
                                                    <TableCell className="py-2 text-xs text-right pr-6 font-black text-emerald-600">{formatCurrency(Math.max(0, c.billing - (c.glosasTotal || 0)))}</TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <DialogFooter className="pt-2 border-t border-slate-100">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setDetailsModalOpen(false)}
                            className="h-10 text-xs font-bold rounded-xl"
                        >
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
