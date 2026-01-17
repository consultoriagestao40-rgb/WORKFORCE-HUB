"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function createMobileCoverage(formData: FormData) {
    const user = await getCurrentUser();

    const postoId = formData.get("postoId") as string;
    const notes = formData.get("notes") as string;
    // We might need covering employee ID. For now let's assume we select existing employee using ID
    // OR just a name if they are external (but schema relates to Employee).
    // Let's assume we pick an internal employee (Reserva) or Type 'Diarista' which implies external?
    // Schema: coveringEmployeeId String? 

    const employeeId = formData.get("employeeId") as string;
    const type = formData.get("type") as string; // 'DIARISTA', 'EXTRA', 'RESERVA'

    // Determine cost - for mobile we might default to 0 or allow input?
    // User didn't specify, let's default to standard logic or 0.

    try {
        await prisma.coverage.create({
            data: {
                postoId,
                type,
                date: new Date(), // Today
                costValue: 120.00, // Default MVP value for Diarista
                paymentStatus: "A_VISTA", // Default
                coveringEmployeeId: employeeId || null,
                // Note: Schema doesn't have 'notes' in Coverage, only Log.
            }
        });

        await prisma.log.create({
            data: {
                action: "CREATE_COVERAGE_MOBILE",
                details: `Supervisor ${user?.name} lançou cobertura (${type}) para o posto ${postoId}. Resposta: ${employeeId || 'Sem ID'}`,
            }
        });
    } catch (e) {
        console.error(e);
        // Handle error (in a real app, return state)
    }

    revalidatePath(`/mobile/site/${postoId}`);
    redirect(`/mobile/site/${postoId}`);
}
