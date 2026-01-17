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
import { useState } from "react";
import { Input } from "@/components/ui/input";

interface VacantPostosDialogProps {
    vagoDaysCount: number;
    glosaProjetada: number;
    vacantPostos: {
        id: string;
        role: { name: string };
        schedule: string;
        billingValue: number;
        client: { id: string; name: string; company?: { id: string; name: string } | null };
    }[];
    companies?: { id: string; name: string }[];
}

export function VacantPostosDialog({ vagoDaysCount, glosaProjetada, vacantPostos, companies = [] }: VacantPostosDialogProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [companyFilter, setCompanyFilter] = useState("all");
    const [clientFilter, setClientFilter] = useState("all");

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

        let matchesClient = true;
        if (clientFilter !== "all") {
            matchesClient = posto.client.id === clientFilter;
        }

        return matchesSearch && matchesCompany && matchesClient;
    });

    const handleExport = () => {
        const dataToExport = filteredPostos.map(posto => ({
            "Empresa": posto.client.company?.name || "-",
            "Cliente": posto.client.name,
            "Cargo/Função": posto.role?.name || "N/A",
            "Escala": posto.schedule,
            "Faturamento (Perda)": posto.billingValue,
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
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Postos Vagos");
        const fileName = `Postos_Vagos_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // Extract unique clients from current filtered set or all? 
    // Usually better to show valid options. For simplicity, all clients involved in vacant postos.
    const availableClients = Array.from(new Set(vacantPostos.map(p => p.client.id)))
        .map(id => vacantPostos.find(p => p.client.id === id)?.client)
        .filter(Boolean)
        .sort((a, b) => a!.name.localeCompare(b!.name));


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
            <DialogContent className="sm:max-w-[1200px] w-full max-h-[80vh] overflow-y-auto">
                <DialogHeader className="flex flex-col gap-4 pr-8">
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

                        <div className="relative w-full md:w-auto">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <select
                                className="h-9 pl-8 pr-4 w-full md:w-[200px] rounded-md border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer"
                                value={clientFilter}
                                onChange={(e) => setClientFilter(e.target.value)}
                            >
                                <option value="all">Todos os Clientes</option>
                                {availableClients.map(c => (
                                    <option key={c!.id} value={c!.id}>{c!.name}</option>
                                ))}
                            </select>
                        </div>

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

                <div className="mt-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Empresa</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Cargo/Função</TableHead>
                                <TableHead>Escala</TableHead>
                                <TableHead>Faturamento (Perda)</TableHead>
                                <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPostos.map((posto) => (
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
                                    <TableCell className="text-right">
                                        <Link href={`/admin/clients/${posto.client.id}`}>
                                            <div className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider">
                                                Alocar <ArrowRight className="w-3 h-3" />
                                            </div>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredPostos.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                        Nenhum posto vago encontrado com os filtros atuais.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}
