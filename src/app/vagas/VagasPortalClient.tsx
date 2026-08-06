"use client";

import { useState } from "react";
import { 
    Briefcase, MapPin, Building2, Calendar, Sparkles, Search, 
    DollarSign, Clock, ShieldCheck, CheckCircle2, Loader2, Upload, FileText, ArrowRight, X, AlertCircle,
    MessageCircle, Mail, Linkedin, Facebook, Instagram, Youtube, Award, Zap, CheckCircle
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
        <div className="min-h-screen bg-slate-50/80 font-sans antialiased selection:bg-indigo-500 selection:text-white">
            {/* Top Bar Navigation (Teal Premium Brand Header) */}
            <header className="bg-gradient-to-r from-[#054957] via-[#076477] to-[#043d49] text-white py-2.5 px-4 shadow-md font-medium">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] sm:text-xs">
                    {/* Left: WhatsApp & Email */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
                        <a 
                            href="https://wa.me/554135030020" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-1 rounded-full font-bold transition-all border border-emerald-400/30"
                            title="Falar no WhatsApp"
                        >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>(41) 3503-0020</span>
                        </a>

                        <span className="hidden sm:inline opacity-30">|</span>

                        <a 
                            href="mailto:comercial@grupojvsserv.com.br" 
                            className="flex items-center gap-1.5 hover:text-cyan-200 transition-all opacity-90"
                            title="Enviar E-mail"
                        >
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">comercial@grupojvsserv.com.br</span>
                        </a>
                    </div>

                    {/* Right: Social Media Buttons */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-cyan-200/70 font-semibold uppercase tracking-wider hidden md:inline">Siga-nos:</span>
                        <a 
                            href="https://www.linkedin.com/company/grupo-jvs-servicos/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-105"
                            title="LinkedIn"
                        >
                            <Linkedin className="w-3.5 h-3.5" />
                        </a>
                        <a 
                            href="https://www.facebook.com/grupojvsservicos" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-105"
                            title="Facebook"
                        >
                            <Facebook className="w-3.5 h-3.5" />
                        </a>
                        <a 
                            href="https://www.instagram.com/grupojvsservicos" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-105"
                            title="Instagram"
                        >
                            <Instagram className="w-3.5 h-3.5" />
                        </a>
                        <a 
                            href="https://www.youtube.com/@grupojvsservicos" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-105"
                            title="YouTube"
                        >
                            <Youtube className="w-3.5 h-3.5" />
                        </a>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto space-y-8 sm:space-y-10">
                    
                    {/* Hero Showcase Card */}
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-slate-200/80 p-6 sm:p-12 shadow-xl shadow-slate-200/50 text-center space-y-6 relative overflow-hidden">
                        {/* Soft Ambient Glow background */}
                        <div className="absolute top-[-20%] left-[20%] w-72 h-72 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
                        <div className="absolute bottom-[-20%] right-[20%] w-72 h-72 rounded-full bg-teal-500/5 blur-3xl pointer-events-none" />

                        {/* Logo JVS */}
                        <div className="flex justify-center items-center relative z-10 pt-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                                src="https://grupojvsserv.com.br/wp-content/uploads/2023/11/logo-horizontal-300px.png" 
                                alt="Grupo JVS Serviços" 
                                className="h-14 sm:h-20 w-auto object-contain max-w-[280px] sm:max-w-[340px] drop-shadow-xs"
                            />
                        </div>

                        {/* Welcome Pill & Title */}
                        <div className="space-y-3.5 max-w-2xl mx-auto relative z-10">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-black uppercase tracking-widest shadow-2xs">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                Portal Oficial de Oportunidades & Carreiras
                            </div>

                            <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                                Venha Fazer Parte do Nosso Time!
                            </h1>

                            <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed max-w-xl mx-auto">
                                Estamos em constante busca por profissionais talentosos. Explore nossas oportunidades em aberto abaixo e envie seu currículo em poucos segundos.
                            </p>
                        </div>

                        {/* Floating Search & Filter Bar */}
                        <div className="pt-2 max-w-2xl mx-auto relative z-10">
                            <div className="bg-white p-2 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-lg shadow-slate-200/60 flex flex-col sm:flex-row gap-2 items-center">
                                <div className="relative flex-1 w-full">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                                    <Input
                                        placeholder="Buscar cargo, palavra-chave ou cidade..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="h-12 pl-11 border-0 bg-transparent text-sm font-semibold placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 w-full"
                                    />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm("")} className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 p-1">
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex gap-2 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                                    <Button
                                        type="button"
                                        variant={selectedPriorityFilter === "ALL" ? "default" : "outline"}
                                        onClick={() => setSelectedPriorityFilter("ALL")}
                                        className={`h-11 rounded-xl sm:rounded-2xl text-xs font-black transition-all flex-1 sm:flex-initial ${selectedPriorityFilter === "ALL" ? "bg-slate-900 text-white shadow-sm" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                                    >
                                        Todas ({initialVacancies.length})
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={selectedPriorityFilter === "URGENT" ? "destructive" : "outline"}
                                        onClick={() => setSelectedPriorityFilter("URGENT")}
                                        className={`h-11 rounded-xl sm:rounded-2xl text-xs font-black transition-all flex-1 sm:flex-initial ${selectedPriorityFilter === "URGENT" ? "bg-red-600 text-white shadow-sm" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                                    >
                                        🔥 Urgentes ({initialVacancies.filter(v => v.priority === 'URGENTE').length})
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Trust Micro Seals */}
                        <div className="pt-2 flex flex-wrap items-center justify-center gap-6 text-[11px] font-bold text-slate-500 border-t border-slate-100 max-w-xl mx-auto">
                            <span className="flex items-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Candidatura 100% Gratuita
                            </span>
                            <span className="flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Processo Seguro & Direto
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-amber-500" /> Triagem Ágil com IA
                            </span>
                        </div>
                    </div>

                    {/* Counter & Status Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 text-xs text-slate-500 font-semibold">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                            <span>
                                Exibindo <strong className="text-slate-900">{filteredVacancies.length}</strong> de <strong className="text-slate-900">{initialVacancies.length}</strong> vagas disponíveis agora
                            </span>
                        </div>
                        <span className="text-[11px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-200/80 px-3 py-1 rounded-full shadow-2xs">
                            Recrutamento Ativo &bull; Grupo JVS
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                            {filteredVacancies.map((v) => {
                                const isUrgent = v.priority === "URGENTE";

                                return (
                                    <div 
                                        key={v.id}
                                        className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-sm hover:shadow-xl hover:border-indigo-300 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-6 relative overflow-hidden group"
                                    >
                                        {/* Top Accent line for urgent */}
                                        {isUrgent && (
                                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500" />
                                        )}

                                        <div className="space-y-4">
                                            {/* Top Header: Badge & Date */}
                                            <div className="flex items-center justify-between gap-2">
                                                <Badge variant="outline" className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${isUrgent ? "bg-red-50 text-red-700 border-red-200 shadow-2xs" : "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>
                                                    {isUrgent ? "🔥 Urgente" : "Oportunidade"}
                                                </Badge>
                                                <span className="text-[11px] text-slate-400 font-medium">
                                                    Postada em {new Date(v.createdAt).toLocaleDateString('pt-BR')}
                                                </span>
                                            </div>

                                            {/* Vacancy Title */}
                                            <div className="space-y-1.5">
                                                <h2 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug break-words">
                                                    {v.title}
                                                </h2>
                                                <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                                                    <span className="inline-flex items-center gap-1.5 text-slate-700 bg-slate-100/80 px-3 py-1 rounded-xl border border-slate-200/60 font-bold">
                                                        <Briefcase className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                        {v.roleName}
                                                    </span>
                                                    {v.companyName && (
                                                        <span className="inline-flex items-center gap-1.5 text-slate-700 bg-slate-100/80 px-3 py-1 rounded-xl border border-slate-200/60 font-semibold">
                                                            <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                            {v.companyName}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Location & Remuneration Badges */}
                                            <div className="space-y-2.5 text-xs text-slate-600 pt-3 border-t border-slate-100">
                                                {v.location && (
                                                    <div className="flex items-center gap-2 text-slate-700 font-semibold">
                                                        <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                                                        <span className="truncate">{v.location}</span>
                                                    </div>
                                                )}

                                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                                    {v.baseSalary ? (
                                                        <span className="bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 px-3 py-1 rounded-xl font-black text-xs flex items-center gap-1">
                                                            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.baseSalary)}
                                                        </span>
                                                    ) : null}

                                                    {v.valeAlimentacao ? (
                                                        <span className="bg-indigo-50 text-indigo-800 border border-indigo-200/80 px-3 py-1 rounded-xl font-bold">
                                                            VA: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.valeAlimentacao)}
                                                        </span>
                                                    ) : null}

                                                    {v.valeTransporte ? (
                                                        <span className="bg-slate-100/90 text-slate-700 px-3 py-1 rounded-xl font-bold border border-slate-200/60">
                                                            VT Incluído
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="grid grid-cols-2 gap-3 pt-3">
                                            <Button
                                                variant="outline"
                                                onClick={() => { setSelectedVacancy(v); setIsDetailsOpen(true); }}
                                                className="h-11 rounded-2xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs"
                                            >
                                                Ver Detalhes
                                            </Button>
                                            <Button
                                                onClick={() => handleOpenApply(v)}
                                                className="h-11 rounded-2xl text-xs font-black bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                            >
                                                Se Candidatar <ArrowRight className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Footer Trust Seals */}
                    <footer className="text-center text-xs text-slate-400 pt-10 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                                src="https://grupojvsserv.com.br/wp-content/uploads/2023/11/logo-horizontal-300px.png" 
                                alt="JVS Logo" 
                                className="h-6 w-auto grayscale opacity-50"
                            />
                            <span className="text-[11px] font-semibold text-slate-500">&bull; Grupo JVS Serviços 2026</span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>Plataforma Oficial de Recrutamento & Seleção</span>
                        </div>
                    </footer>
                </div>
            </main>

            {/* Modal 1: Vacancy Details Modal */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
                    {selectedVacancy && (
                        <>
                            <DialogHeader className="space-y-2 border-b pb-4">
                                <Badge variant="outline" className="w-fit bg-indigo-50 text-indigo-700 border-indigo-200 font-extrabold">
                                    {selectedVacancy.roleName}
                                </Badge>
                                <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                                    {selectedVacancy.title}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-slate-500 font-medium flex items-center gap-2">
                                    <Building2 className="w-3.5 h-3.5 text-indigo-600" /> {selectedVacancy.companyName}
                                    {selectedVacancy.location && (
                                        <> &bull; <MapPin className="w-3.5 h-3.5 text-indigo-600" /> {selectedVacancy.location}</>
                                    )}
                                </DialogDescription>
                            </DialogHeader>

                            {/* Details Content */}
                            <div className="space-y-4 text-xs">
                                {/* Remuneração */}
                                <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Remuneração & Benefícios</span>
                                    <div className="grid grid-cols-2 gap-3 text-slate-800 font-bold">
                                        <div className="bg-white p-3 rounded-xl border border-slate-200/60">
                                            <span className="text-[10px] text-slate-500 font-medium block">Salário Base</span>
                                            <span className="text-emerald-700 text-sm font-black">
                                                {selectedVacancy.baseSalary 
                                                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedVacancy.baseSalary)
                                                    : "A Combinar"}
                                            </span>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-slate-200/60">
                                            <span className="text-[10px] text-slate-500 font-medium block">Vale Alimentação</span>
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
                                        <div className="bg-white border rounded-xl p-3">
                                            <span className="text-[10px] text-slate-400 font-bold block">Gênero</span>
                                            <span className="font-bold text-slate-800">{selectedVacancy.reqGender || "Indiferente"}</span>
                                        </div>
                                        <div className="bg-white border rounded-xl p-3">
                                            <span className="text-[10px] text-slate-400 font-bold block">Experiência</span>
                                            <span className="font-bold text-slate-800">{selectedVacancy.reqExperience || "Não exigida"}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Descrição */}
                                {selectedVacancy.description && (
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Descrição da Função</span>
                                        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                                            {selectedVacancy.description}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action */}
                            <Button
                                onClick={() => { setIsDetailsOpen(false); handleOpenApply(selectedVacancy); }}
                                className="w-full h-12 rounded-2xl text-sm font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-[0.98] transition-all"
                            >
                                Candidatar-se a esta Vaga <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal 2: Direct Candidate Application Modal */}
            <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
                <DialogContent className="max-w-md rounded-3xl p-6 sm:p-7 space-y-4">
                    {applyingVacancy && (
                        <>
                            {submitSuccess ? (
                                <div className="text-center space-y-4 py-4">
                                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
                                    <div className="space-y-1.5">
                                        <h3 className="text-2xl font-black text-slate-900">Candidatura Enviada!</h3>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            Obrigado, <strong>{applicantName}</strong>! Sua candidatura para a vaga <strong>{applyingVacancy.title}</strong> foi recebida com sucesso por nossa equipe de RH.
                                        </p>
                                    </div>
                                    <Button onClick={() => setIsApplyOpen(false)} className="w-full rounded-2xl font-black bg-slate-900 text-white h-12 text-sm shadow-md">
                                        Concluir
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <DialogHeader className="space-y-1.5 border-b pb-4">
                                        <Badge variant="outline" className="w-fit bg-indigo-50 text-indigo-700 border-indigo-200 font-extrabold">
                                            Inscrição Rápida
                                        </Badge>
                                        <DialogTitle className="text-lg font-black text-slate-900 leading-snug">
                                            {applyingVacancy.title}
                                        </DialogTitle>
                                        <DialogDescription className="text-xs text-slate-500 font-medium">
                                            Preencha seus dados de contato e anexe seu currículo.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <form onSubmit={handleSubmitApplication} className="space-y-3.5 text-xs pt-1">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-slate-700">Nome Completo *</Label>
                                            <Input
                                                placeholder="Ex: João da Silva"
                                                value={applicantName}
                                                onChange={(e) => setApplicantName(e.target.value)}
                                                required
                                                className="h-11 rounded-2xl border-slate-200 px-4 bg-white shadow-2xs text-xs sm:text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-slate-700">Telefone / WhatsApp *</Label>
                                            <Input
                                                placeholder="Ex: (81) 99999-9999"
                                                value={applicantPhone}
                                                onChange={handlePhoneChange}
                                                required
                                                className="h-11 rounded-2xl border-slate-200 px-4 bg-white shadow-2xs text-xs sm:text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-slate-700">E-mail (Opcional)</Label>
                                            <Input
                                                type="email"
                                                placeholder="seu.email@exemplo.com"
                                                value={applicantEmail}
                                                onChange={(e) => setApplicantEmail(e.target.value)}
                                                className="h-11 rounded-2xl border-slate-200 px-4 bg-white shadow-2xs text-xs sm:text-sm"
                                            />
                                        </div>

                                        {/* Resume Upload */}
                                        <div className="space-y-1.5 pt-1">
                                            <Label className="text-xs font-bold text-slate-700">Anexar Currículo (PDF ou Imagem) *</Label>
                                            <div 
                                                onClick={() => !isSubmitting && document.getElementById("portal-cv-upload")?.click()}
                                                className={`border border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                                                    fileName ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
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
                                                        <span className="text-xs font-bold text-slate-700 block">Clique para anexar seu currículo</span>
                                                        <span className="text-[10px] text-slate-400 block">PDF ou Imagem (Máx 8MB)</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full h-12 rounded-2xl font-black bg-indigo-600 hover:bg-indigo-700 text-white text-sm shadow-md mt-3 active:scale-[0.98] transition-all"
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
