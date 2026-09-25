"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Download, Send, CheckCircle2, Clock, Loader2, AlertTriangle, Eye } from "lucide-react";
import {
    generateDismissalNoticePdfBase64,
    sendDismissalNoticeToAutentique,
    checkEmployeeDismissalFields,
    saveEmployeeDismissalFields
} from "@/actions/dismissal-templates";
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

    // Dialog de campos faltantes
    const [missingDialog, setMissingDialog] = useState(false);
    const [savingFields, setSavingFields] = useState(false);
    const [fieldCtps, setFieldCtps] = useState("");
    const [fieldSerie, setFieldSerie] = useState("");
    const [fieldPis, setFieldPis] = useState("");
    const [missingList, setMissingList] = useState<string[]>([]);
    // Modo: 'preview' | 'send'
    const [pendingAction, setPendingAction] = useState<"preview" | "send">("preview");

    const autentiqueDocId = dismissalProcess?.autentiqueDocId;
    const autentiqueStatus = dismissalProcess?.autentiqueStatus;
    const isSigned = autentiqueStatus === 'ASSINADO';
    const isViewed = autentiqueStatus === 'VISUALIZADO';
    const isSent = autentiqueStatus === 'ENVIADO';

    /**
     * Verifica campos antes de gerar PDF.
     * Se houver campos faltando, abre dialog. Caso contrário executa ação diretamente.
     */
    const checkAndProceed = async (action: "preview" | "send") => {
        setLoadingPdf(true);
        try {
            const check = await checkEmployeeDismissalFields(employeeId);
            if (check.missingFields.length > 0) {
                // Preencher os valores já existentes nos inputs
                setFieldCtps(check.ctpsNumero);
                setFieldSerie(check.ctpsSerie);
                setFieldPis(check.pisNumero);
                setMissingList(check.missingFields);
                setPendingAction(action);
                setMissingDialog(true);
                return;
            }
            // Tudo OK — prosseguir direto
            if (action === "preview") {
                await doGeneratePdf({});
            } else {
                await doSendAutentique();
            }
        } catch (e: any) {
            toast.error(e.message || "Erro ao verificar dados do colaborador.");
        } finally {
            setLoadingPdf(false);
        }
    };

    /**
     * Salva os campos preenchidos no banco e depois executa a ação pendente.
     */
    const handleSaveMissingAndProceed = async () => {
        setSavingFields(true);
        try {
            // Salva de volta no extraFields (fix permanente para este colaborador)
            await saveEmployeeDismissalFields(employeeId, {
                ctpsNumero: fieldCtps,
                ctpsSerie: fieldSerie,
                pisNumero: fieldPis
            });

            setMissingDialog(false);

            // Executa a ação com os dados como override (garante que o PDF usa os valores recém inseridos)
            const overrides = {
                ctpsNumero: fieldCtps || undefined,
                ctpsSerie: fieldSerie || undefined,
                pisNumero: fieldPis || undefined
            };

            if (pendingAction === "preview") {
                await doGeneratePdf(overrides);
            } else {
                await doSendAutentique(overrides);
            }
        } catch (e: any) {
            toast.error(e.message || "Erro ao salvar dados.");
        } finally {
            setSavingFields(false);
        }
    };

    const doGeneratePdf = async (overrides: any = {}) => {
        setLoadingPdf(true);
        try {
            const dataUri = await generateDismissalNoticePdfBase64(employeeId, Object.keys(overrides).length > 0 ? overrides : undefined);
            setPdfBase64(dataUri);
        } catch (e: any) {
            toast.error(e.message || "Erro ao gerar PDF do aviso.");
        } finally {
            setLoadingPdf(false);
        }
    };

    const doSendAutentique = async (overrides?: any) => {
        setSendingAutentique(true);
        try {
            const res = await sendDismissalNoticeToAutentique(employeeId, overrides);
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

    const handleViewPdf = () => checkAndProceed("preview");
    const handleSendAutentique = () => {
        if (!confirm(`Deseja enviar a Notificação de Desligamento para assinatura digital de ${employeeName} via WhatsApp?`)) return;
        checkAndProceed("send");
    };

    const fieldLabels: Record<string, string> = {
        ctpsNumero: "Número da CTPS",
        ctpsSerie: "Série da CTPS",
        pisNumero: "PIS / PASEP / NIT"
    };

    return (
        <>
            <div className="flex items-center gap-1.5">
                {/* Botão de Ver / Baixar PDF */}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleViewPdf}
                    disabled={loadingPdf || sendingAutentique}
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
                    disabled={sendingAutentique || loadingPdf}
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
            </div>

            {/* ── Dialog: Campos Faltantes ── */}
            <Dialog open={missingDialog} onOpenChange={v => { if (!savingFields) setMissingDialog(v); }}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-700">
                            <AlertTriangle className="w-5 h-5" />
                            Dados incompletos no cadastro
                        </DialogTitle>
                    </DialogHeader>

                    <p className="text-sm text-slate-600 mb-1">
                        Os campos abaixo não estão preenchidos no cadastro de <strong>{employeeName}</strong>.
                        Preencha agora para que sejam salvos automaticamente e o aviso seja gerado corretamente.
                    </p>

                    <div className="space-y-3 py-1">
                        {(missingList.includes("ctpsNumero") || missingList.includes("ctpsSerie")) && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                                        Número CTPS {missingList.includes("ctpsNumero") && <span className="text-red-500">*</span>}
                                    </Label>
                                    <Input
                                        placeholder="Ex: 0315583"
                                        value={fieldCtps}
                                        onChange={e => setFieldCtps(e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                                        Série {missingList.includes("ctpsSerie") && <span className="text-red-500">*</span>}
                                    </Label>
                                    <Input
                                        placeholder="Ex: 6903"
                                        value={fieldSerie}
                                        onChange={e => setFieldSerie(e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {missingList.includes("pisNumero") && (
                            <div>
                                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                                    PIS / PASEP / NIT <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    placeholder="Ex: 031.558.369-03"
                                    value={fieldPis}
                                    onChange={e => setFieldPis(e.target.value)}
                                    className="h-9 text-sm"
                                />
                            </div>
                        )}
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1">
                        💾 Os dados serão salvos no cadastro do colaborador para não precisar informar novamente.
                    </p>

                    <DialogFooter className="mt-3 gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setMissingDialog(false)}
                            disabled={savingFields}
                            className="text-slate-500"
                        >
                            Cancelar
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSaveMissingAndProceed}
                            disabled={savingFields}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                        >
                            {savingFields ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Salvando...</>
                            ) : (
                                <><FileText className="w-3.5 h-3.5 mr-1" /> Salvar e Gerar Aviso</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Modal de Pré-visualização do PDF ── */}
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
                                    onClick={() => {
                                        setPdfBase64(null);
                                        if (!confirm(`Deseja enviar a Notificação de Desligamento para assinatura digital de ${employeeName} via WhatsApp?`)) return;
                                        doSendAutentique();
                                    }}
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
        </>
    );
}
