"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCurrentUserRole, getCurrentUser } from "@/lib/auth";

export async function getAdminRequests() {
    // Optionally check permissions
    // const role = await getCurrentUserRole();
    // if (!['ADMIN', 'COORD_RH', 'ASSIST_RH'].includes(role)) return [];

    return await prisma.request.findMany({
        include: {
            requester: { select: { name: true } },
            resolver: { select: { name: true } },
            employee: { select: { name: true, role: { select: { name: true } } } }
        },
        orderBy: [
            { status: 'asc' }, // PENDENTE first
            { createdAt: 'desc' }
        ]
    });
}

export async function transitionRequest(id: string, newStatus: string, notes?: string) {
    const user = await getCurrentUser();
    if (!user || user.role === 'SUPERVISOR') throw new Error("Unauthorized");

    const data: any = { status: newStatus as any };

    // Check for SLA Configuration for the new status (Stage 1 or 2)
    if (newStatus === 'PENDENTE' || newStatus === 'AGUARDANDO_APROVACAO') {
        const slaConfig = await prisma.requestStageConfiguration.findUnique({
            where: { status: newStatus as any }
        });

        if (slaConfig) {
            const newDueDate = new Date();
            newDueDate.setDate(newDueDate.getDate() + slaConfig.slaDays);
            data.dueDate = newDueDate;
        }
    }

    // For "Solicitar Mais Informações" (Back to PENDENTE), we should probably update notes.
    // For "Concluir" (CONCLUIDO), we definitely update resolutionNotes.
    if (notes) {
        data.resolutionNotes = notes;
        data.resolverId = user.id;

        // ALSO create a permanent comment record
        await prisma.requestComment.create({
            data: {
                content: notes,
                requestId: id,
                userId: user.id
            }
        });
    }

    await prisma.request.update({
        where: { id },
        data
    });

    revalidatePath("/admin/requests");
    revalidatePath("/mobile/requests");
}

export async function deleteRequest(id: string) {
    const restriction = await getCurrentUserRole();
    if (restriction !== 'ADMIN') throw new Error("Unauthorized");

    await prisma.request.delete({
        where: { id }
    });

    revalidatePath("/admin/requests");
}

export async function getStageConfiguration(status: string) {
    const config = await prisma.requestStageConfiguration.findUnique({
        where: { status: status as any },
        include: { approver: { select: { id: true, name: true } } }
    });
    return config;
}

export async function updateStageConfiguration(status: string, data: { slaDays: number, approverId?: string }) {
    const user = await getCurrentUserRole();
    if (user !== 'ADMIN') throw new Error("Unauthorized");

    await prisma.requestStageConfiguration.upsert({
        where: { status: status as any },
        create: {
            status: status as any,
            slaDays: data.slaDays,
            approverId: data.approverId
        },
        update: {
            slaDays: data.slaDays,
            approverId: data.approverId
        }
    });

    revalidatePath("/admin/requests");
}

export async function getRecruiters() {
    // Get users who can be approvers (e.g. ADMIN, COORD_RH, or specific roles. For now all users or Admin/RH)
    return await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' }
    });
}

export async function addRequestComment(requestId: string, content: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    await prisma.requestComment.create({
        data: {
            content,
            requestId,
            userId: user.id
        }
    });

    revalidatePath("/admin/requests");
}

export async function getRequestComments(requestId: string) {
    return await prisma.requestComment.findMany({
        where: { requestId },
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'desc' }
    });
}

export async function getClientRequests() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    return await prisma.request.findMany({
        where: { requesterId: user.id },
        include: {
            employee: { select: { name: true, role: { select: { name: true } } } },
            resolver: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
}

export async function createClientRequest(data: { type: any, description: string, employeeId?: string }) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'CLIENTE') throw new Error("Unauthorized");

    // Calcular SLA com base nas configurações da PENDENTE se existir
    const slaConfig = await prisma.requestStageConfiguration.findUnique({
        where: { status: 'PENDENTE' }
    });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (slaConfig?.slaDays || 3));

    const request = await prisma.request.create({
        data: {
            type: data.type,
            description: data.description,
            employeeId: data.employeeId || null,
            requesterId: user.id,
            dueDate,
            status: 'PENDENTE'
        }
    });

    revalidatePath("/admin/requests");
    revalidatePath("/client/dashboard");

    return { success: true, request };
}

export async function getClientEmployees() {
    const user = await getCurrentUser();
    if (!user || user.role !== 'CLIENTE') throw new Error("Unauthorized");

    const clientIds = user.clientIds || [];

    const assignments = await prisma.assignment.findMany({
        where: {
            posto: { clientId: { in: clientIds } },
            OR: [
                { endDate: null },
                { endDate: { gte: new Date() } }
            ]
        },
        include: {
            employee: {
                select: { id: true, name: true }
            }
        }
    });

    const map = new Map<string, string>();
    assignments.forEach(a => {
        if (a.employee) {
            map.set(a.employee.id, a.employee.name);
        }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
}

export async function getClientMonthlyReport(month: number, year: number) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'CLIENTE') throw new Error("Unauthorized");

    const clientIds = user.clientIds || [];
    if (clientIds.length === 0) return [];
    
    const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

    const attendances = await prisma.attendance.findMany({
        where: {
            posto: { clientId: { in: clientIds } },
            date: { gte: startDate, lte: endDate }
        },
        include: {
            posto: {
                include: { role: true, client: true }
            },
            employee: true,
            coveredBy: true
        },
        orderBy: { date: 'desc' }
    });

    return attendances.map(a => ({
        id: a.id,
        date: a.date.toISOString(),
        postoId: a.postoId,
        clientName: a.posto.client.name,
        roleName: a.posto.role.name,
        employeeName: a.employee?.name || "Vaga em Aberto",
        status: a.status,
        clockInTime: a.clockInTime ? a.clockInTime.toISOString() : null,
        coveredByName: a.coveredBy?.name || null,
        coverageType: a.coverageType,
        notes: a.notes,
        billingValue: a.posto.billingValue
    }));
}

export async function submitClientNps(data: { clientId: string; score: number; feedback?: string }) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'CLIENTE') throw new Error("Unauthorized");

    const clientIds = user.clientIds || [];
    if (!clientIds.includes(data.clientId)) throw new Error("Unauthorized");

    const nps = await prisma.npsResponse.create({
        data: {
            clientId: data.clientId,
            score: data.score,
            feedback: data.feedback || null
        }
    });

    revalidatePath("/client/dashboard");
    return { success: true, nps };
}

export async function getClientKpis(year: number) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'CLIENTE') throw new Error("Unauthorized");

    const clientIds = user.clientIds || [];
    if (clientIds.length === 0) {
        return {
            success: true,
            monthlyData: [],
            summary: {
                effectiveness: 100,
                absenteeism: 0,
                slaCompliance: 100,
                npsScore: 100,
                mttrHours: 0
            }
        };
    }

    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    const [attendances, requests, npsResponses] = await Promise.all([
        prisma.attendance.findMany({
            where: {
                posto: { clientId: { in: clientIds } },
                date: { gte: startDate, lte: endDate }
            },
            include: { posto: true }
        }),
        prisma.request.findMany({
            where: {
                requesterId: user.id,
                createdAt: { gte: startDate, lte: endDate }
            }
        }),
        prisma.npsResponse.findMany({
            where: {
                clientId: { in: clientIds },
                createdAt: { gte: startDate, lte: endDate }
            }
        })
    ]);

    const monthNames = [
        "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
        "Jul", "Ago", "Set", "Out", "Nov", "Dez"
    ];

    const monthlyData = monthNames.map((name, index) => {
        const monthAtts = attendances.filter(a => {
            const d = new Date(a.date);
            return d.getUTCMonth() === index;
        });
        const activeShifts = monthAtts.filter(a => a.status !== "FOLGA");
        const totalShifts = activeShifts.length;
        const vacantShifts = activeShifts.filter(a => a.status === "FALTA" && !a.coveredById && !a.coverageType).length;
        const totalAbsences = activeShifts.filter(a => a.status === "FALTA").length;

        const effectiveness = totalShifts > 0 ? ((totalShifts - vacantShifts) / totalShifts) * 100 : 100;
        const absenteeism = totalShifts > 0 ? (totalAbsences / totalShifts) * 100 : 0;

        const monthRequests = requests.filter(r => new Date(r.createdAt).getUTCMonth() === index);
        const resolvedRequests = monthRequests.filter(r => r.status === "CONCLUIDO" || r.status === "REJEITADO");
        
        const slaOnTime = resolvedRequests.filter(r => r.updatedAt <= r.dueDate).length;
        const slaCompliance = resolvedRequests.length > 0 ? (slaOnTime / resolvedRequests.length) * 100 : 100;

        const monthNps = npsResponses.filter(n => new Date(n.createdAt).getUTCMonth() === index);
        const promoters = monthNps.filter(n => n.score >= 9).length;
        const detractors = monthNps.filter(n => n.score <= 6).length;
        const npsScore = monthNps.length > 0 ? ((promoters - detractors) / monthNps.length) * 100 : 100;

        return {
            monthIndex: index,
            name,
            effectiveness,
            absenteeism,
            slaCompliance,
            npsScore,
            npsCount: monthNps.length
        };
    });

    const activeAtts = attendances.filter(a => a.status !== "FOLGA");
    const totalShifts = activeAtts.length;
    const vacantShifts = activeAtts.filter(a => a.status === "FALTA" && !a.coveredById && !a.coverageType).length;
    const totalAbsences = activeAtts.filter(a => a.status === "FALTA").length;

    const totalEffectiveness = totalShifts > 0 ? ((totalShifts - vacantShifts) / totalShifts) * 100 : 100;
    const totalAbsenteeism = totalShifts > 0 ? (totalAbsences / totalShifts) * 100 : 0;

    const resolved = requests.filter(r => r.status === "CONCLUIDO" || r.status === "REJEITADO");
    const totalSlaOnTime = resolved.filter(r => r.updatedAt <= r.dueDate).length;
    const totalSlaCompliance = resolved.length > 0 ? (totalSlaOnTime / resolved.length) * 100 : 100;

    const totalPromoters = npsResponses.filter(n => n.score >= 9).length;
    const totalDetractors = npsResponses.filter(n => n.score <= 6).length;
    const totalNpsScore = npsResponses.length > 0 ? ((totalPromoters - totalDetractors) / npsResponses.length) * 100 : 100;

    const resolvedWithTimes = resolved.filter(r => r.createdAt && r.updatedAt);
    let totalHours = 0;
    resolvedWithTimes.forEach(r => {
        const diffMs = r.updatedAt.getTime() - r.createdAt.getTime();
        totalHours += diffMs / (1000 * 60 * 60);
    });
    const avgMttr = resolvedWithTimes.length > 0 ? totalHours / resolvedWithTimes.length : 0;

    return {
        success: true,
        monthlyData,
        summary: {
            effectiveness: totalEffectiveness,
            absenteeism: totalAbsenteeism,
            slaCompliance: totalSlaCompliance,
            npsScore: totalNpsScore,
            mttrHours: avgMttr
        }
    };
}
