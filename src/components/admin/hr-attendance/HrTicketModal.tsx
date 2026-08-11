"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
    getHrTicketDetail,
    sendHrWhatsAppMessage,
    sendHrWhatsAppFile,
    getHrTicketMessages,
    markHrTicketRead,
    assumeHrTicket,
    transferHrTicket,
    addParticipantToTicket,
    closeHrTicket,
    addHrTicketNote,
    deleteHrTicketNote,
    completeHrTicketActivity,
    applyLabelToTicket,
    updateHrTicketStage,
    updateHrTicketTitle,
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
    const [activeTab, setActiveTab] = useState<"chat" | "notes" | "activities" | "attachments" | "history">("chat");

    // Chat Inputs & State
    const [messageText, setMessageText] = useState("");
    const [sending, setSending] = useState(false);
    const [stamp, setStamp] = useState("");
    const [showStampInput, setShowStampInput] = useState(false);

    // Editing title & contact
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState("");
    const [isEditingContact, setIsEditingContact] = useState(false);
    const [contactNameInput, setContactNameInput] = useState("");
    const [contactPhoneInput, setContactPhoneInput] = useState("");

    // Sub-modals
    const [showScheduleMsg, setShowScheduleMsg] = useState(false);
    const [showScheduleAct, setShowScheduleAct] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferTargetUser, setTransferTargetUser] = useState("");
    const [transferReason, setTransferReason] = useState("");

    // Note Input
    const [noteText, setNoteText] = useState("");

    // File Upload
    const fileInputRef = useRef<HTMLInputElement>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const loadDetail = useCallback(async () => {
        if (!ticketId) return;
        const res = await getHrTicketDetail(ticketId);
        if (res) {
            setTicket(res);
            setTitleInput(res.title);
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

    // Polling a cada 3 segundos para novas mensagens do WhatsApp
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

    // Auto scroll chat
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

    const handleSaveTitle = async () => {
        if (!ticket || !titleInput.trim()) return;
        await updateHrTicketTitle(ticket.id, titleInput.trim());
        setIsEditingTitle(false);
        setTicket((prev: any) => ({ ...prev, title: titleInput.trim() }));
        onUpdated?.();
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
            <DialogContent className="max-w-5xl h-[88vh] p-0 flex flex-col overflow-hidden bg-slate-100">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                        Carregando atendimento...
                    </div>
                ) : !ticket ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                        Atendimento não encontrado ou sem permissão de acesso.
                    </div>
                ) : (
                    <div className="flex flex-1 overflow-hidden">
                        {/* PAINEL ESQUERDO: Info do Contato & Controles */}
                        <div className="w-80 border-r bg-white flex flex-col overflow-y-auto">
                            {/* Profile Header */}
                            <div className="p-4 border-b bg-slate-50/70 text-center">
                                <div className="relative inline-block mb-2">
                                    {ticket.contactPhotoUrl ? (
                                        <img
                                            src={ticket.contactPhotoUrl}
                                            alt={ticket.contactName}
                                            className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500 shadow"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xl flex items-center justify-center shadow">
                                            {ticket.contactName.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>

                                {/* Nome & Telefone com opção de Editar */}
                                {isEditingContact ? (
                                    <div className="space-y-2 text-left bg-white p-2 rounded border shadow-sm">
                                        <Input
                                            size={1}
                                            value={contactNameInput}
                                            onChange={(e) => setContactNameInput(e.target.value)}
                                            placeholder="Nome do Contato"
                                            className="text-xs h-7"
                                        />
                                        <Input
                                            size={1}
                                            value={contactPhoneInput}
                                            onChange={(e) => setContactPhoneInput(e.target.value)}
                                            placeholder="Telefone"
                                            className="text-xs h-7 font-mono"
                                        />
                                        <div className="flex justify-end gap-1 pt-1">
                                            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setIsEditingContact(false)}>Cancelar</Button>
                                            <Button size="sm" className="h-6 text-[10px] bg-indigo-600" onClick={handleSaveContact}>Salvar</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="flex items-center justify-center gap-1">
                                            <h3 className="font-bold text-sm text-slate-800">{ticket.contactName}</h3>
                                            <button
                                                onClick={() => setIsEditingContact(true)}
                                                className="text-[10px] text-slate-400 hover:text-indigo-600"
                                                title="Editar Nome do Contato"
                                            >
                                                ✏️
                                            </button>
                                        </div>
                                        <p className="text-xs font-mono text-slate-500">{ticket.contactPhone}</p>
                                        {ticket.employee && (
                                            <span className="inline-block mt-1 text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                                                ✓ Colaborador Cadastrado
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Título da Solicitação */}
                            <div className="p-3 border-b">
                                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Solicitação / Assunto</label>
                                {isEditingTitle ? (
                                    <div className="flex gap-1">
                                        <Input
                                            value={titleInput}
                                            onChange={(e) => setTitleInput(e.target.value)}
                                            className="text-xs h-7"
                                        />
                                        <Button size="sm" className="h-7 text-xs bg-indigo-600" onClick={handleSaveTitle}>OK</Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between group">
                                        <span className="text-xs font-medium text-slate-700">{ticket.title}</span>
                                        <button onClick={() => setIsEditingTitle(true)} className="text-[10px] text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100">✏️</button>
                                    </div>
                                )}
                            </div>

                            {/* Etapa do Pipeline */}
                            <div className="p-3 border-b">
                                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Etapa no Pipeline</label>
                                <select
                                    value={ticket.stageId}
                                    onChange={(e) => handleChangeStage(e.target.value)}
                                    className="w-full text-xs font-semibold p-1.5 rounded border bg-slate-50 text-slate-800"
                                >
                                    {availableStages.map((st: any) => (
                                        <option key={st.id} value={st.id}>{st.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Atendente Responsável */}
                            <div className="p-3 border-b">
                                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Atendente Responsável</label>
                                {ticket.assignee ? (
                                    <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-100 p-2 rounded">
                                        <span className="text-xs font-semibold text-indigo-900">👤 {ticket.assignee.name}</span>
                                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-indigo-600" onClick={() => setShowTransferModal(true)}>
                                            Transferir
                                        </Button>
                                    </div>
                                ) : (
                                    <Button size="sm" className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAssume}>
                                        ✋ Assumir Atendimento
                                    </Button>
                                )}
                            </div>

                            {/* Etiquetas */}
                            <div className="p-3 border-b">
                                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Etiquetas</label>
                                <div className="flex flex-wrap gap-1">
                                    {availableLabels.map((lbl: any) => {
                                        const active = ticket.labels.some((l: any) => l.id === lbl.id);
                                        return (
                                            <button
                                                key={lbl.id}
                                                onClick={() => handleToggleLabel(lbl.id)}
                                                className={`text-[10px] px-2 py-0.5 rounded-full border transition ${active ? "text-white font-bold shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                                                style={{ backgroundColor: active ? lbl.color : undefined }}
                                            >
                                                {active ? "✓ " : ""}{lbl.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Carimbo do Atendente */}
                            <div className="p-3 border-b">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Carimbo do Atendente</label>
                                    <button onClick={() => setShowStampInput(!showStampInput)} className="text-[10px] text-indigo-600 hover:underline">
                                        {showStampInput ? "Fechar" : "Configurar"}
                                    </button>
                                </div>
                                {showStampInput ? (
                                    <div className="space-y-1">
                                        <Textarea
                                            value={stamp}
                                            onChange={(e) => setStamp(e.target.value)}
                                            placeholder="Ex: *Atendente Késia (RH JVS)*"
                                            className="text-xs h-16"
                                        />
                                        <Button size="sm" className="w-full h-6 text-[10px] bg-indigo-600" onClick={handleSaveStamp}>Salvar Carimbo</Button>
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border italic">
                                        {ticket.attendantStamp || <span className="text-slate-400">Nenhum carimbo ativo</span>}
                                    </div>
                                )}
                            </div>

                            {/* Botões de Ação Rápida */}
                            <div className="p-3 space-y-2 mt-auto">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 justify-start gap-2"
                                    onClick={() => setShowScheduleMsg(true)}
                                >
                                    ⏰ Agendar Mensagem (WhatsApp)
                                </Button>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs border-amber-200 text-amber-700 bg-amber-50/50 hover:bg-amber-100 justify-start gap-2"
                                    onClick={() => setShowScheduleAct(true)}
                                >
                                    📌 Agendar Retorno / Atividade
                                </Button>

                                {ticket.status === "OPEN" && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs border-red-200 text-red-600 hover:bg-red-50 justify-start gap-2"
                                        onClick={handleCloseTicket}
                                    >
                                        ✅ Concluir / Encerrar Atendimento
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* PAINEL DIREITO: Abas (Chat, Anotações, Atividades, Documentos) */}
                        <div className="flex-1 flex flex-col bg-white">
                            {/* Top Navigation Tabs */}
                            <div className="flex border-b bg-slate-50 px-4 pt-2 gap-2">
                                <button
                                    onClick={() => setActiveTab("chat")}
                                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${activeTab === "chat" ? "border-indigo-600 text-indigo-600 bg-white rounded-t" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                                >
                                    💬 Conversa WhatsApp ({ticket.messages?.length || 0})
                                </button>
                                <button
                                    onClick={() => setActiveTab("notes")}
                                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${activeTab === "notes" ? "border-indigo-600 text-indigo-600 bg-white rounded-t" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                                >
                                    📝 Anotações Internas ({ticket.notes?.length || 0})
                                </button>
                                <button
                                    onClick={() => setActiveTab("activities")}
                                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${activeTab === "activities" ? "border-indigo-600 text-indigo-600 bg-white rounded-t" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                                >
                                    📌 Atividades ({ticket.activities?.length || 0})
                                </button>
                                <button
                                    onClick={() => setActiveTab("attachments")}
                                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${activeTab === "attachments" ? "border-indigo-600 text-indigo-600 bg-white rounded-t" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                                >
                                    📎 Documentos ({ticket.attachments?.length || 0})
                                </button>
                            </div>

                            {/* TAB CONTENT: CHAT */}
                            {activeTab === "chat" && (
                                <div className="flex-1 flex flex-col overflow-hidden bg-[#efeae2]">
                                    {/* Messages Feed (Estilo WhatsApp) */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                        {ticket.messages?.map((msg: any) => {
                                            const isAttendant = msg.senderType === "ATTENDANT";
                                            const isSystem = msg.senderType === "SYSTEM";

                                            if (isSystem) {
                                                return (
                                                    <div key={msg.id} className="flex justify-center my-2">
                                                        <span className="text-[10px] bg-slate-200/80 text-slate-600 px-3 py-1 rounded-full shadow-sm font-medium">
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
                                                        className={`max-w-[75%] p-3 rounded-lg shadow-sm relative text-xs ${
                                                            isAttendant
                                                                ? "bg-[#d9fdd3] text-slate-900 rounded-tr-none"
                                                                : "bg-white text-slate-900 rounded-tl-none"
                                                        }`}
                                                    >
                                                        <div className="text-[10px] font-bold text-slate-500 mb-1">
                                                            {msg.senderName}
                                                        </div>

                                                        {/* Imagem / Mídia */}
                                                        {msg.mediaUrl && msg.messageType === "IMAGE" && (
                                                            <img
                                                                src={msg.mediaUrl}
                                                                alt="Anexo"
                                                                className="max-w-xs rounded mb-2 max-h-60 object-cover"
                                                            />
                                                        )}

                                                        {/* Documento / PDF */}
                                                        {msg.mediaUrl && msg.messageType === "DOCUMENT" && (
                                                            <a
                                                                href={msg.mediaUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-2 p-2 bg-black/5 rounded mb-2 hover:bg-black/10 transition"
                                                            >
                                                                <span className="text-xl">📄</span>
                                                                <span className="font-semibold underline text-indigo-700 truncate">{msg.mediaFileName || "Baixar Documento"}</span>
                                                            </a>
                                                        )}

                                                        {/* Texto da Mensagem */}
                                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                                                        {/* Timestamp */}
                                                        <div className="text-[9px] text-slate-400 text-right mt-1 font-mono">
                                                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            {isAttendant && (
                                                                <span className="ml-1">
                                                                    {msg.status === "SENT" ? "✓" : msg.status === "SENDING" ? "⏳" : "✓✓"}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Input Footer */}
                                    <div className="p-3 bg-slate-50 border-t flex items-center gap-2">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-9 w-9 p-0 text-slate-500 hover:bg-slate-200 rounded-full"
                                            onClick={() => fileInputRef.current?.click()}
                                            title="Anexar Arquivo ou Documento"
                                        >
                                            📎
                                        </Button>

                                        <Textarea
                                            value={messageText}
                                            onChange={(e) => setMessageText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage();
                                                }
                                            }}
                                            placeholder="Digite sua resposta no WhatsApp..."
                                            className="flex-1 text-xs resize-none h-10 min-h-[40px] max-h-24 bg-white"
                                        />

                                        <Button
                                            onClick={handleSendMessage}
                                            disabled={sending || !messageText.trim()}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-4 text-xs font-semibold"
                                        >
                                            {sending ? "Enviando..." : "Enviar ➔"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* TAB CONTENT: ANOTAÇÕES INTERNAS */}
                            {activeTab === "notes" && (
                                <div className="flex-1 flex flex-col p-4 bg-slate-50 overflow-y-auto">
                                    <div className="bg-white p-3 rounded-lg border shadow-sm mb-4 space-y-2">
                                        <h4 className="text-xs font-bold text-slate-700">Adicionar Anotação Interna (Visível apenas para o time do RH)</h4>
                                        <Textarea
                                            value={noteText}
                                            onChange={(e) => setNoteText(e.target.value)}
                                            placeholder="Escreva detalhes sobre o atendimento, histórico de ligações, acordos..."
                                            className="text-xs h-20"
                                        />
                                        <div className="flex justify-end">
                                            <Button size="sm" onClick={handleAddNote} className="bg-indigo-600 text-xs">Salvar Anotação</Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {ticket.notes?.map((n: any) => (
                                            <div key={n.id} className="bg-white p-3 rounded-lg border shadow-sm">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-bold text-slate-800">👤 {n.author?.name || "Atendente"}</span>
                                                    <span className="text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleString()}</span>
                                                </div>
                                                <p className="text-xs text-slate-600 whitespace-pre-wrap">{n.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* TAB CONTENT: ATIVIDADES AGENDADAS */}
                            {activeTab === "activities" && (
                                <div className="flex-1 p-4 bg-slate-50 overflow-y-auto space-y-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-xs font-bold text-slate-700">Tarefas e Prazos do Atendimento</h4>
                                        <Button size="sm" onClick={() => setShowScheduleAct(true)} className="bg-indigo-600 text-xs">+ Nova Atividade</Button>
                                    </div>

                                    {ticket.activities?.map((act: any) => (
                                        <div key={act.id} className="bg-white p-3 rounded-lg border shadow-sm flex items-center justify-between">
                                            <div>
                                                <h5 className="text-xs font-bold text-slate-800">{act.title}</h5>
                                                {act.description && <p className="text-xs text-slate-500">{act.description}</p>}
                                                <div className="text-[10px] text-indigo-600 mt-1 font-semibold">
                                                    Prazo: {new Date(act.dueAt).toLocaleString()}
                                                </div>
                                            </div>
                                            <div>
                                                {act.completedAt ? (
                                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">✓ Concluída</span>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                                                        onClick={async () => {
                                                            await completeHrTicketActivity(act.id);
                                                            loadDetail();
                                                        }}
                                                    >
                                                        Concluir
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* TAB CONTENT: DOCUMENTOS E ANEXOS */}
                            {activeTab === "attachments" && (
                                <div className="flex-1 p-4 bg-slate-50 overflow-y-auto space-y-3">
                                    <h4 className="text-xs font-bold text-slate-700 mb-2">Documentos e Arquivos do Atendimento</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {ticket.attachments?.map((att: any) => (
                                            <a
                                                key={att.id}
                                                href={att.fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-white p-3 rounded-lg border shadow-sm hover:border-indigo-500 transition flex items-center gap-3"
                                            >
                                                <span className="text-2xl">📄</span>
                                                <div className="overflow-hidden">
                                                    <div className="text-xs font-bold text-slate-800 truncate">{att.fileName}</div>
                                                    <div className="text-[10px] text-slate-400">Enviado em {new Date(att.createdAt).toLocaleDateString()}</div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>

            {/* Sub-modals */}
            <HrScheduleMessageModal
                open={showScheduleMsg}
                onClose={() => setShowScheduleMsg(false)}
                ticketId={ticket?.id}
                contactPhone={ticket?.contactPhone}
                contactName={ticket?.contactName}
                onScheduled={loadDetail}
            />

            <HrScheduleActivityModal
                open={showScheduleAct}
                onClose={() => setShowScheduleAct(false)}
                ticketId={ticket?.id}
                onCreated={loadDetail}
            />

            {/* Transfer Modal */}
            <Dialog open={showTransferModal} onOpenChange={(o) => !o && setShowTransferModal(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-bold">Transferir Atendimento para outro Atendente</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <select
                            value={transferTargetUser}
                            onChange={(e) => setTransferTargetUser(e.target.value)}
                            className="w-full text-xs p-2 border rounded bg-white"
                        >
                            <option value="">Selecione o atendente destino...</option>
                            {availableUsers.map((u: any) => (
                                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                            ))}
                        </select>

                        <Textarea
                            value={transferReason}
                            onChange={(e) => setTransferReason(e.target.value)}
                            placeholder="Motivo da transferência..."
                            className="text-xs h-16"
                        />

                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setShowTransferModal(false)}>Cancelar</Button>
                            <Button size="sm" className="bg-indigo-600" onClick={handleTransfer} disabled={!transferTargetUser}>Confirmar Transferência</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}
