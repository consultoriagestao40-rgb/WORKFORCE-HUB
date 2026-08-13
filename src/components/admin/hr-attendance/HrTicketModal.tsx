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
    initialTab?: "chat" | "notes" | "activities" | "value";
    onClose: () => void;
    onUpdated?: () => void;
    availableUsers?: any[];
    availableLabels?: any[];
    availableStages?: any[];
}

export function HrTicketModal({ ticketId, initialTab = "chat", onClose, onUpdated, availableUsers = [], availableLabels = [], availableStages = [] }: Props) {
    const [ticket, setTicket] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"chat" | "notes" | "activities" | "value">(initialTab);


    const [messageText, setMessageText] = useState("");
    const [sending, setSending] = useState(false);
    const [stamp, setStamp] = useState("");

    const [isEditingContact, setIsEditingContact] = useState(false);
    const [contactNameInput, setContactNameInput] = useState("");
    const [contactPhoneInput, setContactPhoneInput] = useState("");

    const [showScheduleMsg, setShowScheduleMsg] = useState(false);
    const [showScheduleAct, setShowScheduleAct] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferTargetUser, setTransferTargetUser] = useState("");

    const [noteText, setNoteText] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const loadDetail = useCallback(async () => {
        if (!ticketId) return;
        try {
            const res = await getHrTicketDetail(ticketId);
            if (res) {
                setTicket(res);
                setContactNameInput(res.contactName);
                setContactPhoneInput(res.contactPhone);
                setStamp(res.attendantStamp || "");
                markHrTicketRead(ticketId);
            }
        } finally {
            setLoading(false);
        }
    }, [ticketId]);

    useEffect(() => {
        loadDetail();
    }, [loadDetail]);

    // Polling a cada 2.5s para novas mensagens ativas no modal
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
        }, 2500);
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

    const handleAssume = async () => {
        if (!ticket) return;
        await assumeHrTicket(ticket.id);
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

    const handleChangeStage = async (stageId: string) => {
        if (!ticket) return;
        await updateHrTicketStage(ticket.id, stageId);
        loadDetail();
        onUpdated?.();
    };

    if (!ticketId) return null;

    return (
        <Dialog open={!!ticketId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-none bg-transparent max-w-6xl w-[95vw] sm:max-w-6xl shadow-none">
                {loading || !ticket ? (
                    <div className="bg-[#0f172a] text-white p-8 rounded-3xl text-center text-xs border border-slate-700">
                        Carregando atendimento...
                    </div>
                ) : (
                    <div className="relative bg-[#0f172a] text-white w-full h-[88vh] rounded-3xl shadow-2xl overflow-hidden flex border border-slate-700/60 z-50">
                        {/* PAINEL LATERAL ESQUERDO */}
                        <div className="w-80 bg-[#1e293b]/95 border-r border-slate-700/80 p-5 flex flex-col justify-between overflow-y-auto space-y-4 flex-shrink-0">
                            <div className="space-y-4">
                                <div className="text-center space-y-2 pb-3 border-b border-slate-700/60">
                                    <div className="relative inline-block">
                                        {ticket.contactPhotoUrl && ticket.contactPhotoUrl !== "null" ? (
                                            <img src={ticket.contactPhotoUrl} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500 shadow-lg mx-auto" />
                                        ) : (
                                            <div className="w-20 h-20 rounded-full bg-slate-700 text-white font-extrabold text-2xl flex items-center justify-center border-2 border-emerald-500 shadow-lg mx-auto">
                                                {ticket.contactName?.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <h2 className="text-sm font-extrabold text-white leading-tight">{ticket.contactName}</h2>
                                    <span className="text-xs text-emerald-400 font-mono block">{ticket.contactPhone}</span>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">ETAPA NO PIPELINE</label>
                                    <select
                                        value={ticket.stageId}
                                        onChange={(e) => handleChangeStage(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                                    >
                                        {availableStages.map((stg) => (
                                            <option key={stg.id} value={stg.id}>{stg.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">ATENDENTE RESPONSÁVEL</label>
                                    {ticket.assignee ? (
                                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-700 flex items-center justify-between">
                                            <span className="text-xs font-bold text-white">👤 {ticket.assignee.name}</span>
                                        </div>
                                    ) : (
                                        <Button onClick={handleAssume} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-xl">
                                            <UserCheck className="w-4 h-4 mr-1.5" /> Assumir Atendimento
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2 pt-3 border-t border-slate-700/60">
                                <Button onClick={() => setShowScheduleMsg(true)} variant="outline" className="w-full border-emerald-500/40 text-emerald-400 bg-emerald-950/30 hover:bg-emerald-900/50 text-xs font-bold justify-start rounded-xl">
                                    💬 Agendar Mensagem (WhatsApp)
                                </Button>
                                <Button onClick={() => setShowScheduleAct(true)} variant="outline" className="w-full border-amber-500/40 text-amber-400 bg-amber-950/30 hover:bg-amber-900/50 text-xs font-bold justify-start rounded-xl">
                                    📅 Agendar Retorno / Atividade
                                </Button>
                                <Button onClick={handleCloseTicket} variant="outline" className="w-full border-red-500/40 text-red-400 bg-red-950/30 hover:bg-red-900/50 text-xs font-bold justify-start rounded-xl">
                                    ✕ Encerrar Atendimento
                                </Button>
                            </div>
                        </div>

                        {/* PAINEL DIREITO: CHAT WHATSAPP WEB REAL COM TEXTURA DOODLE */}
                        <div className="flex-1 flex flex-col bg-[#efeae2] relative overflow-hidden text-slate-900">
                            {/* Papel de Parede Doodle do WhatsApp Web Oficial */}
                            <div className="absolute inset-0 bg-[#efeae2] bg-[url('/whatsapp-doodle-bg.svg')] bg-[size:400px_400px] opacity-40 pointer-events-none" />

                            {/* WhatsApp Header Bar */}

                            <div className="h-16 bg-[#f0f2f5] border-b border-slate-300 px-5 flex items-center justify-between z-10 shadow-xs">
                                <div className="flex items-center gap-3">
                                    {ticket.contactPhotoUrl && ticket.contactPhotoUrl !== "null" ? (
                                        <img src={ticket.contactPhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover border" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-slate-700 text-white font-bold text-xs flex items-center justify-center">
                                            {ticket.contactName?.charAt(0)}
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="text-xs font-extrabold text-slate-900">{ticket.contactName}</h3>
                                        <span className="text-[11px] text-slate-500 font-mono">{ticket.contactPhone}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1">
                                        <button onClick={() => setTimeout(() => setActiveTab("chat"), 0)} className={`px-3 py-1 text-xs font-bold rounded-lg transition ${activeTab === "chat" ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}>
                                            💬 Chat ({ticket.messages?.length || 0})
                                        </button>
                                        <button onClick={() => setTimeout(() => setActiveTab("notes"), 0)} className={`px-3 py-1 text-xs font-bold rounded-lg transition ${activeTab === "notes" ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}>
                                            📝 Notas ({ticket.notes?.length || 0})
                                        </button>
                                        <button onClick={() => setTimeout(() => setActiveTab("activities"), 0)} className={`px-3 py-1 text-xs font-bold rounded-lg transition ${activeTab === "activities" ? "bg-white text-amber-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}>
                                            📅 Atividades / Lembretes ({ticket.activities?.length || 0})
                                        </button>
                                    </div>

                                    {/* Botão Fechar Modal X */}
                                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-300/80 hover:bg-red-600 hover:text-white text-slate-700 flex items-center justify-center font-extrabold transition cursor-pointer">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Papel de Parede Oficial 100% Exato do WhatsApp Web */}
                            <div
                                className="absolute inset-0 top-16 bottom-16 bg-[#efeae2] bg-repeat opacity-95 pointer-events-none z-0"
                                style={{ backgroundImage: `url('/whatsapp-bg-official.png')`, backgroundSize: '500px 380px' }}
                            />

                            {/* CHAT MESSAGES */}
                            {activeTab === "chat" && (
                                <div className="flex-1 flex flex-col overflow-hidden relative z-10">
                                    <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                        {ticket.messages?.map((msg: any) => {
                                            const isAttendant = msg.senderType === "ATTENDANT" || msg.fromMe === true;
                                            const isGroupTicket = ticket.contactPhone?.includes("-group") || ticket.contactPhone?.length > 13 || ticket.title?.toLowerCase().includes("grupo") || ticket.title?.includes("Taxas") || ticket.title?.includes("Mesa") || ticket.title?.includes("RH - ATESTADO");
                                            const showSenderHeader = isGroupTicket && !isAttendant && msg.senderName;

                                            return (
                                                <div key={msg.id} className={`flex ${isAttendant ? "justify-end" : "justify-start"}`}>
                                                    <div className={`max-w-[70%] p-3 rounded-xl shadow-2xs text-xs ${isAttendant ? "bg-[#d9fdd3] text-slate-900 rounded-tr-none" : "bg-white text-slate-900 rounded-tl-none"}`}>
                                                        {showSenderHeader && (
                                                            <div className="text-[11px] font-extrabold text-emerald-700 mb-1">
                                                                {msg.senderName}
                                                            </div>
                                                        )}

                                                        {msg.mediaUrl && (msg.messageType === "IMAGE" || msg.mediaUrl.match(/\.(jpg|jpeg|png|webp)/i)) && (
                                                            <img src={msg.mediaUrl} alt="" className="max-w-xs rounded-lg mb-2 max-h-60 object-cover border" />
                                                        )}

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
                                                                <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-700 font-bold underline flex-shrink-0">
                                                                    Abrir
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

                                    {/* BARRA DE ENVIO */}
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

                            {/* NOTAS INTERNAS */}
                            {activeTab === "notes" && (
                                <div className="flex-1 p-6 bg-slate-100 overflow-y-auto space-y-4 relative z-10">
                                    <div className="bg-white p-4 rounded-xl border shadow-2xs space-y-3">
                                        <h4 className="text-xs font-bold text-slate-800">Nova Anotação Interna</h4>
                                        <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Anotação interna sobre este atendimento..." className="text-xs h-20" />
                                        <div className="flex justify-end">
                                            <Button size="sm" onClick={handleAddNote} className="bg-emerald-600 text-xs font-bold">Salvar Nota</Button>
                                        </div>
                                    </div>
                                    {ticket.notes?.map((n: any) => (
                                        <div key={n.id} className="bg-white p-3.5 rounded-xl border shadow-2xs">
                                            <div className="text-xs font-bold text-slate-800">{n.author?.name || "Atendente RH"}</div>
                                            <p className="text-xs text-slate-600 mt-1">{n.content}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ATIVIDADES & LEMBRETES */}
                            {activeTab === "activities" && (
                                <div className="flex-1 p-6 bg-slate-100 overflow-y-auto space-y-4 relative z-10">
                                    <div className="bg-white p-4 rounded-xl border shadow-2xs flex items-center justify-between">
                                        <div>
                                            <h4 className="text-xs font-extrabold text-slate-800">📅 Agendar Novo Lembrete / Atividade</h4>
                                            <p className="text-[11px] text-slate-500">Defina um horário para retornar o contato com este colaborador.</p>
                                        </div>
                                        <Button onClick={() => setShowScheduleAct(true)} className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs">
                                            + Criar Lembrete
                                        </Button>
                                    </div>

                                    {ticket.activities?.length === 0 ? (
                                        <div className="text-center py-10 text-xs text-slate-400">Nenhum lembrete ou atividade agendada.</div>
                                    ) : (
                                        ticket.activities?.map((act: any) => (
                                            <div key={act.id} className="bg-white p-3.5 rounded-xl border shadow-2xs flex items-center justify-between">
                                                <div>
                                                    <h5 className="text-xs font-bold text-slate-800">{act.title}</h5>
                                                    {act.description && <p className="text-[11px] text-slate-500 mt-0.5">{act.description}</p>}
                                                    <span className="text-[10px] text-amber-600 font-mono font-bold mt-1 block">
                                                        ⏰ {new Date(act.dueDate).toLocaleString()}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${act.completed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
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

                {/* SUBMODAL: AGENDAR MENSAGEM WHATSAPP */}
                {showScheduleMsg && ticket && (
                    <HrScheduleMessageModal
                        open={showScheduleMsg}
                        onClose={() => setShowScheduleMsg(false)}
                        ticketId={ticket.id}
                        contactPhone={ticket.contactPhone}
                        onScheduled={() => {
                            setShowScheduleMsg(false);
                            loadDetail();
                            onUpdated?.();
                        }}
                    />
                )}


                {/* SUBMODAL: AGENDAR RETORNO / ATIVIDADE */}
                {showScheduleAct && ticket && (
                    <HrScheduleActivityModal
                        open={showScheduleAct}
                        onClose={() => setShowScheduleAct(false)}
                        ticketId={ticket.id}
                        onCreated={() => {
                            setShowScheduleAct(false);
                            loadDetail();
                            onUpdated?.();
                        }}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

