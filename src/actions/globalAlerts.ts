"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getBenefitsCalculation } from "@/actions/benefits";
import { addDays, differenceInDays } from "date-fns";

export interface GlobalAlertItem {
    id: string;
    employeeId: string;
    employeeName: string;
    type: 'BENEFIT' | 'EXPERIENCE';
    severity: 'CRITICAL' | 'WARNING';
    message: string;
    dueDate: string;
    daysLeft: number;
}

export async function getGlobalAlerts() {
    const user = await getCurrentUser();
    if (!user) return { benefitsAlerts: [], experienceAlerts: [], alertUserId: null, currentUserId: null };

    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);

    // 1. Fetch benefits config to identify the alert receiver
    const config = await prisma.benefitsConfig.findFirst();
    const alertUserId = config?.alertUserId || null;

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

    // 3. Fetch experience contract alerts
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

            // If daysLeft <= 5, it is an alert (warning or critical)
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

    return {
        benefitsAlerts,
        experienceAlerts,
        alertUserId,
        currentUserId: user.id
    };
}
