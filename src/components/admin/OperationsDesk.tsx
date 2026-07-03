"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { format, addDays, subDays, startOfMonth } from "date-fns";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Combobox } from "@/components/ui/combobox";
import {
    Calendar, ChevronLeft, ChevronRight, Search, UserCheck, UserX, 
    AlertTriangle, Clock, Coins, Download, RefreshCw, Eye, Edit
} from "lucide-react";
import * as XLSX from "xlsx";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
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

    // Dialog state for viewing active metrics cards details
    const [openDetailsDialog, setOpenDetailsDialog] = useState<boolean>(false);
    const [detailsTitle, setDetailsTitle] = useState<string>("");
    const [detailsItems, setDetailsItems] = useState<AttendanceItem[]>([]);

    const handleOpenDetails = (type: "ATRASADOS" | "COBERTURAS" | "GLOSAS") => {
        let title = "";
        let filtered: AttendanceItem[] = [];

        if (type === "ATRASADOS") {
            title = "Postos Atrasados / Pendentes";
            filtered = items.filter(item => item.attendance.status === "AGUARDANDO" && item.attendance.isLate);
        } else if (type === "COBERTURAS") {
            title = "Postos com Cobertura Ativa";
            filtered = items.filter(item => 
                item.attendance.status === "FALTA" && 
                (item.attendance.coveredBy || item.attendance.coverageType === "DIARISTA" || item.attendance.coverageType === "RESERVA_TECNICA")
            );
        } else if (type === "GLOSAS") {
            title = "Faltas Sem Cobertura (Glosas)";
            filtered = items.filter(item => 
                item.attendance.status === "FALTA" && 
                !item.attendance.coveredBy && 
                item.attendance.coverageType !== "DIARISTA" && 
                item.attendance.coverageType !== "RESERVA_TECNICA"
            );
        }

        setDetailsTitle(title);
        setDetailsItems(filtered);
        setOpenDetailsDialog(true);
    };

    // Tabs and KPIs States
    const [activeTab, setActiveTab] = useState<"mesa" | "kpis">("mesa");
    const [kpiRange, setKpiRange] = useState<"7d" | "30d" | "mes" | "custom">("30d");
    const [kpiStartDate, setKpiStartDate] = useState<string>(() => format(subDays(new Date(), 30), "yyyy-MM-dd"));
    const [kpiEndDate, setKpiEndDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
    const [kpisData, setKpisData] = useState<any>(null);
    const [kpisLoading, setKpisLoading] = useState<boolean>(false);

    const fetchKPIs = useCallback(async () => {
        setKpisLoading(true);
        try {
            let start = kpiStartDate;
            let end = kpiEndDate;
            const today = new Date();

            if (kpiRange === "7d") {
                start = format(subDays(today, 7), "yyyy-MM-dd");
                end = format(today, "yyyy-MM-dd");
            } else if (kpiRange === "30d") {
                start = format(subDays(today, 30), "yyyy-MM-dd");
                end = format(today, "yyyy-MM-dd");
            } else if (kpiRange === "mes") {
                start = format(startOfMonth(today), "yyyy-MM-dd");
                end = format(today, "yyyy-MM-dd");
            }

            const queryParams = new URLSearchParams({
                startDate: start,
                endDate: end
            });
            const res = await fetch(`/api/admin/operations/kpis?${queryParams.toString()}`);
            const data = await res.json();
            if (data.success) {
                setKpisData(data.kpis);
            } else {
                toast.error("Erro ao carregar KPIs: " + data.error);
            }
        } catch (e) {
            toast.error("Erro de conexão ao buscar KPIs.");
        } finally {
            setKpisLoading(false);
        }
    }, [kpiRange, kpiStartDate, kpiEndDate]);

    useEffect(() => {
        if (activeTab === "kpis") {
            fetchKPIs();
        }
    }, [activeTab, fetchKPIs]);

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

    const clientOptions = React.useMemo(() => {
        const list = filteredClients.map(c => ({
            value: c.id,
            label: c.name
        }));
        return [{ value: "all", label: "Todos os Clientes / Contratos" }, ...list];
    }, [filteredClients]);

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

            {/* Tabs Control */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab("mesa")}
                    className={`pb-3 text-sm font-black transition-colors px-4 border-b-2 -mb-[2px] ${
                        activeTab === "mesa" 
                        ? "border-primary text-primary" 
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                >
                    Mesa Diária
                </button>
                <button
                    onClick={() => {
                        setActiveTab("kpis");
                        fetchKPIs();
                    }}
                    className={`pb-3 text-sm font-black transition-colors px-4 border-b-2 -mb-[2px] ${
                        activeTab === "kpis" 
                        ? "border-primary text-primary" 
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                >
                    Indicadores (KPIs)
                </button>
            </div>

            {activeTab === "mesa" ? (
                <>
                    {/* Metrics Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                <Card className="border-none shadow-premium bg-gradient-to-br from-indigo-900 to-slate-950 text-white p-3.5 flex flex-col justify-between h-[110px] select-none">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200/70">Total de Postos Ativos</p>
                        <p className="text-2xl font-black mt-0.5">{metrics.total}</p>
                    </div>
                    <p className="text-[8px] text-indigo-200/80 font-bold uppercase tracking-wider">Escala linear diária completa</p>
                </Card>

                <Card className="border-none shadow-premium bg-white p-3.5 flex flex-col justify-between h-[110px] select-none">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Presença Confirmada</p>
                            <p className="text-2xl font-black mt-0.5 text-emerald-600">{metrics.confirmed}</p>
                        </div>
                        <UserCheck className="w-5 h-5 text-emerald-500 bg-emerald-50 p-0.5 rounded" />
                    </div>
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                        {metrics.total > 0 ? ((metrics.confirmed / metrics.total) * 100).toFixed(0) : 0}% de presença confirmada
                    </p>
                </Card>

                <Card className="border-none shadow-premium bg-white cursor-pointer hover:bg-slate-50/50 transition-colors p-3.5 flex flex-col justify-between h-[110px] select-none" onClick={() => handleOpenDetails("ATRASADOS")}>
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Postos Atrasados</p>
                            <p className="text-2xl font-black mt-0.5 text-amber-600">{metrics.lates}</p>
                        </div>
                        <Clock className="w-5 h-5 text-amber-500 bg-amber-50 p-0.5 rounded" />
                    </div>
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Turno iniciado sem ponto batido</p>
                </Card>

                <Card className="border-none shadow-premium bg-white cursor-pointer hover:bg-slate-50/50 transition-colors p-3.5 flex flex-col justify-between h-[110px] select-none" onClick={() => handleOpenDetails("COBERTURAS")}>
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Postos com Cobertura</p>
                            <p className="text-2xl font-black mt-0.5 text-blue-600">{metrics.coverages}</p>
                        </div>
                        <RefreshCw className="w-5 h-5 text-blue-500 bg-blue-50 p-0.5 rounded" />
                    </div>
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Coberto por Reserva ou Diarista</p>
                </Card>

                <Card className="border-none shadow-premium bg-white cursor-pointer hover:bg-slate-50/50 transition-colors p-3.5 flex flex-col justify-between h-[110px] select-none" onClick={() => handleOpenDetails("GLOSAS")}>
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Faltas Sem Cobertura (Glosa)</p>
                            <p className="text-2xl font-black mt-0.5 text-red-600">{metrics.absences}</p>
                        </div>
                        <UserX className="w-5 h-5 text-red-500 bg-red-50 p-0.5 rounded" />
                    </div>
                    <div className="flex items-center justify-between text-[8px] text-red-500 font-extrabold uppercase tracking-wider">
                        <span>Perda de Fat.:</span>
                        <span>{metrics.glosasValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    </div>
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

                    <Combobox
                        options={clientOptions}
                        value={clientFilter}
                        onChange={(val) => setClientFilter(val)}
                        placeholder="Todos os Clientes / Contratos"
                        searchPlaceholder="Buscar cliente..."
                        emptyMessage="Nenhum cliente encontrado."
                    />

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
                                    <TableHead className="font-bold text-slate-800">Cargo / Cliente</TableHead>
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
                                            <TableCell className="text-slate-850 text-sm">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900">{item.role}</span>
                                                    <span className="text-[10px] text-slate-400 font-medium">{item.clientName} • <span className="text-[9px]">{item.companyName}</span></span>
                                                </div>
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
                </>
            ) : (
                <div className="space-y-6">
                    {/* Filter KPI Bar */}
                    <Card className="border-none shadow-premium bg-white p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="text-xs font-black text-slate-700 uppercase">Período de Análise:</span>
                                <select
                                    value={kpiRange}
                                    onChange={(e) => setKpiRange(e.target.value as any)}
                                    className="h-10 rounded-md border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer"
                                >
                                    <option value="7d">Últimos 7 Dias</option>
                                    <option value="30d">Últimos 30 Dias</option>
                                    <option value="mes">Mês Atual</option>
                                    <option value="custom">Período Personalizado</option>
                                </select>

                                {kpiRange === "custom" && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="date"
                                            value={kpiStartDate}
                                            onChange={(e) => setKpiStartDate(e.target.value)}
                                            className="h-10 rounded-md border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer"
                                        />
                                        <span className="text-slate-400 text-xs">até</span>
                                        <input
                                            type="date"
                                            value={kpiEndDate}
                                            onChange={(e) => setKpiEndDate(e.target.value)}
                                            className="h-10 rounded-md border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer"
                                        />
                                    </div>
                                )}
                            </div>

                            <Button 
                                onClick={fetchKPIs} 
                                disabled={kpisLoading}
                                className="h-10 text-xs px-4 bg-primary hover:bg-primary/95 text-white flex items-center gap-2 shadow-premium"
                            >
                                <RefreshCw className={`w-4 h-4 ${kpisLoading ? "animate-spin" : ""}`} />
                                Atualizar Indicadores
                            </Button>
                        </div>
                    </Card>

                    {kpisLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                            <span className="text-xs text-slate-500 font-semibold">Processando dados e gerando indicadores...</span>
                        </div>
                    ) : kpisData ? (
                        <div className="space-y-6">
                            {/* KPI Metrics Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                <Card className="border-none shadow-premium bg-gradient-to-br from-indigo-900 to-slate-950 text-white p-3.5 flex flex-col justify-between h-[110px] select-none">
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200/70">Taxa de Absenteísmo (Abs)</p>
                                        <p className="text-2xl font-black mt-0.5">{kpisData.absenteismRate.toFixed(1)}%</p>
                                    </div>
                                    <p className="text-[8px] text-indigo-200/80 font-bold uppercase tracking-wider">
                                        {kpisData.totalAbsences} faltas em {kpisData.totalExpectedShifts} escalas
                                    </p>
                                </Card>

                                <Card className="border-none shadow-premium bg-white p-3.5 flex flex-col justify-between h-[110px] select-none">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Turnover do Período</p>
                                            <p className="text-2xl font-black mt-0.5 text-blue-600">{kpisData.turnoverRate.toFixed(1)}%</p>
                                        </div>
                                        <Clock className="w-5 h-5 text-blue-500 bg-blue-50 p-0.5 rounded" />
                                    </div>
                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                                        {kpisData.admissions} adm / {kpisData.dismissals} demissões
                                    </p>
                                </Card>

                                <Card className="border-none shadow-premium bg-white p-3.5 flex flex-col justify-between h-[110px] select-none">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Índice de Cobertura</p>
                                            <p className="text-2xl font-black mt-0.5 text-emerald-600">{kpisData.coverageRate.toFixed(1)}%</p>
                                        </div>
                                        <UserCheck className="w-5 h-5 text-emerald-500 bg-emerald-50 p-0.5 rounded" />
                                    </div>
                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                                        {kpisData.coveredAbsences} ausências cobertas
                                    </p>
                                </Card>

                                <Card className="border-none shadow-premium bg-white p-3.5 flex flex-col justify-between h-[110px] select-none">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Faltas sem Cobertura</p>
                                            <p className="text-2xl font-black mt-0.5 text-red-600">{kpisData.glosasCount}</p>
                                        </div>
                                        <UserX className="w-5 h-5 text-red-500 bg-red-50 p-0.5 rounded" />
                                    </div>
                                    <div className="flex items-center justify-between text-[8px] text-red-500 font-extrabold uppercase tracking-wider">
                                        <span>Glosa Estimada:</span>
                                        <span>{kpisData.glosasValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                                    </div>
                                </Card>

                                <Card className="border-none shadow-premium bg-white p-3.5 flex flex-col justify-between h-[110px] select-none">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dias de Postos Vagos</p>
                                            <p className="text-2xl font-black mt-0.5 text-slate-700">{kpisData.totalVacantDays}</p>
                                        </div>
                                        <AlertTriangle className="w-5 h-5 text-slate-500 bg-slate-50 p-0.5 rounded" />
                                    </div>
                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                                        Plantões ativos sem titular alocado
                                    </p>
                                </Card>
                            </div>

                            {/* Trend Chart 1: Absenteísmo */}
                            <Card className="border-none shadow-premium bg-white p-5 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                                            <Clock className="w-5 h-5 text-indigo-500" /> Evolução da Taxa de Absenteísmo
                                        </h2>
                                        <p className="text-xs text-slate-400 font-medium">Histórico diário da porcentagem de ausências no período selecionado</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                                        <div className="w-3 h-3 rounded-full bg-indigo-500" />
                                        <span className="text-slate-600">Taxa de Absenteísmo (%)</span>
                                    </div>
                                </div>

                                <div className="h-64 w-full pt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={kpisData.dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorAbs" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis 
                                                dataKey="date" 
                                                tickLine={false} 
                                                axisLine={false} 
                                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                                            />
                                            <YAxis 
                                                tickLine={false} 
                                                axisLine={false} 
                                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                                                unit="%"
                                            />
                                            <Tooltip 
                                                formatter={(value: any) => {
                                                    return [`${Number(value).toFixed(1)}%`, "Absenteísmo"];
                                                }}
                                                contentStyle={{ 
                                                    backgroundColor: '#ffffff', 
                                                    borderRadius: '12px', 
                                                    border: 'none', 
                                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' 
                                                }}
                                                labelStyle={{ fontWeight: 'bold', fontSize: '12px', color: '#1e293b' }}
                                                itemStyle={{ fontSize: '11px', fontWeight: 600 }}
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey="absRate" 
                                                stroke="#6366f1" 
                                                strokeWidth={2}
                                                fillOpacity={1} 
                                                fill="url(#colorAbs)" 
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            {/* Trend Chart 2: Faltas Sem Cobertura */}
                            <Card className="border-none shadow-premium bg-white p-5 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                                            <UserX className="w-5 h-5 text-red-500" /> Faltas Sem Cobertura (Glosas)
                                        </h2>
                                        <p className="text-xs text-slate-400 font-medium">Contagem de postos de trabalho que operaram sem cobertura no período</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                                        <div className="w-3 h-3 rounded bg-red-500" />
                                        <span className="text-slate-600">Glosas (Faltas)</span>
                                    </div>
                                </div>

                                <div className="h-64 w-full pt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={kpisData.dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis 
                                                dataKey="date" 
                                                tickLine={false} 
                                                axisLine={false} 
                                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                                            />
                                            <YAxis 
                                                tickLine={false} 
                                                axisLine={false} 
                                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                                                allowDecimals={false}
                                            />
                                            <Tooltip 
                                                formatter={(value: any) => {
                                                    return [`${value} faltas`, "Glosas"];
                                                }}
                                                contentStyle={{ 
                                                    backgroundColor: '#ffffff', 
                                                    borderRadius: '12px', 
                                                    border: 'none', 
                                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' 
                                                }}
                                                labelStyle={{ fontWeight: 'bold', fontSize: '12px', color: '#1e293b' }}
                                                itemStyle={{ fontSize: '11px', fontWeight: 600 }}
                                            />
                                            <Bar 
                                                dataKey="glosas" 
                                                fill="#ef4444" 
                                                radius={[3, 3, 0, 0]}
                                                barSize={16}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            {/* Row 1: Charts & Rankings */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Reasons for Absence Chart */}
                                <Card className="border-none shadow-premium bg-white p-5 space-y-4">
                                    <div>
                                        <h2 className="text-base font-black text-slate-900 tracking-tight">Ausências por Motivo</h2>
                                        <p className="text-xs text-slate-400 font-medium">Classificação baseada nas justificativas e observações</p>
                                    </div>
                                    <div className="h-64 w-full flex items-center justify-center">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={kpisData.reasons}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    label={({ percent }) => percent && percent > 0.02 ? `${(percent * 100).toFixed(0)}%` : ""}
                                                >
                                                    {kpisData.reasons.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={["#3b82f6", "#ef4444", "#f59e0b", "#94a3b8"][index % 4]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip 
                                                    formatter={(value: any, name: any) => {
                                                        const total = kpisData.totalAbsences || 1;
                                                        const pct = ((Number(value) / total) * 100).toFixed(1);
                                                        return [`${value} ocorrências (${pct}%)`, name];
                                                    }}
                                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                                    itemStyle={{ fontSize: '11px', fontWeight: 600 }}
                                                />
                                                <Legend 
                                                    verticalAlign="bottom" 
                                                    height={36} 
                                                    iconType="circle"
                                                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>

                                {/* Ranking of Absences by Collaborator */}
                                <Card className="border-none shadow-premium bg-white p-5 space-y-4">
                                    <div>
                                        <h2 className="text-base font-black text-slate-900 tracking-tight">Ranking de Ausências por Colaborador</h2>
                                        <p className="text-xs text-slate-400 font-medium">Colaboradores com maior índice de faltas no período</p>
                                    </div>
                                    <div className="h-64 w-full">
                                        {kpisData.employeeRanking.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart 
                                                    data={kpisData.employeeRanking} 
                                                    layout="vertical"
                                                    margin={{ top: 5, right: 10, left: 30, bottom: 5 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                                    <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} />
                                                    <YAxis 
                                                        dataKey="name" 
                                                        type="category" 
                                                        tickLine={false} 
                                                        axisLine={false} 
                                                        tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
                                                        width={90}
                                                    />
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                                        itemStyle={{ fontSize: '11px', fontWeight: 600 }}
                                                    />
                                                    <Bar dataKey="count" name="Faltas" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-xs text-slate-400 font-semibold">
                                                Nenhuma ausência registrada no período.
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            </div>

                            {/* Row 2: Vacant posts lists */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Vacant Days by Posto */}
                                <Card className="border-none shadow-premium bg-white p-5 space-y-4">
                                    <div>
                                        <h2 className="text-base font-black text-slate-900 tracking-tight">Dias de Postos Vagos por Posto</h2>
                                        <p className="text-xs text-slate-400 font-medium">Postos sem titular ativo com maior recorrência de vaga</p>
                                    </div>
                                    <div className="h-64 w-full">
                                        {kpisData.vacantByPosto.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart 
                                                    data={kpisData.vacantByPosto} 
                                                    layout="vertical"
                                                    margin={{ top: 5, right: 10, left: 30, bottom: 5 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                                    <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} />
                                                    <YAxis 
                                                        dataKey="client" 
                                                        type="category" 
                                                        tickLine={false} 
                                                        axisLine={false} 
                                                        tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
                                                        width={90}
                                                    />
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                                        itemStyle={{ fontSize: '11px', fontWeight: 600 }}
                                                    />
                                                    <Bar dataKey="count" name="Dias Vagos" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={12} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-xs text-slate-400 font-semibold">
                                                Nenhum posto vago registrado.
                                            </div>
                                        )}
                                    </div>
                                </Card>

                                {/* Vacant Days by Role */}
                                <Card className="border-none shadow-premium bg-white p-5 space-y-4">
                                    <div>
                                        <h2 className="text-base font-black text-slate-900 tracking-tight">Dias de Postos Vagos por Função</h2>
                                        <p className="text-xs text-slate-400 font-medium">Acúmulo de dias vagos agrupados por função operacional</p>
                                    </div>
                                    <div className="h-64 w-full flex items-center justify-center">
                                        {kpisData.vacantByRole.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={kpisData.vacantByRole}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={3}
                                                        dataKey="count"
                                                        nameKey="name"
                                                        label={({ percent }) => percent && percent > 0.02 ? `${(percent * 100).toFixed(0)}%` : ""}
                                                    >
                                                        {kpisData.vacantByRole.map((entry: any, index: number) => (
                                                            <Cell key={`cell-${index}`} fill={["#8b5cf6", "#ec4899", "#3b82f6", "#14b8a6", "#ef4444", "#10b981", "#f59e0b", "#94a3b8"][index % 8]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        formatter={(value: any, name: any) => {
                                                            const total = kpisData.totalVacantDays || 1;
                                                            const pct = ((Number(value) / total) * 100).toFixed(1);
                                                            return [`${value} dias (${pct}%)`, name];
                                                        }}
                                                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                                        itemStyle={{ fontSize: '11px', fontWeight: 600 }}
                                                    />
                                                    <Legend 
                                                        verticalAlign="bottom" 
                                                        height={36} 
                                                        iconType="circle"
                                                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-xs text-slate-400 font-semibold">
                                                Nenhum posto vago registrado.
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white border border-slate-100 rounded-2xl shadow-premium">
                            <span className="text-xs text-slate-500 font-semibold">Nenhum dado disponível. Tente alterar o período de análise.</span>
                        </div>
                    )}
                </div>
            )}

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

            {/* Modal for Details Lists */}
            <Dialog open={openDetailsDialog} onOpenChange={setOpenDetailsDialog}>
                <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">{detailsTitle}</DialogTitle>
                        <DialogDescription className="text-slate-500 text-xs font-semibold">
                            Total de {detailsItems.length} postos encontrados para o dia {format(new Date(date + "T12:00:00"), "dd/MM/yyyy")}.
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-1 px-6 pb-6 overflow-y-auto max-h-[60vh] border-t border-slate-100">
                        <div className="space-y-4 pt-4">
                            {detailsItems.map((item) => {
                                const att = item.attendance;
                                let coverageDetails = "";
                                if (att.coveredBy) {
                                    coverageDetails = `Cobertura por Reserva Técnica: ${att.coveredBy.name}`;
                                } else if (att.coverageType === "DIARISTA") {
                                    coverageDetails = `Diarista: ${att.notes || "Não especificado"}`;
                                } else if (att.coverageType === "VAGO") {
                                    coverageDetails = `Posto Vago (Glosa Confirmada)`;
                                }

                                return (
                                    <div key={item.id} className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div className="space-y-1">
                                            <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">{item.clientName}</p>
                                            <p className="text-sm font-bold text-slate-800">{item.role}</p>
                                            <div className="flex flex-wrap gap-2 pt-0.5">
                                                <Badge variant="secondary" className="text-[10px] font-bold bg-slate-200/50 border-none text-slate-700">
                                                    {item.startTime} - {item.endTime} ({item.schedule})
                                                </Badge>
                                                {coverageDetails && (
                                                    <Badge className="text-[10px] font-bold bg-indigo-50 border-indigo-100 text-indigo-700">
                                                        {coverageDetails}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-left md:text-right shrink-0">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Titular</p>
                                            <p className="text-xs font-semibold text-slate-700">{item.employee?.name || "Vaga Sem Titular"}</p>
                                            {att.notes && !coverageDetails && (
                                                <p className="text-[10px] text-red-500 italic font-medium mt-0.5">Obs: {att.notes}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {detailsItems.length === 0 && (
                                <div className="text-center text-xs text-slate-500 font-semibold py-12">
                                    Nenhum posto com este status encontrado.
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    
                    <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100">
                        <Button variant="outline" onClick={() => setOpenDetailsDialog(false)} className="text-xs h-10 border border-slate-200">
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
