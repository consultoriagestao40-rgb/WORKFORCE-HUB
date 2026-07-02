import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { startOfDay, addMinutes } from "date-fns";

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== "CLIENTE") {
            return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get("date");
        const selectedClientId = searchParams.get("clientId");

        const targetDate = dateStr ? startOfDay(new Date(dateStr)) : startOfDay(new Date());
        
        // Obter apenas os IDs de clientes autorizados para este usuário
        const authorizedClientIds = user.clientIds || [];

        // Filtro adicional se o cliente escolher um contrato específico no dropdown
        let finalClientIds = authorizedClientIds;
        if (selectedClientId && selectedClientId !== "all") {
            if (authorizedClientIds.includes(selectedClientId)) {
                finalClientIds = [selectedClientId];
            } else {
                return NextResponse.json({ error: "Contrato não autorizado" }, { status: 403 });
            }
        }

        const postos = await prisma.posto.findMany({
            where: {
                clientId: { in: finalClientIds }
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

        const now = new Date();
        const isToday = targetDate.toDateString() === now.toDateString();

        const items = postos.map((posto: any) => {
            const assignment = posto.assignments[0];
            const attendance = posto.attendances[0];
            const employee = assignment?.employee || null;

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
            } else {
                if (employee) {
                    const [hour, minute] = posto.startTime.split(":").map(Number);
                    const shiftStart = new Date(targetDate);
                    shiftStart.setHours(hour, minute, 0, 0);
                    const toleranceTime = addMinutes(shiftStart, 15);

                    if (isToday && now > toleranceTime) {
                        isLate = true;
                    } else if (!isToday && now > shiftStart) {
                        status = "FALTA";
                    }
                } else {
                    status = "FALTA";
                }
            }

            return {
                id: posto.id,
                role: posto.role.name,
                schedule: posto.schedule,
                startTime: posto.startTime,
                endTime: posto.endTime,
                clientName: posto.client.name,
                employeeName: employee?.name || "Vaga em Aberto",
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
                if (att.status === "FALTA" && !att.coveredByName) return 1;
                if (att.status === "AGUARDANDO" && att.isLate) return 2;
                if (att.status === "AGUARDANDO") return 3;
                return 4;
            };
            return getPriority(a) - getPriority(b);
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
