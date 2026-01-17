"use client";


import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, User, Download, TrendingUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { NewEmployeeSheet } from "@/components/admin/NewEmployeeSheet";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Demographics } from "@/components/admin/Demographics";
import { ImportEmployeesDialog } from "@/components/admin/ImportEmployeesDialog";
import { deleteEmployee, deleteEmployeesBatch } from "@/app/actions";
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

interface EmployeesClientPageProps {
    initialEmployees: any[];
    situations: any[];
    roles: any[];
    companies?: any[];
    userRole: string | null;
}

export function EmployeesClientPage({ initialEmployees, situations, roles, companies = [], userRole }: EmployeesClientPageProps) {
    const [employees, setEmployees] = useState(initialEmployees);
    const [searchTerm, setSearchTerm] = useState("");
    const [situationFilter, setSituationFilter] = useState("all");
    const [allocationFilter, setAllocationFilter] = useState("all");
    const [companyFilter, setCompanyFilter] = useState("all"); // Added company filter state
    const [currentTab, setCurrentTab] = useState("list");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const router = useRouter();

    async function handleDelete(id: string) {
        const result = await deleteEmployee(id);
        if (result?.error) {
            toast.error(result.error);
        } else {
            toast.success("Colaborador excluído");
            router.refresh();
            // Optimistic update
            setEmployees(prev => prev.filter(e => e.id !== id));
        }
    }

    async function handleBatchDelete() {
        if (selectedIds.length === 0) return;

        const result = await deleteEmployeesBatch(selectedIds);
        if (result?.error) {
            toast.error(result.error);
        } else {
            toast.success(`${selectedIds.length} colaboradores excluídos.`);
            router.refresh();
            setEmployees(prev => prev.filter(e => !selectedIds.includes(e.id)));
            setSelectedIds([]);
        }
    }

    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredEmployees.map(e => e.id));
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelectOne = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(x => x !== id));
        }
    };


    const filteredEmployees = initialEmployees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (emp.cpf && emp.cpf.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (emp.role?.name && emp.role.name.toLowerCase().includes(searchTerm.toLowerCase()));

        let matchesSituation = true;
        if (situationFilter !== "all") {
            if (situationFilter === "Sem Situação") {
                matchesSituation = !emp.situation;
            } else {
                matchesSituation = emp.situation?.name === situationFilter;
            }
        }

        let matchesAllocation = true;
        if (allocationFilter !== "all") {
            const isAllocated = emp.assignments && emp.assignments.some((a: any) => !a.endDate);
            if (allocationFilter === "allocated") {
                matchesAllocation = isAllocated;
            } else if (allocationFilter === "unallocated") {
                matchesAllocation = !isAllocated;
            }
        }

        let matchesCompany = true;
        if (companyFilter !== "all") {
            if (companyFilter === "no_company") {
                matchesCompany = !emp.companyId;
            } else {
                matchesCompany = emp.companyId === companyFilter;
            }
        }

        return matchesSearch && matchesSituation && matchesAllocation && matchesCompany;
    });

    const handleExport = () => {
        const dataToExport = initialEmployees.map(emp => {
            const activeAssignment = emp.assignments && emp.assignments.find((a: any) => !a.endDate);

            return {
                "Nome": emp.name,
                "CPF": emp.cpf,
                "Empresa": emp.company?.name || "-",
                "Cargo": emp.role?.name || "N/A",
                "Situação": emp.situation?.name || emp.status || "N/A",
                "Alocação": activeAssignment ? "Alocado" : "Reserva",
                "Posto Atual": activeAssignment ? activeAssignment.posto?.client?.name : "-",

                "Data Admissão": emp.admissionDate ? format(new Date(emp.admissionDate), 'dd/MM/yyyy') : "-",
                "Data Nascimento": emp.birthDate ? format(new Date(emp.birthDate), 'dd/MM/yyyy') : "-",
                "Gênero": emp.gender || "-",
                "Tipo": emp.type || "-",
                "Carga Horária": emp.workload || 220,

                // Financeiro
                "Salário Base": emp.salary || 0,
                "Insalubridade": emp.insalubridade || 0,
                "Periculosidade": emp.periculosidade || 0,
                "Gratificação": emp.gratificacao || 0,
                "Outros Adicionais": emp.outrosAdicionais || 0,

                // Benefícios
                "Vale Alimentação": emp.valeAlimentacao || 0,
                "Vale Transporte": emp.valeTransporte || 0,

                "Contato": emp.phone || "-",
                "Email": emp.email || "-"
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);

        const wscols = [
            { wch: 30 }, // Nome
            { wch: 15 }, // CPF
            { wch: 20 }, // Empresa
            { wch: 20 }, // Cargo
            { wch: 15 }, // Situação
            { wch: 10 }, // Alocação
            { wch: 12 }, // Admissão
            { wch: 10 }, // Tipo
            { wch: 8 },  // Carga
            { wch: 12 }, // Salário
            { wch: 12 }, // Insalubridade
            { wch: 12 }, // Periculosidade
            { wch: 12 }, // Gratificação
            { wch: 12 }, // Outros
            { wch: 12 }, // VA
            { wch: 12 }, // VT
            { wch: 15 }, // Contato
            { wch: 25 }  // Email
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");

        const fileName = `Colaboradores_Completo_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-[0.3em] mb-2">
                        Workforce Hub
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Colaboradores</h1>
                    <p className="text-slate-500 font-medium italic">Gestão centralizada do quadro de funcionários</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="gap-2 border-slate-200 text-slate-600 hover:text-primary hover:bg-slate-50" onClick={handleExport}>
                        <Download className="w-4 h-4" />
                        Exportar Excel
                    </Button>
                    <ImportEmployeesDialog />
                    <NewEmployeeSheet situations={situations} roles={roles} companies={companies} />
                </div>
            </div>

            <Tabs defaultValue="list" className="w-full" onValueChange={setCurrentTab}>
                <div className="flex items-center justify-between mb-4">
                    <TabsList className="bg-white/50 border border-white shadow-sm">
                        <TabsTrigger value="list" className="text-xs font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                            Lista
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="text-xs font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                            <TrendingUp className="w-3 h-3 mr-1.5" /> Análise
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="list" className="space-y-6">
                    {/* Content Card */}
                    <Card className="border-none shadow-premium overflow-hidden bg-white/50 backdrop-blur-md">
                        <CardHeader className="bg-white border-b border-slate-100 p-6">
                            <div className="flex flex-col gap-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex flex-col gap-1">
                                        <CardTitle className="text-xl font-black text-slate-800">Quadro de Funcionários</CardTitle>
                                        <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Total: {filteredEmployees.length} Exibidos</CardDescription>
                                    </div>

                                    {selectedIds.length > 0 && (
                                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={handleBatchDelete}
                                                className="gap-2 shadow-sm font-bold"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Excluir ({selectedIds.length}) Selecionados
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 w-full flex-wrap md:flex-nowrap">
                                    <div className="flex gap-2 flex-wrap">
                                        {/* Company Filter */}
                                        <div className="relative">
                                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <select
                                                className="h-10 pl-9 pr-4 rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-600 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none cursor-pointer hover:bg-slate-50 border"
                                                value={companyFilter}
                                                onChange={(e) => setCompanyFilter(e.target.value)}
                                            >
                                                <option value="all">Empresa (Todas)</option>
                                                {companies.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                                <option value="no_company">Sem Empresa</option>
                                            </select>
                                        </div>

                                        <div className="relative">
                                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <select
                                                className="h-10 pl-9 pr-4 rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-600 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none cursor-pointer hover:bg-slate-50 border"
                                                value={allocationFilter}
                                                onChange={(e) => setAllocationFilter(e.target.value)}
                                            >
                                                <option value="all">Alocação (Todos)</option>
                                                <option value="allocated">Alocados em Posto</option>
                                                <option value="unallocated">Sem Alocação (Reserva)</option>
                                            </select>
                                        </div>
                                        <div className="relative">
                                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <select
                                                className="h-10 pl-9 pr-4 rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-600 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none cursor-pointer hover:bg-slate-50 border"
                                                value={situationFilter}
                                                onChange={(e) => setSituationFilter(e.target.value)}
                                            >
                                                <option value="all">Situação (Todas)</option>
                                                {situations.map(s => (
                                                    <option key={s.id} value={s.name}>{s.name}</option>
                                                ))}
                                                <option value="Sem Situação">Sem Situação</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="relative flex-1 group min-w-[200px]">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                        <Input
                                            placeholder="Pesquisar por nome ou CPF..."
                                            className="pl-10 h-10 rounded-xl border-slate-200 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/50 hover:bg-transparent">
                                        <TableHead className="w-[40px] pl-8">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer accent-primary"
                                                checked={filteredEmployees.length > 0 && selectedIds.length === filteredEmployees.length}
                                                onChange={(e) => toggleSelectAll(e.target.checked)}
                                            />
                                        </TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider pl-4 py-4">Nome do Colaborador</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider">Empresa</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider">Cargo / Função</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider">Situação Atual</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider">Alocação</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider">Posto Atual</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider text-right pr-8">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredEmployees.map((emp) => {
                                        const activeAssignment = emp.assignments && emp.assignments.find((a: any) => !a.endDate);
                                        const isSelected = selectedIds.includes(emp.id);

                                        return (
                                            <TableRow key={emp.id} className={`group hover:bg-slate-50 transition-colors ${isSelected ? "bg-slate-50/80" : ""}`}>
                                                <TableCell className="pl-8 py-5 w-[40px]">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer accent-primary"
                                                        checked={isSelected}
                                                        onChange={(e) => toggleSelectOne(emp.id, e.target.checked)}
                                                    />
                                                </TableCell>
                                                <TableCell className="pl-4 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-white flex items-center justify-center text-slate-400 font-black shadow-inner shadow-black/5 group-hover:rotate-3 transition-transform">
                                                            {emp.name.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-slate-900 leading-tight">{emp.name}</span>
                                                            <span className="text-[11px] text-slate-400 font-bold tracking-tight">{emp.cpf}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs font-bold text-slate-500">{emp.company?.name || '-'}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm font-bold text-slate-700">{emp.role?.name || 'N/A'}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: emp.situation?.color || '#94a3b8' }} />
                                                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                                                            {emp.situation?.name || emp.status}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {activeAssignment ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider border border-emerald-100">
                                                            Alocado
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider border border-amber-100">
                                                            Reserva
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="max-w-[200px] whitespace-normal break-words">
                                                    <span className="text-xs font-semibold text-slate-600 leading-tight block">
                                                        {activeAssignment?.posto?.client?.name || "-"}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    <Link href={`/admin/employees/${emp.id}`}>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-slate-200 text-slate-400 hover:text-primary transition-all">
                                                            <User className="w-4 h-4" />
                                                        </Button>
                                                    </Link>

                                                    {/* Only admins can delete */}
                                                    {userRole === 'ADMIN' && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all ml-1">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Excluir Colaborador?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Esta ação removerá permanentemente o colaborador. Se ele tiver histórico importante, considere apenas mudar a situação para "Desligado".
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => handleDelete(emp.id)}
                                                                        className="bg-red-600 hover:bg-red-700"
                                                                    >
                                                                        Excluir Permanentemente
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {filteredEmployees.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                                                Nenhum colaborador encontrado com os filtros atuais.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="analytics">
                    <Demographics employees={employees} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
