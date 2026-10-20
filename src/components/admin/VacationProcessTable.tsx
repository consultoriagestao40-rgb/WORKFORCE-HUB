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
    Building2,
    Search,
    Printer,
    Ban,
    CreditCard,
    Mail,
    RefreshCw,
    ExternalLink,
    HelpCircle,
    Smartphone,
    UploadCloud,
    FileUp,
    FileCheck,
    Eye,
    Download
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
    sendVacationAccountingEmail,
    sendVacationNoticeToAutentique,
    createContaAzulPayableAction,
    syncContaAzulPayableAction,
    updateVacationWorkflowStep,
    saveAccountingReturnAction
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
    const [selectedPhase, setSelectedPhase] = useState<"ALL" | "TRATATIVAS" | "PAGAMENTO" | "GOZO" | "RETORNO">("TRATATIVAS");
    const [searchTerm, setSearchTerm] = useState("");
    const [isPending, startTransition] = useTransition();

    // Modais
    const [printModalId, setPrintModalId] = useState<string | null>(null);

    // Modal E-mail Contabilidade
    const [emailModal, setEmailModal] = useState<{
        isOpen: boolean;
        vacation: VacationProcessItem | null;
        recipientEmail: string;
        customNotes: string;
    }>({
        isOpen: false,
        vacation: null,
        recipientEmail: "contabilidade@grupojvsserv.com.br",
        customNotes: ""
    });

    // Modal Retorno da Contabilidade (Arquivo com Valores R$)
    const [accountingReturnModal, setAccountingReturnModal] = useState<{
        isOpen: boolean;
        vacation: VacationProcessItem | null;
        amount: string;
        fileName: string | null;
        fileBase64: string | null;
        fileSizeFormatted: string | null;
        notes: string;
    }>({
        isOpen: false,
        vacation: null,
        amount: "",
        fileName: null,
        fileBase64: null,
        fileSizeFormatted: null,
        notes: ""
    });

    // Modal Pré-visualização de Documento PDF
    const [previewDocModal, setPreviewDocModal] = useState<{
        isOpen: boolean;
        title: string;
        url: string | null;
    }>({
        isOpen: false,
        title: "",
        url: null
    });

    // Modal Conta Azul
    const [contaAzulModal, setContaAzulModal] = useState<{
        isOpen: boolean;
        vacation: VacationProcessItem | null;
        amount: string;
        notes: string;
    }>({
        isOpen: false,
        vacation: null,
        amount: "",
        notes: ""
    });

    // Modal Histórico do Card
    const [historyModal, setHistoryModal] = useState<{
        isOpen: boolean;
        vacation: VacationProcessItem | null;
    }>({
        isOpen: false,
        vacation: null
    });

    // Filtros por Fase
    const filteredProcesses = processes.filter(p => {
        if (selectedPhase === "TRATATIVAS" && p.phase !== "TRATATIVAS_DP") return false;
        if (selectedPhase === "PAGAMENTO" && p.phase !== "AGUARDANDO_PAGAMENTO") return false;
        if (selectedPhase === "GOZO" && p.phase !== "EM_GOZO") return false;
        if (selectedPhase === "RETORNO" && p.phase !== "RETORNO_CONCLUIDO") return false;

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

    // ── AÇÕES DE AUTOMAÇÃO ──────────────────────────────────────────

    // 1. Enviar E-mail para Contabilidade
    const handleSendEmail = () => {
        const targetVacation = emailModal.vacation;
        const targetEmail = emailModal.recipientEmail;
        if (!targetVacation || !targetEmail) return;

        startTransition(async () => {
            try {
                const res = await sendVacationAccountingEmail({
                    vacationId: targetVacation.id,
                    recipientEmail: targetEmail,
                    customNotes: emailModal.customNotes
                });

                if (res.success) {
                    toast.success(res.message);
                    setEmailModal(prev => ({ ...prev, isOpen: false }));

                    setProcesses(prev => prev.map(item => {
                        if (item.id === targetVacation.id) {
                            return {
                                ...item,
                                sentToAccounting: true,
                                accountingEmailSent: {
                                    sentAt: new Date().toISOString(),
                                    toEmail: emailModal.recipientEmail,
                                    subject: `[FÉRIAS] ${item.employeeName}`,
                                    sentBy: "DP",
                                    notes: emailModal.customNotes
                                }
                            };
                        }
                        return item;
                    }));
                }
            } catch (err: any) {
                toast.error(err.message || "Erro ao enviar e-mail.");
            }
        });
    };

    // 2. Retorno da Contabilidade: Anexar Documento Oficial com Valores R$
    const handleOpenAccountingReturnModal = (vacation: VacationProcessItem) => {
        const currentAmount = vacation.receiptAmount 
            ? vacation.receiptAmount.toFixed(2)
            : "";

        setAccountingReturnModal({
            isOpen: true,
            vacation,
            amount: currentAmount,
            fileName: vacation.accountingFileName || null,
            fileBase64: vacation.accountingFileUrl || null,
            fileSizeFormatted: null,
            notes: vacation.accountingReturnNotes || ""
        });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== "application/pdf") {
            toast.error("Por favor, selecione um arquivo em formato PDF emitido pela contabilidade.");
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error("O arquivo deve ter no máximo 10MB.");
            return;
        }

        const sizeKb = (file.size / 1024).toFixed(0);
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            setAccountingReturnModal(prev => ({
                ...prev,
                fileName: file.name,
                fileBase64: result,
                fileSizeFormatted: `${sizeKb} KB`
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleSaveAccountingReturn = () => {
        const targetVacation = accountingReturnModal.vacation;
        if (!targetVacation) return;

        const numAmount = parseFloat(accountingReturnModal.amount.replace(/\./g, "").replace(",", "."));
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error("Informe o valor líquido apurado pela contabilidade.");
            return;
        }

        startTransition(async () => {
            try {
                const res = await saveAccountingReturnAction({
                    vacationId: targetVacation.id,
                    receiptAmount: numAmount,
                    fileBase64: accountingReturnModal.fileBase64 || undefined,
                    fileName: accountingReturnModal.fileName || undefined,
                    notes: accountingReturnModal.notes || undefined
                });

                if (res.success) {
                    toast.success(res.message);
                    setAccountingReturnModal(prev => ({ ...prev, isOpen: false }));

                    setProcesses(prev => prev.map(item => {
                        if (item.id === targetVacation.id) {
                            return {
                                ...item,
                                receiptAmount: numAmount,
                                hasAccountingFile: !!accountingReturnModal.fileBase64 || item.hasAccountingFile,
                                accountingFileName: accountingReturnModal.fileName || item.accountingFileName,
                                accountingFileUrl: accountingReturnModal.fileBase64 || item.accountingFileUrl,
                                accountingReturnReceivedAt: new Date().toISOString(),
                                accountingReturnNotes: accountingReturnModal.notes || null
                            };
                        }
                        return item;
                    }));
                }
            } catch (err: any) {
                toast.error(err.message || "Erro ao salvar retorno da contabilidade.");
            }
        });
    };

    // 3. Enviar via Autentique para Assinatura (WhatsApp)
    const handleSendAutentique = (vacation: VacationProcessItem) => {
        if (!vacation.phone) {
            toast.error("O colaborador não possui telefone cadastrado para envio via WhatsApp.");
            return;
        }

        if (!vacation.hasAccountingFile) {
            const proceed = window.confirm(
                `Atenção: O arquivo oficial com valores da contabilidade ainda não foi anexado para ${vacation.employeeName}.\n\nSe continuar agora, será enviada a minuta padrão da CLT (sem os valores calculados).\n\nDeseja continuar assim mesmo ou prefere registrar o retorno da contabilidade antes?`
            );
            if (!proceed) return;
        }

        startTransition(async () => {
            try {
                const res = await sendVacationNoticeToAutentique(vacation.id);
                if (res.success) {
                    toast.success(res.message);
                    setProcesses(prev => prev.map(item => {
                        if (item.id === vacation.id) {
                            return {
                                ...item,
                                autentiqueDocId: res.docId || "autentique",
                                autentiqueStatus: "ENVIADO",
                                autentiqueSentAt: new Date().toISOString()
                            };
                        }
                        return item;
                    }));
                }
            } catch (err: any) {
                toast.error(err.message || "Erro ao disparar documento no Autentique.");
            }
        });
    };

    // 4. Lançar Contas a Pagar no Conta Azul
    const handleOpenContaAzulModal = (vacation: VacationProcessItem) => {
        // Se a contabilidade já informou o valor líquido, usa ele diretamente!
        const initialAmount = vacation.receiptAmount 
            ? vacation.receiptAmount.toFixed(2)
            : ((vacation.salary || 1900) * (vacation.daysTaken / 30) * 1.3333).toFixed(2);

        setContaAzulModal({
            isOpen: true,
            vacation,
            amount: initialAmount,
            notes: `Férias ${vacation.daysTaken}d (${vacation.startDateFormatted} a ${vacation.endDateFormatted})`
        });
    };

    const handleCreateContaAzul = () => {
        const targetVacation = contaAzulModal.vacation;
        if (!targetVacation || !contaAzulModal.amount) return;

        const numAmount = parseFloat(contaAzulModal.amount.replace(",", "."));
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error("Informe um valor válido para o lançamento.");
            return;
        }

        startTransition(async () => {
            try {
                const res = await createContaAzulPayableAction({
                    vacationId: targetVacation.id,
                    amount: numAmount,
                    notes: contaAzulModal.notes
                });

                if (res.success) {
                    toast.success(res.message);
                    setContaAzulModal(prev => ({ ...prev, isOpen: false }));

                    setProcesses(prev => prev.map(item => {
                        if (item.id === targetVacation.id) {
                            return {
                                ...item,
                                contaAzulPayableId: res.payableId || "CA-PENDENTE",
                                contaAzulStatus: "PENDENTE",
                                receiptAmount: numAmount,
                                phase: "AGUARDANDO_PAGAMENTO",
                                phaseLabel: "2. Aguardando Pagamento (D-2 CLT)"
                            };
                        }
                        return item;
                    }));
                }
            } catch (err: any) {
                toast.error(err.message || "Erro ao criar contas a pagar no Conta Azul.");
            }
        });
    };

    // 4. Baixar / Confirmar Pagamento
    const handleConfirmPayment = (vacation: VacationProcessItem) => {
        startTransition(async () => {
            try {
                const res = await syncContaAzulPayableAction(vacation.id);
                if (res.success) {
                    toast.success(res.message);
                    setProcesses(prev => prev.map(item => {
                        if (item.id === vacation.id) {
                            return {
                                ...item,
                                paymentConfirmed: true,
                                paymentConfirmedAt: new Date().toISOString(),
                                contaAzulStatus: "PAGO",
                                phase: "EM_GOZO",
                                phaseLabel: "Em Gozo de Férias"
                            };
                        }
                        return item;
                    }));
                }
            } catch (err: any) {
                toast.error(err.message || "Erro ao baixar pagamento.");
            }
        });
    };

    // 5. Confirmar Retorno ao Posto
    const handleConfirmReturn = (vacation: VacationProcessItem) => {
        startTransition(async () => {
            try {
                const res = await updateVacationWorkflowStep({
                    vacationId: vacation.id,
                    action: "CONFIRM_RETURN"
                });
                if (res.success) {
                    toast.success(res.message);
                    setProcesses(prev => prev.map(item => {
                        if (item.id === vacation.id) {
                            return {
                                ...item,
                                returnedToWork: true,
                                returnedToWorkAt: new Date().toISOString(),
                                phase: "RETORNO_CONCLUIDO",
                                phaseLabel: "Concluída (Retorno OK)"
                            };
                        }
                        return item;
                    }));
                }
            } catch (err: any) {
                toast.error(err.message || "Erro ao confirmar retorno.");
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* 1. CARDS DE ETAPA OPERACIONAL */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div 
                    onClick={() => setSelectedPhase("TRATATIVAS")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedPhase === "TRATATIVAS" 
                            ? "bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-200 shadow-sm" 
                            : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                            1. Tratativas DP & Contab.
                        </span>
                        <span className="p-1 rounded-md bg-indigo-100 text-indigo-600">
                            <Mail className="w-3.5 h-3.5" />
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-3xl font-black text-slate-900">{metrics.phaseTratativas}</span>
                        <span className="text-xs text-slate-500 font-medium">em preparação</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Envio contab., Autentique e Conta Azul</p>
                </div>

                <div 
                    onClick={() => setSelectedPhase("PAGAMENTO")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedPhase === "PAGAMENTO" 
                            ? "bg-rose-50/80 border-rose-400 ring-2 ring-rose-200 shadow-sm" 
                            : metrics.criticalPayment > 0 
                                ? "bg-rose-50/40 border-rose-300 hover:border-rose-400 shadow-xs"
                                : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
                            2. Aguardando Pgto (D-2 CLT)
                        </span>
                        <span className="p-1 rounded-md bg-rose-100 text-rose-600">
                            <CreditCard className="w-3.5 h-3.5" />
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-3xl font-black text-slate-900">{metrics.phaseAguardandoPagamento}</span>
                        {metrics.criticalPayment > 0 && (
                            <span className="text-xs font-bold text-rose-600 animate-pulse">
                                ({metrics.criticalPayment} urgentes)
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Lançados no Conta Azul / Contagem D-2</p>
                </div>

                <div 
                    onClick={() => setSelectedPhase("GOZO")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedPhase === "GOZO" 
                            ? "bg-blue-50/80 border-blue-400 ring-2 ring-blue-200 shadow-sm" 
                            : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                            3. Em Gozo de Férias
                        </span>
                        <span className="p-1 rounded-md bg-blue-100 text-blue-600">
                            <Calendar className="w-3.5 h-3.5" />
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-3xl font-black text-slate-900">{metrics.phaseEmGozo}</span>
                        <span className="text-xs text-slate-500 font-medium">afastados no ponto</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Pagos e usufruindo descanso legal</p>
                </div>

                <div 
                    onClick={() => setSelectedPhase("RETORNO")}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedPhase === "RETORNO" 
                            ? "bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-200 shadow-sm" 
                            : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                            4. Retorno ao Posto
                        </span>
                        <span className="p-1 rounded-md bg-emerald-100 text-emerald-600">
                            <UserCheck className="w-3.5 h-3.5" />
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-3xl font-black text-slate-900">{metrics.phaseRetorno + metrics.completed}</span>
                        <span className="text-xs text-slate-500 font-medium">processos</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Reativação no posto e validação</p>
                </div>
            </div>

            {/* 2. BARRA DE BUSCA E SUB-ABAS */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar colaborador, CPF, posto ou cargo..."
                        className="pl-9 bg-slate-50 border-slate-200 text-sm h-9"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                    {[
                        { key: "ALL", label: "Todas as Férias" },
                        { key: "TRATATIVAS", label: `1. Tratativas DP (${metrics.phaseTratativas})` },
                        { key: "PAGAMENTO", label: `2. Aguardando Pgto (${metrics.phaseAguardandoPagamento})` },
                        { key: "GOZO", label: `3. Em Gozo (${metrics.phaseEmGozo})` },
                        { key: "RETORNO", label: `4. Retornos (${metrics.phaseRetorno})` }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setSelectedPhase(tab.key as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                selectedPhase === tab.key
                                    ? "bg-slate-900 text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. TABELA DE TAREFAS OPERACIONAIS */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3.5">Colaborador / Contrato</th>
                                <th className="px-4 py-3.5">Período de Gozo</th>
                                <th className="px-4 py-3.5">Prazo Limite Pgto (D-2 CLT)</th>
                                <th className="px-4 py-3.5 text-center">Status / Automações</th>
                                <th className="px-4 py-3.5 text-center">Ações Operacionais DP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                            {filteredProcesses.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-400">
                                        Nenhuma solicitação de férias nesta fase com os filtros aplicados.
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
                                                    <span className="text-slate-500">{proc.companyName}</span>
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
                                                        <span className="text-amber-700 ml-1 font-bold">
                                                            (+{proc.daysSold}d abono)
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
                                                        <span className="text-[10px] text-slate-400">(D-2 dias)</span>
                                                    </div>

                                                    {proc.paymentConfirmed ? (
                                                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                            <span>Quitado {proc.receiptAmount ? `(R$ ${proc.receiptAmount.toFixed(2)})` : ""}</span>
                                                        </div>
                                                    ) : proc.isPaymentLate ? (
                                                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold animate-pulse">
                                                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                                                            <span>PAGAMENTO VENCIDO! ({Math.abs(proc.paymentDaysRemaining)}d)</span>
                                                        </div>
                                                    ) : proc.isPaymentUrgent ? (
                                                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                                            <Clock className="w-3 h-3 text-amber-600" />
                                                            <span>Pagar em {proc.paymentDaysRemaining} dia(s)</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-[11px] text-slate-500">
                                                            Faltam {proc.paymentDaysRemaining} dias para o prazo
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 4. Status das 4 Etapas Operacionais (Contabilidade, Retorno R$, Autentique, Conta Azul) */}
                                            <td className="px-4 py-3.5 text-center">
                                                <div className="inline-flex flex-col items-center gap-1.5">
                                                    <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                                                        proc.phase === "RETORNO_CONCLUIDO" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                                                        proc.phase === "EM_GOZO" ? "bg-blue-100 text-blue-800 border border-blue-200" :
                                                        proc.phase === "AGUARDANDO_PAGAMENTO" ? "bg-rose-50 text-rose-800 border border-rose-200 font-black" :
                                                        "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                                    }`}>
                                                        {proc.phaseLabel}
                                                    </span>

                                                    {/* 4 selos de esteira operacional */}
                                                    <div className="flex flex-wrap items-center justify-center gap-1 mt-0.5 max-w-[280px]">
                                                        {/* 1. E-mail Contab */}
                                                        <span 
                                                            title={proc.sentToAccounting ? `E-mail enviado à contabilidade (${proc.accountingEmailSent?.toEmail || 'OK'})` : "Pendente envio à contabilidade"}
                                                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 ${
                                                                proc.sentToAccounting ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"
                                                            }`}
                                                        >
                                                            <Mail className="w-2.5 h-2.5" /> Contab
                                                        </span>

                                                        {/* 2. Retorno com Valores (PDF / R$) */}
                                                        <span 
                                                            title={
                                                                proc.receiptAmount 
                                                                    ? `Retorno da contabilidade recebido com valor R$ ${proc.receiptAmount.toFixed(2)}${proc.hasAccountingFile ? ' e arquivo PDF anexado' : ''}` 
                                                                    : "Aguardando retorno da contabilidade com cálculos e documento"
                                                            }
                                                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 ${
                                                                proc.receiptAmount ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"
                                                            }`}
                                                        >
                                                            <FileCheck className="w-2.5 h-2.5" /> 
                                                            {proc.receiptAmount ? `R$ ${proc.receiptAmount.toFixed(0)}` : "Retorno R$"}
                                                        </span>

                                                        {/* 3. Autentique */}
                                                        <span 
                                                            title={
                                                                proc.noticeSigned ? "Aviso assinado pelo colaborador via Autentique" :
                                                                proc.autentiqueStatus === "ENVIADO" ? "Disparado no WhatsApp via Autentique (Aguardando assinatura)" :
                                                                "Aviso pendente de disparo no Autentique"
                                                            }
                                                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 ${
                                                                proc.noticeSigned ? "bg-emerald-100 text-emerald-800" :
                                                                proc.autentiqueStatus === "ENVIADO" ? "bg-purple-100 text-purple-800" :
                                                                "bg-slate-100 text-slate-400"
                                                            }`}
                                                        >
                                                            <Smartphone className="w-2.5 h-2.5" /> 
                                                            {proc.noticeSigned ? "Assinado" : proc.autentiqueStatus ? "Enviado" : "Autentique"}
                                                        </span>

                                                        {/* 4. Conta Azul */}
                                                        <span 
                                                            title={
                                                                proc.paymentConfirmed ? "Férias quitadas no financeiro" :
                                                                proc.contaAzulPayableId ? `Lançado no Conta Azul (ID: ${proc.contaAzulPayableId})` : 
                                                                "Pendente lançamento no Conta Azul"
                                                            }
                                                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 ${
                                                                proc.paymentConfirmed ? "bg-emerald-100 text-emerald-800" :
                                                                proc.contaAzulPayableId ? "bg-amber-100 text-amber-800" :
                                                                "bg-slate-100 text-slate-400"
                                                            }`}
                                                        >
                                                            <CreditCard className="w-2.5 h-2.5" />
                                                            {proc.paymentConfirmed ? "Quitado" : proc.contaAzulPayableId ? "Conta Azul" : "Conta Azul"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* 5. AÇÕES RÁPIDAS DP (Automações em 1 clique) */}
                                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {/* Visualizar Arquivo da Contabilidade (se existir) */}
                                                    {proc.accountingFileUrl && (
                                                        <button
                                                            onClick={() => setPreviewDocModal({
                                                                isOpen: true,
                                                                title: `Aviso de Férias Oficial — ${proc.employeeName} (${proc.accountingFileName || "PDF"})`,
                                                                url: proc.accountingFileUrl
                                                            })}
                                                            title="Visualizar documento oficial com cálculos da contabilidade"
                                                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors border border-emerald-200 cursor-pointer"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}

                                                    {/* Imprimir Minuta CLT */}
                                                    <button
                                                        onClick={() => setPrintModalId(proc.id)}
                                                        title="Imprimir Modelo CLT (Art. 135 CLT)"
                                                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 cursor-pointer"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                    </button>

                                                    {/* FASE 1: TRATATIVAS DP */}
                                                    {proc.phase === "TRATATIVAS_DP" && (
                                                        <>
                                                            {/* Botão 1: E-mail Contabilidade */}
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => setEmailModal({
                                                                    isOpen: true,
                                                                    vacation: proc,
                                                                    recipientEmail: "contabilidade@grupojvsserv.com.br",
                                                                    customNotes: ""
                                                                })}
                                                                title="Enviar dados para contabilidade via e-mail"
                                                                className={`h-7 text-xs px-2.5 ${proc.sentToAccounting ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"}`}
                                                            >
                                                                <Mail className="w-3 h-3 mr-1" />
                                                                {proc.sentToAccounting ? "E-mail OK" : "E-mail Contab"}
                                                            </Button>

                                                            {/* Botão 2: Retorno Contabilidade (Arquivo com Valores R$) */}
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleOpenAccountingReturnModal(proc)}
                                                                title="Registrar retorno da contabilidade, anexar arquivo e valores calculados"
                                                                className={`h-7 text-xs px-2.5 ${
                                                                    proc.receiptAmount 
                                                                        ? "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 font-bold" 
                                                                        : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 font-bold animate-pulse"
                                                                }`}
                                                            >
                                                                {proc.receiptAmount ? (
                                                                    <>
                                                                        <FileCheck className="w-3 h-3 mr-1 text-blue-600" />
                                                                        R$ {proc.receiptAmount.toFixed(2)}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <FileUp className="w-3 h-3 mr-1 text-amber-600" />
                                                                        Receber Contab
                                                                    </>
                                                                )}
                                                            </Button>

                                                            {/* Botão 3: Enviar via Autentique */}
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={isPending}
                                                                onClick={() => handleSendAutentique(proc)}
                                                                title={
                                                                    proc.hasAccountingFile 
                                                                        ? "Enviar arquivo oficial com valores para assinatura no WhatsApp via Autentique" 
                                                                        : "Enviar aviso de férias para assinatura no WhatsApp via Autentique"
                                                                }
                                                                className={`h-7 text-xs px-2.5 ${
                                                                    proc.noticeSigned ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                                                                    proc.autentiqueStatus ? "bg-purple-50 text-purple-800 border-purple-200" :
                                                                    "bg-purple-600 hover:bg-purple-700 text-white"
                                                                }`}
                                                            >
                                                                <Smartphone className="w-3 h-3 mr-1" />
                                                                {proc.noticeSigned 
                                                                    ? "Assinado" 
                                                                    : proc.autentiqueStatus 
                                                                        ? "Reenviar Autentique" 
                                                                        : proc.hasAccountingFile 
                                                                            ? "Autentique (c/ Valores)" 
                                                                            : "Autentique"}
                                                            </Button>

                                                            {/* Botão 4: Lançar Conta Azul */}
                                                            <Button
                                                                size="sm"
                                                                variant="default"
                                                                onClick={() => handleOpenContaAzulModal(proc)}
                                                                title="Lançar contas a pagar no Conta Azul"
                                                                className="h-7 text-xs px-2.5 bg-amber-600 hover:bg-amber-700 text-white"
                                                            >
                                                                <CreditCard className="w-3 h-3 mr-1" />
                                                                Lançar Conta Azul
                                                            </Button>
                                                        </>
                                                    )}

                                                    {/* FASE 2: AGUARDANDO PAGAMENTO */}
                                                    {proc.phase === "AGUARDANDO_PAGAMENTO" && (
                                                        <div className="flex items-center gap-1.5">
                                                            {proc.receiptAmount && (
                                                                <span className="text-xs font-black text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                                                                    R$ {proc.receiptAmount.toFixed(2)}
                                                                </span>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                variant="default"
                                                                disabled={isPending}
                                                                onClick={() => handleConfirmPayment(proc)}
                                                                className="h-7 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1"
                                                            >
                                                                <DollarSign className="w-3.5 h-3.5" />
                                                                Baixar Pgto / Confirmar
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {/* FASE 3: EM GOZO */}
                                                    {proc.phase === "EM_GOZO" && (
                                                        <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                                                            <Calendar className="w-3.5 h-3.5" />
                                                            Em Gozo ({proc.returnDaysRemaining}d restantes)
                                                        </span>
                                                    )}

                                                    {/* FASE 4: RETORNO AO POSTO */}
                                                    {proc.phase === "RETORNO_CONCLUIDO" && !proc.returnedToWork && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={isPending}
                                                            onClick={() => handleConfirmReturn(proc)}
                                                            className="h-7 text-xs px-2.5 bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 font-bold"
                                                        >
                                                            <UserCheck className="w-3 h-3 mr-1" />
                                                            Confirmar Retorno ao Posto
                                                        </Button>
                                                    )}

                                                    {proc.returnedToWork && (
                                                        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                            Finalizado
                                                        </span>
                                                    )}

                                                    {/* Histórico do Card */}
                                                    <button
                                                        onClick={() => setHistoryModal({ isOpen: true, vacation: proc })}
                                                        title="Ver histórico e auditoria do card"
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                                    >
                                                        <HelpCircle className="w-3.5 h-3.5" />
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

            {/* MODAL 1: E-MAIL PARA CONTABILIDADE */}
            <Dialog 
                open={emailModal.isOpen} 
                onOpenChange={(open) => !open && setEmailModal(prev => ({ ...prev, isOpen: false }))}
            >
                <DialogContent className="max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-indigo-600" />
                            Enviar Férias para Contabilidade / DP
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Colaborador: <strong>{emailModal.vacation?.employeeName}</strong>
                            <br />
                            Período: {emailModal.vacation?.startDateFormatted} a {emailModal.vacation?.endDateFormatted} ({emailModal.vacation?.daysTaken} dias)
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2 text-xs">
                        <div>
                            <Label className="text-xs font-semibold text-slate-700">E-mail do Escritório / Contabilidade</Label>
                            <Input
                                value={emailModal.recipientEmail}
                                onChange={(e) => setEmailModal(prev => ({ ...prev, recipientEmail: e.target.value }))}
                                placeholder="contabilidade@..."
                                className="h-8 text-xs mt-1"
                            />
                        </div>

                        <div>
                            <Label className="text-xs font-semibold text-slate-700">Observações adicionais (opcional)</Label>
                            <Textarea
                                value={emailModal.customNotes}
                                onChange={(e) => setEmailModal(prev => ({ ...prev, customNotes: e.target.value }))}
                                placeholder="Ex: Favor abater adiantamento anterior, enviar recibo até dia X..."
                                className="text-xs min-h-[60px] mt-1"
                            />
                        </div>

                        <div className="bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-100 text-[11px] text-indigo-900 space-y-1">
                            <div className="font-bold">O e-mail conterá automaticamente:</div>
                            <div>• Dados da Empresa e do Colaborador (CPF, Cargo, Posto)</div>
                            <div>• Período de gozo e dias de abono</div>
                            <div>• Data limite de pagamento (D-2 CLT: {emailModal.vacation?.paymentDeadlineFormatted})</div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEmailModal(prev => ({ ...prev, isOpen: false }))}
                            disabled={isPending}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleSendEmail}
                            disabled={isPending}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                        >
                            <Send className="w-3.5 h-3.5" />
                            {isPending ? "Transmitindo..." : "Enviar E-mail e Salvar Histórico"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL 1.5: RETORNO DA CONTABILIDADE (ARQUIVO COM VALORES R$) */}
            <Dialog 
                open={accountingReturnModal.isOpen} 
                onOpenChange={(open) => !open && setAccountingReturnModal(prev => ({ ...prev, isOpen: false }))}
            >
                <DialogContent className="max-w-lg bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <FileCheck className="w-5 h-5 text-blue-600" />
                            Retorno da Contabilidade — Arquivo & Valores R$
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Colaborador: <strong>{accountingReturnModal.vacation?.employeeName}</strong> (CPF: {accountingReturnModal.vacation?.cpf})
                            <br />
                            Período: {accountingReturnModal.vacation?.startDateFormatted} a {accountingReturnModal.vacation?.endDateFormatted} ({accountingReturnModal.vacation?.daysTaken} dias)
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-xs">
                        {/* 1. Upload do Arquivo PDF da Contabilidade */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700">
                                Arquivo Oficial do Aviso/Recibo de Férias (PDF da Contabilidade)
                            </Label>
                            
                            <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-4 text-center bg-slate-50/50 transition-colors">
                                {accountingReturnModal.fileName ? (
                                    <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                                        <div className="flex items-center gap-2 text-left truncate">
                                            <FileText className="w-5 h-5 text-rose-500 shrink-0" />
                                            <div className="truncate">
                                                <div className="font-bold text-slate-800 truncate text-xs">
                                                    {accountingReturnModal.fileName}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    {accountingReturnModal.fileSizeFormatted || "Documento anexado"}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {accountingReturnModal.fileBase64 && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setPreviewDocModal({
                                                        isOpen: true,
                                                        title: accountingReturnModal.fileName || "Aviso de Férias",
                                                        url: accountingReturnModal.fileBase64
                                                    })}
                                                    className="h-7 text-xs text-blue-600"
                                                >
                                                    <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setAccountingReturnModal(prev => ({
                                                    ...prev,
                                                    fileName: null,
                                                    fileBase64: null,
                                                    fileSizeFormatted: null
                                                }))}
                                                className="h-7 text-xs text-rose-600"
                                            >
                                                Trocar
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <label className="cursor-pointer block">
                                        <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
                                        <span className="font-bold text-blue-600 hover:underline text-xs block">
                                            Clique para selecionar o arquivo PDF da contabilidade
                                        </span>
                                        <span className="text-[11px] text-slate-400 block mt-0.5">
                                            Aviso de férias oficial com cálculos e valores apurados (até 10MB)
                                        </span>
                                        <input
                                            type="file"
                                            accept="application/pdf"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-500">
                                💡 <strong>Importante:</strong> Este arquivo oficial (com valores e cálculos apurados) será o documento enviado para o WhatsApp do colaborador via Autentique para colher a assinatura.
                            </p>
                        </div>

                        {/* 2. Valor Líquido Apurado */}
                        <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-700">
                                Valor Líquido Apurado pela Contabilidade (R$) *
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">R$</span>
                                <Input
                                    value={accountingReturnModal.amount}
                                    onChange={(e) => setAccountingReturnModal(prev => ({ ...prev, amount: e.target.value }))}
                                    placeholder="Ex: 2450.80"
                                    className="pl-9 h-9 text-sm font-black text-slate-900 bg-white"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400">
                                Este valor será preenchido automaticamente ao clicar em "Lançar Conta Azul" para evitar divergências ou erros manuais.
                            </p>
                        </div>

                        {/* 3. Observações da Contabilidade */}
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-700">
                                Observações da Contabilidade (opcional)
                            </Label>
                            <Textarea
                                value={accountingReturnModal.notes}
                                onChange={(e) => setAccountingReturnModal(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Ex: Deduzido adiantamento, apurado médias de adicionais..."
                                className="text-xs min-h-[50px]"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAccountingReturnModal(prev => ({ ...prev, isOpen: false }))}
                            disabled={isPending}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleSaveAccountingReturn}
                            disabled={isPending}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                        >
                            <FileCheck className="w-3.5 h-3.5" />
                            {isPending ? "Salvando..." : "Salvar Retorno e Anexar Documento"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL DE PREVIEW DO PDF */}
            <Dialog 
                open={previewDocModal.isOpen} 
                onOpenChange={(open) => !open && setPreviewDocModal(prev => ({ ...prev, isOpen: false }))}
            >
                <DialogContent className="max-w-4xl h-[85vh] bg-white flex flex-col p-4">
                    <DialogHeader className="pb-2 border-b">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-sm font-bold text-slate-800 truncate">
                                {previewDocModal.title}
                            </DialogTitle>
                            {previewDocModal.url && (
                                <a
                                    href={previewDocModal.url}
                                    download="Aviso_Ferias_Contabilidade.pdf"
                                    className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 mr-6"
                                >
                                    <Download className="w-3.5 h-3.5" /> Baixar PDF
                                </a>
                            )}
                        </div>
                    </DialogHeader>

                    <div className="flex-1 bg-slate-100 rounded-lg overflow-hidden mt-2">
                        {previewDocModal.url ? (
                            <iframe
                                src={previewDocModal.url}
                                className="w-full h-full border-0"
                                title="Pré-visualização do Documento de Férias"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                                Documento não disponível para visualização.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL 2: LANÇAR CONTAS A PAGAR NO CONTA AZUL */}
            <Dialog 
                open={contaAzulModal.isOpen} 
                onOpenChange={(open) => !open && setContaAzulModal(prev => ({ ...prev, isOpen: false }))}
            >
                <DialogContent className="max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-amber-600" />
                            Lançar Contas a Pagar no Conta Azul
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Empresa: <strong>{contaAzulModal.vacation?.companyName}</strong>
                            <br />
                            Beneficiário: <strong>{contaAzulModal.vacation?.employeeName}</strong> (CPF: {contaAzulModal.vacation?.cpf})
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2 text-xs">
                        <div>
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-slate-700">Valor da Remuneração das Férias (R$)</Label>
                                {contaAzulModal.vacation?.receiptAmount ? (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                        ✓ Validado pela contabilidade
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                        Estimado preliminar
                                    </span>
                                )}
                            </div>
                            <Input
                                value={contaAzulModal.amount}
                                onChange={(e) => setContaAzulModal(prev => ({ ...prev, amount: e.target.value }))}
                                placeholder="Ex: 2533.33"
                                className="h-8 text-xs mt-1 font-bold text-slate-900"
                            />
                        </div>

                        <div>
                            <Label className="text-xs font-semibold text-slate-700">Data de Vencimento no Conta Azul</Label>
                            <div className="p-2 bg-slate-50 rounded border border-slate-200 font-bold text-slate-800 mt-1">
                                {contaAzulModal.vacation?.paymentDeadlineFormatted} (D-2 dias antes do gozo)
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs font-semibold text-slate-700">Observações do Lançamento</Label>
                            <Input
                                value={contaAzulModal.notes}
                                onChange={(e) => setContaAzulModal(prev => ({ ...prev, notes: e.target.value }))}
                                className="h-8 text-xs mt-1"
                            />
                        </div>

                        <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-[11px] text-amber-900">
                            <strong>Automação Ativa:</strong> O sistema vinculará o colaborador como favorecido na categoria <em>"03.1.8 - Adiantamento Salarial"</em> no Conta Azul da empresa vinculada.
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setContaAzulModal(prev => ({ ...prev, isOpen: false }))}
                            disabled={isPending}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleCreateContaAzul}
                            disabled={isPending}
                            className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5"
                        >
                            <CreditCard className="w-3.5 h-3.5" />
                            {isPending ? "Criando no Conta Azul..." : "Confirmar Lançamento"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL 3: HISTÓRICO E DETALHES DO CARD */}
            <Dialog 
                open={historyModal.isOpen} 
                onOpenChange={(open) => !open && setHistoryModal({ isOpen: false, vacation: null })}
            >
                <DialogContent className="max-w-lg bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-slate-800">
                            Histórico de Automações — {historyModal.vacation?.employeeName}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Auditoria completa das comunicações, assinaturas e pagamentos
                        </DialogDescription>
                    </DialogHeader>

                    {historyModal.vacation && (
                        <div className="space-y-3 py-2 text-xs">
                            {/* E-mail Contabilidade */}
                            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5 text-indigo-600" />
                                    Comunicação com Contabilidade:
                                </div>
                                {historyModal.vacation.accountingEmailSent ? (
                                    <div className="text-[11px] text-slate-600 space-y-0.5">
                                        <div><strong>Enviado para:</strong> {historyModal.vacation.accountingEmailSent.toEmail}</div>
                                        <div><strong>Data/Hora:</strong> {new Date(historyModal.vacation.accountingEmailSent.sentAt).toLocaleString("pt-BR")}</div>
                                        <div><strong>Operador:</strong> {historyModal.vacation.accountingEmailSent.sentBy}</div>
                                        {historyModal.vacation.accountingEmailSent.notes && (
                                            <div><strong>Notas:</strong> {historyModal.vacation.accountingEmailSent.notes}</div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-slate-400 italic">E-mail ainda não transmitido à contabilidade.</div>
                                )}
                            </div>

                            {/* Retorno da Contabilidade (Arquivo & Valores R$) */}
                            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                                <div className="font-bold text-slate-800 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                                        Retorno da Contabilidade (Valores & Documento):
                                    </span>
                                    {historyModal.vacation.accountingFileUrl && (
                                        <button
                                            type="button"
                                            onClick={() => setPreviewDocModal({
                                                isOpen: true,
                                                title: `Aviso de Férias — ${historyModal.vacation?.employeeName}`,
                                                url: historyModal.vacation?.accountingFileUrl || null
                                            })}
                                            className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                            <Eye className="w-3 h-3" /> Ver Documento
                                        </button>
                                    )}
                                </div>
                                {historyModal.vacation.receiptAmount || historyModal.vacation.hasAccountingFile ? (
                                    <div className="text-[11px] text-slate-600 space-y-0.5">
                                        <div><strong>Valor Líquido Oficial:</strong> R$ {historyModal.vacation.receiptAmount?.toFixed(2) || "0.00"}</div>
                                        {historyModal.vacation.accountingFileName && (
                                            <div><strong>Arquivo Anexado:</strong> {historyModal.vacation.accountingFileName}</div>
                                        )}
                                        {historyModal.vacation.accountingReturnReceivedAt && (
                                            <div><strong>Data do Registro:</strong> {new Date(historyModal.vacation.accountingReturnReceivedAt).toLocaleString("pt-BR")}</div>
                                        )}
                                        {historyModal.vacation.accountingReturnNotes && (
                                            <div><strong>Notas da Contabilidade:</strong> {historyModal.vacation.accountingReturnNotes}</div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-slate-400 italic">Retorno da contabilidade ainda não registrado.</div>
                                )}
                            </div>

                            {/* Autentique */}
                            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <Smartphone className="w-3.5 h-3.5 text-purple-600" />
                                    Assinatura Eletrônica (Autentique):
                                </div>
                                {historyModal.vacation.autentiqueDocId ? (
                                    <div className="text-[11px] text-slate-600 space-y-0.5">
                                        <div><strong>Documento ID:</strong> {historyModal.vacation.autentiqueDocId}</div>
                                        <div><strong>Status Atual:</strong> {historyModal.vacation.noticeSigned ? "ASSINADO" : historyModal.vacation.autentiqueStatus || "ENVIADO"}</div>
                                        {historyModal.vacation.autentiqueSentAt && (
                                            <div><strong>Disparado em:</strong> {new Date(historyModal.vacation.autentiqueSentAt).toLocaleString("pt-BR")}</div>
                                        )}
                                        {historyModal.vacation.noticeSignedAt && (
                                            <div className="text-emerald-700 font-bold"><strong>Assinado em:</strong> {new Date(historyModal.vacation.noticeSignedAt).toLocaleString("pt-BR")}</div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-slate-400 italic">Aviso não disparado via Autentique.</div>
                                )}
                            </div>

                            {/* Conta Azul */}
                            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                                    Lançamento Financeiro (Conta Azul):
                                </div>
                                {historyModal.vacation.contaAzulPayableId ? (
                                    <div className="text-[11px] text-slate-600 space-y-0.5">
                                        <div><strong>ID Contas a Pagar:</strong> {historyModal.vacation.contaAzulPayableId}</div>
                                        <div><strong>Status Financeiro:</strong> {historyModal.vacation.paymentConfirmed ? "QUITADO" : historyModal.vacation.contaAzulStatus || "PENDENTE"}</div>
                                        {historyModal.vacation.receiptAmount && (
                                            <div><strong>Valor Lançado:</strong> R$ {historyModal.vacation.receiptAmount.toFixed(2)}</div>
                                        )}
                                        {historyModal.vacation.paymentConfirmedAt && (
                                            <div className="text-emerald-700 font-bold"><strong>Baixado em:</strong> {new Date(historyModal.vacation.paymentConfirmedAt).toLocaleString("pt-BR")}</div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-slate-400 italic">Ainda não integrado ao Conta Azul.</div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setHistoryModal({ isOpen: false, vacation: null })}
                        >
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL 4: IMPRESSÃO FORMAL DO AVISO */}
            <VacationNoticePrintDialog
                vacationId={printModalId}
                isOpen={!!printModalId}
                onClose={() => setPrintModalId(null)}
            />
        </div>
    );
}
