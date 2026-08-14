"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { OS_TEMPLATES, getOsTemplateByKey, OsTemplate } from "@/lib/os-templates";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";

export async function getAvailableOsTemplates(): Promise<OsTemplate[]> {
    return OS_TEMPLATES;
}

export async function applyTemplateToRole(roleId: string, templateKey: string) {
    const template = getOsTemplateByKey(templateKey);
    if (!template) throw new Error("Template não encontrado.");

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new Error("Cargo não encontrado.");

    const updated = await prisma.role.update({
        where: { id: roleId },
        data: {
            cbo: template.cbo || role.cbo,
            atividadeDescricao: template.atividadeDescricao,
            riscoFisico: template.riscoFisico,
            riscoQuimico: template.riscoQuimico,
            riscoBiologico: template.riscoBiologico,
            riscoErgonomico: template.riscoErgonomico,
            riscoAcidentes: template.riscoAcidentes,
            episNecessarios: template.episNecessarios,
            ordemServicoName: `Template_${template.key}.docx`
        }
    });

    revalidatePath("/admin/roles");
    return { success: true, role: updated, message: `Template "${template.name}" aplicado com sucesso!` };
}

export async function createRoleFromTemplate(templateKey: string, customName?: string) {
    const template = getOsTemplateByKey(templateKey);
    if (!template) throw new Error("Template não encontrado.");

    const roleName = customName?.trim() || template.name;

    // Verificar se já existe cargo com esse nome
    const existing = await prisma.role.findUnique({ where: { name: roleName } });
    if (existing) {
        throw new Error(`Já existe um cargo cadastrado com o nome "${roleName}".`);
    }

    const newRole = await prisma.role.create({
        data: {
            name: roleName,
            cbo: template.cbo,
            description: template.description,
            atividadeDescricao: template.atividadeDescricao,
            riscoFisico: template.riscoFisico,
            riscoQuimico: template.riscoQuimico,
            riscoBiologico: template.riscoBiologico,
            riscoErgonomico: template.riscoErgonomico,
            riscoAcidentes: template.riscoAcidentes,
            episNecessarios: template.episNecessarios,
            ordemServicoName: `Template_${template.key}.docx`
        }
    });

    revalidatePath("/admin/roles");
    return { success: true, role: newRole, message: `Cargo "${newRole.name}" criado com sucesso a partir do template!` };
}

/**
 * Extrai dados estruturados de um arquivo Word (.docx) enviado pelo usuário
 */
export async function parseDocxOrdemServico(fileBase64: string, fileName: string) {
    try {
        const matches = fileBase64.match(/^data:(.+?);base64,(.+)$/);
        const base64Data = matches ? matches[2] : fileBase64;
        const buffer = Buffer.from(base64Data, "base64");

        const mammoth = (await import("mammoth")).default;
        const parsed = await mammoth.extractRawText({ buffer });
        const rawText = parsed.value || "";

        if (!rawText || rawText.trim().length < 10) {
            return { error: "Não foi possível extrair texto do arquivo Word anexado." };
        }

        // Tentar extrair CBO
        const cboMatch = rawText.match(/CBO:?\s*(\d+[-\s]?\d*)/i);
        const cbo = cboMatch ? cboMatch[1].replace(/\s/g, "-") : "";

        // Tentar extrair Nome do Cargo
        const cargoMatch = rawText.match(/(?:FUNÇÃO|CARGO|SETOR):\s*([^\n\r]+)/i);
        const cargoName = cargoMatch ? cargoMatch[1].trim() : fileName.replace(/\.docx$/i, "").replace(/[_-]/g, " ");

        // Tentar usar IA para estruturar os campos com precisão cirúrgica
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            try {
                const prompt = `Você é um engenheiro de segurança do trabalho especialista em Normas Regulamentadoras brasileiras (NR-1, NR-6, NR-9, NR-17).
Analise o seguinte texto extraído de uma Ordem de Serviço em Word e extraia os campos em formato JSON estrito:
Texto:
"""
${rawText.slice(0, 4000)}
"""

Responda APENAS em formato JSON válido com as seguintes chaves:
{
  "name": "Nome do Cargo",
  "cbo": "5143-20",
  "description": "Breve descrição",
  "atividadeDescricao": "Texto detalhado das atividades realizadas",
  "riscoFisico": "Riscos físicos identificados ou 'Não identificado'",
  "riscoQuimico": "Produtos químicos utilizados (ex: água sanitária, detergente)",
  "riscoBiologico": "Riscos biológicos ou 'Não identificado'",
  "riscoErgonomico": "Riscos ergonômicos (postura, peso, movimentos)",
  "riscoAcidentes": "Riscos de acidentes (quedas, choques, cortes)",
  "episNecessarios": "Lista de EPIs obrigatórios separados por vírgula"
}`;

                const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });

                if (aiRes.ok) {
                    const aiJson = await aiRes.json();
                    const text = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
                        const extracted = JSON.parse(cleanJson);
                        return {
                            success: true,
                            extracted: {
                                ...extracted,
                                rawText,
                                fileName
                            }
                        };
                    }
                }
            } catch (err) {
                console.error("Gemini parse error:", err);
            }
        }

        // Fallback heurístico simples caso a IA não responda
        return {
            success: true,
            extracted: {
                name: cargoName,
                cbo: cbo,
                description: "Importado via Word .docx",
                atividadeDescricao: rawText.slice(0, 500),
                riscoFisico: "Ruído e umidade",
                riscoQuimico: "Produtos de limpeza geral",
                riscoBiologico: "Agentes biológicos em sanitários",
                riscoErgonomico: "Postura inadequada e movimentos repetitivos",
                riscoAcidentes: "Quedas em piso escorregadio e projeção de produtos",
                episNecessarios: "Sapato de segurança, Luva de látex, Óculos de segurança e Uniforme",
                rawText,
                fileName
            }
        };
    } catch (e: any) {
        console.error("Error parsing Word .docx:", e);
        return { error: e.message || "Erro ao processar arquivo Word." };
    }
}

// Helpers para layout PDF de Ordem de Serviço
function wrapTextExact(text: string, maxWidth: number, font: any, fontSize: number): string[] {
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
        if (currentLine) lines.push(currentLine);
    }
    return lines;
}

export async function generateRolePreviewPdfBase64(roleId: string): Promise<string> {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new Error("Cargo não encontrado.");

    return await generateOrdemServicoPdfFromData({
        roleName: role.name,
        cbo: role.cbo || "5143-20",
        atividadeDescricao: role.atividadeDescricao || role.ordemServicoText || "Atividades operacionais conforme normas da empresa.",
        riscoQuimico: role.riscoQuimico || "Produtos químicos de higienização e limpeza.",
        riscoAcidentes: role.riscoAcidentes || "Quedas de mesmo nível em piso molhado.",
        episNecessarios: role.episNecessarios || "Sapato antiderrapante, Luva impermeável, Óculos de segurança e Uniforme."
    });
}

export async function generateTemplatePreviewPdfBase64(templateKey: string): Promise<string> {
    const template = getOsTemplateByKey(templateKey);
    if (!template) throw new Error("Template não encontrado.");

    return await generateOrdemServicoPdfFromData({
        roleName: template.name,
        cbo: template.cbo,
        atividadeDescricao: template.atividadeDescricao,
        riscoQuimico: template.riscoQuimico,
        riscoAcidentes: template.riscoAcidentes,
        episNecessarios: template.episNecessarios
    });
}

async function generateOrdemServicoPdfFromData(data: {
    roleName: string;
    cbo: string;
    atividadeDescricao: string;
    riscoQuimico: string;
    riscoAcidentes: string;
    episNecessarios: string;
}): Promise<string> {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    const font = await pdfDoc.embedFont(fontBytes);

    const startX = 35;
    const endX = 560;
    const contentWidth = endX - startX; // 525

    const drawBullet = (p: any, x: number, y: number) => {
        p.drawCircle({ x, y: y + 3.5, size: 2, color: rgb(0, 0, 0) });
    };

    // ================= PAGE 1 =================
    const page1 = pdfDoc.addPage([595.28, 841.89]);
    let curY = 812;

    // Header Box
    const headerBoxHeight = 90;
    page1.drawRectangle({
        x: startX,
        y: curY - headerBoxHeight,
        width: contentWidth,
        height: headerBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1
    });

    page1.drawLine({ start: { x: startX + 90, y: curY }, end: { x: startX + 90, y: curY - 45 }, thickness: 0.5, color: rgb(0, 0, 0) });
    page1.drawLine({ start: { x: startX + 420, y: curY }, end: { x: startX + 420, y: curY - 45 }, thickness: 0.5, color: rgb(0, 0, 0) });

    page1.drawText("ORDEM DE SERVIÇO", { x: startX + 175, y: curY - 20, size: 11, font });
    page1.drawText("SEGURANÇA E SAÚDE DO TRABALHO", { x: startX + 130, y: curY - 35, size: 10.5, font });
    page1.drawText("NR-1 / NR-6 / NR-9", { x: startX + 435, y: curY - 20, size: 8, font });
    page1.drawText("Versão: 004", { x: startX + 440, y: curY - 35, size: 8, font });

    page1.drawLine({ start: { x: startX, y: curY - 45 }, end: { x: endX, y: curY - 45 }, thickness: 0.5, color: rgb(0, 0, 0) });

    page1.drawText(`EMPRESA: WORKFORCE FACILITIES LTDA`, { x: startX + 5, y: curY - 57, size: 8, font });
    page1.drawText(`CNPJ: 00.000.000/0001-00`, { x: startX + 270, y: curY - 57, size: 8, font });
    page1.drawText(`DATA: ${new Date().toLocaleDateString('pt-BR')}`, { x: startX + 395, y: curY - 57, size: 8, font });

    page1.drawLine({ start: { x: startX, y: curY - 61 }, end: { x: endX, y: curY - 61 }, thickness: 0.5, color: rgb(0, 0, 0) });

    page1.drawText(`NOME DO TRABALHADOR: [MODELO / TEMPLATE OFICIAL]`, { x: startX + 5, y: curY - 72, size: 8, font });
    page1.drawText(`CPF: 000.000.000-00`, { x: startX + 270, y: curY - 72, size: 8, font });
    page1.drawText("Nº Reg: 0001", { x: startX + 395, y: curY - 72, size: 8, font });

    page1.drawLine({ start: { x: startX, y: curY - 76 }, end: { x: endX, y: curY - 76 }, thickness: 0.5, color: rgb(0, 0, 0) });

    page1.drawText(`SETOR: OPERACIONAL`, { x: startX + 5, y: curY - 86, size: 8, font });
    page1.drawText(`FUNÇÃO: ${data.roleName.toUpperCase()}`, { x: startX + 160, y: curY - 86, size: 8, font });
    page1.drawText(`CBO: ${data.cbo}`, { x: startX + 395, y: curY - 86, size: 8, font });

    curY -= (headerBoxHeight + 14);

    // Box 1: Intro legal box
    const introText = "Pela presente Ordem de Serviço objetivamos informar os trabalhadores que executam suas atividades laborais nesse setor, conforme estabelece a NR-1, item 1.4.1, alínea 'C' sobre as condições de segurança e saúde às quais estão expostos, como medida preventiva da Portaria nº 6.735/2020 relativo às NRs: NR-9 (Exposições Ocupacionais), NR-6 (EPI) e NR-17 (Ergonomia), prevenindo acidentes e doenças ocupacionais.";
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

    // Box 2: Descrição da Atividade
    page1.drawText("Descrição da Atividade", { x: startX + 205, y: curY, size: 9.5, font });
    curY -= 14;

    const descLines = wrapTextExact(data.atividadeDescricao, contentWidth - 16, font, 8.5);
    const descBoxHeight = Math.min((descLines.length * 11) + 12, 160);

    page1.drawRectangle({
        x: startX,
        y: curY - descBoxHeight,
        width: contentWidth,
        height: descBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    bY = curY - 12;
    for (const l of descLines.slice(0, 13)) {
        page1.drawText(l, { x: startX + 8, y: bY, size: 8.5, font });
        bY -= 11;
    }

    curY -= (descBoxHeight + 14);

    // Box 3: Riscos Ocupacionais
    page1.drawText("Risco e Avaliação", { x: startX + 225, y: curY, size: 9.5, font });
    curY -= 14;

    const riskBoxHeight = 110;
    page1.drawRectangle({
        x: startX,
        y: curY - riskBoxHeight,
        width: contentWidth,
        height: riskBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    bY = curY - 14;
    drawBullet(page1, startX + 12, bY);
    page1.drawText(`Químico: ${data.riscoQuimico}`, { x: startX + 22, y: bY, size: 8.5, font });
    bY -= 20;

    drawBullet(page1, startX + 12, bY);
    page1.drawText(`Acidentes: ${data.riscoAcidentes}`, { x: startX + 22, y: bY, size: 8.5, font });
    bY -= 20;

    drawBullet(page1, startX + 12, bY);
    page1.drawText("Ergonômico: Postura inadequada, levantamento de peso e movimentos repetitivos.", { x: startX + 22, y: bY, size: 8.5, font });
    bY -= 20;

    drawBullet(page1, startX + 12, bY);
    page1.drawText("Biológico: Vírus e bactérias provenientes de higienização de ambientes comuns.", { x: startX + 22, y: bY, size: 8.5, font });

    curY -= (riskBoxHeight + 14);

    // Box 4: EPIs
    page1.drawText("EPI - Equipamento de Proteção Individual de uso obrigatório", { x: startX + 115, y: curY, size: 9.5, font });
    curY -= 14;

    const epiBoxHeight = 65;
    page1.drawRectangle({
        x: startX,
        y: curY - epiBoxHeight,
        width: contentWidth,
        height: epiBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    const epiLines = wrapTextExact(data.episNecessarios, contentWidth - 24, font, 8.5);
    bY = curY - 14;
    for (const el of epiLines) {
        drawBullet(page1, startX + 12, bY);
        page1.drawText(el, { x: startX + 22, y: bY, size: 8.5, font });
        bY -= 14;
    }

    page1.drawText("Página 1 de 2 - Ordem de Serviço Oficial", { x: startX + 380, y: 25, size: 8, font });

    // ================= PAGE 2 =================
    const page2 = pdfDoc.addPage([595.28, 841.89]);
    curY = 812;

    page2.drawText("Orientações de Segurança do Trabalho e Termo de Ciência", { x: startX + 130, y: curY, size: 9.5, font });
    curY -= 16;

    const orientacoes = [
        "Cumprir e respeitar o horário de expediente e intervalos;",
        "Mantenha a área de trabalho organizada e limpa;",
        "Use seus EPIs apenas para a finalidade a que se destinam e mantenha-os sob sua guarda e conservação;",
        "Não improvise extensões elétricas e não conserte equipamentos elétricos defeituosos;",
        "Não consumir bebida alcoólica ou qualquer entorpecente no local de trabalho;",
        "Não deixar frascos de produtos químicos abertos ou sem identificação;",
        "Vestir roupas adequadas e uniformes exigidos para a tarefa;",
        "Comunicar imediatamente qualquer acidente ou irregularidade ao encarregado."
    ];

    const oriBoxHeight = 180;
    page2.drawRectangle({
        x: startX,
        y: curY - oriBoxHeight,
        width: contentWidth,
        height: oriBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    bY = curY - 14;
    for (const item of orientacoes) {
        drawBullet(page2, startX + 12, bY);
        page2.drawText(item, { x: startX + 22, y: bY, size: 8.5, font });
        bY -= 19;
    }

    curY -= (oriBoxHeight + 20);

    // Termo de Compromisso e Assinatura
    page2.drawText("Termo de Recebimento e Compromisso", { x: startX + 175, y: curY, size: 9.5, font });
    curY -= 14;

    const termoBoxHeight = 130;
    page2.drawRectangle({
        x: startX,
        y: curY - termoBoxHeight,
        width: contentWidth,
        height: termoBoxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5
    });

    const termoText = "De acordo com o Artigo 158, Parágrafo Único, da Lei 6.514/77 e da Norma Regulamentadora NR 1, a recusa ao fiel cumprimento desta ORDEM DE SERVIÇO constituirá ATO FALTOSO sujeitando o funcionário às penalidades previstas na lei. Declaro que fui orientado quanto aos procedimentos de segurança do trabalho, estando ciente dos riscos e das sanções disciplinares.";
    const termoLines = wrapTextExact(termoText, contentWidth - 20, font, 8.5);

    bY = curY - 14;
    for (const tl of termoLines) {
        page2.drawText(tl, { x: startX + 10, y: bY, size: 8.5, font });
        bY -= 12;
    }

    // Linha de Assinatura
    page2.drawLine({ start: { x: startX + 100, y: curY - 95 }, end: { x: endX - 100, y: curY - 95 }, thickness: 0.5, color: rgb(0, 0, 0) });
    page2.drawText("Assinatura do Colaborador", { x: startX + 195, y: curY - 110, size: 9, font });

    page2.drawText("Página 2 de 2 - Ordem de Serviço Oficial", { x: startX + 380, y: 25, size: 8, font });

    const pdfBytes = await pdfDoc.save();
    return `data:application/pdf;base64,${Buffer.from(pdfBytes).toString("base64")}`;
}
