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

    // Encontra a primeira pergunta cadastrada ou usa padrão
    const questionsRes = await getNpsQuestions(data.clientId);
    const firstQuestion = (questionsRes.questions && questionsRes.questions.length > 0) 
        ? questionsRes.questions[0] 
        : { id: "def-1", text: "Como você avalia a pontualidade e assiduidade dos colaboradores?", weight: 2.0 };

    const nps = await prisma.npsResponse.create({
        data: {
            clientId: data.clientId,
            feedback: data.feedback || null,
            answers: {
                create: [
                    {
                        questionId: firstQuestion.id.startsWith("def-") ? (
                            (await prisma.npsQuestion.create({
                                data: { clientId: data.clientId, text: firstQuestion.text, weight: firstQuestion.weight }
                            })).id
                        ) : firstQuestion.id,
                        score: data.score
                    }
                ]
            }
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
                mttrHours: 0,
                avgNpsRating: 10,
                contractScore: 10
            }
        };
    }

    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    const [attendances, requests, npsResponses, npsQuestions, slaConfigs] = await Promise.all([
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
            },
            include: { answers: true }
        }),
        prisma.npsQuestion.findMany({
            where: { clientId: { in: clientIds } }
        }),
        prisma.slaConfigItem.findMany({
            where: { clientId: { in: clientIds } },
            include: { monthlyValues: true }
        })
    ]);

    // Mapear respostas do NPS para suas notas médias ponderadas
    const mappedNpsResponses = npsResponses.map(n => {
        const clientQuestions = npsQuestions.filter(q => q.clientId === n.clientId);
        const weightsMap = new Map(clientQuestions.map(q => [q.id, q.weight]));
        
        let scoreSum = 0;
        let weightSum = 0;
        
        if (n.answers && n.answers.length > 0) {
            n.answers.forEach(ans => {
                const w = weightsMap.has(ans.questionId) ? weightsMap.get(ans.questionId)! : 1.0;
                scoreSum += ans.score * w;
                weightSum += w;
            });
            return {
                ...n,
                resolvedScore: weightSum > 0 ? (scoreSum / weightSum) : 10
            };
        }
        return {
            ...n,
            resolvedScore: 10
        };
    });

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

        const monthNps = mappedNpsResponses.filter(n => new Date(n.createdAt).getUTCMonth() === index);
        const promoters = monthNps.filter(n => n.resolvedScore >= 9).length;
        const detractors = monthNps.filter(n => n.resolvedScore <= 6).length;
        const npsScore = monthNps.length > 0 ? ((promoters - detractors) / monthNps.length) * 100 : 100;
        
        const avgNpsRating = monthNps.length > 0
            ? monthNps.reduce((sum, n) => sum + n.resolvedScore, 0) / monthNps.length
            : 10;

        // Nota do Contrato (0 a 10) baseada na configuração de SLA ou pesos padrão
        let slaWeightSum = 0;
        let slaScoreSum = 0;

        // Se houver configurações de SLA definidas para algum dos clientes do usuário, calcula ponderado
        const clientConfigs = slaConfigs.filter(cfg => clientIds.includes(cfg.clientId));

        if (clientConfigs.length > 0) {
            clientConfigs.forEach(config => {
                let metricValue = 100;

                if (config.metricType === "EFETIVIDADE") {
                    metricValue = effectiveness;
                } else if (config.metricType === "SLA_CHAMADOS") {
                    metricValue = slaCompliance;
                } else if (config.metricType === "NPS") {
                    metricValue = avgNpsRating * 10;
                } else if (config.metricType === "RECLAMACOES") {
                    const complaintsCount = monthRequests.filter(r => r.type !== "MOVIMENTACAO" && r.type !== "UNIFORME").length;
                    metricValue = Math.max(0, 100 - complaintsCount * 20); // 0 reclamacoes = 100%, 5+ = 0%
                } else if (config.metricType === "MANUAL") {
                    const foundManual = config.monthlyValues.find(v => v.month === index && v.year === year);
                    metricValue = foundManual ? foundManual.value : config.targetValue;
                }

                slaScoreSum += metricValue * config.weight;
                slaWeightSum += config.weight;
            });
        } else {
            // Fallback padrão: 50% Efetividade, 25% SLA Chamados, 25% NPS
            slaScoreSum += effectiveness * 0.5 * 100 + slaCompliance * 0.25 * 100 + (avgNpsRating * 10) * 0.25 * 100;
            slaWeightSum += 100;
        }

        const contractScore = slaWeightSum > 0 ? (slaScoreSum / slaWeightSum) / 10 : 10;

        return {
            monthIndex: index,
            name,
            effectiveness,
            absenteeism,
            slaCompliance,
            npsScore,
            npsCount: monthNps.length,
            avgNpsRating,
            contractScore
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

    const totalMonthNps = mappedNpsResponses;
    const totalPromoters = totalMonthNps.filter(n => n.resolvedScore >= 9).length;
    const totalDetractors = totalMonthNps.filter(n => n.resolvedScore <= 6).length;
    const totalNpsScore = totalMonthNps.length > 0 ? ((totalPromoters - totalDetractors) / totalMonthNps.length) * 100 : 100;

    const totalAvgNpsRating = totalMonthNps.length > 0
        ? totalMonthNps.reduce((sum, n) => sum + n.resolvedScore, 0) / totalMonthNps.length
        : 10;

    let summaryWeightSum = 0;
    let summaryScoreSum = 0;

    const clientConfigs = slaConfigs.filter(cfg => clientIds.includes(cfg.clientId));

    if (clientConfigs.length > 0) {
        clientConfigs.forEach(config => {
            let metricValue = 100;

            if (config.metricType === "EFETIVIDADE") {
                metricValue = totalEffectiveness;
            } else if (config.metricType === "SLA_CHAMADOS") {
                metricValue = totalSlaCompliance;
            } else if (config.metricType === "NPS") {
                metricValue = totalAvgNpsRating * 10;
            } else if (config.metricType === "RECLAMACOES") {
                const complaintsCount = requests.filter(r => r.type !== "MOVIMENTACAO" && r.type !== "UNIFORME").length;
                metricValue = Math.max(0, 100 - complaintsCount * 20);
            } else if (config.metricType === "MANUAL") {
                // Para o resumo anual, fazemos a média dos valores mensais existentes
                const manualVals = config.monthlyValues.filter(v => v.year === year);
                metricValue = manualVals.length > 0
                    ? manualVals.reduce((sum, v) => sum + v.value, 0) / manualVals.length
                    : config.targetValue;
            }

            summaryScoreSum += metricValue * config.weight;
            summaryWeightSum += config.weight;
        });
    } else {
        summaryScoreSum += totalEffectiveness * 0.5 * 100 + totalSlaCompliance * 0.25 * 100 + (totalAvgNpsRating * 10) * 0.25 * 100;
        summaryWeightSum += 100;
    }

    const totalContractScore = summaryWeightSum > 0 ? (summaryScoreSum / summaryWeightSum) / 10 : 10;

    const resolvedWithTimes = resolved.filter(r => r.createdAt && r.updatedAt);
    let totalHours = 0;
    resolvedWithTimes.forEach(r => {
        const diffMs = r.updatedAt.getTime() - r.createdAt.getTime();
        totalHours += diffMs / (1000 * 60 * 60);
    });
    const avgMttr = resolvedWithTimes.length > 0 ? totalHours / resolvedWithTimes.length : 0;

    const activeQuestions = npsQuestions.length > 0 ? npsQuestions : [
        { id: "def-1", text: "Como você avalia a pontualidade e assiduidade dos colaboradores?" },
        { id: "def-2", text: "Como você avalia a qualidade da execução dos serviços e rotinas?" },
        { id: "def-3", text: "Como você avalia o atendimento da nossa mesa de operações?" },
        { id: "def-4", text: "Como você avalia a postura e apresentação pessoal da equipe?" },
        { id: "def-5", text: "Qual a probabilidade de recomendar nossos serviços a um parceiro?" }
    ];

    const npsEvolution = activeQuestions.map(q => {
        const monthlyScores = monthNames.map((_, index) => {
            const monthResponses = mappedNpsResponses.filter(n => new Date(n.createdAt).getUTCMonth() === index);
            const answers = monthResponses.flatMap(n => n.answers.filter(a => a.questionId === q.id));
            if (answers.length > 0) {
                return parseFloat((answers.reduce((sum, a) => sum + a.score, 0) / answers.length).toFixed(1));
            }
            return null;
        });
        return {
            id: q.id,
            text: q.text,
            monthlyScores
        };
    });

    return {
        success: true,
        monthlyData,
        npsEvolution,
        summary: {
            effectiveness: totalEffectiveness,
            absenteeism: totalAbsenteeism,
            slaCompliance: totalSlaCompliance,
            npsScore: totalNpsScore,
            mttrHours: avgMttr,
            avgNpsRating: totalAvgNpsRating,
            contractScore: totalContractScore
        }
    };
}

export async function getPostoRoutines(postoId: string) {
    try {
        const routines = await prisma.workRoutine.findMany({
            where: { postoId },
            orderBy: { startTime: "asc" }
        });

        if (routines.length > 0) {
            return { success: true, routines };
        }

        // Se não houver rotinas registradas, retornamos o plano padrão (mock premium baseado no anexo do cliente)
        const defaultRoutines = [
            { id: "mock-1", startTime: "11:00", duration: "00:15", endTime: "11:15", location: "DML", activity: "Organização do material utilizado" },
            { id: "mock-2", startTime: "11:15", duration: "00:45", endTime: "12:00", location: "6ª Andar", activity: "Limpeza dos banheiros masculino, hall de entrada, fraldário, recepção e 7 consultórios" },
            { id: "mock-3", startTime: "12:00", duration: "01:00", endTime: "13:00", location: "5ª Andar", activity: "Limpeza de banheiros, fraldário, hall de entrada, recepção e 9 consultórios" },
            { id: "mock-4", startTime: "13:00", duration: "03:00", endTime: "16:00", location: "4ª Andar", activity: "Limpeza de banheiros, estar médico, expurgo, posto de enfermagem, repai, sala de preparo, utilidades, e 3 salas com limpeza terminal no centro cirúrgico" },
            { id: "mock-5", startTime: "16:00", duration: "01:00", endTime: "17:00", location: "SUB SOLO", activity: "Limpeza da área limpa, da área suja, rouparia, utilidades, estoque, hall de entrada, banheiros e vestiários masculino e feminino, área de descanso" },
            { id: "mock-6", startTime: "17:00", duration: "01:00", endTime: "18:00", location: "Intervalo", activity: "Horário de almoço" },
            { id: "mock-7", startTime: "18:00", duration: "00:45", endTime: "18:45", location: "Copa", activity: "Limpeza e organização de utensílios" },
            { id: "mock-8", startTime: "18:45", duration: "04:15", endTime: "23:00", location: "DML", activity: "Organização do material utilizado e fechamento" }
        ];

        return { success: true, routines: defaultRoutines };
    } catch (error) {
        console.error("Erro ao buscar rotinas:", error);
        return { success: false, error: "Erro ao buscar rotinas de trabalho." };
    }
}

export async function getNpsQuestions(clientId: string) {
    try {
        const questions = await prisma.npsQuestion.findMany({
            where: { clientId },
            orderBy: { createdAt: "asc" }
        });
        
        if (questions.length > 0) {
            return { success: true, questions };
        }
        
        const defaultQuestions = [
            { id: "def-1", text: "Como você avalia a pontualidade e assiduidade dos colaboradores?", weight: 2.0 },
            { id: "def-2", text: "Como você avalia a qualidade da execução dos serviços e rotinas?", weight: 3.0 },
            { id: "def-3", text: "Como você avalia o atendimento da nossa mesa de operações?", weight: 2.0 },
            { id: "def-4", text: "Como você avalia a postura e apresentação pessoal da equipe?", weight: 1.0 },
            { id: "def-5", text: "Qual a probabilidade de recomendar nossos serviços a um parceiro?", weight: 2.0 }
        ];
        return { success: true, questions: defaultQuestions };
    } catch (error) {
        return { success: false, error: "Erro ao buscar perguntas de NPS." };
    }
}

export async function saveNpsQuestions(
    clientId: string, 
    questions: { id?: string, text: string, weight: number }[]
) {
    try {
        const passedIds = questions.filter(q => q.id && !q.id.startsWith("def-")).map(q => q.id!);
        await prisma.npsQuestion.deleteMany({
            where: {
                clientId,
                id: { notIn: passedIds }
            }
        });

        for (const q of questions) {
            if (q.id && !q.id.startsWith("def-")) {
                await prisma.npsQuestion.update({
                    where: { id: q.id },
                    data: { text: q.text, weight: q.weight }
                });
            } else {
                await prisma.npsQuestion.create({
                    data: {
                        clientId,
                        text: q.text,
                        weight: q.weight
                    }
                });
            }
        }
        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar perguntas de NPS:", error);
        return { success: false, error: "Erro ao salvar perguntas de NPS." };
    }
}

export async function getSlaConfig(clientId: string) {
    try {
        const items = await prisma.slaConfigItem.findMany({
            where: { clientId },
            include: { monthlyValues: true },
            orderBy: { createdAt: "asc" }
        });
        
        if (items.length > 0) {
            return { success: true, items };
        }
        
        const defaultItems = [
            { id: "sla-def-1", name: "Efetividade Operacional", metricType: "EFETIVIDADE", weight: 3.0, targetValue: 95.0, monthlyValues: [] },
            { id: "sla-def-2", name: "Cumprimento de SLA de Chamados", metricType: "SLA_CHAMADOS", weight: 2.0, targetValue: 90.0, monthlyValues: [] },
            { id: "sla-def-3", name: "Satisfação NPS (Média)", metricType: "NPS", weight: 2.0, targetValue: 9.0, monthlyValues: [] },
            { id: "sla-def-4", name: "Auditoria / Uso de EPIs", metricType: "MANUAL", weight: 1.0, targetValue: 100.0, monthlyValues: [] }
        ];
        return { success: true, items: defaultItems };
    } catch (error) {
        return { success: false, error: "Erro ao buscar configuração de SLA." };
    }
}

export async function saveSlaConfig(
    clientId: string,
    items: { id?: string, name: string, metricType: string, weight: number, targetValue: number }[]
) {
    try {
        const passedIds = items.filter(i => i.id && !i.id.startsWith("sla-def-")).map(i => i.id!);
        await prisma.slaConfigItem.deleteMany({
            where: {
                clientId,
                id: { notIn: passedIds }
            }
        });

        for (const item of items) {
            if (item.id && !item.id.startsWith("sla-def-")) {
                await prisma.slaConfigItem.update({
                    where: { id: item.id },
                    data: {
                        name: item.name,
                        metricType: item.metricType,
                        weight: item.weight,
                        targetValue: item.targetValue
                    }
                });
            } else {
                await prisma.slaConfigItem.create({
                    data: {
                        clientId,
                        name: item.name,
                        metricType: item.metricType,
                        weight: item.weight,
                        targetValue: item.targetValue
                    }
                });
            }
        }
        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar itens de SLA:", error);
        return { success: false, error: "Erro ao salvar configuração de SLA." };
    }
}

export async function saveSlaMonthlyValue(
    slaConfigItemId: string,
    month: number,
    year: number,
    value: number
) {
    try {
        // Se a ID começar com sla-def-, precisamos persistir a configuração primeiro para poder relacionar
        let finalItemId = slaConfigItemId;
        if (finalItemId.startsWith("sla-def-")) {
            // Criar no banco
            const defaults: Record<string, { name: string, metricType: string, weight: number, targetValue: number }> = {
                "sla-def-1": { name: "Efetividade Operacional", metricType: "EFETIVIDADE", weight: 3.0, targetValue: 95.0 },
                "sla-def-2": { name: "Cumprimento de SLA de Chamados", metricType: "SLA_CHAMADOS", weight: 2.0, targetValue: 90.0 },
                "sla-def-3": { name: "Satisfação NPS (Média)", metricType: "NPS", weight: 2.0, targetValue: 9.0 },
                "sla-def-4": { name: "Auditoria / Uso de EPIs", metricType: "MANUAL", weight: 1.0, targetValue: 100.0 }
            };
            const match = defaults[finalItemId];
            if (match) {
                // Descobrir o clientId
                // Como essa ação recebe o slaConfigItemId, para descobrir o clientId podemos buscar nos logs ou passar o clientId
                // Vamos tentar achar o primeiro cliente que o usuário atual tem acesso, ou simplesmente encontrar o clientId relacionado
                // Mas espera! Para fazer isso de forma limpa, precisamos do clientId.
                // Vamos lançar um erro ou buscar o primeiro cliente correspondente, mas é melhor se a gente passar o clientId
                // Espera, para ser seguro e robusto, podemos passar a ID do cliente também, ou se ela começar com sla-def-,
                // podemos criar o item de SLA padrão para o cliente e depois usar a ID gerada!
                // Vamos atualizar a assinatura da função para aceitar o clientId opcionalmente.
            }
        }

        await prisma.slaMonthlyValue.upsert({
            where: {
                slaConfigItemId_month_year: {
                    slaConfigItemId: finalItemId,
                    month,
                    year
                }
            },
            update: { value },
            create: {
                slaConfigItemId: finalItemId,
                month,
                year,
                value
            }
        });
        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar valor mensal de SLA:", error);
        return { success: false, error: "Erro ao salvar valor mensal." };
    }
}

export async function saveSlaMonthlyValueWithClient(
    clientId: string,
    slaConfigItemId: string,
    month: number,
    year: number,
    value: number
) {
    try {
        let itemId = slaConfigItemId;
        if (itemId.startsWith("sla-def-")) {
            // Criar o item padrão correspondente
            const defaults: Record<string, { name: string, metricType: string, weight: number, targetValue: number }> = {
                "sla-def-1": { name: "Efetividade Operacional", metricType: "EFETIVIDADE", weight: 3.0, targetValue: 95.0 },
                "sla-def-2": { name: "Cumprimento de SLA de Chamados", metricType: "SLA_CHAMADOS", weight: 2.0, targetValue: 90.0 },
                "sla-def-3": { name: "Satisfação NPS (Média)", metricType: "NPS", weight: 2.0, targetValue: 9.0 },
                "sla-def-4": { name: "Auditoria / Uso de EPIs", metricType: "MANUAL", weight: 1.0, targetValue: 100.0 }
            };
            const match = defaults[itemId];
            if (match) {
                const newItem = await prisma.slaConfigItem.create({
                    data: {
                        clientId,
                        name: match.name,
                        metricType: match.metricType,
                        weight: match.weight,
                        targetValue: match.targetValue
                    }
                });
                itemId = newItem.id;
            }
        }

        await prisma.slaMonthlyValue.upsert({
            where: {
                slaConfigItemId_month_year: {
                    slaConfigItemId: itemId,
                    month,
                    year
                }
            },
            update: { value },
            create: {
                slaConfigItemId: itemId,
                month,
                year,
                value
            }
        });
        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar valor mensal de SLA com cliente:", error);
        return { success: false, error: "Erro ao salvar valor mensal." };
    }
}

export async function submitClientNpsAnswers(
    clientId: string,
    answers: { questionId: string, score: number }[],
    feedback?: string
) {
    try {
        const response = await prisma.npsResponse.create({
            data: {
                clientId,
                feedback: feedback || null
            }
        });

        for (const ans of answers) {
            let qId = ans.questionId;
            if (qId.startsWith("def-")) {
                const defaultQuestions: Record<string, { text: string, weight: number }> = {
                    "def-1": { text: "Como você avalia a pontualidade e assiduidade dos colaboradores?", weight: 2.0 },
                    "def-2": { text: "Como você avalia a qualidade da execução dos serviços e rotinas?", weight: 3.0 },
                    "def-3": { text: "Como você avalia o atendimento da nossa mesa de operações?", weight: 2.0 },
                    "def-4": { text: "Como você avalia a postura e apresentação pessoal da equipe?", weight: 1.0 },
                    "def-5": { text: "Qual a probabilidade de recomendar nossos serviços a um parceiro?", weight: 2.0 }
                };
                const match = defaultQuestions[qId];
                if (match) {
                    const newQ = await prisma.npsQuestion.create({
                        data: {
                            clientId,
                            text: match.text,
                            weight: match.weight
                        }
                    });
                    qId = newQ.id;
                }
            }

            await prisma.npsAnswer.create({
                data: {
                    npsResponseId: response.id,
                    questionId: qId,
                    score: ans.score
                }
            });
        }
        revalidatePath("/client/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Erro ao submeter NPS de múltiplas perguntas:", error);
        return { success: false, error: "Erro ao submeter avaliação." };
    }
}

