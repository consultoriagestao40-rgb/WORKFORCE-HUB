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
    const missing = PUNCH_COLUMNS.slice(0, Math.min(target, PUNCH_COLUMNS.length)).filter(c => !actual[c]);
    if (!missing.length) return null;

    return {
        kind: hasAnyActual ? "INCOMPLETA" : "SEM_BATIDAS",
        expected: positionalExpected,
        actual,
        missing,
        workedOnDayOff: false
    };
}

