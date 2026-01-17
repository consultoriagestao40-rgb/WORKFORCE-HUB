"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Plus } from "lucide-react";
import { createSchedule } from "@/app/actions";

export function NewScheduleSheet() {
    const [open, setOpen] = useState(false);

    async function handleSubmit(formData: FormData) {
        await createSchedule(formData);
        setOpen(false);
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> Nova Escala</Button>
            </SheetTrigger>
            <SheetContent className="px-8">
                <SheetHeader>
                    <SheetTitle>Nova Escala</SheetTitle>
                    <SheetDescription>Cadastre um novo tipo de escala.</SheetDescription>
                </SheetHeader>
                <form action={handleSubmit} className="space-y-4 mt-6">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome (Ex: 12x36)</Label>
                        <Input id="name" name="name" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Input id="description" name="description" placeholder="Mais detalhes (Opcional)" />
                    </div>
                    <Button type="submit" className="w-full">Salvar</Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
