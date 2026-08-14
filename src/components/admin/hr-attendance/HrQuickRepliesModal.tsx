"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Search, Send, Copy, Sparkles } from "lucide-react";
import { getHrQuickReplies } from "@/actions/hr-attendance";
import { toast } from "sonner";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectReply: (text: string) => void;
}

export function HrQuickRepliesModal({ open, onOpenChange, onSelectReply }: Props) {
    const [replies, setReplies] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

    useEffect(() => {
        if (open) {
            getHrQuickReplies().then(setReplies);
        }
    }, [open]);

    const categories = ["ALL", ...Array.from(new Set(replies.map(r => r.category)))];

    const filtered = replies.filter(r => {
        if (selectedCategory !== "ALL" && r.category !== selectedCategory) return false;
        if (search) {
            const q = search.toLowerCase();
            return r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q);
        }
        return true;
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl p-6 bg-white rounded-2xl max-h-[85vh] flex flex-col">
                <DialogHeader className="text-left space-y-1 flex-shrink-0">
                    <DialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500 fill-amber-400" />
                        Respostas Rápidas / Modelos de Atendimento RH
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Selecione um modelo pré-configurado para inserir diretamente no chat do WhatsApp.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2 flex-1 overflow-hidden flex flex-col">
                    {/* Search & Category Pills */}
                    <div className="space-y-2 flex-shrink-0">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <Input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Pesquisar modelo de mensagem..."
                                className="h-9 pl-9 text-xs rounded-xl bg-slate-50 border-slate-200"
                            />
                        </div>

                        <div className="flex items-center gap-1 overflow-x-auto pb-1">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                                        selectedCategory === cat
                                            ? "bg-slate-900 text-white"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                >
                                    {cat === "ALL" ? "Todos os Modelos" : cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Replies List */}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {filtered.map(reply => (
                            <div
                                key={reply.id}
                                className="bg-slate-50 hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-300 p-3 rounded-xl transition group flex flex-col justify-between gap-2"
                            >
                                <div className="flex items-center justify-between">
                                    <h4 className="font-extrabold text-xs text-slate-800 group-hover:text-emerald-700">
                                        {reply.title}
                                    </h4>
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600">
                                        {reply.category}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                                    {reply.content}
                                </p>
                                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/50">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            navigator.clipboard.writeText(reply.content);
                                            toast.success("Texto copiado!");
                                        }}
                                        className="h-7 text-[10px] font-bold rounded-lg"
                                    >
                                        <Copy className="w-3 h-3 mr-1" /> Copiar
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            onSelectReply(reply.content);
                                            onOpenChange(false);
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 text-[10px] rounded-lg"
                                    >
                                        <Send className="w-3 h-3 mr-1" /> Inserir no Chat
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
