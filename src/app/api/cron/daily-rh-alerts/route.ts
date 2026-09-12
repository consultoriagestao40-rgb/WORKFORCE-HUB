import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dispatchRhNotification } from "@/lib/rh-notifications";
import { differenceInDays, format, addDays, startOfDay } from "date-fns";

/**
 * Cron Endpoint: Dispara os alertas diários matinais do RH às 08h00.
 * Verifica pagamentos de rescisão do dia, prazos de telegramas de abandono e términos de experiência.
 */
export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
            if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const config = await prisma.rhNotificationConfig.findFirst();
        if (!config || !config.isActive) {
            return NextResponse.json({ success: true, message: "Notificações desativadas globalmente" });
        }

        const todayStart = startOfDay(new Date());
        let alertsSent = 0;

        // 1. MONITOR DE DESLIGAMENTOS (Prazos de Pagamento e Telegramas)
        const activeDismissals = await prisma.employee.findMany({
            where: {
                status: 'Ativo',
                situation: {
                    name: {
                        in: ['Aviso Prévio', 'Processo de Rescisão', 'Processo de abandono']
                    }
                }
            },
            include: {
                assignments: {
                    where: { endDate: null },
                    include: {
                        posto: {
                            include: {
                                client: {
                                    include: {
                                        accountManager: true
                                    }
                                }
                            }
                        }
                    },
                    take: 1
                }
            }
        });

        for (const emp of activeDismissals) {
            const extra = (emp.extraFields as any) || {};
            const proc = extra.dismissalProcess || {};
            const empName = emp.name;
            const supervisor = emp.assignments[0]?.posto?.client?.accountManager;
            const supervisorPhone = supervisor?.phone || null;
            const supervisorName = supervisor?.name || null;

            let type = proc.type || "Desconhecido";
            let startDate = proc.startDate ? new Date(proc.startDate) : null;
            let endDate = proc.endDate ? new Date(proc.endDate) : null;
            let paymentDeadline = proc.paymentDeadline ? new Date(proc.paymentDeadline) : null;

            if (!paymentDeadline && endDate) {
                const computedPay = new Date(endDate);
                computedPay.setDate(computedPay.getDate() + 10);
                paymentDeadline = computedPay;
            }

            // A. Checagem de Prazo de Pagamento da Rescisão
            if (config.notifyDailyRescisaoDeadline && paymentDeadline) {
                const daysToPay = differenceInDays(startOfDay(paymentDeadline), todayStart);
                if (daysToPay === 0) {
                    // VENCE HOJE
                    const msg = `🚨 *[FINANCEIRO / ADM - VENCIMENTO DE RESCISÃO HOJE]*\n\n` +
                                `👤 *Colaborador:* ${empName}\n` +
                                `💰 *Data Limite de Quitação:* HOJE (${format(paymentDeadline, 'dd/MM/yyyy')})\n` +
                                `⚠️ *Atenção:* Efetuar o pagamento rescisório e salvar o comprovante hoje para evitar multa do Artigo 477 da CLT!`;

                    await dispatchRhNotification({
                        event: 'PRAZO_RESCISAO',
                        title: `Rescisão de ${empName} Vence Hoje`,
                        message: msg,
                        contractSupervisorPhone: supervisorPhone,
                        contractSupervisorName: supervisorName,
                        metadata: { employeeId: emp.id, type: 'PAYMENT_TODAY' }
                    });
                    alertsSent++;
                } else if (daysToPay === 2) {
                    // Vence em 2 dias (Aviso prévio)
                    const msg = `⚠️ *[FINANCEIRO - RESCISÃO A VENCER EM 2 DIAS]*\n\n` +
                                `👤 *Colaborador:* ${empName}\n` +
                                `💰 *Vencimento:* ${format(paymentDeadline, 'dd/MM/yyyy')} (faltam 2 dias úteis/corridos)\n` +
                                `Prepare a guia rescisória e cálculo homologado.`;

                    await dispatchRhNotification({
                        event: 'PRAZO_RESCISAO',
                        title: `Rescisão de ${empName} vence em 2 dias`,
                        message: msg,
                        contractSupervisorPhone: supervisorPhone,
                        contractSupervisorName: supervisorName,
                        metadata: { employeeId: emp.id, type: 'PAYMENT_IN_2_DAYS' }
                    });
                    alertsSent++;
                }
            }

            // B. Checagem de Telegramas e Abandono
            if (config.notifyDailyTelegramDeadline && (proc.dismissalSubType === 'ABANDONO' || type === 'Processo de abandono') && startDate) {
                const daysElapsed = differenceInDays(todayStart, startOfDay(startDate));

                if (daysElapsed === 3 && !proc.telegram1SentDate) {
                    // Dia de enviar 1º Telegrama
                    const msg = `📬 *[RH / DP - DIA DE ENVIAR 1º TELEGRAMA]*\n\n` +
                                `👤 *Colaborador:* ${empName}\n` +
                                `📅 *Faltas consecutivas desde:* ${format(startDate, 'dd/MM/yyyy')} (${daysElapsed} dias ausente)\n` +
                                `🔔 *Ação:* Postar hoje o 1º Telegrama com Aviso de Recebimento (AR) convocando o colaborador para justificar as faltas.`;

                    await dispatchRhNotification({
                        event: 'TELEGRAMA',
                        title: `1º Telegrama de Abandono - ${empName}`,
                        message: msg,
                        contractSupervisorPhone: supervisorPhone,
                        contractSupervisorName: supervisorName,
                        metadata: { employeeId: emp.id, step: 'TELEGRAM_1' }
                    });
                    alertsSent++;
                } else if (daysElapsed === 10 && !proc.telegram2SentDate) {
                    // Dia de enviar 2º Telegrama
                    const msg = `📬 *[RH / DP - DIA DE ENVIAR 2º TELEGRAMA]*\n\n` +
                                `👤 *Colaborador:* ${empName}\n` +
                                `📅 *Faltas consecutivas:* ${daysElapsed} dias sem comparecer\n` +
                                `🔔 *Ação:* Postar o 2º Telegrama com AR reiterando a convocação antes da caracterização final de abandono.`;

                    await dispatchRhNotification({
                        event: 'TELEGRAMA',
                        title: `2º Telegrama de Abandono - ${empName}`,
                        message: msg,
                        contractSupervisorPhone: supervisorPhone,
                        contractSupervisorName: supervisorName,
                        metadata: { employeeId: emp.id, step: 'TELEGRAM_2' }
                    });
                    alertsSent++;
                } else if (daysElapsed === 30) {
                    // 30 dias completos
                    const msg = `⚖️ *[RH / JURÍDICO - ABANDONO DE EMPREGO CONCLUÍDO]*\n\n` +
                                `👤 *Colaborador:* ${empName}\n` +
                                `📅 *Ausência comprovada há 30 dias consecutivos!*\n` +
                                `✅ *Ação:* Procedimento de abandono concluído. Liberado para rescisão por Justa Causa (Artigo 482, alínea 'i' da CLT).`;

                    await dispatchRhNotification({
                        event: 'ABANDONO',
                        title: `Abandono Concluído - ${empName}`,
                        message: msg,
                        contractSupervisorPhone: supervisorPhone,
                        contractSupervisorName: supervisorName,
                        metadata: { employeeId: emp.id, step: 'ABANDONMENT_COMPLETED' }
                    });
                    alertsSent++;
                }
            }
        }

        // 2. CONTRATOS DE EXPERIÊNCIA A VENCER (45 e 90 dias)
        if (config.notifyDailyProbationDeadline) {
            const activeProbationEmps = await prisma.employee.findMany({
                where: {
                    status: 'Ativo',
                    probationStatus: { in: ['EM_EXPERIENCIA', 'PENDING'] }
                },
                include: {
                    assignments: {
                        where: { endDate: null },
                        include: {
                            posto: {
                                include: {
                                    client: {
                                        include: {
                                            accountManager: true
                                        }
                                    }
                                }
                            }
                        },
                        take: 1
                    }
                }
            });

            for (const emp of activeProbationEmps) {
                if (!emp.admissionDate) continue;
                const adm = startOfDay(new Date(emp.admissionDate));
                const daysEmployed = differenceInDays(todayStart, adm);

                const supervisor = emp.assignments[0]?.posto?.client?.accountManager;
                const supervisorPhone = supervisor?.phone || null;
                const supervisorName = supervisor?.name || null;

                // 1º período (45 dias)
                const daysTo45 = 45 - daysEmployed;
                if (daysTo45 === 5 || daysTo45 === 0) {
                    const msg = `⏳ *[RH - VENCIMENTO DO 1º PERÍODO DE EXPERIÊNCIA]*\n\n` +
                                `👤 *Colaborador:* ${emp.name}\n` +
                                `📅 *Admissão:* ${format(adm, 'dd/MM/yyyy')}\n` +
                                `⏱️ *Status:* ${daysTo45 === 0 ? 'Vence HOJE (45 dias)' : `Vence em 5 dias (${format(addDays(adm, 45), 'dd/MM/yyyy')})`}\n` +
                                `🎯 *Decisão Necessária:* Prorrogar por mais 45 dias ou formalizar término de contrato de experiência.`;

                    await dispatchRhNotification({
                        event: 'EXPERIENCIA',
                        title: `Experiência 45d - ${emp.name}`,
                        message: msg,
                        contractSupervisorPhone: supervisorPhone,
                        contractSupervisorName: supervisorName,
                        metadata: { employeeId: emp.id, period: '45_DAYS' }
                    });
                    alertsSent++;
                }

                // 2º período (90 dias)
                const daysTo90 = 90 - daysEmployed;
                if (daysTo90 === 5 || daysTo90 === 0) {
                    const msg = `⏳ *[RH - TÉRMINO DEFINITIVO DE EXPERIÊNCIA (90 DIAS)]*\n\n` +
                                `👤 *Colaborador:* ${emp.name}\n` +
                                `📅 *Admissão:* ${format(adm, 'dd/MM/yyyy')}\n` +
                                `⏱️ *Status:* ${daysTo90 === 0 ? 'Vence HOJE (90 dias)' : `Vence em 5 dias (${format(addDays(adm, 90), 'dd/MM/yyyy')})`}\n` +
                                `🎯 *Decisão:* Efetivar definitivamente ou rescindir sem aviso prévio/multa FGTS até a data limite.`;

                    await dispatchRhNotification({
                        event: 'EXPERIENCIA',
                        title: `Experiência 90d - ${emp.name}`,
                        message: msg,
                        contractSupervisorPhone: supervisorPhone,
                        contractSupervisorName: supervisorName,
                        metadata: { employeeId: emp.id, period: '90_DAYS' }
                    });
                    alertsSent++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            alertsSent,
            timestamp: new Date().toISOString()
        });

    } catch (err: any) {
        console.error("[daily-rh-alerts cron error]:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
