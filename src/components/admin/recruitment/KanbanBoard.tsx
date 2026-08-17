"use client";

import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { moveCandidate, updateStageConfig, getRecruiters, confirmOnvio } from "@/actions/recruitment";
import { addBusinessDays } from "@/lib/business-days";
import { isWeekend } from 'date-fns';
import { isHoliday } from '@/lib/business-days';
import { toast } from "sonner";
import { Plus, Briefcase, User as UserIcon, Settings, Clock, AlertCircle, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label"; // Ensure Label is imported or use standard label

import { CandidateDetailsModal } from "./CandidateDetailsModal";
import { CandidateModal } from "./CandidateModal";
import { NewEmployeeSheet } from "../NewEmployeeSheet";
import { getEmployeeFormData } from "@/actions/recruitment";

interface Candidate {
    id: string;
    realId?: string; // ID real do banco (vaga ou candidato)
    type?: 'VACANCY' | 'CANDIDATE';
    name: string;
    email?: string;
    phone?: string;
    createdAt: Date;
    updatedAt?: Date; // NEW
    stageDueDate?: Date; // NEW
    requirementsEvaluation?: any;
    appliedFromPublicForm?: boolean;
    unreadWhatsAppCount?: number;
    vacancy: {
        id?: string; // NEW: Added to fix TS error
        title: string;
        priority: string;
        status: string;
        role?: { name: string } | null;
        posto?: {
            id?: string; // New
            name: string;
            client: { name: string }
        } | null;
        company?: { name: string } | null;
        description?: string;
        createdAt?: Date; // NEW
        plannedStartDate?: Date | string | null;
        customRequirements?: any;
        candidates?: any[];
    };
    stage?: { id: string; name: string; approverId?: string | null }; // Needed for approval logic
}

interface Stage {
    id: string;
    name: string;
    candidates: Candidate[];
    slaDays?: number; // NEW
    isSystem?: boolean;
    approverId?: string | null; // NEW
}

interface KanbanBoardProps {
    initialStages: Stage[];
    currentUser?: any;
    recruiters?: any[]; // Passed for assignment
}

export function KanbanBoard({ initialStages, currentUser, recruiters = [] }: KanbanBoardProps) {
    const [stages, setStages] = useState(initialStages);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // New Candidate Modal State
    const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
    const [selectedVacancyForCandidate, setSelectedVacancyForCandidate] = useState<string | null>(null);

    // Employee Automation State
    const [isEmployeeSheetOpen, setIsEmployeeSheetOpen] = useState(false);
    const [pendingMove, setPendingMove] = useState<DropResult | null>(null);
    const [employeeFormData, setEmployeeFormData] = useState<{
        situations: { id: string, name: string }[];
        roles: { id: string, name: string }[];
        companies: { id: string, name: string }[];
        postos: any[];
    }>({ situations: [], roles: [], companies: [], postos: [] });
    const [prefilledEmployee, setPrefilledEmployee] = useState<any>(null);

    // FIX: Sync local state with server state when revalidatePath occurs
    useEffect(() => {
        setStages(initialStages);
    }, [initialStages]);

    useEffect(() => {
        getEmployeeFormData().then(setEmployeeFormData).catch(console.error);
    }, []);

    // Deep Linking Logic
    const searchParams = useSearchParams();
    const openId = searchParams.get('openId');

    useEffect(() => {
        if (openId && stages.length > 0) {
            // Try to find the candidate/vacancy in any stage
            let found = null;
            for (const stage of stages) {
                found = stage.candidates.find(c =>
                    c.id === openId ||
                    c.realId === openId ||
                    (c.type === 'VACANCY' && `VAC-${c.vacancy.id}` === openId) ||
                    (c.type === 'VACANCY' && c.id === openId)
                );
                if (found) break;
            }

            if (found) {
                // Determine if we should open via handleCardClick logic
                setSelectedCandidate(found);
                setIsDetailsOpen(true);

                // Clear the openId from URL to prevent reopening on refresh
                const url = new URL(window.location.href);
                url.searchParams.delete('openId');
                window.history.replaceState({}, '', url.toString());
            }
        }
    }, [openId, stages]);

    const onDragEnd = async (result: DropResult) => {
        setIsDragging(false);
        const { source, destination, draggableId } = result;

        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        // Logic for dragging FROM "R&S" (Vacancy) TO any other stage (creating candidate)
        const sourceStageRef = stages.find(s => s.id === source.droppableId);
        if (sourceStageRef?.isSystem) {
            // Find the vacancy object
            const item = sourceStageRef.candidates.find(c => c.id === draggableId);

            if (item && item.type === 'VACANCY') {
                // Open Candidate Modal pre-filled
                setSelectedVacancyForCandidate(item.realId || item.id.replace('VAC-', ''));
                setIsCandidateModalOpen(true);
                return; // Do not move the card visually
            }
        }

        // Se for uma vaga com múltiplos candidatos e nenhum foi escolhido pelo recrutador
        const movedItem = sourceStageRef?.candidates.find(c => c.id === draggableId);
        if (movedItem && movedItem.type === 'VACANCY') {
            const hasMultiple = (movedItem.vacancy?.candidates?.length || 0) > 0;
            const selectedCand = (movedItem as any).selectedCandidate || movedItem.vacancy?.candidates?.find((c: any) => c.id === movedItem.vacancy?.customRequirements?.selectedCandidateId);
            if (hasMultiple && !selectedCand) {
                toast.info("Abra a vaga e escolha qual candidato deseja avançar no processo.");
                setSelectedCandidate(movedItem);
                setIsDetailsOpen(true);
                return;
            }
        }

        const destStageRef = stages.find(s => s.id === destination.droppableId);

        // --- ACTION 03: Intercept Move to "Posto" ou "Admissão" ---
        if (destStageRef?.name?.toLowerCase() === 'posto' || destStageRef?.name?.toLowerCase().includes('admitido')) {
            const candidateToMove = sourceStageRef?.candidates[source.index];

            if (candidateToMove) {
                // Open Employee Sheet
                setPendingMove(result);

                // Extract the candidate from the vacancy card
                const selectedCand = (candidateToMove as any).selectedCandidate || candidateToMove.vacancy?.candidates?.find((c: any) => c.id === candidateToMove.vacancy?.customRequirements?.selectedCandidateId);
                const actualCandidate = selectedCand || candidateToMove.vacancy?.candidates?.[0] || candidateToMove;
                const extra = actualCandidate.extraFields || {};

                // Try to pre-fill data com IA e documentos extraídos
                setPrefilledEmployee({
                    name: actualCandidate.name || "",
                    email: actualCandidate.email || extra.email || "",
                    phone: actualCandidate.phone || extra.phone || "",
                    cpf: extra.cpf || actualCandidate.cpf || "",
                    birthDate: extra.birthDate || "",
                    gender: extra.gender || "",
                    address: extra.address || "",
                    roleId: (candidateToMove.vacancy as any)?.roleId || (candidateToMove.vacancy as any)?.role?.id || "",
                    companyId: (candidateToMove.vacancy as any)?.companyId || (candidateToMove.vacancy as any)?.company?.id || "",

                    // Automatic Link to Posto
                    postoId: candidateToMove.vacancy?.posto?.id || '',
                    postoName: candidateToMove.vacancy?.posto ? `${candidateToMove.vacancy.posto.name || 'Sem Nome'} - ${candidateToMove.vacancy.posto.client.name}` : undefined
                });

                setIsEmployeeSheetOpen(true);
                return; // Halt visual move until success
            }
        }

        // --- APPROVAL BLOCK CHECK ---
        const sourceStage = stages.find(s => s.id === source.droppableId);
        // Important: Checking local permission is tricky without user context in client.
        // We will optimistically attempt move, and revert if server checks fail.
        // However, user specifically asked: "buttons only available for this user... or administrator".
        // Drag and drop is hard to disable selectively without auth context. 
        // We will catch the server error and revert.

        // Normal Candidate Move Logic
        const sourceStageIndex = stages.findIndex(s => s.id === source.droppableId);
        const destStageIndex = stages.findIndex(s => s.id === destination.droppableId);

        if (sourceStageIndex === -1 || destStageIndex === -1) {
            return;
        }

        // --- RESTRICTION: Prevent Backward Drag ---
        if (destStageIndex < sourceStageIndex) {
            toast.error("Movimentação de retorno não permitida manualmente. Use as opções de Reprovar ou Desistir.");
            return;
        }

        // Clone deeply to prevent mutating state or initialStages directly
        const newStages = stages.map(s => ({
            ...s,
            candidates: [...s.candidates]
        }));

        const sourceCandidates = newStages[sourceStageIndex]?.candidates;
        if (!sourceCandidates || !sourceCandidates[source.index]) return;

        const [movedCandidate] = sourceCandidates.splice(source.index, 1);
        if (!movedCandidate) return;

        // Optimistic Update for Due Date if moving to a stage with SLA
        const destStage = newStages[destStageIndex];
        if (destStage?.slaDays && destStage.slaDays > 0) {
            const newDueDate = new Date();
            newDueDate.setDate(newDueDate.getDate() + destStage.slaDays);
            movedCandidate.stageDueDate = newDueDate;
        } else {
            movedCandidate.stageDueDate = undefined;
        }

        if (destStage?.candidates) {
            destStage.candidates.splice(destination.index, 0, movedCandidate);
        }

        setStages(newStages);

        try {
            const isMovingBackIndex = destStageIndex < sourceStageIndex;

            if (sourceStage?.approverId && isMovingBackIndex) {
                throw new Error("Para reprovar nesta etapa, abra o card e clique em Reprovar para justificar.");
            }

            await moveCandidate(draggableId, destination.droppableId);
            toast.success("Card movido com sucesso!");
        } catch (error: any) {
            // Revert state
            console.error(error);
            setStages(initialStages.map(s => ({ ...s, candidates: [...s.candidates] }))); // Reset to original
            toast.error(error.message || "Erro ao mover candidato");
        }
    };

    const handleCardClick = (candidate: Candidate) => {
        if (!isDragging) {
            setSelectedCandidate(candidate);
            setIsDetailsOpen(true);
        }
    };

    const handleUpdateStageConfig = async (stageId: string, sla: number, approverId: string | null) => {
        try {
            await updateStageConfig(stageId, { slaDays: sla, approverId });
            toast.success("Configuração da etapa atualizada");
            // Optimistic update
            setStages(prev => prev.map(s => s.id === stageId ? { ...s, slaDays: sla, approverId } : s));
        } catch (error) {
            toast.error("Erro ao atualizar etapa");
        }
    };

    // Helper for rendering config popover
    const renderStageConfig = (stage: Stage) => {
        const [sla, setSla] = useState(stage.slaDays || 0);
        const [approver, setApprover] = useState<string>(stage.approverId || "none");

        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <h4 className="font-medium text-xs text-slate-500 uppercase">SLA da Etapa (Dias)</h4>
                    <div className="flex gap-2">
                        <Input
                            type="number"
                            min="0"
                            value={sla}
                            onChange={(e) => setSla(parseInt(e.target.value) || 0)}
                            className="h-8"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <h4 className="font-medium text-xs text-slate-500 uppercase flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        Aprovador (Bloqueio)
                    </h4>
                    <Select value={approver} onValueChange={setApprover}>
                        <SelectTrigger className="h-8 w-full text-xs">
                            <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">-- Sem Aprovador --</SelectItem>
                            {recruiters.map(u => (
                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-[10px] text-slate-400 leading-tight">
                        Se definido, apenas este usuário ou admin poderão mover cards desta etapa.
                    </p>
                </div>

                <Button
                    size="sm"
                    className="w-full h-8 bg-slate-900 hover:bg-slate-800"
                    onClick={() => handleUpdateStageConfig(stage.id, sla, approver === "none" ? null : approver)}
                >
                    Salvar Configuração
                </Button>
            </div>
        );
    };

    const getDueDateStatus = (dueDate?: Date) => {
        if (!dueDate) return null;
        const now = new Date();
        const due = new Date(dueDate);
        const diffMs = due.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        const formattedDate = due.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

        if (diffHours < 0) return { color: 'bg-red-100 text-red-700 border-red-200', text: `Venceu ${formattedDate}`, icon: AlertCircle };

        // Never show "Vence Hoje" on weekends/holidays
        const isTodayBusinessDay = !isWeekend(now) && !isHoliday(now);
        const isToday = due.toDateString() === now.toDateString();

        if (isToday && isTodayBusinessDay) {
            return { color: 'bg-amber-100 text-amber-700 border-amber-200', text: `Vence Hoje`, icon: Clock };
        }

        // Within 24h but not today or not a business day
        if (diffHours < 24 && isTodayBusinessDay) {
            return { color: 'bg-amber-100 text-amber-700 border-amber-200', text: `Vence ${formattedDate}`, icon: Clock };
        }

        return { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', text: `Vence ${formattedDate}`, icon: Clock };
    };

    const getVacancyDueDateStatus = (createdAt: Date, slaDays: number) => {
        if (slaDays <= 0) return { color: 'bg-slate-100 text-slate-500 border-slate-200', text: 'Sem prazo', icon: Clock };

        const created = new Date(createdAt);
        const due = addBusinessDays(created, slaDays);

        return getDueDateStatus(due);
    };

    const getInitials = (name?: string) => {
        if (!name) return "?";
        return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
    };

    // Robust way to find the Vacancy Stage (R&S)
    const vacancyStage = stages.find(s => s.isSystem) || stages.find(s => s.candidates.some(c => c.type === 'VACANCY'));

    const vacanciesList = vacancyStage?.candidates.filter(c => c.type === 'VACANCY').map(c => ({
        id: c.realId || c.id.replace('VAC-', ''),
        title: c.vacancy.title
    })) || [];


    const router = useRouter();

    const handleWithdrawSuccess = (candidateId: string) => {
        setStages(prev => {
            const newStages = [...prev];
            // 1. Find and remove candidate
            let movedCandidate: Candidate | undefined;

            for (const stage of newStages) {
                const idx = stage.candidates.findIndex(c => c.id === candidateId);
                if (idx !== -1) {
                    [movedCandidate] = stage.candidates.splice(idx, 1);
                    break;
                }
            }

            if (movedCandidate) {
                // User requested: "Candidato deve sair do card" -> Remove completely.
                // Do not re-add to any stage.
            }
            return newStages;
        });

        // Sync fully with server
        router.refresh();
    };

    const handleVacancyConverted = (vacancyId: string) => {
        setStages(prev => {
            const newStages = [...prev];
            // Find R&S stage (System)
            const rnsStage = newStages.find(s => s.isSystem);
            if (rnsStage) {
                // Remove the vacancy card
                rnsStage.candidates = rnsStage.candidates.filter(c =>
                    c.realId !== vacancyId && c.id !== `VAC - ${vacancyId} `
                );
            }
            return newStages;
        });
        // Router refresh handled by the create action usually, but we can force if needed.
        router.refresh();
    };

    return (
        <div className="h-full min-h-[500px] overflow-x-auto">
            <DragDropContext onDragEnd={onDragEnd} onDragStart={() => setIsDragging(true)}>
                <div className="flex gap-2.5 min-w-max pb-4 items-start h-full">
                    {stages.map((stage) => {
                        // FIX: Use isSystem flag because ID is now dynamic from DB
                        const isRnsStage = stage.isSystem;
                        return (
                            <div key={stage.id} className={`w-[270px] flex flex-col rounded-xl min-h-[200px] border shadow-2xs ${isRnsStage ? 'bg-indigo-50/60 border-indigo-100' : 'bg-slate-100/70 border-slate-200/70'} `}>
                                <div className={`px-3 py-2 font-bold flex justify-between items-center border-b text-xs ${isRnsStage ? 'text-indigo-800 border-indigo-200' : 'text-slate-700 border-slate-200'} `}>
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold tracking-tight">{stage.name}</span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${isRnsStage ? 'bg-indigo-200/80 text-indigo-900' : 'bg-slate-200 text-slate-700'}`}>
                                            {stage.candidates.length}
                                        </span>
                                        {stage.approverId && (
                                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 ml-0.5" />
                                        )}
                                    </div>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-400 hover:text-slate-700" title="Configurar Etapa">
                                                <Settings className="w-3 h-3" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-4">
                                            {renderStageConfig(stage)}
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <Droppable droppableId={stage.id} isDropDisabled={isRnsStage}>
                                    {(provided, snapshot) => (
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className={`flex-1 p-1.5 space-y-1.5 transition-colors ${snapshot.isDraggingOver ? 'bg-slate-200/60' : ''}`}
                                        >
                                            {stage.candidates.map((candidate, index) => {
                                                // MOD: Standardize SLA calculation based on CreatedAt (Birth Date) for ALL stages
                                                const slaDays = stage.slaDays || 0;
                                                const calculatedDueDate = addBusinessDays(new Date(candidate.createdAt), slaDays);

                                                const dueStatus = candidate.type !== 'VACANCY' ? getDueDateStatus(calculatedDueDate) : null;

                                                // @ts-ignore
                                                const recruiterName = candidate.vacancy?.recruiter?.name;

                                                const reason = (candidate.vacancy as any)?.openingReason || "";
                                                const title = candidate.vacancy?.title || "";
                                                const desc = candidate.vacancy?.description || "";
                                                const isVacationCard = reason === 'FERIAS' || /férias|ferias/i.test(reason) || /férias|ferias/i.test(title) || /férias|ferias/i.test(desc);

                                                return (
                                                    <Draggable
                                                        key={candidate.id}
                                                        draggableId={candidate.id}
                                                        index={index}
                                                        isDragDisabled={stage.name === 'Aprovação Técnica' || !!stage.approverId}
                                                    >
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                style={{ ...provided.draggableProps.style }}
                                                                className={`bg-white p-2.5 rounded-lg border shadow-2xs hover:shadow-md transition-all cursor-pointer group
                                                                    ${isVacationCard ? 'border-cyan-200 bg-cyan-50/20 hover:border-cyan-400' : candidate.type === 'VACANCY' ? 'border-indigo-100/90 hover:border-indigo-300' : 'border-slate-200'}
                                                                    ${snapshot.isDragging ? 'rotate-1 shadow-lg ring-2 ring-indigo-500/20' : ''}
                                                                    ${candidate.type === 'CANDIDATE' && candidate.requirementsEvaluation?.isDisqualified ? 'opacity-65 border-red-200 bg-red-50/20' : ''}
                                                                `}
                                                                onClick={() => handleCardClick(candidate)}
                                                            >
                                                                {/* Header: Title, Férias Badge and Priority */}
                                                                <div className="flex justify-between items-start gap-1 mb-1">
                                                                    <div className="font-bold text-slate-800 line-clamp-2 leading-snug flex-1 text-xs flex flex-col gap-0.5">
                                                                        <span className="text-slate-900 font-bold group-hover:text-indigo-600 transition-colors">
                                                                            {candidate.type === 'VACANCY' ? candidate.vacancy.title : candidate.name}
                                                                        </span>
                                                                        {candidate.type === 'VACANCY' && candidate.vacancy.plannedStartDate && (
                                                                            <span className="text-[10px] text-indigo-600 font-semibold">
                                                                                Início: {new Date(candidate.vacancy.plannedStartDate).toLocaleDateString('pt-BR')}
                                                                            </span>
                                                                        )}
                                                                        {candidate.type === 'CANDIDATE' && (
                                                                            <div className="flex items-center gap-1 mt-0.5">
                                                                                {candidate.requirementsEvaluation?.isDisqualified ? (
                                                                                    <span className="px-1.5 py-0.2 rounded bg-red-100 text-red-800 text-[9px] font-black uppercase tracking-wider">ELIMINADO</span>
                                                                                ) : candidate.requirementsEvaluation?.adherenceScore !== undefined ? (
                                                                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider
                                                                                        ${candidate.requirementsEvaluation.adherenceScore >= 75 ? 'bg-emerald-100 text-emerald-800' : 
                                                                                          candidate.requirementsEvaluation.adherenceScore >= 50 ? 'bg-amber-100 text-amber-800' : 
                                                                                          'bg-red-100 text-red-800'}
                                                                                    `}>
                                                                                        {candidate.requirementsEvaluation.adherenceScore}% Aderência
                                                                                    </span>
                                                                                ) : null}
                                                                                {candidate.appliedFromPublicForm && (
                                                                                    <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 text-[9px] font-black uppercase tracking-wider" title="Inscrição pública via Meta Ads">Meta Ads</span>
                                                                                )}
                                                                                {((candidate.unreadWhatsAppCount && candidate.unreadWhatsAppCount > 0) || (candidate as any).extraFields?.unreadWhatsAppCount > 0) && (
                                                                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black tracking-wider flex items-center gap-1 shadow-xs animate-pulse" title="Novas mensagens não lidas no WhatsApp">
                                                                                        💬 {candidate.unreadWhatsAppCount || (candidate as any).extraFields?.unreadWhatsAppCount}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                                        <Badge variant={candidate.vacancy?.priority === 'URGENT' ? 'destructive' : 'secondary'} className="text-[9px] px-1.5 py-0 h-4 font-bold shrink-0 uppercase tracking-wider">
                                                                            {candidate.vacancy?.priority === 'URGENT' ? 'Urg' : candidate.vacancy?.priority === 'HIGH' ? 'Alta' : 'Nor'}
                                                                        </Badge>
                                                                        {isVacationCard && (
                                                                            <span className="px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-900 border border-cyan-300/80 text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5 shadow-2xs" title="Vaga proveniente de Férias">
                                                                                🏖️ Férias
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Subtitle: Role/Context */}
                                                                <div className="text-[11px] text-slate-500 font-medium mb-1.5 flex items-center gap-1">
                                                                    <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                                                                    <span className="truncate">
                                                                        {candidate.type === 'VACANCY'
                                                                            ? (candidate.vacancy?.role?.name || "Sem Cargo")
                                                                            : (candidate.vacancy?.role?.name || candidate.vacancy?.title || "Sem Vaga")}
                                                                    </span>
                                                                </div>

                                                                {/* Indicador do Candidato Escolhido pelo Recrutador */}
                                                                {candidate.type === 'VACANCY' && (
                                                                    <div className="mb-2">
                                                                        {(candidate as any).selectedCandidate && typeof (candidate as any).selectedCandidate === 'object' ? (
                                                                            <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-300/80 flex items-center justify-between text-[11px] shadow-2xs">
                                                                                <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                                                                                    <span className="text-emerald-700 font-black shrink-0">⭐</span>
                                                                                    <span className="font-extrabold text-emerald-950 truncate max-w-[130px]" title={(candidate as any).selectedCandidate.name || 'Candidato'}>
                                                                                        {(candidate as any).selectedCandidate.name || 'Candidato'}
                                                                                    </span>
                                                                                </div>
                                                                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-200 text-emerald-900 font-extrabold uppercase shrink-0">
                                                                                    {(candidate as any).selectedCandidate.stageName || 'Ativo'}
                                                                                </span>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="p-1 rounded-md bg-amber-50/80 border border-amber-200 text-[10px] text-amber-800 font-bold flex items-center justify-between">
                                                                                <span className="flex items-center gap-1">
                                                                                    <span>⚠️</span>
                                                                                    <span>Escolha no Ranking</span>
                                                                                </span>
                                                                                <span className="text-[9px] text-amber-700 font-mono">
                                                                                    {candidate.vacancy?.candidates?.length || 0} cand.
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Footer: Client, Due Date, Recruiter */}
                                                                <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-100">
                                                                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                                                                        <span className="truncate max-w-[125px] font-semibold text-slate-600" title={candidate.vacancy?.posto?.client?.name}>
                                                                            {candidate.vacancy?.posto?.client?.name || candidate.vacancy?.company?.name || "N/A"}
                                                                        </span>

                                                                        {/* BUTTON: Alocar no Posto if in stage Admissão / Admitido / Benefícios / Concluído / Posto */}
                                                                        {(
                                                                            stage.name.toLowerCase().includes('admi') || 
                                                                            stage.name.toLowerCase().includes('onvio') || 
                                                                            stage.name.toLowerCase().includes('bene') || 
                                                                            stage.name.toLowerCase().includes('conclu') || 
                                                                            stage.name.toLowerCase() === 'posto'
                                                                        ) && (
                                                                            <Button
                                                                                size="sm"
                                                                                variant="default"
                                                                                className="h-5 text-[9px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-2xs flex items-center gap-1 cursor-pointer"
                                                                                onClick={async (e) => {
                                                                                    e.stopPropagation();
                                                                                    try {
                                                                                        const targetCandId = candidate.type === 'VACANCY'
                                                                                            ? ((candidate.vacancy?.customRequirements as any)?.selectedCandidateId || candidate.vacancy?.candidates?.[0]?.id)
                                                                                            : candidate.id;
                                                                                        if (!targetCandId) {
                                                                                            toast.error("Nenhum candidato selecionado para a vaga.");
                                                                                            return;
                                                                                        }
                                                                                        toast.info("Alocando colaborador no posto...");
                                                                                        const res = await confirmOnvio(targetCandId);
                                                                                        if (res.success) {
                                                                                            toast.success("🏢 Colaborador admitido e alocado no posto com sucesso!");
                                                                                            router.refresh();
                                                                                        }
                                                                                    } catch (err: any) {
                                                                                        toast.error(err.message || "Erro ao alocar no posto");
                                                                                    }
                                                                                }}
                                                                            >
                                                                                🏢 Alocar no Posto
                                                                            </Button>
                                                                        )}

                                                                        {/* Recruiter Avatar */}
                                                                        {recruiterName && (
                                                                            <div className="flex items-center gap-1" title={`Recrutador: ${recruiterName}`}>
                                                                                <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[8px] font-bold border border-indigo-200">
                                                                                    {getInitials(recruiterName)}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* SLA / Due Date Badge */}
                                                                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                                                                        <span className="text-[10px] text-slate-400">
                                                                            Abertura: {candidate.vacancy?.createdAt ? new Date(candidate.vacancy.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'N/A'}
                                                                        </span>

                                                                        {candidate.type === 'VACANCY' ? (
                                                                            (() => {
                                                                                // @ts-ignore
                                                                                const start = new Date(candidate.createdAt);
                                                                                const sla = stage.slaDays || 0;
                                                                                const status = getVacancyDueDateStatus(start, sla);
                                                                                if (!status) return null;
                                                                                return (
                                                                                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 gap-1 ${status.color} font-medium`}>
                                                                                        <status.icon className="w-2.5 h-2.5" />
                                                                                        {status.text}
                                                                                    </Badge>
                                                                                );
                                                                            })()
                                                                        ) : (
                                                                            stage.name === 'Posto' ? (
                                                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 gap-1 bg-purple-100 text-purple-700 border-purple-200 font-medium" title="Tempo de Ciclo (Dias desde a criação)">
                                                                                    <Clock className="w-2.5 h-2.5" />
                                                                                    {Math.max(1, Math.floor((new Date(candidate.updatedAt || new Date()).getTime() - new Date(candidate.createdAt).getTime()) / (1000 * 60 * 60 * 24)))}d
                                                                                </Badge>
                                                                            ) : (
                                                                                dueStatus && (
                                                                                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 gap-1 ${dueStatus.color} font-medium`}>
                                                                                        <dueStatus.icon className="w-2.5 h-2.5" />
                                                                                        {dueStatus.text}
                                                                                    </Badge>
                                                                                )
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                );
                                            })}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        );
                    })}
                </div>
            </DragDropContext>

            <CandidateDetailsModal
                open={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
                candidate={selectedCandidate}
                stages={stages}
                onWithdrawSuccess={handleWithdrawSuccess}
                currentUser={currentUser}
                recruiters={recruiters}
            />

            <CandidateModal
                open={isCandidateModalOpen}
                onOpenChange={setIsCandidateModalOpen}
                vacancies={vacanciesList}
                preSelectedVacancyId={selectedVacancyForCandidate || undefined}
                onCreateSuccess={() => handleVacancyConverted(selectedVacancyForCandidate || '')}
            />

            <NewEmployeeSheet
                open={isEmployeeSheetOpen}
                onOpenChange={(open) => {
                    setIsEmployeeSheetOpen(open);
                    if (!open) setPendingMove(null); // Cancel move if closed without success
                }}
                situations={employeeFormData.situations}
                roles={employeeFormData.roles}
                companies={employeeFormData.companies}
                postos={employeeFormData.postos}
                initialData={prefilledEmployee}
                onSuccess={() => {
                    if (pendingMove) {
                        // Complete the move
                        const { source, destination, draggableId } = pendingMove;
                        if (!destination) return; // Should not happen based on logic

                        // Execute the move logic (Copy-paste from onDragEnd essentially, 
                        // but we need to call the backend function and update state)
                        // To avoid duplicating complex logic, we can verify if we can just re-call onDragEnd?
                        // No, because onDragEnd expects a result and has the interceptor.
                        // We need a bypass or extract the move logic.

                        // Let's implement the move logic directly here for this specific case
                        // OR modify onDragEnd to accept a "force" flag?
                        // Cleaner: Extract logic to `executeMove` function.

                        // For now, let's just duplicate the crucial core move logic to be safe and simple

                        const sourceStageIndex = stages.findIndex(s => s.id === source.droppableId);
                        const destStageIndex = stages.findIndex(s => s.id === destination.droppableId);

                        if (sourceStageIndex === -1 || destStageIndex === -1) return;

                        const newStages = [...stages];
                        const newSourceStage = { ...newStages[sourceStageIndex] };
                        const newDestStage = { ...newStages[destStageIndex] };

                        const [movedCandidate] = newSourceStage.candidates.splice(source.index, 1);
                        newDestStage.candidates.splice(destination.index, 0, movedCandidate);

                        newStages[sourceStageIndex] = newSourceStage;
                        newStages[destStageIndex] = newDestStage;

                        setStages(newStages);

                        moveCandidate(draggableId, destination.droppableId)
                            .then(() => toast.success("Colaborador cadastrado e candidato movido para Posto!"))
                            .catch(err => {
                                console.error(err);
                                toast.error("Erro ao mover candidato no banco.");
                                setStages(stages); // Revert
                            });

                        setPendingMove(null);
                        setIsEmployeeSheetOpen(false);
                    } else {
                        // Manual 'Finish Hiring' success case
                        toast.success("Contratação finalizada! Colaborador criado e vinculado.");
                        setIsEmployeeSheetOpen(false);
                    }
                }}
            />
        </div>
    );
}
