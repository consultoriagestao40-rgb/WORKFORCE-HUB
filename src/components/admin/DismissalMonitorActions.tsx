"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, Ban, ArrowRight, UserX } from "lucide-react";
import { finalizeDismissal, cancelDismissalProcess, moveEmployeeToRotativo } from "@/app/actions";

interface DismissalMonitorActionsProps {
    employeeId: string;
    employeeName: string;
    situationName: string;
}

export function DismissalMonitorActions({ employeeId, employeeName, situationName }: DismissalMonitorActionsProps) {
    const [loading, setLoading] = useState(false);
    const [isDismissDialogOpen, setIsDismissDialogOpen] = useState(false);
    const [notes, setNotes] = useState("");
    const router = useRouter();

    const handleCancel = async () => {
        if (!confirm(`Deseja cancelar o processo de desligamento de ${employeeName}? O colaborador voltará para a situação "Ativo".`)) return;
        setLoading(true);
        try {
            const res = await cancelDismissalProcess(employeeId);
            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success("Processo cancelado com sucesso!");
                router.refresh();
            }
        } catch (e: any) {
            toast.error(e.message || "Erro de conexão.");
        } finally {
            setLoading(false);
        }
    };

    const handleMoveToRotativo = async () => {
        if (!confirm(`Deseja mover ${employeeName} para o Rotativo?`)) return;
        setLoading(true);
        try {
            const res = await moveEmployeeToRotativo(employeeId);
            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success("Colaborador alocado no Rotativo!");
                router.refresh();
            }
        } catch (e: any) {
            toast.error(e.message || "Erro de conexão.");
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = async () => {
        setLoading(true);
        try {
            const res = await finalizeDismissal(employeeId, notes);
            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success("Desligamento finalizado com sucesso!");
                setIsDismissDialogOpen(false);
                router.refresh();
            }
        } catch (e: any) {
            toast.error(e.message || "Erro de conexão.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-1 flex flex-col gap-1 bg-white border border-slate-200 shadow-lg rounded-lg">
                    <Button
                        variant="ghost"
                        onClick={() => setIsDismissDialogOpen(true)}
                        className="w-full justify-start text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-bold h-9 px-3"
                    >
                        <UserX className="mr-2 h-4 w-4" />
                        Desligar Definitivamente
                    </Button>
                    
                    <Button
                        variant="ghost"
                        onClick={handleMoveToRotativo}
                        className="w-full justify-start text-xs font-semibold h-9 px-3 hover:bg-slate-55"
                    >
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Alocar no Rotativo
                    </Button>
                    
                    <div className="h-px bg-slate-100 my-1" />
                    
                    <Button
                        variant="ghost"
                        onClick={handleCancel}
                        className="w-full justify-start text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 font-semibold h-9 px-3"
                    >
                        <Ban className="mr-2 h-4 w-4" />
                        Cancelar Processo
                    </Button>
                </PopoverContent>
            </Popover>

            <Dialog open={isDismissDialogOpen} onOpenChange={setIsDismissDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Finalizar Desligamento</DialogTitle>
                        <DialogDescription>
                            Deseja confirmar a rescisão contratual definitiva do colaborador <strong>{employeeName}</strong>? Esta ação é irreversível e marcará o colaborador como Inativo.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="dismissalNotes">Anotações da Rescisão / Observações</Label>
                            <Textarea
                                id="dismissalNotes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Insira detalhes adicionais sobre o desligamento (ex: data homologação, observações do acerto, etc)..."
                                className="min-h-[100px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsDismissDialogOpen(false)}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={handleDismiss}
                            disabled={loading}
                        >
                            {loading ? "Processando..." : "Confirmar Desligamento"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
