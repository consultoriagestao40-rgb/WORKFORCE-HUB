// =============================================================================
// ROBÔ RPA ONVIO - MOTOR COM DIGITAÇÃO REAL (TECLADO) + POLLING DA FILA VERCEL
// Resolve o problema: Angular/Bento ignora dispatchEvent, precisa de digitação real
// =============================================================================
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const PORT = process.env.PORT || 3001; // porta diferente para não conflitar com Next.js
const ONVIO_USER = process.env.ONVIO_USER || "adm@jvstratamentosdepiso.com";
const ONVIO_PASS = process.env.ONVIO_PASS || "%Jcr35030";
const VERCEL_POLL_URL = process.env.VERCEL_POLL_URL || "https://workforce-hub-henna.vercel.app/api/rpa/poll";
const POLL_INTERVAL_MS = 3000;

process.on("uncaughtException", (err) => {
    if (err.code === "EADDRINUSE") {
        console.log("\n[i] Porta já em uso — operando apenas via polling da fila Vercel.");
    } else {
        console.error("\n[ERRO]:", err.message);
    }
});
process.on("unhandledRejection", (reason) => {
    console.error("\n[PROMESSA REJEITADA]:", reason);
});

let activeBrowser = null;
let isRunning = false; // evita processamento paralelo

// ─── Utilitários ─────────────────────────────────────────────────────────────

function findChromePath() {
    const paths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        (process.env.LOCALAPPDATA || "") + "\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    return paths.find(p => p && fs.existsSync(p)) || null;
}

function formatDate(dStr) {
    if (!dStr) return "";
    const s = String(dStr);
    // ISO: YYYY-MM-DD → DD/MM/YYYY
    if (s.includes("-") && s.length >= 10) {
        const [y, m, d] = s.split("T")[0].split("-");
        return `${d.padStart(2,"0")}/${m.padStart(2,"0")}/${y}`;
    }
    // Já DD/MM/YYYY
    if (s.includes("/") && s.replace(/\D/g,"").length === 8) return s;
    // ddmmyyyy
    const c = s.replace(/\D/g,"");
    if (c.length === 8) return `${c.slice(0,2)}/${c.slice(2,4)}/${c.slice(4,8)}`;
    return s;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Estratégia de preenchimento que realmente funciona com Angular/Bento ─────
// O Angular com Zone.js só reage a eventos REAIS de teclado (KeyboardEvent)
// A abordagem: clicar no campo → selecionar tudo → deletar → digitar caractere a caractere
async function fillField(page, selector, value, { clearFirst = true, maxWait = 5000 } = {}) {
    if (!value && value !== 0) return false;
    const val = String(value);

    try {
        // 1. Aguarda o elemento existir no DOM
        const el = await page.waitForSelector(selector, { timeout: maxWait }).catch(() => null);
        if (!el) {
            console.warn(`  [Campo não encontrado] ${selector}`);
            return false;
        }

        // 2. Scroll até o elemento e clica
        await el.scrollIntoView().catch(() => {});
        await el.click({ clickCount: 3 }); // triple-click seleciona tudo
        await sleep(100);

        if (clearFirst) {
            // Limpar campo: Ctrl+A → Delete
            await page.keyboard.down("Control");
            await page.keyboard.press("KeyA");
            await page.keyboard.up("Control");
            await sleep(50);
            await page.keyboard.press("Backspace");
            await sleep(50);
        }

        // 3. Digitar o valor caractere a caractere com delay (Angular detecta KeyboardEvent)
        await page.keyboard.type(val, { delay: 40 });
        await sleep(200);

        // 4. Tab para confirmar e disparar blur/change
        await page.keyboard.press("Tab");
        await sleep(300);

        console.log(`  ✓ Preenchido: ${selector.substring(0, 60)} = "${val}"`);
        return true;
    } catch (e) {
        console.warn(`  ✗ Erro ao preencher ${selector}: ${e.message}`);
        return false;
    }
}

// Tenta múltiplos seletores em ordem até um funcionar
async function fillAny(page, selectors, value, opts = {}) {
    for (const sel of selectors) {
        if (await fillField(page, sel, value, opts)) return true;
    }
    console.warn(`  ✗ Nenhum seletor funcionou para valor: "${value}" (tentados: ${selectors.length})`);
    return false;
}

// Clica em uma aba/botão pelo texto visível
async function clickByText(page, text, { timeout = 5000, exact = false } = {}) {
    try {
        const el = await page.waitForSelector(
            exact
                ? `button::-p-text("${text}"), span::-p-text("${text}"), a::-p-text("${text}")`
                : `button, span, a, div`,
            { timeout }
        ).catch(() => null);

        // Busca manual por texto se o seletor puppeteer não suportar
        const found = await page.evaluate((txt, isExact) => {
            const candidates = Array.from(document.querySelectorAll(
                'button, a, span, li, div, label, [role="tab"], [role="button"]'
            ));
            const match = candidates.find(el => {
                const t = (el.textContent || "").trim();
                const rect = el.getBoundingClientRect();
                const visible = rect.width > 0 && rect.height > 0 && rect.top > 80;
                return visible && (isExact ? t === txt : t.includes(txt));
            });
            if (match) {
                match.scrollIntoView({ behavior: "instant", block: "center" });
                match.click();
                return (match.textContent || "").trim().substring(0, 60);
            }
            return null;
        }, text, exact);

        if (found) {
            console.log(`  ✓ Clicado: "${found}"`);
            await sleep(1200);
            return true;
        }
        console.warn(`  ✗ Texto não encontrado na página: "${text}"`);
        return false;
    } catch (e) {
        console.warn(`  ✗ Erro ao clicar em "${text}": ${e.message}`);
        return false;
    }
}

// Seleciona opção em dropdown bento/select
async function selectDropdown(page, controlName, optionText) {
    if (!optionText) return;
    try {
        // 1. Abre o dropdown
        await page.evaluate((ctrl) => {
            const el = document.querySelector(
                `[formcontrolname="${ctrl}"], bento-select[formcontrolname="${ctrl}"], ` +
                `select[formcontrolname="${ctrl}"], bento-combobox[formcontrolname="${ctrl}"]`
            );
            if (el) {
                el.click();
                el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            }
        }, controlName);
        await sleep(700);

        // 2. Digita o texto no input de busca se houver
        await page.evaluate((text) => {
            const searchInp = document.querySelector(
                '.bento-combobox-search input, .bento-select-search, [role="combobox"] input, ' +
                '.bento-search input, input[aria-autocomplete="list"]'
            );
            if (searchInp) {
                searchInp.focus();
                searchInp.value = text;
                searchInp.dispatchEvent(new Event("input", { bubbles: true }));
            }
        }, optionText);
        await sleep(500);

        // 3. Clica na opção
        const clicked = await page.evaluate((text) => {
            const prefix = text.split(" ")[0].toLowerCase();
            const opts = Array.from(document.querySelectorAll(
                '.bento-option-list li, .bento-option, option, [role="option"], ' +
                '.ng-option, .bento-combobox-option, li.bento-list-item'
            ));
            const match = opts.find(el => {
                const t = (el.textContent || "").trim().toLowerCase();
                return t.includes(prefix) || t.startsWith(prefix);
            });
            if (match) { match.click(); return true; }
            return false;
        }, optionText);

        if (!clicked) {
            // Fallback: pressionar ArrowDown + Enter
            await page.keyboard.press("ArrowDown");
            await sleep(200);
            await page.keyboard.press("Enter");
        }
        await sleep(400);
    } catch (e) {
        console.warn(`  ✗ Erro ao selecionar dropdown "${controlName}" = "${optionText}": ${e.message}`);
    }
}

// ─── MOTOR PRINCIPAL DE PREENCHIMENTO ────────────────────────────────────────

async function executeVisualFilling(payload) {
    const extra = payload.extraFields || {};

    // Dados essenciais
    const candidateName    = payload.name || payload.candidateName || "";
    const rawCpf           = payload.cpf || payload.candidateCpf || extra.cpf || extra.cpfNumero || "";
    const cpfDigits        = rawCpf.replace(/\D/g, "");
    const cpfFormatted     = cpfDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    const birthDateFmt     = formatDate(payload.birthDate || extra.birthDate || extra.dataNascimento || "");
    const gender           = extra.gender || payload.gender || "Masculino";
    const nomeMae          = extra.nomeMae || extra.mae || payload.nomeMae || "";
    const nomePai          = extra.nomePai || extra.pai || payload.nomePai || "";
    const endereco         = payload.address || extra.address || extra.endereco || "";
    const cep              = (payload.cep || extra.cep || "").replace(/\D/g, "");
    const bairro           = payload.bairro || extra.bairro || "";
    const cidade           = payload.cidade || extra.cidade || "Curitiba";
    const uf               = payload.uf || extra.uf || "PR";
    const email            = payload.email || payload.candidateEmail || extra.email || "";
    const phone            = payload.phone || payload.candidatePhone || extra.phone || "";
    const companyName      = payload.companyName || extra.companyName || "JVS FACILITIES LTDA";
    const roleTitle        = payload.roleTitle || extra.roleTitle || payload.vacancyTitle || "";
    const salary           = String(payload.salary || payload.baseSalary || extra.salary || "1900.00");
    const admissionDateFmt = formatDate(payload.admissionDate || extra.admissionDate || new Date().toISOString().split("T")[0]);

    const ctpsNum    = extra.ctpsNumero || extra.ctps || (cpfDigits.length >= 7 ? cpfDigits.slice(0, 7) : "");
    const ctpsSerie  = extra.ctpsSerie || extra.serie || (cpfDigits.length >= 11 ? cpfDigits.slice(7, 11) : cpfDigits.slice(-4) || "0001");
    const pisNum     = extra.pisNumero || extra.pis || cpfDigits;

    const rgNum      = extra.rgNumero || extra.rg || payload.rg || payload.rgNumero || "";
    const rgOrgao    = extra.rgOrgaoEmissor || extra.rgOrgao || payload.rgOrgaoEmissor || "SSP";
    const rgUf       = extra.rgUf || payload.rgUf || "PR";
    const rgDataFmt  = formatDate(extra.rgDataEmissao || payload.rgDataEmissao || "");

    const pixKey     = payload.pixKey || extra.pixKey || extra.chavePix || cpfFormatted;
    const pixType    = payload.pixTipoChave || extra.pixTipoChave || extra.tipoChavePix || "CPF";

    const tituloNum  = extra.tituloEleitorNumero || payload.tituloEleitorNumero || "";
    const tituloZona = extra.tituloEleitorZona || payload.tituloEleitorZona || "";
    const tituloSec  = extra.tituloEleitorSecao || payload.tituloEleitorSecao || "";

    const cnhNum     = extra.cnhNumero || payload.cnhNumero || "";
    const cnhCat     = extra.cnhCategoria || payload.cnhCategoria || "";
    const resNum     = extra.reservistaNumero || payload.reservistaNumero || "";

    const dependentes = payload.dependentes || extra.dependentes || [];
    const obsText     = payload.observacoes || extra.observacoes ||
        `Admissão via Workforce Hub - Cargo: ${roleTitle} - Empresa: ${companyName}`;

    console.log(`\n${"=".repeat(70)}`);
    console.log(`[RPA] 🚀 Iniciando preenchimento: ${candidateName}`);
    console.log(`[RPA] CPF: ${cpfFormatted} | Admissão: ${admissionDateFmt} | Empresa: ${companyName}`);
    console.log("=".repeat(70));

    // ── Lançar Chrome ──────────────────────────────────────────────────────────
    if (activeBrowser) {
        try { await activeBrowser.close(); } catch (e) {}
        activeBrowser = null;
    }

    const chromePath = findChromePath();
    console.log(`[RPA] Caminho do Chrome: ${chromePath || "padrão do sistema"}`);

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        ...(chromePath ? { executablePath: chromePath } : { channel: "chrome" }),
    });
    activeBrowser = browser;
    console.log("[RPA] ✓ Chrome aberto.");

    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();

    // Helper para sempre pegar a página ativa
    const getPage = async () => {
        const all = await browser.pages();
        return all.find(p => !p.isClosed()) || page;
    };

    // ── 1. Login ──────────────────────────────────────────────────────────────
    console.log("\n[RPA] Etapa 1: Acessando Onvio...");
    await page.goto(
        "https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration",
        { waitUntil: "domcontentloaded", timeout: 40000 }
    ).catch(() => {});
    await sleep(3000);

    const urlAuth = page.url();
    console.log(`[RPA] URL após navegação: ${urlAuth}`);

    if (urlAuth.includes("/auth") || urlAuth.includes("thomsonreuters") || urlAuth.includes("login")) {
        console.log("[RPA] Login necessário...");

        // Clicar no botão "Entrar" da splash screen do Onvio
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll("button, a")).find(
                b => (b.textContent || "").trim().toLowerCase() === "entrar"
            );
            if (btn) btn.click();
        });
        await sleep(3000);

        // Campo de usuário
        const uidSel = '[data-qe-id="trauth-signin-uid"], input[name="uid"], input[type="email"], #username, input[autocomplete="username"]';
        const uidEl = await page.waitForSelector(uidSel, { timeout: 20000 }).catch(() => null);
        if (uidEl) {
            await uidEl.click({ clickCount: 3 });
            await page.keyboard.type(ONVIO_USER, { delay: 50 });
            await sleep(500);

            // Botão avançar
            await page.evaluate(() => {
                const btn = document.querySelector('[data-qe-id="trauth-signin-btn"], button[type="submit"]')
                    || Array.from(document.querySelectorAll("button")).find(b =>
                        (b.textContent || "").includes("Avançar") || (b.textContent || "").includes("Next")
                    );
                if (btn) btn.click();
            });
            await sleep(3000);

            // Campo de senha
            const pwdSel = 'input[type="password"], [data-qe-id="trauth-signin-password"], input[name="pwd"]';
            const pwdEl = await page.waitForSelector(pwdSel, { timeout: 15000 }).catch(() => null);
            if (pwdEl) {
                await pwdEl.click({ clickCount: 3 });
                await page.keyboard.type(ONVIO_PASS, { delay: 50 });
                await sleep(500);

                await page.evaluate(() => {
                    const btn = document.querySelector('[data-qe-id="trauth-signin-btn"], button[type="submit"]')
                        || Array.from(document.querySelectorAll("button")).find(b =>
                            (b.textContent || "").includes("Entrar") || (b.textContent || "").includes("Sign in")
                        );
                    if (btn) btn.click();
                });
                await sleep(6000);
                console.log(`[RPA] Após login: ${page.url()}`);
            }
        }

        // Retornar para a listagem
        await page.goto(
            "https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration",
            { waitUntil: "domcontentloaded", timeout: 30000 }
        ).catch(() => {});
        await sleep(3000);
    }

    // ── 2. Selecionar empresa ─────────────────────────────────────────────────
    console.log(`\n[RPA] Etapa 2: Selecionando empresa: ${companyName}...`);
    try {
        // Clicar no seletor de empresa no sidebar
        const compWordsTarget = companyName.toLowerCase().replace(/ltda\.?|s\.a\.?/gi, "").trim().split(/\s+/).filter(w => w.length > 2);

        const menuOpened = await page.evaluate(() => {
            // O switcher de empresa geralmente está no sidebar esquerdo
            const allEls = Array.from(document.querySelectorAll("*"));
            const switcher = allEls.find(el => {
                const txt = (el.textContent || "").trim();
                const rect = el.getBoundingClientRect();
                return rect.left < 280 && rect.left > 0 && rect.top > 40 && rect.top < 200
                    && rect.width > 30 && rect.height > 10
                    && txt.length > 3 && txt.length < 100
                    && el.children.length <= 5;
            });
            if (switcher) { switcher.click(); return true; }
            return false;
        });
        await sleep(2000);

        if (menuOpened) {
            const selected = await page.evaluate((words) => {
                const allEls = Array.from(document.querySelectorAll("li, div, span, a, button"));
                const sorted = allEls
                    .filter(el => {
                        const txt = (el.textContent || "").trim().toLowerCase();
                        const rect = el.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0 && txt.length < 120
                            && words.every(w => txt.includes(w));
                    })
                    .sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);

                if (sorted.length > 0) {
                    sorted[0].scrollIntoView({ behavior: "instant", block: "center" });
                    sorted[0].click();
                    return (sorted[0].textContent || "").trim().substring(0, 60);
                }
                return null;
            }, compWordsTarget);

            if (selected) {
                console.log(`[RPA] ✓ Empresa selecionada: "${selected}"`);
                await sleep(3000);
            } else {
                console.warn("[RPA] ⚠ Empresa não encontrada no menu. Prosseguindo com empresa atual.");
            }
        }
    } catch (e) {
        console.warn("[RPA] Aviso ao selecionar empresa:", e.message);
    }

    // ── 3. Abrir formulário /add ───────────────────────────────────────────────
    console.log("\n[RPA] Etapa 3: Abrindo formulário de admissão...");
    await page.goto(
        "https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration/add",
        { waitUntil: "domcontentloaded", timeout: 30000 }
    ).catch(() => {});
    await sleep(4000);

    const currentPage = await getPage();

    // ── ABA 1: GERAL ──────────────────────────────────────────────────────────
    console.log("\n[RPA] ── ABA 1: GERAL ──");

    // Nome do empregado (tenta vários formcontrolnames conhecidos)
    await fillAny(currentPage, [
        'input[formcontrolname="employeeName"]',
        'input[formcontrolname="name"]',
        'input[formcontrolname="nome"]',
        'input[placeholder*="Nome" i]',
        'input[placeholder*="nome" i]',
    ], candidateName);

    // CPF
    await fillAny(currentPage, [
        'input[formcontrolname="cpfNumber"]',
        'input[formcontrolname="cpf"]',
        'input[placeholder*="CPF" i]',
        'input[placeholder*="000.000.000"]',
    ], cpfFormatted);

    await sleep(500);

    // Selecionar empresa/serviço no combobox interno (caso haja)
    if (companyName) await selectDropdown(currentPage, "service", companyName);
    if (roleTitle)   await selectDropdown(currentPage, "jobPosition", roleTitle);
    if (roleTitle)   await selectDropdown(currentPage, "jobPositionExpanded", roleTitle);

    // Sub-aba ADMISSÃO
    console.log("\n  Sub-aba: ADMISSÃO");
    await clickByText(currentPage, "ADMISSÃO");

    await fillAny(currentPage, [
        'input[formcontrolname="salary"]',
        'input[formcontrolname="baseSalary"]',
        'input[placeholder*="alário" i]',
    ], salary);

    await fillAny(currentPage, [
        'input[formcontrolname="admissionDate"]',
        'input[formcontrolname="hiringDate"]',
        'input[placeholder*="Admissão" i]',
        'input[placeholder*="Data" i]',
    ], admissionDateFmt);

    await selectDropdown(currentPage, "admissionCategory", "Mensalista");
    await selectDropdown(currentPage, "employmentRelationship", "Celetista");

    // Sub-aba CONTRATO DE EXPERIÊNCIA
    console.log("\n  Sub-aba: CONTRATO DE EXPERIÊNCIA");
    await clickByText(currentPage, "CONTRATO DE EXPERIÊNCIA");
    await fillAny(currentPage, [
        'input[formcontrolname="probationPeriod"]',
        'input[formcontrolname="probationDays"]',
        'input[formcontrolname="probationDays1"]',
    ], "45");
    await fillAny(currentPage, [
        'input[formcontrolname="probationExtension"]',
        'input[formcontrolname="probationDays2"]',
    ], "45");

    // Sub-aba HORÁRIO
    console.log("\n  Sub-aba: HORÁRIO");
    await clickByText(currentPage, "HORÁRIO");
    await selectDropdown(currentPage, "workDayExpanded", "");
    // Garantir Cartão Ponto em branco
    await page.evaluate(() => {
        const inp = document.querySelector('input[formcontrolname="timeCard"], input[formcontrolname="cartaoPonto"]');
        if (inp) { inp.value = ""; inp.dispatchEvent(new Event("input", { bubbles: true })); }
    });

    // ── ABA 2: PROFISSIONAL ───────────────────────────────────────────────────
    console.log("\n[RPA] ── ABA 2: PROFISSIONAL ──");
    await clickByText(currentPage, "Profissional");
    await sleep(1500);

    await fillAny(currentPage, [
        'input[formcontrolname="workNumber"]',
        'input[formcontrolname="ctpsNumber"]',
    ], ctpsNum);

    await fillAny(currentPage, [
        'input[formcontrolname="workSerial"]',
        'input[formcontrolname="ctpsSerial"]',
    ], ctpsSerie);

    // PIS
    console.log("\n  Sub-aba: INFORMAÇÕES DO PIS");
    await clickByText(currentPage, "INFORMAÇÕES DO PIS");
    await fillAny(currentPage, [
        'input[formcontrolname="pisNumber"]',
        'input[formcontrolname="pis"]',
    ], pisNum);

    // PAGAMENTO — PIX
    console.log("\n  Sub-aba: PAGAMENTO");
    await clickByText(currentPage, "PAGAMENTO");
    await sleep(800);

    // Clicar no botão PIX
    await currentPage.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button, label, span, div, [role='radio'], [role='button']"));
        const pix = btns.find(el => {
            const t = (el.textContent || "").trim().toUpperCase();
            const rect = el.getBoundingClientRect();
            return t === "PIX" && rect.width > 0 && rect.height > 0 && rect.top > 100;
        });
        if (pix) pix.click();
    });
    await sleep(1000);

    await selectDropdown(currentPage, "pixKeyType", pixType);
    await fillAny(currentPage, [
        'input[formcontrolname="pixKey"]',
        'input[formcontrolname="pixKeyValue"]',
        'input[placeholder*="Chave PIX" i]',
        'input[placeholder*="chave" i]',
    ], pixKey);

    // ── ABA 3: PESSOAL ────────────────────────────────────────────────────────
    console.log("\n[RPA] ── ABA 3: PESSOAL ──");
    await clickByText(currentPage, "Pessoal");
    await sleep(1500);

    if (birthDateFmt) {
        await fillAny(currentPage, [
            'input[formcontrolname="birthDate"]',
            'input[formcontrolname="birthdate"]',
            'input[placeholder*="nascimento" i]',
        ], birthDateFmt);
    }

    // Gênero
    const isFem = gender.toLowerCase().includes("fem");
    await clickByText(currentPage, isFem ? "FEMININO" : "MASCULINO");
    await selectDropdown(currentPage, "gender", isFem ? "Feminino" : "Masculino");
    await sleep(300);

    // Dados pessoais
    await fillAny(currentPage, [
        'input[formcontrolname="motherName"]',
        'input[placeholder*="mãe" i]',
    ], nomeMae);
    await fillAny(currentPage, [
        'input[formcontrolname="fatherName"]',
        'input[placeholder*="pai" i]',
    ], nomePai);

    // Sub-aba ENDEREÇO E CONTATO
    console.log("\n  Sub-aba: ENDEREÇO E CONTATO");
    await clickByText(currentPage, "ENDEREÇO");
    await sleep(800);

    if (cep) await fillAny(currentPage, ['input[formcontrolname="zipCode"]', 'input[formcontrolname="cep"]'], cep);
    await sleep(500);
    if (endereco) await fillAny(currentPage, [
        'input[formcontrolname="streetAddress"]',
        'input[formcontrolname="address"]',
    ], endereco);
    if (bairro)   await fillAny(currentPage, ['input[formcontrolname="neighborhood"]'], bairro);
    if (cidade)   await fillAny(currentPage, ['input[formcontrolname="city"]', 'input[formcontrolname="municipio"]'], cidade);
    if (uf)       await selectDropdown(currentPage, "state", uf);
    if (email)    await fillAny(currentPage, ['input[formcontrolname="primaryEmailAddress"]', 'input[formcontrolname="email"]'], email);
    if (phone)    await fillAny(currentPage, ['input[formcontrolname="primaryPhoneNumber"]', 'input[formcontrolname="phone"]'], phone);

    // ── ABA 4: DOCUMENTOS ─────────────────────────────────────────────────────
    console.log("\n[RPA] ── ABA 4: DOCUMENTOS ──");
    await clickByText(currentPage, "Documentos");
    await sleep(1500);

    if (rgNum)    await fillAny(currentPage, ['input[formcontrolname="identityCard"]'], rgNum);
    if (rgOrgao)  await fillAny(currentPage, ['input[formcontrolname="issuingAgency"]'], rgOrgao);
    if (rgUf)     await selectDropdown(currentPage, "issuingState", rgUf);
    if (rgDataFmt) await fillAny(currentPage, ['input[formcontrolname="identityCardIssuingDate"]'], rgDataFmt);

    if (tituloNum)  await fillAny(currentPage, ['input[formcontrolname="voterRegistrationCard"]'], tituloNum);
    if (tituloZona) await fillAny(currentPage, ['input[formcontrolname="electoralZone"]'], tituloZona);
    if (tituloSec)  await fillAny(currentPage, ['input[formcontrolname="electoralSection"]'], tituloSec);
    if (cnhNum)     await fillAny(currentPage, ['input[formcontrolname="driverLicenseNumber"]'], cnhNum);
    if (cnhCat)     await fillAny(currentPage, ['input[formcontrolname="driverLicenseCategory"]'], cnhCat);
    if (resNum)     await fillAny(currentPage, ['input[formcontrolname="militaryRegistration"]'], resNum);

    // ── ABA 5: DEPENDENTES ────────────────────────────────────────────────────
    console.log("\n[RPA] ── ABA 5: DEPENDENTES ──");
    await clickByText(currentPage, "Dependentes");
    await sleep(1500);

    if (Array.isArray(dependentes) && dependentes.length > 0) {
        for (let i = 0; i < dependentes.length; i++) {
            const dep = dependentes[i];
            if (!dep.nome && !dep.name) continue;
            console.log(`  Adicionando dependente ${i + 1}: ${dep.nome || dep.name}`);

            await clickByText(currentPage, "Adicionar dependente");
            await sleep(1200);

            await fillAny(currentPage, ['input[formcontrolname="dependentName"]'], dep.nome || dep.name);
            if (dep.cpf) await fillAny(currentPage, ['input[formcontrolname="dependentCPF"]'], dep.cpf.replace(/\D/g, ""));
            const depNasc = formatDate(dep.dataNascimento || dep.birthDate || "");
            if (depNasc) await fillAny(currentPage, ['input[formcontrolname="dependentBirthDate"]'], depNasc);
            if (dep.parentesco) await selectDropdown(currentPage, "relationshipType", dep.parentesco);
            await sleep(500);
        }
    }

    // ── ABA 6: OBSERVAÇÕES ────────────────────────────────────────────────────
    console.log("\n[RPA] ── ABA 6: OBSERVAÇÕES ──");
    await clickByText(currentPage, "Observaç");
    await sleep(1500);

    await fillAny(currentPage, [
        'textarea[formcontrolname="observations"]',
        'textarea[formcontrolname="notes"]',
        'textarea',
    ], obsText, { clearFirst: true });

    // ── VERIFICAR EMPRESA NO TÍTULO ──────────────────────────────────────────
    const tituloForm = await currentPage.evaluate(() => {
        const h = Array.from(document.querySelectorAll("main h1, main h2, h1, h2, .page-title, .form-title"));
        const match = h.find(el => (el.textContent || "").includes("Empregado") || (el.textContent || "").includes("Admissão"));
        return match ? (match.textContent || "").trim() : "";
    });
    console.log(`\n[RPA] Título do formulário: "${tituloForm}"`);

    const compWords = companyName.toLowerCase().replace(/ltda|s\.a\./gi, "").trim().split(/\s+/).filter(w => w.length > 2);
    const isTituloWrong = tituloForm.toLowerCase().includes("clean tech") && !compWords.some(w => "clean tech".includes(w));
    if (isTituloWrong) {
        console.error(`[RPA] ❌ ABORTANDO: formulário está aberto para empresa errada!`);
        await browser.close(); activeBrowser = null;
        return { success: false, error: `Empresa errada no formulário: "${tituloForm}" vs "${companyName}"` };
    }

    // ── SALVAR E ENVIAR ───────────────────────────────────────────────────────
    console.log("\n[RPA] Clicando em 'Salvar e Enviar para o Escritório'...");
    const saved = await currentPage.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button, input[type='submit'], .btn, a"));
        const saveBtn = buttons.find(b => {
            const txt = (b.textContent || b.value || "").trim().toUpperCase();
            return txt.includes("SALVAR E ENVIAR") || txt.includes("ENVIAR PARA O ESCRITÓRIO") || txt === "SALVAR";
        });
        if (saveBtn) {
            console.log("[DOM] Clicando em:", saveBtn.textContent.trim());
            saveBtn.click();
            return true;
        }
        return false;
    });

    if (saved) {
        console.log("[RPA] ✓ Botão salvar clicado. Aguardando confirmação...");
        await sleep(4000);

        // Confirmar modal se aparecer
        await currentPage.evaluate(() => {
            const modals = Array.from(document.querySelectorAll(".modal button, .bento-dialog button, [role='dialog'] button"));
            const confirmBtn = modals.find(b => {
                const t = (b.textContent || "").trim().toLowerCase();
                return t === "sim" || t === "confirmar" || t === "enviar" || t === "salvar" || t === "ok";
            });
            if (confirmBtn) confirmBtn.click();
        });
        await sleep(3000);

        console.log(`\n[RPA] ✅ CONCLUÍDO: ${candidateName} enviado para o Onvio!`);
        return { success: true, message: `Ficha de ${candidateName} enviada com sucesso para ${companyName}!` };
    } else {
        console.warn("[RPA] ⚠ Botão Salvar não encontrado. Formulário preenchido mas não enviado.");
        return {
            success: false,
            error: "Formulário preenchido, mas botão 'Salvar e Enviar' não foi localizado. Verifique manualmente no Chrome."
        };
    }
}

// ─── SERVIDOR HTTP LOCAL ──────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

    if (req.url === "/api/rpa/onvio" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => { body += chunk.toString(); });
        req.on("end", async () => {
            try {
                const data = JSON.parse(body);
                const result = await executeVisualFilling(data.payload || data);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (err) {
                console.error("[RPA HTTP Error]:", err);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
    } else if (req.url === "/status") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "online", isRunning, timestamp: new Date().toISOString() }));
    } else {
        res.writeHead(404); res.end("Not Found");
    }
});

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.log(`\n[i] Porta ${PORT} em uso — operando apenas via polling da fila Vercel.`);
    } else {
        console.error("Erro no servidor:", err.message);
    }
});

server.listen(PORT, () => {
    console.log("=".repeat(60));
    console.log(`  🤖 ROBÔ RPA ONVIO — WORKFORCE HUB`);
    console.log(`  ✓ Servidor local ativo na porta ${PORT}`);
    console.log(`  ✓ Polling da fila Vercel a cada ${POLL_INTERVAL_MS / 1000}s`);
    console.log(`  ✓ Mantenha esta janela aberta!`);
    console.log("=".repeat(60));
});

// ─── POLLING CONTÍNUO DA FILA VERCEL ─────────────────────────────────────────

setInterval(async () => {
    if (isRunning) return; // não processar em paralelo
    try {
        const response = await fetch(VERCEL_POLL_URL, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) return;

        const data = await response.json();
        if (!data || !data.job) return;

        const job = data.job;
        console.log(`\n[RPA POLL] 🔔 Novo job: ${job.payload?.name || job.payload?.candidateName || job.candidateId}`);

        isRunning = true;
        try {
            const result = await executeVisualFilling(job.payload);
            await fetch(VERCEL_POLL_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jobId: job.id,
                    status: result.success ? "COMPLETED" : "FAILED",
                    result: result.message || result.error,
                }),
            });
            console.log(`[RPA POLL] Job ${job.id} finalizado: ${result.success ? "✅ SUCESSO" : "❌ FALHOU"}`);
        } finally {
            isRunning = false;
        }
    } catch (e) {
        if (!e.message?.includes("AbortError")) {
            console.error("[RPA POLL] Erro:", e.message);
        }
    }
}, POLL_INTERVAL_MS);

process.stdin.resume();
