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
    Stethoscope,
    MessageSquare,
    Check,
    Trash2,
    RotateCcw,
    AlertTriangle,
    CheckCheck
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent } from "@/components/ui/card";
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
    restaurarAtestado,
    excluirAtestado,
    marcarAtestadoComoLancado,
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
    duplicateInfo?: {
        isDuplicate: boolean;
        conflictWithId: string;
        conflictWithName: string;
        conflictWithStatus: string;
        conflictStartDate: Date | string;
        conflictEndDate: Date | string;
        conflictDays: number;
    } | null;
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
    const [activeTab, setActiveTab] = useState<"pendentes" | "lancados" | "rejeitados">("pendentes");
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
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; name: string }>({
        open: false,
        id: "",
        name: ""
    });
    const [duplicateModal, setDuplicateModal] = useState<{
        open: boolean;
        atestado: MedicalCertificateItem | null;
        reason?: string;
    }>({
        open: false,
        atestado: null
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

    // Ação: Marcar como Já Lançado Manualmente
    const handleMarcarComoLancado = async (atestadoId: string, observacao?: string) => {
        const toastId = toast.loading("Marcando atestado como já lançado...");
        startTransition(async () => {
            try {
                const res = await marcarAtestadoComoLancado(atestadoId, observacao);
                if (res.success) {
                    toast.success("Atestado marcado como Lançado com sucesso!", { id: toastId });
                    setAtestados((prev) =>
                        prev.map((item) =>
                            item.id === atestadoId
                                ? {
                                      ...item,
                                      status: "LANCADO",
                                      secullumStatus: "SUCESSO",
                                      secullumResponse: observacao || "Marcado manualmente como já abonado no Secullum pelo gestor.",
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
                    setDuplicateModal({ open: false, atestado: null });
                }
            } catch (err: any) {
                toast.error(`Erro ao atualizar: ${err.message}`, { id: toastId });
            }
        });
    };

    // Ação: Lançar no Secullum
    const handleLancarSecullum = async (atestado: MedicalCertificateItem, force?: boolean) => {
        const cpf = atestado.cpf || atestado.employee?.cpf;
        if (!atestado.employeeId && !cpf) {
            toast.error("Por favor, vincule um colaborador antes de lançar no Secullum.");
            return;
        }

        // Se houver alerta de duplicidade no sistema e não for forçado, abre o modal de aviso preventivo
        if (atestado.duplicateInfo && !force) {
            setDuplicateModal({
                open: true,
                atestado,
                reason: `Atenção: Já existe outro atestado registrado para ${atestado.employee?.name || atestado.employeeName || atestado.extractedName} nas mesmas datas (${atestado.duplicateInfo.conflictWithStatus === 'LANCADO' ? 'Já lançado no Secullum' : 'Registrado'}).`
            });
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
                } else if (res.isAlreadyInSecullum) {
                    toast.dismiss(toastId);
                    setDuplicateModal({
                        open: true,
                        atestado,
                        reason: res.message
                    });
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

    // Ação: Excluir Atestado Definitivamente
    const handleConfirmDelete = async () => {
        if (!deleteModal.id) return;

        startTransition(async () => {
            try {
                const target = atestados.find(a => a.id === deleteModal.id);
                await excluirAtestado(deleteModal.id);
                toast.success("Atestado excluído com sucesso.");
                setAtestados((prev) => prev.filter((item) => item.id !== deleteModal.id));
                if (target) {
                    setStats((prev) => ({
                        ...prev,
                        total: Math.max(0, prev.total - 1),
                        pendentes: target.status === "PENDENTE" ? Math.max(0, prev.pendentes - 1) : prev.pendentes,
                        lancados: target.status === "LANCADO" ? Math.max(0, prev.lancados - 1) : prev.lancados,
                        rejeitados: target.status === "REJEITADO" ? Math.max(0, prev.rejeitados - 1) : prev.rejeitados
                    }));
                }
                setDeleteModal({ open: false, id: "", name: "" });
            } catch (err: any) {
                toast.error(`Erro ao excluir atestado: ${err.message}`);
            }
        });
    };

    // Ação: Restaurar Atestado Rejeitado para Pendente
    const handleRestoreAtestado = async (id: string) => {
        startTransition(async () => {
            try {
                await restaurarAtestado(id);
                toast.success("Atestado restaurado para Pendentes de Validação.");
                setAtestados((prev) =>
                    prev.map((item) =>
                        item.id === id ? { ...item, status: "PENDENTE", rejectionReason: null } : item
                    )
                );
                setStats((prev) => ({
                    ...prev,
                    rejeitados: Math.max(0, prev.rejeitados - 1),
                    pendentes: prev.pendentes + 1
                }));
            } catch (err: any) {
                toast.error(`Erro ao restaurar atestado: ${err.message}`);
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
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-2 border-b border-slate-200">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
                            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                            Captura IA + Secullum Ponto Web
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            <MessageSquare className="w-3 h-3 text-emerald-600" />
                            Grupo WhatsApp RH Conectado
                        </span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
                        <FileText className="w-8 h-8 text-sky-600" />
                        Gestão de Atestados Médicos
                    </h1>
                    <p className="text-sm text-slate-500 font-medium mt-1">
                        Atestados recebidos via WhatsApp (Grupo RH) e manuais validados por IA e integrados automaticamente ao Secullum.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => setUploadModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm rounded-xl px-4 h-10 flex items-center gap-2 transition-all duration-200 hover:shadow-md"
                    >
                        <Sparkles className="w-4 h-4 text-indigo-200" />
                        <span>Novo Atestado (IA)</span>
                    </Button>
                </div>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Pendentes */}
                <div
                    onClick={() => setActiveTab("pendentes")}
                    className={`bg-white rounded-xl border p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md ${
                        activeTab === "pendentes"
                            ? "border-amber-400 ring-2 ring-amber-100 bg-amber-50/20"
                            : "border-slate-200 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                            Pendentes de Validação
                        </span>
                        <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-slate-900">{stats.pendentes}</div>
                        <p className="text-xs text-amber-700 font-medium mt-1">Aguardando conferência do gestor</p>
                    </div>
                </div>

                {/* Lançados */}
                <div
                    onClick={() => setActiveTab("lancados")}
                    className={`bg-white rounded-xl border p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md ${
                        activeTab === "lancados"
                            ? "border-emerald-400 ring-2 ring-emerald-100 bg-emerald-50/20"
                            : "border-slate-200 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                            Lançados no Secullum
                        </span>
                        <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-slate-900">{stats.lancados}</div>
                        <p className="text-xs text-emerald-700 font-medium mt-1">Abonados e integrados com sucesso</p>
                    </div>
                </div>

                {/* Rejeitados */}
                <div
                    onClick={() => setActiveTab("rejeitados")}
                    className={`bg-white rounded-xl border p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md ${
                        activeTab === "rejeitados"
                            ? "border-rose-400 ring-2 ring-rose-100 bg-rose-50/20"
                            : "border-slate-200 hover:border-slate-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                            Rejeitados / Inválidos
                        </span>
                        <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
                            <XCircle className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-slate-900">{stats.rejeitados}</div>
                        <p className="text-xs text-rose-700 font-medium mt-1">Recusados pela supervisão</p>
                    </div>
                </div>

                {/* Total */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Total Registrados
                        </span>
                        <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
                            <FileSpreadsheet className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-slate-900">{stats.total}</div>
                        <p className="text-xs text-slate-500 font-medium mt-1">Histórico acumulado de atestados</p>
                    </div>
                </div>
            </div>

            {/* Painel Principal com Abas e Filtros */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Abas */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 w-fit">
                        <button
                            onClick={() => setActiveTab("pendentes")}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === "pendentes"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            <span>Pendentes de Validação</span>
                            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                                {stats.pendentes}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab("lancados")}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === "lancados"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Lançados no Secullum</span>
                            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                                {stats.lancados}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab("rejeitados")}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === "rejeitados"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            <span>Rejeitados</span>
                        </button>
                    </div>

                    {/* Filtros: Busca e Empresa */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <Input
                                placeholder="Buscar colaborador, CPF, CID..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 bg-white border-slate-200 text-slate-800 text-xs h-10 w-[240px] rounded-xl focus:border-indigo-500"
                            />
                        </div>

                        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                            <SelectTrigger className="h-10 text-xs font-semibold bg-white border-slate-200 text-slate-700 rounded-xl w-[200px]">
                                <div className="flex items-center gap-1.5 truncate">
                                    <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                    <SelectValue placeholder="Todas as Empresas" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="bg-white border-slate-200 text-slate-800">
                                <SelectItem value="ALL">Todas as Empresas</SelectItem>
                                {companies.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {(selectedCompany !== "ALL" || search) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSelectedCompany("ALL");
                                    setSearch("");
                                }}
                                className="h-10 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 font-semibold rounded-xl"
                            >
                                <X className="w-3.5 h-3.5" />
                                Limpar
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tabela de Resultados */}
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-20 text-[11px] font-bold uppercase tracking-wider text-slate-600">Doc</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Colaborador (Secullum)</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Período / Dias</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Diagnóstico / Médico</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Origem / Status</TableHead>
                                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-slate-600">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAtestados.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-16 text-slate-500">
                                        <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                                        <p className="font-bold text-slate-700 text-sm">Nenhum atestado encontrado nesta visualização.</p>
                                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                                            Atestados enviados no grupo de WhatsApp ou adicionados manualmente aparecerão aqui automaticamente.
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
                                            className="hover:bg-slate-50/70 border-b border-slate-100 transition-colors"
                                        >
                                            {/* Preview Foto */}
                                            <TableCell>
                                                {item.documentUrl ? (
                                                    <div
                                                        onClick={() => setPreviewDoc(item)}
                                                        className="w-12 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer relative group flex items-center justify-center shadow-xs"
                                                    >
                                                        {item.documentUrl.startsWith("data:") || item.documentUrl.startsWith("http") ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={item.documentUrl}
                                                                alt="Atestado"
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                            />
                                                        ) : (
                                                            <FileText className="w-6 h-6 text-slate-400" />
                                                        )}
                                                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <Eye className="w-4 h-4 text-white" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-12 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                )}
                                            </TableCell>

                                            {/* Colaborador */}
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-900 text-sm">
                                                            {item.employee?.name || item.employeeName || item.extractedName}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span className="font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200/80 font-medium">
                                                            CPF: {cpf || "Sem CPF"}
                                                        </span>
                                                        {item.employee?.company?.name && (
                                                            <span className="text-slate-500 truncate max-w-[160px]">
                                                                • {item.employee.company.name}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Alerta de Lançamento Duplicado */}
                                                    {item.duplicateInfo && (
                                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-bold mt-1 shadow-xs animate-in fade-in">
                                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                            <span>⚠️ Atenção: Já existe atestado ({item.duplicateInfo.conflictWithStatus === 'LANCADO' ? 'Lançado no Secullum' : 'Registrado'}) para este período!</span>
                                                        </div>
                                                    )}

                                                    {/* Botão de Trocar Colaborador (Caso a IA tenha errado) */}
                                                    {isItemPending && (
                                                        <div className="pt-1">
                                                            {changingEmployeeAtestadoId === item.id ? (
                                                                <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-200">
                                                                    <Select
                                                                        onValueChange={(val) => handleSelectEmployee(item.id, val)}
                                                                        defaultValue={item.employeeId || undefined}
                                                                    >
                                                                        <SelectTrigger className="w-64 h-8 text-xs bg-white border-indigo-400 text-slate-800 rounded-lg">
                                                                            <SelectValue placeholder="Selecione o colaborador..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="bg-white border-slate-200 text-slate-800 max-h-60">
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
                                                                        className="h-8 px-2 text-slate-500 hover:text-slate-800"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setChangingEmployeeAtestadoId(item.id)}
                                                                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline"
                                                                >
                                                                    <UserCheck className="w-3 h-3" />
                                                                    Trocar colaborador vinculado
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Período / Dias */}
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>{formatDataExibicao(item.startDate)}</span>
                                                        {item.daysCount > 1 && (
                                                            <>
                                                                <span className="text-slate-400">até</span>
                                                                <span>{formatDataExibicao(item.endDate)}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                                                            {item.daysCount} {item.daysCount === 1 ? "dia" : "dias de afastamento"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* Diagnóstico / Médico */}
                                            <TableCell>
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex items-center gap-2">
                                                        {item.cid ? (
                                                            <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                                CID: {item.cid}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 italic">CID não informado</span>
                                                        )}
                                                        <span className="text-slate-600 font-medium">{item.justificativa}</span>
                                                    </div>
                                                    {(item.doctorName || item.doctorCrm) && (
                                                        <div className="text-slate-500 flex items-center gap-1">
                                                            <Stethoscope className="w-3 h-3 text-slate-400" />
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
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                <Check className="w-3 h-3 text-emerald-600" />
                                                                Lançado no Secullum
                                                            </span>
                                                            {item.validatedByName && (
                                                                <p className="text-[10px] text-slate-500">
                                                                    Por: {item.validatedByName}
                                                                </p>
                                                            )}
                                                            {item.secullumLancadoEm && (
                                                                <p className="text-[10px] text-slate-400">
                                                                    Em: {formatDataExibicao(item.secullumLancadoEm)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : item.status === "REJEITADO" ? (
                                                        <div>
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                                Rejeitado
                                                            </span>
                                                            {item.rejectionReason && (
                                                                <p className="text-[10px] text-rose-600 truncate max-w-[160px] mt-0.5 font-medium">
                                                                    {item.rejectionReason}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                <Clock className="w-3 h-3 text-amber-600" />
                                                                Pendente Validação
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">
                                                                {item.source === "WHATSAPP" ? "📱 WhatsApp" : "💻 Upload Manual"}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Ações */}
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {isItemPending && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                disabled={isPending || !hasValidEmployee}
                                                                onClick={() => handleLancarSecullum(item)}
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-3 rounded-lg shadow-sm flex items-center gap-1.5 transition-all duration-200 hover:scale-[1.02]"
                                                            >
                                                                <Send className="w-3.5 h-3.5" />
                                                                <span>Lançar no Secullum</span>
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={isPending}
                                                                onClick={() => handleMarcarComoLancado(item.id, "Atestado validado e marcado como já abonado no Secullum pelo gestor.")}
                                                                className="h-9 px-2.5 text-xs text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 border-indigo-200 rounded-lg flex items-center gap-1 font-semibold transition-colors"
                                                                title="Marcar como já abonado no Secullum manualmente (sem reenviar à API)"
                                                            >
                                                                <CheckCheck className="w-3.5 h-3.5 text-indigo-600" />
                                                                <span>Já Lançado</span>
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="outline"
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
                                                                className="h-9 w-9 p-0 text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-100 rounded-lg"
                                                                title="Editar dados do atestado"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    setRejectionModal({
                                                                        open: true,
                                                                        id: item.id,
                                                                        reason: ""
                                                                    })
                                                                }
                                                                className="h-9 w-9 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 rounded-lg"
                                                                title="Rejeitar atestado"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    setDeleteModal({
                                                                        open: true,
                                                                        id: item.id,
                                                                        name: item.employee?.name || item.employeeName || item.extractedName || "Atestado"
                                                                    })
                                                                }
                                                                className="h-9 w-9 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-slate-200 rounded-lg"
                                                                title="Excluir atestado"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    )}

                                                    {isItemLancado && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => setPreviewDoc(item)}
                                                                className="border-slate-200 text-slate-700 hover:bg-slate-50 h-9 text-xs rounded-lg flex items-center gap-1 font-semibold"
                                                            >
                                                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                                                <span>Ver Detalhes</span>
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    setDeleteModal({
                                                                        open: true,
                                                                        id: item.id,
                                                                        name: item.employee?.name || item.employeeName || item.extractedName || "Atestado"
                                                                    })
                                                                }
                                                                className="h-9 w-9 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-slate-200 rounded-lg"
                                                                title="Excluir atestado"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    )}

                                                    {item.status === "REJEITADO" && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => setPreviewDoc(item)}
                                                                className="border-slate-200 text-slate-700 hover:bg-slate-50 h-9 text-xs rounded-lg flex items-center gap-1 font-semibold"
                                                                title="Ver atestado"
                                                            >
                                                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                                                <span>Ver</span>
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleRestoreAtestado(item.id)}
                                                                className="border-amber-200 text-amber-700 hover:bg-amber-50 h-9 text-xs rounded-lg flex items-center gap-1 font-semibold"
                                                                title="Restaurar de volta para Pendentes"
                                                            >
                                                                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                                                                <span>Restaurar</span>
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    setDeleteModal({
                                                                        open: true,
                                                                        id: item.id,
                                                                        name: item.employee?.name || item.employeeName || item.extractedName || "Atestado"
                                                                    })
                                                                }
                                                                className="h-9 px-2.5 text-xs text-rose-600 hover:text-white hover:bg-rose-600 border-rose-200 rounded-lg font-semibold flex items-center gap-1 transition-colors"
                                                                title="Excluir definitivamente"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                <span>Excluir</span>
                                                            </Button>
                                                        </>
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
                <DialogContent className="max-w-3xl bg-white border border-slate-200 text-slate-900 rounded-2xl p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-600" />
                            Documento do Atestado Médico
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Colaborador: {previewDoc?.employee?.name || previewDoc?.employeeName || previewDoc?.extractedName} • CPF:{" "}
                            {previewDoc?.cpf || previewDoc?.employee?.cpf || "-"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4 flex flex-col md:flex-row gap-6">
                        {/* Imagem */}
                        <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-2 flex items-center justify-center max-h-[500px] overflow-auto">
                            {previewDoc?.documentUrl ? (
                                previewDoc.documentUrl.startsWith("data:") || previewDoc.documentUrl.startsWith("http") ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={previewDoc.documentUrl}
                                        alt="Atestado Completo"
                                        className="max-h-[460px] object-contain rounded-lg shadow-sm"
                                    />
                                ) : (
                                    <iframe src={previewDoc.documentUrl} className="w-full h-[400px] rounded-lg" />
                                )
                            ) : (
                                <div className="text-center py-16 text-slate-400">
                                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-40" />
                                    <p className="text-sm font-medium">Nenhuma imagem arquivada para este atestado.</p>
                                </div>
                            )}
                        </div>

                        {/* Detalhes Extraídos */}
                        <div className="w-full md:w-72 space-y-4 text-xs">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                <div>
                                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Período</span>
                                    <p className="text-slate-900 font-bold text-sm">
                                        {formatDataExibicao(previewDoc?.startDate)} até {formatDataExibicao(previewDoc?.endDate)}
                                    </p>
                                    <span className="text-indigo-600 font-semibold">{previewDoc?.daysCount} dias abonados</span>
                                </div>

                                <div>
                                    <span className="text-[10px] text-slate-500 uppercase font-bold block">CID</span>
                                    <p className="text-slate-900 font-bold">{previewDoc?.cid || "Não informado"}</p>
                                </div>

                                <div>
                                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Médico / CRM</span>
                                    <p className="text-slate-900 font-bold">{previewDoc?.doctorName || "-"}</p>
                                    <p className="text-slate-500">{previewDoc?.doctorCrm || ""}</p>
                                </div>

                                <div>
                                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Status Secullum</span>
                                    <p className="text-emerald-600 font-bold">{previewDoc?.secullumStatus || "Pendente de Envio"}</p>
                                </div>
                            </div>

                            {previewDoc?.status === "PENDENTE" && (
                                <Button
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-11 flex items-center justify-center gap-2 shadow-sm"
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
                <DialogContent className="max-w-md bg-white border border-slate-200 text-slate-900 rounded-2xl p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-rose-700 flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-rose-600" />
                            Rejeitar Atestado Médico
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Informe o motivo pelo qual este atestado não será aceito ou lançado no sistema de ponto.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 my-4">
                        <Label className="text-xs font-semibold text-slate-700">Motivo da Recusa:</Label>
                        <Textarea
                            placeholder="Ex: Documento ilegível, sem assinatura médica, data divergente ou rasura..."
                            value={rejectionModal.reason}
                            onChange={(e) => setRejectionModal({ ...rejectionModal, reason: e.target.value })}
                            className="bg-white border-slate-200 rounded-xl text-xs text-slate-900 min-h-[100px] focus:border-rose-400"
                        />
                    </div>

                    <DialogFooter className="flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setRejectionModal({ open: false, id: "", reason: "" })}
                            className="text-slate-600 hover:text-slate-900 rounded-xl"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirmRejection}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl px-5"
                        >
                            Confirmar Rejeição
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Edição Antes do Lançamento */}
            <Dialog open={editModal.open} onOpenChange={(open) => !open && setEditModal({ ...editModal, open: false })}>
                <DialogContent className="max-w-lg bg-white border border-slate-200 text-slate-900 rounded-2xl p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Edit3 className="w-5 h-5 text-indigo-600" />
                            Editar Dados do Atestado
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Ajuste qualquer dado antes de validar e lançar no Secullum.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 my-4 text-xs">
                        <div className="space-y-1.5">
                            <Label className="text-slate-700 font-semibold">Colaborador Vinculado:</Label>
                            <Select
                                value={editModal.employeeId}
                                onValueChange={(val) => setEditModal({ ...editModal, employeeId: val })}
                            >
                                <SelectTrigger className="bg-white border-slate-200 text-slate-800 rounded-xl h-10">
                                    <SelectValue placeholder="Selecione o colaborador..." />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200 text-slate-800 max-h-56">
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
                                <Label className="text-slate-700 font-semibold">Data de Início:</Label>
                                <Input
                                    type="date"
                                    value={editModal.startDate}
                                    onChange={(e) => setEditModal({ ...editModal, startDate: e.target.value })}
                                    className="bg-white border-slate-200 text-slate-800 rounded-xl h-10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-slate-700 font-semibold">Data de Término:</Label>
                                <Input
                                    type="date"
                                    value={editModal.endDate}
                                    onChange={(e) => setEditModal({ ...editModal, endDate: e.target.value })}
                                    className="bg-white border-slate-200 text-slate-800 rounded-xl h-10"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-slate-700 font-semibold">Dias de Afastamento:</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={editModal.daysCount}
                                    onChange={(e) => setEditModal({ ...editModal, daysCount: Number(e.target.value) || 1 })}
                                    className="bg-white border-slate-200 text-slate-800 rounded-xl h-10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-slate-700 font-semibold">CID (Código de Doença):</Label>
                                <Input
                                    placeholder="Ex: M54.5"
                                    value={editModal.cid}
                                    onChange={(e) => setEditModal({ ...editModal, cid: e.target.value })}
                                    className="bg-white border-slate-200 text-slate-800 rounded-xl h-10"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-slate-700 font-semibold">Justificativa no Secullum:</Label>
                            <Input
                                value={editModal.justificativa}
                                onChange={(e) => setEditModal({ ...editModal, justificativa: e.target.value })}
                                className="bg-white border-slate-200 text-slate-800 rounded-xl h-10"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-slate-700 font-semibold">Observações adicionais:</Label>
                            <Input
                                placeholder="Notas internas ou observações"
                                value={editModal.notes}
                                onChange={(e) => setEditModal({ ...editModal, notes: e.target.value })}
                                className="bg-white border-slate-200 text-slate-800 rounded-xl h-10"
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setEditModal({ ...editModal, open: false })}
                            className="text-slate-600 hover:text-slate-900 rounded-xl"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSaveEdit}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl px-5"
                        >
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Upload Manual com Leitura por IA */}
            <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
                <DialogContent className="max-w-md bg-white border border-slate-200 text-slate-900 rounded-2xl p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-indigo-600" />
                            Novo Atestado com IA
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Faça upload da foto do atestado. O Gemini Vision extrairá o nome, datas, CID e cruzará com a base de colaboradores automaticamente.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="my-4">
                        <label className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 bg-indigo-50/30 hover:bg-indigo-50/60 group">
                            <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={handleFileUpload}
                                disabled={uploadingFile}
                                className="hidden"
                            />
                            {uploadingFile ? (
                                <div className="space-y-3">
                                    <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
                                    <p className="text-sm font-bold text-slate-800">Analisando atestado com IA...</p>
                                    <p className="text-xs text-slate-500">Identificando paciente, datas e CRM</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="p-4 bg-indigo-100/70 rounded-2xl w-fit mx-auto text-indigo-600 group-hover:scale-105 transition-transform">
                                        <UploadCloud className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">Clique para selecionar ou arraste aqui</p>
                                        <p className="text-xs text-slate-500 mt-1">Formatos suportados: JPG, PNG, WEBP, PDF</p>
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
                            className="text-slate-600 hover:text-slate-900 rounded-xl w-full"
                        >
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Confirmação de Exclusão */}
            <Dialog open={deleteModal.open} onOpenChange={(open) => !open && setDeleteModal({ open: false, id: "", name: "" })}>
                <DialogContent className="max-w-md bg-white border border-slate-200 text-slate-900 rounded-2xl p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-rose-700 flex items-center gap-2">
                            <Trash2 className="w-5 h-5 text-rose-600" />
                            Excluir Atestado
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Tem certeza que deseja excluir o atestado de <strong className="text-slate-800">{deleteModal.name}</strong>? Esta ação não pode ser desfeita e removerá o registro do sistema.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="flex gap-2 mt-4">
                        <Button
                            variant="ghost"
                            onClick={() => setDeleteModal({ open: false, id: "", name: "" })}
                            disabled={isPending}
                            className="text-slate-600 hover:text-slate-900 rounded-xl"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirmDelete}
                            disabled={isPending}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl px-5 flex items-center gap-1.5"
                        >
                            <Trash2 className="w-4 h-4" />
                            {isPending ? "Excluindo..." : "Sim, Excluir"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Alerta de Lançamento Duplicado */}
            <Dialog open={duplicateModal.open} onOpenChange={(open) => !open && setDuplicateModal({ open: false, atestado: null })}>
                <DialogContent className="max-w-md bg-white border border-amber-200 text-slate-900 rounded-2xl p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-amber-800 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                            Alerta de Lançamento Duplicado
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-600 mt-2">
                            {duplicateModal.reason || (
                                <>
                                    Detectamos que já existe outro atestado registrado para <strong>{duplicateModal.atestado?.employee?.name || duplicateModal.atestado?.employeeName}</strong> com datas coincidentes neste período.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 my-3 text-xs text-amber-900 space-y-1.5">
                        <p className="font-bold">Como você deseja prosseguir?</p>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                            Se este atestado já foi lançado manualmente no Secullum pelo RH (ou se já consta como <strong>AT. MED</strong> no cartão de ponto), você pode apenas clicar em <strong>Marcar como Lançado</strong> para atualizar o status no sistema.
                        </p>
                    </div>

                    <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-2">
                        <Button
                            variant="ghost"
                            onClick={() => setDuplicateModal({ open: false, atestado: null })}
                            className="text-slate-600 hover:text-slate-900 rounded-xl"
                        >
                            Cancelar
                        </Button>
                        {duplicateModal.atestado && (
                            <>
                                <Button
                                    onClick={() => handleMarcarComoLancado(duplicateModal.atestado!.id, "Atestado validado e marcado como já abonado no Secullum.")}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-4 flex items-center gap-1.5 text-xs shadow-xs"
                                >
                                    <CheckCheck className="w-4 h-4" />
                                    Marcar como Lançado
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        const att = duplicateModal.atestado!;
                                        setDuplicateModal({ open: false, atestado: null });
                                        handleLancarSecullum(att, true);
                                    }}
                                    className="border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl px-3 text-xs"
                                >
                                    Tentar Enviar Mesmo Assim
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
