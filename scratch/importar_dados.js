const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const csvPath = path.join(__dirname, "..", "colaboradores.csv");

// Helper to normalize strings for matching headers
function normalizeHeader(str) {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

// Helper to parse CSV lines safely, ignoring separators inside quotes
function parseCSVLine(line, separator = ",") {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
            result.push(current);
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

// Helper to parse numbers safely (handles "1.900,50", "1900", etc.)
function parseNumber(val) {
    if (!val) return 0;
    const clean = val.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

// Helper to clean CPF (keeps only digits and pads leading zeros to 11 digits)
function cleanCPF(val) {
    if (!val) return "";
    const clean = val.replace(/\D/g, "");
    if (clean.length > 0 && clean.length < 11) {
        return clean.padStart(11, "0");
    }
    return clean;
}

async function main() {
    const isDryRun = process.argv.includes("--commit") ? false : true;

    console.log("==================================================");
    console.log(isDryRun ? "🧪 MODO SIMULAÇÃO (DRY RUN) - NENHUM DADO SERÁ SALVO" : "🔥 MODO REAL (COMMIT) - SALVANDO DADOS NO BANCO");
    console.log("==================================================");

    if (!fs.existsSync(csvPath)) {
        console.error(`Erro: Arquivo colaboradores.csv não encontrado no caminho:\n${csvPath}`);
        console.log("\nPor favor, salve sua planilha como CSV e coloque-a nessa pasta.");
        process.exit(1);
    }

    const content = fs.readFileSync(csvPath, "utf8");
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

    if (lines.length < 2) {
        console.error("Erro: O arquivo CSV está vazio ou não possui cabeçalhos.");
        process.exit(1);
    }

    // Detect separator (usually semicolon ';' in Brazil or comma ',')
    const firstLine = lines[0];
    const separator = firstLine.includes(";") ? ";" : ",";
    console.log(`Separador detectado: "${separator}"`);

    // Parse Headers
    const headers = parseCSVLine(firstLine, separator).map(h => normalizeHeader(h));
    console.log("Colunas encontradas:", headers);

    // Map column indexes
    const idx = {
        name: headers.indexOf("nome"),
        cpf: headers.indexOf("cpf"),
        salary: headers.findIndex(h => h.includes("salario") || h === "salario base"),
        insalubridade: headers.indexOf("insalubridade"),
        periculosidade: headers.indexOf("periculosidade"),
        gratificacao: headers.findIndex(h => h.includes("gratificacao")),
        outrosAdicionais: headers.findIndex(h => h.includes("outros adicionais")),
        valeAlimentacao: headers.findIndex(h => h.includes("vale alimentacao") || h.includes("va")),
        valeTransporte: headers.findIndex(h => h.includes("vale trans") || h.includes("vt"))
    };

    if (idx.cpf === -1) {
        console.error("Erro: A coluna 'CPF' não foi encontrada na planilha.");
        process.exit(1);
    }

    console.log("Mapeamento de colunas realizado com sucesso.");

    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;

    for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i], separator);
        if (row.length < headers.length) continue; // Skip incomplete lines

        const nameSheet = row[idx.name] ? row[idx.name].trim() : "";
        const cpfRaw = row[idx.cpf];
        const cpfClean = cleanCPF(cpfRaw);

        if (!cpfClean) {
            console.log(`Linha ${i + 1}: Ignorada (CPF em branco).`);
            continue;
        }

        // Fetch employee by CPF
        const emp = await prisma.employee.findUnique({
            where: { cpf: cpfClean }
        });

        if (!emp) {
            console.log(`⚠️ Linha ${i + 1}: Colaborador não encontrado no banco (CPF: ${cpfClean}, Nome Planilha: ${nameSheet})`);
            notFoundCount++;
            continue;
        }

        // Values from spreadsheet
        const sheetSalary = idx.salary !== -1 ? parseNumber(row[idx.salary]) : 0;
        const sheetInsalubridade = idx.insalubridade !== -1 ? parseNumber(row[idx.insalubridade]) : 0;
        const sheetPericulosidade = idx.periculosidade !== -1 ? parseNumber(row[idx.periculosidade]) : 0;
        const sheetGratificacao = idx.gratificacao !== -1 ? parseNumber(row[idx.gratificacao]) : 0;
        const sheetOutros = idx.outrosAdicionais !== -1 ? parseNumber(row[idx.outrosAdicionais]) : 0;
        const sheetVA = idx.valeAlimentacao !== -1 ? parseNumber(row[idx.valeAlimentacao]) : 0;
        const sheetVT = idx.valeTransporte !== -1 ? parseNumber(row[idx.valeTransporte]) : 0;

        // Compare and prepare update data (ONLY if database current value is 0 or null)
        const updateData = {};
        const changesReport = [];

        if (emp.salary === 0 && sheetSalary > 0) {
            updateData.salary = sheetSalary;
            changesReport.push(`Salário: 0 -> R$ ${sheetSalary}`);
        }
        if (emp.insalubridade === 0 && sheetInsalubridade > 0) {
            updateData.insalubridade = sheetInsalubridade;
            changesReport.push(`Insalubridade: 0 -> R$ ${sheetInsalubridade}`);
        }
        if (emp.periculosidade === 0 && sheetPericulosidade > 0) {
            updateData.periculosidade = sheetPericulosidade;
            changesReport.push(`Periculosidade: 0 -> R$ ${sheetPericulosidade}`);
        }
        if (emp.gratificacao === 0 && sheetGratificacao > 0) {
            updateData.gratificacao = sheetGratificacao;
            changesReport.push(`Gratificação: 0 -> R$ ${sheetGratificacao}`);
        }
        if (emp.outrosAdicionais === 0 && sheetOutros > 0) {
            updateData.outrosAdicionais = sheetOutros;
            changesReport.push(`Outros Adicionais: 0 -> R$ ${sheetOutros}`);
        }
        if (emp.valeAlimentacao === 0 && sheetVA > 0) {
            updateData.valeAlimentacao = sheetVA;
            changesReport.push(`Vale Alimentação: 0 -> R$ ${sheetVA}`);
        }
        if (emp.valeTransporte === 0 && sheetVT > 0) {
            updateData.valeTransporte = sheetVT;
            changesReport.push(`Vale Transporte: 0 -> R$ ${sheetVT}`);
        }

        if (Object.keys(updateData).length > 0) {
            if (isDryRun) {
                console.log(`[SIMULAÇÃO] Colaborador "${emp.name}" (CPF: ${cpfClean}) terá atualizações:`);
                changesReport.forEach(c => console.log(`   - ${c}`));
            } else {
                await prisma.employee.update({
                    where: { id: emp.id },
                    data: updateData
                });
                console.log(`✅ Colaborador "${emp.name}" (CPF: ${cpfClean}) atualizado:`);
                changesReport.forEach(c => console.log(`   - ${c}`));
            }
            updatedCount++;
        } else {
            console.log(`ℹ️ Colaborador "${emp.name}" (CPF: ${cpfClean}): Nenhum campo zerado elegível para atualização.`);
            skippedCount++;
        }
    }

    console.log("\n=================== RESUMO DO PROCESSAMENTO ===================");
    console.log(`Colaboradores atualizados/elegíveis: ${updatedCount}`);
    console.log(`Colaboradores ignorados (sem campos zerados): ${skippedCount}`);
    console.log(`Colaboradores não localizados no banco: ${notFoundCount}`);
    console.log("===============================================================");
}

main()
    .catch(e => {
        console.error("Erro durante o processamento:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
