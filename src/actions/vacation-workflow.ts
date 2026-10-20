"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { addDays, subDays, differenceInDays, format, isBefore, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface VacationProcessItem {
    id: string;
    employeeId: string;
    employeeName: string;
    cpf: string;
    phone: string | null;
    admissionDate: string;
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

    // Etapas da Esteira
    status: "PROGRAMADA" | "CONTABILIDADE" | "AVISO_ASSINADO" | "PAGO" | "EM_GOZO" | "RETORNADO" | "CANCELADO";
    statusLabel: string;
    sentToAccounting: boolean;
    sentToAccountingAt: string | null;
    noticeSigned: boolean;
    noticeSignedAt: string | null;
    noticeDeadline: string; // 30 dias antes
    paymentDeadline: string; // 2 dias antes (Art. 145 CLT)
    paymentDeadlineFormatted: string;
    paymentDaysRemaining: number; // contagem regressiva para D-2
    isPaymentLate: boolean;
    isPaymentUrgent: boolean; // <= 3 dias
    paymentConfirmed: boolean;
    paymentConfirmedAt: string | null;
    paymentNotes: string | null;
    receiptAmount: number | null;
    returnedToWork: boolean;
    returnedToWorkAt: string | null;
    returnDaysRemaining: number;
    isReturnPending: boolean;
}

export interface VacationWorkflowMetrics {
    totalProcesses: number;
    pendingAccounting: number;
    pendingNoticeSignature: number;
    pendingPayment: number;
    criticalPayment: number; // faltam <= 3 dias para D-2 ou vencido sem pagamento!
    currentlyOnVacation: number;
    pendingReturn: number; // já terminou o período e ainda não confirmou retorno
    completed: number;
}

/**
 * Busca todos os processos de férias em andamento e concluídos com cálculo de esteira operacional
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

        // Prazos CLT:
        // Art. 135 CLT: Aviso prévio com 30 dias de antecedência
        const noticeDeadlineDate = subDays(start, 30);
        // Art. 145 CLT: Pagamento efetuado até 2 dias antes do início
        const paymentDeadlineDate = v.paymentDeadline 
            ? startOfDay(new Date(v.paymentDeadline)) 
            : subDays(start, 2);

        const daysToPayment = differenceInDays(paymentDeadlineDate, today);
        const daysToReturn = differenceInDays(end, today);

        const isPaymentLate = !v.paymentConfirmed && daysToPayment < 0 && isBefore(today, start);
        const isPaymentUrgent = !v.paymentConfirmed && daysToPayment <= 3 && !isAfter(today, start);
        const isReturnPending = !v.returnedToWork && isAfter(today, end);

        // Determinar status dinâmico do processo
        let currentStatus: VacationProcessItem["status"] = "PROGRAMADA";
        let statusLabel = "1. Programada / Aprovada";

        if (v.status === "CANCELADO") {
            currentStatus = "CANCELADO";
            statusLabel = "Cancelada";
        } else if (v.returnedToWork || v.processed) {
            currentStatus = "RETORNADO";
            statusLabel = "Concluída (Retorno OK)";
        } else if (isAfter(today, end)) {
            currentStatus = "RETORNADO";
            statusLabel = "Pendente Confirmação de Retorno";
        } else if (!isBefore(today, start) && !isAfter(today, end)) {
            currentStatus = "EM_GOZO";
            statusLabel = "Em Gozo de Férias";
        } else if (v.paymentConfirmed) {
            currentStatus = "PAGO";
            statusLabel = "Pago (Aguardando Início)";
        } else if (v.noticeSigned) {
            currentStatus = "AVISO_ASSINADO";
            statusLabel = "Aviso Assinado (Aguardando Pagamento)";
        } else if (v.sentToAccounting) {
            currentStatus = "CONTABILIDADE";
            statusLabel = "Em Processamento (Contabilidade/DP)";
        }

        const activeAssignment = v.employee?.assignments?.[0];
        const clientName = activeAssignment?.posto?.client?.name || "Sem Posto";
        const postoSchedule = activeAssignment?.posto?.schedule || "-";

        return {
            id: v.id,
            employeeId: v.employeeId,
            employeeName: v.employee?.name || "Colaborador",
            cpf: v.employee?.cpf || "-",
            phone: v.employee?.phone || null,
            admissionDate: v.employee?.admissionDate ? format(new Date(v.employee.admissionDate), "dd/MM/yyyy") : "-",
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

            status: currentStatus,
            statusLabel,
            sentToAccounting: v.sentToAccounting,
            sentToAccountingAt: v.sentToAccountingAt ? v.sentToAccountingAt.toISOString() : null,
            noticeSigned: v.noticeSigned,
            noticeSignedAt: v.noticeSignedAt ? v.noticeSignedAt.toISOString() : null,
            noticeDeadline: format(noticeDeadlineDate, "dd/MM/yyyy"),
            paymentDeadline: paymentDeadlineDate.toISOString(),
            paymentDeadlineFormatted: format(paymentDeadlineDate, "dd/MM/yyyy"),
            paymentDaysRemaining: daysToPayment,
            isPaymentLate,
            isPaymentUrgent,
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
        pendingAccounting: processes.filter(p => !p.sentToAccounting && p.status !== "RETORNADO" && p.status !== "CANCELADO").length,
        pendingNoticeSignature: processes.filter(p => !p.noticeSigned && p.status !== "RETORNADO" && p.status !== "CANCELADO").length,
        pendingPayment: processes.filter(p => !p.paymentConfirmed && p.status !== "RETORNADO" && p.status !== "CANCELADO").length,
        criticalPayment: processes.filter(p => (p.isPaymentUrgent || p.isPaymentLate) && !p.paymentConfirmed).length,
        currentlyOnVacation: processes.filter(p => p.status === "EM_GOZO").length,
        pendingReturn: processes.filter(p => p.isReturnPending).length,
        completed: processes.filter(p => p.returnedToWork || p.status === "RETORNADO").length
    };

    return { processes, metrics };
}

/**
 * Atualiza etapas da esteira operacional de férias
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
                    sentToAccountingAt: now,
                    status: vacation.status === "PROGRAMADA" ? "CONTABILIDADE" : vacation.status
                }
            });
            await prisma.log.create({
                data: {
                    action: "FERIAS_ENVIADO_CONTABILIDADE",
                    details: `Férias de ${vacation.employee.name} enviadas para contabilidade/DP por ${user.name}.`,
                    employeeId: vacation.employeeId,
                    userId: user.id
                }
            });
            break;

        case "SIGN_NOTICE":
            await prisma.vacation.update({
                where: { id: params.vacationId },
                data: {
                    noticeSigned: true,
                    noticeSignedAt: now,
                    status: vacation.status === "CONTABILIDADE" || vacation.status === "PROGRAMADA" ? "AVISO_ASSINADO" : vacation.status
                }
            });
            await prisma.log.create({
                data: {
                    action: "FERIAS_AVISO_ASSINADO",
                    details: `Aviso prévio de férias assinado pelo colaborador ${vacation.employee.name} registrado por ${user.name}.`,
                    employeeId: vacation.employeeId,
                    userId: user.id
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
            await prisma.log.create({
                data: {
                    action: "FERIAS_PAGAMENTO_CONFIRMADO",
                    details: `Pagamento de férias confirmado para ${vacation.employee.name} por ${user.name}. Valor: R$ ${(params.data?.receiptAmount || 0).toFixed(2)}. Obs: ${params.data?.paymentNotes || "Sem notas"}`,
                    employeeId: vacation.employeeId,
                    userId: user.id
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
            await prisma.log.create({
                data: {
                    action: "FERIAS_RETORNO_POSTO",
                    details: `Retorno ao posto de trabalho confirmado após férias para ${vacation.employee.name} por ${user.name}.`,
                    employeeId: vacation.employeeId,
                    userId: user.id
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
            await prisma.log.create({
                data: {
                    action: "FERIAS_CANCELADAS",
                    details: `Férias de ${vacation.employee.name} canceladas por ${user.name}. Motivo: ${params.data?.cancellationReason || "Sem motivo informando"}`,
                    employeeId: vacation.employeeId,
                    userId: user.id
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
