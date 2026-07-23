import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const total = await prisma.employee.count();
        const activeStatus = await prisma.employee.count({ where: { status: "Ativo" } });
        const hasAssignment = await prisma.employee.count({
            where: { assignments: { some: { endDate: null } } }
        });
        const sampleEmp = await prisma.employee.findFirst({
            include: {
                situation: true,
                assignments: true
            }
        });

        return NextResponse.json({
            success: true,
            total,
            activeStatus,
            hasAssignment,
            sampleEmp
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

