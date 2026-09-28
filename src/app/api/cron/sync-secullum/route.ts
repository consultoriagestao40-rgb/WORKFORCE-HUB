import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SecullumApiClient } from "@/lib/secullum";
import { format } from "date-fns";

/**
 * Cron: Sincronização Noturna do Secullum Ponto Web
 * ─────────────────────────────────────────────────
 * Executa às 01h00 (configurar na Vercel: 0 4 * * * em UTC = 01h BRT).
 *
 * ESTRATÉGIA EM LOTES (para não estourar a API):
 *   1. Busca afastamentos do mês → atualiza situação dos colaboradores
 *   2. Processa colaboradores em lotes de BATCH_SIZE com delay entre lotes
 *   3. Cada colaborador: busca cálculo consolidado e salva/atualiza EmployeeMonthlyCalculus
 *   4. Atualiza secullumLastSyncAt após conclusão
 *
 * Parâmetros de query (opcionais para execução manual):
 *   ?year=2025&month=9   → mês/ano alvo (padrão: mês atual)
 *   ?batch_size=10       → colaboradores por lote (padrão: 10)
 *   ?delay_ms=1500       → delay entre lotes em ms (padrão: 1500)
 *   ?offset=0            → início do lote para paginação manual
 */

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_DELAY_MS = 1500;

function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

export async function GET(request: Request) {
    const startedAt = Date.now();

    // ── Autenticação ─────────────────────────────────────────────────────────
    const authHeader = request.headers.get("authorization");
    if (process.env.NODE_ENV === "production" && process.env.CRON_SECRET) {
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    // ── Parâmetros ───────────────────────────────────────────────────────────
    const url = new URL(request.url);
    const now = new Date();
    const targetYear = parseInt(url.searchParams.get("year") || String(now.getFullYear()));
    const targetMonth = parseInt(url.searchParams.get("month") || String(now.getMonth() + 1));
    const batchSize = parseInt(url.searchParams.get("batch_size") || String(DEFAULT_BATCH_SIZE));
    const delayMs = parseInt(url.searchParams.get("delay_ms") || String(DEFAULT_DELAY_MS));
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Janela de competência: 26 do mês anterior até 25 do mês alvo
    let windowStartYear = targetYear;
    let windowStartMonth = targetMonth - 1;
    if (windowStartMonth <= 0) { windowStartMonth += 12; windowStartYear -= 1; }
    const windowStart = new Date(windowStartYear, windowStartMonth - 1, 26);
    const windowEnd = new Date(targetYear, targetMonth - 1, 25);

    const windowStartStr = format(windowStart, "yyyy-MM-dd");
    const windowEndStr = format(windowEnd, "yyyy-MM-dd");

    const log: string[] = [];
    let updatedCount = 0;
    let errorCount = 0;
    let afastamentosUpdated = 0;

    try {
        // ── 1. Carregar configuração do Secullum ─────────────────────────────
        const benefitsConfig = await prisma.benefitsConfig.findFirst();
        const secullumToken = benefitsConfig?.secullumApiToken;
        const secullumCompanyId = benefitsConfig?.secullumCompanyId;
        const secullumApiUrl = benefitsConfig?.secullumApiUrl;

        if (!secullumToken || !secullumCompanyId) {
            return NextResponse.json({
                success: false,
                message: "Secullum não configurado. Configure o Token e ID da Empresa em Configurações → Benefícios.",
            }, { status: 422 });
        }

        const client = new SecullumApiClient(secullumToken, secullumCompanyId, secullumApiUrl || undefined);

        // ── 2. Sincronizar Afastamentos ──────────────────────────────────────
        // Busca afastamentos do Secullum e atualiza situação dos colaboradores afastados
        try {
            const afastamentos = await client.getAfastamentos(windowStartStr, windowEndStr);
            log.push(`[Afastamentos] Encontrados ${afastamentos.length} registros no Secullum`);

            const inssLeavesSituations = await (prisma as any).employeeSituation.findMany({
                where: { name: { contains: "INSS", mode: "insensitive" } },
                take: 1
            });

            const inssLeavesSituationId = inssLeavesSituations[0]?.id;

            if (inssLeavesSituationId && afastamentos.length > 0) {
                const afastamentoCpfs = new Set(
                    afastamentos.map((a: any) => a.Cpf?.replace(/\D/g, "") || "").filter(Boolean)
                );

                const matchedEmployees = await prisma.employee.findMany({
                    where: { cpf: { in: [...afastamentoCpfs] as string[] }, status: "Ativo" },
                    select: { id: true, cpf: true, situationId: true, extraFields: true, situation: { select: { name: true } } }
                });

                for (const emp of matchedEmployees) {
                    const cpfClean = emp.cpf?.replace(/\D/g, "") || "";
                    if (afastamentoCpfs.has(cpfClean)) {
                        const af = afastamentos.find((a: any) => (a.Cpf?.replace(/\D/g, "") || "") === cpfClean);
                        const alreadyAfastado = emp.situation?.name?.toLowerCase().includes("inss") ||
                            emp.situation?.name?.toLowerCase().includes("afastad");
                        const currentExtra = (emp.extraFields as Record<string, any>) || {};
                        const dataInicio = af?.Inicio ? af.Inicio.split("T")[0] : null;

                        const needsSituationUpdate = !alreadyAfastado;
                        const needsDateUpdate = !!dataInicio && currentExtra.afastadoDesde !== dataInicio;

                        if (needsSituationUpdate || needsDateUpdate) {
                            const updatedExtra = {
                                ...currentExtra,
                                ...(dataInicio ? { afastadoDesde: dataInicio } : {})
                            };
                            await prisma.employee.update({
                                where: { id: emp.id },
                                data: {
                                    ...(needsSituationUpdate ? { situationId: inssLeavesSituationId } : {}),
                                    extraFields: updatedExtra
                                }
                            });
                            afastamentosUpdated++;
                            log.push(`[Afastado] ${emp.cpf} → AFASTADO INSS (início: ${dataInicio || 'não especificado'})`);
                        }
                    }
                }
            }
        } catch (afErr: any) {
            log.push(`[Afastamentos] Erro (não crítico): ${afErr.message}`);
        }

        // ── 3. Carregar colaboradores ativos para sincronizar ponto ──────────
        // Nota: filtramos cpf nulo e afastados INSS via JS após a query
        // pois Prisma TS strict não aceita null em NestedStringFilter nem mode em filtros aninhados
        const allEmployeesRaw = await prisma.employee.findMany({
            where: {
                status: "Ativo"
            },
            select: { id: true, cpf: true, name: true, situation: { select: { name: true } } },
            orderBy: { name: "asc" },
            skip: offset
        });

        // Filtrar fora do Prisma: excluir sem CPF e afastados INSS
        const allEmployees = allEmployeesRaw.filter(e =>
            e.cpf && e.cpf.trim().length > 0 &&
            !e.situation?.name?.toLowerCase().includes("inss") &&
            !e.situation?.name?.toLowerCase().includes("afastad")
        );

        log.push(`[Ponto] ${allEmployees.length} colaboradores a processar (offset=${offset})`);

        // ── 4. Processar em LOTES ────────────────────────────────────────────
        for (let i = 0; i < allEmployees.length; i += batchSize) {
            const batch = allEmployees.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(allEmployees.length / batchSize);

            log.push(`[Lote ${batchNum}/${totalBatches}] Processando ${batch.length} colaboradores...`);

            for (const emp of batch) {
                if (!emp.cpf) continue;
                const cpfClean = emp.cpf.replace(/\D/g, "");

                try {
                    const calculo = await client.getCalculos(cpfClean, windowStartStr, windowEndStr);

                    if (!calculo) {
                        log.push(`  [${emp.name}] Sem dados no Secullum`);
                        continue;
                    }

                    // Mapear campos do Secullum → EmployeeMonthlyCalculus
                    const atrasosHours = parseFloat(
                        calculo.TotalAtrasos ?? calculo.Atrasos ?? calculo.HorasAtraso ?? "0"
                    ) || 0;
                    const extras50Hours = parseFloat(
                        calculo.TotalExtras50 ?? calculo.HorasExtras50 ?? calculo.Extras50 ?? "0"
                    ) || 0;
                    const extras100Hours = parseFloat(
                        calculo.TotalExtras100 ?? calculo.HorasExtras100 ?? calculo.Extras100 ?? "0"
                    ) || 0;
                    const adicionalNoturnoHours = parseFloat(
                        calculo.TotalNoturno ?? calculo.HorasNoturno ?? calculo.Noturno ?? "0"
                    ) || 0;

                    await prisma.employeeMonthlyCalculus.upsert({
                        where: {
                            employeeId_year_month: {
                                employeeId: emp.id,
                                year: targetYear,
                                month: targetMonth
                            }
                        },
                        update: {
                            atrasosHours,
                            extras50Hours,
                            extras100Hours,
                            adicionalNoturnoHours
                            // diversosDescontos e emprestimos são manuais — não sobrescrever
                        },
                        create: {
                            employeeId: emp.id,
                            year: targetYear,
                            month: targetMonth,
                            atrasosHours,
                            extras50Hours,
                            extras100Hours,
                            adicionalNoturnoHours,
                            diversosDescontos: 0,
                            emprestimos: 0
                        }
                    });

                    updatedCount++;

                    if (atrasosHours > 0 || extras50Hours > 0 || extras100Hours > 0 || adicionalNoturnoHours > 0) {
                        log.push(`  ✓ ${emp.name}: atraso=${atrasosHours}h | 50%=${extras50Hours}h | 100%=${extras100Hours}h | noturno=${adicionalNoturnoHours}h`);
                    }
                } catch (empErr: any) {
                    errorCount++;
                    log.push(`  ✗ ${emp.name}: ${String(empErr.message).substring(0, 100)}`);
                }
            }

            // Delay entre lotes para não sobrecarregar a API
            if (i + batchSize < allEmployees.length) {
                log.push(`  ⏳ Aguardando ${delayMs}ms antes do próximo lote...`);
                await sleep(delayMs);
            }
        }

        // ── 5. Atualizar timestamp de última sincronização ───────────────────
        await prisma.benefitsConfig.updateMany({
            data: { secullumLastSyncAt: new Date() }
        });

        const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
        log.push(`\n✅ Sync concluído em ${elapsedSec}s`);

        return NextResponse.json({
            success: true,
            targetPeriod: `${targetMonth}/${targetYear} (${windowStartStr} a ${windowEndStr})`,
            updatedCount,
            afastamentosUpdated,
            errorCount,
            totalEmployees: allEmployees.length,
            elapsedSec: parseFloat(elapsedSec),
            log
        });

    } catch (err: any) {
        console.error("[sync-secullum cron error]:", err);
        return NextResponse.json({
            success: false,
            error: err.message,
            log,
            updatedCount,
            errorCount
        }, { status: 500 });
    }
}
