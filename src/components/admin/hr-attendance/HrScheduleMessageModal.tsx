"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { scheduleHrMessage } from "@/actions/hr-attendance";

interface Props {
    open: boolean;
    onClose: () => void;
    ticketId?: string;
    contactPhone?: string;
    contactName?: string;
    onScheduled?: () => void;
}

export function HrScheduleMessageModal({ open, onClose, ticketId, contactPhone = "", contactName = "", onScheduled }: Props) {
    const [phone, setPhone] = useState(contactPhone);
    const [message, setMessage] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("09:00");
    const [isBirthdayPreset, setIsBirthdayPreset] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleApplyBirthdayPreset = () => {
        setIsBirthdayPreset(true);
        setMessage(`🎉 Parabéns pelo seu aniversário, ${contactName || "colaborador"}! 🎂\n\nToda a equipe do RH lhe deseja um excelente dia, muita saúde, felicidades e sucesso! Agradecemos por fazer parte do nosso time! ✨`);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone || !message || !date || !time) return;

        setLoading(true);
        try {
            const scheduledAt = `${date}T${time}:00`;
            const res = await scheduleHrMessage({
                ticketId,
                phone,
                message,
                scheduledAt,
                isRecurring: isBirthdayPreset,
                recurrenceRule: isBirthdayPreset ? "BIRTHDAY" : undefined
            });

            if (res.scheduled) {
                setMessage("");
                onScheduled?.();
                onClose();
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span>⏰</span> Agendar Mensagem no WhatsApp
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                            onClick={handleApplyBirthdayPreset}
                        >
                            🎂 Modelo de Aniversário
                        </Button>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs font-semibold">Telefone do WhatsApp</Label>
                        <Input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="(47) 99999-9999"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">Data do Envio</Label>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">Horário</Label>
                            <Input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs font-semibold">Conteúdo da Mensagem</Label>
                        <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Digite o texto da mensagem que será enviada no horário programado..."
                            rows={4}
                            required
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {loading ? "Agendando..." : "Confirmar Agendamento"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
