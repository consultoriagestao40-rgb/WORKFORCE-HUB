import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const targetNames = [
            "ANDREIA FAUSTIN DE SOUZA",
            "ELISANGELA SANTOS DE PAULA",
            "ELIZABETE BRUM ANTONIO",
            "FERNANDA STIIRMER DE MATTOS YAMAGUCHI",
            "GABRIELY BRASQUE ALVES PEREIRA",
            "GENESIS GABRIELA MARTINEZ GONZALEZ",
            "JOSINEIDE MARTINS VIDAL",
            "LUZIA CORDEIRO DE OLIVEIRA",
            "MARLY DALVA DE AZEVEDO",
            "NIZIA TASSIA DA SILVA",
            "SANDRA PEREIRA MOREIRA",
            "ZURIMA ROXANA LEON GARCIA"
        ];

        const allEmployees = await prisma.employee.findMany();

        const matches = targetNames.map(targetName => {
            const emp = allEmployees.find(e => 
                e.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(
                    targetName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                )
            );

            return {
                targetName,
                found: emp ? {
                    name: emp.name,
                    cpf: emp.cpf,
                    salary: emp.salary,
                    valeAlimentacao: emp.valeAlimentacao,
                    valeTransporte: emp.valeTransporte
                } : null
            };
        });

        return NextResponse.json({
            explicacao: "Este endpoint mostra os dados reais salvos no banco de dados de produção para as 12 pessoas.",
            matches
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
