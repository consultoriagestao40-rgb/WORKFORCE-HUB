"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertOctagon, Plus, Trash2, Paperclip, Upload, X, FileText } from "lucide-react";
import { registerAdministrativeMeasure, deleteAdministrativeMeasure } from "@/app/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

interface Measure {
    id: string;
    type: string;
    date: string;
    description: string;
    attachment?: { fileName: string; fileData: string } | null;
    createdAt?: string;
}

interface AdministrativeMeasuresCardProps {
    employeeId: string;
    measures: Measure[];
}

export function AdministrativeMeasuresCard({ employeeId, measures = [] }: AdministrativeMeasuresCardProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Form state
    const [type, setType] = useState("Advertência Escrita");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState("");
    const [attachment, setAttachment] = useState<{ fileName: string; fileData: string } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 4.2 * 1024 * 1024) {
            toast.error("O arquivo excede o limite máximo de 4.2MB.");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setAttachment({
                fileName: file.name,
                fileData: reader.result as string
            });
            toast.success("Documento carregado com sucesso!");
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveFile = () => {
        setAttachment(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!type || !date || !description) {
            toast.error("Preencha todos os campos obrigatórios.");
            return;
        }
        setLoading(true);
        try {
            const res = await registerAdministrativeMeasure(employeeId, {
                type,
                date,
                description,
                attachment
            });
            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success("Medida disciplinar registrada com sucesso!");
                setOpen(false);
                // Reset form
                setType("Advertência Escrita");
                setDate(new Date().toISOString().split('T')[0]);
                setDescription("");
                setAttachment(null);
                router.refresh();
            }
        } catch (err: any) {
            toast.error(err.message || "Erro de conexão.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta medida administrativa?")) return;
        try {
            const res = await deleteAdministrativeMeasure(employeeId, id);
            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success("Medida administrativa removida com sucesso!");
                router.refresh();
            }
        } catch (err: any) {
            toast.error(err.message || "Erro ao remover.");
        }
    };

    const handleDownload = (fileName: string, fileData: string) => {
        const link = document.createElement("a");
        link.href = fileData;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Card className="border-none shadow-premium overflow-hidden bg-white rounded-[2.5rem] border border-slate-100 p-8">
            <CardHeader className="p-0 mb-6 flex flex-row items-center justify-between gap-4">
                <div>
                    <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <AlertOctagon className="w-5 h-5 text-red-500" /> Medidas Administrativas & Advertências
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                        Histórico de advertências e suspensões aplicadas
                    </CardDescription>
                </div>
                
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-9 px-3 rounded-xl gap-1 text-xs">
                            <Plus className="w-3.5 h-3.5" /> Registrar Medida
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md p-6 bg-white rounded-3xl border border-slate-200 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-base font-black text-slate-800 flex items-center gap-1.5">
                                <AlertOctagon className="w-5 h-5 text-red-500" /> Registrar Medida Disciplinar
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">
                                Preencha as informações da advertência ou suspensão do colaborador.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-xs">
                            <div className="space-y-1.5">
                                <Label htmlFor="measure_type" className="font-bold text-slate-700">Tipo de Medida *</Label>
                                <select
                                    id="measure_type"
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    className="w-full text-xs border rounded-xl h-9 bg-white px-3 focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="Advertência Verbal">Advertência Verbal</option>
                                    <option value="Advertência Escrita">Advertência Escrita</option>
                                    <option value="Suspensão Disciplinar">Suspensão Disciplinar</option>
                                    <option value="Outros / Medida Interna">Outros / Medida Interna</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="measure_date" className="font-bold text-slate-700">Data de Aplicação *</Label>
                                <Input
                                    type="date"
                                    id="measure_date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    required
                                    className="h-9 text-xs rounded-xl"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="measure_desc" className="font-bold text-slate-700">Descrição / Motivo *</Label>
                                <Textarea
                                    id="measure_desc"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Escreva aqui detalhadamente a justificativa para esta medida administrativa..."
                                    required
                                    className="min-h-[80px] text-xs rounded-xl focus:ring-primary"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="font-bold text-slate-700">Documento Assinado (Anexo)</Label>
                                {!attachment ? (
                                    <div className="relative border border-dashed border-slate-200 hover:border-slate-350 bg-slate-50/50 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer group transition-colors">
                                        <Upload className="w-5 h-5 text-slate-400 group-hover:text-primary mb-1 transition-colors" />
                                        <span className="text-[10px] text-slate-500 font-bold">Clique para carregar o documento assinado (PDF ou Imagem)</span>
                                        <input 
                                            type="file" 
                                            accept=".pdf,.png,.jpg,.jpeg"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 opacity-0 cursor-pointer" 
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-250 rounded-xl">
                                        <div className="flex items-center gap-1.5 max-w-[80%]">
                                            <FileText className="w-4 h-4 text-primary shrink-0" />
                                            <span className="text-[10px] font-bold text-slate-700 truncate">{attachment.fileName}</span>
                                        </div>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={handleRemoveFile} 
                                            className="h-6 w-6 p-0 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <DialogFooter className="pt-2 flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl">
                                    {loading ? "Registrando..." : "Registrar"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent className="p-0">
                {measures.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50/50 border border-dashed rounded-3xl text-slate-400 font-bold text-xs">
                        Nenhuma medida administrativa ou advertência registrada para este colaborador.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {measures.map((m) => (
                            <div key={m.id} className="p-4 bg-slate-50 border border-slate-100 rounded-3xl flex flex-col md:flex-row md:items-start justify-between gap-4 hover:border-slate-200 transition-colors">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                            m.type.includes("Verbal") 
                                                ? "bg-blue-50 border-blue-200 text-blue-700" 
                                                : m.type.includes("Suspensão")
                                                    ? "bg-red-50 border-red-200 text-red-700"
                                                    : "bg-amber-50 border-amber-200 text-amber-700"
                                        }`}>
                                            {m.type}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-bold">
                                            {format(new Date(m.date), "dd/MM/yyyy")}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-700 font-bold mt-1.5 leading-relaxed">{m.description}</p>
                                    
                                    {m.attachment && (
                                        <div className="pt-2">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => handleDownload(m.attachment!.fileName, m.attachment!.fileData)}
                                                className="h-7 px-2 hover:bg-slate-200 text-[10px] font-black text-indigo-600 flex items-center gap-1 p-0.5"
                                            >
                                                <Paperclip className="w-3.5 h-3.5" />
                                                <span>Anexo: {m.attachment.fileName}</span>
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => handleDelete(m.id)}
                                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-full shrink-0 md:self-center"
                                    title="Remover Registro"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
