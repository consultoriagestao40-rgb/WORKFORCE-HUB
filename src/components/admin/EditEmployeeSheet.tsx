"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit } from "lucide-react";
import { updateEmployee, getWizardDropdowns } from "@/app/actions";
import { VacationHistory } from "./VacationHistory";
import { toast } from "sonner";
import { EmployeeOnvioWizard } from "./EmployeeOnvioWizard";

interface EditEmployeeSheetProps {
    employee: any;
    situations: { id: string, name: string }[];
    roles: { id: string, name: string }[];
    companies?: { id: string, name: string }[];
    postos?: any[];
}

export function EditEmployeeSheet({ employee, situations, roles, companies = [], postos = [] }: EditEmployeeSheetProps) {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState(employee.status);
    const [selectedPostoId, setSelectedPostoId] = useState(
        employee.assignments?.find((a: any) => !a.endDate)?.postoId || ""
    );
    const [departments, setDepartments] = useState<{ id: string, name: string }[]>([]);
    const [costCenters, setCostCenters] = useState<{ id: string, name: string }[]>([]);
    const [unions, setUnions] = useState<{ id: string, name: string }[]>([]);
    const [jobFunctions, setJobFunctions] = useState<{ id: string, name: string }[]>([]);

    useEffect(() => {
        if (open) {
            getWizardDropdowns().then(res => {
                setDepartments(res.departments);
                setCostCenters(res.costCenters);
                setUnions(res.unions);
                setJobFunctions(res.jobFunctions || []);
            });
        }
    }, [open]);

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

    const initialWizardData = {
        ...employee,
        postoId: selectedPostoId
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Edit className="w-4 h-4" />
                    Editar Perfil
                </Button>
            </SheetTrigger>
            <SheetContent className="px-8 sm:max-w-5xl w-full">
                <SheetHeader>
                    <SheetTitle>Editar Colaborador</SheetTitle>
                    <SheetDescription>Atualize os dados de {employee.name}.</SheetDescription>
                </SheetHeader>
                <form action={handleSubmit} className="space-y-4 mt-6 h-[85vh] overflow-y-auto pr-2 scrollbar-hide">
                    <input type="hidden" name="id" value={employee.id} />

                    <EmployeeOnvioWizard
                        initialData={initialWizardData}
                        situations={situations}
                        roles={roles}
                        companies={companies}
                        postos={postos}
                        selectedPostoId={selectedPostoId}
                        setSelectedPostoId={setSelectedPostoId}
                        departments={departments}
                        costCenters={costCenters}
                        unions={unions}
                        jobFunctions={jobFunctions}
                    />

                    {/* Férias / Histórico */}
                    <div className="pt-4 border-t mt-6">
                        <VacationHistory
                            employeeId={employee.id}
                            vacations={employee.vacations || []}
                            hasActivePosto={employee.assignments?.some((a: any) => !a.endDate && a.posto?.client?.name !== "ROTATIVO")}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
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

                    <div className="flex gap-2 pt-4 border-t">
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

                                const extraFieldsInput = document.querySelector('input[name="extraFields"]') as HTMLInputElement;
                                const extraFields = extraFieldsInput ? JSON.parse(extraFieldsInput.value) : {};

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
                                        address: addressVal,
                                        ...extraFields
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
