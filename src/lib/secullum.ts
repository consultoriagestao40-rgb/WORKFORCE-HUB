/**
 * Módulo de Integração com a API do Secullum Ponto Web
 * Documentação Swagger: https://pontowebintegracaoexterna.secullum.com.br/swagger/v1/swagger.json
 */

export interface SecullumAfastamento {
    Id?: number;
    NumeroPis?: string;
    Cpf?: string;
    Inicio: string;
    Fim: string;
    Motivo?: string;
    JustificativaNome?: string;
}

export interface SecullumFuncionario {
    Id: number;
    Nome: string;
    NumeroFolha?: string;
    Cpf?: string;
    NumeroPis?: string;
}

export interface SecullumBatida {
    Id: number;
    FuncionarioId: number;
    Data: string;
    Entrada1?: string;
    Saida1?: string;
    Entrada2?: string;
    Saida2?: string;
    Folga?: boolean;
    Observacoes?: string;
    Ajuste?: string;
    Compensado?: boolean;
    Funcionario?: {
        NumeroPis?: string;
        NumeroFolha?: string;
        NumeroIdentificador?: string;
    };
}

export class SecullumApiClient {
    private baseUrl: string;
    private authUrl: string;
    private email?: string;
    private password?: string;
    private token?: string;
    private companyBankId: string;

    constructor(tokenOrCredentials: string, companyBankId: string, baseUrl?: string) {
        this.companyBankId = companyBankId.trim();
        this.baseUrl = (baseUrl || "https://pontowebintegracaoexterna.secullum.com.br").replace(/\/$/, "");
        this.authUrl = "https://autenticador.secullum.com.br";

        if (tokenOrCredentials.includes(":")) {
            const lastColonIndex = tokenOrCredentials.lastIndexOf(":");
            this.email = tokenOrCredentials.substring(0, lastColonIndex).trim();
            this.password = tokenOrCredentials.substring(lastColonIndex + 1).trim();
        } else {
            this.token = tokenOrCredentials.trim();
        }
    }

    /**
     * Authenticate and get token if credentials are provided
     */
    async getAuthToken(): Promise<string> {
        if (this.token) {
            return this.token;
        }

        if (!this.email || !this.password) {
            throw new Error("Credenciais do Secullum (Email/Senha) não configuradas.");
        }

        const body = new URLSearchParams({
            grant_type: "password",
            username: this.email,
            password: this.password,
            client_id: "3"
        });

        const res = await fetch(`${this.authUrl}/Token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: body.toString(),
            cache: "no-store"
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Erro na autenticação Secullum (${res.status}): ${errText}`);
        }

        const data = await res.json();
        if (!data.access_token) {
            throw new Error("Token de acesso não retornado pelo autenticador da Secullum.");
        }

        this.token = data.access_token;
        return data.access_token;
    }

    private async getHeaders() {
        const token = await this.getAuthToken();
        return {
            "Authorization": token.startsWith("Bearer ") ? token : `Bearer ${token}`,
            "secullumidbancoselecionado": this.companyBankId,
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
    }

    /**
     * Testa a validade do Token e ID do Banco buscando a lista de Empresas
     */
    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            await this.getAuthToken();
            
            const url = `${this.baseUrl}/IntegracaoExterna/Empresas`;
            const headers = await this.getHeaders();
            const res = await fetch(url, {
                method: "GET",
                headers,
                cache: "no-store"
            });

            if (res.ok) {
                return { success: true, message: "Conexão com a API do Secullum Ponto Web estabelecida com sucesso!" };
            } else if (res.status === 401) {
                return { success: false, message: "Não autorizado (401). Verifique o Usuário/Senha de Integração do Secullum." };
            } else if (res.status === 400) {
                return { success: false, message: "Requisição inválida (400). Verifique o ID do Banco Selecionado no Secullum (Ex: 85740)." };
            } else {
                const text = await res.text();
                return { success: false, message: `Erro no Secullum (${res.status}): ${text.substring(0, 200)}` };
            }
        } catch (err: any) {
            return { success: false, message: `Falha de conexão com a API do Secullum: ${err.message}` };
        }
    }

    /**
     * Busca a lista completa de funcionários para mapear NumeroFolha -> CPF
     */
    async getFuncionarios(): Promise<SecullumFuncionario[]> {
        const url = `${this.baseUrl}/IntegracaoExterna/Funcionarios`;
        const headers = await this.getHeaders();

        const res = await fetch(url, {
            method: "GET",
            headers,
            cache: "no-store"
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Erro ao buscar funcionários do Secullum (${res.status}): ${errText}`);
        }

        const data = await res.json();
        return Array.isArray(data) ? data : [];
    }

    /**
     * Busca afastamentos/férias/INSS lançados no Secullum para a janela especificada
     */
    async getAfastamentos(startDateStr: string, endDateStr: string): Promise<SecullumAfastamento[]> {
        const url = `${this.baseUrl}/IntegracaoExterna/FuncionariosAfastamentos?dataInicio=${startDateStr}&dataFim=${endDateStr}`;
        const headers = await this.getHeaders();

        const res = await fetch(url, {
            method: "GET",
            headers,
            cache: "no-store"
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Erro ao buscar afastamentos do Secullum (${res.status}): ${errText}`);
        }

        const data = await res.json();
        return Array.isArray(data) ? data : [];
    }

    /**
     * Busca batidas de ponto para detectar faltas diárias
     */
    async getBatidas(startDateStr: string, endDateStr: string): Promise<SecullumBatida[]> {
        const url = `${this.baseUrl}/IntegracaoExterna/Batidas?DataInicio=${startDateStr}&DataFim=${endDateStr}`;
        const headers = await this.getHeaders();

        const res = await fetch(url, {
            method: "GET",
            headers,
            cache: "no-store"
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Erro ao buscar batidas do Secullum (${res.status}): ${errText}`);
        }

        const data = await res.json();
        return Array.isArray(data) ? data : [];
    }

    /**
     * Busca cálculos consolidados do Secullum para atrasos, horas extras e adicional noturno
     */
    async getCalculos(cpf: string, startDateStr: string, endDateStr: string): Promise<any> {
        const url = `${this.baseUrl}/IntegracaoExterna/Calcular`;
        const headers = await this.getHeaders();
        const finalHeaders = {
            ...headers,
            "Content-Type": "application/json"
        };

        const cleanStartDate = startDateStr.includes("T") ? startDateStr.split("T")[0] : startDateStr;
        const cleanEndDate = endDateStr.includes("T") ? endDateStr.split("T")[0] : endDateStr;

        let retries = 3;
        let delayMs = 600;

        while (retries > 0) {
            try {
                const res = await fetch(url, {
                    method: "POST",
                    headers: finalHeaders,
                    body: JSON.stringify({
                        FuncionarioCpf: cpf,
                        DataInicial: cleanStartDate,
                        DataFinal: cleanEndDate
                    }),
                    cache: "no-store"
                });

                if (res.status === 429) {
                    // Rate limit hit: wait and retry
                    await new Promise(r => setTimeout(r, delayMs));
                    delayMs *= 2;
                    retries--;
                    continue;
                }

                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`Erro ao buscar cálculos do Secullum (${res.status}): ${errText}`);
                }

                return await res.json();
            } catch (err: any) {
                if (retries <= 1) throw err;
                await new Promise(r => setTimeout(r, delayMs));
                retries--;
            }
        }

        return null;
    }

    /**
     * Busca lista de justificativas cadastradas no Secullum
     */
    async getJustificativas(): Promise<any[]> {
        const url = `${this.baseUrl}/IntegracaoExterna/Justificativas`;
        const headers = await this.getHeaders();

        try {
            const res = await fetch(url, {
                method: "GET",
                headers,
                cache: "no-store"
            });

            if (!res.ok) {
                console.warn(`[Secullum] Erro ao buscar justificativas (${res.status}): ${await res.text()}`);
                return [];
            }

            const data = await res.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error("[Secullum] Falha ao consultar justificativas:", error);
            return [];
        }
    }

    /**
     * Lança uma justificativa de abono diretamente no Cartão de Ponto para um dia específico
     * Endpoint: POST /IntegracaoExterna/CartaoPonto/Justificativa
     */
    async lancarJustificativaPonto(params: {
        cpf?: string;
        numeroPis?: string;
        numeroFolha?: string;
        data: string; // YYYY-MM-DD ou ISO
        justificativa: string;
        observacoes?: string;
        abonar?: boolean;
    }): Promise<{ success: boolean; message: string; raw?: any }> {
        const url = `${this.baseUrl}/IntegracaoExterna/CartaoPonto/Justificativa`;
        const headers = await this.getHeaders();

        const cleanDate = params.data.includes("T") ? params.data.split("T")[0] : params.data;
        const payload: Record<string, any> = {
            Data: `${cleanDate}T00:00:00`,
            Justificativa: params.justificativa,
            Observacoes: params.observacoes || "WorkForce Hub - Lançamento Automático",
            Abonar: params.abonar !== false
        };

        if (params.cpf) {
            payload.Cpf = params.cpf.replace(/\D/g, "");
        }
        if (params.numeroPis) payload.NumeroPis = params.numeroPis;
        if (params.numeroFolha) payload.NumeroFolha = params.numeroFolha;

        try {
            const res = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
                cache: "no-store"
            });

            if (!res.ok) {
                const errText = await res.text();
                return {
                    success: false,
                    message: `Secullum CartaoPonto retornou erro (${res.status}): ${errText}`
                };
            }

            const data = await res.json().catch(() => null);
            return {
                success: true,
                message: "Justificativa lançada no cartão de ponto com sucesso!",
                raw: data
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Erro na conexão com Secullum: ${error.message || error}`
            };
        }
    }

    /**
     * Cadastra um período de afastamento do funcionário no Secullum
     * Endpoint: POST /IntegracaoExterna/FuncionariosAfastamentos
     */
    async lancarAfastamento(params: {
        cpf?: string;
        numeroPis?: string;
        numeroFolha?: string;
        inicio: string; // YYYY-MM-DD ou ISO
        fim: string;    // YYYY-MM-DD ou ISO
        motivo?: string;
        justificativaNome?: string;
    }): Promise<{ success: boolean; message: string; raw?: any }> {
        const url = `${this.baseUrl}/IntegracaoExterna/FuncionariosAfastamentos`;
        const headers = await this.getHeaders();

        const cleanInicio = params.inicio.includes("T") ? params.inicio.split("T")[0] : params.inicio;
        const cleanFim = params.fim.includes("T") ? params.fim.split("T")[0] : params.fim;

        const payload: Record<string, any> = {
            Inicio: `${cleanInicio}T00:00:00`,
            Fim: `${cleanFim}T23:59:59`,
            Motivo: params.motivo || "Atestado Médico",
            JustificativaNome: params.justificativaNome || "Atestado Médico"
        };

        if (params.cpf) {
            payload.Cpf = params.cpf.replace(/\D/g, "");
        }
        if (params.numeroPis) payload.NumeroPis = params.numeroPis;
        if (params.numeroFolha) payload.NumeroFolha = params.numeroFolha;

        try {
            const res = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
                cache: "no-store"
            });

            if (!res.ok) {
                const errText = await res.text();
                return {
                    success: false,
                    message: `Secullum Afastamentos retornou erro (${res.status}): ${errText}`
                };
            }

            const data = await res.json().catch(() => null);
            return {
                success: true,
                message: "Afastamento registrado no Secullum com sucesso!",
                raw: data
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Erro na conexão com Secullum: ${error.message || error}`
            };
        }
    }

    /**
     * Envia um atestado médico para o Secullum:
     * - Se for 1 dia: aplica diretamente a justificativa no Cartão de Ponto.
     * - Se for múltiplos dias: cadastra o Afastamento e também preenche as justificativas do período.
     */
    async lancarAtestadoMedico(params: {
        cpf: string;
        dataInicioStr: string; // YYYY-MM-DD
        dataFimStr: string;    // YYYY-MM-DD
        dias: number;
        justificativaNome?: string;
        cid?: string;
        observacoes?: string;
    }): Promise<{ success: boolean; message: string; details?: any }> {
        const cleanCpf = params.cpf.replace(/\D/g, "");
        const justNome = params.justificativaNome || "Atestado Médico";
        const obs = `Atestado Médico CID: ${params.cid || "N/I"} - ${params.observacoes || ""}`.trim();

        if (params.dias <= 1 || params.dataInicioStr === params.dataFimStr) {
            // Lançamento pontual de 1 dia
            const res = await this.lancarJustificativaPonto({
                cpf: cleanCpf,
                data: params.dataInicioStr,
                justificativa: justNome,
                observacoes: obs,
                abonar: true
            });
            return res;
        }

        // Múltiplos dias: Lança no Afastamentos
        const resAfastamento = await this.lancarAfastamento({
            cpf: cleanCpf,
            inicio: params.dataInicioStr,
            fim: params.dataFimStr,
            motivo: obs,
            justificativaNome: justNome
        });

        // Se afastamento funcionou, retorna sucesso
        if (resAfastamento.success) {
            return resAfastamento;
        }

        // Se a empresa não tiver módulo de afastamento liberado no banco, tenta justificar dia a dia
        console.warn("[Secullum] Afastamento falhou, tentando lançar dia a dia:", resAfastamento.message);
        const start = new Date(params.dataInicioStr + "T12:00:00Z");
        const end = new Date(params.dataFimStr + "T12:00:00Z");
        let current = new Date(start);
        let countOk = 0;

        while (current <= end) {
            const curStr = current.toISOString().split("T")[0];
            const pRes = await this.lancarJustificativaPonto({
                cpf: cleanCpf,
                data: curStr,
                justificativa: justNome,
                observacoes: obs,
                abonar: true
            });
            if (pRes.success) countOk++;
            current.setDate(current.getDate() + 1);
        }

        if (countOk > 0) {
            return {
                success: true,
                message: `Lançado dia a dia no cartão ponto (${countOk} dias justificados).`
            };
        }

        return {
            success: false,
            message: `Falha ao lançar no Secullum: ${resAfastamento.message}`
        };
    }
}

