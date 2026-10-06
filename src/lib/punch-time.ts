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

export function toMinutes(hhmm: string): number | null {
    const m = /^(\d{1,2}):(\d{2})/.exec((hhmm || "").trim());
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function toHHMM(totalMinutes: number): string {
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

const ALL_COLUMNS = ["Entrada1", "Saida1", "Entrada2", "Saida2", "Entrada3", "Saida3"] as const;

export type PlannedPunch = { coluna: string; hora: string; previsto: string };

/**
 * Converte a escolha do gestor (Só Entrada / Só Saída / Intervalo / Dia Completo) nas batidas a incluir.
 * - Usa o horário cadastrado no Secullum para o dia (scheduleDay)
 * - Não inclui colunas que já possuem batida (existing)
 * - Intervalo: a volta mantém a mesma duração de intervalo cadastrada (nunca encurta o intervalo)
 */
export function planPunches(params: {
    scheduleDay: Record<string, any> | null | undefined;
    scope: string | null | undefined;     // ENTRADA | SAIDA | INTERVALO | TODOS | null
    fallbackColumn?: string | null;       // coluna da ocorrência original (quando não há escopo)
    existing?: Record<string, string | null | undefined>;
    rand?: () => number;
}): { punches: PlannedPunch[]; skipped: string[]; error?: string } {
    const day = params.scheduleDay || {};
    const existing = params.existing || {};
    const rand = params.rand || Math.random;
    const sched = (c: string): string | null => (typeof day[c] === "string" && /^\d{1,2}:\d{2}/.test(day[c]) ? day[c] : null);

    let columns: string[] = [];
    switch (params.scope) {
        case "ENTRADA":
            columns = ["Entrada1"];
            break;
        case "SAIDA": {
            const lastExit = ["Saida3", "Saida2", "Saida1"].find(c => sched(c));
            columns = lastExit ? [lastExit] : [];
            break;
        }
        case "INTERVALO":
            if (!sched("Saida1") || !sched("Entrada2")) {
                return { punches: [], skipped: [], error: "O horário cadastrado no Secullum não possui intervalo para este dia." };
            }
            columns = ["Saida1", "Entrada2"];
            break;
        case "TODOS":
            columns = ALL_COLUMNS.filter(c => sched(c));
            break;
        default:
            columns = params.fallbackColumn ? [params.fallbackColumn] : [];
    }

    columns = columns.filter(c => sched(c));
    if (columns.length === 0) {
        return { punches: [], skipped: [], error: "O horário cadastrado no Secullum não possui essas marcações para este dia da semana." };
    }

    const skipped = columns.filter(c => !!existing[c]);
    const toInsert = columns.filter(c => !existing[c]);
    const punches: PlannedPunch[] = [];
    const chosen: Record<string, string> = {};

    for (const coluna of toInsert) {
        const previsto = sched(coluna)!;
        let hora: string | null = null;

        // Volta do intervalo (Entrada2/Entrada3): mantém a duração cadastrada a partir da saída real/gerada
        const prevExit = coluna === "Entrada2" ? "Saida1" : coluna === "Entrada3" ? "Saida2" : null;
        if (prevExit) {
            const exitTime = chosen[prevExit] || existing[prevExit] || null;
            const sExit = toMinutes(sched(prevExit) || "");
            const sBack = toMinutes(previsto);
            const real = toMinutes(exitTime || "");
            if (exitTime && sExit !== null && sBack !== null && real !== null) {
                const duration = ((sBack - sExit) % 1440 + 1440) % 1440;
                hora = toHHMM(real + duration);
            }
        }

        if (!hora) hora = humanizePunchTime(previsto, coluna.startsWith("Entrada"), rand);
        if (!hora) continue;
        chosen[coluna] = hora;
        punches.push({ coluna, hora, previsto });
    }

    return { punches, skipped };
}
