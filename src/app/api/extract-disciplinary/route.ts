import { NextRequest, NextResponse } from "next/server";

const PROMPT = `Você é um especialista em OCR inteligente de documentos de recursos humanos para empresas brasileiras.
Analise a imagem ou PDF anexado da Medida Disciplinar / Advertência Escrita / Suspensão.
Extraia as seguintes informações e retorne EXCLUSIVAMENTE um objeto JSON puro, sem markdown, no formato:

{
  "type": "ADVERTENCIA" | "SUSPENSAO" | "OUTRO",
  "occurrenceDate": string | null (no formato YYYY-MM-DD),
  "cltArticle": string | null (referência à CLT, artigo, parágrafo ou alínea mencionada, ex: "Artigo 482, alínea e"),
  "description": string | null (texto completo digitalizado da descrição do ocorrido que motivou a medida)
}

Regras:
1. Retorne apenas o JSON puro, sem \`\`\`json ou texto extra.
2. occurrenceDate no formato YYYY-MM-DD.
3. Se um campo não puder ser extraído ou não existir no documento analisado, use null.`;

const FALLBACK_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash-8b",
];

async function listAvailableModels(apiKey: string): Promise<string[]> {
    try {
        for (const version of ["v1", "v1beta"]) {
            const url = `https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}&pageSize=100`;
            const res = await fetch(url);

            if (!res.ok) {
                console.error(`ListModels ${version} falhou:`, res.status, await res.text());
                continue;
            }

            const json = await res.json();
            const allModels: any[] = json.models || [];
            const filtered = allModels
                .filter((m: any) => {
                    const methods: string[] = m.supportedGenerationMethods || [];
                    return methods.some(method =>
                        method === "generateContent" || method === "streamGenerateContent"
                    );
                })
                .map((m: any) => (m.name as string).replace("models/", ""))
                .sort((a: string, b: string) => {
                    const priority = (name: string) => {
                        if (name.includes("2.0-flash")) return 0;
                        if (name.includes("1.5-flash") && !name.includes("8b")) return 1;
                        if (name.includes("1.5-pro")) return 2;
                        if (name.includes("1.5-flash-8b")) return 3;
                        if (name.includes("flash")) return 4;
                        if (name.includes("pro")) return 5;
                        return 6;
                    };
                    return priority(a) - priority(b);
                });

            if (filtered.length > 0) {
                return filtered;
            }
        }
    } catch (e: any) {
        console.error("Erro ao listar modelos:", e.message);
    }
    return FALLBACK_MODELS;
}

function cleanJsonResponse(text: string): string {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    }
    return cleaned;
}

async function callGemini(apiKey: string, model: string, base64Data: string, mimeType: string) {
    for (const version of ["v1", "v1beta"]) {
        const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;

        const body = {
            contents: [
                {
                    parts: [
                        { text: PROMPT },
                        { inline_data: { mime_type: mimeType, data: base64Data } },
                    ],
                },
            ],
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error(`${version}/${model} falhou:`, response.status);
            if (response.status === 404 || response.status === 400) continue;
            throw new Error(`[${response.status}] ${err}`);
        }

        const json = await response.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Resposta vazia da IA.");
        return text;
    }
    throw new Error(`Modelo ${model} não encontrado ou incompatível em nenhuma versão da API.`);
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

        const availableModels = await listAvailableModels(GEMINI_API_KEY);

        const arrayBuffer = await file.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");
        const fileMimeType = file.type || "image/jpeg";

        let lastError = "";

        for (const model of availableModels) {
            try {
                console.log(`Tentando modelo para Medida Disciplinar: ${model}`);
                const responseText = await callGemini(GEMINI_API_KEY, model, base64Data, fileMimeType);

                try {
                    const cleanedJson = cleanJsonResponse(responseText);
                    const data = JSON.parse(cleanedJson);
                    console.log(`Sucesso com modelo: ${model}`, JSON.stringify(data));
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
        console.error("Erro na rota de extração de medida disciplinar:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Erro interno ao processar o documento." },
            { status: 500 }
        );
    }
}
