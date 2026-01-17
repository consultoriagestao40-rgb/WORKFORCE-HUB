
"use client";

import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Briefcase,
    Banknote,
    Zap,
    MapPin,
    Calendar,
    ArrowRight,
    History,
    FileText,
    TrendingUp
} from "lucide-react";

interface TimelineEvent {
    id: string;
    type: 'ASSIGNMENT' | 'UNASSIGNMENT' | 'VACATION' | 'SALARY' | 'ROLE' | 'SITUATION' | 'LOG';
    date: Date;
    title: string;
    subtitle?: string;
    details?: string;
    isNightShift?: boolean;
    endDate?: Date;
}

export function EmployeeTimeline({ events }: { events: TimelineEvent[] }) {
    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/5 rounded-2xl border border-slate-50/10">
                <History className="w-10 h-10 text-slate-700 mb-2 opacity-50" />
                <p className="text-slate-500 font-bold text-sm">Nenhum evento registrado no histórico.</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 relative before:absolute before:inset-0 before:left-2 before:w-px before:bg-white/10">
            {events.map((event, idx) => (
                <div key={event.id} className="relative pl-8 group cursor-default">
                    {/* Timeline Dot */}
                    <div className={`absolute left-0 top-1 h-4 w-4 rounded-full ring-4 ring-slate-900 transition-all duration-300 z-10
                        ${getDotColor(event.type)}
                        ${idx === 0 ? 'scale-125' : ''}`}
                    />

                    {/* Content */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-80">
                                {format(new Date(event.date), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                            {idx === 0 && <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[8px] font-black px-1.5 ">ATUAL</Badge>}
                        </div>

                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h4 className={`text-base font-black tracking-tight flex items-center gap-2 ${getTextColor(event.type)}`}>
                                    {event.title}
                                </h4>
                                {event.subtitle && (
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-0.5">
                                        {event.subtitle}
                                    </p>
                                )}
                            </div>

                            {/* Icon Badge */}
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center bg-white/5 border border-white/5 ${getIconColor(event.type)}`}>
                                {getIcon(event.type)}
                            </div>
                        </div>

                        {event.details && (
                            <div className="pt-2">
                                <Badge variant="outline" className="text-[9px] border-white/10 text-slate-400 font-bold px-2 py-0.5 max-w-full whitespace-normal text-left inline-block">
                                    {event.details}
                                </Badge>
                            </div>
                        )}

                        {event.isNightShift && (
                            <div className="pt-1">
                                <Badge className="bg-indigo-500/20 text-indigo-400 border-none text-[8px] font-black px-1.5 py-0">Noturno</Badge>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function getDotColor(type: string) {
    switch (type) {
        case 'ASSIGNMENT': return 'bg-primary ring-primary/20';
        case 'UNASSIGNMENT': return 'bg-slate-600 ring-slate-600/20';
        case 'VACATION': return 'bg-amber-500 ring-amber-500/20';
        case 'SALARY': return 'bg-emerald-500 ring-emerald-500/20';
        case 'ROLE': return 'bg-purple-500 ring-purple-500/20';
        case 'SITUATION': return 'bg-rose-500 ring-rose-500/20';
        default: return 'bg-slate-500 ring-slate-500/20';
    }
}

function getTextColor(type: string) {
    switch (type) {
        case 'ASSIGNMENT': return 'text-white/90 group-hover:text-primary transition-colors';
        case 'UNASSIGNMENT': return 'text-slate-400';
        case 'VACATION': return 'text-amber-200';
        case 'SALARY': return 'text-emerald-400';
        case 'ROLE': return 'text-purple-400';
        default: return 'text-white/90';
    }
}

function getIconColor(type: string) {
    switch (type) {
        case 'ASSIGNMENT': return 'text-primary';
        case 'UNASSIGNMENT': return 'text-slate-400';
        case 'VACATION': return 'text-amber-500';
        case 'SALARY': return 'text-emerald-500';
        case 'ROLE': return 'text-purple-500';
        default: return 'text-slate-500';
    }
}

function getIcon(type: string) {
    switch (type) {
        case 'ASSIGNMENT': return <MapPin className="w-4 h-4" />;
        case 'UNASSIGNMENT': return <ArrowRight className="w-4 h-4" />;
        case 'VACATION': return <Zap className="w-4 h-4" />;
        case 'SALARY': return <Banknote className="w-4 h-4" />;
        case 'ROLE': return <Briefcase className="w-4 h-4" />;
        case 'SITUATION': return <TrendingUp className="w-4 h-4" />;
        default: return <FileText className="w-4 h-4" />;
    }
}
