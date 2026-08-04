"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building, Search, Filter, UserX, TrendingDown } from "lucide-react";
import Link from "next/link";
import { NewClientSheet } from "@/components/admin/NewClientSheet";
import { EditClientSheet } from "@/components/admin/EditClientSheet";
import { DeleteClientButton } from "@/components/admin/DeleteClientButton";
import { VacantPostosDialog } from "@/components/admin/VacantPostosDialog";

interface ClientsListProps {
    initialClients: any[];
    companies: any[];
    userRole: string | null;
    vagoDaysCount: number;
    glosaProjetada: number;
    vacantPostos: any[];
    systemUsers: any[];
}

export function ClientsList({
    initialClients,
    companies,
    userRole,
    vagoDaysCount,
    glosaProjetada,
    vacantPostos,
    systemUsers
}: ClientsListProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [companyFilter, setCompanyFilter] = useState("all");
    const [clientFilter, setClientFilter] = useState("all");
    const [accountManagerFilter, setAccountManagerFilter] = useState("all");

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

        let matchesManager = true;
        if (accountManagerFilter !== "all") {
            if (accountManagerFilter === "unassigned") {
                matchesManager = !client.accountManagerId;
            } else {
                matchesManager = client.accountManagerId === accountManagerFilter;
            }
        }

        return matchesSearch && matchesCompany && matchesClient && matchesManager;
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">Clientes / Sites</h1>
                <NewClientSheet companies={companies} systemUsers={systemUsers} />
            </div>

            {/* TOTALIZERS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50 overflow-hidden relative">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total de Clientes</CardDescription>
                        <CardTitle className="text-2xl font-black text-slate-900">
                            {initialClients.length}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-slate-500 font-medium">
                            {initialClients.filter(c => c.companyId).length} Vinculados a Empresas
                        </p>
                    </CardContent>
                </Card>

                <VacantPostosDialog
                    vagoDaysCount={vagoDaysCount}
                    glosaProjetada={glosaProjetada}
                    vacantPostos={vacantPostos}
                    companies={companies}
                />

                <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50 overflow-hidden relative">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Perda de Receita (Glosa Global)</CardDescription>
                        <CardTitle className="text-2xl font-black text-amber-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(glosaProjetada)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-slate-500 font-medium">
                            Projeção acumulada no mês
                        </p>
                    </CardContent>
                </Card>
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

                        {/* Account Manager Filter */}
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                className="h-10 pl-9 pr-4 rounded-md border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer"
                                value={accountManagerFilter}
                                onChange={(e) => setAccountManagerFilter(e.target.value)}
                            >
                                <option value="all">Todos os Gerentes</option>
                                {systemUsers.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                                <option value="unassigned">Sem Gerente</option>
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
                                <TableHead>Gerente de Conta</TableHead>
                                <TableHead>Postos</TableHead>
                                <TableHead>Monitoramento</TableHead>
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
                                            {client.isActive === false && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase">
                                                    Encerrado
                                                </span>
                                            )}
                                            <EditClientSheet client={client} companies={companies} systemUsers={systemUsers} />
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-[450px] whitespace-normal break-words text-sm leading-relaxed text-muted-foreground">
                                        {client.address}
                                    </TableCell>
                                    <TableCell className="font-bold text-slate-700">
                                        {client.accountManager?.name || (
                                            <span className="text-slate-400 italic font-medium">Sem gerente</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{client._count.postos} Postos</TableCell>
                                    <TableCell>
                                        {client.monitorInOperations !== false ? (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                Mesa Ativa
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                Desativado
                                            </span>
                                        )}
                                    </TableCell>
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
