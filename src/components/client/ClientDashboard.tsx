"use client";

// Force trigger build

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { format, addDays, subDays } from "date-fns";
import { 
    Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
    Calendar, ChevronLeft, ChevronRight, Clock, UserCheck, UserX, 
    RefreshCw, LogOut, ShieldAlert, Award, FileText, Download,
    DollarSign, Inbox, Plus, Search, Menu, X, Smile, BarChart2, ClipboardList
} from "lucide-react";
import { logout } from "@/app/actions";
import { 
    createClientRequest, 
    getClientRequests, 
    getClientEmployees, 
    getClientMonthlyReport,
    submitClientNps,
    getClientKpis,
    getPostoRoutines,
    getNpsQuestions,
    submitClientNpsAnswers,
    addRequestComment,
    updateRequestDetails,
    getClientDetailedData
} from "@/app/admin/requests/actions";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Contract {
    id: string;
    name: string;
    companyName: string;
}

interface ClientDashboardProps {
    userName: string;
    contracts: Contract[];
}

interface ClientAttendanceItem {
    id: string;
    role: string;
    schedule: string;
    startTime: string;
    endTime: string;
    clientId: string;
    clientName: string;
    clientAddress: string;
    employeeName: string;
    totalContractPostos: number;
    billingValue: number;
    attendance: {
        status: string;
        clockInTime: string | null;
        coveredByName: string | null;
        coverageType: string | null;
        notes: string;
        isLate: boolean;
    };
}

export function ClientDashboard({ userName, contracts }: ClientDashboardProps) {
    const [date, setDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
    const [selectedContractId, setSelectedContractId] = useState<string>("all");
    const [activeContractId, setActiveContractId] = useState<string | null>(null);
    const [items, setItems] = useState<ClientAttendanceItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isPending, startTransition] = useTransition();

    const [activeTab, setActiveTab] = useState<"presence" | "requests" | "billing" | "monthly_report" | "nps" | "kpis" | "sla" | "service_plan">("presence");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Requests Tab States
    const [requests, setRequests] = useState<any[]>([]);
    const [employees, setEmployees] = useState<{id: string, name: string}[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [showNewRequestModal, setShowNewRequestModal] = useState(false);
    const [newRequestType, setNewRequestType] = useState("MOVIMENTACAO");
    const [newRequestDescription, setNewRequestDescription] = useState("");
    const [newRequestEmployeeId, setNewRequestEmployeeId] = useState("");
    const [submittingRequest, setSubmittingRequest] = useState(false);

    // Segmentações das solicitações do cliente
    const [requestCategory, setRequestCategory] = useState<"solicitacao" | "elogio_sugestao" | "reclamacao">("solicitacao");
    const [solicitacaoSubtype, setSolicitacaoSubtype] = useState<"troca_colaborador" | "uniformes_produtos" | "servicos_extras">("troca_colaborador");
    const [reclamacaoCategory, setReclamacaoCategory] = useState<"qualidade_servicos" | "visita_supervisao" | "falta_sem_cobertura" | "atraso_recorrente" | "postura_uniforme" | "problemas_epi" | "outras">("qualidade_servicos");

    // Interações e visualização de chamados do cliente
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [newCommentContent, setNewCommentContent] = useState<string>("");
    const [submittingComment, setSubmittingComment] = useState<boolean>(false);
    const [savingRequestDetails, setSavingRequestDetails] = useState<boolean>(false);

    // Billing Tab States
    const [billingYear, setBillingYear] = useState(new Date().getFullYear());
    const [billingData, setBillingData] = useState<any[]>([]);
    const [loadingBilling, setLoadingBilling] = useState(false);

    // Monthly Report Tab States
    const [reportMonth, setReportMonth] = useState(new Date().getMonth());
    const [reportYear, setReportYear] = useState(new Date().getFullYear());
    const [reportData, setReportData] = useState<any[]>([]);
    const [loadingReport, setLoadingReport] = useState(false);

    const [selectedNpsClientId, setSelectedNpsClientId] = useState<string>("");
    const [npsScore, setNpsScore] = useState<number | null>(null);
    const [npsFeedback, setNpsFeedback] = useState<string>("");
    const [submittingNps, setSubmittingNps] = useState(false);
    const [dynamicNpsQuestions, setDynamicNpsQuestions] = useState<any[]>([]);
    const [npsAnswers, setNpsAnswers] = useState<Record<string, number>>({});

    // SLA & KPIs Tab States
    const [slaYear, setSlaYear] = useState(new Date().getFullYear());
    const [slaData, setSlaData] = useState<any>(null);
    const [loadingSla, setLoadingSla] = useState(false);

    // Service Plan Tab States
    const [selectedServicePlanPostoId, setSelectedServicePlanPostoId] = useState<string>("");

    // KPI Modal States
    const [kpiModalConfig, setKpiModalConfig] = useState<{ monthIndex: number; monthName: string; kpiType: 'effectiveness' | 'nps' | 'turnover' | 'sla' | 'complaints' } | null>(null);
    const [kpiModalData, setKpiModalData] = useState<any>(null);
    const [loadingKpiModal, setLoadingKpiModal] = useState<boolean>(false);

    const handleKpiCellClick = async (monthIndex: number, monthName: string, kpiType: 'effectiveness' | 'nps' | 'turnover' | 'sla' | 'complaints') => {
        const activeId = activeContractId || (contracts.length > 0 ? contracts[0].id : null);
        if (!activeId) return;

        setKpiModalConfig({ monthIndex, monthName, kpiType });
        setLoadingKpiModal(true);
        setKpiModalData(null);
        try {
            const res = await getClientDetailedData(activeId, slaYear, monthIndex);
            if (res.success) {
                setKpiModalData(res);
            }
        } catch (err) {
            console.error("Erro ao buscar detalhes do KPI:", err);
        } finally {
            setLoadingKpiModal(false);
        }
    };
    const [servicePlanRoutines, setServicePlanRoutines] = useState<any[]>([]);
    const [loadingServicePlan, setLoadingServicePlan] = useState(false);

    const fetchRequests = useCallback(async () => {
        setLoadingRequests(true);
        try {
            const data = await getClientRequests();
            setRequests(data);
        } catch (e) {
            toast.error("Erro ao buscar solicitações.");
        } finally {
            setLoadingRequests(false);
        }
    }, []);

    const fetchEmployees = useCallback(async () => {
        try {
            const data = await getClientEmployees();
            setEmployees(data);
        } catch (e) {
            console.error("Erro ao buscar colaboradores.", e);
        }
    }, []);

    const fetchBilling = useCallback(async (year: number) => {
        setLoadingBilling(true);
        try {
            const res = await fetch(`/api/client/billing?year=${year}`);
            const data = await res.json();
            if (data.success) {
                setBillingData(data.months);
            } else {
                toast.error("Erro ao calcular faturamento.");
            }
        } catch (e) {
            toast.error("Erro de conexão ao carregar faturamento.");
        } finally {
            setLoadingBilling(false);
        }
    }, []);

    const fetchReport = useCallback(async (month: number, year: number) => {
        setLoadingReport(true);
        try {
            const data = await getClientMonthlyReport(month, year);
            setReportData(data);
        } catch (e) {
            toast.error("Erro ao carregar relatório mensal.");
        } finally {
            setLoadingReport(false);
        }
    }, []);

    const fetchSlaData = useCallback(async (year: number) => {
        setLoadingSla(true);
        try {
            const data = await getClientKpis(year);
            if (data.success) {
                setSlaData(data);
            }
        } catch (e) {
            toast.error("Erro ao carregar dados de performance (SLA).");
        } finally {
            setLoadingSla(false);
        }
    }, []);

    const fetchServicePlanRoutines = useCallback(async (postoId: string) => {
        if (!postoId) return;
        setLoadingServicePlan(true);
        try {
            const res = await getPostoRoutines(postoId);
            if (res.success && res.routines) {
                setServicePlanRoutines(res.routines);
            } else {
                toast.error("Erro ao buscar rotinas de trabalho.");
            }
        } catch (e) {
            toast.error("Erro de conexão ao carregar rotinas.");
        } finally {
            setLoadingServicePlan(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === "requests") {
            fetchRequests();
            fetchEmployees();
        } else if (activeTab === "billing") {
            fetchBilling(billingYear);
        } else if (activeTab === "monthly_report") {
            fetchReport(reportMonth, reportYear);
        } else if (activeTab === "sla" || activeTab === "kpis") {
            fetchSlaData(slaYear);
        }
    }, [activeTab, billingYear, reportMonth, reportYear, slaYear, fetchRequests, fetchEmployees, fetchBilling, fetchReport, fetchSlaData]);

    useEffect(() => {
        if (activeTab === "service_plan" && !selectedServicePlanPostoId && contracts.length > 0) {
            setSelectedServicePlanPostoId(contracts[0].id);
        }
    }, [activeTab, contracts, selectedServicePlanPostoId]);

    useEffect(() => {
        if (activeTab === "service_plan" && selectedServicePlanPostoId) {
            fetchServicePlanRoutines(selectedServicePlanPostoId);
        }
    }, [activeTab, selectedServicePlanPostoId, fetchServicePlanRoutines]);

    const handleCreateRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRequestDescription.trim()) {
            toast.error("Por favor, descreva detalhadamente a ocorrência.");
            return;
        }

        let type = "OUTROS";
        let finalDescription = newRequestDescription;

        if (requestCategory === "solicitacao") {
            if (solicitacaoSubtype === "troca_colaborador") {
                type = "MOVIMENTACAO";
                if (!newRequestEmployeeId) {
                    toast.error("Para solicitações de troca, é obrigatório selecionar o colaborador na lista.");
                    return;
                }
                finalDescription = `[SOLICITAÇÃO - Troca de Colaborador] ${newRequestDescription}`;
            } else if (solicitacaoSubtype === "uniformes_produtos") {
                type = "UNIFORME";
                finalDescription = `[SOLICITAÇÃO - Uniformes / EPIs / Produtos] ${newRequestDescription}`;
            } else if (solicitacaoSubtype === "servicos_extras") {
                type = "HORARIO";
                finalDescription = `[SOLICITAÇÃO - Serviços Extras] ${newRequestDescription}`;
            }
        } else if (requestCategory === "elogio_sugestao") {
            type = "OUTROS";
            finalDescription = `[ELOGIO / SUGESTÃO] ${newRequestDescription}`;
        } else if (requestCategory === "reclamacao") {
            type = "OUTROS";
            const catLabels: Record<string, string> = {
                qualidade_servicos: "Qualidade dos serviços",
                visita_supervisao: "Visitas da supervisão",
                falta_sem_cobertura: "Falta sem cobertura",
                atraso_recorrente: "Atraso recorrente",
                postura_uniforme: "Postura / Uniformização inadequada",
                problemas_epi: "Problemas com EPI / Equipamento",
                outras: "Outras Reclamações"
            };
            const label = catLabels[reclamacaoCategory] || "Reclamação Geral";
            finalDescription = `[RECLAMAÇÃO - ${label}] ${newRequestDescription}`;
        }

        setSubmittingRequest(true);
        try {
            const res = await createClientRequest({
                type,
                description: finalDescription,
                employeeId: newRequestEmployeeId || undefined
            });

            if (res.success) {
                toast.success("Solicitação enviada com sucesso!");
                setShowNewRequestModal(false);
                setNewRequestDescription("");
                setNewRequestEmployeeId("");
                // resetar estados auxiliares
                setRequestCategory("solicitacao");
                setSolicitacaoSubtype("troca_colaborador");
                setReclamacaoCategory("qualidade_servicos");
                fetchRequests();
            } else {
                toast.error("Erro ao enviar solicitação.");
            }
        } catch (e) {
            toast.error("Ocorreu um erro ao processar sua solicitação.");
        } finally {
            setSubmittingRequest(false);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRequest || !newCommentContent.trim()) return;

        setSubmittingComment(true);
        try {
            const res = await addRequestComment(selectedRequest.id, newCommentContent);
            if (res.success) {
                toast.success("Mensagem enviada com sucesso!");
                setNewCommentContent("");
                // Atualizar o chamado selecionado localmente
                const updatedRequests = await getClientRequests();
                setRequests(updatedRequests);
                const currentUpdated = updatedRequests.find((r: any) => r.id === selectedRequest.id);
                if (currentUpdated) {
                    setSelectedRequest(currentUpdated);
                }
            } else {
                toast.error("Erro ao enviar mensagem.");
            }
        } catch (err) {
            toast.error("Erro de conexão ao enviar comentário.");
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleSaveClientRequestDetails = async () => {
        if (!selectedRequest) return;
        setSavingRequestDetails(true);
        try {
            const res = await updateRequestDetails(selectedRequest.id, {
                description: selectedRequest.description,
                employeeId: selectedRequest.employeeId === "" ? null : selectedRequest.employeeId
            });

            if (res.success) {
                toast.success("Solicitação salva com sucesso!");
                // Recarregar
                const updatedRequests = await getClientRequests();
                setRequests(updatedRequests);
                const currentUpdated = updatedRequests.find((r: any) => r.id === selectedRequest.id);
                if (currentUpdated) {
                    setSelectedRequest(currentUpdated);
                }
            } else {
                toast.error("Erro ao salvar alterações.");
            }
        } catch (err) {
            toast.error("Erro ao atualizar chamado.");
        } finally {
            setSavingRequestDetails(false);
        }
    };

    const handleNpsClientChange = async (clientId: string) => {
        setSelectedNpsClientId(clientId);
        setDynamicNpsQuestions([]);
        setNpsAnswers({});
        if (!clientId) return;
        try {
            const res = await getNpsQuestions(clientId);
            if (res.success) {
                setDynamicNpsQuestions(res.questions || []);
            }
        } catch (e) {
            toast.error("Erro ao carregar perguntas do NPS.");
        }
    };

    const handleNpsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedNpsClientId) {
            toast.error("Por favor, selecione um contrato/unidade.");
            return;
        }

        const unanswered = dynamicNpsQuestions.filter(q => npsAnswers[q.id] === undefined);
        if (unanswered.length > 0) {
            toast.error("Por favor, responda a todas as perguntas da avaliação.");
            return;
        }

        setSubmittingNps(true);
        try {
            const formattedAnswers = Object.entries(npsAnswers).map(([questionId, score]) => ({
                questionId,
                score
            }));

            const res = await submitClientNpsAnswers(
                selectedNpsClientId,
                formattedAnswers,
                npsFeedback
            );

            if (res.success) {
                toast.success("Avaliação enviada com sucesso! Muito obrigado pelo seu feedback.");
                setNpsAnswers({});
                setNpsFeedback("");
                setDynamicNpsQuestions([]);
                setSelectedNpsClientId("");
            } else {
                toast.error("Erro ao enviar avaliação.");
            }
        } catch (e) {
            toast.error("Erro ao registrar avaliação.");
        } finally {
            setSubmittingNps(false);
        }
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                date,
                clientId: selectedContractId
            });
            const res = await fetch(`/api/client/attendance?${queryParams.toString()}`);
            const data = await res.json();
            
            if (data.success) {
                setItems(data.items);
            } else {
                toast.error("Erro ao carregar dados: " + (data.error || "Erro desconhecido"));
            }
        } catch (e) {
            toast.error("Erro de conexão ao carregar escala.");
        } finally {
            setLoading(false);
        }
    }, [date, selectedContractId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDateChange = (newDate: string) => {
        startTransition(() => {
            setDate(newDate);
        });
    };

    const handlePrevDay = () => {
        const prev = subDays(new Date(date + "T00:00:00"), 1);
        handleDateChange(format(prev, "yyyy-MM-dd"));
    };

    const handleNextDay = () => {
        const next = addDays(new Date(date + "T00:00:00"), 1);
        handleDateChange(format(next, "yyyy-MM-dd"));
    };

    // Calculate Summary Metrics
    const metrics = React.useMemo(() => {
        let total = 0;
        let presentCount = 0;
        let lateCount = 0;
        let vacantCount = 0;
        let coveredCount = 0;

        items.forEach(item => {
            const att = item.attendance;
            if (att.status === "FOLGA") return;

            total++;

            if (att.status === "PRESENTE_PONTO" || att.status === "PRESENTE_MANUAL") {
                presentCount++;
            } else if (att.status === "FALTA") {
                if (att.coveredByName || att.coverageType) {
                    coveredCount++;
                } else {
                    vacantCount++;
                }
            } else if (att.status === "AGUARDANDO" && att.isLate) {
                lateCount++;
            }
        });

        // Calcular postos físicos totais do contrato mapeados de forma única
        const contractMap = new Map<string, number>();
        items.forEach(item => {
            contractMap.set(item.clientId, item.totalContractPostos || 0);
        });
        const totalContractPostos = Array.from(contractMap.values()).reduce((sum, val) => sum + val, 0);

        return { total, presentCount, lateCount, vacantCount, coveredCount, totalContractPostos };
    }, [items]);

    // Group items by client contract for the master list view
    const groupedContracts = React.useMemo(() => {
        const map = new Map<string, { 
            id: string; 
            name: string; 
            address: string; 
            companyName: string;
            total: number;
            present: number;
            late: number;
            covered: number;
            vacant: number;
            totalContractPostos: number;
        }>();

        items.forEach(item => {
            const key = item.clientId;
            if (!map.has(key)) {
                const matchingContract = contracts.find(c => c.id === key);
                const companyName = matchingContract?.companyName || "Grupo JVS";

                map.set(key, {
                    id: key,
                    name: item.clientName,
                    address: item.clientAddress || "-",
                    companyName,
                    total: 0,
                    present: 0,
                    late: 0,
                    covered: 0,
                    vacant: 0,
                    totalContractPostos: item.totalContractPostos || 0
                });
            }
            const c = map.get(key)!;
            const att = item.attendance;

            if (att.status === "FOLGA") return;

            c.total++;
            
            if (att.status === "PRESENTE_PONTO" || att.status === "PRESENTE_MANUAL") {
                c.present++;
            } else if (att.status === "FALTA") {
                if (att.coveredByName || att.coverageType) {
                    c.covered++;
                } else {
                    c.vacant++;
                }
            } else if (att.status === "AGUARDANDO" && att.isLate) {
                c.late++;
            }
        });

        return Array.from(map.values());
    }, [items]);

    // Export Client Roster to Excel
    const handleExportExcel = () => {
        const exportData = items.map((item, index) => {
            const att = item.attendance;
            let statusText = "Aguardando Entrada";
            if (att.status === "PRESENTE_PONTO") statusText = `Presente (Ponto - ${att.clockInTime ? format(new Date(att.clockInTime), "HH:mm") : ""})`;
            else if (att.status === "PRESENTE_MANUAL") statusText = "Presente (Confirmado pela mesa)";
            else if (att.status === "FALTA") {
                if (att.coveredByName) statusText = `Falta Coberta (Reserva: ${att.coveredByName})`;
                else if (att.coverageType === "DIARISTA") statusText = "Falta Coberta (Diarista)";
                else statusText = "Posto Vago (Glosa)";
            } else if (att.status === "AGUARDANDO" && att.isLate) {
                statusText = "Atrasado (Pendente)";
            }

            return {
                "Nº": index + 1,
                "Contrato / Unidade": item.clientName,
                "Cargo/Função": item.role,
                "Escala": item.schedule,
                "Horário": `${item.startTime} - ${item.endTime}`,
                "Profissional Escalado": item.employeeName,
                "Status de Presença": statusText,
                "Observação": att.notes || "-"
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);

        ws["!cols"] = [
            { wch: 5 },   // Nº
            { wch: 25 },  // Unidade
            { wch: 20 },  // Cargo
            { wch: 12 },  // Escala
            { wch: 15 },  // Horário
            { wch: 25 },  // Profissional
            { wch: 35 },  // Status
            { wch: 30 }   // Observação
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Relatorio_Presenca");
        XLSX.writeFile(wb, `Presenca_Contratos_${date}.xlsx`);
    };

    const menuItems = [
        { id: "presence", label: "Presença Diária", icon: UserCheck },
        { id: "requests", label: "Solicitações", icon: Inbox },
        { id: "billing", label: "Faturamento Mensal", icon: DollarSign },
        { id: "monthly_report", label: "Relatório Mensal", icon: FileText },
        { id: "nps", label: "NPS / Avaliação", icon: Smile },
        { id: "kpis", label: "Indicadores (KPIs)", icon: BarChart2 },
        { id: "sla", label: "SLA / Desempenho", icon: Award },
        { id: "service_plan", label: "Plano de Serviços", icon: ClipboardList }
    ];

    return (
        <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
            {/* Sidebar Desktop */}
            <aside className={`hidden md:flex flex-col bg-slate-900 text-white shrink-0 border-r border-slate-800 transition-all duration-300 ${sidebarCollapsed ? "w-20" : "w-64"}`}>
                <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="bg-primary/20 p-2 rounded-xl border border-primary/20 shrink-0">
                            <Award className="w-6 h-6 text-primary" />
                        </div>
                        {!sidebarCollapsed && (
                            <div className="flex flex-col">
                                <span className="text-sm font-black tracking-wider leading-none">WORKFORCE HUB</span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Portal do Cliente</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* User Info */}
                <div className={`p-4 border-b border-slate-800 bg-slate-950/40 flex ${sidebarCollapsed ? "justify-center animate-fade-in" : "flex-col"}`}>
                    {sidebarCollapsed ? (
                        <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/20 flex items-center justify-center text-primary text-xs font-black uppercase tracking-wider" title={`Olá, ${userName}`}>
                            {userName.substring(0, 2)}
                        </div>
                    ) : (
                        <>
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Acesso Cliente</p>
                            <p className="text-sm font-bold text-slate-200 mt-0.5 truncate">Olá, {userName}</p>
                        </>
                    )}
                </div>

                {/* Navigation menu */}
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

                {/* Logout and Collapse area */}
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
                    <button
                        onClick={() => logout()}
                        className={`w-full flex items-center rounded-xl text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 transition-all ${
                            sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                        }`}
                        title={sidebarCollapsed ? "Sair" : undefined}
                    >
                        <LogOut className="w-5 h-5 shrink-0" />
                        {!sidebarCollapsed && <span>Sair</span>}
                    </button>
                </div>
            </aside>

            {/* Sidebar Mobile Drawer */}
            {sidebarOpen && (
                <div className="md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}>
                    <aside className="w-64 h-full bg-slate-900 text-white flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <Award className="w-6 h-6 text-primary" />
                                <span className="text-sm font-black tracking-wider leading-none">WORKFORCE HUB</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="text-slate-400">
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        <div className="p-4 border-b border-slate-800 bg-slate-950/40">
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Acesso Cliente</p>
                            <p className="text-sm font-bold text-slate-200 mt-0.5">Olá, {userName}</p>
                        </div>

                        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
                            {menuItems.map((item) => {
                                const Icon = item.icon;
                                const active = activeTab === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setActiveTab(item.id as any);
                                            setSidebarOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                                            active
                                                ? "bg-primary text-slate-900 shadow-lg shadow-primary/20 font-black"
                                                : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                                        }`}
                                    >
                                        <Icon className="w-5 h-5 shrink-0" />
                                        <span>{item.label}</span>
                                    </button>
                                );
                            })}
                        </nav>

                        <div className="p-3 border-t border-slate-800">
                            <button
                                onClick={() => logout()}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                                <LogOut className="w-5 h-5 shrink-0" />
                                <span>Sair</span>
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header */}
                <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 text-white shadow-md">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="text-slate-300 hover:bg-slate-800 hover:text-white md:hidden"
                        >
                            <Menu className="w-5 h-5" />
                        </Button>
                        <h2 className="text-sm md:text-base font-black tracking-widest text-slate-100 uppercase">
                            {menuItems.find(m => m.id === activeTab)?.label}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold text-slate-200">Olá, {userName}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Acesso Cliente</p>
                        </div>
                    </div>
                </header>

                {/* Tab Renderers */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
                    {activeTab === "presence" && (
                        /* TAB 1: PRESENCE (Original Attendance view) */
                        <div className="space-y-6">
                            {/* Original header date selector and contract filter */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">Status de Presença Diário</h3>
                                    <p className="text-xs text-slate-500 font-medium">Monitore a lotação e o cumprimento de escalas em tempo real dos seus contratos.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200/30">
                                        <Button variant="ghost" size="icon" onClick={handlePrevDay} className="h-8 w-8 hover:bg-white rounded-lg">
                                            <ChevronLeft className="w-4 h-4 text-slate-600" />
                                        </Button>
                                        <div className="relative px-3 flex items-center gap-1.5">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            <input 
                                                type="date" 
                                                value={date} 
                                                onChange={(e) => handleDateChange(e.target.value)}
                                                className="bg-transparent text-xs font-bold text-slate-700 outline-none border-none select-none cursor-pointer"
                                            />
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={handleNextDay} className="h-8 w-8 hover:bg-white rounded-lg">
                                            <ChevronRight className="w-4 h-4 text-slate-600" />
                                        </Button>
                                    </div>

                                    <select
                                        value={selectedContractId}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSelectedContractId(val);
                                            setActiveContractId(val === "all" ? null : val);
                                        }}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value="all">Todos os Contratos</option>
                                        {contracts.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>

                                    <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5 h-10 shadow-premium border-slate-200">
                                        <Download className="w-4 h-4" /> Exportar Planilha
                                    </Button>

                                    <Button variant="ghost" size="icon" onClick={fetchData} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                                        <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                            </div>

                            {/* Metrics Cards Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                <Card className="border-none shadow-premium bg-slate-900 text-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-300">Postos em Escala</span>
                                    <div className="flex items-baseline justify-between mt-1">
                                        <span className="text-2xl font-black">{metrics.total}</span>
                                        <div className="flex flex-col text-[9px] font-bold uppercase tracking-wider text-slate-400 text-right select-none leading-normal">
                                            <span>Escala: <strong className="text-emerald-400 font-black">{metrics.total}</strong></span>
                                            <span>Folga: <strong className="text-slate-200 font-black">{metrics.totalContractPostos - metrics.total}</strong></span>
                                        </div>
                                    </div>
                                </Card>

                                <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Presentes</span>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-2xl font-black text-emerald-600">{metrics.presentCount}</span>
                                        <UserCheck className="w-5 h-5 text-emerald-600 bg-emerald-50 p-1 rounded" />
                                    </div>
                                </Card>

                                <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Aguardando/Atrasados</span>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-2xl font-black text-amber-600">{metrics.lateCount}</span>
                                        <Clock className="w-5 h-5 text-amber-600 bg-amber-50 p-1 rounded" />
                                    </div>
                                </Card>

                                <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Cobertos</span>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-2xl font-black text-blue-600">{metrics.coveredCount}</span>
                                        <RefreshCw className="w-5 h-5 text-blue-600 bg-blue-50 p-1 rounded" />
                                    </div>
                                </Card>

                                <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Vagos (Sem Cobertura)</span>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-2xl font-black text-red-600">{metrics.vacantCount}</span>
                                        <UserX className="w-5 h-5 text-red-600 bg-red-50 p-1 rounded" />
                                    </div>
                                </Card>
                            </div>

                            {/* Table Card */}
                            <Card className="border-none shadow-premium bg-white overflow-hidden">
                                <div className="w-full overflow-x-auto">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                                            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                                            <span className="text-xs text-slate-500 font-semibold">Carregando dados da escala...</span>
                                        </div>
                                    ) : activeContractId === null ? (
                                        /* Contract Master List View */
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="font-bold text-slate-800">Contrato / Unidade</TableHead>
                                                    <TableHead className="font-bold text-slate-800">Endereço</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-center">Total de Postos</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-center">Status de Presença</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-right pr-6">Ação</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {groupedContracts.map((contract) => (
                                                    <TableRow 
                                                        key={contract.id} 
                                                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                                                        onClick={() => {
                                                            setActiveContractId(contract.id);
                                                            setSelectedContractId(contract.id);
                                                        }}
                                                    >
                                                        <TableCell className="font-bold text-slate-900 text-sm">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="font-black text-slate-850">{contract.name}</span>
                                                                <span className="text-[9px] text-primary font-bold uppercase tracking-widest">{contract.companyName}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-slate-500 text-xs max-w-[300px] truncate">
                                                            {contract.address}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-sm font-bold text-slate-800">{contract.totalContractPostos} Postos</span>
                                                                <span className="text-[10px] text-slate-400 font-medium">{contract.total} em escala hoje</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <div className="flex justify-center items-center gap-1.5 flex-wrap">
                                                                {contract.present > 0 && (
                                                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 text-[10px] font-bold">
                                                                        {contract.present} Presentes
                                                                    </Badge>
                                                                )}
                                                                {contract.late > 0 && (
                                                                    <Badge className="bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-50 text-[10px] font-bold">
                                                                        {contract.late} Atrasados
                                                                    </Badge>
                                                                )}
                                                                {contract.covered > 0 && (
                                                                    <Badge className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50 text-[10px] font-bold">
                                                                        {contract.covered} Cobertos
                                                                    </Badge>
                                                                )}
                                                                {contract.vacant > 0 && (
                                                                    <Badge className="bg-red-50 text-red-700 border-red-100 hover:bg-red-50 text-[10px] font-bold">
                                                                        {contract.vacant} Vagos
                                                                    </Badge>
                                                                )}
                                                                {contract.present === 0 && contract.late === 0 && contract.covered === 0 && contract.vacant === 0 && (
                                                                    <span className="text-xs text-slate-400 italic">Nenhuma escala ativa</span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right pr-6">
                                                            <Button variant="ghost" size="sm" className="text-xs font-semibold text-primary hover:text-primary/80">
                                                                Ver Detalhes →
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {groupedContracts.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center text-slate-500 py-20 font-semibold">
                                                            Nenhum contrato ativo sob sua gestão na data selecionada.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        /* Contract Detailed View of Posts (First Column removed) */
                                        <div>
                                            <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => {
                                                            setActiveContractId(null);
                                                            setSelectedContractId("all");
                                                        }}
                                                        className="text-xs gap-1.5 h-8 border-slate-200"
                                                    >
                                                        ← Voltar para Contratos
                                                    </Button>
                                                    <span className="text-sm font-bold text-slate-800">
                                                        Detalhamento do Contrato: {items[0]?.clientName || "Contrato"}
                                                    </span>
                                                </div>
                                            </div>
                                            <Table>
                                                <TableHeader className="bg-slate-50">
                                                    <TableRow>
                                                        <TableHead className="font-bold text-slate-800">Função / Cargo</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-center">Horário</TableHead>
                                                        <TableHead className="font-bold text-slate-800">Titular do Posto</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-center">Valor Mensal</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-center">Status do Posto</TableHead>
                                                        <TableHead className="font-bold text-slate-800">Observações Operacionais</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {items.map((item) => {
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
                                                                <TableCell className="text-slate-700 text-xs font-semibold">
                                                                    {item.role}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-xs font-bold text-slate-850">{item.startTime} - {item.endTime}</span>
                                                                        <span className="text-[9px] bg-slate-100 px-1 rounded text-slate-500 font-mono mt-0.5">{item.schedule}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-slate-800 text-xs font-medium">
                                                                    {item.employeeName}
                                                                </TableCell>
                                                                <TableCell className="text-center text-xs font-mono font-bold text-slate-705">
                                                                    {item.billingValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    {statusBadge}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-slate-500 font-medium italic">
                                                                    {att.notes || (att.status === "FALTA" && !att.coveredByName ? "Posto desocupado sem aviso de cobertura." : "-")}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                    {items.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={6} className="text-center text-slate-500 py-20 font-semibold">
                                                                Nenhum posto cadastrado neste contrato.
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            </Card>

                            {/* Info Note */}
                            <div className="text-[10px] text-slate-400 bg-slate-100 rounded-lg p-3 flex items-start gap-2 border border-slate-200/50">
                                <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold uppercase tracking-wider text-slate-500 mb-0.5">Nota de Conformidade e Transparência</p>
                                    <p className="leading-relaxed">Este painel exibe dados de controle de ponto e efetivo auditados. Apontamentos manuais de presença ou justificados de falta são informados pela mesa de operações da Prestadora. Glosas financeiras diárias são computadas de acordo com as regras contratuais acordadas.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "requests" && (
                        /* TAB 2: REQUESTS (Solicitações) */
                        <div className="space-y-6">
                            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">Solicitações e Ocorrências</h3>
                                    <p className="text-xs text-slate-500 font-medium">Abra chamados para coberturas extras, reclamações, fardamentos, EPIs ou movimentação de equipe.</p>
                                </div>
                                <Button onClick={() => setShowNewRequestModal(true)} className="gap-2 bg-primary hover:bg-primary/95 text-slate-900 font-bold text-xs uppercase tracking-wider h-10 px-4 rounded-xl shadow-premium">
                                    <Plus className="w-4 h-4" /> Nova Solicitação
                                </Button>
                            </div>

                            {/* List of Requests */}
                            <Card className="border-none shadow-premium bg-white overflow-hidden">
                                <div className="w-full overflow-x-auto">
                                    {loadingRequests ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                                            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                                            <span className="text-xs text-slate-500 font-semibold">Carregando chamados...</span>
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="font-bold text-slate-800">Tipo de Solicitação</TableHead>
                                                    <TableHead className="font-bold text-slate-800">Data Abertura</TableHead>
                                                    <TableHead className="font-bold text-slate-800">Descrição</TableHead>
                                                    <TableHead className="font-bold text-slate-800">Colaborador Relacionado</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-center">Status</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-center">Prazo SLA</TableHead>
                                                    <TableHead className="font-bold text-slate-800">Retorno da Operação</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {requests.map((req) => {
                                                    let typeLabel = "";
                                                    let typeColor = "";
                                                    if (req.type === "MOVIMENTACAO") { typeLabel = "Movimentação"; typeColor = "bg-blue-50 text-blue-700 border-blue-100"; }
                                                    else if (req.type === "UNIFORME") { typeLabel = "Material / Uniforme"; typeColor = "bg-orange-50 text-orange-700 border-orange-100"; }
                                                    else if (req.type === "HORARIO" || req.type === "MUDANCA_ESCALA") { typeLabel = "Mudança de Escala"; typeColor = "bg-purple-50 text-purple-700 border-purple-100"; }
                                                    else { typeLabel = "Outros / Reclamação / Elogio"; typeColor = "bg-slate-100 text-slate-700 border-slate-200"; }

                                                    let statusLabel = req.status;
                                                    let statusColor = "bg-slate-100 text-slate-750";
                                                    if (req.status === "PENDENTE") { statusLabel = "Pendente"; statusColor = "bg-slate-100 text-slate-700 border-slate-200"; }
                                                    else if (req.status === "AGUARDANDO_APROVACAO") { statusLabel = "Aguardando Aprovação"; statusColor = "bg-amber-50 text-amber-700 border-amber-200"; }
                                                    else if (req.status === "EM_ANDAMENTO") { statusLabel = "Em Andamento"; statusColor = "bg-sky-50 text-sky-700 border-sky-200"; }
                                                    else if (req.status === "CONCLUIDO") { statusLabel = "Concluído"; statusColor = "bg-emerald-50 text-emerald-700 border-emerald-250"; }
                                                    else if (req.status === "REJEITADO") { statusLabel = "Recusado"; statusColor = "bg-red-50 text-red-750 border-red-200"; }

                                                    // Calcular status de SLA
                                                    const isResolved = req.status === "CONCLUIDO" || req.status === "REJEITADO";
                                                    const resolutionDate = req.updatedAt ? new Date(req.updatedAt) : new Date();
                                                    const dueDate = new Date(req.dueDate);
                                                    const now = new Date();
                                                    
                                                    let slaBadge = null;
                                                    if (isResolved) {
                                                        const wasOnTime = resolutionDate <= dueDate;
                                                        slaBadge = wasOnTime ? (
                                                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold hover:opacity-100">No Prazo</Badge>
                                                        ) : (
                                                            <Badge className="bg-red-50 text-red-700 border-red-200 font-bold hover:opacity-100">Estourado</Badge>
                                                        );
                                                    } else {
                                                        const isLate = now > dueDate;
                                                        slaBadge = isLate ? (
                                                            <Badge className="bg-red-50 text-red-750 border-red-200 font-black animate-pulse hover:opacity-100">Expirado</Badge>
                                                        ) : (
                                                            <Badge className="bg-sky-50 text-sky-750 border-sky-200 font-bold hover:opacity-100">No Prazo</Badge>
                                                        );
                                                    }

                                                    const hasFirstResponse = req.status !== "PENDENTE" || (req.comments || []).some((c: any) => c.user?.role !== "CLIENTE");

                                                    return (
                                                        <TableRow 
                                                            key={req.id} 
                                                            onClick={() => setSelectedRequest(req)}
                                                            className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                                                        >
                                                            <TableCell className="font-bold text-xs text-slate-900">
                                                                <Badge className={`${typeColor} font-black hover:opacity-100`}>{typeLabel}</Badge>
                                                            </TableCell>
                                                            <TableCell className="text-slate-600 text-xs font-semibold">
                                                                {format(new Date(req.createdAt), "dd/MM/yyyy HH:mm")}
                                                            </TableCell>
                                                            <TableCell className="text-slate-800 text-xs max-w-[280px] break-words">
                                                                {req.description}
                                                            </TableCell>
                                                            <TableCell className="text-slate-700 text-xs font-semibold">
                                                                {req.employee?.name || "-"}
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge className={`${statusColor} font-black hover:opacity-100`}>{statusLabel}</Badge>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <div className="flex flex-col items-center gap-0.5">
                                                                    <span className="text-[11px] font-bold text-slate-700">{format(dueDate, "dd/MM/yyyy")}</span>
                                                                    <span className="text-[8px] font-black uppercase text-slate-400">
                                                                        {hasFirstResponse ? "Solução" : "1ª Resposta"}
                                                                    </span>
                                                                    {slaBadge}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-slate-500 font-medium italic">
                                                                {req.resolutionNotes || "Aguardando análise da mesa de operações..."}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                                {requests.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="text-center text-slate-500 py-20 font-semibold">
                                                            Nenhum chamado aberto. Clique em "+ Nova Solicitação" para criar.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                            </Card>

                            {/* Modal de Nova Solicitação */}
                            {showNewRequestModal && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/50 backdrop-blur-sm">
                                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
                                        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                                            <h3 className="text-sm font-black uppercase tracking-wider">Nova Ocorrência / Chamado</h3>
                                            <Button variant="ghost" size="icon" onClick={() => setShowNewRequestModal(false)} className="text-slate-400 hover:text-white">
                                                <X className="w-5 h-5" />
                                            </Button>
                                        </div>
                                        <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
                                            {/* Categoria de Ocorrência Principal (Lista Suspensa) */}
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Categoria de Ocorrência</label>
                                                <select
                                                    value={requestCategory}
                                                    onChange={(e) => {
                                                        setRequestCategory(e.target.value as any);
                                                        setNewRequestEmployeeId("");
                                                    }}
                                                    className="w-full h-10 border border-slate-200 bg-white rounded-xl text-xs font-semibold px-3 outline-none focus:border-primary cursor-pointer text-slate-800"
                                                >
                                                    <option value="solicitacao">Solicitação</option>
                                                    <option value="elogio_sugestao">Elogio / Sugestão</option>
                                                    <option value="reclamacao">Reclamação</option>
                                                </select>
                                            </div>

                                            {/* Subformulários baseados na Categoria */}
                                            {requestCategory === "solicitacao" && (
                                                <div className="space-y-4">
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">O que deseja solicitar?</label>
                                                        <select
                                                            value={solicitacaoSubtype}
                                                            onChange={(e) => {
                                                                setSolicitacaoSubtype(e.target.value as any);
                                                                setNewRequestEmployeeId("");
                                                            }}
                                                            className="w-full h-10 border border-slate-200 bg-white rounded-xl text-xs font-semibold px-3 outline-none focus:border-primary cursor-pointer"
                                                        >
                                                            <option value="troca_colaborador">Pedir troca de colaboradores</option>
                                                            <option value="uniformes_produtos">Solicitar materiais / EPIs / Uniformes / Produtos</option>
                                                            <option value="servicos_extras">Solicitar serviços extras</option>
                                                        </select>
                                                    </div>

                                                    {solicitacaoSubtype === "troca_colaborador" ? (
                                                        <div className="space-y-1">
                                                            <label className="text-xs font-bold text-slate-650 uppercase tracking-wider flex items-center justify-between">
                                                                <span>Colaborador Relacionado *</span>
                                                                <span className="text-[9px] font-black uppercase text-red-500 bg-red-50 px-2 py-0.5 rounded-md border border-red-200/50">Obrigatório</span>
                                                            </label>
                                                            <select
                                                                value={newRequestEmployeeId}
                                                                onChange={(e) => setNewRequestEmployeeId(e.target.value)}
                                                                className="w-full h-10 border border-slate-200 bg-white rounded-xl text-xs font-semibold px-3 outline-none focus:border-primary cursor-pointer text-slate-800"
                                                                required
                                                            >
                                                                <option value="">-- Selecione o colaborador para a troca --</option>
                                                                {employees.map(emp => (
                                                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <label className="text-xs font-bold text-slate-655 uppercase tracking-wider">Colaborador Relacionado (Opcional)</label>
                                                            <select
                                                                value={newRequestEmployeeId}
                                                                onChange={(e) => setNewRequestEmployeeId(e.target.value)}
                                                                className="w-full h-10 border border-slate-200 bg-white rounded-xl text-xs font-semibold px-3 outline-none focus:border-primary cursor-pointer text-slate-800"
                                                            >
                                                                <option value="">Não Relacionado a Colaborador Específico</option>
                                                                {employees.map(emp => (
                                                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {requestCategory === "reclamacao" && (
                                                <div className="space-y-4">
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Motivo da Reclamação</label>
                                                        <select
                                                            value={reclamacaoCategory}
                                                            onChange={(e) => setReclamacaoCategory(e.target.value as any)}
                                                            className="w-full h-10 border border-slate-200 bg-white rounded-xl text-xs font-semibold px-3 outline-none focus:border-primary cursor-pointer text-slate-800"
                                                        >
                                                            <option value="qualidade_servicos">Qualidade dos serviços</option>
                                                            <option value="visita_supervisao">Visitas da supervisão</option>
                                                            <option value="falta_sem_cobertura">Falta sem cobertura</option>
                                                            <option value="atraso_recorrente">Atraso recorrente</option>
                                                            <option value="postura_uniforme">Postura / Uniformização inadequada</option>
                                                            <option value="problemas_epi">Problemas com EPI / Equipamento</option>
                                                            <option value="outras">Outras Reclamações</option>
                                                        </select>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-xs font-bold text-slate-655 uppercase tracking-wider">Colaborador Envolvido (Opcional)</label>
                                                        <select
                                                            value={newRequestEmployeeId}
                                                            onChange={(e) => setNewRequestEmployeeId(e.target.value)}
                                                            className="w-full h-10 border border-slate-200 bg-white rounded-xl text-xs font-semibold px-3 outline-none focus:border-primary cursor-pointer text-slate-800"
                                                        >
                                                            <option value="">Não Relacionado a Colaborador Específico</option>
                                                            {employees.map(emp => (
                                                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}

                                            {requestCategory === "elogio_sugestao" && (
                                                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50 text-[11px] text-emerald-800 font-semibold leading-relaxed">
                                                    💡 Use este canal para compartilhar sugestões de melhoria ou elogiar o desempenho da nossa equipe. Suas mensagens serão enviadas diretamente à nossa gerência.
                                                </div>
                                            )}

                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Descrição Detalhada *</label>
                                                <textarea
                                                    value={newRequestDescription}
                                                    onChange={(e) => setNewRequestDescription(e.target.value)}
                                                    placeholder={
                                                        requestCategory === "solicitacao" ? "Descreva detalhadamente sua solicitação, quantidades, tamanhos ou detalhes operacionais..." :
                                                        requestCategory === "reclamacao" ? "Descreva a ocorrência com detalhes, datas e observações importantes..." :
                                                        "Escreva aqui sua sugestão ou elogio..."
                                                    }
                                                    rows={4}
                                                    className="w-full border border-slate-200 rounded-xl text-xs font-semibold p-3 outline-none focus:border-primary resize-none text-slate-800"
                                                    required
                                                />
                                            </div>

                                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                                <Button type="button" variant="outline" onClick={() => setShowNewRequestModal(false)} className="h-10 text-xs font-bold uppercase tracking-wider px-4 rounded-xl">
                                                    Cancelar
                                                </Button>
                                                <Button type="submit" disabled={submittingRequest} className="h-10 text-xs font-bold uppercase tracking-wider px-4 bg-primary text-slate-900 hover:bg-primary/95 rounded-xl shadow-sm">
                                                    {submittingRequest ? "Enviando..." : "Registrar Chamado"}
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {/* Modal de Detalhes e Interação com a Solicitação */}
                            {selectedRequest && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/50 backdrop-blur-sm p-4">
                                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                                        {/* Header */}
                                        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
                                            <div className="flex flex-col">
                                                <h3 className="text-sm font-black uppercase tracking-wider">Detalhes do Chamado</h3>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Criado em {format(new Date(selectedRequest.createdAt), "dd/MM/yyyy HH:mm")}</span>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={() => setSelectedRequest(null)} className="text-slate-400 hover:text-white">
                                                <X className="w-5 h-5" />
                                            </Button>
                                        </div>

                                        {/* Corpo (Rolável) */}
                                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                                            {/* Bloco de Informações Principais */}
                                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/50 text-xs">
                                                <div>
                                                    <span className="text-[9px] font-black uppercase text-slate-400 block">Status atual</span>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-black inline-block mt-0.5 border bg-slate-100 text-slate-850 border-slate-250">
                                                        {selectedRequest.status === "PENDENTE" && "Pendente"}
                                                        {selectedRequest.status === "AGUARDANDO_APROVACAO" && "Aguardando Op."}
                                                        {selectedRequest.status === "EM_ANDAMENTO" && "Em Execução"}
                                                        {selectedRequest.status === "CONCLUIDO" && "Concluído"}
                                                        {selectedRequest.status === "REJEITADO" && "Recusado"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-black uppercase text-slate-400 block">
                                                        {selectedRequest.status !== "PENDENTE" || (selectedRequest.comments || []).some((c: any) => c.user?.role !== "CLIENTE") 
                                                            ? "Previsão de Solução" 
                                                            : "Prazo para 1ª Resposta"
                                                        }
                                                    </span>
                                                    <span className="font-extrabold text-slate-700 block mt-0.5">{format(new Date(selectedRequest.dueDate), "dd/MM/yyyy")}</span>
                                                </div>
                                            </div>

                                            {/* Campos Editáveis se PENDENTE, senão apenas leitura */}
                                            {selectedRequest.status === "PENDENTE" ? (
                                                <div className="space-y-3 p-3.5 bg-blue-50/20 border border-blue-100/50 rounded-xl">
                                                    <div className="text-[10px] font-bold text-blue-800 uppercase flex items-center justify-between mb-1 select-none">
                                                        <span>✏️ Editar Informações</span>
                                                        <span className="bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded font-black text-[9px]">Aberto</span>
                                                    </div>
                                                    
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Descrição Detalhada</label>
                                                        <textarea
                                                            value={selectedRequest.description || ""}
                                                            onChange={(e) => setSelectedRequest({ ...selectedRequest, description: e.target.value })}
                                                            rows={3}
                                                            className="w-full border border-slate-200 bg-white rounded-xl text-xs font-semibold p-2.5 outline-none focus:border-primary resize-none text-slate-800 leading-relaxed"
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Colaborador Relacionado</label>
                                                        <select
                                                            value={selectedRequest.employeeId || ""}
                                                            onChange={(e) => setSelectedRequest({ ...selectedRequest, employeeId: e.target.value || null })}
                                                            className="w-full h-9 border border-slate-200 bg-white rounded-xl text-xs font-semibold px-2 outline-none focus:border-primary cursor-pointer text-slate-800"
                                                        >
                                                            <option value="">Não Relacionado / Nenhum Colaborador</option>
                                                            {employees.map(emp => (
                                                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <Button 
                                                        type="button" 
                                                        disabled={savingRequestDetails}
                                                        onClick={handleSaveClientRequestDetails}
                                                        className="w-full h-8 text-[10px] font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                                                    >
                                                        {savingRequestDetails ? "Salvando..." : "Salvar Alterações"}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="space-y-1">
                                                        <span className="text-[9px] font-black uppercase text-slate-400 block font-bold">Descrição da Ocorrência</span>
                                                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 leading-relaxed whitespace-pre-wrap">
                                                            {selectedRequest.description}
                                                        </div>
                                                    </div>
                                                    {selectedRequest.employee?.name && (
                                                        <div className="space-y-1">
                                                            <span className="text-[9px] font-black uppercase text-slate-400 block font-bold">Colaborador Relacionado</span>
                                                            <div className="p-2 bg-blue-50/30 border border-blue-100 rounded-xl text-xs font-bold text-blue-900">
                                                                {selectedRequest.employee.name}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Histórico do chamado (Comentários e Notas) */}
                                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block font-bold">Histórico de Mensagens / Respostas</span>
                                                
                                                {/* Chat de mensagens */}
                                                <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                    {/* Parecer JVS se houver */}
                                                    {selectedRequest.resolutionNotes && (
                                                        <div className="flex flex-col gap-1 items-start">
                                                            <div className="bg-slate-200 text-slate-800 p-2.5 rounded-2xl rounded-tl-none max-w-[85%] text-xs font-medium leading-relaxed">
                                                                <span className="text-[9px] font-black uppercase text-slate-500 block mb-0.5">Operação JVS (Resolução)</span>
                                                                {selectedRequest.resolutionNotes}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Comentários adicionais */}
                                                    {(selectedRequest.comments || []).length === 0 && !selectedRequest.resolutionNotes ? (
                                                        <div className="text-center text-[10px] font-medium text-slate-400 py-6 italic">Sem mensagens adicionais registradas.</div>
                                                    ) : (
                                                        (selectedRequest.comments || []).map((comm: any) => {
                                                            const isMyComment = comm.user?.role === "CLIENTE";
                                                            return (
                                                                <div key={comm.id} className={`flex flex-col gap-1 ${isMyComment ? "items-end" : "items-start"}`}>
                                                                    <div className={`p-2.5 rounded-2xl text-xs font-medium leading-relaxed max-w-[85%] ${
                                                                        isMyComment 
                                                                            ? "bg-slate-900 text-white rounded-tr-none" 
                                                                            : "bg-slate-250 text-slate-800 rounded-tl-none"
                                                                    }`}>
                                                                        <span className="text-[9px] font-black uppercase block opacity-70 mb-0.5">
                                                                            {isMyComment ? "Você" : (comm.user?.name || "Operador")}
                                                                        </span>
                                                                        {comm.content}
                                                                    </div>
                                                                    <span className="text-[8px] font-semibold text-slate-400 px-1">{format(new Date(comm.createdAt), "dd/MM/yyyy HH:mm")}</span>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>

                                                {/* Enviar novo comentário / resposta */}
                                                <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t border-slate-100/50">
                                                    <input
                                                        type="text"
                                                        placeholder="Digite uma mensagem para a operação..."
                                                        value={newCommentContent}
                                                        onChange={(e) => setNewCommentContent(e.target.value)}
                                                        className="flex-1 h-9 border border-slate-200 bg-white rounded-xl text-xs font-semibold px-3 outline-none focus:border-primary text-slate-800"
                                                        required
                                                    />
                                                    <Button 
                                                        type="submit" 
                                                        disabled={submittingComment || !newCommentContent.trim()}
                                                        className="h-9 text-[10px] font-black uppercase tracking-wider px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shrink-0 cursor-pointer"
                                                    >
                                                        {submittingComment ? "..." : "Responder"}
                                                    </Button>
                                                </form>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
                                            <Button type="button" variant="outline" onClick={() => setSelectedRequest(null)} className="h-9 text-xs font-bold uppercase tracking-wider px-4 rounded-xl cursor-pointer">
                                                Fechar
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "billing" && (
                        /* TAB 3: BILLING (Faturamento) */
                        <div className="space-y-6">
                            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">Faturamento Mensal e Efetividade</h3>
                                    <p className="text-xs text-slate-500 font-medium">Demonstrativo consolidado de faturamento e glosas por faltas não cobertas.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={billingYear}
                                        onChange={(e) => setBillingYear(Number(e.target.value))}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value={2026}>Ano 2026</option>
                                        <option value={2025}>Ano 2025</option>
                                    </select>
                                    <Button variant="ghost" size="icon" onClick={() => fetchBilling(billingYear)} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                                        <RefreshCw className={`w-4 h-4 text-slate-500 ${loadingBilling ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                            </div>

                            {/* Billing Statistics Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <Card className="border-none shadow-premium bg-slate-900 text-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-300">Bruto Previsto (Mensal)</span>
                                    <div className="flex items-baseline justify-between mt-1">
                                        <span className="text-xl font-black">
                                            {billingData[0]?.expectedBilling.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00"}
                                        </span>
                                    </div>
                                </Card>

                                <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700 font-semibold">Total de Glosas (Acumulado)</span>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-xl font-black text-red-650">
                                            {billingData.reduce((sum, m) => sum + m.glosas, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                        </span>
                                    </div>
                                </Card>

                                <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700 font-semibold">Total Líquido (Acumulado)</span>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-xl font-black text-emerald-600">
                                            {billingData.reduce((sum, m) => sum + m.netBilling, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                        </span>
                                    </div>
                                </Card>

                                <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700 font-semibold">Efetividade Operacional</span>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-xl font-black text-blue-600">
                                            {(billingData.length > 0 
                                                ? (billingData.reduce((sum, m) => sum + m.effectiveness, 0) / billingData.length).toFixed(1) 
                                                : "100.0")}%
                                        </span>
                                    </div>
                                </Card>
                            </div>

                            {/* Billing Table */}
                            <Card className="border-none shadow-premium bg-white overflow-hidden">
                                <div className="w-full overflow-x-auto">
                                    {loadingBilling ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                                            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                                            <span className="text-xs text-slate-500 font-semibold">Calculando faturamento...</span>
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="font-bold text-slate-800">Mês</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-right pr-6">Faturamento Previsto</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-right pr-6">Desconto de Glosas</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-right pr-6">Faturamento Líquido</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-center">Efetividade Operacional</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-center">Escalas / Faltas</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {billingData.map((m) => (
                                                    <TableRow key={m.monthIndex} className="hover:bg-slate-50/50 transition-colors">
                                                        <TableCell className="font-bold text-xs text-slate-900">
                                                            {m.name}
                                                        </TableCell>
                                                        <TableCell className="text-right pr-6 font-semibold text-xs text-slate-700">
                                                            {m.expectedBilling.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                        </TableCell>
                                                        <TableCell className={`text-right pr-6 font-semibold text-xs ${m.glosas > 0 ? 'text-red-650' : 'text-slate-500'}`}>
                                                            {m.glosas > 0 ? `-${m.glosas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : "R$ 0,00"}
                                                        </TableCell>
                                                        <TableCell className="text-right pr-6 font-bold text-xs text-emerald-650">
                                                            {m.netBilling.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge className={`${
                                                                m.effectiveness >= 95 ? 'bg-emerald-50 text-emerald-700' :
                                                                m.effectiveness >= 90 ? 'bg-amber-50 text-amber-700' :
                                                                'bg-red-50 text-red-700'
                                                            } hover:opacity-100 font-bold`}>
                                                                {m.effectiveness.toFixed(1)}%
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center text-xs font-semibold text-slate-505">
                                                            {m.totalShifts} Escalas / <span className={m.vacantShifts > 0 ? "text-red-650 font-bold" : ""}>{m.vacantShifts} Faltas</span>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeTab === "monthly_report" && (
                        /* TAB 4: MONTHLY REPORT */
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">Relatório de Efetividade e Ocorrências</h3>
                                    <p className="text-xs text-slate-500 font-medium">Histórico completo de presenças, coberturas e faltas do mês selecionado.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={reportMonth}
                                        onChange={(e) => setReportMonth(Number(e.target.value))}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value={0}>Janeiro</option>
                                        <option value={1}>Fevereiro</option>
                                        <option value={2}>Março</option>
                                        <option value={3}>Abril</option>
                                        <option value={4}>Maio</option>
                                        <option value={5}>Junho</option>
                                        <option value={6}>Julho</option>
                                        <option value={7}>Agosto</option>
                                        <option value={8}>Setembro</option>
                                        <option value={9}>Outubro</option>
                                        <option value={10}>Novembro</option>
                                        <option value={11}>Dezembro</option>
                                    </select>
                                    <select
                                        value={reportYear}
                                        onChange={(e) => setReportYear(Number(e.target.value))}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value={2026}>Ano 2026</option>
                                        <option value={2025}>Ano 2025</option>
                                    </select>
                                    <Button variant="ghost" size="icon" onClick={() => fetchReport(reportMonth, reportYear)} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                                        <RefreshCw className={`w-4 h-4 text-slate-500 ${loadingReport ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                            </div>

                            {/* Consolidated Stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <Card className="border-none shadow-premium bg-slate-900 text-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-300">Presenças Confirmadas</span>
                                    <div className="flex items-baseline justify-between mt-1">
                                        <span className="text-2xl font-black">
                                            {reportData.filter(r => r.status === "PRESENTE_PONTO" || r.status === "PRESENTE_MANUAL").length}
                                        </span>
                                    </div>
                                </Card>

                                <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700 font-semibold">Faltas Cobertas</span>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-2xl font-black text-blue-600">
                                            {reportData.filter(r => r.status === "FALTA" && (r.coveredByName || r.coverageType)).length}
                                        </span>
                                    </div>
                                </Card>

                                <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700 font-semibold">Postos Vagos (Glosas)</span>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-2xl font-black text-red-650">
                                            {reportData.filter(r => r.status === "FALTA" && !r.coveredByName && !r.coverageType).length}
                                        </span>
                                    </div>
                                </Card>

                                <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-700 font-semibold">Efetividade Geral</span>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-2xl font-black text-emerald-650">
                                            {(() => {
                                                const active = reportData.filter(r => r.status !== "FOLGA");
                                                const total = active.length;
                                                const vacant = active.filter(r => r.status === "FALTA" && !r.coveredByName && !r.coverageType).length;
                                                return total > 0 ? ((total - vacant) / total * 100).toFixed(1) + "%" : "100.0%";
                                            })()}
                                        </span>
                                    </div>
                                </Card>
                            </div>

                            {/* Monthly Roster Table */}
                            <Card className="border-none shadow-premium bg-white overflow-hidden">
                                <div className="w-full overflow-x-auto">
                                    {loadingReport ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                                            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                                            <span className="text-xs text-slate-500 font-semibold">Construindo relatório...</span>
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="font-bold text-slate-800">Data</TableHead>
                                                    <TableHead className="font-bold text-slate-800">Unidade</TableHead>
                                                    <TableHead className="font-bold text-slate-800">Cargo / Função</TableHead>
                                                    <TableHead className="font-bold text-slate-800">Colaborador</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-center">Status</TableHead>
                                                    <TableHead className="font-bold text-slate-800">Notas Operacionais</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {reportData.map((row) => {
                                                    let statusBadge = null;
                                                    let rowBgClass = "";

                                                    if (row.status === "PRESENTE_PONTO" || row.status === "PRESENTE_MANUAL") {
                                                        statusBadge = <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 font-bold">● Confirmado</Badge>;
                                                    } else if (row.status === "FALTA") {
                                                        if (row.coveredByName) {
                                                            statusBadge = <Badge className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50 font-bold">● Falta Coberta: {row.coveredByName}</Badge>;
                                                        } else if (row.coverageType === "DIARISTA") {
                                                            statusBadge = <Badge className="bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-50 font-bold">● Coberto Diarista</Badge>;
                                                        } else {
                                                            rowBgClass = "bg-red-50/20";
                                                            statusBadge = <Badge className="bg-red-50 text-red-700 border-red-150 hover:bg-red-50 font-black animate-pulse">▲ Posto Vago (Glosa)</Badge>;
                                                        }
                                                    } else if (row.status === "FOLGA") {
                                                        rowBgClass = "opacity-75 bg-slate-100/40";
                                                        statusBadge = <Badge className="bg-slate-100 text-slate-500 border-slate-200/50 hover:bg-slate-100 font-semibold select-none">○ Folga</Badge>;
                                                    } else {
                                                        statusBadge = <Badge className="bg-slate-100 text-slate-650 border-none hover:bg-slate-100">○ Aguardando</Badge>;
                                                    }

                                                    return (
                                                        <TableRow key={row.id} className={`hover:bg-slate-50/50 transition-colors ${rowBgClass}`}>
                                                            <TableCell className="text-slate-805 text-xs font-bold">
                                                                {format(new Date(row.date), "dd/MM/yyyy")}
                                                            </TableCell>
                                                            <TableCell className="text-slate-800 text-xs font-semibold truncate max-w-[150px]">
                                                                {row.clientName}
                                                            </TableCell>
                                                            <TableCell className="text-slate-700 text-xs font-semibold">
                                                                {row.roleName}
                                                            </TableCell>
                                                            <TableCell className="text-slate-800 text-xs font-semibold">
                                                                {row.employeeName}
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                {statusBadge}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-slate-500 font-medium italic">
                                                                {row.notes || "-"}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                                {reportData.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center text-slate-500 py-20 font-semibold">
                                                            Nenhum registro encontrado para o mês selecionado.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeTab === "nps" && (
                        /* TAB 5: NPS (Avaliação de Satisfação) */
                        <div className="space-y-6 max-w-4xl mx-auto">
                            <div className="bg-white p-6 rounded-2xl shadow-premium border border-slate-200/50 space-y-4">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-black text-slate-850">Pesquisa de Satisfação - NPS</h3>
                                    <p className="text-xs text-slate-500 font-medium">Sua opinião é fundamental para evoluirmos a qualidade e eficiência operacional do nosso time.</p>
                                </div>

                                <form onSubmit={handleNpsSubmit} className="space-y-6 pt-4 border-t border-slate-100">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Selecione o Contrato / Unidade sob Avaliação</label>
                                        <select
                                            value={selectedNpsClientId}
                                            onChange={(e) => handleNpsClientChange(e.target.value)}
                                            className="w-full md:w-1/2 h-10 border border-slate-250 bg-white rounded-xl text-xs font-semibold px-3 outline-none focus:border-primary"
                                            required
                                        >
                                            <option value="">-- Selecione uma Unidade --</option>
                                            {contracts.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {selectedNpsClientId && dynamicNpsQuestions.length > 0 ? (
                                        <div className="space-y-6">
                                            {dynamicNpsQuestions.map((q) => {
                                                const currentAnswer = npsAnswers[q.id];
                                                return (
                                                    <div key={q.id} className="space-y-3 p-5 rounded-2xl border border-slate-200 bg-slate-50/40 shadow-sm">
                                                        <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                                                            {q.text}
                                                        </label>
                                                        <div className="flex justify-between items-center w-full pt-1 gap-1 flex-wrap md:flex-nowrap">
                                                            {[...Array(11).keys()].map((num) => {
                                                                const selected = currentAnswer === num;
                                                                let btnClass = "border-slate-200 hover:bg-slate-100";
                                                                if (selected) {
                                                                    if (num <= 6) btnClass = "bg-red-600 text-white border-red-600 shadow-md";
                                                                    else if (num <= 8) btnClass = "bg-amber-500 text-white border-amber-500 shadow-md";
                                                                    else btnClass = "bg-emerald-600 text-white border-emerald-600 shadow-md";
                                                                } else {
                                                                    if (num <= 6) btnClass = "bg-red-50/20 text-red-700 border-red-100 hover:bg-red-50";
                                                                    else if (num <= 8) btnClass = "bg-amber-50/20 text-amber-700 border-amber-100 hover:bg-amber-50";
                                                                    else btnClass = "bg-emerald-50/20 text-emerald-700 border-emerald-100 hover:bg-emerald-50";
                                                                }

                                                                return (
                                                                    <button
                                                                        key={num}
                                                                        type="button"
                                                                        onClick={() => setNpsAnswers(prev => ({ ...prev, [q.id]: num }))}
                                                                        className={`w-9 h-9 md:w-10 md:h-10 rounded-full border text-[11px] md:text-xs font-black flex items-center justify-center transition-all ${btnClass}`}
                                                                    >
                                                                        {num}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1 select-none">
                                                <span className="text-red-500">Insatisfeito (0 a 6)</span>
                                                <span className="text-amber-500">Neutro (7 ou 8)</span>
                                                <span className="text-emerald-500">Satisfeito (9 ou 10)</span>
                                            </div>
                                        </div>
                                    ) : (
                                        selectedNpsClientId && (
                                            <div className="text-center py-6 text-xs text-slate-400 font-semibold italic">
                                                Carregando perguntas da avaliação...
                                            </div>
                                        )
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Conte-nos o motivo da sua nota ou envie sugestões de melhoria (Opcional)</label>
                                        <textarea
                                            value={npsFeedback}
                                            onChange={(e) => setNpsFeedback(e.target.value)}
                                            placeholder="O que estamos fazendo bem? O que podemos fazer para melhorar?"
                                            rows={4}
                                            className="w-full border border-slate-200 rounded-xl text-xs font-semibold p-3 outline-none focus:border-primary resize-none"
                                        />
                                    </div>

                                    <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                                        <Button
                                            type="submit"
                                            disabled={submittingNps || !selectedNpsClientId || dynamicNpsQuestions.length === 0 || !dynamicNpsQuestions.every(q => npsAnswers[q.id] !== undefined)}
                                            className="h-11 text-xs font-bold uppercase tracking-wider px-6 bg-primary text-slate-900 hover:bg-primary/95 rounded-xl shadow-premium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {submittingNps ? "Enviando..." : "Enviar Avaliação"}
                                        </Button>
                                    </div>
                                </form>
                            </div>

                            {/* Tabela de Evolução Mensal do NPS por Quesito */}
                            {slaData && slaData.npsEvolution && slaData.npsEvolution.length > 0 && (
                                <Card className="bg-white p-6 rounded-2xl shadow-premium border border-slate-200/50 space-y-4">
                                    <div className="space-y-1">
                                        <h3 className="text-md font-bold text-slate-850">Evolução Mensal do NPS por Quesito</h3>
                                        <p className="text-xs text-slate-500 font-medium">Acompanhe as notas médias alcançadas em cada quesito avaliado mês a mês.</p>
                                    </div>
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
                                                {slaData.npsEvolution.map((item: any) => (
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
                                </Card>
                            )}
                        </div>
                    )}

                    {activeTab === "sla" && (
                        /* TAB 6: SLA (Performance e Acordo de Nível de Serviço) */
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">Performance e SLA do Contrato</h3>
                                    <p className="text-xs text-slate-500 font-medium">Controle de conformidade de SLA e satisfação geral gerando a nota de desempenho mensal do contrato.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={slaYear}
                                        onChange={(e) => setSlaYear(Number(e.target.value))}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value={2026}>Ano 2026</option>
                                        <option value={2025}>Ano 2025</option>
                                    </select>
                                    <Button variant="ghost" size="icon" onClick={() => fetchSlaData(slaYear)} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                                        <RefreshCw className={`w-4 h-4 text-slate-500 ${loadingSla ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                            </div>

                            {loadingSla || !slaData ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                                    <span className="text-xs text-slate-500 font-semibold">Calculando índices de SLA...</span>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Main SLA Contract Rating Panel */}
                                    <Card className="border-none shadow-premium bg-slate-900 text-white p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="space-y-3">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Índice de Performance Consolidado</span>
                                            <h4 className="text-2xl font-black tracking-tight">Nota do Contrato (Mês Atual)</h4>
                                            <p className="text-xs text-slate-350 leading-relaxed max-w-xl">
                                                A nota consolidada mensal do contrato é uma média ponderada calculada a partir dos indicadores de:
                                                <strong className="text-slate-200"> Efetividade Operacional (50%)</strong>,
                                                <strong className="text-slate-200"> Conformidade de Chamados SLA (25%)</strong> e
                                                <strong className="text-slate-200"> Avaliação de Satisfação NPS (25%)</strong>.
                                            </p>
                                            <div className="text-[10px] bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/30 text-slate-400 font-bold uppercase tracking-wider inline-block select-none">
                                                Meta Mínima Contratual: <strong className="text-primary font-black">9.0 / 10</strong>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center justify-center bg-slate-950/65 border border-slate-800 p-6 px-8 rounded-2xl shrink-0 text-center gap-2 select-none shadow-inner">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nota Obtida</span>
                                            <span className="text-4xl font-black text-primary tracking-tight">
                                                {slaData.summary.contractScore.toFixed(1)} <span className="text-sm font-bold text-slate-500">/ 10</span>
                                            </span>
                                            {slaData.summary.contractScore >= 9.0 ? (
                                                <Badge className="bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 font-black text-[10px] uppercase hover:opacity-100 mt-1 select-none">
                                                    ✓ CONFORME (SLA OK)
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 font-black text-[10px] uppercase hover:opacity-100 mt-1 select-none animate-pulse">
                                                    ▲ NÃO CONFORME
                                                </Badge>
                                            )}
                                        </div>
                                    </Card>

                                    {/* KPI Sub-Metrics Summary Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <Card className="border-none shadow-premium bg-white p-5 flex flex-col justify-between gap-3">
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Efetividade (Peso 50%)</span>
                                                    <span className="text-2xl font-black text-slate-850">{slaData.summary.effectiveness.toFixed(1)}%</span>
                                                </div>
                                                <UserCheck className="w-8 h-8 text-emerald-600 bg-emerald-50 p-1.5 rounded-xl border border-emerald-100" />
                                            </div>
                                            <p className="text-[10px] text-slate-500 leading-normal font-semibold">Cumprimento de postos titulares e coberturas de faltas.</p>
                                        </Card>

                                        <Card className="border-none shadow-premium bg-white p-5 flex flex-col justify-between gap-3">
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">SLA Chamados (Peso 25%)</span>
                                                    <span className="text-2xl font-black text-slate-850">{slaData.summary.slaCompliance.toFixed(1)}%</span>
                                                </div>
                                                <Clock className="w-8 h-8 text-blue-600 bg-blue-50 p-1.5 rounded-xl border border-blue-100" />
                                            </div>
                                            <p className="text-[10px] text-slate-500 leading-normal font-semibold">Tempo de resposta e solução de chamados operacionais.</p>
                                        </Card>

                                        <Card className="border-none shadow-premium bg-white p-5 flex flex-col justify-between gap-3">
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Satisfação NPS (Peso 25%)</span>
                                                    <span className="text-2xl font-black text-slate-850">
                                                        {slaData.summary.avgNpsRating ? slaData.summary.avgNpsRating.toFixed(1) : "10.0"} <span className="text-xs font-semibold text-slate-400">/ 10</span>
                                                    </span>
                                                </div>
                                                <Smile className="w-8 h-8 text-emerald-600 bg-emerald-50 p-1.5 rounded-xl border border-emerald-100" />
                                            </div>
                                            <p className="text-[10px] text-slate-500 leading-normal font-semibold">Nota média das pesquisas mensais de satisfação do cliente.</p>
                                        </Card>

                                        <Card className="border-none shadow-premium bg-white p-5 flex flex-col justify-between gap-3">
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">MTTR Operacional</span>
                                                    <span className="text-2xl font-black text-slate-850">
                                                        {slaData.summary.mttrHours ? slaData.summary.mttrHours.toFixed(1) + " h" : "0.0 h"}
                                                    </span>
                                                </div>
                                                <RefreshCw className="w-8 h-8 text-orange-600 bg-orange-50 p-1.5 rounded-xl border border-orange-100" />
                                            </div>
                                            <p className="text-[10px] text-slate-500 leading-normal font-semibold">Tempo médio decorrido até a resolução completa dos chamados.</p>
                                        </Card>
                                    </div>

                                    {/* Monthly KPI comparative table */}
                                    <Card className="border-none shadow-premium bg-white overflow-hidden">
                                        <div className="w-full overflow-x-auto">
                                            <Table>
                                                <TableHeader className="bg-slate-50">
                                                    <TableRow>
                                                        <TableHead className="font-bold text-slate-800">Mês</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-center">Efetividade Operacional (50%)</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-center">Conformidade SLA (25%)</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-center">Média NPS (25%)</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-center">Nota do Contrato</TableHead>
                                                        <TableHead className="font-bold text-slate-800 text-center">Status SLA</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {slaData.monthlyData.map((m: any) => (
                                                        <TableRow key={m.monthIndex} className="hover:bg-slate-50/50 transition-colors">
                                                            <TableCell className="font-bold text-xs text-slate-900">{m.name}</TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge className={`${
                                                                    m.effectiveness >= 95 ? 'bg-emerald-50 text-emerald-700' :
                                                                    m.effectiveness >= 90 ? 'bg-amber-50 text-amber-700' :
                                                                    'bg-red-50 text-red-755'
                                                                } font-bold hover:opacity-100`}>
                                                                    {m.effectiveness.toFixed(1)}%
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge className={`${
                                                                    m.slaCompliance >= 90 ? 'bg-emerald-50 text-emerald-700' :
                                                                    m.slaCompliance >= 80 ? 'bg-amber-50 text-amber-700' :
                                                                    'bg-red-50 text-red-755'
                                                                } font-bold hover:opacity-100`}>
                                                                    {m.slaCompliance.toFixed(1)}%
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge className="bg-emerald-50 text-emerald-700 border-none font-bold hover:opacity-100">
                                                                    {m.avgNpsRating ? m.avgNpsRating.toFixed(1) : "10.0"} / 10
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-center font-black text-xs text-slate-900">
                                                                {m.contractScore.toFixed(1)} / 10
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                {m.contractScore >= 9.0 ? (
                                                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-250 font-black uppercase hover:opacity-100">
                                                                        Conforme
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge className="bg-red-50 text-red-700 border-red-200 font-black uppercase hover:opacity-100 animate-pulse">
                                                                        Abaixo Meta
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </Card>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "kpis" && (
                        /* TAB 7: KPIS (Indicadores de Performance) */
                        <div className="space-y-6">
                            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">Indicadores de Performance (KPIs)</h3>
                                    <p className="text-xs text-slate-500 font-medium">Acompanhamento dos principais indicadores operacionais do contrato.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={slaYear}
                                        onChange={(e) => setSlaYear(Number(e.target.value))}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value={2026}>Ano 2026</option>
                                        <option value={2025}>Ano 2025</option>
                                    </select>
                                    <Button variant="ghost" size="icon" onClick={() => fetchSlaData(slaYear)} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                                        <RefreshCw className={`w-4 h-4 text-slate-500 ${loadingSla ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                            </div>

                            {loadingSla || !slaData ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                                    <span className="text-xs text-slate-500 font-semibold">Carregando indicadores...</span>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <Card className="border-none shadow-premium bg-white p-5 flex flex-col justify-between gap-3">
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Efetividade</span>
                                                    <span className="text-2xl font-black text-slate-850">{slaData.summary.effectiveness.toFixed(1)}%</span>
                                                </div>
                                                <UserCheck className="w-8 h-8 text-emerald-600 bg-emerald-50 p-1.5 rounded-xl border border-emerald-100" />
                                            </div>
                                            <p className="text-[10px] text-slate-500 leading-normal font-semibold">Cumprimento de postos titulares e coberturas de faltas.</p>
                                        </Card>

                                        <Card className="border-none shadow-premium bg-white p-5 flex flex-col justify-between gap-3">
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Conformidade SLA</span>
                                                    <span className="text-2xl font-black text-slate-850">{slaData.summary.slaCompliance.toFixed(1)}%</span>
                                                </div>
                                                <Clock className="w-8 h-8 text-blue-600 bg-blue-50 p-1.5 rounded-xl border border-blue-100" />
                                            </div>
                                            <p className="text-[10px] text-slate-500 leading-normal font-semibold">Chamados resolvidos dentro do prazo previsto em contrato.</p>
                                        </Card>

                                        <Card className="border-none shadow-premium bg-white p-5 flex flex-col justify-between gap-3">
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Absenteísmo</span>
                                                    <span className="text-2xl font-black text-slate-850">{slaData.summary.absenteeism.toFixed(1)}%</span>
                                                </div>
                                                <UserX className="w-8 h-8 text-red-655 bg-red-50 p-1.5 rounded-xl border border-red-100" />
                                            </div>
                                            <p className="text-[10px] text-slate-500 leading-normal font-semibold">Taxa de faltas e ausências de profissionais titulares.</p>
                                        </Card>

                                        <Card className="border-none shadow-premium bg-white p-5 flex flex-col justify-between gap-3">
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Tempo Médio (MTTR)</span>
                                                    <span className="text-2xl font-black text-slate-850">
                                                        {slaData.summary.mttrHours ? slaData.summary.mttrHours.toFixed(1) + " h" : "0.0 h"}
                                                    </span>
                                                </div>
                                                <RefreshCw className="w-8 h-8 text-orange-600 bg-orange-50 p-1.5 rounded-xl border border-orange-100" />
                                            </div>
                                            <p className="text-[10px] text-slate-500 leading-normal font-semibold">Tempo médio decorrido até a resolução completa dos chamados.</p>
                                        </Card>
                                    </div>

                                    {/* Monthly KPI comparative table */}
                                    <Card className="border border-slate-200/50 shadow-premium bg-white overflow-hidden rounded-2xl">
                                        <div className="w-full overflow-x-auto">
                                            <Table>
                                                <TableHeader className="bg-slate-50">
                                                    <TableRow>
                                                        <TableHead className="font-bold text-slate-850 text-xs pl-6 py-3">Mês</TableHead>
                                                        <TableHead className="font-bold text-slate-850 text-xs text-center py-3">Eficiência Operacional (Escala)</TableHead>
                                                        <TableHead className="font-bold text-slate-850 text-xs text-center py-3">NPS (Satisfação)</TableHead>
                                                        <TableHead className="font-bold text-slate-850 text-xs text-center py-3">Rotatividade (Turnover)</TableHead>
                                                        <TableHead className="font-bold text-slate-850 text-xs text-center py-3">Chamados no Prazo (SLA)</TableHead>
                                                        <TableHead className="font-bold text-slate-850 text-xs text-center py-3">Índice Reclamações</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {(slaData.monthlyData || []).map((m: any) => {
                                                        const mIndex = m.monthIndex;
                                                        // Calcular reclamações e rotatividade com base nos chamados reais do mês
                                                        const monthRequests = (requests || []).filter((r: any) => new Date(r.createdAt).getMonth() === mIndex);
                                                        const complaints = monthRequests.filter((r: any) => r.category === "RECLAMACOES" || r.type === "RECLAMACOES" || r.description?.toLowerCase().includes("reclam") || r.description?.toLowerCase().includes("queixa"));
                                                        const complaintsRate = monthRequests.length > 0 ? (complaints.length / monthRequests.length) * 100 : 0;

                                                        const turnoverRate = m.turnover || 0;

                                                        const hasData = m.effectiveness > 0 || monthRequests.length > 0 || m.npsCount > 0;

                                                        if (!hasData) {
                                                            return (
                                                                <TableRow key={m.monthIndex} className="hover:bg-slate-50/30 transition-colors">
                                                                    <TableCell className="font-bold text-xs text-slate-900 pl-6 py-3">{m.name}</TableCell>
                                                                    <TableCell className="text-center text-xs text-slate-400 py-3">-</TableCell>
                                                                    <TableCell className="text-center text-xs text-slate-400 py-3">-</TableCell>
                                                                    <TableCell className="text-center text-xs text-slate-400 py-3">-</TableCell>
                                                                    <TableCell className="text-center text-xs text-slate-400 py-3">-</TableCell>
                                                                    <TableCell className="text-center text-xs text-slate-400 py-3">-</TableCell>
                                                                </TableRow>
                                                            );
                                                        }

                                                        return (
                                                            <TableRow key={m.monthIndex} className="hover:bg-slate-50/50 transition-colors">
                                                                <TableCell className="font-bold text-xs text-slate-900 pl-6 py-3">{m.name}</TableCell>
                                                                <TableCell 
                                                                    onClick={() => handleKpiCellClick(mIndex, m.name, 'effectiveness')}
                                                                    className="text-center font-bold text-xs text-emerald-600 py-3 cursor-pointer hover:bg-emerald-50 hover:scale-[1.03] transition-all select-none"
                                                                >
                                                                    {m.effectiveness.toFixed(1)}%
                                                                </TableCell>
                                                                <TableCell 
                                                                    onClick={() => handleKpiCellClick(mIndex, m.name, 'nps')}
                                                                    className="text-center font-bold text-xs text-blue-650 py-3 cursor-pointer hover:bg-blue-50 hover:scale-[1.03] transition-all select-none"
                                                                >
                                                                    {m.npsCount > 0 ? `${(m.avgNpsRating * 10).toFixed(1).replace('.', ',')}%` : "-"}
                                                                </TableCell>
                                                                <TableCell 
                                                                    onClick={() => handleKpiCellClick(mIndex, m.name, 'turnover')}
                                                                    className="text-center font-bold text-xs text-slate-700 py-3 cursor-pointer hover:bg-slate-100 hover:scale-[1.03] transition-all select-none"
                                                                >
                                                                    {turnoverRate > 0 ? `${turnoverRate.toFixed(1).replace('.', ',')}%` : "0,0%"}
                                                                </TableCell>
                                                                <TableCell 
                                                                    onClick={() => handleKpiCellClick(mIndex, m.name, 'sla')}
                                                                    className="text-center font-bold text-xs text-blue-600 py-3 cursor-pointer hover:bg-blue-50 hover:scale-[1.03] transition-all select-none"
                                                                >
                                                                    {m.slaCompliance.toFixed(1)}%
                                                                </TableCell>
                                                                <TableCell 
                                                                    onClick={() => handleKpiCellClick(mIndex, m.name, 'complaints')}
                                                                    className="text-center font-bold text-xs text-red-500 py-3 cursor-pointer hover:bg-red-50 hover:scale-[1.03] transition-all select-none"
                                                                >
                                                                    {complaintsRate > 0 ? `${complaintsRate.toFixed(1).replace('.', ',')}%` : "0,0%"}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </Card>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "service_plan" && (
                        /* TAB 8: PLANO DE SERVIÇOS (Rotinas de Trabalho) */
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">Plano de Trabalho e Serviços</h3>
                                    <p className="text-xs text-slate-500 font-medium">Veja o detalhamento diário de atividades e áreas de atuação mapeadas para os colaboradores do posto.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={selectedServicePlanPostoId}
                                        onChange={(e) => setSelectedServicePlanPostoId(e.target.value)}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        {contracts.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <Button variant="ghost" size="icon" onClick={() => fetchServicePlanRoutines(selectedServicePlanPostoId)} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                                        <RefreshCw className={`w-4 h-4 text-slate-500 ${loadingServicePlan ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                            </div>

                            {/* Routines Table & Context */}
                            <Card className="border-none shadow-premium bg-white overflow-hidden p-6 space-y-6">
                                {/* Sub-header info boxes */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50/50 border border-slate-200/50 text-xs font-bold text-slate-700">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Cliente / Unidade</span>
                                        <span className="text-slate-800 font-black truncate block">
                                            {contracts.find(c => c.id === selectedServicePlanPostoId)?.name || "Instituto da Criança"}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Cidade</span>
                                        <span className="text-slate-800 font-black">CURITIBA/PR</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Função</span>
                                        <span className="text-slate-800 font-black truncate block">AUXILIAR DE SERVIÇOS GERAIS 20%</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Carga Horária</span>
                                        <span className="text-slate-800 font-black">11h00 - 16h00 - 17h00 - 23h00 12X36</span>
                                    </div>
                                </div>

                                <div className="bg-slate-900 rounded-xl px-4 py-2 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center select-none shadow-premium">
                                    Rotina de Trabalho - DIÁRIO
                                </div>

                                {loadingServicePlan ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                                        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                                        <span className="text-xs text-slate-500 font-semibold">Carregando rotina de trabalho...</span>
                                    </div>
                                ) : (
                                    <div className="w-full overflow-x-auto border border-slate-200/60 rounded-xl">
                                        <Table>
                                            <TableHeader className="bg-slate-800 text-white">
                                                <TableRow className="hover:bg-slate-800 border-none">
                                                    <TableHead className="font-bold text-white text-xs py-3 h-10 w-24">Início</TableHead>
                                                    <TableHead className="font-bold text-white text-xs py-3 h-10 w-24">Tempo</TableHead>
                                                    <TableHead className="font-bold text-white text-xs py-3 h-10 w-24">Final</TableHead>
                                                    <TableHead className="font-bold text-white text-xs py-3 h-10 w-40">Local</TableHead>
                                                    <TableHead className="font-bold text-white text-xs py-3 h-10">Atividade / Descrição do Serviço</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {servicePlanRoutines.map((routine) => (
                                                    <TableRow key={routine.id} className="hover:bg-slate-50/50 border-slate-100 transition-colors">
                                                        <TableCell className="font-bold text-xs text-slate-800">{routine.startTime}</TableCell>
                                                        <TableCell className="text-slate-500 text-xs font-semibold">{routine.duration || "-"}</TableCell>
                                                        <TableCell className="text-slate-800 text-xs font-bold">{routine.endTime}</TableCell>
                                                        <TableCell className="text-slate-700 text-xs font-semibold">
                                                            {routine.location === "Intervalo" ? (
                                                                <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-bold hover:opacity-100">{routine.location}</Badge>
                                                            ) : (
                                                                <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-bold hover:opacity-100">{routine.location}</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-slate-800 leading-normal font-semibold">
                                                            {routine.activity || <span className="text-slate-400 italic">Horário livre / Pausa de transição</span>}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {servicePlanRoutines.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center text-slate-500 py-10 font-semibold">
                                                            Nenhuma atividade cadastrada neste plano de trabalho.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </Card>
                        </div>
                    )}
                </main>
            </div>
        {/* Modal de Detalhamento de KPIs Operacionais (Auditoria Mensal) */}
        <Dialog open={kpiModalConfig !== null} onOpenChange={(open) => { if (!open) setKpiModalConfig(null); }}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 bg-white border border-slate-100 shadow-premium">
                <DialogHeader className="pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <BarChart2 className="w-5 h-5 text-blue-600 animate-pulse" />
                            Detalhamento Operacional: {kpiModalConfig?.monthName}
                        </DialogTitle>
                        <p className="text-xs text-slate-500 font-semibold mt-1">
                            {kpiModalConfig?.kpiType === 'effectiveness' && "Auditoria de Efetividade de Escala e Plantões"}
                            {kpiModalConfig?.kpiType === 'nps' && "Auditoria de Respostas Qualitativas de NPS (Satisfação)"}
                            {kpiModalConfig?.kpiType === 'turnover' && "Auditoria de Rotatividade e Movimentações de Postos"}
                            {kpiModalConfig?.kpiType === 'sla' && "Auditoria de SLA de Chamados Cumpridos no Prazo"}
                            {kpiModalConfig?.kpiType === 'complaints' && "Auditoria de Reclamações Registradas"}
                        </p>
                    </div>
                </DialogHeader>

                {loadingKpiModal ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                        <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Carregando dados operacionais...</span>
                    </div>
                ) : kpiModalData ? (
                    <div className="py-4 space-y-4">
                        {/* KPI: EFICIÊNCIA OPERACIONAL (ESCALA) */}
                        {kpiModalConfig?.kpiType === 'effectiveness' && (() => {
                            const absences = (kpiModalData.attendances || []).filter((a: any) => a.status === 'FALTA');
                            return (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total de Plantões</span>
                                            <p className="text-2xl font-black text-slate-800 mt-1">{kpiModalData.attendances?.length || 0}</p>
                                        </div>
                                        <div className="p-4 bg-red-50 rounded-2xl border border-red-100/50">
                                            <span className="text-[10px] font-black uppercase text-red-500 tracking-wider">Faltas Registradas</span>
                                            <p className="text-2xl font-black text-red-650 mt-1">{absences.length}</p>
                                        </div>
                                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100/50">
                                            <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Efetividade Escala</span>
                                            <p className="text-2xl font-black text-emerald-700 mt-1">
                                                {kpiModalData.attendances?.length > 0
                                                    ? (((kpiModalData.attendances.length - absences.filter((a: any) => !a.coveredById).length) / kpiModalData.attendances.length) * 100).toFixed(1)
                                                    : "100.0"}%
                                            </p>
                                        </div>
                                    </div>

                                    <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="font-bold text-xs text-slate-800 pl-4">Data</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Posto/Função</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Colaborador Titular</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Status</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Cobertura de Plantão</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {absences.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center py-8 text-slate-400 font-semibold text-xs">
                                                            100% de Efetividade! Nenhuma falta ou ocorrência de escala registrada neste mês.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    absences.map((a: any) => (
                                                        <TableRow key={a.id} className="hover:bg-slate-55/30 transition-colors">
                                                            <TableCell className="font-bold text-xs text-slate-800 pl-4">{new Date(a.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</TableCell>
                                                            <TableCell className="font-bold text-xs text-slate-700">{a.posto?.name || "Posto"} ({a.posto?.role?.name || "Posto"})</TableCell>
                                                            <TableCell className="font-bold text-xs text-slate-900">{a.employee?.name || "Funcionário"}</TableCell>
                                                            <TableCell className="py-2">
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-100 text-red-700">Falta</span>
                                                            </TableCell>
                                                            <TableCell className="font-bold text-xs">
                                                                {a.coveredBy ? (
                                                                    <span className="text-emerald-600 flex items-center gap-1.5">
                                                                        <UserCheck className="w-3.5 h-3.5" />
                                                                        Coberto por {a.coveredBy.name}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-red-500 flex items-center gap-1.5">
                                                                        <UserX className="w-3.5 h-3.5" />
                                                                        Posto Descoberto
                                                                    </span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* KPI: NPS (SATISFAÇÃO) */}
                        {kpiModalConfig?.kpiType === 'nps' && (
                            <div className="space-y-4">
                                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white p-4 space-y-4">
                                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Avaliações e Respostas Qualitativas</h3>
                                    {(kpiModalData.npsResponses || []).length === 0 ? (
                                        <p className="text-center py-8 text-slate-400 font-semibold text-xs">Nenhuma resposta de NPS cadastrada neste mês.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {(kpiModalData.npsResponses || []).map((resp: any) => {
                                                let sum = 0;
                                                resp.answers.forEach((ans: any) => sum += ans.score);
                                                const avgScore = resp.answers.length > 0 ? (sum / resp.answers.length).toFixed(1) : "10.0";

                                                return (
                                                    <div key={resp.id} className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all bg-white space-y-3">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <span className="text-[10px] font-black uppercase bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                                                    {resp.answers.length > 0 ? `Média: ${avgScore}/10 (${(parseFloat(avgScore)*10).toFixed(0)}%)` : "NPS"}
                                                                </span>
                                                                <p className="text-[10px] font-bold text-slate-400 mt-1">Respondido em: {new Date(resp.createdAt).toLocaleDateString('pt-BR')}</p>
                                                            </div>
                                                        </div>
                                                        {resp.feedback && (
                                                            <p className="text-xs font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                                "${resp.feedback}"
                                                            </p>
                                                        )}
                                                        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                                                            {resp.answers.map((ans: any) => (
                                                                <div key={ans.id} className="flex justify-between items-center p-2 bg-slate-50/50 rounded-lg border border-slate-100/50">
                                                                    <span className="text-slate-600 truncate max-w-[80%]">{ans.question?.text || "Pergunta"}</span>
                                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                                        ans.score >= 8.5 ? "bg-emerald-100 text-emerald-700" :
                                                                        ans.score >= 7.0 ? "bg-amber-100 text-amber-700" :
                                                                        "bg-red-100 text-red-700"
                                                                    }`}>{ans.score}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* KPI: ROTATIVIDADE (TURNOVER) */}
                        {kpiModalConfig?.kpiType === 'turnover' && (
                            <div className="space-y-4">
                                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead className="font-bold text-xs text-slate-800 pl-4">Data Substituição</TableHead>
                                                <TableHead className="font-bold text-xs text-slate-800">Posto de Trabalho</TableHead>
                                                <TableHead className="font-bold text-xs text-slate-800">Função/Cargo</TableHead>
                                                <TableHead className="font-bold text-xs text-slate-800">Colaborador Substituído</TableHead>
                                                <TableHead className="font-bold text-xs text-slate-800">Motivo do Desligamento</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(kpiModalData.assignments || []).length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-8 text-slate-400 font-semibold text-xs">
                                                        Zero Rotatividade! Nenhuma substituição de funcionário ocorrida neste mês.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                (kpiModalData.assignments || []).map((a: any) => (
                                                    <TableRow key={a.id} className="hover:bg-slate-55/30 transition-colors">
                                                        <TableCell className="font-bold text-xs text-slate-800 pl-4">{a.endDate ? new Date(a.endDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-"}</TableCell>
                                                        <TableCell className="font-bold text-xs text-slate-800">{a.posto?.name || "Posto"}</TableCell>
                                                        <TableCell className="font-bold text-xs text-slate-600">{a.posto?.role?.name || "-"}</TableCell>
                                                        <TableCell className="font-bold text-xs text-slate-900">{a.employee?.name || "-"}</TableCell>
                                                        <TableCell className="font-bold text-xs text-slate-500">{a.employee?.dismissalReason || "Troca Interna JVS"}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* KPI: CHAMADOS NO PRAZO (SLA) */}
                        {kpiModalConfig?.kpiType === 'sla' && (
                            <div className="space-y-4">
                                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead className="font-bold text-xs text-slate-800 pl-4">ID Chamado</TableHead>
                                                <TableHead className="font-bold text-xs text-slate-800">Descrição do Chamado</TableHead>
                                                <TableHead className="font-bold text-xs text-slate-800">Abertura</TableHead>
                                                <TableHead className="font-bold text-xs text-slate-800">Prazo SLA</TableHead>
                                                <TableHead className="font-bold text-xs text-slate-800">Status</TableHead>
                                                <TableHead className="font-bold text-xs text-slate-800">SLA Geral</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(kpiModalData.requests || []).length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-8 text-slate-400 font-semibold text-xs">
                                                        Nenhum chamado operacional registrado neste mês.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                (kpiModalData.requests || []).map((r: any) => {
                                                    const isCompleted = r.status === "CONCLUIDO" || r.status === "REJEITADO";
                                                    const isSlaOk = isCompleted ? (new Date(r.updatedAt) <= new Date(r.dueDate)) : (new Date() <= new Date(r.dueDate));
                                                    return (
                                                        <TableRow key={r.id} className="hover:bg-slate-55/30 transition-colors">
                                                            <TableCell className="font-bold text-xs text-slate-500 pl-4 truncate max-w-[80px]">#${r.id.split('-')[0]}</TableCell>
                                                            <TableCell className="font-bold text-xs text-slate-900 max-w-[200px] truncate">{r.description}</TableCell>
                                                            <TableCell className="font-bold text-xs text-slate-600">{new Date(r.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                                                            <TableCell className="font-bold text-xs text-slate-600">{new Date(r.dueDate).toLocaleDateString('pt-BR')}</TableCell>
                                                            <TableCell>
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                                    r.status === "PENDENTE" ? "bg-amber-105 text-amber-700" :
                                                                    r.status === "ANDAMENTO" ? "bg-blue-100 text-blue-700" :
                                                                    "bg-emerald-100 text-emerald-700"
                                                                }`}>{r.status}</span>
                                                            </TableCell>
                                                            <TableCell>
                                                                {isSlaOk ? (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-750">No Prazo</span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-100 text-red-750">Atrasado</span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* KPI: ÍNDICE DE RECLAMAÇÕES */}
                        {kpiModalConfig?.kpiType === 'complaints' && (() => {
                            const complaints = (kpiModalData.requests || []).filter((r: any) => r.type === "RECLAMACOES" || r.description?.toLowerCase().includes("reclam") || r.description?.toLowerCase().includes("queixa"));
                            return (
                                <div className="space-y-4">
                                    <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="font-bold text-xs text-slate-800 pl-4">ID Reclamação</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Descrição da Reclamação</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Abertura</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Prazo Limite</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {complaints.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center py-8 text-slate-400 font-semibold text-xs">
                                                            Excelente! Nenhuma reclamação ou queixa operacional registrada neste mês.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    complaints.map((r: any) => (
                                                        <TableRow key={r.id} className="hover:bg-slate-55/30 transition-colors">
                                                            <TableCell className="font-bold text-xs text-slate-500 pl-4 truncate max-w-[80px]">#${r.id.split('-')[0]}</TableCell>
                                                            <TableCell className="font-bold text-xs text-slate-900 max-w-[250px] truncate">{r.description}</TableCell>
                                                            <TableCell className="font-bold text-xs text-slate-600">{new Date(r.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                                                            <TableCell className="font-bold text-xs text-slate-600">{new Date(r.dueDate).toLocaleDateString('pt-BR')}</TableCell>
                                                            <TableCell>
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                                    r.status === "PENDENTE" ? "bg-amber-105 text-amber-700" :
                                                                    r.status === "ANDAMENTO" ? "bg-blue-100 text-blue-700" :
                                                                    "bg-emerald-100 text-emerald-700"
                                                                }`}>{r.status}</span>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                ) : (
                    <div className="py-20 flex flex-col items-center justify-center gap-2">
                        <span className="text-xs font-bold text-slate-400">Falha ao carregar detalhes operacionais.</span>
                    </div>
                )}

                <DialogFooter className="pt-4 border-t border-slate-100 flex items-center justify-end w-full">
                    <Button type="button" onClick={() => setKpiModalConfig(null)} className="h-10 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 px-6 cursor-pointer">Fechar Relatório</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </div>
    );
}
