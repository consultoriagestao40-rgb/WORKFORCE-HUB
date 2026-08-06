"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ExternalLink, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { confirmOnvio } from "@/actions/recruitment";

interface OnvioPanelProps {
    candidateId: string;
    candidateName: string;
    onvioLaunched?: boolean;
    onvioConfirmedAt?: Date | string | null;
    onUpdate: () => void;
}

export function OnvioPanel({
    candidateId,
    candidateName,
    onvioLaunched,
    onvioConfirmedAt,
    onUpdate,
}: OnvioPanelProps) {
    const [confirming, setConfirming] = useState(false);

    async function handleConfirm() {
        setConfirming(true);
        try {
            await confirmOnvio(candidateId);
            toast.success("Onvio confirmado! Candidato avançado para Admitido.");
            onUpdate();
        } catch (e: any) {
            toast.error(e.message || "Erro ao confirmar Onvio");
        } finally {
            setConfirming(false);
        }
    }

    const confirmedDate = onvioConfirmedAt
        ? new Date(onvioConfirmedAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
          })
        : null;

    return (
        <div className="space-y-4">
            {/* Status */}
            {onvioLaunched ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-green-50 border-green-200 text-green-800 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Lançado no Onvio
                    {confirmedDate && (
                        <span className="ml-auto text-xs font-normal opacity-70 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {confirmedDate}
                        </span>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-yellow-50 border-yellow-200 text-yellow-800 text-sm font-medium">
                    <Loader2 className="w-4 h-4" />
                    Aguardando lançamento no Onvio
                </div>
            )}

            {/* Instructions */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <p className="text-sm font-semibold text-slate-800 mb-2">Checklist Onvio</p>
                <ul className="text-xs text-slate-600 space-y-1.5 list-none">
                    {[
                        "Acessar o sistema Onvio",
                        `Cadastrar o colaborador: ${candidateName}`,
                        "Preencher dados pessoais e contratuais",
                        "Confirmar o lançamento",
                    ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                            <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${onvioLaunched ? "bg-green-500 text-white" : "bg-slate-300 text-slate-600"}`}>
                                {onvioLaunched ? "✓" : i + 1}
                            </div>
                            {item}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Confirm Button */}
            {!onvioLaunched && (
                <Button
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={handleConfirm}
                    disabled={confirming}
                >
                    {confirming ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Confirmar Lançamento no Onvio e Avançar
                </Button>
            )}
        </div>
    );
}
