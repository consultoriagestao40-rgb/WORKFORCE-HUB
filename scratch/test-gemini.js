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
console.log("Testando chave API:", apiKey);

async function testModel(apiVersion, modelName) {
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [
                { parts: [{ text: "Diga 'Olá'" }] }
            ]
        })
    });

    console.log(`[${apiVersion} - ${modelName}] Status:`, response.status);
    const text = await response.text();
    console.log(`[${apiVersion} - ${modelName}] Resposta:`, text.slice(0, 200));
}

async function main() {
    await testModel("v1beta", "gemini-1.5-flash");
    await testModel("v1", "gemini-1.5-flash");
    await testModel("v1beta", "gemini-pro");
}

main().catch(console.error);
