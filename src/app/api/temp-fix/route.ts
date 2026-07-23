import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const occurrences = await prisma.occurrence.findMany({
            select: {
                type: true,
                date: true
            }
        });

        // Group by month and type
        const stats: Record<string, Record<string, number>> = {};
        for (const occ of occurrences) {
            const date = new Date(occ.date);
            const y = date.getFullYear();
            const m = date.getMonth() + 1;
            const monthStr = `${y}-${String(m).padStart(2, '0')}`;
            if (!stats[monthStr]) stats[monthStr] = {};
            if (!stats[monthStr][occ.type]) stats[monthStr][occ.type] = 0;
            stats[monthStr][occ.type]++;
        }

        return NextResponse.json({
            success: true,
            totalOccurrencesCount: occurrences.length,
            stats
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

