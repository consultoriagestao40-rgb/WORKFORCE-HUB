export interface OsTemplate {
    key: string;
    name: string;
    cbo: string;
    category: string;
    description: string;
    atividadeDescricao: string;
    riscoFisico: string;
    riscoQuimico: string;
    riscoBiologico: string;
    riscoErgonomico: string;
    riscoAcidentes: string;
    episNecessarios: string;
    medidasPreventivas: string[];
    orientacoesSeguranca: string[];
}

export const OS_TEMPLATES: OsTemplate[] = [
    {
        key: "auxiliar-limpeza",
        name: "Auxiliar de Serviços Gerais / Limpeza",
        cbo: "5143-20",
        category: "Limpeza & Conservação",
        description: "Higienização, limpeza e conservação de ambientes prediais, industriais e comerciais.",
        atividadeDescricao: "(INFORMAÇÕES CONFORME OBSERVAÇÃO TÉCNICA / RELATO DO FUNCIONÁRIO) Realizam a higienização de superfícies variadas. Utilizam água sanitária e produto químico na higienização em geral. Realizam a limpeza com mop pó, mop úmido, (LT) limpa tudo com fibra e balde espremedor. O piso é lavado com máquina lavadora de pisos a bateria ou manualmente. Trabalham com segurança, seguindo normas de higiene, qualidade, proteção ao meio ambiente, utilizam equipamento de proteção individual e coletivo, promovendo a segurança individual e da equipe.",
        riscoFisico: "Ruído intermitente e umidade em áreas molhadas.",
        riscoQuimico: "Água Sanitária, detergente líquido, desinfetantes e limpador multiuso.",
        riscoBiologico: "Vírus, bactérias e fungos provenientes da higienização de sanitários e recolhimento de lixo.",
        riscoErgonomico: "Postura inadequada, levantamento de peso e movimentos repetitivos na atividade de esfregação e transporte de baldes.",
        riscoAcidentes: "Quedas de mesmo nível em piso molhado/escorregadio, projeção de produtos químicos nos olhos e cortes em sacos de lixo.",
        episNecessarios: "Sapato de segurança emborrachado antiderrapante, Luva de Látex/Nitrílica de cano longo, Óculos de segurança com proteção lateral, Avental de PVC impermeável e Uniforme completo.",
        medidasPreventivas: [
            "Uso obrigatório e correto dos EPIs durante toda a jornada;",
            "Utilização de placas sinalizadoras de 'PISO MOLHADO' durante e após a limpeza;",
            "Não misturar produtos químicos (ex: nunca misturar cloro com desinfetantes/ácidos);",
            "Treinamento para postura ergonômica correta no manuseio de mops e baldes;",
            "Realizar pausas regulares conforme escala de trabalho."
        ],
        orientacoesSeguranca: [
            "Cumprir e respeitar o horário de expediente e intervalos;",
            "Manter os frascos de produtos químicos sempre identificados e fechados;",
            "Nunca cheirar ou provar produtos químicos desconhecidos;",
            "Não utilizar adornos (anéis, pulseiras) durante a operação de limpeza;",
            "Comunicar imediatamente qualquer acidente ou irregularidade ao encarregado."
        ]
    },
    {
        key: "operador-lavadora",
        name: "Operador de Lavadora de Piso / Máquinas",
        cbo: "5143-25",
        category: "Operação de Máquinas",
        description: "Operação de lavadoras de piso tripuladas, lavadoras tracionadas e enceradeiras industriais.",
        atividadeDescricao: "(INFORMAÇÕES CONFORME OBSERVAÇÃO TÉCNICA / RELATO DO FUNCIONÁRIO) Opera lavadora de pisos industrial a bateria/elétrica e enceradeiras industriais para lavagem e polimento de pisos em grandes áreas comerciais e industriais. Realiza o abastecimento de água e produtos químicos no tanque da máquina, executa o checklist diário de manutenção e verificação de baterias, escovas e rodos de aspiração.",
        riscoFisico: "Ruído contínuo da lavadora/enceradeira e vibração do equipamento.",
        riscoQuimico: "Detergentes alcalinos, desengordurantes industriais, ceras e removedores de cera.",
        riscoBiologico: "Resíduos e efluentes recolhidos no tanque de recuperação da máquina.",
        riscoErgonomico: "Permanência prolongada em pé ou sentado (máquinas tripuladas), postura inadequada e vibração transmitida às mãos/braços.",
        riscoAcidentes: "Colisão ou batida na condução da máquina em corredores/obstáculos, atropelamento de terceiros, choque elétrico no carregamento de baterias e quedas em piso molhado.",
        episNecessarios: "Bota de PVC/Sapato de segurança com biqueira, Luva Nitrílica/Neoprene impermeável, Protetor Auditivo tipo Concha/Plugue, Óculos de proteção ampla visão e Uniforme com faixas refletivas.",
        medidasPreventivas: [
            "Treinamento obrigatório de capacitação para operação da máquina de lavar piso;",
            "Checklist diário das condições dos freios, baterias, escovas e cabos elétricos;",
            "Condução da máquina em velocidade controlada com atenção aos pedestres;",
            "Desligar a máquina e retirar a chave antes de qualquer limpeza ou manutenção das escovas;",
            "Sinalização obrigatória da área de operação."
        ],
        orientacoesSeguranca: [
            "Não operar a máquina com defeito ou sem freios;",
            "Não transportar passageiros na máquina tripulada;",
            "Manter o local de recarga de baterias bem ventilado (risco de gases inflamáveis);",
            "Armazenar produtos químicos em local arejado e identificado;",
            "Usar protetor auricular durante todo o tempo de funcionamento da lavadora."
        ]
    },
    {
        key: "encarregado-limpeza",
        name: "Encarregado de Limpeza / Supervisor",
        cbo: "5101-10",
        category: "Liderança & Supervisão",
        description: "Supervisão da equipe operacional, controle de estoque de produtos, vistoria de postos e alinhamento com clientes.",
        atividadeDescricao: "(INFORMAÇÕES CONFORME OBSERVAÇÃO TÉCNICA / RELATO DO FUNCIONÁRIO) Supervisiona as atividades da equipe de limpeza e conservação no posto de trabalho. Distribui tarefas, inspeciona a qualidade dos serviços executados, fiscaliza o uso correto dos EPIs pelos colaboradores, controla o estoque e diluição de produtos químicos e orienta quanto às normas de segurança.",
        riscoFisico: "Ruído intermitente e variações térmicas nas vistorias de campo.",
        riscoQuimico: "Contato eventual com produtos de limpeza durante auditoria de diluição e estoque.",
        riscoBiologico: "Exposição eventual a agentes biológicos nas vistorias de sanitários e depósitos de resíduos.",
        riscoErgonomico: "Sobrecarga mental, estresse de supervisão e deslocamentos frequentes a pé.",
        riscoAcidentes: "Quedas de mesmo nível durante inspeção de áreas molhadas e batidas contra obstáculos.",
        episNecessarios: "Sapato de segurança antiderrapante, Óculos de segurança, Luvas de Látex/Nitrílica (quando necessário) e Uniforme corporativo de supervisão.",
        medidasPreventivas: [
            "Fiscalização rigorosa do uso diário de EPIs por todos os membros da equipe;",
            "Garantir a disponibilidade das Fichas de Informações de Segurança de Produtos Químicos (FISPQ);",
            "Orientar a equipe através de Diálogos Diários de Segurança (DDS);",
            "Inspecionar as condições ergonômicas e ferramentas de trabalho do posto."
        ],
        orientacoesSeguranca: [
            "Garantir que nenhum funcionário inicie atividades sem os EPIs obrigatórios;",
            "Interromper imediatamente qualquer atividade que apresente risco grave e iminente;",
            "Registrar e encaminhar comunicados de acidentes e incidentes ao SESMT/RH;",
            "Manter o livro de ocorrências atualizado e organizado."
        ]
    },
    {
        key: "jardineiro",
        name: "Jardineiro / Conservação de Áreas Verdes",
        cbo: "6220-10",
        category: "Áreas Verdes",
        description: "Manutenção de gramados, podas de árvores/arbustos, plantio e operação de roçadeiras e motopodas.",
        atividadeDescricao: "(INFORMAÇÕES CONFORME OBSERVAÇÃO TÉCNICA / RELATO DO FUNCIONÁRIO) Executa serviços de jardinagem, manutenção e conservação de áreas verdes. Realiza poda de arbustos, corte de grama com roçadeira costal a gasolina ou elétrica, adubação, irrigação, rastelação e recolhimento de galhos e folhas secas.",
        riscoFisico: "Ruído intenso da roçadeira/soprador, vibração nas mãos/braços e radiação solar não ionizante.",
        riscoQuimico: "Adubos, fertilizantes, defensivos para plantas e combustíveis (gasolina/óleo 2T).",
        riscoBiologico: "Contato com animais peçonhentos (aranhas, escorpiões, cobras), insetos (abelhas/vespas), fungos e bactérias no solo.",
        riscoErgonomico: "Postura inadequada curvada, levantamento e transporte de cargas pesadas (sacos de terra/grama) e movimentos repetitivos.",
        riscoAcidentes: "Projeção de pedras/objetos cortantes pela lâmina da roçadeira, cortes com tesouras de poda/machadinhas, picadas de animais peçonhentos e queimaduras no motor quente.",
        episNecessarios: "Perneira de segurança em couro/PVC, Protetor Facial de policarbonato, Óculos de proteção, Protetor Auditivo tipo Concha, Bota de couro com biqueira e solado resistente, Luva de Vaqueta de couro, Protetor solar e Uniforme com proteção UV.",
        medidasPreventivas: [
            "Uso obrigatório de perneira, protetor facial e auricular durante a operação de roçadeira;",
            "Inspeção visual prévia do terreno para remover pedras, arames e obstáculos antes do corte;",
            "Manutenção da distância de segurança de no mínimo 15 metros de outras pessoas;",
            "Abastecimento da roçadeira sempre com motor desligado e frio;",
            "Aplicação regular de protetor solar e hidratação contínua."
        ],
        orientacoesSeguranca: [
            "Nunca opere a roçadeira sem a saia de proteção e sem protetor facial;",
            "Cuidado ao manusear folhagens densas para evitar picadas de animais peçonhentos;",
            "Não fume durante o abastecimento da roçadeira com gasolina;",
            "Armazene ferramentas de corte em local protegido e com bainha protetora."
        ]
    },
    {
        key: "porteiro-vigia",
        name: "Porteiro / Vigia / Controlador de Acesso",
        cbo: "5174-10",
        category: "Portaria & Acesso",
        description: "Controle de acesso de pedestres e veículos, atendimento a moradores/visitantes e monitoramento de câmeras.",
        atividadeDescricao: "(INFORMAÇÕES CONFORME OBSERVAÇÃO TÉCNICA / RELATO DO FUNCIONÁRIO) Controla o acesso de pessoas, visitantes, prestadores de serviços e veículos na portaria. Recebe correspondências e encomendas, opera interfone, portões automáticos, cancelas e sistema de CFTV. Realiza rondas periódicas de inspeção nas dependências da guarita e acessos.",
        riscoFisico: "Ruído de tráfego de veículos e exposição a variações climáticas nas rondas.",
        riscoQuimico: "Inalação eventual de gases de combustão veicular (monóxido de carbono).",
        riscoBiologico: "Exposição a vírus respiratórios e bactérias pelo contato direto com grande fluxo de pessoas e correspondências.",
        riscoErgonomico: "Permanência prolongada na posição sentada ou em pé, esforço visual no monitoramento de telas (CFTV) e trabalho noturno.",
        riscoAcidentes: "Agressão física ou assalto por terceiros, atropelamento em portões/cancelas e quedas em desníveis durante rondas noturnas.",
        episNecessarios: "Sapato de segurança social com solado antiderrapante, Lanterna tática para rondas noturnas, Capa de chuva impermeável (para rondas externas) e Uniforme social completo.",
        medidasPreventivas: [
            "Manter a portaria/guarita sempre trancada com acesso restrito;",
            "Ajuste ergonômico da cadeira, apoio de pés e altura dos monitores de CFTV;",
            "Uso de lanterna em rondas noturnas;",
            "Seguir rigorosamente o protocolo de identificação antes de autorizar qualquer entrada;",
            "Realizar alternância de postura (sentado/em pé) para prevenir fadiga."
        ],
        orientacoesSeguranca: [
            "Não permitir a entrada de pessoas não autorizadas sob nenhuma circunstância;",
            "Não abandonar o posto de serviço sem a devida substituição pelo encarregado;",
            "Em caso de tentativa de invasão ou assalto, acione imediatamente o botão de pânico ou a polícia;",
            "Evitar distrações (celular pessoal) durante o controle de acessos e monitoramento."
        ]
    },
    {
        key: "copeira",
        name: "Copeira / Serviços de Copa e Café",
        cbo: "5134-25",
        category: "Copa & Alimentos",
        description: "Preparo e serviço de cafés, chás e pequenos lanches, higienização de louças e organização da copa.",
        atividadeDescricao: "(INFORMAÇÕES CONFORME OBSERVAÇÃO TÉCNICA / RELATO DO FUNCIONÁRIO) Prepara café, chá e água para reuniões e diretoria. Realiza a higienização de louças, talheres, garrafas térmicas e eletrodomésticos da copa. Organiza os insumos alimentícios e faz o abastecimento das salas de reuniões.",
        riscoFisico: "Calor gerado por cafeteiras, fogões e fornos elétricos.",
        riscoQuimico: "Detergente para louças, desengordurante e sabão líquido neutro.",
        riscoBiologico: "Contaminação cruzada por resíduos orgânicos e bactérias na manipulação de alimentos.",
        riscoErgonomico: "Movimentos repetitivos de lavagem de louça, postura em pé prolongada e transporte de bandejas.",
        riscoAcidentes: "Queimaduras por líquidos quentes (água fervente/café), cortes com louças/vidros quebrados e quedas em piso molhado.",
        episNecessarios: "Sapato de segurança branco antiderrapante impermeável, Luva de borracha para lavagem de louças, Avental impermeável, Touca descartável para cabelo e Uniforme de copeira.",
        medidasPreventivas: [
            "Uso obrigatório de touca de cabelo e luvas na manipulação e higienização;",
            "Atenção redobrada no manuseio de líquidos aquecidos e garrafas térmicas;",
            "Secar imediatamente qualquer respingo de líquido no piso da copa;",
            "Descarte de cacos de vidro em embalagem rígida e identificada para evitar cortes."
        ],
        orientacoesSeguranca: [
            "Higienizar as mãos com frequência antes de preparar alimentos ou servir cafés;",
            "Não utilizar recipientes ou louças trincadas;",
            "Desligar cafeteiras e aparelhos elétricos ao final do expediente;",
            "Manter panos de prato e bancadas sempre limpos e higienizados."
        ]
    }
];

export function getOsTemplateByKey(key: string): OsTemplate | undefined {
    return OS_TEMPLATES.find(t => t.key === key || t.name.toLowerCase().includes(key.toLowerCase()) || t.cbo === key);
}
