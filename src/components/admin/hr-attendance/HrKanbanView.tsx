"use client";

import { ClipboardList, Calendar, MessageSquare, DollarSign, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    useDroppable,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { saveHrPipelineStages, deleteHrPipelineStage, updateHrTicketStage } from "@/actions/hr-attendance";

interface Props {
    stages: any[];
    tickets: any[];
    onSelectTicket: (ticketId: string, initialTab?: "chat" | "notes" | "activities" | "value") => void;
    onStagesUpdated: () => void;
}


const PRESET_COLORS = [
    "#6366f1", "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981",
    "#ec4899", "#ef4444", "#14b8a6", "#64748b", "#84cc16",
    "#06b6d4", "#d97706", "#4f46e5", "#059669", "#dc2626"
];

// Card do Contato Arrastável no Kanban
function SortableTicketCard({ ticket, onClick, onSelectTicket }: { ticket: any; onClick: () => void; onSelectTicket: (id: string, tab?: any) => void }) {

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: ticket.id,
        data: { type: "TICKET", ticket }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const lastMsg = ticket.messages?.[0];
    const unreadCount = ticket.unreadCount || 0;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-emerald-500 transition cursor-grab active:cursor-grabbing flex flex-col justify-between group touch-none"
        >
            {/* Header do Card: Foto + Nome + Badge Verde */}
            <div className="flex items-start gap-2.5 mb-1.5">
                <div className="relative flex-shrink-0">
                    {ticket.contactPhotoUrl && ticket.contactPhotoUrl !== "null" ? (
                        <img
                            src={ticket.contactPhotoUrl}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover border border-slate-200"
                        />
                    ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-700 text-white font-bold text-xs flex items-center justify-center">
                            {ticket.contactName?.charAt(0).toUpperCase() || "?"}
                        </div>
                    )}

                    {unreadCount > 0 && (
                        <span className="absolute -bottom-1 -right-1 bg-[#25d366] text-white text-[9px] font-extrabold min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-0.5 border-2 border-white shadow-2xs">
                            {unreadCount}
                        </span>
                    )}
                </div>

                <div className="overflow-hidden flex-1">
                    <h4 className="text-xs font-bold text-slate-800 truncate leading-tight">{ticket.contactName}</h4>
                    <p className="text-[11px] text-slate-500 truncate leading-snug mt-0.5">
                        {lastMsg ? (
                            <span>{lastMsg.senderType === "ATTENDANT" ? "✓ " : ""}{lastMsg.content}</span>
                        ) : (
                            <span className="italic text-slate-400">Atendimento: {ticket.title}</span>
                        )}
                    </p>
                </div>
            </div>

            {/* Barra de Ícones Rápidos [ 📋 📅 💬 💲 ] */}
            <div className="flex items-center gap-3 pt-2 text-slate-400 text-[10px]">
                <button
                    className="hover:text-emerald-600 transition flex items-center gap-0.5"
                    title="Ver / Deixar Anotações"
                    onClick={(e) => { e.stopPropagation(); onSelectTicket(ticket.id, "notes"); }}
                >
                    <ClipboardList className="w-3.5 h-3.5" />
                </button>
                <button
                    className="hover:text-amber-600 transition flex items-center gap-0.5"
                    title="Agendar Lembrete / Atividade"
                    onClick={(e) => { e.stopPropagation(); onSelectTicket(ticket.id, "activities"); }}
                >
                    <Calendar className="w-3.5 h-3.5" />
                </button>
                <button
                    className="hover:text-emerald-600 transition flex items-center gap-0.5"
                    title="Abrir Chat do WhatsApp"
                    onClick={(e) => { e.stopPropagation(); onSelectTicket(ticket.id, "chat"); }}
                >
                    <MessageSquare className="w-3.5 h-3.5" />
                </button>
                <button
                    className="hover:text-blue-600 transition flex items-center gap-0.5 font-bold"
                    title="Definir Valor / Proposta"
                    onClick={(e) => { e.stopPropagation(); onSelectTicket(ticket.id, "value"); }}
                >
                    <DollarSign className="w-3.5 h-3.5" />
                </button>
            </div>


        </div>
    );
}

// Coluna Arrastável do Kanban
function DroppableKanbanColumn({ stage, stageTickets, onSelectTicket, onUpdateStage, onDeleteStage, onAddNextStage }: any) {
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: stage.id,
        data: { type: "STAGE", stage }
    });

    const {
        attributes,
        listeners,
        setNodeRef: setSortableRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: stage.id, data: { type: "COLUMN", stage } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const [isEditingName, setIsEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(stage.name);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const handleSaveName = () => {
        setIsEditingName(false);
        if (nameInput.trim() && nameInput !== stage.name) {
            onUpdateStage(stage.id, { name: nameInput.trim() });
        }
    };

    return (
        <div
            ref={(node) => {
                setSortableRef(node);
                setDroppableRef(node);
            }}
            style={{ ...style, borderTopColor: stage.color || "#6366f1" }}
            className={`w-72 flex-shrink-0 bg-slate-100/90 rounded-2xl p-2.5 flex flex-col max-h-[82vh] border-t-4 shadow-xs transition ${
                isOver ? "bg-emerald-50/80 border-emerald-500" : ""
            }`}
        >
            {/* Header da Coluna com Seletor de Cor + Nome + Drag Handle */}
            <div className="flex items-center justify-between mb-2 px-1 pb-1">
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                    {/* Handle Drag da Coluna */}
                    <button
                        {...attributes}
                        {...listeners}
                        className="cursor-grab text-slate-400 hover:text-slate-700 text-xs"
                        title="Reordenar Coluna"
                    >
                        ⋮⋮
                    </button>

                    {/* Color Picker Clicável na Bolinha de Cor */}
                    <div className="relative">
                        <button
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className="w-4 h-4 rounded-full block border border-black/20 hover:scale-110 transition shadow-2xs cursor-pointer"
                            style={{ backgroundColor: stage.color || "#6366f1" }}
                            title="Clique para alterar a cor da coluna"
                        />
                        {showColorPicker && (
                            <div className="absolute left-0 top-6 z-50 bg-white p-2.5 rounded-xl shadow-2xl border grid grid-cols-5 gap-1.5 w-40">
                                {PRESET_COLORS.map(c => (
                                    <button
                                        key={c}
                                        className="w-5 h-5 rounded-full border border-black/10 hover:scale-110 transition"
                                        style={{ backgroundColor: c }}
                                        onClick={() => {
                                            onUpdateStage(stage.id, { color: c });
                                            setShowColorPicker(false);
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Nome da Etapa Editável */}
                    {isEditingName ? (
                        <input
                            autoFocus
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            onBlur={handleSaveName}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); }}
                            className="text-xs font-extrabold text-slate-800 uppercase bg-white border rounded px-1.5 py-0.5 h-6 w-full"
                        />
                    ) : (
                        <h3
                            onClick={() => setIsEditingName(true)}
                            className="font-extrabold text-xs text-slate-800 uppercase tracking-wider truncate cursor-pointer hover:bg-white/60 px-1 py-0.5 rounded"
                        >
                            {stage.name}
                        </h3>
                    )}
                </div>

                {/* Contador de Cards + Botões de Adicionar / Excluir */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] font-extrabold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full">
                        {stageTickets.length}
                    </span>

                    <button
                        onClick={() => onAddNextStage(stage.order)}
                        className="w-5 h-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-2xs"
                        title="Criar etapa à direita"
                    >
                        +
                    </button>

                    <button
                        onClick={() => onDeleteStage(stage.id)}
                        className="text-slate-400 hover:text-red-600 text-xs px-1"
                        title="Excluir etapa"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            {/* Lista de Cards Arrastáveis de Contatos */}
            <SortableContext items={stageTickets.map((t: any) => t.id)}>
                <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 min-h-[100px]">
                    {stageTickets.length === 0 ? (
                        <div className="h-20 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-[11px] text-slate-400">
                            Nenhuma conversa
                        </div>
                    ) : (
                        stageTickets.map((t: any) => (
                            <SortableTicketCard
                                key={t.id}
                                ticket={t}
                                onClick={() => onSelectTicket(t.id, "chat")}
                                onSelectTicket={onSelectTicket}
                            />
                        ))

                    )}
                </div>
            </SortableContext>
        </div>
    );
}

export function HrKanbanView({ stages: initialStages, tickets: initialTickets, onSelectTicket, onStagesUpdated }: Props) {
    const [stages, setStages] = useState(initialStages);

    if (JSON.stringify(stages.map(s => s.id)) !== JSON.stringify(initialStages.map(s => s.id))) {
        setStages(initialStages);
    }

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Mover Card de Etapa ao Arrastar e Soltar (Drag & Drop de Cards)
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        // Se estiver arrastando uma Coluna/Etapa
        if (active.data.current?.type === "COLUMN") {
            if (active.id !== over.id) {
                const oldIndex = stages.findIndex((s) => s.id === active.id);
                const newIndex = stages.findIndex((s) => s.id === over.id);

                const reordered = arrayMove(stages, oldIndex, newIndex).map((s, idx) => ({
                    ...s,
                    order: idx,
                }));

                setStages(reordered);
                await saveHrPipelineStages(reordered);
                onStagesUpdated();
            }
            return;
        }

        // Se estiver arrastando um Card de Contato
        const ticketId = active.id as string;
        let targetStageId: string | null = null;

        if (over.data.current?.type === "STAGE") {
            targetStageId = over.id as string;
        } else if (over.data.current?.type === "TICKET") {
            targetStageId = over.data.current.ticket.stageId;
        } else {
            targetStageId = over.id as string;
        }

        if (targetStageId) {
            await updateHrTicketStage(ticketId, targetStageId);
            onStagesUpdated();
        }
    };

    const handleUpdateStage = async (stageId: string, data: { name?: string; color?: string }) => {
        const updated = stages.map(s => s.id === stageId ? { ...s, ...data } : s);
        setStages(updated);
        await saveHrPipelineStages(updated);
        onStagesUpdated();
    };

    const handleDeleteStage = async (stageId: string) => {
        if (stages.length <= 1) {
            alert("O pipeline deve ter pelo menos uma etapa.");
            return;
        }
        if (confirm("Deseja realmente excluir esta etapa?")) {
            await deleteHrPipelineStage(stageId);
            onStagesUpdated();
        }
    };

    const handleAddNextStage = async (afterOrder: number) => {
        const newStage = {
            name: `NOVA ETAPA`,
            color: PRESET_COLORS[(stages.length + 1) % PRESET_COLORS.length],
            order: afterOrder + 0.5,
            isDefault: false
        };

        const tempStages = [...stages, newStage]
            .sort((a, b) => a.order - b.order)
            .map((s, idx) => ({ ...s, order: idx }));

        setStages(tempStages);
        await saveHrPipelineStages(tempStages);
        onStagesUpdated();
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="flex-1 overflow-x-auto p-4 flex gap-3.5 bg-slate-200/50 items-start min-h-[calc(100vh-140px)]">
                <SortableContext items={stages.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
                    {stages.map((stage) => {
                        const stageTickets = initialTickets
                            .filter((t) => t.stageId === stage.id)
                            .sort((a, b) => {
                                if ((b.unreadCount || 0) !== (a.unreadCount || 0)) {
                                    return (b.unreadCount || 0) - (a.unreadCount || 0);
                                }
                                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                            });

                        return (
                            <DroppableKanbanColumn
                                key={stage.id}
                                stage={stage}
                                stageTickets={stageTickets}
                                onSelectTicket={onSelectTicket}
                                onUpdateStage={handleUpdateStage}
                                onDeleteStage={handleDeleteStage}
                                onAddNextStage={handleAddNextStage}
                            />
                        );
                    })}
                </SortableContext>
            </div>
        </DndContext>
    );
}

