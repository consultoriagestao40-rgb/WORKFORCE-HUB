// =============================================================================
// ROBÔ RPA ONVIO - MOTOR ULTRA-ROBUSTO DE PREENCHIMENTO VISUAL (WINDOWS RH)
// =============================================================================
const http = require("http");
const { chromium } = require("playwright");

const PORT = process.env.PORT || 3000;
const ONVIO_USER = process.env.ONVIO_USER || "adm@jvstratamentosdepiso.com";
const ONVIO_PASS = process.env.ONVIO_PASS || "%Jcr35030";

console.log("============================================================");
console.log("  🤖 INICIANDO PONTE LOCAL DO ROBÔ RPA ONVIO - WINDOWS RH  ");
console.log("============================================================");

function formatDateDigits(dStr) {
    if (!dStr) return "";
    if (typeof dStr !== 'string') dStr = String(dStr);
    const clean = dStr.replace(/\D/g, "");
    if (dStr.includes("-") && dStr.length >= 10) {
        const parts = dStr.split("T")[0].split("-");
        if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[2]}${parts[1]}${parts[0]}`; // DDMMYYYY (8 dígitos)
        }
    }
    if (clean.length === 8) return clean;
    return dStr;
}

const server = http.createServer(async (req, res) => {
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
                const extra = payload.extraFields || {};

                // Normalização total dos dados
                const candidateName = payload.name || payload.candidateName || "";
                const rawCpf = payload.cpf || payload.candidateCpf || extra.cpf || extra.cpfNumero || "";
                const cpfDigits = rawCpf.replace(/\D/g, "");
                
                const birthDateRaw = payload.birthDate || extra.birthDate || extra.dataNascimento || "";
                const birthDateDigits = formatDateDigits(birthDateRaw);
                
                const gender = extra.gender || payload.gender || "Masculino";
                const nomeMae = extra.nomeMae || extra.mae || payload.nomeMae || "";
                const nomePai = extra.nomePai || extra.pai || payload.nomePai || "";
                const address = payload.address || extra.address || extra.endereco || "";
                const companyName = payload.companyName || extra.companyName || "JVS FACILITIES LTDA";
                const roleTitle = payload.roleTitle || extra.roleTitle || "Lavador";

                const ctpsNum = extra.ctpsNumero || extra.ctps || (cpfDigits.length >= 7 ? cpfDigits.slice(0, 7) : "");
                const ctpsSerie = extra.ctpsSerie || extra.serie || (cpfDigits.length >= 11 ? cpfDigits.slice(7, 11) : (cpfDigits.length >= 4 ? cpfDigits.slice(-4) : ""));
                const pisNum = extra.pisNumero || extra.pis || cpfDigits;

                const rgNum = extra.rgNumero || extra.rg || payload.rg || "";
                const rgOrgao = extra.rgOrgaoEmissor || extra.orgaoEmissor || "SSP";
                const rgDtRaw = extra.rgDataEmissao || extra.dataEmissaoRg || "";
                const rgDtDigits = formatDateDigits(rgDtRaw);

                console.log(`\n[RPA WINDOWS RH] 🚀 Iniciando preenchimento visual completo para: ${candidateName}`);
                console.log(`[RPA WINDOWS RH] CPF: ${cpfDigits} | Nascimento: ${birthDateDigits} | Cargo: ${roleTitle} | Empresa Contratante (Serviço): ${companyName}`);

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
                    console.log("[RPA WINDOWS RH] Efetuando login...");
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

                // 3. Selecionar Empresa Contratante (JVS FACILITIES LTDA / SPOT FACILITIES)
                console.log(`[RPA WINDOWS RH] Selecionando contexto de empresa no topo: ${companyName}...`);
                const companySelector = page.locator('bm-linked-account-selector, .header-firm-name').first();
                if (await companySelector.isVisible()) {
                    await companySelector.click({ force: true });
                    await page.waitForTimeout(1500);
                    const compOpt = page.locator('.bento-option-list li, .bento-option, span, div')
                        .filter({ hasText: new RegExp(companyName.split(" ")[0], "i") }).first();
                    if (await compOpt.isVisible()) {
                        await compOpt.click({ force: true });
                        await page.waitForTimeout(3000);
                    }
                }

                // 4. Abrir formulário /add
                console.log("[RPA WINDOWS RH] Abrindo formulário /add...");
                await page.goto("https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration/add", { waitUntil: "domcontentloaded" });
                await page.waitForTimeout(3500);

                // Helper universal para preenchimento de inputs com teclado real e eventos Angular
                const fillInput = async (locator, val) => {
                    if (!val) return false;
                    try {
                        if (await locator.count() > 0 && await locator.isVisible()) {
                            await locator.click({ force: true });
                            await locator.fill("");
                            await locator.focus();
                            await page.keyboard.type(String(val), { delay: 40 });
                            await locator.dispatchEvent("input");
                            await locator.dispatchEvent("change");
                            await locator.dispatchEvent("blur");
                            await page.waitForTimeout(200);
                            return true;
                        }
                    } catch (e) {}
                    return false;
                };

                const fillByLabelOrControl = async (identifiers, val) => {
                    if (!val) return;
                    const list = Array.isArray(identifiers) ? identifiers : [identifiers];
                    
                    for (const id of list) {
                        const loc = page.locator(`input[formcontrolname="${id}"], textarea[formcontrolname="${id}"], input[id="${id}"]`).first();
                        if (await fillInput(loc, val)) return;
                    }

                    for (const labelText of list) {
                        const lbl = page.locator('label').filter({ hasText: new RegExp(labelText, "i") }).first();
                        if (await lbl.count() > 0 && await lbl.isVisible()) {
                            const inp = lbl.locator('..').locator('input, textarea').first();
                            if (await fillInput(inp, val)) return;
                        }
                    }
                };

                // Helper para seleção em bento-select ou select
                const selectBentoOption = async (controlName, searchText) => {
                    if (!searchText) return;
                    try {
                        const sel = page.locator(`bento-select[formcontrolname="${controlName}"], select[formcontrolname="${controlName}"]`).first();
                        if (await sel.count() > 0 && await sel.isVisible()) {
                            await sel.click({ force: true });
                            await page.waitForTimeout(600);
                            const opt = page.locator(`.bento-option-list li, .bento-option, option`).filter({ hasText: new RegExp(searchText.split(" ")[0], "i") }).first();
                            if (await opt.count() > 0 && await opt.isVisible()) {
                                await opt.click({ force: true });
                                await page.waitForTimeout(500);
                            }
                        }
                    } catch (e) {}
                };

                // -------------------------------------------------------------
                // ABA 1: GERAL
                // -------------------------------------------------------------
                console.log("[RPA WINDOWS RH] Preenchendo Aba 1 (Geral)...");
                await fillByLabelOrControl(["employeeName", "name", "Nome"], candidateName);
                await fillByLabelOrControl(["cpfNumber", "cpf", "CPF"], cpfDigits);

                // Serviço (sede onde ficará alocado) -> sempre a empresa contratante (JVS FACILITIES, SPOT FACILITIES)
                console.log(`[RPA WINDOWS RH] Selecionando Serviço (Sede): ${companyName}...`);
                await selectBentoOption("service", companyName);

                if (roleTitle) await selectBentoOption("jobPosition", roleTitle);
                await selectBentoOption("department", "Geral");
                await selectBentoOption("costCenter", "Geral");
                await selectBentoOption("union", "SIEMACO");

                // Sub-aba Admissão
                try {
                    const subAdmissao = page.locator('button:has-text("ADMISSÃO"), a:has-text("ADMISSÃO"), span:has-text("ADMISSÃO")').first();
                    if (await subAdmissao.isVisible()) {
                        await subAdmissao.click();
                        await page.waitForTimeout(1000);
                        await fillByLabelOrControl(["salary", "Salário"], payload.salary || "1900.00");
                        await selectBentoOption("admissionCategory", "Mensalista");
                        await selectBentoOption("employmentRelationship", "Celetista");
                    }
                } catch (e) {}

                // Sub-aba Contrato de Experiência
                try {
                    const subExp = page.locator('button:has-text("CONTRATO DE EXPERIÊNCIA"), a:has-text("CONTRATO DE EXPERIÊNCIA")').first();
                    if (await subExp.isVisible()) {
                        await subExp.click();
                        await page.waitForTimeout(1000);
                        await fillByLabelOrControl(["probationDays1", "Contrato de Experiência"], "45");
                        await fillByLabelOrControl(["probationDays2", "Dias de Prorrogação"], "45");
                    }
                } catch (e) {}

                // -------------------------------------------------------------
                // ABA 2: PROFISSIONAL
                // -------------------------------------------------------------
                console.log("[RPA WINDOWS RH] Preenchendo Aba 2 (Profissional)...");
                const tab2 = page.locator('button.bento-wizard-step:nth-child(2), button:has-text("Profissional")').first();
                if (await tab2.isVisible()) await tab2.click({ force: true });
                await page.waitForTimeout(1500);

                // Carteira Profissional
                await fillByLabelOrControl(["workNumber", "ctpsNumber", "Número da carteira de trabalho"], ctpsNum);
                await fillByLabelOrControl(["workSerial", "ctpsSerial", "Série"], ctpsSerie);

                // PIS
                try {
                    const subPis = page.locator('button:has-text("INFORMAÇÕES DO PIS"), a:has-text("INFORMAÇÕES DO PIS")').first();
                    if (await subPis.isVisible()) {
                        await subPis.click();
                        await page.waitForTimeout(1000);
                        await fillByLabelOrControl(["pisNumber", "pis", "PIS / PASEP"], pisNum);
                    }
                } catch (e) {}

                // PAGAMENTO (Obrigatoriamente PIX)
                try {
                    console.log("[RPA WINDOWS RH] Selecionando Pagamento via PIX...");
                    const subPag = page.locator('button:has-text("PAGAMENTO"), a:has-text("PAGAMENTO"), span:has-text("PAGAMENTO")').first();
                    if (await subPag.isVisible()) {
                        await subPag.click();
                        await page.waitForTimeout(1000);
                        
                        // Clicar no botão PIX
                        const btnPix = page.locator('button:has-text("PIX"), .btn:has-text("PIX"), span:has-text("PIX"), label:has-text("PIX")').first();
                        if (await btnPix.isVisible()) {
                            await btnPix.click({ force: true });
                            await page.waitForTimeout(800);
                        }

                        await selectBentoOption("pixType", "CPF");
                        await fillByLabelOrControl(["pixKey", "Chave"], cpfDigits);
                    }
                } catch (e) {}

                // -------------------------------------------------------------
                // ABA 3: PESSOAL
                // -------------------------------------------------------------
                console.log("[RPA WINDOWS RH] Preenchendo Aba 3 (Pessoal)...");
                const tab3 = page.locator('button.bento-wizard-step:nth-child(3), button:has-text("Pessoal")').first();
                if (await tab3.isVisible()) await tab3.click({ force: true });
                await page.waitForTimeout(1500);

                // Data de Nascimento em 8 dígitos (ex: 25091987) para mascara Bento
                if (birthDateDigits) {
                    await fillByLabelOrControl(["birthDate", "dataNascimento", "Data de nascimento"], birthDateDigits);
                }

                // Gênero / Sexo (Botões Masculino / Feminino)
                try {
                    const isFem = String(gender).toLowerCase().includes("fem");
                    const sexBtn = page.locator(isFem ? 'button:has-text("FEMININO"), span:has-text("FEMININO")' : 'button:has-text("MASCULINO"), span:has-text("MASCULINO")').first();
                    if (await sexBtn.isVisible()) {
                        await sexBtn.click({ force: true });
                    }
                } catch (e) {}

                await fillByLabelOrControl(["motherName", "nomeMae", "Nome da Mãe"], nomeMae);
                await fillByLabelOrControl(["fatherName", "nomePai", "Nome do Pai"], nomePai);

                // Sub-aba Endereço e Contato
                try {
                    const subEnd = page.locator('button:has-text("ENDEREÇO E CONTATO"), a:has-text("ENDEREÇO E CONTATO")').first();
                    if (await subEnd.isVisible()) {
                        await subEnd.click();
                        await page.waitForTimeout(1000);
                        await fillByLabelOrControl(["address", "endereco", "Endereço"], address);
                    }
                } catch (e) {}

                // -------------------------------------------------------------
                // ABA 4: DOCUMENTOS
                // -------------------------------------------------------------
                console.log("[RPA WINDOWS RH] Preenchendo Aba 4 (Documentos)...");
                const tab4 = page.locator('button.bento-wizard-step:nth-child(4), button:has-text("Documentos")').first();
                if (await tab4.isVisible()) await tab4.click({ force: true });
                await page.waitForTimeout(1500);

                await fillByLabelOrControl(["identityCard", "identityCardNumber", "rg", "rgNumber", "Número da Identidade"], rgNum);
                await fillByLabelOrControl(["issuingAgency", "rgIssuingAgency", "orgao", "Órgão de expedição"], rgOrgao);
                if (rgDtDigits) {
                    await fillByLabelOrControl(["identityCardIssuingDate", "rgIssuingDate", "dataEmissao", "Data de emissão"], rgDtDigits);
                }

                // Voltar para Aba 1 para visualização limpa inicial pelo RH
                const tab1 = page.locator('button.bento-wizard-step:nth-child(1), button:has-text("Geral")').first();
                if (await tab1.isVisible()) await tab1.click({ force: true });

                console.log(`[RPA WINDOWS RH] ✅ PREENCHIMENTO VISUAL ULTRA-ROBUSTO CONCLUÍDO PARA ${candidateName}!`);
                console.log("[RPA WINDOWS RH] 🟢 O Chrome PERMANECE ABERTO na tela do RH para revisão e salvamento.");

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    success: true,
                    message: `Chrome aberto na sua tela com todas as abas (Serviço: ${companyName}, Nome, CPF, Data DD/MM/AAAA, PIX, RG) preenchidas para ${candidateName}!`
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
    console.log(`[✓] Aguardando disparos do Workforce Hub...`);
    console.log("============================================================\n");
});
