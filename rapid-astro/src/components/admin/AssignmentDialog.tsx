"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, UserMinus, AlertCircle } from "lucide-react";
import { assignEmployee, unassignEmployee } from "@/app/actions";
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

    async function handleSubmit(formData: FormData) {
        setError(null);
        setLoading(true);
        try {
            const result = await assignEmployee(formData);
            if (result?.error) {
                setError(result.error);
            } else {
                setOpen(false);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleUnassign() {
        if (!confirm("Deseja realmente desvincular o colaborador deste posto?")) return;
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("postoId", postoId);
            await unassignEmployee(formData);
            setOpen(false);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) setError(null); }}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                    <UserPlus className="w-3 h-3" />
                    {activeEmployeeName ? 'Alterar' : 'Alocar'}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Alocação de Posto</DialogTitle>
                    <DialogDescription>
                        Selecione o colaborador para assumir o posto de <strong>{postoRole}</strong>.
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

                    {activeEmployeeName && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md mb-4 text-xs text-amber-800">
                            <strong>Atenção:</strong> {activeEmployeeName} está alocado neste posto.
                            Uma nova alocação encerrará a atual automaticamente.
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Colaborador</Label>
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
                    <DialogFooter className="flex justify-between sm:justify-between w-full">
                        {activeEmployeeName ? (
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="gap-2"
                                onClick={handleUnassign}
                                disabled={loading}
                            >
                                <UserMinus className="w-4 h-4" />
                                Desvincular
                            </Button>
                        ) : <div />}
                        <Button type="submit" disabled={loading}>
                            {loading ? "Processando..." : "Confirmar Alocação"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
