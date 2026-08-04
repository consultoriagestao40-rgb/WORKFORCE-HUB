import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

async function main() {
    console.log("Reading colaboradores.csv...");
    const content = fs.readFileSync('colaboradores.csv', 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(parseCSVLine);

    console.log(`Found ${rows.length} employees to import.`);

    // Helper to convert date dd/mm/yyyy to Date
    const parseDate = (dStr: string) => {
        if (!dStr || dStr === '-' || dStr === '00/00/0000') return null;
        const parts = dStr.split('/');
        if (parts.length !== 3) return null;
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(Date.UTC(year, month, day));
    };

    // Helper to parse numbers like "1900" or "649,2"
    const parseNumber = (numStr: string) => {
        if (!numStr || numStr === '-') return 0;
        const clean = numStr.replace(/"/g, '').replace(/\./g, '').replace(',', '.');
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    };

    // Helper to clean and format CPF
    const formatCpf = (cpfStr: string) => {
        const clean = cpfStr.replace(/\D/g, "");
        if (clean.length !== 11) return cpfStr.trim();
        return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9, 11)}`;
    };

    for (const r of rows) {
        if (r.length < 5) continue;
        const name = r[0];
        const rawCpf = r[1];
        const companyName = r[2].trim();
        const roleName = r[3].trim();
        const situationName = r[4].trim();
        const admissionDateStr = r[7];
        const birthDateStr = r[8];
        const gender = r[9] === '-' ? null : r[9];
        const type = r[10] || 'CLT';
        const workload = parseInt(r[11]) || 220;
        const salary = parseNumber(r[12]);
        const insalubridade = parseNumber(r[13]);
        const periculosidade = parseNumber(r[14]);
        const gratificacao = parseNumber(r[15]);
        const outrosAdicionais = parseNumber(r[16]);
        const valeAlimentacao = parseNumber(r[18]);
        const valeTransporte = parseNumber(r[19]);
        const phone = r[20] === '-' ? null : r[20];
        const email = r[21] === '-' ? null : r[21];

        if (!name || !rawCpf) continue;

        const cpf = formatCpf(rawCpf);

        // Find or create Company
        let companyId = null;
        if (companyName) {
            const company = await prisma.company.upsert({
                where: { name: companyName },
                update: {},
                create: { name: companyName }
            });
            companyId = company.id;
        }

        // Find or create Role
        const role = await prisma.role.upsert({
            where: { name: roleName },
            update: {},
            create: { name: roleName }
        });

        // Find or create Situation
        let situationId = null;
        if (situationName) {
            const situation = await prisma.situation.upsert({
                where: { name: situationName },
                update: {},
                create: { name: situationName, color: '#10b981' }
            });
            situationId = situation.id;
        }

        const admissionDate = parseDate(admissionDateStr) || new Date();
        const birthDate = parseDate(birthDateStr);

        // Create or update Employee
        await prisma.employee.upsert({
            where: { cpf },
            update: {
                name,
                roleId: role.id,
                companyId,
                situationId,
                status: situationName,
                type,
                birthDate,
                gender,
                phone,
                email,
                admissionDate,
                salary,
                insalubridade,
                periculosidade,
                gratificacao,
                outrosAdicionais,
                workload,
                valeAlimentacao,
                valeTransporte
            },
            create: {
                name,
                cpf,
                roleId: role.id,
                companyId,
                situationId,
                status: situationName,
                type,
                birthDate,
                gender,
                phone,
                email,
                admissionDate,
                salary,
                insalubridade,
                periculosidade,
                gratificacao,
                outrosAdicionais,
                workload,
                valeAlimentacao,
                valeTransporte
            }
        });
    }

    console.log("Import completed successfully!");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
