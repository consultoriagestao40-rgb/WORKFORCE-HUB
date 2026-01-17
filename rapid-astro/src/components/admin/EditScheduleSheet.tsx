"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Pencil } from "lucide-react";
import { updateSchedule } from "@/app/actions";
import { toast } from "sonner";

interface EditScheduleSheetProps {
    schedule: {
        id: string;
        name: string;
        description: string | null;
    };
}

export function EditScheduleSheet({ schedule }: EditScheduleSheetProps) {
    const [open, setOpen] = useState(false);

    async function handleSubmit(formData: FormData) {
        try {
            await updateSchedule(formData);
            setOpen(false);
            toast.success("Escala atualizada com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao atualizar escala.");
        }
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                    <Pencil className="w-4 h-4" />
                </Button>
            </SheetTrigger>
            <SheetContent className="px-8">
                <SheetHeader>
                    <SheetTitle>Editar Escala</SheetTitle>
                    <SheetDescription>Altere os detalhes da escala.</SheetDescription>
                </SheetHeader>
                <form action={handleSubmit} className="space-y-4 mt-6">
                    <input type="hidden" name="id" value={schedule.id} />
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome (Ex: 12x36)</Label>
                        <Input id="name" name="name" defaultValue={schedule.name} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Input id="description" name="description" defaultValue={schedule.description || ""} placeholder="Mais detalhes (Opcional)" />
                    </div>
                    <Button type="submit" className="w-full">Salvar Alterações</Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
