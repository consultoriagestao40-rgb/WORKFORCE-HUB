"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";

export interface EpiItemInput {
    name: string;
    type: string; // "EPI" | "UNIFORME"
    caNumber?: string | null;
    unit: string;
    stockQuantity: number;
    minStockQuantity: number;
    size?: string | null;
}

export interface EpiDeliveryInput {
    employeeId: string;
    epiItemId: string;
    quantity: number;
    deliveryDate: string;
    merCode: number;
    notes?: string | null;
}

export async function getEpiItems() {
    try {
        return await prisma.epiItem.findMany({
            orderBy: { name: "asc" }
        });
    } catch (e: any) {
        console.error("Error fetching EPI items:", e);
        throw new Error(e.message || "Erro ao buscar itens de EPI/Uniforme.");
    }
}

export async function createEpiItem(input: EpiItemInput) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");

        const newItem = await prisma.epiItem.create({
            data: {
                name: input.name,
                type: input.type,
                caNumber: input.caNumber || null,
                unit: input.unit || "unidade",
                stockQuantity: input.stockQuantity || 0,
                minStockQuantity: input.minStockQuantity || 0,
                size: input.size || null
            }
        });

        revalidatePath("/admin/disciplinary"); // generic revalidation
        return newItem;
    } catch (e: any) {
        console.error("Error creating EPI item:", e);
        throw new Error(e.message || "Erro ao cadastrar item de EPI/Uniforme.");
    }
}

export async function updateEpiItem(id: string, input: Partial<EpiItemInput>) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");

        const updated = await prisma.epiItem.update({
            where: { id },
            data: {
                name: input.name,
                type: input.type,
                caNumber: input.caNumber !== undefined ? input.caNumber : undefined,
                unit: input.unit,
                stockQuantity: input.stockQuantity,
                minStockQuantity: input.minStockQuantity,
                size: input.size !== undefined ? input.size : undefined
            }
        });

        return updated;
    } catch (e: any) {
        console.error("Error updating EPI item:", e);
        throw new Error(e.message || "Erro ao atualizar item de EPI/Uniforme.");
    }
}

export async function deleteEpiItem(id: string) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");

        // Check if there are active deliveries linked to this item
        const count = await prisma.epiDelivery.count({
            where: { epiItemId: id }
        });

        if (count > 0) {
            throw new Error("Este item não pode ser excluído pois existem fichas de entrega vinculadas a ele.");
        }

        await prisma.epiItem.delete({
            where: { id }
        });

        return { success: true };
    } catch (e: any) {
        console.error("Error deleting EPI item:", e);
        throw new Error(e.message || "Erro ao excluir item de EPI/Uniforme.");
    }
}

export async function getEmployeeEpiDeliveries(employeeId: string) {
    try {
        return await prisma.epiDelivery.findMany({
            where: { employeeId },
            include: {
                epiItem: true,
                deliveredBy: {
                    select: { name: true }
                }
            },
            orderBy: { deliveryDate: "desc" }
        });
    } catch (e: any) {
        console.error("Error fetching employee deliveries:", e);
        throw new Error(e.message || "Erro ao carregar entregas do colaborador.");
    }
}

export async function createEpiDelivery(input: EpiDeliveryInput) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");

        // Validate stock
        const epiItem = await prisma.epiItem.findUnique({
            where: { id: input.epiItemId }
        });

        if (!epiItem) {
            throw new Error("Item de EPI/Uniforme não encontrado.");
        }

        if (epiItem.stockQuantity < input.quantity) {
            throw new Error(`Estoque insuficiente! Saldo atual: ${epiItem.stockQuantity} ${epiItem.unit}(s).`);
        }

        const delivery = await prisma.$transaction(async (tx) => {
            // Deduct stock
            await tx.epiItem.update({
                where: { id: input.epiItemId },
                data: {
                    stockQuantity: {
                        decrement: input.quantity
                    }
                }
            });

            // Create delivery log
            return await tx.epiDelivery.create({
                data: {
                    employeeId: input.employeeId,
                    epiItemId: input.epiItemId,
                    quantity: input.quantity,
                    deliveryDate: new Date(input.deliveryDate + "T12:00:00"),
                    merCode: input.merCode,
                    deliveredById: user.id,
                    notes: input.notes || null
                },
                include: {
                    epiItem: true
                }
            });
        });

        return delivery;
    } catch (e: any) {
        console.error("Error registering EPI delivery:", e);
        throw new Error(e.message || "Erro ao registrar entrega de EPI.");
    }
}

export async function deleteEpiDelivery(id: string) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");

        const delivery = await prisma.epiDelivery.findUnique({
            where: { id }
        });

        if (!delivery) {
            throw new Error("Registro de entrega não encontrado.");
        }

        await prisma.$transaction(async (tx) => {
            // Restore stock
            await tx.epiItem.update({
                where: { id: delivery.epiItemId },
                data: {
                    stockQuantity: {
                        increment: delivery.quantity
                    }
                }
            });

            // Delete delivery
            await tx.epiDelivery.delete({
                where: { id }
            });
        });

        return { success: true };
    } catch (e: any) {
        console.error("Error deleting EPI delivery:", e);
        throw new Error(e.message || "Erro ao cancelar entrega de EPI.");
    }
}

export async function getEpiPrintData(employeeId: string) {
    try {
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: {
                company: true,
                assignments: {
                    where: { endDate: null },
                    include: {
                        posto: {
                            include: {
                                role: true
                            }
                        }
                    }
                },
                role: true,
                epiDeliveries: {
                    include: {
                        epiItem: true,
                        deliveredBy: true
                    },
                    orderBy: { deliveryDate: "asc" }
                }
            }
        });

        if (!employee) throw new Error("Colaborador não encontrado.");

        return employee;
    } catch (e: any) {
        console.error("Error getting EPI print data:", e);
        throw new Error("Erro ao obter dados da ficha de entrega.");
    }
}

export async function updateEmployeeSizes(employeeId: string, sizes: { camiseta?: string; calca?: string; luvas?: string; sapato?: string }) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");

        const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!employee) throw new Error("Colaborador não encontrado.");

        const extra = (employee.extraFields as any) || {};
        extra.camisetaTamanho = sizes.camiseta;
        extra.calcaTamanho = sizes.calca;
        extra.luvasTamanho = sizes.luvas;
        extra.sapatoTamanho = sizes.sapato;

        await prisma.employee.update({
            where: { id: employeeId },
            data: { extraFields: extra }
        });

        return { success: true };
    } catch (e: any) {
        console.error("Error updating employee sizes:", e);
        throw new Error("Erro ao salvar tamanhos do colaborador.");
    }
}

export async function toggleDeliverySignature(id: string) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");

        const delivery = await prisma.epiDelivery.findUnique({
            where: { id }
        });

        if (!delivery) throw new Error("Lançamento não encontrado.");

        const currentSig = delivery.recipientSignature;
        const newSig = currentSig === "ASSINADO" ? "PENDENTE" : "ASSINADO";

        const updated = await prisma.epiDelivery.update({
            where: { id },
            data: { recipientSignature: newSig },
            include: {
                epiItem: true,
                employee: {
                    select: {
                        name: true,
                        cpf: true,
                        company: { select: { name: true } },
                        role: { select: { name: true } }
                    }
                },
                deliveredBy: { select: { name: true } }
            }
        });

        return updated;
    } catch (e: any) {
        console.error("Error toggling delivery signature:", e);
        throw new Error(e.message || "Erro ao alternar assinatura da entrega.");
    }
}

export async function getAllDeliveries() {
    try {
        return await prisma.epiDelivery.findMany({
            include: {
                epiItem: true,
                employee: {
                    select: {
                        name: true,
                        cpf: true,
                        company: { select: { name: true } },
                        role: { select: { name: true } }
                    }
                },
                deliveredBy: { select: { name: true } }
            },
            orderBy: { deliveryDate: "desc" }
        });
    } catch (e: any) {
        console.error("Error fetching all deliveries:", e);
        throw new Error("Erro ao recarregar lançamentos.");
    }
}

// Word wrapping utility for Courier font on pdf-lib
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";
    
    // Approximate monospace Courier character width as 0.6 of font size
    const charWidth = fontSize * 0.6;
    const maxChars = Math.floor(maxWidth / charWidth);

    for (const word of words) {
        if ((currentLine + word).length > maxChars) {
            lines.push(currentLine.trim());
            currentLine = word + " ";
        } else {
            currentLine += word + " ";
        }
    }
    if (currentLine) {
        lines.push(currentLine.trim());
    }
    return lines;
}

// E.164 phone formatting helper for Brazil
function formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11) {
        return `+55${digits}`;
    }
    if (digits.length === 10) {
        return `+55${digits.substring(0, 2)}9${digits.substring(2)}`;
    }
    if (digits.startsWith("55") && digits.length >= 12) {
        return `+${digits}`;
    }
    return `+55${digits}`;
}

// GraphQL multipart API request helper for Autentique
async function queryAutentique(query: string, variables: any, fileBuffer?: Buffer, fileName?: string) {
    const token = process.env.AUTENTIQUE_API_TOKEN;
    if (!token) throw new Error("Chave da API da Autentique (AUTENTIQUE_API_TOKEN) não está configurada nas variáveis de ambiente.");

    const body = new FormData();
    body.append("operations", JSON.stringify({
        query,
        variables: {
            ...variables,
            file: null
        }
    }));
    body.append("map", JSON.stringify({
        "0": ["variables.file"]
    }));

    if (fileBuffer) {
        const blob = new Blob([new Uint8Array(fileBuffer)], { type: "application/pdf" });
        body.append("0", blob, fileName || "document.pdf");
    }

    const response = await fetch("https://api.autentique.com.br/v2/graphql", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`
        },
        body
    });

    const result = await response.json();
    if (result.errors && result.errors.length > 0) {
        console.error("Autentique API error payload details:", JSON.stringify(result.errors));
        throw new Error(result.errors[0].message || "Erro retornado pela API da Autentique.");
    }

    return result.data;
}

export async function sendAutentiqueDocument(employeeName: string, phone: string, pdfBuffer: Buffer, fileName: string, docName: string) {
    const formatted = formatPhone(phone);
    const query = `
        mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
            createDocument(sandbox: false, document: $document, signers: $signers, file: $file) {
                id
                name
                signatures {
                    public_id
                    name
                    link {
                        short_link
                    }
                }
            }
        }
    `;

    const variables = {
        document: {
            name: docName
        },
        signers: [
            {
                name: employeeName,
                action: "SIGN",
                phone: formatted,
                delivery_method: "DELIVERY_METHOD_WHATSAPP"
            }
        ]
    };

    return await queryAutentique(query, variables, pdfBuffer, fileName);
}

function sanitizeText(str: string): string {
    if (!str) return "";
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")  // strip diacritical marks (accents)
        .replace(/[º°]/g, "o")            // ordinal indicators
        .replace(/[ª]/g, "a")
        .replace(/[–—]/g, "-")            // dashes
        .replace(/[""]/g, '"')            // smart quotes
        .replace(/[''´`]/g, "'")          // smart apostrophes
        .replace(/[^\x20-\x7E]/g, "?");   // replace any remaining non-ASCII with ?
}

export async function seedDefaultEpiDeliveries(employeeId: string) {
    try {
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: { epiDeliveries: true }
        });

        if (!employee) return { error: "Colaborador não encontrado." };

        const defaultItems = [
            { name: "Sapato de segurança", type: "EPI", unit: "par", caNumber: "38592" },
            { name: "Luva de Látex", type: "EPI", unit: "par", caNumber: "41982" },
            { name: "Óculos de segurança", type: "EPI", unit: "unidade", caNumber: "25712" },
            { name: "Máscara PFF2-S", type: "EPI", unit: "unidade", caNumber: "38904" },
            { name: "Uniforme / Crachá", type: "UNIFORME", unit: "conjunto", caNumber: null }
        ];

        for (const item of defaultItems) {
            let epiItem = await prisma.epiItem.findFirst({
                where: { name: item.name }
            });

            if (!epiItem) {
                epiItem = await prisma.epiItem.create({
                    data: {
                        name: item.name,
                        type: item.type,
                        unit: item.unit,
                        caNumber: item.caNumber,
                        stockQuantity: 100,
                        minStockQuantity: 10
                    }
                });
            }

            const existing = await prisma.epiDelivery.findFirst({
                where: {
                    employeeId,
                    epiItemId: epiItem.id
                }
            });

            if (!existing) {
                await prisma.epiDelivery.create({
                    data: {
                        employeeId,
                        epiItemId: epiItem.id,
                        quantity: 1,
                        deliveryDate: employee.admissionDate || new Date(),
                        merCode: 1, // 1 = Admissão
                        notes: "Lançamento automático de EPIs Básicos de Admissão"
                    }
                });
            }
        }

        revalidatePath("/admin/epi");
        revalidatePath(`/admin/employees/${employeeId}`);
        return { success: true };
    } catch (e: any) {
        console.error("Error seeding default EPI deliveries:", e);
        return { error: e.message };
    }
}

// Server side PDF builder using pdf-lib
export async function generateEpiPdfBytes(employeeId: string): Promise<Buffer> {
    let employee = await getEpiPrintData(employeeId);
    if (!employee) throw new Error("Colaborador não encontrado.");

    if (!employee.epiDeliveries || employee.epiDeliveries.length === 0) {
        await seedDefaultEpiDeliveries(employeeId);
        employee = await getEpiPrintData(employeeId);
    }

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // Load embedded NotoSans font and AlexBrush handwritten signature font
    const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");
    const fontSigPath = path.join(process.cwd(), "public", "fonts", "AlexBrush.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    const fontSigBytes = fs.readFileSync(fontSigPath);
    const font = await pdfDoc.embedFont(fontBytes);
    const fontSig = await pdfDoc.embedFont(fontSigBytes);

    const page = pdfDoc.addPage([595, 842]); // A4

    const companyName = employee.company?.name || "SPOT SERVIÇOS FACILITIES LTDA";
    const roleName = employee.role?.name || "Auxiliar de Limpeza";
    const formattedAdmission = employee.admissionDate
        ? new Date(employee.admissionDate).getUTCDate().toString().padStart(2, '0') + '/' + 
          (new Date(employee.admissionDate).getUTCMonth() + 1).toString().padStart(2, '0') + '/' + 
          new Date(employee.admissionDate).getUTCFullYear()
        : "__/__/____";
    const formattedDismissal = employee.dismissalReason ? "__/__/____" : "__/__/____";

    const extra = (employee.extraFields as any) || {};
    const camisetaSize = extra.camisetaTamanho || "___";
    const calcaSize = extra.calcaTamanho || "___";
    const luvasSize = extra.luvasTamanho || "___";
    const sapatoSize = extra.sapatoTamanho || "___";

    const deliveries = (employee.epiDeliveries || []).map((d: any) => ({
        deliveryDate: d.deliveryDate,
        quantity: d.quantity,
        unit: d.epiItem?.unit || "UN",
        caNumber: d.epiItem?.caNumber || "-",
        itemName: `${d.epiItem?.name || ''} ${d.epiItem?.size ? `(${d.epiItem.size})` : ''}`.trim(),
        merCode: d.merCode,
        deliveredBy: d.deliveredBy?.name || "Mesa"
    }));

    const startX = 30;
    const endX = 565;
    const contentWidth = endX - startX; // 535

    // Outer Frame Border
    page.drawRectangle({
        x: startX,
        y: 30,
        width: contentWidth,
        height: 782,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1
    });

    // 1. Header Title Box
    let curY = 790;
    page.drawText("FICHA DE ENTREGA DE EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL (EPI)", {
        x: startX + 50,
        y: curY,
        size: 10,
        font
    });

    curY -= 15;
    page.drawLine({
        start: { x: startX, y: curY },
        end: { x: endX, y: curY },
        thickness: 1,
        color: rgb(0, 0, 0)
    });

    // 2. Employee and Company Details Grid
    curY -= 15;
    const col1X = startX + 10;
    const col2X = startX + 270;

    page.drawText(`EMPRESA: ${companyName}`, { x: col1X, y: curY, size: 8, font });
    page.drawText(`FUNÇÃO: ${roleName}`, { x: col2X, y: curY, size: 8, font });
    curY -= 14;
    page.drawText(`NOME DO TRABALHADOR: ${employee.name}`, { x: col1X, y: curY, size: 8, font });
    page.drawText(`CPF: ${employee.cpf || "___________________"}`, { x: col2X, y: curY, size: 8, font });
    curY -= 14;
    page.drawText(`DATA DE ADMISSÃO: ${formattedAdmission}`, { x: col1X, y: curY, size: 8, font });
    page.drawText(`DATA DE DEMISSÃO: ${formattedDismissal}`, { x: col2X, y: curY, size: 8, font });

    curY -= 10;
    page.drawLine({
        start: { x: startX, y: curY },
        end: { x: endX, y: curY },
        thickness: 1,
        color: rgb(0, 0, 0)
    });

    // 3. M.E.R - Motivos e Legenda Box
    curY -= 12;
    page.drawText("M.E.R - MOTIVOS PARA ENTREGA/RECEBIMENTO:", { x: col1X, y: curY, size: 7, font });
    page.drawText("LEGENDA / INFORMAÇÕES:", { x: col2X, y: curY, size: 7, font });

    curY -= 11;
    page.drawText("1 - Recebimento de rotina ou EPI descartável", { x: col1X, y: curY, size: 6.5, font });
    page.drawText("CA: Certificado de Aprovação (Ministério do Trabalho)", { x: col2X, y: curY, size: 6.5, font });
    curY -= 10;
    page.drawText("2 - Substituição por dano justificado", { x: col1X, y: curY, size: 6.5, font });
    page.drawText("M.E.R: Motivos para Entrega e Recebimento de EPI", { x: col2X, y: curY, size: 6.5, font });
    curY -= 10;
    page.drawText("3 - Substituição por dano próprio ou perda", { x: col1X, y: curY, size: 6.5, font });
    curY -= 10;
    page.drawText("4 - Devolução, demissão / mudança de função", { x: col1X, y: curY, size: 6.5, font });
    curY -= 10;
    page.drawText("5 - Primeira entrega", { x: col1X, y: curY, size: 6.5, font });

    curY -= 8;
    page.drawLine({
        start: { x: startX, y: curY },
        end: { x: endX, y: curY },
        thickness: 1,
        color: rgb(0, 0, 0)
    });

    // 4. Termo de Responsabilidade
    curY -= 15;
    page.drawText("TERMO DE RESPONSABILIDADE", { x: startX + 190, y: curY, size: 8, font });

    curY -= 12;
    const respText = `Declaro para os devidos fins que recebi os E.P.I's (Equipamento de Proteção Individual) abaixo descritos e me comprometo: Usá-los apenas para as finalidades a que se destinam; Responsabilizar-me por sua guarda e conservação; Comunicar ao empregador qualquer modificação que os tornem impróprios para o uso; Responsabilizar-me pela danificação do E.P.I devido ao uso inadequado ou fora das atividades a que se destinam, bem como pelo seu extravio. Declaro ainda estar ciente de que o uso é obrigatório sob pena de ser punido conforme LEI nº 6.514, de 22/12/77, artigo 158, que diz: recusa injustificada ao uso de EPI ou vestimenta fornecido pelo serviço de saúde constitui ato faltoso, autorizador de despedida por "Justa Causa". Declaro que recebi treinamento referente ao uso e conservação do E.P.I segundo as Normas de Segurança do Trabalho.`;
    
    const lines = wrapText(respText, contentWidth - 20, 6.5);
    for (const l of lines) {
        page.drawText(l, { x: col1X, y: curY, size: 6.5, font });
        curY -= 9.5;
    }

    curY -= 5;
    const sizesLine = `Camiseta: ${camisetaSize}    Calça: ${calcaSize}    Luvas: ${luvasSize}    Calçado: ${sapatoSize}`;
    page.drawText(sizesLine, { x: startX + 130, y: curY, size: 7.5, font });

    curY -= 20;
    const now = new Date();
    const todayFormatted = `${now.getUTCDate().toString().padStart(2, '0')}/${(now.getUTCMonth() + 1).toString().padStart(2, '0')}/${now.getUTCFullYear()}`;
    
    page.drawText(`Curitiba, ${todayFormatted}`, { x: col1X, y: curY, size: 7.5, font });

    // Signature Line (left blank for Autentique / physical signature)
    page.drawLine({
        start: { x: col2X + 20, y: curY + 2 },
        end: { x: endX - 20, y: curY + 2 },
        thickness: 0.5,
        color: rgb(0, 0, 0)
    });
    page.drawText("ASSINATURA DO TRABALHADOR", { x: col2X + 50, y: curY - 10, size: 7.5, font });

    curY -= 20;
    page.drawLine({
        start: { x: startX, y: curY },
        end: { x: endX, y: curY },
        thickness: 1,
        color: rgb(0, 0, 0)
    });

    // 5. Items Grid Table
    const tableCols = [
        { header: "DATA ENTREGA", x: startX, w: 55 },
        { header: "QTD.", x: startX + 55, w: 25 },
        { header: "UND.", x: startX + 80, w: 30 },
        { header: "C.A.", x: startX + 110, w: 40 },
        { header: "ITEM / DESCRIÇÃO", x: startX + 150, w: 190 },
        { header: "M.E.R.", x: startX + 340, w: 40 },
        { header: "ASSINATURA TRABALHADOR", x: startX + 380, w: 85 },
        { header: "RESPONSÁVEL ENTREGA", x: startX + 465, w: 70 }
    ];

    const rowHeight = 17;
    const headerHeight = 18;

    // Header Row background & text
    curY -= headerHeight;
    page.drawRectangle({
        x: startX,
        y: curY,
        width: contentWidth,
        height: headerHeight,
        color: rgb(0.93, 0.93, 0.93),
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    for (const col of tableCols) {
        page.drawText(col.header, { x: col.x + 2, y: curY + 5, size: 5.5, font });
        if (col.x > startX) {
            page.drawLine({
                start: { x: col.x, y: curY },
                end: { x: col.x, y: curY + headerHeight },
                thickness: 0.5,
                color: rgb(0, 0, 0)
            });
        }
    }

    // 16 Rows total (filled + empty padding rows)
    const maxRows = 16;
    for (let r = 0; r < maxRows; r++) {
        curY -= rowHeight;
        const d = deliveries[r];

        page.drawRectangle({
            x: startX,
            y: curY,
            width: contentWidth,
            height: rowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.5
        });

        for (const col of tableCols) {
            if (col.x > startX) {
                page.drawLine({
                    start: { x: col.x, y: curY },
                    end: { x: col.x, y: curY + rowHeight },
                    thickness: 0.5,
                    color: rgb(0, 0, 0)
                });
            }
        }

        if (d) {
            const dateObj = new Date(d.deliveryDate);
            const dateFormatted = `${dateObj.getUTCDate().toString().padStart(2, '0')}/${(dateObj.getUTCMonth() + 1).toString().padStart(2, '0')}/${dateObj.getUTCFullYear()}`;

            page.drawText(dateFormatted, { x: tableCols[0].x + 4, y: curY + 5, size: 6.5, font });
            page.drawText(String(d.quantity), { x: tableCols[1].x + 10, y: curY + 5, size: 6.5, font });
            page.drawText(d.unit, { x: tableCols[2].x + 4, y: curY + 5, size: 6.5, font });
            page.drawText(d.caNumber || "-", { x: tableCols[3].x + 4, y: curY + 5, size: 6.5, font });
            
            let name = d.itemName;
            if (name.length > 35) name = name.substring(0, 32) + "...";
            page.drawText(name, { x: tableCols[4].x + 4, y: curY + 5, size: 6.5, font });
            page.drawText(String(d.merCode), { x: tableCols[5].x + 15, y: curY + 5, size: 6.5, font });
            
            let resp = d.deliveredBy || "Mesa";
            if (resp.length > 16) resp = resp.substring(0, 14) + "...";
            page.drawText(resp, { x: tableCols[7].x + 4, y: curY + 5, size: 6, font });
        }
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}


// Action to trigger Autentique document signature request via WhatsApp
export async function sendEpiFichaToAutentique(employeeId: string) {
    try {
        const user = await getCurrentUser();
        if (!user) return { success: false, error: "Não autorizado." };

        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: {
                company: true
            }
        });

        if (!employee) return { success: false, error: "Colaborador não encontrado." };
        
        const extra = (employee.extraFields as any) || {};
        const phone = employee.phone || extra.celularWhatsApp || extra.telefone || extra.phone;
        
        if (!phone) {
            return { 
                success: false, 
                error: "Colaborador não possui número de celular/telefone cadastrado no sistema para envio do WhatsApp." 
            };
        }

        // 1. Generate PDF
        const pdfBuffer = await generateEpiPdfBytes(employeeId);

        // 2. Format phone number to E.164
        const formatted = formatPhone(phone);

        // 3. Autentique GraphQL createDocument mutation variables
        const query = `
            mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
                createDocument(sandbox: false, document: $document, signers: $signers, file: $file) {
                    id
                    name
                    signatures {
                        public_id
                        name
                        link {
                            short_link
                        }
                    }
                }
            }
        `;

        const variables = {
            document: {
                name: `Ficha de EPI - ${employee.name}`
            },
            signers: [
                {
                    name: employee.name,
                    action: "SIGN",
                    phone: formatted,
                    delivery_method: "DELIVERY_METHOD_WHATSAPP"
                }
            ]
        };

        const res = await queryAutentique(query, variables, pdfBuffer, `Ficha_EPI_${employee.name.replace(/\s+/g, "_")}.pdf`);
        const docId = res.createDocument.id;
        const shortLink = res.createDocument.signatures?.[0]?.link?.short_link || "";

        // 4. Update all deliveries of this employee currently PENDENTE to ENVIADO_AUTENTIQUE_<docId>
        await prisma.epiDelivery.updateMany({
            where: {
                employeeId,
                OR: [
                    { recipientSignature: null },
                    { recipientSignature: "PENDENTE" }
                ]
            },
            data: {
                recipientSignature: `ENVIADO_AUTENTIQUE_${docId}`
            }
        });

        revalidatePath("/admin/epi");
        return { success: true, docId, shortLink };
    } catch (e: any) {
        console.error("sendEpiFichaToAutentique error details:", e);
        return { success: false, error: e.message || "Erro ao disparar assinatura digital no WhatsApp." };
    }
}
