"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, UserMinus, AlertCircle, ShieldAlert, AlertTriangle, CheckSquare, Loader2, ArrowRightLeft, Sparkles, CheckCircle2 } from "lucide-react";
import { assignEmployee, unassignEmployee, getPostoMovementImpact, PostoMovementImpactResult } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox"; // NEW
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface AssignmentDialogProps {
    postoId: string;
    postoRole: string;
    postoNotes?: string | null;
    activeEmployeeName?: string;
    currentSchedule?: string;
    scheduleOptions?: { id: string; name: string; }[];
    employees: { id: string; name: string; role: { name: string } }[];
    situations?: { id: string; name: string; color: string }[];
}

export function AssignmentDialog({ postoId, postoRole, postoNotes, activeEmployeeName, employees, situations = [], currentSchedule, scheduleOptions = [] }: AssignmentDialogProps) {
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [createVacancy, setCreateVacancy] = useState(false);
    const [mode, setMode] = useState<'assign' | 'unassign'>('assign');
    const [selectedSituation, setSelectedSituation] = useState<string>("");
    const [schedule, setSchedule] = useState(currentSchedule || "12x36");
    const [employeeId, setEmployeeId] = useState("");
    const [observation, setObservation] = useState("");
    const [noticeStartDate, setNoticeStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [noticeEndDate, setNoticeEndDate] = useState("");
    const [terminationDate, setTerminationDate] = useState("");
    const [abandonmentStartDate, setAbandonmentStartDate] = useState(new Date().toISOString().split('T')[0]);

    // Análise de impactos de remuneração e benefícios
    const [impactResult, setImpactResult] = useState<PostoMovementImpactResult | null>(null);
    const [loadingImpact, setLoadingImpact] = useState(false);
    const [checklistChecked, setChecklistChecked] = useState<Record<number, boolean>>({});

    useEffect(() => {
        if (open && currentSchedule) {
            setSchedule(currentSchedule);
        }
    }, [open, currentSchedule]);

    // Carregar impacto de remuneração ao escolher o colaborador
    useEffect(() => {
        if (!employeeId || !open || mode !== 'assign') {
            setImpactResult(null);
            setChecklistChecked({});
            return;
        }

        let isMounted = true;
        setLoadingImpact(true);
        getPostoMovementImpact(postoId, employeeId)
            .then((res) => {
                if (isMounted) {
                    setImpactResult(res);
                    setChecklistChecked({});
                }
            })
            .catch((err) => {
                console.error("Erro ao analisar impacto financeiro do posto:", err);
            })
            .finally(() => {
                if (isMounted) setLoadingImpact(false);
            });

        return () => {
            isMounted = false;
        };
    }, [employeeId, postoId, open, mode]);

    // Filter logic moved to Combobox component

    async function handleSubmit(formData: FormData) {
        setError(null);
        setLoading(true);
        try {
            const result: any = await assignEmployee(formData);
            if (result?.error) {
                setError(result.error);
            } else if (result?.pendingApproval) {
                toast.success(result.message || "Solicitação de movimentação encaminhada com sucesso para aprovação!");
                setOpen(false);
                setCreateVacancy(false);
            } else {
                toast.success("Colaborador alocado com sucesso!");
                setOpen(false);
                setCreateVacancy(false);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleUnassign() {
        if (!selectedSituation) {
            setError("Selecione a situação da desvinculação");
            return;
        }
        if (!observation.trim()) {
            setError("Por favor, digite o motivo da movimentação/desvinculação");
            return;
        }
        setError(null);
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("postoId", postoId);
            formData.append("situationId", selectedSituation);
            formData.append("observation", observation);

            const selectedSituationObj = situations.find(s => s.id === selectedSituation);
            const selectedSituationName = selectedSituationObj?.name;

            if (selectedSituationName === "Aviso Prévio") {
                formData.append("noticeStartDate", noticeStartDate);
                formData.append("noticeEndDate", noticeEndDate);
            } else if (selectedSituationName === "Processo de Rescisão") {
                formData.append("terminationDate", terminationDate);
            } else if (selectedSituationName === "Processo de abandono") {
                formData.append("abandonmentStartDate", abandonmentStartDate);
            }

            if (createVacancy) {
                formData.append("createVacancy", "on");
            }
            const result = await unassignEmployee(formData);
            if (result?.error) {
                setError(result.error);
                return;
            }
            setOpen(false);
            setCreateVacancy(false);
            setSelectedSituation("");
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    function openDialog(dialogMode: 'assign' | 'unassign') {
        setMode(dialogMode);
        setError(null);
        setCreateVacancy(false);
        setSelectedSituation("");
        setObservation("");
        setEmployeeId(""); // Reset selection
        setNoticeStartDate(new Date().toISOString().split('T')[0]);
        setNoticeEndDate("");
        setTerminationDate("");
        setAbandonmentStartDate(new Date().toISOString().split('T')[0]);
        setOpen(true);
        if (currentSchedule) setSchedule(currentSchedule);
    }

    const selectedSituationObj = situations.find(s => s.id === selectedSituation);
    const selectedSituationName = selectedSituationObj?.name;

    return (
        <>
            {/* Buttons */}
            {activeEmployeeName ? (
                <>
                    <Button size="sm" variant="outline" className="gap-2 mr-2" onClick={() => openDialog('assign')}>
                        <UserPlus className="w-3 h-3" />
                        Alterar
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-2" onClick={() => openDialog('unassign')}>
                        <UserMinus className="w-3 h-3" />
                        Desvincular
                    </Button>
                </>
            ) : (
                <Button size="sm" variant="outline" className="gap-2" onClick={() => openDialog('assign')}>
                    <UserPlus className="w-3 h-3" />
                    Alocar
                </Button>
            )}

            <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) { setError(null); setCreateVacancy(false); setSelectedSituation(""); setObservation(""); setNoticeStartDate(new Date().toISOString().split('T')[0]); setNoticeEndDate(""); setTerminationDate(""); setAbandonmentStartDate(new Date().toISOString().split('T')[0]); } }}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {mode === 'unassign' ? 'Desvincular Colaborador' : (activeEmployeeName ? 'Realocação de Posto' : 'Alocação de Posto')}
                        </DialogTitle>
                        <DialogDescription>
                            {mode === 'unassign'
                                ? <><strong>{activeEmployeeName}</strong> será desvinculado. Selecione o motivo.</>
                                : activeEmployeeName
                                    ? <><strong>{activeEmployeeName}</strong> será substituído por outro colaborador no posto de <strong>{postoRole}</strong>{postoNotes ? <span className="text-amber-700 font-medium"> ({postoNotes})</span> : null}.</>
                                    : <>Selecione o colaborador para assumir o posto de <strong>{postoRole}</strong>{postoNotes ? <span className="text-amber-700 font-medium"> ({postoNotes})</span> : null}.</>
                            }
                        </DialogDescription>
                    </DialogHeader>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 h-4" />
                            <AlertTitle>Erro</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {mode === 'assign' ? (
                        <form action={handleSubmit} className="space-y-4 py-4">
                            <input type="hidden" name="postoId" value={postoId} />
                            <input type="hidden" name="employeeId" value={employeeId} />

                            <div className="space-y-2">
                                <Label>Colaborador *</Label>
                                <Combobox
                                    options={employees.map(e => ({ value: e.id, label: `${e.name} (${e.role.name})` }))}
                                    value={employeeId}
                                    onChange={setEmployeeId}
                                    placeholder="Selecione o colaborador..."
                                    searchPlaceholder="Buscar colaborador..."
                                    emptyMessage="Nenhum colaborador encontrado."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Data de Início da Nova Alocação</Label>
                                    <Input type="date" name="startDate" required defaultValue={new Date().toISOString().split('T')[0]} />
                                    <p className="text-[10px] text-muted-foreground">
                                        Para corrigir a data atual, use o menu <strong>Escala</strong>.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Escala</Label>
                                    <Select name="schedule" value={schedule} onValueChange={setSchedule}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {scheduleOptions.map(opt => (
                                                <SelectItem key={opt.id} value={opt.name}>
                                                    {opt.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <input type="hidden" name="schedule" value={schedule} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="assignReason">Motivo da Movimentação *</Label>
                                <Input 
                                    type="text" 
                                    id="assignReason" 
                                    name="reason" 
                                    placeholder="Escreva aqui detalhadamente o motivo da alocação..." 
                                    required 
                                />
                            </div>

                            {/* ANÁLISE DE IMPACTO DE REMUNERAÇÃO E BENEFÍCIOS (TRAVAS E CHECKLIST) */}
                            {employeeId && (
                                <>
                                    {loadingImpact && (
                                        <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                            <span>Analisando regras de insalubridade, vale alimentação e salários do posto...</span>
                                        </div>
                                    )}

                                    {impactResult && (
                                        <>
                                            {impactResult.hasDivergences ? (
                                                <div className={`p-4 rounded-2xl border-2 space-y-3 ${
                                                    impactResult.hasCriticalDivergence 
                                                        ? "bg-rose-50/50 border-rose-300" 
                                                        : "bg-amber-50/50 border-amber-300"
                                                }`}>
                                                    <div className="flex items-start gap-2.5">
                                                        <div className={`p-1.5 rounded-lg text-white shrink-0 mt-0.5 ${
                                                            impactResult.hasCriticalDivergence ? "bg-rose-600" : "bg-amber-600"
                                                        }`}>
                                                            <ShieldAlert className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <span className="font-black text-xs block text-slate-800">
                                                                Trava de Conformidade: Alteração de Remuneração e Benefícios
                                                            </span>
                                                            <p className="text-[11px] text-slate-600 mt-0.5 leading-tight">
                                                                Divergências detectadas no posto. A validação dos itens abaixo é <strong>obrigatória</strong> para evitar pagamentos indevidos ou supressões incorretas.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Itens com impacto */}
                                                    <div className="space-y-2">
                                                        {impactResult.items.filter(i => i.status !== "EQUAL").map((item, idx) => (
                                                            <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-2 shadow-xs">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                                                                        {item.severity === 'CRITICAL' && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                                                                        {item.severity === 'WARNING' && <span className="w-2 h-2 rounded-full bg-amber-500" />}
                                                                        {item.label}
                                                                    </span>
                                                                    <div className="flex items-center gap-1.5 text-[11px]">
                                                                        <span className="text-slate-500 line-through">{item.currentValue}</span>
                                                                        <ArrowRightLeft className="w-3 h-3 text-slate-400" />
                                                                        <span className="font-bold text-slate-900">{item.targetValue}</span>
                                                                    </div>
                                                                </div>

                                                                <p className="text-[10px] text-slate-600 leading-normal">
                                                                    {item.message}
                                                                </p>

                                                                {/* Checkbox de confirmação obrigatória */}
                                                                <div className="flex items-start space-x-2 pt-1 border-t border-slate-100">
                                                                    <Checkbox
                                                                        id={`chk_impact_${idx}`}
                                                                        checked={!!checklistChecked[idx]}
                                                                        onCheckedChange={(val) => setChecklistChecked(prev => ({ ...prev, [idx]: val === true }))}
                                                                    />
                                                                    <Label htmlFor={`chk_impact_${idx}`} className="text-[10px] font-semibold text-slate-700 leading-tight cursor-pointer">
                                                                        {item.checklistText}
                                                                    </Label>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    <span>Remuneração, insalubridade e benefícios compatíveis entre o posto de origem e destino.</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}

                            {/* Envio do checklist serializado */}
                            <input 
                                type="hidden" 
                                name="salaryAndBenefitsChecklist" 
                                value={JSON.stringify(
                                    (impactResult?.items.filter(i => i.status !== "EQUAL") || []).map((item, idx) => ({
                                        field: item.field,
                                        label: item.label,
                                        currentValue: item.currentValue,
                                        targetValue: item.targetValue,
                                        text: item.checklistText,
                                        confirmed: !!checklistChecked[idx]
                                    }))
                                )} 
                            />

                            {activeEmployeeName && (
                                <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                    <Checkbox
                                        id="createVacancy"
                                        name="createVacancy"
                                        checked={createVacancy}
                                        onCheckedChange={(checked: boolean) => setCreateVacancy(checked === true)}
                                    />
                                    <Label
                                        htmlFor="createVacancy"
                                        className="text-sm font-normal cursor-pointer flex-1"
                                    >
                                        Abrir vaga no Recrutamento & Seleção?
                                    </Label>
                                </div>
                            )}

                            <DialogFooter className="flex-col sm:flex-col gap-2">
                                <Button 
                                    type="submit" 
                                    disabled={
                                        loading || 
                                        loadingImpact || 
                                        ((impactResult?.items.filter(i => i.status !== "EQUAL") || []).length > 0 && 
                                         !(impactResult?.items.filter(i => i.status !== "EQUAL") || []).every((_, idx) => checklistChecked[idx] === true))
                                    } 
                                    className="w-full"
                                >
                                    {loading ? "Processando..." : loadingImpact ? "Verificando benefícios..." : "Confirmar Alocação"}
                                </Button>
                                {impactResult?.hasDivergences && !(impactResult.items.filter(i => i.status !== "EQUAL").every((_, idx) => checklistChecked[idx] === true)) && (
                                    <p className="text-[10px] text-amber-700 font-bold text-center">
                                        ⚠️ Assinale todos os itens da checklist de remuneração e benefícios para habilitar a confirmação.
                                    </p>
                                )}
                            </DialogFooter>
                        </form>
                    ) : (
                        <div className="space-y-4 py-4">
                            <div className="space-y-3">
                                <Label>Motivo da Desvinculação *</Label>
                                <RadioGroup value={selectedSituation} onValueChange={setSelectedSituation}>
                                    {situations.map((situation) => (
                                        <div key={situation.id} className="flex items-center space-x-2">
                                            <RadioGroupItem value={situation.id} id={situation.id} />
                                            <Label htmlFor={situation.id} className="font-normal cursor-pointer flex-1">
                                                {situation.name}
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </div>

                            {selectedSituationName === "Aviso Prévio" && (
                                <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg bg-slate-50">
                                    <div className="space-y-1">
                                        <Label htmlFor="noticeStartDate" className="text-xs">Início do Aviso</Label>
                                        <Input
                                            type="date"
                                            id="noticeStartDate"
                                            value={noticeStartDate}
                                            onChange={(e) => setNoticeStartDate(e.target.value)}
                                            required
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="noticeEndDate" className="text-xs">Término do Aviso</Label>
                                        <Input
                                            type="date"
                                            id="noticeEndDate"
                                            value={noticeEndDate}
                                            onChange={(e) => setNoticeEndDate(e.target.value)}
                                            required
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                </div>
                            )}

                            {selectedSituationName === "Processo de Rescisão" && (
                                <div className="space-y-1 border p-3 rounded-lg bg-slate-50">
                                    <Label htmlFor="terminationDate" className="text-xs">Data Prevista de Desligamento</Label>
                                    <Input
                                        type="date"
                                        id="terminationDate"
                                        value={terminationDate}
                                        onChange={(e) => setTerminationDate(e.target.value)}
                                        required
                                        className="h-8 text-xs"
                                    />
                                </div>
                            )}

                            {selectedSituationName === "Processo de abandono" && (
                                <div className="space-y-1 border p-3 rounded-lg bg-slate-50">
                                    <Label htmlFor="abandonmentStartDate" className="text-xs">Início do Abandono de Posto</Label>
                                    <Input
                                        type="date"
                                        id="abandonmentStartDate"
                                        value={abandonmentStartDate}
                                        onChange={(e) => setAbandonmentStartDate(e.target.value)}
                                        required
                                        className="h-8 text-xs"
                                    />
                                </div>
                            )}

                             <div className="space-y-2">
                                <Label htmlFor="unassignObservation">Motivo da Movimentação / Observações *</Label>
                                <Textarea
                                    id="unassignObservation"
                                    value={observation}
                                    onChange={(e) => setObservation(e.target.value)}
                                    placeholder="Escreva aqui detalhadamente o motivo do colaborador estar sendo desvinculado..."
                                    className="min-h-[80px]"
                                    required
                                />
                            </div>

                            <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                <Checkbox
                                    id="createVacancyUnassign"
                                    checked={createVacancy}
                                    onCheckedChange={(checked: boolean) => setCreateVacancy(checked === true)}
                                />
                                <Label
                                    htmlFor="createVacancyUnassign"
                                    className="text-sm font-normal cursor-pointer flex-1"
                                >
                                    Abrir vaga no Recrutamento & Seleção?
                                </Label>
                            </div>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleUnassign}
                                    disabled={loading || !selectedSituation}
                                    className="w-full"
                                >
                                    {loading ? "Processando..." : "Confirmar Desvinculação"}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
