require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("Iniciando atualizacao de dados da Urbs para Spot Facilities...");

    const data = [
        { name: "ADRIELE MARA RODRIGUES LISBOA", cpf: "04886358969", sic: "00117660503", cq: "65587546267149573" },
        { name: "ALDRYN FRANCINE ASSIS DE MIRANDA", cpf: "05010496909", sic: "00226759578", cq: "65586996469525509" },
        { name: "ALFREDO JOSE MARTINEZ GONZALEZ", cpf: "71133784208", sic: null, cq: "65587256423051013" },
        { name: "ANA MARIA FERNANDES", cpf: "87796147953", sic: "00284652453", cq: "65587401158845701" },
        { name: "ANDREA CRISTIANE RIBAS", cpf: "03408428905", sic: "00031293069", cq: "0003600411" },
        { name: "BRUNA CAMARGO RIBEIRO", cpf: "09038520980", sic: "00097358014", cq: "65588025903965445" },
        { name: "CARLOS ENRIQUE HERNANDEZ TOVAR", cpf: "60335537057", sic: null, cq: "65587397892597509" },
        { name: "CLEONICE REGINA DE OLIVEIRA", cpf: "82855382904", sic: "00050293764", cq: "65586999265157893" },
        { name: "CREUSA ANTONIO", cpf: "04773709936", sic: "00118604640", cq: "65588025912484613" },
        { name: "DEBORA ALVES DOS SANTOS", cpf: "85915513972", sic: "00111724795", cq: "65587123063254277" },
        { name: "EDGAR CEZAR DOS SANTOS PEREIRA", cpf: "00240715284", sic: null, cq: "65587397934409477" },
        { name: "ELICIANE APARECIDA FELIZ", cpf: "07248608947", sic: "00064599439", cq: "65587807795766533" },
        { name: "EVA CIRA CONCEICAO", cpf: "07156327950", sic: "00070403775", cq: "0003202044" },
        { name: "EVELIN GEOVANA DOS SANTOS SOUZA", cpf: "12793915963", sic: null, cq: "65588027520412933" },
        { name: "GILDA MARQUES", cpf: null, sic: "00138033104", cq: "0002274240" },
        { name: "GLORIA FERREIRA DOS SANTOS", cpf: "00542109506", sic: null, cq: "65588026807247365" },
        { name: "JEFFERSON FRANCISCO CAICEDO LATORRE", cpf: "00209776978", sic: null, cq: "65588024857618693" },
        { name: "JESUS RAMON JIMENEZ IDROGO", cpf: "70634862251", sic: null, cq: "65586999003606277" },
        { name: "JOANA DARK SANTOS DA CRUZ", cpf: "85910527576", sic: null, cq: "65586998200920325" },
        { name: "MAIRA ALEJANDRA GRATEROL", cpf: "11312709243", sic: null, cq: null },
        { name: "MARIA DO SOCORRO DA SILVA OLIVEIRA", cpf: null, sic: null, cq: null },
        { name: "MARIA EDUARDA GUIMARAES", cpf: null, sic: null, cq: null }
    ];

    const allEmployees = await prisma.employee.findMany({
        include: {
            company: true
        }
    });

    console.log(`Buscados ${allEmployees.length} colaboradores do banco de dados.`);

    const matchedIds = new Set();

    const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const isNameSimilar = (name1, name2) => {
        const n1 = normalize(name1);
        const n2 = normalize(name2);
        if (n1 === n2) return true;

        const words1 = n1.split(/\s+/);
        const words2 = n2.split(/\s+/);

        if (words1[0] === words2[0]) {
            const intersection = words1.filter(w => words2.some(w2 => w2.startsWith(w) || w.startsWith(w2)));
            if (intersection.length >= 2) {
                return true;
            }
        }
        return false;
    };

    for (const item of data) {
        let employee = null;

        if (item.cpf) {
            const cleanInputCpf = item.cpf.replace(/\D/g, "");
            employee = allEmployees.find(e => e.cpf.replace(/\D/g, "") === cleanInputCpf);
        }

        if (!employee) {
            employee = allEmployees.find(e => isNameSimilar(e.name, item.name));
        }

        if (employee) {
            matchedIds.add(employee.id);
            await prisma.employee.update({
                where: { id: employee.id },
                data: {
                    urbsSic: item.sic || employee.urbsSic,
                    urbsCqCtNf: item.cq || employee.urbsCqCtNf,
                    vtPaymentMethod: "Urbs"
                }
            });
            console.log(`ATUALIZADO: ${item.name} -> DB: ${employee.name} (SIC: ${item.sic}, CQ: ${item.cq})`);
        } else {
            console.log(`ATENCAO: Colaborador nao encontrado: ${item.name}`);
        }
    }

    // Clean up incorrect Devanildo updates
    const spotEmployeesToReset = allEmployees.filter(e => 
        e.company?.name.toLowerCase().includes("spot") && 
        !matchedIds.has(e.id) && 
        e.vtPaymentMethod === "Urbs"
    );

    for (const emp of spotEmployeesToReset) {
        await prisma.employee.update({
            where: { id: emp.id },
            data: {
                urbsSic: null,
                urbsCqCtNf: null,
                vtPaymentMethod: "Metrocard Metropolitana"
            }
        });
        console.log(`REVERTIDO PARA METROCARD: ${emp.name}`);
    }

    console.log("Concluido!");
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
