"use client";

import {
    ClipboardList, Calendar, MessageSquare, Plus, Trash2,
    GripVertical, UserCheck, Clock, Sparkles, Filter, Search,
    RefreshCw, MoreHorizontal, Check, AlertCircle, Phone
} from "lucide-react";
import { useState, useRef, useMemo } from "react";
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
    "#6366f1", "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981",
    "#ec4899", "#ef4444", "#14b8a6", "#64748b", "#84cc16",
    "#06b6d4", "#d97706", "#4f46e5", "#059669", "#dc2626"
];

// Helper to calculate SLA
function getTicketSla(ticket: any) {
    const updatedAt = new Date(ticket.updatedAt || ticket.createdAt);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60));
    
    if (diffMin < 15) {
        return { label: `${diffMin}m`, color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    }
    if (diffMin < 60) {
        return { label: `${diffMin}m`, color: "bg-amber-50 text-amber-700 border-amber-200" };
    }
    const hours = Math.floor(diffMin / 60);
    return { label: `${hours}h atrás`, color: "bg-rose-50 text-rose-700 border-rose-200 font-bold" };
}

// CARD VISUAL DO KANBAN (Ultra Premium WaSeller)
function TicketCardUI({ ticket, onSelectTicket, isDragging = false }: { ticket: any; onSelectTicket?: (id: string, tab?: any) => void; isDragging?: boolean }) {
    const lastMsg = ticket.messages?.[0];
    const unreadCount = ticket.unreadCount || 0;
    const clickPosRef = useRef({ x: 0, y: 0, time: 0 });
    const sla = getTicketSla(ticket);
    const employee = ticket.employee;

    return (
        <div
            onMouseDown={(e) => {
                clickPosRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
            }}
            onMouseUp={(e) => {
                const dx = Math.abs(e.clientX - clickPosRef.current.x);
                const dy = Math.abs(e.clientY - clickPosRef.current.y);
                const dt = Date.now() - clickPosRef.current.time;
                if (dx < 6 && dy < 6 && dt < 450) {
                    setTimeout(() => onSelectTicket?.(ticket.id, "chat"), 0);
                }
            }}
            className={`bg-white rounded-2xl border transition-all duration-200 group flex flex-col justify-between cursor-pointer p-3.5 select-none relative overflow-hidden ${
                isDragging
                    ? "border-emerald-500 shadow-2xl scale-105 rotate-1 opacity-95 bg-white ring-4 ring-emerald-500/20 z-50"
                    : "border-slate-200/90 hover:border-emerald-500 hover:shadow-lg hover:-translate-y-0.5"
            }`}
        >
            {/* Header: Avatar WhatsApp + Nome + Telefone + SLA Badge */}
            <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                    {ticket.contactPhotoUrl && ticket.contactPhotoUrl !== "null" ? (
                        <img
                            src={ticket.contactPhotoUrl}
                            alt=""
                            className="w-10 h-10 rounded-2xl object-cover border-2 border-slate-100 shadow-2xs"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-700 text-white font-black text-xs flex items-center justify-center border-2 border-slate-100 shadow-2xs">
                            {ticket.contactName?.charAt(0).toUpperCase() || "?"}
                        </div>
                    )}

                    {unreadCount > 0 && (
                        <span className="absolute -bottom-1 -right-1 bg-[#25d366] text-white text-[9px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 border-2 border-white shadow-xs animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </div>

                <div className="overflow-hidden flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-black text-slate-900 truncate leading-tight group-hover:text-emerald-700 transition">
                            {ticket.contactName}
                        </h4>
                        <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 cursor-grab active:cursor-grabbing flex-shrink-0" />
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-mono truncate">
                            {ticket.contactPhone}
                        </span>
                        {employee && (
                            <span className="text-[9px] px-1 rounded bg-slate-100 text-slate-600 font-bold truncate max-w-[90px]">
                                {employee.role?.name || "Colaborador"}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Mensagem Preview */}
            <div className="my-2.5 bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                {lastMsg ? (
                    <span>
                        <strong className="text-slate-700">{lastMsg.senderType === "ATTENDANT" ? "✓ Você: " : ""}</strong>
                        {lastMsg.content}
                    </span>
                ) : (
                    <span className="italic text-slate-400">Atendimento iniciado</span>
                )}
            </div>

            {/* Etiquetas & SLA */}
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <div className="flex items-center gap-1 flex-wrap">
                    {ticket.labels?.map((lbl: any) => (
                        <span
                            key={lbl.id}
                            className="text-[9px] font-black px-1.5 py-0.5 rounded-md text-white shadow-2xs"
                            style={{ backgroundColor: lbl.color }}
                        >
                            {lbl.name}
                        </span>
                    ))}
                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${sla.color} flex items-center gap-1`}>
                        <Clock className="w-2.5 h-2.5" /> {sla.label}
                    </span>
                </div>

                {/* Atendente Badge */}
                <div className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    👤 {ticket.assignee?.name ? ticket.assignee.name.split(" ")[0] : "Fila Geral"}
                </div>
            </div>

            {/* Barra de Ações Rápidas WaSeller */}
            <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-slate-400">
                <div className="flex items-center gap-1">
                    <button
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 transition"
                        title="Abrir Chat WhatsApp"
                        onClick={(e) => { e.stopPropagation(); setTimeout(() => onSelectTicket?.(ticket.id, "chat"), 0); }}
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-500 hover:text-amber-700 transition"
                        title="Anotações Internas"
                        onClick={(e) => { e.stopPropagation(); setTimeout(() => onSelectTicket?.(ticket.id, "notes"), 0); }}
                    >
                        <ClipboardList className="w-3.5 h-3.5" />
                    </button>
                    <button
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-700 transition"
                        title="Agendar Tarefa"
                        onClick={(e) => { e.stopPropagation(); setTimeout(() => onSelectTicket?.(ticket.id, "activities"), 0); }}
                    >
                        <Calendar className="w-3.5 h-3.5" />
                    </button>
                </div>

                <span className="text-[9px] font-mono text-slate-400 font-medium">
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
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing">
            <TicketCardUI ticket={ticket} onSelectTicket={onSelectTicket} isDragging={false} />
        </div>
    );
}

// COLUNA KANBAN
function DroppableKanbanColumn({ stage, stageTickets, onSelectTicket, onUpdateStage, onDeleteStage }: any) {
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
            ref={setSortableRef}
            style={style}
            className="flex-shrink-0 w-80 max-w-[85vw] flex flex-col h-full bg-[#f8fafc] rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden"
        >
            {/* Header da Coluna com Barra Colorida */}
            <div className="p-3.5 bg-white border-b border-slate-200 flex flex-col gap-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600">
                            <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Indicador de Cor */}
                        <div className="relative">
                            <button
                                onClick={() => setShowColorPicker(!showColorPicker)}
                                className="w-3.5 h-3.5 rounded-full ring-2 ring-white shadow-xs flex-shrink-0 transition hover:scale-110"
                                style={{ backgroundColor: stageColor }}
                            />
                            {showColorPicker && (
                                <div className="absolute top-6 left-0 z-50 bg-white p-2.5 rounded-xl shadow-xl border border-slate-200 grid grid-cols-5 gap-1.5 w-44">
                                    {PRESET_COLORS.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => {
                                                setShowColorPicker(false);
                                                onUpdateStage(stage.id, { color: c });
                                            }}
                                            className="w-6 h-6 rounded-full border border-white shadow-2xs hover:scale-110 transition"
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Nome da Etapa */}
                        {isEditingName ? (
                            <Input
                                autoFocus
                                value={nameInput}
                                onChange={e => setNameInput(e.target.value)}
                                onBlur={handleSaveName}
                                onKeyDown={e => e.key === "Enter" && handleSaveName()}
                                className="h-7 text-xs font-black px-2 py-0"
                            />
                        ) : (
                            <h3
                                onDoubleClick={() => setIsEditingName(true)}
                                className="font-black text-slate-800 text-xs truncate cursor-pointer hover:text-emerald-700 transition"
                                title="Clique duplo para renomear"
                            >
                                {stage.name}
                            </h3>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span
                            className="text-[10px] font-black px-2 py-0.5 rounded-full text-white shadow-2xs"
                            style={{ backgroundColor: stageColor }}
                        >
                            {stageTickets.length}
                        </span>

                        {stage.name !== "INBOX" && (
                            <button
                                onClick={() => onDeleteStage(stage.id)}
                                className="p-1 text-slate-300 hover:text-rose-600 rounded transition"
                                title="Excluir Coluna"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Lista de Cards da Coluna (Área Droppable) */}
            <div
                ref={setDroppableRef}
                className={`flex-1 overflow-y-auto p-3 space-y-3 min-h-[150px] transition-colors ${
                    isOver ? "bg-emerald-50/50 ring-2 ring-emerald-500/30 inset-0" : ""
                }`}
            >
                {stageTickets.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-slate-200/80 rounded-2xl flex flex-col items-center justify-center text-slate-400 text-center p-4">
                        <Sparkles className="w-5 h-5 text-slate-300 mb-1" />
                        <span className="text-[11px] font-medium">Nenhum atendimento</span>
                        <span className="text-[9px] text-slate-400">Arraste um card para esta etapa</span>
                    </div>
                ) : (
                    stageTickets.map((t: any) => (
                        <SortableTicketCard key={t.id} ticket={t} onSelectTicket={onSelectTicket} />
                    ))
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

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Filtrar tickets por busca
    const filteredTickets = useMemo(() => {
        if (!search.trim()) return tickets;
        const q = search.toLowerCase();
        return tickets.filter(t =>
            t.contactName?.toLowerCase().includes(q) ||
            t.contactPhone?.includes(q) ||
            t.employee?.name?.toLowerCase().includes(q)
        );
    }, [tickets, search]);

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
        const { active } = event;
        setActiveId(String(active.id));
        setActiveType(active.data.current?.type || null);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveType(null);

        if (!over) return;

        // Arrastando Coluna
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

        // Arrastando Ticket
        if (active.data.current?.type === "TICKET") {
            const ticket = active.data.current.ticket;
            let targetStageId: string | null = null;

            if (over.data.current?.type === "STAGE") {
                targetStageId = over.data.current.stage.id;
            } else if (over.data.current?.type === "TICKET") {
                targetStageId = over.data.current.ticket.stageId;
            }

            if (targetStageId && targetStageId !== ticket.stageId) {
                await updateHrTicketStage(ticket.id, targetStageId);
                toast.success("Atendimento movido para nova etapa!");
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
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f0f2f5]">
            {/* Top Toolbar do Kanban */}
            <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-4 flex-shrink-0 shadow-2xs z-10">
                <div className="flex items-center gap-3 flex-1 max-w-md">
                    <div className="relative w-full">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar no Pipeline (nome, telefone, cargo)..."
                            className="h-9 pl-9 text-xs rounded-xl bg-slate-50 border-slate-200"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSyncChats}
                        disabled={syncing}
                        className="h-9 text-xs font-bold gap-1.5 border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                        {syncing ? "Sincronizando..." : "Sincronizar Celular"}
                    </Button>

                    <Button
                        size="sm"
                        onClick={handleAddStage}
                        className="h-9 text-xs font-bold gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs"
                    >
                        <Plus className="w-4 h-4" /> Nova Etapa
                    </Button>
                </div>
            </div>

            {/* Kanban Columns Board (Horizontal Scroll) */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 flex gap-5 select-none">
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
                                <DroppableKanbanColumn
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
                            <div className="w-80 rotate-2">
                                <TicketCardUI ticket={activeItem} isDragging={true} />
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>
            </div>
        </div>
    );
}
