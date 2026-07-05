import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { startOfDay, addMinutes } from "date-fns";
import { generateRoster } from "@/lib/scheduling";

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "CLIENTE" && user.role !== "GESTOR" && user.role !== "ADMIN")) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get("date");
        const selectedClientId = searchParams.get("clientId");

        // Data atual convertida para o dia local do Brasil (UTC-3)
        const nowInBrazil = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
        const todayStr = nowInBrazil.toISOString().split("T")[0]; // "2026-07-02"

        const targetDateStr = dateStr || todayStr;
        const targetDate = new Date(targetDateStr + "T00:00:00Z"); // Pure UTC midnight of target day
        
        let finalClientIds: string[] = [];
        if (user.role === "GESTOR" || user.role === "ADMIN") {
            if (selectedClientId && selectedClientId !== "all") {
                finalClientIds = [selectedClientId];
            } else {
                const allClients = await prisma.client.findMany({ select: { id: true } });
                finalClientIds = allClients.map(c => c.id);
            }
        } else {
            const authorizedClientIds = user.clientIds || [];
            finalClientIds = authorizedClientIds;
            if (selectedClientId && selectedClientId !== "all") {
                if (authorizedClientIds.includes(selectedClientId)) {
                    finalClientIds = [selectedClientId];
                } else {
                    return NextResponse.json({ error: "Contrato não autorizado" }, { status: 403 });
                }
            }
        }

        const postos = await prisma.posto.findMany({
            where: {
                clientId: { in: finalClientIds },
                client: { monitorInOperations: true }
            },
            include: {
                client: true,
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
                        employee: true
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
        const isToday = targetDateStr === todayStr;

        const items = postos.map((posto: any) => {
            const assignment = posto.assignments[0];
            const attendance = posto.attendances[0];
            const employee = assignment?.employee || null;

            // Verificar se o posto trabalha hoje
            let isWorkingToday = true;
            const override = overrides.find(o => o.postoId === posto.id);
            if (override) {
                isWorkingToday = !override.isDayOff;
            } else if (!assignment) {
                const dayOfWeek = targetDate.getDay();
                const normSchedule = posto.schedule.replace(/\s+/g, '').toLowerCase();
                if (normSchedule.includes('segasex') || normSchedule.includes('mondaytofriday')) {
                    if (dayOfWeek === 0 || dayOfWeek === 6) isWorkingToday = false;
                }
                if (normSchedule.includes('segasab') || normSchedule.includes('mondaytosaturday')) {
                    if (dayOfWeek === 0) isWorkingToday = false;
                }
            } else {
                const roster = generateRoster(posto.schedule, new Date(assignment.startDate), [targetDate]);
                isWorkingToday = roster[0]?.status === 'Trabalho';
            }

            let status = "AGUARDANDO";
            let clockInTime = null;
            let coveredByName = null;
            let coverageType = null;
            let notes = "";
            let isLate = false;

            if (attendance) {
                status = attendance.status;
                clockInTime = attendance.clockInTime;
                coveredByName = attendance.coveredBy?.name || null;
                coverageType = attendance.coverageType;
                notes = attendance.notes || "";
            } else if (!isWorkingToday) {
                status = "FOLGA";
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
                    status = "FALTA";
                }
            }

            const totalPostosInContract = postos.filter((p: any) => p.clientId === posto.clientId).length;

            return {
                id: posto.id,
                role: posto.role.name,
                schedule: posto.schedule,
                startTime: posto.startTime,
                endTime: posto.endTime,
                clientId: posto.client.id,
                clientName: posto.client.name,
                clientAddress: posto.client.address,
                employeeName: employee?.name || "Vaga em Aberto",
                totalContractPostos: totalPostosInContract,
                billingValue: posto.billingValue,
                attendance: {
                    status,
                    clockInTime,
                    coveredByName,
                    coverageType,
                    notes,
                    isLate
                }
            };
        });

        // Ordenar pendências primeiro para o cliente ver o que precisa ser resolvido/justificado
        const sortedItems = [...items].sort((a, b) => {
            const getPriority = (item: typeof a) => {
                const att = item.attendance;
                const isTreated = att.status === "PRESENTE_PONTO" || 
                                  att.status === "PRESENTE_MANUAL" || 
                                  att.coveredByName !== null || 
                                  att.coverageType === "DIARISTA" || 
                                  att.coverageType === "VAGO";

                if (att.status === "FALTA" && !isTreated) return 1;
                if (att.status === "AGUARDANDO" && att.isLate) return 2;
                if (att.status === "AGUARDANDO") return 3;
                if (att.status === "FOLGA") return 5;
                return 4;
            };
            
            const priorityDiff = getPriority(a) - getPriority(b);
            if (priorityDiff !== 0) return priorityDiff;
            
            return a.startTime.localeCompare(b.startTime);
        });

        return NextResponse.json({
            success: true,
            date: targetDate,
            items: sortedItems
        });
    } catch (error: any) {
        console.error("Erro na API do cliente:", error);
        return NextResponse.json({ error: "Erro interno", details: error.message }, { status: 500 });
    }
}
