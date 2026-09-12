import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

export const maxDuration = 60;

export async function GET(request: Request) {
    let prismaReembolso: PrismaClient | null = null;
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "GESTOR" && user.role !== "SUPERVISOR")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const reembolsoUrl = process.env.DATABASE_URL_REEMBOLSO || "postgresql://neondb_owner:npg_FAXvef5z2oLN@ep-lingering-poetry-ahaduz92-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

        prismaReembolso = new PrismaClient({
            datasources: {
                db: {
                    url: reembolsoUrl
                }
            }
        });

        const empresas: any = await prismaReembolso.$queryRawUnsafe(
            'SELECT id, nome, cnpj FROM "Empresa" WHERE ativo = true ORDER BY nome ASC'
        );

        return NextResponse.json({ success: true, empresas });
    } catch (error: any) {
        console.error("Erro ao buscar empresas do Reembolso Fácil:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (prismaReembolso) {
            await prismaReembolso.$disconnect().catch(() => {});
        }
    }
}
