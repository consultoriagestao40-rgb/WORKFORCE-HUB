"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createHrLabel, deleteHrLabel } from "@/actions/hr-attendance";

interface Props {
    labels: any[];
    tickets: any[];
    onSelectTicket: (ticketId: string) => void;
    onLabelsUpdated: () => void;
}

export function HrLabelView({ labels, tickets, onSelectTicket, onLabelsUpdated }: Props) {
    const [newLabelName, setNewLabelName] = useState("");
    const [newLabelColor, setNewLabelColor] = useState("#10b981");
    const [loading, setLoading] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLabelName.trim()) return;
        setLoading(true);
        try {
            await createHrLabel({ name: newLabelName.trim(), color: newLabelColor });
            setNewLabelName("");
            onLabelsUpdated();
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Deseja excluir esta etiqueta?")) {
            await deleteHrLabel(id);
            onLabelsUpdated();
        }
    };

    return (
        <div className="flex-1 p-6 bg-slate-100/70 overflow-y-auto space-y-6">
            {/* Criar Etiqueta */}
            <form onSubmit={handleCreate} className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-3">
                <Input
                    placeholder="Nome da Nova Etiqueta (ex: Urgente, Vale Transporte, Dúvidas Férias)"
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    className="text-xs max-w-md h-9"
                    required
                />
                <input
                    type="color"
                    value={newLabelColor}
                    onChange={(e) => setNewLabelColor(e.target.value)}
                    className="w-9 h-9 p-0.5 rounded cursor-pointer border"
                    title="Escolha a Cor da Etiqueta"
                />
                <Button type="submit" disabled={loading} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9">
                    + Criar Etiqueta
                </Button>
            </form>

            {/* Lista por Etiquetas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {labels.map((lbl) => {
                    const labeledTickets = tickets.filter(t => t.labels.some((l: any) => l.id === lbl.id));

                    return (
                        <div key={lbl.id} className="bg-white rounded-xl border shadow-sm p-4">
                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: lbl.color }} />
                                    <h3 className="font-bold text-sm text-slate-800">{lbl.name}</h3>
                                    <span className="text-xs text-slate-400 font-medium">({labeledTickets.length})</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
                                    onClick={() => handleDelete(lbl.id)}
                                >
                                    🗑️
                                </Button>
                            </div>

                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {labeledTickets.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic py-2">Nenhum atendimento com esta etiqueta.</p>
                                ) : (
                                    labeledTickets.map((t) => (
                                        <div
                                            key={t.id}
                                            onClick={() => onSelectTicket(t.id)}
                                            className="p-2.5 rounded-lg border bg-slate-50 hover:bg-indigo-50/50 cursor-pointer flex items-center justify-between"
                                        >
                                            <div>
                                                <div className="text-xs font-bold text-slate-800">{t.contactName}</div>
                                                <div className="text-[11px] text-slate-600">{t.title}</div>
                                            </div>
                                            <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                                {t.stage?.name}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
