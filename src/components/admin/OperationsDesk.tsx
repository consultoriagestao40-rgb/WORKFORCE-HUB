"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
    Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import {
    Calendar, ChevronLeft, ChevronRight, Search, UserCheck, UserX, 
    AlertTriangle, Clock, Coins, Download, RefreshCw, Eye, Edit
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface Company {
    id: string;
    name: string;
}

interface Client {
    id: string;
    name: string;
    companyId: string | null;
}

interface OperationsDeskProps {
    companies: Company[];
    clients: Client[];
}

interface AttendanceItem {
    id: string;
    postoId: string;
    role: string;
    schedule: string;
    startTime: string;
    endTime: string;
    billingValue: number;
    clientName: string;
    companyName: string;
    clientId: string;
    employee: {
        id: string;
        name: string;
    } | null;
    attendance: {
        status: string; // 'PRESENTE_PONTO' | 'PRESENTE_MANUAL' | 'AGUARDANDO' | 'FALTA'
        clockInTime: string | null;
        coveredBy: { id: string; name: string } | null;
        coverageType: string | null; // 'RESERVA_TECNICA' | 'DIARISTA'
        notes: string;
        isLate: boolean;
    };
}

interface ReservaEmployee {
    id: string;
    name: string;
}

export function OperationsDesk({ companies, clients }: OperationsDeskProps) {
    const [date, setDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
    const [companyFilter, setCompanyFilter] = useState<string>("all");
    const [clientFilter, setClientFilter] = useState<string>("all");
    const [search, setSearch] = useState<string>("");
    
    const [items, setItems] = useState<AttendanceItem[]>([]);
    const [reservaList, setReservaList] = useState<ReservaEmployee[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isPending, startTransition] = useTransition();

    // Dialog state for treating Absence
    const [openDialog, setOpenDialog] = useState<boolean>(false);
    const [selectedItem, setSelectedItem] = useState<AttendanceItem | null>(null);
    const [coverageType, setCoverageType] = useState<string>("RESERVA_TECNICA"); // 'RESERVA_TECNICA' | 'DIARISTA' | 'VAGO'
    const [selectedReservaId, setSelectedReservaId] = useState<string>("");
    const [diaristaCost, setDiaristaCost] = useState<string>("");
    const [notes, setNotes] = useState<string>("");
    const [actionLoading, setActionLoading] = useState<boolean>(false);

    // Fetch daily operations data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                date,
                companyId: companyFilter,
                clientId: clientFilter,
                search
            });
            const res = await fetch(`/api/admin/operations/attendance?${queryParams.toString()}`);
            const data = await res.json();
            
            if (data.success) {
                setItems(data.items);
                setReservaList(data.reservaTecnica);
            } else {
                toast.error("Erro ao carregar dados: " + (data.error || "Erro desconhecido"));
            }
        } catch (e) {
            toast.error("Erro de conexão ao carregar mesa de operações.");
        } finally {
            setLoading(false);
        }
    }, [date, companyFilter, clientFilter, search]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDateChange = (newDate: string) => {
        startTransition(() => {
            setDate(newDate);
        });
    };

    const handlePrevDay = () => {
        const prev = subDays(new Date(date + "T00:00:00"), 1);
        handleDateChange(format(prev, "yyyy-MM-dd"));
    };

    const handleNextDay = () => {
        const next = addDays(new Date(date + "T00:00:00"), 1);
        handleDateChange(format(next, "yyyy-MM-dd"));
    };

    // Calculate Summary Metrics
    const metrics = React.useMemo(() => {
        const total = items.length;
        let confirmed = 0;
        let lates = 0;
        let absences = 0;
        let coverages = 0;
        let glosasValue = 0;
        let diaristasCostValue = 0;

        items.forEach(item => {
            const att = item.attendance;
            if (att.status === "PRESENTE_PONTO" || att.status === "PRESENTE_MANUAL") {
                confirmed++;
            } else if (att.status === "FALTA") {
                if (att.coveredBy || att.coverageType) {
                    coverages++;
                    if (att.coverageType === "DIARISTA") {
                        diaristasCostValue += item.billingValue / 30; // Valor de custo estimado
                    }
                } else {
                    absences++;
                    glosasValue += item.billingValue / 30; // Perda de faturamento da glosa
                }
            } else if (att.status === "AGUARDANDO") {
                if (att.isLate) {
                    lates++;
                }
            }
        });

        return { total, confirmed, lates, absences, coverages, glosasValue, diaristasCostValue };
    }, [items]);

    // Handle Manual Presence Confirm
    const handleConfirmManual = async (item: AttendanceItem) => {
        try {
            const res = await fetch("/api/admin/operations/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "PRESENTE_MANUAL",
                    postoId: item.postoId,
                    date,
                    employeeId: item.employee?.id,
                    notes: "Confirmado manualmente pela mesa de operações"
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Presença manual confirmada para ${item.employee?.name || "Titular"}`);
                fetchData();
            } else {
                toast.error(data.error || "Erro ao salvar presença");
            }
        } catch (e) {
            toast.error("Erro ao salvar presença.");
        }
    };

    // Handle Manual Lack (Falta)
    const handleMarkAbsence = async (item: AttendanceItem) => {
        try {
            const res = await fetch("/api/admin/operations/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "FALTA",
                    postoId: item.postoId,
                    date,
                    employeeId: item.employee?.id,
                    notes: "Marcado falta pela mesa de operações"
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Falta registrada para o posto.");
                fetchData();
            } else {
                toast.error(data.error || "Erro ao registrar falta");
            }
        } catch (e) {
            toast.error("Erro ao registrar falta.");
        }
    };

    // Open Dialog to Treat Lack
    const handleOpenTreatDialog = (item: AttendanceItem) => {
        setSelectedItem(item);
        setCoverageType("RESERVA_TECNICA");
        setSelectedReservaId(reservaList[0]?.id || "");
        setDiaristaCost((item.billingValue / 30).toFixed(2));
        setNotes("");
        setOpenDialog(true);
    };

    // Save Coverage
    const handleSaveCoverage = async () => {
        if (!selectedItem) return;
        setActionLoading(true);

        try {
            let payload: any = {
                action: "COBERTURA",
                postoId: selectedItem.postoId,
                date,
                employeeId: selectedItem.employee?.id,
                coverageType,
                notes
            };

            if (coverageType === "RESERVA_TECNICA") {
                if (!selectedReservaId) {
                    toast.error("Por favor, selecione um funcionário da reserva técnica.");
                    setActionLoading(false);
                    return;
                }
                payload.coveredById = selectedReservaId;
            } else if (coverageType === "DIARISTA") {
                payload.diaristaCost = parseFloat(diaristaCost) || 0;
            } else if (coverageType === "VAGO") {
                payload.action = "COBERTURA";
                payload.coverageType = "VAGO";
            }

            const res = await fetch("/api/admin/operations/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                toast.success("Tratativa de escala salva com sucesso!");
                setOpenDialog(false);
                fetchData();
            } else {
                toast.error(data.error || "Erro ao salvar tratativa");
            }
        } catch (e) {
            toast.error("Erro de conexão ao salvar cobertura.");
        } finally {
            setActionLoading(false);
        }
    };

    // Export Daily Scale to Excel
    const handleExportExcel = () => {
        const exportData = items.map((item, index) => {
            const att = item.attendance;
            let statusText = "Aguardando Entrada";
            if (att.status === "PRESENTE_PONTO") statusText = `Presente (Ponto - ${att.clockInTime ? format(new Date(att.clockInTime), "HH:mm") : ""})`;
            else if (att.status === "PRESENTE_MANUAL") statusText = "Presente (Manual)";
            else if (att.status === "FALTA") {
                if (att.coveredBy) statusText = `Falta Coberta (Reserva: ${att.coveredBy.name})`;
                else if (att.coverageType === "DIARISTA") statusText = "Falta Coberta (Diarista)";
                else statusText = "Posto Vago (Sem Cobertura / Glosa)";
            } else if (att.status === "AGUARDANDO" && att.isLate) {
                statusText = "Atrasado (Pendente)";
            }

            return {
                "Nº": index + 1,
                "Cliente": item.clientName,
                "Empresa": item.companyName,
                "Cargo/Função": item.role,
                "Escala": item.schedule,
                "Horário": `${item.startTime} - ${item.endTime}`,
                "Faturamento Diário": (item.billingValue / 30).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                "Titular do Posto": item.employee?.name || "Vaga em Aberto",
                "Status de Presença": statusText,
                "Observação": att.notes || "-"
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);

        // Adjust column widths
        ws["!cols"] = [
            { wch: 5 },   // Nº
            { wch: 25 },  // Cliente
            { wch: 20 },  // Empresa
            { wch: 20 },  // Cargo
            { wch: 12 },  // Escala
            { wch: 15 },  // Horário
            { wch: 18 },  // Faturamento
            { wch: 25 },  // Titular
            { wch: 35 },  // Status
            { wch: 30 }   // Observação
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Mesa de Operação");
        XLSX.writeFile(wb, `Mesa_Operacoes_${date}.xlsx`);
    };

    // Filtered clients list based on selected company
    const filteredClients = React.useMemo(() => {
        if (companyFilter === "all") return clients;
        return clients.filter(c => c.companyId === companyFilter);
    }, [companyFilter, clients]);

    return (
        <div className="space-y-6">
            {/* Header Control */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Clock className="w-8 h-8 text-primary" /> Mesa de Operações Diária
                    </h1>
                    <p className="text-slate-500 font-medium">Controle de efetivo, batidas de ponto e tratativa de coberturas em tempo real.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Date Navigation */}
                    <div className="flex items-center bg-white rounded-xl shadow-premium border border-slate-200/50 p-1">
                        <Button variant="ghost" size="icon" onClick={handlePrevDay} className="h-8 w-8 rounded-lg">
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        
                        <div className="flex items-center gap-1.5 px-3">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <input 
                                type="date" 
                                value={date} 
                                onChange={(e) => handleDateChange(e.target.value)}
                                className="border-none outline-none font-bold text-xs text-slate-700 bg-transparent cursor-pointer"
                            />
                        </div>

                        <Button variant="ghost" size="icon" onClick={handleNextDay} className="h-8 w-8 rounded-lg">
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>

                    <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5 h-10 shadow-premium border-slate-200">
                        <Download className="w-4 h-4" /> Exportar Planilha
                    </Button>

                    <Button variant="ghost" size="icon" onClick={fetchData} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                        <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Metrics Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="border-none shadow-premium bg-gradient-to-br from-indigo-900 to-slate-950 text-white">
                    <CardHeader className="pb-1 p-4">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-indigo-200/70">Total de Postos Ativos</CardDescription>
                        <CardTitle className="text-3xl font-black">{metrics.total}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-1">
                        <p className="text-[9px] text-indigo-200 font-bold uppercase tracking-wider">Escala linear diária completa</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-premium bg-white">
                    <CardHeader className="pb-1 p-4">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Presença Confirmada</CardDescription>
                        <CardTitle className="text-3xl font-black text-emerald-600 flex items-center justify-between">
                            <span>{metrics.confirmed}</span>
                            <UserCheck className="w-6 h-6 text-emerald-100 bg-emerald-50 p-1 rounded-lg" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-1">
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                            {metrics.total > 0 ? ((metrics.confirmed / metrics.total) * 100).toFixed(0) : 0}% de presença confirmada
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-premium bg-white">
                    <CardHeader className="pb-1 p-4">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Postos Atrasados</CardDescription>
                        <CardTitle className="text-3xl font-black text-amber-600 flex items-center justify-between">
                            <span>{metrics.lates}</span>
                            <Clock className="w-6 h-6 text-amber-100 bg-amber-50 p-1 rounded-lg" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-1">
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Turno iniciado sem ponto batido</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-premium bg-white">
                    <CardHeader className="pb-1 p-4">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Postos com Cobertura</CardDescription>
                        <CardTitle className="text-3xl font-black text-blue-600 flex items-center justify-between">
                            <span>{metrics.coverages}</span>
                            <RefreshCw className="w-6 h-6 text-blue-100 bg-blue-50 p-1 rounded-lg" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-1">
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Coberto por Reserva ou Diarista</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-premium bg-white">
                    <CardHeader className="pb-1 p-4">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Faltas Sem Cobertura (Glosa)</CardDescription>
                        <CardTitle className="text-3xl font-black text-red-600 flex items-center justify-between">
                            <span>{metrics.absences}</span>
                            <UserX className="w-6 h-6 text-red-100 bg-red-50 p-1 rounded-lg" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-1">
                        <div className="flex items-center justify-between text-[9px] text-red-500 font-extrabold uppercase tracking-wider">
                            <span>Perda de Fat.:</span>
                            <span>{metrics.glosasValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Section */}
            <Card className="border-none shadow-premium bg-white p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="Buscar cliente ou cargo..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-10 text-xs border-slate-200"
                        />
                    </div>

                    <select
                        value={companyFilter}
                        onChange={(e) => {
                            setCompanyFilter(e.target.value);
                            setClientFilter("all");
                        }}
                        className="h-10 rounded-md border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer"
                    >
                        <option value="all">Todas as Empresas</option>
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>

                    <select
                        value={clientFilter}
                        onChange={(e) => setClientFilter(e.target.value)}
                        className="h-10 rounded-md border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer"
                    >
                        <option value="all">Todos os Clientes / Contratos</option>
                        {filteredClients.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>

                    <div className="flex items-center justify-end text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Atualizado às: {format(new Date(), "HH:mm:ss")}
                    </div>
                </div>
            </Card>

            {/* Main Linear operations table */}
            <Card className="border-none shadow-premium bg-white overflow-hidden">
                <div className="w-full overflow-x-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                            <span className="text-xs text-slate-500 font-semibold">Carregando painel de escala...</span>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="font-bold text-slate-800">Contrato / Cliente</TableHead>
                                    <TableHead className="font-bold text-slate-800">Cargo</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-center">Horário</TableHead>
                                    <TableHead className="font-bold text-slate-800">Titular do Posto</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-right">Faturamento Diário</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-center">Status de Presença</TableHead>
                                    <TableHead className="font-bold text-slate-800 text-right pr-6">Ações de Tratativa</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item) => {
                                    const att = item.attendance;
                                    let rowBgClass = "";
                                    let statusBadge = null;

                                    if (att.status === "PRESENTE_PONTO") {
                                        statusBadge = (
                                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 font-bold">
                                                ● Ponto ({att.clockInTime ? format(new Date(att.clockInTime), "HH:mm") : ""})
                                            </Badge>
                                        );
                                    } else if (att.status === "PRESENTE_MANUAL") {
                                        statusBadge = (
                                            <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-50 font-black">
                                                ● Confirmado Manual
                                            </Badge>
                                        );
                                    } else if (att.status === "FALTA") {
                                        if (att.coveredBy) {
                                            statusBadge = (
                                                <Badge className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50 font-bold">
                                                    ● Coberto por Reserva: {att.coveredBy.name}
                                                </Badge>
                                            );
                                        } else if (att.coverageType === "DIARISTA") {
                                            statusBadge = (
                                                <Badge className="bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-50 font-bold">
                                                    ● Coberto por Diarista
                                                </Badge>
                                            );
                                        } else if (att.coverageType === "VAGO") {
                                            statusBadge = (
                                                <Badge className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100 font-bold">
                                                    ● Posto Vago (Glosa Confirmada)
                                                </Badge>
                                            );
                                        } else {
                                            rowBgClass = "bg-red-50/20";
                                            statusBadge = (
                                                <Badge className="bg-red-50 text-red-700 border-red-100 hover:bg-red-50 font-black animate-pulse">
                                                    ▲ Falta Não Tratada
                                                </Badge>
                                            );
                                        }
                                    } else {
                                        // AGUARDANDO
                                        if (att.isLate) {
                                            rowBgClass = "bg-amber-50/20";
                                            statusBadge = (
                                                <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 font-black">
                                                    ▲ Pendente / Atrasado
                                                </Badge>
                                            );
                                        } else {
                                            statusBadge = (
                                                <Badge className="bg-slate-100 text-slate-600 border-none hover:bg-slate-100">
                                                    ○ Aguardando Entrada
                                                </Badge>
                                            );
                                        }
                                    }

                                    return (
                                        <TableRow key={item.id} className={`hover:bg-slate-50/50 transition-colors ${rowBgClass}`}>
                                            <TableCell className="font-bold text-slate-900 text-sm">
                                                <div className="flex flex-col">
                                                    <span>{item.clientName}</span>
                                                    <span className="text-[10px] text-slate-400 font-medium">{item.companyName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-slate-700 text-xs font-semibold">
                                                {item.role}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-bold text-slate-800">{item.startTime} - {item.endTime}</span>
                                                    <span className="text-[9px] bg-slate-100 px-1 rounded text-slate-500 font-mono mt-0.5">{item.schedule}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-slate-800 text-xs font-medium">
                                                <div className="flex flex-col">
                                                    {item.employee?.name ? (
                                                        <span className="text-slate-800">{item.employee.name}</span>
                                                    ) : (
                                                        <span className="text-red-500 italic font-bold">Vaga Sem Titular</span>
                                                    )}
                                                    
                                                    {att.coveredBy && (
                                                        <span className="text-[10px] text-blue-600 font-bold mt-0.5">
                                                            ↳ Coberto por: {att.coveredBy.name}
                                                        </span>
                                                    )}
                                                    {att.coverageType === "DIARISTA" && (
                                                        <span className="text-[10px] text-orange-600 font-bold mt-0.5">
                                                            ↳ Diarista: {att.notes || "Não especificado"}
                                                        </span>
                                                    )}
                                                    {att.coverageType === "VAGO" && (
                                                        <span className="text-[10px] text-slate-500 font-bold mt-0.5">
                                                            ↳ Glosa: {att.notes || "Sem observações"}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-xs font-mono font-bold text-slate-700">
                                                {(item.billingValue / 30).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {statusBadge}
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {att.status === "PRESENTE_PONTO" || att.status === "PRESENTE_MANUAL" ? (
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={() => handleMarkAbsence(item)} 
                                                            className="h-8 text-[10px] text-red-600 border-red-100 hover:bg-red-50"
                                                        >
                                                            Marcar Falta
                                                        </Button>
                                                    ) : (
                                                        <>
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                onClick={() => handleConfirmManual(item)} 
                                                                className="h-8 text-[10px] text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                                                            >
                                                                Presente
                                                            </Button>
                                                            <Button 
                                                                variant="default" 
                                                                size="sm" 
                                                                onClick={() => handleOpenTreatDialog(item)} 
                                                                className="h-8 text-[10px] bg-primary hover:bg-primary/95 text-white"
                                                            >
                                                                Lançar Cobertura
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {items.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-slate-500 py-20 font-semibold">
                                            Nenhum posto contratado ativo encontrado para o dia filtrado.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </Card>

            {/* Dialog for Treating Lack and Coverage selection */}
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Tratar Falta / Lançar Cobertura</DialogTitle>
                        <DialogDescription>
                            Selecione a ação de cobertura para o posto de <strong>{selectedItem?.role}</strong> no cliente <strong>{selectedItem?.clientName}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-black text-slate-700 uppercase">Tipo de Cobertura</label>
                            <select
                                value={coverageType}
                                onChange={(e) => setCoverageType(e.target.value)}
                                className="h-10 rounded-md border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer"
                            >
                                <option value="RESERVA_TECNICA">Alocar Reserva Técnica (Sem Custo Extra)</option>
                                <option value="DIARISTA">Acionar Diarista Externa (Custo Diária Extra)</option>
                                <option value="VAGO">Manter Posto Vago (Lançar Glosa Financeira)</option>
                            </select>
                        </div>

                        {coverageType === "RESERVA_TECNICA" && (
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-black text-slate-700 uppercase">Escolher Colaborador Reserva</label>
                                {reservaList.length > 0 ? (
                                    <select
                                        value={selectedReservaId}
                                        onChange={(e) => setSelectedReservaId(e.target.value)}
                                        className="h-10 rounded-md border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer"
                                    >
                                        {reservaList.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg flex items-center gap-2 border border-amber-100 font-semibold">
                                        <AlertTriangle className="w-4 h-4 shrink-0" />
                                        Nenhum funcionário na reserva técnica disponível para escala hoje.
                                    </div>
                                )}
                            </div>
                        )}

                        {coverageType === "DIARISTA" && (
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-black text-slate-700 uppercase">Valor da Diária (R$)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={diaristaCost}
                                    onChange={(e) => setDiaristaCost(e.target.value)}
                                    className="h-10 text-xs border-slate-200"
                                    placeholder="Valor pago à diarista"
                                />
                                <span className="text-[10px] text-slate-400 italic">Sugerido (Faturamento Pro-Rata): R$ {(selectedItem ? selectedItem.billingValue / 30 : 0).toFixed(2)}</span>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-black text-slate-700 uppercase">Observações / Justificativa</label>
                            <Input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="h-10 text-xs border-slate-200"
                                placeholder="Motivo da falta, nome da diarista, etc..."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpenDialog(false)} className="text-xs h-10 border border-slate-200">
                            Cancelar
                        </Button>
                        <Button 
                            variant="default" 
                            onClick={handleSaveCoverage} 
                            disabled={actionLoading}
                            className="bg-primary hover:bg-primary/95 text-white text-xs h-10 px-5"
                        >
                            {actionLoading ? "Salvando..." : "Confirmar Cobertura"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
