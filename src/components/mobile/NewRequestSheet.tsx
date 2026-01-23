"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Plus, Loader2 } from "lucide-react";
import { createRequest } from "@/app/mobile/actions-requests";

interface EmployeeOption {
    id: string;
    name: string;
    roleName: string;
}

export function NewRequestSheet({ employees }: { employees: EmployeeOption[] }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        try {
            await createRequest(formData);
            setOpen(false);
        } catch (error) {
            console.error(error);
            alert("Erro ao criar solicitação");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-full h-12 w-12 shadow-lg fixed bottom-20 right-4 z-50">
                    <Plus className="w-6 h-6" />
                </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[90vh] rounded-t-[2rem] px-6">
                <SheetHeader className="mb-6">
                    <SheetTitle>Nova Solicitação</SheetTitle>
                    <SheetDescription>Abra um chamado para o RH / Admin.</SheetDescription>
                </SheetHeader>
                <form action={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <Label>Tipo de Solicitação</Label>
                        <Select name="type" required>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="FERIAS">Programação de Férias</SelectItem>
                                <SelectItem value="UNIFORME">Uniforme / EPI</SelectItem>
                                <SelectItem value="HORARIO">Mudança de Horário</SelectItem>
                                <SelectItem value="MOVIMENTACAO">Solicitação de Movimentação de posto de trabalho</SelectItem>
                                <SelectItem value="MUDANCA_ESCALA">Mudança de Escala de Trabalho</SelectItem>
                                <SelectItem value="ALTERACAO_FUNCIONAL">Alteração funcional</SelectItem>
                                <SelectItem value="TERMINO_CONTRATO_EXPERIENCIA">Término de contrato de experiencia</SelectItem>
                                <SelectItem value="TERMINO_CONTRATO_ANTECIPADO">Término de contrato de experiencia antecipado</SelectItem>
                                <SelectItem value="DEMISSAO_COLABORADOR">Demissão por iniciativa do colaborador</SelectItem>
                                <SelectItem value="DEMISSAO_EMPRESA">Demissão por iniciativa da empresa</SelectItem>
                                <SelectItem value="OUTROS">Outros Assuntos</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Data Desejada / Vencimento</Label>
                        <Input type="date" name="dueDate" required className="block w-full" />
                    </div>

                    <div className="space-y-2">
                        <Label>Colaborador (Opcional)</Label>
                        <Select name="employeeId">
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione se vinculado a alguém" />
                            </SelectTrigger>
                            <SelectContent>
                                {employees.map(emp => (
                                    <SelectItem key={emp.id} value={emp.id}>
                                        {emp.name} ({emp.roleName})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Detalhes / Obs</Label>
                        <Input name="description" placeholder="Descreva brevemente..." required />
                    </div>

                    <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={loading}>
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enviar Solicitação"}
                    </Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
