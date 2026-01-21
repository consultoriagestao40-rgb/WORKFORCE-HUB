"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "lucide-react";
import { CalendarView } from "@/components/CalendarView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateAssignmentSchedule } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface ScheduleDialogProps {
    postoId: string;
    postoRole: string;
    currentSchedule: string;
    startDate: Date;
    scheduleOptions: { id: string; name: string; }[];
    assignmentId: string;
}

export function ScheduleDialog({ postoId, postoRole, currentSchedule, startDate, scheduleOptions, assignmentId }: ScheduleDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        setError(null);
        try {
            const result = await updateAssignmentSchedule(formData);
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

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="ml-2 gap-2 text-blue-600 hover:text-blue-700">
                    <Calendar className="w-3 h-3" />
                    Escala
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Gerenciamento de Escala</DialogTitle>
                    <DialogDescription>
                        Posto: <strong>{postoRole}</strong>
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="visualize" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="visualize">Visualizar</TabsTrigger>
                        <TabsTrigger value="edit">Editar Configuração</TabsTrigger>
                    </TabsList>

                    <TabsContent value="visualize" className="py-4">
                        <p className="text-sm text-slate-500 mb-4 text-center">
                            Escala <strong>{currentSchedule}</strong> iniciada em {new Date(startDate).toLocaleDateString('pt-BR')}.
                        </p>
                        <div className="flex justify-center">
                            <CalendarView
                                scheduleType={currentSchedule}
                                startDate={startDate.toISOString()}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="edit">
                        {error && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Erro</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <form action={handleSubmit} className="space-y-4 py-4">
                            <input type="hidden" name="assignmentId" value={assignmentId} />
                            <input type="hidden" name="postoId" value={postoId} />

                            <div className="space-y-2">
                                <Label>Data de Início da Escala</Label>
                                <Input
                                    type="date"
                                    name="startDate"
                                    required
                                    defaultValue={new Date(startDate).toISOString().split('T')[0]}
                                />
                                <p className="text-xs text-slate-500">
                                    Alterar esta data mudará o dia de referência para o cálculo dos plantões.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Tipo de Escala</Label>
                                <Select name="schedule" defaultValue={currentSchedule}>
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
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={loading} className="w-full">
                                    {loading ? "Salvando..." : "Salvar Alterações"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
