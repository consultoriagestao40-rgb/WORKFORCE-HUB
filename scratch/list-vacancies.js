const fs = require("fs");
const path = require("path");

// Load .env manually
try {
    const envPath = path.join(__dirname, "../.env");
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf-8");
        envContent.split("\n").forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || "";
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                } else if (value.startsWith("'") && value.endsWith("'")) {
                    value = value.slice(1, -1);
                }
                process.env[key] = value;
            }
        });
    }
} catch (e) {
    console.error("Erro ao carregar .env:", e);
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("=== LISTANDO TODAS AS VAGAS ===");
    const vacancies = await prisma.vacancy.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Encontradas: ${vacancies.length} vagas.`);
    for (const v of vacancies) {
        console.log(`- Vaga: ${v.title} (ID: ${v.id}), postoId: ${v.postoId}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
