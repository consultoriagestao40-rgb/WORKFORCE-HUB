import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay, eachDayOfInterval, format } from "date-fns";
import { generateRoster } from "@/lib/scheduling";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const startStr = searchParams.get("startDate");
        const endStr = searchParams.get("endDate");

        if (!startStr || !endStr) {
            return NextResponse.json({ error: "Parâmetros startDate e endDate são obrigatórios" }, { status: 400 });
        }

        const startDate = startOfDay(new Date(startStr + "T00:00:00Z"));
        const endDate = endOfDay(new Date(endStr + "T23:59:59Z"));

        // 1. Buscar todas as batidas e registros de presença no período
        const attendances = await prisma.attendance.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                posto: {
                    include: {
                        client: true,
                        role: true
                    }
                },
                employee: true,
                coveredBy: true
            }
        });

        // 2. Buscar todos os postos com alocações válidas no período para calcular a expectativa de escala
        const postos = await prisma.posto.findMany({
            include: {
                client: {
                    include: { company: true }
                },
                role: true,
                assignments: {
                    where: {
                        OR: [
                            { endDate: null },
                            { endDate: { gte: startDate } }
                        ],
                        startDate: { lte: endDate }
                    },
                    include: { employee: true }
                }
            }
        });

        // 3. Buscar todos os overrides de escala no período
        const overrides = await prisma.scheduleOverride.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });

        // 4. Expandir os dias e calcular os plantões esperados vs vagas
        const daysInRange = eachDayOfInterval({ start: startDate, end: endDate });
        let totalExpectedShifts = 0;
        let totalVacantDays = 0;

        // Tabelas temporárias de contagem
        const vacantDaysByPostoMap = new Map<string, { label: string; role: string; client: string; count: number }>();
        const vacantDaysByRoleMap = new Map<string, { name: string; count: number }>();

        // Série temporal de KPIs diários
        const dailyTrend: {
            date: string;
            absences: number;
            glosas: number;
            coverages: number;
            expected: number;
            absRate: number;
        }[] = [];

        const allAbsences: any[] = [];

        for (const day of daysInRange) {
            const dayOfWeek = day.getDay();
            const dayStr = day.toDateString();
            let dayExpected = 0;
            let dayAbsences = 0;
            let dayGlosas = 0;
            let dayCoverages = 0;

            const dayAttendance = attendances.filter(a => a.date.toDateString() === dayStr);

            for (const posto of postos) {
                // Encontrar override se houver
                const override = overrides.find(o => o.postoId === posto.id && o.date.toDateString() === dayStr);

                // Encontrar alocação ativa neste dia específico
                const activeAssignment = posto.assignments.find(asg => {
                    const start = new Date(asg.startDate);
                    start.setHours(0, 0, 0, 0);
                    const end = asg.endDate ? new Date(asg.endDate) : null;
                    if (end) end.setHours(23, 59, 59, 999);
                    return day >= start && (!end || day <= end);
                });

                let isWork = true;
                if (override) {
                    isWork = !override.isDayOff;
                } else if (!activeAssignment) {
                    // Sem titular: verifica se a escala do posto prevê trabalho nesse dia
                    const normSchedule = posto.schedule.replace(/\s+/g, '').toLowerCase();
                    if (normSchedule.includes('segasex') || normSchedule.includes('mondaytofriday')) {
                        if (dayOfWeek === 0 || dayOfWeek === 6) isWork = false;
                    } else if (normSchedule.includes('segasab') || normSchedule.includes('mondaytosaturday')) {
                        if (dayOfWeek === 0) isWork = false;
                    }
                } else {
                    // Segue a escala regular do titular alocado
                    const roster = generateRoster(posto.schedule, new Date(activeAssignment.startDate), [day]);
                    isWork = roster[0]?.status === 'Trabalho';
                }

                if (isWork) {
                    dayExpected++;
                    totalExpectedShifts++;
                    if (!activeAssignment) {
                        totalVacantDays++;

                        // Agrupar vagas por Posto
                        const key = posto.id;
                        const label = `${posto.schedule} (${posto.startTime} - ${posto.endTime})`;
                        const existingP = vacantDaysByPostoMap.get(key) || { 
                            label, 
                            role: posto.role.name, 
                            client: posto.client.name, 
                            count: 0 
                        };
                        existingP.count++;
                        vacantDaysByPostoMap.set(key, existingP);

                        // Agrupar vagas por Função
                        const rKey = posto.role.id;
                        const existingR = vacantDaysByRoleMap.get(rKey) || { name: posto.role.name, count: 0 };
                        existingR.count++;
                        vacantDaysByRoleMap.set(rKey, existingR);
                    } else {
                        // Tem titular. Verifica se tem batida no banco
                        const att = dayAttendance.find(a => a.postoId === posto.id);
                        if (att) {
                            if (att.status === "FALTA") {
                                dayAbsences++;
                                const isCovered = att.coveredById || att.coverageType === "DIARISTA" || att.coverageType === "RESERVA_TECNICA";
                                if (isCovered) {
                                    dayCoverages++;
                                } else {
                                    dayGlosas++;
                                }
                                allAbsences.push(att);
                            }
                        } else {
                            // Sem batida -> conta como falta dinâmica sem cobertura
                            dayAbsences++;
                            dayGlosas++;
                            allAbsences.push({
                                id: `dyn-${posto.id}-${dayStr}`,
                                postoId: posto.id,
                                employeeId: activeAssignment.employee.id,
                                date: day,
                                status: "FALTA",
                                notes: "Falta de ponto no sistema.",
                                employee: activeAssignment.employee,
                                posto: posto
                            });
                        }
                    }
                }
            }

            const formattedDate = format(day, "dd/MM");

            dailyTrend.push({
                date: formattedDate,
                absences: dayAbsences,
                glosas: dayGlosas,
                coverages: dayCoverages,
                expected: dayExpected,
                absRate: dayExpected > 0 ? (dayAbsences / dayExpected) * 100 : 0
            });
        }

        // 5. Agregações das Batidas de Presença
        const totalAbsences = allAbsences.length;

        // Faltas com cobertura ativada (Reserva ou Diarista)
        const coveredAbsences = allAbsences.filter(a => 
            a.coverageType === "RESERVA_TECNICA" || 
            a.coverageType === "DIARISTA" || 
            a.coveredById !== null
        ).length;

        // Faltas sem cobertura (Glosas financeiras)
        const glosas = allAbsences.filter(a => 
            !a.coveredById && 
            a.coverageType !== "DIARISTA" && 
            a.coverageType !== "RESERVA_TECNICA"
        );
        const glosasCount = glosas.length;
        const glosasValue = glosas.reduce((acc, curr) => {
            const val = curr.posto?.billingValue || 0;
            return acc + (val / 30);
        }, 0);

        // 6. Ranking de ausências por colaborador
        const employeeAbsenceMap = new Map<string, { name: string; cpf: string; count: number }>();
        allAbsences.forEach(a => {
            if (a.employee) {
                const key = a.employee.id;
                const existing = employeeAbsenceMap.get(key) || { 
                    name: a.employee.name, 
                    cpf: a.employee.cpf, 
                    count: 0 
                };
                existing.count++;
                employeeAbsenceMap.set(key, existing);
            }
        });
        const employeeAbsenceRanking = Array.from(employeeAbsenceMap.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // 7. Categorização por motivos (Análise de texto das observações)
        const reasons = {
            atestado: 0,
            injustificada: 0,
            postoVago: 0,
            outros: 0
        };

        allAbsences.forEach(a => {
            const note = (a.notes || "").toLowerCase();
            if (!note || note.includes("injustificada") || note.includes("sem just") || note.includes("sem avisar")) {
                reasons.injustificada++;
            } else if (note.includes("atestado") || note.includes("medico") || note.includes("saude") || note.includes("cid") || note.includes("doenca")) {
                reasons.atestado++;
            } else if (note.includes("vago") || note.includes("sem titular") || note.includes("vaga")) {
                reasons.postoVago++;
            } else {
                reasons.outros++;
            }
        });

        // 8. Cálculo de Turnover %
        const totalActive = await prisma.employee.count({
            where: { status: "Ativo" }
        });

        const admissionsList = await prisma.employee.findMany({
            where: {
                admissionDate: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                role: true,
                company: true,
                assignments: {
                    where: { endDate: null },
                    include: { posto: { include: { client: true } } }
                }
            },
            orderBy: { admissionDate: 'desc' }
        });
        const admissions = admissionsList.length;

        const dismissalsList = await prisma.employee.findMany({
            where: {
                OR: [
                    { status: { in: ["Demitido", "Desligado", "Inativo"] } },
                    { situation: { name: { contains: "desligado", mode: "insensitive" } } },
                    { situation: { name: { contains: "demitido", mode: "insensitive" } } }
                ],
                updatedAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                role: true,
                company: true,
                situation: true
            },
            orderBy: { updatedAt: 'desc' }
        });
        const dismissals = dismissalsList.length;

        const turnoverRate = totalActive > 0 ? (((admissions + dismissals) / 2) / totalActive) * 100 : 0;
        const absenteismRate = totalExpectedShifts > 0 ? (totalAbsences / totalExpectedShifts) * 100 : 0;
        const coverageRate = (totalAbsences + totalVacantDays) > 0 
            ? (coveredAbsences / (totalAbsences + totalVacantDays)) * 100 
            : 0;

        return NextResponse.json({
            success: true,
            kpis: {
                dailyTrend,
                absenteismRate,
                turnoverRate,
                coverageRate,
                totalExpectedShifts,
                totalAbsences,
                coveredAbsences,
                glosasCount,
                glosasValue,
                totalVacantDays,
                admissions,
                dismissals,
                admissionsList,
                dismissalsList,
                reasons: [
                    { name: "Atestado Médico", value: reasons.atestado },
                    { name: "Falta Injustificada", value: reasons.injustificada },
                    { name: "Posto Vago", value: reasons.postoVago },
                    { name: "Outros Motivos", value: reasons.outros }
                ],
                employeeRanking: employeeAbsenceRanking,
                vacantByPosto: Array.from(vacantDaysByPostoMap.values())
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10),
                vacantByRole: Array.from(vacantDaysByRoleMap.values())
                    .sort((a, b) => b.count - a.count)
            }
        });
    } catch (error: any) {
        console.error("[KPIs Endpoint] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
