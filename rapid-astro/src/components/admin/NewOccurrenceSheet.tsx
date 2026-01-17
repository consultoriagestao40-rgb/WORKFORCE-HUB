"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { createOccurrence } from "@/app/mobile/actions-occurrences"; // Reusing the same action!
import { useRouter } from "next/navigation";

interface NewOccurrenceSheetProps {
    postos: { id: string; client: { name: string } }[];
    employees: { id: string; name: string }[];
}

export function NewOccurrenceSheet({ postos, employees }: NewOccurrenceSheetProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        try {
            const result = await createOccurrence(formData);
            if (result?.error) {
                toast.error(result.error);
            } else {
                toast.success("Ocorrência registrada com sucesso!");
                setOpen(false);
                router.refresh();
            }
        } catch (error) {
            toast.error("Erro ao salvar ocorrência.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
                    <PlusCircle className="w-4 h-4" />
                    Nova Ocorrência
                </Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto w-full sm:max-w-md px-8">
                <SheetHeader>
                    <SheetTitle>Registrar Ocorrência</SheetTitle>
                    <SheetDescription>
                        Preencha os detalhes da ocorrência.
                    </SheetDescription>
                </SheetHeader>

                <form action={handleSubmit} className="space-y-4 mt-6">
                    <div className="space-y-2">
                        <Label htmlFor="postoId">Posto / Cliente</Label>
                        <Select name="postoId" required>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o posto" />
                            </SelectTrigger>
                            <SelectContent>
                                {postos.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.client.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="title">Título do Fato</Label>
                        <Input id="title" name="title" placeholder="Ex: Falta, Atraso, Quebra..." required />
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
                        <Label htmlFor="employeeId">Colaborador (Opcional)</Label>
                        <Select name="employeeId">
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione se houver" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Nenhum / Geral</SelectItem>
                                {employees.map((e) => (
                                    <SelectItem key={e.id} value={e.id}>
                                        {e.name}
                                    </SelectItem>
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
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                            id="description"
                            name="description"
                            placeholder="Detalhe o ocorrido..."
                            className="min-h-[100px]"
                            required
                        />
                    </div>

                    <SheetFooter className="pt-4">
                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                            {loading ? "Salvando..." : "Salvar Ocorrência"}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}
