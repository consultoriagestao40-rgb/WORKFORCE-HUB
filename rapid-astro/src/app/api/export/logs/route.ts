import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
    const logs = await prisma.log.findMany({
        orderBy: { timestamp: 'desc' }
    });

    const csvHeader = "Data/Hora,Acao,Detalhes\n";
    const csvRows = logs.map(log => {
        const date = log.timestamp.toISOString();
        const action = log.action.replace(/,/g, ""); // simple escape
        const details = log.details.replace(/,/g, ";").replace(/\n/g, " ");
        return `${date},${action},"${details}"`;
    }).join("\n");

    const csvContent = csvHeader + csvRows;

    return new NextResponse(csvContent, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="auditoria_logs.csv"',
        },
    });
}
