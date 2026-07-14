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
        document.addEventListener("DOMContentLoaded", initAssistantWidget);
    } else {
        initAssistantWidget();
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
            <div id="rpa-actions-container" style="display: none;">
                <button id="rpa-fill-btn">⚡ Preencher Formulario Automático</button>
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

// Semantic Autofill engine
async function fillFormSemantically(employee) {
    console.log("RPA: Starting semantic form filling for", employee.name);
    showFloatingNotification("Preenchendo formulário...");

    const textFields = [
        { labels: ["cpf", "cadastro de pessoa", "pessoa fisica"], value: employee.cpf },
        { labels: ["nome", "completo", "razao social", "funcionario", "empregado"], value: employee.name },
        { labels: ["salario", "remuneracao", "valor", "base"], value: employee.salary },
        { labels: ["admissao", "data de admissao", "inicio", "data de inicio", "contratacao"], value: employee.startDate },
        { labels: ["nascimento", "data de nascimento", "nascido"], value: employee.birthDate },
        { labels: ["endereco", "logradouro", "residencia"], value: employee.address },
        { labels: ["telefone", "celular", "fone"], value: employee.phone },
        { labels: ["email", "e-mail", "correio eletronico"], value: employee.email }
    ];

    const dropdownFields = [
        { label: "cargo", value: employee.role },
        { label: "funcao", value: employee.role },
        { label: "genero", value: employee.gender }
    ];

    let filledCount = 0;

    // 1. Fill standard text fields
    textFields.forEach(map => {
        if (!map.value) return;
        const input = findInputBySemanticLabels(map.labels);
        if (input) {
            input.focus();
            input.value = map.value;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.blur();
            filledCount++;
            console.log(`RPA: Filled text field [${map.labels[0]}] with: ${map.value}`);
        }
    });

    // 2. Fill custom dropdown select fields sequentially
    for (const drop of dropdownFields) {
        if (!drop.value) continue;
        try {
            const success = await fillDropdownSemantically(drop.label, drop.value);
            if (success) {
                filledCount++;
            }
        } catch (e) {
            console.error(`RPA: Failed to fill dropdown for ${drop.label}:`, e);
        }
    }

    if (filledCount > 0) {
        showFloatingNotification(`Preenchidos ${filledCount} campos automaticamente!`);
    } else {
        alert("Nenhum campo correspondente foi encontrado na tela. Certifique-se de que você está na página de cadastro de admissão da Thomson Reuters contabilidade.");
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

// Advanced semantic dropdown filling helper
async function fillDropdownSemantically(labelText, valueToSelect) {
    const inputOrSelect = findInputBySemanticLabels([labelText]);
    if (!inputOrSelect) return false;

    // Case 1: Standard HTML <select> tag
    if (inputOrSelect.tagName === "SELECT") {
        const options = Array.from(inputOrSelect.options);
        const match = options.find(o => 
            o.text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(
                valueToSelect.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
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
        await new Promise(resolve => setTimeout(resolve, 250));

        // Type value if it is an input field (to filter options)
        if (inputOrSelect.tagName === "INPUT" && !inputOrSelect.readOnly) {
            inputOrSelect.value = valueToSelect;
            inputOrSelect.dispatchEvent(new Event("input", { bubbles: true }));
            inputOrSelect.dispatchEvent(new Event("change", { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 250));
        }

        const term = valueToSelect.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Find visible matching option elements
        const listItems = Array.from(document.querySelectorAll("li, [role='option'], .dropdown-item, .select-option, .option, a, div"));
        const match = listItems.find(el => {
            if (el.children.length > 1) return false; // Leaf nodes only
            const text = el.innerText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return text.includes(term) && el.offsetParent !== null; // Must be visible on screen
        });

        if (match) {
            match.click();
            match.dispatchEvent(new Event("change", { bubbles: true }));
            inputOrSelect.blur();
            return true;
        }
    } catch (err) {
        console.error("RPA: Dropdown filling failed:", err);
    }
    return false;
}
