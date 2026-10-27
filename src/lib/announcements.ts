import { prisma } from "@/lib/db";
import { sendZapiRaw, ExtraGroupItem, ExtraPhoneItem } from "@/lib/rh-notifications";
import { todayInSaoPaulo } from "@/lib/announcement-utils";
import { SystemRole } from "@prisma/client";

interface ResolvedTarget {
    targetId: string;
    targetName: string;
    targetType: "GROUP" | "INDIVIDUAL";
}

/**
 * Converte a lista de destinatários do aviso ("OPERATIONS,ADMIN,<idGrupo>,<idContato>")
 * em alvos reais de WhatsApp, usando os grupos/contatos cadastrados na configuração de notificações do RH.
 * No aviso a seleção é sempre explícita (não herda por canal).
 */
export async function resolveAnnouncementTargets(recipients: string): Promise<ResolvedTarget[]> {
    const ids = (recipients || "").split(",").map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return [];

    const config = await prisma.rhNotificationConfig.findFirst();
    if (!config) return [];

    const targets: ResolvedTarget[] = [];
    const push = (t: ResolvedTarget) => {
        const clean = t.targetId.replace(/\D/g, "");
        const dup = targets.some(x => x.targetId === t.targetId || (clean.length >= 10 && x.targetId.replace(/\D/g, "") === clean));
        if (!dup) targets.push(t);
    };

    if (ids.includes("OPERATIONS") && config.operationsGroupJid) {
        push({ targetId: config.operationsGroupJid, targetName: config.operationsGroupName || "Grupo de Operações", targetType: "GROUP" });
    }
    if (ids.includes("ADMIN") && config.adminGroupJid) {
        push({ targetId: config.adminGroupJid, targetName: config.adminGroupName || "Grupo Administrativo", targetType: "GROUP" });
    }
    for (const g of ((config.extraGroups as unknown as ExtraGroupItem[]) || [])) {
        if (g.active && g.jid && ids.includes(g.id)) {
            push({ targetId: g.jid, targetName: g.name || "Grupo Adicional", targetType: "GROUP" });
        }
    }
    for (const p of ((config.extraPhones as unknown as ExtraPhoneItem[]) || [])) {
        if (p.active && p.phone && ids.includes(p.id)) {
            push({ targetId: p.phone, targetName: p.name || "Contato", targetType: "INDIVIDUAL" });
        }
    }
    return targets;
}

export interface AnnouncementSendResult {
    whatsappSent: number;
    whatsappFailed: number;
    inAppCount: number;
}

/**
 * Envia um aviso agora (WhatsApp + notificação no sistema), grava histórico e marca o envio.
 * Usado pelo cron diário das 08h e pelo botão "Enviar agora".
 */
export async function sendAnnouncement(announcementId: string): Promise<AnnouncementSendResult> {
    const a = await prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!a) throw new Error("Aviso não encontrado.");

    const result: AnnouncementSendResult = { whatsappSent: 0, whatsappFailed: 0, inAppCount: 0 };

    // 1. WhatsApp
    const targets = await resolveAnnouncementTargets(a.recipients);
    const fullMessage = `${a.message}\n\n_WorkForce Hub • Comunicado interno_`;
    for (const t of targets) {
        const res = await sendZapiRaw(t.targetId, fullMessage);
        try {
            await prisma.rhNotificationLog.create({
                data: {
                    event: "AVISO",
                    title: a.title,
                    message: fullMessage,
                    targetType: t.targetType,
                    targetId: t.targetId,
                    targetName: t.targetName,
                    status: res.success ? "SENT" : "FAILED",
                    zapiId: res.zapiId || null,
                    errorMessage: res.error || null,
                    metadata: { announcementId: a.id },
                },
            });
        } catch (logErr) {
            console.error("[Announcement log error]:", logErr);
        }
        if (res.success) result.whatsappSent++;
        else result.whatsappFailed++;
    }

    // 2. Notificação dentro do sistema
    if (a.sendInApp) {
        const validRoles = new Set(Object.values(SystemRole) as string[]);
        const roles = a.inAppRoles
            .split(",")
            .map(s => s.trim())
            .filter(r => r && r !== "CLIENTE" && validRoles.has(r)) as SystemRole[];
        if (roles.length > 0) {
            const users = await prisma.user.findMany({
                where: { isActive: true, role: { in: roles } },
                select: { id: true },
            });
            if (users.length > 0) {
                await prisma.notification.createMany({
                    data: users.map(u => ({
                        userId: u.id,
                        title: `📢 ${a.title}`,
                        message: a.message,
                        type: "SYSTEM",
                        link: null,
                    })),
                });
                result.inAppCount = users.length;
            }
        }
    }

    // 3. Marca o envio (mesmo que parte falhe, para não reenviar em duplicidade no mesmo dia)
    await prisma.announcement.update({
        where: { id: a.id },
        data: {
            lastSentDate: todayInSaoPaulo(),
            lastSentAt: new Date(),
            sendCount: { increment: 1 },
        },
    });

    return result;
}
