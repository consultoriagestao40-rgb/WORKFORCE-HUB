
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Plus, Pencil } from "lucide-react";
import { createSituation, updateSituation } from "@/app/actions";

interface SituationSheetProps {
    situation?: {
        id: string;
        name: string;
        color: string;
    };
}

export function NewSituationSheet({ situation }: SituationSheetProps) {
    const [open, setOpen] = useState(false);

    async function handleSubmit(formData: FormData) {
        if (situation) {
            await updateSituation(formData);
        } else {
            await createSituation(formData);
        }
        setOpen(false);
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                {situation ? (
                    <Button variant="ghost" size="sm" className="h-10 w-10 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors">
                        <Pencil className="w-4 h-4" />
                    </Button>
                ) : (
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" /> Nova Situação
                    </Button>
                )}
            </SheetTrigger>
            <SheetContent className="px-8">
                <SheetHeader>
                    <SheetTitle>{situation ? 'Editar Situação' : 'Nova Situação'}</SheetTitle>
                    <SheetDescription>
                        {situation ? 'Altere os dados da situação existente.' : 'Defina um novo status para os colaboradores.'}
                    </SheetDescription>
                </SheetHeader>
                <form action={handleSubmit} className="space-y-4 mt-6">
                    {situation && <input type="hidden" name="id" value={situation.id} />}
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome da Situação</Label>
                        <Input
                            id="name"
                            name="name"
                            placeholder="Ex: Licença Maternidade"
                            required
                            defaultValue={situation?.name}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="color">Cor de Identificação</Label>
                        <Input
                            id="color"
                            name="color"
                            type="color"
                            defaultValue={situation?.color || "#94a3b8"}
                            className="h-10 p-1"
                        />
                        <p className="text-[10px] text-slate-500 italic">Esta cor será usada nos crachás e dashboards.</p>
                    </div>
                    <Button type="submit" className="w-full">
                        {situation ? 'Salvar Alterações' : 'Cadastrar'}
                    </Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
