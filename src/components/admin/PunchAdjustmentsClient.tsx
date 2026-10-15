"use client";

import React, { useState } from "react";
import {
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    RefreshCw,
    Search,
    Send,
    User,
    Building2,
    MapPin,
    Calendar,
    Smartphone,
    Check,
    Zap,
    MessageSquare,
    ExternalLink,
    Sparkles,
    FileSpreadsheet,
    ShieldAlert,
    Filter,
    Trash2,
    CalendarX2,
    BarChart3,
    Wrench,
    ChevronRight
} from "lucide-react";
import PunchInconsistenciesClient from "@/components/admin/PunchInconsistenciesClient";
import ManagerPunchAuditAnalytics from "@/components/admin/ManagerPunchAuditAnalytics";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import {
    syncSecullumJustifications,
    checkPunchAgainstSecullum,
    approveAndSyncPunchAdjustment,
    discardPunchAdjustment,
    createPunchAdjustmentAlert,
    sendPunchAdjustmentAlertAction,
    deletePunchAdjustment,
    autoCheckAllPendingOfflinePunches,
    fixAndSyncIncompletePunch,
    fetchScheduleForAdjustment,
    launchHolidayForAdjustment
} from "@/actions/punch-adjustments";
import { autoFixIntervals } from "@/actions/punch-inconsistencies";

interface PunchAdjustmentItem {
    id: string;
    code: string;
    date: string | Date;
    punchType: string;
    expectedTime: string;
    requestedTime: string | null;
    requestedAt?: string | Date | null;
    punchScope?: string | null;
    secullumReasonId?: string | null;
    secullumReasonName: string | null;
    notes?: string | null;
    status: string;
    source: string;
    requestedByPhone: string | null;
    requestedByName: string | null;
    isAccountManager: boolean;
    secullumStatus: string | null;
    secullumResponseLog: string | null;
    isManagerError?: boolean;
    managerErrorType?: string | null;
    managerErrorDetails?: string | null;
    detectedPunches?: string | null;
    resolvedAt?: string | Date | null;
    resolvedByUser?: {
        id: string;
        name: string;
    } | null;
    employee: {
        id: string;
        name: string;
        cpf: string;
    };
    client: {
        id: string;
        name: string;
        accountManager: {
            id: string;
            name: string;
            phone: string | null;
        } | null;
    } | null;
    posto: {
        id: string;
        role?: {
            name: string;
        } | null;
    } | null;
}

interface JustificationItem {
    id: string;
    secullumId: number | null;
    codigo: string | null;
    descricao: string;
    abonar: boolean;
}

interface Props {
    initialAdjustments: PunchAdjustmentItem[];
    justifications: JustificationItem[];
    employeesList: Array<{ id: string; name: string; cpf: string; companyName?: string }>;
    whatsappGroups?: Array<{ id: string; name: string; phone: string }>;
    clients?: Array<{ id: string; name: string }>;
    managers?: Array<{ id: string; name: string; hasPhone: boolean }>;
    initialMainTab?: "ADJUSTMENTS" | "INCONSISTENCIES" | "MANAGERS";
}

export default function PunchAdjustmentsClient({
    initialAdjustments,
    justifications: initialJusts,
    employeesList,
    whatsappGroups = [],
    clients = [],
    managers = [],
    initialMainTab = "INCONSISTENCIES"
}: Props) {
    const [activeMainTab, setActiveMainTab] = useState<"ADJUSTMENTS" | "INCONSISTENCIES" | "MANAGERS">(initialMainTab);
    const [adjustments, setAdjustments] = useState<PunchAdjustmentItem[]>(initialAdjustments);
    const [justifications, setJustifications] = useState<JustificationItem[]>(initialJusts);
    const [activeTab, setActiveTab] = useState<string>("ALL");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [checkingId, setCheckingId] = useState<string | null>(null);
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [isSyncingJusts, setIsSyncingJusts] = useState(false);
    const [isAutoFixing, setIsAutoFixing] = useState(false);
    const [isAutoCheckingOffline, setIsAutoCheckingOffline] = useState(false);

    // Modal de Lançar Batida Faltante / Corrigir Erro do Gestor
    const [fixModalItem, setFixModalItem] = useState<PunchAdjustmentItem | null>(null);
    const [fixPunches, setFixPunches] = useState<Record<string, string>>({
        Entrada1: "",
        Saida1: "",
        Entrada2: "",
        Saida2: "",
        Entrada3: "",
        Saida3: ""
    });
    const [fixNotes, setFixNotes] = useState("");
    const [isSavingFix, setIsSavingFix] = useState(false);
    const [holidayReasonId, setHolidayReasonId] = useState<string>("");
    const [isLaunchingHoliday, setIsLaunchingHoliday] = useState(false);
    const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

    const handleOpenFixModal = async (item: PunchAdjustmentItem) => {
        setFixModalItem(item);
        setHolidayReasonId("");
        setFixNotes(item.notes || `Ajuste #${item.code} - ${item.secullumReasonName || "Ponto"}`);

        const initial: Record<string, string> = {
            Entrada1: "",
            Saida1: "",
            Entrada2: "",
            Saida2: "",
            Entrada3: "",
            Saida3: ""
        };

        // 1. Extrair batidas detectadas no Secullum
        const detected = item.detectedPunches || item.secullumResponseLog || "";
        const parts = detected.split("|");
        for (const part of parts) {
            const trimmed = part.trim();
            const match = trimmed.match(/(E1|S1|E2|S2|E3|S3)\s*:\s*(\d{1,2}:\d{2})/i);
            if (match) {
                const label = match[1].toUpperCase();
                const hora = match[2];
                if (label === "E1") initial.Entrada1 = hora;
                else if (label === "S1") initial.Saida1 = hora;
                else if (label === "E2") initial.Entrada2 = hora;
                else if (label === "S2") initial.Saida2 = hora;
                else if (label === "E3") initial.Entrada3 = hora;
                else if (label === "S3") initial.Saida3 = hora;
            }
        }

        // 2. Extrair horários do texto solicitado ou previsto (ex: "06:00 / 12:00 / 13:00 / 18:00")
        const textTimes = (item.requestedTime || item.expectedTime || "").match(/\b\d{1,2}:\d{2}\b/g) || [];
        if (textTimes.length >= 4) {
            if (!initial.Entrada1) initial.Entrada1 = textTimes[0]!;
            if (!initial.Saida1) initial.Saida1 = textTimes[1]!;
            if (!initial.Entrada2) initial.Entrada2 = textTimes[2]!;
            if (!initial.Saida2) initial.Saida2 = textTimes[3]!;
        } else if (textTimes.length === 2) {
            if (!initial.Entrada1) initial.Entrada1 = textTimes[0]!;
            if (!initial.Saida2) initial.Saida2 = textTimes[1]!;
        }

        setFixPunches(initial);

        // 3. Buscar horários oficiais da escala do Secullum para preencher os que faltarem!
        setIsLoadingSchedule(true);
        try {
            const schedRes = await fetchScheduleForAdjustment(item.id);
            if (schedRes.success && schedRes.punches) {
                setFixPunches(prev => ({
                    Entrada1: prev.Entrada1 || schedRes.punches?.Entrada1 || "",
                    Saida1: prev.Saida1 || schedRes.punches?.Saida1 || "",
                    Entrada2: prev.Entrada2 || schedRes.punches?.Entrada2 || "",
                    Saida2: prev.Saida2 || schedRes.punches?.Saida2 || "",
                    Entrada3: prev.Entrada3 || schedRes.punches?.Entrada3 || "",
                    Saida3: prev.Saida3 || schedRes.punches?.Saida3 || ""
                }));
            }
        } catch (e) {
            console.warn("Erro ao buscar escala Secullum:", e);
        } finally {
            setIsLoadingSchedule(false);
        }
    };

    const handleLaunchHoliday = async () => {
        if (!fixModalItem) return;
        const selectedJust = justifications.find(j => j.id === holidayReasonId || j.descricao === holidayReasonId);
        if (!selectedJust) {
            toast.error("Selecione um motivo de Feriado ou Abono.");
            return;
        }

        setIsLaunchingHoliday(true);
        try {
            const res = await launchHolidayForAdjustment({
                adjustmentId: fixModalItem.id,
                justificativaCodigo: selectedJust.codigo || selectedJust.id,
                observacao: fixNotes || "Feriado/Abono lançado pelo RH via Hub",
                abonar: selectedJust.abonar
            });
            if (res.success) {
                toast.success(res.message);
                setFixModalItem(null);
                setAdjustments(prev => prev.map(a => a.id === fixModalItem.id ? { ...a, status: "APPROVED_SYNCED", secullumStatus: "SUCESSO", secullumReasonName: selectedJust.descricao } : a));
            } else {
                toast.error(res.message);
            }
        } catch {
            toast.error("Erro ao lançar feriado/abono.");
        } finally {
            setIsLaunchingHoliday(false);
        }
    };

    const handleSaveFix = async () => {
        if (!fixModalItem) return;
        const punchesToSend: Array<{ coluna: string; hora: string }> = [];
        for (const [col, val] of Object.entries(fixPunches)) {
            const h = val?.trim();
            if (h && /^\d{1,2}:\d{2}$/.test(h)) {
                punchesToSend.push({ coluna: col, hora: h });
            }
        }

        if (punchesToSend.length === 0) {
            toast.error("Informe pelo menos um horário válido no formato HH:mm.");
            return;
        }

        setIsSavingFix(true);
        try {
            const res = await fixAndSyncIncompletePunch({
                adjustmentId: fixModalItem.id,
                punches: punchesToSend,
                notes: fixNotes
            });
            if (res.success) {
                toast.success(res.message);
                setFixModalItem(null);
                window.location.reload();
            } else {
                toast.error(res.message);
            }
        } catch {
            toast.error("Erro ao salvar batida corrigida.");
        } finally {
            setIsSavingFix(false);
        }
    };

    // Baixa automática de batidas offline em massa
    const handleAutoCheckOffline = async () => {
        setIsAutoCheckingOffline(true);
        try {
            const res = await autoCheckAllPendingOfflinePunches();
            if (res.success) {
                toast.success(res.message, { duration: 8000 });
                window.location.reload();
            } else {
                toast.error(res.message);
            }
        } catch {
            toast.error("Erro ao verificar batidas offline.");
        } finally {
            setIsAutoCheckingOffline(false);
        }
    };

    // Varre os últimos 7 dias e lança automaticamente o intervalo esquecido (entrada/saída conferem com a escala)
    const handleAutoFixIntervals = async () => {
        setIsAutoFixing(true);
        try {
            const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
            const endDate = fmt(new Date(Date.now() - 86400000));
            const startDate = fmt(new Date(Date.now() - 7 * 86400000));
            const res = await autoFixIntervals({ startDate, endDate });
            if (!res.success) {
                toast.error(res.message || "Erro ao varrer intervalos.");
            } else if (res.fixed.length === 0 && res.failed.length === 0) {
                toast.info("Nenhum intervalo elegível para ajuste automático nos últimos 7 dias.");
            } else {
                toast.success(`⚡ ${res.fixed.length} intervalo(s) lançado(s) automaticamente${res.failed.length ? `, ${res.failed.length} com falha (ficam Pendentes RH)` : ""}.`, { duration: 8000 });
                window.location.reload();
            }
        } catch {
            toast.error("Erro ao varrer intervalos.");
        } finally {
            setIsAutoFixing(false);
        }
    };

    // Modal de Teste
    const defaultGroup = whatsappGroups.find(g => g.name.toLowerCase().includes("ajuste"))?.phone
        || "120363412937009664-group";
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const [testEmpId, setTestEmpId] = useState("");
    const [testPunchType, setTestPunchType] = useState<"ENTRADA_1" | "SAIDA_1">("ENTRADA_1");
    const [testExpectedTime, setTestExpectedTime] = useState("07:00");
    const [testGroupTarget, setTestGroupTarget] = useState(defaultGroup);
    const [isSendingTest, setIsSendingTest] = useState(false);

    const isAbsence = (item: PunchAdjustmentItem) => {
        return item.status === "CONFIRMED_ABSENCE" ||
            item.secullumReasonId === "FALTA" ||
            Boolean(item.secullumReasonName?.toUpperCase().includes("FALTA")) ||
            Boolean(item.notes?.toUpperCase().includes("FALTA"));
    };

    // Estatísticas dos cards (Padrão Atestados)
    const stats = {
        total: adjustments.length,
        pendingResponse: adjustments.filter(a => a.status === "PENDING_RESPONSE").length,
        pendingAudit: adjustments.filter(a => a.status === "PENDING_AUDIT" && !isAbsence(a)).length,
        approved: adjustments.filter(a => a.status === "APPROVED_SYNCED" && !isAbsence(a)).length,
        offlineFound: adjustments.filter(a => a.status === "DISCARDED_OFFLINE_FOUND").length,
        absence: adjustments.filter(isAbsence).length
    };

    // Sincronizar justificativas com Secullum
    const handleSyncJusts = async () => {
        setIsSyncingJusts(true);
        try {
            const res = await syncSecullumJustifications();
            if (res.success) {
                toast.success(res.message);
                window.location.reload();
            } else {
                toast.error(res.message);
            }
        } catch {
            toast.error("Erro ao sincronizar justificativas.");
        } finally {
            setIsSyncingJusts(false);
        }
    };

    // Checar batida offline em tempo real no Secullum
    const handleCheckSecullum = async (item: PunchAdjustmentItem) => {
        setCheckingId(item.id);
        try {
            const res = await checkPunchAgainstSecullum(item.id);
            if (res.hasPunch) {
                toast.success(`⚡ Batida Detectada no Secullum! (${(res.punches || []).join(" | ")}). Movido para Batidas Offline.`, {
                    duration: 7000
                });
                setAdjustments(prev => prev.map(a => a.id === item.id ? {
                    ...a,
                    status: "DISCARDED_OFFLINE_FOUND",
                    secullumStatus: "SUCESSO",
                    secullumResponseLog: res.message ?? null
                } : a));
            } else {
                toast.info(`✅ Confirmado: ${res.message || "Nenhuma batida encontrada"}`);
            }
        } catch {
            toast.error("Erro ao consultar Secullum em tempo real.");
        } finally {
            setCheckingId(null);
        }
    };

    // Aprovar e injetar no Secullum
    const handleApprove = async (id: string) => {
        setApprovingId(id);
        try {
            const res = await approveAndSyncPunchAdjustment(id);
            if (res.success) {
                toast.success(`✅ ${res.message || "Gravado no Secullum com sucesso!"}`, { duration: 8000 });
                setAdjustments(prev => prev.map(a => a.id === id ? { 
                    ...a, 
                    status: "APPROVED_SYNCED", 
                    secullumStatus: "SUCESSO",
                    secullumResponseLog: res.message ?? null,
                    requestedTime: (res as any).adjustment?.requestedTime ?? a.requestedTime 
                } : a));
            } else {
                toast.error(res.message || "Erro ao injetar ajuste no Secullum.");
                setAdjustments(prev => prev.map(a => a.id === id ? {
                    ...a,
                    secullumStatus: "ERRO",
                    secullumResponseLog: res.message ?? null
                } : a));
            }
        } catch {
            toast.error("Erro de conexão ao aprovar ajuste.");
        } finally {
            setApprovingId(null);
        }
    };

    // Descartar solicitação
    const handleDiscard = async (id: string, reason: string) => {
        try {
            const res = await discardPunchAdjustment(id, reason);
            if (res.success) {
                toast.info(reason === "OFFLINE_FOUND" ? "Descartado: Batida offline confirmada." : "Solicitação descartada.");
                setAdjustments(prev => prev.map(a => a.id === id ? { ...a, status: reason === "OFFLINE_FOUND" ? "DISCARDED_OFFLINE_FOUND" : "REJECTED" } : a));
            }
        } catch {
            toast.error("Erro ao descartar solicitação.");
        }
    };

    // Excluir ocorrência definitivamente
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const handleDelete = async (item: PunchAdjustmentItem) => {
        if (!window.confirm(`Excluir definitivamente a ocorrência #${item.code} de ${item.employee?.name}?\n\nEssa ação não pode ser desfeita.`)) return;
        setDeletingId(item.id);
        try {
            const res = await deletePunchAdjustment(item.id);
            if (res.success) {
                toast.success(`Ocorrência #${item.code} excluída.`);
                setAdjustments(prev => prev.filter(a => a.id !== item.id));
            } else {
                toast.error(res.message || "Erro ao excluir ocorrência.");
            }
        } catch {
            toast.error("Erro ao excluir ocorrência.");
        } finally {
            setDeletingId(null);
        }
    };

    // Criar e disparar teste de alerta WhatsApp
    const handleSendTestAlert = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!testEmpId) {
            toast.error("Selecione um colaborador para o teste.");
            return;
        }

        setIsSendingTest(true);
        try {
            const createRes = await createPunchAdjustmentAlert({
                employeeId: testEmpId,
                date: new Date(),
                punchType: testPunchType,
                expectedTime: testExpectedTime,
                notes: "Disparo de Teste de Automação de Batida",
                whatsappGroupId: testGroupTarget || undefined
            });

            if (!createRes.success || !createRes.adjustment) {
                toast.error(createRes.message || "Erro ao criar alerta de teste.");
                return;
            }

            // Disparar no WhatsApp via Server Action
            const sendRes = await sendPunchAdjustmentAlertAction(createRes.adjustment.id, testGroupTarget || undefined);
            if (sendRes.success) {
                toast.success(`🎉 Alerta #${createRes.adjustment.code} enviado no WhatsApp com sucesso!`);
                setIsTestModalOpen(false);
                window.location.reload();
            } else {
                toast.error(`Alerta criado, mas falhou ao enviar WhatsApp: ${sendRes.message}`);
            }
        } catch (err: any) {
            toast.error(err.message || "Falha no envio de teste.");
        } finally {
            setIsSendingTest(false);
        }
    };

    // Filtragem dos registros
    const filteredItems = adjustments.filter(item => {
        if (activeTab === "PENDING_RESPONSE" && item.status !== "PENDING_RESPONSE") return false;
        if (activeTab === "PENDING_AUDIT" && (item.status !== "PENDING_AUDIT" || isAbsence(item))) return false;
        if (activeTab === "APPROVED_SYNCED" && (item.status !== "APPROVED_SYNCED" || isAbsence(item))) return false;
        if (activeTab === "DISCARDED_OFFLINE_FOUND" && item.status !== "DISCARDED_OFFLINE_FOUND") return false;
        if (activeTab === "CONFIRMED_ABSENCE" && !isAbsence(item)) return false;

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            const empName = item.employee?.name?.toLowerCase() || "";
            const clientName = item.client?.name?.toLowerCase() || "";
            const code = item.code?.toLowerCase() || "";
            return empName.includes(term) || clientName.includes(term) || code.includes(term);
        }
        return true;
    });

    const formatDataExibicao = (dateVal: any) => {
        if (!dateVal) return "-";
        try {
            const d = typeof dateVal === "string" ? parseISO(dateVal) : new Date(dateVal);
            return format(d, "dd/MM/yyyy", { locale: ptBR });
        } catch {
            return String(dateVal).split("T")[0];
        }
    };

    const getStatusBadge = (item: PunchAdjustmentItem) => {
        if (isAbsence(item)) {
            if (item.status === "APPROVED_SYNCED") {
                return (
                    <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="bg-rose-50 text-rose-800 border-rose-300 font-bold gap-1.5 py-0.5 w-fit">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            Falta Confirmada
                        </Badge>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-semibold gap-1 py-0 px-1.5 w-fit">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Lançada no Secullum
                        </Badge>
                    </div>
                );
            }
            if (item.status === "PENDING_AUDIT") {
                return (
                    <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="bg-rose-50 text-rose-800 border-rose-300 font-bold gap-1.5 py-0.5 w-fit animate-pulse">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            Falta Confirmada (Pendente RH)
                        </Badge>
                    </div>
                );
            }
            return (
                <Badge variant="outline" className="bg-rose-50 text-rose-800 border-rose-300 font-semibold gap-1.5 py-0.5">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    Falta Confirmada
                </Badge>
            );
        }

        switch (item.status) {
            case "PENDING_RESPONSE":
            case "PENDING_REASON":
            case "PENDING_SCOPE":
                return (
                    <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-semibold gap-1.5 py-0.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Aguardando Gestor
                    </Badge>
                );
            case "PENDING_AUDIT":
                return (
                    <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-300 font-bold gap-1.5 py-0.5 animate-pulse">
                        <Zap className="w-3.5 h-3.5 text-sky-600" />
                        Pendente RH (Pronto)
                    </Badge>
                );
            case "APPROVED_SYNCED":
                return (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-bold gap-1.5 py-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Lançado no Secullum
                    </Badge>
                );
            case "DISCARDED_OFFLINE_FOUND":
                return (
                    <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-300 font-semibold gap-1.5 py-0.5">
                        <RefreshCw className="w-3.5 h-3.5 text-purple-600" />
                        Batida Offline Detectada
                    </Badge>
                );
            case "CONFIRMED_ABSENCE":
                return (
                    <Badge variant="outline" className="bg-rose-50 text-rose-800 border-rose-300 font-semibold gap-1.5 py-0.5">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        Falta Confirmada
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                        {item.status}
                    </Badge>
                );
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Ações Rápidas (Design Corporativo Moderno) */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                            Nexus + Secullum Web
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            WhatsApp Conectado
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                        <Clock className="w-7 h-7 text-indigo-600" />
                        Ajustes de Ponto & Ocorrências
                    </h1>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                        Tratamento e auditoria de inconsistências, apontamentos dos líderes via WhatsApp e integração com Secullum.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={handleAutoCheckOffline}
                        disabled={isAutoCheckingOffline}
                        title="Varre todas as pendências no Secullum e baixa automaticamente se a batida já constar no ponto"
                        className="bg-white border-purple-200 hover:bg-purple-50 text-purple-700 font-semibold rounded-xl h-10 shadow-sm"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isAutoCheckingOffline ? "animate-spin text-purple-600" : "text-purple-600"}`} />
                        <span>{isAutoCheckingOffline ? "Verificando..." : "Baixar Batidas Offline"}</span>
                    </Button>

                    <Button
                        variant="outline"
                        onClick={handleAutoFixIntervals}
                        disabled={isAutoFixing}
                        title="Lança automaticamente o intervalo quando entrada e saída conferem com a escala"
                        className="bg-white border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-semibold rounded-xl h-10 shadow-sm"
                    >
                        <Zap className={`w-4 h-4 mr-2 ${isAutoFixing ? "animate-pulse" : ""}`} />
                        <span>{isAutoFixing ? "Varrendo..." : "Varrer intervalos agora"}</span>
                    </Button>

                    <Button
                        variant="outline"
                        onClick={handleSyncJusts}
                        disabled={isSyncingJusts}
                        className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl h-10 shadow-sm"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isSyncingJusts ? "animate-spin text-sky-600" : "text-slate-500"}`} />
                        <span>Sincronizar Motivos ({justifications.length})</span>
                    </Button>

                    <Button
                        onClick={() => setIsTestModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm rounded-xl px-4 h-10 flex items-center gap-2 transition-all duration-200 hover:shadow-md"
                    >
                        <Send className="w-4 h-4 text-indigo-200" />
                        <span>Disparar Alerta de Teste (WhatsApp)</span>
                    </Button>
                </div>
            </div>

            {/* Abas Principais: 1. Inconsistências (Secullum) | 2. Gestão de Ajustes (Solicitações/Respostas) | 3. Auditoria & Ranking de Gestores */}
            <div className="flex border-b border-slate-200">
                <button
                    id="tab-inconsistencies"
                    type="button"
                    onClick={() => setActiveMainTab("INCONSISTENCIES")}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all duration-150 ${
                        activeMainTab === "INCONSISTENCIES"
                            ? "border-rose-600 text-rose-600 bg-rose-50/40"
                            : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                    }`}
                >
                    <CalendarX2 className="w-4 h-4 text-rose-500" />
                    <span>Inconsistências de Ponto</span>
                    <span className="text-[10px] font-semibold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                        Detecção Secullum
                    </span>
                </button>

                <button
                    id="tab-adjustments"
                    type="button"
                    onClick={() => setActiveMainTab("ADJUSTMENTS")}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all duration-150 ${
                        activeMainTab === "ADJUSTMENTS"
                            ? "border-sky-600 text-sky-600 bg-sky-50/40"
                            : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                    }`}
                >
                    <Clock className="w-4 h-4 text-sky-600" />
                    <span>Gestão de Ajustes & Aprovações</span>
                    {stats.pendingAudit > 0 && (
                        <span className="text-[10px] font-semibold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full animate-pulse">
                            {stats.pendingAudit} pendentes
                        </span>
                    )}
                </button>

                <button
                    id="tab-managers"
                    type="button"
                    onClick={() => setActiveMainTab("MANAGERS")}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all duration-150 ${
                        activeMainTab === "MANAGERS"
                            ? "border-amber-600 text-amber-600 bg-amber-50/40"
                            : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                    }`}
                >
                    <BarChart3 className="w-4 h-4 text-amber-500" />
                    <span>Ranking & Auditoria de Gestores</span>
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        Abonos & Erros
                    </span>
                </button>
            </div>

            {activeMainTab === "INCONSISTENCIES" ? (
                <PunchInconsistenciesClient
                    clients={clients}
                    managers={managers}
                    hideHeader={true}
                />
            ) : activeMainTab === "MANAGERS" ? (
                <ManagerPunchAuditAnalytics />
            ) : (
                <>
            {/* Cards de Métricas (Exato Padrão Atestados) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

                {/* Pendente RH (Pronto) */}
                <div
                    onClick={() => setActiveTab("PENDING_AUDIT")}
                    className={`bg-white rounded-xl border p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md ${activeTab === "PENDING_AUDIT"
                            ? "border-sky-400 ring-2 ring-sky-100 bg-sky-50/20"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-sky-800">
                            Pendente RH (Pronto)
                        </span>
                        <div className="p-2.5 bg-sky-100 text-sky-700 rounded-xl">
                            <Zap className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-slate-900">{stats.pendingAudit}</div>
                        <p className="text-xs text-sky-700 font-medium mt-1">Solicitado pelo líder para conferência</p>
                    </div>
                </div>

                {/* Gravados no Secullum */}
                <div
                    onClick={() => setActiveTab("APPROVED_SYNCED")}
                    className={`bg-white rounded-xl border p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md ${activeTab === "APPROVED_SYNCED"
                            ? "border-emerald-400 ring-2 ring-emerald-100 bg-emerald-50/20"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                            Lançados no Secullum
                        </span>
                        <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-slate-900">{stats.approved}</div>
                        <p className="text-xs text-emerald-700 font-medium mt-1">Ajustados e integrados com sucesso</p>
                    </div>
                </div>

                {/* Batida Offline Detectada */}
                <div
                    onClick={() => setActiveTab("DISCARDED_OFFLINE_FOUND")}
                    className={`bg-white rounded-xl border p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md ${activeTab === "DISCARDED_OFFLINE_FOUND"
                            ? "border-purple-400 ring-2 ring-purple-100 bg-purple-50/20"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-800">
                            Batida Offline Detectada
                        </span>
                        <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                            <RefreshCw className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-slate-900">{stats.offlineFound}</div>
                        <p className="text-xs text-purple-700 font-medium mt-1">Evitou duplicidade ou erro no ponto</p>
                    </div>
                </div>

                {/* Falta Confirmada pelo Gestor */}
                <div
                    onClick={() => setActiveTab("CONFIRMED_ABSENCE")}
                    className={`bg-white rounded-xl border p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md ${activeTab === "CONFIRMED_ABSENCE"
                            ? "border-rose-400 ring-2 ring-rose-100 bg-rose-50/20"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                            Falta Confirmada
                        </span>
                        <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
                            <XCircle className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-slate-900">{stats.absence}</div>
                        <p className="text-xs text-rose-700 font-medium mt-1">Falta confirmada pelo gestor</p>
                    </div>
                </div>

                {/* Total */}
                <div
                    onClick={() => setActiveTab("ALL")}
                    className={`bg-white rounded-xl border p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md ${activeTab === "ALL"
                            ? "border-indigo-400 ring-2 ring-indigo-100 bg-indigo-50/20"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Total Ocorrências
                        </span>
                        <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
                            <FileSpreadsheet className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-slate-900">{stats.total}</div>
                        <p className="text-xs text-slate-500 font-medium mt-1">Inconsistências registradas</p>
                    </div>
                </div>
            </div>

            {/* Painel Principal com Abas e Filtros (Exato Padrão Atestados) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Abas */}
                    <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 w-fit">
                        <button
                            onClick={() => setActiveTab("ALL")}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "ALL"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                                }`}
                        >
                            <span>Todas</span>
                            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-200 text-slate-800">
                                {stats.total}
                            </span>
                        </button>


                        <button
                            onClick={() => setActiveTab("PENDING_AUDIT")}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "PENDING_AUDIT"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                                }`}
                        >
                            <Zap className="w-3.5 h-3.5 text-sky-500" />
                            <span>Pendente RH</span>
                            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-sky-100 text-sky-800">
                                {stats.pendingAudit}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab("APPROVED_SYNCED")}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "APPROVED_SYNCED"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                                }`}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Lançados Secullum</span>
                            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                                {stats.approved}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab("DISCARDED_OFFLINE_FOUND")}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "DISCARDED_OFFLINE_FOUND"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                                }`}
                        >
                            <RefreshCw className="w-3.5 h-3.5 text-purple-500" />
                            <span>Batida Offline</span>
                            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">
                                {stats.offlineFound}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab("CONFIRMED_ABSENCE")}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "CONFIRMED_ABSENCE"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                                }`}
                        >
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            <span>Falta Confirmada pelo Gestor</span>
                            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                                {stats.absence}
                            </span>
                        </button>
                    </div>

                    {/* Campo de Busca */}
                    <div className="relative w-full sm:w-80">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                            placeholder="Buscar por colaborador, posto ou #AJ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl h-10 text-xs font-medium focus-visible:ring-indigo-500"
                        />
                    </div>
                </div>

                {/* Tabela de Ajustes (Design Corporativo Compacto) */}
                <div className="rounded-xl border border-slate-200 overflow-hidden w-full overflow-x-auto shadow-sm bg-white">
                    <Table className="min-w-[900px]">
                        <TableHeader className="bg-slate-50 border-b border-slate-200">
                            <TableRow>
                                <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider py-3 w-[150px]">Código / Data</TableHead>
                                <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider py-3">Colaborador</TableHead>
                                <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider py-3">Contrato & Posto</TableHead>
                                <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider py-3">Gestor Responsável</TableHead>
                                <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider py-3">Marcação Solicitada</TableHead>
                                <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider py-3">Status</TableHead>
                                <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider py-3 text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-40 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                                                <Clock className="w-5 h-5" />
                                            </div>
                                            <p className="text-sm font-semibold text-slate-600">Nenhum ajuste de batida encontrado</p>
                                            <p className="text-xs text-slate-400">Nenhuma inconsistência pendente com os filtros selecionados.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map((item) => {
                                    const rawManager = item.requestedByName || item.client?.accountManager?.name;
                                    const displayManager = item.source === "AUTO_INTERVAL"
                                        ? "⚡ Robô de Intervalo (Hub)"
                                        : (rawManager === "Jvs Facilities" || !rawManager)
                                            ? (item.client?.accountManager?.name || "Emanuelle de Almeida Santos")
                                            : rawManager;

                                    return (
                                        <TableRow key={item.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 h-12">
                                            {/* Código e Data */}
                                            <TableCell className="py-2.5 font-medium whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                        #{item.code}
                                                    </span>
                                                    <span className="text-xs text-slate-600 font-semibold">
                                                        {formatDataExibicao(item.date)}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            {/* Colaborador */}
                                            <TableCell className="py-2.5">
                                                <div className="font-bold text-slate-900 text-xs truncate max-w-[200px]" title={item.employee?.name || ""}>
                                                    {item.employee?.name}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono">
                                                    CPF: {item.employee?.cpf}
                                                </div>
                                            </TableCell>

                                            {/* Contrato e Posto */}
                                            <TableCell className="py-2.5">
                                                <div className="text-slate-800 font-semibold text-xs flex items-center gap-1 truncate max-w-[180px]" title={item.client?.name || "Sem Contrato"}>
                                                    <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                    <span className="truncate">{item.client?.name || "Sem Contrato"}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                                                    {item.posto?.role?.name || "Geral"}
                                                </div>
                                            </TableCell>

                                            {/* Gestor Responsável */}
                                            <TableCell className="py-2.5">
                                                <div className="text-xs font-semibold text-slate-800 flex items-center gap-1 truncate max-w-[180px]" title={displayManager}>
                                                    <User className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                                                    <span className="truncate">{displayManager}</span>
                                                </div>
                                            </TableCell>

                                            {/* Marcação Solicitada */}
                                            <TableCell className="py-2.5 max-w-[240px]">
                                                <div className="text-xs font-bold text-slate-850 truncate">
                                                    {item.requestedTime || item.expectedTime || "Ajuste de Ponto"}
                                                </div>
                                                <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                                                    <span className="truncate">{item.secullumReasonName || "Sem motivo informado"}</span>
                                                    {(item.isManagerError || item.detectedPunches) && (
                                                        <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold flex-shrink-0" title={item.detectedPunches || "Constam marcações no Secullum"}>
                                                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                                            Secullum
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Status */}
                                            <TableCell className="py-2.5 whitespace-nowrap">
                                                {getStatusBadge(item)}
                                            </TableCell>

                                            {/* Ações */}
                                            <TableCell className="py-2.5 text-right whitespace-nowrap">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleOpenFixModal(item)}
                                                    className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm rounded-lg inline-flex items-center gap-1"
                                                >
                                                    <span>Tratar / Detalhes</span>
                                                    <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
            </>
            )}

            {/* Modal de Disparo de Alerta de Teste (Padrão Shadcn Dialog) */}
            <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
                <DialogContent className="sm:max-w-lg bg-white border border-slate-200 text-slate-900 shadow-2xl rounded-2xl">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-indigo-600 mb-1">
                            <Send className="w-5 h-5" />
                            <DialogTitle className="text-xl font-bold text-slate-900">
                                Disparar Alerta de Teste no WhatsApp
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-xs text-slate-500">
                            Dispara uma mensagem formatada no grupo com a @menção do gestor da conta e todos os motivos do Secullum cadastrados.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSendTestAlert} className="space-y-4 pt-2">
                        <div>
                            <Label className="text-xs font-bold text-slate-700">Colaborador para Teste</Label>
                            <select
                                value={testEmpId}
                                onChange={(e) => setTestEmpId(e.target.value)}
                                required
                                className="w-full mt-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Selecione um colaborador...</option>
                                {employeesList.map((e) => (
                                    <option key={e.id} value={e.id}>
                                        {e.name} (CPF: {e.cpf}) {e.companyName ? `- ${e.companyName}` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-bold text-slate-700">Tipo de Marcação</Label>
                                <select
                                    value={testPunchType}
                                    onChange={(e) => setTestPunchType(e.target.value as any)}
                                    className="w-full mt-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="ENTRADA_1">Entrada 1 (Início do Turno)</option>
                                    <option value="SAIDA_1">Saída 1 (Almoço)</option>
                                </select>
                            </div>

                            <div>
                                <Label className="text-xs font-bold text-slate-700">Horário Previsto</Label>
                                <Input
                                    type="time"
                                    value={testExpectedTime}
                                    onChange={(e) => setTestExpectedTime(e.target.value)}
                                    className="mt-1.5 bg-white border-slate-200 text-slate-900 rounded-xl h-10 text-sm font-semibold"
                                />
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs font-bold text-slate-700">Grupo WhatsApp de Destino</Label>
                            {whatsappGroups.length > 0 ? (
                                <select
                                    value={testGroupTarget}
                                    onChange={(e) => setTestGroupTarget(e.target.value)}
                                    className="w-full mt-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {whatsappGroups.map((g) => (
                                        <option key={g.id} value={g.phone}>
                                            {g.name}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <Input
                                    type="text"
                                    placeholder="Ex: 120363..."
                                    value={testGroupTarget}
                                    onChange={(e) => setTestGroupTarget(e.target.value)}
                                    className="mt-1.5 bg-white border-slate-200 text-slate-900 rounded-xl h-10 text-sm font-medium"
                                />
                            )}
                            <p className="text-[11px] text-slate-500 mt-1">
                                Os grupos foram carregados automaticamente via Z-API. Selecione o grupo que você acabou de criar.
                            </p>
                        </div>

                        <div className="p-3 bg-sky-50 border border-sky-200/80 rounded-xl text-xs text-sky-800">
                            💡 O bot vai montar o alerta formatado, com @menção do gestor da conta e a lista de motivos oficiais do Secullum.
                        </div>

                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsTestModalOpen(false)}
                                className="border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSendingTest}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm"
                            >
                                <Send className="w-4 h-4 mr-2" />
                                {isSendingTest ? "Disparando..." : "Disparar Alerta"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal de Tratativa / Auditoria / Lançamento no Secullum */}
            <Dialog open={!!fixModalItem} onOpenChange={(open) => !open && setFixModalItem(null)}>
                <DialogContent className="sm:max-w-2xl bg-white border border-slate-200 text-slate-900 shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-indigo-600 mb-1">
                            <Wrench className="w-5 h-5" />
                            <DialogTitle className="text-xl font-bold text-slate-900">
                                Tratativa de Ocorrência & Ponto Secullum
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-xs text-slate-500">
                            Audite os apontamentos do gestor, lance batidas faltantes ou aplique Feriado / Abono diretamente no Secullum Web.
                        </DialogDescription>
                    </DialogHeader>

                    {fixModalItem && (
                        <div className="space-y-4 pt-1">
                            {/* Card de Resumo da Ocorrência */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-900 text-sm">{fixModalItem.employee?.name}</span>
                                    <span className="font-mono text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded">#{fixModalItem.code}</span>
                                </div>
                                <div className="text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                                    <span><strong>Data:</strong> {formatDataExibicao(fixModalItem.date)}</span>
                                    <span><strong>CPF:</strong> {fixModalItem.employee?.cpf}</span>
                                    <span><strong>Contrato:</strong> {fixModalItem.client?.name || "Sem Contrato"}</span>
                                    <span><strong>Gestor:</strong> {fixModalItem.source === "AUTO_INTERVAL" ? "⚡ Robô de Intervalo (Hub)" : (fixModalItem.requestedByName === "Jvs Facilities" || !fixModalItem.requestedByName) ? (fixModalItem.client?.accountManager?.name || "Emanuelle de Almeida Santos") : fixModalItem.requestedByName}</span>
                                </div>
                                <div className="text-slate-700 pt-1 border-t border-slate-200/60 mt-1">
                                    <strong>Apontamento Solicitado:</strong> {fixModalItem.requestedTime || fixModalItem.expectedTime} ({fixModalItem.punchType}) · <span className="font-semibold text-amber-800">{fixModalItem.secullumReasonName || "Sem motivo"}</span>
                                </div>
                                {(fixModalItem.isManagerError || fixModalItem.detectedPunches) && (
                                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 font-medium mt-1.5">
                                        <span className="font-bold text-amber-800 block mb-0.5 flex items-center gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                            Batidas já detectadas no Secullum:
                                        </span>
                                        <p className="font-mono text-[11px] text-amber-950 font-bold bg-amber-100/70 px-1.5 py-0.5 rounded">
                                            {fixModalItem.detectedPunches || "Constam marcações no espelho"}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Seção 1: Horários das Marcações (Preenchidos da Escala) */}
                            <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-2.5">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>Horários das Marcações (HH:mm)</span>
                                    </Label>
                                    {isLoadingSchedule && (
                                        <span className="text-[10px] text-indigo-600 font-semibold animate-pulse">
                                            Carregando jornada do Secullum...
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div>
                                        <span className="text-[11px] font-semibold text-slate-600 block mb-1">Entrada 1</span>
                                        <Input
                                            type="text"
                                            placeholder="Ex: 06:00"
                                            value={fixPunches.Entrada1 || ""}
                                            onChange={(e) => setFixPunches(prev => ({ ...prev, Entrada1: e.target.value }))}
                                            className="h-8 text-xs font-mono font-bold"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-slate-600 block mb-1">Saída 1 (Almoço)</span>
                                        <Input
                                            type="text"
                                            placeholder="Ex: 12:00"
                                            value={fixPunches.Saida1 || ""}
                                            onChange={(e) => setFixPunches(prev => ({ ...prev, Saida1: e.target.value }))}
                                            className="h-8 text-xs font-mono font-bold"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-amber-700 block mb-1">Entrada 2 (Retorno)</span>
                                        <Input
                                            type="text"
                                            placeholder="Ex: 13:00"
                                            value={fixPunches.Entrada2 || ""}
                                            onChange={(e) => setFixPunches(prev => ({ ...prev, Entrada2: e.target.value }))}
                                            className="h-8 text-xs font-mono font-bold border-amber-300 bg-amber-50/40"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-slate-600 block mb-1">Saída 2 (Fim Turno)</span>
                                        <Input
                                            type="text"
                                            placeholder="Ex: 18:00"
                                            value={fixPunches.Saida2 || ""}
                                            onChange={(e) => setFixPunches(prev => ({ ...prev, Saida2: e.target.value }))}
                                            className="h-8 text-xs font-mono font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="pt-1 flex justify-end">
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleSaveFix}
                                        disabled={isSavingFix}
                                        className="h-8 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>{isSavingFix ? "Gravando..." : "Gravar Batidas no Secullum"}</span>
                                    </Button>
                                </div>
                            </div>

                            {/* Seção 2: Lançar Feriado / Abono no Secullum */}
                            <div className="p-3.5 border border-indigo-100 bg-indigo-50/30 rounded-xl space-y-2">
                                <Label className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Lançar Feriado / Abono / Justificativa no Secullum</span>
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Select value={holidayReasonId} onValueChange={setHolidayReasonId}>
                                        <SelectTrigger className="h-8 text-xs bg-white border-indigo-200">
                                            <SelectValue placeholder="Selecione Feriado, Abono, Folga..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {justifications.map((j) => (
                                                <SelectItem key={j.id} value={j.id} className="text-xs">
                                                    {j.descricao}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleLaunchHoliday}
                                        disabled={isLaunchingHoliday || !holidayReasonId}
                                        className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm whitespace-nowrap flex items-center gap-1"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>{isLaunchingHoliday ? "Lançando..." : "Lançar no Secullum"}</span>
                                    </Button>
                                </div>
                            </div>

                            {/* Observações / Justificativa */}
                            <div>
                                <Label className="text-xs font-bold text-slate-700 block mb-1">
                                    Observação / Justificativa de Auditoria
                                </Label>
                                <textarea
                                    rows={2}
                                    value={fixNotes}
                                    onChange={(e) => setFixNotes(e.target.value)}
                                    className="w-full text-xs p-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                                    placeholder="Observações da auditoria do RH..."
                                />
                            </div>

                            {/* Barra de Ações Rápidas no Rodapé */}
                            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    {/* Checar Secullum em tempo real */}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCheckSecullum(fixModalItem)}
                                        disabled={checkingId === fixModalItem.id}
                                        className="h-8 text-xs text-slate-600 border-slate-200 hover:bg-slate-100 rounded-lg flex items-center gap-1"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${checkingId === fixModalItem.id ? "animate-spin text-sky-600" : ""}`} />
                                        <span>Checar Secullum</span>
                                    </Button>

                                    {/* Descartar */}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            handleDiscard(fixModalItem.id, "OFFLINE_FOUND");
                                            setFixModalItem(null);
                                        }}
                                        className="h-8 text-xs text-slate-600 border-slate-200 hover:bg-slate-100 rounded-lg"
                                    >
                                        Descartar
                                    </Button>

                                    {/* Excluir Definitivamente */}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            handleDelete(fixModalItem);
                                            setFixModalItem(null);
                                        }}
                                        className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 rounded-lg flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Excluir</span>
                                    </Button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setFixModalItem(null)}
                                        className="h-8 text-xs border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-lg"
                                    >
                                        Fechar
                                    </Button>

                                    {/* Aprovar Ajuste Original no Secullum */}
                                    {fixModalItem.status === "PENDING_AUDIT" && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={async () => {
                                                await handleApprove(fixModalItem.id);
                                                setFixModalItem(null);
                                            }}
                                            disabled={approvingId === fixModalItem.id}
                                            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                            <span>{approvingId === fixModalItem.id ? "Aprovando..." : fixModalItem.secullumReasonName === "FALTA CONFIRMADA PELO GESTOR" ? "Lançar Falta no Secullum" : "Aprovar no Secullum"}</span>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
