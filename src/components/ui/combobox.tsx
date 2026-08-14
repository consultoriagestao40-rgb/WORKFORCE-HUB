"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export interface ComboboxOption {
    value: string;
    label: string;
    sublabel?: string;
    icon?: React.ReactNode;
}

export interface ComboboxProps {
    options: ComboboxOption[];
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    className?: string;
    icon?: React.ReactNode;
    disabled?: boolean;
    align?: "start" | "center" | "end";
    popoverClassName?: string;
}

export function Combobox({
    options,
    value,
    onChange,
    placeholder = "Selecione...",
    searchPlaceholder = "Buscar...",
    emptyMessage = "Nenhum resultado encontrado.",
    className,
    icon,
    disabled = false,
    align = "start",
    popoverClassName,
}: ComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    // Normalize strings for diacritic-insensitive search (e.g. "São" matches "Sao")
    const normalize = (str: string) =>
        str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

    const filteredOptions = React.useMemo(() => {
        if (!search.trim()) return options;
        const term = normalize(search);
        return options.filter(
            (opt) =>
                normalize(opt.label).includes(term) ||
                (opt.sublabel && normalize(opt.sublabel).includes(term)) ||
                normalize(opt.value).includes(term)
        );
    }, [options, search]);

    const selectedOption = options.find((opt) => opt.value === value);

    React.useEffect(() => {
        if (open) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
        } else {
            setSearch("");
        }
    }, [open]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "w-full justify-between h-10 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-slate-700 shadow-sm transition-all text-left",
                        open && "border-indigo-500 ring-2 ring-indigo-500/20 bg-white",
                        className
                    )}
                >
                    <div className="flex items-center gap-2 truncate pr-2">
                        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
                        {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
                        <span className={cn("truncate", !selectedOption && "text-slate-400 font-normal")}>
                            {selectedOption ? selectedOption.label : placeholder}
                        </span>
                    </div>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 text-slate-400 opacity-70" />
                </Button>
            </PopoverTrigger>
            <PopoverContent 
                className={cn(
                    "p-0 w-[var(--radix-popover-trigger-width)] min-w-[240px] max-w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in-0 zoom-in-95",
                    popoverClassName
                )} 
                align={align}
            >
                {/* Search Bar */}
                <div className="p-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                    <input
                        ref={searchInputRef}
                        className="flex h-7 w-full rounded-lg bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
                        placeholder={searchPlaceholder}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {/* Options List */}
                <div className="max-h-[260px] overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                    {filteredOptions.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                            {emptyMessage}
                        </div>
                    ) : (
                        filteredOptions.map((option) => {
                            const isSelected = value === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "w-full text-left flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer group",
                                        isSelected
                                            ? "bg-indigo-50 text-indigo-900 font-bold"
                                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium"
                                    )}
                                >
                                    <div className="flex items-center gap-2 truncate pr-2">
                                        {option.icon && (
                                            <span className={cn("shrink-0", isSelected ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")}>
                                                {option.icon}
                                            </span>
                                        )}
                                        <div className="truncate">
                                            <div className="truncate">{option.label}</div>
                                            {option.sublabel && (
                                                <div className="text-[10px] text-slate-400 font-normal truncate">
                                                    {option.sublabel}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <Check
                                        className={cn(
                                            "h-3.5 w-3.5 shrink-0 transition-opacity",
                                            isSelected ? "opacity-100 text-indigo-600 font-black" : "opacity-0"
                                        )}
                                    />
                                </button>
                            );
                        })
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
