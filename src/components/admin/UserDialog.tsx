"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createUser, updateUser } from "@/app/actions";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

interface User {
    id: string;
    name: string;
    username: string;
    email: string | null;
    phone?: string | null;
    role: string;
    isActive: boolean;
    clientIds?: string[];
}

interface Client {
    id: string;
    name: string;
}

interface UserDialogProps {
    user?: User; // If provided, edit mode
    clients?: Client[];
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function UserDialog({ user, clients = [], trigger, open, onOpenChange }: UserDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [internalOpen, setInternalOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<string>(user?.role || "SUPERVISOR");
    const [selectedClients, setSelectedClients] = useState<string[]>(user?.clientIds || []);

    const isEdit = !!user;

    useEffect(() => {
        if (user) {
            setSelectedRole(user.role);
            setSelectedClients(user.clientIds || []);
        } else {
            setSelectedRole("SUPERVISOR");
            setSelectedClients([]);
        }
    }, [user, open, internalOpen]);

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

            if (isEdit) {
                formData.append("id", user!.id);
                await updateUser(formData);
                toast.success("Usuário atualizado com sucesso!");
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

    const isOpen = open !== undefined ? open : internalOpen;
    const setOpen = onOpenChange || setInternalOpen;

    return (
        <Dialog open={isOpen} onOpenChange={setOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            {!trigger && !isEdit && (
                <DialogTrigger asChild>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-500/20">
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Usuário
                    </Button>
                </DialogTrigger>
            )}

            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
                </DialogHeader>

                <form action={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <Label>Nome Completo</Label>
                        <Input name="name" defaultValue={user?.name} required className="h-10 text-xs border-slate-200" />
                    </div>

                    <div className="space-y-1">
                        <Label>Email</Label>
                        <Input name="email" type="email" defaultValue={user?.email || ""} placeholder="exemplo@empresa.com" className="h-10 text-xs border-slate-200" />
                    </div>

                    <div className="space-y-1">
                        <Label>Telefone / WhatsApp</Label>
                        <Input name="phone" defaultValue={user?.phone || ""} placeholder="41999999999" className="h-10 text-xs border-slate-200" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label>Usuário (Login)</Label>
                            <Input name="username" defaultValue={user?.username} required disabled={isEdit} className="h-10 text-xs border-slate-200" />
                        </div>
                        <div className="space-y-1">
                            <Label>Senha {isEdit && "(Opcional)"}</Label>
                            <Input name="password" type="password" required={!isEdit} className="h-10 text-xs border-slate-200" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label>Perfil de Acesso</Label>
                        <Select 
                            name="role" 
                            defaultValue={selectedRole} 
                            value={selectedRole}
                            onValueChange={setSelectedRole}
                        >
                            <SelectTrigger className="h-10 text-xs border-slate-200">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ADMIN">Administrador</SelectItem>
                                <SelectItem value="COORD_RH">Coordenador RH</SelectItem>
                                <SelectItem value="ASSIST_RH">Assistente RH</SelectItem>
                                <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                                <SelectItem value="CLIENTE">Cliente (Acesso Externo)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedRole === "CLIENTE" && (
                        <div className="space-y-2 border border-slate-100 p-3 rounded-lg bg-slate-50/50">
                            <Label className="text-xs font-black text-slate-700 uppercase tracking-wider">Vincular Contratos (Clientes)</Label>
                            {clients.length > 0 ? (
                                <ScrollArea className="h-32 border border-slate-200 rounded bg-white p-2">
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

                    {isEdit && (
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                            <div className="space-y-0.5">
                                <Label>Status do Usuário</Label>
                                <div className="text-xs text-slate-500">
                                    {user?.isActive ? "Ativo no sistema" : "Acesso bloqueado"}
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

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 h-10 font-bold">
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEdit ? "Salvar Alterações" : "Criar Usuário")}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
