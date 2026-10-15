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
    ArrowRightLeft
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { processApprovalDecision } from "@/actions/approvals";
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
    userName
}: ApprovalsHubProps) {
    const [requests, setRequests] = useState<ApprovalRequestItem[]>(initialRequests);
    const [metrics, setMetrics] = useState(initialMetrics);
    const [selectedTab, setSelectedTab] = useState<string>("PENDING_ALL");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedType, setSelectedType] = useState<string>("ALL");
    const [isPending, startTransition] = useTransition();

    // Modal de Detalhes e Ações
    const [detailsModal, setDetailsModal] = useState<{
        isOpen: boolean;
        request: ApprovalRequestItem | null;
        decisionFeedback: string;
    }>({
        isOpen: false,
        request: null,
        decisionFeedback: ""
    });

    // Filtros
    const filteredRequests = requests.filter(req => {
        if (selectedTab === "PENDING_ALL") {
            if (req.status !== "PENDENTE_N1" && req.status !== "PENDENTE_N2") return false;
        } else if (selectedTab === "PENDENTE_N1") {
            if (req.status !== "PENDENTE_N1") return false;
        } else if (selectedTab === "PENDENTE_N2") {
            if (req.status !== "PENDENTE_N2") return false;
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
            const matchEmp = req.employeeName?.toLowerCase().includes(term);
            const matchCli = req.clientName?.toLowerCase().includes(term);
            const matchReq = req.requesterName?.toLowerCase().includes(term);
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

    const getStatusBadge = (status: string) => {
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

            {/* ══════════════════════════════════════════════════════════
                TABELA BÁSICA E LIMPA (PADRÃO SOLICITADO PELO USUÁRIO)
                Colunas: Solicitante | Data | Tipo | Colaborador | Status | Ações
            ══════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                            <tr>
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
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
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
                                                    {req.employeeName || req.title}
                                                </div>
                                                <div className="text-[11px] text-slate-500 font-normal">
                                                    {req.clientName || "Geral"} {req.postoName ? `• ${req.postoName}` : ""}
                                                </div>
                                            </td>

                                            {/* 5. Status da Alçada */}
                                            <td className="px-4 py-3 text-center">
                                                {getStatusBadge(req.status)}
                                            </td>

                                            {/* 6. Ações */}
                                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => setDetailsModal({ isOpen: true, request: req, decisionFeedback: "" })}
                                                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors border border-slate-200/80"
                                                >
                                                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                                                    Detalhes
                                                </button>
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
                                    {getStatusBadge(detailsModal.request.status)}
                                </div>
                            </div>

                            {/* Informações Detalhadas */}
                            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
                                {/* Informações Básicas em Cards Limpos */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Colaborador</span>
                                        <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">
                                            {detailsModal.request.employeeName || "Não especificado"}
                                        </span>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cliente / Contrato</span>
                                        <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">
                                            {detailsModal.request.clientName || "Geral"}
                                        </span>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tipo de Solicitação</span>
                                        <span className="mt-1 block">
                                            {getTypeBadge(detailsModal.request.type)}
                                        </span>
                                    </div>
                                </div>

                                {/* Justificativa da Solicitação */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                        Motivo / Justificativa da Solicitação
                                    </span>
                                    <p className="text-xs text-slate-800 leading-relaxed pt-0.5">
                                        {detailsModal.request.description || "Nenhuma observação informada."}
                                    </p>
                                </div>

                                {/* ══════════════════════════════════════════════════════════
                                    REGRA DE DESTINO AO SER APROVADO
                                ══════════════════════════════════════════════════════════ */}
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

                                {/* ══════════════════════════════════════════════════════════
                                    HISTÓRICO COMPLETO DE AUDITORIA
                                ══════════════════════════════════════════════════════════ */}
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
                                                                {detailsModal.request.type === "MUDANCA_POSTO" 
                                                                    ? "Fluxo auto-completado e posto atualizado no sistema."
                                                                    : "Liberado para o RH (Kesia) programar e efetivar."}
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

                                {/* Campo de Parecer para Deliberar */}
                                {(detailsModal.request.status === "PENDENTE_N1" || detailsModal.request.status === "PENDENTE_N2") && (
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
                                <Button
                                    variant="outline"
                                    onClick={() => setDetailsModal(prev => ({ ...prev, isOpen: false }))}
                                    className="text-xs font-semibold"
                                >
                                    Fechar
                                </Button>

                                {(detailsModal.request.status === "PENDENTE_N1" || detailsModal.request.status === "PENDENTE_N2") && (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="destructive"
                                            onClick={() => handleExecuteDecision(detailsModal.request!, "REPROVAR", detailsModal.decisionFeedback)}
                                            disabled={isPending}
                                            className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
                                        >
                                            <X className="w-3.5 h-3.5 mr-1" />
                                            Reprovar
                                        </Button>

                                        <Button
                                            onClick={() => handleExecuteDecision(detailsModal.request!, "APROVAR", detailsModal.decisionFeedback)}
                                            disabled={isPending}
                                            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
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
        </div>
    );
}
