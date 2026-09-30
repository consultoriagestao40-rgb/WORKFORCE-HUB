import { NextResponse } from "next/server";
import { getPendingAdjustmentsForD1 } from "@/actions/punch-adjustments";
import { sendZapiWithMentions, DEFAULT_OPERATIONS_GROUP } from "@/lib/punch-whatsapp";

/**
 * CRON ROBÔ MATINAL (D+1) — 08h30
 * Varre as inconsistências de ponto de ontem que continuam sem resposta do supervisor
 * e dispara a cobrança consolidada no grupo com a @menção de cada gestor responsável.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const targetGroup = searchParams.get("targetGroup") || DEFAULT_OPERATIONS_GROUP;

        const pendings = await getPendingAdjustmentsForD1();

        if (!pendings || pendings.length === 0) {
            return NextResponse.json({
                status: "success",
                message: "Nenhuma inconsistência pendente de dias anteriores.",
                count: 0
            });
        }

        // Agrupar pendências por Gestor da Conta
        const groupedByManager = new Map<string, {
            managerName: string;
            managerPhone: string | null;
            items: typeof pendings;
        }>();

        const unassignedItems: typeof pendings = [];
        const allMentionedPhones = new Set<string>();

        for (const item of pendings) {
            const manager = item.client?.accountManager;
            if (manager) {
                const key = manager.id;
                if (!groupedByManager.has(key)) {
                    groupedByManager.set(key, {
                        managerName: manager.name,
                        managerPhone: manager.phone,
                        items: []
                    });
                }
                groupedByManager.get(key)!.items.push(item);
                if (manager.phone) {
                    const clean = manager.phone.replace(/\D/g, "");
                    allMentionedPhones.add(clean.startsWith("55") ? clean : `55${clean}`);
                }
            } else {
                unassignedItems.push(item);
            }
        }

        // Montar a mensagem do resumo matinal
        let messageText = `🚨 *RESUMO DE PENDÊNCIAS DE PONTO EM ABERTO*\n` +
            `_Atenção líderes, constam ${pendings.length} inconsistência(s) sem justificativa de dias anteriores:_\n\n`;

        // Seções por Gestor
        for (const [_, data] of groupedByManager.entries()) {
            const cleanPhone = data.managerPhone ? data.managerPhone.replace(/\D/g, "") : null;
            const fullPhone = cleanPhone ? (cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`) : null;
            const mentionStr = fullPhone ? `@${fullPhone}` : data.managerName;

            messageText += `👤 *Gestor: ${mentionStr}* (${data.items.length} pendência${data.items.length > 1 ? "s" : ""}):\n`;
            for (const item of data.items) {
                messageText += `  ▫️ *${item.employee.name}* (${item.client?.name || "Posto"})\n` +
                    `     Falta marcação: ${item.punchType} (${item.expectedTime}) ➔ Responda: *#${item.code} [motivo]* ou *#${item.code} falta*\n`;
            }
            messageText += `\n`;
        }

        // Itens sem gestor vinculado
        if (unassignedItems.length > 0) {
            messageText += `⚠️ *Outros Contratos:* \n`;
            for (const item of unassignedItems) {
                messageText += `  ▫️ *${item.employee.name}* (${item.client?.name || "Posto"})\n` +
                    `     ➔ Responda: *#${item.code} [motivo]* ou *#${item.code} falta*\n`;
            }
            messageText += `\n`;
        }

        messageText += `━━━━━━━━━━━━━━━━━━━━\n` +
            `👉 *Por favor, respondam acima para que o RH possa regularizar os espelhos antes do fechamento da folha.*`;

        // Disparar no WhatsApp com as menções de todos os gestores com pendências
        const sendRes = await sendZapiWithMentions({
            target: targetGroup,
            message: messageText,
            mentionedPhones: Array.from(allMentionedPhones)
        });

        return NextResponse.json({
            status: "success",
            dispatched: sendRes.success,
            totalPendings: pendings.length,
            targetGroup,
            zapiId: sendRes.zapiId
        });
    } catch (error: any) {
        console.error("[daily-pending-punches] Erro:", error);
        return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }
}
