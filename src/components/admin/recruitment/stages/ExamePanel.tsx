"use client";

import { useState } from "react";
import { Stethoscope, Upload, CheckCircle2, XCircle, AlertTriangle, Loader2, FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { uploadAsoFile, moveCandidateToStageByName } from "@/actions/recruitment";

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
    const [isMovingStage, setIsMovingStage] = useState(false);

    async function handleFileUpload(file: File) {
        setUploading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target?.result as string;
                await uploadAsoFile(candidateId, dataUrl, selectedStatus);
                if (selectedStatus === "APTO") {
                    toast.success("ASO analisado como APTO! Candidato avançado automaticamente para Admissão (Onvio).");
                } else {
                    toast.warning(`ASO enviado com status: INAPTO.`);
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

    async function handleMoveToStage(stageName: string, reason: string) {
        setIsMovingStage(true);
        try {
            await moveCandidateToStageByName(candidateId, stageName, reason);
            toast.success(`Candidato movido para ${stageName}`);
            onUpdate();
        } catch (e: any) {
            toast.error(e.message || "Erro ao mover candidato de etapa");
        } finally {
            setIsMovingStage(false);
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
                <span>{statusConfig.label}</span>
            </div>

            {/* Inapto Decision Alert & Flow Control */}
            {asoStatus === "INAPTO" && (
                <div className="border border-red-200 bg-red-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-2.5">
                        <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-bold text-red-900 text-xs uppercase tracking-wider">Candidato Inapto no Exame Médico</h4>
                            <p className="text-xs text-red-700 mt-1">
                                O ASO deste candidato indicou inaptidão para o cargo. Selecione abaixo a ação desejada:
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-red-200/60">
                        <Button
                            size="sm"
                            disabled={isMovingStage}
                            onClick={() => handleMoveToStage('Documentação', 'Candidato Inapto. Solicitada convocação de novo candidato para documentação.')}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs flex-1"
                        >
                            {isMovingStage ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                            Inserir Novo Candidato (Fase Documentação)
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={isMovingStage}
                            onClick={() => handleMoveToStage('Seleção', 'Candidato Inapto. Retornado para Seleção (Triagem).')}
                            className="border-red-300 text-red-800 hover:bg-red-100 text-xs flex-1"
                        >
                            📋 Voltar para Seleção (Triagem)
                        </Button>
                    </div>
                </div>
            )}

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
                                    Apto (Avança p/ Admissão)
                                </span>
                            </SelectItem>
                            <SelectItem value="INAPTO">
                                <span className="flex items-center gap-2">
                                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                                    Inapto (Solicita Ação)
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
                            {uploading ? "Enviando e Analisando..." : "Selecionar e Enviar ASO (PDF)"}
                        </span>
                    </Button>
                </label>
            </div>
        </div>
    );
}
