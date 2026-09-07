"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ExtractedHoleriteItem } from "@/lib/holerite-processor";
import { ParsedPointEmployee } from "@/lib/point-parser";

export type AuditDiscrepancyType = 
    | "CRITICAL_RISK"       // Pago integralmente mas sem ponto / abandono / afastado
    | "MISSING_HOLERITE"    // Consta no Ponto / WFH mas não recebeu holerite
    | "MISSING_POINT"       // Tem holerite emitido mas não consta no Ponto
    | "DEDUCTION_MISMATCH"  // Faltas divergentes entre Ponto e Holerite
    | "SALARY_MISMATCH"     // Salário base divergente entre cadastro e holerite
    | "ALIGNED";            // 100% Alinhado

export interface PayrollAuditRow {
    id: string;
    name: string;
    employeeName: string;
    cpf: string;
    folha?: string;
    companyName?: string;
    clientName?: string;
    postoName?: string;
    wfhSituation: string;
    wfhStatus: string;
    wfhBaseSalary: number;
    wfhFaltasCount: number;

    // Dados do Ponto
    hasPoint: boolean;
    pointWorkedHours: number;
    pointPunchesCount: number;
    pointFaltasCount: number;
    pointFaltasHours: number;
    pointExtrasHours: number;
    pointNoturnoHours: number;

    // Dados do Holerite
    hasHolerite: boolean;
    holeriteBaseSalary: number;
    holeriteTotalEarnings: number;
    holeriteTotalDeductions: number;
    holeriteNetSalary: number;
    holeriteAbsenceDays: number;
    holeriteAbsenceDeduction: number;
    holeriteWorkedDays: number;

    // Diagnóstico
    status: AuditDiscrepancyType;
    riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "OK";
    diagnosticMessage: string;
    discrepancies: string[];
    suggestedAction: string;

    // Nested structures for rich UI rendering & export
    wfh?: {
        situation: string;
        status: string;
        companyName?: string;
        clientName?: string;
        jobTitle?: string;
        baseSalary?: number;
        isAbandonment?: boolean;
        isDismissed?: boolean;
        isMedicalLeave?: boolean;
    };
    point?: {
        workedHours?: string;
        punchCount?: number;
        absenceDays?: number;
        absenceHours?: string;
        extraHours?: string;
    };
    holerite?: {
        baseSalary?: number;
        totalEarnings?: number;
        totalDeductions?: number;
        netSalary?: number;
        workedDays?: number;
        absenceDeduction?: number;
        pageNumber?: number;
        companyName?: string;
        role?: string;
    };
}

export interface PayrollAuditSummary {
    totalEvaluated: number;
    totalAudited: number;
    criticalCount: number;
    criticalRiskCount: number;
    missingHoleriteCount: number;
    missingPointCount: number;
    deductionMismatchCount: number;
    mismatchCount: number;
    alignedCount: number;
    totalHoleriteNet: number;
    totalSuspectedOverpayment: number;
    totalOverpaymentSuspected: number;
}

export type AuditRow = PayrollAuditRow;

export interface PayrollAuditResult {
    rows: PayrollAuditRow[];
    summary: PayrollAuditSummary;
}

function cleanCpfDigits(cpf: string | undefined | null): string {
    return (cpf || "").replace(/\D/g, "");
}

function normalizeName(name: string | undefined | null): string {
    return (name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Cruza Holerites × Ponto × WFH
 */
export async function runPayrollAudit(params: {
    year: number;
    month: number;
    companyId?: string;
    holeriteItems: ExtractedHoleriteItem[];
    pointItems: ParsedPointEmployee[];
}): Promise<{ success: boolean; data?: PayrollAuditResult; error?: string }> {
    try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const { year, month, companyId, holeriteItems = [], pointItems = [] } = params;

    // 1. Fetch WFH active/registered employees
    const whereEmployee: any = {};
    if (companyId && companyId !== "all") {
        whereEmployee.companyId = companyId;
    }

    // Cutoff window for occurrences (Day 26 of month-2 to Day 25 of month-1)
    let startMonth = month - 2;
    let startYear = year;
    if (startMonth <= 0) { startMonth += 12; startYear -= 1; }
    let endMonth = month - 1;
    let endYear = year;
    if (endMonth <= 0) { endMonth += 12; endYear -= 1; }

    const windowStart = new Date(startYear, startMonth - 1, 26, 0, 0, 0);
    const windowEnd = new Date(endYear, endMonth - 1, 25, 23, 59, 59);

    const wfhEmployees = await prisma.employee.findMany({
        where: whereEmployee,
        include: {
            company: true,
            situation: true,
            role: true,
            assignments: {
                where: { endDate: null },
                include: { posto: { include: { client: true, role: true } } }
            },
            occurrences: {
                where: {
                    date: { gte: windowStart, lte: windowEnd },
                    type: { in: ["FALTA", "FALTA_INJUSTIFICADA", "ATESTADO"] }
                }
            },
            monthlyCalculations: {
                where: { year, month }
            }
        },
        orderBy: { name: "asc" }
    });

    // 2. Build index maps
    // Holerite map by clean CPF and by normalized Name
    const holeriteByCpf = new Map<string, ExtractedHoleriteItem>();
    const holeriteByName = new Map<string, ExtractedHoleriteItem>();
    for (const h of holeriteItems) {
        const cpf = cleanCpfDigits(h.cpf);
        if (cpf) holeriteByCpf.set(cpf, h);
        const norm = normalizeName(h.employeeName);
        if (norm) holeriteByName.set(norm, h);
    }

    // Point map by clean CPF and by normalized Name
    const pointByCpf = new Map<string, ParsedPointEmployee>();
    const pointByName = new Map<string, ParsedPointEmployee>();
    for (const p of pointItems) {
        const cpf = cleanCpfDigits(p.cpf);
        if (cpf) pointByCpf.set(cpf, p);
        const norm = normalizeName(p.name);
        if (norm) pointByName.set(norm, p);
    }

    // Set of all unique identifiers (CPF or Name)
    const processedKeys = new Set<string>();
    const rows: PayrollAuditRow[] = [];

    // 3. Process each WFH Employee
    for (const emp of wfhEmployees) {
        const cpfDigits = cleanCpfDigits(emp.cpf);
        const normName = normalizeName(emp.name);
        const key = cpfDigits || normName;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);

        const holerite = (cpfDigits && holeriteByCpf.get(cpfDigits)) || holeriteByName.get(normName);
        const point = (cpfDigits && pointByCpf.get(cpfDigits)) || pointByName.get(normName);

        const activeAssignment = emp.assignments && emp.assignments.length > 0 ? emp.assignments[0] : null;
        const posto = activeAssignment?.posto;

        const wfhBaseSalary = (posto?.baseSalary && posto.baseSalary > 0)
            ? posto.baseSalary
            : (emp.salary || 0);

        const wfhFaltasCount = emp.occurrences ? emp.occurrences.filter(o => o.type !== "ATESTADO").length : 0;
        const situationName = emp.situation?.name || "Ativo";
        const isAbandonment = situationName.toLowerCase().includes("abandono");
        const isAfastado = situationName.toLowerCase().includes("inss") || situationName.toLowerCase().includes("afastad");
        const isDesligado = situationName.toLowerCase().includes("desligad") || situationName.toLowerCase().includes("demiti") || emp.status === "Desligado";

        const hasHolerite = !!holerite;
        const hasPoint = !!point;

        const holeriteBase = holerite?.baseSalary || 0;
        const holeriteEarnings = holerite?.totalEarnings || 0;
        const holeriteDeductions = holerite?.totalDeductions || 0;
        const holeriteNet = holerite?.netSalary || (holeriteEarnings > 0 ? holeriteEarnings - holeriteDeductions : 0);
        const holeriteAbsenceDays = holerite?.absenceDays || 0;
        const holeriteAbsenceDeduction = holerite?.absenceDeduction || 0;
        const holeriteWorkedDays = holerite?.workedDays || 30;

        const pointWorkedHours = point?.workedHours || 0;
        const pointPunchesCount = point?.punchesCount || 0;
        const pointFaltasCount = point?.faltasCount || 0;
        const pointFaltasHours = point?.faltasHours || 0;
        const pointExtrasHours = point?.extrasHours || 0;
        const pointNoturnoHours = point?.noturnoHours || 0;

        // Classify Status
        let status: AuditDiscrepancyType = "ALIGNED";
        let riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE" = "NONE";
        let diagnosticMessage = "Informações de folha, ponto e sistema conferidas.";
        let suggestedAction = "Liberar pagamento normalmente.";

        // Regra 1: Risco Crítico de Pagamento Indevido (Holerite cheio para colaborador que não trabalhou)
        if (hasHolerite && holeriteEarnings > 500) {
            if (isAbandonment) {
                status = "CRITICAL_RISK";
                riskLevel = "CRITICAL";
                diagnosticMessage = `🚨 ALERTA CRÍTICO: Holerite gerado (R$ ${holeriteNet.toFixed(2)}), mas colaborador está em PROCESSO DE ABANDONO no WFH!`;
                suggestedAction = "BLOQUEAR PAGAMENTO IMEDIATAMENTE e solicitar estorno/retificação da folha à contabilidade.";
            } else if (isDesligado) {
                status = "CRITICAL_RISK";
                riskLevel = "CRITICAL";
                diagnosticMessage = `🚨 ALERTA CRÍTICO: Holerite mensal integral gerado para colaborador DESLIGADO/DEMITIDO no WFH!`;
                suggestedAction = "BLOQUEAR PAGAMENTO. Verificar se houve emissão indevida de folha normal em vez de rescisão.";
            } else if (isAfastado && holeriteWorkedDays >= 25 && holeriteAbsenceDays === 0) {
                status = "CRITICAL_RISK";
                riskLevel = "CRITICAL";
                diagnosticMessage = `🚨 ALERTA CRÍTICO: Holerite integral gerado para colaborador AFASTADO PELO INSS!`;
                suggestedAction = "Conferir afastamento no INSS e sustar pagamento integral.";
            } else if (hasPoint && pointWorkedHours === 0 && pointPunchesCount === 0 && (pointFaltasCount >= 20 || pointFaltasHours >= 150)) {
                status = "CRITICAL_RISK";
                riskLevel = "CRITICAL";
                diagnosticMessage = `🚨 ALERTA CRÍTICO: Ponto registra 0 batidas / faltas integrais no mês, mas holerite veio com SALÁRIO CHEIO!`;
                suggestedAction = "Sustar pagamento e enviar cartão ponto com faltas para retificação pela contabilidade.";
            }
        }

        // Regra 2: Faltando Holerite (Colaborador trabalhou mas não veio na folha)
        if (status === "ALIGNED" && !hasHolerite && !isDesligado) {
            if ((hasPoint && (pointWorkedHours > 0 || pointPunchesCount > 0)) || (activeAssignment && !isAfastado && !isAbandonment)) {
                status = "MISSING_HOLERITE";
                riskLevel = "HIGH";
                diagnosticMessage = "Colaborador ativo com posto/ponto, porém NÃO FOI GERADO HOLERITE no lote da contabilidade.";
                suggestedAction = "Solicitar emissão complementar de holerite à contabilidade com urgência.";
            }
        }

        // Regra 3: Faltando Ponto (Tem holerite mas não consta no arquivo do Secullum)
        if (status === "ALIGNED" && hasHolerite && !hasPoint && pointItems.length > 0) {
            status = "MISSING_POINT";
            riskLevel = "MEDIUM";
            diagnosticMessage = "Holerite gerado pela contabilidade, mas colaborador NÃO ENCONTRADO no relatório de ponto do Secullum.";
            suggestedAction = "Verificar se o colaborador bate ponto em outro equipamento ou se houve falha de exportação do ponto.";
        }

        // Regra 4: Divergência de Faltas (Ponto ou WFH tem faltas não descontadas no holerite)
        if (status === "ALIGNED" && hasHolerite && hasPoint) {
            const faltasNoPonto = pointFaltasCount > 0 ? pointFaltasCount : Math.round(pointFaltasHours / 7.33);
            if (faltasNoPonto >= 2 && holeriteAbsenceDays === 0 && holeriteAbsenceDeduction === 0) {
                status = "DEDUCTION_MISMATCH";
                riskLevel = "HIGH";
                diagnosticMessage = `Divergência de Faltas: Cartão ponto registra ${faltasNoPonto} falta(s), mas NENHUMA falta foi descontada no holerite.`;
                suggestedAction = "Enviar apontamentos de falta para recálculo do holerite com desconto.";
            } else if (Math.abs(faltasNoPonto - holeriteAbsenceDays) >= 2) {
                status = "DEDUCTION_MISMATCH";
                riskLevel = "MEDIUM";
                diagnosticMessage = `Divergência de Faltas: Ponto tem ${faltasNoPonto} dia(s) vs. Holerite com ${holeriteAbsenceDays} dia(s) descontado(s).`;
                suggestedAction = "Alinhar divergência de faltas com a contabilidade.";
            }
        }

        // Regra 5: Salário Base Divergente
        if (status === "ALIGNED" && hasHolerite && wfhBaseSalary > 0 && holeriteBase > 0) {
            if (Math.abs(wfhBaseSalary - holeriteBase) > 10.0) {
                status = "SALARY_MISMATCH";
                riskLevel = "LOW";
                diagnosticMessage = `Salário Base Divergente: WFH tem R$ ${wfhBaseSalary.toFixed(2)} vs. Holerite com R$ ${holeriteBase.toFixed(2)}.`;
                suggestedAction = "Verificar convenção coletiva ou dissídio retroativo no cadastro do posto.";
            }
        }

        const severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "OK" = 
            riskLevel === "CRITICAL" ? "CRITICAL" :
            riskLevel === "HIGH" ? "HIGH" :
            riskLevel === "MEDIUM" ? "MEDIUM" :
            riskLevel === "LOW" ? "LOW" : "OK";

        rows.push({
            id: emp.id,
            name: emp.name,
            employeeName: emp.name,
            cpf: emp.cpf || "",
            folha: point?.folha || holerite?.registrationCode || "",
            companyName: emp.company?.name || holerite?.companyName || "Sem Empresa",
            clientName: posto?.client?.name || "Interno / Rotativo",
            postoName: posto?.role?.name || emp.role?.name || "Cargo não informado",
            wfhSituation: situationName,
            wfhStatus: emp.status,
            wfhBaseSalary,
            wfhFaltasCount,
            hasPoint,
            pointWorkedHours,
            pointPunchesCount,
            pointFaltasCount,
            pointFaltasHours,
            pointExtrasHours,
            pointNoturnoHours,
            hasHolerite,
            holeriteBaseSalary: holeriteBase,
            holeriteTotalEarnings: holeriteEarnings,
            holeriteTotalDeductions: holeriteDeductions,
            holeriteNetSalary: holeriteNet,
            holeriteAbsenceDays,
            holeriteAbsenceDeduction,
            holeriteWorkedDays,
            status,
            riskLevel,
            severity,
            diagnosticMessage,
            discrepancies: [diagnosticMessage],
            suggestedAction,
            wfh: {
                situation: situationName,
                status: emp.status,
                companyName: emp.company?.name,
                clientName: posto?.client?.name || "Interno / Rotativo",
                jobTitle: posto?.role?.name || emp.role?.name || "Cargo não informado",
                baseSalary: wfhBaseSalary,
                isAbandonment,
                isDismissed: isDesligado,
                isMedicalLeave: isAfastado
            },
            point: hasPoint ? {
                workedHours: pointWorkedHours > 0 ? `${pointWorkedHours.toFixed(1)}h` : "0h",
                punchCount: pointPunchesCount,
                absenceDays: pointFaltasCount,
                absenceHours: pointFaltasHours > 0 ? `${pointFaltasHours.toFixed(1)}h` : undefined,
                extraHours: pointExtrasHours > 0 ? `${pointExtrasHours.toFixed(1)}h` : undefined
            } : undefined,
            holerite: hasHolerite ? {
                baseSalary: holeriteBase,
                totalEarnings: holeriteEarnings,
                totalDeductions: holeriteDeductions,
                netSalary: holeriteNet,
                workedDays: holeriteWorkedDays,
                absenceDeduction: holeriteAbsenceDeduction,
                pageNumber: holerite?.pageNumber,
                companyName: holerite?.companyName,
                role: holerite?.payrollType
            } : undefined
        });
    }

    // 4. Process Holerites that are NOT in WFH at all (pessoas na folha que nem existem no sistema!)
    for (const h of holeriteItems) {
        const cpfDigits = cleanCpfDigits(h.cpf);
        const normName = normalizeName(h.employeeName);
        const key = cpfDigits || normName;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);

        const point = (cpfDigits && pointByCpf.get(cpfDigits)) || pointByName.get(normName);

        const holeriteNet = h.netSalary || (h.totalEarnings ? h.totalEarnings - (h.totalDeductions || 0) : 0);
        const diagMsg = `🚨 Holerite gerado (R$ ${holeriteNet.toFixed(2)}), mas colaborador NÃO EXISTE no cadastro do WFH!`;

        rows.push({
            id: `holerite-only-${h.id}`,
            name: h.employeeName,
            employeeName: h.employeeName,
            cpf: h.cpf || "",
            folha: h.registrationCode || point?.folha || "",
            companyName: h.companyName || "Contabilidade",
            clientName: "NÃO CADASTRADO NO WFH",
            postoName: "Desconhecido",
            wfhSituation: "NÃO CONSTA NO SISTEMA",
            wfhStatus: "NÃO CADASTRADO",
            wfhBaseSalary: 0,
            wfhFaltasCount: 0,
            hasPoint: !!point,
            pointWorkedHours: point?.workedHours || 0,
            pointPunchesCount: point?.punchesCount || 0,
            pointFaltasCount: point?.faltasCount || 0,
            pointFaltasHours: point?.faltasHours || 0,
            pointExtrasHours: point?.extrasHours || 0,
            pointNoturnoHours: point?.noturnoHours || 0,
            hasHolerite: true,
            holeriteBaseSalary: h.baseSalary || 0,
            holeriteTotalEarnings: h.totalEarnings || 0,
            holeriteTotalDeductions: h.totalDeductions || 0,
            holeriteNetSalary: holeriteNet,
            holeriteAbsenceDays: h.absenceDays || 0,
            holeriteAbsenceDeduction: h.absenceDeduction || 0,
            holeriteWorkedDays: h.workedDays || 30,
            status: "CRITICAL_RISK",
            riskLevel: "CRITICAL",
            severity: "CRITICAL",
            diagnosticMessage: diagMsg,
            discrepancies: [diagMsg],
            suggestedAction: "Verificar se é admissão nova não lançada no WFH ou pagamento a terceiro indevido.",
            wfh: undefined,
            point: point ? {
                workedHours: point.workedHours > 0 ? `${point.workedHours.toFixed(1)}h` : "0h",
                punchCount: point.punchesCount,
                absenceDays: point.faltasCount,
                absenceHours: point.faltasHours > 0 ? `${point.faltasHours.toFixed(1)}h` : undefined,
                extraHours: point.extrasHours > 0 ? `${point.extrasHours.toFixed(1)}h` : undefined
            } : undefined,
            holerite: {
                baseSalary: h.baseSalary || 0,
                totalEarnings: h.totalEarnings || 0,
                totalDeductions: h.totalDeductions || 0,
                netSalary: holeriteNet,
                workedDays: h.workedDays || 30,
                absenceDeduction: h.absenceDeduction || 0,
                pageNumber: h.pageNumber,
                companyName: h.companyName,
                role: h.payrollType
            }
        });
    }

    // 5. Calculate summary metrics
    const criticalRiskCount = rows.filter(r => r.status === "CRITICAL_RISK").length;
    const deductionMismatchCount = rows.filter(r => r.status === "DEDUCTION_MISMATCH").length;
    const suspectedOverpayment = rows
        .filter(r => r.status === "CRITICAL_RISK")
        .reduce((acc, r) => acc + r.holeriteNetSalary, 0);

    const summary: PayrollAuditSummary = {
        totalEvaluated: rows.length,
        totalAudited: rows.length,
        criticalCount: criticalRiskCount,
        criticalRiskCount,
        missingHoleriteCount: rows.filter(r => r.status === "MISSING_HOLERITE").length,
        missingPointCount: rows.filter(r => r.status === "MISSING_POINT").length,
        deductionMismatchCount,
        mismatchCount: deductionMismatchCount,
        alignedCount: rows.filter(r => r.status === "ALIGNED").length,
        totalHoleriteNet: rows.reduce((acc, r) => acc + (r.hasHolerite ? r.holeriteNetSalary : 0), 0),
        totalSuspectedOverpayment: suspectedOverpayment,
        totalOverpaymentSuspected: suspectedOverpayment
    };

    // Sort: Critical first, then High, Medium, Low, Aligned
    const riskPriority = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4 };
    rows.sort((a, b) => {
        const pA = riskPriority[a.riskLevel];
        const pB = riskPriority[b.riskLevel];
        if (pA !== pB) return pA - pB;
        return a.employeeName.localeCompare(b.employeeName);
    });

    return { 
        success: true, 
        data: { rows, summary } 
    };
    } catch (error: any) {
        console.error("Erro no cruzamento de folha:", error);
        return {
            success: false,
            error: error.message || "Erro desconhecido ao executar auditoria de folha."
        };
    }
}
