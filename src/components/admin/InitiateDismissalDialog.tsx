"use client";

import { useState, useEffect, useMemo } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { UserMinus, Upload, X, FileText, AlertTriangle, Loader2, Sparkles, Calendar, Calculator, DollarSign, ChevronDown, ChevronUp, CheckCircle2, ShieldAlert } from "lucide-react";
import { initiateEmployeeDismissalProcess, getEmployeeDismissalContext } from "@/app/actions";
import { calculateTermination, TerminationResult, DismissalReason, NoticeType as TermNoticeType } from "@/lib/termination";

export function InitiateDismissalDialog({ 
    employeeId, 
    employeeName, 
    admissionDate,
    hasActivePosto, 
    triggerVariant = 'default' 
}: { 
    employeeId: string; 
    employeeName: string; 
    admissionDate?: string | Date | null;
    hasActivePosto: boolean; 
    triggerVariant?: 'default' | 'table'; 
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingContext, setLoadingContext] = useState(false);
    const [dismissalContext, setDismissalContext] = useState<any>(null);
    const [showRubricas, setShowRubricas] = useState(false);
    
    // Process parameters
    const [initiative, setInitiative] = useState<'EMPRESA' | 'COLABORADOR' | 'ABANDONO'>('EMPRESA');
    const [noticeType, setNoticeType] = useState<'TRABALHADO' | 'INDENIZADO'>('TRABALHADO');
    const [dismissalCategory, setDismissalCategory] = useState<'AVISO' | 'EXP_ANTECIPADO' | 'EXP_PRAZO'>('AVISO');
    
    // Dates
    const [noticeStartDate, setNoticeStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [noticeEndDate, setNoticeEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
    });
    const [terminationDate, setTerminationDate] = useState(new Date().toISOString().split('T')[0]);
    const [abandonmentStartDate, setAbandonmentStartDate] = useState(new Date().toISOString().split('T')[0]);

    // Buscar contexto financeiro do colaborador ao abrir o diálogo
    useEffect(() => {
        if (!open) return;
        let isMounted = true;
        setLoadingContext(true);
        getEmployeeDismissalContext(employeeId)
            .then((data) => {
                if (isMounted) {
                    setDismissalContext(data);
                }
            })
            .catch((err) => {
                console.error("Erro ao carregar dados rescisórios do colaborador:", err);
            })
            .finally(() => {
                if (isMounted) setLoadingContext(false);
            });

        return () => {
            isMounted = false;
        };
    }, [open, employeeId]);

    // Helper para cálculo de anos completos e dias de aviso proporcional (Lei 12.506/2011)
    const getNoticeCalculation = (startDateStr: string) => {
        let fullYears = 0;
        const effectiveAdmission = dismissalContext?.admissionDate || admissionDate;
        if (effectiveAdmission && startDateStr) {
            try {
                const adm = new Date(effectiveAdmission);
                const start = new Date(startDateStr + "T12:00:00Z");
                if (!isNaN(adm.getTime()) && !isNaN(start.getTime())) {
                    let diffY = start.getFullYear() - adm.getFullYear();
                    const m = start.getMonth() - adm.getMonth();
                    if (m < 0 || (m === 0 && start.getDate() < adm.getDate())) {
                        diffY--;
                    }
                    fullYears = Math.max(0, diffY);
                }
            } catch (e) {
                fullYears = 0;
            }
        }

        let days = 30;
        if (initiative === 'EMPRESA' && dismissalCategory === 'AVISO') {
            days = Math.min(30 + (fullYears * 3), 90);
        } else {
            days = 30;
        }

        return { fullYears, days };
    };

    const calculateEndDate = (startDateStr: string, days: number) => {
        try {
            const d = new Date(startDateStr + "T12:00:00Z");
            if (isNaN(d.getTime())) return "";
            d.setDate(d.getDate() + days);
            return d.toISOString().split('T')[0];
        } catch {
            return "";
        }
    };

    // Auto-recalcula a data de término ao alterar a data de início ou opções
    useEffect(() => {
        if (noticeStartDate) {
            const { days } = getNoticeCalculation(noticeStartDate);
            setNoticeEndDate(calculateEndDate(noticeStartDate, days));
        }
    }, [noticeStartDate, initiative, dismissalCategory, noticeType, admissionDate, dismissalContext]);

    // Options
    const [reductionType, setReductionType] = useState<'NENHUMA' | 'DUAS_HORAS' | 'SETE_DIAS'>('NENHUMA');
    const [unassignImmediately, setUnassignImmediately] = useState(false);
    const [openVacancy, setOpenVacancy] = useState(true);
    const [notes, setNotes] = useState("");
    const [attachment, setAttachment] = useState<{ fileName: string; fileData: string } | null>(null);

    const router = useRouter();

    // Adjust defaults based on choices
    useEffect(() => {
        if (initiative === 'ABANDONO') {
            setUnassignImmediately(true);
        } else if (dismissalCategory !== 'AVISO') {
            setUnassignImmediately(true);
        } else if (noticeType === 'INDENIZADO') {
            setUnassignImmediately(true);
        } else {
            setUnassignImmediately(false);
        }
    }, [initiative, noticeType, dismissalCategory]);

    // SIMULAÇÃO RESCISÓRIA EM TEMPO REAL (CLT)
    const simulationResult: TerminationResult | null = useMemo(() => {
        const effectiveAdmission = dismissalContext?.admissionDate || admissionDate;
        if (!effectiveAdmission) return null;

        let effectiveDismissalDate = terminationDate;
        if (initiative === 'ABANDONO') {
            effectiveDismissalDate = abandonmentStartDate;
        } else if (dismissalCategory === 'AVISO') {
            effectiveDismissalDate = noticeType === 'TRABALHADO' ? noticeEndDate : noticeStartDate;
        }

        let dismissalReason: DismissalReason = 'SEM_JUSTA_CAUSA';
        let termNoticeType: TermNoticeType = 'TRABALHADO';

        if (initiative === 'EMPRESA') {
            if (dismissalCategory === 'AVISO') {
                dismissalReason = 'SEM_JUSTA_CAUSA';
                termNoticeType = noticeType === 'TRABALHADO' ? 'TRABALHADO' : 'INDENIZADO';
            } else if (dismissalCategory === 'EXP_ANTECIPADO') {
                dismissalReason = 'EXP_ANTECIPADO_EMPRESA';
                termNoticeType = 'ART_479_CLT';
            } else {
                dismissalReason = 'EXP_FIM';
                termNoticeType = 'DISPENSADO';
            }
        } else if (initiative === 'COLABORADOR') {
            if (dismissalCategory === 'AVISO') {
                dismissalReason = 'PEDIDO_DEMISSAO';
                termNoticeType = noticeType === 'TRABALHADO' ? 'TRABALHADO' : 'DESCONTADO';
            } else if (dismissalCategory === 'EXP_ANTECIPADO') {
                dismissalReason = 'EXP_ANTECIPADO_EMPREGADO';
                termNoticeType = 'ART_480_CLT';
            } else {
                dismissalReason = 'EXP_FIM';
                termNoticeType = 'DISPENSADO';
            }
        } else if (initiative === 'ABANDONO') {
            dismissalReason = 'COM_JUSTA_CAUSA';
            termNoticeType = 'DISPENSADO';
        }

        const { days: calcNoticeDays } = getNoticeCalculation(noticeStartDate);

        try {
            return calculateTermination({
                admissionDate: effectiveAdmission,
                dismissalDate: effectiveDismissalDate,
                baseSalary: Number(dismissalContext?.salary || 0),
                insalubridade: Number(dismissalContext?.insalubridade || 0),
                periculosidade: Number(dismissalContext?.periculosidade || 0),
                gratificacao: Number(dismissalContext?.gratificacao || 0),
                otherAdditions: Number(dismissalContext?.outrosAdicionais || 0),
                workload: Number(dismissalContext?.workload || 220),
                isNightShift: Boolean(dismissalContext?.isNightShift),
                vacationDaysRemaining: Number(dismissalContext?.vacationDaysRemaining || 0),
                dismissalReason,
                noticeType: termNoticeType,
                customNoticeDays: calcNoticeDays
            });
        } catch (err) {
            console.error("Erro no cálculo da rescisão:", err);
            return null;
        }
    }, [
        dismissalContext,
        admissionDate,
        initiative,
        dismissalCategory,
        noticeType,
        noticeStartDate,
        noticeEndDate,
        terminationDate,
        abandonmentStartDate
    ]);

    const getLastWorkingDayLabel = () => {
        if (!noticeEndDate) return "-";
        try {
            const end = new Date(noticeEndDate + "T12:00:00Z");
            end.setDate(end.getDate() - 7);
            return end.toLocaleDateString("pt-BR");
        } catch (e) {
            return "-";
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 4.2 * 1024 * 1024) {
            toast.error("O arquivo excede o limite máximo de 4.2MB.");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setAttachment({
                fileName: file.name,
                fileData: reader.result as string
            });
            toast.success("Carta de demissão carregada com sucesso!");
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveFile = () => {
        setAttachment(null);
        toast.info("Carta de demissão removida.");
    };

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        let processType: 'Aviso Prévio' | 'Processo de Rescisão' | 'Processo de abandono' = 'Aviso Prévio';
        let dismissalSubType: 'PEDIDO_SEM_AVISO' | 'PEDIDO_COM_AVISO' | 'DISPENSA_SEM_AVISO' | 'DISPENSA_COM_AVISO' | 'ABANDONO' | 'TERMINO_EXP_ANTECIPADO_EMPRESA' | 'TERMINO_EXP_PRAZO_EMPRESA' | 'TERMINO_EXP_ANTECIPADO_COLABORADOR' | 'TERMINO_EXP_PRAZO_COLABORADOR' = 'DISPENSA_COM_AVISO';
        let startDate = undefined;
        let endDate = undefined;

        if (initiative === 'EMPRESA') {
            if (dismissalCategory === 'AVISO') {
                if (noticeType === 'TRABALHADO') {
                    processType = 'Aviso Prévio';
                    dismissalSubType = 'DISPENSA_COM_AVISO';
                    startDate = noticeStartDate;
                    endDate = noticeEndDate;
                } else {
                    processType = 'Processo de Rescisão';
                    dismissalSubType = 'DISPENSA_SEM_AVISO';
                    startDate = terminationDate;
                    endDate = terminationDate;
                }
            } else if (dismissalCategory === 'EXP_ANTECIPADO') {
                processType = 'Processo de Rescisão';
                dismissalSubType = 'TERMINO_EXP_ANTECIPADO_EMPRESA';
                startDate = terminationDate;
                endDate = terminationDate;
            } else {
                processType = 'Processo de Rescisão';
                dismissalSubType = 'TERMINO_EXP_PRAZO_EMPRESA';
                startDate = terminationDate;
                endDate = terminationDate;
            }
        } else if (initiative === 'COLABORADOR') {
            if (dismissalCategory === 'AVISO') {
                if (noticeType === 'TRABALHADO') {
                    processType = 'Aviso Prévio';
                    dismissalSubType = 'PEDIDO_COM_AVISO';
                    startDate = noticeStartDate;
                    endDate = noticeEndDate;
                } else {
                    processType = 'Processo de Rescisão';
                    dismissalSubType = 'PEDIDO_SEM_AVISO';
                    startDate = terminationDate;
                    endDate = terminationDate;
                }
            } else if (dismissalCategory === 'EXP_ANTECIPADO') {
                processType = 'Processo de Rescisão';
                dismissalSubType = 'TERMINO_EXP_ANTECIPADO_COLABORADOR';
                startDate = terminationDate;
                endDate = terminationDate;
            } else {
                processType = 'Processo de Rescisão';
                dismissalSubType = 'TERMINO_EXP_PRAZO_COLABORADOR';
                startDate = terminationDate;
                endDate = terminationDate;
            }
        } else if (initiative === 'ABANDONO') {
            processType = 'Processo de abandono';
            dismissalSubType = 'ABANDONO';
            startDate = abandonmentStartDate;
        }

        if (!simulationResult) {
            toast.error("O cálculo rescisório via simulador é obrigatório. Aguarde o carregamento ou verifique as datas.");
            setLoading(false);
            return;
        }

        try {
            const { days: calcNoticeDays } = getNoticeCalculation(noticeStartDate);
            const res: any = await initiateEmployeeDismissalProcess({
                employeeId,
                processType,
                dismissalSubType,
                initiative,
                noticeType,
                noticeDays: calcNoticeDays,
                startDate,
                endDate,
                reductionType: initiative === 'EMPRESA' && noticeType === 'TRABALHADO' ? reductionType : 'NENHUMA',
                unassignImmediately,
                openVacancy,
                notes,
                attachment,
                terminationSimulation: simulationResult
            });

            if (res?.error) {
                toast.error(res.error);
            } else if (res?.pendingApproval) {
                toast.success("Solicitação de desligamento encaminhada para aprovação!", {
                    description: "O processo foi registrado no Hub de Aprovações e aguarda liberação N1/N2 com demonstrativo rescisório anexado."
                });
                setOpen(false);
                router.refresh();
            } else {
                toast.success("Processo de desligamento iniciado com sucesso!");
                setOpen(false);
                router.refresh();
            }
        } catch (err: any) {
            toast.error(err.message || "Erro de conexão.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {triggerVariant === 'table' ? (
                    <Button 
                        variant="ghost" 
                        className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 font-bold text-xs rounded-lg uppercase tracking-wider"
                    >
                        Iniciar
                    </Button>
                ) : (
                    <Button 
                        variant="outline" 
                        className="gap-1.5 border-slate-200 text-red-650 hover:text-red-700 font-bold h-9 px-3.5 rounded-xl shadow-sm text-[11px] uppercase tracking-wider hover:bg-red-50 transition-colors bg-white shrink-0"
                    >
                        <UserMinus className="w-3.5 h-3.5 text-red-500" />
                        <span>Iniciar Desligamento</span>
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-2xl">
                <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
                    <DialogTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <UserMinus className="w-5 h-5 text-red-500" /> Iniciar Processo de Desligamento
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Configure a iniciativa, prazos e opções do posto para <strong>{employeeName}</strong>.
                    </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleConfirm} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                        
                        {/* 1. Iniciativa do Desligamento */}
                        <div className="space-y-2">
                            <Label className="font-bold text-slate-700">Iniciativa do Desligamento</Label>
                            <RadioGroup 
                                value={initiative} 
                                onValueChange={(val: any) => setInitiative(val)}
                                className="grid grid-cols-3 gap-2"
                            >
                                <div className="flex items-center space-x-1.5 border p-2.5 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100/60 transition-colors">
                                    <RadioGroupItem value="EMPRESA" id="init_empresa" />
                                    <Label htmlFor="init_empresa" className="text-xs cursor-pointer font-bold">Empresa</Label>
                                </div>
                                <div className="flex items-center space-x-1.5 border p-2.5 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100/60 transition-colors">
                                    <RadioGroupItem value="COLABORADOR" id="init_colab" />
                                    <Label htmlFor="init_colab" className="text-xs cursor-pointer font-bold">Colaborador</Label>
                                </div>
                                <div className="flex items-center space-x-1.5 border p-2.5 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100/60 transition-colors">
                                    <RadioGroupItem value="ABANDONO" id="init_abandono" />
                                    <Label htmlFor="init_abandono" className="text-xs cursor-pointer font-bold">Abandono</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {/* 2. Categoria / Tipo de Desligamento */}
                        {initiative !== 'ABANDONO' && (
                            <div className="space-y-2">
                                <Label className="font-bold text-slate-700">Categoria do Desligamento</Label>
                                <RadioGroup 
                                    value={dismissalCategory} 
                                    onValueChange={(val: any) => setDismissalCategory(val)}
                                    className="grid grid-cols-1 gap-2"
                                >
                                    <div className="flex items-center space-x-1.5 border p-2.5 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100/60 transition-colors">
                                        <RadioGroupItem value="AVISO" id="cat_aviso" />
                                        <Label htmlFor="cat_aviso" className="text-xs cursor-pointer font-bold">
                                            {initiative === 'EMPRESA' ? 'Demissão sem justa causa (Aviso)' : 'Pedido de Demissão'}
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-1.5 border p-2.5 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100/60 transition-colors">
                                        <RadioGroupItem value="EXP_ANTECIPADO" id="cat_exp_ant" />
                                        <Label htmlFor="cat_exp_ant" className="text-xs cursor-pointer font-bold">
                                            Término de Experiência (Antecipado)
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-1.5 border p-2.5 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100/60 transition-colors">
                                        <RadioGroupItem value="EXP_PRAZO" id="cat_exp_prazo" />
                                        <Label htmlFor="cat_exp_prazo" className="text-xs cursor-pointer font-bold">
                                            Término de Experiência (No Prazo)
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        )}

                        {/* 3. Cumprimento do Aviso (Conditional) */}
                        {initiative !== 'ABANDONO' && dismissalCategory === 'AVISO' && (
                            <div className="space-y-2">
                                <Label className="font-bold text-slate-700">Cumprimento de Aviso</Label>
                                <RadioGroup 
                                    value={noticeType} 
                                    onValueChange={(val: any) => setNoticeType(val)}
                                    className="grid grid-cols-2 gap-2"
                                >
                                    <div className="flex items-center space-x-1.5 border p-2.5 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100/60 transition-colors">
                                        <RadioGroupItem value="TRABALHADO" id="notice_trabalhado" />
                                        <Label htmlFor="notice_trabalhado" className="text-xs cursor-pointer font-bold">
                                            {initiative === 'EMPRESA' ? 'Trabalhado' : 'Cumprido'}
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-1.5 border p-2.5 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100/60 transition-colors">
                                        <RadioGroupItem value="INDENIZADO" id="notice_indenizado" />
                                        <Label htmlFor="notice_indenizado" className="text-xs cursor-pointer font-bold">
                                            {initiative === 'EMPRESA' ? 'Indenizado' : 'Dispensado pelo Gestor'}
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        )}

                        {/* 4. Datas */}
                        {initiative !== 'ABANDONO' && dismissalCategory === 'AVISO' && noticeType === 'TRABALHADO' && (
                            <div className="space-y-3.5 border border-slate-150 p-4 rounded-2xl bg-slate-50/50">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="proc_noticeStartDate" className="text-xs font-semibold">Início do Aviso</Label>
                                        <Input
                                            type="date"
                                            id="proc_noticeStartDate"
                                            value={noticeStartDate}
                                            onChange={(e) => setNoticeStartDate(e.target.value)}
                                            required
                                            className="h-9 text-xs rounded-xl bg-white"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="proc_noticeEndDate" className="text-xs font-semibold">Término do Aviso</Label>
                                            <span className="text-[10px] text-blue-600 font-black">
                                                {getNoticeCalculation(noticeStartDate).days} dias
                                            </span>
                                        </div>
                                        <Input
                                            type="date"
                                            id="proc_noticeEndDate"
                                            value={noticeEndDate}
                                            onChange={(e) => setNoticeEndDate(e.target.value)}
                                            required
                                            className="h-9 text-xs rounded-xl bg-white font-medium"
                                        />
                                    </div>
                                </div>
                                
                                {/* Badge de Proporcionalidade - Lei 12.506/2011 */}
                                {initiative === 'EMPRESA' ? (
                                    <div className="flex items-start gap-2 p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-900 text-xs">
                                        <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                        <div className="leading-tight">
                                            {getNoticeCalculation(noticeStartDate).fullYears > 0 ? (
                                                <>
                                                    <span className="font-bold">
                                                        {getNoticeCalculation(noticeStartDate).fullYears} {getNoticeCalculation(noticeStartDate).fullYears === 1 ? 'ano completo' : 'anos completos'} de contrato
                                                    </span>
                                                    <span className="text-[11px] text-blue-700 block mt-0.5">
                                                        Aviso Prévio Proporcional: <strong>{getNoticeCalculation(noticeStartDate).days} dias</strong> (30 base + {getNoticeCalculation(noticeStartDate).fullYears * 3} dias pela Lei 12.506/2011).
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="font-bold">Menos de 1 ano completo de contrato</span>
                                                    <span className="text-[11px] text-blue-700 block mt-0.5">
                                                        Aviso Prévio Padrão: <strong>30 dias corridos</strong> (Art. 487 da CLT).
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ) : null}

                                {initiative === 'EMPRESA' ? (
                                    <div className="space-y-1.5 pt-1">
                                        <Label htmlFor="proc_reductionType" className="text-xs font-bold">Opção de Redução (Art. 488 CLT)</Label>
                                        <select
                                            id="proc_reductionType"
                                            value={reductionType}
                                            onChange={(e) => setReductionType(e.target.value as any)}
                                            className="w-full text-xs border rounded-xl h-9 bg-white px-3 focus:outline-none focus:ring-1 focus:ring-primary"
                                        >
                                            <option value="NENHUMA">Nenhuma redução</option>
                                            <option value="DUAS_HORAS">Redução de 2 horas diárias</option>
                                            <option value="SETE_DIAS">Redução de 7 dias no final do aviso</option>
                                        </select>
                                        {reductionType === 'SETE_DIAS' && (
                                            <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold rounded-lg mt-2 text-center">
                                                Último Dia de Trabalho Estimado: {getLastWorkingDayLabel()}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-2 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold rounded-lg text-center">
                                        Iniciativa do colaborador: Sem redução de jornada da CLT (30 dias corridos).
                                    </div>
                                )}
                            </div>
                        )}

                        {initiative !== 'ABANDONO' && (noticeType === 'INDENIZADO' || dismissalCategory !== 'AVISO') && (
                            <div className="space-y-2 border border-slate-150 p-4 rounded-2xl bg-slate-50/50">
                                <Label htmlFor="proc_terminationDate" className="text-xs font-semibold">Data do Desligamento</Label>
                                <Input
                                    type="date"
                                    id="proc_terminationDate"
                                    value={terminationDate}
                                    onChange={(e) => setTerminationDate(e.target.value)}
                                    required
                                    className="h-9 text-xs rounded-xl bg-white"
                                />
                            </div>
                        )}

                        {initiative === 'ABANDONO' && (
                            <div className="space-y-2 border border-slate-150 p-4 rounded-2xl bg-slate-50/50">
                                <Label htmlFor="proc_abandonmentStartDate" className="text-xs font-semibold">Início do Abandono de Posto</Label>
                                <Input
                                    type="date"
                                    id="proc_abandonmentStartDate"
                                    value={abandonmentStartDate}
                                    onChange={(e) => setAbandonmentStartDate(e.target.value)}
                                    required
                                    className="h-9 text-xs rounded-xl bg-white"
                                />
                            </div>
                        )}

                        {/* 4. Anexo da Carta de Demissão (pedido de demissão) */}
                        {initiative === 'COLABORADOR' && (
                            <div className="space-y-2 border border-slate-150 p-4 rounded-2xl bg-slate-50/50">
                                <Label className="font-bold text-slate-700">Carta de Demissão</Label>
                                {!attachment ? (
                                    <div className="relative border-2 border-dashed border-slate-200 hover:border-slate-350 bg-white rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer group transition-colors">
                                        <Upload className="w-6 h-6 text-slate-400 group-hover:text-primary mb-2 transition-colors" />
                                        <span className="text-[10px] text-slate-500 font-bold">Clique para carregar a carta assinada (PDF ou Imagem)</span>
                                        <input 
                                            type="file" 
                                            accept=".pdf,.png,.jpg,.jpeg"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 opacity-0 cursor-pointer" 
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl">
                                        <div className="flex items-center gap-2 max-w-[80%]">
                                            <FileText className="w-5 h-5 text-primary shrink-0" />
                                            <span className="text-[10px] font-bold text-slate-700 truncate">{attachment.fileName}</span>
                                        </div>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={handleRemoveFile} 
                                            className="h-7 w-7 p-0 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-50"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── SIMULADOR RESCISÓRIO OBRIGATÓRIO (CLT) ────────────────── */}
                        <div className="space-y-2.5 border-2 border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/30 p-4 rounded-2xl shadow-xs">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-xs">
                                        <Calculator className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <span className="font-black text-slate-800 text-xs block flex items-center gap-1.5">
                                            Simulador de Rescisão CLT
                                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.5 rounded-full uppercase">
                                                Obrigatório
                                            </span>
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                            Base salarial: R$ {Number(dismissalContext?.salary || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                            {dismissalContext?.insalubridade ? ` + Insal. R$ ${Number(dismissalContext.insalubridade).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}
                                        </span>
                                    </div>
                                </div>
                                {loadingContext && (
                                    <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
                                        <Loader2 className="w-3 h-3 animate-spin" /> Carregando base...
                                    </div>
                                )}
                            </div>

                            {simulationResult ? (
                                <div className="space-y-3 pt-1">
                                    <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                                                Valor Líquido Estimado a Pagar
                                            </span>
                                            <span className="text-lg font-black text-emerald-700 leading-tight">
                                                R$ {simulationResult.netAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-slate-500 block font-medium">
                                                Proventos: <strong className="text-slate-800">R$ {simulationResult.totalProventos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                                            </span>
                                            <span className="text-[10px] text-slate-500 block font-medium">
                                                Descontos: <strong className="text-rose-600">-R$ {simulationResult.totalDescontos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                                            </span>
                                            {simulationResult.fgtsFineAmount > 0 && (
                                                <span className="text-[10px] text-indigo-600 block font-bold">
                                                    Multa FGTS 40%: R$ {simulationResult.fgtsFineAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Toggle detalhamento das rubricas */}
                                    <div className="pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setShowRubricas(!showRubricas)}
                                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors"
                                        >
                                            {showRubricas ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                            {showRubricas ? "Ocultar rubricas do cálculo" : `Ver demonstrativo das verbas (${simulationResult.items.length} itens)`}
                                        </button>

                                        {showRubricas && (
                                            <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                {simulationResult.items.map((it, idx) => (
                                                    <div 
                                                        key={idx} 
                                                        className={`p-2 rounded-lg text-[10px] flex items-center justify-between border ${
                                                            it.type === 'PROVENTO' 
                                                                ? 'bg-emerald-50/50 border-emerald-100 text-slate-800' 
                                                                : 'bg-rose-50/50 border-rose-100 text-slate-800'
                                                        }`}
                                                    >
                                                        <div>
                                                            <span className="font-bold">{it.description}</span>
                                                            {it.reference && <span className="text-slate-500 ml-1.5 text-[9px]">({it.reference})</span>}
                                                        </div>
                                                        <span className={`font-black ${it.type === 'PROVENTO' ? 'text-emerald-700' : 'text-rose-600'}`}>
                                                            {it.type === 'PROVENTO' ? '+' : '-'} R$ {it.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-800 bg-emerald-100/60 p-2 rounded-lg font-medium">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>Cálculo vinculado com sucesso. Os valores e demonstrativo ficarão visíveis aos aprovadores N1/N2 e DP.</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px]">
                                    Aguardando definição das datas para processar o simulador rescisório.
                                </div>
                            )}
                        </div>

                        {/* 5. Opções de Posto de Trabalho */}
                        <div className="space-y-2">
                            <Label className="font-bold text-slate-700">Ações no Posto de Trabalho</Label>
                            {hasActivePosto ? (
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-2.5 p-3 border border-slate-150 rounded-xl bg-slate-50/30">
                                        <Checkbox
                                            id="proc_unassign"
                                            checked={unassignImmediately}
                                            onCheckedChange={(val) => setUnassignImmediately(val === true)}
                                        />
                                        <div className="grid gap-1 leading-none">
                                            <Label htmlFor="proc_unassign" className="text-xs font-bold cursor-pointer">
                                                Remover do posto de trabalho imediatamente
                                            </Label>
                                            <p className="text-[9px] text-slate-500 font-medium">
                                                Se desmarcado, ele continua alocado e trabalhando no posto original até o último dia.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2.5 p-3 border border-slate-150 rounded-xl bg-slate-50/30">
                                        <Checkbox
                                            id="proc_vacancy"
                                            checked={openVacancy}
                                            onCheckedChange={(val) => setOpenVacancy(val === true)}
                                        />
                                        <div className="grid gap-1 leading-none">
                                            <Label htmlFor="proc_vacancy" className="text-xs font-bold cursor-pointer">
                                                Abrir vaga de reposição no R&S
                                            </Label>
                                            <p className="text-[9px] text-slate-500 font-medium">
                                                Abre imediatamente uma busca de reposição para este posto no recrutamento.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-2 p-3 bg-amber-50/50 border border-amber-200/60 rounded-2xl text-amber-800 text-[10px] font-bold leading-normal">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        Colaborador sem posto de trabalho ativo. 
                                        <p className="font-normal text-slate-500 mt-0.5">O processo será iniciado e ele permanecerá no Rotativo. Nenhuma ação de desvinculação é necessária.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 6. Observações */}
                        <div className="space-y-1.5">
                            <Label htmlFor="proc_notes" className="font-bold text-slate-700">Observações / Motivos</Label>
                            <Textarea
                                id="proc_notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Insira detalhes adicionais sobre o desligamento..."
                                className="min-h-[80px] text-xs rounded-xl bg-white border-slate-200 focus:ring-primary"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                            <ShieldAlert className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span>Registrado sob a sessão e auditoria do usuário ativo no sistema.</span>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setOpen(false)}
                                disabled={loading}
                                className="rounded-xl"
                            >
                                Cancelar
                            </Button>
                             <Button 
                                type="submit" 
                                disabled={loading || !simulationResult || loadingContext}
                                className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Processando...</span>
                                    </>
                                ) : loadingContext ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Calculando Rescisão...</span>
                                    </>
                                ) : (
                                    <span>Confirmar e Enviar para Aprovação</span>
                                )}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
