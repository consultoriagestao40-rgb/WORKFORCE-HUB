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
    ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import {
    syncSecullumJustifications,
    checkPunchAgainstSecullum,
    approveAndSyncPunchAdjustment,
    discardPunchAdjustment,
    createPunchAdjustmentAlert
} from "@/actions/punch-adjustments";
import { sendPunchAdjustmentWhatsAppAlert } from "@/lib/punch-whatsapp";

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
        name: string;
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
    const [filterStatus, setFilterStatus] = useState<string>("ALL");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [checkingId, setCheckingId] = useState<string | null>(null);
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [isSyncingJusts, setIsSyncingJusts] = useState(false);

    // Modal de Teste
    const defaultGroup = whatsappGroups.find(g => g.name.toLowerCase().includes("ajuste") || g.name.toLowerCase().includes("operaç"))?.phone || "";
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const [testEmpId, setTestEmpId] = useState("");
    const [testPunchType, setTestPunchType] = useState<"ENTRADA_1" | "SAIDA_1">("ENTRADA_1");
    const [testExpectedTime, setTestExpectedTime] = useState("07:00");
    const [testGroupTarget, setTestGroupTarget] = useState(defaultGroup);
    const [isSendingTest, setIsSendingTest] = useState(false);

    // Estatísticas dos cards
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

            // Disparar no WhatsApp
            const sendRes = await sendPunchAdjustmentWhatsAppAlert(createRes.adjustment.id, testGroupTarget || undefined);
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

    // Filtragem de lista
    const filteredItems = adjustments.filter(item => {
        if (filterStatus !== "ALL" && item.status !== filterStatus) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const empName = item.employee?.name?.toLowerCase() || "";
            const clientName = item.client?.name?.toLowerCase() || "";
            const code = item.code?.toLowerCase() || "";
            return empName.includes(term) || clientName.includes(term) || code.includes(term);
        }
        return true;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "PENDING_RESPONSE":
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> Aguardando Gestor</span>;
            case "PENDING_AUDIT":
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"><Zap className="w-3.5 h-3.5" /> Pendente RH</span>;
            case "APPROVED_SYNCED":
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3.5 h-3.5" /> Sincronizado Secullum</span>;
            case "DISCARDED_OFFLINE_FOUND":
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20"><RefreshCw className="w-3.5 h-3.5" /> Batida Offline Detectada</span>;
            case "CONFIRMED_ABSENCE":
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"><XCircle className="w-3.5 h-3.5" /> Falta Confirmada</span>;
            default:
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400">{status}</span>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">Automação de Ajuste de Batidas</h1>
                            <p className="text-sm text-slate-400">
                                Fluxo inteligente: Nexus ➔ WhatsApp do Gestor ➔ Auditoria RH com filtro off-line ➔ Secullum.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleSyncJusts}
                        disabled={isSyncingJusts}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition"
                    >
                        <RefreshCw className={`w-4 h-4 ${isSyncingJusts ? "animate-spin" : ""}`} />
                        Sincronizar Motivos ({justifications.length})
                    </button>

                    <button
                        onClick={() => setIsTestModalOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-cyan-500/20 transition"
                    >
                        <Send className="w-4 h-4" />
                        Disparar Alerta de Teste (WhatsApp)
                    </button>
                </div>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div
                    onClick={() => setFilterStatus("ALL")}
                    className={`cursor-pointer p-4 rounded-xl border transition ${filterStatus === "ALL" ? "bg-slate-800/80 border-cyan-500/50 shadow-md" : "bg-slate-900/40 border-slate-800 hover:bg-slate-800/40"}`}
                >
                    <p className="text-xs text-slate-400 font-medium">Total de Ocorrências</p>
                    <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
                </div>

                <div
                    onClick={() => setFilterStatus("PENDING_RESPONSE")}
                    className={`cursor-pointer p-4 rounded-xl border transition ${filterStatus === "PENDING_RESPONSE" ? "bg-amber-950/30 border-amber-500/50 shadow-md" : "bg-slate-900/40 border-slate-800 hover:bg-slate-800/40"}`}
                >
                    <p className="text-xs text-amber-400 font-medium">Aguardando Gestor (Zap)</p>
                    <p className="text-2xl font-black text-amber-300 mt-1">{stats.pendingResponse}</p>
                </div>

                <div
                    onClick={() => setFilterStatus("PENDING_AUDIT")}
                    className={`cursor-pointer p-4 rounded-xl border transition ${filterStatus === "PENDING_AUDIT" ? "bg-cyan-950/30 border-cyan-500/50 shadow-md" : "bg-slate-900/40 border-slate-800 hover:bg-slate-800/40"}`}
                >
                    <p className="text-xs text-cyan-400 font-medium">Pendente RH (Pronto)</p>
                    <p className="text-2xl font-black text-cyan-300 mt-1">{stats.pendingAudit}</p>
                </div>

                <div
                    onClick={() => setFilterStatus("APPROVED_SYNCED")}
                    className={`cursor-pointer p-4 rounded-xl border transition ${filterStatus === "APPROVED_SYNCED" ? "bg-emerald-950/30 border-emerald-500/50 shadow-md" : "bg-slate-900/40 border-slate-800 hover:bg-slate-800/40"}`}
                >
                    <p className="text-xs text-emerald-400 font-medium">Gravados no Secullum</p>
                    <p className="text-2xl font-black text-emerald-300 mt-1">{stats.approved}</p>
                </div>

                <div
                    onClick={() => setFilterStatus("DISCARDED_OFFLINE_FOUND")}
                    className={`cursor-pointer p-4 rounded-xl border transition ${filterStatus === "DISCARDED_OFFLINE_FOUND" ? "bg-purple-950/30 border-purple-500/50 shadow-md" : "bg-slate-900/40 border-slate-800 hover:bg-slate-800/40"}`}
                >
                    <p className="text-xs text-purple-400 font-medium">Batida Offline (Evitou Erro)</p>
                    <p className="text-2xl font-black text-purple-300 mt-1">{stats.offlineFound}</p>
                </div>
            </div>

            {/* Barra de Busca e Filtros */}
            <div className="flex items-center gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                <Search className="w-5 h-5 text-slate-500 ml-2" />
                <input
                    type="text"
                    placeholder="Buscar por colaborador, contrato ou código (#AJ...)"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-1 bg-transparent border-none text-sm text-white placeholder-slate-500 focus:outline-none"
                />
            </div>

            {/* Tabela de Ajustes */}
            <div className="bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-4">Código / Data</th>
                                <th className="px-6 py-4">Colaborador</th>
                                <th className="px-6 py-4">Contrato & Posto</th>
                                <th className="px-6 py-4">Gestor Responsável</th>
                                <th className="px-6 py-4">Marcação Solicitada</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ações do RH</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-normal">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                        Nenhuma solicitação ou inconsistência encontrada.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map(item => {
                                    const dateObj = new Date(item.date);
                                    const dateStr = dateObj.toLocaleDateString("pt-BR");
                                    const isPendingRH = item.status === "PENDING_AUDIT";
                                    const isDone = item.status === "APPROVED_SYNCED";

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-800/30 transition">
                                            <td className="px-6 py-4">
                                                <span className="font-mono font-bold text-cyan-400 bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-500/20">
                                                    #{item.code}
                                                </span>
                                                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" /> {dateStr}
                                                </p>
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-white">{item.employee?.name}</div>
                                                <div className="text-xs text-slate-500 font-mono">CPF: {item.employee?.cpf}</div>
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="text-slate-300 font-medium flex items-center gap-1.5">
                                                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                                    {item.client?.name || "Sem Contrato"}
                                                </div>
                                                <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                    <MapPin className="w-3 h-3 text-slate-600" />
                                                    {item.posto?.name || "Geral"}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="text-sm text-slate-300 flex items-center gap-1.5">
                                                    <User className="w-3.5 h-3.5 text-indigo-400" />
                                                    {item.client?.accountManager?.name || item.requestedByName || "Não atribuído"}
                                                </div>
                                                {item.isAccountManager && (
                                                    <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                                        Gestor da Conta
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="text-white font-medium">
                                                    {item.requestedTime || item.expectedTime} ({item.punchType})
                                                </div>
                                                <div className="text-xs text-amber-400/90 mt-0.5 font-medium">
                                                    {item.secullumReasonName || "Aguardando definição"}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4">
                                                {getStatusBadge(item.status)}
                                            </td>

                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* Checar Secullum em tempo real */}
                                                    <button
                                                        onClick={() => handleCheckSecullum(item)}
                                                        disabled={checkingId === item.id}
                                                        title="Verificar se o colaborador já possui batida offline no Secullum"
                                                        className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/40 rounded-lg border border-slate-700/60 transition"
                                                    >
                                                        <RefreshCw className={`w-4 h-4 ${checkingId === item.id ? "animate-spin text-cyan-400" : ""}`} />
                                                    </button>

                                                    {/* Botão de Aprovação e Injeção no Secullum */}
                                                    {isPendingRH && (
                                                        <button
                                                            onClick={() => handleApprove(item.id)}
                                                            disabled={approvingId === item.id}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition"
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                            {approvingId === item.id ? "Gravando..." : "Aprovar no Secullum"}
                                                        </button>
                                                    )}

                                                    {/* Descartar se a batida offline existir */}
                                                    {isPendingRH && (
                                                        <button
                                                            onClick={() => handleDiscard(item.id, "OFFLINE_FOUND")}
                                                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
                                                        >
                                                            Descartar
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

            {/* Modal de Disparo de Alerta de Teste */}
            {isTestModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-2 text-cyan-400">
                                <Send className="w-5 h-5" />
                                <h2 className="text-lg font-bold text-white">Disparar Teste no WhatsApp</h2>
                            </div>
                            <button
                                onClick={() => setIsTestModalOpen(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSendTestAlert} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Colaborador para Teste
                                </label>
                                <select
                                    value={testEmpId}
                                    onChange={e => setTestEmpId(e.target.value)}
                                    required
                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                                >
                                    <option value="">Selecione um colaborador...</option>
                                    {employeesList.map(e => (
                                        <option key={e.id} value={e.id}>
                                            {e.name} (CPF: {e.cpf}) {e.companyName ? `- ${e.companyName}` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Tipo de Batida
                                    </label>
                                    <select
                                        value={testPunchType}
                                        onChange={e => setTestPunchType(e.target.value as any)}
                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                                    >
                                        <option value="ENTRADA_1">Entrada 1 (Início do Turno)</option>
                                        <option value="SAIDA_1">Saída 1 (Almoço)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Horário Previsto
                                    </label>
                                    <input
                                        type="time"
                                        value={testExpectedTime}
                                        onChange={e => setTestExpectedTime(e.target.value)}
                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Grupo WhatsApp de Destino
                                </label>
                                {whatsappGroups.length > 0 ? (
                                    <select
                                        value={testGroupTarget}
                                        onChange={e => setTestGroupTarget(e.target.value)}
                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                                    >
                                        {whatsappGroups.map(g => (
                                            <option key={g.id} value={g.phone}>
                                                {g.name}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="Ex: 120363..."
                                        value={testGroupTarget}
                                        onChange={e => setTestGroupTarget(e.target.value)}
                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                                    />
                                )}
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Os grupos são carregados automaticamente via Z-API. O grupo de teste pode ser selecionado diretamente na lista!
                                </p>
                            </div>

                            <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl text-xs text-cyan-300">
                                💡 O bot vai montar o alerta formatado, com @menção do gestor da conta e a lista de motivos do Secullum cadastrados.
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setIsTestModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSendingTest}
                                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm shadow-lg shadow-cyan-600/30 transition"
                                >
                                    <Send className="w-4 h-4" />
                                    {isSendingTest ? "Disparando..." : "Disparar Alerta"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
