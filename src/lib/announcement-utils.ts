// Helpers puros (sem prisma) usados pelo cron, pelas server actions e pela tela de Avisos.
// Todas as datas são strings "YYYY-MM-DD" no fuso America/Sao_Paulo.

export const ANNOUNCEMENT_ROLES = [
    { id: "ADMIN", label: "Administradores" },
    { id: "COORD_RH", label: "Coordenação RH" },
    { id: "ASSIST_RH", label: "Assistentes RH" },
    { id: "SUPERVISOR", label: "Supervisores" },
] as const;

export interface AnnouncementScheduleInfo {
    isActive: boolean;
    startDate: string;
    endDate: string;
    intervalDays: number;
    lastSentDate?: string | null;
}

export type AnnouncementStatusKey = "PAUSED" | "SCHEDULED" | "ACTIVE" | "ENDED";

/** Data de hoje (YYYY-MM-DD) no horário de Brasília. */
export function todayInSaoPaulo(now: Date = new Date()): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);
}

function parseYmd(ymd: string): number {
    const [y, m, d] = ymd.split("-").map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
}

export function addDaysYmd(ymd: string, days: number): string {
    const dt = new Date(parseYmd(ymd) + days * 86400000);
    return dt.toISOString().slice(0, 10);
}

export function daysBetweenYmd(from: string, to: string): number {
    return Math.round((parseYmd(to) - parseYmd(from)) / 86400000);
}

export function isValidYmd(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(parseYmd(value));
}

export function formatYmdBr(ymd?: string | null): string {
    if (!ymd) return "-";
    const [y, m, d] = ymd.split("-");
    return `${d}/${m}/${y}`;
}

/** O aviso deve ser enviado hoje? (dentro do período e já passou o intervalo desde o último envio) */
export function isAnnouncementDue(a: AnnouncementScheduleInfo, today: string): boolean {
    if (!a.isActive) return false;
    if (today < a.startDate || today > a.endDate) return false;
    if (!a.lastSentDate) return true;
    return daysBetweenYmd(a.lastSentDate, today) >= Math.max(1, a.intervalDays);
}

/** Próxima data de envio prevista (null se o período acabou). */
export function nextSendDate(a: AnnouncementScheduleInfo, today: string): string | null {
    if (today > a.endDate) return null;
    const base = a.lastSentDate ? addDaysYmd(a.lastSentDate, Math.max(1, a.intervalDays)) : a.startDate;
    let candidate = base < a.startDate ? a.startDate : base;
    if (candidate < today) candidate = today; // atrasado: sai no próximo disparo das 08h
    return candidate > a.endDate ? null : candidate;
}

export function getAnnouncementStatus(a: AnnouncementScheduleInfo, today: string): { key: AnnouncementStatusKey; label: string } {
    if (!a.isActive) return { key: "PAUSED", label: "Pausado" };
    if (today > a.endDate) return { key: "ENDED", label: "Encerrado" };
    if (today < a.startDate) return { key: "SCHEDULED", label: "Agendado" };
    return { key: "ACTIVE", label: "Em andamento" };
}
