import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Scale, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PrintButtonClient } from "./PrintButtonClient"; // Client component to trigger window.print()

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ token: string }>;
}

export default async function DisciplinaryPrintPage({ params }: PageProps) {
    const { token } = await params;

    const measure = await prisma.disciplinaryMeasure.findUnique({
        where: { token },
        include: {
            employee: {
                include: {
                    company: true,
                    role: true
                }
            }
        }
    });

    if (!measure) {
        notFound();
    }

    const formattedOccurrenceDate = format(new Date(measure.occurrenceDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const formattedTodayDate = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    
    // Capitalize type for title
    const docTitle = measure.type === "SUSPENSAO" ? "COMUNICADO DE SUSPENSÃO DISCIPLINAR" : "COMUNICADO DE ADVERTÊNCIA ESCRITA";
    const cltText = measure.cltArticle || "Artigo 482 da CLT";

    return (
        <div className="min-h-screen bg-slate-100 py-8 px-4 flex flex-col items-center">
            {/* Top Toolbar (Hidden on print) */}
            <div className="w-full max-w-[800px] mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow border border-slate-200 print:hidden">
                <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-rose-600" />
                    <span className="text-sm font-bold text-slate-800">Visualização de Impressão</span>
                </div>
                <PrintButtonClient />
            </div>

            {/* A4 Sheet Container */}
            <div className="w-full max-w-[800px] bg-white p-12 md:p-16 border border-slate-300 shadow-2xl print:shadow-none print:border-none print:p-0 flex flex-col justify-between min-h-[1100px] font-serif text-slate-900">
                {/* Header */}
                <div className="space-y-6">
                    <div className="border-b-2 border-slate-900 pb-4 text-center">
                        <h2 className="text-xl font-bold tracking-wider">{measure.employee.company?.name?.toUpperCase() || "WORKFORCE HUB GESTÃO"}</h2>
                        <p className="text-[10px] uppercase font-sans text-slate-500 mt-1">Comunicação Formal de Medida Administrativa</p>
                    </div>

                    <div className="text-center my-8">
                        <h1 className="text-lg font-black underline tracking-wide decoration-1">{docTitle}</h1>
                    </div>

                    {/* Employee Info Box */}
                    <div className="border border-slate-800 p-4 font-sans text-xs space-y-2 mb-8 bg-slate-50/50">
                        <div><strong>Ao(À) Empregado(a):</strong> {measure.employee.name}</div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><strong>Cargo/Função:</strong> {measure.employee.role?.name || "Não especificado"}</div>
                            <div><strong>CPF:</strong> {measure.employee.cpf || "Não cadastrado"}</div>
                        </div>
                        <div><strong>Setor/Unidade:</strong> {measure.employee.company?.name || "Não especificado"}</div>
                    </div>

                    {/* Body Text */}
                    <div className="text-sm leading-relaxed text-justify space-y-6 font-serif">
                        <p>
                            Vimos por meio deste comunicado formal notificá-lo(a) da aplicação da medida disciplinar de 
                            <strong> {measure.type === "SUSPENSAO" ? "SUSPENSÃO DO TRABALHO" : "ADVERTÊNCIA ESCRITA"}</strong>, 
                            em virtude da seguinte ocorrência registrada no dia <strong>{formattedOccurrenceDate}</strong>:
                        </p>

                        <div className="pl-6 pr-4 py-2 border-l-4 border-slate-400 italic bg-slate-50 font-sans text-xs text-slate-800 my-4 whitespace-pre-wrap leading-relaxed">
                            "{measure.description}"
                        </div>

                        <p>
                            Esclarecemos que esta conduta constitui ato passível de punição, em conformidade com as regras internas da empresa e com o 
                            <strong> {cltText}</strong>.
                        </p>

                        <p>
                            Esperamos que tais atitudes não voltem a ocorrer, servindo este instrumento para que você possa reavaliar sua conduta profissional. 
                            Salientamos que a reincidência de comportamentos incompatíveis com as normas da empresa poderá ensejar a aplicação de sanções mais graves, 
                            inclusive a rescisão contratual por justa causa, nos termos da legislação vigente.
                        </p>

                        <p className="pt-4">
                            Por favor, firme o seu ciente na via de cópia deste documento.
                        </p>
                    </div>
                </div>

                {/* Footer and Signatures */}
                <div className="space-y-12 pt-16">
                    <div className="text-right text-sm">
                        Curitiba, {formattedTodayDate}.
                    </div>

                    {/* Signature Lines */}
                    <div className="space-y-12">
                        <div className="grid grid-cols-2 gap-8 text-center text-xs">
                            <div className="space-y-1">
                                <div className="border-t border-slate-900 pt-2 w-full mx-auto max-w-[280px]"></div>
                                <p className="font-bold">{measure.employee.company?.name || "A Empregadora"}</p>
                                <p className="text-slate-500 font-sans text-[10px]">Representante Legal</p>
                            </div>
                            <div className="space-y-1">
                                <div className="border-t border-slate-900 pt-2 w-full mx-auto max-w-[280px]"></div>
                                <p className="font-bold">{measure.employee.name}</p>
                                <p className="text-slate-500 font-sans text-[10px]">Assinatura do Empregado (Ciente)</p>
                            </div>
                        </div>

                        {/* Witnesses block */}
                        <div className="space-y-2">
                            <p className="text-xs font-bold font-sans text-slate-500">Testemunhas (Caso haja recusa de assinatura):</p>
                            <div className="grid grid-cols-2 gap-8 text-center text-xs pt-6">
                                <div className="space-y-1">
                                    <div className="border-t border-slate-900 pt-2 w-full mx-auto max-w-[280px]"></div>
                                    <p className="text-slate-500 font-sans text-[10px]">Testemunha 1 (Nome e CPF/RG)</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="border-t border-slate-900 pt-2 w-full mx-auto max-w-[280px]"></div>
                                    <p className="text-slate-500 font-sans text-[10px]">Testemunha 2 (Nome e CPF/RG)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
