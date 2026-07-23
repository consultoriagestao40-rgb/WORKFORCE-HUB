"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getBenefitsCalculation } from "./benefits";

export interface PayrollOccurrenceDetail {
    id: string;
    date: string;
    type: string;
    notes?: string;
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
    occurrencesCount: number;
    occurrencesList: PayrollOccurrenceDetail[];
    faltaDeduction: number;
    
    // Benefits Discounts
    vtPayrollDiscount: number;
    vtDiscountPercentage: number;
    vaPayrollDiscount: number;
    vaDiscountPercentage: number;
    
    // Net
    totalDeductions: number;
    netSalary: number;
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
                    type: { in: ["FALTA", "FALTA_INJUSTIFICADA"] }
                },
                orderBy: { date: "asc" }
            }
        },
        orderBy: { name: "asc" }
    });

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

        const totalGrossSalary = baseSalary + insalubridade + periculosidade + gratificacao + outrosAdicionais;

        // Occurrences list & count in payroll window
        const occurrencesList = (emp.occurrences || []).map(occ => ({
            id: occ.id,
            date: new Date(occ.date).toLocaleDateString('pt-BR'),
            type: occ.type === "FALTA_INJUSTIFICADA" ? "Falta Injustificada" : "Falta",
            notes: occ.description || occ.title || undefined
        }));
        const occurrencesCount = occurrencesList.length;

        // Absence deduction based on full fixed salary / 30
        const fullFixedSalary = emp.salary + emp.insalubridade + emp.periculosidade + emp.gratificacao;
        const dailyRate = fullFixedSalary / 30;
        const faltaDeduction = Math.round((dailyRate * occurrencesCount) * 100) / 100;

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

        const totalDeductions = faltaDeduction + vtPayrollDiscount + vaPayrollDiscount;
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
            occurrencesCount,
            occurrencesList,
            faltaDeduction,
            vtPayrollDiscount,
            vtDiscountPercentage,
            vaPayrollDiscount,
            vaDiscountPercentage,
            totalDeductions,
            netSalary
        };
    });

    return { items, currentUserId: user.id };
}
