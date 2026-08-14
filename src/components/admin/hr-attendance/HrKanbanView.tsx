"use client";

import {
    ClipboardList, Calendar, MessageSquare, Plus, Trash2,
    GripVertical, UserCheck, Clock, Sparkles, Filter, Search,
    RefreshCw, MoreHorizontal, Check, AlertCircle, Phone, ArrowRight
} from "lucide-react";
import React, { useState, useRef, useMemo, memo } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveHrPipelineStages, deleteHrPipelineStage, updateHrTicketStage, syncZapiChats } from "@/actions/hr-attendance";
import { toast } from "sonner";

interface Props {
    stages: any[];
    tickets: any[];
    onSelectTicket: (ticketId: string, initialTab?: "chat" | "notes" | "activities" | "value") => void;
    onStagesUpdated: () => void;
}

const PRESET_COLORS = [
    "#10b981", "#6366f1", "#f59e0b", "#3b82f6", "#8b5cf6",
    "#ec4899", "#ef4444", "#14b8a6", "#64748b", "#06b6d4"
];

function formatTimeAgo(dateInput: any) {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
}

// CARD COMPACTO, ULTRA-MODERNO E SEDUTOR (Linear/WaSeller Standard)
const TicketCardUI = memo(function TicketCardUI({
    ticket,
    onSelectTicket,
    isDragging = false
}: {
    ticket: any;
    onSelectTicket?: (id: string, tab?: any) => void;
    isDragging?: boolean;
}) {
    const lastMsg = ticket.messages?.[0];
    const unreadCount = ticket.unreadCount || 0;
    const clickPosRef = useRef({ x: 0, y: 0, time: 0 });
    const timeAgo = formatTimeAgo(ticket.updatedAt || ticket.createdAt);
    const employee = ticket.employee;
    const isGroup = ticket.contactPhone?.includes("-group") || ticket.contactName?.toLowerCase().includes("grupo");

    return (
        <div
            onMouseDown={(e) => {
                clickPosRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
            }}
            onMouseUp={(e) => {
                const dx = Math.abs(e.clientX - clickPosRef.current.x);
                const dy = Math.abs(e.clientY - clickPosRef.current.y);
                const dt = Date.now() - clickPosRef.current.time;
                if (dx < 6 && dy < 6 && dt < 400) {
                    onSelectTicket?.(ticket.id, "chat");
                }
            }}
            className={`bg-white rounded-xl border transition-all duration-150 group flex flex-col justify-between cursor-pointer p-3 select-none relative overflow-hidden ${
                isDragging
                    ? "border-emerald-500 shadow-2xl scale-105 rotate-1 bg-white ring-2 ring-emerald-500/20 z-50"
                    : "border-slate-200/80 hover:border-emerald-500 hover:shadow-md hover:-translate-y-0.5"
            }`}
        >
            {/* Header: Foto + Nome + Telefone + Badge */}
            <div className="flex items-start gap-2.5">
                <div className="relative flex-shrink-0">
                    {ticket.contactPhotoUrl && ticket.contactPhotoUrl !== "null" ? (
                        <img
                            src={ticket.contactPhotoUrl}
                            alt=""
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200/80 shadow-2xs"
                        />
                    ) : isGroup ? (
                        <div className="w-9 h-9 rounded-xl bg-amber-500 text-white font-bold text-sm flex items-center justify-center shadow-2xs">
                            👥
                        </div>
                    ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-900 to-slate-700 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                            {ticket.contactName?.charAt(0).toUpperCase() || "?"}
                        </div>
                    )}

                    {unreadCount > 0 && (
                        <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[9px] font-black min-w-[17px] h-[17px] rounded-full flex items-center justify-center px-1 border-2 border-white shadow-xs animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </div>

                <div className="overflow-hidden flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-900 truncate leading-tight group-hover:text-emerald-600 transition">
                            {ticket.contactName}
                        </h4>
                        <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
                            {timeAgo}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-mono truncate">
                            {ticket.contactPhone}
                        </span>
                        {employee && (
                            <span className="text-[9px] px-1 rounded bg-slate-100 text-slate-600 font-bold truncate max-w-[85px]">
                                {employee.role?.name || "CLT"}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Preview da Mensagem (1 linha limpa) */}
            <div className="mt-2 text-[11px] text-slate-600 truncate leading-snug">
                {lastMsg ? (
                    <span>
                        <span className="text-slate-400 font-medium">{lastMsg.senderType === "ATTENDANT" ? "Você: " : ""}</span>
                        {lastMsg.content}
                    </span>
                ) : (
                    <span className="italic text-slate-400">Atendimento iniciado</span>
                )}
            </div>

            {/* Rodapé: Tags + Atendente + Ações Rápidas */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-slate-400">
                <div className="flex items-center gap-1 overflow-hidden max-w-[160px]">
                    <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded truncate">
                        👤 {ticket.assignee?.name ? ticket.assignee.name.split(" ")[0] : "Fila"}
                    </span>
                    {ticket.labels?.slice(0, 1).map((lbl: any) => (
                        <span
                            key={lbl.id}
                            className="text-[9px] font-bold px-1.5 py-0.2 rounded text-white shadow-2xs truncate"
                            style={{ backgroundColor: lbl.color }}
                        >
                            {lbl.name}
                        </span>
                    ))}
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                    <button
                        className="p-1 rounded hover:bg-emerald-50 hover:text-emerald-600 transition"
                        title="Abrir Chat"
                        onClick={(e) => { e.stopPropagation(); onSelectTicket?.(ticket.id, "chat"); }}
                    >
                        <MessageSquare className="w-3 h-3" />
                    </button>
                    <button
                        className="p-1 rounded hover:bg-amber-50 hover:text-amber-600 transition"
                        title="Anotações"
                        onClick={(e) => { e.stopPropagation(); onSelectTicket?.(ticket.id, "notes"); }}
                    >
                        <ClipboardList className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
    );
});

// ITEM SORTABLE
function SortableTicketCard({ ticket, onSelectTicket }: { ticket: any; onSelectTicket: (id: string, tab?: any) => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: ticket.id,
        data: { type: "TICKET", ticket }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing">
            <TicketCardUI ticket={ticket} onSelectTicket={onSelectTicket} isDragging={false} />
        </div>
    );
}

// COLUNA KANBAN MODERNA
function KanbanColumn({ stage, stageTickets, onSelectTicket, onUpdateStage, onDeleteStage }: any) {
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

    const stageColor = stage.color || "#10b981";

    // Slice to max 50 visible tickets per column for instantaneous 60fps rendering
    const visibleTickets = stageTickets.slice(0, 50);

    return (
        <div
            ref={setSortableRef}
            style={style}
            className="flex-shrink-0 w-72 flex flex-col h-full bg-slate-100/70 rounded-2xl border border-slate-200/70 overflow-hidden"
        >
            {/* Header da Coluna */}
            <div className="p-3 bg-white border-b border-slate-200/80 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600">
                        <GripVertical className="w-3.5 h-3.5" />
                    </div>

                    <div className="relative flex-shrink-0">
                        <button
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-2xs hover:scale-125 transition"
                            style={{ backgroundColor: stageColor }}
                        />
                        {showColorPicker && (
                            <div className="absolute top-6 left-0 z-50 bg-white p-2 rounded-xl shadow-xl border border-slate-200 grid grid-cols-5 gap-1.5 w-40">
                                {PRESET_COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => {
                                            setShowColorPicker(false);
                                            onUpdateStage(stage.id, { color: c });
                                        }}
                                        className="w-5 h-5 rounded-full border border-white shadow-2xs hover:scale-110 transition"
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {isEditingName ? (
                        <Input
                            autoFocus
                            value={nameInput}
                            onChange={e => setNameInput(e.target.value)}
                            onBlur={handleSaveName}
                            onKeyDown={e => e.key === "Enter" && handleSaveName()}
                            className="h-6 text-xs font-bold px-1.5 py-0"
                        />
                    ) : (
                        <h3
                            onDoubleClick={() => setIsEditingName(true)}
                            className="font-bold text-slate-800 text-xs truncate cursor-pointer hover:text-emerald-600 transition"
                            title="Clique duplo para renomear"
                        >
                            {stage.name}
                        </h3>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {stageTickets.length}
                    </span>

                    {stage.name !== "INBOX" && (
                        <button
                            onClick={() => onDeleteStage(stage.id)}
                            className="p-1 text-slate-300 hover:text-rose-600 rounded transition"
                            title="Excluir Coluna"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Área Droppable com os Cards */}
            <div
                ref={setDroppableRef}
                className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[150px] transition-colors ${
                    isOver ? "bg-emerald-50/60 ring-2 ring-emerald-500/20" : ""
                }`}
            >
                {visibleTickets.length === 0 ? (
                    <div className="h-28 border-2 border-dashed border-slate-200/80 rounded-xl flex flex-col items-center justify-center text-slate-400 text-center p-3">
                        <span className="text-xs font-medium text-slate-400">Vazio</span>
                    </div>
                ) : (
                    visibleTickets.map((t: any) => (
                        <SortableTicketCard key={t.id} ticket={t} onSelectTicket={onSelectTicket} />
                    ))
                )}

                {stageTickets.length > 50 && (
                    <div className="text-center py-2 text-[10px] text-slate-400 font-bold">
                        + {stageTickets.length - 50} atendimentos nesta etapa
                    </div>
                )}
            </div>
        </div>
    );
}

export function HrKanbanView({ stages, tickets, onSelectTicket, onStagesUpdated }: Props) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<"TICKET" | "COLUMN" | null>(null);
    const [search, setSearch] = useState("");
    const [syncing, setSyncing] = useState(false);

    const [localTickets, setLocalTickets] = useState(tickets);
    const justDraggedRef = useRef(false);

    // Sincronizar tickets locais quando a prop mudar
    React.useEffect(() => {
        setLocalTickets(tickets);
    }, [tickets]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const filteredTickets = useMemo(() => {
        if (!search.trim()) return localTickets;
        const q = search.toLowerCase();
        return localTickets.filter(t =>
            t.contactName?.toLowerCase().includes(q) ||
            t.contactPhone?.includes(q) ||
            t.employee?.name?.toLowerCase().includes(q)
        );
    }, [localTickets, search]);

    const handleSyncChats = async () => {
        setSyncing(true);
        try {
            const res = await syncZapiChats();
            if (res.success) {
                toast.success(`Sincronização concluída! ${res.count} conversas atualizadas.`);
                onStagesUpdated();
            } else {
                toast.error(res.error || "Erro na sincronização");
            }
        } catch (e: any) {
            toast.error(e.message || "Falha na sincronização");
        } finally {
            setSyncing(false);
        }
    };

    const handleAddStage = async () => {
        const name = prompt("Nome da nova etapa do pipeline:");
        if (!name?.trim()) return;

        const maxOrder = stages.reduce((acc, s) => Math.max(acc, s.order || 0), 0);
        await saveHrPipelineStages([
            ...stages,
            { name: name.trim(), color: PRESET_COLORS[stages.length % PRESET_COLORS.length], order: maxOrder + 1 }
        ]);
        toast.success("Nova etapa adicionada!");
        onStagesUpdated();
    };

    const handleUpdateStage = async (stageId: string, data: { name?: string; color?: string }) => {
        const updated = stages.map(s => s.id === stageId ? { ...s, ...data } : s);
        await saveHrPipelineStages(updated);
        onStagesUpdated();
    };

    const handleDeleteStage = async (stageId: string) => {
        if (!confirm("Tem certeza que deseja excluir esta etapa do pipeline?")) return;
        await deleteHrPipelineStage(stageId);
        toast.success("Etapa removida");
        onStagesUpdated();
    };

    const handleDragStart = (event: DragStartEvent) => {
        justDraggedRef.current = true;
        const { active } = event;
        setActiveId(String(active.id));
        setActiveType(active.data.current?.type || null);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveType(null);

        // Manter flag para suprimir cliques imediatos no card após drag
        setTimeout(() => {
            justDraggedRef.current = false;
        }, 400);

        if (!over) return;

        if (active.data.current?.type === "COLUMN" && over.data.current?.type === "COLUMN") {
            if (active.id !== over.id) {
                const oldIndex = stages.findIndex(s => s.id === active.id);
                const newIndex = stages.findIndex(s => s.id === over.id);
                const newStages = arrayMove(stages, oldIndex, newIndex).map((s, idx) => ({ ...s, order: idx }));
                await saveHrPipelineStages(newStages);
                onStagesUpdated();
            }
            return;
        }

        if (active.data.current?.type === "TICKET") {
            const ticket = active.data.current.ticket;
            let targetStageId: string | null = null;

            if (over.data.current?.type === "STAGE" || over.data.current?.type === "COLUMN") {
                targetStageId = over.data.current.stage.id;
            } else if (over.data.current?.type === "TICKET") {
                targetStageId = over.data.current.ticket.stageId;
            } else {
                const foundStage = stages.find(s => s.id === over.id);
                if (foundStage) {
                    targetStageId = foundStage.id;
                } else {
                    const foundTicket = localTickets.find(t => t.id === over.id);
                    if (foundTicket) {
                        targetStageId = foundTicket.stageId;
                    }
                }
            }

            if (targetStageId && targetStageId !== ticket.stageId) {
                // Atualização Otimista Instantânea na tela
                setLocalTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, stageId: targetStageId } : t));
                
                try {
                    const res = await updateHrTicketStage(ticket.id, targetStageId);
                    if (res?.success) {
                        toast.success("Atendimento movido!");
                    } else {
                        // Reverter em caso de erro
                        setLocalTickets(tickets);
                    }
                } catch {
                    setLocalTickets(tickets);
                }
                onStagesUpdated();
            }
        }
    };

    const activeItem = useMemo(() => {
        if (!activeId) return null;
        if (activeType === "TICKET") {
            return tickets.find(t => t.id === activeId);
        }
        if (activeType === "COLUMN") {
            return stages.find(s => s.id === activeId);
        }
        return null;
    }, [activeId, activeType, tickets, stages]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Top Toolbar Minimalista */}
            <div className="bg-white border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between gap-4 flex-shrink-0 z-10">
                <div className="flex items-center gap-3 flex-1 max-w-sm">
                    <div className="relative w-full">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar no Pipeline..."
                            className="h-8 pl-8 text-xs rounded-xl bg-slate-50 border-slate-200"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSyncChats}
                        disabled={syncing}
                        className="h-8 text-xs font-bold gap-1.5 border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                        {syncing ? "Sincronizando..." : "Sincronizar Celular"}
                    </Button>

                    <Button
                        size="sm"
                        onClick={handleAddStage}
                        className="h-8 text-xs font-bold gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl"
                    >
                        <Plus className="w-3.5 h-3.5" /> Nova Etapa
                    </Button>
                </div>
            </div>

            {/* Kanban Columns (Horizontal Scroll Suave) */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 flex gap-4 select-none">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={stages.map(s => s.id)} strategy={horizontalListSortingStrategy}>
                        {stages.map((stage) => {
                            const stageTickets = filteredTickets.filter(t => t.stageId === stage.id);
                            return (
                                <KanbanColumn
                                    key={stage.id}
                                    stage={stage}
                                    stageTickets={stageTickets}
                                    onSelectTicket={onSelectTicket}
                                    onUpdateStage={handleUpdateStage}
                                    onDeleteStage={handleDeleteStage}
                                />
                            );
                        })}
                    </SortableContext>

                    <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }) }}>
                        {activeType === "TICKET" && activeItem && (
                            <div className="w-72 rotate-1">
                                <TicketCardUI ticket={activeItem} isDragging={true} />
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>
            </div>
        </div>
    );
}
