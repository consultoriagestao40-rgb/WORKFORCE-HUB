"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, AlertCircle } from "lucide-react";
import { assignEmployee } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AssignmentDialogProps {
    postoId: string;
    postoRole: string;
    activeEmployeeName?: string;
    employees: { id: string; name: string; role: { name: string } }[];
}

export function AssignmentDialog({ postoId, postoRole, activeEmployeeName, employees }: AssignmentDialogProps) {
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [createVacancy, setCreateVacancy] = useState(false);

    async function handleSubmit(formData: FormData) {
        setError(null);
        setLoading(true);
        try {
            const result = await assignEmployee(formData);
            if (result?.error) {
                setError(result.error);
            } else {
                setOpen(false);
                setCreateVacancy(false); // Reset
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) { setError(null); setCreateVacancy(false); } }}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                    <UserPlus className="w-3 h-3" />
                    {activeEmployeeName ? 'Alterar' : 'Alocar'}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {activeEmployeeName ? 'Realocação de Posto' : 'Alocação de Posto'}
                    </DialogTitle>
                    <DialogDescription>
                        {activeEmployeeName
                            ? <>
                                <strong>{activeEmployeeName}</strong> será desvinculado e um novo colaborador assumirá o posto de <strong>{postoRole}</strong>.
                            </>
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

                <form action={handleSubmit} className="space-y-4 py-4">
                    <input type="hidden" name="postoId" value={postoId} />

                    <div className="space-y-2">
                        <Label>Novo Colaborador *</Label>
                        <Select name="employeeId" required>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                {employees.map(emp => (
                                    <SelectItem key={emp.id} value={emp.id}>
                                        {emp.name} ({emp.role.name})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Data de Início</Label>
                        <Input type="date" name="startDate" required defaultValue={new Date().toISOString().split('T')[0]} />
                    </div>

                    {activeEmployeeName && (
                        <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <Checkbox
                                id="createVacancy"
                                name="createVacancy"
                                checked={createVacancy}
                                onCheckedChange={(checked) => setCreateVacancy(checked === true)}
                            />
                            <Label
                                htmlFor="createVacancy"
                                className="text-sm font-normal cursor-pointer flex-1"
                            >
                                Abrir vaga no Recrutamento & Seleção para este posto?
                            </Label>
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? "Processando..." : "Confirmar Realocação"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
