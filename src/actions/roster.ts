"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getScheduleOverrides(start: Date, end: Date) {
    const overrides = await prisma.scheduleOverride.findMany({
        where: {
            date: {
                gte: start,
                lte: end
            }
        }
    });

    // Return simple map or array
    // Returning array is fine, client will map it.
    return overrides;
}

export async function toggleScheduleOverride(postoId: string, dateStr: string, currentIsWork: boolean) {
    // Note: dateStr usually comes as ISO string. 
    // We need to ensure we store it consistently (e.g. at T12:00:00 or T00:00:00 UTC? or just the date part?)
    // The system seems to use Date objects. 
    // `generateRoster` uses date-fns `eachDayOfInterval`.
    // Let's standardise on storing "YYYY-MM-DDT12:00:00.000Z" to avoid offset issues, similar to what we did for assignments.

    // Actually, `GlobalRoster` days loop generates dates. 
    // The `dateStr` passed from client should be robust.

    // Let's parse the string and set time to noon to be safe against timezone shifts if the client sends local midnight.
    const inputDate = new Date(dateStr);
    const date = new Date(Date.UTC(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate(), 12, 0, 0));

    // If currently Work, we want DayOff (isDayOff = true).
    // If currently Off, we want Work (isDayOff = false).
    const newIsDayOff = currentIsWork;

    // Using upsert to handle both insert and update
    await prisma.scheduleOverride.upsert({
        where: {
            postoId_date: {
                postoId,
                date
            }
        },
        update: {
            isDayOff: newIsDayOff
        },
        create: {
            postoId,
            date,
            isDayOff: newIsDayOff
        }
    });

    revalidatePath("/admin/roster");
}
