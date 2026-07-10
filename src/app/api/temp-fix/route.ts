import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addDays } from "date-fns";

export async function GET() {
    try {
        // Buscar todas as férias que iniciam em qualquer horário do dia 02/08/2026 em UTC
        const vacations = await prisma.vacation.findMany({
            where: {
                startDate: {
                    gte: new Date("2026-08-02T00:00:00.000Z"),
                    lte: new Date("2026-08-02T23:59:59.999Z")
                }
            },
            include: {
                employee: true
            }
        });

        const updated = [];

        for (const v of vacations) {
            // Calcular novas datas seguras em UTC
            const newStartDate = new Date("2026-08-03T00:00:00.000Z");
            const newEndDate = addDays(newStartDate, v.daysTaken - 1);

            // Atualizar no banco
            await prisma.vacation.update({
                where: { id: v.id },
                data: {
                    startDate: newStartDate,
                    endDate: newEndDate
                }
            });

            // Atualizar os campos legados do Employee correspondente
            await prisma.employee.update({
                where: { id: v.employeeId },
                data: {
                    lastVacationStart: newStartDate,
                    lastVacationEnd: newEndDate
                }
            });

            updated.push({
                employeeName: v.employee.name,
                oldStart: v.startDate.toISOString(),
                newStart: newStartDate.toISOString(),
                newEnd: newEndDate.toISOString(),
                daysTaken: v.daysTaken
            });
        }

        return NextResponse.json({
            success: true,
            message: `Atualizadas ${vacations.length} férias com sucesso de 02/08/2026 para 03/08/2026.`,
            updated
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
