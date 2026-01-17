"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { logCheckIn, reportAbsence } from "@/app/mobile/actions";

interface MobileActionButtonsProps {
    employeeId: string;
    postoId: string;
    employeeName: string;
}

export function MobileActionButtons({ employeeId, postoId, employeeName }: MobileActionButtonsProps) {
    const [loading, setLoading] = useState<string | null>(null);

    async function handleCheckIn() {
        setLoading("checkin");
        try {
            await logCheckIn(employeeId, postoId);
            toast.success(`Presença registrada para ${employeeName}`);
        } catch {
            toast.error("Erro ao registrar presença");
        } finally {
            setLoading(null);
        }
    }

    async function handleDelay() {
        setLoading("delay");
        // Simulate delay logging for now, reusing checkin action or similar
        // For MVP we map delay to checkin but maybe with a note, but the current action is simple.
        // Let's just show a toast for now as logic is same as present but technically different meaning.
        try {
            // We can update the action later to accept type. For now, log as CheckIn.
            await logCheckIn(employeeId, postoId);
            toast.warning(`Atraso registrado para ${employeeName}`);
        } catch {
            toast.error("Erro ao registrar atraso");
        } finally {
            setLoading(null);
        }
    }

    async function handleAbsence() {
        setLoading("absence");
        try {
            await reportAbsence(employeeId, postoId);
            toast.error(`Falta registrada para ${employeeName}!`); // Red toast for emphasis
        } catch {
            toast.error("Erro ao registrar falta");
        } finally {
            setLoading(null);
        }
    }

    return (
        <div className="grid grid-cols-3 gap-2">
            <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-9 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                onClick={handleCheckIn}
                disabled={!!loading}
            >
                {loading === "checkin" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                Presente
            </Button>

            <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-9 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                onClick={handleDelay}
                disabled={!!loading}
            >
                {loading === "delay" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />}
                Atraso
            </Button>

            <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-9 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                onClick={handleAbsence}
                disabled={!!loading}
            >
                {loading === "absence" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 mr-1.5" />}
                Falta
            </Button>
        </div>
    );
}
