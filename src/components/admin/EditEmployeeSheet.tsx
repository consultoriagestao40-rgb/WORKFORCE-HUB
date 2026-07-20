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
    employee: any;
    situations: { id: string, name: string }[];
    roles: { id: string, name: string }[];
    companies?: { id: string, name: string }[];
    postos?: any[];
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
            <SheetContent className="px-8 sm:max-w-2xl w-full">
                <SheetHeader>
                    <SheetTitle>Editar Colaborador</SheetTitle>
                    <SheetDescription>Atualize os dados de {employee.name}.</SheetDescription>
                </SheetHeader>
                <form action={handleSubmit} className="space-y-4 mt-6 h-[85vh] overflow-y-auto pr-2 scrollbar-hide pb-8">
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

                    <div className="text-sm font-semibold border-b pt-4 pb-1">Dados de Contrato</div>
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
                                defaultValue={employee.admissionDate ? new Date(employee.admissionDate).toISOString().split('T')[0] : ""}
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

                    {/* Férias / Histórico */}
                    <div className="pt-4 border-t mt-6">
                        <VacationHistory
                            employeeId={employee.id}
                            vacations={employee.vacations || []}
                            hasActivePosto={employee.assignments?.some((a: any) => !a.endDate && a.posto?.client?.name !== "ROTATIVO")}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-6">
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

                    {/* Actions Block */}
                    <div className="flex gap-2 pt-4 border-t sticky bottom-0 bg-white z-10 pb-4">
                        <Button 
                            type="button" 
                            variant="outline"
                            onClick={() => {
                                const nameVal = (document.getElementById("name") as HTMLInputElement)?.value || employee.name;
                                const cpfVal = (document.getElementById("cpf") as HTMLInputElement)?.value || employee.cpf;
                                const phoneVal = (document.getElementById("phone") as HTMLInputElement)?.value || employee.phone;
                                const emailVal = (document.getElementById("email") as HTMLInputElement)?.value || employee.email;
                                
                                const roleSelect = document.querySelector('select[name="roleId"]') as HTMLSelectElement;
                                const roleVal = roles.find(r => r.id === roleSelect?.value)?.name || "";
                                
                                const companySelect = document.querySelector('select[name="companyId"]') as HTMLSelectElement;
                                const companyVal = companies.find(c => c.id === companySelect?.value)?.name || "";
                                
                                const admissionVal = (document.getElementById("admissionDate") as HTMLInputElement)?.value || employee.admissionDate;
                                const birthVal = (document.getElementById("birthDate") as HTMLInputElement)?.value || employee.birthDate;
                                
                                const genderSelect = document.querySelector('select[name="gender"]') as HTMLSelectElement;
                                const genderVal = genderSelect?.value || employee.gender;
                                
                                const addressVal = (document.getElementById("address") as HTMLInputElement)?.value || employee.address;
                                const salaryVal = (document.getElementById("salary") as HTMLInputElement)?.value || employee.salary;

                                const event = new CustomEvent("workforceRpaCapture", {
                                    detail: {
                                        name: nameVal,
                                        cpf: cpfVal,
                                        phone: phoneVal,
                                        email: emailVal,
                                        role: roleVal,
                                        salary: salaryVal,
                                        company: companyVal,
                                        startDate: admissionVal ? new Date(admissionVal + 'T12:00:00').toLocaleDateString('pt-BR') : "",
                                        birthDate: birthVal ? new Date(birthVal + 'T12:00:00').toLocaleDateString('pt-BR') : "",
                                        gender: genderVal,
                                        address: addressVal
                                    }
                                });
                                document.dispatchEvent(event);
                                toast.success("Dados prontos! Vá para a aba da Thomson Reuters e clique em Preencher.");
                            }}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 rounded-xl"
                        >
                            ⚡ Preencher na Thomson Reuters
                        </Button>
                        <Button type="submit" className="flex-1 h-10 rounded-xl">Salvar Alterações</Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
