"use client";

import { useState, useEffect } from "react";
import { 
    Briefcase, MapPin, Building2, Calendar, Sparkles, Search, 
    DollarSign, Clock, ShieldCheck, CheckCircle2, Loader2, Upload, FileText, ArrowRight, X, AlertCircle,
    MessageCircle, Mail, Linkedin, Facebook, Instagram, Youtube, Award, Zap, CheckCircle, Flame, Filter, ChevronRight, Layers, UserCheck, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { createPublicCandidate } from "@/actions/recruitment";

function WhatsAppIcon({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
        </svg>
    );
}

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

    // Auto open vacancy details if direct URL parameter ?vaga=id exists
    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const vagaId = params.get("vaga");
            if (vagaId) {
                const found = initialVacancies.find(v => v.id === vagaId);
                if (found) {
                    setSelectedVacancy(found);
                    setIsDetailsOpen(true);
                }
            }
        }
    }, [initialVacancies]);

    // Share individual vacancy link on WhatsApp (Paper Airplane Feature)
    const handleShareVacancy = (v: VacancyItem) => {
        const pageUrl = `${window.location.origin}/vagas?vaga=${v.id}`;
        const text = `*Vaga de Emprego no Grupo JVS* 🏢\n\n📌 *${v.title}*\n🏢 Empresa: ${v.companyName}\n📍 Local: ${v.location || "Curitiba e Região"}\n💰 Salário: ${v.baseSalary ? `R$ ${v.baseSalary.toLocaleString('pt-BR')}` : 'A combinar'}\n\nConfira os detalhes e candidate-se direto pelo link abaixo 👇\n${pageUrl}`;
        
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(pageUrl).catch(() => {});
        }
        
        window.open(whatsappUrl, "_blank");
        toast.success("WhatsApp aberto! O link individual desta vaga foi preparado para seu amigo.");
    };

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
            <header className="bg-[#042d36] text-white py-2.5 px-4 sm:px-8 border-b border-teal-800/40 sticky top-0 z-40 backdrop-blur-xl bg-opacity-95 shadow-md">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
                    
                    {/* Far Left: JVS Logo with Badge Pill */}
                    <div className="flex items-center shrink-0">
                        <div className="bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/20 shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                                src="https://grupojvsserv.com.br/wp-content/uploads/2023/11/logo-horizontal-300px.png" 
                                alt="Grupo JVS Facilities" 
                                className="h-7 sm:h-8 w-auto object-contain"
                            />
                        </div>
                    </div>

                    {/* Far Right: Social Media */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <a 
                            href="https://www.linkedin.com/company/jvs-facilities/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-7.5 h-7.5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-110"
                            title="LinkedIn Oficial JVS Facilities"
                        >
                            <Linkedin className="w-3.5 h-3.5" />
                        </a>
                        <a 
                            href="https://www.instagram.com/jvsfacilities/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-7.5 h-7.5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-110"
                            title="Instagram Oficial JVS Facilities"
                        >
                            <Instagram className="w-3.5 h-3.5" />
                        </a>
                    </div>
                </div>
            </header>

            {/* HERO SECTION - Compact Petrol Mesh Gradient Banner */}
            <section className="relative bg-[#03242c] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#07596b] via-[#04333d] to-[#021d23] text-white pt-4 pb-11 sm:pt-5 sm:pb-12 px-4 sm:px-6 lg:px-8 overflow-hidden shadow-lg">
                
                {/* Decorative Mesh Background Effects */}
                <div className="absolute top-[-40%] left-[-10%] w-[350px] h-[350px] rounded-full bg-teal-500/10 blur-[90px] pointer-events-none" />
                <div className="absolute bottom-[-30%] right-[-10%] w-[350px] h-[350px] rounded-full bg-indigo-500/10 blur-[90px] pointer-events-none" />

                <div className="max-w-5xl mx-auto text-center space-y-3 relative z-10">

                    {/* Headline Banner */}
                    <div className="space-y-1.5 max-w-2xl mx-auto">
                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                            Vagas em Aberto &bull; <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">Grupo JVS</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-teal-100/90 font-medium max-w-xl mx-auto">
                            Confira as vagas disponíveis, veja os detalhes e candidate-se em menos de 1 minuto.
                        </p>
                    </div>

                    {/* Compact Search Bar */}
                    <div className="pt-1 max-w-2xl mx-auto">
                        <div className="bg-white/95 backdrop-blur-2xl p-1.5 sm:p-2 rounded-2xl border border-white/50 shadow-xl flex items-center gap-2">
                            <div className="relative flex-1 w-full">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                <Input
                                    placeholder="Buscar por cargo, palavra-chave ou cidade..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-10 pl-9 pr-8 border-0 bg-slate-50/90 rounded-xl text-slate-900 text-xs font-semibold placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-teal-500 w-full"
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-1">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            <Button 
                                type="button"
                                className="h-10 px-4 rounded-xl font-black text-xs uppercase tracking-wider bg-teal-600 hover:bg-teal-700 text-white shadow-sm shrink-0"
                            >
                                <Search className="w-3.5 h-3.5 mr-1.5" /> Buscar
                            </Button>
                        </div>
                    </div>

                </div>
            </section>

            {/* MAIN CONTENT AREA */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-7 relative z-20 pb-12 space-y-5">
                
                {/* Categories & Filter Pills */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-md space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                        <span className="flex items-center gap-1.5 text-slate-800 font-black text-xs">
                            <Filter className="w-3.5 h-3.5 text-teal-600" />
                            Filtrar por Categoria:
                        </span>
                        <span className="text-[11px] text-slate-400">
                            <strong>{filteredVacancies.length}</strong> vagas disponíveis
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <button
                            onClick={() => setSelectedCategory("ALL")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${selectedCategory === "ALL" ? "bg-teal-700 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                        >
                            Todas ({initialVacancies.length})
                        </button>

                        <button
                            onClick={() => setSelectedCategory("URGENT")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${selectedCategory === "URGENT" ? "bg-red-600 text-white shadow-xs" : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60"}`}
                        >
                            <Flame className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-bounce" />
                            Urgentes ({initialVacancies.filter(v => v.priority === 'URGENTE').length})
                        </button>

                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedCategory === cat ? "bg-teal-700 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
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
                                    <div className="grid grid-cols-2 gap-2 pt-2">
                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                variant="outline"
                                                onClick={() => { setSelectedVacancy(v); setIsDetailsOpen(true); }}
                                                className="flex-1 h-11 rounded-2xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all"
                                            >
                                                Ver Requisitos
                                            </Button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleShareVacancy(v); }}
                                                className="h-11 w-11 shrink-0 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xs"
                                                title="Enviar vaga no WhatsApp (Aviãozinho)"
                                            >
                                                <Send className="w-4 h-4 text-emerald-600 -rotate-12 translate-x-0.5" />
                                            </button>
                                        </div>
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

                    <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 text-xs text-slate-500 font-semibold">
                        <a 
                            href="mailto:dp@grupojvsserv.com.br" 
                            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 transition-all"
                            title="Enviar E-mail para o DP"
                        >
                            <Mail className="w-4 h-4 text-teal-600 shrink-0" />
                            <span>dp@grupojvsserv.com.br</span>
                        </a>

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
                            <div className="flex items-center gap-2 pt-1">
                                <Button
                                    onClick={() => { setIsDetailsOpen(false); handleOpenApply(selectedVacancy); }}
                                    className="flex-1 h-12 rounded-2xl text-xs sm:text-sm font-black bg-teal-700 hover:bg-teal-800 text-white shadow-md active:scale-[0.98] transition-all"
                                >
                                    Candidatar-se a esta Vaga <ArrowRight className="w-4 h-4 ml-1.5" />
                                </Button>
                                <button
                                    onClick={() => handleShareVacancy(selectedVacancy)}
                                    className="h-12 px-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200/80 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-xs text-xs"
                                    title="Enviar vaga no WhatsApp (Aviãozinho)"
                                >
                                    <Send className="w-4 h-4 text-emerald-600 -rotate-12" />
                                    <span className="hidden sm:inline">Compartilhar</span>
                                </button>
                            </div>
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

            {/* Floating WhatsApp Action Button */}
            <a
                href="https://wa.me/554135030020?text=Ol%C3%A1!%20Gostaria%20de%20informa%C3%A7%C3%B5es%20sobre%20as%20vagas%20do%20Grupo%20JVS."
                target="_blank"
                rel="noopener noreferrer"
                className="fixed bottom-5 right-5 z-50 group flex items-center gap-2.5 bg-[#25D366] hover:bg-[#20ba5a] text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full shadow-2xl shadow-emerald-600/40 hover:scale-105 active:scale-95 transition-all border-2 border-white/90"
                title="Falar no WhatsApp com o Grupo JVS"
            >
                <div className="relative flex items-center justify-center">
                    <WhatsAppIcon className="w-6 h-6 text-white shrink-0" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-300"></span>
                    </span>
                </div>
                <span className="hidden sm:inline font-extrabold text-xs tracking-wide">
                    Dúvidas? Fale no WhatsApp
                </span>
            </a>
        </div>
    );
}
