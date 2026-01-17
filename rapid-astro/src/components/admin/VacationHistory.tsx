"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, differenceInDays, addDays } from "date-fns";
import { Trash2, Plus } from "lucide-react";
import { addVacation, deleteVacation } from "@/app/actions";
import { toast } from "sonner";

interface Vacation {
    id: string;
    startDate: Date;
    endDate: Date;
    daysTaken: number;
}

interface VacationHistoryProps {
    employeeId: string;
    vacations: Vacation[];
}

export function VacationHistory({ employeeId, vacations }: VacationHistoryProps) {
    const [open, setOpen] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [days, setDays] = useState(30);

    // Auto-calculate days when dates change
    const handleDateChange = (start: string, end: string) => {
        setStartDate(start);
        setEndDate(end);
        if (start && end) {
            const s = new Date(start);
            const e = new Date(end);
            const diff = differenceInDays(e, s) + 1; // Include start day
            if (diff > 0) setDays(diff);
        }
    };

    // Auto-calculate end date if days change
    const handleDaysChange = (d: number) => {
        setDays(d);
        if (startDate) {
            const s = new Date(startDate);
            const e = addDays(s, d - 1); // Subtract 1 because start day counts
            setEndDate(e.toISOString().split('T')[0]);
        }
    }

    async function handleAdd(formData: FormData) {
        try {
            const result = await addVacation(formData);
            if (result?.error) {
                toast.error(result.error);
                return;
            }
            setOpen(false);
            setStartDate("");
            setEndDate("");
            setDays(30);
            toast.success("Férias registradas com sucesso!");
        } catch (error: any) {
            toast.error(error.message);
        }
    }

    async function handleDelete(id: string) {
        if (confirm("Confirmar exclusão deste registro de férias?")) {
            try {
                await deleteVacation(id, employeeId);
                toast.success("Registro removido.");
            } catch (error: any) {
                toast.error(error.message);
            }
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-700">Histórico de Férias</div>
                {!open && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => setOpen(true)}
                    >
                        <Plus className="w-3 h-3" />
                        Lançar Férias
                    </Button>
                )}
            </div>

            {open && (
                <div className="bg-slate-50 border rounded-lg p-4 animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-semibold">Novo Lançamento</span>
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
                            <span className="sr-only">Fechar</span>
                            <Trash2 className="w-4 h-4 text-slate-400 rotate-45" />
                        </Button>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs">Início</Label>
                                <Input
                                    type="date"
                                    className="h-8 text-xs bg-white"
                                    value={startDate}
                                    onChange={(e) => handleDateChange(e.target.value, endDate)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Fim</Label>
                                <Input
                                    type="date"
                                    className="h-8 text-xs bg-white"
                                    value={endDate}
                                    onChange={(e) => handleDateChange(startDate, e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">Dias Gozados</Label>
                            <Input
                                type="number"
                                className="h-8 text-xs bg-white"
                                value={days}
                                onChange={(e) => handleDaysChange(parseInt(e.target.value) || 0)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button type="button" variant="ghost" size="sm" className="w-full h-8 text-xs bg-white border" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button
                                type="button"
                                size="sm"
                                className="w-full h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={() => {
                                    const formData = new FormData();
                                    formData.append("employeeId", employeeId);
                                    formData.append("startDate", startDate);
                                    formData.append("endDate", endDate);
                                    formData.append("daysTaken", days.toString());
                                    handleAdd(formData);
                                }}
                            >
                                Salvar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[200px] overflow-y-auto">
                    {vacations.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 italic">
                            Nenhum histórico registrado.
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-3 py-2 text-left">Periodo</th>
                                    <th className="px-3 py-2 text-center">Dias</th>
                                    <th className="px-3 py-2 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {vacations.map((v) => (
                                    <tr key={v.id} className="group hover:bg-slate-50">
                                        <td className="px-3 py-2 text-slate-700">
                                            {format(new Date(v.startDate), "dd/MM/yyyy")} até {format(new Date(v.endDate), "dd/MM/yyyy")}
                                        </td>
                                        <td className="px-3 py-2 text-center font-bold text-slate-600">
                                            {v.daysTaken}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                                                onClick={() => handleDelete(v.id)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
