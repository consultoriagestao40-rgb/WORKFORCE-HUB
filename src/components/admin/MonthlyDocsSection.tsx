"use client";

import { useState, useEffect } from "react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
    FolderOpen, 
    FileText, 
    Upload, 
    Download, 
    Trash2, 
    Plus, 
    Settings, 
    CheckCircle2, 
    AlertCircle, 
    Loader2 
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger 
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
    getMonthlyDocsData, 
    createDocumentRequirement, 
    deleteDocumentRequirement, 
    uploadMonthlyDocumentFile, 
    deleteMonthlyDocumentFile 
} from "@/actions/monthlyDocs";

interface MonthlyDocsSectionProps {
    clients: { id: string; name: string }[];
    isAdmin: boolean;
    currentClientId?: string;
}

export function MonthlyDocsSection({ clients, isAdmin, currentClientId = "" }: MonthlyDocsSectionProps) {
    const [selectedClientId, setSelectedClientId] = useState(currentClientId);
    const [selectedMonth, setSelectedMonth] = useState("");
    const [requirements, setRequirements] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Config requirement states
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [newDocName, setNewDocName] = useState("");
    const [newDocDesc, setNewDocDesc] = useState("");
    const [isCreatingReq, setIsCreatingReq] = useState(false);

    // Upload states
    const [uploadingReqId, setUploadingReqId] = useState<string | null>(null);

    // Last 12 months helper
    const [monthsList, setMonthsList] = useState<{ val: string; label: string }[]>([]);

    useEffect(() => {
        // Generate months on mount (client-side)
        const list = [];
        const date = new Date();
        for (let i = 0; i < 12; i++) {
            const m = subMonths(date, i);
            const val = format(m, "yyyy-MM");
            const label = format(m, "MMMM 'de' yyyy", { locale: ptBR });
            list.push({ val, label: label.charAt(0).toUpperCase() + label.slice(1) });
        }
        setMonthsList(list);
        setSelectedMonth(list[0]?.val || "");
    }, []);

    // Load data
    const loadData = async () => {
        if (!selectedClientId || selectedClientId === "all" || !selectedMonth) {
            setRequirements([]);
            return;
        }
        setLoading(true);
        const data = await getMonthlyDocsData(selectedClientId, selectedMonth);
        setRequirements(data);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [selectedClientId, selectedMonth]);

    // Handle create requirement
    const handleCreateRequirement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDocName.trim()) {
            toast.error("Por favor, informe o nome do documento.");
            return;
        }
        setIsCreatingReq(true);
        const res = await createDocumentRequirement(selectedClientId, newDocName, newDocDesc);
        setIsCreatingReq(false);
        if (res.success) {
            toast.success("Exigência criada com sucesso!");
            setNewDocName("");
            setNewDocDesc("");
            loadData();
        } else {
            toast.error(res.error || "Erro ao criar exigência.");
        }
    };

    // Handle delete requirement
    const handleDeleteRequirement = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta exigência? Isso apagará todos os arquivos históricos enviados para ela.")) {
            return;
        }
        const res = await deleteDocumentRequirement(id);
        if (res.success) {
            toast.success("Exigência excluída com sucesso!");
            loadData();
        } else {
            toast.error(res.error || "Erro ao excluir exigência.");
        }
    };

    // Handle file upload (supports multiple selection!)
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, requirementId: string) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploadingReqId(requirementId);
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            await new Promise<void>((resolve) => {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const base64 = event.target?.result as string;
                    const res = await uploadMonthlyDocumentFile(requirementId, selectedMonth, file.name, base64);
                    if (res.success) {
                        toast.success(`Arquivo "${file.name}" enviado com sucesso!`);
                    } else {
                        toast.error(res.error || `Erro ao enviar "${file.name}".`);
                    }
                    resolve();
                };
                reader.onerror = () => {
                    toast.error(`Erro ao ler o arquivo local "${file.name}".`);
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        }
        
        setUploadingReqId(null);
        loadData();
    };

    // Handle file delete
    const handleFileDelete = async (fileId: string) => {
        if (!confirm("Tem certeza que deseja excluir este arquivo?")) {
            return;
        }
        const res = await deleteMonthlyDocumentFile(fileId);
        if (res.success) {
            toast.success("Arquivo excluído com sucesso!");
            loadData();
        } else {
            toast.error(res.error || "Erro ao excluir arquivo.");
        }
    };

    // Handle file download helper
    const triggerDownload = (fileName: string, fileData: string) => {
        const link = document.createElement("a");
        link.href = fileData;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            {/* Header Control Panel */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-premium border border-slate-200/50">
                <div className="space-y-1">
                    <h3 className="text-md font-bold text-slate-850">Documentação Mensal do Contrato</h3>
                    <p className="text-xs text-slate-500 font-medium">Histórico mensal de certidões, cartões ponto, notas fiscais e relatórios solicitados.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* Client selector (only for Admin) */}
                    {isAdmin && (
                        <select
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                        >
                            <option value="all">-- Escolha um Cliente --</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    )}

                    {/* Month selector */}
                    {monthsList.length > 0 && (
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-3 outline-none cursor-pointer shadow-premium"
                        >
                            {monthsList.map(m => (
                                <option key={m.val} value={m.val}>{m.label}</option>
                            ))}
                        </select>
                    )}

                    {/* Manage Requirements button (Admin only) */}
                    {isAdmin && selectedClientId !== "all" && (
                        <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                            <DialogTrigger asChild>
                                <Button className="h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs gap-1.5 shadow-premium">
                                    <Settings className="w-4 h-4" /> Configurar Documentos
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle className="text-sm font-black">Configurar Exigências Mensais</DialogTitle>
                                    <DialogDescription className="text-xs">
                                        Cadastre os tipos de documentos solicitados mensalmente para este cliente.
                                    </DialogDescription>
                                </DialogHeader>

                                {/* List current requirements */}
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400">Exigências Ativas</Label>
                                    {requirements.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic">Nenhum documento configurado ainda.</p>
                                    ) : (
                                        requirements.map((req) => (
                                            <div key={req.id} className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs font-semibold">
                                                <span className="truncate">{req.name}</span>
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    onClick={() => handleDeleteRequirement(req.id)}
                                                    className="h-6 w-6 text-red-500 hover:bg-red-50 rounded"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Form to add new requirement */}
                                <form onSubmit={handleCreateRequirement} className="space-y-3 border-t pt-4">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400">Adicionar Nova Exigência</Label>
                                    <div className="space-y-1.5">
                                        <Input
                                            placeholder="Ex: Cartão Ponto, Nota Fiscal, Guia de FGTS..."
                                            value={newDocName}
                                            onChange={(e) => setNewDocName(e.target.value)}
                                            className="h-9 text-xs rounded-xl"
                                        />
                                        <Input
                                            placeholder="Descrição opcional..."
                                            value={newDocDesc}
                                            onChange={(e) => setNewDocDesc(e.target.value)}
                                            className="h-9 text-xs rounded-xl"
                                        />
                                    </div>
                                    <Button 
                                        type="submit" 
                                        disabled={isCreatingReq}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 rounded-xl text-xs gap-1.5"
                                    >
                                        {isCreatingReq ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                        Adicionar Exigência
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {/* Document Slots Table List */}
            {selectedClientId === "all" ? (
                <Card className="border border-slate-200/50 shadow-premium bg-white p-12 text-center">
                    <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-sm font-bold text-slate-700">Selecione um Cliente</h4>
                    <p className="text-xs text-slate-400 mt-1">Selecione um cliente no filtro acima para visualizar e gerenciar os documentos mensais.</p>
                </Card>
            ) : loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400 mb-2" />
                    <p className="text-xs italic">Carregando documentos...</p>
                </div>
            ) : requirements.length === 0 ? (
                <Card className="border border-slate-200/50 shadow-premium bg-white p-12 text-center">
                    <AlertCircle className="w-12 h-12 text-slate-350 mx-auto mb-3" />
                    <h4 className="text-sm font-bold text-slate-700">Nenhum documento exigido</h4>
                    {isAdmin ? (
                        <p className="text-xs text-slate-400 mt-1">
                            Clique em <strong>Configurar Documentos</strong> acima para cadastrar as exigências de envio mensal para este cliente.
                        </p>
                    ) : (
                        <p className="text-xs text-slate-400 mt-1">Nenhuma exigência de documentação mensal foi configurada para o seu contrato ainda.</p>
                    )}
                </Card>
            ) : (
                <div className="bg-white rounded-2xl shadow-premium border border-slate-200/50 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="font-bold text-slate-800 text-xs pl-6 py-3.5 w-1/3">Documento / Exigência</TableHead>
                                <TableHead className="font-bold text-slate-800 text-xs py-3.5 w-[120px] text-center">Status</TableHead>
                                <TableHead className="font-bold text-slate-800 text-xs py-3.5">Arquivos Anexados</TableHead>
                                {isAdmin && (
                                    <TableHead className="font-bold text-slate-800 text-xs py-3.5 text-right pr-6 w-[160px]">Ações</TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {requirements.map((req) => {
                                const files = req.files || [];
                                const isSent = files.length > 0;

                                return (
                                    <TableRow key={req.id} className="hover:bg-slate-50/35 transition-colors">
                                        {/* Name / Description */}
                                        <TableCell className="pl-6 py-4">
                                            <div className="flex items-center gap-2.5">
                                                <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                                                <div className="overflow-hidden">
                                                    <span className="text-xs font-bold text-slate-800 block truncate">{req.name}</span>
                                                    {req.description && (
                                                        <span className="text-[10px] text-slate-400 font-medium block truncate mt-0.5">{req.description}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Status Badge */}
                                        <TableCell className="text-center py-4">
                                            {isSent ? (
                                                <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-green-200 shrink-0">
                                                    <CheckCircle2 className="w-3 h-3" /> Enviado
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-red-200 shrink-0">
                                                    <AlertCircle className="w-3 h-3" /> Pendente
                                                </span>
                                            )}
                                        </TableCell>

                                        {/* Files list */}
                                        <TableCell className="py-4">
                                            {files.length === 0 ? (
                                                <span className="text-[11px] text-slate-400 font-bold italic">Nenhum arquivo enviado</span>
                                            ) : (
                                                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                                                    {files.map((file: any) => (
                                                        <div key={file.id} className="flex items-center justify-between gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100/50 transition-colors">
                                                            <div className="overflow-hidden">
                                                                <span className="truncate max-w-[240px] block font-bold text-slate-800" title={file.fileName}>{file.fileName}</span>
                                                                <span className="text-[9px] text-slate-450 font-medium block">Enviado em {format(new Date(file.uploadedAt), "dd/MM/yyyy 'às' HH:mm")}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    title="Baixar Arquivo"
                                                                    onClick={() => triggerDownload(file.fileName, file.fileData)}
                                                                    className="h-7 w-7 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg border border-slate-200 bg-white"
                                                                >
                                                                    <Download className="w-3.5 h-3.5" />
                                                                </Button>
                                                                {isAdmin && (
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        title="Excluir Arquivo"
                                                                        onClick={() => handleFileDelete(file.id)}
                                                                        className="h-7 w-7 text-red-550 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-100 bg-white"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* Upload/Actions */}
                                        {isAdmin && (
                                            <TableCell className="text-right pr-6 py-4">
                                                <div className="relative inline-block">
                                                    <Input
                                                        type="file"
                                                        onChange={(e) => handleFileUpload(e, req.id)}
                                                        className="hidden"
                                                        id={`file-upload-${req.id}`}
                                                        multiple // Support multiple files select!
                                                        disabled={uploadingReqId === req.id}
                                                    />
                                                    <Button 
                                                        size="sm"
                                                        disabled={uploadingReqId === req.id}
                                                        asChild
                                                        className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs gap-1.5 shadow-sm cursor-pointer"
                                                    >
                                                        <label htmlFor={`file-upload-${req.id}`}>
                                                            {uploadingReqId === req.id ? (
                                                                <>
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Upload className="w-3.5 h-3.5" /> Enviar Anexos
                                                                </>
                                                            )}
                                                        </label>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
