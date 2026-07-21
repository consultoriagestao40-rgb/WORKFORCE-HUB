"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
    FileCheck,
    Plus,
    Search,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    FileText,
    History,
    ExternalLink,
    Building2,
    UserCheck,
    RotateCcw,
    Edit3,
    Trash2,
    ShieldCheck,
    Check,
    Download
} from "lucide-react";
import {
    createPopDocument,
    updatePopDocument,
    approvePopDocument,
    rejectPopDocument,
    deletePopDocument
} from "@/actions/pops";

interface PopsManagementSectionProps {
    clientId: string;
    clientName: string;
    postos: any[];
    initialPops: any[];
    isClientUser?: boolean;
    isAdminUser?: boolean;
}

export function PopsManagementSection({
    clientId,
    clientName,
    postos = [],
    initialPops = [],
    isClientUser = false,
    isAdminUser = true
}: PopsManagementSectionProps) {
    const [pops, setPops] = useState<any[]>(initialPops);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPostoFilter, setSelectedPostoFilter] = useState("all");
    const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");

    // Dialog states
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isReadOpen, setIsReadOpen] = useState(false);
    const [isRejectOpen, setIsRejectOpen] = useState(false);

    const [selectedPop, setSelectedPop] = useState<any | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    const [isPending, startTransition] = useTransition();

    // Stats
    const totalPops = pops.length;
    const approvedPops = pops.filter(p => p.status === "APPROVED").length;
    const pendingPops = pops.filter(p => p.status === "PENDING_APPROVAL").length;
    const rejectedPops = pops.filter(p => p.status === "REJECTED").length;

    // Filtered POPs
    const filteredPops = pops.filter(p => {
        const matchesSearch =
            p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesPosto =
            selectedPostoFilter === "all" ||
            (selectedPostoFilter === "general" && !p.postoId) ||
            p.postoId === selectedPostoFilter;

        const matchesStatus =
            selectedStatusFilter === "all" || p.status === selectedStatusFilter;

        return matchesSearch && matchesPosto && matchesStatus;
    });

    const formatRevision = (ver: number) => `Rev. ${String(ver - 1).padStart(2, '0')}`;

    const getStatusBadge = (status: string, approvedAt?: Date, approvedByName?: string) => {
        switch (status) {
            case "APPROVED":
                return (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Em Vigor (Aprovado)
                    </Badge>
                );
            case "PENDING_APPROVAL":
                return (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Pendente de Aceite
                    </Badge>
                );
            case "REJECTED":
                return (
                    <Badge className="bg-red-100 text-red-800 border-red-300 flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                        <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                        Solicitada Revisão
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-xs">
                        Rascunho
                    </Badge>
                );
        }
    };

    // Actions
    const handleCreateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.append("clientId", clientId);

        startTransition(async () => {
            const res = await createPopDocument(formData);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Documento POP criado com sucesso e enviado para aceite do cliente!");
                setIsCreateOpen(false);
                if (res.pop) setPops(prev => [res.pop, ...prev]);
            }
        });
    };

    const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedPop) return;
        const formData = new FormData(e.currentTarget);
        formData.append("id", selectedPop.id);

        startTransition(async () => {
            const res = await updatePopDocument(formData);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success(`Nova revisão (${formatRevision((selectedPop.version || 1) + 1)}) salva e enviada para aceite!`);
                setIsEditOpen(false);
                if (res.updated) {
                    setPops(prev => prev.map(p => p.id === selectedPop.id ? res.updated : p));
                }
            }
        });
    };

    const handleApprove = async (popId: string) => {
        startTransition(async () => {
            const res = await approvePopDocument(popId);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Aceite digital registrado com sucesso! O POP está em vigor.");
                setIsReadOpen(false);
                setPops(prev => prev.map(p => p.id === popId ? { ...p, status: "APPROVED", approvedAt: new Date() } : p));
            }
        });
    };

    const handleRejectSubmit = async () => {
        if (!selectedPop || !rejectReason.trim()) {
            toast.error("Informe o motivo da solicitação de revisão.");
            return;
        }

        startTransition(async () => {
            const res = await rejectPopDocument(selectedPop.id, rejectReason);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Solicitação de revisão enviada ao gestor.");
                setIsRejectOpen(false);
                setIsReadOpen(false);
                setRejectReason("");
                setPops(prev => prev.map(p => p.id === selectedPop.id ? { ...p, status: "REJECTED", rejectionReason: rejectReason } : p));
            }
        });
    };

    const handleDelete = async (popId: string) => {
        if (!confirm("Tem certeza que deseja excluir este documento POP?")) return;
        startTransition(async () => {
            const res = await deletePopDocument(popId);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Documento POP excluído.");
                setPops(prev => prev.filter(p => p.id !== popId));
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="w-6 h-6 text-indigo-400" />
                        <h2 className="text-xl font-bold tracking-tight">Procedimentos Operacionais Padrão (POPs)</h2>
                    </div>
                    <p className="text-xs text-slate-400">
                        Documentos de qualidade, controle de revisões (SGQ) e registro de aceite digital por contrato.
                    </p>
                </div>

                {(!isClientUser || isAdminUser) && (
                    <Button
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Criar Novo POP
                    </Button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-slate-100 rounded-lg text-slate-700">
                        <FileCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 font-medium">Total de POPs</div>
                        <div className="text-2xl font-bold text-slate-900">{totalPops}</div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-100 rounded-lg text-emerald-700">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-xs text-emerald-700 font-medium">Em Vigor (Aprovados)</div>
                        <div className="text-2xl font-bold text-emerald-900">{approvedPops}</div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-amber-100 rounded-lg text-amber-700">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-xs text-amber-700 font-medium">Pendente de Aceite</div>
                        <div className="text-2xl font-bold text-amber-900">{pendingPops}</div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/20 shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-red-100 rounded-lg text-red-700">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-xs text-red-700 font-medium">Solicitada Revisão</div>
                        <div className="text-2xl font-bold text-red-900">{rejectedPops}</div>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                        placeholder="Buscar por código, título ou categoria..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-slate-50 border-slate-200 text-xs"
                    />
                </div>

                <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
                    <div className="w-full md:w-48">
                        <Select value={selectedPostoFilter} onValueChange={setSelectedPostoFilter}>
                            <SelectTrigger className="h-9 text-xs bg-slate-50">
                                <SelectValue placeholder="Posto de Trabalho" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Postos</SelectItem>
                                <SelectItem value="general">Geral do Contrato</SelectItem>
                                {postos.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.role?.name || "Posto"} ({p.schedule})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-full md:w-48">
                        <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
                            <SelectTrigger className="h-9 text-xs bg-slate-50">
                                <SelectValue placeholder="Status de Aprovação" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Status</SelectItem>
                                <SelectItem value="APPROVED">Em Vigor (Aprovados)</SelectItem>
                                <SelectItem value="PENDING_APPROVAL">Pendente de Aceite</SelectItem>
                                <SelectItem value="REJECTED">Solicitada Revisão</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* POPs Grid */}
            {filteredPops.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-slate-700">Nenhum POP encontrado</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        Não há procedimentos operacionais cadastrados para os filtros selecionados.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredPops.map((pop) => (
                        <div
                            key={pop.id}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group"
                        >
                            {/* Card Header */}
                            <div className="p-5 border-b border-slate-100 flex-1 space-y-3">
                                <div className="flex justify-between items-start gap-2">
                                    <Badge className="bg-slate-900 text-white font-mono text-[11px] px-2.5 py-0.5 rounded-md">
                                        {pop.code}
                                    </Badge>
                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-semibold">
                                        {formatRevision(pop.version)}
                                    </Badge>
                                </div>

                                <div>
                                    <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">
                                        {pop.category || "Operacional"}
                                    </span>
                                    <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 mt-0.5">
                                        {pop.title}
                                    </h3>
                                </div>

                                {pop.description && (
                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                        {pop.description}
                                    </p>
                                )}

                                <div className="pt-2 flex flex-wrap gap-2 items-center text-xs text-slate-500">
                                    <div className="flex items-center gap-1 text-[11px] text-slate-600">
                                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                        <span>{pop.posto ? `${pop.posto.role?.name} (${pop.posto.schedule})` : "Geral do Contrato"}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Status & Approval info */}
                            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                {getStatusBadge(pop.status)}

                                {pop.approvedAt && (
                                    <span className="text-[10px] text-slate-400 font-medium" title={`Aprovado por ${pop.approvedBy?.name || 'Cliente'}`}>
                                        Aceito em {new Date(pop.approvedAt).toLocaleDateString('pt-BR')}
                                    </span>
                                )}
                            </div>

                            {/* Card Footer Actions */}
                            <div className="p-4 bg-white flex items-center justify-between gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedPop(pop);
                                        setIsReadOpen(true);
                                    }}
                                    className="flex-1 text-xs font-semibold h-9 border-slate-200 hover:bg-slate-50"
                                >
                                    <FileText className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                                    Visualizar POP
                                </Button>

                                {(!isClientUser || isAdminUser) && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            setSelectedPop(pop);
                                            setIsEditOpen(true);
                                        }}
                                        className="h-9 w-9 p-0 text-slate-500 hover:text-slate-900"
                                        title="Nova Revisão / Editar"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </Button>
                                )}

                                {isAdminUser && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete(pop.id)}
                                        className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                        title="Excluir POP"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* DIALOG 1: CRIAR POP */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-900">
                            <Plus className="w-5 h-5 text-indigo-600" />
                            Cadastrar Novo POP (Procedimento Operacional Padrão)
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            O documento será enviado ao cliente para análise e aceite digital. Inicialmente sairá na <b>Rev. 00</b>.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label className="text-xs font-bold uppercase text-slate-600">Código do POP</Label>
                                <Input
                                    name="code"
                                    placeholder="Ex: POP-001 (Automático)"
                                    className="h-9 text-xs font-mono mt-1"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <Label className="text-xs font-bold uppercase text-slate-600">Título do Procedimento *</Label>
                                <Input
                                    name="title"
                                    required
                                    placeholder="Ex: Higienização e Desinfecção de Ambientes"
                                    className="h-9 text-xs mt-1"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs font-bold uppercase text-slate-600">Categoria / Tipo</Label>
                                <Select name="category" defaultValue="Operacional">
                                    <SelectTrigger className="h-9 text-xs mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Operacional">Operacional / Serviços</SelectItem>
                                        <SelectItem value="Higienização">Higienização & Limpeza</SelectItem>
                                        <SelectItem value="Manutenção">Manutenção & Conservação</SelectItem>
                                        <SelectItem value="Segurança">Segurança & Portaria</SelectItem>
                                        <SelectItem value="Atendimento">Atendimento & Recepção</SelectItem>
                                        <SelectItem value="Qualidade">Qualidade & SGQ</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-xs font-bold uppercase text-slate-600">Posto de Trabalho Vinculado</Label>
                                <Select name="postoId" defaultValue="all">
                                    <SelectTrigger className="h-9 text-xs mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Geral do Contrato (Todos)</SelectItem>
                                        {postos.map(p => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.role?.name || "Posto"} ({p.schedule})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs font-bold uppercase text-slate-600">Objetivo / Resumo</Label>
                            <Input
                                name="description"
                                placeholder="Descreva brevemente o objetivo do procedimento..."
                                className="h-9 text-xs mt-1"
                            />
                        </div>

                        <div>
                            <Label className="text-xs font-bold uppercase text-slate-600">Passo a Passo / Procedimento Detalhado</Label>
                            <Textarea
                                name="content"
                                rows={6}
                                placeholder="Digite aqui o passo a passo, instruções, equipamentos necessários e regras de segurança do POP..."
                                className="text-xs mt-1 font-sans"
                            />
                        </div>

                        <div>
                            <Label className="text-xs font-bold uppercase text-slate-600">Link do Documento PDF / Anexo Externo (Opcional)</Label>
                            <Input
                                name="fileUrl"
                                type="url"
                                placeholder="https://exemplo.com/documentos/pop-001.pdf"
                                className="h-9 text-xs mt-1 font-mono"
                            />
                        </div>

                        <DialogFooter className="pt-4 border-t border-slate-100">
                            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="h-9 text-xs">
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isPending} className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                                {isPending ? "Salvando..." : "Emitir POP (Rev. 00)"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* DIALOG 2: EDITAR / NOVA REVISÃO DO POP */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-900">
                            <RotateCcw className="w-5 h-5 text-indigo-600" />
                            Publicar Nova Revisão do POP ({selectedPop?.code})
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            A publicação criará a <b>{formatRevision((selectedPop?.version || 1) + 1)}</b>. O status voltará a ser <b>Pendente de Aceite</b> até que o cliente aprove a nova versão.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedPop && (
                        <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-bold uppercase text-slate-600">Título do Procedimento *</Label>
                                    <Input
                                        name="title"
                                        required
                                        defaultValue={selectedPop.title}
                                        className="h-9 text-xs mt-1"
                                    />
                                </div>

                                <div>
                                    <Label className="text-xs font-bold uppercase text-slate-600">Categoria / Tipo</Label>
                                    <Select name="category" defaultValue={selectedPop.category || "Operacional"}>
                                        <SelectTrigger className="h-9 text-xs mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Operacional">Operacional / Serviços</SelectItem>
                                            <SelectItem value="Higienização">Higienização & Limpeza</SelectItem>
                                            <SelectItem value="Manutenção">Manutenção & Conservação</SelectItem>
                                            <SelectItem value="Segurança">Segurança & Portaria</SelectItem>
                                            <SelectItem value="Atendimento">Atendimento & Recepção</SelectItem>
                                            <SelectItem value="Qualidade">Qualidade & SGQ</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                                <Label className="text-xs font-bold uppercase text-amber-900">Motivo da Alteração / Justificativa da Revisão *</Label>
                                <Input
                                    name="changeReason"
                                    required
                                    placeholder="Ex: Atualização dos produtos químicos utilizados na desinfecção..."
                                    className="h-9 text-xs mt-1 bg-white border-amber-300"
                                />
                            </div>

                            <div>
                                <Label className="text-xs font-bold uppercase text-slate-600">Posto de Trabalho Vinculado</Label>
                                <Select name="postoId" defaultValue={selectedPop.postoId || "all"}>
                                    <SelectTrigger className="h-9 text-xs mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Geral do Contrato (Todos)</SelectItem>
                                        {postos.map(p => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.role?.name || "Posto"} ({p.schedule})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-xs font-bold uppercase text-slate-600">Objetivo / Resumo</Label>
                                <Input
                                    name="description"
                                    defaultValue={selectedPop.description || ""}
                                    className="h-9 text-xs mt-1"
                                />
                            </div>

                            <div>
                                <Label className="text-xs font-bold uppercase text-slate-600">Passo a Passo / Procedimento Detalhado</Label>
                                <Textarea
                                    name="content"
                                    rows={6}
                                    defaultValue={selectedPop.content || ""}
                                    className="text-xs mt-1 font-sans"
                                />
                            </div>

                            <div>
                                <Label className="text-xs font-bold uppercase text-slate-600">Link do Documento PDF / Anexo Externo</Label>
                                <Input
                                    name="fileUrl"
                                    type="url"
                                    defaultValue={selectedPop.fileUrl || ""}
                                    className="h-9 text-xs mt-1 font-mono"
                                />
                            </div>

                            <DialogFooter className="pt-4 border-t border-slate-100">
                                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} className="h-9 text-xs">
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={isPending} className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                                    {isPending ? "Salvando..." : `Publicar ${formatRevision((selectedPop.version || 1) + 1)}`}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* DIALOG 3: LEITURA & ACEITE DIGITAL DO CLIENTE */}
            <Dialog open={isReadOpen} onOpenChange={setIsReadOpen}>
                <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
                    {selectedPop && (
                        <div className="space-y-6">
                            <DialogHeader>
                                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-slate-900 text-white font-mono text-xs px-2.5 py-0.5">
                                            {selectedPop.code}
                                        </Badge>
                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-bold">
                                            {formatRevision(selectedPop.version)}
                                        </Badge>
                                    </div>

                                    {getStatusBadge(selectedPop.status, selectedPop.approvedAt, selectedPop.approvedBy?.name)}
                                </div>

                                <DialogTitle className="text-xl font-bold text-slate-900 pt-2">
                                    {selectedPop.title}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-slate-500 flex items-center gap-3 pt-1">
                                    <span>Categoria: <b>{selectedPop.category || "Operacional"}</b></span>
                                    <span>•</span>
                                    <span>Posto: <b>{selectedPop.posto ? `${selectedPop.posto.role?.name} (${selectedPop.posto.schedule})` : "Geral do Contrato"}</b></span>
                                    <span>•</span>
                                    <span>Elaborado por: <b>{selectedPop.author?.name || "Gestor de Operações"}</b></span>
                                </DialogDescription>
                            </DialogHeader>

                            <Tabs defaultValue="content" className="w-full">
                                <TabsList className="grid grid-cols-2 bg-slate-100 p-1 rounded-lg">
                                    <TabsTrigger value="content" className="text-xs font-semibold">
                                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                                        Procedimento Atual
                                    </TabsTrigger>
                                    <TabsTrigger value="revisions" className="text-xs font-semibold">
                                        <History className="w-3.5 h-3.5 mr-1.5" />
                                        Histórico de Revisões ({selectedPop.revisions?.length || 0})
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="content" className="space-y-4 pt-4">
                                    {/* Rejection Alert if Rejected */}
                                    {selectedPop.status === "REJECTED" && (
                                        <div className="bg-red-50 p-4 rounded-xl border border-red-200 space-y-1">
                                            <div className="flex items-center gap-2 text-xs font-bold text-red-900">
                                                <AlertCircle className="w-4 h-4 text-red-600" />
                                                Revisão Solicitada pelo Cliente:
                                            </div>
                                            <p className="text-xs text-red-700 italic pl-6">
                                                "{selectedPop.rejectionReason || "Nenhuma justificativa detalhada informada."}"
                                            </p>
                                        </div>
                                    )}

                                    {/* Approved Stamp */}
                                    {selectedPop.status === "APPROVED" && (
                                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-emerald-100 rounded-full text-emerald-700">
                                                    <UserCheck className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-emerald-900">Aceite Digital Registrado</div>
                                                    <div className="text-xs text-emerald-700">
                                                        Aprovado por <b>{selectedPop.approvedBy?.name || "Gestor do Cliente"}</b> em {new Date(selectedPop.approvedAt).toLocaleString('pt-BR')}
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge className="bg-emerald-600 text-white font-mono text-[10px]">
                                                VALIDADO SGQ
                                            </Badge>
                                        </div>
                                    )}

                                    {/* Description */}
                                    {selectedPop.description && (
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <div className="text-xs font-bold uppercase text-slate-500 mb-1">Objetivo & Resumo</div>
                                            <p className="text-xs text-slate-700 leading-relaxed">{selectedPop.description}</p>
                                        </div>
                                    )}

                                    {/* Content Body */}
                                    {selectedPop.content ? (
                                        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
                                            <div className="text-xs font-bold uppercase text-slate-500 mb-2">Instruções de Trabalho Detalhadas</div>
                                            <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                                                {selectedPop.content}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 text-slate-400 text-xs italic">
                                            Nenhum texto descritivo cadastrado. Consulte o anexo abaixo.
                                        </div>
                                    )}

                                    {/* Attachment PDF Link */}
                                    {selectedPop.fileUrl && (
                                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-5 h-5 text-indigo-600" />
                                                <div>
                                                    <div className="text-xs font-bold text-slate-800">Documento Oficial Anexo (PDF)</div>
                                                    <div className="text-[10px] text-slate-500 truncate max-w-xs">{selectedPop.fileUrl}</div>
                                                </div>
                                            </div>
                                            <Button
                                                asChild
                                                size="sm"
                                                variant="outline"
                                                className="h-8 text-xs font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                                            >
                                                <a href={selectedPop.fileUrl} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                                    Abrir PDF
                                                </a>
                                            </Button>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="revisions" className="space-y-3 pt-4">
                                    <div className="text-xs font-bold uppercase text-slate-500 mb-2">Histórico de Versões e Alterações</div>

                                    {selectedPop.revisions && selectedPop.revisions.length > 0 ? (
                                        <div className="space-y-3">
                                            {selectedPop.revisions.map((rev: any) => (
                                                <div key={rev.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <Badge className="bg-indigo-600 text-white font-mono text-[10px]">
                                                                {formatRevision(rev.version)}
                                                            </Badge>
                                                            <span className="text-xs font-bold text-slate-900">{rev.title}</span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            {new Date(rev.createdAt).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    </div>

                                                    <p className="text-xs text-slate-600 italic bg-white p-2 rounded border border-slate-100">
                                                        "{rev.changeReason}"
                                                    </p>

                                                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                                                        <span>Elaborado por: <b>{rev.author?.name || "Gestor"}</b></span>
                                                        {rev.approvedAt && (
                                                            <span className="text-emerald-700 font-medium flex items-center gap-1">
                                                                <Check className="w-3 h-3" />
                                                                Aceito por {rev.approvedBy?.name || "Cliente"} em {new Date(rev.approvedAt).toLocaleDateString('pt-BR')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 text-slate-400 text-xs italic">
                                            Nenhum histórico de revisão anterior registrado.
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>

                            {/* Footer Approval Bar */}
                            <DialogFooter className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsReadOpen(false)}
                                    className="h-9 text-xs w-full sm:w-auto"
                                >
                                    Fechar
                                </Button>

                                {selectedPop.status !== "APPROVED" && (
                                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => setIsRejectOpen(true)}
                                            className="h-9 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white"
                                        >
                                            <XCircle className="w-3.5 h-3.5 mr-1" />
                                            Solicitar Revisão
                                        </Button>

                                        <Button
                                            size="sm"
                                            disabled={isPending}
                                            onClick={() => handleApprove(selectedPop.id)}
                                            className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                            {isPending ? "Registrando..." : "Dar Aceite / Aprovar POP"}
                                        </Button>
                                    </div>
                                )}
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* DIALOG 4: SOLICITAR REVISÃO / REJEITAR */}
            <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600 text-base">
                            <XCircle className="w-5 h-5" />
                            Solicitar Revisão do POP ({selectedPop?.code})
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Informe as alterações necessárias. O gestor de operações será notificado para emitir uma nova revisão.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 pt-2">
                        <div>
                            <Label className="text-xs font-bold uppercase text-slate-600">Motivo / Alterações Solicitadas *</Label>
                            <Textarea
                                rows={4}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Descreva quais pontos precisam ser ajustados no procedimento..."
                                className="text-xs mt-1"
                            />
                        </div>

                        <DialogFooter className="pt-3">
                            <Button variant="outline" onClick={() => setIsRejectOpen(false)} className="h-9 text-xs">
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleRejectSubmit}
                                disabled={isPending}
                                className="h-9 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
                            >
                                {isPending ? "Enviando..." : "Confirmar Solicitação de Revisão"}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
