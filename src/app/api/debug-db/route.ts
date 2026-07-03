import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        // Buscar colaboradores com nome parecido com "ADRIANA"
        const employees = await prisma.employee.findMany({
            where: {
                name: { contains: "ADRIANA", mode: "insensitive" }
            },
            select: {
                id: true,
                name: true,
                cpf: true,
                status: true
            }
        });

        // Buscar as últimas 10 batidas de hoje
        const todayStr = new Date().toISOString().split("T")[0]; // "2026-07-03"
        const targetDate = new Date(todayStr + "T00:00:00Z");

        const attendances = await prisma.attendance.findMany({
            where: {
                date: targetDate
            },
            include: {
                employee: {
                    select: { name: true, cpf: true }
                },
                posto: {
                    select: { client: { select: { name: true } } }
                }
            }
        });

        return NextResponse.json({
            success: true,
            targetDate: targetDate.toISOString(),
            employeesMatched: employees,
            attendancesTodayCount: attendances.length,
            attendancesToday: attendances
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
