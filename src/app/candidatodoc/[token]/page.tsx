"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { FileText, Upload, CheckCircle2, Loader2, Shirt, Footprints, CreditCard, ShieldCheck, AlertCircle, Building2, User, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getCandidateByDocToken, submitCandidatePublicDocumentation } from "@/actions/recruitment";

const DOC_TYPES = [
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

export default function PublicCandidateDocPage() {
    const params = useParams();
    const token = params?.token as string;

    const [loading, setLoading] = useState(true);
    const [candidate, setCandidate] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [files, setFiles] = useState<Record<string, string>>({});
    const [uploadingKey, setUploadingKey] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submittedSuccess, setSubmittedSuccess] = useState(false);

    // Uniform & Banking Fields
    const [shoeSize, setShoeSize] = useState("");
    const [pantsSize, setPantsSize] = useState("");
    const [shirtSize, setShirtSize] = useState("");
    const [pixKey, setPixKey] = useState("");
    const [email, setEmail] = useState("");

    useEffect(() => {
        if (!token) return;
        async function fetchCandidate() {
            try {
                const res = await getCandidateByDocToken(token);
                if (res.error) {
                    setErrorMsg(res.error);
                } else if (res.candidate) {
                    setCandidate(res.candidate);
                    setEmail(res.candidate.email || "");
                    const existingFiles = (res.candidate.documentationFiles as Record<string, string>) || {};
                    setFiles(existingFiles);

                    const extra = (res.candidate.extraFields as any)?.uniformData || {};
                    setShoeSize(extra.shoeSize || "");
                    setPantsSize(extra.pantsSize || "");
                    setShirtSize(extra.shirtSize || "");
                    setPixKey(extra.pixKey || "");
                }
            } catch (e: any) {
                setErrorMsg("Erro ao carregar dados do link.");
            } finally {
                setLoading(false);
            }
        }
        fetchCandidate();
    }, [token]);

    function handleFileSelected(docKey: string, file: File) {
        setUploadingKey(docKey);
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            setFiles((prev) => ({ ...prev, [docKey]: dataUrl }));
            setUploadingKey(null);
            toast.success("Documento anexado!");
        };
        reader.readAsDataURL(file);
    }

    async function handleSubmit() {
        setSubmitting(true);
        try {
            await submitCandidatePublicDocumentation(token, files, {
                shoeSize,
                pantsSize,
                shirtSize,
                pixKey,
                email,
            });
            setSubmittedSuccess(true);
            toast.success("Documentos e dados enviados com sucesso!");
        } catch (e: any) {
            toast.error(e.message || "Erro ao enviar documentação.");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                    Carregando formulário de documentação...
                </div>
            </div>
        );
    }

    if (errorMsg) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-2xl border border-red-100 shadow-sm p-6 text-center space-y-3">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                    <h2 className="text-lg font-bold text-slate-800">Link Inoperante ou Expirado</h2>
                    <p className="text-xs text-slate-500">{errorMsg}</p>
                </div>
            </div>
        );
    }

    if (submittedSuccess) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-2xl border border-green-100 shadow-sm p-6 text-center space-y-4">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                    <h2 className="text-xl font-bold text-slate-900">Documentação Enviada!</h2>
                    <p className="text-xs text-slate-600">
                        Obrigado, <strong>{candidate?.name}</strong>! Seus documentos e informações de uniforme foram recebidos com sucesso pela nossa equipe de RH.
                    </p>
                </div>
            </div>
        );
    }

    const vacancyTitle = candidate?.vacancy?.role?.name || candidate?.vacancy?.title || "Processo Seletivo";
    const clientName = candidate?.vacancy?.posto?.client?.name || "";

    return (
        <div className="min-h-screen bg-slate-50/60 py-6 px-4 sm:px-6">
            <div className="max-w-md sm:max-w-xl mx-auto space-y-5">
                {/* Header Banner Card */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-indigo-600 text-xs font-black uppercase tracking-wider">
                        <ShieldCheck className="w-4.5 h-4.5" />
                        ENVIO DE DOCUMENTOS PARA ADMISSÃO
                    </div>
                    <h1 className="text-2xl font-black text-slate-900">{candidate?.name}</h1>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500 pt-1">
                        <Badge variant="outline" className="bg-indigo-50/80 text-indigo-700 border-indigo-200/80 px-3 py-1 rounded-xl font-semibold">
                            Vaga: {vacancyTitle}
                        </Badge>
                        {clientName && (
                            <Badge variant="outline" className="bg-slate-100/80 text-slate-700 px-3 py-1 rounded-xl font-semibold">
                                {clientName}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Form 1: Uniforms & PIX */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <Shirt className="w-4 h-4 text-indigo-600" />
                            1. Tamanhos de Uniformes e Chave PIX
                        </h2>
                    </div>

                    <div className="space-y-3 text-xs">
                        <div>
                            <Label className="text-xs font-bold text-slate-700 block mb-1">E-mail Pessoal</Label>
                            <Input
                                type="email"
                                placeholder="seu.email@exemplo.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="h-11 rounded-2xl border-slate-200 text-xs px-4 bg-white"
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold text-slate-700 block mb-1">Chave PIX (para pagamento de benefícios)</Label>
                            <Input
                                placeholder="CPF, Celular ou E-mail"
                                value={pixKey}
                                onChange={(e) => setPixKey(e.target.value)}
                                className="h-11 rounded-2xl border-slate-200 text-xs px-4 bg-white"
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold text-slate-700 block mb-1">Tamanho do Sapato / Calçado</Label>
                            <Input
                                placeholder="Ex: 40"
                                value={shoeSize}
                                onChange={(e) => setShoeSize(e.target.value)}
                                className="h-11 rounded-2xl border-slate-200 text-xs px-4 bg-white"
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold text-slate-700 block mb-1">Tamanho da Calça / Bermuda</Label>
                            <Input
                                placeholder="Ex: M / 42"
                                value={pantsSize}
                                onChange={(e) => setPantsSize(e.target.value)}
                                className="h-11 rounded-2xl border-slate-200 text-xs px-4 bg-white"
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold text-slate-700 block mb-1">Tamanho da Camisa / Camiseta</Label>
                            <Input
                                placeholder="Ex: G / 44"
                                value={shirtSize}
                                onChange={(e) => setShirtSize(e.target.value)}
                                className="h-11 rounded-2xl border-slate-200 text-xs px-4 bg-white"
                            />
                        </div>
                    </div>
                </div>

                {/* Form 2: Document Upload Section */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-3 space-y-1">
                        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <Upload className="w-4 h-4 text-indigo-600" />
                            2. Anexo dos Documentos Pessoais
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">
                            Tire fotos nítidas dos seus documentos ou envie em formato PDF.
                        </p>
                    </div>

                    <div className="space-y-3">
                        {DOC_TYPES.map((doc) => {
                            const isAttached = !!files[doc.key];
                            const isUploading = uploadingKey === doc.key;
                            return (
                                <div key={doc.key} className="grid grid-cols-[1fr_auto] gap-2.5 items-center">
                                    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-xs font-bold transition-all ${isAttached ? "bg-green-50/50 border-green-300 text-green-900" : "bg-slate-50/40 border-slate-200 text-slate-800"}`}>
                                        {isAttached ? (
                                            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
                                        )}
                                        <span className="truncate">{doc.label}</span>
                                    </div>

                                    <label className="shrink-0">
                                        <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleFileSelected(doc.key, file);
                                            }}
                                            disabled={isUploading}
                                        />
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className={`h-11 px-4 text-xs font-bold rounded-2xl border-slate-200 cursor-pointer shadow-none transition-all ${isAttached ? "bg-green-100 text-green-800 border-green-300" : "bg-white hover:bg-slate-50 text-slate-800"}`}
                                            asChild
                                            disabled={isUploading}
                                        >
                                            <span>
                                                {isUploading ? (
                                                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                                                ) : (
                                                    <Upload className="w-4 h-4 mr-1.5 text-slate-600" />
                                                )}
                                                {isAttached ? "Substituir" : "Anexar"}
                                            </span>
                                        </Button>
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Submit Action */}
                <Button
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 rounded-2xl text-sm font-black shadow-md"
                    onClick={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                    )}
                    {submitting ? "Enviando..." : "Finalizar e Enviar Documentos"}
                </Button>
            </div>
        </div>
    );
}
