import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { moveCandidate, updateStageSLA } from "@/actions/recruitment";
import { toast } from "sonner";
import { Plus, Briefcase, User as UserIcon, Settings, Clock, AlertCircle } from "lucide-react";
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

    const onDragEnd = async (result: DropResult) => {
        setIsDragging(false);
        const { source, destination, draggableId } = result;

        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        // Logic for dragging FROM "R&S" (Vacancy) TO any other stage (creating candidate)
        if (source.droppableId === 'STAGE-RNS') {
            // Find the vacancy object
            const sourceStage = stages.find(s => s.id === source.droppableId);
            const item = sourceStage?.candidates.find(c => c.id === draggableId);

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

        if (diffHours < 0) return { color: 'bg-red-100 text-red-700 border-red-200', text: 'Atrasado', icon: AlertCircle };
        if (diffHours < 24) return { color: 'bg-amber-100 text-amber-700 border-amber-200', text: 'Expira hoje', icon: Clock };
        return { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', text: 'No prazo', icon: Clock };
    };

    const vacanciesList = stages.find(s => s.id === 'STAGE-RNS')?.candidates.map(c => ({
        id: c.realId || '',
        title: c.vacancy.title
    })) || [];


    return (
        <div className="h-full overflow-x-auto">
            <DragDropContext onDragEnd={onDragEnd} onDragStart={() => setIsDragging(true)}>
                <div className="flex gap-4 h-full min-w-max pb-4">
                    {stages.map((stage) => {
                        const isRnsStage = stage.id === 'STAGE-RNS';
                        return (
                            <div key={stage.id} className={`w-80 flex flex-col rounded-lg h-full max-h-full ${isRnsStage ? 'bg-indigo-50 border-indigo-100 border' : 'bg-slate-100'}`}>
                                <div className={`p-3 font-semibold flex justify-between items-center border-b ${isRnsStage ? 'text-indigo-700 border-indigo-200' : 'text-slate-700 border-slate-200'}`}>
                                    <div className="flex items-center gap-2">
                                        <span>{stage.name}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${isRnsStage ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-200 text-slate-600'}`}>
                                            {stage.candidates.length}
                                        </span>
                                    </div>
                                    {!isRnsStage && (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-700">
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
                                    )}
                                </div>

                                <Droppable droppableId={stage.id} isDropDisabled={isRnsStage}>
                                    {(provided, snapshot) => (
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className={`flex-1 p-2 overflow-y-auto space-y-2 transition-colors ${snapshot.isDraggingOver ? 'bg-slate-200/50' : ''}`}
                                        >
                                            {stage.candidates.map((candidate, index) => {
                                                const dueStatus = candidate.type !== 'VACANCY' ? getDueDateStatus(candidate.stageDueDate) : null;

                                                return (
                                                    <Draggable key={candidate.id} draggableId={candidate.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                onClick={() => handleCardClick(candidate)}
                                                                className={`p-3 rounded shadow-sm border hover:shadow-md transition-shadow group cursor-pointer 
                                                                    ${candidate.type === 'VACANCY' ? 'bg-white border-indigo-200' : 'bg-white border-slate-200'}
                                                                    ${snapshot.isDragging ? 'rotate-2 shadow-lg ring-2 ring-indigo-500/20' : ''}
                                                                `}
                                                            >
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div className="font-medium text-slate-900 line-clamp-1 flex items-center gap-2">
                                                                        {candidate.type === 'VACANCY' && <Briefcase className="w-4 h-4 text-indigo-500" />}
                                                                        {candidate.type !== 'VACANCY' && <UserIcon className="w-4 h-4 text-slate-400" />}
                                                                        {candidate.name}
                                                                    </div>
                                                                    <Badge variant={candidate.vacancy.priority === 'URGENT' ? 'destructive' : 'secondary'} className="text-[10px] px-1 py-0 h-5">
                                                                        {candidate.vacancy.priority === 'URGENT' ? 'Urg' : candidate.vacancy.priority === 'HIGH' ? 'Alta' : 'Nor'}
                                                                    </Badge>
                                                                </div>

                                                                <div className="text-xs text-slate-500 space-y-1">
                                                                    <div className="font-medium text-slate-700 truncate">
                                                                        {candidate.vacancy.role?.name || candidate.vacancy.title}
                                                                    </div>

                                                                    <div className="flex justify-between items-center pt-1">
                                                                        <span className="truncate max-w-[120px]">
                                                                            {candidate.vacancy.posto?.client?.name || candidate.vacancy.company?.name || "N/A"}
                                                                        </span>

                                                                        {dueStatus && (
                                                                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 gap-1 ${dueStatus.color}`}>
                                                                                <dueStatus.icon className="w-3 h-3" />
                                                                                {dueStatus.text}
                                                                            </Badge>
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
            />

            <CandidateModal
                open={isCandidateModalOpen}
                onOpenChange={setIsCandidateModalOpen}
                vacancies={vacanciesList}
                preSelectedVacancyId={selectedVacancyForCandidate || undefined}
            />
        </div>
    );
}
