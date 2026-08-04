import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/dedup-occurrences
// Finds and removes duplicate ATESTADO/FALTA occurrences for the same employee on the same calendar day.
// Keeps the FIRST record (by createdAt) and deletes the rest.
export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    // Fetch all ATESTADO and FALTA occurrences with employee info
    const occurrences = await prisma.occurrence.findMany({
        where: {
            type: { in: ["ATESTADO", "FALTA", "FALTA_INJUSTIFICADA"] },
            employeeId: { not: null }
        },
        orderBy: { date: "asc" },
        select: { id: true, employeeId: true, date: true, type: true }
    });

    // Group by employeeId first
    const byEmployee = new Map<string, typeof occurrences>();
    for (const occ of occurrences) {
        const key = occ.employeeId!;
        if (!byEmployee.has(key)) byEmployee.set(key, []);
        byEmployee.get(key)!.push(occ);
    }

    const toDelete: string[] = [];

    for (const [, emOccs] of byEmployee) {
        // Sort by date ascending
        emOccs.sort((a, b) => a.date.getTime() - b.date.getTime());

        // Sliding window: if next occurrence is within 23 hours, it's a duplicate
        const WINDOW_MS = 23 * 60 * 60 * 1000; // 23 hours
        let lastKept = emOccs[0];
        for (let i = 1; i < emOccs.length; i++) {
            const current = emOccs[i];
            const diff = current.date.getTime() - lastKept.date.getTime();
            if (diff <= WINDOW_MS) {
                // Same day duplicate — delete current, keep lastKept
                toDelete.push(current.id);
            } else {
                lastKept = current;
            }
        }
    }


    if (toDelete.length === 0) {
        return NextResponse.json({ message: "Nenhuma duplicata encontrada.", deleted: 0 });
    }

    await prisma.occurrence.deleteMany({
        where: { id: { in: toDelete } }
    });

    return NextResponse.json({
        message: `Limpeza concluída. ${toDelete.length} duplicata(s) removida(s).`,
        deleted: toDelete.length,
        ids: toDelete
    });
}
