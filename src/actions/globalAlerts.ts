"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getBenefitsCalculation } from "@/actions/benefits";
import { addDays, differenceInDays, format } from "date-fns";

export interface GlobalAlertItem {
    id: string;
    employeeId: string;
    employeeName: string;
    type: 'BENEFIT' | 'EXPERIENCE' | 'DP_DISMISSAL';
    category?: 'PAGAMENTO' | 'TELEGRAMA' | 'EXPERIENCIA' | 'ABANDONO';
    severity: 'CRITICAL' | 'WARNING';
    message: string;
    dueDate: string;
    daysLeft: number;
}

export async function updateAlertUserId(userId: string) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') throw new Error("Não autorizado.");

    const config = await prisma.benefitsConfig.findFirst();
    if (config) {
        await prisma.benefitsConfig.update({
            where: { id: config.id },
            data: { alertUserId: userId === "none" ? null : userId }
        });
    } else {
        await prisma.benefitsConfig.create({
            data: {
                alertUserId: userId === "none" ? null : userId
            }
        });
    }
    return { success: true };
}

export async function getGlobalAlerts() {
    const user = await getCurrentUser();
    if (!user) return { 
        benefitsAlerts: [], 
        experienceAlerts: [], 
        dismissalAlerts: [],
        alertUserId: null, 
        currentUserId: null,
        currentUserRole: null,
        systemUsers: [] 
    };

    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);

    // 1. Fetch benefits config to identify the alert receiver
    const config = await prisma.benefitsConfig.findFirst();
    const alertUserId = config?.alertUserId || null;

    // Fetch system users for selection dropdown (only if admin)
    let systemUsers: { id: string; name: string; email: string | null }[] = [];
    if (user.role === 'ADMIN') {
        systemUsers = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' }
        });
    }

    // 2. Fetch benefits calculation for current month & year
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    
    let benefitsAlerts: GlobalAlertItem[] = [];
    try {
        const { items } = await getBenefitsCalculation(year, month);
        
        const parseDdmmyyyy = (str: string | undefined): Date | null => {
            if (!str) return null;
            const parts = str.split('/');
            if (parts.length !== 3) return null;
            return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        };

        const dueBenefits = items.filter(item => {
            if (item.isPaid) return false;
            if (!item.vtNeedsAlert && !item.vaNeedsAlert) return false;
            const dueDate = parseDdmmyyyy(item.nextPaymentDueDate);
            return dueDate !== null && dueDate <= todayStart;
        });

        benefitsAlerts = dueBenefits.map(item => {
            const dueDate = parseDdmmyyyy(item.nextPaymentDueDate);
            const daysOverdue = dueDate ? differenceInDays(todayStart, dueDate) : 0;
            return {
                id: `benefit-${item.employeeId}`,
                employeeId: item.employeeId,
                employeeName: item.employeeName,
                type: 'BENEFIT',
                severity: 'CRITICAL',
                message: daysOverdue === 0 
                    ? `Compra de benefícios (VT/VA fracionado) vence hoje!` 
                    : `Compra de benefícios (VT/VA fracionado) vencida em ${item.nextPaymentDueDate} (atrasada há ${daysOverdue} dias).`,
                dueDate: item.nextPaymentDueDate || "",
                daysLeft: -daysOverdue
            };
        });
    } catch (err) {
        console.error("Error calculating benefits alerts:", err);
    }

    // 3. Fetch experience contract alerts (from probation monitor)
    let experienceAlerts: GlobalAlertItem[] = [];
    try {
        const probationEmployees = await prisma.employee.findMany({
            where: {
                status: 'Ativo',
                OR: [
                    { situation: { name: 'Ativo' } },
                    { situation: null }
                ],
                probationStatus: null
            },
            select: {
                id: true,
                name: true,
                admissionDate: true,
                role: { select: { name: true } }
            }
        });

        experienceAlerts = probationEmployees.map((emp: any) => {
            const d45 = addDays(new Date(emp.admissionDate), 44);
            const d90 = addDays(new Date(emp.admissionDate), 89);
            const daysSinceHiring = differenceInDays(todayStart, new Date(emp.admissionDate)) + 1;

            let deadline = null;
            let period = '';

            if (daysSinceHiring <= 45) {
                deadline = d45;
                period = '1º Período (45 dias)';
            } else if (daysSinceHiring <= 90) {
                deadline = d90;
                period = '2º Período (90 dias)';
            } else {
                return null;
            }

            const deadlineClean = new Date(deadline);
            deadlineClean.setHours(0, 0, 0, 0);
            const daysLeft = differenceInDays(deadlineClean, todayStart);

            if (daysLeft <= 5) {
                const isOverdue = daysLeft < 0;
                const formattedDate = deadlineClean.toLocaleDateString('pt-BR');
                return {
                    id: `experience-${emp.id}`,
                    employeeId: emp.id,
                    employeeName: emp.name,
                    type: 'EXPERIENCE',
                    severity: isOverdue ? 'CRITICAL' : 'WARNING',
                    message: isOverdue
                        ? `Contrato de experiência (${period}) expirou em ${formattedDate} (atrasado há ${Math.abs(daysLeft)} dias)!`
                        : `Contrato de experiência (${period}) vence em ${formattedDate} (${daysLeft} dias restantes).`,
                    dueDate: formattedDate,
                    daysLeft
                } as GlobalAlertItem;
            }

            return null;
        }).filter(Boolean) as GlobalAlertItem[];
    } catch (err) {
        console.error("Error calculating experience alerts:", err);
    }

    // 4. Fetch Dismissal Monitor Alerts (PAGAMENTO, TELEGRAMA, ABANDONO)
    let dismissalAlerts: GlobalAlertItem[] = [];
    try {
        const activeDismissals = await prisma.employee.findMany({
            where: {
                status: 'Ativo',
                situation: {
                    name: {
                        in: ['Aviso Prévio', 'Processo de Rescisão', 'Processo de abandono']
                    }
                }
            },
            select: {
                id: true,
                name: true,
                admissionDate: true,
                probationStatus: true,
                situation: { select: { name: true } },
                extraFields: true
            }
        });

        activeDismissals.forEach((emp: any) => {
            const extra = emp.extraFields as any || {};
            const proc = extra.dismissalProcess || {};
            
            let type = proc.type || emp.situation?.name || "Desconhecido";
            if (proc.dismissalSubType) {
                if (proc.dismissalSubType === 'DISPENSA_COM_AVISO') {
                    type = "Dispensa (Aviso Trabalhado)";
                } else if (proc.dismissalSubType === 'DISPENSA_SEM_AVISO') {
                    type = "Dispensa (Aviso Indenizado)";
                } else if (proc.dismissalSubType === 'PEDIDO_COM_AVISO') {
                    type = "Pedido (Aviso Trabalhado)";
                } else if (proc.dismissalSubType === 'PEDIDO_SEM_AVISO') {
                    type = "Pedido (Dispensa de Aviso)";
                } else if (proc.dismissalSubType === 'ABANDONO') {
                    type = "Processo de abandono";
                } else if (proc.dismissalSubType.startsWith('TERMINO_EXP')) {
                    type = "Término de Experiência";
                }
            }

            let startDate = proc.startDate ? new Date(proc.startDate) : null;
            let endDate = proc.endDate ? new Date(proc.endDate) : null;
            let reductionType = proc.reductionType || 'NENHUMA';
            let telegram1SentDate = proc.telegram1SentDate || null;
            let telegram2SentDate = proc.telegram2SentDate || null;
            let paymentDeadline = proc.paymentDeadline ? new Date(proc.paymentDeadline) : null;

            if (type === "Aviso Prévio" && endDate && !paymentDeadline) {
                paymentDeadline = new Date(endDate);
                paymentDeadline.setDate(paymentDeadline.getDate() + 10);
            } else if ((type === "Processo de Rescisão" || type.includes("Aviso Indenizado") || type.includes("Dispensa de Aviso")) && endDate && !paymentDeadline) {
                paymentDeadline = new Date(endDate);
                paymentDeadline.setDate(paymentDeadline.getDate() + 10);
            }

            // Payment Deadline Alert
            if (paymentDeadline) {
                const daysToPay = differenceInDays(paymentDeadline, todayStart);
                if (daysToPay < 0) {
                    dismissalAlerts.push({
                        id: `dp-pay-crit-${emp.id}`,
                        employeeId: emp.id,
                        employeeName: emp.name,
                        type: 'DP_DISMISSAL',
                        category: 'PAGAMENTO',
                        severity: 'CRITICAL',
                        message: `Pagamento da rescisão venceu em ${format(paymentDeadline, 'dd/MM/yyyy')} (atrasado há ${Math.abs(daysToPay)} dias)!`,
                        dueDate: format(paymentDeadline, 'dd/MM/yyyy'),
                        daysLeft: daysToPay
                    });
                } else if (daysToPay <= 3) {
                    dismissalAlerts.push({
                        id: `dp-pay-warn-${emp.id}`,
                        employeeId: emp.id,
                        employeeName: emp.name,
                        type: 'DP_DISMISSAL',
                        category: 'PAGAMENTO',
                        severity: 'WARNING',
                        message: `Pagamento da rescisão vence em ${format(paymentDeadline, 'dd/MM/yyyy')} (${daysToPay} dias restantes).`,
                        dueDate: format(paymentDeadline, 'dd/MM/yyyy'),
                        daysLeft: daysToPay
                    });
                }
            }

            // Abandonment / Telegrams Alert
            if (type === "Processo de abandono" && startDate) {
                const daysElapsed = differenceInDays(todayStart, startDate);
                if (daysElapsed >= 30) {
                    dismissalAlerts.push({
                        id: `dp-aband-crit-${emp.id}`,
                        employeeId: emp.id,
                        employeeName: emp.name,
                        type: 'DP_DISMISSAL',
                        category: 'ABANDONO',
                        severity: 'CRITICAL',
                        message: `Abandono de posto concluído (ausente há ${daysElapsed} dias). Liberado para rescisão por Justa Causa!`,
                        dueDate: format(addDays(startDate, 30), 'dd/MM/yyyy'),
                        daysLeft: 30 - daysElapsed
                    });
                } else {
                    if (daysElapsed >= 3 && !telegram1SentDate) {
                        dismissalAlerts.push({
                            id: `dp-tel1-warn-${emp.id}`,
                            employeeId: emp.id,
                            employeeName: emp.name,
                            type: 'DP_DISMISSAL',
                            category: 'TELEGRAMA',
                            severity: 'WARNING',
                            message: `Enviar 1º telegrama de convocação de retorno (ausente há ${daysElapsed} dias).`,
                            dueDate: format(addDays(startDate, 3), 'dd/MM/yyyy'),
                            daysLeft: 3 - daysElapsed
                        });
                    }
                    if (daysElapsed >= 15 && !telegram2SentDate) {
                        dismissalAlerts.push({
                            id: `dp-tel2-warn-${emp.id}`,
                            employeeId: emp.id,
                            employeeName: emp.name,
                            type: 'DP_DISMISSAL',
                            category: 'TELEGRAMA',
                            severity: 'WARNING',
                            message: `Enviar 2º telegrama / edital oficial (ausente há ${daysElapsed} dias).`,
                            dueDate: format(addDays(startDate, 15), 'dd/MM/yyyy'),
                            daysLeft: 15 - daysElapsed
                        });
                    }
                }
            }
        });
    } catch (err) {
        console.error("Error calculating dismissal alerts:", err);
    }

    return {
        benefitsAlerts,
        experienceAlerts,
        dismissalAlerts,
        alertUserId,
        currentUserId: user.id,
        currentUserRole: user.role,
        systemUsers
    };
}
