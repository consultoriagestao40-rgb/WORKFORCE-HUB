/**
 * Regras para gerar o horário de uma batida incluída manualmente (ajuste de ponto)
 * a partir do horário cadastrado no Secullum, evitando "horário britânico" (ex: 22:00 cravado).
 *
 * - Entradas: alguns minutos ANTES do previsto (não gera atraso/falta)
 * - Saídas:   alguns minutos DEPOIS do previsto (não gera saída antecipada/falta)
 * - Nunca usa variação zero.
 */

export const PUNCH_VARIATION_MIN = 1;
export const PUNCH_VARIATION_MAX = 7;

export const PUNCH_TYPE_TO_SECULLUM_COLUMN: Record<string, string> = {
    ENTRADA_1: "Entrada1",
    SAIDA_1: "Saida1",
    ENTRADA_2: "Entrada2",
    SAIDA_2: "Saida2",
    ENTRADA_3: "Entrada3",
    SAIDA_3: "Saida3"
};

function toMinutes(hhmm: string): number | null {
    const m = /^(\d{1,2}):(\d{2})/.exec((hhmm || "").trim());
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function toHHMM(totalMinutes: number): string {
    const t = ((totalMinutes % 1440) + 1440) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/**
 * Gera o horário "humanizado" para a batida.
 * @param scheduled horário previsto (HH:mm) cadastrado no Secullum
 * @param isEntry   true para Entrada, false para Saída
 * @param rand      gerador aleatório (injetável para testes)
 */
export function humanizePunchTime(scheduled: string, isEntry: boolean, rand: () => number = Math.random): string | null {
    const base = toMinutes(scheduled);
    if (base === null) return null;

    const span = PUNCH_VARIATION_MAX - PUNCH_VARIATION_MIN + 1;
    let variation = PUNCH_VARIATION_MIN + Math.floor(rand() * span);

    if (isEntry) {
        // Não deixar uma entrada logo após a meia-noite "voltar" para o dia anterior
        if (base > 0 && base - variation < 0) variation = Math.max(1, base);
        return toHHMM(base - (base === 0 ? 0 : variation));
    }

    // Não deixar uma saída logo antes da meia-noite "virar" o dia
    if (base + variation >= 1440) variation = Math.max(0, 1439 - base);
    return toHHMM(base + variation);
}

/** Data (YYYY-MM-DD) e dia da semana (0=Domingo) no fuso de São Paulo */
export function spDateParts(date: Date): { dateStr: string; weekday: number } {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric", month: "2-digit", day: "2-digit", weekday: "short"
    }).formatToParts(date);
    const get = (t: string) => parts.find(p => p.type === t)?.value || "";
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { dateStr: `${get("year")}-${get("month")}-${get("day")}`, weekday: weekdayMap[get("weekday")] ?? date.getDay() };
}
