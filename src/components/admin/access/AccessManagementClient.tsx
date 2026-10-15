"use client";

import React, { useState } from "react";
import { UserDialog } from "@/components/admin/UserDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit2, Search, Trash2, UserCog, SlidersHorizontal, Users, ShieldCheck, CheckCircle2, Loader2, Power, RotateCcw, UserCheck, Crown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { deleteUser, toggleUserActive } from "@/app/actions";
import { WorkflowRulesConfig, WorkflowRuleData, SystemUserData } from "@/components/admin/approvals/WorkflowRulesConfig";
import { toast } from "sonner";

interface AccessManagementClientProps {
    users: SystemUserData[];
    rules: WorkflowRuleData[];
    clientsList: { id: string; name: string }[];
}

export function AccessManagementClient({ users, rules, clientsList }: AccessManagementClientProps) {
    const [selectedTab, setSelectedTab] = useState<"USERS" | "WORKFLOW">("USERS");
    const [searchTerm, setSearchTerm] = useState("");
    const [processingId, setProcessingId] = useState<string | null>(null);

    const handleDeleteUser = async (id: string, name: string) => {
        if (!window.confirm(`Tem certeza que deseja excluir/inativar o usuário "${name}"?`)) {
            return;
        }
        setProcessingId(id);
        try {
            const res = await deleteUser(id);
            if (res?.success) {
                toast.success(res.message);
            } else {
                toast.error(res?.error || "Erro ao excluir usuário.");
            }
        } catch (err: any) {
            toast.error("Erro inesperado ao excluir usuário.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleToggleActive = async (id: string, currentStatus: boolean, name: string) => {
        const nextStatus = !currentStatus;
        const actionLabel = nextStatus ? "reativar" : "inativar";
        if (!window.confirm(`Deseja realmente ${actionLabel} o usuário "${name}"?`)) {
            return;
        }
        setProcessingId(id);
        try {
            const res = await toggleUserActive(id, nextStatus);
            if (res?.success) {
                toast.success(res.message);
            } else {
                toast.error(res?.error || `Erro ao ${actionLabel} usuário.`);
            }
        } catch (err: any) {
            toast.error(`Erro ao ${actionLabel} usuário.`);
        } finally {
            setProcessingId(null);
        }
    };

    const activeUsers = users.filter(u => u.isActive !== false);
    const usersWithManager = users.filter(u => u.managerId);
    const n1Managers = users.filter(u => u.isApproverN1);
    const n2Directors = users.filter(u => u.isApproverN2);

    const filteredUsers = users.filter(u => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return (
            u.name.toLowerCase().includes(term) ||
            u.username.toLowerCase().includes(term) ||
            (u.email && u.email.toLowerCase().includes(term)) ||
            (u.manager && u.manager.name.toLowerCase().includes(term)) ||
            u.role.toLowerCase().includes(term)
        );
    });

    return (
        <div className="space-y-6">
            {/* Top Bar Principal com Botão Novo Usuário SEMPRE VISÍVEL */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
                        <UserCog className="w-8 h-8 text-indigo-600" />
                        Gestão de Usuários & Alçadas (N1 / N2)
                    </h1>
                    <p className="text-slate-500 font-medium text-xs sm:text-sm mt-1">
                        Crie e edite perfis de usuários, defina hierarquia N1/N2 e aloque equipes subordinadas.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Botão Novo Usuário SEMPRE PRESENTE */}
                    <UserDialog clients={clientsList} allUsers={users as any} />
                </div>
            </div>

            {/* Navegação por Abas */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                    onClick={() => setSelectedTab("USERS")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedTab === "USERS"
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                >
                    <Users className="w-4 h-4" />
                    <span>Usuários & Hierarquias</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        selectedTab === "USERS" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    }`}>
                        {users.length}
                    </span>
                </button>

                <button
                    onClick={() => setSelectedTab("WORKFLOW")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedTab === "WORKFLOW"
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Matriz de Processos ({rules.length})</span>
                </button>
            </div>

            {/* Conteúdo da Aba Selecionada */}
            {selectedTab === "USERS" ? (
                <div className="space-y-6">
                    {/* Mini Cards de Estatísticas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total de Usuários</span>
                                <div className="text-xl font-black text-slate-800">{users.length} ({activeUsers.length} ativos)</div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
                                <UserCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Gestores N1 Ativos</span>
                                <div className="text-xl font-black text-amber-900">{n1Managers.length}</div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/20 shadow-sm flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
                                <Crown className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 block">Aprovadores N2 (Diretoria)</span>
                                <div className="text-xl font-black text-purple-900">{n2Directors.length}</div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Com Superior Imediato</span>
                                <div className="text-xl font-black text-emerald-900">{usersWithManager.length}</div>
                            </div>
                        </div>
                    </div>

                    <Card className="border border-slate-200 shadow-sm bg-white rounded-2xl overflow-hidden">
                        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/40">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                                        Perfis de Usuários & Estrutura Hierárquica
                                    </CardTitle>
                                    <CardDescription className="text-xs text-slate-500">
                                        Clique em "Editar" para configurar alçadas N1/N2 e alocar colaboradores que respondem a cada gestor.
                                    </CardDescription>
                                </div>
                                <div className="relative w-full sm:w-80">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input 
                                        placeholder="Buscar por nome, login, perfil..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 h-9 text-xs bg-white border-slate-200 rounded-xl" 
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-slate-100 bg-slate-50/80">
                                        <TableHead className="text-xs font-bold text-slate-700 py-3.5">Colaborador / Login</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-700 py-3.5">Perfil de Acesso</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-700 py-3.5">Alçadas (N1 / N2)</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-700 py-3.5">Superior Imediato</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-700 py-3.5">Equipe Subordinada</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-700 py-3.5">Status</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-700 text-right pr-4 py-3.5">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-10 text-xs text-slate-400">
                                                Nenhum usuário encontrado para a busca "{searchTerm}".
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredUsers.map((user: any) => {
                                            const subs = user.subordinates || [];
                                            const isN2Direct = user.manager && (user.manager.isApproverN2 || user.manager.role === 'ADMIN');

                                            return (
                                                <TableRow key={user.id} className="hover:bg-slate-50/70 border-slate-100 transition-colors">
                                                    {/* Nome, Email e Login */}
                                                    <TableCell className="py-3.5">
                                                        <div className="font-bold text-xs text-slate-900">{user.name}</div>
                                                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">@{user.username}</div>
                                                        {user.email && (
                                                            <div className="text-[10px] text-slate-400">{user.email}</div>
                                                        )}
                                                    </TableCell>

                                                    {/* Perfil de Acesso */}
                                                    <TableCell>
                                                        <Badge variant="outline" className={`text-[10px] font-bold ${
                                                            user.role === 'ADMIN' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                            user.role === 'COORD_RH' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                            user.role === 'ASSIST_RH' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                            user.role === 'SUPERVISOR' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                            'bg-slate-100 text-slate-700 border-slate-200'
                                                        }`}>
                                                            {user.role}
                                                        </Badge>
                                                    </TableCell>

                                                    {/* Alçadas (N1 / N2) */}
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            {user.isApproverN1 && (
                                                                <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-black text-[10px] w-fit shadow-none">
                                                                    ⭐ Gestor N1
                                                                </Badge>
                                                            )}
                                                            {user.isApproverN2 && (
                                                                <Badge className="bg-purple-100 text-purple-900 border-purple-300 font-black text-[10px] w-fit shadow-none">
                                                                    👑 Diretoria N2
                                                                </Badge>
                                                            )}
                                                            {!user.isApproverN1 && !user.isApproverN2 && (
                                                                <span className="text-[10px] text-slate-400 italic">
                                                                    Solicitante
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>

                                                    {/* Superior Imediato */}
                                                    <TableCell>
                                                        {user.manager ? (
                                                            <div className="flex flex-col">
                                                                {isN2Direct ? (
                                                                    <div className="p-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-950 w-fit">
                                                                        <span className="text-[11px] font-black flex items-center gap-1">
                                                                            <Crown className="w-3 h-3 text-purple-600" />
                                                                            Direto N2: {user.manager.name}
                                                                        </span>
                                                                        <span className="text-[9px] text-purple-700 block font-medium">
                                                                            Aprovou no N2, já libera pro RH
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 w-fit">
                                                                        <span className="text-[11px] font-black flex items-center gap-1">
                                                                            <UserCheck className="w-3 h-3 text-amber-600" />
                                                                            N1: {user.manager.name}
                                                                        </span>
                                                                        <span className="text-[9px] text-amber-700 block font-medium">
                                                                            Valida no N1 e sobe pro N2
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded w-fit inline-block">
                                                                Sem N1 (Sobe direto pro N2)
                                                            </span>
                                                        )}
                                                    </TableCell>

                                                    {/* Equipe Subordinada */}
                                                    <TableCell>
                                                        {subs.length > 0 ? (
                                                            <div className="flex flex-col gap-1 max-w-[220px]">
                                                                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-black text-[10px] w-fit shadow-none">
                                                                    👥 {subs.length} liderado(s)
                                                                </Badge>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {subs.map((s: any) => (
                                                                        <span key={s.id} className="text-[10px] bg-slate-100 text-slate-700 font-medium px-1.5 py-0.2 rounded border border-slate-200">
                                                                            {s.name.split(" ")[0]}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] text-slate-400 italic">
                                                                Sem equipe alocada
                                                            </span>
                                                        )}
                                                    </TableCell>

                                                    {/* Status */}
                                                    <TableCell>
                                                        <Badge 
                                                            variant={user.isActive ? "default" : "destructive"} 
                                                            className={`text-[10px] font-bold ${user.isActive ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
                                                        >
                                                            {user.isActive ? "Ativo" : "Inativo"}
                                                        </Badge>
                                                    </TableCell>

                                                    {/* Ações */}
                                                    <TableCell className="text-right pr-4">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {/* Botão Editar Perfil com texto destacado */}
                                                            <UserDialog
                                                                user={user}
                                                                clients={clientsList}
                                                                allUsers={users as any}
                                                                trigger={
                                                                    <Button 
                                                                        size="sm" 
                                                                        variant="outline" 
                                                                        className="h-8 px-2.5 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700 font-bold text-xs gap-1 rounded-lg cursor-pointer shadow-sm"
                                                                    >
                                                                        <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                                                                        <span>Editar</span>
                                                                    </Button>
                                                                }
                                                            />

                                                            {/* Alternar Status (Ativar / Inativar) */}
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className={`h-8 w-8 ${user.isActive ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}`}
                                                                title={user.isActive ? "Inativar Usuário" : "Reativar Usuário"}
                                                                disabled={processingId === user.id}
                                                                onClick={() => handleToggleActive(user.id, user.isActive, user.name)}
                                                            >
                                                                {processingId === user.id ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : user.isActive ? (
                                                                    <Power className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                                )}
                                                            </Button>

                                                            {/* Excluir Usuário */}
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                                title="Excluir Usuário"
                                                                disabled={processingId === user.id}
                                                                onClick={() => handleDeleteUser(user.id, user.name)}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <WorkflowRulesConfig 
                    initialRules={rules} 
                    allUsers={users} 
                    isAdmin={true} 
                />
            )}
        </div>
    );
}
