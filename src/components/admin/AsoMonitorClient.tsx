"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter 
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { 
    HeartPulse, 
    AlertTriangle, 
    CheckCircle, 
    Clock, 
    Calendar, 
    Filter, 
    Download, 
    Briefcase, 
    Search, 
    Phone, 
    MessageSquare, 
    Send, 
    Edit, 
    HelpCircle,
    UserCheck,
    Building2,
    RefreshCw,
    ExternalLink
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { AsoEmployeeItem, AsoStats, AsoStatus, updateEmployeeAso, sendManualAsoAlert } from "@/actions/aso";

interface AsoMonitorClientProps {
    initialItems: AsoEmployeeItem[];
    stats: AsoStats;
}

export function AsoMonitorClient({ initialItems, stats }: AsoMonitorClientProps) {
    const [items, setItems] = useState<AsoEmployeeItem[]>(initialItems);
    const [statusFilter, setStatusFilter] = useState<"all" | AsoStatus>("all");
    const [companyFilter, setCompanyFilter] = useState("all");
    const [clientFilter, setClientFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");

    // State for Quick Update Modal
    const [editingEmployee, setEditingEmployee] = useState<AsoEmployeeItem | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        asoDate: "",
        asoDueDate: "",
        asoType: "Periódico",
        asoValidityMonths: "12",
        asoClinic: "",
        asoDoctor: "",
        asoDoctorCrm: "",
        asoDoctorCrmUf: "PR",
        asoApto: "Apto",
        asoNotes: ""
    });

    // State for Alert Sending
    const [isSendingAlert, setIsSendingAlert] = useState<string | null>(null);

    // Filter lists
    const companies = useMemo(() => {
        const unique = new Set(items.map(item => item.companyName));
        return Array.from(unique).filter(Boolean).sort();
    }, [items]);

    const clients = useMemo(() => {
        let filtered = items;
        if (companyFilter !== "all") {
            filtered = filtered.filter(item => item.companyName === companyFilter);
        }
        const unique = new Set(filtered.map(item => item.postoLabel));
        return Array.from(unique).filter(Boolean).sort();
    }, [items, companyFilter]);

    const handleCompanyChange = (value: string) => {
        setCompanyFilter(value);
        setClientFilter("all");
    };

    const filteredData = useMemo(() => {
        return items.filter(emp => {
            const matchesStatus = statusFilter === "all" || emp.status === statusFilter;
            const matchesCompany = companyFilter === "all" || emp.companyName === companyFilter;
            const matchesClient = clientFilter === "all" || emp.postoLabel === clientFilter;
            const cleanSearch = searchTerm.toLowerCase().trim();
            const matchesSearch = !cleanSearch ||
                emp.name.toLowerCase().includes(cleanSearch) ||
                emp.cpf.replace(/\D/g, "").includes(cleanSearch) ||
                (emp.phone && emp.phone.replace(/\D/g, "").includes(cleanSearch));

            return matchesStatus && matchesSearch && matchesCompany && matchesClient;
        });
    }, [items, statusFilter, companyFilter, clientFilter, searchTerm]);

    const handleExport = () => {
        const dataToExport = filteredData.map(emp => {
            let statusLabel = "Sem Cadastro";
            if (emp.status === "VENCIDO") statusLabel = "Vencido";
            else if (emp.status === "CRITICO") statusLabel = "Crítico (<=30d)";
            else if (emp.status === "ATENCAO") statusLabel = "Atenção (<=60d)";
            else if (emp.status === "EM_DIA") statusLabel = "Em Dia";

            return {
                "Colaborador": emp.name,
                "CPF": emp.cpf,
                "Telefone": emp.phone || "Não informado",
                "Empresa": emp.companyName,
                "Contrato / Posto": emp.postoLabel,
                "Função": emp.roleName,
                "Data Realização ASO": emp.asoDate ? format(new Date(`${emp.asoDate}T12:00:00`), "dd/MM/yyyy") : "Pendente",
                "Vencimento ASO": emp.asoDueDate ? format(new Date(`${emp.asoDueDate}T12:00:00`), "dd/MM/yyyy") : "Pendente",
                "Validade (Meses)": emp.asoValidityMonths,
                "Tipo de ASO": emp.asoType,
                "Aptidão": emp.asoApto,
                "Dias Restantes": emp.daysLeft !== null ? emp.daysLeft : "-",
                "Status": statusLabel,
                "Clínica": emp.asoClinic || "-",
                "Médico": emp.asoDoctor || "-",
                "CRM": emp.asoDoctorCrm ? `${emp.asoDoctorCrm}/${emp.asoDoctorCrmUf}` : "-",
                "Supervisor": emp.supervisorName || "-"
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);

        const wscols = [
            { wch: 30 }, // Nome
            { wch: 15 }, // CPF
            { wch: 16 }, // Telefone
            { wch: 22 }, // Empresa
            { wch: 25 }, // Posto
            { wch: 20 }, // Cargo
            { wch: 18 }, // Data ASO
            { wch: 18 }, // Vencimento
            { wch: 14 }, // Validade
            { wch: 16 }, // Tipo
            { wch: 12 }, // Aptidão
            { wch: 14 }, // Dias Restantes
            { wch: 16 }, // Status
            { wch: 25 }, // Clínica
            { wch: 20 }, // Médico
            { wch: 14 }, // CRM
            { wch: 20 }  // Supervisor
        ];
        ws["!cols"] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Controle ASO");
        XLSX.writeFile(wb, `Relatorio_ASO_${format(new Date(), "dd-MM-yyyy")}.xlsx`);
        toast.success("Relatório de ASO exportado com sucesso!");
    };

    const handleOpenEdit = (emp: AsoEmployeeItem) => {
        setEditingEmployee(emp);
        setFormData({
            asoDate: emp.asoDate || "",
            asoDueDate: emp.asoDueDate || "",
            asoType: emp.asoType || "Periódico",
            asoValidityMonths: emp.asoValidityMonths || "12",
            asoClinic: emp.asoClinic || "",
            asoDoctor: emp.asoDoctor || "",
            asoDoctorCrm: emp.asoDoctorCrm || "",
            asoDoctorCrmUf: emp.asoDoctorCrmUf || "PR",
            asoApto: emp.asoApto || "Apto",
            asoNotes: emp.asoNotes || ""
        });
    };

    const handleAsoDateChange = (newDate: string) => {
        setFormData(prev => {
            const next = { ...prev, asoDate: newDate };
            if (newDate) {
                try {
                    const parts = newDate.split("-").map(Number);
                    if (parts.length === 3) {
                        const d = new Date(parts[0], parts[1] - 1, parts[2]);
                        const months = parseInt(prev.asoValidityMonths) || 12;
                        d.setMonth(d.getMonth() + months);
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, "0");
                        const day = String(d.getDate()).padStart(2, "0");
                        next.asoDueDate = `${y}-${m}-${day}`;
                    }
                } catch {
                    // ignore
                }
            }
            return next;
        });
    };

    const handleValidityChange = (monthsStr: string) => {
        setFormData(prev => {
            const next = { ...prev, asoValidityMonths: monthsStr };
            if (prev.asoDate) {
                try {
                    const parts = prev.asoDate.split("-").map(Number);
                    if (parts.length === 3) {
                        const d = new Date(parts[0], parts[1] - 1, parts[2]);
                        const months = parseInt(monthsStr) || 12;
                        d.setMonth(d.getMonth() + months);
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, "0");
                        const day = String(d.getDate()).padStart(2, "0");
                        next.asoDueDate = `${y}-${m}-${day}`;
                    }
                } catch {
                    // ignore
                }
            }
            return next;
        });
    };

    const handleSaveAso = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingEmployee) return;

        try {
            setIsSaving(true);
            await updateEmployeeAso(editingEmployee.id, formData);

            // Update local state
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let newDaysLeft: number | null = null;
            let newStatus: AsoStatus = "SEM_CADASTRO";

            if (formData.asoDueDate) {
                const parts = formData.asoDueDate.split("-").map(Number);
                if (parts.length === 3) {
                    const dueDate = new Date(parts[0], parts[1] - 1, parts[2]);
                    dueDate.setHours(0, 0, 0, 0);
                    const diffTime = dueDate.getTime() - today.getTime();
                    newDaysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (newDaysLeft < 0) newStatus = "VENCIDO";
                    else if (newDaysLeft <= 30) newStatus = "CRITICO";
                    else if (newDaysLeft <= 60) newStatus = "ATENCAO";
                    else newStatus = "EM_DIA";
                }
            }

            setItems(prev => prev.map(item => {
                if (item.id === editingEmployee.id) {
                    return {
                        ...item,
                        asoDate: formData.asoDate || null,
                        asoDueDate: formData.asoDueDate || null,
                        asoType: formData.asoType,
                        asoValidityMonths: formData.asoValidityMonths,
                        asoClinic: formData.asoClinic,
                        asoDoctor: formData.asoDoctor,
                        asoDoctorCrm: formData.asoDoctorCrm,
                        asoDoctorCrmUf: formData.asoDoctorCrmUf,
                        asoApto: formData.asoApto,
                        asoNotes: formData.asoNotes,
                        daysLeft: newDaysLeft,
                        status: newStatus
                    };
                }
                return item;
            }));

            toast.success(`ASO de ${editingEmployee.name} atualizado com sucesso!`);
            setEditingEmployee(null);
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Erro ao salvar dados do ASO.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendAlert = async (emp: AsoEmployeeItem, target: "SUPERVISOR" | "EMPLOYEE" | "GROUPS") => {
        try {
            setIsSendingAlert(emp.id);
            const res = await sendManualAsoAlert(emp.id, target);
            if (res.success) {
                toast.success(res.message);
            } else {
                toast.error(res.message);
            }
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Erro ao enviar alerta de ASO via WhatsApp.");
        } finally {
            setIsSendingAlert(null);
        }
    };

    return (
        <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div>
                <div className="flex items-center gap-2 text-rose-500 font-black text-xs uppercase tracking-[0.3em] mb-2">
                    <HeartPulse className="w-4 h-4 animate-pulse" /> Saúde Ocupacional & PCMSO
                </div>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Monitor de ASO</h2>
                        <p className="text-slate-500 font-medium">Controle de atestados de saúde ocupacional, prazos legais de validade e alertas de renovação</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/admin/notificacoes-rh">
                            <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-100 font-bold rounded-xl text-xs h-10 gap-2">
                                <MessageSquare className="w-4 h-4 text-emerald-500" />
                                Notificações RH
                            </Button>
                        </Link>
                        <Button 
                            onClick={handleExport}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs h-10 gap-2 shadow-lg shadow-emerald-600/20"
                        >
                            <Download className="w-4 h-4" />
                            Exportar Excel
                        </Button>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Vencidos */}
                <Card 
                    onClick={() => setStatusFilter(statusFilter === "VENCIDO" ? "all" : "VENCIDO")}
                    className={`cursor-pointer transition-all duration-300 border-none shadow-premium bg-gradient-to-br from-red-600 to-rose-700 text-white relative overflow-hidden ${statusFilter === "VENCIDO" ? "ring-4 ring-red-400 ring-offset-2" : "hover:scale-[1.02]"}`}
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-white/80 text-[10px] font-black uppercase tracking-widest">Vencidos</CardDescription>
                        <CardTitle className="text-3xl font-black">{stats.vencidos}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-white/90">
                            <AlertTriangle className="w-4 h-4 text-red-200" />
                            <span>Requer renovação imediata</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Crítico 30 dias */}
                <Card 
                    onClick={() => setStatusFilter(statusFilter === "CRITICO" ? "all" : "CRITICO")}
                    className={`cursor-pointer transition-all duration-300 border-none shadow-premium bg-gradient-to-br from-amber-500 to-orange-600 text-white relative overflow-hidden ${statusFilter === "CRITICO" ? "ring-4 ring-amber-400 ring-offset-2" : "hover:scale-[1.02]"}`}
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-white/80 text-[10px] font-black uppercase tracking-widest">Crítico (&le; 30 dias)</CardDescription>
                        <CardTitle className="text-3xl font-black">{stats.critico30d}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-white/90">
                            <Clock className="w-4 h-4 text-amber-200" />
                            <span>Agendar exame clínico</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Atenção 60 dias */}
                <Card 
                    onClick={() => setStatusFilter(statusFilter === "ATENCAO" ? "all" : "ATENCAO")}
                    className={`cursor-pointer transition-all duration-300 border-none shadow-premium bg-gradient-to-br from-yellow-500 to-amber-600 text-white relative overflow-hidden ${statusFilter === "ATENCAO" ? "ring-4 ring-yellow-300 ring-offset-2" : "hover:scale-[1.02]"}`}
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-white/80 text-[10px] font-black uppercase tracking-widest">Atenção (31 a 60 dias)</CardDescription>
                        <CardTitle className="text-3xl font-black">{stats.atencao60d}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-white/90">
                            <Calendar className="w-4 h-4 text-yellow-200" />
                            <span>Em janela de renovação</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Em Dia */}
                <Card 
                    onClick={() => setStatusFilter(statusFilter === "EM_DIA" ? "all" : "EM_DIA")}
                    className={`cursor-pointer transition-all duration-300 border-none shadow-premium bg-gradient-to-br from-emerald-500 to-teal-600 text-white relative overflow-hidden ${statusFilter === "EM_DIA" ? "ring-4 ring-emerald-300 ring-offset-2" : "hover:scale-[1.02]"}`}
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-white/80 text-[10px] font-black uppercase tracking-widest">Em Dia (&gt; 60 dias)</CardDescription>
                        <CardTitle className="text-3xl font-black">{stats.emDia}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-white/90">
                            <CheckCircle className="w-4 h-4 text-emerald-200" />
                            <span>Vigência regular</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Sem Cadastro */}
                <Card 
                    onClick={() => setStatusFilter(statusFilter === "SEM_CADASTRO" ? "all" : "SEM_CADASTRO")}
                    className={`cursor-pointer transition-all duration-300 border-none shadow-premium bg-slate-900 text-white relative overflow-hidden ${statusFilter === "SEM_CADASTRO" ? "ring-4 ring-slate-400 ring-offset-2" : "hover:scale-[1.02]"}`}
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-white/70 text-[10px] font-black uppercase tracking-widest">Sem Registro</CardDescription>
                        <CardTitle className="text-3xl font-black">{stats.semCadastro}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-white/70">
                            <HelpCircle className="w-4 h-4 text-slate-400" />
                            <span>Preencher ASO inicial</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table Card */}
            <Card className="border-none shadow-premium bg-white/60 backdrop-blur-md">
                <CardHeader className="border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 p-6">
                    <div>
                        <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <HeartPulse className="w-5 h-5 text-rose-500" />
                            Colaboradores & Vigência do ASO
                        </CardTitle>
                        <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-slate-400">
                            Exibindo {filteredData.length} de {items.length} colaboradores
                        </CardDescription>
                    </div>

                    {/* Filter controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 w-full md:w-auto">
                        {/* Company Filter */}
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 z-10" />
                            <select
                                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 appearance-none text-slate-700 font-semibold"
                                value={companyFilter}
                                onChange={(e) => handleCompanyChange(e.target.value)}
                            >
                                <option value="all">Todas as Empresas</option>
                                {companies.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        {/* Client / Posto Filter */}
                        <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 z-10" />
                            <select
                                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 appearance-none text-slate-700 font-semibold disabled:opacity-50"
                                value={clientFilter}
                                onChange={(e) => setClientFilter(e.target.value)}
                                disabled={clients.length === 0}
                            >
                                <option value="all">Todos os Contratos/Postos</option>
                                {clients.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        {/* Status Filter */}
                        <div className="relative">
                            <HeartPulse className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 z-10" />
                            <select
                                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 appearance-none text-slate-700 font-semibold"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                            >
                                <option value="all">Todos os Status</option>
                                <option value="VENCIDO">🔴 Vencido</option>
                                <option value="CRITICO">🟠 Crítico (&le; 30d)</option>
                                <option value="ATENCAO">🟡 Atenção (&le; 60d)</option>
                                <option value="EM_DIA">🟢 Em Dia</option>
                                <option value="SEM_CADASTRO">⚪ Sem Cadastro</option>
                            </select>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Buscar nome ou CPF..."
                                className="pl-9 bg-white text-xs rounded-xl border-slate-200 h-9 font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50/80 border-b border-slate-200">
                            <tr className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                                <th className="py-3 px-4">Colaborador</th>
                                <th className="py-3 px-4">Empresa / Posto</th>
                                <th className="py-3 px-4">Função</th>
                                <th className="py-3 px-4">Data ASO</th>
                                <th className="py-3 px-4">Vencimento (Projeção)</th>
                                <th className="py-3 px-4 text-center">Status / Prazo</th>
                                <th className="py-3 px-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                                        Nenhum colaborador encontrado com os filtros selecionados.
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map(emp => {
                                    const isOverdue = emp.status === "VENCIDO";
                                    const isCrit = emp.status === "CRITICO";
                                    const isWarn = emp.status === "ATENCAO";
                                    const isOk = emp.status === "EM_DIA";
                                    const isNone = emp.status === "SEM_CADASTRO";

                                    return (
                                        <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                                            {/* Colaborador */}
                                            <td className="py-3 px-4">
                                                <div className="font-black text-slate-900 text-sm">
                                                    {emp.name}
                                                </div>
                                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                                    <span>CPF: {emp.cpf}</span>
                                                    {emp.phone && (
                                                        <span className="flex items-center gap-0.5 text-slate-500">
                                                            <Phone className="w-2.5 h-2.5" />
                                                            {emp.phone}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Empresa & Posto */}
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-slate-800">{emp.companyName}</div>
                                                <div className="text-[11px] text-slate-500 truncate max-w-[200px]" title={emp.postoLabel}>
                                                    {emp.postoLabel}
                                                </div>
                                                {emp.supervisorName && (
                                                    <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                                                        Sup: {emp.supervisorName}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Função */}
                                            <td className="py-3 px-4">
                                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                                                    {emp.roleName}
                                                </span>
                                            </td>

                                            {/* Data ASO */}
                                            <td className="py-3 px-4">
                                                {emp.asoDate ? (
                                                    <div>
                                                        <span className="font-bold text-slate-800">
                                                            {format(new Date(`${emp.asoDate}T12:00:00`), "dd/MM/yyyy")}
                                                        </span>
                                                        <div className="text-[10px] text-slate-400">{emp.asoType}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">Não registrado</span>
                                                )}
                                            </td>

                                            {/* Vencimento / Projeção */}
                                            <td className="py-3 px-4">
                                                {emp.asoDueDate ? (
                                                    <div>
                                                        <span className={`font-black ${isOverdue ? "text-red-600" : isCrit ? "text-amber-600" : "text-slate-800"}`}>
                                                            {format(new Date(`${emp.asoDueDate}T12:00:00`), "dd/MM/yyyy")}
                                                        </span>
                                                        <div className="text-[10px] text-slate-400 font-semibold">
                                                            Validade: {emp.asoValidityMonths} meses
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">Não projetado</span>
                                                )}
                                            </td>

                                            {/* Status / Prazo */}
                                            <td className="py-3 px-4 text-center">
                                                {isOverdue && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        {Math.abs(emp.daysLeft || 0)}d Vencido
                                                    </span>
                                                )}
                                                {isCrit && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                                        <Clock className="w-3 h-3" />
                                                        {emp.daysLeft}d Restantes
                                                    </span>
                                                )}
                                                {isWarn && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-yellow-100 text-yellow-800 border border-yellow-200">
                                                        <Calendar className="w-3 h-3" />
                                                        {emp.daysLeft}d Restantes
                                                    </span>
                                                )}
                                                {isOk && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                        <CheckCircle className="w-3 h-3" />
                                                        Em Dia ({emp.daysLeft}d)
                                                    </span>
                                                )}
                                                {isNone && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                                        <HelpCircle className="w-3 h-3" />
                                                        Sem ASO
                                                    </span>
                                                )}
                                            </td>

                                            {/* Ações */}
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* Quick Edit Modal */}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleOpenEdit(emp)}
                                                        title="Lançar / Renovar ASO"
                                                        className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold rounded-lg text-xs"
                                                    >
                                                        <Edit className="w-3.5 h-3.5 mr-1" />
                                                        Lançar ASO
                                                    </Button>

                                                    {/* WhatsApp Trigger */}
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                disabled={isSendingAlert === emp.id}
                                                                className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-bold rounded-lg text-xs"
                                                            >
                                                                {isSendingAlert === emp.id ? (
                                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <Send className="w-3.5 h-3.5 mr-1" />
                                                                )}
                                                                WhatsApp
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent align="end" className="bg-white border-slate-200 shadow-xl rounded-xl p-1.5 w-60 flex flex-col gap-1 z-50">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSendAlert(emp, "GROUPS")}
                                                                className="text-xs font-semibold py-2 px-2.5 cursor-pointer rounded-lg text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center transition-colors text-left w-full"
                                                            >
                                                                <MessageSquare className="w-3.5 h-3.5 mr-2 text-emerald-600 shrink-0" />
                                                                Enviar para Grupos RH/DP
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSendAlert(emp, "SUPERVISOR")}
                                                                disabled={!emp.supervisorPhone}
                                                                className="text-xs font-semibold py-2 px-2.5 cursor-pointer rounded-lg text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center transition-colors text-left w-full disabled:opacity-40 disabled:cursor-not-allowed"
                                                            >
                                                                <UserCheck className="w-3.5 h-3.5 mr-2 text-indigo-600 shrink-0" />
                                                                Alerta ao Supervisor {emp.supervisorName ? `(${emp.supervisorName.split(" ")[0]})` : ""}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSendAlert(emp, "EMPLOYEE")}
                                                                disabled={!emp.phone}
                                                                className="text-xs font-semibold py-2 px-2.5 cursor-pointer rounded-lg text-slate-700 hover:bg-rose-50 hover:text-rose-700 flex items-center transition-colors text-left w-full disabled:opacity-40 disabled:cursor-not-allowed"
                                                            >
                                                                <Phone className="w-3.5 h-3.5 mr-2 text-rose-600 shrink-0" />
                                                                Alerta Direto ao Colaborador
                                                            </button>
                                                        </PopoverContent>
                                                    </Popover>

                                                    {/* Link to Employee Profile */}
                                                    <Link href={`/admin/employees?edit=${emp.id}`} target="_blank">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                                                            title="Ver cadastro completo"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Quick Edit / Renovar ASO Dialog */}
            <Dialog open={!!editingEmployee} onOpenChange={(open) => !open && setEditingEmployee(null)}>
                <DialogContent className="sm:max-w-xl p-0 overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-2xl">
                    <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-rose-50/50">
                        <DialogTitle className="flex items-center gap-2 text-lg font-black text-rose-800">
                            <HeartPulse className="w-5 h-5 text-rose-600" /> 
                            Lançar / Renovar ASO: {editingEmployee?.name}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-rose-700">
                            {editingEmployee?.companyName} &bull; {editingEmployee?.postoLabel} &bull; CPF: {editingEmployee?.cpf}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSaveAso} className="p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Data do ASO */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700">
                                    Data de Realização do ASO <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    type="date"
                                    required
                                    value={formData.asoDate}
                                    onChange={(e) => handleAsoDateChange(e.target.value)}
                                    className="bg-white border-slate-200 text-xs font-semibold rounded-xl"
                                />
                            </div>

                            {/* Validade em Meses */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700">
                                    Validade Padrão
                                </Label>
                                <select
                                    value={formData.asoValidityMonths}
                                    onChange={(e) => handleValidityChange(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700 font-semibold"
                                >
                                    <option value="12">12 Meses (Padrão NR-7)</option>
                                    <option value="6">6 Meses (Risco Alto / Semestral)</option>
                                    <option value="24">24 Meses (Bienal)</option>
                                    <option value="1">1 Mês (Pontual)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Data de Vencimento (Projeção) */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold text-slate-700">
                                        Data de Vencimento
                                    </Label>
                                    <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-full">
                                        Projetado +12m
                                    </span>
                                </div>
                                <Input
                                    type="date"
                                    required
                                    value={formData.asoDueDate}
                                    onChange={(e) => setFormData({ ...formData, asoDueDate: e.target.value })}
                                    className="bg-rose-50/40 border-rose-200 text-xs font-bold text-rose-950 rounded-xl"
                                />
                            </div>

                            {/* Tipo de Exame */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700">
                                    Tipo de Exame
                                </Label>
                                <select
                                    value={formData.asoType}
                                    onChange={(e) => setFormData({ ...formData, asoType: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700 font-semibold"
                                >
                                    <option value="Admissional">Admissional</option>
                                    <option value="Periódico">Periódico</option>
                                    <option value="Mudança de Risco">Mudança de Risco / Função</option>
                                    <option value="Retorno ao Trabalho">Retorno ao Trabalho</option>
                                    <option value="Demissional">Demissional</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Parecer / Aptidão */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700">
                                    Resultado / Aptidão
                                </Label>
                                <select
                                    value={formData.asoApto}
                                    onChange={(e) => setFormData({ ...formData, asoApto: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700 font-semibold"
                                >
                                    <option value="Apto">🟢 Apto</option>
                                    <option value="Apto com Restrições">🟡 Apto com Restrições</option>
                                    <option value="Inapto">🔴 Inapto</option>
                                    <option value="Pendente">⚪ Pendente de Exames Complementares</option>
                                </select>
                            </div>

                            {/* Clínica */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700">
                                    Clínica / Prestador de Saúde
                                </Label>
                                <Input
                                    placeholder="Ex: ClinSaúde / Ocupacional"
                                    value={formData.asoClinic}
                                    onChange={(e) => setFormData({ ...formData, asoClinic: e.target.value })}
                                    className="bg-white border-slate-200 text-xs rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Médico */}
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label className="text-xs font-bold text-slate-700">
                                    Médico Examinador / Coordenador
                                </Label>
                                <Input
                                    placeholder="Nome do Médico"
                                    value={formData.asoDoctor}
                                    onChange={(e) => setFormData({ ...formData, asoDoctor: e.target.value })}
                                    className="bg-white border-slate-200 text-xs rounded-xl"
                                />
                            </div>

                            {/* CRM & UF */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700">
                                    CRM / UF
                                </Label>
                                <div className="flex gap-1.5">
                                    <Input
                                        placeholder="CRM"
                                        value={formData.asoDoctorCrm}
                                        onChange={(e) => setFormData({ ...formData, asoDoctorCrm: e.target.value })}
                                        className="bg-white border-slate-200 text-xs rounded-xl flex-1"
                                    />
                                    <Input
                                        placeholder="UF"
                                        maxLength={2}
                                        value={formData.asoDoctorCrmUf}
                                        onChange={(e) => setFormData({ ...formData, asoDoctorCrmUf: e.target.value.toUpperCase() })}
                                        className="bg-white border-slate-200 text-xs rounded-xl w-14 text-center"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Observações */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700">
                                Observações ou Restrições do Médico
                            </Label>
                            <Input
                                placeholder="Ex: Uso obrigatório de óculos corretivos, audiometria em 6 meses..."
                                value={formData.asoNotes}
                                onChange={(e) => setFormData({ ...formData, asoNotes: e.target.value })}
                                className="bg-white border-slate-200 text-xs rounded-xl"
                            />
                        </div>

                        <DialogFooter className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditingEmployee(null)}
                                className="border-slate-200 text-slate-700 font-bold rounded-xl text-xs h-9 px-4"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSaving}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs h-9 px-6 gap-2 shadow-lg shadow-rose-600/20"
                            >
                                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                Salvar ASO
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
