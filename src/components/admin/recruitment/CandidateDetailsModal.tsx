import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Building2, Briefcase, MapPin, Mail, Phone, Calendar, User, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { withdrawCandidate, getRecruitmentTimeline, moveCandidate, deleteCandidate, updateVacancy, addVacancyParticipant, removeVacancyParticipant, addRecruitmentComment, getRecruitmentComments } from "@/actions/recruitment";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
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
    currentUser?: any;
    recruiters?: any[];
}

export function CandidateDetailsModal({ open, onOpenChange, candidate, onWithdrawSuccess, stages = [], currentUser, recruiters = [] }: CandidateDetailsModalProps) {
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
                                                            await updateVacancy(candidate.vacancy.id, { priority: val });
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
                                                            await updateVacancy(candidate.vacancy.id, { recruiterId: val });
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

                                            <div>
                                                <label className="text-xs font-medium text-slate-500 uppercase">Data de Abertura</label>
                                                <div className="text-slate-700 mt-1 text-sm">
                                                    {candidate.vacancy?.createdAt ? new Date(candidate.vacancy.createdAt).toLocaleString() : 'N/A'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Participants Section */}
                                        {candidate.type === 'VACANCY' && candidate.vacancy && (
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

                                    {candidate.type === 'VACANCY' && candidate.vacancy && (
                                        <CommentsSection vacancyId={candidate.vacancy.id} currentUser={currentUser} />
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
                    </Tabs >

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

                            {candidate.type !== 'VACANCY' && currentUser && (
                                <Button
                                    variant="destructive"
                                    className="bg-red-800 hover:bg-red-900 border-red-900"
                                    onClick={async () => {
                                        if (currentUser.role !== 'ADMIN') {
                                            toast.error(`Permissão negada. Seu papel é: ${currentUser.role}`);
                                            return;
                                        }

                                        if (!confirm("Confirmar EXCLUSÃO DEFINITIVA? Esta ação não pode ser desfeita e removerá todo o histórico.")) return;
                                        try {
                                            await deleteCandidate(candidate.id);
                                            toast.success("Candidato excluído permanentemente.");
                                            if (onWithdrawSuccess) onWithdrawSuccess(candidate.id);
                                            onOpenChange(false);
                                        } catch (e: any) {
                                            toast.error(e.message || "Erro ao excluir candidato");
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
        </>
    );
}

// Sub-components for cleaner code (could be moved to separate files, but kept here for now)
function CommentsSection({ vacancyId, currentUser }: { vacancyId: string, currentUser: any }) {
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState("");
    const [loading, setLoading] = useState(false);

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
            await addRecruitmentComment({ vacancyId, content: newComment });
            setNewComment("");
            loadComments();
            toast.success("Comentário enviado");
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
            <div className="flex gap-2">
                <Textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Escreva um comentário..."
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
