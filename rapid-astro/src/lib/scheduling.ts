import { startOfMonth, endOfMonth, eachDayOfInterval, differenceInCalendarDays, addDays, getDay } from 'date-fns';

export type ScheduleType = '12x36' | '6x1' | '5x2' | 'SD' | 'SN'; // SD=Service Day (Diurno), SN=Service Night (Noturno) generic

export interface DayStatus {
    date: Date;
    status: 'Trabalho' | 'Folga';
}

export function generateRoster(
    scheduleType: string,
    startDate: Date,
    days: Date[]
): DayStatus[] {

    // Normalize schedule name: remove spaces and lowercase
    const normalizedSchedule = scheduleType.replace(/\s+/g, '').toLowerCase();

    // Clone start date to avoid mutation
    const pivotDate = new Date(startDate);
    pivotDate.setHours(0, 0, 0, 0);

    return days.map(date => {
        let status: 'Trabalho' | 'Folga' = 'Trabalho';

        // Clone current date check
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        const diffDays = differenceInCalendarDays(checkDate, pivotDate);

        // 1. Fixed Weekly Schedules (Seg a Sex, Seg a Sab)
        // These rely on the day of the week (0=Sun, 1=Mon, ..., 6=Sat)
        const dayOfWeek = getDay(date); // 0 (Sun) to 6 (Sat)

        if (normalizedSchedule.includes('segasex') || normalizedSchedule.includes('mondaytofriday')) {
            // Work: Mon(1) - Fri(5). Off: Sat(6), Sun(0)
            if (dayOfWeek === 0 || dayOfWeek === 6) status = 'Folga';
        }
        else if (normalizedSchedule.includes('segasab') || normalizedSchedule.includes('mondaytosaturday')) {
            // Work: Mon(1) - Sat(6). Off: Sun(0)
            if (dayOfWeek === 0) status = 'Folga';
        }

        // 2. Rolling Schedules (6x1, 5x2, 4x2, 12x36)
        // These rely on days since start date
        else if (normalizedSchedule.includes('12x36')) {
            if (normalizedSchedule.includes('par')) {
                // Work on Even calendar Days
                if (date.getDate() % 2 !== 0) status = 'Folga';
            } else if (normalizedSchedule.includes('impar')) {
                // Work on Odd calendar Days
                if (date.getDate() % 2 === 0) status = 'Folga';
            } else {
                // Standard rolling 12x36 from startDate
                // Day 0 = Work, Day 1 = Off, Day 2 = Work...
                if (Math.abs(diffDays) % 2 !== 0) {
                    status = 'Folga';
                }
            }
        } else if (normalizedSchedule.includes('5x1')) {
            // 5 work, 1 off. Cycle of 6.
            const cycleDay = ((diffDays % 6) + 6) % 6;
            if (cycleDay === 5) {
                status = 'Folga';
            }
        } else if (normalizedSchedule.includes('6x1')) {
            // 6 days work, 1 day off. Cycle of 7.
            const cycleDay = ((diffDays % 7) + 7) % 7;
            if (cycleDay === 6) {
                status = 'Folga';
            }
        } else if (normalizedSchedule.includes('5x2')) {
            // 5 days work, 2 days off. Cycle of 7.
            const cycleDay = ((diffDays % 7) + 7) % 7;
            if (cycleDay >= 5) {
                status = 'Folga';
            }
        } else if (normalizedSchedule.includes('4x2')) {
            // 4 days work, 2 days off. Cycle of 6.
            const cycleDay = ((diffDays % 6) + 6) % 6;
            if (cycleDay >= 4) { // Days 4 and 5 are off
                status = 'Folga';
            }
        }
        // Admin or Custom schedules might default to Trabajo (Mon-Fri) logic later if needed
        // For now, unmatched schedules default to 'Trabalho' as seen in "Seg a Sex" usually implies work. 
        // Ideally we should handle weekends for standard schedules if not specified.

        return { date, status };
    });
}
