"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { registerTelegramSentDate } from "@/app/actions";
import { format } from "date-fns";
import { Send } from "lucide-react";

export function TelegramRegisterButton({ 
    employeeId, 
    telegramIndex, 
    sentDate 
}: { 
    employeeId: string; 
    telegramIndex: 1 | 2; 
    sentDate: string | null; 
}) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleRegister = async () => {
        if (!confirm(`Deseja registrar o envio do ${telegramIndex}º Telegrama de convocação hoje?`)) return;
        setLoading(true);
        try {
            const res = await registerTelegramSentDate(employeeId, telegramIndex);
            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success(`${telegramIndex}º Telegrama registrado!`);
                router.refresh();
            }
        } catch (e: any) {
            toast.error(e.message || "Erro de conexão.");
        } finally {
            setLoading(false);
        }
    };

    if (sentDate) {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 px-2 py-0.5 rounded">
                ✅ Enviado {format(new Date(sentDate), 'dd/MM')}
            </span>
        );
    }

    return (
        <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRegister} 
            disabled={loading}
            className="h-6 text-[9px] font-black uppercase tracking-wider px-2 gap-1 border-slate-200 hover:bg-slate-50 transition-colors"
        >
            <Send className="w-2.5 h-2.5" /> Registrar
        </Button>
    );
}
