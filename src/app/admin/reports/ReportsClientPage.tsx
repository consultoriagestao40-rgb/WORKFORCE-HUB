"use client";

import { useState, useEffect, useTransition } from "react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { 
    BarChart3, 
    Download, 
    Calendar, 
    Briefcase, 
    Users, 
    Percent, 
    Clock, 
    TrendingUp, 
    Search,
    Filter,
    ArrowUpRight,
    UserCheck,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Building,
    FileSpreadsheet
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import {
    getReportsData,
    getMonthOccurrencesDetails,
    getMonthAttendancesDetails,
    getMonthVacanciesDetails,
    getMonthTurnoverDetails
} from "./actions";
import { toast } from "sonner";

const MONTH_NAMES = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", 
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

const MONTH_FULL_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function ReportsClientPage() {
    const [year, setYear] = useState<number>(() => new Date().getFullYear());
    const [activeTab, setActiveTab] = useState<"turnover" | "absenteismo" | "cobertura" | "colaborador" | "recruitment">("turnover");
    
    // Filtros
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCompany, setSelectedCompany] = useState<string>("all");
    const [selectedClient, setSelectedClient] = useState<string>("all");
    const [showOnlyActive, setShowOnlyActive] = useState(true); // Exclusivo da aba colaboradores

    const [sortConfig, setSortConfig] = useState<{
        tab: string;
        key: string;
        direction: "asc" | "desc";
    } | null>(null);

    // Dados
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Estados dos Modais de Detalhamento
    const [openModal, setOpenModal] = useState(false);
    const [modalTitle, setModalTitle] = useState("");
    const [modalSubtitle, setModalSubtitle] = useState("");
    const [modalItems, setModalItems] = useState<any[]>([]);
    const [modalLoading, setModalLoading] = useState(false);
    const [activeModalContext, setActiveModalContext] = useState<{
        type: "turnover" | "absenteismo" | "cobertura" | "colaborador" | "recruitment";
        clientId: string | null;
        employeeId: string | null;
        month: number;
    } | null>(null);

    const loadData = (selectedYear: number) => {
        setLoading(true);
        startTransition(async () => {
            const res = await getReportsData(selectedYear);
            if (res.success) {
                setData(res);
            } else {
                toast.error(res.error || "Erro ao carregar relatórios.");
            }
            setLoading(false);
        });
    };

    useEffect(() => {
        loadData(year);
    }, [year]);

    // Handler para abrir os modais de detalhe ao clicar na célula
    const handleCellClick = async (
        type: "turnover" | "absenteismo" | "cobertura" | "colaborador" | "recruitment",
        clientId: string | null,
        employeeId: string | null,
        month: number,
        title: string,
        subtitle: string
    ) => {
        setModalTitle(title);
        setModalSubtitle(subtitle);
        setModalItems([]);
        setOpenModal(true);
        setModalLoading(true);
        setActiveModalContext({ type, clientId, employeeId, month });

        try {
            if (type === "turnover") {
                if (!clientId) return;
                const res = await getMonthTurnoverDetails(clientId, year, month);
                if (res.success) setModalItems(res.list || []);
            } else if (type === "absenteismo" || type === "colaborador") {
                const res = await getMonthOccurrencesDetails(clientId, employeeId, year, month);
                if (res.success) setModalItems(res.list || []);
            } else if (type === "cobertura") {
                if (!clientId) return;
                const res = await getMonthAttendancesDetails(clientId, year, month);
                if (res.success) setModalItems(res.list || []);
            } else if (type === "recruitment") {
                if (!clientId) return;
                const res = await getMonthVacanciesDetails(clientId, year, month);
                if (res.success) setModalItems(res.list || []);
            }
        } catch (err: any) {
            toast.error("Erro ao carregar detalhes: " + err.message);
        } finally {
            setModalLoading(false);
        }
    };

    const requestSort = (tab: string, key: string) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.tab === tab && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ tab, key, direction });
    };

    const getSortedList = (list: any[], tab: string) => {
        if (!sortConfig || sortConfig.tab !== tab) return list;
        const { key, direction } = sortConfig;
        
        return [...list].sort((a, b) => {
            let valA: any = 0;
            let valB: any = 0;

            if (key === "name") {
                valA = a.clientName || a.employeeName || "";
                valB = b.clientName || b.employeeName || "";
                return direction === "asc" 
                    ? valA.localeCompare(valB) 
                    : valB.localeCompare(valA);
            } else if (key === "company") {
                valA = a.companyName || "";
                valB = b.companyName || "";
                return direction === "asc" 
                    ? valA.localeCompare(valB) 
                    : valB.localeCompare(valA);
            } else if (key === "annual") {
                valA = a.annualRate !== undefined ? a.annualRate : (a.totalOccurrences !== undefined ? a.totalOccurrences : (a.annualFaltas !== undefined ? a.annualFaltas : (a.totalClosed !== undefined ? a.totalClosed : 0)));
                valB = b.annualRate !== undefined ? b.annualRate : (b.totalOccurrences !== undefined ? b.totalOccurrences : (b.annualFaltas !== undefined ? b.annualFaltas : (b.totalClosed !== undefined ? b.totalClosed : 0)));
            } else {
                const mIdx = parseInt(key);
                const monthDataA = a.monthlyData?.[mIdx];
                const monthDataB = b.monthlyData?.[mIdx];
                if (monthDataA && monthDataB) {
                    valA = monthDataA.rate !== undefined ? monthDataA.rate : (monthDataA.total !== undefined ? monthDataA.total : (monthDataA.faltas !== undefined ? monthDataA.faltas : (monthDataA.count !== undefined ? monthDataA.count : 0)));
                    valB = monthDataB.rate !== undefined ? monthDataB.rate : (monthDataB.total !== undefined ? monthDataB.total : (monthDataB.faltas !== undefined ? monthDataB.faltas : (monthDataB.count !== undefined ? monthDataB.count : 0)));
                }
            }

            if (valA < valB) return direction === "asc" ? -1 : 1;
            if (valA > valB) return direction === "asc" ? 1 : -1;
            return 0;
        });
    };

    // Exportação do modal ativo para Excel
    const handleExportModalDetails = () => {
        if (!activeModalContext || modalItems.length === 0) {
            toast.error("Nenhum dado para exportar.");
            return;
        }

        let excelData: any[] = [];
        let sheetName = "Detalhes";

        const { type } = activeModalContext;

        if (type === "turnover") {
            sheetName = "Movimentações Turnover";
            excelData = modalItems.map(item => ({
                Data: format(new Date(item.date + "T12:00:00Z"), "dd/MM/yyyy"),
                Colaborador: item.employeeName,
                Situação: item.situation,
                Cliente: item.clientName,
                Empresa: item.companyName,
                Cargo: item.postoRole,
                Movimentação: item.eventType
            }));
        } else if (type === "absenteismo" || type === "colaborador") {
            sheetName = "Faltas e Atestados";
            excelData = modalItems.map(item => ({
                Data: format(new Date(item.date + "T12:00:00Z"), "dd/MM/yyyy"),
                Contrato: item.clientName,
                Colaborador: item.employeeName,
                Situação: item.situation,
                Tipo: item.type === "ATESTADO" ? "Atestado Médico" : "Falta",
                Justificativa: item.description
            }));
        } else if (type === "cobertura") {
            sheetName = "Mesa de Operações";
            excelData = modalItems.map(item => ({
                Data: format(new Date(item.date + "T12:00:00Z"), "dd/MM/yyyy"),
                Contrato: item.clientName,
                Função: item.postoRole,
                Horário: item.time,
                Escala: item.schedule,
                Titular: item.employeeName,
                Status: item.status,
                CobertoPor: item.coveredByName,
                TipoCobertura: item.coverageType,
                Observação: item.notes
            }));
        } else if (type === "recruitment") {
            sheetName = "Vagas Fechadas";
            excelData = modalItems.map(item => ({
                Vaga: item.title,
                Cliente: item.clientName,
                Cargo: item.postoRole,
                DataAbertura: format(new Date(item.createdAt + "T12:00:00Z"), "dd/MM/yyyy"),
                DataFechamento: format(new Date(item.closedAt + "T12:00:00Z"), "dd/MM/yyyy"),
                TempoFechamentoDias: item.slaDays,
                Recrutador: item.recruiterName
            }));
        }

        const ws = XLSX.utils.json_to_sheet(excelData);
        const colWidths = Object.keys(excelData[0]).map(key => ({
            wch: Math.max(key.length + 3, ...excelData.map(row => String(row[key] || '').length + 2))
        }));
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, `relatorio_detalhes_${type}_${year}_${activeModalContext.month + 1}.xlsx`);
        toast.success("Detalhes exportados com sucesso!");
    };

    // Exportação geral da aba atual para Excel
    const handleExportAnnualMatrix = () => {
        if (!data) return;

        let excelData: any[] = [];
        let filename = `relatorio_anual_${activeTab}_${year}.xlsx`;
        let sheetName = "Relatório Anual";

        if (activeTab === "turnover") {
            const list = data.turnoverReport
                .filter((c: any) => selectedCompany === "all" || c.companyName === selectedCompany)
                .filter((c: any) => selectedClient === "all" || c.clientName === selectedClient)
                .filter((c: any) => 
                    c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.companyName.toLowerCase().includes(searchQuery.toLowerCase())
                );
            excelData = list.map((c: any) => {
                const row: any = {
                    Cliente: c.clientName,
                    Empresa: c.companyName
                };
                MONTH_NAMES.forEach((m, idx) => {
                    const monthVal = c.monthlyData[idx];
                    row[`${m} - Admissões`] = monthVal.admissions;
                    row[`${m} - Demissões`] = monthVal.departures;
                    row[`${m} - Headcount`] = monthVal.headcount;
                    row[`${m} - Taxa Turnover`] = `${monthVal.rate.toFixed(1)}%`;
                });
                row["Total Admissões Ano"] = c.totalAdmissions;
                row["Total Demissões Ano"] = c.totalDepartures;
                row["Média Headcount Ano"] = c.avgHeadcount;
                row["Taxa Turnover Acumulada Ano"] = `${c.annualRate.toFixed(1)}%`;
                return row;
            });
            sheetName = "Turnover Geral";
        } else if (activeTab === "absenteismo") {
            const list = data.absenteismoReport
                .filter((c: any) => selectedCompany === "all" || c.companyName === selectedCompany)
                .filter((c: any) => selectedClient === "all" || c.clientName === selectedClient)
                .filter((c: any) => 
                    c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.companyName.toLowerCase().includes(searchQuery.toLowerCase())
                );
            excelData = list.map((c: any) => {
                const row: any = {
                    Cliente: c.clientName,
                    Empresa: c.companyName
                };
                MONTH_NAMES.forEach((m, idx) => {
                    const monthVal = c.monthlyData[idx];
                    row[`${m} - Faltas`] = monthVal.faltas;
                    row[`${m} - Atestados`] = monthVal.atestados;
                    row[`${m} - Escalas Previstas`] = monthVal.escalasPrevistas;
                    row[`${m} - Taxa Absenteísmo`] = `${monthVal.rate.toFixed(1)}%`;
                });
                row["Total Faltas Ano"] = c.totalFaltas;
                row["Total Atestados Ano"] = c.totalAtestados;
                row["Total Escalas Previstas Ano"] = c.totalEscalasPrevistas;
                row["Média Absenteísmo Anual"] = `${c.annualRate.toFixed(1)}%`;
                return row;
            });
            sheetName = "Absenteísmo Secullum";
        } else if (activeTab === "cobertura") {
            const list = data.coberturaReport
                .filter((c: any) => selectedCompany === "all" || c.companyName === selectedCompany)
                .filter((c: any) => selectedClient === "all" || c.clientName === selectedClient)
                .filter((c: any) => 
                    c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.companyName.toLowerCase().includes(searchQuery.toLowerCase())
                );
            excelData = list.map((c: any) => {
                const row: any = {
                    Cliente: c.clientName,
                    Empresa: c.companyName
                };
                MONTH_NAMES.forEach((m, idx) => {
                    const monthVal = c.monthlyData[idx];
                    row[`${m} - Faltas Mesa`] = monthVal.totalFaltas;
                    row[`${m} - Faltas Cobertas`] = monthVal.totalCobertas;
                    row[`${m} - Taxa Cobertura`] = `${monthVal.rate.toFixed(1)}%`;
                });
                row["Total Faltas Mesa Ano"] = c.annualFaltas;
                row["Total Faltas Cobertas Ano"] = c.annualCobertas;
                row["Média Cobertura Anual"] = `${c.annualRate.toFixed(1)}%`;
                return row;
            });
            sheetName = "Índice de Cobertura";
        } else if (activeTab === "colaborador") {
            const list = data.colaboradorReport
                .filter((emp: any) => !showOnlyActive || emp.status === "Ativo")
                .filter((emp: any) => selectedCompany === "all" || emp.companyName === selectedCompany)
                .filter((emp: any) => selectedClient === "all" || emp.clientName === selectedClient)
                .filter((emp: any) => 
                    emp.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    emp.roleName.toLowerCase().includes(searchQuery.toLowerCase())
                );
            excelData = list.map((e: any) => {
                const row: any = {
                    Colaborador: e.employeeName,
                    Cargo: e.roleName,
                    Situação: e.situationName,
                    Status: e.status
                };
                MONTH_NAMES.forEach((m, idx) => {
                    const monthVal = e.monthlyData[idx];
                    row[`${m} - Faltas`] = monthVal.faltas;
                    row[`${m} - Atestados`] = monthVal.atestados;
                    row[`${m} - Total`] = monthVal.total;
                });
                row["Total Faltas Ano"] = e.totalFaltas;
                row["Total Atestados Ano"] = e.totalAtestados;
                row["Total Acumulado Ano"] = e.totalOccurrences;
                return row;
            });
            sheetName = "Faltas por Colaborador";
        } else if (activeTab === "recruitment") {
            const list = data.recruitmentReport
                .filter((c: any) => selectedCompany === "all" || c.companyName === selectedCompany)
                .filter((c: any) => selectedClient === "all" || c.clientName === selectedClient)
                .filter((c: any) => 
                    c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.companyName.toLowerCase().includes(searchQuery.toLowerCase())
                );
            excelData = list.map((c: any) => {
                const row: any = {
                    Cliente: c.clientName,
                    Empresa: c.companyName
                };
                MONTH_NAMES.forEach((m, idx) => {
                    const monthVal = c.monthlyData[idx];
                    row[`${m} - Vagas Fechadas`] = monthVal.count;
                    row[`${m} - SLA Médio (Dias)`] = monthVal.avgSla;
                });
                row["Total Vagas Fechadas Ano"] = c.totalClosed;
                row["SLA Médio Anual"] = `${c.annualSla} dias`;
                return row;
            });
            sheetName = "R&S SLA Vagas";
        }

        const wb = XLSX.utils.book_new();

        // 1. Sheet 1: Matrix Resumo
        const ws1 = XLSX.utils.json_to_sheet(excelData);
        if (excelData.length > 0) {
            const colWidths1 = Object.keys(excelData[0]).map(key => ({
                wch: Math.max(key.length + 3, ...excelData.map(row => String(row[key] || '').length + 2))
            }));
            ws1['!cols'] = colWidths1;
        }
        XLSX.utils.book_append_sheet(wb, ws1, sheetName);

        // 2. Sheet 2: Detalhamento de Ocorrências / Movimentações (Nível Analítico com nomes e datas)
        let detailedData: any[] = [];
        let detailedSheetName = "Detalhamento";

        if (activeTab === "turnover") {
            detailedSheetName = "Movimentações Detalhadas";
            const rawList = (data.turnoverRawEvents || [])
                .filter((item: any) => selectedCompany === "all" || item.companyName === selectedCompany)
                .filter((item: any) => selectedClient === "all" || item.clientName === selectedClient)
                .filter((item: any) => 
                    item.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.clientName.toLowerCase().includes(searchQuery.toLowerCase())
                );
            detailedData = rawList.map((item: any) => ({
                Data: format(new Date(item.date + "T12:00:00Z"), "dd/MM/yyyy"),
                Colaborador: item.employeeName,
                Situação: item.situation,
                Cliente: item.clientName,
                Empresa: item.companyName,
                Cargo: item.postoRole,
                Movimentação: item.eventType
            }));
        } else if (activeTab === "absenteismo") {
            detailedSheetName = "Ocorrências Detalhadas";
            const rawList = (data.absenteismoRawEvents || [])
                .filter((item: any) => selectedCompany === "all" || item.companyName === selectedCompany)
                .filter((item: any) => selectedClient === "all" || item.clientName === selectedClient)
                .filter((item: any) => 
                    item.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.clientName.toLowerCase().includes(searchQuery.toLowerCase())
                );
            detailedData = rawList.map((item: any) => ({
                Data: format(new Date(item.date + "T12:00:00Z"), "dd/MM/yyyy"),
                Contrato: item.clientName,
                Empresa: item.companyName,
                Cargo: item.postoRole,
                Colaborador: item.employeeName,
                Situação: item.situation,
                Tipo: item.type,
                Justificativa: item.description
            }));
        } else if (activeTab === "cobertura") {
            detailedSheetName = "Detalhamento Mesa";
            const rawList = (data.coberturaRawEvents || [])
                .filter((item: any) => selectedCompany === "all" || item.companyName === selectedCompany)
                .filter((item: any) => selectedClient === "all" || item.clientName === selectedClient)
                .filter((item: any) => 
                    item.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.clientName.toLowerCase().includes(searchQuery.toLowerCase())
                );
            detailedData = rawList.map((item: any) => ({
                Data: format(new Date(item.date + "T12:00:00Z"), "dd/MM/yyyy"),
                Contrato: item.clientName,
                Empresa: item.companyName,
                Função: item.postoRole,
                Horário: item.time,
                Escala: item.schedule,
                Titular: item.employeeName,
                Status: item.status,
                CobertoPor: item.coveredByName,
                TipoCobertura: item.coverageType,
                Observação: item.notes
            }));
        } else if (activeTab === "recruitment") {
            detailedSheetName = "Vagas Detalhadas";
            const rawList = (data.recruitmentRawEvents || [])
                .filter((item: any) => selectedCompany === "all" || item.companyName === selectedCompany)
                .filter((item: any) => selectedClient === "all" || item.clientName === selectedClient)
                .filter((item: any) => 
                    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.clientName.toLowerCase().includes(searchQuery.toLowerCase())
                );
            detailedData = rawList.map((item: any) => ({
                Vaga: item.title,
                Cliente: item.clientName,
                Empresa: item.companyName,
                Cargo: item.postoRole,
                DataAbertura: format(new Date(item.createdAt + "T12:00:00Z"), "dd/MM/yyyy"),
                DataFechamento: format(new Date(item.closedAt + "T12:00:00Z"), "dd/MM/yyyy"),
                TempoFechamentoDias: item.slaDays,
                Recrutador: item.recruiterName
            }));
        }

        // Se houver dados detalhados, adiciona a Sheet 2
        if (detailedData.length > 0) {
            const ws2 = XLSX.utils.json_to_sheet(detailedData);
            const colWidths2 = Object.keys(detailedData[0]).map(key => ({
                wch: Math.max(key.length + 3, ...detailedData.map(row => String(row[key] || '').length + 2))
            }));
            ws2['!cols'] = colWidths2;
            XLSX.utils.book_append_sheet(wb, ws2, detailedSheetName);
        }

        XLSX.writeFile(wb, filename);
        toast.success("Relatório anual com base analítica de detalhamento exportado!");
    };

    const uniqueCompanies = Array.from(
        new Set(
            data?.turnoverReport?.map((c: any) => c.companyName).filter(Boolean) || []
        )
    ).sort() as string[];

    const uniqueClients = Array.from(
        new Set(
            data?.turnoverReport?.map((c: any) => c.clientName).filter(Boolean) || []
        )
    ).sort() as string[];

    return (
        <div className="space-y-6 pb-12 font-sans">
            {/* Cabeçalho */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-[28px] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl pointer-events-none" />
                <div className="space-y-1 relative z-10">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-indigo-400" />
                        <h1 className="text-2xl font-black tracking-tight">Painel de Relatórios Analíticos</h1>
                    </div>
                    <p className="text-slate-400 text-xs font-semibold">Consolidado de Turnover, Absenteísmo, Cobertura, Faltas e Recrutamento anual.</p>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    <label className="text-xs font-black text-slate-300 uppercase tracking-wider">Ano Base:</label>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="h-10 w-28 rounded-xl border border-slate-700 bg-slate-800 text-white text-xs font-bold px-3 outline-none cursor-pointer hover:border-slate-600 transition-colors"
                    >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Menu de Abas */}
            <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-2xl w-full border border-slate-200/60 shadow-inner">
                {[
                    { id: "turnover", label: "Turnover Substituições", icon: TrendingUp },
                    { id: "absenteismo", label: "Absenteísmo (Secullum)", icon: AlertTriangle },
                    { id: "cobertura", label: "Índice de Cobertura", icon: Percent },
                    { id: "colaborador", label: "Faltas por Colaborador", icon: Users },
                    { id: "recruitment", label: "Recrutamento & SLA", icon: Briefcase }
                ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id as any);
                                setSearchQuery("");
                            }}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isActive 
                                    ? "bg-white text-slate-900 shadow-md scale-102 font-black" 
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Filtros Globais */}
            {data && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Filtrar por Empresa</label>
                        <select
                            value={selectedCompany}
                            onChange={(e) => setSelectedCompany(e.target.value)}
                            className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer"
                        >
                            <option value="all">Todas as Empresas</option>
                            {uniqueCompanies.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Filtrar por Cliente / Posto</label>
                        <select
                            value={selectedClient}
                            onChange={(e) => setSelectedClient(e.target.value)}
                            className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer"
                        >
                            <option value="all">Todos os Clientes</option>
                            {uniqueClients.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            {activeTab === "colaborador" ? "Pesquisar Colaborador" : "Buscar na Tabela"}
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                type="text"
                                placeholder={activeTab === "colaborador" ? "Digite o nome ou função..." : "Filtrar por nome do cliente..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 text-xs h-10 border-slate-200"
                            />
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="py-24 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-400 mt-4 animate-pulse">Carregando relatórios anuais...</p>
                </div>
            ) : !data ? (
                <div className="py-24 text-center bg-white rounded-3xl border border-slate-200 shadow-sm font-semibold text-slate-500 text-xs">
                    Nenhum dado encontrado para o ano {year}.
                </div>
            ) : (
                <div className="space-y-6">
                    {/* 1. SEÇÃO TURNOVER */}
                    {activeTab === "turnover" && (
                        <>
                            {/* KPI Banner */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="p-5 border-none shadow-premium bg-gradient-to-br from-indigo-50 to-white hover:scale-101 transition-transform">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Substituições no Ano</p>
                                            <h3 className="text-2xl font-black text-slate-900 mt-1">{data.kpis.turnover.totalSubs}</h3>
                                        </div>
                                        <div className="p-2 bg-indigo-500/10 rounded-lg"><Users className="w-5 h-5 text-indigo-600" /></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-3">Novas alocações registradas no ano {year}</p>
                                </Card>

                                <Card className="p-5 border-none shadow-premium bg-gradient-to-br from-indigo-50 to-white hover:scale-101 transition-transform">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Taxa Média de Turnover</p>
                                            <h3 className="text-2xl font-black text-slate-900 mt-1">{data.kpis.turnover.avgRate}%</h3>
                                        </div>
                                        <div className="p-2 bg-indigo-500/10 rounded-lg"><Percent className="w-5 h-5 text-indigo-600" /></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-3">Média aritmética anual de rotatividade</p>
                                </Card>

                                <Card className="p-5 border-none shadow-premium bg-gradient-to-br from-indigo-50 to-white hover:scale-101 transition-transform">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Maior Rotatividade</p>
                                            <h3 className="text-sm font-black text-indigo-700 mt-2.5 truncate max-w-[200px]" title={data.kpis.turnover.highestClient}>
                                                {data.kpis.turnover.highestClient}
                                            </h3>
                                        </div>
                                        <div className="p-2 bg-indigo-500/10 rounded-lg"><TrendingUp className="w-5 h-5 text-indigo-600" /></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-3">Contrato com maior taxa de substituição</p>
                                </Card>
                            </div>

                            {/* Filtros e Ações */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-2">Dados Consolidados</div>
                                <Button onClick={handleExportAnnualMatrix} size="sm" className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs h-9 cursor-pointer gap-1.5 text-white">
                                    <FileSpreadsheet className="w-4 h-4" /> Exportar Planilha Anual
                                </Button>
                            </div>

                            {/* Tabela Turnover */}
                            <Card className="border-none shadow-premium bg-white overflow-hidden rounded-[20px]">
                                <div className="w-full overflow-x-auto">
                                    <Table className="min-w-[1000px]">
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">Cliente / Contrato</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Empresa</TableHead>
                                                {MONTH_NAMES.map(m => (
                                                    <TableHead key={m} className="font-bold text-slate-800 text-xs text-center py-2.5">{m}</TableHead>
                                                ))}
                                                <TableHead className="font-bold text-indigo-850 text-xs text-right pr-6 py-2.5">Acumulado Ano</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.turnoverReport
                                                .filter((c: any) => selectedCompany === "all" || c.companyName === selectedCompany)
                                                .filter((c: any) => selectedClient === "all" || c.clientName === selectedClient)
                                                .filter((c: any) => 
                                                    c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    c.companyName.toLowerCase().includes(searchQuery.toLowerCase())
                                                )
                                                .map((c: any) => (
                                                    <TableRow key={c.clientId} className="hover:bg-slate-50/50">
                                                        <TableCell className="pl-6 py-2.5 text-xs font-bold text-slate-800">{c.clientName}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-550 font-medium">{c.companyName}</TableCell>
                                                        {MONTH_NAMES.map((m, idx) => {
                                                            const val = c.monthlyData[idx];
                                                            return (
                                                                <TableCell 
                                                                    key={m} 
                                                                    onClick={() => (val.admissions > 0 || val.departures > 0) && handleCellClick(
                                                                        "turnover",
                                                                        c.clientId,
                                                                        null,
                                                                        idx,
                                                                        `Movimentações de Turnover - ${c.clientName}`,
                                                                        `Admissões e demissões no mês de ${MONTH_FULL_NAMES[idx]} de ${year}.`
                                                                    )}
                                                                    className={`py-2.5 text-xs text-center font-bold transition-colors ${
                                                                        (val.admissions > 0 || val.departures > 0) 
                                                                            ? "text-indigo-650 hover:text-indigo-850 hover:bg-indigo-50/50 cursor-pointer underline decoration-dotted" 
                                                                            : "text-slate-400"
                                                                    }`}
                                                                >
                                                                    {val.rate > 0 ? `${val.rate.toFixed(1)}%` : "-"}
                                                                </TableCell>
                                                            );
                                                        })}
                                                        <TableCell className="py-2.5 text-xs text-right pr-6 font-black text-indigo-700">
                                                            {c.annualRate.toFixed(1)}%
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            }
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        </>
                    )}

                    {/* 2. SEÇÃO ABSENTEÍSMO */}
                    {activeTab === "absenteismo" && (
                        <>
                            {/* KPI Banner */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="p-5 border-none shadow-premium bg-gradient-to-br from-amber-50 to-white hover:scale-101 transition-transform">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Absenteísmo Médio Geral</p>
                                            <h3 className="text-2xl font-black text-slate-900 mt-1">{data.kpis.absenteismo.avgRate}%</h3>
                                        </div>
                                        <div className="p-2 bg-amber-500/10 rounded-lg"><Percent className="w-5 h-5 text-amber-600" /></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-3">Média anual de todas as ausências</p>
                                </Card>

                                <Card className="p-5 border-none shadow-premium bg-gradient-to-br from-amber-50 to-white hover:scale-101 transition-transform">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Mês com Maior Volume</p>
                                            <h3 className="text-2xl font-black text-slate-900 mt-1">{data.kpis.absenteismo.criticalMonth}</h3>
                                        </div>
                                        <div className="p-2 bg-amber-500/10 rounded-lg"><Calendar className="w-5 h-5 text-amber-600" /></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-3">Mês com maior volume de faltas/atestados</p>
                                </Card>

                                <Card className="p-5 border-none shadow-premium bg-gradient-to-br from-amber-50 to-white hover:scale-101 transition-transform">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Contrato Mais Crítico</p>
                                            <h3 className="text-sm font-black text-amber-700 mt-2.5 truncate max-w-[200px]" title={data.kpis.absenteismo.highestClient}>
                                                {data.kpis.absenteismo.highestClient}
                                            </h3>
                                        </div>
                                        <div className="p-2 bg-amber-500/10 rounded-lg"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-3">Contrato com a maior taxa de absenteísmo</p>
                                </Card>
                            </div>

                            {/* Filtros e Ações */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-2">Dados Consolidados</div>
                                <Button onClick={handleExportAnnualMatrix} size="sm" className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs h-9 cursor-pointer gap-1.5 text-white">
                                    <FileSpreadsheet className="w-4 h-4" /> Exportar Planilha Anual
                                </Button>
                            </div>

                            {/* Tabela Absenteísmo */}
                            <Card className="border-none shadow-premium bg-white overflow-hidden rounded-[20px]">
                                <div className="w-full overflow-x-auto">
                                    <Table className="min-w-[1000px]">
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">Cliente / Contrato</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Empresa</TableHead>
                                                {MONTH_NAMES.map(m => (
                                                    <TableHead key={m} className="font-bold text-slate-800 text-xs text-center py-2.5">{m}</TableHead>
                                                ))}
                                                <TableHead className="font-bold text-amber-850 text-xs text-right pr-6 py-2.5">Média Anual</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.absenteismoReport
                                                .filter((c: any) => selectedCompany === "all" || c.companyName === selectedCompany)
                                                .filter((c: any) => selectedClient === "all" || c.clientName === selectedClient)
                                                .filter((c: any) => 
                                                    c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    c.companyName.toLowerCase().includes(searchQuery.toLowerCase())
                                                )
                                                .map((c: any) => (
                                                    <TableRow key={c.clientId} className="hover:bg-slate-50/50">
                                                        <TableCell className="pl-6 py-2.5 text-xs font-bold text-slate-800">{c.clientName}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-550 font-medium">{c.companyName}</TableCell>
                                                        {MONTH_NAMES.map((m, idx) => {
                                                            const val = c.monthlyData[idx];
                                                            return (
                                                                <TableCell 
                                                                    key={m} 
                                                                    onClick={() => val.totalOccurrences > 0 && handleCellClick(
                                                                        "absenteismo",
                                                                        c.clientId,
                                                                        null,
                                                                        idx,
                                                                        `Detalhamento de Absenteísmo - ${c.clientName}`,
                                                                        `Total de ${val.totalOccurrences} ocorrências (Secullum) encontradas para o mês de ${MONTH_FULL_NAMES[idx]} de ${year}.`
                                                                    )}
                                                                    className={`py-2.5 text-xs text-center font-bold transition-colors ${
                                                                        val.totalOccurrences > 0 
                                                                            ? "text-amber-600 hover:text-amber-850 hover:bg-amber-50/50 cursor-pointer underline decoration-dotted" 
                                                                            : "text-slate-400"
                                                                    }`}
                                                                >
                                                                    {val.rate > 0 ? `${val.rate.toFixed(1)}%` : "-"}
                                                                </TableCell>
                                                            );
                                                        })}
                                                        <TableCell className="py-2.5 text-xs text-right pr-6 font-black text-amber-700">
                                                            {c.annualRate.toFixed(1)}%
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            }
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        </>
                    )}

                    {/* 3. SEÇÃO ÍNDICE DE COBERTURA */}
                    {activeTab === "cobertura" && (
                        <>
                            {/* KPI Banner */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="p-5 border-none shadow-premium bg-gradient-to-br from-indigo-50 to-white hover:scale-101 transition-transform">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cobertura Média Geral</p>
                                            <h3 className="text-2xl font-black text-slate-900 mt-1">{data.kpis.cobertura.avgRate}%</h3>
                                        </div>
                                        <div className="p-2 bg-indigo-500/10 rounded-lg"><Percent className="w-5 h-5 text-indigo-600" /></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-3">Média de tratativas da mesa de operações</p>
                                </Card>

                                <Card className="p-5 border-none shadow-premium bg-gradient-to-br from-indigo-50 to-white hover:scale-101 transition-transform">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total de Faltas no Ano</p>
                                            <h3 className="text-2xl font-black text-slate-900 mt-1">{data.kpis.cobertura.totalFaltas}</h3>
                                        </div>
                                        <div className="p-2 bg-indigo-500/10 rounded-lg"><AlertTriangle className="w-5 h-5 text-indigo-600" /></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-3">Total de ausências registradas no painel</p>
                                </Card>

                                <Card className="p-5 border-none shadow-premium bg-gradient-to-br from-indigo-50 to-white hover:scale-101 transition-transform">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Faltas Cobertas</p>
                                            <h3 className="text-2xl font-black text-slate-900 mt-1">
                                                {data.kpis.cobertura.totalCobertas} <span className="text-xs text-slate-400 font-bold">({data.kpis.cobertura.totalFaltas - data.kpis.cobertura.totalCobertas} glosas)</span>
                                            </h3>
                                        </div>
                                        <div className="p-2 bg-indigo-500/10 rounded-lg"><CheckCircle2 className="w-5 h-5 text-indigo-600" /></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-3">Plantões cobertos por RT ou Diarista</p>
                                </Card>
                            </div>

                            {/* Filtros e Ações */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-2">Dados Consolidados</div>
                                <Button onClick={handleExportAnnualMatrix} size="sm" className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs h-9 cursor-pointer gap-1.5 text-white">
                                    <FileSpreadsheet className="w-4 h-4" /> Exportar Planilha Anual
                                </Button>
                            </div>

                            {/* Tabela Cobertura */}
                            <Card className="border-none shadow-premium bg-white overflow-hidden rounded-[20px]">
                                <div className="w-full overflow-x-auto">
                                    <Table className="min-w-[1000px]">
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">Cliente / Contrato</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Empresa</TableHead>
                                                {MONTH_NAMES.map(m => (
                                                    <TableHead key={m} className="font-bold text-slate-800 text-xs text-center py-2.5">{m}</TableHead>
                                                ))}
                                                <TableHead className="font-bold text-indigo-850 text-xs text-right pr-6 py-2.5">Média Anual</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.coberturaReport
                                                .filter((c: any) => selectedCompany === "all" || c.companyName === selectedCompany)
                                                .filter((c: any) => selectedClient === "all" || c.clientName === selectedClient)
                                                .filter((c: any) => 
                                                    c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    c.companyName.toLowerCase().includes(searchQuery.toLowerCase())
                                                )
                                                .map((c: any) => (
                                                    <TableRow key={c.clientId} className="hover:bg-slate-50/50">
                                                        <TableCell className="pl-6 py-2.5 text-xs font-bold text-slate-800">{c.clientName}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-550 font-medium">{c.companyName}</TableCell>
                                                        {MONTH_NAMES.map((m, idx) => {
                                                            const val = c.monthlyData[idx];
                                                            return (
                                                                <TableCell 
                                                                    key={m} 
                                                                    onClick={() => val.totalFaltas > 0 && handleCellClick(
                                                                        "cobertura",
                                                                        c.clientId,
                                                                        null,
                                                                        idx,
                                                                        `Mesa de Operações - Detalhes de Cobertura - ${c.clientName}`,
                                                                        `Total de ${val.totalFaltas} ausências registradas para o mês de ${MONTH_FULL_NAMES[idx]} de ${year}.`
                                                                    )}
                                                                    className={`py-2.5 text-xs text-center font-bold transition-colors ${
                                                                        val.totalFaltas > 0 
                                                                            ? "text-indigo-600 hover:text-indigo-850 hover:bg-indigo-50/50 cursor-pointer underline decoration-dotted" 
                                                                            : "text-slate-400"
                                                                    }`}
                                                                >
                                                                    {val.totalFaltas > 0 ? `${val.rate.toFixed(0)}%` : "-"}
                                                                </TableCell>
                                                            );
                                                        })}
                                                        <TableCell className="py-2.5 text-xs text-right pr-6 font-black text-indigo-700">
                                                            {c.annualRate.toFixed(1)}%
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            }
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        </>
                    )}

                    {/* 4. SEÇÃO FALTAS POR COLABORADOR */}
                    {activeTab === "colaborador" && (
                        <>
                            {/* KPI Banner */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="p-5 border-none shadow-premium bg-gradient-to-br from-slate-50 to-white hover:scale-101 transition-transform">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Colaboradores Ativos</p>
                                            <h3 className="text-2xl font-black text-slate-900 mt-1">{data.kpis.colaborador.activeCount}</h3>
                                        </div>
                                        <div className="p-2 bg-slate-500/10 rounded-lg"><UserCheck className="w-5 h-5 text-slate-650" /></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-3">Colaboradores ativos na base hoje</p>
                                </Card>

                                <Card className="p-5 border-none shadow-premium bg-gradient-to-br from-slate-50 to-white hover:scale-101 transition-transform">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Acumulado de Faltas no Ano</p>
                                            <h3 className="text-2xl font-black text-slate-900 mt-1">{data.kpis.colaborador.totalFaltas}</h3>
                                        </div>
                                        <div className="p-2 bg-slate-500/10 rounded-lg"><AlertTriangle className="w-5 h-5 text-slate-650" /></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-3">Soma de faltas e atestados do Secullum</p>
                                </Card>

                                <Card className="p-5 border-none shadow-premium bg-gradient-to-br from-slate-50 to-white hover:scale-101 transition-transform">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Maior Incidência</p>
                                            <h3 className="text-sm font-black text-slate-800 mt-2.5 truncate max-w-[200px]" title={data.kpis.colaborador.highestColab}>
                                                {data.kpis.colaborador.highestColab}
                                            </h3>
                                        </div>
                                        <div className="p-2 bg-slate-500/10 rounded-lg"><Users className="w-5 h-5 text-slate-650" /></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-3">Colaborador com maior número de ausências</p>
                                </Card>
                            </div>

                            {/* Filtros e Ações */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
                                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/50">
                                    <span className="text-[10px] font-bold text-slate-550 uppercase">Exibir Apenas Ativos:</span>
                                    <input
                                        type="checkbox"
                                        checked={showOnlyActive}
                                        onChange={(e) => setShowOnlyActive(e.target.checked)}
                                        className="h-4 w-4 accent-indigo-650 cursor-pointer"
                                    />
                                </div>
                                <Button onClick={handleExportAnnualMatrix} size="sm" className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs h-9 cursor-pointer gap-1.5 text-white">
                                    <FileSpreadsheet className="w-4 h-4" /> Exportar Planilha Anual
                                </Button>
                            </div>

                            {/* Tabela Colaboradores */}
                            <Card className="border-none shadow-premium bg-white overflow-hidden rounded-[20px]">
                                <div className="w-full overflow-x-auto">
                                    <Table className="min-w-[1000px]">
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead 
                                                    onClick={() => requestSort("colaborador", "name")} 
                                                    className="font-bold text-slate-800 text-xs pl-6 py-2.5 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                                                >
                                                    Colaborador {sortConfig?.tab === "colaborador" && sortConfig?.key === "name" && (sortConfig?.direction === "asc" ? "▲" : "▼")}
                                                </TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Função</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Situação</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Status</TableHead>
                                                {MONTH_NAMES.map((m, idx) => (
                                                    <TableHead 
                                                        key={m} 
                                                        onClick={() => requestSort("colaborador", String(idx))}
                                                        className="font-bold text-slate-800 text-xs text-center py-2.5 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                                                    >
                                                        {m} {sortConfig?.tab === "colaborador" && sortConfig?.key === String(idx) && (sortConfig?.direction === "asc" ? "▲" : "▼")}
                                                    </TableHead>
                                                ))}
                                                <TableHead 
                                                    onClick={() => requestSort("colaborador", "annual")}
                                                    className="font-bold text-indigo-850 text-xs text-right pr-6 py-2.5 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                                                >
                                                    Acumulado Ano {sortConfig?.tab === "colaborador" && sortConfig?.key === "annual" && (sortConfig?.direction === "asc" ? "▲" : "▼")}
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {getSortedList(
                                                data.colaboradorReport
                                                    .filter((e: any) => !showOnlyActive || e.status === "Ativo")
                                                    .filter((e: any) => selectedCompany === "all" || e.companyName === selectedCompany)
                                                    .filter((e: any) => selectedClient === "all" || e.clientName === selectedClient)
                                                    .filter((e: any) => 
                                                        e.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                        e.roleName.toLowerCase().includes(searchQuery.toLowerCase())
                                                    ),
                                                "colaborador"
                                            ).map((e: any) => (
                                                <TableRow key={e.employeeId} className="hover:bg-slate-50/50">
                                                    <TableCell className="pl-6 py-2.5 text-xs font-bold text-slate-800">{e.employeeName}</TableCell>
                                                    <TableCell className="py-2.5 text-xs text-slate-600 font-medium">{e.roleName}</TableCell>
                                                    <TableCell className="py-2.5 text-xs text-slate-500 font-medium">{e.situationName}</TableCell>
                                                    <TableCell className="py-2.5 text-xs text-center">
                                                        <Badge className={`text-[9px] font-black uppercase ${
                                                            e.status === "Ativo" 
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                                                : "bg-red-50 text-red-750 border-red-100"
                                                        }`}>
                                                            {e.status}
                                                        </Badge>
                                                    </TableCell>
                                                    {MONTH_NAMES.map((m, idx) => {
                                                        const val = e.monthlyData[idx];
                                                        return (
                                                            <TableCell 
                                                                key={m}
                                                                onClick={() => val.total > 0 && handleCellClick(
                                                                    "colaborador",
                                                                    null,
                                                                    e.employeeId,
                                                                    idx,
                                                                    `Ocorrências de Faltas - ${e.employeeName}`,
                                                                    `Total de ${val.total} ausências encontradas para o mês de ${MONTH_FULL_NAMES[idx]} de ${year}.`
                                                                )}
                                                                className={`py-2.5 text-xs text-center font-bold transition-colors ${
                                                                    val.total > 0 
                                                                        ? "text-slate-800 hover:text-indigo-650 hover:bg-slate-100/50 cursor-pointer underline decoration-dotted" 
                                                                        : "text-slate-350"
                                                                }`}
                                                            >
                                                                {val.total > 0 ? val.total : "-"}
                                                            </TableCell>
                                                        );
                                                    })}
                                                    <TableCell 
                                                        onClick={() => e.totalOccurrences > 0 && handleCellClick(
                                                            "colaborador",
                                                            null,
                                                            e.employeeId,
                                                            -1,
                                                            `Ocorrências de Faltas - ${e.employeeName}`,
                                                            `Total de ${e.totalOccurrences} ausências acumuladas no ano de ${year}.`
                                                        )}
                                                        className={`py-2.5 text-xs text-right pr-6 font-black transition-colors ${
                                                            e.totalOccurrences > 0 
                                                                ? "text-indigo-650 hover:text-indigo-850 hover:bg-indigo-50/50 cursor-pointer underline decoration-dotted" 
                                                                : "text-slate-900"
                                                        }`}
                                                    >
                                                        {e.totalOccurrences}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                            }
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        </>
                    )}

                    {/* 5. SEÇÃO RECRUTAMENTO & SLA */}
                    {activeTab === "recruitment" && (
                        <>
                            {/* KPI Banner */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="p-5 border-none shadow-premium bg-gradient-to-br from-indigo-50 to-white hover:scale-101 transition-transform">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Vagas Fechadas no Ano</p>
                                            <h3 className="text-2xl font-black text-slate-900 mt-1">{data.kpis.recruitment.totalClosed}</h3>
                                        </div>
                                        <div className="p-2 bg-indigo-500/10 rounded-lg"><Briefcase className="w-5 h-5 text-indigo-600" /></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-3">Processos finalizados com contratação no ano {year}</p>
                                </Card>

                                <Card className="p-5 border-none shadow-premium bg-gradient-to-br from-indigo-50 to-white hover:scale-101 transition-transform">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">SLA Médio de Fechamento</p>
                                            <h3 className="text-2xl font-black text-slate-900 mt-1">{data.kpis.recruitment.avgSla} <span className="text-xs text-slate-450 font-bold">dias</span></h3>
                                        </div>
                                        <div className="p-2 bg-indigo-500/10 rounded-lg"><Clock className="w-5 h-5 text-indigo-600" /></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-3">Média de dias desde a abertura ao fechamento</p>
                                </Card>

                                <Card className="p-5 border-none shadow-premium bg-gradient-to-br from-indigo-50 to-white hover:scale-101 transition-transform">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Maior Demanda</p>
                                            <h3 className="text-sm font-black text-indigo-700 mt-2.5 truncate max-w-[200px]" title={data.kpis.recruitment.highestClient}>
                                                {data.kpis.recruitment.highestClient}
                                            </h3>
                                        </div>
                                        <div className="p-2 bg-indigo-500/10 rounded-lg"><Users className="w-5 h-5 text-indigo-600" /></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-3">Contrato com maior número de vagas fechadas</p>
                                </Card>
                            </div>

                            {/* Filtros e Ações */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-2">Dados Consolidados</div>
                                <Button onClick={handleExportAnnualMatrix} size="sm" className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs h-9 cursor-pointer gap-1.5 text-white">
                                    <FileSpreadsheet className="w-4 h-4" /> Exportar Planilha Anual
                                </Button>
                            </div>

                            {/* Tabela R&S */}
                            <Card className="border-none shadow-premium bg-white overflow-hidden rounded-[20px]">
                                <div className="w-full overflow-x-auto">
                                    <Table className="min-w-[1050px]">
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">Cliente / Contrato</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Empresa</TableHead>
                                                {MONTH_NAMES.map(m => (
                                                    <TableHead key={m} className="font-bold text-slate-800 text-xs text-center py-2.5">{m}</TableHead>
                                                ))}
                                                <TableHead className="font-bold text-indigo-850 text-xs text-right pr-6 py-2.5">Total Vagas (SLA Médio)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.recruitmentReport
                                                .filter((c: any) => selectedCompany === "all" || c.companyName === selectedCompany)
                                                .filter((c: any) => selectedClient === "all" || c.clientName === selectedClient)
                                                .filter((c: any) => 
                                                    c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    c.companyName.toLowerCase().includes(searchQuery.toLowerCase())
                                                )
                                                .map((c: any) => (
                                                    <TableRow key={c.clientId} className="hover:bg-slate-50/50">
                                                        <TableCell className="pl-6 py-2.5 text-xs font-bold text-slate-800">{c.clientName}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-550 font-medium">{c.companyName}</TableCell>
                                                        {MONTH_NAMES.map((m, idx) => {
                                                            const val = c.monthlyData[idx];
                                                            return (
                                                                <TableCell 
                                                                    key={m}
                                                                    onClick={() => val.count > 0 && handleCellClick(
                                                                        "recruitment",
                                                                        c.clientId,
                                                                        null,
                                                                        idx,
                                                                        `Recrutamento - Vagas Fechadas - ${c.clientName}`,
                                                                        `Vagas preenchidas no mês de ${MONTH_FULL_NAMES[idx]} de ${year}.`
                                                                    )}
                                                                    className={`py-2.5 text-xs text-center font-bold transition-colors ${
                                                                        val.count > 0 
                                                                            ? "text-indigo-650 hover:text-indigo-850 hover:bg-indigo-50/50 cursor-pointer underline decoration-dotted" 
                                                                            : "text-slate-400"
                                                                    }`}
                                                                >
                                                                    {val.count > 0 ? (
                                                                        <div className="flex flex-col items-center">
                                                                            <span>{val.count}</span>
                                                                            <span className="text-[8px] text-slate-400 font-normal mt-0.5">{val.avgSla}d</span>
                                                                        </div>
                                                                    ) : "-"}
                                                                </TableCell>
                                                            );
                                                        })}
                                                        <TableCell className="py-2.5 text-xs text-right pr-6 font-black text-indigo-700">
                                                            {c.totalClosed} vagas ({c.annualSla}d)
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            }
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        </>
                    )}
                </div>
            )}

            {/* Modal Detalhado Multiuso */}
            <Dialog open={openModal} onOpenChange={setOpenModal}>
                <DialogContent className="max-w-[95vw] lg:max-w-5xl xl:max-w-6xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-[24px]">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">{modalTitle}</DialogTitle>
                        <DialogDescription className="text-slate-500 text-xs font-semibold">
                            {modalSubtitle}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overflow-x-auto max-h-[60vh] border-t border-slate-100">
                        {modalLoading ? (
                            <div className="py-16 text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
                                <p className="text-[11px] font-bold text-slate-400 mt-3">Carregando listagem detalhada...</p>
                            </div>
                        ) : modalItems.length === 0 ? (
                            <div className="py-16 text-center text-xs text-slate-500 font-bold">
                                Nenhuma ocorrência encontrada.
                            </div>
                        ) : (
                            <div className="w-full overflow-x-auto">
                                <Table className="min-w-[900px]">
                                    <TableHeader className="bg-slate-50">
                                        {activeModalContext?.type === "turnover" ? (
                                            <TableRow>
                                                <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">Data</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Colaborador</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Situação</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Cliente</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Empresa</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Cargo / Função</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs text-center pr-6 py-2.5">Tipo Movimentação</TableHead>
                                            </TableRow>
                                        ) : activeModalContext?.type === "cobertura" ? (
                                            <TableRow>
                                                <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">Data</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Função</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Horário / Escala</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Colaborador Titular</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Status</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Coberto Por</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Tipo Cobertura</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs pr-6 py-2.5">Observação</TableHead>
                                            </TableRow>
                                        ) : activeModalContext?.type === "recruitment" ? (
                                            <TableRow>
                                                <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">Título da Vaga</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Cliente</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Cargo / Função</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Abertura</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Fechamento</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Tempo (SLA)</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs pr-6 py-2.5">Recrutador</TableHead>
                                            </TableRow>
                                        ) : (
                                            <TableRow>
                                                <TableHead className="font-bold text-slate-800 text-xs pl-6 py-2.5">Data</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Contrato</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Colaborador</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs py-2.5">Situação</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs text-center py-2.5">Tipo</TableHead>
                                                <TableHead className="font-bold text-slate-800 text-xs pr-6 py-2.5">Justificativa</TableHead>
                                            </TableRow>
                                        )}
                                    </TableHeader>
                                    <TableBody>
                                        {modalItems.map((item, idx) => (
                                            <TableRow key={item.id || idx} className="hover:bg-slate-50/50">
                                                {activeModalContext?.type === "turnover" ? (
                                                    <>
                                                        <TableCell className="pl-6 py-2.5 text-xs font-bold text-slate-800">
                                                            {format(new Date(item.date + "T12:00:00Z"), "dd/MM/yyyy")}
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-xs font-bold text-slate-700">{item.employeeName}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-550 font-medium">{item.situation}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-600 font-semibold">{item.clientName}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-550 font-medium">{item.companyName}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-700 font-medium">{item.postoRole}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-center pr-6">
                                                            <Badge className={`text-[9px] font-black uppercase ${
                                                                item.eventType === "Admissão" 
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                                                    : "bg-red-50 text-red-750 border-red-100"
                                                            }`}>
                                                                {item.eventType}
                                                            </Badge>
                                                        </TableCell>
                                                    </>
                                                ) : activeModalContext?.type === "cobertura" ? (
                                                    <>
                                                        <TableCell className="pl-6 py-2.5 text-xs font-bold text-slate-800">
                                                            {format(new Date(item.date + "T12:00:00Z"), "dd/MM/yyyy")}
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-700 font-medium">{item.postoRole}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-655 font-bold">
                                                            {item.time} <span className="text-[9px] font-normal text-slate-400">({item.schedule})</span>
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-700 font-semibold">{item.employeeName}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-center">
                                                            <Badge className={`text-[9px] font-black uppercase ${
                                                                item.status === "Coberto" 
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                                                    : "bg-red-50 text-red-750 border-red-100"
                                                            }`}>
                                                                {item.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-xs">
                                                            {item.status === "Coberto" ? (
                                                                <span className="text-indigo-650 font-bold">{item.coveredByName}</span>
                                                            ) : "-"}
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-xs">
                                                            {item.status === "Coberto" ? (
                                                                <Badge className="bg-indigo-50 border-indigo-150 text-indigo-700 text-[9px] font-black">
                                                                    {item.coverageType}
                                                                </Badge>
                                                            ) : "-"}
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-500 pr-6 max-w-xs truncate" title={item.notes}>
                                                            {item.notes}
                                                        </TableCell>
                                                    </>
                                                ) : activeModalContext?.type === "recruitment" ? (
                                                    <>
                                                        <TableCell className="pl-6 py-2.5 text-xs font-bold text-slate-800">{item.title}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-700 font-semibold">{item.clientName}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-600 font-medium">{item.postoRole}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-center font-bold text-slate-550">
                                                            {format(new Date(item.createdAt + "T12:00:00Z"), "dd/MM/yyyy")}
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-xs text-center font-bold text-slate-550">
                                                            {format(new Date(item.closedAt + "T12:00:00Z"), "dd/MM/yyyy")}
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-xs text-center font-black text-indigo-700">
                                                            {item.slaDays} dias
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-600 font-medium pr-6">{item.recruiterName}</TableCell>
                                                    </>
                                                ) : (
                                                    <>
                                                        <TableCell className="pl-6 py-2.5 text-xs font-bold text-slate-850">
                                                            {format(new Date(item.date + "T12:00:00Z"), "dd/MM/yyyy")}
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-700 font-semibold">{item.clientName}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-800 font-bold">{item.employeeName}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-550 font-medium">{item.situation}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-center">
                                                            <Badge className={`text-[9px] font-black uppercase ${
                                                                item.type === "ATESTADO" 
                                                                    ? "bg-amber-50 text-amber-700 border-amber-100" 
                                                                    : "bg-red-50 text-red-755 border-red-100"
                                                            }`}>
                                                                {item.type === "ATESTADO" ? "Atestado" : "Falta"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-xs text-slate-550 pr-6 max-w-xs truncate" title={item.description}>
                                                            {item.description}
                                                        </TableCell>
                                                    </>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        {modalItems.length > 0 && (
                            <Button 
                                variant="outline" 
                                onClick={handleExportModalDetails} 
                                className="text-xs h-10 border border-slate-200 bg-white gap-1.5 font-bold text-slate-700 cursor-pointer hover:bg-slate-50"
                            >
                                <Download className="w-3.5 h-3.5" /> Exportar Planilha de Detalhes
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => setOpenModal(false)} className="text-xs h-10 border border-slate-200 bg-white cursor-pointer hover:bg-slate-50">
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
