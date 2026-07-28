"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
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
import { Bell, CreditCard, Send, ShieldAlert, AlertTriangle, Calendar, CheckCircle2, Info, Settings } from "lucide-react";
import { updateAlertUserId } from "@/actions/globalAlerts";
import { toast } from "sonner";

export interface DismissalAlert {
    id: string;
    employeeId: string;
    employeeName: string;
    type: 'CRITICAL' | 'WARNING';
    category: 'PAGAMENTO' | 'TELEGRAMA' | 'EXPERIENCIA' | 'ABANDONO';
    message: string;
}

interface DismissalAlertsDialogProps {
    alerts: DismissalAlert[];
    alertUserId: string | null;
    systemUsers: { id: string; name: string; email: string | null }[];
    isAdmin: boolean;
}

export function DismissalAlertsDialog({ alerts, alertUserId, systemUsers, isAdmin }: DismissalAlertsDialogProps) {
    const [open, setOpen] = useState(false);
    const [selectedManager, setSelectedManager] = useState<string>(alertUserId || "none");
    const [updating, setUpdating] = useState(false);

    const criticalCount = alerts.filter(a => a.type === 'CRITICAL').length;
    const warningCount = alerts.filter(a => a.type === 'WARNING').length;

    // Automatically open the dialog if there are critical alerts
    useEffect(() => {
        if (criticalCount > 0) {
            setOpen(true);
        }
    }, [criticalCount]);

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

    const getIcon = (category: string) => {
        switch (category) {
            case 'PAGAMENTO':
                return <CreditCard className="w-4 h-4 text-emerald-500" />;
            case 'TELEGRAMA':
                return <Send className="w-4 h-4 text-sky-500" />;
            case 'EXPERIENCIA':
                return <Calendar className="w-4 h-4 text-purple-500" />;
            case 'ABANDONO':
                return <ShieldAlert className="w-4 h-4 text-rose-500" />;
            default:
                return <Info className="w-4 h-4 text-slate-500" />;
        }
    };

    const getCategoryLabel = (category: string) => {
        switch (category) {
            case 'PAGAMENTO': return 'Prazo de Pagamento';
            case 'TELEGRAMA': return 'Envio de Telegrama';
            case 'EXPERIENCIA': return 'Término de Experiência';
            case 'ABANDONO': return 'Abandono de Posto';
            default: return 'Geral';
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline" 
                    className="relative gap-2 border-slate-200 font-bold h-9 px-4 rounded-xl shadow-sm text-xs bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all shrink-0"
                >
                    <Bell className={`w-4 h-4 ${criticalCount > 0 ? 'text-red-500 animate-bounce' : 'text-slate-500'}`} />
                    <span>Notificações de Prazos</span>
                    {alerts.length > 0 && (
                        <span className={`absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white ${
                            criticalCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                        }`}>
                            {alerts.length}
                        </span>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-2xl z-[100]">
                <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
                    <DialogTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <Bell className="w-5 h-5 text-red-500" /> Prazos e Notificações Críticas de DP
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Acompanhe abaixo os prazos legais de pagamentos, envios de telegramas e vencimentos de contratos.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {alerts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-700 text-sm">Tudo em ordem por aqui!</h4>
                                <p className="text-[11px] text-slate-400">Não há prazos vencidos ou alertas para os próximos dias.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Critical Alerts */}
                            {criticalCount > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-red-600 flex items-center gap-1.5 px-1">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Atrasados / Críticos ({criticalCount})
                                    </h4>
                                    <div className="space-y-2">
                                        {alerts.filter(a => a.type === 'CRITICAL').map(alert => (
                                            <div key={alert.id} className="p-3.5 bg-red-50/50 border border-red-150 rounded-2xl flex gap-3 text-xs">
                                                <div className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                                                    {getIcon(alert.category)}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="font-extrabold text-red-800">{alert.employeeName}</div>
                                                    <div className="text-[10px] font-bold text-red-650/80 uppercase tracking-wide">
                                                        {getCategoryLabel(alert.category)}
                                                    </div>
                                                    <p className="text-red-700 font-semibold text-[11px] leading-relaxed mt-1">{alert.message}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Warning Alerts */}
                            {warningCount > 0 && (
                                <div className="space-y-2 pt-2">
                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-600 flex items-center gap-1.5 px-1">
                                        <Info className="w-3.5 h-3.5 text-amber-500" /> Lembretes / Próximos Vencimentos ({warningCount})
                                    </h4>
                                    <div className="space-y-2">
                                        {alerts.filter(a => a.type === 'WARNING').map(alert => (
                                            <div key={alert.id} className="p-3.5 bg-amber-50/40 border border-amber-150 rounded-2xl flex gap-3 text-xs">
                                                <div className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-amber-100/60 flex items-center justify-center">
                                                    {getIcon(alert.category)}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="font-extrabold text-amber-800">{alert.employeeName}</div>
                                                    <div className="text-[10px] font-bold text-amber-650 uppercase tracking-wide">
                                                        {getCategoryLabel(alert.category)}
                                                    </div>
                                                    <p className="text-amber-700 font-semibold text-[11px] leading-relaxed mt-1">{alert.message}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Responsible Manager Selector Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6">
                    {isAdmin ? (
                        <div className="flex flex-col gap-1 w-full max-w-sm">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <Settings className="w-3 h-3" /> Gestor da Área (Responsável Alertas)
                            </Label>
                            <Select
                                value={selectedManager}
                                onValueChange={handleManagerChange}
                                disabled={updating}
                            >
                                <SelectTrigger className="h-8 rounded-lg border-slate-200 text-xs bg-white">
                                    <SelectValue placeholder="Selecione o gestor..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Todos (Nenhum gestor específico)</SelectItem>
                                    {systemUsers.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <div className="text-[10px] text-slate-400 font-medium italic">
                            Apenas Administradores podem alterar o Gestor Responsável.
                        </div>
                    )}
                    <Button 
                        onClick={() => setOpen(false)} 
                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs h-9 px-6 self-end"
                    >
                        Fechar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
