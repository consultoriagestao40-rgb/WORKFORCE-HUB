import * as XLSX from "xlsx";

export interface ParsedPointEmployee {
    name: string;
    cpf: string;
    folha?: string;
    workedHours: number;
    faltasCount: number;
    faltasHours: number;
    extrasHours: number;
    noturnoHours: number;
    atrasosHours: number;
    punchesCount: number;
    department?: string;
    company?: string;
    rawText?: string;
}

function parseTimeToHours(val: string | undefined | null): number {
    if (!val) return 0;
    const str = val.replace(/[*¨^]/g, "").trim();
    if (!str || str === "-" || str === "00:00" || str === "0:00") return 0;
    if (str.includes(":")) {
        const isNeg = str.startsWith("-");
        const clean = isNeg ? str.substring(1) : str;
        const [hStr, mStr] = clean.split(":");
        const h = parseInt(hStr, 10) || 0;
        const m = parseInt(mStr, 10) || 0;
        return isNeg ? -(h + m / 60) : h + m / 60;
    }
    const num = parseFloat(str.replace(",", "."));
    return isNaN(num) ? 0 : num;
}

function cleanCpf(cpfRaw: string): string {
    const cleaned = (cpfRaw || "").replace(/\D/g, "");
    if (cleaned.length === 11) {
        return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cpfRaw.trim();
}

/**
 * Parses a single Secullum Cartão Ponto page from pdfjs text items
 */
export function parsePointPdfPage(items: { str: string; transform?: number[] }[]): ParsedPointEmployee | null {
    if (!items || items.length === 0) return null;

    // 1. Employee Name:
    // Priority A: from signature block at the bottom (immediately below the line of underscores)
    let name = "";
    for (let i = 0; i < items.length; i++) {
        if (items[i].str.includes("________")) {
            for (let j = i + 1; j < Math.min(i + 10, items.length); j++) {
                const s = items[j].str.trim();
                if (s && !s.includes("RH") && !s.includes("ADM") && !s.includes("____") && s.length >= 3) {
                    name = s;
                    break;
                }
            }
            break;
        }
    }

    // Priority B: from OBSERVAÇÃO header
    if (!name) {
        for (let i = 0; i < items.length; i++) {
            if (items[i].str.includes("OBSERVAÇÃO:")) {
                for (let j = i + 1; j < Math.min(i + 6, items.length); j++) {
                    const s = items[j].str.trim();
                    if (s && s.length >= 3 && !s.includes("ISENTO") && !/^\d+$/.test(s) && !s.includes("RH")) {
                        name = s;
                        break;
                    }
                }
                break;
            }
        }
    }

    // Clean name: remove suffixes like (spatium), (ferias), extra whitespace
    if (name) {
        name = name.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim().toUpperCase();
    }

    // 2. Extract CPF
    let cpf = "";
    for (let i = 0; i < items.length; i++) {
        if (items[i].str.includes("CPF:")) {
            for (let j = i + 1; j < Math.min(i + 8, items.length); j++) {
                const s = items[j].str.trim();
                const cleanDigits = s.replace(/\D/g, "");
                if (cleanDigits.length === 11) {
                    cpf = cleanCpf(cleanDigits);
                    break;
                }
            }
            break;
        }
    }

    // Fallback: search for any 11-digit CPF formatted in the page items
    if (!cpf) {
        for (const it of items) {
            const m = it.str.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
            if (m) {
                cpf = cleanCpf(m[0]);
                break;
            }
        }
    }

    // 3. Extract Folha code
    let folha = "";
    for (let i = 0; i < items.length; i++) {
        if (items[i].str.includes("FOLHA")) {
            for (let j = i + 1; j < Math.min(i + 8, items.length); j++) {
                const s = items[j].str.trim();
                if (/^\d{1,6}$/.test(s)) {
                    folha = s;
                    break;
                }
            }
            break;
        }
    }

    // 4. Role & Department
    let role = "";
    let department = "";
    for (let i = 0; i < items.length; i++) {
        if (items[i].str.includes("FUNÇÃO:")) {
            for (let j = i + 1; j < Math.min(i + 6, items.length); j++) {
                const s = items[j].str.trim();
                if (s && s.length >= 4 && !s.includes("DEPARTAMENTO") && !s.includes("OBSERVAÇÃO")) {
                    role = s;
                    break;
                }
            }
        }
        if (items[i].str.includes("DEPARTAMENTO:")) {
            for (let j = i + 1; j < Math.min(i + 6, items.length); j++) {
                const s = items[j].str.trim();
                if (s && s.length >= 3 && !s.includes("OBSERVAÇÃO") && !s.includes("ISENTO")) {
                    department = s;
                    break;
                }
            }
        }
    }

    // 5. Totais by row coordinate
    let workedHours = 0;
    let faltasHours = 0;
    let extrasHours = 0;
    let noturnoHours = 0;

    const totaisItem = items.find(it => it.str.includes("TOTAIS"));
    if (totaisItem && totaisItem.transform) {
        const yTotais = Math.round(totaisItem.transform[5]);
        const rowItems = items.filter(it => it.transform && Math.abs(Math.round(it.transform[5]) - yTotais) <= 6);
        for (const it of rowItems) {
            const x = Math.round(it.transform?.[4] || 0);
            const s = it.str.trim();
            if (/^-?\d{1,4}:\d{2}$/.test(s)) {
                if (x >= 320 && x <= 365) workedHours = parseTimeToHours(s);
                else if (x >= 366 && x <= 405) faltasHours = parseTimeToHours(s);
                else if (x >= 406 && x <= 445) extrasHours = parseTimeToHours(s);
                else if (x >= 485 && x <= 530) noturnoHours = parseTimeToHours(s);
            }
        }
    }

    // Fallback: search Totais in text order if coordinates missing
    if (workedHours === 0 && faltasHours === 0 && extrasHours === 0) {
        const fullStr = items.map(it => it.str).join(" ");
        const tMatch = fullStr.match(/TOTAIS\s+([\d:]+)(?:\s+([\d:]+))?(?:\s+([\d:]+))?(?:\s+([\d:]+))?(?:\s+([\d:]+))?/i);
        if (tMatch) {
            if (tMatch[1]) workedHours = parseTimeToHours(tMatch[1]);
            if (tMatch[2]) faltasHours = parseTimeToHours(tMatch[2]);
            if (tMatch[3]) extrasHours = parseTimeToHours(tMatch[3]);
            if (tMatch[5]) noturnoHours = parseTimeToHours(tMatch[5]);
        }
    }

    // 6. Punches & Faltas days count
    let punchesCount = 0;
    let faltasCount = 0;
    const dayItems = items.filter(it => it.transform && /^\d{2}\/\d{2}\/\d{4}/.test(it.str.trim()));
    for (const d of dayItems) {
        const y = Math.round(d.transform![5]);
        const lineItems = items.filter(it => it.transform && Math.abs(Math.round(it.transform[5]) - y) <= 4);
        const lineText = lineItems.map(it => it.str).join(" ").toUpperCase();
        if (lineText.includes("FALTA") || lineText.includes("AUSENTE")) {
            faltasCount++;
        } else {
            const times = Array.from(lineText.matchAll(/(\d{1,2}:\d{2})/g));
            if (times.length >= 2) punchesCount++;
        }
    }

    if (!name && !cpf) return null;

    return {
        name: name || `Cartao_Ponto_${folha || cpf}`,
        cpf,
        folha,
        workedHours,
        faltasCount,
        faltasHours,
        extrasHours,
        noturnoHours,
        atrasosHours: 0,
        punchesCount,
        department,
        company: undefined
    };
}

/**
 * Parses Secullum Cartão Ponto text (from PDF raw text)
 */
export function parsePointPdfText(fullText: string): ParsedPointEmployee[] {
    const lines = fullText.split("\n").map(l => l.trim()).filter(Boolean);
    const employees: ParsedPointEmployee[] = [];

    let currentEmp: ParsedPointEmployee | null = null;
    let daysWithPunches = 0;
    let faltasDetected = 0;

    const finalize = () => {
        if (currentEmp && (currentEmp.cpf || currentEmp.name)) {
            currentEmp.punchesCount = daysWithPunches;
            if (currentEmp.faltasCount === 0 && faltasDetected > 0) {
                currentEmp.faltasCount = faltasDetected;
            }
            employees.push({ ...currentEmp });
        }
        currentEmp = null;
        daysWithPunches = 0;
        faltasDetected = 0;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const upper = line.toUpperCase();

        // 1. Detect employee header
        if (upper.includes("NOME:") || upper.match(/^NOME\s*:/)) {
            finalize();
            currentEmp = {
                name: "",
                cpf: "",
                folha: "",
                workedHours: 0,
                faltasCount: 0,
                faltasHours: 0,
                extrasHours: 0,
                noturnoHours: 0,
                atrasosHours: 0,
                punchesCount: 0
            };

            // Avoid catching CNPJ after NOME:
            const cleanLine = line.replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, "").replace(/EMPRESA:[\s\S]*?OBSERVAÇÃO:/i, "");
            const nameMatch = cleanLine.match(/NOME\s*:\s*(.+?)(?:\s+N[ºo°]?\s*FOLHA|\s*CPF|\s*$)/i);
            if (nameMatch) {
                currentEmp.name = nameMatch[1].replace(/\(.*?\)/g, "").trim();
            }

            const folhaMatch = line.match(/N[ºo°]?\s*FOLHA\s*:?\s*(\d+)/i);
            if (folhaMatch) currentEmp.folha = folhaMatch[1];
        }

        if (!currentEmp) continue;

        // 2. Extract CPF
        if (!currentEmp.cpf) {
            const cpfMatch = line.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
            if (cpfMatch) {
                currentEmp.cpf = cleanCpf(cpfMatch[0]);
            }
        }

        // 3. Extract signature name if header name is empty or bad
        if (!currentEmp.name || currentEmp.name.includes("EMPRESA") || currentEmp.name.includes("CNPJ")) {
            const sigMatch = line.match(/_{5,}\s*([A-ZÀ-Ú\s]{3,60}?)(?:\s+RH|\s+ADM|\s*$)/i);
            if (sigMatch) {
                currentEmp.name = sigMatch[1].replace(/\(.*?\)/g, "").trim().toUpperCase();
            }
        }

        // 4. Count punches & daily faltas
        if (/^\d{2}\/\d{2}/.test(line)) {
            const times = Array.from(line.matchAll(/(\d{1,2}:\d{2})/g));
            if (times.length >= 2) daysWithPunches++;
            if (upper.includes("FALTA") || upper.includes("AUSENTE")) faltasDetected++;
        }

        // 5. Totais summary row
        if (upper.includes("TOTAI") || upper.startsWith("TOT ")) {
            const times = Array.from(line.matchAll(/(-?\d{1,4}:\d{2})/g)).map(m => m[1]);
            if (times.length >= 1) currentEmp.workedHours = parseTimeToHours(times[0]);
            if (times.length >= 2) currentEmp.faltasHours = parseTimeToHours(times[1]);
            if (times.length >= 3) currentEmp.extrasHours = parseTimeToHours(times[2]);
            if (times.length >= 5) currentEmp.noturnoHours = parseTimeToHours(times[4]);
            else if (times.length === 4) currentEmp.noturnoHours = parseTimeToHours(times[3]);
        }
    }

    finalize();
    return employees;
}

/**
 * Parses Secullum Cartão Ponto from XLSX / XLS workbook buffer or sheet rows
 */
export function parsePointExcel(input: ArrayBuffer | Uint8Array | any[][]): ParsedPointEmployee[] {
    let data: any[][];
    if (Array.isArray(input)) {
        data = input;
    } else {
        const wb = XLSX.read(input, { type: "array" });
        const firstSheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[firstSheetName];
        data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    }

    const employees: ParsedPointEmployee[] = [];
    let currentEmp: ParsedPointEmployee | null = null;
    let daysWithPunches = 0;
    let faltasCount = 0;

    const finalize = () => {
        if (currentEmp && (currentEmp.name || currentEmp.cpf)) {
            currentEmp.punchesCount = daysWithPunches;
            currentEmp.faltasCount = faltasCount;
            employees.push({ ...currentEmp });
        }
        currentEmp = null;
        daysWithPunches = 0;
        faltasCount = 0;
    };

    for (let r = 0; r < data.length; r++) {
        const row = data[r];
        if (!row || !Array.isArray(row)) continue;

        const hasNomeLabel = row.some(c => String(c || "").toUpperCase().includes("NOME:"));
        if (hasNomeLabel) {
            finalize();
            currentEmp = {
                name: "",
                cpf: "",
                folha: "",
                workedHours: 0,
                faltasCount: 0,
                faltasHours: 0,
                extrasHours: 0,
                noturnoHours: 0,
                atrasosHours: 0,
                punchesCount: 0
            };

            for (let nextR = r; nextR <= Math.min(r + 3, data.length - 1); nextR++) {
                const nRow = data[nextR];
                if (!nRow) continue;
                for (let c = 0; c < nRow.length; c++) {
                    const val = String(nRow[c] || "").trim();
                    if (!val || val.includes(":")) continue;
                    if (!currentEmp.name && val.length > 5 && !val.includes("/") && isNaN(Number(val))) {
                        currentEmp.name = val;
                    }
                    if (!currentEmp.folha && (/^\d{2,6}$/.test(val) || (c > 5 && /^\d+$/.test(val)))) {
                        currentEmp.folha = val;
                    }
                }
                if (currentEmp.name) break;
            }
        }

        if (!currentEmp) continue;

        // Check for CPF
        if (!currentEmp.cpf) {
            for (let c = 0; c < row.length; c++) {
                const val = String(row[c] || "").trim();
                const digits = val.replace(/\D/g, "");
                if (digits.length === 11) {
                    currentEmp.cpf = cleanCpf(digits);
                    break;
                }
            }
        }

        // Daily punch row
        const firstCell = String(row[0] || "").trim();
        if (/^\d{2}\/\d{2}/.test(firstCell)) {
            const times = row.filter(c => c && typeof c === "string" && (/^\d{1,2}:\d{2}/.test(c.trim()) || c.includes(":")));
            const isFalta = row.some(c => String(c || "").toUpperCase().includes("FALTA"));
            if (isFalta) faltasCount++;
            if (times.length >= 2) daysWithPunches++;
        }

        // Totais row
        const hasTotais = row.some(c => String(c || "").toUpperCase().includes("TOTAI"));
        if (hasTotais) {
            const times = row.filter(c => typeof c === "string" && /^\d{1,4}:\d{2}/.test(c.trim())).map(c => String(c).trim());
            if (times.length >= 1) currentEmp.workedHours = parseTimeToHours(times[0]);
            if (times.length >= 2) currentEmp.faltasHours = parseTimeToHours(times[1]);
            if (times.length >= 3) currentEmp.extrasHours = parseTimeToHours(times[2]);
            if (times.length >= 5) currentEmp.noturnoHours = parseTimeToHours(times[4]);
            else if (times.length === 4) currentEmp.noturnoHours = parseTimeToHours(times[3]);
        }
    }

    finalize();
    return employees;
}
