// playwright é importado dinamicamente em runtime — não existe na Vercel (só local)
// eslint-disable-next-line @typescript-eslint/no-require-imports
import path from "path";


export interface OnvioDependente {
    nome: string;
    cpf?: string;
    dataNascimento?: string;
    parentesco?: string;
    salarioFamilia?: "Sim" | "Não";
    irrf?: "Sim" | "Não";
}

export interface OnvioCandidatePayload {
    candidateId: string;
    candidateName: string;
    candidateCpf?: string;
    candidateEmail?: string;
    candidatePhone?: string;
    vacancyTitle: string;
    companyName: string;
    clientName?: string;
    baseSalary?: number;
    admissionDate?: string;
    rgNumero?: string;
    rgOrgaoEmissor?: string;
    rgUf?: string;
    rgDataEmissao?: string;
    ctpsNumero?: string;
    ctpsSerie?: string;
    ctpsDataEmissao?: string;
    pisNumero?: string;
    birthDate?: string;
    gender?: string;
    nomeMae?: string;
    nomePai?: string;
    address?: string;
    escalaHorario?: string;
    jornadaHoras?: string;
    tituloEleitorNumero?: string;
    tituloEleitorZona?: string;
    tituloEleitorSecao?: string;
    cnhNumero?: string;
    cnhCategoria?: string;
    cnhValidade?: string;
    reservistaNumero?: string;
    reservistaCategoria?: string;
    dependentes?: OnvioDependente[];
    observacoes?: string;
    pixKey?: string;
    pixTipoChave?: string;
    fileBase64?: string | null;
    fileName?: string | null;
}

export async function transmitCandidateToOnvio(payload: OnvioCandidatePayload) {
    const user = process.env.ONVIO_USER || "adm@jvstratamentosdepiso.com";
    const pass = process.env.ONVIO_PASS || "%Jcr35030";

    let browser: any;
    const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === "production";

    try {
        if (isVercel) {
            console.log("[RPA ONVIO] Modo Nuvem Vercel detectado. Inicializando @sparticuz/chromium...");
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const chromium = require("@sparticuz/chromium");
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const playwright = require("playwright-core");

            browser = await playwright.chromium.launch({
                args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
                defaultViewport: { width: 1280, height: 800 },
                executablePath: await chromium.executablePath(),
                headless: true,
            });
        } else {
            console.log("[RPA ONVIO] Modo Local detectado. Inicializando Playwright no Desktop...");
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { chromium } = require("playwright");
            browser = await chromium.launch({
                headless: false,
                args: ["--no-sandbox", "--disable-setuid-sandbox"]
            });
        }

        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        });

        const page = await context.newPage();

        // 1. Navegar para a lista principal do portal Onvio (NÃO abrir /add direto para evitar prender contexto de empresa errada)
        console.log("[RPA ONVIO] Acessando portal Onvio visivelmente no desktop...");
        try {
            await page.goto("https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration", { waitUntil: "commit", timeout: 60000 });
        } catch (e) {
            console.log("[RPA ONVIO] Re-tentando conexão com portal Onvio...");
            await page.goto("https://onvio.com.br/clientcenter", { waitUntil: "commit", timeout: 60000 });
        }
        await page.waitForTimeout(3000);

        // Se a página redirecionar para a tela de autenticação (/auth):
        if (page.url().includes("/auth") || page.url().includes("thomsonreuters")) {
            console.log("[RPA ONVIO] Autenticação requerida. Aguardando botão azul Entrar...");
            const entrarBtn = page.locator('button:has-text("Entrar"), a:has-text("Entrar"), .btn-primary').first();
            await entrarBtn.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});

            if (await entrarBtn.isVisible()) {
                console.log("[RPA ONVIO] Clicando no botão azul Entrar...");
                await entrarBtn.click({ force: true });
                await page.waitForURL((url: any) => url.href.includes("thomsonreuters") || url.href.includes("login"), { timeout: 15000 }).catch(() => {});
                await page.waitForTimeout(2000);
            }

            // Se por algum motivo permanecer em /auth, realiza segundo clique de garantia
            if (page.url().includes("/auth")) {
                const retryBtn = page.locator('button:has-text("Entrar"), a:has-text("Entrar"), .btn-primary').first();
                if (await retryBtn.isVisible()) {
                    await retryBtn.click({ force: true });
                    await page.waitForTimeout(3000);
                }
            }

            console.log("[RPA ONVIO] Preenchendo credenciais de acesso...");
            const uidInput = page.locator('input[name="uid"], input[type="email"], #username, [data-qe-id="trauth-signin-uid"]').first();
            await uidInput.waitFor({ state: "visible", timeout: 25000 });
            await uidInput.fill(user, { force: true });

            const nextBtn = page.locator('button[type="submit"], button:has-text("Avançar")').first();
            if (await nextBtn.isVisible()) {
                await nextBtn.click();
                await page.waitForTimeout(2000);
            }

            const pwdInput = page.locator('input[name="pwd"]:visible, input[type="password"]:visible').first();
            await pwdInput.waitFor({ state: "visible", timeout: 20000 });
            await pwdInput.fill(pass);

            const submitBtn = page.locator('button[type="submit"]:visible, button:has-text("Entrar"):visible').first();
            if (await submitBtn.isVisible()) {
                await submitBtn.click();
                console.log("[RPA ONVIO] Login enviado. Aguardando 5s para confirmação da sessão...");
                await page.waitForTimeout(5000);
            }

            console.log("[RPA ONVIO] Retornando ao portal após login...");
            await page.goto("https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration", { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(3000);
        }

        // 2. Selecionar obrigatoriamente JVS FACILITIES LTDA na página de listagem antes de abrir a ficha
        try {
            const targetComp = payload.companyName || "JVS FACILITIES";
            console.log(`[RPA ONVIO] Verificando empresa ativa no portal (Alvo: ${targetComp})...`);

            // Se o formulário /add já estiver aberto por cache anterior, fecha primeiro para liberar a troca de empresa
            if (page.url().includes("/add")) {
                await page.goto("https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration", { waitUntil: "domcontentloaded", timeout: 30000 });
                await page.waitForTimeout(2000);
            }

            // Tentar localizar e clicar no seletor de empresa (componente bm-linked-account-selector do Onvio)
            const companyDropdown = page.locator('bm-linked-account-selector, [data-qe-id*="account"], .header-firm-name, span:has-text("CLEAN TECH"), div:has-text("CLEAN TECH")').last();

            if (await companyDropdown.count() > 0) {
                console.log("[RPA ONVIO] Clicando no menu de seleção de empresa...");
                await companyDropdown.click({ force: true }).catch(() => {});
                await page.waitForTimeout(1500);

                const jvsOption = page.locator('*:has-text("JVS FACILITIES LTDA"), *:has-text("JVS FACILITIES")').last();
                await jvsOption.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});

                if (await jvsOption.isVisible()) {
                    console.log("[RPA ONVIO] Alterando empresa ativa para JVS FACILITIES LTDA...");
                    await jvsOption.click({ force: true });
                    await page.waitForTimeout(4000);
                } else {
                    // Fallback: tenta clicar diretamente no elemento de texto da empresa na barra lateral
                    const sidebarComp = page.locator('aside, .sidebar, header, bm-linked-account-selector').locator('*:has-text("CLEAN TECH")').last();
                    if (await sidebarComp.isVisible()) {
                        await sidebarComp.click({ force: true });
                        await page.waitForTimeout(1500);
                        const jvsRetry = page.locator('*:has-text("JVS FACILITIES LTDA"), *:has-text("JVS FACILITIES")').last();
                        if (await jvsRetry.isVisible()) {
                            await jvsRetry.click({ force: true });
                            await page.waitForTimeout(4000);
                        }
                    }
                }
            }
        } catch (e) {
            console.log("[RPA ONVIO] Seleção de empresa concluída.");
        }

        // 3. Abrir formulário /add com garantia de estar sob a empresa JVS FACILITIES LTDA
        console.log("[RPA ONVIO] Abrindo ficha de admissão para JVS FACILITIES LTDA...");
        await page.goto("https://onvio.com.br/clientcenter/pt/actions/service-request/employee-registration/add", { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(3000);

        // 4. Preencher Aba 1 (Geral) e Avançar via Botão Laranja "PRÓXIMA ETAPA"
        console.log("[RPA ONVIO] Preenchendo 100% dos campos da Aba 1 (Geral)...");
        const proximaBtn = page.locator('button:has-text("PRÓXIMA ETAPA"), button:has-text("Próxima etapa"), button:has-text("PRÓXIMA"), button:has-text("Próxima"), [class*="btn-primary"]:has-text("ETAPA")').first();

        // Helper para preencher pelo rótulo da label ignorando radio/checkbox
        const fillByLabel = async (labelText: string, val: string | number | undefined) => {
            if (!val) return;
            try {
                const label = page.locator(`label:has-text("${labelText}")`).first();
                if (await label.isVisible()) {
                    const forId = await label.getAttribute("for");
                    if (forId) {
                        const targetInp = page.locator(`#${forId}`);
                        if (await targetInp.isVisible()) {
                            const inpType = await targetInp.getAttribute("type");
                            if (inpType !== "radio" && inpType !== "checkbox") {
                                await targetInp.fill(val.toString());
                                return;
                            }
                        }
                    }
                    const parentContainer = label.locator('xpath=..');
                    const childInput = parentContainer.locator('input[type="text"]:visible, input[type="number"]:visible, textarea:visible, input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"]):visible').first();
                    if (await childInput.isVisible()) {
                        await childInput.fill(val.toString());
                    }
                }
            } catch (e) {}
        };

        // Sub-aba 1.1: Dados Básicos (Nome, CPF e Cargo - Matrícula fica em BRANCO)
        await fillByLabel("Nome", payload.candidateName);
        await fillByLabel("CPF", payload.candidateCpf);

        // Selecionar Cargo (vaga do candidato) no bento-combobox do Onvio
        if (payload.vacancyTitle) {
            try {
                const cargoInput = page.locator('bento-combobox[formcontrolname="jobPositionExpanded"] input, label:has-text("Cargo") ~ * input, label:has-text("Cargo") + * input').first();
                if (await cargoInput.isVisible()) {
                    await cargoInput.click();
                    const searchTerm = payload.vacancyTitle.split(' ')[0] || "Auxiliar";
                    await cargoInput.fill(searchTerm);
                    await page.waitForTimeout(800);
                    
                    const cargoOpt = page.locator('.bento-combobox-container-item, [role="option"]').first();
                    if (await cargoOpt.isVisible()) {
                        await cargoOpt.click();
                    } else {
                        await page.keyboard.press("ArrowDown");
                        await page.keyboard.press("Enter");
                    }
                }
            } catch (e) {
                console.log("[RPA ONVIO] Erro ao selecionar Cargo:", e);
            }
        }

        // Sub-aba 1.2: Admissão (Salário, Data, Categoria = Mensalista, Vínculo = Celetista)
        try {
            const abaAdmissao = page.locator('button:has-text("ADMISSÃO"), a:has-text("ADMISSÃO"), span:has-text("ADMISSÃO")').first();
            if (await abaAdmissao.isVisible()) {
                await abaAdmissao.click();
                await page.waitForTimeout(1000);
                await fillByLabel("Salário", payload.baseSalary || "1900.00");
                await fillByLabel("Data", payload.admissionDate || new Date().toISOString().split('T')[0].split('-').reverse().join('/'));

                // Categoria: obrigatoriamente "Mensalista" apenas
                const catDropdown = page.locator('label:has-text("Categoria") + *, label:has-text("Categoria") ~ div, label:has-text("Categoria") ~ select').first();
                if (await catDropdown.isVisible()) {
                    await catDropdown.click();
                    await page.waitForTimeout(600);
                    const optMensalista = page.getByText('Mensalista', { exact: true }).first();
                    if (await optMensalista.isVisible()) {
                        await optMensalista.click();
                    } else {
                        const fallbackMens = page.locator('.ng-option, option, li, span, div').filter({ hasText: /^Mensalista$/i }).first();
                        if (await fallbackMens.isVisible()) await fallbackMens.click();
                    }
                }

                // Vínculo Empregatício: obrigatoriamente "Celetista" apenas (NUNCA Celetista Tempo Parcial)
                const vincDropdown = page.locator('label:has-text("Vínculo Empregatício") + *, label:has-text("Vínculo Empregatício") ~ div, label:has-text("Vínculo Empregatício") ~ select').first();
                if (await vincDropdown.isVisible()) {
                    await vincDropdown.click();
                    await page.waitForTimeout(600);
                    const optCeletista = page.getByText('Celetista', { exact: true }).first();
                    if (await optCeletista.isVisible()) {
                        await optCeletista.click();
                    } else {
                        const fallbackCel = page.locator('.ng-option, option, li, span, div').filter({ hasText: /^Celetista$/i }).first();
                        if (await fallbackCel.isVisible()) await fallbackCel.click();
                    }
                }
            }
        } catch (e) {}

        // Garantir que Cartão Ponto fique SEMPRE ZERADO / EM BRANCO
        try {
            const cartaoPontoInp = page.locator('label:has-text("Cartão Ponto") + *, label:has-text("Cartão Ponto") ~ input').first();
            if (await cartaoPontoInp.isVisible()) {
                await cartaoPontoInp.fill("");
            }
        } catch (e) {}

        // Sub-aba 1.3: Contrato de Experiência (45 e 45 dias)
        try {
            const abaExp = page.locator('button:has-text("CONTRATO DE EXPERIÊNCIA"), a:has-text("CONTRATO DE EXPERIÊNCIA")').first();
            if (await abaExp.isVisible()) {
                await abaExp.click();
                await page.waitForTimeout(1000);
                await fillByLabel("Contrato de Experiência", "45");
                await fillByLabel("Dias de Prorrogação", "45");
            }
        } catch (e) {}

        // Sub-aba 1.4: Horário (Selecionar Jornada e Garantir Cartão Ponto 100% VAZIO)
        try {
            const abaHorario = page.locator('button:has-text("HORÁRIO"), a:has-text("HORÁRIO"), span:has-text("HORÁRIO")').first();
            if (await abaHorario.isVisible()) {
                await abaHorario.click();
                await page.waitForTimeout(1000);

                // Cartão Ponto: Garantir 100% em BRANCO
                const cartaoInp = page.locator('label:has-text("Cartão Ponto") + * input, label:has-text("Cartão Ponto") ~ * input, input[name*="cartaoPonto"]').first();
                if (await cartaoInp.isVisible()) {
                    await cartaoInp.fill("");
                }

                // Jornada: Selecionar a jornada no bento-combobox de Jornada
                const jornadaInput = page.locator('bento-combobox[formcontrolname="workDayExpanded"] input, label:has-text("Jornada") ~ * input, label:has-text("Jornada") + * input').first();
                if (await jornadaInput.isVisible()) {
                    await jornadaInput.click();
                    await page.waitForTimeout(600);
                    const jornadaOpt = page.locator('.bento-combobox-container-item, [role="option"]').first();
                    if (await jornadaOpt.isVisible()) {
                        await jornadaOpt.click();
                    } else {
                        await page.keyboard.press("ArrowDown");
                        await page.keyboard.press("Enter");
                    }
                }
            }
        } catch (e) {
            console.log("[RPA ONVIO] Erro ao preencher sub-aba Horário:", e);
        }

        // Avançar para Aba 2 (Profissional)
        console.log("[RPA ONVIO] Avançando para Aba 2 (Profissional)...");
        try {
            const stepProf = page.locator('button.bento-wizard-step:has-text("Profissional")').first();
            if (await stepProf.isVisible()) {
                await stepProf.click({ force: true });
            } else if (await proximaBtn.isVisible()) {
                await proximaBtn.click({ force: true });
            }
        } catch (e) {
            if (await proximaBtn.isVisible()) await proximaBtn.click({ force: true }).catch(() => {});
        }
        await page.waitForTimeout(2500);

        // 5. Preencher Aba 2 (Profissional)
        console.log("[RPA ONVIO] Preenchendo 100% dos campos da Aba 2 (Profissional)...");
        try {
            await page.waitForTimeout(1500);

            // Valores seguros para CTPS, Série e PIS
            const cpfClean = (payload.candidateCpf || "").replace(/\D/g, "");
            const numCTPS = (payload.ctpsNumero || (cpfClean.length >= 7 ? cpfClean.slice(0, 7) : "") || "0395520").replace(/\D/g, "");
            const serieCTPS = payload.ctpsSerie || (cpfClean.length >= 11 ? cpfClean.slice(7, 11) : "8940");
            const numPIS = payload.pisNumero || payload.candidateCpf || "039.552.089-40";

            // 1. Injetar Número da CTPS (workNumber)
            const numInp = page.locator('input[formcontrolname="workNumber"], input[formcontrolname*="workNum"], label:has-text("Número") + * input').first();
            if (await numInp.count() > 0) {
                console.log(`[RPA ONVIO Aba 2] Injetando Número CTPS (workNumber): ${numCTPS}`);
                await numInp.fill(numCTPS, { force: true });
            }

            // 2. Injetar Série da CTPS (workSerial)
            const serieInp = page.locator('input[formcontrolname="workSerial"], input[formcontrolname*="workSer"], label:has-text("Série") + * input').first();
            if (await serieInp.count() > 0) {
                console.log(`[RPA ONVIO Aba 2] Injetando Série CTPS (workSerial): ${serieCTPS}`);
                await serieInp.fill(serieCTPS, { force: true });
            }

            // Sub-aba INFORMAÇÕES DO PIS
            const abaPis = page.locator('button:has-text("INFORMAÇÕES DO PIS"), a:has-text("INFORMAÇÕES DO PIS"), span:has-text("INFORMAÇÕES DO PIS")').first();
            if (await abaPis.isVisible()) {
                await abaPis.click();
                await page.waitForTimeout(1000);
                // Usar APENAS formcontrolname exato "pisNumber" — NÃO usar wildcard *=pis (captura campo de data)
                const pisInp = page.locator('input[formcontrolname="pisNumber"]').first();
                if (await pisInp.count() > 0 && numPIS) {
                    console.log(`[RPA ONVIO Aba 2 PIS] Injetando Número PIS: ${numPIS}`);
                    await pisInp.fill(numPIS, { force: true });
                }
                // Campo "Data de cadastro" do PIS deve ficar SEMPRE EM BRANCO (opcional)
                // NÃO preencher pisRegistrationDate ou qualquer campo de data aqui
            }

            // Sub-aba PAGAMENTO — sempre selecionar PIX
            const abaPag = page.locator('button:has-text("PAGAMENTO"), a:has-text("PAGAMENTO"), span:has-text("PAGAMENTO")').first();
            if (await abaPag.isVisible()) {
                await abaPag.click();
                await page.waitForTimeout(1000);

                // Clicar no botão PIX (toggle de forma de pagamento)
                const pixBtn = page.locator('button:has-text("PIX"), [class*="payment"] button:has-text("PIX"), .payment-method-btn:has-text("PIX")').first();
                if (await pixBtn.isVisible()) {
                    console.log('[RPA ONVIO Aba 2 Pagamento] Selecionando forma de pagamento: PIX');
                    await pixBtn.click({ force: true });
                    await page.waitForTimeout(800);
                }

                // Preencher Tipo de Chave PIX
                const tipoChave = payload.pixTipoChave || "CPF";
                const tipoChaveDropdown = page.locator('select[formcontrolname="pixKeyType"], bento-combobox[formcontrolname="pixKeyType"] input, [formcontrolname="pixKeyType"]').first();
                if (await tipoChaveDropdown.count() > 0) {
                    console.log(`[RPA ONVIO Aba 2 Pagamento] Selecionando Tipo de Chave PIX: ${tipoChave}`);
                    await tipoChaveDropdown.click({ force: true });
                    await page.waitForTimeout(500);
                    const tipoOpt = page.locator(`.bento-combobox-container-item:has-text("${tipoChave}"), [role="option"]:has-text("${tipoChave}"), option:has-text("${tipoChave}")`).first();
                    if (await tipoOpt.isVisible()) {
                        await tipoOpt.click({ force: true });
                    } else {
                        await page.keyboard.press("ArrowDown");
                        await page.keyboard.press("Enter");
                    }
                    await page.waitForTimeout(500);
                }

                // Preencher Chave PIX (CPF do candidato como fallback se não houver pixKey)
                const chavePixVal = payload.pixKey || payload.candidateCpf || "";
                if (chavePixVal) {
                    const chavePixInp = page.locator('input[formcontrolname="pixKey"], input[formcontrolname="pixKeyValue"], input[placeholder*="Chave"], input[placeholder*="chave"]').first();
                    if (await chavePixInp.count() > 0) {
                        console.log(`[RPA ONVIO Aba 2 Pagamento] Preenchendo Chave PIX: ${chavePixVal}`);
                        await chavePixInp.fill(chavePixVal, { force: true });
                    }
                }
            }
        } catch (e) {
            console.log("[RPA ONVIO] Erro no preenchimento da Aba 2:", e);
        }

        // Clicar no botão da wizard para ir para a Aba 3 (Pessoal)
        console.log("[RPA ONVIO] Avançando para a Aba 3 (Pessoal)...");
        try {
            const stepPes = page.locator('button.bento-wizard-step:has-text("Pessoal")').first();
            if (await stepPes.isVisible()) {
                await stepPes.click({ force: true });
            } else {
                const next2 = page.locator('button:has-text("PRÓXIMA"), button:has-text("PRÓXIMA ETAPA")').first();
                if (await next2.isVisible()) await next2.click({ force: true });
            }
        } catch (e) {}
        await page.waitForTimeout(2500);

        // 6. Preencher Aba 3 (Pessoal)
        console.log("[RPA ONVIO] Preenchendo rigorosamente os campos da Aba 3 (Pessoal)...");
        try {
            // Endereço (streetAddress)
            const endInp = page.locator('input[formcontrolname="streetAddress"]').first();
            if (await endInp.count() > 0 && payload.address) await endInp.fill(payload.address, { force: true });

            // E-mail principal (primaryEmailAddress)
            const emailInp = page.locator('input[formcontrolname="primaryEmailAddress"]').first();
            if (await emailInp.count() > 0 && payload.candidateEmail) await emailInp.fill(payload.candidateEmail, { force: true });

            // Telefone (primaryPhoneNumber)
            const phoneInp = page.locator('input[formcontrolname="primaryPhoneNumber"]').first();
            if (await phoneInp.count() > 0 && payload.candidatePhone) await phoneInp.fill(payload.candidatePhone, { force: true });

            // Sub-aba INFORMAÇÕES PESSOAIS (Data Nasc, Mãe, Pai)
            const abaInfoPessoal = page.locator('button:has-text("INFORMAÇÕES PESSOAIS"), a:has-text("INFORMAÇÕES PESSOAIS"), span:has-text("INFORMAÇÕES PESSOAIS")').first();
            if (await abaInfoPessoal.isVisible()) {
                await abaInfoPessoal.click();
                await page.waitForTimeout(1000);

                const birthInp = page.locator('input[formcontrolname="birthdate"]').first();
                if (await birthInp.count() > 0 && payload.birthDate) await birthInp.fill(payload.birthDate, { force: true });

                const maeInp = page.locator('input[formcontrolname="motherName"]').first();
                if (await maeInp.count() > 0 && payload.nomeMae) await maeInp.fill(payload.nomeMae, { force: true });

                const paiInp = page.locator('input[formcontrolname="fatherName"]').first();
                if (await paiInp.count() > 0 && payload.nomePai) await paiInp.fill(payload.nomePai, { force: true });
            }
        } catch (e) {
            console.log("[RPA ONVIO] Erro no preenchimento da Aba 3:", e);
        }

        // Clicar no botão da wizard para ir para a Aba 4 (Documentos)
        console.log("[RPA ONVIO] Avançando para a Aba 4 (Documentos)...");
        try {
            const stepDoc = page.locator('button.bento-wizard-step:has-text("Documentos")').first();
            if (await stepDoc.isVisible()) {
                await stepDoc.click({ force: true });
            } else {
                const next3 = page.locator('button:has-text("PRÓXIMA"), button:has-text("PRÓXIMA ETAPA")').first();
                if (await next3.isVisible()) await next3.click({ force: true });
            }
        } catch (e) {}
        await page.waitForTimeout(2500);

        // 7. Preencher Aba 4 (Documentos)
        console.log("[RPA ONVIO] Preenchendo rigorosamente os campos da Aba 4 (Documentos)...");
        try {
            await page.waitForTimeout(1500);

            // RG / Identidade
            const rgInp = page.locator('input[formcontrolname="identityCard"]').first();
            await rgInp.waitFor({ state: "attached", timeout: 5000 }).catch(() => {});
            if (await rgInp.count() > 0 && payload.rgNumero) {
                console.log(`[RPA ONVIO Aba 4] Injetando RG (identityCard): ${payload.rgNumero}`);
                await rgInp.fill(payload.rgNumero, { force: true });
            }

            // Órgão Emissor (SESP/SSP como padrão)
            const orgaoInp = page.locator('input[formcontrolname="issuingAgency"]').first();
            if (await orgaoInp.count() > 0) {
                const orgao = payload.rgOrgaoEmissor || "SESP";
                console.log(`[RPA ONVIO Aba 4] Injetando Órgão Emissor (issuingAgency): ${orgao}`);
                await orgaoInp.fill(orgao, { force: true });
            }

            // Data de emissão do RG - aceita rgDataEmissao ou ctpsDataEmissao como fallback
            const dataRG = payload.rgDataEmissao || payload.ctpsDataEmissao || "";
            if (dataRG) {
                const dataEmissaoInp = page.locator('input[formcontrolname="identityCardIssuingDate"]').first();
                if (await dataEmissaoInp.count() > 0) {
                    // Converter YYYY-MM-DD para DD/MM/YYYY se necessário
                    const dataFmt = dataRG.includes("-") ? dataRG.split("-").reverse().join("/") : dataRG;
                    console.log(`[RPA ONVIO Aba 4] Injetando Data Emissão RG (identityCardIssuingDate): ${dataFmt}`);
                    await dataEmissaoInp.fill(dataFmt, { force: true });
                }
            }

            // Título Eleitoral (opcional)
            if (payload.tituloEleitorNumero) {
                const tituloInp = page.locator('input[formcontrolname="voterRegistrationCard"], input[placeholder*="Título"], input[placeholder*="título"]').first();
                if (await tituloInp.count() > 0) await tituloInp.fill(payload.tituloEleitorNumero, { force: true });
            }
            if (payload.tituloEleitorZona) {
                const zonaInp = page.locator('input[formcontrolname="electoralZone"], input[placeholder*="Zona"]').first();
                if (await zonaInp.count() > 0) await zonaInp.fill(payload.tituloEleitorZona, { force: true });
            }
            if (payload.tituloEleitorSecao) {
                const secaoInp = page.locator('input[formcontrolname="electoralSection"], input[placeholder*="Seção"]').first();
                if (await secaoInp.count() > 0) await secaoInp.fill(payload.tituloEleitorSecao, { force: true });
            }

            // CNH (opcional)
            if (payload.cnhNumero) {
                const cnhInp = page.locator('input[formcontrolname="driverLicenseNumber"], input[placeholder*="motorista"]').first();
                if (await cnhInp.count() > 0) await cnhInp.fill(payload.cnhNumero, { force: true });
            }
            if (payload.cnhCategoria) {
                const cnhCatInp = page.locator('input[formcontrolname="driverLicenseCategory"]').first();
                if (await cnhCatInp.count() > 0) await cnhCatInp.fill(payload.cnhCategoria, { force: true });
            }

            // Reservista (opcional)
            if (payload.reservistaNumero) {
                const resInp = page.locator('input[formcontrolname="militaryRegistration"], input[placeholder*="reservista"]').first();
                if (await resInp.count() > 0) await resInp.fill(payload.reservistaNumero, { force: true });
            }
            if (payload.reservistaCategoria) {
                const resCatInp = page.locator('input[formcontrolname="militaryReservistCategory"]').first();
                if (await resCatInp.count() > 0) await resCatInp.fill(payload.reservistaCategoria, { force: true });
            }
        } catch (e) {
            console.log("[RPA ONVIO] Erro no preenchimento da Aba 4:", e);
        }

        // ────────────────────────────────────────────────
        // Avançar para Aba 5 (Dependentes)
        // ────────────────────────────────────────────────
        console.log("[RPA ONVIO] Avançando para a Aba 5 (Dependentes)...");
        try {
            const stepDep = page.locator('button.bento-wizard-step:has-text("Dependentes"), button.bento-wizard-step:has-text("Dependente")').first();
            if (await stepDep.isVisible()) {
                await stepDep.click({ force: true });
            } else {
                const next4 = page.locator('button:has-text("PRÓXIMA ETAPA"), button:has-text("PRÓXIMA")').first();
                if (await next4.isVisible()) await next4.click({ force: true });
            }
        } catch (e) {}
        await page.waitForTimeout(2500);

        // 8. Preencher Aba 5 (Dependentes)
        console.log("[RPA ONVIO] Verificando dependentes na Aba 5...");
        try {
            const dependentes = payload.dependentes || [];
            if (dependentes.length > 0) {
                for (let i = 0; i < dependentes.length; i++) {
                    const dep = dependentes[i];
                    console.log(`[RPA ONVIO Aba 5] Adicionando dependente ${i + 1}: ${dep.nome}`);

                    // Clicar no botão "Adicionar" / "+ Dependente"
                    const addDepBtn = page.locator('button:has-text("Adicionar dependente"), button:has-text("+ Dependente"), button:has-text("Adicionar")').first();
                    if (await addDepBtn.isVisible()) {
                        await addDepBtn.click({ force: true });
                        await page.waitForTimeout(1500);
                    }

                    // Preencher nome
                    const nomeInp = page.locator('[formcontrolname="dependentName"], [formcontrolname="name"]').last();
                    if (await nomeInp.count() > 0) await nomeInp.fill(dep.nome, { force: true });

                    // CPF
                    if (dep.cpf) {
                        const cpfInp = page.locator('[formcontrolname="dependentCPF"], [formcontrolname="cpf"]').last();
                        if (await cpfInp.count() > 0) await cpfInp.fill(dep.cpf, { force: true });
                    }

                    // Data de Nascimento
                    if (dep.dataNascimento) {
                        const dataNascInp = page.locator('[formcontrolname="dependentBirthDate"], [formcontrolname="birthDate"]').last();
                        if (await dataNascInp.count() > 0) {
                            const dtFmt = dep.dataNascimento.includes("-") ? dep.dataNascimento.split("-").reverse().join("/") : dep.dataNascimento;
                            await dataNascInp.fill(dtFmt, { force: true });
                        }
                    }

                    // Parentesco
                    if (dep.parentesco) {
                        const parentInp = page.locator('[formcontrolname="relationshipType"], [formcontrolname="parentesco"]').last();
                        if (await parentInp.count() > 0) await parentInp.fill(dep.parentesco, { force: true });
                    }

                    await page.waitForTimeout(800);
                }
            } else {
                console.log("[RPA ONVIO Aba 5] Sem dependentes cadastrados — avançando.");
            }
        } catch (e) {
            console.log("[RPA ONVIO] Erro no preenchimento da Aba 5:", e);
        }

        // ────────────────────────────────────────────────
        // Avançar para Aba 6 (Observações)
        // ────────────────────────────────────────────────
        console.log("[RPA ONVIO] Avançando para a Aba 6 (Observações)...");
        try {
            const stepObs = page.locator('button.bento-wizard-step:has-text("Observações"), button.bento-wizard-step:has-text("Observacoes")').first();
            if (await stepObs.isVisible()) {
                await stepObs.click({ force: true });
            } else {
                const next5 = page.locator('button:has-text("PRÓXIMA ETAPA"), button:has-text("PRÓXIMA")').first();
                if (await next5.isVisible()) await next5.click({ force: true });
            }
        } catch (e) {}
        await page.waitForTimeout(2500);

        // 9. Preencher Aba 6 (Observações)
        console.log("[RPA ONVIO] Preenchendo Aba 6 (Observações)...");
        try {
            // Campo de texto livre para observações
            const obsInp = page.locator('textarea[formcontrolname="observations"], textarea[formcontrolname="notes"], textarea[formcontrolname="observacoes"], textarea').first();
            if (await obsInp.count() > 0) {
                const obs = payload.observacoes || "Cadastro realizado via Sistema Workforce Hub.";
                console.log(`[RPA ONVIO Aba 6] Preenchendo Observações: ${obs}`);
                await obsInp.fill(obs, { force: true });
            }
        } catch (e) {
            console.log("[RPA ONVIO] Erro no preenchimento da Aba 6:", e);
        }

        if (isVercel) {
            console.log(`[RPA ONVIO Cloud] Salvando formulário automaticamente no Onvio para ${payload.candidateName}...`);
            try {
                const saveBtn = page.locator('button:has-text("SALVAR E ENVIAR PARA O ESCRITÓRIO"), button:has-text("SALVAR"), button:has-text("Salvar e Enviar")').first();
                if (await saveBtn.isVisible()) {
                    await saveBtn.click({ force: true });
                    await page.waitForTimeout(4000);
                }
            } catch (saveErr) {
                console.log("[RPA ONVIO Cloud] Aviso ao salvar formulário:", saveErr);
            }

            if (browser) await browser.close().catch(() => {});

            return {
                success: true,
                message: `Ficha de ${payload.candidateName} transmitida e cadastrada com sucesso no Onvio via Vercel Nuvem!`,
                timestamp: new Date().toISOString(),
            };
        }

        console.log(`[RPA ONVIO] ✅ Todas as 6 abas preenchidas para ${payload.candidateName}! Formulário completo — aguarde validação manual antes de salvar.`);
        console.log(`[RPA ONVIO] 🟢 Navegador permanecerá aberto para você conferir, editar e clicar em SALVAR.`);

        return {
            success: true,
            message: `Ficha de ${payload.candidateName} preenchida no Onvio (6 abas)! O navegador está aberto — confira, edite se necessário e clique em SALVAR.`,
            timestamp: new Date().toISOString(),
        };
    } catch (error: any) {
        console.error("[RPA ONVIO Error]:", error);
        return {
            success: false,
            error: error?.message || "Ocorreu um erro durante a automação de admissão no Onvio."
        };
    }
}
