import { prisma } from "@/lib/db";

import { differenceInYears, differenceInDays, addYears, format, isBefore } from "date-fns";
import { VacationMonitorClient } from "@/components/admin/VacationMonitorClient";

type VacationStatus = 'critical' | 'warning' | 'ok';

interface EmployeeVacationData {
    id: string;
    name: string;
    cpf: string;
    role: { name: string };
    admissionDate: Date;
    totalVacationDaysTaken: number;
    lastVacationStart: Date | null;
    daysRemaining: number;
    daysUntilLimit: number;
    concessiveLimitDate: Date;
    status: VacationStatus;
    postoLabel: string;
    companyName: string;
}

async function getVacationData() {
    const employees = await prisma.employee.findMany({
        where: { type: 'CLT' },
        include: {
            role: true,
            situation: true,
            company: true,
            assignments: {
                where: { endDate: null },
                include: { posto: { include: { client: true } } }
            }
        },
        orderBy: { name: 'asc' }
    });

    const vacationData: EmployeeVacationData[] = employees.map(emp => {
        const today = new Date();
        const admissionDate = new Date(emp.admissionDate);

        // Mesmo cálculo do perfil individual
        const fullYearsWorked = differenceInYears(today, admissionDate);
        const totalDaysEarned = fullYearsWorked * 30;
        const daysRemaining = totalDaysEarned - emp.totalVacationDaysTaken;

        // Calcular prazo concessivo (MESMA lógica do perfil)
        const earliestPendingPeriodYear = Math.floor(emp.totalVacationDaysTaken / 30) + 1;
        const concessiveLimitDate = addYears(admissionDate, earliestPendingPeriodYear + 1);
        const daysUntilLimit = differenceInDays(concessiveLimitDate, today);

        // Determinar status (MESMA lógica do perfil)
        const isCritical = daysRemaining > 0 && isBefore(concessiveLimitDate, today);
        const isWarning = daysRemaining > 0 && !isCritical && daysUntilLimit <= 90;

        let status: VacationStatus;
        if (isCritical) {
            status = 'critical';
        } else if (isWarning) {
            status = 'warning';
        } else {
            status = 'ok';
        }

        // Get current assignment (Posto)
        const currentAssignment = emp.assignments[0];
        const postoLabel = currentAssignment
            ? `${currentAssignment.posto.client.name}`
            : 'Sem Posto';

        return {
            id: emp.id,
            name: emp.name,
            cpf: emp.cpf,
            role: emp.role,
            admissionDate: emp.admissionDate,
            totalVacationDaysTaken: emp.totalVacationDaysTaken,
            lastVacationStart: emp.lastVacationStart,
            daysRemaining,
            daysUntilLimit,
            concessiveLimitDate,
            status,
            postoLabel, // New field,
            companyName: emp.company?.name || 'Sem Empresa'
        };
    });

    // Calcular estatísticas
    const critical = vacationData.filter(e => e.status === 'critical').length;
    const warning = vacationData.filter(e => e.status === 'warning').length;
    const ok = vacationData.filter(e => e.status === 'ok').length;
    const totalPendingDays = vacationData.reduce((sum, e) => sum + Math.max(0, e.daysRemaining), 0);

    return { vacationData, stats: { critical, warning, ok, totalPendingDays } };
}

export default async function VacationMonitorPage() {
    const { vacationData, stats } = await getVacationData();

    return (
        <VacationMonitorClient vacationData={vacationData} stats={stats} />
    );
}
