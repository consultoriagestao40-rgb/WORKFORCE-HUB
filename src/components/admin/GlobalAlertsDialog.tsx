"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
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
    Calendar, 
    Send, 
    ShieldAlert, 
    Settings,
    Info
} from "lucide-react";
import { getGlobalAlerts, updateAlertUserId, GlobalAlertItem } from "@/actions/globalAlerts";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface GlobalAlertsDialogProps {
    user: any;
}

export function GlobalAlertsDialog({ user }: GlobalAlertsDialogProps) {
    const [open, setOpen] = useState(false);
    const [benefitsAlerts, setBenefitsAlerts] = useState<GlobalAlertItem[]>([]);
    const [experienceAlerts, setExperienceAlerts] = useState<GlobalAlertItem[]>([]);
    const [dismissalAlerts, setDismissalAlerts] = useState<GlobalAlertItem[]>([]);
    
    const [alertUserId, setAlertUserId] = useState<string | null>(null);
    const [systemUsers, setSystemUsers] = useState<{ id: string; name: string; email: string | null }[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const router = useRouter();

    useEffect(() => {
        async function fetchAlerts() {
            try {
                const res = await getGlobalAlerts();
                if (!res) return;

                const { 
                    benefitsAlerts: bAlerts, 
                    experienceAlerts: eAlerts, 
                    dismissalAlerts: dAlerts, 
                    alertUserId: managerId, 
                    currentUserId,
                    systemUsers: users
                } = res;

                setBenefitsAlerts(bAlerts);
                setExperienceAlerts(eAlerts);
                setDismissalAlerts(dAlerts);
                setAlertUserId(managerId);
                setSystemUsers(users);

                const totalAlerts = bAlerts.length + eAlerts.length + dAlerts.length;
                const isDesignatedUser = !managerId || managerId === currentUserId;

                if (totalAlerts > 0 && isDesignatedUser) {
                    setOpen(true);
                }
            } catch (error) {
                console.error("Failed to load global DP alerts", error);
            } finally {
                setLoading(false);
            }
        }

        fetchAlerts();
    }, []);

    const totalCount = benefitsAlerts.length + experienceAlerts.length + dismissalAlerts.length;

    if (totalCount === 0 || loading) {
        return null;
    }

    const handleManagerChange = async (val: string) => {
        try {
            setUpdating(true);
            setAlertUserId(val === "none" ? null : val);
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

    const getIcon = (category?: string) => {
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

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-2xl">
                {/* Header */}
                <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-amber-50/50">
                    <DialogTitle className="flex items-center gap-2 text-lg font-black text-amber-700">
                        <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse" /> Prazos e Vencimentos Críticos de DP
                    </DialogTitle>
                    <DialogDescription className="text-xs text-amber-850">
                        Prezado responsável, há prazos legais e vencimentos para o dia de hoje ou datas anteriores que necessitam de atenção.
                    </DialogDescription>
                </DialogHeader>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Benefits Alerts Table */}
                    {benefitsAlerts.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-amber-700 flex items-center gap-1.5 uppercase tracking-wider">
                                <CreditCard className="w-4 h-4 text-amber-650" /> Pagamentos de VT/VA Fracionados
                            </h4>
                            <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-white">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr className="font-bold text-slate-500">
                                            <th className="py-2.5 px-3">Colaborador</th>
                                            <th className="py-2.5 px-3 text-center">Vencimento</th>
                                            <th className="py-2.5 px-3 text-right">Mensagem</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {benefitsAlerts.map(alert => (
                                            <tr key={alert.id} className="hover:bg-slate-50/50 font-semibold text-slate-700">
                                                <td className="py-3 px-3 font-bold text-slate-800">
                                                    {alert.employeeName}
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold text-[10px] border border-red-200">
                                                        {alert.dueDate}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-right text-red-650 text-[11px]">
                                                    {alert.message}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Experience Alerts Table */}
                    {experienceAlerts.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-purple-750 flex items-center gap-1.5 uppercase tracking-wider">
                                <Calendar className="w-4 h-4 text-purple-650" /> Contratos de Experiência Próximos do Fim
                            </h4>
                            <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-white">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr className="font-bold text-slate-500">
                                            <th className="py-2.5 px-3">Colaborador</th>
                                            <th className="py-2.5 px-3 text-center">Término</th>
                                            <th className="py-2.5 px-3 text-center">Status / Dias</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {experienceAlerts.map(alert => {
                                            const isOverdue = alert.daysLeft < 0;
                                            return (
                                                <tr key={alert.id} className="hover:bg-slate-50/50 font-semibold text-slate-700">
                                                    <td className="py-3 px-3 font-bold text-slate-800">
                                                        {alert.employeeName}
                                                    </td>
                                                    <td className="py-3 px-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                                                            isOverdue 
                                                                ? 'bg-red-50 text-red-700 border-red-200' 
                                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}>
                                                            {alert.dueDate}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                            isOverdue 
                                                                ? 'bg-red-100 text-red-700' 
                                                                : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                            {isOverdue 
                                                                ? `${Math.abs(alert.daysLeft)}d atrasado` 
                                                                : `${alert.daysLeft}d restantes`}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* DP / Dismissal Alerts Table */}
                    {dismissalAlerts.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-rose-750 flex items-center gap-1.5 uppercase tracking-wider">
                                <ShieldAlert className="w-4 h-4 text-rose-650" /> Prazos Legais de Rescisões e Telegramas
                            </h4>
                            <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-white">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr className="font-bold text-slate-500">
                                            <th className="py-2.5 px-3">Colaborador</th>
                                            <th className="py-2.5 px-3 text-center">Vencimento</th>
                                            <th className="py-2.5 px-3">Alerta</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {dismissalAlerts.map(alert => (
                                            <tr key={alert.id} className="hover:bg-slate-50/50 font-semibold text-slate-700">
                                                <td className="py-3 px-3 font-bold text-slate-800">
                                                    {getIcon(alert.category)}
                                                    {alert.employeeName}
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold text-[10px] border border-red-200">
                                                        {alert.dueDate}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-red-650 text-[11px] font-semibold">
                                                    {alert.message}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Responsible Manager Selector Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {user?.role === 'ADMIN' ? (
                        <div className="flex flex-col gap-1 w-full max-w-sm">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <Settings className="w-3.5 h-3.5 text-slate-500" /> Gestor Responsável (Alertas Globais)
                            </Label>
                            <Select
                                value={alertUserId || "none"}
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
