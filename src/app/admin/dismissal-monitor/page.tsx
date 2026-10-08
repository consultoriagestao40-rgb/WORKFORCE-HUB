export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { DashboardFilters } from "@/components/admin/DashboardFilters";
import { format, differenceInDays, addDays, startOfDay } from "date-fns";
import { AlertCircle, Calendar, Clock, UserX, User } from "lucide-react";
import { BackButton } from "@/components/admin/BackButton";
import { DismissalAlertsDialog } from "@/components/admin/DismissalAlertsDialog";
import { DPAlertSettingsDialog } from "@/components/admin/DPAlertSettingsDialog";
import { DismissalTemplatesModal } from "@/components/admin/DismissalTemplatesModal";
import { DismissalMonitorTable } from "@/components/admin/DismissalMonitorTable";
import { getCurrentUser } from "@/lib/auth";
import { getGlobalAlerts } from "@/actions/globalAlerts";

async function getDismissalProcessData(companyId?: string, search?: string) {
    const where: any = {
        status: 'Ativo',
        situation: {
            name: {
                in: ['Aviso Prévio', 'Processo de Rescisão', 'Processo de abandono']
            }
        }
    };

    if (companyId && companyId !== 'all') {
        where.companyId = companyId;
    }

    if (search) {
        where.name = { contains: search, mode: 'insensitive' };
    }

    const employees = await prisma.employee.findMany({
        where,
        select: {
            id: true,
            name: true,
            admissionDate: true,
            probationStatus: true,
            company: { select: { name: true } },
            role: { select: { name: true } },
            situation: { select: { name: true, color: true } },
            extraFields: true,
            assignments: {
                where: { endDate: null },
                include: { posto: { include: { client: true } } }
            }
        },
        orderBy: { name: 'asc' }
    });

    // Fallback: buscar logs de auditoria caso o registro de desligamento seja legado
    const empIds = employees.map((e: any) => e.id);
    const dismissalLogs = empIds.length > 0 ? await prisma.log.findMany({
        where: {
            employeeId: { in: empIds },
            action: { in: ['INITIATE_DISMISSAL', 'PROGRAMACAO_RESCISAO', 'DESVINCULACAO_POSTO', 'UPDATE_EMPLOYEE'] }
        },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { timestamp: 'desc' }
    }) : [];

    const logCreatorMap = new Map<string, { name: string; date: Date }>();
    for (const l of dismissalLogs) {
        if (l.employeeId && !logCreatorMap.has(l.employeeId) && (l.user?.name || l.user?.email)) {
            logCreatorMap.set(l.employeeId, {
                name: l.user.name || l.user.email || "Sistema",
                date: l.timestamp
            });
        }
    }

    const today = new Date();

    return employees.map((emp: any) => {
        const extra = emp.extraFields as any || {};
        const proc = extra.dismissalProcess || {};

        const fallbackLog = logCreatorMap.get(emp.id);
        const createdByName = proc.createdByName || fallbackLog?.name || "Sistema";
        const createdAt = proc.createdAt ? new Date(proc.createdAt) : (fallbackLog?.date || null);

        let type = proc.type || emp.situation?.name || "Desconhecido";
        if (proc.dismissalSubType) {
            if (proc.dismissalSubType === 'DISPENSA_COM_AVISO') {
                type = "Dispensa (Aviso Trabalhado)";
            } else if (proc.dismissalSubType === 'DISPENSA_SEM_AVISO') {
                type = "Dispensa (Aviso Indenizado)";
            } else if (proc.dismissalSubType === 'PEDIDO_COM_AVISO') {
                type = "Pedido (Aviso Trabalhado)";
            } else if (proc.dismissalSubType === 'PEDIDO_SEM_AVISO') {
                type = "Pedido (Dispensa de Aviso)";
            } else if (proc.dismissalSubType === 'ABANDONO') {
                type = "Processo de abandono";
            } else if (proc.dismissalSubType === 'TERMINO_EXP_ANTECIPADO_EMPRESA') {
                type = "Experiência Antecipada (Empresa)";
            } else if (proc.dismissalSubType === 'TERMINO_EXP_PRAZO_EMPRESA') {
                type = "Experiência no Prazo (Empresa)";
            } else if (proc.dismissalSubType === 'TERMINO_EXP_ANTECIPADO_COLABORADOR') {
                type = "Experiência Antecipada (Colaborador)";
            } else if (proc.dismissalSubType === 'TERMINO_EXP_PRAZO_COLABORADOR') {
                type = "Experiência no Prazo (Colaborador)";
            }
        } else if (emp.probationStatus === "DISMISSED" && !proc.type) {
            type = "Término de Experiência";
        }

        let startDate = proc.startDate ? new Date(proc.startDate) : null;
        let endDate = proc.endDate ? new Date(proc.endDate) : null;
        let reductionType = proc.reductionType || 'NENHUMA';
        let telegram1SentDate = proc.telegram1SentDate || null;
        let telegram2SentDate = proc.telegram2SentDate || null;
        let lastWorkingDay = proc.lastWorkingDay ? new Date(proc.lastWorkingDay) : null;
        let paymentDeadline = proc.paymentDeadline ? new Date(proc.paymentDeadline) : null;

        let dateLabel = "-";
        let daysCount = 0;
        let counterLabel = "Dias";
        let statusBadge = "NO_PRAZO"; // NO_PRAZO, A_VENCER, ALERTA
        let daysElapsed = 0;

        const todayStart = startOfDay(today);

        if (type === "Aviso Prévio" || type.includes("Aviso Trabalhado")) {
            if (startDate && endDate) {
                dateLabel = `${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`;
                if (!lastWorkingDay) {
                    lastWorkingDay = new Date(endDate);
                    if (reductionType === 'SETE_DIAS') {
                        lastWorkingDay.setDate(lastWorkingDay.getDate() - 7);
                    }
                }
                if (!paymentDeadline || (endDate && differenceInDays(startOfDay(paymentDeadline), startOfDay(endDate)) === 9)) {
                    paymentDeadline = new Date(endDate);
                    paymentDeadline.setDate(paymentDeadline.getDate() + 10);
                }

                const endStart = startOfDay(endDate);
                const payStart = startOfDay(paymentDeadline);

                // Se ainda está cumprindo aviso prévio
                if (differenceInDays(endStart, todayStart) >= 0) {
                    daysCount = differenceInDays(endStart, todayStart);
                    counterLabel = daysCount === 1 ? "Dia Restante" : "Restantes";
                    if (daysCount <= 5) statusBadge = "A_VENCER";
                    else statusBadge = "NO_PRAZO";
                } else {
                    // Aviso prévio concluído -> monitora o prazo de pagamento da rescisão
                    daysCount = differenceInDays(payStart, todayStart);
                    if (daysCount >= 0) {
                        counterLabel = daysCount === 0 ? "Vence Hoje" : (daysCount === 1 ? "Dia p/ Pgto" : "Restantes");
                        statusBadge = daysCount <= 3 ? "A_VENCER" : "NO_PRAZO";
                    } else {
                        counterLabel = "Atrasados";
                        statusBadge = "ALERTA";
                    }
                }
            }
        } else if (
            type === "Processo de Rescisão" || 
            type.includes("Experiência") || 
            type.includes("Experiencia") || 
            type.includes("Aviso Indenizado") || 
            type.includes("Dispensa de Aviso")
        ) {
            const termDate = endDate || startDate;
            if (termDate) {
                dateLabel = `Término: ${format(termDate, 'dd/MM/yyyy')}`;
                lastWorkingDay = termDate;
                if (!paymentDeadline || differenceInDays(startOfDay(paymentDeadline), startOfDay(termDate)) === 9) {
                    paymentDeadline = new Date(termDate);
                    paymentDeadline.setDate(paymentDeadline.getDate() + 10);
                }

                // Rescisão sem aviso ou experiência imediata: o prazo ativo crucial é o PRAZO DE PAGAMENTO
                const payStart = startOfDay(paymentDeadline);
                daysCount = differenceInDays(payStart, todayStart);
                if (daysCount >= 0) {
                    counterLabel = daysCount === 0 ? "Vence Hoje" : (daysCount === 1 ? "Dia p/ Pgto" : "Restantes");
                    statusBadge = daysCount <= 3 ? "A_VENCER" : "NO_PRAZO";
                } else {
                    counterLabel = "Atrasados";
                    statusBadge = "ALERTA";
                }
            }
        } else if (type === "Processo de abandono") {
            if (startDate) {
                dateLabel = `Iniciado em: ${format(startDate, 'dd/MM/yyyy')}`;
                daysElapsed = differenceInDays(todayStart, startOfDay(startDate));
                daysCount = 30 - daysElapsed;
                if (daysCount <= 0) {
                    daysCount = Math.abs(daysCount);
                    counterLabel = "Completo!";
                    statusBadge = "ALERTA";
                } else {
                    counterLabel = "Restam p/ 30d";
                    if (daysCount <= 5) statusBadge = "A_VENCER";
                }
                lastWorkingDay = startDate;
            }
        } else if (type === "Término de Experiência") {
            const admissionDate = new Date(emp.admissionDate);
            const daysSinceHiring = differenceInDays(todayStart, startOfDay(admissionDate)) + 1;
            
            let targetDate = addDays(admissionDate, 44); // 45 days
            if (daysSinceHiring > 45) {
                targetDate = addDays(admissionDate, 89); // 90 days
            }
            
            startDate = admissionDate;
            endDate = targetDate;
            dateLabel = `Término: ${format(targetDate, 'dd/MM/yyyy')}`;
            daysCount = differenceInDays(startOfDay(targetDate), todayStart);
            counterLabel = daysCount >= 0 ? "Restantes" : "Atrasados";
            if (daysCount <= 5 && daysCount >= 0) statusBadge = "A_VENCER";
            if (daysCount < 0) statusBadge = "ALERTA";

            lastWorkingDay = targetDate;
            if (!paymentDeadline || differenceInDays(startOfDay(paymentDeadline), startOfDay(targetDate)) === 9) {
                paymentDeadline = new Date(targetDate);
                paymentDeadline.setDate(paymentDeadline.getDate() + 10);
            }
        }

        const currentAssignment = emp.assignments[0];
        const postoLabel = currentAssignment?.posto?.client?.name || 'Rotativo / Sem Posto';

        // Generate legal warnings for DP
        const alerts: {
            id: string;
            employeeId: string;
            employeeName: string;
            type: 'CRITICAL' | 'WARNING';
            category: 'PAGAMENTO' | 'TELEGRAMA' | 'EXPERIENCIA' | 'ABANDONO';
            message: string;
        }[] = [];

        if (paymentDeadline) {
            const daysToPay = differenceInDays(paymentDeadline, today);
            if (daysToPay < 0) {
                alerts.push({
                    id: `${emp.id}-pay-crit`,
                    employeeId: emp.id,
                    employeeName: emp.name,
                    type: 'CRITICAL',
                    category: 'PAGAMENTO',
                    message: `Pagamento da rescisão venceu em ${format(paymentDeadline, 'dd/MM/yyyy')} (atrasado há ${Math.abs(daysToPay)} dias)!`
                });
            } else if (daysToPay <= 3) {
                alerts.push({
                    id: `${emp.id}-pay-warn`,
                    employeeId: emp.id,
                    employeeName: emp.name,
                    type: 'WARNING',
                    category: 'PAGAMENTO',
                    message: `Pagamento da rescisão vence em ${format(paymentDeadline, 'dd/MM/yyyy')} (${daysToPay} dias restantes).`
                });
            }
        }

        if ((type === "Término de Experiência" || type.includes("Experiência") || type.includes("Experiencia")) && endDate) {
            const daysToExpiration = differenceInDays(endDate, today);
            if (daysToExpiration < 0) {
                alerts.push({
                    id: `${emp.id}-exp-crit`,
                    employeeId: emp.id,
                    employeeName: emp.name,
                    type: 'CRITICAL',
                    category: 'EXPERIENCIA',
                    message: `Contrato expirou em ${format(endDate, 'dd/MM/yyyy')} sem dispensa definitiva lançada!`
                });
            } else if (daysToExpiration <= 5) {
                alerts.push({
                    id: `${emp.id}-exp-warn`,
                    employeeId: emp.id,
                    employeeName: emp.name,
                    type: 'WARNING',
                    category: 'EXPERIENCIA',
                    message: `Notificar dispensa de experiência até ${format(endDate, 'dd/MM/yyyy')} (${daysToExpiration} dias restantes).`
                });
            }
        }

        if (type === "Processo de abandono" && startDate) {
            if (daysElapsed >= 30) {
                alerts.push({
                    id: `${emp.id}-aband-crit`,
                    employeeId: emp.id,
                    employeeName: emp.name,
                    type: 'CRITICAL',
                    category: 'ABANDONO',
                    message: `Abandono de posto concluído (ausente há ${daysElapsed} dias). Liberado para rescisão por Justa Causa!`
                });
            } else {
                if (daysElapsed >= 3 && !telegram1SentDate) {
                    alerts.push({
                        id: `${emp.id}-tel1-warn`,
                        employeeId: emp.id,
                        employeeName: emp.name,
                        type: 'WARNING',
                        category: 'TELEGRAMA',
                        message: `Enviar 1º telegrama de convocação de retorno (ausente há ${daysElapsed} dias).`
                    });
                }
                if (daysElapsed >= 15 && !telegram2SentDate) {
                    alerts.push({
                        id: `${emp.id}-tel2-warn`,
                        employeeId: emp.id,
                        employeeName: emp.name,
                        type: 'WARNING',
                        category: 'TELEGRAMA',
                        message: `Enviar 2º telegrama / edital oficial (ausente há ${daysElapsed} dias).`
                    });
                }
            }
        }

        return {
            ...emp,
            type,
            startDate,
            endDate,
            reductionType,
            telegram1SentDate,
            telegram2SentDate,
            lastWorkingDay,
            paymentDeadline,
            dateLabel,
            daysCount,
            counterLabel,
            statusBadge,
            postoLabel,
            daysElapsed,
            alerts,
            dismissalProcess: proc,
            createdByName,
            createdAt
        };
    });
}

function getProcessBadgeStyle(type: string) {
    const t = type.toLowerCase();
    if (t.includes("experiência") || t.includes("experiencia")) {
        return { bg: "#faf5ff", color: "#a855f7" }; // Purple
    }
    if (t.includes("aviso") || t.includes("dispensa") || t.includes("pedido")) {
        return { bg: "#fffbeb", color: "#d97706" }; // Amber/Orange
    }
    if (t.includes("abandono")) {
        return { bg: "#fef2f2", color: "#ef4444" }; // Red
    }
    if (t.includes("ativo")) {
        return { bg: "#ecfdf5", color: "#10b981" }; // Emerald/Green
    }
    return { bg: "#f8fafc", color: "#64748b" }; // Slate/Grey
}

export default async function DismissalMonitorPage({ 
    searchParams 
}: { 
    searchParams: Promise<{ companyId?: string, search?: string }> 
}) {
    const { companyId, search } = await searchParams;
    const today = new Date();
    const todayStart = startOfDay(today);

    const companies = await prisma.company.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
    });

    const employees = await getDismissalProcessData(companyId, search);

    const { dismissalAlerts, dismissalAlertUserId, systemUsers } = (await getGlobalAlerts()) as any;
    
    const dismissalMonitorAlerts = employees.flatMap((emp: any) => emp.alerts || []);

    const allAlerts = dismissalAlerts.map((a: any) => ({
        id: a.id,
        employeeId: a.employeeId,
        employeeName: a.employeeName,
        type: a.severity,
        category: a.category || 'EXPERIENCIA',
        message: a.message
    }));

    const user = await getCurrentUser();
    const isAdmin = user?.role === 'ADMIN';

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <BackButton fallbackUrl="/admin/employees" variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-slate-200" />
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-800">Monitor de Desligamento</h1>
                    <p className="text-slate-500">Gestão de prazos de Aviso Prévio, Abandono de Posto, Términos de Experiência e Prazos CLT de DP</p>
                </div>
                <div className="flex items-center gap-2">
                    <DismissalTemplatesModal />
                    <DismissalAlertsDialog 
                        alerts={allAlerts} 
                        alertUserId={dismissalAlertUserId}
                        systemUsers={systemUsers}
                        isAdmin={isAdmin}
                    />
                    <DPAlertSettingsDialog 
                        alertUserId={dismissalAlertUserId}
                        systemUsers={systemUsers}
                        isAdmin={isAdmin}
                        type="dismissal"
                    />
                </div>
            </div>



            {/* Guia de Fluxos Operacionais */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 border p-5 rounded-2xl">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-wider">
                        <Clock className="w-4 h-4" />
                        Aviso Prévio
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                        <strong>Rotina:</strong> Colaborador cumprindo aviso trabalhado permanece alocado no posto. Pode-se abrir a vaga de reposição no R&S com antecedência.
                    </p>
                </div>

                <div className="space-y-1 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4">
                    <div className="flex items-center gap-2 text-purple-600 font-bold text-xs uppercase tracking-wider">
                        <UserX className="w-4 h-4" />
                        Rescisão / Demissão
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                        <strong>Rotina:</strong> O colaborador em processo de acerto. Se liberado do trabalho, desvincule-o do posto e mova-o para o Rotativo até a homologação.
                    </p>
                </div>

                <div className="space-y-1 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4">
                    <div className="flex items-center gap-2 text-rose-500 font-bold text-xs uppercase tracking-wider">
                        <Calendar className="w-4 h-4" />
                        Término de Experiência
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                        <strong>Rotina:</strong> Solicitado pelo supervisor. Colaborador permanece no posto até o 45º ou 90º dia. Monitora-se a data limite para dispensá-lo no prazo.
                    </p>
                </div>

                <div className="space-y-1 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4">
                    <div className="flex items-center gap-2 text-red-600 font-bold text-xs uppercase tracking-wider">
                        <AlertCircle className="w-4 h-4" />
                        Faltas / Abandono
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                        <strong>Rotina:</strong> Colaborador faltoso deve ser removido do posto para liberação de vaga e enviado ao Rotativo. O monitor conta os dias até atingir 30d para justa causa.
                    </p>
                </div>
            </div>

            <DashboardFilters companies={companies} clients={[]} />

            <DismissalMonitorTable employees={employees} />
        </div>
    );
}
