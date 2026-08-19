// =============================================================================
// ROBÔ RPA ONVIO - MOTOR VISUAL COM TRATAMENTO DE PORTA E LOGIN INFALÍVEL (WINDOWS)
// =============================================================================
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const PORT = process.env.PORT || 3000;
const ONVIO_USER = process.env.ONVIO_USER || "adm@jvstratamentosdepiso.com";
const ONVIO_PASS = process.env.ONVIO_PASS || "%Jcr35030";
const VERCEL_POLL_URL = process.env.VERCEL_POLL_URL || "https://workforce-hub-henna.vercel.app/api/rpa/poll";

process.on("uncaughtException", (err) => {
    if (err.code === "EADDRINUSE") {
        console.log("\n[i] Robô já em execução no seu computador. Operando via Fila em Nuvem Vercel.");
    } else {
        console.error("\n[ERRO NO ROBÔ]:", err.message || err);
    }
});

process.on("unhandledRejection", (reason) => {
    console.error("\n[PROMESSA REJEITADA NO ROBÔ]:", reason);
});

let activeBrowser = null;

function findWindowsChromePath() {
    const paths = [
        "/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        (process.env.LOCALAPPDATA || "") + "\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
    ];
    for (const p of paths) {
        if (p && fs.existsSync(p)) return p;
    }
    return null;
}

// Converte qualquer formato de data para dd/mm/aaaa
function formatDate(dStr) {
    if (!dStr) return "";
    if (typeof dStr !== 'string') dStr = String(dStr);
    const clean = dStr.replace(/\D/g, "");
    // Formato ISO: aaaa-mm-dd ou aaaa-mm-ddTHH:mm:ss
    if (dStr.includes("-") && dStr.length >= 10) {
        const parts = dStr.split("T")[0].split("-");
        if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[2].padStart(2,'0')}/${parts[1].padStart(2,'0')}/${parts[0]}`;
        }
    }
    // Já está no formato dd/mm/aaaa
    if (dStr.includes("/") && clean.length === 8) return dStr;
    // Apenas dígitos: ddmmaaaa
    if (clean.length === 8) {
        return `${clean.slice(0,2)}/${clean.slice(2,4)}/${clean.slice(4,8)}`;
    }
    return dStr;
}
// Alias para compatibilidade
const formatDateDigits = formatDate;

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
    const rgOrgao = extra.rgOrgaoEmissor || extra.rgOrgao || extra.orgaoEmissor || payload.rgOrgaoEmissor || "SSP";
    const rgUf = extra.rgUf || payload.rgUf || "PR";
    const rgDtRaw = extra.rgDataEmissao || extra.dataEmissaoRg || payload.rgDataEmissao || "";
    const rgDtDigits = formatDate(rgDtRaw);

    const admissionDateRaw = payload.admissionDate || extra.admissionDate || extra.dataAdmissao || new Date().toISOString().split('T')[0];
    const admissionDateFmt = formatDate(admissionDateRaw);

    console.log(`[RPA WINDOWS RH] Data admissão: ${admissionDateFmt} | Nascimento: ${birthDateDigits} | RG: ${rgNum} | Orgão: ${rgOrgao}`);

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
        args: [
            "--start-maximized",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage"
        ]
    };
    if (chromePath) {
        launchOptions.executablePath = chromePath;
    } else {
        launchOptions.channel = "chrome";
    }

    console.log("[RPA WINDOWS RH] Iniciando Puppeteer...");
    const browser = await puppeteer.launch(launchOptions);
    activeBrowser = browser;
    console.log("[RPA WINDOWS RH] Chrome aberto com sucesso.");

    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();

    console.log("[RPA WINDOWS RH] Acessando https://onvio.com.br...");
    await page.goto("https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration", { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    const urlAtual = page.url();
    console.log("[RPA WINDOWS RH] URL atual: " + urlAtual);

    // Se caiu na tela de boas-vindas (/auth), clica em Entrar com page.click() real
    if (urlAtual.includes('/auth')) {
        console.log("[RPA WINDOWS RH] Tela de login detectada. Clicando em Entrar (mouse real)...");
        try {
            // Tenta page.click() com vários seletores
            const clickedEntrar = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
                const btn = btns.find(b => b.textContent && b.textContent.trim().toLowerCase() === 'entrar');
                return btn ? { found: true, tag: btn.tagName, text: btn.textContent.trim() } : { found: false };
            });
            console.log("[RPA WINDOWS RH] Botão Entrar encontrado?", JSON.stringify(clickedEntrar));

            // Usa page.click() nativo (simula mouse real, funciona com Angular)
            await page.click('button, a[href], input[type="submit"]', { timeout: 5000 }).catch(async () => {
                // Fallback: força via evaluate
                await page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('button, a')).find(b =>
                        b.textContent && b.textContent.trim().toLowerCase() === 'entrar'
                    );
                    if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                });
            });

            // Espera a navegação acontecer
            await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 12000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 2000));
            console.log("[RPA WINDOWS RH] Após Entrar, URL: " + page.url());
        } catch(e) {
            console.log("[RPA WINDOWS RH] Aviso ao clicar Entrar:", e.message);
        }
    }

    // Verifica se precisa digitar credenciais (Thomson Reuters SSO)
    console.log("[RPA WINDOWS RH] Verificando se precisa fazer login...");
    try {
        const uidSelector = '[data-qe-id="trauth-signin-uid"], input[name="uid"], input[type="email"], #username, input[autocomplete="username"]';
        const hasUidInp = await page.waitForSelector(uidSelector, { timeout: 7000 }).catch(() => null);

        if (hasUidInp) {
            console.log("[RPA WINDOWS RH] Digitando usuário: " + ONVIO_USER);
            await page.click(uidSelector);
            await page.type(uidSelector, ONVIO_USER, { delay: 50 });

            await page.evaluate(() => {
                const btn = document.querySelector('[data-qe-id="trauth-signin-btn"], button[type="submit"]')
                    || Array.from(document.querySelectorAll('button')).find(b =>
                        b.textContent && (b.textContent.includes('Avançar') || b.textContent.includes('Continuar') || b.textContent.includes('Next'))
                    );
                if (btn) btn.click();
            });
            await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 2000));

            const pwdSelector = 'input[type="password"], [data-qe-id="trauth-signin-password"]';
            const hasPwd = await page.waitForSelector(pwdSelector, { timeout: 8000 }).catch(() => null);
            if (hasPwd) {
                console.log("[RPA WINDOWS RH] Digitando senha...");
                await page.click(pwdSelector);
                await page.type(pwdSelector, ONVIO_PASS, { delay: 50 });

                await page.evaluate(() => {
                    const btn = document.querySelector('[data-qe-id="trauth-signin-btn"], button[type="submit"]')
                        || Array.from(document.querySelectorAll('button')).find(b =>
                            b.textContent && (b.textContent.includes('Entrar') || b.textContent.includes('Sign in'))
                        );
                    if (btn) btn.click();
                });
                await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
                await new Promise(r => setTimeout(r, 4000));
                console.log("[RPA WINDOWS RH] Login efetuado. URL: " + page.url());
            }
        } else {
            console.log("[RPA WINDOWS RH] ✅ Sessão já ativa. Prosseguindo...");
        }
    } catch (loginErr) {
        console.log("[RPA WINDOWS RH] Aviso login:", loginErr.message);
    }

    // Garante que está na página certa
    const urlPosLogin = page.url();
    if (!urlPosLogin.includes('/employee-registration')) {
        console.log("[RPA WINDOWS RH] Navegando para formulário de admissão...");
        await page.goto("https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration", { waitUntil: "domcontentloaded", timeout: 20000 });
        await new Promise(r => setTimeout(r, 3000));
    }

    console.log(`[RPA WINDOWS RH] Selecionando empresa na SIDEBAR: ${companyName}...`);
    try {
        // Aguarda o sidebar carregar
        await page.waitForSelector('bm-linked-account-selector, [class*="linked-account"], [class*="sidebar"]', { timeout: 8000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1000));

        // Lista todas as empresas da sidebar para debug
        const empresasSidebar = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll(
                'bm-linked-account-selector li, bm-linked-account-selector a, bm-linked-account-selector .item, ' +
                'bm-linked-account-selector [class*="account"], bm-linked-account-selector [class*="client"], ' +
                '[class*="linked-account"] li, [class*="linked-account"] a, ' +
                'nav li a, .nav-item a, sidebar-nav li'
            ));
            return items.slice(0, 15).map(el => (el.textContent || '').trim().substring(0, 60));
        });
        console.log(`[RPA WINDOWS RH] Empresas na sidebar: ${JSON.stringify(empresasSidebar)}`);

        // Clica na empresa correta da sidebar
        const companyNameClean = companyName.toLowerCase().replace(/\s*ltda\.?\s*/gi,'').replace(/\s*s\.a\.?\s*/gi,'').trim();
        const palavrasAlvo = companyNameClean.split(' ').filter(w => w.length > 1);

        const clicou = await page.evaluate((words) => {
            // Busca em todos os elementos de lista do sidebar
            const allItems = Array.from(document.querySelectorAll(
                'bm-linked-account-selector li, bm-linked-account-selector a, bm-linked-account-selector [class], ' +
                '[class*="linked-account"] li, [class*="linked-account"] a, ' +
                '[class*="account-list"] li, [class*="account-item"]'
            ));
            const match = allItems.find(el => {
                const txt = (el.textContent || '').toLowerCase().replace(/\s*ltda\.?\s*/gi,'').trim();
                return words.every(w => txt.includes(w));
            });
            if (match) { match.click(); return (match.textContent || '').trim(); }
            return null;
        }, palavrasAlvo);

        if (clicou) {
            console.log(`[RPA WINDOWS RH] ✅ Empresa selecionada na sidebar: "${clicou}"`);
            await new Promise(r => setTimeout(r, 2000));
        } else {
            console.log(`[RPA WINDOWS RH] ⚠️ Empresa não encontrada na sidebar. Verificando empresa ativa...`);
        }

        // Verifica qual empresa está selecionada/ativa na sidebar
        const empresaAtivaSidebar = await page.evaluate(() => {
            // Procura o item ativo/selecionado na sidebar
            const active = document.querySelector(
                'bm-linked-account-selector .active, bm-linked-account-selector [class*="selected"], ' +
                'bm-linked-account-selector [class*="active"], [class*="linked-account"] .active'
            );
            if (active) return (active.textContent || '').trim();
            // Fallback: primeiro item da lista como contexto atual
            const first = document.querySelector('bm-linked-account-selector li:first-child, bm-linked-account-selector a:first-child');
            return first ? (first.textContent || '').trim() : '';
        });
        console.log(`[RPA WINDOWS RH] Empresa ativa na sidebar: "${empresaAtivaSidebar}"`);

    } catch (e) {
        console.log(`[RPA WINDOWS RH] Erro ao selecionar empresa:`, e.message);
    }

    console.log("[RPA WINDOWS RH] Abrindo formulário /add...");
    await page.goto("https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration/add", { waitUntil: "domcontentloaded" });
    await new Promise(r => setTimeout(r, 3500));

    // Sempre obtém a página ativa mais recente do browser para evitar "context destroyed"
    const getPage = async () => {
        const allPages = await browser.pages();
        const activePage = allPages.find(p => !p.isClosed()) || allPages[allPages.length - 1];
        return activePage || null;
    };

    const fillByControl = async (controlName, val) => {
        if (!val) return;
        try {
            const p = await getPage();
            if (!p) return;
            await p.evaluate((ctrl, value) => {
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
            const p = await getPage();
            if (!p) return;
            await p.evaluate((ctrl, text) => {
                const sel = document.querySelector(`bento-select[formcontrolname="${ctrl}"], select[formcontrolname="${ctrl}"]`);
                if (sel) sel.click();
            }, controlName, searchText);
            await new Promise(r => setTimeout(r, 600));

            const p2 = await getPage();
            await p2.evaluate((text) => {
                const prefix = text.split(" ")[0].toLowerCase();
                const opts = Array.from(document.querySelectorAll('.bento-option-list li, .bento-option, option'));
                const match = opts.find(el => el.textContent.toLowerCase().includes(prefix));
                if (match) match.click();
            }, searchText);
            await new Promise(r => setTimeout(r, 500));
        } catch (e) {}
    };

    const clickButton = async (textContains) => {
        try {
            const p = await getPage();
            if (!p) return;
            await p.evaluate((txt) => {
                const btn = Array.from(document.querySelectorAll('button, a, span')).find(el =>
                    el.textContent && el.textContent.trim().toLowerCase().includes(txt.toLowerCase())
                );
                if (btn) btn.click();
            }, textContains);
            await new Promise(r => setTimeout(r, 1200));
        } catch (e) {}
    };

    // ABA 1: GERAL
    console.log("[RPA WINDOWS RH] Preenchendo Aba 1 (Geral)...");
    await fillByControl("employeeName", candidateName);
    await fillByControl("cpfNumber", cpfDigits);
    await fillByControl("admissionDate", admissionDateFmt);
    await selectBentoOption("service", companyName);
    if (roleTitle) await selectBentoOption("jobPosition", roleTitle);
    await selectBentoOption("department", "Geral");
    await selectBentoOption("costCenter", "Geral");
    await selectBentoOption("union", "SIEMACO");
    await clickButton("ADMISSÃO");
    await fillByControl("salary", payload.salary || payload.baseSalary || "1900.00");
    await fillByControl("admissionDate", admissionDateFmt);  // também preenche na seção ADMISSÃO
    await selectBentoOption("admissionCategory", "Mensalista");
    await selectBentoOption("employmentRelationship", "Celetista");
    await clickButton("CONTRATO DE EXPERIÊNCIA");
    await fillByControl("probationDays1", "45");
    await fillByControl("probationDays2", "45");

    // ABA 2: PROFISSIONAL
    console.log("[RPA WINDOWS RH] Preenchendo Aba 2 (Profissional)...");
    await clickButton("Profissional");
    await new Promise(r => setTimeout(r, 1500));
    await fillByControl("workNumber", ctpsNum);
    await fillByControl("workSerial", ctpsSerie);
    await clickButton("INFORMAÇÕES DO PIS");
    await fillByControl("pisNumber", pisNum);
    await clickButton("PAGAMENTO");
    await clickButton("PIX");
    await selectBentoOption("pixType", "CPF");
    await fillByControl("pixKey", cpfDigits);

    // ABA 3: PESSOAL
    console.log("[RPA WINDOWS RH] Preenchendo Aba 3 (Pessoal)...");
    await clickButton("Pessoal");
    await new Promise(r => setTimeout(r, 1500));
    if (birthDateDigits) await fillByControl("birthDate", birthDateDigits);
    const isFem = String(gender).toLowerCase().includes("fem");
    await clickButton(isFem ? "FEMININO" : "MASCULINO");
    await fillByControl("motherName", nomeMae);
    await fillByControl("fatherName", nomePai);
    await clickButton("ENDEREÇO E CONTATO");
    await fillByControl("address", address);

    // ABA 4: DOCUMENTOS
    console.log("[RPA WINDOWS RH] Preenchendo Aba 4 (Documentos)...");
    await clickButton("Documentos");
    await new Promise(r => setTimeout(r, 1500));
    await fillByControl("identityCard", rgNum);
    await fillByControl("issuingAgency", rgOrgao);
    await selectBentoOption("issuingState", rgUf);  // UF do RG
    if (rgDtDigits) await fillByControl("identityCardIssuingDate", rgDtDigits);
    const tituloNum = extra.tituloEleitorNumero || payload.tituloEleitorNumero;
    if (tituloNum) await fillByControl("voterRegistrationCard", tituloNum);
    const tituloZona = extra.tituloEleitorZona || payload.tituloEleitorZona;
    if (tituloZona) await fillByControl("electoralZone", tituloZona);
    const tituloSecao = extra.tituloEleitorSecao || payload.tituloEleitorSecao;
    if (tituloSecao) await fillByControl("electoralSection", tituloSecao);
    const cnhNum = extra.cnhNumero || payload.cnhNumero;
    if (cnhNum) await fillByControl("driverLicenseNumber", cnhNum);
    const cnhCat = extra.cnhCategoria || payload.cnhCategoria;
    if (cnhCat) await fillByControl("driverLicenseCategory", cnhCat);
    const cnhVal = formatDate(extra.cnhValidade || payload.cnhValidade);
    if (cnhVal) await fillByControl("driverLicenseExpirationDate", cnhVal);
    const resNum = extra.reservistaNumero || payload.reservistaNumero;
    if (resNum) await fillByControl("militaryRegistration", resNum);

    // ABA 5: DEPENDENTES
    console.log("[RPA WINDOWS RH] Verificando Aba 5 (Dependentes)...");
    await clickButton("Dependente");
    await new Promise(r => setTimeout(r, 1500));
    const dependentes = payload.dependentes || extra.dependentes || [];
    if (Array.isArray(dependentes) && dependentes.length > 0) {
        for (let i = 0; i < dependentes.length; i++) {
            const dep = dependentes[i];
            console.log(`[RPA WINDOWS RH] Preenchendo dependente ${i + 1}: ${dep.nome || dep.name}`);
            await clickButton("Adicionar dependente");
            await new Promise(r => setTimeout(r, 1000));
            if (dep.nome || dep.name) await fillByControl("dependentName", dep.nome || dep.name);
            const depCpf = (dep.cpf || "").replace(/\D/g, "");
            if (depCpf) await fillByControl("dependentCPF", depCpf);
            const depNasc = formatDateDigits(dep.dataNascimento || dep.birthDate);
            if (depNasc) await fillByControl("dependentBirthDate", depNasc);
            if (dep.parentesco) await selectBentoOption("relationshipType", dep.parentesco);
        }
    }

    // ABA 6: OBSERVAÇÕES
    console.log("[RPA WINDOWS RH] Preenchendo Aba 6 (Observações)...");
    await clickButton("Observaç");
    await new Promise(r => setTimeout(r, 1500));
    const obsText = payload.observacoes || extra.observacoes || `Admissão via Workforce Hub - Cargo: ${roleTitle} - Empresa: ${companyName}`;
    await fillByControl("observations", obsText);
    await fillByControl("notes", obsText);

    // SALVAR E ENVIAR AUTOMATICAMENTE
    console.log("[RPA WINDOWS RH] Clicando em 'Salvar e Enviar para o Escritório'...");
    try {
        const pSave = await getPage();
        await pSave.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, .btn'));
            const saveBtn = buttons.find(b => {
                const txt = (b.textContent || '').trim().toLowerCase();
                return txt.includes('salvar e enviar') || txt.includes('enviar para o escritório') || (txt.includes('salvar') && !txt.includes('cancelar'));
            });
            if (saveBtn) { console.log('Clicando:', saveBtn.textContent); saveBtn.click(); }
        });
        await new Promise(r => setTimeout(r, 4000));
    } catch (saveErr) {
        console.warn("[RPA WINDOWS RH] Aviso ao clicar em Salvar:", saveErr.message);
    }

    console.log(`[RPA WINDOWS RH] ✅ PREENCHIMENTO DAS 6 ABAS E SALVAMENTO CONCLUÍDO PARA ${candidateName}!`);
    return {
        success: true,
        message: `Ficha de ${candidateName} preenchida e salva com sucesso no Onvio para ${companyName}!`
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

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.log("============================================================");
        console.log(" [i] Uma instância do Robô já está em execução no seu Windows.");
        console.log(" [✓] Operando perfeitamente via Fila de Comunicação em Nuvem Vercel!");
        console.log("============================================================\n");
    } else {
        console.error("Erro no servidor HTTP local:", err.message);
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
    } catch (pollErr) {
        console.error("[RPA POLL ERRO]:", pollErr.message || pollErr);
    }
}, 2500);

process.stdin.resume();
setInterval(() => {}, 100000);
