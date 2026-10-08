/**
 * Tabela e utilitário de consulta da CID-10 (Classificação Internacional de Doenças)
 * Focado nas patologias e códigos mais recorrentes em medicina do trabalho e atestados.
 */

export interface CidItem {
    code: string;
    description: string;
    category?: string;
}

// Catálogo com as patologias mais frequentes em atestados médicos e odontológicos no Brasil
export const CID10_DICTIONARY: Record<string, string> = {
    // -------------------------------------------------------------
    // CAPÍTULO XIII: Sistema Osteomuscular (M00 - M99)
    // -------------------------------------------------------------
    "M54": "Dorsalgia (Dor nas costas)",
    "M54.0": "Paniculite atingindo regiões do pescoço e do dorso",
    "M54.1": "Radiculopatia",
    "M54.2": "Cervicalgia (Dor no pescoço)",
    "M54.3": "Ciática (Dor no nervo ciático)",
    "M54.4": "Lumbago com ciática (Lombociatalgia)",
    "M54.5": "Dor lombar baixa (Lombalgia)",
    "M54.6": "Dor na coluna torácica",
    "M54.8": "Outra dorsalgia",
    "M54.9": "Dorsalgia não especificada",

    "M51": "Transtornos de discos intervertebrais",
    "M51.1": "Transtornos de discos lombares com radiculopatia (Hérnia de disco)",
    "M51.2": "Outro deslocamento de disco intervertebral",
    "M51.3": "Outra degeneração de disco intervertebral",
    "M51.9": "Transtorno de disco intervertebral não especificado",

    "M50": "Transtornos dos discos cervicais",
    "M50.0": "Transtorno do disco cervical com mielopatia",
    "M50.1": "Transtorno do disco cervical com radiculopatia",
    "M50.2": "Outro deslocamento de disco cervical",

    "M75": "Lesões do ombro",
    "M75.0": "Capsulite adesiva do ombro (Ombro congelado)",
    "M75.1": "Síndrome do manguito rotador",
    "M75.2": "Tendinite bicipital",
    "M75.3": "Tendinite calcificante do ombro",
    "M75.4": "Síndrome de colisão do ombro",
    "M75.5": "Bursite do ombro",
    "M75.8": "Outras lesões do ombro",
    "M75.9": "Lesão não especificada do ombro",

    "M77": "Outras entesopatias",
    "M77.0": "Epicondilite medial (Cotovelo de golfista)",
    "M77.1": "Epicondilite lateral (Cotovelo de tenista)",
    "M77.9": "Entesopatia não especificada",

    "M65": "Sinovite e tenossinovite",
    "M65.3": "Dedo em gatilho",
    "M65.4": "Tenossinovite de estilóide radial (De Quervain)",
    "M65.8": "Outras sinovites e tenossinovites",
    "M65.9": "Sinovite e tenossinovite não especificadas",

    "M79": "Outros transtornos dos tecidos moles",
    "M79.1": "Mialgia (Dor muscular)",
    "M79.2": "Nevralgia e neurite não especificadas",
    "M79.7": "Fibromialgia",
    "M79.9": "Transtorno de tecido mole não especificado",

    "M25": "Outros transtornos articulares",
    "M25.5": "Dor articular (Artralgia)",

    "G56": "Mononeuropatias dos membros superiores",
    "G56.0": "Síndrome do túnel do carpo (LER/DORT)",
    "G56.2": "Lesão do nervo ulnar",

    // -------------------------------------------------------------
    // CAPÍTULO X: Aparelho Respiratório (J00 - J99)
    // -------------------------------------------------------------
    "J00": "Nasofaringite aguda (Resfriado comum)",
    "J01": "Sinusite aguda",
    "J01.0": "Sinusite maxilar aguda",
    "J01.1": "Sinusite frontal aguda",
    "J01.9": "Sinusite aguda não especificada",
    "J02": "Faringite aguda",
    "J02.0": "Faringite estreptocócica",
    "J02.9": "Faringite aguda não especificada",
    "J03": "Amigdalite aguda (Tonsilite)",
    "J03.0": "Amigdalite estreptocócica",
    "J03.9": "Amigdalite aguda não especificada",
    "J04": "Laringite e traqueíte agudas",
    "J04.0": "Laringite aguda",
    "J06": "Infecções agudas das vias aéreas superiores (IVAS)",
    "J06.0": "Laringofaringite aguda",
    "J06.8": "Outras infecções agudas das vias aéreas superiores",
    "J06.9": "Infecção aguda das vias aéreas superiores não especificada",

    "J10": "Influenza (Gripe) por vírus identificado",
    "J10.1": "Influenza com outras manifestações respiratórias",
    "J11": "Influenza (Gripe) vírus não identificado",
    "J11.1": "Influenza com outras manifestações respiratórias (Gripe)",
    "J12": "Pneumonia viral",
    "J15": "Pneumonia bacteriana",
    "J18": "Pneumonia por microrganismo não especificado",
    "J18.0": "Broncopneumonia não especificada",
    "J18.9": "Pneumonia não especificada",
    "J20": "Bronquite aguda",
    "J20.9": "Bronquite aguda não especificada",
    "J30": "Rinite alérgica e vasomotora",
    "J30.0": "Rinite vasomotora",
    "J30.1": "Rinite alérgica devida a pólen",
    "J30.4": "Rinite alérgica não especificada",
    "J45": "Asma",
    "J45.0": "Asma predominantemente alérgica",
    "J45.9": "Asma não especificada",

    // -------------------------------------------------------------
    // CAPÍTULO I: Infecciosas e Parasitárias (A00 - B99)
    // -------------------------------------------------------------
    "A09": "Gastroenterite e colite de origem infecciosa (Diarreia aguda)",
    "A08": "Infecções intestinais virais",
    "A08.4": "Infecção intestinal viral não especificada",
    "A90": "Dengue clássica",
    "A91": "Febre hemorrágica devida ao vírus do dengue",
    "A92.0": "Febre de Chikungunya",
    "A92.8": "Outras febres virais transmitidas por mosquitos (Zika)",
    "B34": "Doença por vírus não especificada (Virose)",
    "B34.2": "Infecção por coronavírus de localização não especificada (COVID-19)",
    "B34.9": "Infecção viral não especificada (Virose comum)",
    "B01": "Varicela (Catapora)",
    "B02": "Herpes zoster (Cobreiro)",
    "B00": "Infecções pelo vírus do herpes",
    "B27": "Mononucleose infecciosa",

    // -------------------------------------------------------------
    // CAPÍTULO XI: Aparelho Digestivo e Odontologia (K00 - K93)
    // -------------------------------------------------------------
    "K29": "Gastrite e duodenite",
    "K29.0": "Gastrite hemorrágica aguda",
    "K29.1": "Outras gastrites agudas",
    "K29.5": "Gastrite crônica não especificada",
    "K29.7": "Gastrite não especificada",
    "K21": "Doença de refluxo gastroesofágico (DRGE)",
    "K21.0": "Doença de refluxo gastroesofágico com esofagite",
    "K21.9": "Doença de refluxo gastroesofágico sem esofagite",
    "K30": "Dispepsia funcional (Má digestão)",
    "K52": "Outras gastroenterites e colites não-infecciosas",
    "K52.9": "Gastroenterite e colite não-infecciosas não especificadas",
    "K58": "Síndrome do cólon irritável",
    "K35": "Apendicite aguda",
    "K40": "Hérnia inguinal",
    "K42": "Hérnia umbilical",

    // Odontologia / CRO
    "K01": "Dentes inclusos e impactados (Siso)",
    "K01.1": "Dentes impactados",
    "K02": "Cárie dentária",
    "K02.9": "Cárie dentária não especificada",
    "K04": "Doenças da polpa e tecidos periapicais (Canal/Abscesso)",
    "K04.0": "Pulpite aguda / crônica",
    "K04.7": "Abscesso periapical sem fístula",
    "K05": "Gengivite e doenças periodontais",
    "K05.0": "Gengivite aguda",
    "K08": "Outros transtornos dos dentes e do periodonto (Extração/Cirurgia)",
    "K08.1": "Perda de dentes devida a acidente ou extração",

    // -------------------------------------------------------------
    // CAPÍTULO V: Transtornos Mentais e Comportamentais (F00 - F99)
    // -------------------------------------------------------------
    "F32": "Episódio depressivo",
    "F32.0": "Episódio depressivo leve",
    "F32.1": "Episódio depressivo moderado",
    "F32.2": "Episódio depressivo grave sem sintomas psicóticos",
    "F32.9": "Episódio depressivo não especificado",
    "F33": "Transtorno depressivo recorrente",
    "F33.1": "Transtorno depressivo recorrente, episódio atual moderado",
    "F33.9": "Transtorno depressivo recorrente não especificado",
    "F41": "Outros transtornos ansiosos",
    "F41.0": "Transtorno de pânico (Ansiedade paroxística episódica)",
    "F41.1": "Ansiedade generalizada (TAG)",
    "F41.2": "Transtorno misto ansioso e depressivo",
    "F41.9": "Transtorno ansioso não especificado",
    "F43": "Reações ao estresse grave e transtornos de adaptação",
    "F43.0": "Reação aguda ao estresse",
    "F43.1": "Estado de estresse pós-traumático (TEPT)",
    "F43.2": "Transtornos de adaptação",
    "F43.8": "Outras reações ao estresse grave (Inclui Burnout / Síndrome do Esgotamento)",
    "F10": "Transtornos mentais devidos ao uso de álcool",
    "F31": "Transtorno afetivo bipolar",

    // -------------------------------------------------------------
    // CAPÍTULO XVIII: Sintomas, Sinais e Achados Anormais (R00 - R99)
    // -------------------------------------------------------------
    "R51": "Cefaleia (Dor de cabeça)",
    "G43": "Enxaqueca (Migrânea)",
    "G43.0": "Enxaqueca sem aura (Enxaqueca comum)",
    "G43.9": "Enxaqueca não especificada",
    "G44": "Outras síndromes de cefaleia",
    "G44.2": "Cefaleia tensional",

    "R50": "Febre de outra origem e de origem desconhecida",
    "R50.9": "Febre não especificada",
    "R53": "Mal-estar e fadiga (Astenia)",
    "R10": "Dor abdominal e pélvica",
    "R10.4": "Outras dores abdominais e as não especificadas (Cólica)",
    "R11": "Náusea e vômitos",
    "R42": "Tontura e instabilidade (Vertigem)",
    "H81": "Transtornos da função vestibular (Labirintite)",
    "H81.0": "Doença de Ménière",
    "H81.1": "Vertigem paroxística benigna",

    // -------------------------------------------------------------
    // CAPÍTULO VII: Doenças do Olho e Anexos (H00 - H59)
    // -------------------------------------------------------------
    "H10": "Conjuntivite",
    "H10.0": "Conjuntivite mucopurulenta",
    "H10.1": "Conjuntivite aguda atópica",
    "H10.2": "Outras conjuntivites agudas",
    "H10.9": "Conjuntivite não especificada",
    "H00": "Hordéolo e calázio (Terçol)",
    "H01": "Outras inflamações da pálpebra (Blefarite)",
    "H16": "Ceratite (Inflamação da córnea)",
    "H57": "Outros transtornos do olho e anexos (Dor/Corpo estranho ocular)",

    // -------------------------------------------------------------
    // CAPÍTULO VIII: Doenças do Ouvido (H60 - H95)
    // -------------------------------------------------------------
    "H60": "Otite externa",
    "H60.9": "Otite externa não especificada",
    "H65": "Otite média não-supurativa",
    "H66": "Otite média supurativa e a não especificada",
    "H66.9": "Otite média não especificada",
    "H92": "Otalgia e secreção auditiva (Dor de ouvido)",

    // -------------------------------------------------------------
    // CAPÍTULO XIV: Aparelho Geniturinário (N00 - N99)
    // -------------------------------------------------------------
    "N39": "Outros transtornos do aparelho urinário",
    "N39.0": "Infecção do trato urinário de localização não especificada (ITU/Cistite)",
    "N30": "Cistite",
    "N30.0": "Cistite aguda",
    "N20": "Cálculo do rim e do ureter (Cólica renal)",
    "N20.0": "Cálculo do rim",
    "N20.1": "Cálculo do ureter",
    "N23": "Cólica nefrética não especificada (Cólica de rim)",
    "N94": "Dor e outras afecções associadas com os órgãos genitais femininos e ciclo menstrual",
    "N94.6": "Dismenorreia não especificada (Cólica menstrual incapacitante)",

    // -------------------------------------------------------------
    // CAPÍTULO XIX: Lesões, Envenenamentos e Traumas (S00 - T98)
    // -------------------------------------------------------------
    "S93": "Luxação, entorse e distensão dos ligamentos do tornozelo e pé",
    "S93.4": "Entorse e distensão do tornozelo",
    "S83": "Luxação, entorse e distensão dos ligamentos do joelho",
    "S83.6": "Entorses e distensões de outras partes e das não especificadas do joelho",
    "S63": "Luxação, entorse e distensão do punho e da mão",
    "S60": "Traumatismo superficial do punho e da mão (Contusão)",
    "S60.0": "Contusão de dedo(s) sem lesão da unha",
    "S60.2": "Contusão de outras partes do punho e da mão",
    "S61": "Ferimento do punho e da mão (Corte/Laceração)",
    "S00": "Traumatismo superficial da cabeça",
    "S01": "Ferimento da cabeça",
    "S06": "Traumatismo intracraniano (Concussão)",
    "T14": "Traumatismo de região não especificada do corpo",
    "T14.0": "Traumatismo superficial de região não especificada",
    "T14.3": "Luxação, entorse e distensão de região não especificada",
    "T15": "Corpo estranho na parte externa do olho",
    "T78": "Efeitos adversos não classificados em outra parte (Reação alérgica aguda)",
    "T78.4": "Alergia não especificada",

    // -------------------------------------------------------------
    // CAPÍTULO XII: Pele e Tecido Subcutâneo (L00 - L99)
    // -------------------------------------------------------------
    "L02": "Abscesso cutâneo, furúnculo e antraz",
    "L03": "Celulite (Infecção bacteriana da pele)",
    "L20": "Dermatite atópica",
    "L23": "Dermatite de contato por alérgenos",
    "L24": "Dermatite de contato por irritantes (Ocupacional)",
    "L50": "Urticária",
    "L50.9": "Urticária não especificada",

    // -------------------------------------------------------------
    // CAPÍTULO XXI: Fatores que Influenciam o Contato com Serviços de Saúde (Z00 - Z99)
    // -------------------------------------------------------------
    "Z00": "Exame geral e investigação de pessoas sem queixas ou diagnóstico relatado",
    "Z00.0": "Exame médico geral (Check-up / Rotina)",
    "Z01": "Outros exames e investigações especiais de pessoas sem queixas ou diagnósticos",
    "Z01.0": "Exame dos olhos e da visão",
    "Z01.2": "Exame odontológico de rotina",
    "Z02": "Exame e encontro para fins administrativos (Admissional / Periódico / Demissional)",
    "Z02.1": "Exame pré-admissional",
    "Z20": "Contato com e exposição a doenças transmissíveis (Isolamento)",
    "Z20.8": "Contato com e exposição a outras doenças transmissíveis (ex: COVID-19)",
    "Z34": "Supervisão de gravidez normal (Consulta pré-natal)",
    "Z34.0": "Supervisão de primeira gravidez normal",
    "Z34.8": "Supervisão de outra gravidez normal",
    "Z76": "Pessoas em contato com serviços de saúde em outras circunstâncias",
    "Z76.0": "Emissão de prescrição médica de repetição (Receita / Consulta rápida)",
    "Z76.2": "Supervisão médica e cuidado de outro lactente e criança saudável (Acompanhamento de filho)",
    "Z76.5": "Pessoa fingindo ser doente com motivação óbvia (Simulação)",
    "Z76.8": "Pessoas em contato com serviços de saúde em outras circunstâncias especificadas",
    "Z76.9": "Pessoas em contato com serviços de saúde em circunstâncias não especificadas (Declaração de comparecimento)"
};

/**
 * Normaliza o código do CID para pesquisa uniforme.
 * Ex: "m54.5" -> "M54.5", "M545" -> "M54.5", "J 06.9" -> "J06.9"
 */
export function normalizeCidCode(rawCid?: string | null): string {
    if (!rawCid) return "";
    let clean = rawCid
        .toUpperCase()
        .replace(/CID\s*[:-]?\s*/gi, "")
        .replace(/[^A-Z0-9.]/g, "")
        .trim();

    // Se o código tem formato letra + 3 números sem ponto (ex: M545 -> M54.5, J069 -> J06.9)
    if (/^[A-Z][0-9]{3}$/.test(clean)) {
        clean = `${clean.slice(0, 3)}.${clean.slice(3)}`;
    }

    return clean;
}

/**
 * Busca a descrição oficial de um código CID-10.
 * Suporta correspondência exata ou fallback pelo grupo da patologia.
 */
export function getCidDescription(rawCid?: string | null): string | null {
    if (!rawCid) return null;
    const code = normalizeCidCode(rawCid);
    if (!code) return null;

    // 1. Busca exata (ex: "M54.5")
    if (CID10_DICTIONARY[code]) {
        return CID10_DICTIONARY[code];
    }

    // 2. Tenta código sem ponto (ex: se "M54.5" estiver cadastrado como chave alternativa)
    const codeWithoutDot = code.replace(".", "");
    if (CID10_DICTIONARY[codeWithoutDot]) {
        return CID10_DICTIONARY[codeWithoutDot];
    }

    // 3. Fallback pela categoria / prefixo (ex: "M54" para "M54.8")
    if (code.includes(".")) {
        const category = code.split(".")[0];
        if (CID10_DICTIONARY[category]) {
            return `${CID10_DICTIONARY[category]} (Grupo ${category})`;
        }
    }

    // 4. Verificação de capítulos por letra para códigos raros
    const firstLetter = code.charAt(0);
    const chapterMap: Record<string, string> = {
        "A": "Doença infecciosa ou parasitária",
        "B": "Doença infecciosa ou viral",
        "C": "Neoplasia (Tumor)",
        "D": "Doença do sangue / Neoplasia benigna",
        "E": "Doença endócrina, nutricional ou metabólica",
        "F": "Transtorno mental ou comportamental",
        "G": "Doença do sistema nervoso",
        "H": "Doença do olho ou ouvido",
        "I": "Doença do aparelho circulatório",
        "J": "Doença do aparelho respiratório",
        "K": "Doença do aparelho digestivo / Odontológica",
        "L": "Doença da pele e tecido subcutâneo",
        "M": "Doença do sistema osteomuscular e tecido conjuntivo",
        "N": "Doença do aparelho geniturinário",
        "O": "Gravidez, parto e puerpério",
        "R": "Sintomas, sinais e achados anormais clínicos",
        "S": "Traumatismo / Lesão osteomuscular",
        "T": "Intoxicação / Trauma / Efeito externo",
        "Z": "Consulta / Exame / Contato com serviço de saúde"
    };

    if (chapterMap[firstLetter]) {
        return `${chapterMap[firstLetter]} (${code})`;
    }

    return null;
}

/**
 * Realiza busca preditiva de CIDs (por código ou descrição) para componentes de autocomplete / input.
 */
export function searchCid(query: string, limit = 8): { code: string; description: string }[] {
    if (!query || query.trim().length < 2) return [];

    const normQuery = query
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const matches: { code: string; description: string }[] = [];

    // Prioridade 1: Código começa com a query
    for (const [code, desc] of Object.entries(CID10_DICTIONARY)) {
        const normDesc = desc.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        if (code.toLowerCase().startsWith(normQuery)) {
            matches.push({ code, description: desc });
            if (matches.length >= limit) return matches;
        }
    }

    // Prioridade 2: Descrição contém a query
    for (const [code, desc] of Object.entries(CID10_DICTIONARY)) {
        if (matches.some((m) => m.code === code)) continue;
        const normDesc = desc.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        if (normDesc.includes(normQuery) || code.toLowerCase().includes(normQuery)) {
            matches.push({ code, description: desc });
            if (matches.length >= limit) return matches;
        }
    }

    return matches;
}
