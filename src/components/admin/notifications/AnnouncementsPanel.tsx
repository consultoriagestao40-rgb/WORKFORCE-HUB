"use client";

import React, { useEffect, useState, useTransition } from "react";
import { Megaphone, Plus, Send, Pause, Play, Pencil, Trash2, CalendarClock, Repeat, Users, BellRing } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RhRecipientSelector } from "@/components/admin/RhRecipientSelector";
import { ExtraGroupItem, ExtraPhoneItem } from "@/lib/rh-notifications";
import {
    listAnnouncements,
    saveAnnouncement,
    setAnnouncementActive,
    deleteAnnouncement,
    sendAnnouncementNow,
} from "@/actions/announcements";
import {
    ANNOUNCEMENT_ROLES,
    formatYmdBr,
    getAnnouncementStatus,
    nextSendDate,
    todayInSaoPaulo,
} from "@/lib/announcement-utils";
import { cn } from "@/lib/utils";

interface AnnouncementsPanelProps {
    operationsGroupJid?: string | null;
    operationsGroupName?: string | null;
    adminGroupJid?: string | null;
    adminGroupName?: string | null;
    extraGroups: ExtraGroupItem[];
    extraPhones: ExtraPhoneItem[];
}

interface AnnouncementRow {
    id: string;
    title: string;
    message: string;
    startDate: string;
    endDate: string;
    intervalDays: number;
    recipients: string;
    sendInApp: boolean;
    inAppRoles: string;
    isActive: boolean;
    lastSentDate: string | null;
    lastSentAt: Date | string | null;
    sendCount: number;
    createdByName: string | null;
}

interface FormState {
    id?: string;
    title: string;
    message: string;
    startDate: string;
    endDate: string;
    intervalDays: number;
    recipients: string;
    sendInApp: boolean;
    inAppRoles: string;
    isActive: boolean;
}

const EMPTY_FORM: FormState = {
    title: "",
    message: "",
    startDate: "",
    endDate: "",
    intervalDays: 3,
    recipients: "",
    sendInApp: true,
    inAppRoles: ANNOUNCEMENT_ROLES.map(r => r.id).join(","),
    isActive: true,
};

const TRINTIDIO_TEMPLATE = {
    title: "Janela de Bloqueio de Desligamentos (Trintídio)",
    message: `📢 COMUNICADO INTERNO – DIRETORIA OPERACIONAL / DP

Assunto: Janela de Bloqueio de Desligamentos (Período de Trintídio e Fechamento de Ano)

Público: Head de Operações, Coordenação, Supervisores de Campo e Mesa de Operações

Prezados líderes,

Informamos que, em conformidade com o Artigo 9º da Lei nº 7.238/84 (regra legal do Trintídio pré-dissídio) referente à data-base da categoria (CCT SIEMACO-PR em 1º de fevereiro) e ao planejamento de escalas de fim de ano, está temporariamente suspensa a aplicação de demissões sem justa causa com término projetado no mês de janeiro.

Fiquem atentos às diretrizes práticas para o período:

Bloqueio de Desligamentos (Dezembro e Janeiro):

Nenhum pedido de rescisão sem justa causa por iniciativa da empresa será processado a partir de agora se a projeção do aviso prévio (trabalhado ou indenizado) recair entre 02/01/2027 e 31/01/2027. Desligamentos necessários não executados com término anterior a essa janela serão postergados para avaliação após a homologação da data-base (fevereiro/2027).

Exceções que continuam válidas e operando normalmente:

✅ Término de Contrato de Experiência (45 ou 90 dias): Deve ser informado à Mesa com no mínimo 5 dias de antecedência do vencimento.

✅ Pedidos de Demissão (iniciativa do colaborador): Encaminhar de imediato a carta escrita de próprio punho ao Hub/Mesa.

✅ Demissões por Justa Causa: Casos graves devidamente comprovados e alinhados previamente com a Diretoria.

Foco da Operação:

O compromisso absoluto de novembro e dezembro é a estabilidade dos postos, assiduidade e disciplina de escala. Casos pontuais de baixa performance devem ser tratados com alinhamento de conduta, advertências formais cabíveis e reforço de liderança em campo.

Contamos com o rigor e o cumprimento integral desta diretriz por toda a liderança.

Atenciosamente,

Diretoria Executiva.`,
    intervalDays: 3,
};

const TEMPLATES: Array<{ id: string; label: string; title: string; message: string; intervalDays: number }> = [
    { id: "trintidio", label: "Trintídio – Bloqueio de Desligamentos", ...TRINTIDIO_TEMPLATE },
];

const STATUS_STYLES: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200",
    PAUSED: "bg-slate-100 text-slate-600 border-slate-200",
    ENDED: "bg-slate-100 text-slate-500 border-slate-200",
};

export function AnnouncementsPanel(props: AnnouncementsPanelProps) {
    const [items, setItems] = useState<AnnouncementRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [isPending, startTransition] = useTransition();
    const today = todayInSaoPaulo();

    const load = async () => {
        try {
            const data = await listAnnouncements();
            setItems(data as unknown as AnnouncementRow[]);
            setError(null);
        } catch (e: any) {
            setError(e.message || "Não foi possível carregar os avisos.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const openNew = () => {
        setForm({ ...EMPTY_FORM });
        setDialogOpen(true);
    };

    const openEdit = (a: AnnouncementRow) => {
        setForm({
            id: a.id,
            title: a.title,
            message: a.message,
            startDate: a.startDate,
            endDate: a.endDate,
            intervalDays: a.intervalDays,
            recipients: a.recipients,
            sendInApp: a.sendInApp,
            inAppRoles: a.inAppRoles,
            isActive: a.isActive,
        });
        setDialogOpen(true);
    };

    const applyTemplate = (id: string) => {
        const t = TEMPLATES.find(x => x.id === id);
        if (!t) return;
        setForm(prev => ({ ...prev, title: t.title, message: t.message, intervalDays: t.intervalDays }));
    };

    const toggleRole = (roleId: string) => {
        const current = form.inAppRoles.split(",").filter(Boolean);
        const next = current.includes(roleId) ? current.filter(r => r !== roleId) : [...current, roleId];
        setForm(prev => ({ ...prev, inAppRoles: next.join(",") }));
    };

    const handleSave = () => {
        startTransition(async () => {
            const res = await saveAnnouncement(form);
            if (res.success) {
                toast.success(form.id ? "Aviso atualizado." : "Aviso criado.");
                setDialogOpen(false);
                await load();
            } else {
                toast.error(res.error || "Erro ao salvar aviso.");
            }
        });
    };

    const handleToggle = (a: AnnouncementRow) => {
        startTransition(async () => {
            const res = await setAnnouncementActive(a.id, !a.isActive);
            if (res.success) {
                toast.success(a.isActive ? "Aviso pausado." : "Aviso reativado.");
                await load();
            } else {
                toast.error(res.error || "Erro ao atualizar aviso.");
            }
        });
    };

    const handleDelete = (a: AnnouncementRow) => {
        if (!window.confirm(`Excluir o aviso "${a.title}"? Os envios já feitos continuam no histórico.`)) return;
        startTransition(async () => {
            const res = await deleteAnnouncement(a.id);
            if (res.success) {
                toast.success("Aviso excluído.");
                await load();
            } else {
                toast.error(res.error || "Erro ao excluir aviso.");
            }
        });
    };

    const handleSendNow = (a: AnnouncementRow) => {
        if (!window.confirm(`Enviar agora o aviso "${a.title}" para os destinatários selecionados?`)) return;
        startTransition(async () => {
            const res: any = await sendAnnouncementNow(a.id);
            if (res.success) {
                toast.success(
                    `Enviado: ${res.whatsappSent} WhatsApp${res.whatsappFailed ? ` (${res.whatsappFailed} falha(s))` : ""} • ${res.inAppCount} no sistema.`
                );
                await load();
            } else {
                toast.error(res.error || "Erro ao enviar aviso.");
            }
        });
    };

    const recipientCount = (a: AnnouncementRow) => a.recipients.split(",").filter(Boolean).length;

    return (
        <div className="space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600">
                        <Megaphone className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-800">Avisos Programados</h2>
                        <p className="text-[11px] text-slate-500">
                            Comunicados recorrentes dentro de um período, enviados às 08h00 no dia de cada repetição.
                        </p>
                    </div>
                </div>
                <Button
                    onClick={openNew}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-md cursor-pointer"
                >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Novo Aviso
                </Button>
            </div>

            {loading ? (
                <div className="p-10 text-center text-sm text-slate-500">Carregando avisos...</div>
            ) : error ? (
                <div className="p-6 text-center text-sm text-red-600 font-semibold bg-red-50 rounded-2xl border border-red-100">{error}</div>
            ) : items.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500 bg-white rounded-3xl border border-dashed border-slate-300">
                    Nenhum aviso criado ainda. Clique em <strong>Novo Aviso</strong> e use o modelo do Trintídio para começar.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {items.map(a => {
                        const st = getAnnouncementStatus(a, today);
                        const next = nextSendDate(a, today);
                        return (
                            <div key={a.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                                    <div className="space-y-1.5 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-sm font-black text-slate-800">{a.title}</h3>
                                            <Badge variant="outline" className={cn("text-[10px] font-bold", STATUS_STYLES[st.key])}>
                                                {st.label}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                                            <span className="inline-flex items-center gap-1">
                                                <CalendarClock className="w-3.5 h-3.5" />
                                                {formatYmdBr(a.startDate)} a {formatYmdBr(a.endDate)}
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <Repeat className="w-3.5 h-3.5" />
                                                A cada {a.intervalDays} dia(s)
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <Users className="w-3.5 h-3.5" />
                                                {recipientCount(a)} destinatário(s) WhatsApp
                                            </span>
                                            {a.sendInApp && (
                                                <span className="inline-flex items-center gap-1">
                                                    <BellRing className="w-3.5 h-3.5" />
                                                    Notifica no sistema
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            Próximo envio: <strong className="text-slate-700">{next ? `${formatYmdBr(next)} às 08h00` : "—"}</strong>
                                            {" • "}Último envio: <strong className="text-slate-700">{formatYmdBr(a.lastSentDate)}</strong>
                                            {" • "}Total de envios: <strong className="text-slate-700">{a.sendCount}</strong>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                                        <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleSendNow(a)} className="h-8 text-[11px] font-bold cursor-pointer">
                                            <Send className="w-3.5 h-3.5 mr-1" /> Enviar agora
                                        </Button>
                                        <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleToggle(a)} className="h-8 text-[11px] font-bold cursor-pointer">
                                            {a.isActive ? <><Pause className="w-3.5 h-3.5 mr-1" /> Pausar</> : <><Play className="w-3.5 h-3.5 mr-1" /> Ativar</>}
                                        </Button>
                                        <Button size="sm" variant="outline" disabled={isPending} onClick={() => openEdit(a)} className="h-8 text-[11px] font-bold cursor-pointer">
                                            <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                                        </Button>
                                        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => handleDelete(a)} className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-500 line-clamp-2 whitespace-pre-line bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    {a.message}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-base font-black text-slate-800">
                            {form.id ? "Editar aviso" : "Novo aviso programado"}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            O aviso é enviado às 08h00 do primeiro dia do período e se repete no intervalo escolhido até a data final.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 text-xs">
                        {!form.id && (
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700">Começar de um modelo (opcional)</Label>
                                <select
                                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs"
                                    defaultValue=""
                                    onChange={e => e.target.value && applyTemplate(e.target.value)}
                                >
                                    <option value="">Em branco</option>
                                    {TEMPLATES.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700">Título</Label>
                            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Janela de Bloqueio de Desligamentos" className="text-xs" />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700">Texto do aviso</Label>
                            <Textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} className="text-xs h-56" placeholder="Escreva o comunicado como deve chegar no WhatsApp..." />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700">Início</Label>
                                <Input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} className="text-xs" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700">Fim</Label>
                                <Input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} className="text-xs" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700">Repetir a cada (dias)</Label>
                                <Input type="number" min={1} max={60} value={form.intervalDays} onChange={e => setForm(p => ({ ...p, intervalDays: Number(e.target.value) }))} className="text-xs" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700">Destinatários no WhatsApp (grupos e contatos)</Label>
                            <RhRecipientSelector
                                value={form.recipients}
                                onChange={v => setForm(p => ({ ...p, recipients: v }))}
                                operationsGroupJid={props.operationsGroupJid}
                                operationsGroupName={props.operationsGroupName}
                                adminGroupJid={props.adminGroupJid}
                                adminGroupName={props.adminGroupName}
                                extraGroups={props.extraGroups}
                                extraPhones={props.extraPhones}
                            />
                            <p className="text-[10px] text-slate-400">
                                Grupos e contatos vêm da aba &quot;Canais &amp; Regras de Disparo&quot; e precisam estar salvos lá.
                            </p>
                        </div>

                        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-xs font-bold text-slate-700">Notificar também dentro do sistema</Label>
                                    <p className="text-[10px] text-slate-400">Aparece no sino de notificações dos perfis escolhidos.</p>
                                </div>
                                <Switch checked={form.sendInApp} onCheckedChange={v => setForm(p => ({ ...p, sendInApp: v }))} />
                            </div>
                            {form.sendInApp && (
                                <div className="flex flex-wrap gap-3 pt-1">
                                    {ANNOUNCEMENT_ROLES.map(r => (
                                        <label key={r.id} className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={form.inAppRoles.split(",").includes(r.id)}
                                                onChange={() => toggleRole(r.id)}
                                            />
                                            {r.label}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                            <Label className="text-xs font-bold text-slate-700">Aviso ativo</Label>
                            <Switch checked={form.isActive} onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending} className="text-xs font-semibold cursor-pointer">
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={isPending} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer">
                            {isPending ? "Salvando..." : "Salvar aviso"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
