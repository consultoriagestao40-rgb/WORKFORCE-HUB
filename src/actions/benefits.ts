"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateRoster } from "@/lib/scheduling";

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
    companyName: string;
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
    vtBaseValue: number;
    vtDeductionValue: number;
    vtTotalValue: number;
    vtDestination: string;
    vtBatchNote?: string;
    vtNeedsAlert?: boolean;

    // VT 2
    vtDailyValue2: number;
    vtBaseValue2: number;
    vtDeductionValue2: number;
    vtTotalValue2: number;
    vtDestination2: string;
    vtBatchNote2?: string;
    vtNeedsAlert2?: boolean;

    // VA
    vaDailyValue: number;
    vaMonthlyValue: number;
    vaBaseValue: number;
    vaDeductionValue: number;
    vaTotalValue: number;
    vaDestination: string;
    vaBatchNote?: string;
    vaNeedsAlert?: boolean;

    // CCT & Payroll Discounts
    vtDiscountPercentage?: number;
    vaDiscountPercentage?: number;
    vtPayrollDiscount?: number;
    vaPayrollDiscount?: number;
    vaMealsProvidedOnSite?: boolean;
    vaPaidOnVacation?: boolean;
    vaVacationDays?: number;
    vaVacationDeduction?: number;

    // Prêmio Absenteísmo (Assiduidade)
    absenteismoAward: number;
    absenteismoPeriod?: string;
    chavePix?: string;
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

function getVacationDaysInMonth(startDate: Date | null, endDate: Date | null, year: number, month: number): number {
    if (!startDate || !endDate) return 0;
    
    // First day of reference month
    const startOfMonth = new Date(year, month - 1, 1);
    // Last day of reference month
    const endOfMonth = new Date(year, month, 0);
    
    // Clamp the vacation dates to the reference month
    const clampStart = new Date(Math.max(startDate.getTime(), startOfMonth.getTime()));
    const clampEnd = new Date(Math.min(endDate.getTime(), endOfMonth.getTime()));
    
    if (clampStart > clampEnd) return 0;
    
    // Calculate difference in days (inclusive)
    const diffTime = Math.abs(clampEnd.getTime() - clampStart.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
}

const FIXED_HOLIDAYS = [
    "01-01", // Confraternização Universal
    "04-21", // Tiradentes
    "05-01", // Dia do Trabalho
    "09-07", // Independência
    "10-12", // N. Sra. Aparecida
    "11-02", // Finados
    "11-15", // Proclamação da República
    "11-20", // Dia da Consciência Negra
    "12-25", // Natal
];

function isHoliday(date: Date): boolean {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateString = `${m}-${d}`; // MM-DD
    return FIXED_HOLIDAYS.includes(dateString);
}

function getVaDaysForDaily(schedule: string, pivotDate: Date, year: number, month: number): number {
    const days: Date[] = [];
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }

    const roster = generateRoster(schedule, pivotDate, days);

    let count = 0;
    for (const item of roster) {
        if (item.status === 'Trabalho') {
            const dayOfWeek = item.date.getDay();
            const isSunday = dayOfWeek === 0;
            if (!isSunday && !isHoliday(item.date)) {
                count++;
            }
        }
    }
    return count;
}

function getNthBusinessDay(year: number, month: number, n: number): Date {
    const date = new Date(year, month - 1, 1);
    let count = 0;
    while (true) {
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        if (!isWeekend && !isHoliday(date)) {
            count++;
            if (count === n) {
                return new Date(date);
            }
        }
        date.setDate(date.getDate() + 1);
    }
}

function getVtDaysForDaily(schedule: string, pivotDate: Date, year: number, month: number): number {
    const startDate = getNthBusinessDay(year, month, 5);
    
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
    }
    const endDate = getNthBusinessDay(nextYear, nextMonth, 4);

    const days: Date[] = [];
    const date = new Date(startDate);
    while (date <= endDate) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }

    const roster = generateRoster(schedule, pivotDate, days);

    let count = 0;
    for (const item of roster) {
        if (item.status === 'Trabalho') {
            const dayOfWeek = item.date.getDay();
            const isSunday = dayOfWeek === 0;
            if (!isSunday && !isHoliday(item.date)) {
                count++;
            }
        }
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
    secullumApiUrl?: string;
    secullumApiToken?: string;
    secullumCompanyId?: string;
    alertUserId?: string;
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
            vaCardDeliveryEstimateDays: Number(data.vaCardDeliveryEstimateDays),
            secullumApiUrl: data.secullumApiUrl || "https://pontowebintegracaoexterna.secullum.com.br",
            secullumApiToken: data.secullumApiToken || null,
            secullumCompanyId: data.secullumCompanyId || null,
            alertUserId: data.alertUserId || null
        }
    });

    revalidatePath("/admin/benefits");
    return { success: true };
}

// 2.1 Get System Users (to select alert manager)
export async function getSystemUsers() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    return await prisma.user.findMany({
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' }
    });
}

// 3. Mark Benefit as Paid
export async function markBenefitAsPaid(data: {
    employeeId: string;
    month: number;
    year: number;
    benefitType: "VT" | "VA" | "AMBOS";
    vtAmount: number;
    vtAmount2?: number;
    vaAmount: number;
    notes?: string;
    customDays?: number;
    customDaysVt?: number;
    customDaysVa?: number;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const config = await getBenefitsConfig();
    const paidAt = new Date();

    // Calculate next payment due date (+5 days for VT, +10 days for VA, or custom days)
    let daysToAdd = 0;
    if (data.customDaysVt !== undefined && data.customDaysVa !== undefined) {
        daysToAdd = Math.min(data.customDaysVt, data.customDaysVa);
    } else if (data.customDaysVt !== undefined) {
        daysToAdd = data.customDaysVt;
    } else if (data.customDaysVa !== undefined) {
        daysToAdd = data.customDaysVa;
    } else if (data.customDays !== undefined) {
        daysToAdd = data.customDays;
    } else {
        daysToAdd = data.benefitType === "VT" ? config.vtFractionDays : config.vaFractionDays;
    }
    const nextPaymentDue = new Date(paidAt);
    nextPaymentDue.setDate(nextPaymentDue.getDate() + daysToAdd);

    await prisma.benefitsPayment.create({
        data: {
            employeeId: data.employeeId,
            month: data.month,
            year: data.year,
            benefitType: data.benefitType,
            vtAmount: Number(data.vtAmount || 0),
            vtAmount2: Number(data.vtAmount2 || 0),
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

// 3.1 Mark Multiple Benefits as Paid (Batch Payment)
export async function markMultipleBenefitsAsPaid(data: {
    items: {
        employeeId: string;
        benefitType: "VT" | "VA" | "AMBOS";
        vtAmount: number;
        vtAmount2?: number;
        vaAmount: number;
    }[];
    month: number;
    year: number;
    notes?: string;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const config = await getBenefitsConfig();
    const paidAt = new Date();

    const paymentCreates = data.items.map(item => {
        const daysToAdd = item.benefitType === "VT" ? config.vtFractionDays : config.vaFractionDays;
        const nextPaymentDue = new Date(paidAt);
        nextPaymentDue.setDate(nextPaymentDue.getDate() + daysToAdd);

        return prisma.benefitsPayment.create({
            data: {
                employeeId: item.employeeId,
                month: data.month,
                year: data.year,
                benefitType: item.benefitType,
                vtAmount: Number(item.vtAmount || 0),
                vtAmount2: Number(item.vtAmount2 || 0),
                vaAmount: Number(item.vaAmount || 0),
                paidAt,
                paidByUserId: user?.id,
                nextPaymentDue,
                notes: data.notes || "Pago em lote via Painel de Benefícios"
            }
        });
    });

    await prisma.$transaction(paymentCreates);

    revalidatePath("/admin/benefits");
    return { success: true };
}

// 4. Main Benefits Calculation Action
export async function getBenefitsCalculation(year: number, month: number) {
    const user = await getCurrentUser();
    if (!user) return { items: [], config: null, currentUserId: null };

    const config = await getBenefitsConfig();

    // Calculate window dates: Day 26 of (month-2) to Day 25 of (month-1)
    // E.g. for July (month 7), the occurrences window is May 26 (month 5) to June 25 (month 6)
    let startMonth = month - 2;
    let startYear = year;
    if (startMonth <= 0) {
        startMonth += 12;
        startYear -= 1;
    }

    let endMonth = month - 1;
    let endYear = year;
    if (endMonth <= 0) {
        endMonth += 12;
        endYear -= 1;
    }

    const windowStart = new Date(startYear, startMonth - 1, config.payrollCutoffStartDay, 0, 0, 0);
    const windowEnd = new Date(endYear, endMonth - 1, config.payrollCutoffEndDay, 23, 59, 59);

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
            company: true,
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

    // Fetch quarterly occurrences for absenteismo evaluation (last 3 months)
    const quarterlyStart = new Date(endYear, endMonth - 3, config.payrollCutoffStartDay);
    const quarterlyEnd = new Date(endYear, endMonth - 1, config.payrollCutoffEndDay);
    const quarterlyOccurrences = await prisma.occurrence.findMany({
        where: {
            date: { gte: quarterlyStart, lte: quarterlyEnd },
            type: { in: ["FALTA", "FALTA_INJUSTIFICADA", "ATESTADO"] }
        },
        select: { employeeId: true }
    });
    const quarterlyFailsSet = new Set(quarterlyOccurrences.map(o => o.employeeId).filter(Boolean) as string[]);

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

        // Deductions count & list from 26-25 window (only on/after admission date)
        const filteredOccurrences = (emp.occurrences || []).filter(occ => {
            const occurrenceDate = new Date(occ.date);
            const occurrenceDay = new Date(occurrenceDate.getFullYear(), occurrenceDate.getMonth(), occurrenceDate.getDate());
            const admissionDay = new Date(admissionDateObj.getFullYear(), admissionDateObj.getMonth(), admissionDateObj.getDate());
            return occurrenceDay >= admissionDay;
        });

        const occurrencesList: BenefitOccurrenceDetail[] = filteredOccurrences.map(occ => ({
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
        }        // Base VT value priority: Employee record -> 0.
        const baseVtValue = emp.valeTransporte || 0;
        const baseVtValue2 = emp.valeTransporte2 || 0;

        // Base VA value priority: Employee record -> 0. (Meals provided override to 494.00 if employee receives VA)
        const mealsProvided = !!posto?.vaMealsProvidedOnSite;
        const rawBaseVaValue = emp.valeAlimentacao || 0;
        const baseVaValue = (rawBaseVaValue > 0 && mealsProvided) ? 494.00 : rawBaseVaValue;
        // Determine if VT value is stored as Monthly (> 40) or Daily (<= 40)
        // Standard working/scale days for VT is 22 days.
        const isVtMonthly = baseVtValue > 40;
        const vtDailyValue = isVtMonthly 
            ? Math.round((baseVtValue / 22) * 100) / 100 
            : baseVtValue;

        const isVtMonthly2 = baseVtValue2 > 40;
        const vtDailyValue2 = isVtMonthly2
            ? Math.round((baseVtValue2 / 22) * 100) / 100
            : baseVtValue2;

        const pivotDateForVt = activeAssignment?.startDate ? new Date(activeAssignment.startDate) : admissionDateObj;
        const scheduledWorkDays = getVtDaysForDaily(posto?.schedule || "5x2", pivotDateForVt, year, month);

        // VT Calculation
        let vtBaseValue = 0;
        let vtDeductionValue = 0;
        let vtTotalValue = 0;
        let vtNeedsAlert = false;
        let vtBatchNote = "";

        if (!emp.vtOptIn) {
            vtBaseValue = 0;
            vtDeductionValue = 0;
            vtTotalValue = 0;
            vtBatchNote = "Não Optante pelo VT";
        } else if (isNewHire) {
            // New hire fracionated VT: 5-day batches
            vtBaseValue = Math.round((vtDailyValue * config.vtFractionDays) * 100) / 100;
            vtDeductionValue = 0;
            vtTotalValue = vtBaseValue;
            vtNeedsAlert = true;
            vtBatchNote = `Lote de 5 Dias (Admissão em ${admissionDateObj.toLocaleDateString('pt-BR')})`;
        } else {
            // Regular month VT
            if (isVtMonthly) {
                vtBaseValue = baseVtValue;
                vtDeductionValue = Math.round((occurrencesCount * vtDailyValue) * 100) / 100;
            } else {
                vtBaseValue = Math.round((scheduledWorkDays * vtDailyValue) * 100) / 100;
                vtDeductionValue = Math.round((vtDailyValue * occurrencesCount) * 100) / 100;
                vtBatchNote = `${scheduledWorkDays} dias de escala x R$ ${vtDailyValue.toFixed(2)}`;
            }
            vtTotalValue = Math.max(0, Math.round((vtBaseValue - vtDeductionValue) * 100) / 100);

            if (occurrencesCount > 0) {
                if (vtBatchNote) {
                    vtBatchNote += ` | ${occurrencesCount} falta(s) abatida(s) no período 26-25`;
                } else {
                    vtBatchNote = `${occurrencesCount} falta(s)/atestado(s) abatido(s) no período 26-25`;
                }
            }
        }

        // VT 2 Calculation
        let vtBaseValue2 = 0;
        let vtDeductionValue2 = 0;
        let vtTotalValue2 = 0;
        let vtNeedsAlert2 = false;
        let vtBatchNote2 = "";

        if (!emp.vtOptIn) {
            vtBaseValue2 = 0;
            vtDeductionValue2 = 0;
            vtTotalValue2 = 0;
            vtBatchNote2 = "Não Optante pelo VT";
        } else if (isNewHire) {
            // New hire fracionated VT: 5-day batches
            vtBaseValue2 = Math.round((vtDailyValue2 * config.vtFractionDays) * 100) / 100;
            vtDeductionValue2 = 0;
            vtTotalValue2 = vtBaseValue2;
            vtNeedsAlert2 = true;
            vtBatchNote2 = `Lote de 5 Dias (Admissão em ${admissionDateObj.toLocaleDateString('pt-BR')})`;
        } else {
            // Regular month VT
            if (isVtMonthly2) {
                vtBaseValue2 = baseVtValue2;
                vtDeductionValue2 = Math.round((occurrencesCount * vtDailyValue2) * 100) / 100;
            } else {
                vtBaseValue2 = Math.round((scheduledWorkDays * vtDailyValue2) * 100) / 100;
                vtDeductionValue2 = Math.round((vtDailyValue2 * occurrencesCount) * 100) / 100;
                vtBatchNote2 = `${scheduledWorkDays} dias de escala x R$ ${vtDailyValue2.toFixed(2)}`;
            }
            vtTotalValue2 = Math.max(0, Math.round((vtBaseValue2 - vtDeductionValue2) * 100) / 100);

            if (occurrencesCount > 0) {
                if (vtBatchNote2) {
                    vtBatchNote2 += ` | ${occurrencesCount} falta(s) abatida(s) no período 26-25`;
                } else {
                    vtBatchNote2 = `${occurrencesCount} falta(s)/atestado(s) abatido(s) no período 26-25`;
                }
            }
        }

        // VA Calculation

        const isVaDiario = posto?.vaType === "diario";
        const vaDailyRate = isVaDiario
            ? (emp.valeAlimentacao > 0 && emp.valeAlimentacao <= 50 ? emp.valeAlimentacao : 0)
            : baseVaValue;

        const isVaMonthly = !isVaDiario && (vaDailyRate > 50);
        const vaDailyValue = isVaMonthly
            ? Math.round((vaDailyRate / 30) * 100) / 100
            : vaDailyRate;

        // Vacation variables
        const vacationDays = getVacationDaysInMonth(emp.lastVacationStart, emp.lastVacationEnd, year, month);
        const paidOnVacation = posto?.vaPaidOnVacation !== false; // default to true
        let vaVacationDeduction = 0;

        let vaBaseValue = 0;
        let vaDeductionValue = 0;
        let vaTotalValue = 0;
        let vaNeedsAlert = false;
        let vaBatchNote = "";

        if (isNewHire) {
            // New hire fracionated VA: 10-day batches after card delivery
            const daysSinceAdmission = Math.floor((now.getTime() - admissionDateObj.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceAdmission < config.vaCardDeliveryEstimateDays) {
                vaBaseValue = 0;
                vaDeductionValue = 0;
                vaTotalValue = 0;
                vaNeedsAlert = true;
                vaBatchNote = `Aguardando entrega do cartão (~10 dias da admissão em ${admissionDateObj.toLocaleDateString('pt-BR')})`;
            } else {
                // Fractioned 10 days
                const rateForFraction = isVaDiario ? vaDailyRate : (vaDailyRate > 50 ? (vaDailyRate / 30) : vaDailyRate);
                vaBaseValue = Math.round((rateForFraction * config.vaFractionDays) * 100) / 100;
                vaDeductionValue = 0;
                vaTotalValue = vaBaseValue;
                vaNeedsAlert = true;
                vaBatchNote = `Lote de 10 Dias (Cartão entregue em ${admissionDateObj.toLocaleDateString('pt-BR')})`;
            }
        } else {
            // Regular month VA
            if (isVaDiario) {
                const pivotDate = activeAssignment?.startDate ? new Date(activeAssignment.startDate) : admissionDateObj;
                const scheduledWorkDays = getVaDaysForDaily(posto?.schedule || "5x2", pivotDate, year, month);
                
                vaBaseValue = Math.round((scheduledWorkDays * vaDailyRate) * 100) / 100;
                vaDeductionValue = Math.round((occurrencesCount * vaDailyRate) * 100) / 100;
                
                if (!paidOnVacation && vacationDays > 0) {
                    const estVacationWorkDays = Math.min(scheduledWorkDays, Math.round(vacationDays * (scheduledWorkDays / 30)));
                    vaVacationDeduction = Math.round((estVacationWorkDays * vaDailyRate) * 100) / 100;
                }
                
                vaTotalValue = Math.max(0, Math.round((vaBaseValue - vaDeductionValue - vaVacationDeduction) * 100) / 100);
                
                vaBatchNote = `${scheduledWorkDays} dias de escala (excl. fds/feriados) x R$ ${vaDailyRate.toFixed(2)}`;
                if (occurrencesCount > 0) {
                    vaBatchNote += ` | ${occurrencesCount} falta(s) abatida(s) no período 26-25`;
                }
                if (vaVacationDeduction > 0) {
                    vaBatchNote += ` | ${vacationDays} dias de férias abatidos (-R$ ${vaVacationDeduction.toFixed(2)})`;
                }
            } else {
                const isVaMonthly = vaDailyRate > 50;
                if (isVaMonthly) {
                    vaBaseValue = vaDailyRate;
                    const dailyDeductionRate = vaDailyRate / 30;
                    vaDeductionValue = Math.round((occurrencesCount * dailyDeductionRate) * 100) / 100;
                    
                    if (!paidOnVacation && vacationDays > 0) {
                        vaVacationDeduction = Math.min(vaBaseValue, Math.round((vacationDays * dailyDeductionRate) * 100) / 100);
                    }
                } else {
                    vaBaseValue = Math.round((vaDailyRate * 30) * 100) / 100;
                    vaDeductionValue = Math.round((vaDailyRate * occurrencesCount) * 100) / 100;
                    
                    if (!paidOnVacation && vacationDays > 0) {
                        vaVacationDeduction = Math.min(vaBaseValue, Math.round((vacationDays * vaDailyRate) * 100) / 100);
                    }
                }
                vaTotalValue = Math.max(0, Math.round((vaBaseValue - vaDeductionValue - vaVacationDeduction) * 100) / 100);

                if (occurrencesCount > 0) {
                    vaBatchNote = `${occurrencesCount} falta(s)/atestado(s) abatido(s) no período 26-25`;
                }
                if (vaVacationDeduction > 0) {
                    if (vaBatchNote) {
                        vaBatchNote += ` | ${vacationDays} dias de férias abatidos (-R$ ${vaVacationDeduction.toFixed(2)})`;
                    } else {
                        vaBatchNote = `${vacationDays} dias de férias abatidos (-R$ ${vaVacationDeduction.toFixed(2)})`;
                    }
                }
            }
        }

        // Payroll Discounts calculations
        let vtDiscountPercentage = 6.0;
        let vtPayrollDiscount = 0;
        if (emp.vtOptIn) {
            vtDiscountPercentage = emp.vtDiscountPercentage !== null && emp.vtDiscountPercentage !== undefined
                ? emp.vtDiscountPercentage
                : (posto?.vtDiscountPercentage !== null && posto?.vtDiscountPercentage !== undefined ? posto.vtDiscountPercentage : 6.0);
            
            const rawDiscount = Math.round((emp.salary * (vtDiscountPercentage / 100)) * 100) / 100;
            vtPayrollDiscount = Math.min(rawDiscount, vtTotalValue + vtTotalValue2);
        }

        const vaDiscountPercentage = emp.vaDiscountPercentage !== null && emp.vaDiscountPercentage !== undefined
            ? emp.vaDiscountPercentage
            : (posto?.vaDiscountPercentage !== null && posto?.vaDiscountPercentage !== undefined ? posto.vaDiscountPercentage : 20.0);
        
        const vaPayrollDiscount = Math.round((vaBaseValue * (vaDiscountPercentage / 100)) * 100) / 100;

        // Payment destinations
        const vtDestination = emp.vtPaymentMethod === "Outro"
            ? (emp.vtCustomPaymentDetails || "Outro")
            : (emp.vtPaymentMethod || "Metrocard Metropolitana");

        const vtDestination2 = emp.vtPaymentMethod2 === "Outro"
            ? (emp.vtCustomPaymentDetails2 || "Outro")
            : (emp.vtPaymentMethod2 || "Urbs");

        const vaDestination = emp.vaPaymentMethod === "Outro"
            ? (emp.vaCustomPaymentDetails || "Outro")
            : (emp.vaPaymentMethod || "Cartão Caju");

        // Prêmio de Absenteísmo (Assiduidade) - pago via Caju (Benefits)
        let absenteismoAward = 0;
        const absenteismoPeriod = posto?.absenteismoAwardPeriod || "mensal";
        
        // Count faltas and atestados inside occurrencesList
        const faltasCount = occurrencesList.filter(o => o.type !== "Atestado Médico").length;
        const atestadosCount = occurrencesList.filter(o => o.type === "Atestado Médico").length;

        if (posto && posto.absenteismoAwardValue > 0) {
            const minDays = posto.absenteismoMinDays || 0;
            const daysSinceAdmission = Math.floor((windowEnd.getTime() - admissionDateObj.getTime()) / (1000 * 60 * 60 * 24));
            
            // Check experience period (probation limit)
            const meetsExperience = minDays === 0 || daysSinceAdmission >= minDays;

            // Check full month worked
            const isFullMonth = !isNewHire || posto.absenteismoAwardType === "prorrata";

            if (meetsExperience && isFullMonth) {
                let baseValue = posto.absenteismoAwardValue;
                
                // Pro-rata calculation
                if (isNewHire && posto.absenteismoAwardType === "prorrata") {
                    const totalDaysInMonth = new Date(year, month, 0).getDate();
                    const daysWorked = totalDaysInMonth - admissionDateObj.getDate() + 1;
                    baseValue = Math.round(((posto.absenteismoAwardValue / totalDaysInMonth) * daysWorked) * 100) / 100;
                }

                if (absenteismoPeriod === "mensal") {
                    if (faltasCount === 0 && atestadosCount === 0) {
                        absenteismoAward = baseValue;
                    }
                } else if (absenteismoPeriod === "trimestral") {
                    if (!quarterlyFailsSet.has(emp.id)) {
                        absenteismoAward = baseValue;
                    }
                }
            }
        }

        return {
            employeeId: emp.id,
            employeeName: emp.name,
            employeeCpf: emp.cpf,
            chavePix: (emp.extraFields as any)?.chavePix || "",
            postoName,
            clientName,
            companyName: emp.company?.name || "Sem Empresa",
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
            vtWorkingDays: 22,
            vtBaseValue,
            vtDeductionValue,
            vtTotalValue,
            vtDestination,
            vtBatchNote,
            vtNeedsAlert,
            vtDailyValue2,
            vtBaseValue2,
            vtDeductionValue2,
            vtTotalValue2,
            vtDestination2,
            vtBatchNote2,
            vtNeedsAlert2,
            vaDailyValue,
            vaMonthlyValue: vaBaseValue,
            vaBaseValue,
            vaDeductionValue,
            vaTotalValue,
            vaDestination,
            vaBatchNote,
            vaNeedsAlert,
            vtDiscountPercentage,
            vaDiscountPercentage,
            vtPayrollDiscount,
            vaPayrollDiscount,
            vaMealsProvidedOnSite: mealsProvided,
            vaPaidOnVacation: paidOnVacation,
            vaVacationDeduction,
            absenteismoAward,
            absenteismoPeriod
        };
    });

    return { items, config, currentUserId: user.id };
}
