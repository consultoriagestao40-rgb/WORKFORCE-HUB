export interface DismissalTemplateItem {
    id?: string;
    key: string;
    title: string;
    category: 'DISPENSA_COM_AVISO' | 'DISPENSA_SEM_AVISO' | 'TERMINO_EXP_ANTECIPADO' | 'TERMINO_EXP_PRAZO' | 'OUTROS';
    description: string;
    bodyText: string;
    isDefault?: boolean;
}

export const DEFAULT_DISMISSAL_TEMPLATES: DismissalTemplateItem[] = [
    {
        key: 'AVISO_TRABALHADO',
        title: 'Aviso Prévio Trabalhado do Empregador',
        category: 'DISPENSA_COM_AVISO',
        description: 'Dispensa sem justa causa com cumprimento de aviso prévio trabalhado e redução de jornada (Art. 488 CLT).',
        isDefault: true,
        bodyText: `AVISO PRÉVIO DO EMPREGADOR PARA DISPENSA DO EMPREGADO

{{EMPRESA_NOME}}
CNPJ: {{EMPRESA_CNPJ}}

Ao
Sr(a). {{COLABORADOR_NOME}}
C.T.P.S.: {{CTPS_NUMERO}}  Série: {{CTPS_SERIE}}
PIS: {{PIS_NUMERO}}
Data admissão: {{DATA_ADMISSAO}}

Pelo presente notificamos que a {{QTD_DIAS}} dias contados após a data da entrega deste, não mais serão utilizados os seus serviços pela nossa empresa, e por isso vimos avisá-lo, nos termos e para os efeitos do disposto no art. 487 - itens - I e II - Cap.VI - Título IV, do Decreto Lei nº 5.452, de 1º de maio de 1943 da CONSOLIDAÇÃO DAS LEIS DO TRABALHO.

Até o término do aviso prévio, V.Sª terá uma redução no seu horário de trabalho, sem prejuízo de seu salário integral, sendo-lhe facultada, de acordo com a CONSOLIDAÇÃO DAS LEIS DO TRABALHO, artigo 488, parágrafo único, a opção por uma das seguintes alternativas:

( {{OPT_DUAS_HORAS}} ) redução de 02 (duas) horas diárias em seu horário normal de trabalho; ou

( {{OPT_SETE_DIAS}} ) redução de 07 (sete) dias corridos.

Solicitamos a devolução do presente com o seu "ciente".

{{CIDADE_UF}}, {{DATA_EXTENSO}}.`
    },
    {
        key: 'AVISO_INDENIZADO',
        title: 'Aviso Prévio Indenizado do Empregador',
        category: 'DISPENSA_SEM_AVISO',
        description: 'Dispensa sem justa causa com aviso prévio indenizado imediatamente pela empresa.',
        isDefault: true,
        bodyText: `AVISO INDENIZADO DO EMPREGADOR PARA DISPENSA DO EMPREGADO

{{EMPRESA_NOME}}
CNPJ: {{EMPRESA_CNPJ}}

À
Sr(a). {{COLABORADOR_NOME}}
C.T.P.S.: {{CTPS_NUMERO}}  Série: {{CTPS_SERIE}}
PIS: {{PIS_NUMERO}}
Data admissão: {{DATA_ADMISSAO}}

Pelo presente notificamos que após a data da entrega deste, não mais serão utilizados os seus serviços pela nossa empresa, e por isso vimos avisá-lo, nos termos e para os efeitos do disposto no art. 487 - itens - I e II - Cap.VI - Título IV, do Decreto Lei nº 5.452, de 1º de maio de 1943 da CONSOLIDAÇÃO DAS LEIS DO TRABALHO.

Solicitamos a devolução do presente com o seu "ciente".

{{CIDADE_UF}}, {{DATA_EXTENSO}}.`
    },
    {
        key: 'TERMINO_EXP_ANTECIPADO',
        title: 'Dispensa por Término Antecipado de Contrato de Experiência',
        category: 'TERMINO_EXP_ANTECIPADO',
        description: 'Rescisão antecipada do contrato de trabalho por experiência por iniciativa da empresa (Art. 445 da CLT).',
        isDefault: true,
        bodyText: `DISPENSA POR TÉRMINO ANTECIPADO DE CONTRATO DE EXPERIÊNCIA

==================================================
=== SR(a). {{COLABORADOR_NOME}}

Pelo presente, o notificamos que a IMEDIATO da data da entrega deste, não mais serão utilizados os seus serviços pela nossa firma e por isso avisá-lo, nos Termos e para os efeitos do dispositivo no Art. 445, parágrafo único da CLT.

INICIO CONTRATO: {{DATA_INICIO_CONTRATO}}
FIM DO CONTRATO: {{DATA_FIM_CONTRATO}}

Pedimos a devolução da presente com seu "CIENTE"
Saudações,

.............................

{{CIDADE_UF}}, {{DATA_EXTENSO}}
CIENTE,`
    },
    {
        key: 'TERMINO_EXP_PRAZO',
        title: 'Dispensa por Término de Contrato de Experiência (No Prazo)',
        category: 'TERMINO_EXP_PRAZO',
        description: 'Rescisão no término regular do período de experiência acordado (Art. 445 da CLT).',
        isDefault: true,
        bodyText: `DISPENSA POR TÉRMINO DE CONTRATO DE EXPERIÊNCIA

==================================================
=== SR(a). {{COLABORADOR_NOME}}

Pelo presente, o notificamos que a IMEDIATO da data da entrega deste, não mais serão utilizados os seus serviços pela nossa firma e por isso avisá-lo, nos Termos e para os efeitos do dispositivo no Art. 445, parágrafo único da CLT.

INICIO CONTRATO: {{DATA_INICIO_CONTRATO}}
FIM DO CONTRATO: {{DATA_FIM_CONTRATO}}

Pedimos a devolução da presente com seu "CIENTE"
Saudações,

.............................

{{CIDADE_UF}}, {{DATA_EXTENSO}}
CIENTE,`
    }
];

export const DISMISSAL_TEMPLATE_TAGS = [
    { tag: '{{EMPRESA_NOME}}', desc: 'Razão social ou nome fantasia da empresa' },
    { tag: '{{EMPRESA_CNPJ}}', desc: 'CNPJ formatado da empresa empregadora' },
    { tag: '{{COLABORADOR_NOME}}', desc: 'Nome completo do colaborador' },
    { tag: '{{CPF}}', desc: 'CPF do colaborador' },
    { tag: '{{CTPS_NUMERO}}', desc: 'Número da Carteira de Trabalho' },
    { tag: '{{CTPS_SERIE}}', desc: 'Série da CTPS' },
    { tag: '{{PIS_NUMERO}}', desc: 'Número do PIS/PASEP' },
    { tag: '{{CARGO}}', desc: 'Cargo / Função ocupada' },
    { tag: '{{DATA_ADMISSAO}}', desc: 'Data de admissão (DD/MM/AAAA)' },
    { tag: '{{QTD_DIAS}}', desc: 'Quantidade de dias do aviso (ex: 30)' },
    { tag: '{{OPT_DUAS_HORAS}}', desc: 'Marca "X" se optou por 2 horas diárias' },
    { tag: '{{OPT_SETE_DIAS}}', desc: 'Marca "X" se optou por 7 dias corridos' },
    { tag: '{{DATA_INICIO_CONTRATO}}', desc: 'Data de início do contrato de experiência' },
    { tag: '{{DATA_FIM_CONTRATO}}', desc: 'Data de término do contrato de experiência' },
    { tag: '{{DATA_INICIO_AVISO}}', desc: 'Data de início do aviso prévio' },
    { tag: '{{DATA_FIM_AVISO}}', desc: 'Data de término do aviso prévio' },
    { tag: '{{CIDADE_UF}}', desc: 'Cidade e UF da empresa ou posto (ex: PINHAIS-PR)' },
    { tag: '{{DATA_EXTENSO}}', desc: 'Data por extenso (ex: 14 DE AGOSTO DE 2026)' }
];

export function formatPortugueseDateExtended(date: Date = new Date()): string {
    const months = [
        "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
        "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
    ];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} DE ${month} DE ${year}`;
}

export function populateDismissalNoticeText(
    templateText: string,
    context: {
        empresaNome: string;
        empresaCnpj: string;
        colaboradorNome: string;
        cpf: string;
        ctpsNumero: string;
        ctpsSerie: string;
        pisNumero: string;
        cargo: string;
        dataAdmissao: string;
        qtdDias: string;
        optDuasHoras: boolean;
        optSeteDias: boolean;
        dataInicioContrato: string;
        dataFimContrato: string;
        dataInicioAviso: string;
        dataFimAviso: string;
        cidadeUf: string;
        dataExtenso: string;
    }
): string {
    return templateText
        .replace(/\{\{EMPRESA_NOME\}\}/g, context.empresaNome || "EMPRESA CONTRATANTE")
        .replace(/\{\{EMPRESA_CNPJ\}\}/g, context.empresaCnpj || "00.000.000/0001-00")
        .replace(/\{\{COLABORADOR_NOME\}\}/g, (context.colaboradorNome || "").toUpperCase())
        .replace(/\{\{CPF\}\}/g, context.cpf || "")
        .replace(/\{\{CTPS_NUMERO\}\}/g, context.ctpsNumero || "-")
        .replace(/\{\{CTPS_SERIE\}\}/g, context.ctpsSerie || "-")
        .replace(/\{\{PIS_NUMERO\}\}/g, context.pisNumero || "-")
        .replace(/\{\{CARGO\}\}/g, context.cargo || "-")
        .replace(/\{\{DATA_ADMISSAO\}\}/g, context.dataAdmissao || "-")
        .replace(/\{\{QTD_DIAS\}\}/g, context.qtdDias || "30")
        .replace(/\{\{OPT_DUAS_HORAS\}\}/g, context.optDuasHoras ? "X" : " ")
        .replace(/\{\{OPT_SETE_DIAS\}\}/g, context.optSeteDias ? "X" : " ")
        .replace(/\{\{DATA_INICIO_CONTRATO\}\}/g, context.dataInicioContrato || context.dataAdmissao || "-")
        .replace(/\{\{DATA_FIM_CONTRATO\}\}/g, context.dataFimContrato || "-")
        .replace(/\{\{DATA_INICIO_AVISO\}\}/g, context.dataInicioAviso || "-")
        .replace(/\{\{DATA_FIM_AVISO\}\}/g, context.dataFimAviso || "-")
        .replace(/\{\{CIDADE_UF\}\}/g, (context.cidadeUf || "PINHAIS-PR").toUpperCase())
        .replace(/\{\{DATA_EXTENSO\}\}/g, (context.dataExtenso || formatPortugueseDateExtended()).toUpperCase());
}
