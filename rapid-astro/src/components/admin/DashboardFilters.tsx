"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, X, Search } from "lucide-react"; // Search added
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface DashboardFiltersProps {
    companies: { id: string; name: string }[];
    clients: { id: string; name: string; companyId: string | null }[];
}

export function DashboardFilters({ companies, clients }: DashboardFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [selectedCompany, setSelectedCompany] = useState<string>(searchParams.get("companyId") || "all");
    const [selectedClient, setSelectedClient] = useState<string>(searchParams.get("clientId") || "all");
    const [searchTerm, setSearchTerm] = useState<string>(searchParams.get("search") || "");

    // Reset client when company changes
    useEffect(() => {
        if (selectedCompany !== "all" && selectedClient !== "all") {
            const client = clients.find(c => c.id === selectedClient);
            if (client && client.companyId !== selectedCompany) {
                setSelectedClient("all");
            }
        }
    }, [selectedCompany, clients, selectedClient]);

    // Handle Search Debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (searchTerm) {
                params.set("search", searchTerm);
            } else {
                params.delete("search");
            }
            router.push(`?${params.toString()}`);
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleFilterChange = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        // Preserve other params is handled by new URLSearchParams(searchParams) but we need to ensure state sync?
        // Actually, the useEffect for search handles search param. 
        // We just need to ensure we don't lose it if we push immediately here.
        // But wait, the Update below uses `router.push` which might conflict with the debounce if typing fast + clicking? 
        // It's acceptable for now. Ideally we'd manage all params in one state or use URL as source of truth.
        // Let's rely on searchParams.toString() picking up the current visible URL params.

        if (value && value !== "all") {
            params.set(key, value);
        } else {
            params.delete(key);
        }

        // Reset dependent filter
        if (key === "companyId") {
            params.delete("clientId");
            setSelectedClient("all");
            setSelectedCompany(value);
        } else {
            setSelectedClient(value);
        }

        router.push(`?${params.toString()}`);
    };

    const clearFilters = () => {
        setSelectedCompany("all");
        setSelectedClient("all");
        setSearchTerm("");
        router.push("?");
    };

    const filteredClients = selectedCompany === "all"
        ? clients
        : clients.filter(c => c.companyId === selectedCompany);

    return (
        <div className="flex flex-col sm:flex-row gap-3 items-center bg-white p-4 rounded-2xl shadow-sm mb-6 border border-slate-100">
            <div className="flex items-center gap-2 text-slate-500 font-medium text-sm mr-auto">
                <Filter className="w-4 h-4" />
                <span className="uppercase tracking-wider text-xs font-bold">Filtros:</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <div className="relative w-full sm:w-[200px]">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Buscar Colaborador..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 h-9 text-xs bg-slate-50 border-slate-200"
                    />
                </div>

                <Select value={selectedCompany} onValueChange={(val) => handleFilterChange("companyId", val)}>
                    <SelectTrigger className="w-full sm:w-[200px] h-9 text-xs font-bold uppercase tracking-wider text-slate-600 bg-slate-50 border-slate-200">
                        <SelectValue placeholder="Todas as Empresas" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas as Empresas</SelectItem>
                        {companies.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={selectedClient} onValueChange={(val) => handleFilterChange("clientId", val)}>
                    <SelectTrigger className="w-full sm:w-[200px] h-9 text-xs font-bold uppercase tracking-wider text-slate-600 bg-slate-50 border-slate-200" disabled={filteredClients.length === 0}>
                        <SelectValue placeholder="Todos os Contratos" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Contratos</SelectItem>
                        {filteredClients.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {(selectedCompany !== "all" || selectedClient !== "all" || searchTerm) && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-slate-400 hover:text-red-500 hover:bg-red-50">
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
