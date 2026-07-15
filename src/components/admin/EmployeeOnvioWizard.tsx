"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronRight, ChevronLeft } from "lucide-react";
import { addDepartment, addCostCenter, addUnion } from "@/app/actions";

interface EmployeeOnvioWizardProps {
    initialData?: any;
    situations: { id: string; name: string }[];
    roles: { id: string; name: string }[];
    companies: { id: string; name: string }[];
    postos?: any[];
    onPostoChange?: (postoId: string) => void;
    selectedPostoId?: string;
    setSelectedPostoId?: (postoId: string) => void;
    departments?: { id: string; name: string }[];
    costCenters?: { id: string; name: string }[];
    unions?: { id: string; name: string }[];
}

const steps = [
    { number: 1, label: "Geral" },
    { number: 2, label: "Profissional" },
    { number: 3, label: "Pessoal" },
    { number: 4, label: "Documentos" },
    { number: 5, label: "Dependentes" },
    { number: 6, label: "Observações" }
];

const wizardTabs = [
    { step: 1, tab: "dados_basicos", label: "Dados Básicos" },
    { step: 1, tab: "admissao", label: "Admissão" },
    { step: 1, tab: "experiencia", label: "Contrato de Experiência" },
    { step: 1, tab: "horario", label: "Horário" },
    
    { step: 2, tab: "ctps", label: "Carteira de Trabalho" },
    { step: 2, tab: "fgts", label: "FGTS" },
    { step: 2, tab: "conselhos", label: "Conselhos" },
    
    { step: 3, tab: "dados_pessoais", label: "Dados Pessoais" },
    { step: 3, tab: "endereco", label: "Endereço e Contato" },
    
    { step: 4, tab: "rg", label: "RG" },
    { step: 4, tab: "cnh", label: "CNH" },
    { step: 4, tab: "titulo", label: "Título & Reservista" },
    
    { step: 5, tab: "dependentes", label: "Dependentes" },
    
    { step: 6, tab: "observacoes", label: "Observações" }
];

export function EmployeeOnvioWizard({
    initialData,
    situations,
    roles,
    companies,
    postos = [],
    onPostoChange,
    selectedPostoId: controlledPostoId,
    setSelectedPostoId: setControlledPostoId,
    departments = [],
    costCenters = [],
    unions = []
}: EmployeeOnvioWizardProps) {
    const [currentTabIdx, setCurrentTabIdx] = useState(0);

    // --- STATES PARA CAMPOS PADRÃO (Employee Columns) ---
    const [name, setName] = useState("");
    const [cpf, setCpf] = useState("");
    const [roleId, setRoleId] = useState("");
    const [companyId, setCompanyId] = useState("");
    const [type, setType] = useState("CLT");
    const [status, setStatus] = useState("Ativo");
    const [situationId, setSituationId] = useState("");
    const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split("T")[0]);
    const [salary, setSalary] = useState("0");
    const [insalubridade, setInsalubridade] = useState("0");
    const [periculosidade, setPericulosidade] = useState("0");
    const [gratificacao, setGratificacao] = useState("0");
    const [outrosAdicionais, setOutrosAdicionais] = useState("0");
    const [workload, setWorkload] = useState("220");
    const [valeAlimentacao, setValeAlimentacao] = useState("0");
    const [valeTransporte, setValeTransporte] = useState("0");
    const [birthDate, setBirthDate] = useState("");
    const [gender, setGender] = useState("");
    const [address, setAddress] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [postoId, setPostoId] = useState("");

    // --- STATES PARA CAMPOS EXTRAS (JSON extraFields) ---
    const [nomeSocial, setNomeSocial] = useState("");
    const [matricula, setMatrícula] = useState("");
    const [funcao, setFuncao] = useState("");
    
    // Dynamic Dropdown Lists
    const [localDepartments, setLocalDepartments] = useState<{ id: string; name: string }[]>(departments);
    const [localCostCenters, setLocalCostCenters] = useState<{ id: string; name: string }[]>(costCenters);
    const [localUnions, setLocalUnions] = useState<{ id: string; name: string }[]>(unions);

    // Dropdown value states (with defaults)
    const [departamento, setDepartamento] = useState("Geral");
    const [centroCusto, setCentroCusto] = useState("Geral");
    const [sindicato, setSindicato] = useState("SIEMACO");
    
    const [categoriaAdmissao, setCategoriaAdmissao] = useState("Mensalista");
    const [vinculoEmpregaticio, setVinculoEmpregaticio] = useState("Celetista");
    const [experienciaDias1, setExperienciaDias1] = useState("45");
    const [experienciaDias2, setExperienciaDias2] = useState("45");
    const [escalaHorario, setEscalaHorario] = useState("");
    const [jornadaHoras, setJornadaHoras] = useState("");

    const [ctpsNumero, setCtpsNumero] = useState("");
    const [ctpsSerie, setCtpsSerie] = useState("");
    const [ctpsUf, setCtpsUf] = useState("");
    const [ctpsDataEmissao, setCtpsDataEmissao] = useState("");
    const [pisNumero, setPisNumero] = useState("");
    
    const [fgtsOpcao, setFgtsOpcao] = useState("Sim");
    const [fgtsDataOpcao, setFgtsDataOpcao] = useState("");
    const [fgtsBanco, setFgtsBanco] = useState("");
    
    const [conselhoNome, setConselhoNome] = useState("");
    const [conselhoNumero, setConselhoNumero] = useState("");
    const [conselhoUf, setConselhoUf] = useState("");
    const [conselhoValidade, setConselhoValidade] = useState("");

    const [estadoCivil, setEstadoCivil] = useState("");
    const [grauInstrucao, setGrauInstrucao] = useState("");
    const [nomePai, setNomePai] = useState("");
    const [nomeMae, setNomeMae] = useState("");
    const [nacionalidade, setNacionalidade] = useState("Brasileira");
    const [naturalidadeCidade, setNaturalidadeCidade] = useState("");
    const [naturalidadeUf, setNaturalidadeUf] = useState("");

    const [rgNumero, setRgNumero] = useState("");
    const [rgOrgaoEmissor, setRgOrgaoEmissor] = useState("");
    const [rgDataEmissao, setRgDataEmissao] = useState("");
    const [rgUf, setRgUf] = useState("");

    const [cnhNumero, setCnhNumero] = useState("");
    const [cnhCategoria, setCnhCategoria] = useState("");
    const [cnhValidade, setCnhValidade] = useState("");
    const [cnhUf, setCnhUf] = useState("");

    const [tituloEleitorNumero, setTituloEleitorNumero] = useState("");
    const [tituloEleitorZona, setTituloEleitorZona] = useState("");
    const [tituloEleitorSecao, setTituloEleitorSecao] = useState("");
    const [tituloEleitorUf, setTituloEleitorUf] = useState("");

    const [reservistaNumero, setReservistaNumero] = useState("");
    const [reservistaCategoria, setReservistaCategoria] = useState("");

    const [dependentes, setDependentes] = useState<any[]>([]);
    const [observacoes, setObservacoes] = useState("");

    // Synchronize parent lists
    useEffect(() => {
        if (departments && departments.length > 0) setLocalDepartments(departments);
    }, [departments]);
    useEffect(() => {
        if (costCenters && costCenters.length > 0) setLocalCostCenters(costCenters);
    }, [costCenters]);
    useEffect(() => {
        if (unions && unions.length > 0) setLocalUnions(unions);
    }, [unions]);

    // Synchronize controlled and internal state for Posto
    const currentPostoId = controlledPostoId !== undefined ? controlledPostoId : postoId;
    
    // RULE: Prefill companyId (Serviço) based on currentPostoId
    useEffect(() => {
        if (currentPostoId) {
            const selectedPosto = postos.find(p => p.id === currentPostoId);
            if (selectedPosto && selectedPosto.client?.companyId) {
                setCompanyId(selectedPosto.client.companyId);
            }
        }
    }, [currentPostoId, postos]);

    // Sync type based on vinculoEmpregaticio (Onvio Vínculo -> legacy Tipo de Contrato)
    useEffect(() => {
        if (vinculoEmpregaticio === "Celetista") {
            setType("CLT");
        } else {
            setType(vinculoEmpregaticio);
        }
    }, [vinculoEmpregaticio]);

    const handlePostoChangeInternal = (val: string) => {
        if (setControlledPostoId) {
            setControlledPostoId(val);
        } else {
            setPostoId(val);
        }
        if (onPostoChange) {
            onPostoChange(val);
        }

        // Auto-fill values from selected Posto
        const selectedPosto = postos.find(p => p.id === val);
        if (selectedPosto) {
            setSalary(String(selectedPosto.baseSalary || 0));
            setInsalubridade(String(selectedPosto.insalubridade || 0));
            setPericulosidade(String(selectedPosto.periculosidade || 0));
            setGratificacao(String(selectedPosto.gratificacao || 0));
            setOutrosAdicionais(String(selectedPosto.outrosAdicionais || 0));
            setWorkload(String(selectedPosto.requiredWorkload || 220));
            setRoleId(selectedPosto.roleId || "");
            
            // Set Schedule details in Horário tab too
            const scaleStr = selectedPosto.schedule || "";
            const hoursStr = `${selectedPosto.startTime || "00:00"} - ${selectedPosto.endTime || "00:00"}`;
            setEscalaHorario(scaleStr);
            setJornadaHoras(hoursStr);
        }
    };

    // Populate data when initialData changes
    useEffect(() => {
        if (initialData) {
            setName(initialData.name || "");
            setCpf(initialData.cpf || "");
            setRoleId(initialData.roleId || "");
            setCompanyId(initialData.companyId || "");
            setType(initialData.type || "CLT");
            setStatus(initialData.status || "Ativo");
            setSituationId(initialData.situationId || "");
            if (initialData.admissionDate) {
                setAdmissionDate(new Date(initialData.admissionDate).toISOString().split("T")[0]);
            }
            setSalary(String(initialData.salary || 0));
            setInsalubridade(String(initialData.insalubridade || 0));
            setPericulosidade(String(initialData.periculosidade || 0));
            setGratificacao(String(initialData.gratificacao || 0));
            setOutrosAdicionais(String(initialData.outrosAdicionais || 0));
            setWorkload(String(initialData.workload || 220));
            setValeAlimentacao(String(initialData.valeAlimentacao || 0));
            setValeTransporte(String(initialData.valeTransporte || 0));
            
            if (initialData.birthDate) {
                setBirthDate(new Date(initialData.birthDate).toISOString().split("T")[0]);
            }
            setGender(initialData.gender || "");
            setAddress(initialData.address || "");
            setPhone(initialData.phone || "");
            setEmail(initialData.email || "");

            // Get Posto link from assignments
            if (initialData.assignments && initialData.assignments.length > 0) {
                const active = initialData.assignments.find((a: any) => !a.endDate);
                if (active) {
                    setPostoId(active.postoId);
                }
            } else if (initialData.postoId) {
                setPostoId(initialData.postoId);
            }

            // Load extraFields from JSON
            const extra = initialData.extraFields || {};
            setNomeSocial(extra.nomeSocial || "");
            setMatrícula(extra.matricula || "");
            setFuncao(extra.funcao || "");
            
            setDepartamento(extra.departamento || "Geral");
            setCentroCusto(extra.centroCusto || "Geral");
            setSindicato(extra.sindicato || "SIEMACO");
            
            setCategoriaAdmissao(extra.categoriaAdmissao || "Mensalista");
            const resolvedVinculo = extra.vinculoEmpregaticio || 
                ((initialData.type === "CLT" || initialData.type === "Celetista") ? "Celetista" : (initialData.type || "Celetista"));
            setVinculoEmpregaticio(resolvedVinculo);
            setExperienciaDias1(extra.experienciaDias1 || "45");
            setExperienciaDias2(extra.experienciaDias2 || "45");
            setEscalaHorario(extra.escalaHorario || "");
            setJornadaHoras(extra.jornadaHoras || "");

            setCtpsNumero(extra.ctpsNumero || "");
            setCtpsSerie(extra.ctpsSerie || "");
            setCtpsUf(extra.ctpsUf || "");
            setCtpsDataEmissao(extra.ctpsDataEmissao || "");
            setPisNumero(extra.pisNumero || "");

            setFgtsOpcao(extra.fgtsOpcao || "Sim");
            setFgtsDataOpcao(extra.fgtsDataOpcao || "");
            setFgtsBanco(extra.fgtsBanco || "");

            setConselhoNome(extra.conselhoNome || "");
            setConselhoNumero(extra.conselhoNumero || "");
            setConselhoUf(extra.conselhoUf || "");
            setConselhoValidade(extra.conselhoValidade || "");

            setEstadoCivil(extra.estadoCivil || "");
            setGrauInstrucao(extra.grauInstrucao || "");
            setNomePai(extra.nomePai || "");
            setNomeMae(extra.nomeMae || "");
            setNacionalidade(extra.nacionalidade || "Brasileira");
            setNaturalidadeCidade(extra.naturalidadeCidade || "");
            setNaturalidadeUf(extra.naturalidadeUf || "");

            setRgNumero(extra.rgNumero || "");
            setRgOrgaoEmissor(extra.rgOrgaoEmissor || "");
            setRgDataEmissao(extra.rgDataEmissao || "");
            setRgUf(extra.rgUf || "");

            setCnhNumero(extra.cnhNumero || "");
            setCnhCategoria(extra.cnhCategoria || "");
            setCnhValidade(extra.cnhValidade || "");
            setCnhUf(extra.cnhUf || "");

            setTituloEleitorNumero(extra.tituloEleitorNumero || "");
            setTituloEleitorZona(extra.tituloEleitorZona || "");
            setTituloEleitorSecao(extra.tituloEleitorSecao || "");
            setTituloEleitorUf(extra.tituloEleitorUf || "");

            setReservistaNumero(extra.reservistaNumero || "");
            setReservistaCategoria(extra.reservistaCategoria || "");

            setDependentes(extra.dependentes || []);
            setObservacoes(extra.observacoes || "");
        }
    }, [initialData]);

    const activeTabObj = wizardTabs[currentTabIdx];
    const currentStep = activeTabObj.step;
    const currentTab = activeTabObj.tab;

    // Filter tabs for the active step
    const currentStepTabs = wizardTabs.filter(t => t.step === currentStep);

    const handleNext = () => {
        if (currentTabIdx < wizardTabs.length - 1) {
            setCurrentTabIdx(currentTabIdx + 1);
        }
    };

    const handleBack = () => {
        if (currentTabIdx > 0) {
            setCurrentTabIdx(currentTabIdx - 1);
        }
    };

    // Dynamic additions (+) click handlers
    const handleAddDepartment = async () => {
        const name = window.prompt("Digite o nome do novo Departamento:");
        if (!name || name.trim() === "") return;
        try {
            const newDept = await addDepartment(name.trim());
            setLocalDepartments(prev => {
                if (prev.some(d => d.id === newDept.id)) return prev;
                return [...prev, newDept].sort((a,b) => a.name.localeCompare(b.name));
            });
            setDepartamento(newDept.name);
        } catch (e) {
            alert("Erro ao adicionar departamento.");
        }
    };

    const handleAddCostCenter = async () => {
        const name = window.prompt("Digite o nome do novo Centro de Custo:");
        if (!name || name.trim() === "") return;
        try {
            const newCC = await addCostCenter(name.trim());
            setLocalCostCenters(prev => {
                if (prev.some(c => c.id === newCC.id)) return prev;
                return [...prev, newCC].sort((a,b) => a.name.localeCompare(b.name));
            });
            setCentroCusto(newCC.name);
        } catch (e) {
            alert("Erro ao adicionar centro de custo.");
        }
    };

    const handleAddUnion = async () => {
        const name = window.prompt("Digite o nome do novo Sindicato:");
        if (!name || name.trim() === "") return;
        try {
            const newUnion = await addUnion(name.trim());
            setLocalUnions(prev => {
                if (prev.some(u => u.id === newUnion.id)) return prev;
                return [...prev, newUnion].sort((a,b) => a.name.localeCompare(b.name));
            });
            setSindicato(newUnion.name);
        } catch (e) {
            alert("Erro ao adicionar sindicato.");
        }
    };

    // Pack extra fields to JSON
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
        dependentes,
        observacoes
    };

    // Dependent list handlers
    const addDependent = () => {
        setDependentes([
            ...dependentes,
            { nome: "", cpf: "", dataNascimento: "", parentesco: "", salarioFamilia: "Não", irrf: "Não" }
        ]);
    };

    const removeDependent = (idx: number) => {
        setDependentes(dependentes.filter((_, i) => i !== idx));
    };

    const updateDependent = (idx: number, field: string, value: string) => {
        const updated = dependentes.map((d, i) => {
            if (i === idx) {
                return { ...d, [field]: value };
            }
            return d;
        });
        setDependentes(updated);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Serialized JSON value to pass back to server action */}
            <input type="hidden" name="extraFields" value={JSON.stringify(extraFieldsData)} />

            {/* Stepper no Topo (Onvio Chevron style) */}
            <div className="flex w-full items-stretch border border-slate-200 rounded-xl overflow-hidden bg-slate-50/80 mb-4 text-[10px] font-semibold text-slate-500 shadow-sm flex-wrap md:flex-nowrap">
                {steps.map((s, idx) => {
                    const isActive = currentStep === s.number;
                    const isCompleted = currentStep > s.number;
                    return (
                        <button
                            key={s.number}
                            type="button"
                            onClick={() => {
                                const firstTabIdx = wizardTabs.findIndex(t => t.step === s.number);
                                if (firstTabIdx !== -1) setCurrentTabIdx(firstTabIdx);
                            }}
                            className={`flex-1 flex items-center justify-center py-2.5 relative transition-all outline-none min-w-[80px] ${
                                isActive
                                    ? "bg-white text-orange-600 font-bold border-b-2 border-orange-500 shadow-sm"
                                    : isCompleted
                                    ? "text-slate-700 bg-slate-100/60 hover:bg-slate-100"
                                    : "hover:bg-slate-100 text-slate-400"
                            }`}
                        >
                            <span className={`mr-1 px-1 rounded text-[9px] font-black ${
                                isActive ? "bg-orange-100 text-orange-700" : "bg-slate-200 text-slate-600"
                            }`}>
                                {s.number}
                            </span>
                            {s.label}
                            {idx < steps.length - 1 && (
                                <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center pointer-events-none z-10 hidden md:flex">
                                    <div className="w-[1px] h-6 bg-slate-200" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Sub-Tabs do Step Ativo */}
            <div className="flex border-b border-slate-200 mb-6 gap-6 overflow-x-auto pb-px">
                {currentStepTabs.map((t) => {
                    const isActive = currentTab === t.tab;
                    const tabIndexInMaster = wizardTabs.findIndex(x => x.tab === t.tab);
                    return (
                        <button
                            key={t.tab}
                            type="button"
                            onClick={() => setCurrentTabIdx(tabIndexInMaster)}
                            className={`pb-2 text-[10px] font-black uppercase tracking-wider relative transition-all outline-none whitespace-nowrap ${
                                isActive
                                    ? "text-orange-500 border-b-2 border-orange-500 font-bold"
                                    : "text-slate-400 hover:text-slate-600"
                            }`}
                        >
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Container do Formulário */}
            <div className="flex-1 overflow-y-auto px-1 min-h-[40vh] max-h-[52vh] pr-2 space-y-4">
                
                {/* --- SEÇÃO 1: GERAL --- */}
                {currentStep === 1 && (
                    <>
                        {/* Tab: Dados Básicos */}
                        {currentTab === "dados_basicos" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1 col-span-2 md:col-span-1">
                                    <Label htmlFor="name">Nome Completo</Label>
                                    <Input id="name" name="name" value={name} onChange={e => setName(e.target.value)} required placeholder="Nome do funcionário" />
                                </div>
                                <div className="space-y-1 col-span-2 md:col-span-1">
                                    <Label htmlFor="nomeSocial">Nome Social <span className="text-slate-400 text-[10px]">(opcional)</span></Label>
                                    <Input id="nomeSocial" value={nomeSocial} onChange={e => setNomeSocial(e.target.value)} placeholder="Nome social" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="cpf">CPF</Label>
                                    <Input id="cpf" name="cpf" value={cpf} onChange={e => setCpf(e.target.value)} required placeholder="000.000.000-00" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="roleId">Cargo</Label>
                                    <Select name="roleId" value={roleId} onValueChange={setRoleId} required>
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
                                <div className="space-y-1">
                                    <Label htmlFor="funcao">Função <span className="text-slate-400 text-[10px]">(opcional)</span></Label>
                                    <Input id="funcao" value={funcao} onChange={e => setFuncao(e.target.value)} placeholder="Especificação detalhada" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="matricula">Matrícula <span className="text-slate-400 text-[10px]">(opcional)</span></Label>
                                    <Input id="matricula" value={matricula} onChange={e => setMatrícula(e.target.value)} placeholder="Ex: 0142" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="companyId">Serviço (Sede onde ficará alocado)</Label>
                                    <Select name="companyId" value={companyId} onValueChange={setCompanyId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione a empresa/cliente" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {companies.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Dynamic Dropdown: Departamento */}
                                <div className="space-y-1">
                                    <Label htmlFor="departamento">Departamento</Label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <Select value={departamento} onValueChange={setDepartamento}>
                                                <SelectTrigger id="departamento">
                                                    <SelectValue placeholder="Selecione o departamento" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[160px]">
                                                    {localDepartments.map(d => (
                                                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button type="button" size="icon" variant="outline" onClick={handleAddDepartment} className="h-9 w-9 shrink-0" title="Adicionar Departamento">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Dynamic Dropdown: Centro de Custo */}
                                <div className="space-y-1">
                                    <Label htmlFor="centroCusto">Centro de Custo</Label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <Select value={centroCusto} onValueChange={setCentroCusto}>
                                                <SelectTrigger id="centroCusto">
                                                    <SelectValue placeholder="Selecione o centro de custo" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[160px]">
                                                    {localCostCenters.map(cc => (
                                                        <SelectItem key={cc.id} value={cc.name}>{cc.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button type="button" size="icon" variant="outline" onClick={handleAddCostCenter} className="h-9 w-9 shrink-0" title="Adicionar Centro de Custo">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Dynamic Dropdown: Sindicato */}
                                <div className="space-y-1">
                                    <Label htmlFor="sindicato">Sindicato</Label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <Select value={sindicato} onValueChange={setSindicato}>
                                                <SelectTrigger id="sindicato">
                                                    <SelectValue placeholder="Selecione o sindicato" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[160px]">
                                                    {localUnions.map(u => (
                                                        <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button type="button" size="icon" variant="outline" onClick={handleAddUnion} className="h-9 w-9 shrink-0" title="Adicionar Sindicato">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Admissão */}
                        {currentTab === "admissao" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="admissionDate">Data de Admissão</Label>
                                    <Input id="admissionDate" name="admissionDate" type="date" value={admissionDate} onChange={e => setAdmissionDate(e.target.value)} required />
                                </div>
                                <input type="hidden" name="type" value={type} />
                                <div className="space-y-1">
                                    <Label htmlFor="categoriaAdmissao">Categoria Onvio</Label>
                                    <Select value={categoriaAdmissao} onValueChange={setCategoriaAdmissao}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Mensalista">Mensalista</SelectItem>
                                            <SelectItem value="Horista">Horista</SelectItem>
                                            <SelectItem value="Diarista">Diarista</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="vinculoEmpregaticio">Vínculo Empregatício</Label>
                                    <Select value={vinculoEmpregaticio} onValueChange={setVinculoEmpregaticio}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Celetista">Celetista</SelectItem>
                                            <SelectItem value="Estatutário">Estatutário</SelectItem>
                                            <SelectItem value="Avulso">Avulso</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="workload">Carga Horária Mensal</Label>
                                    <Input id="workload" name="workload" type="number" value={workload} onChange={e => setWorkload(e.target.value)} required />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="salary">Salário Base (R$)</Label>
                                    <Input id="salary" name="salary" type="number" step="0.01" value={salary} onChange={e => setSalary(e.target.value)} required />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="insalubridade">Insalubridade (R$)</Label>
                                    <Input id="insalubridade" name="insalubridade" type="number" step="0.01" value={insalubridade} onChange={e => setInsalubridade(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="periculosidade">Periculosidade (R$)</Label>
                                    <Input id="periculosidade" name="periculosidade" type="number" step="0.01" value={periculosidade} onChange={e => setPericulosidade(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="gratificacao">Gratificação CCT (R$)</Label>
                                    <Input id="gratificacao" name="gratificacao" type="number" step="0.01" value={gratificacao} onChange={e => setGratificacao(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="outrosAdicionais">Outros Adicionais (R$)</Label>
                                    <Input id="outrosAdicionais" name="outrosAdicionais" type="number" step="0.01" value={outrosAdicionais} onChange={e => setOutrosAdicionais(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="valeAlimentacao">Vale Alimentação (Mensal - R$)</Label>
                                    <Input id="valeAlimentacao" name="valeAlimentacao" type="number" step="0.01" value={valeAlimentacao} onChange={e => setValeAlimentacao(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="valeTransporte">Vale Transporte (Mensal - R$)</Label>
                                    <Input id="valeTransporte" name="valeTransporte" type="number" step="0.01" value={valeTransporte} onChange={e => setValeTransporte(e.target.value)} />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <Label htmlFor="situationId">Situação Atual</Label>
                                    <Select name="situationId" value={situationId} onValueChange={setSituationId} required>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione a situação atual" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {situations.map(s => (
                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {/* Tab: Contrato de Experiência */}
                        {currentTab === "experiencia" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="experienciaDias1">Dias do 1º Período</Label>
                                    <Input id="experienciaDias1" type="number" value={experienciaDias1} onChange={e => setExperienciaDias1(e.target.value)} placeholder="Ex: 45" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="experienciaDias2">Dias de Prorrogação (2º Período)</Label>
                                    <Input id="experienciaDias2" type="number" value={experienciaDias2} onChange={e => setExperienciaDias2(e.target.value)} placeholder="Ex: 45" />
                                </div>
                            </div>
                        )}

                        {/* Tab: Horário */}
                        {currentTab === "horario" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1 col-span-2">
                                    <Label htmlFor="postoId">Vincular Posto de Trabalho</Label>
                                    <Select name="postoId" value={currentPostoId} onValueChange={handlePostoChangeInternal}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o posto de trabalho..." />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px]">
                                            {postos.map(p => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.client?.name} - {p.role?.name} ({p.schedule || "N/A"})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="escalaHorario">Escala / Tipo de Escala</Label>
                                    <Input id="escalaHorario" value={escalaHorario} onChange={e => setEscalaHorario(e.target.value)} placeholder="Ex: 12x36 ou 5x2" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="jornadaHoras">Jornada de Trabalho (Horário)</Label>
                                    <Input id="jornadaHoras" value={jornadaHoras} onChange={e => setJornadaHoras(e.target.value)} placeholder="Ex: 07:00 às 19:00" />
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* --- SEÇÃO 2: PROFISSIONAL --- */}
                {currentStep === 2 && (
                    <>
                        {/* Tab: CTPS */}
                        {currentTab === "ctps" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="ctpsNumero">Número CTPS</Label>
                                    <Input id="ctpsNumero" value={ctpsNumero} onChange={e => setCtpsNumero(e.target.value)} placeholder="Número da carteira de trabalho" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="ctpsSerie">Série CTPS</Label>
                                    <Input id="ctpsSerie" value={ctpsSerie} onChange={e => setCtpsSerie(e.target.value)} placeholder="Série" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="ctpsUf">UF CTPS</Label>
                                    <Input id="ctpsUf" value={ctpsUf} onChange={e => setCtpsUf(e.target.value)} placeholder="Ex: SP" maxLength={2} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="ctpsDataEmissao">Data Emissão CTPS</Label>
                                    <Input id="ctpsDataEmissao" type="date" value={ctpsDataEmissao} onChange={e => setCtpsDataEmissao(e.target.value)} />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <Label htmlFor="pisNumero">PIS / PASEP / NIT</Label>
                                    <Input id="pisNumero" value={pisNumero} onChange={e => setPisNumero(e.target.value)} placeholder="000.00000.00-0" />
                                </div>
                            </div>
                        )}

                        {/* Tab: FGTS */}
                        {currentTab === "fgts" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="fgtsOpcao">Optante pelo FGTS</Label>
                                    <Select value={fgtsOpcao} onValueChange={setFgtsOpcao}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Sim">Sim</SelectItem>
                                            <SelectItem value="Não">Não</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="fgtsDataOpcao">Data da Opção</Label>
                                    <Input id="fgtsDataOpcao" type="date" value={fgtsDataOpcao} onChange={e => setFgtsDataOpcao(e.target.value)} />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <Label htmlFor="fgtsBanco">Banco Depositário</Label>
                                    <Input id="fgtsBanco" value={fgtsBanco} onChange={e => setFgtsBanco(e.target.value)} placeholder="Ex: Caixa Econômica Federal" />
                                </div>
                            </div>
                        )}

                        {/* Tab: Conselhos */}
                        {currentTab === "conselhos" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="conselhoNome">Nome do Conselho Profissional</Label>
                                    <Input id="conselhoNome" value={conselhoNome} onChange={e => setConselhoNome(e.target.value)} placeholder="Ex: CRM, OAB, COREN" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="conselhoNumero">Número do Registro</Label>
                                    <Input id="conselhoNumero" value={conselhoNumero} onChange={e => setConselhoNumero(e.target.value)} placeholder="Número da inscrição" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="conselhoUf">UF do Conselho</Label>
                                    <Input id="conselhoUf" value={conselhoUf} onChange={e => setConselhoUf(e.target.value)} placeholder="Ex: SP" maxLength={2} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="conselhoValidade">Validade da Inscrição</Label>
                                    <Input id="conselhoValidade" type="date" value={conselhoValidade} onChange={e => setConselhoValidade(e.target.value)} />
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* --- SEÇÃO 3: PESSOAL --- */}
                {currentStep === 3 && (
                    <>
                        {/* Tab: Dados Pessoais */}
                        {currentTab === "dados_pessoais" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="birthDate">Data de Nascimento</Label>
                                    <Input id="birthDate" name="birthDate" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} required />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="gender">Gênero</Label>
                                    <Select name="gender" value={gender} onValueChange={setGender}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o gênero" />
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
                                    <Label htmlFor="estadoCivil">Estado Civil</Label>
                                    <Select value={estadoCivil} onValueChange={setEstadoCivil}>
                                        <SelectTrigger>
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
                                <div className="space-y-1">
                                    <Label htmlFor="grauInstrucao">Grau de Instrução</Label>
                                    <Select value={grauInstrucao} onValueChange={setGrauInstrucao}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Fundamental Incompleto">Ensino Fundamental Incompleto</SelectItem>
                                            <SelectItem value="Fundamental Completo">Ensino Fundamental Completo</SelectItem>
                                            <SelectItem value="Médio Incompleto">Ensino Médio Incompleto</SelectItem>
                                            <SelectItem value="Médio Completo">Ensino Médio Completo</SelectItem>
                                            <SelectItem value="Superior Incompleto">Ensino Superior Incompleto</SelectItem>
                                            <SelectItem value="Superior Completo">Ensino Superior Completo</SelectItem>
                                            <SelectItem value="Pós-graduação">Pós-graduação</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="nacionalidade">Nacionalidade</Label>
                                    <Input id="nacionalidade" value={nacionalidade} onChange={e => setNacionalidade(e.target.value)} />
                                </div>
                                <div className="space-y-1 flex gap-2">
                                    <div className="flex-1 space-y-1">
                                        <Label htmlFor="naturalidadeCidade">Naturalidade (Cidade)</Label>
                                        <Input id="naturalidadeCidade" value={naturalidadeCidade} onChange={e => setNaturalidadeCidade(e.target.value)} placeholder="Cidade de nascimento" />
                                    </div>
                                    <div className="w-20 space-y-1">
                                        <Label htmlFor="naturalidadeUf">UF</Label>
                                        <Input id="naturalidadeUf" value={naturalidadeUf} onChange={e => setNaturalidadeUf(e.target.value)} placeholder="SP" maxLength={2} />
                                    </div>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <Label htmlFor="nomeMae">Nome da Mãe</Label>
                                    <Input id="nomeMae" value={nomeMae} onChange={e => setNomeMae(e.target.value)} placeholder="Nome completo da mãe" />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <Label htmlFor="nomePai">Nome do Pai <span className="text-slate-400 text-[10px]">(opcional)</span></Label>
                                    <Input id="nomePai" value={nomePai} onChange={e => setNomePai(e.target.value)} placeholder="Nome completo do pai" />
                                </div>
                            </div>
                        )}

                        {/* Tab: Endereço & Contato */}
                        {currentTab === "endereco" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1 col-span-2">
                                    <Label htmlFor="address">Endereço Completo</Label>
                                    <Input id="address" name="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Rua, Número, Bairro, CEP, Cidade - UF" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="phone">Telefone de Contato</Label>
                                    <Input id="phone" name="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="email">E-mail Pessoal</Label>
                                    <Input id="email" name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@provedor.com" />
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* --- SEÇÃO 4: DOCUMENTOS --- */}
                {currentStep === 4 && (
                    <>
                        {/* Tab: RG */}
                        {currentTab === "rg" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="rgNumero">Número do RG</Label>
                                    <Input id="rgNumero" value={rgNumero} onChange={e => setRgNumero(e.target.value)} placeholder="Registro Geral" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="rgOrgaoEmissor">Órgão Emissor</Label>
                                    <Input id="rgOrgaoEmissor" value={rgOrgaoEmissor} onChange={e => setRgOrgaoEmissor(e.target.value)} placeholder="Ex: SSP" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="rgDataEmissao">Data de Emissão</Label>
                                    <Input id="rgDataEmissao" type="date" value={rgDataEmissao} onChange={e => setRgDataEmissao(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="rgUf">UF de Emissão</Label>
                                    <Input id="rgUf" value={rgUf} onChange={e => setRgUf(e.target.value)} placeholder="Ex: SP" maxLength={2} />
                                </div>
                            </div>
                        )}

                        {/* Tab: CNH */}
                        {currentTab === "cnh" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1 col-span-2">
                                    <Label htmlFor="cnhNumero">Número da CNH</Label>
                                    <Input id="cnhNumero" value={cnhNumero} onChange={e => setCnhNumero(e.target.value)} placeholder="Número de registro" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="cnhCategoria">Categoria CNH</Label>
                                    <Input id="cnhCategoria" value={cnhCategoria} onChange={e => setCnhCategoria(e.target.value)} placeholder="Ex: AB, D" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="cnhValidade">Data de Validade</Label>
                                    <Input id="cnhValidade" type="date" value={cnhValidade} onChange={e => setCnhValidade(e.target.value)} />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <Label htmlFor="cnhUf">UF da CNH</Label>
                                    <Input id="cnhUf" value={cnhUf} onChange={e => setCnhUf(e.target.value)} placeholder="Ex: SP" maxLength={2} />
                                </div>
                            </div>
                        )}

                        {/* Tab: Título & Reservista */}
                        {currentTab === "titulo" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1 col-span-2">
                                    <Label htmlFor="tituloEleitorNumero">Título de Eleitor (Número)</Label>
                                    <Input id="tituloEleitorNumero" value={tituloEleitorNumero} onChange={e => setTituloEleitorNumero(e.target.value)} placeholder="Inscrição eleitoral" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="tituloEleitorZona">Zona</Label>
                                    <Input id="tituloEleitorZona" value={tituloEleitorZona} onChange={e => setTituloEleitorZona(e.target.value)} placeholder="Zona" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="tituloEleitorSecao">Seção</Label>
                                    <Input id="tituloEleitorSecao" value={tituloEleitorSecao} onChange={e => setTituloEleitorSecao(e.target.value)} placeholder="Seção" />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <Label htmlFor="tituloEleitorUf">UF Título</Label>
                                    <Input id="tituloEleitorUf" value={tituloEleitorUf} onChange={e => setTituloEleitorUf(e.target.value)} placeholder="Ex: SP" maxLength={2} />
                                </div>

                                <div className="border-t col-span-2 pt-4 mt-2">
                                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Reservista (Militar)</h4>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="reservistaNumero">Número do Certificado</Label>
                                    <Input id="reservistaNumero" value={reservistaNumero} onChange={e => setReservistaNumero(e.target.value)} placeholder="Número" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="reservistaCategoria">Categoria</Label>
                                    <Input id="reservistaCategoria" value={reservistaCategoria} onChange={e => setReservistaCategoria(e.target.value)} placeholder="Ex: 3ª Categoria" />
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* --- SEÇÃO 5: DEPENDENTES --- */}
                {currentStep === 5 && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <div>
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">Dependentes e Beneficiários</h3>
                                <p className="text-[10px] text-slate-400">Adicione os filhos, cônjuges e dependentes para imposto de renda e salário família.</p>
                            </div>
                            <Button type="button" onClick={addDependent} size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50 gap-1.5 font-bold text-xs h-8">
                                <Plus className="w-3.5 h-3.5" /> Adicionar
                            </Button>
                        </div>

                        {dependentes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-xl bg-slate-50/40 text-center">
                                <span className="text-xs font-bold text-slate-500">Nenhum dependente cadastrado</span>
                                <span className="text-[10px] text-slate-400 mt-0.5">Clique no botão superior para incluir.</span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {dependentes.map((d, idx) => (
                                    <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-slate-50/10 relative space-y-3 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                        <button
                                            type="button"
                                            onClick={() => removeDependent(idx)}
                                            className="absolute top-3 right-3 text-slate-400 hover:text-red-600 transition-colors p-1 hover:bg-slate-100 rounded"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <span className="text-xs font-black text-slate-700 block">Dependente #{idx + 1}</span>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[9px] uppercase font-bold text-slate-500">Nome Completo</Label>
                                                <Input value={d.nome} onChange={e => updateDependent(idx, "nome", e.target.value)} placeholder="Nome do dependente" className="h-8 text-xs" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <Label className="text-[9px] uppercase font-bold text-slate-500">CPF</Label>
                                                    <Input value={d.cpf} onChange={e => updateDependent(idx, "cpf", e.target.value)} placeholder="000.000.000-00" className="h-8 text-xs" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[9px] uppercase font-bold text-slate-500">Nascimento</Label>
                                                    <Input type="date" value={d.dataNascimento} onChange={e => updateDependent(idx, "dataNascimento", e.target.value)} className="h-8 text-xs px-2" />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[9px] uppercase font-bold text-slate-500">Grau de Parentesco</Label>
                                                <Select value={d.parentesco} onValueChange={val => updateDependent(idx, "parentesco", val)}>
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Selecione" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Filho(a)">Filho(a)</SelectItem>
                                                        <SelectItem value="Cônjuge">Cônjuge</SelectItem>
                                                        <SelectItem value="Mãe / Pai">Mãe / Pai</SelectItem>
                                                        <SelectItem value="Outros">Outros</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <Label className="text-[9px] uppercase font-bold text-slate-500">Salário Família</Label>
                                                    <Select value={d.salarioFamilia} onValueChange={val => updateDependent(idx, "salarioFamilia", val)}>
                                                        <SelectTrigger className="h-8 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Sim">Sim</SelectItem>
                                                            <SelectItem value="Não">Não</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[9px] uppercase font-bold text-slate-500">IRRF</Label>
                                                    <Select value={d.irrf} onValueChange={val => updateDependent(idx, "irrf", val)}>
                                                        <SelectTrigger className="h-8 text-xs">
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
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* --- SEÇÃO 6: OBSERVAÇÕES --- */}
                {currentStep === 6 && (
                    <div className="space-y-2">
                        <Label htmlFor="observacoes">Notas e Observações de Admissão</Label>
                        <textarea
                            id="observacoes"
                            value={observacoes}
                            onChange={e => setObservacoes(e.target.value)}
                            rows={8}
                            className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none bg-white min-h-[160px]"
                            placeholder="Adicione observações gerais, anotações de contratação ou instruções adicionais necessárias para a admissão Onvio..."
                        />
                    </div>
                )}
            </div>

            {/* Rodapé de Navegação do Wizard */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-200 mt-4 bg-white">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={handleBack}
                    disabled={currentTabIdx === 0}
                    className="font-bold text-slate-500 gap-1 rounded-xl hover:bg-slate-100 hover:text-slate-700 h-9 text-xs"
                >
                    <ChevronLeft className="w-4 h-4" /> Voltar
                </Button>

                {currentTabIdx < wizardTabs.length - 1 ? (
                    <Button
                        type="button"
                        onClick={handleNext}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold gap-1 rounded-xl shadow-sm px-6 h-9 text-xs"
                    >
                        Próxima <ChevronRight className="w-4 h-4" />
                    </Button>
                ) : (
                    <span className="text-[10px] text-slate-400 italic font-bold">Formulário concluído. Pressione Salvar no final da ficha.</span>
                )}
            </div>
        </div>
    );
}
