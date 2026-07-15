const XLSX = require("xlsx");
const path = require("path");

const wb = XLSX.readFile(path.join(__dirname, "../colaboradores.csv"));
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

const normalize = (str) => 
    String(str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

const headers = data[0].map(h => normalize(h));
console.log("Headers normalizados:", headers);

const idx = {
    name: headers.indexOf("nome"),
    cpf: headers.indexOf("cpf"),
    salary: headers.findIndex(h => h.includes("salario") || h === "salario base"),
    insalubridade: headers.indexOf("insalubridade"),
    periculosidade: headers.indexOf("periculosidade"),
    gratificacao: headers.findIndex(h => h.includes("gratificacao")),
    outrosAdicionais: headers.findIndex(h => h.includes("outros adicionais")),
    valeAlimentacao: headers.findIndex(h => h.includes("vale alimentacao") || h.includes("va")),
    valeTransporte: headers.findIndex(h => h.includes("vale trans") || h.includes("vt"))
};

console.log("Mapeamento de Índices:", idx);

const parseVal = (val) => {
    if (!val) return 0;
    const str = String(val).trim();
    if (str.includes(',')) {
        return parseFloat(str.replace(/[^\d,-]/g, '').replace(',', '.'));
    }
    return parseFloat(str.replace(/[^\d.]/g, '')) || 0;
};

for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[idx.name] && row[idx.name].includes("ANTONIO APARECIDO")) {
        console.log(`\nColaborador: ${row[idx.name]}`);
        console.log(`Raw Salary (index ${idx.salary}): "${row[idx.salary]}"`);
        console.log(`Parsed Salary: ${parseVal(row[idx.salary])}`);
    }
}
