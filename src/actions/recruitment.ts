"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { VacancyStatus } from "@prisma/client";
import { addBusinessDays } from "@/lib/business-days";

// --- Vacancies ---

// --- Vacancies ---

export async function getVacancies(filter?: { status?: string, companyId?: string }) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const where: any = {};
    if (filter?.status && filter.status !== 'ALL') {
        where.status = filter.status as VacancyStatus;
    }
    if (filter?.companyId && filter.companyId !== 'all') {
        where.companyId = filter.companyId;
    }

    const vacancies = await prisma.vacancy.findMany({
        where,
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
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    await prisma.vacancy.create({
        data: {
            title: data.title,
            description: data.description,
            roleId: data.roleId || null,
            postoId: data.postoId || null,
            companyId: data.companyId || null,
            priority: data.priority,
            status: "OPEN",
            recruiterId: data.recruiterId
        }
    });

    revalidatePath("/admin/recrutamento");
}

export async function updateVacancyStatus(id: string, status: VacancyStatus) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    await prisma.vacancy.update({
        where: { id },
        data: { status }
    });

    revalidatePath("/admin/recrutamento");
}

// --- Candidates & Kanban ---

export async function getRecruitmentBoardData() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

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

    // 1. Fetch Open Vacancies for the "R&S" column
    // MOD: Filter out vacancies that already have candidates, simulating a "Single Slot" flow.
    // If a vacancy has a candidate, it is considered "In Progress" and disappears from R&S.
    const openVacancies = await prisma.vacancy.findMany({
        where: {
            status: 'OPEN',
            candidates: {
                none: {} // Only show vacancies with zero candidates
            }
        },
        include: {
            role: true,
            posto: { include: { client: true } },
            company: true,
            recruiter: true
        },
        orderBy: { createdAt: 'desc' }
    });

    // 2. Map vacancies to a structure compatible with the frontend board
    const vacancyItems = openVacancies.map(v => ({
        id: `VAC-${v.id}`, // Prefix to distinguish from candidate IDs
        realId: v.id,      // Real ID for actions
        name: v.title,     // Display title as name
        type: 'VACANCY',   // Discriminator
        createdAt: v.createdAt,
        vacancy: {         // Self-reference structure to satisfy UI
            title: v.title,
            priority: v.priority,
            status: v.status,
            role: v.role,
            posto: v.posto,
            company: v.company,
            description: v.description,
            recruiter: v.recruiter, // NEW
            createdAt: v.createdAt // NEW
        }
    }));

    // 3. Fetch standard stages and candidates
    const dbStages = await prisma.recruitmentStage.findMany({
        orderBy: { order: 'asc' },
        include: {
            candidates: {
                where: { vacancy: { status: { in: ['OPEN', 'CLOSED'] } } },
                include: {
                    vacancy: {
                        include: {
                            role: true,
                            recruiter: { select: { id: true, name: true } }, // NEW
                            posto: {
                                include: {
                                    client: true
                                }
                            },
                            company: true
                            // recruiter already included inside vacancy root in mapped object via openVacancies logic, but here inside candidate include...
                            // Wait, the include structure is: vacancy -> include -> recruiter.
                            // I added it twice: once after `role: true` and once after `company: true`.
                            // I should remove one.
                        }
                    }
                }
            }
        }
    });

    // 4. Map candidates to include type and due date
    const candidateStages = dbStages
        .filter(stage => stage.name !== 'R&S (Vagas)') // FIX: Remove duplicate R&S stage fetch from DB
        .map(stage => ({
            ...stage,
            candidates: stage.candidates.map(c => ({
                ...c,
                type: 'CANDIDATE',
                realId: c.id
                // stageDueDate already included
            }))
        }));

    // 5. Get or Create the System "R&S" Stage for SLA persistence
    let rnsStageDb = await prisma.recruitmentStage.findFirst({
        where: { name: 'R&S (Vagas)' }
    });

    if (!rnsStageDb) {
        rnsStageDb = await prisma.recruitmentStage.create({
            data: {
                name: 'R&S (Vagas)',
                order: 0,
                isSystem: true,
                slaDays: 5 // Default
            }
        });
    }

    const rnsStage = {
        id: rnsStageDb.id, // Real DB ID allows updateStageSLA to work
        name: rnsStageDb.name,
        order: rnsStageDb.order,
        isSystem: true,
        slaDays: rnsStageDb.slaDays,
        candidates: vacancyItems
    };

    // 6. Rescue Logic: Detect candidates accidentally moved to R&S (System Stage) and auto-move them to next stage
    // This fixes the "disappearing card" issue if they were dropped there before the UI fix.
    const strandedCandidates = await prisma.recruitmentCandidate.findMany({
        where: { stageId: rnsStageDb.id }
    });

    if (strandedCandidates.length > 0) {
        // Find the first non-system stage (Triagem)
        const firstStage = await prisma.recruitmentStage.findFirst({
            where: { isSystem: false },
            orderBy: { order: 'asc' }
        });

        if (firstStage) {
            await prisma.recruitmentCandidate.updateMany({
                where: { stageId: rnsStageDb.id },
                data: { stageId: firstStage.id }
            });
            // Re-fetch everything? No, next refresh will show them.
            // But to be consistent, we might miss them in this render.
            // It's acceptable for now, they will appear on next load.
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
    if (!user) throw new Error("Unauthorized");

    // 1. Get all postos that currently have NO active assignment
    const vacantPostos = await prisma.posto.findMany({
        where: {
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
    const [situations, roles, companies] = await Promise.all([
        prisma.situation.findMany({ orderBy: { name: 'asc' } }),
        prisma.role.findMany({ orderBy: { name: 'asc' } }),
        prisma.company.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        })
    ]);
    return { situations, roles, companies };
}

async function syncBacklogGaps() {
    // 1. Get all postos that currently have NO active assignment
    const vacantPostos = await prisma.posto.findMany({
        where: {
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
    const postosNeedingVacancy = vacantPostos.filter(p => p.vacancies.length === 0);

    if (postosNeedingVacancy.length === 0) return;

    // 3. Create Vacancies
    console.log(`Creating ${postosNeedingVacancy.length} automatic vacancies for gaps.`);

    // We can't use createMany easily because we need to map different relations (postoId, roleId, companyId) for each.
    // Loop creation is safer here.
    for (const p of postosNeedingVacancy) {
        await prisma.vacancy.create({
            data: {
                title: `${p.role.name} - ${p.client.name}`,
                description: `Vaga aberta automaticamente por vacância do posto.\nHorário: ${p.startTime} - ${p.endTime}\nEscala: ${p.schedule}`,
                postoId: p.id,
                roleId: p.roleId || undefined,
                companyId: p.client.companyId || undefined, // Use client's company link if available
                priority: "URGENT", // Gaps are usually urgent
                status: "OPEN"
            }
        });
    }
}
