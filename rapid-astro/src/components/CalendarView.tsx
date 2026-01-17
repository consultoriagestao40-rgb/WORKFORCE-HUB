"use client";

import { useState } from "react";
import { format, addMonths, subMonths, isSameMonth, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DayStatus, generateRoster } from "@/lib/scheduling";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalendarViewProps {
    scheduleType: string;
    startDate: string; // ISO string
}

export function CalendarView({ scheduleType, startDate }: CalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    if (!startDate) return null;

    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const roster = generateRoster(scheduleType, new Date(startDate), days);
    const today = new Date();

    function nextMonth() {
        setCurrentMonth(addMonths(currentMonth, 1));
    }

    function prevMonth() {
        setCurrentMonth(subMonths(currentMonth, 1));
    }

    // Days of week header
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    // Alignment: We need to pad the start of the grid based on the weekday of the 1st
    const firstDayOfMonth = roster[0].date;
    const startPadding = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
    const paddingArray = Array(startPadding).fill(null);

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={prevMonth}>
                    <ChevronLeft className="w-5 h-5 text-slate-500" />
                </Button>
                <div className="font-semibold text-slate-700 capitalize flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-slate-400" />
                    {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </div>
                <Button variant="ghost" size="icon" onClick={nextMonth}>
                    <ChevronRight className="w-5 h-5 text-slate-500" />
                </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {weekDays.map(d => (
                    <div key={d} className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        {d}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {paddingArray.map((_, i) => (
                    <div key={`pad-${i}`} />
                ))}

                {roster.map((day) => {
                    const isWork = day.status === 'Trabalho';
                    const isToday = isSameDay(day.date, today);

                    return (
                        <div
                            key={day.date.toISOString()}
                            className={`
                                h-10 w-full rounded-md flex items-center justify-center text-sm font-medium relative
                                ${isWork
                                    ? 'bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100'
                                    : 'bg-slate-50 text-slate-400 border border-slate-100'}
                                ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}
                            `}
                        >
                            {format(day.date, 'd')}
                            {isWork && (
                                <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-500"></div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex gap-4 mt-4 text-xs justify-center">
                <div className="flex items-center gap-1 text-slate-500">
                    <div className="w-3 h-3 rounded bg-blue-50 border border-blue-100"></div>
                    Trabalho
                </div>
                <div className="flex items-center gap-1 text-slate-500">
                    <div className="w-3 h-3 rounded bg-slate-50 border border-slate-100"></div>
                    Folga
                </div>
            </div>
        </div>
    );
}
