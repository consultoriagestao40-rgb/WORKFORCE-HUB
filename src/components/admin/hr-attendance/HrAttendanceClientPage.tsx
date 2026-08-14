"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Search, Paperclip, Send, CheckCheck, Clock, ShieldCheck,
    ArrowRightLeft, UserCheck, Lock, RefreshCw, X, Plus, Calendar,
    StickyNote, Filter, Phone, Video, MoreVertical, MessageSquare,
    DollarSign, ClipboardList, Smile, Mic, Sparkles, ExternalLink,
    Zap, Check, Users, ShieldAlert, ArrowLeft, ChevronRight
} from "lucide-react";
import {
    getHrPipelineStages,
    getHrTickets,
    getHrLabels,
    seedDefaultPipeline,
    syncZapiChats,
    syncTicketWhatsAppHistory,
    getHrTicketDetail,
    sendHrWhatsAppMessage,
    sendHrWhatsAppFile,
    getHrTicketMessages,
    markHrTicketRead,
    assumeHrTicket,
    transferHrTicket,
    closeHrTicket,
    reopenHrTicket,
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
import { HrCrmSidePanel } from "./HrCrmSidePanel";
import { HrCloseTicketModal } from "./HrCloseTicketModal";
import { HrQuickRepliesModal } from "./HrQuickRepliesModal";
import { toast } from "sonner";
import Link from "next/link";

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
    // Alternador de Visões: 'chat' (Atendimento 3-Colunas) ou 'kanban' (Pipeline Kanban)
    const [mainView, setMainView] = useState<"chat" | "kanban">("chat");

    const [stages, setStages] = useState<any[]>([]);
    const [tickets, setTickets] = useState<any[]>([]);
    const [labels, setLabels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtros de Categoria de Atendimento
    const [categoryTab, setCategoryTab] = useState<"my" | "unassigned" | "all" | "closed" | "groups">("my");
    const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Ticket Selecionado no Chat 3-Colunas
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [ticketDetail, setTicketDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Ticket Selecionado no Kanban (Separado para nunca abrir sozinho ao trocar de aba)
    const [kanbanModalTicketId, setKanbanModalTicketId] = useState<string | null>(null);
    const [modalInitialTab, setModalInitialTab] = useState<"chat" | "notes" | "activities" | "value">("chat");

    // Painel CRM da Direita
    const [showCrmPanel, setShowCrmPanel] = useState(true);

    // Modais
    const [selectedImageZoom, setSelectedImageZoom] = useState<string | null>(null);
    const [showScheduleAct, setShowScheduleAct] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [showTransferSelect, setShowTransferSelect] = useState(false);
    const [showAccessManager, setShowAccessManager] = useState(false);

    // Estado do Envio de Mensagem e Assinatura Personalizável
    const [messageText, setMessageText] = useState("");
    const [sending, setSending] = useState(false);
    const [useStamp, setUseStamp] = useState(true);
    const [customStamp, setCustomStamp] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("hr_whatsapp_custom_stamp") || currentUser?.name?.split(" ")[0] || "Atendente RH";
        }
        return currentUser?.name?.split(" ")[0] || "Atendente RH";
    });
    const [isEditingStamp, setIsEditingStamp] = useState(false);
    const [syncingHistory, setSyncingHistory] = useState(false);

    // Gravação de Áudio ao Vivo
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Edição rápida de contato
    const [isEditingContact, setIsEditingContact] = useState(false);
    const [contactNameInput, setContactNameInput] = useState("");
    const [contactPhoneInput, setContactPhoneInput] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Iniciar Gravação de Áudio pelo Microfone
    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                stream.getTracks().forEach(t => t.stop());
                if (audioChunksRef.current.length === 0) return;

                const reader = new FileReader();
                reader.onloadend = async () => {
                    const base64Audio = reader.result as string;
                    if (ticketDetail) {
                        setSending(true);
                        try {
                            const res = await sendHrWhatsAppFile({
                                ticketId: ticketDetail.id,
                                phone: ticketDetail.contactPhone,
                                fileUrl: base64Audio,
                                fileName: `audio_${Date.now()}.ogg`,
                                mimeType: "audio/ogg",
                                caption: "🎤 Mensagem de Voz"
                            });
                            if (res.success && res.message) {
                                setTicketDetail((prev: any) => ({
                                    ...prev,
                                    messages: [...(prev?.messages || []), res.message]
                                }));
                                toast.success("Áudio enviado com sucesso!");
                            }
                            loadData();
                        } catch (e: any) {
                            toast.error("Erro ao enviar áudio gravado");
                        } finally {
                            setSending(false);
                        }
                    }
                };
                reader.readAsDataURL(audioBlob);
            };

            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err: any) {
            toast.error("Permissão de microfone negada ou indisponível.");
        }
    };

    // Parar e Enviar / Cancelar Gravação
    const handleStopRecording = (shouldSend = true) => {
        if (!mediaRecorderRef.current) return;
        if (!shouldSend) {
            audioChunksRef.current = [];
        }
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
    };

    // Upload de arquivo (Todas as extensões)
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !ticketDetail) return;

        // Reset input value to allow uploading same file again if needed
        e.target.value = "";

        setSending(true);
        const toastId = toast.loading(`Enviando ${file.name}...`);
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const dataUrl = reader.result as string;
                const res = await sendHrWhatsAppFile({
                    ticketId: ticketDetail.id,
                    phone: ticketDetail.contactPhone,
                    fileUrl: dataUrl,
                    fileName: file.name,
                    mimeType: file.type || "application/octet-stream"
                });
                if (res.success && res.message) {
                    setTicketDetail((prev: any) => ({
                        ...prev,
                        messages: [...(prev?.messages || []), res.message]
                    }));
                    toast.success(`${file.name} enviado com sucesso!`, { id: toastId });
                } else {
                    toast.error("Falha no envio do arquivo", { id: toastId });
                }
                loadData();
            };
            reader.readAsDataURL(file);
        } catch (e: any) {
            toast.error("Erro no envio do arquivo", { id: toastId });
        } finally {
            setSending(false);
        }
    };

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
                // Auto selecionar primeiro se ainda não selecionou
                const myFirst = tcks.find((t: any) => t.assigneeId === currentUser?.id);
                setSelectedTicketId(myFirst?.id || tcks[0].id);
            }
        } finally {
            setLoading(false);
        }
    }, [searchQuery, currentUser?.id, selectedTicketId]);

    // Polling inteligente a cada 5s
    useEffect(() => {
        loadData();
        const interval = setInterval(async () => {
            if (document.hidden) return;
            const tcks = await getHrTickets({ search: searchQuery });
            setTickets(tcks);
        }, 5000);
        return () => clearInterval(interval);
    }, [loadData, searchQuery]);

    const ticketCacheRef = useRef<Map<string, any>>(new Map());

    // Carregar detalhes do ticket selecionado
    const loadTicketDetail = useCallback(async (id: string) => {
        try {
            const res = await getHrTicketDetail(id);
            if (res) {
                ticketCacheRef.current.set(id, res);
                setTicketDetail((prev: any) => {
                    if (prev?.id === id || !prev) return res;
                    return prev;
                });
                setContactNameInput(res.contactName || "");
                setContactPhoneInput(res.contactPhone || "");
                markHrTicketRead(id);
            }
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    const handleSelectTicket = useCallback((t: any) => {
        if (!t || t.id === selectedTicketId) return;
        setSelectedTicketId(t.id);

        const cached = ticketCacheRef.current.get(t.id);
        if (cached) {
            setTicketDetail(cached);
            setContactNameInput(cached.contactName || "");
            setContactPhoneInput(cached.contactPhone || "");
            setLoadingDetail(false);
        } else {
            // Preview instantâneo em 0ms a partir dos dados do card
            setTicketDetail({
                id: t.id,
                title: t.title,
                contactName: t.contactName,
                contactPhone: t.contactPhone,
                contactPhotoUrl: t.contactPhotoUrl,
                stageId: t.stageId,
                assigneeId: t.assigneeId,
                assignee: t.assignee,
                employee: t.employee,
                status: t.status,
                messages: t.messages || [],
                notes: [],
                activities: [],
                labels: t.labels || []
            });
            setContactNameInput(t.contactName || "");
            setContactPhoneInput(t.contactPhone || "");
            setLoadingDetail(true);
        }

        loadTicketDetail(t.id);
    }, [selectedTicketId, loadTicketDetail]);

    useEffect(() => {
        if (selectedTicketId && !ticketDetail) {
            loadTicketDetail(selectedTicketId);
        }
    }, [selectedTicketId, ticketDetail, loadTicketDetail]);

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
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [ticketDetail?.messages]);

    // Enviar mensagem com carimbo de operador
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
            senderName: currentUser?.name || "Você",
            content: textToSend,
            status: "SENDING",
            createdAt: new Date().toISOString()
        };

        setTicketDetail((prev: any) => ({
            ...prev,
            messages: [...(prev?.messages || []), tempMsg]
        }));

        try {
            const stamp = useStamp && customStamp.trim() ? `*${customStamp.trim()}*` : undefined;
            const res = await sendHrWhatsAppMessage({
                ticketId: ticketDetail.id,
                phone: ticketDetail.contactPhone,
                message: textToSend,
                stamp
            });

            if (res.message) {
                setTicketDetail((prev: any) => ({
                    ...prev,
                    messages: prev.messages.map((m: any) => m.id === tempId ? res.message : m)
                }));
            }
            loadData();
        } catch (e: any) {
            toast.error(e.message || "Erro ao enviar mensagem");
        } finally {
            setSending(false);
        }
    };

    // Puxar Histórico dos Últimos 30 Dias via Z-API
    const handleSyncHistory30Days = async () => {
        if (!ticketDetail) return;
        setSyncingHistory(true);
        try {
            toast.info("Conectando ao WhatsApp para recuperar histórico dos últimos 30 dias...");
            const res = await syncTicketWhatsAppHistory(ticketDetail.id, 30);
            if (res.success) {
                toast.success(`Histórico sincronizado! ${res.count} mensagens recuperadas.`);
                loadTicketDetail(ticketDetail.id);
                loadData();
            } else {
                toast.error(res.error || "Não foi possível puxar histórico");
            }
        } catch (e: any) {
            toast.error(e.message || "Erro ao sincronizar mensagens");
        } finally {
            setSyncingHistory(false);
        }
    };

    const handleAssume = async () => {
        if (!selectedTicketId) return;
        await assumeHrTicket(selectedTicketId);
        toast.success("Atendimento assumido por você!");
        loadData();
        loadTicketDetail(selectedTicketId);
    };

    const handleTransfer = async (toUserId: string) => {
        if (!selectedTicketId) return;
        await transferHrTicket(selectedTicketId, toUserId);
        setShowTransferSelect(false);
        toast.success("Atendimento transferido!");
        loadData();
        loadTicketDetail(selectedTicketId);
    };

    const handleReopen = async () => {
        if (!selectedTicketId) return;
        await reopenHrTicket(selectedTicketId);
        toast.success("Atendimento reaberto!");
        loadData();
        loadTicketDetail(selectedTicketId);
    };

    const handleSaveContactEdit = async () => {
        if (!selectedTicketId || !contactNameInput.trim()) return;
        const newName = contactNameInput.trim();
        setIsEditingContact(false);

        // Atualização otimista imediata
        setTicketDetail((prev: any) => prev ? { ...prev, contactName: newName } : prev);
        setTickets((prev: any[]) => prev.map(t => t.id === selectedTicketId ? { ...t, contactName: newName } : t));

        try {
            await updateContactInfo(selectedTicketId, {
                name: newName
            });
            toast.success("Nome do contato atualizado com sucesso!");
            loadData();
        } catch {
            toast.error("Erro ao atualizar nome do contato");
        }
    };

    // Contadores para as Abas WaSeller
    const counts = useMemo(() => {
        return {
            my: tickets.filter(t => t.status === "OPEN" && t.assigneeId === currentUser?.id).length,
            unassigned: tickets.filter(t => t.status === "OPEN" && !t.assigneeId).length,
            all: tickets.filter(t => t.status === "OPEN").length,
            closed: tickets.filter(t => t.status === "CLOSED").length,
            groups: tickets.filter(t => t.contactPhone?.includes("-group") || t.contactName?.toLowerCase().includes("grupo") || t.contactName?.toLowerCase().includes("rh -")).length
        };
    }, [tickets, currentUser?.id]);

    // Filtragem de Tickets na Lista Esquerda
    const filteredTickets = useMemo(() => {
        return tickets.filter(t => {
            // Filtro por Etapa do Pipeline
            if (selectedStageId && t.stageId !== selectedStageId) return false;

            // Filtro por Categoria WaSeller
            if (categoryTab === "my" && (t.status !== "OPEN" || t.assigneeId !== currentUser?.id)) return false;
            if (categoryTab === "unassigned" && (t.status !== "OPEN" || t.assigneeId !== null)) return false;
            if (categoryTab === "all" && t.status !== "OPEN") return false;
            if (categoryTab === "closed" && t.status !== "CLOSED") return false;
            if (categoryTab === "groups") {
                const isGroup = t.contactPhone?.includes("-group") || t.contactName?.toLowerCase().includes("grupo") || t.contactName?.toLowerCase().includes("rh -");
                if (!isGroup) return false;
            }
            return true;
        });
    }, [tickets, selectedStageId, categoryTab, currentUser?.id]);

    return (
        <div className="flex flex-col h-screen bg-[#f0f2f5] overflow-hidden select-none font-sans">
            {/* Top Bar Ultra-Premium WaSeller */}
            <div className="h-14 bg-white border-b border-slate-200/80 px-4 flex items-center justify-between z-20 flex-shrink-0 shadow-2xs">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-sm shadow-xs">
                        WA
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-bold text-slate-900 leading-tight">Central de Atendimento</h1>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Conexão WhatsApp Z-API Ativa" />
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">WhatsApp CRM • {tickets.length} atendimentos</p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    {/* Alternador de Visão: Chat 3-Colunas vs Kanban */}
                    <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
                        <button
                            onClick={() => React.startTransition(() => setMainView("chat"))}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                                mainView === "chat"
                                    ? "bg-white text-emerald-700 shadow-2xs font-extrabold"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Chat WhatsApp
                        </button>
                        <button
                            onClick={() => React.startTransition(() => {
                                setKanbanModalTicketId(null);
                                setMainView("kanban");
                            })}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                                mainView === "kanban"
                                    ? "bg-white text-emerald-700 shadow-2xs font-extrabold"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            <ClipboardList className="w-3.5 h-3.5" />
                            Pipeline Kanban
                        </button>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 font-bold rounded-xl"
                        onClick={() => setShowQuickReplies(true)}
                    >
                        <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" /> Templates RH
                    </Button>

                    {currentUser?.role === "ADMIN" && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5 border-slate-200 text-slate-700 font-bold rounded-xl"
                            onClick={() => setShowAccessManager(true)}
                        >
                            <Lock className="w-3.5 h-3.5 text-slate-500" /> Acessos
                        </Button>
                    )}
                </div>
            </div>

            {/* SELETOR DE ETAPAS HORIZONTAL NO TOPO (MODO CHAT) */}
            {mainView === "chat" && (
                <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
                    <button
                        onClick={() => setSelectedStageId(null)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition flex-shrink-0 flex items-center gap-1.5 border ${
                            selectedStageId === null
                                ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                    >
                        <span>Todas</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${selectedStageId === null ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600"}`}>
                            {tickets.length}
                        </span>
                    </button>

                    {stages.map((stg) => {
                        const count = tickets.filter(t => t.stageId === stg.id).length;
                        const isSelected = selectedStageId === stg.id;
                        const stgColor = stg.color || "#10b981";

                        return (
                            <button
                                key={stg.id}
                                onClick={() => setSelectedStageId(isSelected ? null : stg.id)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex-shrink-0 flex items-center gap-1.5 border ${
                                    isSelected
                                        ? "bg-white text-slate-900 border-emerald-600 shadow-2xs ring-2 ring-emerald-500/20"
                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stgColor }} />
                                <span>{stg.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${isSelected ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* VISÃO 1: CHAT WHATSAPP CRM (3 COLUNAS INTEGRADAS) */}
            {mainView === "chat" && (
                <div className="flex flex-1 overflow-hidden">
                    {/* COLUNA 1: FILTROS E LISTA DE CONVERSAS WASELLER */}
                    <div className="w-80 md:w-96 border-r border-slate-200 bg-white flex flex-col overflow-hidden flex-shrink-0">
                        {/* Header com Abas WaSeller */}
                        <div className="p-3 border-b border-slate-200 bg-slate-50/70 space-y-2 flex-shrink-0">
                            {/* Abas de Fila e Atendimentos */}
                            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/70 rounded-xl">
                                <button
                                    onClick={() => setCategoryTab("my")}
                                    className={`py-1 text-[10px] font-black rounded-lg transition flex flex-col items-center justify-center ${
                                        categoryTab === "my" ? "bg-white text-emerald-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    <span>Meus</span>
                                    <span className="text-[9px] opacity-80">({counts.my})</span>
                                </button>
                                <button
                                    onClick={() => setCategoryTab("unassigned")}
                                    className={`py-1 text-[10px] font-black rounded-lg transition flex flex-col items-center justify-center ${
                                        categoryTab === "unassigned" ? "bg-white text-amber-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    <span>Fila</span>
                                    <span className="text-[9px] opacity-80">({counts.unassigned})</span>
                                </button>
                                <button
                                    onClick={() => setCategoryTab("all")}
                                    className={`py-1 text-[10px] font-black rounded-lg transition flex flex-col items-center justify-center ${
                                        categoryTab === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    <span>Todos</span>
                                    <span className="text-[9px] opacity-80">({counts.all})</span>
                                </button>
                                <button
                                    onClick={() => setCategoryTab("closed")}
                                    className={`py-1 text-[10px] font-black rounded-lg transition flex flex-col items-center justify-center ${
                                        categoryTab === "closed" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    <span>Histórico</span>
                                    <span className="text-[9px] opacity-80">({counts.closed})</span>
                                </button>
                            </div>

                            {/* Campo de Busca Rápida */}
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                <Input
                                    placeholder="Buscar por nome, telefone ou CPF..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 text-xs h-9 bg-white border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Lista de Conversas do CRM */}
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0">
                            {loading ? (
                                <div className="p-8 text-center text-xs text-slate-400">Carregando atendimentos...</div>
                            ) : filteredTickets.length === 0 ? (
                                <div className="p-8 text-center text-xs text-slate-400">Nenhum atendimento nesta categoria.</div>
                            ) : (
                                filteredTickets.map((t) => {
                                    const isSelected = selectedTicketId === t.id;
                                    const lastMsg = t.messages?.[0];
                                    const isGroup = t.contactPhone?.includes("-group") || t.contactName?.toLowerCase().includes("grupo");
                                    const employee = t.employee;

                                    return (
                                        <div
                                            key={t.id}
                                            onClick={() => handleSelectTicket(t)}
                                            className={`p-3 flex items-start gap-3 cursor-pointer transition relative ${
                                                isSelected ? "bg-emerald-50/70 border-l-4 border-l-emerald-600" : "hover:bg-slate-50"
                                            }`}
                                        >
                                            <div className="relative flex-shrink-0 mt-0.5">
                                                {t.contactPhotoUrl && t.contactPhotoUrl !== "null" ? (
                                                    <img
                                                        src={t.contactPhotoUrl}
                                                        alt=""
                                                        className="w-11 h-11 rounded-2xl object-cover border border-slate-200 shadow-2xs"
                                                    />
                                                ) : isGroup ? (
                                                    <div className="w-11 h-11 rounded-2xl bg-amber-600 text-white font-bold text-base flex items-center justify-center shadow-2xs">
                                                        👥
                                                    </div>
                                                ) : (
                                                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-700 text-white font-bold text-sm flex items-center justify-center shadow-2xs">
                                                        {t.contactName?.charAt(0).toUpperCase() || "?"}
                                                    </div>
                                                )}

                                                {t.unreadCount > 0 && (
                                                    <span className="absolute -bottom-1 -right-1 bg-[#25d366] text-white text-[10px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 border-2 border-white shadow-2xs animate-pulse">
                                                        {t.unreadCount}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="overflow-hidden flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <h4 className="text-xs font-black text-slate-900 truncate">{t.contactName}</h4>
                                                    <span className={`text-[10px] font-mono flex-shrink-0 ${t.unreadCount > 0 ? "text-emerald-600 font-black" : "text-slate-400"}`}>
                                                        {new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1 mb-1">
                                                    <span className="text-[10px] text-slate-400 font-mono truncate">{t.contactPhone}</span>
                                                    {employee && (
                                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold truncate max-w-[100px]">
                                                            {employee.role?.name || "CLT"}
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-[11px] text-slate-500 truncate leading-snug">
                                                    {lastMsg ? (
                                                        <span>{lastMsg.senderType === "ATTENDANT" ? "✓ Você: " : ""}{lastMsg.content}</span>
                                                    ) : (
                                                        <span className="italic text-slate-400">Atendimento iniciado</span>
                                                    )}
                                                </p>

                                                {/* Badges de Etapa e Atendente no Rodapé do Card */}
                                                <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-100/80">
                                                    <span
                                                        className="text-[9px] font-black px-1.5 py-0.2 rounded text-white shadow-2xs truncate max-w-[110px]"
                                                        style={{ backgroundColor: t.stage?.color || "#6366f1" }}
                                                    >
                                                        {t.stage?.name}
                                                    </span>

                                                    <span className="text-[9px] font-bold text-slate-500">
                                                        👤 {t.assignee?.name ? t.assignee.name.split(" ")[0] : "Fila Geral"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* COLUNA 2: CHAT AO VIVO WHATSAPP WASELLER */}
                    <div className="flex-1 flex flex-col bg-[#efeae2] relative overflow-hidden">
                        {!ticketDetail ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-xs text-slate-400 bg-[#f0f2f5] p-6 text-center">
                                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-black text-2xl mb-3 shadow-xs">
                                    💬
                                </div>
                                <h3 className="text-base font-bold text-slate-800 mb-1">Central WaAtendimento Pro</h3>
                                <p className="text-xs text-slate-500 max-w-sm">
                                    Selecione um atendimento à esquerda para conversar, aplicar carimbo de atendente, gerenciar SLA e registrar anotações internas.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-1 flex-col h-full overflow-hidden">
                                {/* Top Bar do Chat Ativo */}
                                <div className="h-16 bg-[#f0f2f5] border-b border-slate-300 px-4 flex items-center justify-between z-10 shadow-2xs gap-3 flex-shrink-0">
                                    <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                        {ticketDetail.contactPhotoUrl && ticketDetail.contactPhotoUrl !== "null" ? (
                                            <img src={ticketDetail.contactPhotoUrl} alt="" className="w-10 h-10 rounded-2xl object-cover border flex-shrink-0 shadow-2xs" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-700 text-white font-black text-xs flex items-center justify-center flex-shrink-0 shadow-2xs">
                                                {ticketDetail.contactName?.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="overflow-hidden min-w-0 flex-1">
                                            {isEditingContact ? (
                                                <div className="flex items-center gap-1.5 py-0.5">
                                                    <input
                                                        type="text"
                                                        value={contactNameInput}
                                                        onChange={e => setContactNameInput(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === "Enter") handleSaveContactEdit();
                                                            if (e.key === "Escape") setIsEditingContact(false);
                                                        }}
                                                        autoFocus
                                                        className="text-xs font-bold bg-white border border-emerald-500 rounded-lg px-2 py-1 w-44 shadow-2xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900"
                                                        placeholder="Nome do contato..."
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleSaveContactEdit}
                                                        className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded-lg shadow-xs cursor-pointer transition"
                                                        title="Salvar"
                                                    >
                                                        Salvar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsEditingContact(false)}
                                                        className="text-[11px] bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-1.5 py-1 rounded-lg cursor-pointer transition"
                                                        title="Cancelar"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    <h3 className="text-xs font-black text-slate-900 truncate max-w-[200px] leading-tight" title={ticketDetail.contactName}>
                                                        {ticketDetail.contactName}
                                                    </h3>
                                                    <button
                                                        onClick={() => {
                                                            setContactNameInput(ticketDetail.contactName || "");
                                                            setIsEditingContact(true);
                                                        }}
                                                        className="text-slate-400 hover:text-emerald-700 text-xs flex-shrink-0 cursor-pointer p-0.5 transition"
                                                        title="Editar nome do contato"
                                                    >
                                                        ✏️
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                                <span>{ticketDetail.contactPhone}</span>
                                                {ticketDetail.employee && (
                                                    <Link
                                                        href={`/admin/employees/${ticketDetail.employee.id}`}
                                                        target="_blank"
                                                        className="text-emerald-700 font-bold hover:underline flex items-center gap-0.5 font-sans"
                                                    >
                                                        CLT: {ticketDetail.employee.role?.name || "Funcionário"} <ExternalLink className="w-2.5 h-2.5" />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ações Rápidas do Cabeçalho */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {/* Botão Puxar Histórico 30 Dias */}
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleSyncHistory30Days}
                                            disabled={syncingHistory}
                                            className="h-8 text-xs font-bold gap-1 bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl"
                                            title="Sincronizar mensagens dos últimos 30 dias diretamente do WhatsApp"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${syncingHistory ? "animate-spin" : ""}`} />
                                            <span className="hidden lg:inline">{syncingHistory ? "Puxando..." : "Puxar 30 Dias"}</span>
                                        </Button>

                                        {/* Assumir ou Transferir */}
                                        {!ticketDetail.assigneeId || ticketDetail.assigneeId !== currentUser?.id ? (
                                            <Button
                                                size="sm"
                                                onClick={handleAssume}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-bold px-3 rounded-xl shadow-2xs"
                                            >
                                                Assumir
                                            </Button>
                                        ) : null}

                                        {/* Seletor de Atendente / Transferência */}
                                        <div className="relative">
                                            <select
                                                value={ticketDetail.assigneeId || ""}
                                                onChange={(e) => handleTransfer(e.target.value)}
                                                className="h-8 bg-white border border-slate-300 text-slate-800 font-bold text-xs rounded-xl px-2 focus:outline-none focus:border-emerald-500 shadow-2xs"
                                            >
                                                <option value="">👤 Fila Geral (Livre)</option>
                                                {allUsers.map(u => (
                                                    <option key={u.id} value={u.id}>👤 {u.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Botão de Encerramento ou Reabertura */}
                                        {ticketDetail.status === "OPEN" ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs text-rose-700 border-rose-200 bg-rose-50 hover:bg-rose-100 font-bold rounded-xl"
                                                onClick={() => setShowCloseModal(true)}
                                            >
                                                <Lock className="w-3.5 h-3.5 mr-1 text-rose-600" /> Encerrar
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                className="h-8 text-xs bg-slate-900 text-white font-bold rounded-xl"
                                                onClick={handleReopen}
                                            >
                                                Reabrir Atendimento
                                            </Button>
                                        )}

                                        {/* Alternador do Painel CRM */}
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setShowCrmPanel(!showCrmPanel)}
                                            className={`h-8 px-2.5 rounded-xl font-bold text-xs ${showCrmPanel ? "bg-slate-200 text-slate-800" : "text-slate-600"}`}
                                            title="Abrir/Fechar Painel CRM"
                                        >
                                            <Sparkles className="w-4 h-4 text-emerald-600" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Feed de Mensagens WhatsApp com Carimbo de Atendente */}
                                <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#efeae2] relative">
                                    <div
                                        className="absolute inset-0 bg-[#efeae2] bg-repeat opacity-95 pointer-events-none z-0"
                                        style={{ backgroundImage: `url('/whatsapp-bg-official.png')`, backgroundSize: '500px 380px' }}
                                    />

                                    <div className="flex-1 overflow-y-auto p-4 space-y-2.5 relative z-10 min-h-0">
                                        {ticketDetail.messages?.map((msg: any, idx: number) => {
                                            const isAttendant = msg.senderType === "ATTENDANT" || msg.fromMe === true;
                                            const isSystem = msg.senderType === "SYSTEM";

                                            const currentDateStr = new Date(msg.createdAt).toLocaleDateString("pt-BR");
                                            const prevMsg = idx > 0 ? ticketDetail.messages[idx - 1] : null;
                                            const prevDateStr = prevMsg ? new Date(prevMsg.createdAt).toLocaleDateString("pt-BR") : null;
                                            const showDateDivider = idx === 0 || currentDateStr !== prevDateStr;

                                            const dateLabel = formatDynamicDateLabel(msg.createdAt);
                                            const isAudioMsg = msg.messageType === "AUDIO" || msg.content?.includes("Áudio") || (msg.mediaUrl && msg.mediaUrl.match(/\.(mp3|ogg|wav|opus|m4a)/i));

                                            if (isSystem) {
                                                return (
                                                    <div key={msg.id} className="flex justify-center my-2">
                                                        <div className="bg-amber-100/90 text-amber-900 border border-amber-200/60 text-[10px] font-bold px-3 py-1 rounded-full shadow-2xs text-center max-w-md">
                                                            {msg.content}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={msg.id} className="space-y-2.5">
                                                    {showDateDivider && (
                                                        <div className="flex justify-center my-3">
                                                            <span className="bg-white/90 text-slate-600 text-[10px] font-black px-3 py-1 rounded-full shadow-2xs border border-slate-200/50 uppercase tracking-wider">
                                                                {dateLabel}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className={`flex ${isAttendant ? "justify-end" : "justify-start"}`}>
                                                        <div className={`max-w-[75%] p-2.5 rounded-2xl shadow-2xs text-xs ${isAttendant ? "bg-[#d9fdd3] text-slate-900 rounded-tr-xs" : "bg-white text-slate-900 rounded-tl-xs"}`}>
                                                            {/* Carimbo de Atendente no Topo da Mensagem */}
                                                            {isAttendant && msg.senderName && (
                                                                <div className="text-[10px] font-extrabold text-emerald-800 mb-0.5 flex items-center gap-1 border-b border-emerald-500/20 pb-0.5">
                                                                    <span>👤 {msg.senderName}</span>
                                                                </div>
                                                            )}

                                                            {!isAttendant && msg.senderName && (
                                                                <div className="text-[10px] font-extrabold text-slate-700 mb-0.5">
                                                                    {msg.senderName}
                                                                </div>
                                                            )}

                                                            {/* Exibição de Imagem com Zoom */}
                                                            {msg.mediaUrl && (msg.messageType === "IMAGE" || msg.mediaUrl.match(/\.(jpg|jpeg|png|webp)/i)) && (
                                                                <div className="relative group cursor-pointer my-1 overflow-hidden rounded-xl border border-slate-200" onClick={() => setSelectedImageZoom(msg.mediaUrl)}>
                                                                    <img src={msg.mediaUrl} alt="Mídia" className="max-w-xs rounded-xl max-h-72 object-cover transition group-hover:scale-105" />
                                                                </div>
                                                            )}

                                                            {/* Player de Áudio */}
                                                            {isAudioMsg && (
                                                                <div className="my-1 p-2.5 bg-slate-100/90 rounded-xl border border-slate-200 space-y-1.5 min-w-[220px]">
                                                                    <div className="flex items-center justify-between gap-2 text-slate-800 font-bold text-xs">
                                                                        <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                                                                            <Mic className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                                                            <span className="truncate">{msg.content || "Mensagem de Voz"}</span>
                                                                        </div>
                                                                        {msg.mediaUrl && (
                                                                            <a
                                                                                href={msg.mediaUrl.startsWith("http") ? `/api/whatsapp/media-proxy?url=${encodeURIComponent(msg.mediaUrl)}` : msg.mediaUrl}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                download="audio_whatsapp.mp3"
                                                                                className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-lg hover:bg-emerald-700 transition flex-shrink-0"
                                                                            >
                                                                                Baixar
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                    {msg.mediaUrl ? (
                                                                        <audio controls preload="auto" src={msg.mediaUrl.startsWith("http") ? `/api/whatsapp/media-proxy?url=${encodeURIComponent(msg.mediaUrl)}` : msg.mediaUrl} className="w-full h-8 rounded-md" />
                                                                    ) : (
                                                                        <span className="text-[10px] text-slate-500 italic block pt-0.5">Áudio gravado via WhatsApp</span>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Exibição de Vídeo */}
                                                            {msg.messageType === "VIDEO" && msg.mediaUrl && (
                                                                <div className="my-1 overflow-hidden rounded-xl border border-slate-200 bg-black/90">
                                                                    <video controls src={msg.mediaUrl.startsWith("http") ? `/api/whatsapp/media-proxy?url=${encodeURIComponent(msg.mediaUrl)}` : msg.mediaUrl} className="max-w-xs max-h-72 rounded-xl" />
                                                                </div>
                                                            )}

                                                            {/* Exibição de Documentos e Todas as Extensões (PDF, Word, Excel, ZIP, etc.) */}
                                                            {msg.messageType === "DOCUMENT" && msg.mediaUrl && (() => {
                                                                const fileName = msg.mediaFileName || "arquivo";
                                                                const ext = fileName.split(".").pop()?.toLowerCase() || "";
                                                                
                                                                let badgeBg = "bg-slate-600";
                                                                let badgeLabel = ext.toUpperCase() || "DOC";

                                                                if (ext === "pdf") {
                                                                    badgeBg = "bg-rose-600";
                                                                    badgeLabel = "PDF";
                                                                } else if (["xls", "xlsx", "csv"].includes(ext)) {
                                                                    badgeBg = "bg-emerald-600";
                                                                    badgeLabel = "XLS";
                                                                } else if (["doc", "docx"].includes(ext)) {
                                                                    badgeBg = "bg-blue-600";
                                                                    badgeLabel = "DOC";
                                                                } else if (["zip", "rar", "7z", "tar"].includes(ext)) {
                                                                    badgeBg = "bg-amber-600";
                                                                    badgeLabel = "ZIP";
                                                                }

                                                                const downloadUrl = msg.mediaUrl.startsWith("http")
                                                                    ? `/api/whatsapp/media-proxy?url=${encodeURIComponent(msg.mediaUrl)}`
                                                                    : msg.mediaUrl;

                                                                return (
                                                                    <div className="flex items-center gap-3 p-2.5 bg-slate-100/95 rounded-xl mb-1.5 border border-slate-200 shadow-2xs">
                                                                        <div className={`w-9 h-9 rounded-lg ${badgeBg} text-white flex items-center justify-center font-black text-[10px] flex-shrink-0 shadow-2xs`}>
                                                                            {badgeLabel}
                                                                        </div>
                                                                        <div className="overflow-hidden flex-1 min-w-0">
                                                                            <span className="font-bold text-slate-800 block truncate text-xs" title={fileName}>
                                                                                {fileName}
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-500 font-mono">Arquivo • {ext.toUpperCase()}</span>
                                                                        </div>
                                                                        <a
                                                                            href={downloadUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            download={fileName}
                                                                            className="text-xs bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg transition flex-shrink-0 shadow-2xs"
                                                                        >
                                                                            Baixar
                                                                        </a>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {!isAudioMsg && msg.content && !msg.content.startsWith("📎 ") && (
                                                                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                                            )}

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

                                    {/* Composer de Mensagens WaSeller com Gravação de Áudio ao Vivo */}
                                    <div className="bg-[#f0f2f5] border-t border-slate-300 p-3 flex flex-col gap-2 flex-shrink-0 z-20">
                                        <div className="flex items-center justify-between text-[11px] text-slate-600 px-1">
                                            <div className="flex items-center gap-2">
                                                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={useStamp}
                                                        onChange={e => setUseStamp(e.target.checked)}
                                                        className="rounded text-emerald-600 cursor-pointer"
                                                    />
                                                    <span>Assinar como:</span>
                                                </label>

                                                {isEditingStamp ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="text"
                                                            value={customStamp}
                                                            onChange={e => {
                                                                setCustomStamp(e.target.value);
                                                                localStorage.setItem("hr_whatsapp_custom_stamp", e.target.value);
                                                            }}
                                                            onBlur={() => setIsEditingStamp(false)}
                                                            onKeyDown={e => e.key === "Enter" && setIsEditingStamp(false)}
                                                            autoFocus
                                                            placeholder="Nome da assinatura..."
                                                            className="text-[11px] font-bold bg-white border border-emerald-500 rounded-lg px-2 py-0.5 w-36 shadow-2xs focus:outline-none"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsEditingStamp(false)}
                                                            className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded cursor-pointer"
                                                        >
                                                            OK
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsEditingStamp(true)}
                                                        className="font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2 py-0.5 rounded-lg flex items-center gap-1 text-[11px] transition cursor-pointer"
                                                        title="Clique para personalizar seu nome de assinatura no WhatsApp"
                                                    >
                                                        <span>{customStamp || "Definir nome"}</span>
                                                        <span className="text-[9px] text-emerald-600">✏️</span>
                                                    </button>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => setShowQuickReplies(true)}
                                                className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1"
                                            >
                                                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" /> Templates RH
                                            </button>
                                        </div>

                                        {/* Barra de Digitação ou Gravação */}
                                        {isRecording ? (
                                            <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-xl px-4 py-2 text-rose-800 animate-pulse">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                                                    <span className="text-xs font-bold font-mono">
                                                        Gravando áudio: {Math.floor(recordingTime / 60).toString().padStart(2, "0")}:{(recordingTime % 60).toString().padStart(2, "0")}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleStopRecording(false)}
                                                        className="h-8 text-xs font-bold text-slate-600 hover:text-rose-600"
                                                    >
                                                        <X className="w-4 h-4 mr-1" /> Cancelar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleStopRecording(true)}
                                                        className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
                                                    >
                                                        <Send className="w-3.5 h-3.5 mr-1" /> Enviar Áudio
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                    accept="*/*"
                                                />
                                                <button
                                                    type="button"
                                                    className="text-slate-500 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-200 transition cursor-pointer"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    title="Anexar arquivo (PDFs, Fotos, Planilhas, Docs, etc.)"
                                                >
                                                    <Paperclip className="w-5 h-5" />
                                                </button>

                                                <button
                                                    type="button"
                                                    className="text-slate-500 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition cursor-pointer"
                                                    onClick={handleStartRecording}
                                                    title="Gravar mensagem de voz"
                                                >
                                                    <Mic className="w-5 h-5" />
                                                </button>

                                                <Textarea
                                                    value={messageText}
                                                    onChange={(e) => setMessageText(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleSendMessage();
                                                        }
                                                    }}
                                                    placeholder="Digite sua mensagem para o colaborador (Enter para enviar, Shift+Enter para nova linha)..."
                                                    className="flex-1 text-xs resize-none h-11 min-h-[44px] bg-white border-none rounded-xl px-4 py-3 shadow-2xs focus:ring-1 focus:ring-emerald-500"
                                                />

                                                <Button
                                                    onClick={handleSendMessage}
                                                    disabled={sending || !messageText.trim()}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 w-11 p-0 rounded-xl flex items-center justify-center shadow-xs flex-shrink-0 cursor-pointer"
                                                >
                                                    <Send className="w-4 h-4 ml-0.5" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* COLUNA 3: PAINEL CRM WASELLER DO CONTATO */}
                    {showCrmPanel && ticketDetail && (
                        <HrCrmSidePanel
                            ticket={ticketDetail}
                            currentUser={currentUser}
                            allUsers={allUsers}
                            availableStages={stages}
                            availableLabels={labels}
                            onUpdated={() => {
                                loadTicketDetail(ticketDetail.id);
                                loadData();
                            }}
                            onOpenScheduleModal={() => setShowScheduleAct(true)}
                            onClosePanel={() => setShowCrmPanel(false)}
                        />
                    )}
                </div>
            )}

            {/* VISÃO 2: PIPELINE KANBAN */}
            {mainView === "kanban" && (
                <>
                    <HrKanbanView
                        stages={stages}
                        tickets={tickets}
                        onSelectTicket={(id, tab) => {
                            setKanbanModalTicketId(id);
                            if (tab) setModalInitialTab(tab);
                        }}
                        onStagesUpdated={loadData}
                    />

                    {kanbanModalTicketId && (
                        <HrTicketModal
                            ticketId={kanbanModalTicketId}
                            initialTab={modalInitialTab}
                            onClose={() => setKanbanModalTicketId(null)}
                            onUpdated={loadData}
                            availableUsers={allUsers}
                            availableLabels={labels}
                            availableStages={stages}
                        />
                    )}
                </>
            )}

            {/* MODAL ZOOM DE IMAGEM */}
            {selectedImageZoom && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedImageZoom(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <img src={selectedImageZoom} alt="Visualização" className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-slate-700" />
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

            {/* MODAL AGENDAR ATIVIDADE */}
            {showScheduleAct && selectedTicketId && (
                <HrScheduleActivityModal
                    open={showScheduleAct}
                    onClose={() => setShowScheduleAct(false)}
                    ticketId={selectedTicketId}
                    onCreated={() => {
                        setShowScheduleAct(false);
                        loadData();
                        if (ticketDetail) loadTicketDetail(ticketDetail.id);
                    }}
                />
            )}

            {/* MODAL ENCERRAMENTO COM MOTIVO */}
            {showCloseModal && ticketDetail && (
                <HrCloseTicketModal
                    ticket={ticketDetail}
                    open={showCloseModal}
                    onOpenChange={setShowCloseModal}
                    onClosed={() => {
                        loadData();
                        loadTicketDetail(ticketDetail.id);
                    }}
                />
            )}

            {/* MODAL RESPOSTAS RÁPIDAS / TEMPLATES */}
            {showQuickReplies && (
                <HrQuickRepliesModal
                    open={showQuickReplies}
                    onOpenChange={setShowQuickReplies}
                    onSelectReply={(text) => {
                        setMessageText(prev => prev ? `${prev}\n${text}` : text);
                    }}
                />
            )}

            <HrAccessManager open={showAccessManager} onClose={() => setShowAccessManager(false)} />
        </div>
    );
}
