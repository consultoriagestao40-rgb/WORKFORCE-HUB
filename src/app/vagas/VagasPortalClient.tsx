"use client";

import { useState } from "react";
import { 
    Briefcase, MapPin, Building2, Calendar, Sparkles, Search, 
    DollarSign, Clock, ShieldCheck, CheckCircle2, Loader2, Upload, FileText, ArrowRight, X, AlertCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { createPublicCandidate } from "@/actions/recruitment";

interface VacancyItem {
    id: string;
    title: string;
    priority?: string;
    roleName: string;
    companyName: string;
    clientName?: string;
    location?: string;
    baseSalary?: number;
    valeAlimentacao?: number;
    valeTransporte?: number;
    schedule?: string;
    plannedStartDate?: string | null;
    description?: string;
    reqGender?: string | null;
    reqExperience?: string | null;
    reqKnowledge?: string | null;
    reqAgeMin?: number | null;
    reqAgeMax?: number | null;
    customRequirements?: any;
    createdAt: string;
}

interface VagasPortalClientProps {
    initialVacancies: VacancyItem[];
}

export function VagasPortalClient({ initialVacancies }: VagasPortalClientProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<"ALL" | "URGENT">("ALL");

    // Modal state for viewing details
    const [selectedVacancy, setSelectedVacancy] = useState<VacancyItem | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Modal state for applying directly
    const [applyingVacancy, setApplyingVacancy] = useState<VacancyItem | null>(null);
    const [isApplyOpen, setIsApplyOpen] = useState(false);

    // Form state for application
    const [applicantName, setApplicantName] = useState("");
    const [applicantPhone, setApplicantPhone] = useState("");
    const [applicantEmail, setApplicantEmail] = useState("");
    const [fileName, setFileName] = useState("");
    const [fileBase64, setFileBase64] = useState<string | null>(null);
    const [fileMimeType, setFileMimeType] = useState<string | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    // Filter vacancies based on search term & priority
    const filteredVacancies = initialVacancies.filter(v => {
        if (selectedPriorityFilter === "URGENT" && v.priority !== "URGENTE") {
            return false;
        }

        if (!searchTerm.trim()) return true;

        const term = searchTerm.toLowerCase();
        return (
            v.title.toLowerCase().includes(term) ||
            v.roleName.toLowerCase().includes(term) ||
            v.companyName.toLowerCase().includes(term) ||
            (v.clientName && v.clientName.toLowerCase().includes(term)) ||
            (v.location && v.location.toLowerCase().includes(term))
        );
    });

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length > 11) value = value.substring(0, 11);
        
        if (value.length > 6) {
            value = `(${value.substring(0, 2)}) ${value.substring(2, 7)}-${value.substring(7)}`;
        } else if (value.length > 2) {
            value = `(${value.substring(0, 2)}) ${value.substring(2)}`;
        } else if (value.length > 0) {
            value = `(${value}`;
        }
        
        setApplicantPhone(value);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 8 * 1024 * 1024) {
                toast.error("O arquivo deve ter menos de 8MB.");
                return;
            }

            setFileName(file.name);
            setFileMimeType(file.type || "application/pdf");

            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                const base64 = result.split(",")[1];
                setFileBase64(base64);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleOpenApply = (v: VacancyItem) => {
        setApplyingVacancy(v);
        setApplicantName("");
        setApplicantPhone("");
        setApplicantEmail("");
        setFileName("");
        setFileBase64(null);
        setFileMimeType(null);
        setSubmitSuccess(false);
        setIsApplyOpen(true);
    };

    const handleSubmitApplication = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!applyingVacancy) return;

        if (!applicantName.trim()) {
            toast.error("Insira seu nome completo.");
            return;
        }

        if (!applicantPhone.trim()) {
            toast.error("Insira seu telefone/WhatsApp de contato.");
            return;
        }

        if (!fileBase64) {
            toast.error("Anexe seu currículo em PDF ou Imagem.");
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await createPublicCandidate({
                name: applicantName,
                email: applicantEmail,
                phone: applicantPhone,
                vacancyId: applyingVacancy.id,
                fileBase64,
                fileMimeType: fileMimeType || "application/pdf"
            });

            if (res.success) {
                setSubmitSuccess(true);
                toast.success("Candidatura enviada com sucesso!");
            } else {
                toast.error("Erro ao enviar candidatura. Tente novamente.");
            }
        } catch (e: any) {
            toast.error(e.message || "Erro de conexão ao enviar candidatura.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/70 py-6 sm:py-10 px-4 sm:px-6 lg:px-8 font-sans antialiased">
            <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
                
                {/* Header Section */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-sm text-center space-y-4 relative overflow-hidden">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        Portal Oficial de Oportunidades & Carreiras
                    </div>

                    <div className="space-y-2 max-w-2xl mx-auto">
                        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                            Vagas em Aberto
                        </h1>
                        <p className="text-sm sm:text-base text-slate-500 font-medium">
                            Explore nossas oportunidades de trabalho disponíveis, confira os requisitos e envie seu currículo diretamente para nossa equipe de RH.
                        </p>
                    </div>

                    {/* Search & Filter Bar */}
                    <div className="pt-4 max-w-xl mx-auto flex flex-col sm:flex-row gap-3 items-center">
                        <div className="relative flex-1 w-full">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                            <Input
                                placeholder="Buscar por cargo, palavra-chave ou local..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-11 pl-10 rounded-2xl border-slate-200 bg-slate-50/50 text-xs sm:text-sm focus:bg-white w-full"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto shrink-0">
                            <Button
                                type="button"
                                variant={selectedPriorityFilter === "ALL" ? "default" : "outline"}
                                onClick={() => setSelectedPriorityFilter("ALL")}
                                className="h-11 rounded-2xl text-xs font-bold flex-1 sm:flex-initial"
                            >
                                Todas ({initialVacancies.length})
                            </Button>
                            <Button
                                type="button"
                                variant={selectedPriorityFilter === "URGENT" ? "destructive" : "outline"}
                                onClick={() => setSelectedPriorityFilter("URGENT")}
                                className="h-11 rounded-2xl text-xs font-bold flex-1 sm:flex-initial"
                            >
                                Urgentes ({initialVacancies.filter(v => v.priority === 'URGENTE').length})
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Counter & Status */}
                <div className="flex items-center justify-between px-2 text-xs text-slate-500 font-medium">
                    <span>
                        Exibindo <strong>{filteredVacancies.length}</strong> de <strong>{initialVacancies.length}</strong> vagas ativas recebendo candidaturas
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Inscrições Abertas
                    </span>
                </div>

                {/* Vacancies Grid */}
                {filteredVacancies.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3 shadow-sm">
                        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto" />
                        <h3 className="text-lg font-bold text-slate-800">Nenhuma vaga encontrada</h3>
                        <p className="text-xs text-slate-500">Tente ajustar seus termos de busca ou filtros de pesquisa.</p>
                        <Button variant="outline" onClick={() => { setSearchTerm(""); setSelectedPriorityFilter("ALL"); }} className="rounded-xl text-xs font-bold mt-2">
                            Limpar Filtros
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        {filteredVacancies.map((v) => {
                            const isUrgent = v.priority === "URGENTE";

                            return (
                                <div 
                                    key={v.id}
                                    className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between space-y-5"
                                >
                                    <div className="space-y-3">
                                        {/* Top Badges */}
                                        <div className="flex items-center justify-between gap-2">
                                            <Badge variant="outline" className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${isUrgent ? "bg-red-50 text-red-700 border-red-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>
                                                {isUrgent ? "⚡ Urgente" : "Oportunidade"}
                                            </Badge>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                Publicada em {new Date(v.createdAt).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>

                                        {/* Title & Role */}
                                        <div className="space-y-1">
                                            <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-snug break-words">
                                                {v.title}
                                            </h2>
                                            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                                                <span className="flex items-center gap-1 text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl">
                                                    <Briefcase className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                    {v.roleName}
                                                </span>
                                                {v.companyName && (
                                                    <span className="flex items-center gap-1 text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl">
                                                        <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                        {v.companyName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Location & Benefits summary */}
                                        <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                                            {v.location && (
                                                <div className="flex items-center gap-2 text-slate-700">
                                                    <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                                                    <span className="truncate">{v.location}</span>
                                                </div>
                                            )}

                                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                                {v.baseSalary ? (
                                                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1">
                                                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.baseSalary)}
                                                    </span>
                                                ) : null}

                                                {v.valeAlimentacao ? (
                                                    <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-xl font-semibold">
                                                        VA: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.valeAlimentacao)}
                                                    </span>
                                                ) : null}

                                                {v.valeTransporte ? (
                                                    <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-xl font-semibold">
                                                        VT Incluído
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="grid grid-cols-2 gap-2.5 pt-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => { setSelectedVacancy(v); setIsDetailsOpen(true); }}
                                            className="h-11 rounded-2xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
                                        >
                                            Ver Detalhes
                                        </Button>
                                        <Button
                                            onClick={() => handleOpenApply(v)}
                                            className="h-11 rounded-2xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                                        >
                                            Se Candidatar
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer */}
                <div className="text-center text-xs text-slate-400 pt-8 border-t border-slate-200/80 flex items-center justify-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                    <span>Plataforma Oficial de Vagas e Recrutamento &bull; JVS Facilities 2026</span>
                </div>
            </div>

            {/* Modal 1: Vacancy Details Modal */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-lg rounded-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
                    {selectedVacancy && (
                        <>
                            <DialogHeader className="space-y-2 border-b pb-4">
                                <Badge variant="outline" className="w-fit bg-indigo-50 text-indigo-700 border-indigo-200">
                                    {selectedVacancy.roleName}
                                </Badge>
                                <DialogTitle className="text-xl font-black text-slate-900 leading-snug">
                                    {selectedVacancy.title}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-slate-500 font-medium flex items-center gap-2">
                                    <Building2 className="w-3.5 h-3.5" /> {selectedVacancy.companyName}
                                    {selectedVacancy.location && (
                                        <> &bull; <MapPin className="w-3.5 h-3.5" /> {selectedVacancy.location}</>
                                    )}
                                </DialogDescription>
                            </DialogHeader>

                            {/* Details Content */}
                            <div className="space-y-4 text-xs">
                                {/* Remuneração */}
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Remuneração & Benefícios</span>
                                    <div className="grid grid-cols-2 gap-2 text-slate-800 font-bold">
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-normal block">Salário Base</span>
                                            <span className="text-emerald-700 text-sm font-black">
                                                {selectedVacancy.baseSalary 
                                                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedVacancy.baseSalary)
                                                    : "A Combinar"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-normal block">Vale Alimentação</span>
                                            <span className="text-indigo-700 text-sm font-black">
                                                {selectedVacancy.valeAlimentacao 
                                                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedVacancy.valeAlimentacao)
                                                    : "Conforme CCT"}
                                            </span>
                                        </div>
                                    </div>
                                    {selectedVacancy.schedule && (
                                        <div className="pt-2 border-t border-slate-200/60 text-slate-600 font-medium">
                                            <span className="font-bold text-slate-800">Escala: </span>
                                            {selectedVacancy.schedule}
                                        </div>
                                    )}
                                </div>

                                {/* Requisitos */}
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Requisitos da Vaga</span>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-white border rounded-xl p-2.5">
                                            <span className="text-[10px] text-slate-400 font-bold block">Gênero</span>
                                            <span className="font-semibold text-slate-800">{selectedVacancy.reqGender || "Indiferente"}</span>
                                        </div>
                                        <div className="bg-white border rounded-xl p-2.5">
                                            <span className="text-[10px] text-slate-400 font-bold block">Experiência</span>
                                            <span className="font-semibold text-slate-800">{selectedVacancy.reqExperience || "Não exigida"}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Descrição */}
                                {selectedVacancy.description && (
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Descrição da Função</span>
                                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-slate-700 leading-relaxed whitespace-pre-wrap">
                                            {selectedVacancy.description}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action */}
                            <Button
                                onClick={() => { setIsDetailsOpen(false); handleOpenApply(selectedVacancy); }}
                                className="w-full h-12 rounded-2xl text-sm font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                            >
                                Candidatar-se a esta Vaga <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal 2: Direct Candidate Application Modal */}
            <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
                <DialogContent className="max-w-md rounded-3xl p-6 space-y-4">
                    {applyingVacancy && (
                        <>
                            {submitSuccess ? (
                                <div className="text-center space-y-4 py-4">
                                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-black text-slate-900">Candidatura Enviada!</h3>
                                        <p className="text-xs text-slate-600">
                                            Obrigado, <strong>{applicantName}</strong>! Sua candidatura para a vaga <strong>{applyingVacancy.title}</strong> foi recebida pela nossa equipe.
                                        </p>
                                    </div>
                                    <Button onClick={() => setIsApplyOpen(false)} className="w-full rounded-2xl font-bold bg-slate-900 text-white h-11">
                                        Fechar
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <DialogHeader className="space-y-1 border-b pb-3">
                                        <Badge variant="outline" className="w-fit bg-indigo-50 text-indigo-700 border-indigo-200">
                                            Inscrição Rápida
                                        </Badge>
                                        <DialogTitle className="text-lg font-black text-slate-900 leading-snug">
                                            {applyingVacancy.title}
                                        </DialogTitle>
                                        <DialogDescription className="text-xs text-slate-500">
                                            Preencha seus dados de contato e anexe seu currículo.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <form onSubmit={handleSubmitApplication} className="space-y-3 text-xs">
                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-700">Nome Completo *</Label>
                                            <Input
                                                placeholder="Ex: João da Silva"
                                                value={applicantName}
                                                onChange={(e) => setApplicantName(e.target.value)}
                                                required
                                                className="h-11 rounded-2xl border-slate-200 px-4 bg-white"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-700">Telefone / WhatsApp *</Label>
                                            <Input
                                                placeholder="Ex: (81) 99999-9999"
                                                value={applicantPhone}
                                                onChange={handlePhoneChange}
                                                required
                                                className="h-11 rounded-2xl border-slate-200 px-4 bg-white"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-700">E-mail (Opcional)</Label>
                                            <Input
                                                type="email"
                                                placeholder="seu.email@exemplo.com"
                                                value={applicantEmail}
                                                onChange={(e) => setApplicantEmail(e.target.value)}
                                                className="h-11 rounded-2xl border-slate-200 px-4 bg-white"
                                            />
                                        </div>

                                        {/* Resume Upload */}
                                        <div className="space-y-1 pt-1">
                                            <Label className="text-xs font-bold text-slate-700">Anexar Currículo (PDF ou Imagem) *</Label>
                                            <div 
                                                onClick={() => !isSubmitting && document.getElementById("portal-cv-upload")?.click()}
                                                className={`border border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                                                    fileName ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                <input
                                                    type="file"
                                                    id="portal-cv-upload"
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    className="hidden"
                                                    onChange={handleFileChange}
                                                />
                                                {fileName ? (
                                                    <div className="flex items-center gap-2 text-indigo-700 font-bold">
                                                        <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                                                        <span className="truncate max-w-[200px]">{fileName}</span>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <Upload className="w-5 h-5 text-slate-400 mx-auto" />
                                                        <span className="text-xs font-semibold text-slate-700 block">Clique para anexar seu currículo</span>
                                                        <span className="text-[10px] text-slate-400 block">PDF ou Imagem (Máx 8MB)</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full h-12 rounded-2xl font-black bg-indigo-600 hover:bg-indigo-700 text-white text-sm shadow-md mt-2"
                                        >
                                            {isSubmitting ? (
                                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                            ) : (
                                                <CheckCircle2 className="w-5 h-5 mr-2" />
                                            )}
                                            {isSubmitting ? "Enviando Candidatura..." : "Enviar Candidatura Agora"}
                                        </Button>
                                    </form>
                                </>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
