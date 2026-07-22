"use server";

import { prisma } from "@/lib/db";
import { startOfYear, endOfYear, differenceInDays } from "date-fns";

export async function getReportsData(year: number) {
    try {
        const start = startOfYear(new Date(year, 0, 1));
        const end = endOfYear(new Date(year, 11, 31));

        // 1. Carregar todos os Clientes e seus Postos
        const clients = await prisma.client.findMany({
            include: {
                company: true,
                postos: {
                    include: { role: true }
                }
            },
            orderBy: { name: "asc" }
        });

        // 2. Carregar todos os Colaboradores
        const employees = await prisma.employee.findMany({
            include: {
                situation: true,
                role: true,
                assignments: true
            },
            orderBy: { name: "asc" }
        });

        // 3. Buscar todas as Alocações que intersectam o ano selecionado
        const assignments = await prisma.assignment.findMany({
            where: {
                startDate: { lte: end },
                OR: [
                    { endDate: null },
                    { endDate: { gte: start } }
                ]
            },
            include: {
                employee: true,
                posto: {
                    include: { client: true }
                }
            }
        });

        // 4. Buscar Ocorrências do Secullum (Faltas/Atestados)
        const occurrences = await prisma.occurrence.findMany({
            where: {
                date: { gte: start, lte: end },
                title: { startsWith: "Secullum" }
            },
            include: {
                employee: true,
                posto: {
                    include: { client: true }
                }
            }
        });

        // 5. Buscar Batidas da Mesa de Operações (para Cobertura)
        const attendances = await prisma.attendance.findMany({
            where: {
                date: { gte: start, lte: end }
            },
            include: {
                posto: {
                    include: { client: true }
                },
                employee: true,
                coveredBy: true
            }
        });

        // 6. Buscar Vagas do Recrutamento e Seleção
        const vacancies = await prisma.vacancy.findMany({
            where: {
                createdAt: { lte: end },
                OR: [
                    { status: "OPEN" },
                    { status: "HOLD" },
                    { updatedAt: { gte: start } }
                ]
            },
            include: {
                posto: {
                    include: { client: true }
                },
                role: true,
                recruiter: true
            }
        });

        // --- PROCESSAMENTO MÊS A MÊS (0 a 11) ---
        const months = Array.from({ length: 12 }, (_, i) => i);

        // A. RELATÓRIO 1: TURNOVER DE SUBSTITUIÇÕES POR CONTRATO
        const turnoverReport = clients.map(client => {
            const clientPostosIds = client.postos.map(p => p.id);
            const clientAssignments = assignments.filter(asg => clientPostosIds.includes(asg.postoId));

            const monthlyData = months.map(m => {
                const monthStart = new Date(year, m, 1);
                const monthEnd = new Date(year, m + 1, 0, 23, 59, 59, 999);

                // Admissões (novas alocações que começaram neste mês)
                const admissions = clientAssignments.filter(asg => 
                    asg.startDate >= monthStart && asg.startDate <= monthEnd
                );

                // Demissões/Encruzamentos (alocações encerradas neste mês)
                const departures = clientAssignments.filter(asg => 
                    asg.endDate && asg.endDate >= monthStart && asg.endDate <= monthEnd
                );

                // Headcount ativo (alocação ativa em qualquer momento do mês)
                const activeHeadcount = clientAssignments.filter(asg => 
                    asg.startDate <= monthEnd && (asg.endDate === null || asg.endDate >= monthStart)
                ).length;

                const admissionsCount = admissions.length;
                const departuresCount = departures.length;

                const rate = activeHeadcount > 0 
                    ? (((admissionsCount + departuresCount) / 2) / activeHeadcount) * 100 
                    : 0;

                return {
                    month: m,
                    admissions: admissionsCount,
                    departures: departuresCount,
                    headcount: activeHeadcount,
                    rate
                };
            });

            // Acumulados do ano
            const totalAdmissions = monthlyData.reduce((sum, d) => sum + d.admissions, 0);
            const totalDepartures = monthlyData.reduce((sum, d) => sum + d.departures, 0);
            const avgHeadcount = monthlyData.reduce((sum, d) => sum + d.headcount, 0) / 12;

            const annualRate = avgHeadcount > 0 
                ? (((totalAdmissions + totalDepartures) / 2) / avgHeadcount) * 100 
                : 0;

            return {
                clientId: client.id,
                clientName: client.name,
                companyName: client.company?.name || "-",
                monthlyData,
                totalAdmissions,
                totalDepartures,
                avgHeadcount: Math.round(avgHeadcount),
                annualRate
            };
        });

        // B. RELATÓRIO 2: ABSENTEÍSMO POR CONTRATO (Faltas/Atestados Secullum)
        const absenteismoReport = clients.map(client => {
            const clientPostos = client.postos;
            const clientPostosIds = clientPostos.map(p => p.id);
            const clientOccurrences = occurrences.filter(occ => clientPostosIds.includes(occ.postoId));

            const monthlyData = months.map(m => {
                const monthStart = new Date(year, m, 1);
                const monthEnd = new Date(year, m + 1, 0, 23, 59, 59, 999);

                // Faltas/Atestados no mês
                const monthOccs = clientOccurrences.filter(occ => 
                    occ.date >= monthStart && occ.date <= monthEnd
                );

                const faltas = monthOccs.filter(o => o.type === "FALTA" || o.type === "FALTA_INJUSTIFICADA").length;
                const atestados = monthOccs.filter(o => o.type === "ATESTADO").length;

                // Headcount ativo no mês
                const activeHeadcount = assignments.filter(asg => 
                    clientPostosIds.includes(asg.postoId) &&
                    asg.startDate <= monthEnd && 
                    (asg.endDate === null || asg.endDate >= monthStart)
                ).length;

                // Escalas previstas no mês
                // Calculado somando os dias previstos de trabalho para cada posto ativo no mês
                let escalasPrevistas = 0;
                const daysInMonth = monthEnd.getDate();

                clientPostos.forEach(posto => {
                    const hasActiveAsg = assignments.some(asg => 
                        asg.postoId === posto.id &&
                        asg.startDate <= monthEnd && 
                        (asg.endDate === null || asg.endDate >= monthStart)
                    );
                    if (!hasActiveAsg) return;

                    const normSchedule = posto.schedule.replace(/\s+/g, '').toLowerCase();
                    
                    // Lógica de cálculo simplificada baseada no tipo de escala
                    if (normSchedule.includes('12x36')) {
                        escalasPrevistas += Math.round(daysInMonth / 2);
                    } else if (normSchedule.includes('5x2') || normSchedule.includes('mondaytofriday')) {
                        // Dias úteis aproximados (22)
                        escalasPrevistas += 22;
                    } else if (normSchedule.includes('6x1') || normSchedule.includes('mondaytosaturday')) {
                        // Dias de trabalho aproximados (26)
                        escalasPrevistas += 26;
                    } else {
                        // Escala diária completa ou linear padrão (30)
                        escalasPrevistas += daysInMonth;
                    }
                });

                const rate = escalasPrevistas > 0 
                    ? ((faltas + atestados) / escalasPrevistas) * 100 
                    : 0;

                return {
                    month: m,
                    faltas,
                    atestados,
                    totalOccurrences: faltas + atestados,
                    escalasPrevistas,
                    rate
                };
            });

            const totalFaltas = monthlyData.reduce((sum, d) => sum + d.faltas, 0);
            const totalAtestados = monthlyData.reduce((sum, d) => sum + d.atestados, 0);
            const totalOccurrences = totalFaltas + totalAtestados;
            const totalEscalasPrevistas = monthlyData.reduce((sum, d) => sum + d.escalasPrevistas, 0);

            const annualRate = totalEscalasPrevistas > 0 
                ? (totalOccurrences / totalEscalasPrevistas) * 100 
                : 0;

            return {
                clientId: client.id,
                clientName: client.name,
                companyName: client.company?.name || "-",
                monthlyData,
                totalFaltas,
                totalAtestados,
                totalOccurrences,
                totalEscalasPrevistas,
                annualRate
            };
        });

        // C. RELATÓRIO 3: ÍNDICE DE COBERTURA POR CONTRATO (Mesa de Operações)
        const coberturaReport = clients.map(client => {
            const clientPostosIds = client.postos.map(p => p.id);
            const clientAttendances = attendances.filter(att => clientPostosIds.includes(att.postoId));

            const monthlyData = months.map(m => {
                const monthStart = new Date(year, m, 1);
                const monthEnd = new Date(year, m + 1, 0, 23, 59, 59, 999);

                // Filtrar batidas de falta registradas na mesa neste mês
                const monthAttendances = clientAttendances.filter(att => 
                    att.date >= monthStart && att.date <= monthEnd && att.status === "FALTA"
                );

                const totalFaltas = monthAttendances.length;
                const totalCobertas = monthAttendances.filter(att => 
                    att.coveredById || att.coverageType === "DIARISTA" || att.coverageType === "RESERVA_TECNICA"
                ).length;

                const rate = totalFaltas > 0 ? (totalCobertas / totalFaltas) * 100 : 100;

                return {
                    month: m,
                    totalFaltas,
                    totalCobertas,
                    rate
                };
            });

            const annualFaltas = monthlyData.reduce((sum, d) => sum + d.totalFaltas, 0);
            const annualCobertas = monthlyData.reduce((sum, d) => sum + d.totalCobertas, 0);
            const annualRate = annualFaltas > 0 ? (annualCobertas / annualFaltas) * 100 : 100;

            return {
                clientId: client.id,
                clientName: client.name,
                companyName: client.company?.name || "-",
                monthlyData,
                annualFaltas,
                annualCobertas,
                annualRate
            };
        });

        // D. RELATÓRIO 4: FALTAS/ATESTADOS POR COLABORADOR (Secullum Occurrences)
        const colaboradorReport = employees.map(emp => {
            const empOccurrences = occurrences.filter(occ => occ.employeeId === emp.id);

            const monthlyData = months.map(m => {
                const monthStart = new Date(year, m, 1);
                const monthEnd = new Date(year, m + 1, 0, 23, 59, 59, 999);

                const monthOccs = empOccurrences.filter(occ => 
                    occ.date >= monthStart && occ.date <= monthEnd
                );

                const faltas = monthOccs.filter(o => o.type === "FALTA" || o.type === "FALTA_INJUSTIFICADA").length;
                const atestados = monthOccs.filter(o => o.type === "ATESTADO").length;

                return {
                    month: m,
                    faltas,
                    atestados,
                    total: faltas + atestados
                };
            });

            const totalFaltas = monthlyData.reduce((sum, d) => sum + d.faltas, 0);
            const totalAtestados = monthlyData.reduce((sum, d) => sum + d.atestados, 0);
            const totalOccurrences = totalFaltas + totalAtestados;

            return {
                employeeId: emp.id,
                employeeName: emp.name,
                status: emp.status, // "Ativo" ou "Desligado"
                situationName: emp.situation?.name || "Ativo",
                roleName: emp.role?.name || "-",
                monthlyData,
                totalFaltas,
                totalAtestados,
                totalOccurrences
            };
        });

        // E. RELATÓRIO 5: RECRUTAMENTO E SELEÇÃO (Vagas Fechadas & SLA)
        const recruitmentReport = clients.map(client => {
            const clientPostosIds = client.postos.map(p => p.id);
            const clientVacancies = vacancies.filter(v => v.postoId && clientPostosIds.includes(v.postoId));

            const monthlyData = months.map(m => {
                const monthStart = new Date(year, m, 1);
                const monthEnd = new Date(year, m + 1, 0, 23, 59, 59, 999);

                // Filtrar apenas vagas que foram fechadas (CLOSED) neste mês
                const closedVacancies = clientVacancies.filter(v => 
                    v.status === "CLOSED" && v.updatedAt >= monthStart && v.updatedAt <= monthEnd
                );

                const count = closedVacancies.length;
                
                // Calcular SLA médio para as vagas fechadas no mês (diferença entre fechamento e abertura)
                let totalSlaDays = 0;
                closedVacancies.forEach(v => {
                    const days = differenceInDays(new Date(v.updatedAt), new Date(v.createdAt));
                    totalSlaDays += Math.max(0, days);
                });

                const avgSla = count > 0 ? totalSlaDays / count : 0;

                return {
                    month: m,
                    count,
                    avgSla: parseFloat(avgSla.toFixed(1))
                };
            });

            const totalClosed = monthlyData.reduce((sum, d) => sum + d.count, 0);
            
            // SLA médio anual acumulado
            const closedVacanciesYear = clientVacancies.filter(v => 
                v.status === "CLOSED" && v.updatedAt >= start && v.updatedAt <= end
            );
            let totalSlaYear = 0;
            closedVacanciesYear.forEach(v => {
                const days = differenceInDays(new Date(v.updatedAt), new Date(v.createdAt));
                totalSlaYear += Math.max(0, days);
            });
            const annualSla = closedVacanciesYear.length > 0 ? totalSlaYear / closedVacanciesYear.length : 0;

            return {
                clientId: client.id,
                clientName: client.name,
                companyName: client.company?.name || "-",
                monthlyData,
                totalClosed,
                annualSla: parseFloat(annualSla.toFixed(1))
            };
        });

        // --- CÁLCULO DE KPIs DE TOPO PARA CADA ABA ---
        
        // 1. Turnover KPIs
        const totalTurnoverSubs = turnoverReport.reduce((sum, c) => sum + c.totalAdmissions, 0);
        const avgTurnoverRate = turnoverReport.length > 0
            ? turnoverReport.reduce((sum, c) => sum + c.annualRate, 0) / turnoverReport.length
            : 0;
        const highestTurnoverClient = [...turnoverReport]
            .sort((a, b) => b.annualRate - a.annualRate)[0]?.clientName || "-";

        // 2. Absenteísmo KPIs
        const avgAbsGeneral = absenteismoReport.length > 0
            ? absenteismoReport.reduce((sum, c) => sum + c.annualRate, 0) / absenteismoReport.length
            : 0;
        
        // Mês crítico geral (mês com maior soma de ocorrências)
        const monthlyOccurrencesSums = months.map(m => {
            const sum = absenteismoReport.reduce((acc, c) => acc + (c.monthlyData[m]?.totalOccurrences || 0), 0);
            return { month: m, sum };
        });
        const criticalMonthIndex = [...monthlyOccurrencesSums].sort((a, b) => b.sum - a.sum)[0]?.month ?? 0;
        const criticalMonthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const criticalMonth = criticalMonthNames[criticalMonthIndex];

        const highestAbsClient = [...absenteismoReport]
            .sort((a, b) => b.annualRate - a.annualRate)[0]?.clientName || "-";

        // 3. Cobertura KPIs
        const avgCoverageGeneral = coberturaReport.length > 0
            ? coberturaReport.reduce((sum, c) => sum + c.annualRate, 0) / coberturaReport.length
            : 100;
        const totalFaltasMesa = coberturaReport.reduce((sum, c) => sum + c.annualFaltas, 0);
        const totalCobertasMesa = coberturaReport.reduce((sum, c) => sum + c.annualCobertas, 0);

        // 4. Colaboradores KPIs
        const totalActiveColabs = colaboradorReport.filter(e => e.status === "Ativo").length;
        const totalFaltasColabs = colaboradorReport.reduce((sum, e) => sum + e.totalOccurrences, 0);
        const avgFaltasPerColab = totalActiveColabs > 0 ? totalFaltasColabs / totalActiveColabs : 0;
        const highestFaltaColab = [...colaboradorReport]
            .sort((a, b) => b.totalOccurrences - a.totalOccurrences)[0]?.employeeName || "-";

        // 5. R&S KPIs
        const totalClosedVacancies = recruitmentReport.reduce((sum, c) => sum + c.totalClosed, 0);
        const totalClosedVacanciesAll = vacancies.filter(v => v.status === "CLOSED" && v.updatedAt >= start && v.updatedAt <= end);
        let totalSlaDaysAll = 0;
        totalClosedVacanciesAll.forEach(v => {
            const days = differenceInDays(new Date(v.updatedAt), new Date(v.createdAt));
            totalSlaDaysAll += Math.max(0, days);
        });
        const avgSlaRecruitment = totalClosedVacanciesAll.length > 0 ? totalSlaDaysAll / totalClosedVacanciesAll.length : 0;
        const highestDemandClient = [...recruitmentReport]
            .sort((a, b) => b.totalClosed - a.totalClosed)[0]?.clientName || "-";

        return {
            success: true,
            turnoverReport,
            absenteismoReport,
            coberturaReport,
            colaboradorReport,
            recruitmentReport,
            kpis: {
                turnover: {
                    totalSubs: totalTurnoverSubs,
                    avgRate: parseFloat(avgTurnoverRate.toFixed(1)),
                    highestClient: highestTurnoverClient
                },
                absenteismo: {
                    avgRate: parseFloat(avgAbsGeneral.toFixed(1)),
                    criticalMonth,
                    highestClient: highestAbsClient
                },
                cobertura: {
                    avgRate: parseFloat(avgCoverageGeneral.toFixed(1)),
                    totalFaltas: totalFaltasMesa,
                    totalCobertas: totalCobertasMesa
                },
                colaborador: {
                    activeCount: totalActiveColabs,
                    totalFaltas: totalFaltasColabs,
                    avgPerColab: parseFloat(avgFaltasPerColab.toFixed(1)),
                    highestColab: highestFaltaColab
                },
                recruitment: {
                    totalClosed: totalClosedVacancies,
                    avgSla: parseFloat(avgSlaRecruitment.toFixed(1)),
                    highestClient: highestDemandClient
                }
            }
        };

    } catch (error: any) {
        console.error("[getReportsData Server Action] Error:", error.message);
        return { success: false, error: error.message };
    }
}

// 7. Ação secundária para buscar os detalhes das ocorrências (Absenteísmo e Colaboradores) do Secullum
export async function getMonthOccurrencesDetails(clientId: string | null, employeeId: string | null, year: number, month: number) {
    try {
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

        const whereClause: any = {
            date: { gte: monthStart, lte: monthEnd },
            title: { startsWith: "Secullum" }
        };

        if (employeeId) {
            whereClause.employeeId = employeeId;
        } else if (clientId) {
            whereClause.posto = { clientId };
        }

        const list = await prisma.occurrence.findMany({
            where: whereClause,
            include: {
                employee: {
                    include: { situation: true }
                },
                posto: {
                    include: { client: true }
                }
            },
            orderBy: { date: "asc" }
        });

        return {
            success: true,
            list: list.map(occ => ({
                id: occ.id,
                date: occ.date.toISOString().split("T")[0],
                clientName: occ.posto?.client?.name || "-",
                postoRole: occ.title || "-",
                employeeName: occ.employee?.name || "-",
                situation: occ.employee?.situation?.name || "Ativo",
                type: occ.type,
                description: occ.description || "-"
            }))
        };

    } catch (error: any) {
        console.error("[getMonthOccurrencesDetails] Error:", error.message);
        return { success: false, error: error.message };
    }
}

// 8. Ação secundária para buscar os detalhes da Mesa de Operações (Índice de Cobertura)
export async function getMonthAttendancesDetails(clientId: string, year: number, month: number) {
    try {
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

        const list = await prisma.attendance.findMany({
            where: {
                posto: { clientId },
                date: { gte: monthStart, lte: monthEnd },
                status: "FALTA"
            },
            include: {
                employee: true,
                coveredBy: true,
                posto: {
                    include: { client: true, role: true }
                }
            },
            orderBy: { date: "asc" }
        });

        return {
            success: true,
            list: list.map(att => {
                const isCovered = att.coveredById || att.coverageType === "DIARISTA" || att.coverageType === "RESERVA_TECNICA";
                
                const diaristaName = (() => {
                    if (att.coverageType === "DIARISTA" && att.notes) {
                        const parts = att.notes.split(" | ");
                        return parts[0];
                    }
                    return null;
                })();

                const parsedNotes = (() => {
                    if (att.coverageType === "DIARISTA" && att.notes) {
                        const parts = att.notes.split(" | ");
                        return parts.slice(1).join(" | ") || "-";
                    }
                    return att.notes || "Falta registrada.";
                })();

                return {
                    id: att.id,
                    date: att.date.toISOString().split("T")[0],
                    clientName: att.posto?.client?.name || "-",
                    postoRole: att.posto?.role?.name || "Posto",
                    schedule: att.posto?.schedule || "-",
                    time: `${att.posto?.startTime || ""} - ${att.posto?.endTime || ""}`,
                    employeeName: att.employee?.name || "Não informado",
                    status: isCovered ? "Coberto" : "Sem Cobertura",
                    coveredByName: att.coveredBy?.name || diaristaName || (att.coverageType === "DIARISTA" ? "Diarista" : att.coverageType === "RESERVA_TECNICA" ? "Reserva Técnica" : "Outro Colaborador"),
                    coverageType: att.coverageType === "DIARISTA" ? "Diarista" : att.coverageType === "RESERVA_TECNICA" ? "Reserva Técnica" : "Outra Cobertura",
                    notes: parsedNotes
                };
            })
        };

    } catch (error: any) {
        console.error("[getMonthAttendancesDetails] Error:", error.message);
        return { success: false, error: error.message };
    }
}

// 9. Ação secundária para buscar os detalhes das Vagas Fechadas de R&S
export async function getMonthVacanciesDetails(clientId: string, year: number, month: number) {
    try {
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

        const list = await prisma.vacancy.findMany({
            where: {
                posto: { clientId },
                status: "CLOSED",
                updatedAt: { gte: monthStart, lte: monthEnd }
            },
            include: {
                posto: {
                    include: { client: true }
                },
                role: true,
                recruiter: true
            },
            orderBy: { updatedAt: "asc" }
        });

        return {
            success: true,
            list: list.map(v => {
                const days = differenceInDays(new Date(v.updatedAt), new Date(v.createdAt));
                return {
                    id: v.id,
                    title: v.title,
                    clientName: v.posto?.client?.name || "-",
                    postoRole: v.role?.name || "-",
                    createdAt: v.createdAt.toISOString().split("T")[0],
                    closedAt: v.updatedAt.toISOString().split("T")[0],
                    slaDays: Math.max(0, days),
                    recruiterName: v.recruiter?.name || "-"
                };
            })
        };

    } catch (error: any) {
        console.error("[getMonthVacanciesDetails] Error:", error.message);
        return { success: false, error: error.message };
    }
}
