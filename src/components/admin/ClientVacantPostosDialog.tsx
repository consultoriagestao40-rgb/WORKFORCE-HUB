"use client";

import React, { useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Calendar, Clock, AlertCircle } from "lucide-react";

interface ClientVacantPostosDialogProps {
    postos: any[];
}

export function ClientVacantPostosDialog({ postos }: ClientVacantPostosDialogProps) {
    const vacantPostos = useMemo(() => {
        return postos.filter(posto => {
            const hasActiveAssignment = posto.assignments.some((a: any) => !a.endDate);
            return !hasActiveAssignment;
        });
    }, [postos]);

    const vacantPostosDetails = useMemo(() => {
        return vacantPostos.map(posto => {
            const endedAssignments = posto.assignments.filter((a: any) => a.endDate);
            let vacantSinceDate: Date;
            let isNeverOccupied = false;

            if (endedAssignments.length > 0) {
                // Obter a desalocação mais recente (maior endDate)
                const sorted = [...endedAssignments].sort((a: any, b: any) => 
                    new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
                );
                vacantSinceDate = new Date(sorted[0].endDate);
            } else {
                vacantSinceDate = new Date(posto.createdAt);
                isNeverOccupied = true;
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const vacantDateClean = new Date(vacantSinceDate);
            vacantDateClean.setHours(0, 0, 0, 0);

            const diffTime = Math.abs(today.getTime() - vacantDateClean.getTime());
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            return {
                ...posto,
                vacantSinceDate,
                diffDays,
                isNeverOccupied
            };
        });
    }, [vacantPostos]);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Card className="border-none shadow-md bg-gradient-to-br from-amber-50 to-red-50/40 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden relative group border border-amber-100/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-amber-800 uppercase tracking-wider flex items-center justify-between">
                            <span>Postos Vagos</span>
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-red-600 tracking-tight">
                            {vacantPostos.length}
                        </div>
                        <p className="text-[10px] text-amber-700/80 mt-1 font-semibold flex items-center gap-1">
                            Clique para ver o resumo detalhado
                        </p>
                    </CardContent>
                </Card>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[750px] w-full max-h-[85vh] overflow-y-auto rounded-xl p-6">
                <DialogHeader className="pb-2 border-b border-slate-100">
                    <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        Resumo dos Postos Vagos
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 text-sm mt-1">
                        Postos contratados que estão atualmente sem colaborador ativo alocado. 
                        Total de vagas abertas neste cliente: <span className="font-semibold text-red-600">{vacantPostos.length}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    {vacantPostosDetails.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 font-medium">
                            🎉 Excelente! Não há nenhum posto vago neste cliente.
                        </div>
                    ) : (
                        <div className="overflow-hidden border border-slate-100 rounded-lg">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="font-semibold text-slate-700">Cargo / Função</TableHead>
                                        <TableHead className="font-semibold text-slate-700">Escala / Horário</TableHead>
                                        <TableHead className="font-semibold text-slate-700">Vago Desde</TableHead>
                                        <TableHead className="font-semibold text-slate-700 text-right">Tempo Vago</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {vacantPostosDetails.map((posto) => {
                                        // Estilizar badge com base nos dias vagos
                                        let badgeColor = "bg-slate-100 text-slate-700";
                                        if (posto.diffDays >= 15) {
                                            badgeColor = "bg-red-50 text-red-700 font-bold border border-red-100";
                                        } else if (posto.diffDays >= 7) {
                                            badgeColor = "bg-amber-50 text-amber-700 font-semibold border border-amber-100";
                                        }

                                        return (
                                            <TableRow key={posto.id} className="hover:bg-slate-50/50 transition-colors">
                                                <TableCell className="font-medium text-slate-900">
                                                    <div className="flex items-center gap-2">
                                                        <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                                                        <span>{posto.role?.name || "Cargo Indefinido"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium w-fit">
                                                            {posto.schedule}
                                                        </span>
                                                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                                            <Clock className="w-3 h-3 text-slate-400" />
                                                            {posto.startTime} - {posto.endTime}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>
                                                            {posto.isNeverOccupied 
                                                                ? "Criação do posto" 
                                                                : posto.vacantSinceDate.toLocaleDateString("pt-BR")
                                                            }
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${badgeColor}`}>
                                                        {posto.isNeverOccupied 
                                                            ? `Nunca ocupado (${posto.diffDays} dias)`
                                                            : `${posto.diffDays} ${posto.diffDays === 1 ? 'dia' : 'dias'}`
                                                        }
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
