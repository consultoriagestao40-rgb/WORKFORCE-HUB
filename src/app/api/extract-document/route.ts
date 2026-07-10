import { NextRequest, NextResponse } from "next/server";

// Chamada REST direta ao Gemini usando o header X-goog-api-key
// (o SDK @google/generative-ai não suporta tokens do tipo AQ., apenas AIzaSy...)
const GEMINI_API_KEY = "AQ.Ab8RN6K_jNCc0jFr8rJm9Xgdh9gvZ41QbxWMyMWhdzEW83h0Fg";

const GEMINI_REST_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: "Arquivo não enviado." },
                { status: 400 }
            );
        }

        // Converter arquivo para base64
        const arrayBuffer = await file.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");
        const fileMimeType = file.type || "image/jpeg";

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
4. name em maiúsculas.
5. Se um campo não existir no documento, use null.`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: fileMimeType,
                                data: base64Data,
                            },
                        },
                    ],
                },
            ],
            generationConfig: {
                responseMimeType: "application/json",
            },
        };

        const geminiResponse = await fetch(GEMINI_REST_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-goog-api-key": GEMINI_API_KEY,
            },
            body: JSON.stringify(requestBody),
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error("Gemini REST erro:", geminiResponse.status, errorBody);
            return NextResponse.json(
                {
                    success: false,
                    error: `Erro ao chamar a IA Gemini (${geminiResponse.status}): ${errorBody}`,
                },
                { status: 500 }
            );
        }

        const geminiData = await geminiResponse.json();
        const responseText =
            geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

        if (!responseText) {
            return NextResponse.json(
                {
                    success: false,
                    error: "A IA não retornou texto na resposta.",
                },
                { status: 500 }
            );
        }

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
            {
                success: false,
                error: error.message || "Erro interno ao processar o documento.",
            },
            { status: 500 }
        );
    }
}
