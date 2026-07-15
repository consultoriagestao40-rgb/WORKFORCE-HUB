const XLSX = require("xlsx");
const path = require("path");

const wb = XLSX.readFile(path.join(__dirname, "../colaboradores.csv"));
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

const cleanHeader = (str) => 
    String(str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "") // Remove all non-alphanumeric characters
        .trim();

const headers = data[0].map(h => cleanHeader(h));
console.log("Headers limpos e normalizados:", headers);

const idx = {
    name: headers.indexOf("nome"),
    cpf: headers.indexOf("cpf"),
    salary: headers.findIndex(h => h.includes("salari")),
    insalubridade: headers.findIndex(h => h.includes("insalub")),
    periculosidade: headers.findIndex(h => h.includes("pericul")),
    gratificacao: headers.findIndex(h => h.includes("gratif")),
    outrosAdicionais: headers.findIndex(h => h.includes("outro")),
    valeAlimentacao: headers.findIndex(h => h.includes("aliment") || h === "va"),
    valeTransporte: headers.findIndex(h => h.includes("trans") || h === "vt")
};

console.log("Mapeamento de Índices Corrigido:", idx);
