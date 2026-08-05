"use client";

import { useState } from "react";
import { Stethoscope, Upload, CheckCircle2, XCircle, AlertTriangle, Loader2, FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { uploadAsoFile } from "@/src/actions/recruitment";

interface ExamePanelProps {
    candidateId: string;
    candidateName: string;
    asoFile?: string | null;
    asoStatus?: string | null;
    onUpdate: () => void;
}

export function ExamePanel({
    candidateId,
    candidateName,
    asoFile,
    asoStatus,
    onUpdate,
}: ExamePanelProps) {
    const [uploading, setUploading] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState(asoStatus || "APTO");

    async function handleFileUpload(file: File) {
        setUploading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target?.result as string;
                await uploadAsoFile(candidateId, dataUrl, selectedStatus);
                if (selectedStatus === "APTO") {
                    toast.success("ASO enviado! Candidato avançado automaticamente para Admissão (Onvio).");
                } else {
                    toast.warning(`ASO enviado com status: ${selectedStatus}`);
                }
                onUpdate();
                setUploading(false);
            };
            reader.readAsDataURL(file);
        } catch (e: any) {
            toast.error(e.message || "Erro ao enviar ASO");
            setUploading(false);
        }
    }

    const statusConfig = {
        APTO: { color: "bg-green-50 border-green-200 text-green-800", icon: CheckCircle2, label: "Apto" },
        INAPTO: { color: "bg-red-50 border-red-200 text-red-800", icon: XCircle, label: "Inapto" },
        PENDING: { color: "bg-yellow-50 border-yellow-200 text-yellow-800", icon: AlertTriangle, label: "Aguardando ASO" },
    }[asoStatus || "PENDING"] || { color: "bg-yellow-50 border-yellow-200 text-yellow-800", icon: AlertTriangle, label: "Aguardando ASO" };

    const StatusIcon = statusConfig.icon;

    return (
        <div className="space-y-4">
            {/* Status */}
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium ${statusConfig.color}`}>
                <StatusIcon className="w-4 h-4" />
                {statusConfig.label}
            </div>

            {/* Current ASO file */}
            {asoFile && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-slate-600" />
                        <span className="text-sm font-semibold text-slate-800">ASO Enviado</span>
                        <Badge className={`ml-auto text-[10px] ${asoStatus === "APTO" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} border-0`}>
                            {asoStatus === "APTO" ? "Apto" : asoStatus === "INAPTO" ? "Inapto" : "Pendente"}
                        </Badge>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => window.open(asoFile, "_blank")}
                    >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Visualizar ASO
                    </Button>
                </div>
            )}

            {/* Upload Section */}
            <div className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Stethoscope className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-semibold text-slate-800">
                        {asoFile ? "Substituir ASO" : "Upload do ASO"}
                    </span>
                </div>

                <div className="mb-3">
                    <label className="text-xs text-slate-500 uppercase font-semibold mb-1 block">
                        Resultado do Exame
                    </label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                        <SelectTrigger className="bg-white text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="APTO">
                                <span className="flex items-center gap-2">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                    Apto
                                </span>
                            </SelectItem>
                            <SelectItem value="INAPTO">
                                <span className="flex items-center gap-2">
                                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                                    Inapto
                                </span>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    {selectedStatus === "APTO" && (
                        <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Ao salvar, candidato será avançado automaticamente para Admissão (Onvio)
                        </p>
                    )}
                </div>

                <label className="block">
                    <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file);
                        }}
                        disabled={uploading}
                    />
                    <Button
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                        disabled={uploading}
                        asChild
                    >
                        <span>
                            {uploading ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Upload className="w-4 h-4 mr-2" />
                            )}
                            {uploading ? "Enviando..." : "Selecionar e Enviar ASO (PDF)"}
                        </span>
                    </Button>
                </label>
            </div>
        </div>
    );
}
