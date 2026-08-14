"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Lock, Sparkles, AlertCircle } from "lucide-react";
import { closeHrTicketWithReason } from "@/actions/hr-attendance";
import { toast } from "sonner";

interface Props {
    ticket: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onClosed: () => void;
}

const CLOSE_REASONS = [
    "Dúvida ou Solicitação Sanada",
    "Atestado Médico Lançado na Folha",
    "Documentação de Admissão Entregue",
    "Alteração de Vale Transporte Realizada",
    "Informações de Férias Enviadas",
    "Candidatura Registrada no Recrutamento",
    "Sem Retorno do Funcionário",
    "Outro Motivo Administrativo"
];

export function HrCloseTicketModal({ ticket, open, onOpenChange, onClosed }: Props) {
    const [reason, setReason] = useState(CLOSE_REASONS[0]);
    const [resolutionNote, setResolutionNote] = useState("");
    const [closing, setClosing] = useState(false);

    if (!ticket) return null;

    const handleConfirmClose = async () => {
        setClosing(true);
        try {
            await closeHrTicketWithReason(ticket.id, {
                reason,
                resolutionNote: resolutionNote.trim() || undefined
            });
            toast.success("Atendimento encerrado com sucesso!");
            onOpenChange(false);
            onClosed();
        } catch (e: any) {
            toast.error(e.message || "Erro ao encerrar atendimento");
        } finally {
            setClosing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md p-6 bg-white rounded-2xl">
                <DialogHeader className="text-left space-y-1">
                    <DialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-rose-500" />
                        Encerrar Atendimento
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Finalize o atendimento com <strong>{ticket.contactName}</strong> e registre o motivo da resolução para métricas do CRM.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2 text-xs">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Motivo do Encerramento
                        </label>
                        <select
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none"
                        >
                            {CLOSE_REASONS.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Nota de Resolução (Opcional)
                        </label>
                        <Textarea
                            value={resolutionNote}
                            onChange={e => setResolutionNote(e.target.value)}
                            placeholder="Descreva brevemente como a solicitação foi resolvida..."
                            rows={3}
                            className="text-xs rounded-xl border-slate-200"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="h-9 text-xs font-bold rounded-xl"
                        disabled={closing}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleConfirmClose}
                        disabled={closing}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-9 text-xs rounded-xl"
                    >
                        {closing ? "Encerrando..." : "Confirmar Encerramento"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
