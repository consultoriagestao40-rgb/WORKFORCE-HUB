"use client";

import { useState, useRef, useEffect } from "react";
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
    Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { extractDataFromPageText, ExtractedHoleriteItem } from "@/lib/holerite-processor";
import { parsePointExcel, parsePointPdfText, ParsedPointEmployee } from "@/lib/point-parser";
import { runPayrollAudit, getPayrollAuditCompanies, PayrollAuditResult, AuditRow } from "@/actions/payroll-audit";

export default function PayrollAuditPage() {
    const today = new Date();
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);

    // Companies Filter
    const [companies, setCompanies] = useState<{ id: string; name: string; cnpj: string | null }[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");

    const [pdfJsLoaded, setPdfJsLoaded] = useState(false);

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

    // Filter & Search States
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<"ALL" | "CRITICAL_RISK" | "MISSING_HOLERITE" | "MISSING_POINT" | "DEDUCTION_MISMATCH" | "SALARY_MISMATCH" | "ALIGNED">("ALL");
    const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

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

    // --- Process Point File (Excel or PDF) ---
    const handlePointFileChange = async (file: File) => {
        setPointFile(file);
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
                let fullText = "";
                for (let i = 1; i <= pdfjsDoc.numPages; i++) {
                    const page = await pdfjsDoc.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(" ");
                    fullText += "\n" + pageText;
                }
                const parsed = parsePointPdfText(fullText);
                setPointItems(parsed);
                toast.success(`Cartão Ponto (PDF) processado: ${parsed.length} colaboradores identificados.`);
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

            const items: ExtractedHoleriteItem[] = [];
            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                const page = await pdfjsDoc.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(" ");
                const parsed = extractDataFromPageText(pageText, pageNum);

                items.push({
                    id: `holerite-${pageNum}`,
                    pageIndices: [pageNum - 1],
                    pageNumbersDisplay: String(pageNum),
                    pageNumber: pageNum,
                    ...parsed
                });
            }

            setHoleriteItems(items);
            toast.success(`Holerites processados: ${items.length} recibos extraídos com dados financeiros.`);
        } catch (error: any) {
            console.error("Erro ao processar holerites:", error);
            toast.error("Falha ao processar arquivo de holerites: " + (error.message || ""));
        } finally {
            setIsProcessingHolerite(false);
        }
    };

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
        mismatchCount: rowsForCompany.filter(r => r.status === "DEDUCTION_MISMATCH" || r.status === "SALARY_MISMATCH").length,
        alignedCount: rowsForCompany.filter(r => r.status === "ALIGNED").length,
        totalHoleriteNet: rowsForCompany.reduce((acc, r) => acc + (r.hasHolerite ? r.holeriteNetSalary : 0), 0),
        totalSuspectedOverpayment: rowsForCompany.filter(r => r.status === "CRITICAL_RISK").reduce((acc, r) => acc + r.holeriteNetSalary, 0),
        totalOverpaymentSuspected: rowsForCompany.filter(r => r.status === "CRITICAL_RISK").reduce((acc, r) => acc + r.holeriteNetSalary, 0)
    };

    // Filter rows based on tab and search
    const filteredRows = rowsForCompany.filter(row => {
        if (activeTab !== "ALL" && row.status !== activeTab) {
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

    // Export to Excel (.xlsx)
    const exportToExcel = () => {
        if (!auditResult || rowsForCompany.length === 0) {
            toast.error("Nenhum dado auditado para exportar.");
            return;
        }

        try {
            const header = [
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
                "Total Vencimentos Holerite",
                "Total Descontos Holerite",
                "Líquido Holerite",
                "Dias Trabalhados Holerite",
                "Desconto Falta Holerite",
                "Página Holerite",
                "Horas Trab. Ponto",
                "Qtd Batidas Ponto",
                "Dias Faltas Ponto",
                "Horas Faltas Ponto",
                "Horas Extras Ponto",
                "Divergências Identificadas"
            ];

            const statusLabelMap: Record<string, string> = {
                CRITICAL_RISK: "RISCO CRÍTICO / INDEVIDO",
                MISSING_HOLERITE: "SEM HOLERITE (TRABALHOU)",
                MISSING_POINT: "SEM CARTÃO DE PONTO",
                DEDUCTION_MISMATCH: "DIVERGÊNCIA DE DESCONTOS/FALTAS",
                SALARY_MISMATCH: "DIVERGÊNCIA DE SALÁRIO BASE",
                ALIGNED: "ALINHADO / 100% OK"
            };

            const dataRows = rowsForCompany.map(r => [
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
                r.holerite?.totalEarnings || 0,
                r.holerite?.totalDeductions || 0,
                r.holerite?.netSalary || 0,
                r.holerite?.workedDays ?? "---",
                r.holerite?.absenceDeduction || 0,
                r.holerite?.pageNumber ?? "---",
                r.point?.workedHours || "---",
                r.point?.punchCount ?? "---",
                r.point?.absenceDays ?? "---",
                r.point?.absenceHours || "---",
                r.point?.extraHours || "---",
                r.discrepancies.join("; ")
            ]);

            const companyPart = selectedCompanyId === "all" 
                ? "todas_empresas" 
                : (companies.find(c => c.id === selectedCompanyId)?.name || "empresa").toLowerCase().replace(/[^a-z0-9]/gi, "_");

            const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
            ws["!cols"] = [
                { wch: 26 }, { wch: 12 }, { wch: 35 }, { wch: 16 }, { wch: 24 },
                { wch: 22 }, { wch: 25 }, { wch: 22 }, { wch: 16 }, { wch: 16 },
                { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
                { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
                { wch: 14 }, { wch: 45 }
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Auditoria Folha");
            XLSX.writeFile(wb, `Auditoria_Folha_${companyPart}_${String(selectedMonth).padStart(2, "0")}_${selectedYear}.xlsx`);
            toast.success("Relatório de auditoria exportado com sucesso!");
        } catch (error: any) {
            console.error("Erro ao exportar relatório:", error);
            toast.error("Erro ao exportar Excel.");
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

                        {/* Botão Exportar Excel */}
                        {auditResult && (
                            <Button 
                                onClick={exportToExcel}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 rounded-2xl shadow-lg h-11 px-4"
                            >
                                <FileSpreadsheet className="w-4 h-4" /> Exportar XLSX
                            </Button>
                        )}
                    </div>
                </div>
            </div>

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
                            <div className="text-[11px] font-semibold text-slate-500 mt-1">Trabalhou no ponto, sem holerite</div>
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
                                activeTab === "DEDUCTION_MISMATCH" || activeTab === "SALARY_MISMATCH"
                                    ? "bg-indigo-50 border-indigo-400 shadow-md ring-2 ring-indigo-400/30" 
                                    : "bg-white border-indigo-200/80 shadow-sm hover:shadow"
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Divergências</span>
                                <span className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                                    <AlertCircle className="w-4 h-4" />
                                </span>
                            </div>
                            <div className="text-3xl font-black text-indigo-600">{activeSummary?.mismatchCount ?? 0}</div>
                            <div className="text-[11px] font-semibold text-slate-500 mt-1">Diferenças em faltas ou salário</div>
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
                                                <tr 
                                                    key={row.id}
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
                                                                <div className="text-[10px] text-slate-500">
                                                                    Base: {fmtCurrency(row.holerite.baseSalary)} • Bruto: {fmtCurrency(row.holerite.totalEarnings)}
                                                                </div>
                                                                {row.holerite.pageNumber && (
                                                                    <div className="text-[9px] text-slate-400">
                                                                        Página {row.holerite.pageNumber} do PDF
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
    );
}
