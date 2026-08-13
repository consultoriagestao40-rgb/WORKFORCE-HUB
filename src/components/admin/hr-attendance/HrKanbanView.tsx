"use client";

import { ClipboardList, Calendar, MessageSquare, DollarSign, Plus, Trash2, GripVertical } from "lucide-react";
import { useState } from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    useDroppable,
    DragOverlay,
    defaultDropAnimationSideEffects,
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

// CARD VISUAL DO KANBAN (Usado tanto na lista quanto no DragOverlay para animação fluida)
function TicketCardUI({ ticket, onSelectTicket, isDragging = false }: { ticket: any; onSelectTicket?: (id: string, tab?: any) => void; isDragging?: boolean }) {
    const lastMsg = ticket.messages?.[0];
    const unreadCount = ticket.unreadCount || 0;

    return (
        <div
            onClick={() => setTimeout(() => onSelectTicket?.(ticket.id, "chat"), 0)}
            className={`bg-white p-3.5 rounded-2xl border transition-all duration-200 shadow-2xs group flex flex-col justify-between cursor-pointer ${
                isDragging
                    ? "border-emerald-500 shadow-2xl scale-105 rotate-1 opacity-95 bg-white ring-2 ring-emerald-500/20"
                    : "border-slate-200/80 hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5"
            }`}
        >
            {/* Header do Card: Avatar + Nome + Telefone + Badge Verde de Não Lidas */}
            <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                    {ticket.contactPhotoUrl && ticket.contactPhotoUrl !== "null" ? (
                        <img
                            src={ticket.contactPhotoUrl}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover border-2 border-slate-100 shadow-2xs"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center border-2 border-slate-100 shadow-2xs">
                            {ticket.contactName?.charAt(0).toUpperCase() || "?"}
                        </div>
                    )}

                    {unreadCount > 0 && (
                        <span className="absolute -bottom-1 -right-1 bg-[#25d366] text-white text-[9px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 border-2 border-white shadow-xs">
                            {unreadCount}
                        </span>
                    )}
                </div>

                <div className="overflow-hidden flex-1">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-slate-800 truncate leading-tight group-hover:text-emerald-700 transition">
                            {ticket.contactName}
                        </h4>
                        <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 cursor-grab active:cursor-grabbing flex-shrink-0 ml-1" />
                    </div>

                    <span className="text-[10px] text-slate-400 font-mono block truncate mt-0.5">
                        {ticket.contactPhone}
                    </span>

                    <p className="text-[11px] text-slate-600 truncate leading-snug mt-1 font-normal">
                        {lastMsg ? (
                            <span>{lastMsg.senderType === "ATTENDANT" ? "✓ " : ""}{lastMsg.content}</span>
                        ) : (
                            <span className="italic text-slate-400">Atendimento iniciado</span>
                        )}
                    </p>
                </div>
            </div>

            {/* Barra de Ícones Rápidos com Fundos Suaves [ 📋 📅 💬 💲 ] */}
            <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                    <button
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
                        title="Anotações Internas"
                        onClick={(e) => { e.stopPropagation(); setTimeout(() => onSelectTicket?.(ticket.id, "notes"), 0); }}
                    >
                        <ClipboardList className="w-3.5 h-3.5" />
                    </button>

                    <button
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-500 hover:text-amber-700 flex items-center justify-center transition"
                        title="Agendar Lembrete / Atividade"
                        onClick={(e) => { e.stopPropagation(); setTimeout(() => onSelectTicket?.(ticket.id, "activities"), 0); }}
                    >
                        <Calendar className="w-3.5 h-3.5" />
                    </button>

                    <button
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 flex items-center justify-center transition"
                        title="Abrir Chat do WhatsApp"
                        onClick={(e) => { e.stopPropagation(); setTimeout(() => onSelectTicket?.(ticket.id, "chat"), 0); }}
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                </div>

                <span className="text-[9px] font-mono text-slate-400">
                    {new Date(ticket.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    );
}

// ITEM SORTABLE INDIVIDUAL
function SortableTicketCard({ ticket, onSelectTicket }: { ticket: any; onSelectTicket: (id: string, tab?: any) => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: ticket.id,
        data: { type: "TICKET", ticket }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1, // Mantém sombra sutil no local original
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing">
            <TicketCardUI ticket={ticket} onSelectTicket={onSelectTicket} isDragging={false} />
        </div>
    );
}

// COLUNA KANBAN
function DroppableKanbanColumn({ stage, stageTickets, onSelectTicket, onUpdateStage, onDeleteStage, onAddNextStage }: any) {
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: stage.id,
        data: { type: "STAGE", stage }
    });

    const { attributes, listeners, setNodeRef: setSortableRef, transform, transition, isDragging } = useSortable({
        id: stage.id,
        data: { type: "COLUMN", stage }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
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

    const stageColor = stage.color || "#6366f1";

    return (
        <div
            ref={(node) => {
                setSortableRef(node);
                setDroppableRef(node);
            }}
            style={{ ...style, borderTopColor: stageColor }}
            className={`w-80 flex-shrink-0 bg-slate-100/90 rounded-2xl p-3 flex flex-col max-h-[84vh] border-t-4 shadow-2xs transition-all duration-200 ${
                isOver ? "bg-emerald-50/90 ring-2 ring-emerald-500/30 scale-[1.01]" : ""
            }`}
        >
            {/* Header da Coluna */}
            <div className="flex items-center justify-between mb-3 px-1 pb-1 border-b border-slate-200/60">
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <button {...attributes} {...listeners} className="cursor-grab text-slate-400 hover:text-slate-700 text-xs" title="Reordenar Coluna">
                        ⋮⋮
                    </button>

                    {/* Color Picker Clicável */}
                    <div className="relative">
                        <button
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className="w-4 h-4 rounded-full block border border-black/20 hover:scale-110 transition shadow-2xs cursor-pointer"
                            style={{ backgroundColor: stageColor }}
                            title="Clique para alterar a cor da etapa"
                        />
                        {showColorPicker && (
                            <div className="absolute left-0 top-6 z-50 bg-white p-2.5 rounded-2xl shadow-2xl border grid grid-cols-5 gap-1.5 w-44">
                                {PRESET_COLORS.map(c => (
                                    <button
                                        key={c}
                                        className="w-6 h-6 rounded-full border border-black/10 hover:scale-110 transition cursor-pointer"
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

                    {isEditingName ? (
                        <input
                            autoFocus
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            onBlur={handleSaveName}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); }}
                            className="text-xs font-extrabold text-slate-800 uppercase bg-white border rounded-lg px-2 py-0.5 h-7 w-full"
                        />
                    ) : (
                        <h3
                            onClick={() => setIsEditingName(true)}
                            className="font-black text-xs text-slate-800 uppercase tracking-wider truncate cursor-pointer hover:bg-white/80 px-1.5 py-0.5 rounded-md transition"
                        >
                            {stage.name}
                        </h3>
                    )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] font-black text-slate-600 bg-white px-2.5 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                        {stageTickets.length}
                    </span>

                    <button
                        onClick={() => onAddNextStage(stage.order)}
                        className="w-6 h-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center justify-center text-xs font-black shadow-2xs transition"
                        title="Adicionar etapa à direita"
                    >
                        +
                    </button>

                    <button
                        onClick={() => onDeleteStage(stage.id)}
                        className="text-slate-400 hover:text-red-600 text-xs px-1 transition"
                        title="Excluir etapa"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Lista de Cards com Sortable */}
            <SortableContext items={stageTickets.map((t: any) => t.id)}>
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 min-h-[120px]">
                    {stageTickets.length === 0 ? (
                        <div className="h-28 border-2 border-dashed border-slate-200/90 rounded-2xl flex flex-col items-center justify-center text-[11px] text-slate-400 gap-1 bg-white/40">
                            <span>Nenhuma conversa aqui</span>
                            <span className="text-[9px] text-slate-300">Arraste um card para cá</span>
                        </div>
                    ) : (
                        stageTickets.map((t: any) => (
                            <SortableTicketCard
                                key={t.id}
                                ticket={t}
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
    const [activeTicket, setActiveTicket] = useState<any | null>(null);

    if (JSON.stringify(stages.map(s => s.id)) !== JSON.stringify(initialStages.map(s => s.id))) {
        setStages(initialStages);
    }

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        if (active.data.current?.type === "TICKET") {
            setActiveTicket(active.data.current.ticket);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveTicket(null);

        if (!over) return;

        // Se reordenar colunas
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

        // Mover Card entre Colunas
        const ticketId = active.id as string;
        let targetStageId: string | null = null;

        if (over.data.current?.type === "STAGE") {
            targetStageId = over.id as string;
        } else if (over.data.current?.type === "TICKET") {
            targetStageId = over.data.current.ticket.stageId;
        } else {
            targetStageId = over.id as string;
        }

        if (targetStageId && targetStageId !== active.data.current?.ticket?.stageId) {
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

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: { opacity: "0.4" },
            },
        }),
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex-1 overflow-x-auto p-5 flex gap-4 bg-slate-200/60 items-start min-h-[calc(100vh-130px)]">
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

            {/* DRAG OVERLAY NATIVO SUAVE DE ARRASTE (O card nunca mais some!) */}
            <DragOverlay dropAnimation={dropAnimation}>
                {activeTicket ? (
                    <div className="w-80 pointer-events-none">
                        <TicketCardUI ticket={activeTicket} isDragging={true} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
