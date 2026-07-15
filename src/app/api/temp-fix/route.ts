import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const list = await prisma.employee.findMany({
            where: {
                cpf: {
                    in: [
                        "04431387889", "044.313.878-89", // Antonio
                        "05410661966", "054.106.619-66", // Allan
                        "04781824900", "047.818.249-00", // Adriana
                        "12862655523", "128.62655.52-3", "128.626.555-23" // Adriele
                    ]
                }
            },
            select: {
                name: true,
                cpf: true,
                salary: true,
                valeAlimentacao: true,
                valeTransporte: true
            }
        });

        return NextResponse.json({
            explicacao: "Este endpoint mostra os dados reais salvos no banco de dados de produção.",
            colaboradores: list
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
