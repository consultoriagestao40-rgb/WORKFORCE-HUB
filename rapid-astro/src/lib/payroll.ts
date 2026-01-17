/**
 * Payroll calculation engine for Gestão de QL
 * Based on Brazilian labor laws (CLT)
 */

export interface PayrollInput {
    baseSalary: number;
    insalubridade: number;
    periculosidade: number;
    gratificacao: number;
    otherAdditions: number;
    workload: number; // e.g. 220
    isNightShift: boolean;
    nightShiftHoursPerDay?: number; // Estimated or calculated
}

export interface PayrollResult {
    totalBase: number; // Base + Fixed additions
    hourlyRate: number;
    nightShiftPremium: number;
    dsrPremium: number;
    totalGross: number;
}

export function calculateMonthlyPayroll(input: PayrollInput): PayrollResult {
    const {
        baseSalary,
        insalubridade,
        periculosidade,
        gratificacao,
        otherAdditions,
        workload,
        isNightShift,
        nightShiftHoursPerDay = 7 // Default for 12x36 night shift usually covers 7 hours of night reduction
    } = input;

    // 1. Total Base (Fixed items that compose the basis for other premiums)
    // Note: Periculosidade is usually 30% of base salary. 
    // Insalubridade is usually % of minimum wage, but here we receive absolute values for flexibility.
    const totalBase = baseSalary + insalubridade + periculosidade + gratificacao + otherAdditions;

    // 2. Hourly Rate
    const hourlyRate = totalBase / workload;

    // 3. Night Shift Premium (Adicional Noturno)
    // Standard: 20% premium. Night hour reduction: 52min 30sec.
    // For simplicity, if isNightShift is true, we calculate 20% over the estimated hours.
    let nightShiftPremium = 0;
    if (isNightShift) {
        // Assume 15 days of work for 12x36 or average for 5x2
        // Let's estimate monthly night hours = nightShiftHoursPerDay * (workload / dailyHours)
        // Average daily hours for 220h month is ~7.33
        const avgDaysPerMonth = workload / 7.33;
        const monthlyNightHours = nightShiftHoursPerDay * (avgDaysPerMonth / 2); // /2 because of 12x36 usually

        // Accurate way: nightShiftPremium = (Total Base / Workload) * 20% * (Night Hours)
        // For 12x36 Night: 15 days * 8 hours (with reduction) = 120 hours.
        const effectiveNightHours = 120; // Hardcoded for 12x36 for now as it's the most common
        nightShiftPremium = hourlyRate * 0.20 * effectiveNightHours;
    }

    // 4. DSR (Descanso Semanal Remunerado)
    // Formula: (Variable Premiums / Work Days) * Days Off
    // For premiums like Night Shift, Overtime.
    const workDays = 25; // Average
    const offDays = 5;  // Average
    const dsrPremium = (nightShiftPremium / workDays) * offDays;

    // 5. Total Gross
    const totalGross = totalBase + nightShiftPremium + dsrPremium;

    return {
        totalBase,
        hourlyRate,
        nightShiftPremium,
        dsrPremium,
        totalGross
    };
}
