import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const vacancies = await prisma.vacancy.findMany({
            where: {
                title: {
                    contains: "Penha",
                    mode: 'insensitive'
                }
            },
            include: {
                posto: {
                    include: {
                        client: true,
                        assignments: {
                            where: { endDate: null },
                            include: { employee: true }
                        }
                    }
                },
                candidates: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const formatted = vacancies.map(v => ({
            id: v.id,
            title: v.title,
            status: v.status,
            postoId: v.postoId,
            postoName: v.posto ? `${v.posto.roleId} - ${v.posto.client.name}` : null,
            candidatesCount: v.candidates.length,
            activeAssignments: v.posto?.assignments.map(a => ({
                id: a.id,
                employeeName: a.employee.name,
                startDate: a.startDate,
                endDate: a.endDate
            })) || []
        }));

        // Adicionalmente, vamos buscar as vagas de 'America'
        const vacanciesAmerica = await prisma.vacancy.findMany({
            where: {
                title: {
                    contains: "America",
                    mode: 'insensitive'
                }
            },
            include: {
                posto: {
                    include: {
                        client: true,
                        assignments: {
                            where: { endDate: null },
                            include: { employee: true }
                        }
                    }
                },
                candidates: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const formattedAmerica = vacanciesAmerica.map(v => ({
            id: v.id,
            title: v.title,
            status: v.status,
            postoId: v.postoId,
            postoName: v.posto ? `${v.posto.roleId} - ${v.posto.client.name}` : null,
            candidatesCount: v.candidates.length,
            activeAssignments: v.posto?.assignments.map(a => ({
                id: a.id,
                employeeName: a.employee.name,
                startDate: a.startDate,
                endDate: a.endDate
            })) || []
        }));

        return NextResponse.json({
            success: true,
            penha: formatted,
            america: formattedAmerica
        });
    } catch (err: any) {
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}
