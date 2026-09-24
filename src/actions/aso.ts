"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { differenceInDays, format, addMonths } from "date-fns";
import { dispatchRhNotification, sendZapiRaw } from "@/lib/rh-notifications";

export type AsoStatus = "VENCIDO" | "CRITICO" | "ATENCAO" | "EM_DIA" | "SEM_CADASTRO";

export interface AsoEmployeeItem {
    id: string;
    name: string;
    cpf: string;
    phone: string | null;
    companyName: string;
    postoLabel: string;
    clientName: string;
    roleName: string;
    supervisorName: string | null;
    supervisorPhone: string | null;
    admissionDate: string;
    asoDate: string | null;
    asoDueDate: string | null;
    asoType: string;
    asoValidityMonths: string;
    asoClinic: string;
    asoDoctor: string;
    asoDoctorCrm: string;
    asoDoctorCrmUf: string;
    asoApto: string;
    asoNotes: string;
    daysLeft: number | null;
    status: AsoStatus;
}

export interface AsoStats {
    vencidos: number;
    critico30d: number;
    atencao60d: number;
    emDia: number;
    semCadastro: number;
    total: number;
}

export async function getAsoMonitorData() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const employees = await prisma.employee.findMany({
        where: {
            status: { notIn: ["Desligado", "Inativo"] }
        },
        include: {
            company: { select: { id: true, name: true } },
            role: { select: { id: true, name: true } },
            situation: { select: { id: true, name: true } },
            assignments: {
                where: { endDate: null },
                include: {
                    posto: {
                        include: {
                            client: {
                                include: {
                                    accountManager: {
                                        select: { id: true, name: true, phone: true }
                                    }
                                }
                            }
                        }
                    }
                },
                take: 1
            }
        },
        orderBy: { name: "asc" }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items: AsoEmployeeItem[] = employees.map(emp => {
        const extra = (emp.extraFields as any) || {};

        const rawAsoDate = extra.asoDate || extra.asoData || null;
        let rawAsoDueDate = extra.asoDueDate || extra.asoVencimento || null;

        // Se tiver data de realização mas não tiver vencimento, projeta +12 meses
        if (rawAsoDate && !rawAsoDueDate) {
            try {
                const parts = rawAsoDate.split("-").map(Number);
                if (parts.length === 3) {
                    const d = new Date(parts[0], parts[1] - 1, parts[2]);
                    const months = parseInt(extra.asoValidityMonths) || 12;
                    d.setMonth(d.getMonth() + months);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, "0");
                    const day = String(d.getDate()).padStart(2, "0");
                    rawAsoDueDate = `${y}-${m}-${day}`;
                }
            } catch {
                // fallback
            }
        }

        let daysLeft: number | null = null;
        let status: AsoStatus = "SEM_CADASTRO";

        if (rawAsoDueDate) {
            try {
                const parts = rawAsoDueDate.split("-").map(Number);
                if (parts.length === 3) {
                    const dueDate = new Date(parts[0], parts[1] - 1, parts[2]);
                    dueDate.setHours(0, 0, 0, 0);
                    daysLeft = differenceInDays(dueDate, today);

                    if (daysLeft < 0) {
                        status = "VENCIDO";
                    } else if (daysLeft <= 30) {
                        status = "CRITICO";
                    } else if (daysLeft <= 60) {
                        status = "ATENCAO";
                    } else {
                        status = "EM_DIA";
                    }
                }
            } catch {
                status = "SEM_CADASTRO";
            }
        }

        const assignment = emp.assignments[0];
        const postoLabel = assignment?.posto?.client?.name || "Rotativo / Sem Posto";
        const clientName = assignment?.posto?.client?.name || "Sem Cliente";
        const supervisor = assignment?.posto?.client?.accountManager;

        return {
            id: emp.id,
            name: emp.name,
            cpf: emp.cpf,
            phone: emp.phone || null,
            companyName: emp.company?.name || "Sem Empresa",
            postoLabel,
            clientName,
            roleName: emp.role?.name || "Geral",
            supervisorName: supervisor?.name || null,
            supervisorPhone: supervisor?.phone || null,
            admissionDate: emp.admissionDate ? format(new Date(emp.admissionDate), "yyyy-MM-dd") : "",
            asoDate: rawAsoDate,
            asoDueDate: rawAsoDueDate,
            asoType: extra.asoType || extra.asoTipo || (rawAsoDate ? "Periódico" : "Não informado"),
            asoValidityMonths: extra.asoValidityMonths || "12",
            asoClinic: extra.asoClinic || extra.asoClinica || "",
            asoDoctor: extra.asoDoctor || extra.asoMedico || "",
            asoDoctorCrm: extra.asoDoctorCrm || extra.asoCrm || "",
            asoDoctorCrmUf: extra.asoDoctorCrmUf || "PR",
            asoApto: extra.asoApto || extra.asoStatus || (rawAsoDate ? "Apto" : "Pendente"),
            asoNotes: extra.asoNotes || extra.asoObservacoes || "",
            daysLeft,
            status
        };
    });

    const stats: AsoStats = {
        vencidos: items.filter(i => i.status === "VENCIDO").length,
        critico30d: items.filter(i => i.status === "CRITICO").length,
        atencao60d: items.filter(i => i.status === "ATENCAO").length,
        emDia: items.filter(i => i.status === "EM_DIA").length,
        semCadastro: items.filter(i => i.status === "SEM_CADASTRO").length,
        total: items.length
    };

    return { items, stats };
}

export async function updateEmployeeAso(employeeId: string, data: {
    asoDate: string;
    asoDueDate: string;
    asoType: string;
    asoValidityMonths: string;
    asoClinic?: string;
    asoDoctor?: string;
    asoDoctorCrm?: string;
    asoDoctorCrmUf?: string;
    asoApto: string;
    asoNotes?: string;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const emp = await prisma.employee.findUnique({
        where: { id: employeeId }
    });

    if (!emp) throw new Error("Colaborador não encontrado.");

    const existingExtra = (emp.extraFields as any) || {};

    const updatedExtra = {
        ...existingExtra,
        asoDate: data.asoDate,
        asoDueDate: data.asoDueDate,
        asoType: data.asoType,
        asoValidityMonths: data.asoValidityMonths,
        asoClinic: data.asoClinic || "",
        asoDoctor: data.asoDoctor || "",
        asoDoctorCrm: data.asoDoctorCrm || "",
        asoDoctorCrmUf: data.asoDoctorCrmUf || "PR",
        asoApto: data.asoApto,
        asoNotes: data.asoNotes || "",
        asoLastUpdatedAt: new Date().toISOString(),
        asoLastUpdatedBy: user.name
    };

    await prisma.employee.update({
        where: { id: employeeId },
        data: {
            extraFields: updatedExtra
        }
    });

    revalidatePath("/admin/aso-monitor");
    revalidatePath("/admin/employees");
    return { success: true };
}

export async function sendManualAsoAlert(employeeId: string, targetType: "SUPERVISOR" | "EMPLOYEE" | "GROUPS") {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const emp = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
            company: true,
            role: true,
            assignments: {
                where: { endDate: null },
                include: {
                    posto: {
                        include: {
                            client: {
                                include: { accountManager: true }
                            }
                        }
                    }
                },
                take: 1
            }
        }
    });

    if (!emp) throw new Error("Colaborador não encontrado.");

    const extra = (emp.extraFields as any) || {};
    const asoDate = extra.asoDate || "Não informado";
    const asoDueDate = extra.asoDueDate || "Não definido";
    const clientName = emp.assignments[0]?.posto?.client?.name || "Rotativo / Sem Posto";
    const supervisor = emp.assignments[0]?.posto?.client?.accountManager;

    const formatBrDate = (dStr: string) => {
        if (!dStr || dStr.length < 8) return dStr;
        const parts = dStr.split("-");
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dStr;
    };

    const message = `🩺 *[ALERTA DE VENCIMENTO DO ASO - SAÚDE OCUPACIONAL]*\n\n` +
                    `👤 *Colaborador:* ${emp.name}\n` +
                    `📄 *CPF:* ${emp.cpf}\n` +
                    `🏢 *Empresa:* ${emp.company?.name || "N/A"}\n` +
                    `📍 *Posto/Cliente:* ${clientName}\n` +
                    `💼 *Função:* ${emp.role?.name || "N/A"}\n` +
                    `📅 *Data do Último ASO:* ${formatBrDate(asoDate)}\n` +
                    `⚠️ *Vencimento Previsto:* ${formatBrDate(asoDueDate)}\n` +
                    `🏥 *Tipo:* ${extra.asoType || "Periódico"}\n\n` +
                    `🎯 *Ação:* Agendar exame periódico para emissão de novo ASO e envio ao DP.`;

    if (targetType === "SUPERVISOR") {
        if (!supervisor?.phone) {
            throw new Error(`Supervisor ${supervisor?.name || "do contrato"} não possui telefone cadastrado.`);
        }
        const res = await sendZapiRaw(supervisor.phone, `${message}\n\n_Enviado por: ${user.name} via WorkForce Hub_`);
        if (!res.success) throw new Error(res.error || "Falha ao enviar mensagem ao supervisor.");
        return { success: true, message: `Alerta enviado com sucesso para ${supervisor.name} (${supervisor.phone})!` };
    }

    if (targetType === "EMPLOYEE") {
        if (!emp.phone) {
            throw new Error(`Colaborador ${emp.name} não possui telefone cadastrado.`);
        }
        const empMessage = `Olá, *${emp.name}*!\n\n` +
                           `Informamos que o seu *Atestado de Saúde Ocupacional (ASO)* está próximo do vencimento (${formatBrDate(asoDueDate)}).\n\n` +
                           `Favor entrar em contato com o Departamento Pessoal para agendamento do seu exame médico periódico.\n\n` +
                           `_WorkForce Hub • Saúde e Segurança Ocupacional_`;
        const res = await sendZapiRaw(emp.phone, empMessage);
        if (!res.success) throw new Error(res.error || "Falha ao enviar mensagem ao colaborador.");
        return { success: true, message: `Alerta enviado com sucesso para ${emp.name} (${emp.phone})!` };
    }

    // Default: GROUPS via Central de Notificações
    await dispatchRhNotification({
        event: "ASO",
        title: `Vencimento de ASO - ${emp.name}`,
        message,
        contractSupervisorPhone: supervisor?.phone || null,
        contractSupervisorName: supervisor?.name || null,
        metadata: { employeeId: emp.id, asoDueDate }
    });

    return { success: true, message: "Notificação disparada nos canais do RH com sucesso!" };
}
