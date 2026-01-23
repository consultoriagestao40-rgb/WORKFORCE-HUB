"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { User, Briefcase, FileText, Clock, MessageSquare, ShieldCheck, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface RequestDetailsSheetProps {
    request: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RequestDetailsSheet({ request, open, onOpenChange }: RequestDetailsSheetProps) {
    if (!request) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader className="pb-4 border-b">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <Badge variant="outline" className="mb-2 bg-indigo-50 text-indigo-700 border-indigo-200">
                                {request.type.replace(/_/g, " ")}
                            </Badge>
                            <SheetTitle className="text-xl">Detalhes da Solicitação</SheetTitle>
                            <SheetDescription>ID: {request.id}</SheetDescription>
                        </div>
                        <Badge className={`
                            ${request.status === 'PENDENTE' ? 'bg-amber-100 text-amber-700' : ''}
                            ${request.status === 'EM_ANDAMENTO' ? 'bg-blue-100 text-blue-700' : ''}
                            ${request.status === 'AGUARDANDO_APROVACAO' ? 'bg-purple-100 text-purple-700' : ''}
                            ${request.status === 'EM_ANALISE_RH' ? 'bg-pink-100 text-pink-700' : ''}
                            ${request.status === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-700' : ''}
                            ${request.status === 'REJEITADO' ? 'bg-red-100 text-red-700' : ''}
                            ${request.status === 'CANCELADO' ? 'bg-slate-100 text-slate-500' : ''}
                        `}>
                            {request.status.replace(/_/g, " ")}
                        </Badge>
                    </div>
                </SheetHeader>

                <div className="py-6 space-y-6">
                    {/* Requester Info */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-500" /> Solicitante
                        </h4>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
                            <p className="font-medium text-slate-700">{request.requester?.name || "N/A"}</p>
                            <p className="text-slate-500 text-xs">Aberto em: {format(new Date(request.createdAt), "dd/MM/yyyy 'às' HH:mm")}</p>
                        </div>
                    </div>

                    {/* Employee Info */}
                    {request.employee && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                <Briefcase className="w-4 h-4 text-slate-500" /> Colaborador Referência
                            </h4>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
                                <p className="font-medium text-slate-700">{request.employee.name}</p>
                                {request.employee.role && (
                                    <p className="text-slate-500 text-xs">{request.employee.role.name}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-500" /> Descrição
                        </h4>
                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-sm leading-relaxed text-slate-600">
                            {request.description}
                        </div>
                    </div>

                    {/* Resolution / Status Info */}
                    {(request.resolutionNotes || request.resolver) && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-slate-500" /> Resolução / Observações
                            </h4>
                            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-sm space-y-2">
                                {request.resolver && (
                                    <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Resolvido por: {request.resolver.name}
                                    </div>
                                )}
                                {request.resolutionNotes && (
                                    <p className="text-emerald-800 italic">"{request.resolutionNotes}"</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
