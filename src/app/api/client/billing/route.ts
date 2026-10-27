import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { applyContractStart, getApprovedExtrasByMonth } from "@/lib/contract-start";
import { getBillingDayRows, isUncoveredAbsence } from "@/lib/posto-days";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== "CLIENTE") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const clientIds = user.clientIds || [];
        if (clientIds.length === 0) {
            return NextResponse.json({ success: true, months: [] });
        }

        const { searchParams } = new URL(request.url);
        const yearStr = searchParams.get("year");
        const currentYear = new Date().getFullYear();
        const targetYear = yearStr ? parseInt(yearStr, 10) : currentYear;

        // Limites de data para o ano
        const startDate = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0));
        const endDate = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59));

        // Buscar todos os postos vinculados
        const postos = await prisma.posto.findMany({
            where: { clientId: { in: clientIds } }
        });

        const expectedMonthlyBilling = postos.reduce((sum, p) => sum + p.billingValue, 0);

        // Mesma regra da Presença Diária: faltas sem lançamento (derivadas da escala) também contam
        const { rows: attendances, abono: abonoIds, contractStart } = await getBillingDayRows(clientIds, targetYear);

        const monthNames = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];

        const monthsData = monthNames.map((name, index) => {
            // Filtrar presenças do mês correspondente
            const monthAtts = attendances.filter(a => {
                const d = new Date(a.date);
                return d.getUTCMonth() === index;
            });

            // Calcular glosas: Faltas sem cobertura
            let glosas = 0;
            monthAtts.forEach(a => {
                if (isUncoveredAbsence(a) && !abonoIds.has(`${a.postoId}:${a.dateKey}`)) {
                    const dailyValue = a.billingValue / 30;
                    glosas += dailyValue;
                }
            });

            const netBilling = Math.max(0, expectedMonthlyBilling - glosas);

            // Calcular efetividade operacional do mês
            const activeShifts = monthAtts.filter(a => a.status !== "FOLGA");
            const totalShifts = activeShifts.length;
            const vacantShifts = activeShifts.filter(a => isUncoveredAbsence(a)).length;
            
            const effectiveness = totalShifts > 0 
                ? ((totalShifts - vacantShifts) / totalShifts) * 100 
                : 100;

            return {
                monthIndex: index,
                name,
                expectedBilling: expectedMonthlyBilling,
                glosas,
                netBilling,
                effectiveness,
                totalShifts,
                vacantShifts
            };
        });

        return NextResponse.json({
            success: true,
            year: targetYear,
            contractStart: { year: contractStart.year, month: contractStart.month },
            months: applyContractStart(monthsData, targetYear, contractStart.key, await getApprovedExtrasByMonth(clientIds, targetYear))
        });
    } catch (error: any) {
        console.error("Error fetching client billing:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
