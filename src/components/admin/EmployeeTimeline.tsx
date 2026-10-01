
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
    TrendingUp,
    User,
    Bot
} from "lucide-react";

export interface TimelineEvent {
    id: string;
    type: 'ASSIGNMENT' | 'UNASSIGNMENT' | 'VACATION' | 'VACATION_SCHEDULED' | 'VACATION_END' | 'SALARY' | 'ROLE' | 'SITUATION' | 'LOG' | 'OBSERVATION';
    date: Date;
    title: string;
    subtitle?: string;
    details?: string;
    isNightShift?: boolean;
    endDate?: Date;
    author?: string;
    authorRole?: string;
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
        <div className="space-y-8 relative before:absolute before:inset-0 before:left-2 before:w-px before:bg-white/10">
            {events.map((event, idx) => {
                const eventDate = new Date(event.date);
                const hasTime = eventDate.getHours() !== 0 || eventDate.getMinutes() !== 0;
                const formattedDate = format(
                    eventDate, 
                    hasTime ? "dd/MM/yyyy 'às' HH:mm" : "dd/MM/yyyy", 
                    { locale: ptBR }
                );

                return (
                    <div key={event.id} className="relative pl-8 group cursor-default">
                        {/* Timeline Dot */}
                        <div className={`absolute left-0 top-1 h-4 w-4 rounded-full ring-4 ring-slate-900 transition-all duration-300 z-10
                            ${getDotColor(event.type)}
                            ${idx === 0 ? 'scale-125' : ''}`}
                        />

                        {/* Content */}
                        <div className="space-y-1.5 bg-white/[0.02] hover:bg-white/[0.04] p-3 rounded-2xl border border-white/5 transition-all">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-mono font-bold text-slate-400">
                                    {formattedDate}
                                </span>
                                {idx === 0 && (
                                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black px-1.5 py-0">
                                        MAIS RECENTE
                                    </Badge>
                                )}
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getTypeBadgeColor(event.type)}`}>
                                    {getTypeLabel(event.type)}
                                </span>
                            </div>

                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h4 className={`text-base font-black tracking-tight flex items-center gap-2 ${getTextColor(event.type)}`}>
                                        {event.title}
                                    </h4>
                                    {event.subtitle && (
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-0.5">
                                            {event.subtitle}
                                        </p>
                                    )}
                                </div>

                                {/* Icon Badge */}
                                <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-white/5 border border-white/10 ${getIconColor(event.type)}`}>
                                    {getIcon(event.type)}
                                </div>
                            </div>

                            {event.details && (
                                <div className="pt-1">
                                    <p className="text-xs text-slate-300 bg-black/20 p-2.5 rounded-xl border border-white/5 leading-relaxed whitespace-pre-wrap">
                                        {event.details}
                                    </p>
                                </div>
                            )}

                            {/* Author / Responsável */}
                            {event.author && (
                                <div className="pt-1 flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] text-slate-400 font-medium">Realizado por:</span>
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 text-slate-200 border border-white/10">
                                        {event.author.toLowerCase().includes('autom') || event.author.toLowerCase().includes('sistema') ? (
                                            <Bot className="w-3 h-3 text-cyan-400" />
                                        ) : (
                                            <User className="w-3 h-3 text-amber-400" />
                                        )}
                                        <span>{event.author}</span>
                                        {event.authorRole && (
                                            <span className="text-[8px] uppercase tracking-wider text-slate-400 font-mono bg-white/10 px-1 py-0.2 rounded ml-0.5">
                                                {event.authorRole}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )}

                            {event.isNightShift && (
                                <div className="pt-1">
                                    <Badge className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[8px] font-black px-1.5 py-0">Noturno</Badge>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function getDotColor(type: string) {
    switch (type) {
        case 'ASSIGNMENT': return 'bg-blue-500 ring-blue-500/20';
        case 'UNASSIGNMENT': return 'bg-slate-500 ring-slate-500/20';
        case 'VACATION_SCHEDULED': return 'bg-amber-400 ring-amber-400/20';
        case 'VACATION': return 'bg-amber-500 ring-amber-500/20';
        case 'VACATION_END': return 'bg-emerald-400 ring-emerald-400/20';
        case 'SALARY': return 'bg-emerald-500 ring-emerald-500/20';
        case 'ROLE': return 'bg-purple-500 ring-purple-500/20';
        case 'SITUATION': return 'bg-rose-500 ring-rose-500/20';
        case 'OBSERVATION': return 'bg-cyan-500 ring-cyan-500/20';
        default: return 'bg-slate-500 ring-slate-500/20';
    }
}

function getTextColor(type: string) {
    switch (type) {
        case 'ASSIGNMENT': return 'text-blue-300';
        case 'UNASSIGNMENT': return 'text-slate-400';
        case 'VACATION_SCHEDULED': return 'text-amber-300';
        case 'VACATION': return 'text-amber-200';
        case 'VACATION_END': return 'text-emerald-300';
        case 'SALARY': return 'text-emerald-400';
        case 'ROLE': return 'text-purple-400';
        case 'OBSERVATION': return 'text-cyan-400 font-bold';
        default: return 'text-white/90';
    }
}

function getIconColor(type: string) {
    switch (type) {
        case 'ASSIGNMENT': return 'text-blue-400';
        case 'UNASSIGNMENT': return 'text-slate-400';
        case 'VACATION_SCHEDULED': return 'text-amber-400';
        case 'VACATION': return 'text-amber-500';
        case 'VACATION_END': return 'text-emerald-400';
        case 'SALARY': return 'text-emerald-500';
        case 'ROLE': return 'text-purple-500';
        case 'OBSERVATION': return 'text-cyan-400';
        default: return 'text-slate-500';
    }
}

function getTypeBadgeColor(type: string) {
    switch (type) {
        case 'ASSIGNMENT': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        case 'UNASSIGNMENT': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        case 'VACATION_SCHEDULED': return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
        case 'VACATION': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        case 'VACATION_END': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        case 'SALARY': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        case 'ROLE': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
        case 'SITUATION': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
        case 'OBSERVATION': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
        default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
}

function getTypeLabel(type: string) {
    switch (type) {
        case 'ASSIGNMENT': return 'Alocação';
        case 'UNASSIGNMENT': return 'Desvinculação';
        case 'VACATION_SCHEDULED': return 'Programação Férias';
        case 'VACATION': return 'Início Férias';
        case 'VACATION_END': return 'Retorno Férias';
        case 'SALARY': return 'Salário';
        case 'ROLE': return 'Cargo';
        case 'SITUATION': return 'Situação';
        case 'OBSERVATION': return 'Observação';
        default: return 'Registro';
    }
}

function getIcon(type: string) {
    switch (type) {
        case 'ASSIGNMENT': return <MapPin className="w-4 h-4" />;
        case 'UNASSIGNMENT': return <ArrowRight className="w-4 h-4" />;
        case 'VACATION_SCHEDULED': return <Calendar className="w-4 h-4" />;
        case 'VACATION': return <Zap className="w-4 h-4" />;
        case 'VACATION_END': return <ArrowRight className="w-4 h-4" />;
        case 'SALARY': return <Banknote className="w-4 h-4" />;
        case 'ROLE': return <Briefcase className="w-4 h-4" />;
        case 'SITUATION': return <TrendingUp className="w-4 h-4" />;
        case 'OBSERVATION': return <FileText className="w-4 h-4" />;
        default: return <FileText className="w-4 h-4" />;
    }
}

