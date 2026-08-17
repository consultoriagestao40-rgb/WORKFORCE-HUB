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

    const isVacationReason = reason && /férias|ferias/i.test(reason);
    const openingReason = isVacationReason ? 'FERIAS' : (reason || null);

    // Check if an OPEN vacancy already exists for this postoId to prevent duplicate cards
    const existingOpenVacancy = await prisma.vacancy.findFirst({
        where: { postoId: posto.id, status: 'OPEN' },
        orderBy: { createdAt: 'desc' }
    });

    if (existingOpenVacancy) {
        if (openingReason && existingOpenVacancy.openingReason !== openingReason) {
            await prisma.vacancy.update({
                where: { id: existingOpenVacancy.id },
                data: { openingReason }
            });
        }
        return existingOpenVacancy;
    }

    // Create vacancy inheriting requirements from the previous vacancy of the same Posto
    const vacancy = await prisma.vacancy.create({
        data: {
            title,
            description,
            postoId: posto.id,
            companyId: posto.client.company?.id || null,
            status: 'OPEN',
            priority: 'MEDIUM',
            openingReason,
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
    openingReason?: string;
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
            openingReason: data.openingReason || null,
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

    // --- PIPELINE CLEANUP & DEDUPARATION ---
    // Map legacy stage names to new official stage names
    const legacyStageMap: Record<string, string> = {
        'Triagem': 'Seleção',
        'Entrevista RH': 'Seleção',
        'Entrevista Técnica': 'Entrevista',
        'Oferta': 'Admissão (Onvio)',
        'Contratado': 'Admissão (Onvio)',
        'Admissão': 'Admissão (Onvio)',
        'Posto': 'Admitido'
    };

    for (const [oldName, newName] of Object.entries(legacyStageMap)) {
        const oldStages = await prisma.recruitmentStage.findMany({ where: { name: oldName } });
        if (oldStages.length > 0) {
            let targetStage = await prisma.recruitmentStage.findFirst({ where: { name: newName } });
            if (!targetStage) {
                targetStage = await prisma.recruitmentStage.create({ data: { name: newName, order: 1, slaDays: 3 } });
            }
            for (const oldS of oldStages) {
                if (oldS.id !== targetStage.id) {
                    await prisma.recruitmentCandidate.updateMany({
                        where: { stageId: oldS.id },
                        data: { stageId: targetStage.id }
                    });
                    await prisma.recruitmentStage.delete({ where: { id: oldS.id } }).catch(() => {});
                }
            }
        }
    }

    // Official pipeline stages in exact order
    const desiredStages = [
        { name: 'Seleção', order: 1, slaDays: 3 },
        { name: 'Entrevista', order: 2, slaDays: 5 },
        { name: 'Documentação', order: 3, slaDays: 5 },
        { name: 'Exame', order: 4, slaDays: 3 },
        { name: 'Admissão (Onvio)', order: 5, slaDays: 2 },
        { name: 'Admitido', order: 6, slaDays: 0 },
        { name: 'Cadastro de Benefícios', order: 7, slaDays: 3 },
        { name: 'Processo Concluído', order: 8, slaDays: 0 },
    ];

    for (const cfg of desiredStages) {
        const stagesWithName = await prisma.recruitmentStage.findMany({
            where: { name: cfg.name },
            orderBy: { createdAt: 'asc' }
        });

        if (stagesWithName.length === 0) {
            await prisma.recruitmentStage.create({ data: cfg });
        } else {
            const primary = stagesWithName[0];
            await prisma.recruitmentStage.update({
                where: { id: primary.id },
                data: { order: cfg.order }
            });

            // Delete duplicates and move their candidates to primary
            if (stagesWithName.length > 1) {
                for (let i = 1; i < stagesWithName.length; i++) {
                    const dup = stagesWithName[i];
                    await prisma.recruitmentCandidate.updateMany({
                        where: { stageId: dup.id },
                        data: { stageId: primary.id }
                    });
                    await prisma.recruitmentStage.delete({ where: { id: dup.id } }).catch(() => {});
                }
            }
        }
    }

    // Sync backlog gaps
    await syncBacklogGaps();

    // Auto-sync any admitted/onvio candidates to Employees and Posto allocations
    await syncAdmittedCandidatesToEmployees();

    // 1. Fetch Open Vacancies with their candidates and stages (apenas clientes ativos)
    const openVacancies = await prisma.vacancy.findMany({
        where: {
            status: 'OPEN',
            OR: [
                { posto: { client: { isActive: true } } },
                { postoId: null }
            ]
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
    const createVacancyCard = (v: typeof openVacancies[0], totalCandidates: number) => {
        const customReq = (v.customRequirements as any) || {};
        const selectedId = (typeof customReq === 'object' && !Array.isArray(customReq)) ? customReq.selectedCandidateId : null;
        const selectedCand = selectedId ? v.candidates.find(c => c.id === selectedId) : null;
        return {
            id: `VAC-${v.id}`, // Unique ID across the whole board
            realId: v.id,
            name: `${v.title} (${totalCandidates} candidato${totalCandidates !== 1 ? 's' : ''})`,
            type: 'VACANCY' as const,
            createdAt: v.createdAt,
            selectedCandidate: selectedCand ? {
                id: selectedCand.id,
                name: selectedCand.name,
                phone: selectedCand.phone,
                email: selectedCand.email,
                stageName: selectedCand.stage?.name,
                documentationStatus: selectedCand.documentationStatus,
                asoStatus: selectedCand.asoStatus,
                onvioLaunched: selectedCand.onvioLaunched
            } : null,
            vacancy: {
                id: v.id,
                title: `${v.title} (${totalCandidates} candidato${totalCandidates !== 1 ? 's' : ''})`,
                priority: v.priority,
                openingReason: (v as any).openingReason,
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
                selectedCandidateId: customReq.selectedCandidateId || null,
                candidates: v.candidates
            }
        };
    };

    // 4. Place each vacancy in exactly one stage based on the recruiter's chosen candidate
    openVacancies.forEach(v => {
        const totalCandidates = v.candidates.length;
        const customReq = (v.customRequirements as any) || {};
        
        // Se houver candidato selecionado explicitamente, usa ele
        let targetCand = customReq.selectedCandidateId ? v.candidates.find(c => c.id === customReq.selectedCandidateId) : null;
        
        // Se não houver candidato selecionado, procura o candidato na etapa mais avançada (Benefícios, Admitido, Onvio, Exame, etc.)
        if (!targetCand && v.candidates.length > 0) {
            // Ordena candidatos pela etapa mais avançada
            const sortedByStage = [...v.candidates].sort((a, b) => {
                const orderA = a.stage?.order ?? -1;
                const orderB = b.stage?.order ?? -1;
                return orderB - orderA;
            });
            targetCand = sortedByStage[0];
        }

        if (totalCandidates === 0) {
            // Sem candidatos -> fica em R&S
            stageCardsMap[rnsStageDb!.id].push(createVacancyCard(v, 0));
        } else if (targetCand && targetCand.stageId && stageCardsMap[targetCand.stageId]) {
            // Posiciona o card na coluna da etapa do candidato
            stageCardsMap[targetCand.stageId].push(createVacancyCard(v, totalCandidates));
        } else {
            // Fallback: primeira etapa padrão
            const firstStandard = standardStages[0];
            if (firstStandard && stageCardsMap[firstStandard.id]) {
                stageCardsMap[firstStandard.id].push(createVacancyCard(v, totalCandidates));
            } else {
                stageCardsMap[rnsStageDb!.id].push(createVacancyCard(v, totalCandidates));
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

    // Support Vacancy card dragging: moves the chosen candidate (or all) of that vacancy to the new stage
    if (candidateId.startsWith("VAC-")) {
        const vacancyId = candidateId.replace("VAC-", "");
        const newStage = await prisma.recruitmentStage.findUnique({ where: { id: newStageId } });
        if (!newStage) throw new Error("New stage not found");

        const vacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId } });
        const customReq = (vacancy?.customRequirements as any) || {};
        const selectedCandId = customReq.selectedCandidateId;

        const candidates = await prisma.recruitmentCandidate.findMany({
            where: { vacancyId },
            include: { stage: true }
        });

        const targetCandidates = selectedCandId
            ? candidates.filter(c => c.id === selectedCandId)
            : candidates;

        for (const cand of (targetCandidates.length > 0 ? targetCandidates : candidates)) {
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
                    details: `Movido para ${newStage.name} via Kanban da vaga.`,
                    userId: user.id
                }
            });

            if (
                newStage.order >= 5 ||
                newStage.name.toLowerCase().includes('admi') ||
                newStage.name.toLowerCase().includes('onvio') ||
                newStage.name.toLowerCase().includes('bene') ||
                newStage.name.toLowerCase().includes('conclu') ||
                newStage.name === 'Posto'
            ) {
                await syncCandidateToEmployeeAndPosto(cand.id).catch(e => console.warn("[moveCandidate] Auto-sync warning:", e));
            }
        }

        revalidatePath("/admin/recrutamento");
        revalidatePath("/admin/employees");
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

    // Auto-create/sync Employee and Posto Assignment if moved to admission or beyond
    if (
        newStage.order >= 5 ||
        newStage.name.toLowerCase().includes('admi') ||
        newStage.name.toLowerCase().includes('onvio') ||
        newStage.name.toLowerCase().includes('bene') ||
        newStage.name.toLowerCase().includes('conclu') ||
        newStage.name === 'Posto'
    ) {
        await syncCandidateToEmployeeAndPosto(candidateId).catch(e => console.warn("[moveCandidate] Single auto-sync warning:", e));
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

    const vacantPostos = await prisma.posto.findMany({
        where: {
            client: {
                name: { not: 'ROTATIVO' },
                isActive: true
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
                where: { status: 'OPEN' },
                include: {
                    candidates: {
                        include: { stage: true }
                    }
                }
            }
        }
    });

    // 2. Filter out postos that ALREADY have an OPEN vacancy in the Kanban.
    // Any posto with an open vacancy (even with 0 candidates) is already being recruited.
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
    // 0. Auto-fechar vagas abertas de clientes inativos/encerrados
    try {
        await prisma.vacancy.updateMany({
            where: {
                status: 'OPEN',
                posto: { client: { isActive: false } }
            },
            data: { status: 'CLOSED' }
        });
    } catch (e) {}

    // 1. Get all postos that currently have NO active assignment (apenas de clientes ativos)
    const vacantPostos = await prisma.posto.findMany({
        where: {
            client: { 
                name: { not: 'ROTATIVO' },
                isActive: true
            },
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

    const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash-exp"];
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
        
        const customReqs = vacancy?.customRequirements;
        const vacancyReqs: any[] = Array.isArray(customReqs)
            ? customReqs
            : (Array.isArray((customReqs as any)?.items)
                ? (customReqs as any).items
                : (Array.isArray((customReqs as any)?.requirements)
                    ? (customReqs as any).requirements
                    : []));
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
        include: {
            stage: true,
            vacancy: {
                include: {
                    posto: { include: { client: true } },
                    company: true,
                    role: true,
                }
            }
        }
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

// ==========================================
// PIPELINE STAGE ACTIONS
// ==========================================

export async function generateDocumentationLink(candidateId: string, hoursValid: number = 48) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    
    const token = `doc-${candidateId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const expiresAt = hoursValid > 0 ? new Date(Date.now() + hoursValid * 60 * 60 * 1000) : null;
    
    const existingCandidate = await prisma.recruitmentCandidate.findUnique({ where: { id: candidateId } });
    const existingExtra = (existingCandidate?.extraFields as Record<string, any>) || {};
    
    await prisma.recruitmentCandidate.update({
        where: { id: candidateId },
        data: { 
            documentationLinkToken: token, 
            documentationStatus: 'PENDING',
            extraFields: {
                ...existingExtra,
                linkExpiresAt: expiresAt?.toISOString() || null,
            }
        }
    });
    
    revalidatePath('/admin/recrutamento');
    return { token, expiresAt };
}

export async function getCandidateByDocToken(token: string) {
    const candidate = await prisma.recruitmentCandidate.findFirst({
        where: { documentationLinkToken: token },
        include: {
            vacancy: {
                include: {
                    role: true,
                    posto: { include: { client: true } }
                }
            }
        }
    });

    if (!candidate) return { error: "Link de documentação inválido ou expirado." };

    const extraFields = (candidate.extraFields as any) || {};
    if (extraFields.linkExpiresAt) {
        const expDate = new Date(extraFields.linkExpiresAt);
        if (expDate < new Date()) {
            return { error: "Este link de documentação já expirou. Solicite um novo link ao recrutador." };
        }
    }

    return { candidate };
}

export async function submitCandidatePublicDocumentation(
    token: string, 
    files: Record<string, string>,
    uniformData: { shoeSize?: string; pantsSize?: string; shirtSize?: string; pixKey?: string; email?: string }
) {
    const candidate = await prisma.recruitmentCandidate.findFirst({
        where: { documentationLinkToken: token }
    });

    if (!candidate) throw new Error("Link de documentação inválido ou expirado.");

    const existingFiles = (candidate.documentationFiles as Record<string, string>) || {};
    const mergedFiles = { ...existingFiles, ...files };

    const existingExtra = (candidate.extraFields as Record<string, any>) || {};
    const mergedExtra = { ...existingExtra, uniformData };

    await prisma.recruitmentCandidate.update({
        where: { id: candidate.id },
        data: {
            documentationFiles: mergedFiles,
            documentationStatus: 'SUBMITTED',
            email: uniformData.email || candidate.email,
            extraFields: mergedExtra
        }
    });

    await prisma.recruitmentTimeline.create({
        data: {
            candidateId: candidate.id,
            candidateName: candidate.name,
            vacancyId: candidate.vacancyId,
            action: 'PUBLIC_DOCUMENTS_SUBMITTED',
            details: `Documentos enviados via link público pelo próprio candidato: ${Object.keys(files).join(', ')}`
        }
    });

    return { success: true };
}

export async function uploadCandidateDocuments(
    candidateId: string, 
    files: Record<string, string>,
    uniformData?: { shoeSize?: string; pantsSize?: string; shirtSize?: string; pixKey?: string }
) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    
    const candidate = await prisma.recruitmentCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new Error('Candidato não encontrado');
    
    const existing = (candidate.documentationFiles as Record<string, string>) || {};
    const merged = { ...existing, ...files };
    
    const existingExtra = (candidate.extraFields as Record<string, any>) || {};
    const updatedExtra = uniformData 
        ? { ...existingExtra, uniformData: { ...(existingExtra.uniformData || {}), ...uniformData } }
        : existingExtra;

    await prisma.recruitmentCandidate.update({
        where: { id: candidateId },
        data: { 
            documentationFiles: merged,
            documentationStatus: 'SUBMITTED',
            extraFields: updatedExtra
        }
    });
    
    await prisma.recruitmentTimeline.create({
        data: {
            candidateId,
            candidateName: candidate.name,
            vacancyId: candidate.vacancyId,
            action: 'DOCUMENT_UPLOADED',
            details: `Documentos atualizados pelo recrutador: ${Object.keys(files).join(', ')}`,
            userId: user.id
        }
    });
    
    revalidatePath('/admin/recrutamento');
    return { success: true };
}

export async function extractDataFromDocumentImages(candidateId: string) {
    const candidate = await prisma.recruitmentCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new Error("Candidato não encontrado.");

    const docFiles = (candidate.documentationFiles as Record<string, string>) || {};
    const fileEntries = Object.entries(docFiles).filter(([_, val]) => val && typeof val === 'string');

    if (fileEntries.length === 0) {
        return { success: false, error: "Nenhum documento anexado para leitura." };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Chave Gemini não configurada");

    const parts: any[] = [
        {
            text: `Você é um leitor OCR especialista em extrair dados de documentos de identificação brasileiros (RG, CPF, CNH, Carteira de Trabalho CTPS, Certidões, Comprovante de Residência).
Analise as imagens enviadas dos documentos do candidato "${candidate.name}" e extraia com 100% de precisão todos os campos legíveis disponíveis.

Responda ESTRITAMENTE em formato JSON valido no seguinte schema:
{
  "cpf": "000.000.000-00",
  "rgNumero": "12.345.678-9",
  "rgOrgaoEmissor": "SSP",
  "rgUf": "PR",
  "rgDataEmissao": "YYYY-MM-DD",
  "birthDate": "YYYY-MM-DD",
  "gender": "Masculino/Feminino",
  "address": "Rua, numero, bairro, cidade - UF",
  "nomeMae": "Nome Completo da Mae",
  "nomePai": "Nome Completo do Pai",
  "ctpsNumero": "1234567",
  "ctpsSerie": "0010",
  "ctpsUf": "PR",
  "ctpsDataEmissao": "YYYY-MM-DD",
  "pisNumero": "000.00000.00-0",
  "estadoCivil": "Solteiro(a)/Casado(a)",
  "grauInstrucao": "Ensino Medio/Superior/...",
  "naturalidadeCidade": "Curitiba",
  "naturalidadeUf": "PR"
}`
        }
    ];

    for (const [key, val] of fileEntries) {
        if (val.startsWith("data:")) {
            const matches = val.match(/^data:(.+?);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const mimeType = matches[1];
                const base64Data = matches[2];
                if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
                    parts.push({
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data
                        }
                    });
                }
            }
        }
    }

    if (parts.length <= 1) {
        return { success: false, error: "Nenhum arquivo legível encontrado nos anexos." };
    }

    const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash-exp"];
    let response = null;
    let lastError = "";

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts }] })
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
        throw new Error(`Erro ao conectar com Gemini OCR: ${lastError}`);
    }

    const json = await response.json();
    const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Resposta da IA vazia");

    const cleaned = cleanJsonResponse(rawText);
    const extractedData = JSON.parse(cleaned);

    const existingExtra = (candidate.extraFields as Record<string, any>) || {};
    const mergedExtra = { ...existingExtra };
    Object.entries(extractedData).forEach(([k, v]) => {
        if (v && typeof v === 'string' && v.trim() !== '') {
            mergedExtra[k] = v;
        }
    });

    await prisma.recruitmentCandidate.update({
        where: { id: candidateId },
        data: {
            extraFields: mergedExtra,
            email: mergedExtra.email || candidate.email,
        }
    });

    revalidatePath('/admin/recrutamento');
    return { success: true, extractedData: mergedExtra };
}

export async function approveDocumentation(candidateId: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    
    // Find the Exame stage
    const exameStage = await prisma.recruitmentStage.findFirst({ where: { name: 'Exame' } });
    if (!exameStage) throw new Error('Etapa Exame não encontrada');
    
    const candidate = await prisma.recruitmentCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new Error('Candidato não encontrado');
    
    await prisma.recruitmentCandidate.update({
        where: { id: candidateId },
        data: { 
            documentationStatus: 'APPROVED',
            stageId: exameStage.id
        }
    });
    
    await prisma.recruitmentTimeline.create({
        data: {
            candidateId,
            candidateName: candidate.name,
            vacancyId: candidate.vacancyId,
            action: 'STAGE_MOVED',
            details: 'Documentação aprovada. Avançado para Exame Médico.',
            userId: user.id
        }
    });
    
    revalidatePath('/admin/recrutamento');
    return { success: true };
}

export async function uploadAsoFile(candidateId: string, fileUrl: string, asoStatus: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    
    const candidate = await prisma.recruitmentCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new Error('Candidato não encontrado');
    
    await prisma.recruitmentCandidate.update({
        where: { id: candidateId },
        data: { 
            asoFile: fileUrl,
            asoStatus 
        }
    });
    
    await prisma.recruitmentTimeline.create({
        data: {
            candidateId,
            candidateName: candidate.name,
            vacancyId: candidate.vacancyId,
            action: 'ASO_UPLOADED',
            details: `ASO enviado. Status: ${asoStatus}`,
            userId: user.id
        }
    });
    
    // If APTO, advance to Admissão (Onvio)
    if (asoStatus === 'APTO') {
        const admissaoStage = await prisma.recruitmentStage.findFirst({ where: { name: { contains: 'Onvio' } } });
        if (admissaoStage) {
            await prisma.recruitmentCandidate.update({
                where: { id: candidateId },
                data: { stageId: admissaoStage.id }
            });
            await prisma.recruitmentTimeline.create({
                data: {
                    candidateId,
                    candidateName: candidate.name,
                    vacancyId: candidate.vacancyId,
                    action: 'STAGE_MOVED',
                    details: 'ASO Apto. Avançado para Admissão (Onvio).',
                    userId: user.id
                }
            });
        }
    }
    
    revalidatePath('/admin/recrutamento');
    return { success: true };
}

function sanitizeCpf(raw?: string): { formatted: string; digits: string } {
    if (!raw) return { formatted: "", digits: "" };
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 11) {
        const formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
        return { formatted, digits };
    }
    return { formatted: raw.trim(), digits };
}

/**
 * Cria ou atualiza o Colaborador (Employee) na base oficial e realiza a alocação ativa no Posto de Trabalho.
 */
export async function syncCandidateToEmployeeAndPosto(candidateId: string, overrides?: any) {
    const user = await getCurrentUser().catch(() => null);

    const candidate = await prisma.recruitmentCandidate.findUnique({
        where: { id: candidateId },
        include: {
            stage: true,
            vacancy: {
                include: {
                    posto: {
                        include: {
                            client: true,
                            role: true,
                            assignments: {
                                where: { endDate: null }
                            }
                        }
                    },
                    role: true,
                    company: true,
                }
            }
        }
    });

    if (!candidate) {
        throw new Error(`Candidato com ID ${candidateId} não encontrado.`);
    }

    const candExtra = (candidate.extraFields as Record<string, any>) || {};
    const overrideExtra = overrides?.extraFields || {};
    const mergedExtra = { ...candExtra, ...overrideExtra, ...(overrides || {}) };

    // 1. Resolve Name
    const name = (overrides?.name || candidate.name || "").trim();
    if (!name) throw new Error("Nome do colaborador não informado.");

    // 2. Resolve CPF
    const rawCpf = (
        overrides?.cpf || 
        mergedExtra.cpf || 
        mergedExtra.cpfNumero || 
        mergedExtra.cpf_numero || 
        (candidate as any).cpf || 
        ""
    ).trim();

    const { formatted: formattedCpf, digits: digitsOnlyCpf } = sanitizeCpf(rawCpf);

    // 3. Resolve Role
    let roleId = overrides?.roleId || mergedExtra.roleId || candidate.vacancy?.posto?.roleId || candidate.vacancy?.roleId;
    if (roleId) {
        const roleExists = await prisma.role.findUnique({ where: { id: roleId } });
        if (!roleExists) roleId = null;
    }
    if (!roleId) {
        const roleName = candidate.vacancy?.role?.name || candidate.vacancy?.title || mergedExtra.cargo || "Auxiliar de Limpeza";
        const foundRole = await prisma.role.findFirst({
            where: { name: { contains: roleName, mode: "insensitive" } }
        }) || await prisma.role.findFirst();
        roleId = foundRole?.id || "";
    }

    // 4. Resolve Company
    let companyId = overrides?.companyId || mergedExtra.companyId || candidate.vacancy?.companyId || candidate.vacancy?.posto?.client?.companyId;
    if (companyId) {
        const compExists = await prisma.company.findUnique({ where: { id: companyId } });
        if (!compExists) companyId = null;
    }
    if (!companyId) {
        const defaultCompany = await prisma.company.findFirst();
        companyId = defaultCompany?.id || null;
    }

    // 4.5 Resolve Situation
    let situationId: string | null = null;
    const defaultSit = await prisma.situation.findFirst({ where: { name: { contains: "Trabalhando", mode: "insensitive" } } })
        || await prisma.situation.findFirst({ where: { name: { contains: "Normal", mode: "insensitive" } } })
        || await prisma.situation.findFirst({ where: { name: { contains: "Ativo", mode: "insensitive" } } })
        || await prisma.situation.findFirst();
    if (defaultSit) situationId = defaultSit.id;

    // 5. Resolve Posto
    let targetPostoId = overrides?.postoId || mergedExtra.postoId || candidate.vacancy?.postoId || null;
    if (!targetPostoId && candidate.vacancy?.posto?.id) {
        targetPostoId = candidate.vacancy.posto.id;
    }

    // 6. Resolve Salary & Financials
    const salary = parseFloat(
        String(overrides?.salary ?? mergedExtra.salary ?? candidate.vacancy?.posto?.baseSalary ?? (candidate.vacancy as any)?.baseSalary ?? 0)
    ) || 0;

    const insalubridade = parseFloat(String(overrides?.insalubridade ?? mergedExtra.insalubridade ?? candidate.vacancy?.posto?.insalubridade ?? 0)) || 0;
    const periculosidade = parseFloat(String(overrides?.periculosidade ?? mergedExtra.periculosidade ?? candidate.vacancy?.posto?.periculosidade ?? 0)) || 0;
    const gratificacao = parseFloat(String(overrides?.gratificacao ?? mergedExtra.gratificacao ?? candidate.vacancy?.posto?.gratificacao ?? 0)) || 0;
    const outrosAdicionais = parseFloat(String(overrides?.outrosAdicionais ?? mergedExtra.outrosAdicionais ?? candidate.vacancy?.posto?.outrosAdicionais ?? 0)) || 0;

    const valeAlimentacao = parseFloat(String(overrides?.valeAlimentacao ?? mergedExtra.valeAlimentacao ?? candidate.vacancy?.posto?.valeAlimentacao ?? 0)) || 0;
    const valeTransporte = parseFloat(String(overrides?.valeTransporte ?? mergedExtra.valeTransporte ?? candidate.vacancy?.posto?.valeTransporte ?? 0)) || 0;
    const valeTransporte2 = parseFloat(String(overrides?.valeTransporte2 ?? mergedExtra.valeTransporte2 ?? candidate.vacancy?.posto?.valeTransporte2 ?? 0)) || 0;

    const workload = parseInt(String(overrides?.workload ?? mergedExtra.workload ?? candidate.vacancy?.posto?.requiredWorkload ?? 220)) || 220;

    // 7. Resolve Dates & Personal Data
    let admissionDate: Date = new Date();
    const rawAdmDate = overrides?.admissionDate || mergedExtra.admissionDate || mergedExtra.startDate || candidate.vacancy?.plannedStartDate;
    if (rawAdmDate) {
        const parsed = new Date(rawAdmDate);
        if (!isNaN(parsed.getTime())) admissionDate = parsed;
    }

    let birthDate: Date | null = null;
    const rawBirthDate = overrides?.birthDate || mergedExtra.birthDate || mergedExtra.dataNascimento;
    if (rawBirthDate) {
        const parsed = new Date(rawBirthDate);
        if (!isNaN(parsed.getTime())) birthDate = parsed;
    }

    const email = (overrides?.email || candidate.email || mergedExtra.email || null)?.trim() || null;
    const phone = (overrides?.phone || candidate.phone || mergedExtra.phone || mergedExtra.whatsapp || null)?.trim() || null;
    const gender = (overrides?.gender || mergedExtra.gender || mergedExtra.genero || null)?.trim() || null;
    const address = (overrides?.address || mergedExtra.address || mergedExtra.endereco || null)?.trim() || null;

    // 8. Find existing employee by formatted CPF, digits-only CPF, raw CPF, or Exact Name
    const existingEmployee = await prisma.employee.findFirst({
        where: {
            OR: [
                ...(formattedCpf ? [{ cpf: formattedCpf }] : []),
                ...(digitsOnlyCpf ? [{ cpf: digitsOnlyCpf }] : []),
                ...(rawCpf ? [{ cpf: rawCpf }] : []),
                { name: { equals: name, mode: "insensitive" } }
            ]
        }
    });

    let employeeId: string;

    const employeePayload = {
        name,
        roleId: roleId || (existingEmployee?.roleId ?? ""),
        companyId: companyId || existingEmployee?.companyId,
        situationId: situationId || existingEmployee?.situationId || null,
        type: mergedExtra.type || "CLT",
        status: "Ativo",
        admissionDate,
        birthDate: birthDate || existingEmployee?.birthDate,
        gender: gender || existingEmployee?.gender,
        address: address || existingEmployee?.address,
        phone: phone || existingEmployee?.phone,
        email: email || existingEmployee?.email,
        salary,
        insalubridade,
        periculosidade,
        gratificacao,
        outrosAdicionais,
        workload,
        valeAlimentacao,
        valeTransporte,
        valeTransporte2,
        vtOptIn: mergedExtra.vtOptIn !== false,
        vtPaymentMethod: mergedExtra.vtPaymentMethod || mergedExtra.vtMeio || "Metrocard Metropolitana",
        vtPaymentMethod2: mergedExtra.vtPaymentMethod2 || "Urbs",
        vaPaymentMethod: mergedExtra.vaPaymentMethod || mergedExtra.vaTipo || "Cartão Caju",
        vtCustomPaymentDetails: mergedExtra.vtCustomPaymentDetails || null,
        vaCustomPaymentDetails: mergedExtra.vaCustomPaymentDetails || null,
        urbsSic: mergedExtra.urbsSic || mergedExtra.sic || null,
        urbsCqCtNf: mergedExtra.urbsCqCtNf || mergedExtra.cq || null,
        dependentsCount: Array.isArray(mergedExtra.dependents || mergedExtra.dependentes) 
            ? (mergedExtra.dependents || mergedExtra.dependentes).length 
            : (parseInt(mergedExtra.dependentsCount) || 0),
        extraFields: mergedExtra
    };

    if (existingEmployee) {
        const updated = await prisma.employee.update({
            where: { id: existingEmployee.id },
            data: {
                ...employeePayload,
                cpf: existingEmployee.cpf || formattedCpf || digitsOnlyCpf || rawCpf,
                dismissalReason: null,
                dismissalNotes: null,
            }
        });
        employeeId = updated.id;
    } else {
        const effectiveCpf = formattedCpf || digitsOnlyCpf || rawCpf || `TEMP-${Date.now()}`;
        const created = await prisma.employee.create({
            data: {
                ...employeePayload,
                cpf: effectiveCpf
            }
        });
        employeeId = created.id;
    }

    // 9. Posto Assignment
    if (targetPostoId && targetPostoId !== "ROTATIVO_VIRTUAL") {
        const targetPosto = await prisma.posto.findUnique({
            where: { id: targetPostoId },
            include: { client: true, role: true }
        });

        if (targetPosto) {
            const activeAssignment = await prisma.assignment.findFirst({
                where: {
                    employeeId,
                    postoId: targetPostoId,
                    endDate: null
                }
            });

            if (!activeAssignment) {
                // Fechar alocações anteriores conflitantes
                await prisma.assignment.updateMany({
                    where: {
                        employeeId,
                        endDate: null
                    },
                    data: {
                        endDate: new Date()
                    }
                });

                // Criar nova alocação ativa
                await prisma.assignment.create({
                    data: {
                        employeeId,
                        postoId: targetPostoId,
                        startDate: admissionDate,
                        endDate: null
                    }
                });

                try {
                    await prisma.log.create({
                        data: {
                            action: "ALOCACAO_AUTOMATICA",
                            details: `Colaborador ${name} admitido e alocado automaticamente ao posto "${targetPosto.client?.name || ''} - ${targetPosto.role?.name || ''}" via ATS/Recrutamento.`,
                            employeeId,
                            userId: user?.id || null
                        }
                    });
                } catch (lErr) {
                    console.warn("Log creation non-fatal:", lErr);
                }
            }
        }
    }

    // 10. Update Vacancy selection
    if (candidate.vacancyId) {
        try {
            const vacancy = await prisma.vacancy.findUnique({ where: { id: candidate.vacancyId } });
            if (vacancy) {
                const currentReqs = (vacancy.customRequirements as Record<string, any>) || {};
                await prisma.vacancy.update({
                    where: { id: candidate.vacancyId },
                    data: {
                        customRequirements: {
                            ...currentReqs,
                            selectedCandidateId: candidate.id,
                            selectedCandidateName: candidate.name,
                            admittedEmployeeId: employeeId
                        }
                    }
                });
            }
        } catch (vacErr) {
            console.warn("Vacancy update notice:", vacErr);
        }
    }

    return {
        success: true,
        employeeId,
        name,
        cpf: formattedCpf || digitsOnlyCpf || rawCpf,
        postoId: targetPostoId
    };
}

/**
 * Varre candidatos com Admissão/Onvio/Benefícios/Concluído e garante criação do Colaborador e Alocação no Posto.
 */
export async function syncAdmittedCandidatesToEmployees() {
    try {
        const candidatesToSync = await prisma.recruitmentCandidate.findMany({
            where: {
                OR: [
                    { onvioLaunched: true },
                    { benefitsCompletedAt: { not: null } },
                    { stage: { order: { gte: 5 } } },
                    { stage: { name: { contains: "Admissão", mode: "insensitive" } } },
                    { stage: { name: { contains: "Admitido", mode: "insensitive" } } },
                    { stage: { name: { contains: "Benefícios", mode: "insensitive" } } },
                    { stage: { name: { contains: "Concluído", mode: "insensitive" } } }
                ]
            },
            include: {
                stage: true,
                vacancy: {
                    include: {
                        posto: true
                    }
                }
            }
        });

        for (const cand of candidatesToSync) {
            try {
                const candExtra = (cand.extraFields as Record<string, any>) || {};
                const rawCpf = (candExtra.cpf || candExtra.cpfNumero || (cand as any).cpf || "").trim();
                const { formatted, digits } = sanitizeCpf(rawCpf);

                const emp = await prisma.employee.findFirst({
                    where: {
                        OR: [
                            ...(formatted ? [{ cpf: formatted }] : []),
                            ...(digits ? [{ cpf: digits }] : []),
                            { name: { equals: cand.name, mode: "insensitive" } }
                        ]
                    },
                    include: {
                        assignments: {
                            where: { endDate: null }
                        }
                    }
                });

                const targetPostoId = cand.vacancy?.postoId || candExtra.postoId;
                const hasCorrectAssignment = emp && targetPostoId 
                    ? emp.assignments.some(a => a.postoId === targetPostoId) 
                    : !!emp;

                if (!emp || !hasCorrectAssignment) {
                    console.log(`[Auto-Sync] Sincronizando candidato admitido para Colaborador e Posto: ${cand.name} (${cand.id})`);
                    await syncCandidateToEmployeeAndPosto(cand.id);
                }
            } catch (itemErr) {
                console.error(`[Auto-Sync] Erro ao sincronizar candidato ${cand.name}:`, itemErr);
            }
        }
    } catch (err) {
        console.error("[Auto-Sync] Falha em syncAdmittedCandidatesToEmployees:", err);
    }
}

export async function moveCandidateToStageByName(candidateId: string, stageNameKeyword: string, detailsReason?: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    
    const candidate = await prisma.recruitmentCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new Error('Candidato não encontrado');
    
    const targetStage = await prisma.recruitmentStage.findFirst({
        where: { name: { contains: stageNameKeyword, mode: 'insensitive' } }
    });
    
    if (!targetStage) throw new Error(`Etapa '${stageNameKeyword}' não encontrada`);
    
    await prisma.recruitmentCandidate.update({
        where: { id: candidateId },
        data: { stageId: targetStage.id }
    });
    
    await prisma.recruitmentTimeline.create({
        data: {
            candidateId,
            candidateName: candidate.name,
            vacancyId: candidate.vacancyId,
            action: 'STAGE_MOVED',
            details: detailsReason || `Candidato movido para ${targetStage.name}.`,
            userId: user.id
        }
    });

    // If moving to admission or onward, sync candidate to employee and posto
    if (
        targetStage.order >= 5 || 
        targetStage.name.toLowerCase().includes('admi') || 
        targetStage.name.toLowerCase().includes('onvio') ||
        targetStage.name.toLowerCase().includes('bene') ||
        targetStage.name.toLowerCase().includes('conclu')
    ) {
        await syncCandidateToEmployeeAndPosto(candidateId).catch(e => console.warn("[moveCandidateToStageByName] Sync warning:", e));
    }
    
    revalidatePath('/admin/recrutamento');
    revalidatePath('/admin/employees');
    return { success: true, stageName: targetStage.name };
}

export async function confirmOnvio(candidateId: string, customData?: any) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    
    const candidate = await prisma.recruitmentCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new Error('Candidato não encontrado');
    
    // Find Cadastro de Benefícios stage (or fallback to Admitido)
    let nextStage = await prisma.recruitmentStage.findFirst({ where: { name: { contains: 'Benefícios', mode: 'insensitive' } } });
    if (!nextStage) {
        nextStage = await prisma.recruitmentStage.findFirst({ where: { name: { contains: 'Admitido', mode: 'insensitive' } } });
    }

    if (customData?.extraFields) {
        const existingExtra = (candidate.extraFields as Record<string, any>) || {};
        await prisma.recruitmentCandidate.update({
            where: { id: candidateId },
            data: {
                extraFields: { ...existingExtra, ...customData.extraFields },
                email: customData.email || candidate.email,
                phone: customData.phone || candidate.phone
            }
        });
    }
    
    await prisma.recruitmentCandidate.update({
        where: { id: candidateId },
        data: { 
            onvioLaunched: true,
            onvioConfirmedAt: new Date(),
            ...(nextStage ? { stageId: nextStage.id } : {})
        }
    });
    
    await prisma.recruitmentTimeline.create({
        data: {
            candidateId,
            candidateName: candidate.name,
            vacancyId: candidate.vacancyId,
            action: 'STAGE_MOVED',
            details: `Onvio confirmado. Avançado para ${nextStage?.name || 'próxima etapa'}.`,
            userId: user.id
        }
    });

    // Auto-create/sync Employee and Posto Assignment
    const syncRes = await syncCandidateToEmployeeAndPosto(candidateId, customData);
    
    revalidatePath('/admin/recrutamento');
    revalidatePath('/admin/employees');
    revalidatePath('/admin');
    return { success: true, ...syncRes };
}

export async function saveBenefits(candidateId: string, benefits: { caju: boolean; metocar: boolean; urbis: boolean }) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');
    
    const candidate = await prisma.recruitmentCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new Error('Candidato não encontrado');
    
    // Find Processo Concluído stage
    const conclusaoStage = await prisma.recruitmentStage.findFirst({ where: { name: 'Processo Concluído' } });
    if (!conclusaoStage) throw new Error('Etapa Processo Concluído não encontrada');
    
    await prisma.recruitmentCandidate.update({
        where: { id: candidateId },
        data: { 
            cajuRegistered: benefits.caju,
            metocarRegistered: benefits.metocar,
            urbisRegistered: benefits.urbis,
            benefitsCompletedAt: new Date(),
            stageId: conclusaoStage.id
        }
    });
    
    await prisma.recruitmentTimeline.create({
        data: {
            candidateId,
            candidateName: candidate.name,
            vacancyId: candidate.vacancyId,
            action: 'BENEFITS_REGISTERED',
            details: `Benefícios cadastrados: CAJU=${benefits.caju}, Metocar=${benefits.metocar}, Urbis=${benefits.urbis}`,
            userId: user.id
        }
    });

    // Ensure Employee & Assignment are synced
    await syncCandidateToEmployeeAndPosto(candidateId).catch(e => console.warn("[saveBenefits] Sync warning:", e));
    
    revalidatePath('/admin/recrutamento');
    revalidatePath('/admin/employees');
    revalidatePath('/admin');
    return { success: true };
}

export async function getPublicPortalVacancies() {
    try {
        const openVacancies = await prisma.vacancy.findMany({
            where: {
                status: 'OPEN'
            },
            include: {
                role: true,
                posto: { include: { client: true } },
                company: true,
                candidates: {
                    include: { stage: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const activePortalVacancies = openVacancies.filter((v) => {
            if (v.candidates.length === 0) return true;

            const hasAdvancedCandidates = v.candidates.some((c) => {
                const stageName = c.stage?.name || "";
                const stageOrder = c.stage?.order ?? 0;
                return (
                    stageName.includes("Documentação") ||
                    stageName.includes("Exame") ||
                    stageName.includes("Admissão") ||
                    stageName.includes("Benefícios") ||
                    stageName.includes("Concluído") ||
                    stageOrder >= 3
                );
            });

            return !hasAdvancedCandidates;
        });

        return activePortalVacancies.map((v) => ({
            id: v.id,
            title: v.title,
            priority: v.priority,
            roleName: v.role?.name || "Geral",
            companyName: v.company?.name || "JVS Facilities",
            clientName: v.posto?.client?.name || "",
            location: v.posto?.client?.address || "Pernambuco, BR",
            baseSalary: v.posto?.baseSalary || 0,
            valeAlimentacao: v.posto?.valeAlimentacao || 0,
            valeTransporte: v.posto?.valeTransporte || 0,
            schedule: v.posto?.schedule ? `${v.posto.schedule} (${v.posto.startTime || ''} - ${v.posto.endTime || ''})` : "",
            plannedStartDate: v.plannedStartDate ? new Date(v.plannedStartDate).toISOString().split('T')[0] : null,
            description: v.description || "",
            reqGender: v.reqGender,
            reqExperience: v.reqExperience,
            reqKnowledge: v.reqKnowledge,
            reqAgeMin: v.reqAgeMin,
            reqAgeMax: v.reqAgeMax,
            customRequirements: v.customRequirements,
            createdAt: v.createdAt.toISOString(),
            candidateCount: v.candidates ? v.candidates.length : 0,
        }));
    } catch (error) {
        console.error("Error in getPublicPortalVacancies:", error);
        return [];
    }
}

/**
 * Recrutador escolhe explicitamente qual candidato segue no processo da vaga
 */
export async function selectCandidateForVacancy(vacancyId: string, candidateId: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autenticado");

    const vacancy = await prisma.vacancy.findUnique({
        where: { id: vacancyId },
        include: { candidates: true }
    });
    if (!vacancy) throw new Error("Vaga não encontrada");

    const candidate = await prisma.recruitmentCandidate.findUnique({
        where: { id: candidateId }
    });
    if (!candidate) throw new Error("Candidato não encontrado");

    // Salvar selectedCandidateId nos requisitos da vaga e no candidato
    const currentReqs = (vacancy.customRequirements as Record<string, any>) || {};
    const updatedReqs = {
        ...currentReqs,
        selectedCandidateId: candidateId,
        selectedCandidateName: candidate.name,
        selectedAt: new Date().toISOString(),
        selectedByUserId: user.id
    };

    await prisma.vacancy.update({
        where: { id: vacancyId },
        data: { customRequirements: updatedReqs }
    });

    // Marcar no candidato
    const candExtra = (candidate.extraFields as Record<string, any>) || {};
    await prisma.recruitmentCandidate.update({
        where: { id: candidateId },
        data: {
            extraFields: { ...candExtra, isSelectedForVacancy: true }
        }
    });

    // Registrar na linha do tempo
    await prisma.recruitmentTimeline.create({
        data: {
            candidateId,
            vacancyId,
            candidateName: candidate.name,
            action: "CANDIDATE_SELECTED",
            details: `Candidato ${candidate.name} escolhido pelo recrutador ${user.name} para seguir no processo da vaga.`,
            userId: user.id
        }
    });

    revalidatePath("/admin/recrutamento");
    return { success: true, selectedCandidateId: candidateId, selectedCandidateName: candidate.name };
}

/**
 * Avança o candidato selecionado para uma etapa específica da esteira
 */
export async function advanceCandidateToStage(candidateId: string, stageNameKeyword: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autenticado");

    const candidate = await prisma.recruitmentCandidate.findUnique({
        where: { id: candidateId },
        include: { vacancy: true }
    });
    if (!candidate) throw new Error("Candidato não encontrado");

    const targetStage = await prisma.recruitmentStage.findFirst({
        where: {
            name: { contains: stageNameKeyword, mode: "insensitive" }
        }
    });
    if (!targetStage) throw new Error(`Etapa ${stageNameKeyword} não encontrada.`);

    await prisma.recruitmentCandidate.update({
        where: { id: candidateId },
        data: {
            stageId: targetStage.id,
            stageDueDate: targetStage.slaDays > 0 ? addBusinessDays(new Date(), targetStage.slaDays) : null,
            updatedAt: new Date()
        }
    });

    await prisma.recruitmentTimeline.create({
        data: {
            candidateId,
            vacancyId: candidate.vacancyId,
            candidateName: candidate.name,
            action: "MOVED",
            details: `Avançado para a etapa "${targetStage.name}" pelo recrutador ${user.name}.`,
            userId: user.id
        }
    });

    // If moving to admission or onward, sync candidate to employee and posto
    if (
        targetStage.order >= 5 || 
        targetStage.name.toLowerCase().includes('admi') || 
        targetStage.name.toLowerCase().includes('onvio') ||
        targetStage.name.toLowerCase().includes('bene') ||
        targetStage.name.toLowerCase().includes('conclu')
    ) {
        await syncCandidateToEmployeeAndPosto(candidateId).catch(e => console.warn("[advanceCandidateToStage] Sync warning:", e));
    }

    revalidatePath("/admin/recrutamento");
    revalidatePath("/admin/employees");
    return { success: true, stageId: targetStage.id, stageName: targetStage.name };
}

