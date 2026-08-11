"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
    Phone, Video, Search, MoreVertical, Paperclip, Smile, Mic, Send,
    Calendar, StickyNote, Tag, UserCheck, ArrowRightLeft, CheckCheck, Clock, ShieldCheck, X
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
    refreshContactInfo
} from "@/actions/hr-attendance";
import { HrScheduleMessageModal } from "./HrScheduleMessageModal";
import { HrScheduleActivityModal } from "./HrScheduleActivityModal";

interface Props {
    ticketId: string | null;
    onClose: () => void;
    onUpdated?: () => void;
    availableUsers?: any[];
    availableLabels?: any[];
    availableStages?: any[];
}

export function HrTicketModal({ ticketId, onClose, onUpdated, availableUsers = [], availableLabels = [], availableStages = [] }: Props) {
    const [ticket, setTicket] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"chat" | "notes" | "activities" | "attachments">("chat");

    const [messageText, setMessageText] = useState("");
    const [sending, setSending] = useState(false);
    const [stamp, setStamp] = useState("");
    const [showStampInput, setShowStampInput] = useState(false);

    const [isEditingContact, setIsEditingContact] = useState(false);
    const [contactNameInput, setContactNameInput] = useState("");
    const [contactPhoneInput, setContactPhoneInput] = useState("");

    const [showScheduleMsg, setShowScheduleMsg] = useState(false);
    const [showScheduleAct, setShowScheduleAct] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferTargetUser, setTransferTargetUser] = useState("");
    const [transferReason, setTransferReason] = useState("");

    const [noteText, setNoteText] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const loadDetail = useCallback(async () => {
        if (!ticketId) return;
        const res = await getHrTicketDetail(ticketId);
        if (res) {
            setTicket(res);
            setContactNameInput(res.contactName);
            setContactPhoneInput(res.contactPhone);
            setStamp(res.attendantStamp || "");
            markHrTicketRead(ticketId);
        }
        setLoading(false);
    }, [ticketId]);

    useEffect(() => {
        if (ticketId) {
            setLoading(true);
            loadDetail();
            refreshContactInfo(ticketId);
        }
    }, [ticketId, loadDetail]);

    // Polling a cada 3s para mensagens em tempo real
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
        }, 3000);

        return () => clearInterval(interval);
    }, [ticketId, ticket?.messages]);

    useEffect(() => {
        if (activeTab === "chat") {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [ticket?.messages, activeTab]);

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
            senderName: "Você",
            content: textToSend,
            status: "SENDING",
            createdAt: new Date().toISOString()
        };

        setTicket((prev: any) => ({
            ...prev,
            messages: [...(prev?.messages || []), tempMsg]
        }));

        try {
            const res = await sendHrWhatsAppMessage({
                ticketId: ticket.id,
                phone: ticket.contactPhone,
                message: textToSend,
                stamp: stamp || undefined
            });

            if (res.message) {
                setTicket((prev: any) => ({
                    ...prev,
                    messages: prev.messages.map((m: any) => m.id === tempId ? res.message : m)
                }));
            }
            onUpdated?.();
        } finally {
            setSending(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !ticket) return;

        setSending(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });

            if (uploadRes.ok) {
                const { url } = await uploadRes.json();
                await sendHrWhatsAppFile({
                    ticketId: ticket.id,
                    phone: ticket.contactPhone,
                    fileUrl: url,
                    fileName: file.name,
                    mimeType: file.type
                });
                loadDetail();
                onUpdated?.();
            }
        } finally {
            setSending(false);
        }
    };

    const handleSaveContact = async () => {
        if (!ticket) return;
        await updateContactInfo(ticket.id, { name: contactNameInput, phone: contactPhoneInput });
        setIsEditingContact(false);
        setTicket((prev: any) => ({ ...prev, contactName: contactNameInput, contactPhone: contactPhoneInput }));
        onUpdated?.();
    };

    const handleSaveStamp = async () => {
        if (!ticket) return;
        await updateTicketStamp(ticket.id, stamp);
        setShowStampInput(false);
        setTicket((prev: any) => ({ ...prev, attendantStamp: stamp }));
    };

    const handleAssume = async () => {
        if (!ticket) return;
        await assumeHrTicket(ticket.id);
        loadDetail();
        onUpdated?.();
    };

    const handleTransfer = async () => {
        if (!ticket || !transferTargetUser) return;
        await transferHrTicket(ticket.id, transferTargetUser, transferReason);
        setShowTransferModal(false);
        loadDetail();
        onUpdated?.();
    };

    const handleCloseTicket = async () => {
        if (!ticket) return;
        if (confirm("Deseja realmente encerrar este atendimento?")) {
            await closeHrTicket(ticket.id);
            onUpdated?.();
            onClose();
        }
    };

    const handleAddNote = async () => {
        if (!ticket || !noteText.trim()) return;
        const res = await addHrTicketNote(ticket.id, noteText.trim());
        if (res.note) {
            setNoteText("");
            setTicket((prev: any) => ({ ...prev, notes: [...prev.notes, res.note] }));
        }
    };

    const handleToggleLabel = async (labelId: string) => {
        if (!ticket) return;
        const hasLabel = ticket.labels.some((l: any) => l.id === labelId);
        await applyLabelToTicket(ticket.id, labelId, !hasLabel);
        loadDetail();
        onUpdated?.();
    };

    const handleChangeStage = async (stageId: string) => {
        if (!ticket) return;
        await updateHrTicketStage(ticket.id, stageId);
        loadDetail();
        onUpdated?.();
    };

    if (!ticketId) return null;

    return (
        <Dialog open={!!ticketId} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-6xl h-[92vh] p-0 flex flex-col overflow-hidden bg-slate-900 border-none rounded-2xl shadow-2xl">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                        Carregando atendimento...
                    </div>
                ) : !ticket ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                        Atendimento não encontrado.
                    </div>
                ) : (
                    <div className="flex flex-1 overflow-hidden">
                        {/* PAINEL ESQUERDO: Info & Controles */}
                        <div className="w-80 border-r border-slate-800 bg-slate-950 text-slate-200 flex flex-col overflow-y-auto">
                            {/* Profile Header */}
                            <div className="p-4 border-b border-slate-800 bg-slate-900/50 text-center">
                                <div className="relative inline-block mb-3">
                                    {ticket.contactPhotoUrl ? (
                                        <img
                                            src={ticket.contactPhotoUrl}
                                            alt={ticket.contactName}
                                            className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500 shadow-lg"
                                        />
                                    ) : (
                                        <div className="w-20 h-20 rounded-full bg-slate-700 text-white font-bold text-2xl flex items-center justify-center shadow-lg">
                                            {ticket.contactName?.charAt(0).toUpperCase() || "?"}
                                        </div>
                                    )}
                                </div>

                                {isEditingContact ? (
                                    <div className="space-y-2 text-left bg-slate-800 p-2.5 rounded-lg border border-slate-700">
                                        <Input
                                            value={contactNameInput}
                                            onChange={(e) => setContactNameInput(e.target.value)}
                                            placeholder="Nome do Contato"
                                            className="text-xs h-7 bg-slate-900 border-slate-700 text-white"
                                        />
                                        <Input
                                            value={contactPhoneInput}
                                            onChange={(e) => setContactPhoneInput(e.target.value)}
                                            placeholder="Telefone"
                                            className="text-xs h-7 font-mono bg-slate-900 border-slate-700 text-white"
                                        />
                                        <div className="flex justify-end gap-1 pt-1">
                                            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-slate-400" onClick={() => setIsEditingContact(false)}>Cancelar</Button>
                                            <Button size="sm" className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveContact}>Salvar</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="flex items-center justify-center gap-1.5">
                                            <h3 className="font-bold text-sm text-white">{ticket.contactName}</h3>
                                            <button
                                                onClick={() => setIsEditingContact(true)}
                                                className="text-[10px] text-slate-400 hover:text-emerald-400"
                                                title="Editar Contato"
                                            >
                                                ✏️
                                            </button>
                                        </div>
                                        <p className="text-xs font-mono text-emerald-400">{ticket.contactPhone}</p>
                                        {ticket.employee && (
                                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-semibold">
                                                <ShieldCheck className="w-3 h-3" /> Colaborador Cadastrado
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Etapa no Pipeline */}
                            <div className="p-3.5 border-b border-slate-800">
                                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Etapa no Pipeline</label>
                                <select
                                    value={ticket.stageId}
                                    onChange={(e) => handleChangeStage(e.target.value)}
                                    className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-700 bg-slate-900 text-white"
                                >
                                    {availableStages.map((st: any) => (
                                        <option key={st.id} value={st.id}>{st.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Atendente Responsável */}
                            <div className="p-3.5 border-b border-slate-800">
                                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Atendente Responsável</label>
                                {ticket.assignee ? (
                                    <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
                                        <span className="text-xs font-semibold text-white">👤 {ticket.assignee.name}</span>
                                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-emerald-400 hover:bg-emerald-500/10" onClick={() => setShowTransferModal(true)}>
                                            <ArrowRightLeft className="w-3 h-3 mr-1" /> Transferir
                                        </Button>
                                    </div>
                                ) : (
                                    <Button size="sm" className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" onClick={handleAssume}>
                                        <UserCheck className="w-3.5 h-3.5 mr-1.5" /> Assumir Atendimento
                                    </Button>
                                )}
                            </div>

                            {/* Etiquetas */}
                            <div className="p-3.5 border-b border-slate-800">
                                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Etiquetas</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {availableLabels.map((lbl: any) => {
                                        const active = ticket.labels.some((l: any) => l.id === lbl.id);
                                        return (
                                            <button
                                                key={lbl.id}
                                                onClick={() => handleToggleLabel(lbl.id)}
                                                className={`text-[10px] px-2 py-0.5 rounded-full border transition ${active ? "text-white font-bold shadow-sm" : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"}`}
                                                style={{ backgroundColor: active ? lbl.color : undefined }}
                                            >
                                                {active ? "✓ " : ""}{lbl.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Carimbo do Atendente */}
                            <div className="p-3.5 border-b border-slate-800">
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Carimbo do Atendente</label>
                                    <button onClick={() => setShowStampInput(!showStampInput)} className="text-[10px] text-emerald-400 hover:underline">
                                        {showStampInput ? "Fechar" : "Configurar"}
                                    </button>
                                </div>
                                {showStampInput ? (
                                    <div className="space-y-1.5">
                                        <Textarea
                                            value={stamp}
                                            onChange={(e) => setStamp(e.target.value)}
                                            placeholder="Ex: *Atendente Késia (RH JVS)*"
                                            className="text-xs h-16 bg-slate-900 border-slate-700 text-white"
                                        />
                                        <Button size="sm" className="w-full h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveStamp}>Salvar Carimbo</Button>
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-slate-300 bg-slate-900 p-2 rounded-lg border border-slate-800 italic">
                                        {ticket.attendantStamp || <span className="text-slate-500">Nenhum carimbo ativo</span>}
                                    </div>
                                )}
                            </div>

                            {/* Botões de Ação Rápida */}
                            <div className="p-3.5 space-y-2 mt-auto">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs border-slate-800 text-emerald-400 bg-slate-900 hover:bg-slate-800 justify-start gap-2"
                                    onClick={() => setShowScheduleMsg(true)}
                                >
                                    <Clock className="w-3.5 h-3.5" /> Agendar Mensagem (WhatsApp)
                                </Button>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs border-slate-800 text-amber-400 bg-slate-900 hover:bg-slate-800 justify-start gap-2"
                                    onClick={() => setShowScheduleAct(true)}
                                >
                                    <Calendar className="w-3.5 h-3.5" /> Agendar Retorno / Atividade
                                </Button>

                                {ticket.status === "OPEN" && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 justify-start gap-2"
                                        onClick={handleCloseTicket}
                                    >
                                        ✓ Concluir / Encerrar Atendimento
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* PAINEL DIREITO: WhatsApp Web Real Interface */}
                        <div className="flex-1 flex flex-col bg-[#efeae2] relative overflow-hidden">
                            {/* WhatsApp Header Bar */}
                            <div className="h-16 bg-[#f0f2f5] border-b border-slate-300 px-4 flex items-center justify-between z-10 shadow-sm">
                                <div className="flex items-center gap-3">
                                    {ticket.contactPhotoUrl ? (
                                        <img src={ticket.contactPhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover border" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-slate-700 text-white font-bold text-sm flex items-center justify-center">
                                            {ticket.contactName?.charAt(0).toUpperCase() || "?"}
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800 leading-tight">{ticket.contactName}</h3>
                                        <span className="text-[11px] text-slate-500 font-mono">{ticket.contactPhone}</span>
                                    </div>
                                </div>

                                {/* Abas de navegação + Botão Fechar X */}
                                <div className="flex items-center gap-2">
                                    <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1">
                                        <button
                                            onClick={() => setActiveTab("chat")}
                                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${activeTab === "chat" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                                        >
                                            💬 Chat ({ticket.messages?.length || 0})
                                        </button>
                                        <button
                                            onClick={() => setActiveTab("notes")}
                                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${activeTab === "notes" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                                        >
                                            📝 Notas ({ticket.notes?.length || 0})
                                        </button>
                                        <button
                                            onClick={() => setActiveTab("activities")}
                                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${activeTab === "activities" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                                        >
                                            📌 Tarefas ({ticket.activities?.length || 0})
                                        </button>
                                    </div>

                                    {/* Botão Fechar X bem destacado */}
                                    <button
                                        onClick={onClose}
                                        className="w-8 h-8 rounded-full bg-slate-300/70 hover:bg-red-500 hover:text-white text-slate-700 flex items-center justify-center transition shadow-sm font-bold ml-2 cursor-pointer"
                                        title="Fechar Atendimento (ESC)"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>


                            {/* TAB: CHAT WHATSAPP REAL */}
                            {activeTab === "chat" && (
                                <div className="flex-1 flex flex-col overflow-hidden bg-[#efeae2]">
                                    {/* Messages Feed (Papel de parede WhatsApp) */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                                        {ticket.messages?.map((msg: any) => {
                                            const isAttendant = msg.senderType === "ATTENDANT";
                                            const isSystem = msg.senderType === "SYSTEM";

                                            if (isSystem) {
                                                return (
                                                    <div key={msg.id} className="flex justify-center my-2">
                                                        <span className="text-[10px] bg-slate-200/90 text-slate-600 px-3 py-1 rounded-lg shadow-sm font-medium">
                                                            {msg.content}
                                                        </span>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div
                                                    key={msg.id}
                                                    className={`flex ${isAttendant ? "justify-end" : "justify-start"}`}
                                                >
                                                    <div
                                                        className={`max-w-[70%] p-2.5 rounded-lg shadow-sm relative text-xs ${
                                                            isAttendant
                                                                ? "bg-[#d9fdd3] text-slate-900 rounded-tr-none"
                                                                : "bg-white text-slate-900 rounded-tl-none"
                                                        }`}
                                                    >
                                                        {/* Mídia */}
                                                        {msg.mediaUrl && msg.messageType === "IMAGE" && (
                                                            <img src={msg.mediaUrl} alt="" className="max-w-xs rounded-lg mb-2 max-h-60 object-cover" />
                                                        )}

                                                        {msg.mediaUrl && msg.messageType === "DOCUMENT" && (
                                                            <a
                                                                href={msg.mediaUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-2 p-2 bg-black/5 rounded-lg mb-2 hover:bg-black/10 transition"
                                                            >
                                                                <span className="text-xl">📄</span>
                                                                <span className="font-semibold underline text-emerald-800 truncate">{msg.mediaFileName || "Baixar Documento"}</span>
                                                            </a>
                                                        )}

                                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                                                        <div className="flex items-center justify-end gap-1 text-[9px] text-slate-500 mt-1 font-mono">
                                                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            {isAttendant && (
                                                                <CheckCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Barra de Digitação estilo WhatsApp Web */}
                                    <div className="h-16 bg-[#f0f2f5] border-t border-slate-300 px-4 flex items-center gap-3">
                                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

                                        <button
                                            type="button"
                                            className="text-slate-500 hover:text-slate-700 transition"
                                            onClick={() => fileInputRef.current?.click()}
                                            title="Anexar Arquivo"
                                        >
                                            <Paperclip className="w-5 h-5" />
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
                                            placeholder="Digite uma mensagem..."
                                            className="flex-1 text-xs resize-none h-10 min-h-[40px] bg-white border-none rounded-xl px-4 py-2.5 focus-visible:ring-1 focus-visible:ring-emerald-500 shadow-sm"
                                        />

                                        <Button
                                            onClick={handleSendMessage}
                                            disabled={sending || !messageText.trim()}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 w-10 p-0 rounded-full flex items-center justify-center shadow-md"
                                        >
                                            <Send className="w-4 h-4 ml-0.5" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* TAB: ANOTAÇÕES */}
                            {activeTab === "notes" && (
                                <div className="flex-1 p-6 bg-slate-100 overflow-y-auto space-y-4">
                                    <div className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
                                        <h4 className="text-xs font-bold text-slate-800">Nova Anotação Interna</h4>
                                        <Textarea
                                            value={noteText}
                                            onChange={(e) => setNoteText(e.target.value)}
                                            placeholder="Anotações internas sobre o atendimento..."
                                            className="text-xs h-20"
                                        />
                                        <div className="flex justify-end">
                                            <Button size="sm" onClick={handleAddNote} className="bg-emerald-600 text-xs">Salvar Nota</Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {ticket.notes?.map((n: any) => (
                                            <div key={n.id} className="bg-white p-3.5 rounded-xl border shadow-sm">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-bold text-slate-800">👤 {n.author?.name || "RH"}</span>
                                                    <span className="text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleString()}</span>
                                                </div>
                                                <p className="text-xs text-slate-600 whitespace-pre-wrap">{n.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* TAB: TAREFAS */}
                            {activeTab === "activities" && (
                                <div className="flex-1 p-6 bg-slate-100 overflow-y-auto space-y-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-xs font-bold text-slate-800">Atividades Agendadas</h4>
                                        <Button size="sm" onClick={() => setShowScheduleAct(true)} className="bg-emerald-600 text-xs">+ Nova Tarefa</Button>
                                    </div>

                                    {ticket.activities?.map((act: any) => (
                                        <div key={act.id} className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between">
                                            <div>
                                                <h5 className="text-xs font-bold text-slate-800">{act.title}</h5>
                                                <div className="text-[11px] text-emerald-600 font-semibold mt-1">Prazo: {new Date(act.dueAt).toLocaleString()}</div>
                                            </div>
                                            {!act.completedAt && (
                                                <Button size="sm" variant="outline" className="text-xs border-emerald-600 text-emerald-700" onClick={async () => { await completeHrTicketActivity(act.id); loadDetail(); }}>
                                                    Concluir
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>

            <HrScheduleMessageModal open={showScheduleMsg} onClose={() => setShowScheduleMsg(false)} ticketId={ticket?.id} contactPhone={ticket?.contactPhone} contactName={ticket?.contactName} onScheduled={loadDetail} />
            <HrScheduleActivityModal open={showScheduleAct} onClose={() => setShowScheduleAct(false)} ticketId={ticket?.id} onCreated={loadDetail} />

            {/* Transfer Modal */}
            <Dialog open={showTransferModal} onOpenChange={(o) => !o && setShowTransferModal(false)}>
                <DialogContent className="max-w-md bg-slate-900 text-white border-slate-800">
                    <h3 className="text-sm font-bold">Transferir Atendimento</h3>
                    <div className="space-y-3 py-2">
                        <select value={transferTargetUser} onChange={(e) => setTransferTargetUser(e.target.value)} className="w-full text-xs p-2 border rounded bg-slate-800 text-white border-slate-700">
                            <option value="">Selecione o atendente...</option>
                            {availableUsers.map((u: any) => (
                                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                            ))}
                        </select>
                        <Textarea value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="Motivo da transferência..." className="text-xs h-16 bg-slate-800 border-slate-700 text-white" />
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setShowTransferModal(false)}>Cancelar</Button>
                            <Button size="sm" className="bg-emerald-600" onClick={handleTransfer} disabled={!transferTargetUser}>Confirmar</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}
