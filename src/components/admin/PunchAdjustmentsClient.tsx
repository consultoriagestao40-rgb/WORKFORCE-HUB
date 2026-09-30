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
    Filter
} from "lucide-react";
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
    sendPunchAdjustmentAlertAction
} from "@/actions/punch-adjustments";

interface PunchAdjustmentItem {
    id: string;
    code: string;
    date: string | Date;
    punchType: string;
    expectedTime: string;
    requestedTime: string | null;
    secullumReasonName: string | null;
    status: string;
    source: string;
    requestedByPhone: string | null;
    requestedByName: string | null;
    isAccountManager: boolean;
    secullumStatus: string | null;
    secullumResponseLog: string | null;
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
}

export default function PunchAdjustmentsClient({
    initialAdjustments,
    justifications: initialJusts,
    employeesList,
    whatsappGroups = []
}: Props) {
    const [adjustments, setAdjustments] = useState<PunchAdjustmentItem[]>(initialAdjustments);
    const [justifications, setJustifications] = useState<JustificationItem[]>(initialJusts);
    const [activeTab, setActiveTab] = useState<string>("ALL");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [checkingId, setCheckingId] = useState<string | null>(null);
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [isSyncingJusts, setIsSyncingJusts] = useState(false);

    // Modal de Teste
    const defaultGroup = whatsappGroups.find(g => g.name.toLowerCase().includes("ajuste"))?.phone
        || whatsappGroups.find(g => g.name.toLowerCase().includes("mesa de operaç"))?.phone
        || whatsappGroups.find(g => g.name.toLowerCase().includes("operaç"))?.phone
        || "";
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const [testEmpId, setTestEmpId] = useState("");
    const [testPunchType, setTestPunchType] = useState<"ENTRADA_1" | "SAIDA_1">("ENTRADA_1");
    const [testExpectedTime, setTestExpectedTime] = useState("07:00");
    const [testGroupTarget, setTestGroupTarget] = useState(defaultGroup);
    const [isSendingTest, setIsSendingTest] = useState(false);

    // Estatísticas dos cards (Padrão Atestados)
    const stats = {
        total: adjustments.length,
        pendingResponse: adjustments.filter(a => a.status === "PENDING_RESPONSE").length,
        pendingAudit: adjustments.filter(a => a.status === "PENDING_AUDIT").length,
        approved: adjustments.filter(a => a.status === "APPROVED_SYNCED").length,
        offlineFound: adjustments.filter(a => a.status === "DISCARDED_OFFLINE_FOUND").length,
        absence: adjustments.filter(a => a.status === "CONFIRMED_ABSENCE").length
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
                toast.warning(`⚡ Batida Offline Detectada! ${res.message}`, {
                    duration: 7000
                });
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
                toast.success("✅ Ponto ajustado e gravado no Secullum com sucesso!");
                setAdjustments(prev => prev.map(a => a.id === id ? { ...a, status: "APPROVED_SYNCED" } : a));
            } else {
                toast.error(res.message || "Erro ao injetar ajuste no Secullum.");
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
        if (activeTab === "PENDING_AUDIT" && item.status !== "PENDING_AUDIT") return false;
        if (activeTab === "APPROVED_SYNCED" && item.status !== "APPROVED_SYNCED") return false;
        if (activeTab === "DISCARDED_OFFLINE_FOUND" && item.status !== "DISCARDED_OFFLINE_FOUND") return false;
        if (activeTab === "CONFIRMED_ABSENCE" && item.status !== "CONFIRMED_ABSENCE") return false;

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

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "PENDING_RESPONSE":
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
                        {status}
                    </Badge>
                );
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Ações Rápidas (Exato Padrão Atestados) */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-2 border-b border-slate-200">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
                            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                            Nexus Operacional + Secullum Ponto Web
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            <MessageSquare className="w-3 h-3 text-emerald-600" />
                            Grupo WhatsApp Conectado (@Menção do Gestor)
                        </span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
                        <Clock className="w-8 h-8 text-sky-600" />
                        Automação de Ajuste de Batidas
                    </h1>
                    <p className="text-sm text-slate-500 font-medium mt-1">
                        Inconsistências do Nexus tratadas via WhatsApp pelos líderes, auditadas com filtro de batida off-line e integradas ao Secullum.
                    </p>
                </div>

                <div className="flex items-center gap-3">
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

                {/* Tabela de Ajustes (Exato Padrão Atestados) */}
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50 border-b border-slate-200">
                            <TableRow>
                                <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider py-3.5">Código / Data</TableHead>
                                <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider py-3.5">Colaborador</TableHead>
                                <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider py-3.5">Contrato & Posto</TableHead>
                                <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider py-3.5">Gestor Responsável</TableHead>
                                <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider py-3.5">Marcação Solicitada</TableHead>
                                <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider py-3.5">Status</TableHead>
                                <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider py-3.5 text-right">Ações do RH</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                                                <Clock className="w-6 h-6" />
                                            </div>
                                            <p className="text-sm font-semibold text-slate-600">Nenhum ajuste de batida encontrado</p>
                                            <p className="text-xs text-slate-400">Nenhuma inconsistência pendente com os filtros selecionados.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map((item) => {
                                    const isPendingRH = item.status === "PENDING_AUDIT";
                                    const isDone = item.status === "APPROVED_SYNCED";

                                    return (
                                        <TableRow key={item.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                                            {/* Código e Data */}
                                            <TableCell className="py-4 font-medium">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                        #{item.code}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-normal">
                                                    <Calendar className="w-3 h-3 text-slate-400" />
                                                    {formatDataExibicao(item.date)}
                                                </p>
                                            </TableCell>

                                            {/* Colaborador */}
                                            <TableCell className="py-4">
                                                <div className="font-bold text-slate-900 text-sm">
                                                    {item.employee?.name}
                                                </div>
                                                <div className="text-xs text-slate-500 font-mono mt-0.5">
                                                    CPF: {item.employee?.cpf}
                                                </div>
                                            </TableCell>

                                            {/* Contrato e Posto */}
                                            <TableCell className="py-4">
                                                <div className="text-slate-800 font-semibold text-xs flex items-center gap-1.5">
                                                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                    {item.client?.name || "Sem Contrato"}
                                                </div>
                                                <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                    <MapPin className="w-3 h-3 text-slate-400" />
                                                    {item.posto?.role?.name || "Geral"}
                                                </div>
                                            </TableCell>

                                            {/* Gestor Responsável */}
                                            <TableCell className="py-4">
                                                <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                                                    <User className="w-3.5 h-3.5 text-indigo-500" />
                                                    {item.client?.accountManager?.name || item.requestedByName || "Não atribuído"}
                                                </div>
                                                {item.isAccountManager && (
                                                    <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                        Gestor da Conta
                                                    </span>
                                                )}
                                            </TableCell>

                                            {/* Marcação Solicitada */}
                                            <TableCell className="py-4">
                                                <div className="text-xs font-bold text-slate-900">
                                                    {item.requestedTime || item.expectedTime} ({item.punchType})
                                                </div>
                                                <div className="text-xs text-amber-700 font-semibold mt-0.5">
                                                    {item.secullumReasonName || "Aguardando definição"}
                                                </div>
                                            </TableCell>

                                            {/* Status */}
                                            <TableCell className="py-4">
                                                {getStatusBadge(item.status)}
                                            </TableCell>

                                            {/* Ações */}
                                            <TableCell className="py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* Checar Secullum em tempo real */}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleCheckSecullum(item)}
                                                        disabled={checkingId === item.id}
                                                        title="Verificar se o colaborador já possui batida offline no Secullum"
                                                        className="h-8 px-2 border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg"
                                                    >
                                                        <RefreshCw className={`w-3.5 h-3.5 ${checkingId === item.id ? "animate-spin text-sky-600" : "text-slate-500"}`} />
                                                    </Button>

                                                    {/* Botão de Aprovação e Injeção no Secullum */}
                                                    {isPendingRH && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleApprove(item.id)}
                                                            disabled={approvingId === item.id}
                                                            className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm rounded-lg flex items-center gap-1.5"
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                            <span>{approvingId === item.id ? "Gravando..." : "Aprovar no Secullum"}</span>
                                                        </Button>
                                                    )}

                                                    {/* Descartar se a batida offline existir */}
                                                    {isPendingRH && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleDiscard(item.id, "OFFLINE_FOUND")}
                                                            className="h-8 px-2.5 border-slate-200 hover:bg-slate-50 text-slate-600 font-medium text-xs rounded-lg"
                                                        >
                                                            Descartar
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

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
        </div>
    );
}
