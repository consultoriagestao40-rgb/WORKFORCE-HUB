import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { completeDisciplinaryMeasure } from "@/app/actions";
import { Scale, Printer, CheckCircle, FileUp, AlertTriangle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { UploadFormClient } from "./UploadFormClient"; // We will build a client component for the upload state handling

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ token: string }>;
}

export default async function DisciplinaryUploadPage({ params }: PageProps) {
    const { token } = await params;

    const measure = await prisma.disciplinaryMeasure.findUnique({
        where: { token },
        include: {
            employee: {
                include: {
                    company: true,
                    role: true
                }
            },
            supervisor: true
        }
    });

    if (!measure) {
        notFound();
    }

    const formattedDate = new Date(measure.occurrenceDate).toLocaleDateString("pt-BR");
    const formattedCreatedDate = new Date(measure.createdAt).toLocaleDateString("pt-BR");

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                {/* Header */}
                <div className="bg-rose-600 p-6 text-white flex items-center gap-3">
                    <Scale className="w-8 h-8 shrink-0 bg-white/10 p-1.5 rounded-lg" />
                    <div>
                        <h1 className="text-lg font-black uppercase tracking-wider">Workforce Hub</h1>
                        <p className="text-xs text-rose-100">Medida Disciplinar Administrativa</p>
                    </div>
                </div>

                {measure.status === "CONCLUIDO" ? (
                    <div className="p-8 text-center space-y-4">
                        <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
                        <h2 className="text-xl font-bold text-slate-800">Assinatura Concluída!</h2>
                        <p className="text-xs text-slate-500">
                            A via assinada deste documento já foi enviada de volta e arquivada com sucesso no perfil de <strong>{measure.employee.name}</strong>.
                        </p>
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-left text-xs space-y-1 text-slate-600">
                            <div><strong>Colaborador:</strong> {measure.employee.name}</div>
                            <div><strong>Tipo:</strong> {measure.type === "ADVERTENCIA" ? "Advertência Escrita" : "Suspensão"}</div>
                            <div><strong>Concluído em:</strong> {measure.completedAt ? new Date(measure.completedAt).toLocaleString("pt-BR") : ""}</div>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 space-y-6">
                        {/* Summary */}
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Colaborador</h3>
                                <p className="text-sm font-bold text-slate-800">{measure.employee.name}</p>
                                <p className="text-xs text-slate-500">{measure.employee.role.name} • {measure.employee.company?.name || "Sem Empresa"}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tipo de Medida</h3>
                                    <p className="text-xs font-bold text-slate-700">{measure.type === "ADVERTENCIA" ? "Advertência Escrita" : "Suspensão"}</p>
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Data da Ocorrência</h3>
                                    <p className="text-xs font-bold text-slate-700">{formattedDate}</p>
                                </div>
                            </div>

                            {measure.cltArticle && (
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Enquadramento Legal</h3>
                                    <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded px-2.5 py-1 mt-0.5 inline-block">{measure.cltArticle}</p>
                                </div>
                            )}

                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Motivo / Descrição</h3>
                                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed italic">{measure.description}</p>
                            </div>

                            <div className="border-t pt-4 space-y-3">
                                <h4 className="text-xs font-bold text-slate-700">Etapa 1: Imprimir e Assinar</h4>
                                <p className="text-xs text-slate-500">
                                    Visualize a folha preenchida oficial, imprima-a e recolha a assinatura física do colaborador.
                                </p>
                                <a
                                    href={`/disciplinary-print/${token}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-md"
                                >
                                    <Printer className="w-4 h-4" />
                                    Visualizar Medida para Impressão
                                </a>
                            </div>

                            <div className="border-t pt-4 space-y-3">
                                <h4 className="text-xs font-bold text-slate-700">Etapa 2: Upload do Documento Assinado</h4>
                                <p className="text-xs text-slate-500">
                                    Tire uma foto legível ou escaneie o documento assinado e envie abaixo para concluir e arquivar.
                                </p>
                                
                                <UploadFormClient token={token} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="mt-6 text-center text-[10px] text-slate-400">
                Workforce Hub © {new Date().getFullYear()} • Sistema de Gestão Interna
            </div>
        </div>
    );
}
