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
    Copy,
    Check
} from "lucide-react";
import { toast } from "sonner";
import { saveCandidateWhatsAppMessageAction, getCandidateWhatsAppHistoryAction } from "@/actions/recruitment-whatsapp";

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
        extraFields?: any;
    } | null;
}

interface MessageItem {
    id: string;
    content: string;
    senderName: string;
    createdAt: string;
    direction: "SENT" | "RECEIVED";
}

export function WhatsAppChatModal({ open, onClose, candidate }: WhatsAppChatModalProps) {
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [sending, setSending] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const rawPhone = candidate?.phone || candidate?.extraFields?.phone || candidate?.extraFields?.whatsapp || "";
    const phoneDigits = rawPhone.replace(/\D/g, "");
    const formattedWaPhone = phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`;

    // Templates Rápidos de Mensagens do RH
    const messageTemplates = [
        {
            title: "📋 Agendar Entrevista",
            getText: (name: string, vacancy: string) =>
                `Olá ${name}, referente à sua candidatura para a vaga de ${vacancy || "nossa empresa"} no Grupo JVS. Gostariamos de agendar uma entrevista! Qual o seu melhor horário?`
        },
        {
            title: "📝 Pedir Documentos",
            getText: (name: string, vacancy: string) =>
                `Olá ${name}, seu perfil foi aprovado na triagem inicial para a vaga de ${vacancy || "nossa empresa"}! Por favor, nos envie fotos legíveis do seu RG, CPF, PIS e Comprovante de Residência para darmos sequência.`
        },
        {
            title: "🩺 Agendar Exame (ASO)",
            getText: (name: string, vacancy: string) =>
                `Olá ${name}, sua admissão foi pré-aprovada! Precisamos agendar o seu Exame Médico Admissional (ASO). Por favor, confirme se pode comparecer nesta semana.`
        },
        {
            title: "🏢 Convocação / Início",
            getText: (name: string, vacancy: string) =>
                `Olá ${name}, parabéns! Você foi selecionado(a) para a vaga de ${vacancy || "nossa empresa"}. Favor comparecer à sede da empresa com seus documentos originais.`
        }
    ];

    useEffect(() => {
        if (open && candidate?.id) {
            fetchHistory();
        }
    }, [open, candidate?.id]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    async function fetchHistory() {
        if (!candidate?.id) return;
        setLoadingHistory(true);
        try {
            const res = await getCandidateWhatsAppHistoryAction(candidate.id);
            if (res.success && res.messages) {
                setMessages(res.messages);
            } else {
                setMessages([]);
            }
        } catch (e) {
            setMessages([]);
        } finally {
            setLoadingHistory(false);
        }
    }

    function applyTemplate(templateTextGetter: (name: string, vacancy: string) => string) {
        const text = templateTextGetter(
            candidate?.name || "Candidato",
            candidate?.vacancyTitle || "vaga aberta"
        );
        setInputMessage(text);
    }

    async function handleSendMessage(directOpenWa = true) {
        if (!inputMessage.trim() || !candidate?.id) return;

        const textToSend = inputMessage.trim();
        setSending(true);

        try {
            // 1. Salva no banco de dados (histórico do candidato)
            const saveRes = await saveCandidateWhatsAppMessageAction({
                candidateId: candidate.id,
                content: textToSend,
                direction: "SENT"
            });

            if (saveRes.success && saveRes.messageItem) {
                setMessages(prev => [...prev, saveRes.messageItem!]);
            } else {
                // Adiciona localmente fallback
                setMessages(prev => [
                    ...prev,
                    {
                        id: String(Date.now()),
                        content: textToSend,
                        senderName: "RH WorkForce Hub",
                        createdAt: new Date().toISOString(),
                        direction: "SENT"
                    }
                ]);
            }

            setInputMessage("");

            // 2. Abre o WhatsApp Web/App em nova aba com o texto pré-preenchido
            if (directOpenWa && phoneDigits) {
                const waUrl = `https://wa.me/${formattedWaPhone}?text=${encodeURIComponent(textToSend)}`;
                window.open(waUrl, "_blank", "noreferrer,noopener");
                toast.success("Mensagem salva no histórico e WhatsApp aberto em nova aba!");
            } else {
                toast.success("Mensagem salva no histórico do candidato!");
            }
        } catch (e: any) {
            toast.error(e.message || "Erro ao registrar mensagem.");
        } finally {
            setSending(false);
        }
    }

    function handleOpenDirectWhatsApp() {
        if (!phoneDigits) {
            toast.error("Candidato não possui telefone válido cadastrado.");
            return;
        }
        const text = inputMessage.trim() || `Olá ${candidate?.name || ""}, referente à sua candidatura para a vaga de ${candidate?.vacancyTitle || "nossa empresa"}...`;
        const waUrl = `https://wa.me/${formattedWaPhone}?text=${encodeURIComponent(text)}`;
        window.open(waUrl, "_blank", "noreferrer,noopener");
    }

    if (!candidate) return null;

    const initials = candidate.name
        ? candidate.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
        : "CD";

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-2xl w-full p-0 overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-slate-100 flex flex-col max-h-[90vh]">
                
                {/* Header Estilo WhatsApp Web / CRM Premium */}
                <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3.5">
                        <div className="relative">
                            <Avatar className="w-11 h-11 border-2 border-emerald-500/80 shadow-md">
                                <AvatarFallback className="bg-emerald-950 text-emerald-300 font-black text-sm">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-100 text-base leading-snug">{candidate.name}</h3>
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                                    WhatsApp Ativo
                                </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 font-medium">
                                <span className="flex items-center gap-1 font-mono text-emerald-400 font-bold">
                                    <Phone className="w-3 h-3 text-emerald-500" />
                                    {rawPhone || "Sem Telefone"}
                                </span>
                                {candidate.vacancyTitle && (
                                    <span className="truncate max-w-[200px] text-slate-400">
                                        • Vaga: {candidate.vacancyTitle}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleOpenDirectWhatsApp}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white border-none font-bold text-xs gap-1.5 rounded-xl shadow-md transition-all active:scale-95"
                            title="Abrir diretamente no WhatsApp Web"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Abrir Web</span>
                        </Button>
                    </div>
                </div>

                {/* Templates Rápidos (Chips Horizontais) */}
                <div className="bg-slate-900/90 border-b border-slate-800/80 p-2.5 px-4 overflow-x-auto flex items-center gap-2 shrink-0 no-scrollbar">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider shrink-0 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        Modelos:
                    </span>
                    {messageTemplates.map((tmpl, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => applyTemplate(tmpl.getText)}
                            className="text-xs bg-slate-800 hover:bg-emerald-950/80 text-slate-300 hover:text-emerald-300 border border-slate-700/70 hover:border-emerald-500/40 px-2.5 py-1 rounded-lg transition-all font-medium shrink-0 whitespace-nowrap active:scale-95"
                        >
                            {tmpl.title}
                        </button>
                    ))}
                </div>

                {/* Corpo do Chat / Histórico de Mensagens */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3.5 min-h-[280px] max-h-[380px] bg-slate-950/60 custom-scrollbar">
                    {loadingHistory ? (
                        <div className="flex items-center justify-center h-full text-slate-500 text-xs py-10">
                            Carregando histórico de conversas...
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-12 text-slate-500 space-y-2">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                <MessageSquare className="w-6 h-6" />
                            </div>
                            <p className="text-sm font-bold text-slate-300">Nenhum histórico gravado ainda.</p>
                            <p className="text-xs text-slate-400 max-w-sm">
                                Selecione um modelo rápido acima ou digite uma mensagem para conversar com {candidate.name}. O histórico ficará salvo para sempre no perfil!
                            </p>
                        </div>
                    ) : (
                        messages.map((msg, index) => {
                            const isSent = msg.direction === "SENT";
                            return (
                                <div
                                    key={msg.id || index}
                                    className={`flex flex-col ${isSent ? "items-end" : "items-start"}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm relative group ${
                                            isSent
                                                ? "bg-emerald-700/90 text-emerald-50 rounded-br-none border border-emerald-600/50"
                                                : "bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700"
                                        }`}
                                    >
                                        <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
                                        
                                        <div className={`flex items-center justify-between gap-3 mt-1.5 pt-1 border-t text-[9px] ${
                                            isSent ? "border-emerald-600/60 text-emerald-200" : "border-slate-700 text-slate-400"
                                        }`}>
                                            <span className="font-semibold">{msg.senderName || (isSent ? "RH" : candidate.name)}</span>
                                            <div className="flex items-center gap-1">
                                                <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                {isSent && <CheckCheck className="w-3 h-3 text-emerald-300" />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Compositor de Mensagem / Entrada de Texto */}
                <div className="bg-slate-950 p-3.5 border-t border-slate-800 space-y-2 shrink-0">
                    <Textarea
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder={`Digite sua mensagem para ${candidate.name}...`}
                        rows={2}
                        className="bg-slate-900 border-slate-800 text-slate-100 text-xs rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20 resize-none p-3 placeholder:text-slate-500"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(true);
                            }
                        }}
                    />

                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500 italic">
                            Pressione <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400 font-mono">Enter</kbd> para enviar e abrir no WhatsApp Web.
                        </span>

                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={sending || !inputMessage.trim()}
                                onClick={() => handleSendMessage(false)}
                                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs h-8 px-3 rounded-lg"
                                title="Salvar somente no histórico do candidato sem abrir guia do WhatsApp"
                            >
                                Salvar no Histórico
                            </Button>

                            <Button
                                size="sm"
                                disabled={sending || !inputMessage.trim()}
                                onClick={() => handleSendMessage(true)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 px-4 rounded-xl shadow-md gap-1.5 transition-all active:scale-95"
                            >
                                <Send className="w-3.5 h-3.5" />
                                <span>Enviar no WhatsApp</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
