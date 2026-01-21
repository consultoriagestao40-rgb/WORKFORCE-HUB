"use client";

import { useState, useMemo, memo, useRef, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateRoster } from "@/lib/scheduling";
import { ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { useReactToPrint } from "react-to-print";
import { getScheduleOverrides, toggleScheduleOverride } from "@/actions/roster";

interface RosterItem {
    id: string;
    employeeName: string;
    siteName: string;
    role: string;
    schedule: string;
    startDate: Date;
    postoId: string; // Ensure we have postoId here. We might need to map it in RosterPage.
}

interface ScheduleOverride {
    postoId: string;
    date: Date;
    isDayOff: boolean;
}

interface GlobalRosterProps {
    data: RosterItem[];
}

const RosterRow = memo(({ item, days, overrides, onToggle }: { item: RosterItem, days: Date[], overrides: ScheduleOverride[], onToggle: (date: Date, currentStatus: boolean) => void }) => {
    const roster = useMemo(() =>
        generateRoster(item.schedule, item.startDate, days),
        [item.schedule, item.startDate, days]
    );

    return (
        <tr className="hover:bg-slate-50 transition-colors">
            <td className="sticky left-0 z-10 bg-white p-2 border shadow-[2px_0_5px_rgba(0,0,0,0.05)] print:bg-white/90 print:border-gray-300">
                <div className="font-bold text-slate-800 truncate max-w-[180px] print:text-black">{item.employeeName}</div>
                <div className="text-[10px] text-slate-500 truncate print:text-gray-600">{item.siteName} - {item.role}</div>
                <div className="text-[9px] bg-slate-100 px-1 rounded inline-block mt-1 font-mono print:border print:bg-white">{item.schedule}</div>
            </td>
            {roster.map(day => {
                // Check if there is an override for this day
                const override = overrides.find(o => o.postoId === item.postoId && isSameDay(new Date(o.date), day.date));

                // Effective status logic
                let isWork = day.status === 'Trabalho';
                if (override) {
                    isWork = !override.isDayOff;
                }

                // If override exists, maybe highlight it?
                const isOverridden = !!override;

                return (
                    <td
                        key={day.date.toISOString()}
                        className={`p-1 border text-center transition-colors cursor-pointer hover:opacity-80
                            ${isWork ? 'bg-blue-50 print:bg-blue-50' : 'bg-slate-50 print:bg-slate-50'}
                            ${isOverridden ? 'ring-1 ring-amber-400 inset-0' : ''}
                        `}
                        onClick={() => onToggle(day.date, isWork)}
                        title={isOverridden ? "Manual Override" : "Escala Automática"}
                    >
                        {isWork ? (
                            <div className="w-5 h-5 bg-blue-500 rounded-sm mx-auto flex items-center justify-center text-[10px] text-white font-bold shadow-sm print:bg-blue-600 print:print-color-adjust-exact">
                                T
                            </div>
                        ) : (
                            <span className="text-slate-300 font-medium print:text-gray-400">F</span>
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
    const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
    const printRef = useRef<HTMLDivElement>(null);

    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    // Fetch overrides when month changes
    useEffect(() => {
        getScheduleOverrides(start, end).then(setOverrides);
    }, [currentMonth]); // Simplified dependency

    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Escala_${format(currentMonth, 'MMMM_yyyy', { locale: ptBR })}`,
        pageStyle: `
            @page { size: landscape; margin: 10mm; }
            @media print {
                body { -webkit-print-color-adjust: exact; }
                .no-print { display: none !important; }
            }
        `
    });

    const handleToggle = async (postoId: string, date: Date, currentStatusIsWork: boolean) => {
        // Optimistic update
        const newIsDayOff = currentStatusIsWork; // If currently Work, we become Off (true)

        setOverrides(prev => {
            // Remove existing override for this cell if exists
            const filtered = prev.filter(o => !(o.postoId === postoId && isSameDay(new Date(o.date), date)));
            // Add new override
            return [...filtered, { postoId, date, isDayOff: newIsDayOff }];
        });

        await toggleScheduleOverride(postoId, date.toISOString(), currentStatusIsWork);
    };

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

                // Override Logic for Excel
                const override = overrides.find(o => o.postoId === item.postoId && isSameDay(new Date(o.date), day.date));
                let isWork = day.status === 'Trabalho';
                if (override) isWork = !override.isDayOff;

                rowData[dayStr] = isWork ? 'T' : 'F';
            });

            return rowData;
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Escala Mensal");

        // Finalize and download
        const fileName = `Escala_${format(currentMonth, 'MMMM_yyyy', { locale: ptBR })}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // Determine header based on visible data
    // If all visible items belong to the same Site, use that as header
    const uniqueSites = Array.from(new Set(data.map(d => d.siteName)));
    const printHeaderTitle = uniqueSites.length === 1 ? uniqueSites[0] : "Quadro Geral de Lotação";


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
                    <Button variant="outline" size="sm" onClick={() => handlePrint && handlePrint()} className="mr-4 bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100">
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir / PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport} className="mr-4 bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
                        <Download className="w-4 h-4 mr-2" />
                        Exportar Excel
                    </Button>
                    <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
                    <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
                </div>
            </div>

            {/* Grid Container */}
            <div className="overflow-x-auto" ref={printRef}>
                {/* Print Only Header */}
                <div className="hidden print:block p-4 mb-4 text-center border-b">
                    <h1 className="text-2xl font-bold uppercase">{printHeaderTitle}</h1>
                    <p className="text-sm text-gray-500">Mês de Referência: {format(currentMonth, 'MMMM/yyyy', { locale: ptBR })}</p>
                </div>

                <table className="w-full border-collapse text-xs">
                    <thead>
                        <tr className="bg-slate-100 print:bg-gray-100">
                            <th className="sticky left-0 z-10 bg-slate-100 p-2 border text-left min-w-[200px] shadow-[2px_0_5px_rgba(0,0,0,0.05)] print:bg-white print:shadow-none">
                                Colaborador / Site
                            </th>
                            {days.map(day => (
                                <th
                                    key={day.toISOString()}
                                    className={`p-1 border text-center min-w-[30px] ${isWeekend(day) ? 'bg-slate-200 print:bg-gray-200' : ''}`}
                                >
                                    <div className="font-bold">{format(day, 'd')}</div>
                                    <div className="text-[9px] uppercase">{format(day, 'eee', { locale: ptBR }).charAt(0)}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item) => (
                            <RosterRow
                                key={item.id}
                                item={item}
                                days={days}
                                overrides={overrides}
                                onToggle={(date, status) => handleToggle(item.postoId, date, status)}
                            />
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
                <div className="flex items-center gap-2 ml-auto">
                    <span className="text-amber-600 font-semibold">* Células com borda amarela indicam alteração manual. Clique para alterar.</span>
                </div>
            </div>
        </div>
    );
}
