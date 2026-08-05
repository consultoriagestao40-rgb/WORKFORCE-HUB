"use client";

import { useState } from "react";
import { FileText, Link2, Upload, CheckCircle2, Clock, Copy, AlertTriangle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { generateDocumentationLink, uploadCandidateDocuments, approveDocumentation } from "@/src/actions/recruitment";

const DOC_TYPES = [
    { key: "rg", label: "RG (frente e verso)" },
    { key: "cpf", label: "CPF" },
    { key: "ctps", label: "Carteira de Trabalho" },
    { key: "comprResid", label: "Comprovante de Residência" },
    { key: "foto", label: "Foto 3x4" },
    { key: "certNasc", label: "Certidão de Nascimento/Casamento" },
];

interface DocumentacaoPanelProps {
    candidateId: string;
    candidateName: string;
    documentationLinkToken?: string | null;
    documentationFiles?: Record<string, string> | null;
    documentationStatus?: string | null;
    onUpdate: () => void;
}

export function DocumentacaoPanel({
    candidateId,
    candidateName,
    documentationLinkToken,
    documentationFiles,
    documentationStatus,
    onUpdate,
}: DocumentacaoPanelProps) {
    const [generatingLink, setGeneratingLink] = useState(false);
    const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
    const [approvingDocs, setApprovingDocs] = useState(false);

    const docs = (documentationFiles as Record<string, string>) || {};
    const submittedCount = Object.keys(docs).length;
    const totalDocs = DOC_TYPES.length;

    const publicLink = documentationLinkToken
        ? `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/candidatan/${documentationLinkToken}`
        : null;

    async function handleGenerateLink() {
        setGeneratingLink(true);
        try {
            await generateDocumentationLink(candidateId);
            toast.success("Link de documentação gerado!");
            onUpdate();
        } catch (e) {
            toast.error("Erro ao gerar link");
        } finally {
            setGeneratingLink(false);
        }
    }

    function handleCopyLink() {
        if (publicLink) {
            navigator.clipboard.writeText(publicLink);
            toast.success("Link copiado!");
        }
    }

    async function handleFileUpload(docKey: string, file: File) {
        setUploadingDoc(docKey);
        try {
            // Convert to base64 for storage (in production, upload to Vercel Blob / S3)
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target?.result as string;
                await uploadCandidateDocuments(candidateId, { [docKey]: dataUrl });
                toast.success("Documento enviado!");
                onUpdate();
                setUploadingDoc(null);
            };
            reader.readAsDataURL(file);
        } catch (e) {
            toast.error("Erro ao enviar documento");
            setUploadingDoc(null);
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
            {/* Status Badge */}
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium ${statusColor}`}>
                {documentationStatus === "APPROVED" ? (
                    <CheckCircle2 className="w-4 h-4" />
                ) : documentationStatus === "SUBMITTED" ? (
                    <FileText className="w-4 h-4" />
                ) : (
                    <Clock className="w-4 h-4" />
                )}
                {statusLabel}
                {submittedCount > 0 && (
                    <span className="ml-auto text-xs font-normal opacity-70">
                        {submittedCount}/{totalDocs} documentos
                    </span>
                )}
            </div>

            {/* Public Link Section */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center gap-2 mb-2">
                    <Link2 className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-semibold text-slate-800">Link para o Candidato</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                    Envie este link para <strong>{candidateName}</strong> enviar os documentos online.
                </p>
                {publicLink ? (
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 truncate font-mono">
                            {publicLink}
                        </div>
                        <Button size="sm" variant="outline" onClick={handleCopyLink} className="shrink-0">
                            <Copy className="w-3.5 h-3.5 mr-1" />
                            Copiar
                        </Button>
                    </div>
                ) : (
                    <Button
                        size="sm"
                        onClick={handleGenerateLink}
                        disabled={generatingLink}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        {generatingLink ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Link2 className="w-4 h-4 mr-2" />
                        )}
                        Gerar Link de Envio
                    </Button>
                )}
            </div>

            {/* Manual Upload Section */}
            <div className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Upload className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-semibold text-slate-800">Upload Manual pelo Recrutador</span>
                </div>
                <div className="space-y-2">
                    {DOC_TYPES.map((doc) => {
                        const hasFile = !!docs[doc.key];
                        const isUploading = uploadingDoc === doc.key;
                        return (
                            <div key={doc.key} className="flex items-center gap-2">
                                <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${hasFile ? "bg-green-50 border border-green-200" : "bg-slate-50 border border-slate-200"}`}>
                                    {hasFile ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                    ) : (
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 shrink-0" />
                                    )}
                                    <span className={hasFile ? "text-green-800 font-medium" : "text-slate-600"}>
                                        {doc.label}
                                    </span>
                                    {hasFile && <Badge className="ml-auto text-[10px] bg-green-100 text-green-700 border-0">Enviado</Badge>}
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
                                        className="text-xs h-7 px-2 cursor-pointer"
                                        asChild
                                        disabled={isUploading}
                                    >
                                        <span>
                                            {isUploading ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <Upload className="w-3 h-3" />
                                            )}
                                        </span>
                                    </Button>
                                </label>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Approve Button */}
            {documentationStatus !== "APPROVED" && (
                <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleApprove}
                    disabled={approvingDocs}
                >
                    {approvingDocs ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Aprovar Documentação e Avançar para Exame
                </Button>
            )}
        </div>
    );
}
