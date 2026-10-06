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

