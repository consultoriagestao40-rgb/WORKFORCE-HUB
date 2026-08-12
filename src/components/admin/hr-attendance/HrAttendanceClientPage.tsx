"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Search, Paperclip, Send, CheckCheck, Clock, ShieldCheck,
    ArrowRightLeft, UserCheck, Lock, RefreshCw, X, Plus, Calendar, StickyNote, Filter,
    Phone, Video, MoreVertical, MessageSquare, DollarSign, ClipboardList
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
    completeHrTicketActivity,
    applyLabelToTicket,
    updateHrTicketStage,
    updateContactInfo,
    updateTicketStamp,
    saveHrPipelineStages
} from "@/actions/hr-attendance";
import { HrKanbanView } from "./HrKanbanView";
import { HrLabelView } from "./HrLabelView";
import { HrAccessManager } from "./HrAccessManager";
import { HrTicketModal } from "./HrTicketModal";
import { HrScheduleActivityModal } from "./HrScheduleActivityModal";



interface Props {
    currentUser: any;
    allUsers: any[];
}

export function HrAttendanceClientPage({ currentUser, allUsers }: Props) {
    // Alternador de Visões: 'chat' (WhatsApp Web Real) ou 'kanban' (Pipeline Kanban)
    const [mainView, setMainView] = useState<"chat" | "kanban">("chat");

    const [stages, setStages] = useState<any[]>([]);
    const [tickets, setTickets] = useState<any[]>([]);
    const [labels, setLabels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtro de Etapa no Topo (null = Todas)
    const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

    // Ticket Selecionado
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [ticketDetail, setTicketDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [selectedImageZoom, setSelectedImageZoom] = useState<string | null>(null);
    const [showScheduleAct, setShowScheduleAct] = useState(false);



    // Busca e Filtros
    const [searchQuery, setSearchQuery] = useState("");
    const [filterMode, setFilterMode] = useState<"all" | "unread">("all");

    // Chat State
    const [chatRightTab, setChatRightTab] = useState<"chat" | "notes">("chat");
    const [messageText, setMessageText] = useState("");
    const [sending, setSending] = useState(false);

    // Edição rápida de contato
    const [isEditingContact, setIsEditingContact] = useState(false);
    const [contactNameInput, setContactNameInput] = useState("");
    const [contactPhoneInput, setContactPhoneInput] = useState("");

    const [showAccessManager, setShowAccessManager] = useState(false);
    const [noteText, setNoteText] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Carregar dados iniciais
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

    // Polling rápido de 2s para sincronizar tempo real
    useEffect(() => {
        loadData();
        const interval = setInterval(async () => {
            const tcks = await getHrTickets({ search: searchQuery });
            setTickets(tcks);
        }, 2000);
        return () => clearInterval(interval);
    }, [loadData, searchQuery]);

    // Carregar detalhes do ticket selecionado
    const loadTicketDetail = useCallback(async (id: string) => {
        setLoadingDetail(true);
        try {
            const res = await getHrTicketDetail(id);
            if (res) {
                setTicketDetail(res);
                setContactNameInput(res.contactName);
                setContactPhoneInput(res.contactPhone);
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

    // Polling de 2s para novas mensagens da conversa ativa (Tempo Real)
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
        }, 2000);
        return () => clearInterval(interval);
    }, [selectedTicketId, ticketDetail?.messages]);

    // Scroll automático no chat
    useEffect(() => {
        if (chatRightTab === "chat") {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [ticketDetail?.messages, chatRightTab]);

    // Enviar mensagem
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
            senderName: "Você",
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

    // Upload de arquivo
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

    // Salvar alteração de contato
    const handleSaveContact = async () => {
        if (!ticketDetail) return;
        await updateContactInfo(ticketDetail.id, { name: contactNameInput, phone: contactPhoneInput });
        setIsEditingContact(false);
        setTicketDetail((prev: any) => ({ ...prev, contactName: contactNameInput, contactPhone: contactPhoneInput }));
        loadData();
    };

    // Assumir Atendimento
    const handleAssume = async () => {
        if (!ticketDetail) return;
        await assumeHrTicket(ticketDetail.id);
        loadTicketDetail(ticketDetail.id);
        loadData();
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

    // Alterar Etapa do Ticket
    const handleChangeStage = async (stageId: string) => {
        if (!ticketDetail) return;
        await updateHrTicketStage(ticketDetail.id, stageId);
        loadTicketDetail(ticketDetail.id);
        loadData();
    };

    // Filtrar lista de tickets
    const filteredTickets = tickets.filter(t => {
        if (selectedStageId && t.stageId !== selectedStageId) return false;
        if (filterMode === "unread" && t.unreadCount === 0) return false;
        return true;
    });

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-100 font-sans">
            {/* TOP BAR - LINHA 1: Título & Alternador de Visão + Acessos */}
            <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between shadow-2xs z-20">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                        W
                    </div>
                    <div>
                        <h1 className="font-black text-xs text-slate-900 leading-none">WaAtendimento</h1>
                        <span className="text-[9px] text-emerald-600 font-extrabold tracking-wider uppercase">WhatsApp RH CRM</span>
                    </div>
                </div>

                {/* Alternador de Visão [ 💬 Chat WhatsApp ] [ 📊 Pipeline Kanban ] + Acessos em Linha Dedicada */}
                <div className="flex items-center gap-2">
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button
                            onClick={() => setMainView("chat")}
                            className={`px-3 py-1 text-xs font-extrabold rounded-md transition ${mainView === "chat" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                        >
                            💬 Chat WhatsApp
                        </button>
                        <button
                            onClick={() => setMainView("kanban")}
                            className={`px-3 py-1 text-xs font-extrabold rounded-md transition ${mainView === "kanban" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                        >
                            📊 Pipeline Kanban
                        </button>
                    </div>

                    {currentUser?.role === "ADMIN" && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 border-slate-300 text-slate-700 font-bold"
                            onClick={() => setShowAccessManager(true)}
                        >
                            <Lock className="w-3 h-3" /> Acessos
                        </Button>
                    )}
                </div>
            </div>

            {/* TOP BAR - LINHA 2: Pílulas de Etapas do Pipeline (100% Livre com Scroll Suave) */}
            <div className="bg-slate-50 border-b border-slate-200/80 px-6 py-1.5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-2xs z-10">
                <button
                    onClick={() => setSelectedStageId(null)}
                    className={`px-3 py-1 rounded-full text-xs font-extrabold transition flex-shrink-0 whitespace-nowrap ${
                        selectedStageId === null
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                    }`}
                >
                    Todas ({tickets.length})
                </button>

                {stages.map((stg) => {
                    const count = tickets.filter(t => t.stageId === stg.id).length;
                    const isSelected = selectedStageId === stg.id;

                    return (
                        <button
                            key={stg.id}
                            onClick={() => setSelectedStageId(stg.id)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold transition flex-shrink-0 border whitespace-nowrap ${
                                isSelected
                                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                        >
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stg.color || "#10b981" }} />
                            <span>{stg.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${isSelected ? "bg-slate-700 text-white" : "bg-emerald-600 text-white"}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>


            {/* VISÃO 1: CHAT WHATSAPP WEB REAL (Conexão ao vivo) */}
            {mainView === "chat" && (
                <div className="flex flex-1 overflow-hidden">
                    {/* Painel Esquerdo: Lista de Conversas do WhatsApp */}
                    <div className="w-96 border-r border-slate-200 bg-white flex flex-col overflow-hidden flex-shrink-0">
                        <div className="p-3 border-b border-slate-100 bg-slate-50/80 space-y-2">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                <Input
                                    placeholder="Pesquisar ou começar uma nova conversa"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 text-xs h-9 bg-white border-slate-200 rounded-xl"
                                />
                            </div>

                            <div className="flex items-center gap-1.5 pt-0.5">
                                <button
                                    onClick={() => setFilterMode("all")}
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition ${filterMode === "all" ? "bg-slate-900 text-white" : "bg-slate-200/70 text-slate-600 hover:bg-slate-300"}`}
                                >
                                    Tudo
                                </button>
                                <button
                                    onClick={() => setFilterMode("unread")}
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition ${filterMode === "unread" ? "bg-slate-900 text-white" : "bg-slate-200/70 text-slate-600 hover:bg-slate-300"}`}
                                >
                                    Não lidas ({tickets.filter(t => t.unreadCount > 0).length})
                                </button>
                            </div>
                        </div>

                        {/* Lista de Contatos com Scroll Funcional */}
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0">
                            {loading ? (
                                <div className="p-6 text-center text-xs text-slate-400">Carregando conversas...</div>
                            ) : filteredTickets.length === 0 ? (
                                <div className="p-6 text-center text-xs text-slate-400">Nenhuma conversa encontrada.</div>
                            ) : (
                                filteredTickets.map((t) => {
                                    const isSelected = selectedTicketId === t.id;
                                    const lastMsg = t.messages?.[0];
                                    const isGroup = t.contactPhone?.includes("-group") || t.contactName?.toLowerCase().includes("grupo") || t.contactName?.toLowerCase().includes("rh -");

                                    return (
                                        <div
                                            key={t.id}
                                            onClick={() => setSelectedTicketId(t.id)}
                                            className={`p-3 flex items-center gap-3 cursor-pointer transition relative ${
                                                isSelected ? "bg-slate-100 border-l-4 border-l-emerald-500" : "hover:bg-slate-50"
                                            }`}
                                        >
                                            <div className="relative flex-shrink-0">
                                                {t.contactPhotoUrl && t.contactPhotoUrl !== "null" ? (
                                                    <img
                                                        src={t.contactPhotoUrl}
                                                        alt=""
                                                        className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-2xs"
                                                    />
                                                ) : isGroup ? (
                                                    <div className="w-12 h-12 rounded-full bg-emerald-700 text-white font-bold text-lg flex items-center justify-center shadow-2xs">
                                                        👥
                                                    </div>
                                                ) : (
                                                    <div className="w-12 h-12 rounded-full bg-slate-700 text-white font-bold text-sm flex items-center justify-center shadow-2xs">
                                                        {t.contactName?.charAt(0).toUpperCase() || "?"}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="overflow-hidden flex-1">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <h4 className="text-xs font-bold text-slate-900 truncate">{t.contactName}</h4>
                                                    <span className={`text-[10px] font-mono flex-shrink-0 ${t.unreadCount > 0 ? "text-emerald-600 font-extrabold" : "text-slate-400"}`}>
                                                        {new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between gap-1">
                                                    <p className="text-[11px] text-slate-500 truncate leading-snug flex-1">
                                                        {lastMsg ? (
                                                            <span>{lastMsg.senderType === "ATTENDANT" ? "✓ " : ""}{lastMsg.content}</span>
                                                        ) : (
                                                            <span className="italic text-slate-400">Atendimento iniciado</span>
                                                        )}
                                                    </p>

                                                    {/* Bolinha Verde do WhatsApp Web com a Quantidade de Não Lidas na Direita */}
                                                    {t.unreadCount > 0 && (
                                                        <span className="bg-[#25d366] text-white text-[10px] font-extrabold min-w-[20px] h-[20px] rounded-full flex items-center justify-center px-1.5 flex-shrink-0 shadow-2xs">
                                                            {t.unreadCount}
                                                        </span>
                                                    )}
                                                </div>

                                                {t.stage && (
                                                    <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded text-slate-600 bg-slate-100 border">
                                                        {t.stage.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Painel Direito: Chat WhatsApp Web Real */}
                    <div className="flex-1 flex flex-col bg-[#efeae2] relative overflow-hidden">
                        {!ticketDetail ? (
                            <div className="flex-1 flex items-center justify-center text-xs text-slate-400 bg-slate-100">
                                Selecione uma conversa ao lado para visualizar o chat.
                            </div>
                        ) : (
                            <div className="flex flex-1 flex-col h-full overflow-hidden">
                                {/* Header do Chat WhatsApp Web */}
                                <div className="h-16 bg-[#f0f2f5] border-b border-slate-300 px-4 flex items-center justify-between z-10 shadow-2xs">
                                    <div className="flex items-center gap-3">
                                        {ticketDetail.contactPhotoUrl && ticketDetail.contactPhotoUrl !== "null" ? (
                                            <img src={ticketDetail.contactPhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover border" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-[#128c7e] text-white font-bold text-sm flex items-center justify-center">
                                                👥
                                            </div>
                                        )}

                                        <div>
                                            {isEditingContact ? (
                                                <div className="flex items-center gap-1">
                                                    <Input
                                                        value={contactNameInput}
                                                        onChange={(e) => setContactNameInput(e.target.value)}
                                                        className="h-6 text-xs bg-white w-40"
                                                    />
                                                    <Button size="sm" className="h-6 text-[10px] bg-emerald-600" onClick={handleSaveContact}>OK</Button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    <h3 className="text-sm font-bold text-slate-800 leading-tight">{ticketDetail.contactName}</h3>
                                                    <button onClick={() => setIsEditingContact(true)} className="text-[10px] text-slate-400 hover:text-emerald-600">✏️</button>
                                                </div>
                                            )}
                                            <span className="text-[11px] text-slate-500 font-mono">{ticketDetail.contactPhone}</span>
                                        </div>
                                    </div>

                                    {/* Alternador de Abas: Chat | Notas | Agendar Atividade */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex bg-slate-200/80 p-0.5 rounded-lg">
                                            <button
                                                onClick={() => setChatRightTab("chat")}
                                                className={`px-3 py-1 text-xs font-extrabold rounded-md transition ${chatRightTab === "chat" ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                                            >
                                                💬 Chat ({ticketDetail.messages?.length || 0})
                                            </button>
                                            <button
                                                onClick={() => setChatRightTab("notes")}
                                                className={`px-3 py-1 text-xs font-extrabold rounded-md transition ${chatRightTab === "notes" ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                                            >
                                                📝 Notas ({ticketDetail.notes?.length || 0})
                                            </button>
                                        </div>

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs font-bold gap-1 bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                                            onClick={() => setShowScheduleAct(true)}
                                        >
                                            📅 Agendar Atividade
                                        </Button>


                                        <select
                                            value={ticketDetail.stageId}
                                            onChange={(e) => handleChangeStage(e.target.value)}
                                            className="bg-white border border-slate-300 text-slate-800 font-extrabold text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-emerald-500 shadow-2xs"
                                        >
                                            {stages.map((stg) => (
                                                <option key={stg.id} value={stg.id}>{stg.name}</option>
                                            ))}
                                        </select>

                                        {!ticketDetail.assignee && (
                                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-bold" onClick={handleAssume}>
                                                Assumir
                                            </Button>
                                        )}

                                        <Button variant="ghost" size="sm" className="h-8 text-xs text-red-600 hover:bg-red-50 font-bold" onClick={handleCloseTicket}>
                                            Encerrar
                                        </Button>

                                    </div>
                                </div>

                                {/* Chat WhatsApp Real */}
                                {chatRightTab === "chat" && (
                                    <div className="flex-1 flex flex-col overflow-hidden bg-[#efeae2] relative">
                                        {/* Papel de Parede Doodle do WhatsApp Web Oficial */}
                                        <div className="absolute inset-0 bg-[#efeae2] bg-[url('/whatsapp-doodle-bg.svg')] bg-[size:400px_400px] opacity-40 pointer-events-none" />

                                        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 relative z-0">
                                            {ticketDetail.messages?.map((msg: any) => {
                                                const isAttendant = msg.senderType === "ATTENDANT" || msg.fromMe === true;
                                                const showSenderHeader = !isAttendant && msg.senderName && msg.senderName !== ticketDetail.contactName;

                                                return (
                                                    <div key={msg.id} className={`flex ${isAttendant ? "justify-end" : "justify-start"}`}>
                                                        <div className={`max-w-[70%] p-2.5 rounded-lg shadow-2xs text-xs ${isAttendant ? "bg-[#d9fdd3] text-slate-900 rounded-tr-none" : "bg-white text-slate-900 rounded-tl-none"}`}>
                                                            {/* Nome do Colaborador que postou no grupo */}
                                                            {showSenderHeader && (
                                                                <div className="text-[11px] font-extrabold text-emerald-700 mb-1">
                                                                    {msg.senderName}
                                                                </div>
                                                            )}

                                                            {/* Exibição de Imagem com Zoom e Download ao Clicar */}
                                                            {msg.mediaUrl && (msg.messageType === "IMAGE" || msg.mediaUrl.match(/\.(jpg|jpeg|png|webp)/i)) && (
                                                                <div className="relative group cursor-pointer my-1 overflow-hidden rounded-lg border border-slate-200" onClick={() => setSelectedImageZoom(msg.mediaUrl)}>
                                                                    <img src={msg.mediaUrl} alt="Mídia" className="max-w-xs rounded-lg max-h-72 object-cover transition group-hover:scale-105" />
                                                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                                                        <span className="bg-slate-900/80 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-md">
                                                                            🔍 Expandir / Baixar
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Exibição de PDF Real com Download Direto */}
                                                            {msg.messageType === "DOCUMENT" && msg.mediaUrl && (
                                                                <div className="flex items-center gap-3 p-2.5 bg-slate-100/90 rounded-lg mb-2 border border-slate-200">
                                                                    <div className="w-9 h-9 rounded bg-red-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                                                                        PDF
                                                                    </div>
                                                                    <div className="overflow-hidden flex-1">
                                                                        <span className="font-bold text-slate-800 block truncate text-xs">
                                                                            {msg.mediaFileName || "Documento.pdf"}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-500">Documento • PDF</span>
                                                                    </div>
                                                                    <a
                                                                        href={msg.mediaUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        download={msg.mediaFileName || "documento.pdf"}
                                                                        className="text-xs bg-emerald-600 text-white font-bold px-2.5 py-1 rounded-md hover:bg-emerald-700 transition flex-shrink-0"
                                                                    >
                                                                        Baixar
                                                                    </a>
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

                                        {/* Barra de Digitação */}
                                        <div className="h-16 bg-[#f0f2f5] border-t border-slate-300 px-4 flex items-center gap-3">
                                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                            <button type="button" className="text-slate-500 hover:text-slate-700" onClick={() => fileInputRef.current?.click()}>
                                                <Paperclip className="w-5 h-5" />
                                            </button>
                                            <Textarea
                                                value={messageText}
                                                onChange={(e) => setMessageText(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                                placeholder="Digite uma mensagem..."
                                                className="flex-1 text-xs resize-none h-10 min-h-[40px] bg-white border-none rounded-xl px-4 py-2.5 shadow-2xs"
                                            />
                                            <Button onClick={handleSendMessage} disabled={sending || !messageText.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 w-10 p-0 rounded-full flex items-center justify-center shadow-xs">
                                                <Send className="w-4 h-4 ml-0.5" />
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Notas */}
                                {chatRightTab === "notes" && (
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

            {/* VISÃO 2: PIPELINE KANBAN (Abre modal de chat ao clicar no card) */}
            {mainView === "kanban" && (
                <>
                    <HrKanbanView
                        stages={stages}
                        tickets={tickets}
                        onSelectTicket={(id) => setSelectedTicketId(id)}
                        onStagesUpdated={loadData}
                    />

                    {/* Modal do Chat do WhatsApp Web ao Clicar no Card do Kanban */}
                    {selectedTicketId && (
                        <HrTicketModal
                            ticketId={selectedTicketId}
                            onClose={() => setSelectedTicketId(null)}
                            onUpdated={loadData}
                            availableUsers={allUsers}
                            availableLabels={labels}
                            availableStages={stages}
                        />
                    )}
                </>
            )}


            {/* MODAL LIGHTBOX / ZOOM DE IMAGEM */}
            {selectedImageZoom && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedImageZoom(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <img src={selectedImageZoom} alt="Visualização" className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border border-slate-700" />
                        <div className="flex items-center gap-3">
                            <a
                                href={selectedImageZoom}
                                target="_blank"
                                rel="noopener noreferrer"
                                download="imagem_whatsapp.jpg"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg transition"
                            >
                                📥 Baixar Imagem Original
                            </a>
                            <button
                                onClick={() => setSelectedImageZoom(null)}
                                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg transition"
                            >
                                ✕ Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showScheduleAct && selectedTicketId && (
                <HrScheduleActivityModal
                    open={showScheduleAct}
                    onClose={() => setShowScheduleAct(false)}
                    ticketId={selectedTicketId}
                    onCreated={() => {
                        setShowScheduleAct(false);
                        loadData();
                    }}
                />
            )}


            <HrAccessManager open={showAccessManager} onClose={() => setShowAccessManager(false)} />
        </div>
    );
}


