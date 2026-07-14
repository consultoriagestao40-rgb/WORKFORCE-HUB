const XLSX = require("xlsx");
const path = require("path");

const wb = XLSX.readFile(path.join(__dirname, "../colaboradores.csv"));
const ws = wb.Sheets[wb.SheetNames[0]];

// Find the cell coordinates for Allan's VA (row index 11, column index 18 (S) in 0-indexed or 19 in 1-indexed)
// Let's find Allan's row first by looking at A cells
let rowNum = -1;
for (let r = 0; ; r++) {
    const cellRef = XLSX.utils.encode_cell({ r, c: 0 });
    if (!ws[cellRef]) break;
    if (ws[cellRef].v && ws[cellRef].v.includes("ALLAN HENRIQUE")) {
        rowNum = r;
        break;
    }
}

if (rowNum !== -1) {
    console.log(`Allan Henrique na linha: ${rowNum + 1}`);
    const vaCellRef = XLSX.utils.encode_cell({ r: rowNum, c: 18 }); // Column S
    console.log("Célula VA:", vaCellRef, ws[vaCellRef]);
} else {
    console.log("Allan Henrique não encontrado");
}
