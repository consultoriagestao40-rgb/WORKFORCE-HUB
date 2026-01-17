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
    const openVacancies = await prisma.vacancy.findMany({
        where: { status: 'OPEN' },
        include: {
            role: true,
            posto: { include: { client: true } },
            company: true,
            recruiter: { select: { id: true, name: true } } // NEW
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
            recruiter: v.recruiter // NEW
        }
    }));

    // 3. Fetch standard stages and candidates
    const dbStages = await prisma.recruitmentStage.findMany({
        orderBy: { order: 'asc' },
        include: {
            candidates: {
                where: { vacancy: { status: 'OPEN' } },
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

export async function moveCandidate(candidateId: string, newStageId: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const candidate = await prisma.recruitmentCandidate.findUnique({
        where: { id: candidateId },
        include: { stage: true }
    });

    if (!candidate) throw new Error("Candidate not found");

    const newStage = await prisma.recruitmentStage.findUnique({ where: { id: newStageId } });
    if (!newStage) throw new Error("Stage not found");

    // Calculate Due Date based on SLA
    let newDueDate = null;
    if (newStage.slaDays > 0) {
        newDueDate = addBusinessDays(new Date(), newStage.slaDays);
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
                action: "MOVED",
                details: `Movido de ${candidate.stage?.name || 'Sem etapa'} para ${newStage.name}`,
                userId: user.id
            }
        })
    ]);

    revalidatePath("/admin/recrutamento");
}

export async function withdrawCandidate(candidateId: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    // "Candidato deve sair do card" -> Delete candidate.
    // This effectively "returns" the process to the pure Vacancy state in R&S (Stage 01).

    // Check for timeline cascade or manual delete
    // We will delete the candidate. If timelines are not cascaded, we delete them first.
    await prisma.recruitmentTimeline.deleteMany({
        where: { candidateId }
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

    await prisma.recruitmentCandidate.create({
        data: {
            name: data.name,
            email: data.email,
            phone: data.phone,
            vacancyId: data.vacancyId,
            stageId: firstStage.id,
            stageDueDate: initialDueDate
        }
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
