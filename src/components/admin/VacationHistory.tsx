"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDays } from "date-fns";
import { Trash2, Plus, Pencil } from "lucide-react";
import { addVacation, deleteVacation, updateVacation } from "@/app/actions";
import { toast } from "sonner";

// Helpers para anular qualquer efeito de fuso horário local (timezone offset)
const formatUTCDate = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
};

const toISODateString = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${year}-${month}-${day}`;
};

interface Vacation {
    id: string;
    startDate: Date;
    endDate: Date;
    daysTaken: number;
    daysSold?: number;
}

interface VacationHistoryProps {
    employeeId: string;
    vacations: Vacation[];
    hasActivePosto?: boolean;
}

export function VacationHistory({ employeeId, vacations, hasActivePosto }: VacationHistoryProps) {
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [days, setDays] = useState(30);
    const [daysSold, setDaysSold] = useState(0);

    useEffect(() => {
        const handleOpen = () => {
            setOpen(true);
            const el = document.getElementById("vacation-history-section");
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        };
        window.addEventListener('open-vacation-dialog', handleOpen);
        return () => window.removeEventListener('open-vacation-dialog', handleOpen);
    }, []);

    const handleStartDateChange = (val: string) => {
        setStartDate(val);
        if (val && days > 0) {
            const s = new Date(val);
            const e = addDays(s, days - 1);
            setEndDate(e.toISOString().split('T')[0]);
        } else {
            setEndDate("");
        }
    };

    const handleDaysChange = (d: number) => {
        setDays(d);
        if (startDate && d > 0) {
            const s = new Date(startDate);
            const e = addDays(s, d - 1);
            setEndDate(e.toISOString().split('T')[0]);
        } else {
            setEndDate("");
        }
    };

    const handleCancel = () => {
        setOpen(false);
        setEditingId(null);
        setStartDate("");
        setEndDate("");
        setDays(30);
        setDaysSold(0);
    };

    async function handleAddOrUpdate(formData: FormData) {
        if (hasActivePosto && !editingId) {
            const proceed = confirm(
                "Aviso: Este colaborador está atualmente alocado em um posto de trabalho ativo. Ao confirmar o lançamento destas férias, o colaborador será desvinculado automaticamente do posto de trabalho na data de início programada das férias.\n\nDeseja prosseguir com o agendamento?"
            );
            if (!proceed) return;
        }

        try {
            let result;
            if (editingId) {
                formData.append("vacationId", editingId);
                result = await updateVacation(formData);
            } else {
                result = await addVacation(formData);
            }

            if (result?.error) {
                toast.error(result.error);
                return;
            }
            handleCancel();
            toast.success(editingId ? "Férias atualizadas com sucesso!" : "Férias registradas com sucesso!");
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
        <div id="vacation-history-section" className="space-y-4">
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
                        <span className="text-sm font-semibold">
                            {editingId ? "Editar Lançamento" : "Novo Lançamento"}
                        </span>
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCancel}>
                            <span className="sr-only">Fechar</span>
                            <Trash2 className="w-4 h-4 text-slate-400 rotate-45" />
                        </Button>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs">Início (CLT)</Label>
                                <Input
                                    type="date"
                                    className="h-8 text-xs bg-white"
                                    value={startDate}
                                    onChange={(e) => handleStartDateChange(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Fim (Calculado)</Label>
                                <Input
                                    type="date"
                                    className="h-8 text-xs bg-slate-100 cursor-not-allowed text-slate-600 font-bold"
                                    value={endDate}
                                    readOnly
                                    disabled
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs">Dias Gozados</Label>
                                <Input
                                    type="number"
                                    className="h-8 text-xs bg-white"
                                    value={days}
                                    onChange={(e) => handleDaysChange(parseInt(e.target.value) || 0)}
                                    min={0}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Dias Comprados (Abono)</Label>
                                <Input
                                    type="number"
                                    className="h-8 text-xs bg-white"
                                    value={daysSold}
                                    onChange={(e) => setDaysSold(parseInt(e.target.value) || 0)}
                                    min={0}
                                    max={30}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button type="button" variant="ghost" size="sm" className="w-full h-8 text-xs bg-white border" onClick={handleCancel}>Cancelar</Button>
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
                                    formData.append("daysSold", daysSold.toString());
                                    handleAddOrUpdate(formData);
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
                            <tbody className="divide-y divide-slate-100">
                                {vacations.map((v) => (
                                    <tr key={v.id} className="group hover:bg-slate-50">
                                        <td className="px-3 py-2 text-slate-700 font-medium">
                                            {formatUTCDate(v.startDate)} até {formatUTCDate(v.endDate)}
                                        </td>
                                        <td className="px-3 py-2 text-center text-slate-600 font-bold">
                                            {v.daysTaken} dias {v.daysSold ? `+ ${v.daysSold} abono` : ""}
                                        </td>
                                        <td className="px-3 py-2 text-right flex items-center justify-end gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 text-slate-400 hover:text-primary"
                                                onClick={() => {
                                                    setEditingId(v.id);
                                                    setStartDate(toISODateString(v.startDate));
                                                    setEndDate(toISODateString(v.endDate));
                                                    setDays(v.daysTaken);
                                                    setDaysSold(v.daysSold || 0);
                                                    setOpen(true);
                                                }}
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
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
