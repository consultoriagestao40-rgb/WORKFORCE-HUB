const XLSX = require("xlsx");
const path = require("path");

const wb = XLSX.readFile(path.join(__dirname, "../colaboradores.csv"));
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] && row[0].includes("ALLAN HENRIQUE")) {
        console.log("Linha do Allan Henrique encontrada:");
        console.log(row);
        console.log("Valores das colunas relevantes:");
        row.forEach((cell, index) => {
            console.log(`Index ${index}: "${cell}" (tipo: ${typeof cell})`);
        });
    }
}
