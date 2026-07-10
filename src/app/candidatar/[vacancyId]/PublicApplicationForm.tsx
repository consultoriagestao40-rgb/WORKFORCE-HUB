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
            <div className="flex flex-col items-center justify-center text-center p-8 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/25">
                    <CheckCircle className="w-12 h-12 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white uppercase tracking-wide">Inscrição Concluída!</h3>
                <p className="text-xs text-slate-400 max-w-md leading-relaxed font-medium">
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
                        className="text-xs border-slate-800 bg-slate-900/40 text-slate-300 hover:text-white hover:bg-slate-900 rounded-xl px-4 py-2"
                    >
                        Enviar outra candidatura
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-1">
                <Label htmlFor="name" className="text-slate-400 text-[10px] uppercase font-black tracking-wider">Nome Completo *</Label>
                <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: João da Silva"
                    required
                    disabled={isLoading}
                    className="bg-slate-950/40 border-slate-800 text-slate-100 placeholder:text-slate-700 focus:border-indigo-500/60 rounded-xl h-10 text-xs focus:ring-1 focus:ring-indigo-500/30 focus:outline-none transition-all shadow-inner"
                />
            </div>

            <div className="grid gap-1">
                <Label htmlFor="phone" className="text-slate-400 text-[10px] uppercase font-black tracking-wider">Telefone / WhatsApp *</Label>
                <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Ex: (11) 99999-9999"
                    required
                    disabled={isLoading}
                    className="bg-slate-950/40 border-slate-800 text-slate-100 placeholder:text-slate-700 focus:border-indigo-500/60 rounded-xl h-10 text-xs focus:ring-1 focus:ring-indigo-500/30 focus:outline-none transition-all shadow-inner"
                />
            </div>

            <div className="grid gap-1">
                <Label htmlFor="email" className="text-slate-400 text-[10px] uppercase font-black tracking-wider">E-mail (Opcional)</Label>
                <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Ex: joao@email.com"
                    disabled={isLoading}
                    className="bg-slate-950/40 border-slate-800 text-slate-100 placeholder:text-slate-700 focus:border-indigo-500/60 rounded-xl h-10 text-xs focus:ring-1 focus:ring-indigo-500/30 focus:outline-none transition-all shadow-inner"
                />
            </div>

            {/* Upload Area */}
            <div className="grid gap-1 pt-1">
                <Label className="text-slate-400 text-[10px] uppercase font-black tracking-wider font-semibold">Anexar Currículo (PDF ou Imagem) *</Label>
                <div 
                    onClick={() => !isLoading && document.getElementById("public-cv-upload")?.click()}
                    className={`border border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[110px]
                        ${fileName ? 'bg-indigo-950/15 border-indigo-500/40' : 'bg-slate-950/20 border-slate-800 hover:border-slate-700'}
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
                        <div className="space-y-1.5 flex flex-col items-center">
                            <div className="p-2 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                                <FileText className="w-5 h-5 text-indigo-400" />
                            </div>
                            <span className="text-xs font-semibold text-slate-200 block truncate max-w-[200px]">{fileName}</span>
                            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Alterar currículo</span>
                        </div>
                    ) : (
                        <div className="space-y-1.5 flex flex-col items-center">
                            <Upload className="w-6 h-6 text-slate-500" />
                            <span className="text-xs font-semibold text-slate-300 block">Clique para selecionar seu currículo</span>
                            <span className="text-[10px] text-slate-600 block">PDF ou Imagem (Máx: 8MB)</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="pt-3">
                <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-95 text-white font-extrabold h-11 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-indigo-500/10 border-0"
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
