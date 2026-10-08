import { prisma } from "@/lib/db";
import { getCidDescription, normalizeCidCode } from "@/lib/cid10";

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
    cidDescription?: string | null;
    source?: string;
}) {
    const notifyPhone = process.env.ZAPI_NOTIFY_PHONE;
    if (!notifyPhone) return; // Sem número configurado, ignora

    try {
        const start = params.startDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const end = params.endDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const dias = params.daysCount === 1 ? "1 dia" : `${params.daysCount} dias`;

        const cidDisplay = params.cid
            ? `🏥 *CID:* ${params.cid}${params.cidDescription ? ` — ${params.cidDescription}` : ""}`
            : null;

        const message = [
            `📋 *Novo Atestado Médico — Revisão Necessária*`,
            ``,
            `👤 *Funcionário:* ${params.employeeName}`,
            `📅 *Período:* ${start} a ${end} (${dias})`,
            cidDisplay,
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
    isAtestado: boolean;
    patientName: string | null;
    cpf: string | null;
    startDate: string | null; // YYYY-MM-DD
    endDate: string | null;   // YYYY-MM-DD
    days: number;
    cid: string | null;
    cidDescription?: string | null;
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

    const prompt = `Você é um perito em análise e validação de documentos de Medicina do Trabalho e Recursos Humanos.
Sua PRIMEIRA e mais crítica tarefa é verificar se esta imagem é DE FATO um ATESTADO MÉDICO, DECLARAÇÃO DE COMPARECIMENTO MÉDICO/ODONTOLÓGICO OU DOCUMENTO HOSPITALAR.

REGRAS DE CLASSIFICAÇÃO:
- Se a imagem for: selfie, foto de pessoa, print de conversa do WhatsApp, print de celular, print de aplicativo de banco, foto de objeto, crachá, ou qualquer coisa que NÃO seja um documento médico:
  -> Retorne OBRIGATORIAMENTE isAtestado: false, patientName: null, cpf: null, cid: null, doctorName: null, doctorCrm: null, days: 0, confidence: 0.

- Se e somente se a imagem contiver um ATESTADO MÉDICO ou DECLARAÇÃO HOSPITALAR/MÉDICA real, retorne isAtestado: true e extraia com exatidão:

{
  "isAtestado": true ou false,
  "patientName": "Nome completo do paciente/funcionário (como consta no documento impresso/escrito)",
  "cpf": "CPF do paciente caso conste no atestado (apenas números ou null se não houver)",
  "startDate": "Data de início do afastamento ou atendimento no formato YYYY-MM-DD",
  "endDate": "Data de término do afastamento no formato YYYY-MM-DD (se não houver mas houver número de dias, calcule: startDate + dias - 1)",
  "days": "Quantidade de dias de afastamento/repouso recomendados (número inteiro, mínimo 1. Se for comparecimento de algumas horas coloque 1)",
  "cid": "Código do CID mencionado (ex: J00, M54.5, Z76.2 ou null se não constar)",
  "cidDescription": "Descrição médica/diagnóstico oficial do CID segundo a tabela CID-10 da OMS (ex: 'Dor lombar baixa', 'Infecção aguda das vias aéreas superiores', 'Amigdalite aguda', etc. ou null se não houver CID)",
  "doctorName": "Nome do médico ou cirurgião dentista emissor",
  "doctorCrm": "CRM ou CRO com UF (ex: CRM-PR 123456 ou null)",
  "institution": "Nome do hospital, posto de saúde, UPA ou clínica",
  "observations": "Observações do atestado",
  "confidence": 0.95
}

Observações importantes:
- Retorne EXCLUSIVAMENTE o bloco JSON válido sem blocos markdown adicionais como \`\`\`json.
- Datas devem estar estritamente no padrão ISO YYYY-MM-DD.`;

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
                const normCid = parsed.cid ? normalizeCidCode(parsed.cid) : null;
                const cidDesc = (normCid ? getCidDescription(normCid) : null) || parsed.cidDescription || null;

                return {
                    isAtestado: parsed.isAtestado === true,
                    patientName: parsed.isAtestado === false ? null : (parsed.patientName || null),
                    cpf: parsed.cpf ? String(parsed.cpf).replace(/\D/g, "") : null,
                    startDate: parsed.startDate || null,
                    endDate: parsed.endDate || parsed.startDate || null,
                    days: Number(parsed.days) || 1,
                    cid: normCid,
                    cidDescription: cidDesc,
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
        isAtestado: false,
        patientName: null,
        cpf: null,
        startDate: null,
        endDate: null,
        days: 0,
        cid: null,
        cidDescription: null,
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

const ocrProcessingLocks = new Set<string>();

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
    messageId?: string;
}) {
    const lockKey = params.messageId || params.mediaUrl;
    if (ocrProcessingLocks.has(lockKey)) {
        console.log(`[MedicalOCR] Requisição em processamento concorrente descartada para: ${lockKey}`);
        return null;
    }
    ocrProcessingLocks.add(lockKey);

    try {
        // Se houver messageId, checar se já foi registrado
        if (params.messageId) {
            const existingMsg = await prisma.medicalCertificate.findFirst({
                where: { whatsappMessageId: params.messageId }
            });
            if (existingMsg) {
                console.log(`[MedicalOCR] Mensagem ${params.messageId} já cadastrada como atestado (ID: ${existingMsg.id}).`);
                return existingMsg;
            }
        }

        // Baixar mídia
        const downloaded = await fetchMediaAsBase64(params.mediaUrl);
        if (!downloaded) return null;

        // Analisar com IA Gemini
        const extracted = await extractMedicalCertificateData(downloaded.base64, downloaded.mimeType);

        // REJEIÇÃO RÍGIDA: A imagem DEVE ser comprovadamente um atestado médico real!
        if (extracted.isAtestado === false) {
            console.log("[MedicalOCR] Documento descartado: A imagem NÃO é um atestado médico (pode ser print, foto de pessoa, etc).");
            return null;
        }

        // Deve conter ao menos UM sinal médico explícito (CID ou CRM ou Nome de médico comprovado)
        const hasMedicalSignal = Boolean(extracted.cid) || Boolean(extracted.doctorCrm) || (Boolean(extracted.doctorName) && Boolean(extracted.patientName));
        if (!hasMedicalSignal) {
            console.log("[MedicalOCR] Documento descartado: Não possui dados médicos válidos (sem CID, sem CRM).");
            return null;
        }

        const cleanPatientName = extracted.patientName ? extracted.patientName.trim() : null;

        // Tentar cruzar colaborador pelo nome do paciente ou CPF do atestado
        let matched = await matchEmployee({
            name: cleanPatientName,
            cpf: extracted.cpf
        });

        const startDate = extracted.startDate ? new Date(extracted.startDate + "T12:00:00Z") : new Date();
        const endDate = extracted.endDate ? new Date(extracted.endDate + "T12:00:00Z") : startDate;
        const employeeName = matched?.name || cleanPatientName || "Não identificado";

        // PROTEÇÃO CONTRA DUPLICIDADE:
        // Se já foi criado um atestado para o mesmo colaborador / CPF com datas coincidentes nos últimos 15 minutos, descarta duplicata.
        const candidateCpf = matched?.cpf || extracted.cpf;
        const candidateEmployeeId = matched?.id;
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

        const duplicateCheck = await prisma.medicalCertificate.findFirst({
            where: {
                createdAt: { gte: fifteenMinutesAgo },
                OR: [
                    ...(candidateEmployeeId ? [{ employeeId: candidateEmployeeId }] : []),
                    ...(candidateCpf ? [{ cpf: candidateCpf }] : []),
                    ...(cleanPatientName ? [{ extractedName: { equals: cleanPatientName, mode: "insensitive" as const } }] : [])
                ],
                startDate: {
                    gte: new Date(startDate.getTime() - 24 * 60 * 60 * 1000),
                    lte: new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
                }
            }
        });

        if (duplicateCheck) {
            console.log(`[MedicalOCR] Ignorando atestado duplicado recém-criado (ID: ${duplicateCheck.id}) para ${employeeName}.`);
            return duplicateCheck;
        }

        // Salvar como PENDENTE no banco
        const resolvedCid = extracted.cid ? normalizeCidCode(extracted.cid) : null;
        const resolvedCidDesc = extracted.cidDescription || (resolvedCid ? getCidDescription(resolvedCid) : null);

        const created = await prisma.medicalCertificate.create({
            data: {
                employeeId: matched?.id || null,
                extractedName: cleanPatientName || "Paciente não identificado",
                employeeName,
                cpf: matched?.cpf || extracted.cpf || null,
                startDate,
                endDate,
                daysCount: extracted.days || 1,
                cid: resolvedCid,
                cidDescription: resolvedCidDesc,
                doctorName: extracted.doctorName,
                doctorCrm: extracted.doctorCrm,
                documentUrl: downloaded.base64 || params.mediaUrl,
                status: "PENDENTE",
                source: "WHATSAPP",
                createdByName: "WhatsApp / Colaborador",
                whatsappPhone: params.senderPhone || null,
                whatsappMessageId: params.messageId || null,
                notes: `Atestado recebido via WhatsApp no grupo ${params.groupName || ""}.`.trim()
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
            cidDescription: created.cidDescription,
            source: "WHATSAPP"
        }).catch(() => {});

        return created;
    } catch (err) {
        console.error("[MedicalOCR] Falha no processamento de atestado WhatsApp:", err);
        return null;
    } finally {
        ocrProcessingLocks.delete(lockKey);
    }
}
