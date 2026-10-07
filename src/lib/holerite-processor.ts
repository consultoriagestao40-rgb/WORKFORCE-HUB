import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

export interface ExtractedHoleriteItem {
    id: string;
    pageIndices: number[]; // 0-indexed page numbers in the source PDF
    pageNumbersDisplay: string; // e.g. "1" or "1-2"
    pageNumber?: number;
    employeeName: string;
    cpf: string;
    registrationCode?: string;
    companyName?: string;
    cnpj?: string;
    competence?: string; // e.g. "08/2026"
    payrollType?: string; // e.g. "Folha Mensal", "Adiantamento", "13º Salário"
    customFileName?: string;
    pdfBytes?: Uint8Array;
    pdfBlobUrl?: string;
    // Campos Financeiros & Auditoria
    baseSalary?: number;
    totalEarnings?: number; // Total Vencimentos / Proventos
    totalDeductions?: number; // Total Descontos
    netSalary?: number; // Valor Líquido
    workedDays?: number; // Dias trabalhados informados
    absenceDays?: number; // Faltas
    absenceDeduction?: number; // R$ Desconto de faltas
    rubrics?: HoleriteRubricItem[]; // Linhas detalhadas de proventos e descontos
}

export interface HoleriteRubricItem {
    code?: string;
    description: string;
    reference?: string;
    earnings?: number;
    deductions?: number;
}

export type NamingPattern = 
    | 're-nome'
    | 'codigo-nome'
    | 'nome-re'
    | 're-nome-comp'
    | 'nome-re-comp'
    | 'comp-nome-re'
    | 'holerite-nome-comp'
    | 'comp-nome-cpf'
    | 'custom';

// Helper to sanitize file names for OS compatibility
export function sanitizeFileName(name: string): string {
    return name
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
}

// Format CPF: 000.000.000-00
export function formatCPF(cpfRaw: string): string {
    const cleaned = cpfRaw.replace(/\D/g, '');
    if (cleaned.length === 11) {
        return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cpfRaw;
}

// Clean unformatted CPF
export function cleanCPF(cpfRaw: string): string {
    return cpfRaw.replace(/\D/g, '');
}

// Month name map for competence parsing
const MONTH_NAMES: Record<string, string> = {
    'janeiro': '01',
    'fevereiro': '02',
    'marco': '03',
    'março': '03',
    'abril': '04',
    'maio': '05',
    'junho': '06',
    'julho': '07',
    'agosto': '08',
    'setembro': '09',
    'outubro': '10',
    'novembro': '11',
    'dezembro': '12'
};

/**
 * Parses raw text extracted from a single page of payroll slip
 */
export function extractDataFromPageText(text: string, pageNumber: number): {
    employeeName: string;
    cpf: string;
    registrationCode?: string;
    companyName?: string;
    cnpj?: string;
    competence?: string;
    payrollType?: string;
    baseSalary?: number;
    totalEarnings?: number;
    totalDeductions?: number;
    netSalary?: number;
    workedDays?: number;
    absenceDays?: number;
    absenceDeduction?: number;
    rubrics?: HoleriteRubricItem[];
} {
    let employeeName = `Colaborador_Pagina_${pageNumber}`;
    let cpf = '';
    let registrationCode = '';
    let companyName = '';
    let cnpj = '';
    let competence = '';
    let payrollType = 'Folha Mensal';

    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n').map(l => l.trim()).filter(Boolean);

    // 1. Extract CPF
    const cpfMatchFormatted = normalizedText.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
    if (cpfMatchFormatted) {
        cpf = cpfMatchFormatted[0];
    } else {
        // Look for CPF keyword followed by 11 digits
        const cpfKeywordMatch = normalizedText.match(/CPF[:\s]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})/i);
        if (cpfKeywordMatch) {
            cpf = formatCPF(cpfKeywordMatch[1]);
        }
    }

    // 2. Extract CNPJ
    const cnpjMatch = normalizedText.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
    if (cnpjMatch) {
        cnpj = cnpjMatch[0];
    }

    // 3. Extract Competence / Mês de Referência
    // Format MM/AAAA or MM/AA
    const compMatch = normalizedText.match(/(?:Compet[êe]ncia|Refer[êe]ncia|M[êe]s\/Ano|Per[ií]odo|Data de Emiss[aã]o)[:\s]*([0-1]?\d[\/-]20\d{2}|[0-1]?\d[\/-]\d{2})/i);
    if (compMatch) {
        let raw = compMatch[1].replace('-', '/');
        if (raw.length === 5 && raw.includes('/')) { // e.g. 08/26 -> 08/2026
            const parts = raw.split('/');
            if (parts[0].length === 1) parts[0] = '0' + parts[0];
            raw = `${parts[0]}/20${parts[1]}`;
        }
        competence = raw;
    } else {
        // Search for Month Name (e.g. Agosto/2026 or Agosto de 2026)
        const monthMatch = normalizedText.match(/(Janeiro|Fevereiro|Março|Marco|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)[\s\/\-_de]+(20\d{2})/i);
        if (monthMatch) {
            const m = MONTH_NAMES[monthMatch[1].toLowerCase()] || '01';
            competence = `${m}/${monthMatch[2]}`;
        } else {
            // Generic MM/YYYY match in text
            const genericComp = normalizedText.match(/\b(0[1-9]|1[0-2])\/(20\d{2})\b/);
            if (genericComp) {
                competence = genericComp[0];
            }
        }
    }

    // 4. Extract Payroll Type
    if (/adiantamento/i.test(normalizedText)) {
        payrollType = 'Adiantamento';
    } else if (/13[ºo°]?\s*sal[aá]rio/i.test(normalizedText) || /d[eé]cimo\s*terceiro/i.test(normalizedText)) {
        payrollType = '13º Salário';
    } else if (/f[eé]rias/i.test(normalizedText)) {
        payrollType = 'Recibo de Férias';
    } else if (/rescis[aã]o/i.test(normalizedText)) {
        payrollType = 'Termo de Rescisão';
    } else if (/pro-labore|pr[oó]\s*labore/i.test(normalizedText)) {
        payrollType = 'Pró-Labore';
    }

    // 5. Extract Employee Name & Registration Code (RE / Matrícula)
    // Priority 0: Domínio two-line layout:
    // Line i: "Código Nome do Funcionário CBO Departamento Filial"
    // Line i+1: "214 SABRINA APARECIDA NUNES CRIVELARO 514320 21 1"
    for (let i = 0; i < lines.length - 1; i++) {
        if (/Nome\s+do\s+(?:Funcion[aá]rio|Empregado)/i.test(lines[i])) {
            const nextL = lines[i + 1].replace(/\s+/g, ' ').trim();
            const empM = nextL.match(/^(\d{1,8})\s+([A-ZÀ-Ú\s]{3,80}?)(?:\s+\d{4,8}|\s*$)/i);
            if (empM) {
                registrationCode = empM[1].trim();
                const extracted = empM[2].trim().toUpperCase();
                if (extracted.length >= 3 && !/RECIBO|FOLHA|EMPRESA|TOTAL/i.test(extracted)) {
                    employeeName = extracted;
                    break;
                }
            }
        }
    }

    // Priority 1: Domínio Sistemas / Onvio / Thomson Reuters:
    // "CC: 108 Código ZURIMA ROXANA LEON GARCIA Nome do Funcionário"
    // "108 Código ZURIMA ROXANA LEON GARCIA Nome do Funcionário"
    if (!employeeName || employeeName.startsWith('Colaborador_Pagina')) {
        const dominioMatch = normalizedText.match(/(?:CC:?\s*)?(\d{1,8})\s+C[oó]digo\s+([A-ZÀ-Ú\s]{3,80}?)\s+(?:Nome\s+do\s+Funcion[aá]rio|Nome\s+do\s+Empregado|Nome)/i);
        if (dominioMatch) {
            registrationCode = dominioMatch[1].trim();
            const extracted = dominioMatch[2].replace(/\s+/g, ' ').trim().toUpperCase();
            if (extracted.length >= 3 && !/RECIBO|FOLHA|PAGAMENTO|EMPRESA|TOTAL/i.test(extracted)) {
                employeeName = extracted;
            }
        }
    }

    // Priority 2: Alternative Domínio without CC: "Código ZURIMA ROXANA LEON GARCIA Nome do Funcionário"
    if (!employeeName || employeeName.startsWith('Colaborador_Pagina')) {
        const d2 = normalizedText.match(/C[oó]digo\s+([A-ZÀ-Ú\s]{3,80}?)\s+(?:Nome\s+do\s+Funcion[aá]rio|Nome\s+do\s+Empregado|Nome)/i);
        if (d2) {
            const extracted = d2[1].replace(/\s+/g, ' ').trim().toUpperCase();
            if (extracted.length >= 3 && !/RECIBO|FOLHA|PAGAMENTO|EMPRESA|TOTAL/i.test(extracted)) {
                employeeName = extracted;
            }
        }
    }

    // Priority 3: Check for explicit RE / Matrícula / Código
    if (!registrationCode) {
        const explicitReMatch = normalizedText.match(/\b(?:R\.?E\.?|RE|Matr[ií]cula|C[oó]digo|Cod|Registro|Reg|CC)[:\s]*([0-9]{1,8})\b/i);
        if (explicitReMatch) {
            registrationCode = explicitReMatch[1];
        }
    }

    // Priority 4: Questor / Totvs / Alterdata / Senior / Standard layout
    if (!employeeName || employeeName.startsWith('Colaborador_Pagina')) {
        const nameRegexes = [
            /(?:Empregado|Funcion[aá]rio|Colaborador|Trabalhador|R\.?E\.?|RE)[:\s]+(?:(\d{1,8})\s*[-–\s]\s*)?([A-ZÀ-Úa-zà-ú'\.\s]{3,80})/i,
            /Nome\s*(?:do\s*Empregado|do\s*Funcion[aá]rio|do\s*Colaborador)?[:\s]+(?:(\d{1,8})\s*[-–\s]\s*)?([A-ZÀ-Úa-zà-ú'\.\s]{3,80})/i,
            /C[oó]digo\s*Nome\s*do\s*Empregado[\s\S]*?(\d{1,8})\s+([A-ZÀ-Ú\s]{3,80})/i,
            /\b(00\d{2,6}|\d{1,6})\s+([A-ZÀ-Ú\s]{3,80})\s+(?:C\.?P\.?F|CPF|PIS|CARTEIRA|CARGO|ADMISSÃO)/i,
            /\b(?:C\.?P\.?F|CPF)[:\s]*\d{3}\.\d{3}\.\d{3}-\d{2}[\s\S]*?(?:Nome|Empregado)[:\s]+([A-ZÀ-Úa-zà-ú'\.\s]{3,80})/i
        ];

        for (const regex of nameRegexes) {
            const match = normalizedText.match(regex);
            if (match) {
                if (match.length >= 3 && match[1] && /^\d+$/.test(match[1]) && !registrationCode) {
                    registrationCode = match[1];
                }

                let extracted = match[match.length - 1].trim();
                extracted = extracted
                    .replace(/(?:C\.?P\.?F\.?|CPF|PIS|PASEP|CARTEIRA|CTPS|CBO|CARGO|DEP|FUNÇÃO|DATA|ADMISSÃO|MATRÍCULA|SALÁRIO|DEPARTAMENTO)[\s\S]*/i, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (extracted.length >= 3 && !/^\d+$/.test(extracted) && !/RECIBO|FOLHA|PAGAMENTO|EMPRESA|TOTAL|MENSAL/i.test(extracted)) {
                    employeeName = extracted.toUpperCase();
                    break;
                }
            }
        }
    }

    // Secondary fallback for RE if still empty
    if (!registrationCode) {
        const lineCodeMatch = normalizedText.match(/\b(00\d{2,6}|\d{2,6})\s+[-–]\s+[A-ZÀ-Ú]/i);
        if (lineCodeMatch) {
            registrationCode = lineCodeMatch[1];
        }
    }

    // 6. Extract Company Name
    // In Domínio: "JVS - TRATAMENTO DE PISOS E COMERCIO LTDA - EPP 00.087.795/0001-17"
    const compMatchDominio = normalizedText.match(/([A-ZÀ-Ú\s\.\-]{5,80}?)\s+\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/i);
    if (compMatchDominio) {
        companyName = compMatchDominio[1].replace(/\s+/g, ' ').trim();
    } else {
        const companyMatch = normalizedText.match(/(?:Raz[aã]o\s*Social|Empresa)[:\s]+([A-ZÀ-Úa-zà-ú0-9\.\,\s\-]{3,80})/i);
        if (companyMatch) {
            companyName = companyMatch[1].replace(/(?:CNPJ|ENDEREÇO|BAIRRO|CIDADE)[\s\S]*/i, '').trim();
        } else if (lines.length > 0) {
            const firstLine = lines[0];
            if (firstLine && !/RECIBO|DEMONSTRATIVO|PÁGINA|PAGE/i.test(firstLine) && firstLine.length > 3) {
                companyName = firstLine;
            }
        }
    }

    // 7. Extract Financial Values (Base Salary, Total Earnings, Total Deductions, Net Salary, Absence Deductions)
    const parseCurrency = (valStr: string | undefined): number => {
        if (!valStr) return 0;
        const clean = valStr.replace(/[^\d,\.-]/g, '').replace(/\./g, '').replace(',', '.');
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    };

    let baseSalary = 0;
    let totalEarnings = 0;
    let totalDeductions = 0;
    let netSalary = 0;
    let absenceDays = 0;
    let absenceDeduction = 0;
    let workedDays = 30;

    // Base Salary: value after or value before or next line
    // e.g. "Salário Base 1.764,00" or "2.611,00 Salário Base" or on subsequent line in table
    const baseSalMatch1 = normalizedText.match(/(?:Sal[aá]rio\s*Base|Sal\.?\s*Base)[:\s]*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i);
    const baseSalMatch2 = normalizedText.match(/([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s*(?:Sal[aá]rio\s*Base|Sal\.?\s*Base)/i);
    if (baseSalMatch1) {
        baseSalary = parseCurrency(baseSalMatch1[1]);
    } else if (baseSalMatch2) {
        baseSalary = parseCurrency(baseSalMatch2[1]);
    } else {
        // Multi-line table check: line with "Salário Base" followed by numbers on next line
        for (let i = 0; i < lines.length - 1; i++) {
            if (/Sal[aá]rio\s*Base/i.test(lines[i])) {
                const nums = Array.from(lines[i + 1].matchAll(/([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g)).map(m => parseCurrency(m[1]));
                if (nums.length > 0 && baseSalary === 0) {
                    baseSalary = nums[0];
                    break;
                }
            }
        }
    }

    // Total Earnings, Total Deductions, Net Salary:
    // Format 1: Domínio layout "Declaro ter recebido a importância líquida discriminada neste recibo. [Vencimentos] [Descontos] [Líquido]"
    const totalsDominioMatch = normalizedText.match(/(?:Declaro ter recebido a import[aâ]ncia l[ií]quida discriminada neste recibo|Total de Vencimentos[\s\S]*?Valor L[ií]quido)[\s\S]*?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i);
    if (totalsDominioMatch) {
        totalEarnings = parseCurrency(totalsDominioMatch[1]);
        totalDeductions = parseCurrency(totalsDominioMatch[2]);
        netSalary = parseCurrency(totalsDominioMatch[3]);
    } else {
        // Multi-line Domínio check: header line "Total de Vencimentos Total de Descontos"
        for (let i = 0; i < lines.length; i++) {
            if (/Total\s+de\s+Vencimentos/i.test(lines[i]) && /Total\s+de\s+Descontos/i.test(lines[i])) {
                for (let j = i; j <= Math.min(i + 2, lines.length - 1); j++) {
                    const nums = Array.from(lines[j].matchAll(/([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g)).map(m => parseCurrency(m[1]));
                    if (nums.length >= 2) {
                        totalEarnings = nums[nums.length - 2];
                        totalDeductions = nums[nums.length - 1];
                        break;
                    }
                }
            }
            if (/Valor\s*L[ií]quido/i.test(lines[i])) {
                const nums = Array.from(lines[i].matchAll(/([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g)).map(m => parseCurrency(m[1]));
                if (nums.length > 0) {
                    netSalary = nums[nums.length - 1];
                } else if (i + 1 < lines.length) {
                    const nextNums = Array.from(lines[i + 1].matchAll(/([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g)).map(m => parseCurrency(m[1]));
                    if (nextNums.length > 0) netSalary = nextNums[nextNums.length - 1];
                }
            }
        }

        // Standard labels
        if (totalEarnings === 0) {
            const earningsMatch = normalizedText.match(/(?:Total\s*(?:de\s*)?(?:Vencimentos|Proventos))[:\s]*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i);
            if (earningsMatch) totalEarnings = parseCurrency(earningsMatch[1]);
        }

        if (totalDeductions === 0) {
            const deductionsMatch = normalizedText.match(/(?:Total\s*(?:de\s*)?Descontos)[:\s]*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i);
            if (deductionsMatch) totalDeductions = parseCurrency(deductionsMatch[1]);
        }

        if (netSalary === 0) {
            const netMatch = normalizedText.match(/(?:Valor\s*L[ií]quido|L[ií]quido\s*a\s*Receber|Total\s*L[ií]quido)[:\s]*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i);
            if (netMatch) netSalary = parseCurrency(netMatch[1]);
        }
    }

    if (netSalary === 0 && totalEarnings > 0) {
        netSalary = Math.max(0, totalEarnings - totalDeductions);
    }

    // 1. Extração Global de Rubricas de Faltas e DSR (funciona com quebras de linha ou texto contínuo)
    const dsrRegex = /(?:(?:^|\s)(\d{1,4})\s+)?(?:(?:HORAS\s+|DIAS\s+)?FALTAS?\s+DSR|DSR\s+(?:S\s*\/?\s*|SOBRE\s+)?FALTAS?)\s+(\d{1,3}:\d{2}|[0-9]{1,2},[0-9]{2})\s+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/gi;

    const faltaRegex = /(?:(?:^|\s)(\d{1,4})\s+)?(?:HORAS\s+|DIAS\s+|DESCONTO\s+(?:DE\s+)?)?FALTAS?(?:\s+INJUSTIFICADAS?|\s+INTEGRAL)?\s+(\d{1,3}:\d{2}|[0-9]{1,2},[0-9]{2})\s+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/gi;

    for (const match of normalizedText.matchAll(dsrRegex)) {
        const valStr = match[3];
        absenceDeduction += parseCurrency(valStr);
    }

    for (const match of normalizedText.matchAll(faltaRegex)) {
        const fullMatch = match[0].toUpperCase();
        if (fullMatch.includes('DSR')) continue;

        const refStr = match[2];
        const valStr = match[3];

        if (refStr.includes(':')) {
            const [hStr, mStr] = refStr.split(':');
            const totalHours = parseInt(hStr, 10) + parseInt(mStr || '0', 10) / 60;
            // 7h20m diárias = 7.3333h (padrão CLT 220h/mês / 30 dias)
            const days = Math.round(totalHours / 7.3333);
            if (days > 0 && days <= 31) {
                absenceDays += days;
            }
        } else {
            const days = parseFloat(refStr.replace(',', '.'));
            if (!isNaN(days) && days > 0 && days <= 31) {
                absenceDays += days;
            }
        }

        absenceDeduction += parseCurrency(valStr);
    }

    // Se a busca global não encontrou faltas, faz o fallback linha a linha
    if (absenceDays === 0 && absenceDeduction === 0) {
        for (const l of lines) {
            const upperL = l.toUpperCase();
            if (upperL.includes('FALTA') && !upperL.includes('TOTAL') && !upperL.includes('BASE')) {
                const timeMatch = l.match(/\b(\d{1,3}):(\d{2})\b/);
                const decimalAmounts = Array.from(l.matchAll(/([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g)).map(m => m[1]);

                if (timeMatch) {
                    const totalHours = parseInt(timeMatch[1], 10) + parseInt(timeMatch[2], 10) / 60;
                    if (!upperL.includes('DSR')) {
                        const days = Math.round(totalHours / 7.3333);
                        if (days > 0 && days <= 31) absenceDays += days;
                    }
                    if (decimalAmounts.length > 0) {
                        absenceDeduction += parseCurrency(decimalAmounts[decimalAmounts.length - 1]);
                    }
                } else if (decimalAmounts.length >= 2) {
                    const days = parseFloat(decimalAmounts[0].replace(',', '.'));
                    if (!isNaN(days) && days > 0 && days <= 31) absenceDays += days;
                    absenceDeduction += parseCurrency(decimalAmounts[1]);
                } else if (decimalAmounts.length === 1) {
                    absenceDeduction += parseCurrency(decimalAmounts[0]);
                }
            }
        }
    }

    // Fallback de segurança: se houve desconto financeiro de falta mas não foi possível extrair a quantidade de dias
    if (absenceDays === 0 && absenceDeduction > 0 && baseSalary > 0) {
        // Estima dias de falta dividindo o valor do desconto pelo valor do dia trabalhado (Salário Base / 30)
        const dailyRate = baseSalary / 30;
        const estimatedDays = Math.round(absenceDeduction / dailyRate);
        if (estimatedDays > 0 && estimatedDays <= 31) {
            absenceDays = estimatedDays;
        }
    }

    // Dias trabalhados
    for (const l of lines) {
        const upperL = l.toUpperCase();
        if (upperL.includes('SALARIO BASE') || upperL.includes('HORAS NORMAIS') || upperL.includes('DIAS TRABALHADOS')) {
            const daysMatch = l.match(/([0-9]{1,2},[0-9]{2})\s+[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}/);
            if (daysMatch) {
                const days = parseFloat(daysMatch[1].replace(',', '.'));
                if (!isNaN(days) && days >= 0 && days <= 31) workedDays = days;
            }
        }
    }

    // Extração de rubricas detalhadas (para composição do holerite)
    const rubrics: HoleriteRubricItem[] = [];
    for (const l of lines) {
        const cleanL = l.trim();
        const upperL = cleanL.toUpperCase();
        if (
            upperL.includes('TOTAL') || 
            upperL.includes('DECLARO') || 
            upperL.includes('RECIBO') || 
            upperL.includes('SALÁRIO BASE') || 
            upperL.includes('SALARIO BASE') || 
            upperL.includes('VALOR LÍQUIDO') ||
            upperL.includes('VALOR LIQUIDO') ||
            upperL.includes('BASE DE CÁLCULO') ||
            upperL.includes('BASE DE CALCULO') ||
            upperL.includes('FGTS') ||
            upperL.includes('CÓDIGO DESCRIÇÃO') ||
            upperL.includes('CODIGO DESCRICAO') ||
            upperL.includes('MENSALISTA') ||
            upperL.includes('ADMISSÃO') ||
            upperL.includes('ADMISSAO') ||
            upperL.includes('DEPARTAMENTO') ||
            upperL.includes('CNPJ')
        ) {
            continue;
        }

        const rubricMatch = cleanL.match(/^(?:(\d{1,4})\s+)?([A-ZÀ-Ú0-9\.\-\/\%\s\(\)]+?)\s+(\d{1,3}:\d{2}|\d{1,3},\d{2})\s+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})(?:\s+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}))?$/i);

        if (rubricMatch) {
            const code = rubricMatch[1];
            const desc = rubricMatch[2].trim();
            const ref = rubricMatch[3];
            const val1 = parseCurrency(rubricMatch[4]);
            const val2 = rubricMatch[5] ? parseCurrency(rubricMatch[5]) : null;

            if (desc.length >= 2 && !/^\d+$/.test(desc)) {
                let earnings: number | undefined = undefined;
                let deductions: number | undefined = undefined;

                if (val2 !== null) {
                    earnings = val1;
                    deductions = val2;
                } else {
                    const descUpper = desc.toUpperCase();
                    const isDeduction = 
                        descUpper.includes('FALTA') ||
                        descUpper.includes('DSR') ||
                        descUpper.includes('INSS') ||
                        descUpper.includes('I.N.S.S') ||
                        descUpper.includes('VALE') ||
                        descUpper.includes('VT') ||
                        descUpper.includes('VR') ||
                        descUpper.includes('VA') ||
                        descUpper.includes('DESCONTO') ||
                        descUpper.includes('CONTRIB') ||
                        descUpper.includes('SINDIC') ||
                        descUpper.includes('ADIANTAMENTO') ||
                        descUpper.includes('IRRF') ||
                        descUpper.includes('IR') ||
                        descUpper.includes('PENSAO') ||
                        descUpper.includes('PENSÃO') ||
                        descUpper.includes('SEGURO') ||
                        descUpper.includes('CONVENIO') ||
                        descUpper.includes('CONVÊNIO') ||
                        descUpper.includes('TROCO MES ANTERIOR');

                    if (isDeduction) {
                        deductions = val1;
                    } else {
                        earnings = val1;
                    }
                }

                rubrics.push({
                    code,
                    description: desc,
                    reference: ref,
                    earnings,
                    deductions
                });
            }
        }
    }

    return {
        employeeName,
        cpf,
        registrationCode,
        companyName,
        cnpj,
        competence,
        payrollType,
        baseSalary,
        totalEarnings,
        totalDeductions,
        netSalary,
        workedDays,
        absenceDays,
        absenceDeduction,
        rubrics
    };
}

/**
 * Builds standard file name from parameters
 */
export function generateFileName(
    item: {
        employeeName: string;
        cpf?: string;
        registrationCode?: string;
        companyName?: string;
        competence?: string;
        payrollType?: string;
        pageIndices: number[];
    },
    pattern: NamingPattern,
    customTemplate?: string
): string {
    const compClean = (item.competence || 'Competencia').replace('/', '-');
    const cpfDigits = item.cpf ? cleanCPF(item.cpf) : '';
    const safeName = sanitizeFileName(item.employeeName || 'Colaborador');
    const safeCompany = sanitizeFileName(item.companyName || 'Empresa');
    const safeReg = item.registrationCode || '';
    const safeType = sanitizeFileName(item.payrollType || 'Holerite');

    let baseName = '';

    switch (pattern) {
        case 're-nome':
            baseName = `${safeReg ? `RE ${safeReg} - ` : ''}${safeName}`;
            break;
        case 'codigo-nome':
            baseName = `${safeReg ? `${safeReg} - ` : ''}${safeName}`;
            break;
        case 'nome-re':
            baseName = `${safeName}${safeReg ? ` - RE ${safeReg}` : ''}`;
            break;
        case 're-nome-comp':
            baseName = `${safeReg ? `RE ${safeReg} - ` : ''}${safeName} - ${compClean}`;
            break;
        case 'nome-re-comp':
            baseName = `${safeName}${safeReg ? ` - RE ${safeReg}` : ''} - ${compClean}`;
            break;
        case 'comp-nome-re':
            baseName = `${compClean} - ${safeReg ? `RE ${safeReg} - ` : ''}${safeName}`;
            break;
        case 'holerite-nome-comp':
            baseName = `Holerite_${safeName}_${compClean}`;
            break;
        case 'comp-nome-cpf':
            baseName = `${compClean} - ${safeName}${cpfDigits ? ` - ${cpfDigits}` : ''}`;
            break;
        case 'custom':
            if (customTemplate) {
                baseName = customTemplate
                    .replace(/\{nome\}/gi, safeName)
                    .replace(/\{re\}/gi, safeReg || 'RE')
                    .replace(/\{matricula\}/gi, safeReg || 'RE')
                    .replace(/\{codigo\}/gi, safeReg || 'RE')
                    .replace(/\{cpf\}/gi, cpfDigits || 'CPF')
                    .replace(/\{competencia\}/gi, compClean)
                    .replace(/\{empresa\}/gi, safeCompany)
                    .replace(/\{tipo\}/gi, safeType)
                    .replace(/\{pagina\}/gi, String(item.pageIndices[0] + 1));
            } else {
                baseName = `${safeReg ? `RE ${safeReg} - ` : ''}${safeName}`;
            }
            break;
        default:
            baseName = `${safeReg ? `RE ${safeReg} - ` : ''}${safeName}`;
    }

    return `${sanitizeFileName(baseName)}.pdf`;
}

/**
 * Splits source PDF pages into individual single or multi-page employee PDFs
 */
export async function createSingleEmployeePdf(
    sourcePdfDoc: PDFDocument,
    pageIndices: number[]
): Promise<Uint8Array> {
    const subDoc = await PDFDocument.create();
    const copiedPages = await subDoc.copyPages(sourcePdfDoc, pageIndices);
    copiedPages.forEach((page) => subDoc.addPage(page));
    return await subDoc.save();
}

/**
 * Creates a .ZIP containing all separated PDFs
 */
export async function createHoleritesZip(
    items: ExtractedHoleriteItem[],
    options: {
        folderStructure?: 'flat' | 'by-company' | 'by-competence';
        onProgress?: (current: number, total: number) => void;
    } = {}
): Promise<Blob> {
    const zip = new JSZip();
    const total = items.length;

    for (let i = 0; i < total; i++) {
        const item = items[i];
        if (!item.pdfBytes) continue;

        const fileName = item.customFileName || `Holerite_${item.id}.pdf`;
        let zipPath = fileName;

        if (options.folderStructure === 'by-company' && item.companyName) {
            const folderName = sanitizeFileName(item.companyName);
            zipPath = `${folderName}/${fileName}`;
        } else if (options.folderStructure === 'by-competence' && item.competence) {
            const folderName = sanitizeFileName(item.competence.replace('/', '-'));
            zipPath = `${folderName}/${fileName}`;
        }

        zip.file(zipPath, item.pdfBytes);

        if (options.onProgress) {
            options.onProgress(i + 1, total);
        }
    }

    return await zip.generateAsync({ type: 'blob' });
}

/**
 * Parses PDF text items directly from PDF.js getTextContent(), using geometric coordinates (X, Y)
 * to reconstruct exact lines, detect column boundaries for earnings vs deductions, and deduplicate vias.
 */
export function parseHoleritePdfPageItems(rawPdfItems: any[], pageNumber: number): {
    employeeName: string;
    cpf: string;
    registrationCode?: string;
    companyName?: string;
    cnpj?: string;
    competence?: string;
    payrollType?: string;
    baseSalary?: number;
    totalEarnings?: number;
    totalDeductions?: number;
    netSalary?: number;
    workedDays?: number;
    absenceDays?: number;
    absenceDeduction?: number;
    rubrics?: HoleriteRubricItem[];
} {
    const parseCurrency = (valStr: string | undefined): number => {
        if (!valStr) return 0;
        const clean = valStr.replace(/[^\d,\.-]/g, '').replace(/\./g, '').replace(',', '.');
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    };

    const items = rawPdfItems.map(it => ({
        str: it.str || '',
        x: Math.round((it.transform ? it.transform[4] : (it.x || 0)) * 10) / 10,
        y: Math.round((it.transform ? it.transform[5] : (it.y || 0)) * 10) / 10
    }));

    if (items.length === 0) {
        return extractDataFromPageText('', pageNumber);
    }

    // Detect if page has two vias (top and bottom)
    const yVals = items.map(i => i.y);
    const midY = (Math.min(...yVals) + Math.max(...yVals)) / 2;
    const hasBottomVia = items.some(i => i.y < midY && /Valor\s*L[ií]quido|Vencimentos|Mantenha/i.test(i.str));

    // Exclude right-margin signature area (x > 515) and bottom via if duplicated
    const filteredItems = items.filter(i => (!hasBottomVia || i.y >= midY) && i.x < 515);

    // Group items into lines by Y with 3.5px tolerance
    const lines: Array<{ y: number; items: typeof filteredItems }> = [];
    const sorted = [...filteredItems].sort((a, b) => b.y - a.y);
    for (const item of sorted) {
        let line = lines.find(l => Math.abs(l.y - item.y) <= 3.5);
        if (!line) {
            line = { y: item.y, items: [] };
            lines.push(line);
        }
        line.items.push(item);
    }
    lines.sort((a, b) => b.y - a.y);
    for (const l of lines) {
        l.items.sort((a, b) => a.x - b.x);
    }

    let employeeName = `Colaborador_Pagina_${pageNumber}`;
    let cpf = '';
    let registrationCode = '';
    let companyName = '';
    let cnpj = '';
    let competence = '';
    let payrollType = 'Folha Mensal';

    const textLines = lines.map(l => l.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim());
    const fullText = textLines.join('\n');

    // 1. CPF
    const cpfMatch = fullText.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
    if (cpfMatch) {
        cpf = cpfMatch[0];
    } else {
        const cpfKeywordMatch = fullText.match(/CPF[:\s]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})/i);
        if (cpfKeywordMatch) cpf = formatCPF(cpfKeywordMatch[1]);
    }

    // 2. CNPJ
    const cnpjMatch = fullText.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
    if (cnpjMatch) cnpj = cnpjMatch[0];

    // 3. Competence
    const compMatch = fullText.match(/(?:Compet[êe]ncia|Refer[êe]ncia|M[êe]s\/Ano|Per[ií]odo)[:\s]*([0-1]?\d[\/-]20\d{2}|[0-1]?\d[\/-]\d{2})/i);
    if (compMatch) {
        competence = compMatch[1];
    } else {
        const mM = fullText.match(/(Janeiro|Fevereiro|Março|Marco|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)[\s\/\-_de]+(20\d{2})/i);
        if (mM) {
            const m = MONTH_NAMES[mM[1].toLowerCase()] || '01';
            competence = `${m}/${mM[2]}`;
        }
    }

    // 4. Payroll Type
    if (/adiantamento/i.test(fullText)) payrollType = 'Adiantamento';
    else if (/13[ºo°]?\s*sal[aá]rio|d[eé]cimo\s*terceiro/i.test(fullText)) payrollType = '13º Salário';
    else if (/f[eé]rias/i.test(fullText)) payrollType = 'Recibo de Férias';
    else if (/rescis[aã]o/i.test(fullText)) payrollType = 'Termo de Rescisão';

    // 5. Company Name
    if (textLines.length > 0 && textLines[0].length > 3 && !/RECIBO|DEMONSTRATIVO|FOLHA|PAGE/i.test(textLines[0])) {
        companyName = textLines[0];
    }

    // 6. Employee Name & Code
    for (let i = 0; i < textLines.length - 1; i++) {
        if (/Nome\s+do\s+(?:Funcion[aá]rio|Empregado)/i.test(textLines[i])) {
            const nextL = textLines[i + 1];
            const empM = nextL.match(/^(\d{1,8})\s+([A-ZÀ-Ú\s]{3,80}?)(?:\s+\d{4,8}|\s*$)/i);
            if (empM) {
                registrationCode = empM[1].trim();
                const extracted = empM[2].replace(/\s+/g, ' ').trim().toUpperCase();
                if (extracted.length >= 3 && !/RECIBO|FOLHA|EMPRESA|TOTAL/i.test(extracted)) {
                    employeeName = extracted;
                    break;
                }
            }
        }
    }

    if (!employeeName || employeeName.startsWith('Colaborador_Pagina')) {
        const dMatch = fullText.match(/(?:CC:?\s*)?(\d{1,8})\s+C[oó]digo\s+([A-ZÀ-Ú\s]{3,80}?)\s+(?:Nome\s+do\s+Funcion[aá]rio|Nome)/i);
        if (dMatch) {
            registrationCode = dMatch[1].trim();
            employeeName = dMatch[2].replace(/\s+/g, ' ').trim().toUpperCase();
        }
    }

    // Fallback if still generic
    if (!employeeName || employeeName.startsWith('Colaborador_Pagina')) {
        const fallbackRes = extractDataFromPageText(fullText, pageNumber);
        if (fallbackRes.employeeName && !fallbackRes.employeeName.startsWith('Colaborador_Pagina')) {
            employeeName = fallbackRes.employeeName;
            if (fallbackRes.registrationCode) registrationCode = fallbackRes.registrationCode;
        }
    }

    // 7. Financial Totals
    let totalEarnings = 0;
    let totalDeductions = 0;
    let netSalary = 0;
    let baseSalary = 0;

    for (let i = 0; i < lines.length; i++) {
        const lineText = textLines[i];
        if (/Total\s+de\s+Vencimentos/i.test(lineText) && /Total\s+de\s+Descontos/i.test(lineText)) {
            for (let j = i; j <= Math.min(i + 2, lines.length - 1); j++) {
                const nums = lines[j].items.map(it => it.str.trim()).filter(s => /^[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}$/.test(s));
                if (nums.length >= 2) {
                    totalEarnings = parseCurrency(nums[nums.length - 2]);
                    totalDeductions = parseCurrency(nums[nums.length - 1]);
                    break;
                }
            }
        }

        if (/Valor\s*L[ií]quido/i.test(lineText)) {
            const nums = lines[i].items.map(it => it.str.trim()).filter(s => /^[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}$/.test(s));
            if (nums.length > 0) {
                netSalary = parseCurrency(nums[nums.length - 1]);
            }
        }

        if (/Sal[aá]rio\s*Base/i.test(lineText) && i + 1 < lines.length) {
            const nums = lines[i + 1].items.map(it => it.str.trim()).filter(s => /^[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}$/.test(s));
            if (nums.length > 0 && baseSalary === 0) {
                baseSalary = parseCurrency(nums[0]);
            }
        }
    }

    // 8. Rubrics extraction using geometric column boundaries
    const rubrics: HoleriteRubricItem[] = [];
    let insideRubrics = false;

    let refColX = 280;
    let earnColX = 360;
    let descColX = 435;

    for (const line of lines) {
        const lineText = line.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
        if (/C[oó]digo\s+Descri[çc][aã]o\s+Refer[êe]ncia/i.test(lineText)) {
            insideRubrics = true;
            for (const it of line.items) {
                if (/Refer[êe]ncia/i.test(it.str)) refColX = it.x - 10;
                if (/Vencimentos/i.test(it.str)) earnColX = it.x - 10;
                if (/Descontos/i.test(it.str)) descColX = it.x - 10;
            }
            continue;
        }
        if (/Total\s+de\s+Vencimentos/i.test(lineText) || /Valor\s*L[ií]quido/i.test(lineText)) {
            insideRubrics = false;
            continue;
        }

        if (insideRubrics) {
            let code = '';
            const descParts: string[] = [];
            let ref = '';
            let earnings = 0;
            let deductions = 0;

            for (const item of line.items) {
                const s = item.str.trim();
                if (!s) continue;
                if (item.x < refColX * 0.3 && /^\d+$/.test(s) && !code) {
                    code = s;
                } else if (item.x >= refColX && item.x < earnColX && (/^\d{1,3}:\d{2}$/.test(s) || /^[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}$/.test(s))) {
                    ref = s;
                } else if (item.x >= earnColX && item.x < descColX && /^[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}$/.test(s)) {
                    earnings = parseCurrency(s);
                } else if (item.x >= descColX && /^[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}$/.test(s)) {
                    deductions = parseCurrency(s);
                } else if (item.x < refColX) {
                    descParts.push(s);
                }
            }

            const desc = descParts.join(' ').trim();
            if (desc && (earnings > 0 || deductions > 0)) {
                rubrics.push({
                    code,
                    description: desc,
                    reference: ref,
                    earnings: earnings > 0 ? earnings : undefined,
                    deductions: deductions > 0 ? deductions : undefined
                });
            }
        }
    }

    // Absence deductions sum & absence days
    let absenceDeduction = 0;
    let absenceDays = 0;
    for (const r of rubrics) {
        const d = r.description.toUpperCase();
        if (r.deductions && (d.includes('FALTA') || d.includes('DSR'))) {
            absenceDeduction += r.deductions;
            if (r.reference && !d.includes('DSR')) {
                if (r.reference.includes(':')) {
                    const [h, m] = r.reference.split(':');
                    const th = parseInt(h, 10) + parseInt(m || '0', 10) / 60;
                    absenceDays += Math.round(th / 7.3333);
                } else {
                    const days = parseFloat(r.reference.replace(',', '.'));
                    if (!isNaN(days) && days <= 31) absenceDays += days;
                }
            }
        }
    }
    absenceDeduction = Math.round(absenceDeduction * 100) / 100;

    // Fallback if rubrics weren't found by geometric bounds
    if (rubrics.length === 0) {
        const fallbackRes = extractDataFromPageText(fullText, pageNumber);
        if (fallbackRes.rubrics && fallbackRes.rubrics.length > 0) {
            rubrics.push(...fallbackRes.rubrics);
        }
        if (baseSalary === 0 && fallbackRes.baseSalary) baseSalary = fallbackRes.baseSalary;
        if (totalEarnings === 0 && fallbackRes.totalEarnings) totalEarnings = fallbackRes.totalEarnings;
        if (totalDeductions === 0 && fallbackRes.totalDeductions) totalDeductions = fallbackRes.totalDeductions;
        if (netSalary === 0 && fallbackRes.netSalary) netSalary = fallbackRes.netSalary;
        if (absenceDeduction === 0 && fallbackRes.absenceDeduction) absenceDeduction = fallbackRes.absenceDeduction;
    }

    return {
        employeeName,
        cpf,
        registrationCode,
        companyName,
        cnpj,
        competence,
        payrollType,
        baseSalary,
        totalEarnings,
        totalDeductions,
        netSalary,
        workedDays: 30,
        absenceDays,
        absenceDeduction,
        rubrics
    };
}

