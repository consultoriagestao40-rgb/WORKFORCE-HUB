"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { createPosto } from "@/app/actions";
import { toast } from "sonner";

interface ClonePostoSheetProps {
    posto: {
        id: string;
        clientId: string;
        roleId: string;
        schedule: string;
        startTime: string;
        endTime: string;
        billingValue: number;
        requiredWorkload: number;
        isNightShift: boolean;
        isReservaTecnica?: boolean;
        notes?: string | null;
        baseSalary: number;
        insalubridade: number;
        periculosidade: number;
        gratificacao: number;
        outrosAdicionais: number;
        valeAlimentacao?: number;
        vaType?: string;
        valeTransporte?: number;
        valeTransporte2?: number | null;
        vtPaymentMethod2?: string | null;
        vtDiscountPercentage?: number;
        vaDiscountPercentage?: number;
        vaMealsProvidedOnSite?: boolean;
        vaPaidOnVacation?: boolean;
        absenteismoAwardValue?: number;
        absenteismoAwardPeriod?: string;
        absenteismoAwardType?: string;
        absenteismoMinDays?: number;
        role?: { name: string };
    };
    postoIndex?: number;
    schedules: { id: string; name: string }[];
    roles: { id: string; name: string }[];
}

export function ClonePostoSheet({ posto, postoIndex, schedules, roles }: ClonePostoSheetProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const formData = new FormData(e.currentTarget);
            await createPosto(formData);
            toast.success("Posto clonado com sucesso!");
            setOpen(false);
        } catch (error) {
            console.error("Erro ao clonar posto:", error);
            toast.error("Erro ao criar posto clonado.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 px-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Clonar Posto (Criar cópia igual ou com edições)"
                >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="sr-only">Clonar Posto</span>
                </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-[600px] px-8">
                <SheetHeader>
                    <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
                        <Sparkles className="w-4 h-4" />
                        <span>Clonar Posto</span>
                    </div>
                    <SheetTitle>
                        Clonar Posto {postoIndex ? `#${postoIndex}` : ""} ({posto.role?.name || "Vaga"})
                    </SheetTitle>
                    <SheetDescription>
                        Todos os dados e parâmetros foram pré-carregados. Você pode salvar como está ou ajustar horários, escala, valores ou a observação antes de confirmar.
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleFormSubmit} className="space-y-4 mt-6 h-[80vh] overflow-y-auto pr-4">
                    <input type="hidden" name="clientId" value={posto.clientId} />

                    <div className="space-y-2">
                        <Label htmlFor="roleId">Cargo / Função</Label>
                        <Select name="roleId" defaultValue={posto.roleId} required>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o Cargo" />
                            </SelectTrigger>
                            <SelectContent>
                                {roles?.map(r => (
                                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="schedule">Escala</Label>
                        <Select name="schedule" defaultValue={posto.schedule} required>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a Escala" />
                            </SelectTrigger>
                            <SelectContent>
                                {schedules?.map(sch => (
                                    <SelectItem key={sch.id} value={sch.name}>{sch.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startTime">Início</Label>
                            <Input id="startTime" name="startTime" type="time" defaultValue={posto.startTime} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endTime">Fim</Label>
                            <Input id="endTime" name="endTime" type="time" defaultValue={posto.endTime} required />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="requiredWorkload">Carga Exigida (h)</Label>
                            <Input id="requiredWorkload" name="requiredWorkload" type="number" defaultValue={posto.requiredWorkload} required />
                        </div>
                        <div className="space-y-2" title="Valor que o cliente paga à empresa por este posto">
                            <Label htmlFor="billingValue">Faturamento (R$)</Label>
                            <Input id="billingValue" name="billingValue" type="number" step="0.01" defaultValue={posto.billingValue} required />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="notes">Observação / Identificação do Posto (Opcional)</Label>
                        <Input 
                            id="notes" 
                            name="notes" 
                            defaultValue={posto.notes || ""} 
                            placeholder="Ex: POSTO DE SERVIÇOS EXTRA, Portaria 2..." 
                            maxLength={150} 
                        />
                        <p className="text-[11px] text-slate-400">
                            Esta anotação fica visível na lista de postos para facilitar a identificação da vaga.
                        </p>
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                        <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Quadro do Contrato (Custos Previstos)</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2 text-xs text-slate-500 bg-blue-50 p-2 rounded">
                                Estes valores compõem o quadro orçado para este posto e servirão de base para o cálculo de rentabilidade.
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="baseSalary">Salário Base (R$)</Label>
                                <Input id="baseSalary" name="baseSalary" type="number" step="0.01" defaultValue={posto.baseSalary} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="insalubridade">Insalubridade (R$)</Label>
                                <Input id="insalubridade" name="insalubridade" type="number" step="0.01" defaultValue={posto.insalubridade} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="periculosidade">Periculosidade (R$)</Label>
                                <Input id="periculosidade" name="periculosidade" type="number" step="0.01" defaultValue={posto.periculosidade} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gratificacao">Gratificação CCT (R$)</Label>
                                <Input id="gratificacao" name="gratificacao" type="number" step="0.01" defaultValue={posto.gratificacao} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="valeAlimentacao">Vale Alimentação (R$)</Label>
                                <div className="flex gap-2">
                                    <Input id="valeAlimentacao" name="valeAlimentacao" type="number" step="0.01" defaultValue={posto.valeAlimentacao || 0} className="flex-1" />
                                    <Select name="vaType" defaultValue={posto.vaType || "mensal"}>
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
                                <Input id="valeTransporte" name="valeTransporte" type="number" step="0.01" defaultValue={posto.valeTransporte || 0} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="valeTransporte2">Vale Transporte 2 (R$)</Label>
                                <div className="flex gap-2">
                                    <Input id="valeTransporte2" name="valeTransporte2" type="number" step="0.01" defaultValue={posto.valeTransporte2 || 0} className="flex-1" />
                                    <Select name="vtPaymentMethod2" defaultValue={posto.vtPaymentMethod2 || "Urbs"}>
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
                                <Label htmlFor="outrosAdicionais">Assiduidade Cartão VA (R$)</Label>
                                <Input id="outrosAdicionais" name="outrosAdicionais" type="number" step="0.01" defaultValue={posto.outrosAdicionais || 0} />
                            </div>

                            <div className="space-y-2 col-span-2 border-t pt-4 mt-2">
                                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Regras de CCT e Descontos</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="vtDiscountPercentage">Desconto VT em Folha (%)</Label>
                                        <Input id="vtDiscountPercentage" name="vtDiscountPercentage" type="number" step="0.01" defaultValue={posto.vtDiscountPercentage ?? 6} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="vaDiscountPercentage">Desconto VA em Folha (%)</Label>
                                        <Input id="vaDiscountPercentage" name="vaDiscountPercentage" type="number" step="0.01" defaultValue={posto.vaDiscountPercentage ?? 20} />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 pt-2">
                                    <div className="flex items-center space-x-2">
                                        <input 
                                            type="checkbox" 
                                            id="vaMealsProvidedOnSite" 
                                            name="vaMealsProvidedOnSite" 
                                            value="true" 
                                            defaultChecked={!!posto.vaMealsProvidedOnSite}
                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" 
                                        />
                                        <Label htmlFor="vaMealsProvidedOnSite" className="text-xs font-semibold text-slate-700">Refeição Fornecida no Local?</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <input 
                                            type="checkbox" 
                                            id="vaPaidOnVacation" 
                                            name="vaPaidOnVacation" 
                                            value="true" 
                                            defaultChecked={!!posto.vaPaidOnVacation}
                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" 
                                        />
                                        <Label htmlFor="vaPaidOnVacation" className="text-xs font-semibold text-slate-700">Pagar VA nas Férias?</Label>
                                    </div>
                                </div>
                                <div className="border-t pt-4 mt-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Premiação por Absenteísmo (Cartão VA)</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="absenteismoAwardValue">Valor do Prêmio (R$)</Label>
                                            <Input id="absenteismoAwardValue" name="absenteismoAwardValue" type="number" step="0.01" defaultValue={posto.absenteismoAwardValue || 0} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="absenteismoAwardPeriod">Apuração</Label>
                                            <Select name="absenteismoAwardPeriod" defaultValue={posto.absenteismoAwardPeriod || "mensal"}>
                                                <SelectTrigger className="h-9 w-full rounded-xl bg-white border-slate-200 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="mensal">Mensal</SelectItem>
                                                    <SelectItem value="trimestral">Trimestral</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="absenteismoAwardType">Tipo de Pagamento</Label>
                                            <Select name="absenteismoAwardType" defaultValue={posto.absenteismoAwardType || "prorrata"}>
                                                <SelectTrigger className="h-9 w-full rounded-xl bg-white border-slate-200 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="prorrata">Pró-rata (Proporcional ao mês)</SelectItem>
                                                    <SelectItem value="integral">Integral (Apenas mês completo)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="absenteismoMinDays">Carência (Dias Experiência)</Label>
                                            <Select name="absenteismoMinDays" defaultValue={String(posto.absenteismoMinDays || 0)}>
                                                <SelectTrigger className="h-9 w-full rounded-xl bg-white border-slate-200 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">Sem Carência (Desde a admissão)</SelectItem>
                                                    <SelectItem value="90">90 Dias (Após a experiência)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2 pb-6">
                        <div className="flex items-center space-x-2">
                            <input 
                                type="checkbox" 
                                id="isNightShift" 
                                name="isNightShift" 
                                value="true" 
                                defaultChecked={!!posto.isNightShift}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer" 
                            />
                            <Label htmlFor="isNightShift" className="text-sm font-medium leading-none cursor-pointer">
                                Posto com Adicional Noturno?
                            </Label>
                        </div>
                        <div className="flex items-start space-x-2 bg-sky-50 border border-sky-200/80 p-2.5 rounded-lg">
                            <input 
                                type="checkbox" 
                                id="isReservaTecnica" 
                                name="isReservaTecnica" 
                                value="true" 
                                defaultChecked={!!posto.isReservaTecnica}
                                className="w-4 h-4 text-sky-600 bg-white border-sky-300 rounded focus:ring-sky-500 mt-0.5 cursor-pointer" 
                            />
                            <div>
                                <Label htmlFor="isReservaTecnica" className="text-sm font-bold text-sky-900 cursor-pointer block">
                                    Posto de RT - Reserva Técnica?
                                </Label>
                                <span className="text-[11px] text-sky-700 leading-tight block mt-0.5">
                                    Identifica este posto como cobertura de Reserva Técnica, diferenciando do quadro efetivo do contrato nos relatórios.
                                </span>
                            </div>
                        </div>
                    </div>

                    <Button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold">
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Criando Posto Clonado...</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-4 h-4" />
                                <span>Criar Posto Clonado</span>
                            </>
                        )}
                    </Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
