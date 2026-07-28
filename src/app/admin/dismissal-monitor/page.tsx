export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { DashboardFilters } from "@/components/admin/DashboardFilters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, differenceInDays, addDays } from "date-fns";
import { AlertCircle, Calendar, Clock, ArrowLeft, ArrowUpRight, CheckCircle2, UserX, Send, ShieldAlert, DollarSign } from "lucide-react";
import Link from "next/link";
import { DismissalMonitorActions } from "@/components/admin/DismissalMonitorActions";
import { TelegramRegisterButton } from "@/components/admin/TelegramRegisterButton";
import { BackButton } from "@/components/admin/BackButton";
import { ResignationLetterDownloadButton } from "@/components/admin/ResignationLetterDownloadButton";
import { InitiateDismissalDialog } from "@/components/admin/InitiateDismissalDialog";
import { DismissalAlertsDialog } from "@/components/admin/DismissalAlertsDialog";

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

    const today = new Date();

    return employees.map((emp: any) => {
        const extra = emp.extraFields as any || {};
        const proc = extra.dismissalProcess || {};

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

        if (type === "Aviso Prévio") {
            if (startDate && endDate) {
                dateLabel = `${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`;
                daysCount = differenceInDays(endDate, today);
                counterLabel = daysCount >= 0 ? "Restantes" : "Atrasados";
                if (daysCount <= 5 && daysCount >= 0) statusBadge = "A_VENCER";
                if (daysCount < 0) statusBadge = "ALERTA";

                if (!lastWorkingDay) {
                    lastWorkingDay = new Date(endDate);
                    if (reductionType === 'SETE_DIAS') {
                        lastWorkingDay.setDate(lastWorkingDay.getDate() - 7);
                    }
                }
                if (!paymentDeadline) {
                    paymentDeadline = new Date(endDate);
                    paymentDeadline.setDate(paymentDeadline.getDate() + 10);
                }
            }
        } else if (
            type === "Processo de Rescisão" || 
            type.includes("Experiência") || 
            type.includes("Experiencia") || 
            type.includes("Aviso Indenizado") || 
            type.includes("Dispensa de Aviso")
        ) {
            if (endDate) {
                dateLabel = `Término: ${format(endDate, 'dd/MM/yyyy')}`;
                daysCount = differenceInDays(endDate, today);
                counterLabel = daysCount >= 0 ? "Restantes" : "Atrasados";
                if (daysCount <= 5 && daysCount >= 0) statusBadge = "A_VENCER";
                if (daysCount < 0) statusBadge = "ALERTA";

                lastWorkingDay = endDate;
                if (!paymentDeadline) {
                    paymentDeadline = new Date(endDate);
                    paymentDeadline.setDate(paymentDeadline.getDate() + 10);
                }
            }
        } else if (type === "Processo de abandono") {
            if (startDate) {
                dateLabel = `Iniciado em: ${format(startDate, 'dd/MM/yyyy')}`;
                daysElapsed = differenceInDays(today, startDate);
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
            const daysSinceHiring = differenceInDays(today, admissionDate) + 1;
            
            let targetDate = addDays(admissionDate, 44); // 45 days
            if (daysSinceHiring > 45) {
                targetDate = addDays(admissionDate, 89); // 90 days
            }
            
            startDate = admissionDate;
            endDate = targetDate;
            dateLabel = `Término: ${format(targetDate, 'dd/MM/yyyy')}`;
            daysCount = differenceInDays(targetDate, today);
            counterLabel = daysCount >= 0 ? "Restantes" : "Atrasados";
            if (daysCount <= 5 && daysCount >= 0) statusBadge = "A_VENCER";
            if (daysCount < 0) statusBadge = "ALERTA";

            lastWorkingDay = targetDate;
            if (!paymentDeadline) {
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
            dismissalProcess: proc
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

    const companies = await prisma.company.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
    });

    const employees = await getDismissalProcessData(companyId, search);

    // Aggregate all alerts
    const allAlerts = employees.flatMap(emp => emp.alerts);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <BackButton fallbackUrl="/admin/employees" variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-slate-200" />
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-800">Monitor de Desligamento</h1>
                    <p className="text-slate-500">Gestão de prazos de Aviso Prévio, Abandono de Posto, Términos de Experiência e Prazos CLT de DP</p>
                </div>
                <DismissalAlertsDialog alerts={allAlerts} />
            </div>

            {/* Panel de Alertas Críticos de Departamento Pessoal */}
            {allAlerts.length > 0 && (
                <div className="bg-red-50/50 border border-red-200/60 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-2 text-red-700 font-extrabold text-sm uppercase tracking-wider">
                        <ShieldAlert className="w-5 h-5 text-red-500" />
                        Prazos Críticos de Departamento Pessoal
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-semibold leading-relaxed">
                        {allAlerts.map((alert, idx) => (
                            <div 
                                key={idx} 
                                className={`flex items-start gap-1.5 p-2 rounded-lg border ${
                                    alert.type === 'CRITICAL' 
                                        ? 'bg-red-50/70 border-red-100 text-red-800' 
                                        : 'bg-amber-50/70 border-amber-100 text-amber-800'
                                }`}
                            >
                                <span className="mt-0.5">{alert.type === 'CRITICAL' ? '⚠️' : '🔔'}</span>
                                <span className="flex-1">
                                    <strong>{alert.employeeName}</strong>: {alert.message}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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

            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b uppercase text-xs">
                            <tr>
                                <th className="px-5 py-4">Colaborador</th>
                                <th className="px-5 py-4">Empresa / Posto</th>
                                <th className="px-5 py-4">Processo</th>
                                <th className="px-5 py-4">Cronograma</th>
                                <th className="px-5 py-4 text-center">1º Tel.</th>
                                <th className="px-5 py-4 text-center">2º Tel.</th>
                                <th className="px-5 py-4 text-center">Prazo Pgto</th>
                                <th className="px-5 py-4 text-center">Contador</th>
                                <th className="px-5 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {employees.map((emp: any) => (
                                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-5 py-4">
                                        <div className="font-bold text-slate-900">{emp.name}</div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            {emp.role.name}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded w-fit mb-1 max-w-[120px] truncate" title={emp.company?.name || 'S/ Empresa'}>
                                            {emp.company?.name || 'S/ Empresa'}
                                        </div>
                                        <div className="text-xs text-slate-500 font-bold max-w-[120px] truncate" title={emp.postoLabel}>{emp.postoLabel}</div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex flex-col gap-1">
                                            {(() => {
                                                const style = getProcessBadgeStyle(emp.type);
                                                return (
                                                    <span 
                                                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold w-fit border"
                                                        style={{ 
                                                            backgroundColor: style.bg,
                                                            color: style.color,
                                                            borderColor: `${style.color}25`
                                                        }}
                                                    >
                                                        <span 
                                                            className="w-1.5 h-1.5 rounded-full" 
                                                            style={{ backgroundColor: style.color }}
                                                        />
                                                        {emp.type}
                                                    </span>
                                                );
                                            })()}
                                            {emp.type === "Aviso Prévio" && (
                                                <span className="text-[9px] text-slate-400 font-medium">
                                                    Redução: {
                                                        emp.reductionType === 'DUAS_HORAS' ? '2h diárias' :
                                                        emp.reductionType === 'SETE_DIAS' ? '7 dias no fim' : 'Nenhuma'
                                                    }
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex flex-col gap-0.5 text-xs text-slate-600 font-bold">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="truncate max-w-[150px]">{emp.dateLabel}</span>
                                            </div>
                                            {emp.lastWorkingDay && (
                                                <div className="text-[10px] text-sky-800 bg-sky-50 border border-sky-100 rounded px-1.5 py-0.5 w-fit font-bold mt-1">
                                                    Último dia trab: {format(emp.lastWorkingDay, 'dd/MM/yyyy')}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        {emp.type === "Processo de abandono" ? (
                                            <TelegramRegisterButton 
                                                employeeId={emp.id} 
                                                telegramIndex={1} 
                                                sentDate={emp.telegram1SentDate} 
                                            />
                                        ) : <span className="text-slate-300">-</span>}
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        {emp.type === "Processo de abandono" ? (
                                            <TelegramRegisterButton 
                                                employeeId={emp.id} 
                                                telegramIndex={2} 
                                                sentDate={emp.telegram2SentDate} 
                                            />
                                        ) : <span className="text-slate-300">-</span>}
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        {emp.paymentDeadline ? (
                                            <div className="flex flex-col items-center">
                                                <span className={`text-xs font-bold border px-2 py-0.5 rounded ${
                                                    differenceInDays(emp.paymentDeadline, today) < 0 
                                                        ? 'bg-red-50 text-red-700 border-red-200' 
                                                        : differenceInDays(emp.paymentDeadline, today) <= 3
                                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                            : 'bg-slate-50 text-slate-600 border-slate-200'
                                                }`}>
                                                    {format(emp.paymentDeadline, 'dd/MM/yyyy')}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 font-medium">-</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className={`text-base font-black ${emp.statusBadge === 'ALERTA' ? 'text-red-600' : 'text-slate-800'}`}>
                                                {emp.daysCount}
                                            </span>
                                            <span className="text-[8px] text-slate-400 uppercase font-black tracking-wider leading-none">
                                                {emp.counterLabel}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <div className="flex justify-end items-center gap-2">
                                            {emp.dismissalProcess?.attachment && (
                                                <ResignationLetterDownloadButton 
                                                    fileName={emp.dismissalProcess.attachment.fileName} 
                                                    fileData={emp.dismissalProcess.attachment.fileData} 
                                                />
                                            )}
                                            <Link href={`/admin/employees/${emp.id}`}>
                                                <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-slate-200 font-bold text-xs">
                                                    Perfil
                                                </Button>
                                            </Link>
                                            {!emp.dismissalProcess?.type ? (
                                                <InitiateDismissalDialog 
                                                    employeeId={emp.id}
                                                    employeeName={emp.name}
                                                    hasActivePosto={emp.assignments && emp.assignments.length > 0}
                                                    triggerVariant="table"
                                                />
                                            ) : (
                                                <DismissalMonitorActions 
                                                    employeeId={emp.id}
                                                    employeeName={emp.name}
                                                    situationName={emp.type}
                                                />
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {employees.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="text-center py-12 text-slate-500 font-medium">
                                        Nenhum colaborador com processo de desligamento ou aviso prévio em andamento.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
