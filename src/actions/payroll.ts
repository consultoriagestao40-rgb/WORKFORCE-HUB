"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getBenefitsCalculation } from "./benefits";

export interface PayrollOccurrenceDetail {
    id: string;
    date: string;
    type: string;
    notes?: string;
    rawType?: string;
}

export interface PayrollPreviewItem {
    employeeId: string;
    employeeName: string;
    employeeCpf: string;
    companyName: string;
    clientName: string;
    postoName: string;
    baseSalary: number;
    insalubridade: number;
    periculosidade: number;
    gratificacao: number;
    outrosAdicionais: number;
    totalGrossSalary: number;
    
    // Occurrences
    faltasCount: number;
    atestadosCount: number;
    occurrencesList: PayrollOccurrenceDetail[];
    faltaDeduction: number;
    dsrDeductionsCount: number;
    dsrDeduction: number;
    
    // Benefits Discounts
    vtPayrollDiscount: number;
    vtDiscountPercentage: number;
    vaPayrollDiscount: number;
    vaDiscountPercentage: number;
    
    // Taxes
    inssDeduction: number;
    irrfDeduction: number;

    // Proventos e Descontos Avulsos / Secullum
    ajudaCusto: number;
    adicionalViagem: number;
    dependentsCount: number;
    salarioFamilia: number;
    absenteismoAward: number;
    atrasosHours: number;
    atrasosDeduction: number;
    extras50Hours: number;
    horasExtras50Value: number;
    extras100Hours: number;
    horasExtras100Value: number;
    adicionalNoturnoHours: number;
    adicionalNoturnoValue: number;
    
    // Net
    totalDeductions: number;
    netSalary: number;

    // Proration detail
    isAdmittedThisMonth: boolean;
    admissionDate: string;
    daysWorked: number;
    totalDaysInMonth: number;
    originalSalary: number;
}

function getUniqueWeeksCount(dates: Date[]): number {
    const uniqueWeeks = new Set<string>();
    for (const date of dates) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        const sunday = new Date(d.setDate(diff));
        const weekKey = `${sunday.getFullYear()}-${sunday.getMonth() + 1}-${sunday.getDate()}`;
        uniqueWeeks.add(weekKey);
    }
    return uniqueWeeks.size;
}

export async function getPayrollPreview(year: number, month: number) {
    const user = await getCurrentUser();
    if (!user) return { items: [], currentUserId: null };

    // Occurrences window: 26 of (month-1) to 25 of (month)
    let startMonth = month - 1;
    let startYear = year;
    if (startMonth <= 0) {
        startMonth += 12;
        startYear -= 1;
    }
    const windowStart = new Date(startYear, startMonth - 1, 26);
    const windowEnd = new Date(year, month - 1, 25);

    // Fetch active employees
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
                    type: { in: ["FALTA", "FALTA_INJUSTIFICADA", "ATESTADO"] }
                },
                orderBy: { date: "asc" }
            },
            monthlyCalculations: {
                where: { year, month }
            }
        },
        orderBy: { name: "asc" }
    });

    // Fetch quarterly occurrences for absenteismo evaluation (last 3 months)
    const quarterlyStart = new Date(year, month - 3, 26);
    const quarterlyEnd = new Date(year, month - 1, 25);
    const quarterlyOccurrences = await prisma.occurrence.findMany({
        where: {
            date: { gte: quarterlyStart, lte: quarterlyEnd },
            type: { in: ["FALTA", "FALTA_INJUSTIFICADA", "ATESTADO"] }
        },
        select: { employeeId: true }
    });
    const quarterlyFailsSet = new Set(quarterlyOccurrences.map(o => o.employeeId).filter(Boolean) as string[]);

    // Real VT/VA values for month M to compute CCT cap
    const benefitsRes = await getBenefitsCalculation(year, month);
    const benefitsMap = new Map(benefitsRes.items.map(b => [b.employeeId, b]));

    const totalDaysInMonth = new Date(year, month, 0).getDate();

    const items: PayrollPreviewItem[] = employees.map(emp => {
        const activeAssignment = emp.assignments && emp.assignments.length > 0 ? emp.assignments[0] : null;
        const posto = activeAssignment?.posto;

        const companyName = emp.company?.name || "Sem Empresa";
        const clientName = posto?.client ? posto.client.name : "Interno";
        const postoName = posto ? (posto.role?.name || "Posto") : "Sem Posto";

        // Pro-rata based on admission date
        const admissionDateObj = new Date(emp.admissionDate);
        const admissionYear = admissionDateObj.getFullYear();
        const admissionMonth = admissionDateObj.getMonth() + 1;
        const isAdmittedThisMonth = (admissionYear === year && admissionMonth === month);

        let daysWorked = totalDaysInMonth;
        let baseSalary = emp.salary;
        let insalubridade = emp.insalubridade;
        let periculosidade = emp.periculosidade;
        let gratificacao = emp.gratificacao;
        let outrosAdicionais = emp.outrosAdicionais;

        if (isAdmittedThisMonth) {
            daysWorked = totalDaysInMonth - admissionDateObj.getDate() + 1;
            baseSalary = Math.round(((emp.salary / totalDaysInMonth) * daysWorked) * 100) / 100;
            insalubridade = Math.round(((emp.insalubridade / totalDaysInMonth) * daysWorked) * 100) / 100;
            periculosidade = Math.round(((emp.periculosidade / totalDaysInMonth) * daysWorked) * 100) / 100;
            gratificacao = Math.round(((emp.gratificacao / totalDaysInMonth) * daysWorked) * 100) / 100;
            outrosAdicionais = Math.round(((emp.outrosAdicionais / totalDaysInMonth) * daysWorked) * 100) / 100;
        }

        const totalGrossSalaryBase = baseSalary + insalubridade + periculosidade + gratificacao + outrosAdicionais;

        // Occurrences list & count in payroll window
        const occurrencesList = (emp.occurrences || []).map(occ => ({
            id: occ.id,
            date: new Date(occ.date).toLocaleDateString('pt-BR'),
            type: occ.type === "ATESTADO" ? "Atestado Médico" : (occ.type === "FALTA_INJUSTIFICADA" ? "Falta Injustificada" : "Falta"),
            notes: occ.description || occ.title || undefined,
            rawType: occ.type
        }));
        const faltasCount = occurrencesList.filter(o => o.rawType === "FALTA" || o.rawType === "FALTA_INJUSTIFICADA").length;
        const atestadosCount = occurrencesList.filter(o => o.rawType === "ATESTADO").length;

        // DSR Deduction: count of unique weeks with at least one FALTA / FALTA_INJUSTIFICADA
        const faltaDates = emp.occurrences
            .filter(occ => occ.type === "FALTA" || occ.type === "FALTA_INJUSTIFICADA")
            .map(occ => new Date(occ.date));
        const dsrDeductionsCount = getUniqueWeeksCount(faltaDates);

        // Absence and DSR deductions based on full fixed salary + additionals / 30
        const fullFixedSalary = emp.salary + emp.insalubridade + emp.periculosidade + emp.gratificacao + emp.outrosAdicionais;
        const dailyRate = fullFixedSalary / 30;
        const faltaDeduction = Math.round((dailyRate * faltasCount) * 100) / 100;
        const dsrDeduction = Math.round((dailyRate * dsrDeductionsCount) * 100) / 100;

        // Secullum Calculations (Atrasos, Horas Extras, Adicional Noturno)
        const calc = emp.monthlyCalculations && emp.monthlyCalculations.length > 0 ? emp.monthlyCalculations[0] : null;
        const atrasosHours = calc?.atrasosHours || 0;
        const extras50Hours = calc?.extras50Hours || 0;
        const extras100Hours = calc?.extras100Hours || 0;
        const adicionalNoturnoHours = calc?.adicionalNoturnoHours || 0;

        const hourlyRate = fullFixedSalary / (emp.workload || 220);
        const atrasosDeduction = Math.round((hourlyRate * atrasosHours) * 100) / 100;
        const horasExtras50Value = Math.round((hourlyRate * 1.5 * extras50Hours) * 100) / 100;
        const horasExtras100Value = Math.round((hourlyRate * 2.0 * extras100Hours) * 100) / 100;
        const adicionalNoturnoValue = Math.round((hourlyRate * 0.2 * adicionalNoturnoHours) * 100) / 100;

        // Proventos avulsos
        const ajudaCusto = emp.ajudaCusto || 0;
        const adicionalViagem = emp.adicionalViagem || 0;
        const dependentsCount = emp.dependentsCount || 0;
        const salarioFamilia = (totalGrossSalaryBase <= 1819.26 && dependentsCount > 0) ? Math.round((62.15 * dependentsCount) * 100) / 100 : 0;

        // Prêmio de Absenteísmo (Pago via Caju - não entra em folha)
        const absenteismoAward = 0;

        const totalGrossSalary = Math.round((totalGrossSalaryBase + horasExtras50Value + horasExtras100Value + adicionalNoturnoValue + salarioFamilia + ajudaCusto + adicionalViagem) * 100) / 100;

        const benefitInfo = benefitsMap.get(emp.id);

        let vtPayrollDiscount = 0;
        let vtDiscountPercentage = 6.0;
        let vaPayrollDiscount = 0;
        let vaDiscountPercentage = 20.0;

        if (benefitInfo) {
            vtPayrollDiscount = benefitInfo.vtPayrollDiscount || 0;
            vtDiscountPercentage = benefitInfo.vtDiscountPercentage || 6.0;
            vaPayrollDiscount = benefitInfo.vaPayrollDiscount || 0;
            vaDiscountPercentage = benefitInfo.vaDiscountPercentage || 20.0;
        } else {
            // Fallback
            if (emp.vtOptIn) {
                vtDiscountPercentage = emp.vtDiscountPercentage !== null && emp.vtDiscountPercentage !== undefined
                    ? emp.vtDiscountPercentage
                    : (posto?.vtDiscountPercentage !== null && posto?.vtDiscountPercentage !== undefined ? posto.vtDiscountPercentage : 6.0);
                const rawDiscount = Math.round((emp.salary * (vtDiscountPercentage / 100)) * 100) / 100;
                vtPayrollDiscount = rawDiscount;
            }

            vaDiscountPercentage = emp.vaDiscountPercentage !== null && emp.vaDiscountPercentage !== undefined
                ? emp.vaDiscountPercentage
                : (posto?.vaDiscountPercentage !== null && posto?.vaDiscountPercentage !== undefined ? posto.vaDiscountPercentage : 20.0);
            const rawBaseVaValue = emp.valeAlimentacao || 0;
            const baseVaValue = (rawBaseVaValue > 0 && posto?.vaMealsProvidedOnSite) ? 494.00 : rawBaseVaValue;
            vaPayrollDiscount = Math.round((baseVaValue * (vaDiscountPercentage / 100)) * 100) / 100;
        }

        // Progressive INSS calculation
        const inssBase = Math.max(0, (totalGrossSalaryBase + horasExtras50Value + horasExtras100Value + adicionalNoturnoValue) - faltaDeduction - dsrDeduction - atrasosDeduction);
        const inssDeduction = calculateINSS(inssBase);

        // Progressive IRRF calculation
        const irrfBaseA = Math.max(0, inssBase - inssDeduction);
        const irrfBaseB = Math.max(0, inssBase - 564.80); // simplified deduction
        const irrfBase = Math.min(irrfBaseA, irrfBaseB);
        const irrfDeduction = calculateIRRF(irrfBase);

        const totalDeductions = Math.round((faltaDeduction + dsrDeduction + atrasosDeduction + vtPayrollDiscount + vaPayrollDiscount + inssDeduction + irrfDeduction) * 100) / 100;
        const netSalary = Math.max(0, Math.round((totalGrossSalary - totalDeductions) * 100) / 100);

        return {
            employeeId: emp.id,
            employeeName: emp.name,
            employeeCpf: emp.cpf,
            companyName,
            clientName,
            postoName,
            baseSalary,
            insalubridade,
            periculosidade,
            gratificacao,
            outrosAdicionais,
            totalGrossSalary,
            faltasCount,
            atestadosCount,
            occurrencesList,
            faltaDeduction,
            dsrDeductionsCount,
            dsrDeduction,
            vtPayrollDiscount,
            vtDiscountPercentage,
            vaPayrollDiscount,
            vaDiscountPercentage,
            inssDeduction,
            irrfDeduction,
            ajudaCusto,
            adicionalViagem,
            dependentsCount,
            salarioFamilia,
            absenteismoAward,
            atrasosHours,
            atrasosDeduction,
            extras50Hours,
            horasExtras50Value,
            extras100Hours,
            horasExtras100Value,
            adicionalNoturnoHours,
            adicionalNoturnoValue,
            totalDeductions,
            netSalary,
            isAdmittedThisMonth,
            admissionDate: new Date(emp.admissionDate).toLocaleDateString('pt-BR'),
            daysWorked,
            totalDaysInMonth,
            originalSalary: emp.salary
        };
    });

    return { items, currentUserId: user.id };
}

function calculateINSS(inssBase: number): number {
    if (inssBase <= 0) return 0;
    const limits = [1412.00, 2666.68, 4000.03, 7786.02];
    const rates = [0.075, 0.09, 0.12, 0.14];
    
    let inss = 0;
    let prevLimit = 0;
    
    for (let i = 0; i < limits.length; i++) {
        const limit = limits[i];
        const rate = rates[i];
        
        if (inssBase > limit) {
            inss += (limit - prevLimit) * rate;
            prevLimit = limit;
        } else {
            inss += (inssBase - prevLimit) * rate;
            return Math.round(inss * 100) / 100;
        }
    }
    
    return 908.86;
}

function calculateIRRF(irrfBase: number): number {
    if (irrfBase <= 2259.20) return 0;
    
    let rate = 0;
    let deduction = 0;
    
    if (irrfBase <= 2826.65) {
        rate = 0.075;
        deduction = 169.44;
    } else if (irrfBase <= 3751.05) {
        rate = 0.15;
        deduction = 381.44;
    } else if (irrfBase <= 4664.68) {
        rate = 0.225;
        deduction = 662.77;
    } else {
        rate = 0.275;
        deduction = 896.00;
    }
    
    const irrf = (irrfBase * rate) - deduction;
    return irrf > 0 ? Math.round(irrf * 100) / 100 : 0;
}
