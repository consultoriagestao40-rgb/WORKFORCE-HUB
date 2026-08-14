"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Building, 
    Building2, 
    Search, 
    Filter, 
    UserX, 
    TrendingDown, 
    MapPin, 
    Users, 
    UserCheck, 
    X, 
    ChevronRight, 
    Layers,
    ArrowUpRight,
    Briefcase
} from "lucide-react";
import Link from "next/link";
import { NewClientSheet } from "@/components/admin/NewClientSheet";
import { EditClientSheet } from "@/components/admin/EditClientSheet";
import { DeleteClientButton } from "@/components/admin/DeleteClientButton";
import { VacantPostosDialog } from "@/components/admin/VacantPostosDialog";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";

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

    const hasActiveFilters = searchTerm !== "" || companyFilter !== "all" || clientFilter !== "all" || accountManagerFilter !== "all";

    const clearFilters = () => {
        setSearchTerm("");
        setCompanyFilter("all");
        setClientFilter("all");
        setAccountManagerFilter("all");
    };

    const filteredClients = initialClients.filter(client => {
        const matchesSearch = 
            client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (client.address && client.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (client.company?.name && client.company.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (client.accountManager?.name && client.accountManager.name.toLowerCase().includes(searchTerm.toLowerCase()));

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

    const activeCount = initialClients.filter(c => c.isActive !== false).length;
    const linkedCount = initialClients.filter(c => c.companyId).length;

    const companyOptions: ComboboxOption[] = [
        { value: "all", label: "Todas as Empresas" },
        ...companies.map(c => ({ value: c.id, label: c.name })),
        { value: "unlinked", label: "Não Vinculadas" }
    ];

    const managerOptions: ComboboxOption[] = [
        { value: "all", label: "Todos os Gerentes" },
        ...systemUsers.map(u => ({ value: u.id, label: u.name })),
        { value: "unassigned", label: "Sem Gerente" }
    ];

    const clientOptions: ComboboxOption[] = [
        { value: "all", label: "Todos os Clientes" },
        ...[...initialClients]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(c => ({
                value: c.id,
                label: c.name,
                sublabel: c.company?.name || undefined
            }))
    ];

    return (
        <div className="space-y-6 pb-12">
            {/* Top Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 md:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
                <div className="relative z-10 space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-indigo-300 backdrop-blur-md mb-1 border border-white/10">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Gestão de Contratos & Sites</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight">Clientes & Postos</h1>
                    <p className="text-xs md:text-sm text-slate-300 max-w-xl">
                        Gerenciamento centralizado de contratos, locais de trabalho, alocações operacionais e inteligência de vacância.
                    </p>
                </div>

                <div className="relative z-10">
                    <NewClientSheet companies={companies} systemUsers={systemUsers} />
                </div>
            </div>

            {/* Quick KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border border-slate-200/80 shadow-sm bg-white rounded-3xl overflow-hidden hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total de Clientes</CardDescription>
                        <div className="w-9 h-9 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <Building className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <div className="flex items-baseline gap-2">
                            <CardTitle className="text-3xl font-black text-slate-900">
                                {initialClients.length}
                            </CardTitle>
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                {activeCount} ativos
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                            {linkedCount} vinculados a empresas contratadas
                        </p>
                    </CardContent>
                </Card>

                <VacantPostosDialog
                    vagoDaysCount={vagoDaysCount}
                    glosaProjetada={glosaProjetada}
                    vacantPostos={vacantPostos}
                    companies={companies}
                />

                <Card className="border border-slate-200/80 shadow-sm bg-white rounded-3xl overflow-hidden hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Perda de Receita (Glosa Global)</CardDescription>
                        <div className="w-9 h-9 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                            <TrendingDown className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <CardTitle className="text-3xl font-black text-amber-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(glosaProjetada)}
                        </CardTitle>
                        <p className="text-xs text-slate-500 font-medium">
                            Projeção financeira acumulada no mês atual
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Table Card */}
            <Card className="border border-slate-200/80 shadow-sm bg-white rounded-3xl overflow-hidden">
                {/* Header & Filter Toolbar */}
                <div className="p-5 md:p-6 border-b border-slate-100 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                                <Layers className="w-4 h-4" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Sites & Contratos Cadastrados</h2>
                                <p className="text-xs text-slate-500">
                                    Exibindo <strong className="text-slate-800">{filteredClients.length}</strong> de <strong className="text-slate-800">{initialClients.length}</strong> sites
                                </p>
                            </div>
                        </div>

                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl h-8 px-3 self-start sm:self-auto"
                            >
                                <X className="w-3.5 h-3.5 mr-1.5" />
                                Limpar Filtros
                            </Button>
                        )}
                    </div>

                    {/* Filter Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-1">
                        {/* Search Input (Takes 5 columns on large screen) */}
                        <div className="lg:col-span-5 relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por nome, endereço, contratada ou gerente..."
                                className="pl-10 pr-9 h-10 w-full rounded-xl border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-sm transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button 
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Company Filter (Takes 2 columns) */}
                        <div className="lg:col-span-2">
                            <Combobox
                                options={companyOptions}
                                value={companyFilter}
                                onChange={setCompanyFilter}
                                placeholder="Empresa..."
                                searchPlaceholder="Buscar empresa..."
                                icon={<Briefcase className="w-3.5 h-3.5" />}
                            />
                        </div>

                        {/* Account Manager Filter (Takes 2 columns) */}
                        <div className="lg:col-span-2">
                            <Combobox
                                options={managerOptions}
                                value={accountManagerFilter}
                                onChange={setAccountManagerFilter}
                                placeholder="Gerente..."
                                searchPlaceholder="Buscar gerente..."
                                icon={<UserCheck className="w-3.5 h-3.5" />}
                            />
                        </div>

                        {/* Client Filter (Takes 3 columns) */}
                        <div className="lg:col-span-3">
                            <Combobox
                                options={clientOptions}
                                value={clientFilter}
                                onChange={setClientFilter}
                                placeholder="Cliente / Contrato..."
                                searchPlaceholder="Buscar cliente / contrato..."
                                icon={<Building className="w-3.5 h-3.5" />}
                            />
                        </div>
                    </div>
                </div>

                {/* Table Content */}
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-slate-200/80">
                                    <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-500 py-3.5 pl-6">Empresa Contratada</TableHead>
                                    <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-500 py-3.5">Nome do Site (Cliente)</TableHead>
                                    <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-500 py-3.5">Endereço</TableHead>
                                    <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-500 py-3.5">Gerente de Conta</TableHead>
                                    <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-500 py-3.5 text-center">Postos</TableHead>
                                    <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-500 py-3.5">Status</TableHead>
                                    <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-500 py-3.5 text-right pr-6">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredClients.map((client) => (
                                    <TableRow 
                                        key={client.id} 
                                        className={`hover:bg-slate-50/80 transition-colors border-b border-slate-100 ${
                                            client.isActive === false ? "opacity-60 bg-slate-50/50" : ""
                                        }`}
                                    >
                                        {/* Empresa */}
                                        <TableCell className="pl-6 py-4">
                                            {client.company?.name ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60 uppercase">
                                                    <Briefcase className="w-3 h-3 text-blue-500" />
                                                    {client.company.name}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic font-medium">Não vinculada</span>
                                            )}
                                        </TableCell>

                                        {/* Nome do Site */}
                                        <TableCell className="py-4">
                                            <div className="flex items-center gap-2.5 group">
                                                <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-indigo-50 text-slate-500 group-hover:text-indigo-600 flex items-center justify-center transition-colors shrink-0">
                                                    <Building className="w-4 h-4" />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm">
                                                            {client.name}
                                                        </span>
                                                        {client.isActive === false && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 uppercase">
                                                                Encerrado
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <EditClientSheet client={client} companies={companies} systemUsers={systemUsers} />
                                            </div>
                                        </TableCell>

                                        {/* Endereço */}
                                        <TableCell className="py-4 max-w-[340px]">
                                            {client.address ? (
                                                <div className="flex items-start gap-1.5 text-xs text-slate-600 leading-relaxed">
                                                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                    <span className="line-clamp-2">{client.address}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Sem endereço cadastrado</span>
                                            )}
                                        </TableCell>

                                        {/* Gerente de Conta */}
                                        <TableCell className="py-4">
                                            {client.accountManager?.name ? (
                                                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 bg-slate-100/80 px-2.5 py-1 rounded-xl">
                                                    <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                                                    <span>{client.accountManager.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic font-medium">Sem gerente</span>
                                            )}
                                        </TableCell>

                                        {/* Postos */}
                                        <TableCell className="py-4 text-center">
                                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700">
                                                {client._count?.postos || 0} {client._count?.postos === 1 ? 'Posto' : 'Postos'}
                                            </span>
                                        </TableCell>

                                        {/* Monitoramento */}
                                        <TableCell className="py-4">
                                            {client.isActive === false ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                    Encerrado
                                                </span>
                                            ) : client.monitorInOperations !== false ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    Mesa Ativa
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                    Desativado
                                                </span>
                                            )}
                                        </TableCell>

                                        {/* Ações */}
                                        <TableCell className="pr-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link href={`/admin/clients/${client.id}`}>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        className="h-8 px-3 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all gap-1 shadow-sm"
                                                    >
                                                        <span>Postos</span>
                                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                                    </Button>
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
                                        <TableCell colSpan={7} className="text-center py-16">
                                            <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto text-slate-500">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                                                    <Building2 className="w-6 h-6" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="font-bold text-slate-800 text-sm">Nenhum cliente ou site encontrado</p>
                                                    <p className="text-xs text-slate-400">Tente ajustar ou limpar os filtros de busca para encontrar o que procura.</p>
                                                </div>
                                                {hasActiveFilters && (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={clearFilters}
                                                        className="rounded-xl text-xs font-bold h-8"
                                                    >
                                                        Limpar todos os filtros
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

