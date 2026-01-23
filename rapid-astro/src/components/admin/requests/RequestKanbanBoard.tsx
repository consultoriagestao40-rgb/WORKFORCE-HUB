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
import { CheckCircle2, XCircle, AlertCircle, ArrowLeft, Clock, User, Briefcase, FileText } from "lucide-react";

interface RequestKanbanBoardProps {
    requests: any[];
}

const COLUMNS = [
    { id: 'SOLICITACAO', title: 'Solicitação', status: ['PENDENTE', 'EM_ANDAMENTO'] },
    { id: 'APROVACAO', title: 'Aprovação', status: ['AGUARDANDO_APROVACAO'] },
    { id: 'RH_DP', title: 'RH / DP', status: ['EM_ANALISE_RH'] },
    { id: 'CONCLUIDO', title: 'Arquivados', status: ['CONCLUIDO', 'REJEITADO', 'CANCELADO'] }
];

export function RequestKanbanBoard({ requests }: RequestKanbanBoardProps) {
    const [actionRequest, setActionRequest] = useState<any>(null);
    const [actionType, setActionType] = useState<string | null>(null);
    const [comment, setComment] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const getRequestsByColumn = (colId: string) => {
        const statuses = COLUMNS.find(c => c.id === colId)?.status || [];
        return requests.filter(r => statuses.includes(r.status));
    };

    const handleAction = (req: any, type: string) => {
        setActionRequest(req);
        setActionType(type);
        setComment("");

        // Immediate actions without comment?
        // User said:
        // Etapa 2: Aprovado -> next. Reprovado -> archived. Info -> back. (Info needs comment usually)
        // Etapa 3: Concluir/Cancelar -> Mandatory comment.

        // Let's force modal for everything to be safe and consistent, except maybe "Approve" (unless user wants optional comment)
        // But simplifying: open modal for all transitions that define a flow change just to be safe.

        if (type === 'APPROVE_TO_RH') {
            // Direct? Or Optional comment? Let's do direct for speed if no strict rule.
            // "Aprovação do Diretor Cristiano nessa etapa terás botão aprovado > vai para próxima tapa"
            // Let's assume direct is OK.
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

    // Helper to move from Solicitação to Aprovação (Simulating "Done" in step 1 or auto?)
    // "Etapa 01... fica as solicitações".
    // Director probably picks from there? Or someone moves it to Approval?
    // Let's assume there is a "Enviar para Aprovação" button in Step 1.

    return (
        <div className="flex h-full gap-4 overflow-x-auto pb-4 items-start min-h-[calc(100vh-200px)]">
            {COLUMNS.map(col => (
                <div key={col.id} className="w-80 shrink-0 flex flex-col bg-slate-50/50 rounded-xl border border-slate-200 h-full max-h-full">
                    <div className="p-3 border-b bg-white/50 backdrop-blur rounded-t-xl sticky top-0 z-10 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700">{col.title}</h3>
                        <Badge variant="secondary" className="bg-slate-200 text-slate-600 border-none">
                            {getRequestsByColumn(col.id).length}
                        </Badge>
                    </div>

                    <div className="p-2 space-y-3 overflow-y-auto flex-1 h-full min-h-[200px]">
                        {getRequestsByColumn(col.id).map(req => (
                            <Card key={req.id} className="bg-white shadow-sm border-slate-200 hover:shadow-md transition-shadow group">
                                <CardContent className="p-3 space-y-3">
                                    {/* Header: Type and Status */}
                                    <div className="flex justify-between items-start gap-2">
                                        <Badge variant="outline" className="font-bold border-indigo-100 bg-indigo-50 text-indigo-700 text-[10px] break-normal whitespace-normal text-left">
                                            {req.type.replace(/_/g, " ")}
                                        </Badge>
                                        {/* Status Badge only if Archived/Mixed */}
                                        {col.id === 'CONCLUIDO' && (
                                            <Badge className={`text-[9px] h-5 px-1.5 ${req.status === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-700' :
                                                    req.status === 'REJEITADO' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
                                                } border-none`}>
                                                {req.status}
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Body: Requester, Employee, Posto */}
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
                                        {/* Posto isn't directly on Request but usually linked via Employee or Description? 
                                            Schema says Request -> Employee. Employee -> Assignments -> Posto.
                                            Or standard Description. Assuming we show what we have.
                                        */}

                                        <div className="flex items-start gap-2 pt-1 border-t border-slate-100 mt-2">
                                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                            <p className="line-clamp-3 text-slate-500 leading-tight">
                                                {req.description}
                                            </p>
                                        </div>

                                        {/* Resolution Notes (Visible in body) */}
                                        {req.resolutionNotes && (
                                            <div className="bg-emerald-50 text-emerald-700 p-2 rounded text-[10px] mt-2 border border-emerald-100">
                                                <strong>Obs:</strong> {req.resolutionNotes}
                                            </div>
                                        )}

                                        <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-1">
                                            <Clock className="w-3 h-3" />
                                            {format(new Date(req.createdAt), "dd/MM/yyyy HH:mm")}
                                        </div>
                                    </div>
                                </CardContent>

                                {/* Actions Footer */}
                                {col.id !== 'CONCLUIDO' && (
                                    <div className="p-2 border-t bg-slate-50/50 flex flex-wrap gap-2 justify-end">
                                        {col.id === 'SOLICITACAO' && (
                                            <Button size="sm" variant="outline" className="h-7 text-xs bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 w-full"
                                                onClick={() => handleTransition(req.id, 'AGUARDANDO_APROVACAO')}
                                            >
                                                Enviar p/ Aprovação
                                            </Button>
                                        )}

                                        {col.id === 'APROVACAO' && (
                                            <>
                                                <Button size="sm" variant="outline" className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                                                    onClick={() => handleAction(req, 'RETURN_INFO')}
                                                >
                                                    <ArrowLeft className="w-3 h-3 mr-1" /> Info
                                                </Button>
                                                <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50"
                                                    onClick={() => handleAction(req, 'REJECT')}
                                                >
                                                    <XCircle className="w-3 h-3 mr-1" /> Reprovar
                                                </Button>
                                                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                                    onClick={() => handleAction(req, 'APPROVE_TO_RH')}
                                                >
                                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Aprovar
                                                </Button>
                                            </>
                                        )}

                                        {col.id === 'RH_DP' && (
                                            <>
                                                <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50"
                                                    onClick={() => handleAction(req, 'CANCEL')}
                                                >
                                                    Cancelar
                                                </Button>
                                                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white flex-1"
                                                    onClick={() => handleAction(req, 'CONCLUDE')}
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

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {actionType === 'RETURN_INFO' && "Solicitar Mais Informações"}
                            {actionType === 'REJECT' && "Reprovar Solicitação"}
                            {actionType === 'CONCLUDE' && "Concluir Solicitação"}
                            {actionType === 'CANCEL' && "Cancelar Solicitação"}
                        </DialogTitle>
                        <DialogDescription>
                            Adicione um comentário obrigatório para prosseguir.
                        </DialogDescription>
                    </DialogHeader>
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
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={submitAction}>Confirmar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
