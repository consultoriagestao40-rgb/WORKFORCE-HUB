/**
 * Termination calculation engine for Gestão de QL
 * Based on Brazilian labor laws (CLT) & CCT guidelines
 */

import { differenceInYears, differenceInMonths, differenceInDays, addDays, getDaysInMonth, isBefore } from "date-fns";

export type DismissalReason =
    | "SEM_JUSTA_CAUSA"
    | "COM_JUSTA_CAUSA"
    | "PEDIDO_DEMISSAO"
    | "ACORDO_MUTUO"
    | "EXP_FIM"
    | "EXP_ANTECIPADO_EMPRESA"
    | "EXP_ANTECIPADO_EMPREGADO";

export type NoticeType = "INDENIZADO" | "TRABALHADO" | "DESCONTADO" | "DISPENSADO";

export interface TerminationInput {
    admissionDate: Date | string;
    dismissalDate: Date | string;
    baseSalary: number;
    insalubridade?: number;
    periculosidade?: number;
    gratificacao?: number;
    otherAdditions?: number;
    workload?: number; // Default 220
    isNightShift?: boolean;
    dependentsCount?: number;
    vacationDaysRemaining?: number; // Total unused vacation days
    dismissalReason: DismissalReason;
    noticeType: NoticeType;
    customNoticeDays?: number;
    afastamentoDays?: number; // Days of unpaid leave / INSS in reference period
    afastamentoStartDate?: Date | string;
    afastamentoEndDate?: Date | string;
    afastamentoPeriods?: Array<{ startDate?: Date | string; endDate?: Date | string; days?: number; reason?: string }>;
    vtMonthlyValue?: number;
    vaMonthlyValue?: number;
    businessDaysInMonth?: number; // Default 22
    workedBusinessDays?: number;
    estimatedFgtsBalance?: number;
}

export interface TerminationItem {
    code: string;
    description: string;
    type: "PROVENTO" | "DESCONTO";
    amount: number;
    reference?: string;
}

export interface TerminationResult {
    // Basic info
    fullYearsWorked: number;
    noticeDaysCount: number;
    salaryBaseForCalc: number; // Monthly gross for calculations
    dailyRate: number;

    // Dates & Projections
    projectedEndDate: Date;

    // Items
    items: TerminationItem[];

    // Totals
    totalProventos: number;
    totalDescontos: number;
    netAmount: number;

    // FGTS & Fine
    fgtsBalance: number;
    fgtsFineRate: number;
    fgtsFineAmount: number;

    // Afastamento details
    afastamentoTotalDays: number;
    avosLostToAfastamento: number;
}

// INSS Progressive Table 2026
function calculateINSS(amount: number): number {
    if (amount <= 0) return 0;
    
    // Tabela 2026 estipulada CLT
    const b1 = 1518.00;
    const b2 = 2793.88;
    const b3 = 4190.83;
    const b4 = 8157.41;

    let inss = 0;
    if (amount > 0) {
        const p1 = Math.min(amount, b1);
        inss += p1 * 0.075;
    }
    if (amount > b1) {
        const p2 = Math.min(amount, b2) - b1;
        inss += p2 * 0.09;
    }
    if (amount > b2) {
        const p3 = Math.min(amount, b3) - b2;
        inss += p3 * 0.12;
    }
    if (amount > b3) {
        const p4 = Math.min(amount, b4) - b3;
        inss += p4 * 0.14;
    }

    const maxInss = (b1 * 0.075) + ((b2 - b1) * 0.09) + ((b3 - b2) * 0.12) + ((b4 - b3) * 0.14);
    return Math.min(inss, maxInss);
}

// IRRF Progressive Table 2026
function calculateIRRF(grossAmount: number, inssDeduction: number, dependents: number): number {
    const dependentDeduction = dependents * 189.59;
    const baseCalc = grossAmount - inssDeduction - dependentDeduction;

    if (baseCalc <= 2259.20) return 0;
    if (baseCalc <= 2828.65) return (baseCalc * 0.075) - 169.44;
    if (baseCalc <= 3751.05) return (baseCalc * 0.15) - 381.59;
    if (baseCalc <= 4664.68) return (baseCalc * 0.225) - 662.92;
    return (baseCalc * 0.275) - 896.15;
}

export function calculateTermination(input: TerminationInput): TerminationResult {
    const admission = new Date(input.admissionDate);
    const dismissal = new Date(input.dismissalDate);

    const baseSalary = input.baseSalary || 0;
    const insalubridade = input.insalubridade || 0;
    const periculosidade = input.periculosidade || 0;
    const gratificacao = input.gratificacao || 0;
    const otherAdditions = input.otherAdditions || 0;
    const workload = input.workload || 220;
    const dependentsCount = input.dependentsCount || 0;
    const vacationDaysRemaining = input.vacationDaysRemaining || 0;
    let afastamentoDays = input.afastamentoDays || 0;
    if (input.afastamentoPeriods && input.afastamentoPeriods.length > 0) {
        let totalPeriodDays = 0;
        for (const period of input.afastamentoPeriods) {
            if (period.startDate && period.endDate) {
                const s = new Date(period.startDate);
                const e = new Date(period.endDate);
                if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
                    totalPeriodDays += (differenceInDays(e, s) + 1);
                } else if (period.days && period.days > 0) {
                    totalPeriodDays += period.days;
                }
            } else if (period.days && period.days > 0) {
                totalPeriodDays += period.days;
            }
        }
        if (totalPeriodDays > 0) {
            afastamentoDays = totalPeriodDays;
        }
    } else if (input.afastamentoStartDate && input.afastamentoEndDate) {
        const start = new Date(input.afastamentoStartDate);
        const end = new Date(input.afastamentoEndDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
            afastamentoDays = differenceInDays(end, start) + 1;
        }
    }

    // Monthly gross basis for termination rights
    const salaryBaseForCalc = baseSalary + insalubridade + periculosidade + gratificacao + otherAdditions;
    const dailyRate = salaryBaseForCalc / 30;

    const avosLostToAfastamento = Math.floor(afastamentoDays / 30);

    // 1. Full completed years worked (for Notice Period Law 12.506/2011)
    const fullYearsWorked = differenceInYears(dismissal, admission);

    // Notice Days: 30 days + 3 days per year completed (Max 90 days)
    let noticeDaysCount = 30;
    if (input.noticeType === "INDENIZADO" || input.noticeType === "TRABALHADO") {
        noticeDaysCount = Math.min(30 + (fullYearsWorked * 3), 90);
    }
    if (input.customNoticeDays !== undefined && input.customNoticeDays > 0) {
        noticeDaysCount = input.customNoticeDays;
    }

    // Projected End Date (including Notice Period if Indemnified)
    let projectedEndDate = new Date(dismissal);
    if (input.noticeType === "INDENIZADO" && input.dismissalReason !== "COM_JUSTA_CAUSA") {
        projectedEndDate = addDays(dismissal, noticeDaysCount);
    }

    const items: TerminationItem[] = [];

    // -------------------------------------------------------------
    // A) SALDO DE SALÁRIO
    // -------------------------------------------------------------
    const dayOfMonth = dismissal.getDate();
    const daysInDismissalMonth = getDaysInMonth(dismissal);
    // Standard CLT practice uses dayOfMonth / 30 for monthly salary base
    const saldoSalarioDays = Math.min(dayOfMonth, 30);
    const saldoSalarioAmount = dailyRate * saldoSalarioDays;

    if (saldoSalarioAmount > 0) {
        items.push({
            code: "001",
            description: "Saldo de Salário",
            type: "PROVENTO",
            amount: saldoSalarioAmount,
            reference: `${saldoSalarioDays} dias`
        });
    }

    // -------------------------------------------------------------
    // B) AVISO PRÉVIO INDENIZADO OU DESCONTADO
    // -------------------------------------------------------------
    let avisoIndenizadoAmount = 0;
    if (input.noticeType === "INDENIZADO" && (input.dismissalReason === "SEM_JUSTA_CAUSA" || input.dismissalReason === "EXP_ANTECIPADO_EMPRESA")) {
        avisoIndenizadoAmount = dailyRate * noticeDaysCount;
        items.push({
            code: "010",
            description: "Aviso Prévio Indenizado (Lei 12.506/2011)",
            type: "PROVENTO",
            amount: avisoIndenizadoAmount,
            reference: `${noticeDaysCount} dias`
        });
    } else if (input.noticeType === "INDENIZADO" && input.dismissalReason === "ACORDO_MUTUO") {
        // Acordo mútuo paga 50% do aviso prévio
        avisoIndenizadoAmount = (dailyRate * noticeDaysCount) * 0.5;
        items.push({
            code: "010",
            description: "Aviso Prévio Indenizado (50% - Acordo Mútuo)",
            type: "PROVENTO",
            amount: avisoIndenizadoAmount,
            reference: `${noticeDaysCount} dias (50%)`
        });
    } else if (input.noticeType === "DESCONTADO" && input.dismissalReason === "PEDIDO_DEMISSAO") {
        const descontoAviso = dailyRate * 30; // Max 30 days deduction on resignation
        items.push({
            code: "101",
            description: "Desconto de Aviso Prévio Não Cumprido",
            type: "DESCONTO",
            amount: descontoAviso,
            reference: "30 dias"
        });
    }

    // -------------------------------------------------------------
    // C) 13º SALÁRIO PROPORCIONAL & INDENIZADO
    // -------------------------------------------------------------
    if (input.dismissalReason !== "COM_JUSTA_CAUSA") {
        // Calculate 13th avos for current year up to dismissal date
        const currentYear = dismissal.getFullYear();
        const yearStart = new Date(currentYear, 0, 1);
        const startDateFor13 = isBefore(admission, yearStart) ? yearStart : admission;

        // Number of months where employee worked >= 15 days in current year
        let avos13 = 0;
        let checkMonth = new Date(startDateFor13);
        while (checkMonth.getFullYear() === currentYear && checkMonth <= dismissal) {
            const m = checkMonth.getMonth();
            const daysInM = getDaysInMonth(checkMonth);

            let workedDaysInM = daysInM;
            if (checkMonth.getMonth() === startDateFor13.getMonth() && checkMonth.getFullYear() === startDateFor13.getFullYear()) {
                workedDaysInM = daysInM - startDateFor13.getDate() + 1;
            }
            if (checkMonth.getMonth() === dismissal.getMonth() && checkMonth.getFullYear() === dismissal.getFullYear()) {
                workedDaysInM = dismissal.getDate();
            }

            if (workedDaysInM >= 15) {
                avos13++;
            }
            checkMonth.setMonth(checkMonth.getMonth() + 1);
            checkMonth.setDate(1);
        }

        const avosLostToAfastamento = Math.floor(afastamentoDays / 30);
        if (afastamentoDays >= 15) {
            avos13 = Math.max(0, avos13 - avosLostToAfastamento);
        }

        avos13 = Math.min(12, avos13);
        const valor13Proporcional = (salaryBaseForCalc / 12) * avos13;

        if (valor13Proporcional > 0 || avosLostToAfastamento > 0) {
            items.push({
                code: "020",
                description: "13º Salário Proporcional",
                type: "PROVENTO",
                amount: valor13Proporcional,
                reference: avosLostToAfastamento > 0 
                    ? `${avos13}/12 avos (-${avosLostToAfastamento} avos p/ ${afastamentoDays}d INSS)`
                    : `${avos13}/12 avos`
            });
        }

        // Projected 13th over indemnified notice period
        if (input.noticeType === "INDENIZADO" && (input.dismissalReason === "SEM_JUSTA_CAUSA" || input.dismissalReason === "ACORDO_MUTUO")) {
            // Check if projected end date adds 15+ days in next month(s)
            const daysDiff = differenceInDays(projectedEndDate, dismissal);
            const avos13Indenizado = Math.round(daysDiff / 30);
            if (avos13Indenizado > 0) {
                const amount13Ind = (salaryBaseForCalc / 12) * avos13Indenizado;
                items.push({
                    code: "021",
                    description: "13º Salário sobre Aviso Prévio Indenizado",
                    type: "PROVENTO",
                    amount: amount13Ind,
                    reference: `${avos13Indenizado}/12 avos`
                });
            }
        }
    }

    // -------------------------------------------------------------
    // D) FÉRIAS VENCIDAS & PROPORCIONAIS (+ 1/3 CONSTITUCIONAL)
    // -------------------------------------------------------------
    if (input.dismissalReason !== "COM_JUSTA_CAUSA") {
        // 1. Férias Vencidas
        if (vacationDaysRemaining > 0) {
            const valorFeriasVencidas = dailyRate * vacationDaysRemaining;
            const tercoVencidas = valorFeriasVencidas / 3;

            items.push({
                code: "030",
                description: "Férias Vencidas Simples",
                type: "PROVENTO",
                amount: valorFeriasVencidas,
                reference: `${vacationDaysRemaining} dias`
            });

            items.push({
                code: "031",
                description: "1/3 Constitucional de Férias Vencidas",
                type: "PROVENTO",
                amount: tercoVencidas,
                reference: "1/3 sobre R$ " + valorFeriasVencidas.toFixed(2)
            });
        }

        // 2. Férias Proporcionais
        // Calculate months from last acquisition anniversary
        const yearsWorked = differenceInYears(dismissal, admission);
        const lastAnniversary = new Date(admission);
        lastAnniversary.setFullYear(admission.getFullYear() + yearsWorked);
        
        let acquisitionStart = lastAnniversary;
        if (isBefore(dismissal, lastAnniversary)) {
            acquisitionStart = new Date(admission);
            acquisitionStart.setFullYear(admission.getFullYear() + (yearsWorked - 1));
        }

        // Count avos from acquisitionStart to dismissal date
        let avosFerias = 0;
        let curr = new Date(acquisitionStart);
        while (curr < dismissal) {
            const daysInCurr = getDaysInMonth(curr);
            let worked = daysInCurr;

            if (curr.getMonth() === acquisitionStart.getMonth() && curr.getFullYear() === acquisitionStart.getFullYear()) {
                worked = daysInCurr - acquisitionStart.getDate() + 1;
            }
            if (curr.getMonth() === dismissal.getMonth() && curr.getFullYear() === dismissal.getFullYear()) {
                worked = dismissal.getDate();
            }

            if (worked >= 15) {
                avosFerias++;
            }

            curr.setMonth(curr.getMonth() + 1);
            curr.setDate(1);
        }

        // Apply CLT Art. 133, IV: if afastamento INSS > 180 days in acquisitive period, employee loses vacation rights
        if (afastamentoDays > 180) {
            avosFerias = 0;
        } else if (afastamentoDays >= 15) {
            const avosLostFerias = Math.floor(afastamentoDays / 30);
            avosFerias = Math.max(0, avosFerias - avosLostFerias);
        }

        avosFerias = Math.min(12, avosFerias);
        const valorFeriasProp = (salaryBaseForCalc / 12) * avosFerias;
        const tercoFeriasProp = valorFeriasProp / 3;

        if (valorFeriasProp > 0 || avosLostToAfastamento > 0) {
            items.push({
                code: "032",
                description: "Férias Proporcionais",
                type: "PROVENTO",
                amount: valorFeriasProp,
                reference: afastamentoDays > 180 
                    ? `0/12 avos (Perda Art. 133 IV CLT - INSS > 180d)`
                    : avosLostToAfastamento > 0 
                        ? `${avosFerias}/12 avos (-${avosLostToAfastamento} avos p/ ${afastamentoDays}d INSS)`
                        : `${avosFerias}/12 avos`
            });
            if (valorFeriasProp > 0) {
                items.push({
                    code: "033",
                    description: "1/3 Constitucional sobre Férias Proporcionais",
                    type: "PROVENTO",
                    amount: tercoFeriasProp,
                    reference: "1/3 sobre R$ " + valorFeriasProp.toFixed(2)
                });
            }
        }

        // 3. Férias sobre Aviso Prévio Indenizado
        if (input.noticeType === "INDENIZADO" && (input.dismissalReason === "SEM_JUSTA_CAUSA" || input.dismissalReason === "ACORDO_MUTUO")) {
            const avosFeriasInd = Math.round(noticeDaysCount / 30);
            if (avosFeriasInd > 0) {
                const valorFeriasInd = (salaryBaseForCalc / 12) * avosFeriasInd;
                const tercoFeriasInd = valorFeriasInd / 3;

                items.push({
                    code: "034",
                    description: "Férias Indenizadas sobre Aviso Prévio",
                    type: "PROVENTO",
                    amount: valorFeriasInd,
                    reference: `${avosFeriasInd}/12 avos`
                });
                items.push({
                    code: "035",
                    description: "1/3 Constitucional sobre Férias do Aviso Prévio",
                    type: "PROVENTO",
                    amount: tercoFeriasInd,
                    reference: "1/3 sobre R$ " + valorFeriasInd.toFixed(2)
                });
            }
        }
    }

    // -------------------------------------------------------------
    // E) ESTORNO / DEVOLUÇÃO DE BENEFÍCIOS NÃO UTILIZADOS (VT / VA / VR)
    // -------------------------------------------------------------
    const totalBusinessDaysMonth = input.businessDaysInMonth || 22;
    const workedDays = input.workedBusinessDays !== undefined ? input.workedBusinessDays : Math.min(dayOfMonth, totalBusinessDaysMonth);
    const unworkedBusinessDays = Math.max(0, totalBusinessDaysMonth - workedDays);

    if (unworkedBusinessDays > 0) {
        // Estorno de Vale Transporte (VT)
        if (input.vtMonthlyValue && input.vtMonthlyValue > 0) {
            const dailyVt = input.vtMonthlyValue / totalBusinessDaysMonth;
            const refundVt = dailyVt * unworkedBusinessDays;
            items.push({
                code: "110",
                description: "Devolução / Estorno de VT Adiantado Não Utilizado",
                type: "DESCONTO",
                amount: refundVt,
                reference: `${unworkedBusinessDays} dias úteis não trabalhados`
            });
        }

        // Estorno de Vale Alimentação / Refeição (VA/VR)
        if (input.vaMonthlyValue && input.vaMonthlyValue > 0) {
            const dailyVa = input.vaMonthlyValue / totalBusinessDaysMonth;
            const refundVa = dailyVa * unworkedBusinessDays;
            items.push({
                code: "111",
                description: "Devolução / Estorno de VA/VR Adiantado Não Utilizado",
                type: "DESCONTO",
                amount: refundVa,
                reference: `${unworkedBusinessDays} dias úteis não trabalhados`
            });
        }
    }

    // -------------------------------------------------------------
    // F) DESCONTOS LEGAIS (INSS E IRRF)
    // -------------------------------------------------------------
    // INSS sobre Saldo de Salário
    const inssSaldoSalario = calculateINSS(saldoSalarioAmount);
    if (inssSaldoSalario > 0) {
        items.push({
            code: "120",
            description: "INSS sobre Saldo de Salário",
            type: "DESCONTO",
            amount: inssSaldoSalario,
            reference: "Tabela Progressiva"
        });
    }

    // INSS sobre 13º Salário (cálculo separado)
    const valor13Total = items
        .filter(i => (i.code === "020" || i.code === "021") && i.type === "PROVENTO")
        .reduce((sum, i) => sum + i.amount, 0);

    const inss13 = calculateINSS(valor13Total);
    if (inss13 > 0) {
        items.push({
            code: "121",
            description: "INSS sobre 13º Salário",
            type: "DESCONTO",
            amount: inss13,
            reference: "Tabela Progressiva"
        });
    }

    // IRRF sobre Saldo de Salário
    const irrfSaldoSalario = calculateIRRF(saldoSalarioAmount, inssSaldoSalario, dependentsCount);
    if (irrfSaldoSalario > 0) {
        items.push({
            code: "130",
            description: "IRRF sobre Saldo de Salário",
            type: "DESCONTO",
            amount: irrfSaldoSalario,
            reference: `Dedução (${dependentsCount} dep.)`
        });
    }

    // IRRF sobre 13º Salário
    const irrf13 = calculateIRRF(valor13Total, inss13, dependentsCount);
    if (irrf13 > 0) {
        items.push({
            code: "131",
            description: "IRRF sobre 13º Salário",
            type: "DESCONTO",
            amount: irrf13,
            reference: `Dedução (${dependentsCount} dep.)`
        });
    }

    // -------------------------------------------------------------
    // G) FGTS & MULTA RESCISÓRIA (40% / 20%)
    // -------------------------------------------------------------
    const totalMonthsTenure = differenceInMonths(dismissal, admission);
    const afastamentoMonths = Math.floor(afastamentoDays / 30);
    const contributionMonths = Math.max(0, totalMonthsTenure - afastamentoMonths);

    // Estimate FGTS account balance: Salário Médio x 8% x Tempo de Contribuição (meses)
    const fgtsBalance = (input.estimatedFgtsBalance !== undefined && input.estimatedFgtsBalance > 0)
        ? input.estimatedFgtsBalance
        : (salaryBaseForCalc * 0.08 * Math.max(1, contributionMonths));

    let fgtsFineRate = 0;
    if (input.dismissalReason === "SEM_JUSTA_CAUSA" || input.dismissalReason === "EXP_ANTECIPADO_EMPRESA") {
        fgtsFineRate = 0.40; // 40%
    } else if (input.dismissalReason === "ACORDO_MUTUO") {
        fgtsFineRate = 0.20; // 20%
    }

    const fgtsFineAmount = fgtsBalance * fgtsFineRate;

    // Totals
    const totalProventos = items.filter(i => i.type === "PROVENTO").reduce((s, i) => s + i.amount, 0);
    const totalDescontos = items.filter(i => i.type === "DESCONTO").reduce((s, i) => s + i.amount, 0);
    const netAmount = Math.max(0, totalProventos - totalDescontos);

    return {
        fullYearsWorked,
        noticeDaysCount,
        salaryBaseForCalc,
        dailyRate,
        projectedEndDate,
        items,
        totalProventos,
        totalDescontos,
        netAmount,
        fgtsBalance,
        fgtsFineRate,
        fgtsFineAmount,
        afastamentoTotalDays: afastamentoDays,
        avosLostToAfastamento: Math.floor(afastamentoDays / 30)
    };
}
