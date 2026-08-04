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
    type: 'dismissal' | 'probation';
}

export function DPAlertSettingsDialog({ alertUserId, systemUsers, isAdmin, type }: DPAlertSettingsDialogProps) {
    const [open, setOpen] = useState(false);
    const [selectedManager, setSelectedManager] = useState<string>(alertUserId || "none");
    const [updating, setUpdating] = useState(false);

    const handleManagerChange = async (val: string) => {
        try {
            setUpdating(true);
            setSelectedManager(val);
            const res = await updateAlertUserId(val, type);
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

    const isDismissal = type === 'dismissal';

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
                        <Settings className="w-5 h-5 text-indigo-650" /> 
                        {isDismissal ? "Configuração de Prazos de DP" : "Configuração de Contratos de Experiência"}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        {isDismissal 
                            ? "Configure quem é o gestor da área responsável por receber os alertas de rescisões e telegramas de DP."
                            : "Configure quem é o gestor da área responsável por monitorar o término de contratos de experiência."
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-4">
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700">
                            Gestor Responsável
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
                            {isDismissal
                                ? "Este usuário receberá avisos automáticos sobre prazos de pagamentos de rescisão e telegramas."
                                : "Este usuário receberá avisos automáticos sobre vencimentos de períodos de experiência (45/90 dias)."
                            }
                        </span>
                    </div>
                </div>

                <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                    <Button 
                        onClick={() => setOpen(false)} 
                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs h-9 px-6"
                    >
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
