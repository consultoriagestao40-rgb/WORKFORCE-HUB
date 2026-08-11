import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// API consumida pelo executavel Robo-Onvio-RH.exe no Windows do RH
export async function GET() {
    try {
        const pendingJob = await prisma.rpaJob.findFirst({
            where: { status: "PENDING" },
            orderBy: { createdAt: "asc" }
        });

        if (!pendingJob) {
            return NextResponse.json({ job: null });
        }

        // Marcar como PROCESSING para evitar execucao duplicada
        await prisma.rpaJob.update({
            where: { id: pendingJob.id },
            data: { status: "PROCESSING" }
        });

        return NextResponse.json({
            job: {
                id: pendingJob.id,
                candidateId: pendingJob.candidateId,
                payload: pendingJob.payload
            }
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { jobId, status, result, error } = body;

        if (!jobId) {
            return NextResponse.json({ error: "jobId e obrigatorio" }, { status: 400 });
        }

        await prisma.rpaJob.update({
            where: { id: jobId },
            data: {
                status: status || "COMPLETED",
                result: result || error || "Executado"
            }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
