import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { X, MessageSquare, Send, Paperclip, CheckCircle2, XCircle, Clock, Save, User, Mail, Phone, Calendar, Briefcase, MapPin, Building2, Building, DollarSign, AlertCircle, Trash2, Copy, FileText, Upload, AlertTriangle, ChevronDown, Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { withdrawCandidate, getRecruitmentTimeline, moveCandidate, deleteCandidate, updateVacancy, addVacancyParticipant, removeVacancyParticipant, addRecruitmentComment, getRecruitmentComments, getVacancyCandidates, evaluateCandidateWithAI, updateCandidateEvaluation, selectCandidateForVacancy, advanceCandidateToStage } from "@/actions/recruitment";
import { DocumentacaoPanel } from "./stages/DocumentacaoPanel";
import { ExamePanel } from "./stages/ExamePanel";
import { OnvioPanel } from "./stages/OnvioPanel";
import { BeneficiosPanel } from "./stages/BeneficiosPanel";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, Plus, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { ApprovalModal } from "./ApprovalModal";
import { AdmissionWorkflow } from "./admission/AdmissionWorkflow";
import { WhatsAppChatModal } from "./WhatsAppChatModal";
import { useRouter } from "next/navigation";

interface CandidateDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    candidate: any; // extended in implementation
    onWithdrawSuccess?: (candidateId: string) => void;
    stages?: any[]; // Passed from parent to determine flows
    currentUser?: any;
    recruiters?: any[];
}

export function CandidateDetailsModal({ open, onOpenChange, candidate, onWithdrawSuccess, stages = [], currentUser, recruiters = [] }: CandidateDetailsModalProps) {
    const router = useRouter();
    const [timeline, setTimeline] = useState<any[]>([]);
    const [loadingTimeline, setLoadingTimeline] = useState(false);

    // Approval Flow State
    const [approvalModalOpen, setApprovalModalOpen] = useState(false);
    const [approvalAction, setApprovalAction] = useState<"APPROVE" | "REJECT" | null>(null);

    // Requisitos do Perfil
    const [reqGender, setReqGender] = useState("Ambos");
    const [reqExperience, setReqExperience] = useState("");
    const [reqAgeMin, setReqAgeMin] = useState("");
    const [reqAgeMax, setReqAgeMax] = useState("");
    const [reqKnowledge, setReqKnowledge] = useState("");
    const [plannedStartDate, setPlannedStartDate] = useState("");
    const [isSavingRequirements, setIsSavingRequirements] = useState(false);

    // ATS & Checklist personalizados
    const [vacancyReqs, setVacancyReqs] = useState<{ id: string, name: string, isKnockout: boolean }[]>([]);
    const [newReqText, setNewReqText] = useState("");
    const [newReqIsKnockout, setNewReqIsKnockout] = useState(false);
    const [rankedCandidates, setRankedCandidates] = useState<any[]>([]);
    const [isLoadingRanked, setIsLoadingRanked] = useState(false);
    const [isUploadingCv, setIsUploadingCv] = useState(false);
    const [isUploadingVacancyCv, setIsUploadingVacancyCv] = useState(false);
    const [expandedRankId, setExpandedRankId] = useState<string | null>(null);
    const [rankEvals, setRankEvals] = useState<Record<string, any[]>>({});
    
    // Admission & Selection State
    const [selectedAdmissionCandidateId, setSelectedAdmissionCandidateId] = useState<string>("");
    const [selectedCandidateForVacancyId, setSelectedCandidateForVacancyId] = useState<string>(
        candidate?.vacancy?.customRequirements?.selectedCandidateId || candidate?.vacancy?.selectedCandidateId || ""
    );
    const [notes, setNotes] = useState("");
    const [isVacancyReqsExpanded, setIsVacancyReqsExpanded] = useState(false);
    const [isReevaluatingAi, setIsReevaluatingAi] = useState(false);

    useEffect(() => {
        const selId = candidate?.vacancy?.customRequirements?.selectedCandidateId || candidate?.vacancy?.selectedCandidateId;
        if (selId) {
            setSelectedCandidateForVacancyId(selId);
            setSelectedAdmissionCandidateId(selId);
        }
    }, [candidate]);

    const handleSelectCandidateForProcess = async (cand: any) => {
        const vacancyId = candidate?.vacancy?.id || (candidate?.type === 'VACANCY' ? (candidate.realId || candidate.id.replace('VAC-', '')) : null);
        if (!vacancyId) return;
        try {
            await selectCandidateForVacancy(vacancyId, cand.id);
            setSelectedCandidateForVacancyId(cand.id);
            setSelectedAdmissionCandidateId(cand.id);
            toast.success(`🏆 Candidato(a) "${cand.name}" foi escolhido(a) para seguir no processo da vaga!`);
            router.refresh();
        } catch (e: any) {
            toast.error(e.message || "Erro ao selecionar candidato");
        }
    };

    // WhatsApp Chat Modal State
    const [waCandidate, setWaCandidate] = useState<any | null>(null);
    const [waModalOpen, setWaModalOpen] = useState(false);

    function handleOpenWhatsAppChat(cand: any) {
        setWaCandidate({
            id: cand.id,
            name: cand.name,
            phone: cand.phone || cand.extraFields?.phone || cand.extraFields?.whatsapp || "",
            email: cand.email,
            vacancyTitle: candidate?.vacancy?.role?.name || candidate?.vacancy?.title || "",
            companyName: candidate?.vacancy?.company?.name || "",
            extraFields: cand.extraFields
        });
        setWaModalOpen(true);
    }


    const handleSaveRequirements = async () => {
        if (!candidate?.vacancy?.id) return;
        setIsSavingRequirements(true);
        try {
            await updateVacancy(candidate.vacancy.id, {
                reqGender: reqGender === "Ambos" ? "Ambos" : reqGender,
                reqExperience: reqExperience || "",
                reqKnowledge: reqKnowledge || "",
                reqAgeMin: reqAgeMin ? parseInt(reqAgeMin) : null,
                reqAgeMax: reqAgeMax ? parseInt(reqAgeMax) : null,
                plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null
            });
            toast.success("Requisitos do perfil salvados!");
            router.refresh();
        } catch (e) {
            toast.error("Erro ao salvar requisitos");
        } finally {
            setIsSavingRequirements(false);
        }
    };

    const handleAddVacancyReq = async () => {
        if (!newReqText.trim() || !candidate?.vacancy?.id) return;
        const updated = [
            ...vacancyReqs,
            { id: `req-${Date.now()}`, name: newReqText.trim(), isKnockout: newReqIsKnockout }
        ];
        setVacancyReqs(updated);
        setNewReqText("");
        setNewReqIsKnockout(false);
        
        await updateVacancy(candidate.vacancy.id, { customRequirements: updated });
        toast.success("Checklist da vaga atualizado!");
        router.refresh();
    };

    const handleRemoveVacancyReq = async (id: string) => {
        if (!candidate?.vacancy?.id) return;
        const updated = vacancyReqs.filter(r => r.id !== id);
        setVacancyReqs(updated);
        await updateVacancy(candidate.vacancy.id, { customRequirements: updated });
        toast.success("Requisito removido!");
        router.refresh();
    };

    const handleToggleCustomReq = async (reqId: string, newValue: boolean | null) => {
        if (!candidate?.id) return;
        const evaluation = candidate.requirementsEvaluation || {};
        const currentEvaluations = evaluation.customEvaluations || [];
        
        let updatedEvaluations = [...currentEvaluations];
        if (currentEvaluations.some((e: any) => e.reqId === reqId)) {
            updatedEvaluations = currentEvaluations.map((e: any) => 
                e.reqId === reqId ? { ...e, value: newValue } : e
            );
        } else {
            const reqObj = (candidate.vacancy?.customRequirements as any[] || []).find(r => r.id === reqId);
            if (reqObj) {
                updatedEvaluations.push({ reqId, name: reqObj.name, value: newValue });
            }
        }
        
        await updateCandidateEvaluation(candidate.id, {
            customEvaluations: updatedEvaluations
        });
        toast.success("Avaliação atualizada!");
        router.refresh();
    };

    const handleSaveNotes = async () => {
        if (!candidate?.id) return;
        await updateCandidateEvaluation(candidate.id, { notes });
        toast.success("Observações salvas!");
        router.refresh();
    };

    const handleManualCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !candidate?.id) return;
        setIsUploadingCv(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const result = reader.result as string;
                const base64 = result.split(",")[1];
                toast.info("Processando currículo com IA do Gemini...");
                await evaluateCandidateWithAI(candidate.id, base64, file.type);
                toast.success("Triagem por IA concluída com sucesso!");
                router.refresh();
                onOpenChange(false);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error(err);
            toast.error("Erro ao analisar currículo");
        } finally {
            setIsUploadingCv(false);
        }
    };

    // Upload de CV para CRIAR candidato diretamente na vaga
    const handleVacancyCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const vacId = candidate?.realId || candidate?.id?.replace('VAC-', '');
        if (!vacId) return;
        setIsUploadingVacancyCv(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const result = reader.result as string;
                const base64 = result.split(",")[1];
                toast.info("Lendo currículo e criando candidato...");
                const { createPublicCandidate } = await import("@/actions/recruitment");
                await createPublicCandidate({
                    vacancyId: vacId,
                    name: `Candidato (${file.name})`,
                    email: '',
                    phone: '',
                    fileBase64: base64,
                    fileMimeType: file.type
                });
                toast.success("Candidato criado e analisado pela IA!");
                // Refresh ranking
                setIsLoadingRanked(true);
                const updated = await getVacancyCandidates(vacId);
                setRankedCandidates(updated);
                setIsLoadingRanked(false);
                router.refresh();
            };
            reader.readAsDataURL(file);
        } catch (err: any) {
            toast.error(err?.message || "Erro ao processar currículo");
        } finally {
            setIsUploadingVacancyCv(false);
        }
    };
    const handleDeleteRankedCandidate = async (e: React.MouseEvent, candidateId: string, candidateName: string) => {
        e.stopPropagation();
        if (!confirm(`Tem certeza que deseja EXCLUIR permanentemente o candidato "${candidateName}"?`)) return;
        
        try {
            await deleteCandidate(candidateId);
            toast.success("Candidato excluído permanentemente!");
            
            const vacId = candidate?.realId || candidate?.id?.replace('VAC-', '');
            if (vacId) {
                setIsLoadingRanked(true);
                const updated = await getVacancyCandidates(vacId);
                setRankedCandidates(updated);
                setIsLoadingRanked(false);
            }
            router.refresh();
        } catch (err: any) {
            toast.error(err?.message || "Erro ao excluir candidato");
        }
    };

    const handleToggleRankReq = async (candidateId: string, reqId: string, newValue: boolean | null, reqName: string) => {
        const currentEvals = rankEvals[candidateId] || [];
        let updated: any[];
        if (currentEvals.some((e: any) => e.reqId === reqId)) {
            updated = currentEvals.map((e: any) => e.reqId === reqId ? { ...e, value: newValue } : e);
        } else {
            updated = [...currentEvals, { reqId, name: reqName, value: newValue }];
        }
        setRankEvals(prev => ({ ...prev, [candidateId]: updated }));
        try {
            const updatedCandidate = await updateCandidateEvaluation(candidateId, { customEvaluations: updated });
            setRankedCandidates(prev => prev.map(c => 
                c.id === candidateId 
                    ? { ...c, requirementsEvaluation: updatedCandidate.requirementsEvaluation } 
                    : c
            ));
            toast.success("Requisito atualizado!");
        } catch (error) {
            toast.error("Erro ao salvar avaliação");
        }
    };

    const handleModalRefresh = async () => {
        router.refresh();
        const vacId = candidate?.realId || candidate?.id?.replace('VAC-', '');
        if (vacId) {
            try {
                const updated = await getVacancyCandidates(vacId);
                setRankedCandidates(updated);
            } catch (e) {
                console.error("Error refreshing candidates:", e);
            }
        }
    };

    useEffect(() => {
        if (open && candidate) {
            setReqGender(candidate.vacancy?.reqGender || "Ambos");
            setReqExperience(candidate.vacancy?.reqExperience || "");
            setReqAgeMin(candidate.vacancy?.reqAgeMin?.toString() || "");
            setReqAgeMax(candidate.vacancy?.reqAgeMax?.toString() || "");
            setReqKnowledge(candidate.vacancy?.reqKnowledge || "");
            setPlannedStartDate(candidate.vacancy?.plannedStartDate ? new Date(candidate.vacancy.plannedStartDate).toISOString().split('T')[0] : "");
            setVacancyReqs(candidate.vacancy?.customRequirements ? (candidate.vacancy.customRequirements as any[]) : []);
            setNotes(candidate.requirementsEvaluation?.notes || "");

            if (candidate.type === 'VACANCY') {
                setIsLoadingRanked(true);
                getVacancyCandidates(candidate.realId || candidate.id.replace('VAC-', ''))
                    .then(res => setRankedCandidates(res))
                    .catch(err => console.error("Error loading candidates:", err))
                    .finally(() => setIsLoadingRanked(false));
            }

            setLoadingTimeline(true);
            const fetchTimeline = async () => {
                try {
                    // Decide whether to fetch by Candidate ID or Vacancy ID (for aggregate history)
                    const params = candidate.type === 'VACANCY'
                        ? { vacancyId: candidate.realId || candidate.id.replace('VAC-', '') }
                        : { candidateId: candidate.id };

                    const data = await getRecruitmentTimeline(params);
                    setTimeline(Array.isArray(data) ? data : []);
                } catch (error) {
                    console.error("Failed to fetch timeline", error);
                    setTimeline([]);
                } finally {
                    setLoadingTimeline(false);
                }
            };
            fetchTimeline();
        }
    }, [open, candidate]);

    // Helpers for Stage Navigation
    const currentStage = stages.find(s => s.id === candidate?.stageId) || candidate?.stage;
    const currentStageIndex = stages.findIndex(s => s.id === currentStage?.id);

    // Safety check if stages are sorted by order
    // Assuming KanbanBoard passes them sorted
    const nextStage = currentStageIndex !== -1 && currentStageIndex < stages.length - 1 ? stages[currentStageIndex + 1] : null;
    const prevStage = currentStageIndex > 0 ? stages[currentStageIndex - 1] : null;

    // Check if approval actions should be visible
    const showApprovalActions = candidate && candidate.type !== 'VACANCY' && currentStage?.approverId;

    const handleApprovalClick = (action: "APPROVE" | "REJECT") => {
        setApprovalAction(action);
        setApprovalModalOpen(true);
    };

    const handleConfirmApproval = async (justification: string) => {
        if (!approvalAction) return;

        const targetStage = approvalAction === 'APPROVE' ? nextStage : prevStage;
        if (!targetStage) return; // Should not happen if button enabled

        try {
            await moveCandidate(candidate.id, targetStage.id, justification);
            toast.success(approvalAction === 'APPROVE' ? "Candidato Aprovado!" : "Candidato Reprovado.");
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || "Erro ao processar ação");
        }
    };

    if (!candidate) return null;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="w-[95vw] sm:!max-w-5xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
                    <DialogHeader>
                        <div className="flex justify-between items-start pr-8">
                            <div>
                                <DialogTitle className="text-xl">
                                    {candidate.type === 'VACANCY' ? 'Detalhes da Vaga' : 'Detalhes do Candidato'}
                                </DialogTitle>
                                <DialogDescription>
                                    {candidate.type === 'VACANCY'
                                        ? "Gerencie a linha do tempo e histórico desta vaga"
                                        : "Visualizando informações completas do processo seletivo."}
                                </DialogDescription>
                            </div>
                            {candidate.type === 'VACANCY' && (
                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                    Modo Vaga
                                </Badge>
                            )}
                        </div>
                    </DialogHeader>

                    <Tabs defaultValue="details" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="details">Detalhes</TabsTrigger>
                            <TabsTrigger value="ats">Triagem Inteligente (ATS)</TabsTrigger>
                            <TabsTrigger value="history">Histórico & Auditoria</TabsTrigger>
                        </TabsList>

                        <TabsContent value="details" className="mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                                {/* Candidate Info */}
                                {candidate.type !== 'VACANCY' && (
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-indigo-600 flex items-center gap-2">
                                            <User className="w-5 h-5" />
                                            Dados Pessoais
                                        </h3>
                                        <div className="bg-slate-50 p-4 rounded-lg border space-y-3">
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 uppercase">Nome Completo</label>
                                                <div className="text-slate-900 font-medium text-lg">{candidate.name}</div>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2">
                                                <div className="flex items-center gap-2 text-slate-700">
                                                    <Mail className="w-4 h-4 text-slate-400" />
                                                    <span>{candidate.email || "Não informado"}</span>
                                                </div>
                                                {(() => {
                                                    const rawPhone = candidate.phone || (candidate as any).extraFields?.phone || (candidate as any).extraFields?.whatsapp || "";
                                                    const phoneDigits = rawPhone.replace(/\D/g, "");
                                                    
                                                    if (!phoneDigits) {
                                                        return (
                                                            <div className="flex items-center gap-2 text-slate-700">
                                                                <Phone className="w-4 h-4 text-slate-400" />
                                                                <span className="text-slate-400 italic">Não informado</span>
                                                            </div>
                                                        );
                                                    }

                                                    const formattedWa = phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`;
                                                    const waUrl = `https://wa.me/${formattedWa}?text=${encodeURIComponent(`Olá ${candidate.name}, referente à sua candidatura no sistema Workforce Hub...`)}`;

                                                    return (
                                                        <div className="flex items-center justify-between gap-2 text-slate-700 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
                                                            <div className="flex items-center gap-2">
                                                                <Phone className="w-4 h-4 text-emerald-600" />
                                                                <span className="font-bold text-emerald-950 text-sm">{rawPhone}</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenWhatsAppChat(candidate)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm hover:shadow transition-all shrink-0 active:scale-95 cursor-pointer"
                                                            >
                                                                <MessageSquare className="w-3.5 h-3.5 fill-current" />
                                                                <span>Abrir Chat WhatsApp</span>
                                                            </button>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 uppercase">Data de Inscrição</label>
                                                <div className="flex items-center gap-2 text-slate-700 mt-1">
                                                    <Calendar className="w-4 h-4 text-slate-400" />
                                                    <span>{new Date(candidate.createdAt).toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 uppercase">Etapa Atual</label>
                                                <div className="mt-1">
                                                    <Badge variant="outline">{currentStage?.name || 'Desconhecida'}</Badge>
                                                </div>
                                            </div>
                                            
                                            {/* Currículo Original */}
                                            {(() => {
                                                const evalObj = (candidate.requirementsEvaluation as any) || {};
                                                const fileBase64 = evalObj.resumeFileBase64;
                                                const fileMimeType = evalObj.resumeFileMimeType || 'application/pdf';
                                                
                                                if (!fileBase64) return null;
                                                
                                                return (
                                                    <div className="pt-3 border-t border-slate-200 space-y-2">
                                                        <label className="text-xs font-medium text-slate-500 uppercase block">Currículo Original Anexado</label>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 font-semibold"
                                                            onClick={() => {
                                                                try {
                                                                    const byteCharacters = atob(fileBase64);
                                                                    const byteNumbers = new Array(byteCharacters.length);
                                                                    for (let i = 0; i < byteCharacters.length; i++) {
                                                                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                                                                    }
                                                                    const byteArray = new Uint8Array(byteNumbers);
                                                                    const blob = new Blob([byteArray], { type: fileMimeType });
                                                                    const blobUrl = URL.createObjectURL(blob);
                                                                    
                                                                    if (fileMimeType.includes('pdf')) {
                                                                        window.open(blobUrl, '_blank');
                                                                    } else {
                                                                        const a = document.createElement('a');
                                                                        a.href = blobUrl;
                                                                        a.download = `curriculo_${candidate.name.replace(/\s+/g, '_')}.${fileMimeType.includes('png') ? 'png' : fileMimeType.includes('jpeg') || fileMimeType.includes('jpg') ? 'jpg' : 'pdf'}`;
                                                                        document.body.appendChild(a);
                                                                        a.click();
                                                                        document.body.removeChild(a);
                                                                    }
                                                                } catch (err) {
                                                                    toast.error("Erro ao abrir arquivo do currículo");
                                                                }
                                                            }}
                                                        >
                                                            <FileText className="w-4 h-4 text-indigo-600" />
                                                            Visualizar/Baixar Currículo
                                                        </Button>

                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full flex items-center justify-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 font-semibold"
                                                            disabled={isReevaluatingAi}
                                                            onClick={async () => {
                                                                setIsReevaluatingAi(true);
                                                                toast.info("Processando triagem com IA do Gemini...");
                                                                try {
                                                                    const { evaluateCandidateWithAI } = await import("@/actions/recruitment");
                                                                    await evaluateCandidateWithAI(candidate.id, fileBase64, fileMimeType);
                                                                    toast.success("Triagem por IA concluída!");
                                                                    router.refresh();
                                                                    onOpenChange(false);
                                                                } catch (err: any) {
                                                                    toast.error(err?.message || "Erro ao processar IA");
                                                                } finally {
                                                                    setIsReevaluatingAi(false);
                                                                }
                                                            }}
                                                        >
                                                            <Sparkles className="w-4 h-4 text-purple-600" />
                                                            {isReevaluatingAi ? "Processando..." : "Refazer Triagem por IA"}
                                                        </Button>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* Vacancy Info */}
                                <div className="space-y-4 col-span-2">
                                    <h3 className="font-semibold text-orange-600 flex items-center gap-2">
                                        <Briefcase className="w-5 h-5" />
                                        Dados da Vaga
                                    </h3>
                                    <div className="bg-orange-50/50 p-4 rounded-lg border border-orange-100 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 uppercase">Título da Vaga</label>
                                                <div className="text-slate-900 font-medium">{candidate.vacancy?.title}</div>
                                            </div>
                                            <div className="text-right">
                                                <label className="text-xs font-medium text-slate-500 uppercase">Status</label>
                                                <div className="text-sm font-medium">{candidate.vacancy?.status}</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 uppercase mb-1 block">Prioridade</label>
                                                <Select
                                                    defaultValue={candidate.vacancy?.priority}
                                                    onValueChange={async (val) => {
                                                        try {
                                                            if (candidate.vacancy) await updateVacancy(candidate.vacancy.id, { priority: val });
                                                            toast.success("Prioridade atualizada");
                                                        } catch (e) { toast.error("Erro ao atualizar"); }
                                                    }}
                                                >
                                                    <SelectTrigger className="h-8 bg-white">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="LOW">Baixa</SelectItem>
                                                        <SelectItem value="MEDIUM">Média</SelectItem>
                                                        <SelectItem value="HIGH">Alta</SelectItem>
                                                        <SelectItem value="URGENT">Urgente</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 uppercase mb-1 block">Recrutador (Owner)</label>
                                                <Select
                                                    defaultValue={candidate.vacancy?.recruiter?.id || candidate.vacancy?.recruiterId}
                                                    onValueChange={async (val) => {
                                                        try {
                                                            if (candidate.vacancy) await updateVacancy(candidate.vacancy.id, { recruiterId: val });
                                                            toast.success("Recrutador atualizado");
                                                        } catch (e) { toast.error("Erro ao atualizar"); }
                                                    }}
                                                >
                                                    <SelectTrigger className="h-8 bg-white">
                                                        <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {recruiters.map((r: any) => (
                                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-orange-100/50 space-y-2">
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 uppercase">Cliente / Posto</label>
                                                <div className="flex items-center gap-2 text-slate-700 mt-1">
                                                    <Building2 className="w-4 h-4 text-slate-400" />
                                                    <span>{candidate.vacancy?.posto?.client?.name || "N/A"}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-slate-500 text-sm pl-6">
                                                    <span>{candidate.vacancy?.posto?.name}</span>
                                                </div>
                                            </div>

                                            {candidate.vacancy?.company && (
                                                <div>
                                                    <label className="text-xs font-medium text-slate-500 uppercase">Empresa Contratante</label>
                                                    <div className="text-slate-700 mt-1">
                                                        {candidate.vacancy.company.name}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-4 pt-1 items-end">
                                                <div>
                                                    <label className="text-xs font-medium text-slate-500 uppercase">Data de Abertura</label>
                                                    <div className="text-slate-700 mt-1 text-xs">
                                                        {candidate.vacancy?.createdAt ? new Date(candidate.vacancy.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-slate-500 uppercase">Início Planejado (Operação)</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="date"
                                                            className="flex h-8 w-full rounded-md border border-input bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                            value={plannedStartDate}
                                                            onChange={(e) => setPlannedStartDate(e.target.value)}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            className="bg-orange-600 hover:bg-orange-700 text-white font-medium text-xs h-8 px-2"
                                                            onClick={handleSaveRequirements}
                                                            disabled={isSavingRequirements}
                                                            title="Salvar Data Planejada"
                                                        >
                                                            <Save className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Participants Section */}
                                        {candidate.vacancy && (
                                            <ParticipantsSection
                                                vacancyId={candidate.vacancy.id}
                                                currentParticipants={candidate.vacancy.participants || []}
                                                allUsers={recruiters}
                                                onAdd={async (uid) => {
                                                    try {
                                                        await addVacancyParticipant(candidate.vacancy.id, uid);
                                                        toast.success("Participante adicionado");
                                                    } catch (e) { toast.error("Erro ao adicionar"); }
                                                }}
                                                onRemove={async (uid) => {
                                                    try {
                                                        await removeVacancyParticipant(candidate.vacancy.id, uid);
                                                        toast.success("Participante removido");
                                                    } catch (e) { toast.error("Erro ao remover"); }
                                                }}
                                            />
                                        )}
                                    </div>

                                    {/* Posto Financial & Schedule Info */}
                                    {candidate.vacancy?.posto && (
                                        <div className="space-y-4 pt-2">
                                            <h3 className="font-semibold text-emerald-600 flex items-center gap-2">
                                                <Building2 className="w-5 h-5" />
                                                Dados do Posto & Benefícios
                                            </h3>
                                            <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-100 space-y-3">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-xs font-medium text-slate-500 uppercase">Escala</label>
                                                        <div className="text-slate-900 font-medium">{candidate.vacancy.posto.schedule}</div>
                                                        <div className="text-xs text-slate-500">{candidate.vacancy.posto.startTime} - {candidate.vacancy.posto.endTime}</div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-medium text-slate-500 uppercase">Carga Horária</label>
                                                        <div className="text-slate-900 font-medium">{candidate.vacancy.posto.requiredWorkload}h</div>
                                                    </div>
                                                </div>

                                                <div className="pt-2 border-t border-emerald-100/50 mt-2">
                                                    <label className="text-xs font-medium text-slate-500 uppercase">Salário Base</label>
                                                    <div className="text-slate-900 font-bold text-lg">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(candidate.vacancy.posto.baseSalary || 0)}
                                                    </div>
                                                </div>

                                                {(candidate.vacancy.posto.insalubridade > 0 ||
                                                    candidate.vacancy.posto.periculosidade > 0 ||
                                                    candidate.vacancy.posto.gratificacao > 0 ||
                                                    candidate.vacancy.posto.outrosAdicionais > 0) && (
                                                        <div className="pt-2 border-t border-emerald-100/50 mt-2 space-y-1">
                                                            <label className="text-xs font-medium text-slate-500 uppercase">Adicionais</label>

                                                            {candidate.vacancy.posto.insalubridade > 0 && (
                                                                <div className="flex justify-between text-sm text-slate-700">
                                                                    <span>Insalubridade</span>
                                                                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(candidate.vacancy.posto.insalubridade)}</span>
                                                                </div>
                                                            )}
                                                            {candidate.vacancy.posto.periculosidade > 0 && (
                                                                <div className="flex justify-between text-sm text-slate-700">
                                                                    <span>Periculosidade</span>
                                                                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(candidate.vacancy.posto.periculosidade)}</span>
                                                                </div>
                                                            )}
                                                            {candidate.vacancy.posto.gratificacao > 0 && (
                                                                <div className="flex justify-between text-sm text-slate-700">
                                                                    <span>Gratificação</span>
                                                                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(candidate.vacancy.posto.gratificacao)}</span>
                                                                </div>
                                                            )}
                                                            {candidate.vacancy.posto.outrosAdicionais > 0 && (
                                                                <div className="flex justify-between text-sm text-slate-700">
                                                                    <span>Outros</span>
                                                                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(candidate.vacancy.posto.outrosAdicionais)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    )}
                                </div>


                                {/* Posto Financial & Schedule Info */}

                            </div>


                            <div className="py-2">
                                <label className="text-xs font-medium text-slate-500 uppercase">Descrição da Vaga</label>
                                <div className="bg-slate-50 p-3 rounded mt-1 text-sm text-slate-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                                    {candidate.vacancy?.description || "Sem descrição"}
                                </div>
                            </div>

                            {candidate.vacancy && (
                                <CommentsSection vacancyId={candidate.vacancy.id} currentUser={currentUser} users={recruiters} />
                            )}
                        </TabsContent>
                        
                        <TabsContent value="ats" className="mt-4">
                            {(() => {
                                const activeCand = candidate.type === 'VACANCY' 
                                    ? (rankedCandidates.find(c => c.id === (selectedAdmissionCandidateId || rankedCandidates[0]?.id)) || rankedCandidates[0])
                                    : candidate;

                                const stageName = activeCand?.stage?.name || '';
                                const stageOrder = activeCand?.stage?.order || 0;
                                const stNameLower = stageName.toLowerCase();

                                const isDocActive = stNameLower.includes('doc') || stageOrder >= 3 || !!activeCand?.documentationStatus;
                                const isDocOk = activeCand?.documentationStatus === 'APPROVED' || activeCand?.documentationStatus === 'SUBMITTED';

                                const isAsoActive = (isDocActive && isDocOk) || stNameLower.includes('exam') || stNameLower.includes('aso') || stageOrder >= 4 || !!activeCand?.asoStatus;
                                const isAsoOk = activeCand?.asoStatus === 'APTO' || activeCand?.asoStatus === 'Apto';

                                const isAdmissaoActive = (isAsoActive && isAsoOk) || stNameLower.includes('admi') || stNameLower.includes('onvio') || stageOrder >= 5 || !!activeCand?.onvioLaunched;
                                const isOnvioOk = !!activeCand?.onvioLaunched;

                                const isBenefitsActive = (isAdmissaoActive && isOnvioOk) || stNameLower.includes('bene') || stageOrder >= 6 || !!activeCand?.benefitsCompletedAt;
                                const isBenefitsOk = !!activeCand?.benefitsCompletedAt;

                                return (
                                    <Tabs defaultValue="ranking" className="w-full space-y-4">
                                        <TabsList className="grid w-full grid-cols-5 bg-slate-100 p-1 rounded-xl">
                                            <TabsTrigger value="ranking" className="text-xs font-semibold">
                                                📋 Ranking & IA
                                            </TabsTrigger>
                                            <TabsTrigger value="documents" disabled={!isDocActive} className="text-xs font-semibold flex items-center justify-center gap-1">
                                                {!isDocActive && <Lock className="w-3 h-3 text-slate-400" />}
                                                📄 Documentação
                                                {isDocOk && <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />}
                                            </TabsTrigger>
                                            <TabsTrigger value="aso" disabled={!isAsoActive} className="text-xs font-semibold flex items-center justify-center gap-1">
                                                {!isAsoActive && <Lock className="w-3 h-3 text-slate-400" />}
                                                🏥 Exame (ASO)
                                                {isAsoOk && <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />}
                                                {activeCand?.asoStatus === 'INAPTO' && <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />}
                                            </TabsTrigger>
                                            <TabsTrigger value="admissao" disabled={!isAdmissaoActive} className="text-xs font-semibold flex items-center justify-center gap-1 font-bold text-indigo-700">
                                                {!isAdmissaoActive && <Lock className="w-3 h-3 text-slate-400" />}
                                                ⚡ Admissão (Onvio)
                                                {isOnvioOk && <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />}
                                            </TabsTrigger>
                                            <TabsTrigger value="benefits" disabled={!isBenefitsActive} className="text-xs font-semibold flex items-center justify-center gap-1 font-bold text-emerald-700">
                                                {!isBenefitsActive && <Lock className="w-3 h-3 text-slate-400" />}
                                                🎁 Benefícios
                                                {isBenefitsOk && <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />}
                                            </TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="ranking">
                                            {candidate.type === 'VACANCY' ? (
                                <div className="space-y-6 py-2">
                                    {/* Link de Captação Meta Ads */}
                                    <div className="bg-gradient-to-r from-indigo-900/10 via-indigo-900/5 to-indigo-900/0 border border-indigo-100 p-4 rounded-xl space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="p-1.5 bg-indigo-100 rounded text-indigo-700 font-bold text-[10px] uppercase tracking-wide">Meta Ads</span>
                                            <h4 className="text-sm font-bold text-slate-800">Link Público de Candidatura</h4>
                                        </div>
                                        <p className="text-xs text-slate-500">Divulgue este link patrocinado no Instagram e Facebook. Os currículos enviados pelos candidatos serão analisados pela IA na hora e cairão direto no seu Kanban.</p>
                                        
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                readOnly 
                                                value={typeof window !== 'undefined' ? `${window.location.origin}/candidatar/${candidate.realId || candidate.id.replace('VAC-', '')}` : ''} 
                                                className="bg-white border text-xs rounded px-3 py-1.5 flex-1 focus:outline-none"
                                            />
                                            <Button 
                                                size="sm" 
                                                onClick={() => {
                                                    const url = `${window.location.origin}/candidatar/${candidate.realId || candidate.id.replace('VAC-', '')}`;
                                                    navigator.clipboard.writeText(url);
                                                    toast.success("Link copiado para a área de transferência!");
                                                }}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 flex items-center gap-1 shrink-0"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                                        Copiar Link
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Configuração de Checklist de Requisitos da Vaga */}
                                    <div className="bg-white border rounded-xl p-4 shadow-sm">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-sm">Checklist de Requisitos ({vacancyReqs.length})</h3>
                                                <p className="text-xs text-slate-400">Critérios de avaliação para esta vaga.</p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsVacancyReqsExpanded(!isVacancyReqsExpanded)}
                                                className="text-xs h-8 flex items-center gap-1 border-slate-200 text-slate-700 font-semibold"
                                            >
                                                {isVacancyReqsExpanded ? 'Fechar Editor' : '✏️ Configurar/Editar'}
                                            </Button>
                                        </div>

                                        {isVacancyReqsExpanded && (
                                            <div className="mt-4 space-y-4 border-t pt-4">
                                                <div className="flex gap-2 items-end bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                    <div className="flex-1 space-y-1">
                                                        <label className="text-[10px] uppercase font-black text-slate-500 block">Novo Requisito</label>
                                                        <input
                                                            type="text"
                                                            value={newReqText}
                                                            onChange={(e) => setNewReqText(e.target.value)}
                                                            placeholder="Ex: Não fumante, Possuir CNH D..."
                                                            className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2 h-9 px-2 bg-white rounded border">
                                                        <input
                                                            type="checkbox"
                                                            id="vac-req-knockout"
                                                            checked={newReqIsKnockout}
                                                            onChange={(e) => setNewReqIsKnockout(e.target.checked)}
                                                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                        />
                                                        <label htmlFor="vac-req-knockout" className="cursor-pointer text-xs font-semibold text-red-700 select-none">Eliminatório</label>
                                                    </div>
                                                    <Button 
                                                        type="button" 
                                                        onClick={handleAddVacancyReq}
                                                        className="bg-slate-900 hover:bg-slate-800 text-white h-9"
                                                        size="sm"
                                                    >
                                                        Adicionar
                                                    </Button>
                                                </div>

                                                {/* Lista de Requisitos */}
                                                <div className="space-y-2">
                                                    {vacancyReqs.length === 0 ? (
                                                        <div className="text-center py-4 text-xs text-slate-400">Nenhum requisito cadastrado ainda.</div>
                                                    ) : (
                                                        vacancyReqs.map((req) => (
                                                            <div key={req.id} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-semibold text-slate-800">{req.name}</span>
                                                                    {req.isKnockout && (
                                                                        <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[9px] font-black uppercase tracking-wider">Eliminatório</span>
                                                                    )}
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleRemoveVacancyReq(req.id)}
                                                                    className="text-red-500 hover:text-red-700 h-6 w-6 p-0 flex items-center justify-center font-bold text-xs"
                                                                >
                                                                    ×
                                                                </Button>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Upload Manual de Currículo para a Vaga */}
                                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800">📎 Subir Candidato Manualmente</h4>
                                                <p className="text-xs text-slate-500 mt-0.5">Anexe um currículo (PDF/imagem). A IA extrai os dados e avalia os requisitos da vaga automaticamente.</p>
                                            </div>
                                            <label className={`cursor-pointer shrink-0 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 h-10 rounded-lg shadow-sm transition-all ${isUploadingVacancyCv ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                                <Upload className="w-4 h-4" />
                                                {isUploadingVacancyCv ? 'Processando...' : 'Anexar CV'}
                                                <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleVacancyCvUpload} disabled={isUploadingVacancyCv} className="hidden" />
                                            </label>
                                        </div>
                                    </div>
                                    
                                    {/* Ranking de Candidatos com Checkboxes */}
                                    <div className="bg-white border rounded-xl p-4 space-y-3 shadow-sm">
                                        <div className="border-b pb-2 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-sm">Ranking de Candidatos ({rankedCandidates.length})</h3>
                                                <p className="text-xs text-slate-400">Escolha o candidato ideal para seguir no processo de contratação desta vaga.</p>
                                            </div>
                                        </div>

                                        {/* Banner do Candidato Escolhido pelo Recrutador */}
                                        {selectedCandidateForVacancyId && (() => {
                                            const chosen = rankedCandidates.find(c => c.id === selectedCandidateForVacancyId);
                                            if (!chosen) return null;
                                            return (
                                                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-400 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                                                            🏆
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Candidato Escolhido para a Vaga</span>
                                                                <span className="px-2 py-0.2 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-extrabold">Ativo</span>
                                                            </div>
                                                            <h4 className="font-extrabold text-slate-900 text-sm">{chosen.name}</h4>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedAdmissionCandidateId(chosen.id);
                                                                const atsTabBtn = document.querySelector('[data-state][value="documents"]') as HTMLElement;
                                                                if (atsTabBtn) atsTabBtn.click();
                                                            }}
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8 px-3 shadow-xs"
                                                        >
                                                            <FileText className="w-3.5 h-3.5 mr-1" />
                                                            Documentos & Admissão
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {isLoadingRanked ? (
                                            <div className="text-center py-6 text-xs text-slate-400">Carregando ranking...</div>
                                        ) : rankedCandidates.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
                                                <Upload className="w-8 h-8 text-slate-300" />
                                                <p className="text-xs font-bold text-slate-500">Nenhum candidato nesta vaga ainda.</p>
                                                <p className="text-xs text-slate-400">Use o botão "Anexar CV" acima para subir o primeiro currículo.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                                                {(() => {
                                                    // Dynamic Client-side Live Sorting: Disqualified candidates at the bottom, then sorted by pct descending
                                                    const sorted = [...rankedCandidates].sort((a, b) => {
                                                        const evalA = (a.requirementsEvaluation as any) || {};
                                                        const evalB = (b.requirementsEvaluation as any) || {};
                                                        const reqs = vacancyReqs;
                                                        
                                                        // A
                                                        const candEvalsA = rankEvals[a.id] || (evalA.customEvaluations as any[] || []);
                                                        const checkedCountA = reqs.filter(r => { const e = candEvalsA.find((ev:any) => ev.reqId === r.id); return e ? (e.value === true || e.value === 'true') : false; }).length;
                                                        const pctA = reqs.length > 0 ? Math.round((checkedCountA / reqs.length) * 100) : (evalA.adherenceScore ?? 0);
                                                        const isDisqA = reqs.some(r => { const e = candEvalsA.find((ev:any) => ev.reqId === r.id); return r.isKnockout && e && (e.value === false || e.value === 'false'); }) || !!evalA.isDisqualified;
                                                        
                                                        // B
                                                        const candEvalsB = rankEvals[b.id] || (evalB.customEvaluations as any[] || []);
                                                        const checkedCountB = reqs.filter(r => { const e = candEvalsB.find((ev:any) => ev.reqId === r.id); return e ? (e.value === true || e.value === 'true') : false; }).length;
                                                        const pctB = reqs.length > 0 ? Math.round((checkedCountB / reqs.length) * 100) : (evalB.adherenceScore ?? 0);
                                                        const isDisqB = reqs.some(r => { const e = candEvalsB.find((ev:any) => ev.reqId === r.id); return r.isKnockout && e && (e.value === false || e.value === 'false'); }) || !!evalB.isDisqualified;
                                                        
                                                        if (isDisqA && !isDisqB) return 1;
                                                        if (!isDisqA && isDisqB) return -1;
                                                        return pctB - pctA;
                                                    });

                                                    return sorted.map((cand, idx) => {
                                                        const evaluation = (cand.requirementsEvaluation as any) || {};
                                                        const reqs: any[] = vacancyReqs;
                                                        const candEvals: any[] = rankEvals[cand.id] || (evaluation.customEvaluations as any[] || []);
                                                        
                                                        // Live compliance count and percentage
                                                        const checkedCount = reqs.filter(r => { const e = candEvals.find((ev:any) => ev.reqId === r.id); return e ? (e.value === true || e.value === 'true') : false; }).length;
                                                        const pct = reqs.length > 0 ? Math.round((checkedCount / reqs.length) * 100) : (evaluation.adherenceScore ?? 0);
                                                        const isExpanded = expandedRankId === cand.id;
                                                        
                                                        // Live disqualified check
                                                        const isDisqualified = reqs.some(r => {
                                                            const e = candEvals.find((ev:any) => ev.reqId === r.id);
                                                            return r.isKnockout && e && (e.value === false || e.value === 'false');
                                                        }) || !!evaluation.isDisqualified;

                                                        return (
                                                            <div key={cand.id} className={`rounded-xl border transition-all ${isExpanded ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                                                                {/* Header do candidato */}
                                                                <div
                                                                    className="w-full flex items-center justify-between p-3 text-left"
                                                                >
                                                                    <div
                                                                        onClick={() => setExpandedRankId(isExpanded ? null : cand.id)}
                                                                        className="flex items-center gap-3 cursor-pointer flex-1"
                                                                    >
                                                                        <span className="font-black text-slate-400 text-xs w-6">#{idx+1}</span>
                                                                        <div>
                                                                             <div className="flex items-center gap-2">
                                                                                 <span className="font-semibold text-slate-800 text-sm block">{cand.name}</span>
                                                                                 {(() => {
                                                                                     const rawPhone = cand.phone || cand.extraFields?.phone || cand.extraFields?.whatsapp || "";
                                                                                     const phoneDigits = rawPhone.replace(/\D/g, "");
                                                                                     if (!phoneDigits) return null;
                                                                                     return (
                                                                                         <button
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleOpenWhatsAppChat(cand);
                                                                                            }}
                                                                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] shadow-sm hover:shadow transition-all shrink-0 active:scale-95 ml-1 cursor-pointer"
                                                                                            title={`Abrir Chat WhatsApp com ${cand.name}`}
                                                                                        >
                                                                                            <MessageSquare className="w-3 h-3 fill-current" />
                                                                                            <span>WhatsApp</span>
                                                                                        </button>
                                                                                     );
                                                                                 })()}
                                                                             </div>
                                                                             <span className="text-[10px] text-slate-400 uppercase tracking-wide flex items-center gap-2">
                                                                                 <span>{cand.stage?.name || 'Inscrição'}</span>
                                                                                 {(cand.phone || cand.extraFields?.phone) && (
                                                                                     <span className="text-emerald-700 font-semibold font-mono text-[10px]">({cand.phone || cand.extraFields?.phone})</span>
                                                                                 )}
                                                                             </span>
                                                                         </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        {/* Botão de Escolha do Recrutador */}
                                                                        {selectedCandidateForVacancyId === cand.id ? (
                                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-[10px] shadow-xs uppercase tracking-wide">
                                                                                <CheckCircle2 className="w-3 h-3" />
                                                                                Escolhido
                                                                            </span>
                                                                        ) : (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleSelectCandidateForProcess(cand);
                                                                                }}
                                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-[10px] shadow-2xs transition-all active:scale-95 cursor-pointer"
                                                                                title="Escolher este candidato para seguir no processo da vaga"
                                                                            >
                                                                                <Sparkles className="w-3 h-3 text-emerald-600" />
                                                                                <span>Escolher</span>
                                                                            </button>
                                                                        )}

                                                                        {isDisqualified ? (
                                                                            <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[9px] font-black uppercase">Desclassificado</span>
                                                                        ) : (
                                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${pct >= 75 ? 'bg-emerald-100 text-emerald-800' : pct >= 50 ? 'bg-amber-100 text-amber-800' : pct > 0 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-500'}`}>
                                                                                {pct > 0 ? `${pct}%` : 'Sem Triagem'}
                                                                            </span>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setExpandedRankId(isExpanded ? null : cand.id)}
                                                                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                                                                        >
                                                                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => handleDeleteRankedCandidate(e, cand.id, cand.name)}
                                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50/55 transition-all border border-transparent hover:border-red-100/50"
                                                                            title="Excluir Candidato permanentemente"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* Checklist expansível */}
                                                                {isExpanded && (
                                                                    <div className="px-4 pb-4 space-y-4 border-t border-slate-100 divide-y divide-slate-100">
                                                                        
                                                                        {/* Banner de desclassificação no topo da seção */}
                                                                        {isDisqualified && (
                                                                            <div className="pt-3.5">
                                                                                <div className="bg-red-100 border border-red-200 text-red-800 text-xs rounded-lg p-3 flex items-start gap-2.5 animate-pulse">
                                                                                    <AlertCircle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
                                                                                    <div>
                                                                                        <span className="font-black block text-xs uppercase tracking-wider">Candidato Desclassificado</span>
                                                                                        <span className="block mt-0.5 text-red-700">Não atende a um ou mais requisitos eliminatórios obrigatórios.</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* Dados extraídos do CV */}
                                                                        {evaluation.aiAnalysis ? (
                                                                            <div className="pt-3.5 space-y-3">
                                                                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                                                                                    <span className="text-[10px] uppercase font-black text-slate-500 block">Parecer Técnico da IA</span>
                                                                                    <p className="text-xs text-slate-700 italic">"{evaluation.aiAnalysis}"</p>
                                                                                </div>

                                                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                                                    <div className="p-2 bg-white rounded border border-slate-100">
                                                                                        <span className="text-[9px] uppercase font-black text-slate-400 block">Idade Extraída</span>
                                                                                        <span className="font-semibold text-slate-800">{evaluation.parsedDetails?.age ? `${evaluation.parsedDetails.age} anos` : 'Não especificado'}</span>
                                                                                    </div>
                                                                                    <div className="p-2 bg-white rounded border border-slate-100">
                                                                                        <span className="text-[9px] uppercase font-black text-slate-400 block">Estabilidade (Últimos Empregos)</span>
                                                                                        <span className="font-semibold text-slate-800">{evaluation.parsedDetails?.averageTenureMonths ? `${evaluation.parsedDetails.averageTenureMonths} meses / vaga` : 'Não especificado'}</span>
                                                                                    </div>
                                                                                    <div className="p-2 bg-white rounded border border-slate-100">
                                                                                        <span className="text-[9px] uppercase font-black text-slate-400 block">Distância Estimada</span>
                                                                                        <span className="font-semibold text-slate-800">{evaluation.parsedDetails?.distanceKm ? `${evaluation.parsedDetails.distanceKm} Km` : 'Não especificado'}</span>
                                                                                    </div>
                                                                                    <div className="p-2 bg-white rounded border border-slate-100">
                                                                                        <span className="text-[9px] uppercase font-black text-slate-400 block">Filhos menores de 5 anos</span>
                                                                                        <span className="font-semibold text-slate-800">{evaluation.parsedDetails?.hasChildrenUnderFive ? 'Sim' : 'Não'}</span>
                                                                                    </div>
                                                                                </div>

                                                                                {evaluation.warnings && evaluation.warnings.length > 0 && (
                                                                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-1">
                                                                                        <span className="text-[9px] uppercase font-black text-amber-800 flex items-center gap-1">
                                                                                            <AlertTriangle className="w-3.5 h-3.5" />
                                                                                            Alertas de Risco
                                                                                        </span>
                                                                                        <ul className="list-disc pl-4 text-xs text-amber-900 space-y-0.5">
                                                                                            {evaluation.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                                                                                        </ul>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="pt-3.5 text-center py-2 text-xs text-slate-400">
                                                                                Nenhuma análise de currículo por IA disponível. Envie o CV acima para rodar a triagem.
                                                                            </div>
                                                                        )}

                                                                        {/* Visualizador de Currículo no Ranking da Vaga */}
                                                                        {(() => {
                                                                            const fileBase64 = evaluation.resumeFileBase64;
                                                                            const fileMimeType = evaluation.resumeFileMimeType || 'application/pdf';
                                                                            if (!fileBase64) return null;
                                                                            return (
                                                                                <div className="pt-3">
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        size="sm"
                                                                                        className="w-full flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 text-[11px] h-8 font-semibold"
                                                                                        onClick={() => {
                                                                                            try {
                                                                                                const byteCharacters = atob(fileBase64);
                                                                                                const byteNumbers = new Array(byteCharacters.length);
                                                                                                for (let i = 0; i < byteCharacters.length; i++) {
                                                                                                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                                                                                                }
                                                                                                const byteArray = new Uint8Array(byteNumbers);
                                                                                                const blob = new Blob([byteArray], { type: fileMimeType });
                                                                                                const blobUrl = URL.createObjectURL(blob);
                                                                                                if (fileMimeType.includes('pdf')) {
                                                                                                    window.open(blobUrl, '_blank');
                                                                                                } else {
                                                                                                    const a = document.createElement('a');
                                                                                                    a.href = blobUrl;
                                                                                                    a.download = `curriculo_${cand.name.replace(/\s+/g, '_')}.${fileMimeType.includes('png') ? 'png' : fileMimeType.includes('jpeg') || fileMimeType.includes('jpg') ? 'jpg' : 'pdf'}`;
                                                                                                    document.body.appendChild(a);
                                                                                                    a.click();
                                                                                                    document.body.removeChild(a);
                                                                                                }
                                                                                            } catch (err) {
                                                                                                toast.error("Erro ao abrir arquivo do currículo");
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                                                                        Visualizar Currículo Original
                                                                                    </Button>
                                                                                </div>
                                                                            );
                                                                        })()}

                                                                        {/* Barra de progresso */}
                                                                        {reqs.length > 0 && (
                                                                            <div className="pt-3.5 space-y-1">
                                                                                <div className="flex justify-between text-xs">
                                                                                    <span className="text-slate-500">{checkedCount} de {reqs.length} requisitos atendidos</span>
                                                                                    <span className={`font-black ${pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>
                                                                                </div>
                                                                                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                                                                    <div className={`h-full transition-all duration-500 ${pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* Checkboxes por requisito */}
                                                                        {reqs.length === 0 ? (
                                                                            <p className="text-xs text-amber-600 py-2 pt-3">Nenhum requisito cadastrado nesta vaga. Adicione requisitos acima.</p>
                                                                        ) : (
                                                                            <div className="space-y-2 pt-3">
                                                                                {reqs.map(req => {
                                                                                    const evalItem = candEvals.find((ev:any) => ev.reqId === req.id);
                                                                                    const checkedValue = evalItem ? (evalItem.value === null || evalItem.value === 'null' ? null : (evalItem.value === true || evalItem.value === 'true')) : null;
                                                                                    const isFailedKnockout = req.isKnockout && checkedValue === false;
                                                                                    return (
                                                                                        <div key={req.id} className={`p-3 rounded-lg border transition-all ${checkedValue === true ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : checkedValue === false ? 'bg-red-50 border-red-200 text-red-950 ring-1 ring-red-300' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'}`}>
                                                                                            <div className="flex justify-between items-center">
                                                                                                <span className="text-xs font-semibold">{req.name}</span>
                                                                                                {req.isKnockout && (
                                                                                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${isFailedKnockout ? 'bg-red-600 text-white animate-pulse' : 'bg-red-100 text-red-800'}`}>
                                                                                                        {isFailedKnockout ? 'Não Atendido' : 'Eliminatório'}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                            
                                                                                            <div className="flex gap-4 mt-2">
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => handleToggleRankReq(cand.id, req.id, checkedValue === true ? null : true, req.name)}
                                                                                                    className={`flex items-center gap-1.5 cursor-pointer text-xs select-none border rounded px-2.5 py-1 transition-all ${checkedValue === true ? 'bg-emerald-600 border-emerald-600 text-white font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                                                                >
                                                                                                    <input
                                                                                                        type="checkbox"
                                                                                                        checked={checkedValue === true}
                                                                                                        readOnly
                                                                                                        className="rounded border-gray-300 text-emerald-600 pointer-events-none w-3.5 h-3.5"
                                                                                                    />
                                                                                                    <span>Atende</span>
                                                                                                </button>
                                                                                                
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => handleToggleRankReq(cand.id, req.id, checkedValue === false ? null : false, req.name)}
                                                                                                    className={`flex items-center gap-1.5 cursor-pointer text-xs select-none border rounded px-2.5 py-1 transition-all ${checkedValue === false ? 'bg-red-600 border-red-600 text-white font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                                                                >
                                                                                                    <input
                                                                                                        type="checkbox"
                                                                                                        checked={checkedValue === false}
                                                                                                        readOnly
                                                                                                        className="rounded border-gray-300 text-red-600 pointer-events-none w-3.5 h-3.5"
                                                                                                    />
                                                                                                    <span>Não Atende</span>
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                             </div>
                                         )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-5 py-2">
                                    {/* Modo Candidato */}
                                    {/* Upload Manual do CV */}
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Subir/Atualizar Currículo (CV)</h4>
                                            <p className="text-[11px] text-slate-500">Envie o arquivo PDF ou imagem do currículo para a IA analisar o perfil do candidato na hora.</p>
                                        </div>
                                        <label className={`cursor-pointer shrink-0 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3 h-9 rounded-lg shadow-sm transition-all
                                            ${isUploadingCv ? 'opacity-50 cursor-not-allowed' : ''}
                                        `}>
                                            <Upload className="w-3.5 h-3.5" />
                                            {isUploadingCv ? 'Analisando...' : 'Anexar CV'}
                                            <input 
                                                type="file" 
                                                accept=".pdf,.png,.jpg,.jpeg" 
                                                onChange={handleManualCvUpload} 
                                                disabled={isUploadingCv}
                                                className="hidden" 
                                            />
                                        </label>
                                    </div>
                       
                                    {candidate.requirementsEvaluation ? (
                                        <>
                                            {/* Score de Aderência por IA */}
                                            <div className="bg-white border rounded-xl p-4 space-y-3 shadow-sm">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Aderência por IA</span>
                                                    <span className={`text-lg font-black ${candidate.requirementsEvaluation.isDisqualified ? 'text-red-600' : candidate.requirementsEvaluation.adherenceScore >= 75 ? 'text-emerald-600' : candidate.requirementsEvaluation.adherenceScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                        {candidate.requirementsEvaluation.isDisqualified ? 'Desclassificado' : `${candidate.requirementsEvaluation.adherenceScore}%`}
                                                    </span>
                                                </div>
                                                {!candidate.requirementsEvaluation.isDisqualified && (
                                                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                                        <div className={`h-full transition-all duration-500 ${candidate.requirementsEvaluation.adherenceScore >= 75 ? 'bg-emerald-500' : candidate.requirementsEvaluation.adherenceScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${candidate.requirementsEvaluation.adherenceScore}%` }} />
                                                    </div>
                                                )}
                                                {candidate.requirementsEvaluation.isDisqualified && (
                                                    <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 items-start">
                                                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                                        <div>
                                                            <span className="font-bold block">Desclassificado por Requisito Eliminatório</span>
                                                            <span className="mt-0.5 block">{candidate.requirementsEvaluation.disqualificationReason}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            {candidate.requirementsEvaluation.warnings && candidate.requirementsEvaluation.warnings.length > 0 && (
                                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 shadow-sm">
                                                    <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs uppercase tracking-wider">
                                                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                                                        Alertas de Risco
                                                    </div>
                                                    <ul className="list-disc pl-4 text-xs text-amber-800 space-y-1">
                                                        {candidate.requirementsEvaluation.warnings.map((w: string, i: number) => (<li key={i}>{w}</li>))}
                                                    </ul>
                                                </div>
                                            )}
                                            {candidate.requirementsEvaluation.aiAnalysis && (
                                                <div className="bg-white border rounded-xl p-4 space-y-2 shadow-sm">
                                                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Parecer Técnico da IA</h3>
                                                    <p className="text-xs text-slate-600 italic leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">"{candidate.requirementsEvaluation.aiAnalysis}"</p>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center text-center space-y-2">
                                            <FileText className="w-8 h-8 text-slate-300" />
                                            <h4 className="font-bold text-slate-600 text-xs uppercase tracking-wide">Sem triagem por IA</h4>
                                            <p className="text-xs text-slate-400 max-w-xs">Faça o upload do currículo acima para rodar a triagem automática com o Gemini em segundos.</p>
                                        </div>
                                    )}

                                    {/* ✅ CHECKLIST — SEMPRE VISÍVEL */}
                                    {(candidate.vacancy?.customRequirements as any[] || []).length > 0 ? (
                                        <div className="bg-white border rounded-xl p-4 space-y-3 shadow-sm">
                                            <div className="border-b pb-2">
                                                <h3 className="font-bold text-slate-800 text-sm">✅ Checklist de Requisitos</h3>
                                                <p className="text-xs text-slate-400">Avalie se o candidato atende ou não atende aos requisitos definidos para a vaga.</p>
                                            </div>
                                            {(() => {
                                                const reqs: any[] = (candidate.vacancy?.customRequirements as any[] || []);
                                                const evals: any[] = (candidate.requirementsEvaluation?.customEvaluations as any[] || []);
                                                const checked = reqs.filter(req => { const e = evals.find((ev: any) => ev.reqId === req.id); return e ? (e.value === true || e.value === 'true') : false; }).length;
                                                const pct = reqs.length > 0 ? Math.round((checked / reqs.length) * 100) : 0;
                                                return (
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-500">{checked} de {reqs.length} itens atendidos</span>
                                                            <span className={`font-black ${pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                                            <div className={`h-full transition-all duration-500 ${pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                            <div className="space-y-2">
                                                {(candidate.vacancy?.customRequirements as any[] || []).map((req) => {
                                                    const evalItem = ((candidate.requirementsEvaluation?.customEvaluations as any[]) || []).find((e: any) => e.reqId === req.id);
                                                    
                                                    // Três estados: true (atende), false (não atende), null (não avaliado)
                                                    const checkedValue = evalItem ? (evalItem.value === null || evalItem.value === 'null' ? null : (evalItem.value === true || evalItem.value === 'true')) : null;
                                                    const isFailedKnockout = req.isKnockout && checkedValue === false;
                                                    return (
                                                        <div key={req.id} className={`p-3 rounded-lg border transition-all ${checkedValue === true ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : checkedValue === false ? 'bg-red-50 border-red-200 text-red-950 ring-1 ring-red-300' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'}`}>
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs font-semibold">{req.name}</span>
                                                                {req.isKnockout && (
                                                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${isFailedKnockout ? 'bg-red-600 text-white animate-pulse' : 'bg-red-100 text-red-800'}`}>
                                                                        {isFailedKnockout ? 'Não Atendido' : 'Eliminatório'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            
                                                            <div className="flex gap-4 mt-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleCustomReq(req.id, checkedValue === true ? null : true)}
                                                                    className={`flex items-center gap-1.5 cursor-pointer text-xs select-none border rounded px-2.5 py-1 transition-all ${checkedValue === true ? 'bg-emerald-600 border-emerald-600 text-white font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checkedValue === true}
                                                                        readOnly
                                                                        className="rounded border-gray-300 text-emerald-600 pointer-events-none w-3.5 h-3.5"
                                                                    />
                                                                    <span>Atende</span>
                                                                </button>
                                                                
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleCustomReq(req.id, checkedValue === false ? null : false)}
                                                                    className={`flex items-center gap-1.5 cursor-pointer text-xs select-none border rounded px-2.5 py-1 transition-all ${checkedValue === false ? 'bg-red-600 border-red-600 text-white font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checkedValue === false}
                                                                        readOnly
                                                                        className="rounded border-gray-300 text-red-600 pointer-events-none w-3.5 h-3.5"
                                                                    />
                                                                    <span>Não Atende</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="pt-2 border-t space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Observações do Entrevistador</h4>
                                                    <Button size="sm" onClick={handleSaveNotes} className="bg-indigo-600 hover:bg-indigo-700 text-white h-7 px-3 text-xs">
                                                        <Save className="w-3.5 h-3.5 mr-1" />Salvar
                                                    </Button>
                                                </div>
                                                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações coletadas durante a entrevista..." className="min-h-20 text-xs bg-slate-50 border-slate-200" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-white border rounded-xl p-4 space-y-2 shadow-sm">
                                            <div className="flex justify-between items-center">
                                                <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Observações do Entrevistador</h4>
                                                <Button size="sm" onClick={handleSaveNotes} className="bg-indigo-600 hover:bg-indigo-700 text-white h-7 px-3 text-xs">
                                                    <Save className="w-3.5 h-3.5 mr-1" />Salvar
                                                </Button>
                                            </div>
                                            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações coletadas durante a entrevista..." className="min-h-20 text-xs bg-slate-50 border-slate-200" />
                                            <p className="text-xs text-amber-700 pt-1">Nenhum requisito cadastrado nesta vaga. Abra o card da Vaga - aba ATS - Checklist para adicionar.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                        </TabsContent>

                        <TabsContent value="documents" className="pt-2">
                            {candidate.type === 'VACANCY' && rankedCandidates.length > 1 && (
                                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between mb-4">
                                    <span className="text-xs font-semibold text-slate-700">Selecione o Candidato:</span>
                                    <Select value={selectedAdmissionCandidateId || activeCand?.id} onValueChange={setSelectedAdmissionCandidateId}>
                                        <SelectTrigger className="w-64 h-8 text-xs bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {rankedCandidates.map(c => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.name} ({c.stage?.name || 'Sem etapa'})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {activeCand ? (
                                <DocumentacaoPanel
                                    candidateId={activeCand.id}
                                    candidateName={activeCand.name}
                                    documentationLinkToken={activeCand.documentationLinkToken}
                                    documentationFiles={activeCand.documentationFiles}
                                    documentationStatus={activeCand.documentationStatus}
                                    extraFields={activeCand.extraFields}
                                    onUpdate={handleModalRefresh}
                                />
                            ) : (
                                <p className="text-xs text-slate-500 py-4 text-center">Nenhum candidato selecionado.</p>
                            )}
                        </TabsContent>

                        <TabsContent value="aso" className="pt-2">
                            {candidate.type === 'VACANCY' && rankedCandidates.length > 1 && (
                                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between mb-4">
                                    <span className="text-xs font-semibold text-slate-700">Selecione o Candidato:</span>
                                    <Select value={selectedAdmissionCandidateId || activeCand?.id} onValueChange={setSelectedAdmissionCandidateId}>
                                        <SelectTrigger className="w-64 h-8 text-xs bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {rankedCandidates.map(c => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.name} ({c.stage?.name || 'Sem etapa'})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {activeCand ? (
                                <ExamePanel
                                    candidateId={activeCand.id}
                                    candidateName={activeCand.name}
                                    asoFile={activeCand.asoFile}
                                    asoStatus={activeCand.asoStatus}
                                    onUpdate={handleModalRefresh}
                                />
                            ) : (
                                <p className="text-xs text-slate-500 py-4 text-center">Nenhum candidato selecionado.</p>
                            )}
                        </TabsContent>

                        <TabsContent value="admissao" className="pt-2">
                            {candidate.type === 'VACANCY' && rankedCandidates.length > 1 && (
                                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between mb-4">
                                    <span className="text-xs font-semibold text-slate-700">Selecione o Candidato:</span>
                                    <Select value={selectedAdmissionCandidateId || activeCand?.id} onValueChange={setSelectedAdmissionCandidateId}>
                                        <SelectTrigger className="w-64 h-8 text-xs bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {rankedCandidates.map(c => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.name} ({c.stage?.name || 'Sem etapa'})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {activeCand ? (
                                <OnvioPanel
                                    candidateId={activeCand.id}
                                    candidateName={activeCand.name}
                                    email={activeCand.email || activeCand.extraFields?.email}
                                    phone={activeCand.phone || activeCand.extraFields?.phone}
                                    cpf={activeCand.extraFields?.cpf || (activeCand as any).cpf}
                                    birthDate={activeCand.extraFields?.birthDate}
                                    gender={activeCand.extraFields?.gender}
                                    address={activeCand.extraFields?.address}
                                    rg={activeCand.extraFields?.rg}
                                    postoId={activeCand.vacancy?.postoId || candidate.vacancy?.postoId}
                                    roleId={activeCand.vacancy?.roleId || activeCand.vacancy?.posto?.roleId || candidate.vacancy?.roleId || candidate.vacancy?.posto?.roleId}
                                    roleTitle={activeCand.vacancy?.role?.name || activeCand.vacancy?.title || candidate.vacancy?.role?.name || candidate.vacancy?.title}
                                    salary={activeCand.vacancy?.posto?.baseSalary || activeCand.vacancy?.baseSalary || activeCand.vacancy?.salary || candidate.vacancy?.posto?.baseSalary || candidate.vacancy?.salary}
                                    startDate={activeCand.vacancy?.plannedStartDate ? new Date(activeCand.vacancy.plannedStartDate).toLocaleDateString('pt-BR') : ''}
                                    companyId={activeCand.vacancy?.companyId || candidate.vacancy?.companyId || "fc5dad55-9ef4-49bf-b82d-4524ad82bed6"}
                                    companyName={activeCand.vacancy?.company?.name || candidate.vacancy?.company?.name || "JVS FACILITIES LTDA"}
                                    extraFields={activeCand.extraFields}
                                    onvioLaunched={activeCand.onvioLaunched}
                                    onvioConfirmedAt={activeCand.onvioConfirmedAt}
                                    onUpdate={handleModalRefresh}
                                />
                            ) : (
                                <p className="text-xs text-slate-500 py-4 text-center">Nenhum candidato selecionado.</p>
                            )}
                        </TabsContent>

                        <TabsContent value="benefits" className="pt-2">
                            {candidate.type === 'VACANCY' && rankedCandidates.length > 1 && (
                                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between mb-4">
                                    <span className="text-xs font-semibold text-slate-700">Selecione o Candidato:</span>
                                    <Select value={selectedAdmissionCandidateId || activeCand?.id} onValueChange={setSelectedAdmissionCandidateId}>
                                        <SelectTrigger className="w-64 h-8 text-xs bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {rankedCandidates.map(c => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.name} ({c.stage?.name || 'Sem etapa'})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {activeCand ? (
                                <BeneficiosPanel
                                    candidateId={activeCand.id}
                                    cajuRegistered={activeCand.cajuRegistered}
                                    metocarRegistered={activeCand.metocarRegistered}
                                    urbisRegistered={activeCand.urbisRegistered}
                                    benefitsCompletedAt={activeCand.benefitsCompletedAt}
                                    onUpdate={handleModalRefresh}
                                />
                            ) : (
                                <p className="text-xs text-slate-500 py-4 text-center">Nenhum candidato selecionado.</p>
                            )}
                        </TabsContent>
                                    </Tabs>
                                );
                            })()}
                        </TabsContent>

                        <TabsContent value="history" className="mt-4">
                            <div className="bg-white rounded-lg border p-4 max-h-[400px] overflow-y-auto">
                                {loadingTimeline ? (
                                    <div className="py-8 text-center text-slate-500">Carregando histórico...</div>
                                ) : timeline.length === 0 ? (
                                    <div className="py-8 text-center text-slate-500">Nenhum registro encontrado.</div>
                                ) : (
                                    <div className="relative border-l border-slate-200 ml-3 space-y-6 py-2">
                                        {timeline.map((item) => (
                                            <div key={item.id} className="relative pl-6">
                                                <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border border-white 
                                                     ${item.action === 'WITHDRAWN' ? 'bg-red-500' :
                                                        item.action === 'CREATED' ? 'bg-emerald-500' :
                                                            item.action === 'REJECTED' ? 'bg-red-500' :
                                                                item.action === 'APPROVED' ? 'bg-emerald-600' :
                                                                    'bg-blue-500'}`}
                                                />
                                                <div className="text-sm font-medium text-slate-800">
                                                    {item.action === 'MOVED' && 'Movimentação de Etapa'}
                                                    {item.action === 'CREATED' && 'Candidato Inscrito'}
                                                    {item.action === 'WITHDRAWN' && 'Candidato Desistiu'}
                                                    {item.action === 'APPROVED' && 'Aprovação Realizada'}
                                                    {item.action === 'REJECTED' && 'Reprovação (Retorno)'}
                                                    {!['MOVED', 'CREATED', 'WITHDRAWN', 'APPROVED', 'REJECTED'].includes(item.action) && item.action}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {new Date(item.createdAt).toLocaleString()} por <span className="font-medium text-slate-700">{item.user?.name || 'Sistema'}</span>
                                                </div>
                                                {item.candidateName && item.candidateName !== candidate.name && (
                                                    <div className="text-xs text-slate-600 italic mt-1 bg-slate-50 p-1 rounded inline-block">
                                                        Candidato: {item.candidateName}
                                                    </div>
                                                )}
                                                <div className="text-sm text-slate-600 mt-1 bg-slate-50 p-2 rounded border border-slate-100">
                                                    {item.details}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-between pt-4 border-t mt-4">
                        <div className="flex gap-2">
                            {showApprovalActions && (
                                <>
                                    <Button
                                        onClick={() => handleApprovalClick('REJECT')}
                                        variant="outline"
                                        className="text-red-600 border-red-200 hover:bg-red-50"
                                        disabled={!prevStage}
                                    >
                                        <XCircle className="w-4 h-4 mr-2" />
                                        Reprovar
                                    </Button>
                                    <Button
                                        onClick={() => handleApprovalClick('APPROVE')}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                        disabled={!nextStage}
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Aprovar
                                    </Button>
                                </>
                            )}
                        </div>

                        <div className="flex gap-2">
                            {candidate.type !== 'VACANCY' && currentStage?.name === 'Admissão' && (
                                <Button
                                    type="button"
                                    onClick={() => {
                                        const event = new CustomEvent("workforceRpaCapture", {
                                            detail: {
                                                name: candidate.name,
                                                email: candidate.email || "",
                                                phone: candidate.phone || "",
                                                role: candidate.vacancy?.title || "",
                                                salary: candidate.vacancy?.salary ? String(candidate.vacancy.salary) : "",
                                                startDate: candidate.vacancy?.plannedStartDate ? new Date(candidate.vacancy.plannedStartDate).toLocaleDateString('pt-BR') : ""
                                            }
                                        });
                                        document.dispatchEvent(event);
                                        toast.success("Dados prontos! Abra o portal da Thomson Reuters e clique em Preencher.");
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                >
                                    ⚡ Preencher na Thomson Reuters
                                </Button>
                            )}

                            {candidate.type !== 'VACANCY' && (
                                <Button
                                    variant="destructive"
                                    disabled={currentStage?.name === 'Posto'}
                                    onClick={async () => {
                                        if (!confirm("Confirmar desistência? O registro do candidato será removido e arquivado no histórico da vaga.")) return;
                                        try {
                                            await withdrawCandidate(candidate.id);
                                            toast.success("Candidato removido. Histórico preservado na vaga.");
                                            if (onWithdrawSuccess) onWithdrawSuccess(candidate.id);
                                            onOpenChange(false);
                                        } catch (e) {
                                            toast.error("Erro ao registrar desistência");
                                        }
                                    }}
                                >
                                    Candidato Desistiu
                                </Button>
                            )}


                            {currentUser?.role === 'ADMIN' && (
                                <Button
                                    variant="destructive"
                                    className="bg-red-800 hover:bg-red-900 border-red-900"
                                    onClick={async () => {
                                        if (currentUser.role !== 'ADMIN') {
                                            toast.error(`Permissão negada. Seu papel é: ${currentUser.role}`);
                                            return;
                                        }

                                        if (!confirm("Confirmar EXCLUSÃO DEFINITIVA? Esta ação não pode ser desfeita.")) return;
                                        try {
                                            if (candidate.type === 'VACANCY') {
                                                const vacancyId = candidate.realId || candidate.id.replace('VAC-', '');
                                                const { deleteVacancy } = await import("@/actions/recruitment");
                                                const res = await deleteVacancy(vacancyId);
                                                if (res?.error) {
                                                    toast.error(res.error);
                                                    return;
                                                }
                                                toast.success("Vaga excluída permanentemente.");
                                                if (onWithdrawSuccess) onWithdrawSuccess(candidate.id);
                                            } else {
                                                await deleteCandidate(candidate.id);
                                                toast.success("Candidato excluído permanentemente.");
                                                if (onWithdrawSuccess) onWithdrawSuccess(candidate.id);
                                            }
                                            onOpenChange(false);
                                        } catch (e: any) {
                                            toast.error(e.message || "Erro ao excluir");
                                        }
                                    }}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Excluir (Admin)
                                </Button>
                            )}

                            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                        </div>
                    </div>
                </DialogContent >
            </Dialog >

            <ApprovalModal
                open={approvalModalOpen}
                onOpenChange={setApprovalModalOpen}
                action={approvalAction}
                candidateName={candidate.name}
                onConfirm={handleConfirmApproval}
            />

            <WhatsAppChatModal
                open={waModalOpen}
                onClose={() => setWaModalOpen(false)}
                candidate={waCandidate}
            />
        </>
    );
}

// Sub-components for cleaner code (could be moved to separate files, but kept here for now)
function CommentsSection({ vacancyId, currentUser, users = [] }: { vacancyId: string, currentUser: any, users?: any[] }) {
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState("");
    const [loading, setLoading] = useState(false);

    // Mention State
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [cursorPosition, setCursorPosition] = useState(0);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setNewComment(val);

        // Detect @ mention trigger
        // Look for @ at the end or followed by characters up to the cursor
        const cursor = e.target.selectionStart;
        setCursorPosition(cursor);

        const textBeforeCursor = val.slice(0, cursor);
        const lastAt = textBeforeCursor.lastIndexOf('@');

        if (lastAt !== -1) {
            // Check if there's a space before @ (or it's start of string)
            const globalIndex = lastAt;
            const isStart = globalIndex === 0;
            const hasSpaceBefore = !isStart && val[globalIndex - 1] === ' ';

            if (isStart || hasSpaceBefore) {
                const query = textBeforeCursor.slice(globalIndex + 1);
                // Only show if query doesn't contain spaces (simple mention logic)
                if (!query.includes(' ')) {
                    setMentionQuery(query);
                    setShowMentions(true);
                    return;
                }
            }
        }
        setShowMentions(false);
    };

    const insertMention = (userName: string) => {
        const textBeforeCursor = newComment.slice(0, cursorPosition);
        const lastAt = textBeforeCursor.lastIndexOf('@');
        const textAfterCursor = newComment.slice(cursorPosition);

        const newText = textBeforeCursor.slice(0, lastAt) + `@${userName} ` + textAfterCursor;
        setNewComment(newText);
        setShowMentions(false);

        // Refocus would be nice but simple state update works for now
    };

    const filteredUsers = showMentions
        ? users.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5)
        : [];

    useEffect(() => {
        loadComments();
    }, [vacancyId]);

    const loadComments = async () => {
        const data = await getRecruitmentComments(vacancyId);
        setComments(data);
    };

    const handleSend = async () => {
        if (!newComment.trim()) return;
        setLoading(true);
        try {
            const result = await addRecruitmentComment({ vacancyId, content: newComment });
            setNewComment("");
            loadComments();
            if (result && result.notifiedNames.length > 0) {
                toast.success(`Comentário enviado. Notificados: ${result.notifiedNames.join(", ")}`);
            } else {
                toast.warning("Comentário salvo, mas NINGUÉM foi notificado! (Vaga sem Recrutador/Participantes)");
            }
        } catch (error: any) {
            console.error(error);
            toast.error("Erro: " + (error.message || "Falha ao enviar"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">Comentários</h3>
            <div className="bg-slate-50 border rounded-lg p-4 max-h-[300px] overflow-y-auto space-y-4">
                {comments.length === 0 ? (
                    <div className="text-center text-slate-400 text-sm py-4">Nenhum comentário.</div>
                ) : (
                    comments.map(c => {
                        const isMe = currentUser?.id === c.user.id;
                        return (
                            <div key={c.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                                <Avatar className="w-8 h-8 border shadow-sm">
                                    <AvatarFallback className={`${isMe ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'} text-xs font-bold`}>
                                        {c.user.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className={`max-w-[80%] rounded-lg p-3 ${isMe ? 'bg-emerald-50 border border-emerald-100' : 'bg-white border'}`}>
                                    <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse justify-start' : ''}`}>
                                        <span className="font-semibold text-xs text-slate-800">{c.user.name}</span>
                                        <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{c.content}</div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            <div className="flex gap-2 relative">
                {showMentions && filteredUsers.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-2 w-60 bg-white border rounded shadow-lg z-50 overflow-hidden">
                        <div className="text-xs font-semibold px-2 py-1 bg-slate-50 text-slate-500 border-b">Mencionar usuário...</div>
                        {filteredUsers.map(user => (
                            <button
                                key={user.id}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex items-center gap-2"
                                onClick={() => insertMention(user.name)}
                            >
                                <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                                    {user.name.substring(0, 1)}
                                </div>
                                {user.name}
                            </button>
                        ))}
                    </div>
                )}
                <Textarea
                    value={newComment}
                    onChange={handleTextChange}
                    onKeyDown={(e) => {
                        // Allow ESC to close suggestions
                        if (showMentions && e.key === 'Escape') {
                            setShowMentions(false);
                        }
                    }}
                    placeholder="Escreva um comentário... Use @ para mencionar"
                    className="min-h-[80px]"
                />
                <Button onClick={handleSend} disabled={loading || !newComment.trim()} className="self-end">
                    Enviar
                </Button>
            </div>
        </div>
    );
}



function ParticipantsSection({ vacancyId, currentParticipants = [], allUsers = [], onAdd, onRemove }: { vacancyId: string, currentParticipants: any[], allUsers: any[], onAdd: (id: string) => void, onRemove: (id: string) => void }) {
    const [open, setOpen] = useState(false);

    // Filter users not already participating
    const availableUsers = allUsers.filter(u => !currentParticipants.some(p => p.id === u.id));

    return (
        <div className="space-y-4 pt-4 border-t border-orange-100/50">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm uppercase">Participantes</h3>
            <div className="flex flex-wrap gap-2 items-center">
                {currentParticipants.map(user => (
                    <div key={user.id} className="relative group">
                        <Avatar className="w-8 h-8 border-2 border-white shadow-sm cursor-help" title={user.name}>
                            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                                {user.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <button
                            onClick={() => onRemove(user.id)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-[2px] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Plus className="w-3 h-3 rotate-45" />
                        </button>
                    </div>
                ))}

                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 w-8 rounded-full p-0 border-dashed border-slate-300 hover:border-indigo-500 text-slate-400 hover:text-indigo-600">
                            <Plus className="w-4 h-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[200px]" align="start">
                        <div className="p-2">
                            <div className="text-xs font-medium text-slate-500 mb-2 px-2">Adicionar User</div>
                            {availableUsers.length === 0 ? (
                                <div className="text-sm text-slate-500 px-2">Todos já adicionados.</div>
                            ) : (
                                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                    {availableUsers.map(u => (
                                        <button
                                            key={u.id}
                                            onClick={() => { onAdd(u.id); setOpen(false); }}
                                            className="w-full text-left px-2 py-1.5 hover:bg-slate-100 rounded text-sm flex items-center gap-2"
                                        >
                                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                                                {u.name.substring(0, 1)}
                                            </div>
                                            <span className="truncate">{u.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}
