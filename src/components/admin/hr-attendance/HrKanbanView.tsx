"use client";

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

import { HrTicketCard } from "./HrTicketCard";
import { saveHrPipelineStages, deleteHrPipelineStage } from "@/actions/hr-attendance";

interface Props {
    stages: any[];
    tickets: any[];
    onSelectTicket: (ticketId: string) => void;
    onStagesUpdated: () => void;
}

const PRESET_COLORS = [
    "#6366f1", "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981",
    "#ec4899", "#ef4444", "#14b8a6", "#64748b", "#84cc16"
];

// Componente de Coluna Arrastável
function SortableColumn({ stage, stageTickets, onSelectTicket, onUpdateStage, onDeleteStage, onAddNextStage }: any) {
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
            style={style}
            className="w-72 flex-shrink-0 bg-slate-200/70 rounded-xl p-3 flex flex-col max-h-[82vh] relative group/col border border-slate-300/60 shadow-sm"
        >
            {/* Header da Coluna */}
            <div className="flex items-center justify-between mb-3 px-1">
                {/* Drag Handle + Cor + Nome da Etapa */}
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                    {/* Botão de Arrastar a Coluna */}
                    <button
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 p-0.5 text-xs select-none"
                        title="Segure e arraste para reordenar a coluna"
                    >
                        ⋮⋮
                    </button>

                    {/* Cor da Coluna (Clicável para trocar) */}
                    <div className="relative">
                        <button
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className="w-3.5 h-3.5 rounded-full shadow-sm border border-black/20 block hover:scale-125 transition cursor-pointer"
                            style={{ backgroundColor: stage.color }}
                            title="Clique para alterar a cor da etapa"
                        />
                        {showColorPicker && (
                            <div className="absolute left-0 top-5 z-50 bg-white p-2 rounded-lg shadow-xl border grid grid-cols-5 gap-1.5 w-36">
                                {PRESET_COLORS.map(c => (
                                    <button
                                        key={c}
                                        className="w-5 h-5 rounded-full border border-black/10 hover:scale-110"
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

                    {/* Nome da Etapa (Editável ao clicar) */}
                    {isEditingName ? (
                        <input
                            autoFocus
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            onBlur={handleSaveName}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveName();
                            }}
                            className="text-xs font-bold text-slate-800 uppercase bg-white border rounded px-1.5 py-0.5 h-6 w-full"
                        />
                    ) : (
                        <h3
                            onClick={() => setIsEditingName(true)}
                            className="font-bold text-xs text-slate-800 uppercase tracking-wider truncate cursor-pointer hover:bg-white/60 px-1 py-0.5 rounded transition"
                            title="Clique para editar o nome da etapa"
                        >
                            {stage.name}
                        </h3>
                    )}
                </div>

                {/* Badge Quantidade + Ações (+ Nova Coluna à direita / Lixeira) */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] font-bold bg-white text-slate-600 px-2 py-0.5 rounded-full border shadow-sm">
                        {stageTickets.length}
                    </span>

                    {/* Botão + para criar nova coluna à direita */}
                    <button
                        onClick={() => onAddNextStage(stage.order)}
                        className="w-5 h-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm transition hover:scale-110"
                        title="Adicionar nova etapa à direita desta"
                    >
                        +
                    </button>

                    {/* Excluir Coluna */}
                    <button
                        onClick={() => onDeleteStage(stage.id)}
                        className="text-slate-400 hover:text-red-600 text-xs px-1 opacity-0 group-hover/col:opacity-100 transition"
                        title="Excluir esta etapa"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            {/* Lista de Tickets */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
                {stageTickets.length === 0 ? (
                    <div className="h-24 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[11px] text-slate-400 select-none">
                        Nenhum atendimento
                    </div>
                ) : (
                    stageTickets.map((ticket: any) => (
                        <HrTicketCard
                            key={ticket.id}
                            ticket={ticket}
                            onClick={() => onSelectTicket(ticket.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

export function HrKanbanView({ stages: initialStages, tickets, onSelectTicket, onStagesUpdated }: Props) {
    const [stages, setStages] = useState(initialStages);

    // Sincronizar etapas props com state local
    if (JSON.stringify(stages.map(s => s.id)) !== JSON.stringify(initialStages.map(s => s.id))) {
        setStages(initialStages);
    }

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Drag & Drop de Colunas
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

    // Atualizar etapa (Nome ou Cor)
    const handleUpdateStage = async (stageId: string, data: { name?: string; color?: string }) => {
        const updated = stages.map(s => s.id === stageId ? { ...s, ...data } : s);
        setStages(updated);
        await saveHrPipelineStages(updated);
        onStagesUpdated();
    };

    // Excluir etapa
    const handleDeleteStage = async (stageId: string) => {
        if (stages.length <= 1) {
            alert("O pipeline deve ter pelo menos uma etapa.");
            return;
        }
        if (confirm("Deseja realmente excluir esta etapa? Os atendimentos nela serão movidos para a primeira etapa.")) {
            await deleteHrPipelineStage(stageId);
            onStagesUpdated();
        }
    };

    // Adicionar nova etapa à direita de uma específica
    const handleAddNextStage = async (afterOrder: number) => {
        const newStage = {
            name: `Nova Etapa`,
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
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <div className="flex-1 overflow-x-auto p-4 flex gap-4 bg-slate-100/70 items-start min-h-[calc(100vh-160px)]">
                <SortableContext
                    items={stages.map((s) => s.id)}
                    strategy={horizontalListSortingStrategy}
                >
                    {stages.map((stage) => {
                        const stageTickets = tickets.filter((t) => t.stageId === stage.id);

                        return (
                            <SortableColumn
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

