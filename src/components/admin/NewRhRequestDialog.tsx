"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { MessageSquarePlus, Send, Loader2 } from "lucide-react";
import { createRequest } from "@/app/mobile/actions-requests";

interface NewRhRequestDialogProps {
    employee?: {
        id: string;
        name: string;
        roleName?: string;
    };
    employees?: Array<{
        id: string;
        name: string;
        roleName?: string;
    }>;
    triggerVariant?: "header" | "icon" | "button";
}

export function NewRhRequestDialog({ employee, employees = [], triggerVariant = "header" }: NewRhRequestDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [type, setType] = useState<string>("FERIAS");
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(employee?.id || "");
    const [dueDate, setDueDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        return d.toISOString().split('T')[0];
    });
    const [description, setDescription] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append("type", type);
            formData.append("description", description);
            formData.append("dueDate", dueDate);
            const empId = employee?.id || selectedEmployeeId;
            if (empId) {
                formData.append("employeeId", empId);
            }

            await createRequest(formData);
            setOpen(false);
            setDescription("");
            alert("Solicitação ao RH enviada com sucesso!");
        } catch (error) {
            console.error(error);
            alert("Erro ao enviar solicitação ao RH.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {triggerVariant === "icon" ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        title={`Iniciar Solicitação ao RH ${employee ? `para ${employee.name}` : ''}`}
                        className="h-8 w-8 p-0 rounded-full hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-all ml-1"
                    >
                        <MessageSquarePlus className="w-4 h-4 text-indigo-600" />
                    </Button>
                ) : triggerVariant === "button" ? (
                    <Button variant="outline" size="sm" className="gap-1.5 border-indigo-300 text-indigo-800 hover:bg-indigo-50 text-xs font-bold">
                        <MessageSquarePlus className="w-3.5 h-3.5" /> Solicitar ao RH
                    </Button>
                ) : (
                    <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold border-none h-9 px-4 rounded-xl shadow-sm text-xs uppercase tracking-wider">
                        <MessageSquarePlus className="w-4 h-4" /> Solicitar ao RH
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className="sm:max-w-md w-full p-6 rounded-2xl shadow-xl border-slate-200">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold flex items-center gap-2.5 text-slate-900">
                        <MessageSquarePlus className="w-5 h-5 text-indigo-600 shrink-0" />
                        Nova Solicitação ao RH
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Abra um chamado interno para a equipe de Recursos Humanos / Administração.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {/* Colaborador Informação */}
                    {employee ? (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                                {employee.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Colaborador Vinculado</div>
                                <div className="font-bold text-slate-800 text-xs truncate">{employee.name}</div>
                                {employee.roleName && (
                                    <div className="text-[10px] text-slate-500">{employee.roleName}</div>
                                )}
                            </div>
                        </div>
                    ) : employees.length > 0 ? (
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700">Colaborador (Opcional)</Label>
                            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                                <SelectTrigger className="h-9 text-xs w-full border-slate-300">
                                    <SelectValue placeholder="Selecione o colaborador..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    <SelectItem value="">Sem colaborador específico</SelectItem>
                                    {employees.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.name} {emp.roleName ? `(${emp.roleName})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : null}

                    {/* Tipo de Solicitação */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">Tipo de Solicitação</Label>
                        <Select value={type} onValueChange={setType} required>
                            <SelectTrigger className="h-9 text-xs w-full border-slate-300">
                                <SelectValue placeholder="Selecione a categoria..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                                <SelectItem value="FERIAS">🏖️ Programação de Férias</SelectItem>
                                <SelectItem value="UNIFORME">👕 Solicitação de Uniforme / EPI</SelectItem>
                                <SelectItem value="HORARIO">⏰ Mudança de Horário de Trabalho</SelectItem>
                                <SelectItem value="MOVIMENTACAO">🔄 Movimentação de Posto de Trabalho</SelectItem>
                                <SelectItem value="MUDANCA_ESCALA">📅 Mudança de Escala de Trabalho</SelectItem>
                                <SelectItem value="ALTERACAO_FUNCIONAL">💼 Alteração Funcional</SelectItem>
                                <SelectItem value="TERMINO_CONTRATO_EXPERIENCIA">⏱️ Término Contrato Experiência</SelectItem>
                                <SelectItem value="TERMINO_CONTRATO_ANTECIPADO">⚡ Término Antecipado Experiência</SelectItem>
                                <SelectItem value="DEMISSAO_COLABORADOR">👤 Demissão por Iniciativa do Colaborador</SelectItem>
                                <SelectItem value="DEMISSAO_EMPRESA">🏢 Demissão por Iniciativa da Empresa</SelectItem>
                                <SelectItem value="OUTROS">💬 Outros Assuntos RH</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Data Vencimento / Desejada */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">Data Desejada / Prazo</Label>
                        <Input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            required
                            className="h-9 text-xs w-full border-slate-300"
                        />
                    </div>

                    {/* Descrição / Detalhes */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">Detalhes / Justificativa</Label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Descreva o motivo ou informações adicionais para o RH..."
                            required
                            rows={3}
                            className="text-xs w-full border-slate-300 resize-none"
                        />
                    </div>

                    <DialogFooter className="pt-2 gap-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} className="text-xs">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Enviar Solicitação RH
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
