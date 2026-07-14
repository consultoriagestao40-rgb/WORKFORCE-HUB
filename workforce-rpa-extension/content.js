// Workforce Hub - Chrome Extension RPA content.js

const isWorkforceHub = window.location.hostname.includes("vercel.app") || window.location.hostname.includes("localhost");
const isThomsonReuters = window.location.hostname.includes("thomsonreuters.com") || window.location.hostname.includes("onvio.com.br") || window.location.hostname.includes("dominioatendimento.com.br");

if (isWorkforceHub) {
    console.log("RPA Assistant: Loaded on Workforce Hub");
    // Listen for the custom DOM event triggered by our page button
    document.addEventListener("workforceRpaCapture", (event) => {
        const employeeData = event.detail;
        if (employeeData) {
            try {
                if (!chrome.runtime || !chrome.runtime.id) {
                    console.warn("RPA Assistant: Context invalidated. Please reload the page.");
                    return;
                }
                chrome.storage.local.set({ activeEmployee: employeeData }, () => {
                    console.log("RPA Assistant: Employee data captured successfully:", employeeData);
                    // Dispatch response event back to the webpage to notify user
                    document.dispatchEvent(new CustomEvent("workforceRpaCaptureSuccess", {
                        detail: { name: employeeData.name }
                    }));
                });
            } catch (e) {
                console.warn("RPA Assistant: Extension context invalidated, catch triggered. Please reload the page.", e);
            }
        }
    });
}

if (isThomsonReuters) {
    console.log("RPA Assistant: Loaded on Thomson Reuters Portal");
    
    // Inject the widget once the page is interactive
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            initAssistantWidget();
            runNavigationFlow(); // Run active navigation checks on load
        });
    } else {
        initAssistantWidget();
        runNavigationFlow(); // Run active navigation checks on load
    }
}

function initAssistantWidget() {
    // Avoid double injection
    if (document.getElementById("workforce-rpa-widget")) return;

    // Create widget container
    const widget = document.createElement("div");
    widget.id = "workforce-rpa-widget";
    widget.className = "workforce-rpa-collapsed";

    // Set inner HTML for widget
    widget.innerHTML = `
        <div id="rpa-widget-header">
            <span class="rpa-widget-title">🤖 Assistente Workforce Hub</span>
            <button id="rpa-widget-toggle-btn">▲</button>
        </div>
        <div id="rpa-widget-body" style="display: none;">
            <div id="rpa-employee-info">
                <p class="rpa-info-placeholder">Nenhum funcionário carregado. Abra a ficha no Workforce Hub e clique em "Preencher na Thomson Reuters".</p>
            </div>
            <div id="rpa-actions-container" style="display: none; display: flex; flex-direction: column; gap: 8px;">
                <button id="rpa-nav-btn" class="rpa-btn-primary">🚀 Iniciar Fluxo Completo</button>
                <button id="rpa-fill-btn" class="rpa-btn-secondary">⚡ Apenas Preencher Campos</button>
                <div class="rpa-fields-list">
                    <span class="rpa-field-tag" data-field="name">Nome</span>
                    <span class="rpa-field-tag" data-field="cpf">CPF</span>
                    <span class="rpa-field-tag" data-field="birthDate">Nascimento</span>
                    <span class="rpa-field-tag" data-field="gender">Gênero</span>
                    <span class="rpa-field-tag" data-field="phone">Telefone</span>
                    <span class="rpa-field-tag" data-field="email">E-mail</span>
                    <span class="rpa-field-tag" data-field="address">Endereço</span>
                    <span class="rpa-field-tag" data-field="role">Cargo</span>
                    <span class="rpa-field-tag" data-field="salary">Salário</span>
                    <span class="rpa-field-tag" data-field="startDate">Admissão</span>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(widget);

    // Load initial data immediately
    updateEmployeeInfoInWidget();

    // Event listeners for toggle collapse/expand
    const header = document.getElementById("rpa-widget-header");
    const body = document.getElementById("rpa-widget-body");
    const toggleBtn = document.getElementById("rpa-widget-toggle-btn");

    header.addEventListener("click", () => {
        if (widget.classList.contains("workforce-rpa-collapsed")) {
            widget.classList.remove("workforce-rpa-collapsed");
            widget.classList.add("workforce-rpa-expanded");
            body.style.display = "block";
            toggleBtn.innerText = "▼";
            // Check storage for loaded employee
            updateEmployeeInfoInWidget();
        } else {
            widget.classList.remove("workforce-rpa-expanded");
            widget.classList.add("workforce-rpa-collapsed");
            body.style.display = "none";
            toggleBtn.innerText = "▲";
        }
    });

    // Handle fill button click
    const fillBtn = document.getElementById("rpa-fill-btn");
    fillBtn.addEventListener("click", () => {
        chrome.storage.local.get("activeEmployee", (data) => {
            if (data && data.activeEmployee) {
                fillFormSemantically(data.activeEmployee);
            }
        });
    });

    // Handle full navigation flow button click
    const navBtn = document.getElementById("rpa-nav-btn");
    navBtn.addEventListener("click", () => {
        chrome.storage.local.set({ rpaStatus: "START_FLOW" }, () => {
            runNavigationFlow();
        });
    });

    // Handle individual tag drags/clicks to fill manually if needed
    const tags = document.querySelectorAll(".rpa-field-tag");
    tags.forEach(tag => {
        tag.addEventListener("click", (e) => {
            const field = e.target.getAttribute("data-field");
            chrome.storage.local.get("activeEmployee", (data) => {
                if (data && data.activeEmployee) {
                    const value = data.activeEmployee[field];
                    if (value) {
                        alert(`Clique no campo da página onde deseja colar o valor: "${value}". Depois, clique com o botão direito e selecione colar, ou use Ctrl+V. (Os dados foram copiados para a sua área de transferência!).`);
                        navigator.clipboard.writeText(value);
                    }
                }
            });
        });
    });
}

function updateEmployeeInfoInWidget() {
    const infoContainer = document.getElementById("rpa-employee-info");
    const actionsContainer = document.getElementById("rpa-actions-container");

    chrome.storage.local.get("activeEmployee", (data) => {
        if (data && data.activeEmployee) {
            const emp = data.activeEmployee;
            infoContainer.innerHTML = `
                <div class="rpa-employee-card">
                    <strong>👤 ${emp.name}</strong>
                    <div class="rpa-card-grid">
                        <span><strong>CPF:</strong> ${emp.cpf || '-'}</span>
                        <span><strong>Nascimento:</strong> ${emp.birthDate || '-'}</span>
                        <span><strong>Gênero:</strong> ${emp.gender || '-'}</span>
                        <span><strong>Telefone:</strong> ${emp.phone || '-'}</span>
                        <span><strong>E-mail:</strong> ${emp.email || '-'}</span>
                        <span><strong>Endereço:</strong> ${emp.address || '-'}</span>
                        <span><strong>Cargo:</strong> ${emp.role || '-'}</span>
                        <span><strong>Salário:</strong> R$ ${emp.salary || '-'}</span>
                        <span><strong>Admissão:</strong> ${emp.startDate || '-'}</span>
                    </div>
                </div>
            `;
            actionsContainer.style.display = "block";
        } else {
            infoContainer.innerHTML = `
                <p class="rpa-info-placeholder">Nenhum funcionário carregado. Abra a ficha no Workforce Hub e clique em "Preencher na Thomson Reuters".</p>
            `;
            actionsContainer.style.display = "none";
        }
    });
}

// Semantic Autofill engine for multi-tab Onvio wizard
async function fillFormSemantically(employee) {
    console.log("RPA: Starting multi-tab semantic form filling...");
    showFloatingNotification("Iniciando preenchimento sequencial...");

    // --- ETAPA 1: DADOS BÁSICOS ---
    const nomeInput = findInputBySemanticLabels(["nome"]);
    if (nomeInput && nomeInput.offsetParent !== null) {
        console.log("RPA: Filling Tab 1 (Dados Básicos)...");
        showFloatingNotification("Preenchendo: Dados Básicos...");

        const tab1TextFields = [
            { labels: ["cpf"], value: employee.cpf },
            { labels: ["nome"], value: employee.name }
        ];
        
        tab1TextFields.forEach(map => {
            if (!map.value) return;
            const input = findInputBySemanticLabels(map.labels);
            if (input) {
                input.focus();
                input.value = map.value;
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
                input.blur();
            }
        });

        const tab1Dropdowns = [
            { label: "cargo", value: employee.role },
            { label: "servico", value: employee.company },
            { label: "departamento", value: "Geral" },
            { label: "centro de custo", value: "Geral" },
            { label: "sindicato", value: "Siemaco" }
        ];

        for (const drop of tab1Dropdowns) {
            if (drop.value) {
                await fillDropdownSemantically(drop.label, drop.value);
            }
        }

        console.log("RPA: Tab 1 complete. Navigating to Tab 2...");
        await clickNextTab("admissao");
        await new Promise(r => setTimeout(r, 1200)); // Wait for tab transitions
    }

    // --- ETAPA 2: ADMISSÃO ---
    const salarioInput = findInputBySemanticLabels(["salario"]);
    if (salarioInput && salarioInput.offsetParent !== null) {
        console.log("RPA: Filling Tab 2 (Admissão)...");
        showFloatingNotification("Preenchendo: Admissão...");

        // Toggle Buttons default (NÃO)
        await selectToggleButton("Professor", "NÃO");
        await selectToggleButton("Primeiro Emprego", "NÃO");

        // Dropdowns defaults
        await fillDropdownSemantically("categoria", "Mensalista");
        await fillDropdownSemantically("vinculo empregaticio", "Celetista");

        // Date of Admission
        const dateInput = findInputBySemanticLabels(["data"]);
        if (dateInput) {
            dateInput.focus();
            dateInput.value = formatDateToInput(employee.startDate);
            dateInput.dispatchEvent(new Event("input", { bubbles: true }));
            dateInput.dispatchEvent(new Event("change", { bubbles: true }));
            dateInput.blur();
        }

        // Salary
        if (salarioInput) {
            salarioInput.focus();
            const cleanSalary = (employee.salary || "").replace(/[^0-9]/g, "");
            salarioInput.value = cleanSalary;
            salarioInput.dispatchEvent(new Event("input", { bubbles: true }));
            salarioInput.dispatchEvent(new Event("change", { bubbles: true }));
            salarioInput.blur();
        }

        console.log("RPA: Tab 2 complete. Navigating to Tab 3...");
        await clickNextTab("contrato de experiencia");
        await new Promise(r => setTimeout(r, 1200)); // Wait for tab transitions
    }

    // --- ETAPA 3: CONTRATO DE EXPERIÊNCIA ---
    const expInput = findInputBySemanticLabels(["contrato de experiencia"]);
    if (expInput && expInput.offsetParent !== null) {
        console.log("RPA: Filling Tab 3 (Contrato de Experiência)...");
        showFloatingNotification("Preenchendo: Contrato de Experiência...");

        // Fill Contrato de Experiência (45)
        expInput.focus();
        expInput.value = "45";
        expInput.dispatchEvent(new Event("input", { bubbles: true }));
        expInput.dispatchEvent(new Event("change", { bubbles: true }));
        expInput.blur();

        // Fill Dias de Prorrogação (45)
        const prorrInput = findInputBySemanticLabels(["dias de prorrogacao"]);
        if (prorrInput) {
            prorrInput.focus();
            prorrInput.value = "45";
            prorrInput.dispatchEvent(new Event("input", { bubbles: true }));
            prorrInput.dispatchEvent(new Event("change", { bubbles: true }));
            prorrInput.blur();
        }

        showFloatingNotification("🚀 Preenchimento completo concluído com sucesso!");
    }
}



function findInputBySemanticLabels(labelsList) {
    for (const labelText of labelsList) {
        const term = labelText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // 1. Try finding input using HTML <label> matching
        const labelElements = Array.from(document.querySelectorAll("label"));
        for (const lbl of labelElements) {
            const lblText = lbl.innerText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (lblText.includes(term)) {
                if (lbl.htmlFor) {
                    const input = document.getElementById(lbl.htmlFor);
                    if (input && (input.tagName === "INPUT" || input.tagName === "SELECT" || input.tagName === "TEXTAREA")) {
                        return input;
                    }
                }
                const nestedInput = lbl.querySelector("input, select, textarea");
                if (nestedInput) return nestedInput;

                // Check nearest sibling inputs inside the parent element
                const parent = lbl.parentElement;
                if (parent) {
                    const siblingInput = parent.querySelector("input, select, textarea");
                    if (siblingInput) return siblingInput;
                }
            }
        }

        // 2. Try finding text divs, spans, or labels near inputs
        const elements = Array.from(document.querySelectorAll("span, div, p, label, th, td"));
        for (const el of elements) {
            if (el.children.length === 0 || (el.children.length === 1 && el.firstElementChild.tagName === "SPAN")) {
                const elText = el.innerText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (elText === term || (elText.length > 2 && elText.includes(term))) {
                    let current = el;
                    for (let depth = 0; depth < 3; depth++) {
                        if (!current) break;
                        const input = current.querySelector("input, select, textarea");
                        if (input && input !== el) return input;
                        
                        // Check immediate next siblings
                        let sib = current.nextElementSibling;
                        while (sib) {
                            const sibInput = sib.querySelector("input, select, textarea") || (sib.tagName === "INPUT" || sib.tagName === "SELECT" ? sib : null);
                            if (sibInput) return sibInput;
                            sib = sib.nextElementSibling;
                        }
                        current = current.parentElement;
                    }
                }
            }
        }
    }
    return null;
}

function showFloatingNotification(msg) {
    const toast = document.createElement("div");
    toast.className = "workforce-rpa-toast";
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "1";
    }, 100);
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// Listen for storage changes to update the widget reactively in all tabs
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.activeEmployee) {
        console.log("RPA Assistant: Storage changed, updating widget info...");
        updateEmployeeInfoInWidget();
    }
});

// Dicionário de Sinônimos de Cargos (Tradução Workforce Hub -> Onvio)
const ROLE_SYNONYMS = {
    "auxiliar de limpeza": "servente de limpeza",
    "auxiliar limpeza": "servente de limpeza",
    "lider de limpeza": "encarregado de limpeza",
    "lider limpeza": "encarregado de limpeza",
    "porteiro": "vigia",
    "portaria": "vigia"
};

// Advanced semantic dropdown filling helper
async function fillDropdownSemantically(labelText, valueToSelect) {
    const inputOrSelect = findInputBySemanticLabels([labelText]);
    if (!inputOrSelect) return false;

    // Normalize value and check for synonyms
    const normalizedInput = valueToSelect.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let searchVal = valueToSelect;
    if (labelText.toLowerCase().includes("cargo") || labelText.toLowerCase().includes("funcao")) {
        if (ROLE_SYNONYMS[normalizedInput]) {
            searchVal = ROLE_SYNONYMS[normalizedInput];
            console.log(`RPA: Traduzindo cargo "${valueToSelect}" para sinônimo contábil "${searchVal}"`);
        }
    }

    // Case 1: Standard HTML <select> tag
    if (inputOrSelect.tagName === "SELECT") {
        const options = Array.from(inputOrSelect.options);
        const match = options.find(o => 
            o.text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(
                searchVal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            )
        );
        if (match) {
            inputOrSelect.value = match.value;
            inputOrSelect.dispatchEvent(new Event("change", { bubbles: true }));
            inputOrSelect.dispatchEvent(new Event("input", { bubbles: true }));
            return true;
        }
        return false;
    }

    // Case 2: Custom dropdown component (clicks to expand, types search, clicks option)
    try {
        inputOrSelect.focus();
        inputOrSelect.click();
        
        // Wait for list to open
        await new Promise(resolve => setTimeout(resolve, 350));

        // Type value if it is an input field (to filter options)
        if (inputOrSelect.tagName === "INPUT" && !inputOrSelect.readOnly) {
            inputOrSelect.value = searchVal;
            inputOrSelect.dispatchEvent(new Event("input", { bubbles: true }));
            inputOrSelect.dispatchEvent(new Event("change", { bubbles: true }));
            // Trigger keydown/keyup events in case the framework requires them
            inputOrSelect.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }));
            inputOrSelect.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a" }));
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait slightly longer for AJAX results
        }

        let term = searchVal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Find visible matching option elements (checking common option tags and inner texts)
        let listItems = Array.from(document.querySelectorAll("li, [role='option'], .dropdown-item, .select-option, .option, a, div, span"));
        let match = listItems.find(el => {
            if (el.children.length > 1 && !el.classList.contains("dropdown-item")) return false; 
            const text = el.innerText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return text.includes(term) && el.offsetParent !== null; // Visible
        });

        // Fallback: If exact term option is not found, try keyword approximation (e.g. matching last word "limpeza")
        if (!match && term.includes(" ")) {
            const words = term.split(" ").filter(w => w.length > 3);
            const keyword = words[words.length - 1]; // e.g. "limpeza"
            if (keyword) {
                console.log(`RPA: Cargo exato não encontrado. Tentando aproximação por palavra-chave: "${keyword}"`);
                match = listItems.find(el => {
                    if (el.children.length > 1 && !el.classList.contains("dropdown-item")) return false;
                    const text = el.innerText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return text.includes(keyword) && el.offsetParent !== null;
                });
            }
        }

        if (match) {
            match.click();
            match.dispatchEvent(new Event("change", { bubbles: true }));
            inputOrSelect.blur();
            console.log(`RPA: Selecionado com sucesso no dropdown: "${match.innerText}"`);
            return true;
        }
    } catch (err) {
        console.error("RPA: Dropdown filling failed:", err);
    }
    return false;
}

// --- AUTOMATED NAVIGATION FLOW ENGINE ---

function findCompanySelectorTrigger() {
    const divs = Array.from(document.querySelectorAll("div, span, button, a"));
    return divs.find(d => {
        const text = d.innerText.toUpperCase();
        return text.includes("EMPRESA") && d.offsetParent !== null;
    });
}

function findCurrentSelectedCompanyElement() {
    const divs = Array.from(document.querySelectorAll("div, span"));
    return divs.find(d => {
        const parent = d.parentElement;
        const parentText = parent ? parent.innerText.toUpperCase() : "";
        return parentText.includes("EMPRESA") && !d.innerText.toUpperCase().includes("EMPRESA") && d.innerText.length > 2 && d.offsetParent !== null;
    });
}

async function runNavigationFlow() {
    chrome.storage.local.get(["activeEmployee", "rpaStatus"], async (data) => {
        if (!data || !data.activeEmployee || !data.rpaStatus || data.rpaStatus === "IDLE") return;

        const emp = data.activeEmployee;
        const status = data.rpaStatus;

        console.log(`RPA Flow: Running step -> "${status}" for employee "${emp.name}" (Company: "${emp.company}")`);

        // STEP 1: Select/Switch Company
        if (status === "START_FLOW") {
            const currentCompanyEl = findCurrentSelectedCompanyElement();
            const currentCompanyText = currentCompanyEl ? currentCompanyEl.innerText.toLowerCase() : "";
            
            // Clean target company name to make match flexible (e.g. "JVS FACILITIES" matches "JVS FACILITIES LTDA")
            const targetCompanyClean = (emp.company || "").toLowerCase()
                .replace(" ltda", "")
                .replace(" s.a.", "")
                .replace(" sa", "")
                .trim();

            if (targetCompanyClean && currentCompanyText.includes(targetCompanyClean)) {
                console.log("RPA Flow: Correct company already selected. Proceeding to navigation...");
                chrome.storage.local.set({ rpaStatus: "NAVIGATING_MENU" }, () => {
                    runNavigationFlow();
                });
            } else {
                console.log(`RPA Flow: Switching company from "${currentCompanyText}" to "${emp.company}"...`);
                const trigger = findCompanySelectorTrigger();
                if (trigger) {
                    trigger.click();
                    await new Promise(r => setTimeout(r, 450));
                    
                    // Search box in the open menu
                    const searchInput = document.querySelector("input[placeholder*='Pesquisar'], input[placeholder*='empresa'], input[type='search']");
                    if (searchInput) {
                        searchInput.value = emp.company || "";
                        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
                        searchInput.dispatchEvent(new Event("change", { bubbles: true }));
                        await new Promise(r => setTimeout(r, 400));
                    }
                    
                    // Find option from list
                    const listItems = Array.from(document.querySelectorAll("li, [role='option'], .dropdown-item, .company-item, span, a, div"));
                    const match = listItems.find(el => {
                        if (el.children.length > 1) return false;
                        const text = el.innerText.toLowerCase();
                        return text.includes(targetCompanyClean) && el.offsetParent !== null;
                    });

                    if (match) {
                        chrome.storage.local.set({ rpaStatus: "NAVIGATING_MENU" }, () => {
                            match.click();
                            // Page will automatically reload with the new company session
                        });
                    } else {
                        alert(`RPA Flow: Não conseguimos selecionar a empresa "${emp.company}" automaticamente. Por favor, selecione-a no canto superior esquerdo para continuar.`);
                        chrome.storage.local.set({ rpaStatus: "IDLE" });
                    }
                } else {
                    console.error("RPA Flow: Could not find company selector element");
                }
            }
        } 
        
        // STEP 2: Navigate left menu
        else if (status === "NAVIGATING_MENU") {
            const menuItems = Array.from(document.querySelectorAll("span, a, div, li"));
            
            // 1. Find "Solicitação de Serviço"
            const serviceRequestMenu = menuItems.find(el => {
                const text = el.innerText.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return text === "solicitacao de servico" && el.offsetParent !== null;
            });

            if (serviceRequestMenu) {
                // Click to expand parent menu if collapsed
                serviceRequestMenu.click();
                await new Promise(r => setTimeout(r, 400));

                // 2. Find and click "Cadastro de Empregado"
                const submenuItems = Array.from(document.querySelectorAll("span, a, div, li"));
                const employeeMenu = submenuItems.find(el => {
                    const text = el.innerText.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return text === "cadastro de empregado" && el.offsetParent !== null;
                });

                if (employeeMenu) {
                    chrome.storage.local.set({ rpaStatus: "OPENING_FORM" }, () => {
                        employeeMenu.click();
                        // Navigation will happen
                    });
                }
            }
        } 
        
        // STEP 3: Click Add ("Adicionar") button
        else if (status === "OPENING_FORM") {
            // Check if we are on list page
            if (window.location.pathname.endsWith("/employee-registration")) {
                const buttons = Array.from(document.querySelectorAll("button, a, span"));
                const addButton = buttons.find(b => {
                    const text = b.innerText.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return (text === "adicionar" || text.includes("adicionar")) && b.offsetParent !== null;
                });

                if (addButton) {
                    chrome.storage.local.set({ rpaStatus: "FILLING_FORM" }, () => {
                        addButton.click();
                        // Navigation to form will happen
                    });
                }
            } else if (window.location.pathname.endsWith("/employee-registration/add")) {
                chrome.storage.local.set({ rpaStatus: "FILLING_FORM" }, () => {
                    runNavigationFlow();
                });
            }
        } 
        
        // STEP 4: Fill the form
        else if (status === "FILLING_FORM") {
            if (window.location.pathname.endsWith("/employee-registration/add")) {
                chrome.storage.local.set({ rpaStatus: "IDLE" }, () => {
                    fillFormSemantically(emp);
                });
            }
        }
    });
}

// Helpers for multi-tab navigation and toggles
async function clickNextTab(tabName) {
    const term = tabName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // 1. Try to find the tab header by text
    const tabs = Array.from(document.querySelectorAll("span, a, div, li"));
    const match = tabs.find(el => {
        if (el.children.length > 1) return false;
        const text = el.innerText.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return text === term && el.offsetParent !== null;
    });

    if (match) {
        match.click();
        return true;
    }

    // 2. Fallback: Click the orange "PRÓXIMA" button
    const buttons = Array.from(document.querySelectorAll("button, span"));
    const nextBtn = buttons.find(b => b.innerText.trim().toUpperCase() === "PROXIMA" && b.offsetParent !== null);
    if (nextBtn) {
        nextBtn.click();
        return true;
    }
    return false;
}

async function selectToggleButton(labelText, optionText) {
    const term = labelText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const elements = Array.from(document.querySelectorAll("div, span, p, label"));
    const labelEl = elements.find(d => {
        if (d.children.length > 1) return false;
        const text = d.innerText.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return text === term && d.offsetParent !== null;
    });

    if (labelEl) {
        let current = labelEl;
        for (let depth = 0; depth < 3; depth++) {
            if (!current) break;
            const buttons = Array.from(current.querySelectorAll("button, span, div"));
            const match = buttons.find(b => b.innerText.trim().toUpperCase() === optionText.toUpperCase() && b.offsetParent !== null);
            if (match) {
                match.click();
                return true;
            }
            current = current.parentElement;
        }
    }
    return false;
}

function formatDateToInput(dateStr) {
    if (!dateStr) return "";
    if (dateStr.includes("-") && dateStr.split("-")[0].length === 4) {
        return dateStr;
    }
    if (dateStr.includes("/")) {
        const parts = dateStr.split("/");
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    return dateStr;
}
