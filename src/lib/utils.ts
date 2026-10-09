import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formata datas de calendário (como admissão, nascimento, férias)
 * garantindo que o fuso horário local (UTC-3) não subtraia 1 dia.
 */
export function formatUTCDate(dateInput: Date | string | null | undefined): string {
    if (!dateInput) return "-";
    try {
        const dStr = typeof dateInput === 'string' 
            ? dateInput 
            : (dateInput instanceof Date ? dateInput.toISOString() : String(dateInput));
            
        if (dStr.includes('T')) {
            const [year, month, day] = dStr.split('T')[0].split('-');
            if (year && month && day) return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
            const [year, month, day] = dStr.split('-');
            return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
        }
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return "-";
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return "-";
    }
}

export function toISODateUTC(dateInput: Date | string | null | undefined): string {
    if (!dateInput) return "";
    try {
        const dStr = typeof dateInput === 'string' 
            ? dateInput 
            : (dateInput instanceof Date ? dateInput.toISOString() : String(dateInput));
            
        if (dStr.includes('T')) {
            return dStr.split('T')[0];
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
            return dStr;
        }
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return "";
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${year}-${month}-${day}`;
    } catch {
        return "";
    }
}
