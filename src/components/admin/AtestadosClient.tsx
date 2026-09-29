"use client";

import React, { useState, useTransition } from "react";
import {
    FileText,
    CheckCircle2,
    Clock,
    XCircle,
    Send,
    UserCheck,
    Search,
    UploadCloud,
    Eye,
    Sparkles,
    Calendar,
    Building2,
    RefreshCw,
    Edit3,
    X,
    FileSpreadsheet,
    Stethoscope
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
    lancarAtestadoNoSecullum,
    rejeitarAtestado,
    processarUploadAtestado
} from "@/actions/atestados";

interface EmployeeSimple {
    id: string;
    name: string;
    cpf: string;
    role: string | null;
    companyId: string | null;
    company?: { id: string; name: string } | null;
}

interface CompanyOption {
    id: string;
    name: string;
}

export interface MedicalCertificateItem {
    id: string;
    employeeId: string | null;
    extractedName: string;
    employeeName: string | null;
    cpf: string | null;
    startDate: Date | string;
    endDate: Date | string;
    daysCount: number;
    cid: string | null;
    justificativa: string;
    notes: string | null;
    doctorName: string | null;
    doctorCrm: string | null;
    documentUrl: string;
    status: string;
    rejectionReason: string | null;
    secullumStatus: string | null;
    secullumResponse: string | null;
    secullumLancadoEm: Date | string | null;
    source: string;
    createdAt: Date | string;
    validatedById: string | null;
    validatedByName: string | null;
    employee?: {
        id: string;
        name: string;
        cpf: string;
        role?: { name: string } | null;
        companyId: string | null;
        company?: { id: string; name: string } | null;
    } | null;
    validatedBy?: { id: string; name: string; email: string } | null;
}

interface AtestadosClientProps {
    initialAtestados: MedicalCertificateItem[];
    stats: { pendentes: number; lancados: number; rejeitados: number; total: number };
    employees: EmployeeSimple[];
    companies: CompanyOption[];
}

export function AtestadosClient({
    initialAtestados,
    stats: initialStats,
    employees,
    companies
}: AtestadosClientProps) {
    const [atestados, setAtestados] = useState<MedicalCertificateItem[]>(initialAtestados);
    const [stats, setStats] = useState(initialStats);
    const [activeTab, setActiveTab] = useState("pendentes");
    const [search, setSearch] = useState("");
    const [selectedCompany, setSelectedCompany] = useState("ALL");
    const [isPending, startTransition] = useTransition();

    // Modais
    const [previewDoc, setPreviewDoc] = useState<MedicalCertificateItem | null>(null);
    const [rejectionModal, setRejectionModal] = useState<{ open: boolean; id: string; reason: string }>({
        open: false,
        id: "",
        reason: ""
    });
    const [editModal, setEditModal] = useState<{
        open: boolean;
        atestado: MedicalCertificateItem | null;
        employeeId: string;
        startDate: string;
        endDate: string;
        daysCount: number;
        cid: string;
        justificativa: string;
        notes: string;
    }>({
        open: false,
        atestado: null,
        employeeId: "",
        startDate: "",
        endDate: "",
        daysCount: 1,
        cid: "",
        justificativa: "Atestado Médico",
        notes: ""
    });

    // Upload & IA Modal
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);

    // Troca Rápida de Colaborador (Inline)
    const [changingEmployeeAtestadoId, setChangingEmployeeAtestadoId] = useState<string | null>(null);

    // Ação: Lançar no Secullum
    const handleLancarSecullum = async (atestado: MedicalCertificateItem) => {
        const cpf = atestado.cpf || atestado.employee?.cpf;
        if (!atestado.employeeId && !cpf) {
            toast.error("Por favor, vincule um colaborador antes de lançar no Secullum.");
            return;
        }

        const toastId = toast.loading(`Enviando atestado de ${atestado.employeeName || atestado.extractedName} para Secullum...`);

        startTransition(async () => {
            try {
                const res = await lancarAtestadoNoSecullum({
                    id: atestado.id,
                    employeeId: atestado.employeeId || undefined,
                    startDate: atestado.startDate ? new Date(atestado.startDate).toISOString().split("T")[0] : undefined,
                    endDate: atestado.endDate ? new Date(atestado.endDate).toISOString().split("T")[0] : undefined,
                    days: atestado.daysCount,
                    cid: atestado.cid || undefined,
                    justificativaNome: atestado.justificativa,
                    notes: atestado.notes || undefined
                });

                if (res.success) {
                    toast.success(res.message, { id: toastId });
                    setAtestados((prev) =>
                        prev.map((item) =>
                            item.id === atestado.id
                                ? {
                                      ...item,
                                      status: "LANCADO",
                                      secullumStatus: "SUCESSO",
                                      secullumLancadoEm: new Date()
                                  }
                                : item
                        )
                    );
                    setStats((prev) => ({
                        ...prev,
                        pendentes: Math.max(0, prev.pendentes - 1),
                        lancados: prev.lancados + 1
                    }));
                } else {
                    toast.error(res.message, { id: toastId, duration: 6000 });
                }
            } catch (err: any) {
                toast.error(`Erro ao conectar com Secullum: ${err.message}`, { id: toastId });
            }
        });
    };

    // Ação: Rejeitar Atestado
    const handleConfirmRejection = async () => {
        if (!rejectionModal.reason.trim()) {
            toast.error("Informe o motivo da recusa do atestado.");
            return;
        }

        startTransition(async () => {
            try {
                await rejeitarAtestado(rejectionModal.id, rejectionModal.reason);
                toast.success("Atestado rejeitado.");
                setAtestados((prev) =>
                    prev.map((item) =>
                        item.id === rejectionModal.id
                            ? { ...item, status: "REJEITADO", rejectionReason: rejectionModal.reason }
                            : item
                    )
                );
                setStats((prev) => ({
                    ...prev,
                    pendentes: Math.max(0, prev.pendentes - 1),
                    rejeitados: prev.rejeitados + 1
                }));
                setRejectionModal({ open: false, id: "", reason: "" });
            } catch (err: any) {
                toast.error(`Erro ao rejeitar: ${err.message}`);
            }
        });
    };

    // Ação: Trocar Colaborador Vinculado
    const handleSelectEmployee = (atestadoId: string, newEmployeeId: string) => {
        const emp = employees.find((e) => e.id === newEmployeeId);
        if (!emp) return;

        setAtestados((prev) =>
            prev.map((item) => {
                if (item.id === atestadoId) {
                    return {
                        ...item,
                        employeeId: emp.id,
                        employeeName: emp.name,
                        cpf: emp.cpf,
                        employee: {
                            id: emp.id,
                            name: emp.name,
                            cpf: emp.cpf,
                            role: emp.role ? { name: emp.role } : null,
                            companyId: emp.companyId,
                            company: emp.company
                        }
                    };
                }
                return item;
            })
        );
        setChangingEmployeeAtestadoId(null);
        toast.info(`Colaborador alterado para ${emp.name} (CPF: ${emp.cpf})`);
    };

    // Ação: Salvar Edição
    const handleSaveEdit = async () => {
        if (!editModal.atestado) return;

        const atestadoId = editModal.atestado.id;
        const selectedEmp = employees.find((e) => e.id === editModal.employeeId);

        setAtestados((prev) =>
            prev.map((item) => {
                if (item.id === atestadoId) {
                    return {
                        ...item,
                        employeeId: selectedEmp?.id || item.employeeId,
                        employeeName: selectedEmp?.name || item.employeeName,
                        cpf: selectedEmp?.cpf || item.cpf,
                        startDate: editModal.startDate,
                        endDate: editModal.endDate,
                        daysCount: Number(editModal.daysCount) || 1,
                        cid: editModal.cid || null,
                        justificativa: editModal.justificativa,
                        notes: editModal.notes || null
                    };
                }
                return item;
            })
        );

        setEditModal({ ...editModal, open: false });
        toast.success("Alterações salvas. Clique em 'Lançar no Secullum' para transmitir.");
    };

    // Ação: Upload de Arquivo com IA
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        setUploadingFile(true);

        reader.onload = async () => {
            const base64 = reader.result as string;

            try {
                toast.loading("A inteligência artificial está analisando o atestado...", { id: "ia-ocr" });
                const res = await processarUploadAtestado({
                    fileBase64: base64,
                    mimeType: file.type,
                    fileName: file.name
                });

                if (res.success && res.atestado) {
                    toast.success("Atestado lido com sucesso pela IA!", { id: "ia-ocr" });
                    setAtestados((prev) => [res.atestado as any, ...prev]);
                    setStats((prev) => ({ ...prev, pendentes: prev.pendentes + 1, total: prev.total + 1 }));
                    setUploadModalOpen(false);
                } else {
                    toast.error(`Falha ao ler atestado: ${res.error}`, { id: "ia-ocr" });
                }
            } catch (err: any) {
                toast.error(`Erro: ${err.message}`, { id: "ia-ocr" });
            } finally {
                setUploadingFile(false);
            }
        };

        reader.readAsDataURL(file);
    };

    // Filtragem dos registros
    const filteredAtestados = atestados.filter((item) => {
        if (activeTab === "pendentes" && item.status !== "PENDENTE") return false;
        if (activeTab === "lancados" && item.status !== "LANCADO") return false;
        if (activeTab === "rejeitados" && item.status !== "REJEITADO") return false;

        if (selectedCompany !== "ALL") {
            const compId = item.employee?.companyId;
            if (compId !== selectedCompany) return false;
        }

        if (search.trim()) {
            const s = search.toLowerCase();
            const nameMatch = (item.employeeName || item.extractedName || item.employee?.name || "").toLowerCase().includes(s);
            const cpfMatch = (item.cpf || item.employee?.cpf || "").includes(s);
            const cidMatch = (item.cid || "").toLowerCase().includes(s);
            const docMatch = (item.doctorName || "").toLowerCase().includes(s);
            return nameMatch || cpfMatch || cidMatch || docMatch;
        }

        return true;
    });

    const formatDataExibicao = (dateVal: any) => {
        if (!dateVal) return "-";
        try {
            const d = typeof dateVal === "string" ? parseISO(dateVal) : new Date(dateVal);
            return format(d, "dd/MM/yyyy", { locale: ptBR });
        } catch {
            return String(dateVal).split("T")[0];
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Ação Rápida */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-white/5 backdrop-blur-xl">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 flex items-center gap-1.5 px-3 py-1 font-semibold text-xs">
                            <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                            Captura IA + Secullum Ponto Web
                        </Badge>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <FileText className="w-8 h-8 text-sky-400" />
                        Gestão de Atestados Médicos
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Atestados recebidos via WhatsApp e cadastros manuais são lidos por IA, validados pelo gestor e sincronizados no Secullum.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => setUploadModalOpen(true)}
                        className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold shadow-lg shadow-sky-500/20 rounded-2xl px-5 h-12 flex items-center gap-2.5 transition-all duration-300 hover:scale-[1.02]"
                    >
                        <Sparkles className="w-4 h-4 text-sky-200" />
                        <span>Novo Atestado (IA)</span>
                    </Button>
                </div>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card
                    onClick={() => setActiveTab("pendentes")}
                    className={`cursor-pointer transition-all duration-300 rounded-3xl border ${
                        activeTab === "pendentes"
                            ? "bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10"
                            : "bg-slate-900/40 border-white/5 hover:bg-slate-900/70"
                    }`}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-400">
                            Pendentes de Validação
                        </CardTitle>
                        <div className="p-2.5 bg-amber-500/10 rounded-2xl text-amber-400">
                            <Clock className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white">{stats.pendentes}</div>
                        <p className="text-xs text-amber-400/80 mt-1 font-medium">Aguardando conferência do gestor</p>
                    </CardContent>
                </Card>

                <Card
                    onClick={() => setActiveTab("lancados")}
                    className={`cursor-pointer transition-all duration-300 rounded-3xl border ${
                        activeTab === "lancados"
                            ? "bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10"
                            : "bg-slate-900/40 border-white/5 hover:bg-slate-900/70"
                    }`}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                            Lançados no Secullum
                        </CardTitle>
                        <div className="p-2.5 bg-emerald-500/10 rounded-2xl text-emerald-400">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white">{stats.lancados}</div>
                        <p className="text-xs text-emerald-400/80 mt-1 font-medium">Abonados e integrados com sucesso</p>
                    </CardContent>
                </Card>

                <Card
                    onClick={() => setActiveTab("rejeitados")}
                    className={`cursor-pointer transition-all duration-300 rounded-3xl border ${
                        activeTab === "rejeitados"
                            ? "bg-rose-500/10 border-rose-500/40 shadow-lg shadow-rose-500/10"
                            : "bg-slate-900/40 border-white/5 hover:bg-slate-900/70"
                    }`}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-rose-400">
                            Rejeitados / Inválidos
                        </CardTitle>
                        <div className="p-2.5 bg-rose-500/10 rounded-2xl text-rose-400">
                            <XCircle className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white">{stats.rejeitados}</div>
                        <p className="text-xs text-rose-400/80 mt-1 font-medium">Recusados pela supervisão</p>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border border-white/5 bg-slate-900/40">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-sky-400">
                            Total Registrados
                        </CardTitle>
                        <div className="p-2.5 bg-sky-500/10 rounded-2xl text-sky-400">
                            <FileSpreadsheet className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white">{stats.total}</div>
                        <p className="text-xs text-slate-400 mt-1 font-medium">Histórico acumulado de atestados</p>
                    </CardContent>
                </Card>
            </div>

            {/* Painel Principal com Abas e Filtros */}
            <div className="bg-slate-900/60 rounded-3xl border border-white/5 backdrop-blur-xl p-6 space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Abas */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:w-auto">
                        <TabsList className="bg-slate-950/60 p-1 rounded-2xl border border-white/5 h-12 flex gap-1">
                            <TabsTrigger
                                value="pendentes"
                                className="rounded-xl px-4 font-bold text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 transition-all flex items-center gap-2"
                            >
                                <Clock className="w-3.5 h-3.5" />
                                <span>Pendentes de Validação</span>
                                <Badge className="bg-amber-950 text-amber-200 text-[10px] ml-1 px-1.5 py-0 h-4">
                                    {stats.pendentes}
                                </Badge>
                            </TabsTrigger>

                            <TabsTrigger
                                value="lancados"
                                className="rounded-xl px-4 font-bold text-xs data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 transition-all flex items-center gap-2"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Lançados no Secullum</span>
                                <Badge className="bg-emerald-950 text-emerald-200 text-[10px] ml-1 px-1.5 py-0 h-4">
                                    {stats.lancados}
                                </Badge>
                            </TabsTrigger>

                            <TabsTrigger
                                value="rejeitados"
                                className="rounded-xl px-4 font-bold text-xs data-[state=active]:bg-rose-500 data-[state=active]:text-white transition-all flex items-center gap-2"
                            >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Rejeitados</span>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {/* Filtros: Busca e Empresa */}
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="relative w-full sm:w-64">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <Input
                                placeholder="Buscar colaborador, CPF, CID..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10 bg-slate-950/60 border-white/10 rounded-2xl h-11 text-xs text-white placeholder:text-slate-500"
                            />
                        </div>

                        <div className="w-full sm:w-56">
                            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                                <SelectTrigger className="bg-slate-950/60 border-white/10 rounded-2xl h-11 text-xs text-white">
                                    <Building2 className="w-4 h-4 text-slate-400 mr-2" />
                                    <SelectValue placeholder="Todas Empresas" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10 text-white">
                                    <SelectItem value="ALL">Todas as Empresas</SelectItem>
                                    {companies.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Tabela de Resultados */}
                <div className="rounded-2xl border border-white/5 overflow-hidden bg-slate-950/40">
                    <Table>
                        <TableHeader className="bg-slate-900/80">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="w-20 text-[11px] font-black uppercase text-slate-400">Doc</TableHead>
                                <TableHead className="text-[11px] font-black uppercase text-slate-400">Colaborador (Secullum)</TableHead>
                                <TableHead className="text-[11px] font-black uppercase text-slate-400">Período / Dias</TableHead>
                                <TableHead className="text-[11px] font-black uppercase text-slate-400">Diagnóstico / Médico</TableHead>
                                <TableHead className="text-[11px] font-black uppercase text-slate-400">Origem / Status</TableHead>
                                <TableHead className="text-right text-[11px] font-black uppercase text-slate-400">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAtestados.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                                        <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        <p className="font-semibold text-sm">Nenhum atestado encontrado nesta visualização.</p>
                                        <p className="text-xs text-slate-600 mt-1">
                                            Atestados enviados no grupo de WhatsApp ou inseridos manualmente aparecerão aqui.
                                        </p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredAtestados.map((item) => {
                                    const cpf = item.cpf || item.employee?.cpf;
                                    const hasValidEmployee = Boolean(item.employeeId && cpf);
                                    const isItemPending = item.status === "PENDENTE";
                                    const isItemLancado = item.status === "LANCADO";

                                    return (
                                        <TableRow
                                            key={item.id}
                                            className="border-white/5 hover:bg-white/[0.02] transition-colors"
                                        >
                                            {/* Preview Foto */}
                                            <TableCell>
                                                {item.documentUrl ? (
                                                    <div
                                                        onClick={() => setPreviewDoc(item)}
                                                        className="w-12 h-14 rounded-xl overflow-hidden bg-slate-900 border border-white/10 cursor-pointer relative group flex items-center justify-center"
                                                    >
                                                        {item.documentUrl.startsWith("data:") || item.documentUrl.startsWith("http") ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={item.documentUrl}
                                                                alt="Atestado"
                                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                                            />
                                                        ) : (
                                                            <FileText className="w-6 h-6 text-sky-400" />
                                                        )}
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <Eye className="w-4 h-4 text-white" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-12 h-14 rounded-xl bg-slate-900/80 border border-white/5 flex items-center justify-center text-slate-600">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                )}
                                            </TableCell>

                                            {/* Colaborador */}
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-white text-sm">
                                                            {item.employee?.name || item.employeeName || item.extractedName}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                                        <span className="font-mono bg-slate-900 px-2 py-0.5 rounded border border-white/5">
                                                            CPF: {cpf || "Sem CPF"}
                                                        </span>
                                                        {item.employee?.company?.name && (
                                                            <span className="text-slate-500 truncate max-w-[150px]">
                                                                • {item.employee.company.name}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Botão de Trocar Colaborador (Caso a IA tenha errado) */}
                                                    {isItemPending && (
                                                        <div className="pt-1">
                                                            {changingEmployeeAtestadoId === item.id ? (
                                                                <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-200">
                                                                    <Select
                                                                        onValueChange={(val) => handleSelectEmployee(item.id, val)}
                                                                        defaultValue={item.employeeId || undefined}
                                                                    >
                                                                        <SelectTrigger className="w-56 h-8 text-xs bg-slate-900 border-sky-500/50 text-white rounded-lg">
                                                                            <SelectValue placeholder="Selecione o colaborador correto..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="bg-slate-900 border-white/10 text-white max-h-60">
                                                                            {employees.map((emp) => (
                                                                                <SelectItem key={emp.id} value={emp.id} className="text-xs">
                                                                                    {emp.name} ({emp.cpf})
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => setChangingEmployeeAtestadoId(null)}
                                                                        className="h-8 px-2 text-slate-400 hover:text-white"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setChangingEmployeeAtestadoId(item.id)}
                                                                    className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 hover:underline"
                                                                >
                                                                    <UserCheck className="w-3 h-3" />
                                                                    Trocar colaborador
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Período / Dias */}
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>{formatDataExibicao(item.startDate)}</span>
                                                        {item.daysCount > 1 && (
                                                            <>
                                                                <span className="text-slate-500">até</span>
                                                                <span>{formatDataExibicao(item.endDate)}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <Badge
                                                            className={`text-[10px] font-bold ${
                                                                item.daysCount > 1
                                                                    ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                                                    : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                                            }`}
                                                        >
                                                            {item.daysCount} {item.daysCount === 1 ? "dia" : "dias de afastamento"}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* Diagnóstico / Médico */}
                                            <TableCell>
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex items-center gap-2">
                                                        {item.cid ? (
                                                            <span className="font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                                                CID: {item.cid}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-500">CID não informado</span>
                                                        )}
                                                        <span className="text-slate-300">{item.justificativa}</span>
                                                    </div>
                                                    {(item.doctorName || item.doctorCrm) && (
                                                        <div className="text-slate-400 flex items-center gap-1">
                                                            <Stethoscope className="w-3 h-3 text-slate-500" />
                                                            <span>
                                                                {item.doctorName || "Dr(a)"} {item.doctorCrm && `(${item.doctorCrm})`}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Origem / Status Secullum */}
                                            <TableCell>
                                                <div className="space-y-1">
                                                    {isItemLancado ? (
                                                        <div className="space-y-0.5">
                                                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 w-fit">
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                                Lançado no Secullum
                                                            </Badge>
                                                            {item.validatedByName && (
                                                                <p className="text-[10px] text-slate-400">
                                                                    Por: {item.validatedByName}
                                                                </p>
                                                            )}
                                                            {item.secullumLancadoEm && (
                                                                <p className="text-[10px] text-slate-500">
                                                                    Em: {formatDataExibicao(item.secullumLancadoEm)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : item.status === "REJEITADO" ? (
                                                        <div>
                                                            <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[11px] font-bold">
                                                                Rejeitado
                                                            </Badge>
                                                            {item.rejectionReason && (
                                                                <p className="text-[10px] text-rose-400/80 truncate max-w-[150px] mt-0.5">
                                                                    {item.rejectionReason}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[11px] font-bold flex items-center gap-1 w-fit">
                                                                <Clock className="w-3 h-3 text-amber-400" />
                                                                Pendente Validação
                                                            </Badge>
                                                            <span className="text-[10px] text-slate-500 block mt-0.5">
                                                                {item.source === "WHATSAPP" ? "📱 WhatsApp" : "💻 Upload Manual"}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Ações */}
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {isItemPending && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                disabled={isPending || !hasValidEmployee}
                                                                onClick={() => handleLancarSecullum(item)}
                                                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-3 rounded-xl shadow-md shadow-emerald-950 flex items-center gap-1.5 transition-all duration-200 hover:scale-[1.02]"
                                                            >
                                                                <Send className="w-3.5 h-3.5" />
                                                                <span>Lançar no Secullum</span>
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => {
                                                                    setEditModal({
                                                                        open: true,
                                                                        atestado: item,
                                                                        employeeId: item.employeeId || "",
                                                                        startDate: item.startDate
                                                                            ? new Date(item.startDate).toISOString().split("T")[0]
                                                                            : "",
                                                                        endDate: item.endDate
                                                                            ? new Date(item.endDate).toISOString().split("T")[0]
                                                                            : "",
                                                                        daysCount: item.daysCount,
                                                                        cid: item.cid || "",
                                                                        justificativa: item.justificativa,
                                                                        notes: item.notes || ""
                                                                    });
                                                                }}
                                                                className="h-9 w-9 p-0 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
                                                                title="Editar dados do atestado"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() =>
                                                                    setRejectionModal({
                                                                        open: true,
                                                                        id: item.id,
                                                                        reason: ""
                                                                    })
                                                                }
                                                                className="h-9 w-9 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl"
                                                                title="Rejeitar atestado"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    )}

                                                    {isItemLancado && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setPreviewDoc(item)}
                                                            className="border-white/10 text-slate-300 hover:text-white h-8 text-xs rounded-xl flex items-center gap-1"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            <span>Ver Detalhes</span>
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Modal de Visualização Ampliada da Foto / Documento */}
            <Dialog open={Boolean(previewDoc)} onOpenChange={(open) => !open && setPreviewDoc(null)}>
                <DialogContent className="max-w-3xl bg-slate-950 border-white/10 text-white rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
                            <FileText className="w-5 h-5 text-sky-400" />
                            Documento do Atestado Médico
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            Colaborador: {previewDoc?.employee?.name || previewDoc?.employeeName || previewDoc?.extractedName} • CPF:{" "}
                            {previewDoc?.cpf || previewDoc?.employee?.cpf || "-"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4 flex flex-col md:flex-row gap-6">
                        {/* Imagem */}
                        <div className="flex-1 bg-slate-900 rounded-2xl border border-white/10 p-2 flex items-center justify-center max-h-[500px] overflow-auto">
                            {previewDoc?.documentUrl ? (
                                previewDoc.documentUrl.startsWith("data:") || previewDoc.documentUrl.startsWith("http") ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={previewDoc.documentUrl}
                                        alt="Atestado Completo"
                                        className="max-h-[460px] object-contain rounded-xl"
                                    />
                                ) : (
                                    <iframe src={previewDoc.documentUrl} className="w-full h-[400px] rounded-xl" />
                                )
                            ) : (
                                <div className="text-center py-12 text-slate-500">
                                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                    <p>Nenhuma imagem arquivada para este atestado.</p>
                                </div>
                            )}
                        </div>

                        {/* Detalhes Extraídos */}
                        <div className="w-full md:w-72 space-y-4 text-xs">
                            <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 space-y-3">
                                <div>
                                    <span className="text-[10px] text-slate-500 uppercase font-black block">Período</span>
                                    <p className="text-white font-bold text-sm">
                                        {formatDataExibicao(previewDoc?.startDate)} até {formatDataExibicao(previewDoc?.endDate)}
                                    </p>
                                    <span className="text-sky-400 font-semibold">{previewDoc?.daysCount} dias abonados</span>
                                </div>

                                <div>
                                    <span className="text-[10px] text-slate-500 uppercase font-black block">CID</span>
                                    <p className="text-white font-bold">{previewDoc?.cid || "Não informado"}</p>
                                </div>

                                <div>
                                    <span className="text-[10px] text-slate-500 uppercase font-black block">Médico / CRM</span>
                                    <p className="text-white font-bold">{previewDoc?.doctorName || "-"}</p>
                                    <p className="text-slate-400">{previewDoc?.doctorCrm || ""}</p>
                                </div>

                                <div>
                                    <span className="text-[10px] text-slate-500 uppercase font-black block">Status Secullum</span>
                                    <p className="text-emerald-400 font-semibold">{previewDoc?.secullumStatus || "Pendente de Envio"}</p>
                                </div>
                            </div>

                            {previewDoc?.status === "PENDENTE" && (
                                <Button
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl h-11 flex items-center justify-center gap-2"
                                    onClick={() => {
                                        if (previewDoc) handleLancarSecullum(previewDoc);
                                        setPreviewDoc(null);
                                    }}
                                >
                                    <Send className="w-4 h-4" />
                                    Lançar no Secullum Agora
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de Rejeição */}
            <Dialog open={rejectionModal.open} onOpenChange={(open) => !open && setRejectionModal({ open: false, id: "", reason: "" })}>
                <DialogContent className="max-w-md bg-slate-950 border-white/10 text-white rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-rose-400 flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-rose-500" />
                            Rejeitar Atestado Médico
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            Informe o motivo pelo qual este atestado não será aceito ou lançado no sistema de ponto.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 my-4">
                        <Label className="text-xs text-slate-300">Motivo da Recusa:</Label>
                        <Textarea
                            placeholder="Ex: Documento ilegível, sem assinatura médica, data divergente ou rasura..."
                            value={rejectionModal.reason}
                            onChange={(e) => setRejectionModal({ ...rejectionModal, reason: e.target.value })}
                            className="bg-slate-900 border-white/10 rounded-2xl text-xs text-white min-h-[100px]"
                        />
                    </div>

                    <DialogFooter className="flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setRejectionModal({ open: false, id: "", reason: "" })}
                            className="text-slate-400 hover:text-white rounded-xl"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirmRejection}
                            className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl px-5"
                        >
                            Confirmar Rejeição
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Edição Antes do Lançamento */}
            <Dialog open={editModal.open} onOpenChange={(open) => !open && setEditModal({ ...editModal, open: false })}>
                <DialogContent className="max-w-lg bg-slate-950 border-white/10 text-white rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                            <Edit3 className="w-5 h-5 text-sky-400" />
                            Editar Dados do Atestado
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            Ajuste qualquer dado antes de validar e lançar no Secullum.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 my-4 text-xs">
                        <div className="space-y-1.5">
                            <Label className="text-slate-300">Colaborador Vinculado:</Label>
                            <Select
                                value={editModal.employeeId}
                                onValueChange={(val) => setEditModal({ ...editModal, employeeId: val })}
                            >
                                <SelectTrigger className="bg-slate-900 border-white/10 text-white rounded-xl h-10">
                                    <SelectValue placeholder="Selecione o colaborador..." />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10 text-white max-h-56">
                                    {employees.map((emp) => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.name} (CPF: {emp.cpf})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-slate-300">Data de Início:</Label>
                                <Input
                                    type="date"
                                    value={editModal.startDate}
                                    onChange={(e) => setEditModal({ ...editModal, startDate: e.target.value })}
                                    className="bg-slate-900 border-white/10 text-white rounded-xl h-10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-slate-300">Data de Término:</Label>
                                <Input
                                    type="date"
                                    value={editModal.endDate}
                                    onChange={(e) => setEditModal({ ...editModal, endDate: e.target.value })}
                                    className="bg-slate-900 border-white/10 text-white rounded-xl h-10"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-slate-300">Dias de Afastamento:</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={editModal.daysCount}
                                    onChange={(e) => setEditModal({ ...editModal, daysCount: Number(e.target.value) || 1 })}
                                    className="bg-slate-900 border-white/10 text-white rounded-xl h-10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-slate-300">CID (Código de Doença):</Label>
                                <Input
                                    placeholder="Ex: M54.5"
                                    value={editModal.cid}
                                    onChange={(e) => setEditModal({ ...editModal, cid: e.target.value })}
                                    className="bg-slate-900 border-white/10 text-white rounded-xl h-10"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-slate-300">Justificativa no Secullum:</Label>
                            <Input
                                value={editModal.justificativa}
                                onChange={(e) => setEditModal({ ...editModal, justificativa: e.target.value })}
                                className="bg-slate-900 border-white/10 text-white rounded-xl h-10"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-slate-300">Observações adicionais:</Label>
                            <Input
                                placeholder="Notas internas ou observações"
                                value={editModal.notes}
                                onChange={(e) => setEditModal({ ...editModal, notes: e.target.value })}
                                className="bg-slate-900 border-white/10 text-white rounded-xl h-10"
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setEditModal({ ...editModal, open: false })}
                            className="text-slate-400 hover:text-white rounded-xl"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSaveEdit}
                            className="bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl px-5"
                        >
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Upload Manual com Leitura por IA */}
            <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
                <DialogContent className="max-w-md bg-slate-950 border-white/10 text-white rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-sky-400" />
                            Novo Atestado com IA
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            Faça upload da foto do atestado. O Gemini Vision extrairá o nome, datas, CID e cruzará com a base de colaboradores automaticamente.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="my-4">
                        <label className="border-2 border-dashed border-sky-500/30 hover:border-sky-500/60 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 bg-sky-500/5 hover:bg-sky-500/10 group">
                            <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={handleFileUpload}
                                disabled={uploadingFile}
                                className="hidden"
                            />
                            {uploadingFile ? (
                                <div className="space-y-3">
                                    <RefreshCw className="w-10 h-10 text-sky-400 animate-spin mx-auto" />
                                    <p className="text-sm font-bold text-white">Analisando atestado com IA...</p>
                                    <p className="text-xs text-slate-400">Identificando paciente, datas e CRM</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="p-4 bg-sky-500/10 rounded-2xl w-fit mx-auto text-sky-400 group-hover:scale-110 transition-transform">
                                        <UploadCloud className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">Clique para selecionar ou arraste aqui</p>
                                        <p className="text-xs text-slate-400 mt-1">Formatos suportados: JPG, PNG, WEBP</p>
                                    </div>
                                </div>
                            )}
                        </label>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setUploadModalOpen(false)}
                            disabled={uploadingFile}
                            className="text-slate-400 hover:text-white rounded-xl w-full"
                        >
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
