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
            { name: "JOANA DARK SANTOS DA CRUZ", cpf: "85910527576", sic: null, cq: "65586998200920325" },
            { name: "MAIRA ALEJANDRA GRATEROL", cpf: "11312709243", sic: null, cq: null },
            { name: "MARIA DO SOCORRO DA SILVA OLIVEIRA", cpf: "00000000001", sic: "00265448228", cq: null },
            { name: "MARIA EDUARDA GUIMARAES", cpf: "00000000002", sic: null, cq: null }
        ];

        // Find Spot company
        const spotCompany = await prisma.company.findFirst({
            where: { name: { contains: "Spot", mode: "insensitive" } }
        });
        
        // Find default role
        const defaultRole = await prisma.role.findFirst({
            where: { name: { contains: "Limpeza", mode: "insensitive" } }
        }) || await prisma.role.findFirst();

        const companyId = spotCompany?.id || null;
        const roleId = defaultRole?.id || "";

        const allEmployees = await prisma.employee.findMany({
            include: {
                company: true
            }
        });

        const results = [];
        const matchedIds = new Set<string>();

        // Normalize string helper
        const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        // Helper to check name similarity
        const isNameSimilar = (name1: string, name2: string) => {
            const n1 = normalize(name1);
            const n2 = normalize(name2);
            if (n1 === n2) return true;

            const exclude = ["de", "da", "do", "dos", "das", "e"];
            const words1 = n1.split(/\s+/).filter(w => !exclude.includes(w));
            const words2 = n2.split(/\s+/).filter(w => !exclude.includes(w));

            if (words1[0] !== words2[0]) return false;

            const isWordSimilar = (w1: string, w2: string) => {
                if (w1 === w2) return true;
                if (w1.startsWith(w2.substring(0, 5)) || w2.startsWith(w1.substring(0, 5))) {
                    return true;
                }
                return false;
            };

            const matches = words1.filter(w1 => words2.some(w2 => isWordSimilar(w1, w2)));
            const ratio = matches.length / Math.min(words1.length, words2.length);
            return ratio >= 0.7;
        };

        const formatCpf = (cpf: string) => {
            const clean = cpf.replace(/\D/g, "");
            if (clean.length !== 11) return cpf;
            return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9, 11)}`;
        };

        for (const item of data) {
            let employee = null;

            // Find by CPF first (clean digits)
            if (item.cpf && item.cpf !== "00000000001" && item.cpf !== "00000000002") {
                const cleanInputCpf = item.cpf.replace(/\D/g, "");
                employee = allEmployees.find(e => e.cpf.replace(/\D/g, "") === cleanInputCpf);
            }

            // Find by Name similarity next
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
                results.push({ name: item.name, matchedDbName: employee.name, status: "updated", sic: item.sic, cq: item.cq });
            } else {
                // CREATE new employee if not found
                const newCpf = item.cpf ? formatCpf(item.cpf) : `000.000.000-${Math.floor(10 + Math.random() * 90)}`;
                const newEmp = await prisma.employee.create({
                    data: {
                        name: item.name.trim(),
                        cpf: newCpf,
                        companyId,
                        roleId,
                        status: "Ativo",
                        type: "CLT",
                        salary: 1418,
                        vtOptIn: true,
                        vtPaymentMethod: "Urbs",
                        urbsSic: item.sic,
                        urbsCqCtNf: item.cq
                    }
                });
                matchedIds.add(newEmp.id);
                results.push({ name: item.name, status: "created", cpf: newCpf, sic: item.sic, cq: item.cq });
            }
        }

        // 2. Clean up incorrect "Devanildo" style updates or mismatches
        const spotEmployeesToReset = allEmployees.filter(e => 
            e.company?.name.toLowerCase().includes("spot") && 
            !matchedIds.has(e.id) && 
            (e.vtPaymentMethod === "Urbs" || e.urbsSic !== null || e.urbsCqCtNf !== null)
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
            results.push({ name: emp.name, status: "reverted_to_metrocard" });
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
