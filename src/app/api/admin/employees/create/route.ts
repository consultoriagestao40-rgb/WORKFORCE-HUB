import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { cleanupVacantRotativoPostos } from "@/app/actions";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();

        const name = (formData.get("name") as string)?.trim();
        const cpf = (formData.get("cpf") as string)?.trim();
        let roleId = (formData.get("roleId") as string)?.trim();
        const type = (formData.get("type") as string)?.trim() || "Efetivo";
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

        const postoId = formData.get("postoId") as string;

        if (!name) {
            return NextResponse.json({ error: "O nome do colaborador é obrigatório." }, { status: 400 });
        }
        if (!cpf) {
            return NextResponse.json({ error: "O CPF do colaborador é obrigatório." }, { status: 400 });
        }

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
                    return NextResponse.json({ error: "O cargo (função) é obrigatório para cadastrar o colaborador." }, { status: 400 });
                }
            } catch {
                return NextResponse.json({ error: "O cargo (função) é obrigatório para cadastrar o colaborador." }, { status: 400 });
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
            const existingCpf = await tx.employee.findUnique({ where: { cpf } });
            if (existingCpf) {
                throw new Error(`Já existe um colaborador cadastrado com o CPF ${cpf}.`);
            }

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
                    valeAlimentacao,
                    valeTransporte,
                    address: (formData.get("address") as string) || null,
                    phone: (formData.get("phone") as string) || null,
                    email: (formData.get("email") as string) || null,
                    birthDate: (formData.get("birthDate") as string) ? new Date(formData.get("birthDate") as string) : null,
                    gender: (formData.get("gender") as string) || null,
                    extraFields: extraFields || undefined
                }
            });
            createdEmployeeId = newEmployee.id;

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
                        console.warn(`[createEmployee API] Posto ${postoId} not found, proceeding without assignment.`);
                        finalPostoId = "";
                    }
                }

                if (finalPostoId) {
                    // Create Active Assignment
                    await tx.assignment.create({
                        data: {
                            employeeId: newEmployee.id,
                            postoId: finalPostoId,
                            startDate: admissionDate,
                            endDate: null
                        }
                    });

                    // Log Auto-Assignment
                    try {
                        const user = await getCurrentUser();
                        await tx.log.create({
                            data: {
                                action: "ALOCACAO_AUTOMATICA",
                                details: `Colaborador ${newEmployee.name} alocado automaticamente ao posto no cadastro (Origem: Recrutamento).`,
                                employeeId: newEmployee.id,
                                userId: user?.id
                            }
                        });
                    } catch (logErr) {
                        console.error("Warning: log creation failed in API:", logErr);
                    }
                }
            }

            try {
                await cleanupVacantRotativoPostos(tx);
            } catch (cleanupErr) {
                console.error("[ROTATIVO] Non-fatal cleanup warning in createEmployee API:", cleanupErr);
            }
        });

        return NextResponse.json({ success: true, employeeId: createdEmployeeId });
    } catch (e: any) {
        console.error("Error in employee creation API:", e);
        return NextResponse.json({ error: e.message || "Erro inesperado ao cadastrar colaborador." }, { status: 400 });
    }
}
