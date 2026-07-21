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
}
