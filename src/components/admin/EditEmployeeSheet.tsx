"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    Edit, Plus, Trash2, Download, UploadCloud, FileText, CheckCircle2, 
    User, Briefcase, CreditCard, ShieldAlert, Users, Paperclip, ChevronDown,
    Pencil, X, Check
} from "lucide-react";
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

const compressImageIfNeeded = (file: File): Promise<File> => {
    return new Promise((resolve) => {
        if (!file.type.startsWith("image/")) {
            resolve(file);
            return;
        }
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;
                const maxDim = 1600;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const compressedFile = new File([blob], file.name, {
                                type: "image/jpeg",
                                lastModified: Date.now()
                            });
                            resolve(compressedFile.size < file.size ? compressedFile : file);
                        } else {
                            resolve(file);
                        }
                    }, "image/jpeg", 0.75);
                } else {
                    resolve(file);
                }
            };
            img.onerror = () => resolve(file);
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
};

export function EditEmployeeSheet({ employee, situations, roles, companies = [] }: EditEmployeeSheetProps) {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState(employee.status);
    const [situationId, setSituationId] = useState(employee.situationId || "");

    const extra = employee.extraFields || {};

    // Benefits specific states
    const [vtOptIn, setVtOptIn] = useState(employee.vtOptIn !== false);
    const [vtPaymentMethod, setVtPaymentMethod] = useState(employee.vtPaymentMethod || "Metrocard");
    const [vtOptions, setVtOptions] = useState<string[]>(["Metrocard", "Urbs", "PIX"]);
    const [isManagingVt, setIsManagingVt] = useState(false);
    const [newVtMethodName, setNewVtMethodName] = useState("");
    const [editingVtIndex, setEditingVtIndex] = useState<number | null>(null);
    const [editingVtValue, setEditingVtValue] = useState("");

    const [vtPaymentMethod2, setVtPaymentMethod2] = useState(employee.vtPaymentMethod2 || "Urbs");
    const [vtOptions2, setVtOptions2] = useState<string[]>(["Metrocard", "Urbs", "PIX"]);
    const [isManagingVt2, setIsManagingVt2] = useState(false);
    const [newVtMethodName2, setNewVtMethodName2] = useState("");
    const [editingVtIndex2, setEditingVtIndex2] = useState<number | null>(null);
    const [editingVtValue2, setEditingVtValue2] = useState("");

    useEffect(() => {
        const initialMethod = employee.vtPaymentMethod;
        if (initialMethod && !["Metrocard", "Urbs", "PIX"].includes(initialMethod)) {
            setVtOptions(prev => {
                if (prev.includes(initialMethod)) return prev;
                return [...prev, initialMethod];
            });
        }
    }, [employee.vtPaymentMethod]);

    useEffect(() => {
        const initialMethod2 = employee.vtPaymentMethod2;
        if (initialMethod2 && !["Metrocard", "Urbs", "PIX"].includes(initialMethod2)) {
            setVtOptions2(prev => {
                if (prev.includes(initialMethod2)) return prev;
                return [...prev, initialMethod2];
            });
        }
    }, [employee.vtPaymentMethod2]);

    const [vtCustomPaymentDetails, setVtCustomPaymentDetails] = useState(employee.vtCustomPaymentDetails || "");
    const [vtCustomPaymentDetails2, setVtCustomPaymentDetails2] = useState(employee.vtCustomPaymentDetails2 || "");
    const [vaPaymentMethod, setVaPaymentMethod] = useState(employee.vaPaymentMethod || "Cartão Caju");
    const [vaOptions, setVaOptions] = useState<string[]>(["Cartão Caju"]);
    const [isManagingVa, setIsManagingVa] = useState(false);
    const [newVaMethodName, setNewVaMethodName] = useState("");
    const [editingVaIndex, setEditingVaIndex] = useState<number | null>(null);
    const [editingVaValue, setEditingVaValue] = useState("");

    useEffect(() => {
        const initialMethod = employee.vaPaymentMethod;
        if (initialMethod && !["Cartão Caju"].includes(initialMethod)) {
            setVaOptions(prev => {
                if (prev.includes(initialMethod)) return prev;
                return [...prev, initialMethod];
            });
        }
    }, [employee.vaPaymentMethod]);

    const [vaCustomPaymentDetails, setVaCustomPaymentDetails] = useState(employee.vaCustomPaymentDetails || "");

    // Attachments & Dependents
    const [attachments, setAttachments] = useState<{ name: string; fileName: string; fileData: string }[]>(extra.attachments || []);
    const [dependents, setDependents] = useState<any[]>(extra.dependentes || []);

    // Extra Professional Fields
    const [nomeSocial, setNomeSocial] = useState(extra.nomeSocial || "");
    const [matricula, setMatricula] = useState(extra.matricula || "");
    const [funcao, setFuncao] = useState(extra.funcao || "");
    const [departamento, setDepartamento] = useState(extra.departamento || "");
    const [centroCusto, setCentroCusto] = useState(extra.centroCusto || "");
    const [sindicato, setSindicato] = useState(extra.sindicato || "");
    const [categoriaAdmissao, setCategoriaAdmissao] = useState(extra.categoriaAdmissao || "");
    const [vinculoEmpregaticio, setVinculoEmpregaticio] = useState(extra.vinculoEmpregaticio || "");
    const [experienciaDias1, setExperienciaDias1] = useState(extra.experienciaDias1 || "");
    const [experienciaDias2, setExperienciaDias2] = useState(extra.experienciaDias2 || "");
    const [escalaHorario, setEscalaHorario] = useState(extra.escalaHorario || "");
    const [jornadaHoras, setJornadaHoras] = useState(extra.jornadaHoras || "");

    // CTPS & PIS
    const [ctpsNumero, setCtpsNumero] = useState(extra.ctpsNumero || "");
    const [ctpsSerie, setCtpsSerie] = useState(extra.ctpsSerie || "");
    const [ctpsUf, setCtpsUf] = useState(extra.ctpsUf || "");
    const [ctpsDataEmissao, setCtpsDataEmissao] = useState(extra.ctpsDataEmissao || "");
    const [pisNumero, setPisNumero] = useState(extra.pisNumero || "");

    // FGTS
    const [fgtsOpcao, setFgtsOpcao] = useState(extra.fgtsOpcao || "");
    const [fgtsDataOpcao, setFgtsDataOpcao] = useState(extra.fgtsDataOpcao || "");
    const [fgtsBanco, setFgtsBanco] = useState(extra.fgtsBanco || "");

    // Conselho
    const [conselhoNome, setConselhoNome] = useState(extra.conselhoNome || "");
    const [conselhoNumero, setConselhoNumero] = useState(extra.conselhoNumero || "");
    const [conselhoUf, setConselhoUf] = useState(extra.conselhoUf || "");
    const [conselhoValidade, setConselhoValidade] = useState(extra.conselhoValidade || "");

    // Personal & Address
    const [estadoCivil, setEstadoCivil] = useState(extra.estadoCivil || "");
    const [grauInstrucao, setGrauInstrucao] = useState(extra.grauInstrucao || "");
    const [nomePai, setNomePai] = useState(extra.nomePai || "");
    const [nomeMae, setNomeMae] = useState(extra.nomeMae || "");
    const [nacionalidade, setNacionalidade] = useState(extra.nacionalidade || "");
    const [naturalidadeCidade, setNaturalidadeCidade] = useState(extra.naturalidadeCidade || "");
    const [naturalidadeUf, setNaturalidadeUf] = useState(extra.naturalidadeUf || "");

    // RG
    const [rgNumero, setRgNumero] = useState(extra.rgNumero || "");
    const [rgOrgaoEmissor, setRgOrgaoEmissor] = useState(extra.rgOrgaoEmissor || "");
    const [rgDataEmissao, setRgDataEmissao] = useState(extra.rgDataEmissao || "");
    const [rgUf, setRgUf] = useState(extra.rgUf || "");

    // CNH
    const [cnhNumero, setCnhNumero] = useState(extra.cnhNumero || "");
    const [cnhCategoria, setCnhCategoria] = useState(extra.cnhCategoria || "");
    const [cnhValidade, setCnhValidade] = useState(extra.cnhValidade || "");
    const [cnhUf, setCnhUf] = useState(extra.cnhUf || "");

    // Titulo
    const [tituloEleitorNumero, setTituloEleitorNumero] = useState(extra.tituloEleitorNumero || "");
    const [tituloEleitorZona, setTituloEleitorZona] = useState(extra.tituloEleitorZona || "");
    const [tituloEleitorSecao, setTituloEleitorSecao] = useState(extra.tituloEleitorSecao || "");
    const [tituloEleitorUf, setTituloEleitorUf] = useState(extra.tituloEleitorUf || "");

    // Reservista
    const [reservistaNumero, setReservistaNumero] = useState(extra.reservistaNumero || "");
    const [reservistaCategoria, setReservistaCategoria] = useState(extra.reservistaCategoria || "");

    // File attachments handlers
    const handleUploadAttachment = async (rawFile: File, label: string) => {
        try {
            const file = await compressImageIfNeeded(rawFile);
            if (file.size > 4.2 * 1024 * 1024) {
                toast.error("O arquivo excede o limite máximo de 4.2MB.");
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Data = reader.result as string;
                setAttachments(prev => {
                    const filtered = prev.filter(a => a.name !== label);
                    return [...filtered, { name: label, fileName: file.name, fileData: base64Data }];
                });
                toast.success(`Documento "${label}" carregado com sucesso!`);
            };
            reader.readAsDataURL(file);
        } catch (err: any) {
            toast.error("Erro ao carregar arquivo.");
        }
    };

    const handleDeleteAttachment = (label: string) => {
        setAttachments(prev => prev.filter(a => a.name !== label));
        toast.info(`Documento "${label}" removido.`);
    };

    const handleDownloadFile = (fileData: string, fileName: string) => {
        const link = document.createElement("a");
        link.href = fileData;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Dependents handlers
    const addDependent = () => {
        setDependents([
            ...dependents,
            { nome: "", cpf: "", dataNascimento: "", parentesco: "", salarioFamilia: "Não", irrf: "Não" }
        ]);
    };

    const updateDependent = (index: number, key: string, val: string) => {
        setDependents(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [key]: val };
            return copy;
        });
    };

    const removeDependent = (index: number) => {
        setDependents(prev => prev.filter((_, i) => i !== index));
    };

    async function handleSubmit(formData: FormData) {
        try {
            const result = await updateEmployee(formData);
            if (result?.error) {
                toast.error(result.error);
                return;
            }
            setOpen(false);
            toast.success("Dados atualizados com sucesso!");
            window.location.reload();
        } catch (error: any) {
            toast.error(error.message);
        }
    }

    // Pack extra fields to string hidden input
    const extraFieldsData = {
        nomeSocial,
        matricula,
        funcao,
        departamento,
        centroCusto,
        sindicato,
        categoriaAdmissao,
        vinculoEmpregaticio,
        experienciaDias1,
        experienciaDias2,
        escalaHorario,
        jornadaHoras,
        ctpsNumero,
        ctpsSerie,
        ctpsUf,
        ctpsDataEmissao,
        pisNumero,
        fgtsOpcao,
        fgtsDataOpcao,
        fgtsBanco,
        conselhoNome,
        conselhoNumero,
        conselhoUf,
        conselhoValidade,
        estadoCivil,
        grauInstrucao,
        nomePai,
        nomeMae,
        nacionalidade,
        naturalidadeCidade,
        naturalidadeUf,
        rgNumero,
        rgOrgaoEmissor,
        rgDataEmissao,
        rgUf,
        cnhNumero,
        cnhCategoria,
        cnhValidade,
        cnhUf,
        tituloEleitorNumero,
        tituloEleitorZona,
        tituloEleitorSecao,
        tituloEleitorUf,
        reservistaNumero,
        reservistaCategoria,
        dependentes: dependents,
        attachments
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-slate-900 text-white hover:bg-slate-800 font-bold border-none h-9 px-4 rounded-xl shadow-sm">
                    <Edit className="w-4 h-4" /> Editar Perfil
                </Button>
            </SheetTrigger>
            <SheetContent className="px-8 sm:max-w-2xl w-full flex flex-col p-0 overflow-hidden">
                <SheetHeader className="p-6 pb-4 border-b bg-slate-50/50">
                    <SheetTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <User className="w-5 h-5 text-orange-500" /> Editar Colaborador
                    </SheetTitle>
                    <SheetDescription className="text-xs">
                        Atualize todos os dados cadastrais, benefícios, dependentes e anexos de {employee.name}.
                    </SheetDescription>
                </SheetHeader>

                <form action={handleSubmit} className="flex-1 flex flex-col overflow-hidden text-xs">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Hidden Inputs for action */}
                    <input type="hidden" name="id" value={employee.id} />
                    <input type="hidden" name="status" value={status} />
                    <input type="hidden" name="vtOptIn" value={vtOptIn ? "true" : "false"} />
                    <input type="hidden" name="vtPaymentMethod" value={vtPaymentMethod} />
                    <input type="hidden" name="vtPaymentMethod2" value={vtPaymentMethod2} />
                    <input type="hidden" name="vtCustomPaymentDetails" value={vtCustomPaymentDetails} />
                    <input type="hidden" name="vtCustomPaymentDetails2" value={vtCustomPaymentDetails2} />
                    <input type="hidden" name="vaPaymentMethod" value={vaPaymentMethod} />
                    <input type="hidden" name="vaCustomPaymentDetails" value={vaCustomPaymentDetails} />
                    <input type="hidden" name="extraFields" value={JSON.stringify(extraFieldsData)} />

                    {/* SEÇÃO 1: DADOS CADASTRAIS BÁSICOS */}
                    <details className="group border border-slate-200 rounded-2xl p-4 bg-white shadow-sm open:shadow-md transition-all space-y-4" open>
                        <summary className="font-bold text-slate-800 cursor-pointer select-none flex items-center justify-between list-none">
                            <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-700">
                                <User className="w-4 h-4 text-orange-500" /> Dados Básicos & Identificação
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                        </summary>
                        <div className="pt-3 space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Nome Completo</Label>
                                    <Input name="name" defaultValue={employee.name} required className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Nome Social</Label>
                                    <Input value={nomeSocial} onChange={e => setNomeSocial(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">CPF</Label>
                                    <Input name="cpf" defaultValue={employee.cpf} required className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Data de Nascimento</Label>
                                    <Input
                                        name="birthDate"
                                        type="date"
                                        defaultValue={employee.birthDate ? new Date(employee.birthDate).toISOString().split('T')[0] : ""}
                                        className="h-9 rounded-xl border-slate-200"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Gênero</Label>
                                    <Select name="gender" defaultValue={employee.gender || undefined}>
                                        <SelectTrigger className="h-9 rounded-xl border-slate-200">
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
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Estado Civil</Label>
                                    <Select value={estadoCivil} onValueChange={setEstadoCivil}>
                                        <SelectTrigger className="h-9 rounded-xl border-slate-200">
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Solteiro(a)">Solteiro(a)</SelectItem>
                                            <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                                            <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                                            <SelectItem value="Viúvo(a)">Viúvo(a)</SelectItem>
                                            <SelectItem value="União Estável">União Estável</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Grau de Instrução</Label>
                                    <Input value={grauInstrucao} onChange={e => setGrauInstrucao(e.target.value)} placeholder="Ex: Ensino Médio Completo" className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Nacionalidade</Label>
                                    <Input value={nacionalidade} onChange={e => setNacionalidade(e.target.value)} placeholder="Ex: Brasileira" className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Cidade Natal</Label>
                                    <Input value={naturalidadeCidade} onChange={e => setNaturalidadeCidade(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">UF Natal</Label>
                                    <Input value={naturalidadeUf} onChange={e => setNaturalidadeUf(e.target.value)} placeholder="Ex: PR" maxLength={2} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Nome do Pai</Label>
                                    <Input value={nomePai} onChange={e => setNomePai(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Nome da Mãe</Label>
                                    <Input value={nomeMae} onChange={e => setNomeMae(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>
                        </div>
                    </details>

                    {/* SEÇÃO 2: CONTATO E ENDEREÇO */}
                    <details className="group border border-slate-200 rounded-2xl p-4 bg-white shadow-sm open:shadow-md transition-all space-y-4">
                        <summary className="font-bold text-slate-800 cursor-pointer select-none flex items-center justify-between list-none">
                            <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-700">
                                <Users className="w-4 h-4 text-orange-500" /> Endereço & Contatos
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                        </summary>
                        <div className="pt-3 space-y-3">
                            <div className="space-y-1">
                                <Label className="font-bold text-slate-700">Endereço Completo</Label>
                                <Input name="address" defaultValue={employee.address || ""} placeholder="Rua, Número, Bairro, Cidade - UF" className="h-9 rounded-xl border-slate-200" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Telefone / Celular</Label>
                                    <Input name="phone" defaultValue={employee.phone || ""} placeholder="(00) 00000-0000" className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Email Pessoal</Label>
                                    <Input name="email" type="email" defaultValue={employee.email || ""} placeholder="email@exemplo.com" className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>
                        </div>
                    </details>

                    {/* SEÇÃO 3: DADOS DE CONTRATO */}
                    <details className="group border border-slate-200 rounded-2xl p-4 bg-white shadow-sm open:shadow-md transition-all space-y-4">
                        <summary className="font-bold text-slate-800 cursor-pointer select-none flex items-center justify-between list-none">
                            <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-700">
                                <Briefcase className="w-4 h-4 text-orange-500" /> Contrato de Trabalho
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                        </summary>
                        <div className="pt-3 space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Matrícula</Label>
                                    <Input value={matricula} onChange={e => setMatricula(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Carga Horária (h)</Label>
                                    <Input name="workload" type="number" defaultValue={employee.workload} required className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Data de Admissão</Label>
                                    <Input
                                        name="admissionDate"
                                        type="date"
                                        defaultValue={employee.admissionDate ? new Date(employee.admissionDate).toISOString().split('T')[0] : ""}
                                        required
                                        className="h-9 rounded-xl border-slate-200"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Situação Atual</Label>
                                    <Select
                                        name="situationId"
                                        value={situationId || undefined}
                                        onValueChange={(val) => {
                                            setSituationId(val);
                                            const selectedSituation = situations.find(s => s.id === val);
                                            if (selectedSituation) {
                                                const name = selectedSituation.name.toLowerCase();
                                                if (name.includes("desligado") || name.includes("demitido")) {
                                                    setStatus("Desligado");
                                                } else if (name.includes("férias") || name.includes("ferias")) {
                                                    setStatus("Férias");
                                                } else if (name.includes("afastado")) {
                                                    setStatus("Afastado");
                                                } else {
                                                    setStatus("Ativo");
                                                }
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="h-9 rounded-xl border-slate-200">
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

                            <div className="space-y-1">
                                <Label className="font-bold text-slate-700">Tipo de Contrato</Label>
                                <Select name="type" defaultValue={employee.type}>
                                    <SelectTrigger className="h-9 rounded-xl border-slate-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CLT">CLT (Efetivo)</SelectItem>
                                        <SelectItem value="Reserva Técnica">Reserva Técnica</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label className="font-bold text-slate-700">Cargo</Label>
                                <Select name="roleId" defaultValue={employee.roleId} required>
                                    <SelectTrigger className="h-9 rounded-xl border-slate-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map(r => (
                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label className="font-bold text-slate-700">Empresa Vinculada</Label>
                                <Select name="companyId" defaultValue={employee.companyId || "no_company"}>
                                    <SelectTrigger className="h-9 rounded-xl border-slate-200">
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

                            {status === "Desligado" && (
                                <div className="bg-red-50 border border-red-100 rounded-lg p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <h4 className="text-sm font-semibold text-red-800">Detalhes do Desligamento</h4>
                                    <div className="space-y-2">
                                        <Label htmlFor="dismissalReason" className="text-red-700 font-bold">Motivo</Label>
                                        <Select name="dismissalReason" defaultValue={employee.dismissalReason || undefined}>
                                            <SelectTrigger className="bg-white border-red-200 h-9 rounded-xl">
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
                                        <Label htmlFor="dismissalNotes" className="text-red-700 font-bold">Relato do RH</Label>
                                        <Textarea
                                            id="dismissalNotes"
                                            name="dismissalNotes"
                                            defaultValue={employee.dismissalNotes || ""}
                                            placeholder="Descreva brevemente o motivo..."
                                            className="bg-white border-red-200 min-h-[80px]"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </details>

                    {/* SEÇÃO 4: FINANCEIRO & BENEFÍCIOS */}
                    <details className="group border border-slate-200 rounded-2xl p-4 bg-white shadow-sm open:shadow-md transition-all space-y-4">
                        <summary className="font-bold text-slate-800 cursor-pointer select-none flex items-center justify-between list-none">
                            <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-700">
                                <CreditCard className="w-4 h-4 text-orange-500" /> Salário & Benefícios
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                        </summary>
                        <div className="pt-3 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Salário Base (R$)</Label>
                                    <Input name="salary" type="number" step="0.01" defaultValue={employee.salary} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Insalubridade (R$)</Label>
                                    <Input name="insalubridade" type="number" step="0.01" defaultValue={employee.insalubridade} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Periculosidade (R$)</Label>
                                    <Input name="periculosidade" type="number" step="0.01" defaultValue={employee.periculosidade} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Gratificacao CCT (R$)</Label>
                                    <Input name="gratificacao" type="number" step="0.01" defaultValue={employee.gratificacao} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="font-bold text-slate-700">Outros Adicionais (R$)</Label>
                                <Input name="outrosAdicionais" type="number" step="0.01" defaultValue={employee.outrosAdicionais} className="h-9 rounded-xl border-slate-200" />
                            </div>

                            <div className="pt-2 border-t border-slate-100 font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-2">
                                Vale Alimentação & Transporte Mensal
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Valor VA (R$)</Label>
                                    <Input name="valeAlimentacao" type="number" step="0.01" defaultValue={employee.valeAlimentacao} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Valor VT 1 (R$)</Label>
                                    <Input name="valeTransporte" type="number" step="0.01" defaultValue={employee.valeTransporte} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Valor VT 2 (R$)</Label>
                                    <Input name="valeTransporte2" type="number" step="0.01" defaultValue={employee.valeTransporte2 || 0} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>

                            {/* OPÇÃO DE BENEFÍCIOS (VT/VA) */}
                            <div className="pt-2 border-t border-slate-100 font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                                Integração de Depósito de Benefícios
                            </div>
                            
                            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Optante VT?</Label>
                                    <Select value={vtOptIn ? "true" : "false"} onValueChange={v => setVtOptIn(v === "true")}>
                                        <SelectTrigger className="h-9 rounded-xl bg-white border-slate-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="true">Sim (Optante pelo VT)</SelectItem>
                                            <SelectItem value="false">Não (Não Optante pelo VT)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {vtOptIn && (
                                    <div className="space-y-2 pt-2 border-t border-dashed border-slate-200/80">
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <Label className="font-bold text-slate-700">Meio de Depósito do VT</Label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsManagingVt(!isManagingVt);
                                                        setEditingVtIndex(null);
                                                    }}
                                                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5 cursor-pointer"
                                                >
                                                    {isManagingVt ? "Fechar" : "Gerenciar"}
                                                </button>
                                            </div>

                                            {isManagingVt ? (
                                                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 mt-1">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Formas de VT Cadastradas</span>
                                                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                                        {vtOptions.map((opt, idx) => (
                                                            <div key={opt} className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-50 border border-slate-100">
                                                                {editingVtIndex === idx ? (
                                                                    <div className="flex items-center gap-1 w-full">
                                                                        <Input 
                                                                            value={editingVtValue}
                                                                            onChange={e => setEditingVtValue(e.target.value)}
                                                                            className="h-7 text-xs rounded bg-white w-full"
                                                                        />
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => {
                                                                                const trimmed = editingVtValue.trim();
                                                                                if (!trimmed) return;
                                                                                setVtOptions(prev => prev.map((o, i) => i === idx ? trimmed : o));
                                                                                if (vtPaymentMethod === opt) {
                                                                                    setVtPaymentMethod(trimmed);
                                                                                }
                                                                                setEditingVtIndex(null);
                                                                            }}
                                                                            className="text-emerald-600 hover:text-emerald-700"
                                                                        >
                                                                            <Check className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => setEditingVtIndex(null)}
                                                                            className="text-red-500 hover:text-red-650"
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <span className="text-xs text-slate-700 font-bold">{opt}</span>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={() => {
                                                                                    setEditingVtIndex(idx);
                                                                                    setEditingVtValue(opt);
                                                                                }}
                                                                                className="text-slate-400 hover:text-slate-600"
                                                                            >
                                                                                <Pencil className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={() => {
                                                                                    setVtOptions(prev => prev.filter((_, i) => i !== idx));
                                                                                    if (vtPaymentMethod === opt) {
                                                                                        const remaining = vtOptions.filter((_, i) => i !== idx);
                                                                                        setVtPaymentMethod(remaining[0] || "");
                                                                                    }
                                                                                }}
                                                                                className="text-red-400 hover:text-red-655"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                                        <Input 
                                                            value={newVtMethodName}
                                                            onChange={e => setNewVtMethodName(e.target.value)}
                                                            placeholder="Nova operadora de VT..."
                                                            className="h-8 rounded bg-white text-xs"
                                                        />
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            onClick={() => {
                                                                const name = newVtMethodName.trim();
                                                                if (!name) return;
                                                                if (vtOptions.includes(name)) {
                                                                    toast.error("Essa opção já existe.");
                                                                    return;
                                                                }
                                                                setVtOptions(prev => [...prev, name]);
                                                                setVtPaymentMethod(name);
                                                                setNewVtMethodName("");
                                                            }}
                                                            className="bg-orange-600 hover:bg-orange-700 text-white rounded h-8 text-xs px-2"
                                                        >
                                                            Add
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <Select value={vtPaymentMethod} onValueChange={setVtPaymentMethod}>
                                                    <SelectTrigger className="h-9 rounded-xl bg-white border-slate-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {vtOptions.map(opt => (
                                                            <SelectItem key={opt} value={opt}>
                                                                {opt === "PIX" ? "Depósito em PIX (Reserva)" : opt}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>

                                        <div className="space-y-1 pt-2 border-t border-dashed border-slate-200/80">
                                            <div className="flex items-center justify-between">
                                                <Label className="font-bold text-slate-700">Meio de Depósito do VT 2</Label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsManagingVt2(!isManagingVt2);
                                                        setEditingVtIndex2(null);
                                                    }}
                                                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5 cursor-pointer"
                                                >
                                                    {isManagingVt2 ? "Fechar" : "Gerenciar"}
                                                </button>
                                            </div>

                                            {isManagingVt2 ? (
                                                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 mt-1">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Formas de VT 2 Cadastradas</span>
                                                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                                        {vtOptions2.map((opt, idx) => (
                                                            <div key={opt} className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-50 border border-slate-100">
                                                                {editingVtIndex2 === idx ? (
                                                                    <div className="flex items-center gap-1 w-full">
                                                                        <Input 
                                                                            value={editingVtValue2}
                                                                            onChange={e => setEditingVtValue2(e.target.value)}
                                                                            className="h-7 text-xs rounded bg-white w-full"
                                                                        />
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => {
                                                                                const trimmed = editingVtValue2.trim();
                                                                                if (!trimmed) return;
                                                                                setVtOptions2(prev => prev.map((o, i) => i === idx ? trimmed : o));
                                                                                if (vtPaymentMethod2 === opt) {
                                                                                    setVtPaymentMethod2(trimmed);
                                                                                }
                                                                                setEditingVtIndex2(null);
                                                                            }}
                                                                            className="text-emerald-600 hover:text-emerald-700"
                                                                        >
                                                                            <Check className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => setEditingVtIndex2(null)}
                                                                            className="text-red-500 hover:text-red-655"
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <span className="text-xs text-slate-700 font-bold">{opt}</span>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={() => {
                                                                                    setEditingVtIndex2(idx);
                                                                                    setEditingVtValue2(opt);
                                                                                }}
                                                                                className="text-slate-400 hover:text-slate-600"
                                                                            >
                                                                                <Pencil className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={() => {
                                                                                    setVtOptions2(prev => prev.filter((_, i) => i !== idx));
                                                                                    if (vtPaymentMethod2 === opt) {
                                                                                        const remaining = vtOptions2.filter((_, i) => i !== idx);
                                                                                        setVtPaymentMethod2(remaining[0] || "");
                                                                                    }
                                                                                }}
                                                                                className="text-red-400 hover:text-red-655"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                                        <Input 
                                                            value={newVtMethodName2}
                                                            onChange={e => setNewVtMethodName2(e.target.value)}
                                                            placeholder="Nova operadora de VT..."
                                                            className="h-8 rounded bg-white text-xs"
                                                        />
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            onClick={() => {
                                                                const name = newVtMethodName2.trim();
                                                                if (!name) return;
                                                                if (vtOptions2.includes(name)) {
                                                                    toast.error("Essa opção já existe.");
                                                                    return;
                                                                }
                                                                setVtOptions2(prev => [...prev, name]);
                                                                setVtPaymentMethod2(name);
                                                                setNewVtMethodName2("");
                                                            }}
                                                            className="bg-orange-600 hover:bg-orange-700 text-white rounded h-8 text-xs px-2"
                                                        >
                                                            Add
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <Select value={vtPaymentMethod2} onValueChange={setVtPaymentMethod2}>
                                                    <SelectTrigger className="h-9 rounded-xl bg-white border-slate-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {vtOptions2.map(opt => (
                                                            <SelectItem key={opt} value={opt}>
                                                                {opt === "PIX" ? "Depósito em PIX (Reserva)" : opt}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <Label className="font-bold text-slate-700">Meio de Depósito do VA</Label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsManagingVa(!isManagingVa);
                                                setEditingVaIndex(null);
                                            }}
                                            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5 cursor-pointer"
                                        >
                                            {isManagingVa ? "Fechar" : "Gerenciar"}
                                        </button>
                                    </div>

                                    {isManagingVa ? (
                                        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 mt-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Formas de VA Cadastradas</span>
                                            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                                {vaOptions.map((opt, idx) => (
                                                    <div key={opt} className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-50 border border-slate-100">
                                                        {editingVaIndex === idx ? (
                                                            <div className="flex items-center gap-1 w-full">
                                                                <Input 
                                                                    value={editingVaValue}
                                                                    onChange={e => setEditingVaValue(e.target.value)}
                                                                    className="h-7 text-xs rounded bg-white w-full"
                                                                />
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => {
                                                                        const trimmed = editingVaValue.trim();
                                                                        if (!trimmed) return;
                                                                        setVaOptions(prev => prev.map((o, i) => i === idx ? trimmed : o));
                                                                        if (vaPaymentMethod === opt) {
                                                                            setVaPaymentMethod(trimmed);
                                                                        }
                                                                        setEditingVaIndex(null);
                                                                    }}
                                                                    className="text-emerald-600 hover:text-emerald-700"
                                                                >
                                                                    <Check className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => setEditingVaIndex(null)}
                                                                    className="text-red-500 hover:text-red-650"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <span className="text-xs text-slate-700 font-bold">{opt}</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => {
                                                                            setEditingVaIndex(idx);
                                                                            setEditingVaValue(opt);
                                                                        }}
                                                                        className="text-slate-400 hover:text-slate-600"
                                                                    >
                                                                        <Pencil className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => {
                                                                            setVaOptions(prev => prev.filter((_, i) => i !== idx));
                                                                            if (vaPaymentMethod === opt) {
                                                                                const remaining = vaOptions.filter((_, i) => i !== idx);
                                                                                setVaPaymentMethod(remaining[0] || "");
                                                                            }
                                                                        }}
                                                                        className="text-red-400 hover:text-red-650"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                                <Input 
                                                    value={newVaMethodName}
                                                    onChange={e => setNewVaMethodName(e.target.value)}
                                                    placeholder="Nova operadora de VA..."
                                                    className="h-8 rounded bg-white text-xs"
                                                />
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => {
                                                        const name = newVaMethodName.trim();
                                                        if (!name) return;
                                                        if (vaOptions.includes(name)) {
                                                            toast.error("Essa opção já existe.");
                                                            return;
                                                        }
                                                        setVaOptions(prev => [...prev, name]);
                                                        setVaPaymentMethod(name);
                                                        setNewVaMethodName("");
                                                    }}
                                                    className="bg-orange-650 hover:bg-orange-700 text-white rounded h-8 text-xs px-2"
                                                >
                                                    Add
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <Select value={vaPaymentMethod} onValueChange={setVaPaymentMethod}>
                                            <SelectTrigger className="h-9 rounded-xl bg-white border-slate-200">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {vaOptions.map(opt => (
                                                    <SelectItem key={opt} value={opt}>
                                                        {opt}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            </div>
                        </div>
                    </details>

                    {/* SEÇÃO 5: DADOS DE CONTROLE DE PONTO & AVANÇADOS ONVIO */}
                    <details className="group border border-slate-200 rounded-2xl p-4 bg-white shadow-sm open:shadow-md transition-all space-y-4">
                        <summary className="font-bold text-slate-800 cursor-pointer select-none flex items-center justify-between list-none">
                            <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-700">
                                <ShieldAlert className="w-4 h-4 text-orange-500" /> Informações Profissionais (Onvio/Thomson)
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                        </summary>
                        <div className="pt-3 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Função (Onvio)</Label>
                                    <Input value={funcao} onChange={e => setFuncao(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Departamento</Label>
                                    <Input value={departamento} onChange={e => setDepartamento(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Centro de Custo</Label>
                                    <Input value={centroCusto} onChange={e => setCentroCusto(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Sindicato</Label>
                                    <Input value={sindicato} onChange={e => setSindicato(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Categoria Admissão</Label>
                                    <Input value={categoriaAdmissao} onChange={e => setCategoriaAdmissao(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Vínculo Empregatício</Label>
                                    <Input value={vinculoEmpregaticio} onChange={e => setVinculoEmpregaticio(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Experiência (Dias 1)</Label>
                                    <Input value={experienciaDias1} onChange={e => setExperienciaDias1(e.target.value)} type="number" className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Experiência (Dias 2)</Label>
                                    <Input value={experienciaDias2} onChange={e => setExperienciaDias2(e.target.value)} type="number" className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Escala de Horário</Label>
                                    <Input value={escalaHorario} onChange={e => setEscalaHorario(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Jornada de Horas</Label>
                                    <Input value={jornadaHoras} onChange={e => setJornadaHoras(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                                Documentos Profissionais (CTPS / PIS)
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">CTPS Número</Label>
                                    <Input value={ctpsNumero} onChange={e => setCtpsNumero(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">CTPS Série</Label>
                                    <Input value={ctpsSerie} onChange={e => setCtpsSerie(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">CTPS UF</Label>
                                    <Input value={ctpsUf} onChange={e => setCtpsUf(e.target.value)} maxLength={2} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">CTPS Data Emissão</Label>
                                    <Input value={ctpsDataEmissao} onChange={e => setCtpsDataEmissao(e.target.value)} type="date" className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="font-bold text-slate-700">Número do PIS</Label>
                                <Input value={pisNumero} onChange={e => setPisNumero(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                            </div>

                            <div className="pt-2 border-t border-slate-100 font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                                FGTS & Conta Vinculada
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">FGTS Opção</Label>
                                    <Input value={fgtsOpcao} onChange={e => setFgtsOpcao(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">FGTS Data Opção</Label>
                                    <Input value={fgtsDataOpcao} onChange={e => setFgtsDataOpcao(e.target.value)} type="date" className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="font-bold text-slate-700">FGTS Banco Depositário</Label>
                                <Input value={fgtsBanco} onChange={e => setFgtsBanco(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                            </div>

                            <div className="pt-2 border-t border-slate-100 font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                                Conselhos de Classe (CRM/COREN/etc.)
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Conselho Nome</Label>
                                    <Input value={conselhoNome} onChange={e => setConselhoNome(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Conselho Número</Label>
                                    <Input value={conselhoNumero} onChange={e => setConselhoNumero(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Conselho UF</Label>
                                    <Input value={conselhoUf} onChange={e => setConselhoUf(e.target.value)} maxLength={2} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Conselho Validade</Label>
                                    <Input value={conselhoValidade} onChange={e => setConselhoValidade(e.target.value)} type="date" className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>
                        </div>
                    </details>

                    {/* SEÇÃO 6: OUTROS DOCUMENTOS PESSOAIS */}
                    <details className="group border border-slate-200 rounded-2xl p-4 bg-white shadow-sm open:shadow-md transition-all space-y-4">
                        <summary className="font-bold text-slate-800 cursor-pointer select-none flex items-center justify-between list-none">
                            <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-700">
                                <FileText className="w-4 h-4 text-orange-500" /> Documentos de Identificação (RG/CNH/Eleitor)
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                        </summary>
                        <div className="pt-3 space-y-4">
                            <div className="pt-1 font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                                Registro Geral (RG)
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">RG Número</Label>
                                    <Input value={rgNumero} onChange={e => setRgNumero(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">RG Órgão Emissor</Label>
                                    <Input value={rgOrgaoEmissor} onChange={e => setRgOrgaoEmissor(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">RG Data Emissão</Label>
                                    <Input value={rgDataEmissao} onChange={e => setRgDataEmissao(e.target.value)} type="date" className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">RG UF</Label>
                                    <Input value={rgUf} onChange={e => setRgUf(e.target.value)} maxLength={2} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                                Carteira Nacional de Habilitação (CNH)
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">CNH Número</Label>
                                    <Input value={cnhNumero} onChange={e => setCnhNumero(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">CNH Categoria</Label>
                                    <Input value={cnhCategoria} onChange={e => setCnhCategoria(e.target.value)} placeholder="Ex: AB" className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">CNH Validade</Label>
                                    <Input value={cnhValidade} onChange={e => setCnhValidade(e.target.value)} type="date" className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">CNH UF</Label>
                                    <Input value={cnhUf} onChange={e => setCnhUf(e.target.value)} maxLength={2} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                                Título de Eleitor & Reservista (Se aplicável)
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Título Eleitor Número</Label>
                                    <Input value={tituloEleitorNumero} onChange={e => setTituloEleitorNumero(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Título Eleitor Zona</Label>
                                    <Input value={tituloEleitorZona} onChange={e => setTituloEleitorZona(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Título Eleitor Seção</Label>
                                    <Input value={tituloEleitorSecao} onChange={e => setTituloEleitorSecao(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Título Eleitor UF</Label>
                                    <Input value={tituloEleitorUf} onChange={e => setTituloEleitorUf(e.target.value)} maxLength={2} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Certificado Reservista</Label>
                                    <Input value={reservistaNumero} onChange={e => setReservistaNumero(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Categoria Reservista</Label>
                                    <Input value={reservistaCategoria} onChange={e => setReservistaCategoria(e.target.value)} className="h-9 rounded-xl border-slate-200" />
                                </div>
                            </div>
                        </div>
                    </details>

                    {/* SEÇÃO 7: DEPENDENTES */}
                    <details className="group border border-slate-200 rounded-2xl p-4 bg-white shadow-sm open:shadow-md transition-all space-y-4">
                        <summary className="font-bold text-slate-800 cursor-pointer select-none flex items-center justify-between list-none">
                            <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-700">
                                <Users className="w-4 h-4 text-orange-500" /> Dependentes ({dependents.length})
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                        </summary>
                        <div className="pt-3 space-y-4">
                            {dependents.length === 0 ? (
                                <div className="text-center py-4 bg-slate-50 text-slate-400 font-bold border border-dashed rounded-xl">
                                    Nenhum dependente cadastrado.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {dependents.map((dep, idx) => (
                                        <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3 relative group">
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="sm"
                                                onClick={() => removeDependent(idx)}
                                                className="absolute top-2 right-2 text-rose-500 hover:text-rose-700 h-7 w-7 p-0 rounded-lg hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="font-bold text-slate-700">Nome do Dependente</Label>
                                                    <Input 
                                                        value={dep.nome || ""} 
                                                        onChange={e => updateDependent(idx, "nome", e.target.value)} 
                                                        className="h-8 rounded-lg bg-white border-slate-200 text-xs" 
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="font-bold text-slate-700">Parentesco / Relação</Label>
                                                    <Input 
                                                        value={dep.parentesco || ""} 
                                                        onChange={e => updateDependent(idx, "parentesco", e.target.value)} 
                                                        className="h-8 rounded-lg bg-white border-slate-200 text-xs" 
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="font-bold text-slate-700">CPF do Dependente</Label>
                                                    <Input 
                                                        value={dep.cpf || ""} 
                                                        onChange={e => updateDependent(idx, "cpf", e.target.value)} 
                                                        className="h-8 rounded-lg bg-white border-slate-200 text-xs" 
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="font-bold text-slate-700">Data de Nascimento</Label>
                                                    <Input 
                                                        type="date"
                                                        value={dep.dataNascimento || ""} 
                                                        onChange={e => updateDependent(idx, "dataNascimento", e.target.value)} 
                                                        className="h-8 rounded-lg bg-white border-slate-200 text-xs" 
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="font-bold text-slate-700">Salário Família?</Label>
                                                    <Select value={dep.salarioFamilia || "Não"} onValueChange={v => updateDependent(idx, "salarioFamilia", v)}>
                                                        <SelectTrigger className="h-8 rounded-lg bg-white border-slate-200 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Sim">Sim</SelectItem>
                                                            <SelectItem value="Não">Não</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="font-bold text-slate-700">Dependente IRRF?</Label>
                                                    <Select value={dep.irrf || "Não"} onValueChange={v => updateDependent(idx, "irrf", v)}>
                                                        <SelectTrigger className="h-8 rounded-lg bg-white border-slate-200 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Sim">Sim</SelectItem>
                                                            <SelectItem value="Não">Não</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={addDependent}
                                className="w-full h-9 rounded-xl border-dashed border-slate-300 text-slate-600 gap-1.5 font-bold hover:bg-slate-50"
                            >
                                <Plus className="w-4 h-4" /> Adicionar Dependente
                            </Button>
                        </div>
                    </details>

                    {/* SEÇÃO 8: DOCUMENTOS ANEXADOS (ARQUIVOS) */}
                    <details className="group border border-slate-200 rounded-2xl p-4 bg-white shadow-sm open:shadow-md transition-all space-y-4">
                        <summary className="font-bold text-slate-800 cursor-pointer select-none flex items-center justify-between list-none">
                            <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-700">
                                <Paperclip className="w-4 h-4 text-orange-500" /> Documentos Anexados ({attachments.length})
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                        </summary>
                        <div className="pt-3 space-y-4">
                            {attachments.length === 0 ? (
                                <div className="text-center py-4 bg-slate-50 text-slate-400 font-bold border border-dashed rounded-xl">
                                    Nenhum arquivo anexado.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {attachments.map((doc, idx) => (
                                        <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2.5 overflow-hidden">
                                                <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                                                <div className="text-left overflow-hidden">
                                                    <div className="font-black text-slate-800 truncate">{doc.name}</div>
                                                    <div className="text-[9px] text-slate-400 truncate">{doc.fileName}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => handleDownloadFile(doc.fileData, doc.fileName)}
                                                    className="h-8 w-8 p-0 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                                                    title="Baixar arquivo"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => handleDeleteAttachment(doc.name)}
                                                    className="h-8 w-8 p-0 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                                    title="Remover arquivo"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Uploader de Novos Documentos */}
                            <div className="pt-2 border-t border-slate-100 space-y-2">
                                <Label className="font-bold text-slate-700">Subir Novo Documento</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        "RG", 
                                        "Comprovante de Residência", 
                                        "CNH", 
                                        "CTPS", 
                                        "PIS", 
                                        "Outro Documento"
                                    ].map((slotName, i) => (
                                        <div key={i} className="relative bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-xl p-2 flex items-center justify-between text-[11px] gap-2 font-bold cursor-pointer group">
                                            <span className="truncate text-slate-600">{slotName}</span>
                                            <UploadCloud className="w-4 h-4 text-slate-400 group-hover:text-orange-500 shrink-0" />
                                            <input 
                                                type="file" 
                                                onChange={e => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleUploadAttachment(file, slotName);
                                                }}
                                                className="absolute inset-0 opacity-0 cursor-pointer" 
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </details>

                    {/* FÉRIAS (HISTÓRICO INTEGRADO) */}
                    <details className="group border border-slate-200 rounded-2xl p-4 bg-white shadow-sm open:shadow-md transition-all space-y-4">
                        <summary className="font-bold text-slate-800 cursor-pointer select-none flex items-center justify-between list-none">
                            <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-700">
                                <ChevronDown className="w-4 h-4 text-orange-500" /> Histórico de Férias CLT
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                        </summary>
                        <div className="pt-3">
                            <VacationHistory
                                employeeId={employee.id}
                                vacations={employee.vacations || []}
                                hasActivePosto={employee.assignments?.some((a: any) => !a.endDate && a.posto?.client?.name !== "ROTATIVO")}
                            />
                        </div>
                    </details>

                    </div>

                    {/* Actions Block */}
                    <div className="p-6 border-t border-slate-100 bg-white flex gap-2 shrink-0 shadow-[0_-8px_20px_-8px_rgba(0,0,0,0.08)]">
                        <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-10 rounded-xl">Salvar Alterações</Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
