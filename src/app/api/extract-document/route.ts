import { NextRequest, NextResponse } from "next/server";

const PROMPT = `Você é um especialista em OCR inteligente de documentos pessoais para sistemas de RH.
Analise a imagem ou PDF anexado (RG, CNH, CPF, CTPS, Título de Eleitor, ASO, reservista, certidão de filhos ou comprovante de residência).
Extraia o máximo de informações que puder e retorne EXCLUSIVAMENTE um objeto JSON puro, sem markdown, no formato:

{
  "name": string | null,
  "cpf": string | null,
  "birthDate": string | null,
  "gender": "Masculino" | "Feminino" | "Outro" | null,
  "address": string | null,
  "phone": string | null,
  "email": string | null,
  "nomeSocial": string | null,
  "funcao": string | null,
  "ctpsNumero": string | null,
  "ctpsSerie": string | null,
  "ctpsUf": string | null,
  "ctpsDataEmissao": string | null,
  "pisNumero": string | null,
  "estadoCivil": string | null,
  "grauInstrucao": string | null,
  "nomePai": string | null,
  "nomeMae": string | null,
  "nacionalidade": string | null,
  "naturalidadeCidade": string | null,
  "naturalidadeUf": string | null,
  "rgNumero": string | null,
  "rgOrgaoEmissor": string | null,
  "rgDataEmissao": string | null,
  "rgUf": string | null,
  "cnhNumero": string | null,
  "cnhCategoria": string | null,
  "cnhValidade": string | null,
  "cnhUf": string | null,
  "tituloEleitorNumero": string | null,
  "tituloEleitorZona": string | null,
  "tituloEleitorSecao": string | null,
  "tituloEleitorUf": string | null,
  "reservistaNumero": string | null,
  "reservistaCategoria": string | null,
  "dependents": [
    {
      "nome": string | null,
      "cpf": string | null,
      "dataNascimento": string | null,
      "parentesco": string | null,
      "salarioFamilia": "Sim" | "Não",
      "irrf": "Sim" | "Não"
    }
  ] | null
}

Regras:
1. Retorne apenas o JSON puro, sem \`\`\`json ou texto extra.
2. Todas as datas devem ser formatadas como YYYY-MM-DD.
3. cpf no formato 000.000.000-00.
4. name em MAIÚSCULAS.
5. Se um campo não puder ser extraído ou não existir no documento analisado, use null.`;

// Modelos hardcoded como fallback (caso ListModels falhe ou retorne vazio)
const FALLBACK_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash-8b",
];

// Descobre dinamicamente os modelos disponíveis para a chave
async function listAvailableModels(apiKey: string): Promise<string[]> {
    try {
        // Tenta v1 primeiro (endpoint estável), depois v1beta
        for (const version of ["v1", "v1beta"]) {
            const url = `https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}&pageSize=100`;
            const res = await fetch(url);

            if (!res.ok) {
                console.error(`ListModels ${version} falhou:`, res.status, await res.text());
                continue;
            }

            const json = await res.json();
            console.log(`ListModels ${version} resposta:`, JSON.stringify(json).slice(0, 300));

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
                console.log(`Modelos encontrados (${version}):`, filtered);
                return filtered;
            }
        }
    } catch (e: any) {
        console.error("Erro ao listar modelos:", e.message);
    }
    console.log("Usando fallback hardcoded de modelos");
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
    // Tenta v1 primeiro, depois v1beta como fallback
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
            if (response.status === 404 || response.status === 400) continue; // tenta próxima versão se for 404 ou payload rejeitado
            throw new Error(`[${response.status}] ${err}`);
        }

        const json = await response.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Resposta vazia da IA.");
        console.log(`Sucesso: ${version}/${model}`);
        return text;
    }
    throw new Error(`Modelo ${model} não encontrado ou incompatível em nenhuma versão da API.`);
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

        // Descobre os modelos disponíveis (com fallback automático)
        const availableModels = await listAvailableModels(GEMINI_API_KEY);

        const arrayBuffer = await file.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");
        const fileMimeType = file.type || "image/jpeg";

        let lastError = "";

        for (const model of availableModels) {
            try {
                console.log(`Tentando modelo: ${model}`);
                const responseText = await callGemini(GEMINI_API_KEY, model, base64Data, fileMimeType);

                try {
                    const cleanedJson = cleanJsonResponse(responseText);
                    const data = JSON.parse(cleanedJson);
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
