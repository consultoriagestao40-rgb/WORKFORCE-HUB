"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Palmtree } from "lucide-react";
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
    const count = employeesOnVacation.length;

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Card className="hover:scale-105 transition-transform cursor-pointer bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-orange-700">
                            Em Férias Hoje
                        </CardTitle>
                        <Palmtree className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-900">{count}</div>
                        <p className="text-xs text-orange-600/80">
                            {count === 1 ? "Colaborador ausente" : "Colaboradores ausentes"}
                        </p>
                    </CardContent>
                </Card>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-orange-700">
                        <Palmtree className="w-5 h-5" />
                        Colaboradores em Férias
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                    {count === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            Nenhum colaborador está de férias hoje.
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {employeesOnVacation.map((emp) => (
                                <div key={emp.id} className="flex items-start justify-between p-3 rounded-lg border bg-white/50 hover:bg-orange-50/50 transition-colors">
                                    <div className="space-y-1">
                                        <div className="font-semibold text-slate-800">{emp.name}</div>
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
                                            Retorno: {format(new Date(emp.vacationEnd.getTime() + 86400000), "dd/MM", { locale: ptBR })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
