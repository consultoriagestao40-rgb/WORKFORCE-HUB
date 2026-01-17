"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { confirmProbation, requestProbationDismissal } from "@/app/actions";
import { useRouter } from "next/navigation";

interface ProbationActionsProps {
    employeeId: string;
    employeeName: string;
}

export function ProbationActions({ employeeId, employeeName }: ProbationActionsProps) {
    const [isEffectiveDialogOpen, setIsEffectiveDialogOpen] = useState(false);
    const [effectiveNotes, setEffectiveNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter(); // Initialize router

    const handleConfirmProbation = async () => {
        setIsSubmitting(true);
        try {
            await confirmProbation(employeeId, effectiveNotes);
            toast.success("Colaborador efetivado com sucesso!");
            setIsEffectiveDialogOpen(false);
            setEffectiveNotes("");
            router.refresh(); // Refresh page data
        } catch (error) {
            toast.error("Erro ao efetivar colaborador.");
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRequestDismissal = async () => {
        if (!confirm(`Deseja abrir uma solicitação de desligamento para ${employeeName}?`)) return;

        setIsSubmitting(true);
        try {
            await requestProbationDismissal(employeeId);
            toast.success("Solicitação de desligamento criada com sucesso!");
            router.refresh(); // Refresh page data
        } catch (error) {
            toast.error("Erro ao solicitar desligamento.");
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex justify-end gap-2">
            <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs font-semibold"
                onClick={() => setIsEffectiveDialogOpen(true)}
                disabled={isSubmitting}
            >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Efetivar
            </Button>

            <Button
                size="sm"
                variant="destructive"
                className="h-8 text-xs font-semibold"
                onClick={handleRequestDismissal}
                disabled={isSubmitting}
            >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                Desligar
            </Button>

            <Link href={`/admin/employees/${employeeId}`}>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400">
                    <ArrowUpRight className="w-4 h-4" />
                </Button>
            </Link>

            <Dialog open={isEffectiveDialogOpen} onOpenChange={setIsEffectiveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Efetivar Colaborador</DialogTitle>
                        <DialogDescription>
                            Confirme a efetivação de <strong>{employeeName}</strong>. Você pode adicionar observações abaixo que ficarão registradas na auditoria.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Textarea
                            placeholder="Adicione observações sobre desempenho, feedback do gestor, etc..."
                            value={effectiveNotes}
                            onChange={(e) => setEffectiveNotes(e.target.value)}
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEffectiveDialogOpen(false)} disabled={isSubmitting}>Cancelar</Button>
                        <Button onClick={handleConfirmProbation} disabled={isSubmitting}>Confirmar Efetivação</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
