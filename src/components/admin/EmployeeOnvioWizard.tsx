"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronRight, ChevronLeft, CheckCircle2, FileText, Download, UploadCloud, Pencil, X, Check } from "lucide-react";
import { addDepartment, addCostCenter, addUnion, addJobFunction } from "@/app/actions";
import { toast } from "sonner";

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
    jobFunctions?: { id: string; name: string }[];
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
    
    { step: 2, tab: "ctps", label: "Carteira de Trabalho" },
    { step: 2, tab: "fgts", label: "FGTS" },
    { step: 2, tab: "pagamento", label: "Pagamento" },
    { step: 2, tab: "conselhos", label: "Conselhos" },
    
    { step: 3, tab: "dados_pessoais", label: "Dados Pessoais" },
    { step: 3, tab: "endereco", label: "Endereço e Contato" },
    
    { step: 4, tab: "rg", label: "RG" },
    { step: 4, tab: "cnh", label: "CNH" },
    { step: 4, tab: "titulo", label: "Título & Reservista" },
    
    { step: 5, tab: "dependentes", label: "Dependentes" },
    
    { step: 6, tab: "observacoes", label: "Observações" }
];

const compressImageIfNeeded = (file: File): Promise<File> => {
    return new Promise((resolve) => {
        if (!file.type.startsWith("image/")) {
            resolve(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                const MAX_WIDTH = 1600;
                const MAX_HEIGHT = 1600;

                if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                    if (width > height) {
                        height = Math.round((height * MAX_WIDTH) / width);
                        width = MAX_WIDTH;
                    } else {
                        width = Math.round((width * MAX_HEIGHT) / height);
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                const compressedFile = new File([blob], file.name, {
                                    type: "image/jpeg",
                                    lastModified: Date.now(),
                                });
                                resolve(compressedFile);
                            } else {
                                resolve(file);
                            }
                        },
                        "image/jpeg",
                        0.75
                    );
                } else {
                    resolve(file);
                }
            };
            img.onerror = () => resolve(file);
            img.src = event.target?.result as string;
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
};

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
    unions = [],
    jobFunctions = []
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
    const [dependentsCount, setDependentsCount] = useState("0");
    const [ajudaCusto, setAjudaCusto] = useState("0");
    const [adicionalViagem, setAdicionalViagem] = useState("0");
    const [workload, setWorkload] = useState("220");
    const [valeAlimentacao, setValeAlimentacao] = useState("0");
    const [valeTransporte, setValeTransporte] = useState("0");
    const [valeTransporte2, setValeTransporte2] = useState("0");
    const [vtOptIn, setVtOptIn] = useState<boolean>(initialData?.vtOptIn !== false);
    const [vtPaymentMethod, setVtPaymentMethod] = useState(initialData?.vtPaymentMethod || "Metrocard");
    const [vtPaymentMethod2, setVtPaymentMethod2] = useState(initialData?.vtPaymentMethod2 || "Urbs");
    const [vtOptions, setVtOptions] = useState<string[]>(["Metrocard", "Urbs", "PIX"]);
    const [vtOptions2, setVtOptions2] = useState<string[]>(["Metrocard", "Urbs", "PIX"]);
    const [isManagingVt, setIsManagingVt] = useState(false);
    const [isManagingVt2, setIsManagingVt2] = useState(false);
    const [newVtMethodName, setNewVtMethodName] = useState("");
    const [newVtMethodName2, setNewVtMethodName2] = useState("");
    const [editingVtIndex, setEditingVtIndex] = useState<number | null>(null);
    const [editingVtIndex2, setEditingVtIndex2] = useState<number | null>(null);
    const [editingVtValue, setEditingVtValue] = useState("");
    const [editingVtValue2, setEditingVtValue2] = useState("");
    
    const [vtDiscountPercentage, setVtDiscountPercentage] = useState(initialData?.vtDiscountPercentage !== null && initialData?.vtDiscountPercentage !== undefined ? initialData.vtDiscountPercentage.toString() : "");
    const [vaDiscountPercentage, setVaDiscountPercentage] = useState(initialData?.vaDiscountPercentage !== null && initialData?.vaDiscountPercentage !== undefined ? initialData.vaDiscountPercentage.toString() : "");

    useEffect(() => {
        const initialMethod = initialData?.vtPaymentMethod;
        if (initialMethod && !["Metrocard", "Urbs", "PIX"].includes(initialMethod)) {
            setVtOptions(prev => {
                if (prev.includes(initialMethod)) return prev;
                return [...prev, initialMethod];
            });
        }
    }, [initialData?.vtPaymentMethod]);

    useEffect(() => {
        const initialMethod2 = initialData?.vtPaymentMethod2;
        if (initialMethod2 && !["Metrocard", "Urbs", "PIX"].includes(initialMethod2)) {
            setVtOptions2(prev => {
                if (prev.includes(initialMethod2)) return prev;
                return [...prev, initialMethod2];
            });
        }
    }, [initialData?.vtPaymentMethod2]);

    const [vtCustomPaymentDetails, setVtCustomPaymentDetails] = useState(initialData?.vtCustomPaymentDetails || "");
    const [vtCustomPaymentDetails2, setVtCustomPaymentDetails2] = useState(initialData?.vtCustomPaymentDetails2 || "");
    const [urbsSic, setUrbsSic] = useState(initialData?.urbsSic || "");
    const [urbsCqCtNf, setUrbsCqCtNf] = useState(initialData?.urbsCqCtNf || "");
    const [vaPaymentMethod, setVaPaymentMethod] = useState(initialData?.vaPaymentMethod || "Cartão Caju");
    const [vaOptions, setVaOptions] = useState<string[]>(["Cartão Caju"]);
    const [isManagingVa, setIsManagingVa] = useState(false);
    const [newVaMethodName, setNewVaMethodName] = useState("");
    const [editingVaIndex, setEditingVaIndex] = useState<number | null>(null);
    const [editingVaValue, setEditingVaValue] = useState("");

    useEffect(() => {
        const initialMethod = initialData?.vaPaymentMethod;
        if (initialMethod && !["Cartão Caju"].includes(initialMethod)) {
            setVaOptions(prev => {
                if (prev.includes(initialMethod)) return prev;
                return [...prev, initialMethod];
            });
        }
    }, [initialData?.vaPaymentMethod]);

    const [vaCustomPaymentDetails, setVaCustomPaymentDetails] = useState(initialData?.vaCustomPaymentDetails || "");
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
    const [localJobFunctions, setLocalJobFunctions] = useState<{ id: string; name: string }[]>(jobFunctions);

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
    const [chavePix, setChavePix] = useState("");
    const [formaPagamento, setFormaPagamento] = useState("PIX");
    const [tipoChavePix, setTipoChavePix] = useState("");

    const [estadoCivil, setEstadoCivil] = useState("");
    const [grauInstrucao, setGrauInstrucao] = useState("");
    const [nomePai, setNomePai] = useState("");
    const [nomeMae, setNomeMae] = useState("");
    const [nacionalidade, setNacionalidade] = useState("Brasileira");
    const [naturalidadeCidade, setNaturalidadeCidade] = useState("");
    const [naturalidadeUf, setNaturalidadeUf] = useState("");

    const [attachments, setAttachments] = useState<{ name: string; fileName: string; fileData: string }[]>([]);
    const [loadingSlot, setLoadingSlot] = useState<string | null>(null);

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
    useEffect(() => {
        if (jobFunctions && jobFunctions.length > 0) setLocalJobFunctions(jobFunctions);
    }, [jobFunctions]);

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

    // Auto-fill fields from selected Posto when currentPostoId changes (on initial load or conversion)
    useEffect(() => {
        if (currentPostoId && postos && postos.length > 0) {
            const selectedPosto = postos.find(p => p.id === currentPostoId);
            if (selectedPosto) {
                // Sincroniza valores do posto de trabalho
                setSalary(String(selectedPosto.baseSalary || 0));
                setInsalubridade(String(selectedPosto.insalubridade || 0));
                setPericulosidade(String(selectedPosto.periculosidade || 0));
                setGratificacao(String(selectedPosto.gratificacao || 0));
                setOutrosAdicionais(String(selectedPosto.outrosAdicionais || 0));
                setValeAlimentacao(String(selectedPosto.valeAlimentacao || 0));
                setValeTransporte(String(selectedPosto.valeTransporte || 0));
                if (selectedPosto.valeTransporte2) {
                    setValeTransporte2(String(selectedPosto.valeTransporte2));
                }
                if (selectedPosto.vtPaymentMethod2) {
                    setVtPaymentMethod2(selectedPosto.vtPaymentMethod2);
                }
                setWorkload(String(selectedPosto.requiredWorkload || 220));
                if (selectedPosto.roleId) {
                    setRoleId(selectedPosto.roleId);
                }
                if (selectedPosto.schedule) {
                    setEscalaHorario(selectedPosto.schedule);
                }
                const hoursStr = (selectedPosto.startTime && selectedPosto.endTime) 
                    ? `${selectedPosto.startTime} às ${selectedPosto.endTime}` 
                    : (selectedPosto.startTime || selectedPosto.endTime || "");
                if (hoursStr) {
                    setJornadaHoras(hoursStr);
                }
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
            setValeAlimentacao(String(selectedPosto.valeAlimentacao || 0));
            setValeTransporte(String(selectedPosto.valeTransporte || 0));
            setWorkload(String(selectedPosto.requiredWorkload || 220));
            setRoleId(selectedPosto.roleId || "");
            
            setEscalaHorario(selectedPosto.schedule || "");
            const hoursStr = (selectedPosto.startTime && selectedPosto.endTime) 
                ? `${selectedPosto.startTime} - ${selectedPosto.endTime}` 
                : "";
            setJornadaHoras(hoursStr);
        }
    };

    // Populate data when initialData changes
    useEffect(() => {
        if (initialData) {
            // Get Posto link from assignments
            const resolvedPostoId = (initialData.assignments && initialData.assignments.length > 0)
                ? (initialData.assignments.find((a: any) => !a.endDate)?.postoId || "")
                : (initialData.postoId || "");

            if (resolvedPostoId && !postoId) {
                setPostoId(resolvedPostoId);
            }

            const selectedPosto = postos.find(p => p.id === resolvedPostoId);

            const safeFormatDate = (d?: any) => {
                if (!d) return "";
                if (d instanceof Date) {
                    if (isNaN(d.getTime())) return "";
                    return d.toISOString().split("T")[0];
                }
                const str = String(d);
                if (str.includes("-")) return str.split("T")[0];
                if (str.includes("/")) {
                    const parts = str.split("/");
                    if (parts.length === 3) {
                        const [day, month, year] = parts;
                        if (year && year.length === 4) return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    }
                }
                try {
                    const date = new Date(d);
                    if (!isNaN(date.getTime())) {
                        return date.toISOString().split("T")[0];
                    }
                } catch (e) {}
                return "";
            };

            if (initialData.name) setName(initialData.name);
            if (initialData.cpf) setCpf(initialData.cpf);
            if (initialData.roleId) setRoleId(initialData.roleId);
            
            if (initialData.companyId) {
                setCompanyId(initialData.companyId);
            } else if (initialData.companyName && companies && companies.length > 0) {
                const foundComp = companies.find(c => 
                    c.name.toLowerCase().includes(initialData.companyName.toLowerCase()) || 
                    initialData.companyName.toLowerCase().includes(c.name.toLowerCase())
                );
                if (foundComp) setCompanyId(foundComp.id);
            }

            if (initialData.type) setType(initialData.type);
            if (initialData.status) setStatus(initialData.status);
            if (initialData.situationId) setSituationId(initialData.situationId);
            if (initialData.admissionDate) {
                setAdmissionDate(safeFormatDate(initialData.admissionDate));
            }
            
            // Sincroniza valores do posto se não houver valor salvo ou se for 0
            setSalary(initialData.salary ? String(initialData.salary) : (selectedPosto ? String(selectedPosto.baseSalary || 0) : "0"));
            setInsalubridade(initialData.insalubridade ? String(initialData.insalubridade) : (selectedPosto ? String(selectedPosto.insalubridade || 0) : "0"));
            setPericulosidade(initialData.periculosidade ? String(initialData.periculosidade) : (selectedPosto ? String(selectedPosto.periculosidade || 0) : "0"));
            setGratificacao(initialData.gratificacao ? String(initialData.gratificacao) : (selectedPosto ? String(selectedPosto.gratificacao || 0) : "0"));
            setOutrosAdicionais(initialData.outrosAdicionais ? String(initialData.outrosAdicionais) : (selectedPosto ? String(selectedPosto.outrosAdicionais || 0) : "0"));
            setDependentsCount(initialData.dependentsCount ? String(initialData.dependentsCount) : "0");
            setAjudaCusto(initialData.ajudaCusto ? String(initialData.ajudaCusto) : "0");
            setAdicionalViagem(initialData.adicionalViagem ? String(initialData.adicionalViagem) : "0");
            setValeAlimentacao(initialData.valeAlimentacao ? String(initialData.valeAlimentacao) : (selectedPosto ? String(selectedPosto.valeAlimentacao || 0) : "0"));
            setValeTransporte(initialData.valeTransporte ? String(initialData.valeTransporte) : (selectedPosto ? String(selectedPosto.valeTransporte || 0) : "0"));
            setWorkload(initialData.workload ? String(initialData.workload) : (selectedPosto ? String(selectedPosto.requiredWorkload || 220) : "220"));

            if (initialData.birthDate) {
                setBirthDate(safeFormatDate(initialData.birthDate));
            }
            setGender(initialData.gender || "");
            setAddress(initialData.address || "");
            setPhone(initialData.phone || "");
            setEmail(initialData.email || "");

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

            const activePosto = postos.find(p => p.id === currentPostoId) || postos.find(p => p.id === initialData?.postoId);

            const resolvedEscala = extra.escalaHorario || extra.escala || (activePosto ? (activePosto.schedule || "") : "");
            setEscalaHorario(resolvedEscala);

            const resolvedJornada = extra.jornadaHoras || extra.jornada || 
                (activePosto && activePosto.startTime && activePosto.endTime 
                    ? `${activePosto.startTime} às ${activePosto.endTime}` 
                    : (activePosto ? (activePosto.startTime || activePosto.endTime || "") : ""));
            setJornadaHoras(resolvedJornada);

            const rawCpf = initialData?.cpf || extra.cpf || extra.cpfNumero || "";
            const cpfClean = (rawCpf || "").replace(/\D/g, "");
            const digitalCtpsNum = cpfClean.length >= 7 ? cpfClean.slice(0, 7) : "";
            const digitalCtpsSerie = cpfClean.length >= 11 ? cpfClean.slice(7, 11) : (cpfClean.length >= 4 ? cpfClean.slice(-4) : "");

            setCtpsNumero(extra.ctpsNumero || extra.ctps || extra.numeroCtps || extra.ctps_numero || digitalCtpsNum);
            setCtpsSerie(extra.ctpsSerie || extra.serie || extra.ctps_serie || digitalCtpsSerie);
            setCtpsUf(extra.ctpsUf || extra.ufCtps || extra.ctps_uf || extra.rgUf || "PR");
            setCtpsDataEmissao(safeFormatDate(extra.ctpsDataEmissao || extra.dataEmissaoCtps || extra.ctps_data_emissao));
            setPisNumero(extra.pisNumero || extra.pis || extra.pisPasep || extra.pis_pasep || (cpfClean ? rawCpf : ""));

            setFgtsOpcao(extra.fgtsOpcao || "Sim");
            setFgtsDataOpcao(safeFormatDate(extra.fgtsDataOpcao));
            setFgtsBanco(extra.fgtsBanco || "");

            setConselhoNome(extra.conselhoNome || "");
            setConselhoNumero(extra.conselhoNumero || "");
            setConselhoUf(extra.conselhoUf || "");
            setConselhoValidade(safeFormatDate(extra.conselhoValidade));

            setEstadoCivil(extra.estadoCivil || extra.estado_civil || "");
            setGrauInstrucao(extra.grauInstrucao || extra.escolaridade || "");
            setNomePai(extra.nomePai || extra.pai || extra.fatherName || "");
            setNomeMae(extra.nomeMae || extra.mae || extra.motherName || "");
            setNacionalidade(extra.nacionalidade || "Brasileira");
            setNaturalidadeCidade(extra.naturalidadeCidade || extra.cidadeNatal || "");
            setNaturalidadeUf(extra.naturalidadeUf || extra.ufNatal || "");

            setRgNumero(extra.rgNumero || extra.rg || extra.numeroRg || extra.rg_numero || initialData.rg || "");
            setRgOrgaoEmissor(extra.rgOrgaoEmissor || extra.orgaoEmissor || extra.rg_orgao_emissor || extra.orgaoExpedidor || "");
            setRgDataEmissao(safeFormatDate(extra.rgDataEmissao || extra.dataEmissaoRg || extra.rg_data_emissao || extra.dataExpedicao));
            setRgUf(extra.rgUf || extra.ufEmissao || extra.rg_uf || extra.ufRg || "");

            setCnhNumero(extra.cnhNumero || "");
            setCnhCategoria(extra.cnhCategoria || "");
            setCnhValidade(safeFormatDate(extra.cnhValidade));
            setCnhUf(extra.cnhUf || "");

            setTituloEleitorNumero(extra.tituloEleitorNumero || "");
            setTituloEleitorZona(extra.tituloEleitorZona || "");
            setTituloEleitorSecao(extra.tituloEleitorSecao || "");
            setTituloEleitorUf(extra.tituloEleitorUf || "");

            setReservistaNumero(extra.reservistaNumero || "");
            setReservistaCategoria(extra.reservistaCategoria || "");
            setChavePix(extra.chavePix || "");
            setFormaPagamento(extra.formaPagamento || "PIX");
            setTipoChavePix(extra.tipoChavePix || "");

            if (initialData.urbsSic !== undefined) setUrbsSic(initialData.urbsSic || "");
            if (initialData.urbsCqCtNf !== undefined) setUrbsCqCtNf(initialData.urbsCqCtNf || "");
            if (initialData.vtCustomPaymentDetails !== undefined) setVtCustomPaymentDetails(initialData.vtCustomPaymentDetails || "");
            if (initialData.vtCustomPaymentDetails2 !== undefined) setVtCustomPaymentDetails2(initialData.vtCustomPaymentDetails2 || "");

            setDependentes(extra.dependentes || []);
            setObservacoes(extra.observacoes || "");
            setAttachments(extra.attachments || []);
        }
    }, [initialData, postos]);

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

    const handleAddJobFunction = async () => {
        const name = window.prompt("Digite o nome da nova Função:");
        if (!name || name.trim() === "") return;
        try {
            const newFunc = await addJobFunction(name.trim());
            setLocalJobFunctions(prev => {
                if (prev.some(f => f.id === newFunc.id)) return prev;
                return [...prev, newFunc].sort((a,b) => a.name.localeCompare(b.name));
            });
            setFuncao(newFunc.name);
        } catch (e) {
            alert("Erro ao adicionar função.");
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
        chavePix,
        formaPagamento,
        tipoChavePix,
        dependentes,
        observacoes,
        attachments
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

    const handleUploadSlot = async (key: string, label: string, rawFile: File) => {
        if (rawFile.size > 4.2 * 1024 * 1024 && !rawFile.type.startsWith("image/")) {
            alert("O arquivo PDF é muito grande (maior que 4MB). Por favor, otimize ou comprima o PDF antes de enviar.");
            return;
        }

        const file = await compressImageIfNeeded(rawFile);
        if (file.size > 4.2 * 1024 * 1024) {
            alert("O arquivo é muito grande (maior que 4MB). Por favor, otimize/comprima o arquivo antes de enviar.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64Data = reader.result as string;
            setAttachments(prev => {
                const filtered = prev.filter(a => a.name !== label);
                return [...filtered, { name: label, fileName: file.name, fileData: base64Data }];
            });

            setLoadingSlot(key);
            try {
                const formData = new FormData();
                formData.append("file", file);

                const res = await fetch("/api/extract-document", {
                    method: "POST",
                    body: formData
                });
                const result = await res.json();
                if (!result.success) {
                    alert(`Erro na leitura do documento: ${result.error || "Erro desconhecido"}`);
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
                    if (data.nomeSocial) setNomeSocial(data.nomeSocial);
                    if (data.funcao) setFuncao(data.funcao);
                    if (data.ctpsNumero) setCtpsNumero(data.ctpsNumero);
                    if (data.ctpsSerie) setCtpsSerie(data.ctpsSerie);
                    if (data.ctpsUf) setCtpsUf(data.ctpsUf);
                    if (data.ctpsDataEmissao) setCtpsDataEmissao(data.ctpsDataEmissao);
                    if (data.pisNumero) setPisNumero(data.pisNumero);
                    if (data.estadoCivil) setEstadoCivil(data.estadoCivil);
                    if (data.grauInstrucao) setGrauInstrucao(data.grauInstrucao);
                    if (data.nomePai) setNomePai(data.nomePai);
                    if (data.nomeMae) setNomeMae(data.nomeMae);
                    if (data.nacionalidade) setNacionalidade(data.nacionalidade);
                    if (data.naturalidadeCidade) setNaturalidadeCidade(data.naturalidadeCidade);
                    if (data.naturalidadeUf) setNaturalidadeUf(data.naturalidadeUf);
                    if (data.rgNumero) setRgNumero(data.rgNumero);
                    if (data.rgOrgaoEmissor) setRgOrgaoEmissor(data.rgOrgaoEmissor);
                    if (data.rgDataEmissao) setRgDataEmissao(data.rgDataEmissao);
                    if (data.rgUf) setRgUf(data.rgUf);
                    if (data.cnhNumero) setCnhNumero(data.cnhNumero);
                    if (data.cnhCategoria) setCnhCategoria(data.cnhCategoria);
                    if (data.cnhValidade) setCnhValidade(data.cnhValidade);
                    if (data.cnhUf) setCnhUf(data.cnhUf);
                    if (data.tituloEleitorNumero) setTituloEleitorNumero(data.tituloEleitorNumero);
                    if (data.tituloEleitorZona) setTituloEleitorZona(data.tituloEleitorZona);
                    if (data.tituloEleitorSecao) setTituloEleitorSecao(data.tituloEleitorSecao);
                    if (data.tituloEleitorUf) setTituloEleitorUf(data.tituloEleitorUf);
                    if (data.reservistaNumero) setReservistaNumero(data.reservistaNumero);
                    if (data.reservistaCategoria) setReservistaCategoria(data.reservistaCategoria);
                    
                    // Preenche dependentes se retornados
                    const extractedDeps = data.dependents || data.dependentes;
                    if (extractedDeps && Array.isArray(extractedDeps)) {
                        setDependentes(prev => {
                            const cleanedPrev = prev.filter(d => d.nome.trim() !== "");
                            const extracted = extractedDeps.map((dep: any) => {
                                let parentesco = "Filho(a)";
                                const depParentesco = dep.parentesco || dep.relationship || "";
                                if (depParentesco) {
                                    const p = depParentesco.toLowerCase();
                                    if (p.includes("cônjuge") || p.includes("conjuge") || p.includes("espos")) {
                                        parentesco = "Cônjuge";
                                    } else if (p.includes("pai") || p.includes("mãe") || p.includes("mae")) {
                                        parentesco = "Mãe / Pai";
                                    } else if (p.includes("filh")) {
                                        parentesco = "Filho(a)";
                                    } else {
                                        parentesco = "Outros";
                                    }
                                }
                                let birthDateStr = "";
                                const depBirth = dep.dataNascimento || dep.birthDate || dep.data_nascimento || "";
                                if (depBirth) {
                                    try {
                                        const cleanDate = String(depBirth).split('T')[0];
                                        const parts = cleanDate.split('-');
                                        if (parts.length === 3 && parts[0].length === 4) {
                                            birthDateStr = cleanDate;
                                        } else {
                                            const d = new Date(String(depBirth));
                                            if (!isNaN(d.getTime())) {
                                                birthDateStr = d.toISOString().split('T')[0];
                                            }
                                        }
                                    } catch (e) {
                                        console.error(e);
                                    }
                                }
                                return {
                                    nome: dep.nome || dep.name || "",
                                    cpf: dep.cpf || "",
                                    dataNascimento: birthDateStr,
                                    parentesco,
                                    salarioFamilia: dep.salarioFamilia || dep.salario_familia || "Sim",
                                    irrf: dep.irrf || "Não"
                                };
                            });
                            return [...cleanedPrev, ...extracted];
                        });
                    }
            } catch (e) {
                console.error("Erro na extração IA:", e);
                alert(`Erro de conexão ao processar documento: ${(e as any)?.message || e}`);
            } finally {
                setLoadingSlot(null);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleUploadGeneric = async (rawFile: File) => {
        if (rawFile.size > 4.2 * 1024 * 1024 && !rawFile.type.startsWith("image/")) {
            alert("O arquivo PDF é muito grande (maior que 4MB). Por favor, otimize ou comprima o PDF antes de enviar.");
            return;
        }

        const file = await compressImageIfNeeded(rawFile);
        if (file.size > 4.2 * 1024 * 1024) {
            alert("O arquivo é muito grande (maior que 4MB). Por favor, otimize/comprima o arquivo antes de enviar.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64Data = reader.result as string;
            const docName = file.name.split('.').slice(0, -1).join('.') || file.name;
            setAttachments(prev => {
                const filtered = prev.filter(a => a.name !== docName);
                return [...filtered, { name: docName, fileName: file.name, fileData: base64Data }];
            });

            setLoadingSlot(`generic-${docName}`);
            try {
                const formData = new FormData();
                formData.append("file", file);

                const res = await fetch("/api/extract-document", {
                    method: "POST",
                    body: formData
                });
                const result = await res.json();
                if (!result.success) {
                    alert(`Erro na leitura do documento: ${result.error || "Erro desconhecido"}`);
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
                    if (data.nomeSocial) setNomeSocial(data.nomeSocial);
                    if (data.funcao) setFuncao(data.funcao);
                    if (data.ctpsNumero) setCtpsNumero(data.ctpsNumero);
                    if (data.ctpsSerie) setCtpsSerie(data.ctpsSerie);
                    if (data.ctpsUf) setCtpsUf(data.ctpsUf);
                    if (data.ctpsDataEmissao) setCtpsDataEmissao(data.ctpsDataEmissao);
                    if (data.pisNumero) setPisNumero(data.pisNumero);
                    if (data.estadoCivil) setEstadoCivil(data.estadoCivil);
                    if (data.grauInstrucao) setGrauInstrucao(data.grauInstrucao);
                    if (data.nomePai) setNomePai(data.nomePai);
                    if (data.nomeMae) setNomeMae(data.nomeMae);
                    if (data.nacionalidade) setNacionalidade(data.nacionalidade);
                    if (data.naturalidadeCidade) setNaturalidadeCidade(data.naturalidadeCidade);
                    if (data.naturalidadeUf) setNaturalidadeUf(data.naturalidadeUf);
                    if (data.rgNumero) setRgNumero(data.rgNumero);
                    if (data.rgOrgaoEmissor) setRgOrgaoEmissor(data.rgOrgaoEmissor);
                    if (data.rgDataEmissao) setRgDataEmissao(data.rgDataEmissao);
                    if (data.rgUf) setRgUf(data.rgUf);
                    if (data.cnhNumero) setCnhNumero(data.cnhNumero);
                    if (data.cnhCategoria) setCnhCategoria(data.cnhCategoria);
                    if (data.cnhValidade) setCnhValidade(data.cnhValidade);
                    if (data.cnhUf) setCnhUf(data.cnhUf);
                    if (data.tituloEleitorNumero) setTituloEleitorNumero(data.tituloEleitorNumero);
                    if (data.tituloEleitorZona) setTituloEleitorZona(data.tituloEleitorZona);
                    if (data.tituloEleitorSecao) setTituloEleitorSecao(data.tituloEleitorSecao);
                    if (data.tituloEleitorUf) setTituloEleitorUf(data.tituloEleitorUf);
                    if (data.reservistaNumero) setReservistaNumero(data.reservistaNumero);
                    if (data.reservistaCategoria) setReservistaCategoria(data.reservistaCategoria);

                    // Preenche dependentes se retornados
                    const extractedDeps = data.dependents || data.dependentes;
                    if (extractedDeps && Array.isArray(extractedDeps)) {
                        setDependentes(prev => {
                            const cleanedPrev = prev.filter(d => d.nome.trim() !== "");
                            const extracted = extractedDeps.map((dep: any) => {
                                let parentesco = "Filho(a)";
                                const depParentesco = dep.parentesco || dep.relationship || "";
                                if (depParentesco) {
                                    const p = depParentesco.toLowerCase();
                                    if (p.includes("cônjuge") || p.includes("conjuge") || p.includes("espos")) {
                                        parentesco = "Cônjuge";
                                    } else if (p.includes("pai") || p.includes("mãe") || p.includes("mae")) {
                                        parentesco = "Mãe / Pai";
                                    } else if (p.includes("filh")) {
                                        parentesco = "Filho(a)";
                                    } else {
                                        parentesco = "Outros";
                                    }
                                }
                                let birthDateStr = "";
                                const depBirth = dep.dataNascimento || dep.birthDate || dep.data_nascimento || "";
                                if (depBirth) {
                                    try {
                                        const cleanDate = String(depBirth).split('T')[0];
                                        const parts = cleanDate.split('-');
                                        if (parts.length === 3 && parts[0].length === 4) {
                                            birthDateStr = cleanDate;
                                        } else {
                                            const d = new Date(String(depBirth));
                                            if (!isNaN(d.getTime())) {
                                                birthDateStr = d.toISOString().split('T')[0];
                                            }
                                        }
                                    } catch (e) {
                                        console.error(e);
                                    }
                                }
                                return {
                                    nome: dep.nome || dep.name || "",
                                    cpf: dep.cpf || "",
                                    dataNascimento: birthDateStr,
                                    parentesco,
                                    salarioFamilia: dep.salarioFamilia || dep.salario_familia || "Sim",
                                    irrf: dep.irrf || "Não"
                                };
                            });
                            return [...cleanedPrev, ...extracted];
                        });
                    }
            } catch (e) {
                console.error("Erro na extração IA genérica:", e);
                alert(`Erro de conexão ao processar documento: ${(e as any)?.message || e}`);
            } finally {
                setLoadingSlot(null);
            }
        };
        reader.readAsDataURL(file);
    };
    const handleDownloadFile = (fileData: string, fileName: string) => {
        const link = document.createElement("a");
        link.href = fileData;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
        <div className="space-y-6">
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
            <div className="space-y-4 px-1">
                
                {/* --- SEÇÃO 1: GERAL --- */}
                {currentStep === 1 && (
                    <>
                        {/* Tab: Dados Básicos */}
                        {currentTab === "dados_basicos" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                {/* Row 1 */}
                                <div className="space-y-1">
                                    <Label htmlFor="name" className="text-slate-700 font-medium">Nome</Label>
                                    <Input id="name" name="name" value={name} onChange={e => setName(e.target.value)} required placeholder="Nome do funcionário" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="nomeSocial" className="text-slate-700 font-medium">
                                        Nome social <span className="text-slate-400 font-normal italic">- opcional</span>
                                    </Label>
                                    <Input id="nomeSocial" value={nomeSocial} onChange={e => setNomeSocial(e.target.value)} placeholder="Nome social" />
                                </div>

                                {/* Row 2 */}
                                <div className="space-y-1">
                                    <Label htmlFor="cpf" className="text-slate-700 font-medium">CPF</Label>
                                    <Input id="cpf" name="cpf" value={cpf} onChange={e => setCpf(e.target.value)} required placeholder="000.000.000-00" />
                                </div>
                                <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100/80">
                                    <Label htmlFor="phone" className="text-slate-800 font-black">WhatsApp / Celular (Obrigatório para Assinatura)</Label>
                                    <Input id="phone" name="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" className="bg-white" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="roleId" className="text-slate-700 font-medium">
                                        Cargo <span className="text-slate-400 font-normal italic">- opcional</span>
                                    </Label>
                                    <Select name="roleId" value={roleId} onValueChange={setRoleId}>
                                        <SelectTrigger id="roleId">
                                            <SelectValue placeholder="Selecione o cargo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roles.map(r => (
                                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Row 3 */}
                                <div className="space-y-1">
                                    <Label htmlFor="funcao" className="text-slate-700 font-medium">
                                        Função <span className="text-slate-400 font-normal italic">- opcional</span>
                                    </Label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <Select value={funcao} onValueChange={setFuncao}>
                                                <SelectTrigger id="funcao">
                                                    <SelectValue placeholder="Selecione a função" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[160px]">
                                                    {localJobFunctions.map(f => (
                                                        <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button type="button" size="icon" variant="outline" onClick={handleAddJobFunction} className="h-9 w-9 shrink-0" title="Adicionar Função">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="matricula" className="text-slate-700 font-medium">
                                        Matrícula <span className="text-slate-400 font-normal italic">- opcional</span>
                                    </Label>
                                    <Input id="matricula" value={matricula} onChange={e => setMatrícula(e.target.value)} placeholder="Ex: 0142" />
                                </div>

                                {/* Row 4 */}
                                <div className="space-y-1">
                                    <Label htmlFor="companyId" className="text-slate-700 font-medium">
                                        Serviço (sede onde ficará alocado) <span className="text-slate-400 font-normal italic">- opcional</span>
                                    </Label>
                                    <Select name="companyId" value={companyId} onValueChange={setCompanyId}>
                                        <SelectTrigger id="companyId">
                                            <SelectValue placeholder="Selecione a empresa/cliente" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px]">
                                            {companies.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="departamento" className="text-slate-700 font-medium">
                                        Departamento <span className="text-slate-400 font-normal italic">- opcional</span>
                                    </Label>
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

                                {/* Row 5 */}
                                <div className="space-y-1">
                                    <Label htmlFor="centroCusto" className="text-slate-700 font-medium">
                                        Centro de custo <span className="text-slate-400 font-normal italic">- opcional</span>
                                    </Label>
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
                                <div className="space-y-1">
                                    <Label htmlFor="sindicato" className="text-slate-700 font-medium">
                                        Sindicato <span className="text-slate-400 font-normal italic">- opcional</span>
                                    </Label>
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
                            <div className="space-y-6">
                                {/* Grupo 1: Dados Contratuais */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Dados Contratuais</h4>
                                    <input type="hidden" name="type" value={type} />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <Label htmlFor="admissionDate" className="text-slate-700 font-medium">Data de Admissão</Label>
                                            <Input id="admissionDate" name="admissionDate" type="date" value={admissionDate} onChange={e => setAdmissionDate(e.target.value)} required />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="categoriaAdmissao" className="text-slate-700 font-medium">Categoria</Label>
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
                                            <Label htmlFor="vinculoEmpregaticio" className="text-slate-700 font-medium">Vínculo Empregatício</Label>
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
                                            <Label htmlFor="situationId" className="text-slate-700 font-medium">Situação Atual</Label>
                                            <Select name="situationId" value={situationId} onValueChange={setSituationId} required>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione a situação" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {situations.map(s => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="experienciaDias1" className="text-slate-700 font-medium">Dias do 1º Período</Label>
                                            <Input id="experienciaDias1" type="number" value={experienciaDias1} onChange={e => setExperienciaDias1(e.target.value)} placeholder="Ex: 45" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="experienciaDias2" className="text-slate-700 font-medium">Dias de Prorrogação (2º Período)</Label>
                                            <Input id="experienciaDias2" type="number" value={experienciaDias2} onChange={e => setExperienciaDias2(e.target.value)} placeholder="Ex: 45" />
                                        </div>
                                    </div>
                                </div>

                                {/* Grupo 2: Posto e Horário */}
                                <div className="space-y-3 border-t pt-4">
                                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Alocação e Horário</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1 col-span-2">
                                            <Label htmlFor="postoId" className="text-slate-700 font-medium">Vincular Posto de Trabalho</Label>
                                            <Select name="postoId" value={currentPostoId} onValueChange={handlePostoChangeInternal}>
                                                <SelectTrigger id="postoId">
                                                    <SelectValue placeholder="Selecione o posto de trabalho..." />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[200px]">
                                                    <SelectItem value="ROTATIVO_VIRTUAL" className="font-semibold text-blue-600">
                                                        🔄 ROTATIVO (Transição / Reserva Técnica)
                                                    </SelectItem>
                                                    {postos.map(p => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                            {p.client?.name} - {p.role?.name} ({p.schedule || "N/A"})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="escalaHorario" className="text-slate-700 font-medium">Escala / Tipo de Escala</Label>
                                            <Input id="escalaHorario" value={escalaHorario} onChange={e => setEscalaHorario(e.target.value)} placeholder="Ex: 12x36 ou 5x2" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="jornadaHoras" className="text-slate-700 font-medium">Jornada de Trabalho (Horário)</Label>
                                            <Input id="jornadaHoras" value={jornadaHoras} onChange={e => setJornadaHoras(e.target.value)} placeholder="Ex: 07:00 às 19:00" />
                                        </div>
                                    </div>
                                </div>

                                {/* Grupo 3: Remuneração e Benefícios */}
                                <div className="space-y-3 border-t pt-4">
                                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Remuneração e Benefícios</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <Label htmlFor="workload" className="text-slate-700 font-medium">Carga Horária Mensal</Label>
                                            <Input id="workload" name="workload" type="number" value={workload} onChange={e => setWorkload(e.target.value)} required />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="salary" className="text-slate-700 font-medium">Salário Base (R$)</Label>
                                            <Input id="salary" name="salary" type="number" step="0.01" value={salary} onChange={e => setSalary(e.target.value)} required />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="insalubridade" className="text-slate-700 font-medium">Insalubridade (R$)</Label>
                                            <Input id="insalubridade" name="insalubridade" type="number" step="0.01" value={insalubridade} onChange={e => setInsalubridade(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="periculosidade" className="text-slate-700 font-medium">Periculosidade (R$)</Label>
                                            <Input id="periculosidade" name="periculosidade" type="number" step="0.01" value={periculosidade} onChange={e => setPericulosidade(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="gratificacao" className="text-slate-700 font-medium">Gratificação CCT (R$)</Label>
                                            <Input id="gratificacao" name="gratificacao" type="number" step="0.01" value={gratificacao} onChange={e => setGratificacao(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="outrosAdicionais" className="text-slate-700 font-medium">Outros Adicionais (R$)</Label>
                                            <Input id="outrosAdicionais" name="outrosAdicionais" type="number" step="0.01" value={outrosAdicionais} onChange={e => setOutrosAdicionais(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="dependentsCount" className="text-slate-700 font-medium">Qtd Dependentes/Filhos</Label>
                                            <Input id="dependentsCount" name="dependentsCount" type="number" step="1" value={dependentsCount} onChange={e => setDependentsCount(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="ajudaCusto" className="text-slate-700 font-medium">Ajuda de Custo (R$)</Label>
                                            <Input id="ajudaCusto" name="ajudaCusto" type="number" step="0.01" value={ajudaCusto} onChange={e => setAjudaCusto(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="adicionalViagem" className="text-slate-700 font-medium">Adicional de Viagem (R$)</Label>
                                            <Input id="adicionalViagem" name="adicionalViagem" type="number" step="0.01" value={adicionalViagem} onChange={e => setAdicionalViagem(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="valeAlimentacao" className="text-slate-700 font-medium">Vale Alimentação (R$)</Label>
                                            <Input id="valeAlimentacao" name="valeAlimentacao" type="number" step="0.01" value={valeAlimentacao} onChange={e => setValeAlimentacao(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor="vaPaymentMethod" className="text-slate-700 font-medium">Meio de Depósito do VA</Label>
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
                                                            className="bg-orange-655 hover:bg-orange-700 text-white rounded h-8 text-xs px-2"
                                                        >
                                                            Add
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <Select value={vaPaymentMethod} onValueChange={setVaPaymentMethod}>
                                                    <SelectTrigger id="vaPaymentMethod" className="h-9 rounded-xl bg-white border-slate-200">
                                                        <SelectValue placeholder="Selecione o meio..." />
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

                                        <div className="space-y-1">
                                            <Label htmlFor="vtOptIn" className="text-slate-700 font-medium">Optante por Vale Transporte (VT)?</Label>
                                            <Select value={vtOptIn ? "true" : "false"} onValueChange={val => setVtOptIn(val === "true")}>
                                                <SelectTrigger id="vtOptIn">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="true">Sim (Optante por VT)</SelectItem>
                                                    <SelectItem value="false">Não (Não Optante)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {vtOptIn && (
                                            <>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <Label htmlFor="valeTransporte" className="text-slate-700 font-medium">Vale Transporte 1 (R$/Dia)</Label>
                                                        <Input id="valeTransporte" name="valeTransporte" type="number" step="0.01" value={valeTransporte} onChange={e => setValeTransporte(e.target.value)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor="valeTransporte2" className="text-slate-700 font-medium">Vale Transporte 2 (R$/Dia)</Label>
                                                        <Input id="valeTransporte2" name="valeTransporte2" type="number" step="0.01" value={valeTransporte2} onChange={e => setValeTransporte2(e.target.value)} />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <Label htmlFor="vtPaymentMethod" className="text-slate-700 font-medium">Meio de Depósito do VT 1</Label>
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
                                                                    className="bg-orange-655 hover:bg-orange-700 text-white rounded h-8 text-xs px-2"
                                                                >
                                                                    Add
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <Select value={vtPaymentMethod} onValueChange={setVtPaymentMethod}>
                                                                <SelectTrigger id="vtPaymentMethod" className="h-9 rounded-xl bg-white border-slate-200">
                                                                    <SelectValue placeholder="Selecione o meio..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {vtOptions.map(opt => (
                                                                        <SelectItem key={opt} value={opt}>
                                                                            {opt === "PIX" ? "Depósito em PIX (Reserva)" : opt}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>

                                                            {/* Campos Dinâmicos do Cartão / Chave para VT 1 */}
                                                            {vtPaymentMethod === "Urbs" ? (
                                                                <div className="grid grid-cols-2 gap-3 pt-1">
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs font-semibold text-slate-600">Nº Cartão Urbs (CQ/CT/NF)</Label>
                                                                        <Input 
                                                                            value={urbsCqCtNf} 
                                                                            onChange={e => setUrbsCqCtNf(e.target.value)} 
                                                                            placeholder="Ex: 65587807795766533" 
                                                                            className="h-9 rounded-xl border-slate-200 bg-white text-xs" 
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs font-semibold text-slate-600">Código SIC Urbs (Matrícula)</Label>
                                                                        <Input 
                                                                            value={urbsSic} 
                                                                            onChange={e => setUrbsSic(e.target.value)} 
                                                                            placeholder="Ex: 00064599439" 
                                                                            className="h-9 rounded-xl border-slate-200 bg-white text-xs" 
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ) : vtPaymentMethod === "PIX" ? (
                                                                <div className="space-y-1 pt-1">
                                                                    <Label className="text-xs font-semibold text-slate-600">Chave PIX para Depósito do VT 1</Label>
                                                                    <Input 
                                                                        value={chavePix} 
                                                                        onChange={e => setChavePix(e.target.value)} 
                                                                        placeholder="Ex: CPF, Telefone, E-mail ou Chave Aleatória" 
                                                                        className="h-9 rounded-xl border-slate-200 bg-white text-xs" 
                                                                    />
                                                                    <p className="text-[10px] text-slate-400">Sincronizada automaticamente com os dados bancários.</p>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-1 pt-1">
                                                                    <Label className="text-xs font-semibold text-slate-600">
                                                                        {vtPaymentMethod.toLowerCase().includes("metrocard") ? "Nº do Cartão Metrocard" : `Nº do Cartão / Detalhes (${vtPaymentMethod})`}
                                                                    </Label>
                                                                    <Input 
                                                                        value={vtCustomPaymentDetails} 
                                                                        onChange={e => setVtCustomPaymentDetails(e.target.value)} 
                                                                        placeholder={vtPaymentMethod.toLowerCase().includes("metrocard") ? "Ex: 01.12.00289123-4" : "Número do cartão de transporte ou identificador..."} 
                                                                        className="h-9 rounded-xl border-slate-200 bg-white text-xs" 
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <Label htmlFor="vtPaymentMethod2" className="text-slate-700 font-medium">Meio de Depósito do VT 2</Label>
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
                                                                    className="bg-orange-655 hover:bg-orange-700 text-white rounded h-8 text-xs px-2"
                                                                >
                                                                    Add
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <Select value={vtPaymentMethod2} onValueChange={setVtPaymentMethod2}>
                                                                <SelectTrigger id="vtPaymentMethod2" className="h-9 rounded-xl bg-white border-slate-200">
                                                                    <SelectValue placeholder="Selecione o meio..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {vtOptions2.map(opt => (
                                                                        <SelectItem key={opt} value={opt}>
                                                                            {opt === "PIX" ? "Depósito em PIX (Reserva)" : opt}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>

                                                            {/* Campos Dinâmicos do Cartão / Chave para VT 2 */}
                                                            {vtPaymentMethod2 === "Urbs" ? (
                                                                <div className="grid grid-cols-2 gap-3 pt-1">
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs font-semibold text-slate-600">Nº Cartão Urbs (CQ/CT/NF)</Label>
                                                                        <Input 
                                                                            value={urbsCqCtNf} 
                                                                            onChange={e => setUrbsCqCtNf(e.target.value)} 
                                                                            placeholder="Ex: 65587807795766533" 
                                                                            className="h-9 rounded-xl border-slate-200 bg-white text-xs" 
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs font-semibold text-slate-600">Código SIC Urbs (Matrícula)</Label>
                                                                        <Input 
                                                                            value={urbsSic} 
                                                                            onChange={e => setUrbsSic(e.target.value)} 
                                                                            placeholder="Ex: 00064599439" 
                                                                            className="h-9 rounded-xl border-slate-200 bg-white text-xs" 
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ) : vtPaymentMethod2 === "PIX" ? (
                                                                <div className="space-y-1 pt-1">
                                                                    <Label className="text-xs font-semibold text-slate-600">Chave PIX (VT 2)</Label>
                                                                    <Input 
                                                                        value={chavePix} 
                                                                        onChange={e => setChavePix(e.target.value)} 
                                                                        placeholder="Ex: CPF, Telefone, E-mail ou Chave Aleatória" 
                                                                        className="h-9 rounded-xl border-slate-200 bg-white text-xs" 
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-1 pt-1">
                                                                    <Label className="text-xs font-semibold text-slate-600">
                                                                        {vtPaymentMethod2.toLowerCase().includes("metrocard") ? "Nº do Cartão Metrocard (VT 2)" : `Nº do Cartão / Detalhes (${vtPaymentMethod2})`}
                                                                    </Label>
                                                                    <Input 
                                                                        value={vtCustomPaymentDetails2} 
                                                                        onChange={e => setVtCustomPaymentDetails2(e.target.value)} 
                                                                        placeholder={vtPaymentMethod2.toLowerCase().includes("metrocard") ? "Ex: 01.12.00289123-4" : "Número do cartão de transporte ou identificador..."} 
                                                                        className="h-9 rounded-xl border-slate-200 bg-white text-xs" 
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}

                                        {/* Sobrecargas de Porcentagem de Desconto CCT */}
                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                            <div className="space-y-1">
                                                <Label htmlFor="vtDiscountPercentage" className="text-slate-700 font-medium">Desconto VT Sobrecarga (%)</Label>
                                                <Input 
                                                    id="vtDiscountPercentage" 
                                                    name="vtDiscountPercentage" 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={vtOptIn ? vtDiscountPercentage : ""} 
                                                    onChange={e => setVtDiscountPercentage(e.target.value)} 
                                                    placeholder="Padrão do Posto (6%)" 
                                                    disabled={!vtOptIn} 
                                                    className="h-9 rounded-xl border-slate-200 bg-white disabled:bg-slate-50" 
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="vaDiscountPercentage" className="text-slate-700 font-medium">Desconto VA Sobrecarga (%)</Label>
                                                <Input 
                                                    id="vaDiscountPercentage" 
                                                    name="vaDiscountPercentage" 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={vaDiscountPercentage} 
                                                    onChange={e => setVaDiscountPercentage(e.target.value)} 
                                                    placeholder="Padrão do Posto (20%)" 
                                                    className="h-9 rounded-xl border-slate-200 bg-white" 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Anexos */}
                        {currentTab === "anexos" && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <Label className="text-sm font-bold text-slate-800">Documentos de Admissão</Label>
                                        <p className="text-[10px] text-slate-500 font-medium">Faça upload de cada documento. A IA processará os dados para preencher o cadastro automaticamente.</p>
                                    </div>
                                    <div className="relative">
                                        <Button type="button" variant="outline" size="sm" className="text-xs font-bold gap-1 rounded-xl h-8">
                                            <Plus className="w-3.5 h-3.5" /> Adicionar Outro Documento
                                            <input 
                                                type="file" 
                                                accept="image/*,application/pdf" 
                                                className="absolute inset-0 opacity-0 cursor-pointer" 
                                                onChange={e => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleUploadGeneric(file);
                                                    e.target.value = "";
                                                }}
                                            />
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {[
                                        { key: "cnh", label: "CNH", description: "Carteira Nacional de Habilitação" },
                                        { key: "rg", label: "Identidade (RG)", description: "Cédula de Identidade" },
                                        { key: "aso", label: "ASO", description: "Atestado de Saúde Ocupacional" },
                                        { key: "endereco", label: "Comprovante de endereço", description: "Conta recente de consumo" },
                                        { key: "titulo", label: "Título de Eleitor", description: "Título Eleitoral" },
                                        { key: "pis", label: "PIS", description: "Cadastro PIS/PASEP" },
                                        { key: "reservista", label: "Certificado de Reservista", description: "Certificado de Reservista ou Dispensa" },
                                        { key: "comprovante_escolar", label: "Comprovante Escolar", description: "Declaração de escolaridade ou diploma" },
                                        { key: "certidao_filhos", label: "Certidão de nascimento de filhos", description: "Certidão de dependentes" }
                                    ].map(slot => {
                                        const uploadedFile = attachments.find(a => a.name === slot.label);
                                        const isLoading = loadingSlot === slot.key;

                                        return (
                                            <div 
                                                key={slot.key} 
                                                className={`border rounded-2xl p-4 flex items-center justify-between gap-4 transition-all ${
                                                    uploadedFile 
                                                        ? "border-green-200 bg-green-50/20" 
                                                        : "border-slate-100 bg-slate-50/40 hover:bg-slate-50/80"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                        uploadedFile 
                                                            ? "bg-green-100 text-green-700" 
                                                            : "bg-slate-100 text-slate-500"
                                                    }`}>
                                                        {uploadedFile ? (
                                                            <CheckCircle2 className="w-5 h-5" />
                                                        ) : (
                                                            <FileText className="w-5 h-5" />
                                                        )}
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-xs font-bold text-slate-800">{slot.label}</span>
                                                        <p className="text-[10px] text-slate-400 font-medium leading-none">
                                                            {uploadedFile 
                                                                ? `Arquivo: ${uploadedFile.fileName}` 
                                                                : slot.description
                                                            }
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    {isLoading ? (
                                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 rounded-xl text-[10px] font-bold">
                                                            <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                                            IA Lendo...
                                                        </div>
                                                    ) : uploadedFile ? (
                                                        <div className="flex items-center gap-1">
                                                            <Button 
                                                                type="button" 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                title="Visualizar / Baixar"
                                                                onClick={() => handleDownloadFile(uploadedFile.fileData, uploadedFile.fileName)}
                                                                className="h-8 w-8 text-slate-500 hover:text-blue-600 rounded-xl"
                                                            >
                                                                <Download className="w-4 h-4" />
                                                            </Button>
                                                            <Button 
                                                                type="button" 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                title="Excluir"
                                                                onClick={() => setAttachments(prev => prev.filter(a => a.name !== slot.label))}
                                                                className="h-8 w-8 text-slate-500 hover:text-red-600 rounded-xl"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                            <div className="relative">
                                                                <Button 
                                                                    type="button" 
                                                                    variant="outline" 
                                                                    size="sm" 
                                                                    className="text-[10px] font-bold h-8 rounded-xl"
                                                                >
                                                                    Substituir
                                                                    <input 
                                                                        type="file" 
                                                                        accept="image/*,application/pdf" 
                                                                        className="absolute inset-0 opacity-0 cursor-pointer" 
                                                                        onChange={e => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file) handleUploadSlot(slot.key, slot.label, file);
                                                                            e.target.value = "";
                                                                        }}
                                                                    />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="relative">
                                                            <Button 
                                                                type="button" 
                                                                variant="outline" 
                                                                size="sm" 
                                                                className="text-[10px] font-bold h-8 rounded-xl gap-1"
                                                            >
                                                                <UploadCloud className="w-3.5 h-3.5" />
                                                                Upload
                                                                <input 
                                                                    type="file" 
                                                                    accept="image/*,application/pdf" 
                                                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                                                    onChange={e => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) handleUploadSlot(slot.key, slot.label, file);
                                                                        e.target.value = "";
                                                                    }}
                                                                />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {attachments.filter(a => ![
                                    "CNH", "Identidade (RG)", "ASO", "Comprovante de endereço", "Título de Eleitor", "PIS", "Certidão de nascimento de filhos", "Comprovante Escolar", "Certificado de Reservista"
                                ].includes(a.name)).length > 0 && (
                                    <div className="space-y-3 border-t pt-4 mt-4">
                                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Outros Anexos</Label>
                                        <div className="space-y-3">
                                            {attachments.filter(a => ![
                                                "CNH", "Identidade (RG)", "ASO", "Comprovante de endereço", "Título de Eleitor", "PIS", "Certidão de nascimento de filhos", "Comprovante Escolar", "Certificado de Reservista"
                                            ].includes(a.name)).map((extraDoc, i) => (
                                                <div key={i} className="border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-4 bg-slate-50/20">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 text-slate-500">
                                                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <span className="text-xs font-bold text-slate-800">{extraDoc.name}</span>
                                                            <p className="text-[10px] text-slate-400 font-medium leading-none">
                                                                {extraDoc.fileName}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {loadingSlot === `generic-${extraDoc.name}` ? (
                                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 rounded-xl text-[10px] font-bold">
                                                                <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                                                IA Lendo...
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <Button 
                                                                    type="button" 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    title="Visualizar / Baixar"
                                                                    onClick={() => handleDownloadFile(extraDoc.fileData, extraDoc.fileName)}
                                                                    className="h-8 w-8 text-slate-500 hover:text-blue-600 rounded-xl"
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                </Button>
                                                                <Button 
                                                                    type="button" 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    title="Excluir"
                                                                    onClick={() => setAttachments(prev => prev.filter(a => a.name !== extraDoc.name))}
                                                                    className="h-8 w-8 text-slate-500 hover:text-red-600 rounded-xl"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
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

                        {/* Tab: Pagamento */}
                        {currentTab === "pagamento" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="formaPagamento">Forma de Pagamento</Label>
                                    <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                                        <SelectTrigger id="formaPagamento">
                                            <SelectValue placeholder="Selecione a forma" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                                            <SelectItem value="CHEQUE">Cheque</SelectItem>
                                            <SelectItem value="CREDITO_CONTA">Crédito em Conta</SelectItem>
                                            <SelectItem value="PIX">PIX</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="tipoChavePix">Tipo de Chave PIX</Label>
                                    <Select value={tipoChavePix} onValueChange={setTipoChavePix}>
                                        <SelectTrigger id="tipoChavePix">
                                            <SelectValue placeholder="Selecione o tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CPF">CPF</SelectItem>
                                            <SelectItem value="CELULAR">Celular</SelectItem>
                                            <SelectItem value="EMAIL">E-mail</SelectItem>
                                            <SelectItem value="CHAVE_ALEATORIA">Chave Aleatória</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <Label htmlFor="chavePix">Chave PIX</Label>
                                    <Input id="chavePix" value={chavePix} onChange={e => setChavePix(e.target.value)} placeholder="Ex: CPF, Telefone, E-mail ou Chave Aleatória" />
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

            {/* Hidden inputs para garantir a serialização completa de todos os campos do wizard no FormData */}
            <input type="hidden" name="name" value={name || ""} />
            <input type="hidden" name="cpf" value={cpf || ""} />
            <input type="hidden" name="roleId" value={roleId || ""} />
            <input type="hidden" name="companyId" value={companyId || ""} />
            <input type="hidden" name="type" value={type || "Efetivo"} />
            <input type="hidden" name="status" value={status || "Ativo"} />
            <input type="hidden" name="situationId" value={situationId || ""} />
            <input type="hidden" name="admissionDate" value={admissionDate || ""} />
            <input type="hidden" name="salary" value={salary || "0"} />
            <input type="hidden" name="insalubridade" value={insalubridade || "0"} />
            <input type="hidden" name="periculosidade" value={periculosidade || "0"} />
            <input type="hidden" name="gratificacao" value={gratificacao || "0"} />
            <input type="hidden" name="outrosAdicionais" value={outrosAdicionais || "0"} />
            <input type="hidden" name="dependentsCount" value={dependentsCount || "0"} />
            <input type="hidden" name="ajudaCusto" value={ajudaCusto || "0"} />
            <input type="hidden" name="adicionalViagem" value={adicionalViagem || "0"} />
            <input type="hidden" name="workload" value={workload || "220"} />
            <input type="hidden" name="valeAlimentacao" value={valeAlimentacao || "0"} />
            <input type="hidden" name="valeTransporte" value={valeTransporte || "0"} />
            <input type="hidden" name="valeTransporte2" value={valeTransporte2 || "0"} />
            <input type="hidden" name="vtOptIn" value={vtOptIn ? "true" : "false"} />
            <input type="hidden" name="vtPaymentMethod" value={vtPaymentMethod || "Metrocard Metropolitana"} />
            <input type="hidden" name="vtPaymentMethod2" value={vtPaymentMethod2 || "Urbs"} />
            <input type="hidden" name="vtCustomPaymentDetails" value={vtCustomPaymentDetails || ""} />
            <input type="hidden" name="vtCustomPaymentDetails2" value={vtCustomPaymentDetails2 || ""} />
            <input type="hidden" name="urbsSic" value={urbsSic || ""} />
            <input type="hidden" name="urbsCqCtNf" value={urbsCqCtNf || ""} />
            <input type="hidden" name="vaPaymentMethod" value={vaPaymentMethod || "Cartão Caju"} />
            <input type="hidden" name="vaCustomPaymentDetails" value={vaCustomPaymentDetails || ""} />
            <input type="hidden" name="vtDiscountPercentage" value={vtDiscountPercentage || ""} />
            <input type="hidden" name="vaDiscountPercentage" value={vaDiscountPercentage || ""} />
            <input type="hidden" name="birthDate" value={birthDate || ""} />
            <input type="hidden" name="gender" value={gender || ""} />
            <input type="hidden" name="address" value={address || ""} />
            <input type="hidden" name="phone" value={phone || ""} />
            <input type="hidden" name="email" value={email || ""} />
            <input type="hidden" name="postoId" value={currentPostoId || ""} />
        </div>
    );
}
