import { prisma } from "@/lib/db";

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID || "3F1993DFB59E83474F059E648AE68DF9";
const ZAPI_TOKEN = process.env.ZAPI_TOKEN || "81087A6B5C1CAB8AAAC801C4";
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || "F5c1b8f27f6b049c98c4e779d00f67552S";

/**
 * Envia notificação WhatsApp ao gestor/admin sobre novo atestado recebido
 */
async function notifyManagerAboutAtestado(params: {
    employeeName: string;
    startDate: Date;
    endDate: Date;
    daysCount: number;
    cid?: string | null;
    source?: string;
}) {
    const notifyPhone = process.env.ZAPI_NOTIFY_PHONE;
    if (!notifyPhone) return; // Sem número configurado, ignora

    try {
        const start = params.startDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const end = params.endDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const dias = params.daysCount === 1 ? "1 dia" : `${params.daysCount} dias`;

        const message = [
            `📋 *Novo Atestado Médico — Revisão Necessária*`,
            ``,
            `👤 *Funcionário:* ${params.employeeName}`,
            `📅 *Período:* ${start} a ${end} (${dias})`,
            params.cid ? `🏥 *CID:* ${params.cid}` : null,
            `📲 *Origem:* ${params.source === "WHATSAPP" ? "Grupo WhatsApp" : "Manual"}`,
            ``,
            `Acesse o Workforce Hub → *Gestão de Atestados* para validar e lançar no ponto.`
        ].filter(Boolean).join("\n");

        const cleanPhone = notifyPhone.replace(/\D/g, "");
        const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

        await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Client-Token": ZAPI_CLIENT_TOKEN
            },
            body: JSON.stringify({ phone: finalPhone, message })
        });

        console.log(`[MedicalOCR] 🔔 Notificação enviada ao gestor (${finalPhone})`);
    } catch (e) {
        console.error("[MedicalOCR] Falha ao notificar gestor via WhatsApp:", e);
    }
}

export interface ExtractedMedicalData {
    patientName: string | null;
    cpf: string | null;
    startDate: string | null; // YYYY-MM-DD
    endDate: string | null;   // YYYY-MM-DD
    days: number;
    cid: string | null;
    doctorName: string | null;
    doctorCrm: string | null;
    institution: string | null;
    observations: string | null;
    confidence: number;
    rawText?: string;
}

export interface MatchEmployeeResult {
    id: string;
    name: string;
    cpf: string;
    role: string | null;
    companyId: string | null;
    companyName?: string;
    similarity: number;
}

/**
 * Remove acentos, pontuação e converte para minúsculas
 */
function normalizeText(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

/**
 * Calcula similaridade entre duas strings usando Dice's Coefficient / Bigramas
 */
function calculateSimilarity(str1: string, str2: string): number {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);

    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.85;

    const pairs1 = new Set<string>();
    for (let i = 0; i < s1.length - 1; i++) pairs1.add(s1.substring(i, i + 2));

    const pairs2 = new Set<string>();
    for (let i = 0; i < s2.length - 1; i++) pairs2.add(s2.substring(i, i + 2));

    let intersection = 0;
    pairs1.forEach((pair) => {
        if (pairs2.has(pair)) intersection++;
    });

    const total = pairs1.size + pairs2.size;
    return total === 0 ? 0 : (2.0 * intersection) / total;
}

/**
 * Realiza OCR e extração estruturada de um atestado médico usando o Gemini Vision
 */
export async function extractMedicalCertificateData(
    base64OrDataUrl: string,
    mimeType: string = "image/jpeg"
): Promise<ExtractedMedicalData> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY não configurada no ambiente.");
    }

    let pureBase64 = base64OrDataUrl;
    let detectedMime = mimeType;

    if (base64OrDataUrl.includes(";base64,")) {
        const parts = base64OrDataUrl.split(";base64,");
        detectedMime = parts[0].replace("data:", "");
        pureBase64 = parts[1];
    }

    const prompt = `Você é um perito em análise e digitação de atestados médicos e odontológicos de funcionários.
Analise a imagem deste atestado com extrema atenção aos detalhes e extraia exatamente os seguintes dados em formato JSON estrito:

{
  "patientName": "Nome completo do paciente/funcionário (como consta no documento)",
  "cpf": "CPF do paciente caso conste no atestado (apenas números ou null se não houver)",
  "startDate": "Data de início do afastamento ou atendimento no formato YYYY-MM-DD",
  "endDate": "Data de término do afastamento no formato YYYY-MM-DD (se não houver mas houver número de dias, calcule: startDate + dias - 1)",
  "days": "Quantidade de dias de afastamento/repouso recomendados (número inteiro, mínimo 1. Se for comparecimento de algumas horas coloque 1)",
  "cid": "Código do CID mencionado (ex: J00, M54.5, Z76.2 ou null se não constar)",
  "doctorName": "Nome do médico ou cirurgião dentista emissor",
  "doctorCrm": "CRM ou CRO com UF (ex: CRM-SP 123456 ou null)",
  "institution": "Nome do hospital, posto de saúde, UPA ou clínica",
  "observations": "Qualquer observação relevante sobre o repouso ou motivo",
  "confidence": 0.95
}

Observações importantes:
- Retorne EXCLUSIVAMENTE o bloco JSON válido sem blocos markdown adicionais como \`\`\`json.
- Datas devem estar estritamente no padrão ISO YYYY-MM-DD.
- Se o atestado for de 1 dia apenas no dia 15/09/2026, startDate="2026-09-15", endDate="2026-09-15" e days=1.
- Se for de 3 dias iniciando em 10/09/2026, startDate="2026-09-10", endDate="2026-09-12" e days=3.`;

    const candidateModels = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-pro"];
    let lastError = "";

    for (const model of candidateModels) {
        for (const version of ["v1beta", "v1"]) {
            try {
                const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    { text: prompt },
                                    {
                                        inline_data: {
                                            mime_type: detectedMime,
                                            data: pureBase64
                                        }
                                    }
                                ]
                            }
                        ]
                    })
                });

                if (!res.ok) {
                    const errBody = await res.text();
                    lastError = `${res.status} (${version}/${model}): ${errBody.slice(0, 150)}`;
                    continue;
                }

                const json = await res.json();
                const candidate = json.candidates?.[0];
                const rawText = candidate?.content?.parts?.[0]?.text;

                if (!rawText) {
                    lastError = "Resposta vazia da IA";
                    continue;
                }

                const cleaned = rawText
                    .replace(/```json/gi, "")
                    .replace(/```/g, "")
                    .trim();

                const parsed = JSON.parse(cleaned);

                return {
                    patientName: parsed.patientName || null,
                    cpf: parsed.cpf ? String(parsed.cpf).replace(/\D/g, "") : null,
                    startDate: parsed.startDate || null,
                    endDate: parsed.endDate || parsed.startDate || null,
                    days: Number(parsed.days) || 1,
                    cid: parsed.cid || null,
                    doctorName: parsed.doctorName || null,
                    doctorCrm: parsed.doctorCrm || null,
                    institution: parsed.institution || null,
                    observations: parsed.observations || null,
                    confidence: Number(parsed.confidence) || 0.85,
                    rawText
                };
            } catch (err: any) {
                lastError = err.message || String(err);
            }
        }
    }

    console.error("[MedicalOCR] Falha em todos os modelos Gemini:", lastError);
    return {
        patientName: null,
        cpf: null,
        startDate: null,
        endDate: null,
        days: 1,
        cid: null,
        doctorName: null,
        doctorCrm: null,
        institution: null,
        observations: `Erro na extração de IA: ${lastError}`,
        confidence: 0
    };
}

/**
 * Cruza o nome ou CPF extraído com o banco de colaboradores (Employee)
 */
export async function matchEmployee(params: {
    name?: string | null;
    cpf?: string | null;
}): Promise<MatchEmployeeResult | null> {
    const cleanCpf = params.cpf ? params.cpf.replace(/\D/g, "") : null;

    // 1. Busca direta por CPF
    if (cleanCpf && cleanCpf.length >= 11) {
        const foundByCpf = await prisma.employee.findFirst({
            where: {
                cpf: {
                    contains: cleanCpf
                }
            },
            include: {
                company: true,
                role: true
            }
        });

        if (foundByCpf) {
            return {
                id: foundByCpf.id,
                name: foundByCpf.name,
                cpf: foundByCpf.cpf,
                role: foundByCpf.role?.name || null,
                companyId: foundByCpf.companyId,
                companyName: foundByCpf.company?.name,
                similarity: 1.0
            };
        }
    }

    if (!params.name || params.name.length < 3) {
        return null;
    }

    // 2. Busca colaboradores ativos para comparação de similaridade de nome
    const employees = await prisma.employee.findMany({
        where: {
            status: { not: "INACTIVE" }
        },
        select: {
            id: true,
            name: true,
            cpf: true,
            companyId: true,
            role: {
                select: { name: true }
            },
            company: {
                select: { name: true }
            }
        }
    });

    const targetNorm = normalizeText(params.name);
    let bestMatch: MatchEmployeeResult | null = null;
    let highestScore = 0;

    for (const emp of employees) {
        const empNorm = normalizeText(emp.name);
        const score = calculateSimilarity(targetNorm, empNorm);

        if (score > highestScore && score >= 0.55) {
            highestScore = score;
            bestMatch = {
                id: emp.id,
                name: emp.name,
                cpf: emp.cpf,
                role: emp.role?.name || null,
                companyId: emp.companyId,
                companyName: emp.company?.name,
                similarity: Math.round(score * 100) / 100
            };
        }
    }

    return bestMatch;
}

/**
 * Baixa uma imagem de mídia via URL pública ou do WhatsApp e converte para base64
 */
export async function fetchMediaAsBase64(mediaUrl: string): Promise<{ base64: string; mimeType: string } | null> {
    try {
        if (mediaUrl.startsWith("data:")) {
            const mimeType = mediaUrl.split(";")[0].replace("data:", "") || "image/jpeg";
            return { base64: mediaUrl, mimeType };
        }

        const headers: Record<string, string> = {};
        if (mediaUrl.includes("z-api") || mediaUrl.includes("zaap")) {
            headers["Client-Token"] = ZAPI_CLIENT_TOKEN;
        }

        const res = await fetch(mediaUrl, { headers, cache: "no-store" });
        if (!res.ok) return null;

        const contentType = res.headers.get("content-type") || "image/jpeg";
        const buffer = await res.arrayBuffer();
        const base64 = `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
        return { base64, mimeType: contentType };
    } catch (e) {
        console.error("[MedicalOCR] Erro ao baixar imagem do WhatsApp:", e);
        return null;
    }
}

/**
 * Processa uma mídia recebida via WhatsApp (Z-API) para detectar atestado médico
 */
export async function processWhatsAppMedicalCertificate(params: {
    mediaUrl: string;
    caption?: string;
    senderPhone?: string;
    senderName?: string;
    isGroup?: boolean;
    groupName?: string;
}) {
    try {
        // Baixar mídia
        const downloaded = await fetchMediaAsBase64(params.mediaUrl);
        if (!downloaded) return null;

        // Analisar com IA Gemini
        const extracted = await extractMedicalCertificateData(downloaded.base64, downloaded.mimeType);

        // Se for enviado no grupo de atestados, sempre aceita para avaliação do gestor
        const isLikelyCertificate =
            Boolean(params.isGroup) ||
            extracted.confidence >= 0.4 ||
            Boolean(extracted.cid) ||
            Boolean(extracted.doctorName) ||
            Boolean(extracted.doctorCrm) ||
            Boolean(extracted.patientName);

        if (!isLikelyCertificate) {
            console.log("[MedicalOCR] A imagem recebida no chat privado não parece ser um atestado médico.");
            return null;
        }

        // Tentar cruzar colaborador
        let matched = await matchEmployee({
            name: extracted.patientName,
            cpf: extracted.cpf
        });

        // Se não achou, tenta pelo texto da legenda (ex: supervisor digitou o nome do colaborador)
        if (!matched && params.caption && params.caption.length >= 4) {
            matched = await matchEmployee({
                name: params.caption.trim()
            });
        }

        // Se não achou pelo nome ou CPF, tenta achar pelo telefone do remetente
        if (!matched && params.senderPhone) {
            const cleanPhone = params.senderPhone.replace(/\D/g, "");
            const shortPhone = cleanPhone.slice(-9);

            const empByPhone = await prisma.employee.findFirst({
                where: {
                    phone: { contains: shortPhone }
                },
                include: {
                    company: true,
                    role: true
                }
            });

            if (empByPhone) {
                matched = {
                    id: empByPhone.id,
                    name: empByPhone.name,
                    cpf: empByPhone.cpf,
                    role: empByPhone.role?.name || null,
                    companyId: empByPhone.companyId,
                    companyName: empByPhone.company?.name,
                    similarity: 0.9
                };
            }
        }

        const startDate = extracted.startDate ? new Date(extracted.startDate + "T12:00:00Z") : new Date();
        const endDate = extracted.endDate ? new Date(extracted.endDate + "T12:00:00Z") : startDate;

        const employeeName = matched?.name || extracted.patientName || (params.caption && params.caption.length >= 4 ? params.caption.trim() : null) || params.senderName || "Não identificado";

        // Salvar como PENDENTE no banco
        const created = await prisma.medicalCertificate.create({
            data: {
                employeeId: matched?.id || null,
                extractedName: extracted.patientName || (params.caption && params.caption.length >= 4 ? params.caption.trim() : null) || params.senderName || "Não identificado",
                employeeName,
                cpf: matched?.cpf || extracted.cpf || null,
                startDate,
                endDate,
                daysCount: extracted.days || 1,
                cid: extracted.cid,
                doctorName: extracted.doctorName,
                doctorCrm: extracted.doctorCrm,
                documentUrl: downloaded.base64 || params.mediaUrl,
                status: "PENDENTE",
                source: "WHATSAPP",
                whatsappPhone: params.senderPhone || null,
                notes: `Recebido via WhatsApp ${params.isGroup ? `no grupo ${params.groupName || ""}` : "chat direto"} (${params.senderPhone || ""}). ${params.caption ? `Legenda: ${params.caption}` : ""}`.trim()
            }
        });

        console.log(`[MedicalOCR] ✅ Atestado médico capturado com sucesso! ID: ${created.id} | Paciente: ${created.employeeName}`);

        // Notificar gestor via WhatsApp (fire-and-forget, não bloqueia o fluxo)
        notifyManagerAboutAtestado({
            employeeName: created.employeeName ?? "Não identificado",
            startDate: created.startDate,
            endDate: created.endDate,
            daysCount: created.daysCount ?? 1,
            cid: created.cid,
            source: "WHATSAPP"
        }).catch(() => {});

        return created;
    } catch (err) {
        console.error("[MedicalOCR] Falha no processamento de atestado WhatsApp:", err);
        return null;
    }
}
