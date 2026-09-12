import { prisma } from "@/lib/db";

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID || "3F1993DFB59E83474F059E648AE68DF9";
const ZAPI_TOKEN = process.env.ZAPI_TOKEN || "81087A6B5C1CAB8AAAC801C4";
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || "F5c1b8f27f6b049c98c4e779d00f67552S";

export type RhNotificationEventType = 
    | 'ABANDONO'
    | 'ADMISSAO'
    | 'CANDIDATO_SELECIONADO'
    | 'DESLIGAMENTO'
    | 'ROTATIVO'
    | 'FERIAS'
    | 'PRAZO_RESCISAO'
    | 'TELEGRAMA'
    | 'EXPERIENCIA'
    | 'TESTE';

export interface ExtraPhoneItem {
    id: string;
    name: string;
    phone: string;
    role?: string;
    active: boolean;
}

export interface ExtraGroupItem {
    id: string;
    name: string;
    jid: string;
    channel: 'OPERATIONS' | 'ADMIN' | 'ALL';
    active: boolean;
}

export interface DispatchNotificationPayload {
    event: RhNotificationEventType;
    title: string;
    message: string;
    contractSupervisorPhone?: string | null;
    contractSupervisorName?: string | null;
    metadata?: Record<string, any>;
}

/**
 * Envia uma mensagem de texto simples via Z-API para um telefone individual ou grupo.
 */
export async function sendZapiRaw(target: string, message: string): Promise<{ success: boolean; zapiId?: string; error?: string }> {
    try {
        if (!target) return { success: false, error: "Destinatário vazio" };

        let finalPhone = target.trim();
        // Se for grupo (ex: 120363xxx@g.us ou 120363xxx-group)
        if (!finalPhone.includes("@") && !finalPhone.includes("-group")) {
            const clean = finalPhone.replace(/\D/g, "");
            finalPhone = clean.startsWith("55") ? clean : `55${clean}`;
        }

        const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Client-Token": ZAPI_CLIENT_TOKEN
            },
            body: JSON.stringify({
                phone: finalPhone,
                message
            })
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`[Z-API Error] Target ${finalPhone}:`, errorText);
            return { success: false, error: errorText };
        }

        const resJson = await res.json();
        const zapiId = resJson.messageId || resJson.id || resJson.zaapId || null;
        return { success: true, zapiId };
    } catch (err: any) {
        console.error(`[Z-API Exception] Target ${target}:`, err);
        return { success: false, error: err.message || "Falha na conexão com Z-API" };
    }
}

/**
 * Consulta a lista de conversas/grupos do WhatsApp conectados na instância do Z-API.
 */
export async function fetchZapiGroups(): Promise<Array<{ id: string; name: string; phone: string }>> {
    try {
        const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/chats?page=1&pageSize=150`;
        const res = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                "Client-Token": ZAPI_CLIENT_TOKEN
            },
            next: { revalidate: 0 }
        });

        if (!res.ok) {
            console.error("[Z-API fetchZapiGroups Error]:", await res.text());
            return [];
        }

        const chats = await res.json();
        if (!Array.isArray(chats)) return [];

        return chats
            .filter((c: any) => c.isGroup || (c.phone && (c.phone.includes("@g.us") || c.phone.includes("-group"))))
            .map((c: any) => ({
                id: c.phone,
                name: c.name || c.contact?.name || c.phone,
                phone: c.phone
            }));
    } catch (err) {
        console.error("[Z-API fetchZapiGroups Exception]:", err);
        return [];
    }
}

/**
 * Disparador central de notificações:
 * Consulta as regras do banco, valida quem deve receber, envia via Z-API e grava o log de auditoria.
 */
export async function dispatchRhNotification(payload: DispatchNotificationPayload) {
    try {
        const config = await prisma.rhNotificationConfig.findFirst();
        if (!config || !config.isActive) {
            // Notificações globais desativadas ou ainda não configuradas
            return { sentCount: 0, skipped: true, reason: "Configurações inativas ou não criadas" };
        }

        // Checagem de ativação por tipo de evento
        let isEventActive = true;
        let channels = "OPERATIONS,ADMIN";

        switch (payload.event) {
            case 'ABANDONO':
                isEventActive = config.notifyAbandonment;
                channels = config.notifyAbandonmentChannels;
                break;
            case 'ADMISSAO':
                isEventActive = config.notifyOnboarding;
                channels = config.notifyOnboardingChannels;
                break;
            case 'CANDIDATO_SELECIONADO':
                isEventActive = config.notifyCandidateSelected;
                channels = config.notifyCandidateSelectedChannels;
                break;
            case 'DESLIGAMENTO':
                isEventActive = config.notifyDismissalRequest;
                channels = config.notifyDismissalRequestChannels;
                break;
            case 'ROTATIVO':
                isEventActive = config.notifyPostoMovement;
                channels = config.notifyPostoMovementChannels;
                break;
            case 'FERIAS':
                isEventActive = config.notifyVacationScheduled;
                channels = config.notifyVacationScheduledChannels;
                break;
            case 'PRAZO_RESCISAO':
                isEventActive = config.notifyDailyRescisaoDeadline;
                channels = "ADMIN";
                break;
            case 'TELEGRAMA':
                isEventActive = config.notifyDailyTelegramDeadline;
                channels = "OPERATIONS,ADMIN";
                break;
            case 'EXPERIENCIA':
                isEventActive = config.notifyDailyProbationDeadline;
                channels = "OPERATIONS,ADMIN";
                break;
            case 'TESTE':
                isEventActive = true;
                channels = "OPERATIONS,ADMIN";
                break;
        }

        if (!isEventActive) {
            return { sentCount: 0, skipped: true, reason: `Evento ${payload.event} está desativado na configuração` };
        }

        const targetsToSend: Array<{
            targetId: string;
            targetName: string;
            targetType: 'GROUP' | 'INDIVIDUAL' | 'SUPERVISOR';
        }> = [];

        // 1. Grupo de Operações
        if (channels.includes("OPERATIONS") && config.operationsGroupJid) {
            targetsToSend.push({
                targetId: config.operationsGroupJid,
                targetName: config.operationsGroupName || "Grupo de Operações",
                targetType: 'GROUP'
            });
        }

        // 2. Grupo Administrativo
        if (channels.includes("ADMIN") && config.adminGroupJid) {
            targetsToSend.push({
                targetId: config.adminGroupJid,
                targetName: config.adminGroupName || "Grupo Administrativo",
                targetType: 'GROUP'
            });
        }

        // 3. Grupos Adicionais / Setoriais Extras (ilimitados)
        const extraGroupsList = (config.extraGroups as unknown as ExtraGroupItem[]) || [];
        for (const extraGrp of extraGroupsList) {
            if (extraGrp.active && extraGrp.jid) {
                const matchesOperations = channels.includes("OPERATIONS") && (extraGrp.channel === 'OPERATIONS' || extraGrp.channel === 'ALL');
                const matchesAdmin = channels.includes("ADMIN") && (extraGrp.channel === 'ADMIN' || extraGrp.channel === 'ALL');
                
                if (matchesOperations || matchesAdmin) {
                    const alreadyIncluded = targetsToSend.some(t => t.targetId === extraGrp.jid);
                    if (!alreadyIncluded) {
                        targetsToSend.push({
                            targetId: extraGrp.jid,
                            targetName: extraGrp.name || "Grupo Adicional",
                            targetType: 'GROUP'
                        });
                    }
                }
            }
        }

        // 4. Números Individuais Extras
        const extraPhonesList = (config.extraPhones as unknown as ExtraPhoneItem[]) || [];
        for (const extra of extraPhonesList) {
            if (extra.active && extra.phone) {
                targetsToSend.push({
                    targetId: extra.phone,
                    targetName: extra.name || "Contato Individual",
                    targetType: 'INDIVIDUAL'
                });
            }
        }

        // 4. Supervisor direto do contrato
        if (config.notifyDirectSupervisor && payload.contractSupervisorPhone) {
            const cleanSupPhone = payload.contractSupervisorPhone.replace(/\D/g, "");
            if (cleanSupPhone.length >= 10) {
                // Evitar duplicação se o número do supervisor já estiver em extraPhones
                const alreadyIncluded = targetsToSend.some(t => t.targetId.replace(/\D/g, "").includes(cleanSupPhone));
                if (!alreadyIncluded) {
                    targetsToSend.push({
                        targetId: payload.contractSupervisorPhone,
                        targetName: payload.contractSupervisorName ? `Supervisor: ${payload.contractSupervisorName}` : "Supervisor do Contrato",
                        targetType: 'SUPERVISOR'
                    });
                }
            }
        }

        // Montar mensagem completa formatada com assinatura
        const formattedFullMessage = `${payload.message}\n\n_WorkForce Hub • Notificação Automática de RH_`;

        let successCount = 0;

        for (const target of targetsToSend) {
            const sendResult = await sendZapiRaw(target.targetId, formattedFullMessage);

            // Gravar log no banco de dados de auditoria
            try {
                await prisma.rhNotificationLog.create({
                    data: {
                        event: payload.event,
                        title: payload.title,
                        message: formattedFullMessage,
                        targetType: target.targetType,
                        targetId: target.targetId,
                        targetName: target.targetName,
                        status: sendResult.success ? "SENT" : "FAILED",
                        zapiId: sendResult.zapiId || null,
                        errorMessage: sendResult.error || null,
                        metadata: payload.metadata || {}
                    }
                });
            } catch (logErr) {
                console.error("[RhNotificationLog Save Error]:", logErr);
            }

            if (sendResult.success) successCount++;
        }

        return {
            success: true,
            totalTargets: targetsToSend.length,
            sentCount: successCount
        };

    } catch (err: any) {
        console.error("[dispatchRhNotification Error]:", err);
        return { success: false, error: err.message };
    }
}
