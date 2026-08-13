"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Search, Paperclip, Send, CheckCheck, Clock, ShieldCheck,
    ArrowRightLeft, UserCheck, Lock, RefreshCw, X, Plus, Calendar, StickyNote, Filter,
    Phone, Video, MoreVertical, MessageSquare, DollarSign, ClipboardList, Smile, Mic
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

function formatDynamicDateLabel(dateInput: any) {
    if (!dateInput) return "HOJE";
    const d = new Date(dateInput);
    const now = new Date();

    const isToday = d.getDate() === now.getDate() &&
                    d.getMonth() === now.getMonth() &&
                    d.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.getDate() === yesterday.getDate() &&
                        d.getMonth() === yesterday.getMonth() &&
                        d.getFullYear() === yesterday.getFullYear();

    if (isToday) return "HOJE";
    if (isYesterday) return "ONTEM";

    const daysOfWeek = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) {
        return daysOfWeek[d.getDay()].toUpperCase();
    }

    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

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
    const [modalInitialTab, setModalInitialTab] = useState<"chat" | "notes" | "activities" | "value">("chat");
    const [ticketDetail, setTicketDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const [selectedImageZoom, setSelectedImageZoom] = useState<string | null>(null);
    const [showScheduleAct, setShowScheduleAct] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importJsonText, setImportJsonText] = useState("");
    const [importing, setImporting] = useState(false);

    const handleProcessImportJson = async () => {
        if (!importJsonText.trim()) return;
        setImporting(true);
        try {
            let payload: any = null;
            const text = importJsonText.trim();

            // 1. Tentar parsear JSON direto
            try {
                payload = JSON.parse(text);
            } catch (e) {
                // 2. Fallback: Extrair mensagens de texto colado
                const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
                const extractedMsgs: any[] = [];
                for (const line of lines) {
                    if (line.startsWith("const") || line.startsWith("function") || line.startsWith("alert") || line.startsWith("copy")) continue;
                    extractedMsgs.push({
                        senderType: line.toLowerCase().startsWith("você:") || line.toLowerCase().startsWith("atendente:") ? "ATTENDANT" : "EMPLOYEE",
                        senderName: ticketDetail?.contactName || "Contato",
                        content: line,
                        createdAt: new Date().toISOString()
                    });
                }
                if (extractedMsgs.length > 0) {
                    payload = {
                        phone: ticketDetail?.contactPhone || "5541999999999",
                        contactName: ticketDetail?.contactName || "Contato WhatsApp",
                        messages: extractedMsgs
                    };
                }
            }

            // Se o usuário colou o próprio código JS
            if (text.includes("exportWhatsAppChat") || text.includes("function") || text.includes("copy(finalJSON)")) {
                alert("⚠️ Você colou o CÓDIGO JavaScript!\n\nPasso a passo simples:\n1. Cole esse código no Console (F12) do WhatsApp Web (web.whatsapp.com).\n2. Aperte Enter no WhatsApp Web.\n3. O WhatsApp Web vai copiar as mensagens e exibir um OK.\n4. Depois volte aqui no sistema, dê Ctrl+V para colar o resultado e clique em Salvar!");
                return;
            }

            if (!payload || !payload.messages) {
                alert("❌ Cole o resultado da cópia (JSON) ou as linhas da conversa para salvar.");
                return;
            }

            const res = await fetch("/api/whatsapp/import-history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert(`✅ SUCESSO! ${data.totalInserted} mensagens salvas no banco de dados!`);
                setShowImportModal(false);
                setImportJsonText("");
                loadData();
                if (selectedTicketId) loadTicketDetail(selectedTicketId);
            } else {
                alert("❌ Erro ao importar: " + (data.error || "Formato inválido."));
            }
        } catch (e: any) {
            alert("❌ Erro ao processar o texto: " + e.message);
        } finally {
            setImporting(false);
        }
    };

    // Busca e Filtros
    const [searchQuery, setSearchQuery] = useState("");
    const [filterMode, setFilterMode] = useState<"all" | "unread" | "groups">("all");

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

    // Polling inteligente a cada 6s
    useEffect(() => {
        loadData();
        const interval = setInterval(async () => {
            if (document.hidden) return;
            const tcks = await getHrTickets({ search: searchQuery });
            setTickets(tcks);
        }, 6000);
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
            const reader = new FileReader();
            reader.onload = async () => {
                const dataUrl = reader.result as string;
                const res = await sendHrWhatsAppFile({
                    ticketId: ticketDetail.id,
                    phone: ticketDetail.contactPhone,
                    fileUrl: dataUrl,
                    fileName: file.name,
                    mimeType: file.type || "application/pdf"
                });
                if (res.success && res.message) {
                    setTicketDetail((prev: any) => ({
                        ...prev,
                        messages: [...(prev?.messages || []), res.message]
                    }));
                }
                loadData();
            };
            reader.readAsDataURL(file);
        } finally {
            setSending(false);
        }
    };

    const handleAssume = async () => {
        if (!selectedTicketId) return;
        await assumeHrTicket(selectedTicketId);
        loadData();
        loadTicketDetail(selectedTicketId);
    };

    const handleCloseTicket = async () => {
        if (!selectedTicketId) return;
        await closeHrTicket(selectedTicketId);
        loadData();
        loadTicketDetail(selectedTicketId);
    };

    const handleChangeStage = async (stageId: string) => {
        if (!selectedTicketId) return;
        await updateHrTicketStage(selectedTicketId, stageId);
        loadData();
        loadTicketDetail(selectedTicketId);
    };

    const handleAddNote = async () => {
        if (!selectedTicketId || !noteText.trim()) return;
        await addHrTicketNote(selectedTicketId, noteText.trim());
        setNoteText("");
        loadTicketDetail(selectedTicketId);
    };

    const handleSaveContactEdit = async () => {
        if (!selectedTicketId) return;
        await updateContactInfo(selectedTicketId, {
            name: contactNameInput.trim(),
            phone: contactPhoneInput.trim()
        });
        setIsEditingContact(false);
        loadData();
        loadTicketDetail(selectedTicketId);
    };

    // Filtragem de Tickets na Lista Esquerda
    const filteredTickets = tickets.filter(t => {
        if (selectedStageId && t.stageId !== selectedStageId) return false;
        if (filterMode === "unread" && t.unreadCount === 0) return false;
        if (filterMode === "groups") {
            const isGroup = t.contactPhone?.includes("-group") || t.contactName?.toLowerCase().includes("grupo") || t.contactName?.toLowerCase().includes("rh -");
            if (!isGroup) return false;
        }
        return true;
    });

    return (
        <div className="flex flex-col h-screen bg-[#f0f2f5] overflow-hidden select-none">
            {/* TOP BAR SUPERIOR - Estilo WaAtendimento CRM */}
            <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-2xs z-20 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-xs shadow-xs">
                        WA
                    </div>
                    <div>
                        <h1 className="font-black text-xs text-slate-900 leading-none flex items-center gap-1.5">
                            WaAtendimento
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Z-API Conectado ao Vivo" />
                        </h1>
                        <span className="text-[9px] text-emerald-600 font-bold tracking-wider uppercase">WhatsApp RH CRM</span>
                    </div>
                </div>

                {/* Alternador de Visão + Acessos */}
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

                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 border-emerald-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-extrabold"
                        onClick={() => setShowImportModal(true)}
                    >
                        📥 Importar Histórico
                    </Button>

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

            {/* TOP BAR - LINHA 2: Carrossel de Etapas Kanban do CRM (Foto 01) */}
            {mainView === "chat" && (
                <div className="bg-[#f0f2f5] border-b border-slate-200/80 px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-2xs z-10">
                    <button
                        onClick={() => setSelectedStageId(null)}
                        className={`px-3 py-1 rounded-full text-xs font-extrabold transition flex-shrink-0 whitespace-nowrap flex items-center gap-1.5 border ${
                            selectedStageId === null
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                    >
                        <span>Todas</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${selectedStageId === null ? "bg-emerald-800 text-white" : "bg-slate-200 text-slate-700"}`}>
                            {tickets.length}
                        </span>
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
            )}

            {/* VISÃO 1: CHAT WHATSAPP WEB REAL (Conexão ao vivo) */}
            {mainView === "chat" && (
                <div className="flex flex-1 overflow-hidden">
                    {/* Painel Esquerdo: Lista de Conversas do WhatsApp (Pixel-Perfect WhatsApp Web) */}
                    <div className="w-96 border-r border-slate-200 bg-white flex flex-col overflow-hidden flex-shrink-0">
                        {/* Header com Busca e Filtros (Foto 01) */}
                        <div className="p-3 border-b border-slate-200 bg-[#f0f2f5] space-y-2">
                            <div className="flex items-center justify-between mb-1">
                                <h2 className="text-base font-black text-slate-900 tracking-tight">WhatsApp</h2>
                                <div className="flex items-center gap-2 text-slate-500">
                                    <button className="hover:text-slate-800 p-1" title="Nova mensagem"><Plus className="w-4 h-4" /></button>
                                    <button className="hover:text-slate-800 p-1" title="Mais opções"><MoreVertical className="w-4 h-4" /></button>
                                </div>
                            </div>

                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                <Input
                                    placeholder="Pesquisar ou começar uma nova conversa"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 text-xs h-9 bg-white border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>

                            <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto no-scrollbar">
                                <button
                                    onClick={() => setFilterMode("all")}
                                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition flex-shrink-0 ${filterMode === "all" ? "bg-slate-900 text-white" : "bg-slate-200/80 text-slate-600 hover:bg-slate-300"}`}
                                >
                                    Tudo
                                </button>
                                <button
                                    onClick={() => setFilterMode("unread")}
                                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition flex-shrink-0 ${filterMode === "unread" ? "bg-slate-900 text-white" : "bg-slate-200/80 text-slate-600 hover:bg-slate-300"}`}
                                >
                                    Não lidas ({tickets.filter(t => t.unreadCount > 0).length})
                                </button>
                                <button
                                    onClick={() => setFilterMode("groups")}
                                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition flex-shrink-0 ${filterMode === "groups" ? "bg-slate-900 text-white" : "bg-slate-200/80 text-slate-600 hover:bg-slate-300"}`}
                                >
                                    Grupos ({tickets.filter(t => t.contactPhone?.includes("-group") || t.contactName?.toLowerCase().includes("grupo") || t.contactName?.toLowerCase().includes("rh -")).length})
                                </button>
                            </div>
                        </div>

                        {/* Lista de Contatos WhatsApp Web (Foto 01) */}
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0">
                            {loading ? (
                                <div className="p-6 text-center text-xs text-slate-400">Carregando conversas...</div>
                            ) : filteredTickets.length === 0 ? (
                                <div className="p-6 text-center text-xs text-slate-400">Nenhuma conversa encontrada.</div>
                            ) : (
                                filteredTickets.map((t) => {
                                    const isSelected = selectedTicketId === t.id;
                                    const lastMsg = t.messages?.[t.messages.length - 1];
                                    const isGroup = t.contactPhone?.includes("-group") || t.contactName?.toLowerCase().includes("grupo") || t.contactName?.toLowerCase().includes("rh -");

                                    return (
                                        <div
                                            key={t.id}
                                            onClick={() => setSelectedTicketId(t.id)}
                                            className={`p-3 flex items-center gap-3 cursor-pointer transition relative ${
                                                isSelected ? "bg-[#f0f2f5] border-l-4 border-l-emerald-500" : "hover:bg-slate-50"
                                            }`}
                                        >
                                            <div className="relative flex-shrink-0">
                                                {t.contactPhotoUrl && t.contactPhotoUrl !== "null" ? (
                                                    <img
                                                        src={t.contactPhotoUrl}
                                                        alt=""
                                                        className="w-11 h-11 rounded-full object-cover border border-slate-200 shadow-2xs"
                                                    />
                                                ) : isGroup ? (
                                                    <div className="w-11 h-11 rounded-full bg-amber-600 text-white font-bold text-base flex items-center justify-center shadow-2xs">
                                                        👥
                                                    </div>
                                                ) : (
                                                    <div className="w-11 h-11 rounded-full bg-emerald-700 text-white font-bold text-sm flex items-center justify-center shadow-2xs">
                                                        {t.contactName?.charAt(0).toUpperCase() || "?"}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="overflow-hidden flex-1">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <h4 className="text-xs font-black text-slate-900 truncate">{t.contactName}</h4>
                                                    <span className={`text-[10px] font-mono flex-shrink-0 ${t.unreadCount > 0 ? "text-emerald-600 font-extrabold" : "text-slate-400"}`}>
                                                        {new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between gap-1">
                                                    <p className="text-[11px] text-slate-500 truncate leading-snug flex-1">
                                                        {lastMsg ? (
                                                            <span>{lastMsg.senderType === "ATTENDANT" ? "✓ Você: " : ""}{lastMsg.content}</span>
                                                        ) : (
                                                            <span className="italic text-slate-400">Atendimento iniciado</span>
                                                        )}
                                                    </p>

                                                    {/* Bolinha Verde do WhatsApp Web com a Quantidade de Não Lidas */}
                                                    {t.unreadCount > 0 && (
                                                        <span className="bg-[#25d366] text-white text-[10px] font-extrabold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 flex-shrink-0 shadow-2xs">
                                                            {t.unreadCount}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Painel Direito: Chat WhatsApp Web Real (Foto 01) */}
                    <div className="flex-1 flex flex-col bg-[#efeae2] relative overflow-hidden">
                        {!ticketDetail ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-xs text-slate-400 bg-[#f0f2f5] p-6 text-center">
                                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-black text-xl mb-3">
                                    💬
                                </div>
                                <h3 className="text-base font-bold text-slate-700 mb-1">WaAtendimento — WhatsApp Web</h3>
                                <p className="text-xs text-slate-500 max-w-sm">Selecione uma conversa na lista à esquerda para visualizar o histórico de mensagens, ouvir áudios e interagir.</p>
                            </div>
                        ) : (
                            <div className="flex flex-1 flex-col h-full overflow-hidden">
                                {/* Header da Conversa (Foto 01 Limpo e Elegante) */}
                                <div className="h-16 bg-[#f0f2f5] border-b border-slate-300 px-4 flex items-center justify-between z-10 shadow-2xs gap-3">
                                    <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                        {ticketDetail.contactPhotoUrl && ticketDetail.contactPhotoUrl !== "null" ? (
                                            <img src={ticketDetail.contactPhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover border flex-shrink-0" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                                                {ticketDetail.contactName?.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="overflow-hidden min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <h3 className="text-xs font-black text-slate-900 truncate max-w-[220px] leading-tight" title={ticketDetail.contactName}>
                                                    {ticketDetail.contactName}
                                                </h3>
                                                <button onClick={() => setIsEditingContact(true)} className="text-slate-400 hover:text-slate-600 text-xs flex-shrink-0" title="Editar nome">
                                                    ✏️
                                                </button>
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-mono block truncate">{ticketDetail.contactPhone}</span>
                                        </div>
                                    </div>

                                    {/* Controles de Ação do RH no Chat (Foto 01) */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <div className="flex bg-slate-200/80 p-0.5 rounded-lg flex-shrink-0">
                                            <button
                                                onClick={() => setChatRightTab("chat")}
                                                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${chatRightTab === "chat" ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                                            >
                                                💬 Chat ({ticketDetail.messages?.length || 0})
                                            </button>
                                            <button
                                                onClick={() => setChatRightTab("notes")}
                                                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${chatRightTab === "notes" ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                                            >
                                                📝 Notas ({ticketDetail.notes?.length || 0})
                                            </button>
                                        </div>

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs font-bold gap-1 bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 flex-shrink-0 px-2.5"
                                            onClick={() => setShowScheduleAct(true)}
                                        >
                                            📅 Agendar
                                        </Button>

                                        {/* Dropdown de Etapa do Pipeline */}
                                        <select
                                            value={ticketDetail.stageId}
                                            onChange={(e) => handleChangeStage(e.target.value)}
                                            className="bg-white border border-slate-300 text-slate-800 font-black text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-emerald-500 shadow-2xs flex-shrink-0"
                                        >
                                            {stages.map((stg) => (
                                                <option key={stg.id} value={stg.id}>{stg.name}</option>
                                            ))}
                                        </select>

                                        {!ticketDetail.assignee && (
                                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 font-bold flex-shrink-0 px-2.5" onClick={handleAssume}>
                                                Assumir
                                            </Button>
                                        )}

                                        <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600 hover:bg-red-50 font-bold flex-shrink-0 px-2" onClick={handleCloseTicket}>
                                            Encerrar
                                        </Button>
                                    </div>
                                </div>

                                {/* Área de Mensagens do Chat com Papel de Parede Oficial (Foto 01) */}
                                {chatRightTab === "chat" && (
                                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#efeae2] relative">
                                        <div
                                            className="absolute inset-0 bg-[#efeae2] bg-repeat opacity-95 pointer-events-none z-0"
                                            style={{ backgroundImage: `url('/whatsapp-bg-official.png')`, backgroundSize: '500px 380px' }}
                                        />

                                        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 relative z-10 min-h-0">
                                            {ticketDetail.messages?.map((msg: any, idx: number) => {
                                                const isAttendant = msg.senderType === "ATTENDANT" || msg.fromMe === true;
                                                const isGroupTicket = ticketDetail.contactPhone?.includes("-group") || ticketDetail.contactPhone?.length > 13 || ticketDetail.title?.toLowerCase().includes("grupo") || ticketDetail.title?.includes("Taxas") || ticketDetail.title?.includes("Mesa") || ticketDetail.title?.includes("RH - ATESTADO");
                                                const showSenderHeader = isGroupTicket && !isAttendant && msg.senderName;

                                                const currentDateStr = new Date(msg.createdAt).toLocaleDateString("pt-BR");
                                                const prevMsg = idx > 0 ? ticketDetail.messages[idx - 1] : null;
                                                const prevDateStr = prevMsg ? new Date(prevMsg.createdAt).toLocaleDateString("pt-BR") : null;
                                                const showDateDivider = idx === 0 || currentDateStr !== prevDateStr;

                                                const dateLabel = formatDynamicDateLabel(msg.createdAt);
                                                const isAudioMsg = msg.messageType === "AUDIO" || msg.content?.includes("Áudio") || msg.content?.includes("Voice Note") || (msg.mediaUrl && msg.mediaUrl.match(/\.(mp3|ogg|wav|opus|m4a)/i));

                                                return (
                                                    <div key={msg.id} className="space-y-2.5">
                                                        {showDateDivider && (
                                                            <div className="flex justify-center my-3">
                                                                <span className="bg-white/90 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full shadow-2xs border border-slate-200/50 uppercase tracking-wider">
                                                                    {dateLabel}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className={`flex ${isAttendant ? "justify-end" : "justify-start"}`}>
                                                            <div className={`max-w-[70%] p-2.5 rounded-lg shadow-2xs text-xs ${isAttendant ? "bg-[#d9fdd3] text-slate-900 rounded-tr-none" : "bg-white text-slate-900 rounded-tl-none"}`}>
                                                                {/* Nome do Colaborador que postou no grupo (apenas em Grupos) */}
                                                                {showSenderHeader && (
                                                                    <div className="text-[11px] font-extrabold text-emerald-700 mb-1">
                                                                        {msg.senderName}
                                                                    </div>
                                                                )}

                                                                {/* Exibição de Imagem com Zoom e Download ao Clicar */}
                                                                {msg.mediaUrl && (msg.messageType === "IMAGE" || msg.mediaUrl.match(/\.(jpg|jpeg|png|webp)/i)) && (
                                                                    <div className="relative group cursor-pointer my-1 overflow-hidden rounded-lg border border-slate-200" onClick={() => setSelectedImageZoom(msg.mediaUrl)}>
                                                                        <img src={msg.mediaUrl} alt="Mídia" className="max-w-xs rounded-lg max-h-72 object-cover transition group-hover:scale-105" />
                                                                    </div>
                                                                )}

                                                                {/* Player de Áudio / Mensagem de Voz Real */}
                                                                {isAudioMsg && (
                                                                    <div className="my-1 p-2.5 bg-slate-100/90 rounded-lg border border-slate-200 space-y-1.5 min-w-[220px]">
                                                                        <div className="flex items-center justify-between gap-2 text-slate-800 font-bold text-xs">
                                                                            <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                                                                                <Mic className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                                                                <span className="truncate">{msg.content || "Mensagem de Voz"}</span>
                                                                            </div>
                                                                            {msg.mediaUrl && (
                                                                                <a
                                                                                    href={msg.mediaUrl}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    download="audio_whatsapp.mp3"
                                                                                    className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded hover:bg-emerald-700 transition flex-shrink-0"
                                                                                >
                                                                                    Baixar Áudio
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                        {msg.mediaUrl ? (
                                                                            <audio controls src={msg.mediaUrl} className="w-full h-8 rounded-md" />
                                                                        ) : (
                                                                            <span className="text-[10px] text-slate-500 italic block pt-0.5">Áudio enviado via WhatsApp Web</span>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Exibição de PDF Real */}
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

                                                                {!isAudioMsg && <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                                                                <div className="flex items-center justify-end gap-1 text-[9px] text-slate-500 mt-1 font-mono">
                                                                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                    {isAttendant && <CheckCheck className="w-3.5 h-3.5 text-emerald-600 inline" />}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div ref={messagesEndRef} />
                                        </div>

                                        {/* Barra de Digitação Estilo WhatsApp Web Fixa no Rodapé (Foto 01) */}
                                        <div className="h-16 bg-[#f0f2f5] border-t border-slate-300 px-4 flex items-center gap-3 flex-shrink-0 z-20">
                                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                            <button type="button" className="text-slate-500 hover:text-slate-700 p-1 cursor-pointer" onClick={() => fileInputRef.current?.click()} title="Anexar arquivo">
                                                <Paperclip className="w-5 h-5" />
                                            </button>
                                            <button type="button" className="text-slate-500 hover:text-slate-700 p-1 cursor-pointer" title="Emojis">
                                                <Smile className="w-5 h-5" />
                                            </button>
                                            <Textarea
                                                value={messageText}
                                                onChange={(e) => setMessageText(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                                placeholder="Digite uma mensagem..."
                                                className="flex-1 text-xs resize-none h-10 min-h-[40px] bg-white border-none rounded-lg px-4 py-2.5 shadow-2xs focus:ring-1 focus:ring-emerald-500"
                                            />
                                            <Button onClick={handleSendMessage} disabled={sending || !messageText.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 w-10 p-0 rounded-full flex items-center justify-center shadow-xs flex-shrink-0 cursor-pointer">
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
                        onSelectTicket={(id, tab) => {
                            setSelectedTicketId(id);
                            if (tab) setModalInitialTab(tab);
                        }}
                        onStagesUpdated={loadData}
                    />

                    {/* Modal do Chat do WhatsApp Web ao Clicar no Card do Kanban */}
                    {selectedTicketId && (
                        <HrTicketModal
                            ticketId={selectedTicketId}
                            initialTab={modalInitialTab}
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

            {showImportModal && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                📥 Importar Histórico do WhatsApp Web
                            </h3>
                            <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Cole abaixo o código ou texto copiado do seu WhatsApp Web para salvar todas as mensagens no banco de dados do seu sistema.
                        </p>
                        <Textarea
                            value={importJsonText}
                            onChange={(e) => setImportJsonText(e.target.value)}
                            placeholder="Cole o código/JSON aqui (Ctrl+V)..."
                            className="h-44 text-xs font-mono bg-slate-50 border-slate-300 rounded-xl"
                        />
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <Button variant="ghost" size="sm" onClick={() => setShowImportModal(false)} className="text-xs font-bold">Cancelar</Button>
                            <Button size="sm" onClick={handleProcessImportJson} disabled={importing || !importJsonText.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                                {importing ? "Importando..." : "Salvar no Banco de Dados"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <HrAccessManager open={showAccessManager} onClose={() => setShowAccessManager(false)} />
        </div>
    );
}
