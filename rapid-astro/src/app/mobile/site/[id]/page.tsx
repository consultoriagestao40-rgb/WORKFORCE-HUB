import { prisma } from "@/lib/db";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Phone, MapPin } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MobileActionButtons } from "@/components/mobile/MobileActionButtons";

export const dynamic = "force-dynamic";

async function getPostoDetails(id: string) {
    const posto = await prisma.posto.findUnique({
        where: { id },
        include: {
            client: true,
            role: true,
            assignments: {
                where: { endDate: null },
                include: { employee: true }
            }
        }
    });
    return posto;
}

export default async function PostoDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const posto = await getPostoDetails(id);

    if (!posto) {
        return <div className="p-8 text-center text-slate-500">Posto não encontrado</div>;
    }

    const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

    return (
        <div className="space-y-6 pb-20 animate-in slide-in-from-right duration-500">
            {/* Header / Nav Back */}
            <div className="flex items-center gap-2 mb-2">
                <Link href="/mobile">
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-lg font-bold leading-none">{posto.client.name}</h1>
                    <p className="text-xs text-slate-500">{posto.role.name}</p>
                </div>
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                    {posto.schedule}
                </Badge>
            </div>

            {/* Quick Info Card */}
            <Card className="border-none shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                <CardContent className="p-4 space-y-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Horário</p>
                            <p className="text-2xl font-bold">{posto.startTime} - {posto.endTime}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Efetivo</p>
                            <p className="text-2xl font-bold">{posto.assignments.length}</p>
                        </div>
                    </div>
                    {posto.client.address && (
                        <div className="flex items-center text-xs text-slate-300">
                            <MapPin className="w-3.5 h-3.5 mr-1" />
                            <span className="truncate">{posto.client.address}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Daily Roster Section */}
            <div>
                <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="font-bold text-slate-800">Quadro de Hoje</h2>
                    <span className="text-xs font-medium text-slate-500 capitalize">{today}</span>
                </div>

                <div className="space-y-3">
                    {/* Fixed Assignments */}
                    {posto.assignments.map((assign) => (
                        <div key={assign.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                    <AvatarFallback className="bg-slate-100 text-slate-600 font-bold">
                                        {assign.employee.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">
                                        {assign.employee.name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Matrícula: {assign.employee.id.substring(0, 6)}
                                    </p>
                                </div>
                                <Button size="icon" variant="ghost" className="text-slate-400 hover:text-indigo-600 rounded-full h-8 w-8">
                                    <Phone className="w-4 h-4" />
                                </Button>
                            </div>

                            {/* Action Buttons */}
                            <MobileActionButtons
                                employeeId={assign.employee.id}
                                postoId={posto.id}
                                employeeName={assign.employee.name}
                            />
                        </div>
                    ))}

                    {posto.assignments.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            Nenhum colaborador fixo escalado.
                        </div>
                    )}

                    {/* Actions Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200 mt-4">
                        <Link href={`/mobile/site/${id}/coverage`} className="w-full">
                            <Button variant="secondary" className="w-full border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 h-12">
                                + Cobertura
                            </Button>
                        </Link>
                        <Link href={`/mobile/site/${id}/occurrence/new`} className="w-full">
                            <Button variant="outline" className="w-full border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 h-12">
                                ! Registrar Ocorrência
                            </Button>
                        </Link>
                    </div>

                    {/* List Active Coverages for Today (Ideally filter by date in query) */}
                    {/* For MVP we only show button, but ideally we should show coverages too. */}
                    {/* Let's skip listing coverages for this exact step unless requested,
                        but user said "lançar cobertura". Showing them gives feedback.
                        I'll add it in next iteration if needed or if I can fetch it now.
                    */}
                </div>
            </div>
        </div>
    );
}
