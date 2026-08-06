"use client";

import { useState } from "react";
import { 
    Briefcase, MapPin, Building2, Calendar, Sparkles, Search, 
    DollarSign, Clock, ShieldCheck, CheckCircle2, Loader2, Upload, FileText, ArrowRight, X, AlertCircle,
    MessageCircle, Mail, Linkedin, Facebook, Instagram, Youtube, Award, Zap, CheckCircle, Flame, Filter, ChevronRight, Layers, UserCheck
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
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

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

    // Extract unique categories (roles) for quick filtering
    const categories = Array.from(new Set(initialVacancies.map(v => v.roleName))).filter(Boolean);

    // Filter vacancies based on search term & category/priority
    const filteredVacancies = initialVacancies.filter(v => {
        if (selectedCategory === "URGENT" && v.priority !== "URGENTE") {
            return false;
        }

        if (selectedCategory !== "ALL" && selectedCategory !== "URGENT") {
            if (v.roleName !== selectedCategory) return false;
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
        <div className="min-h-screen bg-[#f8fafc] font-sans antialiased text-slate-900 selection:bg-teal-500 selection:text-white">
            
            {/* Top Teal Luxury Header */}
            <header className="bg-[#042d36] text-white py-3 px-4 sm:px-8 border-b border-teal-800/40 sticky top-0 z-40 backdrop-blur-xl bg-opacity-95 shadow-md">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    
                    {/* Left: Contact Info */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
                        <a 
                            href="https://wa.me/554135030020" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 px-3.5 py-1 rounded-full font-bold transition-all border border-emerald-400/30 hover:scale-105 active:scale-95"
                            title="Falar no WhatsApp Oficial"
                        >
                            <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                            <span>(41) 3503-0020</span>
                        </a>

                        <span className="hidden sm:inline opacity-30 text-teal-400">|</span>

                        <a 
                            href="mailto:comercial@grupojvsserv.com.br" 
                            className="flex items-center gap-1.5 hover:text-cyan-200 transition-all opacity-90 text-[11px] sm:text-xs"
                            title="Enviar E-mail Comercial"
                        >
                            <Mail className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                            <span className="truncate">comercial@grupojvsserv.com.br</span>
                        </a>
                    </div>

                    {/* Right: Social Media */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-teal-200/60 font-black uppercase tracking-widest hidden md:inline">Siga o Grupo JVS:</span>
                        <div className="flex items-center gap-1.5">
                            <a 
                                href="https://www.linkedin.com/company/grupo-jvs-servicos/" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-7.5 h-7.5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-110"
                                title="LinkedIn"
                            >
                                <Linkedin className="w-3.5 h-3.5" />
                            </a>
                            <a 
                                href="https://www.facebook.com/grupojvsservicos" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-7.5 h-7.5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-110"
                                title="Facebook"
                            >
                                <Facebook className="w-3.5 h-3.5" />
                            </a>
                            <a 
                                href="https://www.instagram.com/grupojvsservicos" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-7.5 h-7.5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-110"
                                title="Instagram"
                            >
                                <Instagram className="w-3.5 h-3.5" />
                            </a>
                            <a 
                                href="https://www.youtube.com/@grupojvsservicos" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-7.5 h-7.5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-110"
                                title="YouTube"
                            >
                                <Youtube className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    </div>
                </div>
            </header>

            {/* HERO SECTION - Deep Petrol Mesh Gradient Banner */}
            <section className="relative bg-[#03242c] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#07596b] via-[#04333d] to-[#021d23] text-white pt-10 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden shadow-xl">
                
                {/* Decorative Mesh Background Effects */}
                <div className="absolute top-[-30%] left-[-10%] w-[500px] h-[500px] rounded-full bg-teal-500/10 blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

                <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
                    
                    {/* Logo JVS Container */}
                    <div className="flex justify-center items-center">
                        <div className="bg-white/95 backdrop-blur-xl px-6 py-3 rounded-3xl border border-white/20 shadow-2xl shadow-black/40">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                                src="https://grupojvsserv.com.br/wp-content/uploads/2023/11/logo-horizontal-300px.png" 
                                alt="Grupo JVS Serviços" 
                                className="h-14 sm:h-18 w-auto object-contain max-w-[280px] sm:max-w-[340px]"
                            />
                        </div>
                    </div>

                    {/* Headline Banner */}
                    <div className="space-y-4 max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/15 border border-teal-400/30 text-teal-200 text-xs font-black uppercase tracking-widest shadow-inner">
                            <Sparkles className="w-4 h-4 text-emerald-400" />
                            Portal Oficial de Carreiras & Oportunidades
                        </div>

                        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight drop-shadow-md">
                            Venha Fazer Parte do <br />
                            <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
                                Nosso Time de Sucesso!
                            </span>
                        </h1>

                        <p className="text-base sm:text-lg text-teal-100/90 font-medium max-w-2xl mx-auto leading-relaxed">
                            Estamos em constante expansão e buscando profissionais comprometidos. Confira nossas vagas abertas e envie seu currículo em menos de 1 minuto.
                        </p>
                    </div>

                    {/* Floating Search Container */}
                    <div className="pt-2 max-w-3xl mx-auto">
                        <div className="bg-white/95 backdrop-blur-2xl p-3 sm:p-4 rounded-3xl border border-white/50 shadow-2xl shadow-black/30 flex flex-col sm:flex-row gap-3 items-center">
                            <div className="relative flex-1 w-full">
                                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
                                <Input
                                    placeholder="Qual vaga ou cargo você está procurando? (Ex: Auxiliar de Limpeza)"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-12 pl-12 pr-10 border-0 bg-slate-50/80 rounded-2xl text-slate-900 text-sm font-semibold placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-teal-500 w-full"
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm("")} className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 p-1">
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <Button 
                                type="button"
                                className="h-12 px-6 rounded-2xl font-black text-xs uppercase tracking-wider bg-teal-600 hover:bg-teal-700 text-white shadow-md w-full sm:w-auto shrink-0"
                            >
                                <Search className="w-4 h-4 mr-2" /> Buscar Vagas
                            </Button>
                        </div>
                    </div>

                </div>
            </section>

            {/* MAIN CONTENT AREA */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-20 pb-16 space-y-8">
                
                {/* Stats Highlights Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-md flex items-center gap-4 hover:border-teal-300 transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                            <Zap className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Inscrição Rápida</span>
                            <span className="text-sm font-black text-slate-800">Sem Cadastro Necessário</span>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-md flex items-center gap-4 hover:border-teal-300 transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shrink-0">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Canal Oficial JVS</span>
                            <span className="text-sm font-black text-slate-800">Processo 100% Seguro</span>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-md flex items-center gap-4 hover:border-teal-300 transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                            <UserCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Retorno do RH</span>
                            <span className="text-sm font-black text-slate-800">Triagem Ágil de Currículos</span>
                        </div>
                    </div>
                </div>

                {/* Categories & Filter Pills */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 border-b border-slate-100 pb-3">
                        <span className="flex items-center gap-2 text-slate-800 font-black">
                            <Filter className="w-4 h-4 text-teal-600" />
                            Filtrar por Setor ou Categoria:
                        </span>
                        <span className="text-slate-400">
                            Vagas disponíveis: <strong className="text-slate-900">{filteredVacancies.length}</strong>
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                            onClick={() => setSelectedCategory("ALL")}
                            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all ${selectedCategory === "ALL" ? "bg-teal-700 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                        >
                            Todas as Vagas ({initialVacancies.length})
                        </button>

                        <button
                            onClick={() => setSelectedCategory("URGENT")}
                            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 ${selectedCategory === "URGENT" ? "bg-red-600 text-white shadow-sm" : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60"}`}
                        >
                            <Flame className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-bounce" />
                            Urgentes ({initialVacancies.filter(v => v.priority === 'URGENTE').length})
                        </button>

                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${selectedCategory === cat ? "bg-teal-700 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* VACANCIES GRID */}
                {filteredVacancies.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
                        <AlertCircle className="w-14 h-14 text-slate-300 mx-auto" />
                        <div className="space-y-1">
                            <h3 className="text-xl font-black text-slate-800">Nenhuma vaga encontrada</h3>
                            <p className="text-xs text-slate-500">Tente buscar por termos mais genéricos ou limpe os filtros selecionados.</p>
                        </div>
                        <Button variant="outline" onClick={() => { setSearchTerm(""); setSelectedCategory("ALL"); }} className="rounded-2xl text-xs font-bold px-6 h-11">
                            Limpar Filtros de Busca
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredVacancies.map((v) => {
                            const isUrgent = v.priority === "URGENTE";
                            const initialLetter = (v.roleName || v.title).charAt(0).toUpperCase();

                            return (
                                <div 
                                    key={v.id}
                                    className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-sm hover:shadow-2xl hover:border-teal-400 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-6 relative overflow-hidden group"
                                >
                                    {/* Top Urgent Strip */}
                                    {isUrgent && (
                                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-amber-500 to-rose-500 animate-pulse" />
                                    )}

                                    <div className="space-y-4">
                                        
                                        {/* Card Top: Avatar & Badges */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3.5">
                                                {/* Company Avatar */}
                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#076477] to-[#043d49] text-white flex items-center justify-center font-black text-lg shadow-md shrink-0 border border-teal-500/30">
                                                    {initialLetter}
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-black text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200/60 uppercase tracking-wider block w-fit">
                                                        {v.roleName}
                                                    </span>
                                                    <span className="text-xs font-semibold text-slate-500 mt-0.5 block">
                                                        {v.companyName || "Grupo JVS Serviços"}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Priority Pill */}
                                            <Badge variant="outline" className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border shrink-0 ${isUrgent ? "bg-red-50 text-red-700 border-red-200 shadow-2xs" : "bg-emerald-50 text-emerald-800 border-emerald-200"}`}>
                                                {isUrgent ? "🔥 Imadiato" : "Vaga Aberta"}
                                            </Badge>
                                        </div>

                                        {/* Title */}
                                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-teal-700 transition-colors leading-snug break-words">
                                            {v.title}
                                        </h2>

                                        {/* Location & Remuneration Details */}
                                        <div className="space-y-3 pt-3 border-t border-slate-100">
                                            {v.location && (
                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-100">
                                                    <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                                                    <span className="truncate">{v.location}</span>
                                                </div>
                                            )}

                                            {/* Perks Badges */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                {v.baseSalary ? (
                                                    <span className="bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 shadow-2xs">
                                                        <DollarSign className="w-4 h-4 text-emerald-600" />
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.baseSalary)}
                                                    </span>
                                                ) : null}

                                                {v.valeAlimentacao ? (
                                                    <span className="bg-teal-50 text-teal-800 border border-teal-200 px-3 py-1.5 rounded-xl font-bold text-xs">
                                                        🍔 VA: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.valeAlimentacao)}
                                                    </span>
                                                ) : null}

                                                {v.valeTransporte ? (
                                                    <span className="bg-slate-100 text-slate-700 border border-slate-200/80 px-3 py-1.5 rounded-xl font-bold text-xs">
                                                        🚌 VT Incluído
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>

                                    </div>

                                    {/* Card Footer Actions */}
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => { setSelectedVacancy(v); setIsDetailsOpen(true); }}
                                            className="h-11 rounded-2xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all"
                                        >
                                            Ver Requisitos
                                        </Button>
                                        <Button
                                            onClick={() => handleOpenApply(v)}
                                            className="h-11 rounded-2xl text-xs font-black bg-gradient-to-r from-[#076477] via-[#065868] to-[#043d49] hover:from-[#087389] hover:to-[#054957] text-white shadow-lg shadow-teal-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                        >
                                            Se Candidatar <ArrowRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer Section */}
                <footer className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center sm:text-left shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                            src="https://grupojvsserv.com.br/wp-content/uploads/2023/11/logo-horizontal-300px.png" 
                            alt="JVS Logo" 
                            className="h-8 w-auto grayscale opacity-60"
                        />
                        <div className="text-xs text-slate-500 font-medium border-l border-slate-200 pl-4">
                            <p className="font-bold text-slate-800">Grupo JVS Serviços</p>
                            <p className="text-[11px]">Plataforma Oficial de Recrutamento & Seleção &bull; 2026</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold">
                        <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                            <ShieldCheck className="w-4 h-4 text-teal-600" /> LGPD Garantida
                        </span>
                        <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                            <Award className="w-4 h-4 text-amber-500" /> Empresa Certificada
                        </span>
                    </div>
                </footer>
            </main>

            {/* Modal 1: Vacancy Details Modal */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
                    {selectedVacancy && (
                        <>
                            <DialogHeader className="space-y-2 border-b pb-4">
                                <Badge variant="outline" className="w-fit bg-teal-50 text-teal-800 border-teal-200 font-extrabold">
                                    {selectedVacancy.roleName}
                                </Badge>
                                <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                                    {selectedVacancy.title}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-slate-500 font-medium flex items-center gap-2">
                                    <Building2 className="w-3.5 h-3.5 text-teal-600" /> {selectedVacancy.companyName}
                                    {selectedVacancy.location && (
                                        <> &bull; <MapPin className="w-3.5 h-3.5 text-teal-600" /> {selectedVacancy.location}</>
                                    )}
                                </DialogDescription>
                            </DialogHeader>

                            {/* Details Content */}
                            <div className="space-y-4 text-xs">
                                {/* Remuneração */}
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
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
                                            <span className="text-teal-700 text-sm font-black">
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
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                                            {selectedVacancy.description}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action */}
                            <Button
                                onClick={() => { setIsDetailsOpen(false); handleOpenApply(selectedVacancy); }}
                                className="w-full h-12 rounded-2xl text-sm font-black bg-teal-700 hover:bg-teal-800 text-white shadow-md active:scale-[0.98] transition-all"
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
                                        <Badge variant="outline" className="w-fit bg-teal-50 text-teal-800 border-teal-200 font-extrabold">
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
                                                    fileName ? 'bg-teal-50 border-teal-300' : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
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
                                                    <div className="flex items-center gap-2 text-teal-800 font-bold">
                                                        <FileText className="w-5 h-5 text-teal-600 shrink-0" />
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
                                            className="w-full h-12 rounded-2xl font-black bg-teal-700 hover:bg-teal-800 text-white text-sm shadow-md mt-3 active:scale-[0.98] transition-all"
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
