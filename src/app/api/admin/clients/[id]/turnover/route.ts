import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay, eachDayOfInterval, format } from "date-fns";

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const clientId = params.id;
        const { searchParams } = new URL(request.url);
        const startStr = searchParams.get("startDate");
        const endStr = searchParams.get("endDate");

        if (!startStr || !endStr) {
            return NextResponse.json({ error: "Parâmetros startDate e endDate são obrigatórios" }, { status: 400 });
        }

        const startDate = startOfDay(new Date(startStr + "T00:00:00Z"));
        const endDate = endOfDay(new Date(endStr + "T23:59:59Z"));

        // 1. Fetch all assignments under this client's postos
        const assignments = await prisma.assignment.findMany({
            where: {
                posto: { clientId },
                startDate: { lte: endDate },
                OR: [
                    { endDate: null },
                    { endDate: { gte: startDate } }
                ]
            },
            include: {
                employee: true,
                posto: {
                    include: { role: true }
                }
            },
            orderBy: { startDate: 'desc' }
        });

        // 2. Identify admissions and departures for this contract in the period
        const admissions = assignments.filter(asg => 
            asg.startDate >= startDate && asg.startDate <= endDate
        ).map(asg => ({
            id: asg.id,
            employeeName: asg.employee.name,
            employeeCpf: asg.employee.cpf,
            roleName: asg.posto.role.name,
            schedule: asg.posto.schedule,
            startDate: asg.startDate,
            salary: asg.employee.salary
        }));

        const departures = assignments.filter(asg => 
            asg.endDate && asg.endDate >= startDate && asg.endDate <= endDate
        ).map(asg => ({
            id: asg.id,
            employeeName: asg.employee.name,
            employeeCpf: asg.employee.cpf,
            roleName: asg.posto.role.name,
            schedule: asg.posto.schedule,
            endDate: asg.endDate,
            salary: asg.employee.salary,
            dismissalReason: asg.employee.dismissalReason || "Remanejamento de Posto"
        }));

        // 3. Generate daily trend data for the chart
        const daysInRange = eachDayOfInterval({ start: startDate, end: endDate });
        const dailyTrend = daysInRange.map(day => {
            const dayStr = day.toDateString();
            const dayAdmissions = admissions.filter(a => new Date(a.startDate).toDateString() === dayStr).length;
            const dayDepartures = departures.filter(d => new Date(d.endDate!).toDateString() === dayStr).length;
            
            return {
                date: format(day, "dd/MM"),
                admissoes: dayAdmissions,
                demissoes: dayDepartures
            };
        });

        // 4. Calculate overall metrics
        const totalActiveAtEnd = assignments.filter(asg => !asg.endDate).length;
        const totalAdmissions = admissions.length;
        const totalDepartures = departures.length;
        const turnoverRate = totalActiveAtEnd > 0 
            ? (((totalAdmissions + totalDepartures) / 2) / totalActiveAtEnd) * 100 
            : 0;

        // 5. Get historical records of all employees that ever passed through this contract
        const historicalAssignments = await prisma.assignment.findMany({
            where: {
                posto: { clientId }
            },
            include: {
                employee: {
                    include: {
                        logs: {
                            where: {
                                action: { in: ["DESVINCULACAO", "DESVINCULACAO_NOTAS"] }
                            },
                            orderBy: { timestamp: 'desc' }
                        }
                    }
                },
                posto: {
                    include: { role: true }
                }
            },
            orderBy: { startDate: 'desc' }
        });

        const historyList = historicalAssignments.map(asg => {
            let reason = "";
            let notes = "";

            if (asg.endDate) {
                // Match logs within 10s of assignment end date
                const desvLog = asg.employee.logs.find(l => 
                    l.action === "DESVINCULACAO" &&
                    Math.abs(new Date(l.timestamp).getTime() - new Date(asg.endDate!).getTime()) < 10000
                );
                if (desvLog) {
                    const match = desvLog.details.match(/\(([^)]+)\)$/);
                    if (match) reason = match[1];
                }

                const noteLog = asg.employee.logs.find(l => 
                    l.action === "DESVINCULACAO_NOTAS" &&
                    Math.abs(new Date(l.timestamp).getTime() - new Date(asg.endDate!).getTime()) < 10000
                );
                if (noteLog) {
                    notes = noteLog.details;
                }
            }

            return {
                id: asg.id,
                employeeName: asg.employee.name,
                employeeCpf: asg.employee.cpf,
                roleName: asg.posto.role.name,
                schedule: asg.posto.schedule,
                startDate: asg.startDate,
                endDate: asg.endDate,
                status: asg.endDate ? "Inativo no Posto" : "Ativo no Posto",
                reason,
                notes
            };
        });

        return NextResponse.json({
            success: true,
            turnover: {
                admissions,
                departures,
                dailyTrend,
                totalActiveAtEnd,
                totalAdmissions,
                totalDepartures,
                turnoverRate,
                historyList
            }
        });
    } catch (error: any) {
        console.error("[Client Turnover Endpoint] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
