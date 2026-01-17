"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createUser, updateUser } from "@/app/actions";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface User {
    id: string;
    name: string;
    username: string;
    email: string | null;
    role: string;
    isActive: boolean;
}

interface UserDialogProps {
    user?: User; // If provided, edit mode
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function UserDialog({ user, trigger, open, onOpenChange }: UserDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [internalOpen, setInternalOpen] = useState(false);
    const activeInputRef = useRef<HTMLInputElement>(null);

    const isEdit = !!user;

    async function handleSubmit(formData: FormData) {
        setIsLoading(true);
        try {
            if (isEdit) {
                formData.append("id", user!.id);
                // Check if password was provided, otherwise don't send it to keep old
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

            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
                </DialogHeader>

                <form action={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <Label>Nome Completo</Label>
                        <Input name="name" defaultValue={user?.name} required />
                    </div>

                    <div className="space-y-1">
                        <Label>Email</Label>
                        <Input name="email" type="email" defaultValue={user?.email || ""} placeholder="exemplo@empresa.com" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label>Usuário (Login)</Label>
                            <Input name="username" defaultValue={user?.username} required disabled={isEdit} />
                        </div>
                        <div className="space-y-1">
                            <Label>Senha {isEdit && "(Opcional)"}</Label>
                            <Input name="password" type="password" required={!isEdit} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label>Perfil de Acesso</Label>
                        <Select name="role" defaultValue={user?.role || "SUPERVISOR"}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ADMIN">Administrador</SelectItem>
                                <SelectItem value="COORD_RH">Coordenador RH</SelectItem>
                                <SelectItem value="ASSIST_RH">Assistente RH</SelectItem>
                                <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

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
                                    // Hack to make switch work with FormData without client side state for everything
                                    const input = document.querySelector('input[name="isActive"]') as HTMLInputElement;
                                    if (input) input.value = checked ? "true" : "false";
                                }}
                            />
                        </div>
                    )}

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700">
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEdit ? "Salvar Alterações" : "Criar Usuário")}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
