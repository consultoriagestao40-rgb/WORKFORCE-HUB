"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { deleteOccurrence } from "@/app/mobile/actions-occurrences";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { NewOccurrenceSheet } from "./NewOccurrenceSheet";

interface OccurrencesListProps {
    initialOccurrences: any[];
    postos: any[];
    employees: any[];
    userRole: string | null;
}

export function OccurrencesList({ initialOccurrences, postos, employees, userRole }: OccurrencesListProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterPosto, setFilterPosto] = useState("all");
    const [filterEmployee, setFilterEmployee] = useState("all");
    const router = useRouter();

    // Client-side filtering
    const filteredOccurrences = initialOccurrences.filter(occ => {
        const matchesSearch =
            occ.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            occ.description.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesPosto = filterPosto === "all" || occ.postoId === filterPosto;
        const matchesEmployee = filterEmployee === "all" || (occ.employeeId === filterEmployee) || (filterEmployee === "none" && !occ.employeeId);

        return matchesSearch && matchesPosto && matchesEmployee;
    });

    async function handleDelete(id: string) {
        const result = await deleteOccurrence(id);
        if (result?.error) {
            toast.error(result.error);
        } else {
            toast.success("Ocorrência excluída com sucesso");
            router.refresh();
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Ocorrências</h1>
                    <p className="text-muted-foreground text-sm">Gerencie os registros de eventos operacionais e disciplinares.</p>
                </div>
                <NewOccurrenceSheet postos={postos} employees={employees} />
            </div>

            <Card className="border-none shadow-sm bg-white">
                <CardHeader className="border-b border-slate-100 p-6">
                    <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                        <div className="flex gap-2 flex-1 max-w-2xl">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="Buscar por título ou descrição..."
                                    className="pl-9 bg-slate-50 border-slate-200"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                            <Select value={filterPosto} onValueChange={setFilterPosto}>
                                <SelectTrigger className="w-[200px] bg-slate-50 border-slate-200">
                                    <SelectValue placeholder="Filtrar por Posto" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os Postos</SelectItem>
                                    {postos.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.client.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                                <SelectTrigger className="w-[200px] bg-slate-50 border-slate-200">
                                    <SelectValue placeholder="Filtrar por Colaborador" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os Colaboradores</SelectItem>
                                    <SelectItem value="none">Geral (Sem Colaborador)</SelectItem>
                                    {employees.map(e => (
                                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead className="pl-6 w-[140px]">Data</TableHead>
                                <TableHead>Cliente / Posto</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Colaborador</TableHead>
                                <TableHead className="max-w-[300px]">Título / Descrição</TableHead>
                                <TableHead className="text-right pr-6">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredOccurrences.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        Nenhuma ocorrência encontrada.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredOccurrences.map((occ) => (
                                    <TableRow key={occ.id} className="group hover:bg-slate-50/50">
                                        <TableCell className="pl-6 whitespace-nowrap align-top py-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-700">{format(new Date(occ.date), "dd/MM/yyyy")}</span>
                                                <span className="text-xs text-slate-500">{format(new Date(occ.date), "HH:mm")}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="align-top py-4">
                                            <div className="font-medium text-slate-900">{occ.posto.client.name}</div>
                                        </TableCell>
                                        <TableCell className="align-top py-4">
                                            <Badge variant="outline" className={
                                                occ.type === 'Disciplinar' ? 'bg-red-50 text-red-700 border-red-200' :
                                                    occ.type === 'Elogio' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        'bg-slate-100 text-slate-700 border-slate-200'
                                            }>
                                                {occ.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="align-top py-4">
                                            {occ.employee ? (
                                                <div className="text-sm">
                                                    <div className="font-medium text-slate-900">{occ.employee.name}</div>
                                                    <div className="text-xs text-slate-500">CPF: {occ.employee.cpf}</div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic">Geral</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-[300px] align-top py-4">
                                            <div className="font-medium text-slate-900 mb-1">{occ.title}</div>
                                            <div className="text-xs text-slate-500 line-clamp-2" title={occ.description}>
                                                {occ.description}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right pr-6 align-top py-4">
                                            {/* Only admins can delete */}
                                            {userRole === 'ADMIN' && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50">
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Excluir Ocorrência?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Esta ação não pode ser desfeita. A ocorrência será removida permanentemente.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleDelete(occ.id)}
                                                                className="bg-red-600 hover:bg-red-700"
                                                            >
                                                                Excluir
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
