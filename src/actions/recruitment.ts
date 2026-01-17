"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { VacancyStatus } from "@prisma/client";

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

    // Ensure default stages exist
    const stagesCount = await prisma.recruitmentStage.count();
    if (stagesCount === 0) {
        await prisma.recruitmentStage.createMany({
            data: [
                { name: "Triagem", order: 1, slaDays: 2 },
                { name: "Entrevista RH", order: 2, slaDays: 3 },
                { name: "Entrevista Técnica", order: 3, slaDays: 5 },
                { name: "Oferta", order: 4, slaDays: 2 },
                { name: "Contratado", order: 5, slaDays: 0 },
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
    const candidateStages = dbStages.map(stage => ({
        ...stage,
        candidates: stage.candidates.map(c => ({
            ...c,
            type: 'CANDIDATE',
            realId: c.id
            // stageDueDate already included
        }))
    }));

    // 5. Prepend the "R&S" stage
    const rnsStage = {
        id: 'STAGE-RNS', // Special ID
        name: 'R&S (Vagas)',
        order: 0,
        isSystem: true,
        slaDays: 0,
        candidates: vacancyItems
    };

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
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + newStage.slaDays);
        newDueDate = dueDate;
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

export async function createCandidate(data: {
    name: string;
    email?: string;
    phone?: string;
    vacancyId: string;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    // Get first stage (Triagem)
    const firstStage = await prisma.recruitmentStage.findFirst({
        orderBy: { order: 'asc' }
    });

    if (!firstStage) throw new Error("No stages defined");

    // Calculate initial SLA
    let initialDueDate = null;
    if (firstStage.slaDays > 0) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + firstStage.slaDays);
        initialDueDate = dueDate;
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

    await prisma.recruitmentStage.update({
        where: { id: stageId },
        data: { slaDays }
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
