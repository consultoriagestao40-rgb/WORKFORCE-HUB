"use client";

import React, { useState, useTransition } from "react";
import { 
    CheckCircle2, 
    XCircle, 
    Clock, 
    ShieldCheck, 
    UserMinus, 
    Calendar, 
    ArrowRightLeft, 
    Search, 
    Filter, 
    AlertCircle, 
    Check, 
    X, 
    MessageSquare,
    Send,
    Eye,
    Building2,
    Briefcase,
    User,
    RefreshCw
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
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ApprovalRequestItem {
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
    requestedAt: Date;
    snapshotCurrent: any;
    snapshotProposed: any;
    executionPayload: any;
    n1Required: boolean;
    n1ApproverName: string | null;
    n1ApprovedAt: Date | null;
    n1Decision: string | null;
    n1Feedback: string | null;
    n2Required: boolean;
    n2ApproverName: string | null;
    n2ApprovedAt: Date | null;
    n2Decision: string | null;
    n2Feedback: string | null;
    appliedAt: Date | null;
    appliedBy: string | null;
    secullumSynced: boolean;
    secullumSyncedAt: Date | null;
    secullumLog: string | null;
    errorMessage: string | null;
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

export function ApprovalsHub({ initialRequests, metrics: initialMetrics, userRole, userName }: ApprovalsHubProps) {
    const [requests, setRequests] = useState<ApprovalRequestItem[]>(initialRequests);
    const [metrics, setMetrics] = useState(initialMetrics);
    const [selectedTab, setSelectedTab] = useState<string>("PENDING_ALL");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [selectedType, setSelectedType] = useState<string>("ALL");
    const [isPending, startTransition] = useTransition();

    // Modal de Decisão (Aprovar / Reprovar)
    const [decisionModal, setDecisionModal] = useState<{
        isOpen: boolean;
        request: ApprovalRequestItem | null;
        action: "APROVAR" | "REPROVAR";
        feedback: string;
    }>({
        isOpen: false,
        request: null,
        action: "APROVAR",
        feedback: ""
    });

    // Modal de Detalhes
    const [detailsModal, setDetailsModal] = useState<{
        isOpen: boolean;
        request: ApprovalRequestItem | null;
    }>({
        isOpen: false,
        request: null
    });

    // Filtros aplicados
    const filteredRequests = requests.filter(req => {
        // Filtro por Aba
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

        // Filtro por Tipo
        if (selectedType !== "ALL" && req.type !== selectedType) {
            return false;
        }

        // Busca textual
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

    const handleConfirmDecision = () => {
        if (!decisionModal.request) return;
        const req = decisionModal.request;
        const action = decisionModal.action;
        const feedback = decisionModal.feedback.trim();

        if (action === "REPROVAR" && !feedback) {
            toast.error("Por favor, informe a justificativa da reprovação.");
            return;
        }

        startTransition(async () => {
            const res = await processApprovalDecision(req.id, action, feedback);
            if (res.success) {
                toast.success(res.message);
                // Atualiza localmente o request
                setRequests(prev => prev.map(item => {
                    if (item.id === req.id) {
                        return {
                            ...item,
                            status: res.status || (action === "APROVAR" ? (req.n2Required && req.status === "PENDENTE_N1" ? "PENDENTE_N2" : "APROVADO") : "REPROVADO"),
                            n1Decision: req.status === "PENDENTE_N1" ? (action === "APROVAR" ? "APROVADO" : "REPROVADO") : item.n1Decision,
                            n1ApproverName: req.status === "PENDENTE_N1" ? (userName || "Gestor") : item.n1ApproverName,
                            n1Feedback: req.status === "PENDENTE_N1" ? feedback : item.n1Feedback,
                            n2Decision: req.status === "PENDENTE_N2" ? (action === "APROVAR" ? "APROVADO" : "REPROVADO") : item.n2Decision,
                            n2ApproverName: req.status === "PENDENTE_N2" ? (userName || "Diretor") : item.n2ApproverName,
                            n2Feedback: req.status === "PENDENTE_N2" ? feedback : item.n2Feedback,
                        };
                    }
                    return item;
                }));
                setDecisionModal({ isOpen: false, request: null, action: "APROVAR", feedback: "" });
            } else {
                toast.error(res.error || "Erro ao processar solicitação.");
            }
        });
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case "DESLIGAMENTO":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <UserMinus className="w-3.5 h-3.5" />
                        Desligamento
                    </span>
                );
            case "FERIAS":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Calendar className="w-3.5 h-3.5" />
                        Férias
                    </span>
                );
            case "MUDANCA_POSTO":
            case "MUDANCA_ESCALA":
            case "MUDANCA_HORARIO":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        {type === "MUDANCA_POSTO" ? "Mudança de Posto" : type === "MUDANCA_ESCALA" ? "Mudança de Escala" : "Mudança de Horário"}
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-500/10 text-slate-300 border border-slate-500/20">
                        {type}
                    </span>
                );
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "PENDENTE_N1":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                        <Clock className="w-3.5 h-3.5" />
                        Aguardando N1 (Coordenação)
                    </span>
                );
            case "PENDENTE_N2":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Aguardando N2 (Diretoria/RH)
                    </span>
                );
            case "APROVADO":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Aprovado e Efetivado
                    </span>
                );
            case "REPROVADO":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        <XCircle className="w-3.5 h-3.5" />
                        Reprovado
                    </span>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div 
                    onClick={() => setSelectedTab("PENDING_ALL")}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        selectedTab === "PENDING_ALL"
                            ? "bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10" 
                            : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">Total Pendentes</span>
                        <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-black text-white mt-2">{metrics.totalPending}</div>
                    <p className="text-[10px] text-slate-500 mt-1">Aguardando alçada N1/N2</p>
                </div>

                <div 
                    onClick={() => setSelectedTab("PENDENTE_N1")}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        selectedTab === "PENDENTE_N1"
                            ? "bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10" 
                            : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">Pendentes N1</span>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    </div>
                    <div className="text-2xl font-black text-amber-400 mt-2">{metrics.pendingN1}</div>
                    <p className="text-[10px] text-slate-500 mt-1">Coordenação Operacional</p>
                </div>

                <div 
                    onClick={() => setSelectedTab("PENDENTE_N2")}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        selectedTab === "PENDENTE_N2"
                            ? "bg-purple-500/10 border-purple-500/50 shadow-lg shadow-purple-500/10" 
                            : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">Pendentes N2</span>
                        <ShieldCheck className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-black text-purple-400 mt-2">{metrics.pendingN2}</div>
                    <p className="text-[10px] text-slate-500 mt-1">Diretoria e RH Executivo</p>
                </div>

                <div 
                    onClick={() => setSelectedTab("APROVADO")}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        selectedTab === "APROVADO"
                            ? "bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10" 
                            : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">Aprovados</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-black text-emerald-400 mt-2">{metrics.approvedTotal}</div>
                    <p className="text-[10px] text-slate-500 mt-1">Efetivadas no Secullum</p>
                </div>

                <div 
                    onClick={() => setSelectedTab("REPROVADO")}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        selectedTab === "REPROVADO"
                            ? "bg-rose-500/10 border-rose-500/50 shadow-lg shadow-rose-500/10" 
                            : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">Reprovados</span>
                        <XCircle className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="text-2xl font-black text-rose-400 mt-2">{metrics.rejectedTotal}</div>
                    <p className="text-[10px] text-slate-500 mt-1">Encerrados com justificativa</p>
                </div>
            </div>

            {/* Filtros e Barra de Ações */}
            <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar por colaborador, posto, cliente ou solicitante..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                        <option value="ALL">Todos os Tipos</option>
                        <option value="DESLIGAMENTO">Desligamentos</option>
                        <option value="FERIAS">Férias</option>
                        <option value="MUDANCA_POSTO">Mudança de Posto</option>
                        <option value="MUDANCA_HORARIO">Mudança de Horário</option>
                        <option value="MUDANCA_ESCALA">Mudança de Escala</option>
                    </select>
                </div>

                {/* Abas */}
                <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 overflow-x-auto w-full md:w-auto">
                    <button
                        onClick={() => setSelectedTab("PENDING_ALL")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            selectedTab === "PENDING_ALL" ? "bg-amber-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-white"
                        }`}
                    >
                        Pendentes
                    </button>
                    <button
                        onClick={() => setSelectedTab("PENDENTE_N1")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            selectedTab === "PENDENTE_N1" ? "bg-amber-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-white"
                        }`}
                    >
                        N1
                    </button>
                    <button
                        onClick={() => setSelectedTab("PENDENTE_N2")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            selectedTab === "PENDENTE_N2" ? "bg-purple-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                        }`}
                    >
                        N2
                    </button>
                    <button
                        onClick={() => setSelectedTab("APROVADO")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            selectedTab === "APROVADO" ? "bg-emerald-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                        }`}
                    >
                        Aprovadas
                    </button>
                    <button
                        onClick={() => setSelectedTab("REPROVADO")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            selectedTab === "REPROVADO" ? "bg-rose-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                        }`}
                    >
                        Reprovadas
                    </button>
                    <button
                        onClick={() => setSelectedTab("ALL")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            selectedTab === "ALL" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                        }`}
                    >
                        Todas
                    </button>
                </div>
            </div>

            {/* Listagem de Cards de Aprovação */}
            {filteredRequests.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center">
                    <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-white">Nenhuma solicitação encontrada</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Não há registros correspondentes aos filtros selecionados.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredRequests.map(req => {
                        const isPendingAction = req.status === "PENDENTE_N1" || req.status === "PENDENTE_N2";

                        return (
                            <div
                                key={req.id}
                                className="bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-5 transition-all shadow-sm space-y-4"
                            >
                                {/* Header do Card */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/60">
                                    <div className="flex items-center gap-3">
                                        {getTypeBadge(req.type)}
                                        <h3 className="text-sm font-bold text-white">{req.title}</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(req.status)}
                                    </div>
                                </div>

                                {/* Conteúdo e Comparativo Antes x Depois */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Bloco 1: Contexto Operacional */}
                                    <div className="space-y-2 text-xs bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contexto Operacional</div>
                                        {req.employeeName && (
                                            <div className="flex items-center gap-2 text-slate-200">
                                                <User className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                                                <span className="font-semibold truncate">{req.employeeName}</span>
                                            </div>
                                        )}
                                        {req.clientName && (
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                                <span className="truncate">{req.clientName}</span>
                                            </div>
                                        )}
                                        {req.postoName && (
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Briefcase className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                                <span className="truncate">{req.postoName}</span>
                                            </div>
                                        )}
                                        {req.description && (
                                            <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800/40">
                                                "{req.description}"
                                            </p>
                                        )}
                                    </div>

                                    {/* Bloco 2: Antes x Proposto (Visual Snapshot) */}
                                    <div className="md:col-span-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 flex flex-col justify-between">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                            Impacto Proposto ({req.type === "DESLIGAMENTO" ? "Rescisão" : req.type === "FERIAS" ? "Período de Férias" : "Antes ➡️ Depois"})
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                            {req.snapshotCurrent ? (
                                                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                                                    <span className="text-[10px] font-bold text-slate-500 block mb-1">Estado Atual:</span>
                                                    <div className="text-slate-300 text-xs">
                                                        {typeof req.snapshotCurrent === "string" 
                                                            ? req.snapshotCurrent 
                                                            : (req.snapshotCurrent.postoNome || req.snapshotCurrent.horario || JSON.stringify(req.snapshotCurrent))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/40 text-slate-500 text-xs italic">
                                                    Sem estado anterior vinculado
                                                </div>
                                            )}

                                            <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-200">
                                                <span className="text-[10px] font-bold text-emerald-400 block mb-1">Novo Estado Proposto:</span>
                                                <div className="text-xs font-semibold">
                                                    {typeof req.snapshotProposed === "string" 
                                                        ? req.snapshotProposed 
                                                        : (req.snapshotProposed.detalhes || req.snapshotProposed.novoPosto || JSON.stringify(req.snapshotProposed))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Secullum Sync */}
                                        {req.status === "APROVADO" && (
                                            <div className="mt-3 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[11px]">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                                    <span className="text-emerald-400 font-semibold">Ponto (Secullum):</span>
                                                    <span className="text-slate-400">{req.secullumLog || "Sincronizado automaticamente"}</span>
                                                </div>
                                                {req.secullumSyncedAt && (
                                                    <span className="text-slate-500">
                                                        {format(new Date(req.secullumSyncedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Footer com Histórico de Alçadas e Botões de Ação */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-[11px] text-slate-400 border-t border-slate-800/40">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div>
                                            <span className="text-slate-500">Solicitado por:</span>{" "}
                                            <strong className="text-slate-300">{req.requesterName}</strong>{" "}
                                            em {format(new Date(req.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                        </div>

                                        {req.n1ApproverName && (
                                            <div>
                                                <span className="text-slate-500">N1 ({req.n1Decision}):</span>{" "}
                                                <strong className={req.n1Decision === "APROVADO" ? "text-emerald-400" : "text-rose-400"}>
                                                    {req.n1ApproverName}
                                                </strong>
                                                {req.n1Feedback && <span className="text-slate-400 ml-1">({req.n1Feedback})</span>}
                                            </div>
                                        )}

                                        {req.n2ApproverName && (
                                            <div>
                                                <span className="text-slate-500">N2 ({req.n2Decision}):</span>{" "}
                                                <strong className={req.n2Decision === "APROVADO" ? "text-emerald-400" : "text-rose-400"}>
                                                    {req.n2ApproverName}
                                                </strong>
                                                {req.n2Feedback && <span className="text-slate-400 ml-1">({req.n2Feedback})</span>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Ações */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setDetailsModal({ isOpen: true, request: req })}
                                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center gap-1.5 transition-colors"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            Detalhes
                                        </button>

                                        {isPendingAction && (
                                            <>
                                                <button
                                                    onClick={() => setDecisionModal({ isOpen: true, request: req, action: "REPROVAR", feedback: "" })}
                                                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs flex items-center gap-1.5 transition-colors"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                    Reprovar
                                                </button>

                                                <button
                                                    onClick={() => setDecisionModal({ isOpen: true, request: req, action: "APROVAR", feedback: "" })}
                                                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02]"
                                                >
                                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                    {req.status === "PENDENTE_N1" && req.n2Required ? "Aprovar N1" : "Aprovar e Efetivar"}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal de Confirmação de Decisão (Aprovar / Reprovar) */}
            <Dialog open={decisionModal.isOpen} onOpenChange={(open) => setDecisionModal(prev => ({ ...prev, isOpen: open }))}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-bold">
                            {decisionModal.action === "APROVAR" ? (
                                <>
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                    Confirmar Aprovação ({decisionModal.request?.status === "PENDENTE_N1" && decisionModal.request?.n2Required ? "Nível 1" : "Efetivação Final"})
                                </>
                            ) : (
                                <>
                                    <XCircle className="w-5 h-5 text-rose-400" />
                                    Confirmar Reprovação
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            {decisionModal.action === "APROVAR" 
                                ? "Ao aprovar, a solicitação avançará de nível ou terá sua efetivação e integração com o Secullum executadas automaticamente."
                                : "A reprovação encerrará o processo e registrará a justificativa no histórico de auditoria."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                            <span className="text-slate-500 block text-[10px] uppercase font-bold">Solicitação:</span>
                            <span className="font-bold text-white">{decisionModal.request?.title}</span>
                            {decisionModal.request?.employeeName && (
                                <p className="text-slate-400 mt-1">Colaborador: {decisionModal.request.employeeName}</p>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-300 block mb-1">
                                {decisionModal.action === "APROVAR" ? "Parecer / Observações (Opcional):" : "Motivo da Reprovação (Obrigatório):"}
                            </label>
                            <Textarea
                                placeholder={decisionModal.action === "APROVAR" ? "Ex: Aprovado conforme alinhado com a diretoria..." : "Ex: Não aprovado por inviabilidade orçamentária no posto..."}
                                value={decisionModal.feedback}
                                onChange={(e) => setDecisionModal(prev => ({ ...prev, feedback: e.target.value }))}
                                className="bg-slate-950 border-slate-800 text-xs text-white"
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setDecisionModal(prev => ({ ...prev, isOpen: false }))}
                            disabled={isPending}
                            className="bg-transparent border-slate-800 text-slate-300 hover:bg-slate-800"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirmDecision}
                            disabled={isPending}
                            className={decisionModal.action === "APROVAR" ? "bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold" : "bg-rose-500 hover:bg-rose-600 text-white font-bold"}
                        >
                            {isPending ? "Processando..." : decisionModal.action === "APROVAR" ? "Confirmar Aprovação" : "Confirmar Reprovação"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Detalhes Técnicos e Auditoria */}
            <Dialog open={detailsModal.isOpen} onOpenChange={(open) => setDetailsModal(prev => ({ ...prev, isOpen: open }))}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <Eye className="w-5 h-5 text-indigo-400" />
                            Detalhes da Solicitação de Aprovação
                        </DialogTitle>
                    </DialogHeader>

                    {detailsModal.request && (
                        <div className="space-y-4 py-2 text-xs">
                            <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
                                <div>
                                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Tipo:</span>
                                    <span className="font-semibold text-slate-200">{detailsModal.request.type}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Status:</span>
                                    <span className="font-semibold text-amber-400">{detailsModal.request.status}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Solicitante:</span>
                                    <span className="text-slate-300">{detailsModal.request.requesterName}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Data/Hora:</span>
                                    <span className="text-slate-300">{format(new Date(detailsModal.request.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</span>
                                </div>
                            </div>

                            {/* Payload de Execução */}
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                    Parâmetros de Execução Automática (Payload):
                                </span>
                                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-indigo-300 overflow-x-auto">
                                    {JSON.stringify(detailsModal.request.executionPayload, null, 2)}
                                </pre>
                            </div>

                            {/* Log Secullum */}
                            {detailsModal.request.secullumLog && (
                                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                                        Retorno do Secullum Ponto:
                                    </span>
                                    <p className="text-slate-300">{detailsModal.request.secullumLog}</p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
