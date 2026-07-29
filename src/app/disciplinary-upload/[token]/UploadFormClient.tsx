"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileUp, Loader2, Camera, Check } from "lucide-react";
import { completeDisciplinaryMeasure } from "@/app/actions";
import { toast } from "sonner";

interface UploadFormClientProps {
    token: string;
}

export function UploadFormClient({ token }: UploadFormClientProps) {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!file) {
            toast.error("Por favor, selecione um arquivo.");
            return;
        }

        setLoading(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result as string;
                // base64 contains the data URL prefix (e.g. data:image/jpeg;base64,...)
                // We want to pass this base64 string to our action
                const res = await completeDisciplinaryMeasure(token, {
                    fileName: file.name,
                    fileData: base64
                });

                if (res.success) {
                    toast.success("Documento enviado e concluído com sucesso!");
                    window.location.reload(); // Refresh to show completed state
                } else {
                    toast.error(res.error || "Erro ao enviar arquivo.");
                }
            };
            reader.onerror = () => {
                toast.error("Erro ao ler arquivo.");
                setLoading(false);
            };
        } catch (e: any) {
            toast.error("Falha no upload.");
            console.error(e);
            setLoading(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="relative border-2 border-dashed border-slate-200 hover:border-rose-300 transition-colors rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50">
                <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={loading}
                />
                {file ? (
                    <div className="text-center space-y-1">
                        <Check className="w-8 h-8 text-emerald-500 mx-auto" />
                        <p className="text-xs font-bold text-slate-700 max-w-[200px] truncate mx-auto">{file.name}</p>
                        <p className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                ) : (
                    <div className="text-center space-y-1.5">
                        <Camera className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-xs font-bold text-slate-700">Tirar Foto ou Anexar PDF</p>
                        <p className="text-[10px] text-slate-400">Clique para abrir a câmera ou arquivos</p>
                    </div>
                )}
            </div>

            {file && (
                <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 text-xs gap-1.5"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                        </>
                    ) : (
                        <>
                            <FileUp className="w-4 h-4" /> Enviar Documento Assinado
                        </>
                    )}
                </Button>
            )}
        </div>
    );
}
