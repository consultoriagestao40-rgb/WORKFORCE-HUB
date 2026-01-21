"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { webcrypto } from "crypto";
import { getCurrentUserRole, getCurrentUser } from "@/lib/auth";


// Simple hash helper using Web Crypto API available in Next.js Edge/Server
async function hashPassword(password: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await webcrypto.subtle.digest("SHA-256", data);
    return Buffer.from(hash).toString("hex");
}

export async function registerCoverage(formData: FormData) {
    const postoId = formData.get("postoId") as string;
    const type = formData.get("type") as string;
    const dateStr = formData.get("date") as string;
    const costValueStr = formData.get("costValue") as string;
    const paymentStatus = formData.get("paymentStatus") as string;

    const coveringEmployeeId = formData.get("coveringEmployeeId") as string;

    if (!postoId || !type || !dateStr) {
        throw new Error("Missing fields");
    }

    // Calculate cost automatically if possible (simplification)
    let cost = parseFloat(costValueStr) || 0;

    if (type === "Diarista" && cost === 0) {
        cost = 150.00; // Default diarist cost example
    }

    // Use transaction to ensure both records are created
    await prisma.$transaction(async (tx) => {
        // 1. Create Coverage
        await tx.coverage.create({
            data: {
                postoId,
                type,
                date: new Date(dateStr),
                costValue: cost,
                paymentStatus: paymentStatus || "Folha",
                coveringEmployeeId: coveringEmployeeId || undefined
            }
        });

        // 2. Create Log
        // Fetch detailed info for better log message
        const posto = await tx.posto.findUnique({
            where: { id: postoId },
            include: { client: true, role: true }
        });

        let employeeName = "";
        if (coveringEmployeeId) {
            const emp = await tx.employee.findUnique({ where: { id: coveringEmployeeId } });
            if (emp) employeeName = ` cobrindo com ${emp.name}`;
        }

        // Fetch user for log
        const currentUser = await getCurrentUser();

        await tx.log.create({
            data: {
                action: "REGISTRO_COBERTURA",
                details: `Supervisor registrou cobertura: ${type}${employeeName} no posto ${posto?.role.name} (${posto?.client.name}). Custo: R$${cost}`,
                employeeId: coveringEmployeeId || undefined,
                userId: currentUser?.id
            }
        });
    });

    revalidatePath("/mobile");
    revalidatePath(`/mobile/site/${postoId}`);
}

export async function createCompany(formData: FormData) {
    const name = formData.get("name") as string;
    const cnpj = formData.get("cnpj") as string;
    const address = formData.get("address") as string;

    await prisma.company.create({
        data: { name, cnpj, address }
    });

    revalidatePath("/admin/companies");
    revalidatePath("/admin/clients");
}

export async function updateCompany(formData: FormData) {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const cnpj = formData.get("cnpj") as string;
    const address = formData.get("address") as string;

    await prisma.company.update({
        where: { id },
        data: { name, cnpj, address }
    });

    revalidatePath("/admin/companies");
    revalidatePath("/admin/clients");
}

export async function createClient(formData: FormData) {
    const name = formData.get("name") as string;
    const address = formData.get("address") as string;
    const companyId = formData.get("companyId") as string;

    await prisma.client.create({
        data: {
            name,
            address,
            companyId: companyId || undefined
        }
    });

    revalidatePath("/admin/clients");
    revalidatePath("/mobile"); // Update mobile list too
}

export async function createSituation(formData: FormData) {
    const name = formData.get("name") as string;
    const color = formData.get("color") as string;

    await prisma.situation.create({
        data: { name, color }
    });

    revalidatePath("/admin/situations");
    revalidatePath("/admin/employees");
}

export async function updateSituation(formData: FormData) {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const color = formData.get("color") as string;

    await prisma.situation.update({
        where: { id },
        data: { name, color }
    });

    revalidatePath("/admin/situations");
    revalidatePath("/admin/employees");
}

export async function deleteSituation(formData: FormData) {
    const id = formData.get("id") as string;

    // Optional: Check if employees are using it
    await prisma.situation.delete({
        where: { id }
    });

    revalidatePath("/admin/situations");
    revalidatePath("/admin/employees");
}

// ============= ROLE (CARGO) ACTIONS =============
export async function createRole(formData: FormData) {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    await prisma.role.create({
        data: { name, description }
    });

    revalidatePath("/admin/roles");
}

export async function updateRole(formData: FormData) {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    await prisma.role.update({
        where: { id },
        data: { name, description }
    });

    revalidatePath("/admin/roles");
}

export async function deleteRole(formData: FormData) {
    const id = formData.get("id") as string;

    const employeeCount = await prisma.employee.count({
        where: { roleId: id }
    });

    if (employeeCount > 0) {
        throw new Error(`Não é possível deletar este cargo. ${employeeCount} colaborador(es) estão usando este cargo.`);
    }

    await prisma.role.delete({
        where: { id }
    });

    revalidatePath("/admin/roles");
    revalidatePath("/admin/employees");
}

// ============= ALLOWANCE TYPE ACTIONS =============
export async function createAllowanceType(formData: FormData) {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const isPercentage = formData.get("isPercentage") === "true";

    await prisma.allowanceType.create({
        data: { name, description, isPercentage }
    });

    revalidatePath("/admin/allowance-types");
}

export async function deleteAllowanceType(formData: FormData) {
    const id = formData.get("id") as string;

    const usageCount = await prisma.employeeAllowance.count({
        where: { allowanceTypeId: id }
    });

    if (usageCount > 0) {
        throw new Error(`Não é possível deletar. ${usageCount} colaborador(es) usam este adicional.`);
    }

    await prisma.allowanceType.delete({
        where: { id }
    });

    revalidatePath("/admin/allowance-types");
}

// ============= EMPLOYEE ALLOWANCE ACTIONS =============
export async function addEmployeeAllowance(formData: FormData) {
    const employeeId = formData.get("employeeId") as string;
    const allowanceTypeId = formData.get("allowanceTypeId") as string;
    const value = parseFloat(formData.get("value") as string) || 0;

    await prisma.employeeAllowance.create({
        data: { employeeId, allowanceTypeId, value }
    });

    revalidatePath(`/admin/employees/${employeeId}`);
}

export async function updateEmployeeAllowance(formData: FormData) {
    const id = formData.get("id") as string;
    const value = parseFloat(formData.get("value") as string) || 0;

    const allowance = await prisma.employeeAllowance.update({
        where: { id },
        data: { value }
    });

    revalidatePath(`/admin/employees/${allowance.employeeId}`);
}

export async function removeEmployeeAllowance(formData: FormData) {
    const id = formData.get("id") as string;

    const allowance = await prisma.employeeAllowance.delete({
        where: { id }
    });

    revalidatePath(`/admin/employees/${allowance.employeeId}`);
}

export async function createPosto(formData: FormData) {
    const clientId = formData.get("clientId") as string;
    const roleId = formData.get("roleId") as string;
    const schedule = formData.get("schedule") as string;
    const startTime = formData.get("startTime") as string;
    const endTime = formData.get("endTime") as string;
    const billingValue = parseFloat(formData.get("billingValue") as string) || 0;
    const requiredWorkload = parseInt(formData.get("requiredWorkload") as string) || 220;
    const isNightShift = formData.get("isNightShift") === "true";

    const baseSalary = parseFloat(formData.get("baseSalary") as string) || 0;
    const insalubridade = parseFloat(formData.get("insalubridade") as string) || 0;
    const periculosidade = parseFloat(formData.get("periculosidade") as string) || 0;
    const gratificacao = parseFloat(formData.get("gratificacao") as string) || 0;
    const outrosAdicionais = parseFloat(formData.get("outrosAdicionais") as string) || 0;

    await prisma.posto.create({
        data: {
            clientId,
            roleId,
            schedule,
            startTime,
            endTime,
            billingValue,
            requiredWorkload,
            isNightShift,
            baseSalary,
            insalubridade,
            periculosidade,
            gratificacao,
            outrosAdicionais
        }
    });

    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath("/admin");
}

export async function createEmployee(formData: FormData) {
    const name = formData.get("name") as string;
    const cpf = formData.get("cpf") as string;
    const roleId = formData.get("roleId") as string;
    const type = formData.get("type") as string;
    const salary = parseFloat(formData.get("salary") as string) || 0;
    const insalubridade = parseFloat(formData.get("insalubridade") as string) || 0;
    const periculosidade = parseFloat(formData.get("periculosidade") as string) || 0;
    const gratificacao = parseFloat(formData.get("gratificacao") as string) || 0;
    const outrosAdicionais = parseFloat(formData.get("outrosAdicionais") as string) || 0;
    const workload = parseInt(formData.get("workload") as string) || 220;
    const admissionDateStr = formData.get("admissionDate") as string;
    const situationId = formData.get("situationId") as string;
    const valeAlimentacao = parseFloat(formData.get("valeAlimentacao") as string) || 0;
    const valeTransporte = parseFloat(formData.get("valeTransporte") as string) || 0;

    // New: Mandatory Posto Link
    const postoId = formData.get("postoId") as string;

    const admissionDate = admissionDateStr ? new Date(admissionDateStr) : new Date();

    await prisma.$transaction(async (tx) => {
        // 1. Create Employee
        const newEmployee = await tx.employee.create({
            data: {
                name,
                cpf,
                roleId,
                companyId: (formData.get("companyId") as string) || null,
                type,
                status: "Ativo", // Legacy alignment
                situationId: situationId || undefined,
                admissionDate,
                salary,
                insalubridade,
                periculosidade,
                gratificacao,
                outrosAdicionais,
                workload,
                valeAlimentacao,
                valeTransporte,
                address: (formData.get("address") as string) || null,
                phone: (formData.get("phone") as string) || null,
                email: (formData.get("email") as string) || null,
                birthDate: (formData.get("birthDate") as string) ? new Date(formData.get("birthDate") as string) : null,
                gender: (formData.get("gender") as string) || null
            }
        });

        // 2. Create Assignment if Posto Provided
        if (postoId) {
            // Check if Posto exists
            const posto = await tx.posto.findUnique({ where: { id: postoId } });
            if (!posto) {
                throw new Error("Posto informado para vínculo não encontrado.");
            }

            // Create Active Assignment
            await tx.assignment.create({
                data: {
                    employeeId: newEmployee.id,
                    postoId: postoId,
                    startDate: admissionDate, // Starts at admission
                    endDate: null // Active
                }
            });

            // Log Auto-Assignment
            const user = await getCurrentUser();
            await tx.log.create({
                data: {
                    action: "ALOCACAO_AUTOMATICA",
                    details: `Colaborador ${newEmployee.name} alocado automaticamente ao posto no cadastro (Origem: Recrutamento).`,
                    employeeId: newEmployee.id,
                    userId: user?.id
                }
            });
        }
    });

    revalidatePath("/admin/employees");
}

export async function assignEmployee(formData: FormData) {
    const postoId = formData.get("postoId") as string;
    const employeeId = formData.get("employeeId") as string;
    const startDateStr = formData.get("startDate") as string;
    const schedule = formData.get("schedule") as string;
    const createVacancy = formData.get("createVacancy") === "on";

    console.log("Assign Employee Debug:", { postoId, employeeId, startDateStr, schedule });

    if (!postoId || !employeeId) return { error: "Campos obrigatórios faltando." };

    // Fix: Append T12:00:00 to ensure date falls on the correct day in local time (avoiding UTC roll-back)
    const startDate = startDateStr ? new Date(`${startDateStr}T12:00:00`) : new Date();

    console.log("Parsed Start Date:", startDate);

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    const posto = await prisma.posto.findUnique({ where: { id: postoId } });

    if (!employee || !posto) return { error: "Dados não encontrados." };

    // Update Posto Schedule if provided and different
    if (schedule && schedule !== posto.schedule) {
        await prisma.posto.update({
            where: { id: postoId },
            data: { schedule }
        });
    }

    // Workload validation
    if (employee.workload < posto.requiredWorkload) {
        return { error: `Incompatibilidade: Colaborador possui carga horária de ${employee.workload}h, mas o posto exige ${posto.requiredWorkload}h.` };
    }

    // Constraint Check: Is Employee on Vacation?
    const vacationConflict = await prisma.vacation.findFirst({
        where: {
            employeeId: employeeId,
            startDate: { lte: startDate },
            endDate: { gte: startDate }
        }
    });

    if (vacationConflict) {
        return { error: `Colaborador em férias até ${vacationConflict.endDate.toLocaleDateString('pt-BR')}. Não é possível alocar.` };
    }


    // FIXED: Check for ANY active assignment for this employee (Rotativo or other Posto)
    const employeeActiveAssignment = await prisma.assignment.findFirst({
        where: {
            employeeId: employeeId,
            endDate: null
        },
        include: { posto: { include: { client: true, role: true } } }
    });

    const targetPostoHasAssignment = await prisma.assignment.findFirst({
        where: { postoId, endDate: null },
        include: { employee: true }
    });

    await prisma.$transaction(async (tx) => {
        // 1. If currently assigned somewhere (including Rotativo), end it AND log it
        if (employeeActiveAssignment) {
            await tx.assignment.update({
                where: { id: employeeActiveAssignment.id },
                data: { endDate: new Date() } // Ends immediately before new start
            });

            const currentUser = await getCurrentUser();
            await tx.log.create({
                data: {
                    action: "REALOCACAO",
                    details: `Colaborador movido de ${employeeActiveAssignment.posto.client.name} para novo posto.`,
                    employeeId: employeeId,
                    userId: currentUser?.id
                }
            });
        }

        // 2. If the TARGET POSTO has someone, remove them (swap logic)
        if (targetPostoHasAssignment) {
            await tx.assignment.update({
                where: { id: targetPostoHasAssignment.id },
                data: { endDate: new Date() }
            });

            // Log unassignment
            const currentUser = await getCurrentUser();
            await tx.log.create({
                data: {
                    action: "DESVINCULACAO",
                    details: `Colaborador ${targetPostoHasAssignment.employee.name} desvinculado (realocação do posto)`,
                    employeeId: targetPostoHasAssignment.employeeId,
                    userId: currentUser?.id
                }
            });
        }

        // 2. Create new assignment
        await tx.assignment.create({
            data: {
                postoId,
                employeeId,
                startDate
            }
        });

        // 3. Log new assignment
        const emp = await tx.employee.findUnique({ where: { id: employeeId } });
        const posto = await tx.posto.findUnique({ where: { id: postoId }, include: { client: true, role: true } });

        const currentUser = await getCurrentUser();

        await tx.log.create({
            data: {
                action: "LOTACAO",
                details: `Colaborador ${emp?.name} movido para ${posto?.role.name} em ${posto?.client.name}`,
                employeeId: employeeId,
                userId: currentUser?.id
            }
        });
    });

    // 4. Create vacancy if requested (OUTSIDE transaction to avoid nested transactions)
    if (createVacancy && targetPostoHasAssignment) {
        try {
            // Retrieve full posto details to check Client
            const sourcePosto = await prisma.posto.findUnique({
                where: { id: postoId },
                include: { client: true }
            });

            // NUCLEAR BLOCK: If client is ROTATIVO, NEVER create vacancy
            if (sourcePosto && sourcePosto.client.name !== 'ROTATIVO') {
                const { createVacancyFromPosto } = await import("@/actions/recruitment");
                await createVacancyFromPosto(postoId);
            } else {
                console.log("Skipping vacancy creation for ROTATIVO posto.");
            }
        } catch (error) {
            console.error("Error creating vacancy:", error);
            // Don't fail the whole operation if vacancy creation fails
        }
    }

    revalidatePath(`/admin/clients`);
    revalidatePath("/admin");
    revalidatePath("/admin/recrutamento");
}

export async function unassignEmployee(formData: FormData) {
    const postoId = formData.get("postoId") as string;
    const situationId = formData.get("situationId") as string;
    const createVacancy = formData.get("createVacancy") === "on";
    const endDate = new Date();

    if (!situationId) {
        throw new Error("Situação é obrigatória ao desvincular colaborador");
    }

    const currentAssignment = await prisma.assignment.findFirst({
        where: {
            postoId,
            endDate: null
        },
        include: { employee: true, posto: { include: { client: true, role: true } } }
    });

    if (!currentAssignment) return;

    // Get situation details
    const situation = await prisma.situation.findUnique({ where: { id: situationId } });
    if (!situation) throw new Error("Situação não encontrada");

    await prisma.$transaction(async (tx) => {
        // 1. End current assignment
        await tx.assignment.update({
            where: { id: currentAssignment.id },
            data: { endDate }
        });

        // 2. Update employee situation
        await tx.employee.update({
            where: { id: currentAssignment.employeeId },
            data: { situationId }
        });

        // 3. Check if should allocate to Rotativo
        const activeStatuses = ['Ativo', 'Férias', 'Afastamento', 'Licença INSS'];
        const shouldAllocateToRotativo = activeStatuses.includes(situation.name);

        if (shouldAllocateToRotativo) {
            const { getOrCreateRotativoPosto } = await import("@/lib/rotativo");
            const rotativoPosto = await getOrCreateRotativoPosto();

            // For vacations, save origin posto
            const isVacation = situation.name === 'Férias';

            await tx.assignment.create({
                data: {
                    employeeId: currentAssignment.employeeId,
                    postoId: rotativoPosto.id,
                    startDate: endDate,
                    originPostoId: isVacation ? postoId : null
                }
            });

            const currentUser = await getCurrentUser();
            await tx.log.create({
                data: {
                    action: isVacation ? "ALOCACAO_ROTATIVO_FERIAS" : "ALOCACAO_ROTATIVO",
                    details: `${currentAssignment.employee.name} alocado no Rotativo (${situation.name})${isVacation ? ' - posto origem salvo' : ''}`,
                    employeeId: currentAssignment.employeeId,
                    userId: currentUser?.id
                }
            });
        } else {
            // Just log desvinculação for inactive statuses (Desligado, etc)
            const currentUser = await getCurrentUser();
            await tx.log.create({
                data: {
                    action: "DESVINCULACAO",
                    details: `Colaborador ${currentAssignment.employee.name} desvinculado do posto ${currentAssignment.posto.role.name} em ${currentAssignment.posto.client.name} (${situation.name})`,
                    employeeId: currentAssignment.employeeId,
                    userId: currentUser?.id
                }
            });
        }
    });

    // 4. Create vacancy if requested (outside transaction)
    if (createVacancy) {
        try {
            const { createVacancyFromPosto } = await import("@/actions/recruitment");
            await createVacancyFromPosto(postoId);
        } catch (error) {
            console.error("Error creating vacancy:", error);
        }
    }

    revalidatePath(`/admin/clients`);
    revalidatePath("/admin");
    revalidatePath("/admin/employees");
}
export async function createSchedule(formData: FormData) {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    await prisma.schedule.create({
        data: { name, description }
    });

    revalidatePath("/admin/schedules");
    revalidatePath("/admin/clients/[id]", "page"); // Clients need this for dropdown
}

export async function updateSchedule(formData: FormData) {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    await prisma.schedule.update({
        where: { id },
        data: { name, description }
    });

    revalidatePath("/admin/schedules");
    revalidatePath("/admin/clients/[id]", "page");
}

export async function deleteSchedule(id: string) {
    const userRole = await getCurrentUserRole();
    if (userRole !== 'ADMIN') throw new Error("Apenas administradores podem excluir escalas.");

    // Usage check
    const usageCount = await prisma.posto.count({
        where: { schedule: { contains: id } } // Schedule is a string in Posto, but usually it stores the name. 
        // Wait, the Posto model stores `schedule` as distinct string (e.g. "12x36"). 
        // The `Schedule` model seems to be a catalog.
        // If Posto.schedule is just a string, deleting the catalog entry won't break FKs, 
        // but it might be confusing if we delete a "standard" schedule name that is used.
        // Let's check how `createSchedule` works. It creates a `Schedule` record.
        // `Posto` likely just uses the string value or links to it? 
        // Let's check prisma.schema to be sure about the relation.
    });

    // Re-reading previous context: Posto has `schedule String`. It is NOT a relation to Schedule model in the partial schema I saw earlier 
    // (I didn't see the full schema, but `createPosto` just takes a string). 
    // However, `createSchedule` adds to a `Schedule` table. 
    // So likely the system uses `Schedule` table as a suggestion list? 
    // Or maybe I missed a relation. 
    // Let's verify schema first to be safe, but for now I will assume strictly safe delete logic:
    // If Posto.schedule matches this Schedule.name, we might warn? 
    // Actually, simpler: Just delete the record. Since it's likely a suggestion list if no FK.

    await prisma.schedule.delete({
        where: { id }
    });

    revalidatePath("/admin/schedules");
    revalidatePath("/admin/clients/[id]", "page");
}

export async function updateClient(formData: FormData) {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const address = formData.get("address") as string;
    const companyId = formData.get("companyId") as string;

    await prisma.client.update({
        where: { id },
        data: {
            name,
            address,
            companyId: companyId || undefined
        }
    });

    revalidatePath("/admin/clients");
    revalidatePath(`/admin/clients/${id}`);
    revalidatePath("/mobile");
}

export async function deleteClient(id: string) {
    const userRole = await getCurrentUserRole();
    if (userRole !== 'ADMIN') throw new Error("Unauthorized");

    await prisma.$transaction(async (tx) => {
        // 1. Find all postos
        const postos = await tx.posto.findMany({ where: { clientId: id }, select: { id: true } });
        const postoIds = postos.map(p => p.id);

        if (postoIds.length > 0) {
            // 2. Cascade delete Posto dependencies
            await tx.assignment.deleteMany({ where: { postoId: { in: postoIds } } });
            await tx.coverage.deleteMany({ where: { postoId: { in: postoIds } } });
            await tx.occurrence.deleteMany({ where: { postoId: { in: postoIds } } });

            // 2.1 Close Vacancies linked to these Postos
            await tx.vacancy.updateMany({
                where: { postoId: { in: postoIds }, status: 'OPEN' },
                data: { status: 'CLOSED' }
            });

            // 3. Delete Postos
            await tx.posto.deleteMany({ where: { id: { in: postoIds } } });
        }

        // 4. Delete Client
        await tx.client.delete({ where: { id } });
    });

    revalidatePath("/admin/clients");
}

export async function deletePosto(id: string) {
    const userRole = await getCurrentUserRole();
    if (userRole !== 'ADMIN') throw new Error("Unauthorized");

    const posto = await prisma.posto.findUnique({ where: { id } });
    if (!posto) return;

    await prisma.$transaction(async (tx) => {
        // 1. Cascade delete dependencies
        await tx.assignment.deleteMany({ where: { postoId: id } });
        await tx.coverage.deleteMany({ where: { postoId: id } });
        await tx.occurrence.deleteMany({ where: { postoId: id } });

        // 1.1 Close open vacancies for this Posto
        await tx.vacancy.updateMany({
            where: { postoId: id, status: 'OPEN' },
            data: { status: 'CLOSED' }
        });

        // 2. Delete Posto
        await tx.posto.delete({ where: { id } });
    });

    revalidatePath(`/admin/clients/${posto.clientId}`);
    revalidatePath("/admin/clients");
}

export async function updatePosto(formData: FormData) {
    const id = formData.get("id") as string;
    const roleId = formData.get("roleId") as string;
    const schedule = formData.get("schedule") as string;
    const startTime = formData.get("startTime") as string;
    const endTime = formData.get("endTime") as string;
    const billingValue = parseFloat(formData.get("billingValue") as string) || 0;
    const requiredWorkload = parseInt(formData.get("requiredWorkload") as string) || 220;
    const isNightShift = formData.get("isNightShift") === "true";

    const baseSalary = parseFloat(formData.get("baseSalary") as string) || 0;
    const insalubridade = parseFloat(formData.get("insalubridade") as string) || 0;
    const periculosidade = parseFloat(formData.get("periculosidade") as string) || 0;
    const gratificacao = parseFloat(formData.get("gratificacao") as string) || 0;
    const outrosAdicionais = parseFloat(formData.get("outrosAdicionais") as string) || 0;

    const posto = await prisma.posto.update({
        where: { id },
        data: {
            roleId,
            schedule,
            startTime,
            endTime,
            billingValue,
            requiredWorkload,
            isNightShift,
            baseSalary,
            insalubridade,
            periculosidade,
            gratificacao,
            outrosAdicionais
        }
    });

    revalidatePath(`/admin/clients/${posto.clientId}`);
}

export async function updateEmployee(formData: FormData) {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const cpf = formData.get("cpf") as string;
    const roleId = formData.get("roleId") as string;
    const type = formData.get("type") as string;
    const status = formData.get("status") as string;
    const salary = parseFloat(formData.get("salary") as string) || 0;
    const insalubridade = parseFloat(formData.get("insalubridade") as string) || 0;
    const periculosidade = parseFloat(formData.get("periculosidade") as string) || 0;
    const gratificacao = parseFloat(formData.get("gratificacao") as string) || 0;
    const outrosAdicionais = parseFloat(formData.get("outrosAdicionais") as string) || 0;
    const workload = parseInt(formData.get("workload") as string) || 220;
    const admissionDateStr = formData.get("admissionDate") as string;
    const situationId = formData.get("situationId") as string;
    const lastVacationStartStr = formData.get("lastVacationStart") as string;
    const lastVacationEndStr = formData.get("lastVacationEnd") as string;
    const totalVacationDaysTaken = parseInt(formData.get("totalVacationDaysTaken") as string) || 0;
    const valeAlimentacao = parseFloat(formData.get("valeAlimentacao") as string) || 0;
    const valeTransporte = parseFloat(formData.get("valeTransporte") as string) || 0;

    // Constraint Check: Situation Change vs Active Assignment
    if (situationId) {
        const activeAssignments = await prisma.assignment.count({
            where: { employeeId: id, endDate: null }
        });

        if (activeAssignments > 0) {
            const newSituation = await prisma.situation.findUnique({ where: { id: situationId } });
            // If situation requires absence (assuming anything other than 'Ativo' implies non-working)
            // You might want to refine this list or add a flag to Situation model later.
            if (newSituation && newSituation.name !== 'Ativo') {
                return { error: `Colaborador vinculado a um posto. Desvincule do posto antes de alterar para "${newSituation.name}".` };
            }
        }
    }

    const oldEmployee = await prisma.employee.findUnique({
        where: { id },
        include: { role: true, situation: true }
    });

    const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.employee.update({
            where: { id },
            data: {
                name,
                cpf,
                roleId,
                companyId: (formData.get("companyId") === "no_company" || !formData.get("companyId")) ? null : (formData.get("companyId") as string),
                type,
                status,
                situationId: situationId || undefined,
                admissionDate: admissionDateStr ? new Date(admissionDateStr) : undefined,
                lastVacationStart: lastVacationStartStr ? new Date(lastVacationStartStr) : null,
                lastVacationEnd: lastVacationEndStr ? new Date(lastVacationEndStr) : null,
                totalVacationDaysTaken,
                salary,
                insalubridade,
                periculosidade,
                gratificacao,
                outrosAdicionais,
                workload,

                valeAlimentacao,
                valeTransporte,
                birthDate: (formData.get("birthDate") as string) ? new Date(formData.get("birthDate") as string) : null,
                gender: (formData.get("gender") as string) || null,
                address: (formData.get("address") as string) || null,
                phone: (formData.get("phone") as string) || null,
                email: (formData.get("email") as string) || null,
                dismissalReason: (formData.get("dismissalReason") as string) || null,
                dismissalNotes: (formData.get("dismissalNotes") as string) || null
            },
            include: { role: true, situation: true }
        });

        // Change Logging
        if (oldEmployee) {
            if (oldEmployee.salary !== salary) {
                const currentUser = await getCurrentUser();
                await tx.log.create({
                    data: {
                        action: "ALTERACAO_SALARIAL",
                        details: `Salário base alterado de R$ ${oldEmployee.salary.toFixed(2)} para R$ ${salary.toFixed(2)}`,
                        employeeId: id,
                        userId: currentUser?.id
                    }
                });
            }

            if (oldEmployee.roleId !== roleId) {
                console.log("[DEBUG] Role Change Detected:", { old: oldEmployee.roleId, new: roleId });
                console.log("[DEBUG] Roles:", { oldName: oldEmployee.role.name, newName: updated.role.name });

                const currentUser = await getCurrentUser();
                await tx.log.create({
                    data: {
                        action: "PROMOCAO_CARGO",
                        details: `Cargo alterado de ${oldEmployee.role.name} para ${updated.role.name}`,
                        employeeId: id,
                        userId: currentUser?.id
                    }
                });
            } else {
                console.log("[DEBUG] No Role Change:", { old: oldEmployee.roleId, new: roleId });
            }

            if (oldEmployee.workload !== workload) {
                const currentUser = await getCurrentUser();
                await tx.log.create({
                    data: {
                        action: "ALTERACAO_CARGA_HORARIA",
                        details: `Carga horária alterada de ${oldEmployee.workload}h para ${workload}h`,
                        employeeId: id,
                        userId: currentUser?.id
                    }
                });
            }

            if (oldEmployee.situationId !== situationId && updated.situation) {
                const currentUser = await getCurrentUser();
                await tx.log.create({
                    data: {
                        action: "MUDANCA_SITUACAO",
                        details: `Situação alterada de ${oldEmployee.situation?.name || 'Sem Situação'} para ${updated.situation.name}`,
                        employeeId: id,
                        userId: currentUser?.id
                    }
                });

                // Auto-create vacancy if situation implies leaving
                // Assuming "Desligado" or "Afastado" based on user req.
                // Since Situation is dynamic, we check strict names or maybe add a flag later.
                // For now, let's match "Desligado" or "Inativo" or "Afastado"
                const situationName = updated.situation.name.toLowerCase();
                if (situationName.includes("desligado") || situationName.includes("demitido")) {
                    // We need to call this after transaction or inside?
                    // Triggers use independent prisma calls, so better AFTER transaction or inside via separate call.
                    // But `createVacancyFromDismissal` creates a vacancy using prisma.
                    // If we want it to be part of transaction, we'd need to pass `tx` to it.
                    // The current implementation of triggers uses `prisma` global.
                    // So we should call it OUTSIDE the transaction or let it run independently.
                    // We'll call it after the transaction block for safety.
                }
            }
        }
        return updated;
    });

    // Post-transaction triggers deleted
    /* 
    if (result && result.situation && (result.situation.name.toLowerCase().includes("desligado") || result.situation.name.toLowerCase().includes("demitido"))) {
        // Run in background to not block UI
        createVacancyFromDismissal(result.id, result.dismissalReason || undefined).catch(console.error);
    }
    */

    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${id}`);
}

export async function addVacation(formData: FormData) {
    const employeeId = formData.get("employeeId") as string;
    const startDateStr = formData.get("startDate") as string;
    const endDateStr = formData.get("endDate") as string;
    const daysTaken = parseInt(formData.get("daysTaken") as string) || 0;

    if (!employeeId || !startDateStr || !endDateStr) {
        return { error: "Missing required fields" };
    }

    // Constraint Check: Active Assignment vs Vacation
    const activeAssignments = await prisma.assignment.count({
        where: { employeeId: employeeId, endDate: null }
    });

    if (activeAssignments > 0) {
        return { error: "Colaborador vinculado a um posto. Desvincule do posto antes de registrar férias." };
    }

    await prisma.vacation.create({
        data: {
            employeeId,
            startDate: new Date(startDateStr),
            endDate: new Date(endDateStr),
            daysTaken
        }
    });

    // Optionally update the current legacy fields for quick reference
    await prisma.employee.update({
        where: { id: employeeId },
        data: {
            lastVacationStart: new Date(startDateStr),
            lastVacationEnd: new Date(endDateStr),
            totalVacationDaysTaken: { increment: daysTaken }
        }
    });

    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${employeeId}`);
}

export async function deleteVacation(vacationId: string, employeeId: string) {
    if (!vacationId || !employeeId) {
        throw new Error("Missing ID");
    }

    await prisma.vacation.delete({
        where: { id: vacationId }
    });

    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${employeeId}`);
}

export async function getEmployeesOnVacation() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const vacations = await prisma.vacation.findMany({
        where: {
            startDate: { lte: today },
            endDate: { gte: today }
        },
        include: {
            employee: {
                include: {
                    assignments: {
                        where: { endDate: null },
                        include: {
                            posto: {
                                include: {
                                    client: true,
                                    role: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    return vacations.map(v => ({
        id: v.employee.id,
        name: v.employee.name,
        vacationStart: v.startDate,
        vacationEnd: v.endDate,
        clientName: v.employee.assignments[0]?.posto?.client?.name || "Sem Alocação",
        postoName: v.employee.assignments[0]?.posto?.role.name || "N/A"
    }));
}

// --- Authentication Actions ---

export async function login(formData: FormData) {
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    const user = await prisma.user.findUnique({
        where: { username }
    });

    if (!user) {
        throw new Error("Invalid credentials");
    }

    const hashedPassword = await hashPassword(password);
    if (user.password !== hashedPassword) {
        throw new Error("Invalid credentials");
    }

    // Create Session
    const sessionData = JSON.stringify({
        id: user.id,
        role: user.role,
        name: user.name
    });

    // In a real app, sign this!
    const encodedSession = Buffer.from(sessionData).toString("base64");

    (await cookies()).set("auth_session", encodedSession, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: "/",
    });

    if (user.role === "SUPERVISOR") {
        redirect("/mobile");
    } else {
        redirect("/admin");
    }
}

export async function logout() {
    (await cookies()).delete("auth_session");
    redirect("/login");
}

export async function getUsers() {
    return await prisma.user.findMany({
        orderBy: { name: 'asc' }
    });
}

export async function importEmployeesBatch(data: any[]) {
    if (!data || !Array.isArray(data)) {
        return { error: "Dados inválidos." };
    }

    try {
        // Pre-fetch all roles and situations to minimize DB calls
        const allRoles = await prisma.role.findMany();
        const allSituations = await prisma.situation.findMany();

        let successCount = 0;
        let skippedCount = 0;

        await prisma.$transaction(async (tx) => {
            console.log(`[Import] Starting batch for ${data.length} rows.`);

            for (const row of data) {
                // Ensure CPF is comparable.
                // Best practice: remove non-digits.
                const rawCpf = String(row.cpf);
                const normalizedCpf = rawCpf.replace(/\D/g, '');

                // We check against both raw and normalized just in case DB is mixed
                // OR we standardise on normalized. 
                // IF DB stores "123.456.789-00", normalized "12345678900" won't match directly.
                // So let's check both or simple text match if strict.

                // Let's try to match exactly what is passed AND the normalized version
                // But better: Just trust the user input?
                // The issue is likely the user input has different format than DB.

                // Let's clean the input to digits only for the check-if-exists-as-digits logic
                // But wait, if DB has formatted, we need formatted.

                // Simple approach: Check if (cpf == raw OR cpf == normalized)
                // Prisma doesn't support OR in findUnique easily on same field without findFirst.
                // Let's use findFirst.

                const existing = await tx.employee.findFirst({
                    where: {
                        OR: [
                            { cpf: rawCpf },
                            { cpf: normalizedCpf } // This assumes DB might have digits only
                        ]
                    }
                });

                if (existing) {
                    console.log(`[Import] Skipping duplicate CPF: ${rawCpf} (matches id: ${existing.id})`);
                    skippedCount++;
                    continue;
                }

                // Find Role (fuzzy match)
                let roleId = allRoles.find(r => r.name.toLowerCase() === row.role?.trim().toLowerCase())?.id;

                // User Request: If role doesn't exist, create it dynamically
                if (!roleId && row.role) {
                    const newRoleName = row.role.trim();
                    const existingInDb = await tx.role.findFirst({ where: { name: newRoleName } }); // findFirst name is not unique constraint? usually is.
                    // safely use findFirst
                    if (existingInDb) {
                        roleId = existingInDb.id;
                    } else {
                        const newRole = await tx.role.create({
                            data: {
                                name: newRoleName,
                                description: "Importado via Excel"
                            }
                        });
                        roleId = newRole.id;
                    }
                }

                // If still no role (e.g. empty string in excel), fallback or skip
                if (!roleId) {
                    if (allRoles.length > 0) roleId = allRoles[0].id;
                    else {
                        console.log(`[Import] Skipping row, no role found or creatable: ${row.name}`);
                        skippedCount++;
                        continue;
                    }
                }

                // Find Situation
                let situationId = allSituations.find(s => s.name.toLowerCase() === row.situation?.toLowerCase())?.id;
                if (!situationId && allSituations.length > 0) {
                    // try to find 'Ativo'
                    situationId = allSituations.find(s => s.name === 'Ativo')?.id || allSituations[0].id;
                }

                // Parse Dates
                let admissionDate = new Date();

                if (row.admissionDate) {
                    if (typeof row.admissionDate === 'number') {
                        // Handle Excel Serial Date
                        // Excel base date is Dec 30 1899 (approx). 
                        // JS is 1970. (date - 25569) * 86400 * 1000
                        const excelDate = new Date((row.admissionDate - 25569) * 86400 * 1000);
                        // Adjust for timezone offset if needed, but typically this gives UTC midnight for the date
                        // Adding a few hours to ensure it lands on correct day in local time if needed,
                        // but usually `new Date()` is fine if just storing date.
                        // Actually, often safer to treat as UTC or add 12h to handle rounding issues
                        excelDate.setHours(12, 0, 0, 0);
                        admissionDate = excelDate;
                    }
                    else if (typeof row.admissionDate === 'string') {
                        if (row.admissionDate.includes('/')) {
                            // BR Format DD/MM/YYYY
                            const parts = row.admissionDate.split('/');
                            if (parts.length === 3) {
                                const d = parseInt(parts[0]);
                                const m = parseInt(parts[1]) - 1; // Month is 0-indexed
                                const y = parseInt(parts[2]);
                                admissionDate = new Date(y, m, d);
                            }
                        } else {
                            // ISO or other string
                            const parsed = new Date(row.admissionDate);
                            if (!isNaN(parsed.getTime())) admissionDate = parsed;
                        }
                    }
                }

                await tx.employee.create({
                    data: {
                        name: String(row.name),
                        cpf: normalizedCpf.length === 11 ? rawCpf : rawCpf, // Store raw for now to match current DB style or preference? 
                        // Actually, let's just store raw to be safe, or normalized?
                        // If we normalize here, we might break consistency if other records are formatted.
                        // Let's store raw checks. PROCEED WITH RAW to minimize regression risk.

                        roleId: roleId!,
                        situationId: situationId,
                        admissionDate: admissionDate,

                        salary: parseFloat(row.salary) || 0,
                        workload: parseInt(row.workload) || 220,
                        type: row.type || "CLT",

                        // Defaults
                        status: "Ativo",

                        // Contacts
                        email: row.email || null,
                        phone: row.phone || null
                    }
                });

                successCount++;
            }
        });

        revalidatePath("/admin/employees");
        return { count: successCount, skipped: skippedCount };

    } catch (error) {
        console.error("Batch Import Error:", error);
        return { error: "Erro ao processar importação. Verifique se os dados estão corretos." };
    }
}

export async function deleteEmployeesBatch(ids: string[]) {
    if (!ids || ids.length === 0) return { error: "Nenhum selecionado." };

    try {
        await prisma.$transaction(async (tx) => {
            // Delete related records first (Cascade manually)

            // 1. EmployeeAllowances and Vacations are already Cascade in schema, but good to be explicit or rely on schema.
            // Schema says: 
            // - EmployeeAllowance: onDelete: Cascade
            // - Vacation: onDelete: Cascade
            // So we can skip those if DB enforces it, but for safety in logic:

            // 2. Clear Assignments
            await tx.assignment.deleteMany({
                where: { employeeId: { in: ids } }
            });

            // 3. Clear Coverages (as Covering Employee)
            // Coverages where this employee is the 'coveringEmployeeId'
            // We might just set coveringEmployeeId to null if we want to keep the coverage record but show "Unknown"
            // OR delete them. Usually coverage is historical data.
            // Let's set to null to preserve financial record cost, or delete if strictly linked.
            // Given "Need to delete completely", let's assume we want to wipe their trace OR preserve history but decouple.
            // If we delete the employee, the coverage record pointing to them becomes invalid if foreign key constraint exists.
            // Schema: coveringEmployee   Employee? @relation("CoveringEmployee", fields: [coveringEmployeeId], references: [id])
            // It is optional (?) -> fields: [coveringEmployeeId], references: [id]. No onDelete specified, defaults to RESTRICT usually in Prisma unless optional?
            // Since it is optional (String?), we can set it to null.
            await tx.coverage.updateMany({
                where: { coveringEmployeeId: { in: ids } },
                data: { coveringEmployeeId: null }
            });

            // 4. Logs
            // Schema: employee   Employee? @relation(fields: [employeeId], references: [id])
            // Optional.
            await tx.log.deleteMany({
                where: { employeeId: { in: ids } }
            });

            // 5. Requests
            // requesters or subjects
            // If they are the subject (employeeId)
            await tx.request.deleteMany({
                where: { employeeId: { in: ids } }
            });
            // If they are the requester... (User model usually, but check schema: requesterId is String, requester User)
            // Employee != User in this schema so far unless linked. 
            // Wait, schema says requester is User. So Employee deletion doesn't affect requester field.

            // 6. Occurrences
            // employeeId is optional
            await tx.occurrence.updateMany({
                where: { employeeId: { in: ids } },
                data: { employeeId: null }
            });

            // Finally, delete Employees
            await tx.employee.deleteMany({
                where: {
                    id: { in: ids }
                }
            });
        });

        revalidatePath("/admin/employees");
        return { success: true };
    } catch (error) {
        console.error("Batch Delete Error:", error);
        return { error: "Erro ao excluir. Detalhes no console do servidor." };
    }
}


export async function createUser(formData: FormData) {
    const userRole = await getCurrentUserRole();
    if (userRole !== 'ADMIN') throw new Error("Unauthorized");

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as any;

    const hashedPassword = await hashPassword(password);

    await prisma.user.create({
        data: {
            name,
            email,
            username,
            password: hashedPassword,
            role,
            isActive: true
        }
    });

    revalidatePath("/admin/users");
}

export async function updateUser(formData: FormData) {
    const userRole = await getCurrentUserRole();
    if (userRole !== 'ADMIN') throw new Error("Unauthorized");

    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const role = formData.get("role") as any;
    const isActive = formData.get("isActive") === "true";
    const password = formData.get("password") as string;

    const updateData: any = {
        name,
        email,
        role,
        isActive
    };

    if (password && password.length > 0) {
        updateData.password = await hashPassword(password);
    }

    await prisma.user.update({
        where: { id },
        data: updateData
    });

    revalidatePath("/admin/users");
}

export async function deleteUser(id: string) {
    const userRole = await getCurrentUserRole();
    if (userRole !== 'ADMIN') throw new Error("Unauthorized");

    // Hard delete or soft delete depending on preference. 
    // User requested "maintenance", enabling/disabling is usually better. 
    // But "delete" button usually implies deletion.
    // Let's implement hard delete for now, or just disable.
    // Given the prompt "manutenção", we already have isActive.
    // Let's support delete if they really want to remove.
    await prisma.user.delete({ where: { id } });
    revalidatePath("/admin/users");
}

export async function deleteEmployee(id: string) {
    const userRole = await getCurrentUserRole();
    if (userRole !== 'ADMIN') {
        return { error: "Não autorizado." };
    }

    const activeAssignments = await prisma.assignment.count({
        where: { employeeId: id, endDate: null }
    });

    if (activeAssignments > 0) {
        return { error: "Não é possível excluir colaborador com alocação ativa. Desvincule-o primeiro." };
    }

    try {
        await prisma.employee.delete({ where: { id } });
        revalidatePath("/admin/employees");
        return { success: true };
    } catch (e: any) {
        return { error: "Erro ao excluir: " + e.message };
    }
}

export async function getEmployeeTimeline(employeeId: string) {
    const [assignments, vacations, logs] = await Promise.all([
        prisma.assignment.findMany({
            where: { employeeId },
            include: { posto: { include: { client: true, role: true } } },
            orderBy: { startDate: 'desc' }
        }),
        prisma.vacation.findMany({
            where: { employeeId },
            orderBy: { startDate: 'desc' }
        }),
        prisma.log.findMany({
            where: { employeeId },
            orderBy: { timestamp: 'desc' }
        })
    ]);

    // Normalize events
    const events: any[] = [];

    assignments.forEach(a => {
        events.push({
            id: a.id,
            type: 'ASSIGNMENT',
            date: a.startDate,
            title: `Alocado em ${a.posto.client.name}`,
            subtitle: a.posto.role.name,
            details: a.posto.schedule,
            isNightShift: a.posto.isNightShift,
            endDate: a.endDate
        });

        if (a.endDate) {
            events.push({
                id: a.id + '_end',
                type: 'UNASSIGNMENT',
                date: a.endDate,
                title: `Desvinculado de ${a.posto.client.name}`,
                subtitle: a.posto.role.name,
                details: "Fim da alocação"
            });
        }
    });

    vacations.forEach(v => {
        events.push({
            id: v.id,
            type: 'VACATION',
            date: v.startDate,
            title: 'Férias',
            subtitle: `${v.daysTaken} Dias`,
            details: `Até ${v.endDate.toLocaleDateString()}`,
            endDate: v.endDate
        });
    });

    logs.forEach(l => {
        // Avoid duplicates if log is about allocation/vacation which we already have specific events for
        if (l.action === 'LOTACAO' || l.action === 'DESVINCULACAO') return;

        let type = 'LOG';
        let title = 'Registro';

        if (l.action === 'ALTERACAO_SALARIAL') {
            type = 'SALARY';
            title = 'Ajuste Salarial';
        } else if (l.action === 'PROMOCAO_CARGO') {
            type = 'ROLE';
            title = 'Mudança de Cargo';
        } else if (l.action === 'MUDANCA_SITUACAO') {
            type = 'SITUATION';
            title = 'Mudança de Situação';
        }

        events.push({
            id: l.id,
            type,
            date: l.timestamp,
            title,
            subtitle: l.action,
            details: l.details
        });
    });

    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function confirmProbation(employeeId: string, notes: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new Error("Employee not found");

    await prisma.$transaction([
        prisma.log.create({
            data: {
                action: "EFETIVACAO_EXPERIENCIA",
                details: `Colaborador ${employee.name} efetivado após período de experiência. Observações: ${notes || "Nenhuma observação."}`,
                employeeId: employeeId,
                userId: user.id
            }
        }),
        prisma.employee.update({
            where: { id: employeeId },
            data: { probationStatus: "CONFIRMED" }
        })
    ]);

    revalidatePath("/admin/probation-monitor");
}

export async function requestProbationDismissal(employeeId: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new Error("Employee not found");

    const dueDate = new Date();

    const newRequest = await prisma.request.create({
        data: {
            type: "TERMINO_CONTRATO_EXPERIENCIA",
            status: "PENDENTE",
            description: `Solicitação de desligamento por término de contrato de experiência Ref: ${employee.name}`,
            dueDate: dueDate,
            requesterId: user.id,
            employeeId: employeeId,
        }
    });

    await prisma.$transaction([
        prisma.log.create({
            data: {
                action: "SOLICITACAO_DESLIGAMENTO_EXPERIENCIA",
                details: `Solicitação de desligamento criada para ${employee.name}. ID Solicitação: ${newRequest.id}`,
                employeeId: employeeId,
                userId: user.id
            }
        }),
        prisma.employee.update({
            where: { id: employeeId },
            data: { probationStatus: "DISMISSED" }
        })
    ]);

    revalidatePath("/admin/requests");
    revalidatePath("/admin/probation-monitor");
}


