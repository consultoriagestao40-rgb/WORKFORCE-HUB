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
    const id = "f42f976f-8809-4f19-8b07-4295fa7c9862";
    console.log(`=== BUSCANDO VAGA ID: ${id} ===`);
    const vacancy = await prisma.vacancy.findUnique({
        where: { id },
        include: {
            posto: {
                include: {
                    client: true
                }
            }
        }
    });

    if (!vacancy) {
        console.log("Vaga não encontrada!");
        return;
    }

    console.log("Vaga encontrada:", {
        id: vacancy.id,
        title: vacancy.title,
        postoId: vacancy.postoId,
        posto: vacancy.posto ? {
            id: vacancy.posto.id,
            baseSalary: vacancy.posto.baseSalary,
            valeAlimentacao: vacancy.posto.valeAlimentacao,
            valeTransporte: vacancy.posto.valeTransporte,
            schedule: vacancy.posto.schedule,
            startTime: vacancy.posto.startTime,
            endTime: vacancy.posto.endTime,
            insalubridade: vacancy.posto.insalubridade,
            periculosidade: vacancy.posto.periculosidade
        } : null
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
