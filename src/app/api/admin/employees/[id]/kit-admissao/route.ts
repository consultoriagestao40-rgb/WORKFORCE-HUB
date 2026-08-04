import { NextRequest, NextResponse } from "next/server";
import {
    generateKitAdmissaoPdfBytes,
    generateOrdemServicoPdfBytes,
    generateTermoPontoPdfBytes
} from "@/actions/kit-admissao";
import { generateEpiPdfBytes } from "@/actions/epi";
import { prisma } from "@/lib/db";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type") || "kit"; // "kit" | "os" | "termo" | "epi"

        const employee = await prisma.employee.findUnique({
            where: { id },
            select: { name: true }
        });

        if (!employee) {
            return NextResponse.json({ error: "Colaborador não encontrado" }, { status: 404 });
        }

        const safeName = employee.name.replace(/[^a-zA-Z0-9_-]/g, "_");

        let pdfBytes: Buffer;
        let filename: string;

        if (type === "os") {
            pdfBytes = await generateOrdemServicoPdfBytes(id);
            filename = `Ordem_de_Servico_${safeName}.pdf`;
        } else if (type === "termo") {
            pdfBytes = await generateTermoPontoPdfBytes(id);
            filename = `Termo_Uso_Celular_Ponto_${safeName}.pdf`;
        } else if (type === "epi") {
            pdfBytes = await generateEpiPdfBytes(id);
            filename = `Ficha_EPI_${safeName}.pdf`;
        } else {
            pdfBytes = await generateKitAdmissaoPdfBytes(id);
            filename = `Kit_Admissao_${safeName}.pdf`;
        }

        return new NextResponse(new Uint8Array(pdfBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`
            }
        });
    } catch (e: any) {
        console.error("Error generating Kit de Admissão PDF route:", e);
        return NextResponse.json({ error: e.message || "Erro ao gerar PDF do Kit de Admissão" }, { status: 500 });
    }
}
