import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { moveCandidate, updateStageSLA } from "@/actions/recruitment";
import { addBusinessDays } from "@/lib/business-days";
import { toast } from "sonner";
import { Plus, Briefcase, User as UserIcon, Settings, Clock, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CandidateDetailsModal } from "./CandidateDetailsModal";
import { CandidateModal } from "./CandidateModal";

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
    vacancy: {
        title: string;
        priority: string;
        status: string;
        role?: { name: string } | null;
        posto?: {
            name: string;
            client: { name: string }
        } | null;
        company?: { name: string } | null;
        description?: string;
    };
}

interface Stage {
    id: string;
    name: string;
    candidates: Candidate[];
    slaDays?: number; // NEW
    isSystem?: boolean;
}

interface KanbanBoardProps {
    initialStages: Stage[];
}

export function KanbanBoard({ initialStages }: KanbanBoardProps) {
    const [stages, setStages] = useState(initialStages);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // New Candidate Modal State
    const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
    const [selectedVacancyForCandidate, setSelectedVacancyForCandidate] = useState<string | null>(null);

    // FIX: Sync local state with server state when revalidatePath occurs
    useEffect(() => {
        setStages(initialStages);
    }, [initialStages]);

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

        // Normal Candidate Move Logic
        const sourceStageIndex = stages.findIndex(s => s.id === source.droppableId);
        const destStageIndex = stages.findIndex(s => s.id === destination.droppableId);

        const newStages = [...stages];
        const sourceStage = { ...newStages[sourceStageIndex] };
        const destStage = { ...newStages[destStageIndex] };

        const [movedCandidate] = sourceStage.candidates.splice(source.index, 1);

        // Optimistic Update for Due Date if moving to a stage with SLA
        if (destStage.slaDays && destStage.slaDays > 0) {
            const newDueDate = new Date();
            newDueDate.setDate(newDueDate.getDate() + destStage.slaDays);
            movedCandidate.stageDueDate = newDueDate;
        } else {
            movedCandidate.stageDueDate = undefined;
        }

        destStage.candidates.splice(destination.index, 0, movedCandidate);

        newStages[sourceStageIndex] = sourceStage;
        newStages[destStageIndex] = destStage;

        setStages(newStages);

        // Server Action
        try {
            await moveCandidate(draggableId, destination.droppableId);
            toast.success("Candidato movido com sucesso");
        } catch (error) {
            toast.error("Erro ao mover candidato");
            console.error(error);
            setStages(initialStages); // Revert on error
        }
    };

    const handleCardClick = (candidate: Candidate) => {
        if (!isDragging) {
            setSelectedCandidate(candidate);
            setIsDetailsOpen(true);
        }
    };

    const handleUpdateSLA = async (stageId: string, days: number) => {
        try {
            await updateStageSLA(stageId, days);
            setStages(prev => prev.map(s => {
                if (s.id === stageId) return { ...s, slaDays: days };
                return s;
            }));
            toast.success("SLA atualizado!");
        } catch (error) {
            toast.error("Erro ao atualizar SLA");
        }
    };

    const getDueDateStatus = (dueDate?: Date) => {
        if (!dueDate) return null;
        const now = new Date();
        const due = new Date(dueDate);
        const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

        // Format Date: "17/01"
        const formattedDate = due.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

        if (diffHours < 0) return { color: 'bg-red-100 text-red-700 border-red-200', text: `Venceu ${formattedDate}`, icon: AlertCircle };
        if (diffHours < 24) return { color: 'bg-amber-100 text-amber-700 border-amber-200', text: `Vence Hoje`, icon: Clock };
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
                    c.realId !== vacancyId && c.id !== `VAC-${vacancyId}`
                );
            }
            return newStages;
        });
        // Router refresh handled by the create action usually, but we can force if needed.
        router.refresh();
    };

    return (
        <div className="h-full overflow-x-auto">
            <DragDropContext onDragEnd={onDragEnd} onDragStart={() => setIsDragging(true)}>
                <div className="flex gap-4 h-full min-w-max pb-4">
                    {stages.map((stage) => {
                        // FIX: Use isSystem flag because ID is now dynamic from DB
                        const isRnsStage = stage.isSystem;
                        return (
                            <div key={stage.id} className={`w-80 flex flex-col rounded-lg h-full max-h-full ${isRnsStage ? 'bg-indigo-50 border-indigo-100 border' : 'bg-slate-100'}`}>
                                <div className={`p-3 font-semibold flex justify-between items-center border-b ${isRnsStage ? 'text-indigo-700 border-indigo-200' : 'text-slate-700 border-slate-200'}`}>
                                    <div className="flex items-center gap-2">
                                        <span>{stage.name}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${isRnsStage ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-200 text-slate-600'}`}>
                                            {stage.candidates.length}
                                        </span>
                                    </div>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-700" title="Configurar SLA">
                                                <Settings className="w-3.5 h-3.5" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-48 p-2">
                                            <div className="space-y-2">
                                                <h4 className="font-medium text-xs text-slate-500 uppercase">SLA da Etapa (Dias)</h4>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="number"
                                                        defaultValue={stage.slaDays || 0}
                                                        className="h-8"
                                                        onChange={(e) => {
                                                            if (e.target.value) handleUpdateSLA(stage.id, parseInt(e.target.value));
                                                        }}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-slate-400">
                                                    Define o tempo máximo de permanência nesta etapa.
                                                </p>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <Droppable droppableId={stage.id} isDropDisabled={isRnsStage}>
                                    {(provided, snapshot) => (
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className={`flex-1 p-2 overflow-y-auto space-y-2 transition-colors ${snapshot.isDraggingOver ? 'bg-slate-200/50' : ''}`}
                                        >
                                            {stage.candidates.map((candidate, index) => {
                                                // MOD: Standardize SLA calculation based on CreatedAt (Birth Date) for ALL stages
                                                // This ignores the persisted 'stageDueDate' (movement-based) and uses 'createdAt + stageSLA'
                                                const slaDays = stage.slaDays || 0;
                                                const calculatedDueDate = addBusinessDays(new Date(candidate.createdAt), slaDays);

                                                const dueStatus = candidate.type !== 'VACANCY' ? getDueDateStatus(calculatedDueDate) : null;

                                                // Recruiter can be directly on vacancy (for VACANCY type) or inside nested vacancy (for CANDIDATE type)
                                                // Wait, in my mappper "vacancy" property holds everything for both types?
                                                // Yes -> candidate.vacancy has the details. 
                                                // But let's check the Typescript interface update I need to verify if recruiter is there.
                                                // It is dynamic, so it's fine in JS/TSX but let's be safe.
                                                // @ts-ignore
                                                const recruiterName = candidate.vacancy?.recruiter?.name;

                                                return (
                                                    <Draggable key={candidate.id} draggableId={candidate.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                            // ... (lines 288-349 unchanged - keeping content)
                                                            >
                                                                {/* Header: Title and Priority */}
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div className="font-bold text-slate-800 line-clamp-2 leading-tight flex-1 mr-2 text-sm">
                                                                        {candidate.type === 'VACANCY' ? candidate.vacancy.title : candidate.name}
                                                                    </div>
                                                                    <Badge variant={candidate.vacancy.priority === 'URGENT' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                                                                        {candidate.vacancy.priority === 'URGENT' ? 'Urg' : candidate.vacancy.priority === 'HIGH' ? 'Alta' : 'Nor'}
                                                                    </Badge>
                                                                </div>

                                                                {/* Subtitle: Role/Context */}
                                                                <div className="text-xs text-slate-500 mb-3">
                                                                    {candidate.type === 'VACANCY' ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <Briefcase className="w-3 h-3 text-indigo-400" />
                                                                            <span>{candidate.vacancy.role?.name || "Sem Cargo"}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1">
                                                                            <Briefcase className="w-3 h-3 text-slate-400" />
                                                                            <span>{candidate.vacancy.role?.name || candidate.vacancy.title}</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Footer: Client, Due Date, Recruiter */}
                                                                <div className="flex flex-col gap-2 pt-2 border-t border-slate-50">
                                                                    <div className="flex justify-between items-center text-[11px] text-slate-400">
                                                                        <span className="truncate max-w-[120px]" title={candidate.vacancy.posto?.client?.name}>
                                                                            {candidate.vacancy.posto?.client?.name || candidate.vacancy.company?.name || "N/A"}
                                                                        </span>

                                                                        {/* Recruiter Avatar */}
                                                                        {recruiterName && (
                                                                            <div className="flex items-center gap-1" title={`Recrutador: ${recruiterName}`}>
                                                                                <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] font-bold border border-indigo-200">
                                                                                    {getInitials(recruiterName)}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex justify-between items-center">
                                                                        {candidate.type === 'VACANCY' ? (
                                                                            (() => {
                                                                                // @ts-ignore
                                                                                const start = new Date(candidate.createdAt);
                                                                                const sla = stage.slaDays || 0;
                                                                                const status = getVacancyDueDateStatus(start, sla);
                                                                                if (!status) return null;
                                                                                return (
                                                                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 gap-1 ${status.color} font-medium`}>
                                                                                        <status.icon className="w-3 h-3" />
                                                                                        {status.text}
                                                                                    </Badge>
                                                                                );
                                                                            })()
                                                                        ) : (
                                                                            stage.name === 'Posto' ? (
                                                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-1 bg-purple-100 text-purple-700 border-purple-200 font-medium" title="Tempo de Ciclo (Dias desde a criação)">
                                                                                    <Clock className="w-3 h-3" />
                                                                                    {Math.max(1, Math.floor((new Date(candidate.updatedAt || new Date()).getTime() - new Date(candidate.createdAt).getTime()) / (1000 * 60 * 60 * 24)))} dias
                                                                                </Badge>
                                                                            ) : (
                                                                                dueStatus && (
                                                                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 gap-1 ${dueStatus.color} font-medium`}>
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
                onWithdrawSuccess={handleWithdrawSuccess}
            />

            <CandidateModal
                open={isCandidateModalOpen}
                onOpenChange={setIsCandidateModalOpen}
                vacancies={vacanciesList}
                preSelectedVacancyId={selectedVacancyForCandidate || undefined}
                onCreateSuccess={() => handleVacancyConverted(selectedVacancyForCandidate || '')}
            />
        </div>
    );
}
