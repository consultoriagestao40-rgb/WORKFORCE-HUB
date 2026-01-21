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
    const [employeeSearch, setEmployeeSearch] = useState("");
    const [schedule, setSchedule] = useState(currentSchedule || "12x36");

    useEffect(() => {
        if (open && currentSchedule) {
            setSchedule(currentSchedule);
        }
    }, [open, currentSchedule]);

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(employeeSearch.toLowerCase())
    ).slice(0, 50); // Limit to 50 for performance

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
            if (createVacancy) {
                formData.append("createVacancy", "on");
            }
            await unassignEmployee(formData);
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
        setEmployeeSearch(""); // Reset search
        setOpen(true);
        if (currentSchedule) setSchedule(currentSchedule);
    }

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

            <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) { setError(null); setCreateVacancy(false); setSelectedSituation(""); } }}>
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

                            <div className="space-y-2">
                                <Label>Buscar Colaborador</Label>
                                <Input
                                    placeholder="Digite o nome..."
                                    value={employeeSearch}
                                    onChange={(e) => setEmployeeSearch(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Selecionar Colaborador * ({filteredEmployees.length})</Label>
                                <Select name="employeeId" required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione na lista..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredEmployees.map(emp => (
                                            <SelectItem key={emp.id} value={emp.id}>
                                                {emp.name} ({emp.role.name})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Data de Início</Label>
                                    <Input type="date" name="startDate" required defaultValue={new Date().toISOString().split('T')[0]} />
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
                                    {/* Fallback hidden input/manual input if needed? Assuming options cover it or we need a creatable select. Sticking to options for now as requested. */}
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
