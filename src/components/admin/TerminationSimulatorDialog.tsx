"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Printer, FileText, Calendar, DollarSign, AlertCircle, ShieldAlert, ArrowRight, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { calculateTermination, DismissalReason, NoticeType, TerminationResult } from "@/lib/termination";
import { format, differenceInDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TerminationSimulatorProps {
    employee: {
        id: string;
        name: string;
        cpf?: string | null;
        admissionDate: Date | string;
        salary: number;
        insalubridade?: number | null;
        periculosidade?: number | null;
        gratificacao?: number | null;
        outrosAdicionais?: number | null;
        workload?: number | null;
        dependentsCount?: number | null;
        role?: { name: string } | null;
        company?: { name: string } | null;
        vacationDaysRemaining?: number;
        extraFields?: any;
    };
    triggerVariant?: "default" | "outline" | "compact";
}

export interface AfastamentoPeriodItem {
    id: string;
    startDate: string;
    endDate: string;
    reason?: string;
}

export function TerminationSimulatorDialog({ employee, triggerVariant = "default" }: TerminationSimulatorProps) {
    const [open, setOpen] = useState(false);

    // Inputs state
    const [dismissalDate, setDismissalDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [dismissalReason, setDismissalReason] = useState<DismissalReason>("SEM_JUSTA_CAUSA");
    const [noticeType, setNoticeType] = useState<NoticeType>("INDENIZADO");
    const [customNoticeDays, setCustomNoticeDays] = useState<string>("");
    
    // Custom remuneration base: initialized with employee's registered salary
    const [customSalaryBase, setCustomSalaryBase] = useState<string>(() => 
        employee.salary !== undefined && employee.salary !== null ? String(employee.salary) : ""
    );

    // Synchronize salary whenever employee prop changes or dialog is opened
    useEffect(() => {
        if (open && employee.salary !== undefined && employee.salary !== null) {
            setCustomSalaryBase(String(employee.salary));
        }
    }, [open, employee.id, employee.salary]);

    // Initial experience end date
    const initialExperienceEndDate = useMemo(() => {
        const extra = (employee as any).extraFields || {};
        if (extra.experience2EndDate) return extra.experience2EndDate.split('T')[0];
        if (extra.experience1EndDate) return extra.experience1EndDate.split('T')[0];
        if (employee.admissionDate) {
            const adm = new Date(employee.admissionDate);
            if (!isNaN(adm.getTime())) {
                const daysSoFar = differenceInDays(new Date(), adm);
                const target = daysSoFar > 45 ? addDays(adm, 89) : addDays(adm, 44);
                return target.toISOString().split('T')[0];
            }
        }
        return "";
    }, [employee]);

    const [experienceEndDate, setExperienceEndDate] = useState<string>(initialExperienceEndDate);
    const [experienceRemainingDays, setExperienceRemainingDays] = useState<string>("");

    // Sync remaining days when experienceEndDate or dismissalDate changes
    useEffect(() => {
        if (experienceEndDate && dismissalDate) {
            const exp = new Date(experienceEndDate + "T12:00:00Z");
            const dis = new Date(dismissalDate + "T12:00:00Z");
            if (!isNaN(exp.getTime()) && !isNaN(dis.getTime())) {
                const diff = differenceInDays(exp, dis);
                setExperienceRemainingDays(String(Math.max(0, diff)));
            }
        }
    }, [experienceEndDate, dismissalDate]);

    // Afastamento INSS states
    const [hasAfastamento, setHasAfastamento] = useState(false);
    const [afastamentoStartDate, setAfastamentoStartDate] = useState("");
    const [afastamentoEndDate, setAfastamentoEndDate] = useState("");
    const [afastamentoDays, setAfastamentoDays] = useState<string>("0");

    // Multi-period afastamento list
    const [afastamentoPeriods, setAfastamentoPeriods] = useState<AfastamentoPeriodItem[]>([]);

    const addAfastamentoPeriod = () => {
        setAfastamentoPeriods(prev => [
            ...prev,
            { id: Math.random().toString(36).substring(2, 9), startDate: "", endDate: "", reason: "" }
        ]);
        if (!hasAfastamento) setHasAfastamento(true);
    };

    const removeAfastamentoPeriod = (id: string) => {
        setAfastamentoPeriods(prev => prev.filter(p => p.id !== id));
    };

    const updateAfastamentoPeriod = (id: string, field: keyof AfastamentoPeriodItem, val: string) => {
        setAfastamentoPeriods(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
    };

    const [vtMonthlyValue, setVtMonthlyValue] = useState<string>("0");
    const [vaMonthlyValue, setVaMonthlyValue] = useState<string>("0");
    const [estimatedFgtsBalance, setEstimatedFgtsBalance] = useState<string>("");

    // Calculate effective afastamento days across all unified periods
    const computedAfastamentoDays = useMemo(() => {
        if (!hasAfastamento) return 0;

        let total = 0;
        for (const p of afastamentoPeriods) {
            if (p.startDate && p.endDate) {
                const start = new Date(p.startDate);
                const end = new Date(p.endDate);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
                    total += (differenceInDays(end, start) + 1);
                }
            }
        }

        return total;
    }, [hasAfastamento, afastamentoPeriods]);

    // Handle Date Changes and Sync Days Input
    const handleAfastamentoStartChange = (val: string) => {
        setAfastamentoStartDate(val);
        if (val && afastamentoEndDate) {
            const start = new Date(val);
            const end = new Date(afastamentoEndDate);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
                setAfastamentoDays((differenceInDays(end, start) + 1).toString());
            }
        }
    };

    const handleAfastamentoEndChange = (val: string) => {
        setAfastamentoEndDate(val);
        if (afastamentoStartDate && val) {
            const start = new Date(afastamentoStartDate);
            const end = new Date(val);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
                setAfastamentoDays((differenceInDays(end, start) + 1).toString());
            }
        }
    };

    // Handle dismissal reason change and auto-set correct notice/indemnity type
    const handleDismissalReasonChange = (val: DismissalReason) => {
        setDismissalReason(val);
        if (val === "EXP_ANTECIPADO_EMPRESA") {
            setNoticeType("ART_479_CLT");
        } else if (val === "EXP_ANTECIPADO_EMPREGADO") {
            setNoticeType("ART_480_CLT");
        } else if (val === "EXP_FIM" || val === "COM_JUSTA_CAUSA") {
            setNoticeType("DISPENSADO");
        } else if (val === "PEDIDO_DEMISSAO") {
            setNoticeType("DESCONTADO");
        } else if (val === "SEM_JUSTA_CAUSA") {
            setNoticeType("INDENIZADO");
        }
    };

    const currentBaseSalary = customSalaryBase !== "" ? (parseFloat(customSalaryBase) || 0) : (employee.salary || 0);

    // Calculate in real time
    const result: TerminationResult = useMemo(() => {
        return calculateTermination({
            admissionDate: employee.admissionDate,
            dismissalDate,
            baseSalary: currentBaseSalary,
            insalubridade: employee.insalubridade || 0,
            periculosidade: employee.periculosidade || 0,
            gratificacao: employee.gratificacao || 0,
            otherAdditions: employee.outrosAdicionais || 0,
            workload: employee.workload || 220,
            dependentsCount: employee.dependentsCount || 0,
            vacationDaysRemaining: employee.vacationDaysRemaining || 0,
            dismissalReason,
            noticeType,
            customNoticeDays: customNoticeDays ? parseInt(customNoticeDays) : undefined,
            experienceRemainingDays: experienceRemainingDays !== "" ? parseInt(experienceRemainingDays) : undefined,
            experienceEndDate: experienceEndDate || undefined,
            afastamentoDays: computedAfastamentoDays,
            afastamentoStartDate: hasAfastamento && afastamentoStartDate ? afastamentoStartDate : undefined,
            afastamentoEndDate: hasAfastamento && afastamentoEndDate ? afastamentoEndDate : undefined,
            afastamentoPeriods: hasAfastamento ? afastamentoPeriods : undefined,
            vtMonthlyValue: vtMonthlyValue ? parseFloat(vtMonthlyValue) : 0,
            vaMonthlyValue: vaMonthlyValue ? parseFloat(vaMonthlyValue) : 0,
            estimatedFgtsBalance: estimatedFgtsBalance ? parseFloat(estimatedFgtsBalance) : undefined
        });
    }, [
        employee,
        dismissalDate,
        dismissalReason,
        noticeType,
        customNoticeDays,
        currentBaseSalary,
        experienceRemainingDays,
        experienceEndDate,
        hasAfastamento,
        computedAfastamentoDays,
        afastamentoStartDate,
        afastamentoEndDate,
        afastamentoPeriods,
        vtMonthlyValue,
        vaMonthlyValue,
        estimatedFgtsBalance
    ]);

    const fmtR$ = (val: number) => (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const handlePrint = () => {
        const area = document.getElementById("termination-print-area");
        if (!area) {
            window.print();
            return;
        }

        // Clone element to sanitize inputs for print window
        const clone = area.cloneNode(true) as HTMLElement;
        
        // Remove no-print elements from clone
        clone.querySelectorAll(".no-print").forEach(el => el.remove());

        // Replace input values in clone with text spans for print
        clone.querySelectorAll("input").forEach(input => {
            const span = document.createElement("span");
            span.className = "font-bold text-slate-800";
            span.innerText = input.value || input.placeholder || "";
            input.parentNode?.replaceChild(span, input);
        });

        const printWindow = window.open("", "_blank", "width=950,height=850");
        if (!printWindow) {
            window.print();
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="utf-8" />
                <title>Simulação de Rescisão - ${employee.name}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    body {
                        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                        background: #ffffff !important;
                        color: #0f172a !important;
                        padding: 24px;
                    }
                    .no-print {
                        display: none !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 12mm;
                    }
                    @media print {
                        body {
                            padding: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <div style="max-width: 900px; margin: 0 auto;">
                    ${clone.innerHTML}
                </div>
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 350);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {triggerVariant === "compact" ? (
                    <Button variant="outline" size="sm" className="gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs font-bold">
                        <Calculator className="w-3.5 h-3.5" /> Simular Rescisão
                    </Button>
                ) : (
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-none h-9 px-4 rounded-xl shadow-sm text-xs uppercase tracking-wider">
                        <Calculator className="w-4 h-4" /> Simular Rescisão
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className="sm:max-w-4xl lg:max-w-[1000px] w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 rounded-2xl shadow-xl border-slate-200">
                {/* Print Styles */}
                <style jsx global>{`
                    @media print {
                        @page {
                            margin: 10mm;
                            size: portrait;
                        }
                        body {
                            background: white !important;
                            color: black !important;
                        }
                        body > *:not([data-radix-portal]) {
                            display: none !important;
                        }
                        div[data-radix-portal] > div[style*="fixed"] {
                            display: none !important;
                        }
                        [role="dialog"] {
                            position: static !important;
                            transform: none !important;
                            max-width: 100% !important;
                            width: 100% !important;
                            max-height: none !important;
                            height: auto !important;
                            overflow: visible !important;
                            box-shadow: none !important;
                            border: none !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            background: white !important;
                        }
                        .no-print {
                            display: none !important;
                        }
                        #termination-print-area {
                            display: block !important;
                            visibility: visible !important;
                            width: 100% !important;
                            position: static !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                    }
                `}</style>

                <DialogHeader className="no-print pb-4 border-b border-slate-100">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2.5 text-slate-900">
                        <Calculator className="w-6 h-6 text-emerald-600 shrink-0" />
                        Simulador de Rescisão Trabalhista (CLT & CCT)
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Simulação financeira das verbas rescisórias, férias, 13º, descontos de VT/VA e multa do FGTS.
                    </DialogDescription>
                </DialogHeader>

                <div id="termination-print-area" className="space-y-5 py-1">
                    {/* Header Info Colaborador */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Colaborador</div>
                            <div className="font-bold text-slate-900 text-sm truncate">{employee.name}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cargo / Função</div>
                            <div className="font-bold text-slate-800 truncate">{employee.role?.name || "Sem cargo"}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data de Admissão</div>
                            <div className="font-bold text-slate-800">
                                {format(new Date(employee.admissionDate), "dd/MM/yyyy")} ({result.fullYearsWorked} {result.fullYearsWorked === 1 ? 'ano' : 'anos'})
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remuneração Base</div>
                            <div className="font-bold text-emerald-700 text-sm">
                                R$ {fmtR$(result.salaryBaseForCalc)}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium leading-tight">
                                (Salário R$ {fmtR$(currentBaseSalary)}
                                {employee.gratificacao ? ` + Grat. R$ ${fmtR$(employee.gratificacao)}` : ""}
                                {employee.insalubridade ? ` + Insal. R$ ${fmtR$(employee.insalubridade)}` : ""}
                                {employee.periculosidade ? ` + Peric. R$ ${fmtR$(employee.periculosidade)}` : ""})
                            </div>
                        </div>
                    </div>

                    {/* Form Controls - Hidden on Print */}
                    <div className="no-print bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b pb-2.5 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-emerald-600" /> Parâmetros do Desligamento
                            </span>
                            <span className="text-[11px] text-slate-400 font-normal">Ajuste as opções para recalcular instantaneamente</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                            <div className="space-y-1.5">
                                <Label htmlFor="customSalaryBase" className="text-xs font-bold text-slate-700">Salário Base (R$)</Label>
                                <Input
                                    id="customSalaryBase"
                                    type="number"
                                    step="0.01"
                                    value={customSalaryBase}
                                    onChange={(e) => setCustomSalaryBase(e.target.value)}
                                    className="h-9 text-xs w-full border-slate-300 font-bold text-slate-800"
                                    placeholder={employee.salary ? `${employee.salary.toFixed(2)}` : "0.00"}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="dismissalDate" className="text-xs font-bold text-slate-700">Data de Desligamento</Label>
                                <Input
                                    id="dismissalDate"
                                    type="date"
                                    value={dismissalDate}
                                    onChange={(e) => setDismissalDate(e.target.value)}
                                    className="h-9 text-xs w-full border-slate-300"
                                />
                            </div>

                            <div className="space-y-1.5 min-w-0">
                                <Label htmlFor="dismissalReason" className="text-xs font-bold text-slate-700">Motivo da Rescisão</Label>
                                <Select value={dismissalReason} onValueChange={(val) => setDismissalReason(val as DismissalReason)}>
                                    <SelectTrigger className="h-9 text-xs w-full border-slate-300">
                                        <SelectValue placeholder="Selecione o motivo" />
                                    </SelectTrigger>
                                    <SelectContent className="max-w-[420px]">
                                        <SelectItem value="SEM_JUSTA_CAUSA">🔴 Sem Justa Causa (Empregador)</SelectItem>
                                        <SelectItem value="PEDIDO_DEMISSAO">👤 Pedido de Demissão (Empregado)</SelectItem>
                                        <SelectItem value="ACORDO_MUTUO">🤝 Acordo Mútuo (Art. 484-A CLT)</SelectItem>
                                        <SelectItem value="COM_JUSTA_CAUSA">⚠️ Com Justa Causa (Empregador)</SelectItem>
                                        <SelectItem value="EXP_FIM">⏱️ Término Contrato Experiência</SelectItem>
                                        <SelectItem value="EXP_ANTECIPADO_EMPRESA">⚡ Antecipada Experiência (Empresa)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5 min-w-0">
                                <Label htmlFor="noticeType" className="text-xs font-bold text-slate-700">Aviso Prévio / Indenização</Label>
                                <Select value={noticeType} onValueChange={(val) => setNoticeType(val as NoticeType)}>
                                    <SelectTrigger className="h-9 text-xs w-full border-slate-300">
                                        <SelectValue placeholder="Tipo de aviso" />
                                    </SelectTrigger>
                                    <SelectContent className="max-w-[420px]">
                                        {dismissalReason === "EXP_ANTECIPADO_EMPRESA" ? (
                                            <>
                                                <SelectItem value="ART_479_CLT">⚡ Indenização Art. 479 CLT (50% dias restantes)</SelectItem>
                                                <SelectItem value="DISPENSADO">⚪ Dispensado / Sem Indenização</SelectItem>
                                                <SelectItem value="INDENIZADO">💰 Aviso Prévio Indenizado (Art. 481 CLT)</SelectItem>
                                            </>
                                        ) : dismissalReason === "EXP_ANTECIPADO_EMPREGADO" ? (
                                            <>
                                                <SelectItem value="ART_480_CLT">🔻 Desconto Art. 480 CLT (Até 50% dias restantes)</SelectItem>
                                                <SelectItem value="DISPENSADO">⚪ Dispensado do Desconto</SelectItem>
                                            </>
                                        ) : dismissalReason === "PEDIDO_DEMISSAO" ? (
                                            <>
                                                <SelectItem value="TRABALHADO">💼 Trabalhado pelo Empregado</SelectItem>
                                                <SelectItem value="DESCONTADO">🔻 Descontado no Pedido</SelectItem>
                                                <SelectItem value="DISPENSADO">⚪ Dispensado pelo Empregador</SelectItem>
                                            </>
                                        ) : dismissalReason === "EXP_FIM" || dismissalReason === "COM_JUSTA_CAUSA" ? (
                                            <>
                                                <SelectItem value="DISPENSADO">⚪ Dispensado / Não aplicável</SelectItem>
                                            </>
                                        ) : (
                                            <>
                                                <SelectItem value="INDENIZADO">💰 Indenizado pelo Empregador</SelectItem>
                                                <SelectItem value="TRABALHADO">💼 Trabalhado pelo Empregado</SelectItem>
                                                <SelectItem value="DISPENSADO">⚪ Dispensado / Não aplicável</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Banner & Inputs de Contrato de Experiência (Art. 479 / 480 CLT) */}
                        {(dismissalReason === "EXP_ANTECIPADO_EMPRESA" || dismissalReason === "EXP_ANTECIPADO_EMPREGADO") && (
                            <div className="bg-amber-50/90 border border-amber-200/90 p-4 rounded-xl space-y-3">
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>
                                        {dismissalReason === "EXP_ANTECIPADO_EMPRESA" 
                                            ? "Término Antecipado de Experiência pela Empresa — Art. 479 da CLT"
                                            : "Rescisão Antecipada de Experiência pelo Colaborador — Art. 480 da CLT"}
                                    </span>
                                </div>
                                <p className="text-[11px] text-amber-800 leading-relaxed">
                                    {dismissalReason === "EXP_ANTECIPADO_EMPRESA" 
                                        ? "Nos contratos por prazo determinado (experiência) rescindidos antes do prazo pela empresa sem justa causa, não há aviso prévio comum da Lei 12.506/2011. A empresa indeniza 50% dos salários a que o empregado teria direito até o término do contrato."
                                        : "Quando o empregado rescinde o contrato de experiência antes do prazo estipulado, deve indenizar a empresa pelos prejuízos causados, limitada a 50% dos salários dos dias restantes (Art. 480 da CLT)."}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold text-slate-700">Término Previsto da Experiência</Label>
                                        <Input
                                            type="date"
                                            value={experienceEndDate}
                                            onChange={(e) => setExperienceEndDate(e.target.value)}
                                            className="h-8 text-xs bg-white border-amber-300 font-medium"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold text-slate-700">Dias Restantes de Contrato</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={experienceRemainingDays}
                                            onChange={(e) => setExperienceRemainingDays(e.target.value)}
                                            className="h-8 text-xs bg-white border-amber-300 font-bold"
                                            placeholder="Ex: 15"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold text-slate-700">
                                            {dismissalReason === "EXP_ANTECIPADO_EMPRESA" ? "Indenização Art. 479 (50%)" : "Desconto Art. 480 (50%)"}
                                        </Label>
                                        <div className="h-8 px-3 rounded-md bg-amber-100/90 border border-amber-300 flex items-center font-black text-amber-950 text-xs">
                                            R$ {fmtR$(result.indenizacaoArt479Amount || 0)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Bloco de Afastamento INSS / Licença Médica (Multi-Período Unificado) */}
                        <div className="bg-slate-50/90 p-4 rounded-xl border border-slate-200 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                                    <input
                                        type="checkbox"
                                        checked={hasAfastamento}
                                        onChange={(e) => {
                                            setHasAfastamento(e.target.checked);
                                            if (e.target.checked && afastamentoPeriods.length === 0) {
                                                addAfastamentoPeriod();
                                            }
                                        }}
                                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                    />
                                    <span>Houve período(s) de Afastamento pelo INSS / Atestados Médicos?</span>
                                </label>
                                {hasAfastamento && (
                                    <span className="text-[11px] font-extrabold text-amber-800 bg-amber-100/90 px-3 py-1 rounded-full border border-amber-200">
                                        Total Acumulado: {computedAfastamentoDays} dias ({result.avosLostToAfastamento} avos abatidos)
                                    </span>
                                )}
                            </div>

                            {hasAfastamento && (
                                <div className="space-y-3 pt-2 border-t border-slate-200/70">
                                    {afastamentoPeriods.length === 0 && (
                                        <div className="text-xs text-slate-500 italic">Nenhum período adicionado. Clique no botão abaixo para incluir um período.</div>
                                    )}

                                    {afastamentoPeriods.map((item, index) => {
                                        let itemDays = 0;
                                        if (item.startDate && item.endDate) {
                                            const s = new Date(item.startDate);
                                            const e = new Date(item.endDate);
                                            if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
                                                itemDays = differenceInDays(e, s) + 1;
                                            }
                                        }
                                        return (
                                            <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs bg-white p-3 rounded-lg border border-slate-200/90 shadow-2xs items-end">
                                                <div className="sm:col-span-3 space-y-1">
                                                    <Label className="text-[11px] font-bold text-slate-700">Início (Período {index + 1})</Label>
                                                    <Input
                                                        type="date"
                                                        value={item.startDate}
                                                        onChange={(e) => updateAfastamentoPeriod(item.id, "startDate", e.target.value)}
                                                        className="h-8 text-xs border-slate-300"
                                                    />
                                                </div>
                                                <div className="sm:col-span-3 space-y-1">
                                                    <Label className="text-[11px] font-bold text-slate-700">Fim (Período {index + 1})</Label>
                                                    <Input
                                                        type="date"
                                                        value={item.endDate}
                                                        onChange={(e) => updateAfastamentoPeriod(item.id, "endDate", e.target.value)}
                                                        className="h-8 text-xs border-slate-300"
                                                    />
                                                </div>
                                                <div className="sm:col-span-4 space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <Label className="text-[11px] font-bold text-slate-700">Motivo / Justificativa</Label>
                                                        {itemDays > 0 && (
                                                            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                                {itemDays} dias
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Input
                                                        type="text"
                                                        value={item.reason || ""}
                                                        onChange={(e) => updateAfastamentoPeriod(item.id, "reason", e.target.value)}
                                                        className="h-8 text-xs border-slate-300"
                                                        placeholder="Ex: ATESTADO MAIS 60 DIAS / INSS"
                                                    />
                                                </div>
                                                <div className="sm:col-span-2 flex justify-end">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeAfastamentoPeriod(item.id)}
                                                        className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold text-xs gap-1 px-2"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addAfastamentoPeriod}
                                        className="gap-1.5 border-dashed border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs font-bold w-full h-9 mt-1"
                                    >
                                        <Plus className="w-4 h-4 text-emerald-600" /> Adicionar Período de Afastamento
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-100">
                            <div className="space-y-1.5">
                                <Label htmlFor="customNoticeDays" className="text-[11px] font-semibold text-slate-600">
                                    Dias Aviso ({result.noticeDaysCount}d calc)
                                </Label>
                                <Input
                                    id="customNoticeDays"
                                    type="number"
                                    placeholder={`${result.noticeDaysCount}`}
                                    value={customNoticeDays}
                                    onChange={(e) => setCustomNoticeDays(e.target.value)}
                                    className="h-8 text-xs w-full border-slate-300"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="estimatedFgtsBalance" className="text-[11px] font-semibold text-slate-600">Saldo FGTS (R$)</Label>
                                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                                        Est: R$ {fmtR$(result.fgtsBalance)}
                                    </span>
                                </div>
                                <Input
                                    id="estimatedFgtsBalance"
                                    type="number"
                                    step="0.01"
                                    value={estimatedFgtsBalance}
                                    onChange={(e) => setEstimatedFgtsBalance(e.target.value)}
                                    className="h-8 text-xs w-full border-slate-300"
                                    placeholder={`${result.fgtsBalance.toFixed(2)}`}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="vtMonthlyValue" className="text-[11px] font-semibold text-slate-600">Estorno VT Adiantado (R$)</Label>
                                <Input
                                    id="vtMonthlyValue"
                                    type="number"
                                    step="0.01"
                                    value={vtMonthlyValue}
                                    onChange={(e) => setVtMonthlyValue(e.target.value)}
                                    className="h-8 text-xs w-full border-slate-300"
                                    placeholder="0,00"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="vaMonthlyValue" className="text-[11px] font-semibold text-slate-600">Estorno VA/VR Adiantado (R$)</Label>
                                <Input
                                    id="vaMonthlyValue"
                                    type="number"
                                    step="0.01"
                                    value={vaMonthlyValue}
                                    onChange={(e) => setVaMonthlyValue(e.target.value)}
                                    className="h-8 text-xs w-full border-slate-300"
                                    placeholder="0,00"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Resumo Financeiro 4-Card Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        <div className="bg-emerald-50/80 border border-emerald-200/90 p-5 rounded-2xl text-emerald-950 flex flex-col justify-between">
                            <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Total Proventos</div>
                            <div className="text-2xl font-black text-emerald-700 mt-2 truncate">
                                R$ {fmtR$(result.totalProventos)}
                            </div>
                        </div>

                        <div className="bg-red-50/80 border border-red-200/90 p-5 rounded-2xl text-red-950 flex flex-col justify-between">
                            <div className="text-[11px] font-black uppercase tracking-wider text-red-700">Total Descontos</div>
                            <div className="text-2xl font-black text-red-700 mt-2 truncate">
                                R$ {fmtR$(result.totalDescontos)}
                            </div>
                        </div>

                        <div className="bg-amber-50/80 border border-amber-200/90 p-5 rounded-2xl text-amber-950 flex flex-col justify-between">
                            <div className="text-[11px] font-black uppercase tracking-wider text-amber-800">
                                Multa FGTS ({(result.fgtsFineRate * 100).toFixed(0)}%)
                            </div>
                            <div className="text-2xl font-black text-amber-900 mt-2 truncate">
                                R$ {fmtR$(result.fgtsFineAmount)}
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl text-white flex flex-col justify-between shadow-md">
                            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Líquido a Receber</div>
                            <div className="text-2xl lg:text-3xl font-black text-emerald-400 mt-2 truncate">
                                R$ {fmtR$(result.netAmount)}
                            </div>
                        </div>
                    </div>

                    {/* Discriminativo Detalhado de Rubricas */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                        <div className="bg-slate-100 p-3 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-800">
                            <span>Demonstrativo Analítico de Verbas e Descontos</span>
                            <span className="text-[10px] text-slate-500 font-normal">Calculado com base na CLT e tabelas 2026</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                                        <th className="p-3 pl-4">Cód.</th>
                                        <th className="p-3">Descrição da Rubrica</th>
                                        <th className="p-3">Ref.</th>
                                        <th className="p-3 text-right">Proventos (R$)</th>
                                        <th className="p-3 pr-4 text-right">Descontos (R$)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {result.items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50">
                                            <td className="p-3 pl-4 font-mono text-[11px] text-slate-400">{item.code}</td>
                                            <td className="p-3 font-bold text-slate-800">{item.description}</td>
                                            <td className="p-3 text-slate-500 text-[11px]">{item.reference || "-"}</td>
                                            <td className="p-3 text-right text-emerald-700 font-bold whitespace-nowrap">
                                                {item.type === "PROVENTO" ? `R$ ${fmtR$(item.amount)}` : "-"}
                                            </td>
                                            <td className="p-3 pr-4 text-right text-red-600 font-bold whitespace-nowrap">
                                                {item.type === "DESCONTO" ? `R$ ${fmtR$(item.amount)}` : "-"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-100 font-black border-t border-slate-300 text-xs">
                                        <td colSpan={3} className="p-3 pl-4 uppercase">Totais Discriminados</td>
                                        <td className="p-3 text-right text-emerald-700 whitespace-nowrap">
                                            R$ {fmtR$(result.totalProventos)}
                                        </td>
                                        <td className="p-3 pr-4 text-right text-red-600 whitespace-nowrap">
                                            R$ {fmtR$(result.totalDescontos)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Observação / Disclaimer */}
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <strong>Nota Informativa:</strong> Esta simulação possui caráter estimativo prévio conforme regras gerais da CLT e Convenção Coletiva (CCT). Os valores exatos na homologação oficial poderão variar dependendo da homologação final e extrato atualizado do FGTS.
                        </div>
                    </div>
                </div>

                <DialogFooter className="no-print border-t pt-4 flex flex-row justify-between items-center">
                    <Button variant="outline" onClick={() => setOpen(false)} className="text-xs">
                        Fechar
                    </Button>
                    <Button onClick={handlePrint} className="gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold">
                        <Printer className="w-4 h-4" /> Exportar / Imprimir Simulação (PDF)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
