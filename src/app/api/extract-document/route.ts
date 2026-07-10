import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY) {
            return NextResponse.json(
                { success: false, error: "Chave da API Gemini não configurada no servidor." },
                { status: 500 }
            );
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: "Arquivo não enviado." },
                { status: 400 }
            );
        }

        const arrayBuffer = await file.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");
        const fileMimeType = file.type || "image/jpeg";

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: { responseMimeType: "application/json" },
        });

        const prompt = `Você é um especialista em OCR inteligente de documentos pessoais para sistemas de RH.
Analise a imagem ou PDF anexado (RG, CNH, CPF, CTPS, Passaporte ou comprovante de residência).
Extraia as informações e retorne EXCLUSIVAMENTE um objeto JSON puro, sem markdown, no formato:

{
  "name": string | null,
  "cpf": string | null,
  "birthDate": string | null,
  "gender": "Masculino" | "Feminino" | "Outro" | null,
  "address": string | null,
  "phone": string | null,
  "email": string | null
}

Regras:
1. Retorne apenas o JSON puro, sem \`\`\`json ou texto extra.
2. birthDate no formato YYYY-MM-DD.
3. cpf no formato 000.000.000-00.
4. name em MAIÚSCULAS.
5. Se um campo não existir no documento, use null.`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType: fileMimeType } },
        ]);

        const responseText = result.response.text();

        try {
            const data = JSON.parse(responseText);
            return NextResponse.json({ success: true, data });
        } catch {
            console.error("Falha ao parsear JSON do Gemini:", responseText);
            return NextResponse.json(
                {
                    success: false,
                    error: "A IA não retornou dados em formato legível.",
                    rawText: responseText,
                },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error("Erro interno na rota de extração:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Erro interno ao processar o documento." },
            { status: 500 }
        );
    }
}
