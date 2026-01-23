"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { transitionRequest } from "@/app/admin/requests/actions";
import { format } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertCircle, ArrowLeft, Clock, User, Briefcase, FileText, Settings } from "lucide-react";
import { RequestStageConfigDialog } from "./RequestStageConfigDialog";

export function RequestKanban({ requests }: RequestKanbanBoardProps) {
    const [actionRequest, setActionRequest] = useState<any>(null);
    const [actionType, setActionType] = useState<string | null>(null);
    const [comment, setComment] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Config Dialog State
    const [configOpen, setConfigOpen] = useState(false);
    const [configColumn, setConfigColumn] = useState<{ title: string, status: string } | null>(null);

    // Details Sheet State
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const openConfig = (col: any) => {
        // Map column ID to a representative status for configuration
        // We use the first status in the list as the key
        const status = col.status[0];
        setConfigColumn({ title: col.title, status });
        setConfigOpen(true);
    };

    const getRequestsByColumn = (colId: string) => {
        const statuses = COLUMNS.find(c => c.id === colId)?.status || [];
        return requests.filter(r => statuses.includes(r.status));
    };

    const handleAction = (e: React.MouseEvent, req: any, type: string) => {
        e.stopPropagation(); // Prevent card click
        setActionRequest(req);
        setActionType(type);
        setComment("");

        if (type === 'APPROVE_TO_RH') {
            handleTransition(req.id, 'EM_ANALISE_RH');
            return;
        }

        setIsDialogOpen(true);
    };

    const handleTransition = async (id: string, newStatus: string, notes?: string) => {
        try {
            await transitionRequest(id, newStatus, notes);
            toast.success("Solicitação atualizada com sucesso!");
            setIsDialogOpen(false);
        } catch (error) {
            toast.error("Erro ao atualizar solicitação.");
        }
    };

    const submitAction = () => {
        if (!actionRequest || !actionType) return;

        if (['RETURN_INFO', 'REJECT', 'CONCLUDE', 'CANCEL'].includes(actionType) && !comment.trim()) {
            toast.error("Comentário é obrigatório para esta ação.");
            return;
        }

        let newStatus = "";
        switch (actionType) {
            case 'RETURN_INFO': newStatus = 'PENDENTE'; break;
            case 'REJECT': newStatus = 'REJEITADO'; break;
            case 'CONCLUDE': newStatus = 'CONCLUIDO'; break;
            case 'CANCEL': newStatus = 'CANCELADO'; break;
        }

        if (newStatus) {
            handleTransition(actionRequest.id, newStatus, comment);
        }
    };

    const openDetails = (req: any) => {
        setSelectedRequest(req);
        setIsDetailsOpen(true);
    };

    return (
        <div className="flex h-full gap-4 overflow-x-auto pb-4 items-start min-h-[calc(100vh-200px)]">
            {COLUMNS.map(col => (
                <div key={col.id} className={`w-80 shrink-0 flex flex-col rounded-xl border border-slate-200 h-full max-h-full ${col.color || 'bg-slate-50/50'}`}>
                    <div className="p-3 border-b bg-white/60 backdrop-blur rounded-t-xl sticky top-0 z-10 flex justify-between items-center group/header">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">{col.title}</h3>
                            <Badge variant="secondary" className="bg-white/80 text-slate-600 border border-slate-100 shadow-sm text-xs px-1.5 h-5">
                                {getRequestsByColumn(col.id).length}
                            </Badge>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 opacity-0 group-hover/header:opacity-100 transition-opacity hover:text-indigo-600 hover:bg-indigo-50"
                            onClick={() => openConfig(col)}
                        >
                            <Settings className="w-3.5 h-3.5" />
                        </Button>
                    </div>

                    <div className="p-2 space-y-3 overflow-y-auto flex-1 h-full min-h-[200px]">
                        {getRequestsByColumn(col.id).map(req => (
                            <Card
                                key={req.id}
                                className="bg-white shadow-sm border-slate-200 hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
                                onClick={() => openDetails(req)}
                            >
                                <CardContent className="p-3 space-y-3">
                                    {/* Header: Type */}
                                    <div className="flex justify-between items-start gap-2">
                                        <Badge variant="outline" className="font-bold border-indigo-100 bg-indigo-50 text-indigo-700 text-[10px] break-normal whitespace-normal text-left">
                                            {req.type.replace(/_/g, " ")}
                                        </Badge>
                                        {/* Show Status Badge only in mixed/closed columns if needed, or always? User requested separation so maybe redundant, but keeping for clarity if specific status matters (e.g. Cancelado vs Rejeitado) */}
                                        {(col.id === 'CONCLUIDOS' || col.id === 'REPROVADO_CANCELADO') && (
                                            <Badge className={`text-[9px] h-5 px-1.5 ${req.status === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-700' :
                                                req.status === 'REJEITADO' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
                                                } border-none`}>
                                                {req.status}
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Body */}
                                    <div className="space-y-1.5 text-xs text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span className="truncate" title={req.requester.name}>Req: <strong>{req.requester.name}</strong></span>
                                        </div>
                                        {req.employee && (
                                            <div className="flex items-center gap-2">
                                                <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="truncate" title={req.employee.name}>Colab: {req.employee.name}</span>
                                            </div>
                                        )}

                                        <div className="flex items-start gap-2 pt-1 border-t border-slate-100 mt-2">
                                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                            <p className="line-clamp-3 text-slate-500 leading-tight">
                                                {req.description}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>

                                {/* Actions Footer - Only for Active Columns */}
                                {['SOLICITACAO', 'APROVACAO', 'RH_DP'].includes(col.id) && (
                                    <div className="p-2 border-t bg-slate-50/50 flex flex-wrap gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                                        {col.id === 'SOLICITACAO' && (
                                            <Button size="sm" variant="outline" className="h-7 text-xs bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 w-full"
                                                onClick={(e) => handleAction(e, req, 'AGUARDANDO_APROVACAO')} // Should map to a transition or direct? Wait, handleAction usage is generic. Let's fix.
                                            >
                                                Enviar p/ Aprovação
                                            </Button>
                                        )}

                                        {col.id === 'APROVACAO' && (
                                            <>
                                                <Button size="sm" variant="outline" className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                                                    onClick={(e) => handleAction(e, req, 'RETURN_INFO')}
                                                >
                                                    <ArrowLeft className="w-3 h-3 mr-1" /> Info
                                                </Button>
                                                <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50"
                                                    onClick={(e) => handleAction(e, req, 'REJECT')}
                                                >
                                                    <XCircle className="w-3 h-3 mr-1" /> Reprovar
                                                </Button>
                                                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                                    onClick={(e) => handleAction(e, req, 'APPROVE_TO_RH')}
                                                >
                                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Aprovar
                                                </Button>
                                            </>
                                        )}

                                        {col.id === 'RH_DP' && (
                                            <>
                                                <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50"
                                                    onClick={(e) => handleAction(e, req, 'CANCEL')}
                                                >
                                                    Cancelar
                                                </Button>
                                                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white flex-1"
                                                    onClick={(e) => handleAction(e, req, 'CONCLUDE')}
                                                >
                                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Concluir
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                </div>
            ))}

            <RequestDetailsSheet
                request={selectedRequest}
                open={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
            />

            {configColumn && (
                <RequestStageConfigDialog
                    open={configOpen}
                    onOpenChange={setConfigOpen}
                    columnTitle={configColumn.title}
                    targetStatus={configColumn.status}
                />
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {actionType === 'RETURN_INFO' && "Solicitar Mais Informações"}
                            {actionType === 'REJECT' && "Reprovar Solicitação"}
                            {actionType === 'CONCLUDE' && "Concluir Solicitação"}
                            {actionType === 'CANCEL' && "Cancelar Solicitação"}
                            {actionType === 'AGUARDANDO_APROVACAO' && "Enviar para Aprovação"}
                        </DialogTitle>
                        <DialogDescription>
                            {actionType === 'AGUARDANDO_APROVACAO'
                                ? "Confirma o envio desta solicitação para a etapa de aprovação?"
                                : "Adicione um comentário obrigatório para prosseguir."
                            }
                        </DialogDescription>
                    </DialogHeader>

                    {actionType !== 'AGUARDANDO_APROVACAO' && (
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label>Comentário / Observação</Label>
                                <Textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Digite aqui..."
                                    className="min-h-[100px]"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={() => {
                            if (actionType === 'AGUARDANDO_APROVACAO') {
                                handleTransition(actionRequest.id, 'AGUARDANDO_APROVACAO');
                            } else {
                                submitAction();
                            }
                        }}>Confirmar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
