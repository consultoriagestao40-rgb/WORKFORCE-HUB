import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ApprovalStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ count: 0 });
        }

        const count = await prisma.approvalRequest.count({
            where: {
                status: {
                    in: [ApprovalStatus.PENDENTE_N1, ApprovalStatus.PENDENTE_N2]
                }
            }
        });

        return NextResponse.json({ count });
    } catch (e: any) {
        return NextResponse.json({ count: 0, error: e.message });
    }
}
