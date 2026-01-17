import { getAdminRequests, updateRequestStatus, deleteRequest } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Inbox, CheckCircle2, Clock, Trash2, UserCheck, MessageSquare } from "lucide-react";
import { ResolveRequestDialog } from "@/components/admin/ResolveRequestDialog";

export const dynamic = 'force-dynamic';

export default async function AdminRequestsPage() {
    const requests: any = await getAdminRequests();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-[0.3em] mb-2">
                        Service Desk
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Central de Solicitações</h1>
                    <p className="text-slate-500 font-medium italic">Gerencie demandas e tarefas operacionais</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                        <Inbox className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-bold text-slate-700">{requests.filter((r: any) => r.status === 'PENDENTE').length} Pendentes</span>
                    </div>
                </div>
            </div>

            <Card className="border-none shadow-xl bg-white/50 backdrop-blur-md">
                <CardHeader>
                    <CardTitle>Lista de Tarefas</CardTitle>
                    <CardDescription>Visualização de todas as solicitações abertas por supervisores.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[140px]">Status</TableHead>
                                <TableHead>Tipo / Assunto</TableHead>
                                <TableHead>Solicitante</TableHead>
                                <TableHead>Vencimento</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {requests.map((req: any) => (
                                <TableRow key={req.id} className="hover:bg-indigo-50/30 transition-colors">
                                    <TableCell>
                                        <div className="flex flex-col gap-2">
                                            <Badge className={`
                                                ${req.status === 'PENDENTE' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : ''}
                                                ${req.status === 'EM_ANDAMENTO' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : ''}
                                                ${req.status === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : ''}
                                                ${req.status === 'REJEITADO' ? 'bg-red-100 text-red-700 hover:bg-red-200' : ''}
                                                ${req.status === 'CANCELADO' ? 'bg-slate-100 text-slate-500 line-through' : ''}
                                                uppercase text-[10px] font-bold tracking-wider border-none w-fit
                                            `}>
                                                {req.status === 'EM_ANDAMENTO' ? 'ANDAMENTO' : req.status}
                                            </Badge>

                                            {req.resolver && (
                                                <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                                                    <UserCheck className="w-3 h-3" />
                                                    <span>{req.resolver.name.split(' ')[0]}</span>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800 text-sm">{req.type}</span>
                                            <span className="text-xs text-slate-500 line-clamp-1" title={req.description}>{req.description}</span>
                                            {req.resolutionNotes && (
                                                <div className="flex items-start gap-1 mt-1 text-[10px] text-emerald-600 bg-emerald-50 p-1.5 rounded-md">
                                                    <MessageSquare className="w-3 h-3 shrink-0 mt-0.5" />
                                                    <span className="italic line-clamp-2" title={req.resolutionNotes}>{req.resolutionNotes}</span>
                                                </div>
                                            )}
                                            {req.employee && (
                                                <span className="text-[10px] text-indigo-500 font-medium mt-1">Ref: {req.employee.name}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-slate-900">{req.requester.name}</span>
                                            <span className="text-[10px] text-slate-400">Supervisor</span>
                                            <span className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Aberto em: {format(new Date(req.createdAt), 'dd/MM/yyyy HH:mm')}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                            <Clock className="w-3 h-3 text-slate-400" />
                                            {format(new Date(req.dueDate), 'dd/MM/yyyy')}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {req.status !== 'CONCLUIDO' && req.status !== 'CANCELADO' && (
                                                <ResolveRequestDialog requestId={req.id} />
                                            )}

                                            {req.status === 'PENDENTE' && (
                                                <form action={updateRequestStatus.bind(null, req.id, 'EM_ANDAMENTO')}>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-500 hover:bg-blue-50" title="Marcar em Andamento">
                                                        <Clock className="w-4 h-4" />
                                                    </Button>
                                                </form>
                                            )}
                                            <form action={deleteRequest.bind(null, req.id)}>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </form>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {requests.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                                        Nenhuma solicitação encontrada.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
