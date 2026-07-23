"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getBenefitsConfig } from "@/actions/benefits";
import { SecullumApiClient } from "@/lib/secullum";

// Helper: Format Date to YYYY-MM-DD
function formatDateToISO(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Helper: Get list of dates between start and end (inclusive)
function getDatesInRange(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    let current = new Date(start);
    // Safety limit to avoid infinite loops
    let limit = 0;
    while (current <= end && limit < 100) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
        limit++;
    }
    return dates;
}

// Helper: Clean CPF string
function cleanCpfStr(cpf: string | null | undefined): string {
    if (!cpf) return "";
    return cpf.replace(/\D/g, "");
}

// 1. Test Connection Server Action
export async function testSecullumConnectionAction(apiUrl?: string, apiToken?: string, companyId?: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const config = await getBenefitsConfig();
    const token = apiToken || config.secullumApiToken;
    const bankId = companyId || config.secullumCompanyId || "1";
    let url = apiUrl || config.secullumApiUrl || "https://pontowebintegracaoexterna.secullum.com.br";

    if (url.includes("pontoweb.secullum.com.br") && !url.includes("pontowebintegracaoexterna")) {
        url = "https://pontowebintegracaoexterna.secullum.com.br";
    }

    if (!token) {
        return { success: false, message: "Credenciais do Secullum não informadas." };
    }

    const client = new SecullumApiClient(token, bankId, url);
    return await client.testConnection();
}

// 2. Sync Occurrences from Secullum Action
export async function syncSecullumOccurrences(year: number, month: number, bypassAuth = false) {
    if (!bypassAuth) {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");
    }

    const config = await getBenefitsConfig();

    if (!config.secullumApiToken) {
        return {
            success: false,
            message: "Por favor, configure as credenciais do Secullum nas Configurações antes de sincronizar.",
            totalImported: 0
        };
    }

    const bankId = config.secullumCompanyId || "85740";
    let apiUrl = config.secullumApiUrl || "https://pontowebintegracaoexterna.secullum.com.br";

    if (apiUrl.includes("pontoweb.secullum.com.br") && !apiUrl.includes("pontowebintegracaoexterna")) {
        apiUrl = "https://pontowebintegracaoexterna.secullum.com.br";
    }

    // Compute window dates (Day 26 prev month to Day 25 current month)
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const startDate = new Date(prevYear, prevMonth - 1, config.payrollCutoffStartDay);
    const endDate = new Date(year, month - 1, config.payrollCutoffEndDay);

    const startDateStr = formatDateToISO(startDate);
    const endDateStr = formatDateToISO(endDate);

    try {
        const client = new SecullumApiClient(config.secullumApiToken, bankId, apiUrl);

        // A. Fetch Secullum employees to build a map: NumeroFolha -> CPF
        const secullumEmployees = await client.getFuncionarios();
        const folhaToCpfMap = new Map<string, string>();
        secullumEmployees.forEach(emp => {
            if (emp.NumeroFolha && emp.Cpf) {
                folhaToCpfMap.set(emp.NumeroFolha.trim(), cleanCpfStr(emp.Cpf));
            }
        });

        // B. Fetch active DB employees and build a lookup map: cleanedCpf -> employeeId
        const dbEmployees = await prisma.employee.findMany({
            select: { id: true, cpf: true }
        });
        const cpfToEmployeeIdMap = new Map<string, string>();
        dbEmployees.forEach(emp => {
            if (emp.cpf) {
                cpfToEmployeeIdMap.set(cleanCpfStr(emp.cpf), emp.id);
            }
        });

        let totalImported = 0;

        // C. Fetch long-term Afastamentos (Vacations, INSS, Licenças, Atestados de longo prazo)
        const afastamentos = await client.getAfastamentos(startDateStr, endDateStr);
        for (const af of afastamentos) {
            const cleanCpf = cleanCpfStr(af.Cpf);
            const employeeId = cpfToEmployeeIdMap.get(cleanCpf);
            if (!employeeId) continue;

            const startAfDate = af.Inicio ? new Date(af.Inicio) : null;
            const endAfDate = af.Fim ? new Date(af.Fim) : null;

            if (!startAfDate) continue;
            // Handle single-day afastamento if Fim is null
            const finalEndAfDate = endAfDate || startAfDate;

            // Get all individual dates in the range that fall within our benefit purchase window
            const datesInRange = getDatesInRange(startAfDate, finalEndAfDate);
            const validDates = datesInRange.filter(d => d >= startDate && d <= endDate);

            // Map reason to type
            let type: string = "FALTA";
            const desc = (af.JustificativaNome || af.Motivo || "").toLowerCase();
            if (desc.includes("atestado") || desc.includes("médico") || desc.includes("medico")) {
                type = "ATESTADO";
            } else if (desc.includes("férias") || desc.includes("ferias")) {
                type = "FERIAS";
            } else if (desc.includes("licença") || desc.includes("licenca")) {
                type = "LICENCA";
            } else {
                type = "AFASTAMENTO";
            }

            for (const d of validDates) {
                const startOfDay = new Date(d);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(d);
                endOfDay.setHours(23, 59, 59, 999);

                const existing = await prisma.occurrence.findFirst({
                    where: {
                        employeeId,
                        date: { gte: startOfDay, lte: endOfDay }
                    }
                });

                if (!existing) {
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
                                date: d,
                                title: `Secullum (Afastamento): ${af.JustificativaNome || af.Motivo || 'Afastamento'}`,
                                description: `Importado automaticamente da API Secullum Ponto Web.`
                            }
                        });
                        totalImported++;
                    }
                }
            }
        }

        // D. Fetch daily Batidas (to detect single-day Faltas & Atestados)
        const batidas = await client.getBatidas(startDateStr, endDateStr);
        for (const b of batidas) {
            const rawObs = (b.Observacoes || "").toLowerCase();
            const rawEntrada = (b.Entrada1 || "").toLowerCase();
            
            const isAtestado = /at\.?\s*med/i.test(rawEntrada) || /at\.?\s*med/i.test(rawObs) ||
                               rawEntrada.includes("atestado") || rawEntrada.includes("medico") || rawEntrada.includes("médico") || rawEntrada.includes("atest") ||
                               rawObs.includes("atestado") || rawObs.includes("medico") || rawObs.includes("médico") || rawObs.includes("atest");
            
            // Only count as Lack (Falta) if NOT compensated
            const isFalta = (rawEntrada.includes("falta") || rawObs.includes("falta")) && !b.Compensado;
            
            const folha = b.Funcionario?.NumeroFolha?.trim();
            if (!folha) continue;

            const cleanCpf = folhaToCpfMap.get(folha);
            if (!cleanCpf) continue;

            const employeeId = cpfToEmployeeIdMap.get(cleanCpf);
            if (!employeeId) continue;

            const occDate = b.Data ? new Date(b.Data) : new Date();
            const startOfDay = new Date(occDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(occDate);
            endOfDay.setHours(23, 59, 59, 999);

            // Double check no occurrence exists on this date
            const existing = await prisma.occurrence.findFirst({
                where: {
                    employeeId,
                    date: { gte: startOfDay, lte: endOfDay }
                }
            });

            const occType = isAtestado ? "ATESTADO" : "FALTA";
            const occTitle = isAtestado 
                ? `Secullum (Atestado): ${b.Observacoes || "Atestado Médico registrado"}`
                : "Secullum (Falta): Falta registrada";

            if (existing) {
                if (isAtestado) {
                    if (existing.type !== "ATESTADO") {
                        await prisma.occurrence.update({
                            where: { id: existing.id },
                            data: {
                                type: "ATESTADO",
                                title: occTitle,
                                description: `Atualizado automaticamente da API Secullum Ponto Web (Falta justificada).`
                            }
                        });
                    }
                } else if (isFalta) {
                    if (existing.type !== "FALTA") {
                        await prisma.occurrence.update({
                            where: { id: existing.id },
                            data: {
                                type: "FALTA",
                                title: occTitle,
                                description: `Importada automaticamente das batidas do Secullum Ponto Web.`
                            }
                        });
                    }
                } else {
                    // If it is now compensated or not a lack/certificate anymore, remove it!
                    await prisma.occurrence.delete({
                        where: { id: existing.id }
                    });
                }
            } else {
                if (isAtestado || isFalta) {
                    const assignment = await prisma.assignment.findFirst({
                        where: { employeeId, endDate: null }
                    });
                    const postoId = assignment?.postoId || (await prisma.posto.findFirst())?.id;
                    if (postoId) {
                        await prisma.occurrence.create({
                            data: {
                                employeeId,
                                postoId,
                                type: occType,
                                date: occDate,
                                title: occTitle,
                                description: `Importada automaticamente das batidas do Secullum Ponto Web. Obs: ${b.Observacoes || 'Nenhuma'}`
                            }
                        });
                        totalImported++;
                    }
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
            message: `Sincronização concluída com sucesso! Foram importadas ${totalImported} novas faltas e atestados do Secullum Ponto Web para a janela de benefícios.`
        };

    } catch (err: any) {
        return {
            success: false,
            totalImported: 0,
            message: `Erro ao sincronizar ocorrências do Secullum: ${err.message}`
        };
    }
}
