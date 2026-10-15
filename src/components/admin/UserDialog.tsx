"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { createUser, updateUser } from "@/app/actions";
import { Loader2, Plus, ShieldCheck, Users, Search, UserCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export interface User {
    id: string;
    name: string;
    username: string;
    email: string | null;
    phone?: string | null;
    role: string;
    isActive: boolean;
    clientIds?: string[];
    managerId?: string | null;
    manager?: { id: string; name: string; role: string; isApproverN1?: boolean; isApproverN2?: boolean } | null;
    isApproverN1?: boolean;
    isApproverN2?: boolean;
    subordinates?: Array<{ id: string; name: string; username: string; role: string; isActive?: boolean }>;
}

interface Client {
    id: string;
    name: string;
}

interface UserDialogProps {
    user?: User; // If provided, edit mode
    clients?: Client[];
    allUsers?: User[];
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function UserDialog({ user, clients = [], allUsers = [], trigger, open, onOpenChange }: UserDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [internalOpen, setInternalOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<string>(user?.role || "SUPERVISOR");
    const [selectedClients, setSelectedClients] = useState<string[]>(user?.clientIds || []);
    const [selectedManagerId, setSelectedManagerId] = useState<string>(user?.managerId || "NONE");
    const [isApproverN1, setIsApproverN1] = useState<boolean>(user?.isApproverN1 || false);
    const [isApproverN2, setIsApproverN2] = useState<boolean>(user?.isApproverN2 || false);
    const [selectedSubordinates, setSelectedSubordinates] = useState<string[]>([]);
    const [subSearch, setSubSearch] = useState<string>("");

    const isEdit = !!user;

    useEffect(() => {
        if (user) {
            setSelectedRole(user.role);
            setSelectedClients(user.clientIds || []);
            setSelectedManagerId(user.managerId || "NONE");
            setIsApproverN1(!!user.isApproverN1);
            setIsApproverN2(!!user.isApproverN2);

            // Subordinados alocados a este usuário
            const currentSubs = user.subordinates 
                ? user.subordinates.map(s => s.id) 
                : allUsers.filter(u => u.managerId === user.id).map(u => u.id);
            setSelectedSubordinates(currentSubs);
        } else {
            setSelectedRole("SUPERVISOR");
            setSelectedClients([]);
            setSelectedManagerId("NONE");
            setIsApproverN1(false);
            setIsApproverN2(false);
            setSelectedSubordinates([]);
        }
        setSubSearch("");
    }, [user, open, internalOpen, allUsers]);

    async function handleSubmit(formData: FormData) {
        setIsLoading(true);
        try {
            // Append clientIds manually to formData
            formData.delete("clientIds");
            if (selectedRole === "CLIENTE") {
                selectedClients.forEach(id => {
                    formData.append("clientIds", id);
                });
            }

            formData.set("managerId", selectedManagerId);
            formData.set("isApproverN1", String(isApproverN1));
            formData.set("isApproverN2", String(isApproverN2));

            // Envia a equipe de subordinados alocada
            formData.set("hasSubordinatesPayload", "true");
            formData.delete("subordinateIds");
            selectedSubordinates.forEach(subId => {
                formData.append("subordinateIds", subId);
            });

            if (isEdit) {
                formData.append("id", user!.id);
                await updateUser(formData);
                toast.success(`Usuário ${formData.get("name")} atualizado com sucesso!`);
            } else {
                await createUser(formData);
                toast.success("Usuário criado com sucesso!");
            }
            if (onOpenChange) onOpenChange(false);
            setInternalOpen(false);
        } catch (error) {
            toast.error("Erro ao salvar usuário.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }

    const toggleClient = (clientId: string) => {
        setSelectedClients(prev =>
            prev.includes(clientId)
                ? prev.filter(id => id !== clientId)
                : [...prev, clientId]
        );
    };

    const toggleSubordinate = (subId: string) => {
        setSelectedSubordinates(prev =>
            prev.includes(subId)
                ? prev.filter(id => id !== subId)
                : [...prev, subId]
        );
    };

    const isOpen = open !== undefined ? open : internalOpen;
    const setOpen = onOpenChange || setInternalOpen;

    // Gestores disponíveis para ser o superior imediato deste usuário (não pode ser ele mesmo)
    const availableManagers = allUsers.filter(u => (!user || u.id !== user.id) && u.isActive !== false);

    // Usuários disponíveis para serem alocados como subordinados (não pode ser ele mesmo)
    const availableSubordinates = allUsers.filter(u => (!user || u.id !== user.id) && u.isActive !== false);

    // Filtragem da busca de subordinados
    const filteredSubordinates = useMemo(() => {
        if (!subSearch.trim()) return availableSubordinates;
        const term = subSearch.toLowerCase();
        return availableSubordinates.filter(u => 
            u.name.toLowerCase().includes(term) || 
            u.username.toLowerCase().includes(term) ||
            u.role.toLowerCase().includes(term)
        );
    }, [availableSubordinates, subSearch]);

    // Gestor selecionado atualmente como superior imediato
    const currentSelectedManager = allUsers.find(u => u.id === selectedManagerId);
    const managerIsN2OrAdmin = currentSelectedManager?.isApproverN2 || currentSelectedManager?.role === 'ADMIN';

    return (
        <Dialog open={isOpen} onOpenChange={setOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            {!trigger && !isEdit && (
                <DialogTrigger asChild>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/20 rounded-xl px-4 h-10 flex items-center gap-2 cursor-pointer">
                        <Plus className="w-4 h-4 mr-0.5" />
                        <span>Novo Usuário</span>
                    </Button>
                </DialogTrigger>
            )}

            <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto bg-white border border-slate-200 text-slate-900 shadow-2xl rounded-2xl p-6">
                <DialogHeader className="pb-2 border-b border-slate-100">
                    <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                        {isEdit ? `Editar Perfil: ${user?.name}` : "Cadastrar Novo Usuário"}
                    </DialogTitle>
                    <p className="text-xs text-slate-500">
                        {isEdit 
                            ? "Configure os dados cadastrais, alçadas de aprovação (N1/N2) e aloque a equipe subordinada."
                            : "Preencha os dados de acesso e defina as regras de subordinação hierárquica."}
                    </p>
                </DialogHeader>

                <form action={handleSubmit} className="space-y-4 pt-2">
                    {/* Dados Básicos */}
                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs font-bold text-slate-700">Nome Completo</Label>
                            <Input name="name" defaultValue={user?.name} required className="h-10 text-xs border-slate-200 rounded-xl mt-1 font-medium" placeholder="Ex: Wellington Klas" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-bold text-slate-700">Email Corporativo</Label>
                                <Input name="email" type="email" defaultValue={user?.email || ""} placeholder="exemplo@empresa.com" className="h-10 text-xs border-slate-200 rounded-xl mt-1" />
                            </div>
                            <div>
                                <Label className="text-xs font-bold text-slate-700">WhatsApp / Telefone</Label>
                                <Input name="phone" defaultValue={user?.phone || ""} placeholder="Ex: 41999999999" className="h-10 text-xs border-slate-200 rounded-xl mt-1" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-bold text-slate-700">Usuário (Login)</Label>
                                <Input name="username" defaultValue={user?.username} required disabled={isEdit} className="h-10 text-xs border-slate-200 rounded-xl mt-1 font-mono" placeholder="nome.sobrenome" />
                            </div>
                            <div>
                                <Label className="text-xs font-bold text-slate-700">Senha {isEdit && "(Opcional)"}</Label>
                                <Input name="password" type="password" required={!isEdit} className="h-10 text-xs border-slate-200 rounded-xl mt-1" placeholder={isEdit ? "Deixe em branco p/ manter" : "••••••••"} />
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs font-bold text-slate-700">Perfil de Acesso no Sistema</Label>
                            <Select 
                                name="role" 
                                defaultValue={selectedRole} 
                                value={selectedRole}
                                onValueChange={setSelectedRole}
                            >
                                <SelectTrigger className="h-10 text-xs border-slate-200 rounded-xl mt-1 bg-slate-50/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ADMIN">Administrador Geral (ADMIN)</SelectItem>
                                    <SelectItem value="COORD_RH">Coordenador RH (COORD_RH)</SelectItem>
                                    <SelectItem value="ASSIST_RH">Assistente RH (ASSIST_RH)</SelectItem>
                                    <SelectItem value="SUPERVISOR">Supervisor Operacional (SUPERVISOR)</SelectItem>
                                    <SelectItem value="CLIENTE">Cliente / Acesso Externo (CLIENTE)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* BLOCO CENTRAL: HIERARQUIA & ALÇADAS DE APROVAÇÃO (N1 / N2) */}
                    {selectedRole !== "CLIENTE" && (
                        <div className="space-y-4 p-4 rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 shadow-sm">
                            <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                                    <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                                        Hierarquia & Alçadas de Aprovação (N1 / N2)
                                    </h3>
                                </div>
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                                    Workflow Dinâmico
                                </span>
                            </div>

                            {/* 1. Alçadas que este usuário possui */}
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-xs font-bold text-slate-800 block mb-1.5">
                                        Definir se este Usuário é N1 ou N2:
                                    </Label>
                                    <Select
                                        value={
                                            isApproverN1 && isApproverN2 ? "N1_N2" :
                                            isApproverN1 ? "N1" :
                                            isApproverN2 ? "N2" : "NONE"
                                        }
                                        onValueChange={(val) => {
                                            if (val === "N1") {
                                                setIsApproverN1(true);
                                                setIsApproverN2(false);
                                            } else if (val === "N2") {
                                                setIsApproverN1(false);
                                                setIsApproverN2(true);
                                            } else if (val === "N1_N2") {
                                                setIsApproverN1(true);
                                                setIsApproverN2(true);
                                            } else {
                                                setIsApproverN1(false);
                                                setIsApproverN2(false);
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="h-10 text-xs font-bold border-indigo-200 bg-white rounded-xl shadow-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NONE" className="text-xs font-medium text-slate-600">
                                                Apenas Solicitante (Sem Alçada de Aprovação)
                                            </SelectItem>
                                            <SelectItem value="N1" className="text-xs font-bold text-amber-800">
                                                ⭐ Gestor Nível 1 (N1 - Validação Operacional / Equipe)
                                            </SelectItem>
                                            <SelectItem value="N2" className="text-xs font-bold text-purple-800">
                                                👑 Aprovador Nível 2 (N2 - Diretoria / Efetivação Final)
                                            </SelectItem>
                                            <SelectItem value="N1_N2" className="text-xs font-bold text-indigo-900">
                                                ⭐👑 Ambos (N1 e N2 - Gestor e Diretoria)
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Nível 1 (N1) */}
                                    <div className={`p-3 rounded-xl border transition-all ${isApproverN1 ? "border-amber-400 bg-amber-50/60 shadow-sm" : "border-slate-200 bg-white"}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <Badge className={`text-[10px] font-black ${isApproverN1 ? "bg-amber-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                                                    NÍVEL 1 (N1)
                                                </Badge>
                                            </div>
                                            <Switch
                                                id="isApproverN1"
                                                checked={isApproverN1}
                                                onCheckedChange={setIsApproverN1}
                                            />
                                        </div>
                                        <Label htmlFor="isApproverN1" className="text-xs font-bold text-slate-900 block mt-2 cursor-pointer">
                                            Gestor Imediato (Operacional)
                                        </Label>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                                            Valida em 1ª instância as solicitações dos colaboradores alocados à sua equipe.
                                        </p>
                                    </div>

                                    {/* Nível 2 (N2) */}
                                    <div className={`p-3 rounded-xl border transition-all ${isApproverN2 ? "border-purple-400 bg-purple-50/60 shadow-sm" : "border-slate-200 bg-white"}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <Badge className={`text-[10px] font-black ${isApproverN2 ? "bg-purple-700 text-white" : "bg-slate-200 text-slate-700"}`}>
                                                    NÍVEL 2 (N2)
                                                </Badge>
                                            </div>
                                            <Switch
                                                id="isApproverN2"
                                                checked={isApproverN2}
                                                onCheckedChange={setIsApproverN2}
                                            />
                                        </div>
                                        <Label htmlFor="isApproverN2" className="text-xs font-bold text-slate-900 block mt-2 cursor-pointer">
                                            Diretoria / Efetivação Final
                                        </Label>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                                            Deliberação executiva final. Após aprovar, libera imediatamente para o RH trabalhar.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Superior Imediato deste usuário */}
                            <div className="space-y-1.5 pt-2 border-t border-indigo-100/70">
                                <Label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                                    <span>Superior Imediato deste Usuário (A quem ele se reporta):</span>
                                </Label>
                                <Select 
                                    value={selectedManagerId}
                                    onValueChange={setSelectedManagerId}
                                >
                                    <SelectTrigger className="h-10 text-xs border-slate-200 bg-white shadow-sm rounded-xl">
                                        <SelectValue placeholder="Selecione o superior imediato..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NONE">
                                            <span className="text-slate-500 font-semibold">Nenhum (Direção Geral / Sem Superior N1)</span>
                                        </SelectItem>
                                        {availableManagers.map(mgr => (
                                            <SelectItem key={mgr.id} value={mgr.id}>
                                                <span className="font-bold text-slate-900">{mgr.name}</span>
                                                <span className="text-[11px] text-slate-500 ml-1.5">
                                                    ({mgr.role}) {mgr.isApproverN2 ? "• Diretoria (N2)" : mgr.isApproverN1 ? "• Gestor N1" : ""}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <div className="p-2.5 rounded-xl text-[11px] leading-relaxed mt-1.5 border">
                                    {selectedManagerId === "NONE" ? (
                                        <div className="text-amber-800 bg-amber-50/70 border-amber-200/60 p-2 rounded-lg">
                                            ⚡ <strong>Sem Superior N1:</strong> Tudo que este usuário solicitar subirá <strong>DIRETO para o Nível 2 (Diretoria)</strong>.
                                        </div>
                                    ) : managerIsN2OrAdmin ? (
                                        <div className="text-purple-900 bg-purple-50/80 border-purple-200 p-2 rounded-lg">
                                            👑 <strong>Ligado diretamente ao N2 ({currentSelectedManager?.name}):</strong> Como o superior dele já é Diretoria (N2), as solicitações não passam por N1 intermediário. <strong>Apenas a aprovação do N2 já libera direto para o RH trabalhar.</strong>
                                        </div>
                                    ) : (
                                        <div className="text-indigo-900 bg-indigo-50/80 border-indigo-200 p-2 rounded-lg">
                                            🔄 <strong>Fluxo Completo (N1 ➔ N2 ➔ RH):</strong> As solicitações passam primeiro pela validação do <strong>N1 ({currentSelectedManager?.name})</strong>, depois sobem para aprovação do <strong>N2</strong> e então ficam liberadas para o RH.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 3. ALOCAÇÃO DE EQUIPE (QUEM RESPONDE A ESTE GESTOR) */}
                            <div className="space-y-2 pt-2 border-t border-indigo-100/70">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                            <Users className="w-4 h-4 text-indigo-600" />
                                            <span>Equipe Subordinada (Colaboradores que respondem a ele)</span>
                                        </Label>
                                        <p className="text-[11px] text-slate-500">
                                            Tudo que esses colaboradores solicitarem subirá primeiro para {user?.name || "este usuário"} aprovar.
                                        </p>
                                    </div>
                                    <Badge className="bg-indigo-600 text-white font-bold text-xs">
                                        {selectedSubordinates.length} na equipe
                                    </Badge>
                                </div>

                                {/* Busca de Subordinados */}
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        placeholder="Buscar por nome ou login do colaborador..."
                                        value={subSearch}
                                        onChange={(e) => setSubSearch(e.target.value)}
                                        className="pl-8 h-8 text-xs bg-white border-slate-200 rounded-lg"
                                    />
                                </div>

                                {/* Lista de Colaboradores Selecionáveis */}
                                <ScrollArea className="h-44 border border-slate-200 rounded-xl bg-white p-2">
                                    <div className="space-y-1.5">
                                        {filteredSubordinates.length === 0 ? (
                                            <div className="text-center py-6 text-xs text-slate-400">
                                                Nenhum colaborador encontrado para "{subSearch}".
                                            </div>
                                        ) : (
                                            filteredSubordinates.map(sub => {
                                                const isChecked = selectedSubordinates.includes(sub.id);
                                                const hasOtherManager = sub.managerId && sub.managerId !== user?.id;
                                                const otherManagerName = allUsers.find(u => u.id === sub.managerId)?.name;

                                                return (
                                                    <div 
                                                        key={sub.id} 
                                                        onClick={() => toggleSubordinate(sub.id)}
                                                        className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                                            isChecked 
                                                                ? "bg-indigo-50/70 border-indigo-300 text-indigo-950 font-bold" 
                                                                : "border-slate-100 hover:bg-slate-50 text-slate-700"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <Checkbox 
                                                                id={`sub-${sub.id}`} 
                                                                checked={isChecked}
                                                                onCheckedChange={() => toggleSubordinate(sub.id)}
                                                            />
                                                            <div>
                                                                <span className="font-bold text-slate-900">{sub.name}</span>
                                                                <span className="text-[11px] text-slate-400 ml-1.5">(@{sub.username})</span>
                                                                <span className="text-[10px] text-slate-500 block">Perfil: {sub.role}</span>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            {isChecked ? (
                                                                <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                    <UserCheck className="w-3 h-3" /> Responde a ele
                                                                </span>
                                                            ) : hasOtherManager ? (
                                                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded" title="Já possui gestor">
                                                                    Resp. a: {otherManagerName}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 italic">Sem gestor</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    )}

                    {/* Vínculo de Contratos (Apenas Clientes) */}
                    {selectedRole === "CLIENTE" && (
                        <div className="space-y-2 border border-slate-200 p-3 rounded-xl bg-slate-50/50">
                            <Label className="text-xs font-black text-slate-700 uppercase tracking-wider">Vincular Contratos (Clientes)</Label>
                            {clients.length > 0 ? (
                                <ScrollArea className="h-32 border border-slate-200 rounded-lg bg-white p-2">
                                    <div className="space-y-2">
                                        {clients.map(c => (
                                            <div key={c.id} className="flex items-center gap-2">
                                                <Checkbox 
                                                    id={`client-${c.id}`} 
                                                    checked={selectedClients.includes(c.id)}
                                                    onCheckedChange={() => toggleClient(c.id)}
                                                />
                                                <label 
                                                    htmlFor={`client-${c.id}`} 
                                                    className="text-xs text-slate-700 cursor-pointer select-none font-medium"
                                                >
                                                    {c.name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            ) : (
                                <div className="text-[10px] text-slate-400 italic">Nenhum cliente cadastrado no sistema.</div>
                            )}
                        </div>
                    )}

                    {/* Status Ativo / Inativo */}
                    {isEdit && (
                        <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-bold text-slate-800">Status da Conta</Label>
                                <div className="text-xs text-slate-500">
                                    {user?.isActive ? "Usuário ativo e com acesso liberado" : "Acesso bloqueado ao sistema"}
                                </div>
                            </div>
                            <input type="hidden" name="isActive" value={user?.isActive ? "true" : "false"} />
                            <Switch
                                defaultChecked={user?.isActive}
                                onCheckedChange={(checked) => {
                                    const input = document.querySelector('input[name="isActive"]') as HTMLInputElement;
                                    if (input) input.value = checked ? "true" : "false";
                                }}
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => (onOpenChange ? onOpenChange(false) : setInternalOpen(false))}
                            className="border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-xs h-10"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isLoading} 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs h-10 px-5 shadow-sm shadow-indigo-600/20"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                            <span>{isEdit ? "Salvar Alterações do Perfil" : "Criar Usuário"}</span>
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
