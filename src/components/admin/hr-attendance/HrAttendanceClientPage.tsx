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
import { HrScheduleMessageModal } from "./HrScheduleMessageModal";
import { HrScheduleActivityModal } from "./HrScheduleActivityModal";
import { HrAccessManager } from "./HrAccessManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
    currentUser: any;
    allUsers: any[];
}

export function HrAttendanceClientPage({ currentUser, allUsers }: Props) {
    // Visões principais: "chat" (WhatsApp Web Real) ou "kanban" (Pipeline WaSeller)
    const [mainView, setMainView] = useState<"chat" | "kanban" | "labels" | "history">("chat");

    const [stages, setStages] = useState<any[]>([]);
    const [tickets, setTickets] = useState<any[]>([]);
    const [labels, setLabels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtro por Etapa no Topo
    const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

    // Ticket Ativo Selecionado (Abre direto no painel direito da tela, sem modal!)
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [ticketDetail, setTicketDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Busca e Filtros da Barra Lateral
    const [searchQuery, setSearchQuery] = useState("");
    const [filterMode, setFilterMode] = useState<"all" | "unread">("all");

    // Abas do Painel Direito (Chat | Notas | Tarefas)
    const [chatRightTab, setChatRightTab] = useState<"chat" | "notes" | "activities">("chat");
    const [messageText, setMessageText] = useState("");
    const [sending, setSending] = useState(false);
    const [stamp, setStamp] = useState("");
    const [showStampInput, setShowStampInput] = useState(false);

    // Edição rápida de contato
    const [isEditingContact, setIsEditingContact] = useState(false);
    const [contactNameInput, setContactNameInput] = useState("");
    const [contactPhoneInput, setContactPhoneInput] = useState("");

    // Modais secundários
    const [showScheduleMsg, setShowScheduleMsg] = useState(false);
    const [showScheduleAct, setShowScheduleAct] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showAccessManager, setShowAccessManager] = useState(false);
    const [transferTargetUser, setTransferTargetUser] = useState("");

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

            // Selecionar o primeiro ticket se nenhum estiver aberto
            if (tcks.length > 0 && !selectedTicketId) {
                setSelectedTicketId(tcks[0].id);
            }
        } finally {
            setLoading(false);
        }
    }, [searchQuery]);

    // Polling sutil a cada 4s para sincronizar Z-API e atualizar lista
    useEffect(() => {
        loadData();
        const interval = setInterval(async () => {
            const tcks = await getHrTickets({ search: searchQuery });
            setTickets(tcks);
        }, 4000);
        return () => clearInterval(interval);
    }, [loadData, searchQuery]);

    // Carregar detalhes do ticket selecionado de forma instantânea
    const loadTicketDetail = useCallback(async (id: string) => {
        setLoadingDetail(true);
        try {
            const res = await getHrTicketDetail(id);
            if (res) {
                setTicketDetail(res);
                setContactNameInput(res.contactName);
                setContactPhoneInput(res.contactPhone);
                setStamp(res.attendantStamp || "");
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
        if (chatRightTab === "chat") {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [ticketDetail?.messages, chatRightTab]);

    // Enviar mensagem WhatsApp
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
                message: textToSend,
                stamp: stamp || undefined
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

    // Upload de arquivo / documento
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

    // Salvar carimbo
    const handleSaveStamp = async () => {
        if (!ticketDetail) return;
        await updateTicketStamp(ticketDetail.id, stamp);
        setShowStampInput(false);
        setTicketDetail((prev: any) => ({ ...prev, attendantStamp: stamp }));
    };

    // Assumir Atendimento
    const handleAssume = async () => {
        if (!ticketDetail) return;
        await assumeHrTicket(ticketDetail.id);
        loadTicketDetail(ticketDetail.id);
        loadData();
    };

    // Transferir Atendimento
    const handleTransfer = async () => {
        if (!ticketDetail || !transferTargetUser) return;
        await transferHrTicket(ticketDetail.id, transferTargetUser);
        setShowTransferModal(false);
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

    // Alternar Etiqueta no Ticket
    const handleToggleLabel = async (labelId: string) => {
        if (!ticketDetail) return;
        const hasLabel = ticketDetail.labels?.some((l: any) => l.id === labelId);
        await applyLabelToTicket(ticketDetail.id, labelId, !hasLabel);
        loadTicketDetail(ticketDetail.id);
        loadData();
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
            {/* BARRA SUPERIOR WASELLER (Pílulas de Etapas / Filtros) */}
            <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-2xs z-10 gap-3">
                {/* Pílulas de Etapas do Pipeline */}
                <div className="flex items-center gap-2 overflow-x-auto min-w-0 flex-1 py-1 no-scrollbar">
                    <div className="flex items-center gap-2 flex-shrink-0 mr-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                            W
                        </div>
                        <div>
                            <h1 className="font-extrabold text-sm text-slate-800 leading-none">WaAtendimento</h1>
                            <span className="text-[10px] text-emerald-600 font-bold whitespace-nowrap">WhatsApp RH CRM</span>
                        </div>
                    </div>

                    <button
                        onClick={() => setSelectedStageId(null)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition flex-shrink-0 whitespace-nowrap ${
                            selectedStageId === null
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
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
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition flex-shrink-0 border whitespace-nowrap ${
                                    isSelected
                                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
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

                {/* Alternador de Visões: WhatsApp Web Real (Chat) vs Kanban */}
                <div className="flex items-center gap-2 flex-shrink-0">
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
                            className="h-8 text-xs gap-1 border-slate-300 text-slate-700 font-bold"
                            onClick={() => setShowAccessManager(true)}
                        >
                            <Lock className="w-3.5 h-3.5" /> Acessos
                        </Button>
                    )}
                </div>
            </div>

            {/* VISÃO 1: WHATSAPP WEB REAL (TELA INTEIRA FIXA SEM MODAL POR CIMA!) */}
            {mainView === "chat" && (
                <div className="flex flex-1 overflow-hidden">
                    {/* COLUNA ESQUERDA: LISTA DE CONVERSAS DO WHATSAPP */}
                    <div className="w-96 border-r border-slate-200 bg-white flex flex-col overflow-hidden flex-shrink-0">
                        {/* Search & Tabs de Filtro */}
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

                        {/* Lista Scrollável de Contatos / Grupos */}
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                            {loading ? (
                                <div className="p-6 text-center text-xs text-slate-400">Carregando conversas...</div>
                            ) : filteredTickets.length === 0 ? (
                                <div className="p-6 text-center text-xs text-slate-400">Nenhuma conversa encontrada.</div>
                            ) : (
                                filteredTickets.map((t) => {
                                    const isSelected = selectedTicketId === t.id;
                                    const lastMsg = t.messages?.[0];

                                    return (
                                        <div
                                            key={t.id}
                                            onClick={() => setSelectedTicketId(t.id)}
                                            className={`p-3 flex items-center gap-3 cursor-pointer transition relative ${
                                                isSelected ? "bg-slate-100 border-l-4 border-l-emerald-500" : "hover:bg-slate-50"
                                            }`}
                                        >
                                            <div className="relative flex-shrink-0">
                                                {t.contactPhotoUrl ? (
                                                    <img
                                                        src={t.contactPhotoUrl}
                                                        alt=""
                                                        className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-2xs"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-full bg-slate-700 text-white font-bold text-sm flex items-center justify-center shadow-2xs">
                                                        {t.contactName?.charAt(0).toUpperCase() || "?"}
                                                    </div>
                                                )}

                                                {t.unreadCount > 0 && (
                                                    <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 border-2 border-white shadow-2xs">
                                                        {t.unreadCount}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="overflow-hidden flex-1">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <h4 className="text-xs font-bold text-slate-900 truncate">{t.contactName}</h4>
                                                    <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
                                                        {new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                <p className="text-[11px] text-slate-500 truncate leading-snug">
                                                    {lastMsg ? (
                                                        <span>{lastMsg.senderType === "ATTENDANT" ? "✓ " : ""}{lastMsg.content}</span>
                                                    ) : (
                                                        <span className="italic text-slate-400">Atendimento iniciado</span>
                                                    )}
                                                </p>

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

                    {/* PAINEL DIREITO: CONVERSA DO WHATSAPP ABERTA DIRETO NA TELA */}
                    <div className="flex-1 flex flex-col bg-[#efeae2] relative overflow-hidden">
                        {!ticketDetail ? (
                            <div className="flex-1 flex items-center justify-center text-xs text-slate-400 bg-slate-100">
                                Selecione uma conversa ao lado para visualizar o chat.
                            </div>
                        ) : (
                            <div className="flex flex-1 flex-col h-full overflow-hidden">
                                {/* Header do Chat estilo WhatsApp Web */}
                                <div className="h-16 bg-[#f0f2f5] border-b border-slate-300 px-4 flex items-center justify-between z-10 shadow-2xs">
                                    <div className="flex items-center gap-3">
                                        {ticketDetail.contactPhotoUrl ? (
                                            <img src={ticketDetail.contactPhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover border" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-slate-700 text-white font-bold text-sm flex items-center justify-center">
                                                {ticketDetail.contactName?.charAt(0).toUpperCase() || "?"}
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

                                    {/* Controles de Ação do RH */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1">
                                            <button
                                                onClick={() => setChatRightTab("chat")}
                                                className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${chatRightTab === "chat" ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                                            >
                                                💬 Chat ({ticketDetail.messages?.length || 0})
                                            </button>
                                            <button
                                                onClick={() => setChatRightTab("notes")}
                                                className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${chatRightTab === "notes" ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                                            >
                                                📝 Notas ({ticketDetail.notes?.length || 0})
                                            </button>
                                        </div>

                                        {/* Trocar Etapa no Topo */}
                                        <select
                                            value={ticketDetail.stageId}
                                            onChange={(e) => handleChangeStage(e.target.value)}
                                            className="text-xs font-bold p-1.5 rounded-lg border bg-white text-slate-800"
                                        >
                                            {stages.map((st: any) => (
                                                <option key={st.id} value={st.id}>{st.name}</option>
                                            ))}
                                        </select>

                                        {ticketDetail.assignee ? (
                                            <span className="text-xs text-slate-700 font-bold bg-white px-2.5 py-1 rounded-lg border">
                                                👤 {ticketDetail.assignee.name}
                                            </span>
                                        ) : (
                                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-bold" onClick={handleAssume}>
                                                Assumir
                                            </Button>
                                        )}

                                        <Button variant="ghost" size="sm" className="h-8 text-xs text-red-600 hover:bg-red-50" onClick={handleCloseTicket} title="Encerrar Atendimento">
                                            Encerrar
                                        </Button>
                                    </div>
                                </div>

                                {/* ABA CHAT (Papel de parede Doodle + Balões Verdes) */}
                                {chatRightTab === "chat" && (
                                    <div className="flex-1 flex flex-col overflow-hidden bg-[#efeae2]">
                                        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                                            {ticketDetail.messages?.map((msg: any) => {
                                                const isAttendant = msg.senderType === "ATTENDANT";

                                                return (
                                                    <div key={msg.id} className={`flex ${isAttendant ? "justify-end" : "justify-start"}`}>
                                                        <div className={`max-w-[70%] p-2.5 rounded-lg shadow-2xs text-xs ${isAttendant ? "bg-[#d9fdd3] text-slate-900 rounded-tr-none" : "bg-white text-slate-900 rounded-tl-none"}`}>
                                                            {msg.mediaUrl && msg.messageType === "IMAGE" && (
                                                                <img src={msg.mediaUrl} alt="" className="max-w-xs rounded-lg mb-2 max-h-60 object-cover" />
                                                            )}
                                                            {msg.mediaUrl && msg.messageType === "DOCUMENT" && (
                                                                <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-black/5 rounded-lg mb-2">
                                                                    📄 <span className="font-semibold underline text-emerald-800">{msg.mediaFileName || "Documento"}</span>
                                                                </a>
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

                                        {/* Barra de Digitação Inferior */}
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

                                {/* ABA NOTAS */}
                                {chatRightTab === "notes" && (
                                    <div className="flex-1 p-6 bg-slate-100 overflow-y-auto space-y-4">
                                        <div className="bg-white p-4 rounded-xl border shadow-2xs space-y-3">
                                            <h4 className="text-xs font-bold text-slate-800">Nova Anotação Interna</h4>
                                            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Anotação interna do RH..." className="text-xs h-20" />
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

            {/* VISÃO 2: PIPELINE KANBAN (Abre ao clicar na aba Pipeline Kanban no topo) */}
            {mainView === "kanban" && (
                <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 overflow-x-auto p-4 flex gap-4 bg-slate-100 items-start min-h-[calc(100vh-140px)]">
                        {stages.map((stage) => {
                            const stageTickets = tickets.filter(t => t.stageId === stage.id);
                            return (
                                <div key={stage.id} className="w-72 flex-shrink-0 bg-white rounded-2xl p-3 border border-slate-200 shadow-xs">
                                    <div className="flex items-center justify-between mb-3 border-b pb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                                            <h3 className="font-extrabold text-xs text-slate-800 uppercase">{stage.name}</h3>
                                        </div>
                                        <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border">
                                            {stageTickets.length}
                                        </span>
                                    </div>
                                    <div className="space-y-2 max-h-[75vh] overflow-y-auto">
                                        {stageTickets.map((t) => (
                                            <div
                                                key={t.id}
                                                onClick={() => { setSelectedTicketId(t.id); setMainView("chat"); }}
                                                className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-xl border border-slate-200 cursor-pointer transition flex items-center gap-2.5"
                                            >
                                                {t.contactPhotoUrl ? (
                                                    <img src={t.contactPhotoUrl} alt="" className="w-9 h-9 rounded-full object-cover border" />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full bg-slate-700 text-white font-bold text-xs flex items-center justify-center">
                                                        {t.contactName?.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="overflow-hidden">
                                                    <div className="text-xs font-bold text-slate-800 truncate">{t.contactName}</div>
                                                    <div className="text-[11px] text-slate-500 truncate">{t.title}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <HrAccessManager open={showAccessManager} onClose={() => setShowAccessManager(false)} />
        </div>
    );
}
