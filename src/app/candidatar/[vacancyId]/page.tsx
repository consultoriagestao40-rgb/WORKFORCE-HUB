import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Briefcase, MapPin, Building, Calendar, ShieldCheck, Sparkles, Clock, DollarSign } from "lucide-react";
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
        <div className="min-h-screen bg-slate-50/60 text-slate-900 flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            <div className="max-w-4xl mx-auto w-full space-y-6 relative z-10">
                {/* Header / Brand */}
                <div className="text-center space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-widest">
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        Trabalhe Conosco
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 uppercase">
                        Work Force Hub
                    </h2>
                </div>

                {/* Main Card Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left: Job Info Card */}
                    <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                        <div className="space-y-1">
                            <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest block">Oportunidade Disponível</span>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                                {vacancy.title}
                            </h1>
                        </div>

                        {/* Details Badges */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-y border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100">
                                    <Briefcase className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <span className="block text-[9px] text-slate-400 uppercase font-black tracking-wider">Função / Cargo</span>
                                    <span className="text-sm font-bold text-slate-800">{vacancy.role?.name || "Geral"}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100">
                                    <Building className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <span className="block text-[9px] text-slate-400 uppercase font-black tracking-wider">Empresa</span>
                                    <span className="text-sm font-bold text-slate-800">{vacancy.company?.name || "JVS Facilities"}</span>
                                </div>
                            </div>

                            {vacancy.plannedStartDate && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100">
                                        <Calendar className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <span className="block text-[9px] text-slate-400 uppercase font-black tracking-wider">Início Planejado</span>
                                        <span className="text-sm font-bold text-slate-800">
                                            {new Date(vacancy.plannedStartDate).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {vacancy.posto?.client?.address && (
                                <div className="flex items-center gap-3 col-span-1 sm:col-span-2">
                                    <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100 shrink-0">
                                        <MapPin className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="block text-[9px] text-slate-400 uppercase font-black tracking-wider">Cidade / Região</span>
                                        <span className="text-sm font-bold text-slate-800 block truncate" title={vacancy.posto.client.address}>
                                            {vacancy.posto.client.address}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Remuneração e Benefícios */}
                        {vacancy.posto && (
                            <div className="space-y-3">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <DollarSign className="w-4 h-4 text-indigo-600" />
                                    Remuneração & Benefícios
                                </h3>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Salário Base */}
                                    <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-1">
                                        <span className="block text-[9px] text-slate-400 uppercase font-black tracking-wider">Salário Base</span>
                                        <span className="text-lg font-black text-emerald-600">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vacancy.posto.baseSalary || 0)}
                                        </span>
                                    </div>
                                    
                                    {/* Vale Alimentação */}
                                    <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-1">
                                        <span className="block text-[9px] text-slate-400 uppercase font-black tracking-wider">Vale Alimentação</span>
                                        <span className="text-lg font-black text-indigo-600">
                                            {vacancy.posto.valeAlimentacao > 0 ? (
                                                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vacancy.posto.valeAlimentacao)
                                            ) : (
                                                "Conforme CCT"
                                            )}
                                        </span>
                                    </div>

                                    {/* Vale Transporte */}
                                    <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-1">
                                        <span className="block text-[9px] text-slate-400 uppercase font-black tracking-wider">Vale Transporte</span>
                                        <span className="text-lg font-black text-indigo-600">
                                            {vacancy.posto.valeTransporte > 0 ? (
                                                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vacancy.posto.valeTransporte)
                                            ) : (
                                                "Fornecido / VT"
                                            )}
                                        </span>
                                    </div>

                                    {/* Escala de Trabalho */}
                                    <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-1">
                                        <span className="block text-[9px] text-slate-400 uppercase font-black tracking-wider">Escala & Horário</span>
                                        <span className="text-sm font-bold text-slate-800 block">
                                            {vacancy.posto.schedule} ({vacancy.posto.startTime} - {vacancy.posto.endTime})
                                        </span>
                                    </div>

                                    {/* Adicionais se existirem */}
                                    {(vacancy.posto.insalubridade > 0 || vacancy.posto.periculosidade > 0 || vacancy.posto.gratificacao > 0 || vacancy.posto.outrosAdicionais > 0) && (
                                        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 col-span-1 sm:col-span-2 space-y-2">
                                            <span className="block text-[9px] text-slate-400 uppercase font-black tracking-wider">Adicionais Previstos</span>
                                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 font-semibold">
                                                {vacancy.posto.insalubridade > 0 && (
                                                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                                                        <span>Insalubridade:</span>
                                                        <span className="text-emerald-600 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vacancy.posto.insalubridade)}</span>
                                                    </div>
                                                )}
                                                {vacancy.posto.periculosidade > 0 && (
                                                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                                                        <span>Periculosidade:</span>
                                                        <span className="text-emerald-600 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vacancy.posto.periculosidade)}</span>
                                                    </div>
                                                )}
                                                {vacancy.posto.gratificacao > 0 && (
                                                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                                                        <span>Gratificação CCT:</span>
                                                        <span className="text-emerald-600 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vacancy.posto.gratificacao)}</span>
                                                    </div>
                                                )}
                                                {vacancy.posto.outrosAdicionais > 0 && (
                                                    <div className="flex justify-between border-b border-slate-200/60 pb-1">
                                                        <span>Outros Adicionais:</span>
                                                        <span className="text-emerald-600 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vacancy.posto.outrosAdicionais)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Description Box */}
                        {vacancy.description && (
                            <div className="space-y-3">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-indigo-600" />
                                    Detalhes da Vaga & Escala
                                </h3>
                                <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                                    {vacancy.description}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Submission Form Card */}
                    <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm">
                        <div className="space-y-1 mb-6">
                            <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Envie seu Currículo</h2>
                            <p className="text-xs text-slate-500 font-medium">Preencha os campos e anexe seu currículo para triagem automática.</p>
                        </div>
                        <PublicApplicationForm vacancyId={vacancy.id} />
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-400 mt-8 flex items-center justify-center gap-1.5 relative z-10 border-t border-slate-200/60 pt-6 max-w-4xl mx-auto w-full">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                <span className="uppercase font-bold tracking-wider">Processo de Inscrição Seguro e Criptografado &bull; JVS Facilities 2026</span>
            </div>
        </div>
    );
}
