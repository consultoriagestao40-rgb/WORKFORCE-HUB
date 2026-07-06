import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "GESTOR" && user.role !== "SUPERVISOR")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const reembolsoUrl = process.env.DATABASE_URL_REEMBOLSO || "postgresql://neondb_owner:npg_FAXvef5z2oLN@ep-lingering-poetry-ahaduz92-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

        const prismaReembolso = new PrismaClient({
            datasources: {
                db: {
                    url: reembolsoUrl
                }
            }
        });

        const diaristas: any = await prismaReembolso.$queryRawUnsafe(
            'SELECT id, nome FROM "Diarista" WHERE ativo = true ORDER BY nome ASC'
        );

        await prismaReembolso.$disconnect();

        return NextResponse.json({ success: true, diaristas });
    } catch (error: any) {
        console.error("Erro ao buscar diaristas do Reembolso Fácil:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
