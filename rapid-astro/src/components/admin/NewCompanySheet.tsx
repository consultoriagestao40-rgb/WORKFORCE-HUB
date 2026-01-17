"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Plus } from "lucide-react";
import { createCompany } from "@/app/actions";

export function NewCompanySheet() {
    const [open, setOpen] = useState(false);

    async function handleSubmit(formData: FormData) {
        await createCompany(formData);
        setOpen(false);
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> Nova Empresa</Button>
            </SheetTrigger>
            <SheetContent className="px-8">
                <SheetHeader>
                    <SheetTitle>Nova Empresa</SheetTitle>
                    <SheetDescription>Cadastre uma nova entidade jurídica (CNPJ) para deter contratos.</SheetDescription>
                </SheetHeader>
                <form action={handleSubmit} className="space-y-4 mt-6">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome / Razão Social</Label>
                        <Input id="name" name="name" placeholder="Ex: Terceirização XYZ LTDA" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cnpj">CNPJ</Label>
                        <Input id="cnpj" name="cnpj" placeholder="00.000.000/0001-00" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address">Endereço Sede</Label>
                        <Input id="address" name="address" placeholder="Rua..." />
                    </div>
                    <Button type="submit" className="w-full">Salvar Empresa</Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
