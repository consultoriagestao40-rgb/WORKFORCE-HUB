"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, Send, FileCheck, Loader2, Sparkles } from "lucide-react";
import { sendKitAdmissaoToAutentique } from "@/actions/kit-admissao";
import { toast } from "sonner";

interface KitAdmissaoButtonsProps {
    employeeId: string;
    employeeName: string;
}

export function KitAdmissaoButtons({ employeeId, employeeName }: KitAdmissaoButtonsProps) {
    const [sending, setSending] = useState(false);
    const [open, setOpen] = useState(false);

    const handleDownload = (type: "kit" | "os" | "termo" | "epi") => {
        window.open(`/api/admin/employees/${employeeId}/kit-admissao?type=${type}`, "_blank");
        setOpen(false);
    };

    const handleSendAutentique = async () => {
        setSending(true);
        try {
            const res = await sendKitAdmissaoToAutentique(employeeId);
            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success(res.message || `Kit de Admissão enviado para ${employeeName} via WhatsApp!`);
                setOpen(false);
            }
        } catch (e: any) {
            toast.error(e.message || "Erro ao enviar Kit de Admissão.");
        } finally {
            setSending(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold h-9 px-4 rounded-xl shadow-sm text-xs uppercase tracking-wider">
                    <FileCheck className="w-4 h-4" /> Kit de Admissão
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2 space-y-1">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 px-2 py-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Kit de Assinatura (Admissão)
                </div>
                <div className="h-px bg-slate-100 my-1" />
                
                <button
                    type="button"
                    onClick={() => handleDownload("kit")}
                    className="w-full text-left flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 cursor-pointer p-2.5 rounded-lg transition-colors"
                >
                    <Download className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="flex flex-col">
                        <span>Baixar Kit Completo (PDF)</span>
                        <span className="text-[10px] text-slate-400 font-normal">OS + Termo Ponto + Ficha EPI</span>
                    </div>
                </button>

                <div className="h-px bg-slate-100 my-1" />

                <button
                    type="button"
                    onClick={() => handleDownload("os")}
                    className="w-full text-left flex items-center gap-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer p-2 rounded-md transition-colors"
                >
                    <Download className="w-3.5 h-3.5 text-slate-400" /> Baixar Ordem de Serviço (NR-1)
                </button>

                <button
                    type="button"
                    onClick={() => handleDownload("termo")}
                    className="w-full text-left flex items-center gap-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer p-2 rounded-md transition-colors"
                >
                    <Download className="w-3.5 h-3.5 text-slate-400" /> Baixar Termo Uso de Celular
                </button>

                <button
                    type="button"
                    onClick={() => handleDownload("epi")}
                    className="w-full text-left flex items-center gap-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer p-2 rounded-md transition-colors"
                >
                    <Download className="w-3.5 h-3.5 text-slate-400" /> Baixar Ficha de EPI
                </button>

                <div className="h-px bg-slate-100 my-1" />

                <button
                    type="button"
                    onClick={handleSendAutentique}
                    disabled={sending}
                    className="w-full text-left flex items-center gap-2 text-xs font-bold text-blue-700 hover:bg-blue-50 cursor-pointer p-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                    {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                    ) : (
                        <Send className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                    <div className="flex flex-col">
                        <span>Enviar WhatsApp (Autentique)</span>
                        <span className="text-[10px] text-slate-400 font-normal">Assinatura digital válida</span>
                    </div>
                </button>
            </PopoverContent>
        </Popover>
    );
}
