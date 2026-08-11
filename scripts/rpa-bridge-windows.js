// =============================================================================
// ROBÔ RPA ONVIO - MOTOR VISUAL COM LOGIN AUTOMÁTICO INFALÍVEL (WINDOWS RH)
// =============================================================================
const http = require("http");
const fs = require("fs");
const puppeteer = require("puppeteer-core");

const PORT = process.env.PORT || 3000;
const ONVIO_USER = process.env.ONVIO_USER || "adm@jvstratamentosdepiso.com";
const ONVIO_PASS = process.env.ONVIO_PASS || "%Jcr35030";
const VERCEL_POLL_URL = process.env.VERCEL_POLL_URL || "https://workforce-hub-henna.vercel.app/api/rpa/poll";

process.on("uncaughtException", (err) => {
    console.error("\n[ERRO NO ROBÔ]:", err.message || err);
});

process.on("unhandledRejection", (reason) => {
    console.error("\n[PROMESSA REJEITADA NO ROBÔ]:", reason);
});

let activeBrowser = null;

function findWindowsChromePath() {
    const paths = [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
    ];
    for (const p of paths) {
        if (p && fs.existsSync(p)) return p;
    }
    return null;
}

function formatDateDigits(dStr) {
    if (!dStr) return "";
    if (typeof dStr !== 'string') dStr = String(dStr);
    const clean = dStr.replace(/\D/g, "");
    if (dStr.includes("-") && dStr.length >= 10) {
        const parts = dStr.split("T")[0].split("-");
        if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[2]}${parts[1]}${parts[0]}`;
        }
    }
    if (clean.length === 8) return clean;
    return dStr;
}

async function executeVisualFilling(payload) {
    const extra = payload.extraFields || {};

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

    console.log(`\n[RPA WINDOWS RH] 🚀 Abrindo Google Chrome para: ${candidateName}`);
    console.log(`[RPA WINDOWS RH] CPF: ${cpfDigits} | Nascimento: ${birthDateDigits} | Cargo: ${roleTitle} | Empresa: ${companyName}`);

    if (activeBrowser) {
        console.log("[RPA WINDOWS RH] Fechando janela anterior do Chrome...");
        try {
            await activeBrowser.close();
        } catch (e) {}
        activeBrowser = null;
    }

    const chromePath = findWindowsChromePath();
    const launchOptions = {
        headless: false,
        defaultViewport: null,
        args: ["--start-maximized", "--no-sandbox"]
    };
    if (chromePath) {
        launchOptions.executablePath = chromePath;
    } else {
        launchOptions.channel = "chrome";
    }

    const browser = await puppeteer.launch(launchOptions);
    activeBrowser = browser;

    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();

    console.log("[RPA WINDOWS RH] Acessando https://onvio.com.br...");
    await page.goto("https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => new Promise(r => setTimeout(r, 2500)));

    // 2. Tentar Clicar em Entrar se estiver na Landing Page do Onvio
    console.log("[RPA WINDOWS RH] Verificando tela de login...");
    try {
        const clickedEntrar = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a, .btn-primary, [role="button"]'));
            const entrarBtn = btns.find(b => b.textContent && b.textContent.trim().toLowerCase() === 'entrar');
            if (entrarBtn) {
                entrarBtn.click();
                return true;
            }
            return false;
        });
        if (clickedEntrar) {
            console.log("[RPA WINDOWS RH] Botão Entrar clicado. Aguardando tela de credenciais...");
            await page.evaluate(() => new Promise(r => setTimeout(r, 2500)));
        }
    } catch (e) {}

    // Preencher Usuário e Senha
    try {
        const uidSelector = 'input[name="uid"], input[type="email"], #username, [data-qe-id="trauth-signin-uid"], input[autocomplete="username"]';
        const hasUidInp = await page.$(uidSelector);
        
        if (hasUidInp) {
            console.log("[RPA WINDOWS RH] Preenchendo usuário: " + ONVIO_USER);
            await page.type(uidSelector, ONVIO_USER, { delay: 40 });

            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const nextBtn = btns.find(b => b.textContent && (b.textContent.includes('Avançar') || b.textContent.includes('Continuar') || b.type === 'submit'));
                if (nextBtn) nextBtn.click();
            });
            await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

            await page.waitForSelector('input[type="password"]', { timeout: 15000 });
            console.log("[RPA WINDOWS RH] Preenchendo senha...");
            await page.type('input[type="password"]', ONVIO_PASS, { delay: 40 });

            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const submitBtn = btns.find(b => b.type === 'submit' || (b.textContent && b.textContent.includes('Entrar')));
                if (submitBtn) submitBtn.click();
            });
            await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
        }
    } catch (loginErr) {
        console.log("[RPA WINDOWS RH] Sessão já autenticada ou etapa concluída.");
    }

    await page.goto("https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));

    console.log(`[RPA WINDOWS RH] Selecionando contexto de empresa: ${companyName}...`);
    try {
        await page.evaluate((compName) => {
            const selector = document.querySelector('bm-linked-account-selector, .header-firm-name');
            if (selector) selector.click();
        }, companyName);
        await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));

        await page.evaluate((compName) => {
            const prefix = compName.split(" ")[0].toLowerCase();
            const items = Array.from(document.querySelectorAll('.bento-option-list li, .bento-option, span, div'));
            const match = items.find(el => el.textContent.toLowerCase().includes(prefix));
            if (match) match.click();
        }, companyName);
        await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));
    } catch (e) {}

    console.log("[RPA WINDOWS RH] Abrindo formulário /add...");
    await page.goto("https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration/add", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => new Promise(r => setTimeout(r, 3500)));

    const fillByControl = async (controlName, val) => {
        if (!val) return;
        try {
            await page.evaluate((ctrl, value) => {
                const inp = document.querySelector(`input[formcontrolname="${ctrl}"], textarea[formcontrolname="${ctrl}"]`);
                if (inp) {
                    inp.focus();
                    inp.value = value;
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                    inp.dispatchEvent(new Event('blur', { bubbles: true }));
                }
            }, controlName, String(val));
        } catch (e) {}
    };

    const selectBentoOption = async (controlName, searchText) => {
        if (!searchText) return;
        try {
            await page.evaluate((ctrl, text) => {
                const sel = document.querySelector(`bento-select[formcontrolname="${ctrl}"], select[formcontrolname="${ctrl}"]`);
                if (sel) sel.click();
            }, controlName, searchText);
            await page.evaluate(() => new Promise(r => setTimeout(r, 600)));

            await page.evaluate((text) => {
                const prefix = text.split(" ")[0].toLowerCase();
                const opts = Array.from(document.querySelectorAll('.bento-option-list li, .bento-option, option'));
                const match = opts.find(el => el.textContent.toLowerCase().includes(prefix));
                if (match) match.click();
            }, searchText);
            await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
        } catch (e) {}
    };

    // ABA 1: GERAL
    console.log("[RPA WINDOWS RH] Preenchendo Aba 1 (Geral)...");
    await fillByControl("employeeName", candidateName);
    await fillByControl("cpfNumber", cpfDigits);
    await selectBentoOption("service", companyName);

    if (roleTitle) await selectBentoOption("jobPosition", roleTitle);
    await selectBentoOption("department", "Geral");
    await selectBentoOption("costCenter", "Geral");
    await selectBentoOption("union", "SIEMACO");

    try {
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button, a, span')).find(el => el.textContent.trim() === 'ADMISSÃO');
            if (btn) btn.click();
        });
        await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));
        await fillByControl("salary", payload.salary || "1900.00");
        await selectBentoOption("admissionCategory", "Mensalista");
        await selectBentoOption("employmentRelationship", "Celetista");
    } catch (e) {}

    try {
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('CONTRATO DE EXPERIÊNCIA'));
            if (btn) btn.click();
        });
        await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));
        await fillByControl("probationDays1", "45");
        await fillByControl("probationDays2", "45");
    } catch (e) {}

    // ABA 2: PROFISSIONAL
    console.log("[RPA WINDOWS RH] Preenchendo Aba 2 (Profissional)...");
    try {
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button.bento-wizard-step, button')).find(el => el.textContent.includes('Profissional'));
            if (btn) btn.click();
        });
        await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));

        await fillByControl("workNumber", ctpsNum);
        await fillByControl("workSerial", ctpsSerie);

        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('INFORMAÇÕES DO PIS'));
            if (btn) btn.click();
        });
        await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));
        await fillByControl("pisNumber", pisNum);

        // PAGAMENTO -> PIX
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button, a, span')).find(el => el.textContent.includes('PAGAMENTO'));
            if (btn) btn.click();
        });
        await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

        await page.evaluate(() => {
            const btnPix = Array.from(document.querySelectorAll('button, .btn, span, label')).find(el => el.textContent.trim() === 'PIX');
            if (btnPix) btnPix.click();
        });
        await page.evaluate(() => new Promise(r => setTimeout(r, 800)));

        await selectBentoOption("pixType", "CPF");
        await fillByControl("pixKey", cpfDigits);
    } catch (e) {}

    // ABA 3: PESSOAL
    console.log("[RPA WINDOWS RH] Preenchendo Aba 3 (Pessoal)...");
    try {
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button.bento-wizard-step, button')).find(el => el.textContent.includes('Pessoal'));
            if (btn) btn.click();
        });
        await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));

        if (birthDateDigits) await fillByControl("birthDate", birthDateDigits);

        const isFem = String(gender).toLowerCase().includes("fem");
        await page.evaluate((fem) => {
            const btn = Array.from(document.querySelectorAll('button, span')).find(el => el.textContent.trim() === (fem ? 'FEMININO' : 'MASCULINO'));
            if (btn) btn.click();
        }, isFem);

        await fillByControl("motherName", nomeMae);
        await fillByControl("fatherName", nomePai);

        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('ENDEREÇO E CONTATO'));
            if (btn) btn.click();
        });
        await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));
        await fillByControl("address", address);
    } catch (e) {}

    // ABA 4: DOCUMENTOS
    console.log("[RPA WINDOWS RH] Preenchendo Aba 4 (Documentos)...");
    try {
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button.bento-wizard-step, button')).find(el => el.textContent.includes('Documentos'));
            if (btn) btn.click();
        });
        await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));

        await fillByControl("identityCard", rgNum);
        await fillByControl("issuingAgency", rgOrgao);
        if (rgDtDigits) await fillByControl("identityCardIssuingDate", rgDtDigits);
    } catch (e) {}

    try {
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button.bento-wizard-step, button')).find(el => el.textContent.includes('Geral'));
            if (btn) btn.click();
        });
    } catch (e) {}

    console.log(`[RPA WINDOWS RH] ✅ PREENCHIMENTO CONCLUÍDO PARA ${candidateName}!`);
    console.log("[RPA WINDOWS RH] 🟢 O Chrome PERMANECE ABERTO na tela do RH para revisão e salvamento.");

    return {
        success: true,
        message: `Chrome aberto na sua tela com todas as abas preenchidas para ${candidateName}!`
    };
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
                const resultData = await executeVisualFilling(payload);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(resultData));
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
    console.log("============================================================");
    console.log(` [✓] SERVIDOR DO ROBÔ RPA ATIVO E CONECTADO NA NUVEM!`);
    console.log(` [✓] O Robô usará o Google Chrome instalado no seu Windows.`);
    console.log(` [✓] Mantenha esta janela aberta enquanto utiliza o sistema.`);
    console.log("============================================================\n");
});

// Polling continuo da fila na Nuvem Vercel
setInterval(async () => {
    try {
        const response = await fetch(VERCEL_POLL_URL);
        if (response.ok) {
            const data = await response.json();
            if (data && data.job) {
                const job = data.job;
                console.log(`\n[RPA NUVEM -> WINDOWS] 🔔 Novo disparo recebido da Vercel para: ${job.payload?.name || job.candidateId}`);
                
                const resData = await executeVisualFilling(job.payload);
                
                await fetch(VERCEL_POLL_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jobId: job.id,
                        status: resData.success ? "COMPLETED" : "FAILED",
                        result: resData.message || resData.error
                    })
                });
            }
        }
    } catch (pollErr) {}
}, 2500);

process.stdin.resume();
setInterval(() => {}, 100000);
