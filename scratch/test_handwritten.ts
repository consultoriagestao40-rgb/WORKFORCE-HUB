import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";

async function testHandwritten() {
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

    // Draw header box for table cell
    page.drawRectangle({
        x: startX + 380,
        y: 600,
        width: 85,
        height: 25,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    const employeeName = "Cristiano Magalhães da Silva";
    // Generate a signature rubric text: e.g. "C. Magalhães"
    const nameParts = employeeName.trim().split(/\s+/);
    const rubricText = nameParts.length > 1
        ? `${nameParts[0][0]}. ${nameParts[nameParts.length - 1]}`
        : nameParts[0];

    // Draw handwritten rubric in dark blue pen ink color
    page.drawText(rubricText, {
        x: startX + 384,
        y: 606,
        size: 11,
        font: fontSig,
        color: rgb(0.05, 0.15, 0.55) // realistic blue ink
    });

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync("scratch/test_handwritten.pdf", Buffer.from(pdfBytes));
    console.log("Generated scratch/test_handwritten.pdf");
}

testHandwritten().catch(console.error);
