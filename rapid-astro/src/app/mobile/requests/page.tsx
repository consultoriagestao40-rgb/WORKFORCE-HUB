import { getMobileRequests, cancelRequest } from "@/app/mobile/actions-requests";
import { NewRequestSheet } from "@/components/mobile/NewRequestSheet";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, Shirt, Briefcase, RefreshCcw, User, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const dynamic = 'force-dynamic';

async function getEmployees() {
    return await prisma.employee.findMany({
        where: { status: 'Ativo' },
        select: { id: true, name: true, role: { select: { name: true } } },
        orderBy: { name: 'asc' }
    });
}

function getIcon(type: string) {
    switch (type) {
        case 'FERIAS': return <Calendar className="w-5 h-5 text-orange-500" />;
        case 'MOVIMENTACAO': return <RefreshCcw className="w-5 h-5 text-blue-500" />;
        case 'UNIFORME': return <Shirt className="w-5 h-5 text-purple-500" />;
        case 'HORARIO': return <Clock className="w-5 h-5 text-green-500" />;
        default: return <Briefcase className="w-5 h-5 text-slate-500" />;
    }
}

function getStatusColor(status: string) {
    switch (status) {
        case 'PENDENTE': return 'bg-amber-100 text-amber-700';
        case 'EM_ANDAMENTO': return 'bg-blue-100 text-blue-700';
        case 'CONCLUIDO': return 'bg-emerald-100 text-emerald-700';
        case 'REJEITADO': return 'bg-red-100 text-red-700';
        case 'CANCELADO': return 'bg-slate-100 text-slate-500 line-through';
        default: return 'bg-slate-100 text-slate-700';
    }
}

export default async function MobileRequestsPage() {
    const requests: any = await getMobileRequests();
    const employees = await getEmployees();

    const employeeOptions = employees.map(e => ({
        id: e.id,
        name: e.name,
        roleName: e.role.name
    }));

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Minhas Solicitações</h1>
                <p className="text-sm text-slate-500 font-medium">Acompanhe seus chamados para o RH</p>
            </div>

            <div className="space-y-3">
                {requests.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                        <p>Nenhuma solicitação encontrada.</p>
                        <p className="text-xs mt-1">Clique no + para abrir um chamado.</p>
                    </div>
                ) : (
                    requests.map((req: any) => (
                        <div key={req.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2">
                                <Badge variant="secondary" className={`text-[10px] font-bold uppercase tracking-wider ${getStatusColor(req.status)} border-none`}>
                                    {req.status.replace('_', ' ')}
                                </Badge>
                            </div>

                            <div className="flex items-start gap-4 mb-3">
                                <div className="p-3 bg-slate-50 rounded-xl">
                                    {getIcon(req.type)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm leading-tight mb-1">
                                        {req.type === 'OUTROS' ? 'Assunto Geral' : req.type}
                                    </h3>
                                    <p className="text-xs text-slate-500 leading-relaxed font-medium line-clamp-2">
                                        {req.description}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-3 border-t border-slate-50 mt-2 justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold bg-slate-50 px-2 py-1 rounded-md">
                                        <Calendar className="w-3 h-3" />
                                        <span>Vence: {format(new Date(req.dueDate), 'dd/MM/yyyy')}</span>
                                    </div>
                                    {req.employee && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold bg-slate-50 px-2 py-1 rounded-md max-w-[100px] truncate">
                                            <User className="w-3 h-3" />
                                            <span className="truncate">{req.employee.name.split(' ')[0]}</span>
                                        </div>
                                    )}
                                </div>

                                {req.status === 'PENDENTE' && (
                                    <form action={cancelRequest.bind(null, req.id)}>
                                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-red-400 hover:text-red-500 hover:bg-red-50">
                                            <XCircle className="w-3 h-3 mr-1" /> Cancelar
                                        </Button>
                                    </form>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <NewRequestSheet employees={employeeOptions} />
        </div>
    );
}
