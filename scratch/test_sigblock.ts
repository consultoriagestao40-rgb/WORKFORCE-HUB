import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";

async function testSignatureBlock() {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");
    const fontSigPath = path.join(process.cwd(), "public", "fonts", "AlexBrush.ttf");

    const fontBytes = fs.readFileSync(fontPath);
    const fontSigBytes = fs.readFileSync(fontSigPath);

    const font = await pdfDoc.embedFont(fontBytes);
    const fontSig = await pdfDoc.embedFont(fontSigBytes);

    const page = pdfDoc.addPage([595, 842]);
    const startX = 30;
    const endX = 565;
    const col1X = startX + 10;
    const col2X = startX + 270;

    let curY = 500;

    const now = new Date();
    const todayFormatted = `${now.getUTCDate().toString().padStart(2, '0')}/${(now.getUTCMonth() + 1).toString().padStart(2, '0')}/${now.getUTCFullYear()}`;
    const employeeName = "Cristiano Magalhães da Silva";

    page.drawText(`Curitiba, ${todayFormatted}`, { x: col1X, y: curY, size: 8, font });

    // Draw handwritten signature above line
    page.drawText(employeeName, {
        x: col2X + 35,
        y: curY + 6,
        size: 14,
        font: fontSig,
        color: rgb(0.05, 0.15, 0.55)
    });

    // Draw signature line
    page.drawLine({
        start: { x: col2X + 20, y: curY + 2 },
        end: { x: endX - 20, y: curY + 2 },
        thickness: 0.5,
        color: rgb(0, 0, 0)
    });

    page.drawText("ASSINATURA DO TRABALHADOR", { x: col2X + 55, y: curY - 10, size: 7.5, font });

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync("scratch/test_sigblock.pdf", Buffer.from(pdfBytes));
    console.log("PDF saved to scratch/test_sigblock.pdf");
}

testSignatureBlock().catch(console.error);
