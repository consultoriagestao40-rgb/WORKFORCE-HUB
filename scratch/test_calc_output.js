import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Copy business days calculation from actions
function getBusinessDaysInMonth(year, month) {
    let count = 0;
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        date.setDate(date.getDate() + 1);
    }
    return count;
}

async function testCalcOutput() {
    try {
        const config = await prisma.benefitsConfig.findFirst() || {
            payrollCutoffStartDay: 26,
            payrollCutoffEndDay: 25,
            payrollPaymentDay: 5,
            vtFractionDays: 5,
            vaFractionDays: 10,
            vaCardDeliveryEstimateDays: 10
        };

        const year = 2026;
        const month = 7;

        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;

        const windowStart = new Date(prevYear, prevMonth - 1, config.payrollCutoffStartDay, 0, 0, 0);
        const windowEnd = new Date(year, month - 1, config.payrollCutoffEndDay, 23, 59, 59);

        const businessDaysInMonth = getBusinessDaysInMonth(year, month);

        const employees = await prisma.employee.findMany({
            where: {
                name: {
                    contains: "ADJANY",
                    mode: 'insensitive'
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
            }
        });

        const emp = employees[0];
        if (!emp) {
            console.log("No employee Adjany found.");
            return;
        }

        console.log("Employee found in test:");
        console.log(" - Name:", emp.name);
        console.log(" - vtOptIn:", emp.vtOptIn);
        console.log(" - valeTransporte:", emp.valeTransporte);
        console.log(" - occurrences count:", emp.occurrences.length);

        const activeAssignment = emp.assignments && emp.assignments.length > 0 ? emp.assignments[0] : null;
        const posto = activeAssignment?.posto;

        const baseVtValue = emp.valeTransporte > 0 ? emp.valeTransporte : (posto?.valeTransporte || 0);
        const isVtMonthly = baseVtValue > 40;
        const vtDailyValue = isVtMonthly 
            ? Math.round((baseVtValue / Math.max(1, businessDaysInMonth)) * 100) / 100 
            : baseVtValue;

        console.log(" - baseVtValue:", baseVtValue);
        console.log(" - isVtMonthly:", isVtMonthly);
        console.log(" - vtDailyValue:", vtDailyValue);
        console.log(" - businessDaysInMonth:", businessDaysInMonth);

        let vtTotalValue = 0;
        const occurrencesCount = emp.occurrences.length;

        if (isVtMonthly) {
            const vtDeduction = occurrencesCount * vtDailyValue;
            vtTotalValue = Math.max(0, Math.round((baseVtValue - vtDeduction) * 100) / 100);
        } else {
            const netVtDays = Math.max(0, businessDaysInMonth - occurrencesCount);
            vtTotalValue = Math.round((baseVtValue * netVtDays) * 100) / 100;
        }

        console.log(" - Calculated vtTotalValue:", vtTotalValue);

    } catch (e) {
        console.error(e.message);
    } finally {
        await prisma.$disconnect();
    }
}

testCalcOutput();
