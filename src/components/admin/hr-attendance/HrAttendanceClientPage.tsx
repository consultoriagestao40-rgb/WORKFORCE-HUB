"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    getHrPipelineStages,
    getHrTickets,
    getHrLabels,
    seedDefaultPipeline,
    syncZapiChats
} from "@/actions/hr-attendance";
import { HrKanbanView } from "./HrKanbanView";
import { HrLabelView } from "./HrLabelView";
import { HrHistoryView } from "./HrHistoryView";
import { HrTicketModal } from "./HrTicketModal";
import { HrPipelineEditor } from "./HrPipelineEditor";
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
    const [syncing, setSyncing] = useState(false);

    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Modals
    const [showPipelineEditor, setShowPipelineEditor] = useState(false);
    const [showAccessManager, setShowAccessManager] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            await seedDefaultPipeline();
            await syncZapiChats();
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

    const handleSync = async () => {
        setSyncing(true);
        try {
            await syncZapiChats();
            const tcks = await getHrTickets({ search: searchQuery });
            setTickets(tcks);
        } finally {
            setSyncing(false);
        }
    };


    useEffect(() => {
        loadData();
    }, [loadData]);

    // Polling a cada 5 segundos para recarregar lista de tickets e mensagens não lidas
    useEffect(() => {
        const interval = setInterval(() => {
            getHrTickets({ search: searchQuery }).then(setTickets);
        }, 5000);
        return () => clearInterval(interval);
    }, [searchQuery]);

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-100">
            {/* Header com Visões e Ações */}
            <div className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="font-extrabold text-lg text-slate-800 flex items-center gap-2">
                            <span>📞</span> Atendimento RH <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">WhatsApp ao Vivo</span>
                        </h1>
                        <p className="text-[11px] text-slate-500">Pipeline de tickets e suporte de funcionários</p>
                    </div>

                    {/* View Switcher */}
                    <div className="flex bg-slate-100 p-1 rounded-lg border gap-1">
                        <button
                            onClick={() => setViewMode("kanban")}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${viewMode === "kanban" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                        >
                            📊 Pipeline (Kanban)
                        </button>
                        <button
                            onClick={() => setViewMode("labels")}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${viewMode === "labels" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                        >
                            🏷️ Por Etiquetas
                        </button>
                        <button
                            onClick={() => setViewMode("history")}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${viewMode === "history" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                        >
                            📜 Histórico
                        </button>
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={syncing}
                        className="h-8 text-xs gap-1.5 border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold"
                        onClick={handleSync}
                    >
                        <span>🔄</span> {syncing ? "Sincronizando..." : "Puxar Conversas WhatsApp"}
                    </Button>

                    <Input
                        placeholder="Buscar funcionario ou protocolo..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="text-xs h-8 w-60 bg-slate-50"
                    />


                    {currentUser?.role === "ADMIN" && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100"
                            onClick={() => setShowAccessManager(true)}
                        >
                            <span>🔒</span> Acessos
                        </Button>
                    )}
                </div>

            </div>

            {/* View Render */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                    Carregando Central de Atendimento...
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

            {/* Modals */}
            <HrTicketModal
                ticketId={selectedTicketId}
                onClose={() => setSelectedTicketId(null)}
                onUpdated={loadData}
                availableUsers={allUsers}
                availableLabels={labels}
                availableStages={stages}
            />

            <HrPipelineEditor
                open={showPipelineEditor}
                onClose={() => setShowPipelineEditor(false)}
                stages={stages}
                onSaved={loadData}
            />

            <HrAccessManager
                open={showAccessManager}
                onClose={() => setShowAccessManager(false)}
            />
        </div>
    );
}
