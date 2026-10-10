/**
 * TESTE RÁPIDO DO WORKER RPA SEM ABRIR O CHROME
 * Execute: node scripts/test-rpa-worker.js
 * 
 * Verifica:
 * 1. Módulos OK (puppeteer-core instalado)
 * 2. Chrome instalado e localizável
 * 3. Variáveis de ambiente carregadas
 * 4. Conexão com a fila Vercel
 */

const fs = require("fs");
const path = require("path");

console.log("\n" + "=".repeat(60));
console.log("  DIAGNÓSTICO DO ROBÔ RPA ONVIO");
console.log("=".repeat(60) + "\n");

let totalOk = 0, totalFail = 0;

function check(label, ok, detail = "") {
    const icon = ok ? "✅" : "❌";
    console.log(`  ${icon} ${label}${detail ? " → " + detail : ""}`);
    if (ok) totalOk++; else totalFail++;
}

// 1. puppeteer-core
let puppeteer;
try {
    puppeteer = require("puppeteer-core");
    check("puppeteer-core instalado", true, puppeteer.version || "ok");
} catch (e) {
    check("puppeteer-core instalado", false, e.message);
}

// 2. Chrome
const chromePaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    (process.env.LOCALAPPDATA || "") + "\\Google\\Chrome\\Application\\chrome.exe",
];
const chromePath = chromePaths.find(p => p && fs.existsSync(p));
check("Chrome/Edge encontrado", !!chromePath, chromePath || "NÃO ENCONTRADO");

// 3. .env
const envPath = path.join(__dirname, "../.env.local");
const hasEnv = fs.existsSync(envPath);
check(".env.local existe", hasEnv);

if (hasEnv) {
    const envContent = fs.readFileSync(envPath, "utf8");
    check("ONVIO_USER no .env.local", envContent.includes("ONVIO_USER"), "");
    check("ONVIO_PASS no .env.local", envContent.includes("ONVIO_PASS"), "");
} else {
    check("ONVIO_USER configurado", !!process.env.ONVIO_USER, process.env.ONVIO_USER || "FALTANDO");
    check("ONVIO_PASS configurado", !!process.env.ONVIO_PASS, process.env.ONVIO_PASS ? "***" : "FALTANDO");
}

// 4. Conectividade com Vercel
const VERCEL_URL = process.env.VERCEL_POLL_URL || "https://workforce-hub-henna.vercel.app/api/rpa/poll";
check("URL Vercel configurada", !!VERCEL_URL, VERCEL_URL);

console.log("\n  Testando conexão com fila Vercel...");
fetch(VERCEL_URL, { signal: AbortSignal.timeout(10000) })
    .then(r => {
        check("Conexão com Vercel", r.ok, `HTTP ${r.status}`);
        return r.json();
    })
    .then(data => {
        const hasPendingJob = !!(data && data.job);
        check("Fila verificada", true, hasPendingJob ? `JOB PENDENTE: ${data.job.candidateId}` : "sem jobs pendentes");
        printSummary();
    })
    .catch(e => {
        check("Conexão com Vercel", false, e.message);
        printSummary();
    });

function printSummary() {
    console.log("\n" + "-".repeat(60));
    console.log(`  RESULTADO: ${totalOk} OK, ${totalFail} FALHOU`);
    if (totalFail === 0) {
        console.log("  ✅ Sistema pronto! Execute: node scripts/rpa-bridge-windows.js");
    } else {
        console.log("  ⚠️  Corrija os itens marcados com ❌ antes de iniciar o robô.");
    }
    console.log("=".repeat(60) + "\n");
}
