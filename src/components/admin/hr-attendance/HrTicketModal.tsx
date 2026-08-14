"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
    Phone, Video, Search, MoreVertical, Paperclip, Smile, Mic, Send,
    Calendar, StickyNote, Tag, UserCheck, ArrowRightLeft, CheckCheck, Clock,
    ShieldCheck, X, Zap, Download, RefreshCw, Lock, Sparkles, User, ExternalLink,
    Briefcase, Building2, ChevronRight, FileText
} from "lucide-react";

import {
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
    syncTicketWhatsAppHistory
} from "@/actions/hr-attendance";
import { HrScheduleMessageModal } from "./HrScheduleMessageModal";
import { HrScheduleActivityModal } from "./HrScheduleActivityModal";
import { HrCloseTicketModal } from "./HrCloseTicketModal";
import { HrQuickRepliesModal } from "./HrQuickRepliesModal";
import { toast } from "sonner";

interface Props {
    ticketId: string | null;
    initialTab?: "chat" | "notes" | "activities" | "value";
    currentUser?: any;
    allUsers?: any[];
    onClose: () => void;
    onUpdated?: () => void;
    availableUsers?: any[];
    availableLabels?: any[];
    availableStages?: any[];
}

export function HrTicketModal({
    ticketId,
    initialTab = "chat",
    currentUser,
    allUsers = [],
    onClose,
    onUpdated,
    availableUsers = [],
    availableLabels = [],
    availableStages = []
}: Props) {
    const usersList = availableUsers.length > 0 ? availableUsers : allUsers;
    const [ticket, setTicket] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"chat" | "notes" | "activities" | "value">(initialTab);

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

    // Modais
    const [showScheduleAct, setShowScheduleAct] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [showTransferSelect, setShowTransferSelect] = useState(false);

    const [noteText, setNoteText] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const loadDetail = useCallback(async () => {
        if (!ticketId) return;
        try {
            const res = await getHrTicketDetail(ticketId);
            if (res) {
                setTicket(res);
                markHrTicketRead(ticketId);
            }
        } finally {
            setLoading(false);
        }
    }, [ticketId]);

    useEffect(() => {
        loadDetail();
    }, [loadDetail]);

    // Polling a cada 2s para novas mensagens ativas no modal
    useEffect(() => {
        if (!ticketId) return;
        const interval = setInterval(async () => {
            const lastMsg = ticket?.messages?.[ticket.messages.length - 1];
            const since = lastMsg?.createdAt;
            const newMsgs = await getHrTicketMessages(ticketId, since ? new Date(since).toISOString() : undefined);
            if (newMsgs.length > 0) {
                setTicket((prev: any) => {
                    if (!prev) return prev;
                    const existingIds = new Set(prev.messages.map((m: any) => m.id));
                    const toAdd = newMsgs.filter(m => !existingIds.has(m.id));
                    if (toAdd.length === 0) return prev;
                    return { ...prev, messages: [...prev.messages, ...toAdd] };
                });
                markHrTicketRead(ticketId);
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [ticketId, ticket?.messages]);

    useEffect(() => {
        if (activeTab === "chat") {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [ticket?.messages, activeTab]);

    // Iniciar Atendimento / Assumir (Padrão Bitrix24)
    const handleStartAttendance = async () => {
        if (!ticket) return;
        const toastId = toast.loading("Iniciando atendimento...");
        try {
            const res = await assumeHrTicket(ticket.id);
            if (res.success) {
                toast.success("Você agora é o responsável pelo atendimento!", { id: toastId });
                loadDetail();
                onUpdated?.();
            } else {
                toast.error(res.error || "Erro ao assumir atendimento", { id: toastId });
            }
        } catch {
            toast.error("Erro ao iniciar atendimento", { id: toastId });
        }
    };

    // Transferir Atendimento
    const handleTransfer = async (toUserId: string) => {
        if (!ticket || !toUserId) return;
        try {
            await transferHrTicket(ticket.id, toUserId);
            setShowTransferSelect(false);
            toast.success("Atendimento transferido!");
            loadDetail();
            onUpdated?.();
        } catch {
            toast.error("Erro ao transferir atendimento");
        }
    };

    // Puxar 30 Dias de Histórico do WhatsApp
    const handleSyncHistory = async () => {
        if (!ticket) return;
        setSyncingHistory(true);
        try {
            toast.info("Puxando mensagens dos últimos 30 dias diretamente do WhatsApp...");
            const res = await syncTicketWhatsAppHistory(ticket.id, 30);
            if (res.success) {
                toast.success(`Histórico sincronizado! ${res.count} mensagens atualizadas.`);
                loadDetail();
                onUpdated?.();
            } else {
                toast.error(res.error || "Erro ao sincronizar histórico");
            }
        } catch {
            toast.error("Falha na sincronização com WhatsApp");
        } finally {
            setSyncingHistory(false);
        }
    };

    // Enviar Mensagem
    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!messageText.trim() || sending || !ticket) return;

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

        setTicket((prev: any) => ({
            ...prev,
            messages: [...(prev?.messages || []), tempMsg]
        }));

        try {
            const stamp = useStamp && customStamp.trim() ? `*${customStamp.trim()}*` : undefined;
            const res = await sendHrWhatsAppMessage({
                ticketId: ticket.id,
                phone: ticket.contactPhone,
                message: textToSend,
                stamp
            });

            if (res.message) {
                setTicket((prev: any) => ({
                    ...prev,
                    messages: prev.messages.map((m: any) => m.id === tempId ? res.message : m)
                }));
            }
            loadDetail();
            onUpdated?.();
        } catch {
            toast.error("Erro ao enviar mensagem");
        } finally {
            setSending(false);
        }
    };

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
                    if (ticket) {
                        setSending(true);
                        try {
                            const res = await sendHrWhatsAppFile({
                                ticketId: ticket.id,
                                phone: ticket.contactPhone,
                                fileUrl: base64Audio,
                                fileName: `audio_${Date.now()}.ogg`,
                                mimeType: "audio/ogg",
                                caption: "🎤 Mensagem de Voz"
                            });
                            if (res.success && res.message) {
                                setTicket((prev: any) => ({
                                    ...prev,
                                    messages: [...(prev?.messages || []), res.message]
                                }));
                                toast.success("Áudio enviado com sucesso!");
                            }
                            loadDetail();
                            onUpdated?.();
                        } catch {
                            toast.error("Erro ao enviar áudio");
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
        } catch {
            toast.error("Permissão de microfone negada ou indisponível");
        }
    };

    const handleStopRecording = (shouldSend = true) => {
        if (!mediaRecorderRef.current) return;
        if (!shouldSend) {
            audioChunksRef.current = [];
        }
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !ticket) return;
        e.target.value = "";

        setSending(true);
        const toastId = toast.loading(`Enviando ${file.name}...`);
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const dataUrl = reader.result as string;
                const res = await sendHrWhatsAppFile({
                    ticketId: ticket.id,
                    phone: ticket.contactPhone,
                    fileUrl: dataUrl,
                    fileName: file.name,
                    mimeType: file.type || "application/octet-stream"
                });
                if (res.success && res.message) {
                    setTicket((prev: any) => ({
                        ...prev,
                        messages: [...(prev?.messages || []), res.message]
                    }));
                    toast.success(`${file.name} enviado!`, { id: toastId });
                } else {
                    toast.error("Falha ao enviar arquivo", { id: toastId });
                }
                loadDetail();
                onUpdated?.();
            };
            reader.readAsDataURL(file);
        } catch {
            toast.error("Erro ao enviar arquivo", { id: toastId });
        } finally {
            setSending(false);
        }
    };

    const handleAddNote = async () => {
        if (!ticket || !noteText.trim()) return;
        const res = await addHrTicketNote(ticket.id, noteText.trim());
        if (res.note) {
            setNoteText("");
            setTicket((prev: any) => ({ ...prev, notes: [...prev.notes, res.note] }));
            toast.success("Anotação salva!");
        }
    };

    const handleChangeStage = async (stageId: string) => {
        if (!ticket) return;
        await updateHrTicketStage(ticket.id, stageId);
        loadDetail();
        onUpdated?.();
    };

    if (!ticketId) return null;

    const isGroupTicket = ticket?.contactPhone?.includes("-group") || ticket?.contactName?.toLowerCase().includes("grupo");
    const isAssignedToMe = ticket?.assigneeId === currentUser?.id;
    const isUnassigned = !ticket?.assigneeId;
    const employee = ticket?.employee;

    return (
        <Dialog open={!!ticketId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-none bg-transparent max-w-6xl w-[94vw] shadow-none [&>button]:hidden">
                {loading || !ticket ? (
                    <div className="bg-white p-12 rounded-2xl text-center text-xs text-slate-500 shadow-2xl border flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                        <span className="font-bold">Carregando atendimento...</span>
                    </div>
                ) : (
                    <div className="relative bg-white w-full h-[88vh] rounded-2xl shadow-2xl overflow-hidden flex border border-slate-200/90 z-50">
                        {/* COLUNA ESQUERDA: PAINEL CRM & RESPONSÁVEL INTELIGENTE BITRIX24 */}
                        <div className="w-80 bg-slate-50/90 border-r border-slate-200 p-4 flex flex-col justify-between overflow-y-auto space-y-4 flex-shrink-0">
                            <div className="space-y-4">
                                {/* Cabeçalho do Contato com Foto em Alta Resolução */}
                                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-shrink-0">
                                            {ticket.contactPhotoUrl && ticket.contactPhotoUrl !== "null" ? (
                                                <img
                                                    src={ticket.contactPhotoUrl}
                                                    alt=""
                                                    className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-100 shadow-2xs"
                                                />
                                            ) : isGroupTicket ? (
                                                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white font-bold text-xl flex items-center justify-center shadow-2xs">
                                                    👥
                                                </div>
                                            ) : (
                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-700 text-white font-bold text-base flex items-center justify-center shadow-2xs">
                                                    {ticket.contactName?.charAt(0).toUpperCase() || "?"}
                                                </div>
                                            )}
                                        </div>

                                        <div className="overflow-hidden flex-1 min-w-0">
                                            <h2 className="text-xs font-bold text-slate-900 leading-tight truncate" title={ticket.contactName}>
                                                {ticket.contactName}
                                            </h2>
                                            <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                                                {ticket.contactPhone}
                                            </span>
                                            {employee && (
                                                <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1">
                                                    CLT • {employee.role?.name || "Funcionário"}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* CARD INTELIGENTE DE ATENDIMENTO BITRIX24 */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                        RESPONSÁVEL PELO ATENDIMENTO
                                    </label>

                                    {isUnassigned ? (
                                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 p-3.5 rounded-2xl shadow-2xs space-y-2.5">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                                                <span className="text-xs font-bold text-emerald-900">
                                                    Atendimento Livre na Fila
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-emerald-700/90 leading-tight">
                                                Nenhum operador está atendendo no momento.
                                            </p>
                                            <Button
                                                onClick={handleStartAttendance}
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-xl shadow-xs gap-1.5 transition"
                                            >
                                                <UserCheck className="w-4 h-4" /> Iniciar Atendimento
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="bg-white border border-slate-200 p-3 rounded-2xl shadow-2xs space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-xl bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                                                        {ticket.assignee?.name?.charAt(0) || "👤"}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-900">
                                                            {isAssignedToMe ? "Você (Responsável)" : ticket.assignee?.name}
                                                        </div>
                                                        <span className="text-[10px] text-emerald-600 font-medium">● Em Atendimento</span>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => setShowTransferSelect(!showTransferSelect)}
                                                    className="text-[10px] text-slate-500 hover:text-slate-800 font-bold px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 transition"
                                                    title="Transferir para outro atendente"
                                                >
                                                    Transferir
                                                </button>
                                            </div>

                                            {showTransferSelect && (
                                                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                                                    <label className="text-[10px] font-bold text-slate-500">Selecione o novo atendente:</label>
                                                    <select
                                                        onChange={(e) => handleTransfer(e.target.value)}
                                                        className="w-full h-8 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2 focus:ring-1 focus:ring-emerald-500"
                                                        defaultValue=""
                                                    >
                                                        <option value="" disabled>Escolha um operador...</option>
                                                        {usersList.map((u: any) => (
                                                            <option key={u.id} value={u.id}>{u.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* SELETOR DE ETAPA DO PIPELINE */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                        ETAPA NO PIPELINE
                                    </label>
                                    <select
                                        value={ticket.stageId}
                                        onChange={(e) => handleChangeStage(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-2xs"
                                    >
                                        {availableStages.map((stg) => (
                                            <option key={stg.id} value={stg.id}>
                                                {stg.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Ações Rápidas no Rodapé Lateral */}
                            <div className="space-y-2 pt-3 border-t border-slate-200">
                                <Button
                                    onClick={() => setShowQuickReplies(true)}
                                    variant="outline"
                                    className="w-full text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200/80 text-xs font-bold justify-start rounded-xl gap-2 shadow-2xs"
                                >
                                    <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" /> Templates / Respostas Rápidas
                                </Button>
                                <Button
                                    onClick={() => setShowScheduleAct(true)}
                                    variant="outline"
                                    className="w-full text-slate-700 bg-white hover:bg-slate-100 border-slate-200 text-xs font-bold justify-start rounded-xl gap-2 shadow-2xs"
                                >
                                    <Calendar className="w-3.5 h-3.5 text-slate-500" /> Agendar Retorno / Lembrete
                                </Button>
                                <Button
                                    onClick={() => setShowCloseModal(true)}
                                    variant="outline"
                                    className="w-full text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200 text-xs font-bold justify-start rounded-xl gap-2 shadow-2xs"
                                >
                                    <Lock className="w-3.5 h-3.5 text-rose-600" /> Encerrar Atendimento
                                </Button>
                            </div>
                        </div>

                        {/* COLUNA DIREITA: CHAT AO VIVO WHATSAPP WASELLER */}
                        <div className="flex-1 flex flex-col bg-[#efeae2] relative overflow-hidden text-slate-900">
                            {/* Top Bar do Chat */}
                            <div className="h-14 bg-[#f0f2f5] border-b border-slate-300 px-4 flex items-center justify-between z-10 shadow-2xs gap-3 flex-shrink-0">
                                <div className="flex items-center gap-1.5 bg-slate-200/80 p-0.5 rounded-xl">
                                    <button
                                        onClick={() => setActiveTab("chat")}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                                            activeTab === "chat" ? "bg-white text-emerald-700 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                                        }`}
                                    >
                                        💬 Chat ({ticket.messages?.length || 0})
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("notes")}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                                            activeTab === "notes" ? "bg-white text-emerald-700 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                                        }`}
                                    >
                                        📝 Notas ({ticket.notes?.length || 0})
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("activities")}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                                            activeTab === "activities" ? "bg-white text-amber-700 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                                        }`}
                                    >
                                        📅 Lembretes ({ticket.activities?.length || 0})
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Botão Sincronizar Histórico 30 Dias */}
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleSyncHistory}
                                        disabled={syncingHistory}
                                        className="h-8 text-xs font-bold gap-1 bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl"
                                        title="Sincronizar mensagens dos últimos 30 dias diretamente do WhatsApp"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${syncingHistory ? "animate-spin" : ""}`} />
                                        <span>{syncingHistory ? "Puxando..." : "Puxar 30 Dias"}</span>
                                    </Button>

                                    {/* Botão Fechar Modal X */}
                                    <button
                                        onClick={onClose}
                                        className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold transition cursor-pointer"
                                        title="Fechar Modal"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Papel de Parede Oficial do WhatsApp */}
                            <div
                                className="absolute inset-0 top-14 bottom-14 bg-[#efeae2] bg-repeat opacity-95 pointer-events-none z-0"
                                style={{ backgroundImage: `url('/whatsapp-bg-official.png')`, backgroundSize: '500px 380px' }}
                            />

                            {/* CHAT MESSAGES */}
                            {activeTab === "chat" && (
                                <div className="flex-1 flex flex-col overflow-hidden relative z-10">
                                    <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                                        {ticket.messages?.map((msg: any) => {
                                            const isAttendant = msg.senderType === "ATTENDANT" || msg.fromMe === true;
                                            const isSystem = msg.senderType === "SYSTEM";

                                            if (isSystem) {
                                                return (
                                                    <div key={msg.id} className="flex justify-center my-2">
                                                        <div className="bg-amber-100/90 text-amber-900 border border-amber-200/80 text-[10px] font-bold px-3 py-1 rounded-full shadow-2xs text-center">
                                                            {msg.content}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={msg.id} className={`flex ${isAttendant ? "justify-end" : "justify-start"}`}>
                                                    <div className={`max-w-[75%] p-2.5 rounded-2xl shadow-2xs text-xs ${isAttendant ? "bg-[#d9fdd3] text-slate-900 rounded-tr-xs" : "bg-white text-slate-900 rounded-tl-xs"}`}>
                                                        {isAttendant && msg.senderName && (
                                                            <div className="text-[10px] font-extrabold text-emerald-800 mb-0.5 border-b border-emerald-500/20 pb-0.5">
                                                                👤 {msg.senderName}
                                                            </div>
                                                        )}

                                                        {!isAttendant && isGroupTicket && msg.senderName && (
                                                            <div className="text-[10px] font-extrabold text-slate-700 mb-0.5">
                                                                {msg.senderName}
                                                            </div>
                                                        )}

                                                        {/* Visualização de Imagem */}
                                                        {msg.mediaUrl && (msg.messageType === "IMAGE" || msg.mediaUrl.match(/\.(jpg|jpeg|png|webp)/i)) && (
                                                            <img src={msg.mediaUrl} alt="" className="max-w-xs rounded-xl mb-1.5 max-h-60 object-cover border border-slate-200" />
                                                        )}

                                                        {/* Visualização de Documentos (PDF, Word, Excel, ZIP) */}
                                                        {msg.messageType === "DOCUMENT" && msg.mediaUrl && (() => {
                                                            const fileName = msg.mediaFileName || "documento";
                                                            const ext = fileName.split(".").pop()?.toLowerCase() || "pdf";
                                                            const badgeBg = ext === "pdf" ? "bg-rose-600" : ["xls", "xlsx", "csv"].includes(ext) ? "bg-emerald-600" : "bg-slate-700";

                                                            return (
                                                                <div className="flex items-center gap-2.5 p-2 bg-slate-100/90 rounded-xl mb-1.5 border border-slate-200 shadow-2xs">
                                                                    <div className={`w-8 h-8 rounded-lg ${badgeBg} text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0`}>
                                                                        {ext.toUpperCase()}
                                                                    </div>
                                                                    <div className="overflow-hidden flex-1 min-w-0">
                                                                        <span className="font-bold text-slate-800 block truncate text-xs" title={fileName}>
                                                                            {fileName}
                                                                        </span>
                                                                    </div>
                                                                    <a
                                                                        href={msg.mediaUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        download={fileName}
                                                                        className="text-xs bg-slate-800 hover:bg-slate-900 text-white font-bold px-2.5 py-1 rounded-lg transition"
                                                                    >
                                                                        Baixar
                                                                    </a>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Áudio Player */}
                                                        {msg.messageType === "AUDIO" && (
                                                            <div className="my-1 p-2 bg-slate-100 rounded-xl border border-slate-200 space-y-1">
                                                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                                                                    <span>🎙️ Mensagem de Voz</span>
                                                                    {msg.mediaUrl && (
                                                                        <a
                                                                            href={msg.mediaUrl.startsWith("http") ? `/api/whatsapp/media-proxy?url=${encodeURIComponent(msg.mediaUrl)}` : msg.mediaUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            download="audio.ogg"
                                                                            className="text-[10px] text-emerald-600 font-bold hover:underline"
                                                                        >
                                                                            Baixar
                                                                        </a>
                                                                    )}
                                                                </div>
                                                                {msg.mediaUrl && (
                                                                    <audio controls src={msg.mediaUrl.startsWith("http") ? `/api/whatsapp/media-proxy?url=${encodeURIComponent(msg.mediaUrl)}` : msg.mediaUrl} className="w-full h-8 rounded-md" />
                                                                )}
                                                            </div>
                                                        )}

                                                        {msg.content && !msg.content.startsWith("📎 ") && (
                                                            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                                        )}

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

                                    {/* BARRA DE DIGITAÇÃO E COMPOSER WASELLER */}
                                    <div className="bg-[#f0f2f5] border-t border-slate-300 p-2.5 flex flex-col gap-1.5 z-20">
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

                                        {isRecording ? (
                                            <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-xl px-4 py-2 text-rose-800 animate-pulse">
                                                <span className="text-xs font-bold font-mono">
                                                    🔴 Gravando: {recordingTime}s
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <Button size="sm" variant="ghost" onClick={() => handleStopRecording(false)} className="h-7 text-xs font-bold">
                                                        Cancelar
                                                    </Button>
                                                    <Button size="sm" onClick={() => handleStopRecording(true)} className="h-7 text-xs font-bold bg-emerald-600 text-white">
                                                        Enviar Áudio
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="*/*" />
                                                <button
                                                    type="button"
                                                    className="text-slate-500 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-200 transition cursor-pointer"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    title="Anexar arquivo"
                                                >
                                                    <Paperclip className="w-4 h-4" />
                                                </button>

                                                <button
                                                    type="button"
                                                    className="text-slate-500 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition cursor-pointer"
                                                    onClick={handleStartRecording}
                                                    title="Gravar áudio"
                                                >
                                                    <Mic className="w-4 h-4" />
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
                                                    placeholder="Digite sua mensagem para o colaborador..."
                                                    className="flex-1 text-xs resize-none h-10 min-h-[40px] bg-white border-none rounded-xl px-3 py-2.5 shadow-2xs focus:ring-1 focus:ring-emerald-500"
                                                />

                                                <Button
                                                    onClick={handleSendMessage}
                                                    disabled={sending || !messageText.trim()}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 w-10 p-0 rounded-xl flex items-center justify-center shadow-xs flex-shrink-0 cursor-pointer"
                                                >
                                                    <Send className="w-4 h-4 ml-0.5" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* NOTAS INTERNAS */}
                            {activeTab === "notes" && (
                                <div className="flex-1 p-5 bg-slate-100 overflow-y-auto space-y-3 relative z-10">
                                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                                        <h4 className="text-xs font-bold text-slate-800">Nova Anotação Interna</h4>
                                        <Textarea
                                            value={noteText}
                                            onChange={(e) => setNoteText(e.target.value)}
                                            placeholder="Registrar anotação interna sobre este atendimento..."
                                            className="text-xs h-20"
                                        />
                                        <div className="flex justify-end">
                                            <Button size="sm" onClick={handleAddNote} className="bg-emerald-600 text-xs font-bold rounded-xl">
                                                Salvar Nota
                                            </Button>
                                        </div>
                                    </div>
                                    {ticket.notes?.map((n: any) => (
                                        <div key={n.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                                            <div className="text-xs font-bold text-slate-800">{n.author?.name || "Atendente"}</div>
                                            <p className="text-xs text-slate-600 mt-1">{n.content}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ATIVIDADES & LEMBRETES */}
                            {activeTab === "activities" && (
                                <div className="flex-1 p-5 bg-slate-100 overflow-y-auto space-y-3 relative z-10">
                                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-800">📅 Agendar Retorno</h4>
                                            <p className="text-[11px] text-slate-500">Defina um horário para retornar o contato com este colaborador.</p>
                                        </div>
                                        <Button onClick={() => setShowScheduleAct(true)} className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs">
                                            + Novo Lembrete
                                        </Button>
                                    </div>

                                    {ticket.activities?.length === 0 ? (
                                        <div className="text-center py-8 text-xs text-slate-400">Nenhum lembrete cadastrado.</div>
                                    ) : (
                                        ticket.activities?.map((act: any) => (
                                            <div key={act.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                                                <div>
                                                    <h5 className="text-xs font-bold text-slate-800">{act.title}</h5>
                                                    <span className="text-[10px] text-amber-600 font-mono font-bold">
                                                        ⏰ {new Date(act.dueDate).toLocaleString()}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${act.completed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                                                    {act.completed ? "Concluído" : "Pendente"}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* MODAL DE AGENDAMENTO DE ATIVIDADE */}
                {showScheduleAct && ticket && (
                    <HrScheduleActivityModal
                        open={showScheduleAct}
                        ticketId={ticket.id}
                        onClose={() => setShowScheduleAct(false)}
                        onCreated={() => {
                            setShowScheduleAct(false);
                            loadDetail();
                            onUpdated?.();
                        }}
                    />
                )}

                {/* MODAL DE ENCERRAMENTO DE ATENDIMENTO */}
                {showCloseModal && ticket && (
                    <HrCloseTicketModal
                        open={showCloseModal}
                        ticket={ticket}
                        onOpenChange={setShowCloseModal}
                        onClosed={() => {
                            setShowCloseModal(false);
                            onClose();
                            onUpdated?.();
                        }}
                    />
                )}

                {/* MODAL DE RESPOSTAS RÁPIDAS */}
                <HrQuickRepliesModal
                    open={showQuickReplies}
                    onOpenChange={setShowQuickReplies}
                    onSelectReply={(text) => {
                        setMessageText(prev => prev ? `${prev}\n${text}` : text);
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}
