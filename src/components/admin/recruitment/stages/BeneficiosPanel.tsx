"use client";

import { useState } from "react";
import { CreditCard, CheckCircle2, Loader2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { saveBenefits } from "@/src/actions/recruitment";

interface BeneficiosPanelProps {
    candidateId: string;
    cajuRegistered?: boolean;
    metocarRegistered?: boolean;
    urbisRegistered?: boolean;
    benefitsCompletedAt?: Date | string | null;
    onUpdate: () => void;
}

export function BeneficiosPanel({
    candidateId,
    cajuRegistered = false,
    metocarRegistered = false,
    urbisRegistered = false,
    benefitsCompletedAt,
    onUpdate,
}: BeneficiosPanelProps) {
    const [caju, setCaju] = useState(cajuRegistered);
    const [metocar, setMetocar] = useState(metocarRegistered);
    const [urbis, setUrbis] = useState(urbisRegistered);
    const [saving, setSaving] = useState(false);

    const isComplete = benefitsCompletedAt !== null && benefitsCompletedAt !== undefined;

    async function handleSave() {
        setSaving(true);
        try {
            await saveBenefits(candidateId, { caju, metocar, urbis });
            toast.success("Benefícios cadastrados! Processo concluído.");
            onUpdate();
        } catch (e: any) {
            toast.error(e.message || "Erro ao salvar benefícios");
        } finally {
            setSaving(false);
        }
    }

    const completedDate = benefitsCompletedAt
        ? new Date(benefitsCompletedAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
          })
        : null;

    return (
        <div className="space-y-4">
            {/* Status */}
            {isComplete ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-green-50 border-green-200 text-green-800 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Benefícios Cadastrados em {completedDate}
                </div>
            ) : (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-blue-50 border-blue-200 text-blue-800 text-sm font-medium">
                    <Gift className="w-4 h-4" />
                    Cadastrar benefícios do colaborador
                </div>
            )}

            {/* Benefits Checklist */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-4">
                <p className="text-sm font-semibold text-slate-800 mb-1">Plataformas de Benefícios</p>

                {/* CAJU */}
                <div className={`flex items-start gap-3 p-3 rounded-lg border ${caju ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"}`}>
                    <Checkbox
                        id="caju"
                        checked={caju}
                        onCheckedChange={(v) => setCaju(!!v)}
                        disabled={isComplete}
                        className="mt-0.5"
                    />
                    <div className="flex-1">
                        <Label htmlFor="caju" className="text-sm font-medium cursor-pointer">CAJU</Label>
                        <p className="text-xs text-slate-500">Vale refeição / alimentação / mobilidade</p>
                    </div>
                    {caju && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />}
                </div>

                {/* Metocar */}
                <div className={`flex items-start gap-3 p-3 rounded-lg border ${metocar ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"}`}>
                    <Checkbox
                        id="metocar"
                        checked={metocar}
                        onCheckedChange={(v) => setMetocar(!!v)}
                        disabled={isComplete}
                        className="mt-0.5"
                    />
                    <div className="flex-1">
                        <Label htmlFor="metocar" className="text-sm font-medium cursor-pointer">Metocar</Label>
                        <p className="text-xs text-slate-500">Vale transporte</p>
                    </div>
                    {metocar && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />}
                </div>

                {/* Urbis */}
                <div className={`flex items-start gap-3 p-3 rounded-lg border ${urbis ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"}`}>
                    <Checkbox
                        id="urbis"
                        checked={urbis}
                        onCheckedChange={(v) => setUrbis(!!v)}
                        disabled={isComplete}
                        className="mt-0.5"
                    />
                    <div className="flex-1">
                        <Label htmlFor="urbis" className="text-sm font-medium cursor-pointer">Urbis <span className="text-slate-400 font-normal">(opcional)</span></Label>
                        <p className="text-xs text-slate-500">Outros benefícios urbanos</p>
                    </div>
                    {urbis && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />}
                </div>
            </div>

            {/* Save Button */}
            {!isComplete && (
                <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Confirmar Cadastro e Concluir Processo
                </Button>
            )}
        </div>
    );
}
