// =============================================================================
// ROBÔ RPA ONVIO - PONTE DE AUTOMAÇÃO VISUAL PARA WINDOWS (RH)
// =============================================================================
const http = require("http");
const { chromium } = require("playwright");

const PORT = process.env.PORT || 3000;
const ONVIO_USER = process.env.ONVIO_USER || "adm@jvstratamentosdepiso.com";
const ONVIO_PASS = process.env.ONVIO_PASS || "%Jcr35030";

console.log("============================================================");
console.log("  🤖 INICIANDO PONTE LOCAL DO ROBÔ RPA ONVIO - WINDOWS RH  ");
console.log("============================================================");

const server = http.createServer(async (req, res) => {
    // Configurar cabeçalhos CORS para permitir requisições da Vercel
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === "/api/rpa/onvio" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => { body += chunk.toString(); });
        req.on("end", async () => {
            try {
                const data = JSON.parse(body);
                const payload = data.payload || data;

                console.log(`\n[RPA WINDOWS RH] 🚀 Novo disparo recebido para: ${payload.candidateName}`);
                console.log("[RPA WINDOWS RH] 💻 Abrindo Google Chrome visível na tela do RH...");

                const browser = await chromium.launch({
                    headless: false,
                    args: ["--start-maximized", "--no-sandbox"]
                });

                const context = await browser.newContext({ viewport: null });
                const page = await context.newPage();

                // 1. Acessar portal Onvio
                console.log("[RPA WINDOWS RH] Acessando https://onvio.com.br...");
                await page.goto("https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration", { waitUntil: "domcontentloaded" });
                await page.waitForTimeout(2500);

                // 2. Login se necessário
                if (page.url().includes("/auth") || page.url().includes("thomsonreuters")) {
                    console.log("[RPA WINDOWS RH] Efetuando login de acesso no Onvio...");
                    const entrarBtn = page.locator('button:has-text("Entrar"), a:has-text("Entrar"), .btn-primary').first();
                    if (await entrarBtn.isVisible()) {
                        await entrarBtn.click();
                        await page.waitForTimeout(2000);
                    }

                    await page.waitForSelector('input[name="uid"], [data-qe-id="trauth-signin-uid"]', { timeout: 25000 });
                    await page.fill('input[name="uid"], [data-qe-id="trauth-signin-uid"]', ONVIO_USER);

                    const nextBtn = page.locator('button[type="submit"], button:has-text("Avançar"), button:has-text("Continuar")').first();
                    if (await nextBtn.isVisible()) {
                        await nextBtn.click();
                        await page.waitForTimeout(2000);
                    }

                    await page.waitForSelector('input[type="password"]', { timeout: 20000 });
                    await page.fill('input[type="password"]', ONVIO_PASS);

                    const submitBtn = page.locator('button[type="submit"]').first();
                    if (await submitBtn.isVisible()) {
                        await submitBtn.click();
                        await page.waitForTimeout(5000);
                    }

                    await page.goto("https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration", { waitUntil: "domcontentloaded" });
                    await page.waitForTimeout(3000);
                }

                // 3. Selecionar Empresa JVS FACILITIES LTDA
                console.log("[RPA WINDOWS RH] Alterando contexto de empresa para JVS FACILITIES LTDA...");
                const companySelector = page.locator('bm-linked-account-selector, .header-firm-name').first();
                if (await companySelector.isVisible()) {
                    await companySelector.click({ force: true });
                    await page.waitForTimeout(1500);
                    const jvsOpt = page.locator('span:has-text("JVS FACILITIES"), div:has-text("JVS FACILITIES")').first();
                    if (await jvsOpt.isVisible()) {
                        await jvsOpt.click({ force: true });
                        await page.waitForTimeout(3000);
                    }
                }

                // 4. Abrir formulário /add
                console.log("[RPA WINDOWS RH] Abrindo formulário de cadastro de funcionário...");
                await page.goto("https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration/add", { waitUntil: "domcontentloaded" });
                await page.waitForTimeout(3000);

                // Helper para preenchimento de input por formcontrolname
                const fillControl = async (name, val) => {
                    if (!val) return;
                    try {
                        const inp = page.locator(`input[formcontrolname="${name}"], textarea[formcontrolname="${name}"]`).first();
                        if (await inp.count() > 0 && await inp.isVisible()) {
                            await inp.fill(String(val), { force: true });
                        }
                    } catch (e) {}
                };

                // 5. Preencher Aba 1 (Geral)
                console.log("[RPA WINDOWS RH] Preenchendo Aba 1 (Geral)...");
                await fillControl("employeeName", payload.candidateName);
                if (payload.candidateCpf) await fillControl("cpfNumber", payload.candidateCpf.replace(/\D/g, ""));
                if (payload.birthDate) {
                    const dt = payload.birthDate.includes("-") ? payload.birthDate.split("-").reverse().join("/") : payload.birthDate;
                    await fillControl("birthDate", dt);
                }
                if (payload.nomeMae) await fillControl("motherName", payload.nomeMae);
                if (payload.nomePai) await fillControl("fatherName", payload.nomePai);
                if (payload.address) await fillControl("address", payload.address);

                // 6. Preencher Aba 2 (Profissional)
                const tab2 = page.locator('button.bento-wizard-step:nth-child(2), button:has-text("Profissional")').first();
                if (await tab2.isVisible()) await tab2.click({ force: true });
                await page.waitForTimeout(1500);

                if (payload.ctpsNumero) await fillControl("workNumber", payload.ctpsNumero);
                if (payload.ctpsSerie) await fillControl("workSerial", payload.ctpsSerie);
                if (payload.pisNumero) await fillControl("pisNumber", payload.pisNumero);

                // 7. Preencher Aba 4 (Documentos)
                const tab4 = page.locator('button.bento-wizard-step:nth-child(4), button:has-text("Documentos")').first();
                if (await tab4.isVisible()) await tab4.click({ force: true });
                await page.waitForTimeout(1500);

                if (payload.rgNumero) await fillControl("identityCard", payload.rgNumero);
                if (payload.rgOrgaoEmissor) await fillControl("issuingAgency", payload.rgOrgaoEmissor);
                const dtRG = payload.rgDataEmissao || payload.ctpsDataEmissao;
                if (dtRG) {
                    const dtFmt = dtRG.includes("-") ? dtRG.split("-").reverse().join("/") : dtRG;
                    await fillControl("identityCardIssuingDate", dtFmt);
                }

                console.log(`[RPA WINDOWS RH] ✅ Todas as abas preenchidas com sucesso para ${payload.candidateName}!`);
                console.log("[RPA WINDOWS RH] 🟢 A janela do Chrome PERMANECERÁ ABERTA na tela do RH para revisão e salvamento manual.");

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    success: true,
                    message: `Chrome aberto na tela do RH com a ficha de ${payload.candidateName} preenchida!`
                }));
            } catch (err) {
                console.error("[RPA WINDOWS RH Error]:", err);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end("Not Found");
    }
});

server.listen(PORT, () => {
    console.log(`[✓] Servidor da Ponte RPA rodando no RH na porta ${PORT}`);
    console.log(`[✓] Aguardando cliques no sistema Workforce Hub...`);
    console.log("============================================================\n");
});
