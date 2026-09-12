"use client";

import React, { useState, useEffect } from "react";
import { 
    BellRing, 
    Send, 
    Users, 
    User, 
    Phone, 
    CheckCircle2, 
    XCircle, 
    AlertTriangle, 
    RefreshCw, 
    Plus, 
    Trash2, 
    MessageSquare, 
    Calendar, 
    Clock, 
    ShieldAlert, 
    Building2, 
    UserCheck, 
    UserX, 
    FileText, 
    Sparkles,
    Smartphone
} from "lucide-react";
import { toast } from "sonner";
import { 
    getRhNotificationConfig, 
    saveRhNotificationConfig, 
    getAvailableZapiGroups, 
    sendTestRhNotification, 
    getRhNotificationLogs 
} from "@/actions/rh-notifications";
import { ExtraPhoneItem } from "@/lib/rh-notifications";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function RhNotificationsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [testingTarget, setTestingTarget] = useState<string | null>(null);

    // Config state
    const [isActive, setIsActive] = useState(true);
    const [operationsGroupJid, setOperationsGroupJid] = useState("");
    const [operationsGroupName, setOperationsGroupName] = useState("");
    const [adminGroupJid, setAdminGroupJid] = useState("");
    const [adminGroupName, setAdminGroupName] = useState("");
    const [extraPhones, setExtraPhones] = useState<ExtraPhoneItem[]>([]);

    // Toggles de Eventos
    const [notifyOnboarding, setNotifyOnboarding] = useState(true);
    const [notifyOnboardingChannels, setNotifyOnboardingChannels] = useState("OPERATIONS,ADMIN");

    const [notifyAbandonment, setNotifyAbandonment] = useState(true);
    const [notifyAbandonmentChannels, setNotifyAbandonmentChannels] = useState("OPERATIONS,ADMIN");

    const [notifyCandidateSelected, setNotifyCandidateSelected] = useState(true);
    const [notifyCandidateSelectedChannels, setNotifyCandidateSelectedChannels] = useState("OPERATIONS,ADMIN");

    const [notifyDismissalRequest, setNotifyDismissalRequest] = useState(true);
    const [notifyDismissalRequestChannels, setNotifyDismissalRequestChannels] = useState("OPERATIONS,ADMIN");

    const [notifyVacationScheduled, setNotifyVacationScheduled] = useState(true);
    const [notifyVacationScheduledChannels, setNotifyVacationScheduledChannels] = useState("OPERATIONS,ADMIN");

    const [notifyPostoMovement, setNotifyPostoMovement] = useState(true);
    const [notifyPostoMovementChannels, setNotifyPostoMovementChannels] = useState("OPERATIONS,ADMIN");

    // Prazos Diários
    const [notifyDailyRescisaoDeadline, setNotifyDailyRescisaoDeadline] = useState(true);
    const [notifyDailyTelegramDeadline, setNotifyDailyTelegramDeadline] = useState(true);
    const [notifyDailyProbationDeadline, setNotifyDailyProbationDeadline] = useState(true);
    const [notifyDailyVacationDeadline, setNotifyDailyVacationDeadline] = useState(true);
    const [notifyVacationEveStart, setNotifyVacationEveStart] = useState(true);
    const [notifyVacationEveReturn, setNotifyVacationEveReturn] = useState(true);

    // Supervisor
    const [notifyDirectSupervisor, setNotifyDirectSupervisor] = useState(true);

    // Grupos do Z-API
    const [availableGroups, setAvailableGroups] = useState<Array<{ id: string; name: string; phone: string }>>([]);

    // Novo Destinatário Individual
    const [newPhoneName, setNewPhoneName] = useState("");
    const [newPhoneNumber, setNewPhoneNumber] = useState("");
    const [newPhoneRole, setNewPhoneRole] = useState("");

    // Logs
    const [logs, setLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [activeTab, setActiveTab] = useState<"config" | "logs">("config");

    const loadData = async () => {
        setLoading(true);
        try {
            const config = await getRhNotificationConfig();
            if (config) {
                setIsActive(config.isActive);
                setOperationsGroupJid(config.operationsGroupJid || "");
                setOperationsGroupName(config.operationsGroupName || "");
                setAdminGroupJid(config.adminGroupJid || "");
                setAdminGroupName(config.adminGroupName || "");
                setExtraPhones((config.extraPhones as unknown as ExtraPhoneItem[]) || []);

                setNotifyOnboarding(config.notifyOnboarding);
                setNotifyOnboardingChannels(config.notifyOnboardingChannels);

                setNotifyAbandonment(config.notifyAbandonment);
                setNotifyAbandonmentChannels(config.notifyAbandonmentChannels);

                setNotifyCandidateSelected(config.notifyCandidateSelected);
                setNotifyCandidateSelectedChannels(config.notifyCandidateSelectedChannels);

                setNotifyDismissalRequest(config.notifyDismissalRequest);
                setNotifyDismissalRequestChannels(config.notifyDismissalRequestChannels);

                setNotifyVacationScheduled(config.notifyVacationScheduled);
                setNotifyVacationScheduledChannels(config.notifyVacationScheduledChannels);

                setNotifyPostoMovement(config.notifyPostoMovement);
                setNotifyPostoMovementChannels(config.notifyPostoMovementChannels);

                setNotifyDailyRescisaoDeadline(config.notifyDailyRescisaoDeadline);
                setNotifyDailyTelegramDeadline(config.notifyDailyTelegramDeadline);
                setNotifyDailyProbationDeadline(config.notifyDailyProbationDeadline);
                setNotifyDailyVacationDeadline(config.notifyDailyVacationDeadline);
                setNotifyVacationEveStart(config.notifyVacationEveStart ?? true);
                setNotifyVacationEveReturn(config.notifyVacationEveReturn ?? true);

                setNotifyDirectSupervisor(config.notifyDirectSupervisor);
            }

            const initialLogs = await getRhNotificationLogs(30);
            setLogs(initialLogs);
        } catch (err: any) {
            toast.error(err.message || "Erro ao carregar configurações de notificações.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleFetchGroups = async () => {
        setLoadingGroups(true);
        try {
            const groups = await getAvailableZapiGroups();
            setAvailableGroups(groups);
            if (groups.length === 0) {
                toast.info("Nenhum grupo encontrado na instância do Z-API ou conexão inativa.");
            } else {
                toast.success(`${groups.length} grupos do WhatsApp carregados!`);
            }
        } catch (err: any) {
            toast.error(err.message || "Erro ao buscar grupos do WhatsApp.");
        } finally {
            setLoadingGroups(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveRhNotificationConfig({
                isActive,
                operationsGroupJid: operationsGroupJid || null,
                operationsGroupName: operationsGroupName || null,
                adminGroupJid: adminGroupJid || null,
                adminGroupName: adminGroupName || null,
                extraPhones,
                notifyOnboarding,
                notifyOnboardingChannels,
                notifyAbandonment,
                notifyAbandonmentChannels,
                notifyCandidateSelected,
                notifyCandidateSelectedChannels,
                notifyDismissalRequest,
                notifyDismissalRequestChannels,
                notifyVacationScheduled,
                notifyVacationScheduledChannels,
                notifyPostoMovement,
                notifyPostoMovementChannels,
                notifyDailyRescisaoDeadline,
                notifyDailyTelegramDeadline,
                notifyDailyProbationDeadline,
                notifyDailyVacationDeadline,
                notifyVacationEveStart,
                notifyVacationEveReturn,
                notifyDirectSupervisor
            });
            toast.success("Configurações de automação salvas com sucesso!");
        } catch (err: any) {
            toast.error(err.message || "Erro ao salvar configurações.");
        } finally {
            setSaving(false);
        }
    };

    const handleTestNotification = async (target: string, targetName: string) => {
        if (!target) {
            toast.error("Informe um número ou grupo válido para testar.");
            return;
        }
        setTestingTarget(target);
        try {
            await sendTestRhNotification(target, targetName);
            toast.success(`Mensagem de teste enviada com sucesso para ${targetName}!`);
            const updatedLogs = await getRhNotificationLogs(30);
            setLogs(updatedLogs);
        } catch (err: any) {
            toast.error(err.message || "Erro ao enviar teste.");
        } finally {
            setTestingTarget(null);
        }
    };

    const handleAddExtraPhone = () => {
        if (!newPhoneNumber.trim() || !newPhoneName.trim()) {
            toast.error("Preencha o nome e o número de WhatsApp.");
            return;
        }
        const cleanPhone = newPhoneNumber.replace(/\D/g, "");
        if (cleanPhone.length < 10) {
            toast.error("Número de WhatsApp inválido (mínimo 10 dígitos com DDD).");
            return;
        }

        const newItem: ExtraPhoneItem = {
            id: `phone-${Date.now()}`,
            name: newPhoneName.trim(),
            phone: cleanPhone,
            role: newPhoneRole.trim() || "Geral",
            active: true
        };

        setExtraPhones(prev => [...prev, newItem]);
        setNewPhoneName("");
        setNewPhoneNumber("");
        setNewPhoneRole("");
        toast.success(`Destinatário individual ${newItem.name} adicionado!`);
    };

    const handleRemoveExtraPhone = (id: string) => {
        setExtraPhones(prev => prev.filter(p => p.id !== id));
    };

    const handleToggleExtraPhone = (id: string) => {
        setExtraPhones(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
    };

    const handleRefreshLogs = async () => {
        setLoadingLogs(true);
        try {
            const updated = await getRhNotificationLogs(50);
            setLogs(updated);
            toast.success("Histórico atualizado!");
        } catch (err: any) {
            toast.error(err.message || "Erro ao atualizar histórico.");
        } finally {
            setLoadingLogs(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-red-600" />
                    <p className="text-sm font-semibold text-slate-600">Carregando central de automações...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-16">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-3xl shadow-xl">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
                            <BellRing className="w-5 h-5" />
                        </div>
                        <h1 className="text-xl font-black tracking-tight">Automações & Notificações de RH</h1>
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                            WhatsApp Z-API
                        </Badge>
                    </div>
                    <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                        Envio automático de alertas nos grupos de Operações e Administrativo, além de números individuais da diretoria/supervisão para cada movimento de pessoal e prazo legal da CLT.
                    </p>
                </div>

                <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-2xl backdrop-blur-sm self-start md:self-auto">
                    <div className="text-right">
                        <span className="text-[11px] font-bold text-slate-200 block">Status Geral</span>
                        <span className={cn("text-[10px] font-bold", isActive ? "text-emerald-400" : "text-red-400")}>
                            {isActive ? "Ativo e Monitorando" : "Pausado"}
                        </span>
                    </div>
                    <Switch 
                        checked={isActive} 
                        onCheckedChange={setIsActive}
                        className="data-[state=checked]:bg-emerald-500"
                    />
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab("config")}
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2",
                            activeTab === "config" 
                                ? "bg-slate-900 text-white shadow-sm" 
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        )}
                    >
                        <Smartphone className="w-4 h-4" />
                        Canais & Regras de Disparo
                    </button>
                    <button
                        onClick={() => setActiveTab("logs")}
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2",
                            activeTab === "logs" 
                                ? "bg-slate-900 text-white shadow-sm" 
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        )}
                    >
                        <FileText className="w-4 h-4" />
                        Histórico de Envios ({logs.length})
                    </button>
                </div>

                {activeTab === "config" && (
                    <Button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-md cursor-pointer transition-all"
                    >
                        {saving ? (
                            <>
                                <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            "Salvar Configurações"
                        )}
                    </Button>
                )}
            </div>

            {activeTab === "config" ? (
                <div className="space-y-6">
                    {/* Seção 1: Grupos Principais do WhatsApp */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-red-600" />
                                <div>
                                    <h2 className="text-sm font-black text-slate-800">Grupos Principais do WhatsApp</h2>
                                    <p className="text-[11px] text-slate-500">Defina os canais coletivos que receberão os comunicados de equipe.</p>
                                </div>
                            </div>
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={handleFetchGroups}
                                disabled={loadingGroups}
                                className="text-xs h-8 border-slate-300 rounded-xl cursor-pointer"
                            >
                                {loadingGroups ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                                Carregar Grupos do WhatsApp
                            </Button>
                        </div>

                        {availableGroups.length > 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-2">
                                <p className="font-bold text-amber-900 text-[11px]">Grupos detectados no WhatsApp da empresa:</p>
                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                                    {availableGroups.map((g) => (
                                        <button
                                            key={g.id}
                                            type="button"
                                            onClick={() => {
                                                if (!operationsGroupJid) {
                                                    setOperationsGroupJid(g.phone);
                                                    setOperationsGroupName(g.name);
                                                    toast.success(`Selecionado como Grupo de Operações: ${g.name}`);
                                                } else if (!adminGroupJid) {
                                                    setAdminGroupJid(g.phone);
                                                    setAdminGroupName(g.name);
                                                    toast.success(`Selecionado como Grupo do Administrativo: ${g.name}`);
                                                } else {
                                                    setOperationsGroupJid(g.phone);
                                                    setOperationsGroupName(g.name);
                                                    toast.success(`Grupo de Operações atualizado: ${g.name}`);
                                                }
                                            }}
                                            className="px-2 py-1 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg text-[10px] font-semibold text-slate-700 cursor-pointer transition-colors shadow-2xs"
                                        >
                                            ➕ {g.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            {/* Grupo de Operações */}
                            <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                                        <Building2 className="w-4 h-4 text-blue-600" />
                                        <span>Grupo de Operações</span>
                                    </div>
                                    {operationsGroupJid && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleTestNotification(operationsGroupJid, operationsGroupName || "Grupo Operações")}
                                            disabled={testingTarget === operationsGroupJid}
                                            className="h-6 text-[10px] text-blue-600 hover:text-blue-800 px-2 cursor-pointer"
                                        >
                                            {testingTarget === operationsGroupJid ? "Enviando..." : "Testar Envio"}
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] text-slate-500 font-semibold">Nome de Exibição do Grupo</Label>
                                    <Input
                                        placeholder="Ex: Operações Clean Tech / Facilities"
                                        value={operationsGroupName}
                                        onChange={(e) => setOperationsGroupName(e.target.value)}
                                        className="h-9 text-xs bg-white rounded-xl border-slate-200"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] text-slate-500 font-semibold">ID / Telefone do Grupo no WhatsApp (JID)</Label>
                                    <Input
                                        placeholder="Ex: 120363xxxxxxxxx@g.us ou selecione acima"
                                        value={operationsGroupJid}
                                        onChange={(e) => setOperationsGroupJid(e.target.value)}
                                        className="h-9 text-xs bg-white rounded-xl border-slate-200 font-mono text-[11px]"
                                    />
                                </div>
                            </div>

                            {/* Grupo do Administrativo */}
                            <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                                        <Building2 className="w-4 h-4 text-purple-600" />
                                        <span>Grupo do Administrativo</span>
                                    </div>
                                    {adminGroupJid && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleTestNotification(adminGroupJid, adminGroupName || "Grupo Administrativo")}
                                            disabled={testingTarget === adminGroupJid}
                                            className="h-6 text-[10px] text-purple-600 hover:text-purple-800 px-2 cursor-pointer"
                                        >
                                            {testingTarget === adminGroupJid ? "Enviando..." : "Testar Envio"}
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] text-slate-500 font-semibold">Nome de Exibição do Grupo</Label>
                                    <Input
                                        placeholder="Ex: Administrativo & Diretoria"
                                        value={adminGroupName}
                                        onChange={(e) => setAdminGroupName(e.target.value)}
                                        className="h-9 text-xs bg-white rounded-xl border-slate-200"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] text-slate-500 font-semibold">ID / Telefone do Grupo no WhatsApp (JID)</Label>
                                    <Input
                                        placeholder="Ex: 120363xxxxxxxxx@g.us ou selecione acima"
                                        value={adminGroupJid}
                                        onChange={(e) => setAdminGroupJid(e.target.value)}
                                        className="h-9 text-xs bg-white rounded-xl border-slate-200 font-mono text-[11px]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Seção 2: Destinatários Individuais & Supervisor */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <User className="w-5 h-5 text-emerald-600" />
                                <div>
                                    <h2 className="text-sm font-black text-slate-800">Destinatários Individuais (Diretoria / Financeiro / DP)</h2>
                                    <p className="text-[11px] text-slate-500">Pessoas específicas que devem receber os comunicados no WhatsApp privado.</p>
                                </div>
                            </div>
                        </div>

                        {/* Switch do Supervisor Direto */}
                        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-emerald-950">Notificar também o Supervisor do Contrato</span>
                                    <Badge className="bg-emerald-600 text-white text-[9px] font-bold">Inteligência Automática</Badge>
                                </div>
                                <p className="text-[11px] text-emerald-800">
                                    Identifica automaticamente quem é o gestor responsável pelo contrato do posto e envia uma cópia no WhatsApp individual dele.
                                </p>
                            </div>
                            <Switch
                                checked={notifyDirectSupervisor}
                                onCheckedChange={setNotifyDirectSupervisor}
                                className="data-[state=checked]:bg-emerald-600"
                            />
                        </div>

                        {/* Lista de Destinatários Individuais */}
                        <div className="space-y-2">
                            {extraPhones.length === 0 ? (
                                <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl text-center">
                                    Nenhum telefone individual cadastrado no momento. Cadastre abaixo.
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                    {extraPhones.map((p) => (
                                        <div 
                                            key={p.id} 
                                            className={cn(
                                                "p-3 rounded-2xl border flex items-center justify-between transition-all",
                                                p.active ? "bg-white border-slate-200" : "bg-slate-50 border-slate-200/60 opacity-60"
                                            )}
                                        >
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-xs text-slate-800">{p.name}</span>
                                                    {p.role && (
                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                                            {p.role}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                                                    <Phone className="w-3 h-3 text-slate-400" />
                                                    {p.phone}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleTestNotification(p.phone, p.name)}
                                                    disabled={testingTarget === p.phone}
                                                    className="h-7 text-[10px] text-emerald-600 hover:text-emerald-700 px-2 cursor-pointer"
                                                >
                                                    {testingTarget === p.phone ? "Enviando..." : "Testar"}
                                                </Button>
                                                <Switch
                                                    checked={p.active}
                                                    onCheckedChange={() => handleToggleExtraPhone(p.id)}
                                                    className="data-[state=checked]:bg-emerald-600 scale-75"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveExtraPhone(p.id)}
                                                    className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Form para adicionar novo individual */}
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-2.5 items-end pt-3">
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-slate-600">Nome / Responsável</Label>
                                    <Input
                                        placeholder="Ex: Cristiano Silva"
                                        value={newPhoneName}
                                        onChange={(e) => setNewPhoneName(e.target.value)}
                                        className="h-8 text-xs bg-white rounded-xl border-slate-200"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-slate-600">WhatsApp (DDD + Número)</Label>
                                    <Input
                                        placeholder="Ex: 41999999999"
                                        value={newPhoneNumber}
                                        onChange={(e) => setNewPhoneNumber(e.target.value)}
                                        className="h-8 text-xs bg-white rounded-xl border-slate-200"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-slate-600">Cargo / Setor</Label>
                                    <Input
                                        placeholder="Ex: Diretoria / DP"
                                        value={newPhoneRole}
                                        onChange={(e) => setNewPhoneRole(e.target.value)}
                                        className="h-8 text-xs bg-white rounded-xl border-slate-200"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    onClick={handleAddExtraPhone}
                                    className="h-8 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                    Adicionar Número
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Seção 3: Regras de Gatilhos Instantâneos */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-amber-500" />
                            <div>
                                <h2 className="text-sm font-black text-slate-800">Gatilhos Instantâneos (Ao movimentar no sistema)</h2>
                                <p className="text-[11px] text-slate-500">Escolha quais ações do RH devem emitir alertas imediatos e para quem.</p>
                            </div>
                        </div>

                        <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                            {/* 1. Nova Admissão */}
                            <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                <div className="space-y-1 max-w-xl">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs text-slate-800">📢 Nova Admissão / Alocação no Posto</span>
                                        <Badge variant="outline" className="text-[9px] text-emerald-700 bg-emerald-50 border-emerald-200">Onboarding</Badge>
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                        Dispara quando um colaborador é admitido via Kit Admissão/ATS ou alocado em posto com data de início definida.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={notifyOnboardingChannels}
                                        onChange={(e) => setNotifyOnboardingChannels(e.target.value)}
                                        className="text-[11px] font-semibold bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-700 cursor-pointer"
                                    >
                                        <option value="OPERATIONS,ADMIN">Operações + Administrativo</option>
                                        <option value="OPERATIONS">Apenas Operações</option>
                                        <option value="ADMIN">Apenas Administrativo</option>
                                    </select>
                                    <Switch checked={notifyOnboarding} onCheckedChange={setNotifyOnboarding} />
                                </div>
                            </div>

                            {/* 2. Processo de Abandono */}
                            <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                <div className="space-y-1 max-w-xl">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs text-slate-800">⚠️ Início de Processo de Abandono de Emprego</span>
                                        <Badge variant="outline" className="text-[9px] text-red-700 bg-red-50 border-red-200">Crítico CLT</Badge>
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                        Dispara quando o supervisor ou RH registra o abandono de posto, alertando para envio do 1º telegrama.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={notifyAbandonmentChannels}
                                        onChange={(e) => setNotifyAbandonmentChannels(e.target.value)}
                                        className="text-[11px] font-semibold bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-700 cursor-pointer"
                                    >
                                        <option value="OPERATIONS,ADMIN">Operações + Administrativo</option>
                                        <option value="OPERATIONS">Apenas Operações</option>
                                        <option value="ADMIN">Apenas Administrativo</option>
                                    </select>
                                    <Switch checked={notifyAbandonment} onCheckedChange={setNotifyAbandonment} />
                                </div>
                            </div>

                            {/* 3. Candidato Selecionado */}
                            <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                <div className="space-y-1 max-w-xl">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs text-slate-800">🎯 Candidato Selecionado para Vaga de Contrato</span>
                                        <Badge variant="outline" className="text-[9px] text-blue-700 bg-blue-50 border-blue-200">Recrutamento</Badge>
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                        Avisa as operações assim que o recrutador define qual candidato foi selecionado para preencher a vaga do cliente.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={notifyCandidateSelectedChannels}
                                        onChange={(e) => setNotifyCandidateSelectedChannels(e.target.value)}
                                        className="text-[11px] font-semibold bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-700 cursor-pointer"
                                    >
                                        <option value="OPERATIONS,ADMIN">Operações + Administrativo</option>
                                        <option value="OPERATIONS">Apenas Operações</option>
                                        <option value="ADMIN">Apenas Administrativo</option>
                                    </select>
                                    <Switch checked={notifyCandidateSelected} onCheckedChange={setNotifyCandidateSelected} />
                                </div>
                            </div>

                            {/* 4. Solicitação de Desligamento / Término de Experiência */}
                            <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                <div className="space-y-1 max-w-xl">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs text-slate-800">📄 Desligamento / Término de Experiência Solicitado</span>
                                        <Badge variant="outline" className="text-[9px] text-orange-700 bg-orange-50 border-orange-200">DP & Posto</Badge>
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                        Dispara na abertura de aviso prévio trabalhado/indenizado ou solicitação de término de experiência para providenciar cobertura.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={notifyDismissalRequestChannels}
                                        onChange={(e) => setNotifyDismissalRequestChannels(e.target.value)}
                                        className="text-[11px] font-semibold bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-700 cursor-pointer"
                                    >
                                        <option value="OPERATIONS,ADMIN">Operações + Administrativo</option>
                                        <option value="OPERATIONS">Apenas Operações</option>
                                        <option value="ADMIN">Apenas Administrativo</option>
                                    </select>
                                    <Switch checked={notifyDismissalRequest} onCheckedChange={setNotifyDismissalRequest} />
                                </div>
                            </div>

                            {/* 5. Mudança para Rotativo */}
                            <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                <div className="space-y-1 max-w-xl">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs text-slate-800">🔄 Movimentação para Centro de Custo Rotativo</span>
                                        <Badge variant="outline" className="text-[9px] text-indigo-700 bg-indigo-50 border-indigo-200">Escala</Badge>
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                        Avisa quando um colaborador perde a vaga no posto fixo e passa a fazer parte da reserva técnica / diaristas rotativos.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={notifyPostoMovementChannels}
                                        onChange={(e) => setNotifyPostoMovementChannels(e.target.value)}
                                        className="text-[11px] font-semibold bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-700 cursor-pointer"
                                    >
                                        <option value="OPERATIONS,ADMIN">Operações + Administrativo</option>
                                        <option value="OPERATIONS">Apenas Operações</option>
                                        <option value="ADMIN">Apenas Administrativo</option>
                                    </select>
                                    <Switch checked={notifyPostoMovement} onCheckedChange={setNotifyPostoMovement} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Seção 4: Prazos Diários (Robô Matinal das 08h00) */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-red-600" />
                                <div>
                                    <h2 className="text-sm font-black text-slate-800">Robô Matinal de Prazos Legais (Disparo Diário às 08h00)</h2>
                                    <p className="text-[11px] text-slate-500">Varre a base todas as manhãs para antecipar vencimentos antes que gerem multas.</p>
                                </div>
                            </div>
                            <Badge className="bg-red-50 text-red-700 border-red-200 font-bold text-[10px]">
                                Cron Automático
                            </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                            {/* Rescisão Vencendo Hoje */}
                            <div className="p-3.5 bg-red-50/50 border border-red-200/80 rounded-2xl flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <span className="font-bold text-xs text-red-950 block">🚨 Vencimento de Rescisão HOJE (Art. 477)</span>
                                    <span className="text-[11px] text-red-800 block">
                                        Alerta o Financeiro/DP sobre rescisões no 10º dia corrido para evitar multa de 1 salário.
                                    </span>
                                </div>
                                <Switch checked={notifyDailyRescisaoDeadline} onCheckedChange={setNotifyDailyRescisaoDeadline} />
                            </div>

                            {/* Telegramas de Abandono */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <span className="font-bold text-xs text-slate-900 block">📬 Dia de Enviar 1º ou 2º Telegrama</span>
                                    <span className="text-[11px] text-slate-600 block">
                                        Avisa no 3º e 10º dia de ausência para envio imediato dos telegramas com AR.
                                    </span>
                                </div>
                                <Switch checked={notifyDailyTelegramDeadline} onCheckedChange={setNotifyDailyTelegramDeadline} />
                            </div>

                            {/* Vencimento de Experiência */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <span className="font-bold text-xs text-slate-900 block">⏳ Contratos de Experiência (45 e 90 dias)</span>
                                    <span className="text-[11px] text-slate-600 block">
                                        Avisa com 5 dias de antecedência para decisão de prorrogação ou efetivação.
                                    </span>
                                </div>
                                <Switch checked={notifyDailyProbationDeadline} onCheckedChange={setNotifyDailyProbationDeadline} />
                            </div>

                            {/* Férias a Vencer */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <span className="font-bold text-xs text-slate-900 block">🏖️ Período Concessivo de Férias a Vencer</span>
                                    <span className="text-[11px] text-slate-600 block">
                                        Alerta antes do prazo limite para evitar pagamento de férias em dobro.
                                    </span>
                                </div>
                                <Switch checked={notifyDailyVacationDeadline} onCheckedChange={setNotifyDailyVacationDeadline} />
                            </div>

                            {/* 1 dia antes do início das férias */}
                            <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <span className="font-bold text-xs text-amber-950 block">🏖️ Férias: 1 dia antes do início</span>
                                    <span className="text-[11px] text-amber-800 block">
                                        Avisa 1 dia antes do afastamento para confirmar escala de cobertura no posto.
                                    </span>
                                </div>
                                <Switch checked={notifyVacationEveStart} onCheckedChange={setNotifyVacationEveStart} />
                            </div>

                            {/* 1 dia antes do retorno das férias */}
                            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <span className="font-bold text-xs text-emerald-950 block">🏖️ Férias: 1 dia antes do retorno</span>
                                    <span className="text-[11px] text-emerald-800 block">
                                        Avisa no último dia de férias que o colaborador retorna amanhã para receber o titular.
                                    </span>
                                </div>
                                <Switch checked={notifyVacationEveReturn} onCheckedChange={setNotifyVacationEveReturn} />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Aba de Logs de Auditoria */
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div>
                            <h2 className="text-sm font-black text-slate-800">Histórico de Disparos Recentes</h2>
                            <p className="text-[11px] text-slate-500">Registro de todas as mensagens automáticas enviadas aos grupos e contatos.</p>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleRefreshLogs}
                            disabled={loadingLogs}
                            className="text-xs h-8 rounded-xl cursor-pointer"
                        >
                            <RefreshCw className={cn("w-3 h-3 mr-1", loadingLogs && "animate-spin")} />
                            Atualizar
                        </Button>
                    </div>

                    {logs.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-xs">
                            Nenhum log de notificação registrado ainda.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto pr-1">
                            {logs.map((log) => (
                                <div key={log.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            {log.status === "SENT" ? (
                                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold">
                                                    <CheckCircle2 className="w-2.5 h-2.5 mr-1 text-emerald-600" />
                                                    Enviado
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-red-50 text-red-700 border-red-200 text-[9px] font-bold">
                                                    <XCircle className="w-2.5 h-2.5 mr-1 text-red-600" />
                                                    Falhou
                                                </Badge>
                                            )}
                                            <span className="font-bold text-slate-800">{log.title}</span>
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(log.createdAt).toLocaleString("pt-BR")}
                                            </span>
                                        </div>
                                        <p className="text-slate-600 text-[11px] whitespace-pre-line bg-slate-50 p-2 rounded-xl border border-slate-100 max-w-2xl">
                                            {log.message}
                                        </p>
                                    </div>

                                    <div className="text-right text-[11px] text-slate-500 shrink-0">
                                        <span className="font-bold text-slate-700 block">{log.targetName || log.targetId}</span>
                                        <span className="text-[10px] text-slate-400 block">{log.targetType} ({log.targetId})</span>
                                        {log.errorMessage && (
                                            <span className="text-[10px] text-red-500 font-medium block mt-1">
                                                Erro: {log.errorMessage}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
