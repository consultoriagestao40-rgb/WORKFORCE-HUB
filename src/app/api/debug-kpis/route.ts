import { NextResponse } from 'next/server';
import { prisma } from "@/lib/db";
import { getAdminClientKpis, getClientDetailedData } from '@/app/admin/requests/actions';

export async function GET() {
    try {
        const client = await prisma.client.findFirst({
            where: { name: { contains: "penha", mode: 'insensitive' } }
        });
        if (!client) {
            return NextResponse.json({ error: "Cliente Penha não encontrado" });
        }

        const kpisRes = await getAdminClientKpis(client.id, 2026);
        const detailedRes = await getClientDetailedData(client.id, 2026, 6);

        // Buscar todas as presenças de Julho de 2026 no banco diretamente
        const startOfMonth = new Date(2026, 6, 1);
        const endOfMonth = new Date(2026, 7, 0, 23, 59, 59);
        const directJulAtts = await prisma.attendance.findMany({
            where: {
                posto: { clientId: client.id },
                date: { gte: startOfMonth, lte: endOfMonth }
            }
        });

        // Buscar todas as presenças do ano de 2026 no banco diretamente
        const startDate = new Date(2026, 0, 1);
        const endDate = new Date(2026, 11, 31, 23, 59, 59);
        const directYearAtts = await prisma.attendance.findMany({
            where: {
                posto: { clientId: client.id },
                date: { gte: startDate, lte: endDate }
            }
        });

        return NextResponse.json({
            clientId: client.id,
            clientName: client.name,
            directJulAttsCount: directJulAtts.length,
            directYearAttsCount: directYearAtts.length,
            directJulFaltasCount: directJulAtts.filter(a => a.status === 'FALTA').length,
            directJulDescobertasCount: directJulAtts.filter(a => a.status === 'FALTA' && !a.coveredById).length,
            kpisRes,
            detailedRes
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message, stack: err.stack });
    }
}
