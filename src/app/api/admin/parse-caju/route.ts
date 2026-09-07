import { NextRequest, NextResponse } from "next/server";
import { parseCajuPdfText, parseCajuExcel } from "@/lib/caju-parser";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
        }

        const fileName = file.name.toLowerCase();
        const arrayBuffer = await file.arrayBuffer();

        if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv")) {
            const items = parseCajuExcel(arrayBuffer);
            return NextResponse.json({ success: true, items, total: items.length });
        }

        if (fileName.endsWith(".pdf")) {
            const buffer = Buffer.from(arrayBuffer);
            // Polyfills for Node environment
            const g = globalThis as any;
            if (!g.DOMMatrix) g.DOMMatrix = class DOMMatrix { constructor() { return { a:1,b:0,c:0,d:1,e:0,f:0,m11:1,m12:0,m21:0,m22:1,m41:0,m42:0,is2D:true,isIdentity:true }; } };
            if (!g.DOMPoint) g.DOMPoint = class DOMPoint { constructor(public x=0, public y=0, public z=0, public w=1) {} static fromPoint(p: any) { return new g.DOMPoint(p?.x,p?.y,p?.z,p?.w); } };
            if (!g.DOMRect) g.DOMRect = class DOMRect { constructor(public x=0, public y=0, public width=0, public height=0) {} get top() { return this.y; } get left() { return this.x; } get bottom() { return this.y+this.height; } get right() { return this.x+this.width; } };
            if (!g.Path2D) g.Path2D = class Path2D {};
            if (!g.ImageData) g.ImageData = class ImageData { constructor(public data: any, public width: number, public height: number) {} };

            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const pdfParse = require("pdf-parse");
            const pdfData = await pdfParse(buffer, { max: 0 });
            const fullText: string = pdfData.text || "";

            const items = parseCajuPdfText(fullText);
            return NextResponse.json({ success: true, items, total: items.length });
        }

        return NextResponse.json({ error: "Formato de arquivo não suportado. Envie um arquivo PDF, CSV ou Excel (.xlsx / .xls)." }, { status: 400 });
    } catch (error: any) {
        console.error("Error parsing Caju receipt:", error);
        return NextResponse.json({ error: error.message || "Erro ao processar comprovante Caju." }, { status: 500 });
    }
}
