import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Briefcase, MapPin, Building, Calendar, ShieldCheck, Sparkles, Clock } from "lucide-react";
import { PublicApplicationForm } from "./PublicApplicationForm";

export const dynamic = "force-dynamic";

export default async function PublicApplicationPage(props: {
    params: Promise<{ vacancyId: string }>
}) {
    const params = await props.params;
    
    const vacancy = await prisma.vacancy.findUnique({
        where: { id: params.vacancyId },
        include: {
            role: true,
            posto: {
                include: {
                    client: true
                }
            },
            company: true
        }
    });

    if (!vacancy || vacancy.status !== 'OPEN') {
        return notFound();
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[120px]" />

            <div className="max-w-4xl mx-auto w-full space-y-8 relative z-10">
                {/* Header / Brand */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                        <Sparkles className="w-3 h-3" />
                        Trabalhe Conosco
                    </div>
                    <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent uppercase">
                        Work Force Hub
                    </h2>
                </div>

                {/* Main Card Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left: Job Info Card (Glassmorphism) */}
                    <div className="lg:col-span-7 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                        <div className="space-y-2">
                            <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest block">Oportunidade Disponível</span>
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                                {vacancy.title}
                            </h1>
                        </div>

                        {/* Details Badges */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-y border-slate-800/60">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/10">
                                    <Briefcase className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <span className="block text-[9px] text-slate-500 uppercase font-black tracking-wider">Função / Cargo</span>
                                    <span className="text-sm font-semibold text-slate-200">{vacancy.role?.name || "Geral"}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/10">
                                    <Building className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <span className="block text-[9px] text-slate-500 uppercase font-black tracking-wider">Empresa</span>
                                    <span className="text-sm font-semibold text-slate-200">{vacancy.company?.name || "JVS Facilities"}</span>
                                </div>
                            </div>

                            {vacancy.plannedStartDate && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/10">
                                        <Calendar className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <div>
                                        <span className="block text-[9px] text-slate-500 uppercase font-black tracking-wider">Início Planejado</span>
                                        <span className="text-sm font-semibold text-slate-200">
                                            {new Date(vacancy.plannedStartDate).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {vacancy.posto?.client?.address && (
                                <div className="flex items-center gap-3 col-span-1 sm:col-span-2">
                                    <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/10 shrink-0">
                                        <MapPin className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="block text-[9px] text-slate-500 uppercase font-black tracking-wider">Cidade / Região</span>
                                        <span className="text-sm font-semibold text-slate-200 block truncate" title={vacancy.posto.client.address}>
                                            {vacancy.posto.client.address}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Description Box */}
                        {vacancy.description && (
                            <div className="space-y-3">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-indigo-400" />
                                    Detalhes da Vaga & Escala
                                </h3>
                                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/40 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                                    {vacancy.description}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Submission Form Card (Glassmorphism) */}
                    <div className="lg:col-span-5 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-500/5">
                        <div className="space-y-1 mb-6">
                            <h2 className="text-lg font-black text-white uppercase tracking-wider">Envie seu Currículo</h2>
                            <p className="text-xs text-slate-400 font-medium">Preencha os campos e anexe seu currículo para triagem automática.</p>
                        </div>
                        <PublicApplicationForm vacancyId={vacancy.id} />
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-600 mt-12 flex items-center justify-center gap-1.5 relative z-10 border-t border-slate-900 pt-6 max-w-4xl mx-auto w-full">
                <ShieldCheck className="w-4 h-4 text-slate-600" />
                <span className="uppercase font-bold tracking-wider">Processo de Inscrição Seguro e Criptografado &bull; JVS Facilities 2026</span>
            </div>
        </div>
    );
}
