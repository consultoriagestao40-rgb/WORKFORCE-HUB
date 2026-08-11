"use client";

import { ClipboardList, Calendar, MessageSquare, DollarSign, MoreHorizontal, Search, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { saveHrPipelineStages, deleteHrPipelineStage } from "@/actions/hr-attendance";

interface Props {
    stages: any[];
    tickets: any[];
    onSelectTicket: (ticketId: string) => void;
    onStagesUpdated: () => void;
}

const PRESET_COLORS = [
    "#10b981", "#6366f1", "#f59e0b", "#3b82f6", "#8b5cf6",
    "#ec4899", "#ef4444", "#14b8a6", "#64748b", "#84cc16"
];

// Card do Contato Estilo WaSeller
function WaSellerCard({ ticket, onClick }: { ticket: any; onClick: () => void }) {
    const lastMsg = ticket.messages?.[0];
    const unreadCount = ticket.unreadCount || 0;

    return (
        <div
            onClick={onClick}
            className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-emerald-500 transition cursor-pointer flex flex-col justify-between group"
        >
            {/* Header: Foto + Nome + Badge Verde */}
            <div className="flex items-start gap-2.5 mb-1.5">
                <div className="relative flex-shrink-0">
                    {ticket.contactPhotoUrl ? (
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
                        <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[9px] font-extrabold min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-0.5 border-2 border-white shadow-2xs">
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

            {/* Barra de Ícones Rápidos estilo WaSeller [ 📋 📅 💬 💲 ] */}
            <div className="flex items-center gap-3 pt-2 text-slate-400 text-[10px]">
                <button className="hover:text-emerald-600 transition" title="Anotações">
                    <ClipboardList className="w-3.5 h-3.5" />
                </button>
                <button className="hover:text-emerald-600 transition" title="Agendar Tarefa">
                    <Calendar className="w-3.5 h-3.5" />
                </button>
                <button className="hover:text-emerald-600 transition" title="Abrir Chat">
                    <MessageSquare className="w-3.5 h-3.5" />
                </button>
                <button className="hover:text-emerald-600 transition" title="Valor / Proposta">
                    <DollarSign className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

// Coluna Arrastável do WaSeller
function WaSellerColumn({ stage, stageTickets, onSelectTicket, onUpdateStage, onDeleteStage, onAddNextStage }: any) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: stage.id });

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
            ref={setNodeRef}
            className="w-72 flex-shrink-0 bg-slate-100/90 rounded-2xl p-2.5 flex flex-col max-h-[82vh] border-t-4 shadow-xs"
            style={{ ...style, borderTopColor: stage.color || "#10b981" }}
        >

            {/* Header da Coluna Estilo WaSeller */}
            <div className="flex items-center justify-between mb-2 px-1 pb-1">
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                    {/* Handle Drag */}
                    <button
                        {...attributes}
                        {...listeners}
                        className="cursor-grab text-slate-400 hover:text-slate-700 text-xs"
                    >
                        ⋮⋮
                    </button>

                    {/* Color Picker */}
                    <div className="relative">
                        <button
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className="w-3.5 h-3.5 rounded-full block border border-black/20"
                            style={{ backgroundColor: stage.color || "#10b981" }}
                        />
                        {showColorPicker && (
                            <div className="absolute left-0 top-5 z-50 bg-white p-2 rounded-lg shadow-xl border grid grid-cols-5 gap-1.5 w-36">
                                {PRESET_COLORS.map(c => (
                                    <button
                                        key={c}
                                        className="w-5 h-5 rounded-full border border-black/10"
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

                    {/* Nome da Etapa */}
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

                {/* Counter + Actions */}
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

            {/* Lista de Cards dos Contatos */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                {stageTickets.length === 0 ? (
                    <div className="h-20 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-[11px] text-slate-400">
                        Nenhuma conversa
                    </div>
                ) : (
                    stageTickets.map((t: any) => (
                        <WaSellerCard
                            key={t.id}
                            ticket={t}
                            onClick={() => onSelectTicket(t.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

export function HrKanbanView({ stages: initialStages, tickets, onSelectTicket, onStagesUpdated }: Props) {
    const [stages, setStages] = useState(initialStages);

    if (JSON.stringify(stages.map(s => s.id)) !== JSON.stringify(initialStages.map(s => s.id))) {
        setStages(initialStages);
    }

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
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
                        const stageTickets = tickets.filter((t) => t.stageId === stage.id);

                        return (
                            <WaSellerColumn
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
