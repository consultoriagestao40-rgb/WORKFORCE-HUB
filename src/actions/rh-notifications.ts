"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { 
    dispatchRhNotification, 
    fetchZapiGroups, 
    sendZapiRaw,
    ExtraPhoneItem,
    ExtraGroupItem
} from "@/lib/rh-notifications";

export async function getRhNotificationConfig() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    let config = await prisma.rhNotificationConfig.findFirst();
    if (!config) {
        config = await prisma.rhNotificationConfig.create({
            data: {
                isActive: true,
                operationsGroupJid: null,
                operationsGroupName: null,
                adminGroupJid: null,
                adminGroupName: null,
                extraGroups: [],
                extraPhones: [],
                notifyOnboarding: true,
                notifyOnboardingChannels: "OPERATIONS,ADMIN",
                notifyAbandonment: true,
                notifyAbandonmentChannels: "OPERATIONS,ADMIN",
                notifyCandidateSelected: true,
                notifyCandidateSelectedChannels: "OPERATIONS,ADMIN",
                notifyDismissalRequest: true,
                notifyDismissalRequestChannels: "OPERATIONS,ADMIN",
                notifyVacationScheduled: true,
                notifyVacationScheduledChannels: "OPERATIONS,ADMIN",
                notifyPostoMovement: true,
                notifyPostoMovementChannels: "OPERATIONS,ADMIN",
                notifyDailyRescisaoDeadline: true,
                notifyDailyRescisaoChannels: "ADMIN",
                notifyDailyTelegramDeadline: true,
                notifyDailyTelegramChannels: "OPERATIONS,ADMIN",
                notifyDailyProbationDeadline: true,
                notifyDailyProbationChannels: "OPERATIONS,ADMIN",
                notifyDailyVacationDeadline: true,
                notifyDailyVacationChannels: "OPERATIONS,ADMIN",
                notifyVacationEveStart: true,
                notifyVacationEveStartChannels: "OPERATIONS,ADMIN",
                notifyVacationEveReturn: true,
                notifyVacationEveReturnChannels: "OPERATIONS,ADMIN",
                notifyDirectSupervisor: true
            }
        });
    }

    return config;
}

export async function saveRhNotificationConfig(data: {
    isActive: boolean;
    operationsGroupJid?: string | null;
    operationsGroupName?: string | null;
    adminGroupJid?: string | null;
    adminGroupName?: string | null;
    extraGroups: ExtraGroupItem[];
    extraPhones: ExtraPhoneItem[];
    notifyOnboarding: boolean;
    notifyOnboardingChannels: string;
    notifyAbandonment: boolean;
    notifyAbandonmentChannels: string;
    notifyCandidateSelected: boolean;
    notifyCandidateSelectedChannels: string;
    notifyDismissalRequest: boolean;
    notifyDismissalRequestChannels: string;
    notifyVacationScheduled: boolean;
    notifyVacationScheduledChannels: string;
    notifyPostoMovement: boolean;
    notifyPostoMovementChannels: string;
    notifyDailyRescisaoDeadline: boolean;
    notifyDailyRescisaoChannels: string;
    notifyDailyTelegramDeadline: boolean;
    notifyDailyTelegramChannels: string;
    notifyDailyProbationDeadline: boolean;
    notifyDailyProbationChannels: string;
    notifyDailyVacationDeadline: boolean;
    notifyDailyVacationChannels: string;
    notifyVacationEveStart: boolean;
    notifyVacationEveStartChannels: string;
    notifyVacationEveReturn: boolean;
    notifyVacationEveReturnChannels: string;
    notifyDirectSupervisor: boolean;
}) {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'COORD_RH')) {
        throw new Error("Permissão insuficiente para alterar configurações de notificações.");
    }

    const currentConfig = await prisma.rhNotificationConfig.findFirst();
    let updated;

    if (currentConfig) {
        updated = await prisma.rhNotificationConfig.update({
            where: { id: currentConfig.id },
            data: {
                ...data,
                extraGroups: data.extraGroups as any,
                extraPhones: data.extraPhones as any
            }
        });
    } else {
        updated = await prisma.rhNotificationConfig.create({
            data: {
                ...data,
                extraGroups: data.extraGroups as any,
                extraPhones: data.extraPhones as any
            }
        });
    }

    revalidatePath("/admin/notificacoes-rh");
    return { success: true, config: updated };
}

export async function getAvailableZapiGroups() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    return await fetchZapiGroups();
}

export async function sendTestRhNotification(target: string, targetName: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const nowStr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const message = `🔔 *[TESTE DE NOTIFICAÇÃO DO WORKFORCE HUB]*\n\n` +
                    `Olá! Esta é uma mensagem de teste enviada por *${user.name}* para validar o canal de comunicação do RH.\n\n` +
                    `📅 *Data/Hora:* ${nowStr}\n` +
                    `✅ *Canal:* ${targetName} (${target})\n\n` +
                    `Se você recebeu esta mensagem, as automações estão operando com sucesso!`;

    const res = await sendZapiRaw(target, `${message}\n\n_WorkForce Hub • Notificação Automática de RH_`);

    await prisma.rhNotificationLog.create({
        data: {
            event: 'TESTE',
            title: 'Teste de Notificação',
            message,
            targetType: target.includes("@") || target.includes("-group") ? 'GROUP' : 'INDIVIDUAL',
            targetId: target,
            targetName,
            status: res.success ? 'SENT' : 'FAILED',
            zapiId: res.zapiId || null,
            errorMessage: res.error || null
        }
    });

    if (!res.success) {
        throw new Error(res.error || "Falha ao enviar mensagem de teste pelo Z-API.");
    }

    return { success: true, zapiId: res.zapiId };
}

export async function getRhNotificationLogs(limit: number = 40) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    return await prisma.rhNotificationLog.findMany({
        take: limit,
        orderBy: { createdAt: "desc" }
    });
}
