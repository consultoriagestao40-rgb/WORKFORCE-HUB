"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { SecullumApiClient } from "@/lib/secullum";
import { getBenefitsConfig } from "@/actions/benefits";
import { extractMedicalCertificateData, matchEmployee } from "@/lib/medical-ocr";

/**
 * Helper para instanciar o cliente Secullum
 */
async function getSecullumClient() {
    const config = await getBenefitsConfig();

    let token = config.secullumApiToken;
    let bankId = config.secullumCompanyId || "85740";
    let apiUrl = config.secullumApiUrl || "https://pontowebintegracaoexterna.secullum.com.br";

    if (apiUrl.includes("pontoweb.secullum.com.br") && !apiUrl.includes("pontowebintegracaoexterna")) {
        apiUrl = "https://pontowebintegracaoexterna.secullum.com.br";
    }

    if (!token) {
        throw new Error("Credenciais do Secullum Ponto Web não configuradas no sistema.");
    }

    return new SecullumApiClient(token, bankId, apiUrl);
}

/**
 * Busca atestados filtrados com relações completas
 */
export async function getAtestados(filters?: {
    status?: string;
    companyId?: string;
    search?: string;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const where: any = {};

    if (filters?.status && filters.status !== "ALL") {
        where.status = filters.status;
    }

    if (filters?.companyId && filters.companyId !== "ALL") {
        where.employee = {
            companyId: filters.companyId
        };
    }

    if (filters?.search && filters.search.trim()) {
        const s = filters.search.trim();
        where.OR = [
            { employeeName: { contains: s, mode: "insensitive" } },
            { extractedName: { contains: s, mode: "insensitive" } },
            { cpf: { contains: s } },
            { cid: { contains: s, mode: "insensitive" } },
            { doctorName: { contains: s, mode: "insensitive" } },
            { employee: { name: { contains: s, mode: "insensitive" } } }
        ];
    }

    const atestados = await prisma.medicalCertificate.findMany({
        where,
        include: {
            employee: {
                select: {
                    id: true,
                    name: true,
                    cpf: true,
                    role: {
                        select: { name: true }
                    },
                    companyId: true,
                    company: {
                        select: { id: true, name: true }
                    }
                }
            },
            validatedBy: {
                select: { id: true, name: true, email: true }
            }
        },
        orderBy: {
            createdAt: "desc"
        }
    });

    return atestados;
}

/**
 * Estatísticas resumidas para os cards de topo
 */
export async function getAtestadosStats() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const [pendentes, lancados, rejeitados, total] = await Promise.all([
        prisma.medicalCertificate.count({ where: { status: "PENDENTE" } }),
        prisma.medicalCertificate.count({ where: { status: "LANCADO" } }),
        prisma.medicalCertificate.count({ where: { status: "REJEITADO" } }),
        prisma.medicalCertificate.count()
    ]);

    return { pendentes, lancados, rejeitados, total };
}

/**
 * Lista de colaboradores ativos para troca rápida / autocomplete
 */
export async function getEmployeesSimpleList() {
    const emps = await prisma.employee.findMany({
        where: {
            status: { not: "INACTIVE" }
        },
        select: {
            id: true,
            name: true,
            cpf: true,
            role: {
                select: { name: true }
            },
            companyId: true,
            company: {
                select: { id: true, name: true }
            }
        },
        orderBy: { name: "asc" }
    });

    return emps.map((e) => ({
        id: e.id,
        name: e.name,
        cpf: e.cpf,
        role: e.role?.name || null,
        companyId: e.companyId,
        company: e.company
    }));
}

/**
 * Busca justificativas disponíveis na Secullum
 */
export async function getSecullumJustificativasAction() {
    try {
        const client = await getSecullumClient();
        const list = await client.getJustificativas();
        return { success: true, justificativas: list };
    } catch (error: any) {
        console.error("Erro ao obter justificativas Secullum:", error);
        return { success: false, justificativas: [], error: error.message };
    }
}

/**
 * Lança o atestado validado no Secullum Ponto Web
 */
export async function lancarAtestadoNoSecullum(params: {
    id: string;
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    days?: number;
    cid?: string;
    justificativaNome?: string;
    notes?: string;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const atestado = await prisma.medicalCertificate.findUnique({
        where: { id: params.id },
        include: {
            employee: {
                include: { company: true }
            }
        }
    });

    if (!atestado) {
        return { success: false, message: "Atestado não encontrado." };
    }

    // Identificar o colaborador final (caso o usuário tenha trocado o colaborador incorreto)
    const targetEmployeeId = params.employeeId || atestado.employeeId;
    if (!targetEmployeeId) {
        return {
            success: false,
            message: "Por favor, selecione e confirme o colaborador antes de enviar para o Secullum."
        };
    }

    const employee = await prisma.employee.findUnique({
        where: { id: targetEmployeeId },
        include: { company: true }
    });

    if (!employee || !employee.cpf) {
        return { success: false, message: "Colaborador selecionado não possui CPF cadastrado." };
    }

    const startDateStr = params.startDate || (atestado.startDate ? atestado.startDate.toISOString().split("T")[0] : null);
    const endDateStr = params.endDate || (atestado.endDate ? atestado.endDate.toISOString().split("T")[0] : startDateStr);
    const days = params.days ?? atestado.daysCount ?? 1;
    const cid = params.cid !== undefined ? params.cid : atestado.cid;
    const justNome = params.justificativaNome || atestado.justificativa || "Atestado Médico";
    const notes = params.notes !== undefined ? params.notes : atestado.notes;

    if (!startDateStr || !endDateStr) {
        return { success: false, message: "Datas de início e término são obrigatórias." };
    }

    try {
        const client = await getSecullumClient();

        const secullumRes = await client.lancarAtestadoMedico({
            cpf: employee.cpf,
            dataInicioStr: startDateStr,
            dataFimStr: endDateStr,
            dias: days,
            justificativaNome: justNome,
            cid: cid || undefined,
            observacoes: notes || undefined
        });

        if (!secullumRes.success) {
            // Registra a tentativa com falha
            await prisma.medicalCertificate.update({
                where: { id: atestado.id },
                data: {
                    employeeId: employee.id,
                    employeeName: employee.name,
                    cpf: employee.cpf,
                    secullumStatus: "ERRO",
                    secullumResponse: secullumRes.message
                }
            });

            return {
                success: false,
                message: `Falha ao lançar no Secullum: ${secullumRes.message}`
            };
        }

        // Sucesso: atualiza status para LANCADO e grava detalhes da validação
        await prisma.medicalCertificate.update({
            where: { id: atestado.id },
            data: {
                employeeId: employee.id,
                employeeName: employee.name,
                cpf: employee.cpf,
                startDate: new Date(startDateStr + "T12:00:00Z"),
                endDate: new Date(endDateStr + "T12:00:00Z"),
                daysCount: days,
                cid,
                justificativa: justNome,
                notes,
                status: "LANCADO",
                validatedById: user.id,
                validatedByName: user.name || "Administrador",
                secullumStatus: "SUCESSO",
                secullumResponse: secullumRes.message,
                secullumLancadoEm: new Date()
            }
        });

        revalidatePath("/admin/atestados");
        return {
            success: true,
            message: `Atestado lançado com sucesso no Secullum para ${employee.name}!`
        };
    } catch (error: any) {
        console.error("Erro ao comunicar com Secullum:", error);
        return {
            success: false,
            message: `Erro ao enviar atestado ao Secullum: ${error.message || error}`
        };
    }
}

/**
 * Rejeita um atestado médico
 */
export async function rejeitarAtestado(id: string, rejectionReason: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    await prisma.medicalCertificate.update({
        where: { id },
        data: {
            status: "REJEITADO",
            rejectionReason: rejectionReason.trim(),
            validatedById: user.id,
            validatedByName: user.name || "Administrador"
        }
    });

    revalidatePath("/admin/atestados");
    return { success: true };
}

/**
 * Restaura um atestado rejeitado de volta para PENDENTE
 */
export async function restaurarAtestado(id: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    await prisma.medicalCertificate.update({
        where: { id },
        data: {
            status: "PENDENTE",
            rejectionReason: null
        }
    });

    revalidatePath("/admin/atestados");
    return { success: true };
}

/**
 * Exclui permanentemente um atestado médico do sistema
 */
export async function excluirAtestado(id: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    await prisma.medicalCertificate.delete({
        where: { id }
    });

    revalidatePath("/admin/atestados");
    return { success: true };
}

/**
 * Upload manual com processamento automático de IA (Gemini Vision)
 */
export async function processarUploadAtestado(params: {
    fileBase64: string;
    mimeType?: string;
    fileName?: string;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    try {
        const mime = params.mimeType || "image/jpeg";
        // 1. Extrai dados com IA
        const extracted = await extractMedicalCertificateData(params.fileBase64, mime);

        // 2. Tenta cruzar com funcionário
        const matched = await matchEmployee({
            name: extracted.patientName,
            cpf: extracted.cpf
        });

        const startDate = extracted.startDate ? new Date(extracted.startDate + "T12:00:00Z") : new Date();
        const endDate = extracted.endDate ? new Date(extracted.endDate + "T12:00:00Z") : startDate;

        // 3. Cria o registro PENDENTE no banco
        const created = await prisma.medicalCertificate.create({
            data: {
                employeeId: matched?.id || null,
                extractedName: extracted.patientName || "Não identificado",
                employeeName: matched?.name || extracted.patientName || "Não identificado",
                cpf: matched?.cpf || extracted.cpf || null,
                startDate,
                endDate,
                daysCount: extracted.days || 1,
                cid: extracted.cid,
                doctorName: extracted.doctorName,
                doctorCrm: extracted.doctorCrm,
                documentUrl: params.fileBase64,
                status: "PENDENTE",
                source: "MANUAL",
                notes: extracted.observations
            }
        });

        revalidatePath("/admin/atestados");
        return {
            success: true,
            atestado: created,
            matchedEmployee: matched,
            extracted
        };
    } catch (error: any) {
        console.error("Erro ao processar upload de atestado:", error);
        return {
            success: false,
            error: error.message || "Erro desconhecido ao processar atestado."
        };
    }
}

/**
 * Criação manual de atestado sem IA (formulário direto)
 */
export async function salvarAtestadoManual(data: {
    employeeId: string;
    startDate: string;
    endDate: string;
    days: number;
    cid?: string;
    justificativa?: string;
    notes?: string;
    doctorName?: string;
    doctorCrm?: string;
    fileBase64?: string;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const employee = await prisma.employee.findUnique({
        where: { id: data.employeeId }
    });

    if (!employee) {
        return { success: false, error: "Colaborador não encontrado." };
    }

    await prisma.medicalCertificate.create({
        data: {
            employeeId: employee.id,
            extractedName: employee.name,
            employeeName: employee.name,
            cpf: employee.cpf,
            startDate: new Date(data.startDate + "T12:00:00Z"),
            endDate: new Date(data.endDate + "T12:00:00Z"),
            daysCount: data.days || 1,
            cid: data.cid || null,
            justificativa: data.justificativa || "Atestado Médico",
            doctorName: data.doctorName || null,
            doctorCrm: data.doctorCrm || null,
            notes: data.notes || null,
            documentUrl: data.fileBase64 || "",
            status: "PENDENTE",
            source: "MANUAL"
        }
    });

    revalidatePath("/admin/atestados");
    return { success: true };
}

/**
 * Exclui um atestado pendente ou rejeitado
 */
export async function excluirAtestado(id: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    await prisma.medicalCertificate.delete({
        where: { id }
    });

    revalidatePath("/admin/atestados");
    return { success: true };
}
