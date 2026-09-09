"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Archive, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { closePosto, reopenPosto } from "@/app/actions";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClosePostoDialogProps {
    postoId: string;
    postoRole: string;
    isClosed?: boolean;
}

export function ClosePostoDialog({ postoId, postoRole, isClosed = false }: ClosePostoDialogProps) {
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("Redução de Contrato");

    const handleAction = () => {
        startTransition(async () => {
            try {
                if (isClosed) {
                    await reopenPosto(postoId);
                    toast.success(`Posto "${postoRole}" reativado com sucesso.`);
                } else {
                    await closePosto(postoId, reason);
                    toast.success(`Posto "${postoRole}" encerrado com sucesso.`);
                }
                setOpen(false);
            } catch (error: any) {
                console.error(error);
                toast.error(error.message || "Erro ao atualizar status do posto.");
            }
        });
    };

    if (isClosed) {
        return (
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogTrigger asChild>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 px-2.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 rounded-lg gap-1.5 transition-all ml-1"
                        title="Reativar Posto"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reativar</span>
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-slate-900">
                            <RotateCcw className="w-5 h-5 text-emerald-600" />
                            Reativar Posto?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-600 text-sm">
                            O posto <strong>{postoRole}</strong> voltará a ficar ativo no contrato, habilitando alocações e constando na receita contratual.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleAction();
                            }}
                            disabled={isPending}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        >
                            {isPending ? "Reativando..." : "Confirmar Reativação"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        );
    }

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 rounded-full hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-all ml-1"
                    title="Encerrar Posto por Redução"
                >
                    <Archive className="w-4 h-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-slate-900">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Encerrar Posto por Redução?
                    </AlertDialogTitle>
                    <div className="text-slate-600 text-sm space-y-2">
                        <p>
                            Esta ação encerrará o posto <strong>{postoRole}</strong> devido à redução contratual.
                        </p>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1 my-2">
                            <p className="font-semibold text-slate-800">Garantias do Encerramento:</p>
                            <p>✅ <strong>100% do histórico preservado:</strong> batidas de ponto, presenças e turnover passados continuam íntegros.</p>
                            <p>🔒 <strong>Sem vagas:</strong> fecha vagas em aberto no R&S e não abre novas vagas.</p>
                            <p>🚫 <strong>Sem novas alocações:</strong> bloqueia alocação de novos colaboradores.</p>
                            <p>📉 <strong>Ajuste de faturamento:</strong> deduz automaticamente o valor do faturamento do contrato.</p>
                        </div>
                    </div>
                </AlertDialogHeader>
                <div className="py-2">
                    <Label htmlFor="closureReason" className="text-xs font-semibold text-slate-700">
                        Motivo do Encerramento
                    </Label>
                    <Input
                        id="closureReason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ex: Redução de Contrato"
                        className="mt-1 h-9 text-xs"
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleAction();
                        }}
                        disabled={isPending}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                    >
                        {isPending ? "Encerrando..." : "Confirmar Encerramento"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
