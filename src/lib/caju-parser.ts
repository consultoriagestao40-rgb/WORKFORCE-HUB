import * as XLSX from "xlsx";

export interface ParsedCajuItem {
    cpf: string;
    employeeName?: string;
    amount: number;
    paymentDate?: string;
    category?: string;
    raw?: any;
}

function cleanCpfDigits(cpfRaw: string | undefined | null): string {
    return (cpfRaw || "").replace(/\D/g, "");
}

function formatCpf(digits: string): string {
    if (digits.length === 11) {
        return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return digits;
}

function parseCurrencyAmount(val: any): number {
    if (typeof val === "number") return val;
    if (!val) return 0;
    const str = String(val).trim();
    // e.g. "R$ 900,00" or "900.00" or "900,00"
    const clean = str.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

/**
 * Parses a Caju receipt or order report from PDF text
 */
export function parseCajuPdfText(fullText: string): ParsedCajuItem[] {
    const lines = fullText.split("\n").map(l => l.trim()).filter(Boolean);
    const items: ParsedCajuItem[] = [];
    const seenCpfs = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match CPF in line: e.g. 123.456.789-00 or 11 digits
        const cpfMatch = line.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
        if (cpfMatch) {
            const cpfClean = cleanCpfDigits(cpfMatch[0]);
            if (cpfClean.length === 11 && !seenCpfs.has(cpfClean)) {
                seenCpfs.add(cpfClean);

                // Extract monetary value from the line or next line
                // Looking for R$ 900,00 or numbers like 900,00 or 494,00
                const values = Array.from(line.matchAll(/(?:R\$\s*)?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g)).map(m => m[1]);
                let amount = 0;
                if (values.length > 0) {
                    // Usually the last value is the total or amount credited
                    amount = parseCurrencyAmount(values[values.length - 1]);
                } else if (i + 1 < lines.length) {
                    // Check next line for amount
                    const nextLine = lines[i + 1];
                    const nextVals = Array.from(nextLine.matchAll(/(?:R\$\s*)?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g)).map(m => m[1]);
                    if (nextVals.length > 0) {
                        amount = parseCurrencyAmount(nextVals[nextVals.length - 1]);
                    }
                }

                // Extract name
                let name = "";
                const cleanLine = line
                    .replace(cpfMatch[0], "")
                    .replace(/(?:R\$\s*)?[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}/g, "")
                    .replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, "")
                    .replace(/[;|\t]/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();

                if (cleanLine.length >= 3 && !/^\d+$/.test(cleanLine)) {
                    name = cleanLine;
                }

                // Extract date if present
                const dateMatch = line.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
                const paymentDate = dateMatch ? dateMatch[1] : undefined;

                if (amount > 0 || name.length > 0) {
                    items.push({
                        cpf: formatCpf(cpfClean),
                        employeeName: name,
                        amount,
                        paymentDate
                    });
                }
            }
        }
    }

    return items;
}

/**
 * Parses Caju receipt from Excel (XLSX, XLS) or CSV file buffer
 */
export function parseCajuExcel(buffer: ArrayBuffer | Uint8Array): ParsedCajuItem[] {
    const wb = XLSX.read(buffer, { type: "array" });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, any>[];

    const items: ParsedCajuItem[] = [];
    const seenCpfs = new Set<string>();

    for (const row of jsonRows) {
        const keys = Object.keys(row);

        // Find CPF column
        const cpfKey = keys.find(k => /cpf|documento|doc/i.test(k));
        let rawCpf = cpfKey ? String(row[cpfKey]) : "";
        if (!rawCpf) {
            // Check any value that looks like CPF
            for (const k of keys) {
                const val = cleanCpfDigits(String(row[k]));
                if (val.length === 11) {
                    rawCpf = val;
                    break;
                }
            }
        }

        const cpfDigits = cleanCpfDigits(rawCpf);
        if (cpfDigits.length !== 11 || seenCpfs.has(cpfDigits)) continue;
        seenCpfs.add(cpfDigits);

        // Find Name column
        const nameKey = keys.find(k => /nome|colaborador|funcionario|beneficiario/i.test(k));
        const employeeName = nameKey ? String(row[nameKey]).trim() : undefined;

        // Find Amount column (Prioritizes "Auxilio Alimentacao", "Alimentacao", "Valor Total", "Valor")
        let amountKey = keys.find(k => /aux[ií]lio\s*alimenta|alimenta/i.test(k));
        if (!amountKey) {
            amountKey = keys.find(k => /total|valor\s*fixo|valor|recarga|cr[eé]dito/i.test(k));
        }

        let amount = 0;
        if (amountKey) {
            amount = parseCurrencyAmount(row[amountKey]);
        } else {
            // Find first numeric column > 0
            for (const k of keys) {
                const parsed = parseCurrencyAmount(row[k]);
                if (parsed > 0 && parsed <= 5000) {
                    amount = parsed;
                    break;
                }
            }
        }

        // Find Date column
        const dateKey = keys.find(k => /data|recarga|creditado/i.test(k));
        const paymentDate = dateKey ? String(row[dateKey]).trim() : undefined;

        items.push({
            cpf: formatCpf(cpfDigits),
            employeeName,
            amount,
            paymentDate,
            raw: row
        });
    }

    return items;
}
