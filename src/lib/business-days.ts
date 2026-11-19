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
    "11-20", // Dia da Consciência Negra (Feriado Nacional Lei 14.759/2023)
    "12-25", // Natal
];

// Feriados Municipais e Estaduais comuns da sede e contratos (Curitiba/PR, Pinhais, Araucária, etc.)
// Curitiba: 08-09 (N. Sra. da Luz dos Pinhais)
const MUNICIPAL_REGIONAL_HOLIDAYS: Record<string, string[]> = {
    "CURITIBA": ["09-08"], // 8 de Setembro - Padroeira de Curitiba
    "LONDRINA": ["12-10"], // 10 de Dezembro - Aniversário de Londrina
    "PONTA GROSSA": ["09-15"], // 15 de Setembro - Padroeira
    "MARINGA": ["05-10"], // 10 de Maio - Aniversário de Maringá
};

// Cache de feriados da BrasilAPI em memória
let holidaysApiCache: { [year: number]: { dates: Set<string>; lastFetch: number } } = {};

/** Busca feriados nacionais atualizados da BrasilAPI (com fallback seguro para tabela fixa) */
export async function getHolidaysForYear(year: number): Promise<Set<string>> {
    const cached = holidaysApiCache[year];
    const now = Date.now();
    // Cache de 24 horas
    if (cached && now - cached.lastFetch < 24 * 60 * 60 * 1000) {
        return cached.dates;
    }

    const holidaySet = new Set<string>();
    // Preenche com os feriados fixos
    FIXED_HOLIDAYS.forEach(h => holidaySet.add(`${year}-${h}`));

    try {
        const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, {
            headers: { "User-Agent": "WorkForceHub/1.0" },
            next: { revalidate: 86400 } // cache Next.js de 1 dia
        });
        if (res.ok) {
            const data: Array<{ date: string; name: string }> = await res.json();
            data.forEach(item => {
                if (item.date) holidaySet.add(item.date);
            });
        }
    } catch (err) {
        console.warn(`[getHolidaysForYear] Falha ao consultar BrasilAPI para o ano ${year}, utilizando lista fixa:`, err);
    }

    holidaysApiCache[year] = { dates: holidaySet, lastFetch: now };
    return holidaySet;
}

/** Verifica de forma síncrona se a data é feriado (com base na data local de SP) */
export function isHoliday(date: Date | string | null | undefined, city?: string | null): boolean {
    if (!date) return false;
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;

    // Converter para representação local (YYYY-MM-DD e MM-DD)
    const year = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const fullDate = `${year}-${mm}-${dd}`;
    const monthDay = `${mm}-${dd}`;

    // 1. Feriados fixos nacionais
    if (FIXED_HOLIDAYS.includes(monthDay)) {
        return true;
    }

    // 2. Feriados da API em cache
    if (holidaysApiCache[year]?.dates?.has(fullDate)) {
        return true;
    }

    // 3. Feriados municipais específicos se informado
    if (city) {
        const normCity = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        for (const [key, dates] of Object.entries(MUNICIPAL_REGIONAL_HOLIDAYS)) {
            if (normCity.includes(key) && dates.includes(monthDay)) {
                return true;
            }
        }
    }

    return false;
}

/** Verifica se um dia é dia útil (não é sábado, nem domingo, nem feriado) */
export function isBusinessDay(date: Date, city?: string | null): boolean {
    const day = date.getDay();
    if (day === 0 || day === 6) return false; // 0 = Domingo, 6 = Sábado
    return !isHoliday(date, city);
}

/** 
 * Calcula o vencimento de SLA em horas úteis considerando apenas dias úteis
 * (Pula fins de semana, feriados nacionais da API e feriados municipais).
 * Ex: Chamado aberto na quinta às 14h com SLA de 24h (1 dia útil),
 * se sexta for feriado nacional (20/11), o prazo final cai na segunda-feira (23/11) às 14h.
 */
export async function calculateBusinessDueAt(
    startDate: Date, 
    slaHours: number,
    city?: string | null
): Promise<Date> {
    const start = new Date(startDate);
    const year = start.getFullYear();
    
    // Assegura feriados carregados da BrasilAPI
    await getHolidaysForYear(year);
    await getHolidaysForYear(year + 1);

    // Converte horas em dias úteis inteiros de SLA (24h = 1 dia útil, 48h = 2 dias úteis, etc.)
    // Para horas fracionadas, cada 24h = 1 dia útil
    const businessDaysToAdd = Math.max(1, Math.round(slaHours / 24));

    let currentDate = new Date(start);
    let addedDays = 0;

    // Se o chamado foi aberto num fim de semana ou feriado, avança para o início do próximo dia útil
    while (!isBusinessDay(currentDate, city)) {
        currentDate = addDays(currentDate, 1);
        currentDate.setHours(8, 0, 0, 0); // início do expediente
    }

    // Adiciona os dias úteis
    while (addedDays < businessDaysToAdd) {
        currentDate = addDays(currentDate, 1);
        if (isBusinessDay(currentDate, city)) {
            addedDays++;
        }
    }

    // Se porventura a data final ainda cair num feriado ou final de semana, empurra até o próximo dia útil
    while (!isBusinessDay(currentDate, city)) {
        currentDate = addDays(currentDate, 1);
    }

    return currentDate;
}

export function addBusinessDays(startDate: Date | string | null | undefined, days: number): Date {
    if (!startDate) return new Date();
    let currentDate = new Date(startDate);
    if (isNaN(currentDate.getTime())) return new Date();
    let addedDays = 0;

    // Se a data inicial já for fds/feriado, avançamos para o próximo dia útil antes de começar a contar?
    while (addedDays < days) {
        currentDate = addDays(currentDate, 1);

        // Pula fins de semana e feriados
        if (!isWeekend(currentDate) && !isHoliday(currentDate)) {
            addedDays++;
        }
    }

    // Se caiu num fds/feriado após somar (ex: sla 0 mas data inicial era sabado), avança
    while (isWeekend(currentDate) || isHoliday(currentDate)) {
        currentDate = addDays(currentDate, 1);
    }

    return currentDate;
}
