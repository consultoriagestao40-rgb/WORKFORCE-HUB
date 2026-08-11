"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveHrPipelineStages, deleteHrPipelineStage } from "@/actions/hr-attendance";

interface StageItem {
    id?: string;
    name: string;
    color: string;
    order: number;
    isDefault?: boolean;
}

interface Props {
    open: boolean;
    onClose: () => void;
    stages: StageItem[];
    onSaved: () => void;
}

const PRESET_COLORS = [
    "#6366f1", "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981",
    "#ec4899", "#ef4444", "#14b8a6", "#64748b", "#84cc16"
];

export function HrPipelineEditor({ open, onClose, stages: initialStages, onSaved }: Props) {
    const [stages, setStages] = useState<StageItem[]>(initialStages);
    const [loading, setLoading] = useState(false);

    const handleAddStage = () => {
        setStages(prev => [
            ...prev,
            {
                name: `Nova Etapa ${prev.length + 1}`,
                color: PRESET_COLORS[prev.length % PRESET_COLORS.length],
                order: prev.length,
                isDefault: false
            }
        ]);
    };

    const handleUpdateStage = (index: number, key: keyof StageItem, val: any) => {
        setStages(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [key]: val };
            if (key === "isDefault" && val === true) {
                // Desmarcar default das outras
                return next.map((st, i) => ({ ...st, isDefault: i === index }));
            }
            return next;
        });
    };

    const handleDelete = async (index: number) => {
        const item = stages[index];
        if (item.id) {
            await deleteHrPipelineStage(item.id);
        }
        setStages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const formatted = stages.map((s, i) => ({ ...s, order: i }));
            await saveHrPipelineStages(formatted);
            onSaved();
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span>⚙️</span> Personalizar Etapas do Pipeline (Kanban)
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-3 py-2 max-h-[450px] overflow-y-auto pr-1">
                    {stages.map((st, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg border bg-slate-50">
                            <span className="text-xs font-mono text-slate-400 w-4">{idx + 1}</span>
                            
                            <div className="flex-1">
                                <Input
                                    value={st.name}
                                    onChange={(e) => handleUpdateStage(idx, "name", e.target.value)}
                                    placeholder="Nome da Etapa"
                                    className="h-8 text-xs bg-white font-medium"
                                />
                            </div>

                            {/* Color Picker */}
                            <div className="flex items-center gap-1">
                                {PRESET_COLORS.slice(0, 5).map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        className={`w-5 h-5 rounded-full border ${st.color === c ? "ring-2 ring-indigo-600 scale-110" : ""}`}
                                        style={{ backgroundColor: c }}
                                        onClick={() => handleUpdateStage(idx, "color", c)}
                                    />
                                ))}
                            </div>

                            {/* Default Toggle */}
                            <Button
                                type="button"
                                variant={st.isDefault ? "default" : "outline"}
                                size="sm"
                                className={`h-7 text-[10px] ${st.isDefault ? "bg-indigo-600 text-white" : ""}`}
                                onClick={() => handleUpdateStage(idx, "isDefault", !st.isDefault)}
                            >
                                {st.isDefault ? "Padrão" : "Tornar Padrão"}
                            </Button>

                            {/* Delete */}
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
                                onClick={() => handleDelete(idx)}
                            >
                                🗑️
                            </Button>
                        </div>
                    ))}

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full border-dashed text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        onClick={handleAddStage}
                    >
                        + Adicionar Nova Etapa
                    </Button>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
                    <Button size="sm" onClick={handleSave} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        {loading ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
