"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    MessageSquare,
    Send,
    ExternalLink,
    CheckCheck,
    Sparkles,
    Phone,
    Paperclip,
    Download,
    X,
    FileSignature,
    CheckCircle2,
    Mic,
    Settings,
    Loader2
} from "lucide-react";
import { toast } from "sonner";
import {
    sendZapiTextMessage,
    sendZapiMediaFileMessage,
    addCandidateNoteAction
} from "@/actions/recruitment-whatsapp";

interface WhatsAppChatModalProps {
    open: boolean;
    onClose: () => void;
    candidate: {
        id: string;
        name: string;
        phone?: string;
        email?: string;
        vacancyTitle?: string;
        companyName?: string;
        salary?: string | number;
        address?: string;
        recruiterName?: string;
        extraFields?: any;
    } | null;
}

const POLL_INTERVAL_MS = 3000; // Atualiza a cada 3 segundos

const messageTemplates = [
    {
        title: "📋 Entrevista",
        getText: (name: string, vacancy: string) =>
            `Olá ${name}, vimos seu perfil para a vaga de ${vacancy || "nossa empresa"}. Gostaríamos de agendar uma entrevista! Qual o seu melhor horário?`
    },
    {
        title: "📝 Documentos",
        getText: (name: string, vacancy: string) =>
            `Olá ${name}, seu perfil foi pré-aprovado! Por favor, nos envie fotos legíveis do seu RG, CPF e Comprovante de Residência.`
    },
    {
        title: "🩺 Exame ASO",
        getText: (name: string, vacancy: string) =>
            `Olá ${name}, sua admissão foi autorizada! Precisamos agendar o seu Exame Médico Admissional (ASO). Confirme sua disponibilidade.`
    },
    {
        title: "🏢 Convocação",
        getText: (name: string, vacancy: string) =>
            `Olá ${name}, seja bem-vindo(a) ao Grupo JVS Facilities! Aguarde as instruções para o seu primeiro dia de trabalho.`
    }
];

export function WhatsAppChatModal({ open, onClose, candidate }: WhatsAppChatModalProps) {
    const [activeTab, setActiveTab] = useState<"chat" | "notes">("chat");
    const [messages, setMessages] = useState<any[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [sending, setSending] = useState(false);
    const [lastMessageTime, setLastMessageTime] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(false);

    // Notes state
    const [noteText, setNoteText] = useState("");
    const [notesList, setNotesList] = useState<any[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    const rawPhone = candidate?.phone || candidate?.extraFields?.phone || candidate?.extraFields?.whatsapp || "";
    const phoneDigits = rawPhone.replace(/\D/g, "");
    const formattedWaPhone = phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`;

    // ─── Busca inicial completa do histórico ──────────────────────────────────
    const fetchAllMessages = useCallback(async () => {
        if (!candidate?.id) return;
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/whatsapp/messages?candidateId=${candidate.id}`);
            const data = await res.json();
            if (data.success) {
                setMessages(data.messages || []);
                if (data.messages?.length > 0) {
                    setLastMessageTime(data.messages[data.messages.length - 1].createdAt);
                }
                // Zerar contador de não lidas
                await fetch(`/api/whatsapp/messages`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ candidateId: candidate.id })
                });
            }
        } catch (e) {
            console.error("Erro ao buscar histórico:", e);
        } finally {
            setLoadingHistory(false);
        }
    }, [candidate?.id]);

    // ─── Polling incremental (busca somente novas mensagens) ─────────────────
    const pollNewMessages = useCallback(async () => {
        if (!candidate?.id) return;
        try {
            const sinceParam = lastMessageTime
                ? `&since=${encodeURIComponent(lastMessageTime)}`
                : "";
            const res = await fetch(`/api/whatsapp/messages?candidateId=${candidate.id}${sinceParam}`);
            const data = await res.json();
            if (data.success && data.messages?.length > 0) {
                setMessages(prev => {
                    const existingIds = new Set(prev.map((m: any) => m.id));
                    const newMsgs = data.messages.filter((m: any) => !existingIds.has(m.id));
                    if (newMsgs.length === 0) return prev;
                    setLastMessageTime(newMsgs[newMsgs.length - 1].createdAt);
                    return [...prev, ...newMsgs];
                });
            }
        } catch (e) {
            // silencioso no polling
        }
    }, [candidate?.id, lastMessageTime]);

    // ─── Scroll to bottom quando chega nova mensagem ─────────────────────────
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // ─── Iniciar/Parar polling quando o modal abre/fecha ─────────────────────
    useEffect(() => {
        if (open && candidate?.id) {
            fetchAllMessages();
            const notes = candidate.extraFields?.internalNotes || [];
            setNotesList(notes);

            // Inicia polling
            pollingRef.current = setInterval(pollNewMessages, POLL_INTERVAL_MS);
            setIsPolling(true);
        } else {
            // Para o polling ao fechar
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
                setIsPolling(false);
            }
            setMessages([]);
            setLastMessageTime(null);
        }

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [open, candidate?.id]);

    // Atualiza a função de polling quando lastMessageTime muda
    useEffect(() => {
        if (!open || !candidate?.id || !isPolling) return;
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = setInterval(pollNewMessages, POLL_INTERVAL_MS);
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [pollNewMessages, open, candidate?.id, isPolling]);

    // ─── Enviar texto via Z-API ───────────────────────────────────────────────
    async function handleSendText() {
        if (!inputMessage.trim() || !candidate?.id || !phoneDigits) return;
        const msgText = inputMessage.trim();
        setInputMessage("");
        setSending(true);

        // Otimistic UI
        const tempId = `temp_${Date.now()}`;
        const tempMsg = {
            id: tempId,
            candidateId: candidate.id,
            senderType: "RECRUITER",
            senderName: "RH WorkForce Hub",
            messageType: "TEXT",
            content: msgText,
            status: "SENDING",
            createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempMsg]);

        try {
            const res = await sendZapiTextMessage({
                candidateId: candidate.id,
                phone: formattedWaPhone,
                message: msgText
            });

            if (res.success && res.message) {
                // Substituir a mensagem temporária pela real
                setMessages(prev => prev.map(m => m.id === tempId ? { ...res.message, status: "SENT" } : m));
                setLastMessageTime(new Date(res.message.createdAt).toISOString());
                toast.success("Mensagem enviada!");
            } else {
                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "FAILED" } : m));
                toast.error(res.error || "Falha no envio pelo Z-API.");
            }
        } catch (e: any) {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "FAILED" } : m));
            toast.error("Erro de conexão.");
        } finally {
            setSending(false);
        }
    }

    // ─── Enviar arquivo via Z-API ─────────────────────────────────────────────
    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !candidate?.id) return;

        if (file.size > 15 * 1024 * 1024) {
            toast.error("Arquivo máximo de 15MB.");
            return;
        }

        setSending(true);
        toast.info(`Enviando ${file.name}...`);

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = (reader.result as string).split(",")[1];
            try {
                const res = await sendZapiMediaFileMessage({
                    candidateId: candidate.id,
                    phone: formattedWaPhone,
                    fileBase64: base64,
                    fileName: file.name,
                    mimeType: file.type || "application/octet-stream",
                    caption: file.name
                });

                if (res.success && res.message) {
                    setMessages(prev => [...prev, res.message]);
                    setLastMessageTime(new Date(res.message.createdAt).toISOString());
                    toast.success(`${file.name} enviado!`);
                } else {
                    toast.error(res.error || "Falha no envio do arquivo.");
                }
            } catch (err) {
                toast.error("Erro ao enviar arquivo.");
            } finally {
                setSending(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsDataURL(file);
    }

    async function handleAddNote() {
        if (!noteText.trim() || !candidate?.id) return;
        const res = await addCandidateNoteAction(candidate.id, noteText);
        if (res.success && res.note) {
            setNotesList(prev => [...prev, res.note]);
            setNoteText("");
            toast.success("Anotação salva!");
        }
    }

    if (!candidate) return null;

    const initials = candidate.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-6xl w-full p-0 overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-slate-100 flex flex-col h-[90vh]">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Avatar className="w-10 h-10 border-2 border-emerald-500/80">
                                <AvatarFallback className="bg-emerald-950 text-emerald-300 font-black text-sm">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-950 rounded-full" />
                        </div>
                        <div>
                            <h2 className="font-black text-slate-100 text-sm leading-tight">{candidate.name}</h2>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <span className="font-mono text-emerald-400 font-bold">{rawPhone || "Sem telefone"}</span>
                                {candidate.vacancyTitle && <span>• {candidate.vacancyTitle}</span>}
                                {isPolling && (
                                    <span className="flex items-center gap-1 text-emerald-500">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        ao vivo
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2">
                            Z-API
                        </Badge>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(`https://wa.me/${formattedWaPhone}`, "_blank")}
                            className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 text-xs rounded-xl gap-1.5 h-8"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Abrir Web
                        </Button>
                        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ── Corpo: Sidebar + Chat ──────────────────────────────── */}
                <div className="flex-1 grid grid-cols-12 overflow-hidden">

                    {/* ── SIDEBAR: Dados do Candidato ── */}
                    <div className="col-span-4 bg-slate-950/70 border-r border-slate-800 p-5 space-y-5 overflow-y-auto">

                        {/* Status Card */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
                            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Candidato Ativo</span>
                            <p className="font-bold text-slate-100 text-sm">{candidate.name}</p>
                            <p className="text-xs text-slate-400">{candidate.vacancyTitle || "Vaga em Seleção"}</p>
                        </div>

                        {/* Contato */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-800 pb-1.5">Contato & Perfil</h4>
                            {[
                                { label: "Telefone / WhatsApp", value: rawPhone, accent: true },
                                { label: "E-mail", value: candidate.email },
                                { label: "Empresa Contratante", value: candidate.companyName },
                                { label: "Endereço", value: candidate.address },
                                { label: "Recrutador", value: candidate.recruiterName, color: "text-indigo-400" }
                            ].filter(i => i.value).map((item, idx) => (
                                <div key={idx} className="text-xs space-y-0.5">
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block">{item.label}</span>
                                    <span className={`font-semibold block ${item.accent ? "font-mono text-emerald-400 text-sm" : item.color || "text-slate-300"}`}>
                                        {item.value}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Setup webhook info */}
                        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-[10px] text-slate-400 space-y-1">
                            <div className="flex items-center gap-1 font-bold text-emerald-400">
                                <Settings className="w-3 h-3" />
                                Configuração Z-API
                            </div>
                            <p>Webhook configurado em:</p>
                            <p className="font-mono text-slate-300 text-[9px] break-all">
                                /api/webhooks/zapi
                            </p>
                            <p className="text-slate-500">Mensagens novas chegam automaticamente em tempo real.</p>
                        </div>

                        <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl gap-2"
                            onClick={() => { toast.info("Abrindo fluxo de admissão..."); onClose(); }}
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Avançar para Admissão
                        </Button>
                    </div>

                    {/* ── ÁREA DO CHAT ── */}
                    <div className="col-span-8 flex flex-col overflow-hidden">

                        {/* Abas do Chat */}
                        <div className="bg-slate-950 border-b border-slate-800 px-4 py-2 flex items-center gap-2 shrink-0 overflow-x-auto">
                            {[
                                { key: "chat", label: "💬 Chat", count: messages.length },
                                { key: "notes", label: "📝 Anotações", count: notesList.length }
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key as any)}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 ${
                                        activeTab === tab.key
                                            ? "bg-emerald-600 text-white shadow-md"
                                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                    }`}
                                >
                                    {tab.label}
                                    {tab.count > 0 && (
                                        <span className={`text-[9px] px-1.5 rounded-full font-black ${activeTab === tab.key ? "bg-white/20 text-white" : "bg-slate-700 text-slate-300"}`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            ))}

                            {/* Templates rápidos */}
                            {activeTab === "chat" && (
                                <div className="ml-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                                    {messageTemplates.map((tmpl, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setInputMessage(tmpl.getText(candidate.name, candidate.vacancyTitle || "vaga"))}
                                            className="text-[10px] bg-slate-800 hover:bg-emerald-950 text-slate-300 hover:text-emerald-300 border border-slate-700 px-2.5 py-1 rounded-lg font-semibold shrink-0 whitespace-nowrap transition-all"
                                        >
                                            {tmpl.title}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── CHAT TAB ── */}
                        {activeTab === "chat" && (
                            <div className="flex-1 flex flex-col overflow-hidden">

                                {/* Área de Mensagens */}
                                <div
                                    className="flex-1 p-4 overflow-y-auto space-y-3"
                                    style={{
                                        backgroundColor: "#0b141a",
                                        backgroundImage: "radial-gradient(#1f2c34 1px, transparent 1px)",
                                        backgroundSize: "20px 20px"
                                    }}
                                >
                                    {loadingHistory ? (
                                        <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                                            <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
                                            <p className="text-xs font-semibold">Carregando histórico de mensagens...</p>
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
                                            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                                <MessageSquare className="w-7 h-7 text-emerald-500" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="font-bold text-slate-200 text-sm">Nenhuma conversa encontrada.</p>
                                                <p className="text-xs text-slate-400 max-w-xs">
                                                    As conversas aparecerão aqui automaticamente conforme o webhook Z-API estiver configurado.
                                                    Selecione um modelo acima para iniciar uma conversa!
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {messages.map((msg, index) => {
                                                const isSent = msg.senderType === "RECRUITER" || msg.senderType === "SYSTEM";
                                                const isFile = msg.messageType === "DOCUMENT" || msg.messageType === "IMAGE";
                                                const isFailed = msg.status === "FAILED";
                                                const isSending = msg.status === "SENDING";

                                                return (
                                                    <div key={msg.id || index} className={`flex ${isSent ? "justify-end" : "justify-start"}`}>
                                                        {!isSent && (
                                                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-300 mr-2 shrink-0 mt-auto mb-1">
                                                                {candidate.name.charAt(0)}
                                                            </div>
                                                        )}
                                                        <div
                                                            className={`max-w-[75%] rounded-2xl p-2.5 text-xs leading-relaxed shadow-lg relative ${
                                                                isSent
                                                                    ? isFailed
                                                                        ? "bg-red-900/60 border border-red-700/50 rounded-tr-none"
                                                                        : "bg-[#005c4b] rounded-tr-none border border-emerald-700/40"
                                                                    : "bg-[#202c33] rounded-tl-none border border-slate-700/40"
                                                            }`}
                                                        >
                                                            {/* Remetente */}
                                                            <div className={`text-[10px] font-bold mb-1 ${isSent ? "text-emerald-300" : "text-sky-400"}`}>
                                                                {isSent ? (msg.senderName || "RH") : candidate.name}
                                                            </div>

                                                            {/* Arquivo / Imagem */}
                                                            {isFile && (
                                                                <div className="mb-2 rounded-xl overflow-hidden border border-white/10 bg-black/20">
                                                                    {msg.messageType === "IMAGE" && msg.mediaUrl && (
                                                                        <img src={msg.mediaUrl} alt="Imagem" className="max-h-48 w-full object-cover" />
                                                                    )}
                                                                    <div className="flex items-center justify-between gap-2 p-2 text-[10px]">
                                                                        <span className="font-bold text-emerald-200 truncate">{msg.mediaFileName || "Arquivo"}</span>
                                                                        {msg.mediaUrl && (
                                                                            <a
                                                                                href={msg.mediaUrl}
                                                                                download={msg.mediaFileName}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="p-1 bg-emerald-600 rounded hover:bg-emerald-500 shrink-0"
                                                                            >
                                                                                <Download className="w-3 h-3 text-white" />
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Texto */}
                                                            <div className={`whitespace-pre-wrap font-sans text-[11px] ${isFailed ? "text-red-300" : "text-slate-100"}`}>
                                                                {msg.content}
                                                                {isFailed && <span className="text-red-400 text-[9px] ml-1">(falhou)</span>}
                                                            </div>

                                                            {/* Timestamp + Checkmarks */}
                                                            <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] font-mono ${isSent ? "text-emerald-200/70" : "text-slate-400"}`}>
                                                                {isSending && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                                                                <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                                                {isSent && !isSending && !isFailed && (
                                                                    <CheckCheck className={`w-3 h-3 ${msg.status === "READ" ? "text-blue-300" : "text-emerald-300"}`} />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div ref={chatEndRef} />
                                        </>
                                    )}
                                </div>

                                {/* Barra de Input */}
                                <div className="bg-[#202c33] border-t border-slate-800 p-3 flex items-end gap-2 shrink-0">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        accept="image/*,.pdf,.doc,.docx,.xlsx,.xls"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={sending}
                                        className="p-2.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-full transition-all shrink-0"
                                        title="Anexar arquivo ou imagem"
                                    >
                                        <Paperclip className="w-5 h-5" />
                                    </button>

                                    <Textarea
                                        value={inputMessage}
                                        onChange={(e) => setInputMessage(e.target.value)}
                                        placeholder="Digite uma mensagem..."
                                        rows={1}
                                        className="flex-1 bg-[#2a3942] border-none text-slate-100 text-xs rounded-2xl focus:ring-1 focus:ring-emerald-500 resize-none p-3 placeholder:text-slate-500 max-h-24"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendText();
                                            }
                                        }}
                                    />

                                    <Button
                                        disabled={sending || !inputMessage.trim()}
                                        onClick={handleSendText}
                                        className={`rounded-full w-10 h-10 p-0 shrink-0 flex items-center justify-center transition-all ${
                                            inputMessage.trim()
                                                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg"
                                                : "bg-slate-700 text-slate-400 cursor-not-allowed"
                                        }`}
                                    >
                                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* ── ANOTAÇÕES TAB ── */}
                        {activeTab === "notes" && (
                            <div className="flex-1 p-5 space-y-4 overflow-y-auto bg-slate-900">
                                <div className="space-y-2">
                                    <h3 className="font-bold text-slate-100 text-sm">Anotações Internas</h3>
                                    <p className="text-xs text-slate-400">Visíveis somente para a equipe de RH. Não são enviadas ao candidato.</p>
                                    <Textarea
                                        value={noteText}
                                        onChange={(e) => setNoteText(e.target.value)}
                                        placeholder="Anote observações sobre a entrevista, documentos, comportamento..."
                                        rows={3}
                                        className="bg-slate-950 border-slate-800 text-slate-200 text-xs rounded-xl resize-none"
                                    />
                                    <Button
                                        size="sm"
                                        disabled={!noteText.trim()}
                                        onClick={handleAddNote}
                                        className="bg-emerald-600 hover:bg-emerald-500 font-bold text-xs rounded-xl"
                                    >
                                        Salvar Anotação
                                    </Button>
                                </div>

                                <div className="space-y-2 pt-3 border-t border-slate-800">
                                    {notesList.length === 0 ? (
                                        <p className="text-xs text-slate-500 italic">Nenhuma anotação ainda.</p>
                                    ) : notesList.map((n, i) => (
                                        <div key={i} className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                                            <p className="text-xs text-slate-200">{n.text}</p>
                                            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                                <span>{n.authorName}</span>
                                                <span>{new Date(n.createdAt).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                </div>

            </DialogContent>
        </Dialog>
    );
}
