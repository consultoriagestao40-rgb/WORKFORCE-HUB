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
        .replace(/[^a-z0-9]/g, "")
        .trim();

const headers = data[0].map(h => cleanHeader(h));
const idx = {
    name: headers.indexOf("nome"),
    cpf: headers.indexOf("cpf"),
    salary: headers.findIndex(h => h.includes("salari")),
    valeAlimentacao: headers.findIndex(h => h.includes("aliment") || h === "va"),
    valeTransporte: headers.findIndex(h => h.includes("trans") || h === "vt")
};

console.log("Mapeamento de índices:", idx);

const targetNames = [
    "ANDREIA FAUSTIN DE SOUZA",
    "ELISANGELA SANTOS DE PAULA",
    "ELIZABETE BRUM ANTONIO",
    "FERNANDA STIIRMER DE MATTOS YAMAGUCHI",
    "GABRIELY BRASQUE ALVES PEREIRA",
    "GENESIS GABRIELA MARTINEZ GONZALEZ",
    "JOSINEIDE MARTINS VIDAL",
    "LUZIA CORDEIRO DE OLIVEIRA",
    "MARLY DALVA DE AZEVEDO",
    "NIZIA TASSIA DA SILVA",
    "SANDRA PEREIRA MOREIRA",
    "ZURIMA ROXANA LEON GARCIA"
];

for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const name = String(row[idx.name] || "").trim();
    const matchedTarget = targetNames.find(t => name.toUpperCase().includes(t.toUpperCase()));
    if (matchedTarget) {
        console.log(`\nNome na planilha: "${name}"`);
        console.log(`CPF: "${row[idx.cpf]}"`);
        console.log(`Salário Base (index ${idx.salary}): "${row[idx.salary]}"`);
        console.log(`Vale Alimentação (index ${idx.valeAlimentacao}): "${row[idx.valeAlimentacao]}"`);
        console.log(`Vale Transporte (index ${idx.valeTransporte}): "${row[idx.valeTransporte]}"`);
    }
}
