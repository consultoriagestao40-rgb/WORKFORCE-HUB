"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { createPosto } from "@/app/actions";

interface NewPostoSheetProps {
    clientId: string;
    schedules: { id: string; name: string }[];
    roles: { id: string; name: string }[];
}

export function NewPostoSheet({ clientId, schedules, roles }: NewPostoSheetProps) {
    const [open, setOpen] = useState(false);

    async function handleSubmit(formData: FormData) {
        await createPosto(formData);
        setOpen(false);
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> Novo Posto</Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-[600px] px-8">
                <SheetHeader>
                    <SheetTitle>Novo Posto</SheetTitle>
                    <SheetDescription>Adicione uma vaga contratada para este site.</SheetDescription>
                </SheetHeader>
                <form action={handleSubmit} className="space-y-4 mt-6 h-[80vh] overflow-y-auto pr-4">
                    <input type="hidden" name="clientId" value={clientId} />

                    <div className="space-y-2">
                        <Label htmlFor="roleId">Cargo / Função</Label>
                        <Select name="roleId" required>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o Cargo" />
                            </SelectTrigger>
                            <SelectContent>
                                {roles.map(r => (
                                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="schedule">Escala</Label>
                        <Select name="schedule" required>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a Escala" />
                            </SelectTrigger>
                            <SelectContent>
                                {schedules.map(sch => (
                                    <SelectItem key={sch.id} value={sch.name}>{sch.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startTime">Início</Label>
                            <Input id="startTime" name="startTime" type="time" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endTime">Fim</Label>
                            <Input id="endTime" name="endTime" type="time" required />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="requiredWorkload">Carga Exigida (h)</Label>
                            <Input id="requiredWorkload" name="requiredWorkload" type="number" defaultValue="220" required />
                        </div>
                        <div className="space-y-2" title="Valor que o cliente paga à empresa por este posto">
                            <Label htmlFor="billingValue">Faturamento (R$)</Label>
                            <Input id="billingValue" name="billingValue" type="number" step="0.01" placeholder="0.00" required />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                        <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Quadro do Contrato (Custos Previstos)</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2 text-xs text-slate-500 bg-blue-50 p-2 rounded">
                                Estes valores compõem o quadro orçado para este posto e servirão de base para o cálculo de rentabilidade.
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="baseSalary">Salário Base (R$)</Label>
                                <Input id="baseSalary" name="baseSalary" type="number" step="0.01" defaultValue="0" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="insalubridade">Insalubridade (R$)</Label>
                                <Input id="insalubridade" name="insalubridade" type="number" step="0.01" defaultValue="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="periculosidade">Periculosidade (R$)</Label>
                                <Input id="periculosidade" name="periculosidade" type="number" step="0.01" defaultValue="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gratificacao">Gratificação CCT (R$)</Label>
                                <Input id="gratificacao" name="gratificacao" type="number" step="0.01" defaultValue="0" />
                            </div>
                             <div className="space-y-2">
                                 <Label htmlFor="valeAlimentacao">Vale Alimentação (R$)</Label>
                                 <div className="flex gap-2">
                                     <Input id="valeAlimentacao" name="valeAlimentacao" type="number" step="0.01" defaultValue="0" className="flex-1" />
                                     <Select name="vaType" defaultValue="mensal">
                                         <SelectTrigger className="h-9 w-[95px] rounded-xl bg-white border-slate-200 text-xs">
                                             <SelectValue />
                                         </SelectTrigger>
                                         <SelectContent>
                                             <SelectItem value="mensal">Mensal</SelectItem>
                                             <SelectItem value="diario">Diário</SelectItem>
                                         </SelectContent>
                                     </Select>
                                 </div>
                             </div>
                             <div className="space-y-2">
                                 <Label htmlFor="valeTransporte">Vale Transporte 1 (R$)</Label>
                                 <Input id="valeTransporte" name="valeTransporte" type="number" step="0.01" defaultValue="0" />
                             </div>
                             <div className="space-y-2">
                                 <Label htmlFor="valeTransporte2">Vale Transporte 2 (R$)</Label>
                                 <div className="flex gap-2">
                                     <Input id="valeTransporte2" name="valeTransporte2" type="number" step="0.01" defaultValue="0" className="flex-1" />
                                     <Select name="vtPaymentMethod2" defaultValue="Urbs">
                                         <SelectTrigger className="h-9 w-[100px] rounded-xl bg-white border-slate-200 text-xs">
                                             <SelectValue />
                                         </SelectTrigger>
                                         <SelectContent>
                                             <SelectItem value="Metrocard">Metrocard</SelectItem>
                                             <SelectItem value="Urbs">Urbs</SelectItem>
                                             <SelectItem value="PIX">PIX</SelectItem>
                                         </SelectContent>
                                     </Select>
                                 </div>
                             </div>
                             <div className="space-y-2 col-span-2">
                                 <Label htmlFor="outrosAdicionais">Outros Adicionais (R$)</Label>
                                 <Input id="outrosAdicionais" name="outrosAdicionais" type="number" step="0.01" defaultValue="0" />
                             </div>

                             <div className="space-y-2 col-span-2 border-t pt-4 mt-2">
                                 <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Regras de CCT e Descontos</h4>
                                 <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                         <Label htmlFor="vtDiscountPercentage">Desconto VT em Folha (%)</Label>
                                         <Input id="vtDiscountPercentage" name="vtDiscountPercentage" type="number" step="0.01" defaultValue="6" />
                                     </div>
                                     <div className="space-y-2">
                                         <Label htmlFor="vaDiscountPercentage">Desconto VA em Folha (%)</Label>
                                         <Input id="vaDiscountPercentage" name="vaDiscountPercentage" type="number" step="0.01" defaultValue="20" />
                                     </div>
                                 </div>
                                 <div className="flex flex-col gap-2 pt-2">
                                     <div className="flex items-center space-x-2">
                                         <input type="checkbox" id="vaMealsProvidedOnSite" name="vaMealsProvidedOnSite" value="true" className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
                                         <Label htmlFor="vaMealsProvidedOnSite" className="text-xs font-semibold text-slate-700">Refeição Fornecida no Local?</Label>
                                     </div>
                                     <div className="flex items-center space-x-2">
                                         <input type="checkbox" id="vaPaidOnVacation" name="vaPaidOnVacation" value="true" className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
                                         <Label htmlFor="vaPaidOnVacation" className="text-xs font-semibold text-slate-700">Pagar VA nas Férias?</Label>
                                     </div>
                                 </div>
                             </div>
                         </div>
                     </div>

                    <div className="flex items-center space-x-2 pt-2 pb-6">
                        <input type="checkbox" id="isNightShift" name="isNightShift" value="true" className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
                        <Label htmlFor="isNightShift" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Posto com Adicional Noturno?
                        </Label>
                    </div>

                    <Button type="submit" className="w-full">Salvar Posto</Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
