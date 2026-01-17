"use client";

import { useState, useMemo, memo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateRoster } from "@/lib/scheduling";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

interface RosterItem {
    id: string;
    employeeName: string;
    siteName: string;
    role: string;
    schedule: string;
    startDate: Date;
}

interface GlobalRosterProps {
    data: RosterItem[];
}



const RosterRow = memo(({ item, days }: { item: RosterItem, days: Date[] }) => {
    const roster = useMemo(() =>
        generateRoster(item.schedule, item.startDate, days),
        [item.schedule, item.startDate, days]
    );

    return (
        <tr className="hover:bg-slate-50 transition-colors">
            <td className="sticky left-0 z-10 bg-white p-2 border shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                <div className="font-bold text-slate-800 truncate max-w-[180px]">{item.employeeName}</div>
                <div className="text-[10px] text-slate-500 truncate">{item.siteName} - {item.role}</div>
                <div className="text-[9px] bg-slate-100 px-1 rounded inline-block mt-1 font-mono">{item.schedule}</div>
            </td>
            {roster.map(day => {
                const isWork = day.status === 'Trabalho';
                return (
                    <td
                        key={day.date.toISOString()}
                        className={`p-1 border text-center transition-colors ${isWork ? 'bg-blue-50' : 'bg-slate-50'}`}
                    >
                        {isWork ? (
                            <div className="w-5 h-5 bg-blue-500 rounded-sm mx-auto flex items-center justify-center text-[10px] text-white font-bold shadow-sm">
                                T
                            </div>
                        ) : (
                            <span className="text-slate-300 font-medium">F</span>
                        )}
                    </td>
                );
            })}
        </tr>
    );
});

RosterRow.displayName = "RosterRow";

export function GlobalRoster({ data }: GlobalRosterProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

    const handleExport = () => {
        const wb = XLSX.utils.book_new();

        // Prepare data rows
        const rows = data.map(item => {
            const roster = generateRoster(item.schedule, item.startDate, days);
            const rowData: any = {
                "Colaborador": item.employeeName,
                "Site": item.siteName,
                "Cargo": item.role,
                "Escala": item.schedule
            };

            // Add days as columns
            roster.forEach(day => {
                const dayStr = format(day.date, 'dd/MM');
                rowData[dayStr] = day.status === 'Trabalho' ? 'T' : 'F';
            });

            return rowData;
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Escala Mensal");

        // Finalize and download
        const fileName = `Escala_${format(currentMonth, 'MMMM_yyyy', { locale: ptBR })}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header / Month Selector */}
            <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 capitalize">
                        {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </h2>
                    <p className="text-sm text-slate-500">Escala projetada de todos os postos ativos</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExport} className="mr-4 bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
                        <Download className="w-4 h-4 mr-2" />
                        Exportar Excel
                    </Button>
                    <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
                    <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
                </div>
            </div>

            {/* Grid Container */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="sticky left-0 z-10 bg-slate-100 p-2 border text-left min-w-[200px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                Colaborador / Site
                            </th>
                            {days.map(day => (
                                <th
                                    key={day.toISOString()}
                                    className={`p-1 border text-center min-w-[30px] ${isWeekend(day) ? 'bg-slate-200' : ''}`}
                                >
                                    <div className="font-bold">{format(day, 'd')}</div>
                                    <div className="text-[9px] uppercase">{format(day, 'eee', { locale: ptBR }).charAt(0)}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item) => (
                            <RosterRow key={item.id} item={item} days={days} />
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="p-4 bg-slate-50 border-t flex gap-6 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                    <span>T - Trabalho</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-slate-200 border border-slate-300 rounded-sm"></div>
                    <span>F - Folga</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-slate-200 rounded-sm italic flex items-center justify-center border border-dashed text-[8px]">S</div>
                    <span>Sábado/Domingo</span>
                </div>
            </div>
        </div>
    );
}
