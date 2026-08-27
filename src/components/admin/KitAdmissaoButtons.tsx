"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, Send, FileCheck, Loader2, Sparkles, CheckCircle2, Eye, Clock } from "lucide-react";
import { sendKitAdmissaoToAutentique } from "@/actions/kit-admissao";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface KitAdmissaoButtonsProps {
    employeeId: string;
    employeeName: string;
    kitProcess?: any;
}

export function KitAdmissaoButtons({ employeeId, employeeName, kitProcess }: KitAdmissaoButtonsProps) {
    const router = useRouter();
    const [sending, setSending] = useState(false);
    const [open, setOpen] = useState(false);

    const autentiqueStatus = kitProcess?.autentiqueStatus;
    const isSigned = autentiqueStatus === 'ASSINADO';
    const isViewed = autentiqueStatus === 'VISUALIZADO';
    const isSent = autentiqueStatus === 'ENVIADO';

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
                router.refresh();
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
                    <FileCheck className="w-4 h-4" /> 
                    <span>Kit de Admissão</span>
                    {isSigned && (
                        <span className="flex items-center gap-1 bg-emerald-800/60 text-white text-[9px] px-1.5 py-0.5 rounded-full lowercase font-semibold">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-300" /> assinado
                        </span>
                    )}
                    {isViewed && (
                        <span className="flex items-center gap-1 bg-amber-800/60 text-amber-200 text-[9px] px-1.5 py-0.5 rounded-full lowercase font-semibold">
                            <Eye className="w-2.5 h-2.5 text-amber-300" /> visualizado
                        </span>
                    )}
                    {isSent && !isViewed && !isSigned && (
                        <span className="flex items-center gap-1 bg-blue-800/60 text-blue-200 text-[9px] px-1.5 py-0.5 rounded-full lowercase font-semibold">
                            <Clock className="w-2.5 h-2.5 text-blue-300" /> enviado
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-2 space-y-1">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between px-2 py-1">
                    <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Kit de Assinatura
                    </span>
                    {isSigned ? (
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Assinado
                        </span>
                    ) : isViewed ? (
                        <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Eye className="w-3 h-3 text-amber-600" /> Visualizado
                        </span>
                    ) : isSent ? (
                        <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-600" /> Enviado
                        </span>
                    ) : null}
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
                        <span>{isSigned ? "Reenviar WhatsApp" : isSent || isViewed ? "Reenviar WhatsApp" : "Enviar WhatsApp (Autentique)"}</span>
                        <span className="text-[10px] text-slate-400 font-normal">Assinatura digital via Autentique</span>
                    </div>
                </button>
            </PopoverContent>
        </Popover>
    );
}

