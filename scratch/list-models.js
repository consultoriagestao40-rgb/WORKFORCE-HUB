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

const apiKey = process.env.GEMINI_API_KEY;

async function main() {
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
    const response = await fetch(url);
    console.log("Status:", response.status);
    console.log("Resposta:", await response.text());
}

main().catch(console.error);
