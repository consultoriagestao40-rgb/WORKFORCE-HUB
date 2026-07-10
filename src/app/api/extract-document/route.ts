import { NextRequest, NextResponse } from "next/server";

const PROMPT = `Você é um especialista em OCR inteligente de documentos pessoais para sistemas de RH.
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

// Descobre dinamicamente os modelos disponíveis para a chave
async function listAvailableModels(apiKey: string): Promise<string[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`;
    const res = await fetch(url);
    if (!res.ok) {
        console.error("Falha ao listar modelos:", await res.text());
        return [];
    }
    const json = await res.json();
    const models: string[] = (json.models || [])
        // Filtra modelos que suportam generateContent (necessário para OCR)
        .filter((m: any) =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes("generateContent")
        )
        // Prefere modelos flash/pro e com suporte a visão
        .map((m: any) => (m.name as string).replace("models/", ""))
        .sort((a: string, b: string) => {
            const priority = (name: string) => {
                if (name.includes("2.0-flash")) return 0;
                if (name.includes("1.5-flash")) return 1;
                if (name.includes("1.5-pro")) return 2;
                if (name.includes("flash")) return 3;
                if (name.includes("pro")) return 4;
                return 5;
            };
            return priority(a) - priority(b);
        });

    console.log("Modelos disponíveis:", models);
    return models;
}

async function callGemini(apiKey: string, model: string, base64Data: string, mimeType: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
        contents: [
            {
                parts: [
                    { text: PROMPT },
                    { inline_data: { mime_type: mimeType, data: base64Data } },
                ],
            },
        ],
        generationConfig: {
            response_mime_type: "application/json",
        },
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`[${response.status}] ${err}`);
    }

    const json = await response.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Resposta vazia da IA.");
    return text;
}

export async function GET() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Chave não configurada" }, { status: 500 });

    const models = await listAvailableModels(apiKey);
    return NextResponse.json({ modelsDisponiveis: models, total: models.length });
}

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

        // Descobre os modelos disponíveis pra essa chave automaticamente
        const availableModels = await listAvailableModels(GEMINI_API_KEY);

        if (availableModels.length === 0) {
            return NextResponse.json(
                { success: false, error: "Nenhum modelo disponível para esta chave de API. Verifique se a Generative Language API está ativada no projeto Google Cloud." },
                { status: 500 }
            );
        }

        const arrayBuffer = await file.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");
        const fileMimeType = file.type || "image/jpeg";

        let lastError = "";

        for (const model of availableModels) {
            try {
                console.log(`Tentando modelo: ${model}`);
                const responseText = await callGemini(GEMINI_API_KEY, model, base64Data, fileMimeType);

                try {
                    const data = JSON.parse(responseText);
                    console.log(`Sucesso com modelo: ${model}`);
                    return NextResponse.json({ success: true, data, modelUsed: model });
                } catch {
                    lastError = "A IA não retornou dados em formato legível.";
                    continue;
                }
            } catch (err: any) {
                console.error(`Erro com modelo ${model}:`, err.message);
                lastError = err.message;
                continue;
            }
        }

        return NextResponse.json(
            { success: false, error: `Todos os modelos falharam. Último erro: ${lastError}` },
            { status: 500 }
        );

    } catch (error: any) {
        console.error("Erro interno na rota de extração:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Erro interno ao processar o documento." },
            { status: 500 }
        );
    }
}
