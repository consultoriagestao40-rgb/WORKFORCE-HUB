"use client";

import { useState, useEffect } from "react";
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
import { UserMinus, Upload, X, FileText, AlertTriangle, Loader2, Sparkles, Calendar } from "lucide-react";
import { initiateEmployeeDismissalProcess } from "@/app/actions";

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

    // Helper para cálculo de anos completos e dias de aviso proporcional (Lei 12.506/2011)
    const getNoticeCalculation = (startDateStr: string) => {
        let fullYears = 0;
        if (admissionDate && startDateStr) {
            try {
                const adm = new Date(admissionDate);
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
            // Lei 12.506/2011: 30 base + 3 dias por ano completo trabalhado (máximo de 60 dias adicionais = 90 dias total)
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
    }, [noticeStartDate, initiative, dismissalCategory, noticeType, admissionDate]);

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
                }
            } else if (dismissalCategory === 'EXP_ANTECIPADO') {
                processType = 'Processo de Rescisão';
                dismissalSubType = 'TERMINO_EXP_ANTECIPADO_EMPRESA';
                startDate = terminationDate;
            } else {
                processType = 'Processo de Rescisão';
                dismissalSubType = 'TERMINO_EXP_PRAZO_EMPRESA';
                startDate = terminationDate;
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
                }
            } else if (dismissalCategory === 'EXP_ANTECIPADO') {
                processType = 'Processo de Rescisão';
                dismissalSubType = 'TERMINO_EXP_ANTECIPADO_COLABORADOR';
                startDate = terminationDate;
            } else {
                processType = 'Processo de Rescisão';
                dismissalSubType = 'TERMINO_EXP_PRAZO_COLABORADOR';
                startDate = terminationDate;
            }
        } else if (initiative === 'ABANDONO') {
            processType = 'Processo de abandono';
            dismissalSubType = 'ABANDONO';
            startDate = abandonmentStartDate;
        }

        try {
            const { days: calcNoticeDays } = getNoticeCalculation(noticeStartDate);
            const res = await initiateEmployeeDismissalProcess({
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
                attachment
            });

            if (res?.error) {
                toast.error(res.error);
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
            <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-2xl">
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

                    <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2 shrink-0">
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
                            disabled={loading}
                            className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl flex items-center justify-center gap-1.5"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Processando...</span>
                                </>
                            ) : (
                                <span>Confirmar Início</span>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
