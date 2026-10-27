import { prisma } from "@/lib/db";
import { generateRoster } from "@/lib/scheduling";
import { getContractStart } from "@/lib/contract-start";

/**
 * Fonte única da verdade para "como ficou cada posto em cada dia".
 * Replica exatamente a regra da tela Presença Diária (/api/client/attendance):
 * quando não há lançamento de presença, o status é derivado da escala (folga, aguardando ou FALTA/posto vago).
 * Assim Presença Diária, Relatório Mensal, Faturamento e Medição mostram os mesmos números.
 */

export interface PostoDayRow {
    id: string;                 // id do Attendance, ou "v:<postoId>:<YYYY-MM-DD>" quando derivado da escala
    virtual: boolean;           // true = sem lançamento no banco (derivado)
    dateKey: string;            // YYYY-MM-DD
    date: Date;                 // UTC 00:00
    postoId: string;
    clientId: string;
    clientName: string;
    roleName: string;
    employeeName: string;
    status: string;             // PRESENTE_PONTO | PRESENTE_MANUAL | FALTA | FOLGA | AGUARDANDO
    clockInTime: Date | null;
    coveredByName: string | null;
    coveredById: string | null;
    coverageType: string | null;
    notes: string | null;
    billingValue: number;
}

export function isUncoveredAbsence(r: { status: string; coveredByName: string | null; coveredById?: string | null; coverageType: string | null }) {
    return r.status === "FALTA" && !r.coveredByName && !r.coveredById && r.coverageType !== "DIARISTA";
}

export function brazilNow() {
    return new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function getPostoDays(
    clientIds: string[],
    from: Date, // UTC 00:00 do primeiro dia
    to: Date,   // UTC 00:00 do último dia
    opts: { notBefore?: Date } = {} // não considerar dias anteriores (início do contrato)
): Promise<PostoDayRow[]> {
    const nowBr = brazilNow();
    const todayStr = dayKey(nowBr);

    const postos = await prisma.posto.findMany({
        where: { clientId: { in: clientIds }, client: { monitorInOperations: true } },
        include: {
            client: { select: { id: true, name: true } },
            role: { select: { name: true } },
            assignments: {
                where: { startDate: { lte: to }, OR: [{ endDate: null }, { endDate: { gte: from } }] },
                include: { employee: { select: { name: true } } },
                orderBy: { startDate: "desc" },
            },
            attendances: {
                where: { date: { gte: from, lte: to } },
                include: { employee: { select: { name: true } }, coveredBy: { select: { name: true } } },
            },
        },
    });

    const overrides = await prisma.scheduleOverride.findMany({
        where: { date: { gte: from, lt: new Date(to.getTime() + 24 * 60 * 60 * 1000) } },
    });
    const overrideMap = new Map(overrides.map(o => [`${o.postoId}:${dayKey(o.date)}`, o]));

    const rows: PostoDayRow[] = [];
    const lastDay = to.getTime() < nowBr.getTime() ? to : new Date(todayStr + "T00:00:00Z");

    for (const posto of postos as any[]) {
        const attByDay = new Map<string, any>();
        posto.attendances.forEach((a: any) => attByDay.set(dayKey(a.date), a));
        const createdKey = dayKey(posto.createdAt);
        const endedKey = posto.endedAt ? dayKey(posto.endedAt) : null;

        for (let t = from.getTime(); t <= lastDay.getTime(); t += 24 * 60 * 60 * 1000) {
            const targetDate = new Date(t);
            const key = dayKey(targetDate);
            if (opts.notBefore && targetDate < opts.notBefore) continue;

            const attendance = attByDay.get(key);
            const isToday = key === todayStr;

            if (attendance) {
                rows.push({
                    id: attendance.id, virtual: false, dateKey: key, date: targetDate,
                    postoId: posto.id, clientId: posto.client.id, clientName: posto.client.name, roleName: posto.role?.name || "-",
                    employeeName: attendance.employee?.name || "Vaga em Aberto",
                    status: attendance.status, clockInTime: attendance.clockInTime,
                    coveredByName: attendance.coveredBy?.name || null, coveredById: attendance.coveredById || null,
                    coverageType: attendance.coverageType || null, notes: attendance.notes || null,
                    billingValue: posto.billingValue,
                });
                continue;
            }

            // Sem lançamento: não contar dias em que o posto ainda não existia / já foi encerrado
            if (key < createdKey) continue;
            if (endedKey && key > endedKey) continue;

            const assignment = posto.assignments.find((a: any) => new Date(a.startDate) <= targetDate && (!a.endDate || new Date(a.endDate) >= targetDate));
            const employee = assignment?.employee || null;

            let isWorkingToday = true;
            const override = overrideMap.get(`${posto.id}:${key}`);
            if (override) {
                isWorkingToday = !override.isDayOff;
            } else if (!assignment) {
                const dayOfWeek = targetDate.getDay();
                const norm = String(posto.schedule || "").replace(/\s+/g, "").toLowerCase();
                if (norm.includes("segasex") || norm.includes("mondaytofriday")) {
                    if (dayOfWeek === 0 || dayOfWeek === 6) isWorkingToday = false;
                }
                if (norm.includes("segasab") || norm.includes("mondaytosaturday")) {
                    if (dayOfWeek === 0) isWorkingToday = false;
                }
            } else {
                const roster = generateRoster(posto.schedule, new Date(assignment.startDate), [targetDate]);
                isWorkingToday = roster[0]?.status === "Trabalho";
            }

            let status = "AGUARDANDO";
            if (!isWorkingToday) {
                status = "FOLGA";
            } else if (employee) {
                const [sh, sm] = posto.startTime.split(":").map(Number);
                const [eh, em] = posto.endTime.split(":").map(Number);
                const shiftStart = new Date(targetDate.getTime() + 3 * 60 * 60 * 1000);
                shiftStart.setHours(sh, sm, 0, 0);
                const shiftEnd = new Date(targetDate.getTime() + 3 * 60 * 60 * 1000);
                shiftEnd.setHours(eh, em, 0, 0);
                if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

                if (isToday) {
                    if (nowBr > shiftEnd) status = "FALTA";
                } else if (nowBr > shiftStart) {
                    status = "FALTA";
                }
            } else {
                status = "FALTA";
            }

            rows.push({
                id: `v:${posto.id}:${key}`, virtual: true, dateKey: key, date: targetDate,
                postoId: posto.id, clientId: posto.client.id, clientName: posto.client.name, roleName: posto.role?.name || "-",
                employeeName: employee?.name || "Vaga em Aberto",
                status, clockInTime: null, coveredByName: null, coveredById: null, coverageType: null, notes: null,
                billingValue: posto.billingValue,
            });
        }
    }

    return rows;
}

/** Linhas por posto/dia do ano + decisões de abono + início do contrato (usado nos totais de faturamento). */
export async function getBillingDayRows(clientIds: string[], year: number) {
    const contractStart = await getContractStart(clientIds);
    const rows = await getPostoDays(clientIds, new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year, 11, 31)), { notBefore: contractStart.date });
    const decisions = await prisma.billingGlosaDecision.findMany({
        where: { clientId: { in: clientIds }, decision: "ABONO", dateKey: { startsWith: String(year) } },
        select: { postoId: true, dateKey: true },
    });
    const abono = new Set(decisions.map(d => `${d.postoId}:${d.dateKey}`));
    return { rows, abono, contractStart };
}
