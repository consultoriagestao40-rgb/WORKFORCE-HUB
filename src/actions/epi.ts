"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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

// Server side PDF builder using pdf-lib
export async function generateEpiPdfBytes(employeeId: string): Promise<Buffer> {
    const employee = await getEpiPrintData(employeeId);
    if (!employee) throw new Error("Colaborador não encontrado.");

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.CourierBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Courier);

    const companyName = employee.company?.name || "SPOT SERVIÇOS FACILITIES LTDA";
    const roleName = employee.role?.name || "Auxiliar de Limpeza";
    const formattedAdmission = employee.admissionDate
        ? new Date(employee.admissionDate).getUTCDate().toString().padStart(2, '0') + '/' + 
          (new Date(employee.admissionDate).getUTCMonth() + 1).toString().padStart(2, '0') + '/' + 
          new Date(employee.admissionDate).getUTCFullYear()
        : "__/__/____";

    const extra = (employee.extraFields as any) || {};
    const sizesStr = `Camiseta: ${extra.camisetaTamanho || "___"} | Calça: ${extra.calcaTamanho || "___"} | Luvas: ${extra.luvasTamanho || "___"} | Sapato: ${extra.sapatoTamanho || "___"}`;

    // Draw Title Header Box
    page.drawRectangle({
        x: 40,
        y: 775,
        width: 515,
        height: 35,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1
    });

    page.drawText("FICHA DE ENTREGA DE EQUIPAMENTO DE PROTECAO INDIVIDUAL (EPI)", {
        x: 55,
        y: 788,
        size: 11,
        font
    });

    // Draw employee Details
    let y = 750;
    page.drawText(`Empresa: ${companyName}`, { x: 40, y, size: 9, font });
    y -= 15;
    page.drawText(`Trabalhador: ${employee.name}`, { x: 40, y, size: 9, font });
    y -= 15;
    page.drawText(`CPF: ${employee.cpf || "-"}`, { x: 40, y, size: 9, font });
    page.drawText(`Função: ${roleName}`, { x: 300, y, size: 9, font });
    y -= 15;
    page.drawText(`Data de Admissão: ${formattedAdmission}`, { x: 40, y, size: 9, font });
    
    y -= 25;

    // Draw Termo de Responsabilidade
    const responsibilityText = "Declaro para os devidos fins que recebi os E.P.I's (Equipamento de Proteção Individual) abaixo descritos e me comprometo: Usá-los apenas para as finalidades a que se destinam; Responsabilizar-me por sua guarda e conservação; Comunicar ao empregador qualquer modificação que os tornem impróprios para o uso; Responsabilizar-me pela danificação do E.P.I devido ao uso inadequado ou fora das atividades a que se destinam, bem como pelo seu extravio. Declaro ainda estar ciente de que o uso é obrigatório sob pena de ser punido conforme LEI nº 6.514, de 22/12/77, artigo 158, que diz: recusa injustificada ao uso de EPI ou vestimenta fornecido pelo serviço de saúde constitui ato faltoso, autorizador de despedida por Justa Causa. Declaro que recebi treinamento referente ao uso e conservação do E.P.I segundo as Normas de Segurança do Trabalho.";
    
    const wrapped = wrapText(responsibilityText, 515, 8);
    for (const line of wrapped) {
        page.drawText(line, { x: 40, y, size: 8, font: fontRegular });
        y -= 12;
    }

    y -= 15;
    page.drawText(`Grade de Tamanhos: ${sizesStr}`, { x: 40, y, size: 9, font });

    y -= 30;

    // Table Header
    page.drawRectangle({
        x: 40,
        y: y - 5,
        width: 515,
        height: 18,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1
    });

    page.drawText("DATA", { x: 45, y, size: 8, font });
    page.drawText("QTD", { x: 105, y, size: 8, font });
    page.drawText("UND", { x: 135, y, size: 8, font });
    page.drawText("C.A.", { x: 165, y, size: 8, font });
    page.drawText("ITEM / DESCRIÇÃO", { x: 215, y, size: 8, font });
    page.drawText("M.E.R", { x: 450, y, size: 8, font });

    y -= 20;

    const deliveries = employee.epiDeliveries || [];
    for (const d of deliveries) {
        const dateObj = new Date(d.deliveryDate);
        const dateStr = `${dateObj.getUTCDate().toString().padStart(2, '0')}/${(dateObj.getUTCMonth() + 1).toString().padStart(2, '0')}/${dateObj.getUTCFullYear()}`;
        
        page.drawText(dateStr, { x: 45, y, size: 8, font: fontRegular });
        page.drawText(String(d.quantity), { x: 105, y, size: 8, font: fontRegular });
        page.drawText(d.epiItem.unit, { x: 135, y, size: 8, font: fontRegular });
        page.drawText(d.epiItem.caNumber || "-", { x: 165, y, size: 8, font: fontRegular });
        
        let itemName = d.epiItem.name;
        if (d.epiItem.size) itemName += ` (${d.epiItem.size})`;
        if (itemName.length > 32) itemName = itemName.substring(0, 29) + "...";

        page.drawText(itemName, { x: 215, y, size: 8, font: fontRegular });
        page.drawText(String(d.merCode), { x: 450, y, size: 8, font: fontRegular });

        page.drawLine({
            start: { x: 40, y: y - 4 },
            end: { x: 555, y: y - 4 },
            thickness: 0.5,
            color: rgb(0.8, 0.8, 0.8)
        });

        y -= 16;
        if (y < 50) break;
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
                createDocument(document: $document, signers: $signers, file: $file) {
                    id
                    name
                    link {
                        short_link
                    }
                }
            }
        `;

        const variables = {
            document: {
                name: `Ficha de EPI - ${employee.name}`,
                sandbox: true // Set sandbox to avoid consuming real document quotas during test
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
        const shortLink = res.createDocument.link.short_link;

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
