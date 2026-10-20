import { PrismaClient } from "@prisma/client";
import { format } from "date-fns";

const CONTA_AZUL_API_URL = "https://api-v2.contaazul.com";
const CONTA_AZUL_TOKEN_URL = "https://api-v2.contaazul.com/oauth/token";

let prismaReembolso: PrismaClient | null = null;

function getReembolsoClient(): PrismaClient {
    if (!prismaReembolso) {
        const url = process.env.DATABASE_URL_REEMBOLSO || "postgresql://neondb_owner:npg_FAXvef5z2oLN@ep-lingering-poetry-ahaduz92-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";
        prismaReembolso = new PrismaClient({
            datasources: { db: { url } }
        });
    }
    return prismaReembolso;
}

/**
 * Mapeia o nome da empresa do colaborador no Work Force Hub para a Empresa correspondente no Conta Azul / Reembolso Fácil
 */
export async function getEmpresaContaAzulForCompany(companyName?: string | null): Promise<{
    empresaId: string;
    empresaNome: string;
    config: any;
} | null> {
    const rPrisma = getReembolsoClient();

    const empresas: any[] = await rPrisma.$queryRawUnsafe(`
        SELECT e.id, e.nome, c.*
        FROM "Empresa" e
        JOIN "ContaAzulConfig" c ON c."empresaId" = e.id
        WHERE c.ativo = true;
    `);

    if (!empresas || empresas.length === 0) {
        return null;
    }

    const cName = (companyName || "").toLowerCase().trim();

    // 1. Tenta match exato ou por palavra-chave
    let matched = empresas.find(e => {
        const eNome = (e.nome || "").toLowerCase();
        if (cName.includes("tratamento") && eNome.includes("tratamento")) return true;
        if (cName.includes("spot") && eNome.includes("spot")) return true;
        if (cName.includes("clean") && eNome.includes("clean")) return true;
        if (cName.includes("jvs") && eNome.includes("facilities") && !cName.includes("tratamento")) return true;
        return false;
    });

    // 2. Fallback para JVS Facilities (primeira empresa padrão) se não houver match
    if (!matched) {
        matched = empresas.find(e => (e.nome || "").toLowerCase().includes("jvs facilities")) || empresas[0];
    }

    return {
        empresaId: matched.empresaId,
        empresaNome: matched.nome,
        config: matched
    };
}

/**
 * Garante e retorna um Access Token válido, renovando automaticamente com refresh_token se necessário.
 */
export async function getValidAccessToken(empresaId: string): Promise<string | null> {
    const rPrisma = getReembolsoClient();

    const configs: any[] = await rPrisma.$queryRawUnsafe(`
        SELECT * FROM "ContaAzulConfig" WHERE "empresaId" = $1 LIMIT 1;
    `, empresaId);

    const config = configs?.[0];
    if (!config || !config.ativo || !config.accessToken) {
        return null;
    }

    const now = new Date();
    // Se o token ainda é válido por mais de 2 minutos, usa ele diretamente
    if (config.expiresAt && new Date(config.expiresAt).getTime() > now.getTime() + 120000) {
        return config.accessToken;
    }

    // Se tiver refresh token, renova
    if (config.refreshToken && config.clientId && config.clientSecret) {
        try {
            const authHeader = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
            const bodyParams = new URLSearchParams();
            bodyParams.append("grant_type", "refresh_token");
            bodyParams.append("refresh_token", config.refreshToken);

            const res = await fetch(CONTA_AZUL_TOKEN_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Basic ${authHeader}`,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: bodyParams.toString()
            });

            const data = await res.json();

            if (res.ok && data.access_token) {
                const accessToken = data.access_token;
                const refreshToken = data.refresh_token || config.refreshToken;
                const expiresIn = Number(data.expires_in) || 3600;
                const expiresAt = new Date(Date.now() + (expiresIn - 60) * 1000);

                await rPrisma.$queryRawUnsafe(`
                    UPDATE "ContaAzulConfig"
                    SET "accessToken" = $1, "refreshToken" = $2, "expiresAt" = $3, "updatedAt" = NOW()
                    WHERE "empresaId" = $4;
                `, accessToken, refreshToken, expiresAt, empresaId);

                return accessToken;
            } else {
                console.error(`[CONTA AZUL REFRESH TOKEN ERROR - ${empresaId}]`, data);
            }
        } catch (error) {
            console.error(`[CONTA AZUL REFRESH EXCEPTION - ${empresaId}]`, error);
        }
    }

    return config.accessToken;
}

/**
 * Cliente HTTP genérico para chamar endpoints da API v2 do Conta Azul
 */
export async function fetchContaAzul(empresaId: string, endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await getValidAccessToken(empresaId);
    if (!token) {
        throw new Error("Não autenticado ou token do Conta Azul indisponível para esta empresa.");
    }

    const url = endpoint.startsWith("http") ? endpoint : `${CONTA_AZUL_API_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

    const headers: Record<string, string> = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> || {})
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 204) return { success: true };

    const text = await res.text();
    let json: any = null;
    try {
        json = JSON.parse(text);
    } catch {
        // Not JSON
    }

    if (json) {
        if (!res.ok) {
            return {
                error: json.message || json.error || `Erro retornado pela API do Conta Azul (${res.status})`,
                status: res.status,
                data: json
            };
        }
        return json;
    }

    if (!res.ok) {
        return { error: `Erro na API Conta Azul (${res.status}): ${text}`, status: res.status };
    }
    return { raw: text };
}

/**
 * Busca ou cadastra o colaborador como pessoa/fornecedor no Conta Azul
 */
export async function findOrCreateContaAzulContact(empresaId: string, contactInfo: {
    nome: string;
    cpf?: string | null;
    email?: string | null;
    telefone?: string | null;
}): Promise<{ success: boolean; contactId?: string; error?: string }> {
    try {
        const cleanCpf = contactInfo.cpf?.replace(/\D/g, "");
        const searchTerm = cleanCpf || contactInfo.nome.trim();

        // 1. Tenta buscar por CPF ou Nome via /v1/pessoas
        const searchRes = await fetchContaAzul(empresaId, `/v1/pessoas?busca=${encodeURIComponent(searchTerm)}`);
        const items = searchRes?.items || searchRes?.itens || (Array.isArray(searchRes) ? searchRes : []);

        if (items.length > 0) {
            if (cleanCpf) {
                const exactCpf = items.find((p: any) => 
                    p.documento?.replace(/\D/g, "") === cleanCpf ||
                    p.documentos?.some((d: any) => d.numero?.replace(/\D/g, "") === cleanCpf)
                );
                if (exactCpf) return { success: true, contactId: exactCpf.id };
            }

            const exactName = items.find((p: any) => 
                p.nome?.toLowerCase().trim() === contactInfo.nome.toLowerCase().trim()
            );
            if (exactName) return { success: true, contactId: exactName.id };

            return { success: true, contactId: items[0].id };
        }

        // 2. Se não encontrou, cadastra nova Pessoa (Fornecedor / Colaborador) na API v2
        const payload: any = {
            nome: contactInfo.nome.trim(),
            tipo_pessoa: "Física",
            perfis: [{ tipo_perfil: "Fornecedor" }]
        };

        if (cleanCpf && cleanCpf.length === 11) {
            payload.cpf = cleanCpf;
        }
        if (contactInfo.email) {
            payload.email = contactInfo.email;
        }
        if (contactInfo.telefone) {
            payload.telefone_celular = contactInfo.telefone;
        }

        const createRes = await fetchContaAzul(empresaId, "/v1/pessoas", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        if (createRes?.id) {
            return { success: true, contactId: createRes.id };
        } else if (createRes?.error && cleanCpf) {
            const retrySearch = await fetchContaAzul(empresaId, `/v1/pessoas?busca=${encodeURIComponent(cleanCpf)}`);
            const retryItems = retrySearch?.items || retrySearch?.itens || [];
            if (retryItems.length > 0) {
                return { success: true, contactId: retryItems[0].id };
            }
        }

        return { success: true, contactId: createRes?.id };
    } catch (error: any) {
        console.error("[CONTA AZUL CONTACT ERROR]", error);
        return { success: false, error: error.message || "Erro ao gerenciar contato no Conta Azul." };
    }
}

/**
 * Cria o Contas a Pagar no Conta Azul referente à remuneração de Férias (Art. 145 CLT)
 */
export async function createContaAzulPayableForVacation(params: {
    vacationId: string;
    employeeName: string;
    cpf: string;
    companyName: string;
    clientName: string;
    startDate: Date;
    endDate: Date;
    daysTaken: number;
    amount: number;
    notes?: string;
}): Promise<{
    success: boolean;
    payableId?: string;
    error?: string;
    empresaNome?: string;
}> {
    try {
        const empresaMatch = await getEmpresaContaAzulForCompany(params.companyName);
        if (!empresaMatch) {
            return { success: false, error: "Nenhuma empresa ativa com Conta Azul configurado no sistema." };
        }

        const { empresaId, empresaNome, config } = empresaMatch;

        // 1. Localiza ou cria o contato do colaborador no Conta Azul
        const contact = await findOrCreateContaAzulContact(empresaId, {
            nome: params.employeeName,
            cpf: params.cpf
        });

        if (!contact.contactId) {
            return { success: false, error: "Não foi possível vincular o colaborador no Conta Azul." };
        }

        // 2. Busca conta bancária/financeira ativa
        let bankAccountId = config.contaFinanceiraPadraoId;
        if (!bankAccountId) {
            const accounts = await fetchContaAzul(empresaId, "/v1/conta-financeira");
            const itens = accounts?.itens || [];
            if (itens.length > 0) {
                const pjAccount = itens.find((c: any) => c.nome?.toLowerCase().includes("pj") || c.nome?.toLowerCase().includes("corrente"));
                bankAccountId = pjAccount?.id || itens[0].id;
            }
        }

        // 3. Resolução da categoria de despesa (Adiantamento Salarial / Férias)
        const categoryId = config.categoriaAdiantamentoId || "f1d06f8c-434f-4a9e-960f-bad90f985ca8";

        // 4. Data de vencimento: 2 dias antes do início do gozo (Art. 145 CLT)
        const paymentDate = new Date(params.startDate);
        paymentDate.setDate(paymentDate.getDate() - 2);
        const dataVencimento = format(paymentDate, "yyyy-MM-dd");
        const dataCompetencia = format(params.startDate, "yyyy-MM-dd");

        const startFmt = format(params.startDate, "dd/MM/yyyy");
        const endFmt = format(params.endDate, "dd/MM/yyyy");

        const descricao = `Férias: ${params.employeeName} (${params.daysTaken}d) - ${startFmt} a ${endFmt}`;
        const observacao = `Colaborador: ${params.employeeName} | CPF: ${params.cpf} | Posto: ${params.clientName} | Vencimento D-2 CLT: ${format(paymentDate, "dd/MM/yyyy")} | ${params.notes || ""}`;

        const payload: any = {
            data_competencia: dataCompetencia,
            valor: params.amount,
            descricao,
            observacao,
            contato: contact.contactId,
            ...(bankAccountId ? { conta_financeira: bankAccountId } : {}),
            rateio: [
                {
                    id_categoria: categoryId,
                    valor: params.amount
                }
            ],
            condicao_pagamento: {
                parcelas: [
                    {
                        descricao: "Parcela Única",
                        data_vencimento: dataVencimento,
                        nota: `Férias ${params.employeeName}`,
                        metodo_pagamento: "TRANSFERENCIA_BANCARIA",
                        detalhe_valor: {
                            valor_bruto: params.amount,
                            valor_liquido: params.amount
                        }
                    }
                ]
            }
        };

        const res = await fetchContaAzul(empresaId, "/v1/financeiro/eventos-financeiros/contas-a-pagar", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        if (res?.error) {
            return { success: false, error: res.error, empresaNome };
        }

        const payableId = res?.id || res?.protocolo || `CA-FERIAS-${params.vacationId.slice(-6).toUpperCase()}`;

        return {
            success: true,
            payableId,
            empresaNome
        };
    } catch (e: any) {
        console.error("[createContaAzulPayableForVacation error]", e);
        return { success: false, error: e.message || "Erro de integração com Conta Azul." };
    }
}
