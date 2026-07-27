"use client";

import { useState } from "react";
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
import { UserMinus } from "lucide-react";
import { initiateEmployeeDismissalProcess } from "@/app/actions";

export function InitiateDismissalDialog({ employeeId, employeeName, hasActivePosto }: { employeeId: string, employeeName: string, hasActivePosto: boolean }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [processType, setProcessType] = useState<'Aviso Prévio' | 'Processo de Rescisão' | 'Processo de abandono'>('Aviso Prévio');
    
    // Dates
    const [noticeStartDate, setNoticeStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [noticeEndDate, setNoticeEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
    });
    const [terminationDate, setTerminationDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 10);
        return d.toISOString().split('T')[0];
    });
    const [abandonmentStartDate, setAbandonmentStartDate] = useState(new Date().toISOString().split('T')[0]);

    // Options
    const [reductionType, setReductionType] = useState<'NENHUMA' | 'DUAS_HORAS' | 'SETE_DIAS'>('NENHUMA');
    const [unassignImmediately, setUnassignImmediately] = useState(false);
    const [openVacancy, setOpenVacancy] = useState(true);
    const [notes, setNotes] = useState("");

    const router = useRouter();

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

    // Adjust unassign checkbox default based on process selection
    const handleProcessChange = (val: 'Aviso Prévio' | 'Processo de Rescisão' | 'Processo de abandono') => {
        setProcessType(val);
        if (val === 'Processo de abandono') {
            setUnassignImmediately(true);
        } else {
            setUnassignImmediately(false);
        }
    };

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        let startDate = undefined;
        let endDate = undefined;

        if (processType === 'Aviso Prévio') {
            startDate = noticeStartDate;
            endDate = noticeEndDate;
        } else if (processType === 'Processo de Rescisão') {
            endDate = terminationDate;
        } else if (processType === 'Processo de abandono') {
            startDate = abandonmentStartDate;
        }

        try {
            const res = await initiateEmployeeDismissalProcess({
                employeeId,
                processType,
                startDate,
                endDate,
                reductionType,
                unassignImmediately,
                openVacancy,
                notes
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
                <Button 
                    variant="outline" 
                    className="w-full border-slate-200 text-slate-900 rounded-2xl h-14 font-black justify-between group hover:bg-slate-50 transition-colors"
                >
                    <span>Iniciar Desligamento</span>
                    <UserMinus className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-white border border-slate-200">
                <form onSubmit={handleConfirm}>
                    <DialogHeader>
                        <DialogTitle>Iniciar Processo de Desligamento</DialogTitle>
                        <DialogDescription>
                            Configure o aviso prévio, processo de rescisão ou abandono para o colaborador <strong>{employeeName}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        {/* Process Type Selection */}
                        <div className="space-y-2">
                            <Label>Tipo de Processo</Label>
                            <RadioGroup 
                                value={processType} 
                                onValueChange={(val: any) => handleProcessChange(val)}
                                className="grid grid-cols-3 gap-2"
                            >
                                <div className="flex items-center space-x-1.5 border p-2 rounded-lg bg-slate-50 cursor-pointer">
                                    <RadioGroupItem value="Aviso Prévio" id="type_aviso" />
                                    <Label htmlFor="type_aviso" className="text-xs cursor-pointer font-bold">Aviso Prévio</Label>
                                </div>
                                <div className="flex items-center space-x-1.5 border p-2 rounded-lg bg-slate-50 cursor-pointer">
                                    <RadioGroupItem value="Processo de Rescisão" id="type_rescisao" />
                                    <Label htmlFor="type_rescisao" className="text-xs cursor-pointer font-bold">Rescisão</Label>
                                </div>
                                <div className="flex items-center space-x-1.5 border p-2 rounded-lg bg-slate-50 cursor-pointer">
                                    <RadioGroupItem value="Processo de abandono" id="type_abandono" />
                                    <Label htmlFor="type_abandono" className="text-xs cursor-pointer font-bold">Abandono</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {/* Dates Section */}
                        {processType === 'Aviso Prévio' && (
                            <div className="space-y-3 border p-3 rounded-xl bg-slate-50">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="proc_noticeStartDate" className="text-xs">Início do Aviso</Label>
                                        <Input
                                            type="date"
                                            id="proc_noticeStartDate"
                                            value={noticeStartDate}
                                            onChange={(e) => setNoticeStartDate(e.target.value)}
                                            required
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="proc_noticeEndDate" className="text-xs">Término do Aviso</Label>
                                        <Input
                                            type="date"
                                            id="proc_noticeEndDate"
                                            value={noticeEndDate}
                                            onChange={(e) => setNoticeEndDate(e.target.value)}
                                            required
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="proc_reductionType" className="text-xs font-bold">Opção de Redução (Art. 488 CLT)</Label>
                                    <select
                                        id="proc_reductionType"
                                        value={reductionType}
                                        onChange={(e) => setReductionType(e.target.value as any)}
                                        className="w-full text-xs border rounded-md h-8 bg-white px-2 focus:outline-none"
                                    >
                                        <option value="NENHUMA">Nenhuma / Pedido de Demissão</option>
                                        <option value="DUAS_HORAS">Redução de 2 horas diárias</option>
                                        <option value="SETE_DIAS">Redução de 7 dias no final do aviso</option>
                                    </select>
                                </div>
                                {reductionType === 'SETE_DIAS' && (
                                    <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold rounded-lg mt-1 text-center">
                                        Último Dia de Trabalho: {getLastWorkingDayLabel()}
                                    </div>
                                )}
                            </div>
                        )}

                        {processType === 'Processo de Rescisão' && (
                            <div className="space-y-1 border p-3 rounded-xl bg-slate-50">
                                <Label htmlFor="proc_terminationDate" className="text-xs">Data Prevista do Desligamento</Label>
                                <Input
                                    type="date"
                                    id="proc_terminationDate"
                                    value={terminationDate}
                                    onChange={(e) => setTerminationDate(e.target.value)}
                                    required
                                    className="h-8 text-xs"
                                />
                            </div>
                        )}

                        {processType === 'Processo de abandono' && (
                            <div className="space-y-1 border p-3 rounded-xl bg-slate-50">
                                <Label htmlFor="proc_abandonmentStartDate" className="text-xs">Início do Abandono de Posto</Label>
                                <Input
                                    type="date"
                                    id="proc_abandonmentStartDate"
                                    value={abandonmentStartDate}
                                    onChange={(e) => setAbandonmentStartDate(e.target.value)}
                                    required
                                    className="h-8 text-xs"
                                />
                            </div>
                        )}

                        {/* Allocation and Recruitment Options */}
                        <div className="space-y-2.5">
                            {hasActivePosto && (
                                <div className="flex items-center space-x-2 p-2.5 border rounded-lg bg-slate-50/50">
                                    <Checkbox
                                        id="proc_unassign"
                                        checked={unassignImmediately}
                                        onCheckedChange={(val) => setUnassignImmediately(val === true)}
                                    />
                                    <div className="grid gap-1.5 leading-none">
                                        <Label htmlFor="proc_unassign" className="text-xs font-bold cursor-pointer">
                                            Remover do posto de trabalho imediatamente
                                        </Label>
                                        <p className="text-[10px] text-slate-500">
                                            Se desmarcado, ele continua alocado e trabalhando durante o processo (comum em Aviso Prévio trabalhado).
                                        </p>
                                    </div>
                                </div>
                            )}

                            {hasActivePosto && (
                                <div className="flex items-center space-x-2 p-2.5 border rounded-lg bg-slate-50/50">
                                    <Checkbox
                                        id="proc_vacancy"
                                        checked={openVacancy}
                                        onCheckedChange={(val) => setOpenVacancy(val === true)}
                                    />
                                    <div className="grid gap-1.5 leading-none">
                                        <Label htmlFor="proc_vacancy" className="text-xs font-bold cursor-pointer">
                                            Abrir vaga de reposição no R&S
                                        </Label>
                                        <p className="text-[10px] text-slate-500">
                                            Abre automaticamente uma vaga no recrutamento vinculada a este posto para buscar um substituto.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Observations notes */}
                        <div className="space-y-1">
                            <Label htmlFor="proc_notes">Observações / Motivos</Label>
                            <Textarea
                                id="proc_notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Insira detalhes adicionais sobre este processo..."
                                className="min-h-[70px] text-xs"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={() => setOpen(false)}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={loading}
                            className="bg-primary hover:bg-primary/95 text-white"
                        >
                            {loading ? "Processando..." : "Confirmar Início"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
