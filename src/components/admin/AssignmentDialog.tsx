"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, UserMinus, AlertCircle } from "lucide-react";
import { assignEmployee, unassignEmployee } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox"; // NEW
import { Textarea } from "@/components/ui/textarea";

interface AssignmentDialogProps {
    postoId: string;
    postoRole: string;
    activeEmployeeName?: string;
    currentSchedule?: string;
    scheduleOptions?: { id: string; name: string; }[];
    employees: { id: string; name: string; role: { name: string } }[];
    situations?: { id: string; name: string; color: string }[];
}

export function AssignmentDialog({ postoId, postoRole, activeEmployeeName, employees, situations = [], currentSchedule, scheduleOptions = [] }: AssignmentDialogProps) {
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [createVacancy, setCreateVacancy] = useState(false);
    const [mode, setMode] = useState<'assign' | 'unassign'>('assign');
    const [selectedSituation, setSelectedSituation] = useState<string>("");
    // const [employeeSearch, setEmployeeSearch] = useState(""); // REMOVED
    const [schedule, setSchedule] = useState(currentSchedule || "12x36");
    const [employeeId, setEmployeeId] = useState(""); // NEW for Combobox
    const [observation, setObservation] = useState("");
    const [noticeStartDate, setNoticeStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [noticeEndDate, setNoticeEndDate] = useState("");
    const [terminationDate, setTerminationDate] = useState("");
    const [abandonmentStartDate, setAbandonmentStartDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (open && currentSchedule) {
            setSchedule(currentSchedule);
        }
    }, [open, currentSchedule]);

    // Filter logic moved to Combobox component

    async function handleSubmit(formData: FormData) {
        setError(null);
        setLoading(true);
        try {
            const result = await assignEmployee(formData);
            if (result?.error) {
                setError(result.error);
            } else {
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
            setError("Selecione o motivo da desvinculação");
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {mode === 'unassign' ? 'Desvincular Colaborador' : (activeEmployeeName ? 'Realocação de Posto' : 'Alocação de Posto')}
                        </DialogTitle>
                        <DialogDescription>
                            {mode === 'unassign'
                                ? <><strong>{activeEmployeeName}</strong> será desvinculado. Selecione o motivo.</>
                                : activeEmployeeName
                                    ? <><strong>{activeEmployeeName}</strong> será substituído por outro colaborador no posto de <strong>{postoRole}</strong>.</>
                                    : <>Selecione o colaborador para assumir o posto de <strong>{postoRole}</strong>.</>
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

                            <DialogFooter>
                                <Button type="submit" disabled={loading} className="w-full">
                                    {loading ? "Processando..." : "Confirmar Alocação"}
                                </Button>
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
                                <Label htmlFor="unassignObservation">Observações / Anotações</Label>
                                <Textarea
                                    id="unassignObservation"
                                    value={observation}
                                    onChange={(e) => setObservation(e.target.value)}
                                    placeholder="Escreva aqui anotações ou observações sobre a desvinculação (ex: motivos, detalhes do abandono, etc)..."
                                    className="min-h-[80px]"
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
