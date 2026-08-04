const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { differenceInYears, addYears, isBefore } = require("date-fns");

async function main() {
    const employee = await prisma.employee.findUnique({
        where: { id: "a316bf35-6ecb-4b40-a38a-dfcc5225205a" },
        include: {
            role: true,
            company: true,
            situation: true,
            assignments: {
                include: { posto: { include: { client: true } } }
            },
            vacations: true
        }
    });

    console.log("EMPLOYEE:", employee.name);
    console.log("ADMISSION DATE RAW:", employee.admissionDate);

    const admissionDate = new Date(employee.admissionDate);
    const referenceDate = (employee.status === "Desligado" || employee.status === "Afastado")
        ? new Date(employee.updatedAt)
        : new Date();
    
    console.log("admissionDate:", admissionDate);
    console.log("referenceDate:", referenceDate);

    const fullYearsWorked = differenceInYears(referenceDate, admissionDate);
    const totalDaysEarned = fullYearsWorked * 30;

    const actualDaysTaken = employee.vacations.reduce((acc, v) => acc + v.daysTaken + (v.daysSold || 0), 0);

    const daysRemaining = totalDaysEarned - actualDaysTaken;
    const earliestPendingPeriodYear = Math.floor(actualDaysTaken / 30) + 1;
    const concessiveLimitDate = addYears(admissionDate, earliestPendingPeriodYear + 1);

    console.log("concessiveLimitDate:", concessiveLimitDate);
    console.log("earliestPendingPeriodYear:", earliestPendingPeriodYear);

    const isCritical = daysRemaining > 0 && isBefore(concessiveLimitDate, referenceDate);
    const isWarning = daysRemaining > 0 && !isCritical && isBefore(concessiveLimitDate, addYears(referenceDate, 0.2));

    console.log("isCritical:", isCritical);
    console.log("isWarning:", isWarning);
}

main().catch(console.error).finally(() => prisma.$disconnect());
