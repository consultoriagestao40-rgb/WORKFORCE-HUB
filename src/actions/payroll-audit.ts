"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ExtractedHoleriteItem } from "@/lib/holerite-processor";
import { ParsedPointEmployee } from "@/lib/point-parser";
import { getPayrollPreview } from "@/actions/payroll";
import { getUniqueWeeksCount } from "@/lib/payroll";

export type AuditDiscrepancyType = 
    | "CRITICAL_RISK"       // Pago integralmente mas sem ponto / abandono / afastado
    | "MISSING_HOLERITE"    // Consta no Ponto / WFH mas não recebeu holerite
    | "MISSING_POINT"       // Tem holerite emitido mas não consta no Ponto
    | "DEDUCTION_MISMATCH"  // Faltas ou rubricas divergentes entre Ponto/WFH e Holerite
    | "SALARY_MISMATCH"     // Salário base divergente entre cadastro e holerite
    | "RUBRIC_MISMATCH"     // Divergência em rubricas da folha (insalubridade, VT, adicionais, etc.)
    | "ALIGNED";            // 100% Alinhado

export interface AuditRubricComparison {
    rubric: string;               // Rubrica / Conceito (Salário Base, Insalubridade, Adicionais / Liderança, Ajuda de Custo, Desconto VT 6%, Faltas / DSR, etc.)
    expectedWfh: number;          // Valor apurado no WFH
    expectedWfhDetail?: string;   // Detalhe WFH (ex: "Não Optante", "20% Sal. Mínimo", "2 faltas", etc.)
    actualHolerite: number;       // Valor no Holerite
    actualHoleriteDetail?: string;// Detalhe Holerite (ex: "Descontado R$ 126,00", "Não veio", etc.)
    diff: number;                 // Diferença (actualHolerite - expectedWfh)
    status: "OK" | "DIVERGENTE" | "INDEVIDO" | "FALTOU";
    instruction: string;          // Instrução de correção para a contabilidade
}

export interface PayrollAuditRow {
    id: string;
    name: string;
    employeeName: string;
    cpf: string;
    folha?: string;
    companyId?: string;
    companyName?: string;
    clientName?: string;
    postoName?: string;
    wfhSituation: string;
    wfhStatus: string;
    wfhBaseSalary: number;
    wfhFullSalary?: number;   // Salário base cheio do cadastro (sem proporcionalidade)
    wfhDaysWorked?: number;   // Dias trabalhados na competência (proporcional)
    wfhTotalDays?: number;    // Dias do mês
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
        companyId?: string;
        companyName?: string;
        clientName?: string;
        postoName?: string;
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
        absenceDays?: number;
        absenceDeduction?: number;
        pageNumber?: number;
        companyName?: string;
        role?: string;
        sourceName?: string;
        sourceCpf?: string;
        matchedBy?: "CPF" | "NOME_EXATO" | "MATRICULA" | "SIMILARIDADE";
        rubrics?: Array<{
            code?: string;
            description: string;
            reference?: string;
            earnings?: number;
            deductions?: number;
        }>;
    };

    // Auditoria Detalhada de Rubricas (WFH vs Holerite)
    rubricComparisons?: AuditRubricComparison[];
    divergentRubricsCount?: number;
    wfhNetSalary?: number;
    wfhGrossSalary?: number;
    wfhTotalDeductions?: number;
    netDifference?: number;

    // Decisão / Tratativa Manual
    decisionStatus?: AuditDecisionStatus;
    decisionNotes?: string;
    decisionUpdatedAt?: string;
    decisionUpdatedBy?: string;
}

export type AuditDecisionStatus = "PENDENTE" | "ACEITO" | "ENVIADO_CONTABILIDADE" | "RESOLVIDO";

export interface AuditDecisionItem {
    status: AuditDecisionStatus;
    notes?: string;
    updatedAt: string;
    updatedBy?: string;
}

export type AuditDecisionsMap = Record<string, AuditDecisionItem>;

export interface PayrollAuditSummary {
    totalEvaluated: number;
    totalAudited: number;
    criticalCount: number;
    criticalRiskCount: number;
    missingHoleriteCount: number;
    missingPointCount: number;
    deductionMismatchCount: number;
    rubricMismatchCount: number;
    mismatchCount: number;
    alignedCount: number;
    totalHoleriteNet: number;
    totalSuspectedOverpayment: number;
    totalOverpaymentSuspected: number;
    // Decisões
    pendingCount?: number;
    sentCount?: number;
    acceptedCount?: number;
    resolvedCount?: number;
}

export type AuditRow = PayrollAuditRow;

export interface PayrollAuditResult {
    rows: PayrollAuditRow[];
    summary: PayrollAuditSummary;
    detectedMonth?: number;
    detectedYear?: number;
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

function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[b.length];
}

/** Palavras equivalentes: iguais, uma contida na outra, ou diferença de grafia pequena (ex: FOGGIATO × FOGGIATTO) */
function wordsMatch(w1: string, w2: string): boolean {
    if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) return true;
    const minLen = Math.min(w1.length, w2.length);
    if (minLen < 4) return false;
    return levenshtein(w1, w2) <= (minLen >= 7 ? 2 : 1);
}

function nameSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0;
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.includes(shorter)) return shorter.length / longer.length;
    const w1 = s1.split(" ").filter(w => w.length > 2);
    const w2 = s2.split(" ").filter(w => w.length > 2);
    if (w1.length === 0 || w2.length === 0) return 0;
    const common = w1.filter(w => w2.some(other => wordsMatch(w, other)));
    return (common.length * 2) / (w1.length + w2.length);
}

function sumRubrics(
    rubrics: Array<{ code?: string; description: string; earnings?: number; deductions?: number }> | undefined,
    keywords: string[],
    type: "earnings" | "deductions" | "both" = "both",
    codes: string[] = []
): number {
    if (!rubrics || rubrics.length === 0) return 0;
    let sum = 0;
    for (const r of rubrics) {
        const descUpper = normalizeName(r.description).toUpperCase();
        const matchesDesc = keywords.some(k => descUpper.includes(normalizeName(k).toUpperCase()));
        const matchesCode = codes.length > 0 && !!r.code && codes.includes(r.code);
        if (matchesDesc || matchesCode) {
            if (type === "earnings" || type === "both") sum += (r.earnings || 0);
            if (type === "deductions" || type === "both") sum += (r.deductions || 0);
        }
    }
    return Math.round(sum * 100) / 100;
}

/**
 * Lista empresas para filtro de auditoria
 */
export async function getPayrollAuditCompanies(): Promise<{ id: string; name: string; cnpj: string | null }[]> {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");
        return await prisma.company.findMany({
            select: { id: true, name: true, cnpj: true },
            orderBy: { name: "asc" }
        });
    } catch (error) {
        console.error("Erro ao buscar empresas para auditoria:", error);
        return [];
    }
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

    let auditYear = year;
    let auditMonth = month;

    // Detecção e Alinhamento Automático de Competência via Holerites enviados
    if (holeriteItems && holeriteItems.length > 0) {
        const compCounts = new Map<string, number>();
        for (const h of holeriteItems) {
            if (h.competence) {
                const c = h.competence.trim();
                compCounts.set(c, (compCounts.get(c) || 0) + 1);
            }
        }
        let bestComp = "";
        let maxCount = 0;
        for (const [c, count] of compCounts.entries()) {
            if (count > maxCount) {
                maxCount = count;
                bestComp = c;
            }
        }
        if (bestComp) {
            const parts = bestComp.split(/[\/\-]/);
            if (parts.length === 2) {
                let m = parseInt(parts[0], 10);
                let y = parseInt(parts[1], 10);
                if (y < 100) y += 2000;
                if (m >= 1 && m <= 12 && y >= 2020 && y <= 2040) {
                    if (m !== auditMonth || y !== auditYear) {
                        console.log(`[runPayrollAudit] Auto-alinhando competência de ${auditMonth}/${auditYear} para ${m}/${y} com base nos holerites enviados.`);
                        auditMonth = m;
                        auditYear = y;
                    }
                }
            }
        }
    }

    let targetCompany: { id: string; name: string; cnpj: string | null } | null = null;
    const hasUploadedFiles = holeriteItems.length > 0 || pointItems.length > 0;
    const whereEmployee: any = {};
    if (companyId && companyId !== "all") {
        targetCompany = await prisma.company.findUnique({
            where: { id: companyId },
            select: { id: true, name: true, cnpj: true }
        });
        // IMPORTANTE: Só filtra o banco por empresa se NÃO houver arquivos de holerite ou ponto enviados.
        // Se arquivos foram enviados, o cruzamento no WFH DEVE ser global por CPF e Nome entre todas as empresas!
        if (!hasUploadedFiles) {
            whereEmployee.companyId = companyId;
        }
    }

    // Cutoff window for occurrences (Day 26 of month-1 to Day 25 of month)
    let startMonth = auditMonth - 1;
    let startYear = auditYear;
    if (startMonth <= 0) { startMonth += 12; startYear -= 1; }

    const windowStart = new Date(startYear, startMonth - 1, 26, 0, 0, 0, 0);
    const windowEnd = new Date(auditYear, auditMonth - 1, 25, 23, 59, 59, 999);

    const wfhEmployees = await prisma.employee.findMany({
        where: whereEmployee,
        include: {
            company: true,
            situation: true,
            role: true,
            vacations: true,
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
                where: { year: auditYear, month: auditMonth }
            }
        },
        orderBy: { name: "asc" }
    });

    // Obter os valores oficiais da folha fechada no WFH para o mês de competência (Planilha Contabilidade)
    const previewRes = await getPayrollPreview(auditYear, auditMonth).catch(err => {
        console.warn("[runPayrollAudit] Aviso ao obter payroll preview:", err);
        return { items: [] };
    });
    const previewItems = previewRes?.items || [];
    const previewById = new Map<string, any>();
    const previewByCpf = new Map<string, any>();
    const previewByName = new Map<string, any>();
    for (const pi of previewItems) {
        if (pi.employeeId) previewById.set(pi.employeeId, pi);
        const cpfDigits = cleanCpfDigits(pi.employeeCpf);
        if (cpfDigits) previewByCpf.set(cpfDigits, pi);
        const norm = normalizeName(pi.employeeName);
        if (norm) previewByName.set(norm, pi);
    }

    // 0. Deduplica vias: se vierem 2 vias por colaborador no PDF, mantém estritamente 1 via
    const dedupedHolerites: ExtractedHoleriteItem[] = [];
    const seenHBackCpfs = new Set<string>();
    const seenHBackNames = new Set<string>();
    for (const h of holeriteItems) {
        const cpf = cleanCpfDigits(h.cpf);
        const norm = normalizeName(h.employeeName);
        if (cpf && cpf.length === 11) {
            if (seenHBackCpfs.has(cpf)) continue;
            seenHBackCpfs.add(cpf);
            if (norm) seenHBackNames.add(norm);
        } else if (norm && norm.length >= 4 && !norm.startsWith("colaborador_pagina")) {
            if (seenHBackNames.has(norm)) continue;
            seenHBackNames.add(norm);
        }
        dedupedHolerites.push(h);
    }

    // 2. Build index maps
    // Holerite map by clean CPF, normalized Name, and registration code
    const holeriteByCpf = new Map<string, ExtractedHoleriteItem>();
    const holeriteByName = new Map<string, ExtractedHoleriteItem>();
    const holeriteByCode = new Map<string, ExtractedHoleriteItem>();
    for (const h of dedupedHolerites) {
        const cpf = cleanCpfDigits(h.cpf);
        if (cpf && cpf.length >= 11) holeriteByCpf.set(cpf, h);
        const norm = normalizeName(h.employeeName);
        if (norm && norm.length >= 3 && !norm.startsWith("colaborador_pagina")) holeriteByName.set(norm, h);
        if (h.registrationCode && h.registrationCode.trim().length > 0) holeriteByCode.set(h.registrationCode.trim(), h);
    }

    // Point map by clean CPF, normalized Name, and folha code
    const pointByCpf = new Map<string, ParsedPointEmployee>();
    const pointByName = new Map<string, ParsedPointEmployee>();
    const pointByCode = new Map<string, ParsedPointEmployee>();
    for (const p of pointItems) {
        const cpf = cleanCpfDigits(p.cpf);
        if (cpf && cpf.length >= 11) pointByCpf.set(cpf, p);
        const norm = normalizeName(p.name);
        if (norm && norm.length >= 3) pointByName.set(norm, p);
        if (p.folha && p.folha.trim().length > 0) pointByCode.set(p.folha.trim(), p);
    }

    // Tracking sets to ensure zero cross-over duplicates
    const matchedHoleriteIds = new Set<string>();
    const matchedPointKeys = new Set<string>();
    const processedEmpKeys = new Set<string>();
    const rows: PayrollAuditRow[] = [];

    // Nomes que batem EXATAMENTE com algum colaborador do WFH ficam reservados para ele (não entram no fallback por similaridade)
    const wfhExactNames = new Set(wfhEmployees.map(e => normalizeName(e.name)).filter(Boolean));

    // CPFs que aparecem em MAIS DE UM cadastro do WFH (erro de cadastro): não são chave confiável de cruzamento
    const cpfCountWfh = new Map<string, number>();
    for (const e of wfhEmployees) {
        const c = cleanCpfDigits(e.cpf);
        if (c && c.length >= 11) cpfCountWfh.set(c, (cpfCountWfh.get(c) || 0) + 1);
    }

    // 3. Process each WFH Employee
    for (const emp of wfhEmployees) {
        const cpfDigits = cleanCpfDigits(emp.cpf);
        const isDupCpf = !!(cpfDigits && (cpfCountWfh.get(cpfDigits) || 0) > 1);
        if (isDupCpf) console.warn(`[runPayrollAudit] CPF duplicado no cadastro WFH (${emp.cpf}) - ${emp.name}. Cruzamento por nome/ID.`);
        const normName = normalizeName(emp.name);
        const empExtra = emp.extraFields as Record<string, any> | null;
        const empCode = empExtra?.matricula?.toString().trim() || empExtra?.codigo?.toString().trim() || "";

        if (cpfDigits && !isDupCpf && processedEmpKeys.has(cpfDigits)) continue;
        if (normName && processedEmpKeys.has(normName)) continue;

        if (cpfDigits && !isDupCpf) processedEmpKeys.add(cpfDigits);
        if (normName) processedEmpKeys.add(normName);
        if (empCode) processedEmpKeys.add(`code:${empCode}`);

        const situationName = emp.situation?.name || "Ativo";
        const isAbandonment = situationName.toLowerCase().includes("abandono");
        const isAfastado = situationName.toLowerCase().includes("inss") || situationName.toLowerCase().includes("afastad");
        const isDesligado = situationName.toLowerCase().includes("desligad") || situationName.toLowerCase().includes("demiti") || emp.status === "Desligado";

        let matchedBy: "CPF" | "NOME_EXATO" | "MATRICULA" | "SIMILARIDADE" | undefined = undefined;
        let holerite: ExtractedHoleriteItem | undefined = undefined;

        if (!isDupCpf && cpfDigits && cpfDigits.length >= 11 && holeriteByCpf.has(cpfDigits)) {
            holerite = holeriteByCpf.get(cpfDigits);
            matchedBy = "CPF";
        } else if (normName && normName.length >= 3 && holeriteByName.has(normName)) {
            holerite = holeriteByName.get(normName);
            matchedBy = "NOME_EXATO";
        } else if (empCode && empCode.length >= 1 && holeriteByCode.has(empCode)) {
            holerite = holeriteByCode.get(empCode);
            matchedBy = "MATRICULA";
        }

        // Fallback por similaridade de nome para holerite (ex: pequenas variações na grafia do sobrenome):
        // REGRA CRÍTICA: Colaboradores DESLIGADOS / DEMITIDOS NUNCA participam de busca por similaridade!
        // Devem ter CPF idêntico ou Nome idêntico. Jamais semelhança aproximada de nome de outro funcionário.
        if (!holerite && !isDesligado && normName && normName.length >= 5) {
            let best = 0;
            const w1 = normName.split(" ").filter(w => w.length > 2);
            for (const [hName, hItem] of holeriteByName.entries()) {
                if (matchedHoleriteIds.has(hItem.id)) continue;
                if (hName !== normName && wfhExactNames.has(hName)) continue;
                const w2 = hName.split(" ").filter(w => w.length > 2);
                if (w1.length === 0 || w2.length === 0) continue;
                // Exige que o primeiro nome seja compatível (evita casar Adriane com Luciana)
                if (!wordsMatch(w1[0], w2[0])) continue;

                const sim = nameSimilarity(normName, hName);
                if (sim >= 0.85 && sim > best) {
                    best = sim;
                    holerite = hItem;
                    matchedBy = "SIMILARIDADE";
                }
            }
        }

        // Se este holerite já foi vinculado a outro colaborador, não duplica
        if (holerite && matchedHoleriteIds.has(holerite.id)) {
            holerite = undefined;
            matchedBy = undefined;
        }

        if (holerite) {
            matchedHoleriteIds.add(holerite.id);
            if (holerite.cpf) processedEmpKeys.add(cleanCpfDigits(holerite.cpf));
            if (holerite.employeeName) processedEmpKeys.add(normalizeName(holerite.employeeName));
        }

        let point: ParsedPointEmployee | undefined = undefined;
        if (!isDupCpf && cpfDigits && cpfDigits.length >= 11 && pointByCpf.has(cpfDigits)) {
            point = pointByCpf.get(cpfDigits);
        } else if (normName && normName.length >= 3 && pointByName.has(normName)) {
            point = pointByName.get(normName);
        } else if (empCode && empCode.length >= 1 && pointByCode.has(empCode)) {
            point = pointByCode.get(empCode);
        }

        // Fallback por similaridade de nome para ponto: colaboradores desligados não entram por similaridade
        if (!point && !isDesligado && normName && normName.length >= 5) {
            let best = 0;
            const w1 = normName.split(" ").filter(w => w.length > 2);
            for (const [pName, pItem] of pointByName.entries()) {
                const pk = cleanCpfDigits(pItem.cpf) || normalizeName(pItem.name) || pItem.folha || "";
                if (matchedPointKeys.has(pk)) continue;
                if (pName !== normName && wfhExactNames.has(pName)) continue;
                const w2 = pName.split(" ").filter(w => w.length > 2);
                if (w1.length === 0 || w2.length === 0) continue;
                if (!wordsMatch(w1[0], w2[0])) continue;

                const sim = nameSimilarity(normName, pName);
                if (sim >= 0.85 && sim > best) {
                    best = sim;
                    point = pItem;
                }
            }
        }

        const pKey = point ? (cleanCpfDigits(point.cpf) || normalizeName(point.name) || point.folha || "") : "";
        if (point && pKey && matchedPointKeys.has(pKey)) {
            point = undefined;
        }

        if (point) {
            if (pKey) matchedPointKeys.add(pKey);
            if (point.cpf) processedEmpKeys.add(cleanCpfDigits(point.cpf));
            if (point.name) processedEmpKeys.add(normalizeName(point.name));
        }

        const wfhPreview = previewById.get(emp.id)
            || (!isDupCpf && cpfDigits ? previewByCpf.get(cpfDigits) : null)
            || (normName ? previewByName.get(normName) : null);

        const activeAssignment = emp.assignments && emp.assignments.length > 0 ? emp.assignments[0] : null;
        const posto = activeAssignment?.posto;

        const wfhBaseSalary = wfhPreview?.baseSalary || ((posto?.baseSalary && posto.baseSalary > 0)
            ? (isDesligado ? 0 : posto.baseSalary)
            : (isDesligado ? 0 : (emp.salary || 0)));

        const wfhFaltasCount = wfhPreview?.faltasCount !== undefined 
            ? wfhPreview.faltasCount 
            : (emp.occurrences ? emp.occurrences.filter(o => o.type !== "ATESTADO").length : 0);

        const hasHolerite = !!holerite;
        const hasPoint = !!point;

        // Se o colaborador não tem ponto e não tem holerite no lote enviado:
        // 1. Desligados/Inativos que não têm ponto nem holerite: JAMAIS devem poluir a auditoria
        if (isDesligado && !hasHolerite && !hasPoint) {
            continue;
        }

        // 2. Colaboradores que não constam nos arquivos enviados (ponto e holerite):
        // Se arquivos foram enviados, a auditoria deve focar exclusivamente nos colaboradores
        // presentes nos arquivos enviados (ou que tenham holerite/ponto a auditar).
        if (!hasPoint && !hasHolerite) {
            continue;
        }

        const holeriteBase = holerite?.baseSalary || 0;
        const holeriteEarnings = holerite?.totalEarnings || 0;
        const holeriteDeductions = holerite?.totalDeductions || 0;
        const holeriteNet = holerite?.netSalary || (holeriteEarnings > 0 ? holeriteEarnings - holeriteDeductions : 0);
        const holeriteAbsenceDeduction = holerite?.absenceDeduction || 0;
        let holeriteAbsenceDays = holerite?.absenceDays || 0;
        if (holeriteAbsenceDays === 0 && holeriteAbsenceDeduction > 0 && holeriteBase > 0) {
            holeriteAbsenceDays = Math.round(holeriteAbsenceDeduction / (holeriteBase / 30));
        }
        const holeriteWorkedDays = holerite?.workedDays || 30;

        const pointWorkedHours = point?.workedHours || 0;
        const pointPunchesCount = point?.punchesCount || 0;
        const pointFaltasCount = point?.faltasCount || 0;
        const pointFaltasHours = point?.faltasHours || 0;
        const pointExtrasHours = point?.extrasHours || 0;
        const pointNoturnoHours = point?.noturnoHours || 0;

        // --- AUDITORIA DETALHADA DE RUBRICAS (WFH FECHADO × HOLERITE CONTABILIDADE) ---
        const rubricComparisons: AuditRubricComparison[] = [];
        let divergentRubricsCount = 0;

        if (hasHolerite) {
            const hRubrics = holerite?.rubrics || [];

            // 1. Salário Base
            const expBase = wfhBaseSalary;
            const baseRubric = hRubrics.find(r => {
                const d = normalizeName(r.description).toUpperCase();
                return (r.earnings || 0) > 0 && (d.includes("HORAS NORMAIS") || d.includes("SALARIO"));
            });
            const baseRef = baseRubric?.reference ? `${baseRubric.reference}h` : "";
            const actBase = holeriteBase || sumRubrics(hRubrics, ["SALARIO", "HORAS NORMAIS"], "earnings");
            const diffBase = Math.round((actBase - expBase) * 100) / 100;
            const isBaseOk = Math.abs(diffBase) <= 5;
            const fullSalaryWfh = wfhPreview?.originalSalary || expBase;
            const prDays = wfhPreview?.daysWorked;
            const prTotal = wfhPreview?.totalDaysInMonth;
            const isProrata = !!(prDays !== undefined && prTotal && prDays < prTotal && fullSalaryWfh > expBase);
            if (isDesligado && expBase === 0 && actBase > 0) {
                rubricComparisons.push({
                    rubric: "001 - Salário Base",
                    expectedWfh: 0,
                    expectedWfhDetail: "Desligado(a) no WFH",
                    actualHolerite: actBase,
                    actualHoleriteDetail: actBase > 0 
                        ? `R$ ${actBase.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${baseRef ? ` (${baseRef})` : ""}` 
                        : "Não informado",
                    diff: actBase,
                    status: "DIVERGENTE",
                    instruction: `CONFERIR RESCISÃO / SALDO: Colaborador(a) consta como DESLIGADO(A) no WFH. Verificar se o recibo da Pág. ${holerite?.pageNumber ?? "---"} do PDF refere-se a saldo residual da rescisão ou emissão indevida.`
                });
            } else {
                rubricComparisons.push({
                    rubric: "001 - Salário Base",
                    expectedWfh: expBase,
                    expectedWfhDetail: isProrata
                        ? `R$ ${expBase.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (proporcional: ${prDays}/${prTotal} dias de R$ ${fullSalaryWfh.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                        : `R$ ${expBase.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    actualHolerite: actBase,
                    actualHoleriteDetail: actBase > 0 
                        ? `R$ ${actBase.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${baseRef ? ` (${baseRef})` : ""}` 
                        : "Não informado",
                    diff: diffBase,
                    status: isBaseOk ? "OK" : "DIVERGENTE",
                    instruction: isBaseOk ? "" : `AJUSTAR SALÁRIO BASE: Fechamento WFH R$ ${expBase.toFixed(2)} vs. R$ ${actBase.toFixed(2)} processado no holerite.`
                });
            }

            // 2. Insalubridade
            const expInsalubridade = wfhPreview?.insalubridade !== undefined ? wfhPreview.insalubridade : (emp.insalubridade || 0);
            const actInsalubridade = sumRubrics(hRubrics, ["INSALUB", "INSALUBR", "INSALUBRIDADE"], "earnings", ["232", "045", "45"]);
            const insalubRubric = hRubrics.find(r => {
                const d = normalizeName(r.description).toUpperCase();
                return d.includes("INSALUB") || r.code === "232" || r.code === "045" || r.code === "45";
            });
            if (expInsalubridade > 0 || actInsalubridade > 0) {
                const diff = Math.round((actInsalubridade - expInsalubridade) * 100) / 100;
                const isFaltou = expInsalubridade > 0 && actInsalubridade === 0;
                const isIndevido = expInsalubridade === 0 && actInsalubridade > 0;
                const isOk = Math.abs(diff) <= 5;
                rubricComparisons.push({
                    rubric: "045 - Adic. Insalubridade",
                    expectedWfh: expInsalubridade,
                    expectedWfhDetail: expInsalubridade > 0 ? `R$ ${expInsalubridade.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Não prevista",
                    actualHolerite: actInsalubridade,
                    actualHoleriteDetail: actInsalubridade > 0 
                        ? `R$ ${actInsalubridade.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${insalubRubric?.reference ? ` (${insalubRubric.reference})` : ""}` 
                        : "Não lançado",
                    diff,
                    status: isOk ? "OK" : isFaltou ? "FALTOU" : isIndevido ? "INDEVIDO" : "DIVERGENTE",
                    instruction: isOk ? "" : isFaltou 
                        ? `LANÇAR PROVENTO: Colaborador possui Insalubridade de R$ ${expInsalubridade.toFixed(2)} que faltou no holerite.`
                        : isIndevido
                        ? `EXCLUIR PROVENTO: Insalubridade de R$ ${actInsalubridade.toFixed(2)} lançada indevidamente (não prevista no sistema).`
                        : `CORRIGIR VALOR: Insalubridade prevista R$ ${expInsalubridade.toFixed(2)} vs. R$ ${actInsalubridade.toFixed(2)} processada.`
                });
            }

            // 3. Periculosidade
            const expPericulosidade = wfhPreview?.periculosidade !== undefined ? wfhPreview.periculosidade : (emp.periculosidade || 0);
            const actPericulosidade = sumRubrics(hRubrics, ["PERICULOS", "PERICULOSIDADE"], "earnings", ["046", "46", "233"]);
            if (expPericulosidade > 0 || actPericulosidade > 0) {
                const diff = Math.round((actPericulosidade - expPericulosidade) * 100) / 100;
                const isFaltou = expPericulosidade > 0 && actPericulosidade === 0;
                const isIndevido = expPericulosidade === 0 && actPericulosidade > 0;
                const isOk = Math.abs(diff) <= 5;
                rubricComparisons.push({
                    rubric: "050 - Adic. Periculosidade (30%)",
                    expectedWfh: expPericulosidade,
                    expectedWfhDetail: expPericulosidade > 0 ? `R$ ${expPericulosidade.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Não prevista",
                    actualHolerite: actPericulosidade,
                    actualHoleriteDetail: actPericulosidade > 0 ? `R$ ${actPericulosidade.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Não lançado",
                    diff,
                    status: isOk ? "OK" : isFaltou ? "FALTOU" : isIndevido ? "INDEVIDO" : "DIVERGENTE",
                    instruction: isOk ? "" : isFaltou
                        ? `LANÇAR PROVENTO: Colaborador possui Periculosidade de R$ ${expPericulosidade.toFixed(2)} que faltou no holerite.`
                        : `CORRIGIR VALOR: Periculosidade prevista R$ ${expPericulosidade.toFixed(2)} vs. R$ ${actPericulosidade.toFixed(2)} processada.`
                });
            }

            // 4. Adicionais / Liderança / Gratificação CCT / Função Gratificada Copa
            const expAdicionais = Math.round((wfhPreview?.gratificacao || emp.gratificacao || 0) * 100) / 100;
            const matchingAdicionais = hRubrics.filter(r => {
                const d = normalizeName(r.description).toUpperCase();
                if ((r.earnings || 0) <= 0) return false;
                // NUNCA confundir Adicional Noturno, Insalubridade, Periculosidade, Horas Extras, Salário Família, Troco ou Ajuda de Custo com Adicional de Função/Liderança!
                if (
                    d.includes("NOTURNO") || 
                    d.includes("PERICULOS") || 
                    d.includes("INSALUBR") || 
                    d.includes("EXTRA") || 
                    d.includes("DSR") || 
                    d.includes("FAMILIA") || 
                    d.includes("TROCO") || 
                    d.includes("AJUDA")
                ) {
                    return false;
                }
                return ["GRATIF", "LIDERAN", "FUNCAO", "CARGO", "COPA", "PREMIO", "ASSIDUIDADE", "RISCO", "ADICIONAL"].some(k => d.includes(k));
            });
            const actAdicionais = Math.round(matchingAdicionais.reduce((acc, r) => acc + (r.earnings || 0), 0) * 100) / 100;
            if (expAdicionais > 0 || actAdicionais > 0) {
                const diff = Math.round((actAdicionais - expAdicionais) * 100) / 100;
                const isFaltou = expAdicionais > 0 && actAdicionais === 0;
                const isIndevido = expAdicionais === 0 && actAdicionais > 0;
                const isOk = Math.abs(diff) <= 5;
                rubricComparisons.push({
                    rubric: "080 - Adic. Função / Liderança",
                    expectedWfh: expAdicionais,
                    expectedWfhDetail: expAdicionais > 0 ? `R$ ${expAdicionais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Sem adicional",
                    actualHolerite: actAdicionais,
                    actualHoleriteDetail: actAdicionais > 0 ? `R$ ${actAdicionais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Não lançado",
                    diff,
                    status: isOk ? "OK" : isFaltou ? "FALTOU" : isIndevido ? "INDEVIDO" : "DIVERGENTE",
                    instruction: isOk ? "" : isFaltou
                        ? `LANÇAR PROVENTO: Consta Adicional/Liderança de R$ ${expAdicionais.toFixed(2)} no WFH não lançado no holerite.`
                        : `CORRIGIR VALOR: Adicional previsto R$ ${expAdicionais.toFixed(2)} vs. R$ ${actAdicionais.toFixed(2)} processado.`
                });
            }

            // 5. Salário Família (exibe claramente para diferenciar de Adicionais)
            const sfRubrics = hRubrics.filter(r => {
                const d = normalizeName(r.description).toUpperCase();
                return (r.earnings || 0) > 0 && (d.includes("SALARIO FAMILIA") || d.includes("SAL. FAMILIA") || d === "SAL FAM");
            });
            const actSalarioFamilia = Math.round(sfRubrics.reduce((acc, r) => acc + (r.earnings || 0), 0) * 100) / 100;
            const expSalarioFamilia = Math.round((wfhPreview?.salarioFamilia || 0) * 100) / 100;
            if (actSalarioFamilia > 0 || expSalarioFamilia > 0) {
                const sfRef = sfRubrics[0]?.reference ? `${sfRubrics[0].reference} cota(s)` : `${emp.dependentsCount || 0} dep.`;
                rubricComparisons.push({
                    rubric: "095 - Salário Família",
                    expectedWfh: expSalarioFamilia,
                    expectedWfhDetail: expSalarioFamilia > 0 
                        ? `R$ ${expSalarioFamilia.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                        : `R$ 0,00 (${emp.dependentsCount || 0} dep.)`,
                    actualHolerite: actSalarioFamilia,
                    actualHoleriteDetail: actSalarioFamilia > 0 ? `R$ ${actSalarioFamilia.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${sfRef})` : "Não lançado",
                    diff: Math.round((actSalarioFamilia - expSalarioFamilia) * 100) / 100,
                    status: "OK",
                    instruction: ""
                });
            }

            // 6. Desconto Vale Transporte (6%) — REGRA DE OURO DO NÃO-OPTANTE
            const isVtOptante = wfhPreview 
                ? (wfhPreview.vtOptIn === true && !(wfhPreview.ajudaCusto > 0)) 
                : (emp.vtOptIn === true && !(emp.ajudaCusto && emp.ajudaCusto > 0));
            // A base de cálculo do VT para desconto (6%) é o salário base efetivo menos faltas e DSR (regra padrão DP/contabilidade)
            let precalcFaltas = (wfhPreview?.faltaDeduction || 0) + (wfhPreview?.dsrDeduction || 0);
            if (precalcFaltas === 0 && emp.occurrences && emp.occurrences.length > 0) {
                const fEmp = emp.occurrences.filter(o => o.type === "FALTA" || o.type === "FALTA_INJUSTIFICADA");
                if (fEmp.length > 0) {
                    const fullFixed = wfhBaseSalary + (emp.insalubridade || 0) + (emp.periculosidade || 0) + (emp.gratificacao || 0);
                    const dRate = fullFixed / 30;
                    const dsr = getUniqueWeeksCount(fEmp.map(o => new Date(o.date)));
                    precalcFaltas = (dRate * fEmp.length) + (dRate * dsr);
                }
            }
            const effectiveSalaryVt = Math.max(0, expBase - precalcFaltas);
            const expVt = isVtOptante ? (wfhPreview?.vtPayrollDiscount || Math.round((effectiveSalaryVt * 0.06) * 100) / 100) : 0;
            const vtRubric = hRubrics.find(r => {
                const d = normalizeName(r.description).toUpperCase();
                return (r.deductions || 0) > 0 && (d.includes("VALE TRANS") || d.includes("DESC. VT") || d.includes("DESCONTO VT") || d === "VT" || d.includes(" TRANSPORTE"));
            });
            let actVt = vtRubric?.deductions || sumRubrics(hRubrics, ["VALE TRANS", "VALE-TRANS", "DESC. VT", "DESC VT", "DESCONTO VT", "VALE TRANSPORTE"], "deductions");
            if (actVt === 0) {
                for (const r of hRubrics) {
                    if (r.deductions && r.deductions > 0 && /\bVT\b/i.test(r.description)) {
                        actVt += r.deductions;
                    }
                }
            }
            const vtRef = vtRubric?.reference ? (vtRubric.reference.includes("%") ? vtRubric.reference : `${vtRubric.reference}%`) : "";
            const diffVt = Math.round((actVt - expVt) * 100) / 100;
            const isVtIndevido = !isVtOptante && actVt > 0;
            const isVtFaltou = isVtOptante && expVt > 0 && actVt === 0;
            const isVtOk = !isVtIndevido && !isVtFaltou && Math.abs(diffVt) <= 5;
            rubricComparisons.push({
                rubric: "405 - Desconto VT (6%)",
                expectedWfh: expVt,
                expectedWfhDetail: isVtOptante 
                    ? `R$ ${expVt.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                    : "R$ 0,00 (Não Optante)",
                actualHolerite: actVt,
                actualHoleriteDetail: actVt > 0 
                    ? `R$ ${actVt.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${vtRef ? ` (${vtRef})` : " (Descontado)"}` 
                    : "R$ 0,00 (Sem desconto)",
                diff: diffVt,
                status: isVtOk ? "OK" : isVtIndevido ? "INDEVIDO" : isVtFaltou ? "FALTOU" : "DIVERGENTE",
                instruction: isVtOk ? "" : isVtIndevido
                    ? `EXCLUIR DESCONTO VT: Colaborador ${emp.name} possui Ajuda de Custo / é NÃO-OPTANTE de VT e NÃO deve ser descontado 6%. Veio com desconto de R$ ${actVt.toFixed(2)}. Corrigir este item.`
                    : isVtFaltou
                    ? `APLICAR DESCONTO: Colaborador é optante de VT com desconto previsto de R$ ${expVt.toFixed(2)} não efetuado.`
                    : `AJUSTAR DESCONTO VT: Previsto R$ ${expVt.toFixed(2)} vs. R$ ${actVt.toFixed(2)} descontado.`
            });

            // 7. Faltas e DSR (Somatório exato de Faltas + DSR e Detalhamento da Quantidade de Horas)
            let expFaltas = Math.round(((wfhPreview?.faltaDeduction || 0) + (wfhPreview?.dsrDeduction || 0)) * 100) / 100;
            let expFaltasCount = wfhPreview?.faltasCount;

            // Fallback robusto 1: se wfhPreview não trouxe o valor de faltaDeduction, calcula diretamente
            // das occurrences do colaborador dentro da janela oficial de corte (26 do mês anterior a 25 do mês)
            if (expFaltas === 0 && emp.occurrences && emp.occurrences.length > 0) {
                const faltasEmp = emp.occurrences.filter(o => o.type === "FALTA" || o.type === "FALTA_INJUSTIFICADA");
                if (faltasEmp.length > 0) {
                    const fCount = faltasEmp.length;
                    expFaltasCount = fCount;
                    const dsrCount = getUniqueWeeksCount(faltasEmp.map(o => new Date(o.date)));
                    const fullFixed = wfhBaseSalary + (emp.insalubridade || 0) + (emp.periculosidade || 0) + (emp.gratificacao || 0);
                    const dRate = fullFixed / 30;
                    expFaltas = Math.round(((dRate * fCount) + (dRate * dsrCount)) * 100) / 100;
                }
            }

            // Fallback robusto 2: se ainda for 0, mas o Cartão de Ponto (Secullum) apurou faltas
            if (expFaltas === 0 && point && (point.faltasCount > 0 || point.faltasHours > 0)) {
                const fCount = point.faltasCount > 0 ? point.faltasCount : Math.ceil(point.faltasHours / 7.333);
                expFaltasCount = fCount;
                const fullFixed = wfhBaseSalary + (emp.insalubridade || 0) + (emp.periculosidade || 0) + (emp.gratificacao || 0);
                const dRate = fullFixed / 30;
                const dsrCount = fCount;
                expFaltas = Math.round(((dRate * fCount) + (dRate * dsrCount)) * 100) / 100;
            }

            const matchingFaltaRubrics = hRubrics.filter(r => {
                const d = normalizeName(r.description).toUpperCase();
                return (r.deductions || 0) > 0 && (d.includes("FALTA") || d.includes("DSR"));
            });

            // Ordena para que Faltas venha antes de DSR
            matchingFaltaRubrics.sort((a, b) => {
                const isDsrA = normalizeName(a.description).toUpperCase().includes("DSR") ? 1 : 0;
                const isDsrB = normalizeName(b.description).toUpperCase().includes("DSR") ? 1 : 0;
                return isDsrA - isDsrB;
            });

            let actFaltas = matchingFaltaRubrics.reduce((acc, r) => acc + (r.deductions || 0), 0);
            if (actFaltas === 0) {
                actFaltas = sumRubrics(hRubrics, ["FALTA", "DSR"], "deductions") || holeriteAbsenceDeduction || 0;
            }
            actFaltas = Math.round(actFaltas * 100) / 100;

            // Extrai a quantidade exata de horas das referências (ex: 18:00h Faltas + 12:00h DSR)
            const hoursSummaryParts = matchingFaltaRubrics.map(r => {
                const isDsr = normalizeName(r.description).toUpperCase().includes("DSR");
                const label = isDsr ? "DSR" : "Faltas";
                const ref = r.reference ? `${r.reference}h` : "";
                return ref ? `${ref} ${label}` : label;
            });
            const hoursSummary = hoursSummaryParts.join(" + ");

            if (expFaltas > 0 || actFaltas > 0) {
                const diffFaltas = Math.round((actFaltas - expFaltas) * 100) / 100;
                const isFaltou = expFaltas > 10 && actFaltas === 0;
                const isIndevido = expFaltas === 0 && actFaltas > 10;
                const isOk = Math.abs(diffFaltas) <= 10;

                const expHoursStr = wfhPreview?.faltasHours ? `${wfhPreview.faltasHours}h` : "";
                const countDisplay = expFaltasCount !== undefined ? expFaltasCount : wfhPreview?.faltasCount;
                const expFaltasDetail = expFaltas > 0 
                    ? `R$ ${expFaltas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${expHoursStr ? ` (${expHoursStr} faltas)` : countDisplay ? ` (${countDisplay} falta(s))` : ""}`
                    : "R$ 0,00 (Sem faltas)";

                const actFaltasDetail = actFaltas > 0 
                    ? `R$ ${actFaltas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${hoursSummary ? ` (${hoursSummary})` : " (Descontado)"}`
                    : "R$ 0,00 (Sem desconto)";

                rubricComparisons.push({
                    rubric: "200 - Faltas / DSR",
                    expectedWfh: expFaltas,
                    expectedWfhDetail: expFaltasDetail,
                    actualHolerite: actFaltas,
                    actualHoleriteDetail: actFaltasDetail,
                    diff: diffFaltas,
                    status: isOk ? "OK" : isFaltou ? "FALTOU" : isIndevido ? "INDEVIDO" : "DIVERGENTE",
                    instruction: isOk ? "" : isFaltou
                        ? `APLICAR DESCONTO: Ponto/WFH apurou faltas/DSR no valor de R$ ${expFaltas.toFixed(2)} não descontadas.`
                        : isIndevido
                        ? `CONFERIR DESCONTO: Holerite descontou R$ ${actFaltas.toFixed(2)}${hoursSummary ? ` (${hoursSummary})` : ""} de faltas, mas no fechamento WFH constam 0 faltas.`
                        : `AJUSTAR FALTAS: Fechamento WFH R$ ${expFaltas.toFixed(2)} vs. R$ ${actFaltas.toFixed(2)}${hoursSummary ? ` (${hoursSummary})` : ""} descontado no holerite.`
                });
            }

            // 8. Horas Extras e Adicional Noturno
            const expExtras = Math.round(((wfhPreview?.horasExtras50Value || 0) + (wfhPreview?.horasExtras100Value || 0) + (wfhPreview?.adicionalNoturnoValue || 0)) * 100) / 100;
            const actExtras = sumRubrics(hRubrics, ["EXTRA", "NOTURNO"], "earnings");
            if (expExtras > 0 || actExtras > 0) {
                const diff = Math.round((actExtras - expExtras) * 100) / 100;
                const isOk = Math.abs(diff) <= 10;
                rubricComparisons.push({
                    rubric: "101 - Horas Extras / Adic. Noturno",
                    expectedWfh: expExtras,
                    expectedWfhDetail: expExtras > 0 ? `R$ ${expExtras.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "R$ 0,00",
                    actualHolerite: actExtras,
                    actualHoleriteDetail: actExtras > 0 ? `R$ ${actExtras.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "R$ 0,00 (Não lançado)",
                    diff,
                    status: isOk ? "OK" : expExtras > 0 && actExtras === 0 ? "FALTOU" : "DIVERGENTE",
                    instruction: isOk ? "" : `CONFERIR EXTRAS/NOTURNO: Previsto R$ ${expExtras.toFixed(2)} vs. R$ ${actExtras.toFixed(2)} lançado.`
                });
            }

            // 9. Desconto Vale Alimentação / Refeição (VA/VR)
            let expVa = wfhPreview?.vaPayrollDiscount || 0;
            const rawBaseVa = (posto?.valeAlimentacao && posto.valeAlimentacao > 0)
                ? posto.valeAlimentacao
                : (emp.valeAlimentacao && emp.valeAlimentacao > 0 ? emp.valeAlimentacao : 0);
            if (expVa === 0) {
                if (rawBaseVa > 0) {
                    const fCount = expFaltasCount !== undefined ? expFaltasCount : (emp.occurrences ? emp.occurrences.filter(o => o.type === "FALTA" || o.type === "FALTA_INJUSTIFICADA").length : 0);
                    const dRate = rawBaseVa > 50 ? (rawBaseVa / 30) : rawBaseVa;
                    const netVa = Math.max(0, rawBaseVa - (fCount * dRate));
                    const pctVa = emp.vaDiscountPercentage ?? posto?.vaDiscountPercentage ?? 20.0;
                    expVa = Math.round((netVa * (pctVa / 100)) * 100) / 100;
                }
            }
            const matchingVaRubrics = hRubrics.filter(r => {
                const d = normalizeName(r.description).toUpperCase();
                if ((r.deductions || 0) <= 0) return false;
                // JAMAIS considerar Vale Transporte como Alimentação!
                if (d.includes("TRANS") || d.includes("VT") || d.includes("PASSAGEM")) return false;
                return (
                    d.includes("ALIMENTACAO") ||
                    d.includes("REFEICAO") ||
                    d.includes("VALE ALIM") ||
                    d.includes("VALE REFE") ||
                    d.includes("TICKET") ||
                    d.includes("SODEXO") ||
                    d.includes("CAJU") ||
                    d.includes("CESTA") ||
                    /\bVA\b/i.test(r.description) ||
                    /\bVR\b/i.test(r.description)
                );
            });
            const actVa = Math.round(matchingVaRubrics.reduce((acc, r) => acc + (r.deductions || 0), 0) * 100) / 100;
            const vaRubric = matchingVaRubrics[0];
            const vaRef = vaRubric?.reference ? (vaRubric.reference.includes("%") ? vaRubric.reference : `${vaRubric.reference}`) : "";
            const pctVa = emp.vaDiscountPercentage ?? posto?.vaDiscountPercentage ?? 20.0;
            const expVaGross = Math.round(((wfhPreview?.vaBaseValue || rawBaseVa) * (pctVa / 100)) * 100) / 100;
            if (expVa > 0 || actVa > 0) {
                const diff = Math.round((actVa - expVa) * 100) / 100;
                const isVaFaltou = expVa > 0 && actVa === 0;
                const isVaIndevido = expVa === 0 && actVa > 0;
                // Tolerância padrão de R$ 5,00 ou quando a contabilidade descontou 20% do VA Bruto integral (sem deduzir dias de faltas da base)
                const isOk = !isVaFaltou && !isVaIndevido && (Math.abs(diff) <= 5 || Math.abs(actVa - expVaGross) <= 2);
                rubricComparisons.push({
                    rubric: "420 - Desconto VA / VR",
                    expectedWfh: expVa,
                    expectedWfhDetail: expVa > 0 ? `R$ ${expVa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "R$ 0,00 (Sem desconto VA)",
                    actualHolerite: actVa,
                    actualHoleriteDetail: actVa > 0 
                        ? `R$ ${actVa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${vaRef ? ` (Ref: ${vaRef})` : " (Descontado)"}` 
                        : "R$ 0,00 (Não descontado)",
                    diff,
                    status: isOk ? "OK" : isVaIndevido ? "INDEVIDO" : isVaFaltou ? "FALTOU" : "DIVERGENTE",
                    instruction: isOk ? "" : isVaIndevido
                        ? `EXCLUIR DESCONTO VA: Colaborador não possui previsão de desconto de VA no WFH e veio com desconto de R$ ${actVa.toFixed(2)}.`
                        : isVaFaltou
                        ? `APLICAR DESCONTO VA: Previsto desconto de R$ ${expVa.toFixed(2)} no WFH que não constou no holerite.`
                        : `CONFERIR BASE DE DESCONTO VA: Previsto R$ ${expVa.toFixed(2)} (sobre VA Líquido de R$ ${wfhPreview?.vaNetValue ? wfhPreview.vaNetValue.toFixed(2) : '840.00'}) vs. R$ ${actVa.toFixed(2)} descontado no holerite (sobre VA Bruto de R$ ${wfhPreview?.vaBaseValue ? wfhPreview.vaBaseValue.toFixed(2) : '900.00'}).`
                });
            }

            divergentRubricsCount = rubricComparisons.filter(r => r.status !== "OK").length;
        }

        // Classify Status
        let status: AuditDiscrepancyType = "ALIGNED";
        let riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE" = "NONE";
        let diagnosticMessage = "Informações de folha, ponto e sistema conferidas.";
        let suggestedAction = "Liberar pagamento normalmente.";

        // Regra 1: Risco Crítico de Pagamento Indevido ou Ponto irregular
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
        } else if (hasPoint && isDesligado) {
            status = "CRITICAL_RISK";
            riskLevel = "CRITICAL";
            diagnosticMessage = `🚨 ALERTA: Colaborador DESLIGADO/DEMITIDO no WFH registrou ponto no Secullum (${pointWorkedHours.toFixed(1)}h)!`;
            suggestedAction = "Verificar se o colaborador continuou trabalhando irregularmente após a rescisão.";
        }

        // Regra 2: Faltando Holerite (Colaborador trabalhou no ponto mas não veio no holerite)
        // Só se aplica quando um lote de holerites foi enviado para cruzar!
        if (status === "ALIGNED" && holeriteItems.length > 0 && !hasHolerite && !isDesligado) {
            if (hasPoint && (pointWorkedHours > 0 || pointPunchesCount > 0)) {
                status = "MISSING_HOLERITE";
                riskLevel = "HIGH";
                diagnosticMessage = `Colaborador registrou ${pointWorkedHours.toFixed(1)}h no ponto, porém NÃO FOI GERADO HOLERITE no lote da contabilidade.`;
                suggestedAction = "Solicitar emissão complementar de holerite à contabilidade com urgência.";
            }
        } else if (status === "ALIGNED" && holeriteItems.length === 0 && hasPoint) {
            diagnosticMessage = "Ponto Secullum conferido com a base ativa WFH (Aguardando envio de holerite para conferência financeira).";
            suggestedAction = "Envie o arquivo de holerites para realizar o cruzamento de valores líquidos e descontos.";
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

        // Regra 6: Divergência nas Rubricas da Folha Fechada (VT Indevido, Falta de Insalubridade, Liderança, etc.)
        const discrepancies: string[] = [];
        if (divergentRubricsCount > 0) {
            const divergentList = rubricComparisons.filter(r => r.status !== "OK");
            if (status === "ALIGNED") {
                status = "RUBRIC_MISMATCH";
                riskLevel = "HIGH";
                diagnosticMessage = `${divergentRubricsCount} divergência(s) de folha encontrada(s): ${divergentList.map(r => r.rubric).join(", ")}.`;
                suggestedAction = "Notificar contabilidade para emissão de retificação ou folha complementar.";
            }
            discrepancies.push(diagnosticMessage);
            for (const r of divergentList) {
                if (r.instruction && !discrepancies.includes(r.instruction)) {
                    discrepancies.push(r.instruction);
                }
            }
        } else {
            discrepancies.push(diagnosticMessage);
        }

        const severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "OK" = 
            riskLevel === "CRITICAL" ? "CRITICAL" :
            riskLevel === "HIGH" ? "HIGH" :
            riskLevel === "MEDIUM" ? "MEDIUM" :
            riskLevel === "LOW" ? "LOW" : "OK";

        const expBase = wfhBaseSalary;
        const expInsalubridade = wfhPreview?.insalubridade !== undefined ? wfhPreview.insalubridade : (emp.insalubridade || 0);
        const expPericulosidade = wfhPreview?.periculosidade !== undefined ? wfhPreview.periculosidade : (emp.periculosidade || 0);
        const expAdicionais = Math.round((wfhPreview?.gratificacao || emp.gratificacao || 0) * 100) / 100;
        const expAjuda = wfhPreview?.ajudaCusto !== undefined ? wfhPreview.ajudaCusto : (emp.ajudaCusto || 0);
        const expExtras = Math.round(((wfhPreview?.horasExtras50Value || 0) + (wfhPreview?.horasExtras100Value || 0) + (wfhPreview?.adicionalNoturnoValue || 0)) * 100) / 100;

        const wfhGross = (wfhPreview?.totalGrossSalary && wfhPreview.totalGrossSalary > 0)
            ? Math.round((wfhPreview.totalGrossSalary - (wfhPreview.ajudaCusto || 0)) * 100) / 100
            : Math.round((expBase + expInsalubridade + expPericulosidade + expAdicionais + expExtras) * 100) / 100;

        const expFaltas = Math.round(((wfhPreview?.faltaDeduction || 0) + (wfhPreview?.dsrDeduction || 0)) * 100) / 100;
        const expVa = wfhPreview?.vaPayrollDiscount || 0;
        const isVtOptante = wfhPreview 
            ? (wfhPreview.vtOptIn === true && !(wfhPreview.ajudaCusto > 0)) 
            : (emp.vtOptIn === true && !(emp.ajudaCusto && emp.ajudaCusto > 0));
        const expVt = isVtOptante ? (wfhPreview?.vtPayrollDiscount || Math.round((expBase * 0.06) * 100) / 100) : 0;

        const wfhTotalDeductions = (wfhPreview?.totalDiscounts && wfhPreview.totalDiscounts > 0)
            ? wfhPreview.totalDiscounts
            : Math.round(((wfhPreview?.totalInss || 0) + (wfhPreview?.totalIrrf || 0) + expVt + expFaltas + expVa) * 100) / 100;

        const wfhNet = (wfhPreview?.totalNetSalary && wfhPreview.totalNetSalary > 0)
            ? wfhPreview.totalNetSalary
            : Math.max(0, Math.round((wfhGross - wfhTotalDeductions) * 100) / 100);

        const netDifference = (hasHolerite) ? Math.round((holeriteNet - wfhNet) * 100) / 100 : undefined;

        rows.push({
            id: emp.id,
            name: emp.name,
            employeeName: emp.name,
            cpf: emp.cpf || "",
            folha: point?.folha || holerite?.registrationCode || empExtra?.matricula?.toString() || "",
            companyId: emp.companyId || undefined,
            companyName: emp.company?.name || holerite?.companyName || "Sem Empresa",
            clientName: wfhPreview?.clientName || posto?.client?.name || "Interno / Rotativo",
            postoName: posto?.role?.name || emp.role?.name || "Cargo não informado",
            wfhSituation: situationName,
            wfhStatus: emp.status,
            wfhBaseSalary,
            wfhFullSalary: wfhPreview?.originalSalary || wfhBaseSalary,
            wfhDaysWorked: wfhPreview?.daysWorked,
            wfhTotalDays: wfhPreview?.totalDaysInMonth,
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
            discrepancies,
            suggestedAction,
            rubricComparisons,
            divergentRubricsCount,
            wfhNetSalary: wfhNet,
            wfhGrossSalary: wfhGross,
            wfhTotalDeductions: wfhTotalDeductions,
            netDifference,
            wfh: {
                situation: situationName,
                status: emp.status,
                companyId: emp.companyId || undefined,
                companyName: emp.company?.name,
                clientName: wfhPreview?.clientName || posto?.client?.name || "Interno / Rotativo",
                postoName: posto?.role?.name || emp.role?.name || "Cargo não informado",
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
                absenceDays: holeriteAbsenceDays,
                absenceDeduction: holeriteAbsenceDeduction,
                pageNumber: holerite?.pageNumber,
                companyName: holerite?.companyName,
                role: holerite?.payrollType,
                sourceName: holerite?.employeeName,
                sourceCpf: holerite?.cpf,
                matchedBy,
                rubrics: holerite?.rubrics
            } : undefined
        });
    }

    // 4. Process Holerites that are NOT in WFH at all (pessoas na folha que nem existem no sistema!)
    for (const h of dedupedHolerites) {
        if (matchedHoleriteIds.has(h.id)) continue;

        const cpfDigits = cleanCpfDigits(h.cpf);
        const normName = normalizeName(h.employeeName);
        const code = h.registrationCode?.trim() || "";

        if (cpfDigits && processedEmpKeys.has(cpfDigits)) continue;
        if (normName && processedEmpKeys.has(normName)) continue;
        if (code && processedEmpKeys.has(`code:${code}`)) continue;

        // Se uma empresa específica foi filtrada, verificar se o holerite pertence a ela
        if (targetCompany) {
            const cleanTargetCnpj = cleanCpfDigits(targetCompany.cnpj);
            const cleanHCnpj = cleanCpfDigits(h.cnpj);
            if (cleanTargetCnpj && cleanHCnpj && cleanTargetCnpj !== cleanHCnpj) {
                continue;
            }
            if (h.companyName && targetCompany.name) {
                const normHComp = normalizeName(h.companyName);
                const normTargetComp = normalizeName(targetCompany.name);
                if (!normHComp.includes(normTargetComp) && !normTargetComp.includes(normHComp)) {
                    continue;
                }
            }
        }

        matchedHoleriteIds.add(h.id);
        if (cpfDigits) processedEmpKeys.add(cpfDigits);
        if (normName) processedEmpKeys.add(normName);

        let point = (cpfDigits && pointByCpf.get(cpfDigits)) || pointByName.get(normName);
        if (!point && normName && normName.length >= 5) {
            for (const [pName, pItem] of pointByName.entries()) {
                const pk = cleanCpfDigits(pItem.cpf) || normalizeName(pItem.name) || pItem.folha || "";
                if (matchedPointKeys.has(pk)) continue;
                if (nameSimilarity(normName, pName) >= 0.75) {
                    point = pItem;
                    break;
                }
            }
        }

        if (point) {
            const pKey = cleanCpfDigits(point.cpf) || normalizeName(point.name) || point.folha || "";
            if (pKey) matchedPointKeys.add(pKey);
        }

        const holeriteNet = h.netSalary || (h.totalEarnings ? h.totalEarnings - (h.totalDeductions || 0) : 0);
        const isProLabore = /pro-labore|pr[oó]\s*labore|administrador|diretor/i.test(h.payrollType || "") 
            || /pro-labore|pr[oó]\s*labore/i.test(h.employeeName) 
            || /adamo/i.test(h.employeeName);

        let status: AuditDiscrepancyType = "CRITICAL_RISK";
        let riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE" = "CRITICAL";
        let diagMsg = `🚨 Holerite gerado (R$ ${holeriteNet.toFixed(2)}), mas colaborador NÃO EXISTE no cadastro do WFH!`;
        let suggestedAction = "Verificar se é admissão nova não lançada no WFH ou pagamento a terceiro indevido.";

        if (!point && isProLabore) {
            status = "MISSING_POINT";
            riskLevel = "LOW";
            diagMsg = `Holerite de Pró-Labore / Sócio emitido (R$ ${holeriteNet.toFixed(2)}), sem registro de ponto do Secullum.`;
            suggestedAction = "Pró-Labore / Diretoria isento de marcação de ponto no Secullum.";
        } else if (!point && pointItems.length > 0) {
            status = "MISSING_POINT";
            riskLevel = "HIGH";
            diagMsg = `Holerite gerado pela contabilidade (R$ ${holeriteNet.toFixed(2)}), mas colaborador NÃO ENCONTRADO no ponto Secullum.`;
            suggestedAction = "Verificar se o colaborador bate ponto em outro equipamento ou se houve falha de exportação.";
        }

        rows.push({
            id: `holerite-only-${h.id}`,
            name: h.employeeName,
            employeeName: h.employeeName,
            cpf: h.cpf || "",
            folha: h.registrationCode || point?.folha || "",
            companyId: targetCompany?.id || undefined,
            companyName: h.companyName || targetCompany?.name || "Contabilidade",
            clientName: "NÃO CADASTRADO NO WFH",
            postoName: isProLabore ? "Diretoria / Pró-Labore" : "Desconhecido",
            wfhSituation: isProLabore ? "PRÓ-LABORE" : "NÃO CONSTA NO SISTEMA",
            wfhStatus: isProLabore ? "DIRETORIA" : "NÃO CADASTRADO",
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
            status,
            riskLevel,
            severity: riskLevel === "CRITICAL" ? "CRITICAL" : riskLevel === "HIGH" ? "HIGH" : "LOW",
            diagnosticMessage: diagMsg,
            discrepancies: [diagMsg],
            suggestedAction,
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
                role: h.payrollType,
                rubrics: h.rubrics
            }
        });
    }

    // 5. Process Point records that are NOT in WFH and NOT in Holerite
    for (const p of pointItems) {
        const cpfDigits = cleanCpfDigits(p.cpf);
        const normName = normalizeName(p.name);
        const pKey = cpfDigits || normName;
        const code = p.folha?.trim() || "";

        if (matchedPointKeys.has(pKey)) continue;
        if (cpfDigits && processedEmpKeys.has(cpfDigits)) continue;
        if (normName && processedEmpKeys.has(normName)) continue;
        if (code && processedEmpKeys.has(`code:${code}`)) continue;

        if (targetCompany && p.company) {
            const normPComp = normalizeName(p.company);
            const normTargetComp = normalizeName(targetCompany.name);
            if (!normPComp.includes(normTargetComp) && !normTargetComp.includes(normPComp)) {
                continue;
            }
        }

        matchedPointKeys.add(pKey);
        if (cpfDigits) processedEmpKeys.add(cpfDigits);
        if (normName) processedEmpKeys.add(normName);

        const diagMsg = `⚠️ Colaborador registrou ponto (${p.workedHours.toFixed(1)}h), mas NÃO CONSTA no WFH nem possui Holerite!`;
        rows.push({
            id: `point-only-${cpfDigits || normName.replace(/\s+/g, "_")}`,
            name: p.name,
            employeeName: p.name,
            cpf: p.cpf || "",
            folha: p.folha || "",
            companyId: targetCompany?.id || undefined,
            companyName: p.company || targetCompany?.name || "Secullum",
            clientName: "NÃO CADASTRADO NO WFH",
            postoName: "Desconhecido",
            wfhSituation: "NÃO CONSTA NO SISTEMA",
            wfhStatus: "NÃO CADASTRADO",
            wfhBaseSalary: 0,
            wfhFaltasCount: 0,
            hasPoint: true,
            pointWorkedHours: p.workedHours,
            pointPunchesCount: p.punchesCount,
            pointFaltasCount: p.faltasCount,
            pointFaltasHours: p.faltasHours,
            pointExtrasHours: p.extrasHours,
            pointNoturnoHours: p.noturnoHours,
            hasHolerite: false,
            holeriteBaseSalary: 0,
            holeriteTotalEarnings: 0,
            holeriteTotalDeductions: 0,
            holeriteNetSalary: 0,
            holeriteAbsenceDays: 0,
            holeriteAbsenceDeduction: 0,
            holeriteWorkedDays: 0,
            status: holeriteItems.length > 0 ? "MISSING_HOLERITE" : "ALIGNED",
            riskLevel: "HIGH",
            severity: "HIGH",
            diagnosticMessage: diagMsg,
            discrepancies: [diagMsg],
            suggestedAction: "Verificar se trabalhou e precisa de emissão de holerite complementar ou inclusão no sistema.",
            wfh: undefined,
            point: {
                workedHours: `${p.workedHours.toFixed(1)}h`,
                punchCount: p.punchesCount,
                absenceDays: p.faltasCount,
                absenceHours: p.faltasHours > 0 ? `${p.faltasHours.toFixed(1)}h` : undefined,
                extraHours: p.extrasHours > 0 ? `${p.extrasHours.toFixed(1)}h` : undefined
            },
            holerite: undefined
        });
    }

    // 5. Calculate summary metrics
    const criticalRiskCount = rows.filter(r => r.status === "CRITICAL_RISK").length;
    const deductionMismatchCount = rows.filter(r => r.status === "DEDUCTION_MISMATCH").length;
    const suspectedOverpayment = rows
        .filter(r => r.status === "CRITICAL_RISK")
        .reduce((acc, r) => acc + r.holeriteNetSalary, 0);

    const rubricMismatchCount = rows.filter(r => r.status === "RUBRIC_MISMATCH" || (r.divergentRubricsCount && r.divergentRubricsCount > 0)).length;

    const summary: PayrollAuditSummary = {
        totalEvaluated: rows.length,
        totalAudited: rows.length,
        criticalCount: criticalRiskCount,
        criticalRiskCount,
        missingHoleriteCount: rows.filter(r => r.status === "MISSING_HOLERITE").length,
        missingPointCount: rows.filter(r => r.status === "MISSING_POINT").length,
        deductionMismatchCount,
        rubricMismatchCount,
        mismatchCount: deductionMismatchCount + rubricMismatchCount,
        alignedCount: rows.filter(r => r.status === "ALIGNED" && (!r.divergentRubricsCount || r.divergentRubricsCount === 0)).length,
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
        data: { 
            rows, 
            summary,
            detectedMonth: auditMonth,
            detectedYear: auditYear
        } 
    };
    } catch (error: any) {
        console.error("Erro no cruzamento de folha:", error);
        return {
            success: false,
            error: error.message || "Erro desconhecido ao executar auditoria de folha."
        };
    }
}

/**
 * Salva uma rodada completa de auditoria com dados processados e decisões do usuário.
 */
export async function savePayrollAuditRound(params: {
    id?: string;
    title: string;
    year: number;
    month: number;
    companyId?: string;
    companyName?: string;
    status?: string;
    auditData: any;
    decisions: AuditDecisionsMap;
    notes?: string;
}) {
    try {
        const user = await getCurrentUser();
        const userName = user?.name || "Usuário do Sistema";
        const userId = user?.id || null;

        const rows: PayrollAuditRow[] = params.auditData?.rows || [];
        const decisions = params.decisions || {};

        let divergentCount = 0;
        let pendingCount = 0;
        let sentCount = 0;
        let acceptedCount = 0;
        let resolvedCount = 0;

        for (const row of rows) {
            const isDivergent = row.status !== "ALIGNED" || (row.divergentRubricsCount && row.divergentRubricsCount > 0);
            if (isDivergent) {
                divergentCount++;
            }
            const key = cleanCpfDigits(row.cpf) || row.employeeName || row.id;
            const dec = decisions[key];
            if (dec) {
                if (dec.status === "ACEITO") acceptedCount++;
                else if (dec.status === "ENVIADO_CONTABILIDADE") sentCount++;
                else if (dec.status === "RESOLVIDO") resolvedCount++;
                else if (isDivergent) pendingCount++;
            } else if (isDivergent) {
                pendingCount++;
            }
        }

        const totalEmployees = rows.length;
        const totalHoleriteNet = params.auditData?.summary?.totalHoleriteNet || 0;
        const totalExpectedNet = rows.reduce((acc, r) => acc + (r.wfhNetSalary || 0), 0);

        if (params.id) {
            const updated = await prisma.savedPayrollAudit.update({
                where: { id: params.id },
                data: {
                    title: params.title,
                    status: params.status || (sentCount > 0 ? "ENVIADO_CONTABILIDADE" : "EM_ANALISE"),
                    totalEmployees,
                    divergentCount,
                    pendingCount,
                    sentCount,
                    acceptedCount,
                    resolvedCount,
                    totalHoleriteNet,
                    totalExpectedNet,
                    auditData: params.auditData,
                    decisions: params.decisions as any,
                    notes: params.notes,
                    updatedAt: new Date(),
                }
            });
            return { success: true, savedAudit: updated };
        } else {
            const created = await prisma.savedPayrollAudit.create({
                data: {
                    title: params.title,
                    year: params.year,
                    month: params.month,
                    companyId: params.companyId || null,
                    companyName: params.companyName || null,
                    status: params.status || (sentCount > 0 ? "ENVIADO_CONTABILIDADE" : "EM_ANALISE"),
                    totalEmployees,
                    divergentCount,
                    pendingCount,
                    sentCount,
                    acceptedCount,
                    resolvedCount,
                    totalHoleriteNet,
                    totalExpectedNet,
                    auditData: params.auditData,
                    decisions: params.decisions as any,
                    notes: params.notes || null,
                    createdById: userId,
                    createdByName: userName,
                }
            });
            return { success: true, savedAudit: created };
        }
    } catch (error: any) {
        console.error("Erro ao salvar auditoria de folha:", error);
        return { success: false, error: error.message || "Erro ao salvar auditoria." };
    }
}

/**
 * Salva AUTOMATICAMENTE uma nova versão da análise (competência + empresa).
 * Nunca sobrescreve versões anteriores: cada análise executada vira "Versão N".
 */
export async function autoSavePayrollAuditVersion(params: {
    year: number;
    month: number;
    companyId?: string;
    companyName?: string;
    auditData: any;
    decisions: AuditDecisionsMap;
}) {
    try {
        const existing = await prisma.savedPayrollAudit.count({
            where: {
                year: params.year,
                month: params.month,
                companyId: params.companyId || null
            }
        });
        const version = existing + 1;
        const comp = params.companyName || "Geral";
        const title = `Auditoria ${String(params.month).padStart(2, "0")}/${params.year} - ${comp} - Versão ${version}`;
        return await savePayrollAuditRound({
            title,
            year: params.year,
            month: params.month,
            companyId: params.companyId,
            companyName: comp,
            auditData: params.auditData,
            decisions: params.decisions || {},
            notes: "Salva automaticamente ao executar a análise."
        });
    } catch (error: any) {
        console.error("Erro ao salvar versão automática da auditoria:", error);
        return { success: false, error: error.message || "Erro ao salvar versão automática." };
    }
}

/**
 * Lista auditorias salvas para histórico e comparações.
 */
export async function getSavedPayrollAudits(params?: { year?: number; month?: number; companyId?: string }) {
    try {
        const where: any = {};
        if (params?.year) where.year = params.year;
        if (params?.month) where.month = params.month;
        if (params?.companyId && params.companyId !== "ALL") where.companyId = params.companyId;

        const audits = await prisma.savedPayrollAudit.findMany({
            where,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                title: true,
                year: true,
                month: true,
                companyId: true,
                companyName: true,
                status: true,
                totalEmployees: true,
                divergentCount: true,
                pendingCount: true,
                sentCount: true,
                acceptedCount: true,
                resolvedCount: true,
                totalHoleriteNet: true,
                totalExpectedNet: true,
                notes: true,
                createdByName: true,
                createdAt: true,
                updatedAt: true,
            }
        });
        return { success: true, audits };
    } catch (error: any) {
        console.error("Erro ao buscar histórico de auditorias:", error);
        return { success: false, error: error.message, audits: [] };
    }
}

/**
 * Obtém uma auditoria salva completa com dados de linhas e decisões.
 */
export async function getSavedPayrollAuditById(id: string) {
    try {
        const audit = await prisma.savedPayrollAudit.findUnique({
            where: { id }
        });
        if (!audit) {
            return { success: false, error: "Auditoria salva não encontrada." };
        }
        return { success: true, audit };
    } catch (error: any) {
        console.error("Erro ao buscar auditoria por ID:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Exclui uma rodada de auditoria salva.
 */
export async function deleteSavedPayrollAudit(id: string) {
    try {
        await prisma.savedPayrollAudit.delete({
            where: { id }
        });
        return { success: true };
    } catch (error: any) {
        console.error("Erro ao excluir auditoria salva:", error);
        return { success: false, error: error.message };
    }
}

