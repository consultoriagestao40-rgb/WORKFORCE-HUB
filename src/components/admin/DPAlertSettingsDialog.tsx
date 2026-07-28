"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { updateAlertUserId } from "@/actions/globalAlerts";
import { toast } from "sonner";

interface DPAlertSettingsDialogProps {
    alertUserId: string | null;
    systemUsers: { id: string; name: string; email: string | null }[];
    isAdmin: boolean;
}

export function DPAlertSettingsDialog({ alertUserId, systemUsers, isAdmin }: DPAlertSettingsDialogProps) {
    const [open, setOpen] = useState(false);
    const [selectedManager, setSelectedManager] = useState<string>(alertUserId || "none");
    const [updating, setUpdating] = useState(false);

    const handleManagerChange = async (val: string) => {
        try {
            setUpdating(true);
            setSelectedManager(val);
            const res = await updateAlertUserId(val);
            if (res.success) {
                toast.success("Gestor responsável atualizado com sucesso!");
            }
        } catch (err) {
            console.error(err);
            toast.error("Falha ao atualizar gestor responsável.");
        } finally {
            setUpdating(false);
        }
    };

    if (!isAdmin) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline" 
                    title="Configurações de Alertas"
                    size="icon"
                    className="rounded-2xl h-9 w-9 border-slate-200 shrink-0"
                >
                    <Settings className="w-4 h-4 text-slate-600" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-2xl">
                <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
                    <DialogTitle className="flex items-center gap-2 text-lg font-black text-slate-800">
                        <Settings className="w-5 h-5 text-indigo-600" /> Configuração de Alertas de DP
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-555">
                        Configure quem é o gestor responsável por receber os popups automáticos de prazos e vencimentos críticos.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-4">
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700">
                            Gestor Responsável (Alertas Globais)
                        </Label>
                        <Select
                            value={selectedManager}
                            onValueChange={handleManagerChange}
                            disabled={updating}
                        >
                            <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs bg-white font-semibold">
                                <SelectValue placeholder="Selecione o gestor..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Todos (Nenhum gestor específico)</SelectItem>
                                {systemUsers.map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-[10px] text-slate-400 block font-medium mt-1">
                            Este usuário visualizará o modal de avisos críticos de DP ao abrir ou atualizar o sistema.
                        </span>
                    </div>
                </div>

                <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                    <Button 
                        onClick={() => setOpen(false)} 
                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs h-9 px-6 animate-in fade-in"
                    >
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
