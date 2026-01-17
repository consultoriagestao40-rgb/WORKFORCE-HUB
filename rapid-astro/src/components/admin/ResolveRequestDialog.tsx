"use client";

import { useState } from "react";
import { resolveRequest } from "@/app/admin/requests/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2 } from "lucide-react";

interface ResolveDialogProps {
    requestId: string;
}

export function ResolveRequestDialog({ requestId }: ResolveDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        try {
            await resolveRequest(formData);
            setOpen(false);
        } catch (error) {
            console.error(error);
            alert("Erro ao concluir solicitação");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Concluir
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Concluir Solicitação</DialogTitle>
                    <DialogDescription>
                        Descreva a solução ou adicione observações finais.
                    </DialogDescription>
                </DialogHeader>
                <form action={handleSubmit} className="space-y-4">
                    <input type="hidden" name="id" value={requestId} />
                    <div className="space-y-2">
                        <Label>Anotações de Resolução</Label>
                        <Textarea
                            name="notes"
                            placeholder="Ex: Férias agendadas conforme solicitado..."
                            required
                            className="min-h-[100px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Confirmar Conclusão
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
