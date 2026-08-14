"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
    DEFAULT_DISMISSAL_TEMPLATES,
    DismissalTemplateItem,
    populateDismissalNoticeText,
    formatPortugueseDateExtended
} from "@/lib/dismissal-templates";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { sendAutentiqueDocument } from "@/actions/epi";
import { format } from "date-fns";

/**
 * Retorna todos os templates disponíveis (do banco de dados ou os padrões)
 */
export async function getDismissalTemplates(): Promise<DismissalTemplateItem[]> {
    try {
        const dbTemplates = await prisma.dismissalTemplate.findMany({
            orderBy: { createdAt: 'asc' }
        });

        if (dbTemplates.length === 0) {
            // Seed defaults na primeira vez
            const seeded = [];
            for (const t of DEFAULT_DISMISSAL_TEMPLATES) {
                const created = await prisma.dismissalTemplate.create({
                    data: {
                        key: t.key,
                        title: t.title,
                        category: t.category,
                        description: t.description,
                        bodyText: t.bodyText,
                        isDefault: true
                    }
                });
                seeded.push({
                    id: created.id,
                    key: created.key,
                    title: created.title,
                    category: created.category as any,
                    description: created.description || '',
                    bodyText: created.bodyText,
                    isDefault: created.isDefault
                });
            }
            return seeded;
        }

        return dbTemplates.map(t => ({
            id: t.id,
            key: t.key,
            title: t.title,
            category: t.category as any,
            description: t.description || '',
            bodyText: t.bodyText,
            isDefault: t.isDefault
        }));
    } catch (e: any) {
        console.error("Error in getDismissalTemplates:", e);
        return DEFAULT_DISMISSAL_TEMPLATES;
    }
}

/**
 * Cria ou edita um template de aviso
 */
export async function saveDismissalTemplate(data: {
    id?: string;
    key?: string;
    title: string;
    category: 'DISPENSA_COM_AVISO' | 'DISPENSA_SEM_AVISO' | 'TERMINO_EXP_ANTECIPADO' | 'TERMINO_EXP_PRAZO' | 'OUTROS';
    description?: string;
    bodyText: string;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const key = data.key || `custom_${Date.now()}`;

    if (data.id) {
        await prisma.dismissalTemplate.update({
            where: { id: data.id },
            data: {
                title: data.title,
                category: data.category,
                description: data.description,
                bodyText: data.bodyText
            }
        });
    } else {
        await prisma.dismissalTemplate.create({
            data: {
                key,
                title: data.title,
                category: data.category,
                description: data.description,
                bodyText: data.bodyText,
                isDefault: false
            }
        });
    }

    revalidatePath("/admin/dismissal-monitor");
    return { success: true };
}

/**
 * Restaura um template padrão ao texto original
 */
export async function resetDismissalTemplateToDefault(key: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const defaultT = DEFAULT_DISMISSAL_TEMPLATES.find(t => t.key === key);
    if (!defaultT) throw new Error("Template padrão não encontrado.");

    await prisma.dismissalTemplate.upsert({
        where: { key },
        create: {
            key: defaultT.key,
            title: defaultT.title,
            category: defaultT.category,
            description: defaultT.description,
            bodyText: defaultT.bodyText,
            isDefault: true
        },
        update: {
            title: defaultT.title,
            category: defaultT.category,
            description: defaultT.description,
            bodyText: defaultT.bodyText,
            isDefault: true
        }
    });

    revalidatePath("/admin/dismissal-monitor");
    return { success: true };
}

/**
 * Exclui um template customizado
 */
export async function deleteDismissalTemplate(id: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const t = await prisma.dismissalTemplate.findUnique({ where: { id } });
    if (!t) throw new Error("Template não encontrado.");
    if (t.isDefault) throw new Error("Modelos padrão do sistema não podem ser excluídos, apenas editados.");

    await prisma.dismissalTemplate.delete({ where: { id } });
    revalidatePath("/admin/dismissal-monitor");
    return { success: true };
}

/**
 * Busca dados completos de colaborador, empresa, posto e processo de desligamento
 */
export async function getDismissalNoticeContext(employeeId: string, customOverrides?: any) {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
            company: true,
            role: true,
            assignments: {
                include: {
                    posto: {
                        include: {
                            client: {
                                include: { company: true }
                            }
                        }
                    }
                },
                orderBy: { startDate: 'desc' }
            }
        }
    });

    if (!employee) throw new Error("Colaborador não encontrado.");

    const extraFields = (employee.extraFields as Record<string, any>) || {};
    const proc = extraFields.dismissalProcess || {};
    const activeAssignment = employee.assignments[0];

    // Determinar Empresa Empregadora
    const empresa = employee.company || activeAssignment?.posto?.client?.company || {
        name: "JVS FACILITIES LTDA",
        cnpj: "48.872.544/0001-70",
        address: "Pinhais - PR"
    };

    // Endereço / Cidade
    let cidadeUf = "PINHAIS - PR";
    if (empresa.address) {
        const parts = empresa.address.split("-");
        if (parts.length >= 2) {
            cidadeUf = `${parts[parts.length - 2].trim()}-${parts[parts.length - 1].trim()}`.toUpperCase();
        } else {
            cidadeUf = empresa.address.toUpperCase();
        }
    }

    const subType = customOverrides?.dismissalSubType || proc.dismissalSubType || 'DISPENSA_COM_AVISO';
    const reductionType = customOverrides?.reductionType || proc.reductionType || 'NENHUMA';

    // Determinar Template Key
    let templateKey = 'AVISO_TRABALHADO';
    if (subType === 'DISPENSA_SEM_AVISO' || proc.noticeType === 'INDENIZADO') {
        templateKey = 'AVISO_INDENIZADO';
    } else if (subType === 'TERMINO_EXP_ANTECIPADO_EMPRESA' || subType === 'TERMINO_EXP_ANTECIPADO_COLABORADOR' || subType === 'TERMINO_EXP_ANTECIPADO') {
        templateKey = 'TERMINO_EXP_ANTECIPADO';
    } else if (subType === 'TERMINO_EXP_PRAZO_EMPRESA' || subType === 'TERMINO_EXP_PRAZO_COLABORADOR' || subType === 'TERMINO_EXP_PRAZO') {
        templateKey = 'TERMINO_EXP_PRAZO';
    } else {
        templateKey = 'AVISO_TRABALHADO';
    }

    // Datas
    const dataAdmissao = employee.admissionDate ? format(new Date(employee.admissionDate), "dd/MM/yyyy") : "-";
    const dataInicioContrato = extraFields.experience1StartDate ? format(new Date(extraFields.experience1StartDate), "dd/MM/yyyy") : dataAdmissao;
    const dataFimContrato = extraFields.experience2EndDate ? format(new Date(extraFields.experience2EndDate), "dd/MM/yyyy") : (extraFields.experience1EndDate ? format(new Date(extraFields.experience1EndDate), "dd/MM/yyyy") : "-");
    const dataInicioAviso = proc.startDate ? format(new Date(proc.startDate), "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy");
    const dataFimAviso = proc.endDate ? format(new Date(proc.endDate), "dd/MM/yyyy") : "-";

    return {
        employee,
        empresa,
        templateKey,
        context: {
            empresaNome: empresa.name || "JVS FACILITIES LTDA",
            empresaCnpj: empresa.cnpj || "48.872.544/0001-70",
            colaboradorNome: employee.name,
            cpf: employee.cpf,
            ctpsNumero: extraFields.ctpsNumber || extraFields.ctps || "-",
            ctpsSerie: extraFields.ctpsSerie || extraFields.serie || "-",
            pisNumero: extraFields.pis || "-",
            cargo: employee.role?.name || "-",
            dataAdmissao,
            qtdDias: "30",
            optDuasHoras: reductionType === 'DUAS_HORAS',
            optSeteDias: reductionType === 'SETE_DIAS',
            dataInicioContrato,
            dataFimContrato,
            dataInicioAviso,
            dataFimAviso,
            cidadeUf,
            dataExtenso: formatPortugueseDateExtended(new Date())
        }
    };
}

/**
 * Gera o arquivo PDF da Notificação de Aviso ou Rescisão
 */
export async function generateDismissalNoticePdfBytes(employeeId: string, customOverrides?: any): Promise<Buffer> {
    const { employee, empresa, templateKey, context } = await getDismissalNoticeContext(employeeId, customOverrides);

    // Buscar o template desejado
    const targetKey = customOverrides?.templateKey || templateKey;
    const templates = await getDismissalTemplates();
    const template = templates.find(t => t.key === targetKey) || DEFAULT_DISMISSAL_TEMPLATES.find(t => t.key === targetKey) || DEFAULT_DISMISSAL_TEMPLATES[0];

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");
    let customFont: any;
    if (fs.existsSync(fontPath)) {
        const fontBytes = fs.readFileSync(fontPath);
        customFont = await pdfDoc.embedFont(fontBytes);
    }

    const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
    const { width, height } = page.getSize();

    const marginX = 55;
    let cursorY = height - 60;

    const drawText = (text: string, x: number, y: number, size: number = 10, bold: boolean = false, align: 'left' | 'center' | 'right' = 'left') => {
        const textWidth = customFont.widthOfTextAtSize(text, size);
        let targetX = x;
        if (align === 'center') {
            targetX = (width - textWidth) / 2;
        } else if (align === 'right') {
            targetX = width - marginX - textWidth;
        }

        page.drawText(text, {
            x: targetX,
            y,
            size,
            font: customFont,
            color: rgb(0.1, 0.1, 0.1)
        });
    };

    const drawParagraph = (text: string, startY: number, fontSize: number = 9.5, lineHeight: number = 15, maxWidth: number = width - (marginX * 2)) => {
        const words = text.split(" ");
        let currentLine = "";
        let y = startY;

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = customFont.widthOfTextAtSize(testLine, fontSize);
            if (testWidth > maxWidth) {
                drawText(currentLine, marginX, y, fontSize);
                currentLine = word;
                y -= lineHeight;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) {
            drawText(currentLine, marginX, y, fontSize);
            y -= lineHeight;
        }
        return y;
    };

    // 1. TÍTULO DO DOCUMENTO
    if (targetKey === 'AVISO_TRABALHADO') {
        drawText("AVISO PRÉVIO DO EMPREGADOR PARA DISPENSA DO EMPREGADO", marginX, cursorY, 11, true, 'center');
        cursorY -= 40;

        // Empresa Header
        drawText(context.empresaNome, marginX, cursorY, 10, true);
        cursorY -= 14;
        drawText(`CNPJ: ${context.empresaCnpj}`, marginX, cursorY, 10);
        cursorY -= 28;

        // Colaborador Info
        drawText("Ao", marginX, cursorY, 10);
        cursorY -= 14;
        drawText(`Sr(a). ${context.colaboradorNome}`, marginX, cursorY, 10, true);
        cursorY -= 14;
        drawText(`C.T.P.S.: ${context.ctpsNumero}   Série: ${context.ctpsSerie}`, marginX, cursorY, 9.5);
        cursorY -= 14;
        drawText(`PIS: ${context.pisNumero}`, marginX, cursorY, 9.5);
        cursorY -= 14;
        drawText(`Data admissão: ${context.dataAdmissao}`, marginX, cursorY, 9.5);
        cursorY -= 35;

        // Corpo
        cursorY = drawParagraph(
            `Pelo presente notificamos que a ${context.qtdDias} dias contados após a data da entrega deste, não mais serão utilizados os seus serviços pela nossa empresa, e por isso vimos avisá-lo, nos termos e para os efeitos do disposto no art. 487 - itens - I e II - Cap.VI - Título IV, do Decreto Lei nº 5.452, de 1º de maio de 1943 da CONSOLIDAÇÃO DAS LEIS DO TRABALHO.`,
            cursorY,
            9.5,
            14.5
        );
        cursorY -= 10;

        cursorY = drawParagraph(
            `Até o término do aviso prévio, V.Sª terá uma redução no seu horário de trabalho, sem prejuízo de seu salário integral, sendo-lhe facultada, de acordo com a CONSOLIDAÇÃO DAS LEIS DO TRABALHO, artigo 488, parágrafo único, a opção por uma das seguintes alternativas:`,
            cursorY,
            9.5,
            14.5
        );
        cursorY -= 15;

        // Opções de redução
        const opt1 = context.optDuasHoras ? "( X )" : "(   )";
        const opt2 = context.optSeteDias ? "( X )" : "(   )";
        drawText(`${opt1} redução de 02 (duas) horas diárias em seu horário normal de trabalho; ou`, marginX, cursorY, 9.5);
        cursorY -= 20;
        drawText(`${opt2} redução de 07 (sete) dias corridos.`, marginX, cursorY, 9.5);
        cursorY -= 40;

        drawText('Solicitamos a devolução do presente com o seu "ciente".', marginX, cursorY, 9.5);
        cursorY -= 40;

        drawText(`${context.cidadeUf}, ${context.dataExtenso}.`, marginX, cursorY, 9.5);
        cursorY -= 70;

        // Linhas de Assinatura
        const colWidth = 200;
        page.drawLine({
            start: { x: marginX, y: cursorY },
            end: { x: marginX + colWidth, y: cursorY },
            thickness: 1,
            color: rgb(0.2, 0.2, 0.2)
        });
        page.drawLine({
            start: { x: width - marginX - colWidth, y: cursorY },
            end: { x: width - marginX, y: cursorY },
            thickness: 1,
            color: rgb(0.2, 0.2, 0.2)
        });
        cursorY -= 14;

        drawText("Empregador", marginX + 65, cursorY, 9);
        drawText("Empregado", width - marginX - colWidth + 70, cursorY, 9);
        cursorY -= 45;

        page.drawLine({
            start: { x: width - marginX - colWidth, y: cursorY },
            end: { x: width - marginX, y: cursorY },
            thickness: 1,
            color: rgb(0.2, 0.2, 0.2)
        });
        cursorY -= 14;
        drawText("Responsável (Quando Menor)", width - marginX - colWidth + 30, cursorY, 8.5);

    } else if (targetKey === 'AVISO_INDENIZADO') {
        drawText("AVISO INDENIZADO DO EMPREGADOR PARA DISPENSA DO EMPREGADO", marginX, cursorY, 11, true, 'center');
        cursorY -= 40;

        // Empresa Header
        drawText(context.empresaNome, marginX, cursorY, 10, true);
        cursorY -= 14;
        drawText(`CNPJ: ${context.empresaCnpj}`, marginX, cursorY, 10);
        cursorY -= 28;

        // Colaborador Info
        drawText("À", marginX, cursorY, 10);
        cursorY -= 14;
        drawText(`Sr(a). ${context.colaboradorNome}`, marginX, cursorY, 10, true);
        cursorY -= 14;
        drawText(`C.T.P.S.: ${context.ctpsNumero}   Série: ${context.ctpsSerie}`, marginX, cursorY, 9.5);
        cursorY -= 14;
        drawText(`PIS: ${context.pisNumero}`, marginX, cursorY, 9.5);
        cursorY -= 14;
        drawText(`Data admissão: ${context.dataAdmissao}`, marginX, cursorY, 9.5);
        cursorY -= 40;

        // Corpo
        cursorY = drawParagraph(
            `Pelo presente notificamos que após a data da entrega deste, não mais serão utilizados os seus serviços pela nossa empresa, e por isso vimos avisá-lo, nos termos e para os efeitos do disposto no art. 487 - itens - I e II - Cap.VI - Título IV, do Decreto Lei nº 5.452, de 1º de maio de 1943 da CONSOLIDAÇÃO DAS LEIS DO TRABALHO.`,
            cursorY,
            9.5,
            15
        );
        cursorY -= 30;

        drawText('Solicitamos a devolução do presente com o seu "ciente".', marginX, cursorY, 9.5);
        cursorY -= 40;

        drawText(`${context.cidadeUf}, ${context.dataExtenso}.`, marginX, cursorY, 9.5);
        cursorY -= 70;

        // Linhas de Assinatura
        const colWidth = 200;
        page.drawLine({
            start: { x: marginX, y: cursorY },
            end: { x: marginX + colWidth, y: cursorY },
            thickness: 1,
            color: rgb(0.2, 0.2, 0.2)
        });
        page.drawLine({
            start: { x: width - marginX - colWidth, y: cursorY },
            end: { x: width - marginX, y: cursorY },
            thickness: 1,
            color: rgb(0.2, 0.2, 0.2)
        });
        cursorY -= 14;

        drawText("Empregador", marginX + 65, cursorY, 9);
        drawText("Empregado", width - marginX - colWidth + 70, cursorY, 9);
        cursorY -= 45;

        page.drawLine({
            start: { x: width - marginX - colWidth, y: cursorY },
            end: { x: width - marginX, y: cursorY },
            thickness: 1,
            color: rgb(0.2, 0.2, 0.2)
        });
        cursorY -= 14;
        drawText("Responsável (Quando Menor)", width - marginX - colWidth + 30, cursorY, 8.5);

    } else {
        // TERMINO DE EXPERIENCIA (ANTECIPADO OU NO PRAZO)
        const isAntecipado = targetKey === 'TERMINO_EXP_ANTECIPADO';
        const docTitle = isAntecipado 
            ? "DISPENSA POR TÉRMINO ANTECIPADO DE CONTRATO DE EXPERIÊNCIA" 
            : "DISPENSA POR TÉRMINO DE CONTRATO DE EXPERIÊNCIA";

        drawText(docTitle, marginX, cursorY, 11, true, 'center');
        cursorY -= 25;

        drawText("==================================================================", marginX, cursorY, 9.5, false, 'center');
        cursorY -= 18;
        drawText(`=== SR(a). ${context.colaboradorNome}`, marginX + 25, cursorY, 10, true);
        cursorY -= 30;

        cursorY = drawParagraph(
            `Pelo presente, o notificamos que a IMEDIATO da data da entrega deste, não mais serão utilizados os seus serviços pela nossa firma e por isso avisá-lo, nos Termos e para os efeitos do dispositivo no Art. 445, parágrafo único da CLT.`,
            cursorY,
            10,
            16
        );
        cursorY -= 20;

        drawText(`INICIO CONTRATO: ${context.dataInicioContrato}`, marginX + 25, cursorY, 10);
        cursorY -= 16;
        drawText(`FIM DO CONTRATO: ${context.dataFimContrato}`, marginX + 25, cursorY, 10);
        cursorY -= 35;

        drawText('Pedimos a devolução da presente com seu "CIENTE"', marginX, cursorY, 10);
        cursorY -= 16;
        drawText("Saudações,", marginX, cursorY, 10);
        cursorY -= 35;

        drawText("..................................................", marginX, cursorY, 10);
        cursorY -= 45;

        drawText(`${context.cidadeUf}, ${context.dataExtenso}`, marginX, cursorY, 10);
        cursorY -= 16;
        drawText("CIENTE,", marginX, cursorY, 10, true);
        cursorY -= 45;

        const colWidth = 180;
        drawText("..................................................", marginX, cursorY, 9.5);
        drawText("..................................................", width - marginX - colWidth, cursorY, 9.5);
        cursorY -= 14;

        drawText("RESPONSÁVEL QUANDO MENOR", marginX + 15, cursorY, 8.5);
        drawText("ASSINATURA DO EMPREGADO", width - marginX - colWidth + 20, cursorY, 8.5);
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

/**
 * Gera Data URI Base64 do PDF para pré-visualização e download imediato
 */
export async function generateDismissalNoticePdfBase64(employeeId: string, customOverrides?: any): Promise<string> {
    const buffer = await generateDismissalNoticePdfBytes(employeeId, customOverrides);
    return `data:application/pdf;base64,${buffer.toString("base64")}`;
}

/**
 * Envia o documento de Aviso / Rescisão para o WhatsApp do colaborador via Autentique
 */
export async function sendDismissalNoticeToAutentique(employeeId: string, customOverrides?: any) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const employee = await prisma.employee.findUnique({
        where: { id: employeeId }
    });
    if (!employee) throw new Error("Colaborador não encontrado.");
    if (!employee.phone) throw new Error("O colaborador não possui telefone/WhatsApp cadastrado para envio.");

    const pdfBuffer = await generateDismissalNoticePdfBytes(employeeId, customOverrides);
    const fileName = `Aviso_${employee.name.replace(/\s+/g, "_")}.pdf`;
    const docName = `Aviso de Desligamento - ${employee.name}`;

    // Enviar via Autentique GraphQL API
    const res = await sendAutentiqueDocument(employee.name, employee.phone, pdfBuffer, fileName, docName);

    const docId = res?.createDocument?.id;

    // Atualizar extraFields do colaborador
    const extraFields = (employee.extraFields as Record<string, any>) || {};
    const dismissalProc = extraFields.dismissalProcess || {};
    
    dismissalProc.autentiqueDocId = docId || null;
    dismissalProc.autentiqueStatus = 'ENVIADO';
    dismissalProc.autentiqueSentAt = new Date().toISOString();
    dismissalProc.autentiqueSentByUserId = user.id;

    extraFields.dismissalProcess = dismissalProc;

    await prisma.employee.update({
        where: { id: employeeId },
        data: { extraFields }
    });

    await prisma.log.create({
        data: {
            action: "AUTENTIQUE_AVISO_ENVIADO",
            details: `Aviso prévio/rescisão enviado para assinatura digital via WhatsApp para ${employee.name} (${employee.phone}). DocID: ${docId}`,
            employeeId,
            userId: user.id
        }
    });

    revalidatePath("/admin/dismissal-monitor");
    revalidatePath(`/admin/employees/${employeeId}`);

    return {
        success: true,
        docId,
        message: "Aviso enviado com sucesso para o WhatsApp do colaborador via Autentique!"
    };
}
