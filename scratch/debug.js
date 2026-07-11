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

console.log("DATABASE_URL:", process.env.DATABASE_URL);

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("=== BUSCANDO CANDIDATOS ===");
    const candidates = await prisma.recruitmentCandidate.findMany({
        include: {
            vacancy: true
        }
    });

    console.log(`Encontrados: ${candidates.length} candidatos.`);

    for (const c of candidates) {
        console.log(`Candidato ID: ${c.id}`);
        console.log(`Nome: ${c.name}`);
        console.log(`Vaga ID: ${c.vacancyId}`);
        console.log(`Vaga Título: ${c.vacancy?.title}`);
        console.log(`Requisitos da Vaga:`, JSON.stringify(c.vacancy?.customRequirements, null, 2));
        console.log(`requirementsEvaluation:`, JSON.stringify(c.requirementsEvaluation, null, 2));
        console.log("-----------------------------------------");
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
