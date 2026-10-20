"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { addDays, subDays, differenceInDays, format, isBefore, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import nodemailer from "nodemailer";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { sendAutentiqueDocument } from "@/actions/epi";
import { createContaAzulPayableForVacation, fetchContaAzul, getEmpresaContaAzulForCompany } from "@/lib/contaazul-vacation";

export interface VacationProcessItem {
    id: string;
    employeeId: string;
    employeeName: string;
    cpf: string;
    phone: string | null;
    admissionDate: string;
    salary: number;
    companyName: string;
    roleName: string;
    clientName: string;
    postoSchedule: string;
    startDate: string; // ISO
    endDate: string; // ISO
    startDateFormatted: string; // dd/MM/yyyy
    endDateFormatted: string; // dd/MM/yyyy
    daysTaken: number;
    daysSold: number;
    notes: string | null;
    createdByName: string | null;
    createdAt: string;

    // Fases da Esteira Operacional
    phase: "TRATATIVAS_DP" | "AGUARDANDO_PAGAMENTO" | "EM_GOZO" | "RETORNO_CONCLUIDO" | "CANCELADO";
    phaseLabel: string;

    // Etapa 1: Envio para a Contabilidade
    sentToAccounting: boolean;
    sentToAccountingAt: string | null;
    accountingEmailSent: {
        sentAt: string;
        toEmail: string;
        subject: string;
        sentBy: string;
        notes?: string;
    } | null;

    // Etapa 1.5: Retorno da Contabilidade (Arquivo com Valores R$)
    hasAccountingFile: boolean;
    accountingFileName: string | null;
    accountingFileUrl: string | null;
    accountingReturnReceivedAt: string | null;
    accountingReturnNotes: string | null;

    // Etapa 2: Assinatura do Aviso (Autentique / Manual)
    noticeSigned: boolean;
    noticeSignedAt: string | null;
    noticeDeadline: string; // 30 dias antes
    autentiqueDocId: string | null;
    autentiqueStatus: "ENVIADO" | "VISUALIZADO" | "ASSINADO" | null;
    autentiqueSentAt: string | null;

    // Etapa 3: Conta Azul (Contas a Pagar) & Pagamento (D-2 CLT)
    paymentDeadline: string; // 2 dias antes (Art. 145 CLT)
    paymentDeadlineFormatted: string;
    paymentDaysRemaining: number; // contagem regressiva para D-2
    isPaymentLate: boolean;
    isPaymentUrgent: boolean; // <= 3 dias
    contaAzulPayableId: string | null;
    contaAzulStatus: string | null;
    paymentConfirmed: boolean;
    paymentConfirmedAt: string | null;
    paymentNotes: string | null;
    receiptAmount: number | null;

    // Etapa 4: Retorno ao Posto
    returnedToWork: boolean;
    returnedToWorkAt: string | null;
    returnDaysRemaining: number;
    isReturnPending: boolean;
}

export interface VacationWorkflowMetrics {
    totalProcesses: number;
    phaseTratativas: number; // Novas / Tratativas DP (enviar contabilidade, coletar assinatura, lançar conta azul)
    phaseAguardandoPagamento: number; // Aviso assinado e lançado, aguardando D-2
    criticalPayment: number; // <= 3 dias para D-2 ou vencido!
    phaseEmGozo: number; // Colaboradores usufruindo férias atualmente
    phaseRetorno: number; // Período encerrado, aguardando confirmação de retorno
    completed: number; // Retorno ao posto confirmado e concluído
}

/**
 * Busca todos os processos de férias em andamento e calcula a fase exata de cada um
 */
export async function getVacationProcessesData(): Promise<{
    processes: VacationProcessItem[];
    metrics: VacationWorkflowMetrics;
}> {
    const today = startOfDay(new Date());

    const vacations = await prisma.vacation.findMany({
        orderBy: { startDate: "desc" },
        include: {
            employee: {
                select: {
                    id: true,
                    name: true,
                    cpf: true,
                    phone: true,
                    admissionDate: true,
                    salary: true,
                    company: { select: { name: true } },
                    role: { select: { name: true } },
                    assignments: {
                        where: { endDate: null },
                        include: {
                            posto: {
                                include: { client: true }
                            }
                        }
                    }
                }
            }
        }
    });

    const processes: VacationProcessItem[] = vacations.map(v => {
        const start = startOfDay(new Date(v.startDate));
        const end = startOfDay(new Date(v.endDate));

        const noticeDeadlineDate = subDays(start, 30);
        const paymentDeadlineDate = v.paymentDeadline 
            ? startOfDay(new Date(v.paymentDeadline)) 
            : subDays(start, 2);

        const daysToPayment = differenceInDays(paymentDeadlineDate, today);
        const daysToReturn = differenceInDays(end, today);

        const isPaymentLate = !v.paymentConfirmed && daysToPayment < 0 && isBefore(today, start);
        const isPaymentUrgent = !v.paymentConfirmed && daysToPayment <= 3 && !isAfter(today, start);
        const isReturnPending = !v.returnedToWork && isAfter(today, end);

        // ── DETERMINAÇÃO DA FASE OPERACIONAL (Regra de Negócio Solicitada) ──
        let phase: VacationProcessItem["phase"] = "TRATATIVAS_DP";
        let phaseLabel = "1. Tratativas DP & Contabilidade";

        if (v.status === "CANCELADO") {
            phase = "CANCELADO";
            phaseLabel = "Cancelada";
        } else if (v.returnedToWork || v.processed) {
            phase = "RETORNO_CONCLUIDO";
            phaseLabel = "Concluída (Retorno OK)";
        } else if (isAfter(today, end)) {
            phase = "RETORNO_CONCLUIDO";
            phaseLabel = "Pendente Confirmação de Retorno";
        } else if (v.paymentConfirmed && !isBefore(today, start) && !isAfter(today, end)) {
            phase = "EM_GOZO";
            phaseLabel = "Em Gozo de Férias";
        } else if (v.paymentConfirmed && isBefore(today, start)) {
            phase = "AGUARDANDO_PAGAMENTO";
            phaseLabel = "Pago (Aguardando Início)";
        } else if (v.noticeSigned || v.contaAzulPayableId) {
            phase = "AGUARDANDO_PAGAMENTO";
            phaseLabel = "2. Aguardando Pagamento (D-2 CLT)";
        } else {
            phase = "TRATATIVAS_DP";
            phaseLabel = "1. Tratativas DP (Documentação/Conta Azul)";
        }

        const activeAssignment = v.employee?.assignments?.[0];
        const clientName = activeAssignment?.posto?.client?.name || "Sem Posto";
        const postoSchedule = activeAssignment?.posto?.schedule || "-";

        const extra = (v.extraFields as any) || {};
        const accountingFile = extra.accountingNoticeFile || null;
        const accountingReturn = extra.accountingReturn || null;

        const hasAccountingFile = !!(accountingFile?.fileBase64 || (v.attachmentUrl && v.attachmentUrl.startsWith("data:application/pdf")));
        const accountingFileName = accountingFile?.fileName || (hasAccountingFile ? "Aviso_Ferias_Contabilidade.pdf" : null);
        const accountingFileUrl = accountingFile?.fileBase64 || v.attachmentUrl || null;
        const accountingReturnReceivedAt = accountingReturn?.receivedAt || (hasAccountingFile ? v.updatedAt.toISOString() : null);
        const accountingReturnNotes = accountingReturn?.notes || null;

        return {
            id: v.id,
            employeeId: v.employeeId,
            employeeName: v.employee?.name || "Colaborador",
            cpf: v.employee?.cpf || "-",
            phone: v.employee?.phone || null,
            admissionDate: v.employee?.admissionDate ? format(new Date(v.employee.admissionDate), "dd/MM/yyyy") : "-",
            salary: v.employee?.salary || 0,
            companyName: v.employee?.company?.name || "Grupo JVS",
            roleName: v.employee?.role?.name || "Operacional",
            clientName,
            postoSchedule,
            startDate: v.startDate.toISOString(),
            endDate: v.endDate.toISOString(),
            startDateFormatted: format(start, "dd/MM/yyyy"),
            endDateFormatted: format(end, "dd/MM/yyyy"),
            daysTaken: v.daysTaken,
            daysSold: v.daysSold,
            notes: v.notes,
            createdByName: v.createdByName,
            createdAt: v.createdAt.toISOString(),

            phase,
            phaseLabel,
            sentToAccounting: v.sentToAccounting,
            sentToAccountingAt: v.sentToAccountingAt ? v.sentToAccountingAt.toISOString() : null,
            accountingEmailSent: extra.accountingEmailSent || null,

            hasAccountingFile,
            accountingFileName,
            accountingFileUrl,
            accountingReturnReceivedAt,
            accountingReturnNotes,

            noticeSigned: v.noticeSigned,
            noticeSignedAt: v.noticeSignedAt ? v.noticeSignedAt.toISOString() : null,
            noticeDeadline: format(noticeDeadlineDate, "dd/MM/yyyy"),
            autentiqueDocId: v.autentiqueDocId,
            autentiqueStatus: (v.autentiqueStatus as any) || null,
            autentiqueSentAt: v.autentiqueSentAt ? v.autentiqueSentAt.toISOString() : null,

            paymentDeadline: paymentDeadlineDate.toISOString(),
            paymentDeadlineFormatted: format(paymentDeadlineDate, "dd/MM/yyyy"),
            paymentDaysRemaining: daysToPayment,
            isPaymentLate,
            isPaymentUrgent,
            contaAzulPayableId: v.contaAzulPayableId,
            contaAzulStatus: v.contaAzulStatus,
            paymentConfirmed: v.paymentConfirmed,
            paymentConfirmedAt: v.paymentConfirmedAt ? v.paymentConfirmedAt.toISOString() : null,
            paymentNotes: v.paymentNotes,
            receiptAmount: v.receiptAmount,

            returnedToWork: v.returnedToWork,
            returnedToWorkAt: v.returnedToWorkAt ? v.returnedToWorkAt.toISOString() : null,
            returnDaysRemaining: daysToReturn,
            isReturnPending
        };
    });

    const metrics: VacationWorkflowMetrics = {
        totalProcesses: processes.length,
        phaseTratativas: processes.filter(p => p.phase === "TRATATIVAS_DP").length,
        phaseAguardandoPagamento: processes.filter(p => p.phase === "AGUARDANDO_PAGAMENTO").length,
        criticalPayment: processes.filter(p => (p.isPaymentUrgent || p.isPaymentLate) && !p.paymentConfirmed).length,
        phaseEmGozo: processes.filter(p => p.phase === "EM_GOZO").length,
        phaseRetorno: processes.filter(p => p.isReturnPending || (p.phase === "RETORNO_CONCLUIDO" && !p.returnedToWork)).length,
        completed: processes.filter(p => p.returnedToWork).length
    };

    return { processes, metrics };
}

/**
 * AUTOMAÇÃO 1: Envia e-mail para a Contabilidade e registra histórico no card
 */
export async function sendVacationAccountingEmail(params: {
    vacationId: string;
    recipientEmail: string;
    subject?: string;
    customNotes?: string;
}): Promise<{ success: boolean; message: string; mailtoUrl?: string }> {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const vacation = await prisma.vacation.findUnique({
        where: { id: params.vacationId },
        include: {
            employee: {
                include: {
                    company: true,
                    role: true,
                    assignments: {
                        where: { endDate: null },
                        include: { posto: { include: { client: true } } }
                    }
                }
            }
        }
    });

    if (!vacation) throw new Error("Férias não encontradas.");

    const startFmt = format(new Date(vacation.startDate), "dd/MM/yyyy");
    const endFmt = format(new Date(vacation.endDate), "dd/MM/yyyy");
    const paymentDeadlineDate = subDays(new Date(vacation.startDate), 2);
    const paymentFmt = format(paymentDeadlineDate, "dd/MM/yyyy");

    const activeAssignment = vacation.employee.assignments[0];
    const clientName = activeAssignment?.posto?.client?.name || "Operacional";
    const companyName = vacation.employee.company?.name || "RGR FACILITIES / GRUPO JVS";

    const subject = params.subject || `[PROGRAMAÇÃO DE FÉRIAS] ${vacation.employee.name} - ${companyName}`;

    const htmlBody = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 650px; margin: 0 auto; line-height: 1.6;">
            <div style="background-color: #4f46e5; padding: 20px; border-radius: 8px 8px 0 0; color: white;">
                <h2 style="margin: 0; font-size: 20px;">Solicitação de Cálculo de Férias — DP / Contabilidade</h2>
                <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">Work Force Hub • Gestão de Recursos Humanos</p>
            </div>
            
            <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; background-color: #ffffff;">
                <p>Prezados,</p>
                <p>Favor gerar o recibo e documentação de concessão de férias para o colaborador abaixo relacionado:</p>

                <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
                    <tr style="background-color: #f9fafb;"><td style="padding: 8px 12px; border: 1px solid #e5e7eb; font-weight: bold; width: 35%;">Empresa Vinculada:</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${companyName}</td></tr>
                    <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; font-weight: bold;">Colaborador:</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #111827;">${vacation.employee.name}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 8px 12px; border: 1px solid #e5e7eb; font-weight: bold;">CPF:</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${vacation.employee.cpf}</td></tr>
                    <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; font-weight: bold;">Cargo / Posto:</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${vacation.employee.role?.name || "-"} • ${clientName}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 8px 12px; border: 1px solid #e5e7eb; font-weight: bold;">Período de Gozo:</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; font-weight: bold; color: #4f46e5;">${startFmt} a ${endFmt} (${vacation.daysTaken} dias)</td></tr>
                    ${vacation.daysSold > 0 ? `<tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; font-weight: bold;">Abono Pecuniário (Venda):</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #b45309; font-weight: bold;">${vacation.daysSold} dias vendidos</td></tr>` : ''}
                    <tr style="background-color: #fef2f2;"><td style="padding: 8px 12px; border: 1px solid #fecaca; font-weight: bold; color: #b91c1c;">Data Limite de Pagamento (Art. 145 CLT):</td><td style="padding: 8px 12px; border: 1px solid #fecaca; font-weight: bold; color: #b91c1c;">${paymentFmt} (D-2 dias)</td></tr>
                </table>

                ${params.customNotes ? `<div style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-size: 13px; margin-bottom: 20px;"><strong>Observações Adicionais:</strong><br/>${params.customNotes}</div>` : ''}

                <p style="font-size: 13px; color: #6b7280;">Solicitação transmitida por <strong>${user.name}</strong> via Work Force Hub.</p>
            </div>
        </div>
    `;

    let emailSentDirectly = false;

    // Se houver configuração SMTP ativa no ambiente, envia via nodemailer
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER || "dp@grupojvsserv.com.br";
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpPass) {
        try {
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: Number(process.env.SMTP_PORT) || 465,
                secure: (process.env.SMTP_PORT || "465") === "465",
                auth: { user: smtpUser, pass: smtpPass }
            });

            await transporter.sendMail({
                from: `"Departamento Pessoal" <${smtpUser}>`,
                to: params.recipientEmail,
                subject,
                html: htmlBody
            });
            emailSentDirectly = true;
        } catch (e: any) {
            console.error("[sendVacationAccountingEmail SMTP Error]", e.message);
        }
    }

    // Registra envio e histórico no card
    const extra = (vacation.extraFields as any) || {};
    extra.accountingEmailSent = {
        sentAt: new Date().toISOString(),
        toEmail: params.recipientEmail,
        subject,
        sentBy: user.name,
        notes: params.customNotes || null
    };

    await prisma.vacation.update({
        where: { id: params.vacationId },
        data: {
            sentToAccounting: true,
            sentToAccountingAt: new Date(),
            extraFields: extra
        }
    });

    await prisma.log.create({
        data: {
            action: "FERIAS_EMAIL_CONTABILIDADE",
            details: `E-mail de férias transmitido para contabilidade (${params.recipientEmail}) por ${user.name}. Período: ${startFmt} a ${endFmt}.`,
            employeeId: vacation.employeeId,
            userId: user.id
        }
    });

    const mailtoUrl = `mailto:${encodeURIComponent(params.recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Prezados,\n\nFavor processar o recibo de férias do colaborador ${vacation.employee.name} (CPF: ${vacation.employee.cpf}).\nPeríodo: ${startFmt} a ${endFmt} (${vacation.daysTaken} dias).\nData limite pagamento CLT: ${paymentFmt}.\n\nAtenciosamente,\n${user.name}`)}`;

    revalidatePath("/admin/vacation-monitor");

    return {
        success: true,
        message: emailSentDirectly 
            ? `E-mail enviado com sucesso para ${params.recipientEmail}!` 
            : `Solicitação registrada e histórico gravado no card de ${vacation.employee.name}!`,
        mailtoUrl
    };
}

/**
 * AUTOMAÇÃO 2: Dispara o Aviso de Férias Oficial (Art. 135 CLT) para assinatura via WhatsApp no Autentique
 */
export async function sendVacationNoticeToAutentique(vacationId: string): Promise<{ success: boolean; message: string; docId?: string }> {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const vacation = await prisma.vacation.findUnique({
        where: { id: vacationId },
        include: {
            employee: {
                include: {
                    company: true,
                    role: true,
                    assignments: {
                        where: { endDate: null },
                        include: { posto: { include: { client: true } } }
                    }
                }
            }
        }
    });

    if (!vacation) throw new Error("Férias não encontradas.");
    if (!vacation.employee.phone) throw new Error("Colaborador não possui telefone/WhatsApp cadastrado para assinatura.");

    const start = new Date(vacation.startDate);
    const end = new Date(vacation.endDate);
    const startFmt = format(start, "dd/MM/yyyy");
    const endFmt = format(end, "dd/MM/yyyy");
    const returnFmt = format(addDays(end, 1), "dd/MM/yyyy");
    const noticeDateFmt = format(subDays(start, 30), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const paymentFmt = format(subDays(start, 2), "dd/MM/yyyy");

    const activeAssignment = vacation.employee.assignments[0];
    const clientName = activeAssignment?.posto?.client?.name || "Operacional";
    const companyName = vacation.employee.company?.name || "RGR FACILITIES LTDA";

    let pdfBuffer: Buffer;
    let fileName: string;
    let isAccountingFile = false;

    const extra = (vacation.extraFields as any) || {};
    const accountingFile = extra?.accountingNoticeFile;

    // Se a contabilidade já devolveu o documento oficial com os valores, usa esse PDF!
    if (accountingFile?.fileBase64) {
        const raw = accountingFile.fileBase64;
        const base64Data = raw.includes(";base64,") ? raw.split(";base64,")[1] : raw;
        pdfBuffer = Buffer.from(base64Data, "base64");
        fileName = accountingFile.fileName || `Aviso_Ferias_Calculo_${vacation.employee.name.replace(/\s+/g, "_")}.pdf`;
        isAccountingFile = true;
    } else if (vacation.attachmentUrl && vacation.attachmentUrl.startsWith("data:application/pdf")) {
        const base64Data = vacation.attachmentUrl.split(";base64,")[1];
        pdfBuffer = Buffer.from(base64Data, "base64");
        fileName = `Aviso_Ferias_Calculo_${vacation.employee.name.replace(/\s+/g, "_")}.pdf`;
        isAccountingFile = true;
    } else {
        // Fallback: gera minuta de aviso formal CLT
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]); // A4
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const { width, height } = page.getSize();
        const margin = 50;
        let cursorY = height - margin;

        // Cabeçalho
        page.drawText(companyName.toUpperCase(), { x: margin, y: cursorY, size: 14, font: fontBold, color: rgb(0.1, 0.1, 0.2) });
        cursorY -= 18;
        page.drawText("COMUNICAÇÃO DE AVISO DE FÉRIAS (ART. 135 DA CLT)", { x: margin, y: cursorY, size: 11, font: fontBold, color: rgb(0.3, 0.3, 0.7) });
        cursorY -= 25;

        // Dados
        page.drawText(`Empregado(a): ${vacation.employee.name}`, { x: margin, y: cursorY, size: 10, font: fontBold });
        cursorY -= 15;
        page.drawText(`CPF: ${vacation.employee.cpf}   |   Cargo: ${vacation.employee.role?.name || "-"}   |   Posto: ${clientName}`, { x: margin, y: cursorY, size: 9, font });
        cursorY -= 25;

        // Texto
        const p1 = `Vimos por meio desta comunicar-lhe que, nos termos do Art. 135 da Consolidação das Leis do Trabalho (CLT), ser-lhe-ao concedidas ferias regulamentares relativas ao periodo aquisitivo correspondente.`;
        page.drawText(p1, { x: margin, y: cursorY, size: 9.5, font, maxWidth: width - margin * 2 });
        cursorY -= 35;

        page.drawText(`PERIODO DE GOZO: De ${startFmt} ate ${endFmt} (${vacation.daysTaken} dias corridos)`, { x: margin, y: cursorY, size: 10, font: fontBold, color: rgb(0.1, 0.2, 0.6) });
        cursorY -= 16;
        if (vacation.daysSold > 0) {
            page.drawText(`Abono Pecuniario (Venda): ${vacation.daysSold} dias`, { x: margin, y: cursorY, size: 9.5, font });
            cursorY -= 16;
        }
        page.drawText(`Data de Retorno ao Trabalho: ${returnFmt}`, { x: margin, y: cursorY, size: 9.5, font: fontBold });
        cursorY -= 25;

        const p2 = `A remuneracao correspondente as ferias e o respectivo terco constitucional estarao a disposicao ate o dia ${paymentFmt} (Art. 145 da CLT).`;
        page.drawText(p2, { x: margin, y: cursorY, size: 9.5, font, maxWidth: width - margin * 2 });
        cursorY -= 40;

        page.drawText(`Curitiba - PR, ${noticeDateFmt}.`, { x: margin, y: cursorY, size: 9.5, font });
        cursorY -= 60;

        // Assinaturas
        page.drawText("________________________________________", { x: margin, y: cursorY, size: 10, font });
        page.drawText("________________________________________", { x: width - margin - 200, y: cursorY, size: 10, font });
        cursorY -= 14;
        page.drawText(companyName, { x: margin, y: cursorY, size: 8.5, font: fontBold });
        page.drawText("ASSINATURA DO EMPREGADO (CIENTE)", { x: width - margin - 200, y: cursorY, size: 8.5, font: fontBold });

        const pdfBytes = await pdfDoc.save();
        pdfBuffer = Buffer.from(pdfBytes);
        fileName = `Aviso_Ferias_${vacation.employee.name.replace(/\s+/g, "_")}.pdf`;
    }

    const docName = isAccountingFile && vacation.receiptAmount
        ? `Aviso e Recibo de Férias (R$ ${vacation.receiptAmount.toFixed(2)}) - ${vacation.employee.name}`
        : `Aviso de Férias - ${vacation.employee.name} (${startFmt} a ${endFmt})`;

    // 2. Dispara no Autentique
    const res = await sendAutentiqueDocument(vacation.employee.name, vacation.employee.phone, pdfBuffer, fileName, docName);

    if (res?.errors || !res?.data?.createDocument?.id) {
        const errMsg = res?.errors?.[0]?.message || "Falha ao enviar documento no Autentique.";
        throw new Error(errMsg);
    }

    const docId = res.data.createDocument.id;

    // 3. Atualiza registro de férias
    await prisma.vacation.update({
        where: { id: vacationId },
        data: {
            autentiqueDocId: docId,
            autentiqueStatus: "ENVIADO",
            autentiqueSentAt: new Date()
        }
    });

    await prisma.log.create({
        data: {
            action: "AUTENTIQUE_FERIAS_ENVIADO",
            details: `Aviso de Férias ${isAccountingFile ? '(Documento Oficial da Contabilidade com Valores R$)' : '(Minuta CLT)'} disparado via WhatsApp (Autentique) para ${vacation.employee.name} (${vacation.employee.phone}) por ${user.name}. DocID: ${docId}`,
            employeeId: vacation.employeeId,
            userId: user.id
        }
    });

    revalidatePath("/admin/vacation-monitor");

    return {
        success: true,
        message: isAccountingFile
            ? `Documento oficial da contabilidade com valores enviado com sucesso para o WhatsApp de ${vacation.employee.name}!`
            : `Aviso de férias padrão enviado para o WhatsApp de ${vacation.employee.name}!`,
        docId
    };
}

/**
 * AUTOMAÇÃO 1.5: Registra o Retorno da Contabilidade com o Arquivo e Valores (R$)
 */
export async function saveAccountingReturnAction(params: {
    vacationId: string;
    receiptAmount: number;
    fileBase64?: string;
    fileName?: string;
    notes?: string;
}): Promise<{ success: boolean; message: string }> {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const vacation = await prisma.vacation.findUnique({
        where: { id: params.vacationId },
        include: { employee: true }
    });

    if (!vacation) throw new Error("Férias não encontradas.");

    const extra = (vacation.extraFields as any) || {};
    extra.accountingReturn = {
        receivedAt: new Date().toISOString(),
        receivedBy: user.name,
        amount: params.receiptAmount,
        fileName: params.fileName || null,
        notes: params.notes || null
    };

    if (params.fileBase64) {
        extra.accountingNoticeFile = {
            fileName: params.fileName || `Aviso_Ferias_Calculo_${vacation.employee.name.replace(/\s+/g, "_")}.pdf`,
            fileBase64: params.fileBase64,
            uploadedAt: new Date().toISOString(),
            uploadedBy: user.name
        };
    }

    await prisma.vacation.update({
        where: { id: params.vacationId },
        data: {
            receiptAmount: params.receiptAmount,
            attachmentUrl: params.fileBase64 || vacation.attachmentUrl,
            extraFields: extra
        }
    });

    await prisma.log.create({
        data: {
            action: "FERIAS_RETORNO_CONTABILIDADE",
            details: `Retorno da contabilidade registrado para ${vacation.employee.name}. Valor oficial: R$ ${params.receiptAmount.toFixed(2)}${params.fileName ? ` e arquivo anexado (${params.fileName})` : ''} por ${user.name}.`,
            employeeId: vacation.employeeId,
            userId: user.id
        }
    });

    revalidatePath("/admin/vacation-monitor");

    return {
        success: true,
        message: `Retorno da contabilidade registrado com sucesso! Valor R$ ${params.receiptAmount.toFixed(2)} e documento anexados ao card.`
    };
}

/**
 * AUTOMAÇÃO 3: Lança o Contas a Pagar no Conta Azul
 */
export async function createContaAzulPayableAction(params: {
    vacationId: string;
    amount: number;
    notes?: string;
}): Promise<{ success: boolean; message: string; payableId?: string }> {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const vacation = await prisma.vacation.findUnique({
        where: { id: params.vacationId },
        include: {
            employee: {
                include: {
                    company: true,
                    assignments: {
                        where: { endDate: null },
                        include: { posto: { include: { client: true } } }
                    }
                }
            }
        }
    });

    if (!vacation) throw new Error("Férias não encontradas.");

    const activeAssignment = vacation.employee.assignments[0];
    const clientName = activeAssignment?.posto?.client?.name || "Operacional";
    const companyName = vacation.employee.company?.name || "JVS FACILITIES";

    const res = await createContaAzulPayableForVacation({
        vacationId: vacation.id,
        employeeName: vacation.employee.name,
        cpf: vacation.employee.cpf,
        companyName,
        clientName,
        startDate: new Date(vacation.startDate),
        endDate: new Date(vacation.endDate),
        daysTaken: vacation.daysTaken,
        amount: params.amount,
        notes: params.notes
    });

    if (!res.success || !res.payableId) {
        throw new Error(res.error || "Erro ao criar contas a pagar no Conta Azul.");
    }

    const nextStatus = vacation.noticeSigned ? "PAGO" : "AGUARDANDO_PAGAMENTO";

    await prisma.vacation.update({
        where: { id: params.vacationId },
        data: {
            contaAzulPayableId: res.payableId,
            contaAzulStatus: "PENDENTE",
            contaAzulSyncedAt: new Date(),
            receiptAmount: params.amount,
            paymentNotes: params.notes || vacation.paymentNotes
        }
    });

    await prisma.log.create({
        data: {
            action: "CONTA_AZUL_FERIAS_CRIADO",
            details: `Contas a pagar de férias lançado no Conta Azul (${res.empresaNome || companyName}) por ${user.name}. Valor: R$ ${params.amount.toFixed(2)}. ID: ${res.payableId}`,
            employeeId: vacation.employeeId,
            userId: user.id
        }
    });

    revalidatePath("/admin/vacation-monitor");

    return {
        success: true,
        message: `Lançado com sucesso no Conta Azul (${res.empresaNome})! ID: ${res.payableId}`,
        payableId: res.payableId
    };
}

/**
 * AUTOMAÇÃO 4: Baixa de Pagamento do Conta Azul / Confirmação do DP
 */
export async function syncContaAzulPayableAction(vacationId: string): Promise<{ success: boolean; message: string; isPaid: boolean }> {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const vacation = await prisma.vacation.findUnique({
        where: { id: vacationId },
        include: { employee: { include: { company: true } } }
    });

    if (!vacation) throw new Error("Férias não encontradas.");

    let isPaid = false;

    // Se tiver payableId, tenta checar o status no Conta Azul
    if (vacation.contaAzulPayableId) {
        try {
            const empresaMatch = await getEmpresaContaAzulForCompany(vacation.employee.company?.name);
            if (empresaMatch) {
                const res = await fetchContaAzul(empresaMatch.empresaId, `/v1/financeiro/eventos-financeiros/contas-a-pagar/${vacation.contaAzulPayableId}`);
                if (res?.status === "PAID" || res?.status === "BAIXADO" || res?.situacao === "QUITADO") {
                    isPaid = true;
                }
            }
        } catch (e: any) {
            console.warn("Consulta Conta Azul status:", e.message);
        }
    }

    // Se confirmou pagamento (ou manual)
    if (isPaid || !vacation.paymentConfirmed) {
        await prisma.vacation.update({
            where: { id: vacationId },
            data: {
                paymentConfirmed: true,
                paymentConfirmedAt: new Date(),
                contaAzulStatus: "PAGO",
                contaAzulSyncedAt: new Date(),
                status: "PAGO"
            }
        });

        await prisma.log.create({
            data: {
                action: "CONTA_AZUL_FERIAS_BAIXADO",
                details: `Baixa de pagamento de férias confirmada no Work Force Hub para ${vacation.employee.name} por ${user.name}.`,
                employeeId: vacation.employeeId,
                userId: user.id
            }
        });
    }

    revalidatePath("/admin/vacation-monitor");

    return {
        success: true,
        message: "Pagamento confirmado e baixado com sucesso! Processo avançou na esteira.",
        isPaid: true
    };
}

/**
 * Atualização manual de qualquer etapa da esteira operacional
 */
export async function updateVacationWorkflowStep(params: {
    vacationId: string;
    action: "SEND_TO_ACCOUNTING" | "SIGN_NOTICE" | "CONFIRM_PAYMENT" | "CONFIRM_RETURN" | "CANCEL";
    data?: {
        receiptAmount?: number;
        paymentNotes?: string;
        customDate?: string;
        cancellationReason?: string;
    };
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const vacation = await prisma.vacation.findUnique({
        where: { id: params.vacationId },
        include: { employee: true }
    });

    if (!vacation) throw new Error("Registro de férias não encontrado.");

    const now = params.data?.customDate ? new Date(params.data.customDate + "T12:00:00.000Z") : new Date();

    switch (params.action) {
        case "SEND_TO_ACCOUNTING":
            await prisma.vacation.update({
                where: { id: params.vacationId },
                data: {
                    sentToAccounting: true,
                    sentToAccountingAt: now
                }
            });
            break;

        case "SIGN_NOTICE":
            await prisma.vacation.update({
                where: { id: params.vacationId },
                data: {
                    noticeSigned: true,
                    noticeSignedAt: now,
                    autentiqueStatus: "ASSINADO"
                }
            });
            break;

        case "CONFIRM_PAYMENT":
            await prisma.vacation.update({
                where: { id: params.vacationId },
                data: {
                    paymentConfirmed: true,
                    paymentConfirmedAt: now,
                    receiptAmount: params.data?.receiptAmount || vacation.receiptAmount,
                    paymentNotes: params.data?.paymentNotes || vacation.paymentNotes,
                    status: "PAGO"
                }
            });
            break;

        case "CONFIRM_RETURN":
            await prisma.vacation.update({
                where: { id: params.vacationId },
                data: {
                    returnedToWork: true,
                    returnedToWorkAt: now,
                    processed: true,
                    status: "RETORNADO"
                }
            });
            break;

        case "CANCEL":
            await prisma.vacation.update({
                where: { id: params.vacationId },
                data: {
                    status: "CANCELADO",
                    notes: vacation.notes 
                        ? `${vacation.notes} | Cancelada por ${user.name}: ${params.data?.cancellationReason || "Sem motivo"}`
                        : `Cancelada por ${user.name}: ${params.data?.cancellationReason || "Sem motivo"}`
                }
            });
            break;
    }

    revalidatePath("/admin/vacation-monitor");
    return { success: true, message: "Etapa de férias atualizada com sucesso!" };
}

/**
 * Retorna dados formatados para emissão e impressão do Comunicado Formal de Aviso de Férias (Art. 135 CLT)
 */
export async function getVacationNoticePrintData(vacationId: string) {
    const vacation = await prisma.vacation.findUnique({
        where: { id: vacationId },
        include: {
            employee: {
                include: {
                    company: true,
                    role: true,
                    assignments: {
                        where: { endDate: null },
                        include: { posto: { include: { client: true } } }
                    }
                }
            }
        }
    });

    if (!vacation) throw new Error("Férias não encontradas.");

    const start = new Date(vacation.startDate);
    const end = new Date(vacation.endDate);
    const noticeDate = subDays(start, 30);
    const paymentDeadlineDate = subDays(start, 2);

    const activeAssignment = vacation.employee.assignments[0];

    return {
        company: {
            name: vacation.employee.company?.name || "RGR FACILITIES LTDA",
            cnpj: "42.138.835/0001-30",
            address: "Curitiba - PR"
        },
        employee: {
            name: vacation.employee.name,
            cpf: vacation.employee.cpf,
            role: vacation.employee.role?.name || "Operacional",
            client: activeAssignment?.posto?.client?.name || "Operação",
            admissionDate: vacation.employee.admissionDate ? format(new Date(vacation.employee.admissionDate), "dd/MM/yyyy") : "-"
        },
        vacation: {
            startDateFormatted: format(start, "dd/MM/yyyy"),
            endDateFormatted: format(end, "dd/MM/yyyy"),
            daysTaken: vacation.daysTaken,
            daysSold: vacation.daysSold,
            noticeDateFormatted: format(noticeDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
            paymentDeadlineFormatted: format(paymentDeadlineDate, "dd/MM/yyyy"),
            returnDateFormatted: format(addDays(end, 1), "dd/MM/yyyy")
        }
    };
}
