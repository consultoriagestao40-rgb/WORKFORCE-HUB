import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scanPunchInconsistencies, dispatchInconsistencies } from "@/actions/punch-inconsistencies";
import { sendPunchAdjustmentWhatsAppAlert } from "@/lib/punch-whatsapp";
import { spDateParts } from "@/lib/punch-time";

/**
 * CRON DIÁRIO DE INCONSISTÊNCIAS DE PONTO
 * 
 * Regras:
 * 1. Ativação oficial: a partir de 06/10/2026 00:00:00 (não processa dias anteriores).
 * 2. Varre o Secullum para o dia de ontem (D-1). Se encontrar inconsistências NOVAS:
 *    - Cria o ajuste e envia alerta interativo no WhatsApp do gestor do contrato.
 * 3. Se houver inconsistências de dias anteriores ainda não tratadas (PENDING_RESPONSE > 24h):
 *    - Reenvia mensagem de cobrança para o gestor.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const force = searchParams.get("force") === "true";

        const now = new Date();
        const { dateStr: todayStr } = spDateParts(now);

        // Data de corte solicitada pelo usuário: a partir de 06/10/2026 00:00
        const ACTIVATION_DATE = "2026-10-06";
        if (!force && todayStr < ACTIVATION_DATE) {
            return NextResponse.json({
                status: "skipped",
                message: `Rotina agendada para iniciar a partir de ${ACTIVATION_DATE} 00:00. Data atual em SP: ${todayStr}`
            });
        }

        // 1. Data a varrer: Ontem (D-1)
        const dMinus1 = new Date(now.getTime() - 86400000);
        const { dateStr: yesterdayStr } = spDateParts(dMinus1);

        // Se yesterdayStr for menor que a data de ativação (e não for force), usamos a data de ativação
        const targetScanDate = yesterdayStr >= ACTIVATION_DATE ? yesterdayStr : todayStr;

        console.log(`[cron/inconsistencies-auto-dispatch] Varrendo inconsistências para a data: ${targetScanDate}`);

        const scanRes = await scanPunchInconsistencies({
            startDate: targetScanDate,
            endDate: targetScanDate
        });

        const newItemsToDispatch = scanRes.rows.filter(r => r.status === "NOVO" && r.managerHasPhone);
        let dispatchedCount = 0;
        let dispatchErrors: string[] = [];

        if (newItemsToDispatch.length > 0) {
            const dispatchRes = await dispatchInconsistencies(newItemsToDispatch.map(item => ({
                employeeId: item.employeeId,
                date: item.date,
                missing: item.missing,
                expected: item.expected,
                kind: item.kind
            })));

            dispatchedCount = dispatchRes.results.filter(r => r.ok).length;
            dispatchErrors = dispatchRes.results.filter(r => !r.ok).map(r => `${r.code || r.key}: ${r.message}`);
        }

        // 2. COBRANÇA DE PENDÊNCIAS NÃO TRATADAS (D+1 ou criadas há mais de 20 horas)
        const cutoffTime = new Date(now.getTime() - 20 * 60 * 60 * 1000);
        const pendingReminders = await prisma.attendancePunchAdjustment.findMany({
            where: {
                status: "PENDING_RESPONSE",
                createdAt: { lte: cutoffTime, gte: new Date(`${ACTIVATION_DATE}T00:00:00-03:00`) },
                // Não reenviar mais de uma vez a cada 18 horas
                updatedAt: { lte: cutoffTime }
            },
            take: 30
        });

        let remindersSent = 0;
        for (const adj of pendingReminders) {
            try {
                const res = await sendPunchAdjustmentWhatsAppAlert(adj.id);
                if (res.success) {
                    remindersSent++;
                    await prisma.attendancePunchAdjustment.update({
                        where: { id: adj.id },
                        data: { updatedAt: new Date() }
                    });
                }
            } catch (err: any) {
                console.warn(`[cron] Falha ao reenviar lembrete para ajuste #${adj.code}:`, err.message);
            }
        }

        return NextResponse.json({
            status: "success",
            scanDate: targetScanDate,
            newInconsistenciesFound: scanRes.rows.length,
            dispatchedToManagers: dispatchedCount,
            remindersSent,
            errors: dispatchErrors.length ? dispatchErrors : undefined
        });
    } catch (error: any) {
        console.error("[inconsistencies-auto-dispatch] Erro geral:", error);
        return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }
}
