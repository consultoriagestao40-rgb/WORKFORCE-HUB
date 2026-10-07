"use client";

import { useState, useRef, useEffect, Fragment } from "react";
import Script from "next/script";
import Link from "next/link";
import { 
    ShieldAlert, 
    UploadCloud, 
    FileSpreadsheet, 
    FileText, 
    AlertTriangle, 
    CheckCircle2, 
    XCircle, 
    Search, 
    RefreshCw, 
    ChevronDown, 
    ChevronUp, 
    ArrowLeft, 
    DollarSign, 
    Users, 
    Clock, 
    AlertCircle, 
    Calendar,
    Building2,
    Eye,
    Filter,
    Download,
    Receipt,
    ArrowUpDown,
    TrendingUp,
    Printer,
    Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription 
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { extractDataFromPageText, parseHoleritePdfPageItems, ExtractedHoleriteItem } from "@/lib/holerite-processor";
import { parsePointExcel, parsePointPdfText, parsePointPdfPage, ParsedPointEmployee } from "@/lib/point-parser";
import { runPayrollAudit, getPayrollAuditCompanies, PayrollAuditResult, AuditRow, PayrollAuditRow } from "@/actions/payroll-audit";

export default function PayrollAuditPage() {
    const today = new Date();
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);

    // Companies Filter
    const [companies, setCompanies] = useState<{ id: string; name: string; cnpj: string | null }[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");

    const [pdfJsLoaded, setPdfJsLoaded] = useState(false);

    // Top Tabs: Auditoria Tripla vs Conferência de Folha Líquida
    const [activeTopTab, setActiveTopTab] = useState<"AUDIT" | "CROSS" | "LIQUIDS">("AUDIT");

    // Aba Cruzamento WFH x Holerites
    const [crossSearch, setCrossSearch] = useState("");
    const [crossFilter, setCrossFilter] = useState<"ALL" | "DIVERGENT" | "OK" | "NO_WFH">("ALL");

    // Upload Slot 1: Cartão de Ponto Secullum
    const [pointFile, setPointFile] = useState<File | null>(null);
    const [pointItems, setPointItems] = useState<ParsedPointEmployee[]>([]);
    const [isProcessingPoint, setIsProcessingPoint] = useState(false);

    // Upload Slot 2: Holerites PDF
    const [holeriteFile, setHoleriteFile] = useState<File | null>(null);
    const [holeriteItems, setHoleriteItems] = useState<ExtractedHoleriteItem[]>([]);
    const [isProcessingHolerite, setIsProcessingHolerite] = useState(false);

    // Audit State
    const [isAuditing, setIsAuditing] = useState(false);
    const [auditResult, setAuditResult] = useState<PayrollAuditResult | null>(null);

    // Filter & Search States (Auditoria)
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<"ALL" | "CRITICAL_RISK" | "MISSING_HOLERITE" | "MISSING_POINT" | "DEDUCTION_MISMATCH" | "SALARY_MISMATCH" | "RUBRIC_MISMATCH" | "ALIGNED">("ALL");
    const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
    const [isDevolutivaModalOpen, setIsDevolutivaModalOpen] = useState(false);

    // Filter & Search States (Folha Líquida)
    const [liquidSearchTerm, setLiquidSearchTerm] = useState("");
    const [liquidStatusFilter, setLiquidStatusFilter] = useState<"ALL" | "ATIVO" | "FERIAS" | "AFASTADO" | "DESLIGADO" | "NAO_CADASTRADO">("ALL");
    const [liquidSort, setLiquidSort] = useState<"NET_DESC" | "NET_ASC" | "NAME_ASC">("NET_DESC");
    const [selectedCompositionRow, setSelectedCompositionRow] = useState<PayrollAuditRow | null>(null);
    const [isCompositionOpen, setIsCompositionOpen] = useState(false);

    // Refs for file inputs
    const pointInputRef = useRef<HTMLInputElement | null>(null);
    const holeriteInputRef = useRef<HTMLInputElement | null>(null);

    // Load available companies
    useEffect(() => {
        getPayrollAuditCompanies().then(comps => {
            if (comps && comps.length > 0) {
                setCompanies(comps);
            }
        });
    }, []);

    // Ensure PDF.js worker is configured
    useEffect(() => {
        if (typeof window !== "undefined" && (window as any).pdfjsLib) {
            (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            setPdfJsLoaded(true);
        }
    }, []);

    // Format currency helper
    const fmtCurrency = (v?: number) => {
        if (v === undefined || v === null || isNaN(v)) return "R$ 0,00";
        return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    // Format CPF helper
    const fmtCpf = (cpf?: string) => {
        if (!cpf) return "---";
        const d = cpf.replace(/\D/g, "");
        if (d.length === 11) {
            return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
        }
        return cpf;
    };

    // Classificação de status padronizada para a conferência
    const getCollaboratorStatus = (row: PayrollAuditRow) => {
        const sit = (row.wfhSituation || row.wfh?.situation || "").toLowerCase();
        const status = (row.wfhStatus || row.wfh?.status || "").toLowerCase();

        if (sit.includes("férias") || sit.includes("ferias")) {
            return { 
                label: "Férias", 
                type: "FERIAS" as const, 
                badgeClass: "bg-blue-50 text-blue-700 border-blue-200" 
            };
        }
        if (sit.includes("afastad") || sit.includes("inss") || sit.includes("licença") || sit.includes("licenca") || row.wfh?.isMedicalLeave) {
            return { 
                label: "Afastado INSS", 
                type: "AFASTADO" as const, 
                badgeClass: "bg-amber-50 text-amber-700 border-amber-200" 
            };
        }
        if (sit.includes("abandono") || row.wfh?.isAbandonment) {
            return { 
                label: "Em Abandono", 
                type: "DESLIGADO" as const, 
                badgeClass: "bg-red-50 text-red-700 border-red-200" 
            };
        }
        if (sit.includes("desligad") || sit.includes("demiti") || status.includes("desligad") || row.wfh?.isDismissed) {
            return { 
                label: "Desligado", 
                type: "DESLIGADO" as const, 
                badgeClass: "bg-rose-50 text-rose-700 border-rose-200" 
            };
        }
        if (sit.includes("não consta") || sit.includes("nao consta") || !row.wfh) {
            return { 
                label: "Não Cadastrado", 
                type: "NAO_CADASTRADO" as const, 
                badgeClass: "bg-purple-50 text-purple-700 border-purple-200" 
            };
        }
        return { 
            label: "Ativo", 
            type: "ATIVO" as const, 
            badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" 
        };
    };

    // --- Auto-detect Company from uploaded file name ---
    const tryAutoDetectCompany = (filename: string) => {
        if (!companies || companies.length === 0) return;
        const cleanName = filename.toLowerCase();
        const matched = companies.find(c => {
            const cName = c.name.toLowerCase().trim();
            return cleanName.includes(cName) || (cName.length >= 4 && cleanName.includes(cName.slice(0, 4)));
        });
        if (matched && selectedCompanyId === "all") {
            setSelectedCompanyId(matched.id);
            toast.info(`Empresa detectada pelo arquivo: ${matched.name}`);
        }
    };

    // --- Process Point File (Excel or PDF) ---
    const handlePointFileChange = async (file: File) => {
        setPointFile(file);
        tryAutoDetectCompany(file.name);
        setIsProcessingPoint(true);
        try {
            const fileNameLower = file.name.toLowerCase();
            if (fileNameLower.endsWith(".xlsx") || fileNameLower.endsWith(".xls") || fileNameLower.endsWith(".csv")) {
                // Parse as Excel/CSV
                const arrayBuffer = await file.arrayBuffer();
                const parsed = parsePointExcel(arrayBuffer);
                setPointItems(parsed);
                toast.success(`Cartão Ponto processado: ${parsed.length} colaboradores identificados.`);
            } else if (fileNameLower.endsWith(".pdf")) {
                // Parse as PDF
                if (!pdfJsLoaded && !(window as any).pdfjsLib) {
                    toast.error("Motor de leitura de PDF ainda está carregando. Tente novamente em 2 segundos.");
                    setIsProcessingPoint(false);
                    return;
                }
                const arrayBuffer = await file.arrayBuffer();
                const pdfjsDoc = await (window as any).pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
                const parsed: ParsedPointEmployee[] = [];
                for (let i = 1; i <= pdfjsDoc.numPages; i++) {
                    const page = await pdfjsDoc.getPage(i);
                    const textContent = await page.getTextContent();
                    const emp = parsePointPdfPage(textContent.items);
                    if (emp) {
                        parsed.push(emp);
                    }
                }

                if (parsed.length === 0) {
                    let fullText = "";
                    for (let i = 1; i <= pdfjsDoc.numPages; i++) {
                        const page = await pdfjsDoc.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map((item: any) => item.str).join(" ");
                        fullText += "\n" + pageText;
                    }
                    const fallbackParsed = parsePointPdfText(fullText);
                    setPointItems(fallbackParsed);
                    toast.success(`Cartão Ponto (PDF) processado: ${fallbackParsed.length} colaboradores identificados.`);
                } else {
                    setPointItems(parsed);
                    toast.success(`Cartão Ponto (PDF) processado: ${parsed.length} colaboradores identificados.`);
                }
            } else {
                toast.error("Formato de cartão ponto não suportado. Utilize PDF ou Excel (.xlsx, .xls).");
            }
        } catch (error: any) {
            console.error("Erro ao processar cartão ponto:", error);
            toast.error("Falha ao processar arquivo de cartão ponto: " + (error.message || ""));
        } finally {
            setIsProcessingPoint(false);
        }
    };

    // --- Process Holerites File (PDF) ---
    const handleHoleriteFileChange = async (file: File) => {
        setHoleriteFile(file);
        tryAutoDetectCompany(file.name);
        setIsProcessingHolerite(true);
        try {
            if (!pdfJsLoaded && !(window as any).pdfjsLib) {
                toast.error("Motor de leitura de PDF ainda está carregando. Tente novamente em 2 segundos.");
                setIsProcessingHolerite(false);
                return;
            }

            const arrayBuffer = await file.arrayBuffer();
            const pdfjsDoc = await (window as any).pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
            const numPages = pdfjsDoc.numPages;

            if (numPages === 0) {
                toast.error("O arquivo de holerites está vazio.");
                setIsProcessingHolerite(false);
                return;
            }

            const rawItems: ExtractedHoleriteItem[] = [];
            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                const page = await pdfjsDoc.getPage(pageNum);
                const textContent = await page.getTextContent();
                const parsed = parseHoleritePdfPageItems(textContent.items, pageNum);

                rawItems.push({
                    id: `holerite-${pageNum}`,
                    pageIndices: [pageNum - 1],
                    pageNumbersDisplay: String(pageNum),
                    pageNumber: pageNum,
                    ...parsed
                });
            }

            // Deduplica 2 vias: Se o PDF tiver 2 vias por colaborador (via empregado e via empregador),
            // mantém estritamente 1 via única por colaborador (por CPF ou Nome normalizado).
            const seenCpfs = new Set<string>();
            const seenNames = new Set<string>();
            const items: ExtractedHoleriteItem[] = [];

            for (const item of rawItems) {
                const cleanCpf = item.cpf ? item.cpf.replace(/\D/g, "") : "";
                const normName = item.employeeName 
                    ? item.employeeName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() 
                    : "";

                if (cleanCpf && cleanCpf.length === 11) {
                    if (seenCpfs.has(cleanCpf)) {
                        // 2ª via detectada por CPF — ignora
                        continue;
                    }
                    seenCpfs.add(cleanCpf);
                    if (normName) seenNames.add(normName);
                } else if (normName && normName.length >= 4 && !normName.startsWith("colaborador_pagina")) {
                    if (seenNames.has(normName)) {
                        // 2ª via detectada por Nome — ignora
                        continue;
                    }
                    seenNames.add(normName);
                }

                items.push(item);
            }

            setHoleriteItems(items);
            if (rawItems.length > items.length) {
                toast.success(`Holerites processados: ${items.length} colaboradores (detectadas e consolidadas 2 vias para 1 via única).`);
            } else {
                toast.success(`Holerites processados: ${items.length} recibos extraídos com dados financeiros.`);
            }

            // Executa imediatamente o cruzamento com o banco WFH em segundo plano
            setIsAuditing(true);
            runPayrollAudit({
                year: selectedYear,
                month: selectedMonth,
                companyId: selectedCompanyId !== "all" ? selectedCompanyId : undefined,
                holeriteItems: items,
                pointItems: pointItems || []
            }).then(res => {
                if (res.success && res.data) {
                    setAuditResult(res.data);
                }
            }).catch(err => {
                console.error("Erro no auto-cruzamento de folha:", err);
            }).finally(() => {
                setIsAuditing(false);
            });
        } catch (error: any) {
            console.error("Erro ao processar holerites:", error);
            toast.error("Falha ao processar arquivo de holerites: " + (error.message || ""));
        } finally {
            setIsProcessingHolerite(false);
        }
    };

    // Auto-atualizar auditoria ao trocar filtros de período ou empresa
    useEffect(() => {
        if (holeriteItems.length > 0) {
            setIsAuditing(true);
            runPayrollAudit({
                year: selectedYear,
                month: selectedMonth,
                companyId: selectedCompanyId !== "all" ? selectedCompanyId : undefined,
                holeriteItems,
                pointItems: pointItems || []
            }).then(res => {
                if (res.success && res.data) {
                    setAuditResult(res.data);
                }
            }).catch(err => {
                console.error("Erro na atualização da auditoria:", err);
            }).finally(() => {
                setIsAuditing(false);
            });
        }
    }, [selectedYear, selectedMonth, selectedCompanyId]);

    // --- Run Triple Audit Action ---
    const handleRunAudit = async () => {
        if (holeriteItems.length === 0 && pointItems.length === 0) {
            toast.error("Carregue pelo menos o arquivo de Holerites ou o Cartão Ponto para auditar.");
            return;
        }

        setIsAuditing(true);
        try {
            const res = await runPayrollAudit({
                year: selectedYear,
                month: selectedMonth,
                companyId: selectedCompanyId !== "all" ? selectedCompanyId : undefined,
                holeriteItems,
                pointItems
            });

            if (!res.success || !res.data) {
                toast.error(res.error || "Erro ao executar auditoria.");
                return;
            }

            setAuditResult(res.data);
            toast.success("Auditoria concluída com sucesso!");

            // If there are critical risks, show warning toast
            if (res.data.summary.criticalRiskCount > 0) {
                toast.warning(`Atenção: ${res.data.summary.criticalRiskCount} caso(s) de risco crítico identificado(s)!`, {
                    duration: 7000
                });
                setActiveTab("CRITICAL_RISK");
            }
        } catch (error: any) {
            console.error("Erro na auditoria:", error);
            toast.error("Falha ao cruzar dados: " + (error.message || ""));
        } finally {
            setIsAuditing(false);
        }
    };

    // Toggle row expansion
    const toggleRow = (id: string) => {
        setExpandedRowIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Filter rows by company
    const rowsForCompany = (auditResult?.rows || []).filter(row => {
        if (selectedCompanyId === "all") return true;
        if (row.companyId === selectedCompanyId) return true;
        const targetComp = companies.find(c => c.id === selectedCompanyId);
        if (!targetComp) return true;
        const targetCompName = targetComp.name.toLowerCase();
        const rowCompName = (row.wfh?.companyName || row.companyName || "").toLowerCase();
        return rowCompName.includes(targetCompName) || targetCompName.includes(rowCompName);
    });

    const activeSummary = (selectedCompanyId === "all" || !auditResult) ? auditResult?.summary : {
        totalEvaluated: rowsForCompany.length,
        totalAudited: rowsForCompany.length,
        criticalCount: rowsForCompany.filter(r => r.status === "CRITICAL_RISK").length,
        criticalRiskCount: rowsForCompany.filter(r => r.status === "CRITICAL_RISK").length,
        missingHoleriteCount: rowsForCompany.filter(r => r.status === "MISSING_HOLERITE").length,
        missingPointCount: rowsForCompany.filter(r => r.status === "MISSING_POINT").length,
        deductionMismatchCount: rowsForCompany.filter(r => r.status === "DEDUCTION_MISMATCH").length,
        rubricMismatchCount: rowsForCompany.filter(r => r.status === "RUBRIC_MISMATCH" || (r.divergentRubricsCount && r.divergentRubricsCount > 0)).length,
        mismatchCount: rowsForCompany.filter(r => r.status === "DEDUCTION_MISMATCH" || r.status === "SALARY_MISMATCH" || r.status === "RUBRIC_MISMATCH" || (r.divergentRubricsCount && r.divergentRubricsCount > 0)).length,
        alignedCount: rowsForCompany.filter(r => r.status === "ALIGNED" && (!r.divergentRubricsCount || r.divergentRubricsCount === 0)).length,
        totalHoleriteNet: rowsForCompany.reduce((acc, r) => acc + (r.hasHolerite ? r.holeriteNetSalary : 0), 0),
        totalSuspectedOverpayment: rowsForCompany.filter(r => r.status === "CRITICAL_RISK").reduce((acc, r) => acc + r.holeriteNetSalary, 0),
        totalOverpaymentSuspected: rowsForCompany.filter(r => r.status === "CRITICAL_RISK").reduce((acc, r) => acc + r.holeriteNetSalary, 0)
    };

    // Filter rows based on tab and search
    const filteredRows = rowsForCompany.filter(row => {
        if (activeTab === "DEDUCTION_MISMATCH") {
            const hasMismatch = row.status === "DEDUCTION_MISMATCH" || 
                                row.status === "SALARY_MISMATCH" || 
                                row.status === "RUBRIC_MISMATCH" || 
                                (row.divergentRubricsCount && row.divergentRubricsCount > 0);
            if (!hasMismatch) return false;
        } else if (activeTab === "RUBRIC_MISMATCH") {
            const hasRubricDiff = row.status === "RUBRIC_MISMATCH" || (row.divergentRubricsCount && row.divergentRubricsCount > 0);
            if (!hasRubricDiff) return false;
        } else if (activeTab !== "ALL" && row.status !== activeTab) {
            return false;
        }

        if (!searchTerm.trim()) return true;

        const term = searchTerm.toLowerCase();
        const digits = searchTerm.replace(/\D/g, "");
        const matchName = row.name.toLowerCase().includes(term);
        const matchCpf = digits.length > 0 && row.cpf.replace(/\D/g, "").includes(digits);
        const matchCompany = (row.wfh?.companyName || row.companyName || "").toLowerCase().includes(term);

        return matchName || matchCpf || matchCompany;
    });

    // Copiar orientações da devolutiva de um colaborador para a área de transferência
    const copyEmployeeDevolutiva = (row: PayrollAuditRow) => {
        const divergent = (row.rubricComparisons || []).filter(c => c.status !== "OK");
        if (divergent.length === 0 && row.discrepancies.length === 0) {
            toast.info("Este colaborador não possui divergências a reportar.");
            return;
        }

        const lines: string[] = [
            `📌 *DEVOLUTIVA DE FOLHA - ${row.name.toUpperCase()}*`,
            `CPF: ${fmtCpf(row.cpf)} | Matrícula: ${row.folha || "---"}`,
            `Empresa: ${row.wfh?.companyName || row.companyName || "---"} | Contrato: ${row.clientName && row.clientName !== "Interno / Rotativo" ? row.clientName : (row.wfh?.clientName || "Interno")}`,
            `Líquido Previsto WFH: ${fmtCurrency(row.wfhNetSalary)} | Líquido Holerite: ${fmtCurrency(row.holeriteNetSalary)}`,
            `--------------------------------------------------`,
            `*ITENS A CORRIGIR PELA CONTABILIDADE:*`
        ];

        if (divergent.length > 0) {
            divergent.forEach(d => {
                const tag = d.status === "FALTOU" ? "❌ FALTOU NO HOLERITE" :
                            d.status === "INDEVIDO" ? "❌ DESCONTO INDEVIDO" : "⚠️ DIVERGÊNCIA";
                lines.push(`• [${tag}] ${d.rubric}:`);
                lines.push(`   - Previsto no WFH: ${fmtCurrency(d.expectedWfh)} (${d.expectedWfhDetail || "OK"})`);
                lines.push(`   - Veio no Holerite: ${fmtCurrency(d.actualHolerite)} (${d.actualHoleriteDetail || "---"})`);
                lines.push(`   👉 Ação necessária: ${d.instruction}`);
            });
        } else {
            row.discrepancies.forEach(d => {
                lines.push(`• ${d}`);
            });
            if (row.suggestedAction) {
                lines.push(`👉 Ação: ${row.suggestedAction}`);
            }
        }

        navigator.clipboard.writeText(lines.join("\n"));
        toast.success(`Devolutiva de ${row.name} copiada para a área de transferência!`);
    };

    // Copiar todas as orientações da folha para WhatsApp / Email
    const copyAllDevolutivas = () => {
        const rowsWithErrors = rowsForCompany.filter(r => 
            (r.divergentRubricsCount && r.divergentRubricsCount > 0) || 
            r.status === "CRITICAL_RISK" || 
            r.status === "MISSING_HOLERITE" || 
            r.status === "DEDUCTION_MISMATCH" || 
            r.status === "SALARY_MISMATCH" ||
            r.status === "RUBRIC_MISMATCH"
        );

        if (rowsWithErrors.length === 0) {
            toast.info("Não há colaboradores com divergências na listagem atual.");
            return;
        }

        const lines: string[] = [
            `📋 *RELATÓRIO DE DEVOLUTIVA E CORREÇÕES DE FOLHA DE PAGAMENTO*`,
            `Competência: ${String(selectedMonth).padStart(2, "0")}/${selectedYear}`,
            `Total de Colaboradores com Divergência: ${rowsWithErrors.length}`,
            `==================================================\n`
        ];

        rowsWithErrors.forEach((r, idx) => {
            lines.push(`${idx + 1}. *${r.name.toUpperCase()}* (CPF: ${fmtCpf(r.cpf)})`);
            lines.push(`   Empresa: ${r.wfh?.companyName || r.companyName || "---"}`);
            lines.push(`   Líquido WFH: ${fmtCurrency(r.wfhNetSalary)} | Líquido Holerite: ${fmtCurrency(r.holeriteNetSalary)}`);

            const divergent = (r.rubricComparisons || []).filter(c => c.status !== "OK");
            if (divergent.length > 0) {
                divergent.forEach(d => {
                    lines.push(`   - ${d.rubric}: ${d.instruction}`);
                });
            } else {
                r.discrepancies.forEach(d => {
                    lines.push(`   - ${d}`);
                });
            }
            lines.push(``);
        });

        navigator.clipboard.writeText(lines.join("\n"));
        toast.success("Relatório consolidado copiado! Cole no WhatsApp ou e-mail da contabilidade.");
    };

    // ==========================================
    // ABA CRUZAMENTO WFH x HOLERITES (Espelho por colaborador)
    // ==========================================
    const isNotInWfh = (r: PayrollAuditRow) => r.id.startsWith("holerite-only-");
    const crossBaseRows = rowsForCompany.filter(r => r.hasHolerite);
    const crossDivergentCount = crossBaseRows.filter(r => !isNotInWfh(r) && (r.divergentRubricsCount || 0) > 0).length;
    const crossOkCount = crossBaseRows.filter(r => !isNotInWfh(r) && !(r.divergentRubricsCount || 0)).length;
    const crossNoWfhCount = crossBaseRows.filter(r => isNotInWfh(r)).length;
    const crossTotalDiff = crossBaseRows.reduce((acc, r) => acc + (r.netDifference || 0), 0);
    const crossRubricErrors = crossBaseRows.reduce((acc, r) => acc + (r.divergentRubricsCount || 0), 0);

    const crossRows = crossBaseRows
        .filter(r => {
            if (crossFilter === "DIVERGENT") return !isNotInWfh(r) && (r.divergentRubricsCount || 0) > 0;
            if (crossFilter === "OK") return !isNotInWfh(r) && !(r.divergentRubricsCount || 0);
            if (crossFilter === "NO_WFH") return isNotInWfh(r);
            return true;
        })
        .filter(r => {
            if (!crossSearch.trim()) return true;
            const term = crossSearch.toLowerCase();
            const digits = crossSearch.replace(/\D/g, "");
            return r.name.toLowerCase().includes(term)
                || (digits.length > 0 && (r.cpf || "").replace(/\D/g, "").includes(digits))
                || (r.wfh?.companyName || r.companyName || "").toLowerCase().includes(term);
        })
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    const crossStatusLabel = (s: string) =>
        s === "OK" ? "✅ OK" : s === "FALTOU" ? "❌ FALTOU" : s === "INDEVIDO" ? "❌ INDEVIDO" : "⚠️ DIVERGENTE";

    // Excel no formato do espelho (bloco por colaborador) + aba de devolutiva
    const exportCrossToExcel = () => {
        if (crossBaseRows.length === 0) {
            toast.error("Suba o PDF de holerites para gerar o cruzamento.");
            return;
        }
        try {
            const wb = XLSX.utils.book_new();
            const comp = `${String(selectedMonth).padStart(2, "0")}/${selectedYear}`;

            // Aba 1: Espelho por colaborador (mesmo layout da tela na sequência do sistema)
            const aoa: (string | number)[][] = [
                [`ESPELHO DE CONFERÊNCIA WFH x HOLERITE — COMPETÊNCIA ${comp}`],
                []
            ];
            const sorted = [...crossBaseRows].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
            sorted.forEach(r => {
                const div = r.divergentRubricsCount || 0;
                const statusTxt = isNotInWfh(r) ? "🚨 NÃO CONSTA NO WFH" : div > 0 ? `⚠️ ${div} DIVERGÊNCIA(S)` : "✅ 100% OK";
                const contratoStr = r.clientName && r.clientName !== "Interno / Rotativo" ? r.clientName : (r.wfh?.clientName || "Interno");
                aoa.push([`COLABORADOR: ${r.name.toUpperCase()}`, `CPF: ${fmtCpf(r.cpf)}`, `CONTRATO: ${contratoStr}`, `EMPRESA: ${r.wfh?.companyName || r.companyName || "---"}`, `STATUS: ${statusTxt}`]);
                aoa.push(["RUBRICA / CONCEITO", "PREVISTO NO WFH (SISTEMA)", "PROCESSADO NO HOLERITE", "SITUAÇÃO", "ORIENTAÇÃO DE CORREÇÃO"]);
                (r.rubricComparisons || []).forEach(c => {
                    aoa.push([
                        c.rubric,
                        c.expectedWfhDetail ? `${fmtCurrency(c.expectedWfh)} (${c.expectedWfhDetail})` : fmtCurrency(c.expectedWfh),
                        c.actualHoleriteDetail ? `${fmtCurrency(c.actualHolerite)} (${c.actualHoleriteDetail})` : fmtCurrency(c.actualHolerite),
                        c.status === "OK" ? "✅ OK" : `${crossStatusLabel(c.status)} (${c.diff > 0 ? "+" : ""}${fmtCurrency(c.diff)})`,
                        c.status === "OK" ? "" : c.instruction
                    ]);
                });
                if (!r.rubricComparisons || r.rubricComparisons.length === 0) {
                    aoa.push([isNotInWfh(r) ? "Colaborador não localizado no WFH por CPF/Nome" : "Sem folha fechada no WFH para comparar", "---", fmtCurrency(r.holeriteNetSalary), "⚠️ VERIFICAR", r.suggestedAction || ""]);
                }
                aoa.push([
                    "TOTAL DE PROVENTOS",
                    fmtCurrency(r.wfhGrossSalary || r.wfhBaseSalary || 0),
                    fmtCurrency(r.holeriteTotalEarnings || 0),
                    "",
                    ""
                ]);
                aoa.push([
                    "TOTAL DE DESCONTOS",
                    fmtCurrency(r.wfhTotalDeductions || 0),
                    fmtCurrency(r.holeriteTotalDeductions || 0),
                    "",
                    ""
                ]);
                const nd = r.netDifference || 0;
                aoa.push([
                    "TOTAL LÍQUIDO",
                    fmtCurrency(r.wfhNetSalary || 0),
                    fmtCurrency(r.holeriteNetSalary || 0),
                    Math.abs(nd) < 0.01 ? "✅ OK" : `🔴 DIF ${nd > 0 ? "+" : ""}${Math.round(nd)}`,
                    ""
                ]);
                aoa.push([]);
            });
            const wsMirror = XLSX.utils.aoa_to_sheet(aoa);
            wsMirror["!cols"] = [{ wch: 42 }, { wch: 34 }, { wch: 34 }, { wch: 26 }, { wch: 80 }];
            XLSX.utils.book_append_sheet(wb, wsMirror, "Espelho por Colaborador");

            // Aba 2: Devolutiva (só o que precisa corrigir)
            const devHeader = ["Item", "Colaborador", "CPF", "Empresa", "Rubrica", "Enviado na Planilha (WFH)", "Veio no Holerite", "Diferença (R$)", "Situação", "ORIENTAÇÃO DE CORREÇÃO PARA A CONTABILIDADE"];
            const devRows: (string | number)[][] = [];
            let n = 1;
            sorted.forEach(r => {
                (r.rubricComparisons || []).filter(c => c.status !== "OK").forEach(c => {
                    devRows.push([
                        n++, r.name, fmtCpf(r.cpf), r.wfh?.companyName || r.companyName || "---",
                        c.rubric,
                        c.expectedWfhDetail ? `${fmtCurrency(c.expectedWfh)} (${c.expectedWfhDetail})` : fmtCurrency(c.expectedWfh),
                        c.actualHoleriteDetail ? `${fmtCurrency(c.actualHolerite)} (${c.actualHoleriteDetail})` : fmtCurrency(c.actualHolerite),
                        c.diff,
                        crossStatusLabel(c.status),
                        c.instruction
                    ]);
                });
                if (isNotInWfh(r)) {
                    devRows.push([n++, r.name, fmtCpf(r.cpf), r.companyName || "---", "Cadastro", "Não consta no WFH", fmtCurrency(r.holeriteNetSalary), r.holeriteNetSalary || 0, "🚨 VERIFICAR", "Holerite emitido para pessoa que não consta na planilha enviada. Confirmar se é admissão/terceiro antes de pagar."]);
                }
            });
            const wsDev = XLSX.utils.aoa_to_sheet([devHeader, ...devRows]);
            wsDev["!cols"] = [{ wch: 6 }, { wch: 34 }, { wch: 16 }, { wch: 22 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 80 }];
            XLSX.utils.book_append_sheet(wb, wsDev, "Devolutiva Contabilidade");

            XLSX.writeFile(wb, `Cruzamento_WFH_x_Holerite_${String(selectedMonth).padStart(2, "0")}_${selectedYear}.xlsx`);
            toast.success("Espelho WFH x Holerite exportado!");
        } catch (e) {
            console.error(e);
            toast.error("Erro ao exportar o espelho.");
        }
    };

    // Export to Excel (.xlsx) com 3 Abas:
    // Aba 1: "Devolutiva Contabilidade" (Somente os colaboradores e rubricas divergentes + instrução de correção)
    // Aba 2: "Espelho Analítico" (Comparativo linha a linha previsto WFH x processado Holerite)
    // Aba 3: "Lista Geral Auditoria" (Visão consolidada)
    const exportToExcel = () => {
        if (!auditResult || rowsForCompany.length === 0) {
            toast.error("Nenhum dado auditado para exportar.");
            return;
        }

        try {
            const wb = XLSX.utils.book_new();

            // ==========================================
            // ABA 1: DEVOLUTIVA PARA A CONTABILIDADE
            // ==========================================
            const devHeader = [
                "Item",
                "Nome do Colaborador",
                "CPF",
                "Empresa WFH / Holerite",
                "Cliente / Posto",
                "Cargo",
                "Rubrica / Evento",
                "Previsto no WFH (R$)",
                "Regra / Detalhe WFH",
                "Processado no Holerite (R$)",
                "Detalhe no Holerite",
                "Diferença (R$)",
                "Situação da Rubrica",
                "INSTRUÇÃO DE CORREÇÃO PARA A CONTABILIDADE"
            ];

            const devRows: (string | number)[][] = [];
            let itemCounter = 1;

            rowsForCompany.forEach(r => {
                const divergentRubrics = (r.rubricComparisons || []).filter(c => c.status !== "OK");
                if (divergentRubrics.length > 0) {
                    divergentRubrics.forEach(c => {
                        devRows.push([
                            itemCounter++,
                            r.name,
                            fmtCpf(r.cpf),
                            r.wfh?.companyName || r.companyName || r.holerite?.companyName || "---",
                            r.wfh?.clientName || r.postoName || "---",
                            r.wfh?.jobTitle || r.postoName || r.holerite?.role || "---",
                            c.rubric,
                            c.expectedWfh,
                            c.expectedWfhDetail || "Conforme fechamento WFH",
                            c.actualHolerite,
                            c.actualHoleriteDetail || "Conforme holerite emitido",
                            c.diff,
                            c.status === "FALTOU" ? "❌ FALTOU NO HOLERITE" :
                            c.status === "INDEVIDO" ? "❌ DESCONTO INDEVIDO" : "⚠️ VALOR DIVERGENTE",
                            c.instruction
                        ]);
                    });
                } else if (r.status === "CRITICAL_RISK") {
                    devRows.push([
                        itemCounter++,
                        r.name,
                        fmtCpf(r.cpf),
                        r.wfh?.companyName || r.companyName || r.holerite?.companyName || "---",
                        r.wfh?.clientName || r.postoName || "---",
                        r.wfh?.jobTitle || r.postoName || r.holerite?.role || "---",
                        "Status Cadastral / Risco Crítico",
                        0,
                        r.wfhSituation || "---",
                        r.holeriteNetSalary || 0,
                        "Holerite gerado com valor",
                        r.holeriteNetSalary || 0,
                        "❌ PAGAMENTO INDEVIDO / RISCO",
                        r.suggestedAction || r.diagnosticMessage || "Verificar afastamento/desligamento."
                    ]);
                } else if (r.status === "MISSING_HOLERITE") {
                    devRows.push([
                        itemCounter++,
                        r.name,
                        fmtCpf(r.cpf),
                        r.wfh?.companyName || r.companyName || "---",
                        r.wfh?.clientName || r.postoName || "---",
                        r.wfh?.jobTitle || r.postoName || "---",
                        "Emissão de Holerite",
                        r.wfhNetSalary || r.wfhBaseSalary || 0,
                        `Trabalhou ${r.point?.workedHours || "período"} no ponto`,
                        0,
                        "Holerite não emitido pela contabilidade",
                        -(r.wfhNetSalary || r.wfhBaseSalary || 0),
                        "❌ FALTOU HOLERITE",
                        "Emitir holerite para colaborador que trabalhou regularmente no período."
                    ]);
                }
            });

            const wsDev = XLSX.utils.aoa_to_sheet([devHeader, ...devRows]);
            wsDev["!cols"] = [
                { wch: 6 },
                { wch: 32 },
                { wch: 16 },
                { wch: 22 },
                { wch: 22 },
                { wch: 20 },
                { wch: 24 },
                { wch: 16 },
                { wch: 30 },
                { wch: 18 },
                { wch: 30 },
                { wch: 14 },
                { wch: 24 },
                { wch: 60 }
            ];
            XLSX.utils.book_append_sheet(wb, wsDev, "Devolutiva Contabilidade");

            // ==========================================
            // ABA 2: ESPELHO ANALÍTICO WFH X HOLERITE
            // ==========================================
            const mirrorHeader = [
                "Colaborador",
                "CPF",
                "Empresa",
                "Cliente / Posto",
                "Rubrica / Evento",
                "Previsto no WFH (R$)",
                "Detalhe WFH",
                "Processado no Holerite (R$)",
                "Detalhe Holerite",
                "Diferença (R$)",
                "Status",
                "Instrução / Orientação"
            ];

            const mirrorRows: (string | number)[][] = [];
            rowsForCompany.forEach(r => {
                if (r.rubricComparisons && r.rubricComparisons.length > 0) {
                    r.rubricComparisons.forEach(c => {
                        mirrorRows.push([
                            r.name,
                            fmtCpf(r.cpf),
                            r.wfh?.companyName || r.companyName || "---",
                            r.wfh?.clientName || r.postoName || "---",
                            c.rubric,
                            c.expectedWfh,
                            c.expectedWfhDetail || "---",
                            c.actualHolerite,
                            c.actualHoleriteDetail || "---",
                            c.diff,
                            c.status,
                            c.instruction || "Conforme"
                        ]);
                    });
                }
            });

            const wsMirror = XLSX.utils.aoa_to_sheet([mirrorHeader, ...mirrorRows]);
            wsMirror["!cols"] = [
                { wch: 32 },
                { wch: 16 },
                { wch: 22 },
                { wch: 22 },
                { wch: 24 },
                { wch: 16 },
                { wch: 28 },
                { wch: 18 },
                { wch: 28 },
                { wch: 14 },
                { wch: 14 },
                { wch: 50 }
            ];
            XLSX.utils.book_append_sheet(wb, wsMirror, "Espelho Analítico");

            // ==========================================
            // ABA 3: LISTA GERAL DE AUDITORIA
            // ==========================================
            const generalHeader = [
                "Status Auditoria",
                "Gravidade",
                "Nome Colaborador",
                "CPF",
                "Situação WFH",
                "Empresa WFH",
                "Cliente / Posto",
                "Cargo",
                "Salário Base WFH",
                "Salário Base Holerite",
                "Líquido Previsto WFH",
                "Líquido Holerite",
                "Diferença Líquida (R$)",
                "Rubricas Divergentes",
                "Total Vencimentos Holerite",
                "Total Descontos Holerite",
                "Dias Trabalhados Holerite",
                "Desconto Falta Holerite",
                "Página Holerite",
                "Horas Trab. Ponto",
                "Qtd Batidas Ponto",
                "Dias Faltas Ponto",
                "Horas Faltas Ponto",
                "Horas Extras Ponto",
                "Divergências Identificadas",
                "Ação Recomendada"
            ];

            const statusLabelMap: Record<string, string> = {
                CRITICAL_RISK: "RISCO CRÍTICO / INDEVIDO",
                MISSING_HOLERITE: "SEM HOLERITE (TRABALHOU)",
                MISSING_POINT: "SEM CARTÃO DE PONTO",
                DEDUCTION_MISMATCH: "DIVERGÊNCIA DE DESCONTOS/FALTAS",
                SALARY_MISMATCH: "DIVERGÊNCIA DE SALÁRIO BASE",
                RUBRIC_MISMATCH: "DIVERGÊNCIA DE RUBRICAS",
                ALIGNED: "ALINHADO / 100% OK"
            };

            const generalRows = rowsForCompany.map(r => [
                statusLabelMap[r.status] || r.status,
                r.severity,
                r.name,
                fmtCpf(r.cpf),
                r.wfh?.situation || "Não cadastrado",
                r.wfh?.companyName || r.holerite?.companyName || "---",
                r.wfh?.clientName || "---",
                r.wfh?.jobTitle || r.holerite?.role || "---",
                r.wfh?.baseSalary || 0,
                r.holerite?.baseSalary || 0,
                r.wfhNetSalary || 0,
                r.holerite?.netSalary || 0,
                r.netDifference || 0,
                r.divergentRubricsCount || 0,
                r.holerite?.totalEarnings || 0,
                r.holerite?.totalDeductions || 0,
                r.holerite?.workedDays ?? "---",
                r.holerite?.absenceDeduction || 0,
                r.holerite?.pageNumber ?? "---",
                r.point?.workedHours || "---",
                r.point?.punchCount ?? "---",
                r.point?.absenceDays ?? "---",
                r.point?.absenceHours || "---",
                r.point?.extraHours || "---",
                r.discrepancies.join("; "),
                r.suggestedAction || "---"
            ]);

            const wsGeneral = XLSX.utils.aoa_to_sheet([generalHeader, ...generalRows]);
            wsGeneral["!cols"] = [
                { wch: 28 }, { wch: 12 }, { wch: 35 }, { wch: 16 }, { wch: 24 },
                { wch: 22 }, { wch: 25 }, { wch: 22 }, { wch: 16 }, { wch: 16 },
                { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
                { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 16 },
                { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 45 },
                { wch: 45 }
            ];
            XLSX.utils.book_append_sheet(wb, wsGeneral, "Lista Geral Auditoria");

            const companyPart = selectedCompanyId === "all" 
                ? "todas_empresas" 
                : (companies.find(c => c.id === selectedCompanyId)?.name || "empresa").toLowerCase().replace(/[^a-z0-9]/gi, "_");

            XLSX.writeFile(wb, `Devolutiva_Auditoria_Folha_${companyPart}_${String(selectedMonth).padStart(2, "0")}_${selectedYear}.xlsx`);
            toast.success("Dossiê de auditoria e devolutiva gerado com 3 abas em Excel!");
        } catch (error: any) {
            console.error("Erro ao exportar relatório:", error);
            toast.error("Erro ao exportar Excel.");
        }
    };

    // --- Dados para a Aba de Conferência de Folha Líquida ---
    const liquidSourceRows: PayrollAuditRow[] = (rowsForCompany.length > 0 && rowsForCompany.some(r => r.hasHolerite))
        ? rowsForCompany.filter(r => r.hasHolerite)
        : holeriteItems.map((h, idx) => ({
            id: h.id || `holerite-preview-${idx}`,
            name: h.employeeName,
            employeeName: h.employeeName,
            cpf: h.cpf || "",
            folha: h.registrationCode || "",
            companyName: h.companyName,
            wfhSituation: "Não vinculado",
            wfhStatus: "Não vinculado",
            wfhBaseSalary: h.baseSalary || 0,
            wfhFaltasCount: 0,
            hasPoint: false,
            pointWorkedHours: 0,
            pointPunchesCount: 0,
            pointFaltasCount: 0,
            pointFaltasHours: 0,
            pointExtrasHours: 0,
            pointNoturnoHours: 0,
            hasHolerite: true,
            holeriteBaseSalary: h.baseSalary || 0,
            holeriteTotalEarnings: h.totalEarnings || 0,
            holeriteTotalDeductions: h.totalDeductions || 0,
            holeriteNetSalary: h.netSalary || ((h.totalEarnings || 0) - (h.totalDeductions || 0)),
            holeriteAbsenceDays: h.absenceDays || 0,
            holeriteAbsenceDeduction: h.absenceDeduction || 0,
            holeriteWorkedDays: h.workedDays || 30,
            status: "ALIGNED",
            riskLevel: "NONE",
            severity: "OK",
            diagnosticMessage: "Recibo de pagamento extraído",
            discrepancies: [],
            suggestedAction: "",
            holerite: {
                baseSalary: h.baseSalary || 0,
                totalEarnings: h.totalEarnings || 0,
                totalDeductions: h.totalDeductions || 0,
                netSalary: h.netSalary || ((h.totalEarnings || 0) - (h.totalDeductions || 0)),
                workedDays: h.workedDays || 30,
                absenceDeduction: h.absenceDeduction || 0,
                pageNumber: h.pageNumber,
                companyName: h.companyName,
                role: h.payrollType,
                rubrics: h.rubrics
            }
        }));

    const liquidTotalNet = liquidSourceRows.reduce((acc, r) => acc + (r.holeriteNetSalary || 0), 0);
    const liquidTotalEarnings = liquidSourceRows.reduce((acc, r) => acc + (r.holeriteTotalEarnings || 0), 0);
    const liquidTotalDeductions = liquidSourceRows.reduce((acc, r) => acc + (r.holeriteTotalDeductions || 0), 0);
    const liquidTotalAbsenceDeductions = liquidSourceRows.reduce((acc, r) => acc + (r.holeriteAbsenceDeduction || 0), 0);
    const liquidAvgNet = liquidSourceRows.length > 0 ? liquidTotalNet / liquidSourceRows.length : 0;
    const liquidAvgBase = liquidSourceRows.length > 0 ? (liquidSourceRows.reduce((acc, r) => acc + (r.holeriteBaseSalary || 0), 0) / liquidSourceRows.length) : 0;

    const liquidStatusCounts = {
        all: liquidSourceRows.length,
        ativos: liquidSourceRows.filter(r => getCollaboratorStatus(r).type === "ATIVO").length,
        ferias: liquidSourceRows.filter(r => getCollaboratorStatus(r).type === "FERIAS").length,
        afastados: liquidSourceRows.filter(r => getCollaboratorStatus(r).type === "AFASTADO").length,
        desligados: liquidSourceRows.filter(r => getCollaboratorStatus(r).type === "DESLIGADO").length,
        naoCadastrados: liquidSourceRows.filter(r => getCollaboratorStatus(r).type === "NAO_CADASTRADO").length,
    };

    const filteredLiquidRows = liquidSourceRows.filter(row => {
        if (liquidStatusFilter !== "ALL") {
            const st = getCollaboratorStatus(row);
            if (st.type !== liquidStatusFilter) return false;
        }

        if (!liquidSearchTerm.trim()) return true;

        const term = liquidSearchTerm.toLowerCase();
        const digits = liquidSearchTerm.replace(/\D/g, "");
        const matchName = (row.name || "").toLowerCase().includes(term);
        const matchCpf = digits.length > 0 && (row.cpf || "").replace(/\D/g, "").includes(digits);
        const matchFolha = (row.folha || "").toLowerCase().includes(term);
        const matchPosto = (row.postoName || row.wfh?.postoName || "").toLowerCase().includes(term);
        const matchClient = (row.clientName || row.wfh?.clientName || "").toLowerCase().includes(term);
        const matchCompany = (row.companyName || row.wfh?.companyName || "").toLowerCase().includes(term);

        return matchName || matchCpf || matchFolha || matchPosto || matchClient || matchCompany;
    }).sort((a, b) => {
        if (liquidSort === "NET_DESC") {
            return (b.holeriteNetSalary || 0) - (a.holeriteNetSalary || 0);
        }
        if (liquidSort === "NET_ASC") {
            return (a.holeriteNetSalary || 0) - (b.holeriteNetSalary || 0);
        }
        return (a.name || "").localeCompare(b.name || "");
    });

    const exportLiquidPayrollToExcel = () => {
        if (filteredLiquidRows.length === 0) {
            toast.error("Nenhum registro de folha para exportar.");
            return;
        }

        try {
            const header = [
                "Página PDF",
                "Nome do Colaborador",
                "CPF",
                "Matrícula",
                "Status WFH",
                "Empresa",
                "Cliente",
                "Posto de Trabalho",
                "Salário Base (R$)",
                "Total Proventos (R$)",
                "Total Descontos (R$)",
                "VALOR LÍQUIDO A PAGAR (R$)"
            ];

            const dataRows: (string | number)[][] = filteredLiquidRows.map(r => {
                const st = getCollaboratorStatus(r);
                return [
                    r.holerite?.pageNumber ?? "---",
                    r.name,
                    fmtCpf(r.cpf),
                    r.folha || "---",
                    st.label,
                    r.wfh?.companyName || r.companyName || "---",
                    r.wfh?.clientName || "---",
                    r.wfh?.postoName || r.wfh?.jobTitle || "---",
                    r.holeriteBaseSalary || 0,
                    r.holeriteTotalEarnings || 0,
                    r.holeriteTotalDeductions || 0,
                    r.holeriteNetSalary || 0
                ];
            });

            // Linha de total geral
            dataRows.push([
                "TOTAL",
                `${filteredLiquidRows.length} colaboradores`,
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                filteredLiquidRows.reduce((acc, r) => acc + (r.holeriteTotalEarnings || 0), 0),
                filteredLiquidRows.reduce((acc, r) => acc + (r.holeriteTotalDeductions || 0), 0),
                filteredLiquidRows.reduce((acc, r) => acc + (r.holeriteNetSalary || 0), 0)
            ]);

            const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
            ws["!cols"] = [
                { wch: 12 }, { wch: 35 }, { wch: 16 }, { wch: 14 }, { wch: 18 },
                { wch: 24 }, { wch: 25 }, { wch: 25 }, { wch: 16 }, { wch: 18 },
                { wch: 18 }, { wch: 22 }
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Folha Líquida");
            const companyPart = selectedCompanyId === "all" 
                ? "todas_empresas" 
                : (companies.find(c => c.id === selectedCompanyId)?.name || "empresa").toLowerCase().replace(/[^a-z0-9]/gi, "_");
            XLSX.writeFile(wb, `Folha_Liquida_${companyPart}_${String(selectedMonth).padStart(2, "0")}_${selectedYear}.xlsx`);
            toast.success("Folha Líquida exportada com sucesso!");
        } catch (err) {
            console.error("Erro ao exportar folha líquida:", err);
            toast.error("Erro ao exportar planilha.");
        }
    };

    return (
        <div className="space-y-6">
            <Script
                src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
                strategy="afterInteractive"
                onLoad={() => {
                    if ((window as any).pdfjsLib) {
                        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
                        setPdfJsLoaded(true);
                    }
                }}
            />

            {/* Header com Gradiente Premium */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-6 md:p-8 shadow-xl border border-slate-800">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#1e1b4b,transparent)]" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Link 
                                href="/admin/payroll-preview"
                                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-purple-400 font-bold transition-colors"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" /> Voltar à Prévia de Folha
                            </Link>
                            <span className="text-slate-600">|</span>
                            <div className="inline-flex items-center gap-1.5 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-400/20 text-purple-300 text-[10px] font-black uppercase tracking-wider">
                                <ShieldAlert className="w-3.5 h-3.5" /> Auditoria & Governança
                            </div>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                            Auditoria & Cruzamento Triplo de Folha
                        </h1>
                        <p className="text-xs text-slate-400 font-medium mt-1 max-w-2xl leading-relaxed">
                            Cruze automaticamente os holerites recebidos da contabilidade com os cartões ponto Secullum e a base WFH. Identifique pagamentos indevidos a colaboradores em processo de abandono, afastados ou sem registro de trabalho antes do fechamento bancário.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 self-start md:self-center shrink-0">
                        {/* Seletor de Empresa */}
                        <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-2xl border border-slate-700/60 backdrop-blur-sm">
                            <Building2 className="w-4 h-4 text-purple-400 ml-1.5 shrink-0" />
                            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                                <SelectTrigger className="h-8 border-none bg-transparent hover:bg-slate-700 text-white font-bold text-xs rounded-xl min-w-[170px] max-w-[250px] cursor-pointer">
                                    <SelectValue placeholder="Empresa" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                                    <SelectItem value="all">Todas as Empresas</SelectItem>
                                    {companies.map(c => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Seletor Mês/Ano */}
                        <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-2xl border border-slate-700/60 backdrop-blur-sm">
                            <Calendar className="w-4 h-4 text-purple-400 ml-1.5" />
                            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
                                <SelectTrigger className="h-8 border-none bg-transparent hover:bg-slate-700 text-white font-bold text-xs rounded-xl w-[110px] cursor-pointer">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                                    <SelectItem value="1">Janeiro</SelectItem>
                                    <SelectItem value="2">Fevereiro</SelectItem>
                                    <SelectItem value="3">Março</SelectItem>
                                    <SelectItem value="4">Abril</SelectItem>
                                    <SelectItem value="5">Maio</SelectItem>
                                    <SelectItem value="6">Junho</SelectItem>
                                    <SelectItem value="7">Julho</SelectItem>
                                    <SelectItem value="8">Agosto</SelectItem>
                                    <SelectItem value="9">Setembro</SelectItem>
                                    <SelectItem value="10">Outubro</SelectItem>
                                    <SelectItem value="11">Novembro</SelectItem>
                                    <SelectItem value="12">Dezembro</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                                <SelectTrigger className="h-8 border-none bg-transparent hover:bg-slate-700 text-white font-bold text-xs rounded-xl w-[85px] cursor-pointer">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                                    <SelectItem value="2025">2025</SelectItem>
                                    <SelectItem value="2026">2026</SelectItem>
                                    <SelectItem value="2027">2027</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Botões de Ação para Auditoria */}
                        {activeTopTab === "AUDIT" && auditResult && (
                            <div className="flex flex-wrap items-center gap-2">
                                <Button 
                                    onClick={() => setIsDevolutivaModalOpen(true)}
                                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs gap-1.5 rounded-2xl shadow-lg h-11 px-4 cursor-pointer"
                                >
                                    <FileText className="w-4 h-4" /> Dossiê Devolutiva Contabilidade
                                </Button>
                                <Button 
                                    onClick={exportToExcel}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 rounded-2xl shadow-lg h-11 px-4 cursor-pointer"
                                >
                                    <FileSpreadsheet className="w-4 h-4" /> Exportar Excel (3 Abas)
                                </Button>
                            </div>
                        )}
                        {activeTopTab === "CROSS" && crossBaseRows.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                <Button 
                                    onClick={copyAllDevolutivas}
                                    variant="outline"
                                    className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700 font-bold text-xs gap-1.5 rounded-2xl h-11 px-4 cursor-pointer"
                                >
                                    <Copy className="w-4 h-4" /> Copiar Devolutiva WhatsApp
                                </Button>
                                <Button 
                                    onClick={exportCrossToExcel}
                                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs gap-1.5 rounded-2xl shadow-lg h-11 px-4 cursor-pointer"
                                >
                                    <FileSpreadsheet className="w-4 h-4" /> Exportar Espelho XLSX
                                </Button>
                            </div>
                        )}
                        {activeTopTab === "LIQUIDS" && filteredLiquidRows.length > 0 && (
                            <Button 
                                onClick={exportLiquidPayrollToExcel}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 rounded-2xl shadow-lg h-11 px-4 cursor-pointer"
                            >
                                <FileSpreadsheet className="w-4 h-4" /> Exportar Folha Líquida XLSX
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Top Tab Switcher */}
            <div className="flex border-b border-slate-200 gap-2">
                <button
                    onClick={() => setActiveTopTab("AUDIT")}
                    className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                        activeTopTab === "AUDIT"
                            ? "border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-2xl shadow-sm"
                            : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-2xl"
                    }`}
                >
                    <ShieldAlert className="w-4 h-4 text-purple-600" />
                    <span>Auditoria & Cruzamento Triplo</span>
                    {auditResult && auditResult.summary.criticalRiskCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                            {auditResult.summary.criticalRiskCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTopTab("CROSS")}
                    className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                        activeTopTab === "CROSS"
                            ? "border-amber-500 text-amber-700 bg-amber-50/50 rounded-t-2xl shadow-sm"
                            : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-2xl"
                    }`}
                >
                    <Receipt className="w-4 h-4 text-amber-600" />
                    <span>Cruzamento WFH x Holerites</span>
                    {crossDivergentCount > 0 && (
                        <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                            {crossDivergentCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTopTab("LIQUIDS")}
                    className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                        activeTopTab === "LIQUIDS"
                            ? "border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-2xl shadow-sm"
                            : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-2xl"
                    }`}
                >
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>Conferência de Folha Líquida</span>
                    {liquidSourceRows.length > 0 && (
                        <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                            {liquidSourceRows.length}
                        </span>
                    )}
                </button>
            </div>

            {/* ABA 1: AUDITORIA & CRUZAMENTO TRIPLO */}
            {activeTopTab === "AUDIT" && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Slots de Upload: Ponto & Holerites */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Slot 1: Cartão de Ponto Secullum */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800">1. Cartão Ponto Secullum</h3>
                                    <p className="text-[11px] text-slate-400 font-medium">Relatório de espelho de ponto em PDF ou Excel (.xlsx, .xls)</p>
                                </div>
                            </div>
                            {pointItems.length > 0 && (
                                <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full border border-emerald-200">
                                    {pointItems.length} lidos
                                </span>
                            )}
                        </div>

                        <input 
                            ref={pointInputRef}
                            type="file" 
                            accept=".pdf,.xlsx,.xls,.csv" 
                            className="hidden" 
                            onChange={e => {
                                if (e.target.files && e.target.files[0]) {
                                    handlePointFileChange(e.target.files[0]);
                                }
                            }}
                        />

                        <div 
                            onClick={() => pointInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                                pointFile 
                                    ? "border-indigo-400 bg-indigo-50/30" 
                                    : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50"
                            }`}
                        >
                            {isProcessingPoint ? (
                                <div className="flex flex-col items-center gap-2 py-3">
                                    <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin" />
                                    <span className="text-xs font-bold text-slate-700">Processando espelhos de ponto...</span>
                                </div>
                            ) : pointFile ? (
                                <div className="flex flex-col items-center gap-1.5 py-2">
                                    <div className="bg-indigo-600 text-white p-2 rounded-xl">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-black text-slate-800 truncate max-w-xs">{pointFile.name}</span>
                                    <span className="text-[10px] text-indigo-700 font-bold">
                                        {pointItems.length} cartões identificados • Clique para trocar
                                    </span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 py-3">
                                    <UploadCloud className="w-8 h-8 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-700">Selecione ou arraste o Cartão Ponto</span>
                                    <span className="text-[10px] text-slate-400 font-medium">PDF ou Excel exportado do Secullum</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Slot 2: Holerites da Contabilidade */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2.5 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800">2. Holerites da Contabilidade</h3>
                                    <p className="text-[11px] text-slate-400 font-medium">PDF consolidado de recibos de pagamento emitido pelo escritório</p>
                                </div>
                            </div>
                            {holeriteItems.length > 0 && (
                                <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full border border-emerald-200">
                                    {holeriteItems.length} lidos
                                </span>
                            )}
                        </div>

                        <input 
                            ref={holeriteInputRef}
                            type="file" 
                            accept=".pdf" 
                            className="hidden" 
                            onChange={e => {
                                if (e.target.files && e.target.files[0]) {
                                    handleHoleriteFileChange(e.target.files[0]);
                                }
                            }}
                        />

                        <div 
                            onClick={() => holeriteInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                                holeriteFile 
                                    ? "border-purple-400 bg-purple-50/30" 
                                    : "border-slate-300 hover:border-purple-400 hover:bg-slate-50"
                            }`}
                        >
                            {isProcessingHolerite ? (
                                <div className="flex flex-col items-center gap-2 py-3">
                                    <RefreshCw className="w-7 h-7 text-purple-600 animate-spin" />
                                    <span className="text-xs font-bold text-slate-700">Lendo páginas de holerites...</span>
                                </div>
                            ) : holeriteFile ? (
                                <div className="flex flex-col items-center gap-1.5 py-2">
                                    <div className="bg-purple-600 text-white p-2 rounded-xl">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-black text-slate-800 truncate max-w-xs">{holeriteFile.name}</span>
                                    <span className="text-[10px] text-purple-700 font-bold">
                                        {holeriteItems.length} recibos extraídos • Clique para trocar
                                    </span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 py-3">
                                    <UploadCloud className="w-8 h-8 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-700">Selecione ou arraste o PDF de Holerites</span>
                                    <span className="text-[10px] text-slate-400 font-medium">PDF com todos os contracheques do mês</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Ação Central: Executar Auditoria */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-purple-900 to-indigo-950 text-white p-5 rounded-3xl shadow-lg border border-purple-800/40">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-500/20 p-3 rounded-2xl border border-purple-400/30">
                        <ShieldAlert className="w-6 h-6 text-purple-300" />
                    </div>
                    <div>
                        <h4 className="text-sm font-black tracking-tight">Cruzar Holerite × Ponto × Sistema WFH</h4>
                        <p className="text-[11px] text-purple-200">
                            {selectedCompanyId !== "all" 
                                ? `Empresa Alvo: ${companies.find(c => c.id === selectedCompanyId)?.name || "Selecionada"} • ` 
                                : "Todas as Empresas • "}
                            {pointItems.length} cartões de ponto e {holeriteItems.length} holerites prontos para auditoria cruzada.
                        </p>
                    </div>
                </div>

                <Button 
                    onClick={handleRunAudit}
                    disabled={isAuditing || (pointItems.length === 0 && holeriteItems.length === 0)}
                    className="w-full sm:w-auto bg-purple-500 hover:bg-purple-400 disabled:bg-purple-900/50 text-white font-black text-xs gap-2 rounded-2xl shadow-md h-11 px-6 transition-all transform active:scale-95 cursor-pointer"
                >
                    {isAuditing ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Auditando Base WFH...</span>
                        </>
                    ) : (
                        <>
                            <ShieldAlert className="w-4 h-4" />
                            <span>Executar Auditoria Cruzada</span>
                        </>
                    )}
                </Button>
            </div>

            {/* Relatório & Resultados */}
            {auditResult && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* KPI Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Risco Crítico */}
                        <div 
                            onClick={() => setActiveTab("CRITICAL_RISK")}
                            className={`rounded-3xl p-5 border cursor-pointer transition-all transform hover:-translate-y-0.5 ${
                                activeTab === "CRITICAL_RISK" 
                                    ? "bg-red-50 border-red-400 shadow-md ring-2 ring-red-400/30" 
                                    : "bg-white border-red-200/80 shadow-sm hover:shadow"
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-red-600">Risco Crítico</span>
                                <span className="p-2 rounded-xl bg-red-100 text-red-600 animate-pulse">
                                    <ShieldAlert className="w-4 h-4" />
                                </span>
                            </div>
                            <div className="text-3xl font-black text-red-600">{activeSummary?.criticalRiskCount ?? 0}</div>
                            <div className="text-[11px] font-bold text-red-700 mt-1">
                                {(activeSummary?.criticalRiskCount ?? 0) > 0 ? (
                                    <>🚨 {fmtCurrency(activeSummary?.totalOverpaymentSuspected)} em risco</>
                                ) : (
                                    <>Nenhum pagamento indevido</>
                                )}
                            </div>
                        </div>

                        {/* Sem Holerite */}
                        <div 
                            onClick={() => setActiveTab("MISSING_HOLERITE")}
                            className={`rounded-3xl p-5 border cursor-pointer transition-all transform hover:-translate-y-0.5 ${
                                activeTab === "MISSING_HOLERITE" 
                                    ? "bg-amber-50 border-amber-400 shadow-md ring-2 ring-amber-400/30" 
                                    : "bg-white border-amber-200/80 shadow-sm hover:shadow"
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Sem Holerite</span>
                                <span className="p-2 rounded-xl bg-amber-100 text-amber-600">
                                    <AlertTriangle className="w-4 h-4" />
                                </span>
                            </div>
                            <div className="text-3xl font-black text-amber-600">{activeSummary?.missingHoleriteCount ?? 0}</div>
                            <div className="text-[11px] font-semibold text-slate-500 mt-1">
                                {holeriteItems.length === 0 
                                    ? "Envie holerites para cruzar" 
                                    : "Trabalhou no ponto, sem holerite"}
                            </div>
                        </div>

                        {/* Sem Ponto */}
                        <div 
                            onClick={() => setActiveTab("MISSING_POINT")}
                            className={`rounded-3xl p-5 border cursor-pointer transition-all transform hover:-translate-y-0.5 ${
                                activeTab === "MISSING_POINT" 
                                    ? "bg-slate-100 border-slate-400 shadow-md ring-2 ring-slate-400/30" 
                                    : "bg-white border-slate-200/80 shadow-sm hover:shadow"
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Sem Ponto</span>
                                <span className="p-2 rounded-xl bg-slate-100 text-slate-600">
                                    <Clock className="w-4 h-4" />
                                </span>
                            </div>
                            <div className="text-3xl font-black text-slate-700">{activeSummary?.missingPointCount ?? 0}</div>
                            <div className="text-[11px] font-semibold text-slate-500 mt-1">Holerite sem registro de ponto</div>
                        </div>

                        {/* Divergências */}
                        <div 
                            onClick={() => setActiveTab("DEDUCTION_MISMATCH")}
                            className={`rounded-3xl p-5 border cursor-pointer transition-all transform hover:-translate-y-0.5 ${
                                activeTab === "DEDUCTION_MISMATCH" || activeTab === "SALARY_MISMATCH" || activeTab === "RUBRIC_MISMATCH"
                                    ? "bg-indigo-50 border-indigo-400 shadow-md ring-2 ring-indigo-400/30" 
                                    : "bg-white border-indigo-200/80 shadow-sm hover:shadow"
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Divergências de Rubricas</span>
                                <span className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                                    <AlertCircle className="w-4 h-4" />
                                </span>
                            </div>
                            <div className="text-3xl font-black text-indigo-600">{activeSummary?.mismatchCount ?? 0}</div>
                            <div className="text-[11px] font-semibold text-slate-500 mt-1">VT, Insalubridade, Liderança ou Faltas</div>
                        </div>

                        {/* Alinhados */}
                        <div 
                            onClick={() => setActiveTab("ALIGNED")}
                            className={`rounded-3xl p-5 border cursor-pointer transition-all transform hover:-translate-y-0.5 ${
                                activeTab === "ALIGNED" 
                                    ? "bg-emerald-50 border-emerald-400 shadow-md ring-2 ring-emerald-400/30" 
                                    : "bg-white border-emerald-200/80 shadow-sm hover:shadow"
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">100% Alinhados</span>
                                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                                    <CheckCircle2 className="w-4 h-4" />
                                </span>
                            </div>
                            <div className="text-3xl font-black text-emerald-600">{activeSummary?.alignedCount ?? 0}</div>
                            <div className="text-[11px] font-semibold text-slate-500 mt-1">Dados perfeitamente coincidentes</div>
                        </div>
                    </div>

                    {/* Barra de Filtros & Busca */}
                    <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                        {/* Tabs de Status */}
                        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                            <button
                                onClick={() => setActiveTab("ALL")}
                                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
                                    activeTab === "ALL" 
                                        ? "bg-slate-900 text-white shadow-sm" 
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                            >
                                Todos ({activeSummary?.totalAudited ?? 0})
                            </button>
                            <button
                                onClick={() => setActiveTab("CRITICAL_RISK")}
                                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    activeTab === "CRITICAL_RISK" 
                                        ? "bg-red-600 text-white shadow-sm" 
                                        : "bg-red-50 text-red-700 hover:bg-red-100"
                                }`}
                            >
                                🚨 Risco Crítico ({activeSummary?.criticalRiskCount ?? 0})
                            </button>
                            <button
                                onClick={() => setActiveTab("MISSING_HOLERITE")}
                                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
                                    activeTab === "MISSING_HOLERITE" 
                                        ? "bg-amber-600 text-white shadow-sm" 
                                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                }`}
                            >
                                Sem Holerite ({activeSummary?.missingHoleriteCount ?? 0})
                            </button>
                            <button
                                onClick={() => setActiveTab("MISSING_POINT")}
                                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
                                    activeTab === "MISSING_POINT" 
                                        ? "bg-slate-700 text-white shadow-sm" 
                                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                            >
                                Sem Ponto ({activeSummary?.missingPointCount ?? 0})
                            </button>
                            <button
                                onClick={() => setActiveTab("DEDUCTION_MISMATCH")}
                                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
                                    activeTab === "DEDUCTION_MISMATCH" 
                                        ? "bg-indigo-600 text-white shadow-sm" 
                                        : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                }`}
                            >
                                Divergências ({activeSummary?.mismatchCount ?? 0})
                            </button>
                            <button
                                onClick={() => setActiveTab("ALIGNED")}
                                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
                                    activeTab === "ALIGNED" 
                                        ? "bg-emerald-600 text-white shadow-sm" 
                                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                            >
                                Alinhados ({activeSummary?.alignedCount ?? 0})
                            </button>
                        </div>

                        {/* Busca Rápida */}
                        <div className="relative w-full md:w-72">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <Input 
                                placeholder="Buscar por nome, CPF ou empresa..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 h-10 rounded-2xl border-slate-200 text-xs"
                            />
                        </div>
                    </div>

                    {/* Tabela de Auditoria Cruzada */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                        <th className="py-3.5 px-4 w-10"></th>
                                        <th className="py-3.5 px-4">Status / Gravidade</th>
                                        <th className="py-3.5 px-4">Colaborador & CPF</th>
                                        <th className="py-3.5 px-4">Situação WFH</th>
                                        <th className="py-3.5 px-4">Cartão Ponto</th>
                                        <th className="py-3.5 px-4">Holerite Contabilidade</th>
                                        <th className="py-3.5 px-4">Diagnóstico / Divergências</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-12 text-slate-400">
                                                <div className="flex flex-col items-center gap-2">
                                                    <CheckCircle2 className="w-8 h-8 text-emerald-500/60" />
                                                    <span className="font-bold text-slate-600">Nenhum registro encontrado para este filtro.</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRows.map(row => {
                                            const isExpanded = expandedRowIds.has(row.id);
                                            const isCritical = row.status === "CRITICAL_RISK";

                                            return (
                                                <Fragment key={row.id}>
                                                    <tr 
                                                        className={`hover:bg-slate-50/80 transition-colors ${
                                                            isCritical ? "bg-red-50/40" : ""
                                                        }`}
                                                    >
                                                    <td className="py-3.5 px-4 text-center">
                                                        <button 
                                                            onClick={() => toggleRow(row.id)}
                                                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                                        >
                                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                        </button>
                                                    </td>

                                                    {/* Status Badge */}
                                                    <td className="py-3.5 px-4">
                                                        {row.status === "CRITICAL_RISK" && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-800 border border-red-200">
                                                                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                                                                RISCO CRÍTICO
                                                            </span>
                                                        )}
                                                        {row.status === "MISSING_HOLERITE" && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                                                SEM HOLERITE
                                                            </span>
                                                        )}
                                                        {row.status === "MISSING_POINT" && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                                                                SEM PONTO
                                                            </span>
                                                        )}
                                                        {row.status === "DEDUCTION_MISMATCH" && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                                                                DIVERGÊNCIA
                                                            </span>
                                                        )}
                                                        {row.status === "SALARY_MISMATCH" && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                                                                SALÁRIO DIF.
                                                            </span>
                                                        )}
                                                        {row.status === "RUBRIC_MISMATCH" && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                                                RUBRICA DIF. ({row.divergentRubricsCount || 1})
                                                            </span>
                                                        )}
                                                        {row.status === "ALIGNED" && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                <CheckCircle2 className="w-3 h-3" /> OK
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Colaborador & CPF */}
                                                    <td className="py-3.5 px-4">
                                                        <div className="font-bold text-slate-800">{row.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{fmtCpf(row.cpf)}</div>
                                                        {(row.wfh?.companyName || row.holerite?.companyName) && (
                                                            <div className="text-[10px] text-slate-500 font-medium">
                                                                {row.wfh?.companyName || row.holerite?.companyName}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Situação WFH */}
                                                    <td className="py-3.5 px-4">
                                                        {row.wfh ? (
                                                            <div>
                                                                <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black ${
                                                                    row.wfh.isAbandonment 
                                                                        ? "bg-red-600 text-white animate-pulse"
                                                                        : row.wfh.isDismissed
                                                                        ? "bg-rose-100 text-rose-800"
                                                                        : row.wfh.isMedicalLeave
                                                                        ? "bg-amber-100 text-amber-800"
                                                                        : "bg-emerald-50 text-emerald-700"
                                                                }`}>
                                                                    {row.wfh.situation || row.wfh.status}
                                                                </span>
                                                                {row.wfh.clientName && (
                                                                    <div className="text-[10px] text-slate-500 mt-1 truncate max-w-[150px]">
                                                                        {row.wfh.clientName}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 italic">Não cadastrado no WFH</span>
                                                        )}
                                                    </td>

                                                    {/* Cartão Ponto */}
                                                    <td className="py-3.5 px-4">
                                                        {row.point ? (
                                                            <div className="space-y-0.5">
                                                                <div className="font-bold text-slate-700">
                                                                    {row.point.workedHours ? `${row.point.workedHours} trab.` : "0h trabalhadas"}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500">
                                                                    {row.point.punchCount} batidas registradas
                                                                </div>
                                                                {row.point.absenceDays ? (
                                                                    <div className="text-[10px] text-red-600 font-bold">
                                                                        {row.point.absenceDays} faltas ({row.point.absenceHours || "---"})
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] text-slate-400 italic">Sem registro</span>
                                                        )}
                                                    </td>

                                                    {/* Holerite */}
                                                    <td className="py-3.5 px-4">
                                                        {row.holerite ? (
                                                            <div className="space-y-0.5">
                                                                <div className="font-black text-slate-800">
                                                                    Líq: {fmtCurrency(row.holerite.netSalary)}
                                                                </div>
                                                                {row.wfhNetSalary !== undefined && row.wfhNetSalary > 0 && (
                                                                    <div className="text-[10px] font-semibold text-slate-500">
                                                                        WFH: {fmtCurrency(row.wfhNetSalary)}
                                                                        {row.netDifference !== undefined && row.netDifference !== 0 && (
                                                                            <span className={`ml-1 font-bold ${row.netDifference > 0 ? "text-amber-600" : "text-rose-600"}`}>
                                                                                ({row.netDifference > 0 ? `+${fmtCurrency(row.netDifference)}` : fmtCurrency(row.netDifference)})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                <div className="text-[10px] text-slate-400">
                                                                    Base: {fmtCurrency(row.holerite.baseSalary)} • Bruto: {fmtCurrency(row.holerite.totalEarnings)}
                                                                </div>
                                                                {row.holerite.pageNumber && (
                                                                    <div className="text-[9px] text-slate-400">
                                                                        Página {row.holerite.pageNumber} do PDF
                                                                    </div>
                                                                )}
                                                                {Boolean((row.holerite.absenceDeduction && row.holerite.absenceDeduction > 0) || (row.holerite.absenceDays && row.holerite.absenceDays > 0)) && (
                                                                    <div className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded inline-flex items-center gap-1 border border-rose-200 mt-0.5">
                                                                        Desc. Faltas: {row.holerite.absenceDays || Math.round((row.holerite.absenceDeduction || 0) / ((row.holerite.baseSalary || 1900) / 30))}d ({fmtCurrency(row.holerite.absenceDeduction || 0)})
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] text-slate-400 italic">Sem holerite gerado</span>
                                                        )}
                                                    </td>

                                                    {/* Diagnóstico & Divergências */}
                                                    <td className="py-3.5 px-4">
                                                        <div className="space-y-1">
                                                            {row.discrepancies.map((d, i) => (
                                                                <div 
                                                                    key={i} 
                                                                    className={`text-[10px] font-bold flex items-start gap-1 ${
                                                                        isCritical ? "text-red-700" : "text-amber-700"
                                                                    }`}
                                                                >
                                                                    <span>•</span>
                                                                    <span>{d}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Linha Expandida: Espelho Comparativo Analítico WFH vs Holerite */}
                                                {isExpanded && (
                                                    <tr key={`${row.id}-details`} className="bg-slate-50/80 border-b-2 border-slate-200 animate-in fade-in duration-200">
                                                        <td colSpan={7} className="p-4 sm:p-6">
                                                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
                                                                {/* Header Strip do Colaborador */}
                                                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                                                    <div className="space-y-0.5">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-black text-sm text-slate-900">
                                                                                {row.name}
                                                                            </span>
                                                                            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                                                CPF: {fmtCpf(row.cpf)}
                                                                            </span>
                                                                            {row.folha && (
                                                                                <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                                                                    Matrícula: {row.folha}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-[11px] text-slate-500">
                                                                            Empresa WFH: <span className="font-bold text-slate-700">{row.wfh?.companyName || "---"}</span> • Posto: <span className="font-bold text-slate-700">{row.wfh?.clientName || "---"}</span> • Cargo: <span className="font-bold text-slate-700">{row.wfh?.jobTitle || "---"}</span>
                                                                        </p>
                                                                    </div>

                                                                    <div className="flex items-center gap-2">
                                                                        <Button
                                                                            onClick={() => copyEmployeeDevolutiva(row)}
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="text-xs font-bold gap-1.5 h-8 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100"
                                                                        >
                                                                            <Copy className="w-3.5 h-3.5" /> Copiar Devolutiva
                                                                        </Button>
                                                                    </div>
                                                                </div>

                                                                {/* Net Comparison Summary Pills */}
                                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                                                        <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Previsto WFH (Líquido)</span>
                                                                        <span className="text-base font-black text-slate-800">
                                                                            {fmtCurrency(row.wfhNetSalary || row.wfhBaseSalary)}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-400 block">Base: {fmtCurrency(row.wfhBaseSalary)}</span>
                                                                    </div>

                                                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                                                        <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Processado Holerite (Líquido)</span>
                                                                        <span className="text-base font-black text-slate-800">
                                                                            {fmtCurrency(row.holeriteNetSalary)}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-400 block">Bruto: {fmtCurrency(row.holeriteTotalEarnings)}</span>
                                                                    </div>

                                                                    <div className={`p-3 rounded-xl border ${
                                                                        (row.netDifference === undefined || row.netDifference === 0)
                                                                            ? "bg-emerald-50/60 border-emerald-200"
                                                                            : "bg-rose-50/60 border-rose-200"
                                                                    }`}>
                                                                        <span className="text-[9px] font-black uppercase block tracking-wider text-slate-500">Diferença Líquida</span>
                                                                        <span className={`text-base font-black ${
                                                                            (row.netDifference === undefined || row.netDifference === 0)
                                                                                ? "text-emerald-700"
                                                                                : "text-rose-700"
                                                                        }`}>
                                                                            {row.netDifference !== undefined ? fmtCurrency(row.netDifference) : "R$ 0,00"}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-500 block">
                                                                            {(row.netDifference === undefined || row.netDifference === 0) ? "Valores coincidem" : "Diferença a ajustar"}
                                                                        </span>
                                                                    </div>

                                                                    <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-200">
                                                                        <span className="text-[9px] font-black uppercase text-purple-700 block tracking-wider">Status das Rubricas</span>
                                                                        <span className="text-base font-black text-purple-900">
                                                                            {row.divergentRubricsCount ? `${row.divergentRubricsCount} divergente(s)` : "100% Alinhadas"}
                                                                        </span>
                                                                        <span className="text-[10px] text-purple-600 block">
                                                                            {row.rubricComparisons?.length || 0} rubricas auditadas
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Rubric Comparison Side-by-Side Table */}
                                                                {row.rubricComparisons && row.rubricComparisons.length > 0 ? (
                                                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                                                        <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                                                                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                                                                <Receipt className="w-3.5 h-3.5 text-purple-600" />
                                                                                Espelho Comparativo de Rubricas (WFH vs Holerite)
                                                                            </span>
                                                                            <span className="text-[10px] font-bold text-slate-500">
                                                                                {row.rubricComparisons.filter(c => c.status !== "OK").length} inconsistência(s)
                                                                            </span>
                                                                        </div>
                                                                        <div className="overflow-x-auto">
                                                                            <table className="w-full text-left text-xs border-collapse">
                                                                                <thead>
                                                                                    <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                                                                                        <th className="py-2.5 px-3">Rubrica / Evento</th>
                                                                                        <th className="py-2.5 px-3">Previsto no WFH</th>
                                                                                        <th className="py-2.5 px-3">Processado no Holerite</th>
                                                                                        <th className="py-2.5 px-3">Situação / Dif.</th>
                                                                                        <th className="py-2.5 px-3">Instrução de Correção para a Contabilidade</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100">
                                                                                    {row.rubricComparisons.map((c, cIdx) => {
                                                                                        const isOk = c.status === "OK";
                                                                                        return (
                                                                                            <tr key={cIdx} className={!isOk ? "bg-amber-50/30" : ""}>
                                                                                                <td className="py-2.5 px-3 font-bold text-slate-800">
                                                                                                    {c.rubric}
                                                                                                </td>
                                                                                                <td className="py-2.5 px-3">
                                                                                                    <span className="font-extrabold text-slate-800">
                                                                                                        {fmtCurrency(c.expectedWfh)}
                                                                                                    </span>
                                                                                                    {c.expectedWfhDetail && (
                                                                                                        <span className="block text-[10px] text-slate-500 font-medium">
                                                                                                            {c.expectedWfhDetail}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td className="py-2.5 px-3">
                                                                                                    <span className="font-extrabold text-slate-800">
                                                                                                        {fmtCurrency(c.actualHolerite)}
                                                                                                    </span>
                                                                                                    {c.actualHoleriteDetail && (
                                                                                                        <span className="block text-[10px] text-slate-500 font-medium">
                                                                                                            {c.actualHoleriteDetail}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td className="py-2.5 px-3">
                                                                                                    {isOk ? (
                                                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> OK
                                                                                                        </span>
                                                                                                    ) : c.status === "FALTOU" ? (
                                                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                                                                                            ❌ FALTOU (+{fmtCurrency(c.diff)})
                                                                                                        </span>
                                                                                                    ) : c.status === "INDEVIDO" ? (
                                                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-800 border border-red-200">
                                                                                                            ❌ INDEVIDO ({fmtCurrency(c.diff)})
                                                                                                        </span>
                                                                                                    ) : (
                                                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                                                                                            ⚠️ DIVERGENTE ({c.diff > 0 ? `+${fmtCurrency(c.diff)}` : fmtCurrency(c.diff)})
                                                                                                        </span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td className="py-2.5 px-3">
                                                                                                    {isOk ? (
                                                                                                        <span className="text-[10px] text-slate-400 italic">Conforme fechamento</span>
                                                                                                    ) : (
                                                                                                        <span className="text-[11px] font-bold text-purple-900 bg-purple-50 px-2 py-1 rounded-lg border border-purple-200 block">
                                                                                                            👉 {c.instruction}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </td>
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                                                                        Nenhuma rubrica individual comparável. {row.diagnosticMessage}
                                                                    </div>
                                                                )}

                                                                {/* Raw Holerite Rubrics Toggle (if available) */}
                                                                {row.holerite?.rubrics && row.holerite.rubrics.length > 0 && (
                                                                    <details className="text-xs group">
                                                                        <summary className="cursor-pointer font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 py-1">
                                                                            <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                                                                            Ver todas as {row.holerite.rubrics.length} rubricas brutas do Holerite (PDF)
                                                                        </summary>
                                                                        <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                                                            <table className="w-full text-left text-[11px]">
                                                                                <thead>
                                                                                    <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                                                                                        <th className="py-1.5 px-3">Código</th>
                                                                                        <th className="py-1.5 px-3">Descrição da Rubrica</th>
                                                                                        <th className="py-1.5 px-3">Referência</th>
                                                                                        <th className="py-1.5 px-3">Vencimentos (R$)</th>
                                                                                        <th className="py-1.5 px-3">Descontos (R$)</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-200 bg-white">
                                                                                    {row.holerite.rubrics.map((r, rIdx) => (
                                                                                        <tr key={rIdx}>
                                                                                            <td className="py-1.5 px-3 font-mono text-slate-500">{r.code || "---"}</td>
                                                                                            <td className="py-1.5 px-3 font-medium text-slate-800">{r.description}</td>
                                                                                            <td className="py-1.5 px-3 text-slate-500">{r.reference || "---"}</td>
                                                                                            <td className="py-1.5 px-3 text-emerald-600 font-bold">{r.earnings ? fmtCurrency(r.earnings) : "---"}</td>
                                                                                            <td className="py-1.5 px-3 text-rose-600 font-bold">{r.deductions ? fmtCurrency(r.deductions) : "---"}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </details>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                </Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )}

    {/* ABA 2: CRUZAMENTO WFH x HOLERITES (ESPELHO POR COLABORADOR) */}
    {activeTopTab === "CROSS" && (
        <div className="space-y-6 animate-in fade-in duration-300">
            {holeriteItems.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 md:p-12 border-2 border-dashed border-amber-300 text-center shadow-sm">
                    <input 
                        ref={holeriteInputRef}
                        type="file" 
                        accept=".pdf" 
                        className="hidden" 
                        onChange={e => {
                            if (e.target.files && e.target.files[0]) {
                                handleHoleriteFileChange(e.target.files[0]);
                            }
                        }}
                    />
                    <div className="max-w-md mx-auto flex flex-col items-center">
                        <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 shadow-sm border border-amber-100">
                            {isProcessingHolerite ? (
                                <RefreshCw className="w-8 h-8 animate-spin" />
                            ) : (
                                <UploadCloud className="w-8 h-8" />
                            )}
                        </div>
                        <h3 className="text-lg md:text-xl font-black text-slate-900 mb-1">
                            Carregue os Holerites em PDF para Cruzar
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
                            O sistema irá comparar imediatamente cada rubrica apurada e fechada no WFH com o contracheque emitido pela contabilidade, exibindo o espelho com as divergências e o que precisa ser corrigido.
                        </p>
                        <Button
                            onClick={() => holeriteInputRef.current?.click()}
                            disabled={isProcessingHolerite}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-black text-xs gap-2 rounded-2xl shadow-lg h-11 px-6 cursor-pointer"
                        >
                            {isProcessingHolerite ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Lendo holerites e cruzando com o sistema...</span>
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="w-4 h-4" />
                                    <span>Selecionar Arquivo PDF de Holerites</span>
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Header Banner com KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div 
                            onClick={() => setCrossFilter("ALL")}
                            className={`p-4 rounded-3xl border cursor-pointer transition-all ${
                                crossFilter === "ALL" ? "bg-slate-900 text-white shadow-md" : "bg-white border-slate-200 hover:shadow-sm"
                            }`}
                        >
                            <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">Total Auditados</span>
                            <span className="text-2xl font-black">{crossBaseRows.length}</span>
                            <span className="text-[10px] block opacity-70 mt-0.5">Holerites extraídos</span>
                        </div>

                        <div 
                            onClick={() => setCrossFilter("DIVERGENT")}
                            className={`p-4 rounded-3xl border cursor-pointer transition-all ${
                                crossFilter === "DIVERGENT" ? "bg-amber-500 text-white shadow-md" : "bg-white border-amber-200 hover:shadow-sm"
                            }`}
                        >
                            <span className="text-[10px] font-black uppercase tracking-wider block opacity-90">Com Divergência</span>
                            <span className="text-2xl font-black">{crossDivergentCount}</span>
                            <span className="text-[10px] block opacity-90 mt-0.5">{crossRubricErrors} rubrica(s) a corrigir</span>
                        </div>

                        <div 
                            onClick={() => setCrossFilter("OK")}
                            className={`p-4 rounded-3xl border cursor-pointer transition-all ${
                                crossFilter === "OK" ? "bg-emerald-600 text-white shadow-md" : "bg-white border-emerald-200 hover:shadow-sm"
                            }`}
                        >
                            <span className="text-[10px] font-black uppercase tracking-wider block opacity-90">100% Alinhados</span>
                            <span className="text-2xl font-black">{crossOkCount}</span>
                            <span className="text-[10px] block opacity-90 mt-0.5">Nenhum ajuste necessário</span>
                        </div>

                        <div 
                            onClick={() => setCrossFilter("NO_WFH")}
                            className={`p-4 rounded-3xl border cursor-pointer transition-all ${
                                crossFilter === "NO_WFH" ? "bg-red-600 text-white shadow-md" : "bg-white border-red-200 hover:shadow-sm"
                            }`}
                        >
                            <span className="text-[10px] font-black uppercase tracking-wider block opacity-90">Não no WFH</span>
                            <span className="text-2xl font-black">{crossNoWfhCount}</span>
                            <span className="text-[10px] block opacity-90 mt-0.5">Pessoas sem cadastro</span>
                        </div>

                        <div className="p-4 rounded-3xl bg-slate-100 border border-slate-200">
                            <span className="text-[10px] font-black uppercase tracking-wider block text-slate-500">Diferença Acumulada</span>
                            <span className={`text-xl font-black ${Math.abs(crossTotalDiff) < 0.01 ? "text-emerald-700" : "text-rose-600"}`}>
                                {fmtCurrency(crossTotalDiff)}
                            </span>
                            <span className="text-[10px] block text-slate-400 mt-0.5">Impacto no pagamento</span>
                        </div>
                    </div>

                    {/* Barra de Filtros & Busca */}
                    <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            <button
                                onClick={() => setCrossFilter("DIVERGENT")}
                                className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                                    crossFilter === "DIVERGENT"
                                        ? "bg-amber-600 text-white shadow-sm"
                                        : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                                }`}
                            >
                                ⚠️ Com Divergência ({crossDivergentCount})
                            </button>
                            <button
                                onClick={() => setCrossFilter("ALL")}
                                className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                                    crossFilter === "ALL"
                                        ? "bg-slate-900 text-white shadow-sm"
                                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                            >
                                Todos ({crossBaseRows.length})
                            </button>
                            <button
                                onClick={() => setCrossFilter("OK")}
                                className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                                    crossFilter === "OK"
                                        ? "bg-emerald-600 text-white shadow-sm"
                                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                            >
                                ✅ 100% OK ({crossOkCount})
                            </button>
                            {crossNoWfhCount > 0 && (
                                <button
                                    onClick={() => setCrossFilter("NO_WFH")}
                                    className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                                        crossFilter === "NO_WFH"
                                            ? "bg-red-600 text-white shadow-sm"
                                            : "bg-red-50 text-red-700 hover:bg-red-100"
                                    }`}
                                >
                                    🚨 Não no WFH ({crossNoWfhCount})
                                </button>
                            )}
                        </div>

                        <div className="relative w-full md:w-80">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <Input 
                                placeholder="Buscar colaborador por nome ou CPF..." 
                                value={crossSearch}
                                onChange={e => setCrossSearch(e.target.value)}
                                className="pl-9 h-10 rounded-2xl border-slate-200 text-xs"
                            />
                        </div>
                    </div>

                    {/* Lista dos Espelhos por Colaborador (Modelo Exato do Print) */}
                    <div className="space-y-5">
                        {crossRows.length === 0 ? (
                            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400 space-y-2">
                                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/60" />
                                <p className="font-bold text-slate-700 text-sm">Nenhum colaborador encontrado para este filtro.</p>
                            </div>
                        ) : (
                            crossRows.map((r, rIdx) => {
                                const divergentCount = r.divergentRubricsCount || 0;
                                const isMissingWfh = isNotInWfh(r);
                                const netDiff = r.netDifference || 0;

                                return (
                                    <div 
                                        key={r.id} 
                                        className="rounded-xl border border-zinc-700 bg-[#12141a] text-zinc-100 font-mono shadow-xl overflow-hidden transition-all"
                                    >
                                        {/* Cabeçalho do Card (Exatamente no modelo do print) */}
                                        <div className="px-4 py-3 border-b border-zinc-700 flex flex-wrap items-center justify-between gap-3 text-xs bg-zinc-950/70">
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                                                <div>
                                                    <span className="text-zinc-400 font-normal">COLABORADOR: </span>
                                                    <span className="font-bold text-zinc-100 uppercase tracking-wide">{r.name}</span>
                                                </div>
                                                <span className="text-zinc-600">|</span>
                                                <div>
                                                    <span className="text-zinc-400 font-normal">CPF: </span>
                                                    <span className="font-medium text-zinc-200">{fmtCpf(r.cpf)}</span>
                                                </div>
                                                <span className="text-zinc-600">|</span>
                                                <div>
                                                    <span className="text-zinc-400 font-normal">CLIENTE / CONTRATO: </span>
                                                    <span className="font-bold text-cyan-300 uppercase">
                                                        {r.clientName && r.clientName !== "Interno / Rotativo" 
                                                            ? r.clientName 
                                                            : (r.wfh?.clientName || "Interno / Rotativo")}
                                                    </span>
                                                </div>
                                                <span className="text-zinc-600">|</span>
                                                <div>
                                                    <span className="text-zinc-400 font-normal">STATUS: </span>
                                                    {isMissingWfh ? (
                                                        <span className="text-red-400 font-bold">🚨 NÃO CONSTA NO WFH</span>
                                                    ) : divergentCount > 0 ? (
                                                        <span className="text-amber-400 font-bold">⚠️ {divergentCount} DIVERGÊNCIA{divergentCount > 1 ? "S" : ""}</span>
                                                    ) : (
                                                        <span className="text-emerald-400 font-bold">✅ 100% OK</span>
                                                    )}
                                                </div>
                                            </div>

                                            <Button
                                                onClick={() => copyEmployeeDevolutiva(r)}
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 px-2.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 text-[11px] font-mono gap-1 cursor-pointer border border-zinc-700/60"
                                                title="Copiar texto da devolutiva"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">Copiar Devolutiva</span>
                                            </Button>
                                        </div>

                                        {/* Tabela do Espelho: 4 Colunas idênticas ao modelo anexo */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="border-b border-zinc-700 text-zinc-400 text-[11px] uppercase tracking-wider bg-zinc-900/60">
                                                        <th className="py-2.5 px-4 font-bold w-[34%] border-r border-zinc-800">RUBRICA / CONCEITO</th>
                                                        <th className="py-2.5 px-4 font-bold w-[26%] border-r border-zinc-800">PREVISTO NO WFH (SISTEMA)</th>
                                                        <th className="py-2.5 px-4 font-bold w-[26%] border-r border-zinc-800">PROCESSADO NO HOLERITE</th>
                                                        <th className="py-2.5 px-4 font-bold w-[14%]">SITUAÇÃO</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-800/80">
                                                    {r.rubricComparisons && r.rubricComparisons.length > 0 ? (
                                                        r.rubricComparisons.map((c, cIdx) => {
                                                            const isOk = c.status === "OK";
                                                            return (
                                                                <tr 
                                                                    key={cIdx} 
                                                                    className={`transition-colors ${
                                                                        !isOk ? "bg-amber-950/20 hover:bg-amber-950/30" : "hover:bg-zinc-900/40"
                                                                    }`}
                                                                >
                                                                    <td className="py-2.5 px-4 font-medium text-zinc-200 border-r border-zinc-800">
                                                                        {c.rubric}
                                                                    </td>
                                                                    <td className="py-2.5 px-4 text-zinc-300 border-r border-zinc-800">
                                                                        {c.expectedWfhDetail || fmtCurrency(c.expectedWfh)}
                                                                    </td>
                                                                    <td className="py-2.5 px-4 text-zinc-300 border-r border-zinc-800">
                                                                        {c.actualHoleriteDetail || fmtCurrency(c.actualHolerite)}
                                                                    </td>
                                                                    <td className="py-2.5 px-4">
                                                                        {isOk ? (
                                                                            <span className="text-emerald-400 font-bold">✅ OK</span>
                                                                        ) : c.status === "INDEVIDO" ? (
                                                                            <span className="text-red-400 font-bold">❌ INDEVIDO</span>
                                                                        ) : c.status === "FALTOU" ? (
                                                                            <span className="text-rose-400 font-bold">❌ FALTOU</span>
                                                                        ) : (
                                                                            <span className="text-amber-400 font-bold">⚠️ DIVERGENTE</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={4} className="py-3 px-4 text-zinc-500 italic">
                                                                {isMissingWfh 
                                                                    ? "⚠️ Colaborador não cadastrado no WFH com este CPF/Nome." 
                                                                    : "Nenhuma rubrica prevista no WFH para este colaborador."}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>

                                                {/* 3 Linhas Finais de Totais: Proventos, Descontos, Líquido (Exatamente como no print) */}
                                                <tfoot>
                                                    <tr className="border-t-2 border-zinc-700 bg-zinc-900/40 text-zinc-300">
                                                        <td className="py-2 px-4 uppercase font-bold border-r border-zinc-800">TOTAL DE PROVENTOS</td>
                                                        <td className="py-2 px-4 font-bold border-r border-zinc-800">{fmtCurrency(r.wfhGrossSalary || r.wfhBaseSalary || 0)}</td>
                                                        <td className="py-2 px-4 font-bold border-r border-zinc-800">{fmtCurrency(r.holeriteTotalEarnings || 0)}</td>
                                                        <td className="py-2 px-4"></td>
                                                    </tr>
                                                    <tr className="border-t border-zinc-800 bg-zinc-900/40 text-zinc-300">
                                                        <td className="py-2 px-4 uppercase font-bold border-r border-zinc-800">TOTAL DE DESCONTOS</td>
                                                        <td className="py-2 px-4 font-bold border-r border-zinc-800">{fmtCurrency(r.wfhTotalDeductions || 0)}</td>
                                                        <td className="py-2 px-4 font-bold border-r border-zinc-800">{fmtCurrency(r.holeriteTotalDeductions || 0)}</td>
                                                        <td className="py-2 px-4"></td>
                                                    </tr>
                                                    <tr className="border-t border-zinc-700 bg-zinc-900/90 text-zinc-100 font-bold">
                                                        <td className="py-2.5 px-4 uppercase border-r border-zinc-800 text-amber-300">TOTAL LÍQUIDO</td>
                                                        <td className="py-2.5 px-4 text-sm border-r border-zinc-800">{fmtCurrency(r.wfhNetSalary || 0)}</td>
                                                        <td className="py-2.5 px-4 text-sm border-r border-zinc-800">{fmtCurrency(r.holeriteNetSalary || 0)}</td>
                                                        <td className="py-2.5 px-4">
                                                            {Math.abs(netDiff) < 0.01 ? (
                                                                <span className="text-emerald-400 font-bold">✅ OK</span>
                                                            ) : (
                                                                <span className="text-rose-400 font-bold">
                                                                    🔴 DIF {netDiff > 0 ? `+${Math.round(netDiff)}` : Math.round(netDiff)}
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>

                                        {/* Chamada de Instrução de Correção para a Contabilidade (se houver divergência) */}
                                        {divergentCount > 0 && (
                                            <div className="bg-amber-950/30 border-t border-amber-900/50 px-4 py-2.5 text-xs text-amber-200 flex items-start gap-2">
                                                <span className="text-amber-400 font-bold whitespace-nowrap">👉 ORIENTAÇÃO:</span>
                                                <div className="space-y-1">
                                                    {(r.rubricComparisons || []).filter(c => c.status !== "OK").map((c, i) => (
                                                        <div key={i} className="text-amber-200/90">
                                                            {c.instruction}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    )}

    {/* ABA 3: CONFERÊNCIA DE FOLHA LÍQUIDA */}
    {activeTopTab === "LIQUIDS" && (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Banner / Slot de Upload para Holerites */}
            {holeriteItems.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 md:p-12 border-2 border-dashed border-emerald-300 text-center shadow-sm">
                    <input 
                        ref={holeriteInputRef}
                        type="file" 
                        accept=".pdf" 
                        className="hidden" 
                        onChange={e => {
                            if (e.target.files && e.target.files[0]) {
                                handleHoleriteFileChange(e.target.files[0]);
                            }
                        }}
                    />
                    <div className="max-w-md mx-auto flex flex-col items-center">
                        <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 shadow-sm border border-emerald-100">
                            {isProcessingHolerite ? (
                                <RefreshCw className="w-8 h-8 animate-spin" />
                            ) : (
                                <UploadCloud className="w-8 h-8" />
                            )}
                        </div>
                        <h3 className="text-lg md:text-xl font-black text-slate-900 mb-1">
                            Carregue o PDF de Holerites da Folha
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
                            Faça o upload do PDF consolidado de contracheques emitido pela contabilidade. O sistema irá extrair automaticamente os valores líquidos de cada colaborador, checar o status cadastral no WFH e totalizar a folha líquida a pagar.
                        </p>
                        <Button
                            onClick={() => holeriteInputRef.current?.click()}
                            disabled={isProcessingHolerite}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs gap-2 rounded-2xl shadow-lg h-11 px-6 cursor-pointer"
                        >
                            {isProcessingHolerite ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Lendo contracheques...</span>
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="w-4 h-4" />
                                    <span>Selecionar Arquivo PDF de Holerites</span>
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-800 truncate max-w-sm">
                                    {holeriteFile?.name || "Lote de Holerites em PDF"}
                                </span>
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                                    {holeriteItems.length} contracheques extraídos
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                {isAuditing ? "Cruzando com a base de colaboradores do WFH..." : "Contracheques vinculados à base de colaboradores ativos e histórico."}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input 
                            ref={holeriteInputRef}
                            type="file" 
                            accept=".pdf" 
                            className="hidden" 
                            onChange={e => {
                                if (e.target.files && e.target.files[0]) {
                                    handleHoleriteFileChange(e.target.files[0]);
                                }
                            }}
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => holeriteInputRef.current?.click()}
                            className="text-xs font-bold text-slate-600 hover:text-slate-900 border-slate-200 rounded-xl cursor-pointer gap-1.5"
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> Trocar PDF de Holerites
                        </Button>
                    </div>
                </div>
            )}

            {/* Totais & Cards de Métricas da Folha Líquida */}
            {liquidSourceRows.length > 0 && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Card 1: TOTAL LÍQUIDO DA FOLHA (Destaque Principal) */}
                        <div className="rounded-3xl p-6 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-xl relative overflow-hidden">
                            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-200">
                                    Total Líquido da Folha
                                </span>
                                <span className="p-2 rounded-xl bg-white/20 text-white">
                                    <DollarSign className="w-4 h-4" />
                                </span>
                            </div>
                            <div className="text-3xl lg:text-4xl font-black tracking-tight mt-1">
                                {fmtCurrency(liquidTotalNet)}
                            </div>
                            <div className="text-[11px] text-emerald-100 font-semibold mt-2 flex items-center justify-between">
                                <span>{liquidSourceRows.length} pagamentos a realizar</span>
                                <span className="bg-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">100% calculado</span>
                            </div>
                        </div>

                        {/* Card 2: Proventos Brutos */}
                        <div className="rounded-3xl p-6 bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                        Total Proventos (Bruto)
                                    </span>
                                    <span className="p-2 rounded-xl bg-slate-100 text-slate-600">
                                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                                    </span>
                                </div>
                                <div className="text-2xl font-black text-slate-800">
                                    {fmtCurrency(liquidTotalEarnings)}
                                </div>
                            </div>
                            <div className="text-[11px] text-slate-400 font-medium mt-2">
                                Vencimentos contratuais somados
                            </div>
                        </div>

                        {/* Card 3: Descontos Totais */}
                        <div className="rounded-3xl p-6 bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                        Total Descontos em Folha
                                    </span>
                                    <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
                                        <AlertCircle className="w-4 h-4" />
                                    </span>
                                </div>
                                <div className="text-2xl font-black text-rose-600">
                                    {fmtCurrency(liquidTotalDeductions)}
                                </div>
                            </div>
                            <div className="text-[11px] text-rose-500 font-medium mt-2">
                                {liquidTotalAbsenceDeductions > 0 ? `Desc. Faltas: ${fmtCurrency(liquidTotalAbsenceDeductions)}` : "INSS, IRRF, benefícios e faltas"}
                            </div>
                        </div>

                        {/* Card 4: Média Líquida por Colaborador */}
                        <div className="rounded-3xl p-6 bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                        Média Líquida / Pessoa
                                    </span>
                                    <span className="p-2 rounded-xl bg-slate-100 text-slate-600">
                                        <Users className="w-4 h-4" />
                                    </span>
                                </div>
                                <div className="text-2xl font-black text-slate-800">
                                    {fmtCurrency(liquidAvgNet)}
                                </div>
                            </div>
                            <div className="text-[11px] text-slate-400 font-medium mt-2">
                                Salário base médio: {fmtCurrency(liquidAvgBase)}
                            </div>
                        </div>
                    </div>

                    {/* Filtros por Status de Colaborador */}
                    <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                            <button
                                onClick={() => setLiquidStatusFilter("ALL")}
                                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                                    liquidStatusFilter === "ALL" 
                                        ? "bg-slate-900 text-white shadow-sm" 
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                            >
                                Todos ({liquidStatusCounts.all})
                            </button>
                            <button
                                onClick={() => setLiquidStatusFilter("ATIVO")}
                                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    liquidStatusFilter === "ATIVO" 
                                        ? "bg-emerald-600 text-white shadow-sm" 
                                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Ativos ({liquidStatusCounts.ativos})
                            </button>
                            <button
                                onClick={() => setLiquidStatusFilter("FERIAS")}
                                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    liquidStatusFilter === "FERIAS" 
                                        ? "bg-blue-600 text-white shadow-sm" 
                                        : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                                }`}
                            >
                                Férias ({liquidStatusCounts.ferias})
                            </button>
                            <button
                                onClick={() => setLiquidStatusFilter("AFASTADO")}
                                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    liquidStatusFilter === "AFASTADO" 
                                        ? "bg-amber-600 text-white shadow-sm" 
                                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                }`}
                            >
                                Afastados INSS ({liquidStatusCounts.afastados})
                            </button>
                            <button
                                onClick={() => setLiquidStatusFilter("DESLIGADO")}
                                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    liquidStatusFilter === "DESLIGADO" 
                                        ? "bg-rose-600 text-white shadow-sm" 
                                        : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                                }`}
                            >
                                Desligados ({liquidStatusCounts.desligados})
                            </button>
                            {liquidStatusCounts.naoCadastrados > 0 && (
                                <button
                                    onClick={() => setLiquidStatusFilter("NAO_CADASTRADO")}
                                    className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                        liquidStatusFilter === "NAO_CADASTRADO" 
                                            ? "bg-purple-600 text-white shadow-sm" 
                                            : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                                    }`}
                                >
                                    Não Cadastrados ({liquidStatusCounts.naoCadastrados})
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2.5 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <Input 
                                    placeholder="Buscar por colaborador, CPF ou posto..."
                                    value={liquidSearchTerm}
                                    onChange={e => setLiquidSearchTerm(e.target.value)}
                                    className="pl-9 h-9 text-xs rounded-2xl border-slate-200"
                                />
                            </div>

                            <Select value={liquidSort} onValueChange={v => setLiquidSort(v as any)}>
                                <SelectTrigger className="h-9 border-slate-200 text-slate-700 font-bold text-xs rounded-2xl w-[170px] cursor-pointer">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="text-xs">
                                    <SelectItem value="NET_DESC">Maior Líquido primeiro</SelectItem>
                                    <SelectItem value="NET_ASC">Menor Líquido primeiro</SelectItem>
                                    <SelectItem value="NAME_ASC">Nome (A-Z)</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button 
                                onClick={exportLiquidPayrollToExcel}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 rounded-2xl shadow-sm h-9 px-3.5 cursor-pointer"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar XLSX
                            </Button>
                        </div>
                    </div>

                    {/* Tabela de Colaboradores: Valores Líquidos & Composição */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-emerald-600" />
                                <h3 className="text-sm font-black text-slate-800">
                                    Relação de Pagamentos Líquidos por Colaborador
                                </h3>
                                <span className="text-[11px] text-slate-400 font-semibold">
                                    ({filteredLiquidRows.length} colaboradores listados)
                                </span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-500">
                                Clique em qualquer linha ou em &quot;Ver Composição&quot; para abrir os proventos e descontos detalhados
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="py-3 px-3 w-14 text-center">Pág</th>
                                        <th className="py-3 px-4">Colaborador</th>
                                        <th className="py-3 px-4">Alocação WFH</th>
                                        <th className="py-3 px-3 text-center">Status no WFH</th>
                                        <th className="py-3 px-4 text-right">Salário Base</th>
                                        <th className="py-3 px-4 text-right bg-emerald-50/60 text-emerald-900 font-black">VALOR LÍQUIDO A PAGAR</th>
                                        <th className="py-3 px-4 text-center w-36">Composição</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredLiquidRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-slate-400">
                                                <div className="flex flex-col items-center gap-2">
                                                    <AlertCircle className="w-8 h-8 text-slate-300" />
                                                    <span className="text-xs font-bold text-slate-600">Nenhum colaborador encontrado com os filtros selecionados.</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredLiquidRows.map((row, index) => {
                                            const st = getCollaboratorStatus(row);
                                            return (
                                                <tr 
                                                    key={row.id || index}
                                                    onClick={() => {
                                                        setSelectedCompositionRow(row);
                                                        setIsCompositionOpen(true);
                                                    }}
                                                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                                >
                                                    {/* Pág PDF */}
                                                    <td className="py-3.5 px-3 text-center">
                                                        <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                                            #{row.holerite?.pageNumber ?? index + 1}
                                                        </span>
                                                    </td>

                                                    {/* Nome & CPF */}
                                                    <td className="py-3.5 px-4">
                                                        <div className="font-extrabold text-slate-900 text-xs group-hover:text-purple-700 transition-colors">
                                                            {row.name}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                            CPF: {fmtCpf(row.cpf)} {row.folha ? `• Folha: ${row.folha}` : ""}
                                                        </div>
                                                    </td>

                                                    {/* Alocação WFH */}
                                                    <td className="py-3.5 px-4">
                                                        <div className="font-bold text-slate-700 truncate max-w-[200px]">
                                                            {row.wfh?.clientName || "Não vinculado a posto"}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                                                            {row.wfh?.postoName || row.wfh?.jobTitle || row.holerite?.role || "Cargo não informado"}
                                                        </div>
                                                    </td>

                                                    {/* Status WFH */}
                                                    <td className="py-3.5 px-3 text-center">
                                                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${st.badgeClass}`}>
                                                            {st.label}
                                                        </span>
                                                    </td>

                                                    {/* Salário Base */}
                                                    <td className="py-3.5 px-4 text-right font-semibold text-slate-500">
                                                        {fmtCurrency(row.holeriteBaseSalary || row.wfhBaseSalary)}
                                                    </td>

                                                    {/* VALOR LÍQUIDO A PAGAR */}
                                                    <td className="py-3.5 px-4 text-right bg-emerald-50/60">
                                                        <span className="inline-block bg-emerald-100 text-emerald-950 border border-emerald-300 px-3 py-1 rounded-xl font-black text-sm shadow-xs">
                                                            {fmtCurrency(row.holeriteNetSalary)}
                                                        </span>
                                                    </td>

                                                    {/* Ação Composição */}
                                                    <td className="py-3.5 px-4 text-center" onClick={e => e.stopPropagation()}>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedCompositionRow(row);
                                                                setIsCompositionOpen(true);
                                                            }}
                                                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold h-8 px-3 rounded-xl border border-purple-200 cursor-pointer gap-1 transition-all"
                                                        >
                                                            <Receipt className="w-3.5 h-3.5" />
                                                            <span>Ver Composição</span>
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    )}

    {/* Modal de Composição de Folha e Rubricas */}
    <Dialog open={isCompositionOpen} onOpenChange={setIsCompositionOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl">
            {selectedCompositionRow && (
                <div className="space-y-6">
                    <DialogHeader>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                    {selectedCompositionRow.holerite?.pageNumber ? `Página ${selectedCompositionRow.holerite.pageNumber} do Holerite` : "Recibo de Pagamento"}
                                </span>
                                <DialogTitle className="text-xl font-black text-slate-900 mt-1">
                                    {selectedCompositionRow.name}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-slate-500 font-medium">
                                    CPF: {fmtCpf(selectedCompositionRow.cpf)} • Matrícula/Código: {selectedCompositionRow.folha || "---"} • {selectedCompositionRow.wfh?.companyName || selectedCompositionRow.holerite?.companyName || "Empresa Contábil"}
                                </DialogDescription>
                            </div>
                            {(() => {
                                const st = getCollaboratorStatus(selectedCompositionRow);
                                return (
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${st.badgeClass}`}>
                                        {st.label}
                                    </span>
                                );
                            })()}
                        </div>
                    </DialogHeader>

                    {/* Alocação WFH */}
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex flex-wrap items-center justify-between text-xs text-slate-700">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cliente / Posto Alocado:</span>
                            <span className="font-extrabold text-slate-800">
                                {selectedCompositionRow.wfh?.clientName || "NÃO CONSTA NO SISTEMA WFH"} — {selectedCompositionRow.wfh?.postoName || selectedCompositionRow.wfh?.jobTitle || selectedCompositionRow.holerite?.role || "Cargo não informado"}
                            </span>
                        </div>
                        {selectedCompositionRow.holerite?.workedDays !== undefined && (
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dias Trabalhados:</span>
                                <span className="font-extrabold text-slate-800">{selectedCompositionRow.holerite.workedDays} dias</span>
                            </div>
                        )}
                    </div>

                    {/* Resumo Financeiro */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-sm">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Salário Base</span>
                            <span className="text-sm font-black text-slate-700">
                                {fmtCurrency(selectedCompositionRow.holeriteBaseSalary || selectedCompositionRow.wfhBaseSalary)}
                            </span>
                        </div>
                        <div className="bg-emerald-50/50 rounded-2xl p-3 border border-emerald-100 shadow-sm">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">(+) Total Proventos</span>
                            <span className="text-sm font-black text-emerald-700">
                                {fmtCurrency(selectedCompositionRow.holeriteTotalEarnings)}
                            </span>
                        </div>
                        <div className="bg-rose-50/50 rounded-2xl p-3 border border-rose-100 shadow-sm">
                            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">(-) Total Descontos</span>
                            <span className="text-sm font-black text-rose-700">
                                {fmtCurrency(selectedCompositionRow.holeriteTotalDeductions)}
                            </span>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-3 text-white shadow-md">
                            <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">(=) LÍQUIDO A PAGAR</span>
                            <span className="text-base font-black">
                                {fmtCurrency(selectedCompositionRow.holeriteNetSalary)}
                            </span>
                        </div>
                    </div>

                    {/* Tabela de Rubricas */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <Receipt className="w-3.5 h-3.5 text-purple-600" /> Detalhamento de Rubricas & Eventos do Holerite
                            </h4>
                            {selectedCompositionRow.holerite?.rubrics && selectedCompositionRow.holerite.rubrics.length > 0 && (
                                <span className="text-[10px] font-bold text-slate-400">
                                    {selectedCompositionRow.holerite.rubrics.length} eventos identificados
                                </span>
                            )}
                        </div>

                        {selectedCompositionRow.holerite?.rubrics && selectedCompositionRow.holerite.rubrics.length > 0 ? (
                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase">
                                            <th className="py-2.5 px-3">Cód.</th>
                                            <th className="py-2.5 px-3">Descrição / Rubrica</th>
                                            <th className="py-2.5 px-3 text-center">Ref.</th>
                                            <th className="py-2.5 px-3 text-right">Proventos (R$)</th>
                                            <th className="py-2.5 px-3 text-right">Descontos (R$)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                        {selectedCompositionRow.holerite.rubrics.map((rubric, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-2 px-3 text-[11px] font-mono text-slate-400">
                                                    {rubric.code || "---"}
                                                </td>
                                                <td className="py-2 px-3 font-semibold text-slate-800">
                                                    {rubric.description}
                                                </td>
                                                <td className="py-2 px-3 text-center text-[11px] text-slate-500 font-mono">
                                                    {rubric.reference || "---"}
                                                </td>
                                                <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                                    {rubric.earnings ? fmtCurrency(rubric.earnings) : "-"}
                                                </td>
                                                <td className="py-2 px-3 text-right font-bold text-rose-600">
                                                    {rubric.deductions ? fmtCurrency(rubric.deductions) : "-"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-100/80 border-t-2 border-slate-200 font-black text-xs text-slate-800">
                                            <td colSpan={3} className="py-2.5 px-3 text-right uppercase tracking-wider text-[10px] text-slate-500">
                                                Subtotais:
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-emerald-700">
                                                {fmtCurrency(selectedCompositionRow.holeriteTotalEarnings)}
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-rose-600">
                                                {fmtCurrency(selectedCompositionRow.holeriteTotalDeductions)}
                                            </td>
                                        </tr>
                                        <tr className="bg-emerald-600 text-white font-black text-sm">
                                            <td colSpan={3} className="py-3 px-3 uppercase tracking-wider text-xs">
                                                VALOR LÍQUIDO A RECEBER:
                                            </td>
                                            <td colSpan={2} className="py-3 px-3 text-right text-base">
                                                {fmtCurrency(selectedCompositionRow.holeriteNetSalary)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="bg-slate-50 rounded-2xl p-5 border border-dashed border-slate-300 text-center space-y-2">
                                <p className="text-xs font-semibold text-slate-600">
                                    As rubricas detalhadas deste recibo foram consolidadas diretamente no rodapé financeiro do contracheque.
                                </p>
                                <div className="flex justify-center items-center gap-4 text-xs font-bold pt-2">
                                    <span className="text-emerald-700">Proventos: {fmtCurrency(selectedCompositionRow.holeriteTotalEarnings)}</span>
                                    <span className="text-slate-300">|</span>
                                    <span className="text-rose-600">Descontos: {fmtCurrency(selectedCompositionRow.holeriteTotalDeductions)}</span>
                                    <span className="text-slate-300">|</span>
                                    <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg font-black">
                                        Líquido: {fmtCurrency(selectedCompositionRow.holeriteNetSalary)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </DialogContent>
    </Dialog>

    {/* Modal do Dossiê Devolutiva Contabilidade (Visualização e Impressão/PDF) */}
    <Dialog open={isDevolutivaModalOpen} onOpenChange={setIsDevolutivaModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6 rounded-3xl print:p-0 print:max-w-none print:shadow-none">
            <DialogHeader className="print:hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-200">
                            Devolutiva Oficial para Contabilidade
                        </span>
                        <DialogTitle className="text-xl font-black text-slate-900 mt-1 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-purple-600" />
                            Dossiê de Divergências da Folha ({String(selectedMonth).padStart(2, "0")}/{selectedYear})
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 font-medium">
                            Instruções detalhadas para correção de rubricas, proventos e descontos indevidos.
                        </DialogDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => window.print()}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5 rounded-xl h-9 px-3"
                        >
                            <Printer className="w-4 h-4" /> Imprimir / PDF
                        </Button>
                        <Button
                            onClick={copyAllDevolutivas}
                            variant="outline"
                            className="font-bold text-xs gap-1.5 rounded-xl h-9 px-3 text-slate-700 hover:bg-slate-100"
                        >
                            <Copy className="w-4 h-4" /> Copiar Todas
                        </Button>
                    </div>
                </div>
            </DialogHeader>

            {/* Printable Content */}
            <div className="space-y-6 pt-2">
                {/* Printable Header */}
                <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-4">
                    <h1 className="text-2xl font-black text-slate-900">RELATÓRIO DE DEVOLUTIVA - AUDITORIA DE FOLHA</h1>
                    <p className="text-xs text-slate-600">
                        Competência: {String(selectedMonth).padStart(2, "0")}/{selectedYear} • Emissão: {new Date().toLocaleDateString("pt-BR")}
                    </p>
                </div>

                {/* Metrics cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200">
                        <span className="text-[10px] font-black uppercase text-purple-700 block">Colaboradores com Divergência</span>
                        <span className="text-2xl font-black text-purple-900">
                            {rowsForCompany.filter(r => (r.divergentRubricsCount && r.divergentRubricsCount > 0) || r.status !== "ALIGNED").length}
                        </span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
                        <span className="text-[10px] font-black uppercase text-rose-700 block">Rubricas Inconsistentes</span>
                        <span className="text-2xl font-black text-rose-900">
                            {rowsForCompany.reduce((acc, r) => acc + (r.divergentRubricsCount || 0), 0)}
                        </span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                        <span className="text-[10px] font-black uppercase text-amber-700 block">Diferença Líquida Acumulada</span>
                        <span className="text-2xl font-black text-amber-900">
                            {fmtCurrency(rowsForCompany.reduce((acc, r) => acc + (r.netDifference || 0), 0))}
                        </span>
                    </div>
                </div>

                {/* List of Divergent Collaborators */}
                <div className="space-y-4">
                    {rowsForCompany.filter(r => (r.divergentRubricsCount && r.divergentRubricsCount > 0) || r.status !== "ALIGNED").length === 0 ? (
                        <div className="text-center py-10 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800">
                            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600 mb-2" />
                            <p className="font-black text-sm">Nenhuma divergência identificada na folha auditada!</p>
                            <p className="text-xs text-emerald-700 mt-1">Todos os holerites conferem 100% com a base cadastral e apuração de ponto.</p>
                        </div>
                    ) : (
                        rowsForCompany
                            .filter(r => (r.divergentRubricsCount && r.divergentRubricsCount > 0) || r.status !== "ALIGNED")
                            .map((r, idx) => {
                                const divergent = (r.rubricComparisons || []).filter(c => c.status !== "OK");
                                return (
                                    <div key={r.id} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3 break-inside-avoid">
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                            <div>
                                                <span className="font-black text-sm text-slate-900">{idx + 1}. {r.name}</span>
                                                <div className="text-[11px] text-slate-500 font-medium">
                                                    CPF: <span className="font-mono">{fmtCpf(r.cpf)}</span> • {r.wfh?.companyName || r.companyName || "---"} • {r.wfh?.jobTitle || r.postoName || "---"}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-right text-[11px]">
                                                    <span className="text-slate-400 block text-[9px] uppercase font-bold">WFH x Holerite</span>
                                                    <span className="font-bold text-slate-800">{fmtCurrency(r.wfhNetSalary)}</span>
                                                    <span className="text-slate-400 mx-1">vs</span>
                                                    <span className="font-bold text-slate-800">{fmtCurrency(r.holeriteNetSalary)}</span>
                                                </div>
                                                <Button
                                                    onClick={() => copyEmployeeDevolutiva(r)}
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 px-2 text-slate-500 hover:text-slate-900 print:hidden"
                                                    title="Copiar texto para WhatsApp"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>

                                        {divergent.length > 0 ? (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-xs border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                                                            <th className="py-2 px-3">Rubrica</th>
                                                            <th className="py-2 px-3">Previsto WFH</th>
                                                            <th className="py-2 px-3">Processado Holerite</th>
                                                            <th className="py-2 px-3">Situação</th>
                                                            <th className="py-2 px-3">Instrução de Correção</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {divergent.map((d, dIdx) => (
                                                            <tr key={dIdx} className="hover:bg-slate-50/50">
                                                                <td className="py-2.5 px-3 font-bold text-slate-800">{d.rubric}</td>
                                                                <td className="py-2.5 px-3">
                                                                    <div className="font-bold text-emerald-700">{fmtCurrency(d.expectedWfh)}</div>
                                                                    {d.expectedWfhDetail && <div className="text-[10px] text-slate-400">{d.expectedWfhDetail}</div>}
                                                                </td>
                                                                <td className="py-2.5 px-3">
                                                                    <div className="font-bold text-slate-700">{fmtCurrency(d.actualHolerite)}</div>
                                                                    {d.actualHoleriteDetail && <div className="text-[10px] text-slate-400">{d.actualHoleriteDetail}</div>}
                                                                </td>
                                                                <td className="py-2.5 px-3">
                                                                    {d.status === "FALTOU" && (
                                                                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                                                            ❌ FALTOU
                                                                        </span>
                                                                    )}
                                                                    {d.status === "INDEVIDO" && (
                                                                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-800 border border-red-200">
                                                                            ❌ INDEVIDO
                                                                        </span>
                                                                    )}
                                                                    {d.status === "DIVERGENTE" && (
                                                                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                                                            ⚠️ DIVERGENTE
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="py-2.5 px-3">
                                                                    <span className="text-[11px] font-bold text-purple-900 bg-purple-50 px-2 py-1 rounded-lg border border-purple-200 block">
                                                                        👉 {d.instruction}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                                                {r.discrepancies.join(" • ")}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                    )}
                </div>
            </div>
        </DialogContent>
    </Dialog>
        </div>
    );
}
