"use client";

import { useState } from "react";
import { FileText, Link2, Upload, CheckCircle2, Clock, Copy, Loader2, Shirt, Footprints, CreditCard, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { generateDocumentationLink, uploadCandidateDocuments, approveDocumentation } from "@/actions/recruitment";

export const COMPLETE_DOC_TYPES = [
    { key: "rg", label: "RG (frente e verso)" },
    { key: "cpf", label: "CPF" },
    { key: "ctps", label: "Carteira de Trabalho (CTPS)" },
    { key: "comprResid", label: "Comprovante de Residência" },
    { key: "foto", label: "Foto 3x4" },
    { key: "certNasc", label: "Certidão de Nascimento / Casamento" },
    { key: "tituloEleitor", label: "Título de Eleitor" },
    { key: "reservista", label: "Certificado de Reservista (se masculino)" },
    { key: "valeTransporte", label: "Cartão VEM / Vale Transporte" },
    { key: "escolaridade", label: "Comprovante de Escolaridade" },
];

interface DocumentacaoPanelProps {
    candidateId: string;
    candidateName: string;
    documentationLinkToken?: string | null;
    documentationFiles?: Record<string, string> | null;
    documentationStatus?: string | null;
    extraFields?: Record<string, any> | null;
    onUpdate: () => void;
}

export function DocumentacaoPanel({
    candidateId,
    candidateName,
    documentationLinkToken,
    documentationFiles,
    documentationStatus,
    extraFields,
    onUpdate,
}: DocumentacaoPanelProps) {
    const [generatingLink, setGeneratingLink] = useState(false);
    const [expirationHours, setExpirationHours] = useState("48");
    const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
    const [approvingDocs, setApprovingDocs] = useState(false);
    const [savingUniforms, setSavingUniforms] = useState(false);

    const uniformData = extraFields?.uniformData || {};

    const [shoeSize, setShoeSize] = useState(uniformData.shoeSize || "");
    const [pantsSize, setPantsSize] = useState(uniformData.pantsSize || "");
    const [shirtSize, setShirtSize] = useState(uniformData.shirtSize || "");
    const [pixKey, setPixKey] = useState(uniformData.pixKey || "");

    const docs = (documentationFiles as Record<string, string>) || {};
    const submittedCount = Object.keys(docs).length;
    const totalDocs = COMPLETE_DOC_TYPES.length;

    const publicLink = documentationLinkToken
        ? `${typeof window !== "undefined" ? window.location.origin : ""}/candidatodoc/${documentationLinkToken}`
        : null;

    async function handleGenerateLink() {
        setGeneratingLink(true);
        try {
            await generateDocumentationLink(candidateId, parseInt(expirationHours));
            toast.success("Link de documentação gerado com sucesso!");
            onUpdate();
        } catch (e: any) {
            toast.error(e.message || "Erro ao gerar link");
        } finally {
            setGeneratingLink(false);
        }
    }

    function handleCopyLink() {
        if (publicLink) {
            navigator.clipboard.writeText(publicLink);
            toast.success("Link público copiado para a área de transferência!");
        }
    }

    async function handleFileUpload(docKey: string, file: File) {
        setUploadingDoc(docKey);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target?.result as string;
                await uploadCandidateDocuments(candidateId, { [docKey]: dataUrl }, { shoeSize, pantsSize, shirtSize, pixKey });
                toast.success("Documento enviado com sucesso!");
                onUpdate();
                setUploadingDoc(null);
            };
            reader.readAsDataURL(file);
        } catch (e: any) {
            toast.error(e.message || "Erro ao enviar documento");
            setUploadingDoc(null);
        }
    }

    async function handleSaveUniforms() {
        setSavingUniforms(true);
        try {
            await uploadCandidateDocuments(candidateId, {}, { shoeSize, pantsSize, shirtSize, pixKey });
            toast.success("Informações de uniformes salvas!");
            onUpdate();
        } catch (e: any) {
            toast.error(e.message || "Erro ao salvar informações");
        } finally {
            setSavingUniforms(false);
        }
    }

    async function handleApprove() {
        setApprovingDocs(true);
        try {
            await approveDocumentation(candidateId);
            toast.success("Documentação aprovada! Candidato avançado para Exame Médico.");
            onUpdate();
        } catch (e: any) {
            toast.error(e.message || "Erro ao aprovar documentação");
        } finally {
            setApprovingDocs(false);
        }
    }

    const statusColor = {
        PENDING: "bg-yellow-50 border-yellow-200 text-yellow-800",
        SUBMITTED: "bg-blue-50 border-blue-200 text-blue-800",
        APPROVED: "bg-green-50 border-green-200 text-green-800",
    }[documentationStatus || "PENDING"] || "bg-yellow-50 border-yellow-200 text-yellow-800";

    const statusLabel = {
        PENDING: "Aguardando Documentos",
        SUBMITTED: "Documentos Recebidos",
        APPROVED: "Documentação Aprovada",
    }[documentationStatus || "PENDING"] || "Aguardando Documentos";

    return (
        <div className="space-y-4">
            {/* Header Status Badge */}
            <div className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium ${statusColor}`}>
                <div className="flex items-center gap-2">
                    {documentationStatus === "APPROVED" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : documentationStatus === "SUBMITTED" ? (
                        <FileText className="w-4 h-4 text-blue-600" />
                    ) : (
                        <Clock className="w-4 h-4 text-yellow-600" />
                    )}
                    <span>{statusLabel}</span>
                </div>
                <span className="text-xs font-normal opacity-80">
                    {submittedCount}/{totalDocs} documentos anexados
                </span>
            </div>

            {/* Public Link Generator */}
            <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/30 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-indigo-600" />
                        <span className="text-sm font-semibold text-indigo-900">Link Público para o Candidato</span>
                    </div>
                    <Badge variant="outline" className="bg-indigo-100/60 text-indigo-700 border-indigo-200 text-[10px]">
                        Sem senha necessária
                    </Badge>
                </div>
                <p className="text-xs text-slate-600">
                    O candidato acessa este link publicamente pelo celular ou computador para enviar os documentos e dados de uniforme.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 w-full min-w-0 overflow-hidden">
                    <div className="w-full sm:w-44 shrink-0">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Prazo de Validade</Label>
                        <Select value={expirationHours} onValueChange={setExpirationHours} disabled={generatingLink}>
                            <SelectTrigger className="bg-white text-xs h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="24">24 Horas</SelectItem>
                                <SelectItem value="48">48 Horas (2 dias)</SelectItem>
                                <SelectItem value="168">7 Dias</SelectItem>
                                <SelectItem value="0">Sem Expiração</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex-1 min-w-0 w-full">
                        {publicLink ? (
                            <div className="flex items-center gap-2 w-full min-w-0 overflow-hidden">
                                <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 truncate font-mono select-all overflow-hidden">
                                    {publicLink}
                                </div>
                                <Button size="sm" variant="outline" onClick={handleCopyLink} className="shrink-0 h-8 text-xs">
                                    <Copy className="w-3.5 h-3.5 mr-1" />
                                    Copiar
                                </Button>
                            </div>
                        ) : (
                            <Button
                                size="sm"
                                onClick={handleGenerateLink}
                                disabled={generatingLink}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs"
                            >
                                {generatingLink ? (
                                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                                ) : (
                                    <Link2 className="w-3.5 h-3.5 mr-2" />
                                )}
                                Gerar Link de Envio
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Informações de Tamanho & Uniformes (Sapato, Calça, Camisa) */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3 w-full min-w-0 overflow-hidden">
                <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                        <Shirt className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="truncate">Tamanhos de Uniforme & Dados Bancários (Digitados)</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={handleSaveUniforms} disabled={savingUniforms} className="h-7 text-xs text-indigo-600 hover:bg-indigo-50 shrink-0">
                        {savingUniforms ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                        Salvar Dados
                    </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs w-full min-w-0">
                    <div className="min-w-0">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold truncate block">Sapato / Calçado</Label>
                        <Input
                            placeholder="Ex: 40"
                            value={shoeSize}
                            onChange={(e) => setShoeSize(e.target.value)}
                            className="h-8 text-xs mt-1 w-full"
                        />
                    </div>
                    <div className="min-w-0">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold truncate block">Calça / Bermuda</Label>
                        <Input
                            placeholder="Ex: M / 42"
                            value={pantsSize}
                            onChange={(e) => setPantsSize(e.target.value)}
                            className="h-8 text-xs mt-1 w-full"
                        />
                    </div>
                    <div className="min-w-0">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold truncate block">Camisa / Camiseta</Label>
                        <Input
                            placeholder="Ex: G / 44"
                            value={shirtSize}
                            onChange={(e) => setShirtSize(e.target.value)}
                            className="h-8 text-xs mt-1 w-full"
                        />
                    </div>
                    <div className="min-w-0">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold truncate block">Chave PIX</Label>
                        <Input
                            placeholder="CPF, E-mail, Celular"
                            value={pixKey}
                            onChange={(e) => setPixKey(e.target.value)}
                            className="h-8 text-xs mt-1 w-full"
                        />
                    </div>
                </div>
            </div>

            {/* Complete Document Upload List */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3 w-full min-w-0 overflow-hidden">
                <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-sm font-semibold text-slate-800 flex items-center gap-2 truncate">
                        <Upload className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="truncate">Relação Completa de Documentos para Admissão</span>
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">PDF ou Imagem</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 w-full min-w-0">
                    {COMPLETE_DOC_TYPES.map((doc) => {
                        const hasFile = !!docs[doc.key];
                        const isUploading = uploadingDoc === doc.key;
                        return (
                            <div key={doc.key} className="flex items-center gap-2 min-w-0 w-full">
                                <div className={`flex-1 min-w-0 flex items-center justify-between px-3 py-2 rounded-lg text-xs border ${hasFile ? "bg-green-50 border-green-200 text-green-900 font-medium" : "bg-slate-50 border-slate-200 text-slate-700"}`}>
                                    <div className="flex items-center gap-2 truncate min-w-0">
                                        {hasFile ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                        ) : (
                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 shrink-0" />
                                        )}
                                        <span className="truncate">{doc.label}</span>
                                    </div>
                                    {hasFile && <Badge className="text-[9px] bg-green-100 text-green-700 border-0 shrink-0">OK</Badge>}
                                </div>
                                <label className="shrink-0">
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileUpload(doc.key, file);
                                        }}
                                        disabled={isUploading}
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs h-8 w-8 p-0 cursor-pointer"
                                        asChild
                                        disabled={isUploading}
                                        title={`Upload ${doc.label}`}
                                    >
                                        <span>
                                            {isUploading ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Upload className="w-3.5 h-3.5" />
                                            )}
                                        </span>
                                    </Button>
                                </label>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Approval Action */}
            {documentationStatus !== "APPROVED" && (
                <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    onClick={handleApprove}
                    disabled={approvingDocs}
                >
                    {approvingDocs ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Aprovar Documentação e Avançar para Exame Médico
                </Button>
            )}
        </div>
    );
}
