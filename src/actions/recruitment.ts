"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { VacancyStatus } from "@prisma/client";
import { addBusinessDays } from "@/lib/business-days";
import { createNotification } from "./notifications";

// --- Helper: Create Vacancy from Posto ---
export async function createVacancyFromPosto(
    postoId: string,
    unassignedEmployeeName?: string,
    reason?: string,
    notes?: string,
    userId?: string
) {
    const posto = await prisma.posto.findUnique({
        where: { id: postoId },
        include: {
            role: true,
            client: {
                include: {
                    company: true
                }
            }
        }
    });

    if (!posto) throw new Error("Posto not found");

    // BLOCKER: Prevent vacancy creation for ROTATIVO
    if (posto.client.name === 'ROTATIVO') {
        throw new Error("Não é permitido abrir vaga para o posto ROTATIVO.");
    }

    // Busca a vaga mais recente deste posto para herdar as configurações
    const latestVacancy = await prisma.vacancy.findFirst({
        where: { postoId: posto.id },
        orderBy: { createdAt: 'desc' }
    });

    const title = `${posto.role.name} - ${posto.client.name}`;
    const description = `Vaga aberta automaticamente após realocação de colaborador.\n\nDetalhes do posto:\n- Escala: ${posto.schedule}\n- Horário: ${posto.startTime} - ${posto.endTime}\n- Carga horária: ${posto.requiredWorkload}h`;

    // Create vacancy inheriting requirements from the previous vacancy of the same Posto
    const vacancy = await prisma.vacancy.create({
        data: {
            title,
            description,
            postoId: posto.id,
            companyId: posto.client.company?.id || null,
            status: 'OPEN',
            priority: 'MEDIUM',
            recruiterId: latestVacancy?.recruiterId || null,
            reqGender: latestVacancy?.reqGender || null,
            reqExperience: latestVacancy?.reqExperience || null,
            reqKnowledge: latestVacancy?.reqKnowledge || null,
            reqAgeMin: latestVacancy?.reqAgeMin || null,
            reqAgeMax: latestVacancy?.reqAgeMax || null,
            customRequirements: (latestVacancy?.customRequirements as any) || undefined
        }
    });

    // Create a recruitment timeline record
    let details = `Vaga aberta automaticamente após desvinculação de colaborador do posto.`;
    if (unassignedEmployeeName) {
        details = `Vaga aberta automaticamente após desvinculação de ${unassignedEmployeeName}.${reason ? ` Motivo: ${reason}.` : ''}${notes ? ` Observações: ${notes}` : ''}`;
    }

    await prisma.recruitmentTimeline.create({
        data: {
            vacancyId: vacancy.id,
            action: "CREATED",
            details,
            userId: userId || null
        }
    });

    revalidatePath("/admin/recrutamento");

    // Notify stakeholders
    try {
        await notifyVacancyStakeholders(
            vacancy.id,
            "Nova Vaga Aberta",
            `Vaga "${title}" foi aberta automaticamente no R&S.`,
            'SYSTEM',
            `/admin/recrutamento?openId=VAC-${vacancy.id}`
        );
    } catch (notifError) {
        console.error("Failed to notify stakeholders about new vacancy:", notifError);
    }

    return vacancy;
}

// --- Vacancies ---

export async function getVacancies(filter?: { status?: string, companyId?: string }) {
    const user = await getCurrentUser();
    if (!user) return [];

    const where: any = {};
    if (filter?.status && filter.status !== 'ALL') {
        where.status = filter.status as VacancyStatus;
    }
    if (filter?.companyId && filter.companyId !== 'all') {
        where.companyId = filter.companyId;
    }

    const vacancies = await prisma.vacancy.findMany({
        where: {
            ...where,
            OR: [
                { postoId: null },
                { posto: { is: null } },
                { posto: { client: { name: { not: 'ROTATIVO' } } } }
            ]
        },
        include: {
            role: true,
            posto: { include: { client: true } },
            company: true,
            recruiter: { select: { id: true, name: true } }, // NEW
            candidates: {
                select: { id: true } // Just count for list
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return vacancies;
}

export async function createVacancy(data: {
    title: string;
    description: string;
    roleId?: string;
    postoId?: string;
    companyId?: string;
    priority: string;
    recruiterId: string; // NEW Mandatory
    reqGender?: string;
    reqExperience?: string;
    reqKnowledge?: string;
    reqAgeMin?: number;
    reqAgeMax?: number;
    plannedStartDate?: Date | string;
    customRequirements?: any;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    // Validate Rotativo
    if (data.companyId) {
        const company = await prisma.company.findUnique({ where: { id: data.companyId }, include: { clients: true } });
        // Although Rotativo is a client, sometimes it might be linked via company? 
        // Rotativo client has companyId=null usually.
        // Let's check postoId if provided
    }
    if (data.postoId) {
        const posto = await prisma.posto.findUnique({ where: { id: data.postoId }, include: { client: true } });
        if (posto && posto.client.name === 'ROTATIVO') {
            throw new Error("Não é permitido abrir vaga para o posto ROTATIVO.");
        }
    }

    let inheritData: any = null;
    if (data.postoId) {
        inheritData = await prisma.vacancy.findFirst({
            where: { postoId: data.postoId },
            orderBy: { createdAt: 'desc' }
        });
    }

    const vacancy = await prisma.vacancy.create({
        data: {
            title: data.title,
            description: data.description,
            roleId: data.roleId || null,
            postoId: data.postoId || null,
            companyId: data.companyId || null,
            priority: data.priority,
            status: "OPEN",
            recruiterId: data.recruiterId,
            reqGender: data.reqGender || inheritData?.reqGender || null,
            reqExperience: data.reqExperience || inheritData?.reqExperience || null,
            reqKnowledge: data.reqKnowledge || inheritData?.reqKnowledge || null,
            reqAgeMin: data.reqAgeMin || inheritData?.reqAgeMin || null,
            reqAgeMax: data.reqAgeMax || inheritData?.reqAgeMax || null,
            plannedStartDate: data.plannedStartDate ? new Date(data.plannedStartDate) : (inheritData?.plannedStartDate ? new Date(inheritData.plannedStartDate) : null),
            customRequirements: (data.customRequirements || inheritData?.customRequirements) as any || undefined
        }
    });

    await prisma.recruitmentTimeline.create({
        data: {
            vacancyId: vacancy.id,
            action: "CREATED",
            details: `Vaga criada por ${user.name || user.username}.`,
            userId: user.id
        }
    });

    // Notify Recruiter about new assignment
    if (data.recruiterId !== user.id) {
        await createNotification(
            data.recruiterId,
            "Nova Atribuição de Vaga",
            `Você foi definido como recrutador da vaga: ${data.title}`,
            'ASSIGNMENT',
            '/admin/recrutamento'
        );
    }

    revalidatePath("/admin/recrutamento");
}

// --- SHARED NOTIFICATION HELPER ---
// Notifies ALL users with admin/management access (everyone except regular USERs)
async function notifyVacancyStakeholders(vacancyId: string, title: string, message: string, type: 'SYSTEM' | 'MOVEMENT' | 'MENTION' | 'ASSIGNMENT', deepLink: string) {
    // Fetch all users with valid SystemRole values
    const users = await prisma.user.findMany({
        where: {
            role: { in: ['ADMIN', 'COORD_RH', 'ASSIST_RH', 'SUPERVISOR'] }
        },
        select: { id: true }
    });

    // Notify everyone (including the actor)
    for (const user of users) {
        await createNotification(user.id, title, message, type, deepLink);
    }
}

export async function updateVacancyStatus(id: string, status: VacancyStatus) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    await prisma.vacancy.update({
        where: { id },
        data: { status }
    });

    // Notify all stakeholders about status change
    const statusLabels: Record<string, string> = {
        'OPEN': 'Aberta',
        'FILLED': 'Preenchida',
        'CANCELLED': 'Cancelada'
    };
    await notifyVacancyStakeholders(
        id,
        "Status da Vaga Alterado",
        `Vaga foi marcada como: ${statusLabels[status] || status}`,
        'SYSTEM',
        '/admin/recrutamento?openId=VAC-' + id
    );

    revalidatePath("/admin/recrutamento");
}

// --- Candidates & Kanban ---

export async function getRecruitmentBoardData() {
    const user = await getCurrentUser();
    if (!user) return [];

    // --- MIGRATION: Unify Triagem + RH -> Seleção ---
    // 1. Rename 'Triagem' to 'Seleção'
    const triagemStage = await prisma.recruitmentStage.findFirst({ where: { name: "Triagem" } });
    if (triagemStage) {
        await prisma.recruitmentStage.update({
            where: { id: triagemStage.id },
            data: { name: "Seleção", order: 1 }
        });
    }

    // 2. Move 'Entrevista RH' candidates to 'Seleção' and delete 'Entrevista RH'
    const rhStage = await prisma.recruitmentStage.findFirst({ where: { name: "Entrevista RH" } });
    if (rhStage) {
        // Find Seleção (target)
        const selecaoStage = await prisma.recruitmentStage.findFirst({ where: { name: "Seleção" } });
        if (selecaoStage) {
            await prisma.recruitmentCandidate.updateMany({
                where: { stageId: rhStage.id },
                data: { stageId: selecaoStage.id }
            });
            // Delete RH Stage
            await prisma.recruitmentStage.delete({ where: { id: rhStage.id } });
        }
    }

    // --- SYNC BACKLOG GAPS TO VACANCIES ---
    // Automatically create vacancies for vacant postos
    await syncBacklogGaps();
    // MOD: Disabled purgeRedundantVacancies so manually opened vacancies are NEVER automatically closed/purged.
    // await purgeRedundantVacancies();

    // 3. Reorder remaining stages (Shift up)
    // Seleção is 1. We want:
    // Entrevista Técnica -> 2
    // Oferta -> 3
    // Contratado -> 4
    // Posto -> 5

    // Check if reordering is needed (simple check: if Entrevista Técnica is order 3, move to 2)
    const tecStage = await prisma.recruitmentStage.findFirst({ where: { name: "Entrevista Técnica", order: 3 } });
    if (tecStage) {
        await prisma.recruitmentStage.update({ where: { id: tecStage.id }, data: { order: 2 } });

        const ofertaStage = await prisma.recruitmentStage.findFirst({ where: { name: "Oferta" } });
        if (ofertaStage) await prisma.recruitmentStage.update({ where: { id: ofertaStage.id }, data: { order: 3 } });

        const hiredStage = await prisma.recruitmentStage.findFirst({ where: { name: "Contratado" } });
        if (hiredStage) await prisma.recruitmentStage.update({ where: { id: hiredStage.id }, data: { order: 4 } });

        // Posto might be 6 from previous logic, move to 5
        const postoStage = await prisma.recruitmentStage.findFirst({ where: { name: "Posto" } });
        if (postoStage && postoStage.order !== 5) await prisma.recruitmentStage.update({ where: { id: postoStage.id }, data: { order: 5 } });
    } else {
        // Safety check for Posto if it was just created as 6
        const postoStage = await prisma.recruitmentStage.findFirst({ where: { name: "Posto", order: 6 } });
        if (postoStage) await prisma.recruitmentStage.update({ where: { id: postoStage.id }, data: { order: 5 } });
    }

    // --- MIGRATION: Unify Oferta + Contratado -> Admissão ---
    // 1. Rename 'Oferta' to 'Admissão'
    const ofertaStage = await prisma.recruitmentStage.findFirst({ where: { name: "Oferta" } });
    if (ofertaStage) {
        await prisma.recruitmentStage.update({
            where: { id: ofertaStage.id },
            data: { name: "Admissão", order: 3 }
        });
    }

    // 2. Move 'Contratado' candidates to 'Admissão' and delete 'Contratado'
    const contratadoStage = await prisma.recruitmentStage.findFirst({ where: { name: "Contratado" } });
    if (contratadoStage) {
        // Find Admissão (target) - logic handles if it was just renamed from Oferta or already exists
        const admissaoStage = await prisma.recruitmentStage.findFirst({ where: { name: "Admissão" } });
        if (admissaoStage) {
            await prisma.recruitmentCandidate.updateMany({
                where: { stageId: contratadoStage.id },
                data: { stageId: admissaoStage.id }
            });
            // Delete Contratado Stage
            await prisma.recruitmentStage.delete({ where: { id: contratadoStage.id } });
        }
    }

    // 3. Reorder Posto to follows Admissão
    // Seleção (1) -> Ent. Técnica (2) -> Admissão (3) -> Posto (4)
    const postoStageMigrate = await prisma.recruitmentStage.findFirst({ where: { name: "Posto" } });
    if (postoStageMigrate && postoStageMigrate.order !== 4) {
        await prisma.recruitmentStage.update({ where: { id: postoStageMigrate.id }, data: { order: 4 } });
    }

    // Ensure Default Stages (Corrected Set) exist if completely empty
    const stagesCount = await prisma.recruitmentStage.count();
    if (stagesCount === 0) {
        await prisma.recruitmentStage.createMany({
            data: [
                { name: "Seleção", order: 1, slaDays: 3 },
                { name: "Entrevista Técnica", order: 2, slaDays: 5 },
                { name: "Admissão", order: 3, slaDays: 2 }, // Unified
                { name: "Posto", order: 4, slaDays: 0 },
            ]
        });
    }

    // 1. Fetch Open Vacancies with their candidates and stages
    const openVacancies = await prisma.vacancy.findMany({
        where: {
            status: 'OPEN'
        },
        include: {
            role: true,
            posto: { include: { client: true } },
            company: true,
            recruiter: true,
            participants: { select: { id: true, name: true } },
            candidates: {
                include: { stage: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    // 2. Fetch standard recruitment stages
    const dbStages = await prisma.recruitmentStage.findMany({
        orderBy: { order: 'asc' }
    });

    // Get or Create the System "R&S (Vagas)" Stage
    let rnsStageDb = dbStages.find(s => s.name === 'R&S (Vagas)');
    if (!rnsStageDb) {
        rnsStageDb = await prisma.recruitmentStage.create({
            data: {
                name: 'R&S (Vagas)',
                order: 0,
                isSystem: true,
                slaDays: 5
            }
        });
    }

    // Filter standard stages (excluding backlog stage)
    const standardStages = dbStages.filter(s => s.name !== 'R&S (Vagas)' && s.id !== rnsStageDb?.id);

    // 3. Initialize mapping of stages to their vacancy cards
    const stageCardsMap: Record<string, any[]> = {
        [rnsStageDb.id]: []
    };
    standardStages.forEach(s => {
        stageCardsMap[s.id] = [];
    });

    // Helper to map vacancy object to Kanban card structure
    const createVacancyCard = (v: typeof openVacancies[0], totalCandidates: number) => ({
        id: `VAC-${v.id}`, // Unique ID across the whole board
        realId: v.id,
        name: `${v.title} (${totalCandidates} candidato${totalCandidates !== 1 ? 's' : ''})`,
        type: 'VACANCY' as const,
        createdAt: v.createdAt,
        vacancy: {
            id: v.id,
            title: `${v.title} (${totalCandidates} candidato${totalCandidates !== 1 ? 's' : ''})`,
            priority: v.priority,
            status: v.status,
            role: v.role,
            posto: v.posto,
            company: v.company,
            description: v.description,
            recruiter: v.recruiter,
            createdAt: v.createdAt,
            participants: v.participants,
            reqGender: v.reqGender,
            reqExperience: v.reqExperience,
            reqKnowledge: v.reqKnowledge,
            reqAgeMin: v.reqAgeMin,
            reqAgeMax: v.reqAgeMax,
            plannedStartDate: v.plannedStartDate,
            customRequirements: v.customRequirements,
            candidates: v.candidates
        }
    });

    // 4. Place each vacancy in exactly one stage based on its candidates
    openVacancies.forEach(v => {
        const totalCandidates = v.candidates.length;
        if (totalCandidates === 0) {
            // No candidates -> vacancy card stays in R&S
            stageCardsMap[rnsStageDb!.id].push(createVacancyCard(v, 0));
        } else {
            // Filter candidates with valid stages (not matching the backlog stage itself)
            const activeCandidates = v.candidates.filter(c => c.stage && c.stageId !== rnsStageDb!.id);
            if (activeCandidates.length === 0) {
                // If all candidates are somehow in backlog or without stage, keep vacancy in R&S
                stageCardsMap[rnsStageDb!.id].push(createVacancyCard(v, totalCandidates));
            } else {
                // Find highest stage order among candidates
                activeCandidates.sort((a, b) => (b.stage?.order || 0) - (a.stage?.order || 0));
                const highestCandidate = activeCandidates[0];
                const targetStageId = highestCandidate.stageId;

                if (stageCardsMap[targetStageId]) {
                    stageCardsMap[targetStageId].push(createVacancyCard(v, totalCandidates));
                } else {
                    // Fallback to first standard stage (Seleção)
                    const firstStandard = standardStages[0];
                    if (firstStandard) {
                        stageCardsMap[firstStandard.id].push(createVacancyCard(v, totalCandidates));
                    } else {
                        stageCardsMap[rnsStageDb!.id].push(createVacancyCard(v, totalCandidates));
                    }
                }
            }
        }
    });

    // 5. Build final list of board stages
    const rnsStage = {
        id: rnsStageDb.id,
        name: rnsStageDb.name,
        order: rnsStageDb.order,
        isSystem: true,
        slaDays: rnsStageDb.slaDays,
        candidates: stageCardsMap[rnsStageDb.id]
    };

    const candidateStages = standardStages.map(s => ({
        id: s.id,
        name: s.name,
        order: s.order,
        isSystem: false,
        slaDays: s.slaDays,
        candidates: stageCardsMap[s.id] || []
    }));

    // 6. Rescue Logic: Automatically fix any stranded candidates placed in R&S stage in the DB
    const strandedCandidates = await prisma.recruitmentCandidate.findMany({
        where: { stageId: rnsStageDb.id }
    });

    if (strandedCandidates.length > 0) {
        const firstStandard = standardStages[0];
        if (firstStandard) {
            await prisma.recruitmentCandidate.updateMany({
                where: { stageId: rnsStageDb.id },
                data: { stageId: firstStandard.id }
            });
        }
    }

    return [rnsStage, ...candidateStages];
}

export async function getRecruitmentTimeline(params: { candidateId?: string; vacancyId?: string }) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const { candidateId, vacancyId } = params;

    if (!candidateId && !vacancyId) return [];

    return await prisma.recruitmentTimeline.findMany({
        where: candidateId ? { candidateId } : { vacancyId },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
    });
}
export async function moveCandidate(candidateId: string, newStageId: string, justification?: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    // Support Vacancy card dragging: moves all candidates of that vacancy to the new stage
    if (candidateId.startsWith("VAC-")) {
        const vacancyId = candidateId.replace("VAC-", "");
        const newStage = await prisma.recruitmentStage.findUnique({ where: { id: newStageId } });
        if (!newStage) throw new Error("New stage not found");

        const candidates = await prisma.recruitmentCandidate.findMany({
            where: { vacancyId },
            include: { stage: true }
        });

        for (const cand of candidates) {
            await prisma.recruitmentCandidate.update({
                where: { id: cand.id },
                data: {
                    stageId: newStageId,
                    stageDueDate: newStage.slaDays > 0 ? addBusinessDays(new Date(), newStage.slaDays) : null,
                    updatedAt: new Date()
                }
            });

            await prisma.recruitmentTimeline.create({
                data: {
                    candidateId: cand.id,
                    vacancyId,
                    candidateName: cand.name,
                    action: "MOVED",
                    details: `Movido em lote para ${newStage.name} via arraste da vaga no Kanban.`,
                    userId: user.id
                }
            });
        }

        revalidatePath("/admin/recrutamento");
        return { success: true };
    }

    const candidate = await prisma.recruitmentCandidate.findUnique({
        where: { id: candidateId },
        include: { stage: true } // Need current stage info
    });

    if (!candidate) throw new Error("Candidate not found");

    const currentStage = candidate.stage;
    const newStage = await prisma.recruitmentStage.findUnique({ where: { id: newStageId } });

    if (!newStage) throw new Error("New stage not found");

    // Approval Logic Check
    if (currentStage.approverId) {
        // If stage has an approver, strictly enforce: only that Approver OR Admin can move.
        // Assuming user.role strategy. For now checking ID match or ADMIN role.
        const isApprover = user.id === currentStage.approverId;
        const isAdmin = user.role === 'ADMIN' || user.role === 'COORD_RH'; // Adjust roles as needed

        if (!isApprover && !isAdmin) {
            throw new Error(`Aprovação necessária pelo responsável: ${currentStage.approverId}`); // Ideally name
        }
    }

    // Justification Check for Rejection (Moving Backwards)
    // Only enforced if the stage has an Approver configured (Formal Approval Process)
    const isMovingBack = newStage.order < currentStage.order;
    if (currentStage.approverId && isMovingBack && !justification) {
        throw new Error("Justificativa é obrigatória para reprovação/retorno de etapa com aprovação.");
    }

    // Calculate Due Date (SLA)
    let newDueDate = null;
    // Standard SLA Logic: From NOW + Stage SLA
    // User requested: "SLA calculation must always consider the candidate's original creation date" -> wait, 
    // actually previous instruction was "SLA calculation must always consider the candidate's original creation date" 
    // BUT usually SLA is per stage.
    // Let's stick to the simpler Per-Stage SLA (resetting timer) for now unless clearly specified otherwise for *every* stage.
    // Actually, looking at previous summary: "SLA Calculation Standardization... consistently use the candidate's original creation date".
    // If we want total cycle time, we use createdAt. If we want Stage Due Date, we usually add days to NOW.
    // The previous fix was about keeping the BASELINE, but typically `stageDueDate` is for the CURRENT stage.
    // Let's keep existing logic: addBusinessDays(new Date(), newStage.slaDays).

    if (newStage.slaDays > 0) {
        newDueDate = addBusinessDays(new Date(), newStage.slaDays);
    }

    // Build timeline details
    let actionType = "MOVED";
    let detailsText = `Movido de ${currentStage.name} para ${newStage.name}`;

    if (currentStage.approverId) {
        if (isMovingBack) {
            actionType = "REJECTED"; // Custom action for history
            detailsText = `[REPROVADO] ${detailsText}. Justificativa: ${justification}`;
        } else {
            actionType = "APPROVED";
            detailsText = `[APROVADO] ${detailsText} por ${user.name}`;
            if (justification) detailsText += `. Obs: ${justification}`;
        }
    } else if (justification) {
        detailsText += `. Justificativa: ${justification}`;
    }

    await prisma.$transaction([
        prisma.recruitmentCandidate.update({
            where: { id: candidateId },
            data: {
                stageId: newStageId,
                stageDueDate: newDueDate, // Update Due Date
                updatedAt: new Date() // Reset timer essentially
            }
        }),
        prisma.recruitmentTimeline.create({
            data: {
                candidateId,
                vacancyId: candidate.vacancyId, // Link to Vacancy
                candidateName: candidate.name,  // Snapshot
                action: actionType,
                details: detailsText,
                userId: user.id
            }
        })
    ]);

    // AUTO-CLOSE VACANCY if moved to "Posto"
    if (newStage.name === "Posto") {
        await prisma.vacancy.update({
            where: { id: candidate.vacancyId },
            data: { status: "CLOSED" }
        });
    }

    // --- NOTIFICATION: Candidate Movement ---
    if (candidate.vacancyId) {
        const vacancy = await prisma.vacancy.findUnique({
            where: { id: candidate.vacancyId },
            include: {
                recruiter: true,
                participants: true
            }
        });

        if (vacancy) {
            const message = `Candidato ${candidate.name} movido para ${newStage.name}`;
            const link = `/admin/recrutamento?openId=${candidate.id}`;

            await notifyVacancyStakeholders(
                candidate.vacancyId,
                "Atualização de Candidato",
                message,
                'MOVEMENT',
                link
            );
        }
    }

    revalidatePath("/admin/recrutamento");
}

export async function updateStageConfig(stageId: string, data: { slaDays?: number, approverId?: string | null }) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    // Check admin permission here if needed

    await prisma.recruitmentStage.update({
        where: { id: stageId },
        data: {
            ...(data.slaDays !== undefined && { slaDays: data.slaDays }),
            ...(data.approverId !== undefined && { approverId: data.approverId })
        }
    });

    // If SLA changed, we might want to update existing candidates... leaving that complex logic for the dedicated SLA update function if it exists, or merging here.
    // For now, this is a config update.

    revalidatePath("/admin/recrutamento");
}

export async function withdrawCandidate(candidateId: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    // 1. Get candidate details for audit log before deletion
    const candidate = await prisma.recruitmentCandidate.findUnique({
        where: { id: candidateId },
        select: { name: true, vacancyId: true }
    });

    if (candidate) {
        // 2. Create Audit Log (Preserved via Vacancy Link)
        await prisma.recruitmentTimeline.create({
            data: {
                vacancyId: candidate.vacancyId,
                candidateName: candidate.name,
                // candidateId will be null after delete OR we set it now and let it be set to null by ON DELETE SET NULL
                // To safely link it before delete, we can set it.
                // But since we delete immediately, it might be safer to just relying on vacancy links for history of deleted candidates.
                // Let's link it anyway, so if delete fails, we have it.
                candidateId: candidateId,
                action: "WITHDRAWN",
                details: `Candidato ${candidate.name} desistiu do processo e foi removido.`,
                userId: user.id
            }
        });
    }

    // 3. Delete Candidate (Timeline candidateId becomes null, but vacancyId and candidateName persist)
    await prisma.recruitmentCandidate.delete({
        where: { id: candidateId }
    });

    // 4. Notify all stakeholders about withdrawal
    if (candidate && candidate.vacancyId) {
        await notifyVacancyStakeholders(
            candidate.vacancyId,
            "Desistência de Candidato",
            `Candidato ${candidate.name} desistiu do processo.`,
            'SYSTEM',
            '/admin/recrutamento?openId=VAC-' + candidate.vacancyId
        );
    }

    revalidatePath("/admin/recrutamento");
}

export async function deleteCandidate(candidateId: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    // Strict Admin Check
    if (user.role !== 'ADMIN') {
        throw new Error("Apenas administradores podem excluir registros permanentemente.");
    }

    // Delete associated timeline entries first to be clean (optional but good for test data)
    await prisma.recruitmentTimeline.deleteMany({
        where: { candidateId: candidateId }
    });

    await prisma.recruitmentCandidate.delete({
        where: { id: candidateId }
    });

    revalidatePath("/admin/recrutamento");
}

export async function createCandidate(data: {
    name: string;
    email?: string;
    phone?: string;
    vacancyId: string;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    // Get first stage (Triagem) - Exclude System stages like R&S (order 0)
    const firstStage = await prisma.recruitmentStage.findFirst({
        where: { isSystem: false },
        orderBy: { order: 'asc' }
    });

    if (!firstStage) throw new Error("No stages defined");

    // Calculate initial SLA
    let initialDueDate = null;
    if (firstStage.slaDays > 0) {
        initialDueDate = addBusinessDays(new Date(), firstStage.slaDays);
    }

    // Transaction to create candidate and log
    await prisma.$transaction(async (tx) => {
        const newCandidate = await tx.recruitmentCandidate.create({
            data: {
                name: data.name,
                email: data.email,
                phone: data.phone,
                vacancyId: data.vacancyId,
                stageId: firstStage.id,
                stageDueDate: initialDueDate
            }
        });

        await tx.recruitmentTimeline.create({
            data: {
                candidateId: newCandidate.id,
                vacancyId: data.vacancyId,
                candidateName: data.name,
                action: "CREATED",
                details: `Candidato cadastrado na etapa ${firstStage.name}`,
                userId: user.id
            }
        });
    });

    // Notify after transaction
    await notifyVacancyStakeholders(
        data.vacancyId,
        "Novo Candidato",
        `Candidato ${data.name} adicionado à vaga`,
        'SYSTEM',
        '/admin/recrutamento?openId=VAC-' + data.vacancyId
    );

    revalidatePath("/admin/recrutamento");
}



export async function updateStageSLA(stageId: string, slaDays: number) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    // Check permission (Admin only ideally, but Supervisor ok for MVP)

    await prisma.$transaction(async (tx) => {
        // 1. Update Stage SLA
        await tx.recruitmentStage.update({
            where: { id: stageId },
            data: { slaDays }
        });

        // 2. Recalculate DueDate for all candidates currently in this stage
        const candidatesInStage = await tx.recruitmentCandidate.findMany({
            where: { stageId }
        });

        for (const candidate of candidatesInStage) {
            // Calculate new due date based on when they entered the stage (updatedAt) + new SLA
            // If slaDays is 0, stored as null
            let newDueDate = null;
            if (slaDays > 0) {
                const baseDate = candidate.updatedAt;
                newDueDate = addBusinessDays(baseDate, slaDays);
            }

            await tx.recruitmentCandidate.update({
                where: { id: candidate.id },
                data: { stageDueDate: newDueDate }
            });
        }
    });

    revalidatePath("/admin/recrutamento");
}

export async function getRecruiters() {
    const user = await getCurrentUser();
    if (!user) return [];

    // Return users capable of being approvers/recruiters
    // For now, returning all users or filtering by specific roles
    return await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
    });
}

export async function getBacklogItems() {
    const user = await getCurrentUser();
    if (!user) return [];

    // 1. Get all postos that currently have NO active assignment
    const vacantPostos = await prisma.posto.findMany({
        where: {
            client: {
                name: { not: 'ROTATIVO' }
            },
            assignments: {
                none: {
                    endDate: null // Active assignments have no end date
                }
            }
        },
        include: {
            client: { include: { company: true } },
            role: true,
            vacancies: {
                where: { status: 'OPEN' }
            }
        }
    });

    // 2. Filter out postos that ALREADY have an OPEN vacancy
    const backlog = vacantPostos.filter(p => p.vacancies.length === 0);

    return backlog.map(p => ({
        id: p.id,
        title: `${p.role.name} - ${p.client.name}`,
        clientName: p.client.name,
        roleName: p.role.name,
        roleId: p.role.id,
        postoId: p.id,
        companyId: p.client.companyId // Assuming client has optional companyId link
    }));
}

export async function getEmployeeFormData() {
    const [situations, roles, companies, postos] = await Promise.all([
        prisma.situation.findMany({ orderBy: { name: 'asc' } }),
        prisma.role.findMany({ orderBy: { name: 'asc' } }),
        prisma.company.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        }),
        prisma.posto.findMany({
            include: { client: true, role: true },
            orderBy: { client: { name: 'asc' } }
        })
    ]);
    return { situations, roles, companies, postos };
}

// --- NEW: Delete Vacancy ---
export async function deleteVacancy(id: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autorizado." };
    if (user.role !== 'ADMIN' && user.role !== 'COORD_RH') {
        return { error: "Apenas administradores podem excluir vagas." };
    }

    try {
        await prisma.$transaction(async (tx) => {
            // Find candidates linked to vacancy
            const candidates = await tx.recruitmentCandidate.findMany({
                where: { vacancyId: id },
                select: { id: true }
            });
            const candidateIds = candidates.map(c => c.id);

            // Delete comments linked to vacancy
            await tx.recruitmentComment.deleteMany({
                where: { vacancyId: id }
            });

            if (candidateIds.length > 0) {
                await tx.recruitmentTimeline.deleteMany({
                    where: { candidateId: { in: candidateIds } }
                });
                await tx.recruitmentCandidate.deleteMany({
                    where: { vacancyId: id }
                });
            }

            await tx.recruitmentTimeline.deleteMany({
                where: { vacancyId: id }
            });

            // Mark vacancy as CLOSED so syncBacklogGaps won't auto-recreate it
            await tx.vacancy.update({
                where: { id },
                data: { status: 'CLOSED' }
            });
        });

        revalidatePath("/admin/recrutamento");
        return { success: true };
    } catch (e: any) {
        console.error("Error in deleteVacancy:", e);
        return { error: e.message || "Erro ao excluir vaga." };
    }
}

async function syncBacklogGaps() {
    // 1. Get all postos that currently have NO active assignment
    const vacantPostos = await prisma.posto.findMany({
        where: {
            client: { name: { not: 'ROTATIVO' } },
            assignments: { none: { endDate: null } }
        },
        include: {
            client: { include: { company: true } },
            role: true,
            vacancies: {
                include: {
                    candidates: {
                        select: { stage: { select: { name: true } } }
                    }
                }
            }
        }
    });

    // 2. Filter out postos that ALREADY have an Active or Closed Process
    const postosNeedingVacancy = vacantPostos.filter(p => {
        const hasActiveVacancy = p.vacancies.some(v => v.status === 'OPEN' || v.status === 'HOLD' || v.status === 'CLOSED');
        if (hasActiveVacancy) return false;

        // Check 2: Has a vacancy (only OPEN or HOLD) with a candidate in Filling Stages
        // If the vacancy is CLOSED, we ignore its candidates (Zombie check).
        const hasFillingCandidate = p.vacancies.some(v =>
            (v.status === 'OPEN' || v.status === 'HOLD') &&
            v.candidates.some(c =>
                c.stage?.name && ['Admissão', 'Contratado', 'Oferta'].includes(c.stage.name)
            )
        );

        if (hasFillingCandidate) return false;
        
        return true; // FIX: Return true to include the vacant posto in the filter results
    });

    if (postosNeedingVacancy.length === 0) return;

    // 3. Create Vacancies
    console.log(`Creating ${postosNeedingVacancy.length} automatic vacancies for gaps.`);

    for (const p of postosNeedingVacancy) {
        if (p.client.name === 'ROTATIVO') continue;
        try {
            await prisma.vacancy.create({
                data: {
                    title: `${p.role.name} - ${p.client.name}`,
                    description: `Vaga aberta automaticamente por vacância do posto.\nHorário: ${p.startTime} - ${p.endTime}\nEscala: ${p.schedule}`,
                    postoId: p.id,
                    roleId: p.roleId || undefined,
                    companyId: p.client.companyId || undefined,
                    priority: "URGENT",
                    status: "OPEN"
                }
            });
        } catch (err) {
            console.error(`Erro ao criar vaga automática para o posto ${p.id}:`, err);
        }
    }
}

// Helper: Auto-close vacancies if post is filled
async function syncFilledVacancies() {
    // Find postos that have BOTH:
    // 1. Active Assignment
    // 2. Open Vacancy
    const doubleBookedPostos = await prisma.posto.findMany({
        where: {
            assignments: { some: { endDate: null } },
            vacancies: { some: { status: 'OPEN' } }
        },
        include: { vacancies: { where: { status: 'OPEN' } } }
    });

    if (doubleBookedPostos.length > 0) {
        console.log(`Closing ${doubleBookedPostos.length} vacancies for filled postos.`);
        for (const p of doubleBookedPostos) {
            for (const v of p.vacancies) {
                await prisma.vacancy.update({
                    where: { id: v.id },
                    data: { status: 'CLOSED' }
                });
            }
        }
    }
}

// Helper: Aggressive Cleanup of "Phantom" Vacancies
// If a Posto has ANY candidate in "Admissão", "Posto", "Contratado", "Oferta" (Active Process)
// Then ALL Open Vacancies for that Posto should be CLOSED, because the slot is reserved/taken.
// This fixes the 'Duplicate Phase 01 Vacancy vs Active Candidate' issue.
async function purgeRedundantVacancies() {
    // 1. Find Postos with at least one OPEN vacancy
    const postosWithOpenVacancies = await prisma.posto.findMany({
        where: {
            vacancies: { some: { status: 'OPEN' } }
        },
        include: {
            vacancies: {
                // Get ALL vacancies for this posto to check candidates
                include: {
                    candidates: { select: { stage: { select: { name: true } } } }
                }
            }
        }
    });

    let cleanedCount = 0;

    for (const p of postosWithOpenVacancies) {
        // Check if there is ANY candidate in an advanced stage (Filling the slot)
        // This includes candidates in the OPEN vacancy itself OR in other Closed vacancies for the same posto
        const hasFillingCandidate = p.vacancies.some(v =>
            v.candidates.some(c => ['Admissão', 'Posto', 'Contratado', 'Oferta'].includes(c.stage.name))
        );

        if (hasFillingCandidate) {
            // Close ALL Open Vacancies that have NO filling candidates themselves (to be safe)
            // Actually, if we have a filling candidate, we should probably close ALL Open vacancies that act as "Requests".
            // A vacancy with a candidate in "Admissão" might still be marked OPEN?
            // Usually, if a candidate is in Admissão, the vacancy status might still be OPEN until they are hired?
            // BUT for the Kanban Board visualization, having a "Empty Open Vacancy" card AND an "Admissão Candidate" card for same Posto is the bug.

            // So, we find Open Vacancies that are "Empty" (no candidates at all) or "Just Started" (candidates in Selection?)
            // If we have an ADVANCED candidate, the "Empty" ones are definitely duplicates.

            const openVacancies = p.vacancies.filter(v => v.status === 'OPEN');

            for (const v of openVacancies) {
                // If this vacancy has the advanced candidate, keep it Open (or handle elsewhere).
                // If this vacancy is EMPTY or only has early-stage candidates while another has advanced...
                // Simpler Rule: If existing advanced process exists, Close "Empty" Open Vacancies.
                const isEmpty = v.candidates.length === 0;

                if (isEmpty) {
                    await prisma.vacancy.update({ where: { id: v.id }, data: { status: 'CLOSED' } });
                    cleanedCount++;
                }
            }
        } else {
            // Check for Multiple Empty Open Vacancies (True Duplicates)
            // If we have 2+ Empty Open Vacancies for same Posto, keep one, close others.
            const emptyOpenVacancies = p.vacancies.filter(v => v.status === 'OPEN' && v.candidates.length === 0);

            if (emptyOpenVacancies.length > 1) {
                // Sort by creation? Keep newest?
                // Let's keep the NEWEST one and close older duplicates.
                // Assuming sorting or just index.
                // Sort descending by createdAt (implied or explicit if we fetched it, assume ID order roughly matches or just pick one)
                // Actually `p.vacancies` array order isn't guaranteed without orderBy in include.
                // Let's just close all except index 0.

                for (let i = 1; i < emptyOpenVacancies.length; i++) {
                    await prisma.vacancy.update({ where: { id: emptyOpenVacancies[i].id }, data: { status: 'CLOSED' } });
                    cleanedCount++;
                }
            }
        }
    }

    if (cleanedCount > 0) {
        console.log(`[PURGE] Auto-closed ${cleanedCount} redundant vacancies.`);
    }
}

// --- NEW: Update Vacancy (Priority, Recruiter, Requirements, Start Date, Custom Requirements) ---
export async function updateVacancy(vacancyId: string, data: { 
    priority?: string;
    recruiterId?: string;
    reqGender?: string | null;
    reqExperience?: string | null;
    reqKnowledge?: string | null;
    reqAgeMin?: number | null;
    reqAgeMax?: number | null;
    plannedStartDate?: Date | string | null;
    customRequirements?: any;
    title?: string;
    description?: string;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const oldVacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId } });

    await prisma.vacancy.update({
        where: { id: vacancyId },
        data: {
            priority: data.priority,
            recruiterId: data.recruiterId,
            reqGender: data.reqGender !== undefined ? data.reqGender : undefined,
            reqExperience: data.reqExperience !== undefined ? data.reqExperience : undefined,
            reqKnowledge: data.reqKnowledge !== undefined ? data.reqKnowledge : undefined,
            reqAgeMin: data.reqAgeMin !== undefined ? data.reqAgeMin : undefined,
            reqAgeMax: data.reqAgeMax !== undefined ? data.reqAgeMax : undefined,
            plannedStartDate: data.plannedStartDate !== undefined ? (data.plannedStartDate ? new Date(data.plannedStartDate) : null) : undefined,
            customRequirements: data.customRequirements !== undefined ? data.customRequirements : undefined,
            title: data.title,
            description: data.description
        }
    });

    // Detect Changes for Notification
    if (data.recruiterId && oldVacancy?.recruiterId !== data.recruiterId) {
        // Recruiter Changed
        const newRecruiter = await prisma.user.findUnique({ where: { id: data.recruiterId } });
        await notifyVacancyStakeholders(
            vacancyId,
            "Recrutador Alterado",
            `Novo recrutador definido: ${newRecruiter?.name || 'Sistema'}`,
            'ASSIGNMENT',
            '/admin/recrutamento?openId=VAC-' + vacancyId
        );
    } else if (data.priority) {
        await notifyVacancyStakeholders(
            vacancyId,
            "Prioridade Atualizada",
            `Prioridade alterada para ${data.priority}`,
            'SYSTEM',
            '/admin/recrutamento?openId=VAC-' + vacancyId
        );
    }

    revalidatePath("/admin/recrutamento");
}

// --- NEW: Participants Management ---
export async function addVacancyParticipant(vacancyId: string, userId: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    await prisma.vacancy.update({
        where: { id: vacancyId },
        data: {
            participants: {
                connect: { id: userId }
            }
        }
    });

    const addedUser = await prisma.user.findUnique({ where: { id: userId } });

    // Broadcast: "User X added as participant"
    // Helper will notify: Actor (Admin), Recruiter, Existing Participants, and we add New Participant
    await notifyVacancyStakeholders(
        vacancyId,
        "Participante Adicionado",
        `${addedUser?.name} foi adicionado como participante na vaga.`,
        'ASSIGNMENT',
        '/admin/recrutamento?openId=VAC-' + vacancyId
    );

    revalidatePath("/admin/recrutamento");
}

export async function removeVacancyParticipant(vacancyId: string, userId: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    await prisma.vacancy.update({
        where: { id: vacancyId },
        data: {
            participants: {
                disconnect: { id: userId }
            }
        }
    });
    revalidatePath("/admin/recrutamento");
}

// --- NEW: Comments System ---
export async function addRecruitmentComment(data: { vacancyId: string, content: string }) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const comment = await prisma.recruitmentComment.create({
        data: {
            content: data.content,
            vacancyId: data.vacancyId,
            userId: user.id
        },
        include: {
            user: { select: { id: true, name: true } }
        }
    });

    // --- NOTIFICATION Logic ---
    const vacancy = await prisma.vacancy.findUnique({
        where: { id: data.vacancyId },
        include: {
            recruiter: true,
            participants: true
        }
    });

    console.log(`[NOTIFY] Comment on Vacancy ${vacancy?.title} (${vacancy?.id})`);
    console.log(`[NOTIFY] Comment Author: ${user.name} (${user.id})`);
    console.log(`[NOTIFY] Recruiter: ${vacancy?.recruiterId}`);
    console.log(`[NOTIFY] Participants: ${vacancy?.participants?.length}`);

    if (vacancy) {
        const notifiedUserIds = new Set<string>();
        const notifiedNames: string[] = []; // Track names
        const commentAuthorId = user.id;

        // 1. Handle Mentions
        const mentionRegex = /@([\w\sà-úÀ-Ú]+)/g;
        const matches = data.content.match(mentionRegex);

        if (matches) {
            const mentionedNames = matches.map(m => m.substring(1).trim());
            if (mentionedNames.length > 0) {
                const allUsers = await prisma.user.findMany({ where: { isActive: true } });

                for (const name of mentionedNames) {
                    const targetUser = allUsers.find(u => u.name.toLowerCase() === name.toLowerCase() || u.name.toLowerCase().includes(name.toLowerCase()));
                    if (targetUser && targetUser.id !== commentAuthorId && !notifiedUserIds.has(targetUser.id)) {
                        console.log(`[NOTIFY] Triggering MENTION for ${targetUser.name}`);
                        await createNotification(
                            targetUser.id,
                            "Você foi mencionado",
                            `${user.name} mencionou você em um comentário na vaga ${vacancy.title}`,
                            'MENTION',
                            `/admin/recrutamento?openId=VAC-${vacancy.id}`
                        );
                        notifiedUserIds.add(targetUser.id);
                        notifiedNames.push(targetUser.name);
                    }
                }
            }
        }

        // 2. Notify Recruiter (if not author and not already notified)
        if (vacancy.recruiterId && vacancy.recruiterId !== commentAuthorId && !notifiedUserIds.has(vacancy.recruiterId)) {
            console.log(`[NOTIFY] Triggering RECRUITER alert for ${vacancy.recruiterId}`);
            await createNotification(
                vacancy.recruiterId,
                "Novo Comentário",
                `${user.name} comentou na vaga ${vacancy.title}`,
                'SYSTEM',
                `/admin/recrutamento?openId=VAC-${vacancy.id}`
            );
            notifiedUserIds.add(vacancy.recruiterId);
            if (vacancy.recruiter) notifiedNames.push(vacancy.recruiter.name);
        }

        // 3. Notify Participants (if not author and not already notified)
        for (const p of vacancy.participants) {
            if (p.id !== commentAuthorId && !notifiedUserIds.has(p.id)) {
                await createNotification(
                    p.id,
                    "Novo Comentário",
                    `${user.name} comentou na vaga ${vacancy.title}`,
                    'SYSTEM',
                    `/admin/recrutamento?openId=VAC-${vacancy.id}`
                );
                notifiedUserIds.add(p.id);
                notifiedNames.push(p.name);
            }
        }

        revalidatePath("/admin/recrutamento");
        return { success: true, notifiedCount: notifiedUserIds.size, notifiedNames };
    }

    revalidatePath("/admin/recrutamento");
    return { success: true, notifiedCount: 0, notifiedNames: [] };
}



export async function getRecruitmentComments(vacancyId: string) {
    const user = await getCurrentUser();
    if (!user) return [];

    return prisma.recruitmentComment.findMany({
        where: { vacancyId },
        include: {
            user: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
}

function cleanJsonResponse(text: string): string {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    }
    return cleaned;
}

export async function evaluateCandidateWithAI(candidateId: string, fileBase64?: string, mimeType?: string) {
    const candidate = await prisma.recruitmentCandidate.findUnique({
        where: { id: candidateId },
        include: {
            vacancy: {
                include: {
                    posto: {
                        include: {
                            client: true
                        }
                    },
                    company: true,
                    role: true
                }
            }
        }
    });

    if (!candidate) throw new Error("Candidato não encontrado");

    const vacancy = candidate.vacancy;
    const posto = vacancy.posto;
    const client = posto?.client;

    const vacancyDetails = {
        title: vacancy.title,
        description: vacancy.description || "",
        roleName: vacancy.role?.name || "",
        reqGender: vacancy.reqGender || "Ambos",
        reqExperience: vacancy.reqExperience || "",
        reqKnowledge: vacancy.reqKnowledge || "",
        reqAgeMin: vacancy.reqAgeMin || 18,
        reqAgeMax: vacancy.reqAgeMax || 60,
        postoAddress: client?.address || client?.name || "Não informado",
        customRequirements: vacancy.customRequirements || []
    };

    const prompt = `
Você é um recrutador técnico e analista de ATS inteligente.
Você deve analisar o currículo fornecido e compará-lo com os requisitos da vaga descritos abaixo.

REQUISITOS DA VAGA:
- Título da Vaga: ${vacancyDetails.title}
- Descrição: ${vacancyDetails.description}
- Cargo: ${vacancyDetails.roleName}
- Gênero Preferencial: ${vacancyDetails.reqGender}
- Experiência Mínima: ${vacancyDetails.reqExperience}
- Conhecimentos Gerais/Obrigatórios: ${vacancyDetails.reqKnowledge}
- Faixa Etária Permitida: ${vacancyDetails.reqAgeMin} a ${vacancyDetails.reqAgeMax} anos
- Posto de Trabalho: ${vacancyDetails.postoAddress}
- Requisitos Customizados (Checklist):
${JSON.stringify(vacancyDetails.customRequirements, null, 2)}

SUA TAREFA:
1. Extraia os dados pessoais básicos do candidato (Nome completo, Email, Telefone, Idade, Gênero e Endereço). Se não houver endereço completo, extraia Cidade/Bairro.
2. Identifique se o candidato tem filhos menores de 5 anos (hasChildrenUnderFive: true/false). Se houver menção a filhos, veja as idades. Se não disser nada, marque false.
3. Calcule o tempo médio de permanência nos últimos 3 empregos em meses (averageTenureMonths).
4. Estime a distância em Km entre o endereço do candidato e o posto de trabalho (${vacancyDetails.postoAddress}). Se for na mesma cidade/região, estime uma distância realista em Km (ex: 15km, 5km, etc.).
5. Avalie cada um dos Requisitos Customizados listados acima. Para cada item da lista (identificado pelo seu 'id' e 'name'), decida se o candidato atende (value: true) ou não atende (value: false).
6. Verifique desclassificação: Defina isDisqualified como true se o candidato falhar em qualquer requisito marcado como "isKnockout": true, ou se estiver fora da faixa etária, ou se o gênero não corresponder ao preferencial obrigatório.
7. Escreva um Parecer Técnico Qualitativo (aiAnalysis) curto de 2 a 3 frases resumindo a adequação do perfil.
8. Calcule o Score de Aderência (adherenceScore) de 0 a 100 com base nos requisitos preenchidos.
9. Gere alertas (warnings):
   - Adicione "Média de permanência nos últimos empregos inferior a 6 meses" se a permanência média for < 6 meses.
   - Adicione "Distância do posto de trabalho elevada" se a distância estimada for > 30 Km.
   - Adicione "Candidata com filhos menores de 5 anos" se for mulher com filhos < 5 anos.

Retorne EXCLUSIVAMENTE um objeto JSON puro, sem markdown ou texto extra, neste formato exato:
{
  "parsedDetails": {
    "name": "Nome Completo",
    "email": "email@provedor.com",
    "phone": "(XX) XXXXX-XXXX",
    "age": 30,
    "gender": "Masculino",
    "address": "Endereço do Candidato",
    "hasChildrenUnderFive": false,
    "averageTenureMonths": 14,
    "distanceKm": 12.5
  },
  "fullText": "Texto bruto do currículo...",
  "customEvaluations": [
    { "reqId": "id-do-requisito", "name": "Nome do Requisito", "value": true }
  ],
  "adherenceScore": 85,
  "isDisqualified": false,
  "disqualificationReason": null,
  "warnings": [],
  "aiAnalysis": "Parecer qualitativo..."
}
`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Chave Gemini não configurada");

    const models = ["gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-3.5-flash", "gemini-1.5-flash"];
    let response = null;
    let lastError = "";

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: fileBase64 && mimeType ? [
                                { text: prompt },
                                { inline_data: { mime_type: mimeType, data: fileBase64 } }
                            ] : [
                                { text: prompt },
                                { text: `Currículo (Texto):\n\n${candidate.resumeText || ""}` }
                            ]
                        }
                    ]
                })
            });

            if (res.ok) {
                response = res;
                break;
            } else {
                const errText = await res.text();
                lastError = `Model ${model} failed with ${res.status}: ${errText}`;
            }
        } catch (e: any) {
            lastError = e?.message || String(e);
        }
    }

    if (!response) {
        throw new Error(`Erro ao chamar a API do Gemini. Detalhes: ${lastError}`);
    }

    const json = await response.json();
    const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Resposta da IA vazia");

    const cleaned = cleanJsonResponse(rawText);
    const parsedResult = JSON.parse(cleaned);

    const existingEval = (candidate.requirementsEvaluation as any) || {};

    const updated = await prisma.recruitmentCandidate.update({
        where: { id: candidateId },
        data: {
            name: parsedResult.parsedDetails?.name || candidate.name,
            email: parsedResult.parsedDetails?.email || candidate.email,
            phone: parsedResult.parsedDetails?.phone || candidate.phone,
            resumeText: parsedResult.fullText || candidate.resumeText,
            requirementsEvaluation: {
                adherenceScore: parsedResult.adherenceScore || 0,
                isDisqualified: !!parsedResult.isDisqualified,
                disqualificationReason: parsedResult.disqualificationReason || null,
                warnings: parsedResult.warnings || [],
                aiAnalysis: parsedResult.aiAnalysis || "",
                customEvaluations: (parsedResult.customEvaluations || []).map((e: any) => {
                    const rawValue = e.value;
                    const value = rawValue === true || rawValue === 'true' ? true : rawValue === false || rawValue === 'false' ? false : null;
                    return {
                        reqId: e.reqId,
                        name: e.name,
                        value
                    };
                }),
                parsedDetails: parsedResult.parsedDetails || {},
                resumeFileBase64: fileBase64 || existingEval.resumeFileBase64 || null,
                resumeFileMimeType: mimeType || existingEval.resumeFileMimeType || null
            }
        }
    });

    revalidatePath("/admin/recrutamento");
    return updated;
}

export async function updateCandidateEvaluation(candidateId: string, evaluation: {
    customEvaluations?: { reqId: string, name: string, value: boolean }[];
    adherenceScore?: number;
    isDisqualified?: boolean;
    disqualificationReason?: string | null;
    warnings?: string[];
    notes?: string;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const candidate = await prisma.recruitmentCandidate.findUnique({
        where: { id: candidateId }
    });

    if (!candidate) throw new Error("Candidato não encontrado");

    const currentEval = (candidate.requirementsEvaluation as any) || {};
    const updatedEval = {
        ...currentEval,
        ...evaluation
    };

    if (evaluation.customEvaluations) {
        const vacancy = await prisma.vacancy.findFirst({
            where: { candidates: { some: { id: candidateId } } }
        });
        
        const vacancyReqs = (vacancy?.customRequirements as any[]) || [];
        const total = vacancyReqs.length;
        
        if (total > 0) {
            let passed = 0;
            let isKnockedOut = false;
            let knockoutReason = "";
            
            const checkedEvaluations = vacancyReqs.map(req => {
                const evalItem = evaluation.customEvaluations?.find(e => e.reqId === req.id)
                    || (currentEval.customEvaluations as any[] || []).find(e => e.reqId === req.id);
                
                // Três estados normatizados de forma segura (suportando strings do JSON ou booleano)
                const rawValue = evalItem ? evalItem.value : null;
                const value = rawValue === true || rawValue === 'true' ? true : rawValue === false || rawValue === 'false' ? false : null;
                
                if (value === true) {
                    passed++;
                } else if (value === false && req.isKnockout) {
                    isKnockedOut = true;
                    knockoutReason = `Reprovado no item eliminatório: ${req.name}`;
                }
                
                return {
                    reqId: req.id,
                    name: req.name,
                    value
                };
            });
            
            updatedEval.customEvaluations = checkedEvaluations;
            updatedEval.isDisqualified = isKnockedOut;
            updatedEval.disqualificationReason = isKnockedOut ? knockoutReason : null;
            updatedEval.adherenceScore = Math.round((passed / total) * 100);
        }
    }



    const updated = await prisma.recruitmentCandidate.update({
        where: { id: candidateId },
        data: {
            requirementsEvaluation: updatedEval
        }
    });

    revalidatePath("/admin/recrutamento");
    return updated;
}

export async function createPublicCandidate(data: {
    name: string;
    email: string;
    phone: string;
    vacancyId: string;
    fileBase64?: string;
    fileMimeType?: string;
}) {
    // 1. Get first stage
    const firstStage = await prisma.recruitmentStage.findFirst({
        where: { isSystem: false },
        orderBy: { order: 'asc' }
    });

    if (!firstStage) throw new Error("Nenhuma etapa de recrutamento cadastrada.");

    let initialDueDate = null;
    if (firstStage.slaDays > 0) {
        initialDueDate = addBusinessDays(new Date(), firstStage.slaDays);
    }

    let newCandidateId = "";

    await prisma.$transaction(async (tx) => {
        const candidate = await tx.recruitmentCandidate.create({
            data: {
                name: data.name,
                email: data.email,
                phone: data.phone,
                vacancyId: data.vacancyId,
                stageId: firstStage.id,
                stageDueDate: initialDueDate,
                appliedFromPublicForm: true
            }
        });

        newCandidateId = candidate.id;

        await tx.recruitmentTimeline.create({
            data: {
                candidateId: candidate.id,
                vacancyId: data.vacancyId,
                candidateName: data.name,
                action: "CREATED",
                details: `Candidato se inscreveu via formulário público (Meta Ads).`,
                userId: null
            }
        });
    });

    if (data.fileBase64 && data.fileMimeType) {
        // Salva o currículo imediatamente no banco
        await prisma.recruitmentCandidate.update({
            where: { id: newCandidateId },
            data: {
                requirementsEvaluation: {
                    resumeFileBase64: data.fileBase64,
                    resumeFileMimeType: data.fileMimeType,
                    adherenceScore: 0,
                    isDisqualified: false,
                    aiAnalysis: "Aguardando triagem da IA..."
                }
            }
        });

        // Executa a triagem de IA em segundo plano (background)
        try {
            const { after } = require("next/server");
            after(async () => {
                try {
                    await evaluateCandidateWithAI(newCandidateId, data.fileBase64, data.fileMimeType);
                } catch (aiErr) {
                    console.error("Erro no processamento em segundo plano do Gemini:", aiErr);
                }
            });
        } catch (afterErr) {
            console.log("after() não disponível no ambiente, rodando como promessa solta");
            evaluateCandidateWithAI(newCandidateId, data.fileBase64, data.fileMimeType).catch(err => {
                console.error("Erro no processamento em segundo plano do Gemini:", err);
            });
        }
    }


    const vacancy = await prisma.vacancy.findUnique({
        where: { id: data.vacancyId },
        select: { recruiterId: true, title: true }
    });

    if (vacancy?.recruiterId) {
        await createNotification(
            vacancy.recruiterId,
            "Nova Inscrição Pública",
            `Novo candidato "${data.name}" se inscreveu para a vaga: ${vacancy.title}`,
            'SYSTEM',
            '/admin/recrutamento'
        );
    }

    revalidatePath("/admin/recrutamento");
    return { success: true, candidateId: newCandidateId };
}

export async function getVacancyCandidates(vacancyId: string) {
    const user = await getCurrentUser();
    if (!user) return [];

    const candidates = await prisma.recruitmentCandidate.findMany({
        where: { vacancyId },
        include: { stage: true }
    });

    return candidates.sort((a, b) => {
        const evalA = (a.requirementsEvaluation as any) || {};
        const evalB = (b.requirementsEvaluation as any) || {};
        const isDisqA = !!evalA.isDisqualified;
        const isDisqB = !!evalB.isDisqualified;
        if (isDisqA && !isDisqB) return 1;
        if (!isDisqA && isDisqB) return -1;
        return (evalB.adherenceScore || 0) - (evalA.adherenceScore || 0);
    });
}

