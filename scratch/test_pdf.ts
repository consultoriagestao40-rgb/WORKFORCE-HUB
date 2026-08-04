import { PDFDocument, StandardFonts } from "pdf-lib";
import fs from "fs";

async function testPdf() {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.CourierBold);

    const testText = "Magalhaes da Silva"; // sanitized

    // Test without sanitize
    const rawText = "Magalhães da Silva"; // original

    try {
        page.drawText(`Sanitized: ${testText}`, { x: 40, y: 780, size: 12, font });
        page.drawText(`Raw: ${rawText}`, { x: 40, y: 760, size: 12, font });
    } catch (err) {
        console.log("Error drawing raw text:", err);
    }

    const bytes = await pdfDoc.save();
    fs.writeFileSync("/Users/cristianosilva/Work Force Hub/scratch/test_output.pdf", Buffer.from(bytes));
    console.log("PDF saved to scratch/test_output.pdf");
}

testPdf().catch(console.error);
