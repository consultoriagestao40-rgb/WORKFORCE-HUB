import { NextRequest, NextResponse } from "next/server";

export interface ParsedEmployee {
    name: string;
    cpf: string;
    folha: string;
    normaisHours: number;
    faltasHours: number;
    extrasHours: number;
    notHours: number;
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

function extractCPF(text: string): string {
    // CPF formats: 123.456.789-00 or 12345678900
    const match = text.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
    if (match) {
        const digits = match[0].replace(/\D/g, "");
        if (digits.length === 11) return match[0];
    }
    return "";
}

/**
 * Parses the text content of a Secullum Cartão Ponto PDF.
 * 
 * The PDF text has blocks like:
 *   CARTÃO PONTO - JVS FACILITES ...
 *   NOME: ROSIEL DEL CARMEN KAIDBAY ROJAS    Nº FOLHA: 001234
 *   CPF: 123.456.789-00
 *   ...rows of punches...
 *   TOTAIS  24:14  00:26  00:18  00:00  30:20
 * 
 * The TOTAIS row columns are: NORMAIS | FALTAS | EXTRAS | DSR.DEB | NOT.
 */
function parseCartaoPontoText(fullText: string): ParsedEmployee[] {
    const lines = fullText.split("\n").map(l => l.trim()).filter(Boolean);
    const employees: ParsedEmployee[] = [];

    let currentEmp: ParsedEmployee | null = null;

    const finalizeEmployee = () => {
        if (currentEmp && (currentEmp.cpf || currentEmp.name)) {
            employees.push({ ...currentEmp });
        }
        currentEmp = null;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const upper = line.toUpperCase();

        // Detect new employee block
        if (upper.includes("NOME:") || upper.match(/^NOME\s*:/)) {
            finalizeEmployee();
            currentEmp = { name: "", cpf: "", folha: "", normaisHours: 0, faltasHours: 0, extrasHours: 0, notHours: 0 };

            // Extract name after "NOME:"
            const nameMatch = line.match(/NOME\s*:\s*(.+?)(?:\s+N[ºo°]?\s*FOLHA|\s*CPF|\s*$)/i);
            if (nameMatch) {
                currentEmp.name = nameMatch[1].trim();
            } else {
                // Name might be on the rest of the line or the next word chunks
                const afterNome = line.replace(/NOME\s*:/i, "").trim();
                if (afterNome.length > 3) currentEmp.name = afterNome.split(/\s{3,}/)[0].trim();
            }

            // Extract Nº FOLHA from same line
            const folhaMatch = line.match(/N[ºo°]?\s*FOLHA\s*:?\s*(\d+)/i);
            if (folhaMatch) currentEmp.folha = folhaMatch[1];
        }

        if (!currentEmp) continue;

        // Extract CPF
        if (!currentEmp.cpf) {
            const cpf = extractCPF(line);
            if (cpf) currentEmp.cpf = cpf;
        }

        // Extract Nº FOLHA if not found yet
        if (!currentEmp.folha) {
            const folhaMatch = line.match(/N[ºo°]?\s*FOLHA\s*:?\s*(\d+)/i);
            if (folhaMatch) currentEmp.folha = folhaMatch[1];
        }

        // Extract TOTAIS row - this is the key row with official calculations
        // Pattern: "TOTAIS  HH:MM  HH:MM  HH:MM  HH:MM  HH:MM"
        // Columns:  NORMAIS FALTAS EXTRAS DSR.DEB NOT.
        if (upper.includes("TOTAI") || upper.startsWith("TOT ")) {
            // Extract all time values (HH:MM format) from this line
            const times = Array.from(line.matchAll(/(\d{1,4}:\d{2})/g)).map(m => m[1]);
            
            if (times.length >= 1) currentEmp.normaisHours = parseTimeToHours(times[0]);
            if (times.length >= 2) currentEmp.faltasHours  = parseTimeToHours(times[1]);
            if (times.length >= 3) currentEmp.extrasHours  = parseTimeToHours(times[2]);
            // times[3] = DSR.DEB (skip)
            if (times.length >= 5) currentEmp.notHours     = parseTimeToHours(times[4]);
            else if (times.length === 4) {
                // Some exports omit DSR.DEB — try to detect NOT. as last column
                // Check next line for more context
                currentEmp.notHours = parseTimeToHours(times[3]);
            }

            // If we couldn't find NOT. in this line, look at the next 1-2 lines
            if (currentEmp.notHours === 0 && i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                const nextTimes = Array.from(nextLine.matchAll(/(\d{1,4}:\d{2})/g)).map(m => m[1]);
                if (nextTimes.length > 0) {
                    // Might be continuation of totais row
                    currentEmp.notHours = parseTimeToHours(nextTimes[nextTimes.length - 1]);
                }
            }
        }
    }

    finalizeEmployee();
    return employees;
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
        }

        if (!file.name.toLowerCase().endsWith(".pdf")) {
            return NextResponse.json({ error: "Apenas arquivos PDF são aceitos nesta rota." }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Dynamically require pdf-parse (avoids Next.js static import issues)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse");
        const pdfData = await pdfParse(buffer);
        const fullText: string = pdfData.text || "";

        if (!fullText.trim()) {
            return NextResponse.json({ error: "Não foi possível extrair texto do PDF. Verifique se o arquivo é um PDF de texto (não escaneado)." }, { status: 422 });
        }

        const employees = parseCartaoPontoText(fullText);

        if (employees.length === 0) {
            return NextResponse.json({ error: "Nenhum colaborador foi identificado no PDF. Verifique se o arquivo é um Cartão Ponto exportado pelo Secullum." }, { status: 422 });
        }

        return NextResponse.json({ employees, totalText: fullText.length });
    } catch (err: any) {
        console.error("[parse-cartao-ponto] Error:", err);
        return NextResponse.json({ error: err.message || "Erro interno ao processar o PDF." }, { status: 500 });
    }
}
