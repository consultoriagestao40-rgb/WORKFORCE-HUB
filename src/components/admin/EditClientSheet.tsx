"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Edit } from "lucide-react";
import { updateClient } from "@/app/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EditClientSheetProps {
    client: {
        id: string;
        name: string;
        address: string;
        companyId: string | null;
        monitorInOperations?: boolean;
        isActive?: boolean;
        accountManagerId?: string | null;
    };
    companies: { id: string; name: string }[];
    systemUsers?: { id: string; name: string }[];
}

export function EditClientSheet({ client, companies, systemUsers = [] }: EditClientSheetProps) {
    const [open, setOpen] = useState(false);

    async function handleSubmit(formData: FormData) {
        await updateClient(formData);
        setOpen(false);
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                    <Edit className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                </Button>
            </SheetTrigger>
            <SheetContent className="px-8">
                <SheetHeader>
                    <SheetTitle>Editar Cliente / Site</SheetTitle>
                    <SheetDescription>Atualize os dados de {client.name}.</SheetDescription>
                </SheetHeader>
                <form action={handleSubmit} className="space-y-4 mt-6">
                    <input type="hidden" name="id" value={client.id} />
                    <div className="space-y-2">
                        <Label>Empresa Mantenedora (Contratada)</Label>
                        <Select name="companyId" defaultValue={client.companyId || undefined} required>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a Empresa..." />
                            </SelectTrigger>
                            <SelectContent>
                                {companies.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome do Site/Condomínio (Cliente)</Label>
                        <Input id="name" name="name" defaultValue={client.name} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address">Endereço</Label>
                        <Input id="address" name="address" defaultValue={client.address} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="accountManagerId">Gerente de Conta</Label>
                        <Select name="accountManagerId" defaultValue={client.accountManagerId || "none"}>
                            <SelectTrigger id="accountManagerId">
                                <SelectValue placeholder="Selecione o Gerente..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Sem Gerente</SelectItem>
                                {systemUsers.map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2 pt-2 border-t mt-4">
                        <Label className="text-sm font-semibold">Status do Contrato</Label>
                        <Select name="isActive" defaultValue={client.isActive === false ? "false" : "true"}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="true">Ativo</SelectItem>
                                <SelectItem value="false">Encerrado</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">
                            Contratos encerrados não aparecem mais na Mesa de Operações e as vagas em aberto são canceladas.
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-2 py-2 pt-4">
                        <input 
                            type="checkbox" 
                            id="monitorInOperations" 
                            name="monitorInOperations" 
                            value="true" 
                            defaultChecked={client.monitorInOperations !== false}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" 
                        />
                        <Label htmlFor="monitorInOperations" className="cursor-pointer font-medium text-slate-700">
                            Monitorar na Mesa de Operações
                        </Label>
                    </div>
                    <Button type="submit" className="w-full">Salvar Alterações</Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
