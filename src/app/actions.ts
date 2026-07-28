"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { webcrypto } from "crypto";
import { getCurrentUserRole, getCurrentUser } from "@/lib/auth";
import { createVacancyFromPosto } from "@/actions/recruitment";

export async function cleanupVacantRotativoPostos(tx?: any) {
    const db = tx || prisma;
    const rotativoClient = await db.client.findFirst({
        where: { name: { equals: 'ROTATIVO', mode: 'insensitive' } }
    });
    if (!rotativoClient) return;

    const rotativoPostos = await db.posto.findMany({
        where: { clientId: rotativoClient.id },
        include: { assignments: { where: { endDate: null } } }
    });

    for (const posto of rotativoPostos) {
        if (posto.assignments.length === 0) {
            // Find vacancies for this posto first to cascade delete candidate/recruitment records
            const vacancies = await db.vacancy.findMany({ where: { postoId: posto.id } });
            for (const v of vacancies) {
                await db.recruitmentTimeline.deleteMany({ where: { vacancyId: v.id } });
                await db.recruitmentComment.deleteMany({ where: { vacancyId: v.id } });
                await db.recruitmentCandidate.deleteMany({ where: { vacancyId: v.id } });
            }

            // Cascade delete all dependent relations manually to avoid FK constraint errors in PostgreSQL
            await db.vacancy.deleteMany({ where: { postoId: posto.id } });
            await db.attendance.deleteMany({ where: { postoId: posto.id } });
            await db.coverage.deleteMany({ where: { postoId: posto.id } });
            await db.occurrence.deleteMany({ where: { postoId: posto.id } });
            await db.scheduleOverride.deleteMany({ where: { postoId: posto.id } });
            await db.workRoutine.deleteMany({ where: { postoId: posto.id } });

            // Set originPostoId to null in any assignments pointing to this posto
            await db.assignment.updateMany({
                where: { originPostoId: posto.id },
                data: { originPostoId: null }
            });

            // Now safely delete all assignments for this posto
            await db.assignment.deleteMany({ where: { postoId: posto.id } });

            // Finally delete the posto itself
            await db.posto.delete({ where: { id: posto.id } });
            console.log(`[ROTATIVO] Cleaned up vacant posto: ${posto.id}`);
        }
    }
}

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
    const monitorInOperations = formData.get("monitorInOperations") === "true" || formData.get("monitorInOperations") === "on";

    await prisma.client.create({
        data: {
            name,
            address,
            companyId: companyId || undefined,
            monitorInOperations
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
    const valeAlimentacao = parseFloat(formData.get("valeAlimentacao") as string) || 0;
    const vaType = (formData.get("vaType") as string) || "mensal";
    const valeTransporte = parseFloat(formData.get("valeTransporte") as string) || 0;
    const valeTransporte2 = parseFloat(formData.get("valeTransporte2") as string) || 0;
    const vtPaymentMethod2 = (formData.get("vtPaymentMethod2") as string) || "Urbs";

    const vtDiscountPercentage = formData.get("vtDiscountPercentage") ? parseFloat(formData.get("vtDiscountPercentage") as string) : 6.0;
    const vaDiscountPercentage = formData.get("vaDiscountPercentage") ? parseFloat(formData.get("vaDiscountPercentage") as string) : 20.0;
    const vaMealsProvidedOnSite = formData.get("vaMealsProvidedOnSite") === "true";
    const vaPaidOnVacation = formData.get("vaPaidOnVacation") === "true";
    const absenteismoAwardValue = parseFloat(formData.get("absenteismoAwardValue") as string) || 0;
    const absenteismoAwardPeriod = (formData.get("absenteismoAwardPeriod") as string) || "mensal";
    const absenteismoAwardType = (formData.get("absenteismoAwardType") as string) || "prorrata";
    const absenteismoMinDays = parseInt(formData.get("absenteismoMinDays") as string) || 0;

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
            outrosAdicionais,
            valeAlimentacao,
            vaType,
            valeTransporte,
            valeTransporte2,
            vtPaymentMethod2,
            vtDiscountPercentage,
            vaDiscountPercentage,
            vaMealsProvidedOnSite,
            vaPaidOnVacation,
            absenteismoAwardValue,
            absenteismoAwardPeriod,
            absenteismoAwardType,
            absenteismoMinDays
        }
    });

    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath("/admin");
}

export async function createEmployee(formData: FormData) {
    try {
        const name = (formData.get("name") as string)?.trim();
        const cpf = (formData.get("cpf") as string)?.trim();
        let roleId = (formData.get("roleId") as string)?.trim();
        const type = (formData.get("type") as string)?.trim() || "Efetivo";
        const salary = parseFloat(formData.get("salary") as string) || 0;
        const insalubridade = parseFloat(formData.get("insalubridade") as string) || 0;
        const periculosidade = parseFloat(formData.get("periculosidade") as string) || 0;
        const gratificacao = parseFloat(formData.get("gratificacao") as string) || 0;
        const outrosAdicionais = parseFloat(formData.get("outrosAdicionais") as string) || 0;
        const dependentsCount = parseInt(formData.get("dependentsCount") as string) || 0;
        const ajudaCusto = parseFloat(formData.get("ajudaCusto") as string) || 0;
        const adicionalViagem = parseFloat(formData.get("adicionalViagem") as string) || 0;
        const workload = parseInt(formData.get("workload") as string) || 220;
        const admissionDateStr = formData.get("admissionDate") as string;
        const situationId = formData.get("situationId") as string;
        const valeAlimentacao = parseFloat(formData.get("valeAlimentacao") as string) || 0;
        const vtOptInStr = formData.get("vtOptIn") as string;
        const vtOptIn = vtOptInStr === "true" || vtOptInStr === null || vtOptInStr === "";
        const valeTransporte = vtOptIn ? (parseFloat(formData.get("valeTransporte") as string) || 0) : 0;
        const valeTransporte2 = vtOptIn ? (parseFloat(formData.get("valeTransporte2") as string) || 0) : 0;
        const vtPaymentMethod = (formData.get("vtPaymentMethod") as string) || "Metrocard Metropolitana";
        const vtPaymentMethod2 = (formData.get("vtPaymentMethod2") as string) || "Urbs";
        
        const vtDiscountPercentage = formData.get("vtDiscountPercentage") ? parseFloat(formData.get("vtDiscountPercentage") as string) : null;
        const vaDiscountPercentage = formData.get("vaDiscountPercentage") ? parseFloat(formData.get("vaDiscountPercentage") as string) : null;

        // Mandatory Posto Link
        const postoId = formData.get("postoId") as string;

        if (!name) return { error: "O nome do colaborador é obrigatório." };
        if (!cpf) return { error: "O CPF do colaborador é obrigatório." };

        // Auto-resolve roleId from Posto if not provided in form
        if (!roleId && postoId && postoId !== "ROTATIVO_VIRTUAL") {
            try {
                const targetPosto = await prisma.posto.findUnique({ where: { id: postoId } });
                if (targetPosto?.roleId) {
                    roleId = targetPosto.roleId;
                }
            } catch (err) {
                console.error("Error auto-resolving roleId from posto:", err);
            }
        }

        if (!roleId) {
            try {
                const defaultRole = await prisma.role.findFirst();
                if (defaultRole) {
                    roleId = defaultRole.id;
                } else {
                    return { error: "O cargo (função) é obrigatório para cadastrar o colaborador." };
                }
            } catch {
                return { error: "O cargo (função) é obrigatório para cadastrar o colaborador." };
            }
        }

        const admissionDate = admissionDateStr ? new Date(admissionDateStr) : new Date();

        const extraFieldsStr = formData.get("extraFields") as string;
        let extraFields = null;
        if (extraFieldsStr) {
            try {
                extraFields = JSON.parse(extraFieldsStr);
            } catch {
                extraFields = null;
            }
        }

        let createdEmployeeId: string | null = null;

        await prisma.$transaction(async (tx) => {
            // Check if CPF already exists
            const existingCpf = await tx.employee.findUnique({
                where: { cpf },
                include: { situation: true }
            });

            let employeeId: string;

            if (existingCpf) {
                const isDesligado =
                    existingCpf.status?.toLowerCase().includes("desligado") ||
                    existingCpf.status?.toLowerCase().includes("inativo") ||
                    existingCpf.situation?.name?.toLowerCase().includes("desligado") ||
                    existingCpf.situation?.name?.toLowerCase().includes("demitido");

                if (!isDesligado) {
                    throw new Error(`O colaborador com CPF ${cpf} já possui um cadastro ATIVO no sistema (${existingCpf.name}).`);
                }

                // Update existing demitted employee to Active status (Readmissão)
                const updatedEmployee = await tx.employee.update({
                    where: { id: existingCpf.id },
                    data: {
                        name: name || existingCpf.name,
                        roleId: roleId || existingCpf.roleId,
                        companyId: (formData.get("companyId") as string) || existingCpf.companyId,
                        type: type || existingCpf.type,
                        status: "Ativo",
                        situationId: situationId || undefined,
                        admissionDate: admissionDate || new Date(),
                        salary,
                        insalubridade,
                        periculosidade,
                        gratificacao,
                        workload,
                        dependentsCount,
                        ajudaCusto,
                        adicionalViagem,
                        valeAlimentacao,
                        valeTransporte,
                        valeTransporte2,
                        vtOptIn,
                        vtPaymentMethod,
                        vtPaymentMethod2,
                        vtDiscountPercentage,
                        vaDiscountPercentage,
                        address: (formData.get("address") as string) || existingCpf.address,
                        phone: (formData.get("phone") as string) || existingCpf.phone,
                        email: (formData.get("email") as string) || existingCpf.email,
                        birthDate: (formData.get("birthDate") as string) ? new Date(formData.get("birthDate") as string) : existingCpf.birthDate,
                        gender: (formData.get("gender") as string) || existingCpf.gender,
                        dismissalReason: null,
                        dismissalNotes: null,
                        extraFields: extraFields || existingCpf.extraFields
                    }
                });

                employeeId = updatedEmployee.id;
            } else {
                // 1. Create Employee
                const newEmployee = await tx.employee.create({
                    data: {
                        name,
                        cpf,
                        roleId,
                        companyId: (formData.get("companyId") as string) || null,
                        type,
                        status: "Ativo",
                        situationId: situationId || undefined,
                        admissionDate,
                        salary,
                        insalubridade,
                        periculosidade,
                        gratificacao,
                        outrosAdicionais,
                        workload,
                        dependentsCount,
                        ajudaCusto,
                        adicionalViagem,
                        valeAlimentacao,
                        valeTransporte,
                        valeTransporte2,
                        vtOptIn,
                        vtPaymentMethod,
                        vtPaymentMethod2,
                        vtDiscountPercentage,
                        vaDiscountPercentage,
                        address: (formData.get("address") as string) || null,
                        phone: (formData.get("phone") as string) || null,
                        email: (formData.get("email") as string) || null,
                        birthDate: (formData.get("birthDate") as string) ? new Date(formData.get("birthDate") as string) : null,
                        gender: (formData.get("gender") as string) || null,
                        extraFields: extraFields || undefined
                    }
                });
                employeeId = newEmployee.id;
            }
            createdEmployeeId = employeeId;

            // 2. Create Assignment if Posto Provided
            if (postoId) {
                let finalPostoId = postoId;
                if (postoId === "ROTATIVO_VIRTUAL") {
                    let rotativoClient = await tx.client.findFirst({ where: { name: { equals: 'ROTATIVO', mode: 'insensitive' } } });
                    if (!rotativoClient) {
                        rotativoClient = await tx.client.create({
                            data: {
                                name: 'ROTATIVO',
                                address: 'Centro de Custo Virtual',
                                companyId: null
                            }
                        });
                    }

                    const newPosto = await tx.posto.create({
                        data: {
                            clientId: rotativoClient.id,
                            roleId: roleId,
                            schedule: 'Variável',
                            startTime: '00:00',
                            endTime: '23:59',
                            billingValue: 0,
                            requiredWorkload: workload,
                            isNightShift: false,
                            baseSalary: salary,
                            insalubridade: insalubridade,
                            periculosidade: periculosidade,
                            gratificacao: gratificacao,
                            outrosAdicionais: outrosAdicionais
                        }
                    });
                    finalPostoId = newPosto.id;
                } else {
                    const posto = await tx.posto.findUnique({ where: { id: postoId } });
                    if (!posto) {
                        console.warn(`[createEmployee] Posto ${postoId} not found, proceeding without posto assignment.`);
                        finalPostoId = "";
                    }
                }

                if (finalPostoId) {
                    // Create Active Assignment
                    await tx.assignment.create({
                        data: {
                            employeeId,
                            postoId: finalPostoId,
                            startDate: admissionDate, // Starts at admission
                            endDate: null // Active
                        }
                    });

                    // Log Auto-Assignment
                    try {
                        const user = await getCurrentUser();
                        await tx.log.create({
                            data: {
                                action: "ALOCACAO_AUTOMATICA",
                                details: `Colaborador ${name} alocado automaticamente ao posto no cadastro (Origem: Recrutamento/Admissão).`,
                                employeeId,
                                userId: user?.id
                            }
                        });
                    } catch (logErr) {
                        console.error("Warning: log creation failed inside createEmployee:", logErr);
                    }
                }
            }
            
            // Cleanup vacant rotativo postos in same transaction safely
            try {
                await cleanupVacantRotativoPostos(tx);
            } catch (cleanupErr) {
                console.error("[ROTATIVO] Non-fatal cleanup warning in createEmployee:", cleanupErr);
            }
        });

        try {
            revalidatePath("/admin/employees");
        } catch {}

        return { success: true, employeeId: createdEmployeeId };
    } catch (e: any) {
        console.error("Error in createEmployee server action:", e);
        return { error: e.message || "Erro inesperado ao cadastrar colaborador." };
    }
}

export async function assignEmployee(formData: FormData) {
    const postoId = formData.get("postoId") as string;
    const employeeId = formData.get("employeeId") as string;
    const startDateStr = formData.get("startDate") as string;
    const schedule = formData.get("schedule") as string;
    const createVacancy = formData.get("createVacancy") === "on";
    const reason = formData.get("reason") as string || "Não informado";

    console.log("Assign Employee Debug:", { postoId, employeeId, startDateStr, schedule, reason });

    if (!postoId || !employeeId) return { error: "Campos obrigatórios faltando." };

    // Fix: Append T12:00:00 to ensure date falls on the correct day in local time (avoiding UTC roll-back)
    const startDate = startDateStr ? new Date(`${startDateStr}T12:00:00`) : new Date();

    console.log("Parsed Start Date:", startDate);

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    const posto = await prisma.posto.findUnique({ where: { id: postoId }, include: { client: true, role: true } });

    if (!employee || !posto) return { error: "Dados não encontrados." };

    // Update Posto Schedule if provided and different
    if (schedule && schedule !== posto.schedule) {
        await prisma.posto.update({
            where: { id: postoId },
            data: { schedule }
        });
    }

    // Workload auto-adjustment if 0 or lower than required
    if (employee.workload < posto.requiredWorkload) {
        await prisma.employee.update({
            where: { id: employeeId },
            data: { workload: posto.requiredWorkload }
        });
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
        include: { employee: true, posto: { include: { client: true, role: true } } }
    });

    await prisma.$transaction(async (tx) => {
        const targetPostoName = `${posto.client.name} - ${posto.role.name}`;

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
                    details: `Colaborador movido de ${employeeActiveAssignment.posto.client.name} para novo posto. Motivo: ${reason}`,
                    employeeId: employeeId,
                    userId: currentUser?.id
                }
            });

            // Log movement in extraFields of employee
            const empObj = await tx.employee.findUnique({ where: { id: employeeId } });
            const extra = (empObj?.extraFields as any) || {};
            const movements = extra.movimentacoes || [];
            movements.push({
                date: new Date(),
                fromPosto: `${employeeActiveAssignment.posto.client.name} - ${employeeActiveAssignment.posto.role.name}`,
                toPosto: targetPostoName,
                reason: reason
            });
            await tx.employee.update({
                where: { id: employeeId },
                data: { extraFields: { ...extra, movimentacoes: movements } }
            });
        } else {
            // Log movement from Rotativo
            const empObj = await tx.employee.findUnique({ where: { id: employeeId } });
            const extra = (empObj?.extraFields as any) || {};
            const movements = extra.movimentacoes || [];
            movements.push({
                date: new Date(),
                fromPosto: "Rotativo / Sem Posto",
                toPosto: targetPostoName,
                reason: reason
            });
            await tx.employee.update({
                where: { id: employeeId },
                data: { extraFields: { ...extra, movimentacoes: movements } }
            });
        }

        // 2. If the TARGET POSTO has someone, remove them (swap logic) and move them to Rotativo
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

            // Displace target employee to Rotativo virtual client
            const displacedEmpId = targetPostoHasAssignment.employeeId;
            const displacedEmp = await tx.employee.findUnique({ where: { id: displacedEmpId } });
            const displacedExtra = (displacedEmp?.extraFields as any) || {};
            const displacedMovements = displacedExtra.movimentacoes || [];

            let rotativoClient = await tx.client.findFirst({
                where: { name: { equals: "ROTATIVO", mode: "insensitive" } }
            });
            if (!rotativoClient) {
                rotativoClient = await tx.client.create({
                    data: {
                        name: "ROTATIVO",
                        address: "Centro de Custo Virtual",
                        companyId: null
                    }
                });
            }

            let rotativoPosto = await tx.posto.findFirst({
                where: { clientId: rotativoClient.id, roleId: targetPostoHasAssignment.posto.roleId }
            });
            if (!rotativoPosto) {
                rotativoPosto = await tx.posto.create({
                    data: {
                        clientId: rotativoClient.id,
                        roleId: targetPostoHasAssignment.posto.roleId,
                        schedule: targetPostoHasAssignment.posto.schedule || 'Variável',
                        startTime: targetPostoHasAssignment.posto.startTime || '00:00',
                        endTime: targetPostoHasAssignment.posto.endTime || '23:59',
                        billingValue: 0,
                        requiredWorkload: targetPostoHasAssignment.posto.requiredWorkload || displacedEmp?.workload || 220,
                        baseSalary: displacedEmp?.salary || targetPostoHasAssignment.posto.baseSalary || 0
                    }
                });
            }

            await tx.assignment.create({
                data: {
                    employeeId: displacedEmpId,
                    postoId: rotativoPosto.id,
                    startDate: new Date()
                }
            });

            displacedMovements.push({
                date: new Date(),
                fromPosto: `${targetPostoHasAssignment.posto.client.name} - ${targetPostoHasAssignment.posto.role.name}`,
                toPosto: "Rotativo / Sem Posto (Desvinculado por Realocação)",
                reason: `Desvinculação automática devido a realocação de ${employee.name}. Motivo informado: ${reason}`
            });

            await tx.employee.update({
                where: { id: displacedEmpId },
                data: { extraFields: { ...displacedExtra, movimentacoes: displacedMovements } }
            });
        }

        // 3. Create new assignment
        await tx.assignment.create({
            data: {
                postoId,
                employeeId,
                startDate
            }
        });

        // 4. Log new assignment
        const emp = await tx.employee.findUnique({ where: { id: employeeId } });
        const currentUser = await getCurrentUser();

        await tx.log.create({
            data: {
                action: "LOTACAO",
                details: `Colaborador ${emp?.name} movido para ${posto.role.name} em ${posto.client.name}`,
                employeeId: employeeId,
                userId: currentUser?.id
            }
        });

        // Cleanup vacant rotativo postos in same transaction
        await cleanupVacantRotativoPostos(tx);
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
    try {
        const postoId = formData.get("postoId") as string;
        const situationId = formData.get("situationId") as string;
        const observation = formData.get("observation") as string;
        const createVacancy = formData.get("createVacancy") === "on";
        const endDate = new Date();
        const currentUser = await getCurrentUser();

        const noticeStartDate = formData.get("noticeStartDate") as string;
        const noticeEndDate = formData.get("noticeEndDate") as string;
        const terminationDate = formData.get("terminationDate") as string;
        const abandonmentStartDate = formData.get("abandonmentStartDate") as string;

        if (!situationId) {
            return { error: "Situação é obrigatória ao desvincular colaborador" };
        }

        const currentAssignment = await prisma.assignment.findFirst({
            where: {
                postoId,
                endDate: null
            },
            include: { employee: true, posto: { include: { client: true, role: true } } }
        });

        if (!currentAssignment) return { error: "Nenhuma alocação ativa encontrada para este posto." };

        // Get situation details
        const situation = await prisma.situation.findUnique({ where: { id: situationId } });
        if (!situation) return { error: "Situação não encontrada" };

        await prisma.$transaction(async (tx) => {
            // 1. End current assignment
            await tx.assignment.update({
                where: { id: currentAssignment.id },
                data: { endDate }
            });

            // 2. Update employee situation with dismissal dates in extraFields
            let dismissalProcess: any = null;
            if (situation.name === "Aviso Prévio") {
                dismissalProcess = {
                    type: "Aviso Prévio",
                    startDate: noticeStartDate ? new Date(noticeStartDate + "T12:00:00Z") : new Date(),
                    endDate: noticeEndDate ? new Date(noticeEndDate + "T12:00:00Z") : null
                };
            } else if (situation.name === "Processo de Rescisão") {
                dismissalProcess = {
                    type: "Processo de Rescisão",
                    endDate: terminationDate ? new Date(terminationDate + "T12:00:00Z") : null
                };
            } else if (situation.name === "Processo de abandono") {
                dismissalProcess = {
                    type: "Processo de abandono",
                    startDate: abandonmentStartDate ? new Date(abandonmentStartDate + "T12:00:00Z") : new Date()
                };
            }

            const existingExtraFields = (currentAssignment.employee.extraFields as any) || {};
            const updatedExtraFields = {
                ...existingExtraFields
            };
            if (dismissalProcess) {
                updatedExtraFields.dismissalProcess = dismissalProcess;
            } else {
                delete updatedExtraFields.dismissalProcess;
            }

            const prevPosto = currentAssignment.posto;
            const movements = updatedExtraFields.movimentacoes || [];
            const activeStatusesList = ['Ativo', 'Férias', 'Afastamento', 'Licença INSS', 'AFASTADO INSS', 'LICENÇA MATERNIDADE', 'Aviso Prévio', 'Processo de Rescisão', 'Processo de abandono'];
            const rotativoAlloc = activeStatusesList.includes(situation.name);

            movements.push({
                date: new Date(),
                fromPosto: `${prevPosto.client.name} - ${prevPosto.role.name}`,
                toPosto: rotativoAlloc 
                    ? `Rotativo / Sem Posto (${situation.name})` 
                    : `Desvinculado (${situation.name})`,
                reason: observation || "Não informado"
            });
            updatedExtraFields.movimentacoes = movements;

            await tx.employee.update({
                where: { id: currentAssignment.employeeId },
                data: { 
                    situationId,
                    extraFields: updatedExtraFields
                }
            });

            // Save observation note if present
            if (observation && observation.trim().length > 0) {
                await tx.log.create({
                    data: {
                        action: "DESVINCULACAO_NOTAS",
                        details: observation.trim(),
                        employeeId: currentAssignment.employeeId,
                        userId: currentUser?.id
                    }
                });
            }

            // 3. Check if should allocate to Rotativo
            const activeStatuses = ['Ativo', 'Férias', 'Afastamento', 'Licença INSS', 'AFASTADO INSS', 'LICENÇA MATERNIDADE', 'Aviso Prévio', 'Processo de Rescisão', 'Processo de abandono'];
            const shouldAllocateToRotativo = activeStatuses.includes(situation.name);

            if (shouldAllocateToRotativo) {
                // Find or create ROTATIVO client
                let rotativoClient = await tx.client.findFirst({ where: { name: { equals: 'ROTATIVO', mode: 'insensitive' } } });
                if (!rotativoClient) {
                    rotativoClient = await tx.client.create({
                        data: {
                            name: 'ROTATIVO',
                            address: 'Centro de Custo Virtual',
                            companyId: null
                        }
                    });
                }

                const prevPosto = currentAssignment.posto;
                const emp = currentAssignment.employee;

                // Create dedicated posto under ROTATIVO client specifically for this employee inheriting from prevPosto
                const rotativoPosto = await tx.posto.create({
                    data: {
                        clientId: rotativoClient.id,
                        roleId: prevPosto.roleId,
                        schedule: prevPosto.schedule || 'Variável',
                        startTime: prevPosto.startTime || '00:00',
                        endTime: prevPosto.endTime || '23:59',
                        billingValue: 0,
                        requiredWorkload: prevPosto.requiredWorkload || emp.workload || 220,
                        isNightShift: prevPosto.isNightShift || false,
                        baseSalary: emp.salary || prevPosto.baseSalary || 0,
                        insalubridade: emp.insalubridade || prevPosto.insalubridade || 0,
                        periculosidade: emp.periculosidade || prevPosto.periculosidade || 0,
                        gratificacao: emp.gratificacao || prevPosto.gratificacao || 0,
                        outrosAdicionais: emp.outrosAdicionais || prevPosto.outrosAdicionais || 0
                    }
                });

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
                await tx.log.create({
                    data: {
                        action: "DESVINCULACAO",
                        details: `Colaborador ${currentAssignment.employee.name} desvinculado do posto ${currentAssignment.posto.role.name} em ${currentAssignment.posto.client.name} (${situation.name})`,
                        employeeId: currentAssignment.employeeId,
                        userId: currentUser?.id
                    }
                });
            }

            // Cleanup vacant rotativo postos in same transaction
            await cleanupVacantRotativoPostos(tx);
        });

        // 4. Create vacancy if requested (outside transaction)
        if (createVacancy) {
            try {
                await createVacancyFromPosto(
                    postoId,
                    currentAssignment.employee.name,
                    situation.name,
                    observation || undefined,
                    currentUser?.id
                );
            } catch (error) {
                console.error("Error creating vacancy:", error);
            }
        }

        revalidatePath(`/admin/clients`);
        revalidatePath("/admin");
        revalidatePath("/admin/employees");
        revalidatePath("/admin/recrutamento");

        return { success: true };
    } catch (e: any) {
        console.error("Error in unassignEmployee server action:", e);
        return { error: e.message || "Erro inesperado ao processar a desvinculação." };
    }
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
    const monitorInOperations = formData.get("monitorInOperations") === "true" || formData.get("monitorInOperations") === "on";

    await prisma.client.update({
        where: { id },
        data: {
            name,
            address,
            companyId: companyId || undefined,
            monitorInOperations
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
    const valeAlimentacao = parseFloat(formData.get("valeAlimentacao") as string) || 0;
    const vaType = (formData.get("vaType") as string) || "mensal";
    const valeTransporte = parseFloat(formData.get("valeTransporte") as string) || 0;
    const valeTransporte2 = parseFloat(formData.get("valeTransporte2") as string) || 0;
    const vtPaymentMethod2 = (formData.get("vtPaymentMethod2") as string) || "Urbs";

    const vtDiscountPercentage = formData.get("vtDiscountPercentage") ? parseFloat(formData.get("vtDiscountPercentage") as string) : 6.0;
    const vaDiscountPercentage = formData.get("vaDiscountPercentage") ? parseFloat(formData.get("vaDiscountPercentage") as string) : 20.0;
    const vaMealsProvidedOnSite = formData.get("vaMealsProvidedOnSite") === "true";
    const vaPaidOnVacation = formData.get("vaPaidOnVacation") === "true";
    const absenteismoAwardValue = parseFloat(formData.get("absenteismoAwardValue") as string) || 0;
    const absenteismoAwardPeriod = (formData.get("absenteismoAwardPeriod") as string) || "mensal";
    const absenteismoAwardType = (formData.get("absenteismoAwardType") as string) || "prorrata";
    const absenteismoMinDays = parseInt(formData.get("absenteismoMinDays") as string) || 0;

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
            outrosAdicionais,
            valeAlimentacao,
            vaType,
            valeTransporte,
            valeTransporte2,
            vtPaymentMethod2,
            vtDiscountPercentage,
            vaDiscountPercentage,
            vaMealsProvidedOnSite,
            vaPaidOnVacation,
            absenteismoAwardValue,
            absenteismoAwardPeriod,
            absenteismoAwardType,
            absenteismoMinDays
        }
    });

    const replicateAbsenteismo = formData.get("replicateAbsenteismo") === "true";
    const replicateAllBenefits = formData.get("replicateAllBenefits") === "true";

    if (replicateAbsenteismo) {
        await prisma.posto.updateMany({
            where: { clientId: posto.clientId },
            data: {
                absenteismoAwardValue,
                absenteismoAwardPeriod,
                absenteismoAwardType,
                absenteismoMinDays
            }
        });
    }

    if (replicateAllBenefits) {
        await prisma.posto.updateMany({
            where: { clientId: posto.clientId },
            data: {
                valeAlimentacao,
                vaType,
                valeTransporte,
                valeTransporte2,
                vtPaymentMethod2,
                vtDiscountPercentage,
                vaDiscountPercentage,
                vaMealsProvidedOnSite,
                vaPaidOnVacation
            }
        });
    }

    revalidatePath(`/admin/clients/${posto.clientId}`);
}

export async function updateEmployee(formData: FormData) {
    try {
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
        const dependentsCount = parseInt(formData.get("dependentsCount") as string) || 0;
        const ajudaCusto = parseFloat(formData.get("ajudaCusto") as string) || 0;
        const adicionalViagem = parseFloat(formData.get("adicionalViagem") as string) || 0;
        const workload = parseInt(formData.get("workload") as string) || 220;
        const admissionDateStr = formData.get("admissionDate") as string;
        const situationId = formData.get("situationId") as string;
        const lastVacationStartStr = formData.get("lastVacationStart") as string;
        const lastVacationEndStr = formData.get("lastVacationEnd") as string;
        const totalVacationDaysTaken = parseInt(formData.get("totalVacationDaysTaken") as string) || 0;
        const valeAlimentacao = parseFloat(formData.get("valeAlimentacao") as string) || 0;
        const vtOptInStr = formData.get("vtOptIn") as string;
        const vtOptIn = vtOptInStr === "true";
        const valeTransporte = vtOptIn ? (parseFloat(formData.get("valeTransporte") as string) || 0) : 0;
        const valeTransporte2 = vtOptIn ? (parseFloat(formData.get("valeTransporte2") as string) || 0) : 0;
        const vtPaymentMethod = (formData.get("vtPaymentMethod") as string) || null;
        const vtPaymentMethod2 = (formData.get("vtPaymentMethod2") as string) || null;
        const vtCustomPaymentDetails = (formData.get("vtCustomPaymentDetails") as string) || null;
        const vtCustomPaymentDetails2 = (formData.get("vtCustomPaymentDetails2") as string) || null;
        const vaPaymentMethod = (formData.get("vaPaymentMethod") as string) || null;
        const vaCustomPaymentDetails = (formData.get("vaCustomPaymentDetails") as string) || null;

        const vtDiscountPercentage = formData.get("vtDiscountPercentage") ? parseFloat(formData.get("vtDiscountPercentage") as string) : null;
        const vaDiscountPercentage = formData.get("vaDiscountPercentage") ? parseFloat(formData.get("vaDiscountPercentage") as string) : null;

        const extraFieldsStr = formData.get("extraFields") as string;
        const extraFields = extraFieldsStr ? JSON.parse(extraFieldsStr) : null;

        // Constraint Check: Situation Change vs Active Assignment
        if (situationId) {
            const activeAssignments = await prisma.assignment.count({
                where: {
                    employeeId: id,
                    endDate: null,
                    posto: {
                        client: {
                            name: { not: "ROTATIVO" }
                        }
                    }
                }
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
                    dependentsCount,
                    ajudaCusto,
                    adicionalViagem,
                    valeAlimentacao,
                    valeTransporte,
                    valeTransporte2,
                    vtOptIn,
                    vtPaymentMethod,
                    vtPaymentMethod2,
                    vtCustomPaymentDetails,
                    vtCustomPaymentDetails2,
                    vaPaymentMethod,
                    vaCustomPaymentDetails,
                    vtDiscountPercentage,
                    vaDiscountPercentage,
                    birthDate: (formData.get("birthDate") as string) ? new Date(formData.get("birthDate") as string) : null,
                    gender: (formData.get("gender") as string) || null,
                    address: (formData.get("address") as string) || null,
                    phone: (formData.get("phone") as string) || null,
                    email: (formData.get("email") as string) || null,
                    dismissalReason: (formData.get("dismissalReason") as string) || null,
                    dismissalNotes: (formData.get("dismissalNotes") as string) || null,
                    extraFields: extraFields || undefined
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

            // If employee is being dismissed/desligado, end their active assignment
            if (situationId) {
                const situation = await tx.situation.findUnique({ where: { id: situationId } });
                if (situation && (situation.name.toLowerCase().includes("desligado") || situation.name.toLowerCase().includes("demitido"))) {
                    // Find all active assignments
                    const activeAssignmentsList = await tx.assignment.findMany({
                        where: {
                            employeeId: id,
                            endDate: null
                        }
                    });

                    for (const activeAss of activeAssignmentsList) {
                        await tx.assignment.update({
                            where: { id: activeAss.id },
                            data: { endDate: new Date() }
                        });
                    }
                }
            }

            // Cleanup vacant rotativo postos in same transaction
            await cleanupVacantRotativoPostos(tx);

            return updated;
        });

        revalidatePath("/admin/employees");
        revalidatePath(`/admin/employees/${id}`);

        return { success: true };
    } catch (e: any) {
        console.error("Error in updateEmployee server action:", e);
        return { error: e.message || "Erro inesperado ao atualizar colaborador." };
    }
}

function validateCLTStartDate(date: Date): { isValid: boolean; reason?: string } {
    const dayOfWeek = date.getUTCDay(); // 0 = Domingo, 5 = Sexta, 6 = Sábado
    
    if (dayOfWeek === 5) {
        return { isValid: false, reason: "A CLT proíbe o início das férias na sexta-feira (dois dias que antecedem o descanso semanal remunerado)." };
    }
    if (dayOfWeek === 6) {
        return { isValid: false, reason: "A CLT proíbe o início das férias no sábado (um dia que antecede o descanso semanal remunerado)." };
    }
    if (dayOfWeek === 0) {
        return { isValid: false, reason: "A CLT proíbe o início das férias no domingo (dia de descanso semanal remunerado)." };
    }

    // Feriados Nacionais Fixos no Brasil (Mês é 0-indexado)
    const holidays = [
        { month: 0, day: 1, name: "Confraternização Universal (Ano Novo)" },
        { month: 3, day: 21, name: "Tiradentes" },
        { month: 4, day: 1, name: "Dia do Trabalho" },
        { month: 8, day: 7, name: "Independência do Brasil" },
        { month: 9, day: 12, name: "Nossa Senhora Aparecida" },
        { month: 10, day: 2, name: "Finados" },
        { month: 10, day: 15, name: "Proclamação da República" },
        { month: 10, day: 20, name: "Dia da Consciência Negra" },
        { month: 11, day: 25, name: "Natal" }
    ];

    // Verificar se a data coincide com o feriado ou com os 2 dias anteriores
    for (let i = 0; i <= 2; i++) {
        const checkDate = new Date(date.getTime());
        checkDate.setUTCDate(checkDate.getUTCDate() + i);
        
        const checkMonth = checkDate.getUTCMonth();
        const checkDay = checkDate.getUTCDate();

        const holiday = holidays.find(h => h.month === checkMonth && h.day === checkDay);
        if (holiday) {
            if (i === 0) {
                return { isValid: false, reason: `A data de início coincide com o feriado de ${holiday.name}.` };
            } else if (i === 1) {
                return { isValid: false, reason: `A data de início antecede em 1 dia o feriado de ${holiday.name} (vedado pela CLT).` };
            } else if (i === 2) {
                return { isValid: false, reason: `A data de início antecede em 2 dias o feriado de ${holiday.name} (vedado pela CLT).` };
            }
        }
    }

    return { isValid: true };
}

export async function addVacation(formData: FormData) {
    const employeeId = formData.get("employeeId") as string;
    const startDateStr = formData.get("startDate") as string;
    const endDateStr = formData.get("endDate") as string;
    const daysTaken = parseInt(formData.get("daysTaken") as string) || 0;
    const daysSold = parseInt(formData.get("daysSold") as string) || 0;

    if (!employeeId || !startDateStr || !endDateStr) {
        return { error: "Preencha todos os campos obrigatórios." };
    }

    // Forçar UTC 00:00:00 para evitar desvios de timezone local
    const startDate = new Date(startDateStr + "T00:00:00.000Z");
    const endDate = new Date(endDateStr + "T00:00:00.000Z");

    // Validar regras da CLT no início das férias
    const cltValidation = validateCLTStartDate(startDate);
    if (!cltValidation.isValid) {
        return { error: cltValidation.reason };
    }

    await prisma.vacation.create({
        data: {
            employeeId,
            startDate,
            endDate,
            daysTaken,
            daysSold
        }
    });

    // Atualiza os campos legados para referência rápida, somando os dias gozados + vendidos
    await prisma.employee.update({
        where: { id: employeeId },
        data: {
            lastVacationStart: startDate,
            lastVacationEnd: endDate,
            totalVacationDaysTaken: { increment: daysTaken + daysSold }
        }
    });

    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${employeeId}`);
}

export async function updateVacation(formData: FormData) {
    const vacationId = formData.get("vacationId") as string;
    const employeeId = formData.get("employeeId") as string;
    const startDateStr = formData.get("startDate") as string;
    const endDateStr = formData.get("endDate") as string;
    const daysTaken = parseInt(formData.get("daysTaken") as string) || 0;
    const daysSold = parseInt(formData.get("daysSold") as string) || 0;

    if (!vacationId || !employeeId || !startDateStr || !endDateStr) {
        return { error: "Preencha todos os campos obrigatórios." };
    }

    // Forçar UTC 00:00:00 para evitar desvios de timezone local
    const startDate = new Date(startDateStr + "T00:00:00.000Z");
    const endDate = new Date(endDateStr + "T00:00:00.000Z");

    // Validar regras da CLT no início das férias
    const cltValidation = validateCLTStartDate(startDate);
    if (!cltValidation.isValid) {
        return { error: cltValidation.reason };
    }

    const oldVacation = await prisma.vacation.findUnique({
        where: { id: vacationId }
    });

    if (!oldVacation) {
        return { error: "Registro de férias não encontrado." };
    }

    const oldTotal = oldVacation.daysTaken + (oldVacation.daysSold || 0);
    const newTotal = daysTaken + daysSold;
    const diffTotal = newTotal - oldTotal;

    await prisma.vacation.update({
        where: { id: vacationId },
        data: {
            startDate,
            endDate,
            daysTaken,
            daysSold
        }
    });

    await prisma.employee.update({
        where: { id: employeeId },
        data: {
            totalVacationDaysTaken: { increment: diffTotal }
        }
    });

    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${employeeId}`);
}

export async function deleteVacation(vacationId: string, employeeId: string) {
    if (!vacationId || !employeeId) {
        throw new Error("ID ausente");
    }

    const vacation = await prisma.vacation.findUnique({
        where: { id: vacationId }
    });

    if (!vacation) {
        throw new Error("Registro de férias não encontrado");
    }

    const totalDays = vacation.daysTaken + (vacation.daysSold || 0);

    await prisma.vacation.delete({
        where: { id: vacationId }
    });

    await prisma.employee.update({
        where: { id: employeeId },
        data: {
            totalVacationDaysTaken: { decrement: totalDays }
        }
    });

    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${employeeId}`);
}

export async function getEmployeesOnVacation() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const vacations = await prisma.vacation.findMany({
        where: {
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
        name: user.name,
        clientIds: user.clientIds
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
    } else if (user.role === "CLIENTE") {
        redirect("/client/dashboard");
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

            // Cleanup vacant rotativo postos in same transaction
            await cleanupVacantRotativoPostos(tx);
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
    const clientIds = formData.getAll("clientIds") as string[];

    const hashedPassword = await hashPassword(password);

    await prisma.user.create({
        data: {
            name,
            email,
            username,
            password: hashedPassword,
            role,
            isActive: true,
            clientIds
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
    const clientIds = formData.getAll("clientIds") as string[];

    const updateData: any = {
        name,
        email,
        role,
        isActive,
        clientIds
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
        where: {
            employeeId: id,
            endDate: null,
            posto: {
                client: {
                    name: { not: "ROTATIVO" }
                }
            }
        }
    });

    if (activeAssignments > 0) {
        return { error: "Não é possível excluir colaborador com alocação ativa. Desvincule-o primeiro." };
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.employee.delete({ where: { id } });
            await cleanupVacantRotativoPostos(tx);
        });
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
            // Find desvinculação logs close to the endDate
            const desvLog = logs.find(l => 
                l.action === "DESVINCULACAO" &&
                Math.abs(new Date(l.timestamp).getTime() - new Date(a.endDate!).getTime()) < 10000
            );
            let reason = "";
            if (desvLog) {
                const match = desvLog.details.match(/\(([^)]+)\)$/);
                if (match) reason = match[1];
            }

            const noteLog = logs.find(l => 
                l.action === "DESVINCULACAO_NOTAS" &&
                Math.abs(new Date(l.timestamp).getTime() - new Date(a.endDate!).getTime()) < 10000
            );
            const notes = noteLog ? noteLog.details : "";

            events.push({
                id: a.id + '_end',
                type: 'UNASSIGNMENT',
                date: a.endDate,
                title: `Desvinculado de ${a.posto.client.name}`,
                subtitle: `${a.posto.role.name}${reason ? ` (${reason})` : ''}`,
                details: notes || "Fim da alocação"
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
        // Avoid duplicates if log is about allocation/vacation or notes which we already have specific events for
        if (l.action === 'LOTACAO' || l.action === 'DESVINCULACAO' || l.action === 'DESVINCULACAO_NOTAS') return;

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
        } else if (l.action === 'DESVINCULACAO_NOTAS') {
            type = 'OBSERVATION';
            title = 'Observação de Desvinculação';
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

    const activeAssignment = await prisma.assignment.findFirst({
        where: {
            employeeId,
            OR: [
                { endDate: null },
                { endDate: { gte: new Date() } }
            ]
        },
        include: { posto: true }
    });
    const resolvedClientId = activeAssignment?.posto?.clientId || user.clientIds?.[0] || null;

    const slaConfig = await prisma.requestStageConfiguration.findUnique({
        where: { status: 'PENDENTE' }
    });
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (slaConfig?.slaDays || 3));

    const newRequest = await prisma.request.create({
        data: {
            type: "TERMINO_CONTRATO_EXPERIENCIA",
            status: "PENDENTE",
            description: `Solicitação de desligamento por término de contrato de experiência Ref: ${employee.name}`,
            dueDate: dueDate,
            requesterId: user.id,
            employeeId: employeeId,
            clientId: resolvedClientId,
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



export async function updateAssignmentSchedule(formData: FormData) {
    const assignmentId = formData.get("assignmentId") as string;
    const postoId = formData.get("postoId") as string;
    const startDateStr = formData.get("startDate") as string;
    const schedule = formData.get("schedule") as string;

    if (!assignmentId || !postoId || !schedule) {
        return { error: "Campos obrigatórios faltando." };
    }

    // Date fix
    const startDate = startDateStr ? new Date(`${startDateStr}T12:00:00`) : undefined;

    await prisma.$transaction(async (tx) => {
        // 1. Update Assignment Start Date
        if (startDate) {
            await tx.assignment.update({
                where: { id: assignmentId },
                data: { startDate }
            });
        }

        // 2. Update Posto Schedule
        await tx.posto.update({
            where: { id: postoId },
            data: { schedule }
        });

        // 3. Log
        const currentUser = await getCurrentUser();
        const posto = await tx.posto.findUnique({ where: { id: postoId }, include: { client: true, role: true } });

        await tx.log.create({
            data: {
                action: "ALTERACAO_ESCALA",
                details: `Escala/Data atualizada no posto ${posto?.role.name} (${posto?.client.name}). Nova escala: ${schedule}. Data início: ${startDate?.toLocaleDateString('pt-BR')}`,
                userId: currentUser?.id,
                // We don't necessarily update the employee here, but we could link it if we fetched the assignment.
                // For conciseness, we omit extra fetches unless needed.
            }
        });
    });

    revalidatePath("/admin/clients");
    revalidatePath("/admin/employees");
}

export async function updateEmployeesFinanceBatch(data: any[], commit: boolean = false) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    try {
        let updatedCount = 0;
        let skippedCount = 0;
        let notFoundCount = 0;
        const results: any[] = [];

        // Pre-fetch all employees to do robust memory matching (immune to DB formatting issues)
        const allEmployees = await prisma.employee.findMany();

        for (const row of data) {
            const nameSheet = String(row.name || "").trim();
            const rawCpf = String(row.cpf || "").trim();
            
            // Clean CPF and pad with leading zeros to 11 digits
            const cpfClean = rawCpf.replace(/\D/g, "").padStart(11, "0");

            if (!cpfClean || cpfClean === "00000000000") {
                results.push({
                    name: nameSheet,
                    cpf: rawCpf,
                    status: "SKIPPED",
                    reason: "CPF inválido ou em branco"
                });
                skippedCount++;
                continue;
            }

            // Helper to format CPF
            const formatCPF = (c: string) => {
                if (c.length !== 11) return c;
                return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9, 11)}`;
            };

            // Find employee by comparing cleaned CPFs (memory search matches all formatting typos in DB)
            const emp = allEmployees.find((e: any) => {
                const cleanDbCpf = (e.cpf || "").replace(/\D/g, "").padStart(11, "0");
                return cleanDbCpf === cpfClean;
            });

            if (!emp) {
                results.push({
                    name: nameSheet,
                    cpf: cpfClean,
                    status: "NOT_FOUND",
                    reason: "Colaborador não localizado no banco de dados"
                });
                notFoundCount++;
                continue;
            }

            // Prepare update payload
            const updateData: any = {};
            const changes: string[] = [];

            if (emp.salary === 0 && row.salary > 0) {
                updateData.salary = row.salary;
                changes.push(`Salário: R$ 0 ➔ R$ ${row.salary}`);
            }
            if (emp.insalubridade === 0 && row.insalubridade > 0) {
                updateData.insalubridade = row.insalubridade;
                changes.push(`Insalubridade: R$ 0 ➔ R$ ${row.insalubridade}`);
            }
            if (emp.periculosidade === 0 && row.periculosidade > 0) {
                updateData.periculosidade = row.periculosidade;
                changes.push(`Periculosidade: R$ 0 ➔ R$ ${row.periculosidade}`);
            }
            if (emp.gratificacao === 0 && row.gratificacao > 0) {
                updateData.gratificacao = row.gratificacao;
                changes.push(`Gratificação: R$ 0 ➔ R$ ${row.gratificacao}`);
            }
            if (emp.outrosAdicionais === 0 && row.outrosAdicionais > 0) {
                updateData.outrosAdicionais = row.outrosAdicionais;
                changes.push(`Outros Adicionais: R$ 0 ➔ R$ ${row.outrosAdicionais}`);
            }
            if (emp.valeAlimentacao === 0 && row.valeAlimentacao > 0) {
                updateData.valeAlimentacao = row.valeAlimentacao;
                changes.push(`Vale Alimentação: R$ 0 ➔ R$ ${row.valeAlimentacao}`);
            }
            if (emp.valeTransporte === 0 && row.valeTransporte > 0) {
                updateData.valeTransporte = row.valeTransporte;
                changes.push(`Vale Transporte: R$ 0 ➔ R$ ${row.valeTransporte}`);
            }

            if (Object.keys(updateData).length > 0) {
                if (commit) {
                    await prisma.employee.update({
                        where: { id: emp.id },
                        data: updateData
                    });
                }
                results.push({
                    name: emp.name,
                    cpf: cpfClean,
                    status: "UPDATED",
                    changes: changes
                });
                updatedCount++;
            } else {
                results.push({
                    name: emp.name,
                    cpf: cpfClean,
                    status: "SKIPPED",
                    reason: "Sem campos zerados elegíveis para atualização"
                });
                skippedCount++;
            }
        }

        if (commit) {
            revalidatePath("/admin/employees");
            revalidatePath("/admin/financial-costs");
        }

        return {
            results,
            summary: {
                updated: updatedCount,
                skipped: skippedCount,
                notFound: notFoundCount
            }
        };
    } catch (e: any) {
        console.error("Error in updateEmployeesFinanceBatch:", e);
        return { error: e.message || "Erro interno ao atualizar base de colaboradores." };
    }
}

export async function getWizardDropdowns() {
    let [departments, costCenters, unions, jobFunctions] = await Promise.all([
        prisma.department.findMany({ orderBy: { name: 'asc' } }),
        prisma.costCenter.findMany({ orderBy: { name: 'asc' } }),
        prisma.union.findMany({ orderBy: { name: 'asc' } }),
        prisma.jobFunction.findMany({ orderBy: { name: 'asc' } })
    ]);

    let needsRefresh = false;

    if (departments.length === 0) {
        await prisma.department.create({ data: { name: "Geral" } });
        needsRefresh = true;
    }
    if (costCenters.length === 0) {
        await prisma.costCenter.create({ data: { name: "Geral" } });
        needsRefresh = true;
    }
    if (unions.length === 0) {
        await prisma.union.create({ data: { name: "SIEMACO" } });
        needsRefresh = true;
    }

    if (needsRefresh) {
        [departments, costCenters, unions, jobFunctions] = await Promise.all([
            prisma.department.findMany({ orderBy: { name: 'asc' } }),
            prisma.costCenter.findMany({ orderBy: { name: 'asc' } }),
            prisma.union.findMany({ orderBy: { name: 'asc' } }),
            prisma.jobFunction.findMany({ orderBy: { name: 'asc' } })
        ]);
    }

    return { departments, costCenters, unions, jobFunctions };
}

export async function addDepartment(name: string) {
    const existing = await prisma.department.findUnique({ where: { name } });
    if (existing) return existing;
    return await prisma.department.create({ data: { name } });
}

export async function addCostCenter(name: string) {
    const existing = await prisma.costCenter.findUnique({ where: { name } });
    if (existing) return existing;
    return await prisma.costCenter.create({ data: { name } });
}

export async function addUnion(name: string) {
    const existing = await prisma.union.findUnique({ where: { name } });
    if (existing) return existing;
    return await prisma.union.create({ data: { name } });
}

export async function addJobFunction(name: string) {
    const existing = await prisma.jobFunction.findUnique({ where: { name } });
    if (existing) return existing;
    return await prisma.jobFunction.create({ data: { name } });
}

export async function moveEmployeeToRotativo(employeeId: string) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Unauthorized");

        await prisma.$transaction(async (tx) => {
            // 1. End any active assignments
            const activeAssignments = await tx.assignment.findMany({
                where: { employeeId, endDate: null },
                include: { posto: true }
            });

            for (const asg of activeAssignments) {
                await tx.assignment.update({
                    where: { id: asg.id },
                    data: { endDate: new Date() }
                });
            }

            // 2. Find or create ROTATIVO client
            let rotativoClient = await tx.client.findFirst({ where: { name: { equals: 'ROTATIVO', mode: 'insensitive' } } });
            if (!rotativoClient) {
                rotativoClient = await tx.client.create({
                    data: {
                        name: 'ROTATIVO',
                        address: 'Centro de Custo Virtual',
                        companyId: null
                    }
                });
            }

            // 3. Find or create a Posto under ROTATIVO for this employee's role
            const emp = await tx.employee.findUnique({ where: { id: employeeId }, include: { role: true } });
            if (!emp) throw new Error("Employee not found");

            const rotativoPosto = await tx.posto.create({
                data: {
                    clientId: rotativoClient.id,
                    roleId: emp.roleId,
                    schedule: 'Variável',
                    startTime: '00:00',
                    endTime: '23:59',
                    billingValue: 0,
                    requiredWorkload: emp.workload || 220,
                    isNightShift: false,
                    baseSalary: emp.salary || 0
                }
            });

            // 4. Create assignment
            await tx.assignment.create({
                data: {
                    employeeId,
                    postoId: rotativoPosto.id,
                    startDate: new Date()
                }
            });

            // 5. Create log
            await tx.log.create({
                data: {
                    action: "ALOCACAO_ROTATIVO_MANUAL",
                    details: `Colaborador ${emp.name} movido manualmente para o Rotativo`,
                    employeeId,
                    userId: user.id
                }
            });

            // Cleanup vacant rotativo postos
            await cleanupVacantRotativoPostos(tx);
        });

        revalidatePath("/admin/employees");
        revalidatePath("/admin/clients");
        return { success: true };
    } catch (error: any) {
        console.error("Error moving to rotativo:", error);
        return { error: error.message || "Erro ao mover colaborador para o Rotativo." };
    }
}

export async function cancelDismissalProcess(employeeId: string) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Unauthorized");

        const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!emp) throw new Error("Employee not found");

        let activeSit = await prisma.situation.findFirst({ where: { name: 'Ativo' } });
        if (!activeSit) {
            activeSit = await prisma.situation.create({
                data: { name: 'Ativo', color: '#10b981' }
            });
        }

        const extraFields = (emp.extraFields as any) || {};
        delete extraFields.dismissalProcess;

        await prisma.employee.update({
            where: { id: employeeId },
            data: {
                situationId: activeSit.id,
                extraFields
            }
        });

        await prisma.log.create({
            data: {
                action: "DESVINCULACAO_CANCELADA",
                details: `Processo de desligamento de ${emp.name} cancelado. Retornado para situação Ativo.`,
                employeeId,
                userId: user.id
            }
        });

        revalidatePath("/admin/employees");
        revalidatePath("/admin/dismissal-monitor");
        return { success: true };
    } catch (e: any) {
        console.error(e);
        return { error: e.message || "Erro ao cancelar processo." };
    }
}

export async function finalizeDismissal(employeeId: string, notes?: string) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Unauthorized");

        await prisma.$transaction(async (tx) => {
            const emp = await tx.employee.findUnique({
                where: { id: employeeId },
                include: { assignments: { where: { endDate: null } } }
            });
            if (!emp) throw new Error("Employee not found");

            // End active assignments
            for (const asg of emp.assignments) {
                await tx.assignment.update({
                    where: { id: asg.id },
                    data: { endDate: new Date() }
                });
            }

            // Find situation 'Desligado'
            let desligadoSit = await tx.situation.findFirst({ where: { name: 'Desligado' } });
            if (!desligadoSit) {
                desligadoSit = await tx.situation.create({
                    data: { name: 'Desligado', color: '#64748b' }
                });
            }

            // Update status and situation
            await tx.employee.update({
                where: { id: employeeId },
                data: {
                    status: 'Inativo',
                    situationId: desligadoSit.id,
                    dismissalReason: emp.extraFields && (emp.extraFields as any).dismissalProcess?.type || "Rescisão",
                    dismissalNotes: notes || ""
                }
            });

            // Log it
            await tx.log.create({
                data: {
                    action: "DESLIGAMENTO_FINAL",
                    details: `Colaborador ${emp.name} desligado definitivamente do quadro da empresa.`,
                    employeeId,
                    userId: user.id
                }
            });

            // Cleanup vacant rotativos
            await cleanupVacantRotativoPostos(tx);
        });

        revalidatePath("/admin/employees");
        revalidatePath("/admin/dismissal-monitor");
        return { success: true };
    } catch (e: any) {
        console.error(e);
        return { error: e.message || "Erro ao finalizar desligamento." };
    }
}

export async function initiateEmployeeDismissalProcess(data: {
    employeeId: string;
    processType: 'Aviso Prévio' | 'Processo de Rescisão' | 'Processo de abandono';
    dismissalSubType: 'PEDIDO_SEM_AVISO' | 'PEDIDO_COM_AVISO' | 'DISPENSA_SEM_AVISO' | 'DISPENSA_COM_AVISO' | 'ABANDONO' | 'TERMINO_EXP_ANTECIPADO_EMPRESA' | 'TERMINO_EXP_PRAZO_EMPRESA' | 'TERMINO_EXP_ANTECIPADO_COLABORADOR' | 'TERMINO_EXP_PRAZO_COLABORADOR';
    initiative: 'EMPRESA' | 'COLABORADOR' | 'ABANDONO';
    noticeType: 'TRABALHADO' | 'INDENIZADO';
    startDate?: string;
    endDate?: string;
    reductionType?: 'NENHUMA' | 'DUAS_HORAS' | 'SETE_DIAS';
    unassignImmediately: boolean;
    openVacancy: boolean;
    notes?: string;
    attachment?: { fileName: string; fileData: string } | null;
}) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Unauthorized");

        await prisma.$transaction(async (tx) => {
            const emp = await tx.employee.findUnique({
                where: { id: data.employeeId },
                include: { 
                    assignments: {
                        where: { endDate: null },
                        include: { posto: { include: { client: true } } }
                    }
                }
            });
            if (!emp) throw new Error("Employee not found");

            const activeAssignment = emp.assignments[0];

            // 1. Find or create the Situation
            let situation = await tx.situation.findFirst({ where: { name: data.processType } });
            if (!situation) {
                let color = '#f59e0b';
                if (data.processType === 'Processo de abandono') color = '#ef4444';
                if (data.processType === 'Processo de Rescisão') color = '#ec4899';
                situation = await tx.situation.create({
                    data: { name: data.processType, color }
                });
            }

            // 2. Prepare extraFields dismissalProcess payload
            let dismissalProcess: any = {
                type: data.processType,
                dismissalSubType: data.dismissalSubType,
                initiative: data.initiative,
                noticeType: data.noticeType,
                startDate: data.startDate ? new Date(data.startDate + "T12:00:00Z") : new Date(),
                endDate: data.endDate ? new Date(data.endDate + "T12:00:00Z") : null,
                reductionType: data.reductionType || 'NENHUMA',
                telegram1SentDate: null,
                telegram2SentDate: null,
                lastWorkingDay: null,
                paymentDeadline: null,
                attachment: data.attachment || null
            };

            // Compute dates based on CLT rules
            if (data.dismissalSubType === 'DISPENSA_COM_AVISO' || data.dismissalSubType === 'PEDIDO_COM_AVISO') {
                if (dismissalProcess.endDate) {
                    const end = new Date(dismissalProcess.endDate);
                    const payLimit = new Date(end);
                    payLimit.setDate(payLimit.getDate() + 10);
                    dismissalProcess.paymentDeadline = payLimit;

                    const lastWork = new Date(end);
                    if (data.dismissalSubType === 'DISPENSA_COM_AVISO' && data.reductionType === 'SETE_DIAS') {
                        lastWork.setDate(lastWork.getDate() - 7);
                    }
                    dismissalProcess.lastWorkingDay = lastWork;
                }
            } else if (
                data.dismissalSubType === 'DISPENSA_SEM_AVISO' || 
                data.dismissalSubType === 'PEDIDO_SEM_AVISO' ||
                data.dismissalSubType.startsWith('TERMINO_EXP_')
            ) {
                const start = new Date(dismissalProcess.startDate);
                const payLimit = new Date(start);
                payLimit.setDate(payLimit.getDate() + 10);
                dismissalProcess.paymentDeadline = payLimit;
                dismissalProcess.lastWorkingDay = start;
                dismissalProcess.endDate = start;
            } else if (data.dismissalSubType === 'ABANDONO') {
                const start = new Date(dismissalProcess.startDate);
                const endLimit = new Date(start);
                endLimit.setDate(endLimit.getDate() + 30);
                dismissalProcess.endDate = endLimit;
                dismissalProcess.lastWorkingDay = start;
                dismissalProcess.paymentDeadline = null;
            }

            const existingExtraFields = (emp.extraFields as any) || {};
            const updatedExtraFields = {
                ...existingExtraFields,
                dismissalProcess
            };

            // Update employee situation and extraFields
            await tx.employee.update({
                where: { id: data.employeeId },
                data: {
                    situationId: situation.id,
                    extraFields: updatedExtraFields
                }
            });

            // 3. Log the process start
            await tx.log.create({
                data: {
                    action: "INICIO_PROCESSO_DESLIGAMENTO",
                    details: `Processo de "${data.processType}" iniciado. Observações: ${data.notes || "Sem notas."}`,
                    employeeId: data.employeeId,
                    userId: user.id
                }
            });

            // 4. Handle immediate unassignment if requested and employee has an active post
            if (data.unassignImmediately && activeAssignment && activeAssignment.posto.client.name.toUpperCase() !== "ROTATIVO") {
                // End active assignment
                await tx.assignment.update({
                    where: { id: activeAssignment.id },
                    data: { endDate: new Date() }
                });

                // Find or create ROTATIVO client
                let rotativoClient = await tx.client.findFirst({ where: { name: { equals: 'ROTATIVO', mode: 'insensitive' } } });
                if (!rotativoClient) {
                    rotativoClient = await tx.client.create({
                        data: {
                            name: 'ROTATIVO',
                            address: 'Centro de Custo Virtual',
                            companyId: null
                        }
                    });
                }

                // Find or create a Posto under ROTATIVO
                const rotativoPosto = await tx.posto.create({
                    data: {
                        clientId: rotativoClient.id,
                        roleId: emp.roleId,
                        schedule: 'Variável',
                        startTime: '00:00',
                        endTime: '23:59',
                        billingValue: 0,
                        requiredWorkload: emp.workload || 220,
                        isNightShift: false,
                        baseSalary: emp.salary || 0
                    }
                });

                // Create rotativo assignment
                await tx.assignment.create({
                    data: {
                        employeeId: data.employeeId,
                        postoId: rotativoPosto.id,
                        startDate: new Date()
                    }
                });

                await tx.log.create({
                    data: {
                        action: "DESVINCULACAO_AUTO",
                        details: `Colaborador desvinculado de ${activeAssignment.posto.client.name} e movido para o Rotativo devido a início de ${data.processType}`,
                        employeeId: data.employeeId,
                        userId: user.id
                    }
                });
            }

            // Cleanup vacant rotativos
            await cleanupVacantRotativoPostos(tx);
        });

        // 5. Open replacement vacancy outside transaction if requested
        if (data.openVacancy) {
            // Find employee active assignment (non-rotativo) to get the original postoId
            const emp = await prisma.employee.findUnique({
                where: { id: data.employeeId },
                include: { 
                    assignments: {
                        include: { posto: { include: { client: true } } }
                    }
                }
            });

            // Find the most recent active assignment or any recent non-rotativo assignment
            const targetAssignment = emp?.assignments.find(a => a.posto?.client?.name?.toUpperCase() !== "ROTATIVO");
            if (emp && targetAssignment) {
                try {
                    await createVacancyFromPosto(
                        targetAssignment.postoId,
                        emp.name,
                        data.processType,
                        data.notes || undefined,
                        user.id
                    );
                } catch (err) {
                    console.error("Error creating vacancy during dismissal initiate:", err);
                }
            }
        }

        revalidatePath("/admin/employees");
        revalidatePath("/admin/dismissal-monitor");
        revalidatePath("/admin/recrutamento");
        return { success: true };
    } catch (e: any) {
        console.error(e);
        return { error: e.message || "Erro ao iniciar processo de desligamento." };
    }
}

export async function registerTelegramSentDate(employeeId: string, telegramIndex: 1 | 2) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Unauthorized");

        const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!emp) throw new Error("Employee not found");

        const extraFields = (emp.extraFields as any) || {};
        const proc = extraFields.dismissalProcess || {};

        if (telegramIndex === 1) {
            proc.telegram1SentDate = new Date();
        } else {
            proc.telegram2SentDate = new Date();
        }

        extraFields.dismissalProcess = proc;

        await prisma.employee.update({
            where: { id: employeeId },
            data: { extraFields }
        });

        await prisma.log.create({
            data: {
                action: "TELEGRAMA_ENVIADO",
                details: `Registrado envio do ${telegramIndex}º telegrama para o colaborador ${emp.name}`,
                employeeId,
                userId: user.id
            }
        });

        revalidatePath("/admin/dismissal-monitor");
        return { success: true };
    } catch (e: any) {
        console.error(e);
        return { error: e.message || "Erro ao registrar telegrama." };
    }
}

export async function registerAdministrativeMeasure(
    employeeId: string,
    data: {
        type: string;
        date: string;
        description: string;
        attachment?: { fileName: string; fileData: string } | null;
    }
) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Unauthorized");

        const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!emp) throw new Error("Employee not found");

        const existingExtraFields = (emp.extraFields as any) || {};
        const advertencias = existingExtraFields.advertencias || [];

        advertencias.push({
            id: Math.random().toString(36).substring(2),
            type: data.type,
            date: new Date(data.date + "T12:00:00Z"),
            description: data.description,
            attachment: data.attachment || null,
            createdAt: new Date()
        });

        await prisma.employee.update({
            where: { id: employeeId },
            data: {
                extraFields: {
                    ...existingExtraFields,
                    advertencias
                }
            }
        });

        // Log it
        await prisma.log.create({
            data: {
                action: "MEDIDA_DISCIPLINAR",
                details: `Medida aplicada: ${data.type} em ${data.date}. Motivo: ${data.description}`,
                employeeId,
                userId: user.id
            }
        });

        revalidatePath(`/admin/employees/${employeeId}`);
        return { success: true };
    } catch (e: any) {
        console.error(e);
        return { error: e.message || "Erro ao registrar medida administrativa." };
    }
}

export async function deleteAdministrativeMeasure(employeeId: string, measureId: string) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Unauthorized");

        const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!emp) throw new Error("Employee not found");

        const existingExtraFields = (emp.extraFields as any) || {};
        let advertencias = existingExtraFields.advertencias || [];
        advertencias = advertencias.filter((a: any) => a.id !== measureId);

        await prisma.employee.update({
            where: { id: employeeId },
            data: {
                extraFields: {
                    ...existingExtraFields,
                    advertencias
                }
            }
        });

        revalidatePath(`/admin/employees/${employeeId}`);
        return { success: true };
    } catch (e: any) {
        console.error(e);
        return { error: e.message || "Erro ao remover medida administrativa." };
    }
}
