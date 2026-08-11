"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw, Lock, MessageSquare, Plus } from "lucide-react";
import {
    getHrPipelineStages,
    getHrTickets,
    getHrLabels,
    seedDefaultPipeline,
    syncZapiChats,
    saveHrPipelineStages
} from "@/actions/hr-attendance";
import { HrKanbanView } from "./HrKanbanView";
import { HrLabelView } from "./HrLabelView";
import { HrHistoryView } from "./HrHistoryView";
import { HrTicketModal } from "./HrTicketModal";
import { HrAccessManager } from "./HrAccessManager";

interface Props {
    currentUser: any;
    allUsers: any[];
}

export function HrAttendanceClientPage({ currentUser, allUsers }: Props) {
    const [viewMode, setViewMode] = useState<"kanban" | "labels" | "history">("kanban");
    const [stages, setStages] = useState<any[]>([]);
    const [tickets, setTickets] = useState<any[]>([]);
    const [labels, setLabels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const [showAccessManager, setShowAccessManager] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            await seedDefaultPipeline();
            const [stgs, tcks, lbls] = await Promise.all([
                getHrPipelineStages(),
                getHrTickets({ search: searchQuery }),
                getHrLabels()
            ]);

            setStages(stgs);
            setTickets(tcks);
            setLabels(lbls);
        } finally {
            setLoading(false);
        }
    }, [searchQuery]);

    // Polling automático no piloto automático
    useEffect(() => {
        loadData();
        const interval = setInterval(async () => {
            await syncZapiChats();
            const tcks = await getHrTickets({ search: searchQuery });
            setTickets(tcks);
        }, 3000);
        return () => clearInterval(interval);
    }, [loadData, searchQuery]);

    const handleAddStage = async () => {
        const name = prompt("Nome da nova etapa do pipeline:");
        if (!name?.trim()) return;
        const newStages = [
            ...stages,
            { name: name.trim(), color: "#10b981", order: stages.length, isDefault: false }
        ];
        await saveHrPipelineStages(newStages);
        loadData();
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-100 font-sans">
            {/* TOP BAR: Pílulas de Etapas / Filtros estilo WaSeller */}
            <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between shadow-2xs z-10 gap-4 overflow-hidden">
                {/* Ícone WaSeller + Pílulas de Etapas */}
                <div className="flex items-center gap-3 overflow-x-auto min-w-0 flex-1 py-1 no-scrollbar">
                    <div className="flex items-center gap-2 flex-shrink-0 mr-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                            W
                        </div>
                        <div>
                            <h1 className="font-black text-sm text-slate-800 leading-none">WaAtendimento</h1>
                            <span className="text-[10px] text-emerald-600 font-bold">WhatsApp RH CRM</span>
                        </div>
                    </div>

                    {/* Abas Pílula Estilo WaSeller (INBOX 836, LEAD DE SERVIÇOS 1, TRATAR 6...) */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pr-2 no-scrollbar">
                        {stages.map((stg) => {
                            const count = tickets.filter(t => t.stageId === stg.id).length;
                            return (
                                <div
                                    key={stg.id}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200/90 flex-shrink-0 shadow-2xs whitespace-nowrap"
                                >
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stg.color || "#10b981" }} />
                                    <span>{stg.name}</span>
                                    <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                                        {count}
                                    </span>
                                </div>
                            );
                        })}

                        <button
                            onClick={handleAddStage}
                            className="w-6 h-6 rounded-full bg-slate-100 hover:bg-emerald-100 text-emerald-700 border border-slate-200 flex items-center justify-center text-xs font-bold flex-shrink-0"
                            title="Adicionar Etapa ao Pipeline"
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Modos de Visão & Acessos */}
                <div className="flex items-center gap-2.5 flex-shrink-0">
                    <Input
                        placeholder="Buscar funcionario ou mensagem..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="text-xs h-8 w-56 bg-slate-50 border-slate-200"
                    />

                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex-shrink-0">
                        <button
                            onClick={() => setViewMode("kanban")}
                            className={`px-3 py-1 text-xs font-extrabold rounded-md transition ${viewMode === "kanban" ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                        >
                            Kanban
                        </button>
                        <button
                            onClick={() => setViewMode("labels")}
                            className={`px-3 py-1 text-xs font-extrabold rounded-md transition ${viewMode === "labels" ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                        >
                            Etiquetas
                        </button>
                        <button
                            onClick={() => setViewMode("history")}
                            className={`px-3 py-1 text-xs font-extrabold rounded-md transition ${viewMode === "history" ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                        >
                            Histórico
                        </button>
                    </div>

                    {currentUser?.role === "ADMIN" && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1 border-slate-300 text-slate-700 flex-shrink-0 font-bold"
                            onClick={() => setShowAccessManager(true)}
                        >
                            <Lock className="w-3.5 h-3.5" /> Acessos
                        </Button>
                    )}
                </div>
            </div>

            {/* CONTEÚDO PRINCIPAL: PIPELINE KANBAN WASELLER */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                    Carregando Pipeline WaSeller...
                </div>
            ) : viewMode === "kanban" ? (
                <HrKanbanView
                    stages={stages}
                    tickets={tickets}
                    onSelectTicket={setSelectedTicketId}
                    onStagesUpdated={loadData}
                />
            ) : viewMode === "labels" ? (
                <HrLabelView
                    labels={labels}
                    tickets={tickets}
                    onSelectTicket={setSelectedTicketId}
                    onLabelsUpdated={loadData}
                />
            ) : (
                <HrHistoryView onSelectTicket={setSelectedTicketId} />
            )}

            {/* MODAL DO CHAT WHATSAPP WEB AO CLICAR NO CARD */}
            <HrTicketModal
                ticketId={selectedTicketId}
                onClose={() => setSelectedTicketId(null)}
                onUpdated={loadData}
                availableUsers={allUsers}
                availableLabels={labels}
                availableStages={stages}
            />

            <HrAccessManager
                open={showAccessManager}
                onClose={() => setShowAccessManager(false)}
            />
        </div>
    );
}
