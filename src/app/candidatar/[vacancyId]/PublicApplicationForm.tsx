"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createPublicCandidate } from "@/actions/recruitment";
import { Upload, FileText, CheckCircle, Loader2 } from "lucide-react";

interface PublicApplicationFormProps {
    vacancyId: string;
}

export function PublicApplicationForm({ vacancyId }: PublicApplicationFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [fileName, setFileName] = useState("");
    const [fileBase64, setFileBase64] = useState<string | null>(null);
    const [fileMimeType, setFileMimeType] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: ""
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 8 * 1024 * 1024) { // 8MB limit
                toast.error("O arquivo do currículo deve ter menos de 8MB.");
                return;
            }

            setFileName(file.name);
            setFileMimeType(file.type || "application/pdf");

            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                // Strip metadata prefix from base64
                const base64 = result.split(",")[1];
                setFileBase64(base64);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error("Por favor, insira seu nome completo.");
            return;
        }

        if (!formData.phone.trim()) {
            toast.error("Por favor, insira seu telefone/WhatsApp.");
            return;
        }

        if (!fileBase64) {
            toast.error("Por favor, anexe o seu currículo (PDF ou Imagem).");
            return;
        }

        setIsLoading(true);

        try {
            const res = await createPublicCandidate({
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                vacancyId,
                fileBase64,
                fileMimeType: fileMimeType || "application/pdf"
            });

            if (res.success) {
                setIsSuccess(true);
                toast.success("Candidatura enviada com sucesso!");
            } else {
                toast.error("Erro ao enviar candidatura. Tente novamente.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro inesperado ao processar sua inscrição.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 bg-slate-900/30 border border-emerald-500/20 rounded-xl space-y-4 animate-in fade-in zoom-in duration-300">
                <CheckCircle className="w-16 h-16 text-emerald-400" />
                <h3 className="text-xl font-bold text-white">Inscrição Concluída!</h3>
                <p className="text-sm text-slate-300 max-w-md leading-relaxed">
                    Obrigado por enviar seu currículo! Se o seu perfil for compatível com a vaga, nosso time de recrutadores entrará em contato com você via WhatsApp ou Telefone.
                </p>
                <div className="pt-4">
                    <Button 
                        onClick={() => {
                            setIsSuccess(false);
                            setFormData({ name: "", email: "", phone: "" });
                            setFileName("");
                            setFileBase64(null);
                            setFileMimeType(null);
                        }}
                        variant="outline"
                        className="text-xs border-slate-700 text-slate-300 hover:text-white"
                    >
                        Enviar outra candidatura
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-2">
                <Label htmlFor="name" className="text-slate-300 text-xs uppercase font-bold tracking-wider">Nome Completo *</Label>
                <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: João da Silva"
                    required
                    disabled={isLoading}
                    className="bg-slate-900 border-slate-700/60 text-slate-100 placeholder:text-slate-600 focus:border-indigo-500"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="email" className="text-slate-300 text-xs uppercase font-bold tracking-wider">E-mail (Opcional)</Label>
                    <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Ex: joao@email.com"
                        disabled={isLoading}
                        className="bg-slate-900 border-slate-700/60 text-slate-100 placeholder:text-slate-600 focus:border-indigo-500"
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="phone" className="text-slate-300 text-xs uppercase font-bold tracking-wider">Telefone / WhatsApp *</Label>
                    <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="Ex: (11) 99999-9999"
                        required
                        disabled={isLoading}
                        className="bg-slate-900 border-slate-700/60 text-slate-100 placeholder:text-slate-600 focus:border-indigo-500"
                    />
                </div>
            </div>

            {/* Upload Area */}
            <div className="grid gap-2">
                <Label className="text-slate-300 text-xs uppercase font-bold tracking-wider">Anexar Currículo (PDF ou Imagem) *</Label>
                <div 
                    onClick={() => !isLoading && document.getElementById("public-cv-upload")?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200
                        ${fileName ? 'bg-indigo-950/20 border-indigo-500/40' : 'bg-slate-900/60 border-slate-700/60 hover:border-slate-500'}
                        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                >
                    <input
                        type="file"
                        id="public-cv-upload"
                        onChange={handleFileChange}
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="hidden"
                        disabled={isLoading}
                    />
                    
                    {fileName ? (
                        <div className="space-y-2 flex flex-col items-center">
                            <FileText className="w-10 h-10 text-indigo-400" />
                            <span className="text-sm font-medium text-slate-200 block truncate max-w-[280px]">{fileName}</span>
                            <span className="text-xs text-indigo-300 underline font-semibold">Alterar arquivo</span>
                        </div>
                    ) : (
                        <div className="space-y-2 flex flex-col items-center">
                            <Upload className="w-10 h-10 text-slate-500" />
                            <span className="text-sm font-medium text-slate-300 block">Clique para selecionar seu currículo</span>
                            <span className="text-[11px] text-slate-500 block">Formatos aceitos: PDF, JPEG, JPG ou PNG (Máx: 8MB)</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="pt-2">
                <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold h-11 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processando Candidatura...
                        </>
                    ) : (
                        "Enviar Candidatura"
                    )}
                </Button>
            </div>
        </form>
    );
}
