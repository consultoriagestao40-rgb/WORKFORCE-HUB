"use client";

import React, { useState, useTransition } from "react";
import {
    Calendar,
    Clock,
    AlertTriangle,
    CheckCircle2,
    FileText,
    DollarSign,
    Send,
    UserCheck,
    UserX,
    Building2,
    Briefcase,
    Search,
    Printer,
    ArrowRight,
    Ban,
    Filter,
    HelpCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
    VacationProcessItem,
    VacationWorkflowMetrics,
    updateVacationWorkflowStep
} from "@/actions/vacation-workflow";
import { VacationNoticePrintDialog } from "@/components/admin/VacationNoticePrintDialog";

interface VacationProcessTableProps {
    processes: VacationProcessItem[];
    metrics: VacationWorkflowMetrics;
}

export function VacationProcessTable({
    processes: initialProcesses,
    metrics: initialMetrics
}: VacationProcessTableProps) {
    const [processes, setProcesses] = useState<VacationProcessItem[]>(initialProcesses);
    const [metrics, setMetrics] = useState<VacationWorkflowMetrics>(initialMetrics);
    const [selectedTab, setSelectedTab] = useState<string>("ALL");
    const [searchTerm, setSearchTerm] = useState("");
    const [isPending, startTransition] = useTransition();

    // Print Modal State
    const [printModalId, setPrintModalId] = useState<string | null>(null);

    // Action Modal State (Payment, Cancel, etc.)
    const [actionModal, setActionModal] = useState<{
        isOpen: boolean;
        vacation: VacationProcessItem | null;
        action: "SEND_TO_ACCOUNTING" | "SIGN_NOTICE" | "CONFIRM_PAYMENT" | "CONFIRM_RETURN" | "CANCEL" | null;
        receiptAmount: string;
        paymentNotes: string;
        cancellationReason: string;
    }>({
        isOpen: false,
        vacation: null,
        action: null,
        receiptAmount: "",
        paymentNotes: "",
        cancellationReason: ""
    });

    // Filtros
    const filteredProcesses = processes.filter(p => {
        if (selectedTab === "ACCOUNTING" && p.sentToAccounting) return false;
        if (selectedTab === "NOTICE" && (p.noticeSigned || p.status === "RETORNADO" || p.status === "CANCELADO")) return false;
        if (selectedTab === "PAYMENT" && (p.paymentConfirmed || p.status === "RETORNADO" || p.status === "CANCELADO")) return false;
        if (selectedTab === "IN_PROGRESS" && p.status !== "EM_GOZO") return false;
        if (selectedTab === "COMPLETED" && !p.returnedToWork && p.status !== "RETORNADO") return false;

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            const matchName = p.employeeName.toLowerCase().includes(term);
            const matchCpf = p.cpf.includes(term);
            const matchClient = p.clientName.toLowerCase().includes(term);
            const matchRole = p.roleName.toLowerCase().includes(term);
            if (!matchName && !matchCpf && !matchClient && !matchRole) return false;
        }

        return true;
    });

    const handleExecuteAction = () => {
        if (!actionModal.vacation || !actionModal.action) return;

        const { vacation, action, receiptAmount, paymentNotes, cancellationReason } = actionModal;

        startTransition(async () => {
            try {
                const res = await updateVacationWorkflowStep({
                    vacationId: vacation.id,
                    action,
                    data: {
                        receiptAmount: receiptAmount ? parseFloat(receiptAmount.replace(",", ".")) : undefined,
                        paymentNotes: paymentNotes || undefined,
                        cancellationReason: cancellationReason || undefined
                    }
                });

                if (res.success) {
                    toast.success(res.message);
                    setActionModal({
                        isOpen: false,
                        vacation: null,
                        action: null,
                        receiptAmount: "",
                        paymentNotes: "",
                        cancellationReason: ""
                    });

                    // Atualiza localmente o item para feedback instantâneo
                    setProcesses(prev => prev.map(item => {
                        if (item.id === vacation.id) {
                            if (action === "SEND_TO_ACCOUNTING") {
                                return { ...item, sentToAccounting: true, status: "CONTABILIDADE", statusLabel: "Em Processamento (Contabilidade/DP)" };
                            }
                            if (action === "SIGN_NOTICE") {
                                return { ...item, noticeSigned: true, status: "AVISO_ASSINADO", statusLabel: "Aviso Assinado (Aguardando Pagamento)" };
                            }
                            if (action === "CONFIRM_PAYMENT") {
                                return {
                                    ...item,
                                    paymentConfirmed: true,
                                    receiptAmount: receiptAmount ? parseFloat(receiptAmount.replace(",", ".")) : item.receiptAmount,
                                    paymentNotes: paymentNotes || item.paymentNotes,
                                    status: "PAGO",
                                    statusLabel: "Pago (Aguardando Início)"
                                };
                            }
                            if (action === "CONFIRM_RETURN") {
                                return { ...item, returnedToWork: true, status: "RETORNADO", statusLabel: "Concluída (Retorno OK)" };
                            }
                            if (action === "CANCEL") {
                                return { ...item, status: "CANCELADO", statusLabel: "Cancelada" };
                            }
                        }
                        return item;
                    }));
                }
            } catch (err: any) {
                toast.error(err.message || "Erro ao processar ação.");
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* 1. Métrica Cards de Alta Visibilidade */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div 
                    onClick={() => setSelectedTab("ALL")}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        selectedTab === "ALL" 
                            ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200" 
                            : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
                    }`}
                >
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Total Programadas
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-slate-900">{metrics.totalProcesses}</span>
                        <span className="text-xs text-slate-500">processos</span>
                    </div>
                </div>

                <div 
                    onClick={() => setSelectedTab("ACCOUNTING")}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        selectedTab === "ACCOUNTING" 
                            ? "bg-amber-50 border-amber-300 ring-2 ring-amber-200" 
                            : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
                    }`}
                >
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
                        Pendente Envio DP
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-amber-700">{metrics.pendingAccounting}</span>
                        <span className="text-xs text-amber-600">p/ folha</span>
                    </div>
                </div>

                <div 
                    onClick={() => setSelectedTab("NOTICE")}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        selectedTab === "NOTICE" 
                            ? "bg-purple-50 border-purple-300 ring-2 ring-purple-200" 
                            : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
                    }`}
                >
                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">
                        Coletar Assinatura
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-purple-700">{metrics.pendingNoticeSignature}</span>
                        <span className="text-xs text-purple-600">aviso prévio</span>
                    </div>
                </div>

                <div 
                    onClick={() => setSelectedTab("PAYMENT")}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        selectedTab === "PAYMENT" 
                            ? "bg-rose-50 border-rose-300 ring-2 ring-rose-200" 
                            : metrics.criticalPayment > 0 
                                ? "bg-rose-50/60 border-rose-200 hover:border-rose-300 shadow-xs"
                                : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
                            Pagar (D-2 CLT)
                        </span>
                        {metrics.criticalPayment > 0 && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        )}
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-rose-700">{metrics.pendingPayment}</span>
                        {metrics.criticalPayment > 0 && (
                            <span className="text-[11px] font-bold text-rose-600">({metrics.criticalPayment} urgentes)</span>
                        )}
                    </div>
                </div>

                <div 
                    onClick={() => setSelectedTab("IN_PROGRESS")}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        selectedTab === "IN_PROGRESS" 
                            ? "bg-blue-50 border-blue-300 ring-2 ring-blue-200" 
                            : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
                    }`}
                >
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                        Em Gozo de Férias
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-blue-700">{metrics.currentlyOnVacation}</span>
                        <span className="text-xs text-blue-600">afastados</span>
                    </div>
                </div>

                <div 
                    onClick={() => setSelectedTab("COMPLETED")}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        selectedTab === "COMPLETED" 
                            ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200" 
                            : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
                    }`}
                >
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                        Retornos / Concluídas
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-emerald-700">{metrics.completed}</span>
                        <span className="text-xs text-emerald-600">finalizadas</span>
                    </div>
                </div>
            </div>

            {/* 2. Barra de Busca e Filtros Rápidos */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por colaborador, CPF, posto ou cargo..."
                        className="pl-9 bg-slate-50 border-slate-200 text-sm h-9"
                    />
                </div>

                {/* Sub-abas de filtro */}
                <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                    {[
                        { key: "ALL", label: "Todas" },
                        { key: "ACCOUNTING", label: "1. Enviar DP" },
                        { key: "NOTICE", label: "2. Assinar Aviso" },
                        { key: "PAYMENT", label: "3. Pagar (D-2)" },
                        { key: "IN_PROGRESS", label: "4. Em Gozo" },
                        { key: "COMPLETED", label: "5. Retornados" }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setSelectedTab(tab.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                selectedTab === tab.key
                                    ? "bg-slate-900 text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. Tabela Operacional da Esteira */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3.5">Colaborador / Contrato</th>
                                <th className="px-4 py-3.5">Período de Gozo</th>
                                <th className="px-4 py-3.5">Prazo Limite Pagamento (Art. 145 CLT)</th>
                                <th className="px-4 py-3.5 text-center">Status da Esteira</th>
                                <th className="px-4 py-3.5 text-center">Ações Operacionais</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                            {filteredProcesses.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-400">
                                        Nenhuma solicitação ou processo de férias encontrado para os filtros selecionados.
                                    </td>
                                </tr>
                            ) : (
                                filteredProcesses.map(proc => {
                                    return (
                                        <tr key={proc.id} className="hover:bg-slate-50/80 transition-colors">
                                            {/* 1. Colaborador */}
                                            <td className="px-4 py-3.5">
                                                <div className="font-bold text-slate-900 text-sm">
                                                    {proc.employeeName}
                                                </div>
                                                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                                    CPF: {proc.cpf} • {proc.roleName}
                                                </div>
                                                <div className="text-[11px] text-slate-600 font-medium flex items-center gap-1 mt-0.5">
                                                    <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                                    <span>{proc.clientName}</span>
                                                    <span className="text-slate-400">•</span>
                                                    <span className="text-slate-500">{proc.postoSchedule}</span>
                                                </div>
                                                {proc.notes && (
                                                    <div className="text-[10px] text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100 mt-1 max-w-sm truncate" title={proc.notes}>
                                                        Obs: {proc.notes}
                                                    </div>
                                                )}
                                            </td>

                                            {/* 2. Período de Gozo */}
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                    <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                    <span>{proc.startDateFormatted} a {proc.endDateFormatted}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                                    <strong>{proc.daysTaken} dias</strong> de gozo
                                                    {proc.daysSold > 0 && (
                                                        <span className="text-amber-700 ml-1">
                                                            (+{proc.daysSold}d abono/venda)
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    Aviso mín: {proc.noticeDeadline}
                                                </div>
                                            </td>

                                            {/* 3. Prazo de Pagamento (Art. 145 CLT: 2 dias antes) */}
                                            <td className="px-4 py-3.5">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-slate-800">
                                                            {proc.paymentDeadlineFormatted}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500">(D-2 dias)</span>
                                                    </div>

                                                    {proc.paymentConfirmed ? (
                                                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                            <span>Pago {proc.receiptAmount ? `(R$ ${proc.receiptAmount.toFixed(2)})` : ""}</span>
                                                        </div>
                                                    ) : proc.isPaymentLate ? (
                                                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold animate-pulse">
                                                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                                                            <span>PAGAMENTO VENCIDO! ({Math.abs(proc.paymentDaysRemaining)}d de atraso)</span>
                                                        </div>
                                                    ) : proc.isPaymentUrgent ? (
                                                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                                            <Clock className="w-3 h-3 text-amber-600" />
                                                            <span>Vence em {proc.paymentDaysRemaining} dia(s)</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-[11px] text-slate-500">
                                                            Faltam {proc.paymentDaysRemaining} dias para o prazo
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 4. Stepper / Checklist Visual */}
                                            <td className="px-4 py-3.5 text-center">
                                                <div className="inline-flex flex-col items-center gap-1">
                                                    <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                                                        proc.status === "RETORNADO" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                                                        proc.status === "EM_GOZO" ? "bg-blue-100 text-blue-800 border border-blue-200" :
                                                        proc.status === "PAGO" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                                        proc.status === "AVISO_ASSINADO" ? "bg-purple-100 text-purple-800 border border-purple-200" :
                                                        proc.status === "CONTABILIDADE" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                                                        "bg-slate-100 text-slate-700 border border-slate-200"
                                                    }`}>
                                                        {proc.statusLabel}
                                                    </span>

                                                    {/* Marcadores rápidos */}
                                                    <div className="flex items-center justify-center gap-1 mt-1 text-[10px]">
                                                        <span 
                                                            title={proc.sentToAccounting ? "Enviado ao DP/Contabilidade" : "Pendente envio ao DP"}
                                                            className={`px-1.5 py-0.5 rounded ${proc.sentToAccounting ? "bg-emerald-100 text-emerald-800 font-bold" : "bg-slate-100 text-slate-400"}`}
                                                        >
                                                            DP
                                                        </span>
                                                        <span className="text-slate-300">→</span>
                                                        <span 
                                                            title={proc.noticeSigned ? "Aviso de Férias Assinado" : "Pendente assinatura do aviso"}
                                                            className={`px-1.5 py-0.5 rounded ${proc.noticeSigned ? "bg-emerald-100 text-emerald-800 font-bold" : "bg-slate-100 text-slate-400"}`}
                                                        >
                                                            Aviso
                                                        </span>
                                                        <span className="text-slate-300">→</span>
                                                        <span 
                                                            title={proc.paymentConfirmed ? "Pagamento Realizado" : "Pendente pagamento"}
                                                            className={`px-1.5 py-0.5 rounded ${proc.paymentConfirmed ? "bg-emerald-100 text-emerald-800 font-bold" : "bg-slate-100 text-slate-400"}`}
                                                        >
                                                            Pgto
                                                        </span>
                                                        <span className="text-slate-300">→</span>
                                                        <span 
                                                            title={proc.returnedToWork ? "Retorno Confirmado ao Posto" : "Aguardando retorno"}
                                                            className={`px-1.5 py-0.5 rounded ${proc.returnedToWork ? "bg-emerald-100 text-emerald-800 font-bold" : "bg-slate-100 text-slate-400"}`}
                                                        >
                                                            Retorno
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* 5. Ações Rápidas do RH */}
                                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {/* Imprimir Aviso Formal */}
                                                    <button
                                                        onClick={() => setPrintModalId(proc.id)}
                                                        title="Imprimir Comunicado de Aviso de Férias (Art. 135 CLT)"
                                                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 cursor-pointer"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                    </button>

                                                    {/* Ação contextual baseada no próximo passo pendente */}
                                                    {!proc.sentToAccounting ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setActionModal({
                                                                isOpen: true,
                                                                vacation: proc,
                                                                action: "SEND_TO_ACCOUNTING",
                                                                receiptAmount: "",
                                                                paymentNotes: "",
                                                                cancellationReason: ""
                                                            })}
                                                            className="h-7 text-xs px-2.5 bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                                                        >
                                                            <Send className="w-3 h-3 mr-1" />
                                                            Enviar DP
                                                        </Button>
                                                    ) : !proc.noticeSigned ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setActionModal({
                                                                isOpen: true,
                                                                vacation: proc,
                                                                action: "SIGN_NOTICE",
                                                                receiptAmount: "",
                                                                paymentNotes: "",
                                                                cancellationReason: ""
                                                            })}
                                                            className="h-7 text-xs px-2.5 bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100"
                                                        >
                                                            <FileText className="w-3 h-3 mr-1" />
                                                            Aviso Assinado
                                                        </Button>
                                                    ) : !proc.paymentConfirmed ? (
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            onClick={() => setActionModal({
                                                                isOpen: true,
                                                                vacation: proc,
                                                                action: "CONFIRM_PAYMENT",
                                                                receiptAmount: proc.receiptAmount ? String(proc.receiptAmount) : "",
                                                                paymentNotes: proc.paymentNotes || "",
                                                                cancellationReason: ""
                                                            })}
                                                            className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                                        >
                                                            <DollarSign className="w-3 h-3 mr-1" />
                                                            Confirmar Pgto
                                                        </Button>
                                                    ) : !proc.returnedToWork ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setActionModal({
                                                                isOpen: true,
                                                                vacation: proc,
                                                                action: "CONFIRM_RETURN",
                                                                receiptAmount: "",
                                                                paymentNotes: "",
                                                                cancellationReason: ""
                                                            })}
                                                            className="h-7 text-xs px-2.5 bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100"
                                                        >
                                                            <UserCheck className="w-3 h-3 mr-1" />
                                                            Confirmar Retorno
                                                        </Button>
                                                    ) : (
                                                        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            Concluído
                                                        </span>
                                                    )}

                                                    {/* Cancelar Férias */}
                                                    {proc.status !== "RETORNADO" && proc.status !== "CANCELADO" && (
                                                        <button
                                                            onClick={() => setActionModal({
                                                                isOpen: true,
                                                                vacation: proc,
                                                                action: "CANCEL",
                                                                receiptAmount: "",
                                                                paymentNotes: "",
                                                                cancellationReason: ""
                                                            })}
                                                            title="Cancelar programação de férias"
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                                        >
                                                            <Ban className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
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

            {/* Modal de Impressão do Comunicado de Férias */}
            <VacationNoticePrintDialog
                vacationId={printModalId}
                isOpen={!!printModalId}
                onClose={() => setPrintModalId(null)}
            />

            {/* Modal de Ação da Esteira (Confirmar Pagamento, Assinatura, Retorno, etc.) */}
            <Dialog 
                open={actionModal.isOpen} 
                onOpenChange={(open) => !open && setActionModal(prev => ({ ...prev, isOpen: false }))}
            >
                <DialogContent className="max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-slate-800">
                            {actionModal.action === "SEND_TO_ACCOUNTING" && "Marcar Envio ao DP / Contabilidade"}
                            {actionModal.action === "SIGN_NOTICE" && "Registrar Assinatura do Aviso de Férias"}
                            {actionModal.action === "CONFIRM_PAYMENT" && "Confirmar Pagamento de Férias (Art. 145 CLT)"}
                            {actionModal.action === "CONFIRM_RETURN" && "Confirmar Retorno do Colaborador ao Posto"}
                            {actionModal.action === "CANCEL" && "Cancelar Programação de Férias"}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Colaborador: <strong>{actionModal.vacation?.employeeName}</strong>
                            <br />
                            Período: {actionModal.vacation?.startDateFormatted} a {actionModal.vacation?.endDateFormatted}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-xs">
                        {actionModal.action === "SEND_TO_ACCOUNTING" && (
                            <p className="text-slate-600">
                                Confirma que as datas deste período foram transmitidas ao Departamento Pessoal / Contabilidade para cálculo do recibo no Onvio/Domínio?
                            </p>
                        )}

                        {actionModal.action === "SIGN_NOTICE" && (
                            <p className="text-slate-600">
                                Confirma que o comunicado de aviso de férias de 30 dias foi apresentado e assinado pelo colaborador?
                            </p>
                        )}

                        {actionModal.action === "CONFIRM_PAYMENT" && (
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-xs font-semibold text-slate-700">Valor Líquido Quitado (R$)</Label>
                                    <Input
                                        value={actionModal.receiptAmount}
                                        onChange={(e) => setActionModal(prev => ({ ...prev, receiptAmount: e.target.value }))}
                                        placeholder="Ex: 2540.80"
                                        className="h-8 text-xs mt-1"
                                    />
                                    <span className="text-[10px] text-slate-400">Remuneração do período + 1/3 constitucional</span>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-slate-700">Observações / Comprovante</Label>
                                    <Textarea
                                        value={actionModal.paymentNotes}
                                        onChange={(e) => setActionModal(prev => ({ ...prev, paymentNotes: e.target.value }))}
                                        placeholder="Número do lote bancário ou nota de pagamento..."
                                        className="text-xs min-h-[60px] mt-1"
                                    />
                                </div>
                            </div>
                        )}

                        {actionModal.action === "CONFIRM_RETURN" && (
                            <p className="text-slate-600">
                                Confirma que o colaborador reassumiu suas atividades regulares no posto <strong>{actionModal.vacation?.clientName}</strong> e a integração de retorno no ponto está validada?
                            </p>
                        )}

                        {actionModal.action === "CANCEL" && (
                            <div>
                                <Label className="text-xs font-semibold text-slate-700">Motivo do Cancelamento</Label>
                                <Textarea
                                    value={actionModal.cancellationReason}
                                    onChange={(e) => setActionModal(prev => ({ ...prev, cancellationReason: e.target.value }))}
                                    placeholder="Ex: Mudança de escala, necessidade operacional ou solicitação do cliente..."
                                    className="text-xs min-h-[70px] mt-1"
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
                            disabled={isPending}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleExecuteAction}
                            disabled={isPending}
                            className={actionModal.action === "CANCEL" ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"}
                        >
                            {isPending ? "Processando..." : "Confirmar Etapa"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
