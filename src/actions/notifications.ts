"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type NotificationType = 'SYSTEM' | 'MENTION' | 'ASSIGNMENT' | 'MOVEMENT';

export async function createNotification(userId: string, title: string, message: string, type: NotificationType, link?: string) {
    try {
        await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type,
                link
            }
        });
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to create notification", error);
    }
}

export async function getUserNotifications() {
    const user = await getCurrentUser();
    if (!user) return [];

    return await prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50
    });
}

export async function markNotificationAsRead(id: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    await prisma.notification.update({
        where: { id, userId: user.id },
        data: { read: true }
    });

    revalidatePath("/admin");
}

export async function markAllNotificationsAsRead() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true }
    });

    revalidatePath("/admin");
}
