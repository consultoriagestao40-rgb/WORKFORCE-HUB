"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { createEmployee } from "@/app/actions";

export interface NewEmployeeSheetProps {
    situations: { id: string, name: string }[];
    roles: { id: string, name: string }[];
    companies?: { id: string, name: string }[];
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    initialData?: {
        name?: string;
        email?: string;
        cpf?: string;
        roleId?: string;
        companyId?: string;
        phone?: string;
    };
    onSuccess?: () => void;
}

export function NewEmployeeSheet({
    situations,
    roles,
    companies = [],
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    initialData,
    onSuccess
}: NewEmployeeSheetProps) {
    const [internalOpen, setInternalOpen] = useState(false);

    // Determine if controlled or uncontrolled
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = (newOpen: boolean) => {
        if (isControlled && setControlledOpen) {
            setControlledOpen(newOpen);
        } else {
            setInternalOpen(newOpen);
        }
    };

    async function handleSubmit(formData: FormData) {
        await createEmployee(formData);
        setOpen(false);
        if (onSuccess) onSuccess();
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            {!isControlled && (
                <SheetTrigger asChild>
                    <Button><Plus className="w-4 h-4 mr-2" /> Novo Colaborador</Button>
                </SheetTrigger>
            )}
            <SheetContent className="px-8">
                <SheetHeader>
                    <SheetTitle>Novo Colaborador</SheetTitle>
                    <SheetDescription>Cadastre um novo funcionário.</SheetDescription>
                </SheetHeader>
                <form action={handleSubmit} className="space-y-4 mt-6 h-[80vh] overflow-y-auto pr-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome Completo</Label>
                        <Input id="name" name="name" required defaultValue={initialData?.name || ''} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="companyId">Empresa Vinculada</Label>
                        <Select name="companyId" defaultValue={initialData?.companyId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a empresa" />
                            </SelectTrigger>
                            <SelectContent>
                                {companies.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="cpf">CPF</Label>
                            <Input id="cpf" name="cpf" placeholder="000.000.000-00" required defaultValue={initialData?.cpf || ''} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="workload">Carga Horária Mensal</Label>
                            <Input id="workload" name="workload" type="number" defaultValue="220" required />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="birthDate">Data de Nascimento</Label>
                            <Input id="birthDate" name="birthDate" type="date" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gender">Gênero</Label>
                            <Select name="gender">
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
                        <Input id="address" name="address" placeholder="Rua, Número, Bairro, Cidade - UF" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefone / Celular</Label>
                            <Input id="phone" name="phone" placeholder="(00) 00000-0000" defaultValue={initialData?.phone || ''} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Pessoal</Label>
                            <Input id="email" name="email" type="email" placeholder="email@exemplo.com" defaultValue={initialData?.email || ''} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="admissionDate">Data de Admissão</Label>
                            <Input id="admissionDate" name="admissionDate" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="situationId">Situação Atual</Label>
                            <Select name="situationId" required>
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
                        <Select name="roleId" required defaultValue={initialData?.roleId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o cargo" />
                            </SelectTrigger>
                            <SelectContent>
                                {roles.map(r => (
                                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="text-sm font-semibold border-b pt-4 pb-1">Financeiro (Mensal)</div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="salary">Salário Base (R$)</Label>
                            <Input id="salary" name="salary" type="number" step="0.01" placeholder="0.00" />
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
                            <Label htmlFor="gratificacao">Gratificacao CCT (R$)</Label>
                            <Input id="gratificacao" name="gratificacao" type="number" step="0.01" defaultValue="0" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="outrosAdicionais">Outros Adicionais (R$)</Label>
                            <Input id="outrosAdicionais" name="outrosAdicionais" type="number" step="0.01" defaultValue="0" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="type">Tipo de Contrato</Label>
                        <Select name="type" required defaultValue="CLT">
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CLT">CLT (Efetivo)</SelectItem>
                                <SelectItem value="Reserva Técnica">Reserva Técnica</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="submit" className="w-full">Salvar</Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
