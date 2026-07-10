import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Briefcase, MapPin, Building, Calendar, ShieldCheck } from "lucide-react";
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
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto w-full bg-slate-800/80 backdrop-blur border border-slate-700/50 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-8">
                {/* Header / Brand */}
                <div className="text-center pb-6 border-b border-slate-700/50">
                    <div className="text-2xl font-black tracking-widest text-indigo-400 uppercase">
                        Work Force Hub
                    </div>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">Portal de Candidatos</p>
                </div>

                {/* Vaga Info */}
                <div className="space-y-4">
                    <div className="space-y-1">
                        <div className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Oportunidade de Trabalho</div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{vacancy.title}</h1>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div className="flex items-center gap-3 text-slate-300">
                            <Briefcase className="w-5 h-5 text-indigo-400 shrink-0" />
                            <div>
                                <span className="block text-[10px] text-slate-500 uppercase font-semibold">Função/Cargo</span>
                                <span className="text-sm font-medium">{vacancy.role?.name || "Geral"}</span>
                            </div>
                        </div>

                        {vacancy.posto?.client?.address && (
                            <div className="flex items-center gap-3 text-slate-300">
                                <MapPin className="w-5 h-5 text-indigo-400 shrink-0" />
                                <div>
                                    <span className="block text-[10px] text-slate-500 uppercase font-semibold">Local de Trabalho</span>
                                    <span className="text-sm font-medium truncate max-w-[280px]" title={vacancy.posto.client.address}>
                                        {vacancy.posto.client.address}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3 text-slate-300">
                            <Building className="w-5 h-5 text-indigo-400 shrink-0" />
                            <div>
                                <span className="block text-[10px] text-slate-500 uppercase font-semibold">Empresa Contratante</span>
                                <span className="text-sm font-medium">{vacancy.company?.name || "JVS Facilities"}</span>
                            </div>
                        </div>

                        {vacancy.plannedStartDate && (
                            <div className="flex items-center gap-3 text-slate-300">
                                <Calendar className="w-5 h-5 text-indigo-400 shrink-0" />
                                <div>
                                    <span className="block text-[10px] text-slate-500 uppercase font-semibold">Previsão de Início</span>
                                    <span className="text-sm font-medium">
                                        {new Date(vacancy.plannedStartDate).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Vaga Descrição */}
                {vacancy.description && (
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/30">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Descrição & Requisitos</h2>
                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{vacancy.description}</p>
                    </div>
                )}

                {/* Formulario */}
                <div className="pt-6 border-t border-slate-700/50">
                    <h2 className="text-lg font-bold text-white mb-4">Envie seu Currículo</h2>
                    <PublicApplicationForm vacancyId={vacancy.id} />
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-slate-600 mt-8 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-slate-600" />
                <span>Processo seletivo seguro e protegido. JVS Facilities &copy; 2026</span>
            </div>
        </div>
    );
}
