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
    Demissao?: string | null;
    Invisivel?: boolean | null;
    DataAlteracao?: string | null;
}

export interface SecullumBatida {
    Id: number;
    FuncionarioId: number;
    Data: string;
    Entrada1?: string;
    Saida1?: string;
    Entrada2?: string;
    Saida2?: string;
    Entrada3?: string;
    Saida3?: string;
    MemoriaEntrada1?: string;
    MemoriaSaida1?: string;
    MemoriaEntrada2?: string;
    MemoriaSaida2?: string;
    MemoriaEntrada3?: string;
    MemoriaSaida3?: string;
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
        grupos?: number[]; // pares de colunas: 1 = Entrada1/Saida1, 2 = Entrada2/Saida2, 3 = Entrada3/Saida3
    }): Promise<{ success: boolean; message: string; raw?: any }> {
        const url = `${this.baseUrl}/IntegracaoExterna/CartaoPonto/Justificativa`;
        const headers = await this.getHeaders();

        const cleanDate = params.data.includes("T") ? params.data.split("T")[0] : params.data;

        // Secullum restringe rigorosamente o campo Justificativa a no máximo 7 caracteres (Ex: "AT. MED")
        let justCodigo = (params.justificativa || "AT. MED").trim();
        if (
            justCodigo.toUpperCase().includes("ATESTADO") ||
            justCodigo.toUpperCase().includes("MED") ||
            justCodigo.length > 7
        ) {
            justCodigo = "AT. MED";
        }

        // Dia inteiro: justificar todos os pares de colunas do horário do colaborador naquele dia
        let grupos = params.grupos;
        if (!grupos || grupos.length === 0) {
            grupos = [1, 2];
            if (params.cpf) {
                try {
                    const horario = await this.getHorarioDoFuncionario(params.cpf);
                    const weekday = new Date(`${cleanDate}T12:00:00Z`).getUTCDay();
                    const dia: any = horario?.dias.find(d => d.DiaSemana === weekday);
                    if (dia) {
                        const g: number[] = [];
                        if (dia.Entrada1 || dia.Saida1) g.push(1);
                        if (dia.Entrada2 || dia.Saida2) g.push(2);
                        if (dia.Entrada3 || dia.Saida3) g.push(3);
                        if (g.length) grupos = g;
                    }
                } catch (e) {
                    console.warn("[Secullum] Não foi possível ler o horário para definir os grupos da justificativa:", e);
                }
            }
        }

        const okGroups: number[] = [];
        const errors: string[] = [];
        let lastRaw: any = null;

        for (const grupo of grupos) {
            const payload: Record<string, any> = {
                Data: `${cleanDate}T00:00:00`,
                Justificativa: justCodigo,
                Observacoes: params.observacoes || "atestado no grupo",
                Abonar: params.abonar !== false,
                Grupo: grupo
            };
            if (params.cpf) payload.Cpf = params.cpf.replace(/\D/g, "");
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
                    errors.push(`grupo ${grupo}: (${res.status}) ${await res.text()}`);
                    continue;
                }
                lastRaw = await res.json().catch(() => null);
                okGroups.push(grupo);
            } catch (error: any) {
                errors.push(`grupo ${grupo}: ${error.message || error}`);
            }
        }

        if (okGroups.length === 0) {
            return {
                success: false,
                message: `Secullum CartaoPonto retornou erro: ${errors.join(" ; ")}`
            };
        }

        return {
            success: true,
            message: errors.length
                ? `Justificativa lançada parcialmente (grupos ${okGroups.join(", ")}). Falhas: ${errors.join(" ; ")}`
                : "Justificativa lançada no cartão de ponto com sucesso!",
            raw: lastRaw
        };
    }

    /**
     * Busca o horário (escala) cadastrado no Secullum para o colaborador.
     * Retorna os dias da semana (DiaSemana 0=Domingo ... 6=Sábado) com Entrada1..Saida2.
     */
    async getHorarioDoFuncionario(cpf: string): Promise<{
        numero: number;
        descricao: string;
        dias: Array<{ DiaSemana: number; Entrada1?: string | null; Saida1?: string | null; Entrada2?: string | null; Saida2?: string | null; Entrada3?: string | null; Saida3?: string | null }>;
    } | null> {
        const headers = await this.getHeaders();
        const cleanCpf = cpf.replace(/\D/g, "");

        const fRes = await fetch(`${this.baseUrl}/IntegracaoExterna/Funcionarios/Cpf?cpf=${cleanCpf}`, { headers, cache: "no-store" });
        if (!fRes.ok) return null;
        const fData = await fRes.json();
        const func = Array.isArray(fData) ? fData[0] : fData;
        const numero = func?.Horario?.Numero;
        if (numero === undefined || numero === null) return null;

        const hRes = await fetch(`${this.baseUrl}/IntegracaoExterna/Horarios?numero=${numero}`, { headers, cache: "no-store" });
        if (!hRes.ok) return null;
        const hData = await hRes.json();
        const horario = Array.isArray(hData) ? hData[0] : hData;
        if (!horario) return null;

        return {
            numero,
            descricao: horario.Descricao || func?.Horario?.Descricao || "",
            dias: Array.isArray(horario.Dias) ? horario.Dias : []
        };
    }

    /**
     * Registro diário do cartão (batidas + horário previsto do dia em Memoria*) de um colaborador.
     */
    async getRegistroDoDia(cpf: string, dateStr: string): Promise<Record<string, any> | null> {
        const headers = await this.getHeaders();
        const cleanCpf = cpf.replace(/\D/g, "");
        const fRes = await fetch(`${this.baseUrl}/IntegracaoExterna/Funcionarios/Cpf?cpf=${cleanCpf}`, { headers, cache: "no-store" });
        if (!fRes.ok) return null;
        const fData = await fRes.json();
        const func = Array.isArray(fData) ? fData[0] : fData;
        if (!func?.Id) return null;
        const batidas = await this.getBatidas(dateStr, dateStr);
        return (batidas as any[]).find(b => b.FuncionarioId === func.Id && String(b.Data || "").startsWith(dateStr)) || null;
    }

    /**
     * Inclui uma batida manual no Cartão Ponto (ex: Entrada1 às 21:54)
     * Endpoint: POST /IntegracaoExterna/CartaoPonto/Manual
     */
    async lancarBatidaManual(params: {
        cpf: string;
        data: string;   // YYYY-MM-DD (dia da jornada no cartão)
        hora: string;   // HH:mm
        coluna: string; // Entrada1, Saida1, Entrada2, Saida2...
        motivo: string;
    }): Promise<{ success: boolean; message: string; raw?: any }> {
        const headers = await this.getHeaders();
        const cleanDate = params.data.includes("T") ? params.data.split("T")[0] : params.data;

        try {
            const res = await fetch(`${this.baseUrl}/IntegracaoExterna/CartaoPonto/Manual`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    cpf: params.cpf.replace(/\D/g, ""),
                    data: cleanDate,
                    hora: params.hora,
                    coluna: params.coluna,
                    motivo: params.motivo.slice(0, 200)
                }),
                cache: "no-store"
            });

            const text = await res.text();
            if (!res.ok) {
                return { success: false, message: `Secullum CartaoPonto/Manual retornou erro (${res.status}): ${text}` };
            }
            let raw: any = text;
            try { raw = JSON.parse(text); } catch { /* resposta vazia ou texto */ }
            return { success: true, message: `Batida ${params.coluna} ${params.hora} incluída no cartão ponto.`, raw };
        } catch (error: any) {
            return { success: false, message: `Erro na conexão com Secullum: ${error.message || error}` };
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

        const todayStr = new Date().toISOString().split("T")[0];
        const cleanInicio = params.inicio.includes("T") ? params.inicio.split("T")[0] : params.inicio;
        const cleanFim = params.fim.includes("T") ? params.fim.split("T")[0] : params.fim;
        const cleanCpf = params.cpf ? params.cpf.replace(/\D/g, "") : undefined;

        const justName = (params.justificativaNome === "Atestado Médico" || !params.justificativaNome) 
            ? "AT. MED" 
            : params.justificativaNome;

        const payload: Record<string, any> = {
            Inicio: `${cleanInicio}T00:00:00`,
            inicio: `${cleanInicio}T00:00:00`,
            Fim: `${cleanFim}T23:59:59`,
            fim: `${cleanFim}T23:59:59`,
            DataInclusao: `${todayStr}T00:00:00`,
            dataInclusao: `${todayStr}T00:00:00`,
            Motivo: params.motivo || "Atestado Médico",
            motivo: params.motivo || "Atestado Médico",
            JustificativaNome: justName,
            justificativaNome: justName,
            Grupo: 1
        };

        if (cleanCpf) {
            payload.Cpf = cleanCpf;
            payload.cpf = cleanCpf;
        }
        if (params.numeroPis) {
            payload.NumeroPis = params.numeroPis;
            payload.numeroPis = params.numeroPis;
        }
        if (params.numeroFolha) {
            payload.NumeroFolha = params.numeroFolha;
            payload.numeroFolha = params.numeroFolha;
        }

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
     * - Se for múltiplos dias: tenta registrar Afastamento ou justifica dia a dia respeitando o limite legal de 15 dias da CLT.
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
        const rawJust = params.justificativaNome || "AT. MED";
        const justNome = (
            rawJust.toUpperCase().includes("ATESTADO") ||
            rawJust.toUpperCase().includes("MED") ||
            rawJust.length > 7
        ) ? "AT. MED" : rawJust.trim();
        const obs = params.observacoes || (params.cid ? `Atestado Médico CID: ${params.cid} (atestado no grupo)` : "atestado no grupo");

        if (params.dias <= 1 || params.dataInicioStr === params.dataFimStr) {
            // Lançamento pontual de 1 dia
            const res = await this.lancarJustificativaPonto({
                cpf: cleanCpf,
                data: params.dataInicioStr,
                justificativa: justNome,
                observacoes: obs,
                abonar: true
            });
            if (!res.success && res.message.includes("Não é permitido fazer alterações de ponto e cálculos para esse usuário")) {
                res.message = "O Secullum recusou o cálculo para esta data. Verifique se o período do cartão de ponto do colaborador está aberto ou se já foi fechado para cálculos.";
            }
            return res;
        }

        // Se o atestado for maior que 15 dias: aplica a regra CLT / INSS automaticamente no Secullum
        // - Dias 1 a 15: cadastrado como "AT. MED" (responsabilidade da empresa)
        // - Dias 16 em diante: cadastrado como "AFASTAM" (afastamento previdenciário INSS)
        if (params.dias > 15) {
            const start = new Date(params.dataInicioStr + "T12:00:00Z");
            const fimEmpresa = new Date(start);
            fimEmpresa.setDate(fimEmpresa.getDate() + 14); // 15 dias corridos (ex: 27/09 a 11/10)
            const fimEmpresaStr = fimEmpresa.toISOString().split("T")[0];

            const inicioInss = new Date(fimEmpresa);
            inicioInss.setDate(inicioInss.getDate() + 1); // Dia 16 (ex: 12/10)
            const inicioInssStr = inicioInss.toISOString().split("T")[0];

            // 1. Cadastra os primeiros 15 dias da empresa como AT. MED
            const resEmpresa = await this.lancarAfastamento({
                cpf: cleanCpf,
                inicio: params.dataInicioStr,
                fim: fimEmpresaStr,
                motivo: `${obs} (15 dias empresa)`,
                justificativaNome: "AT. MED"
            });

            // 2. Cadastra os dias restantes como AFASTAM (INSS)
            const resInss = await this.lancarAfastamento({
                cpf: cleanCpf,
                inicio: inicioInssStr,
                fim: params.dataFimStr,
                motivo: "AFASTAMENTO INSS",
                justificativaNome: "AFASTAM"
            });

            if (resEmpresa.success || resInss.success) {
                return {
                    success: true,
                    message: `Lançado no Secullum com sucesso: 15 dias como AT. MED (${params.dataInicioStr} a ${fimEmpresaStr}) e os ${params.dias - 15} dias restantes como AFASTAM / INSS (${inicioInssStr} a ${params.dataFimStr}).`
                };
            }
        }

        // Atestados de até 15 dias: Registra diretamente via Afastamentos no Secullum
        const resAfastamento = await this.lancarAfastamento({
            cpf: cleanCpf,
            inicio: params.dataInicioStr,
            fim: params.dataFimStr,
            motivo: obs,
            justificativaNome: justNome
        });

        if (resAfastamento.success) {
            return resAfastamento;
        }

        // Se afastamento direto não foi aceito, lança justificativa dia a dia no cartão ponto
        // NOTA CLT: Pela legislação trabalhista, a empresa só abona até 15 dias corridos; o excedente é INSS.
        const maxDiasEmpresa = Math.min(params.dias, 15);
        const start = new Date(params.dataInicioStr + "T12:00:00Z");
        let current = new Date(start);
        let countOk = 0;
        let lastError = "";

        for (let i = 0; i < maxDiasEmpresa; i++) {
            const curStr = current.toISOString().split("T")[0];
            const pRes = await this.lancarJustificativaPonto({
                cpf: cleanCpf,
                data: curStr,
                justificativa: justNome,
                observacoes: obs,
                abonar: true
            });
            if (pRes.success) {
                countOk++;
            } else {
                lastError = pRes.message;
            }
            current.setDate(current.getDate() + 1);
        }

        if (countOk > 0) {
            if (params.dias > 15) {
                return {
                    success: true,
                    message: `Lançados os primeiros ${countOk} dias da empresa no cartão ponto. Os ${params.dias - 15} dias restantes devem ser encaminhados ao INSS (Afastamento Previdenciário).`
                };
            }
            return {
                success: true,
                message: `Lançado dia a dia no cartão ponto (${countOk} dias justificados).`
            };
        }

        let errMsg = lastError || resAfastamento.message;
        if (errMsg.includes("Não é permitido fazer alterações de ponto e cálculos para esse usuário")) {
            errMsg = `O Secullum recusou o cálculo para este colaborador/período. Como o atestado possui ${params.dias} dias, períodos além do fechamento do ponto ou acima de 15 dias exigem encaminhamento previdenciário. Utilize o botão 'Afastamento INSS' para registrar a conformidade.`;
        }

        return {
            success: false,
            message: `Falha ao lançar no Secullum: ${errMsg}`
        };
    }
}

