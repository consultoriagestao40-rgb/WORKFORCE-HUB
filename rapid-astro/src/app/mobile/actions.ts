"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";

export async function logCheckIn(employeeId: string, postoId: string) {
    const user = await getCurrentUser();

    // Fetch details for readable log
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    const posto = await prisma.posto.findUnique({
        where: { id: postoId },
        include: { client: true, role: true }
    });

    const empName = employee?.name || "Desconhecido";
    const postoName = posto ? `${posto.role.name} em ${posto.client.name}` : "Posto Desconhecido";

    // Log the check-in
    await prisma.log.create({
        data: {
            action: "CHECK_IN",
            details: `Supervisor ${user?.name || 'Sistema'} registrou PRESENÇA de ${empName} no posto ${postoName}`,
        }
    });

    // In a real app, we would update an 'attendance' record.
    // For now, we trust the log.

    revalidatePath(`/mobile/site/${postoId}`);
    return { success: true };
}

export async function reportAbsence(employeeId: string, postoId: string) {
    const user = await getCurrentUser();

    // Fetch details for readable log
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    const posto = await prisma.posto.findUnique({
        where: { id: postoId },
        include: { client: true, role: true }
    });

    const empName = employee?.name || "Desconhecido";
    const postoName = posto ? `${posto.role.name} em ${posto.client.name}` : "Posto Desconhecido";

    // Log the absence
    await prisma.log.create({
        data: {
            action: "REPORT_ABSENCE",
            details: `Supervisor ${user?.name || 'Sistema'} registrou FALTA de ${empName} no posto ${postoName}`,
        }
    });

    // Determine the date (today)
    const today = new Date();

    // PROPOSE A COVERAGE (Pending)
    // We create a coverage record so the "Assistente RH" sees it in the main dashboard?
    // Or just log it.
    // Let's create a "Pending" coverage if possible, or just Log for MVP.
    // The Coverage model requires 'costValue' which we don't know yet.
    // So for now, just Log.

    revalidatePath(`/mobile/site/${postoId}`);
    return { success: true };
}
