"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getBenefitsConfig } from "@/actions/benefits";
import { SecullumApiClient } from "@/lib/secullum";
import { generateRoster } from "@/lib/scheduling";

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

// Helper: Parse Date as Local mid-day to avoid timezone offset shifts
function parseLocalDate(dateStr: string | null | undefined): Date {
    if (!dateStr) return new Date();
    const cleanStr = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
    const parts = cleanStr.split("-");
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day, 12, 0, 0, 0);
    }
    return new Date(dateStr);
}

// Helper: Match employee by name as a fallback for CPF mismatch
function matchEmployeeByName(secName: string, dbEmployees: Array<{ id: string, name: string }>): string | null {
    const cleanSec = secName.trim().toUpperCase();
    const exact = dbEmployees.find(e => e.name.trim().toUpperCase() === cleanSec);
    if (exact) return exact.id;

    const secWords = cleanSec.split(" ").filter(w => w.length > 2);
    if (secWords.length < 2) return null;

    const firstWord = secWords[0];
    const lastWord = secWords[secWords.length - 1];

    const match = dbEmployees.find(e => {
        const dbName = e.name.trim().toUpperCase();
        return dbName.includes(firstWord) && dbName.includes(lastWord);
    });

    return match ? match.id : null;
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
export async function syncSecullumOccurrences(year: number, month: number, companyNameOrId?: string, bypassAuth = false) {
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

        // B. Fetch active DB employees (optionally filtered by company) and build a lookup map
        const whereClause: any = {};
        if (companyNameOrId && companyNameOrId !== "all") {
            whereClause.OR = [
                { companyId: companyNameOrId },
                { company: { name: companyNameOrId } }
            ];
        }

        const dbEmployees = await prisma.employee.findMany({
            where: whereClause,
            select: { 
                id: true, 
                cpf: true, 
                name: true,
                admissionDate: true,
                company: { select: { name: true } },
                assignments: {
                    where: { endDate: null },
                    include: {
                        posto: true
                    }
                }
            }
        });
        const cpfToEmployeeIdMap = new Map<string, string>();
        dbEmployees.forEach(emp => {
            if (emp.cpf) {
                cpfToEmployeeIdMap.set(cleanCpfStr(emp.cpf), emp.id);
            }
        });

        let totalImported = 0;
        // In-memory dedup guard: tracks "employeeId_YYYY-MM-DD" keys already processed
        // in this sync run to prevent duplicate creation from race conditions or
        // multiple Secullum records for the same employee+day
        const processedOccurrences = new Set<string>();

        // C. Fetch long-term Afastamentos (Vacations, INSS, Licenças, Atestados de longo prazo)
        const afastamentos = await client.getAfastamentos(startDateStr, endDateStr);
        for (const af of afastamentos) {
            const cleanCpf = cleanCpfStr(af.Cpf);
            let employeeId = cpfToEmployeeIdMap.get(cleanCpf);
            if (!employeeId) {
                // Try matching by name
                const secEmp = secullumEmployees.find(se => se.Cpf && cleanCpfStr(se.Cpf) === cleanCpf);
                if (secEmp) {
                    employeeId = matchEmployeeByName(secEmp.Nome, dbEmployees) || undefined;
                }
            }
            if (!employeeId) continue;

            const startAfDate = af.Inicio ? parseLocalDate(af.Inicio) : null;
            const endAfDate = af.Fim ? parseLocalDate(af.Fim) : null;

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
            
            const folha = b.Funcionario?.NumeroFolha?.trim();
            if (!folha) continue;

            const cleanCpf = folhaToCpfMap.get(folha);
            let employeeId = cleanCpf ? cpfToEmployeeIdMap.get(cleanCpf) : undefined;
            if (!employeeId) {
                // Try matching by name using folha map
                const secEmp = secullumEmployees.find(se => se.NumeroFolha && se.NumeroFolha.trim() === folha);
                if (secEmp) {
                    employeeId = matchEmployeeByName(secEmp.Nome, dbEmployees) || undefined;
                }
            }
            if (!employeeId) continue;

            const occDate = b.Data ? parseLocalDate(b.Data) : new Date();

            // Roster/Schedule verification to determine work day vs rest day (folga)
            const empDb = dbEmployees.find(e => e.id === employeeId);
            const activeAssignment = empDb?.assignments?.[0];
            const posto = activeAssignment?.posto;

            let isLocalFolga = false;
            if (posto && posto.schedule) {
                const pivotDate = activeAssignment.startDate || empDb?.admissionDate || new Date();
                const roster = generateRoster(posto.schedule, pivotDate, [occDate]);
                if (roster.length > 0 && roster[0].status === "Folga") {
                    isLocalFolga = true;
                }
            }

            const isAtestado = /at\.?\s*med/i.test(rawEntrada) || /at\.?\s*med/i.test(rawObs) ||
                               rawEntrada.includes("atestado") || rawEntrada.includes("medico") || rawEntrada.includes("médico") || rawEntrada.includes("atest") ||
                               rawObs.includes("atestado") || rawObs.includes("medico") || rawObs.includes("médico") || rawObs.includes("atest");
            
            // Only count as Lack (Falta) if explicitly marked OR if it's a scheduled workday with no punches
            const hasNoPunches = !b.Entrada1 && !b.Saida1 && !b.Entrada2 && !b.Saida2;
            const isWorkday = b.Folga === false;
            const isFalta = !isLocalFolga && (rawEntrada.includes("falta") || rawObs.includes("falta") || (hasNoPunches && isWorkday && !isAtestado));
            const startOfDay = new Date(occDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(occDate);
            endOfDay.setHours(23, 59, 59, 999);

            // In-memory dedup: skip if we already handled this employee+day in this sync run
            const dateKey = `${employeeId}_${occDate.toISOString().split('T')[0]}`;
            if (processedOccurrences.has(dateKey)) continue;

            // Double check no occurrence exists on this date in the DB
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
                processedOccurrences.add(dateKey); // mark as handled
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
                        processedOccurrences.add(dateKey); // prevent re-creation for same employee+day
                        totalImported++;
                    }
                }
            }

        }

        // Pre-group batidas by employeeId
        const employeeBatidasMap = new Map<string, typeof batidas>();
        for (const b of batidas) {
            const folha = b.Funcionario?.NumeroFolha?.trim();
            if (!folha) continue;
            const cleanCpf = folhaToCpfMap.get(folha);
            let empId = cleanCpf ? cpfToEmployeeIdMap.get(cleanCpf) : undefined;
            if (!empId) {
                const secEmp = secullumEmployees.find(se => se.NumeroFolha && se.NumeroFolha.trim() === folha);
                if (secEmp) {
                    empId = matchEmployeeByName(secEmp.Nome, dbEmployees) || undefined;
                }
            }
            if (empId) {
                if (!employeeBatidasMap.has(empId)) employeeBatidasMap.set(empId, []);
                employeeBatidasMap.get(empId)!.push(b);
            }
        }

        // Helper: Calculate CLT night hours from punch strings
        const calcNightHoursFromPunches = (e1?: string, s1?: string, e2?: string, s2?: string, e3?: string, s3?: string): number => {
            const parseM = (t?: string) => {
                if (!t || typeof t !== "string") return null;
                const clean = t.replace(/[*¨^]/g, "").trim();
                if (!clean.includes(":")) return null;
                const [h, m] = clean.split(":").map(Number);
                if (isNaN(h) || isNaN(m)) return null;
                return h * 60 + m;
            };
            const pairs = [
                [parseM(e1), parseM(s1)],
                [parseM(e2), parseM(s2)],
                [parseM(e3), parseM(s3)]
            ];
            let nightM = 0;
            for (let [start, end] of pairs) {
                if (start === null || end === null) continue;
                if (end <= start) end += 24 * 60;
                const nightStart = 22 * 60;
                const isNightShift = start >= nightStart || start <= 5 * 60;
                const effectiveNightEnd = isNightShift ? end : Math.min(end, 29 * 60);
                const oStart = Math.max(start, nightStart);
                const oEnd = Math.min(end, effectiveNightEnd);
                if (oEnd > oStart) {
                    nightM += (oEnd - oStart) * (60 / 52.5);
                }
                if (start < 5 * 60) {
                    const mEnd = Math.min(end, 5 * 60);
                    if (mEnd > start) nightM += (mEnd - start) * (60 / 52.5);
                }
            }
            return nightM / 60;
        };

        // E. Fetch calculations for each employee in parallel chunks to prevent timeouts and rate-limits
        const chunkSize = 5; // 5 parallel requests
        for (let i = 0; i < dbEmployees.length; i += chunkSize) {
            const chunk = dbEmployees.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (emp) => {
                try {
                    let cleanCpf = cleanCpfStr(emp.cpf);
                    // Fallback to matching by name if CPF is missing, temporary or placeholder
                    if (!cleanCpf || cleanCpf.startsWith("00000000") || cleanCpf.startsWith("TEMP") || cleanCpf.length < 11) {
                        const secEmp = secullumEmployees.find(se => se.Nome && matchEmployeeByName(se.Nome, [emp]));
                        if (secEmp && secEmp.Cpf) {
                            cleanCpf = cleanCpfStr(secEmp.Cpf);
                        }
                    }

                    let atrasosHours = 0;
                    let extras50Hours = 0;
                    let extras100Hours = 0;
                    let notHours = 0;

                    if (cleanCpf && cleanCpf.length === 11) {
                        try {
                            const res = await client.getCalculos(cleanCpf, startDateStr, endDateStr);
                            if (res && res.Colunas && res.Totais) {
                                const cols = res.Colunas as string[];
                                const totais = res.Totais as string[];
                                
                                const faltasIdx = cols.findIndex(c => /^Faltas?$/i.test(c));
                                const atrasIdx = cols.findIndex(c => /^Atras\.?$/i.test(c) || /Atraso/i.test(c));
                                const extrasIdx = cols.findIndex(c => /^Extras?$/i.test(c));
                                
                                // Prioritize exact "Not." (nominal night hours) over "Not.Tot."
                                let notIdx = cols.findIndex(c => /^Not\.?$/i.test(c));
                                if (notIdx === -1) {
                                    notIdx = cols.findIndex(c => /^Noturna/i.test(c) || /Adic\.?\s*Not/i.test(c));
                                }
                                if (notIdx === -1) {
                                    notIdx = cols.findIndex(c => /Not\.Tot/i.test(c));
                                }
                                
                                const parseTimeToHours = (timeStr: string): number => {
                                    if (!timeStr) return 0;
                                    const isNegative = timeStr.startsWith("-");
                                    const cleanStr = isNegative ? timeStr.substring(1) : timeStr;
                                    const parts = cleanStr.split(":");
                                    if (parts.length < 2) return 0;
                                    const hours = parseInt(parts[0], 10) || 0;
                                    const minutes = parseInt(parts[1], 10) || 0;
                                    const decimal = hours + (minutes / 60);
                                    return isNegative ? -decimal : decimal;
                                };
                                
                                const faltasHours = faltasIdx !== -1 && faltasIdx < totais.length ? parseTimeToHours(totais[faltasIdx]) : 0;
                                const atrasosVal = atrasIdx !== -1 && atrasIdx < totais.length ? parseTimeToHours(totais[atrasIdx]) : 0;
                                atrasosHours = Math.round((faltasHours + atrasosVal) * 100) / 100;
                                
                                const extrasHours = extrasIdx !== -1 && extrasIdx < totais.length ? parseTimeToHours(totais[extrasIdx]) : 0;
                                notHours = notIdx !== -1 && notIdx < totais.length ? parseTimeToHours(totais[notIdx]) : 0;
                                extras50Hours = extrasHours;
                            }
                        } catch (err) {}
                    }

                    // Fallback: If notHours is still 0, compute from batidas
                    if (notHours === 0) {
                        const empBatidas = employeeBatidasMap.get(emp.id) || [];
                        let sumNight = 0;
                        for (const b of empBatidas) {
                            sumNight += calcNightHoursFromPunches(b.Entrada1, b.Saida1, b.Entrada2, b.Saida2);
                        }
                        if (sumNight > 0) {
                            notHours = Math.round(sumNight * 100) / 100;
                        }
                    }

                    // Upsert monthly calculation if any hour is present or update existing record
                    if (notHours > 0 || extras50Hours > 0 || extras100Hours > 0 || atrasosHours > 0) {
                        await prisma.employeeMonthlyCalculus.upsert({
                            where: {
                                employeeId_year_month: {
                                    employeeId: emp.id,
                                    year,
                                    month
                                }
                            },
                            update: {
                                atrasosHours,
                                extras50Hours,
                                extras100Hours,
                                adicionalNoturnoHours: notHours
                            },
                            create: {
                                employeeId: emp.id,
                                year,
                                month,
                                atrasosHours,
                                extras50Hours,
                                extras100Hours,
                                adicionalNoturnoHours: notHours
                            }
                        });
                    }
                } catch (calcErr) {
                    // Suppress individual point API errors
                }
            }));
            await new Promise(r => setTimeout(r, 120));
        }

        // Update Last Sync Timestamp
        await prisma.benefitsConfig.update({
            where: { id: config.id },
            data: { secullumLastSyncAt: new Date() }
        });

        try {
            revalidatePath("/admin/benefits");
            revalidatePath("/admin/employees");
            revalidatePath("/admin/payroll-preview");
        } catch (e) {}

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
