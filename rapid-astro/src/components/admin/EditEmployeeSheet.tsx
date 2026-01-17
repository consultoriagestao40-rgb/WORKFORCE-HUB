"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit } from "lucide-react";
import { updateEmployee } from "@/app/actions";
import { VacationHistory } from "./VacationHistory";
import { toast } from "sonner";

interface EditEmployeeSheetProps {
    employee: {
        id: string;
        name: string;
        cpf: string;
        roleId: string;
        type: string;
        status: string;
        situationId: string | null;
        companyId: string | null; // Added companyId
        admissionDate: Date;
        lastVacationStart: Date | null;
        lastVacationEnd: Date | null;
        totalVacationDaysTaken: number;
        salary: number;
        insalubridade: number;
        periculosidade: number;
        gratificacao: number;
        outrosAdicionais: number;
        workload: number;
        valeAlimentacao: number;
        valeTransporte: number;
        birthDate: Date | null;
        gender: string | null;
        address: string | null;
        phone: string | null;
        email: string | null;
        dismissalReason: string | null;
        dismissalNotes: string | null;
        vacations?: any[];
    };
    situations: { id: string, name: string }[];
    roles: { id: string, name: string }[];
    companies?: { id: string, name: string }[]; // Added companies prop
}

export function EditEmployeeSheet({ employee, situations, roles, companies = [] }: EditEmployeeSheetProps) {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState(employee.status);

    async function handleSubmit(formData: FormData) {
        try {
            const result = await updateEmployee(formData);
            if (result?.error) {
                toast.error(result.error);
                return;
            }
            setOpen(false);
            toast.success("Dados atualizados com sucesso!");
        } catch (error: any) {
            toast.error(error.message);
        }
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Edit className="w-4 h-4" />
                    Editar Perfil
                </Button>
            </SheetTrigger>
            <SheetContent className="px-8 sm:max-w-xl w-full">
                <SheetHeader>
                    <SheetTitle>Editar Colaborador</SheetTitle>
                    <SheetDescription>Atualize os dados de {employee.name}.</SheetDescription>
                </SheetHeader>
                <form action={handleSubmit} className="space-y-4 mt-6 h-[85vh] overflow-y-auto pr-2 scrollbar-hide">
                    <input type="hidden" name="id" value={employee.id} />

                    <div className="space-y-2">
                        <Label htmlFor="name">Nome Completo</Label>
                        <Input id="name" name="name" defaultValue={employee.name} required />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="companyId">Empresa Vinculada</Label>
                        <Select name="companyId" defaultValue={employee.companyId || "no_company"}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a empresa" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="no_company">Sem Empresa Vinculada</SelectItem>
                                {companies.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="birthDate">Data de Nascimento</Label>
                            <Input
                                id="birthDate"
                                name="birthDate"
                                type="date"
                                defaultValue={employee.birthDate ? new Date(employee.birthDate).toISOString().split('T')[0] : ""}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gender">Gênero</Label>
                            <Select name="gender" defaultValue={employee.gender || undefined}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Masculino">Masculino</SelectItem>
                                    <SelectItem value="Feminino">Feminino</SelectItem>
                                    <SelectItem value="Outro">Outro</SelectItem>
                                    <SelectItem value="Prefiro não dizer">Prefiro não dizer</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="text-sm font-semibold border-b pt-4 pb-1">Contato e Endereço</div>
                    <div className="space-y-2">
                        <Label htmlFor="address">Endereço Completo</Label>
                        <Input id="address" name="address" defaultValue={employee.address || ""} placeholder="Rua, Número, Bairro, Cidade - UF" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefone / Celular</Label>
                            <Input id="phone" name="phone" defaultValue={employee.phone || ""} placeholder="(00) 00000-0000" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Pessoal</Label>
                            <Input id="email" name="email" type="email" defaultValue={employee.email || ""} placeholder="email@exemplo.com" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="cpf">CPF</Label>
                            <Input id="cpf" name="cpf" defaultValue={employee.cpf} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="workload">Carga Horária (h)</Label>
                            <Input id="workload" name="workload" type="number" defaultValue={employee.workload} required />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="admissionDate">Data de Admissão</Label>
                            <Input
                                id="admissionDate"
                                name="admissionDate"
                                type="date"
                                defaultValue={new Date(employee.admissionDate).toISOString().split('T')[0]}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="situationId">Situação Atual</Label>
                            <Select
                                name="situationId"
                                defaultValue={employee.situationId || undefined}
                                onValueChange={(val) => {
                                    const selectedSituation = situations.find(s => s.id === val);
                                    if (selectedSituation &&
                                        (selectedSituation.name.toLowerCase().includes("demitido") ||
                                            selectedSituation.name.toLowerCase().includes("desligado"))) {
                                        setStatus("Desligado");
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {situations.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="roleId">Cargo</Label>
                        <Select name="roleId" defaultValue={employee.roleId} required>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {roles.map(r => (
                                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* New Vacation History Component */}
                    <div className="pt-2">
                        <VacationHistory
                            employeeId={employee.id}
                            vacations={employee.vacations || []}
                        />
                    </div>

                    {/* Hidden Legacy Fields to maintain compatibility if needed, but UI is now handled by component above */}
                    {/* We can keep them hidden or just remove them if we strictly rely on the new model. 
                        However, the user might expect the "Status" dropdown somewhere. 
                        Let's keep the Status dropdown below the history. */}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="status">Status (Legado)</Label>
                            <Select name="status" value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Ativo">Ativo</SelectItem>
                                    <SelectItem value="Férias">Férias</SelectItem>
                                    <SelectItem value="Afastado">Afastado</SelectItem>
                                    <SelectItem value="Desligado">Desligado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="type">Tipo de Contrato</Label>
                            <Select name="type" defaultValue={employee.type}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CLT">CLT (Efetivo)</SelectItem>
                                    <SelectItem value="Reserva Técnica">Reserva Técnica</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {status === "Desligado" && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                            <h4 className="text-sm font-semibold text-red-800">Detalhes do Desligamento</h4>
                            <div className="space-y-2">
                                <Label htmlFor="dismissalReason" className="text-red-700">Motivo</Label>
                                <Select name="dismissalReason" defaultValue={employee.dismissalReason || undefined}>
                                    <SelectTrigger className="bg-white border-red-200">
                                        <SelectValue placeholder="Selecione o motivo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Baixa Performance">Baixa Performance</SelectItem>
                                        <SelectItem value="Comportamental">Comportamental</SelectItem>
                                        <SelectItem value="Corte de Custos">Corte de Custos</SelectItem>
                                        <SelectItem value="Pedido de Demissão">Pedido de Demissão</SelectItem>
                                        <SelectItem value="Término de Contrato">Término de Contrato</SelectItem>
                                        <SelectItem value="Outros">Outros</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dismissalNotes" className="text-red-700">Relato do RH</Label>
                                <Textarea
                                    id="dismissalNotes"
                                    name="dismissalNotes"
                                    defaultValue={employee.dismissalNotes || ""}
                                    placeholder="Descreva brevemente o motivo ou observações importantes..."
                                    className="bg-white border-red-200 min-h-[80px]"
                                />
                            </div>
                        </div>
                    )}

                    <div className="text-sm font-semibold border-b pt-4 pb-1">Financeiro (Mensal)</div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="salary">Salário Base (R$)</Label>
                            <Input id="salary" name="salary" type="number" step="0.01" defaultValue={employee.salary} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="insalubridade">Insalubridade (R$)</Label>
                            <Input id="insalubridade" name="insalubridade" type="number" step="0.01" defaultValue={employee.insalubridade} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="periculosidade">Periculosidade (R$)</Label>
                            <Input id="periculosidade" name="periculosidade" type="number" step="0.01" defaultValue={employee.periculosidade} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gratificacao">Gratificacao CCT (R$)</Label>
                            <Input id="gratificacao" name="gratificacao" type="number" step="0.01" defaultValue={employee.gratificacao} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="outrosAdicionais">Outros Adicionais (R$)</Label>
                            <Input id="outrosAdicionais" name="outrosAdicionais" type="number" step="0.01" defaultValue={employee.outrosAdicionais} />
                        </div>
                    </div>

                    <div className="text-sm font-semibold border-b pt-4 pb-1">Benefícios Mensais</div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="valeAlimentacao">Vale Alimentação (R$)</Label>
                            <Input id="valeAlimentacao" name="valeAlimentacao" type="number" step="0.01" defaultValue={employee.valeAlimentacao} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="valeTransporte">Vale Transporte (R$)</Label>
                            <Input id="valeTransporte" name="valeTransporte" type="number" step="0.01" defaultValue={employee.valeTransporte} />
                        </div>
                    </div>

                    <Button type="submit" className="w-full">Salvar Alterações</Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
