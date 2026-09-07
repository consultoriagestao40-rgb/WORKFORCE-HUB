import { NextRequest, NextResponse } from "next/server";
import { parseCajuPdfText, parseCajuExcel } from "@/lib/caju-parser";
import { PDFDocument, PDFName } from "pdf-lib";

function formatCpf(digits: string): string {
    const clean = digits.replace(/\D/g, "");
    if (clean.length === 11) {
        return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return clean;
}

async function parseCajuWithGeminiImages(arrayBuffer: ArrayBuffer) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
        const doc = await PDFDocument.load(arrayBuffer);
        const parts: any[] = [
            {
                text: `Você é um especialista em conciliação de benefícios e leitor de relatórios de pedidos da Caju Benefícios.
Analise as imagens anexadas deste relatório de pedidos do Caju.
Extraia TODOS os colaboradores listados com:
- cpf: somente os 11 dígitos do CPF
- employeeName: nome completo do colaborador
- amount: valor em reais do Auxílio Alimentação creditado (número float, ex: 900.00)
- companyName: nome da empresa pagadora no cabeçalho
- cnpj: CNPJ da empresa pagadora no cabeçalho
- totalAmount: valor total do pedido no cabeçalho

Retorne EXCLUSIVAMENTE um JSON puro sem markdown no formato:
{
  "companyName": "NOME DA EMPRESA",
  "cnpj": "00000000000000",
  "totalAmount": 0.00,
  "items": [
    { "cpf": "02862399906", "employeeName": "Adriana De Jesus Martins", "amount": 900.00 }
  ]
}`
            }
        ];

        let imageCount = 0;
        for (let i = 0; i < doc.getPageCount(); i++) {
            const page = doc.getPage(i);
            const resources = page.node.Resources();
            if (!resources) continue;
            const xobjectKey = resources.keys().find(k => k.toString().includes("XObject"));
            if (!xobjectKey) continue;
            const xobjects = doc.context.lookup(resources.get(xobjectKey)) as any;
            if (!xobjects || typeof xobjects.keys !== "function") continue;

            for (const key of xobjects.keys()) {
                const xobj = doc.context.lookup(xobjects.get(key)) as any;
                if (!xobj || !xobj.dict) continue;
                const subtype = xobj.dict.get(PDFName.of("Subtype"))?.toString();
                if (subtype === "/Image") {
                    const bytes = xobj.getContents();
                    if (bytes && bytes.length > 1000) {
                        imageCount++;
                        parts.push({
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: Buffer.from(bytes).toString("base64")
                            }
                        });
                    }
                }
            }
        }

        if (imageCount === 0) return null;

        const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
        for (const model of models) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts }] })
                });
                if (!res.ok) continue;
                const json = await res.json();
                const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!rawText) continue;
                const clean = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
                const parsed = JSON.parse(clean);
                return parsed;
            } catch (err) {
                console.warn(`[parse-caju] Error with model ${model}:`, err);
            }
        }
    } catch (e) {
        console.error("[parse-caju] Failed to parse Caju images via Gemini:", e);
    }
    return null;
}

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

            // Dynamically require pdf-parse supporting both function (v1) and class (v2)
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const pdfParseModule = require("pdf-parse");
            let fullText = "";
            try {
                if (pdfParseModule.PDFParse) {
                    const parser = new pdfParseModule.PDFParse(new Uint8Array(arrayBuffer));
                    await parser.load();
                    const res = await parser.getText();
                    if (res && Array.isArray(res.pages)) {
                        fullText = res.pages.map((p: any) => p.text || "").join("\n");
                    } else {
                        fullText = res?.text || (typeof res === "string" ? res : "");
                    }
                } else if (typeof pdfParseModule === "function") {
                    const res = await pdfParseModule(buffer, { max: 0 });
                    fullText = res?.text || "";
                }
            } catch (e) {
                console.warn("[parse-caju] text extraction failed, falling back to image/OCR:", e);
            }

            let textItems = fullText ? parseCajuPdfText(fullText) : [];

            // If text extraction yielded items, return them immediately
            if (textItems.length > 0) {
                return NextResponse.json({ success: true, items: textItems, total: textItems.length });
            }

            // Fallback for image-based PDFs generated by Caju (jsPDF / canvas)
            const geminiRes = await parseCajuWithGeminiImages(arrayBuffer);
            if (geminiRes && Array.isArray(geminiRes.items) && geminiRes.items.length > 0) {
                const items = geminiRes.items.map((it: any) => ({
                    cpf: formatCpf(String(it.cpf || "")),
                    employeeName: it.employeeName || "",
                    amount: Number(it.amount || 0)
                }));

                return NextResponse.json({
                    success: true,
                    items,
                    detectedCompanyName: geminiRes.companyName || undefined,
                    detectedCnpj: geminiRes.cnpj || undefined,
                    totalAmount: geminiRes.totalAmount || undefined,
                    total: items.length
                });
            }

            return NextResponse.json({
                error: "Não foi possível identificar colaboradores ou valores neste arquivo PDF. Certifique-se de enviar o relatório oficial de pedidos ou extrato do Caju."
            }, { status: 422 });
        }

        return NextResponse.json({ error: "Formato de arquivo não suportado. Envie um arquivo PDF, CSV ou Excel (.xlsx / .xls)." }, { status: 400 });
    } catch (error: any) {
        console.error("Error parsing Caju receipt:", error);
        return NextResponse.json({ error: error.message || "Erro ao processar comprovante Caju." }, { status: 500 });
    }
}
