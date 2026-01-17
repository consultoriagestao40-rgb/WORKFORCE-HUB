"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building, Search, Filter } from "lucide-react";
import Link from "next/link";
import { NewClientSheet } from "@/components/admin/NewClientSheet";
import { EditClientSheet } from "@/components/admin/EditClientSheet";
import { DeleteClientButton } from "@/components/admin/DeleteClientButton";

interface ClientsListProps {
    initialClients: any[];
    companies: any[];
    userRole: string | null;
}

export function ClientsList({ initialClients, companies, userRole }: ClientsListProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [companyFilter, setCompanyFilter] = useState("all");
    const [clientFilter, setClientFilter] = useState("all");

    const filteredClients = initialClients.filter(client => {
        const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.address?.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesCompany = true;
        if (companyFilter !== "all") {
            if (companyFilter === "unlinked") {
                matchesCompany = !client.companyId;
            } else {
                matchesCompany = client.companyId === companyFilter;
            }
        }

        let matchesClient = true;
        if (clientFilter !== "all") {
            matchesClient = client.id === clientFilter;
        }

        return matchesSearch && matchesCompany && matchesClient;
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">Clientes / Sites</h1>
                <NewClientSheet companies={companies} />
            </div>

            <Card>
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle>Sites Ativos</CardTitle>

                    <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                        {/* Company Filter */}
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                className="h-10 pl-9 pr-4 rounded-md border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer"
                                value={companyFilter}
                                onChange={(e) => setCompanyFilter(e.target.value)}
                            >
                                <option value="all">Todas as Empresas</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                                <option value="unlinked">Não Vinculadas</option>
                            </select>
                        </div>

                        {/* Client Filter (Dropdown) */}
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                className="h-10 pl-9 pr-4 rounded-md border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer max-w-[200px]"
                                value={clientFilter}
                                onChange={(e) => setClientFilter(e.target.value)}
                            >
                                <option value="all">Todos os Clientes</option>
                                {initialClients.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Buscar nome ou endereço..."
                                className="pl-10 h-10 w-full md:w-[250px]"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Empresa (Contratada)</TableHead>
                                <TableHead>Nome do Site (Cliente)</TableHead>
                                <TableHead>Endereço</TableHead>
                                <TableHead>Postos</TableHead>
                                <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredClients.map((client) => (
                                <TableRow key={client.id}>
                                    <TableCell>
                                        <div className="text-xs font-bold text-blue-600 uppercase">
                                            {client.company?.name || 'Não vinculada'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2 group">
                                            <Building className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                            <span className="font-semibold">{client.name}</span>
                                            <EditClientSheet client={client} companies={companies} />
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-[450px] whitespace-normal break-words text-sm leading-relaxed text-muted-foreground">
                                        {client.address}
                                    </TableCell>
                                    <TableCell>{client._count.postos} Postos</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link href={`/admin/clients/${client.id}`}>
                                                <Button variant="ghost" size="sm">Gerenciar Postos</Button>
                                            </Link>

                                            {userRole === 'ADMIN' && (
                                                <DeleteClientButton
                                                    clientId={client.id}
                                                    clientName={client.name}
                                                />
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredClients.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                        Nenhum cliente encontrado com os filtros selecionados.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
