import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncSecullumOccurrences } from "@/actions/secullum";

export async function GET() {
    try {
        console.log("Triggering production sync from API route for Month 5, 6, 7...");
        const res5 = await syncSecullumOccurrences(2026, 5, true);
        const res6 = await syncSecullumOccurrences(2026, 6, true);
        const res7 = await syncSecullumOccurrences(2026, 7, true);

        const occurrencesCount = await prisma.occurrence.groupBy({
            by: ['type'],
            _count: { id: true }
        });

        // Get Luzia's occurrences
        const luzia = await prisma.employee.findFirst({
            where: { name: { contains: "LUZIA CORDEIRO", mode: "insensitive" } }
        });
        let luziaOccurrences: any[] = [];
        if (luzia) {
            luziaOccurrences = await prisma.occurrence.findMany({
                where: { employeeId: luzia.id }
            });
        }

        return NextResponse.json({
            success: true,
            syncResults: {
                month5: res5,
                month6: res6,
                month7: res7
            },
            databaseOccurrences: occurrencesCount,
            luziaDetails: luzia ? {
                id: luzia.id,
                name: luzia.name,
                salary: luzia.salary,
                occurrences: luziaOccurrences
            } : null
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

