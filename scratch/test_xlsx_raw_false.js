const XLSX = require("xlsx");
const path = require("path");

const wb = XLSX.readFile(path.join(__dirname, "../colaboradores.csv"));
const ws = wb.Sheets[wb.SheetNames[0]];

// Call sheet_to_json with raw: false
const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] && row[0].includes("ALLAN HENRIQUE")) {
        console.log("ALLAN HENRIQUE (raw: false):");
        console.log(`Index 18 (VA): "${row[18]}" (tipo: ${typeof row[18]})`);
    }
    if (row[0] && row[0].includes("ADRIANA CRISTINA DA SILVA")) {
        console.log("ADRIANA CRISTINA (raw: false):");
        console.log(`Index 13 (Insalubridade): "${row[13]}" (tipo: ${typeof row[13]})`);
    }
}
