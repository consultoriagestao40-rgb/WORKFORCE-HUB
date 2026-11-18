import { NextResponse } from "next/server";
import { getPendingAdjustmentsForD1 } from "@/actions/punch-adjustments";
import { sendZapiWithMentions, DEFAULT_OPERATIONS_GROUP } from "@/lib/punch-whatsapp";

/**
 * CRON ROBÔ MATINAL (D+1) — 08h30
 * [DESATIVADO CONFORME DIRETRIZ ANTI-BLOQUEIO]
 * Resumos e listas em massa no grupo foram desativados para evitar banimento pelo Meta/WhatsApp.
 */
export async function GET(request: Request) {
    try {
        return NextResponse.json({
            status: "disabled",
            message: "Disparo de resumo de pendências no grupo desativado conforme política anti-bloqueio.",
            count: 0
        });
    } catch (error: any) {
        console.error("[daily-pending-punches] Erro:", error);
        return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }
}
