"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser, getCurrentUserRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { SecullumApiClient } from "@/lib/secullum";
import { getBenefitsConfig } from "@/actions/benefits";
import { ApprovalType, ApprovalStatus, SystemRole } from "@prisma/client";

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
            { employee: { name: { contains: term, mode: "insensitive" } } },
            { clientName: { contains: term, mode: "insensitive" } },
            { client: { name: { contains: term, mode: "insensitive" } } },
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

    // Buscar regra de alçada para o tipo
    const rule = await prisma.approvalWorkflowRule.findUnique({
        where: { type: data.type }
    });

    const n1Required = data.n1Required !== undefined ? data.n1Required : (rule ? rule.n1Enabled : true);
    const n2Required = data.n2Required !== undefined ? data.n2Required : (rule ? rule.n2Enabled : true);

    // Verificar hierarquia e superior imediato do solicitante
    const requester = await prisma.user.findUnique({
        where: { id: user.id },
        select: { 
            id: true, 
            managerId: true, 
            isApproverN1: true,
            isApproverN2: true, 
            role: true,
            manager: {
                select: { id: true, name: true, role: true, isApproverN1: true, isApproverN2: true }
            }
        }
    });

    // Se o gestor imediato do solicitante já for um aprovador N2 (ou ADMIN da Diretoria como Cristiano),
    // ou se o solicitante NÃO tiver superior imediato,
    // ou se o próprio solicitante já for um Gestor N1 (como o Wellington):
    // A solicitação NUNCA fica parada para ele aprovar a si mesmo! Pula a etapa N1 e sobe DIRETO para o N2 (Diretoria / Cristiano).
    // Aprovado no N2, o fluxo fica liberado imediatamente para o RH trabalhar.
    const requesterIsN1 = !!(requester?.isApproverN1 || requester?.role === 'SUPERVISOR');
    const directManagerIsN2 = !!(requester?.manager?.isApproverN2 || requester?.manager?.role === 'ADMIN');
    const hasN1 = !!(requester?.managerId && !directManagerIsN2 && !requesterIsN1);

    // REGRA DE N1 E N2:
    // 1. Colaborador comum com gestor N1 (ex: equipe do Wellington) -> passa primeiro pelo N1 (Wellington), depois sobe para o N2 (Cristiano) e libera pro RH.
    // 2. O próprio Gestor N1 solicita (ex: Wellington pede desligamento) -> PULA N1 e vai DIRETO para o N2 (Cristiano). Sem autoaprovação!
    // 3. Quem está ligado direto ao N2 (ex: Kesia ligada ao Cristiano) -> vai DIRETO para o N2 (Cristiano).
    // 4. Quem não tem superior imediato -> vai DIRETO para o N2.
    let initialStatus: ApprovalStatus;
    let effectiveN1Required = n1Required;

    if (!hasN1) {
        effectiveN1Required = false;
        initialStatus = n2Required ? ApprovalStatus.PENDENTE_N2 : ApprovalStatus.APROVADO;
    } else if (!n1Required) {
        initialStatus = n2Required ? ApprovalStatus.PENDENTE_N2 : ApprovalStatus.APROVADO;
    } else {
        initialStatus = ApprovalStatus.PENDENTE_N1;
    }

    const request = await prisma.approvalRequest.create({
        data: {
            type: data.type,
            status: initialStatus,
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
            n1Required: effectiveN1Required,
            n2Required,
        }
    });

    const routingDetails = !hasN1 
        ? `Solicitante sem N1 (Direção Geral) -> Sobe direto para o Nível 2 (N2).` 
        : (effectiveN1Required ? `Encaminhada para aprovação N1 (Gestor Imediato).` : `Encaminhada para aprovação N2.`);

    await prisma.log.create({
        data: {
            action: "CRIACAO_SOLICITACAO_APROVACAO",
            details: `Solicitação criada: ${data.title} (${data.type}) - ${routingDetails}`,
            employeeId: data.employeeId || null,
            userId: user.id
        }
    });

    // Notificar Aprovador correspondente via WhatsApp (Z-API)
    await notifyApprovalFlow({
        event: initialStatus === ApprovalStatus.PENDENTE_N1 ? 'NOVA_SOLICITACAO_N1' : 'NOVA_SOLICITACAO_N2',
        requestId: request.id,
        title: data.title,
        type: data.type,
        employeeName,
        clientName,
        requesterName: user.name,
        requesterManagerId: requester?.managerId
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

        // Buscar regra de alçada configurada para o tipo de solicitação
        const rule = await prisma.approvalWorkflowRule.findUnique({
            where: { type: request.type }
        });

        // 1. Processamento NÍVEL 1 (N1)
        if (request.status === ApprovalStatus.PENDENTE_N1) {
            // Regra contra autoaprovação: o próprio solicitante nunca aprova a sua própria solicitação
            if (request.requesterId === user.id && user.role !== 'ADMIN') {
                throw new Error("Você é o solicitante deste pedido e não pode deliberar na sua própria solicitação.");
            }

            let canApproveN1 = false;
            if (user.role === 'ADMIN') {
                canApproveN1 = true;
            } else if (rule?.n1ApproverType === "DIRECT_MANAGER") {
                if (request.requesterId) {
                    const requester = await prisma.user.findUnique({
                        where: { id: request.requesterId },
                        select: { managerId: true }
                    });
                    if (requester?.managerId === user.id) {
                        canApproveN1 = true;
                    }
                }
                // Se o solicitante não possui gestor imediato cadastrado, COORD_RH pode deliberar
                if (!canApproveN1 && user.role === 'COORD_RH') {
                    canApproveN1 = true;
                }
            } else if (rule?.n1ApproverType === "ROLE") {
                if (user.role === (rule.n1TargetRole || 'COORD_RH')) {
                    canApproveN1 = true;
                }
            } else if (rule?.n1ApproverType === "SPECIFIC_USER") {
                if (user.id === rule.n1TargetUserId) {
                    canApproveN1 = true;
                }
            } else {
                if (user.role === 'ADMIN' || user.role === 'COORD_RH') {
                    canApproveN1 = true;
                }
            }

            if (!canApproveN1) {
                throw new Error("Você não possui permissão/alçada para deliberar nesta solicitação no Nível 1 (N1).");
            }

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

                await notifyApprovalFlow({
                    event: 'REPROVADO',
                    requestId,
                    title: request.title,
                    type: request.type,
                    employeeName: request.employeeName,
                    clientName: request.clientName,
                    requesterName: request.requesterName,
                    n1ApproverName: user.name,
                    feedback
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

                // Notificar N2 e RH do avanço
                await notifyApprovalFlow({
                    event: 'AVANCO_N2',
                    requestId,
                    title: request.title,
                    type: request.type,
                    employeeName: request.employeeName,
                    clientName: request.clientName,
                    requesterName: request.requesterName,
                    n1ApproverName: user.name,
                    feedback
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

                // Notificar RH de liberação final
                await notifyApprovalFlow({
                    event: 'APROVADO_FINAL',
                    requestId,
                    title: request.title,
                    type: request.type,
                    employeeName: request.employeeName,
                    clientName: request.clientName,
                    requesterName: request.requesterName,
                    n1ApproverName: user.name,
                    feedback
                });

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
            let canApproveN2 = false;
            const dbApprover = await prisma.user.findUnique({
                where: { id: user.id },
                select: { isApproverN2: true, role: true }
            });

            if (user.role === 'ADMIN' || dbApprover?.isApproverN2) {
                canApproveN2 = true;
            } else if (rule?.n2ApproverType === "SPECIFIC_USER") {
                if (user.id === rule.n2TargetUserId) {
                    canApproveN2 = true;
                }
            } else if (rule?.n2ApproverType === "ROLE") {
                if (user.role === (rule.n2TargetRole || 'ADMIN')) {
                    canApproveN2 = true;
                }
            }

            if (!canApproveN2) {
                throw new Error("Você não possui permissão/alçada para deliberar nesta solicitação no Nível 2 (N2).");
            }
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

                await notifyApprovalFlow({
                    event: 'REPROVADO',
                    requestId,
                    title: request.title,
                    type: request.type,
                    employeeName: request.employeeName,
                    clientName: request.clientName,
                    requesterName: request.requesterName,
                    n1ApproverName: request.n1ApproverName,
                    n2ApproverName: user.name,
                    feedback
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

            // Notificar RH de liberação final para dar sequência operacional
            await notifyApprovalFlow({
                event: 'APROVADO_FINAL',
                requestId,
                title: request.title,
                type: request.type,
                employeeName: request.employeeName,
                clientName: request.clientName,
                requesterName: request.requesterName,
                n1ApproverName: request.n1ApproverName,
                n2ApproverName: user.name,
                feedback
            });

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
            const { employeeId, postoId, targetPostoId, startDateStr, schedule, createVacancy, reason, horarioSecullumNumero, requesterName, requesterId } = payload;
            const finalPostoId = postoId || targetPostoId;

            if (employeeId && finalPostoId) {
                const { internalExecuteAssignment } = await import("@/app/actions");
                await internalExecuteAssignment({
                    employeeId,
                    postoId: finalPostoId,
                    startDateStr,
                    schedule,
                    createVacancy,
                    reason: reason || request.description || "Alocação Aprovada",
                    requesterName: requesterName || request.requesterName,
                    requesterId: requesterId || request.requesterId || undefined,
                    approverName
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
                secullumLogMsg = "Posto atualizado no WFH com sucesso.";
                secullumSuccess = true;
            }
        }

        // ── 2. DESLIGAMENTO ──────────────────────────────────────────
        else if (request.type === ApprovalType.DESLIGAMENTO) {
            const { internalExecuteDismissal } = await import("@/app/actions");
            await internalExecuteDismissal({
                employeeId: payload.employeeId || request.employeeId!,
                processType: payload.processType || "Processo de Rescisão",
                dismissalSubType: payload.dismissalSubType || "DISPENSA_SEM_AVISO",
                initiative: payload.initiative || "EMPRESA",
                noticeType: payload.noticeType || "INDENIZADO",
                noticeDays: (payload.dismissalSubType || request.snapshotProposed && (request.snapshotProposed as any).dismissalSubType) === "ABANDONO" ? 0 : (payload.noticeDays || 30),
                startDate: payload.startDate,
                endDate: payload.endDate,
                reductionType: payload.reductionType || "NENHUMA",
                unassignImmediately: payload.unassignImmediately !== false,
                openVacancy: payload.openVacancy !== false,
                notes: payload.notes || request.description || undefined,
                attachment: payload.attachment || null,
                terminationSimulation: payload.terminationSimulation || (request.snapshotProposed as any)?.terminationSimulation || null,
                requesterName: payload.requesterName || request.requesterName,
                requesterId: payload.requesterId || request.requesterId || undefined,
                approverName
            });

            secullumSuccess = true;
            secullumLogMsg = "Desligamento efetivado e liberado para o DP com simulação de rescisão vinculada.";
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

/**
 * Regras padrão de aprovação por tipo de solicitação
 */
const DEFAULT_RULES = [
    {
        type: ApprovalType.DESLIGAMENTO,
        name: "Desligamento e Rescisão",
        description: "Demissões e desligamentos solicitados pela operação",
        n1Enabled: true,
        n1ApproverType: "DIRECT_MANAGER",
        n1TargetRole: SystemRole.COORD_RH,
        n2Enabled: true,
        n2ApproverType: "ROLE",
        n2TargetRole: SystemRole.ADMIN,
    },
    {
        type: ApprovalType.FERIAS,
        name: "Programação de Férias",
        description: "Agendamento e concessão de férias de colaboradores",
        n1Enabled: true,
        n1ApproverType: "DIRECT_MANAGER",
        n1TargetRole: SystemRole.COORD_RH,
        n2Enabled: true,
        n2ApproverType: "ROLE",
        n2TargetRole: SystemRole.ADMIN,
    },
    {
        type: ApprovalType.MUDANCA_POSTO,
        name: "Mudança de Posto / Cliente",
        description: "Transferência de colaborador entre postos ou clientes",
        n1Enabled: true,
        n1ApproverType: "DIRECT_MANAGER",
        n1TargetRole: SystemRole.COORD_RH,
        n2Enabled: true,
        n2ApproverType: "ROLE",
        n2TargetRole: SystemRole.ADMIN,
    },
    {
        type: ApprovalType.MUDANCA_HORARIO,
        name: "Mudança de Horário de Trabalho",
        description: "Alteração de jornada ou faixa horária contratual",
        n1Enabled: true,
        n1ApproverType: "DIRECT_MANAGER",
        n1TargetRole: SystemRole.COORD_RH,
        n2Enabled: false,
        n2ApproverType: "ROLE",
        n2TargetRole: SystemRole.ADMIN,
    },
    {
        type: ApprovalType.MUDANCA_ESCALA,
        name: "Mudança de Escala (12x36 / Semanal)",
        description: "Alteração da escala de trabalho e revezamento",
        n1Enabled: true,
        n1ApproverType: "DIRECT_MANAGER",
        n1TargetRole: SystemRole.COORD_RH,
        n2Enabled: false,
        n2ApproverType: "ROLE",
        n2TargetRole: SystemRole.ADMIN,
    },
    {
        type: ApprovalType.AJUSTE_SALARIAL,
        name: "Ajuste Salarial / Promoção",
        description: "Alteração de remuneração ou cargo do colaborador",
        n1Enabled: true,
        n1ApproverType: "DIRECT_MANAGER",
        n1TargetRole: SystemRole.COORD_RH,
        n2Enabled: true,
        n2ApproverType: "ROLE",
        n2TargetRole: SystemRole.ADMIN,
    },
    {
        type: ApprovalType.OUTROS,
        name: "Outras Solicitações Operacionais",
        description: "Demandas gerais da operação com necessidade de alçada",
        n1Enabled: true,
        n1ApproverType: "ROLE",
        n1TargetRole: SystemRole.COORD_RH,
        n2Enabled: true,
        n2ApproverType: "ROLE",
        n2TargetRole: SystemRole.ADMIN,
    }
];

export async function getApprovalWorkflowRules() {
    let existingRules = await prisma.approvalWorkflowRule.findMany({
        orderBy: { name: 'asc' }
    });

    // Se alguma regra padrão não existir, inicializar
    for (const def of DEFAULT_RULES) {
        const found = existingRules.find(r => r.type === def.type);
        if (!found) {
            const created = await prisma.approvalWorkflowRule.create({
                data: def
            });
            existingRules.push(created);
        }
    }

    return existingRules;
}

export async function saveApprovalWorkflowRule(data: {
    type: ApprovalType;
    name?: string;
    description?: string;
    n1Enabled: boolean;
    n1ApproverType: string;
    n1TargetRole?: SystemRole | null;
    n1TargetUserId?: string | null;
    n2Enabled: boolean;
    n2ApproverType: string;
    n2TargetRole?: SystemRole | null;
    n2TargetUserId?: string | null;
}) {
    const role = await getCurrentUserRole();
    if (role !== 'ADMIN') {
        throw new Error("Apenas administradores podem configurar alçadas de aprovação.");
    }

    const updated = await prisma.approvalWorkflowRule.upsert({
        where: { type: data.type },
        update: {
            n1Enabled: data.n1Enabled,
            n1ApproverType: data.n1ApproverType,
            n1TargetRole: data.n1TargetRole || null,
            n1TargetUserId: data.n1TargetUserId || null,
            n2Enabled: data.n2Enabled,
            n2ApproverType: data.n2ApproverType,
            n2TargetRole: data.n2TargetRole || null,
            n2TargetUserId: data.n2TargetUserId || null,
            ...(data.name ? { name: data.name } : {}),
            ...(data.description ? { description: data.description } : {}),
        },
        create: {
            type: data.type,
            name: data.name || String(data.type),
            description: data.description || null,
            n1Enabled: data.n1Enabled,
            n1ApproverType: data.n1ApproverType,
            n1TargetRole: data.n1TargetRole || null,
            n1TargetUserId: data.n1TargetUserId || null,
            n2Enabled: data.n2Enabled,
            n2ApproverType: data.n2ApproverType,
            n2TargetRole: data.n2TargetRole || null,
            n2TargetUserId: data.n2TargetUserId || null,
        }
    });

    revalidatePath("/admin/aprovacoes");
    return { success: true, rule: updated };
}

/**
 * Notificador de WhatsApp para Alçada de Aprovações (N1 / N2 / RH)
 */
export async function notifyApprovalFlow(params: {
    event: 'NOVA_SOLICITACAO_N1' | 'NOVA_SOLICITACAO_N2' | 'AVANCO_N2' | 'APROVADO_FINAL' | 'REPROVADO';
    requestId: string;
    title: string;
    type?: string;
    employeeName?: string | null;
    clientName?: string | null;
    requesterName?: string | null;
    requesterManagerId?: string | null;
    n1ApproverName?: string | null;
    n2ApproverName?: string | null;
    feedback?: string | null;
}) {
    try {
        const { sendZapiRaw } = await import("@/lib/rh-notifications");

        // 1. Buscar Aprovadores N1, Aprovadores N2, Equipe RH e Configurações
        const [n1Users, n2Users, rhUsers, config] = await Promise.all([
            prisma.user.findMany({
                where: { OR: [{ isApproverN1: true }, { role: 'SUPERVISOR' }], isActive: true },
                select: { id: true, name: true, phone: true }
            }),
            prisma.user.findMany({
                where: { OR: [{ isApproverN2: true }, { role: 'ADMIN' }], isActive: true },
                select: { id: true, name: true, phone: true }
            }),
            prisma.user.findMany({
                where: { OR: [{ role: 'COORD_RH' }, { role: 'ASSIST_RH' }, { email: { contains: 'dp@' } }], isActive: true },
                select: { id: true, name: true, phone: true }
            }),
            prisma.rhNotificationConfig.findFirst()
        ]);

        const adminGroup = config?.adminGroupJid;
        const portalUrl = "https://workforce-hub-henna.vercel.app/admin/aprovacoes";

        // ── A) NOVA SOLICITAÇÃO PENDENTE N1 ──────────────────────────────
        if (params.event === 'NOVA_SOLICITACAO_N1') {
            const targets = new Set<string>();
            if (params.requesterManagerId) {
                const mgr = await prisma.user.findUnique({ 
                    where: { id: params.requesterManagerId }, 
                    select: { phone: true } 
                });
                if (mgr?.phone) targets.add(mgr.phone);
            }
            if (targets.size === 0) {
                n1Users.forEach(u => u.phone && targets.add(u.phone));
            }

            const msg = `🔔 *WORKFORCE HUB - NOVA SOLICITAÇÃO (N1)*\n\n` +
                `Uma nova solicitação foi aberta e aguarda sua aprovação como Gestor N1:\n\n` +
                `📌 *Solicitação:* ${params.title}\n` +
                `👤 *Colaborador:* ${params.employeeName || 'N/A'}\n` +
                `🏢 *Cliente/Posto:* ${params.clientName || 'N/A'}\n` +
                `✍️ *Solicitado por:* ${params.requesterName || 'Operação'}\n\n` +
                `🔗 Acesse o portal para deliberar:\n${portalUrl}`;

            for (const phone of targets) {
                await sendZapiRaw(phone, msg);
            }
        }

        // ── B) NOVA SOLICITAÇÃO PENDENTE N2 (Diretoria) ─────────────────
        else if (params.event === 'NOVA_SOLICITACAO_N2') {
            const targets = new Set<string>();
            n2Users.forEach(u => u.phone && targets.add(u.phone));
            if (adminGroup) targets.add(adminGroup);

            const msg = `👑 *WORKFORCE HUB - APROVAÇÃO DIRETORIA (N2)*\n\n` +
                `Nova solicitação aguardando deliberação da Diretoria (N2):\n\n` +
                `📌 *Solicitação:* ${params.title}\n` +
                `👤 *Colaborador:* ${params.employeeName || 'N/A'}\n` +
                `🏢 *Cliente/Posto:* ${params.clientName || 'N/A'}\n` +
                `✍️ *Solicitante:* ${params.requesterName || 'Operação'}\n` +
                `⭐ *Alçada N1:* Direto para N2 (sem N1 intermediário)\n\n` +
                `🔗 Acesse para deliberação:\n${portalUrl}`;

            for (const target of targets) {
                await sendZapiRaw(target, msg);
            }
        }

        // ── C) AVANÇO N1 ➔ N2 (N1 Aprovou) ──────────────────────────────
        else if (params.event === 'AVANCO_N2') {
            // Notifica N2 (Diretoria)
            const targetsN2 = new Set<string>();
            n2Users.forEach(u => u.phone && targetsN2.add(u.phone));
            if (adminGroup) targetsN2.add(adminGroup);

            const msgN2 = `👑 *WORKFORCE HUB - APROVADO NO N1 ➔ PENDENTE N2*\n\n` +
                `A solicitação foi aprovada no Nível 1 por *${params.n1ApproverName || 'Gestor N1'}* e subiu para aprovação final da Diretoria (N2):\n\n` +
                `📌 *Solicitação:* ${params.title}\n` +
                `👤 *Colaborador:* ${params.employeeName || 'N/A'}\n` +
                `🏢 *Cliente/Posto:* ${params.clientName || 'N/A'}\n` +
                `✍️ *Solicitante:* ${params.requesterName || 'Operação'}\n` +
                `⭐ *Parecer N1:* ${params.feedback || 'Aprovado sem ressalvas'}\n\n` +
                `🔗 Acesse para deliberação:\n${portalUrl}`;

            for (const target of targetsN2) {
                await sendZapiRaw(target, msgN2);
            }

            // Notifica RH para acompanhamento
            const targetsRh = new Set<string>();
            rhUsers.forEach(u => u.phone && targetsRh.add(u.phone));
            const msgRh = `📋 *WORKFORCE HUB - ACOMPANHAMENTO RH (AVANÇO N2)*\n\n` +
                `A solicitação *${params.title}* (${params.employeeName || 'N/A'}) foi aprovada pelo Gestor N1 (*${params.n1ApproverName || 'Gestor'}*) e avançou para a Diretoria (N2).\n` +
                `Assim que o N2 homologar, você receberá a liberação para dar sequência operacional!`;

            for (const phone of targetsRh) {
                await sendZapiRaw(phone, msgRh);
            }
        }

        // ── D) APROVADO FINAL (N2 Aprovou / Homologado) ──────────────────
        else if (params.event === 'APROVADO_FINAL') {
            // NOTIFICA O RH PARA DAR SEQUÊNCIA
            const targetsRh = new Set<string>();
            rhUsers.forEach(u => u.phone && targetsRh.add(u.phone));
            if (adminGroup) targetsRh.add(adminGroup);

            const msgRh = `✅ *WORKFORCE HUB - PROCESSO APROVADO! LIBERADO PARA O RH*\n\n` +
                `A seguinte solicitação foi *100% HOMOLOGADA* pela Diretoria e está *LIBERADA* para execução operacional do RH:\n\n` +
                `📌 *Solicitação:* ${params.title}\n` +
                `👤 *Colaborador:* ${params.employeeName || 'N/A'}\n` +
                `🏢 *Cliente/Posto:* ${params.clientName || 'N/A'}\n` +
                `⭐ *Aprovador N1:* ${params.n1ApproverName || 'Dispensado / Direto N2'}\n` +
                `👑 *Aprovador N2:* ${params.n2ApproverName || 'Diretoria'}\n` +
                `💬 *Parecer:* ${params.feedback || 'Aprovado sem ressalvas'}\n\n` +
                `👉 *Ação do RH:* Efetivar no sistema, documentos, Secullum e trâmites de departamento pessoal.\n\n` +
                `🔗 Acesse para dar sequência:\n${portalUrl}`;

            for (const target of targetsRh) {
                await sendZapiRaw(target, msgRh);
            }
        }

        // ── E) REPROVADO ─────────────────────────────────────────────────
        else if (params.event === 'REPROVADO') {
            const targets = new Set<string>();
            rhUsers.forEach(u => u.phone && targets.add(u.phone));
            if (adminGroup) targets.add(adminGroup);

            const msg = `❌ *WORKFORCE HUB - SOLICITAÇÃO REPROVADA*\n\n` +
                `A solicitação de *${params.title}* para *${params.employeeName || 'N/A'}* foi reprovada.\n\n` +
                `👤 *Deliberado por:* ${params.n1ApproverName || params.n2ApproverName || 'Diretoria'}\n` +
                `🚫 *Motivo:* ${params.feedback || 'Sem justificativa informada'}\n\n` +
                `🔗 Detalhes no portal:\n${portalUrl}`;

            for (const target of targets) {
                await sendZapiRaw(target, msg);
            }
        }
    } catch (notifErr) {
        console.error("[notifyApprovalFlow] Non-fatal notification error:", notifErr);
    }
}

/**
 * Exclui ou solicita exclusão de solicitações de aprovação (com alçada N2)
 * - Se o usuário for N2 / ADMIN: a exclusão é homologada e removida imediatamente do sistema.
 * - Se for outro perfil (ex: Gestor N1 / Supervisor): a solicitação de exclusão é encaminhada para o N2 aprovar!
 */
export async function deleteApprovalRequests(requestIds: string[], reason?: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, role: true, isApproverN2: true }
    });

    const isN2OrAdmin = !!(dbUser?.isApproverN2 || dbUser?.role === 'ADMIN');

    if (!requestIds || !requestIds.length) {
        return { success: true, count: 0, isN2OrAdmin };
    }

    if (isN2OrAdmin) {
        // N2 / ADMIN: Exclui definitivamente direto
        const count = await prisma.approvalRequest.deleteMany({
            where: { id: { in: requestIds } }
        });

        await prisma.log.create({
            data: {
                action: "EXCLUSAO_SOLICITACOES_APROVACAO",
                details: `Diretoria N2 (${user.name}) homologou e excluiu definitivamente ${count.count} solicitação(ões) obsoleta(s).`,
                userId: user.id
            }
        });

        revalidatePath("/admin/aprovacoes");
        return { 
            success: true, 
            count: count.count, 
            action: "DELETED", 
            message: `${count.count} solicitação(ões) excluída(s) com sucesso pela Diretoria N2!` 
        };
    } else {
        // Não é N2: Envia para o N2 aprovar a exclusão!
        await prisma.approvalRequest.updateMany({
            where: { id: { in: requestIds } },
            data: {
                status: ApprovalStatus.PENDENTE_N2,
                n1Decision: "SOLICITADA_EXCLUSAO",
                n1Feedback: `Exclusão solicitada por ${user.name}. Motivo: ${reason || 'Solicitação obsoleta'}`
            }
        });

        // Notifica N2 via WhatsApp
        await notifyApprovalFlow({
            event: 'NOVA_SOLICITACAO_N2',
            requestId: requestIds[0],
            title: `[SOLICITAÇÃO DE EXCLUSÃO] ${requestIds.length} solicitação(ões) obsoleta(s)`,
            requesterName: user.name
        });

        await prisma.log.create({
            data: {
                action: "SOLICITACAO_EXCLUSAO_N2",
                details: `Gestor ${user.name} solicitou ao N2 a exclusão de ${requestIds.length} solicitação(ões) obsoleta(s).`,
                userId: user.id
            }
        });

        revalidatePath("/admin/aprovacoes");
        return { 
            success: true, 
            count: requestIds.length, 
            action: "PENDING_N2", 
            message: `${requestIds.length} solicitação(ões) enviada(s) para aprovação de exclusão pelo N2 (Diretoria)!` 
        };
    }
}

/**
 * Rejeita o pedido de exclusão e retorna a solicitação para o fluxo normal de aprovação
 */
export async function rejectDeleteRequest(requestId: string, reason?: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado");

    const req = await prisma.approvalRequest.findUnique({
        where: { id: requestId }
    });

    if (!req) throw new Error("Solicitação não encontrada");

    // Retorna para o status de origem (PENDENTE_N1 ou PENDENTE_N2 dependendo da regra)
    const nextStatus = req.n1Required ? ApprovalStatus.PENDENTE_N1 : ApprovalStatus.PENDENTE_N2;

    await prisma.approvalRequest.update({
        where: { id: requestId },
        data: {
            n1Decision: null,
            n1Feedback: null,
            status: nextStatus
        }
    });

    await prisma.log.create({
        data: {
            action: "REJEICAO_SOLICITACAO_EXCLUSAO",
            details: `Diretoria N2 (${user.name}) rejeitou a exclusão da solicitação "${req.title}". O item foi mantido no fluxo de aprovação. Motivo: ${reason || 'Sem justificativa'}`,
            userId: user.id
        }
    });

    revalidatePath("/admin/aprovacoes");
    return { success: true, message: "Pedido de exclusão rejeitado. A solicitação continuará no fluxo normal." };
}



/**
 * Conclusão da etapa "Execução / RH" para solicitações aprovadas que dependem de ação manual
 * (ex.: inclusão de adicional, ajuste salarial). O RH marca como CONCLUIDO ou NAO_EXECUTADO
 * para tirar o item da fila de pendências. Guardado em executionPayload.rhConclusion
 * (sem alteração de schema).
 */
export async function concludeRhExecution(
    requestId: string,
    outcome: "CONCLUIDO" | "NAO_EXECUTADO",
    note?: string
) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado");
        if (!["ADMIN", "COORD_RH", "ASSIST_RH"].includes(String(user.role))) {
            throw new Error("Apenas o RH/DP pode concluir a execução desta solicitação.");
        }

        const cleanNote = (note || "").trim();
        if (outcome === "NAO_EXECUTADO" && !cleanNote) {
            throw new Error("Informe o motivo de a solicitação não ter sido executada.");
        }

        const request = await prisma.approvalRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new Error("Solicitação não encontrada.");
        if (request.status !== ApprovalStatus.APROVADO) {
            throw new Error("Só é possível concluir solicitações já aprovadas.");
        }

        const payload = ((request.executionPayload as any) || {}) as Record<string, any>;
        if (payload.rhConclusion) {
            throw new Error("Esta solicitação já foi concluída pelo RH.");
        }

        const rhConclusion = {
            outcome,
            by: user.name,
            byId: user.id,
            at: new Date().toISOString(),
            note: cleanNote || null,
        };

        await prisma.approvalRequest.update({
            where: { id: requestId },
            data: { executionPayload: { ...payload, rhConclusion } },
        });

        await prisma.log.create({
            data: {
                action: outcome === "CONCLUIDO" ? "RH_CONCLUIU_SOLICITACAO" : "RH_NAO_EXECUTOU_SOLICITACAO",
                details: `Solicitação "${request.title}" ${outcome === "CONCLUIDO" ? "concluída" : "marcada como não executada"} pelo RH (${user.name}).${cleanNote ? " Obs: " + cleanNote : ""}`,
                employeeId: request.employeeId || null,
                userId: user.id,
            },
        });

        revalidatePath("/admin/aprovacoes");
        return { success: true, rhConclusion };
    } catch (error: any) {
        console.error("[concludeRhExecution] Erro:", error);
        return { success: false, error: error.message || "Erro ao concluir solicitação." };
    }
}
