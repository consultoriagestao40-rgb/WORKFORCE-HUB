import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const month = 7;
        const year = 2026;

        let startMonth = month - 1;
        let startYear = year;
        if (startMonth <= 0) {
            startMonth += 12;
            startYear -= 1;
        }
        const windowStart = new Date(startYear, startMonth - 1, 26);
        const windowEnd = new Date(year, month - 1, 25);

        // Fetch all occurrences of type ATESTADO in the window
        const atestados = await prisma.occurrence.findMany({
            where: {
                type: "ATESTADO",
                date: {
                    gte: windowStart,
                    lte: windowEnd
                }
            },
            include: {
                employee: true
            }
        });

        const list = atestados.map(a => ({
            employeeName: a.employee?.name,
            date: a.date,
            title: a.title
        }));

        return NextResponse.json({
            success: true,
            window: {
                start: windowStart.toISOString(),
                end: windowEnd.toISOString()
            },
            atestadosCount: atestados.length,
            list
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

