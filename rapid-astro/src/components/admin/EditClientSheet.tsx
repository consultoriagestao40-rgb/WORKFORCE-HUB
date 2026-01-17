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
    };
    companies: { id: string; name: string }[];
}

export function EditClientSheet({ client, companies }: EditClientSheetProps) {
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
                    <Button type="submit" className="w-full">Salvar Alterações</Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
