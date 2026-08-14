"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    User, Briefcase, MapPin, Phone, Calendar, Clock, StickyNote,
    CheckCircle2, Plus, Trash2, ArrowRightLeft, Users, ExternalLink,
    Shield, Sparkles, AlertCircle, Check, Tag, ChevronRight, X
} from "lucide-react";
import {
    addHrTicketNote,
    deleteHrTicketNote,
    addHrTicketActivity,
    completeHrTicketActivity,
    addParticipantToTicket,
    removeParticipantFromTicket,
    updateHrTicketStage,
    applyLabelToTicket
} from "@/actions/hr-attendance";
import { toast } from "sonner";
import Link from "next/link";

interface Props {
    ticket: any;
    currentUser: any;
    allUsers: any[];
    availableStages: any[];
    availableLabels: any[];
    onUpdated: () => void;
    onOpenScheduleModal: () => void;
    onClosePanel?: () => void;
}

export function HrCrmSidePanel({
    ticket,
    currentUser,
    allUsers,
    availableStages,
    availableLabels,
    onUpdated,
    onOpenScheduleModal,
    onClosePanel
}: Props) {
    const [activeTab, setActiveTab] = useState<"profile" | "notes" | "activities" | "history" | "participants">("profile");
    const [newNote, setNewNote] = useState("");
    const [addingNote, setAddingNote] = useState(false);
    const [selectedParticipant, setSelectedParticipant] = useState("");

    const employee = ticket.employee;
    const activeAssignment = employee?.assignments?.[0];

    const handleAddNote = async () => {
        if (!newNote.trim()) return;
        setAddingNote(true);
        try {
            await addHrTicketNote(ticket.id, newNote.trim());
            setNewNote("");
            toast.success("Anotação interna adicionada!");
            onUpdated();
        } catch (e: any) {
            toast.error(e.message || "Erro ao salvar anotação");
        } finally {
            setAddingNote(false);
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        try {
            await deleteHrTicketNote(noteId);
            toast.success("Anotação removida");
            onUpdated();
        } catch (e: any) {
            toast.error("Erro ao remover nota");
        }
    };

    const handleToggleActivity = async (actId: string) => {
        try {
            await completeHrTicketActivity(actId);
            toast.success("Atividade concluída!");
            onUpdated();
        } catch (e: any) {
            toast.error("Erro ao atualizar atividade");
        }
    };

    const handleAddParticipant = async () => {
        if (!selectedParticipant) return;
        try {
            await addParticipantToTicket(ticket.id, selectedParticipant);
            setSelectedParticipant("");
            toast.success("Participante adicionado à conversa!");
            onUpdated();
        } catch (e: any) {
            toast.error("Erro ao adicionar participante");
        }
    };

    const handleRemoveParticipant = async (userId: string) => {
        try {
            await removeParticipantFromTicket(ticket.id, userId);
            toast.success("Participante removido");
            onUpdated();
        } catch (e: any) {
            toast.error("Erro ao remover participante");
        }
    };

    const handleStageChange = async (stageId: string) => {
        try {
            await updateHrTicketStage(ticket.id, stageId);
            toast.success("Etapa do pipeline atualizada!");
            onUpdated();
        } catch (e: any) {
            toast.error("Erro ao atualizar etapa");
        }
    };

    const handleToggleLabel = async (labelId: string, isApplied: boolean) => {
        try {
            await applyLabelToTicket(ticket.id, labelId, !isApplied);
            onUpdated();
        } catch (e: any) {
            toast.error("Erro ao atualizar etiqueta");
        }
    };

    // Calculate SLA time
    const createdAt = new Date(ticket.createdAt);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    let slaText = `${diffMin}m`;
    if (diffDays > 0) slaText = `${diffDays}d ${diffHours % 24}h`;
    else if (diffHours > 0) slaText = `${diffHours}h ${diffMin % 60}m`;

    return (
        <div className="flex flex-col h-full bg-white border-l border-slate-200 w-80 xl:w-96 flex-shrink-0 text-xs select-none">
            {/* Top Header */}
            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span className="font-black text-slate-800 tracking-tight text-xs">CRM WaSeller</span>
                </div>
                {onClosePanel && (
                    <button
                        onClick={onClosePanel}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/60 transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Sub-header: Contact Profile Card */}
            <div className="p-4 border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-white">
                <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                        {ticket.contactPhotoUrl && ticket.contactPhotoUrl !== "null" ? (
                            <img
                                src={ticket.contactPhotoUrl}
                                alt=""
                                className="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-500/20 shadow-xs"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 text-white font-black text-sm flex items-center justify-center border-2 border-slate-100 shadow-xs">
                                {ticket.contactName?.charAt(0).toUpperCase() || "?"}
                            </div>
                        )}
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                    </div>

                    <div className="flex-1 overflow-hidden">
                        <h3 className="font-extrabold text-slate-900 text-sm truncate leading-tight">
                            {ticket.contactName}
                        </h3>
                        <a
                            href={`https://wa.me/${ticket.contactPhone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-mono text-emerald-600 hover:text-emerald-700 flex items-center gap-1 mt-0.5"
                        >
                            <Phone className="w-3 h-3" /> {ticket.contactPhone}
                        </a>
                        {employee && (
                            <div className="mt-1 flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200/60">
                                    Colaborador CLT
                                </span>
                                <Link
                                    href={`/admin/employees/${employee.id}`}
                                    target="_blank"
                                    className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-0.5 font-bold"
                                >
                                    Abrir Ficha <ExternalLink className="w-2.5 h-2.5" />
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Pipeline Stage Selector */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">
                        Etapa do Funil (Pipeline)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                        {availableStages.map((stg) => {
                            const isCurrent = ticket.stageId === stg.id;
                            return (
                                <button
                                    key={stg.id}
                                    onClick={() => handleStageChange(stg.id)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 ${
                                        isCurrent
                                            ? "text-white shadow-xs"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                    style={isCurrent ? { backgroundColor: stg.color } : {}}
                                >
                                    {isCurrent && <Check className="w-3 h-3" />}
                                    {stg.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* CRM Navigation Tabs */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50/80 px-2 flex-shrink-0">
                <button
                    onClick={() => setActiveTab("profile")}
                    className={`flex-1 py-2 text-center text-[10px] font-black tracking-wide border-b-2 transition ${
                        activeTab === "profile"
                            ? "border-emerald-600 text-emerald-700 bg-white"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                >
                    Ficha
                </button>
                <button
                    onClick={() => setActiveTab("notes")}
                    className={`flex-1 py-2 text-center text-[10px] font-black tracking-wide border-b-2 transition relative ${
                        activeTab === "notes"
                            ? "border-emerald-600 text-emerald-700 bg-white"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                >
                    Notas {ticket.notes?.length > 0 && `(${ticket.notes.length})`}
                </button>
                <button
                    onClick={() => setActiveTab("activities")}
                    className={`flex-1 py-2 text-center text-[10px] font-black tracking-wide border-b-2 transition relative ${
                        activeTab === "activities"
                            ? "border-emerald-600 text-emerald-700 bg-white"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                >
                    Tarefas {ticket.activities?.length > 0 && `(${ticket.activities.length})`}
                </button>
                <button
                    onClick={() => setActiveTab("history")}
                    className={`flex-1 py-2 text-center text-[10px] font-black tracking-wide border-b-2 transition ${
                        activeTab === "history"
                            ? "border-emerald-600 text-emerald-700 bg-white"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                >
                    Auditoria
                </button>
                <button
                    onClick={() => setActiveTab("participants")}
                    className={`flex-1 py-2 text-center text-[10px] font-black tracking-wide border-b-2 transition ${
                        activeTab === "participants"
                            ? "border-emerald-600 text-emerald-700 bg-white"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                >
                    Equipe
                </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* TAB 1: FICHA DO COLABORADOR */}
                {activeTab === "profile" && (
                    <div className="space-y-4">
                        {employee ? (
                            <>
                                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Cargo / Função</span>
                                        <span className="font-extrabold text-slate-800">{employee.role?.name || "Não informado"}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Empresa</span>
                                        <span className="font-bold text-slate-700 truncate max-w-[160px]">{employee.company?.name || "Matriz"}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Posto Alocado</span>
                                        <span className="font-bold text-emerald-700 truncate max-w-[160px]">
                                            {activeAssignment?.posto?.client?.name || "Disponível (Reserva)"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">CPF</span>
                                        <span className="font-mono text-slate-700">{employee.cpf || "---"}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Admissão</span>
                                        <span className="font-bold text-slate-700">
                                            {employee.admissionDate ? new Date(employee.admissionDate).toLocaleDateString("pt-BR") : "---"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Salário Base</span>
                                        <span className="font-black text-slate-900">
                                            R$ {Number(employee.salary || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl text-center space-y-2">
                                <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
                                <p className="text-xs font-bold text-amber-900">Contato não vinculado a colaborador</p>
                                <p className="text-[10px] text-amber-700">
                                    Este número ({ticket.contactPhone}) não corresponde a nenhum funcionário ativo no banco de dados.
                                </p>
                            </div>
                        )}

                        {/* SLA & Ticket Metrics */}
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                                Métricas do Atendimento (SLA)
                            </span>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-medium">Tempo Aberto</span>
                                <span className="font-mono font-black text-slate-800">{slaText}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-medium">Atendente Atual</span>
                                <span className="font-bold text-slate-800">{ticket.assignee?.name || "Fila Geral (Disponível)"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-medium">Total de Mensagens</span>
                                <span className="font-bold text-slate-800">{ticket.messages?.length || 0}</span>
                            </div>
                        </div>

                        {/* Etiquetas do Ticket */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                                Etiquetas (Tags)
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {availableLabels.map(lbl => {
                                    const isApplied = ticket.labels?.some((l: any) => l.id === lbl.id);
                                    return (
                                        <button
                                            key={lbl.id}
                                            onClick={() => handleToggleLabel(lbl.id, isApplied)}
                                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                                                isApplied
                                                    ? "text-white shadow-2xs border-transparent"
                                                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                            }`}
                                            style={isApplied ? { backgroundColor: lbl.color } : {}}
                                        >
                                            {isApplied && "✓ "}
                                            {lbl.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: ANOTAÇÕES INTERNAS */}
                {activeTab === "notes" && (
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Textarea
                                value={newNote}
                                onChange={e => setNewNote(e.target.value)}
                                placeholder="Escreva uma anotação interna da equipe (invisível para o funcionário)..."
                                className="text-xs min-h-[70px] bg-amber-50/50 border-amber-200 focus:border-amber-400 rounded-xl"
                            />
                            <Button
                                size="sm"
                                onClick={handleAddNote}
                                disabled={addingNote || !newNote.trim()}
                                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-8 text-xs rounded-xl"
                            >
                                <StickyNote className="w-3 h-3 mr-1" /> Salvar Anotação Interna
                            </Button>
                        </div>

                        <div className="space-y-2 pt-2">
                            {ticket.notes && ticket.notes.length > 0 ? (
                                ticket.notes.map((note: any) => (
                                    <div
                                        key={note.id}
                                        className="bg-amber-50/80 p-3 rounded-xl border border-amber-200/70 shadow-2xs relative group"
                                    >
                                        <div className="flex items-center justify-between text-[10px] text-amber-800 font-bold mb-1">
                                            <span>👤 {note.author?.name || "Atendente"}</span>
                                            <span>{new Date(note.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                                        </div>
                                        <p className="text-xs text-slate-800 whitespace-pre-wrap">{note.content}</p>
                                        <button
                                            onClick={() => handleDeleteNote(note.id)}
                                            className="absolute top-2 right-2 text-amber-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition"
                                            title="Excluir Nota"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-[11px] text-slate-400 text-center py-4 italic">
                                    Nenhuma anotação interna registrada.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 3: AGENDAMENTOS E ATIVIDADES */}
                {activeTab === "activities" && (
                    <div className="space-y-3">
                        <Button
                            size="sm"
                            onClick={onOpenScheduleModal}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-xs rounded-xl"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Agendar Nova Tarefa / Retorno
                        </Button>

                        <div className="space-y-2 pt-1">
                            {ticket.activities && ticket.activities.length > 0 ? (
                                ticket.activities.map((act: any) => {
                                    const isDone = !!act.completedAt;
                                    const dueDate = new Date(act.dueAt);
                                    const isLate = !isDone && dueDate < new Date();

                                    return (
                                        <div
                                            key={act.id}
                                            className={`p-3 rounded-xl border shadow-2xs transition ${
                                                isDone
                                                    ? "bg-slate-50 border-slate-200 opacity-60"
                                                    : isLate
                                                    ? "bg-rose-50 border-rose-200"
                                                    : "bg-white border-slate-200"
                                            }`}
                                        >
                                            <div className="flex items-start gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={isDone}
                                                    onChange={() => handleToggleActivity(act.id)}
                                                    className="mt-0.5 rounded text-emerald-600 cursor-pointer"
                                                />
                                                <div className="flex-1">
                                                    <h4 className={`text-xs font-bold ${isDone ? "line-through text-slate-500" : "text-slate-800"}`}>
                                                        {act.title}
                                                    </h4>
                                                    {act.description && (
                                                        <p className="text-[10px] text-slate-500 mt-0.5">{act.description}</p>
                                                    )}
                                                    <div className="flex items-center justify-between text-[9px] font-mono mt-2 pt-1.5 border-t border-slate-100">
                                                        <span className={isLate ? "text-rose-600 font-bold" : "text-slate-400"}>
                                                            📅 {dueDate.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                                                        </span>
                                                        <span className="text-slate-400 font-sans font-medium">
                                                            {act.assignee?.name || "Equipe RH"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-[11px] text-slate-400 text-center py-4 italic">
                                    Nenhuma tarefa ou atividade agendada.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 4: AUDITORIA E HISTÓRICO */}
                {activeTab === "history" && (
                    <div className="space-y-2.5">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                            Linha do Tempo de Atendimento
                        </span>

                        <div className="space-y-2">
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 text-[10px] space-y-0.5">
                                <span className="font-bold text-slate-700 block">✨ Atendimento Criado</span>
                                <span className="text-slate-400 font-mono">
                                    {new Date(ticket.createdAt).toLocaleString("pt-BR")}
                                </span>
                            </div>

                            {ticket.transfers?.map((tr: any) => (
                                <div key={tr.id} className="bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-200/60 text-[10px] space-y-0.5">
                                    <div className="flex items-center gap-1 font-bold text-indigo-900">
                                        <ArrowRightLeft className="w-3 h-3 text-indigo-600" />
                                        <span>Transferido: {tr.fromUser?.name || "RH"} → {tr.toUser?.name}</span>
                                    </div>
                                    {tr.reason && <p className="text-indigo-700 italic">"{tr.reason}"</p>}
                                    <span className="text-indigo-400 font-mono block">
                                        {new Date(tr.createdAt).toLocaleString("pt-BR")}
                                    </span>
                                </div>
                            ))}

                            {ticket.closedAt && (
                                <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200/60 text-[10px] space-y-0.5">
                                    <span className="font-bold text-rose-700 block">🔒 Atendimento Encerrado</span>
                                    <span className="text-rose-400 font-mono">
                                        {new Date(ticket.closedAt).toLocaleString("pt-BR")}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 5: PARTICIPANTES E OBSERVADORES */}
                {activeTab === "participants" && (
                    <div className="space-y-3">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                            Adicionar Observador da Equipe
                        </span>
                        <div className="flex items-center gap-1.5">
                            <select
                                value={selectedParticipant}
                                onChange={e => setSelectedParticipant(e.target.value)}
                                className="flex-1 h-8 rounded-xl border border-slate-200 bg-white text-xs px-2"
                            >
                                <option value="">Selecione um membro...</option>
                                {allUsers
                                    .filter(u => u.id !== ticket.assigneeId && !ticket.participantIds?.includes(u.id))
                                    .map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                            </select>
                            <Button
                                size="sm"
                                onClick={handleAddParticipant}
                                disabled={!selectedParticipant}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-xs px-3 rounded-xl"
                            >
                                Adicionar
                            </Button>
                        </div>

                        <div className="space-y-1.5 pt-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                                Membros Acompanhando
                            </span>
                            {ticket.participantIds && ticket.participantIds.length > 0 ? (
                                ticket.participantIds.map((pId: string) => {
                                    const member = allUsers.find(u => u.id === pId);
                                    return (
                                        <div
                                            key={pId}
                                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/60"
                                        >
                                            <span className="font-bold text-slate-800 text-xs">
                                                👤 {member?.name || pId}
                                            </span>
                                            <button
                                                onClick={() => handleRemoveParticipant(pId)}
                                                className="text-slate-400 hover:text-rose-600 transition"
                                                title="Remover"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-[10px] text-slate-400 italic py-2">
                                    Nenhum participante adicional vinculado.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
