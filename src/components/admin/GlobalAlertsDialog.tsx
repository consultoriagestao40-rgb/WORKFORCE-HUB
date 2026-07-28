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
    Bell, 
    AlertTriangle, 
    CreditCard, 
    Calendar, 
    ArrowRight, 
    CheckCircle2, 
    Info 
} from "lucide-react";
import { getGlobalAlerts, GlobalAlertItem } from "@/actions/globalAlerts";
import { useRouter } from "next/navigation";

interface GlobalAlertsDialogProps {
    user: any;
}

export function GlobalAlertsDialog({ user }: GlobalAlertsDialogProps) {
    const [open, setOpen] = useState(false);
    const [benefitsAlerts, setBenefitsAlerts] = useState<GlobalAlertItem[]>([]);
    const [experienceAlerts, setExperienceAlerts] = useState<GlobalAlertItem[]>([]);
    const [activeTab, setActiveTab] = useState<'benefits' | 'experience'>('benefits');
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Check session storage to see if we already showed it in this browser session
        const hasShown = sessionStorage.getItem("hasShownGlobalAlerts");
        
        async function fetchAlerts() {
            try {
                const res = await getGlobalAlerts();
                if (!res) return;

                const { benefitsAlerts: bAlerts, experienceAlerts: eAlerts, alertUserId, currentUserId } = res;
                setBenefitsAlerts(bAlerts);
                setExperienceAlerts(eAlerts);

                const totalAlerts = bAlerts.length + eAlerts.length;

                // Condition to open:
                // 1. We have alerts
                // 2. We haven't shown it yet in this browser session
                // 3. Current user is either the designated alert user, OR there is no alert user configured (shows for all admins)
                const isDesignatedUser = !alertUserId || alertUserId === currentUserId;

                if (totalAlerts > 0 && !hasShown && isDesignatedUser) {
                    setOpen(true);
                    sessionStorage.setItem("hasShownGlobalAlerts", "true");
                    
                    // Set active tab based on which alerts exist
                    if (bAlerts.length === 0 && eAlerts.length > 0) {
                        setActiveTab('experience');
                    } else {
                        setActiveTab('benefits');
                    }
                }
            } catch (error) {
                console.error("Failed to load global DP alerts", error);
            } finally {
                setLoading(false);
            }
        }

        fetchAlerts();
    }, []);

    const totalCount = benefitsAlerts.length + experienceAlerts.length;

    if (totalCount === 0 || loading) {
        return null;
    }

    const handleNavigate = (path: string) => {
        setOpen(false);
        router.push(path);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-2xl z-[100]">
                {/* Header */}
                <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-gradient-to-r from-red-50/20 to-amber-50/20">
                    <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Bell className="w-5 h-5 text-red-500 animate-bounce" /> 
                        Prazos Críticos de DP e Benefícios
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Prezado gestor, existem prazos de compras de benefícios e vencimentos de contratos vencendo hoje ou em atraso.
                    </DialogDescription>
                </DialogHeader>

                {/* Tab Selectors */}
                <div className="flex border-b border-slate-100 bg-slate-50/50 px-6 py-2 gap-2">
                    <button
                        onClick={() => setActiveTab('benefits')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'benefits'
                                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50 font-black'
                                : 'text-slate-500 hover:text-slate-850 hover:bg-slate-100/60'
                        }`}
                    >
                        <CreditCard className="w-4 h-4" />
                        Compra de Benefícios
                        {benefitsAlerts.length > 0 && (
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                                {benefitsAlerts.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('experience')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'experience'
                                ? 'bg-white text-purple-700 shadow-sm border border-slate-200/50 font-black'
                                : 'text-slate-500 hover:text-slate-850 hover:bg-slate-100/60'
                        }`}
                    >
                        <Calendar className="w-4 h-4" />
                        Contratos de Experiência
                        {experienceAlerts.length > 0 && (
                            <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                                {experienceAlerts.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {activeTab === 'benefits' ? (
                        benefitsAlerts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                <p className="text-xs font-bold text-slate-700">Tudo em dia com os benefícios!</p>
                                <p className="text-[10px] text-slate-400">Nenhum pagamento fracionado com vencimento para hoje ou atrasado.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="border border-slate-250/60 rounded-2xl overflow-hidden bg-white shadow-sm">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-50/70 border-b border-slate-200">
                                            <tr className="font-bold text-slate-500">
                                                <th className="py-2.5 px-4">Colaborador</th>
                                                <th className="py-2.5 px-4 text-center">Vencimento</th>
                                                <th className="py-2.5 px-4">Alerta</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {benefitsAlerts.map(alert => (
                                                <tr key={alert.id} className="hover:bg-slate-50/40 font-medium">
                                                    <td className="py-3 px-4 font-bold text-slate-850">
                                                        {alert.employeeName}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold text-[10px] border border-red-200">
                                                            {alert.dueDate}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-[11px] text-red-600 font-semibold">
                                                        {alert.message}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button 
                                        onClick={() => handleNavigate("/admin/benefits")}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs gap-1.5 h-9"
                                    >
                                        Acessar Compra de Benefícios <ArrowRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )
                    ) : (
                        experienceAlerts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                <p className="text-xs font-bold text-slate-700">Tudo em ordem com a experiência!</p>
                                <p className="text-[10px] text-slate-400">Nenhum contrato de experiência vencendo hoje ou atrasado.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="border border-slate-250/60 rounded-2xl overflow-hidden bg-white shadow-sm">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-50/70 border-b border-slate-200">
                                            <tr className="font-bold text-slate-500">
                                                <th className="py-2.5 px-4">Colaborador</th>
                                                <th className="py-2.5 px-4 text-center">Término</th>
                                                <th className="py-2.5 px-4 text-center">Status / Dias</th>
                                                <th className="py-2.5 px-4">Alerta</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {experienceAlerts.map(alert => {
                                                const isOverdue = alert.daysLeft < 0;
                                                return (
                                                    <tr key={alert.id} className="hover:bg-slate-50/40 font-medium">
                                                        <td className="py-3 px-4 font-bold text-slate-850">
                                                            {alert.employeeName}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                                                                isOverdue 
                                                                    ? 'bg-red-50 text-red-700 border-red-200' 
                                                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                                            }`}>
                                                                {alert.dueDate}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
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
                                                        <td className={`py-3 px-4 text-[11px] font-semibold ${
                                                            isOverdue ? 'text-red-650' : 'text-amber-650'
                                                        }`}>
                                                            {alert.message}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button 
                                        onClick={() => handleNavigate("/admin/probation-monitor")}
                                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs gap-1.5 h-9"
                                    >
                                        Acessar Monitor de Experiência <ArrowRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex justify-end bg-slate-50/50">
                    <Button 
                        onClick={() => setOpen(false)} 
                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs h-9 px-6"
                    >
                        Entendido
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
