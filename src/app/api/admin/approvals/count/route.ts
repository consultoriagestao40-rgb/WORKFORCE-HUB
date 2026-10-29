import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ApprovalStatus, ApprovalType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ count: 0 });
        }

        const pendingCount = await prisma.approvalRequest.count({
            where: {
                status: {
                    in: [ApprovalStatus.PENDENTE_N1, ApprovalStatus.PENDENTE_N2]
                }
            }
        });

        // Contar solicitações aprovadas aguardando execução pelo RH/DP
        const rhApproved = await prisma.approvalRequest.findMany({
            where: {
                status: ApprovalStatus.APROVADO,
                type: { in: [ApprovalType.DESLIGAMENTO, ApprovalType.OUTROS, ApprovalType.AJUSTE_SALARIAL] }
            },
            select: { executionPayload: true }
        });

        const waitingRhCount = rhApproved.filter(r => {
            const payload = (r.executionPayload as any) || {};
            return !payload.rhConclusion;
        }).length;

        const count = pendingCount + waitingRhCount;

        return NextResponse.json({ count, pending: pendingCount, waitingRh: waitingRhCount });
    } catch (e: any) {
        return NextResponse.json({ count: 0, error: e.message });
    }
}
