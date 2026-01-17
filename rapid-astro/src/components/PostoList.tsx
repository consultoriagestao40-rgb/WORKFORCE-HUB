"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Clock, User, AlertTriangle, UserX, UserPlus, DollarSign } from "lucide-react";
import { registerCoverage } from "@/app/actions";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface PostoListProps {
    postos: any[];
    employees?: any[];
}

export function PostoList({ postos, employees = [] }: PostoListProps) {
    const [selectedPosto, setSelectedPosto] = useState<any>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [coverageType, setCoverageType] = useState<string | null>(null);

    // Reset when sheet closes
    const onOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) setCoverageType(null);
    }

    // Helper to handle form submission wrapper
    async function handleAction(formData: FormData) {
        await registerCoverage(formData);
        setIsOpen(false);
    }

    return (
        <div className="space-y-4">
            {postos.map((posto) => {
                // Determine occupant logic
                const occupant = posto.assignments[0]?.employee?.name || "Vago";
                const isVacant = occupant === "Vago";

                return (
                    <Card key={posto.id} className="overflow-hidden border-none shadow-sm">
                        <div className="flex">
                            <div className={`w-1.5 ${isVacant ? 'bg-red-500' : 'bg-blue-500'}`} />
                            <div className="flex-1 p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-semibold text-slate-800">{posto.role}</h3>
                                        <div className="flex items-center text-xs text-slate-500 mt-1">
                                            <Clock className="w-3 h-3 mr-1" /> {posto.startTime} - {posto.endTime} ({posto.schedule})
                                        </div>
                                    </div>
                                    {isVacant ? (
                                        <Badge variant="destructive">Vago</Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">Preenchido</Badge>
                                    )}
                                </div>

                                <div className="flex items-center justify-between mt-3">
                                    <div className="flex items-center text-sm text-slate-600">
                                        <User className="w-4 h-4 mr-2 text-slate-400" />
                                        {occupant}
                                    </div>

                                    <Sheet open={isOpen && selectedPosto?.id === posto.id} onOpenChange={(open) => {
                                        onOpenChange(open);
                                        if (open) setSelectedPosto(posto);
                                    }}>
                                        <SheetTrigger asChild>
                                            <Button size="sm" variant={isVacant ? "destructive" : "secondary"}>
                                                {isVacant ? "Cobertura" : "Sinalizar"}
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent side="bottom" className="rounded-t-3xl">
                                            <SheetHeader>
                                                <SheetTitle>Registrar Ocorrência</SheetTitle>
                                                <SheetDescription>Posto: {selectedPosto?.role}</SheetDescription>
                                            </SheetHeader>
                                            <div className="grid gap-4 py-6">
                                                <form action={handleAction}>
                                                    <input type="hidden" name="postoId" value={selectedPosto?.id || ''} />
                                                    <input type="hidden" name="date" value={new Date().toISOString()} />

                                                    <div className="grid grid-cols-1 gap-3">
                                                        <h4 className="text-sm font-medium text-slate-500 mb-1">Selecione a Ação</h4>

                                                        {/* Option 1: Diarista */}
                                                        <Button type="submit" name="type" value="Diarista" className="w-full justify-start h-14 bg-indigo-600 hover:bg-indigo-700 text-white">
                                                            <UserPlus className="mr-3 h-5 w-5" />
                                                            <div className="text-left">
                                                                <div className="font-semibold">Cobrir com Diarista</div>
                                                                <div className="text-xs opacity-80">Pagamento Imediato (Caixa)</div>
                                                            </div>
                                                        </Button>

                                                        {/* Option 2: Hora Extra (Expandable) */}
                                                        {coverageType !== 'Hora Extra' ? (
                                                            <Button type="button" onClick={() => setCoverageType('Hora Extra')} className="w-full justify-start h-14 bg-blue-600 hover:bg-blue-700 text-white">
                                                                <Clock className="mr-3 h-5 w-5" />
                                                                <div className="text-left">
                                                                    <div className="font-semibold">Cobrir com Hora Extra</div>
                                                                    <div className="text-xs opacity-80">Pagamento na Folha</div>
                                                                </div>
                                                            </Button>
                                                        ) : (
                                                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-in fade-in slide-in-from-top-2">
                                                                <div className="mb-3">
                                                                    <Label className="text-xs text-slate-500 mb-1 block">Quem fará a cobertura?</Label>
                                                                    <Select name="coveringEmployeeId" required>
                                                                        <SelectTrigger className="bg-white">
                                                                            <SelectValue placeholder="Selecione o Colaborador" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {employees.map(emp => (
                                                                                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <Button type="submit" name="type" value="Hora Extra" className="w-full bg-blue-600 hover:bg-blue-700">
                                                                    Confirmar Hora Extra
                                                                </Button>
                                                                <Button type="button" variant="ghost" size="sm" onClick={() => setCoverageType(null)} className="w-full mt-2 text-slate-400">
                                                                    Cancelar
                                                                </Button>
                                                            </div>
                                                        )}

                                                        {/* Option 3: Vago */}
                                                        <Button type="submit" name="type" value="Vago" variant="outline" className="w-full justify-start h-14 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800">
                                                            <UserX className="mr-3 h-5 w-5" />
                                                            <div className="text-left">
                                                                <div className="font-semibold">Deixar Vago</div>
                                                                <div className="text-xs opacity-80">Gerar Glosa</div>
                                                            </div>
                                                        </Button>
                                                    </div>
                                                </form>
                                            </div>
                                        </SheetContent>
                                    </Sheet>
                                </div>
                            </div>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}
