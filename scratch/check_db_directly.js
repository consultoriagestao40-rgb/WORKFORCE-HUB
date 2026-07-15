const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const targetCpfs = [
    "04569743935", // Andreia
    "07890368941", // Elisangela
    "99732815949", // Elizabete
    "16102447964", // Fernanda
    "14611417964", // Gabriely
    "71133777260", // Genesis
    "02839422310", // Josineide
    "04855245976", // Luzia
    "00662317955", // Marly
    "09435277918", // Nizia
    "00887272460", // Sandra
    "70639206263"  // Zurima
];

async function main() {
    console.log("Conectando ao banco de dados...");
    const allEmployees = await prisma.employee.findMany();

    console.log(`\nBuscando ${targetCpfs.length} CPFs na memória...`);
    
    targetCpfs.forEach(targetCpf => {
        const emp = allEmployees.find(e => {
            const cleanDbCpf = (e.cpf || "").replace(/\D/g, "").padStart(11, "0");
            return cleanDbCpf === targetCpf;
        });
        
        if (emp) {
            console.log(`- Localizado: ${emp.name}`);
            console.log(`  CPF no banco: "${emp.cpf}"`);
            console.log(`  Salário: ${emp.salary}`);
            console.log(`  VA: ${emp.valeAlimentacao}`);
            console.log(`  VT: ${emp.valeTransporte}`);
        } else {
            console.log(`- NÃO LOCALIZADO CPF: ${targetCpf}`);
        }
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
