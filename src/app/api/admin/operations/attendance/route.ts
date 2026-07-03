import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startOfDay, addMinutes } from "date-fns";
import { generateRoster } from "@/lib/scheduling";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get("date");
        const companyId = searchParams.get("companyId");
        const clientId = searchParams.get("clientId");
        const search = searchParams.get("search");

        // Data atual convertida para o dia local do Brasil (UTC-3)
        const nowInBrazil = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
        const todayStr = nowInBrazil.toISOString().split("T")[0]; // "2026-07-02"

        const targetDateStr = dateStr || todayStr;
        const targetDate = new Date(targetDateStr + "T00:00:00Z"); // Pure UTC midnight of target day

        // 1. Buscar postos correspondentes com filtros (apenas clientes sob monitoramento ativo)
        const postos = await prisma.posto.findMany({
            where: {
                client: {
                    monitorInOperations: true,
                    companyId: companyId && companyId !== "all" ? companyId : undefined,
                    id: clientId && clientId !== "all" ? clientId : undefined
                },
                OR: search ? [
                    { client: { name: { contains: search, mode: "insensitive" } } },
                    { role: { name: { contains: search, mode: "insensitive" } } }
                ] : undefined
            },
            include: {
                client: {
                    include: { company: true }
                },
                role: true,
                assignments: {
                    where: {
                        OR: [
                            { endDate: null },
                            { endDate: { gte: targetDate } }
                        ],
                        startDate: { lte: targetDate }
                    },
                    include: {
                        employee: {
                            include: { situation: true }
                        }
                    },
                    orderBy: { startDate: "desc" }
                },
                attendances: {
                    where: { date: targetDate },
                    include: {
                        employee: true,
                        coveredBy: true
                    }
                }
            }
        });

        // Buscar overrides de escala para a data alvo
        const overrides = await prisma.scheduleOverride.findMany({
            where: {
                date: {
                    gte: targetDate,
                    lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
                }
            }
        });

        // Filtrar apenas postos que devem trabalhar hoje
        const activePostos = postos.filter((posto: any) => {
            const assignment = posto.assignments[0];
            const override = overrides.find(o => o.postoId === posto.id);
            if (override) {
                return !override.isDayOff;
            }

            if (!assignment) {
                const dayOfWeek = targetDate.getDay();
                const normSchedule = posto.schedule.replace(/\s+/g, '').toLowerCase();
                if (normSchedule.includes('segasex') || normSchedule.includes('mondaytofriday')) {
                    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
                }
                if (normSchedule.includes('segasab') || normSchedule.includes('mondaytosaturday')) {
                    if (dayOfWeek === 0) return false;
                }
                return true;
            }

            const roster = generateRoster(posto.schedule, new Date(assignment.startDate), [targetDate]);
            return roster[0]?.status === 'Trabalho';
        });

        // 2. Buscar funcionários ativos disponíveis para reserva (Reserva Técnica)
        const allActiveEmployees = await prisma.employee.findMany({
            where: { status: "Ativo" },
            include: {
                situation: true,
                assignments: {
                    where: {
                        OR: [
                            { endDate: null },
                            { endDate: { gte: targetDate } }
                        ],
                        startDate: { lte: targetDate }
                    }
                }
            }
        });

        const activeFilter = allActiveEmployees.filter(emp => {
            if (emp.situation) {
                const sitName = emp.situation.name.toLowerCase();
                if (sitName.includes('afastado') || 
                    sitName.includes('afastamento') || 
                    sitName.includes('demitido') || 
                    sitName.includes('desligado') || 
                    sitName.includes('inativo')) {
                    return false;
                }
            }
            return true;
        });

        // Reserva técnica: sem alocações ativas no dia
        const reservasList = activeFilter.filter(emp => emp.assignments.length === 0);

        const isToday = targetDateStr === todayStr;

        const items = activePostos.map((posto: any) => {
            const assignment = posto.assignments[0];
            const attendance = posto.attendances[0];
            const employee = assignment?.employee || null;

            let status = "AGUARDANDO";
            let clockInTime = null;
            let coveredBy = null;
            let coverageType = null;
            let notes = "";
            let isLate = false;

            if (attendance) {
                status = attendance.status;
                clockInTime = attendance.clockInTime;
                coveredBy = attendance.coveredBy;
                coverageType = attendance.coverageType;
                notes = attendance.notes || "";
            } else {
                if (employee) {
                    const [startHour, startMinute] = posto.startTime.split(":").map(Number);
                    const [endHour, endMinute] = posto.endTime.split(":").map(Number);

                    const shiftStart = new Date(targetDate.getTime() + 3 * 60 * 60 * 1000);
                    shiftStart.setHours(startHour, startMinute, 0, 0);

                    const shiftEnd = new Date(targetDate.getTime() + 3 * 60 * 60 * 1000);
                    shiftEnd.setHours(endHour, endMinute, 0, 0);

                    // Tratar escalas que cruzam a meia-noite (fim no dia seguinte)
                    if (shiftEnd <= shiftStart) {
                        shiftEnd.setDate(shiftEnd.getDate() + 1);
                    }

                    const toleranceTime = addMinutes(shiftStart, 15);

                    if (isToday) {
                        if (nowInBrazil > shiftEnd) {
                            status = "FALTA";
                        } else if (nowInBrazil > toleranceTime) {
                            isLate = true;
                        }
                    } else if (nowInBrazil > shiftStart) {
                        status = "FALTA";
                    }
                } else {
                    status = "FALTA"; // Sem titular, conta como vaga precisando cobertura
                }
            }

            return {
                id: posto.id,
                postoId: posto.id,
                role: posto.role.name,
                schedule: posto.schedule,
                startTime: posto.startTime,
                endTime: posto.endTime,
                billingValue: posto.billingValue,
                clientName: posto.client.name,
                companyName: posto.client.company?.name || "-",
                clientId: posto.client.id,
                employee: employee ? {
                    id: employee.id,
                    name: employee.name
                } : null,
                attendance: {
                    status,
                    clockInTime,
                    coveredBy: coveredBy ? { id: coveredBy.id, name: coveredBy.name } : null,
                    coverageType,
                    notes,
                    isLate
                }
            };
        });

        // Classificação inteligente
        const sortedItems = [...items].sort((a, b) => {
            const getPriority = (item: typeof a) => {
                const att = item.attendance;
                const isTreated = att.status === "PRESENTE_PONTO" || 
                                  att.status === "PRESENTE_MANUAL" || 
                                  att.coveredBy !== null || 
                                  att.coverageType === "DIARISTA" || 
                                  att.coverageType === "VAGO";

                if (att.status === "FALTA" && !isTreated) return 1;
                if (att.status === "AGUARDANDO" && att.isLate) return 2;
                if (att.status === "AGUARDANDO") return 3;
                return 4;
            };
            
            const priorityDiff = getPriority(a) - getPriority(b);
            if (priorityDiff !== 0) return priorityDiff;
            
            return a.startTime.localeCompare(b.startTime);
        });

        return NextResponse.json({
            success: true,
            date: targetDate,
            items: sortedItems,
            reservaTecnica: reservasList.map(r => ({ id: r.id, name: r.name }))
        });
    } catch (error: any) {
        console.error("Erro ao buscar dados da mesa de operações:", error);
        return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, postoId, date, employeeId, coveredById, coverageType, notes, diaristaCost } = body;

        if (!postoId || !date) {
            return NextResponse.json({ error: "Parâmetros obrigatórios ausentes" }, { status: 400 });
        }

        const targetDate = startOfDay(new Date(date));

        const posto = await prisma.posto.findUnique({
            where: { id: postoId }
        });

        if (!posto) {
            return NextResponse.json({ error: "Posto não encontrado" }, { status: 404 });
        }

        // Se não houver employeeId, buscar o titular atual do posto para registrar a ocorrência
        let finalEmployeeId = employeeId;
        if (!finalEmployeeId) {
            const activeAssignment = await prisma.assignment.findFirst({
                where: {
                    postoId,
                    OR: [
                        { endDate: null },
                        { endDate: { gte: targetDate } }
                    ],
                    startDate: { lte: targetDate }
                }
            });
            finalEmployeeId = activeAssignment?.employeeId || null;
        }

        if (action === "PRESENTE_MANUAL") {
            const attendance = await prisma.attendance.upsert({
                where: {
                    postoId_date: { postoId, date: targetDate }
                },
                update: {
                    status: "PRESENTE_MANUAL",
                    employeeId: finalEmployeeId,
                    coveredById: null,
                    coverageType: null,
                    notes
                },
                create: {
                    postoId,
                    employeeId: finalEmployeeId,
                    date: targetDate,
                    status: "PRESENTE_MANUAL",
                    notes
                }
            });

            // Limpa custos de Diarista anteriores se houver
            await prisma.coverage.deleteMany({
                where: { postoId, date: targetDate, type: "DIARISTA" }
            });

            return NextResponse.json({ success: true, data: attendance });
        }

        if (action === "FALTA") {
            const attendance = await prisma.attendance.upsert({
                where: {
                    postoId_date: { postoId, date: targetDate }
                },
                update: {
                    status: "FALTA",
                    employeeId: finalEmployeeId,
                    coveredById: null,
                    coverageType: null,
                    notes
                },
                create: {
                    postoId,
                    employeeId: finalEmployeeId,
                    date: targetDate,
                    status: "FALTA",
                    notes
                }
            });

            await prisma.coverage.deleteMany({
                where: { postoId, date: targetDate, type: "DIARISTA" }
            });

            return NextResponse.json({ success: true, data: attendance });
        }

        if (action === "COBERTURA") {
            if (!coverageType) {
                return NextResponse.json({ error: "Tipo de cobertura é obrigatório" }, { status: 400 });
            }

            const attendance = await prisma.attendance.upsert({
                where: {
                    postoId_date: { postoId, date: targetDate }
                },
                update: {
                    status: "FALTA",
                    employeeId: finalEmployeeId,
                    coveredById: coveredById || null,
                    coverageType,
                    notes
                },
                create: {
                    postoId,
                    employeeId: finalEmployeeId,
                    date: targetDate,
                    status: "FALTA",
                    coveredById: coveredById || null,
                    coverageType,
                    notes
                }
            });

            // Tratar custos adicionais na tabela Coverage
            if (coverageType === "DIARISTA") {
                const finalCost = parseFloat(diaristaCost) || (posto.billingValue / 30);
                const existingCoverage = await prisma.coverage.findFirst({
                    where: { postoId, date: targetDate, type: "DIARISTA" }
                });

                if (existingCoverage) {
                    await prisma.coverage.update({
                        where: { id: existingCoverage.id },
                        data: { costValue: finalCost }
                    });
                } else {
                    await prisma.coverage.create({
                        data: {
                            postoId,
                            date: targetDate,
                            type: "DIARISTA",
                            costValue: finalCost,
                            paymentStatus: "A_FATURAR"
                        }
                    });
                }
            } else {
                await prisma.coverage.deleteMany({
                    where: { postoId, date: targetDate, type: "DIARISTA" }
                });
            }

            return NextResponse.json({ success: true, data: attendance });
        }

        if (action === "DESFAZER") {
            const existing = await prisma.attendance.findUnique({
                where: {
                    postoId_date: { postoId, date: targetDate }
                }
            });

            if (existing) {
                if (existing.clockInTime) {
                    const attendance = await prisma.attendance.update({
                        where: { id: existing.id },
                        data: {
                            status: "PRESENTE_PONTO",
                            coveredById: null,
                            coverageType: null,
                            notes: ""
                        }
                    });

                    await prisma.coverage.deleteMany({
                        where: { postoId, date: targetDate, type: "DIARISTA" }
                    });

                    return NextResponse.json({ success: true, data: attendance });
                } else {
                    await prisma.attendance.delete({
                        where: { id: existing.id }
                    });

                    await prisma.coverage.deleteMany({
                        where: { postoId, date: targetDate, type: "DIARISTA" }
                    });

                    return NextResponse.json({ success: true, data: null });
                }
            }

            return NextResponse.json({ success: true, data: null });
        }

        return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    } catch (error: any) {
        console.error("Erro ao tratar presença:", error);
        return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 });
    }
}
