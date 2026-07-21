"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface BenefitOccurrenceDetail {
    id: string;
    date: string;
    type: string;
    notes?: string;
}

export interface BenefitsCalculationItem {
    employeeId: string;
    employeeName: string;
    employeeCpf: string;
    postoName: string;
    clientName: string;
    roleName: string;
    admissionDate: string;
    isNewHire: boolean;
    
    // Ocorrências Detalhadas (26 a 25)
    occurrencesList: BenefitOccurrenceDetail[];
    vtOccurrencesDeducted: number;
    vaOccurrencesDeducted: number;

    // Pagamentos / Datas
    isPaid: boolean;
    paidAt?: string;
    lastPaymentDate?: string;
    nextPaymentDueDate?: string;

    // VT
    vtOptIn: boolean;
    vtDailyValue: number;
    vtWorkingDays: number;
    vtTotalValue: number;
    vtDestination: string;
    vtBatchNote?: string;
    vtNeedsAlert?: boolean;

    // VA
    vaMonthlyValue: number;
    vaTotalValue: number;
    vaDestination: string;
    vaBatchNote?: string;
    vaNeedsAlert?: boolean;
}

// Helper: Calculate business days in a month (excluding weekends)
function getBusinessDaysInMonth(year: number, month: number): number {
    let count = 0;
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
            count++;
        }
        date.setDate(date.getDate() + 1);
    }
    return count;
}

// 1. Get or Create Config
export async function getBenefitsConfig() {
    let config = await prisma.benefitsConfig.findFirst();
    if (!config) {
        config = await prisma.benefitsConfig.create({
            data: {
                payrollCutoffStartDay: 26,
                payrollCutoffEndDay: 25,
                payrollPaymentDay: 5,
                vtFractionDays: 5,
                vaFractionDays: 10,
                vaCardDeliveryEstimateDays: 10
            }
        });
    }
    return config;
}

// 2. Update Config
export async function updateBenefitsConfig(data: {
    payrollCutoffStartDay: number;
    payrollCutoffEndDay: number;
    payrollPaymentDay: number;
    vtFractionDays: number;
    vaFractionDays: number;
    vaCardDeliveryEstimateDays: number;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const config = await getBenefitsConfig();

    await prisma.benefitsConfig.update({
        where: { id: config.id },
        data: {
            payrollCutoffStartDay: Number(data.payrollCutoffStartDay),
            payrollCutoffEndDay: Number(data.payrollCutoffEndDay),
            payrollPaymentDay: Number(data.payrollPaymentDay),
            vtFractionDays: Number(data.vtFractionDays),
            vaFractionDays: Number(data.vaFractionDays),
            vaCardDeliveryEstimateDays: Number(data.vaCardDeliveryEstimateDays)
        }
    });

    revalidatePath("/admin/benefits");
    return { success: true };
}

// 3. Mark Benefit as Paid
export async function markBenefitAsPaid(data: {
    employeeId: string;
    month: number;
    year: number;
    benefitType: "VT" | "VA" | "AMBOS";
    vtAmount: number;
    vaAmount: number;
    notes?: string;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const config = await getBenefitsConfig();
    const paidAt = new Date();

    // Calculate next payment due date (+5 days for VT, +10 days for VA)
    const daysToAdd = data.benefitType === "VT" ? config.vtFractionDays : config.vaFractionDays;
    const nextPaymentDue = new Date(paidAt);
    nextPaymentDue.setDate(nextPaymentDue.getDate() + daysToAdd);

    await prisma.benefitsPayment.create({
        data: {
            employeeId: data.employeeId,
            month: data.month,
            year: data.year,
            benefitType: data.benefitType,
            vtAmount: Number(data.vtAmount || 0),
            vaAmount: Number(data.vaAmount || 0),
            paidAt,
            paidByUserId: user?.id,
            nextPaymentDue,
            notes: data.notes || "Pago via Painel de Benefícios"
        }
    });

    revalidatePath("/admin/benefits");
    return { success: true };
}

// 4. Main Benefits Calculation Action
export async function getBenefitsCalculation(year: number, month: number) {
    const user = await getCurrentUser();
    if (!user) return { items: [], config: null };

    const config = await getBenefitsConfig();

    // Calculate window dates: Day 26 of previous month to Day 25 of current month
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const windowStart = new Date(prevYear, prevMonth - 1, config.payrollCutoffStartDay, 0, 0, 0);
    const windowEnd = new Date(year, month - 1, config.payrollCutoffEndDay, 23, 59, 59);

    const businessDaysInMonth = getBusinessDaysInMonth(year, month);

    // Fetch active employees with active assignments (matching Workforce count)
    const employees = await prisma.employee.findMany({
        where: {
            status: "Ativo",
            situation: {
                name: { notIn: ["Desligado", "Demitido"] }
            },
            assignments: {
                some: { endDate: null }
            }
        },
        include: {
            role: true,
            assignments: {
                where: { endDate: null },
                include: {
                    posto: {
                        include: { client: true, role: true }
                    }
                }
            },
            occurrences: {
                where: {
                    date: {
                        gte: windowStart,
                        lte: windowEnd
                    },
                    type: { in: ["FALTA", "ATESTADO", "FALTA_INJUSTIFICADA"] }
                },
                orderBy: { date: "asc" }
            },
            benefitPayments: {
                where: {
                    month,
                    year
                },
                orderBy: { paidAt: "desc" }
            }
        },
        orderBy: { name: "asc" }
    });

    const now = new Date();

    const items: BenefitsCalculationItem[] = employees.map(emp => {
        const activeAssignment = emp.assignments && emp.assignments.length > 0 ? emp.assignments[0] : null;
        const posto = activeAssignment?.posto;

        const postoName = posto ? (posto.role?.name || "Posto") : "Sem Posto";
        const clientName = posto?.client ? posto.client.name : "Interno";
        const roleName = emp.role ? emp.role.name : "Cargo não informado";

        const admissionDateObj = new Date(emp.admissionDate);
        const admissionMonth = admissionDateObj.getMonth() + 1;
        const admissionYear = admissionDateObj.getFullYear();

        const isNewHire = (admissionMonth === month && admissionYear === year);

        // Deductions count & list from 26-25 window
        const occurrencesList: BenefitOccurrenceDetail[] = (emp.occurrences || []).map(occ => ({
            id: occ.id,
            date: new Date(occ.date).toLocaleDateString('pt-BR'),
            type: occ.type === "FALTA_INJUSTIFICADA" ? "Falta Injustificada" : (occ.type === "ATESTADO" ? "Atestado Médico" : "Falta"),
            notes: occ.description || occ.title || undefined
        }));

        const occurrencesCount = occurrencesList.length;

        // Payments Info
        const lastPayment = emp.benefitPayments && emp.benefitPayments.length > 0 ? emp.benefitPayments[0] : null;
        const isPaid = !!lastPayment;
        const paidAt = lastPayment ? new Date(lastPayment.paidAt).toLocaleString('pt-BR') : undefined;
        const lastPaymentDate = lastPayment ? new Date(lastPayment.paidAt).toLocaleDateString('pt-BR') : undefined;
        
        let nextPaymentDueDate: string | undefined = undefined;

        if (lastPayment?.nextPaymentDue) {
            nextPaymentDueDate = new Date(lastPayment.nextPaymentDue).toLocaleDateString('pt-BR');
        } else if (isNewHire) {
            // Default next due date: 5 days after admission for VT
            const defaultNextDue = new Date(admissionDateObj);
            defaultNextDue.setDate(defaultNextDue.getDate() + config.vtFractionDays);
            nextPaymentDueDate = defaultNextDue.toLocaleDateString('pt-BR');
        }

        // Base VT value priority: Employee record -> Posto record -> 0
        const baseVtValue = emp.valeTransporte > 0 ? emp.valeTransporte : (posto?.valeTransporte || 0);

        // Base VA value priority: Employee record -> Posto record -> 0
        const baseVaValue = emp.valeAlimentacao > 0 ? emp.valeAlimentacao : (posto?.valeAlimentacao || 0);

        // Determine if VT value is stored as Monthly (> 40) or Daily (<= 40)
        const isVtMonthly = baseVtValue > 40;
        const vtDailyValue = isVtMonthly 
            ? Math.round((baseVtValue / Math.max(1, businessDaysInMonth)) * 100) / 100 
            : baseVtValue;

        // VT Calculation
        let vtTotalValue = 0;
        let vtNeedsAlert = false;
        let vtBatchNote = "";

        if (!emp.vtOptIn) {
            vtTotalValue = 0;
            vtBatchNote = "Não Optante pelo VT";
        } else if (isNewHire) {
            // New hire fracionated VT: 5-day batches
            vtTotalValue = Math.round((vtDailyValue * config.vtFractionDays) * 100) / 100;
            vtNeedsAlert = true;
            vtBatchNote = `Lote de 5 Dias (Admissão em ${admissionDateObj.toLocaleDateString('pt-BR')})`;
        } else {
            // Regular month VT
            if (isVtMonthly) {
                const vtDeduction = occurrencesCount * vtDailyValue;
                vtTotalValue = Math.max(0, Math.round((baseVtValue - vtDeduction) * 100) / 100);
            } else {
                const netVtDays = Math.max(0, businessDaysInMonth - occurrencesCount);
                vtTotalValue = Math.round((baseVtValue * netVtDays) * 100) / 100;
            }
            if (occurrencesCount > 0) {
                vtBatchNote = `${occurrencesCount} falta(s)/atestado(s) abatido(s) no período 26-25`;
            }
        }

        // VA Calculation
        let vaTotalValue = 0;
        let vaNeedsAlert = false;
        let vaBatchNote = "";

        const isVaMonthly = baseVaValue > 50;

        if (isNewHire) {
            // New hire fracionated VA: 10-day batches after card delivery
            const daysSinceAdmission = Math.floor((now.getTime() - admissionDateObj.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceAdmission < config.vaCardDeliveryEstimateDays) {
                vaTotalValue = 0;
                vaNeedsAlert = true;
                vaBatchNote = `Aguardando entrega do cartão (~10 dias da admissão em ${admissionDateObj.toLocaleDateString('pt-BR')})`;
            } else {
                // Fractioned 10 days
                const dailyVaRate = isVaMonthly ? (baseVaValue / 30) : baseVaValue;
                vaTotalValue = Math.round((dailyVaRate * config.vaFractionDays) * 100) / 100;
                vaNeedsAlert = true;
                vaBatchNote = `Lote de 10 Dias (Cartão entregue em ${admissionDateObj.toLocaleDateString('pt-BR')})`;
            }
        } else {
            // Regular month VA
            if (isVaMonthly) {
                const dailyDeductionRate = baseVaValue / 30;
                const totalDeduction = occurrencesCount * dailyDeductionRate;
                vaTotalValue = Math.max(0, Math.round((baseVaValue - totalDeduction) * 100) / 100);
            } else {
                const netDays = Math.max(0, businessDaysInMonth - occurrencesCount);
                vaTotalValue = Math.round((baseVaValue * netDays) * 100) / 100;
            }

            if (occurrencesCount > 0) {
                vaBatchNote = `${occurrencesCount} falta(s)/atestado(s) abatido(s) no período 26-25`;
            }
        }

        // Payment destinations
        const vtDestination = emp.vtPaymentMethod === "Outro"
            ? (emp.vtCustomPaymentDetails || "Outro")
            : (emp.vtPaymentMethod || "Metrocard Metropolitana");

        const vaDestination = emp.vaPaymentMethod === "Outro"
            ? (emp.vaCustomPaymentDetails || "Outro")
            : (emp.vaPaymentMethod || "Cartão Caju");

        return {
            employeeId: emp.id,
            employeeName: emp.name,
            employeeCpf: emp.cpf,
            postoName,
            clientName,
            roleName,
            admissionDate: admissionDateObj.toLocaleDateString('pt-BR'),
            isNewHire,
            occurrencesList,
            vtOccurrencesDeducted: occurrencesCount,
            vaOccurrencesDeducted: occurrencesCount,
            isPaid,
            paidAt,
            lastPaymentDate,
            nextPaymentDueDate,
            vtOptIn: emp.vtOptIn,
            vtDailyValue,
            vtWorkingDays: businessDaysInMonth,
            vtTotalValue,
            vtDestination,
            vtBatchNote,
            vtNeedsAlert,
            vaMonthlyValue: baseVaValue,
            vaTotalValue,
            vaDestination,
            vaBatchNote,
            vaNeedsAlert
        };
    });

    return { items, config };
}
