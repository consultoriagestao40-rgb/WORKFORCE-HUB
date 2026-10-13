/**
 * Detecção de inconsistências de batida a partir do registro diário do Secullum (/IntegracaoExterna/Batidas).
 *
 * Cada registro diário traz:
 *  - Entrada1..Saida3: o que foi efetivamente registrado (hora "HH:mm" ou texto de justificativa, ex: "AT. MED")
 *  - MemoriaEntrada1..MemoriaSaida3: o horário PREVISTO para aquele dia (escala vigente)
 *  - Folga: dia de folga na escala
 */

export const PUNCH_COLUMNS = ["Entrada1", "Saida1", "Entrada2", "Saida2", "Entrada3", "Saida3"] as const;
export type PunchColumn = (typeof PUNCH_COLUMNS)[number];

export const COLUMN_TO_PUNCH_TYPE: Record<PunchColumn, string> = {
    Entrada1: "ENTRADA_1",
    Saida1: "SAIDA_1",
    Entrada2: "ENTRADA_2",
    Saida2: "SAIDA_2",
    Entrada3: "ENTRADA_3",
    Saida3: "SAIDA_3"
};

export const COLUMN_LABEL: Record<PunchColumn, string> = {
    Entrada1: "Entrada 1",
    Saida1: "Saída 1",
    Entrada2: "Entrada 2",
    Saida2: "Saída 2",
    Entrada3: "Entrada 3",
    Saida3: "Saída 3"
};

export const PUNCH_TYPE_LABEL: Record<string, string> = {
    ENTRADA_1: "Entrada 1",
    SAIDA_1: "Saída 1",
    ENTRADA_2: "Entrada 2",
    SAIDA_2: "Saída 2",
    ENTRADA_3: "Entrada 3",
    SAIDA_3: "Saída 3",
    SEM_BATIDAS: "Dia sem nenhuma batida"
};

/** Texto legível para o campo punchType (aceita lista separada por vírgula ou SEM_BATIDAS) */
export function describePunchType(punchType: string): string {
    if (!punchType) return "";
    if (punchType === "SEM_BATIDAS") return PUNCH_TYPE_LABEL.SEM_BATIDAS;
    return punchType
        .split(",")
        .map(t => PUNCH_TYPE_LABEL[t.trim()] || t.trim())
        .join(", ");
}

const isTime = (v: unknown): v is string => typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v.trim());
const isFilled = (v: unknown) => typeof v === "string" && v.trim().length > 0;

export type DayInconsistency = {
    kind: "SEM_BATIDAS" | "INCOMPLETA";
    expected: Partial<Record<PunchColumn, string>>; // horário previsto por coluna
    actual: Partial<Record<PunchColumn, string>>;   // o que está no cartão (hora ou texto)
    missing: PunchColumn[];
    workedOnDayOff: boolean;
};

/**
 * Horário previsto do dia (colunas posicionais Entrada1..Saida3) a partir dos campos Memoria* do registro diário.
 * Ignora os "00:00" de escalas sem intervalo.
 */
export function expectedScheduleFromBatida(b: Record<string, any> | null | undefined): Partial<Record<PunchColumn, string>> {
    if (!b) return {};
    const raw: Partial<Record<PunchColumn, string>> = {};
    for (const c of PUNCH_COLUMNS) {
        const mem = b[`Memoria${c}`];
        if (isTime(mem)) raw[c] = mem.trim();
    }
    for (const [s, e] of [["Saida1", "Entrada2"], ["Saida2", "Entrada3"], ["Entrada3", "Saida3"]] as Array<[PunchColumn, PunchColumn]>) {
        if (raw[s] === "00:00" && raw[e] === "00:00") { delete raw[s]; delete raw[e]; }
    }
    const out: Partial<Record<PunchColumn, string>> = {};
    PUNCH_COLUMNS.filter(c => raw[c]).forEach((c, i) => { out[PUNCH_COLUMNS[i]] = raw[c]; });
    return out;
}

import { toMinutes, toHHMM } from "./punch-time";

/**
 * Analisa um registro diário do Secullum. Retorna null quando o dia está consistente
 * (completo, folga sem batidas, justificado, sem escala para comparar, etc.).
 */
export function analyzeBatidaDay(b: Record<string, any>): DayInconsistency | null {
    const actual: Partial<Record<PunchColumn, string>> = {};
    for (const c of PUNCH_COLUMNS) {
        if (isFilled(b[c])) actual[c] = String(b[c]).trim();
    }

    // Dia já tratado no Secullum (ajuste/abono de horas lançado)
    if (isFilled(b.Ajuste) || isFilled(b.Abono2) || isFilled(b.Abono3) || isFilled(b.Abono4)) return null;

    const hasAnyActual = Object.keys(actual).length > 0;
    const isDayOff = b.Folga === true;

    // O Secullum preenche as colunas na ORDEM das batidas (1ª batida = Entrada1, 2ª = Saida1, ...).
    // Por isso a comparação é posicional: a N-ésima marcação prevista corresponde à N-ésima coluna do cartão.
    const positionalExpected = expectedScheduleFromBatida(b);
    const expectedTimes = PUNCH_COLUMNS.filter(c => positionalExpected[c]);

    const lastFilledIdx = PUNCH_COLUMNS.reduce((acc, c, i) => (actual[c] ? i : acc), -1);

    // Folga ou dia sem escala: só é inconsistência se houver batida "sem par" (ex: entrou e não saiu)
    if (isDayOff || expectedTimes.length === 0) {
        if (!hasAnyActual) return null;
        const target = lastFilledIdx + 1 + ((lastFilledIdx + 1) % 2); // arredonda para número par de colunas
        const missing = PUNCH_COLUMNS.slice(0, target).filter(c => !actual[c]);
        if (!missing.length) return null;
        return { kind: "INCOMPLETA", expected: positionalExpected, actual, missing, workedOnDayOff: isDayOff };
    }

    if (b.Neutro === true && !hasAnyActual) return null;

    // Dia de trabalho: as N primeiras colunas (N = marcações previstas) precisam ter batida ou justificativa.
    // Batidas extras em número ímpar também indicam marcação faltando.
    let target = expectedTimes.length;
    if (lastFilledIdx + 1 > target) target = lastFilledIdx + 1 + ((lastFilledIdx + 1) % 2);
    let missing = PUNCH_COLUMNS.slice(0, Math.min(target, PUNCH_COLUMNS.length)).filter(c => !actual[c]);
    if (!missing.length) return null;

    // --- DETECÇÃO INTELIGENTE DE BATIDA DESLOCADA (ESQUECEU VOLTA DO ALMOÇO) ---
    // Caso clássico: escala prevê 4 batidas (E1, S1, E2, S2).
    // O colaborador registrou E1, S1 (saída pro almoço) e foi embora batendo o ponto no fim da tarde.
    // O relógio alocou a 3ª batida em Entrada2 (ex: 19:06) e Saida2 ficou vazia.
    // Se a 3ª batida está muito distante da saída pro almoço (> 2h30) e próxima do fim da jornada,
    // a marcação faltante REAL é o Retorno do Intervalo (Entrada2), e a batida em Entrada2 é na verdade a Saída!
    const effectiveExpected = { ...positionalExpected };
    if (
        actual.Entrada1 &&
        actual.Saida1 &&
        actual.Entrada2 &&
        !actual.Saida2 &&
        positionalExpected.Saida2 &&
        isTime(actual.Saida1) &&
        isTime(actual.Entrada2)
    ) {
        const mSaida1 = toMinutes(actual.Saida1);
        const mEntrada2 = toMinutes(actual.Entrada2);
        const mSchedSaida2 = toMinutes(positionalExpected.Saida2);

        if (mSaida1 !== null && mEntrada2 !== null) {
            const diffIntervalo = ((mEntrada2 - mSaida1) % 1440 + 1440) % 1440;
            const diffSaida = mSchedSaida2 !== null ? Math.abs(mEntrada2 - mSchedSaida2) : 999;

            // Se o intervalo entre Saida1 e a batida em Entrada2 for maior que 2h30 (150 min)
            // ou se a batida em Entrada2 for muito próxima do horário previsto de saída (dentro de 120 min)
            if (diffIntervalo > 150 || diffSaida <= 120) {
                // A batida faltante é a volta do intervalo (Entrada2).
                // Calculamos a volta mantendo o tempo padrão de almoço da escala (ou 1h por padrão)
                let duracaoAlmoco = 60;
                if (positionalExpected.Saida1 && positionalExpected.Entrada2) {
                    const s1 = toMinutes(positionalExpected.Saida1);
                    const e2 = toMinutes(positionalExpected.Entrada2);
                    if (s1 !== null && e2 !== null && e2 > s1) duracaoAlmoco = e2 - s1;
                }
                effectiveExpected.Entrada2 = toHHMM(mSaida1 + duracaoAlmoco);
                missing = ["Entrada2"];
            }
        }
    }

    return {
        kind: hasAnyActual ? "INCOMPLETA" : "SEM_BATIDAS",
        expected: effectiveExpected,
        actual,
        missing,
        workedOnDayOff: false
    };
}


export type AutoIntervalPlan = {
    /** Trocas de coluna (ordem de execução) para reposicionar batidas já existentes */
    moves: Array<{ from: PunchColumn; to: PunchColumn }>;
    /** Batidas de intervalo a lançar (já com horário definido) */
    punches: Array<{ coluna: PunchColumn; hora: string }>;
    summary: string;
};

/**
 * Planeja o ajuste AUTOMÁTICO do intervalo (Saída 1 / Entrada 2) quando o colaborador tem a entrada e a
 * saída final coerentes com a escala e faltam as duas batidas do intervalo (ou só uma delas).
 *
 * Só atua em escala de 4 marcações (E1,S1,E2,S2) sem virada de dia. Em qualquer dúvida devolve null
 * (o caso segue o fluxo normal de tratativa pelo gestor).
 */
export function planAutoIntervalFix(
    actual: Partial<Record<PunchColumn, string>>,
    expected: Partial<Record<PunchColumn, string>>,
    rand: () => number = Math.random
): AutoIntervalPlan | null {
    const eE1 = toMinutes(expected.Entrada1 || "");
    const eS1 = toMinutes(expected.Saida1 || "");
    const eE2 = toMinutes(expected.Entrada2 || "");
    const eS2 = toMinutes(expected.Saida2 || "");
    if (eE1 === null || eS1 === null || eE2 === null || eS2 === null) return null;
    if (expected.Entrada3 || expected.Saida3) return null;
    if (!(eE1 < eS1 && eS1 < eE2 && eE2 < eS2)) return null;

    if (actual.Entrada3 || actual.Saida3) return null;
    const filled = PUNCH_COLUMNS.filter(c => actual[c]);
    if (filled.length < 2 || filled.length > 3) return null;
    if (!filled.every(c => isTime(actual[c]))) return null;
    const times = filled.map(c => toMinutes(actual[c]!) as number);
    for (let i = 1; i < times.length; i++) if (times[i] <= times[i - 1]) return null;

    const first = times[0];
    const last = times[times.length - 1];
    if (Math.abs(first - eE1) > 90 || Math.abs(last - eS2) > 120) return null;

    const targets: PunchColumn[] = ["Entrada1"];
    let s1: number | null = null;
    let e2: number | null = null;
    if (filled.length === 3) {
        const mid = times[1];
        const dS1 = Math.abs(mid - eS1);
        const dE2 = Math.abs(mid - eE2);
        if (Math.min(dS1, dE2) > 90) return null;
        if (dS1 <= dE2) { targets.push("Saida1"); s1 = mid; } else { targets.push("Entrada2"); e2 = mid; }
    }
    targets.push("Saida2");

    // Trocas necessárias (só move para coluna vazia)
    const current = new Map<PunchColumn, PunchColumn>(); // coluna atual -> coluna alvo
    filled.forEach((c, i) => { if (c !== targets[i]) current.set(c, targets[i]); });
    const occupied = new Set<PunchColumn>(filled);
    const moves: AutoIntervalPlan["moves"] = [];
    let guard = 0;
    while (current.size > 0 && guard++ < 10) {
        let progressed = false;
        for (const [from, to] of Array.from(current.entries())) {
            if (!occupied.has(to)) {
                moves.push({ from, to });
                occupied.delete(from);
                occupied.add(to);
                current.delete(from);
                progressed = true;
            }
        }
        if (!progressed) return null;
    }

    const duration = Math.max(30, eE2 - eS1);
    const variation = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

    if (s1 === null && e2 === null) {
        s1 = eS1 + variation(1, 7);
        e2 = s1 + duration;
    } else if (e2 === null && s1 !== null) {
        e2 = s1 + duration;
    } else if (s1 === null && e2 !== null) {
        s1 = e2 - duration - variation(1, 5);
    }
    if (s1 === null || e2 === null) return null;
    // Coerência cronológica: entrada < saída p/ intervalo < retorno < saída final
    if (!(first + 30 < s1 && s1 < e2 && e2 + 30 < last)) return null;

    const punches: AutoIntervalPlan["punches"] = [];
    if (!targets.includes("Saida1")) punches.push({ coluna: "Saida1", hora: toHHMM(s1) });
    if (!targets.includes("Entrada2")) punches.push({ coluna: "Entrada2", hora: toHHMM(e2) });
    if (punches.length === 0) return null;

    return {
        moves,
        punches,
        summary: punches.map(p => `${COLUMN_LABEL[p.coluna]} ${p.hora}`).join(" | ")
    };
}
