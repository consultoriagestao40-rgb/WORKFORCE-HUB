"use client";

import React, { useState } from "react";
import { 
    Popover, 
    PopoverTrigger, 
    PopoverContent 
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    Check, 
    ChevronDown, 
    Users, 
    User, 
    Building2, 
    Smartphone 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExtraGroupItem, ExtraPhoneItem } from "@/lib/rh-notifications";

interface RhRecipientSelectorProps {
    value: string;
    onChange: (newValue: string) => void;
    operationsGroupName?: string | null;
    adminGroupName?: string | null;
    extraGroups: ExtraGroupItem[];
    extraPhones: ExtraPhoneItem[];
}

export function RhRecipientSelector({
    value,
    onChange,
    operationsGroupName,
    adminGroupName,
    extraGroups = [],
    extraPhones = []
}: RhRecipientSelectorProps) {
    const [open, setOpen] = useState(false);

    const selectedIds = value 
        ? value.split(",").map((s) => s.trim()).filter(Boolean) 
        : [];

    const totalAvailable = 2 + extraGroups.length + extraPhones.length;

    const toggleItem = (id: string) => {
        let newSelected: string[];
        if (selectedIds.includes(id)) {
            newSelected = selectedIds.filter((x) => x !== id);
        } else {
            newSelected = [...selectedIds, id];
        }
        onChange(newSelected.join(","));
    };

    const handleSelectAll = () => {
        const allIds = [
            "OPERATIONS",
            "ADMIN",
            ...extraGroups.map((g) => g.id),
            ...extraPhones.map((p) => p.id)
        ];
        onChange(allIds.join(","));
    };

    const handleClearAll = () => {
        onChange("");
    };

    // Label de resumo no botão
    const getButtonSummary = () => {
        if (selectedIds.length === 0) {
            return {
                text: "Nenhum canal selecionado",
                variant: "empty"
            };
        }

        if (selectedIds.length === totalAvailable && totalAvailable > 0) {
            return {
                text: `Todos os Destinatários (${selectedIds.length})`,
                variant: "all"
            };
        }

        // Montar resumo amigável dos canais marcados
        const names: string[] = [];
        if (selectedIds.includes("OPERATIONS")) names.push("Operações");
        if (selectedIds.includes("ADMIN")) names.push("Administrativo");

        for (const g of extraGroups) {
            if (selectedIds.includes(g.id)) names.push(g.name);
        }

        for (const p of extraPhones) {
            if (selectedIds.includes(p.id)) names.push(p.name);
        }

        if (names.length === 1) {
            return { text: names[0], variant: "partial", count: selectedIds.length };
        }
        if (names.length === 2) {
            return { text: `${names[0]}, ${names[1]}`, variant: "partial", count: selectedIds.length };
        }
        return { 
            text: `${names[0]}, ${names[1]} +${names.length - 2}`, 
            variant: "partial", 
            count: selectedIds.length 
        };
    };

    const summary = getButtonSummary();

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "h-8 px-2.5 rounded-xl border text-[11px] font-semibold flex items-center justify-between gap-1.5 transition-all cursor-pointer shadow-2xs max-w-[210px]",
                        summary.variant === "empty" && "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100",
                        summary.variant === "all" && "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100",
                        summary.variant === "partial" && "bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                    )}
                >
                    <span className="truncate text-left leading-tight">
                        {summary.text}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
            </PopoverTrigger>

            <PopoverContent 
                align="end" 
                className="w-80 p-3.5 bg-white rounded-2xl shadow-xl border border-slate-200 text-xs space-y-3 z-50"
            >
                {/* Cabeçalho do Popover */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                        <h4 className="font-bold text-xs text-slate-900">Destinatários deste Alerta</h4>
                        <p className="text-[10px] text-slate-400">Escolha quais grupos e pessoas receberão</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            className="px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer transition-colors"
                        >
                            Todos
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="px-1.5 py-0.5 text-[9px] font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
                        >
                            Limpar
                        </button>
                    </div>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {/* Seção 1: Grupos do WhatsApp */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            <Users className="w-3 h-3" />
                            <span>Grupos do WhatsApp</span>
                        </div>

                        <div className="space-y-1">
                            {/* Grupo Operações */}
                            <label
                                onClick={() => toggleItem("OPERATIONS")}
                                className={cn(
                                    "flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer select-none",
                                    selectedIds.includes("OPERATIONS") 
                                        ? "bg-blue-50/70 border-blue-200 text-blue-950 font-bold" 
                                        : "bg-white border-slate-200/70 text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <div className={cn(
                                        "w-4 h-4 rounded-md flex items-center justify-center border transition-all",
                                        selectedIds.includes("OPERATIONS")
                                            ? "bg-blue-600 border-blue-600 text-white"
                                            : "border-slate-300 bg-white"
                                    )}>
                                        {selectedIds.includes("OPERATIONS") && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                    <span className="text-xs truncate">
                                        {operationsGroupName || "Grupo de Operações"}
                                    </span>
                                </div>
                                <Badge className="bg-blue-100 text-blue-800 text-[9px] px-1.5 py-0 border-0 font-bold shrink-0">
                                    Ops
                                </Badge>
                            </label>

                            {/* Grupo Administrativo */}
                            <label
                                onClick={() => toggleItem("ADMIN")}
                                className={cn(
                                    "flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer select-none",
                                    selectedIds.includes("ADMIN") 
                                        ? "bg-purple-50/70 border-purple-200 text-purple-950 font-bold" 
                                        : "bg-white border-slate-200/70 text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <div className={cn(
                                        "w-4 h-4 rounded-md flex items-center justify-center border transition-all",
                                        selectedIds.includes("ADMIN")
                                            ? "bg-purple-600 border-purple-600 text-white"
                                            : "border-slate-300 bg-white"
                                    )}>
                                        {selectedIds.includes("ADMIN") && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                    <span className="text-xs truncate">
                                        {adminGroupName || "Grupo do Administrativo"}
                                    </span>
                                </div>
                                <Badge className="bg-purple-100 text-purple-800 text-[9px] px-1.5 py-0 border-0 font-bold shrink-0">
                                    Adm
                                </Badge>
                            </label>

                            {/* Grupos Extras Cadastrados */}
                            {extraGroups.map((grp) => (
                                <label
                                    key={grp.id}
                                    onClick={() => toggleItem(grp.id)}
                                    className={cn(
                                        "flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer select-none",
                                        selectedIds.includes(grp.id) 
                                            ? "bg-indigo-50/70 border-indigo-200 text-indigo-950 font-bold" 
                                            : "bg-white border-slate-200/70 text-slate-600 hover:bg-slate-50"
                                    )}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <div className={cn(
                                            "w-4 h-4 rounded-md flex items-center justify-center border transition-all",
                                            selectedIds.includes(grp.id)
                                                ? "bg-indigo-600 border-indigo-600 text-white"
                                                : "border-slate-300 bg-white"
                                        )}>
                                            {selectedIds.includes(grp.id) && <Check className="w-3 h-3 stroke-[3]" />}
                                        </div>
                                        <span className="text-xs truncate">
                                            {grp.name}
                                        </span>
                                    </div>
                                    <Badge className="bg-indigo-100 text-indigo-800 text-[9px] px-1.5 py-0 border-0 font-bold shrink-0">
                                        Extra
                                    </Badge>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Seção 2: Destinatários Individuais (WhatsApp Privado) */}
                    <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            <User className="w-3 h-3 text-emerald-600" />
                            <span>Contatos Privados (Diretoria / DP)</span>
                        </div>

                        {extraPhones.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic p-2 bg-slate-50 rounded-xl text-center border border-dashed border-slate-200">
                                Nenhum número cadastrado na seção acima.
                            </p>
                        ) : (
                            <div className="space-y-1">
                                {extraPhones.map((phone) => (
                                    <label
                                        key={phone.id}
                                        onClick={() => toggleItem(phone.id)}
                                        className={cn(
                                            "flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer select-none",
                                            selectedIds.includes(phone.id) 
                                                ? "bg-emerald-50/70 border-emerald-200 text-emerald-950 font-bold" 
                                                : "bg-white border-slate-200/70 text-slate-600 hover:bg-slate-50"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <div className={cn(
                                                "w-4 h-4 rounded-md flex items-center justify-center border transition-all",
                                                selectedIds.includes(phone.id)
                                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                                    : "border-slate-300 bg-white"
                                            )}>
                                                {selectedIds.includes(phone.id) && <Check className="w-3 h-3 stroke-[3]" />}
                                            </div>
                                            <div className="truncate">
                                                <span className="text-xs block leading-tight truncate">
                                                    {phone.name}
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-mono block">
                                                    {phone.phone} {phone.role ? `• ${phone.role}` : ""}
                                                </span>
                                            </div>
                                        </div>
                                        <Badge className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0 border-0 font-bold shrink-0">
                                            {phone.role || "Privado"}
                                        </Badge>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{selectedIds.length} selecionado(s)</span>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="font-bold text-slate-700 hover:text-black cursor-pointer"
                    >
                        Pronto
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
