"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Search, Paperclip, Send, CheckCheck, Clock, ShieldCheck,
    ArrowRightLeft, UserCheck, Lock, RefreshCw, X, Plus, Calendar, StickyNote, Filter
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
    const [stages, setStages] = useState<any[]>([]);
    const [tickets, setTickets] = useState<any[]>([]);
    const [labels, setLabels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    // Etapa selecionada no filtro de pílulas (null = Todas)
    const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

    // Ticket Selecionado para Chat Aberto
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [ticketDetail, setTicketDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Filtros e Busca
    const [searchQuery, setSearchQuery] = useState("");
    const [filterMode, setFilterMode] = useState<"all" | "unread">("all");

    // Chat State
    const [activeTab, setActiveTab] = useState<"chat" | "notes" | "activities">("chat");
    const [messageText, setMessageText] = useState("");
    const [sending, setSending] = useState(false);
    const [stamp, setStamp] = useState("");
    const [showStampInput, setShowStampInput] = useState(false);

    // Submodais
    const [showScheduleMsg, setShowScheduleMsg] = useState(false);
    const [showScheduleAct, setShowScheduleAct] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showAccessManager, setShowAccessManager] = useState(false);
    const [transferTargetUser, setTransferTargetUser] = useState("");

    // Anotação
    const [noteText, setNoteText] = useState("");

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

            // Selecionar o primeiro ticket automaticamente se nenhum estiver aberto
            if (tcks.length > 0 && !selectedTicketId) {
                setSelectedTicketId(tcks[0].id);
            }
        } finally {
            setLoading(false);
        }
    }, [searchQuery, selectedTicketId]);

    // Polling a cada 3s para sincronizar Z-API e atualizar lista
    useEffect(() => {
        loadData();
        const interval = setInterval(async () => {
            await syncZapiChats();
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

    // Polling a cada 3s para mensagens da conversa aberta
    useEffect(() => {
        if (!selectedTicketId) return;
        const interval = setInterval(async () => {
            const lastMsg = ticketDetail?.messages?.[ticketDetail.messages.length - 1];
            const since = lastMsg?.createdAt;
            const newMsgs = await getHrTicketMessages(selectedTicketId, since ? new Date(since).toISOString() : undefined);
            if (newMsgs.length > 0) {
                setTicketDetail((prev: any) => {
                    if (!prev) return prev;
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

    // Scroll suave no chat
    useEffect(() => {
        if (activeTab === "chat") {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [ticketDetail?.messages, activeTab]);

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

    // Filtrar tickets por pílula e por filtro de não lidas
    const filteredTickets = tickets.filter(t => {
        if (selectedStageId && t.stageId !== selectedStageId) return false;
        if (filterMode === "unread" && t.unreadCount === 0) return false;
        return true;
    });

    // Adicionar nova etapa
    const handleAddStage = async () => {
        const name = prompt("Nome da nova etapa do pipeline:");
        if (!name?.trim()) return;
        const newStages = [
            ...stages,
            { name: name.trim(), color: "#3b82f6", order: stages.length, isDefault: false }
        ];
        await saveHrPipelineStages(newStages);
        loadData();
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-100 font-sans">
            {/* TOP BAR: Pílulas de Etapas / Filtros estilo WaSeller */}
            <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-xs z-10 gap-3">
                <div className="flex items-center gap-2 overflow-x-auto min-w-0 flex-1 py-1 no-scrollbar">
                    {/* Botão "Todas" */}
                    <button
                        onClick={() => setSelectedStageId(null)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition flex-shrink-0 ${
                            selectedStageId === null
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                    >
                        Todas ({tickets.length})
                    </button>

                    {/* Pílulas de Etapas do Pipeline (INBOX, LEAD DE SERVIÇOS, ATENDIMENTO, etc) */}
                    {stages.map((stg) => {
                        const count = tickets.filter(t => t.stageId === stg.id).length;
                        const isSelected = selectedStageId === stg.id;

                        return (
                            <button
                                key={stg.id}
                                onClick={() => setSelectedStageId(stg.id)}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition flex-shrink-0 border ${
                                    isSelected
                                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                }`}
                            >
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stg.color }} />
                                <span>{stg.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${isSelected ? "bg-slate-700 text-white" : "bg-white text-slate-800 border"}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}

                    <button
                        onClick={handleAddStage}
                        className="w-6 h-6 rounded-full bg-slate-100 hover:bg-emerald-100 text-emerald-700 border border-slate-200 flex items-center justify-center text-xs font-bold flex-shrink-0"
                        title="Adicionar Etapa ao Pipeline"
                    >
                        +
                    </button>
                </div>

                {/* Direita: Acessos Admin */}
                {currentUser?.role === "ADMIN" && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 border-slate-300 text-slate-700 flex-shrink-0"
                        onClick={() => setShowAccessManager(true)}
                    >
                        <Lock className="w-3 h-3" /> Acessos
                    </Button>
                )}
            </div>

            {/* CORPO DA TELA: ESTRUTURA WHATSAPP WEB REAL (Esq: Lista de Conversas | Dir: Chat Aberto) */}
            <div className="flex flex-1 overflow-hidden">
                {/* PAINEL ESQUERDO: Lista de Conversas (WhatsApp Sidebar) */}
                <div className="w-96 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
                    {/* Header do WhatsApp (Ícones + Busca + Filtros Pílulas) */}
                    <div className="p-3 border-b border-slate-100 bg-slate-50/70 space-y-2">
                        <div className="flex items-center justify-between">
                            <h2 className="font-extrabold text-lg text-slate-900 tracking-tight">WhatsApp</h2>
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                Ao Vivo
                            </span>
                        </div>

                        {/* Campo de Busca */}
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                            <Input
                                placeholder="Pesquisar ou começar uma nova conversa"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 text-xs h-9 bg-white border-slate-200 rounded-xl"
                            />
                        </div>

                        {/* Filtros de Pílulas (Tudo | Não lidas) */}
                        <div className="flex items-center gap-1.5 pt-1">
                            <button
                                onClick={() => setFilterMode("all")}
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition ${filterMode === "all" ? "bg-slate-800 text-white" : "bg-slate-200/70 text-slate-600 hover:bg-slate-300"}`}
                            >
                                Tudo
                            </button>
                            <button
                                onClick={() => setFilterMode("unread")}
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition ${filterMode === "unread" ? "bg-slate-800 text-white" : "bg-slate-200/70 text-slate-600 hover:bg-slate-300"}`}
                            >
                                Não lidas ({tickets.filter(t => t.unreadCount > 0).length})
                            </button>
                        </div>
                    </div>

                    {/* Lista Scrollável de Conversas (Com foto real Z-API, nome, preview e horário) */}
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
                                            isSelected ? "bg-slate-100" : "hover:bg-slate-50"
                                        }`}
                                    >
                                        {/* Foto de Perfil Grande */}
                                        <div className="relative flex-shrink-0">
                                            {t.contactPhotoUrl ? (
                                                <img
                                                    src={t.contactPhotoUrl}
                                                    alt={t.contactName}
                                                    className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-xs"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-slate-700 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                                                    {t.contactName?.charAt(0).toUpperCase() || "?"}
                                                </div>
                                            )}

                                            {t.unreadCount > 0 && (
                                                <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 border-2 border-white shadow-xs">
                                                    {t.unreadCount}
                                                </span>
                                            )}
                                        </div>

                                        {/* Detalhes da Conversa */}
                                        <div className="overflow-hidden flex-1">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <h4 className="text-xs font-bold text-slate-800 truncate">{t.contactName}</h4>
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

                                            {/* Badge da Etapa */}
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

                {/* PAINEL DIREITO: Chat WhatsApp Web Real (Aberto Fixo na Tela) */}
                <div className="flex-1 flex flex-col bg-[#efeae2] relative overflow-hidden">
                    {loadingDetail || !ticketDetail ? (
                        <div className="flex-1 flex items-center justify-center text-xs text-slate-400 bg-slate-100">
                            Selecione uma conversa ao lado para visualizar o chat.
                        </div>
                    ) : (
                        <div className="flex flex-1 flex-col h-full overflow-hidden">
                            {/* WhatsApp Header Bar Fixo */}
                            <div className="h-16 bg-[#f0f2f5] border-b border-slate-300 px-4 flex items-center justify-between z-10 shadow-xs">
                                <div className="flex items-center gap-3">
                                    {ticketDetail.contactPhotoUrl ? (
                                        <img src={ticketDetail.contactPhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover border" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-slate-700 text-white font-bold text-sm flex items-center justify-center">
                                            {ticketDetail.contactName?.charAt(0).toUpperCase() || "?"}
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800 leading-tight">{ticketDetail.contactName}</h3>
                                        <span className="text-[11px] text-slate-500 font-mono">{ticketDetail.contactPhone}</span>
                                    </div>
                                </div>

                                {/* Controles do RH e Abas */}
                                <div className="flex items-center gap-2">
                                    <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1">
                                        <button
                                            onClick={() => setActiveTab("chat")}
                                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${activeTab === "chat" ? "bg-white text-emerald-600 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                                        >
                                            💬 Chat ({ticketDetail.messages?.length || 0})
                                        </button>
                                        <button
                                            onClick={() => setActiveTab("notes")}
                                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${activeTab === "notes" ? "bg-white text-emerald-600 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                                        >
                                            📝 Notas ({ticketDetail.notes?.length || 0})
                                        </button>
                                    </div>

                                    {ticketDetail.assignee ? (
                                        <span className="text-xs text-slate-600 font-semibold bg-white px-2.5 py-1 rounded-lg border">
                                            👤 {ticketDetail.assignee.name}
                                        </span>
                                    ) : (
                                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8" onClick={async () => { await assumeHrTicket(ticketDetail.id); loadTicketDetail(ticketDetail.id); }}>
                                            Assumir
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* ABA: CHAT WHATSAPP WEB REAL */}
                            {activeTab === "chat" && (
                                <div className="flex-1 flex flex-col overflow-hidden bg-[#efeae2]">
                                    {/* Feed de Mensagens (Papel de parede Doodle) */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                                        {ticketDetail.messages?.map((msg: any) => {
                                            const isAttendant = msg.senderType === "ATTENDANT";

                                            return (
                                                <div key={msg.id} className={`flex ${isAttendant ? "justify-end" : "justify-start"}`}>
                                                    <div className={`max-w-[70%] p-2.5 rounded-lg shadow-xs text-xs ${isAttendant ? "bg-[#d9fdd3] text-slate-900 rounded-tr-none" : "bg-white text-slate-900 rounded-tl-none"}`}>
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

                                    {/* Barra de Envio Inferior */}
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
                                            className="flex-1 text-xs resize-none h-10 min-h-[40px] bg-white border-none rounded-xl px-4 py-2.5 shadow-xs"
                                        />
                                        <Button onClick={handleSendMessage} disabled={sending || !messageText.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 w-10 p-0 rounded-full flex items-center justify-center">
                                            <Send className="w-4 h-4 ml-0.5" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* ABA: ANOTAÇÕES */}
                            {activeTab === "notes" && (
                                <div className="flex-1 p-6 bg-slate-100 overflow-y-auto space-y-4">
                                    <div className="bg-white p-4 rounded-xl border shadow-xs space-y-3">
                                        <h4 className="text-xs font-bold text-slate-800">Nova Anotação Interna</h4>
                                        <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Anotação interna..." className="text-xs h-20" />
                                        <div className="flex justify-end">
                                            <Button size="sm" onClick={async () => { if (noteText.trim()) { await addHrTicketNote(ticketDetail.id, noteText.trim()); setNoteText(""); loadTicketDetail(ticketDetail.id); } }} className="bg-emerald-600 text-xs">Salvar Nota</Button>
                                        </div>
                                    </div>
                                    {ticketDetail.notes?.map((n: any) => (
                                        <div key={n.id} className="bg-white p-3 rounded-xl border shadow-xs">
                                            <div className="text-xs font-bold">{n.author?.name}</div>
                                            <p className="text-xs text-slate-600">{n.content}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <HrAccessManager open={showAccessManager} onClose={() => setShowAccessManager(false)} />
        </div>
    );
}
