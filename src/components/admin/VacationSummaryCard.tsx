"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Palmtree, CalendarDays, Pencil, StickyNote, NotebookPen, Loader2 } from "lucide-react";
import Link from "next/link";
import { updateVacationNotes } from "@/app/actions";
import { toast } from "sonner";

interface EmployeeOnVacation {
    id: string;
    vacationId?: string;
    name: string;
    vacationStart: Date;
    vacationEnd: Date;
    clientName: string;
    postoName: string;
    notes?: string;
}

interface VacationSummaryCardProps {
    employeesOnVacation: EmployeeOnVacation[];
}

// Helpers para formatação de data UTC (anulando desvios de timezone local do navegador)
const formatUTCDate = (dateInput: Date | string, pattern: string = "dd/MM") => {
    const d = new Date(dateInput);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = String(d.getUTCFullYear());
    if (pattern === "dd/MM/yy") {
        return `${day}/${month}/${year.slice(-2)}`;
    }
    return `${day}/${month}`;
};

const getRetornoDateStr = (endDateInput: Date | string) => {
    const d = new Date(endDateInput);
    d.setUTCDate(d.getUTCDate() + 1); // Adiciona 1 dia UTC para retorno
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
};

export function VacationSummaryCard({ employeesOnVacation }: VacationSummaryCardProps) {
    const [itemsList, setItemsList] = useState<EmployeeOnVacation[]>(employeesOnVacation);
    const [selectedVacation, setSelectedVacation] = useState<EmployeeOnVacation | null>(null);
    const [noteText, setNoteText] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setItemsList(employeesOnVacation);
    }, [employeesOnVacation]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Separar em férias hoje vs programadas
    const activeVacations = itemsList.filter(emp => new Date(emp.vacationStart) <= today);
    const programmedVacations = itemsList.filter(emp => new Date(emp.vacationStart) > today);

    const countActive = activeVacations.length;
    const countProgrammed = programmedVacations.length;

    // Ordenar a lista: primeiro quem está em gozo hoje, depois as programadas por data de início
    const sortedEmployees = [
        ...activeVacations.sort((a, b) => new Date(a.vacationEnd).getTime() - new Date(b.vacationEnd).getTime()),
        ...programmedVacations.sort((a, b) => new Date(a.vacationStart).getTime() - new Date(b.vacationStart).getTime())
    ];

    const handleOpenNoteModal = (emp: EmployeeOnVacation) => {
        setSelectedVacation(emp);
        setNoteText(emp.notes || "");
    };

    const handleSaveNote = async () => {
        if (!selectedVacation?.vacationId) {
            toast.error("Identificador de férias não encontrado para este registro.");
            return;
        }

        setIsSaving(true);
        try {
            const res = await updateVacationNotes(selectedVacation.vacationId, noteText);
            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success("Anotação salva com sucesso!");
                setItemsList(prev => prev.map(item =>
                    item.vacationId === selectedVacation.vacationId
                        ? { ...item, notes: noteText }
                        : item
                ));
                setSelectedVacation(null);
            }
        } catch (e: any) {
            toast.error(e.message || "Erro ao salvar anotação.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <Dialog>
                <DialogTrigger asChild>
                    <Card className="hover:scale-105 transition-transform cursor-pointer bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-orange-700">
                                Férias de Colaboradores
                            </CardTitle>
                            <Palmtree className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-900 flex items-baseline gap-2">
                                <span>{countActive}</span>
                                <span className="text-xs font-normal text-orange-700/80 bg-orange-100/60 px-1.5 py-0.5 rounded">
                                    {countActive === 1 ? "ativo hoje" : "ativos hoje"}
                                </span>
                            </div>
                            <p className="text-xs text-orange-600/80 mt-1 flex items-center gap-1 font-semibold">
                                <CalendarDays className="w-3.5 h-3.5" />
                                {countProgrammed} {countProgrammed === 1 ? "férias programada" : "férias programadas"}
                            </p>
                        </CardContent>
                    </Card>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-orange-700">
                            <Palmtree className="w-5 h-5" />
                            Histórico e Férias Programadas
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 mt-2">
                        {sortedEmployees.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                Nenhum colaborador de férias ou programado.
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {sortedEmployees.map((emp) => {
                                    const isProgrammed = new Date(emp.vacationStart) > today;
                                    return (
                                        <div
                                            key={emp.vacationId || emp.id}
                                            className="p-3.5 rounded-xl border bg-white/70 hover:bg-orange-50/50 hover:border-orange-200 transition-all space-y-2 shadow-xs"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <Link href={`/admin/employees/${emp.id}`} className="font-semibold text-slate-800 hover:text-primary transition-colors flex items-center gap-1.5">
                                                            {emp.name}
                                                            <Pencil className="w-3 h-3 text-slate-400" />
                                                        </Link>
                                                        {isProgrammed ? (
                                                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 text-[10px] px-1.5 py-0 font-bold">
                                                                Programada
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-100 text-[10px] px-1.5 py-0 font-bold">
                                                                Em Gozo
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                                        <span className="font-medium text-slate-600">{emp.clientName}</span>
                                                        <span>•</span>
                                                        <span>{emp.postoName}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right text-xs">
                                                    <div className="font-medium text-slate-700">
                                                        {formatUTCDate(emp.vacationStart)} à {formatUTCDate(emp.vacationEnd, "dd/MM/yy")}
                                                    </div>
                                                    <div className="text-orange-600 font-bold mt-0.5">
                                                        Retorno: {getRetornoDateStr(emp.vacationEnd)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Notes / Cobertura callout box */}
                                            {emp.notes ? (
                                                <div className="p-2.5 rounded-lg bg-amber-50/90 border border-amber-200/80 text-amber-950 text-xs flex items-start justify-between gap-2 mt-1">
                                                    <div className="flex items-start gap-2 min-w-0">
                                                        <StickyNote className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                                        <div>
                                                            <span className="font-bold text-[10px] uppercase tracking-wider text-amber-800 block mb-0.5">Anotação / Cobertura:</span>
                                                            <span className="font-medium whitespace-pre-wrap break-words">{emp.notes}</span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleOpenNoteModal(emp)}
                                                        className="h-6 px-2 text-[10px] text-amber-800 hover:bg-amber-200/60 font-bold shrink-0 rounded-md"
                                                    >
                                                        Editar
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="pt-1">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleOpenNoteModal(emp)}
                                                        className="h-6 px-2 text-[10px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200 gap-1 rounded-md"
                                                    >
                                                        <NotebookPen className="w-3 h-3 text-slate-500" />
                                                        Anotar Cobertura / Obs
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Note Edit Modal */}
            <Dialog open={!!selectedVacation} onOpenChange={(open) => !open && setSelectedVacation(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-800 text-base">
                            <NotebookPen className="w-4 h-4 text-amber-600" />
                            Anotação de Férias — {selectedVacation?.name}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        <p className="text-xs text-slate-500">
                            Registre informações sobre cobertura (ex: diarista, contato, não abrir vaga no posto, etc).
                        </p>
                        <Textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Ex: Férias que vou cobrir com diarista (Maria 41-99999-9999). Não abrir vaga no sistema."
                            className="min-h-[110px] text-xs bg-slate-50 border-slate-200 focus:bg-white"
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedVacation(null)}
                            disabled={isSaving}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleSaveNote}
                            disabled={isSaving}
                            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Salvando...</span>
                                </>
                            ) : (
                                <span>Salvar Anotação</span>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

