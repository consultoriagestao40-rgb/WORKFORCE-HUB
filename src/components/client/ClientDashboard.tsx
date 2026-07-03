"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { format, addDays, subDays } from "date-fns";
import { 
    Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Calendar, ChevronLeft, ChevronRight, Clock, UserCheck, UserX, 
    RefreshCw, LogOut, ShieldAlert, Award, FileText, Download
} from "lucide-react";
import { logout } from "@/app/actions";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface Contract {
    id: string;
    name: string;
    companyName: string;
}

interface ClientDashboardProps {
    userName: string;
    contracts: Contract[];
}

interface ClientAttendanceItem {
    id: string;
    role: string;
    schedule: string;
    startTime: string;
    endTime: string;
    clientId: string;
    clientName: string;
    clientAddress: string;
    employeeName: string;
    totalContractPostos: number;
    billingValue: number;
    attendance: {
        status: string;
        clockInTime: string | null;
        coveredByName: string | null;
        coverageType: string | null;
        notes: string;
        isLate: boolean;
    };
}

export function ClientDashboard({ userName, contracts }: ClientDashboardProps) {
    const [date, setDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
    const [selectedContractId, setSelectedContractId] = useState<string>("all");
    const [activeContractId, setActiveContractId] = useState<string | null>(null);
    const [items, setItems] = useState<ClientAttendanceItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isPending, startTransition] = useTransition();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                date,
                clientId: selectedContractId
            });
            const res = await fetch(`/api/client/attendance?${queryParams.toString()}`);
            const data = await res.json();
            
            if (data.success) {
                setItems(data.items);
            } else {
                toast.error("Erro ao carregar dados: " + (data.error || "Erro desconhecido"));
            }
        } catch (e) {
            toast.error("Erro de conexão ao carregar escala.");
        } finally {
            setLoading(false);
        }
    }, [date, selectedContractId]);

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
        let total = 0;
        let presentCount = 0;
        let lateCount = 0;
        let vacantCount = 0;
        let coveredCount = 0;

        items.forEach(item => {
            const att = item.attendance;
            if (att.status === "FOLGA") return;

            total++;

            if (att.status === "PRESENTE_PONTO" || att.status === "PRESENTE_MANUAL") {
                presentCount++;
            } else if (att.status === "FALTA") {
                if (att.coveredByName || att.coverageType) {
                    coveredCount++;
                } else {
                    vacantCount++;
                }
            } else if (att.status === "AGUARDANDO" && att.isLate) {
                lateCount++;
            }
        });

        // Calcular postos físicos totais do contrato mapeados de forma única
        const contractMap = new Map<string, number>();
        items.forEach(item => {
            contractMap.set(item.clientId, item.totalContractPostos || 0);
        });
        const totalContractPostos = Array.from(contractMap.values()).reduce((sum, val) => sum + val, 0);

        return { total, presentCount, lateCount, vacantCount, coveredCount, totalContractPostos };
    }, [items]);

    // Group items by client contract for the master list view
    const groupedContracts = React.useMemo(() => {
        const map = new Map<string, { 
            id: string; 
            name: string; 
            address: string; 
            total: number;
            present: number;
            late: number;
            covered: number;
            vacant: number;
            totalContractPostos: number;
        }>();

        items.forEach(item => {
            const key = item.clientId;
            if (!map.has(key)) {
                map.set(key, {
                    id: key,
                    name: item.clientName,
                    address: item.clientAddress || "-",
                    total: 0,
                    present: 0,
                    late: 0,
                    covered: 0,
                    vacant: 0,
                    totalContractPostos: item.totalContractPostos || 0
                });
            }
            const c = map.get(key)!;
            const att = item.attendance;

            if (att.status === "FOLGA") return;

            c.total++;
            
            if (att.status === "PRESENTE_PONTO" || att.status === "PRESENTE_MANUAL") {
                c.present++;
            } else if (att.status === "FALTA") {
                if (att.coveredByName || att.coverageType) {
                    c.covered++;
                } else {
                    c.vacant++;
                }
            } else if (att.status === "AGUARDANDO" && att.isLate) {
                c.late++;
            }
        });

        return Array.from(map.values());
    }, [items]);

    // Export Client Roster to Excel
    const handleExportExcel = () => {
        const exportData = items.map((item, index) => {
            const att = item.attendance;
            let statusText = "Aguardando Entrada";
            if (att.status === "PRESENTE_PONTO") statusText = `Presente (Ponto - ${att.clockInTime ? format(new Date(att.clockInTime), "HH:mm") : ""})`;
            else if (att.status === "PRESENTE_MANUAL") statusText = "Presente (Confirmado pela mesa)";
            else if (att.status === "FALTA") {
                if (att.coveredByName) statusText = `Falta Coberta (Reserva: ${att.coveredByName})`;
                else if (att.coverageType === "DIARISTA") statusText = "Falta Coberta (Diarista)";
                else statusText = "Posto Vago (Glosa)";
            } else if (att.status === "AGUARDANDO" && att.isLate) {
                statusText = "Atrasado (Pendente)";
            }

            return {
                "Nº": index + 1,
                "Contrato / Unidade": item.clientName,
                "Cargo/Função": item.role,
                "Escala": item.schedule,
                "Horário": `${item.startTime} - ${item.endTime}`,
                "Profissional Escalado": item.employeeName,
                "Status de Presença": statusText,
                "Observação": att.notes || "-"
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);

        ws["!cols"] = [
            { wch: 5 },   // Nº
            { wch: 25 },  // Unidade
            { wch: 20 },  // Cargo
            { wch: 12 },  // Escala
            { wch: 15 },  // Horário
            { wch: 25 },  // Profissional
            { wch: 35 },  // Status
            { wch: 30 }   // Observação
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Relatorio_Presenca");
        XLSX.writeFile(wb, `Presenca_Contratos_${date}.xlsx`);
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            {/* Premium Top Bar */}
            <div className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/20 p-2 rounded-xl border border-primary/20">
                                <Award className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-lg font-black tracking-tight">WORKFORCE HUB</h1>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Portal do Cliente</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-slate-300">Olá, {userName}</p>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Acesso Cliente</p>
                            </div>

                            <form action={logout}>
                                <Button type="submit" variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl">
                                    <LogOut className="w-4 h-4" />
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dashboard Content Container */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
                
                {/* Control Panel */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Status de Presença Diário</h2>
                        <p className="text-slate-500 font-medium text-xs">Monitore a lotação e o cumprimento de escalas em tempo real dos seus contratos.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Calendário */}
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

                        {/* Contract Filter */}
                        <select
                            value={selectedContractId}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSelectedContractId(val);
                                setActiveContractId(val === "all" ? null : val);
                            }}
                            className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                        >
                            <option value="all">Todos os Contratos</option>
                            {contracts.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>

                        <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5 h-10 shadow-premium border-slate-200">
                            <Download className="w-4 h-4" /> Exportar Planilha
                        </Button>

                        <Button variant="ghost" size="icon" onClick={fetchData} className="h-10 w-10 border border-slate-200/50 bg-white rounded-xl shadow-premium">
                            <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                {/* Metrics Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <Card className="border-none shadow-premium bg-slate-900 text-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-300">Postos em Escala</span>
                        <div className="flex items-baseline justify-between mt-1">
                            <span className="text-2xl font-black">{metrics.total}</span>
                            <div className="flex flex-col text-[9px] font-bold uppercase tracking-wider text-slate-400 text-right select-none leading-normal">
                                <span>Escala: <strong className="text-emerald-400 font-black">{metrics.total}</strong></span>
                                <span>Folga: <strong className="text-slate-200 font-black">{metrics.totalContractPostos - metrics.total}</strong></span>
                            </div>
                        </div>
                    </Card>

                    <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Presentes</span>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-2xl font-black text-emerald-600">{metrics.presentCount}</span>
                            <UserCheck className="w-5 h-5 text-emerald-600 bg-emerald-50 p-1 rounded" />
                        </div>
                    </Card>

                    <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Aguardando/Atrasados</span>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-2xl font-black text-amber-600">{metrics.lateCount}</span>
                            <Clock className="w-5 h-5 text-amber-600 bg-amber-50 p-1 rounded" />
                        </div>
                    </Card>

                    <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Cobertos</span>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-2xl font-black text-blue-600">{metrics.coveredCount}</span>
                            <RefreshCw className="w-5 h-5 text-blue-600 bg-blue-50 p-1 rounded" />
                        </div>
                    </Card>

                    <Card className="border-none shadow-premium bg-white p-4 py-3 flex flex-col justify-between gap-1 h-auto min-h-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Vagos (Sem Cobertura)</span>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-2xl font-black text-red-600">{metrics.vacantCount}</span>
                            <UserX className="w-5 h-5 text-red-600 bg-red-50 p-1 rounded" />
                        </div>
                    </Card>
                </div>
                      {/* Table Section */}
                <Card className="border-none shadow-premium bg-white overflow-hidden">
                    <div className="w-full overflow-x-auto">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                                <span className="text-xs text-slate-500 font-semibold">Carregando dados da escala...</span>
                            </div>
                        ) : activeContractId === null ? (
                            /* Contract Master List View */
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-800">Contrato / Unidade</TableHead>
                                        <TableHead className="font-bold text-slate-800">Endereço</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-center">Total de Postos</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-center">Status de Presença</TableHead>
                                        <TableHead className="font-bold text-slate-800 text-right pr-6">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupedContracts.map((contract) => (
                                        <TableRow 
                                            key={contract.id} 
                                            className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                                            onClick={() => {
                                                setActiveContractId(contract.id);
                                                setSelectedContractId(contract.id);
                                            }}
                                        >
                                            <TableCell className="font-bold text-slate-900 text-sm">
                                                {contract.name}
                                            </TableCell>
                                            <TableCell className="text-slate-500 text-xs max-w-[300px] truncate">
                                                {contract.address}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-sm font-bold text-slate-800">{contract.totalContractPostos} Postos</span>
                                                    <span className="text-[10px] text-slate-400 font-medium">{contract.total} em escala hoje</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center items-center gap-1.5 flex-wrap">
                                                    {contract.present > 0 && (
                                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 text-[10px] font-bold">
                                                            {contract.present} Presentes
                                                        </Badge>
                                                    )}
                                                    {contract.late > 0 && (
                                                        <Badge className="bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-50 text-[10px] font-bold">
                                                            {contract.late} Atrasados
                                                        </Badge>
                                                    )}
                                                    {contract.covered > 0 && (
                                                        <Badge className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50 text-[10px] font-bold">
                                                            {contract.covered} Cobertos
                                                        </Badge>
                                                    )}
                                                    {contract.vacant > 0 && (
                                                        <Badge className="bg-red-50 text-red-700 border-red-100 hover:bg-red-50 text-[10px] font-bold">
                                                            {contract.vacant} Vagos
                                                        </Badge>
                                                    )}
                                                    {contract.present === 0 && contract.late === 0 && contract.covered === 0 && contract.vacant === 0 && (
                                                        <span className="text-xs text-slate-400 italic">Nenhuma escala ativa</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Button variant="ghost" size="sm" className="text-xs font-semibold text-primary hover:text-primary/80">
                                                    Ver Detalhes →
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {groupedContracts.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-slate-500 py-20 font-semibold">
                                                Nenhum contrato ativo sob sua gestão na data selecionada.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        ) : (
                            /* Contract Detailed View of Posts (First Column removed) */
                            <div>
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => {
                                                setActiveContractId(null);
                                                setSelectedContractId("all");
                                            }}
                                            className="text-xs gap-1.5 h-8 border-slate-200"
                                        >
                                            ← Voltar para Contratos
                                        </Button>
                                        <span className="text-sm font-bold text-slate-800">
                                            Detalhamento do Contrato: {items[0]?.clientName || "Contrato"}
                                        </span>
                                    </div>
                                </div>
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-800">Função / Cargo</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Horário</TableHead>
                                            <TableHead className="font-bold text-slate-800">Titular do Posto</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Valor Diário</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Status do Posto</TableHead>
                                            <TableHead className="font-bold text-slate-800">Observações Operacionais</TableHead>
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
                                                        ● Confirmado (Ponto às {att.clockInTime ? format(new Date(att.clockInTime), "HH:mm") : ""})
                                                    </Badge>
                                                );
                                            } else if (att.status === "PRESENTE_MANUAL") {
                                                statusBadge = (
                                                    <Badge className="bg-emerald-50 text-emerald-855 hover:bg-emerald-50 font-black">
                                                        ● Confirmado pela Mesa
                                                    </Badge>
                                                );
                                            } else if (att.status === "FALTA") {
                                                if (att.coveredByName) {
                                                    statusBadge = (
                                                        <Badge className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50 font-bold">
                                                            ● Falta Coberta: {att.coveredByName}
                                                        </Badge>
                                                    );
                                                } else if (att.coverageType === "DIARISTA") {
                                                    statusBadge = (
                                                        <Badge className="bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-50 font-bold">
                                                            ● Coberto por Diarista
                                                        </Badge>
                                                    );
                                                } else {
                                                    rowBgClass = "bg-red-50/20";
                                                    statusBadge = (
                                                        <Badge className="bg-red-50 text-red-700 border-red-100 hover:bg-red-50 font-black animate-pulse">
                                                            ▲ Posto Vago (Glosa)
                                                        </Badge>
                                                    );
                                                }
                                            } else if (att.status === "FOLGA") {
                                                rowBgClass = "opacity-70 bg-slate-100/40";
                                                statusBadge = (
                                                    <Badge className="bg-slate-250 text-slate-500 border-slate-300 hover:bg-slate-200 font-semibold select-none">
                                                        ○ Folga (Sem Escala)
                                                    </Badge>
                                                );
                                            } else {
                                                if (att.isLate) {
                                                    rowBgClass = "bg-amber-50/20";
                                                    statusBadge = (
                                                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 font-black">
                                                            ▲ Entrada Pendente (Atraso)
                                                        </Badge>
                                                    );
                                                } else {
                                                    statusBadge = (
                                                        <Badge className="bg-slate-100 text-slate-600 border-none hover:bg-slate-100">
                                                            ○ Em Escala (Aguardando)
                                                        </Badge>
                                                    );
                                                }
                                            }

                                            return (
                                                <TableRow key={item.id} className={`hover:bg-slate-50/50 transition-colors ${rowBgClass}`}>
                                                    <TableCell className="text-slate-700 text-xs font-semibold">
                                                        {item.role}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-xs font-bold text-slate-850">{item.startTime} - {item.endTime}</span>
                                                            <span className="text-[9px] bg-slate-100 px-1 rounded text-slate-500 font-mono mt-0.5">{item.schedule}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-slate-800 text-xs font-medium">
                                                        {item.employeeName}
                                                    </TableCell>
                                                    <TableCell className="text-center text-xs font-mono font-bold text-slate-705">
                                                        {(item.billingValue / 30).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {statusBadge}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-slate-500 font-medium italic">
                                                        {att.notes || (att.status === "FALTA" && !att.coveredByName ? "Posto desocupado sem aviso de cobertura." : "-")}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {items.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-slate-500 py-20 font-semibold">
                                                    Nenhum posto cadastrado neste contrato.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Info Note */}
                <div className="text-[10px] text-slate-400 bg-slate-100 rounded-lg p-3 flex items-start gap-2 border border-slate-200/50">
                    <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold uppercase tracking-wider text-slate-500 mb-0.5">Nota de Conformidade e Transparência</p>
                        <p className="leading-relaxed">Este painel exibe dados de controle de ponto e efetivo auditados. Apontamentos manuais de presença ou justificados de falta são informados pela mesa de operações da Prestadora. Glosas financeiras diárias são computadas de acordo com as regras contratuais acordadas.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
