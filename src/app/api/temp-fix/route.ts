import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
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
            { name: "JOANA DARK SANTOS DA CRUZ", cpf: "85910527576", sic: null, cq: "65586998200920325" }
        ];

        const results = [];
        
        for (const item of data) {
            let employee = null;
            
            if (item.cpf) {
                const cleanCpf = item.cpf.replace(/\D/g, "");
                employee = await prisma.employee.findFirst({
                    where: {
                        cpf: {
                            contains: cleanCpf
                        }
                    }
                });
            }
            
            if (!employee) {
                // Try searching by name match (case insensitive)
                const firstName = item.name.split(" ")[0];
                employee = await prisma.employee.findFirst({
                    where: {
                        name: {
                            contains: firstName,
                            mode: "insensitive"
                        }
                    }
                });
            }
            
            if (employee) {
                await prisma.employee.update({
                    where: { id: employee.id },
                    data: {
                        urbsSic: item.sic || employee.urbsSic,
                        urbsCqCtNf: item.cq || employee.urbsCqCtNf,
                        vtPaymentMethod: "Urbs"
                    }
                });
                results.push({ name: item.name, status: "updated", sic: item.sic, cq: item.cq });
            } else {
                results.push({ name: item.name, status: "not_found" });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
