"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export function LaunchVacationButton() {
    return (
        <Button 
            variant="outline" 
            onClick={() => {
                window.dispatchEvent(new Event('open-vacation-dialog'));
            }}
            className="gap-1.5 border-slate-200 text-slate-800 font-bold h-9 px-3.5 rounded-xl shadow-sm text-[11px] uppercase tracking-wider hover:bg-slate-50 transition-colors bg-white shrink-0"
        >
            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
            <span>Lançar Férias</span>
        </Button>
    );
}
