"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Plus } from "lucide-react";
import { createAllowanceType } from "@/app/actions";

export function NewAllowanceTypeSheet() {
    const [open, setOpen] = useState(false);
    const [isPercentage, setIsPercentage] = useState(false);

    async function handleSubmit(formData: FormData) {
        await createAllowanceType(formData);
        setOpen(false);
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> Novo Tipo de Adicional</Button>
            </SheetTrigger>
            <SheetContent className="px-8">
                <SheetHeader>
                    <SheetTitle>Novo Tipo de Adicional</SheetTitle>
                    <SheetDescription>Cadastre um novo tipo de adicional de folha de pagamento.</SheetDescription>
                </SheetHeader>
                <form action={handleSubmit} className="space-y-4 mt-6">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome do Adicional</Label>
                        <Input id="name" name="name" placeholder="Ex: Assiduidade, Sobreaviso" required />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="isPercentage">Tipo de Valor</Label>
                        <Select name="isPercentage" value={isPercentage ? "true" : "false"} onValueChange={(v) => setIsPercentage(v === "true")}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="false">Valor Fixo (R$)</SelectItem>
                                <SelectItem value="true">Percentual (%)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">
                            {isPercentage ? "Será calculado como % do salário base" : "Será somado como valor fixo em reais"}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descrição (Opcional)</Label>
                        <Textarea id="description" name="description" placeholder="Descrição breve..." rows={3} />
                    </div>

                    <Button type="submit" className="w-full">Salvar Tipo de Adicional</Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
