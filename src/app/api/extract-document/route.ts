import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6Lo2V1NdBt2lwskiWbrKlGSEp5bbEw9DxuA1UCAj5-QiQ";
        if (!apiKey) {
            return NextResponse.json({
                success: false,
                error: "Chave de API do Gemini não configurada."
            }, { status: 500 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({
                success: false,
                error: "Arquivo não enviado."
            }, { status: 400 });
        }

        // Converter arquivo para base64 para envio ao Gemini
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString("base64");
        const fileMimeType = file.type;

        // Instanciar o SDK do Gemini
        const genAI = new GoogleGenerativeAI(apiKey);
        
        const prompt = `Você é um especialista em OCR inteligente de documentos pessoais para sistemas de RH de empresas. 
Analise a imagem ou PDF anexado, que pode ser um documento de identidade (RG, CNH, CPF, CTPS, Passaporte) ou um comprovante de residência.
Extraia as informações do colaborador com a maior precisão possível e retorne EXCLUSIVAMENTE um objeto JSON estruturado no seguinte formato:

{
  "name": string | null (Nome completo do colaborador em maiúsculas),
  "cpf": string | null (CPF formatado no formato 000.000.000-00),
  "birthDate": string | null (Data de nascimento no formato YYYY-MM-DD, ex: "1995-12-30"),
  "gender": "Masculino" | "Feminino" | "Outro" | null (Tente identificar ou deduzir com base no nome do colaborador),
  "address": string | null (Endereço residencial completo extraído de comprovante de residência se disponível. Formate no padrão: Rua/Avenida, Número, Bairro, Cidade - UF),
  "phone": string | null (Telefone de contato se houver no documento),
  "email": string | null (Endereço de email se houver no documento)
}

Regras:
1. Retorne apenas o JSON puro, sem formatação markdown (como \`\`\`json) ou textos explicativos.
2. Se um campo não estiver presente ou for ilegível, defina-o como null.
3. Garanta que o CPF contenha pontuação e traço válidos.`;

        // Tentar vários modelos em cadeia caso o fuso ou a versão da API dê 404 em algum deles
        const modelsToTry = ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-1.5-pro-latest", "gemini-1.5-pro"];
        let result = null;
        let lastError = null;

        for (const modelName of modelsToTry) {
            try {
                console.log(`Tentando extração com o modelo: ${modelName}`);
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                });

                result = await model.generateContent([
                    prompt,
                    {
                        inlineData: {
                            data: base64Data,
                            mimeType: fileMimeType
                        }
                    }
                ]);

                if (result) {
                    console.log(`Sucesso com o modelo: ${modelName}`);
                    break;
                }
            } catch (err: any) {
                console.error(`Erro com modelo ${modelName}:`, err.message || err);
                lastError = err;
            }
        }

        if (!result) {
            return NextResponse.json({
                success: false,
                error: `A IA do Gemini não pôde processar o documento. Detalhes: ${lastError?.message || "Erro desconhecido"}`
            }, { status: 500 });
        }

        const responseText = result.response.text();
        
        try {
            const data = JSON.parse(responseText);
            return NextResponse.json({
                success: true,
                data
            });
        } catch (parseError) {
            console.error("Falha ao parsear JSON do Gemini:", responseText);
            return NextResponse.json({
                success: false,
                error: "A inteligência artificial não retornou dados em formato legível.",
                rawText: responseText
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Erro na rota de extração:", error);
        return NextResponse.json({
            success: false,
            error: error.message || "Erro interno ao processar o documento."
        }, { status: 500 });
    }
}
