import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Building2, Briefcase, MapPin, Mail, Phone, Calendar, User, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { withdrawCandidate, getRecruitmentTimeline, moveCandidate } from "@/actions/recruitment";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { ApprovalModal } from "./ApprovalModal";

interface CandidateDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    candidate: any; // extended in implementation
    onWithdrawSuccess?: (candidateId: string) => void;
    stages?: any[]; // Passed from parent to determine flows
}

export function CandidateDetailsModal({ open, onOpenChange, candidate, onWithdrawSuccess, stages = [] }: CandidateDetailsModalProps) {
    const [timeline, setTimeline] = useState<any[]>([]);
    const [loadingTimeline, setLoadingTimeline] = useState(false);

    // Approval Flow State
    const [approvalModalOpen, setApprovalModalOpen] = useState(false);
    const [approvalAction, setApprovalAction] = useState<"APPROVE" | "REJECT" | null>(null);

    useEffect(() => {
        if (open && candidate) {
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
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
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
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="details">Detalhes</TabsTrigger>
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
                                                <div className="flex items-center gap-2 text-slate-700">
                                                    <Phone className="w-4 h-4 text-slate-400" />
                                                    <span>{candidate.phone || "Não informado"}</span>
                                                </div>
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
                                        </div>
                                    </div>
                                )}

                                {/* Vacancy Info */}
                                <div className={`space-y-4 ${candidate.type === 'VACANCY' ? 'col-span-2' : ''}`}>
                                    <h3 className="font-semibold text-orange-600 flex items-center gap-2">
                                        <Briefcase className="w-5 h-5" />
                                        Dados da Vaga
                                    </h3>
                                    <div className="bg-orange-50/50 p-4 rounded-lg border border-orange-100 space-y-3">
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 uppercase">Título da Vaga</label>
                                            <div className="text-slate-900 font-medium">{candidate.vacancy?.title}</div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 uppercase">Prioridade</label>
                                                <div className="mt-1">
                                                    <Badge variant={candidate.vacancy?.priority === 'URGENT' ? 'destructive' : 'secondary'}>
                                                        {candidate.vacancy?.priority}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 uppercase">Status</label>
                                                <div className="mt-1 text-sm font-medium">
                                                    {candidate.vacancy?.status}
                                                </div>
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

                                            <div>
                                                <label className="text-xs font-medium text-slate-500 uppercase">Data de Abertura</label>
                                                <div className="text-slate-700 mt-1 text-sm">
                                                    {candidate.vacancy?.createdAt ? new Date(candidate.vacancy.createdAt).toLocaleString() : 'N/A'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="py-2">
                                <label className="text-xs font-medium text-slate-500 uppercase">Descrição da Vaga</label>
                                <div className="bg-slate-50 p-3 rounded mt-1 text-sm text-slate-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                                    {candidate.vacancy?.description || "Sem descrição"}
                                </div>
                            </div>
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
                            {candidate.type !== 'VACANCY' && (
                                <Button
                                    variant="destructive"
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
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ApprovalModal
                open={approvalModalOpen}
                onOpenChange={setApprovalModalOpen}
                action={approvalAction}
                candidateName={candidate.name}
                onConfirm={handleConfirmApproval}
            />
        </>
    );
}
