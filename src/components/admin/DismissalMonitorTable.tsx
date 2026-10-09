"use client";

import React, { useState } from "react";
import Link from "next/navigation";
import { format, differenceInDays, startOfDay } from "date-fns";
import {
    Calendar,
    Clock,
    User,
    Building2,
    Briefcase,
    SlidersHorizontal,
    FileText,
    Send,
    UserCheck,
    UserX,
    Ban,
    ArrowRight,
    ExternalLink,
    AlertCircle,
    CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { DismissalNoticeButtons } from "@/components/admin/DismissalNoticeButtons";
import { ResignationLetterDownloadButton } from "@/components/admin/ResignationLetterDownloadButton";
import { TelegramRegisterButton } from "@/components/admin/TelegramRegisterButton";
import { InitiateDismissalDialog } from "@/components/admin/InitiateDismissalDialog";
import { finalizeDismissal, cancelDismissalProcess, moveEmployeeToRotativo } from "@/app/actions";

export interface DismissalMonitorEmployee {
    id: string;
    name: string;
    phone?: string | null;
    admissionDate: any;
    role: { id: string; name: string };
    company?: { id: string; name: string } | null;
    postoLabel: string;
    type: string;
    startDate: any;
    endDate: any;
    reductionType?: string;
    telegram1SentDate?: string | null;
    telegram2SentDate?: string | null;
    lastWorkingDay: any;
    paymentDeadline: any;
    dateLabel: string;
    daysCount: number;
    counterLabel: string;
    statusBadge: string;
    daysElapsed: number;
    dismissalProcess?: any;
    createdByName?: string | null;
    createdAt?: any;
    assignments?: any[];
}

export interface CompletedDismissalEmployee {
    id: string;
    name: string;
    role?: { id: string; name: string } | null;
    company?: { id: string; name: string } | null;
    admissionDate: any;
    dismissalDate: any;
    dismissalReason: string;
    dismissalNotes?: string;
    paymentDeadline?: any;
    finalizedBy: string;
    finalizedAt: any;
    postoLabel: string;
    attachment?: {
        fileName: string;
        fileData: string;
    } | null;
}

export interface CancelledDismissalEmployee {
    id: string;
    employeeId: string;
    name: string;
    role?: { id: string; name: string } | null;
    company?: { id: string; name: string } | null;
    situation?: { name: string; color?: string } | null;
    status: string;
    cancelledBy: string;
    cancelledAt: any;
    details: string;
    postoLabel: string;
}

interface DismissalMonitorTableProps {
    employees: DismissalMonitorEmployee[];
    completedEmployees?: CompletedDismissalEmployee[];
    cancelledEmployees?: CancelledDismissalEmployee[];
}

export function getProcessBadgeStyle(type: string) {
    const t = type.toLowerCase();
    if (t.includes("experiência") || t.includes("experiencia")) {
        return { bg: "#faf5ff", color: "#a855f7" }; // Purple
    }
    if (t.includes("aviso") || t.includes("dispensa") || t.includes("pedido")) {
        return { bg: "#fffbeb", color: "#d97706" }; // Amber/Orange
    }
    if (t.includes("abandono") || t.includes("justa causa")) {
        return { bg: "#fef2f2", color: "#ef4444" }; // Red
    }
    if (t.includes("ativo")) {
        return { bg: "#ecfdf5", color: "#10b981" }; // Emerald/Green
    }
    return { bg: "#f8fafc", color: "#64748b" }; // Slate/Grey
}

function safeFormatDate(d: any, pattern: string = "dd/MM/yyyy"): string {
    if (!d) return "-";
    try {
        const dateObj = typeof d === "string" ? new Date(d) : d;
        if (isNaN(dateObj.getTime())) return "-";
        return format(dateObj, pattern);
    } catch {
        return "-";
    }
}

export function DismissalMonitorTable({ 
    employees, 
    completedEmployees = [], 
    cancelledEmployees = [] 
}: DismissalMonitorTableProps) {
    const router = useRouter();
    const [selectedEmployee, setSelectedEmployee] = useState<DismissalMonitorEmployee | null>(null);
    const [loadingAction, setLoadingAction] = useState(false);

    // Modal de Finalizar Desligamento com Notas
    const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
    const [finalizeNotes, setFinalizeNotes] = useState("");

    const todayStart = startOfDay(new Date());

    const handleCancelProcess = async (emp: DismissalMonitorEmployee) => {
        if (!confirm(`Deseja cancelar o processo de desligamento de ${emp.name}? O colaborador voltará para a situação "Ativo".`)) return;
        setLoadingAction(true);
        try {
            const res = await cancelDismissalProcess(emp.id);
            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success("Processo cancelado com sucesso!");
                setSelectedEmployee(null);
                router.refresh();
            }
        } catch (e: any) {
            toast.error(e.message || "Erro de conexão.");
        } finally {
            setLoadingAction(false);
        }
    };

    const handleMoveToRotativo = async (emp: DismissalMonitorEmployee) => {
        if (!confirm(`Deseja mover ${emp.name} para o Rotativo?`)) return;
        setLoadingAction(true);
        try {
            const res = await moveEmployeeToRotativo(emp.id);
            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success("Colaborador alocado no Rotativo!");
                setSelectedEmployee(null);
                router.refresh();
            }
        } catch (e: any) {
            toast.error(e.message || "Erro de conexão.");
        } finally {
            setLoadingAction(false);
        }
    };

    const handleFinalize = async () => {
        if (!selectedEmployee) return;
        setLoadingAction(true);
        try {
            const res = await finalizeDismissal(selectedEmployee.id, finalizeNotes);
            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success("Desligamento finalizado com sucesso!");
                setFinalizeDialogOpen(false);
                setSelectedEmployee(null);
                setFinalizeNotes("");
                router.refresh();
            }
        } catch (e: any) {
            toast.error(e.message || "Erro de conexão.");
        } finally {
            setLoadingAction(false);
        }
    };

    return (
        <div className="space-y-4">
            <Tabs defaultValue="active" className="w-full space-y-4">
                {/* ── BARRA DE SELEÇÃO DE ABAS ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs">
                    <TabsList className="bg-slate-100/90 p-1 rounded-xl h-11 border border-slate-200/60 flex items-center gap-1">
                        <TabsTrigger 
                            value="active" 
                            className="rounded-lg font-bold text-xs px-4 py-2 flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-sm transition-all"
                        >
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Em Andamento</span>
                            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-amber-100/80 text-amber-800 font-bold border-amber-200">
                                {employees.length}
                            </Badge>
                        </TabsTrigger>

                        <TabsTrigger 
                            value="completed" 
                            className="rounded-lg font-bold text-xs px-4 py-2 flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-emerald-800 data-[state=active]:shadow-sm transition-all"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Concluídos / Desligados</span>
                            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-emerald-100/80 text-emerald-800 font-bold border-emerald-200">
                                {completedEmployees.length}
                            </Badge>
                        </TabsTrigger>

                        <TabsTrigger 
                            value="cancelled" 
                            className="rounded-lg font-bold text-xs px-4 py-2 flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-800 data-[state=active]:shadow-sm transition-all"
                        >
                            <Ban className="w-3.5 h-3.5 text-slate-500" />
                            <span>Cancelados</span>
                            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-slate-200 text-slate-700 font-bold border-slate-300">
                                {cancelledEmployees.length}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>

                    <div className="text-xs text-slate-500 font-medium px-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                        <span>Total no sistema: <strong>{employees.length + completedEmployees.length + cancelledEmployees.length}</strong> registros</span>
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════════
                    ABA 1: EM ANDAMENTO
                ══════════════════════════════════════════════════════════ */}
                <TabsContent value="active" className="m-0 focus-visible:outline-none">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                        <tr>
                            <th className="px-4 py-3.5">Colaborador</th>
                            <th className="px-4 py-3.5">Cargo / Função</th>
                            <th className="px-4 py-3.5">Empresa / Posto</th>
                            <th className="px-4 py-3.5">Processo</th>
                            <th className="px-3 py-3.5 text-center">Data Início</th>
                            <th className="px-3 py-3.5 text-center">Data Término</th>
                            <th className="px-3 py-3.5 text-center">Último Dia Trab.</th>
                            <th className="px-3 py-3.5 text-center">Prazo Pgto</th>
                            <th className="px-3 py-3.5 text-center">Contador</th>
                            <th className="px-4 py-3.5">Criado Por</th>
                            <th className="px-4 py-3.5">Criado Em</th>
                            <th className="px-4 py-3.5 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {employees.length === 0 ? (
                            <tr>
                                <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
                                    Nenhum colaborador encontrado nos filtros selecionados.
                                </td>
                            </tr>
                        ) : (
                            employees.map((emp) => {
                                const style = getProcessBadgeStyle(emp.type);
                                const isPayOverdue = emp.paymentDeadline && differenceInDays(startOfDay(new Date(emp.paymentDeadline)), todayStart) < 0;
                                const isPayUrgent = emp.paymentDeadline && differenceInDays(startOfDay(new Date(emp.paymentDeadline)), todayStart) <= 3 && !isPayOverdue;

                                return (
                                    <tr 
                                        key={emp.id} 
                                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                        onClick={() => setSelectedEmployee(emp)}
                                    >
                                        {/* 1. Nome do Colaborador */}
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                {emp.name}
                                            </div>
                                        </td>

                                        {/* 2. Cargo / Função */}
                                        <td className="px-4 py-3">
                                            <span className="text-slate-600 font-medium">
                                                {emp.role?.name || "-"}
                                            </span>
                                        </td>

                                        {/* 3. Empresa / Posto */}
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-0.5 max-w-[150px]">
                                                <span 
                                                    className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded w-fit truncate border border-slate-200/60"
                                                    title={emp.company?.name || "S/ Empresa"}
                                                >
                                                    {emp.company?.name || "S/ Empresa"}
                                                </span>
                                                <span 
                                                    className="text-[11px] text-slate-500 font-semibold truncate"
                                                    title={emp.postoLabel}
                                                >
                                                    {emp.postoLabel}
                                                </span>
                                            </div>
                                        </td>

                                        {/* 4. Processo */}
                                        <td className="px-4 py-3">
                                            <span
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-xs"
                                                style={{
                                                    backgroundColor: style.bg,
                                                    color: style.color,
                                                    borderColor: `${style.color}35`
                                                }}
                                            >
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                                    style={{ backgroundColor: style.color }}
                                                />
                                                {emp.type}
                                            </span>
                                        </td>

                                        {/* 5. Data Início */}
                                        <td className="px-3 py-3 text-center">
                                            <span className="font-semibold text-slate-700">
                                                {emp.startDate ? format(new Date(emp.startDate), "dd/MM/yyyy") : "-"}
                                            </span>
                                        </td>

                                        {/* 6. Data Término */}
                                        <td className="px-3 py-3 text-center">
                                            <span className="font-bold text-slate-900">
                                                {emp.endDate ? format(new Date(emp.endDate), "dd/MM/yyyy") : "-"}
                                            </span>
                                        </td>

                                        {/* 7. Último Dia Trabalhado */}
                                        <td className="px-3 py-3 text-center">
                                            {emp.lastWorkingDay ? (
                                                <span className="inline-block text-[11px] font-bold text-sky-800 bg-sky-50 border border-sky-200/80 px-2 py-0.5 rounded">
                                                    {format(new Date(emp.lastWorkingDay), "dd/MM/yyyy")}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>

                                        {/* 8. Prazo Pgto */}
                                        <td className="px-3 py-3 text-center">
                                            {emp.paymentDeadline ? (
                                                <span
                                                    className={`inline-block text-[11px] font-bold border px-2 py-0.5 rounded shadow-xs ${
                                                        isPayOverdue
                                                            ? "bg-red-50 text-red-700 border-red-300"
                                                            : isPayUrgent
                                                            ? "bg-amber-50 text-amber-800 border-amber-300"
                                                            : "bg-emerald-50 text-emerald-800 border-emerald-300"
                                                    }`}
                                                >
                                                    {format(new Date(emp.paymentDeadline), "dd/MM/yyyy")}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>

                                        {/* 9. Contador */}
                                        <td className="px-3 py-3 text-center">
                                            <div className="flex flex-col items-center">
                                                <span
                                                    className={`text-sm font-black leading-tight ${
                                                        emp.statusBadge === "ALERTA"
                                                            ? "text-red-600"
                                                            : emp.statusBadge === "A_VENCER"
                                                            ? "text-amber-600"
                                                            : "text-slate-800"
                                                    }`}
                                                >
                                                    {emp.daysCount}
                                                </span>
                                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider leading-none">
                                                    {emp.counterLabel}
                                                </span>
                                            </div>
                                        </td>

                                        {/* 10. Criado Por */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-slate-700 font-semibold max-w-[130px]" title={emp.createdByName || "Sistema"}>
                                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="truncate">{emp.createdByName || "Sistema"}</span>
                                            </div>
                                        </td>

                                        {/* 11. Criado Em */}
                                        <td className="px-4 py-3">
                                            {emp.createdAt ? (
                                                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                                                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                                    <span>{format(new Date(emp.createdAt), "dd/MM/yyyy HH:mm")}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>

                                        {/* 12. Ações */}
                                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSelectedEmployee(emp)}
                                                className="h-8 px-3 text-xs font-bold text-indigo-700 bg-indigo-50/60 border-indigo-200 hover:bg-indigo-100 hover:text-indigo-800 rounded-lg flex items-center gap-1.5 shadow-2xs"
                                            >
                                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                                <span>Ações</span>
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </TabsContent>

    {/* ══════════════════════════════════════════════════════════
        ABA 2: CONCLUÍDOS / DESLIGADOS
    ══════════════════════════════════════════════════════════ */}
    <TabsContent value="completed" className="m-0 focus-visible:outline-none">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                        <tr>
                            <th className="px-4 py-3.5">Colaborador</th>
                            <th className="px-4 py-3.5">Cargo / Função</th>
                            <th className="px-4 py-3.5">Empresa / Último Posto</th>
                            <th className="px-4 py-3.5">Motivo da Saída</th>
                            <th className="px-3 py-3.5 text-center">Admissão</th>
                            <th className="px-3 py-3.5 text-center">Data Rescisão</th>
                            <th className="px-3 py-3.5 text-center">Prazo Pgto</th>
                            <th className="px-4 py-3.5">Finalizado Por</th>
                            <th className="px-4 py-3.5">Finalizado Em</th>
                            <th className="px-4 py-3.5 text-center">Documentos</th>
                            <th className="px-4 py-3.5 text-center">Ficha</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {completedEmployees.length === 0 ? (
                            <tr>
                                <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                                    Nenhum colaborador desligado encontrado nos filtros selecionados.
                                </td>
                            </tr>
                        ) : (
                            completedEmployees.map((emp) => {
                                const badgeStyle = getProcessBadgeStyle(emp.dismissalReason);
                                return (
                                    <tr 
                                        key={emp.id} 
                                        className="hover:bg-slate-50/80 transition-colors group"
                                    >
                                        {/* 1. Nome do Colaborador */}
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                                                {emp.name}
                                            </div>
                                            {emp.dismissalNotes && (
                                                <p className="text-[10px] text-slate-400 font-normal truncate max-w-[200px]" title={emp.dismissalNotes}>
                                                    Nota: {emp.dismissalNotes}
                                                </p>
                                            )}
                                        </td>

                                        {/* 2. Cargo / Função */}
                                        <td className="px-4 py-3">
                                            <span className="text-slate-600 font-medium">
                                                {emp.role?.name || "-"}
                                            </span>
                                        </td>

                                        {/* 3. Empresa / Último Posto */}
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-0.5 max-w-[160px]">
                                                <span 
                                                    className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded w-fit truncate border border-slate-200/60"
                                                    title={emp.company?.name || "S/ Empresa"}
                                                >
                                                    {emp.company?.name || "S/ Empresa"}
                                                </span>
                                                <span 
                                                    className="text-[11px] text-slate-500 font-semibold truncate"
                                                    title={emp.postoLabel}
                                                >
                                                    {emp.postoLabel}
                                                </span>
                                            </div>
                                        </td>

                                        {/* 4. Motivo da Saída */}
                                        <td className="px-4 py-3">
                                            <span
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-xs"
                                                style={{
                                                    backgroundColor: badgeStyle.bg,
                                                    color: badgeStyle.color,
                                                    borderColor: `${badgeStyle.color}35`
                                                }}
                                            >
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                                    style={{ backgroundColor: badgeStyle.color }}
                                                />
                                                {emp.dismissalReason}
                                            </span>
                                        </td>

                                        {/* 5. Admissão */}
                                        <td className="px-3 py-3 text-center">
                                            <span className="text-slate-500 font-medium">
                                                {safeFormatDate(emp.admissionDate)}
                                            </span>
                                        </td>

                                        {/* 6. Data Rescisão */}
                                        <td className="px-3 py-3 text-center">
                                            <span className="text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                {safeFormatDate(emp.dismissalDate)}
                                            </span>
                                        </td>

                                        {/* 7. Prazo de Pagamento */}
                                        <td className="px-3 py-3 text-center">
                                            {emp.paymentDeadline ? (
                                                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                    {safeFormatDate(emp.paymentDeadline)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 font-normal">-</span>
                                            )}
                                        </td>

                                        {/* 8. Finalizado Por */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                                <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                <span className="truncate max-w-[130px]" title={emp.finalizedBy}>
                                                    {emp.finalizedBy}
                                                </span>
                                            </div>
                                        </td>

                                        {/* 9. Finalizado Em */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span>
                                                    {safeFormatDate(emp.finalizedAt, "dd/MM/yyyy HH:mm")}
                                                </span>
                                            </div>
                                        </td>

                                        {/* 10. Documentos & Anexos */}
                                        <td className="px-4 py-3 text-center">
                                            {emp.attachment ? (
                                                <ResignationLetterDownloadButton
                                                    fileName={emp.attachment.fileName}
                                                    fileData={emp.attachment.fileData}
                                                />
                                            ) : (
                                                <span className="text-slate-300 text-xs italic">Sem anexo</span>
                                            )}
                                        </td>

                                        {/* 11. Ficha do Colaborador */}
                                        <td className="px-4 py-3 text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => window.open(`/admin/employees/${emp.id}`, "_blank")}
                                                className="h-8 px-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs"
                                                title="Abrir ficha cadastral do colaborador"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </TabsContent>

    {/* ══════════════════════════════════════════════════════════
        ABA 3: CANCELADOS / REVERTIDOS
    ══════════════════════════════════════════════════════════ */}
    <TabsContent value="cancelled" className="m-0 focus-visible:outline-none">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                        <tr>
                            <th className="px-4 py-3.5">Colaborador</th>
                            <th className="px-4 py-3.5">Cargo / Função</th>
                            <th className="px-4 py-3.5">Empresa / Posto Atual</th>
                            <th className="px-4 py-3.5 text-center">Situação Atual</th>
                            <th className="px-4 py-3.5">Cancelado Por</th>
                            <th className="px-4 py-3.5">Cancelado Em</th>
                            <th className="px-4 py-3.5">Detalhes do Registro</th>
                            <th className="px-4 py-3.5 text-center">Ficha</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {cancelledEmployees.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                                    Nenhum processo de desligamento cancelado nos filtros selecionados.
                                </td>
                            </tr>
                        ) : (
                            cancelledEmployees.map((emp) => (
                                <tr 
                                    key={emp.id} 
                                    className="hover:bg-slate-50/80 transition-colors group"
                                >
                                    {/* 1. Nome do Colaborador */}
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                            {emp.name}
                                        </div>
                                    </td>

                                    {/* 2. Cargo / Função */}
                                    <td className="px-4 py-3">
                                        <span className="text-slate-600 font-medium">
                                            {emp.role?.name || "-"}
                                        </span>
                                    </td>

                                    {/* 3. Empresa / Posto Atual */}
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-0.5 max-w-[160px]">
                                            <span 
                                                className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded w-fit truncate border border-slate-200/60"
                                                title={emp.company?.name || "S/ Empresa"}
                                            >
                                                {emp.company?.name || "S/ Empresa"}
                                            </span>
                                            <span 
                                                className="text-[11px] text-slate-500 font-semibold truncate"
                                                title={emp.postoLabel}
                                            >
                                                {emp.postoLabel}
                                            </span>
                                        </div>
                                    </td>

                                    {/* 4. Situação Atual */}
                                    <td className="px-4 py-3 text-center">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            {emp.situation?.name || emp.status || "Ativo"}
                                        </span>
                                    </td>

                                    {/* 5. Cancelado Por */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span className="truncate max-w-[140px]" title={emp.cancelledBy}>
                                                {emp.cancelledBy}
                                            </span>
                                        </div>
                                    </td>

                                    {/* 6. Cancelado Em */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span>
                                                {safeFormatDate(emp.cancelledAt, "dd/MM/yyyy HH:mm")}
                                            </span>
                                        </div>
                                    </td>

                                    {/* 7. Detalhes / Motivo */}
                                    <td className="px-4 py-3">
                                        <span 
                                            className="text-xs text-slate-600 block max-w-[280px] truncate"
                                            title={emp.details}
                                        >
                                            {emp.details}
                                        </span>
                                    </td>

                                    {/* 8. Ficha do Colaborador */}
                                    <td className="px-4 py-3 text-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => window.open(`/admin/employees/${emp.employeeId}`, "_blank")}
                                            className="h-8 px-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs"
                                            title="Abrir ficha cadastral do colaborador"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </TabsContent>
</Tabs>

            {/* ── MODAL DE AÇÕES DO DESLIGAMENTO ── */}
            <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
                <DialogContent className="max-w-xl bg-white border border-slate-200 text-slate-900 rounded-2xl p-6 shadow-2xl">
                    {selectedEmployee && (
                        <>
                            <DialogHeader>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                                            <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
                                            Ações do Desligamento
                                        </DialogTitle>
                                        <DialogDescription className="text-xs text-slate-500 mt-1">
                                            Gerenciamento completo de documentos, prazos e tramitação do colaborador.
                                        </DialogDescription>
                                    </div>
                                    <span
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shrink-0"
                                        style={{
                                            backgroundColor: getProcessBadgeStyle(selectedEmployee.type).bg,
                                            color: getProcessBadgeStyle(selectedEmployee.type).color,
                                            borderColor: `${getProcessBadgeStyle(selectedEmployee.type).color}30`
                                        }}
                                    >
                                        {selectedEmployee.type}
                                    </span>
                                </div>
                            </DialogHeader>

                            {/* Cartão de Identificação do Colaborador & Prazos */}
                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 my-2 space-y-3">
                                <div>
                                    <h4 className="text-base font-bold text-slate-900">{selectedEmployee.name}</h4>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                        <span className="font-medium">{selectedEmployee.role?.name}</span>
                                        <span>•</span>
                                        <span className="font-semibold text-slate-700">{selectedEmployee.company?.name || "Sem Empresa"}</span>
                                        <span>•</span>
                                        <span>Posto: {selectedEmployee.postoLabel}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                                    <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Início</span>
                                        <span className="font-bold text-slate-800">
                                            {selectedEmployee.startDate ? format(new Date(selectedEmployee.startDate), "dd/MM/yyyy") : "-"}
                                        </span>
                                    </div>
                                    <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Término</span>
                                        <span className="font-bold text-slate-800">
                                            {selectedEmployee.endDate ? format(new Date(selectedEmployee.endDate), "dd/MM/yyyy") : "-"}
                                        </span>
                                    </div>
                                    <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Último Dia</span>
                                        <span className="font-bold text-sky-800">
                                            {selectedEmployee.lastWorkingDay ? format(new Date(selectedEmployee.lastWorkingDay), "dd/MM/yyyy") : "-"}
                                        </span>
                                    </div>
                                    <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Prazo Pgto</span>
                                        <span className="font-bold text-emerald-800">
                                            {selectedEmployee.paymentDeadline ? format(new Date(selectedEmployee.paymentDeadline), "dd/MM/yyyy") : "-"}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                                    <div className="flex items-center gap-1">
                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Solicitado por: <strong>{selectedEmployee.createdByName || "Sistema"}</strong></span>
                                    </div>
                                    {selectedEmployee.createdAt && (
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                                            <span>{format(new Date(selectedEmployee.createdAt), "dd/MM/yyyy HH:mm")}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Seção 1: Documentos & Assinatura Digital */}
                            <div className="space-y-2">
                                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-indigo-500" />
                                    Documentos e Assinatura Digital
                                </h5>

                                <div className="flex flex-wrap items-center gap-2">
                                    {selectedEmployee.dismissalProcess?.type ? (
                                        <DismissalNoticeButtons
                                            employeeId={selectedEmployee.id}
                                            employeeName={selectedEmployee.name}
                                            employeePhone={selectedEmployee.phone}
                                            dismissalProcess={selectedEmployee.dismissalProcess}
                                        />
                                    ) : (
                                        <InitiateDismissalDialog
                                            employeeId={selectedEmployee.id}
                                            employeeName={selectedEmployee.name}
                                            admissionDate={selectedEmployee.admissionDate}
                                            hasActivePosto={Boolean(selectedEmployee.assignments && selectedEmployee.assignments.length > 0)}
                                            triggerVariant="table"
                                        />
                                    )}

                                    {selectedEmployee.dismissalProcess?.attachment && (
                                        <ResignationLetterDownloadButton
                                            fileName={selectedEmployee.dismissalProcess.attachment.fileName}
                                            fileData={selectedEmployee.dismissalProcess.attachment.fileData}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Seção 2: Telegramas de Abandono (quando aplicável) */}
                            {selectedEmployee.type === "Processo de abandono" && (
                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <h5 className="text-xs font-bold uppercase tracking-wider text-red-600 flex items-center gap-1.5">
                                        <AlertCircle className="w-4 h-4" />
                                        Registro de Telegramas de Abandono
                                    </h5>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-600 font-semibold">1º Telegrama:</span>
                                            <TelegramRegisterButton
                                                employeeId={selectedEmployee.id}
                                                telegramIndex={1}
                                                sentDate={selectedEmployee.telegram1SentDate || null}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-600 font-semibold">2º Telegrama:</span>
                                            <TelegramRegisterButton
                                                employeeId={selectedEmployee.id}
                                                telegramIndex={2}
                                                sentDate={selectedEmployee.telegram2SentDate || null}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Seção 3: Gestão do Colaborador & Posto */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <Briefcase className="w-4 h-4 text-slate-500" />
                                    Navegação e Alocação
                                </h5>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            window.open(`/admin/employees/${selectedEmployee.id}`, "_blank");
                                        }}
                                        className="h-9 text-xs font-semibold text-slate-700 hover:text-slate-900 border-slate-200 rounded-xl"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                                        Abrir Ficha do Colaborador
                                    </Button>

                                    {selectedEmployee.assignments && selectedEmployee.assignments.length > 0 && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleMoveToRotativo(selectedEmployee)}
                                            disabled={loadingAction}
                                            className="h-9 text-xs font-semibold text-amber-700 border-amber-200 hover:bg-amber-50 rounded-xl"
                                        >
                                            <ArrowRight className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                                            Mover para o Rotativo
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Seção 4: Conclusão ou Cancelamento */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <UserX className="w-4 h-4 text-red-500" />
                                    Encerramento do Processo
                                </h5>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCancelProcess(selectedEmployee)}
                                        disabled={loadingAction}
                                        className="h-9 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
                                    >
                                        <Ban className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                                        Cancelar Processo (Voltar p/ Ativo)
                                    </Button>

                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => setFinalizeDialogOpen(true)}
                                        disabled={loadingAction}
                                        className="h-9 text-xs font-bold rounded-xl px-4 shadow-sm"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                        Efetivar Desligamento Definitivo
                                    </Button>
                                </div>
                            </div>

                            <DialogFooter className="mt-4 pt-3 border-t border-slate-100">
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedEmployee(null)}
                                    className="rounded-xl text-xs font-bold"
                                >
                                    Fechar
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal de Confirmação de Efetivação */}
            <Dialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
                <DialogContent className="max-w-md bg-white rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
                            <UserX className="w-5 h-5" />
                            Confirmar Efetivação do Desligamento
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Isso desativará o colaborador do quadro ativo e arquivará o processo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 my-3">
                        <Label className="text-xs font-semibold text-slate-700">
                            Observações finais (Opcional):
                        </Label>
                        <Textarea
                            placeholder="Ex: Homologação concluída, TRCT assinado e comprovante arquivado."
                            value={finalizeNotes}
                            onChange={(e) => setFinalizeNotes(e.target.value)}
                            className="text-xs"
                            rows={3}
                        />
                    </div>

                    <DialogFooter className="flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setFinalizeDialogOpen(false)}
                            className="rounded-xl text-xs"
                        >
                            Voltar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleFinalize}
                            disabled={loadingAction}
                            className="rounded-xl text-xs font-bold"
                        >
                            {loadingAction ? "Finalizando..." : "Confirmar e Desativar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
