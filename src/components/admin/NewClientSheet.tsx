"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Plus } from "lucide-react";
import { createClient } from "@/app/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface NewClientSheetProps {
    companies: { id: string; name: string }[];
}

export function NewClientSheet({ companies }: NewClientSheetProps) {
    const [open, setOpen] = useState(false);

    async function handleSubmit(formData: FormData) {
        await createClient(formData);
        setOpen(false);
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> Novo Cliente</Button>
            </SheetTrigger>
            <SheetContent className="px-8">
                <SheetHeader>
                    <SheetTitle>Novo Cliente</SheetTitle>
                    <SheetDescription>Cadastre um novo contrato/site.</SheetDescription>
                </SheetHeader>
                <form action={handleSubmit} className="space-y-4 mt-6">
                    <div className="space-y-2">
                        <Label>Empresa Mantenedora (Contratada)</Label>
                        <Select name="companyId" required>
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
                        <Input id="name" name="name" placeholder="Ex: Condomínio Jardins" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address">Endereço</Label>
                        <Input id="address" name="address" placeholder="Rua..." required />
                    </div>
                    <div className="flex items-center gap-2 py-2">
                        <input 
                            type="checkbox" 
                            id="monitorInOperations" 
                            name="monitorInOperations" 
                            value="true" 
                            defaultChecked={true}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" 
                        />
                        <Label htmlFor="monitorInOperations" className="cursor-pointer font-medium text-slate-700">
                            Monitorar na Mesa de Operações
                        </Label>
                    </div>
                    <Button type="submit" className="w-full">Salvar</Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
