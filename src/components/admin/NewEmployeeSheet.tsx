"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Sparkles } from "lucide-react";
import { createEmployee, getWizardDropdowns } from "@/app/actions";
import { toast } from "sonner";
import { EmployeeOnvioWizard } from "./EmployeeOnvioWizard";

export interface NewEmployeeSheetProps {
    situations: { id: string, name: string }[];
    roles: { id: string, name: string }[];
    companies?: { id: string, name: string }[];
    postos?: any[];
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    initialData?: {
        name?: string;
        email?: string;
        cpf?: string;
        roleId?: string;
        companyId?: string;
        phone?: string;
        postoId?: string;
        postoName?: string;
    };
    onSuccess?: () => void;
}

export function NewEmployeeSheet({
    situations,
    roles,
    companies = [],
    postos = [],
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

    // Somente postos vagos (sem alocações ativas), ou o posto obrigatório inicial se vier de initialData
    const availablePostos = postos.filter(p => 
        (p.assignments && p.assignments.length === 0) || 
        p.id === initialData?.postoId
    );

    // States controlados para preenchimento automático a partir do Posto ou IA
    const [selectedPostoId, setSelectedPostoId] = useState(initialData?.postoId || "");
    const [salary, setSalary] = useState("0");
    const [insalubridade, setInsalubridade] = useState("0");
    const [periculosidade, setPericulosidade] = useState("0");
    const [gratificacao, setGratificacao] = useState("0");
    const [outrosAdicionais, setOutrosAdicionais] = useState("0");
    const [workload, setWorkload] = useState("220");
    const [roleId, setRoleId] = useState(initialData?.roleId || "");
    const [companyId, setCompanyId] = useState(initialData?.companyId || "");

    // States controlados de informações pessoais (preenchidos pela IA)
    const [name, setName] = useState(initialData?.name || "");
    const [cpf, setCpf] = useState(initialData?.cpf || "");
    const [birthDate, setBirthDate] = useState("");
    const [gender, setGender] = useState("");
    const [address, setAddress] = useState("");
    const [phone, setPhone] = useState(initialData?.phone || "");
    const [email, setEmail] = useState(initialData?.email || "");
    const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split('T')[0]);

    // Estado de carregamento da IA
    const [isExtracting, setIsExtracting] = useState(false);

    // States for custom dropdown options
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

    const handlePostoChange = (postoId: string) => {
        setSelectedPostoId(postoId);
        const posto = postos.find(p => p.id === postoId);
        if (posto) {
            setSalary(String(posto.baseSalary || 0));
            setInsalubridade(String(posto.insalubridade || 0));
            setPericulosidade(String(posto.periculosidade || 0));
            setGratificacao(String(posto.gratificacao || 0));
            setOutrosAdicionais(String(posto.outrosAdicionais || 0));
            setWorkload(String(posto.requiredWorkload || 220));
            setRoleId(posto.roleId || "");
            setCompanyId(posto.client?.companyId || "");
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsExtracting(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/extract-document", {
                method: "POST",
                body: formData
            });

            const result = await res.json();
            if (!result.success) {
                toast.error(result.error || "Ocorreu um erro ao extrair os dados.");
                return;
            }

            const data = result.data;
            if (data.name) setName(data.name);
            if (data.cpf) setCpf(data.cpf);
            if (data.birthDate) setBirthDate(data.birthDate);
            if (data.gender) setGender(data.gender);
            if (data.address) setAddress(data.address);
            if (data.phone) setPhone(data.phone);
            if (data.email) setEmail(data.email);

            toast.success("Dados cadastrais extraídos com sucesso via IA!");
        } catch (error: any) {
            toast.error("Erro ao conectar com o serviço de extração.");
        } finally {
            setIsExtracting(false);
            e.target.value = ""; // Limpar input
        }
    };

    useEffect(() => {
        if (open && initialData) {
            setName(initialData.name || "");
            setCpf(initialData.cpf || "");
            setPhone(initialData.phone || "");
            setEmail(initialData.email || "");
            setRoleId(initialData.roleId || "");
            setCompanyId(initialData.companyId || "");
            if (initialData.postoId) {
                handlePostoChange(initialData.postoId);
            }
        }
    }, [open]);

    const handleCancel = () => {
        setOpen(false);
        setSelectedPostoId("");
        setSalary("0");
        setInsalubridade("0");
        setPericulosidade("0");
        setGratificacao("0");
        setOutrosAdicionais("0");
        setWorkload("220");
        setRoleId("");
        setCompanyId("");
        setName("");
        setCpf("");
        setBirthDate("");
        setGender("");
        setAddress("");
        setPhone("");
        setEmail("");
        setAdmissionDate(new Date().toISOString().split('T')[0]);
    };

    async function handleSubmit(formData: FormData) {
        await createEmployee(formData);
        handleCancel();
        if (onSuccess) onSuccess();
    }

    const wizardData = {
        name,
        cpf,
        birthDate,
        gender,
        address,
        phone,
        email,
        roleId,
        companyId,
        postoId: selectedPostoId,
        salary,
        insalubridade,
        periculosidade,
        gratificacao,
        outrosAdicionais,
        workload,
        admissionDate
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            {!isControlled && (
                <SheetTrigger asChild>
                    <Button><Plus className="w-4 h-4 mr-2" /> Novo Colaborador</Button>
                </SheetTrigger>
            )}
            <SheetContent className="px-10 sm:max-w-5xl w-full">
                <SheetHeader>
                    <SheetTitle>Novo Colaborador</SheetTitle>
                    <SheetDescription>Cadastre um novo funcionário vinculando-o a um posto.</SheetDescription>
                    {initialData?.postoName && (
                        <div className="bg-blue-50 text-blue-700 p-3 rounded-md border border-blue-200 text-sm mt-2 flex items-center gap-2">
                            <span>
                                <strong>Vínculo Obrigatório:</strong> Será alocado em <u>{initialData.postoName}</u>
                            </span>
                        </div>
                    )}
                </SheetHeader>
                <form action={handleSubmit} className="space-y-4 mt-6 h-[80vh] overflow-y-auto pr-4">
                    {/* Área de Preenchimento Inteligente por IA */}
                    <div className="p-4 bg-orange-50/60 border border-dashed border-orange-200 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                        {isExtracting ? (
                            <div className="flex flex-col items-center gap-2 py-2">
                                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs font-bold text-orange-700">Analisando documento com IA...</span>
                            </div>
                        ) : (
                            <label className="cursor-pointer w-full flex flex-col items-center gap-1.5 py-1">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-orange-700">
                                    <Sparkles className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                                    Preenchimento Inteligente (IA)
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium">Anexe CNH, RG ou Comprovante de Residência (PDF ou imagem)</span>
                                <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </label>
                        )}
                    </div>

                    <EmployeeOnvioWizard
                        initialData={wizardData}
                        situations={situations}
                        roles={roles}
                        companies={companies}
                        postos={postos}
                        selectedPostoId={selectedPostoId}
                        setSelectedPostoId={handlePostoChange}
                        departments={departments}
                        costCenters={costCenters}
                        unions={unions}
                        jobFunctions={jobFunctions}
                    />

                    <div className="flex gap-2 pt-2 border-t mt-4">
                        <Button 
                            type="button" 
                            variant="outline"
                            onClick={() => {
                                const nameVal = (document.getElementById("name") as HTMLInputElement)?.value || name;
                                const cpfVal = (document.getElementById("cpf") as HTMLInputElement)?.value || cpf;
                                const phoneVal = (document.getElementById("phone") as HTMLInputElement)?.value || phone;
                                const emailVal = (document.getElementById("email") as HTMLInputElement)?.value || email;
                                
                                const roleSelect = document.querySelector('select[name="roleId"]') as HTMLSelectElement;
                                const roleVal = roles.find(r => r.id === roleSelect?.value)?.name || "";
                                
                                const companySelect = document.querySelector('select[name="companyId"]') as HTMLSelectElement;
                                const companyVal = companies.find(c => c.id === companySelect?.value)?.name || "";
                                
                                const admissionVal = (document.getElementById("admissionDate") as HTMLInputElement)?.value || admissionDate;
                                const birthVal = (document.getElementById("birthDate") as HTMLInputElement)?.value || birthDate;
                                
                                const genderSelect = document.querySelector('select[name="gender"]') as HTMLSelectElement;
                                const genderVal = genderSelect?.value || gender;
                                
                                const addressVal = (document.getElementById("address") as HTMLInputElement)?.value || address;
                                const salaryVal = (document.getElementById("salary") as HTMLInputElement)?.value || salary;

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
                        <Button type="submit" className="flex-1 h-10 rounded-xl">Salvar</Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
