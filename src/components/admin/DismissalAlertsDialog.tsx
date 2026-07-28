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
import { 
    AlertTriangle, 
    CreditCard, 
    Send, 
    ShieldAlert, 
    Calendar, 
    CheckCircle2, 
    Info, 
    Settings,
    Bell
} from "lucide-react";
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
                return <CreditCard className="w-3.5 h-3.5 text-emerald-500 inline mr-1" />;
            case 'TELEGRAMA':
                return <Send className="w-3.5 h-3.5 text-sky-500 inline mr-1" />;
            case 'EXPERIENCIA':
                return <Calendar className="w-3.5 h-3.5 text-purple-500 inline mr-1" />;
            case 'ABANDONO':
                return <ShieldAlert className="w-3.5 h-3.5 text-rose-500 inline mr-1" />;
            default:
                return <Info className="w-3.5 h-3.5 text-slate-500 inline mr-1" />;
        }
    };

    const getCategoryLabel = (category: string) => {
        switch (category) {
            case 'PAGAMENTO': return 'Rescisão';
            case 'TELEGRAMA': return 'Telegrama';
            case 'EXPERIENCIA': return 'Experiência';
            case 'ABANDONO': return 'Abandono';
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
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-2xl">
                {/* Header */}
                <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-amber-50/50">
                    <DialogTitle className="flex items-center gap-2 text-lg font-black text-amber-700">
                        <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse" /> Prazos e Notificações Críticas de DP
                    </DialogTitle>
                    <DialogDescription className="text-xs text-amber-850">
                        Prezado responsável, acompanhe abaixo os prazos legais de pagamentos, envios de telegramas e vencimentos de contratos.
                    </DialogDescription>
                </DialogHeader>

                {/* Content */}
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
                        <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-white shadow-sm">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="font-bold text-slate-500">
                                        <th className="py-2.5 px-3">Colaborador</th>
                                        <th className="py-2.5 px-3">Tipo/Categoria</th>
                                        <th className="py-2.5 px-3">Status/Alerta</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {alerts.map((alert) => {
                                        const isCritical = alert.type === 'CRITICAL';
                                        return (
                                            <tr key={alert.id} className="hover:bg-slate-50/50 font-semibold text-slate-700">
                                                <td className="py-3 px-3 font-bold text-slate-800">
                                                    {alert.employeeName}
                                                </td>
                                                <td className="py-3 px-3 text-slate-650 font-medium">
                                                    {getIcon(alert.category)}
                                                    {getCategoryLabel(alert.category)}
                                                </td>
                                                <td className={`py-3 px-3 text-[11px] font-semibold ${
                                                    isCritical ? 'text-red-750' : 'text-amber-750'
                                                }`}>
                                                    {alert.message}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Responsible Manager Selector Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {isAdmin ? (
                        <div className="flex flex-col gap-1 w-full max-w-sm">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <Settings className="w-3.5 h-3.5 text-slate-500" /> Gestor Responsável (Alertas Globais)
                            </Label>
                            <Select
                                value={selectedManager}
                                onValueChange={handleManagerChange}
                                disabled={updating}
                            >
                                <SelectTrigger className="h-9 rounded-xl border-slate-250 text-xs bg-white font-semibold shadow-sm">
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
                            Apenas Administradores podem configurar o Gestor Responsável.
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
