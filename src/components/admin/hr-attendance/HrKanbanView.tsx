"use client";

import { HrTicketCard } from "./HrTicketCard";

interface Props {
    stages: any[];
    tickets: any[];
    onSelectTicket: (ticketId: string) => void;
    onOpenPipelineEditor: () => void;
}

export function HrKanbanView({ stages, tickets, onSelectTicket, onOpenPipelineEditor }: Props) {
    return (
        <div className="flex-1 overflow-x-auto p-4 flex gap-4 bg-slate-100/70 items-start min-h-[calc(100vh-160px)]">
            {stages.map((stage) => {
                const stageTickets = tickets.filter(t => t.stageId === stage.id);

                return (
                    <div
                        key={stage.id}
                        className="w-72 flex-shrink-0 bg-slate-200/60 rounded-xl p-3 flex flex-col max-h-[82vh]"
                    >
                        {/* Header da Coluna */}
                        <div className="flex items-center justify-between mb-3 px-1">
                            <div className="flex items-center gap-2">
                                <span
                                    className="w-3 h-3 rounded-full shadow-sm"
                                    style={{ backgroundColor: stage.color }}
                                />
                                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">{stage.name}</h3>
                            </div>
                            <span className="text-[10px] font-bold bg-white text-slate-600 px-2 py-0.5 rounded-full border shadow-sm">
                                {stageTickets.length}
                            </span>
                        </div>

                        {/* Cards List */}
                        <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
                            {stageTickets.length === 0 ? (
                                <div className="h-24 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[11px] text-slate-400">
                                    Nenhum atendimento
                                </div>
                            ) : (
                                stageTickets.map((ticket) => (
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
            })}

            {/* Botão de Adicionar/Editar Etapas */}
            <button
                onClick={onOpenPipelineEditor}
                className="w-64 flex-shrink-0 h-14 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl flex items-center justify-center text-xs font-semibold text-slate-500 hover:text-indigo-600 bg-white/50 hover:bg-white transition gap-2 shadow-sm"
            >
                <span>⚙️</span> Personalizar Etapas
            </button>
        </div>
    );
}
