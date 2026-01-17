"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createOccurrence } from "@/app/mobile/actions-occurrences";
import { useRouter } from "next/navigation";

interface Employee {
    id: string;
    name: string;
}

interface NewOccurrenceFormProps {
    postoId: string;
    employees: Employee[];
}

export function NewOccurrenceForm({ postoId, employees }: NewOccurrenceFormProps) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        try {
            const result = await createOccurrence(formData);
            if (result?.error) {
                toast.error(result.error);
                return;
            }
            toast.success("Ocorrência registrada!");
            router.push(`/mobile/site/${postoId}`);
        } catch (error) {
            toast.error("Erro inesperado.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <form action={handleSubmit} className="space-y-6 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <input type="hidden" name="postoId" value={postoId} />

            <div className="space-y-2">
                <Label htmlFor="title">Título do Fato</Label>
                <Input id="title" name="title" placeholder="Ex: Atraso, Falta de Uniforme..." required />
            </div>

            <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select name="type" required>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Disciplinar">Disciplinar</SelectItem>
                        <SelectItem value="Operacional">Operacional</SelectItem>
                        <SelectItem value="Posturas">Posturas</SelectItem>
                        <SelectItem value="Uniforme">Uniforme</SelectItem>
                        <SelectItem value="Elogio">Elogio</SelectItem>
                        <SelectItem value="Outros">Outros</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="employeeId">Colaborador Envolvido (Opcional)</Label>
                <Select name="employeeId">
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione se houver" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Nenhum / Geral</SelectItem>
                        {employees.map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="date">Data do Ocorrido</Label>
                <Input
                    type="datetime-local"
                    id="date"
                    name="date"
                    defaultValue={new Date().toISOString().slice(0, 16)}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Descrição Detalhada</Label>
                <Textarea
                    id="description"
                    name="description"
                    placeholder="Descreva o que aconteceu..."
                    className="min-h-[100px]"
                    required
                />
            </div>

            <Button type="submit" className="w-full bg-slate-900" disabled={loading}>
                {loading ? "Salvando..." : "Registrar Ocorrência"}
            </Button>
        </form>
    );
}
