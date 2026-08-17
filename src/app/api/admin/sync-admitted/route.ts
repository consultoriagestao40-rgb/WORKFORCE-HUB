import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncCandidateToEmployeeAndPosto } from "@/actions/recruitment";

export const dynamic = "force-dynamic";

export async function GET() {
    const logs: string[] = [];
    const results: any[] = [];

    try {
        logs.push("Fetching candidates in admission/onvio/concluded stages...");
        const candidates = await prisma.recruitmentCandidate.findMany({
            where: {
                OR: [
                    { name: { contains: "Edicleia", mode: "insensitive" } },
                    { onvioLaunched: true },
                    { benefitsCompletedAt: { not: null } },
                    { stage: { order: { gte: 5 } } },
                    { stage: { name: { contains: "Admissão", mode: "insensitive" } } },
                    { stage: { name: { contains: "Admitido", mode: "insensitive" } } },
                    { stage: { name: { contains: "Benefícios", mode: "insensitive" } } },
                    { stage: { name: { contains: "Concluído", mode: "insensitive" } } }
                ]
            },
            include: {
                stage: true,
                vacancy: {
                    include: {
                        posto: { include: { client: true, role: true } },
                        role: true,
                        company: true
                    }
                }
            }
        });

        logs.push(`Found ${candidates.length} candidate(s).`);

        for (const cand of candidates) {
            logs.push(`Attempting sync for candidate: ${cand.name} (ID: ${cand.id}, Stage: ${cand.stage?.name}, OnvioLaunched: ${cand.onvioLaunched})`);
            try {
                const syncResult = await syncCandidateToEmployeeAndPosto(cand.id);
                logs.push(`-> SUCCESS: ${cand.name} synced! Employee ID: ${syncResult.employeeId}, Posto: ${syncResult.postoId}`);
                results.push({ candidate: cand.name, status: "SUCCESS", syncResult });
            } catch (err: any) {
                logs.push(`-> ERROR syncing ${cand.name}: ${err.message}\nStack: ${err.stack}`);
                results.push({ candidate: cand.name, status: "ERROR", error: err.message, stack: err.stack });
            }
        }

        // Fetch all employees with name Edicleia
        const employeesFound = await prisma.employee.findMany({
            where: {
                OR: [
                    { name: { contains: "Edicleia", mode: "insensitive" } },
                    { cpf: { contains: "057" } }
                ]
            },
            include: {
                assignments: {
                    include: {
                        posto: { include: { client: true, role: true } }
                    }
                },
                role: true,
                company: true
            }
        });

        return NextResponse.json({
            success: true,
            logs,
            results,
            employeesFound
        });
    } catch (e: any) {
        return NextResponse.json({
            success: false,
            error: e.message,
            stack: e.stack,
            logs
        }, { status: 500 });
    }
}
