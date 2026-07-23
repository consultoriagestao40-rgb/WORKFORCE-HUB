import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncSecullumOccurrences } from "@/actions/secullum";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const monthParam = searchParams.get("month");
        const month = monthParam ? parseInt(monthParam) : 7;
        const year = 2026;

        console.log(`Triggering production sync from API route for Month ${month}...`);
        const res = await syncSecullumOccurrences(year, month, true);

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
            syncResult: res,
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

