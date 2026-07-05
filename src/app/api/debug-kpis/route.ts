import { NextResponse } from 'next/server';
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const client = await prisma.client.findFirst({
            where: { name: { contains: "penha", mode: 'insensitive' } }
        });
        if (!client) {
            return NextResponse.json({ error: "Cliente Penha não encontrado" });
        }

        const year = 2026;
        const clientIds = [client.id];
        const startDate = new Date(year, 0, 1, 0, 0, 0);
        const endDate = new Date(year, 11, 31, 23, 59, 59);

        const [attendances, requests, npsResponses, npsQuestions, slaConfigs, assignments] = await Promise.all([
            prisma.attendance.findMany({
                where: {
                    posto: { clientId: { in: clientIds } },
                    date: { gte: startDate, lte: endDate }
                },
                orderBy: { date: "asc" }
            }),
            prisma.request.findMany({
                where: {
                    createdAt: { gte: startDate, lte: endDate }
                },
                include: {
                    requester: true,
                    employee: {
                        include: {
                            assignments: {
                                include: {
                                    posto: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.npsResponse.findMany({
                where: {
                    clientId: { in: clientIds },
                    createdAt: { gte: startDate, lte: endDate }
                },
                include: {
                    answers: true
                }
            }),
            prisma.npsQuestion.findMany({
                where: { clientId: { in: clientIds } }
            }),
            prisma.slaConfigItem.findMany({
                where: { clientId: { in: clientIds } },
                include: { monthlyValues: true }
            }),
            prisma.assignment.findMany({
                where: {
                    posto: { clientId: { in: clientIds } },
                    endDate: { gte: startDate, lte: endDate }
                }
            })
        ]);

        const clientRequests = requests.filter((r: any) => 
            (r.clientId && clientIds.includes(r.clientId)) ||
            r.requester?.clientIds?.some((id: string) => clientIds.includes(id)) ||
            r.employee?.assignments?.some((a: any) => clientIds.includes(a.posto?.clientId))
        );

        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

        const monthlyData = monthNames.map((name: string, index: number) => {
            const monthAtts = attendances.filter((a: any) => new Date(a.date).getMonth() === index && a.status !== "FOLGA");
            const totalShifts = monthAtts.length;
            const vacantShifts = monthAtts.filter((a: any) => a.status === "FALTA" && !a.coveredById && !a.coverageType).length;
            const effectiveness = totalShifts > 0 ? ((totalShifts - vacantShifts) / totalShifts) * 100 : 100;

            const totalAbsences = monthAtts.filter((a: any) => a.status === "FALTA").length;
            const absenteeism = totalShifts > 0 ? (totalAbsences / totalShifts) * 100 : 0;

            return {
                monthIndex: index,
                name,
                totalShifts,
                vacantShifts,
                effectiveness,
                absenteeism
            };
        });

        return NextResponse.json({
            clientId: client.id,
            clientName: client.name,
            directJulAttsCount: attendances.filter(a => new Date(a.date).getMonth() === 6).length,
            monthlyData
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message, stack: err.stack });
    }
}
