"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendAnnouncement } from "@/lib/announcements";
import { isValidYmd, ANNOUNCEMENT_ROLES } from "@/lib/announcement-utils";

/** Quem pode gerenciar avisos: RH/DP (Admin, Coord. RH, Assist. RH) e alçada N2. */
async function requireAnnouncementManager() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");
    if (["ADMIN", "COORD_RH", "ASSIST_RH"].includes(String(user.role))) return user;
    const db = await prisma.user.findUnique({ where: { id: user.id }, select: { isApproverN2: true } });
    if (db?.isApproverN2) return user;
    throw new Error("Apenas RH/DP e Diretoria (N2) podem gerenciar avisos.");
}

export interface AnnouncementInput {
    id?: string;
    title: string;
    message: string;
    startDate: string;
    endDate: string;
    intervalDays: number;
    recipients: string;
    sendInApp: boolean;
    inAppRoles: string;
    isActive: boolean;
}

export async function listAnnouncements() {
    await requireAnnouncementManager();
    return await prisma.announcement.findMany({ orderBy: [{ isActive: "desc" }, { startDate: "desc" }] });
}

export async function saveAnnouncement(data: AnnouncementInput) {
    try {
        const user = await requireAnnouncementManager();

        const title = (data.title || "").trim();
        const message = (data.message || "").trim();
        if (!title) throw new Error("Informe o título do aviso.");
        if (!message) throw new Error("Informe o texto do aviso.");
        if (!isValidYmd(data.startDate) || !isValidYmd(data.endDate)) throw new Error("Informe as datas de início e fim.");
        if (data.endDate < data.startDate) throw new Error("A data final não pode ser anterior à inicial.");
        const intervalDays = Math.floor(Number(data.intervalDays));
        if (!intervalDays || intervalDays < 1 || intervalDays > 60) throw new Error("O intervalo deve ficar entre 1 e 60 dias.");

        const recipients = (data.recipients || "").split(",").map(s => s.trim()).filter(Boolean).join(",");
        const validRoleIds: string[] = ANNOUNCEMENT_ROLES.map(r => r.id);
        const inAppRoles = (data.inAppRoles || "").split(",").map(s => s.trim()).filter(r => validRoleIds.includes(r)).join(",");

        if (!recipients && !(data.sendInApp && inAppRoles)) {
            throw new Error("Selecione ao menos um destinatário (WhatsApp) ou um perfil para notificar no sistema.");
        }

        const payload = {
            title,
            message,
            startDate: data.startDate,
            endDate: data.endDate,
            intervalDays,
            recipients,
            sendInApp: !!data.sendInApp,
            inAppRoles,
            isActive: !!data.isActive,
        };

        let saved;
        if (data.id) {
            saved = await prisma.announcement.update({ where: { id: data.id }, data: payload });
        } else {
            saved = await prisma.announcement.create({
                data: { ...payload, createdById: user.id, createdByName: user.name },
            });
        }

        revalidatePath("/admin/notificacoes-rh");
        return { success: true, announcement: saved };
    } catch (e: any) {
        return { success: false, error: e.message || "Erro ao salvar aviso." };
    }
}

export async function setAnnouncementActive(id: string, isActive: boolean) {
    try {
        await requireAnnouncementManager();
        await prisma.announcement.update({ where: { id }, data: { isActive } });
        revalidatePath("/admin/notificacoes-rh");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || "Erro ao atualizar aviso." };
    }
}

export async function deleteAnnouncement(id: string) {
    try {
        await requireAnnouncementManager();
        await prisma.announcement.delete({ where: { id } });
        revalidatePath("/admin/notificacoes-rh");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || "Erro ao excluir aviso." };
    }
}

export async function sendAnnouncementNow(id: string) {
    try {
        await requireAnnouncementManager();
        const result = await sendAnnouncement(id);
        revalidatePath("/admin/notificacoes-rh");
        return { success: true, ...result };
    } catch (e: any) {
        return { success: false, error: e.message || "Erro ao enviar aviso." };
    }
}
