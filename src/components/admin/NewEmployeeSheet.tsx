"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Sparkles } from "lucide-react";
import { createEmployee } from "@/app/actions";
import { toast } from "sonner";

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
        if (initialData) {
            if (initialData.name) setName(initialData.name);
            if (initialData.cpf) setCpf(initialData.cpf);
            if (initialData.phone) setPhone(initialData.phone);
            if (initialData.email) setEmail(initialData.email);
            if (initialData.roleId) setRoleId(initialData.roleId);
            if (initialData.companyId) setCompanyId(initialData.companyId);
            if (initialData.postoId) {
                handlePostoChange(initialData.postoId);
            }
        }
    }, [initialData, postos]);

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

                    <div className="space-y-2">
                        <Label htmlFor="postoId">Posto de Trabalho (Obrigatório)</Label>
                        <Select
                            name="postoId"
                            value={selectedPostoId}
                            onValueChange={handlePostoChange}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o posto..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[250px]">
                                {availablePostos.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.client?.name} - {p.role?.name} ({p.schedule || "N/A"}: {p.startTime || "00:00"}-{p.endTime || "00:00"})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="name">Nome Completo</Label>
                        <Input id="name" name="name" required value={name} onChange={e => setName(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="companyId">Empresa Vinculada</Label>
                        <Select name="companyId" value={companyId} onValueChange={setCompanyId}>
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
                            <Input id="cpf" name="cpf" placeholder="000.000.000-00" required value={cpf} onChange={e => setCpf(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="workload">Carga Horária Mensal</Label>
                            <Input id="workload" name="workload" type="number" value={workload} onChange={e => setWorkload(e.target.value)} required />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="birthDate">Data de Nascimento</Label>
                            <Input id="birthDate" name="birthDate" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gender">Gênero</Label>
                            <Select name="gender" value={gender} onValueChange={setGender}>
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
                        <Input id="address" name="address" placeholder="Rua, Número, Bairro, Cidade - UF" value={address} onChange={e => setAddress(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefone / Celular</Label>
                            <Input id="phone" name="phone" placeholder="(00) 00000-0000" value={phone} onChange={e => setPhone(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Pessoal</Label>
                            <Input id="email" name="email" type="email" placeholder="email@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="admissionDate">Data de Admissão</Label>
                            <Input id="admissionDate" name="admissionDate" type="date" required value={admissionDate} onChange={e => setAdmissionDate(e.target.value)} />
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
                        <Select name="roleId" required value={roleId} onValueChange={setRoleId}>
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
                            <Input id="salary" name="salary" type="number" step="0.01" value={salary} onChange={e => setSalary(e.target.value)} placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="insalubridade">Insalubridade (R$)</Label>
                            <Input id="insalubridade" name="insalubridade" type="number" step="0.01" value={insalubridade} onChange={e => setInsalubridade(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="periculosidade">Periculosidade (R$)</Label>
                            <Input id="periculosidade" name="periculosidade" type="number" step="0.01" value={periculosidade} onChange={e => setPericulosidade(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gratificacao">Gratificacao CCT (R$)</Label>
                            <Input id="gratificacao" name="gratificacao" type="number" step="0.01" value={gratificacao} onChange={e => setGratificacao(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="outrosAdicionais">Outros Adicionais (R$)</Label>
                            <Input id="outrosAdicionais" name="outrosAdicionais" type="number" step="0.01" value={outrosAdicionais} onChange={e => setOutrosAdicionais(e.target.value)} />
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
                    <div className="flex gap-2 pt-2">
                        <Button 
                            type="button" 
                            variant="outline"
                            onClick={() => {
                                const roleName = roles.find(r => r.id === roleId)?.name || "";
                                const event = new CustomEvent("workforceRpaCapture", {
                                    detail: {
                                        name: name,
                                        cpf: cpf,
                                        phone: phone,
                                        email: email,
                                        role: roleName,
                                        salary: salary,
                                        startDate: admissionDate ? new Date(admissionDate + 'T12:00:00').toLocaleDateString('pt-BR') : ""
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
