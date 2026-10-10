"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { SecullumApiClient } from "@/lib/secullum";
import { getBenefitsConfig } from "@/actions/benefits";
import { ApprovalType, ApprovalStatus } from "@prisma/client";

/**
 * Retorna as configurações do cliente Secullum
 */
async function getSecullumClient() {
    const config = await getBenefitsConfig();
    if (!config?.secullumApiToken || !config?.secullumCompanyId) {
        return null;
    }
    return new SecullumApiClient(
        config.secullumApiToken,
        config.secullumCompanyId,
        config.secullumApiUrl || "https://pontowebintegracaoexterna.secullum.com.br"
    );
}

/**
 * Busca listagem de solicitações de aprovação com filtros
 */
export async function getApprovalRequests(filters?: {
    status?: string;
    type?: string;
    searchTerm?: string;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const where: any = {};

    if (filters?.status && filters.status !== "ALL") {
        where.status = filters.status as ApprovalStatus;
    }

    if (filters?.type && filters.type !== "ALL") {
        where.type = filters.type as ApprovalType;
    }

    if (filters?.searchTerm && filters.searchTerm.trim()) {
        const term = filters.searchTerm.trim();
        where.OR = [
            { title: { contains: term, mode: "insensitive" } },
            { employeeName: { contains: term, mode: "insensitive" } },
            { clientName: { contains: term, mode: "insensitive" } },
            { postoName: { contains: term, mode: "insensitive" } },
            { requesterName: { contains: term, mode: "insensitive" } },
        ];
    }

    const requests = await prisma.approvalRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
            employee: {
                select: {
                    id: true,
                    name: true,
                    cpf: true,
                    phone: true,
                }
            },
            client: {
                select: {
                    id: true,
                    name: true
                }
            },
            posto: {
                select: {
                    id: true,
                    startTime: true,
                    endTime: true,
                    schedule: true,
                    notes: true
                }
            },
            requester: {
                select: {
                    id: true,
                    name: true,
                    role: true
                }
            },
            n1Approver: {
                select: {
                    id: true,
                    name: true,
                    role: true
                }
            },
            n2Approver: {
                select: {
                    id: true,
                    name: true,
                    role: true
                }
            }
        }
    });

    return requests;
}

/**
 * Busca contadores de solicitações de aprovação para métricas e badges
 */
export async function getApprovalMetrics() {
    const [
        totalPending,
        pendingN1,
        pendingN2,
        approvedTotal,
        rejectedTotal
    ] = await Promise.all([
        prisma.approvalRequest.count({
            where: { status: { in: [ApprovalStatus.PENDENTE_N1, ApprovalStatus.PENDENTE_N2] } }
        }),
        prisma.approvalRequest.count({
            where: { status: ApprovalStatus.PENDENTE_N1 }
        }),
        prisma.approvalRequest.count({
            where: { status: ApprovalStatus.PENDENTE_N2 }
        }),
        prisma.approvalRequest.count({
            where: { status: ApprovalStatus.APROVADO }
        }),
        prisma.approvalRequest.count({
            where: { status: ApprovalStatus.REPROVADO }
        })
    ]);

    return {
        totalPending,
        pendingN1,
        pendingN2,
        approvedTotal,
        rejectedTotal
    };
}

/**
 * Cria uma nova solicitação de aprovação hierárquica (N1 / N2)
 */
export async function createApprovalRequest(data: {
    type: ApprovalType;
    title: string;
    description?: string;
    employeeId?: string;
    clientId?: string;
    postoId?: string;
    snapshotCurrent?: any;
    snapshotProposed: any;
    executionPayload: any;
    n1Required?: boolean;
    n2Required?: boolean;
}) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    // Resolver nomes de entidades relacionadas para auditoria rápida
    let employeeName: string | undefined;
    let clientName: string | undefined;
    let postoName: string | undefined;

    if (data.employeeId) {
        const emp = await prisma.employee.findUnique({ where: { id: data.employeeId }, select: { name: true } });
        if (emp) employeeName = emp.name;
    }

    if (data.clientId) {
        const cli = await prisma.client.findUnique({ where: { id: data.clientId }, select: { name: true } });
        if (cli) clientName = cli.name;
    }

    if (data.postoId) {
        const pos = await prisma.posto.findUnique({ 
            where: { id: data.postoId }, 
            include: { role: true, client: true } 
        });
        if (pos) {
            postoName = `${pos.client?.name || 'Cliente'} - ${pos.role?.name || 'Cargo'} (${pos.schedule} ${pos.startTime}-${pos.endTime})`;
            if (!clientName && pos.client?.name) clientName = pos.client.name;
        }
    }

    const request = await prisma.approvalRequest.create({
        data: {
            type: data.type,
            status: ApprovalStatus.PENDENTE_N1,
            title: data.title,
            description: data.description || null,
            employeeId: data.employeeId || null,
            employeeName: employeeName || null,
            clientId: data.clientId || null,
            clientName: clientName || null,
            postoId: data.postoId || null,
            postoName: postoName || null,
            requesterId: user.id,
            requesterName: user.name,
            snapshotCurrent: data.snapshotCurrent || null,
            snapshotProposed: data.snapshotProposed,
            executionPayload: data.executionPayload,
            n1Required: data.n1Required !== undefined ? data.n1Required : true,
            n2Required: data.n2Required !== undefined ? data.n2Required : true,
        }
    });

    await prisma.log.create({
        data: {
            action: "CRIACAO_SOLICITACAO_APROVACAO",
            details: `Solicitação criada: ${data.title} (${data.type}) para aprovação N1.`,
            employeeId: data.employeeId || null,
            userId: user.id
        }
    });

    revalidatePath("/admin/aprovacoes");
    return { success: true, request };
}

/**
 * Processa a decisão de um aprovador (N1 ou N2)
 */
export async function processApprovalDecision(
    requestId: string,
    decision: "APROVAR" | "REPROVAR",
    feedback?: string
) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autenticado");

        const request = await prisma.approvalRequest.findUnique({
            where: { id: requestId }
        });

        if (!request) {
            throw new Error("Solicitação de aprovação não encontrada.");
        }

        if (request.status === ApprovalStatus.APROVADO || request.status === ApprovalStatus.REPROVADO) {
            throw new Error(`Esta solicitação já foi finalizada como ${request.status}.`);
        }

        const now = new Date();

        // 1. Processamento NÍVEL 1 (N1)
        if (request.status === ApprovalStatus.PENDENTE_N1) {
            if (decision === "REPROVAR") {
                await prisma.approvalRequest.update({
                    where: { id: requestId },
                    data: {
                        status: ApprovalStatus.REPROVADO,
                        n1ApproverId: user.id,
                        n1ApproverName: user.name,
                        n1ApprovedAt: now,
                        n1Decision: "REPROVADO",
                        n1Feedback: feedback || "Reprovado na etapa N1."
                    }
                });

                await prisma.log.create({
                    data: {
                        action: "REPROVACAO_N1",
                        details: `Solicitação "${request.title}" reprovada no N1 por ${user.name}. Motivo: ${feedback || "Sem observações"}`,
                        employeeId: request.employeeId || null,
                        userId: user.id
                    }
                });

                revalidatePath("/admin/aprovacoes");
                return { success: true, status: ApprovalStatus.REPROVADO, message: "Solicitação reprovada no N1." };
            }

            // Se APROVAR no N1:
            if (request.n2Required) {
                // Avança para o N2
                await prisma.approvalRequest.update({
                    where: { id: requestId },
                    data: {
                        status: ApprovalStatus.PENDENTE_N2,
                        n1ApproverId: user.id,
                        n1ApproverName: user.name,
                        n1ApprovedAt: now,
                        n1Decision: "APROVADO",
                        n1Feedback: feedback || "Aprovado no N1 e encaminhado para N2."
                    }
                });

                await prisma.log.create({
                    data: {
                        action: "APROVACAO_N1",
                        details: `Solicitação "${request.title}" aprovada no N1 por ${user.name}. Encaminhada para N2.`,
                        employeeId: request.employeeId || null,
                        userId: user.id
                    }
                });

                revalidatePath("/admin/aprovacoes");
                return { success: true, status: ApprovalStatus.PENDENTE_N2, message: "Aprovado no N1! Aguardando deliberação N2." };
            } else {
                // Não precisa de N2 -> Aprova e executa direto
                await prisma.approvalRequest.update({
                    where: { id: requestId },
                    data: {
                        status: ApprovalStatus.APROVADO,
                        n1ApproverId: user.id,
                        n1ApproverName: user.name,
                        n1ApprovedAt: now,
                        n1Decision: "APROVADO",
                        n1Feedback: feedback || "Aprovado no N1."
                    }
                });

                // Executa no WFH e Secullum
                const execResult = await executeApprovedRequest(requestId, user.name);

                revalidatePath("/admin/aprovacoes");
                return { 
                    success: true, 
                    status: ApprovalStatus.APROVADO, 
                    message: "Aprovado com sucesso! Alterações efetivadas e sincronizadas com o Secullum.",
                    execution: execResult 
                };
            }
        }

        // 2. Processamento NÍVEL 2 (N2)
        if (request.status === ApprovalStatus.PENDENTE_N2) {
            if (decision === "REPROVAR") {
                await prisma.approvalRequest.update({
                    where: { id: requestId },
                    data: {
                        status: ApprovalStatus.REPROVADO,
                        n2ApproverId: user.id,
                        n2ApproverName: user.name,
                        n2ApprovedAt: now,
                        n2Decision: "REPROVADO",
                        n2Feedback: feedback || "Reprovado na etapa N2."
                    }
                });

                await prisma.log.create({
                    data: {
                        action: "REPROVACAO_N2",
                        details: `Solicitação "${request.title}" reprovada no N2 por ${user.name}. Motivo: ${feedback || "Sem observações"}`,
                        employeeId: request.employeeId || null,
                        userId: user.id
                    }
                });

                revalidatePath("/admin/aprovacoes");
                return { success: true, status: ApprovalStatus.REPROVADO, message: "Solicitação reprovada no N2." };
            }

            // Se APROVAR no N2:
            await prisma.approvalRequest.update({
                where: { id: requestId },
                data: {
                    status: ApprovalStatus.APROVADO,
                    n2ApproverId: user.id,
                    n2ApproverName: user.name,
                    n2ApprovedAt: now,
                    n2Decision: "APROVADO",
                    n2Feedback: feedback || "Aprovado no N2."
                }
            });

            await prisma.log.create({
                data: {
                    action: "APROVACAO_N2",
                    details: `Solicitação "${request.title}" aprovada no N2 por ${user.name}. Iniciando efetivação e sincronização Secullum...`,
                    employeeId: request.employeeId || null,
                    userId: user.id
                }
            });

            // Executa no WFH e Secullum
            const execResult = await executeApprovedRequest(requestId, user.name);

            revalidatePath("/admin/aprovacoes");
            return { 
                success: true, 
                status: ApprovalStatus.APROVADO, 
                message: "Aprovado no N2! Alterações efetivadas no sistema e integradas ao ponto.",
                execution: execResult 
            };
        }

        throw new Error("Estado de aprovação inválido.");
    } catch (error: any) {
        console.error("[processApprovalDecision] Erro:", error);
        return { success: false, error: error.message || "Erro ao processar aprovação." };
    }
}

/**
 * Efetiva a solicitação aprovada no banco de dados e envia para o Secullum
 */
async function executeApprovedRequest(requestId: string, approverName: string) {
    const request = await prisma.approvalRequest.findUnique({
        where: { id: requestId },
        include: { employee: true, posto: true }
    });

    if (!request) return { error: "Solicitação não encontrada." };

    const payload = (request.executionPayload as any) || {};
    const secullum = await getSecullumClient();
    let secullumSuccess = false;
    let secullumLogMsg = "";

    try {
        // ── 1. MUDANÇA DE POSTO / HORÁRIO / ESCALA ───────────────────
        if (
            request.type === ApprovalType.MUDANCA_POSTO ||
            request.type === ApprovalType.MUDANCA_ESCALA ||
            request.type === ApprovalType.MUDANCA_HORARIO
        ) {
            const { employeeId, targetPostoId, horarioSecullumNumero } = payload;

            if (employeeId && targetPostoId) {
                // Desaloca posto anterior
                await prisma.assignment.updateMany({
                    where: { employeeId, endDate: null },
                    data: { endDate: new Date() }
                });

                // Aloca no novo posto
                await prisma.assignment.create({
                    data: {
                        employeeId,
                        postoId: targetPostoId,
                        startDate: new Date()
                    }
                });
            }

            // Sincroniza horário com Secullum se fornecido
            if (secullum && request.employee?.cpf && horarioSecullumNumero) {
                const sRes = await secullum.atualizarHorarioFuncionario({
                    cpf: request.employee.cpf,
                    employeeName: request.employee.name,
                    numeroFolha: undefined,
                    horarioNumero: Number(horarioSecullumNumero)
                });
                secullumSuccess = sRes.success;
                secullumLogMsg = sRes.message;
            } else if (!secullum) {
                secullumLogMsg = "Secullum não configurado ou credenciais ausentes.";
            } else {
                secullumLogMsg = "Posto atualizado no WFH (sem código de horário específico para Secullum).";
                secullumSuccess = true;
            }
        }

        // ── 2. DESLIGAMENTO ──────────────────────────────────────────
        else if (request.type === ApprovalType.DESLIGAMENTO) {
            const { employeeId, dataDemissao, processType, dismissalSubType, noticeType, notes } = payload;

            if (employeeId) {
                // Atualiza situação do colaborador para Processo de Rescisão ou Inativo
                let sit = await prisma.situation.findFirst({
                    where: { name: processType || "Processo de Rescisão" }
                });
                if (!sit) {
                    sit = await prisma.situation.create({
                        data: { name: processType || "Processo de Rescisão", color: "#ec4899" }
                    });
                }

                const dismissalDate = dataDemissao ? new Date(dataDemissao + "T12:00:00Z") : new Date();

                await prisma.employee.update({
                    where: { id: employeeId },
                    data: {
                        situationId: sit.id,
                        extraFields: {
                            ...(request.employee?.extraFields as any || {}),
                            dismissalProcess: {
                                type: processType || "Processo de Rescisão",
                                dismissalSubType: dismissalSubType || "DISPENSA_SEM_AVISO",
                                noticeType: noticeType || "INDENIZADO",
                                startDate: dismissalDate,
                                endDate: dismissalDate,
                                notes: notes || null,
                                approvedBy: approverName,
                                approvedAt: new Date().toISOString()
                            }
                        }
                    }
                });

                // Se solicitou desalocação imediata, encerra os postos ativos
                await prisma.assignment.updateMany({
                    where: { employeeId, endDate: null },
                    data: { endDate: dismissalDate }
                });
            }

            // Sincroniza baixa de demissão no Secullum
            if (secullum && request.employee?.cpf) {
                const demissaoStr = payload.dataDemissao || new Date().toISOString().split("T")[0];
                const sRes = await secullum.lancarDemissao({
                    cpf: request.employee.cpf,
                    employeeName: request.employee.name,
                    numeroFolha: undefined,
                    dataDemissao: demissaoStr,
                    motivo: payload.dismissalSubType || "Demissão Aprovada"
                });
                secullumSuccess = sRes.success;
                secullumLogMsg = sRes.message;
            } else {
                secullumLogMsg = secullum ? "CPF não informado para Secullum." : "Secullum não configurado.";
            }
        }

        // ── 3. FÉRIAS ────────────────────────────────────────────────
        else if (request.type === ApprovalType.FERIAS) {
            const { employeeId, startDate, endDate, daysTaken, daysSold, notes } = payload;

            if (employeeId && startDate && endDate) {
                const startUtc = new Date(startDate + "T00:00:00.000Z");
                const endUtc = new Date(endDate + "T00:00:00.000Z");

                await prisma.vacation.create({
                    data: {
                        employeeId,
                        startDate: startUtc,
                        endDate: endUtc,
                        daysTaken: Number(daysTaken) || 30,
                        daysSold: Number(daysSold) || 0,
                        notes: notes || null,
                        createdByName: approverName
                    }
                });

                await prisma.employee.update({
                    where: { id: employeeId },
                    data: {
                        lastVacationStart: startUtc,
                        lastVacationEnd: endUtc,
                        totalVacationDaysTaken: { increment: (Number(daysTaken) || 30) + (Number(daysSold) || 0) }
                    }
                });
            }

            // Sincroniza afastamento por Férias no Secullum
            if (secullum && request.employee?.cpf && startDate && endDate) {
                const sRes = await secullum.lancarFerias({
                    cpf: request.employee.cpf,
                    employeeName: request.employee.name,
                    numeroFolha: undefined,
                    inicio: startDate,
                    fim: endDate,
                    observacoes: notes || "Férias Aprovadas no Fluxo de Aprovação"
                });
                secullumSuccess = sRes.success;
                secullumLogMsg = sRes.message;
            } else {
                secullumLogMsg = secullum ? "Datas de férias ou CPF ausentes." : "Secullum não configurado.";
            }
        }

        // Atualiza a solicitação com a marca de efetivação
        await prisma.approvalRequest.update({
            where: { id: requestId },
            data: {
                appliedAt: new Date(),
                appliedBy: approverName,
                secullumSynced: secullumSuccess,
                secullumSyncedAt: secullumSuccess ? new Date() : null,
                secullumLog: secullumLogMsg
            }
        });

        // Revalida páginas
        revalidatePath("/admin/employees");
        revalidatePath("/admin/dismissal-monitor");
        revalidatePath("/admin/vacation-monitor");
        revalidatePath("/admin/aprovacoes");

        return { success: true, secullumSuccess, secullumLog: secullumLogMsg };
    } catch (err: any) {
        console.error("[executeApprovedRequest] Erro na execução:", err);
        await prisma.approvalRequest.update({
            where: { id: requestId },
            data: {
                errorMessage: err.message || "Erro desconhecido durante execução."
            }
        });
        return { success: false, error: err.message };
    }
}
