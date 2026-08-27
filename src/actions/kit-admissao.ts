"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { PDFDocument, PDFPage, PDFFont, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import { generateEpiPdfBytes, sendAutentiqueDocument } from "@/actions/epi";

function getMonthNamePtBR(monthIndex: number): string {
    const months = [
        "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];
    return months[monthIndex] || "janeiro";
}

// Exact character-width wrapping using font.widthOfTextAtSize to prevent any border overflows
function wrapTextExact(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
    if (!text) return [];
    const lines: string[] = [];
    const paragraphs = text.split("\n");

    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;
        const words = trimmed.split(/\s+/);
        let currentLine = "";

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (font.widthOfTextAtSize(testLine, fontSize) <= maxWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) lines.push(currentLine);
                if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
                    let sub = "";
                    for (const char of word) {
                        if (font.widthOfTextAtSize(sub + char, fontSize) <= maxWidth) {
                            sub += char;
                        } else {
                            lines.push(sub);
                            sub = char;
                        }
                    }
                    currentLine = sub;
                } else {
                    currentLine = word;
                }
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
    }
    return lines;
}

function sanitizeActivityDescription(rawText?: string | null): string {
    if (!rawText) return "(INFORMAÇÕES CONFORME OBSERVAÇÃO TÉCNICA / RELATO DO FUNCIONÁRIO) Realizam a higienização de superfícies variadas. Utilizam água sanitária e produto químico na higienização em geral. Realizam a limpeza com mop pó, mop úmido, (LT) limpa tudo com fibra e balde espremedor. O piso é lavado com máquina lavadora de pisos a bateria. Trabalham com segurança, seguindo normas de higiene, qualidade, proteção ao meio ambiente, utilizam equipamento de proteção individual e coletivo, promovendo a segurança individual e da equipe.";

    let clean = rawText;
    clean = clean.replace(/ORDEM DE SERVIÇO[\s\S]*?CBO:\s*\d+-\d+/gi, "");
    clean = clean.replace(/Pela presente Ordem de Serviço objetivamos informar[\s\S]*?doenças ocupacionais\./gi, "");
    clean = clean.replace(/Risco e Avaliação[\s\S]*/gi, "");
    clean = clean.trim();

    if (!clean || clean.length < 10) {
        return "(INFORMAÇÕES CONFORME OBSERVAÇÃO TÉCNICA / RELATO DO FUNCIONÁRIO) Realizam a higienização de superfícies variadas. Utilizam água sanitária e produto químico na higienização em geral. Realizam a limpeza com mop pó, mop úmido, (LT) limpa tudo com fibra e balde espremedor. O piso é lavado com máquina lavadora de pisos a bateria. Trabalham com segurança, seguindo normas de higiene, qualidade, proteção ao meio ambiente, utilizam equipamento de proteção individual e coletivo, promovendo a segurança individual e da equipe.";
    }

    if (!clean.startsWith("(INFORMAÇÕES")) {
        clean = "(INFORMAÇÕES CONFORME OBSERVAÇÃO TÉCNICA / RELATO DO FUNCIONÁRIO) " + clean;
    }
    return clean;
}

// 1. Generate Termo de Ponto PDF Bytes
export async function generateTermoPontoPdfBytes(employeeId: string): Promise<Buffer> {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
            company: true,
            role: true,
            assignments: {
                where: { endDate: null },
                include: { posto: { include: { client: true } } }
            }
        }
    });

    if (!employee) throw new Error("Colaborador não encontrado.");

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");
    const fontSigPath = path.join(process.cwd(), "public", "fonts", "AlexBrush.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    const fontSigBytes = fs.readFileSync(fontSigPath);

    const font = await pdfDoc.embedFont(fontBytes);
    const fontSig = await pdfDoc.embedFont(fontSigBytes);

    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const startX = 45;
    const endX = 550;
    const contentWidth = endX - startX;

    let curY = 780;

    // Document Titles
    page.drawText("TERMO DE CIÊNCIA E COMPROMISSO SOBRE REGISTRO DE PONTO", {
        x: startX + 20,
        y: curY,
        size: 11.5,
        font
    });

    curY -= 28;
    page.drawText("TERMO DE RESPONSABILIDADE PARA REGISTRO DE PONTO VIA APLICATIVO", {
        x: startX + 10,
        y: curY,
        size: 10,
        font
    });

    curY -= 30;
    const introText = "Pelo presente termo, o colaborador abaixo assinado declara estar ciente das seguintes obrigações relacionadas ao registro de jornada de trabalho por meio do aplicativo oficial da empresa:";
    for (const l of wrapTextExact(introText, contentWidth, font, 9.5)) {
        page.drawText(l, { x: startX, y: curY, size: 9.5, font });
        curY -= 14;
    }

    curY -= 12;
    // Item 1
    page.drawText("1. Obrigatoriedade de Registro", { x: startX, y: curY, size: 10, font });
    curY -= 15;
    const item1Text = "É de responsabilidade do colaborador registrar corretamente seus horários de entrada, saída e intervalos por meio do aplicativo de ponto fornecido pela empresa. Caso, por qualquer motivo, não seja possível realizar o registro pelo aplicativo, o colaborador deverá registrar o ponto manualmente na folha de ponto disponibilizada pela empresa, no mesmo dia da ocorrência.";
    for (const l of wrapTextExact(item1Text, contentWidth - 15, font, 9)) {
        page.drawText(l, { x: startX + 15, y: curY, size: 9, font });
        curY -= 13.5;
    }

    curY -= 12;
    // Item 2
    page.drawText("2. Falta de Registro", { x: startX, y: curY, size: 10, font });
    curY -= 15;
    const item2Text = "A ausência de registro de ponto, sem justificativa prévia ou autorização formal da liderança, será considerada descumprimento das normas internas da empresa.";
    for (const l of wrapTextExact(item2Text, contentWidth - 15, font, 9)) {
        page.drawText(l, { x: startX + 15, y: curY, size: 9, font });
        curY -= 13.5;
    }

    curY -= 12;
    // Item 3
    page.drawText("3. Penalidades", { x: startX, y: curY, size: 10, font });
    curY -= 15;
    page.drawText("O não cumprimento das obrigações acima poderá acarretar:", { x: startX + 15, y: curY, size: 9, font });
    curY -= 14;
    page.drawText("• Primeira ocorrência: Advertência verbal.", { x: startX + 30, y: curY, size: 9, font });
    curY -= 13.5;
    page.drawText("• Reincidência: Advertência por escrito.", { x: startX + 30, y: curY, size: 9, font });
    curY -= 13.5;
    page.drawText("• Persistência: Outras medidas disciplinares conforme a política interna da empresa e a legislação vigente. (CLT – art. 482)", { x: startX + 30, y: curY, size: 9, font });
    curY -= 15;

    curY -= 10;
    // Item 4
    page.drawText("4. Suporte Técnico", { x: startX, y: curY, size: 10, font });
    curY -= 15;
    const item4Text = "Em caso de problemas técnicos com o aplicativo, o colaborador deve comunicar imediatamente o setor responsável para que as devidas providências sejam tomadas e o ponto seja registrado manualmente, se necessário.";
    for (const l of wrapTextExact(item4Text, contentWidth - 15, font, 9)) {
        page.drawText(l, { x: startX + 15, y: curY, size: 9, font });
        curY -= 13.5;
    }

    curY -= 12;
    // Item 5
    page.drawText("5. Validade", { x: startX, y: curY, size: 10, font });
    curY -= 15;
    const item5Text = "Este termo tem validade a partir da data de assinatura e permanece vigente enquanto o colaborador estiver ativo na empresa ou enquanto o sistema de ponto via aplicativo estiver em uso.";
    for (const l of wrapTextExact(item5Text, contentWidth - 15, font, 9)) {
        page.drawText(l, { x: startX + 15, y: curY, size: 9, font });
        curY -= 13.5;
    }

    curY -= 22;
    page.drawText("Declaro que li, entendi e concordo com todas as disposições acima.", { x: startX + 35, y: curY, size: 9.5, font });

    curY -= 65;

    const admissionDateObj = new Date(employee.admissionDate);
    const day = admissionDateObj.getUTCDate();
    const monthName = getMonthNamePtBR(admissionDateObj.getUTCMonth());
    const year = admissionDateObj.getUTCFullYear();

    page.drawText(`PINHAIS, ${day} de ${monthName} de ${year}.`, { x: startX + 310, y: curY, size: 9, font });

    const sigLineStartX = startX;
    const sigLineEndX = startX + 270;
    const sigLineWidth = 270;
    const sigCenterX = sigLineStartX + (sigLineWidth / 2);

    let sigFontSize = 14;
    let nameSigWidth = fontSig.widthOfTextAtSize(employee.name, sigFontSize);
    if (nameSigWidth > sigLineWidth - 10) {
        sigFontSize = Math.max(9, ((sigLineWidth - 10) / nameSigWidth) * sigFontSize);
        nameSigWidth = fontSig.widthOfTextAtSize(employee.name, sigFontSize);
    }
    const sigTextX = sigCenterX - (nameSigWidth / 2);

    page.drawText(employee.name, {
        x: sigTextX,
        y: curY + 4,
        size: sigFontSize,
        font: fontSig,
        color: rgb(0.05, 0.15, 0.55)
    });

    page.drawLine({
        start: { x: sigLineStartX, y: curY + 2 },
        end: { x: sigLineEndX, y: curY + 2 },
        thickness: 0.5,
        color: rgb(0, 0, 0)
    });

    const labelText = "ASSINATURA DO TRABALHADOR";
    const labelWidth = font.widthOfTextAtSize(labelText, 7.5);
    page.drawText(labelText, { x: sigCenterX - (labelWidth / 2), y: curY - 10, size: 7.5, font });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

// 2. PERFECT PUBLICATION-QUALITY 3-PAGE ORDEM DE SERVIÇO PDF GENERATOR
export async function generateOrdemServicoPdfBytes(employeeId: string): Promise<Buffer> {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
            company: true,
            role: true,
            assignments: {
                where: { endDate: null },
                include: { posto: { include: { client: true } } }
            }
        }
    });

    if (!employee) throw new Error("Colaborador não encontrado.");

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");
    const fontSigPath = path.join(process.cwd(), "public", "fonts", "AlexBrush.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    const fontSigBytes = fs.readFileSync(fontSigPath);

    const font = await pdfDoc.embedFont(fontBytes);
    const fontSig = await pdfDoc.embedFont(fontSigBytes);

    const startX = 35;
    const endX = 560;
    const contentWidth = endX - startX; // 525

    const companyName = employee.company?.name || "SPOT SERVIÇOS FACILITIES LTDA";
    const companyCnpj = (employee.company as any)?.cnpj || "00.291.127/0001-07";
    const roleName = employee.role?.name || "AUXILIAR DE SERVIÇOS GERAIS";
    const roleCbo = (employee.role as any)?.cbo || "5143-20";
    const clientName = employee.assignments[0]?.posto?.client?.name || "AMERICA EMBALAGEM";

    const admissionDateObj = new Date(employee.admissionDate);
    const formattedAdmission = `${admissionDateObj.getUTCDate().toString().padStart(2, '0')}/${(admissionDateObj.getUTCMonth() + 1).toString().padStart(2, '0')}/${admissionDateObj.getUTCFullYear()}`;

    const roleObj = employee.role as any || {};
    const atividadeDescText = sanitizeActivityDescription(roleObj.atividadeDescricao || roleObj.ordemServicoText);
    const riscoQuimicoText = roleObj.riscoQuimico || "Água Sanitária, detergente líquido e Master Oxy Facility easy 2 dose.";
    const riscoAcidentesText = roleObj.riscoAcidentes || "Colisão e ou batida na condução da lavadora de piso a bateria ou projeção de objetos sobre os pés.";

    // Helper to draw crisp vector bullets
    const drawBullet = (p: PDFPage, x: number, y: number) => {
        p.drawCircle({ x, y: y + 3.5, size: 2, color: rgb(0, 0, 0) });
    };

    // ================= PAGE 1 =================
    const page1 = pdfDoc.addPage([595.28, 841.89]);
    let curY = 812;

    // Header Box (Height 90)
    const headerBoxHeight = 90;
    page1.drawRectangle({
        x: startX,
        y: curY - headerBoxHeight,
        width: contentWidth,
        height: headerBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1
    });

    // Vertical column dividers
    page1.drawLine({ start: { x: startX + 90, y: curY }, end: { x: startX + 90, y: curY - 45 }, thickness: 0.5, color: rgb(0, 0, 0) });
    page1.drawLine({ start: { x: startX + 420, y: curY }, end: { x: startX + 420, y: curY - 45 }, thickness: 0.5, color: rgb(0, 0, 0) });

    page1.drawText("ORDEM DE SERVIÇO", { x: startX + 175, y: curY - 20, size: 11, font });
    page1.drawText("SEGURANÇA E SAÚDE DO TRABALHO", { x: startX + 130, y: curY - 35, size: 10.5, font });

    page1.drawText("16/01/2023", { x: startX + 440, y: curY - 18, size: 8, font });
    page1.drawLine({ start: { x: startX + 420, y: curY - 24 }, end: { x: endX, y: curY - 24 }, thickness: 0.5, color: rgb(0, 0, 0) });
    page1.drawText("Versão: 003", { x: startX + 440, y: curY - 38, size: 8, font });

    page1.drawLine({ start: { x: startX, y: curY - 45 }, end: { x: endX, y: curY - 45 }, thickness: 0.5, color: rgb(0, 0, 0) });

    // Grid Row 1
    page1.drawText(`EMPRESA: ${companyName}`, { x: startX + 5, y: curY - 57, size: 8, font });
    page1.drawText(`CNPJ: ${companyCnpj}`, { x: startX + 270, y: curY - 57, size: 8, font });
    page1.drawText(`DATA DE ADMISSÃO: ${formattedAdmission}`, { x: startX + 395, y: curY - 57, size: 8, font });

    page1.drawLine({ start: { x: startX, y: curY - 61 }, end: { x: endX, y: curY - 61 }, thickness: 0.5, color: rgb(0, 0, 0) });

    // Grid Row 2
    page1.drawText(`NOME DO TRABALHADOR: ${employee.name}`, { x: startX + 5, y: curY - 72, size: 8, font });
    page1.drawText(`CPF: ${employee.cpf}`, { x: startX + 270, y: curY - 72, size: 8, font });
    page1.drawText("Nº Registro:", { x: startX + 395, y: curY - 72, size: 8, font });

    page1.drawLine({ start: { x: startX, y: curY - 76 }, end: { x: endX, y: curY - 76 }, thickness: 0.5, color: rgb(0, 0, 0) });

    // Grid Row 3
    page1.drawText(`SETOR: ${clientName}`, { x: startX + 5, y: curY - 86, size: 8, font });
    page1.drawText(`FUNÇÃO: ${roleName}`, { x: startX + 160, y: curY - 86, size: 8, font });
    page1.drawText(`CBO: ${roleCbo}`, { x: startX + 395, y: curY - 86, size: 8, font });

    curY -= (headerBoxHeight + 14);

    // Box 1: Intro legal box (Height: 110)
    const introText = "Pela presente Ordem de Serviço objetivamos informar os trabalhadores que executam suas atividades laborais nesse setor, conforme estabelece a NR-1, item 1.4.1, alinea “C” sobre as condições de segurança e saúde às quais estão expostos, como medida preventiva da Portaria nº 6.735/2020 de 10/03/2020 relativo as NRs-Normas Regulamentadoras: NR-9: Avaliação e Controle das Exposições Ocupacionais a Agentes Físicos, Químicos e Biológicos, bem como os procedimentos da Portaria MTb nº 3.214 de 08/06/1978 das NR-6: EPI - Equipamento de Proteção Individual e da NR-17: AET - Análise Ergonomica do Trabalho, de forma a padronizar comportamentos para prevenir acidentes e/ou doenças ocupacionais.";
    const introLines = wrapTextExact(introText, contentWidth - 16, font, 8.5);
    const box1Height = (introLines.length * 11) + 12;

    page1.drawRectangle({
        x: startX,
        y: curY - box1Height,
        width: contentWidth,
        height: box1Height,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    let bY = curY - 12;
    for (const l of introLines) {
        page1.drawText(l, { x: startX + 8, y: bY, size: 8.5, font });
        bY -= 11;
    }

    curY -= (box1Height + 14);

    // Box 2: Descrição da Atividade (Height: 140)
    page1.drawText("Descrição da Atividade", { x: startX + 205, y: curY, size: 9.5, font });
    curY -= 14;

    const descLines = wrapTextExact(atividadeDescText, contentWidth - 16, font, 8.5);
    const descBoxHeight = (descLines.length * 11) + 12;

    page1.drawRectangle({
        x: startX,
        y: curY - descBoxHeight,
        width: contentWidth,
        height: descBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    bY = curY - 12;
    for (const l of descLines) {
        page1.drawText(l, { x: startX + 8, y: bY, size: 8.5, font });
        bY -= 11;
    }

    curY -= (descBoxHeight + 14);

    // Box 3: Risco e Avaliação (Height: 120)
    page1.drawText("Risco e Avaliação", { x: startX + 215, y: curY, size: 9.5, font });
    curY -= 14;

    const risksBoxHeight = 115;
    page1.drawRectangle({
        x: startX,
        y: curY - risksBoxHeight,
        width: contentWidth,
        height: risksBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    bY = curY - 14;
    drawBullet(page1, startX + 12, bY);
    page1.drawText("Físico: Não evidenciado", { x: startX + 22, y: bY, size: 8.5, font });
    bY -= 20;

    drawBullet(page1, startX + 12, bY);
    page1.drawText(`Químico: ${riscoQuimicoText}`, { x: startX + 22, y: bY, size: 8.5, font });
    bY -= 20;

    drawBullet(page1, startX + 12, bY);
    page1.drawText("Biológico: Ausência de Fator de Risco.", { x: startX + 22, y: bY, size: 8.5, font });
    bY -= 20;

    drawBullet(page1, startX + 12, bY);
    page1.drawText("Ergonômicos: Ausência de Fator de Risco.", { x: startX + 22, y: bY, size: 8.5, font });
    bY -= 20;

    drawBullet(page1, startX + 12, bY);
    page1.drawText(`Acidentes: ${riscoAcidentesText}`, { x: startX + 22, y: bY, size: 8.5, font });

    curY -= (risksBoxHeight + 14);

    // Box 4: Equipamentos de Proteção Individual (EPI) (Height: 85)
    page1.drawText("Equipamentos de Proteção Individual (EPI) Necessários e/ou Utilizados", { x: startX + 105, y: curY, size: 9.5, font });
    curY -= 14;

    const epiBoxHeight = 75;
    page1.drawRectangle({
        x: startX,
        y: curY - epiBoxHeight,
        width: contentWidth,
        height: epiBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    bY = curY - 14;
    drawBullet(page1, startX + 12, bY);
    page1.drawText("Sapato de segurança", { x: startX + 22, y: bY, size: 8.5, font });
    drawBullet(page1, startX + 270, bY);
    page1.drawText("Máscara descartável PFF2-S", { x: startX + 280, y: bY, size: 8.5, font });
    bY -= 20;

    drawBullet(page1, startX + 12, bY);
    page1.drawText("Luva de Látex", { x: startX + 22, y: bY, size: 8.5, font });
    drawBullet(page1, startX + 270, bY);
    page1.drawText("Uniforme / Crachá", { x: startX + 280, y: bY, size: 8.5, font });
    bY -= 20;

    drawBullet(page1, startX + 12, bY);
    page1.drawText("Óculos de segurança", { x: startX + 22, y: bY, size: 8.5, font });

    curY -= (epiBoxHeight + 14);

    // Box 5: Medidas preventivas (Height: 115)
    page1.drawText("Medidas preventivas para os Riscos Ambientais", { x: startX + 150, y: curY, size: 9.5, font });
    curY -= 14;

    const medBoxHeight = 110;
    page1.drawRectangle({
        x: startX,
        y: curY - medBoxHeight,
        width: contentWidth,
        height: medBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    bY = curY - 14;
    drawBullet(page1, startX + 12, bY);
    page1.drawText("Uso correto de EPIs;", { x: startX + 22, y: bY, size: 8.5, font });
    bY -= 19;

    drawBullet(page1, startX + 12, bY);
    page1.drawText("Treinamento para execução das tarefas;", { x: startX + 22, y: bY, size: 8.5, font });
    bY -= 19;

    drawBullet(page1, startX + 12, bY);
    page1.drawText("Treinamento das máquinas e equipamentos;", { x: startX + 22, y: bY, size: 8.5, font });
    bY -= 19;

    drawBullet(page1, startX + 12, bY);
    page1.drawText("Correção das posturas de trabalho;", { x: startX + 22, y: bY, size: 8.5, font });
    bY -= 19;

    drawBullet(page1, startX + 12, bY);
    page1.drawText("Fazer pausa durante o expediente de trabalho conforme especificado pelo encarregado.", { x: startX + 22, y: bY, size: 8.5, font });

    page1.drawText("Página 1 de 3", { x: startX + 455, y: 25, size: 8.5, font });

    // ================= PAGE 2 =================
    const page2 = pdfDoc.addPage([595.28, 841.89]);
    curY = 812;

    // Box 1: Orientações de Segurança do Trabalho (Height: 350)
    page2.drawText("Orientações de Segurança do Trabalho", { x: startX + 175, y: curY, size: 9.5, font });
    curY -= 14;

    const orientacoes = [
        "Cumprir e respeitar o horário de expediente e intervalos, não se admitindo atrasos ou faltas injustificadas;",
        "Mantenha a área de trabalho organizada e limpa;",
        "Use seus EPIs apenas para a finalidade a que se destinam e mantenha-os sob sua guarda e conservação;",
        "Faça manutenção preventiva das máquinas e equipamentos e comunique qualquer alteração encontrada, para registro no livro de inspeção;",
        "Atenção e cuidado com as partes móveis da máquina, não manter contato direto com o equipamento em movimento;",
        "Verifique as condições gerais das máquinas e equipamentos antes de usá-las;",
        "Não improvise extensões elétricas, e nem conserte equipamentos elétricos defeituosos. (Chame o eletricista);",
        "Não consumir bebida alcoólica ou qualquer tipo de entorpecente, no local de trabalho e durante a jornada de trabalho;",
        "Não fumar no interior da empresa, comer, beber nos locais onde se manipulam substâncias químicas;",
        "Não utilizar do olfato para identificar produtos químicos;",
        "Não deixar os frascos dos produtos voláteis abertos;",
        "Submeter-se e comparecer ao departamento médico para exames periódicos sempre que solicitado;",
        "No relacionamento e comunicação com os demais colaboradores, clientes, fornecedores, diretoria, etc., seja pessoalmente, ou ao telefone, por e-mail, ou ainda por qualquer outro meio, devem ser observadas regras mínimas de sadia convivência social, gentileza mútua e respeito à pessoa humana, sendo terminantemente vedado o uso de palavras, gestos e expressões chulas e de baixo calão, além de brincadeiras que venham a constranger ou denegrir a imagem dos companheiros de trabalho;",
        "Comunique à empresa qualquer irregularidade que possa colocar você ou seus companheiros em risco potencial de acidentes;",
        "Vestir roupas adequadas e/ou uniformes, quando exigido, para transitar no interior da empresa ou de acordo com a tarefa que vai executar."
    ];

    let allOriParagraphs: string[][] = [];
    let totalLinesCount = 0;
    for (const item of orientacoes) {
        const wrapped = wrapTextExact(item, contentWidth - 26, font, 8.5);
        allOriParagraphs.push(wrapped);
        totalLinesCount += wrapped.length;
    }

    const oriBoxHeight = (totalLinesCount * 11) + (orientacoes.length * 4) + 10;
    page2.drawRectangle({
        x: startX,
        y: curY - oriBoxHeight,
        width: contentWidth,
        height: oriBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    bY = curY - 12;
    for (const paraLines of allOriParagraphs) {
        let firstLine = true;
        for (const l of paraLines) {
            if (firstLine) {
                drawBullet(page2, startX + 12, bY);
                page2.drawText(l, { x: startX + 22, y: bY, size: 8.5, font });
                firstLine = false;
            } else {
                page2.drawText(l, { x: startX + 22, y: bY, size: 8.5, font });
            }
            bY -= 11;
        }
        bY -= 3;
    }

    curY -= (oriBoxHeight + 16);

    // Box 2: Procedimentos em caso de Acidentes (Height: 70)
    page2.drawText("Procedimentos em caso de Acidentes", { x: startX + 180, y: curY, size: 9.5, font });
    curY -= 14;

    const acidentesBoxHeight = 65;
    page2.drawRectangle({
        x: startX,
        y: curY - acidentesBoxHeight,
        width: contentWidth,
        height: acidentesBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    const acidentesText = "Todo e qualquer acidente de trabalho, deverá ser comunicado para o superior imediato, na falta deste para o membro da CIPA e / ou ao DP, para que possa ser providenciada a emissão da CAT – Comunicação de Acidente do Trabalho, cujo prazo é de 24 horas.";
    bY = curY - 12;
    for (const l of wrapTextExact(acidentesText, contentWidth - 16, font, 8.5)) {
        page2.drawText(l, { x: startX + 8, y: bY, size: 8.5, font });
        bY -= 11;
    }
    bY -= 4;
    page2.drawText("Obs.: O acidente não comunicado, não será considerado para efeitos legais.", { x: startX + 8, y: bY, size: 8.5, font });

    curY -= (acidentesBoxHeight + 16);

    // Box 3: Direitos e Deveres (Parte 1) (Height: 220)
    page2.drawText("Direitos e Deveres", { x: startX + 220, y: curY, size: 9.5, font });
    curY -= 14;

    const direitosP1 = [
        "Segundo NR 1 (Portaria n° 3.214, de 08 de junho de 1978, com última alteração vigente dada pela Portaria SEPRT 915, de 30/07/2019).",
        "",
        "1.4.1 Cabe ao empregador:",
        "a) cumprir e fazer cumprir as disposições legais e regulamentares sobre segurança e saúde no trabalho;",
        "b) informar aos trabalhadores:",
        "I. os riscos ocupacionais existentes nos locais de trabalho;",
        "II. as medidas de prevenção adotadas pela empresa para eliminar ou reduzir tais riscos;",
        "III. os resultados dos exames médicos e de exames complementares de diagnóstico aos quais os próprios trabalhadores forem submetidos; e",
        "IV. os resultados das avaliações ambientais realizadas nos locais de trabalho.",
        "c) elaborar ordens de serviço sobre segurança e saúde no trabalho, dando ciência aos trabalhadores;",
        "d) permitir que representantes dos trabalhadores acompanhem a fiscalização dos preceitos legais e regulamentares sobre segurança e saúde no trabalho;",
        "e) determinar procedimentos que devem ser adotados em caso de acidente ou doença relacionada ao trabalho, incluindo a análise de suas causas;"
    ];

    let allDireitosLines: string[] = [];
    for (const item of direitosP1) {
        if (!item) {
            allDireitosLines.push("");
            continue;
        }
        allDireitosLines.push(...wrapTextExact(item, contentWidth - 16, font, 8.5));
    }

    const direitosBoxHeight = (allDireitosLines.length * 11) + 12;
    page2.drawRectangle({
        x: startX,
        y: curY - direitosBoxHeight,
        width: contentWidth,
        height: direitosBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    bY = curY - 12;
    for (const l of allDireitosLines) {
        if (!l) {
            bY -= 5;
            continue;
        }
        page2.drawText(l, { x: startX + 8, y: bY, size: 8.5, font });
        bY -= 11;
    }

    page2.drawText("Página 2 de 3", { x: startX + 455, y: 25, size: 8.5, font });

    // ================= PAGE 3 =================
    const page3 = pdfDoc.addPage([595.28, 841.89]);
    curY = 812;

    const direitosP2 = [
        "f) disponibilizar à Inspeção do Trabalho todas as informações relativas à segurança e saúde no trabalho; e",
        "g) implementar medidas de prevenção, ouvidos os trabalhadores, de acordo com a seguinte ordem de prioridade:",
        "I. eliminação dos fatores de risco;",
        "II. minimização e controle dos fatores de risco, com a adoção de medidas de proteção coletiva;",
        "III. minimização e controle dos fatores de risco, com a adoção de medidas administrativas ou de organização do trabalho; e",
        "IV. adoção de medidas de proteção individual.",
        "",
        "1.4.2 Cabe ao trabalhador:",
        "a) cumprir as disposições legais e regulamentares sobre segurança e saúde no trabalho, inclusive as ordens de serviço expedidas pelo empregador;",
        "b) submeter-se aos exames médicos previstos nas NR;",
        "c) colaborar com a organização na aplicação das NR; e",
        "d) usar o equipamento de proteção individual fornecido pelo empregador."
    ];

    let allDireitos2Lines: string[] = [];
    for (const item of direitosP2) {
        if (!item) {
            allDireitos2Lines.push("");
            continue;
        }
        allDireitos2Lines.push(...wrapTextExact(item, contentWidth - 16, font, 8.5));
    }

    const direitosP2BoxHeight = (allDireitos2Lines.length * 11) + 14;
    page3.drawRectangle({
        x: startX,
        y: curY - direitosP2BoxHeight,
        width: contentWidth,
        height: direitosP2BoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    bY = curY - 12;
    for (const l of allDireitos2Lines) {
        if (!l) {
            bY -= 5;
            continue;
        }
        page3.drawText(l, { x: startX + 8, y: bY, size: 8.5, font });
        bY -= 11;
    }

    curY -= (direitosP2BoxHeight + 25);

    // Box 2: Termo de Responsabilidade (Height: 180)
    page3.drawText("Termo de Responsabilidade", { x: startX + 195, y: curY, size: 9.5, font });
    curY -= 14;

    const termoText1 = `Declaro que recebi da ${companyName}, as orientações que fazem parte deste documento, bem como, cópia do mesmo, comprometendo-me a seguir as orientações nele contidas e reconhecendo serem elas indispensáveis à minha segurança e à de meus colegas de trabalho. Também afirmo ter recebido os EPIs de utilização obrigatória na minha função e comprometo-me a utilizá-los durante toda a minha jornada de trabalho, solicitando sua substituição sempre que necessário.`;
    const termoText2 = `De acordo com o Artigo 158, Parágrafo Único, da lei 6.514/77 e da Norma Regulamentadora NR 1, a recusa ao fiel cumprimento desta ORDEM DE SERVIÇO, no todo ou em parte, constituirá ATO FALTOSO sujeitando o funcionário às penalidades previstas na lei. Declaro que fui plenamente orientado quanto aos procedimentos de segurança do trabalho, estando ciente dos riscos decorrentes da atividade e das sanções disciplinares a que estou sujeito quanto ao seu descumprimento.`;

    const linesT1 = wrapTextExact(termoText1, contentWidth - 16, font, 8.5);
    const linesT2 = wrapTextExact(termoText2, contentWidth - 16, font, 8.5);
    const termoBoxHeight = ((linesT1.length + linesT2.length) * 11) + 20;

    page3.drawRectangle({
        x: startX,
        y: curY - termoBoxHeight,
        width: contentWidth,
        height: termoBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    bY = curY - 12;
    for (const l of linesT1) {
        page3.drawText(l, { x: startX + 8, y: bY, size: 8.5, font });
        bY -= 11;
    }
    bY -= 8;
    for (const l of linesT2) {
        page3.drawText(l, { x: startX + 8, y: bY, size: 8.5, font });
        bY -= 11;
    }

    curY -= (termoBoxHeight + 50);

    // City and Date
    const day = admissionDateObj.getUTCDate();
    const monthName = getMonthNamePtBR(admissionDateObj.getUTCMonth());
    const year = admissionDateObj.getUTCFullYear();
    page3.drawText(`CURITIBA PR, ${day} de ${monthName} de ${year}.`, { x: startX + 340, y: curY, size: 8.5, font });

    curY -= 60;

    // Signature Lines (RH/ADM and Employee)
    page3.drawLine({
        start: { x: startX + 20, y: curY },
        end: { x: startX + 220, y: curY },
        thickness: 0.5,
        color: rgb(0, 0, 0)
    });
    page3.drawText("RH/ADM", { x: startX + 105, y: curY - 14, size: 8.5, font });

    const sigEmpStartX = startX + 290;
    const sigEmpEndX = startX + 500;
    const sigEmpLineWidth = 210;
    const sigEmpCenterX = sigEmpStartX + (sigEmpLineWidth / 2);

    let sigEmpFontSize = 14;
    let nameEmpSigWidth = fontSig.widthOfTextAtSize(employee.name, sigEmpFontSize);
    if (nameEmpSigWidth > sigEmpLineWidth - 10) {
        sigEmpFontSize = Math.max(9, ((sigEmpLineWidth - 10) / nameEmpSigWidth) * sigEmpFontSize);
        nameEmpSigWidth = fontSig.widthOfTextAtSize(employee.name, sigEmpFontSize);
    }
    const sigEmpTextX = sigEmpCenterX - (nameEmpSigWidth / 2);

    page3.drawText(employee.name, {
        x: sigEmpTextX,
        y: curY + 4,
        size: sigEmpFontSize,
        font: fontSig,
        color: rgb(0.05, 0.15, 0.55)
    });

    page3.drawLine({
        start: { x: sigEmpStartX, y: curY },
        end: { x: sigEmpEndX, y: curY },
        thickness: 0.5,
        color: rgb(0, 0, 0)
    });

    const labelEmpText = "ASSINATURA DO TRABALHADOR";
    const labelEmpWidth = font.widthOfTextAtSize(labelEmpText, 8.5);
    page3.drawText(labelEmpText, { x: sigEmpCenterX - (labelEmpWidth / 2), y: curY - 14, size: 8.5, font });

    page3.drawText("Página 3 de 3", { x: startX + 455, y: 25, size: 8.5, font });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

// 3. Generate Complete Combined Kit de Admissão PDF (Merges OS + Termo Ponto + Ficha EPI)
export async function generateKitAdmissaoPdfBytes(employeeId: string): Promise<Buffer> {
    const mergedPdf = await PDFDocument.create();

    const [osBytes, termoBytes, epiBytes] = await Promise.all([
        generateOrdemServicoPdfBytes(employeeId),
        generateTermoPontoPdfBytes(employeeId),
        generateEpiPdfBytes(employeeId)
    ]);

    const pdfOS = await PDFDocument.load(osBytes);
    const pdfTermo = await PDFDocument.load(termoBytes);
    const pdfEPI = await PDFDocument.load(epiBytes);

    const osPages = await mergedPdf.copyPages(pdfOS, pdfOS.getPageIndices());
    osPages.forEach(p => mergedPdf.addPage(p));

    const termoPages = await mergedPdf.copyPages(pdfTermo, pdfTermo.getPageIndices());
    termoPages.forEach(p => mergedPdf.addPage(p));

    const epiPages = await mergedPdf.copyPages(pdfEPI, pdfEPI.getPageIndices());
    epiPages.forEach(p => mergedPdf.addPage(p));

    const mergedBytes = await mergedPdf.save();
    return Buffer.from(mergedBytes);
}

// 4. Send Kit de Admissão for Digital Signature via WhatsApp / Autentique
export async function sendKitAdmissaoToAutentique(employeeId: string) {
    try {
        const user = await getCurrentUser();
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId }
        });

        if (!employee) throw new Error("Colaborador não encontrado.");
        if (!employee.phone) throw new Error("Colaborador não possui telefone cadastrado.");

        const pdfBuffer = await generateKitAdmissaoPdfBytes(employeeId);
        const fileName = `Kit_Admissao_${employee.name.replace(/\s+/g, "_")}.pdf`;
        const docName = `Kit de Admissão (OS, Ponto e EPI) - ${employee.name}`;

        const result = await sendAutentiqueDocument(employee.name, employee.phone, pdfBuffer, fileName, docName);
        const docId = result?.createDocument?.id;

        // Atualizar extraFields do colaborador com kitAdmissaoProcess
        const extraFields = (employee.extraFields as Record<string, any>) || {};
        const kitProcess = extraFields.kitAdmissaoProcess || {};
        
        kitProcess.autentiqueDocId = docId || null;
        kitProcess.autentiqueStatus = 'ENVIADO';
        kitProcess.autentiqueSentAt = new Date().toISOString();
        kitProcess.autentiqueSentByUserId = user?.id || null;

        extraFields.kitAdmissaoProcess = kitProcess;

        await prisma.employee.update({
            where: { id: employeeId },
            data: { extraFields }
        });

        // Atualizar entregas de EPI pendentes deste colaborador para ENVIADO_AUTENTIQUE_<docId>
        if (docId) {
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
        }

        if (user) {
            await prisma.log.create({
                data: {
                    action: "AUTENTIQUE_KIT_ENVIADO",
                    details: `Kit de Admissão enviado para assinatura digital via WhatsApp para ${employee.name} (${employee.phone}). DocID: ${docId}`,
                    employeeId,
                    userId: user.id
                }
            });
        }

        revalidatePath("/admin/employees");
        revalidatePath(`/admin/employees/${employeeId}`);
        revalidatePath("/admin/epi");

        return {
            success: true,
            docId,
            message: `Kit de Admissão enviado com sucesso para ${employee.name} via WhatsApp!`
        };
    } catch (e: any) {
        console.error("Error sending Kit de Admissão to Autentique:", e);
        return { error: e.message || "Erro ao enviar Kit de Admissão para assinatura." };
    }
}

// 5. Upload / Save Ordem de Serviço from Word (.docx) or Text for a Role
export async function saveRoleOrdemServico(roleId: string, docxBuffer?: Buffer, textContent?: string, fileName?: string) {
    try {
        let textToSave = textContent || "";

        if (docxBuffer) {
            const parsed = await mammoth.extractRawText({ buffer: docxBuffer });
            textToSave = parsed.value || "";
        }

        await prisma.role.update({
            where: { id: roleId },
            data: {
                ordemServicoText: textToSave,
                ordemServicoName: fileName || "Ordem_Servico.docx"
            }
        });

        revalidatePath("/admin/roles");
        revalidatePath("/admin/employees");
        return { success: true, message: "Ordem de Serviço salva com sucesso para a função!" };
    } catch (e: any) {
        console.error("Error saving Ordem de Serviço for role:", e);
        return { error: e.message || "Erro ao salvar Ordem de Serviço." };
    }
}
