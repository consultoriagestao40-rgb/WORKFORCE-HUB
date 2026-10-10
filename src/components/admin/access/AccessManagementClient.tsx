"use client";

import React, { useState } from "react";
import { UserDialog } from "@/components/admin/UserDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit2, Search, Trash2, UserCog, SlidersHorizontal, Users, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { deleteUser } from "@/app/actions";
import { WorkflowRulesConfig, WorkflowRuleData, SystemUserData } from "@/components/admin/approvals/WorkflowRulesConfig";

interface AccessManagementClientProps {
    users: SystemUserData[];
    rules: WorkflowRuleData[];
    clientsList: { id: string; name: string }[];
}

export function AccessManagementClient({ users, rules, clientsList }: AccessManagementClientProps) {
    const [selectedTab, setSelectedTab] = useState<"USERS" | "WORKFLOW">("USERS");
    const [searchTerm, setSearchTerm] = useState("");

    const activeUsers = users.filter(u => u.isActive !== false);
    const usersWithManager = users.filter(u => u.managerId);

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
            {/* Top Bar com Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
                        <UserCog className="w-7 h-7 text-indigo-600" />
                        Gestão de Acessos e Alçadas
                    </h1>
                    <p className="text-slate-500 font-medium text-xs mt-0.5">
                        Gerencie usuários, permissões, hierarquia de gestores imediatos e matriz de alçadas N1/N2
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {selectedTab === "USERS" && (
                        <UserDialog clients={clientsList} allUsers={users as any} />
                    )}
                </div>
            </div>

            {/* Navegação por Abas */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                    onClick={() => setSelectedTab("USERS")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        selectedTab === "USERS"
                            ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                >
                    <Users className="w-4 h-4" />
                    <span>Usuários Cadastrados</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        selectedTab === "USERS" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    }`}>
                        {users.length}
                    </span>
                </button>

                <button
                    onClick={() => setSelectedTab("WORKFLOW")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        selectedTab === "WORKFLOW"
                            ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Alçadas de Aprovação (N1 / N2)</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {rules.length} processos
                    </span>
                </button>
            </div>

            {/* Conteúdo da Aba Selecionada */}
            {selectedTab === "USERS" ? (
                <div className="space-y-6">
                    {/* Mini Cards de Estatísticas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total de Usuários</span>
                                <div className="text-xl font-black text-slate-800">{users.length}</div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Usuários Ativos</span>
                                <div className="text-xl font-black text-emerald-600">{activeUsers.length}</div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Com Gestor N1 Vinculado</span>
                                <div className="text-xl font-black text-slate-800">{usersWithManager.length}</div>
                            </div>
                        </div>
                    </div>

                    <Card className="border border-slate-200 shadow-sm bg-white">
                        <CardHeader className="pb-3 border-b border-slate-100">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                                        Usuários do Sistema
                                    </CardTitle>
                                    <CardDescription className="text-xs text-slate-500">
                                        Lista de colaboradores com credencial e hierarquia de aprovação imediata
                                    </CardDescription>
                                </div>
                                <div className="relative w-full sm:w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input 
                                        placeholder="Buscar por nome, login, perfil..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 h-9 text-xs bg-slate-50 border-slate-200" 
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-slate-100 bg-slate-50/70">
                                        <TableHead className="text-xs font-bold text-slate-700">Nome / Email</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-700">Usuário (Login)</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-700">Perfil de Acesso</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-700">Gestor Imediato (Superior N1)</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-700">Status</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-700 text-right pr-4">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-400">
                                                Nenhum usuário encontrado para a busca "{searchTerm}".
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredUsers.map((user: any) => (
                                            <TableRow key={user.id} className="hover:bg-slate-50/60 border-slate-100 transition-colors">
                                                <TableCell className="py-3">
                                                    <div className="font-bold text-xs text-slate-900">{user.name}</div>
                                                    <div className="text-[11px] text-slate-400">{user.email || "Sem email"}</div>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-slate-600">
                                                    @{user.username}
                                                </TableCell>
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
                                                <TableCell>
                                                    {user.manager ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                {user.manager.name}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-tight ml-3">
                                                                {user.manager.role}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">
                                                            {user.role === 'ADMIN' ? 'Direção Geral (Sem Superior)' : 'Não configurado'}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge 
                                                        variant={user.isActive ? "default" : "destructive"} 
                                                        className={`text-[10px] ${user.isActive ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
                                                    >
                                                        {user.isActive ? "Ativo" : "Inativo"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-4">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <UserDialog
                                                            user={user}
                                                            clients={clientsList}
                                                            allUsers={users as any}
                                                            trigger={
                                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50">
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            }
                                                        />
                                                        <form action={deleteUser.bind(null, user.id)}>
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </form>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
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
