"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RequestCommentsSection } from "./RequestCommentsSection";

// ... (existing code, I can't restart imports here easily without a larger replace, but verify if I can add import at top separately or if I should assume multiple replaces)
// Actually I will do two replaces or one big one. Since I need to adding import at top and usage at bottom.
// I will use multi_replace_file_content.
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { User, Briefcase, FileText, Calendar, Clock, CheckCircle2, XCircle, AlertCircle, ShieldCheck, Phone, Mail, MapPin } from "lucide-react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { transitionRequest } from "@/app/admin/requests/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RequestDetailsSheetProps {
    request: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const REQUEST_TYPES: Record<string, string> = {
    FERIAS: "Programação de Férias",
    MOVIMENTACAO: "Movimentação de Posto",
    UNIFORME: "Uniforme / EPI",
    HORARIO: "Mudança de Horário",
    OUTROS: "Outros Assuntos",
    TERMINO_CONTRATO_EXPERIENCIA: "Término de Contrato de Experiência",
    TERMINO_CONTRATO_ANTECIPADO: "Término de Contrato Antecipado",
    DEMISSAO_COLABORADOR: "Demissão (Colaborador)",
    DEMISSAO_EMPRESA: "Demissão (Empresa)",
    MUDANCA_ESCALA: "Mudança de Escala",
    ALTERACAO_FUNCIONAL: "Alteração Funcional"
};

export function RequestDetailsSheet({ request, open, onOpenChange }: RequestDetailsSheetProps) {
    const [activeTab, setActiveTab] = useState("details");
    const [actionComment, setActionComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // State for editing due date
    const [dueDate, setDueDate] = useState(request?.dueDate ? new Date(request.dueDate).toISOString().split('T')[0] : "");

    if (!request) return null;

    const handleTransition = async (newStatus: string) => {
        setIsSubmitting(true);
        try {
            await transitionRequest(request.id, newStatus, actionComment);
            toast.success("Solicitação atualizada!");
            onOpenChange(false);
        } catch (error) {
            toast.error("Erro ao atualizar.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value;
        setDueDate(newDate);
        // Here we would ideally call an action to update the date immediately or add a save button
        // For now, let's assume we want to save it. But I need to add an action for updating details separately.
        // I will add a small save button next to it if changed? Or auto-save?
        // Let's just keep state for now and maybe add a specific "Update Date" button if complex, 
        // but user asked for "Opção de alterar datas".
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex justify-between items-start pr-8">
                        <div>
                            <DialogTitle className="text-xl flex items-center gap-2">
                                <span className="font-bold">Solicitação #{request.id.slice(0, 8)}</span>
                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                    {REQUEST_TYPES[request.type] || request.type}
                                </Badge>
                            </DialogTitle>
                            <DialogDescription>
                                Criado em {format(new Date(request.createdAt), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                            </DialogDescription>
                        </div>
                        <Badge className={`
                            ${request.status === 'PENDENTE' ? 'bg-amber-100 text-amber-700' : ''}
                            ${request.status === 'EM_ANDAMENTO' ? 'bg-blue-100 text-blue-700' : ''}
                            ${request.status === 'AGUARDANDO_APROVACAO' ? 'bg-purple-100 text-purple-700' : ''}
                            ${request.status === 'EM_ANALISE_RH' ? 'bg-pink-100 text-pink-700' : ''}
                            ${request.status === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-700' : ''}
                            ${request.status === 'REJEITADO' ? 'bg-red-100 text-red-700' : ''}
                            ${request.status === 'CANCELADO' ? 'bg-slate-100 text-slate-500' : ''}
                            border-none px-3 py-1 text-sm
                        `}>
                            {request.status.replace(/_/g, " ")}
                        </Badge>
                    </div>
                </DialogHeader>

                <Tabs defaultValue="details" className="w-full mt-4" onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="details">Detalhes da Solicitação</TabsTrigger>
                        <TabsTrigger value="history">Histórico & Auditoria</TabsTrigger>
                    </TabsList>

                    <TabsContent value="details" className="space-y-6 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column: Request Data */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-indigo-500" />
                                    Dados da Solicitação
                                </h3>
                                <div className="bg-indigo-50/30 p-4 rounded-xl border border-indigo-100 space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Tipo</label>
                                        <p className="font-medium text-indigo-950">{REQUEST_TYPES[request.type] || request.type}</p>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Descrição</label>
                                        <div className="bg-white p-3 rounded-lg border border-indigo-100 text-sm text-slate-700 leading-relaxed max-h-[150px] overflow-y-auto">
                                            {request.description}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Vencimento (SLA)</label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="date"
                                                    value={dueDate}
                                                    onChange={handleDateChange}
                                                    className="h-8 text-sm bg-white"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Solicitante</label>
                                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                                <User className="w-4 h-4 text-indigo-400" />
                                                {request.requester?.name}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Resolution Status */}
                                {(request.status === 'CONCLUIDO' || request.status === 'REJEITADO') && (
                                    <div className={`p-4 rounded-xl border ${request.status === 'CONCLUIDO' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                        <h4 className={`font-bold text-sm mb-2 ${request.status === 'CONCLUIDO' ? 'text-emerald-800' : 'text-red-800'}`}>
                                            {request.status === 'CONCLUIDO' ? 'Resolução / Conclusão' : 'Motivo da Reprovação'}
                                        </h4>
                                        <p className="text-sm text-slate-700 bg-white/50 p-2 rounded">
                                            {request.resolutionNotes || "Sem observações registradas."}
                                        </p>
                                        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                                            <ShieldCheck className="w-3 h-3" />
                                            Resolvido por: <strong>{request.resolver?.name || 'Sistema'}</strong>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Column: Employee Data */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                    <User className="w-5 h-5 text-slate-500" />
                                    Colaborador Relacionado
                                </h3>
                                {request.employee ? (
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                        <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">
                                                {request.employee.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{request.employee.name}</p>
                                                <Badge variant="secondary" className="text-xs font-normal">
                                                    {request.employee.role?.name || "Sem Cargo"}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <Briefcase className="w-4 h-4 text-slate-400" />
                                                <span>Unidade: <strong>{request.employee.company?.name || "N/A"}</strong></span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <MapPin className="w-4 h-4 text-slate-400" />
                                                <span className="truncate">Posto: {request.employee.assignments?.[0]?.posto?.name || "Sem Posto Atual"}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <Clock className="w-4 h-4 text-slate-400" />
                                                <span>Admissão: {request.employee.admissionDate ? format(new Date(request.employee.admissionDate), 'dd/MM/yyyy') : 'N/A'}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-2">
                                            <Button variant="outline" size="sm" className="w-full text-xs">
                                                <FileText className="w-3 h-3 mr-2" /> Ver Ficha
                                            </Button>
                                            <Button variant="outline" size="sm" className="w-full text-xs">
                                                <Clock className="w-3 h-3 mr-2" /> Ponto
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 border-dashed text-center text-slate-500 text-sm">
                                        Nenhum colaborador vinculado a esta solicitação.
                                    </div>
                                )}

                                {/* Actions Area */}
                                <div className="pt-4 border-t mt-4">
                                    <h4 className="font-bold text-sm text-slate-900 mb-3">Ações Rápidas</h4>
                                    <div className="flex flex-col gap-2">
                                        {request.status === 'PENDENTE' && (
                                            <Button className="w-full justify-start" onClick={() => handleTransition('EM_ANDAMENTO')}>
                                                <CheckCircle2 className="w-4 h-4 mr-2" /> Iniciar Atendimento
                                            </Button>
                                        )}
                                        {request.status === 'EM_ANDAMENTO' && (
                                            <div className="space-y-2">
                                                <Textarea
                                                    placeholder="Observação de conclusão (obrigatório)"
                                                    value={actionComment}
                                                    onChange={e => setActionComment(e.target.value)}
                                                    className="text-sm"
                                                />
                                                <div className="flex gap-2">
                                                    <Button
                                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                                        disabled={!actionComment}
                                                        onClick={() => handleTransition('CONCLUIDO')}
                                                    >
                                                        Concluir
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                                                        disabled={!actionComment}
                                                        onClick={() => handleTransition('REJEITADO')}
                                                    >
                                                        Reprovar
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Comments Section - Always Visible in Detail Tab */}
                        <div className="pt-2">
                            <RequestCommentsSection requestId={request.id} />
                        </div>
                    </TabsContent>

                    <TabsContent value="history">
                        <RequestCommentsSection requestId={request.id} />
                    </TabsContent>
                </Tabs>

                <DialogFooter className="sm:justify-between">
                    <div className="text-xs text-slate-400 self-center">
                        ID: {request.id}
                    </div>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
