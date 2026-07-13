"use server";
// Função utilitária para converter valor real em pontuação com base nas faixas de atingimento (SLA Ranges)
function calculateAtingimentoVal(realVal: number | null, ranges: any[]): number | null {
    if (realVal === null || realVal === undefined) return null;
    if (!ranges || ranges.length === 0) return realVal;

    // Ordenar as faixas do menor mínimo para o maior mínimo
    const sortedRanges = [...ranges].sort((x, y) => x.minVal - y.minVal);
    for (const r of sortedRanges) {
        const isAboveMin = realVal >= r.minVal;
        const isBelowMax = r.maxVal === null || r.maxVal === undefined || realVal <= r.maxVal;
        if (isAboveMin && isBelowMax) {
            return r.resultVal;
        }
    }
    return 0; // Se não atingiu nenhuma faixa mínima configurada
}


import { prisma } from "@/lib/db";
import { generateRoster } from "@/lib/scheduling";
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

export async function updateRequestClient(requestId: string, newClientId: string) {
    const user = await getCurrentUser();
    if (!user || user.role === 'SUPERVISOR') throw new Error("Unauthorized");

    await prisma.request.update({
        where: { id: requestId },
        data: { clientId: newClientId }
    });

    revalidatePath("/admin/performance");
    return { success: true };
}

export async function updateRequestDetails(id: string, data: { description?: string, employeeId?: string | null, dueDate?: string }) {
    const user = await getCurrentUser();
    if (!user || user.role === 'SUPERVISOR') throw new Error("Unauthorized");

    const updateData: any = {};
    if (data.description !== undefined) updateData.description = data.description;
    if (data.employeeId !== undefined) updateData.employeeId = data.employeeId;
    if (data.dueDate !== undefined) {
        updateData.dueDate = new Date(data.dueDate);
    }

    await prisma.request.update({
        where: { id },
        data: updateData
    });

    revalidatePath("/admin/performance");
    revalidatePath("/admin/requests");
    return { success: true };
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

    if (!content.trim()) throw new Error("Conteúdo do comentário não pode ser vazio.");

    const comment = await prisma.requestComment.create({
        data: {
            content,
            requestId,
            userId: user.id
        },
        include: {
            user: { select: { name: true, role: true } }
        }
    });

    revalidatePath("/client/dashboard");
    revalidatePath("/admin/performance");
    revalidatePath("/admin/requests");
    
    return { success: true, comment };
}

export async function getRequestComments(requestId: string) {
    return await prisma.requestComment.findMany({
        where: { requestId },
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'asc' }
    });
}

export async function getClientRequests() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const clientIds = user.clientIds || [];

    return await prisma.request.findMany({
        where: {
            OR: [
                { requesterId: user.id },
                { clientId: { in: clientIds } }
            ]
        },
        include: {
            employee: { select: { name: true, role: { select: { name: true } } } },
            resolver: { select: { name: true } },
            comments: {
                include: {
                    user: { select: { name: true, role: true } }
                },
                orderBy: { createdAt: 'asc' }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}


function addBusinessDays(date: Date, days: number): Date {
    const result = new Date(date.getTime());
    let added = 0;
    // Feriados nacionais fixos (MM-DD)
    const fixedHolidays = [
        "01-01", // Ano Novo
        "04-21", // Tiradentes
        "05-01", // Dia do Trabalho
        "09-07", // Independência
        "10-12", // Padroeira do Brasil
        "11-02", // Finados
        "11-15", // Proclamação da República
        "12-25"  // Natal
    ];

    while (added < days) {
        result.setDate(result.getDate() + 1);
        const dayOfWeek = result.getDay(); // 0 = Domingo, 6 = Sábado
        const monthDayStr = `${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
        
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = fixedHolidays.includes(monthDayStr);

        if (!isWeekend && !isHoliday) {
            added++;
        }
    }
    return result;
}

export async function createClientRequest(data: { type: any, description: string, employeeId?: string, clientId?: string }) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'CLIENTE') throw new Error("Unauthorized");

    // Prazo para primeira resposta é de 24h úteis (1 dia útil)
    const dueDate = addBusinessDays(new Date(), 1);

    const request = await prisma.request.create({
        data: {
            type: data.type,
            description: data.description,
            employeeId: data.employeeId || null,
            requesterId: user.id,
            clientId: data.clientId || user.clientIds?.[0] || null,
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
    const firstClientId = clientIds[0];
    const clientRecord = firstClientId ? await prisma.client.findUnique({
        where: { id: firstClientId },
        select: { contractTargetScore: true }
    }) : null;
    const contractTargetScore = clientRecord?.contractTargetScore ?? 90.0;
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

    const startDate = new Date(year, 0, 1, 0, 0, 0);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const [attendances, requests, npsResponses, npsQuestions, slaConfigs, assignments, totalPostosCount, visitRequirements, visits] = await Promise.all([
        prisma.attendance.findMany({
            where: {
                posto: { clientId: { in: clientIds } },
                date: { gte: startDate, lte: endDate }
            },
            include: { posto: true }
        }),
        prisma.request.findMany({
            where: {
                clientId: { in: clientIds },
                createdAt: { gte: startDate, lte: endDate }
            },
            include: {
                requester: true
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
            include: { monthlyValues: true, ranges: true }
        }),
        prisma.assignment.findMany({
            where: {
                posto: { clientId: { in: clientIds } }
            },
            include: {
                posto: { include: { role: true } },
                employee: true
            },
            orderBy: { startDate: "asc" }
        }),
        prisma.posto.count({
            where: { clientId: { in: clientIds } }
        }),
        prisma.clientVisitRequirement.findMany({
            where: { clientId: { in: clientIds } }
        }),
        prisma.contractVisit.findMany({
            where: {
                clientId: { in: clientIds },
                visitDate: { gte: startDate, lte: endDate }
            }
        })
    ]);

    const postos = await prisma.posto.findMany({
        where: { clientId: { in: clientIds } },
        include: {
            assignments: {
                orderBy: { startDate: "desc" }
            }
        }
    });

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
        const isMockPeriod = year === 2026 && index !== 6;
        
        const monthVisits = isMockPeriod ? [] : visits.filter((v: any) => {
            const d = new Date(v.visitDate);
            return d.getMonth() === index && d.getFullYear() === year;
        });

        let visitAtingimentoSum = 0;
        let activeRolesCount = 0;

        if (visitRequirements.length > 0) {
            visitRequirements.forEach((req: any) => {
                if (req.frequency > 0) {
                    activeRolesCount++;
                    const roleVisitsCount = monthVisits.filter((v: any) => v.visitorRole === req.visitorRole).length;
                    const atingimento = Math.min(100, (roleVisitsCount / req.frequency) * 100);
                    visitAtingimentoSum += atingimento;
                }
            });
        }

        const visitsScore = activeRolesCount > 0 ? (visitAtingimentoSum / activeRolesCount) : null;

        // 2. Turnover
        const monthSubstitutions = assignments.filter(a => a.endDate && new Date(a.endDate).getUTCMonth() === index).length;
        const activeStaff = totalPostosCount > 0 ? totalPostosCount : 5;
        const turnover = activeStaff > 0 ? (monthSubstitutions / activeStaff) * 100 : 0;

        // 3. SLA de Reposição (Média de dias decorridos para reposição)
        const assignmentsByPosto: { [key: string]: any[] } = {};
        assignments.forEach((a: any) => {
            if (!assignmentsByPosto[a.postoId]) {
                assignmentsByPosto[a.postoId] = [];
            }
            assignmentsByPosto[a.postoId].push(a);
        });

        const repositionTransitions: any[] = [];
        Object.keys(assignmentsByPosto).forEach((postoId) => {
            const list = assignmentsByPosto[postoId].sort((x, y) => {
                const tx = x.startDate ? new Date(x.startDate).getTime() : 0;
                const ty = y.startDate ? new Date(y.startDate).getTime() : 0;
                return tx - ty;
            });
            for (let i = 0; i < list.length - 1; i++) {
                const current = list[i];
                const next = list[i + 1];
                if (current && current.endDate && next && next.startDate) {
                    const exitDate = new Date(current.endDate);
                    const entryDate = new Date(next.startDate);
                    if (!isNaN(exitDate.getTime()) && !isNaN(entryDate.getTime()) && entryDate >= exitDate) {
                        const diffTime = Math.abs(entryDate.getTime() - exitDate.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        repositionTransitions.push({
                            entryDate,
                            diffDays
                        });
                    }
                }
            }
        });

        const monthRepositionTransitions = repositionTransitions.filter(t => 
            t.entryDate.getMonth() <= index && 
            t.entryDate.getFullYear() === year
        );
        const totalRepositionDays = monthRepositionTransitions.reduce((sum, t) => sum + t.diffDays, 0);
        const avgRepositionDays = monthRepositionTransitions.length > 0 ? parseFloat((totalRepositionDays / monthRepositionTransitions.length).toFixed(1)) : null;

        // 4. Reclamações
        const monthRequests = isMockPeriod ? [] : requests.filter(r => new Date(r.createdAt).getMonth() === index && r.requester?.role === 'CLIENTE');
        const complaints = monthRequests.filter((r: any) => r.description?.toLowerCase().includes("reclam") || r.description?.toLowerCase().includes("queixa"));
        const complaintsRate = monthRequests.length > 0 ? (complaints.length / monthRequests.length) * 100 : 0;

        let totalShifts = 0;
        let vacantShifts = 0;
        let totalAbsences = 0;

        if (!isMockPeriod) {
            const daysInMonth = [];
            const startOfThisMonth = new Date(year, index, 1);
            const endOfThisMonth = new Date(year, index + 1, 0);
            
            const today = new Date();
            const maxDate = (today.getFullYear() === year && today.getMonth() === index) ? today : endOfThisMonth;
            
            for (let d = new Date(startOfThisMonth); d <= maxDate; d.setDate(d.getDate() + 1)) {
                daysInMonth.push(new Date(d));
            }

            daysInMonth.forEach(dayDate => {
                const dayDateStr = dayDate.toISOString().split("T")[0];
                const targetDate = new Date(dayDateStr + "T00:00:00Z");

                postos.forEach(posto => {
                    const assignment = posto.assignments.find(a => {
                        const start = new Date(a.startDate);
                        const end = a.endDate ? new Date(a.endDate) : null;
                        return start <= targetDate && (!end || end >= targetDate);
                    });

                    let shouldWork = false;
                    if (!assignment) {
                        const dayOfWeek = targetDate.getDay();
                        const normSchedule = posto.schedule.replace(/\s+/g, '').toLowerCase();
                        shouldWork = true;
                        if (normSchedule.includes('segasex') || normSchedule.includes('mondaytofriday')) {
                            if (dayOfWeek === 0 || dayOfWeek === 6) shouldWork = false;
                        } else if (normSchedule.includes('segasab') || normSchedule.includes('mondaytosaturday')) {
                            if (dayOfWeek === 0) shouldWork = false;
                        }
                    } else {
                        const roster = generateRoster(posto.schedule, new Date(assignment.startDate), [targetDate]);
                        shouldWork = roster[0]?.status === 'Trabalho';
                    }

                    if (shouldWork) {
                        totalShifts++;

                        const att = attendances.find(a => 
                            a.postoId === posto.id && 
                            new Date(a.date).toISOString().split("T")[0] === dayDateStr
                        );

                        if (att) {
                            if (att.status === "FALTA") {
                                totalAbsences++;
                                if (!att.coveredById && att.coverageType !== "DIARISTA" && att.coverageType !== "RESERVA_TECNICA") {
                                    vacantShifts++;
                                }
                            }
                        } else {
                            const todayStr = today.toISOString().split("T")[0];
                            const isPastDay = targetDate.getTime() < new Date(todayStr + "T00:00:00Z").getTime();
                            let isEndedToday = false;

                            if (today.getFullYear() === year && today.getMonth() === index && today.getDate() === dayDate.getDate()) {
                                const [endHour, endMinute] = posto.endTime.split(":").map(Number);
                                const shiftEnd = new Date(dayDate);
                                shiftEnd.setHours(endHour, endMinute, 0, 0);
                                const nowInBrazil = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
                                if (nowInBrazil > shiftEnd) {
                                    isEndedToday = true;
                                }
                            }

                            if (isPastDay || isEndedToday) {
                                vacantShifts++;
                                totalAbsences++;
                            }
                        }
                    }
                });
            });
        }

        const effectiveness = totalShifts > 0 ? ((totalShifts - vacantShifts) / totalShifts) * 100 : null;
        const absenteeism = totalShifts > 0 ? (totalAbsences / totalShifts) * 100 : null;
        const resolvedRequests = monthRequests.filter(r => r.status === "CONCLUIDO" || r.status === "REJEITADO");
        
        const slaOnTime = resolvedRequests.filter(r => r.updatedAt <= r.dueDate).length;
        const slaCompliance = resolvedRequests.length > 0 ? (slaOnTime / resolvedRequests.length) * 100 : null;

        const monthNps = isMockPeriod ? [] : mappedNpsResponses.filter(n => new Date(n.createdAt).getMonth() === index);
        const promoters = monthNps.filter(n => n.resolvedScore >= 9).length;
        const detractors = monthNps.filter(n => n.resolvedScore <= 6).length;
        const npsScore = monthNps.length > 0 ? ((promoters - detractors) / monthNps.length) * 100 : null;
        
        const avgNpsRating = monthNps.length > 0
            ? monthNps.reduce((sum, n) => sum + n.resolvedScore, 0) / monthNps.length
            : null;

        // Nota do Contrato (0 a 10) baseada na configuração de SLA ou pesos padrão
        let contractScore: number | null = null;
        let slaWeightSum = 0;
        let slaScoreSum = 0;

        // Se houver configurações de SLA definidas para algum dos clientes do usuário, calcula ponderado
        const clientConfigs = slaConfigs.filter(cfg => clientIds.includes(cfg.clientId));

        if (effectiveness === null || effectiveness === undefined) {
            contractScore = null;
        } else if (clientConfigs.length > 0) {
            clientConfigs.forEach(config => {
                let metricValue = null;

                if (config.metricType === "EFETIVIDADE") {
                    metricValue = effectiveness;
                } else if (config.metricType === "SLA_CHAMADOS") {
                    metricValue = slaCompliance;
                } else if (config.metricType === "NPS") {
                    metricValue = avgNpsRating !== null ? avgNpsRating * 10 : null;
                } else if (config.metricType === "RECLAMACOES") {
                    const complaintsCount = monthRequests.filter(r => r.type !== "MOVIMENTACAO" && r.type !== "UNIFORME").length;
                    metricValue = complaintsCount; // 0 reclamacoes = 100%, 5+ = 0%
                } else if (config.metricType === "MANUAL") {
                    const foundManual = config.monthlyValues.find(v => v.month === index && v.year === year);
                    metricValue = foundManual ? foundManual.value : config.targetValue;
                } else if (config.metricType === "TURNOVER") {
                    metricValue = turnover;
                } else if (config.metricType === "REPOSICAO") {
                    metricValue = avgRepositionDays;
                } else if (config.metricType === "VISITAS") {
                    metricValue = visitsScore;
                }

                if (metricValue !== null && config.ranges && config.ranges.length > 0) {
                    metricValue = calculateAtingimentoVal(metricValue, config.ranges);
                }

                if (metricValue !== null && metricValue !== undefined) {
                    slaScoreSum += metricValue * config.weight;
                    slaWeightSum += config.weight;
                }
            });
        } else {
            // Fallback padrão: 50% Efetividade, 25% SLA Chamados, 25% NPS
            let weightSum = 0;
            if (effectiveness !== null) {
                slaScoreSum += effectiveness * 0.5 * 100;
                weightSum += 50;
            }
            if (slaCompliance !== null) {
                slaScoreSum += slaCompliance * 0.25 * 100;
                weightSum += 25;
            }
            if (avgNpsRating !== null) {
                slaScoreSum += (avgNpsRating * 10) * 0.25 * 100;
                weightSum += 25;
            }
            slaWeightSum = weightSum;
        }

        const calculatedScore = slaWeightSum > 0 ? (slaScoreSum / slaWeightSum) / 10 : null;
        if (effectiveness !== null && effectiveness !== undefined) {
            contractScore = calculatedScore;
        }



        return {
            monthIndex: index,
            name,
            effectiveness,
            absenteeism,
            slaCompliance,
            npsScore,
            npsCount: monthNps.length,
            avgNpsRating,
            contractScore,
            turnover,
            complaintsRate,
            avgRepositionDays,
            visitsScore
        };
    });

    const resolved = requests.filter(r => r.status === "CONCLUIDO" || r.status === "REJEITADO");
    const totalMonthNps = mappedNpsResponses;
    const validEffectiveness = monthlyData.filter(m => m.effectiveness !== null && m.effectiveness !== undefined);
    const totalEffectiveness = validEffectiveness.length > 0
        ? validEffectiveness.reduce((sum, m) => sum + m.effectiveness!, 0) / validEffectiveness.length
        : null;

    const totalAbsenteeism = null; // Card removido do front-end

    const validSla = monthlyData.filter(m => m.slaCompliance !== null && m.slaCompliance !== undefined);
    const totalSlaCompliance = validSla.length > 0
        ? validSla.reduce((sum, m) => sum + m.slaCompliance!, 0) / validSla.length
        : null;

    const validNps = monthlyData.filter(m => m.avgNpsRating !== null && m.avgNpsRating !== undefined);
    const totalAvgNpsRating = validNps.length > 0
        ? validNps.reduce((sum, m) => sum + m.avgNpsRating!, 0) / validNps.length
        : null;

    const totalPromoters = 0;
    const totalDetractors = 0;
    const totalNpsScore = null;

    const validVisits = monthlyData.filter(m => m.visitsScore !== null && m.visitsScore !== undefined);
    const totalVisitsScore = validVisits.length > 0
        ? validVisits.reduce((sum, m) => sum + m.visitsScore!, 0) / validVisits.length
        : null;

    let summaryWeightSum = 0;
    let summaryScoreSum = 0;

    const clientConfigs = slaConfigs.filter(cfg => clientIds.includes(cfg.clientId));

    if (clientConfigs.length > 0) {
        clientConfigs.forEach(config => {
            let metricValue: number | null = 100;

            if (config.metricType === "EFETIVIDADE") {
                metricValue = totalEffectiveness;
            } else if (config.metricType === "SLA_CHAMADOS") {
                metricValue = totalSlaCompliance;
            } else if (config.metricType === "NPS") {
                metricValue = totalAvgNpsRating !== null ? totalAvgNpsRating * 10 : null;
            } else if (config.metricType === "RECLAMACOES") {
                const complaintsCount = requests.filter(r => r.type !== "MOVIMENTACAO" && r.type !== "UNIFORME").length;
                metricValue = complaintsCount;
            } else if (config.metricType === "MANUAL") {
                // Para o resumo anual, fazemos a média dos valores mensais existentes
                const manualVals = config.monthlyValues.filter(v => v.year === year);
                metricValue = manualVals.length > 0
                    ? manualVals.reduce((sum, v) => sum + v.value, 0) / manualVals.length
                    : config.targetValue;
            } else if (config.metricType === "TURNOVER") {
                const validTurnover = monthlyData.filter(m => m.turnover !== null && m.turnover !== undefined);
                metricValue = validTurnover.length > 0 ? validTurnover.reduce((sum, m) => sum + m.turnover, 0) / validTurnover.length : null;
            } else if (config.metricType === "REPOSICAO") {
                const validRep = monthlyData.filter(m => m.avgRepositionDays !== null && m.avgRepositionDays !== undefined);
                metricValue = validRep.length > 0 ? validRep.reduce((sum, m) => sum + m.avgRepositionDays!, 0) / validRep.length : null;
            } else if (config.metricType === "VISITAS") {
                metricValue = totalVisitsScore;
            }

            if (metricValue !== null && metricValue !== undefined) {
                if (metricValue !== null && config.ranges && config.ranges.length > 0) {
                    metricValue = calculateAtingimentoVal(metricValue, config.ranges);
                }

                if (metricValue !== null && metricValue !== undefined) {
                    summaryScoreSum += metricValue * config.weight;
                    summaryWeightSum += config.weight;
                }
            }
        });
    } else {
        let weightSum = 0;
        if (totalEffectiveness !== null) {
            summaryScoreSum += totalEffectiveness * 0.5 * 100;
            weightSum += 50;
        }
        if (totalSlaCompliance !== null) {
            summaryScoreSum += totalSlaCompliance * 0.25 * 100;
            weightSum += 25;
        }
        if (totalAvgNpsRating !== null) {
            summaryScoreSum += (totalAvgNpsRating * 10) * 0.25 * 100;
            weightSum += 25;
        }
        summaryWeightSum = weightSum;
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
        contractTargetScore,
        monthlyData,
        npsEvolution,
        visits,
        summary: {
            effectiveness: totalEffectiveness,
            absenteeism: totalAbsenteeism,
            slaCompliance: totalSlaCompliance,
            npsScore: totalNpsScore,
            mttrHours: avgMttr,
            avgNpsRating: totalAvgNpsRating,
            contractScore: totalContractScore,
            turnover: (totalEffectiveness !== null && totalEffectiveness > 0) ? (((1.5) + ((assignments.length / (totalPostosCount > 0 ? totalPostosCount : 5)) * 100))) : 0,
            visitsScore: totalVisitsScore
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

export async function saveWorkRoutine(data: {
    id?: string;
    postoId: string;
    startTime: string;
    duration: string;
    endTime: string;
    location: string;
    activity: string;
}) {
    try {
        const { id, postoId, startTime, duration, endTime, location, activity } = data;

        const defaultRoutines = [
            { startTime: "11:00", duration: "00:15", endTime: "11:15", location: "DML", activity: "Organização do material utilizado" },
            { startTime: "11:15", duration: "00:45", endTime: "12:00", location: "6ª Andar", activity: "Limpeza dos banheiros masculino, hall de entrada, fraldário, recepção e 7 consultórios" },
            { startTime: "12:00", duration: "01:00", endTime: "13:00", location: "5ª Andar", activity: "Limpeza de banheiros, fraldário, hall de entrada, recepção e 9 consultórios" },
            { startTime: "13:00", duration: "03:00", endTime: "16:00", location: "4ª Andar", activity: "Limpeza de banheiros, estar médico, expurgo, posto de enfermagem, repai, sala de preparo, utilidades, e 3 salas com limpeza terminal no centro cirúrgico" },
            { startTime: "16:00", duration: "01:00", endTime: "17:00", location: "SUB SOLO", activity: "Limpeza da área limpa, da área suja, rouparia, utilidades, estoque, hall de entrada, banheiros e vestiários masculino e feminino, área de descanso" },
            { startTime: "17:00", duration: "01:00", endTime: "18:00", location: "Intervalo", activity: "Horário de almoço" },
            { startTime: "18:00", duration: "00:45", endTime: "18:45", location: "Copa", activity: "Limpeza e organização de utensílios" },
            { startTime: "18:45", duration: "04:15", endTime: "23:00", location: "DML", activity: "Organização do material utilizado e fechamento" }
        ];

        const existingCount = await prisma.workRoutine.count({
            where: { postoId }
        });

        if (existingCount === 0) {
            // Materializar mock
            const routinesToCreate = [...defaultRoutines];
            let mockIndexToReplace = -1;

            if (id && id.startsWith("mock-")) {
                mockIndexToReplace = parseInt(id.replace("mock-", ""), 10) - 1;
            }

            if (mockIndexToReplace >= 0 && mockIndexToReplace < routinesToCreate.length) {
                // Substituir o mock que foi editado
                routinesToCreate[mockIndexToReplace] = { startTime, duration, endTime, location, activity };
                
                // Inserir todas no banco
                for (const r of routinesToCreate) {
                    await prisma.workRoutine.create({
                        data: { postoId, ...r }
                    });
                }
            } else {
                // É um cadastro novo
                for (const r of routinesToCreate) {
                    await prisma.workRoutine.create({
                        data: { postoId, ...r }
                    });
                }
                // Adicionar o novo item
                await prisma.workRoutine.create({
                    data: { postoId, startTime, duration, endTime, location, activity }
                });
            }
        } else {
            // Banco já está materializado
            if (id && !id.startsWith("mock-")) {
                // Atualização
                await prisma.workRoutine.update({
                    where: { id },
                    data: { startTime, duration, endTime, location, activity }
                });
            } else {
                // Criação
                await prisma.workRoutine.create({
                    data: { postoId, startTime, duration, endTime, location, activity }
                });
            }
        }

        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar rotina:", error);
        return { success: false, error: "Erro ao salvar rotina." };
    }
}

export async function deleteWorkRoutine(id: string, postoId: string) {
    try {
        const defaultRoutines = [
            { startTime: "11:00", duration: "00:15", endTime: "11:15", location: "DML", activity: "Organização do material utilizado" },
            { startTime: "11:15", duration: "00:45", endTime: "12:00", location: "6ª Andar", activity: "Limpeza dos banheiros masculino, hall de entrada, fraldário, recepção e 7 consultórios" },
            { startTime: "12:00", duration: "01:00", endTime: "13:00", location: "5ª Andar", activity: "Limpeza de banheiros, fraldário, hall de entrada, recepção e 9 consultórios" },
            { startTime: "13:00", duration: "03:00", endTime: "16:00", location: "4ª Andar", activity: "Limpeza de banheiros, estar médico, expurgo, posto de enfermagem, repai, sala de preparo, utilidades, e 3 salas com limpeza terminal no centro cirúrgico" },
            { startTime: "16:00", duration: "01:00", endTime: "17:00", location: "SUB SOLO", activity: "Limpeza da área limpa, da área suja, rouparia, utilidades, estoque, hall de entrada, banheiros e vestiários masculino e feminino, área de descanso" },
            { startTime: "17:00", duration: "01:00", endTime: "18:00", location: "Intervalo", activity: "Horário de almoço" },
            { startTime: "18:00", duration: "00:45", endTime: "18:45", location: "Copa", activity: "Limpeza e organização de utensílios" },
            { startTime: "18:45", duration: "04:15", endTime: "23:00", location: "DML", activity: "Organização do material utilizado e fechamento" }
        ];

        const existingCount = await prisma.workRoutine.count({
            where: { postoId }
        });

        if (existingCount === 0) {
            // Materializar mock sem a deletada
            let mockIndexToRemove = -1;
            if (id.startsWith("mock-")) {
                mockIndexToRemove = parseInt(id.replace("mock-", ""), 10) - 1;
            }

            for (let i = 0; i < defaultRoutines.length; i++) {
                if (i === mockIndexToRemove) continue;
                await prisma.workRoutine.create({
                    data: { postoId, ...defaultRoutines[i] }
                });
            }
        } else {
            if (!id.startsWith("mock-")) {
                await prisma.workRoutine.delete({
                    where: { id }
                });
            }
        }

        return { success: true };
    } catch (error) {
        console.error("Erro ao deletar rotina:", error);
        return { success: false, error: "Erro ao deletar rotina." };
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

export async function getConsolidatedPerformanceData(year: number, month: number) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'GESTOR')) {
            throw new Error("Unauthorized");
        }

        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

        // Fetch all clients
        const clients = await prisma.client.findMany({
            where: { monitorInOperations: true },
            include: {
                company: true,
                postos: {
                    include: {
                        assignments: true,
                        role: true
                    }
                },
                visits: {
                    orderBy: { visitDate: "desc" }
                },
                npsResponses: {
                    where: {
                        createdAt: {
                            gte: startOfMonth,
                            lte: endOfMonth
                        }
                    },
                    include: {
                        answers: {
                            include: {
                                question: true
                            }
                        }
                    }
                },
                slaConfigItems: {
                    include: {
                        monthlyValues: {
                            where: {
                                year,
                                month
                            }
                        }
                    }
                }
            }
        });

        // Fetch attendances for that month
        const attendances = await prisma.attendance.findMany({
            where: {
                date: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            },
            include: {
                posto: true
            }
        });

        // Fetch requests for that month
        const requests = await prisma.request.findMany({
            where: {
                createdAt: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            },
            include: {
                requester: { select: { id: true, name: true, clientIds: true } },
                employee: {
                    include: {
                        assignments: {
                            include: {
                                posto: true
                            }
                        }
                    }
                },
                comments: {
                    include: {
                        user: { select: { name: true, role: true } }
                    },
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Auto-correção (Self-healing): popular o clientId em registros novos ou históricos sem ele
        const nullClientRequests = requests.filter((r: any) => !r.clientId);
        if (nullClientRequests.length > 0) {
            for (const r of nullClientRequests) {
                const matchedClient = clients.find((c: any) => 
                    r.requester?.clientIds?.includes(c.id) ||
                    r.employee?.assignments?.some((a: any) => a.posto?.clientId === c.id)
                );
                if (matchedClient) {
                    await prisma.request.update({
                        where: { id: r.id },
                        data: { clientId: matchedClient.id }
                    });
                    r.clientId = matchedClient.id; // atualiza a referência local
                }
            }
        }

        const daysInMonth: Date[] = [];
        const today = new Date();
        const startOfThisMonth = new Date(year, month, 1);
        const endOfThisMonth = new Date(year, month + 1, 0);
        const maxDate = (today.getFullYear() === year && today.getMonth() === month) ? today : endOfThisMonth;

        for (let d = new Date(startOfThisMonth); d <= maxDate; d.setDate(d.getDate() + 1)) {
            daysInMonth.push(new Date(d));
        }

        // Criar mapa de attendances para busca O(1)
        const attendanceMap = new Map<string, any>();
        attendances.forEach((att: any) => {
            if (att.postoId && att.date) {
                const dateStr = new Date(att.date).toISOString().split("T")[0];
                attendanceMap.set(`${att.postoId}-${dateStr}`, att);
            }
        });

        // 1. Calculate faturamento and postos/vagas for each client
        const clientData = clients.map(client => {
            const billing = client.postos.reduce((sum: number, p: any) => sum + (p.billingValue || 0), 0);
            const totalSlots = client.postos.length;
            const vacantSlots = client.postos.filter((p: any) => {
                const hasActiveAssignment = p.assignments.some((a: any) => !a.endDate || new Date(a.endDate) > new Date());
                return !hasActiveAssignment;
            }).length;
            const filledSlots = totalSlots - vacantSlots;

            // Filter vacant postos and compute details
            const vacantPostosList = client.postos.filter((p: any) => {
                const hasActiveAssignment = p.assignments.some((a: any) => !a.endDate || new Date(a.endDate) > new Date());
                return !hasActiveAssignment;
            });

            const vacantPostosDetails = vacantPostosList.map((p: any) => {
                const endedAssignments = p.assignments.filter((a: any) => a.endDate);
                let vacantSinceDateStr: string;
                let isNeverOccupied = false;

                if (endedAssignments.length > 0) {
                    const sorted = [...endedAssignments].sort((a: any, b: any) => 
                        new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
                    );
                    vacantSinceDateStr = new Date(sorted[0].endDate).toISOString();
                } else {
                    vacantSinceDateStr = new Date(p.createdAt).toISOString();
                    isNeverOccupied = true;
                }

                // Compute days
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const vacantDateClean = new Date(vacantSinceDateStr);
                vacantDateClean.setHours(0, 0, 0, 0);

                const diffTime = Math.abs(today.getTime() - vacantDateClean.getTime());
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                return {
                    id: p.id,
                    role: p.role?.name || "Posto",
                    schedule: p.schedule,
                    startTime: p.startTime,
                    endTime: p.endTime,
                    billingValue: p.billingValue,
                    vacantSince: vacantSinceDateStr,
                    diffDays,
                    isNeverOccupied
                };
            });

            let adminTotalShifts = 0;
            let adminVacantShifts = 0;

            daysInMonth.forEach((dayDate: Date) => {
                const dayDateStr = dayDate.toISOString().split("T")[0];
                const targetDate = new Date(dayDateStr + "T00:00:00Z");

                client.postos.forEach((posto: any) => {
                    const assignment = posto.assignments.find((a: any) => {
                        const start = new Date(a.startDate);
                        const end = a.endDate ? new Date(a.endDate) : null;
                        return start <= targetDate && (!end || end >= targetDate);
                    });

                    let shouldWork = false;
                    if (!assignment) {
                        const dayOfWeek = targetDate.getDay();
                        const normSchedule = posto.schedule.replace(/\s+/g, '').toLowerCase();
                        shouldWork = true;
                        if (normSchedule.includes('segasex') || normSchedule.includes('mondaytofriday')) {
                            if (dayOfWeek === 0 || dayOfWeek === 6) shouldWork = false;
                        } else if (normSchedule.includes('segasab') || normSchedule.includes('mondaytosaturday')) {
                            if (dayOfWeek === 0) shouldWork = false;
                        }
                    } else {
                        const roster = generateRoster(posto.schedule, new Date(assignment.startDate), [targetDate]);
                        shouldWork = roster[0]?.status === 'Trabalho';
                    }

                    if (shouldWork) {
                        adminTotalShifts++;

                        const att = attendanceMap.get(`${posto.id}-${dayDateStr}`);

                        if (att) {
                            if (att.status === "FALTA") {
                                if (!att.coveredById && att.coverageType !== "DIARISTA" && att.coverageType !== "RESERVA_TECNICA") {
                                    adminVacantShifts++;
                                }
                            }
                        } else {
                            const todayStr = today.toISOString().split("T")[0];
                            const isPastDay = targetDate.getTime() < new Date(todayStr + "T00:00:00Z").getTime();
                            let isEndedToday = false;

                            if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === dayDate.getDate()) {
                                const [endHour, endMinute] = posto.endTime.split(":").map(Number);
                                const shiftEnd = new Date(dayDate);
                                shiftEnd.setHours(endHour, endMinute, 0, 0);
                                const nowInBrazil = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
                                if (nowInBrazil > shiftEnd) {
                                    isEndedToday = true;
                                }
                            }

                            if (isPastDay || isEndedToday) {
                                adminVacantShifts++;
                            }
                        }
                    }
                });
            });

            const clientEffectiveness = adminTotalShifts > 0 ? ((adminTotalShifts - adminVacantShifts) / adminTotalShifts) * 100 : 100;

            // Filter requests for this client
            const clientReqs = requests.filter((r: any) => 
                r.requester?.clientIds?.includes(client.id) ||
                r.employee?.assignments?.some((a: any) => a.posto?.clientId === client.id)
            );
            const resolved = clientReqs.filter((r: any) => r.status === "CONCLUIDO" || r.status === "REJEITADO");
            const totalSlaOnTime = resolved.filter((r: any) => r.updatedAt && r.dueDate && r.updatedAt <= r.dueDate).length;
            const clientSlaCompliance = resolved.length > 0 ? (totalSlaOnTime / resolved.length) * 100 : 100;

            // Calculate NPS for this client in the month
            const clientMonthNps = client.npsResponses;
            let avgNpsRating = 10;
            if (clientMonthNps.length > 0) {
                const resolvedScores = clientMonthNps.map((resp: any) => {
                    let totalScore = 0;
                    let totalWeight = 0;
                    resp.answers.forEach((ans: any) => {
                        const w = ans.question?.weight || 1.0;
                        totalScore += ans.score * w;
                        totalWeight += w;
                    });
                    return totalWeight > 0 ? totalScore / totalWeight : 10;
                });
                avgNpsRating = resolvedScores.reduce((sum: number, s: number) => sum + s, 0) / resolvedScores.length;
            }

            // Calculate monthly SLA score
            let slaScoreSum = 0;
            let slaWeightSum = 0;
            if (client.slaConfigItems.length > 0) {
                client.slaConfigItems.forEach((config: any) => {
                    let val = 100;
                    if (config.metricType === "EFETIVIDADE") {
                        val = clientEffectiveness;
                    } else if (config.metricType === "SLA_CHAMADOS") {
                        val = clientSlaCompliance;
                    } else if (config.metricType === "NPS") {
                        val = avgNpsRating * 10;
                    } else if (config.metricType === "RECLAMACOES") {
                        const complaints = clientReqs.filter((r: any) => r.type !== "MOVIMENTACAO" && r.type !== "UNIFORME").length;
                        val = Math.max(0, 100 - complaints * 20);
                    } else if (config.metricType === "MANUAL") {
                        const found = config.monthlyValues[0];
                        val = found ? found.value : config.targetValue;
                    }
                    slaScoreSum += val * config.weight;
                    slaWeightSum += config.weight;
                });
            } else {
                slaScoreSum += clientEffectiveness * 0.5 * 100 + clientSlaCompliance * 0.25 * 100 + (avgNpsRating * 10) * 0.25 * 100;
                slaWeightSum += 100;
            }
            const finalSla = slaWeightSum > 0 ? slaScoreSum / slaWeightSum : 100;

            return {
                id: client.id,
                name: client.name,
                companyName: client.company?.name || "Grupo",
                billing,
                totalSlots,
                filledSlots,
                vacantSlots,
                effectiveness: clientEffectiveness,
                slaCompliance: finalSla,
                npsRating: avgNpsRating,
                npsCount: clientMonthNps.length,
                visits: client.visits,
                vacantPostosDetails,
                recentRequests: clientReqs.map((r: any) => ({
                    id: r.id,
                    type: r.type,
                    status: r.status,
                    description: r.description,
                    createdAt: r.createdAt.toISOString(),
                    dueDate: r.dueDate.toISOString(),
                    employeeName: r.employee?.name || null,
                    requesterName: r.requester?.name || "Cliente"
                }))
            };
        });

        // 2. Compute ABC Curve Classification
        const sortedByBilling = [...clientData].sort((a: any, b: any) => b.billing - a.billing);
        const totalBilling = sortedByBilling.reduce((sum: number, c: any) => sum + c.billing, 0);

        let cumulative = 0;
        const abcMap = new Map<string, "A" | "B" | "C" >();
        sortedByBilling.forEach((c: any) => {
            cumulative += c.billing;
            const ratio = totalBilling > 0 ? cumulative / totalBilling : 0;
            if (ratio <= 0.70 || abcMap.size === 0) {
                abcMap.set(c.id, "A");
            } else if (ratio <= 0.90) {
                abcMap.set(c.id, "B");
            } else {
                abcMap.set(c.id, "C");
            }
        });

        // 3. Compute Visits Compliance Status for each client
        const now = new Date();
        const clientsWithABCAndVisits = clientData.map((c: any) => {
            const classification = abcMap.get(c.id) || "C";
            
            // Get last visits per role
            const supervisorVisit = c.visits.find((v: any) => v.visitorRole === "SUPERVISOR");
            const gerenteVisit = c.visits.find((v: any) => v.visitorRole === "GERENTE");
            const diretorVisit = c.visits.find((v: any) => v.visitorRole === "DIRETOR");

            const getDaysDiff = (date?: Date) => {
                if (!date) return 9999;
                const diffMs = now.getTime() - new Date(date).getTime();
                return Math.floor(diffMs / (1000 * 60 * 60 * 24));
            };

            const supDays = getDaysDiff(supervisorVisit?.visitDate);
            const gerDays = getDaysDiff(gerenteVisit?.visitDate);
            const dirDays = getDaysDiff(diretorVisit?.visitDate);

            // Set limits based on classification
            const limits = {
                A: { sup: 7, ger: 30, dir: 90 },
                B: { sup: 15, ger: 45, dir: 120 },
                C: { sup: 30, ger: 90, dir: 180 }
            }[classification];

            const getStatus = (days: number, limit: number) => {
                if (days <= limit) return "OK";
                if (days <= limit * 1.5) return "WARNING";
                return "CRITICAL";
            };

            return {
                ...c,
                class: classification,
                visitCompliance: {
                    supervisor: {
                        lastVisit: supervisorVisit ? supervisorVisit.visitDate : null,
                        days: supDays,
                        status: getStatus(supDays, limits.sup)
                      },
                      gerente: {
                          lastVisit: gerenteVisit ? gerenteVisit.visitDate : null,
                          days: gerDays,
                          status: getStatus(gerDays, limits.ger)
                      },
                      diretor: {
                          lastVisit: diretorVisit ? diretorVisit.visitDate : null,
                          days: dirDays,
                          status: getStatus(dirDays, limits.dir)
                      }
                }
            };
        });

        // 4. Calculate Group Consolidated KPIs
        const totalContracts = clientsWithABCAndVisits.length;
        const totalSlotsCombined = clientsWithABCAndVisits.reduce((sum: number, c: any) => sum + c.totalSlots, 0);
        const vacantSlotsCombined = clientsWithABCAndVisits.reduce((sum: number, c: any) => sum + c.vacantSlots, 0);
        const activeHeadcount = totalSlotsCombined - vacantSlotsCombined;

        const avgSlaCombined = totalContracts > 0
            ? clientsWithABCAndVisits.reduce((sum: number, c: any) => sum + c.slaCompliance, 0) / totalContracts
            : 100;

        const avgEffectivenessCombined = totalContracts > 0
            ? clientsWithABCAndVisits.reduce((sum: number, c: any) => sum + c.effectiveness, 0) / totalContracts
            : 100;

        // Aggregated NPS score for all reviews in this month
        let groupNpsScore = 100;
        let groupNpsCount = 0;
        let totalPromoters = 0;
        let totalDetractors = 0;
        clients.forEach((c: any) => {
            c.npsResponses.forEach((resp: any) => {
                groupNpsCount++;
                let totalScore = 0;
                let totalWeight = 0;
                resp.answers.forEach((ans: any) => {
                    const w = ans.question?.weight || 1.0;
                    totalScore += ans.score * w;
                    totalWeight += w;
                });
                const finalRating = totalWeight > 0 ? totalScore / totalWeight : 10;
                if (finalRating >= 9) totalPromoters++;
                else if (finalRating <= 6) totalDetractors++;
            });
        });
        if (groupNpsCount > 0) {
            groupNpsScore = ((totalPromoters - totalDetractors) / groupNpsCount) * 100;
        }

        // Carregar colaboradores para atribuição
        const allEmployees = await prisma.employee.findMany({
            select: { id: true, name: true }
        });

        return {
            success: true,
            totalContracts,
            totalBilling,
            activeHeadcount,
            vacantSlotsCombined,
            avgSlaCombined,
            avgEffectivenessCombined,
            groupNpsScore,
            groupNpsCount,
            clients: clientsWithABCAndVisits,
            allEmployees,
            allRequests: requests.map((r: any) => {
                const clientObj = clients.find((c: any) => c.id === r.clientId) || 
                                  clients.find((c: any) => 
                                      r.requester?.clientIds?.includes(c.id) ||
                                      r.employee?.assignments?.some((a: any) => a.posto?.clientId === c.id)
                                  );
                const clientName = clientObj?.name || "Geral";
                const clientId = clientObj?.id || null;

                return {
                    id: r.id,
                    type: r.type,
                    status: r.status,
                    description: r.description,
                    createdAt: r.createdAt.toISOString(),
                    dueDate: r.dueDate.toISOString(),
                    employeeId: r.employeeId || null,
                    employeeName: r.employee?.name || null,
                    requesterName: r.requester?.name || "Cliente",
                    clientId,
                    clientName
                };
            })
        };

    } catch (error) {
        console.error("Erro ao carregar dados consolidados de performance:", error);
        return { success: false, error: "Erro de servidor ao computar dados." };
    }
}

export async function createContractVisit(data: {
    clientId: string;
    visitorRole: string;
    visitorName: string;
    visitDate: string;
    notes?: string;
    evidenceUrl?: string;
}) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'GESTOR')) {
            throw new Error("Unauthorized");
        }

        const visit = await prisma.contractVisit.create({
            data: {
                clientId: data.clientId,
                visitorRole: data.visitorRole,
                visitorName: data.visitorName,
                visitDate: new Date(data.visitDate),
                notes: data.notes || null,
                evidenceUrl: data.evidenceUrl || null
            }
        });

        revalidatePath("/admin/performance");
        return { success: true, visit };
    } catch (error) {
        console.error("Erro ao registrar visita de relacionamento:", error);
        return { success: false, error: "Erro ao registrar visita." };
    }
}

export async function updateContractVisit(visitId: string, data: {
    visitorRole?: string;
    visitorName?: string;
    visitDate?: string;
    notes?: string;
    evidenceUrl?: string;
}) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'GESTOR')) {
            throw new Error("Unauthorized");
        }

        const visit = await prisma.contractVisit.update({
            where: { id: visitId },
            data: {
                visitorRole: data.visitorRole,
                visitorName: data.visitorName,
                visitDate: data.visitDate ? new Date(data.visitDate) : undefined,
                notes: data.notes,
                evidenceUrl: data.evidenceUrl
            }
        });

        revalidatePath("/admin/performance");
        return { success: true, visit };
    } catch (error: any) {
        console.error("Erro ao atualizar visita:", error);
        return { success: false, error: error.message || "Erro ao atualizar visita." };
    }
}

export async function deleteContractVisit(visitId: string) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'GESTOR')) {
            throw new Error("Unauthorized");
        }

        await prisma.contractVisit.delete({
            where: { id: visitId }
        });

        revalidatePath("/admin/performance");
        return { success: true };
    } catch (error: any) {
        console.error("Erro ao excluir visita:", error);
        return { success: false, error: error.message || "Erro ao excluir visita." };
    }
}

export async function getAdminClientKpis(clientId: string, year: number) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'GESTOR')) {
            throw new Error("Unauthorized");
        }

        const clientRecord = await prisma.client.findUnique({
            where: { id: clientId },
            select: { contractTargetScore: true, name: true }
        });
        const contractTargetScore = clientRecord?.contractTargetScore ?? 90.0;

        const clientIds = [clientId];
        const startDate = new Date(year, 0, 1, 0, 0, 0);
        const endDate = new Date(year, 11, 31, 23, 59, 59);

        const [attendances, requests, npsResponses, npsQuestions, slaConfigs, assignments, totalPostosCount, visitRequirements, visits] = await Promise.all([
            prisma.attendance.findMany({
                where: {
                    posto: { clientId: { in: clientIds } },
                    date: { gte: startDate, lte: endDate }
                },
                orderBy: { date: "asc" }
            }),
            prisma.request.findMany({
                where: {
                    clientId: { in: clientIds },
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
                    },
                    comments: {
                        include: {
                            user: { select: { name: true, role: true } }
                        },
                        orderBy: { createdAt: 'asc' }
                    }
                },
                orderBy: { createdAt: "asc" }
            }),
            prisma.npsResponse.findMany({
                where: {
                    clientId: { in: clientIds },
                    createdAt: { gte: startDate, lte: endDate }
                },
                include: {
                    answers: {
                        include: {
                            question: true
                        }
                    }
                },
                orderBy: { createdAt: "desc" }
            }),
            prisma.npsQuestion.findMany({
                where: { clientId: { in: clientIds } },
                orderBy: { createdAt: "asc" }
            }),
            prisma.slaConfigItem.findMany({
                where: { clientId: { in: clientIds } },
                include: { monthlyValues: true, ranges: true },
                orderBy: { createdAt: "asc" }
            }),
            prisma.assignment.findMany({
                where: {
                    posto: { clientId: { in: clientIds } }
                },
                include: {
                    posto: { include: { role: true } },
                    employee: true
                },
                orderBy: { startDate: "asc" }
            }),
            prisma.posto.count({
                where: { clientId: { in: clientIds } }
            }),
            prisma.clientVisitRequirement.findMany({
                where: { clientId: { in: clientIds } }
            }),
            prisma.contractVisit.findMany({
                where: {
                    clientId: { in: clientIds },
                    visitDate: { gte: startDate, lte: endDate }
                }
            })
        ]);

        const adminPostos = await prisma.posto.findMany({
            where: { clientId: { in: clientIds } },
            include: {
                assignments: {
                    orderBy: { startDate: "desc" }
                }
            }
        });

        const clientRequests = requests.filter((r: any) => 
            r.clientId && clientIds.includes(r.clientId) && r.requester?.role === 'CLIENTE'
        );

        const mappedNpsResponses = npsResponses.map((resp: any) => {
            let totalScore = 0;
            let totalWeight = 0;
            resp.answers.forEach((ans: any) => {
                const w = ans.question?.weight || 1.0;
                totalScore += ans.score * w;
                totalWeight += w;
            });
            const resolvedScore = totalWeight > 0 ? totalScore / totalWeight : 10;
            return {
                ...resp,
                resolvedScore
            };
        });

        // Integração com o Checklist Fácil API Analytics
        let checklistFacilCounts = Array(12).fill(0);
        const apiKey = process.env.CHECKLIST_FACIL_API_KEY;
        const clientName = clientRecord?.name || '';
        if (apiKey && clientName) {
            try {
                const startDateStr = `${year}-01-01T00:00:00`;
                const endDateStr = `${year}-12-31T23:59:59`;
                const url = `https://api-analytics.checklistfacil.com.br/v1/evaluations?concludedAt=[gte]${startDateStr}&concludedAt=[lte]${endDateStr}&status=6&limit=10000`;
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Accept': 'application/json'
                    }
                });
                if (response.ok) {
                    const result = await response.json();
                    if (result && result.data && Array.isArray(result.data)) {
                        // Palavras irrelevantes para filtrar do nome do cliente
                        const stopwords = ['empresa', 'ltda', 'sa', 's.a.', 'de', 'do', 'da', 'e', 'o', 'a', 'os', 'as', 'hub', 'workforce'];
                        const searchTerms = clientName
                            .toLowerCase()
                            .split(/\s+/)
                            .filter(word => word.length > 2 && !stopwords.includes(word));

                        result.data.forEach((evaluation: any) => {
                            const unitName = String(evaluation.unitName || evaluation.unit?.name || evaluation.storeName || '').toLowerCase();
                            const checklistName = String(evaluation.checklistName || evaluation.checklist?.name || '').toLowerCase();
                            const userName = String(evaluation.userName || evaluation.user?.name || '').toLowerCase();
                            const evaluatorName = String(evaluation.evaluatorName || '').toLowerCase();

                            // Verifica se alguma das palavras-chave significativas do cliente (ex: 'penha') bate em qualquer campo textual
                            const isMatch = searchTerms.some(term => 
                                unitName.includes(term) || 
                                checklistName.includes(term) || 
                                userName.includes(term) ||
                                evaluatorName.includes(term)
                            );

                            if (isMatch) {
                                const conclDate = new Date(evaluation.concludedAt || evaluation.createdAt);
                                const mIdx = conclDate.getMonth();
                                if (mIdx >= 0 && mIdx < 12) {
                                    checklistFacilCounts[mIdx]++;
                                }
                            }
                        });
                    }
                }
            } catch (e) {
                console.error('Erro ao carregar checklists do Checklist Fácil:', e);
            }
        }

        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

        const monthlyData = monthNames.map((name: string, index: number) => {
            const isMockPeriod = year === 2026 && index !== 6;
            
            const monthVisits = isMockPeriod ? [] : visits.filter((v: any) => {
                const d = new Date(v.visitDate);
                return d.getMonth() === index && d.getFullYear() === year;
            });

            let visitAtingimentoSum = 0;
            let activeRolesCount = 0;

            if (visitRequirements.length > 0) {
                visitRequirements.forEach((req: any) => {
                    if (req.frequency > 0) {
                        activeRolesCount++;
                        const roleVisitsCount = monthVisits.filter((v: any) => v.visitorRole === req.visitorRole).length;
                        const atingimento = Math.min(100, (roleVisitsCount / req.frequency) * 100);
                        visitAtingimentoSum += atingimento;
                    }
                });
            }

            const visitsScore = activeRolesCount > 0 ? (visitAtingimentoSum / activeRolesCount) : null;
            let adminTotalShifts = 0;
            let adminVacantShifts = 0;
            let adminTotalAbsences = 0;

            if (!isMockPeriod) {
                const daysInMonth: Date[] = [];
                const startOfThisMonth = new Date(year, index, 1);
                const endOfThisMonth = new Date(year, index + 1, 0);
                const today = new Date();
                const maxDate = (today.getFullYear() === year && today.getMonth() === index) ? today : endOfThisMonth;

                for (let d = new Date(startOfThisMonth); d <= maxDate; d.setDate(d.getDate() + 1)) {
                    daysInMonth.push(new Date(d));
                }

                daysInMonth.forEach((dayDate: Date) => {
                    const dayDateStr = dayDate.toISOString().split("T")[0];
                    const targetDate = new Date(dayDateStr + "T00:00:00Z");

                    adminPostos.forEach((posto: any) => {
                        const assignment = posto.assignments.find((a: any) => {
                            const start = new Date(a.startDate);
                            const end = a.endDate ? new Date(a.endDate) : null;
                            return start <= targetDate && (!end || end >= targetDate);
                        });

                        let shouldWork = false;
                        if (!assignment) {
                            const dayOfWeek = targetDate.getDay();
                            const normSchedule = posto.schedule.replace(/\s+/g, '').toLowerCase();
                            shouldWork = true;
                            if (normSchedule.includes('segasex') || normSchedule.includes('mondaytofriday')) {
                                if (dayOfWeek === 0 || dayOfWeek === 6) shouldWork = false;
                            } else if (normSchedule.includes('segasab') || normSchedule.includes('mondaytosaturday')) {
                                if (dayOfWeek === 0) shouldWork = false;
                            }
                        } else {
                            const roster = generateRoster(posto.schedule, new Date(assignment.startDate), [targetDate]);
                            shouldWork = roster[0]?.status === 'Trabalho';
                        }

                        if (shouldWork) {
                            adminTotalShifts++;

                            const att = attendances.find((a: any) =>
                                a.postoId === posto.id &&
                                new Date(a.date).toISOString().split("T")[0] === dayDateStr
                            );

                            if (att) {
                                if (att.status === "FALTA") {
                                    adminTotalAbsences++;
                                    if (!att.coveredById && att.coverageType !== "DIARISTA" && att.coverageType !== "RESERVA_TECNICA") {
                                        adminVacantShifts++;
                                    }
                                }
                            } else {
                                const todayStr = today.toISOString().split("T")[0];
                                const isPastDay = targetDate.getTime() < new Date(todayStr + "T00:00:00Z").getTime();
                                let isEndedToday = false;

                                if (today.getFullYear() === year && today.getMonth() === index && today.getDate() === dayDate.getDate()) {
                                    const [endHour, endMinute] = posto.endTime.split(":").map(Number);
                                    const shiftEnd = new Date(dayDate);
                                    shiftEnd.setHours(endHour, endMinute, 0, 0);
                                    const nowInBrazil = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
                                    if (nowInBrazil > shiftEnd) {
                                        isEndedToday = true;
                                    }
                                }

                                if (isPastDay || isEndedToday) {
                                    adminVacantShifts++;
                                    adminTotalAbsences++;
                                }
                            }
                        }
                    });
                });
            }

            const totalShifts = adminTotalShifts;
            const vacantShifts = adminVacantShifts;
            const totalAbsences = adminTotalAbsences;
            const effectiveness = totalShifts > 0 ? ((totalShifts - vacantShifts) / totalShifts) * 100 : null;
            const absenteeism = totalShifts > 0 ? (totalAbsences / totalShifts) * 100 : null;
            let contractScore: number | null = null;

            const monthRequests = isMockPeriod ? [] : clientRequests.filter((r: any) => new Date(r.createdAt).getMonth() === index);
            const resolved = monthRequests.filter((r: any) => r.status === "CONCLUIDO" || r.status === "REJEITADO");
            const totalSlaOnTime = resolved.filter((r: any) => r.updatedAt && r.dueDate && r.updatedAt <= r.dueDate).length;
            const slaCompliance = resolved.length > 0 ? (totalSlaOnTime / resolved.length) * 100 : null;

            const monthNps = isMockPeriod ? [] : mappedNpsResponses.filter((n: any) => new Date(n.createdAt).getMonth() === index);
            const promoters = monthNps.filter((n: any) => n.resolvedScore >= 9).length;
            const detractors = monthNps.filter((n: any) => n.resolvedScore <= 6).length;
            const npsScore = monthNps.length > 0 ? ((promoters - detractors) / monthNps.length) * 100 : null;

            const avgNpsRating = monthNps.length > 0
                ? monthNps.reduce((sum: number, n: any) => sum + n.resolvedScore, 0) / monthNps.length
                : null;

            let slaScoreSum = 0;
            let slaWeightSum = 0;

            const clientConfigs = slaConfigs.filter((cfg: any) => clientIds.includes(cfg.clientId));

            if (effectiveness === null || effectiveness === undefined) {
                contractScore = null;
            } else if (clientConfigs.length > 0) {
                clientConfigs.forEach((config: any) => {
                    let metricValue: number | null = null;
                    if (config.metricType === "EFETIVIDADE") {
                        metricValue = effectiveness;
                    } else if (config.metricType === "SLA_CHAMADOS") {
                        metricValue = slaCompliance;
                    } else if (config.metricType === "NPS") {
                        metricValue = avgNpsRating !== null ? avgNpsRating * 10 : null;
                    } else if (config.metricType === "RECLAMACOES") {
                        const complaintsCount = monthRequests.filter((r: any) => r.type !== "MOVIMENTACAO" && r.type !== "UNIFORME").length;
                        metricValue = complaintsCount;
                    } else if (config.metricType === "MANUAL") {
                        const foundManual = config.monthlyValues.find((v: any) => v.month === index && v.year === year);
                        metricValue = foundManual ? foundManual.value : config.targetValue;
                    } else if (config.metricType === "TURNOVER") {
                        metricValue = turnover;
                    } else if (config.metricType === "REPOSICAO") {
                        metricValue = avgRepositionDays;
                    } else if (config.metricType === "VISITAS") {
                        metricValue = visitsScore;
                    }

                    if (metricValue !== null && config.ranges && config.ranges.length > 0) {
                        metricValue = calculateAtingimentoVal(metricValue, config.ranges);
                    }

                    if (metricValue !== null && metricValue !== undefined) {
                        slaScoreSum += metricValue * config.weight;
                        slaWeightSum += config.weight;
                    }
                });
            } else {
                let weightSum = 0;
                if (effectiveness !== null) {
                    slaScoreSum += effectiveness * 0.5 * 100;
                    weightSum += 50;
                }
                if (slaCompliance !== null) {
                    slaScoreSum += slaCompliance * 0.25 * 100;
                    weightSum += 25;
                }
                if (avgNpsRating !== null) {
                    slaScoreSum += (avgNpsRating * 10) * 0.25 * 100;
                    weightSum += 25;
                }
                slaWeightSum = weightSum;
            }

            const calculatedScore = slaWeightSum > 0 ? (slaScoreSum / slaWeightSum) / 10 : null;
            if (effectiveness !== null && effectiveness !== undefined) {
                contractScore = calculatedScore;
            }

            const monthSubstitutions = assignments.filter((a: any) => a.endDate && new Date(a.endDate).getUTCMonth() === index).length;
            const activeStaff = totalPostosCount > 0 ? totalPostosCount : 5;
            const turnover = activeStaff > 0 ? (monthSubstitutions / activeStaff) * 100 : 0;

            // SLA de Reposição (Média de dias decorridos para reposição)
            const assignmentsByPosto: { [key: string]: any[] } = {};
            assignments.forEach((a: any) => {
                if (!assignmentsByPosto[a.postoId]) {
                    assignmentsByPosto[a.postoId] = [];
                }
                assignmentsByPosto[a.postoId].push(a);
            });

            const repositionTransitions: any[] = [];
            Object.keys(assignmentsByPosto).forEach((postoId) => {
                const list = assignmentsByPosto[postoId].sort((x, y) => new Date(x.startDate).getTime() - new Date(y.startDate).getTime());
                for (let i = 0; i < list.length - 1; i++) {
                    const current = list[i];
                    const next = list[i + 1];
                    if (current.endDate) {
                        const exitDate = new Date(current.endDate);
                        const entryDate = new Date(next.startDate);
                        if (entryDate >= exitDate) {
                            const diffTime = Math.abs(entryDate.getTime() - exitDate.getTime());
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            repositionTransitions.push({
                                entryDate,
                                diffDays
                            });
                        }
                    }
                }
            });

            const monthRepositionTransitions = repositionTransitions.filter(t => 
                t.entryDate && !isNaN(new Date(t.entryDate).getTime()) &&
                new Date(t.entryDate).getMonth() <= index && 
                new Date(t.entryDate).getFullYear() === year
            );
            const totalRepositionDays = monthRepositionTransitions.reduce((sum, t) => sum + t.diffDays, 0);
            const avgRepositionDays = monthRepositionTransitions.length > 0 ? parseFloat((totalRepositionDays / monthRepositionTransitions.length).toFixed(1)) : null;

            const complaints = monthRequests.filter((r: any) => r.description?.toLowerCase().includes("reclam") || r.description?.toLowerCase().includes("queixa"));
            const complaintsRate = monthRequests.length > 0 ? (complaints.length / monthRequests.length) * 100 : 0;

            return {
                monthIndex: index,
                name,
                effectiveness,
                absenteeism,
                slaCompliance,
                npsScore,
                npsCount: monthNps.length,
                avgNpsRating,
                contractScore,
                turnover,
                complaintsRate,
                avgRepositionDays,
                visitsScore
            };
        });

        const resolved = clientRequests.filter((r: any) => r.status === "CONCLUIDO" || r.status === "REJEITADO");
        const totalMonthNps = mappedNpsResponses;
        const validEffectiveness = monthlyData.filter(m => m.effectiveness !== null && m.effectiveness !== undefined);
        const totalEffectiveness = validEffectiveness.length > 0
            ? validEffectiveness.reduce((sum, m) => sum + m.effectiveness!, 0) / validEffectiveness.length
            : null;

        const totalAbsenteeism = null;

        const validSla = monthlyData.filter(m => m.slaCompliance !== null && m.slaCompliance !== undefined);
        const totalSlaCompliance = validSla.length > 0
            ? validSla.reduce((sum, m) => sum + m.slaCompliance!, 0) / validSla.length
            : null;

        const validNps = monthlyData.filter(m => m.avgNpsRating !== null && m.avgNpsRating !== undefined);
        const totalAvgNpsRating = validNps.length > 0
            ? validNps.reduce((sum, m) => sum + m.avgNpsRating!, 0) / validNps.length
            : null;

        const totalPromoters = 0;
        const totalDetractors = 0;
        const totalNpsScore = null;

        let summaryWeightSum = 0;
        let summaryScoreSum = 0;

        const clientConfigs = slaConfigs.filter((cfg: any) => clientIds.includes(cfg.clientId));

        if (clientConfigs.length > 0) {
            clientConfigs.forEach((config: any) => {
                let metricValue: number | null = 100;
                if (config.metricType === "EFETIVIDADE") {
                    metricValue = totalEffectiveness;
                } else if (config.metricType === "SLA_CHAMADOS") {
                    metricValue = totalSlaCompliance;
                } else if (config.metricType === "NPS") {
                    metricValue = totalAvgNpsRating !== null ? totalAvgNpsRating * 10 : null;
                } else if (config.metricType === "RECLAMACOES") {
                    const complaintsCount = clientRequests.filter((r: any) => r.type !== "MOVIMENTACAO" && r.type !== "UNIFORME").length;
                    metricValue = complaintsCount;
                } else if (config.metricType === "MANUAL") {
                    const manualVals = config.monthlyValues.filter((v: any) => v.year === year);
                    metricValue = manualVals.length > 0
                        ? manualVals.reduce((sum: number, v: any) => sum + v.value, 0) / manualVals.length
                        : config.targetValue;
                } else if (config.metricType === "TURNOVER") {
                    const validTurnover = monthlyData.filter(m => m.turnover !== null && m.turnover !== undefined);
                    metricValue = validTurnover.length > 0 ? validTurnover.reduce((sum, m) => sum + m.turnover, 0) / validTurnover.length : null;
                } else if (config.metricType === "REPOSICAO") {
                    const validRep = monthlyData.filter(m => m.avgRepositionDays !== null && m.avgRepositionDays !== undefined);
                    metricValue = validRep.length > 0 ? validRep.reduce((sum, m) => sum + m.avgRepositionDays!, 0) / validRep.length : null;
                }
                if (metricValue !== null && config.ranges && config.ranges.length > 0) {
                    metricValue = calculateAtingimentoVal(metricValue, config.ranges);
                }

                if (metricValue !== null && metricValue !== undefined) {
                    summaryScoreSum += metricValue * config.weight;
                    summaryWeightSum += config.weight;
                }
            });
        } else {
            let weightSum = 0;
            if (totalEffectiveness !== null) {
                summaryScoreSum += totalEffectiveness * 0.5 * 100;
                weightSum += 50;
            }
            if (totalSlaCompliance !== null) {
                summaryScoreSum += totalSlaCompliance * 0.25 * 100;
                weightSum += 25;
            }
            if (totalAvgNpsRating !== null) {
                summaryScoreSum += (totalAvgNpsRating * 10) * 0.25 * 100;
                weightSum += 25;
            }
            summaryWeightSum = weightSum;
        }

        const totalContractScore = summaryWeightSum > 0 ? (summaryScoreSum / summaryWeightSum) / 10 : 10;

        const activeQuestions = npsQuestions.length > 0 ? npsQuestions : [
            { id: "def-1", text: "Como você avalia a pontualidade e assiduidade dos colaboradores?" },
            { id: "def-2", text: "Como você avalia a qualidade da execução dos serviços e rotinas?" },
            { id: "def-3", text: "Como você avalia o atendimento da nossa mesa de operações?" },
            { id: "def-4", text: "Como você avalia a postura e apresentação pessoal da equipe?" },
            { id: "def-5", text: "Qual a probabilidade de recomendar nossos serviços a um parceiro?" }
        ];

        const npsEvolution = activeQuestions.map((q: any) => {
            const monthlyScores = monthNames.map((_, index: number) => {
                const monthResponses = mappedNpsResponses.filter((n: any) => new Date(n.createdAt).getUTCMonth() === index);
                const answers = monthResponses.flatMap((n: any) => n.answers.filter((a: any) => a.questionId === q.id));
                if (answers.length > 0) {
                    return parseFloat((answers.reduce((sum: number, a: any) => sum + a.score, 0) / answers.length).toFixed(1));
                }
                return null;
            });
            return {
                id: q.id,
                text: q.text,
                monthlyScores
            };
        });

        const resolvedWithTimes = resolved.filter((r: any) => r.createdAt && r.updatedAt);
        let totalHours = 0;
        resolvedWithTimes.forEach((r: any) => {
            const diffMs = r.updatedAt.getTime() - r.createdAt.getTime();
            totalHours += diffMs / (1000 * 60 * 60);
        });
        const avgMttr = resolvedWithTimes.length > 0 ? totalHours / resolvedWithTimes.length : 0;

        const validVisits = monthlyData.filter(m => m.visitsScore !== null && m.visitsScore !== undefined);
        const totalVisitsScore = validVisits.length > 0
            ? validVisits.reduce((sum, m) => sum + m.visitsScore!, 0) / validVisits.length
            : null;

        return {
            success: true,
            contractTargetScore,
            monthlyData,
            npsEvolution,
            slaConfigs,
            summary: {
                effectiveness: totalEffectiveness,
                absenteeism: totalAbsenteeism,
                slaCompliance: totalSlaCompliance,
                npsScore: totalNpsScore,
                mttrHours: avgMttr,
                avgNpsRating: totalAvgNpsRating,
                contractScore: totalContractScore,
                turnover: (totalEffectiveness !== null && totalEffectiveness > 0) ? (((1.5) + ((assignments.length / (totalPostosCount > 0 ? totalPostosCount : 5)) * 100))) : 0,
                visitsScore: totalVisitsScore
            }
        };

    } catch (e) {
        console.error("Erro no getAdminClientKpis:", e);
        return { success: false, error: "Erro de servidor ao buscar KPIs do cliente." };
    }
}

export async function updatePostoBilling(postoId: string, billingValue: number) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'GESTOR')) {
            throw new Error("Unauthorized");
        }

        const posto = await prisma.posto.update({
            where: { id: postoId },
            data: { billingValue }
        });

        revalidatePath("/admin/performance");
        return { success: true, posto };
    } catch (e) {
        console.error("Erro ao atualizar faturamento do posto:", e);
        return { success: false, error: "Erro de servidor ao atualizar faturamento." };
    }
}

export async function upsertSlaConfigItem(data: {
    id?: string;
    clientId: string;
    name: string;
    metricType: string;
    weight: number;
    targetValue: number;
    ranges?: { minVal: number; maxVal: number | null; resultVal: number; }[];
}) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'GESTOR')) {
            throw new Error("Unauthorized");
        }

        let item;
        if (data.id) {
            // Usar transação para apagar ranges antigos e criar os novos no update
            item = await prisma.$transaction(async (tx) => {
                const updated = await tx.slaConfigItem.update({
                    where: { id: data.id },
                    data: {
                        name: data.name,
                        metricType: data.metricType,
                        weight: data.weight,
                        targetValue: data.targetValue
                    }
                });
                
                await tx.slaRange.deleteMany({
                    where: { slaConfigItemId: data.id }
                });

                if (data.ranges && data.ranges.length > 0) {
                    await tx.slaRange.createMany({
                        data: data.ranges.map(r => ({
                            slaConfigItemId: data.id!,
                            minVal: r.minVal,
                            maxVal: r.maxVal,
                            resultVal: r.resultVal
                        }))
                    });
                }
                return updated;
            });
        } else {
            item = await prisma.slaConfigItem.create({
                data: {
                    clientId: data.clientId,
                    name: data.name,
                    metricType: data.metricType,
                    weight: data.weight,
                    targetValue: data.targetValue,
                    ranges: data.ranges ? {
                        create: data.ranges.map(r => ({
                            minVal: r.minVal,
                            maxVal: r.maxVal,
                            resultVal: r.resultVal
                        }))
                    } : undefined
                }
            });
        }

        revalidatePath("/admin/performance");
        return { success: true, item };
    } catch (e) {
        console.error("Erro ao salvar configuração do SLA:", e);
        return { success: false, error: "Erro de servidor ao salvar configuração de SLA." };
    }
}

export async function deleteSlaConfigItem(id: string) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'GESTOR')) {
            throw new Error("Unauthorized");
        }

        await prisma.slaConfigItem.delete({
            where: { id }
        });

        revalidatePath("/admin/performance");
        return { success: true };
    } catch (e) {
        console.error("Erro ao deletar configuração de SLA:", e);
        return { success: false, error: "Erro de servidor ao deletar configuração." };
    }
}

export async function updateSlaMonthlyValue(configItemId: string, month: number, year: number, value: number) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'GESTOR')) {
            throw new Error("Unauthorized");
        }

        const mValue = await prisma.slaMonthlyValue.upsert({
            where: {
                slaConfigItemId_month_year: {
                    slaConfigItemId: configItemId,
                    month,
                    year
                }
            },
            update: { value },
            create: {
                slaConfigItemId: configItemId,
                month,
                year,
                value
            }
        });

        revalidatePath("/admin/performance");
        return { success: true, mValue };
    } catch (e) {
        console.error("Erro ao salvar valor mensal de SLA:", e);
        return { success: false, error: "Erro de servidor ao salvar valor mensal de SLA." };
    }
}

export async function upsertNpsQuestion(data: {
    id?: string;
    clientId: string;
    text: string;
    weight: number;
}) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'GESTOR')) {
            throw new Error("Unauthorized");
        }

        let question;
        if (data.id) {
            question = await prisma.npsQuestion.update({
                where: { id: data.id },
                data: {
                    text: data.text,
                    weight: data.weight
                }
            });
        } else {
            question = await prisma.npsQuestion.create({
                data: {
                    clientId: data.clientId,
                    text: data.text,
                    weight: data.weight
                }
            });
        }

        revalidatePath("/admin/performance");
        return { success: true, question };
    } catch (e) {
        console.error("Erro ao salvar pergunta NPS:", e);
        return { success: false, error: "Erro de servidor ao salvar pergunta NPS." };
    }
}

export async function deleteNpsQuestion(id: string) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'GESTOR')) {
            throw new Error("Unauthorized");
        }

        await prisma.npsQuestion.delete({
            where: { id }
        });

        revalidatePath("/admin/performance");
        return { success: true };
    } catch (e) {
        console.error("Erro ao deletar pergunta NPS:", e);
        return { success: false, error: "Erro ao excluir pergunta NPS." };
    }
}

export async function deleteNpsResponse(id: string) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== 'ADMIN') {
            throw new Error("Unauthorized");
        }

        await prisma.npsResponse.delete({
            where: { id }
        });

        revalidatePath("/admin/performance");
        return { success: true };
    } catch (e) {
        console.error("Erro ao deletar resposta NPS:", e);
        return { success: false, error: "Erro ao excluir resposta NPS." };
    }
}

export async function getClientDetailedData(clientId: string, year: number, month: number) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'GESTOR')) {
            throw new Error("Unauthorized");
        }

        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

        // Fetch client postos for billing management
        const postos = await prisma.posto.findMany({
            where: { clientId },
            include: { role: true },
            orderBy: { role: { name: 'asc' } }
        });

        // Fetch client specific SLA items
        const slaConfigItems = await prisma.slaConfigItem.findMany({
            where: { clientId },
            include: {
                ranges: true,
                monthlyValues: {
                    where: { year, month }
                }
            },
            orderBy: { name: 'asc' }
        });

        // Fetch client specific NPS questions
        const npsQuestions = await prisma.npsQuestion.findMany({
            where: { clientId },
            orderBy: { createdAt: 'asc' }
        });

        // Fetch detailed NPS responses for audit
        const npsResponses = await prisma.npsResponse.findMany({
            where: {
                clientId,
                createdAt: { gte: startOfMonth, lte: endOfMonth }
            },
            include: {
                answers: {
                    include: { question: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Fetch detailed attendance for operation report
        const attendances = await prisma.attendance.findMany({
            where: {
                posto: { clientId },
                date: { gte: startOfMonth, lte: endOfMonth }
            },
            include: {
                posto: { include: { role: true } },
                employee: true,
                coveredBy: true
            },
            orderBy: { date: 'asc' }
        });

        // Simular postos previstos e enriquecer com faltas virtuais (para auditoria)
        const clientPostos = await prisma.posto.findMany({
            where: { clientId },
            include: {
                assignments: {
                    include: { employee: true },
                    orderBy: { startDate: 'desc' }
                },
                role: true
            }
        });

        const enrichedAttendances = [...attendances];
        const daysInMonth = [];
        const today = new Date();
        const maxDate = (today.getFullYear() === year && today.getMonth() === month) ? today : endOfMonth;

        for (let d = new Date(startOfMonth); d <= maxDate; d.setDate(d.getDate() + 1)) {
            daysInMonth.push(new Date(d));
        }

        daysInMonth.forEach(dayDate => {
            const dayDateStr = dayDate.toISOString().split("T")[0];
            const targetDate = new Date(dayDateStr + "T00:00:00Z");

            clientPostos.forEach(posto => {
                const assignment = posto.assignments.find(a => {
                    const start = new Date(a.startDate);
                    const end = a.endDate ? new Date(a.endDate) : null;
                    return start <= targetDate && (!end || end >= targetDate);
                });

                let shouldWork = false;
                if (!assignment) {
                    const dayOfWeek = targetDate.getDay();
                    const normSchedule = posto.schedule.replace(/\s+/g, '').toLowerCase();
                    shouldWork = true;
                    if (normSchedule.includes('segasex') || normSchedule.includes('mondaytofriday')) {
                        if (dayOfWeek === 0 || dayOfWeek === 6) shouldWork = false;
                    } else if (normSchedule.includes('segasab') || normSchedule.includes('mondaytosaturday')) {
                        if (dayOfWeek === 0) shouldWork = false;
                    }
                } else {
                    const roster = generateRoster(posto.schedule, new Date(assignment.startDate), [targetDate]);
                    shouldWork = roster[0]?.status === 'Trabalho';
                }

                if (shouldWork) {
                    const hasPhysical = attendances.some(a => 
                        a.postoId === posto.id && 
                        new Date(a.date).toISOString().split("T")[0] === dayDateStr
                    );

                    if (!hasPhysical) {
                        const todayStr = today.toISOString().split("T")[0];
                        const isPastDay = targetDate.getTime() < new Date(todayStr + "T00:00:00Z").getTime();
                        let isEndedToday = false;

                        if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === dayDate.getDate()) {
                            const [endHour, endMinute] = posto.endTime.split(":").map(Number);
                            const shiftEnd = new Date(dayDate);
                            shiftEnd.setHours(endHour, endMinute, 0, 0);
                            const nowInBrazil = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
                            if (nowInBrazil > shiftEnd) {
                                isEndedToday = true;
                            }
                        }

                        if (isPastDay || isEndedToday) {
                            enrichedAttendances.push({
                                id: `virtual-${posto.id}-${dayDateStr}`,
                                postoId: posto.id,
                                employeeId: assignment?.employeeId || null,
                                date: targetDate,
                                status: "FALTA",
                                clockInTime: null,
                                coveredById: null,
                                coverageType: null,
                                notes: "Falta não tratada (sem registro de ponto)",
                                posto: {
                                    id: posto.id,
                                    name: posto.role?.name || "Posto",
                                    startTime: posto.startTime,
                                    endTime: posto.endTime,
                                    schedule: posto.schedule,
                                    billingValue: posto.billingValue,
                                    clientId: posto.clientId,
                                    roleId: posto.roleId,
                                    role: posto.role
                                },
                                employee: assignment?.employee || null,
                                coveredBy: null
                            } as any);
                        }
                    }
                }
            });
        });

        enrichedAttendances.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        console.log(`[getClientDetailedData] clientId: ${clientId}, year: ${year}, month: ${month}`);
        console.log(`[getClientDetailedData] attendances count: ${attendances.length}`);

        const allRequests = await prisma.request.findMany({
            where: {
                createdAt: { gte: startOfMonth, lte: endOfMonth }
            },
            include: {
                requester: { select: { id: true, name: true, clientIds: true } },
                employee: {
                    include: {
                        assignments: {
                            include: {
                                posto: true
                            }
                        }
                    }
                },
                comments: {
                    include: {
                        user: { select: { name: true, role: true } }
                    },
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        const requests = allRequests.filter((r: any) => 
            r.clientId === clientId ||
            (!r.clientId && (
                r.requester?.clientIds?.includes(clientId) ||
                r.employee?.assignments?.some((a: any) => a.posto?.clientId === clientId)
            ))
        );

        const visits = await prisma.contractVisit.findMany({
            where: {
                clientId,
                visitDate: { gte: startOfMonth, lte: endOfMonth }
            },
            orderBy: { visitDate: 'desc' }
        });

        const assignments = await prisma.assignment.findMany({
            where: {
                posto: { clientId }
            },
            include: {
                employee: true,
                posto: { include: { role: true } }
            },
            orderBy: { startDate: "asc" }
        });

        // Calcular transições de reposição acumuladas até o mês selecionado (Year-to-Date)
        const assignmentsByPosto: { [key: string]: any[] } = {};
        assignments.forEach((a: any) => {
            if (!assignmentsByPosto[a.postoId]) {
                assignmentsByPosto[a.postoId] = [];
            }
            assignmentsByPosto[a.postoId].push(a);
        });

        const repositionTransitions: any[] = [];
        Object.keys(assignmentsByPosto).forEach((postoId) => {
            const list = assignmentsByPosto[postoId].sort((x, y) => new Date(x.startDate).getTime() - new Date(y.startDate).getTime());
            for (let i = 0; i < list.length - 1; i++) {
                const current = list[i];
                const next = list[i + 1];
                if (current.endDate) {
                    const exitDate = new Date(current.endDate);
                    const entryDate = new Date(next.startDate);
                    if (entryDate >= exitDate) {
                        const diffTime = Math.abs(entryDate.getTime() - exitDate.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        repositionTransitions.push({
                            id: `${current.id}-${next.id}`,
                            postoId,
                            posto: current.posto,
                            exitedEmployee: current.employee,
                            exitDate,
                            enteredEmployee: next.employee,
                            entryDate,
                            diffDays
                        });
                    }
                }
            }
        });

        // Filtrar as transições acumuladas no ano até o mês selecionado (YTD)
        const monthRepositionTransitions = repositionTransitions.filter(t => 
            t.entryDate.getMonth() <= month && 
            t.entryDate.getFullYear() === year
        );

        return {
            success: true,
            postos,
            slaConfigItems,
            npsQuestions,
            npsResponses,
            attendances: enrichedAttendances,
            assignments: assignments.filter(a => a.endDate && new Date(a.endDate).getMonth() === month && new Date(a.endDate).getFullYear() === year),
            repositions: monthRepositionTransitions,
            visits,
            requests: requests.map((r: any) => ({
                id: r.id,
                type: r.type,
                status: r.status,
                description: r.description,
                createdAt: r.createdAt.toISOString(),
                dueDate: r.dueDate.toISOString(),
                employeeName: r.employee?.name || null,
                employeeId: r.employeeId || null,
                requesterName: r.requester?.name || "Cliente",
                resolutionNotes: r.resolutionNotes || null,
                comments: r.comments || []
            }))
        };

    } catch (e) {
        console.error("Erro ao carregar dados detalhados do cliente:", e);
        return { success: false, error: "Erro de servidor ao buscar detalhes operacionais." };
    }
}

export async function getAdminClientBilling(clientId: string, year: number) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'GESTOR')) {
            throw new Error("Unauthorized");
        }

        const clientIds = [clientId];
        const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
        const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

        const postos = await prisma.posto.findMany({
            where: { clientId: { in: clientIds } }
        });

        const expectedMonthlyBilling = postos.reduce((sum: number, p: any) => sum + p.billingValue, 0);

        const attendances = await prisma.attendance.findMany({
            where: {
                posto: { clientId: { in: clientIds } },
                date: { gte: startDate, lte: endDate }
            },
            include: {
                posto: true
            }
        });

        const monthNames = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];

        const monthsData = monthNames.map((name, index) => {
            const monthAtts = attendances.filter((a: any) => {
                const d = new Date(a.date);
                return d.getUTCMonth() === index;
            });

            let glosas = 0;
            monthAtts.forEach((a: any) => {
                if (a.status === "FALTA" && !a.coveredById && !a.coverageType) {
                    const dailyValue = a.posto.billingValue / 30;
                    glosas += dailyValue;
                }
            });

            const netBilling = Math.max(0, expectedMonthlyBilling - glosas);

            const activeShifts = monthAtts.filter((a: any) => a.status !== "FOLGA");
            const totalShifts = activeShifts.length;
            const vacantShifts = activeShifts.filter((a: any) => a.status === "FALTA" && !a.coveredById && !a.coverageType).length;
            
            const effectiveness = totalShifts > 0 
                ? ((totalShifts - vacantShifts) / totalShifts) * 100 
                : 100;

            return {
                monthIndex: index,
                name,
                expectedBilling: expectedMonthlyBilling,
                glosas,
                netBilling,
                effectiveness,
                totalShifts,
                vacantShifts
            };
        });

        return {
            success: true,
            year,
            months: monthsData
        };

    } catch (e) {
        console.error("Erro ao buscar faturamento administrativo:", e);
        return { success: false, error: "Erro ao buscar faturamento." };
    }
}

export async function getVisitRequirements(clientId: string) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'GESTOR' && user.role !== 'CLIENTE')) {
            throw new Error("Unauthorized");
        }

        const requirements = await prisma.clientVisitRequirement.findMany({
            where: { clientId }
        });

        return { success: true, requirements };
    } catch (e: any) {
        console.error("Erro ao buscar visit requirements:", e);
        return { success: false, error: e.message || "Erro ao buscar metas de visitas" };
    }
}

export async function saveVisitRequirements(clientId: string, requirements: Array<{ role: string, frequency: number }>) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'GESTOR')) {
            throw new Error("Unauthorized");
        }

        await prisma.$transaction(async (tx) => {
            await tx.clientVisitRequirement.deleteMany({
                where: { clientId }
            });

            if (requirements.length > 0) {
                await tx.clientVisitRequirement.createMany({
                    data: requirements.map(r => ({
                        clientId,
                        visitorRole: r.role,
                        frequency: r.frequency
                    }))
                });
            }
        });

        return { success: true };
    } catch (e: any) {
        console.error("Erro ao salvar visit requirements:", e);
        return { success: false, error: e.message || "Erro ao salvar metas de visitas" };
    }
}

export async function saveContractTargetScore(clientId: string, targetScore: number) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'GESTOR')) {
            return { success: false, error: "Não autorizado" };
        }

        await prisma.client.update({
            where: { id: clientId },
            data: { contractTargetScore: targetScore }
        });

        return { success: true };
    } catch (e: any) {
        console.error("Erro ao salvar contractTargetScore:", e);
        return { success: false, error: e.message || "Erro de servidor ao salvar meta contratual" };
    }
}

 
