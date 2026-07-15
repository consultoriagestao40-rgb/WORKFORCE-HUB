const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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

async function main() {
    console.log("Conectando ao banco de dados...");
    const allEmployees = await prisma.employee.findMany();

    console.log(`\nBuscando ${targetNames.length} nomes na base de dados...`);
    
    targetNames.forEach(targetName => {
        const matches = allEmployees.filter(e => 
            e.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(
                targetName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            )
        );
        
        if (matches.length > 0) {
            matches.forEach(emp => {
                console.log(`- Localizado por Nome: "${emp.name}"`);
                console.log(`  CPF no banco: "${emp.cpf}"`);
                console.log(`  Salário: ${emp.salary}`);
                console.log(`  VA: ${emp.valeAlimentacao}`);
                console.log(`  VT: ${emp.valeTransporte}`);
            });
        } else {
            console.log(`- NÃO LOCALIZADO NOME: "${targetName}"`);
        }
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
