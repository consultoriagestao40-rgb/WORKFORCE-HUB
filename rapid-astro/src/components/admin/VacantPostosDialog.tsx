"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserX, TrendingDown, ArrowRight, Download, Search, Filter } from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown } from "lucide-react";

interface VacantPostosDialogProps {
    vagoDaysCount: number;
    glosaProjetada: number;
    vacantPostos: {
        id: string;
        role: { name: string };
        schedule: string;
        billingValue: number;
        client: { id: string; name: string; company?: { id: string; name: string } | null };
        createdAt: string | Date;
        assignments?: any[];
    }[];
    companies?: { id: string; name: string }[];
}

export function VacantPostosDialog({ vagoDaysCount, glosaProjetada, vacantPostos, companies = [] }: VacantPostosDialogProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [companyFilter, setCompanyFilter] = useState("all");

    const availableClients = useMemo(() => {
        return Array.from(new Set(vacantPostos.map(p => p.client.id)))
            .map(id => vacantPostos.find(p => p.client.id === id)?.client)
            .filter(Boolean)
            .sort((a, b) => a!.name.localeCompare(b!.name));
    }, [vacantPostos]);

    const [selectedClients, setSelectedClients] = useState<string[]>(() =>
        availableClients.map(c => c!.id)
    );

    const toggleClient = (clientId: string) => {
        setSelectedClients(prev =>
            prev.includes(clientId)
                ? prev.filter(id => id !== clientId)
                : [...prev, clientId]
        );
    };

    const selectAllClients = () => {
        setSelectedClients(availableClients.map(c => c!.id));
    };

    const deselectAllClients = () => {
        setSelectedClients([]);
    };

    const filteredPostos = vacantPostos.filter(posto => {
        const matchesSearch = posto.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            posto.role.name.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesCompany = true;
        if (companyFilter !== "all") {
            if (companyFilter === "unlinked") {
                matchesCompany = !posto.client.company?.id;
            } else {
                matchesCompany = posto.client.company?.id === companyFilter;
            }
        }

        const matchesClient = selectedClients.includes(posto.client.id);

        return matchesSearch && matchesCompany && matchesClient;
    });

    const vacantPostosDetails = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        return filteredPostos.map(posto => {
            const endedAssignments = (posto.assignments || []).filter((a: any) => a.endDate);
            let vacantSinceDate: Date;
            let isNeverOccupied = false;

            if (endedAssignments.length > 0) {
                const sorted = [...endedAssignments].sort((a: any, b: any) => 
                    new Date(b.endDate!).getTime() - new Date(a.endDate!).getTime()
                );
                vacantSinceDate = new Date(sorted[0].endDate!);
            } else {
                vacantSinceDate = new Date(posto.createdAt);
                isNeverOccupied = true;
            }

            // Dias de vacância calculados a partir da data real de vacância (sem limitar ao início do mês)
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
    }, [filteredPostos]);

    const totals = useMemo(() => {
        return vacantPostosDetails.reduce(
            (acc, p) => {
                acc.billingValue += p.billingValue || 0;
                acc.diffDays += p.diffDays || 0;
                return acc;
            },
            { billingValue: 0, diffDays: 0 }
        );
    }, [vacantPostosDetails]);

    const handleExport = () => {
        const dataToExport = vacantPostosDetails.map(posto => ({
            "Empresa": posto.client.company?.name || "-",
            "Cliente": posto.client.name,
            "Cargo/Função": posto.role?.name || "N/A",
            "Escala": posto.schedule,
            "Faturamento (Perda)": posto.billingValue,
            "Vago Desde": posto.isNeverOccupied ? "Nunca ocupado" : posto.vacantSinceDate.toLocaleDateString("pt-BR"),
            "Dias Vagos": posto.diffDays,
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);

        // Adjust column widths
        const wscols = [
            { wch: 25 }, // Empresa
            { wch: 30 }, // Cliente
            { wch: 20 }, // Cargo
            { wch: 15 }, // Escala
            { wch: 20 }, // Faturamento
            { wch: 15 }, // Vago Desde
            { wch: 12 }, // Dias Vagos
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Postos Vagos");
        const fileName = `Postos_Vagos_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };


    return (
        <Dialog>
            <DialogTrigger asChild>
                <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50 overflow-hidden relative group cursor-pointer hover:scale-[1.02] transition-transform">
                    <CardHeader className="pb-2 space-y-0">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dias de Vacância Total</CardDescription>
                        <CardTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            {vagoDaysCount} dias
                            <UserX className="w-5 h-5 text-amber-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            <TrendingDown className="w-3 h-3 text-red-500" />
                            Glosa: R$ {glosaProjetada.toFixed(2)}
                        </div>
                    </CardContent>
                </Card>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[1200px] w-full max-h-[85vh] overflow-hidden flex flex-col p-6">
                <DialogHeader className="flex flex-col gap-4 pr-12 shrink-0">
                    <div className="flex flex-row items-center justify-between w-full">
                        <div>
                            <DialogTitle>Postos Vagos</DialogTitle>
                            <DialogDescription>
                                Lista de postos atualmente sem titular alocado.
                                Total de vagas abertas: <strong>{filteredPostos.length}</strong>
                            </DialogDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 shrink-0">
                            <Download className="w-4 h-4" />
                            Exportar Excel
                        </Button>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-3 w-full">
                        <div className="relative w-full md:w-auto">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <select
                                className="h-9 pl-8 pr-4 w-full md:w-[200px] rounded-md border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer"
                                value={companyFilter}
                                onChange={(e) => setCompanyFilter(e.target.value)}
                            >
                                <option value="all">Todas as Empresas</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                                <option value="unlinked">Sem Empresa</option>
                            </select>
                        </div>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 px-3 w-full md:w-[230px] justify-between text-xs font-medium border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <Filter className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span className="truncate">
                                            {selectedClients.length === availableClients.length
                                                ? "Todos os Clientes"
                                                : selectedClients.length === 0
                                                ? "Nenhum Cliente"
                                                : `${selectedClients.length} Clientes Selecionados`
                                            }
                                        </span>
                                    </div>
                                    <ChevronDown className="w-3.5 h-3.5 ml-1 text-slate-400 shrink-0" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[250px] p-2 text-xs" align="start">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                                    <span className="font-bold text-slate-700">Filtrar Clientes</span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={selectAllClients}
                                            className="text-[10px] text-blue-600 hover:underline font-semibold cursor-pointer"
                                        >
                                            Marcar Todos
                                        </button>
                                        <button
                                            type="button"
                                            onClick={deselectAllClients}
                                            className="text-[10px] text-red-600 hover:underline font-semibold cursor-pointer"
                                        >
                                            Desmarcar Todos
                                        </button>
                                    </div>
                                </div>
                                <ScrollArea className="h-[200px] pr-2">
                                    <div className="space-y-2">
                                        {availableClients.map(client => {
                                            const isChecked = selectedClients.includes(client!.id);
                                            return (
                                                <label
                                                    key={client!.id}
                                                    className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer select-none"
                                                >
                                                    <Checkbox
                                                        checked={isChecked}
                                                        onCheckedChange={() => toggleClient(client!.id)}
                                                    />
                                                    <span className="font-medium text-slate-600 truncate">{client!.name}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </PopoverContent>
                        </Popover>

                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <Input
                                placeholder="Buscar cliente ou cargo..."
                                className="pl-8 h-9 text-xs w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto mt-4 pr-1 min-h-0">
                    <div className="overflow-x-auto border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Empresa</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Cargo/Função</TableHead>
                                    <TableHead>Escala</TableHead>
                                    <TableHead>Faturamento (Perda)</TableHead>
                                    <TableHead>Vago Desde</TableHead>
                                    <TableHead className="text-right">Dias Vagos</TableHead>
                                    <TableHead className="text-right">Ação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {vacantPostosDetails.map((posto) => (
                                    <TableRow key={posto.id}>
                                        <TableCell>
                                            <span className="text-xs font-bold text-blue-600 uppercase">
                                                {posto.client.company?.name || '-'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-medium">{posto.client.name}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">{posto.role?.name || 'N/A'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs bg-slate-100 px-2 py-1 rounded font-medium text-slate-600">{posto.schedule}</span>
                                        </TableCell>
                                        <TableCell className="text-red-500 font-bold">
                                            R$ {posto.billingValue.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-slate-600 text-xs">
                                            {posto.isNeverOccupied 
                                                ? "Nunca ocupado" 
                                                : posto.vacantSinceDate.toLocaleDateString("pt-BR")
                                            }
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-slate-900">
                                            {posto.diffDays} {posto.diffDays === 1 ? 'dia' : 'dias'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Link href={`/admin/clients/${posto.client.id}`}>
                                                <div className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider">
                                                    Alocar <ArrowRight className="w-3 h-3" />
                                                </div>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {vacantPostosDetails.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                                            Nenhum posto vago encontrado com os filtros atuais.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {/* Summary Row */}
                                {vacantPostosDetails.length > 0 && (
                                    <TableRow className="bg-slate-50 font-bold hover:bg-slate-50 border-t-2 border-slate-200">
                                        <TableCell colSpan={2} className="text-slate-900">Total</TableCell>
                                        <TableCell colSpan={2}></TableCell>
                                        <TableCell className="text-red-600">
                                            R$ {totals.billingValue.toFixed(2)}
                                        </TableCell>
                                        <TableCell></TableCell> {/* Vago Desde */}
                                        <TableCell className="text-slate-950 text-right">
                                            {totals.diffDays} dias
                                        </TableCell>
                                        <TableCell></TableCell> {/* Ação */}
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
