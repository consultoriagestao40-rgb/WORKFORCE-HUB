"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Search, User, Scale, Calendar, Clock, CheckCircle2, 
    AlertCircle, MessageSquare, Copy, Download, Trash2, ShieldAlert
} from "lucide-react";
import { toast } from "sonner";
import { resendDisciplinaryWhatsApp, deleteDisciplinaryMeasure } from "@/app/actions";

interface DisciplinaryDashboardProps {
    initialMeasures: any[];
    supervisors: any[];
}

export function DisciplinaryDashboard({ initialMeasures, supervisors }: DisciplinaryDashboardProps) {
    const [measures, setMeasures] = useState<any[]>(initialMeasures);
    const [search, setSearch] = useState("");
    const [selectedSupervisor, setSelectedSupervisor] = useState("all");
    const [selectedStatus, setSelectedStatus] = useState("all");

    // Stats
    const totalCount = measures.length;
    const pendingCount = measures.filter(m => m.status === "PENDENTE").length;
    const completedCount = measures.filter(m => m.status === "CONCLUIDO").length;

    // Filters
    const filteredMeasures = measures.filter(m => {
        const matchesSearch = m.employee.name.toLowerCase().includes(search.toLowerCase());
        const matchesSupervisor = selectedSupervisor === "all" || m.supervisorId === selectedSupervisor;
        const matchesStatus = selectedStatus === "all" || m.status === selectedStatus;
        return matchesSearch && matchesSupervisor && matchesStatus;
    });

    const handleDownload = (base64Data: string | null, fileName: string | null) => {
        if (!base64Data) {
            toast.error("Arquivo não encontrado.");
            return;
        }
        const link = document.createElement("a");
        link.href = base64Data;
        link.download = fileName || "comprovante.jpg";
        link.click();
        toast.success("Documento baixado!");
    };

    const handleCopyLink = (token: string) => {
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/disciplinary-upload/${token}`;
        navigator.clipboard.writeText(url);
        toast.success("Link de upload copiado para a área de transferência!");
    };

    const handleResendWhatsApp = async (id: string) => {
        const toastId = toast.loading("Reenviando WhatsApp para o supervisor...");
        try {
            const res = await resendDisciplinaryWhatsApp(id);
            if (res.success) {
                toast.success("Cobrança enviada ao supervisor via WhatsApp!", { id: toastId });
            } else {
                toast.error(res.error || "Erro ao reenviar WhatsApp.", { id: toastId });
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro interno ao enviar.", { id: toastId });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Deseja realmente excluir esta medida disciplinar do sistema?")) return;
        
        try {
            const res = await deleteDisciplinaryMeasure(id);
            if (res.success) {
                toast.success("Medida disciplinar excluída com sucesso!");
                setMeasures(prev => prev.filter(m => m.id !== id));
            } else {
                toast.error(res.error || "Erro ao excluir.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao processar exclusão.");
        }
    };

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-md bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-slate-400 text-xs uppercase tracking-wider font-bold">Total Solicitado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <span className="text-3xl font-black text-slate-800">{totalCount}</span>
                            <Scale className="w-10 h-10 text-indigo-500/20 bg-indigo-50 p-2 rounded-xl" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-slate-400 text-xs uppercase tracking-wider font-bold">Aguardando Assinatura</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <span className="text-3xl font-black text-amber-600">{pendingCount}</span>
                            <Clock className="w-10 h-10 text-amber-500/20 bg-amber-50 p-2 rounded-xl" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-slate-400 text-xs uppercase tracking-wider font-bold">Concluído e Arquivado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <span className="text-3xl font-black text-emerald-600">{completedCount}</span>
                            <CheckCircle2 className="w-10 h-10 text-emerald-500/20 bg-emerald-50 p-2 rounded-xl" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Section */}
            <Card className="border-none shadow-md bg-white">
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por colaborador..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-white border-slate-200 text-xs h-10"
                        />
                    </div>

                    <select
                        value={selectedSupervisor}
                        onChange={(e) => setSelectedSupervisor(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none"
                    >
                        <option value="all">Todos os Supervisores</option>
                        {supervisors.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>

                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none"
                    >
                        <option value="all">Todos os Status</option>
                        <option value="PENDENTE">Aguardando Assinatura</option>
                        <option value="CONCLUIDO">Assinado / Arquivado</option>
                    </select>

                    <div className="flex items-center justify-end text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Filtrados: {filteredMeasures.length} registros
                    </div>
                </CardContent>
            </Card>

            {/* Main Table */}
            <Card className="border-none shadow-md bg-white overflow-hidden">
                <div className="w-full overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="font-bold text-slate-800">Colaborador / Empresa</TableHead>
                                <TableHead className="font-bold text-slate-800">Supervisor Encarregado</TableHead>
                                <TableHead className="font-bold text-slate-800">Medida / CLT</TableHead>
                                <TableHead className="font-bold text-slate-800 text-center">Data Ocorrência</TableHead>
                                <TableHead className="font-bold text-slate-800 text-center">Data Criação</TableHead>
                                <TableHead className="font-bold text-slate-800 text-center">Status</TableHead>
                                <TableHead className="font-bold text-slate-800 text-right pr-6">Ações de Cobrança</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredMeasures.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-slate-400 font-bold">
                                        Nenhuma medida disciplinar encontrada para os filtros aplicados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredMeasures.map((measure) => {
                                    const occurrenceDate = new Date(measure.occurrenceDate).toLocaleDateString("pt-BR");
                                    const creationDate = new Date(measure.createdAt).toLocaleDateString("pt-BR");
                                    return (
                                        <TableRow key={measure.id} className="hover:bg-slate-50/50 transition-colors">
                                            <TableCell>
                                                <div className="font-bold text-slate-900">{measure.employee.name}</div>
                                                <div className="text-[10px] text-slate-400 font-semibold">{measure.employee.company?.name || "Sem Empresa"}</div>
                                            </TableCell>
                                            <TableCell className="text-xs font-semibold text-slate-700">
                                                {measure.supervisor.name}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-bold text-slate-800 text-xs">
                                                    {measure.type === "SUSPENSAO" ? "Suspensão" : "Advertência Escrita"}
                                                </div>
                                                {measure.cltArticle && (
                                                    <div className="text-[10px] text-slate-500 font-mono">{measure.cltArticle}</div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center text-xs font-medium text-slate-700">
                                                {occurrenceDate}
                                            </TableCell>
                                            <TableCell className="text-center text-xs font-medium text-slate-500">
                                                {creationDate}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className={
                                                    measure.status === "CONCLUIDO" 
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-black hover:bg-emerald-50" 
                                                        : "bg-amber-50 text-amber-700 border-amber-200 font-black hover:bg-amber-50"
                                                }>
                                                    {measure.status === "CONCLUIDO" ? "Assinado" : "Pendente"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex items-center justify-end gap-2">
                                                    {measure.status === "PENDENTE" && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleCopyLink(measure.token)}
                                                                className="h-8 text-[10px] text-indigo-600 border-indigo-100 hover:bg-indigo-50 font-bold gap-1"
                                                                title="Copiar Link de Upload"
                                                            >
                                                                <Copy className="w-3.5 h-3.5" /> Link
                                                            </Button>
                                                            {measure.supervisor.phone && (
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleResendWhatsApp(measure.id)}
                                                                    className="h-8 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 shadow-sm"
                                                                    title="Notificar supervisor novamente"
                                                                >
                                                                    <MessageSquare className="w-3.5 h-3.5" /> Cobrar
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                    {measure.attachmentData && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleDownload(measure.attachmentData, measure.attachmentName)}
                                                            className="h-8 text-[10px] text-emerald-600 border-emerald-100 hover:bg-emerald-50 font-bold gap-1"
                                                            title="Baixar comprovante assinado"
                                                        >
                                                            <Download className="w-3.5 h-3.5" /> Baixar
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleDelete(measure.id)}
                                                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                        title="Excluir Medida"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}
