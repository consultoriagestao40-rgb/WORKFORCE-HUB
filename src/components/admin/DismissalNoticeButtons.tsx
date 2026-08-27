"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FileText, Download, Send, CheckCircle2, Clock, Loader2, Sparkles, Eye } from "lucide-react";
import { generateDismissalNoticePdfBase64, sendDismissalNoticeToAutentique } from "@/actions/dismissal-templates";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface DismissalNoticeButtonsProps {
    employeeId: string;
    employeeName: string;
    employeePhone?: string | null;
    dismissalProcess?: any;
    compact?: boolean;
}

export function DismissalNoticeButtons({
    employeeId,
    employeeName,
    employeePhone,
    dismissalProcess,
    compact = false
}: DismissalNoticeButtonsProps) {
    const router = useRouter();
    const [loadingPdf, setLoadingPdf] = useState(false);
    const [sendingAutentique, setSendingAutentique] = useState(false);
    const [pdfBase64, setPdfBase64] = useState<string | null>(null);

    const autentiqueDocId = dismissalProcess?.autentiqueDocId;
    const autentiqueStatus = dismissalProcess?.autentiqueStatus;
    const isSigned = autentiqueStatus === 'ASSINADO';
    const isViewed = autentiqueStatus === 'VISUALIZADO';
    const isSent = autentiqueStatus === 'ENVIADO';

    const handleViewPdf = async () => {
        setLoadingPdf(true);
        try {
            const dataUri = await generateDismissalNoticePdfBase64(employeeId);
            setPdfBase64(dataUri);
        } catch (e: any) {
            toast.error(e.message || "Erro ao gerar PDF do aviso.");
        } finally {
            setLoadingPdf(false);
        }
    };

    const handleSendAutentique = async () => {
        if (!confirm(`Deseja enviar a Notificação de Desligamento para assinatura digital de ${employeeName} via WhatsApp?`)) {
            return;
        }

        setSendingAutentique(true);
        try {
            const res = await sendDismissalNoticeToAutentique(employeeId);
            if (res && res.success) {
                toast.success(res.message || "Aviso enviado com sucesso para o WhatsApp do colaborador!");
                router.refresh();
            }
        } catch (e: any) {
            toast.error(e.message || "Erro ao enviar para Autentique.");
        } finally {
            setSendingAutentique(false);
        }
    };

    return (
        <div className="flex items-center gap-1.5">
            {/* Botão de Ver / Baixar PDF */}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleViewPdf}
                disabled={loadingPdf}
                className="h-8 px-2 text-xs font-bold text-slate-700 hover:text-indigo-600 hover:border-indigo-200"
                title="Visualizar e Baixar PDF do Aviso"
            >
                {loadingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1 text-indigo-500" />
                ) : (
                    <FileText className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                )}
                <span>Aviso PDF</span>
            </Button>

            {/* Botão de Enviar via WhatsApp (Autentique) */}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendAutentique}
                disabled={sendingAutentique}
                className={`h-8 px-2 text-xs font-bold ${
                    isSigned 
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100' 
                        : isViewed
                            ? 'text-amber-900 bg-amber-100 border-amber-300 hover:bg-amber-200'
                            : isSent 
                                ? 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100' 
                                : 'text-slate-700 hover:text-emerald-600 hover:border-emerald-200'
                }`}
                title={
                    isSigned 
                        ? "Documento Assinado Digitalmente (Autentique)" 
                        : isViewed
                            ? "Colaborador abriu e visualizou o aviso no WhatsApp. Aguardando assinatura."
                            : isSent 
                                ? "Aviso enviado no WhatsApp. Clique para reenviar se necessário" 
                                : "Enviar para assinatura digital no WhatsApp via Autentique"
                }
            >
                {sendingAutentique ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1 text-emerald-600" />
                ) : isSigned ? (
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                ) : isViewed ? (
                    <Eye className="w-3.5 h-3.5 mr-1 text-amber-600" />
                ) : isSent ? (
                    <Clock className="w-3.5 h-3.5 mr-1 text-blue-600" />
                ) : (
                    <Send className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                )}
                <span>{isSigned ? "Assinado" : isViewed ? "Visualizado" : isSent ? "Reenviar" : "Autentique"}</span>
            </Button>

            {/* Modal de Pré-visualização do PDF */}
            {pdfBase64 && (
                <Dialog open={!!pdfBase64} onOpenChange={() => setPdfBase64(null)}>
                    <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col rounded-2xl">
                        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-indigo-400" />
                                <span className="font-bold text-sm">Aviso de Desligamento - {employeeName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    onClick={handleSendAutentique}
                                    disabled={sendingAutentique}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                >
                                    <Send className="w-3.5 h-3.5 mr-1" />
                                    Enviar via Autentique
                                </Button>

                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-slate-800 text-xs text-white"
                                    onClick={() => {
                                        const link = document.createElement("a");
                                        link.href = pdfBase64;
                                        link.download = `Aviso_${employeeName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
                                        link.click();
                                    }}
                                >
                                    <Download className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                                    Baixar PDF
                                </Button>
                            </div>
                        </div>
                        <iframe src={pdfBase64} className="w-full flex-1 border-0" title="Aviso PDF Preview" />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
