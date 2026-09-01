import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

export interface ExtractedHoleriteItem {
    id: string;
    pageIndices: number[]; // 0-indexed page numbers in the source PDF
    pageNumbersDisplay: string; // e.g. "1" or "1-2"
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
    // Priority 1: Domínio Sistemas / Onvio / Thomson Reuters:
    // "CC: 108 Código ZURIMA ROXANA LEON GARCIA Nome do Funcionário"
    // "108 Código ZURIMA ROXANA LEON GARCIA Nome do Funcionário"
    const dominioMatch = normalizedText.match(/(?:CC:?\s*)?(\d{1,8})\s+C[oó]digo\s+([A-ZÀ-Ú\s]{3,80}?)\s+(?:Nome\s+do\s+Funcion[aá]rio|Nome\s+do\s+Empregado|Nome)/i);
    if (dominioMatch) {
        registrationCode = dominioMatch[1].trim();
        const extracted = dominioMatch[2].replace(/\s+/g, ' ').trim().toUpperCase();
        if (extracted.length >= 3 && !/RECIBO|FOLHA|PAGAMENTO|EMPRESA|TOTAL/i.test(extracted)) {
            employeeName = extracted;
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

    return {
        employeeName,
        cpf,
        registrationCode,
        companyName,
        cnpj,
        competence,
        payrollType
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
