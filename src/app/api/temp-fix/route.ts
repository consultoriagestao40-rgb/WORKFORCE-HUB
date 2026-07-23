import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const monthParam = searchParams.get("month");
        const month = monthParam ? parseInt(monthParam) : 6;
        const year = 2026;

        let startMonth = month - 1;
        let startYear = year;
        if (startMonth <= 0) {
            startMonth += 12;
            startYear -= 1;
        }
        const windowStart = new Date(startYear, startMonth - 1, 26);
        const windowEnd = new Date(year, month - 1, 25);

        // Fetch Luzia with occurrences within the window
        const luzia = await prisma.employee.findFirst({
            where: { name: { contains: "LUZIA CORDEIRO", mode: "insensitive" } },
            include: {
                occurrences: {
                    where: {
                        date: {
                            gte: windowStart,
                            lte: windowEnd
                        },
                        type: { in: ["FALTA", "FALTA_INJUSTIFICADA", "ATESTADO"] }
                    },
                    orderBy: { date: "asc" }
                }
            }
        });

        // Get ALL Luzia occurrences in DB (no date filter)
        let allOccs: any[] = [];
        if (luzia) {
            allOccs = await prisma.occurrence.findMany({
                where: { employeeId: luzia.id }
            });
        }

        return NextResponse.json({
            success: true,
            window: {
                start: windowStart.toISOString(),
                end: windowEnd.toISOString()
            },
            luziaFound: luzia ? {
                id: luzia.id,
                name: luzia.name,
                occurrencesInWindow: luzia.occurrences,
                allOccsInDb: allOccs
            } : null
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

