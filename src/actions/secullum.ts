"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getBenefitsConfig } from "@/actions/benefits";
import { SecullumApiClient, SecullumAfastamento } from "@/lib/secullum";

// Helper: Format Date to YYYY-MM-DD
function formatDateToISO(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// 1. Test Connection Server Action
export async function testSecullumConnectionAction(apiUrl?: string, apiToken?: string, companyId?: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const config = await getBenefitsConfig();
    const token = apiToken || config.secullumApiToken;
    const bankId = companyId || config.secullumCompanyId || "1";
    const url = apiUrl || config.secullumApiUrl || "https://pontowebintegracaoexterna.secullum.com.br";

    if (!token) {
        return { success: false, message: "Token de Integração do Secullum não informado." };
    }

    const client = new SecullumApiClient(token, bankId, url);
    return await client.testConnection();
}

// 2. Sync Occurrences from Secullum Action
export async function syncSecullumOccurrences(year: number, month: number) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const config = await getBenefitsConfig();

    if (!config.secullumApiToken) {
        return {
            success: false,
            message: "Por favor, cadastre o Token de Integração do Secullum em Configurações de Benefícios antes de sincronizar.",
            totalImported: 0
        };
    }

    const bankId = config.secullumCompanyId || "1";
    const apiUrl = config.secullumApiUrl || "https://pontowebintegracaoexterna.secullum.com.br";

    // Compute window dates (Day 26 prev month to Day 25 current month)
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const startDate = new Date(prevYear, prevMonth - 1, config.payrollCutoffStartDay);
    const endDate = new Date(year, month - 1, config.payrollCutoffEndDay);

    const startDateStr = formatDateToISO(startDate);
    const endDateStr = formatDateToISO(endDate);

    try {
        const client = new SecullumApiClient(config.secullumApiToken, bankId, apiUrl);
        const afastamentos = await client.getAfastamentos(startDateStr, endDateStr);

        let totalImported = 0;
        let totalSkipped = 0;

        // Fetch all active employees to match by CPF or Extra PIS
        const employees = await prisma.employee.findMany({
            select: { id: true, cpf: true, extraFields: true }
        });

        // Create a fast lookup map by cleaned CPF
        const employeeByCpfMap = new Map<string, string>();
        employees.forEach(emp => {
            if (emp.cpf) {
                const cleanCpf = emp.cpf.replace(/\D/g, "");
                employeeByCpfMap.set(cleanCpf, emp.id);
            }
        });

        for (const af of afastamentos) {
            const rawCpf = af.funcionarioCpf || "";
            const cleanCpf = rawCpf.replace(/\D/g, "");

            const employeeId = employeeByCpfMap.get(cleanCpf);
            if (!employeeId) {
                totalSkipped++;
                continue;
            }

            const occDate = af.dataInicio ? new Date(af.dataInicio) : new Date();

            // Map Secullum motive/type to WorkForce Hub Occurrence Type
            let type: "FALTA" | "ATESTADO" | "FALTA_INJUSTIFICADA" = "FALTA";
            const descLower = (af.motivoDescricao || af.tipo || "").toLowerCase();

            if (descLower.includes("atestado") || descLower.includes("médico") || descLower.includes("medico")) {
                type = "ATESTADO";
            } else if (descLower.includes("injustificada")) {
                type = "FALTA_INJUSTIFICADA";
            } else {
                type = "FALTA";
            }

            // Check if an occurrence already exists on this exact date for this employee
            const startOfDay = new Date(occDate);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(occDate);
            endOfDay.setHours(23, 59, 59, 999);

            const existing = await prisma.occurrence.findFirst({
                where: {
                    employeeId,
                    date: {
                        gte: startOfDay,
                        lte: endOfDay
                    }
                }
            });

            if (!existing) {
                // Find or use first active posto of employee for occurrence record requirement
                const assignment = await prisma.assignment.findFirst({
                    where: { employeeId, endDate: null }
                });

                const postoId = assignment?.postoId || (await prisma.posto.findFirst())?.id;

                if (postoId) {
                    await prisma.occurrence.create({
                        data: {
                            employeeId,
                            postoId,
                            type,
                            date: occDate,
                            title: `Secullum: ${af.motivoDescricao || 'Falta/Afastamento'}`,
                            description: `Importado da API Secullum Ponto Web. ${af.observacao || ''}`.trim()
                        }
                    });
                    totalImported++;
                }
            }
        }

        // Update Last Sync Timestamp
        await prisma.benefitsConfig.update({
            where: { id: config.id },
            data: { secullumLastSyncAt: new Date() }
        });

        revalidatePath("/admin/benefits");

        return {
            success: true,
            totalImported,
            message: `Sincronização concluída com sucesso! ${totalImported} nova(s) ocorrência(s) importada(s) do Secullum Ponto Web (${totalSkipped} ignoradas/não encontradas por CPF).`
        };

    } catch (err: any) {
        return {
            success: false,
            totalImported: 0,
            message: `Erro ao sincronizar com o Secullum: ${err.message}`
        };
    }
}
