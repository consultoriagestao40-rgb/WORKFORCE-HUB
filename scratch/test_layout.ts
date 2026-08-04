import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";
    const charWidth = fontSize * 0.48; // average char width for proportional NotoSans
    const maxChars = Math.floor(maxWidth / charWidth);

    for (const word of words) {
        if ((currentLine + word).length > maxChars) {
            lines.push(currentLine.trim());
            currentLine = word + " ";
        } else {
            currentLine += word + " ";
        }
    }
    if (currentLine.trim()) {
        lines.push(currentLine.trim());
    }
    return lines;
}

async function testGeneratePdf() {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    const font = await pdfDoc.embedFont(fontBytes);

    const page = pdfDoc.addPage([595, 842]); // A4

    const companyName = "CLEAN TECH PRO";
    const roleName = "Auxiliar Administrativo";
    const employeeName = "Cristiano Magalhães da Silva";
    const employeeCpf = "968.934.861-20";
    const formattedAdmission = "29/07/2026";
    const formattedDismissal = "__/__/____";

    const camisetaSize = "___";
    const calcaSize = "___";
    const luvasSize = "___";
    const sapatoSize = "___";

    const deliveries = [
        {
            deliveryDate: "2026-07-30T00:00:00.000Z",
            quantity: 1,
            unit: "PAR",
            caNumber: "4567",
            itemName: "Luva amarela (M)",
            merCode: 1,
            deliveredBy: "Cristiano Silva"
        }
    ];

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
    page.drawText(`NOME DO TRABALHADOR: ${employeeName}`, { x: col1X, y: curY, size: 8, font });
    page.drawText(`CPF: ${employeeCpf}`, { x: col2X, y: curY, size: 8, font });
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
    page.drawText("Curitiba, ______/______/__________", { x: col1X, y: curY, size: 7.5, font });
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
        { header: "DATA ENTREGA", x: startX, w: 65 },
        { header: "QTD.", x: startX + 65, w: 30 },
        { header: "UND.", x: startX + 95, w: 35 },
        { header: "C.A.", x: startX + 130, w: 50 },
        { header: "ITEM / DESCRIÇÃO", x: startX + 180, w: 160 },
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
        // Vertical line
        if (col.x > startX) {
            page.drawLine({
                start: { x: col.x, y: curY },
                end: { x: col.x, y: curY + headerHeight },
                thickness: 0.5,
                color: rgb(0, 0, 0)
            });
        }
    }

    // 16 Rows total (filled + empty)
    const maxRows = 16;
    for (let r = 0; r < maxRows; r++) {
        curY -= rowHeight;
        const d = deliveries[r];

        // Draw row outer rectangle / border
        page.drawRectangle({
            x: startX,
            y: curY,
            width: contentWidth,
            height: rowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.5
        });

        // Draw vertical column dividers
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
            page.drawText("Ciente / Assinado", { x: tableCols[6].x + 4, y: curY + 5, size: 6, font });
            
            let resp = d.deliveredBy || "Mesa";
            if (resp.length > 16) resp = resp.substring(0, 14) + "...";
            page.drawText(resp, { x: tableCols[7].x + 4, y: curY + 5, size: 6, font });
        }
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync("scratch/test_layout.pdf", Buffer.from(pdfBytes));
    console.log("PDF generated successfully: scratch/test_layout.pdf");
}

testGeneratePdf().catch(console.error);
