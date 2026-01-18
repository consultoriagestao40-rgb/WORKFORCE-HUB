
import { addDays, isWeekend, isSameDay } from "date-fns";

// Lista de feriados fixos nacionais (Brasil)
const FIXED_HOLIDAYS = [
    "01-01", // Confraternização Universal
    "04-21", // Tiradentes
    "05-01", // Dia do Trabalho
    "09-07", // Independência
    "10-12", // N. Sra. Aparecida
    "11-02", // Finados
    "11-15", // Proclamação da República
    "11-20", // Dia da Consciência Negra (nacional desde 2024)
    "12-25", // Natal
];

export function isHoliday(date: Date): boolean {
    const dateString = date.toISOString().slice(5, 10); // MM-DD
    return FIXED_HOLIDAYS.includes(dateString);
}

export function addBusinessDays(startDate: Date, days: number): Date {
    let currentDate = new Date(startDate);
    let addedDays = 0;

    // Se a data inicial já for fds/feriado, avançamos para o próximo dia útil antes de começar a contar?
    // Geralmente em SLA, se abre no sábado, o "D1" começa segunda.
    // Mas a lógica simples de soma:

    while (addedDays < days) {
        currentDate = addDays(currentDate, 1);

        // Pula fins de semana e feriados
        if (!isWeekend(currentDate) && !isHoliday(currentDate)) {
            addedDays++;
        }
    }

    // Se caiu num fds/feriado após somar (ex: sla 0 mas data inicial era sabado), avança
    // Mas slaDays representam dias DE TRABALHO a somar. Se sla for 0, é "hoje" ou proximo dia util?
    // Vamos assumir que addBusinessDays(sabado, 0) = sabado? Ou segunda?
    // Para vencimento, se vence no sábado, joga pra segunda.

    while (isWeekend(currentDate) || isHoliday(currentDate)) {
        currentDate = addDays(currentDate, 1);
    }

    return currentDate;
}
