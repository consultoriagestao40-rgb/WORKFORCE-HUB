/**
 * Módulo de Integração com a API do Secullum Ponto Web
 * Documentação Swagger: https://pontowebintegracaoexterna.secullum.com.br/swagger/v1/swagger.json
 */

export interface SecullumAfastamento {
    id?: number;
    funcionarioPis?: string;
    funcionarioCpf?: string;
    dataInicio: string;
    dataFim: string;
    motivoId?: number;
    motivoDescricao?: string;
    tipo?: string; // "Falta", "Atestado", "Afastamento"
    observacao?: string;
}

export interface SecullumSyncResult {
    success: boolean;
    message: string;
    totalImported: number;
    details?: string[];
}

export class SecullumApiClient {
    private baseUrl: string;
    private token: string;
    private companyBankId: string;

    constructor(token: string, companyBankId: string, baseUrl?: string) {
        this.token = token.trim();
        this.companyBankId = companyBankId.trim();
        this.baseUrl = (baseUrl || "https://pontowebintegracaoexterna.secullum.com.br").replace(/\/$/, "");
    }

    private getHeaders() {
        return {
            "Authorization": this.token.startsWith("Bearer ") ? this.token : `Bearer ${this.token}`,
            "secullumidbancoselecionado": this.companyBankId,
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
    }

    /**
     * Testa a validade do Token e ID do Banco buscando a lista de Empresas ou Departamentos
     */
    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            const url = `${this.baseUrl}/IntegracaoExterna/Empresas`;
            const res = await fetch(url, {
                method: "GET",
                headers: this.getHeaders(),
                cache: "no-store"
            });

            if (res.ok) {
                return { success: true, message: "Conexão com a API do Secullum Ponto Web estabelecida com sucesso!" };
            } else if (res.status === 401) {
                return { success: false, message: "Não autorizado (401). Verifique o Token de Integração do Secullum." };
            } else if (res.status === 400) {
                return { success: false, message: "Requisição inválida (400). Verifique o ID do Banco Selecionado no Secullum." };
            } else {
                const text = await res.text();
                return { success: false, message: `Erro no Secullum (${res.status}): ${text.substring(0, 200)}` };
            }
        } catch (err: any) {
            return { success: false, message: `Falha de conexão com a API do Secullum: ${err.message}` };
        }
    }

    /**
     * Busca afastamentos/faltas/atestados lançados no Secullum para a janela especificada
     */
    async getAfastamentos(startDateStr: string, endDateStr: string): Promise<SecullumAfastamento[]> {
        const url = `${this.baseUrl}/IntegracaoExterna/FuncionariosAfastamentos?dataInicio=${startDateStr}&dataFim=${endDateStr}`;
        
        const res = await fetch(url, {
            method: "GET",
            headers: this.getHeaders(),
            cache: "no-store"
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Erro ao buscar afastamentos do Secullum (${res.status}): ${errText}`);
        }

        const data = await res.json();
        return Array.isArray(data) ? data : [];
    }
}
