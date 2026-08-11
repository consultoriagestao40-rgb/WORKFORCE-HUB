"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    MessageSquare,
    Send,
    ExternalLink,
    CheckCheck,
    Phone,
    Paperclip,
    Download,
    X,
    FileSignature,
    CheckCircle2,
    Mic,
    Search,
    Smile,
    User,
    Plus,
    UserCheck,
    ChevronRight,
    Loader2,
    Settings,
    ShieldCheck,
    Sparkles
} from "lucide-react";
import { toast } from "sonner";
import {
    sendZapiTextMessage,
    sendZapiMediaFileMessage,
    addCandidateNoteAction
} from "@/actions/recruitment-whatsapp";

interface CandidateItem {
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
    unreadWhatsAppCount?: number;
}

interface WhatsAppChatModalProps {
    open: boolean;
    onClose: () => void;
    candidate: CandidateItem | null;
    allCandidates?: CandidateItem[];
}

const POLL_INTERVAL_MS = 3000; // 3s polling ao vivo

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

export function WhatsAppChatModal({ open, onClose, candidate, allCandidates = [] }: WhatsAppChatModalProps) {
    const [selectedCandidate, setSelectedCandidate] = useState<CandidateItem | null>(candidate);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<"chat" | "notes" | "reminders" | "tags" | "registration">("chat");
    const [messages, setMessages] = useState<any[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [sending, setSending] = useState(false);
    const [lastMessageTime, setLastMessageTime] = useState<string | null>(null);

    // ─── Configurações de Identificação & Assinatura (Carimbo do Atendente) ──────
    const [attendantName, setAttendantName] = useState<string>("Cristiano Silva");
    const [signMessages, setSignMessages] = useState<boolean>(true);
    const [stampStyle, setStampStyle] = useState<"HEADER" | "INLINE">("HEADER");
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

    // Notes
    const [noteText, setNoteText] = useState("");
    const [notesList, setNotesList] = useState<any[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (candidate) {
            setSelectedCandidate(candidate);
        }
    }, [candidate]);

    // Carregar configurações de assinatura salvas no browser
    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedName = localStorage.getItem("wh_attendant_name") || "Cristiano Silva";
            const savedSign = localStorage.getItem("wh_sign_messages") !== "false";
            const savedStyle = (localStorage.getItem("wh_stamp_style") as any) || "HEADER";
            setAttendantName(savedName);
            setSignMessages(savedSign);
            setStampStyle(savedStyle);
        }
    }, []);

    function saveAttendantSettings(name: string, sign: boolean, style: "HEADER" | "INLINE") {
        setAttendantName(name);
        setSignMessages(sign);
        setStampStyle(style);
        if (typeof window !== "undefined") {
            localStorage.setItem("wh_attendant_name", name);
            localStorage.setItem("wh_sign_messages", String(sign));
            localStorage.setItem("wh_stamp_style", style);
        }
        setIsSettingsOpen(false);
        toast.success("Assinatura do atendente configurada com sucesso!");
    }

    const activeCand = selectedCandidate || candidate;
    const rawPhone = activeCand?.phone || activeCand?.extraFields?.phone || activeCand?.extraFields?.whatsapp || "";
    const phoneDigits = rawPhone.replace(/\D/g, "");
    const formattedWaPhone = phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`;

    // Lista de candidatos filtrada para a coluna da esquerda
    const candidateList = allCandidates.length > 0 ? allCandidates : (candidate ? [candidate] : []);
    const filteredCandidates = candidateList.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone && c.phone.includes(searchTerm))
    );

    // ─── Busca inicial de mensagens do candidato selecionado ──────────────────
    const fetchAllMessages = useCallback(async (candId: string) => {
        if (!candId) return;
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/whatsapp/messages?candidateId=${candId}`);
            const data = await res.json();
            if (data.success) {
                setMessages(data.messages || []);
                if (data.messages?.length > 0) {
                    setLastMessageTime(data.messages[data.messages.length - 1].createdAt);
                } else {
                    setLastMessageTime(null);
                }
                // Zerar contador de não lidas no servidor
                await fetch(`/api/whatsapp/messages`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ candidateId: candId })
                });
            }
        } catch (e) {
            console.error("Erro ao buscar mensagens:", e);
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    // ─── Polling em tempo real para o candidato selecionado ────────────────────
    const pollNewMessages = useCallback(async () => {
        if (!activeCand?.id) return;
        try {
            const sinceParam = lastMessageTime ? `&since=${encodeURIComponent(lastMessageTime)}` : "";
            const res = await fetch(`/api/whatsapp/messages?candidateId=${activeCand.id}${sinceParam}`);
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
            // Silencioso
        }
    }, [activeCand?.id, lastMessageTime]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Troca de candidato selecionado
    useEffect(() => {
        if (open && activeCand?.id) {
            fetchAllMessages(activeCand.id);
            setNotesList(activeCand.extraFields?.internalNotes || []);

            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = setInterval(pollNewMessages, POLL_INTERVAL_MS);
        } else {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        }

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [open, activeCand?.id]);

    // ─── Enviar Texto com Carimbo de Atendente (Negrito & Itálico) ─────────────
    async function handleSendText() {
        if (!inputMessage.trim() || !activeCand?.id || !phoneDigits) return;
        const rawText = inputMessage.trim();
        setInputMessage("");
        setSending(true);

        // Formatação do Carimbo (Negrito + Itálico WhatsApp: _*texto*_)
        let finalMessage = rawText;
        if (signMessages && attendantName.trim()) {
            const formattedStamp = stampStyle === "INLINE"
                ? `*_${attendantName.trim()}_*: `
                : `_*[${attendantName.trim()}]*_\n\n`;
            finalMessage = `${formattedStamp}${rawText}`;
        }

        const tempId = `temp_${Date.now()}`;
        const tempMsg = {
            id: tempId,
            candidateId: activeCand.id,
            senderType: "RECRUITER",
            senderName: attendantName || "RH JVS",
            messageType: "TEXT",
            content: finalMessage,
            status: "SENDING",
            createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempMsg]);

        try {
            const res = await sendZapiTextMessage({
                candidateId: activeCand.id,
                phone: formattedWaPhone,
                message: finalMessage
            });

            if (res.success && res.message) {
                setMessages(prev => prev.map(m => m.id === tempId ? { ...res.message, status: "SENT" } : m));
                setLastMessageTime(new Date(res.message.createdAt).toISOString());
                toast.success("Mensagem assinada enviada no WhatsApp!");
            } else {
                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "FAILED" } : m));
                toast.error(res.error || "Erro no envio via Z-API.");
            }
        } catch (e: any) {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "FAILED" } : m));
            toast.error("Erro de comunicação com o servidor.");
        } finally {
            setSending(false);
        }
    }

    // ─── Enviar Arquivo / Imagem / PDF ────────────────────────────────────────
    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !activeCand?.id) return;

        if (file.size > 15 * 1024 * 1024) {
            toast.error("O arquivo deve ter menos de 15MB.");
            return;
        }

        setSending(true);
        toast.info(`Enviando ${file.name}...`);

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = (reader.result as string).split(",")[1];
            
            // Adicionar carimbo no envio de arquivo também
            let fileCaption = file.name;
            if (signMessages && attendantName.trim()) {
                fileCaption = `_*[${attendantName.trim()}]*_\n📎 ${file.name}`;
            }

            try {
                const res = await sendZapiMediaFileMessage({
                    candidateId: activeCand.id,
                    phone: formattedWaPhone,
                    fileBase64: base64,
                    fileName: file.name,
                    mimeType: file.type || "application/octet-stream",
                    caption: fileCaption
                });

                if (res.success && res.message) {
                    setMessages(prev => [...prev, res.message]);
                    setLastMessageTime(new Date(res.message.createdAt).toISOString());
                    toast.success(`Arquivo ${file.name} enviado!`);
                } else {
                    toast.error(res.error || "Erro no envio do arquivo.");
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
        if (!noteText.trim() || !activeCand?.id) return;
        const res = await addCandidateNoteAction(activeCand.id, noteText);
        if (res.success && res.note) {
            setNotesList(prev => [...prev, res.note]);
            setNoteText("");
            toast.success("Anotação salva no perfil!");
        }
    }

    if (!activeCand) return null;

    return (
        <>
            <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
                <DialogContent className="max-w-[95vw] w-full p-0 overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-slate-900 flex flex-col h-[92vh]">

                    {/* ── Top Bar Geral (Estilo Smartbid Hub) ────────────────────── */}
                    <div className="bg-[#0f172a] text-white px-5 py-3 flex items-center justify-between shrink-0 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg">
                                <MessageSquare className="w-4 h-4 fill-current" />
                            </div>
                            <div>
                                <h2 className="font-black text-sm text-white tracking-wide uppercase flex items-center gap-2">
                                    CENTRAL DE ATENDIMENTO WHATSAPP
                                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[9px] font-bold">
                                        Ao Vivo (Z-API)
                                    </span>
                                </h2>
                                <p className="text-[10px] text-slate-400">Acompanhe e responda todas as conversas do recrutamento em tempo real</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Botão de Configuração do Carimbo de Atendente (WASeller Style) */}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsSettingsOpen(true)}
                                className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-bold rounded-xl gap-1.5 h-8"
                                title="Configurar Assinatura & Carimbo do Atendente"
                            >
                                <Settings className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Carimbo: {signMessages ? attendantName : "Desativado"}</span>
                            </Button>

                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(`https://wa.me/${formattedWaPhone}`, "_blank")}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl gap-1.5 h-8 border-none"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                WhatsApp Web
                            </Button>

                            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* ── GRID DE 2 COLUNAS: Lista de Conversas (Esquerda) + Chat WhatsApp (Direita) ── */}
                    <div className="flex-1 grid grid-cols-12 overflow-hidden bg-slate-100">

                        {/* ── COLUNA 1: Lista de Conversas / Candidatos (350px / 4 Colunas) ── */}
                        <div className="col-span-12 md:col-span-4 lg:col-span-3 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
                            
                            {/* Pesquisa de Conversas */}
                            <div className="p-3 border-b border-slate-200 bg-slate-50 space-y-2 shrink-0">
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                                    <Input
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Pesquisar conversas..."
                                        className="pl-8 text-xs h-8 bg-white border-slate-200 rounded-xl"
                                    />
                                </div>

                                <div className="flex items-center gap-1 pt-1">
                                    <button className="text-[11px] font-bold px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800">
                                        Abertas ({filteredCandidates.length})
                                    </button>
                                </div>
                            </div>

                            {/* Lista de Contatos / Candidatos */}
                            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                                {filteredCandidates.length === 0 ? (
                                    <div className="p-6 text-center text-slate-400 text-xs">
                                        Nenhum candidato encontrado.
                                    </div>
                                ) : (
                                    filteredCandidates.map((cand) => {
                                        const isSelected = cand.id === activeCand?.id;
                                        const initials = cand.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
                                        const cPhone = cand.phone || cand.extraFields?.phone || cand.extraFields?.whatsapp || "Sem Tel";

                                        return (
                                            <div
                                                key={cand.id}
                                                onClick={() => setSelectedCandidate(cand)}
                                                className={`p-3.5 flex items-center justify-between cursor-pointer transition-all hover:bg-slate-50 ${
                                                    isSelected ? "bg-emerald-50/80 border-l-4 border-emerald-600" : ""
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <Avatar className="w-10 h-10 border border-slate-200 shrink-0">
                                                        <AvatarFallback className="bg-slate-200 text-slate-700 font-bold text-xs">
                                                            {initials}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <h4 className="font-bold text-slate-900 text-xs truncate leading-tight">{cand.name}</h4>
                                                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{cPhone}</p>
                                                        {cand.vacancyTitle && (
                                                            <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.2 rounded mt-1 inline-block truncate max-w-[150px]">
                                                                {cand.vacancyTitle}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <ChevronRight className={`w-4 h-4 text-slate-300 ${isSelected ? "text-emerald-600" : ""}`} />
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* ── COLUNA 2: Workspace do WhatsApp com Plano de Fundo Claro Doodle (#efeae2) ── */}
                        <div className="col-span-12 md:col-span-8 lg:col-span-9 flex flex-col bg-white overflow-hidden">

                            {/* Top Bar da Conversa Selecionada */}
                            <div className="bg-white px-5 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
                                <div className="flex items-center gap-3">
                                    <Avatar className="w-10 h-10 border border-slate-200">
                                        <AvatarFallback className="bg-emerald-600 text-white font-bold text-xs">
                                            {activeCand.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-black text-slate-900 text-sm leading-tight">{activeCand.name}</h3>
                                        <span className="font-mono text-emerald-700 font-bold text-xs">{rawPhone || "Sem Telefone"}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        onClick={() => { toast.info("Avançando para admissão..."); onClose(); }}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-8 gap-1.5"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Avançar para Admissão
                                    </Button>
                                </div>
                            </div>

                            {/* Abas e Atalhos Rápidos */}
                            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-2 shrink-0 overflow-x-auto">
                                {[
                                    { key: "chat", label: "💬 Chat", count: messages.length },
                                    { key: "notes", label: "📝 Anotações", count: notesList.length }
                                ].map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key as any)}
                                        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 ${
                                            activeTab === tab.key
                                                ? "bg-slate-900 text-white shadow-sm"
                                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                        }`}
                                    >
                                        {tab.label}
                                        {tab.count > 0 && (
                                            <span className={`text-[9px] px-1.5 rounded-full font-black ${activeTab === tab.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
                                                {tab.count}
                                            </span>
                                        )}
                                    </button>
                                ))}

                                {/* Templates Rápidos de Mensagem */}
                                {activeTab === "chat" && (
                                    <div className="ml-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                                        {messageTemplates.map((tmpl, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setInputMessage(tmpl.getText(activeCand.name, activeCand.vacancyTitle || "vaga"))}
                                                className="text-[10px] bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 px-2.5 py-1 rounded-lg font-bold shrink-0 whitespace-nowrap transition-all shadow-2xs"
                                            >
                                                {tmpl.title}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ── CONTEÚDO DA ABA CHAT (PLANO DE FUNDO CLARO DO WHATSAPP #efeae2) ── */}
                            {activeTab === "chat" && (
                                <div className="flex-1 flex flex-col overflow-hidden relative">

                                    {/* Área de Balões do WhatsApp (Fundo Claro Doodle #efeae2) */}
                                    <div
                                        className="flex-1 p-5 overflow-y-auto space-y-3.5"
                                        style={{
                                            backgroundColor: "#efeae2",
                                            backgroundImage: "radial-gradient(#d5ceb9 1.2px, transparent 1.2px)",
                                            backgroundSize: "24px 24px"
                                        }}
                                    >
                                        {loadingHistory ? (
                                            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
                                                <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
                                                <p className="text-xs font-semibold">Carregando conversa do WhatsApp...</p>
                                            </div>
                                        ) : messages.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-16">
                                                <div className="w-16 h-16 rounded-full bg-white border border-slate-300 flex items-center justify-center shadow-sm">
                                                    <MessageSquare className="w-8 h-8 text-emerald-600" />
                                                </div>
                                                <div className="space-y-1 bg-white/90 p-4 rounded-2xl border border-slate-200/80 shadow-sm max-w-sm">
                                                    <p className="font-bold text-slate-800 text-sm">Nenhuma mensagem enviada ainda.</p>
                                                    <p className="text-xs text-slate-500">
                                                        Digite uma mensagem abaixo para conversar com {activeCand.name}. Suas mensagens sairão com o carimbo **_{attendantName}_** em Negrito e Itálico!
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
                                                            <div
                                                                className={`max-w-[75%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm relative ${
                                                                    isSent
                                                                        ? "bg-[#d9fdd3] text-slate-900 rounded-tr-none border border-[#bcebaf]"
                                                                        : "bg-white text-slate-900 rounded-tl-none border border-slate-200"
                                                                }`}
                                                            >
                                                                {/* Nome do Remetente em Negrito (*RH JVS*) */}
                                                                <div className="font-bold text-[11px] text-emerald-800 mb-1">
                                                                    *{msg.senderName || (isSent ? attendantName : activeCand.name)}*
                                                                </div>

                                                                {/* Renderização de Anexo / Documento / Imagem */}
                                                                {isFile && (
                                                                    <div className="mb-2 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-2 space-y-1">
                                                                        {msg.messageType === "IMAGE" && msg.mediaUrl && (
                                                                            <img src={msg.mediaUrl} alt="Imagem" className="max-h-52 w-full object-cover rounded-lg" />
                                                                        )}
                                                                        <div className="flex items-center justify-between gap-2 text-[11px]">
                                                                            <span className="font-bold text-slate-800 truncate">{msg.mediaFileName || "Arquivo Anexo"}</span>
                                                                            {msg.mediaUrl && (
                                                                                <a
                                                                                    href={msg.mediaUrl}
                                                                                    download={msg.mediaFileName}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className="p-1 bg-emerald-600 rounded text-white hover:bg-emerald-700 shrink-0"
                                                                                >
                                                                                    <Download className="w-3.5 h-3.5" />
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Conteúdo do Texto */}
                                                                <div className="whitespace-pre-wrap font-sans text-xs text-slate-800 font-medium">
                                                                    {msg.content}
                                                                </div>

                                                                {/* Timestamp & Double Checkmarks Verdes (✓✓) */}
                                                                <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-400 font-mono">
                                                                    {isSending && <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />}
                                                                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                                                    {isSent && !isSending && !isFailed && (
                                                                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
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

                                    {/* Barra de Envio Inferior (📎 Anexo | 😊 Emoji | Input | 🎙️ Mic / Enviar) */}
                                    <div className="bg-[#f0f2f5] border-t border-slate-200 p-3 flex items-end gap-2 shrink-0">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileUpload}
                                            className="hidden"
                                            accept="image/*,.pdf,.doc,.docx,.xlsx,.xls"
                                        />

                                        {/* Botão de Anexo */}
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={sending}
                                            className="p-2.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-200 rounded-full transition-all shrink-0"
                                            title="Anexar arquivo ou imagem"
                                        >
                                            <Paperclip className="w-5 h-5" />
                                        </button>

                                        {/* Caixa de Texto do WhatsApp */}
                                        <Textarea
                                            value={inputMessage}
                                            onChange={(e) => setInputMessage(e.target.value)}
                                            placeholder="Digite uma mensagem..."
                                            rows={1}
                                            className="flex-1 bg-white border border-slate-300 text-slate-900 text-xs rounded-2xl focus:ring-2 focus:ring-emerald-500 resize-none p-3 placeholder:text-slate-400 max-h-24 shadow-2xs"
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendText();
                                                }
                                            }}
                                        />

                                        {/* Botão Enviar / Mic */}
                                        <Button
                                            disabled={sending || !inputMessage.trim()}
                                            onClick={handleSendText}
                                            className={`rounded-full w-10 h-10 p-0 shrink-0 flex items-center justify-center shadow-md transition-all ${
                                                inputMessage.trim()
                                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                                    : "bg-[#005c4b] text-white hover:bg-emerald-700"
                                            }`}
                                        >
                                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        </Button>
                                    </div>

                                </div>
                            )}

                            {/* ── CONTEÚDO DA ABA ANOTAÇÕES ── */}
                            {activeTab === "notes" && (
                                <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-slate-50">
                                    <div className="space-y-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                                        <h3 className="font-bold text-slate-900 text-sm">Anotações Internas do Candidato</h3>
                                        <p className="text-xs text-slate-500">Visíveis somente para a equipe de RH. Não são enviadas ao candidato.</p>
                                        <Textarea
                                            value={noteText}
                                            onChange={(e) => setNoteText(e.target.value)}
                                            placeholder="Anote observações sobre a entrevista, documentos, comportamento..."
                                            rows={3}
                                            className="bg-slate-50 border-slate-300 text-slate-900 text-xs rounded-xl resize-none"
                                        />
                                        <Button
                                            size="sm"
                                            disabled={!noteText.trim()}
                                            onClick={handleAddNote}
                                            className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs rounded-xl"
                                        >
                                            Salvar Anotação
                                        </Button>
                                    </div>

                                    <div className="space-y-2 pt-3">
                                        {notesList.length === 0 ? (
                                            <p className="text-xs text-slate-500 italic">Nenhuma anotação gravada ainda.</p>
                                        ) : notesList.map((n, i) => (
                                            <div key={i} className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs">
                                                <p className="text-xs text-slate-800">{n.text}</p>
                                                <div className="flex justify-between text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
                                                    <span>Por: {n.authorName}</span>
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

            {/* ── MODAL DE CONFIGURAÇÃO DE IDENTIFICAÇÃO E ASSINATURA (WASELLER STYLE) ── */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className="max-w-md bg-white border border-slate-200 text-slate-900 rounded-3xl p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-600" />
                            Identificação & Assinatura (Carimbo)
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 pt-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">Nome do Atendente (Sua Assinatura)</label>
                            <Input
                                value={attendantName}
                                onChange={(e) => setAttendantName(e.target.value)}
                                placeholder="Ex: Cristiano Silva"
                                className="bg-slate-50 border-slate-300 text-xs rounded-xl"
                            />
                            <p className="text-[10px] text-slate-500">Usado para assinar suas mensagens enviadas ao candidato pelo WhatsApp.</p>
                        </div>

                        <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                            <div>
                                <h4 className="text-xs font-bold text-slate-800">Assinar mensagens enviadas</h4>
                                <p className="text-[10px] text-slate-500">Adiciona o carimbo automaticamente nas mensagens.</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={signMessages}
                                onChange={(e) => setSignMessages(e.target.checked)}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-700">Estilo da Formatação no WhatsApp</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setStampStyle("HEADER")}
                                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                                        stampStyle === "HEADER"
                                            ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-bold"
                                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    }`}
                                >
                                    <span className="block font-bold text-emerald-800 text-[11px] mb-1">Cabeçalho (Bloco)</span>
                                    <span className="font-mono text-[10px] text-slate-600">_*[{attendantName || "Nome"}]*_</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setStampStyle("INLINE")}
                                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                                        stampStyle === "INLINE"
                                            ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-bold"
                                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    }`}
                                >
                                    <span className="block font-bold text-emerald-800 text-[11px] mb-1">Linha Única</span>
                                    <span className="font-mono text-[10px] text-slate-600">_*[${attendantName || "Nome"}]*_: </span>
                                </button>
                            </div>
                        </div>

                        {/* Prévia de como a mensagem chegará no WhatsApp */}
                        <div className="space-y-1.5 pt-2">
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Prévia no WhatsApp do Candidato:</span>
                            <div className="p-3 bg-[#d9fdd3] border border-[#bcebaf] rounded-2xl text-xs text-slate-900 shadow-2xs font-sans">
                                {signMessages ? (
                                    stampStyle === "HEADER" ? (
                                        <>
                                            <span className="font-bold italic block mb-1">_[{attendantName || "Atendente"}]_</span>
                                            <span>Olá, tudo bem? Vimos seu perfil para a vaga...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-bold italic">_{attendantName || "Atendente"}_: </span>
                                            <span>Olá, tudo bem? Vimos seu perfil para a vaga...</span>
                                        </>
                                    )
                                ) : (
                                    <span>Olá, tudo bem? Vimos seu perfil para a vaga...</span>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsSettingsOpen(false)}
                                className="text-xs rounded-xl"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={() => saveAttendantSettings(attendantName, signMessages, stampStyle)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl"
                            >
                                Salvar Configuração
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
