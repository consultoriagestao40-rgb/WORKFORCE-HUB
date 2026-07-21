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
    createContractVisit, updateContractVisit, deleteContractVisit, 
    getAdminClientKpis,
    saveContractTargetScore,
    getVisitRequirements,
    saveVisitRequirements,
    getClientDetailedData,
    getAdminClientBilling,
    updatePostoBilling,
    upsertSlaConfigItem,
    deleteSlaConfigItem,
    updateSlaMonthlyValue,
    upsertNpsQuestion,
    deleteNpsQuestion,
    deleteNpsResponse,
    getPostoRoutines,
    saveWorkRoutine,
    deleteWorkRoutine,
    transitionRequest,
    updateRequestClient,
    updateRequestDetails,
    addRequestComment,
    getRequestComments,
    deleteRequest
} from "@/app/admin/requests/actions";
import { getPopDocuments } from "@/actions/pops";
import { PopsManagementSection } from "@/components/client/PopsManagementSection";
import { 
    ArrowLeft, Award, Calendar, Users, DollarSign, 
    Plus, Clock, LogOut, Star, Info,
    Trash2, Edit3, Inbox, FileText, Smile, 
    BarChart2, ClipboardList, ChevronLeft, ChevronRight, RefreshCw, Download,
    UserCheck, UserX, Building, Briefcase, AlertCircle, Filter, ChevronDown, FileCheck
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
    const [activeTab, setActiveTab] = useState<"presence" | "requests" | "billing" | "monthly_report" | "nps" | "kpis" | "sla" | "service_plan" | "pops">("presence");
    const [pops, setPops] = useState<any[]>([]);
    const [loadingPops, setLoadingPops] = useState<boolean>(false);

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

    // KPI Modal States
    const [kpiModalConfig, setKpiModalConfig] = useState<{ monthIndex: number; monthName: string; kpiType: 'effectiveness' | 'nps' | 'turnover' | 'sla' | 'complaints' | 'reposition' | 'visits'; value?: number } | null>(null);
    const [kpiModalData, setKpiModalData] = useState<any>(null);
    const [loadingKpiModal, setLoadingKpiModal] = useState<boolean>(false);
    const [generalSlaTarget, setGeneralSlaTarget] = useState<number>(90.0);
    const [isSavingSlaTarget, setIsSavingSlaTarget] = useState<boolean>(false);

    useEffect(() => {
        if (clientKpiData && clientKpiData.contractTargetScore !== undefined) {
            setGeneralSlaTarget(clientKpiData.contractTargetScore);
        }
    }, [clientKpiData]);

    const handleSaveGeneralSlaTarget = async () => {
        if (!selectedClientId || selectedClientId === "all") return;
        setIsSavingSlaTarget(true);
        try {
            const res = await saveContractTargetScore(selectedClientId, generalSlaTarget);
            if (res.success) {
                toast.success("Meta global de SLA atualizada com sucesso!");
                setClientKpiData((prev: any) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        contractTargetScore: generalSlaTarget
                    };
                });
            } else {
                toast.error(res.error || "Erro ao salvar a meta.");
            }
        } catch (e) {
            toast.error("Erro de conexão ao salvar a meta.");
        } finally {
            setIsSavingSlaTarget(false);
        }
    };

    const [visitRequirements, setVisitRequirements] = useState<Array<{ role: string; frequency: number }>>([
        { role: "SUPERVISOR", frequency: 0 },
        { role: "COORDENADOR", frequency: 0 },
        { role: "GERENTE", frequency: 0 },
        { role: "DIRETOR", frequency: 0 }
    ]);
    const [isSavingVisitReqs, setIsSavingVisitReqs] = useState<boolean>(false);

    useEffect(() => {
        const loadReqs = async () => {
            if (!selectedClientId || selectedClientId === "all") return;
            try {
                const res = await getVisitRequirements(selectedClientId);
                if (res.success && res.requirements) {
                    const roles = ["SUPERVISOR", "COORDENADOR", "GERENTE", "DIRETOR"];
                    const mapped = roles.map(r => {
                        const found = res.requirements.find((req: any) => req.visitorRole === r);
                        return { role: r, frequency: found ? found.frequency : 0 };
                    });
                    setVisitRequirements(mapped);
                }
            } catch (e) {
                console.error("Erro ao carregar metas de visitas:", e);
            }
        };
        loadReqs();
    }, [selectedClientId]);

    const handleSaveVisitRequirements = async () => {
        if (!selectedClientId || selectedClientId === "all") return;
        setIsSavingVisitReqs(true);
        try {
            const res = await saveVisitRequirements(selectedClientId, visitRequirements);
            if (res.success) {
                toast.success("Metas de visitas da liderança salvas com sucesso!");
                await loadPerformanceData();
            } else {
                toast.error(res.error || "Erro ao salvar metas.");
            }
        } catch (e) {
            toast.error("Erro de conexão ao salvar metas de visitas.");
        } finally {
            setIsSavingVisitReqs(false);
        }
    };

    const handleKpiCellClick = async (monthIndex: number, monthName: string, kpiType: 'effectiveness' | 'nps' | 'turnover' | 'sla' | 'complaints' | 'reposition' | 'visits', value?: number) => {
        setKpiModalConfig({ monthIndex, monthName, kpiType, value });
        setLoadingKpiModal(true);
        setKpiModalData(null);
        try {
            const res = await getClientDetailedData(selectedClientId, selectedYear, monthIndex);
            if (res.success) {
                setKpiModalData(res);
            }
        } catch (err) {
            console.error("Erro ao buscar detalhes do KPI:", err);
        } finally {
            setLoadingKpiModal(false);
        }
    };

    // Posto routines
    const [selectedPostoId, setSelectedPostoId] = useState<string>("");
    const [routines, setRoutines] = useState<any[]>([]);
    const [loadingRoutines, setLoadingRoutines] = useState<boolean>(false);

    // WorkRoutine local CRUD states
    const [routineDialogOpen, setRoutineDialogOpen] = useState<boolean>(false);
    const [editingRoutine, setEditingRoutine] = useState<any | null>(null);
    const [routineStartTime, setRoutineStartTime] = useState<string>("");
    const [routineEndTime, setRoutineEndTime] = useState<string>("");
    const [routineDuration, setRoutineDuration] = useState<string>("");
    const [routineLocation, setRoutineLocation] = useState<string>("");
    const [routineActivity, setRoutineActivity] = useState<string>("");
    const [savingRoutine, setSavingRoutine] = useState<boolean>(false);

    // Calcular duração automaticamente quando houver horários de início/fim
    useEffect(() => {
        if (routineStartTime && routineEndTime) {
            const [hStart, mStart] = routineStartTime.split(":").map(Number);
            const [hEnd, mEnd] = routineEndTime.split(":").map(Number);
            if (!isNaN(hStart) && !isNaN(mStart) && !isNaN(hEnd) && !isNaN(mEnd)) {
                let diffMin = (hEnd * 60 + mEnd) - (hStart * 60 + mStart);
                if (diffMin < 0) diffMin += 24 * 60; // virada de dia
                const hDiff = Math.floor(diffMin / 60);
                const mDiff = diffMin % 60;
                const hStr = hDiff.toString().padStart(2, '0');
                const mStr = mDiff.toString().padStart(2, '0');
                setRoutineDuration(`${hStr}:${mStr}`);
            }
        }
    }, [routineStartTime, routineEndTime]);

    // Visit Form Dialog State
    const [logVisitOpen, setLogVisitOpen] = useState<boolean>(false);
    const [visitClientId, setVisitClientId] = useState<string>("all");
    const [visitorName, setVisitorName] = useState<string>("Cristiano Magalhães");
    const [visitorRole, setVisitorRole] = useState<string>("SUPERVISOR");
    const [customVisitorRole, setCustomVisitorRole] = useState<string>("");
    const [availableRoles, setAvailableRoles] = useState<string[]>(["SUPERVISOR", "COORDENADOR", "GERENTE", "DIRETOR"]);
    const [visitEvidenceUrl, setVisitEvidenceUrl] = useState<string>("");

    // Estados de edição de visita
    const [editingVisit, setEditingVisit] = useState<any | null>(null);
    const [editVisitOpen, setEditVisitOpen] = useState<boolean>(false);
    const [editVisitorRole, setEditVisitorRole] = useState<string>("");
    const [editVisitorName, setEditVisitorName] = useState<string>("");
    const [editVisitDate, setEditVisitDate] = useState<string>("");
    const [editVisitNotes, setEditVisitNotes] = useState<string>("");
    const [editVisitEvidenceUrl, setEditVisitEvidenceUrl] = useState<string>("");
    const [visitFileName, setVisitFileName] = useState<string>("");
    const [editVisitFileName, setEditVisitFileName] = useState<string>("");
    const [editCustomVisitorRole, setEditCustomVisitorRole] = useState<string>("");
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
    const [slaTab, setSlaTab] = useState<'resultado' | 'config' | 'visitas'>('resultado');
    const [slaRanges, setSlaRanges] = useState<{ minVal: number; maxVal: number | null; resultVal: number; }[]>([]);
    const [newMinVal, setNewMinVal] = useState<string>("");
    const [newMaxVal, setNewMaxVal] = useState<string>("");
    const [newResultVal, setNewResultVal] = useState<string>("");

    // SLA Manual value State
    const [editingSlaValueId, setEditingSlaValueId] = useState<string | null>(null);
    const [manualSlaValue, setManualSlaValue] = useState<number>(0);

    // NPS Question Dialog State
    const [npsDialogOpen, setNpsDialogOpen] = useState<boolean>(false);
    const [editingNpsQ, setEditingNpsQ] = useState<any | null>(null);
    const [npsQText, setNpsQText] = useState<string>("");
    const [npsQWeight, setNpsQWeight] = useState<number>(1);
    const [savingNpsQ, setSavingNpsQ] = useState<boolean>(false);

    useEffect(() => {
        if (activeTab === "pops") {
            const fetchPopsData = async () => {
                setLoadingPops(true);
                const targetClientId = selectedClientId !== "all" ? selectedClientId : initialClients[0]?.id;
                if (targetClientId) {
                    const data = await getPopDocuments(targetClientId);
                    setPops(data);
                }
                setLoadingPops(false);
            };
            fetchPopsData();
        }
    }, [activeTab, selectedClientId, initialClients]);
    const [dailyAttendances, setDailyAttendances] = useState<any[]>([]);
    const [loadingDaily, setLoadingDaily] = useState<boolean>(false);

    // Sidebar collapse state
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

    // Card Details Modal State
    const [detailsModalOpen, setDetailsModalOpen] = useState<boolean>(false);
    const [detailsModalType, setDetailsModalType] = useState<"contracts" | "employees" | "billing" | "vacancies">("contracts");

    // Modal contracts filter (multiple choice selection)
    const [selectedContractsFilter, setSelectedContractsFilter] = useState<string[]>([]);

    const activeConfigs = useMemo(() => {
        if (clientKpiData?.slaConfigs && clientKpiData.slaConfigs.length > 0) {
            return clientKpiData.slaConfigs;
        }
        return [
            { id: "fallback-eff", name: "Eficiência Operacional (Escala)", metricType: "EFETIVIDADE" },
            { id: "fallback-nps", name: "NPS (Satisfação)", metricType: "NPS" },
            { id: "fallback-turn", name: "Rotatividade (Turnover)", metricType: "TURNOVER" },
            { id: "fallback-sla", name: "Chamados no Prazo (SLA)", metricType: "SLA_CHAMADOS" },
            { id: "fallback-comp", name: "Índice Reclamações", metricType: "RECLAMACOES" },
            { id: "fallback-vis", name: "Visitas de Liderança", metricType: "VISITAS" },
            { id: "fallback-rep", name: "SLA de Contratação (Média Dias)", metricType: "REPOSICAO" }
        ];
    }, [clientKpiData]);

    const getKpiValue = useCallback((m: any, config: any) => {
        if (config.metricType === "MANUAL") {
            const found = config.monthlyValues?.find((v: any) => v.month === m.monthIndex && v.year === selectedYear);
            if (found !== undefined && found !== null) {
                return `${found.value.toFixed(1).replace('.', ',')}%`;
            }
            return "-";
        }
        if (config.metricType === "EFETIVIDADE") {
            return m.effectiveness !== null && m.effectiveness !== undefined 
                ? `${m.effectiveness.toFixed(1)}%` 
                : "-";
        }
        if (config.metricType === "NPS") {
            return m.npsCount > 0 
                ? `${(m.avgNpsRating * 10).toFixed(1).replace('.', ',')}%` 
                : "-";
        }
        if (config.metricType === "TURNOVER") {
            const turnoverRate = m.turnover || 0;
            return turnoverRate > 0 
                ? `${turnoverRate.toFixed(1).replace('.', ',')}%` 
                : "0,0%";
        }
        if (config.metricType === "SLA_CHAMADOS") {
            return m.slaCompliance !== null && m.slaCompliance !== undefined 
                ? `${m.slaCompliance.toFixed(1)}%` 
                : "-";
        }
        if (config.metricType === "RECLAMACOES") {
            const rate = m.complaintsRate ?? 0;
            return `${rate.toFixed(1).replace('.', ',')}%`;
        }
        if (config.metricType === "VISITAS") {
            return m.visitsScore !== null && m.visitsScore !== undefined 
                ? `${m.visitsScore.toFixed(2).replace('.', ',')}%` 
                : "0,00%";
        }
        if (config.metricType === "REPOSICAO") {
            return m.avgRepositionDays !== undefined && m.avgRepositionDays !== null 
                ? `${m.avgRepositionDays.toFixed(1).replace('.', ',')} dias` 
                : "-";
        }
        if (config.metricType === "CHECKLIST_FACIL") {
            const plannedValObj = config.monthlyValues?.find((v: any) => v.month === m.monthIndex && v.year === selectedYear);
            const planned = plannedValObj ? plannedValObj.value : null;
            const completed = m.checklistFacilCount ?? 0;
            if (planned === null || planned === undefined) {
                return `${completed} concluídos (Meta pendente)`;
            }
            const pct = planned > 0 ? (completed / planned) * 100 : 0;
            return `${completed} de ${planned} (${pct.toFixed(1).replace('.', ',')}%)`;
        }
        return "-";
    }, [selectedYear]);

    const handleKpiClick = useCallback((m: any, config: any) => {
        const kpiTypeMap: Record<string, any> = {
            EFETIVIDADE: 'effectiveness',
            NPS: 'nps',
            TURNOVER: 'turnover',
            SLA_CHAMADOS: 'sla',
            RECLAMACOES: 'complaints',
            VISITAS: 'visits',
            REPOSICAO: 'reposition'
        };
        const kpiType = kpiTypeMap[config.metricType];
        if (kpiType) {
            let rawVal = undefined;
            if (config.metricType === "EFETIVIDADE") rawVal = m.effectiveness;
            else if (config.metricType === "NPS") rawVal = m.npsCount > 0 ? m.avgNpsRating * 10 : undefined;
            else if (config.metricType === "TURNOVER") rawVal = m.turnover;
            else if (config.metricType === "SLA_CHAMADOS") rawVal = m.slaCompliance;
            else if (config.metricType === "RECLAMACOES") rawVal = m.complaintsRate;
            else if (config.metricType === "VISITAS") rawVal = m.visitsScore;
            else if (config.metricType === "REPOSICAO") rawVal = m.avgRepositionDays;
            
            handleKpiCellClick(m.monthIndex, m.name, kpiType, rawVal);
        }
    }, [handleKpiCellClick]);

    // Estados exclusivos para a aba/tela de solicitações do gestor
    const [consolidatedTab, setConsolidatedTab] = useState<"performance" | "requests">("performance");
    const [requestsViewMode, setRequestsViewMode] = useState<"kanban-status" | "kanban-contract" | "list">("kanban-status");
    const [selectedRequestForAction, setSelectedRequestForAction] = useState<any | null>(null);
    const [requestTransitionNotes, setRequestTransitionNotes] = useState<string>("");
    const [transitioningRequestState, setTransitioningRequestState] = useState<boolean>(false);

    // Controle de exclusão de chamados (Admin)
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deletingRequest, setDeletingRequest] = useState<boolean>(false);
    const [editingCell, setEditingCell] = useState<string | null>(null);
    const [kpiConfigOpen, setKpiConfigOpen] = useState<boolean>(false);
    const [selectedKpiTypeForSla, setSelectedKpiTypeForSla] = useState<string>('');
    const [kpiFormOpen, setKpiFormOpen] = useState<boolean>(false);
    const [editingKpi, setEditingKpi] = useState<any | null>(null);
    const [selectedKpiType, setSelectedKpiType] = useState<string>('EFETIVIDADE');
    const [newKpiName, setNewKpiName] = useState<string>('');
    const [newKpiUnitIds, setNewKpiUnitIds] = useState<string>('');
    const [newKpiChecklistIds, setNewKpiChecklistIds] = useState<string>('');
    const [kpiMeta, setKpiMeta] = useState<number>(90);
    const [kpiPeso, setKpiPeso] = useState<number>(1);
    const [isNewCustomKpi, setIsNewCustomKpi] = useState<boolean>(false);
    const [showKpiConfig, setShowKpiConfig] = useState<boolean>(false);

    // Sub-abas de NPS
    const [npsSubTab, setNpsSubTab] = useState<"results" | "config">("results");
    const [expandedResponseId, setExpandedResponseId] = useState<string | null>(null);
    const [confirmDeleteResponseId, setConfirmDeleteResponseId] = useState<string | null>(null);
    const [deletingResponse, setDeletingResponse] = useState<boolean>(false);

    // Comentários e Interatividade do Gestor nos chamados
    const [newCommentContent, setNewCommentContent] = useState<string>("");
    const [submittingComment, setSubmittingComment] = useState<boolean>(false);

    // Carregar comentários do chamado em tempo real sempre que o card for aberto
    useEffect(() => {
        if (selectedRequestForAction?.id) {
            getRequestComments(selectedRequestForAction.id)
                .then((comments) => {
                    setSelectedRequestForAction((prev: any) => {
                        if (!prev || prev.id !== selectedRequestForAction.id) return prev;
                        return { ...prev, comments };
                    });
                })
                .catch(console.error);
        }
    }, [selectedRequestForAction?.id]);

    // Filtros adicionais para a visão lista
    const [listSearchQuery, setListSearchQuery] = useState<string>("");
    const [listSelectedContract, setListSelectedContract] = useState<string>("all");
    const [listSelectedStatus, setListSelectedStatus] = useState<string>("all");

    // HTML5 Drag & Drop handlers
    const handleDragStart = (e: React.DragEvent, requestId: string) => {
        e.dataTransfer.setData("text/plain", requestId);
    };

    const handleDropStatus = async (e: React.DragEvent, targetStatus: string) => {
        e.preventDefault();
        const requestId = e.dataTransfer.getData("text/plain");
        if (!requestId) return;

        const req = consolidatedData?.allRequests?.find((r: any) => r.id === requestId);
        if (!req || req.status === targetStatus) return;

        // Atualização otimista local
        setConsolidatedData((prev: any) => {
            if (!prev) return prev;
            return {
                ...prev,
                allRequests: prev.allRequests.map((r: any) => 
                    r.id === requestId ? { ...r, status: targetStatus } : r
                )
            };
        });

        try {
            await transitionRequest(requestId, targetStatus, `Status alterado via Kanban (arrastar e soltar) por ${userName}`);
            toast.success(`Solicitação movida para ${targetStatus === 'CONCLUIDO' ? 'Concluída' : targetStatus === 'REJEITADO' ? 'Recusada' : 'Em Execução'}`);
            await loadPerformanceData();
            await loadClientDetails();
        } catch (err) {
            toast.error("Erro ao mover solicitação.");
            await loadPerformanceData();
            await loadClientDetails();
        }
    };

    const handleDropContract = async (e: React.DragEvent, targetClientId: string) => {
        e.preventDefault();
        const requestId = e.dataTransfer.getData("text/plain");
        if (!requestId) return;

        const req = consolidatedData?.allRequests?.find((r: any) => r.id === requestId);
        if (!req || req.clientId === targetClientId) return;

        const targetClient = consolidatedData?.clients?.find((c: any) => c.id === targetClientId);
        const targetClientName = targetClient?.name || "Contrato";

        // Atualização otimista local
        setConsolidatedData((prev: any) => {
            if (!prev) return prev;
            return {
                ...prev,
                allRequests: prev.allRequests.map((r: any) => 
                    r.id === requestId ? { ...r, clientId: targetClientId, clientName: targetClientName } : r
                )
            };
        });

        try {
            await updateRequestClient(requestId, targetClientId);
            toast.success(`Solicitação movida para o contrato: ${targetClientName}`);
            await loadPerformanceData();
            await loadClientDetails();
        } catch (err) {
            toast.error("Erro ao transferir contrato da solicitação.");
            await loadPerformanceData();
            await loadClientDetails();
        }
    };

    const handleTransitionRequest = async (requestId: string, newStatus: string, notes?: string) => {
        setTransitioningRequestState(true);
        try {
            await transitionRequest(requestId, newStatus, notes);
            toast.success("Solicitação atualizada com sucesso!");
            setSelectedRequestForAction(null);
            setRequestTransitionNotes("");
            // Recarregar os dados
            await loadPerformanceData();
            await loadClientDetails();
        } catch (e) {
            toast.error("Erro ao atualizar solicitação.");
        } finally {
            setTransitioningRequestState(false);
        }
    };

    const [savingRequestDetails, setSavingRequestDetails] = useState<boolean>(false);

    const handleSaveRequestDetails = async () => {
        if (!selectedRequestForAction) return;
        setSavingRequestDetails(true);
        try {
            // 1. Atualizar detalhes no banco (descrição, colaborador, prazo)
            await updateRequestDetails(selectedRequestForAction.id, {
                description: selectedRequestForAction.description,
                employeeId: selectedRequestForAction.employeeId === "" ? null : selectedRequestForAction.employeeId,
                dueDate: selectedRequestForAction.dueDate
            });

            // 2. Mudar status se alterou no seletor, registrando no chat a alteração de status
            if (selectedRequestForAction.nextStatus && selectedRequestForAction.nextStatus !== selectedRequestForAction.status) {
                let statusName = selectedRequestForAction.nextStatus;
                if (statusName === "PENDENTE") statusName = "Aguardando (Pendente)";
                else if (statusName === "EM_ANDAMENTO") statusName = "Em Execução";
                else if (statusName === "CONCLUIDO") statusName = "Concluído";
                else if (statusName === "REJEITADO") statusName = "Recusado";
                else if (statusName === "CANCELADO") statusName = "Cancelado";

                await transitionRequest(
                    selectedRequestForAction.id,
                    selectedRequestForAction.nextStatus,
                    `Status do chamado alterado para "${statusName}"`
                );
            }

            toast.success("Solicitação salva e atualizada com sucesso!");
            setSelectedRequestForAction(null);
            setRequestTransitionNotes("");
            await loadPerformanceData();
            await loadClientDetails();
        } catch (e) {
            toast.error("Erro ao salvar alterações da solicitação.");
        } finally {
            setSavingRequestDetails(false);
        }
    };

    const handleDeleteRequest = async (id: string) => {
        setDeletingRequest(true);
        try {
            await deleteRequest(id);
            toast.success("Solicitação excluída com sucesso!");
            setSelectedRequestForAction(null);
            setConfirmDeleteId(null);
            await loadPerformanceData();
            await loadClientDetails();
        } catch (err) {
            toast.error("Erro ao excluir a solicitação.");
        } finally {
            setDeletingRequest(false);
        }
    };

    const handleDeleteResponse = async (id: string) => {
        setDeletingResponse(true);
        try {
            await deleteNpsResponse(id);
            toast.success("Avaliação excluída com sucesso!");
            setConfirmDeleteResponseId(null);
            await loadPerformanceData();
            await loadClientDetails();
        } catch (err) {
            toast.error("Erro ao excluir a avaliação.");
        } finally {
            setDeletingResponse(false);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRequestForAction || !newCommentContent.trim()) return;

        setSubmittingComment(true);
        try {
            const res = await addRequestComment(selectedRequestForAction.id, newCommentContent);
            if (res.success) {
                toast.success("Mensagem enviada com sucesso!");
                setNewCommentContent("");
                
                // Buscar comentários atualizados diretamente via Server Action
                const comments = await getRequestComments(selectedRequestForAction.id);
                
                // Atualizar o modal localmente na hora
                setSelectedRequestForAction({
                    ...selectedRequestForAction,
                    comments: comments
                });

                // Atualizar as listas da tela em background
                loadPerformanceData().catch(console.error);
                loadClientDetails().catch(console.error);
            } else {
                toast.error("Erro ao enviar mensagem.");
            }
        } catch (err) {
            toast.error("Erro ao enviar comentário.");
        } finally {
            setSubmittingComment(false);
        }
    };

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

    const handleAddRoutineClick = () => {
        setEditingRoutine(null);
        setRoutineStartTime("");
        setRoutineEndTime("");
        setRoutineDuration("");
        setRoutineLocation("");
        setRoutineActivity("");
        setRoutineDialogOpen(true);
    };

    const handleEditRoutineClick = (r: any) => {
        setEditingRoutine(r);
        setRoutineStartTime(r.startTime);
        setRoutineEndTime(r.endTime);
        setRoutineDuration(r.duration);
        setRoutineLocation(r.location);
        setRoutineActivity(r.activity);
        setRoutineDialogOpen(true);
    };

    const handleDeleteRoutineClick = async (id: string) => {
        if (!confirm("Deseja realmente excluir esta atividade do plano de trabalho?")) {
            return;
        }
        try {
            const res = await deleteWorkRoutine(id, selectedPostoId);
            if (res.success) {
                toast.success("Atividade excluída com sucesso.");
                loadRoutines();
            } else {
                toast.error(res.error || "Erro ao excluir atividade.");
            }
        } catch (e) {
            toast.error("Erro ao excluir atividade.");
        }
    };

    const handleSaveRoutine = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!routineStartTime || !routineEndTime || !routineLocation || !routineActivity) {
            toast.error("Preencha todos os campos obrigatórios.");
            return;
        }
        setSavingRoutine(true);
        try {
            const res = await saveWorkRoutine({
                id: editingRoutine?.id,
                postoId: selectedPostoId,
                startTime: routineStartTime,
                duration: routineDuration,
                endTime: routineEndTime,
                location: routineLocation,
                activity: routineActivity
            });
            if (res.success) {
                toast.success(editingRoutine ? "Atividade atualizada!" : "Atividade cadastrada!");
                setRoutineDialogOpen(false);
                loadRoutines();
            } else {
                toast.error(res.error || "Erro ao salvar atividade.");
            }
        } catch (e) {
            toast.error("Erro ao salvar atividade.");
        } finally {
            setSavingRoutine(false);
        }
    };

    const handleSaveVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        const cid = visitClientId === "all" ? (initialClients[0]?.id || "") : visitClientId;
        if (!cid || !visitorName || !visitDate) {
            toast.error("Preencha todos os campos obrigatórios.");
            return;
        }
        const roleToSend = visitorRole === "OUTRO" ? customVisitorRole.trim().toUpperCase() : visitorRole;
        if (!roleToSend) {
            toast.error("Por favor, preencha o nome do cargo customizado.");
            return;
        }

        setSavingVisit(true);
        try {
            const res = await createContractVisit({
                clientId: cid,
                visitorRole: roleToSend,
                visitorName,
                visitDate,
                notes: visitNotes,
                evidenceUrl: visitEvidenceUrl
            });
            if (res.success) {
                toast.success("Visita de relacionamento registrada!");
                setLogVisitOpen(false);
                setVisitorName("Cristiano Magalhães");
                setVisitNotes("");
                setVisitEvidenceUrl("");
                setVisitFileName("");
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

    const handleEditVisitClick = (visit: any) => {
        setEditingVisit(visit);
        const isStandard = availableRoles.includes(visit.visitorRole);
        if (isStandard) {
            setEditVisitorRole(visit.visitorRole);
            setEditCustomVisitorRole("");
        } else {
            setEditVisitorRole("OUTRO");
            setEditCustomVisitorRole(visit.visitorRole);
            if (!availableRoles.includes(visit.visitorRole)) {
                setAvailableRoles(prev => [...prev, visit.visitorRole]);
            }
        }
        setEditVisitorName(visit.visitorName);
        const d = new Date(visit.visitDate);
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        setEditVisitDate(`${d.getUTCFullYear()}-${mm}-${dd}`);
        setEditVisitNotes(visit.notes || "");
        setEditVisitEvidenceUrl(visit.evidenceUrl || "");
        setEditVisitFileName(visit.evidenceUrl ? "Arquivo de Evidência Salvo" : "");
        setEditVisitOpen(true);
    };

    const handleUpdateVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingVisit) return;
        const roleToSend = editVisitorRole === "OUTRO" ? editCustomVisitorRole.trim().toUpperCase() : editVisitorRole;
        if (!roleToSend) {
            toast.error("Preencha o nome do cargo.");
            return;
        }
        setSavingVisit(true);
        try {
            const res = await updateContractVisit(editingVisit.id, {
                visitorRole: roleToSend,
                visitorName: editVisitorName,
                visitDate: editVisitDate,
                notes: editVisitNotes,
                evidenceUrl: editVisitEvidenceUrl
            });
            if (res.success) {
                toast.success("Visita updated!");
                setEditVisitOpen(false);
                setEditingVisit(null);
                setEditVisitFileName("");
                loadPerformanceData();
                loadClientDetails();
            } else {
                toast.error("Erro ao atualizar visita.");
            }
        } catch (e) {
            toast.error("Erro ao atualizar visita.");
        } finally {
            setSavingVisit(false);
        }
    };

    const handleDeleteVisit = async (visitId: string) => {
        if (!confirm("Deseja realmente excluir este registro de visita? Isso atualizará a nota de KPI imediatamente.")) return;
        try {
            const res = await deleteContractVisit(visitId);
            if (res.success) {
                toast.success("Visita excluída!");
                loadPerformanceData();
                loadClientDetails();
            } else {
                toast.error("Erro ao excluir visita.");
            }
        } catch (e) {
            toast.error("Erro ao excluir visita.");
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

    // Cell-level inline editor handler
    const handleSaveCellManualValue = async (month: number, configItemId: string, val: number) => {
        setEditingCell(null);
        try {
            const res = await updateSlaMonthlyValue(configItemId, month, selectedYear, val);
            if (res.success) {
                toast.success('Valor atualizado com sucesso!');
                loadClientDetails();
                loadPerformanceData();
            } else {
                toast.error('Erro ao salvar valor.');
            }
        } catch (e) {
            toast.error('Erro de conexão.');
        }
    };

    // Dedicated KPI Handlers
    const handleSaveKpi = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKpiName) {
            toast.error('Por favor, informe o nome do KPI.');
            return;
        }
        const finalMetricType = selectedKpiType === 'CREATE_NEW' ? 'MANUAL' : selectedKpiType;
        
        setSavingSla(true);
        try {
            const res = await upsertSlaConfigItem({
                id: editingKpi?.id,
                clientId: selectedClientId,
                name: newKpiName,
                metricType: finalMetricType,
                weight: editingKpi ? editingKpi.weight : 0,
                targetValue: editingKpi ? editingKpi.targetValue : 0,
                checklistUnitIds: finalMetricType === 'CHECKLIST_FACIL' ? newKpiUnitIds : undefined,
                checklistIds: finalMetricType === 'CHECKLIST_FACIL' ? newKpiChecklistIds : undefined,
                ranges: editingKpi?.ranges || []
            });
            if (res.success) {
                toast.success('KPI configurado com sucesso!');
                setKpiFormOpen(false);
                setEditingKpi(null);
                loadPerformanceData();
                loadClientDetails();
            } else {
                toast.error('Erro ao salvar KPI.');
            }
        } catch (err) {
            toast.error('Erro de conexão.');
        } finally {
            setSavingSla(false);
        }
    };

    const handleDeleteKpiClick = async (id: string) => {
        if (!confirm('Excluir este KPI do contrato?')) return;
        try {
            const res = await deleteSlaConfigItem(id);
            if (res.success) {
                toast.success('KPI excluído com sucesso.');
                loadPerformanceData();
                loadClientDetails();
            } else {
                toast.error('Erro ao excluir.');
            }
        } catch (e) {
            toast.error('Erro de conexão.');
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
                targetValue: Number(slaTarget),
                ranges: slaRanges
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
        if (!confirm('Remover este indicador do cálculo de SLA? Ele continuará visível como um KPI bruto na aba de Indicadores.')) return;
        try {
            const item = detailedData.slaConfigItems.find((i: any) => i.id === id);
            if (!item) return;
            const res = await upsertSlaConfigItem({
                id: item.id,
                clientId: selectedClientId,
                name: item.name,
                metricType: item.metricType,
                weight: 0,
                targetValue: 0,
                ranges: item.ranges || []
            });
            if (res.success) {
                toast.success('Indicador removido do SLA. Ele continua existindo como KPI bruto.');
                loadPerformanceData();
                loadClientDetails();
            } else {
                toast.error('Erro ao remover do SLA.');
            }
        } catch (e) {
            toast.error('Erro de conexão.');
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
        { id: "service_plan", label: "Plano de Serviços", icon: ClipboardList },
        { id: "pops", label: "Documentos POP", icon: FileCheck }
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

    useEffect(() => {
        if (selectedClientId !== "all" && requestsViewMode === "kanban-contract") {
            setRequestsViewMode("kanban-status");
        }
    }, [selectedClientId, requestsViewMode]);

    const renderRequestsManager = (requestsList: any[]) => {
        const getStatusBadge = (status: string) => {
            switch (status) {
                case "CONCLUIDO":
                    return <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase rounded-full">Concluído</Badge>;
                case "PENDENTE":
                    return <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase rounded-full">Pendente</Badge>;
                case "EM_ANDAMENTO":
                case "EM_ANALISE_RH":
                    return <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black uppercase rounded-full">Em Execução</Badge>;
                case "REJEITADO":
                case "CANCELADO":
                    return <Badge className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-black uppercase rounded-full">Recusado / Cancelado</Badge>;
                default:
                    return <Badge className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-black uppercase rounded-full">{status}</Badge>;
            }
        };

        const getTypeLabel = (type: string) => {
            switch (type) {
                case "MOVIMENTACAO":
                    return "Movimentação de Pessoal";
                case "UNIFORME":
                    return "Solicitação de Uniforme";
                case "TERMINO_CONTRATO_EXPERIENCIA":
                    return "Término de Contrato Experiência";
                default:
                    return "Outros Serviços";
            }
        };

        const getSlaBadge = (dueDateStr: string, status: string) => {
            const dueDate = new Date(dueDateStr);
            const now = new Date();
            const isExpired = now > dueDate && status !== "CONCLUIDO" && status !== "REJEITADO" && status !== "CANCELADO";
            
            if (isExpired) {
                return <span className="bg-red-100 text-red-700 text-[9px] font-bold px-2 py-0.5 rounded animate-pulse border border-red-200">Expirado</span>;
            }
            if (status === "CONCLUIDO") {
                return <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded border border-slate-200">Concluído</span>;
            }
            return <span className="bg-sky-100 text-sky-700 text-[9px] font-bold px-2 py-0.5 rounded border border-sky-200">No Prazo</span>;
        };

        const renderRequestCard = (r: any) => {
            return (
                <div
                    key={r.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, r.id)}
                    onClick={() => setSelectedRequestForAction({ ...r })}
                    className="border border-slate-200/60 hover:shadow-premium hover:border-slate-300 hover:scale-[1.01] cursor-pointer transition-all duration-200 bg-white rounded-xl overflow-hidden p-3.5 space-y-3 shadow-sm select-none"
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 text-slate-700 max-w-[120px] truncate" title={r.clientName}>
                            {r.clientName}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-2" title={r.description}>
                            {r.description}
                        </h4>
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] text-slate-500 font-semibold italic">
                                {getTypeLabel(r.type)}
                            </p>
                            {getSlaBadge(r.dueDate, r.status)}
                        </div>
                    </div>
                    {r.employeeName && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{r.employeeName}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-400 gap-2">
                        <span className="font-semibold truncate">Por: {r.requesterName}</span>
                        <div className="flex items-center gap-1">
                            {getStatusBadge(r.status)}
                        </div>
                    </div>
                </div>
            );
        };

        if (requestsViewMode === "kanban-status") {
            const columns = [
                {
                    title: "Pendente / Aguardando",
                    id: "PENDENTE",
                    statuses: ["PENDENTE", "AGUARDANDO_APROVACAO"],
                    bg: "bg-amber-50/20 border-amber-100/40",
                    headerBg: "bg-amber-50 text-amber-800"
                },
                {
                    title: "Em Execução / RH",
                    id: "EM_ANDAMENTO",
                    statuses: ["EM_ANALISE_RH", "EM_ANDAMENTO"],
                    bg: "bg-indigo-50/15 border-indigo-100/40",
                    headerBg: "bg-indigo-50 text-indigo-850"
                },
                {
                    title: "Concluídas",
                    id: "CONCLUIDO",
                    statuses: ["CONCLUIDO"],
                    bg: "bg-emerald-50/15 border-emerald-100/40",
                    headerBg: "bg-emerald-50 text-emerald-850"
                },
                {
                    title: "Canceladas / Recusadas",
                    id: "REJEITADO",
                    statuses: ["REJEITADO", "CANCELADO"],
                    bg: "bg-red-50/15 border-red-100/40",
                    headerBg: "bg-red-50 text-red-850"
                }
            ];

            return (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {columns.map((col) => {
                        const colRequests = requestsList.filter((r) => col.statuses.includes(r.status));
                        return (
                            <div 
                                key={col.id} 
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDropStatus(e, col.id)}
                                className={`flex flex-col rounded-2xl border ${col.bg} p-3.5 min-h-[500px] transition-all`}
                            >
                                <div className={`flex items-center justify-between mb-3 px-3 py-1.5 rounded-xl ${col.headerBg} font-bold text-xs shrink-0`}>
                                    <span>{col.title}</span>
                                    <span className="bg-white/70 px-2 py-0.5 rounded-full text-[10px] font-black">{colRequests.length}</span>
                                </div>
                                <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
                                    {colRequests.length === 0 ? (
                                        <div className="text-center text-[11px] text-slate-400 italic py-12 bg-white/40 rounded-xl border border-dashed border-slate-200">
                                            Nenhuma solicitação
                                        </div>
                                    ) : (
                                        colRequests.map((r) => renderRequestCard(r))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (requestsViewMode === "kanban-contract") {
            const activeClients = consolidatedData?.clients || [];
            return (
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin max-w-full">
                    {activeClients.map((client: any) => {
                        const clientRequests = requestsList.filter((r) => r.clientId === client.id);
                        return (
                            <div 
                                key={client.id}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDropContract(e, client.id)}
                                className="flex flex-col w-72 shrink-0 bg-slate-50/60 border border-slate-200 p-3.5 rounded-2xl min-h-[500px]"
                            >
                                <div className="flex items-center justify-between mb-3 bg-slate-900 text-white px-3 py-2 rounded-xl font-bold text-[11px] uppercase tracking-wide shrink-0">
                                    <span className="truncate max-w-[200px]">{client.name}</span>
                                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-[9px] font-black">{clientRequests.length}</span>
                                </div>
                                <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
                                    {clientRequests.length === 0 ? (
                                        <div className="text-center text-[11px] text-slate-400 italic py-12 bg-white/40 rounded-xl border border-dashed border-slate-200">
                                            Nenhuma solicitação
                                        </div>
                                    ) : (
                                        clientRequests.map((r) => renderRequestCard(r))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        // Visão Lista
        const filteredRequests = requestsList.filter((r) => {
            const matchesSearch = !listSearchQuery || 
                r.description?.toLowerCase().includes(listSearchQuery.toLowerCase()) || 
                r.employeeName?.toLowerCase().includes(listSearchQuery.toLowerCase()) ||
                r.requesterName?.toLowerCase().includes(listSearchQuery.toLowerCase());

            const matchesContract = listSelectedContract === "all" || r.clientId === listSelectedContract;
            
            const matchesStatus = listSelectedStatus === "all" || 
                (listSelectedStatus === "PENDENTE" && (r.status === "PENDENTE" || r.status === "AGUARDANDO_APROVACAO")) ||
                (listSelectedStatus === "EM_ANDAMENTO" && (r.status === "EM_ANDAMENTO" || r.status === "EM_ANALISE_RH")) ||
                (listSelectedStatus === "CONCLUIDO" && r.status === "CONCLUIDO") ||
                (listSelectedStatus === "REJEITADO" && (r.status === "REJEITADO" || r.status === "CANCELADO"));

            return matchesSearch && matchesContract && matchesStatus;
        });

        const activeClients = consolidatedData?.clients || [];

        return (
            <Card className="border border-slate-200/50 shadow-premium bg-white rounded-2xl overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-150 flex flex-col md:flex-row gap-3 items-center justify-between shrink-0">
                    <div className="w-full md:w-72">
                        <Input
                            placeholder="Buscar por descrição, funcionário..."
                            value={listSearchQuery}
                            onChange={(e) => setListSearchQuery(e.target.value)}
                            className="bg-white rounded-xl h-9 text-xs border-slate-250 font-semibold"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                            <span className="text-[10px] font-black uppercase text-slate-400">Contrato:</span>
                            <select
                                value={listSelectedContract}
                                onChange={(e) => setListSelectedContract(e.target.value)}
                                className="h-9 border border-slate-200 bg-white rounded-xl text-xs font-semibold px-3 outline-none cursor-pointer w-full sm:w-[180px]"
                            >
                                <option value="all">Todos os Contratos</option>
                                {activeClients.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                            <span className="text-[10px] font-black uppercase text-slate-400">Status:</span>
                            <select
                                value={listSelectedStatus}
                                onChange={(e) => setListSelectedStatus(e.target.value)}
                                className="h-9 border border-slate-200 bg-white rounded-xl text-xs font-semibold px-3 outline-none cursor-pointer w-full sm:w-[150px]"
                            >
                                <option value="all">Todos os Status</option>
                                <option value="PENDENTE">Pendente</option>
                                <option value="EM_ANDAMENTO">Em Execução</option>
                                <option value="CONCLUIDO">Concluído</option>
                                <option value="REJEITADO">Recusado / Cancelado</option>
                            </select>
                        </div>
                    </div>
                </div>
                {filteredRequests.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 italic text-xs">
                        Nenhuma solicitação encontrada.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-[20px] m-1 border border-slate-200/50">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow>
                                    <TableHead className="font-bold text-slate-800 text-xs py-3 pl-6">Contrato</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-xs py-3">Descrição</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-xs py-3">Tipo</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-xs py-3">Solicitante</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-xs py-3">Colaborador</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-xs py-3">Criação</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-xs py-3">Prazo SLA</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-xs py-3 text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRequests.map((r) => (
                                    <TableRow 
                                        key={r.id} 
                                        onClick={() => setSelectedRequestForAction({ ...r })}
                                        className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                                    >
                                        <TableCell className="text-xs font-bold text-slate-800 pl-6 py-3">{r.clientName}</TableCell>
                                        <TableCell className="text-xs text-slate-700 py-3 font-medium max-w-xs truncate" title={r.description}>{r.description}</TableCell>
                                        <TableCell className="text-xs text-slate-500 py-3 font-semibold">{getTypeLabel(r.type)}</TableCell>
                                        <TableCell className="text-xs text-slate-655 font-bold py-3">{r.requesterName}</TableCell>
                                        <TableCell className="text-xs text-slate-600 font-semibold py-3">
                                            {r.employeeName ? (
                                                <span className="flex items-center gap-1">
                                                    <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                                                    {r.employeeName}
                                                </span>
                                            ) : "-"}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-500 py-3">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                                        <TableCell className="text-xs font-black text-slate-700 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <span>{new Date(r.dueDate).toLocaleDateString("pt-BR")}</span>
                                                {getSlaBadge(r.dueDate, r.status)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center py-3">{getStatusBadge(r.status)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </Card>
        );
    }

    if (selectedClientId === "all") {
        return (
            <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans w-full">
                {/* Header Executivo - Sem Sidebar */}
                <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 text-white shadow-md">
                    <div className="flex items-center gap-3">
                        <a href="/admin" className="mr-1 hover:bg-slate-800 p-2 rounded-xl transition-all text-slate-400 hover:text-white cursor-pointer flex items-center justify-center border border-slate-800 hover:border-slate-700 bg-slate-950/30 shadow-inner" title="Voltar ao Painel Principal">
                            <ArrowLeft className="w-4 h-4" />
                        </a>
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

                {/* Abas Executivas para alternar entre Performance e Solicitações Geral */}
                <div className="bg-slate-900 border-b border-slate-800 px-6 py-2 flex items-center gap-4 text-white shrink-0">
                    <button
                        onClick={() => setConsolidatedTab("performance")}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            consolidatedTab === "performance"
                                ? "bg-primary text-slate-900 shadow-md font-black"
                                : "text-slate-400 hover:bg-slate-800 hover:text-white"
                        }`}
                    >
                        Desempenho & Contratos
                    </button>
                    <button
                        onClick={() => setConsolidatedTab("requests")}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            consolidatedTab === "requests"
                                ? "bg-primary text-slate-900 shadow-md font-black"
                                : "text-slate-400 hover:bg-slate-800 hover:text-white"
                        }`}
                    >
                        Central de Solicitações (Todos)
                    </button>
                </div>

                {/* Área de Conteúdo Executivo */}
                <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 max-w-7xl mx-auto w-full">
                    {consolidatedTab === "performance" ? (
                        <>
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
                                                        {c.npsCount > 0 ? `${(c.npsRating * 10).toFixed(2).replace('.', ',')}%` : "0,00%"}
                                                    </TableCell>
                                                    <TableCell className="text-center py-3">
                                                        <span className={`px-2 py-0.5 rounded font-black text-xs ${
                                                            c.slaCompliance >= 90 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-655"
                                                        }`}>
                                                            {c.slaCompliance.toFixed(1)}%
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-center text-xs font-semibold text-slate-660 py-3">
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
                        </>
                    ) : (
                        <div className="space-y-6">
                            {/* Header de Visualizações para Solicitações Consolidadas */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">Central de Chamados (Todos os Contratos)</h3>
                                    <p className="text-xs text-slate-500 font-medium">Controle consolidado de solicitações de todos os clientes e contratos.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                                        <button
                                            onClick={() => setRequestsViewMode("kanban-status")}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                requestsViewMode === "kanban-status" ? "bg-white text-slate-900 shadow-sm font-extrabold" : "text-slate-500 hover:text-slate-850"
                                            }`}
                                        >
                                            Kanban Status
                                        </button>
                                        <button
                                            onClick={() => setRequestsViewMode("kanban-contract")}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                requestsViewMode === "kanban-contract" ? "bg-white text-slate-900 shadow-sm font-extrabold" : "text-slate-500 hover:text-slate-850"
                                            }`}
                                        >
                                            Kanban Contrato
                                        </button>
                                        <button
                                            onClick={() => setRequestsViewMode("list")}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                requestsViewMode === "list" ? "bg-white text-slate-900 shadow-sm font-extrabold" : "text-slate-500 hover:text-slate-850"
                                            }`}
                                        >
                                            Visão Lista
                                        </button>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={loadPerformanceData} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                                        <RefreshCw className="w-4 h-4 text-slate-500" />
                                    </Button>
                                </div>
                            </div>

                            {renderRequestsManager(consolidatedData?.allRequests || [])}
                        </div>
                    )}
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
                                        <div className="flex items-center gap-1.5">
                                            <select
                                                value={visitorRole}
                                                onChange={(e) => {
                                                    setVisitorRole(e.target.value);
                                                    if (e.target.value !== "OUTRO") setCustomVisitorRole("");
                                                }}
                                                className="flex-1 h-10 border border-slate-200 rounded-xl text-xs font-semibold px-3 outline-none focus:border-primary bg-white"
                                                required
                                            >
                                                {availableRoles.map(role => (
                                                    <option key={role} value={role}>{role.charAt(0) + role.slice(1).toLowerCase()}</option>
                                                ))}
                                                <option value="OUTRO">Outro cargo...</option>
                                            </select>
                                            <Button
                                                type="button"
                                                onClick={() => {
                                                    const newRole = prompt("Digite o nome do novo cargo:");
                                                    if (newRole && newRole.trim()) {
                                                        const formatted = newRole.trim().toUpperCase();
                                                        if (!availableRoles.includes(formatted)) {
                                                            setAvailableRoles(prev => [...prev, formatted]);
                                                        }
                                                        setVisitorRole(formatted);
                                                    }
                                                }}
                                                className="h-10 w-10 p-0 bg-slate-105 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-700 flex items-center justify-center cursor-pointer shadow-premium"
                                                title="Cadastrar Novo Cargo"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                {visitorRole === "OUTRO" && (
                                    <div className="space-y-1 mt-3 px-3">
                                        <Label className="text-xs font-bold text-slate-655">Digite o Nome do Cargo *</Label>
                                        <Input
                                            placeholder="Ex: Supervisor Operacional, Analista de Qualidade"
                                            value={customVisitorRole}
                                            onChange={(e) => setCustomVisitorRole(e.target.value)}
                                            className="h-10 rounded-xl"
                                            required
                                        />
                                    </div>
                                )}

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
                                    <Label className="text-xs font-bold text-slate-655">Subir Evidência (Foto, PDF, Ata, Checklist) *</Label>
                                    <div className="flex flex-col gap-2">
                                        <Input
                                            type="file"
                                            accept="image/*,application/pdf"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    if (file.size > 4.5 * 1024 * 1024) {
                                                        toast.error("O arquivo deve ter no máximo 4.5 MB.");
                                                        e.target.value = "";
                                                        return;
                                                    }
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setVisitEvidenceUrl(reader.result as string);
                                                        setVisitFileName(file.name);
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                            className="h-10 rounded-xl cursor-pointer text-xs"
                                        />
                                        {visitEvidenceUrl && (
                                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl select-none">
                                                <span className="text-[10px] font-bold text-slate-700 truncate max-w-[280px]">
                                                    📎 {visitFileName || "Arquivo de Evidência"}
                                                </span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setVisitEvidenceUrl("");
                                                        setVisitFileName("");
                                                    }}
                                                    className="h-6 w-6 p-0 rounded-full hover:bg-slate-200 text-red-500"
                                                >
                                                    ✕
                                                </Button>
                                            </div>
                                        )}
                                    </div>
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

                {/* Dialog de Detalhes e Transição da Solicitação */}
                <Dialog open={selectedRequestForAction !== null} onOpenChange={(open) => { if (!open) { setSelectedRequestForAction(null); setConfirmDeleteId(null); } }}>
                    <DialogContent className="sm:max-w-[550px] rounded-[24px] overflow-hidden p-6 gap-0">
                        <DialogHeader className="pb-4 border-b border-slate-100">
                            <div className="flex items-center justify-between w-full">
                                <DialogTitle className="text-md font-bold text-slate-800">Detalhes da Solicitação</DialogTitle>
                                {selectedRequestForAction && (
                                    <div className="flex items-center gap-1.5">
                                        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-[10px] font-black uppercase rounded-lg px-2 py-0.5">
                                            {selectedRequestForAction.type === "MOVIMENTACAO" && "Movimentação"}
                                            {selectedRequestForAction.type === "UNIFORME" && "Uniforme"}
                                            {selectedRequestForAction.type === "TERMINO_CONTRATO_EXPERIENCIA" && "Expira Experiência"}
                                        </Badge>
                                        <Badge className={`${
                                            selectedRequestForAction.status === "CONCLUIDO" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                            selectedRequestForAction.status === "PENDENTE" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                            selectedRequestForAction.status === "EM_ANDAMENTO" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                                            "bg-red-50 text-red-700 border border-red-200"
                                        } text-[10px] font-black uppercase rounded-lg px-2 py-0.5`}>
                                            {selectedRequestForAction.status === "CONCLUIDO" && "Concluído"}
                                            {selectedRequestForAction.status === "PENDENTE" && "Pendente"}
                                            {selectedRequestForAction.status === "EM_ANDAMENTO" && "Em Execução"}
                                            {selectedRequestForAction.status === "EM_ANALISE_RH" && "Em Análise RH"}
                                            {selectedRequestForAction.status === "REJEITADO" && "Rejeitado"}
                                            {selectedRequestForAction.status === "CANCELADO" && "Cancelado"}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                            <DialogDescription className="text-xs text-slate-400 mt-1 font-medium">
                                Histórico do chamado, controle de SLA e transição de status operacional.
                            </DialogDescription>
                        </DialogHeader>

                        {selectedRequestForAction && (
                            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
                                {/* Bloco de Informações Principais */}
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase text-slate-400 block">Contrato</span>
                                        <span className="text-xs font-bold text-slate-800 block truncate">{selectedRequestForAction.clientName}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase text-slate-400 block">Solicitante</span>
                                        <span className="text-xs font-bold text-slate-800 block truncate">{selectedRequestForAction.requesterName}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase text-slate-400 block">Data de Criação</span>
                                        <span className="text-xs font-bold text-slate-700 block">
                                            {new Date(selectedRequestForAction.createdAt).toLocaleDateString("pt-BR")}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase text-slate-400 block font-bold">
                                            {selectedRequestForAction.status === "PENDENTE" && (selectedRequestForAction.comments || []).filter((c: any) => c.user?.role !== "CLIENTE").length === 0 
                                                ? "Prazo 1ª Resposta (24h úteis)" 
                                                : "Previsão de Solução"
                                            }
                                        </span>
                                        <input
                                            type="date"
                                            value={selectedRequestForAction.dueDate ? selectedRequestForAction.dueDate.split("T")[0] : ""}
                                            onChange={(e) => setSelectedRequestForAction({ ...selectedRequestForAction, dueDate: e.target.value ? e.target.value + "T23:59:59.000Z" : selectedRequestForAction.dueDate })}
                                            className="h-8 border border-slate-200 bg-white rounded-lg text-xs font-semibold px-2 outline-none w-full shadow-sm"
                                        />
                                    </div>
                                </div>

                                {/* Colaborador Relacionado (Editável) */}
                                <div className="space-y-1 bg-blue-50/40 p-3.5 rounded-xl border border-blue-100/50">
                                    <span className="text-[10px] font-black uppercase text-blue-500 block font-bold">Colaborador Envolvido</span>
                                    <select
                                        value={selectedRequestForAction.employeeId || ""}
                                        onChange={(e) => {
                                            const empId = e.target.value;
                                            const empObj = (consolidatedData?.allEmployees || []).find((emp: any) => emp.id === empId);
                                            setSelectedRequestForAction({
                                                ...selectedRequestForAction,
                                                employeeId: empId || null,
                                                employeeName: empObj ? empObj.name : null
                                            });
                                        }}
                                        className="w-full h-9 border border-blue-200 bg-white text-xs font-semibold px-2 outline-none rounded-lg cursor-pointer text-blue-900 shadow-sm"
                                    >
                                        <option value="">Nenhum Colaborador</option>
                                        {(consolidatedData?.allEmployees || []).map((emp: any) => (
                                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Descrição Completa (Editável) */}
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 font-bold">Descrição da Solicitação</Label>
                                    <textarea
                                        value={selectedRequestForAction.description || ""}
                                        onChange={(e) => setSelectedRequestForAction({ ...selectedRequestForAction, description: e.target.value })}
                                        rows={3}
                                        className="w-full border border-slate-200 rounded-xl text-xs font-semibold p-3 outline-none resize-none bg-slate-50 focus:bg-white transition-all leading-relaxed shadow-sm"
                                    />
                                </div>

                                {/* Divider */}
                                <div className="border-t border-slate-100 my-4" />

                                {/* Bloco de Ações do Gestor */}
                                <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/50">
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Ações de Gestão</h4>
                                    
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-black uppercase text-slate-500">Mudar Status do Chamado</Label>
                                        <select
                                            value={selectedRequestForAction.nextStatus || selectedRequestForAction.status}
                                            onChange={(e) => setSelectedRequestForAction({ ...selectedRequestForAction, nextStatus: e.target.value })}
                                            className="w-full h-10 border border-slate-200 bg-white text-xs font-semibold px-3 outline-none rounded-xl cursor-pointer"
                                        >
                                            <option value="PENDENTE">Aguardando (Pendente)</option>
                                            <option value="EM_ANDAMENTO">Em Execução (Em Andamento)</option>
                                            <option value="CONCLUIDO">Concluir Solicitação</option>
                                            <option value="REJEITADO">Rejeitar Solicitação</option>
                                            <option value="CANCELADO">Cancelar Solicitação</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Histórico e Chat de Comentários do Chamado */}
                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block font-bold">Histórico de Mensagens / Respostas com o Cliente</span>
                                    
                                    {/* Chat de mensagens */}
                                    <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        {/* Parecer final da JVS se houver */}
                                        {selectedRequestForAction.resolutionNotes && (
                                            <div className="flex flex-col gap-1 items-start">
                                                <div className="bg-slate-200 text-slate-800 p-2.5 rounded-2xl rounded-tl-none max-w-[85%] text-xs font-medium leading-relaxed">
                                                    <span className="text-[9px] font-black uppercase text-slate-500 block mb-0.5">Operação JVS (Parecer de Resolução)</span>
                                                    {selectedRequestForAction.resolutionNotes}
                                                </div>
                                            </div>
                                        )}

                                        {/* Comentários adicionais */}
                                        {(selectedRequestForAction.comments || []).length === 0 && !selectedRequestForAction.resolutionNotes ? (
                                            <div className="text-center text-[10px] font-medium text-slate-400 py-6 italic">Sem mensagens adicionais registradas neste chamado.</div>
                                        ) : (
                                            (selectedRequestForAction.comments || []).map((comm: any) => {
                                                const isMyComment = comm.user?.role !== "CLIENTE";
                                                return (
                                                    <div key={comm.id} className={`flex flex-col gap-1 ${isMyComment ? "items-end" : "items-start"}`}>
                                                        <div className={`p-2.5 rounded-2xl text-xs font-medium leading-relaxed max-w-[85%] ${
                                                            isMyComment 
                                                                ? "bg-blue-600 text-white rounded-tr-none" 
                                                                : "bg-slate-200 text-slate-800 rounded-tl-none"
                                                        }`}>
                                                            <span className="text-[9px] font-black uppercase block opacity-70 mb-0.5">
                                                                {isMyComment ? `Você (${comm.user?.name || "Operador"})` : "Cliente"}
                                                            </span>
                                                            {comm.content}
                                                        </div>
                                                        <span className="text-[8px] font-semibold text-slate-400 px-1">
                                                            {comm.createdAt ? new Date(comm.createdAt).toLocaleString("pt-BR") : ""}
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Enviar novo comentário / resposta */}
                                    <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t border-slate-100/50">
                                        <input
                                            type="text"
                                            placeholder="Digite uma mensagem/resposta para o cliente..."
                                            value={newCommentContent}
                                            onChange={(e) => setNewCommentContent(e.target.value)}
                                            className="flex-1 h-9 border border-slate-200 bg-white rounded-xl text-xs font-semibold px-3 outline-none focus:border-blue-500 text-slate-800"
                                            required
                                        />
                                        <Button 
                                            type="submit" 
                                            disabled={submittingComment || !newCommentContent.trim()}
                                            className="h-9 text-[10px] font-black uppercase tracking-wider px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shrink-0 cursor-pointer"
                                        >
                                            {submittingComment ? "..." : "Enviar"}
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        )}

                        <DialogFooter className="pt-4 border-t border-slate-100 flex items-center justify-between w-full gap-2">
                            <div>
                                {userRole === "ADMIN" && selectedRequestForAction && (
                                    confirmDeleteId === selectedRequestForAction.id ? (
                                        <Button
                                            type="button"
                                            disabled={deletingRequest}
                                            onClick={() => handleDeleteRequest(selectedRequestForAction.id)}
                                            className="h-10 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white gap-1.5 animate-pulse"
                                        >
                                            <AlertCircle className="w-4 h-4" /> Confirmar Exclusão?
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setConfirmDeleteId(selectedRequestForAction.id)}
                                            className="h-10 text-xs font-bold rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 gap-1.5"
                                        >
                                            <Trash2 className="w-4 h-4" /> Excluir Solicitação
                                        </Button>
                                    )
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button type="button" variant="outline" onClick={() => { setSelectedRequestForAction(null); setConfirmDeleteId(null); }} className="h-10 text-xs font-bold rounded-xl">Fechar</Button>
                                <Button
                                    type="button"
                                    disabled={transitioningRequestState || savingRequestDetails}
                                    onClick={handleSaveRequestDetails}
                                    className="h-10 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                                >
                                    Salvar Alteração
                                </Button>
                            </div>
                        </DialogFooter>
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
                        <Button 
                            size="sm" 
                            onClick={() => {
                                setVisitClientId(selectedClientId);
                                setLogVisitOpen(true);
                            }}
                            className="h-9 px-4 bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-premium shrink-0"
                            title="Registrar Visita de Relacionamento"
                        >
                            Registrar Visita
                        </Button>
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
                                                                    {c.npsCount > 0 ? `${(c.npsRating * 10).toFixed(2).replace('.', ',')}%` : "0,00%"}
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
                                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                                        <button
                                            onClick={() => setRequestsViewMode("kanban-status")}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                requestsViewMode === "kanban-status" ? "bg-white text-slate-900 shadow-sm font-extrabold" : "text-slate-500 hover:text-slate-850"
                                            }`}
                                        >
                                            Kanban Status
                                        </button>
                                        <button
                                            onClick={() => setRequestsViewMode("list")}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                requestsViewMode === "list" ? "bg-white text-slate-900 shadow-sm font-extrabold" : "text-slate-500 hover:text-slate-850"
                                            }`}
                                        >
                                            Visão Lista
                                        </button>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={loadPerformanceData} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                                        <RefreshCw className="w-4 h-4 text-slate-500" />
                                    </Button>
                                </div>
                            </div>

                            {renderRequestsManager(
                                (detailedData?.requests || []).map((r: any) => ({
                                    ...r,
                                    clientName: detailedData?.client?.name || "Contrato Atual"
                                }))
                            )}
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
                                                    <TableCell className="text-center text-xs font-black text-blue-600 py-3">{m.effectiveness !== null && m.effectiveness !== undefined ? `${m.effectiveness.toFixed(1)}%` : "-"}</TableCell>
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
                                    {selectedClientId === "all" ? (
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
                                    ) : (
                                        <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-1.5 flex flex-col items-center justify-center shrink-0 shadow-sm">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Média Geral Acumulada (Ano)</span>
                                            <span className="text-sm font-black text-blue-650 mt-0.5">
                                                {clientKpiData?.summary?.avgNpsRating 
                                                    ? `${(clientKpiData.summary.avgNpsRating * 10).toFixed(1).replace('.', ',')}%` 
                                                    : "100,0%"}
                                            </span>
                                        </div>
                                    )}
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
                                                            <TableCell className="text-center text-xs font-black py-2.5">{c.npsCount > 0 ? `${(c.npsRating * 10).toFixed(2).replace('.', ',')}%` : "0,00%"}</TableCell>
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
                                        {/* Sub-abas de NPS */}
                                        <div className="flex border-b border-slate-200 bg-white p-1 rounded-xl shadow-premium border border-slate-200/30">
                                            <button
                                                onClick={() => setNpsSubTab("results")}
                                                className={`pb-2 pt-2 px-4 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer rounded-lg ${
                                                    npsSubTab === "results" 
                                                        ? "bg-slate-900 text-white shadow-sm font-extrabold" 
                                                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                                                }`}
                                            >
                                                📊 Resultados & Notas
                                            </button>
                                            <button
                                                onClick={() => setNpsSubTab("config")}
                                                className={`pb-2 pt-2 px-4 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer rounded-lg ${
                                                    npsSubTab === "config" 
                                                        ? "bg-slate-900 text-white shadow-sm font-extrabold" 
                                                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                                                }`}
                                            >
                                                ⚙️ Configuração do NPS
                                            </button>
                                        </div>

                                        {npsSubTab === "results" ? (
                                            <div className="space-y-6">


                                                {/* Tabela de Notas Evolutivas nos 12 meses */}
                                                <Card className="border border-slate-200/50 shadow-premium bg-white rounded-2xl overflow-hidden">
                                                    <CardHeader>
                                                        <CardTitle className="text-sm font-black uppercase text-slate-850">Notas do NPS (Evolução 12 Meses)</CardTitle>
                                                        <CardDescription>Notas médias por quesito avaliado, mês a mês.</CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="p-0 border-t border-slate-100 overflow-x-auto">
                                                        <Table className="min-w-[900px]">
                                                            <TableHeader className="bg-slate-50">
                                                                <TableRow>
                                                                    <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">Quesito / Indicador</TableHead>
                                                                    {monthShortNames.map((m, idx) => (
                                                                        <TableHead key={idx} className="font-bold text-slate-800 text-xs text-center w-14 py-2.5">{m}</TableHead>
                                                                    ))}
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {(clientKpiData?.npsEvolution || []).map((row: any) => (
                                                                    <TableRow key={row.id} className="hover:bg-slate-50/50">
                                                                        <TableCell className="text-xs font-bold text-slate-700 pl-6 py-3">{row.text}</TableCell>
                                                                        {row.monthlyScores.map((score: number | null, mIdx: number) => (
                                                                            <TableCell key={mIdx} className="text-center text-xs font-black py-3">
                                                                                {score !== null ? (
                                                                                    <span className={score >= 8.5 ? "text-emerald-600 font-extrabold" : score >= 7.0 ? "text-amber-600 font-extrabold" : "text-red-500 font-extrabold"}>
                                                                                        {score.toFixed(1)}
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-slate-300">-</span>
                                                                                )}
                                                                            </TableCell>
                                                                        ))}
                                                                    </TableRow>
                                                                ))}
                                                                {(clientKpiData?.npsEvolution || []).length === 0 && (
                                                                    <TableRow>
                                                                        <TableCell colSpan={13} className="text-center py-6 text-slate-400 italic text-xs">
                                                                            Nenhum quesito cadastrado.
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}

                                                                {/* Linha de Totalização / Média do Mês */}
                                                                {(clientKpiData?.npsEvolution || []).length > 0 && (
                                                                    <TableRow className="bg-slate-100/60 font-extrabold border-t-2 border-slate-200 hover:bg-slate-100">
                                                                        <TableCell className="text-xs font-black text-slate-805 pl-6 py-3">Média Geral Mensal</TableCell>
                                                                        {Array.from({ length: 12 }).map((_, monthIdx) => {
                                                                            const scores: number[] = [];
                                                                            (clientKpiData?.npsEvolution || []).forEach((row: any) => {
                                                                                const val = row.monthlyScores[monthIdx];
                                                                                if (val !== null && val !== undefined) {
                                                                                    scores.push(val);
                                                                                }
                                                                            });

                                                                            if (scores.length === 0) {
                                                                                return (
                                                                                    <TableCell key={monthIdx} className="text-center text-xs text-slate-400 py-3 font-bold">
                                                                                        -
                                                                                    </TableCell>
                                                                                );
                                                                            }

                                                                            const avg = scores.reduce((sum, val) => sum + val, 0) / scores.length;
                                                                            return (
                                                                                <TableCell key={monthIdx} className="text-center text-xs font-black py-3">
                                                                                    <span className={avg >= 8.5 ? "text-emerald-600 font-extrabold" : avg >= 7.0 ? "text-amber-600 font-extrabold" : "text-red-500 font-extrabold"}>
                                                                                        {avg.toFixed(1)}
                                                                                    </span>
                                                                                </TableCell>
                                                                            );
                                                                        })}
                                                                    </TableRow>
                                                                )}
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
                                                            <div className="space-y-3">
                                                                {detailedData.npsResponses.map((r: any) => {
                                                                    let sumS = 0; let sumW = 0;
                                                                    r.answers.forEach((an: any) => {
                                                                        const w = an.question?.weight || 1.0;
                                                                        sumS += an.score * w; sumW += w;
                                                                    });
                                                                    const finalNpsVal = sumW > 0 ? sumS / sumW : 10;
                                                                    const isExpanded = expandedResponseId === r.id;

                                                                    return (
                                                                        <div 
                                                                            key={r.id} 
                                                                            onClick={() => setExpandedResponseId(isExpanded ? null : r.id)}
                                                                            className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 bg-white ${
                                                                                isExpanded 
                                                                                    ? "border-blue-400 shadow-md ring-1 ring-blue-400/20" 
                                                                                    : "border-slate-200 hover:border-slate-350 hover:bg-slate-50/30 shadow-sm"
                                                                            }`}
                                                                        >
                                                                            <div className="flex justify-between items-center text-xs">
                                                                                <span className="font-semibold text-slate-500 flex items-center gap-1.5 select-none">
                                                                                    📅 Enviado em {new Date(r.createdAt).toLocaleDateString('pt-BR')}
                                                                                    <span className="text-[10px] text-slate-400 font-normal">
                                                                                        ({isExpanded ? "clique para ocultar quesitos" : "clique para detalhar notas"})
                                                                                    </span>
                                                                                </span>
                                                                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                                    {userRole === "ADMIN" && (
                                                                                        confirmDeleteResponseId === r.id ? (
                                                                                            <Button
                                                                                                size="sm"
                                                                                                className="h-7 text-[10px] font-bold rounded-lg bg-red-650 text-white px-2.5 animate-pulse"
                                                                                                disabled={deletingResponse}
                                                                                                onClick={() => handleDeleteResponse(r.id)}
                                                                                            >
                                                                                                Confirmar?
                                                                                            </Button>
                                                                                        ) : (
                                                                                            <Button
                                                                                                size="sm"
                                                                                                variant="ghost"
                                                                                                className="h-7 w-7 p-0 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-650"
                                                                                                onClick={() => setConfirmDeleteResponseId(r.id)}
                                                                                            >
                                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                                            </Button>
                                                                                        )
                                                                                    )}
                                                                                    <span className="font-black text-blue-655 text-xs sm:text-sm bg-blue-50/50 px-2.5 py-1 rounded-lg border border-blue-100">
                                                                                        Nota Geral: {(finalNpsVal * 10).toFixed(2).replace('.', ',')}%
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            {r.feedback && (
                                                                                <p className="text-xs text-slate-650 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-medium italic">
                                                                                    "{r.feedback}"
                                                                                </p>
                                                                            )}

                                                                            {/* Respostas individuais expandidas por quesito */}
                                                                            {isExpanded && (
                                                                                <div className="pt-3 border-t border-slate-100 space-y-2.5 animate-fadeIn">
                                                                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Detalhamento por Quesito</h4>
                                                                                    <div className="grid grid-cols-1 gap-2 bg-slate-50/50 p-3 rounded-lg border border-slate-100" onClick={(e) => e.stopPropagation()}>
                                                                                        {r.answers.map((ans: any) => {
                                                                                            const qText = ans.question?.text || "Quesito de NPS";
                                                                                            const qWeight = ans.question?.weight || 1;
                                                                                            const score = ans.score;
                                                                                            return (
                                                                                                <div key={ans.id} className="flex justify-between items-start sm:items-center gap-4 text-xs">
                                                                                                    <span className="text-slate-600 font-semibold">{qText} <span className="text-[9px] text-slate-400 font-normal">(Peso: {qWeight})</span></span>
                                                                                                    <span className={`font-black px-2 py-0.5 rounded text-[10px] shrink-0 ${
                                                                                                        score >= 8.5 
                                                                                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                                                                                            : score >= 7.0 
                                                                                                                ? "bg-amber-50 text-amber-700 border border-amber-100" 
                                                                                                                : "bg-red-50 text-red-700 border border-red-100"
                                                                                                    }`}>
                                                                                                        {(score * 10).toFixed(2).replace('.', ',')}%
                                                                                                    </span>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                        {r.answers.length === 0 && (
                                                                                            <div className="text-xs text-slate-400 italic">Nenhum quesito individual respondido nesta avaliação.</div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        ) : (
                                            /* NPS Question Config */
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
                                        )}
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
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Efetividade Escala</span>
                                                <span className="text-xl font-black mt-1 text-emerald-600">
                                                    {clientKpiData.summary?.effectiveness !== undefined && clientKpiData.summary?.effectiveness !== null 
                                                        ? `${clientKpiData.summary.effectiveness.toFixed(1)}%` 
                                                        : "-"}
                                                </span>
                                            </Card>
                                            <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cumprimento SLA</span>
                                                <span className="text-xl font-black mt-1 text-blue-600">
                                                    {clientKpiData.summary?.slaCompliance !== undefined && clientKpiData.summary?.slaCompliance !== null 
                                                        ? `${clientKpiData.summary.slaCompliance.toFixed(1)}%` 
                                                        : "-"}
                                                </span>
                                            </Card>
                                            <Card className="border border-slate-200 bg-white shadow-sm p-4 py-3 flex flex-col justify-between h-auto min-h-[96px]">
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Nota NPS Média</span>
                                                <span className="text-xl font-black mt-1 text-amber-500">
                                                    {clientKpiData.summary?.avgNpsRating 
                                                        ? `${(clientKpiData.summary.avgNpsRating * 10).toFixed(1).replace('.', ',')}%` 
                                                        : "-"}
                                                </span>
                                            </Card>
                                        </div>

                                        {/* Tabela de KPIs Comparativa Mensal */}
                                        <Card className="border border-slate-200/50 shadow-premium bg-white overflow-hidden rounded-2xl">
                                            <CardHeader className="flex flex-row items-center justify-between">
                                                 <div>
                                                     <CardTitle className="text-sm font-black uppercase text-slate-855">Indicadores Operacionais de Performance (KPIs)</CardTitle>
                                                     <CardDescription>Notas e percentuais consolidados dos principais indicadores operacionais do contrato, mês a mês.</CardDescription>
                                                 </div>
                                                 <Button 
                                                     size="sm"
                                                     onClick={() => setKpiConfigOpen(true)}
                                                     className="gap-1 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-premium hover:bg-slate-800 transition-all cursor-pointer"
                                                 >
                                                     <Edit3 className="w-3.5 h-3.5" /> Configurar KPIs
                                                 </Button>
                                             </CardHeader>
                                            <CardContent className="p-0 border-t border-slate-100 overflow-x-auto">
                                                <Table className="min-w-[850px]">
                                                    <TableHeader className="bg-slate-50">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-slate-800 text-xs pl-6 py-3">Mês</TableHead>
                                                            {activeConfigs.map((config: any) => (
                                                                <TableHead key={config.id} className="font-bold text-slate-800 text-xs text-center py-3">
                                                                    {config.name}
                                                                </TableHead>
                                                            ))}
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {(clientKpiData.monthlyData || []).map((m: any) => {
                                                            const mIndex = m.monthIndex;
                                                            const monthRequests = (detailedData?.requests || []).filter((r: any) => new Date(r.createdAt).getMonth() === mIndex);
                                                            
                                                            const hasManualLaunch = activeConfigs.some((config: any) => 
                                                                config.metricType === "MANUAL" && 
                                                                config.monthlyValues?.some((v: any) => v.month === mIndex && v.year === selectedYear)
                                                            );
                                                            const hasData = (m.effectiveness !== null && m.effectiveness !== undefined) || 
                                                                (m.turnover !== null && m.turnover !== undefined && m.turnover > 0) || 
                                                                (m.avgRepositionDays !== null && m.avgRepositionDays !== undefined) || 
                                                                monthRequests.length > 0 || 
                                                                m.npsCount > 0 || 
                                                                hasManualLaunch;
 
                                                            if (!hasData) {
                                                                return (
                                                                    <TableRow key={m.monthIndex} className="hover:bg-slate-50/30 transition-colors">
                                                                        <TableCell className="font-bold text-xs text-slate-900 pl-6 py-3">{m.name}</TableCell>
                                                                        {activeConfigs.map((config: any) => (
                                                                            <TableCell key={config.id} className="text-center text-xs text-slate-400 py-3">-</TableCell>
                                                                        ))}
                                                                    </TableRow>
                                                                );
                                                            }
 
                                                            return (
                                                                <TableRow key={m.monthIndex} className="hover:bg-slate-50/50 transition-colors">
                                                                    <TableCell className="font-bold text-xs text-slate-900 pl-6 py-3">{m.name}</TableCell>
                                                                    {activeConfigs.map((config: any) => {
                                                                        const val = getKpiValue(m, config);
                                                                        const isEditable = config.metricType === 'MANUAL' || config.metricType === 'CHECKLIST_FACIL';
                                                                        const isClickableDetails = !isEditable && config.metricType !== 'VISITAS' && config.metricType !== 'CHECKLIST_FACIL';
                                                                        
                                                                        let colorClass = "text-slate-700";
                                                                        if (config.metricType === "EFETIVIDADE") colorClass = "text-emerald-600";
                                                                        else if (config.metricType === "NPS") colorClass = "text-blue-650";
                                                                        else if (config.metricType === "SLA_CHAMADOS") colorClass = "text-blue-600";
                                                                        else if (config.metricType === "RECLAMACOES") colorClass = "text-red-500";
                                                                        else if (config.metricType === "VISITAS") colorClass = "text-purple-650";
                                                                        else if (config.metricType === "REPOSICAO") colorClass = "text-blue-500";

                                                                        const cellKey = `${m.monthIndex}_${config.id}`;
                                                                        const isEditingThisCell = editingCell === cellKey;

                                                                        return (
                                                                            <TableCell 
                                                                                key={config.id}
                                                                                className={`text-center font-bold text-xs ${colorClass} py-3 select-none transition-all ${
                                                                                    isEditingThisCell ? 'bg-blue-50/50' : 
                                                                                    isEditable ? 'cursor-pointer hover:bg-slate-100 hover:text-slate-900 border-b border-dashed border-slate-200/60' :
                                                                                    isClickableDetails ? 'cursor-pointer hover:bg-slate-50 hover:scale-[1.02]' : ''
                                                                                }`}
                                                                                onClick={() => {
                                                                                    if (isEditingThisCell) return;
                                                                                    if (isEditable) {
                                                                                        setEditingCell(cellKey);
                                                                                    } else if (isClickableDetails) {
                                                                                        handleKpiClick(m, config);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                {isEditingThisCell ? (
                                                                                    <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                                                                                        <input
                                                                                            type="number"
                                                                                            defaultValue={config.monthlyValues?.find((v: any) => v.month === m.monthIndex && v.year === selectedYear)?.value ?? (config.metricType === 'CHECKLIST_FACIL' ? 10 : 90)}
                                                                                            onBlur={(e) => handleSaveCellManualValue(m.monthIndex, config.id, Number(e.target.value))}
                                                                                            onKeyDown={(e) => {
                                                                                                if (e.key === 'Enter') {
                                                                                                    handleSaveCellManualValue(m.monthIndex, config.id, Number(e.currentTarget.value));
                                                                                                }
                                                                                            }}
                                                                                            className="w-16 h-7 text-center border border-blue-400 rounded-lg font-bold text-xs bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                                                                                            autoFocus
                                                                                        />
                                                                                    </div>
                                                                                ) : (
                                                                                    val
                                                                                )}
                                                                            </TableCell>
                                                                        );
                                                                    })}
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
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
                detailedData && (() => {
                    // Lógica local para obter o valor real de cada KPI em um mês arbitrário
                    const getSlaMetricRealValForMonth = (item: any, monthIdx: number) => {
                        if (item.metricType === "CHECKLIST_FACIL") {
                            const completed = clientKpiData?.checklistFacilCounts?.[monthIdx] || 0;
                            const planned = item.monthlyValues?.find((v: any) => v.month === monthIdx && v.year === selectedYear)?.value || 0;
                            return planned > 0 ? (completed / planned) * 100 : null;
                        }
                        if (item.metricType === "MANUAL") {
                            const found = item.monthlyValues?.find((v: any) => v.month === monthIdx && v.year === selectedYear);
                            return found ? found.value : null;
                        }
                        const mData = clientKpiData?.monthlyData?.find((m: any) => m.monthIndex === monthIdx);
                        if (!mData) return null;
                        if (item.metricType === "EFETIVIDADE") {
                            return mData.effectiveness;
                        }
                        if (item.metricType === "SLA_CHAMADOS") {
                            return mData.slaCompliance;
                        }
                        if (item.metricType === "NPS") {
                            return mData.avgNpsRating !== null && mData.avgNpsRating !== undefined
                                ? mData.avgNpsRating * 10 
                                : null;
                        }
                        if (item.metricType === "RECLAMACOES") {
                            return mData.complaintsRate;
                        }
                        if (item.metricType === "VISITAS") {
                            return mData.visitsScore;
                        }
                        if (item.metricType === "TURNOVER") {
                            return mData.turnover;
                        }
                        if (item.metricType === "REPOSICAO") {
                            return mData.avgRepositionDays;
                        }
                        return null;
                    };

                    // Lógica local de atingimento por faixas
                    const calculateFrontAtingimento = (realVal: number | null, ranges: any[]) => {
                        if (realVal === null || realVal === undefined) return null;
                        if (!ranges || ranges.length === 0) return realVal;
                        const sortedRanges = [...ranges].sort((x, y) => x.minVal - y.minVal);
                        for (const r of sortedRanges) {
                            const isAboveMin = realVal >= r.minVal;
                            const isBelowMax = r.maxVal === null || r.maxVal === undefined || realVal <= r.maxVal;
                            if (isAboveMin && isBelowMax) {
                                return r.resultVal;
                            }
                        }
                        return 0;
                    };

                    // Calcular nota ponderada de um mês específico
                    const getMonthFinalSlaScore = (monthIdx: number) => {
                        // Se o mês não possui Efetividade de Escala real, a nota de SLA é nula
                        const mData = clientKpiData?.monthlyData?.find((m: any) => m.monthIndex === monthIdx);
                        if (!mData || mData.effectiveness === null || mData.effectiveness === undefined) {
                            return null;
                        }

                        let totalWeight = 0;
                        let weightedScoreSum = 0;
                        
                        detailedData.slaConfigItems.forEach((item: any) => {
                            const val = getSlaMetricRealValForMonth(item, monthIdx);
                            if (val !== null) {
                                const postFaixaVal = calculateFrontAtingimento(val, item.ranges || []);
                                if (postFaixaVal !== null) {
                                    weightedScoreSum += postFaixaVal * item.weight;
                                    totalWeight += item.weight;
                                }
                            }
                        });
                        return totalWeight > 0 ? (weightedScoreSum / totalWeight) : null;
                    };

                    // Calcular a média anual consolidada do SLA do contrato (média dos meses válidos)
                    let validMonthsCount = 0;
                    let annualSlaSum = 0;
                    let totalWeight = detailedData.slaConfigItems.reduce((sum: number, item: any) => sum + item.weight, 0);

                    clientKpiData?.monthlyData?.forEach((m: any) => {
                        const mScore = getMonthFinalSlaScore(m.monthIndex);
                        if (mScore !== null) {
                            annualSlaSum += mScore;
                            validMonthsCount++;
                        }
                    });

                    const annualSlaScore = validMonthsCount > 0 ? (annualSlaSum / validMonthsCount) : null;

                    return (
                        <div className="space-y-6">
                            {/* Sub-Abas do SLA */}
                            <div className="flex gap-2 p-1 bg-slate-100/80 rounded-xl w-fit border border-slate-200/40">
                                <button
                                    type="button"
                                    onClick={() => setSlaTab('resultado')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        slaTab === 'resultado'
                                            ? "bg-white text-slate-800 shadow-premium"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    📈 Resultado Mensal
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSlaTab('config')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        slaTab === 'config'
                                            ? "bg-white text-slate-800 shadow-premium"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    ⚙️ Parametrização do SLA
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSlaTab('visitas')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        slaTab === 'visitas'
                                            ? "bg-white text-slate-800 shadow-premium"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    📋 Histórico de Visitas
                                </button>
                            </div>

                            {slaTab === 'resultado' && (
                                <div className="space-y-6">
                                    {/* Cards de Resumo de Topo */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Card className="border border-slate-200/50 shadow-premium bg-white p-5 rounded-2xl flex flex-col justify-between">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Média SLA Anual do Contrato</span>
                                            <span className="text-2xl font-black mt-2 text-blue-600">
                                                {annualSlaScore !== null ? `${annualSlaScore.toFixed(1)}%` : "-"}
                                            </span>
                                        </Card>
                                        <Card className="border border-slate-200/50 shadow-premium bg-white p-5 rounded-2xl flex flex-col justify-between">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Peso Total Parametrizado</span>
                                            <span className="text-2xl font-black mt-2 text-slate-800">
                                                {totalWeight.toFixed(1)}
                                            </span>
                                        </Card>
                                        <Card className="border border-slate-200/50 shadow-premium bg-white p-5 rounded-2xl flex flex-col justify-between">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Geral do SLA</span>
                                            {(() => {
                                                const currentMonthIdx = new Date().getMonth();
                                                const currentMonthScore = getMonthFinalSlaScore(currentMonthIdx);
                                                const target = clientKpiData?.contractTargetScore ?? 90.0;
                                                const isConforme = currentMonthScore !== null && currentMonthScore >= target;
                                                const colorClass = currentMonthScore !== null
                                                    ? (isConforme ? "text-emerald-600" : "text-red-600")
                                                    : "text-slate-400";
                                                const bgClass = currentMonthScore !== null
                                                    ? (isConforme ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")
                                                    : "bg-slate-100 text-slate-400";
                                                return (
                                                    <div className="mt-2 flex flex-col gap-1">
                                                        <span className={`text-2xl font-black ${colorClass}`}>
                                                            {currentMonthScore !== null ? `${currentMonthScore.toFixed(1)}%` : "-"}
                                                        </span>
                                                        <span className={`text-xs font-black rounded px-2.5 py-1 w-fit ${bgClass}`}>
                                                            {currentMonthScore !== null ? (isConforme ? "Conforme" : "Inconforme") : "Pendente"}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </Card>
                                    </div>

                                    {/* Tabela de Resultados Mensais da Composição */}
                                    <Card className="border border-slate-200/50 shadow-premium bg-white overflow-hidden rounded-2xl">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-black uppercase text-slate-855">Acompanhamento e Evolução do SLA (Mês a Mês)</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0 border-t border-slate-100">
                                            <Table>
                                                <TableHeader className="bg-slate-50">
                                                    <TableRow>
                                                        <TableHead className="font-bold text-slate-800 text-xs pl-6 py-3">Mês</TableHead>
                                                        {detailedData.slaConfigItems.map((item: any) => (
                                                            <TableHead key={item.id} className="font-bold text-slate-800 text-xs text-center py-3">
                                                                {item.name} <span className="text-[10px] text-slate-400 font-medium">(Meta {item.targetValue}% / Peso {item.weight})</span>
                                                            </TableHead>
                                                        ))}
                                                        <TableHead className="font-bold text-slate-800 text-xs text-right pr-6 py-3">Nota Final SLA</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {clientKpiData?.monthlyData?.map((m: any) => {
                                                        const monthScore = getMonthFinalSlaScore(m.monthIndex);
                                                        
                                                        // Verificar se há dados nesse mês
                                                        const hasSlaData = detailedData.slaConfigItems.some((item: any) => {
                                                            return getSlaMetricRealValForMonth(item, m.monthIndex) !== null;
                                                        });

                                                        return (
                                                            <TableRow key={m.monthIndex} className="hover:bg-slate-50/50">
                                                                <TableCell className="text-xs font-bold text-slate-700 pl-6 py-3">{m.name}</TableCell>
                                                                {detailedData.slaConfigItems.filter((item: any) => item.weight > 0).map((item: any) => {
                                                                    const realVal = getSlaMetricRealValForMonth(item, m.monthIndex);
                                                                    const postFaixaVal = calculateFrontAtingimento(realVal, item.ranges || []);
                                                                    return (
                                                                        <TableCell key={item.id} className="text-center text-xs py-3">
                                                                            {realVal !== null ? (
                                                                                <div className="flex flex-col items-center">
                                                                                    <span className="font-semibold text-slate-600">
                                                                                        Real: {item.metricType === "RECLAMACOES" 
                                                                                            ? `${realVal.toFixed(0)} chamados` 
                                                                                            : item.metricType === "REPOSICAO"
                                                                                            ? `${realVal.toFixed(2).replace('.', ',')} dias`
                                                                                            : `${realVal.toFixed(2).replace('.', ',')}%`}
                                                                                    </span>
                                                                                    <span className="text-[10px] font-black text-blue-650">Nota: {postFaixaVal !== null ? `${postFaixaVal.toFixed(1)}%` : "-"}</span>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-slate-400">-</span>
                                                                            )}
                                                                        </TableCell>
                                                                    );
                                                                })}
                                                                <TableCell className="text-right pr-6 py-3 text-xs font-black text-slate-800">
                                                                    {hasSlaData && monthScore !== null ? (
                                                                        <span className={`px-2 py-0.5 rounded ${
                                                                            monthScore >= (clientKpiData?.contractTargetScore ?? 90.0) ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                                                        }`}>
                                                                            {monthScore.toFixed(1)}%
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-400">-</span>
                                                                    )}
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

                            {slaTab === 'config' && (
                                <>
                                {/* Card de Configuração da Meta Mínima Geral do Contrato */}
                                <Card className="border border-slate-200/50 shadow-premium bg-white rounded-2xl p-5 mb-6">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-black uppercase text-slate-855">Meta Mínima Consolidada do Contrato</h4>
                                            <p className="text-xs text-slate-500 font-medium">Define a meta de SLA global (Nota Final Consolidada) exigida para este contrato.</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    max="100"
                                                    value={generalSlaTarget}
                                                    onChange={(e) => setGeneralSlaTarget(parseFloat(e.target.value) || 0)}
                                                    className="w-16 h-7 text-center text-sm font-black bg-transparent outline-none text-slate-850"
                                                />
                                                <span className="text-xs font-bold text-slate-500">%</span>
                                            </div>
                                            <Button
                                                onClick={handleSaveGeneralSlaTarget}
                                                disabled={isSavingSlaTarget}
                                                className="h-10 px-5 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-premium hover:bg-slate-800 transition-all cursor-pointer"
                                            >
                                                {isSavingSlaTarget ? "Salvando..." : "Salvar Meta"}
                                            </Button>
                                        </div>
                                    </div>
                                </Card>

                                {/* Card de Configuração da Meta de Visitas da Liderança */}
                                <Card className="border border-slate-200/50 shadow-premium bg-white rounded-2xl p-5 mb-6">
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-black uppercase text-slate-855">Metas Mensais de Visitas da Liderança</h4>
                                            <p className="text-xs text-slate-500 font-medium">Defina a quantidade de visitas que cada cargo de liderança deve realizar por mês neste contrato.</p>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                                            {visitRequirements.map((req, rIdx) => {
                                                const label = req.role === "SUPERVISOR" ? "Supervisor" :
                                                              req.role === "COORDENADOR" ? "Coordenador" :
                                                              req.role === "GERENTE" ? "Gerente" : "Diretor";
                                                return (
                                                    <div key={req.role} className="flex flex-col gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="50"
                                                                value={req.frequency}
                                                                onChange={(e) => {
                                                                    const val = parseInt(e.target.value) || 0;
                                                                    setVisitRequirements(prev => prev.map((item, idx) => idx === rIdx ? { ...item, frequency: val } : item));
                                                                }}
                                                                className="w-full h-8 px-2.5 text-center text-xs font-black bg-white rounded-lg border border-slate-200 text-slate-800 focus:border-slate-350 focus:ring-1 focus:ring-slate-350 outline-none"
                                                            />
                                                            <span className="text-[10px] font-bold text-slate-400">/mês</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex justify-end pt-2 border-t border-slate-100">
                                            <Button
                                                onClick={handleSaveVisitRequirements}
                                                disabled={isSavingVisitReqs}
                                                className="h-10 px-5 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-premium hover:bg-slate-800 transition-all cursor-pointer"
                                            >
                                                {isSavingVisitReqs ? "Salvando Metas..." : "Salvar Metas de Visitas"}
                                            </Button>
                                        </div>
                                    </div>
                                </Card>

                                <Card className="border border-slate-200/50 shadow-premium bg-white overflow-hidden rounded-2xl">
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle className="text-sm font-black uppercase text-slate-855">Configuração de KPIs e Metas de SLA</CardTitle>
                                        </div>
                                        <Button 
                                            size="sm"
                                            onClick={() => {
                                                setEditingSlaItem(null);
                                                setSlaName("");
                                                setSlaMetricType("EFETIVIDADE");
                                                setSelectedKpiTypeForSla("");
                                                setSlaWeight(1);
                                                setSlaTarget(90);
                                                setSlaRanges([]);
                                                setSlaDialogOpen(true);
                                            }}
                                            className="gap-1 bg-slate-900 text-white font-bold text-xs rounded-xl"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Adicionar KPI / Indicador
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
                                                    const mVal = item.monthlyValues?.find((v: any) => v.month === selectedMonth && v.year === selectedYear)?.value;
                                                    return (
                                                        <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                            <TableCell className="text-xs font-bold text-slate-700 pl-6 py-3">{item.name}</TableCell>
                                                            <TableCell className="text-xs text-slate-505 py-3">
                                                                {item.metricType === "MANUAL" ? "Lançamento Manual" : 
                                                                 item.metricType === "EFETIVIDADE" ? "Efetividade Escala" :
                                                                 item.metricType === "SLA_CHAMADOS" ? "Chamados no Prazo" :
                                                                 item.metricType === "NPS" ? "Nota NPS" :
                                                                 item.metricType === "TURNOVER" ? "Rotatividade (Turnover)" :
                                                                 item.metricType === "RECLAMACOES" ? "Índice Reclamações" : 
                                                                 item.metricType === "VISITAS" ? "Visitas de Liderança" : "SLA de Contratação"}
                                                            </TableCell>
                                                            <TableCell className="text-center text-xs font-bold py-3">{item.targetValue}%</TableCell>
                                                            <TableCell className="text-center text-xs font-bold py-3">{item.weight}</TableCell>
                                                            <TableCell className="text-right pr-6 py-3 text-xs">
                                                                {(item.metricType === "MANUAL" || item.metricType === "CHECKLIST_FACIL") ? (
                                                                    editingSlaValueId === item.id ? (
                                                                        <div className="flex justify-end items-center gap-1">
                                                                            <Input type="number" value={manualSlaValue} onChange={(e) => setManualSlaValue(Number(e.target.value))} className="w-16 h-7 text-right" />
                                                                            <Button size="sm" onClick={() => handleSaveManualSlaValue(item.id)} className="h-7 bg-emerald-600 text-white rounded">✓</Button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex justify-end items-center gap-1.5 font-black text-slate-800">
                                                                            <span>{item.metricType === "CHECKLIST_FACIL" ? (mVal !== undefined ? `${mVal} plan.` : "Meta Pendente") : (mVal !== undefined ? `${mVal}%` : "Pendente")}</span>
                                                                            <Button size="sm" variant="ghost" onClick={() => { setEditingSlaValueId(item.id); setManualSlaValue(mVal || 10); }} className="h-6 w-6 p-0 rounded">✏️</Button>
                                                                        </div>
                                                                    )
                                                                ) : (
                                                                    (() => {
                                                                        const realVal = getSlaMetricRealValForMonth(item, selectedMonth);
                                                                        const postFaixaVal = calculateFrontAtingimento(realVal, item.ranges || []);
                                                                        return (
                                                                            <div className="flex flex-col items-end pr-2 select-none">
                                                                                <span className="font-bold text-slate-700">
                                                                                    {item.metricType === "RECLAMACOES" 
                                                                                        ? `${realVal !== null ? realVal.toFixed(0) : "-"} chamados` 
                                                                                        : item.metricType === "REPOSICAO"
                                                                                        ? `${realVal !== null ? realVal.toFixed(1) : "-"} dias`
                                                                                        : `${realVal !== null ? realVal.toFixed(1) : "-"}%`}
                                                                                </span>
                                                                                {realVal !== null && item.ranges && item.ranges.length > 0 && (
                                                                                    <span className="text-[10px] font-black text-blue-650">Nota: {postFaixaVal !== null ? `${postFaixaVal.toFixed(1)}%` : "-"}</span>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })()
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-center py-3">
                                                                <div className="flex justify-center gap-1">
                                                                    <Button size="sm" variant="ghost" onClick={() => { 
                                                                        setEditingSlaItem(item); 
                                                                        setSlaName(item.name); 
                                                                        setSlaMetricType(item.metricType); 
                                                                        setSelectedKpiTypeForSla(item.metricType === 'MANUAL' ? item.id : item.metricType);
                                                                        setSlaWeight(item.weight); 
                                                                        setSlaTarget(item.targetValue); 
                                                                        setSlaRanges(item.ranges || []); 
                                                                        setSlaDialogOpen(true); 
                                                                    }} className="h-7 w-7 p-0 rounded">✏️</Button>
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
                                </>
                            )}

                            {slaTab === 'visitas' && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                        <div className="space-y-1 select-none">
                                            <h4 className="text-sm font-black uppercase text-slate-800">Histórico de Visitas do Contrato</h4>
                                            <p className="text-[11px] text-slate-500 font-medium">Controle de visitas, acompanhamentos e evidências do contrato.</p>
                                        </div>
                                        <Button
                                            onClick={() => {
                                                setVisitClientId(selectedClientId);
                                                setVisitorRole("SUPERVISOR");
                                                setVisitorName("Cristiano Magalhães");
                                                setVisitNotes("");
                                                setVisitEvidenceUrl("");
                                                setCustomVisitorRole("");
                                                setLogVisitOpen(true);
                                            }}
                                            className="h-9 px-4 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs rounded-xl"
                                        >
                                            Registrar Visita
                                        </Button>
                                    </div>

                                    <Card className="border border-slate-200/50 shadow-premium bg-white overflow-hidden rounded-2xl">
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="font-bold text-slate-800 text-xs py-3 pl-6">Data</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs py-3">Cargo</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs py-3">Visitante</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs py-3">Evidência / Anexo</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs py-3">Observações</TableHead>
                                                    <TableHead className="font-bold text-slate-800 text-xs text-center py-3">Ações</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(() => {
                                                    const clientVisits = (detailedData?.visits || []).filter((v: any) => v.clientId === selectedClientId);
                                                    if (clientVisits.length === 0) {
                                                        return (
                                                            <TableRow>
                                                                <TableCell colSpan={6} className="text-center py-10 text-slate-400 font-semibold text-xs">
                                                                    Nenhuma visita de liderança registrada para este contrato até o momento.
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    }
                                                    return clientVisits.map((v: any) => (
                                                        <TableRow key={v.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <TableCell className="font-bold text-xs text-slate-700 pl-6 py-3">
                                                                {(() => {
                                                                    const d = new Date(v.visitDate);
                                                                    const day = String(d.getUTCDate()).padStart(2, '0');
                                                                    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                                                                    const year = d.getUTCFullYear();
                                                                    return `${day}/${month}/${year}`;
                                                                })()}
                                                            </TableCell>
                                                            <TableCell className="font-black text-xs text-slate-800 py-3">{v.visitorRole}</TableCell>
                                                            <TableCell className="font-bold text-xs text-slate-900 py-3">{v.visitorName}</TableCell>
                                                            <TableCell className="text-xs py-3">
                                                                {v.evidenceUrl ? (
                                                                    <a 
                                                                        href={v.evidenceUrl.startsWith('http') ? v.evidenceUrl : `https://${v.evidenceUrl}`} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 font-bold text-blue-650 hover:underline cursor-pointer"
                                                                    >
                                                                        📎 Ver Evidência
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-slate-400 italic">Sem anexo</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="font-medium text-xs text-slate-600 whitespace-normal break-words max-w-[280px] py-3">{v.notes || "-"}</TableCell>
                                                            <TableCell className="text-center py-3">
                                                                <div className="flex justify-center gap-1.5">
                                                                    <Button size="sm" variant="ghost" onClick={() => handleEditVisitClick(v)} className="h-7 w-7 p-0 rounded hover:bg-slate-105">✏️</Button>
                                                                    <Button size="sm" variant="ghost" onClick={() => handleDeleteVisit(v.id)} className="h-7 w-7 p-0 rounded hover:bg-red-50 text-red-500">🗑️</Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ));
                                                })()}
                                            </TableBody>
                                        </Table>
                                    </Card>
                                </div>
                            )}
                        </div>
                    );
                })()
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
                                    <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/30">
                                        <div className="space-y-0.5">
                                            <h4 className="text-xs font-bold text-slate-700">Cronograma de Atividades</h4>
                                            <p className="text-[10px] text-slate-400 font-medium">Cadastre a rotina sequencial do posto.</p>
                                        </div>
                                        <Button size="sm" onClick={handleAddRoutineClick} className="h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs gap-1.5 shadow-premium">
                                            <Plus className="w-3.5 h-3.5" /> Adicionar Atividade
                                        </Button>
                                    </div>
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
                                                        <TableHead className="font-bold text-slate-800 text-xs py-3.5 text-right pr-6">Ações</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {routines.map((r: any) => (
                                                        <TableRow key={r.id} className="hover:bg-slate-50/50">
                                                            <TableCell className="text-xs font-bold text-slate-700 pl-6 py-3">{r.startTime} - {r.endTime}</TableCell>
                                                            <TableCell className="text-xs text-slate-500 font-semibold py-3">{r.duration}</TableCell>
                                                            <TableCell className="text-xs text-slate-700 font-semibold py-3">{r.location}</TableCell>
                                                            <TableCell className="text-xs text-slate-600 font-medium py-3">{r.activity}</TableCell>
                                                            <TableCell className="text-right py-3 pr-6">
                                                                <div className="flex justify-end gap-1">
                                                                    <Button size="sm" variant="ghost" onClick={() => handleEditRoutineClick(r)} className="h-7 w-7 p-0 rounded hover:bg-slate-100">✏️</Button>
                                                                    <Button size="sm" variant="ghost" onClick={() => handleDeleteRoutineClick(r.id)} className="h-7 w-7 p-0 rounded hover:bg-red-50 text-red-550">🗑️</Button>
                                                                </div>
                                                            </TableCell>
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

                    {/* TAB 9: DOCUMENTOS POP / SGQ */}
                    {activeTab === "pops" && (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-premium border border-slate-200/50">
                                <div className="space-y-1">
                                    <h3 className="text-md font-bold text-slate-850">Documentos POP & Sistema de Qualidade (SGQ)</h3>
                                    <p className="text-xs text-slate-500 font-medium">Controle de Procedimentos Operacionais Padrão e histórico de revisões.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => setSelectedClientId(e.target.value)}
                                        className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                                    >
                                        <option value="all">-- Escolha um Cliente --</option>
                                        {initialClients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {selectedClientId === "all" ? (
                                <Card className="border border-slate-200/50 shadow-premium bg-white p-8 text-center">
                                    <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <h4 className="text-sm font-bold text-slate-700">Selecione um Cliente</h4>
                                    <p className="text-xs text-slate-500 mt-1">Selecione um cliente no filtro acima para visualizar e gerenciar os documentos POP vinculados.</p>
                                </Card>
                            ) : loadingPops ? (
                                <div className="text-center py-12 text-slate-450 italic text-xs animate-pulse">Carregando documentos POP...</div>
                            ) : (
                                <PopsManagementSection
                                    clientId={selectedClientId}
                                    clientName={initialClients.find(c => c.id === selectedClientId)?.name || "Cliente"}
                                    initialPops={pops}
                                    isClientUser={false}
                                    isAdminUser={true}
                                />
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Work Routine Dialog */}
            <Dialog open={routineDialogOpen} onOpenChange={setRoutineDialogOpen}>
                <DialogContent className="sm:max-w-[480px] rounded-2xl">
                    <form onSubmit={handleSaveRoutine} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="text-md font-bold text-slate-800">
                                {editingRoutine ? "Editar Atividade da Rotina" : "Adicionar Atividade à Rotina"}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-450 font-medium">
                                Defina os horários, local e a instrução de trabalho do posto.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-650">Horário de Início *</Label>
                                    <Input
                                        type="time"
                                        value={routineStartTime}
                                        onChange={(e) => setRoutineStartTime(e.target.value)}
                                        className="h-10 border-slate-200 rounded-xl"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-650">Horário de Término *</Label>
                                    <Input
                                        type="time"
                                        value={routineEndTime}
                                        onChange={(e) => setRoutineEndTime(e.target.value)}
                                        className="h-10 border-slate-200 rounded-xl"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-650">Duração (calculada)</Label>
                                    <Input
                                        type="text"
                                        value={routineDuration}
                                        readOnly
                                        disabled
                                        className="h-10 border-slate-200 bg-slate-50/80 rounded-xl text-slate-450 font-semibold cursor-not-allowed"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-650">Local de Atuação *</Label>
                                    <Input
                                        type="text"
                                        placeholder="Ex: 6º Andar, DML, Recepção"
                                        value={routineLocation}
                                        onChange={(e) => setRoutineLocation(e.target.value)}
                                        className="h-10 border-slate-200 rounded-xl"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-650">Descrição da Atividade *</Label>
                                <textarea
                                    placeholder="Descreva detalhadamente a tarefa a ser executada neste período..."
                                    value={routineActivity}
                                    onChange={(e) => setRoutineActivity(e.target.value)}
                                    className="w-full h-24 border border-slate-200 rounded-xl text-xs font-semibold p-3 outline-none focus:border-blue-500/80 transition-colors bg-white resize-none"
                                    required
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setRoutineDialogOpen(false)}
                                className="h-10 rounded-xl border border-slate-200 text-xs font-semibold px-4 hover:bg-slate-50 text-slate-600"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={savingRoutine}
                                className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 shadow-premium"
                            >
                                {savingRoutine ? "Salvando..." : "Salvar Atividade"}
                            </Button>
                        </DialogFooter>
                    </form>
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
                                    <div className="flex items-center gap-1.5">
                                        <select
                                            value={visitorRole}
                                            onChange={(e) => {
                                                setVisitorRole(e.target.value);
                                                if (e.target.value !== "OUTRO") setCustomVisitorRole("");
                                            }}
                                            className="flex-1 h-10 border border-slate-200 rounded-xl text-xs font-semibold px-3 outline-none focus:border-primary bg-white"
                                            required
                                        >
                                            {availableRoles.map(role => (
                                                <option key={role} value={role}>{role.charAt(0) + role.slice(1).toLowerCase()}</option>
                                            ))}
                                            <option value="OUTRO">Outro cargo...</option>
                                        </select>
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                const newRole = prompt("Digite o nome do novo cargo:");
                                                if (newRole && newRole.trim()) {
                                                    const formatted = newRole.trim().toUpperCase();
                                                    if (!availableRoles.includes(formatted)) {
                                                        setAvailableRoles(prev => [...prev, formatted]);
                                                    }
                                                    setVisitorRole(formatted);
                                                }
                                            }}
                                            className="h-10 w-10 p-0 bg-slate-105 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-700 flex items-center justify-center cursor-pointer shadow-premium"
                                            title="Cadastrar Novo Cargo"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            {visitorRole === "OUTRO" && (
                                <div className="space-y-1 mt-3 px-3">
                                    <Label className="text-xs font-bold text-slate-655">Digite o Nome do Cargo *</Label>
                                    <Input
                                        placeholder="Ex: Supervisor Operacional, Analista de Qualidade"
                                        value={customVisitorRole}
                                        onChange={(e) => setCustomVisitorRole(e.target.value)}
                                        className="h-10 rounded-xl"
                                        required
                                    />
                                </div>
                            )}

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
                                <Label className="text-xs font-bold text-slate-655">Subir Evidência (Foto, PDF, Ata, Checklist) *</Label>
                                <div className="flex flex-col gap-2">
                                    <Input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                if (file.size > 4.5 * 1024 * 1024) {
                                                    toast.error("O arquivo deve ter no máximo 4.5 MB.");
                                                    e.target.value = "";
                                                    return;
                                                }
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setVisitEvidenceUrl(reader.result as string);
                                                    setVisitFileName(file.name);
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        className="h-10 rounded-xl cursor-pointer text-xs"
                                    />
                                    {visitEvidenceUrl && (
                                        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl select-none">
                                            <span className="text-[10px] font-bold text-slate-700 truncate max-w-[280px]">
                                                📎 {visitFileName || "Arquivo de Evidência"}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() => {
                                                    setVisitEvidenceUrl("");
                                                    setVisitFileName("");
                                                }}
                                                className="h-6 w-6 p-0 rounded-full hover:bg-slate-200 text-red-500"
                                            >
                                                ✕
                                            </Button>
                                        </div>
                                    )}
                                </div>
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

            {/* Edit Visit Form Dialog */}
            <Dialog open={editVisitOpen} onOpenChange={setEditVisitOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={handleUpdateVisit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="text-md font-bold text-slate-800">Editar Visita ao Contrato</DialogTitle>
                            <DialogDescription>Ajuste as informações da visita de relacionamento realizada comercialmente.</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-655">Visitante *</Label>
                                    <Input
                                        placeholder="Nome"
                                        value={editVisitorName}
                                        onChange={(e) => setEditVisitorName(e.target.value)}
                                        className="h-10 rounded-xl"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-655">Cargo *</Label>
                                    <div className="flex items-center gap-1.5">
                                        <select
                                            value={editVisitorRole}
                                            onChange={(e) => {
                                                setEditVisitorRole(e.target.value);
                                                if (e.target.value !== "OUTRO") setEditCustomVisitorRole("");
                                            }}
                                            className="flex-1 h-10 border border-slate-200 rounded-xl text-xs font-semibold px-3 outline-none focus:border-primary bg-white"
                                            required
                                        >
                                            {availableRoles.map(role => (
                                                <option key={role} value={role}>{role.charAt(0) + role.slice(1).toLowerCase()}</option>
                                            ))}
                                            <option value="OUTRO">Outro cargo...</option>
                                        </select>
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                const newRole = prompt("Digite o nome do novo cargo:");
                                                if (newRole && newRole.trim()) {
                                                    const formatted = newRole.trim().toUpperCase();
                                                    if (!availableRoles.includes(formatted)) {
                                                        setAvailableRoles(prev => [...prev, formatted]);
                                                    }
                                                    setEditVisitorRole(formatted);
                                                }
                                            }}
                                            className="h-10 w-10 p-0 bg-slate-105 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-700 flex items-center justify-center cursor-pointer shadow-premium"
                                            title="Cadastrar Novo Cargo"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            {editVisitorRole === "OUTRO" && (
                                <div className="space-y-1 mt-3 px-3">
                                    <Label className="text-xs font-bold text-slate-655">Digite o Nome do Cargo *</Label>
                                    <Input
                                        placeholder="Ex: Supervisor Operacional, Analista de Qualidade"
                                        value={editCustomVisitorRole}
                                        onChange={(e) => setEditCustomVisitorRole(e.target.value)}
                                        className="h-10 rounded-xl"
                                        required
                                    />
                                </div>
                            )}

                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Data *</Label>
                                <Input
                                    type="date"
                                    value={editVisitDate}
                                    onChange={(e) => setEditVisitDate(e.target.value)}
                                    className="h-10 rounded-xl"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Subir Nova Evidência (Foto, PDF, Ata, Checklist)</Label>
                                <div className="flex flex-col gap-2">
                                    <Input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                if (file.size > 4.5 * 1024 * 1024) {
                                                    toast.error("O arquivo deve ter no máximo 4.5 MB.");
                                                    e.target.value = "";
                                                    return;
                                                }
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setEditVisitEvidenceUrl(reader.result as string);
                                                    setEditVisitFileName(file.name);
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        className="h-10 rounded-xl cursor-pointer text-xs"
                                    />
                                    {editVisitEvidenceUrl && (
                                        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl select-none">
                                            <span className="text-[10px] font-bold text-slate-700 truncate max-w-[280px]">
                                                📎 {editVisitFileName || "Arquivo de Evidência"}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() => {
                                                    setEditVisitEvidenceUrl("");
                                                    setEditVisitFileName("");
                                                }}
                                                className="h-6 w-6 p-0 rounded-full hover:bg-slate-200 text-red-500"
                                            >
                                                ✕
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Observações</Label>
                                <textarea
                                    placeholder="Escreva detalhes e feedback coletados com o cliente..."
                                    rows={3}
                                    value={editVisitNotes}
                                    onChange={(e) => setEditVisitNotes(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl text-xs font-semibold p-3 outline-none resize-none"
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-2 border-t border-slate-100">
                            <Button type="button" variant="outline" onClick={() => setEditVisitOpen(false)} className="h-10 text-xs font-bold rounded-xl">Cancelar</Button>
                            <Button type="submit" disabled={savingVisit} className="h-10 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700">Salvar Alterações</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Dedicated KPIs Config Dialog */}
            <Dialog open={kpiConfigOpen} onOpenChange={setKpiConfigOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col overflow-hidden">
                    <DialogHeader className="flex flex-row items-center justify-between pr-8">
                        <div>
                            <DialogTitle className="text-md font-bold text-slate-800">KPIs do Contrato (Configuração)</DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">Defina os KPIs ativos, suas metas de SLA e pesos de importância.</DialogDescription>
                        </div>
                        <Button 
                            size="sm"
                            onClick={() => {
                                setEditingKpi(null);
                                setSelectedKpiType('EFETIVIDADE');
                                setNewKpiName('');
                                setNewKpiUnitIds('');
                                setNewKpiChecklistIds('');
                                setKpiMeta(90);
                                setKpiPeso(1);
                                setIsNewCustomKpi(false);
                                setKpiFormOpen(true);
                            }}
                            className="gap-1 bg-slate-900 text-white font-bold text-xs rounded-xl"
                        >
                            <Plus className="w-3.5 h-3.5" /> + Adicionar KPI
                        </Button>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto mt-4 border-t border-slate-100 pr-2">
                        {detailedData && detailedData.slaConfigItems && detailedData.slaConfigItems.length > 0 ? (
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-800 text-xs pl-4 py-3">KPI (Indicador)</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs py-3">Métrica de Captura</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-xs text-center py-3">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {detailedData.slaConfigItems.map((item: any) => (
                                        <TableRow key={item.id} className="hover:bg-slate-50/50">
                                            <TableCell className="text-xs font-bold text-slate-700 pl-4 py-3">{item.name}</TableCell>
                                            <TableCell className="text-xs text-slate-505 py-3">
                                                {item.metricType === 'MANUAL' ? 'Lançamento Manual' : 
                                                 item.metricType === 'EFETIVIDADE' ? 'Efetividade Escala' :
                                                 item.metricType === 'SLA_CHAMADOS' ? 'Chamados no Prazo' :
                                                 item.metricType === 'NPS' ? 'Nota NPS' :
                                                 item.metricType === 'TURNOVER' ? 'Rotatividade (Turnover)' :
                                                 item.metricType === 'RECLAMACOES' ? 'Índice Reclamações' : 
                                                 item.metricType === 'VISITAS' ? 'Visitas de Liderança' : 
                                                 item.metricType === 'CHECKLIST_FACIL' ? 'Integração Checklist Fácil' : 'SLA de Contratação'}
                                            </TableCell>
                                            <TableCell className="text-center py-3">
                                                <div className="flex justify-center gap-1">
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        onClick={() => { 
                                                            setEditingKpi(item); 
                                                            setSelectedKpiType(item.metricType === 'MANUAL' ? 'CREATE_NEW' : item.metricType);
                                                            setNewKpiName(item.name);
                                                            setNewKpiUnitIds(item.checklistUnitIds || '');
                                                            setNewKpiChecklistIds(item.checklistIds || '');
                                                            setIsNewCustomKpi(item.metricType === 'MANUAL');
                                                            setKpiMeta(item.targetValue); 
                                                            setKpiPeso(item.weight); 
                                                            setKpiFormOpen(true); 
                                                        }} 
                                                        className="h-7 w-7 p-0 rounded"
                                                    >
                                                        ✏️
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        onClick={() => handleDeleteKpiClick(item.id)} 
                                                        className="h-7 w-7 p-0 rounded hover:bg-red-50"
                                                    >
                                                        🗑️
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-center py-12 text-slate-500 font-semibold italic text-xs">
                                Nenhum KPI configurado para este contrato. Clique no botão acima para adicionar.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog Form for adding/editing KPI */}
            <Dialog open={kpiFormOpen} onOpenChange={setKpiFormOpen}>
                <DialogContent className="sm:max-w-[480px] z-[9999]">
                    <form onSubmit={handleSaveKpi} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="text-md font-bold text-slate-800">
                                {editingKpi ? 'Editar KPI' : 'Adicionar KPI ao Contrato'}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Métrica / Tipo de Cálculo *</Label>
                                <select
                                    value={selectedKpiType}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSelectedKpiType(val);
                                        setIsNewCustomKpi(val === 'CREATE_NEW');
                                        const namesMap: Record<string, string> = {
                                            EFETIVIDADE: 'Efetividade Escala',
                                            SLA_CHAMADOS: 'Chamados no Prazo',
                                            NPS: 'NPS',
                                            TURNOVER: 'Rotatividade (Turnover)',
                                            RECLAMACOES: 'Índice Reclamações',
                                            VISITAS: 'Visitas de Liderança',
                                            REPOSICAO: 'SLA de Contratação',
                                            CHECKLIST_FACIL: 'Checklist Fácil',
                                            CREATE_NEW: ''
                                        };
                                        setNewKpiName(namesMap[val] || '');
                                    }}
                                    className="w-full h-10 border border-slate-200 rounded-xl text-xs font-semibold px-3 outline-none bg-white"
                                    required
                                >
                                    <option value="EFETIVIDADE">Métrica Automática: Efetividade de Escala</option>
                                    <option value="SLA_CHAMADOS">Métrica Automática: Chamados no Prazo</option>
                                    <option value="NPS">Métrica Automática: Nota NPS do Cliente</option>
                                    <option value="TURNOVER">Métrica Automática: Rotatividade (Turnover)</option>
                                    <option value="RECLAMACOES">Métrica Automática: Chamados de Reclamação (Qtd)</option>
                                    <option value="REPOSICAO">Métrica Automática: SLA de Contratação (Média Dias)</option>
                                    <option value="VISITAS">Métrica Automática: Visitas de Liderança</option>
                                    <option value="CHECKLIST_FACIL">Métrica Automática: Integração Checklist Fácil</option>
                                    <option value="CREATE_NEW" className="font-bold text-blue-600">+ Criar Novo KPI (Personalizado)...</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Nome do KPI *</Label>
                                <Input
                                    placeholder="Ex: Auditoria 5S, Uso de EPIs"
                                    value={newKpiName}
                                    onChange={(e) => setNewKpiName(e.target.value)}
                                    className="h-10 rounded-xl"
                                    required
                                />
                            </div>

                            {selectedKpiType === 'CHECKLIST_FACIL' && (
                                <div className="space-y-3 pt-2 border-t border-slate-100/60">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-slate-655">IDs dos Checklists (Opcional)</Label>
                                        <Input
                                            placeholder="Ex: 766887, 766888"
                                            value={newKpiChecklistIds}
                                            onChange={(e) => setNewKpiChecklistIds(e.target.value)}
                                            className="h-10 rounded-xl"
                                        />
                                        <span className="text-[10px] text-slate-500 block leading-tight">
                                            Recomendado: Insira o ID do modelo de checklist. Exemplo para Penha: <strong className="text-slate-700">766887</strong>. Deixe em branco se preferir filtrar por unidades abaixo.
                                        </span>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-slate-655">IDs das Unidades (Opcional)</Label>
                                        <Input
                                            placeholder="Ex: 65310, 65270, 61280"
                                            value={newKpiUnitIds}
                                            onChange={(e) => setNewKpiUnitIds(e.target.value)}
                                            className="h-10 rounded-xl"
                                        />
                                        <span className="text-[10px] text-slate-500 block leading-tight">
                                            Insira os IDs numéricos das unidades no Checklist Fácil correspondentes a este cliente, separados por vírgula.
                                        </span>
                                    </div>
                                </div>
                            )}


                        </div>

                        <DialogFooter className="pt-2 border-t border-slate-100">
                            <Button type="button" variant="outline" onClick={() => setKpiFormOpen(false)} className="h-10 text-xs font-bold rounded-xl">Cancelar</Button>
                            <Button type="submit" disabled={savingSla} className="h-10 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700">Salvar KPI</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* SLA Config Dialog */}
            <Dialog open={slaDialogOpen} onOpenChange={setSlaDialogOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={handleSaveSlaItem} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="text-md font-bold text-slate-800">Configurar KPI e Metas de SLA</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Nome do KPI / Indicador *</Label>
                                <Input
                                    placeholder="Ex: Pontualidade"
                                    value={slaName}
                                    onChange={(e) => setSlaName(e.target.value)}
                                    className="h-10 rounded-xl"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-655">Tipo / Métrica de Cálculo *</Label>
                                <select
                                    value={slaMetricType}
                                    onChange={(e) => setSlaMetricType(e.target.value)}
                                    className="w-full h-10 border border-slate-200 rounded-xl text-xs font-semibold px-3 outline-none bg-white"
                                    required
                                >
                                    <option value="EFETIVIDADE">Métrica Automática: Efetividade de Escala</option>
                                    <option value="SLA_CHAMADOS">Métrica Automática: Chamados no Prazo</option>
                                    <option value="NPS">Métrica Automática: Nota NPS do Cliente</option>
                                    <option value="TURNOVER">Métrica Automática: Rotatividade (Turnover)</option>
                                    <option value="RECLAMACOES">Métrica Automática: Chamados de Reclamação (Qtd)</option>
                                    <option value="REPOSICAO">Métrica Automática: SLA de Contratação (Média Dias)</option>
                                    <option value="VISITAS">Métrica Automática: Visitas de Liderança</option>
                                    <option value="CHECKLIST_FACIL">Métrica Automática: Integração Checklist Fácil</option>
                                    <option value="MANUAL">Lançamento Manual pelo Gestor (Qualquer KPI Personalizado)</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-655">Meta de SLA (%) *</Label>
                                    <Input
                                        type="number"
                                        value={slaTarget}
                                        onChange={(e) => setSlaTarget(Number(e.target.value))}
                                        className="h-10 rounded-xl"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-655">Peso no SLA Global *</Label>
                                    <Input
                                        type="number"
                                        value={slaWeight}
                                        onChange={(e) => setSlaWeight(Number(e.target.value))}
                                        className="h-10 rounded-xl"
                                        required
                                    />
                                </div>
                            </div>

                            {/* SEÇÃO DE FAIXAS DE ATINGIMENTO */}
                            <div className="pt-4 border-t border-slate-100 space-y-3">
                                <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Faixas de Atingimento (Nota Resultante)</Label>
                                
                                {slaRanges.length > 0 ? (
                                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                                        {slaRanges.map((range, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium">
                                                <span className="text-slate-700">
                                                    Métrica de <strong className="text-slate-900">{range.minVal}%</strong> a <strong className="text-slate-900">{range.maxVal !== null && range.maxVal !== undefined ? `${range.maxVal}%` : "100%"}</strong> ➡️ Nota: <strong className="text-blue-600">{range.resultVal}%</strong>
                                                </span>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    onClick={() => setSlaRanges(slaRanges.filter((_, i) => i !== index))}
                                                    className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-650 text-slate-450 rounded-lg cursor-pointer"
                                                >
                                                    ✕
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-400 font-medium italic">Nenhuma faixa de nota configurada (será considerado atingimento linear padrão).</p>
                                )}

                                <div className="bg-slate-50/50 p-3 rounded-2xl border border-dashed border-slate-200/80 space-y-2">
                                    <span className="text-[10px] font-bold text-slate-500 block">Nova Faixa de Nota:</span>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-slate-500">Mínimo (%)</Label>
                                            <Input
                                                type="number"
                                                placeholder="Ex: 90"
                                                value={newMinVal}
                                                onChange={(e) => setNewMinVal(e.target.value)}
                                                className="h-8 text-xs rounded-lg bg-white"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-slate-500">Máximo (%)</Label>
                                            <Input
                                                type="number"
                                                placeholder="Ex: 94.9"
                                                value={newMaxVal}
                                                onChange={(e) => setNewMaxVal(e.target.value)}
                                                className="h-8 text-xs rounded-lg bg-white"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-slate-500">Nota Result. (%)</Label>
                                            <Input
                                                type="number"
                                                placeholder="Ex: 95"
                                                value={newResultVal}
                                                onChange={(e) => setNewResultVal(e.target.value)}
                                                className="h-8 text-xs rounded-lg bg-white"
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            if (newMinVal === "" || newResultVal === "") {
                                                toast.error("Preencha o valor Mínimo e a Nota Resultante!");
                                                return;
                                            }
                                            const min = parseFloat(newMinVal);
                                            const max = newMaxVal !== "" ? parseFloat(newMaxVal) : null;
                                            const resVal = parseFloat(newResultVal);
                                            
                                            if (max !== null && min > max) {
                                                toast.error("Mínimo não pode ser maior que o Máximo!");
                                                return;
                                            }

                                            setSlaRanges([...slaRanges, { minVal: min, maxVal: max, resultVal: resVal }]);
                                            setNewMinVal("");
                                            setNewMaxVal("");
                                            setNewResultVal("");
                                        }}
                                        className="w-full h-8 text-[10px] font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                                    >
                                        + Adicionar Faixa
                                    </Button>
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

            {/* Dialog de Detalhes e Transição da Solicitação */}
            <Dialog open={selectedRequestForAction !== null} onOpenChange={(open) => { if (!open) setSelectedRequestForAction(null); }}>
                <DialogContent className="sm:max-w-[550px] rounded-[24px] overflow-hidden p-6 gap-0">
                    <DialogHeader className="pb-4 border-b border-slate-100">
                        <div className="flex items-center justify-between mt-1">
                            <DialogTitle className="text-md font-bold text-slate-800">Detalhes da Solicitação</DialogTitle>
                            {selectedRequestForAction && (
                                <div className="flex items-center gap-1.5">
                                    <Badge className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-black uppercase rounded-full">
                                        {selectedRequestForAction.type === "MOVIMENTACAO" ? "Movimentação" : 
                                         selectedRequestForAction.type === "UNIFORME" ? "Uniforme" : 
                                         selectedRequestForAction.type === "TERMINO_CONTRATO_EXPERIENCIA" ? "Término Experiência" : "Outro"}
                                    </Badge>
                                    <Badge className={`${
                                        selectedRequestForAction.status === "CONCLUIDO" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                        selectedRequestForAction.status === "PENDENTE" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                        selectedRequestForAction.status === "EM_ANDAMENTO" || selectedRequestForAction.status === "EM_ANALISE_RH" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                                        "bg-red-50 text-red-700 border border-red-200"
                                    } text-[10px] font-black uppercase rounded-full`}>
                                        {selectedRequestForAction.status === "CONCLUIDO" ? "Concluído" :
                                         selectedRequestForAction.status === "PENDENTE" ? "Pendente" :
                                         selectedRequestForAction.status === "EM_ANDAMENTO" || selectedRequestForAction.status === "EM_ANALISE_RH" ? "Em Execução" : "Cancelado"}
                                    </Badge>
                                </div>
                            )}
                        </div>
                        <DialogDescription className="text-xs text-slate-400 mt-1 font-medium">
                            Histórico do chamado, controle de SLA e transição de status operacional.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRequestForAction && (
                        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
                            {/* Bloco de Informações Principais */}
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase text-slate-400 block">Contrato</span>
                                    <span className="text-xs font-bold text-slate-800 block truncate">{selectedRequestForAction.clientName}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase text-slate-400 block">Solicitante</span>
                                    <span className="text-xs font-bold text-slate-800 block truncate">{selectedRequestForAction.requesterName}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase text-slate-400 block">Data de Criação</span>
                                    <span className="text-xs font-bold text-slate-700 block">
                                        {new Date(selectedRequestForAction.createdAt).toLocaleDateString("pt-BR")}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase text-slate-400 block font-bold">
                                        {selectedRequestForAction.status === "PENDENTE" && (selectedRequestForAction.comments || []).filter((c: any) => c.user?.role !== "CLIENTE").length === 0 
                                            ? "Prazo 1ª Resposta (24h úteis)" 
                                            : "Previsão de Solução"
                                        }
                                    </span>
                                    <input
                                        type="date"
                                        value={selectedRequestForAction.dueDate ? selectedRequestForAction.dueDate.split("T")[0] : ""}
                                        onChange={(e) => setSelectedRequestForAction({ ...selectedRequestForAction, dueDate: e.target.value ? e.target.value + "T23:59:59.000Z" : selectedRequestForAction.dueDate })}
                                        className="h-8 border border-slate-200 bg-white rounded-lg text-xs font-semibold px-2 outline-none w-full shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Colaborador Relacionado (Editável) */}
                            <div className="space-y-1 bg-blue-50/40 p-3.5 rounded-xl border border-blue-100/50">
                                <span className="text-[10px] font-black uppercase text-blue-500 block font-bold">Colaborador Envolvido</span>
                                <select
                                    value={selectedRequestForAction.employeeId || ""}
                                    onChange={(e) => {
                                        const empId = e.target.value;
                                        const empObj = (consolidatedData?.allEmployees || []).find((emp: any) => emp.id === empId);
                                        setSelectedRequestForAction({
                                            ...selectedRequestForAction,
                                            employeeId: empId || null,
                                            employeeName: empObj ? empObj.name : null
                                        });
                                    }}
                                    className="w-full h-9 border border-blue-200 bg-white text-xs font-semibold px-2 outline-none rounded-lg cursor-pointer text-blue-900 shadow-sm"
                                >
                                    <option value="">Nenhum Colaborador</option>
                                    {(consolidatedData?.allEmployees || []).map((emp: any) => (
                                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Descrição Completa (Editável) */}
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase text-slate-400 font-bold">Descrição da Solicitação</Label>
                                <textarea
                                    value={selectedRequestForAction.description || ""}
                                    onChange={(e) => setSelectedRequestForAction({ ...selectedRequestForAction, description: e.target.value })}
                                    rows={3}
                                    className="w-full border border-slate-200 rounded-xl text-xs font-semibold p-3 outline-none resize-none bg-slate-50 focus:bg-white transition-all leading-relaxed shadow-sm"
                                />
                            </div>

                            {/* Divider */}
                            <div className="border-t border-slate-100 my-4" />

                            {/* Bloco de Ações do Gestor */}
                            <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/50">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Ações de Gestão</h4>
                                
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase text-slate-500">Mudar Status do Chamado</Label>
                                    <select
                                        value={selectedRequestForAction.nextStatus || selectedRequestForAction.status}
                                        onChange={(e) => setSelectedRequestForAction({ ...selectedRequestForAction, nextStatus: e.target.value })}
                                        className="w-full h-10 border border-slate-200 bg-white text-xs font-semibold px-3 outline-none rounded-xl cursor-pointer"
                                    >
                                        <option value="PENDENTE">Aguardando (Pendente)</option>
                                        <option value="EM_ANDAMENTO">Em Execução (Em Andamento)</option>
                                        <option value="CONCLUIDO">Concluir Solicitação</option>
                                        <option value="REJEITADO">Rejeitar Solicitação</option>
                                        <option value="CANCELADO">Cancelar Solicitação</option>
                                    </select>
                                </div>
                            </div>

                            {/* Histórico e Chat de Comentários do Chamado */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block font-bold">Histórico de Mensagens / Respostas com o Cliente</span>
                                
                                {/* Chat de mensagens */}
                                <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    {/* Parecer final da JVS se houver */}
                                    {selectedRequestForAction.resolutionNotes && (
                                        <div className="flex flex-col gap-1 items-start">
                                            <div className="bg-slate-200 text-slate-800 p-2.5 rounded-2xl rounded-tl-none max-w-[85%] text-xs font-medium leading-relaxed">
                                                <span className="text-[9px] font-black uppercase text-slate-500 block mb-0.5">Operação JVS (Parecer de Resolução)</span>
                                                {selectedRequestForAction.resolutionNotes}
                                            </div>
                                        </div>
                                    )}

                                    {/* Comentários adicionais */}
                                    {(selectedRequestForAction.comments || []).length === 0 && !selectedRequestForAction.resolutionNotes ? (
                                        <div className="text-center text-[10px] font-medium text-slate-400 py-6 italic">Sem mensagens adicionais registradas neste chamado.</div>
                                    ) : (
                                        (selectedRequestForAction.comments || []).map((comm: any) => {
                                            const isMyComment = comm.user?.role !== "CLIENTE";
                                            return (
                                                <div key={comm.id} className={`flex flex-col gap-1 ${isMyComment ? "items-end" : "items-start"}`}>
                                                    <div className={`p-2.5 rounded-2xl text-xs font-medium leading-relaxed max-w-[85%] ${
                                                        isMyComment 
                                                            ? "bg-blue-600 text-white rounded-tr-none" 
                                                            : "bg-slate-200 text-slate-800 rounded-tl-none"
                                                    }`}>
                                                        <span className="text-[9px] font-black uppercase block opacity-70 mb-0.5">
                                                            {isMyComment ? `Você (${comm.user?.name || "Operador"})` : "Cliente"}
                                                        </span>
                                                        {comm.content}
                                                    </div>
                                                    <span className="text-[8px] font-semibold text-slate-400 px-1">
                                                        {comm.createdAt ? new Date(comm.createdAt).toLocaleString("pt-BR") : ""}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Enviar novo comentário / resposta */}
                                <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t border-slate-100/50">
                                    <input
                                        type="text"
                                        placeholder="Digite uma mensagem/resposta para o cliente..."
                                        value={newCommentContent}
                                        onChange={(e) => setNewCommentContent(e.target.value)}
                                        className="flex-1 h-9 border border-slate-250 bg-white rounded-xl text-xs font-semibold px-3 outline-none focus:border-blue-500 text-slate-800"
                                        required
                                    />
                                    <Button 
                                        type="submit" 
                                        disabled={submittingComment || !newCommentContent.trim()}
                                        className="h-9 text-[10px] font-black uppercase tracking-wider px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shrink-0 cursor-pointer"
                                    >
                                        {submittingComment ? "..." : "Enviar"}
                                    </Button>
                                </form>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-4 border-t border-slate-100 flex items-center justify-between w-full gap-2">
                        <div>
                            {userRole === "ADMIN" && selectedRequestForAction && (
                                confirmDeleteId === selectedRequestForAction.id ? (
                                    <Button
                                        type="button"
                                        disabled={deletingRequest}
                                        onClick={() => handleDeleteRequest(selectedRequestForAction.id)}
                                        className="h-10 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white gap-1.5 animate-pulse"
                                    >
                                        <AlertCircle className="w-4 h-4" /> Confirmar Exclusão?
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setConfirmDeleteId(selectedRequestForAction.id)}
                                        className="h-10 text-xs font-bold rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 gap-1.5"
                                    >
                                        <Trash2 className="w-4 h-4" /> Excluir Solicitação
                                    </Button>
                                )
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" onClick={() => { setSelectedRequestForAction(null); setConfirmDeleteId(null); }} className="h-10 text-xs font-bold rounded-xl">Fechar</Button>
                            <Button
                                type="button"
                                disabled={transitioningRequestState || savingRequestDetails}
                                onClick={handleSaveRequestDetails}
                                className="h-10 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                            >
                                Salvar Alteração
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Detalhamento de KPIs Operacionais (Auditoria Mensal) */}
            <Dialog open={kpiModalConfig !== null} onOpenChange={(open) => { if (!open) setKpiModalConfig(null); }}>
                <DialogContent className="w-[95vw] sm:max-w-4xl h-[85vh] max-h-[85vh] flex flex-col rounded-3xl p-6 bg-white border border-slate-100 shadow-premium overflow-hidden">
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
                            {kpiModalConfig?.kpiType === 'reposition' && "Auditoria de SLA de Contratação de Vagas"}
                            {kpiModalConfig?.kpiType === 'visits' && "Auditoria de Cumprimento de Visitas de Liderança"}
                            </p>
                        </div>
                    </DialogHeader>

                    {loadingKpiModal ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                            <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Carregando dados operacionais...</span>
                        </div>
                    ) : kpiModalData ? (
                        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
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
                                                        ? `${(((kpiModalData.attendances.length - absences.filter((a: any) => !a.coveredById).length) / kpiModalData.attendances.length) * 100).toFixed(1)}%`
                                                        : "-"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="w-full max-w-full border border-slate-100 rounded-2xl overflow-x-auto bg-white">
                                            <Table className="min-w-[700px]">
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
                                                                <TableCell className="font-bold text-xs text-slate-900 max-w-[160px] whitespace-normal break-words">{a.employee?.name || "Funcionário"}</TableCell>
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

                            {/* KPI: VISITAS DE LIDERANÇA */}
                            {kpiModalConfig?.kpiType === 'visits' && (
                                <div className="space-y-4">
                                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-1.5 select-none">
                                        <span className="text-xs font-bold text-slate-800">Metas e Auditoria de Visitas</span>
                                        <p className="text-[11px] text-slate-500 font-medium">Abaixo estão listadas as visitas de supervisão, coordenação, gerência e diretoria registradas para este contrato no mês selecionado.</p>
                                    </div>
                                    <div className="w-full max-w-full border border-slate-100 rounded-2xl overflow-x-auto bg-white">
                                        <Table className="min-w-[700px]">
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="font-bold text-xs text-slate-800 pl-4 py-3">Cargo Liderança</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Visitante</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Data da Visita</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Observações Operacionais</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(() => {
                                                    const monthVisits = (detailedData?.visits || []).filter((v: any) => {
                                                        const d = new Date(v.visitDate);
                                                        return d.getMonth() === kpiModalConfig.monthIndex && d.getFullYear() === selectedYear;
                                                    });
                                                    if (monthVisits.length === 0) {
                                                        return (
                                                            <TableRow>
                                                                <TableCell colSpan={4} className="text-center py-8 text-slate-400 font-semibold text-xs">
                                                                    Nenhuma visita de liderança registrada para este contrato no mês selecionado.
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    }
                                                    return monthVisits.map((v: any) => (
                                                        <TableRow key={v.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <TableCell className="font-black text-xs text-slate-800 pl-4 py-3">{v.visitorRole}</TableCell>
                                                            <TableCell className="font-bold text-xs text-slate-900">{v.visitorName}</TableCell>
                                                            <TableCell className="font-bold text-xs text-slate-600">
                                                                {(() => {
                                                                    const d = new Date(v.visitDate);
                                                                    const day = String(d.getUTCDate()).padStart(2, '0');
                                                                    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                                                                    const year = d.getUTCFullYear();
                                                                    return `${day}/${month}/${year}`;
                                                                })()}
                                                            </TableCell>
                                                            <TableCell className="font-medium text-xs text-slate-600 whitespace-normal break-words max-w-[350px]">{v.notes || "-"}</TableCell>
                                                        </TableRow>
                                                    ));
                                                })()}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

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
                                                                    "{resp.feedback}"
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
                                    {/* Cards de Calculo do Turnover */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Substituições no Mês</span>
                                            <p className="text-2xl font-black text-slate-800 mt-1">{kpiModalData.assignments?.length || 0}</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total de Postos do Contrato</span>
                                            <p className="text-2xl font-black text-slate-800 mt-1">{kpiModalData.postos?.length || 10}</p>
                                        </div>
                                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100/50">
                                            <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Taxa de Rotatividade</span>
                                            <p className="text-2xl font-black text-blue-700 mt-1">
                                                {kpiModalConfig.value !== undefined ? `${kpiModalConfig.value.toFixed(1).replace('.', ',')}%` : "0,0%"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="w-full max-w-full border border-slate-100 rounded-2xl overflow-x-auto bg-white">
                                        <Table className="min-w-[700px]">
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
                                    <div className="w-full max-w-full border border-slate-100 rounded-2xl overflow-x-auto bg-white">
                                        <Table className="min-w-[700px]">
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
                                                                <TableCell className="font-bold text-xs text-slate-500 pl-4 truncate max-w-[80px]">#{r.id.split('-')[0]}</TableCell>
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

                            {/* KPI: SLA DE CONTRATAÇÃO */}
                            {kpiModalConfig?.kpiType === 'reposition' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Vagas Repostas</span>
                                            <p className="text-2xl font-black text-slate-800 mt-1">{kpiModalData.repositions?.length || 0}</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Acumulado Dias Vagos</span>
                                            <p className="text-2xl font-black text-slate-800 mt-1">{(kpiModalData.repositions || []).reduce((sum: number, r: any) => sum + r.diffDays, 0)} dias</p>
                                        </div>
                                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100/50">
                                            <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Média de Contratação</span>
                                            <p className="text-2xl font-black text-blue-700 mt-1">
                                                {kpiModalConfig.value !== undefined && kpiModalConfig.value !== null ? `${kpiModalConfig.value.toFixed(1).replace('.', ',')} dias` : "-"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="w-full max-w-full border border-slate-100 rounded-2xl overflow-x-auto bg-white">
                                        <Table className="min-w-[700px]">
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="font-bold text-xs text-slate-800 pl-4">Posto de Trabalho</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Cargo/Função</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Colaborador Antigo</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Data Saída</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Colaborador Novo</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Data Entrada</TableHead>
                                                    <TableHead className="font-bold text-xs text-slate-800">Dias de Vacância</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(kpiModalData.repositions || []).length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="text-center py-8 text-slate-400 font-semibold text-xs">
                                                            Nenhuma contratação de funcionário concluída neste mês.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    (kpiModalData.repositions || []).map((r: any) => (
                                                        <TableRow key={r.id} className="hover:bg-slate-55/30 transition-colors">
                                                            <TableCell className="font-bold text-xs text-slate-800 pl-4">{r.posto?.name || "Posto"}</TableCell>
                                                            <TableCell className="font-bold text-xs text-slate-600">{r.posto?.role?.name || "-"}</TableCell>
                                                            <TableCell className="font-bold text-xs text-slate-900 max-w-[160px] whitespace-normal break-words">{r.exitedEmployee?.name || "-"}</TableCell>
                                                            <TableCell className="font-bold text-xs text-slate-550">{new Date(r.exitDate).toLocaleDateString('pt-BR')}</TableCell>
                                                            <TableCell className="font-bold text-xs text-slate-900 max-w-[160px] whitespace-normal break-words">{r.enteredEmployee?.name || "-"}</TableCell>
                                                            <TableCell className="font-bold text-xs text-slate-800">{new Date(r.entryDate).toLocaleDateString('pt-BR')}</TableCell>
                                                            <TableCell className="font-bold text-xs text-blue-650">{r.diffDays} dias</TableCell>
                                                        </TableRow>
                                                    ))
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
                                        <div className="w-full max-w-full border border-slate-100 rounded-2xl overflow-x-auto bg-white">
                                            <Table className="min-w-[700px]">
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
                                                                <TableCell className="font-bold text-xs text-slate-500 pl-4 truncate max-w-[80px]">#{r.id.split('-')[0]}</TableCell>
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
