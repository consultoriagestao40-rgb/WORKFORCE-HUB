"use client";

import React, { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";
import { AssignmentDialog } from "./AssignmentDialog";
import { EditPostoSheet } from "./EditPostoSheet";
import { ScheduleDialog } from "./ScheduleDialog";
import { DeletePostoButton } from "./DeletePostoButton";

interface ClientPostosTableProps {
    postos: any[];
    employees: any[];
    schedules: any[];
    roles: any[];
    situations: any[];
    userRole: string;
}

type SortField = "cargo" | "ocupante" | null;
type SortDirection = "asc" | "desc" | null;

export function ClientPostosTable({
    postos,
    employees,
    schedules,
    roles,
    situations,
    userRole
}: ClientPostosTableProps) {
    const [sortField, setSortField] = useState<SortField>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);

    const handleSort = (field: "cargo" | "ocupante") => {
        if (sortField === field) {
            if (sortDirection === "asc") {
                setSortDirection("desc");
            } else if (sortDirection === "desc") {
                setSortField(null);
                setSortDirection(null);
            }
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
    };

    const sortedPostos = useMemo(() => {
        if (!sortField || !sortDirection) {
            return postos;
        }

        return [...postos].sort((a, b) => {
            let valueA = "";
            let valueB = "";

            if (sortField === "cargo") {
                valueA = a.role?.name || "";
                valueB = b.role?.name || "";
            } else if (sortField === "ocupante") {
                const activeAssignmentA = a.assignments?.find((asg: any) => !asg.endDate);
                const activeAssignmentB = b.assignments?.find((asg: any) => !asg.endDate);
                valueA = activeAssignmentA?.employee?.name || "";
                valueB = activeAssignmentB?.employee?.name || "";
            }

            // Colocar postos vagos sempre no final
            if (sortField === "ocupante") {
                if (valueA === "" && valueB !== "") return 1;
                if (valueB === "" && valueA !== "") return -1;
                if (valueA === "" && valueB === "") return 0;
            }

            if (sortDirection === "asc") {
                return valueA.localeCompare(valueB, "pt-BR");
            } else {
                return valueB.localeCompare(valueA, "pt-BR");
            }
        });
    }, [postos, sortField, sortDirection]);

    const renderSortIcon = (field: "cargo" | "ocupante") => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-slate-400 group-hover:text-slate-600 transition-colors" />;
        }
        if (sortDirection === "asc") {
            return <ArrowUp className="w-3.5 h-3.5 ml-1 text-blue-600 font-bold" />;
        }
        return <ArrowDown className="w-3.5 h-3.5 ml-1 text-blue-600 font-bold" />;
    };

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[200px]">
                        <button
                            onClick={() => handleSort("cargo")}
                            className="flex items-center hover:text-slate-800 font-semibold group cursor-pointer focus:outline-none transition-colors"
                        >
                            Cargo {renderSortIcon("cargo")}
                        </button>
                    </TableHead>
                    <TableHead>Escala</TableHead>
                    <TableHead>Carga</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead className="w-[300px]">
                        <button
                            onClick={() => handleSort("ocupante")}
                            className="flex items-center hover:text-slate-800 font-semibold group cursor-pointer focus:outline-none transition-colors"
                        >
                            Ocupante Atual {renderSortIcon("ocupante")}
                        </button>
                    </TableHead>
                    <TableHead>Faturamento</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedPostos.map((posto) => {
                    const currentAssignment = posto.assignments.find((a: any) => !a.endDate);
                    const activeEmployee = currentAssignment?.employee as any;

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    let statusAlert = null;

                    if (activeEmployee) {
                        // Verificar férias
                        const activeVacation = activeEmployee.vacations?.find((v: any) =>
                            new Date(v.startDate) <= today && new Date(v.endDate) >= today
                        );

                        if (activeVacation) {
                            statusAlert = (
                                <span className="flex items-center gap-1 text-[10px] text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded-md mt-1 w-fit">
                                    🏖️ Em Férias (até {new Date(activeVacation.endDate).toLocaleDateString('pt-BR')})
                                </span>
                            );
                        }
                        // Verificar situação
                        else if (activeEmployee.situation && activeEmployee.situation.name !== 'Ativo' && activeEmployee.situation.name !== 'Em Férias') {
                            statusAlert = (
                                <span className="text-[10px] text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded-md mt-1 w-fit">
                                    ⚠️ {activeEmployee.situation.name}
                                </span>
                            );
                        }
                    }

                    return (
                        <TableRow key={posto.id} className={statusAlert ? "bg-red-50/30" : ""}>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-1 group">
                                    Posto {postos.indexOf(posto) + 1} - {posto.role.name}
                                    <EditPostoSheet posto={posto} schedules={schedules} roles={roles} />
                                </div>
                            </TableCell>
                            <TableCell>{posto.schedule}</TableCell>
                            <TableCell>{posto.requiredWorkload}h</TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span>{posto.startTime} - {posto.endTime}</span>
                                    {posto.isNightShift && <span className="text-[10px] text-purple-600 font-bold uppercase">Noturno</span>}
                                </div>
                            </TableCell>
                            <TableCell>
                                {activeEmployee ? (
                                    <div className="flex flex-col">
                                        <Link href={`/admin/employees/${activeEmployee.id}`} className="text-blue-600 hover:underline font-medium">
                                            {activeEmployee.name}
                                        </Link>
                                        <span className="text-[10px] text-slate-400">Carga: {activeEmployee.workload}h</span>
                                        {statusAlert}
                                    </div>
                                ) : (
                                    <div className="flex flex-col">
                                        <span className="text-slate-400 italic">Vago</span>
                                        <span className="text-[10px] text-red-500 font-bold">Necessita Cobertura</span>
                                    </div>
                                )}
                            </TableCell>
                            <TableCell>R$ {posto.billingValue.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                                <AssignmentDialog
                                    postoId={posto.id}
                                    postoRole={posto.role.name}
                                    activeEmployeeName={activeEmployee?.name}
                                    employees={employees}
                                    situations={situations}
                                    currentSchedule={posto.schedule}
                                    scheduleOptions={schedules}
                                />

                                {activeEmployee && (
                                    <ScheduleDialog
                                        postoId={posto.id}
                                        postoRole={posto.role.name}
                                        currentSchedule={posto.schedule}
                                        startDate={currentAssignment.startDate}
                                        scheduleOptions={schedules}
                                        assignmentId={currentAssignment.id}
                                    />
                                )}

                                {userRole === 'ADMIN' && (
                                    <DeletePostoButton
                                        postoId={posto.id}
                                        postoRole={posto.role.name}
                                    />
                                )}
                            </TableCell>
                        </TableRow>
                    );
                })}
                {sortedPostos.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center text-slate-500 py-6">
                            Nenhum posto cadastrado.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}
