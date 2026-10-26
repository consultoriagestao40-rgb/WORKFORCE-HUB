"use client";

import React, { useState, useTransition } from "react";
import { 
    Clock, 
    CheckCircle2, 
    XCircle, 
    ShieldCheck, 
    Search, 
    User, 
    Building2, 
    Eye, 
    Check, 
    X,
    FileText,
    History,
    CalendarClock,
    Lock,
    ArrowRight,
    UserX,
    Calendar,
    ArrowRightLeft,
    Trash2,
    Calculator,
    DollarSign,
    ChevronDown,
    ChevronUp,
    MapPin
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { processApprovalDecision, deleteApprovalRequests, rejectDeleteRequest, concludeRhExecution } from "@/actions/approvals";

// Tipos aprovados que dependem de execução manual do RH/DP (os demais são auto-efetivados ou têm monitor próprio)
const RH_MANUAL_TYPES = ["OUTROS", "AJUSTE_SALARIAL"];
const getRhState = (req: { status: string; type: string; executionPayload?: any }): "NONE" | "WAITING" | "DONE" | "NOT_DONE" => {
    if (req.status !== "APROVADO" || !RH_MANUAL_TYPES.includes(req.type)) return "NONE";
    const c = req.executionPayload?.rhConclusion;
    if (!c) return "WAITING";
    return c.outcome === "NAO_EXECUTADO" ? "NOT_DONE" : "DONE";
};
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface ApprovalRequestItem {
    id: string;
    type: string;
    status: string;
    title: string;
    description: string | null;
    employeeId: string | null;
    employeeName: string | null;
    clientId: string | null;
    clientName: string | null;
    postoId: string | null;
    postoName: string | null;
    requesterId: string | null;
    requesterName: string;
    snapshotCurrent: any;
    snapshotProposed: any;
    executionPayload: any;
    n1Required: boolean;
    n1ApproverId: string | null;
    n1ApproverName: string | null;
    n1ApprovedAt: Date | null;
    n1Decision: string | null;
    n1Feedback: string | null;
    n2Required: boolean;
    n2ApproverId: string | null;
    n2ApproverName: string | null;
    n2ApprovedAt: Date | null;
    n2Decision: string | null;
    n2Feedback: string | null;
    appliedAt: Date | null;
    appliedBy: string | null;
    secullumSynced: boolean;
    secullumSyncedAt: Date | null;
    secullumLog: string | null;
    createdAt: Date;
    employee?: {
        id: string;
        name: string;
        cpf: string | null;
        phone: string | null;
        registrationNumber?: string | null;
    } | null;
    client?: {
        id: string;
        name: string;
    } | null;
    posto?: {
        id: string;
        startTime?: string | null;
        endTime?: string | null;
        schedule?: string | null;
        notes?: string | null;
    } | null;
    requester?: {
        id: string;
        name: string;
        role?: string;
    } | null;
}

interface ApprovalsHubProps {
    initialRequests: ApprovalRequestItem[];
    metrics: {
        totalPending: number;
        pendingN1: number;
        pendingN2: number;
        approvedTotal: number;
        rejectedTotal: number;
    };
    userRole?: string;
    userName?: string;
    isApproverN2?: boolean;
}

function safeFmtDate(date: any, pattern: string = "dd/MM/yyyy HH:mm"): string {
    if (!date) return "-";
    try {
        const d = typeof date === "string" ? new Date(date) : date;
        if (isNaN(d.getTime())) return "-";
        return format(d, pattern, { locale: ptBR });
    } catch {
        return "-";
    }
}

export function ApprovalsHub({ 
    initialRequests, 
    metrics: initialMetrics,
    userRole,
    userName,
    isApproverN2 = false
}: ApprovalsHubProps) {
    const [requests, setRequests] = useState<ApprovalRequestItem[]>(initialRequests);
    const [metrics, setMetrics] = useState(initialMetrics);
    const [selectedTab, setSelectedTab] = useState<string>("PENDING_ALL");
    const [rhNote, setRhNote] = useState("");
    const rhWaitingCount = requests.filter(r => getRhState(r) === "WAITING").length;
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedType, setSelectedType] = useState<string>("ALL");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();

    // Modal de Detalhes e Ações
    const [detailsModal, setDetailsModal] = useState<{
        isOpen: boolean;
        request: ApprovalRequestItem | null;
        decisionFeedback: string;
        showRubricas?: boolean;
    }>({
        isOpen: false,
        request: null,
        decisionFeedback: "",
        showRubricas: false
    });

    // Modal de Confirmação de Exclusão
    const [deleteModal, setDeleteModal] = useState<{
        isOpen: boolean;
        ids: string[];
        reason: string;
    }>({
        isOpen: false,
        ids: [],
        reason: ""
    });

    // Filtros
    const filteredRequests = requests.filter(req => {
        if (selectedTab === "PENDING_ALL") {
            if (req.status !== "PENDENTE_N1" && req.status !== "PENDENTE_N2") return false;
        } else if (selectedTab === "PENDENTE_N1") {
            if (req.status !== "PENDENTE_N1") return false;
        } else if (selectedTab === "PENDENTE_N2") {
            if (req.status !== "PENDENTE_N2") return false;
        } else if (selectedTab === "RH_WAITING") {
            if (getRhState(req) !== "WAITING") return false;
        } else if (selectedTab === "APROVADO") {
            if (req.status !== "APROVADO") return false;
        } else if (selectedTab === "REPROVADO") {
            if (req.status !== "REPROVADO") return false;
        }

        if (selectedType !== "ALL" && req.type !== selectedType) {
            return false;
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            const matchTitle = req.title.toLowerCase().includes(term);
            const matchEmp = (req.employeeName || req.employee?.name)?.toLowerCase().includes(term);
            const matchCli = (req.clientName || req.client?.name)?.toLowerCase().includes(term);
            const matchReq = (req.requesterName || req.requester?.name)?.toLowerCase().includes(term);
            if (!matchTitle && !matchEmp && !matchCli && !matchReq) return false;
        }

        return true;
    });

    const handleExecuteDecision = (targetRequest: ApprovalRequestItem, action: "APROVAR" | "REPROVAR", explicitFeedback?: string) => {
        const feedback = (explicitFeedback || "").trim();

        if (action === "REPROVAR" && !feedback) {
            toast.error("Por favor, informe o motivo da reprovação.");
            return;
        }

        startTransition(async () => {
            const res = await processApprovalDecision(targetRequest.id, action, feedback);
            if (res.success) {
                const nextStatus = res.status || (action === "APROVAR" ? (targetRequest.n2Required && targetRequest.status === "PENDENTE_N1" ? "PENDENTE_N2" : "APROVADO") : "REPROVADO");
                const now = new Date();

                // Mensagem de feedback contextual
                if (action === "APROVAR") {
                    if (targetRequest.type === "MUDANCA_POSTO" || targetRequest.type === "MUDANCA_ESCALA" || targetRequest.type === "MUDANCA_HORARIO") {
                        toast.success("Aprovado! Movimentação auto-completada e atualizada no posto.");
                    } else if (targetRequest.type === "DESLIGAMENTO") {
                        toast.success("Aprovado! Encaminhado para o RH (Kesia) programar a rescisão.");
                    } else if (targetRequest.type === "FERIAS") {
                        toast.success("Aprovado! Encaminhado para o RH (Kesia) programar as férias.");
                    } else {
                        toast.success(res.message || "Solicitação aprovada com sucesso!");
                    }
                } else {
                    toast.success("Solicitação reprovada.");
                }

                setRequests(prev => prev.map(item => {
                    if (item.id === targetRequest.id) {
                        return {
                            ...item,
                            status: nextStatus,
                            ...(targetRequest.status === "PENDENTE_N1" ? {
                                n1Decision: action,
                                n1ApprovedAt: now,
                                n1ApproverName: userName || "Gestor N1",
                                n1Feedback: feedback || null
                            } : {
                                n2Decision: action,
                                n2ApprovedAt: now,
                                n2ApproverName: userName || "Diretoria",
                                n2Feedback: feedback || null,
                                appliedAt: nextStatus === "APROVADO" ? now : item.appliedAt,
                                appliedBy: nextStatus === "APROVADO" ? (userName || "Diretoria") : item.appliedBy,
                            }),
                            secullumSynced: (res as any).secullumSuccess ?? item.secullumSynced,
                            secullumLog: (res as any).secullumLog ?? item.secullumLog
                        };
                    }
                    return item;
                }));

                // Atualizar contadores
                setMetrics(prev => {
                    const wasP1 = targetRequest.status === "PENDENTE_N1";
                    const wasP2 = targetRequest.status === "PENDENTE_N2";
                    return {
                        ...prev,
                        totalPending: Math.max(0, prev.totalPending - (nextStatus === "APROVADO" || nextStatus === "REPROVADO" ? 1 : 0)),
                        pendingN1: wasP1 ? Math.max(0, prev.pendingN1 - 1) : prev.pendingN1,
                        pendingN2: wasP1 && nextStatus === "PENDENTE_N2" ? prev.pendingN2 + 1 : (wasP2 && nextStatus !== "PENDENTE_N2" ? Math.max(0, prev.pendingN2 - 1) : prev.pendingN2),
                        approvedTotal: nextStatus === "APROVADO" ? prev.approvedTotal + 1 : prev.approvedTotal,
                        rejectedTotal: nextStatus === "REPROVADO" ? prev.rejectedTotal + 1 : prev.rejectedTotal,
                    };
                });

                setDetailsModal({ isOpen: false, request: null, decisionFeedback: "" });
            } else {
                toast.error(res.message || "Erro ao processar aprovação.");
            }
        });
    };

    const handleRhConclusion = (targetRequest: ApprovalRequestItem, outcome: "CONCLUIDO" | "NAO_EXECUTADO") => {
        if (outcome === "NAO_EXECUTADO" && !rhNote.trim()) {
            toast.error("Informe o motivo de não ter sido executada.");
            return;
        }
        startTransition(async () => {
            const res = await concludeRhExecution(targetRequest.id, outcome, rhNote);
            if (res.success) {
                toast.success(outcome === "CONCLUIDO" ? "Processo concluído! Saiu da fila do RH." : "Solicitação marcada como não executada.");
                setRequests(prev => prev.map(item => item.id === targetRequest.id
                    ? { ...item, executionPayload: { ...(item.executionPayload || {}), rhConclusion: (res as any).rhConclusion } }
                    : item));
                setRhNote("");
                setDetailsModal({ isOpen: false, request: null, decisionFeedback: "" });
            } else {
                toast.error((res as any).error || "Erro ao concluir solicitação.");
            }
        });
    };

    const getRequestStatusBadge = (req: ApprovalRequestItem) => {
        const rh = getRhState(req);
        if (rh === "WAITING") {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Aguardando RH
                </span>
            );
        }
        if (rh === "DONE") {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white border border-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Concluído
                </span>
            );
        }
        if (rh === "NOT_DONE") {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                    Não executado
                </span>
            );
        }
        return getStatusBadge(req.status, req.n1Decision);
    };

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleToggleSelectAll = () => {
        if (selectedIds.length === filteredRequests.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredRequests.map(r => r.id));
        }
    };

    const handleOpenDeleteModal = (ids: string[]) => {
        setDeleteModal({
            isOpen: true,
            ids,
            reason: ""
        });
    };

    const handleConfirmDelete = () => {
        if (!deleteModal.ids.length) return;

        startTransition(async () => {
            const res = await deleteApprovalRequests(deleteModal.ids, deleteModal.reason);
            if (res.success) {
                if (res.action === "DELETED") {
                    toast.success(res.message || `${deleteModal.ids.length} solicitação(ões) excluída(s) com sucesso!`);
                    
                    setRequests(prev => prev.filter(r => !deleteModal.ids.includes(r.id)));
                    setSelectedIds(prev => prev.filter(id => !deleteModal.ids.includes(id)));
                    
                    setMetrics(prev => ({
                        ...prev,
                        totalPending: Math.max(0, prev.totalPending - deleteModal.ids.length)
                    }));

                    if (detailsModal.request && deleteModal.ids.includes(detailsModal.request.id)) {
                        setDetailsModal({ isOpen: false, request: null, decisionFeedback: "" });
                    }
                } else {
                    toast.success(res.message || "Solicitação de exclusão encaminhada para o N2 (Diretoria) aprovar!");
                    
                    setRequests(prev => prev.map(item => {
                        if (deleteModal.ids.includes(item.id)) {
                            return {
                                ...item,
                                status: "PENDENTE_N2",
                                n1Decision: "SOLICITADA_EXCLUSAO",
                                n1Feedback: `Exclusão solicitada por ${userName || 'Gestor'}. Motivo: ${deleteModal.reason || 'Solicitação obsoleta'}`
                            };
                        }
                        return item;
                    }));
                    setSelectedIds([]);
                    
                    if (detailsModal.request && deleteModal.ids.includes(detailsModal.request.id)) {
                        setDetailsModal(prev => ({
                            ...prev,
                            request: prev.request ? {
                                ...prev.request,
                                status: "PENDENTE_N2",
                                n1Decision: "SOLICITADA_EXCLUSAO",
                                n1Feedback: `Exclusão solicitada por ${userName || 'Gestor'}. Motivo: ${deleteModal.reason || 'Solicitação obsoleta'}`
                            } : null
                        }));
                    }
                }

                setDeleteModal({ isOpen: false, ids: [], reason: "" });
            } else {
                toast.error((res as any).error || (res as any).message || "Erro ao processar exclusão.");
            }
        });
    };

    const handleConfirmRejectDelete = (requestId: string) => {
        startTransition(async () => {
            const res = await rejectDeleteRequest(requestId);
            if (res.success) {
                toast.success(res.message || "Solicitação de exclusão rejeitada.");
                setRequests(prev => prev.map(item => {
                    if (item.id === requestId) {
                        return {
                            ...item,
                            n1Decision: null,
                            n1Feedback: null,
                            status: item.n1Required ? "PENDENTE_N1" : "PENDENTE_N2"
                        };
                    }
                    return item;
                }));

                if (detailsModal.request && detailsModal.request.id === requestId) {
                    setDetailsModal(prev => ({
                        ...prev,
                        request: prev.request ? {
                            ...prev.request,
                            n1Decision: null,
                            n1Feedback: null,
                            status: prev.request.n1Required ? "PENDENTE_N1" : "PENDENTE_N2"
                        } : null
                    }));
                }
            } else {
                toast.error((res as any).error || (res as any).message || "Erro ao rejeitar exclusão.");
            }
        });
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case "DESLIGAMENTO":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <UserX className="w-3.5 h-3.5 text-rose-500" />
                        Desligamento
                    </span>
                );
            case "FERIAS":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                        <Calendar className="w-3.5 h-3.5 text-sky-500" />
                        Férias
                    </span>
                );
            case "MUDANCA_POSTO":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />
                        Movimentação de Posto
                    </span>
                );
            case "MUDANCA_ESCALA":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        Mudança de Escala
                    </span>
                );
            case "MUDANCA_HORARIO":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        Ajuste de Horário
                    </span>
                );
            case "AJUSTE_SALARIAL":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Ajuste Salarial
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        Solicitação
                    </span>
                );
        }
    };

    const getStatusBadge = (status: string, n1Decision?: string | null) => {
        if (n1Decision === "SOLICITADA_EXCLUSAO") {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                    Exclusão Solicitada (N2)
                </span>
            );
        }

        switch (status) {
            case "PENDENTE_N1":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Aguardando N1
                    </span>
                );
            case "PENDENTE_N2":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
                        Aguardando N2
                    </span>
                );
            case "APROVADO":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Aprovado
                    </span>
                );
            case "REPROVADO":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        Reprovado
                    </span>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* KPI Cards Limpos */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div 
                    onClick={() => setSelectedTab("PENDING_ALL")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer bg-white shadow-xs ${
                        selectedTab === "PENDING_ALL"
                            ? "border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20" 
                            : "border-slate-200 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600">Total Pendentes</span>
                        <Clock className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-800 mt-2">{metrics.totalPending}</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">Aguardando alçada N1/N2</p>
                </div>

                <div 
                    onClick={() => setSelectedTab("PENDENTE_N1")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer bg-white shadow-xs ${
                        selectedTab === "PENDENTE_N1"
                            ? "border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20" 
                            : "border-slate-200 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600">Pendentes N1</span>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    </div>
                    <div className="text-2xl font-bold text-amber-600 mt-2">{metrics.pendingN1}</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">Gestão Operacional</p>
                </div>

                <div 
                    onClick={() => setSelectedTab("PENDENTE_N2")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer bg-white shadow-xs ${
                        selectedTab === "PENDENTE_N2"
                            ? "border-purple-400 ring-2 ring-purple-400/20 bg-purple-50/20" 
                            : "border-slate-200 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600">Pendentes N2</span>
                        <ShieldCheck className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold text-purple-700 mt-2">{metrics.pendingN2}</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">Diretoria Executiva</p>
                </div>

                <div 
                    onClick={() => setSelectedTab("APROVADO")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer bg-white shadow-xs ${
                        selectedTab === "APROVADO"
                            ? "border-emerald-400 ring-2 ring-emerald-400/20 bg-emerald-50/20" 
                            : "border-slate-200 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600">Aprovados</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 mt-2">{metrics.approvedTotal}</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">Liberados / Efetivados</p>
                </div>

                <div 
                    onClick={() => setSelectedTab("REPROVADO")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer bg-white shadow-xs ${
                        selectedTab === "REPROVADO"
                            ? "border-rose-400 ring-2 ring-rose-400/20 bg-rose-50/20" 
                            : "border-slate-200 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600">Reprovados</span>
                        <XCircle className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="text-2xl font-bold text-rose-600 mt-2">{metrics.rejectedTotal}</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">Encerrados com justificativa</p>
                </div>
            </div>

            {/* Barra de Filtros e Busca */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por solicitante, colaborador ou cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                    </div>

                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                        <option value="ALL">Todos os Tipos</option>
                        <option value="DESLIGAMENTO">Desligamentos</option>
                        <option value="MUDANCA_POSTO">Movimentação de Posto</option>
                        <option value="MUDANCA_ESCALA">Mudança de Escala</option>
                        <option value="MUDANCA_HORARIO">Ajuste de Horário</option>
                        <option value="FERIAS">Férias</option>
                        <option value="AJUSTE_SALARIAL">Ajuste Salarial</option>
                        <option value="OUTROS">Outros</option>
                    </select>
                </div>

                {/* Abas Rápidas de Status */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
                    <button
                        onClick={() => setSelectedTab("PENDING_ALL")}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            selectedTab === "PENDING_ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        Pendentes ({metrics.totalPending})
                    </button>
                    <button
                        onClick={() => setSelectedTab("PENDENTE_N1")}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            selectedTab === "PENDENTE_N1" ? "bg-amber-500 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        N1 ({metrics.pendingN1})
                    </button>
                    <button
                        onClick={() => setSelectedTab("PENDENTE_N2")}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            selectedTab === "PENDENTE_N2" ? "bg-purple-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        N2 ({metrics.pendingN2})
                    </button>
                    <button
                        onClick={() => setSelectedTab("RH_WAITING")}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            selectedTab === "RH_WAITING" ? "bg-amber-500 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        Execução RH ({rhWaitingCount})
                    </button>
                    <button
                        onClick={() => setSelectedTab("APROVADO")}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            selectedTab === "APROVADO" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        Aprovadas
                    </button>
                    <button
                        onClick={() => setSelectedTab("REPROVADO")}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            selectedTab === "REPROVADO" ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        Reprovadas
                    </button>
                    <button
                        onClick={() => setSelectedTab("ALL")}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            selectedTab === "ALL" ? "bg-slate-800 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        Todas
                    </button>
                </div>
            </div>

            {/* Barra de Ações em Lote */}
            {selectedIds.length > 0 && (
                <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-md flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-3">
                        <span className="font-bold text-xs bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">
                            {selectedIds.length} {selectedIds.length === 1 ? "selecionada" : "selecionadas"}
                        </span>
                        <span className="text-xs text-slate-300 hidden sm:inline">
                            {isApproverN2 
                                ? "Alçada N2 (Diretoria/Admin): as solicitações serão excluídas definitivamente."
                                : "Botão de exclusão liberado: os pedidos selecionados serão encaminhados para homologação do N2."}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSelectedIds([])}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                            Desmarcar
                        </button>
                        <button
                            onClick={() => handleOpenDeleteModal(selectedIds)}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isApproverN2 ? `Excluir Definitivamente (${selectedIds.length})` : `Solicitar Exclusão ao N2 (${selectedIds.length})`}
                        </button>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                TABELA BÁSICA E LIMPA (PADRÃO SOLICITADO PELO USUÁRIO)
                Colunas: Checkbox | Solicitante | Data | Tipo | Colaborador | Status | Ações
            ══════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                            <tr>
                                <th className="px-3 py-3.5 w-10 text-center">
                                    <input 
                                        type="checkbox"
                                        checked={filteredRequests.length > 0 && selectedIds.length === filteredRequests.length}
                                        onChange={handleToggleSelectAll}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                        title="Selecionar todas as solicitações"
                                    />
                                </th>
                                <th className="px-4 py-3.5">Solicitante</th>
                                <th className="px-4 py-3.5 text-center">Data</th>
                                <th className="px-4 py-3.5">Tipo de Solicitação</th>
                                <th className="px-4 py-3.5">Colaborador</th>
                                <th className="px-4 py-3.5 text-center">Status</th>
                                <th className="px-4 py-3.5 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                                        Nenhuma solicitação encontrada.
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map(req => {
                                    return (
                                        <tr 
                                            key={req.id} 
                                            className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                            onClick={() => setDetailsModal({ isOpen: true, request: req, decisionFeedback: "" })}
                                        >
                                            {/* 0. Checkbox */}
                                            <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedIds.includes(req.id)}
                                                    onChange={() => handleToggleSelect(req.id)}
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                />
                                            </td>

                                            {/* 1. Solicitante */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px]">
                                                        {req.requesterName.slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <span className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                        {req.requesterName}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* 2. Data */}
                                            <td className="px-4 py-3 text-center text-slate-600 font-medium">
                                                {safeFmtDate(req.createdAt, "dd/MM/yyyy HH:mm")}
                                            </td>

                                            {/* 3. Tipo de Solicitação */}
                                            <td className="px-4 py-3">
                                                {getTypeBadge(req.type)}
                                            </td>

                                            {/* 4. Colaborador */}
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-900">
                                                    {req.employeeName || req.employee?.name || req.title}
                                                </div>
                                                <div className="text-[11px] text-slate-500 font-normal">
                                                    {req.clientName || req.client?.name || "Geral"} {req.postoName ? `• ${req.postoName}` : ""}
                                                </div>
                                                {req.description && (
                                                    <div className="text-[11px] text-slate-600 font-medium italic truncate max-w-sm mt-0.5" title={req.description}>
                                                        "{req.description}"
                                                    </div>
                                                )}
                                            </td>

                                            {/* 5. Status da Alçada */}
                                            <td className="px-4 py-3 text-center">
                                                {getRequestStatusBadge(req)}
                                            </td>

                                            {/* 6. Ações */}
                                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => setDetailsModal({ isOpen: true, request: req, decisionFeedback: "" })}
                                                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors border border-slate-200/80 cursor-pointer"
                                                    >
                                                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                                                        Detalhes
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenDeleteModal([req.id])}
                                                        title={isApproverN2 ? "Excluir definitivamente (N2)" : "Solicitar exclusão ao N2"}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-200 cursor-pointer"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                MODAL DE DETALHES, HISTÓRICO E DESTINO OPERACIONAL
            ══════════════════════════════════════════════════════════ */}
            <Dialog open={detailsModal.isOpen} onOpenChange={(open) => !open && setDetailsModal(prev => ({ ...prev, isOpen: false }))}>
                <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white border border-slate-200 shadow-xl rounded-2xl">
                    {detailsModal.request && (
                        <div>
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-base font-bold text-slate-800">
                                            {detailsModal.request.title}
                                        </DialogTitle>
                                        <DialogDescription className="text-xs text-slate-500 mt-0.5">
                                            Solicitado por <strong>{detailsModal.request.requesterName}</strong> em {safeFmtDate(detailsModal.request.createdAt)}
                                        </DialogDescription>
                                    </div>
                                </div>
                                <div>
                                    {getRequestStatusBadge(detailsModal.request)}
                                </div>
                            </div>

                            {/* Informações Detalhadas */}
                            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
                                {/* Alerta especial de Exclusão Solicitada */}
                                {detailsModal.request.n1Decision === "SOLICITADA_EXCLUSAO" && (
                                    <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div className="flex items-start gap-2.5">
                                            <div className="p-1 rounded-lg bg-rose-100 text-rose-700 mt-0.5 shrink-0">
                                                <Trash2 className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="font-bold text-rose-900 text-xs block">
                                                    Exclusão Solicitada — Aguardando Parecer N2
                                                </span>
                                                <p className="text-rose-800 text-[11px] mt-0.5">
                                                    {detailsModal.request.n1Feedback || "Um gestor solicitou a exclusão desta solicitação por estar obsoleta."}
                                                </p>
                                            </div>
                                        </div>
                                        {isApproverN2 && (
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleConfirmRejectDelete(detailsModal.request!.id)}
                                                    disabled={isPending}
                                                    className="text-[11px] h-8 bg-white border-rose-200 text-rose-800 hover:bg-rose-100 font-semibold"
                                                >
                                                    Rejeitar Exclusão
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleOpenDeleteModal([detailsModal.request!.id])}
                                                    disabled={isPending}
                                                    className="text-[11px] h-8 bg-rose-600 hover:bg-rose-700 text-white font-bold"
                                                >
                                                    Homologar Exclusão
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Informações Básicas em Cards Limpos */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Colaborador</span>
                                        <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">
                                            {detailsModal.request.employeeName || detailsModal.request.employee?.name || "Não especificado"}
                                        </span>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cliente / Contrato</span>
                                        <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">
                                            {detailsModal.request.clientName || detailsModal.request.client?.name || "Geral"}
                                        </span>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tipo de Solicitação</span>
                                        <span className="mt-1 block">
                                            {getTypeBadge(detailsModal.request.type)}
                                        </span>
                                    </div>
                                </div>

                                {/* Texto / Justificativa da Solicitação */}
                                <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200/80 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <FileText className="w-3.5 h-3.5 text-amber-600" />
                                            Texto do Pedido ({detailsModal.request.requesterName}):
                                        </span>
                                        <span className="text-[10px] text-amber-700/80 font-medium">
                                            {safeFmtDate(detailsModal.request.createdAt)}
                                        </span>
                                    </div>
                                    <div className="text-xs font-semibold text-slate-900 leading-relaxed bg-white p-3 rounded-lg border border-amber-200/60 shadow-xs">
                                        "{detailsModal.request.description || "Nenhuma observação informada na abertura."}"
                                    </div>
                                </div>

                                {/* ── CARD DE DEMONSTRATIVO DE CÁLCULO RESCISÓRIO (CLT) ────────────────── */}
                                {detailsModal.request.type === "DESLIGAMENTO" && (() => {
                                    const sim = detailsModal.request.snapshotProposed?.terminationSimulation || detailsModal.request.executionPayload?.terminationSimulation;
                                    const proposed = detailsModal.request.snapshotProposed || detailsModal.request.executionPayload || {};
                                    return (
                                        <div className="border-2 border-emerald-300/80 bg-gradient-to-br from-emerald-50/60 via-white to-teal-50/30 p-4 rounded-2xl shadow-xs space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-xs">
                                                        <Calculator className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-slate-800 text-xs block flex items-center gap-1.5">
                                                            Demonstrativo de Cálculo Rescisório (Simulador CLT)
                                                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.5 rounded-full uppercase">
                                                                Obrigatório
                                                            </span>
                                                        </span>
                                                        <span className="text-[10px] text-slate-500">
                                                            {proposed.processType || "Desligamento"} • {proposed.dismissalSubType || "Dispensa"} • Iniciativa: <strong>{proposed.initiative || "Empresa"}</strong>
                                                        </span>
                                                    </div>
                                                </div>
                                                {proposed.noticeDays && (
                                                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
                                                        Aviso: {proposed.noticeDays} dias ({proposed.noticeType || "TRABALHADO"})
                                                    </span>
                                                )}
                                            </div>

                                            {sim ? (
                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                        <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-xs">
                                                            <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                                                                Líquido Estimado
                                                            </span>
                                                            <span className="text-base font-black text-emerald-700 leading-tight">
                                                                R$ {Number(sim.netAmount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                                                            <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                                                                Total Proventos
                                                            </span>
                                                            <span className="text-sm font-black text-slate-800 leading-tight">
                                                                R$ {Number(sim.totalProventos || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                                                            <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                                                                Total Descontos
                                                            </span>
                                                            <span className="text-sm font-black text-rose-600 leading-tight">
                                                                -R$ {Number(sim.totalDescontos || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                                                            <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                                                                Multa FGTS 40%
                                                            </span>
                                                            <span className="text-sm font-black text-indigo-700 leading-tight">
                                                                R$ {Number(sim.fgtsFineAmount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Prazos da Rescisão */}
                                                    <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                                        <span><strong>Início:</strong> {proposed.startDate ? safeFmtDate(proposed.startDate, "dd/MM/yyyy") : "-"}</span>
                                                        <span><strong>Previsão Término:</strong> {proposed.endDate ? safeFmtDate(proposed.endDate, "dd/MM/yyyy") : "-"}</span>
                                                        <span><strong>Redução Jornada:</strong> {proposed.reductionType === "SETE_DIAS" ? "7 dias corridos" : proposed.reductionType === "DUAS_HORAS" ? "2h diárias" : "Nenhuma"}</span>
                                                        <span><strong>Desvincular Imediato:</strong> {proposed.unassignImmediately ? "Sim" : "Não (Trabalha até o fim)"}</span>
                                                    </div>

                                                    {/* Rubricas do Simulador */}
                                                    {Array.isArray(sim.items) && sim.items.length > 0 && (
                                                        <div className="pt-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => setDetailsModal(prev => ({ ...prev, showRubricas: !prev.showRubricas }))}
                                                                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors"
                                                            >
                                                                {detailsModal.showRubricas ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                                {detailsModal.showRubricas ? "Ocultar demonstrativo das rubricas" : `Ver demonstrativo das rubricas (${sim.items.length} verbas)`}
                                                            </button>

                                                            {detailsModal.showRubricas && (
                                                                <div className="mt-2 space-y-1 max-h-44 overflow-y-auto pr-1">
                                                                    {sim.items.map((it: any, idx: number) => (
                                                                        <div 
                                                                            key={idx} 
                                                                            className={`p-2 rounded-lg text-[10px] flex items-center justify-between border ${
                                                                                it.type === 'PROVENTO' 
                                                                                    ? 'bg-emerald-50/50 border-emerald-100 text-slate-800' 
                                                                                    : 'bg-rose-50/50 border-rose-100 text-slate-800'
                                                                            }`}
                                                                        >
                                                                            <div>
                                                                                <span className="font-bold">{it.description}</span>
                                                                                {it.reference && <span className="text-slate-500 ml-1.5 text-[9px]">({it.reference})</span>}
                                                                            </div>
                                                                            <span className={`font-black ${it.type === 'PROVENTO' ? 'text-emerald-700' : 'text-rose-600'}`}>
                                                                                {it.type === 'PROVENTO' ? '+' : '-'} R$ {Number(it.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px]">
                                                    Cálculo simulado detalhado não fornecido no payload inicial.
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* ── CARD DE COMPARATIVO DE MOVIMENTAÇÃO DE POSTO ────────────────── */}
                                {(detailsModal.request.type === "MUDANCA_POSTO" || detailsModal.request.type === "MUDANCA_ESCALA" || detailsModal.request.type === "MUDANCA_HORARIO") && (() => {
                                    const current = detailsModal.request.snapshotCurrent || {};
                                    const proposed = detailsModal.request.snapshotProposed || detailsModal.request.executionPayload || {};
                                    return (
                                        <div className="border border-indigo-200 bg-indigo-50/30 p-4 rounded-2xl shadow-xs space-y-3">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
                                                    <ArrowRightLeft className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <span className="font-black text-slate-800 text-xs block">
                                                        Comparativo da Movimentação Operacional
                                                    </span>
                                                    <span className="text-[10px] text-slate-500">
                                                        Verifique os dados de origem e o novo posto pretendido antes de deliberar.
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                {/* Origem */}
                                                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                                                        Origem (Atual)
                                                    </span>
                                                    <div className="font-bold text-slate-800">
                                                        {current.currentClientName || current.clientName || detailsModal.request.clientName || "Rotativo / Sem Posto"}
                                                    </div>
                                                    <div className="text-[11px] text-slate-600">
                                                        Função: <strong>{current.currentRoleName || current.roleName || "Não definida"}</strong>
                                                    </div>
                                                    <div className="text-[11px] text-slate-600">
                                                        Escala/Horário: {current.currentSchedule || current.schedule || "Rotativo"} ({current.currentWorkload || current.workload || 220}h)
                                                    </div>
                                                </div>

                                                {/* Destino */}
                                                <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/60 space-y-1.5">
                                                    <span className="text-[10px] uppercase font-bold text-indigo-700 block tracking-wider">
                                                        Destino (Proposto)
                                                    </span>
                                                    <div className="font-bold text-indigo-950">
                                                        {proposed.targetClientName || detailsModal.request.clientName || "Novo Posto"}
                                                    </div>
                                                    <div className="text-[11px] text-indigo-900">
                                                        Função: <strong>{proposed.targetRoleName || "Mesma Função"}</strong>
                                                    </div>
                                                    <div className="text-[11px] text-indigo-900">
                                                        Escala/Horário: {proposed.targetSchedule || proposed.schedule || "Padrão do Posto"} {proposed.targetHours ? `(${proposed.targetHours})` : ""}
                                                    </div>
                                                    <div className="text-[11px] text-indigo-900">
                                                        Início Efetivo: <strong>{proposed.startDate ? safeFmtDate(proposed.startDate, "dd/MM/yyyy") : "Imediato"}</strong>
                                                    </div>
                                                </div>
                                            </div>

                                            {(proposed.reason || proposed.observation) && (
                                                <div className="text-[11px] bg-white p-2.5 rounded-xl border border-indigo-150 text-slate-700">
                                                    <strong>Motivo / Observação:</strong> {proposed.reason || proposed.observation}
                                                </div>
                                            )}

                                            {/* AUDITORIA DE REMUNERAÇÃO, INSALUBRIDADE E BENEFÍCIOS */}
                                            {(proposed.salaryImpact || proposed.benefitsCompliance || current.insalubridade !== undefined || current.valeAlimentacao !== undefined) && (() => {
                                                const currentIns = Number(current.insalubridade ?? 0);
                                                const targetIns = Number(proposed.salaryImpact?.insalubridade ?? 0);
                                                const currentVA = Number(current.valeAlimentacao ?? 0);
                                                const targetVA = Number(proposed.salaryImpact?.valeAlimentacao ?? 0);
                                                const currentSal = Number(current.baseSalary ?? current.salary ?? 0);
                                                const targetSal = Number(proposed.salaryImpact?.baseSalary ?? 0);
                                                const checklist = Array.isArray(proposed.benefitsChecklist) ? proposed.benefitsChecklist : [];

                                                return (
                                                    <div className="border border-amber-300/80 bg-amber-50/40 p-3.5 rounded-xl space-y-2.5">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <div className="p-1 rounded-md bg-amber-600 text-white shadow-xs">
                                                                    <ShieldCheck className="w-3.5 h-3.5" />
                                                                </div>
                                                                <div>
                                                                    <span className="font-black text-slate-800 text-xs block">
                                                                        Auditoria de Remuneração e Benefícios do Posto
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-500">
                                                                        Validação de adicionais de insalubridade, vale alimentação e regras do contrato.
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full uppercase">
                                                                Trava Ativa
                                                            </span>
                                                        </div>

                                                        {/* Quadro comparativo financeiro */}
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                            {/* Insalubridade */}
                                                            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                                                                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                                                                    Insalubridade
                                                                </span>
                                                                <div className="flex items-center gap-1.5 text-xs mt-0.5">
                                                                    <span className="text-slate-500 line-through text-[11px]">R$ {currentIns.toFixed(2)}</span>
                                                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                                                    <span className={`font-bold ${targetIns === 0 && currentIns > 0 ? "text-rose-600" : targetIns > 0 ? "text-emerald-700" : "text-slate-800"}`}>
                                                                        R$ {targetIns.toFixed(2)}
                                                                    </span>
                                                                </div>
                                                                {currentIns > 0 && targetIns === 0 && (
                                                                    <span className="text-[9px] text-rose-600 font-bold block mt-0.5">
                                                                        Cessada (Posto sem laudo)
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Vale Alimentação */}
                                                            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                                                                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                                                                    Vale Alimentação (VA)
                                                                </span>
                                                                <div className="flex items-center gap-1.5 text-xs mt-0.5">
                                                                    <span className="text-slate-500 line-through text-[11px]">R$ {currentVA.toFixed(2)}</span>
                                                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                                                    <span className={`font-bold ${targetVA !== currentVA ? "text-amber-700" : "text-slate-800"}`}>
                                                                        R$ {targetVA.toFixed(2)}
                                                                    </span>
                                                                </div>
                                                                {targetVA !== currentVA && (
                                                                    <span className="text-[9px] text-amber-700 font-bold block mt-0.5">
                                                                        Ajustado por Contrato
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Salário Base */}
                                                            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                                                                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                                                                    Salário Base
                                                                </span>
                                                                <div className="flex items-center gap-1.5 text-xs mt-0.5">
                                                                    <span className="text-slate-500 line-through text-[11px]">R$ {currentSal.toFixed(2)}</span>
                                                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                                                    <span className="font-bold text-slate-800">
                                                                        R$ {(targetSal > 0 ? targetSal : currentSal).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Checklist validada pelo solicitante */}
                                                        {checklist.length > 0 && (
                                                            <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                                                                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                                                                    Ciência e Conformidade Assinada pelo Solicitante:
                                                                </span>
                                                                <div className="space-y-1">
                                                                    {checklist.map((item: any, idx: number) => (
                                                                        <div key={idx} className="flex items-start gap-1.5 text-[10px] text-slate-700">
                                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                                                            <span>{typeof item === "string" ? item : item.text || item.label}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })()}

                                {/* REGRA DE DESTINO AO SER APROVADO */}
                                <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/50 flex items-start gap-3">
                                    <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 mt-0.5 shrink-0">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <span className="font-bold text-indigo-900 text-xs block">
                                            Comportamento após Aprovação:
                                        </span>
                                        <p className="text-indigo-800 text-xs mt-0.5 leading-relaxed">
                                            {detailsModal.request.type === "MUDANCA_POSTO" || detailsModal.request.type === "MUDANCA_ESCALA" || detailsModal.request.type === "MUDANCA_HORARIO" ? (
                                                <><strong>Movimentação de Posto / Escala:</strong> Ao ser aprovado, o fluxo se <strong>auto-completa imediatamente</strong>, transferindo o colaborador para o novo posto e integrando ao Secullum.</>
                                            ) : detailsModal.request.type === "DESLIGAMENTO" ? (
                                                <><strong>Desligamento:</strong> Ao ser aprovado pela alçada, o processo vai <strong>diretamente para o RH (Kesia)</strong> programar o aviso prévio, exame demissional e cálculos rescisórios.</>
                                            ) : detailsModal.request.type === "FERIAS" ? (
                                                <><strong>Programação de Férias:</strong> Ao ser aprovado, é encaminhado para o <strong>RH (Kesia)</strong> lançar os períodos de gozo, recibo e cobertura.</>
                                            ) : (
                                                <>Ao ser homologado pela Diretoria, é liberado para execução e acompanhamento do RH.</>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* HISTÓRICO COMPLETO DE AUDITORIA */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <CalendarClock className="w-4 h-4 text-slate-600" />
                                        Histórico de Aprovação e Prazos
                                    </h4>

                                    <div className="space-y-2.5">
                                        {/* 1. Abertura */}
                                        <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px] border border-blue-200">
                                                    1
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-800 text-xs block">Abertura do Processo</span>
                                                    <span className="text-[11px] text-slate-500">
                                                        Solicitado por <strong>{detailsModal.request.requesterName}</strong>
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-[11px] font-semibold text-slate-500">
                                                {safeFmtDate(detailsModal.request.createdAt)}
                                            </span>
                                        </div>

                                        {/* 2. Alçada N1 (Gestor) */}
                                        <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] border ${
                                                    detailsModal.request.n1Decision === "APROVADO"
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : detailsModal.request.n1Decision === "REPROVADO"
                                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                                        : detailsModal.request.n1Decision === "SOLICITADA_EXCLUSAO"
                                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                                        : detailsModal.request.n1Required
                                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                                        : "bg-slate-100 text-slate-500 border-slate-200"
                                                }`}>
                                                    2
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-800 text-xs block">Alçada N1 (Gestão Operacional)</span>
                                                    <span className="text-[11px] text-slate-500">
                                                        {detailsModal.request.n1ApproverName ? (
                                                            <>Deliberado por <strong>{detailsModal.request.n1ApproverName}</strong> {detailsModal.request.n1Feedback ? `("${detailsModal.request.n1Feedback}")` : ""}</>
                                                        ) : detailsModal.request.n1Decision === "SOLICITADA_EXCLUSAO" ? (
                                                            <span className="text-rose-600 font-semibold">{detailsModal.request.n1Feedback || "Exclusão solicitada"}</span>
                                                        ) : detailsModal.request.n1Required ? (
                                                            <span className="text-amber-600 font-semibold">Aguardando parecer do Gestor N1</span>
                                                        ) : (
                                                            <span>Dispensado (solicitante é N1 ou ligado direto ao N2)</span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-[11px] font-semibold text-slate-500">
                                                {detailsModal.request.n1ApprovedAt ? safeFmtDate(detailsModal.request.n1ApprovedAt) : (detailsModal.request.n1Required ? "Pendente" : "Dispensado")}
                                            </span>
                                        </div>

                                        {/* 3. Alçada N2 (Diretoria) */}
                                        <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] border ${
                                                    detailsModal.request.n2Decision === "APROVADO"
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : detailsModal.request.n2Decision === "REPROVADO"
                                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                                        : detailsModal.request.status === "PENDENTE_N2"
                                                        ? "bg-purple-50 text-purple-700 border-purple-200"
                                                        : "bg-slate-100 text-slate-400 border-slate-200"
                                                }`}>
                                                    3
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-800 text-xs block">Alçada N2 (Diretoria)</span>
                                                    <span className="text-[11px] text-slate-500">
                                                        {detailsModal.request.n2ApproverName ? (
                                                            <>Deliberado por <strong>{detailsModal.request.n2ApproverName}</strong> {detailsModal.request.n2Feedback ? `("${detailsModal.request.n2Feedback}")` : ""}</>
                                                        ) : detailsModal.request.status === "PENDENTE_N2" ? (
                                                            <span className="text-purple-700 font-semibold">Aguardando deliberação de Cristiano Silva (Diretoria)</span>
                                                        ) : (
                                                            <span className="text-slate-400">Aguardando aprovação N1</span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-[11px] font-semibold text-slate-500">
                                                {detailsModal.request.n2ApprovedAt ? safeFmtDate(detailsModal.request.n2ApprovedAt) : (detailsModal.request.status === "PENDENTE_N2" ? "Pendente N2" : "-")}
                                            </span>
                                        </div>

                                        {/* 4. Conclusão / RH */}
                                        <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] border ${
                                                    detailsModal.request.status === "APROVADO"
                                                        ? "bg-emerald-600 text-white border-emerald-600"
                                                        : detailsModal.request.status === "REPROVADO"
                                                        ? "bg-slate-300 text-slate-600 border-slate-300"
                                                        : "bg-slate-100 text-slate-400 border-slate-200"
                                                }`}>
                                                    4
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-800 text-xs block">Execução / RH</span>
                                                    <span className="text-[11px] text-slate-500">
                                                        {detailsModal.request.status === "APROVADO" ? (
                                                            <span className="text-emerald-700 font-bold">
                                                                {getRhState(detailsModal.request) === "DONE"
                                                                    ? `Concluído por ${detailsModal.request.executionPayload?.rhConclusion?.by || "RH"}${detailsModal.request.executionPayload?.rhConclusion?.note ? ` ("${detailsModal.request.executionPayload.rhConclusion.note}")` : ""}`
                                                                    : getRhState(detailsModal.request) === "NOT_DONE"
                                                                    ? `Não executado por ${detailsModal.request.executionPayload?.rhConclusion?.by || "RH"}: "${detailsModal.request.executionPayload?.rhConclusion?.note || ""}"`
                                                                    : detailsModal.request.type === "MUDANCA_POSTO" 
                                                                    ? "Fluxo auto-completado e posto atualizado no sistema."
                                                                    : "Liberado para o RH programar e efetivar. Use os botões abaixo para concluir."}
                                                            </span>
                                                        ) : detailsModal.request.status === "REPROVADO" ? (
                                                            <span className="text-rose-600 font-medium">Processo reprovado e cancelado.</span>
                                                        ) : (
                                                            <span className="text-slate-400">Aguardando aprovação das alçadas prévias.</span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-[11px] font-semibold text-slate-500">
                                                {detailsModal.request.status === "APROVADO" ? (detailsModal.request.appliedAt ? safeFmtDate(detailsModal.request.appliedAt) : "Liberado Agora") : "-"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Parecer do RH para concluir a execução */}
                                {getRhState(detailsModal.request) === "WAITING" && (
                                    <div className="space-y-2 pt-2 border-t border-slate-100">
                                        <label className="text-xs font-bold text-slate-700">
                                            Observação do RH (obrigatória se não for executada):
                                        </label>
                                        <Textarea
                                            value={rhNote}
                                            onChange={(e) => setRhNote(e.target.value)}
                                            placeholder="Ex: Adicional incluído na folha de outubro."
                                            className="text-xs resize-none h-18 border-slate-200"
                                        />
                                    </div>
                                )}

                                {/* Campo de Parecer para Deliberar */}
                                {(detailsModal.request.status === "PENDENTE_N1" || detailsModal.request.status === "PENDENTE_N2") && detailsModal.request.n1Decision !== "SOLICITADA_EXCLUSAO" && (
                                    <div className="space-y-2 pt-2 border-t border-slate-100">
                                        <label className="text-xs font-bold text-slate-700">
                                            Parecer ou observações da deliberação (opcional):
                                        </label>
                                        <Textarea
                                            value={detailsModal.decisionFeedback}
                                            onChange={(e) => setDetailsModal(prev => ({ ...prev, decisionFeedback: e.target.value }))}
                                            placeholder="Ex: Aprovado conforme alinhado..."
                                            className="text-xs resize-none h-18 border-slate-200"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Footer do Modal */}
                            <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setDetailsModal(prev => ({ ...prev, isOpen: false }))}
                                        className="text-xs font-semibold cursor-pointer"
                                    >
                                        Fechar
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() => handleOpenDeleteModal([detailsModal.request!.id])}
                                        disabled={isPending}
                                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1.5 font-medium cursor-pointer"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        {isApproverN2 ? "Excluir Definitivamente" : "Solicitar Exclusão ao N2"}
                                    </Button>
                                </div>

                                {getRhState(detailsModal.request) === "WAITING" && (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => handleRhConclusion(detailsModal.request!, "NAO_EXECUTADO")}
                                            disabled={isPending}
                                            className="text-xs font-bold text-rose-700 border-rose-200 hover:bg-rose-50 cursor-pointer"
                                        >
                                            <X className="w-3.5 h-3.5 mr-1" />
                                            Não executado
                                        </Button>
                                        <Button
                                            onClick={() => handleRhConclusion(detailsModal.request!, "CONCLUIDO")}
                                            disabled={isPending}
                                            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                                        >
                                            <Check className="w-3.5 h-3.5 mr-1 stroke-[3]" />
                                            Concluir Processo
                                        </Button>
                                    </div>
                                )}

                                {(detailsModal.request.status === "PENDENTE_N1" || detailsModal.request.status === "PENDENTE_N2") && detailsModal.request.n1Decision !== "SOLICITADA_EXCLUSAO" && (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="destructive"
                                            onClick={() => handleExecuteDecision(detailsModal.request!, "REPROVAR", detailsModal.decisionFeedback)}
                                            disabled={isPending}
                                            className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                                        >
                                            <X className="w-3.5 h-3.5 mr-1" />
                                            Reprovar
                                        </Button>

                                        <Button
                                            onClick={() => handleExecuteDecision(detailsModal.request!, "APROVAR", detailsModal.decisionFeedback)}
                                            disabled={isPending}
                                            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                                        >
                                            <Check className="w-3.5 h-3.5 mr-1 stroke-[3]" />
                                            {detailsModal.request.status === "PENDENTE_N1" ? "Aprovar como N1" : "Aprovar e Liberar"}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ══════════════════════════════════════════════════════════
                MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (ALÇADA N2)
            ══════════════════════════════════════════════════════════ */}
            <Dialog open={deleteModal.isOpen} onOpenChange={(open) => !open && setDeleteModal(prev => ({ ...prev, isOpen: false }))}>
                <DialogContent className="max-w-md p-6 bg-white border border-slate-200 shadow-xl rounded-2xl">
                    <DialogHeader>
                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-2 border border-rose-200">
                            <Trash2 className="w-5 h-5" />
                        </div>
                        <DialogTitle className="text-base font-bold text-slate-800">
                            {isApproverN2 
                                ? `Excluir definitivamente ${deleteModal.ids.length === 1 ? "esta solicitação" : `${deleteModal.ids.length} solicitações`}?` 
                                : `Solicitar exclusão de ${deleteModal.ids.length === 1 ? "esta solicitação" : `${deleteModal.ids.length} solicitações`} ao N2?`}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {isApproverN2 ? (
                                <>Como você possui alçada <strong>N2 / Diretoria (Admin)</strong>, os registros serão <strong>excluídos permanentemente</strong> do banco de dados e as auditorias serão gravadas.</>
                            ) : (
                                <>O botão de exclusão está liberado, porém esta solicitação <strong>será encaminhada para o N2 (Diretoria) aprovar</strong>. O status mudará para <span className="font-semibold text-purple-700">Aguardando N2</span>.</>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2 my-4">
                        <label className="text-xs font-bold text-slate-700">
                            Motivo da exclusão (opcional):
                        </label>
                        <Textarea
                            value={deleteModal.reason}
                            onChange={(e) => setDeleteModal(prev => ({ ...prev, reason: e.target.value }))}
                            placeholder="Ex: Solicitação obsoleta, erro de digitação, duplicada..."
                            className="text-xs resize-none h-18 border-slate-200"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <Button
                            variant="outline"
                            onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                            disabled={isPending}
                            className="text-xs font-semibold cursor-pointer"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirmDelete}
                            disabled={isPending}
                            className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            {isApproverN2 ? "Excluir Definitivamente" : "Enviar ao N2"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
