import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const adriana = await prisma.employee.findFirst({
            where: {
                OR: [
                    { cpf: "04781824900" },
                    { cpf: "047.818.249-00" }
                ]
            }
        });

        const adrielle = await prisma.employee.findFirst({
            where: {
                OR: [
                    { cpf: "06451816922" },
                    { cpf: "064.518.169-22" }
                ]
            }
        });

        const allan = await prisma.employee.findFirst({
            where: {
                OR: [
                    { cpf: "05410661966" },
                    { cpf: "054.106.619-66" }
                ]
            }
        });

        return NextResponse.json({
            explicacao: "Este endpoint mostra os dados reais salvos nas linhas do banco de dados do portal.",
            adriana: adriana ? {
                nome: adriana.name,
                cpf: adriana.cpf,
                salario_no_banco: adriana.salary,
                valeAlimentacao_no_banco: adriana.valeAlimentacao,
                valeTransporte_no_banco: adriana.valeTransporte
            } : "Adriana não encontrada",
            adrielle: adrielle ? {
                nome: adrielle.name,
                cpf: adrielle.cpf,
                salario_no_banco: adrielle.salary,
                valeAlimentacao_no_banco: adrielle.valeAlimentacao,
                valeTransporte_no_banco: adrielle.valeTransporte
            } : "Adrielle não encontrada",
            allan: allan ? {
                nome: allan.name,
                cpf: allan.cpf,
                salario_no_banco: allan.salary,
                valeAlimentacao_no_banco: allan.valeAlimentacao,
                valeTransporte_no_banco: allan.valeTransporte
            } : "Allan não encontrado"
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
