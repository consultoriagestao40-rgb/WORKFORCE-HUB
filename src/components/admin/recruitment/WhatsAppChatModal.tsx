"use client";

import { useState, useEffect, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    MessageSquare,
    Send,
    ExternalLink,
    Clock,
    User,
    CheckCheck,
    Sparkles,
    FileText,
    Calendar,
    Phone,
    Paperclip,
    Smile,
    Mic,
    Tag,
    Bell,
    FileSignature,
    CheckCircle2,
    X,
    Download,
    Image as ImageIcon,
    Plus,
    Building2,
    MapPin,
    DollarSign,
    Mail
} from "lucide-react";
import { toast } from "sonner";
import {
    sendZapiTextMessage,
    sendZapiMediaFileMessage,
    getCandidateWhatsAppMessagesAction,
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

export function WhatsAppChatModal({ open, onClose, candidate }: WhatsAppChatModalProps) {
    const [activeTab, setActiveTab] = useState<"chat" | "notes" | "reminders" | "tags" | "registration">("chat");
    const [messages, setMessages] = useState<any[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [sending, setSending] = useState(false);
    
    // Notes state
    const [noteText, setNoteText] = useState("");
    const [notesList, setNotesList] = useState<any[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const rawPhone = candidate?.phone || candidate?.extraFields?.phone || candidate?.extraFields?.whatsapp || "";
    const phoneDigits = rawPhone.replace(/\D/g, "");
    const formattedWaPhone = phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`;

    // Templates Rápidos de Mensagens do RH
    const messageTemplates = [
        {
            title: "📋 Agendar Entrevista",
            getText: (name: string, vacancy: string) =>
                `Olá ${name}, vimos seu perfil para a vaga de ${vacancy || "nossa empresa"}. Gostoraríamos de agendar uma entrevista! Qual o seu melhor horário?`
        },
        {
            title: "📝 Pedir Documentos",
            getText: (name: string, vacancy: string) =>
                `Olá ${name}, seu perfil foi pré-aprovado! Por favor, nos envie fotos legíveis do seu RG, CPF e Comprovante de Residência para darmos sequência.`
        },
        {
            title: "🩺 Exame Admissional (ASO)",
            getText: (name: string, vacancy: string) =>
                `Olá ${name}, sua admissão foi autorizada! Precisamos agendar o seu Exame Médico Admissional (ASO). Por favor, confirme a sua disponibilidade.`
        },
        {
            title: "🏢 Convocação para Início",
            getText: (name: string, vacancy: string) =>
                `Olá ${name}, seja bem-vindo(a) ao Grupo JVS Facilities! Seu primeiro dia de trabalho será em breve. Favor aguardar as instruções.`
        }
    ];

    useEffect(() => {
        if (open && candidate?.id) {
            fetchMessages();
            const notes = candidate.extraFields?.internalNotes || [];
            setNotesList(notes);
        }
    }, [open, candidate?.id]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    async function fetchMessages() {
        if (!candidate?.id) return;
        setLoadingHistory(true);
        try {
            const res = await getCandidateWhatsAppMessagesAction(candidate.id);
            if (res.success && res.messages) {
                setMessages(res.messages);
            }
        } catch (e) {
            console.error("Error fetching messages:", e);
        } finally {
            setLoadingHistory(false);
        }
    }

    async function handleSendText() {
        if (!inputMessage.trim() || !candidate?.id) return;
        const msgText = inputMessage.trim();
        setInputMessage("");
        setSending(true);

        // Optimistic UI update
        const tempMsg = {
            id: `temp_${Date.now()}`,
            candidateId: candidate.id,
            senderType: "RECRUITER",
            senderName: candidate.recruiterName || "RH WorkForce Hub",
            messageType: "TEXT",
            content: msgText,
            status: "SENT",
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
                setMessages(prev => prev.map(m => m.id === tempMsg.id ? res.message : m));
                toast.success("Mensagem enviada no WhatsApp do candidato!");
            } else {
                toast.error(res.error || "Mensagem enviada com ressalvas.");
            }
        } catch (e: any) {
            toast.error(e.message || "Erro no envio.");
        } finally {
            setSending(false);
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !candidate?.id) return;

        if (file.size > 15 * 1024 * 1024) {
            toast.error("O arquivo deve ter menos de 15MB.");
            return;
        }

        toast.info(`Enviando arquivo ${file.name} no WhatsApp...`);
        setSending(true);

        const reader = new FileReader();
        reader.onloadend = async () => {
            const result = reader.result as string;
            const base64 = result.split(",")[1];

            try {
                const res = await sendZapiMediaFileMessage({
                    candidateId: candidate.id,
                    phone: formattedWaPhone,
                    fileBase64: base64,
                    fileName: file.name,
                    mimeType: file.type || "application/pdf",
                    caption: `📎 Arquivo: ${file.name}`
                });

                if (res.success && res.message) {
                    setMessages(prev => [...prev, res.message]);
                    toast.success("Arquivo enviado com sucesso no WhatsApp!");
                } else {
                    toast.error(res.error || "Erro ao enviar arquivo.");
                }
            } catch (err: any) {
                toast.error("Erro no envio do arquivo.");
            } finally {
                setSending(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsDataURL(file);
    }

    async function handleAddNote() {
        if (!noteText.trim() || !candidate?.id) return;
        try {
            const res = await addCandidateNoteAction(candidate.id, noteText);
            if (res.success && res.note) {
                setNotesList(prev => [...prev, res.note]);
                setNoteText("");
                toast.success("Anotação interna salva!");
            }
        } catch (e) {
            toast.error("Erro ao salvar anotação.");
        }
    }

    function applyTemplate(templateTextGetter: (name: string, vacancy: string) => string) {
        const text = templateTextGetter(
            candidate?.name || "Candidato",
            candidate?.vacancyTitle || "vaga"
        );
        setInputMessage(text);
    }

    if (!candidate) return null;

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-6xl w-full p-0 overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-slate-100 flex flex-col h-[90vh]">
                
                {/* Header Superior Estilo CRM Smartbid */}
                <div className="bg-slate-950 px-6 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-emerald-400 font-bold text-sm bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg">
                            WhatsApp CRM Z-API
                        </span>
                        <h2 className="font-black text-slate-100 text-lg tracking-tight">
                            {candidate.name}
                        </h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                const waUrl = `https://wa.me/${formattedWaPhone}`;
                                window.open(waUrl, "_blank", "noreferrer,noopener");
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white border-none font-bold text-xs gap-1.5 rounded-xl shadow-md"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Abrir Web</span>
                        </Button>

                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Grid de 2 Colunas: Sidebar Esquerda + Workspace do Chat */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">

                    {/* COLUNA ESQUERDA: Ficha & Dados do Candidato (4 Colunas) */}
                    <div className="lg:col-span-4 bg-slate-950/80 border-r border-slate-800 p-5 space-y-6 overflow-y-auto custom-scrollbar">
                        
                        {/* Status Stepper Card */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block">Candidato Ativo</span>
                            <h3 className="font-bold text-slate-100 text-base">{candidate.name}</h3>
                            <p className="text-xs text-slate-400">{candidate.vacancyTitle || "Vaga em Seleção"}</p>
                        </div>

                        {/* Bloco de Informações de Contato */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-slate-800 pb-2">
                                Contato & Perfil
                            </h4>

                            <div className="space-y-3 text-xs">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Telefone / WhatsApp</span>
                                    <span className="font-mono font-bold text-emerald-400 text-sm block mt-0.5">{rawPhone || "Não informado"}</span>
                                </div>

                                {candidate.email && (
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-500 block">E-mail</span>
                                        <span className="font-medium text-slate-300 block mt-0.5">{candidate.email}</span>
                                    </div>
                                )}

                                {candidate.salary && (
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Salário Base Pretendido</span>
                                        <span className="font-bold text-emerald-400 block mt-0.5">R$ {candidate.salary}</span>
                                    </div>
                                )}

                                {candidate.companyName && (
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Empresa Contratante</span>
                                        <span className="font-semibold text-slate-300 block mt-0.5">{candidate.companyName}</span>
                                    </div>
                                )}

                                {candidate.address && (
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Endereço</span>
                                        <span className="text-slate-300 block mt-0.5">{candidate.address}</span>
                                    </div>
                                )}

                                {candidate.recruiterName && (
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Recrutador Responsável</span>
                                        <span className="font-bold text-indigo-400 block mt-0.5">{candidate.recruiterName}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Ações Rápidas de Admissão */}
                        <div className="pt-2">
                            <Button
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-2.5 rounded-xl shadow-lg gap-2"
                                onClick={() => {
                                    toast.info("Avançando candidato no fluxo de admissão...");
                                    onClose();
                                }}
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Avançar para Admissão</span>
                            </Button>
                        </div>

                    </div>

                    {/* COLUNA DIREITA: Workspace do WhatsApp CRM (8 Colunas) */}
                    <div className="lg:col-span-8 flex flex-col bg-slate-900 overflow-hidden">

                        {/* Top Bar de Abas (Chat | Anotações | Lembretes | Etiquetas | Cadastro) */}
                        <div className="bg-slate-950 border-b border-slate-800 px-4 py-2 flex items-center justify-between shrink-0 overflow-x-auto no-scrollbar">
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setActiveTab("chat")}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                                        activeTab === "chat"
                                            ? "bg-emerald-600 text-white shadow-md"
                                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                    }`}
                                >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>Chat</span>
                                </button>

                                <button
                                    onClick={() => setActiveTab("notes")}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                                        activeTab === "notes"
                                            ? "bg-emerald-600 text-white shadow-md"
                                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                    }`}
                                >
                                    <FileSignature className="w-3.5 h-3.5" />
                                    <span>Anotações ({notesList.length})</span>
                                </button>
                            </div>

                            {/* Templates Rápidos (Chips) */}
                            {activeTab === "chat" && (
                                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                                    {messageTemplates.map((tmpl, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => applyTemplate(tmpl.getText)}
                                            className="text-[10px] bg-slate-800 hover:bg-emerald-950 text-slate-300 hover:text-emerald-300 border border-slate-700/80 px-2.5 py-1 rounded-lg font-semibold shrink-0 whitespace-nowrap transition-all"
                                        >
                                            {tmpl.title}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* CONTEÚDO DA ABA CHAT */}
                        {activeTab === "chat" && (
                            <div className="flex-1 flex flex-col overflow-hidden relative">
                                
                                {/* Background Autêntico Estilo WhatsApp Wallpaper (#efeae2 em tom escuro) */}
                                <div
                                    className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar"
                                    style={{
                                        backgroundColor: "#0b141a",
                                        backgroundImage: "radial-gradient(#1f2c34 1px, transparent 1px)",
                                        backgroundSize: "20px 20px"
                                    }}
                                >
                                    {loadingHistory ? (
                                        <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                                            Carregando mensagens do Z-API...
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center text-center py-16 space-y-3">
                                            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl">
                                                <MessageSquare className="w-7 h-7" />
                                            </div>
                                            <p className="text-sm font-bold text-slate-200">Nenhuma conversa iniciada ainda.</p>
                                            <p className="text-xs text-slate-400 max-w-sm">
                                                Selecione um modelo acima ou digite uma mensagem para conversar em tempo real com {candidate.name}!
                                            </p>
                                        </div>
                                    ) : (
                                        messages.map((msg, index) => {
                                            const isSent = msg.senderType === "RECRUITER" || msg.senderType === "SYSTEM";
                                            const isFile = msg.messageType === "DOCUMENT" || msg.messageType === "IMAGE";
                                            
                                            return (
                                                <div
                                                    key={msg.id || index}
                                                    className={`flex flex-col ${isSent ? "items-end" : "items-start"}`}
                                                >
                                                    <div
                                                        className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed shadow-lg relative ${
                                                            isSent
                                                                ? "bg-[#005c4b] text-emerald-50 rounded-tr-none border border-emerald-600/40"
                                                                : "bg-[#202c33] text-slate-100 rounded-tl-none border border-slate-700/60"
                                                        }`}
                                                    >
                                                        {/* Autor Nome */}
                                                        <div className="font-bold text-[10px] text-emerald-300 mb-1">
                                                            *{msg.senderName || (isSent ? "Recrutador" : candidate.name)}*
                                                        </div>

                                                        {/* Renderização de Imagem / Arquivo */}
                                                        {isFile && (
                                                            <div className="mb-2 p-2 bg-black/20 rounded-xl border border-white/10 space-y-1.5">
                                                                {msg.messageType === "IMAGE" && msg.mediaUrl && (
                                                                    <img
                                                                        src={msg.mediaUrl}
                                                                        alt="Anexo"
                                                                        className="max-h-48 rounded-lg object-cover w-full"
                                                                    />
                                                                )}
                                                                <div className="flex items-center justify-between gap-2 text-xs">
                                                                    <span className="font-bold truncate text-emerald-200">
                                                                        {msg.mediaFileName || "Arquivo Anexo"}
                                                                    </span>
                                                                    {msg.mediaUrl && (
                                                                        <a
                                                                            href={msg.mediaUrl}
                                                                            download={msg.mediaFileName || "arquivo"}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="p-1 bg-emerald-600 rounded text-white hover:bg-emerald-500"
                                                                        >
                                                                            <Download className="w-3.5 h-3.5" />
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Conteúdo de Texto */}
                                                        <div className="whitespace-pre-wrap font-sans font-medium text-xs">
                                                            {msg.content}
                                                        </div>

                                                        {/* Timestamp & Status Checkmarks */}
                                                        <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-emerald-200/80 font-mono">
                                                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            {isSent && <CheckCheck className="w-3 h-3 text-emerald-300" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Barra de Controle Inferior (Anexo 📎 | Input | Enviar 🚀) */}
                                <div className="bg-[#202c33] p-3 border-t border-slate-800/80 flex items-end gap-2 shrink-0">
                                    
                                    {/* Botão Anexo de Arquivo */}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        accept="image/*,.pdf,.doc,.docx,.xlsx"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={sending}
                                        className="p-2.5 rounded-full text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-all shrink-0"
                                        title="Anexar documento ou imagem"
                                    >
                                        <Paperclip className="w-5 h-5" />
                                    </button>

                                    {/* Input de Texto Multi-linha */}
                                    <Textarea
                                        value={inputMessage}
                                        onChange={(e) => setInputMessage(e.target.value)}
                                        placeholder="Digite uma mensagem..."
                                        rows={1}
                                        className="flex-1 bg-[#2a3942] border-none text-slate-100 text-xs rounded-2xl focus:ring-1 focus:ring-emerald-500 resize-none p-3 placeholder:text-slate-400 max-h-24"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendText();
                                            }
                                        }}
                                    />

                                    {/* Botão de Envio */}
                                    <Button
                                        disabled={sending || !inputMessage.trim()}
                                        onClick={handleSendText}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-full w-10 h-10 p-0 shadow-lg shrink-0 flex items-center justify-center"
                                    >
                                        <Send className="w-4 h-4" />
                                    </Button>

                                </div>

                            </div>
                        )}

                        {/* CONTEÚDO DA ABA ANOTAÇÕES */}
                        {activeTab === "notes" && (
                            <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-slate-900 custom-scrollbar">
                                <div className="space-y-2">
                                    <h3 className="font-bold text-slate-100 text-sm">Anotações Internas do Candidato</h3>
                                    <Textarea
                                        value={noteText}
                                        onChange={(e) => setNoteText(e.target.value)}
                                        placeholder="Escreva anotações internas sobre este candidato (visível apenas para o RH)..."
                                        rows={3}
                                        className="bg-slate-950 border-slate-800 text-slate-200 text-xs rounded-xl"
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

                                <div className="space-y-2 pt-4 border-t border-slate-800">
                                    <span className="text-xs font-bold text-slate-400">Histórico de Anotações</span>
                                    {notesList.length === 0 ? (
                                        <p className="text-xs text-slate-500 italic py-4">Nenhuma anotação gravada ainda.</p>
                                    ) : (
                                        notesList.map((n, i) => (
                                            <div key={i} className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1">
                                                <p className="text-xs text-slate-200">{n.text}</p>
                                                <div className="flex justify-between text-[10px] text-slate-500">
                                                    <span>Por: {n.authorName}</span>
                                                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                    </div>

                </div>

            </DialogContent>
        </Dialog>
    );
}
