"use client";

import { useState, useEffect } from "react";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    getBenefitTicketDetails, 
    addBenefitTicketNote, 
    addBenefitTicketAttachment, 
    sendBenefitTicketChatMessage, 
    resolveBenefitTicket,
    updateBenefitTicketStatus
} from "@/actions/benefit-tickets";
import { toast } from "sonner";
import { 
    CheckCircle2, 
    Clock, 
    AlertTriangle, 
    MessageSquare, 
    FileText, 
    Paperclip, 
    Send, 
    Upload, 
    User, 
    Building, 
    ShieldAlert, 
    ExternalLink,
    RefreshCw,
    Check,
    MessageCircle
} from "lucide-react";

interface Props {
    ticketId: string | null;
    open: boolean;
    onClose: () => void;
    onUpdated?: () => void;
}

export function BenefitTicketDetailsModal({ ticketId, open, onClose, onUpdated }: Props) {
    const [ticket, setTicket] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    
    // Anotações
    const [newNote, setNewNote] = useState("");
    const [submittingNote, setSubmittingNote] = useState(false);

    // Chat WhatsApp Colaborador
    const [chatMsg, setChatMsg] = useState("");
    const [sendingChat, setSendingChat] = useState(false);

    // Modal de Resolução
    const [resolveModalOpen, setResolveModalOpen] = useState(false);
    const [resolutionText, setResolutionText] = useState("");
    const [notifyGroup, setNotifyGroup] = useState(true);
    const [proofFileName, setProofFileName] = useState("");
    const [proofFileUrl, setProofFileUrl] = useState("");
    const [submittingResolve, setSubmittingResolve] = useState(false);

    // Upload de Arquivo / Comprovante
    const [uploadingAttachment, setUploadingAttachment] = useState(false);

    const loadData = async () => {
        if (!ticketId) return;
        setLoading(true);
        try {
            const data = await getBenefitTicketDetails(ticketId);
            setTicket(data);
        } catch (err: any) {
            toast.error(err.message || "Erro ao carregar detalhes do chamado");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && ticketId) {
            loadData();
        } else {
            setTicket(null);
        }
    }, [open, ticketId]);

    const handleAddNote = async () => {
        if (!newNote.trim() || !ticketId) return;
        setSubmittingNote(true);
        try {
            await addBenefitTicketNote(ticketId, newNote.trim());
            toast.success("Anotação interna registrada com sucesso!");
            setNewNote("");
            loadData();
            if (onUpdated) onUpdated();
        } catch (err: any) {
            toast.error(err.message || "Falha ao adicionar anotação");
        } finally {
            setSubmittingNote(false);
        }
    };

    const handleSendChat = async () => {
        if (!chatMsg.trim() || !ticketId) return;
        setSendingChat(true);
        try {
            await sendBenefitTicketChatMessage(ticketId, chatMsg.trim());
            toast.success("Mensagem enviada com sucesso no WhatsApp do colaborador!");
            setChatMsg("");
            loadData();
            if (onUpdated) onUpdated();
        } catch (err: any) {
            toast.error(err.message || "Falha ao enviar mensagem no WhatsApp");
        } finally {
            setSendingChat(false);
        }
    };

    const handleUploadMockProof = async (e: React.ChangeEvent<HTMLInputElement>, forResolution = false) => {
        const file = e.target.files?.[0];
        if (!file || !ticketId) return;

        setUploadingAttachment(true);
        try {
            // Leitura local / DataURL para armazenamento e exibição imediata
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = reader.result as string;
                if (forResolution) {
                    setProofFileName(file.name);
                    setProofFileUrl(base64);
                    toast.success(`Comprovante "${file.name}" anexado!`);
                } else {
                    await addBenefitTicketAttachment({
                        ticketId,
                        fileName: file.name,
                        fileUrl: base64,
                        mimeType: file.type
                    });
                    toast.success(`Arquivo "${file.name}" anexado com sucesso!`);
                    loadData();
                    if (onUpdated) onUpdated();
                }
                setUploadingAttachment(false);
            };
            reader.readAsDataURL(file);
        } catch (err: any) {
            toast.error("Erro ao ler arquivo.");
            setUploadingAttachment(false);
        }
    };

    const handleResolveTicket = async () => {
        if (!ticketId || !resolutionText.trim()) {
            toast.error("Por favor, digite o parecer / texto da solução.");
            return;
        }

        setSubmittingResolve(true);
        try {
            await resolveBenefitTicket({
                ticketId,
                resolutionNotes: resolutionText.trim(),
                notifyGroup,
                proofFileName: proofFileName || undefined,
                proofFileUrl: proofFileUrl || undefined
            });

            toast.success("Chamado concluído, baixado e devolutiva enviada ao grupo com sucesso!");
            setResolveModalOpen(false);
            onClose();
            if (onUpdated) onUpdated();
        } catch (err: any) {
            toast.error(err.message || "Erro ao baixar chamado");
        } finally {
            setSubmittingResolve(false);
        }
    };

    const handleStatusChange = async (newStatus: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CANCELLED") => {
        if (!ticketId) return;
        try {
            await updateBenefitTicketStatus(ticketId, newStatus);
            toast.success(`Status alterado para ${newStatus}`);
            loadData();
            if (onUpdated) onUpdated();
        } catch (err: any) {
            toast.error(err.message || "Erro ao alterar status");
        }
    };

    if (!open) return null;

    const isOverdue = ticket && (ticket.status === "OPEN" || ticket.status === "IN_PROGRESS") && new Date(ticket.dueAt) < new Date();

    return (
        <>
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl">
                    {/* HEADER DO TICKET */}
                    <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/80">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <Badge className="text-sm font-black px-3 py-1 bg-indigo-600 text-white rounded-xl">
                                    #{ticket?.ticketNumber || "TK-..."}
                                </Badge>
                                <span 
                                    className="px-2.5 py-0.5 rounded-lg text-xs font-bold text-white shadow-xs"
                                    style={{ backgroundColor: ticket?.type?.color || "#3b82f6" }}
                                >
                                    {ticket?.type?.name || ticket?.category}
                                </span>
                                {ticket?.status === "RESOLVED" ? (
                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> CONCLUÍDO
                                    </Badge>
                                ) : ticket?.status === "IN_PROGRESS" ? (
                                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold">
                                        <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" /> EM ANDAMENTO
                                    </Badge>
                                ) : (
                                    <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-bold">
                                        ABERTO
                                    </Badge>
                                )}
                                {isOverdue && (
                                    <Badge className="bg-red-100 text-red-800 border-red-300 font-extrabold animate-pulse">
                                        <AlertTriangle className="w-3.5 h-3.5 mr-1 text-red-600" /> SLA VENCIDO
                                    </Badge>
                                )}
                            </div>

                            {/* Ações Rápidas de Status */}
                            <div className="flex items-center gap-2">
                                {ticket?.status !== "RESOLVED" && (
                                    <>
                                        {ticket?.status === "OPEN" && (
                                            <Button 
                                                size="sm" 
                                                variant="outline"
                                                onClick={() => handleStatusChange("IN_PROGRESS")}
                                                className="h-8 text-xs font-bold border-amber-300 text-amber-700 hover:bg-amber-50"
                                            >
                                                Assumir (Em Andamento)
                                            </Button>
                                        )}
                                        <Button 
                                            size="sm"
                                            onClick={() => {
                                                setResolutionText(ticket?.notes?.[0]?.content || "");
                                                setResolveModalOpen(true);
                                            }}
                                            className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Baixar / Concluir Ticket
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        <DialogTitle className="text-base font-extrabold text-slate-900 mt-2">
                            {ticket?.title || "Carregando chamado..."}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Aberto pelo líder <strong className="text-slate-700">{ticket?.requestedByName || "Liderança"}</strong> no grupo <strong className="text-slate-700">{ticket?.sourceGroupName}</strong>
                        </DialogDescription>
                    </DialogHeader>

                    {/* BODY DO TICKET */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {loading && !ticket ? (
                            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                                <RefreshCw className="w-8 h-8 animate-spin mb-2 text-indigo-500" />
                                <p className="text-xs font-medium">Carregando detalhes do ticket...</p>
                            </div>
                        ) : (
                            <>
                                {/* PAINEL INFORMATIVO DO COLABORADOR E SLA */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                            <User className="w-3.5 h-3.5 text-slate-400" /> Dados do Colaborador
                                        </div>
                                        <p className="text-sm font-extrabold text-slate-900 leading-tight">
                                            {ticket?.employeeName}
                                        </p>
                                        <p className="text-xs text-slate-500 font-medium">
                                            CPF: <span className="font-semibold text-slate-700">{ticket?.employeeCpf || "Não informado"}</span>
                                        </p>
                                        <p className="text-xs text-slate-500 font-medium">
                                            Tel: <span className="font-semibold text-slate-700">{ticket?.employeePhone || "Sem telefone"}</span>
                                        </p>
                                    </div>

                                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                            <Building className="w-3.5 h-3.5 text-slate-400" /> Posto & Contrato
                                        </div>
                                        <p className="text-sm font-extrabold text-slate-900 leading-tight">
                                            {ticket?.postoName || "Posto não identificado"}
                                        </p>
                                        <p className="text-xs text-slate-500 font-medium">
                                            Cliente: <span className="font-semibold text-slate-700">{ticket?.clientName || "Geral"}</span>
                                        </p>
                                        <p className="text-xs text-slate-500 font-medium">
                                            Solicitante: <span className="font-semibold text-slate-700">{ticket?.requestedByName}</span>
                                        </p>
                                    </div>

                                    <div className={`p-3.5 rounded-2xl border space-y-1 ${isOverdue ? 'bg-red-50/70 border-red-200 text-red-950' : 'bg-indigo-50/60 border-indigo-100 text-indigo-950'}`}>
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                            <Clock className="w-3.5 h-3.5 text-indigo-500" /> Controle de SLA & Prazo
                                        </div>
                                        <p className="text-sm font-extrabold leading-tight">
                                            Limite: {new Date(ticket?.dueAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                                        </p>
                                        <p className="text-xs font-medium">
                                            SLA Acordado: <span className="font-bold">{ticket?.slaHours} horas</span>
                                        </p>
                                        <p className="text-[11px] font-bold">
                                            {ticket?.status === "RESOLVED" ? (
                                                <span className="text-emerald-700">Concluído em: {new Date(ticket.resolvedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                                            ) : isOverdue ? (
                                                <span className="text-red-700 font-extrabold">Prazo estourado! Devolutiva pendente.</span>
                                            ) : (
                                                <span className="text-indigo-700">Dentro do prazo regulamentar.</span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* DESCRIÇÃO ORIGINAL DA MENSAGEM DO GRUPO */}
                                <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/80">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block mb-1">
                                        💬 Mensagem original recebida no Grupo de Benefícios:
                                    </span>
                                    <p className="text-xs text-slate-800 italic font-medium leading-relaxed">
                                        "{ticket?.description}"
                                    </p>
                                </div>

                                {/* RESOLUÇÃO DO TICKET SE JÁ ESTIVER CONCLUÍDO */}
                                {ticket?.status === "RESOLVED" && ticket?.resolutionNotes && (
                                    <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black uppercase text-emerald-800 flex items-center gap-1.5">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Devolutiva e Solução Registrada
                                            </span>
                                            <span className="text-[10px] text-emerald-700 font-bold">
                                                Baixado por: {ticket?.resolvedByUser?.name || "DP"}
                                            </span>
                                        </div>
                                        <p className="text-xs text-emerald-950 font-semibold whitespace-pre-line">
                                            {ticket.resolutionNotes}
                                        </p>
                                    </div>
                                )}

                                {/* ABAS INTERATIVAS: ANOTAÇÕES, CHAT WHATSAPP E ANEXOS */}
                                <Tabs defaultValue="notes" className="w-full">
                                    <TabsList className="grid grid-cols-3 bg-slate-100 p-1 rounded-2xl">
                                        <TabsTrigger value="notes" className="rounded-xl font-bold text-xs gap-1.5">
                                            <FileText className="w-3.5 h-3.5" /> Anotações Internas ({ticket?.notes?.length || 0})
                                        </TabsTrigger>
                                        <TabsTrigger value="chat" className="rounded-xl font-bold text-xs gap-1.5">
                                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Colaborador
                                        </TabsTrigger>
                                        <TabsTrigger value="attachments" className="rounded-xl font-bold text-xs gap-1.5">
                                            <Paperclip className="w-3.5 h-3.5" /> Comprovantes & Anexos ({ticket?.attachments?.length || 0})
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* ABA 1: ANOTAÇÕES INTERNAS */}
                                    <TabsContent value="notes" className="space-y-4 pt-3">
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Adicionar anotação interna (ex: Cartão bloqueado, gerada 2ª via na Urbs...)"
                                                value={newNote}
                                                onChange={e => setNewNote(e.target.value)}
                                                onKeyDown={e => e.key === "Enter" && handleAddNote()}
                                                className="text-xs rounded-xl h-9"
                                            />
                                            <Button 
                                                onClick={handleAddNote} 
                                                disabled={submittingNote || !newNote.trim()}
                                                size="sm"
                                                className="bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs px-4"
                                            >
                                                {submittingNote ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Anotar"}
                                            </Button>
                                        </div>

                                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                            {ticket?.notes?.length === 0 ? (
                                                <p className="text-center text-xs text-slate-400 py-6">Nenhuma anotação registrada ainda.</p>
                                            ) : (
                                                ticket?.notes?.map((n: any) => (
                                                    <div key={n.id} className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs space-y-1">
                                                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                                                            <span className="font-extrabold text-slate-700">{n.userName}</span>
                                                            <span>{new Date(n.createdAt).toLocaleString("pt-BR")}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-800 font-medium whitespace-pre-line">{n.content}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </TabsContent>

                                    {/* ABA 2: CHAT WHATSAPP DIRETO COM O FUNCIONÁRIO */}
                                    <TabsContent value="chat" className="space-y-3 pt-3">
                                        <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 flex items-center justify-between text-xs text-emerald-900">
                                            <span>
                                                📱 Destino: <strong>{ticket?.employeeName}</strong> ({ticket?.employeePhone || "Sem telefone"})
                                            </span>
                                            <span className="text-[10px] text-emerald-700 font-bold">Z-API Conectada</span>
                                        </div>

                                        <div className="border border-slate-200 rounded-2xl h-56 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                                            {ticket?.chatMessages?.length === 0 ? (
                                                <div className="text-center py-10 text-xs text-slate-400">
                                                    Nenhuma mensagem trocada ainda com este colaborador pelo sistema.
                                                </div>
                                            ) : (
                                                ticket?.chatMessages?.map((m: any) => {
                                                    const isMe = m.senderType === "ATTENDANT" || m.senderType === "SYSTEM";
                                                    return (
                                                        <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                            <div className={`max-w-[75%] p-2.5 rounded-2xl text-xs font-medium ${isMe ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-2xs'}`}>
                                                                <p className="whitespace-pre-line">{m.content}</p>
                                                                <span className={`block text-[9px] mt-1 text-right ${isMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                                                                    {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Digite a mensagem para enviar direto no WhatsApp do colaborador..."
                                                value={chatMsg}
                                                onChange={e => setChatMsg(e.target.value)}
                                                onKeyDown={e => e.key === "Enter" && handleSendChat()}
                                                disabled={!ticket?.employeePhone}
                                                className="text-xs rounded-xl h-9"
                                            />
                                            <Button
                                                onClick={handleSendChat}
                                                disabled={sendingChat || !chatMsg.trim() || !ticket?.employeePhone}
                                                size="sm"
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs px-4 gap-1.5"
                                            >
                                                {sendingChat ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                                Enviar
                                            </Button>
                                        </div>
                                    </TabsContent>

                                    {/* ABA 3: COMPROVANTES E ANEXOS */}
                                    <TabsContent value="attachments" className="space-y-4 pt-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-500 font-medium">Arquivos e Comprovantes de Baixa</span>
                                            <label className="cursor-pointer">
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    onChange={e => handleUploadMockProof(e, false)} 
                                                    disabled={uploadingAttachment}
                                                />
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors">
                                                    {uploadingAttachment ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                                    Anexar Arquivo
                                                </span>
                                            </label>
                                        </div>

                                        <div className="space-y-2 max-h-56 overflow-y-auto">
                                            {ticket?.attachments?.length === 0 ? (
                                                <p className="text-center text-xs text-slate-400 py-6">Nenhum comprovante anexado a este ticket.</p>
                                            ) : (
                                                ticket?.attachments?.map((a: any) => (
                                                    <div key={a.id} className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Paperclip className="w-4 h-4 text-indigo-600" />
                                                            <div>
                                                                <p className="text-xs font-bold text-slate-800">{a.fileName}</p>
                                                                <span className="text-[10px] text-slate-400">Por {a.uploadedByName} em {new Date(a.createdAt).toLocaleDateString("pt-BR")}</span>
                                                            </div>
                                                        </div>
                                                        <a 
                                                            href={a.fileUrl} 
                                                            download={a.fileName}
                                                            target="_blank" 
                                                            rel="noreferrer"
                                                            className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                                                        >
                                                            Visualizar <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </>
                        )}
                    </div>

                    <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between">
                        <Button variant="outline" onClick={onClose} className="rounded-xl text-xs font-bold">
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL DE CONCLUSÃO & DEVOLUTIVA NO GRUPO */}
            <Dialog open={resolveModalOpen} onOpenChange={setResolveModalOpen}>
                <DialogContent className="sm:max-w-lg rounded-3xl p-6 space-y-4">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Concluir e Baixar Chamado
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Registre o parecer final e o comprovante. O sistema disparará a resposta automática no grupo de lideranças.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                                Parecer da Solução (será enviado na devolutiva ao grupo):
                            </label>
                            <Textarea 
                                placeholder="Ex: Carga realizada com sucesso no cartão Urbs no valor de R$ 120,00. Cartão liberado para uso..."
                                value={resolutionText}
                                onChange={e => setResolutionText(e.target.value)}
                                rows={4}
                                className="text-xs rounded-xl"
                            />
                        </div>

                        {/* Anexo do Comprovante de Baixa */}
                        <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                                Comprovante de Pagamento / Recarga (Opcional):
                            </label>
                            <label className="flex items-center justify-between p-3 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50">
                                <span className="text-xs text-slate-600 truncate max-w-[260px]">
                                    {proofFileName || "Clique para anexar extrato/comprovante..."}
                                </span>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    onChange={e => handleUploadMockProof(e, true)}
                                />
                                <span className="text-xs font-bold text-indigo-600">Procurar</span>
                            </label>
                        </div>

                        {/* Checkbox de Envio no Grupo */}
                        <div className="flex items-center gap-2 pt-1">
                            <input
                                type="checkbox"
                                id="notifyGroup"
                                checked={notifyGroup}
                                onChange={e => setNotifyGroup(e.target.checked)}
                                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                            />
                            <label htmlFor="notifyGroup" className="text-xs font-bold text-slate-800 cursor-pointer">
                                Disparar mensagem automática de solução no Grupo de Benefícios
                            </label>
                        </div>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button variant="outline" onClick={() => setResolveModalOpen(false)} className="rounded-xl text-xs">
                            Cancelar
                        </Button>
                        <Button 
                            onClick={handleResolveTicket} 
                            disabled={submittingResolve || !resolutionText.trim()}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs gap-1.5"
                        >
                            {submittingResolve ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Confirmar e Notificar no Grupo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
