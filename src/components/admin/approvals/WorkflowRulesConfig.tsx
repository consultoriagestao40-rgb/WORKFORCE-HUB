"use client";

import React, { useState } from "react";
import { 
    ShieldCheck, 
    UserCheck, 
    Users, 
    Save, 
    SlidersHorizontal,
    GitBranch,
    Lock,
    User,
    CheckCircle2
} from "lucide-react";
import { saveApprovalWorkflowRule } from "@/actions/approvals";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export interface WorkflowRuleData {
    id?: string;
    type: string;
    name: string;
    description?: string | null;
    n1Enabled: boolean;
    n1ApproverType: string;
    n1TargetRole?: string | null;
    n1TargetUserId?: string | null;
    n2Enabled: boolean;
    n2ApproverType: string;
    n2TargetRole?: string | null;
    n2TargetUserId?: string | null;
}

export interface SystemUserData {
    id: string;
    name: string;
    username: string;
    email?: string | null;
    phone?: string | null;
    clientIds?: string[];
    role: string;
    isActive?: boolean;
    managerId?: string | null;
    manager?: { id: string; name: string; role: string } | null;
}

interface WorkflowRulesConfigProps {
    initialRules: WorkflowRuleData[];
    allUsers: SystemUserData[];
    isAdmin: boolean;
}

export function WorkflowRulesConfig({ initialRules, allUsers, isAdmin }: WorkflowRulesConfigProps) {
    const [rules, setRules] = useState<WorkflowRuleData[]>(initialRules);
    const [savingType, setSavingType] = useState<string | null>(null);

    // Filtrar apenas usuários ativos do sistema
    const activeUsers = (allUsers || []).filter(u => u.isActive !== false);

    // Identificar gestores ativos (usuários que são gerentes de alguém ou possuem perfil de liderança)
    const managerIdsSet = new Set(
        allUsers
            .filter(u => u.managerId)
            .map(u => u.managerId as string)
    );
    const activeManagers = activeUsers.filter(u => 
        managerIdsSet.has(u.id) || u.role === "ADMIN" || u.role === "COORD_RH" || u.role === "SUPERVISOR"
    );

    const updateRuleField = (type: string, field: keyof WorkflowRuleData, value: any) => {
        setRules(prev => prev.map(r => r.type === type ? { ...r, [field]: value } : r));
    };

    const handleSaveRule = async (rule: WorkflowRuleData) => {
        if (!isAdmin) {
            toast.error("Apenas administradores podem alterar as alçadas de aprovação.");
            return;
        }

        setSavingType(rule.type);
        try {
            await saveApprovalWorkflowRule({
                type: rule.type as any,
                name: rule.name,
                description: rule.description || undefined,
                n1Enabled: rule.n1Enabled,
                n1ApproverType: rule.n1ApproverType,
                n1TargetRole: (rule.n1TargetRole as any) || null,
                n1TargetUserId: rule.n1TargetUserId || null,
                n2Enabled: rule.n2Enabled,
                n2ApproverType: rule.n2ApproverType,
                n2TargetRole: (rule.n2TargetRole as any) || null,
                n2TargetUserId: rule.n2TargetUserId || null,
            });
            toast.success(`Alçadas de "${rule.name}" salvas com sucesso!`);
        } catch (err: any) {
            toast.error(err.message || "Erro ao salvar alçada.");
        } finally {
            setSavingType(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Banner de Orientação */}
            <div className="p-4 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/40 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
                        <GitBranch className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                            Matriz de Alçadas e Aprovações por Processo
                            <Badge className="bg-indigo-600 text-white text-[10px]">Acesso Restrito</Badge>
                        </h2>
                        <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                            Configure quem possui autonomia para deliberar em cada etapa. O <strong>Nível 1 (N1)</strong> valida a conformidade operacional, e o <strong>Nível 2 (N2)</strong> delibera diretrizes finais e autoriza a efetivação no sistema e ponto Secullum.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span><strong>{activeUsers.length}</strong> usuários ativos vinculados</span>
                </div>
            </div>

            {/* Grid de Regras por Processo */}
            <div className="grid grid-cols-1 gap-5">
                {rules.map((rule) => {
                    const isSaving = savingType === rule.type;
                    const n1RoleUsers = activeUsers.filter(u => u.role === (rule.n1TargetRole || "COORD_RH"));
                    const n2RoleUsers = activeUsers.filter(u => u.role === (rule.n2TargetRole || "ADMIN"));
                    const n1SpecificUser = activeUsers.find(u => u.id === rule.n1TargetUserId);
                    const n2SpecificUser = activeUsers.find(u => u.id === rule.n2TargetUserId);

                    return (
                        <div 
                            key={rule.type} 
                            className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 shadow-sm transition-all space-y-4"
                        >
                            {/* Header do Processo */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                                        <h3 className="text-sm font-bold text-slate-900">{rule.name}</h3>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                                            {rule.type}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">{rule.description}</p>
                                </div>

                                <Button
                                    size="sm"
                                    onClick={() => handleSaveRule(rule)}
                                    disabled={!isAdmin || isSaving}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm self-start sm:self-auto"
                                >
                                    <Save className="w-3.5 h-3.5 mr-1.5" />
                                    {isSaving ? "Salvando..." : "Salvar Alçada"}
                                </Button>
                            </div>

                            {/* Configuração N1 e N2 lado a lado */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* CARD NÍVEL 1 */}
                                <div className={`p-4 rounded-xl border transition-all ${
                                    rule.n1Enabled 
                                        ? "bg-amber-50/40 border-amber-200" 
                                        : "bg-slate-50 border-slate-200 opacity-60"
                                }`}>
                                    <div className="flex items-center justify-between pb-3 border-b border-amber-100/60">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                                Nível 1 (N1) - Validação Operacional
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor={`n1-${rule.type}`} className="text-xs font-semibold cursor-pointer">
                                                {rule.n1Enabled ? "Exigido" : "Dispensado"}
                                            </Label>
                                            <Switch
                                                id={`n1-${rule.type}`}
                                                checked={rule.n1Enabled}
                                                disabled={!isAdmin}
                                                onCheckedChange={(checked) => updateRuleField(rule.type, "n1Enabled", checked)}
                                            />
                                        </div>
                                    </div>

                                    {rule.n1Enabled && (
                                        <div className="pt-3 space-y-3">
                                            <div>
                                                <Label className="text-xs font-medium text-slate-700 block mb-1">
                                                    Quem deve aprovar no N1?
                                                </Label>
                                                <Select
                                                    value={rule.n1ApproverType}
                                                    disabled={!isAdmin}
                                                    onValueChange={(val) => updateRuleField(rule.type, "n1ApproverType", val)}
                                                >
                                                    <SelectTrigger className="h-9 text-xs bg-white border-amber-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="DIRECT_MANAGER">
                                                            <div className="flex items-center gap-1.5 font-semibold text-indigo-700">
                                                                <UserCheck className="w-3.5 h-3.5" />
                                                                <span>Gestor Imediato (Superior Direto do Solicitante)</span>
                                                            </div>
                                                        </SelectItem>
                                                        <SelectItem value="ROLE">
                                                            <div className="flex items-center gap-1.5">
                                                                <Users className="w-3.5 h-3.5" />
                                                                <span>Por Perfil / Cargo do Sistema</span>
                                                            </div>
                                                        </SelectItem>
                                                        <SelectItem value="SPECIFIC_USER">
                                                            <div className="flex items-center gap-1.5">
                                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                                <span>Usuário Específico Determinado</span>
                                                            </div>
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Bloco quando selecionado Gestor Imediato */}
                                            {rule.n1ApproverType === "DIRECT_MANAGER" && (
                                                <div className="bg-white/90 p-3 rounded-lg border border-amber-200/80 space-y-2">
                                                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                                                        Gestores Ativos Cadastrados ({activeManagers.length}):
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                                                        {activeManagers.map(m => (
                                                            <Badge key={m.id} variant="secondary" className="bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200">
                                                                {m.name} ({m.role})
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 leading-tight">
                                                        O sistema busca o superior direto vinculado no cadastro de quem abre a solicitação.
                                                    </p>
                                                </div>
                                            )}

                                            {/* Bloco quando selecionado Por Perfil */}
                                            {rule.n1ApproverType === "ROLE" && (
                                                <div className="space-y-2">
                                                    <div>
                                                        <Label className="text-xs font-medium text-slate-700 block mb-1">
                                                            Perfil com Alçada N1
                                                        </Label>
                                                        <Select
                                                            value={rule.n1TargetRole || "COORD_RH"}
                                                            disabled={!isAdmin}
                                                            onValueChange={(val) => updateRuleField(rule.type, "n1TargetRole", val)}
                                                        >
                                                            <SelectTrigger className="h-9 text-xs bg-white border-amber-200">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="COORD_RH">Coordenador RH (COORD_RH)</SelectItem>
                                                                <SelectItem value="SUPERVISOR">Supervisor (SUPERVISOR)</SelectItem>
                                                                <SelectItem value="ASSIST_RH">Assistente RH (ASSIST_RH)</SelectItem>
                                                                <SelectItem value="ADMIN">Administrador (ADMIN)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200/80 space-y-1.5">
                                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                                                            Usuários Ativos Vinculados a este Perfil ({n1RoleUsers.length}):
                                                        </span>
                                                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                                                            {n1RoleUsers.length > 0 ? (
                                                                n1RoleUsers.map(u => (
                                                                    <Badge key={u.id} className="bg-amber-100 text-amber-900 border-amber-300 text-[11px]">
                                                                        {u.name} (@{u.username})
                                                                    </Badge>
                                                                ))
                                                            ) : (
                                                                <span className="text-xs text-amber-700 italic">
                                                                    ⚠️ Nenhum usuário ativo com este perfil no momento.
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Bloco quando selecionado Usuário Específico */}
                                            {rule.n1ApproverType === "SPECIFIC_USER" && (
                                                <div className="space-y-2">
                                                    <div>
                                                        <Label className="text-xs font-medium text-slate-700 block mb-1">
                                                            Selecione o Usuário Ativo Aprovador N1
                                                        </Label>
                                                        <Select
                                                            value={rule.n1TargetUserId || "NONE"}
                                                            disabled={!isAdmin}
                                                            onValueChange={(val) => updateRuleField(rule.type, "n1TargetUserId", val === "NONE" ? null : val)}
                                                        >
                                                            <SelectTrigger className="h-9 text-xs bg-white border-amber-200">
                                                                <SelectValue placeholder="Selecione um usuário ativo..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="NONE">Selecione um usuário ativo...</SelectItem>
                                                                {activeUsers.map(u => (
                                                                    <SelectItem key={u.id} value={u.id}>
                                                                        {u.name} (@{u.username}) • {u.role}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {n1SpecificUser && (
                                                        <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200/80 flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                                                                {n1SpecificUser.name.charAt(0)}
                                                            </div>
                                                            <div className="text-xs">
                                                                <div className="font-semibold text-slate-800">{n1SpecificUser.name}</div>
                                                                <div className="text-[10px] text-slate-500">@{n1SpecificUser.username} • {n1SpecificUser.role}</div>
                                                            </div>
                                                            <Badge className="ml-auto bg-emerald-500 text-white text-[10px]">Ativo</Badge>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* CARD NÍVEL 2 */}
                                <div className={`p-4 rounded-xl border transition-all ${
                                    rule.n2Enabled 
                                        ? "bg-purple-50/40 border-purple-200" 
                                        : "bg-slate-50 border-slate-200 opacity-60"
                                }`}>
                                    <div className="flex items-center justify-between pb-3 border-b border-purple-100/60">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                                Nível 2 (N2) - Diretoria / Efetivação
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor={`n2-${rule.type}`} className="text-xs font-semibold cursor-pointer">
                                                {rule.n2Enabled ? "Exigido" : "Dispensado"}
                                            </Label>
                                            <Switch
                                                id={`n2-${rule.type}`}
                                                checked={rule.n2Enabled}
                                                disabled={!isAdmin}
                                                onCheckedChange={(checked) => updateRuleField(rule.type, "n2Enabled", checked)}
                                            />
                                        </div>
                                    </div>

                                    {rule.n2Enabled && (
                                        <div className="pt-3 space-y-3">
                                            <div>
                                                <Label className="text-xs font-medium text-slate-700 block mb-1">
                                                    Quem delibera no N2?
                                                </Label>
                                                <Select
                                                    value={rule.n2ApproverType}
                                                    disabled={!isAdmin}
                                                    onValueChange={(val) => updateRuleField(rule.type, "n2ApproverType", val)}
                                                >
                                                    <SelectTrigger className="h-9 text-xs bg-white border-purple-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="ROLE">
                                                            <div className="flex items-center gap-1.5 font-semibold text-purple-700">
                                                                <Users className="w-3.5 h-3.5" />
                                                                <span>Por Perfil (ex: ADMIN / Direção)</span>
                                                            </div>
                                                        </SelectItem>
                                                        <SelectItem value="SPECIFIC_USER">
                                                            <div className="flex items-center gap-1.5">
                                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                                <span>Usuário Específico</span>
                                                            </div>
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Bloco quando selecionado Por Perfil N2 */}
                                            {rule.n2ApproverType === "ROLE" && (
                                                <div className="space-y-2">
                                                    <div>
                                                        <Label className="text-xs font-medium text-slate-700 block mb-1">
                                                            Perfil com Alçada N2
                                                        </Label>
                                                        <Select
                                                            value={rule.n2TargetRole || "ADMIN"}
                                                            disabled={!isAdmin}
                                                            onValueChange={(val) => updateRuleField(rule.type, "n2TargetRole", val)}
                                                        >
                                                            <SelectTrigger className="h-9 text-xs bg-white border-purple-200">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="ADMIN">Administrador / Diretoria (ADMIN)</SelectItem>
                                                                <SelectItem value="COORD_RH">Coordenador RH (COORD_RH)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="bg-white/90 p-2.5 rounded-lg border border-purple-200/80 space-y-1.5">
                                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                                                            Usuários Ativos com Alçada N2 ({n2RoleUsers.length}):
                                                        </span>
                                                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                                                            {n2RoleUsers.length > 0 ? (
                                                                n2RoleUsers.map(u => (
                                                                    <Badge key={u.id} className="bg-purple-100 text-purple-900 border-purple-300 text-[11px]">
                                                                        {u.name} (@{u.username})
                                                                    </Badge>
                                                                ))
                                                            ) : (
                                                                <span className="text-xs text-purple-700 italic">
                                                                    ⚠️ Nenhum usuário ativo com este perfil.
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Bloco quando selecionado Usuário Específico N2 */}
                                            {rule.n2ApproverType === "SPECIFIC_USER" && (
                                                <div className="space-y-2">
                                                    <div>
                                                        <Label className="text-xs font-medium text-slate-700 block mb-1">
                                                            Selecione o Usuário Ativo Aprovador N2
                                                        </Label>
                                                        <Select
                                                            value={rule.n2TargetUserId || "NONE"}
                                                            disabled={!isAdmin}
                                                            onValueChange={(val) => updateRuleField(rule.type, "n2TargetUserId", val === "NONE" ? null : val)}
                                                        >
                                                            <SelectTrigger className="h-9 text-xs bg-white border-purple-200">
                                                                <SelectValue placeholder="Selecione um usuário ativo..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="NONE">Selecione um usuário ativo...</SelectItem>
                                                                {activeUsers.map(u => (
                                                                    <SelectItem key={u.id} value={u.id}>
                                                                        {u.name} (@{u.username}) • {u.role}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {n2SpecificUser && (
                                                        <div className="bg-white/90 p-2.5 rounded-lg border border-purple-200/80 flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
                                                                {n2SpecificUser.name.charAt(0)}
                                                            </div>
                                                            <div className="text-xs">
                                                                <div className="font-semibold text-slate-800">{n2SpecificUser.name}</div>
                                                                <div className="text-[10px] text-slate-500">@{n2SpecificUser.username} • {n2SpecificUser.role}</div>
                                                            </div>
                                                            <Badge className="ml-auto bg-emerald-500 text-white text-[10px]">Ativo</Badge>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <p className="text-[11px] text-slate-500 leading-tight">
                                                A aprovação no N2 conclui o processo e sincroniza imediatamente com a folha e Ponto Secullum.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
