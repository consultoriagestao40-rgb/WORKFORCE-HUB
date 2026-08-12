"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Search, Paperclip, Send, CheckCheck, Clock, ShieldCheck,
    ArrowRightLeft, UserCheck, Lock, RefreshCw, X, Plus, Calendar, StickyNote,
    MessageSquare, Tag, UserPlus, FileText, Filter, Mic, Smile
} from "lucide-react";
import {
    getHrPipelineStages,
    getHrTickets,
    getHrLabels,
    seedDefaultPipeline,
    syncZapiChats,
    getHrTicketDetail,
    sendHrWhatsAppMessage,
    sendHrWhatsAppFile,
    getHrTicketMessages,
    markHrTicketRead,
    assumeHrTicket,
    transferHrTicket,
    closeHrTicket,
    addHrTicketNote,
    updateHrTicketStage,
    updateContactInfo,
    saveHrPipelineStages
} from "@/actions/hr-attendance";
import { HrKanbanView } from "./HrKanbanView";
import { HrLabelView } from "./HrLabelView";
import { HrAccessManager } from "./HrAccessManager";

interface Props {
    currentUser: any;
    allUsers: any[];
}

export function HrAttendanceClientPage({ currentUser, allUsers }: Props) {
    // Visões Superiores do SmartBidHub: 'list' (Lista + Chat) | 'kanban_label' | 'kanban_stage'
    const [viewMode, setViewMode] = useState<"list" | "kanban_label" | "kanban_stage">("list");
    const [ticketFilter, setTicketFilter] = useState<"open" | "closed">("open");

    const [stages, setStages] = useState<any[]>([]);
    const [tickets, setTickets] = useState<any[]>([]);
    const [labels, setLabels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Ticket Ativo Selecionado no SmartBid
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [ticketDetail, setTicketDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Filtros e Busca da Sidebar Esquerda
    const [searchQuery, setSearchQuery] = useState("");

    // Sub-abas do Chat no SmartBid (Chat | Anotações | Lembretes | Etiquetas | Cadastro)
    const [chatTab, setChatTab] = useState<"chat" | "notes" | "reminders" | "labels" | "register">("chat");
    const [messageText, setMessageText] = useState("");
    const [sending, setSending] = useState(false);

    // Anotações
    const [noteText, setNoteText] = useState("");

    const [showAccessManager, setShowAccessManager] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Carregar dados gerais
    const loadData = useCallback(async () => {
        try {
            await seedDefaultPipeline();
            const [stgs, tcks, lbls] = await Promise.all([
                getHrPipelineStages(),
                getHrTickets({ search: searchQuery }),
                getHrLabels()
            ]);

            setStages(stgs);
            setTickets(tcks);
            setLabels(lbls);

            if (tcks.length > 0 && !selectedTicketId) {
                setSelectedTicketId(tcks[0].id);
            }
        } finally {
            setLoading(false);
        }
    }, [searchQuery]);

    // Polling sutil a cada 3s para sincronização ao vivo sem travar a tela
    useEffect(() => {
        loadData();
        const interval = setInterval(async () => {
            const tcks = await getHrTickets({ search: searchQuery });
            setTickets(tcks);
        }, 3000);
        return () => clearInterval(interval);
    }, [loadData, searchQuery]);

    // Carregar detalhes do ticket selecionado
    const loadTicketDetail = useCallback(async (id: string) => {
        setLoadingDetail(true);
        try {
            const res = await getHrTicketDetail(id);
            if (res) {
                setTicketDetail(res);
                markHrTicketRead(id);
            }
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    useEffect(() => {
        if (selectedTicketId) {
            loadTicketDetail(selectedTicketId);
        }
    }, [selectedTicketId, loadTicketDetail]);

    // Polling a cada 3s para novas mensagens da conversa ativa
    useEffect(() => {
        if (!selectedTicketId) return;
        const interval = setInterval(async () => {
            const lastMsg = ticketDetail?.messages?.[ticketDetail.messages.length - 1];
            const since = lastMsg?.createdAt;
            const newMsgs = await getHrTicketMessages(selectedTicketId, since ? new Date(since).toISOString() : undefined);
            if (newMsgs.length > 0) {
                setTicketDetail((prev: any) => {
                    if (!prev || prev.id !== selectedTicketId) return prev;
                    const existingIds = new Set(prev.messages.map((m: any) => m.id));
                    const toAdd = newMsgs.filter(m => !existingIds.has(m.id));
                    if (toAdd.length === 0) return prev;
                    return { ...prev, messages: [...prev.messages, ...toAdd] };
                });
                markHrTicketRead(selectedTicketId);
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [selectedTicketId, ticketDetail?.messages]);

    // Scroll automático no chat
    useEffect(() => {
        if (chatTab === "chat") {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [ticketDetail?.messages, chatTab]);

    // Enviar mensagem pelo WhatsApp
    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!messageText.trim() || sending || !ticketDetail) return;

        const textToSend = messageText.trim();
        setMessageText("");
        setSending(true);

        const tempId = `temp-${Date.now()}`;
        const tempMsg = {
            id: tempId,
            senderType: "ATTENDANT",
            senderName: currentUser?.name || "Atendente",
            content: textToSend,
            status: "SENDING",
            createdAt: new Date().toISOString()
        };

        setTicketDetail((prev: any) => ({
            ...prev,
            messages: [...(prev?.messages || []), tempMsg]
        }));

        try {
            const res = await sendHrWhatsAppMessage({
                ticketId: ticketDetail.id,
                phone: ticketDetail.contactPhone,
                message: textToSend
            });

            if (res.message) {
                setTicketDetail((prev: any) => ({
                    ...prev,
                    messages: prev.messages.map((m: any) => m.id === tempId ? res.message : m)
                }));
            }
            loadData();
        } finally {
            setSending(false);
        }
    };

    // Upload de arquivos
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !ticketDetail) return;

        setSending(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });

            if (uploadRes.ok) {
                const { url } = await uploadRes.json();
                await sendHrWhatsAppFile({
                    ticketId: ticketDetail.id,
                    phone: ticketDetail.contactPhone,
                    fileUrl: url,
                    fileName: file.name,
                    mimeType: file.type
                });
                loadTicketDetail(ticketDetail.id);
                loadData();
            }
        } finally {
            setSending(false);
        }
    };

    // Encerrar Atendimento
    const handleCloseTicket = async () => {
        if (!ticketDetail) return;
        if (confirm("Deseja realmente encerrar este atendimento?")) {
            await closeHrTicket(ticketDetail.id);
            loadData();
            setSelectedTicketId(null);
        }
    };

    // Adicionar Nota
    const handleAddNote = async () => {
        if (!ticketDetail || !noteText.trim()) return;
        const res = await addHrTicketNote(ticketDetail.id, noteText.trim());
        if (res.note) {
            setNoteText("");
            setTicketDetail((prev: any) => ({ ...prev, notes: [...prev.notes, res.note] }));
        }
    };

    // Filtrar tickets por abas Abertas / Encerradas
    const openTickets = tickets.filter(t => t.status === "OPEN");
    const closedTickets = tickets.filter(t => t.status === "CLOSED");
    const displayedTickets = ticketFilter === "open" ? openTickets : closedTickets;

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-[#0b1329] p-3 font-sans overflow-hidden">
            {/* CONTAINER PRINCIPAL SMARTBID (Modal Dark de Tela Inteira) */}
            <div className="flex-1 bg-white rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-slate-700/50">
                {/* SMARTBID TOP HEADER BAR (Negro com Ícones e Botões de Visão) */}
                <div className="bg-[#0b1329] px-6 py-3.5 flex items-center justify-between border-b border-slate-800 text-white z-10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
                            💬
                        </div>
                        <div>
                            <h1 className="font-extrabold text-sm tracking-wide uppercase text-white">CENTRAL DE ATENDIMENTO WHATSAPP</h1>
                            <p className="text-[11px] text-slate-400">Acompanhe e responda todas as conversas do funil em tempo real</p>
                        </div>
                    </div>

                    {/* Botões Superiores do SmartBid: [ 📄 Lista ] [ 🏷️ Kanban por Etiquetas ] [ 📊 Kanban por Etapa ] */}
                    <div className="flex items-center gap-2">
                        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-700">
                            <button
                                onClick={() => setViewMode("list")}
                                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition flex items-center gap-1.5 ${viewMode === "list" ? "bg-[#1e293b] text-white shadow-xs" : "text-slate-400 hover:text-white"}`}
                            >
                                📄 Lista
                            </button>
                            <button
                                onClick={() => setViewMode("kanban_label")}
                                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition flex items-center gap-1.5 ${viewMode === "kanban_label" ? "bg-[#1e293b] text-white shadow-xs" : "text-slate-400 hover:text-white"}`}
                            >
                                🏷️ Kanban por Etiquetas
                            </button>
                            <button
                                onClick={() => setViewMode("kanban_stage")}
                                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition flex items-center gap-1.5 ${viewMode === "kanban_stage" ? "bg-[#1e293b] text-white shadow-xs" : "text-slate-400 hover:text-white"}`}
                            >
                                📊 Kanban por Etapa
                            </button>
                        </div>

                        {currentUser?.role === "ADMIN" && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 text-xs gap-1 border-slate-700 text-slate-300 bg-slate-900 hover:bg-slate-800"
                                onClick={() => setShowAccessManager(true)}
                            >
                                <Lock className="w-3.5 h-3.5" /> Acessos
                            </Button>
                        )}
                    </div>
                </div>

                {/* VISÃO 1: LISTA DE ATENDIMENTO E CHAT SMARTBID */}
                {viewMode === "list" && (
                    <div className="flex flex-1 overflow-hidden">
                        {/* PAINEL ESQUERDO SMARTBID: Lista de conversas com cards azuis */}
                        <div className="w-96 border-r border-slate-200 bg-slate-50/50 flex flex-col overflow-hidden flex-shrink-0">
                            {/* Search Bar + Abas Abertas / Encerradas */}
                            <div className="p-3 border-b border-slate-200 bg-white space-y-2.5">
                                <div className="relative">
                                    <Input
                                        placeholder="Pesquisar conversas..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="text-xs h-9 bg-slate-50 border-slate-200 rounded-xl"
                                    />
                                </div>

                                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                    <button
                                        onClick={() => setTicketFilter("open")}
                                        className={`flex-1 py-1 text-xs font-extrabold rounded-lg transition text-center ${ticketFilter === "open" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"}`}
                                    >
                                        Abertas ({openTickets.length})
                                    </button>
                                    <button
                                        onClick={() => setTicketFilter("closed")}
                                        className={`flex-1 py-1 text-xs font-extrabold rounded-lg transition text-center ${ticketFilter === "closed" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"}`}
                                    >
                                        Encerradas ({closedTickets.length})
                                    </button>
                                </div>
                            </div>

                            {/* Lista de Cards do SmartBid */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
                                {loading ? (
                                    <div className="p-6 text-center text-xs text-slate-400">Carregando conversas...</div>
                                ) : displayedTickets.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-slate-400">Nenhuma conversa nesta aba.</div>
                                ) : (
                                    displayedTickets.map((t) => {
                                        const isSelected = selectedTicketId === t.id;
                                        const initials = t.contactName?.slice(0, 2).toUpperCase() || "CN";

                                        return (
                                            <div
                                                key={t.id}
                                                onClick={() => setSelectedTicketId(t.id)}
                                                className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                                                    isSelected
                                                        ? "bg-emerald-50/70 border-emerald-500 shadow-2xs"
                                                        : "bg-white border-slate-200/90 hover:border-slate-300"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    {/* Avatar Circular com Iniciais no SmartBid */}
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center border flex-shrink-0">
                                                        {t.contactPhotoUrl && t.contactPhotoUrl !== "null" ? (
                                                            <img src={t.contactPhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                                                        ) : (
                                                            initials
                                                        )}
                                                    </div>

                                                    <div className="overflow-hidden">
                                                        <h4 className="text-xs font-extrabold text-slate-900 truncate">{t.contactName}</h4>
                                                        <span className="text-[10px] text-slate-400 block font-mono">Sem segmento</span>
                                                        <span className="text-[11px] text-slate-500 font-mono block">{t.contactPhone}</span>
                                                        <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border inline-block mt-1 uppercase">
                                                            Etapa: {t.stage?.name || "PROSPECT"}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-right flex-shrink-0">
                                                    <span className="text-xs font-extrabold text-slate-700">R$ 0</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* PAINEL DIREITO SMARTBID: CHAT REAL COM FUNDO DOODLE E BALÕES VERDES */}
                        <div className="flex-1 flex flex-col bg-[#efeae2] relative overflow-hidden">
                            {!ticketDetail ? (
                                <div className="flex-1 flex items-center justify-center text-xs text-slate-400 bg-slate-100">
                                    Selecione uma conversa ao lado para visualizar a central.
                                </div>
                            ) : (
                                <div className="flex flex-1 flex-col h-full overflow-hidden">
                                    {/* SmartBid Contact Header Bar */}
                                    <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between z-10 shadow-2xs">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center border">
                                                {ticketDetail.contactPhotoUrl && ticketDetail.contactPhotoUrl !== "null" ? (
                                                    <img src={ticketDetail.contactPhotoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                                                ) : (
                                                    ticketDetail.contactName?.slice(0, 2).toUpperCase()
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-extrabold text-slate-900 leading-tight">{ticketDetail.contactName}</h3>
                                                <span className="text-[11px] text-slate-500 font-mono">{ticketDetail.contactPhone}</span>
                                            </div>
                                        </div>

                                        {/* Botões do Header do SmartBid: [+ Participante] [RESP: Ádamo Quadros] [❌ Encerrar] [📋 Cadastro] [🟩 Funil] */}
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" className="h-7 text-[11px] font-bold border-slate-300">
                                                + Participante
                                            </Button>

                                            <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg border text-[11px] font-bold text-slate-700">
                                                <span className="text-slate-400 uppercase text-[9px]">RESP:</span>
                                                <span>{ticketDetail.assignee?.name || "Ádamo Quadros"}</span>
                                            </div>

                                            <Button variant="outline" size="sm" onClick={handleCloseTicket} className="h-7 text-[11px] font-bold border-red-200 text-red-600 hover:bg-red-50">
                                                ❌ Encerrar
                                            </Button>

                                            <Button variant="outline" size="sm" className="h-7 text-[11px] font-bold border-slate-300">
                                                📋 Cadastro
                                            </Button>

                                            <Button size="sm" className="h-7 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                                                🟩 Funil
                                            </Button>
                                        </div>
                                    </div>

                                    {/* SmartBid Sub-tabs: [ 💬 Chat ] [ 📝 Anotações ] [ ⏰ Lembretes ] [ 🏷️ Etiquetas ] [ 📋 Cadastro ] */}
                                    <div className="bg-white border-b border-slate-200 px-4 py-1.5 flex items-center gap-4 text-xs font-bold text-slate-600">
                                        <button
                                            onClick={() => setChatTab("chat")}
                                            className={`py-1 flex items-center gap-1.5 border-b-2 transition ${chatTab === "chat" ? "border-emerald-600 text-emerald-600" : "border-transparent hover:text-slate-900"}`}
                                        >
                                            <MessageSquare className="w-3.5 h-3.5" /> Chat
                                        </button>
                                        <button
                                            onClick={() => setChatTab("notes")}
                                            className={`py-1 flex items-center gap-1.5 border-b-2 transition ${chatTab === "notes" ? "border-emerald-600 text-emerald-600" : "border-transparent hover:text-slate-900"}`}
                                        >
                                            <FileText className="w-3.5 h-3.5" /> Anotações
                                        </button>
                                        <button
                                            onClick={() => setChatTab("reminders")}
                                            className={`py-1 flex items-center gap-1.5 border-b-2 transition ${chatTab === "reminders" ? "border-emerald-600 text-emerald-600" : "border-transparent hover:text-slate-900"}`}
                                        >
                                            <Clock className="w-3.5 h-3.5" /> Lembretes
                                        </button>
                                        <button
                                            onClick={() => setChatTab("labels")}
                                            className={`py-1 flex items-center gap-1.5 border-b-2 transition ${chatTab === "labels" ? "border-emerald-600 text-emerald-600" : "border-transparent hover:text-slate-900"}`}
                                        >
                                            <Tag className="w-3.5 h-3.5" /> Etiquetas
                                        </button>
                                    </div>

                                    {/* CONTEÚDO DO CHAT REAL DO SMARTBID */}
                                    {chatTab === "chat" && (
                                        <div className="flex-1 flex flex-col overflow-hidden bg-[#efeae2]">
                                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                                <div className="text-center my-2">
                                                    <span className="bg-white/80 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full shadow-2xs">
                                                        Hoje
                                                    </span>
                                                </div>

                                                {ticketDetail.messages?.map((msg: any) => {
                                                    const isAttendant = msg.senderType === "ATTENDANT";

                                                    return (
                                                        <div key={msg.id} className={`flex ${isAttendant ? "justify-end" : "justify-start"}`}>
                                                            <div className={`max-w-[70%] p-3 rounded-xl shadow-2xs text-xs ${isAttendant ? "bg-[#d9fdd3] text-slate-900 rounded-tr-none" : "bg-white text-slate-900 rounded-tl-none"}`}>
                                                                {isAttendant && (
                                                                    <div className="text-[10px] font-extrabold text-emerald-800 mb-1">
                                                                        *{msg.senderName || "Ádamo Quadros"}*:
                                                                    </div>
                                                                )}
                                                                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                                                <div className="flex items-center justify-end gap-1 text-[9px] text-slate-500 mt-1 font-mono">
                                                                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                    {isAttendant && <CheckCheck className="w-3.5 h-3.5 text-emerald-600 inline" />}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <div ref={messagesEndRef} />
                                            </div>

                                            {/* BARRA DE DIGITAÇÃO E ENVIO DO SMARTBID */}
                                            <div className="h-16 bg-[#f0f2f5] border-t border-slate-300 px-4 flex items-center gap-3">
                                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                                <button type="button" className="text-slate-500 hover:text-slate-700" onClick={() => fileInputRef.current?.click()}>
                                                    <Paperclip className="w-5 h-5" />
                                                </button>
                                                <button type="button" className="text-slate-500 hover:text-slate-700">
                                                    <Smile className="w-5 h-5" />
                                                </button>
                                                <Textarea
                                                    value={messageText}
                                                    onChange={(e) => setMessageText(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                                    placeholder="Digite uma mensagem..."
                                                    className="flex-1 text-xs resize-none h-10 min-h-[40px] bg-white border-none rounded-xl px-4 py-2.5 shadow-2xs"
                                                />
                                                <Button onClick={handleSendMessage} disabled={sending || !messageText.trim()} className="bg-[#0b1329] hover:bg-slate-800 text-white h-10 w-10 p-0 rounded-full flex items-center justify-center shadow-xs">
                                                    <Send className="w-4 h-4 ml-0.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* ABA ANOTAÇÕES */}
                                    {chatTab === "notes" && (
                                        <div className="flex-1 p-6 bg-slate-100 overflow-y-auto space-y-4">
                                            <div className="bg-white p-4 rounded-xl border shadow-2xs space-y-3">
                                                <h4 className="text-xs font-bold text-slate-800">Nova Anotação Interna</h4>
                                                <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Anotação interna..." className="text-xs h-20" />
                                                <div className="flex justify-end">
                                                    <Button size="sm" onClick={handleAddNote} className="bg-emerald-600 text-xs font-bold">Salvar Nota</Button>
                                                </div>
                                            </div>
                                            {ticketDetail.notes?.map((n: any) => (
                                                <div key={n.id} className="bg-white p-3 rounded-xl border shadow-2xs">
                                                    <div className="text-xs font-bold text-slate-800">{n.author?.name}</div>
                                                    <p className="text-xs text-slate-600 mt-1">{n.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* VISÃO 2: KANBAN POR ETIQUETAS DO SMARTBID */}
                {viewMode === "kanban_label" && (
                    <HrLabelView labels={labels} tickets={tickets} onSelectTicket={(id) => { setSelectedTicketId(id); setViewMode("list"); }} onLabelsUpdated={loadData} />
                )}

                {/* VISÃO 3: KANBAN POR ETAPA DO SMARTBID */}
                {viewMode === "kanban_stage" && (
                    <HrKanbanView stages={stages} tickets={tickets} onSelectTicket={(id) => { setSelectedTicketId(id); setViewMode("list"); }} onStagesUpdated={loadData} />
                )}
            </div>

            <HrAccessManager open={showAccessManager} onClose={() => setShowAccessManager(false)} />
        </div>
    );
}
