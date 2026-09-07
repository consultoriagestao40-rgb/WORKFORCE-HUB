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
 * Parses Secullum Cartão Ponto text (from PDF)
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

            const nameMatch = line.match(/NOME\s*:\s*(.+?)(?:\s+N[ºo°]?\s*FOLHA|\s*CPF|\s*$)/i);
            if (nameMatch) {
                currentEmp.name = nameMatch[1].trim();
            } else {
                const afterNome = line.replace(/NOME\s*:/i, "").trim();
                if (afterNome.length > 3) currentEmp.name = afterNome.split(/\s{3,}/)[0].trim();
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

        // 3. Extract Department if present
        if (!currentEmp.department && (upper.includes("DEPARTAMENTO:") || upper.includes("DEPTO:"))) {
            const depMatch = line.match(/(?:DEPARTAMENTO|DEPTO)\s*:\s*([^;,\n]+)/i);
            if (depMatch) currentEmp.department = depMatch[1].trim();
        }

        // 4. Count punches & daily faltas (lines starting with DD/MM)
        if (/^\d{2}\/\d{2}/.test(line)) {
            const times = Array.from(line.matchAll(/(\d{1,2}:\d{2})/g));
            if (times.length >= 2) {
                daysWithPunches++;
            }
            if (upper.includes("FALTA") || upper.includes("AUSENTE")) {
                faltasDetected++;
            }
        }

        // 5. Totais summary row (NORMAIS | FALTAS | EXTRAS | DSR | NOT.)
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
