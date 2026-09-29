import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get("auth_session");
        if (!session) {
            return NextResponse.json({ count: 0 });
        }

        const count = await prisma.medicalCertificate.count({
            where: { status: "PENDENTE" }
        });

        return NextResponse.json({ count }, {
            headers: {
                "Cache-Control": "no-store, max-age=0"
            }
        });
    } catch {
        return NextResponse.json({ count: 0 });
    }
}
