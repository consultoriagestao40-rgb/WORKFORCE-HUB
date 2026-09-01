"use client";

import { useState, useEffect } from "react";
import { 
    DollarSign, 
    Calculator, 
    Search, 
    Calendar, 
    Info, 
    Building2, 
    Building, 
    User, 
    AlertCircle, 
    ChevronDown, 
    Edit,
    ChevronRight,
    TrendingDown,
    TrendingUp,
    Percent,
    FileSpreadsheet,
    Download,
    RefreshCw,
    ArrowUpDown,
    ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { toast } from "sonner";
import { getPayrollPreview, PayrollPreviewItem, updateMonthlyDeductions } from "@/actions/payroll";
import { syncSecullumOccurrences } from "@/actions/secullum";
import * as XLSX from "xlsx";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { ImportSecullumSheetDialog } from "@/components/admin/ImportSecullumSheetDialog";

export default function PayrollPreviewPage() {
    const today = new Date();
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);

    const [isLoading, setIsLoading] = useState(true);
    const [isSyncingSecullum, setIsSyncingSecullum] = useState(false);
    const [items, setItems] = useState<PayrollPreviewItem[]>([]);
    const [sortField, setSortField] = useState<'none' | 'name' | 'company' | 'baseSalary' | 'insalubridade' | 'periculosidade' | 'outrosAdicionais' | 'horasExtras' | 'adicionalNoturno' | 'salarioFamilia' | 'absenteismoAward' | 'ajudaCusto' | 'totalGrossSalary' | 'faltas' | 'atestados' | 'dsr' | 'descFaltas' | 'descDsr' | 'descAtrasos' | 'descVt' | 'descVa' | 'diversosDescontos' | 'emprestimos' | 'convenios' | 'sindicato' | 'inss' | 'irrf' | 'netSalary'>('none');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCompany, setSelectedCompany] = useState<string>("all");
    const [selectedClient, setSelectedClient] = useState<string>("all");
    const [groupedView, setGroupedView] = useState<"colaborador" | "empresa" | "contrato">("colaborador");
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

    // Sync Secullum modal state
    const [syncModalOpen, setSyncModalOpen] = useState(false);
    const [syncCompanyTarget, setSyncCompanyTarget] = useState<string>("all");
    const [syncTargetMonth, setSyncTargetMonth] = useState<number>(selectedMonth);
    const [syncTargetYear, setSyncTargetYear] = useState<number>(selectedYear);

    // Edit deductions modal state
    const [editDeductionsOpen, setEditDeductionsOpen] = useState(false);
    const [selectedEmployeeItem, setSelectedEmployeeItem] = useState<PayrollPreviewItem | null>(null);
    const [inputDiversos, setInputDiversos] = useState("");
    const [inputEmprestimos, setInputEmprestimos] = useState("");
    const [inputExtras50, setInputExtras50] = useState("");
    const [inputExtras100, setInputExtras100] = useState("");
    const [inputNoturnas, setInputNoturnas] = useState("");
    const [inputConvenios, setInputConvenios] = useState("");
    const [inputSindicato, setInputSindicato] = useState("");
    const [inputAjudaCusto, setInputAjudaCusto] = useState("");
    const [isSavingDeductions, setIsSavingDeductions] = useState(false);

    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportSelectedCompany, setExportSelectedCompany] = useState<string>("all");
    const [exportSelectedClient, setExportSelectedClient] = useState<string>("all");
    const [exportSelectedMonth, setExportSelectedMonth] = useState<number>(selectedMonth);
    const [exportSelectedYear, setExportSelectedYear] = useState<number>(selectedYear);
    const [isLoadingExport, setIsLoadingExport] = useState(false);

    useEffect(() => {
        if (exportModalOpen) {
            setExportSelectedMonth(selectedMonth);
            setExportSelectedYear(selectedYear);
            setExportSelectedCompany("all");
            setExportSelectedClient("all");
        }
    }, [exportModalOpen, selectedMonth, selectedYear]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await getPayrollPreview(selectedYear, selectedMonth);
            setItems(res.items || []);
        } catch (err: any) {
            toast.error("Erro ao carregar prévia de folha de pagamento.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenSyncModal = () => {
        setSyncCompanyTarget(selectedCompany !== "all" ? selectedCompany : "all");
        setSyncTargetMonth(selectedMonth);
        setSyncTargetYear(selectedYear);
        setSyncModalOpen(true);
    };

    const handleExecuteSync = async () => {
        setIsSyncingSecullum(true);
        try {
            const comp = syncCompanyTarget !== "all" ? syncCompanyTarget : undefined;
            const res = await syncSecullumOccurrences(syncTargetYear, syncTargetMonth, comp);
            if (res.success) {
                toast.success(res.message);
                setSyncModalOpen(false);
                loadData();
            } else {
                toast.error(res.message);
            }
        } catch (err: any) {
            toast.error(err.message || "Erro ao sincronizar com o Secullum.");
        } finally {
            setIsSyncingSecullum(false);
        }
    };

    const handleOpenEditDeductions = (item: PayrollPreviewItem) => {
        setSelectedEmployeeItem(item);
        setInputDiversos(item.diversosDescontos > 0 ? item.diversosDescontos.toString() : "");
        setInputEmprestimos(item.emprestimos > 0 ? item.emprestimos.toString() : "");
        setInputExtras50(item.extras50Hours > 0 ? item.extras50Hours.toString() : "");
        setInputExtras100(item.extras100Hours > 0 ? item.extras100Hours.toString() : "");
        setInputNoturnas(item.adicionalNoturnoHours > 0 ? item.adicionalNoturnoHours.toString() : "");
        setInputConvenios(item.convenios > 0 ? item.convenios.toString() : "");
        setInputSindicato(item.sindicato > 0 ? item.sindicato.toString() : "");
        setInputAjudaCusto(item.ajudaCusto > 0 ? item.ajudaCusto.toString() : "");
        setEditDeductionsOpen(true);
    };

    const handleSaveDeductions = async () => {
        if (!selectedEmployeeItem) return;
        setIsSavingDeductions(true);
        try {
            const diversos = parseFloat(inputDiversos) || 0;
            const emprestimos = parseFloat(inputEmprestimos) || 0;
            const extras50 = parseFloat(inputExtras50) || 0;
            const extras100 = parseFloat(inputExtras100) || 0;
            const noturnas = parseFloat(inputNoturnas) || 0;
            const convenios = parseFloat(inputConvenios) || 0;
            const sindicato = parseFloat(inputSindicato) || 0;
            const ajudaCusto = parseFloat(inputAjudaCusto) || 0;

            const res = await updateMonthlyDeductions(
                selectedEmployeeItem.employeeId,
                selectedYear,
                selectedMonth,
                diversos,
                emprestimos,
                extras50,
                extras100,
                noturnas,
                convenios,
                sindicato,
                ajudaCusto
            );

            if (res.success) {
                toast.success(`Lançamentos de ${selectedEmployeeItem.employeeName} salvos com sucesso!`);
                setEditDeductionsOpen(false);
                loadData();
            }
        } catch (error: any) {
            toast.error(error.message || "Erro ao salvar lançamentos.");
        } finally {
            setIsSavingDeductions(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedYear, selectedMonth]);

    const getOccurrencesWindowLabel = () => {
        let startMonth = selectedMonth - 1;
        let startYear = selectedYear;
        if (startMonth <= 0) {
            startMonth += 12;
            startYear -= 1;
        }
        
        const formatZero = (n: number) => String(n).padStart(2, '0');
        return `26/${formatZero(startMonth)}/${startYear} a 25/${formatZero(selectedMonth)}/${selectedYear}`;
    };

    const getPaydayLabel = () => {
        let payMonth = selectedMonth + 1;
        let payYear = selectedYear;
        if (payMonth > 12) {
            payMonth = 1;
            payYear += 1;
        }
        const monthsList = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];
        return `5º Dia Útil de ${monthsList[payMonth - 1]} / ${payYear}`;
    };

    // Filters logic
    const filteredItems = items.filter(item => {
        const cleanSearch = searchTerm.trim().toLowerCase();
        const searchDigits = searchTerm.replace(/\D/g, '');
        const cleanCpf = (item.employeeCpf || "").replace(/\D/g, '');

        const matchesSearch = !cleanSearch ||
            item.employeeName.toLowerCase().includes(cleanSearch) ||
            (searchDigits.length > 0 && cleanCpf.includes(searchDigits));
        
        const matchesCompany = selectedCompany === "all" || item.companyName === selectedCompany;
        const matchesClient = selectedClient === "all" || item.clientName === selectedClient;

        return matchesSearch && matchesCompany && matchesClient;
    });

    const handleSort = (field: 'name' | 'company' | 'baseSalary' | 'insalubridade' | 'periculosidade' | 'outrosAdicionais' | 'horasExtras' | 'adicionalNoturno' | 'salarioFamilia' | 'absenteismoAward' | 'ajudaCusto' | 'totalGrossSalary' | 'faltas' | 'atestados' | 'dsr' | 'descFaltas' | 'descDsr' | 'descAtrasos' | 'descVt' | 'descVa' | 'diversosDescontos' | 'emprestimos' | 'convenios' | 'sindicato' | 'inss' | 'irrf' | 'netSalary') => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const sortedItems = [...filteredItems].sort((a, b) => {
        if (sortField === 'none') return 0;

        let valA: any = 0;
        let valB: any = 0;

        switch (sortField) {
            case 'name':
                return sortDirection === 'asc'
                    ? a.employeeName.localeCompare(b.employeeName)
                    : b.employeeName.localeCompare(a.employeeName);
            case 'company':
                const compA = a.companyName || '';
                const compB = b.companyName || '';
                return sortDirection === 'asc'
                    ? compA.localeCompare(compB)
                    : compB.localeCompare(compA);
            case 'baseSalary':
                valA = a.baseSalary;
                valB = b.baseSalary;
                break;
            case 'insalubridade':
                valA = a.insalubridade;
                valB = b.insalubridade;
                break;
            case 'periculosidade':
                valA = a.periculosidade;
                valB = b.periculosidade;
                break;
            case 'outrosAdicionais':
                valA = a.gratificacao + a.outrosAdicionais;
                valB = b.gratificacao + b.outrosAdicionais;
                break;
            case 'horasExtras':
                valA = a.horasExtras50Value + a.horasExtras100Value;
                valB = b.horasExtras50Value + b.horasExtras100Value;
                break;
            case 'adicionalNoturno':
                valA = a.adicionalNoturnoValue;
                valB = b.adicionalNoturnoValue;
                break;
            case 'salarioFamilia':
                valA = a.salarioFamilia;
                valB = b.salarioFamilia;
                break;
            case 'absenteismoAward':
                valA = a.absenteismoAward;
                valB = b.absenteismoAward;
                break;
            case 'ajudaCusto':
                valA = a.ajudaCusto + a.adicionalViagem;
                valB = b.ajudaCusto + b.adicionalViagem;
                break;
            case 'totalGrossSalary':
                valA = a.totalGrossSalary;
                valB = b.totalGrossSalary;
                break;
            case 'faltas':
                valA = a.faltasCount;
                valB = b.faltasCount;
                break;
            case 'atestados':
                valA = a.atestadosCount;
                valB = b.atestadosCount;
                break;
            case 'dsr':
                valA = a.dsrDeductionsCount || 0;
                valB = b.dsrDeductionsCount || 0;
                break;
            case 'descFaltas':
                valA = a.faltaDeduction;
                valB = b.faltaDeduction;
                break;
            case 'descDsr':
                valA = a.dsrDeduction;
                valB = b.dsrDeduction;
                break;
            case 'descAtrasos':
                valA = a.atrasosDeduction;
                valB = b.atrasosDeduction;
                break;
            case 'descVt':
                valA = a.vtPayrollDiscount;
                valB = b.vtPayrollDiscount;
                break;
            case 'descVa':
                valA = a.vaPayrollDiscount;
                valB = b.vaPayrollDiscount;
                break;
            case 'diversosDescontos':
                valA = a.diversosDescontos;
                valB = b.diversosDescontos;
                break;
            case 'emprestimos':
                valA = a.emprestimos;
                valB = b.emprestimos;
                break;
            case 'convenios':
                valA = a.convenios;
                valB = b.convenios;
                break;
            case 'sindicato':
                valA = a.sindicato;
                valB = b.sindicato;
                break;
            case 'inss':
                valA = a.inssDeduction;
                valB = b.inssDeduction;
                break;
            case 'irrf':
                valA = a.irrfDeduction;
                valB = b.irrfDeduction;
                break;
            case 'netSalary':
                valA = a.netSalary;
                valB = b.netSalary;
                break;
        }

        return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    const renderSortIcon = (field: typeof sortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 group-hover:text-slate-400 transition-colors ml-1 inline-block shrink-0" />;
        }
        return sortDirection === 'desc' ? (
            <ChevronDown className="w-3 h-3 text-sky-600 ml-1 inline-block shrink-0" />
        ) : (
            <ChevronUp className="w-3 h-3 text-sky-600 ml-1 inline-block shrink-0" />
        );
    };

    // Unique filter options computed dynamically
    const uniqueCompanies = Array.from(new Set(items.map(item => item.companyName || "Sem Empresa"))).sort();
    const uniqueClients = Array.from(new Set(items.map(item => item.clientName || "Interno"))).sort();

    // Grouping calculations
    const groupedByCompany = filteredItems.reduce((acc, item) => {
        const group = item.companyName;
        if (!acc[group]) {
            acc[group] = {
                name: group,
                count: 0,
                baseSalary: 0,
                insalubridade: 0,
                periculosidade: 0,
                gratificacao: 0,
                outrosAdicionais: 0,
                totalGrossSalary: 0,
                faltasCount: 0,
                atestadosCount: 0,
                dsrDeductionsCount: 0,
                faltaDeduction: 0,
                dsrDeduction: 0,
                vtPayrollDiscount: 0,
                vaPayrollDiscount: 0,
                diversosDescontos: 0,
                emprestimos: 0,
                convenios: 0,
                sindicato: 0,
                inssDeduction: 0,
                irrfDeduction: 0,
                totalDeductions: 0,
                netSalary: 0,
                items: []
            };
        }
        acc[group].count += 1;
        acc[group].baseSalary += item.baseSalary;
        acc[group].insalubridade += item.insalubridade;
        acc[group].periculosidade += item.periculosidade;
        acc[group].gratificacao += item.gratificacao;
        acc[group].outrosAdicionais += item.outrosAdicionais;
        acc[group].totalGrossSalary += item.totalGrossSalary;
        acc[group].faltasCount += item.faltasCount;
        acc[group].atestadosCount += item.atestadosCount;
        acc[group].dsrDeductionsCount += item.dsrDeductionsCount;
        acc[group].faltaDeduction += item.faltaDeduction;
        acc[group].dsrDeduction += item.dsrDeduction;
        acc[group].vtPayrollDiscount += item.vtPayrollDiscount;
        acc[group].vaPayrollDiscount += item.vaPayrollDiscount;
        acc[group].diversosDescontos += item.diversosDescontos;
        acc[group].emprestimos += item.emprestimos;
        acc[group].convenios += item.convenios || 0;
        acc[group].sindicato += item.sindicato || 0;
        acc[group].inssDeduction += item.inssDeduction;
        acc[group].irrfDeduction += item.irrfDeduction;
        acc[group].totalDeductions += item.totalDeductions;
        acc[group].netSalary += item.netSalary;
        acc[group].items.push(item);
        return acc;
    }, {} as Record<string, any>);

    const groupedByClient = filteredItems.reduce((acc, item) => {
        const group = item.clientName;
        if (!acc[group]) {
            acc[group] = {
                name: group,
                count: 0,
                baseSalary: 0,
                insalubridade: 0,
                periculosidade: 0,
                gratificacao: 0,
                outrosAdicionais: 0,
                totalGrossSalary: 0,
                faltasCount: 0,
                atestadosCount: 0,
                dsrDeductionsCount: 0,
                faltaDeduction: 0,
                dsrDeduction: 0,
                vtPayrollDiscount: 0,
                vaPayrollDiscount: 0,
                diversosDescontos: 0,
                emprestimos: 0,
                convenios: 0,
                sindicato: 0,
                inssDeduction: 0,
                irrfDeduction: 0,
                totalDeductions: 0,
                netSalary: 0,
                items: []
            };
        }
        acc[group].count += 1;
        acc[group].baseSalary += item.baseSalary;
        acc[group].insalubridade += item.insalubridade;
        acc[group].periculosidade += item.periculosidade;
        acc[group].gratificacao += item.gratificacao;
        acc[group].outrosAdicionais += item.outrosAdicionais;
        acc[group].totalGrossSalary += item.totalGrossSalary;
        acc[group].faltasCount += item.faltasCount;
        acc[group].atestadosCount += item.atestadosCount;
        acc[group].dsrDeductionsCount += item.dsrDeductionsCount;
        acc[group].faltaDeduction += item.faltaDeduction;
        acc[group].dsrDeduction += item.dsrDeduction;
        acc[group].vtPayrollDiscount += item.vtPayrollDiscount;
        acc[group].vaPayrollDiscount += item.vaPayrollDiscount;
        acc[group].diversosDescontos += item.diversosDescontos;
        acc[group].emprestimos += item.emprestimos;
        acc[group].convenios += item.convenios || 0;
        acc[group].sindicato += item.sindicato || 0;
        acc[group].inssDeduction += item.inssDeduction;
        acc[group].irrfDeduction += item.irrfDeduction;
        acc[group].totalDeductions += item.totalDeductions;
        acc[group].netSalary += item.netSalary;
        acc[group].items.push(item);
        return acc;
    }, {} as Record<string, any>);

    // Total metrics card values
    const totalActiveCount = filteredItems.length;
    const totalGrossSum = filteredItems.reduce((sum, item) => sum + item.totalGrossSalary, 0);
    const totalDeductionsSum = filteredItems.reduce((sum, item) => sum + item.totalDeductions, 0);
    const totalNetSum = filteredItems.reduce((sum, item) => sum + item.netSalary, 0);

    const toggleGroup = (groupName: string) => {
        setExpandedGroups(prev => 
            prev.includes(groupName) 
                ? prev.filter(g => g !== groupName) 
                : [...prev, groupName]
        );
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const formatHours = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(val);
    };

    const handleExportToExcel = async () => {
        setIsLoadingExport(true);
        try {
            const res = await getPayrollPreview(exportSelectedYear, exportSelectedMonth);
            const rawItems = res.items || [];
            
            // Filter by company and client/contract
            let filtered = rawItems;
            if (exportSelectedCompany !== "all") {
                filtered = filtered.filter(item => item.companyName === exportSelectedCompany);
            }
            if (exportSelectedClient !== "all") {
                filtered = filtered.filter(item => item.clientName === exportSelectedClient);
            }

            if (filtered.length === 0) {
                toast.error("Nenhum dado disponível para os filtros selecionados.");
                return;
            }

            const excelData = filtered.map(item => {
                const atestadosList = (item.occurrencesList || []).filter(o => o.rawType === "ATESTADO");
                const atestadosDatesStr = atestadosList.length > 0
                    ? atestadosList.map(o => o.date).join(", ")
                    : "-";

                const faltasList = (item.occurrencesList || []).filter(o => o.rawType === "FALTA" || o.rawType === "FALTA_INJUSTIFICADA");
                const faltasDatesStr = faltasList.length > 0
                    ? faltasList.map(o => o.date).join(", ")
                    : "-";

                return {
                    "Colaborador": item.employeeName,
                    "CPF": item.employeeCpf,
                    "Situação": item.situationName || "Ativo",
                    "Empresa": item.companyName,
                    "Cliente / Contrato": item.clientName,
                    "Posto / Função": item.postoName,
                    "Admissão": item.admissionDate,
                    "Dias Trab.": item.daysWorked,
                    "Salário Base (R$)": item.baseSalary,
                    "Insalubridade (R$)": item.insalubridade,
                    "Periculosidade (R$)": item.periculosidade,
                    "Gratificação (R$)": item.gratificacao,
                    "Outros Adicionais (R$)": item.outrosAdicionais,
                    "Salário Bruto (R$)": item.totalGrossSalary,
                    "Atrasos (Horas)": item.atrasosHours,
                    "Desc. Atrasos (R$)": item.atrasosDeduction,
                    "H.Extras 50% (H)": item.extras50Hours,
                    "Valor Extras 50% (R$)": item.horasExtras50Value,
                    "H.Extras 100% (H)": item.extras100Hours,
                    "Valor Extras 100% (R$)": item.horasExtras100Value,
                    "Adic. Noturno (H)": item.adicionalNoturnoHours,
                    "Valor Adic. Noturno (R$)": item.adicionalNoturnoValue,
                    "Dependentes (Qtd)": item.dependentsCount,
                    "Salário-Família (R$)": item.salarioFamilia,
                    "Prêmio Absenteísmo (R$)": item.absenteismoAward,
                    "Ajuda de Custo (R$)": item.ajudaCusto,
                    "Adic. Viagem (R$)": item.adicionalViagem,
                    "Faltas (Dias)": item.faltasCount,
                    "Datas das Faltas": faltasDatesStr,
                    "Desc. Faltas (R$)": item.faltaDeduction,
                    "DSR Perdidos": item.dsrDeductionsCount,
                    "Desc. DSR (R$)": item.dsrDeduction,
                    "Atestados (Dias)": item.atestadosCount || 0,
                    "Datas dos Atestados": atestadosDatesStr,
                    "Férias (Dias)": item.vacationDays || 0,
                    "Datas das Férias": item.vacationDatesStr || "-",
                    "VT Líquido Creditado (R$)": item.vtNetValue,
                    "Alíquota Desc. VT (%)": item.vtDiscountPercentage,
                    "Desc. VT em Folha (R$)": item.vtPayrollDiscount,
                    "VA Valor Bruto (R$)": item.vaBaseValue,
                    "VA Abatimento Faltas (R$)": item.vaDeductionValue,
                    "VA Líquido Creditado (R$)": item.vaNetValue,
                    "Alíquota Desc. VA (%)": item.vaDiscountPercentage,
                    "Desc. VA em Folha (R$)": item.vaPayrollDiscount,
                    "Descontos Diversos (R$)": item.diversosDescontos,
                    "Empréstimos (R$)": item.emprestimos,
                    "Convênios (R$)": item.convenios,
                    "Sindicatos (R$)": item.sindicato,
                    "Desc. INSS (R$)": item.inssDeduction,
                    "Desc. IRRF (R$)": item.irrfDeduction,
                    "Total Descontos (R$)": item.totalDeductions,
                    "Salário Líquido (R$)": item.netSalary
                };
            });

            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Prévia de Folha");

            // Auto-fit columns dynamically
            const maxCols = Object.keys(excelData[0] || {}).map(key => {
                let maxLen = key.length;
                excelData.forEach(row => {
                    const val = String((row as any)[key] || "");
                    if (val.length > maxLen) maxLen = val.length;
                });
                return { wch: Math.min(Math.max(maxLen + 3, 12), 50) };
            });
            worksheet["!cols"] = maxCols;

            const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            const monthName = months[exportSelectedMonth - 1] || "competencia";
            
            const companyPart = exportSelectedCompany === 'all' ? 'todas_empresas' : exportSelectedCompany.replace(/\s+/g, '_');
            const clientPart = exportSelectedClient === 'all' ? 'todos_contratos' : exportSelectedClient.replace(/\s+/g, '_');

            XLSX.writeFile(workbook, `previa_folha_${companyPart}_${clientPart}_${monthName.toLowerCase()}_${exportSelectedYear}.xlsx`);
            toast.success("Excel exportado com sucesso!");
            setExportModalOpen(false);
        } catch (error) {
            console.error("Erro ao exportar prévia de folha:", error);
            toast.error("Ocorreu um erro ao gerar o arquivo Excel.");
        } finally {
            setIsLoadingExport(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header com gradiente */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-6 shadow-xl border border-slate-800">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#1e293b,transparent)]" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className="bg-sky-500/10 p-2 rounded-xl border border-sky-400/20 text-sky-400">
                                <Calculator className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Financeiro & DP</span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tight">Prévia de Folha de Pagamento</h1>
                        <p className="text-xs text-slate-400 font-semibold mt-1">
                            Competência de Apuração: <span className="text-white underline decoration-sky-400 font-bold">{getOccurrencesWindowLabel()}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                            Previsão de Pagamento: <span className="text-slate-300 font-bold">{getPaydayLabel()}</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-3 self-start md:self-center">
                        {/* Ano / Mês Selector */}
                        <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-2xl border border-slate-700/60 w-fit backdrop-blur-sm">
                            <Calendar className="w-4 h-4 text-sky-400 ml-1.5" />
                            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
                                <SelectTrigger className="h-8 border-none bg-transparent hover:bg-slate-700 text-white font-bold text-xs rounded-xl w-[100px] cursor-pointer">
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
                                <SelectTrigger className="h-8 border-none bg-transparent hover:bg-slate-700 text-white font-bold text-xs rounded-xl w-[80px] cursor-pointer">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                                    <SelectItem value="2025">2025</SelectItem>
                                    <SelectItem value="2026">2026</SelectItem>
                                    <SelectItem value="2027">2027</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Sincronizar Secullum com Modal de Seleção de Empresa */}
                        <button
                            onClick={handleOpenSyncModal}
                            disabled={isSyncingSecullum}
                            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800/50 text-white font-bold text-xs h-11 px-4 rounded-2xl border border-sky-500/30 transition-all cursor-pointer shadow-lg shadow-slate-950/20 active:scale-[0.98] disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={`w-4 h-4 ${isSyncingSecullum ? 'animate-spin' : ''}`} />
                            <span>{isSyncingSecullum ? 'Sincronizando...' : 'Sincronizar Secullum'}</span>
                        </button>

                        {/* Importar Planilha de Ponto Secullum */}
                        <ImportSecullumSheetDialog 
                            year={selectedYear} 
                            month={selectedMonth} 
                            companies={uniqueCompanies}
                            defaultCompany={selectedCompany}
                            onSuccess={loadData} 
                        />

                        {/* Exportar Excel */}
                        <button
                            onClick={() => setExportModalOpen(true)}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-11 px-4 rounded-2xl border border-emerald-500/30 transition-all cursor-pointer shadow-lg shadow-slate-950/20 active:scale-[0.98]"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Exportar Excel</span>
                        </button>

                        {/* Lançamento de Rubricas Onvio */}
                        <Link
                            href="/admin/payroll-onvio"
                            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs h-11 px-4 rounded-2xl border border-orange-500/30 transition-all cursor-pointer shadow-lg shadow-slate-950/20 active:scale-[0.98]"
                        >
                            <ClipboardCheck className="w-4 h-4" />
                            <span>Rubricas Onvio</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Colaboradores */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Colaboradores Calculados</span>
                        <h3 className="text-2xl font-black text-slate-800">{totalActiveCount}</h3>
                        <span className="text-[9px] font-bold text-slate-400 block mt-1">Status Ativos e Alocados</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-slate-500">
                        <User className="w-5 h-5" />
                    </div>
                </div>

                {/* Salário Bruto */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Total Proventos Brutos</span>
                        <h3 className="text-2xl font-black text-slate-800">{formatCurrency(totalGrossSum)}</h3>
                        <div className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 mt-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>Salários + Adicionais</span>
                        </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl text-emerald-600">
                        <DollarSign className="w-5 h-5" />
                    </div>
                </div>

                {/* Total Descontos */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Total Descontos Folha</span>
                        <h3 className="text-2xl font-black text-red-600">{formatCurrency(totalDeductionsSum)}</h3>
                        <div className="flex items-center gap-0.5 text-[9px] font-bold text-red-500 mt-1">
                            <TrendingDown className="w-3 h-3" />
                            <span>Faltas + DSR + Atrasos + VT + VA + Diversos + Empréstimos + INSS + IRRF</span>
                        </div>
                    </div>
                    <div className="bg-red-50 border border-red-100 p-3 rounded-2xl text-red-500">
                        <TrendingDown className="w-5 h-5" />
                    </div>
                </div>

                {/* Salário Líquido */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Folha Líquida Estimada</span>
                        <h3 className="text-2xl font-black text-sky-600">{formatCurrency(totalNetSum)}</h3>
                        <div className="flex items-center gap-0.5 text-[9px] font-bold text-sky-500 mt-1">
                            <Info className="w-3 h-3" />
                            <span>Previsão de Desembolso</span>
                        </div>
                    </div>
                    <div className="bg-sky-50 border border-sky-100 p-3 rounded-2xl text-sky-600">
                        <Calculator className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Painel de Filtros e Busca */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3 items-end">
                    {/* Pesquisa por nome */}
                    <div className="flex flex-col gap-1.5 w-full col-span-1 md:col-span-2 lg:col-span-2">
                        <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">Pesquisar Colaborador</Label>
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                            <Input 
                                placeholder="Buscar por nome ou CPF..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 text-xs h-9 rounded-xl bg-slate-50 border-slate-200"
                            />
                        </div>
                    </div>

                    {/* Filtro Empresa */}
                    <div className="flex flex-col gap-1.5 w-full col-span-1">
                        <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">Filtrar por Empresa</Label>
                        <Combobox
                            options={[
                                { value: "all", label: "Todas as Empresas" },
                                ...uniqueCompanies.map(c => ({ value: c, label: c }))
                            ]}
                            value={selectedCompany}
                            onChange={setSelectedCompany}
                            placeholder="Todas as Empresas"
                            searchPlaceholder="Buscar empresa..."
                            className="h-9"
                        />
                    </div>

                    {/* Filtro Cliente */}
                    <div className="flex flex-col gap-1.5 w-full col-span-1">
                        <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">Filtrar por Contrato</Label>
                        <Combobox
                            options={[
                                { value: "all", label: "Todos os Contratos" },
                                ...uniqueClients.map(c => ({ value: c, label: c }))
                            ]}
                            value={selectedClient}
                            onChange={setSelectedClient}
                            placeholder="Todos os Contratos"
                            searchPlaceholder="Buscar contrato..."
                            className="h-9"
                        />
                    </div>

                    {/* Agrupamento */}
                    <div className="flex flex-col gap-1.5 w-full col-span-1">
                        <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">Modo de Agrupamento</Label>
                        <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                            <button
                                onClick={() => setGroupedView("colaborador")}
                                className={`flex-1 text-center py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${groupedView === "colaborador" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                Colab.
                            </button>
                            <button
                                onClick={() => setGroupedView("empresa")}
                                className={`flex-1 text-center py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${groupedView === "empresa" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                Empresa
                            </button>
                            <button
                                onClick={() => setGroupedView("contrato")}
                                className={`flex-1 text-center py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${groupedView === "contrato" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                Contrato
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Listagem de Dados */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-8 h-8 rounded-full border-4 border-slate-100 border-t-sky-500 animate-spin" />
                        <span className="text-xs text-slate-400 font-bold">Processando premissas de folha de pagamento...</span>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <AlertCircle className="w-8 h-8 text-slate-300" />
                        <span className="text-xs text-slate-400 font-bold">Nenhum registro encontrado com os filtros atuais.</span>
                    </div>
                ) : groupedView === "colaborador" ? (
                    /* LISTAGEM POR COLABORADOR */
                    <div className="overflow-x-auto relative">
                        <table className="text-left border-collapse" style={{ minWidth: "2750px", tableLayout: "fixed" }}>
                            <colgroup>
                                <col style={{ width: "280px" }} /> {/* Colaborador */}
                                <col style={{ width: "220px" }} /> {/* Empresa / Posto */}
                                <col style={{ width: "130px" }} /> {/* Salário Base */}
                                <col style={{ width: "130px" }} /> {/* Insalubridade */}
                                <col style={{ width: "130px" }} /> {/* Periculosidade */}
                                <col style={{ width: "140px" }} /> {/* Outros Adicionais */}
                                <col style={{ width: "140px" }} /> {/* H. Extras */}
                                <col style={{ width: "140px" }} /> {/* Adic. Noturno */}
                                <col style={{ width: "140px" }} /> {/* Salário-Família */}
                                <col style={{ width: "140px" }} /> {/* Ajuda Custo */}
                                <col style={{ width: "150px" }} /> {/* Prêmio Assiduidade */}
                                <col style={{ width: "150px" }} /> {/* Proventos Brutos */}
                                <col style={{ width: "100px" }} /> {/* Faltas */}
                                <col style={{ width: "100px" }} /> {/* Atestados */}
                                <col style={{ width: "100px" }} /> {/* DSR */}
                                <col style={{ width: "140px" }} /> {/* Desc. Faltas */}
                                <col style={{ width: "140px" }} /> {/* Desc. DSR */}
                                <col style={{ width: "140px" }} /> {/* Desc. Atrasos */}
                                <col style={{ width: "130px" }} /> {/* Desc. VT */}
                                <col style={{ width: "130px" }} /> {/* Desc. VA */}
                                <col style={{ width: "130px" }} /> {/* INSS */}
                                <col style={{ width: "130px" }} /> {/* IRRF */}
                                <col style={{ width: "160px" }} /> {/* Líquido Final */}
                            </colgroup>
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    <th 
                                        className="py-3 px-4 sticky left-0 z-20 cursor-pointer select-none hover:bg-slate-100/80 transition-colors group" 
                                        style={{ position: "sticky", top: 0, left: 0, backgroundColor: "#f8fafc", zIndex: 30 }}
                                        onClick={() => handleSort('name')}
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Colaborador / CPF / Função</span>
                                            {renderSortIcon('name')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 cursor-pointer select-none hover:bg-slate-100/80 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('company')}
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Empresa / Posto</span>
                                            {renderSortIcon('company')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right cursor-pointer select-none hover:bg-slate-100/80 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('baseSalary')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Salário Base</span>
                                            {renderSortIcon('baseSalary')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right cursor-pointer select-none hover:bg-slate-100/80 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('insalubridade')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Insalubridade</span>
                                            {renderSortIcon('insalubridade')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right cursor-pointer select-none hover:bg-slate-100/80 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('periculosidade')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Periculosidade</span>
                                            {renderSortIcon('periculosidade')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right cursor-pointer select-none hover:bg-slate-100/80 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('outrosAdicionais')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Outros Adicionais</span>
                                            {renderSortIcon('outrosAdicionais')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right bg-sky-50/50 cursor-pointer select-none hover:bg-slate-100/80 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('horasExtras')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>H. Extras</span>
                                            {renderSortIcon('horasExtras')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right bg-sky-50/50 cursor-pointer select-none hover:bg-slate-100/80 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('adicionalNoturno')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Adic. Noturno</span>
                                            {renderSortIcon('adicionalNoturno')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right bg-sky-50/50 cursor-pointer select-none hover:bg-slate-100/80 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('salarioFamilia')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Salário-Família</span>
                                            {renderSortIcon('salarioFamilia')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right bg-sky-50/50 cursor-pointer select-none hover:bg-slate-100/80 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('ajudaCusto')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Ajuda Custo</span>
                                            {renderSortIcon('ajudaCusto')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right bg-sky-50/50 cursor-pointer select-none hover:bg-slate-100/80 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('absenteismoAward')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Prêmio Assiduidade</span>
                                            {renderSortIcon('absenteismoAward')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right bg-slate-100/50 cursor-pointer select-none hover:bg-slate-100/80 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('totalGrossSalary')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Proventos Brutos</span>
                                            {renderSortIcon('totalGrossSalary')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-center cursor-pointer select-none hover:bg-slate-100/80 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('faltas')}
                                    >
                                        <div className="flex items-center justify-center gap-0.5">
                                            <span>Faltas</span>
                                            {renderSortIcon('faltas')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-center cursor-pointer select-none hover:bg-slate-100/80 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('atestados')}
                                    >
                                        <div className="flex items-center justify-center gap-0.5">
                                            <span>Atestados</span>
                                            {renderSortIcon('atestados')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-center cursor-pointer select-none hover:bg-slate-100/80 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('dsr')}
                                    >
                                        <div className="flex items-center justify-center gap-0.5">
                                            <span>DSR</span>
                                            {renderSortIcon('dsr')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right text-red-500 bg-red-50/20 cursor-pointer select-none hover:bg-red-100/30 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('descFaltas')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Desc. Faltas</span>
                                            {renderSortIcon('descFaltas')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right text-red-500 bg-red-50/20 cursor-pointer select-none hover:bg-red-100/30 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('descDsr')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Desc. DSR</span>
                                            {renderSortIcon('descDsr')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right text-red-500 bg-red-50/20 cursor-pointer select-none hover:bg-red-100/30 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('descAtrasos')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Desc. Atrasos</span>
                                            {renderSortIcon('descAtrasos')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right text-orange-500 bg-orange-50/20 cursor-pointer select-none hover:bg-orange-100/30 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('descVt')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Desc. VT</span>
                                            {renderSortIcon('descVt')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right text-orange-500 bg-orange-50/20 cursor-pointer select-none hover:bg-orange-100/30 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('descVa')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Desc. VA</span>
                                            {renderSortIcon('descVa')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right text-red-500 bg-red-50/10 cursor-pointer select-none hover:bg-red-100/20 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('diversosDescontos')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Desc. Diversos</span>
                                            {renderSortIcon('diversosDescontos')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right text-red-500 bg-red-50/10 cursor-pointer select-none hover:bg-red-100/20 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('emprestimos')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Empréstimos</span>
                                            {renderSortIcon('emprestimos')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right text-red-500 bg-red-50/10 cursor-pointer select-none hover:bg-red-100/20 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('convenios')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Convênios</span>
                                            {renderSortIcon('convenios')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right text-red-500 bg-red-50/10 cursor-pointer select-none hover:bg-red-100/20 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('sindicato')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Sindicato</span>
                                            {renderSortIcon('sindicato')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right text-red-500 bg-red-50/20 cursor-pointer select-none hover:bg-red-100/30 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('inss')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>INSS</span>
                                            {renderSortIcon('inss')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right text-red-500 bg-red-50/20 cursor-pointer select-none hover:bg-red-100/30 transition-colors group" 
                                        style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}
                                        onClick={() => handleSort('irrf')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>IRRF</span>
                                            {renderSortIcon('irrf')}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 text-right font-bold text-sky-900 sticky right-0 z-20 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)] cursor-pointer select-none hover:bg-slate-200 transition-colors group" 
                                        style={{ position: "sticky", top: 0, right: 0, backgroundColor: "#f1f5f9", zIndex: 30 }}
                                        onClick={() => handleSort('netSalary')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Líquido Final</span>
                                            {renderSortIcon('netSalary')}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-650">
                                {sortedItems.map(item => (
                                    <tr key={item.employeeId} className="hover:bg-slate-50/60 transition-colors group">
                                        {/* Colaborador */}
                                        <td className="py-3 px-4 sticky left-0 z-10 whitespace-nowrap" style={{ position: "sticky", left: 0, backgroundColor: "#ffffff", zIndex: 10 }}>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-slate-900 text-[13px]">{item.employeeName}</span>
                                                    {item.situationName && item.situationName !== "Ativo" && (
                                                        <span 
                                                            className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md text-white shadow-xs"
                                                            style={{ backgroundColor: item.situationColor || '#ef4444' }}
                                                        >
                                                            {item.situationName}
                                                        </span>
                                                    )}
                                                    <button 
                                                        onClick={() => handleOpenEditDeductions(item)}
                                                        className="text-slate-400 hover:text-slate-800 hover:bg-slate-100 p-0.5 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                        title="Lançar Empréstimo / Descontos"
                                                    >
                                                        <Edit className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">CPF: {item.employeeCpf} | {item.postoName}</div>
                                            </div>
                                        </td>
                                        {/* Empresa */}
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-slate-800 text-[11px] font-bold">{item.companyName}</div>
                                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">{item.clientName}</div>
                                            </div>
                                        </td>
                                        {/* Salário Base */}
                                        <td className="py-3 px-4 text-right font-medium text-slate-800 whitespace-nowrap">
                                            {formatCurrency(item.baseSalary)}
                                        </td>
                                        {/* Insalubridade */}
                                        <td className="py-3 px-4 text-right font-medium text-slate-850 whitespace-nowrap">
                                            {item.insalubridade > 0 ? formatCurrency(item.insalubridade) : "-"}
                                        </td>
                                        {/* Periculosidade */}
                                        <td className="py-3 px-4 text-right font-medium text-slate-850 whitespace-nowrap">
                                            {item.periculosidade > 0 ? formatCurrency(item.periculosidade) : "-"}
                                        </td>
                                        {/* Outros Adicionais */}
                                        <td className="py-3 px-4 text-right font-medium text-slate-850 whitespace-nowrap">
                                            {item.gratificacao + item.outrosAdicionais > 0 ? formatCurrency(item.gratificacao + item.outrosAdicionais) : "-"}
                                        </td>
                                        {/* H. Extras */}
                                        <td className="py-3 px-4 text-right font-medium text-slate-850 whitespace-nowrap">
                                            {item.horasExtras50Value + item.horasExtras100Value > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="underline decoration-dashed cursor-pointer text-slate-700 hover:text-slate-900">
                                                            {formatCurrency(item.horasExtras50Value + item.horasExtras100Value)}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-56 p-3 text-xs space-y-1.5">
                                                        <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Horas Extras (Secullum)</div>
                                                        <div className="space-y-1 text-[10px] text-slate-655 font-medium">
                                                            <div className="flex justify-between"><span>Extras 50%:</span><span>{formatHours(item.extras50Hours)}h ({formatCurrency(item.horasExtras50Value)})</span></div>
                                                            <div className="flex justify-between"><span>Extras 100%:</span><span>{formatHours(item.extras100Hours)}h ({formatCurrency(item.horasExtras100Value)})</span></div>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : "-"}
                                        </td>
                                        {/* Adic. Noturno */}
                                        <td className="py-3 px-4 text-right font-medium text-slate-850 whitespace-nowrap">
                                            {item.adicionalNoturnoValue > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="underline decoration-dashed cursor-pointer text-slate-700 hover:text-slate-900">
                                                            {formatCurrency(item.adicionalNoturnoValue)} <span className="text-[10px] text-slate-400 font-normal">({formatHours(item.adicionalNoturnoHours)}h)</span>
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-52 p-3 text-xs space-y-1">
                                                        <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Adicional Noturno (Ponto)</div>
                                                        <div className="flex justify-between text-[10px] text-slate-655 font-medium">
                                                            <span>Horas Sincronizadas:</span>
                                                            <span>{formatHours(item.adicionalNoturnoHours)}h</span>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : "-"}
                                        </td>
                                        {/* Salário-Família */}
                                        <td className="py-3 px-4 text-right font-medium text-slate-850 whitespace-nowrap">
                                            {item.salarioFamilia > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="underline decoration-dashed cursor-pointer text-slate-700 hover:text-slate-900">
                                                            {formatCurrency(item.salarioFamilia)}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-56 p-3 text-xs space-y-1">
                                                        <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Salário-Família</div>
                                                        <div className="flex justify-between text-[10px] text-slate-655 font-medium">
                                                            <span>Qtd Dependentes:</span>
                                                            <span>{item.dependentsCount}</span>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : "-"}
                                        </td>
                                        {/* Ajuda Custo */}
                                        <td className="py-3 px-4 text-right font-medium text-slate-850 whitespace-nowrap">
                                            {item.ajudaCusto + item.adicionalViagem > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="underline decoration-dashed cursor-pointer text-slate-700 hover:text-slate-900">
                                                            {formatCurrency(item.ajudaCusto + item.adicionalViagem)}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-56 p-3 text-xs space-y-1.5">
                                                        <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Ajuda de Custo / Viagem</div>
                                                        <div className="space-y-1 text-[10px] text-slate-655 font-medium">
                                                            <div className="flex justify-between"><span>Ajuda de Custo:</span><span>{formatCurrency(item.ajudaCusto)}</span></div>
                                                            <div className="flex justify-between"><span>Adic. Viagem:</span><span>{formatCurrency(item.adicionalViagem)}</span></div>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : "-"}
                                        </td>
                                        {/* Prêmio Assiduidade */}
                                        <td className="py-3 px-4 text-right font-medium text-slate-850 whitespace-nowrap">
                                            {item.absenteismoAward > 0 ? formatCurrency(item.absenteismoAward) : "-"}
                                        </td>
                                        {/* Provento Bruto */}
                                        <td className="py-3 px-4 text-right bg-slate-100/30 whitespace-nowrap">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <button className="font-bold text-slate-800 hover:text-slate-950 underline decoration-dashed cursor-pointer">
                                                        {formatCurrency(item.totalGrossSalary)}
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 p-3 text-xs space-y-2.5">
                                                    <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Composição do Salário Bruto</div>
                                                    
                                                    {item.isAdmittedThisMonth && (
                                                        <div className="bg-sky-50 p-2.5 rounded-xl border border-sky-100 text-[10px] space-y-1 text-sky-850 font-medium">
                                                            <div className="font-black text-sky-950 flex items-center gap-1">
                                                                <Info className="w-3.5 h-3.5 text-sky-500" />
                                                                <span>Admissão Proporcional (Pró-rata)</span>
                                                            </div>
                                                            <div className="flex justify-between"><span>Data de Admissão:</span><span className="font-bold">{item.admissionDate}</span></div>
                                                            <div className="flex justify-between"><span>Dias Proporcionais:</span><span className="font-bold">{item.daysWorked} de {item.totalDaysInMonth} dias</span></div>
                                                            <div className="flex justify-between"><span>Salário Base Cheio:</span><span className="font-bold">{formatCurrency(item.originalSalary)}</span></div>
                                                            <div className="flex justify-between"><span>Valor Diário:</span><span className="font-bold">{formatCurrency(Math.round((item.originalSalary / item.totalDaysInMonth) * 100) / 100)}/dia</span></div>
                                                        </div>
                                                     )}

                                                     <div className="space-y-1 text-[10px] text-slate-655 font-medium">
                                                         <div className="flex justify-between"><span>Salário Base Pago:</span><span className="font-bold text-slate-800">{formatCurrency(item.baseSalary)}</span></div>
                                                         {item.insalubridade > 0 && <div className="flex justify-between"><span>Insalubridade:</span><span className="font-bold text-slate-800">{formatCurrency(item.insalubridade)}</span></div>}
                                                         {item.periculosidade > 0 && <div className="flex justify-between"><span>Periculosidade:</span><span className="font-bold text-slate-800">{formatCurrency(item.periculosidade)}</span></div>}
                                                         {item.gratificacao > 0 && <div className="flex justify-between"><span>Gratificação CCT:</span><span className="font-bold text-slate-800">{formatCurrency(item.gratificacao)}</span></div>}
                                                         {item.outrosAdicionais > 0 && <div className="flex justify-between"><span>Outros Adicionais:</span><span className="font-bold text-slate-800">{formatCurrency(item.outrosAdicionais)}</span></div>}
                                                         {item.horasExtras50Value > 0 && <div className="flex justify-between"><span>H. Extras 50% ({formatHours(item.extras50Hours)}h):</span><span className="font-bold text-slate-800">{formatCurrency(item.horasExtras50Value)}</span></div>}
                                                         {item.horasExtras100Value > 0 && <div className="flex justify-between"><span>H. Extras 100% ({formatHours(item.extras100Hours)}h):</span><span className="font-bold text-slate-800">{formatCurrency(item.horasExtras100Value)}</span></div>}
                                                         {item.adicionalNoturnoValue > 0 && <div className="flex justify-between"><span>Adic. Noturno ({formatHours(item.adicionalNoturnoHours)}h):</span><span className="font-bold text-slate-800">{formatCurrency(item.adicionalNoturnoValue)}</span></div>}
                                                         {item.salarioFamilia > 0 && <div className="flex justify-between"><span>Salário-Família:</span><span className="font-bold text-slate-800">{formatCurrency(item.salarioFamilia)}</span></div>}
                                                         {item.absenteismoAward > 0 && <div className="flex justify-between"><span>Prêmio Absenteísmo:</span><span className="font-bold text-slate-800">{formatCurrency(item.absenteismoAward)}</span></div>}
                                                         {item.ajudaCusto > 0 && <div className="flex justify-between"><span>Ajuda de Custo:</span><span className="font-bold text-slate-800">{formatCurrency(item.ajudaCusto)}</span></div>}
                                                         {item.adicionalViagem > 0 && <div className="flex justify-between"><span>Adicional Viagem:</span><span className="font-bold text-slate-800">{formatCurrency(item.adicionalViagem)}</span></div>}
                                                     </div>
                                                </PopoverContent>
                                            </Popover>
                                        </td>
                                        {/* Faltas */}
                                        <td className="py-3 px-4 text-center whitespace-nowrap">
                                            {item.faltasCount > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="bg-red-50 hover:bg-red-100 text-red-650 font-bold px-2 py-0.5 rounded-lg border border-red-200/50 cursor-pointer text-xs">
                                                            {item.faltasCount} {item.faltasCount === 1 ? 'falta' : 'faltas'}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-72 p-3 text-xs space-y-2">
                                                        <div className="font-bold text-slate-900 border-b pb-1 text-[11px] flex justify-between">
                                                            <span>Rubrica: Desconto Faltas</span>
                                                            <span className="text-red-600">-{formatCurrency(item.faltaDeduction)}</span>
                                                        </div>
                                                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                                            {item.occurrencesList.filter(occ => occ.rawType === "FALTA" || occ.rawType === "FALTA_INJUSTIFICADA").map(occ => (
                                                                <div key={occ.id} className="p-1.5 rounded-lg border border-slate-100 bg-slate-50 text-[10px] space-y-0.5">
                                                                    <div className="flex justify-between font-bold text-slate-800">
                                                                        <span>{occ.date}</span>
                                                                        <span className="text-red-500">{occ.type}</span>
                                                                    </div>
                                                                    {occ.notes && <p className="text-slate-400 italic text-[9px] leading-tight">Nota: {occ.notes}</p>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="text-[9px] text-slate-500 italic pt-1 border-t leading-normal">
                                                            Fórmula CLT: (Salário Base + Adicionais Fixos) / 30 por falta injustificada.
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <span className="text-slate-350 text-xs">-</span>
                                            )}
                                        </td>
                                        {/* Atestados */}
                                        <td className="py-3 px-4 text-center whitespace-nowrap">
                                            {item.atestadosCount > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="bg-emerald-50 hover:bg-emerald-100 text-emerald-650 font-bold px-2 py-0.5 rounded-lg border border-emerald-200/50 cursor-pointer text-xs">
                                                            {item.atestadosCount} {item.atestadosCount === 1 ? 'atestado' : 'atestados'}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-72 p-3 text-xs space-y-2">
                                                        <div className="font-bold text-slate-900 border-b pb-1 text-[11px] flex justify-between">
                                                            <span>Atestados Médicos (Abonados)</span>
                                                            <span className="text-emerald-600">Abonado</span>
                                                        </div>
                                                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                                            {item.occurrencesList.filter(occ => occ.rawType === "ATESTADO").map(occ => (
                                                                <div key={occ.id} className="p-1.5 rounded-lg border border-slate-100 bg-slate-50 text-[10px] space-y-0.5">
                                                                    <div className="flex justify-between font-bold text-slate-800">
                                                                        <span>{occ.date}</span>
                                                                        <span className="text-emerald-500">{occ.type}</span>
                                                                    </div>
                                                                    {occ.notes && <p className="text-slate-400 italic text-[9px] leading-tight">Nota: {occ.notes}</p>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="text-[9px] text-slate-500 italic pt-1 border-t leading-normal">
                                                            Atestados médicos justificam e abonam a falta, mantendo a remuneração integral do dia.
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <span className="text-slate-350 text-xs">-</span>
                                            )}
                                        </td>
                                        {/* DSR */}
                                        <td className="py-3 px-4 text-center whitespace-nowrap">
                                            {item.dsrDeductionsCount > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="bg-red-50 hover:bg-red-100 text-red-650 font-bold px-2 py-0.5 rounded-lg border border-red-200/50 cursor-pointer text-xs">
                                                            {item.dsrDeductionsCount} {item.dsrDeductionsCount === 1 ? 'dia' : 'dias'}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-72 p-3 text-xs space-y-2">
                                                        <div className="font-bold text-slate-900 border-b pb-1 text-[11px] flex justify-between">
                                                            <span>Perda de DSR (CLT)</span>
                                                            <span className="text-red-600">-{formatCurrency(item.dsrDeduction)}</span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-650 leading-normal font-medium">
                                                            Pela Lei nº 605/49, a falta injustificada na semana retira do colaborador o direito de receber pelo descanso semanal remunerado daquela semana.
                                                        </p>
                                                        <div className="text-[9px] text-slate-500 italic pt-1 border-t leading-normal">
                                                            Fórmula CLT: (Salário Base + Adicionais Fixos) / 30 por semana com falta.
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <span className="text-slate-350 text-xs">-</span>
                                            )}
                                        </td>
                                        {/* Desconto Faltas */}
                                        <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/10 whitespace-nowrap">
                                            {item.faltaDeduction > 0 ? `-${formatCurrency(item.faltaDeduction)}` : "-"}
                                        </td>
                                        {/* Desconto DSR */}
                                        <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/10 whitespace-nowrap">
                                            {item.dsrDeduction > 0 ? `-${formatCurrency(item.dsrDeduction)}` : "-"}
                                        </td>
                                         {/* Desconto Atrasos */}
                                         <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/10 whitespace-nowrap">
                                             {item.atrasosDeduction > 0 ? (
                                                 <Popover>
                                                     <PopoverTrigger asChild>
                                                         <button className="underline decoration-dashed cursor-pointer font-bold text-red-500">
                                                             -{formatCurrency(item.atrasosDeduction)}
                                                         </button>
                                                     </PopoverTrigger>
                                                     <PopoverContent className="w-52 p-3 text-xs space-y-1">
                                                         <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Atrasos (Secullum)</div>
                                                         <div className="flex justify-between text-[10px] text-slate-655 font-medium">
                                                             <span>Horas de Atraso:</span>
                                                             <span>{formatHours(item.atrasosHours)}h</span>
                                                         </div>
                                                     </PopoverContent>
                                                 </Popover>
                                             ) : "-"}
                                         </td>
                                        {/* Desconto VT */}
                                        <td className="py-3 px-4 text-right text-orange-600 bg-orange-50/5 whitespace-nowrap">
                                            {item.vtPayrollDiscount > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="underline decoration-dashed cursor-pointer font-bold">
                                                            -{formatCurrency(item.vtPayrollDiscount)}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-60 p-3 text-xs space-y-1.5">
                                                        <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Desconto VT em Folha</div>
                                                        <div className="space-y-1 text-[10px] text-slate-650 font-medium">
                                                            <div className="flex justify-between"><span>Salário Base:</span><span>{formatCurrency(item.baseSalary)}</span></div>
                                                            <div className="flex justify-between"><span>Alíquota CCT:</span><span>{item.vtDiscountPercentage}%</span></div>
                                                            <div className="flex justify-between text-orange-600 border-t border-slate-100 pt-1 font-bold">
                                                                <span>Desconto Calculado:</span>
                                                                <span>{formatCurrency(item.vtPayrollDiscount)}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-[9px] text-slate-450 italic leading-normal border-t pt-1">
                                                            Nota: O desconto é limitado ao teto do valor do VT creditado para compra no mês.
                                                        </p>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <span className="text-slate-350">-</span>
                                            )}
                                        </td>
                                        {/* Desconto VA */}
                                        <td className="py-3 px-4 text-right text-orange-600 bg-orange-50/5 whitespace-nowrap">
                                            {item.vaPayrollDiscount > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="underline decoration-dashed cursor-pointer font-bold">
                                                            -{formatCurrency(item.vaPayrollDiscount)}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-64 p-3 text-xs space-y-1.5">
                                                        <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Desconto VA em Folha (CCT)</div>
                                                        <div className="space-y-1 text-[10px] text-slate-600 font-medium">
                                                            {item.vaBaseValue > 0 && <div className="flex justify-between"><span>VA Bruto Previsto:</span><span>{formatCurrency(item.vaBaseValue)}</span></div>}
                                                            {item.vaDeductionValue > 0 && <div className="flex justify-between text-red-500"><span>(-) Abatimento Faltas:</span><span>-{formatCurrency(item.vaDeductionValue)}</span></div>}
                                                            <div className="flex justify-between font-bold text-slate-800"><span>VA Líquido Creditado:</span><span>{formatCurrency(item.vaNetValue)}</span></div>
                                                            <div className="flex justify-between"><span>Alíquota Desconto (Posto):</span><span>{item.vaDiscountPercentage}%</span></div>
                                                            <div className="flex justify-between text-orange-600 border-t border-slate-100 pt-1 font-bold">
                                                                <span>Desconto em Folha:</span>
                                                                <span>{formatCurrency(item.vaPayrollDiscount)}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-[9px] text-slate-400 italic leading-normal border-t pt-1">
                                                            Nota: {item.vaDiscountPercentage}% calculado sobre o saldo líquido creditado ({formatCurrency(item.vaNetValue)}).
                                                        </p>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <span className="text-slate-350">-</span>
                                            )}
                                        </td>
                                        {/* Diversos Descontos */}
                                        <td className="py-3 px-4 text-right text-red-500 bg-red-50/5 whitespace-nowrap font-medium">
                                            {item.diversosDescontos > 0 ? (
                                                <span className="font-bold">-{formatCurrency(item.diversosDescontos)}</span>
                                            ) : (
                                                <span className="text-slate-350">-</span>
                                            )}
                                        </td>
                                        {/* Empréstimos */}
                                        <td className="py-3 px-4 text-right text-red-500 bg-red-50/5 whitespace-nowrap font-medium">
                                            {item.emprestimos > 0 ? (
                                                <span className="font-bold">-{formatCurrency(item.emprestimos)}</span>
                                            ) : (
                                                <span className="text-slate-350">-</span>
                                            )}
                                        </td>
                                        {/* Convênios */}
                                        <td className="py-3 px-4 text-right text-red-500 bg-red-50/5 whitespace-nowrap font-medium">
                                            {item.convenios > 0 ? (
                                                <span className="font-bold">-{formatCurrency(item.convenios)}</span>
                                            ) : (
                                                <span className="text-slate-350">-</span>
                                            )}
                                        </td>
                                        {/* Sindicato */}
                                        <td className="py-3 px-4 text-right text-red-500 bg-red-50/5 whitespace-nowrap font-medium">
                                            {item.sindicato > 0 ? (
                                                <span className="font-bold">-{formatCurrency(item.sindicato)}</span>
                                            ) : (
                                                <span className="text-slate-350">-</span>
                                            )}
                                        </td>
                                        {/* INSS */}
                                        <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/5 whitespace-nowrap">
                                            {item.inssDeduction > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="underline decoration-dashed cursor-pointer">
                                                            -{formatCurrency(item.inssDeduction)}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-64 p-3 text-xs space-y-1.5">
                                                        <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Cálculo Previdenciário (INSS)</div>
                                                        <div className="space-y-1 text-[10px] text-slate-650 font-medium">
                                                            <div className="flex justify-between"><span>Base de Cálculo:</span><span>{formatCurrency(Math.max(0, item.totalGrossSalary - item.faltaDeduction - item.dsrDeduction))}</span></div>
                                                            <div className="flex justify-between"><span>Tabela Progressiva:</span><span>7,5% a 14%</span></div>
                                                            <div className="flex justify-between text-red-600 border-t border-slate-100 pt-1 font-bold">
                                                                <span>Total INSS Descontado:</span>
                                                                <span>{formatCurrency(item.inssDeduction)}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-[9px] text-slate-450 italic leading-normal border-t pt-1">
                                                            Nota: Apuração progressiva CLT por faixas salariais (teto de R$ 908,86).
                                                        </p>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <span className="text-slate-350">-</span>
                                            )}
                                        </td>
                                        {/* IRRF */}
                                        <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/5 whitespace-nowrap">
                                            {item.irrfDeduction > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="underline decoration-dashed cursor-pointer">
                                                            -{formatCurrency(item.irrfDeduction)}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-64 p-3 text-xs space-y-1.5">
                                                        <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Imposto de Renda Retido (IRRF)</div>
                                                        <div className="space-y-1 text-[10px] text-slate-650 font-medium">
                                                            <div className="flex justify-between"><span>Base IRRF:</span><span>{formatCurrency(Math.min(Math.max(0, item.totalGrossSalary - item.faltaDeduction - item.dsrDeduction - item.inssDeduction), Math.max(0, item.totalGrossSalary - item.faltaDeduction - item.dsrDeduction - 564.80)))}</span></div>
                                                            <div className="flex justify-between text-red-600 border-t border-slate-100 pt-1 font-bold">
                                                                <span>Total IRRF Descontado:</span>
                                                                <span>{formatCurrency(item.irrfDeduction)}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-[9px] text-slate-450 italic leading-normal border-t pt-1">
                                                            Nota: Desconto em folha apurado progressivamente pela tabela da Receita Federal.
                                                        </p>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <span className="text-slate-350">-</span>
                                            )}
                                        </td>
                                        {/* Salário Líquido */}
                                        <td className="py-3 px-4 text-right font-black text-[13px] text-sky-700 sticky right-0 z-10 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)] whitespace-nowrap" style={{ position: "sticky", right: 0, backgroundColor: "#f0f9ff", zIndex: 10 }}>
                                            {formatCurrency(item.netSalary)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* VISÕES AGRUPADAS (EMPRESA OU CONTRATO) */
                    <div className="overflow-x-auto relative">
                        <table className="text-left border-collapse" style={{ minWidth: "1400px", tableLayout: "fixed" }}>
                            <colgroup>
                                <col style={{ width: "60px" }} /> {/* Toggle button */}
                                <col style={{ width: "350px" }} /> {/* Group Name */}
                                <col style={{ width: "120px" }} /> {/* Qtd Ativos */}
                                <col style={{ width: "160px" }} /> {/* Proventos Brutos */}
                                <col style={{ width: "160px" }} /> {/* Total Desc. Faltas */}
                                <col style={{ width: "160px" }} /> {/* Total Desc. DSR */}
                                <col style={{ width: "130px" }} /> {/* Total Desc. VT */}
                                <col style={{ width: "130px" }} /> {/* Total Desc. VA */}
                                <col style={{ width: "140px" }} /> {/* Total Desc. Diversos */}
                                <col style={{ width: "140px" }} /> {/* Total Empréstimos */}
                                <col style={{ width: "140px" }} /> {/* Total Convênios */}
                                <col style={{ width: "140px" }} /> {/* Total Sindicatos */}
                                <col style={{ width: "130px" }} /> {/* Total INSS */}
                                <col style={{ width: "130px" }} /> {/* Total IRRF */}
                                <col style={{ width: "170px" }} /> {/* Líquido Consolidado */}
                            </colgroup>
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    <th className="py-3 px-4 w-6" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}></th>
                                    <th className="py-3 px-4" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>{groupedView === "empresa" ? "Empresa" : "Contrato / Cliente"}</th>
                                    <th className="py-3 px-4 text-center" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Qtd Ativos</th>
                                    <th className="py-3 px-4 text-right" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Proventos Brutos</th>
                                    <th className="py-3 px-4 text-right text-red-500 bg-red-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Total Desc. Faltas</th>
                                    <th className="py-3 px-4 text-right text-red-500 bg-red-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Total Desc. DSR</th>
                                    <th className="py-3 px-4 text-right text-orange-500 bg-orange-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Total Desc. VT</th>
                                    <th className="py-3 px-4 text-right text-orange-500 bg-orange-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Total Desc. VA</th>
                                    <th className="py-3 px-4 text-right text-red-500 bg-red-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Total Desc. Diversos</th>
                                    <th className="py-3 px-4 text-right text-red-500 bg-red-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Total Empréstimos</th>
                                    <th className="py-3 px-4 text-right text-red-500 bg-red-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Total Convênios</th>
                                    <th className="py-3 px-4 text-right text-red-500 bg-red-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Total Sindicato</th>
                                    <th className="py-3 px-4 text-right text-red-500 bg-red-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Total INSS</th>
                                    <th className="py-3 px-4 text-right text-red-500 bg-red-50/20" style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 20 }}>Total IRRF</th>
                                    <th className="py-3 px-4 text-right font-bold text-sky-900 sticky right-0 z-20 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)]" style={{ position: "sticky", top: 0, right: 0, backgroundColor: "#f1f5f9", zIndex: 30 }}>Líquido Consolidado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-650">
                                {Object.values(groupedView === "empresa" ? groupedByCompany : groupedByClient).map((group: any) => {
                                    const isExpanded = expandedGroups.includes(group.name);
                                    return (
                                        <>
                                            <tr key={group.name} className="hover:bg-slate-50 bg-slate-50/10 font-bold text-slate-800">
                                                {/* Botão de expansão */}
                                                <td className="py-3 px-4 text-center">
                                                    <button 
                                                        onClick={() => toggleGroup(group.name)}
                                                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
                                                    >
                                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                                {/* Nome do grupo */}
                                                <td className="py-3 px-4 font-black text-[13px] text-slate-900 whitespace-nowrap">
                                                    {group.name}
                                                </td>
                                                {/* Quantidade */}
                                                <td className="py-3 px-4 text-center whitespace-nowrap">
                                                    <span className="bg-slate-150 px-2 py-0.5 rounded-lg border border-slate-200/50">
                                                        {group.count}
                                                    </span>
                                                </td>
                                                {/* Proventos Brutos */}
                                                <td className="py-3 px-4 text-right font-black whitespace-nowrap">
                                                    {formatCurrency(group.totalGrossSalary)}
                                                </td>
                                                {/* Desconto Faltas */}
                                                <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/10 whitespace-nowrap">
                                                    {group.faltaDeduction > 0 ? `-${formatCurrency(group.faltaDeduction)}` : "-"}
                                                </td>
                                                {/* Desconto DSR */}
                                                <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/10 whitespace-nowrap">
                                                    {group.dsrDeduction > 0 ? `-${formatCurrency(group.dsrDeduction)}` : "-"}
                                                </td>
                                                {/* Desconto VT */}
                                                <td className="py-3 px-4 text-right text-orange-600 font-bold bg-orange-50/5 whitespace-nowrap">
                                                    {group.vtPayrollDiscount > 0 ? `-${formatCurrency(group.vtPayrollDiscount)}` : "-"}
                                                </td>
                                                {/* Desconto VA */}
                                                <td className="py-3 px-4 text-right text-orange-600 font-bold bg-orange-50/5 whitespace-nowrap">
                                                    {group.vaPayrollDiscount > 0 ? `-${formatCurrency(group.vaPayrollDiscount)}` : "-"}
                                                </td>
                                                {/* Diversos Descontos */}
                                                <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/5 whitespace-nowrap">
                                                    {group.diversosDescontos > 0 ? `-${formatCurrency(group.diversosDescontos)}` : "-"}
                                                </td>
                                                {/* Empréstimos */}
                                                <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/5 whitespace-nowrap">
                                                    {group.emprestimos > 0 ? `-${formatCurrency(group.emprestimos)}` : "-"}
                                                </td>
                                                {/* Convênios */}
                                                <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/5 whitespace-nowrap">
                                                    {group.convenios > 0 ? `-${formatCurrency(group.convenios)}` : "-"}
                                                </td>
                                                {/* Sindicato */}
                                                <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/5 whitespace-nowrap">
                                                    {group.sindicato > 0 ? `-${formatCurrency(group.sindicato)}` : "-"}
                                                </td>
                                                {/* Total INSS */}
                                                <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/5 whitespace-nowrap">
                                                    {group.inssDeduction > 0 ? `-${formatCurrency(group.inssDeduction)}` : "-"}
                                                </td>
                                                {/* Total IRRF */}
                                                <td className="py-3 px-4 text-right text-red-500 font-bold bg-red-50/5 whitespace-nowrap">
                                                    {group.irrfDeduction > 0 ? `-${formatCurrency(group.irrfDeduction)}` : "-"}
                                                </td>
                                                {/* Líquido */}
                                                <td className="py-3 px-4 text-right font-black text-sky-700 text-[13px] sticky right-0 z-10 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)] whitespace-nowrap" style={{ position: "sticky", right: 0, backgroundColor: "#f0f9ff", zIndex: 10 }}>
                                                    {formatCurrency(group.netSalary)}
                                                </td>
                                            </tr>

                                            {/* Expandível individual do grupo */}
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={15} className="p-0 bg-slate-50/30">
                                                        <div className="overflow-hidden border-t border-b border-slate-100 pl-12 pr-4 py-3">
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">Detalhamento dos Colaboradores</span>
                                                            <div className="overflow-x-auto">
                                                                <table className="text-left border-collapse bg-white rounded-2xl border border-slate-200/60 overflow-hidden text-[11px]" style={{ minWidth: "2460px", tableLayout: "fixed" }}>
                                                                    <colgroup>
                                                                        <col style={{ width: "260px" }} /> {/* Colaborador */}
                                                                        <col style={{ width: "120px" }} /> {/* Salário Base */}
                                                                        <col style={{ width: "120px" }} /> {/* Insalubridade */}
                                                                        <col style={{ width: "120px" }} /> {/* Periculosidade */}
                                                                        <col style={{ width: "130px" }} /> {/* Outros Adicionais */}
                                                                                                                                                 <col style={{ width: "130px" }} /> {/* H. Extras */}
                                                                         <col style={{ width: "130px" }} /> {/* Adic. Noturno */}
                                                                         <col style={{ width: "130px" }} /> {/* Salário-Família */}
                                                                         
                                                                         <col style={{ width: "130px" }} /> {/* Ajuda Custo */}
                                                                         <col style={{ width: "145px" }} /> {/* Prêmio Assiduidade */}
<col style={{ width: "140px" }} /> {/* Provento Bruto */}
                                                                        <col style={{ width: "90px" }} /> {/* Faltas */}
                                                                        <col style={{ width: "90px" }} /> {/* Atestados */}
                                                                        <col style={{ width: "90px" }} /> {/* DSR */}
                                                                        <col style={{ width: "130px" }} /> {/* Desc. Faltas */}
                                                                        <col style={{ width: "130px" }} /> {/* Desc. DSR */}
                                                                         <col style={{ width: "130px" }} /> {/* Desc. Atrasos */}
                                                                        <col style={{ width: "120px" }} /> {/* Desc. VT */}
                                                                        <col style={{ width: "120px" }} /> {/* Desc. VA */}
                                                                        <col style={{ width: "120px" }} /> {/* Desc. Diversos */}
                                                                        <col style={{ width: "120px" }} /> {/* Empréstimos */}
                                                                        <col style={{ width: "120px" }} /> {/* Convênios */}
                                                                        <col style={{ width: "120px" }} /> {/* Sindicatos */}
                                                                        <col style={{ width: "120px" }} /> {/* INSS */}
                                                                        <col style={{ width: "120px" }} /> {/* IRRF */}
                                                                        <col style={{ width: "140px" }} /> {/* Líquido Final */}
                                                                    </colgroup>
                                                                    <thead>
                                                                        <tr className="border-b border-slate-100 bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                                                            <th className="py-2.5 px-3">Colaborador / CPF / Função</th>
                                                                            <th className="py-2.5 px-3 text-right">Salário Base</th>
                                                                            <th className="py-2.5 px-3 text-right">Insalubridade</th>
                                                                            <th className="py-2.5 px-3 text-right">Periculosidade</th>
                                                                            <th className="py-2.5 px-3 text-right">Outros Adicionais</th>
                                                                                                                                                         <th className="py-2.5 px-3 text-right bg-sky-50/50">H. Extras</th>
                                                                             <th className="py-2.5 px-3 text-right bg-sky-50/50">Adic. Noturno</th>
                                                                             <th className="py-2.5 px-3 text-right bg-sky-50/50">Salário-Família</th>
                                                                             
                                                                             <th className="py-2.5 px-3 text-right bg-sky-50/50">Ajuda Custo</th>
                                                                             <th className="py-2.5 px-3 text-right bg-sky-50/50">Prêmio Assiduidade</th>
<th className="py-2.5 px-3 text-right bg-slate-100/50">Provento Bruto</th>
                                                                            <th className="py-2.5 px-3 text-center">Faltas</th>
                                                                            <th className="py-2.5 px-3 text-center">Atestados</th>
                                                                            <th className="py-2.5 px-3 text-center">DSR</th>
                                                                            <th className="py-2.5 px-3 text-right text-red-500 bg-red-50/10">Desc. Faltas</th>
                                                                            <th className="py-2.5 px-3 text-right text-red-500 bg-red-50/10">Desc. DSR</th>
                                                                             <th className="py-2.5 px-3 text-right text-red-500 bg-red-50/10">Desc. Atrasos</th>
                                                                            <th className="py-2.5 px-3 text-right text-orange-655 bg-orange-50/5">Desc. VT</th>
                                                                            <th className="py-2.5 px-3 text-right text-orange-655 bg-orange-50/5">Desc. VA</th>
                                                                            <th className="py-2.5 px-3 text-right text-red-500 bg-red-50/10">Desc. Diversos</th>
                                                                            <th className="py-2.5 px-3 text-right text-red-500 bg-red-50/10">Empréstimos</th>
                                                                            <th className="py-2.5 px-3 text-right text-red-500 bg-red-50/10">Convênios</th>
                                                                            <th className="py-2.5 px-3 text-right text-red-500 bg-red-50/10">Sindicato</th>
                                                                            <th className="py-2.5 px-3 text-right text-red-500 bg-red-50/10">INSS</th>
                                                                            <th className="py-2.5 px-3 text-right text-red-500 bg-red-50/10">IRRF</th>
                                                                            <th className="py-2.5 px-3 text-right font-bold text-sky-900 sticky right-0 z-20 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)]" style={{ position: "sticky", right: 0, backgroundColor: "#f1f5f9", zIndex: 20 }}>Líquido Final</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-650">
                                                                        {group.items.map((sub: PayrollPreviewItem) => (
                                                                            <tr key={sub.employeeId} className="hover:bg-slate-50/80 transition-colors">
                                                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                                                    <div>
                                                                                        <div className="font-bold text-slate-850">{sub.employeeName}</div>
                                                                                        <div className="text-[9px] text-slate-400 font-medium">CPF: {sub.employeeCpf} | {sub.postoName}</div>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                                                                                    {formatCurrency(sub.baseSalary)}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                                                                                    {sub.insalubridade > 0 ? formatCurrency(sub.insalubridade) : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                                                                                    {sub.periculosidade > 0 ? formatCurrency(sub.periculosidade) : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                                                                                    {sub.gratificacao + sub.outrosAdicionais > 0 ? formatCurrency(sub.gratificacao + sub.outrosAdicionais) : "-"}
                                                                                </td>
                                                                                 {/* H. Extras */}
                                                                                 <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                                                                                     {sub.horasExtras50Value + sub.horasExtras100Value > 0 ? (
                                                                                         <Popover>
                                                                                             <PopoverTrigger asChild>
                                                                                                 <button className="underline decoration-dashed cursor-pointer text-slate-700 hover:text-slate-900">
                                                                                                     {formatCurrency(sub.horasExtras50Value + sub.horasExtras100Value)}
                                                                                                 </button>
                                                                                             </PopoverTrigger>
                                                                                             <PopoverContent className="w-56 p-3 text-xs space-y-1.5">
                                                                                                 <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Horas Extras (Secullum)</div>
                                                                                                 <div className="space-y-1 text-[10px] text-slate-655 font-medium">
                                                                                                     <div className="flex justify-between"><span>Extras 50%:</span><span>{formatHours(sub.extras50Hours)}h ({formatCurrency(sub.horasExtras50Value)})</span></div>
                                                                                                     <div className="flex justify-between"><span>Extras 100%:</span><span>{formatHours(sub.extras100Hours)}h ({formatCurrency(sub.horasExtras100Value)})</span></div>
                                                                                                 </div>
                                                                                             </PopoverContent>
                                                                                         </Popover>
                                                                                     ) : "-"}
                                                                                 </td>
                                                                                 {/* Adic. Noturno */}
                                                                                 <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                                                                                     {sub.adicionalNoturnoValue > 0 ? (
                                                                                         <Popover>
                                                                                             <PopoverTrigger asChild>
                                                                                                 <button className="underline decoration-dashed cursor-pointer text-slate-700 hover:text-slate-900">
                                                                                                     {formatCurrency(sub.adicionalNoturnoValue)} <span className="text-[10px] text-slate-400 font-normal">({formatHours(sub.adicionalNoturnoHours)}h)</span>
                                                                                                 </button>
                                                                                             </PopoverTrigger>
                                                                                             <PopoverContent className="w-52 p-3 text-xs space-y-1">
                                                                                                 <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Adicional Noturno (Ponto)</div>
                                                                                                 <div className="flex justify-between text-[10px] text-slate-655 font-medium">
                                                                                                     <span>Horas Sincronizadas:</span>
                                                                                                     <span>{formatHours(sub.adicionalNoturnoHours)}h</span>
                                                                                                 </div>
                                                                                             </PopoverContent>
                                                                                         </Popover>
                                                                                     ) : "-"}
                                                                                 </td>
                                                                                 {/* Salário-Família */}
                                                                                 <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                                                                                     {sub.salarioFamilia > 0 ? (
                                                                                         <Popover>
                                                                                             <PopoverTrigger asChild>
                                                                                                 <button className="underline decoration-dashed cursor-pointer text-slate-700 hover:text-slate-900">
                                                                                                     {formatCurrency(sub.salarioFamilia)}
                                                                                                 </button>
                                                                                             </PopoverTrigger>
                                                                                             <PopoverContent className="w-56 p-3 text-xs space-y-1">
                                                                                                 <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Salário-Família</div>
                                                                                                 <div className="flex justify-between text-[10px] text-slate-655 font-medium">
                                                                                                     <span>Qtd Dependentes:</span>
                                                                                                     <span>{sub.dependentsCount}</span>
                                                                                                 </div>
                                                                                             </PopoverContent>
                                                                                         </Popover>
                                                                                     ) : "-"}
                                                                                 </td>
                                                                                 {/* Ajuda Custo */}
                                                                                 <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                                                                                     {sub.ajudaCusto + sub.adicionalViagem > 0 ? (
                                                                                         <Popover>
                                                                                             <PopoverTrigger asChild>
                                                                                                 <button className="underline decoration-dashed cursor-pointer text-slate-700 hover:text-slate-900">
                                                                                                     {formatCurrency(sub.ajudaCusto + sub.adicionalViagem)}
                                                                                                 </button>
                                                                                             </PopoverTrigger>
                                                                                             <PopoverContent className="w-56 p-3 text-xs space-y-1.5">
                                                                                                 <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Ajuda de Custo / Viagem</div>
                                                                                                 <div className="space-y-1 text-[10px] text-slate-655 font-medium">
                                                                                                     <div className="flex justify-between"><span>Ajuda de Custo:</span><span>{formatCurrency(sub.ajudaCusto)}</span></div>
                                                                                                     <div className="flex justify-between"><span>Adic. Viagem:</span><span>{formatCurrency(sub.adicionalViagem)}</span></div>
                                                                                                 </div>
                                                                                             </PopoverContent>
                                                                                         </Popover>
                                                                                     ) : "-"}
                                                                                 </td>
                                                                                 {/* Prêmio Assiduidade */}
                                                                                 <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                                                                                     {sub.absenteismoAward > 0 ? formatCurrency(sub.absenteismoAward) : "-"}
                                                                                 </td>
                                                                                <td className="py-2.5 px-3 text-right bg-slate-100/30 whitespace-nowrap">
                                                                                    <Popover>
                                                                                        <PopoverTrigger asChild>
                                                                                            <button className="font-bold text-slate-700 hover:text-slate-850 underline decoration-dashed cursor-pointer">
                                                                                                {formatCurrency(sub.totalGrossSalary)}
                                                                                            </button>
                                                                                        </PopoverTrigger>
                                                                                        <PopoverContent className="w-64 p-3 text-xs space-y-2.5">
                                                                                            <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Composição do Salário Bruto</div>
                                                                                            
                                                                                            {sub.isAdmittedThisMonth && (
                                                                                                <div className="bg-sky-50 p-2.5 rounded-xl border border-sky-100 text-[10px] space-y-1 text-sky-850 font-medium">
                                                                                                    <div className="font-black text-sky-950 flex items-center gap-1">
                                                                                                        <Info className="w-3.5 h-3.5 text-sky-500" />
                                                                                                        <span>Admissão Proporcional (Pró-rata)</span>
                                                                                                    </div>
                                                                                                    <div className="flex justify-between"><span>Data de Admissão:</span><span className="font-bold">{sub.admissionDate}</span></div>
                                                                                                    <div className="flex justify-between"><span>Dias Proporcionais:</span><span className="font-bold">{sub.daysWorked} de {sub.totalDaysInMonth} dias</span></div>
                                                                                                    <div className="flex justify-between"><span>Salário Base Cheio:</span><span className="font-bold">{formatCurrency(sub.originalSalary)}</span></div>
                                                                                                    <div className="flex justify-between"><span>Valor Diário:</span><span className="font-bold">{formatCurrency(Math.round((sub.originalSalary / sub.totalDaysInMonth) * 100) / 100)}/dia</span></div>
                                                                                                </div>
                                                                                            )}

                                                                                            <div className="space-y-1 text-[10px] text-slate-655 font-medium">
                                                                                                <div className="flex justify-between"><span>Salário Base Pago:</span><span className="font-bold text-slate-800">{formatCurrency(sub.baseSalary)}</span></div>
                                                                                                {sub.insalubridade > 0 && <div className="flex justify-between"><span>Insalubridade:</span><span className="font-bold text-slate-800">{formatCurrency(sub.insalubridade)}</span></div>}
                                                                                                {sub.periculosidade > 0 && <div className="flex justify-between"><span>Periculosidade:</span><span className="font-bold text-slate-800">{formatCurrency(sub.periculosidade)}</span></div>}
                                                                                                {sub.gratificacao > 0 && <div className="flex justify-between"><span>Gratificação CCT:</span><span className="font-bold text-slate-800">{formatCurrency(sub.gratificacao)}</span></div>}
                                                                                                {sub.outrosAdicionais > 0 && <div className="flex justify-between"><span>Outros Adicionais:</span><span className="font-bold text-slate-800">{formatCurrency(sub.outrosAdicionais)}</span></div>}
                                                                                                {sub.horasExtras50Value > 0 && <div className="flex justify-between"><span>H. Extras 50% ({formatHours(sub.extras50Hours)}h):</span><span className="font-bold text-slate-800">{formatCurrency(sub.horasExtras50Value)}</span></div>}
                                                                                                {sub.horasExtras100Value > 0 && <div className="flex justify-between"><span>H. Extras 100% ({formatHours(sub.extras100Hours)}h):</span><span className="font-bold text-slate-800">{formatCurrency(sub.horasExtras100Value)}</span></div>}
                                                                                                {sub.adicionalNoturnoValue > 0 && <div className="flex justify-between"><span>Adic. Noturno ({formatHours(sub.adicionalNoturnoHours)}h):</span><span className="font-bold text-slate-800">{formatCurrency(sub.adicionalNoturnoValue)}</span></div>}
                                                                                                {sub.salarioFamilia > 0 && <div className="flex justify-between"><span>Salário-Família:</span><span className="font-bold text-slate-800">{formatCurrency(sub.salarioFamilia)}</span></div>}
                                                                                                {sub.absenteismoAward > 0 && <div className="flex justify-between"><span>Prêmio Absenteísmo:</span><span className="font-bold text-slate-800">{formatCurrency(sub.absenteismoAward)}</span></div>}
                                                                                                {sub.ajudaCusto > 0 && <div className="flex justify-between"><span>Ajuda de Custo:</span><span className="font-bold text-slate-800">{formatCurrency(sub.ajudaCusto)}</span></div>}
                                                                                                {sub.adicionalViagem > 0 && <div className="flex justify-between"><span>Adicional Viagem:</span><span className="font-bold text-slate-800">{formatCurrency(sub.adicionalViagem)}</span></div>}
                                                                                            </div>
                                                                                        </PopoverContent>
                                                                                    </Popover>
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                                    {sub.faltasCount > 0 ? (
                                                                                        <Popover>
                                                                                            <PopoverTrigger asChild>
                                                                                                <button className="bg-red-50 hover:bg-red-100 text-red-655 font-bold px-1.5 py-0.5 rounded text-[10px] border border-red-200/50 cursor-pointer">
                                                                                                    {sub.faltasCount} {sub.faltasCount === 1 ? 'falta' : 'faltas'}
                                                                                                </button>
                                                                                            </PopoverTrigger>
                                                                                            <PopoverContent className="w-72 p-3 text-xs space-y-2">
                                                                                                <div className="font-bold text-slate-900 border-b pb-1 text-[11px] flex justify-between">
                                                                                                    <span>Desconto Faltas</span>
                                                                                                    <span className="text-red-500">-{formatCurrency(sub.faltaDeduction)}</span>
                                                                                                </div>
                                                                                                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                                                                                    {sub.occurrencesList.filter(o => o.rawType === "FALTA" || o.rawType === "FALTA_INJUSTIFICADA").map(occ => (
                                                                                                        <div key={occ.id} className="p-1 rounded bg-slate-50 border border-slate-100 text-[10px]">
                                                                                                            <div className="flex justify-between font-bold text-slate-800">
                                                                                                                <span>{occ.date}</span>
                                                                                                                <span className="text-red-500">{occ.type}</span>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            </PopoverContent>
                                                                                        </Popover>
                                                                                    ) : (
                                                                                        <span className="text-slate-355">-</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                                    {sub.atestadosCount > 0 ? (
                                                                                        <Popover>
                                                                                            <PopoverTrigger asChild>
                                                                                                <button className="bg-emerald-50 hover:bg-emerald-100 text-emerald-655 font-bold px-1.5 py-0.5 rounded text-[10px] border border-emerald-200/50 cursor-pointer">
                                                                                                    {sub.atestadosCount} {sub.atestadosCount === 1 ? 'atestado' : 'atestados'}
                                                                                                </button>
                                                                                            </PopoverTrigger>
                                                                                            <PopoverContent className="w-72 p-3 text-xs space-y-2">
                                                                                                <div className="font-bold text-slate-900 border-b pb-1 text-[11px] flex justify-between">
                                                                                                    <span>Atestados Médicos (Abonados)</span>
                                                                                                    <span className="text-emerald-500">Abonado</span>
                                                                                                </div>
                                                                                                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                                                                                    {sub.occurrencesList.filter(o => o.rawType === "ATESTADO").map(occ => (
                                                                                                        <div key={occ.id} className="p-1 rounded bg-slate-50 border border-slate-100 text-[10px]">
                                                                                                            <div className="flex justify-between font-bold text-slate-800">
                                                                                                                <span>{occ.date}</span>
                                                                                                                <span className="text-emerald-500">{occ.type}</span>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            </PopoverContent>
                                                                                        </Popover>
                                                                                    ) : (
                                                                                        <span className="text-slate-355">-</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                                    {sub.dsrDeductionsCount > 0 ? (
                                                                                        <Popover>
                                                                                            <PopoverTrigger asChild>
                                                                                                <button className="bg-red-50 hover:bg-red-100 text-red-655 font-bold px-1.5 py-0.5 rounded text-[10px] border border-red-200/50 cursor-pointer">
                                                                                                    {sub.dsrDeductionsCount} {sub.dsrDeductionsCount === 1 ? 'dia' : 'dias'}
                                                                                                </button>
                                                                                            </PopoverTrigger>
                                                                                            <PopoverContent className="w-72 p-3 text-xs space-y-2">
                                                                                                <div className="font-bold text-slate-900 border-b pb-1 text-[11px] flex justify-between">
                                                                                                    <span>Dedução de DSR</span>
                                                                                                    <span className="text-red-500">-{formatCurrency(sub.dsrDeduction)}</span>
                                                                                                </div>
                                                                                            </PopoverContent>
                                                                                        </Popover>
                                                                                    ) : (
                                                                                        <span className="text-slate-355">-</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right text-red-500 whitespace-nowrap">
                                                                                    {sub.faltaDeduction > 0 ? `-${formatCurrency(sub.faltaDeduction)}` : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right text-red-500 whitespace-nowrap">
                                                                                    {sub.dsrDeduction > 0 ? `-${formatCurrency(sub.dsrDeduction)}` : "-"}
                                                                                </td>
                                                                                 {/* Desconto Atrasos */}
                                                                                 <td className="py-2.5 px-3 text-right text-red-500 whitespace-nowrap">
                                                                                     {sub.atrasosDeduction > 0 ? (
                                                                                         <Popover>
                                                                                             <PopoverTrigger asChild>
                                                                                                 <button className="underline decoration-dashed cursor-pointer font-bold text-red-500 text-xs">
                                                                                                     -{formatCurrency(sub.atrasosDeduction)}
                                                                                                 </button>
                                                                                             </PopoverTrigger>
                                                                                             <PopoverContent className="w-52 p-3 text-xs space-y-1">
                                                                                                 <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Atrasos (Secullum)</div>
                                                                                                 <div className="flex justify-between text-[10px] text-slate-655 font-medium">
                                                                                                     <span>Horas de Atraso:</span>
                                                                                                     <span>{formatHours(sub.atrasosHours)}h</span>
                                                                                                 </div>
                                                                                             </PopoverContent>
                                                                                         </Popover>
                                                                                     ) : "-"}
                                                                                 </td>
                                                                                <td className="py-2.5 px-3 text-right text-orange-600 whitespace-nowrap">
                                                                                    {sub.vtPayrollDiscount > 0 ? `-${formatCurrency(sub.vtPayrollDiscount)}` : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right text-orange-655 whitespace-nowrap">
                                                                                     {sub.vaPayrollDiscount > 0 ? (
                                                                                         <Popover>
                                                                                             <PopoverTrigger asChild>
                                                                                                 <button className="underline decoration-dashed cursor-pointer font-bold">
                                                                                                     -{formatCurrency(sub.vaPayrollDiscount)}
                                                                                                 </button>
                                                                                             </PopoverTrigger>
                                                                                             <PopoverContent className="w-64 p-3 text-xs space-y-1.5">
                                                                                                 <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">Desconto VA em Folha (CCT)</div>
                                                                                                 <div className="space-y-1 text-[10px] text-slate-600 font-medium">
                                                                                                     {sub.vaBaseValue > 0 && <div className="flex justify-between"><span>VA Bruto:</span><span>{formatCurrency(sub.vaBaseValue)}</span></div>}
                                                                                                     {sub.vaDeductionValue > 0 && <div className="flex justify-between text-red-500"><span>(-) Faltas:</span><span>-{formatCurrency(sub.vaDeductionValue)}</span></div>}
                                                                                                     <div className="flex justify-between font-bold text-slate-800"><span>VA Líquido Creditado:</span><span>{formatCurrency(sub.vaNetValue)}</span></div>
                                                                                                     <div className="flex justify-between"><span>Alíquota (Posto):</span><span>{sub.vaDiscountPercentage}%</span></div>
                                                                                                     <div className="flex justify-between text-orange-600 border-t border-slate-100 pt-1 font-bold">
                                                                                                         <span>Desconto em Folha:</span>
                                                                                                         <span>{formatCurrency(sub.vaPayrollDiscount)}</span>
                                                                                                     </div>
                                                                                                 </div>
                                                                                             </PopoverContent>
                                                                                         </Popover>
                                                                                     ) : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right text-red-500 whitespace-nowrap">
                                                                                    {sub.diversosDescontos > 0 ? `-${formatCurrency(sub.diversosDescontos)}` : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right text-red-500 whitespace-nowrap">
                                                                                    {sub.emprestimos > 0 ? `-${formatCurrency(sub.emprestimos)}` : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right text-red-500 whitespace-nowrap">
                                                                                    {sub.convenios > 0 ? `-${formatCurrency(sub.convenios)}` : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right text-red-500 whitespace-nowrap">
                                                                                    {sub.sindicato > 0 ? `-${formatCurrency(sub.sindicato)}` : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right text-red-500 whitespace-nowrap">
                                                                                    {sub.inssDeduction > 0 ? `-${formatCurrency(sub.inssDeduction)}` : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right text-red-500 whitespace-nowrap">
                                                                                    {sub.irrfDeduction > 0 ? `-${formatCurrency(sub.irrfDeduction)}` : "-"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-right font-bold text-sky-900 sticky right-0 z-10 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.1)] whitespace-nowrap" style={{ position: "sticky", right: 0, backgroundColor: "#f0f9ff", zIndex: 10 }}>
                                                                                    {formatCurrency(sub.netSalary)}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {/* EXPORT PAYROLL EXCEL MODAL */}
            <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
                <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-3xl">
                    <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-emerald-50/50">
                        <DialogTitle className="flex items-center gap-2 text-lg font-black text-emerald-700">
                            <Download className="w-5 h-5 text-emerald-600" /> Exportar Prévia de Folha
                        </DialogTitle>
                        <DialogDescription className="text-xs text-emerald-805">
                            Selecione os filtros de empresa, contrato e competência para gerar a planilha.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                        <div className="space-y-1.5">
                            <Label className="font-bold text-slate-700">Empresa</Label>
                            <Combobox
                                options={[
                                    { value: "all", label: "Todas as Empresas" },
                                    ...uniqueCompanies.map(c => ({ value: c, label: c }))
                                ]}
                                value={exportSelectedCompany}
                                onChange={setExportSelectedCompany}
                                placeholder="Todas as Empresas"
                                searchPlaceholder="Buscar empresa..."
                                className="h-9"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="font-bold text-slate-700">Contrato / Centro de Custo</Label>
                            <Combobox
                                options={[
                                    { value: "all", label: "Todos os Contratos" },
                                    ...uniqueClients.map(c => ({ value: c, label: c }))
                                ]}
                                value={exportSelectedClient}
                                onChange={setExportSelectedClient}
                                placeholder="Todos os Contratos"
                                searchPlaceholder="Buscar contrato..."
                                className="h-9"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="font-bold text-slate-700">Mês de Competência</Label>
                                <Select value={String(exportSelectedMonth)} onValueChange={val => setExportSelectedMonth(Number(val))}>
                                    <SelectTrigger className="h-9 w-full rounded-xl bg-white border-slate-200 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
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
                            </div>

                            <div className="space-y-1.5">
                                <Label className="font-bold text-slate-700">Ano</Label>
                                <Select value={String(exportSelectedYear)} onValueChange={val => setExportSelectedYear(Number(val))}>
                                    <SelectTrigger className="h-9 w-full rounded-xl bg-white border-slate-200 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="2025">2025</SelectItem>
                                        <SelectItem value="2026">2026</SelectItem>
                                        <SelectItem value="2027">2027</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setExportModalOpen(false)}>Cancelar</Button>
                        <Button 
                            onClick={handleExportToExcel} 
                            disabled={isLoadingExport}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
                        >
                            {isLoadingExport ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Exportar Excel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* EDIT MANUAL DEDUCTIONS MODAL */}
            <Dialog open={editDeductionsOpen} onOpenChange={setEditDeductionsOpen}>
                <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-3xl">
                    <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-red-50/50">
                        <DialogTitle className="flex items-center gap-2 text-lg font-black text-red-700">
                            <Edit className="w-5 h-5 text-red-650" /> Lançamentos Avulsos
                        </DialogTitle>
                        <DialogDescription className="text-xs text-red-800">
                            Lançar descontos manuais e empréstimos esporádicos para a folha de pagamento deste mês.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedEmployeeItem && (
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                            {/* Employee Quick Info */}
                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                                <div className="flex justify-between font-bold text-slate-800">
                                    <span>Colaborador:</span>
                                    <span className="text-slate-900">{selectedEmployeeItem.employeeName}</span>
                                </div>
                                <div className="flex justify-between text-slate-500 font-medium">
                                    <span>CPF:</span>
                                    <span>{selectedEmployeeItem.employeeCpf}</span>
                                </div>
                                <div className="flex justify-between text-slate-500 font-medium border-t border-slate-200/60 pt-1 mt-1">
                                    <span>Competência:</span>
                                    <span className="font-bold text-slate-700">{selectedMonth}/{selectedYear}</span>
                                </div>
                            </div>

                            {/* Inputs */}
                            <div className="space-y-3.5">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <Label className="font-bold text-slate-750 text-[10px]">H. Extras 50%</Label>
                                            <span className="text-[9px] font-bold text-emerald-605">
                                                {inputExtras50 ? (parseFloat(inputExtras50) > 0 ? formatCurrency(selectedEmployeeItem.hourlyRate * 1.5 * parseFloat(inputExtras50)) : 'R$ 0,00') : 'R$ 0,00'}
                                            </span>
                                        </div>
                                        <Input 
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            value={inputExtras50}
                                            onChange={(e) => setInputExtras50(e.target.value)}
                                            className="h-10 w-full rounded-xl bg-white border-slate-200 text-xs focus:ring-red-500/20 focus:border-red-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <Label className="font-bold text-slate-750 text-[10px]">H. Extras 100%</Label>
                                            <span className="text-[9px] font-bold text-emerald-605">
                                                {inputExtras100 ? (parseFloat(inputExtras100) > 0 ? formatCurrency(selectedEmployeeItem.hourlyRate * 2.0 * parseFloat(inputExtras100)) : 'R$ 0,00') : 'R$ 0,00'}
                                            </span>
                                        </div>
                                        <Input 
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            value={inputExtras100}
                                            onChange={(e) => setInputExtras100(e.target.value)}
                                            className="h-10 w-full rounded-xl bg-white border-slate-200 text-xs focus:ring-red-500/20 focus:border-red-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <Label className="font-bold text-slate-750 text-[10px]">H. Noturnas</Label>
                                            <span className="text-[9px] font-bold text-emerald-605">
                                                {inputNoturnas ? (parseFloat(inputNoturnas) > 0 ? formatCurrency(selectedEmployeeItem.hourlyRate * 0.2 * parseFloat(inputNoturnas)) : 'R$ 0,00') : 'R$ 0,00'}
                                            </span>
                                        </div>
                                        <Input 
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            value={inputNoturnas}
                                            onChange={(e) => setInputNoturnas(e.target.value)}
                                            className="h-10 w-full rounded-xl bg-white border-slate-200 text-xs focus:ring-red-500/20 focus:border-red-500"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5 border-t border-slate-100 pt-3">
                                    <Label className="font-bold text-slate-750">Ajuda de Custo / Combustível (R$)</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-semibold">R$</span>
                                        <Input 
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0,00"
                                            value={inputAjudaCusto}
                                            onChange={(e) => setInputAjudaCusto(e.target.value)}
                                            className="pl-8 h-10 w-full rounded-xl bg-white border-slate-200 text-xs focus:ring-red-500/20 focus:border-red-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                                    <div className="space-y-1.5">
                                        <Label className="font-bold text-slate-750">Descontos Diversos (R$)</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-semibold">R$</span>
                                            <Input 
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="0,00"
                                                value={inputDiversos}
                                                onChange={(e) => setInputDiversos(e.target.value)}
                                                className="pl-8 h-10 w-full rounded-xl bg-white border-slate-200 text-xs focus:ring-red-500/20 focus:border-red-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="font-bold text-slate-750">Empréstimos (R$)</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-semibold">R$</span>
                                            <Input 
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="0,00"
                                                value={inputEmprestimos}
                                                onChange={(e) => setInputEmprestimos(e.target.value)}
                                                className="pl-8 h-10 w-full rounded-xl bg-white border-slate-200 text-xs focus:ring-red-500/20 focus:border-red-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="font-bold text-slate-750">Convênios (R$)</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-semibold">R$</span>
                                            <Input 
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="0,00"
                                                value={inputConvenios}
                                                onChange={(e) => setInputConvenios(e.target.value)}
                                                className="pl-8 h-10 w-full rounded-xl bg-white border-slate-200 text-xs focus:ring-red-500/20 focus:border-red-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="font-bold text-slate-750">Sindicatos (R$)</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-semibold">R$</span>
                                            <Input 
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="0,00"
                                                value={inputSindicato}
                                                onChange={(e) => setInputSindicato(e.target.value)}
                                                className="pl-8 h-10 w-full rounded-xl bg-white border-slate-200 text-xs focus:ring-red-500/20 focus:border-red-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setEditDeductionsOpen(false)}>Cancelar</Button>
                        <Button 
                            onClick={handleSaveDeductions} 
                            disabled={isSavingDeductions}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2"
                        >
                            {isSavingDeductions && <RefreshCw className="w-4 h-4 animate-spin" />} Salvar Lançamento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Sincronização Secullum com Seleção de Empresa */}
            <Dialog open={syncModalOpen} onOpenChange={setSyncModalOpen}>
                <DialogContent className="max-w-md p-6 rounded-2xl bg-white">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
                                <RefreshCw className="w-6 h-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold text-slate-900">
                                    Sincronizar com Secullum Ponto Web
                                </DialogTitle>
                                <DialogDescription className="text-xs text-slate-500">
                                    Selecione a empresa e competência para sincronizar os cálculos oficiais
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                        {/* Seleção de Empresa */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700">Empresa para Sincronizar</Label>
                            <Combobox
                                options={[
                                    { value: "all", label: "Todas as Empresas" },
                                    ...uniqueCompanies.map(c => ({ value: c, label: c }))
                                ]}
                                value={syncCompanyTarget}
                                onChange={setSyncCompanyTarget}
                                placeholder="Selecione a empresa..."
                                searchPlaceholder="Buscar empresa..."
                                className="h-10"
                            />
                        </div>

                        {/* Seleção de Competência */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700">Mês de Referência</Label>
                                <Select value={String(syncTargetMonth)} onValueChange={v => setSyncTargetMonth(Number(v))}>
                                    <SelectTrigger className="h-10 text-xs rounded-xl bg-slate-50 border-slate-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200 text-xs">
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
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700">Ano</Label>
                                <Select value={String(syncTargetYear)} onValueChange={v => setSyncTargetYear(Number(v))}>
                                    <SelectTrigger className="h-10 text-xs rounded-xl bg-slate-50 border-slate-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200 text-xs">
                                        <SelectItem value="2025">2025</SelectItem>
                                        <SelectItem value="2026">2026</SelectItem>
                                        <SelectItem value="2027">2027</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Dica Informativa */}
                        <div className="p-3 bg-sky-50/70 border border-sky-100 rounded-xl text-xs text-sky-800 flex items-start gap-2">
                            <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                            <span>
                                {syncCompanyTarget !== "all" 
                                    ? `Sincronizando apenas "${syncCompanyTarget}" para garantir leitura direta e ultrarrápida da API.`
                                    : "Sincronizará os cálculos de todas as empresas cadastradas no sistema."}
                            </span>
                        </div>
                    </div>

                    <DialogFooter className="pt-2 flex justify-between items-center">
                        <Button 
                            variant="ghost" 
                            onClick={() => setSyncModalOpen(false)}
                            disabled={isSyncingSecullum}
                            className="text-slate-500"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            onClick={handleExecuteSync}
                            disabled={isSyncingSecullum}
                            className="bg-sky-600 hover:bg-sky-700 text-white font-medium px-5 rounded-xl shadow-sm gap-2"
                        >
                            <RefreshCw className={`w-4 h-4 ${isSyncingSecullum ? 'animate-spin' : ''}`} />
                            <span>{isSyncingSecullum ? "Sincronizando..." : "Iniciar Sincronização"}</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
