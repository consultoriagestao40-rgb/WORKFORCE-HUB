"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface ApprovalModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    action: "APPROVE" | "REJECT" | null;
    candidateName: string;
    onConfirm: (justification: string) => Promise<void>;
}

export function ApprovalModal({ open, onOpenChange, action, candidateName, onConfirm }: ApprovalModalProps) {
    const [justification, setJustification] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        if (!justification.trim()) return;

        setIsSubmitting(true);
        try {
            await onConfirm(justification);
            setJustification("");
            onOpenChange(false);
        } catch (error) {
            // Error handling usually done in parent
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className={action === 'REJECT' ? "text-red-600" : "text-emerald-600"}>
                        {action === 'REJECT' ? 'Reprovar Candidato' : 'Aprovar Candidato'}
                    </DialogTitle>
                    <DialogDescription>
                        {action === 'REJECT'
                            ? `Você está prestes a reprovar ${candidateName} e retornar o card para a etapa anterior.`
                            : `Você está prestes a aprovar ${candidateName} para a próxima etapa.`}
                        <br />
                        <span className="font-semibold text-slate-700">A justificativa é obrigatória para o histórico.</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <Textarea
                        placeholder="Escreva a justificativa aqui..."
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                        className="min-h-[100px]"
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button
                        variant={action === 'REJECT' ? "destructive" : "default"}
                        className={action === 'APPROVE' ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                        onClick={handleConfirm}
                        disabled={!justification.trim() || isSubmitting}
                    >
                        {isSubmitting ? "Processando..." : (action === 'REJECT' ? "Confirmar Reprovação" : "Confirmar Aprovação")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
