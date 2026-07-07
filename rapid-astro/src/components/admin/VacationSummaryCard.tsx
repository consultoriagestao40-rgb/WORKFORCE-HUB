"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Palmtree, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmployeeOnVacation {
    id: string;
    name: string;
    vacationStart: Date;
    vacationEnd: Date;
    clientName: string;
    postoName: string;
}

interface VacationSummaryCardProps {
    employeesOnVacation: EmployeeOnVacation[];
}

export function VacationSummaryCard({ employeesOnVacation }: VacationSummaryCardProps) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Separar em férias hoje vs programadas
    const activeVacations = employeesOnVacation.filter(emp => new Date(emp.vacationStart) <= today);
    const programmedVacations = employeesOnVacation.filter(emp => new Date(emp.vacationStart) > today);

    const countActive = activeVacations.length;
    const countProgrammed = programmedVacations.length;

    // Ordenar a lista: primeiro quem está em gozo hoje, depois as programadas por data de início
    const sortedEmployees = [
        ...activeVacations.sort((a, b) => new Date(a.vacationEnd).getTime() - new Date(b.vacationEnd).getTime()),
        ...programmedVacations.sort((a, b) => new Date(a.vacationStart).getTime() - new Date(b.vacationStart).getTime())
    ];

    return (
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
            <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
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
                                    <div key={emp.id} className="flex items-start justify-between p-3 rounded-lg border bg-white/50 hover:bg-orange-50/50 transition-colors">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-slate-800">{emp.name}</span>
                                                {isProgrammed ? (
                                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 text-[10px] px-1.5 py-0">
                                                        Programada
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-100 text-[10px] px-1.5 py-0">
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
                                                {format(new Date(emp.vacationStart), "dd/MM", { locale: ptBR })} à {format(new Date(emp.vacationEnd), "dd/MM/yy", { locale: ptBR })}
                                            </div>
                                            <div className="text-orange-600 font-medium mt-0.5">
                                                Retorno: {format(new Date(new Date(emp.vacationEnd).getTime() + 86400000), "dd/MM", { locale: ptBR })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
