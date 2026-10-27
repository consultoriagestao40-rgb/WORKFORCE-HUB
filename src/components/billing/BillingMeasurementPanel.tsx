"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
    CheckCircle2, AlertTriangle, Paperclip, Send, MessageSquare, Download,
    X, FileText, RefreshCw, Undo2, ShieldCheck, Building2, Plus, Trash2, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    getMeasurementDetail,
    postMeasurementEvent,
    getMeasurementAttachment,
    setGlosaDecision,
    addExtraItem,
    deleteExtraItem,
    decideExtraItem,
    type MeasurementFileInput,
} from "@/actions/billing-measurement";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function measurementStatusBadge(status?: string | null) {
    switch (status) {
        case "APPROVED":
            return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold hover:bg-emerald-50">✔ Aprovada pelo cliente</Badge>;
        case "REVISION_REQUESTED":
            return <Badge className="bg-red-50 text-red-700 border-red-200 font-bold hover:bg-red-50">↺ Revisão solicitada</Badge>;
        default:
            return <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-bold hover:bg-amber-50">⏳ Aguardando análise</Badge>;
    }
}

const EVENT_LABEL: Record<string, string> = {
    REVISION_REQUEST: "Solicitou revisão",
    RESPONSE: "Respondeu",
    COMMENT: "Comentário",
    APPROVAL: "Aprovou a medição",
};

function readFileAsBase64(file: File): Promise<MeasurementFileInput> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || "");
            resolve({ name: file.name, mimeType: file.type, size: file.size, data: result.split(",")[1] || "" });
        };
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        reader.readAsDataURL(file);
    });
}

interface Props {
    clientId: string;
    year: number;
    month: number; // 0-11
    onChanged?: () => void; // avisa o pai (para atualizar os selos de situação)
}

/**
 * Relatório da medição mensal: presença diária, glosas, análise do cliente
 * (revisão / aprovação) e histórico de interações com anexos de evidência.
 * Usado no portal do cliente e na visão do gestor.
 */
export function BillingMeasurementPanel({ clientId, year, month, onChanged }: Props) {
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState<any>(null);
    const [message, setMessage] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [sending, setSending] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const [abonoTarget, setAbonoTarget] = useState<string | null>(null);
    const [abonoReason, setAbonoReason] = useState("");
    const [tab, setTab] = useState("presence");
    const [deciding, setDeciding] = useState(false);
    const [showExtraForm, setShowExtraForm] = useState(false);
    const [extraForm, setExtraForm] = useState({ type: "HORA_EXTRA" as "HORA_EXTRA" | "SERVICO_EXTRA", description: "", requestedBy: "", referenceDate: "", quantity: "", unitValue: "" });
    const [rejectExtraId, setRejectExtraId] = useState<string | null>(null);
    const [rejectExtraNote, setRejectExtraNote] = useState("");

    const saveExtra = async () => {
        setDeciding(true);
        try {
            const res = await addExtraItem({
                clientId, year, month, type: extraForm.type, description: extraForm.description,
                requestedBy: extraForm.requestedBy, referenceDate: extraForm.referenceDate || undefined,
                quantity: Number(String(extraForm.quantity).replace(",", ".")), unitValue: Number(String(extraForm.unitValue).replace(",", ".")),
            });
            if (res.success) {
                toast.success("Item lançado. O cliente verá na tela dele para aprovação.");
                setExtraForm({ type: extraForm.type, description: "", requestedBy: "", referenceDate: "", quantity: "", unitValue: "" });
                setShowExtraForm(false);
                await load();
                onChanged?.();
            } else toast.error(res.error || "Não foi possível lançar o item.");
        } finally { setDeciding(false); }
    };

    const removeExtra = async (id: string) => {
        if (!confirm("Remover este item extra?")) return;
        const res = await deleteExtraItem(id);
        if (res.success) { toast.success("Item removido."); await load(); onChanged?.(); }
        else toast.error(res.error || "Não foi possível remover.");
    };

    const decideExtra = async (id: string, decision: "APPROVE" | "REJECT") => {
        setDeciding(true);
        try {
            const res = await decideExtraItem({ id, decision, note: decision === "REJECT" ? rejectExtraNote : undefined });
            if (res.success) {
                toast.success(decision === "APPROVE" ? "Item aprovado." : "Item recusado.");
                setRejectExtraId(null); setRejectExtraNote("");
                await load(); onChanged?.();
            } else toast.error(res.error || "Não foi possível registrar.");
        } finally { setDeciding(false); }
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getMeasurementDetail(clientId, year, month);
            if (res.success) {
                setDetail(res);
                if (res.side === "CLIENT" && res.summary.extrasPendingCount > 0) setTab(t => (t === "presence" ? "extras" : t));
            }
            else toast.error(res.error || "Erro ao carregar a medição.");
        } catch {
            toast.error("Erro de conexão ao carregar a medição.");
        } finally {
            setLoading(false);
        }
    }, [clientId, year, month]);

    useEffect(() => { load(); }, [load]);

    const submit = async (type: "REVISION_REQUEST" | "APPROVAL" | "RESPONSE" | "COMMENT") => {
        if (type === "APPROVAL" && !confirm(`Confirma a aprovação da medição de ${MONTH_NAMES[month]}/${year}? Após aprovada, ela não poderá ser contestada.`)) return;
        setSending(true);
        try {
            const encoded = await Promise.all(files.map(readFileAsBase64));
            const res = await postMeasurementEvent({ clientId, year, month, type, message, files: encoded });
            if (res.success) {
                toast.success(
                    type === "APPROVAL" ? "Medição aprovada!" :
                    type === "REVISION_REQUEST" ? "Revisão solicitada. A equipe será notificada." :
                    "Mensagem registrada no histórico."
                );
                setMessage("");
                setFiles([]);
                if (fileInput.current) fileInput.current.value = "";
                await load();
                onChanged?.();
            } else {
                toast.error(res.error || "Não foi possível registrar.");
            }
        } catch {
            toast.error("Erro ao enviar. Verifique o tamanho dos anexos (máx. 4 MB cada).");
        } finally {
            setSending(false);
        }
    };

    const decide = async (r: any, decision: "GLOSA" | "ABONO") => {
        setDeciding(true);
        try {
            const res = await setGlosaDecision({ postoId: r.postoId, dateKey: r.dateKey, decision, reason: decision === "ABONO" ? abonoReason : undefined });
            if (res.success) {
                toast.success(decision === "ABONO" ? "Falta abonada. O valor não será glosado." : "Falta glosada.");
                setAbonoTarget(null);
                setAbonoReason("");
                await load();
                onChanged?.();
            } else {
                toast.error(res.error || "Não foi possível registrar a decisão.");
            }
        } finally {
            setDeciding(false);
        }
    };

    const download = async (id: string) => {
        const res = await getMeasurementAttachment(id);
        if (!res.success) { toast.error(res.error || "Erro ao baixar."); return; }
        const bytes = Uint8Array.from(atob(res.data), c => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: res.mimeType }));
        const a = document.createElement("a");
        a.href = url;
        a.download = res.fileName;
        a.click();
        URL.revokeObjectURL(url);
    };

    const onPickFiles = (list: FileList | null) => {
        if (!list) return;
        const picked = Array.from(list);
        const tooBig = picked.find(f => f.size > 4 * 1024 * 1024);
        if (tooBig) { toast.error(`"${tooBig.name}" excede 4 MB.`); return; }
        setFiles(prev => [...prev, ...picked].slice(0, 5));
    };

    if (loading && !detail) {
        return (
            <div className="flex items-center justify-center py-10 gap-2 text-xs text-slate-500 font-semibold">
                <RefreshCw className="w-4 h-4 animate-spin" /> Carregando medição de {MONTH_NAMES[month]}...
            </div>
        );
    }
    if (!detail) return null;

    const side: "CLIENT" | "INTERNAL" = detail.side;
    const m = detail.measurement;
    const status: string = m?.status || "PENDING";
    const approved = status === "APPROVED";
    const hasData = detail.rows.length > 0;
    const s = detail.summary;

    const statusBadge = (r: any) => {
        if (r.status === "PRESENTE_PONTO" || r.status === "PRESENTE_MANUAL") return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 font-bold">● Confirmado</Badge>;
        if (r.status === "FALTA") {
            if (r.coveredByName) return <Badge className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50 font-bold">● Falta Coberta: {r.coveredByName}</Badge>;
            if (r.coverageType === "DIARISTA") return <Badge className="bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-50 font-bold">● Coberto Diarista</Badge>;
            return (r.decision === "ABONO" ? <Badge className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50 font-bold">▲ Posto Vago (Abonado)</Badge> : <Badge className="bg-red-50 text-red-700 border-red-100 hover:bg-red-50 font-black">▲ Posto Vago (Glosa)</Badge>);
        }
        if (r.status === "FOLGA") return <Badge className="bg-slate-100 text-slate-500 border-slate-200/50 hover:bg-slate-100 font-semibold">○ Folga</Badge>;
        return <Badge className="bg-slate-100 text-slate-600 border-none hover:bg-slate-100">○ Aguardando</Badge>;
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full min-w-0 bg-slate-50/60 border-t border-slate-200/70">
            <div className="px-6 pt-4 pb-3 space-y-3 shrink-0 bg-white border-b border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                    <h4 className="text-sm font-black text-slate-800">Medição de {MONTH_NAMES[month]}/{year}</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Relatório de presenças, glosas e análise da medição do mês.</p>
                </div>
                <div className="flex items-center gap-2">
                    {measurementStatusBadge(status)}
                    {approved && m?.approvedAt && (
                        <span className="text-[11px] text-emerald-700 font-semibold">
                            por {m.approvedByName || "Cliente"} em {fmtDateTime(m.approvedAt)}
                        </span>
                    )}
                </div>
            </div>

            {/* Resumo financeiro */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: "Faturamento previsto", value: brl(s.expected), cls: "text-slate-800" },
                    { label: "Glosas", value: s.glosaTotal > 0 ? `-${brl(s.glosaTotal)}` : brl(0), cls: s.glosaTotal > 0 ? "text-red-600" : "text-slate-500" },
                    { label: "Extras aprovados", value: brl(s.extrasApproved) + (s.extrasPending > 0 ? ` (+${brl(s.extrasPending)} pend.)` : ""), cls: "text-indigo-600" },
                    { label: "Líquido a faturar", value: brl(s.net), cls: "text-emerald-600" },
                ].map(c => (
                    <div key={c.label} className="bg-white rounded-xl border border-slate-200/60 p-3 shadow-sm">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{c.label}</div>
                        <div className={`text-base font-black mt-1 ${c.cls}`}>{c.value}</div>
                    </div>
                ))}
            </div>

            </div>
            <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
                <div className="px-6 pt-3 shrink-0 overflow-x-auto">
                    <TabsList className="bg-slate-200/60 p-1 rounded-xl h-auto">
                        <TabsTrigger value="presence" className="text-xs font-bold px-3 py-1.5">Presenças ({detail.rows.length})</TabsTrigger>
                        <TabsTrigger value="glosas" className="text-xs font-bold px-3 py-1.5">Glosas / Abonos ({detail.glosaRows.length})</TabsTrigger>
                        <TabsTrigger value="extras" className="text-xs font-bold px-3 py-1.5">Extras ({detail.extras.length}){s.extrasPendingCount > 0 && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-amber-500" />}</TabsTrigger>
                        <TabsTrigger value="history" className="text-xs font-bold px-3 py-1.5">Histórico ({m?.events?.length || 0})</TabsTrigger>
                    </TabsList>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                    <TabsContent value="presence" className="mt-0 space-y-4">
            {/* Relatório mensal de presenças (igual ao menu Relatório Mensal) */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-4">
                <div>
                    <h5 className="text-sm font-bold text-slate-800">Relatório de Efetividade e Ocorrências</h5>
                    <p className="text-xs text-slate-500 font-medium">Histórico completo de presenças, coberturas e faltas de {MONTH_NAMES[month]}/{year}.</p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-slate-900 text-white p-4">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-300">Presenças confirmadas</div>
                        <div className="text-3xl font-black mt-2">{s.present}</div>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200/60 p-4">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Faltas cobertas</div>
                        <div className="text-3xl font-black mt-2 text-blue-600">{s.coveredAbsences}</div>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200/60 p-4">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Postos vagos (glosas)</div>
                        <div className={`text-3xl font-black mt-2 ${s.uncoveredAbsences > 0 ? "text-red-600" : "text-slate-900"}`}>{s.uncoveredAbsences}</div>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200/60 p-4">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Efetividade geral</div>
                        <div className="text-3xl font-black mt-2 text-slate-900">{s.effectiveness.toFixed(1)}%</div>
                    </div>
                </div>
                {!hasData ? (
                    <div className="py-8 text-center text-xs text-slate-400 italic font-semibold">Sem lançamentos de presença em {MONTH_NAMES[month]}/{year}.</div>
                ) : (
                    <div className="overflow-x-auto border border-slate-200/60 rounded-xl">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="text-xs font-bold text-slate-800">Data</TableHead>
                                    <TableHead className="text-xs font-bold text-slate-800">Unidade</TableHead>
                                    <TableHead className="text-xs font-bold text-slate-800">Cargo / Função</TableHead>
                                    <TableHead className="text-xs font-bold text-slate-800">Colaborador</TableHead>
                                    <TableHead className="text-xs font-bold text-slate-800 text-center">Status</TableHead>
                                    <TableHead className="text-xs font-bold text-slate-800">Quem cobriu</TableHead>
                                    <TableHead className="text-xs font-bold text-slate-800">Notas Operacionais</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {detail.rows.map((r: any) => (
                                    <TableRow key={r.id} className={r.uncovered && r.decision !== "ABONO" ? "bg-red-50/20" : r.status === "FOLGA" ? "opacity-75 bg-slate-100/40" : ""}>
                                        <TableCell className="text-xs font-bold">{fmtDate(r.date)}</TableCell>
                                        <TableCell className="text-xs font-semibold truncate max-w-[150px]">{r.clientName}</TableCell>
                                        <TableCell className="text-xs font-semibold">{r.roleName}</TableCell>
                                        <TableCell className="text-xs font-bold text-slate-800">{r.employeeName}</TableCell>
                                        <TableCell className="text-center">{statusBadge(r)}</TableCell>
                                        <TableCell className="text-xs font-semibold text-slate-700">
                                            {r.status !== "FALTA" ? "-" : r.coveredByName ? r.coveredByName : r.coverageType === "DIARISTA" ? "Diarista" : <span className="text-red-600 font-bold">Sem cobertura</span>}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-500">{r.notes || (r.virtual && r.status === "FALTA" ? <span className="italic text-red-500">Posto descoberto, sem aviso de cobertura</span> : "-")}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

                    </TabsContent>
                    <TabsContent value="glosas" className="mt-0">
            {/* Faltas sem cobertura: glosar ou abonar */}
            <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Faltas sem cobertura (glosa ou abono)</span>
                    {side === "INTERNAL" && !approved && detail.glosaRows.length > 0 && (
                        <span className="text-[11px] font-medium text-slate-500">Padrão: glosar. Para não descontar, abone com justificativa.</span>
                    )}
                </div>
                {detail.glosaRows.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 italic font-semibold">Nenhuma falta sem cobertura neste mês.</div>
                ) : (
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="text-xs font-bold text-slate-800 pl-4">Data</TableHead>
                                <TableHead className="text-xs font-bold text-slate-800">Função</TableHead>
                                <TableHead className="text-xs font-bold text-slate-800">Colaborador ausente</TableHead>
                                <TableHead className="text-xs font-bold text-slate-800">Decisão</TableHead>
                                <TableHead className="text-xs font-bold text-slate-800">Justificativa</TableHead>
                                <TableHead className="text-xs font-bold text-slate-800 text-right">Valor</TableHead>
                                {side === "INTERNAL" && !approved && <TableHead className="text-xs font-bold text-slate-800 text-right pr-4">Ação</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {detail.glosaRows.map((r: any) => (
                                <Fragment key={r.id}>
                                    <TableRow>
                                        <TableCell className="text-xs font-bold pl-4">{fmtDate(r.date)}</TableCell>
                                        <TableCell className="text-xs font-semibold">{r.roleName}</TableCell>
                                        <TableCell className="text-xs font-semibold">{r.employeeName}</TableCell>
                                        <TableCell>
                                            {r.decision === "ABONO"
                                                ? <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50 font-bold">Abonada</Badge>
                                                : <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50 font-bold">Glosada</Badge>}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-600 max-w-[260px]">
                                            {r.decisionReason || "-"}
                                            {r.decidedByName && <div className="text-[10px] text-slate-400">por {r.decidedByName}{r.decidedAt ? ` em ${fmtDateTime(r.decidedAt)}` : ""}</div>}
                                        </TableCell>
                                        <TableCell className={`text-xs font-bold text-right ${r.decision === "ABONO" ? "text-blue-600 line-through" : "text-red-600"}`}>
                                            {r.decision === "ABONO" ? brl(r.dailyValue) : `-${brl(r.glosa)}`}
                                        </TableCell>
                                        {side === "INTERNAL" && !approved && (
                                            <TableCell className="text-right pr-4">
                                                <div className="flex justify-end gap-1.5">
                                                    {r.decision === "ABONO" ? (
                                                        <Button size="sm" variant="outline" disabled={deciding} className="h-7 text-[11px]" onClick={() => decide(r, "GLOSA")}>Glosar</Button>
                                                    ) : (
                                                        <Button size="sm" variant="outline" disabled={deciding} className="h-7 text-[11px]" onClick={() => { setAbonoTarget(abonoTarget === r.id ? null : r.id); setAbonoReason(""); }}>Abonar</Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                    {abonoTarget === r.id && (
                                        <TableRow key={r.id + "-abono"} className="bg-blue-50/40">
                                            <TableCell colSpan={7} className="px-4 py-3">
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <Textarea
                                                        value={abonoReason}
                                                        onChange={e => setAbonoReason(e.target.value)}
                                                        placeholder="Justificativa do abono (obrigatória). Ex.: falta por motivo do cliente, feriado, acordo comercial..."
                                                        className="min-h-[56px] text-xs bg-white"
                                                    />
                                                    <div className="flex sm:flex-col gap-2 shrink-0">
                                                        <Button size="sm" disabled={deciding} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => decide(r, "ABONO")}>Confirmar abono</Button>
                                                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setAbonoTarget(null)}>Cancelar</Button>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </Fragment>
                            ))}
                            <TableRow className="bg-slate-50/60">
                                <TableCell colSpan={5} className="text-xs font-black text-slate-700 pl-4">
                                    Total glosado{s.abonoCount > 0 ? ` (${s.abonoCount} abonada${s.abonoCount > 1 ? "s" : ""}: ${brl(s.abonoTotal)} não descontado)` : ""}
                                </TableCell>
                                <TableCell className="text-xs font-black text-red-600 text-right">-{brl(s.glosaTotal)}</TableCell>
                                {side === "INTERNAL" && !approved && <TableCell />}
                            </TableRow>
                        </TableBody>
                    </Table>
                )}
            </div>

                    </TabsContent>
                    <TabsContent value="extras" className="mt-0">
            {/* Serviços extras e horas extras (lançados pelo gestor, aprovados pelo cliente) */}
            <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-600" /> Serviços extras e horas extras ({detail.extras.length})</span>
                    {side === "INTERNAL" && !approved && (
                        <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowExtraForm(v => !v)}>
                            <Plus className="w-3.5 h-3.5 mr-1" /> Lançar item
                        </Button>
                    )}
                </div>

                {showExtraForm && side === "INTERNAL" && !approved && (
                    <div className="p-4 border-b border-slate-100 bg-indigo-50/30 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-500">Tipo</label>
                                <select value={extraForm.type} onChange={e => setExtraForm(f => ({ ...f, type: e.target.value as any }))}
                                    className="w-full h-9 rounded-lg border border-slate-200 bg-white text-xs font-semibold px-2">
                                    <option value="HORA_EXTRA">Horas extras</option>
                                    <option value="SERVICO_EXTRA">Serviço extra</option>
                                </select>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-[10px] uppercase font-bold text-slate-500">Descrição</label>
                                <input value={extraForm.description} onChange={e => setExtraForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Ex.: Cobertura evento sábado - 4º andar" className="w-full h-9 rounded-lg border border-slate-200 bg-white text-xs px-2" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-500">Data de referência</label>
                                <input type="date" value={extraForm.referenceDate} onChange={e => setExtraForm(f => ({ ...f, referenceDate: e.target.value }))}
                                    className="w-full h-9 rounded-lg border border-slate-200 bg-white text-xs px-2" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-500">Solicitado por</label>
                                <input value={extraForm.requestedBy} onChange={e => setExtraForm(f => ({ ...f, requestedBy: e.target.value }))}
                                    placeholder="Contato do cliente" className="w-full h-9 rounded-lg border border-slate-200 bg-white text-xs px-2" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-500">{extraForm.type === "HORA_EXTRA" ? "Quantidade de horas" : "Quantidade"}</label>
                                <input type="number" min="0" step="0.5" value={extraForm.quantity} onChange={e => setExtraForm(f => ({ ...f, quantity: e.target.value }))}
                                    className="w-full h-9 rounded-lg border border-slate-200 bg-white text-xs px-2" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-500">{extraForm.type === "HORA_EXTRA" ? "Valor da hora (R$)" : "Valor unitário (R$)"}</label>
                                <input type="number" min="0" step="0.01" value={extraForm.unitValue} onChange={e => setExtraForm(f => ({ ...f, unitValue: e.target.value }))}
                                    className="w-full h-9 rounded-lg border border-slate-200 bg-white text-xs px-2" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-500">Total</label>
                                <div className="h-9 flex items-center text-sm font-black text-indigo-700">
                                    {brl((Number(String(extraForm.quantity).replace(",", ".")) || 0) * (Number(String(extraForm.unitValue).replace(",", ".")) || 0))}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowExtraForm(false)}>Cancelar</Button>
                            <Button size="sm" disabled={deciding} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" onClick={saveExtra}>Lançar para aprovação do cliente</Button>
                        </div>
                    </div>
                )}

                {detail.extras.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 italic font-semibold">Nenhum serviço ou hora extra lançado neste mês.</div>
                ) : (
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="text-xs font-bold text-slate-800 pl-4">Tipo</TableHead>
                                <TableHead className="text-xs font-bold text-slate-800">Descrição</TableHead>
                                <TableHead className="text-xs font-bold text-slate-800">Data / Solicitante</TableHead>
                                <TableHead className="text-xs font-bold text-slate-800 text-right">Qtd x Valor</TableHead>
                                <TableHead className="text-xs font-bold text-slate-800 text-right">Total</TableHead>
                                <TableHead className="text-xs font-bold text-slate-800 text-center">Situação</TableHead>
                                <TableHead className="text-xs font-bold text-slate-800 text-right pr-4">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {detail.extras.map((x: any) => (
                                <Fragment key={x.id}>
                                    <TableRow>
                                        <TableCell className="pl-4"><Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-bold">{x.type === "HORA_EXTRA" ? "Horas extras" : "Serviço extra"}</Badge></TableCell>
                                        <TableCell className="text-xs font-semibold text-slate-800 max-w-[260px]">
                                            {x.description}
                                            {x.decisionNote && <div className="text-[10px] text-slate-500 italic mt-0.5">Cliente: {x.decisionNote}</div>}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-600">
                                            {x.referenceDate ? fmtDate(x.referenceDate) : "-"}
                                            {x.requestedBy && <div className="text-[10px] text-slate-400">Solic.: {x.requestedBy}</div>}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-600 text-right">{x.quantity} x {brl(x.unitValue)}</TableCell>
                                        <TableCell className="text-xs font-black text-slate-800 text-right">{brl(x.total)}</TableCell>
                                        <TableCell className="text-center">
                                            {x.status === "APPROVED" ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-bold">Aprovado</Badge>
                                                : x.status === "REJECTED" ? <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50 font-bold">Recusado</Badge>
                                                : <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 font-bold">Aguardando cliente</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right pr-4">
                                            <div className="flex justify-end gap-1.5">
                                                {side === "CLIENT" && !approved && x.status !== "APPROVED" && (
                                                    <>
                                                        <Button size="sm" disabled={deciding} className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => decideExtra(x.id, "APPROVE")}>Aprovar</Button>
                                                        {x.status !== "REJECTED" && (
                                                            <Button size="sm" variant="outline" disabled={deciding} className="h-7 text-[11px] text-red-600" onClick={() => { setRejectExtraId(rejectExtraId === x.id ? null : x.id); setRejectExtraNote(""); }}>Recusar</Button>
                                                        )}
                                                    </>
                                                )}
                                                {side === "INTERNAL" && !approved && x.status !== "APPROVED" && (
                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50" title="Remover item" onClick={() => removeExtra(x.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    {rejectExtraId === x.id && (
                                        <TableRow className="bg-red-50/40">
                                            <TableCell colSpan={7} className="px-4 py-3">
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <Textarea value={rejectExtraNote} onChange={e => setRejectExtraNote(e.target.value)} placeholder="Motivo da recusa (obrigatório)" className="min-h-[56px] text-xs bg-white" />
                                                    <div className="flex sm:flex-col gap-2 shrink-0">
                                                        <Button size="sm" disabled={deciding} className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white" onClick={() => decideExtra(x.id, "REJECT")}>Confirmar recusa</Button>
                                                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setRejectExtraId(null)}>Cancelar</Button>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </Fragment>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

                    </TabsContent>
                    <TabsContent value="history" className="mt-0">
            {/* Histórico */}
            <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-xs font-bold text-slate-700">
                    <MessageSquare className="w-4 h-4 text-indigo-600" /> Histórico da medição ({m?.events?.length || 0})
                </div>
                <div className="p-4 space-y-3">
                    {(!m || m.events.length === 0) ? (
                        <div className="text-center text-xs text-slate-400 italic font-semibold py-2">Nenhuma interação registrada nesta medição.</div>
                    ) : m.events.map((e: any) => {
                        const mine = e.side === side;
                        return (
                            <div key={e.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] rounded-xl border p-3 space-y-1.5 ${
                                    e.type === "APPROVAL" ? "bg-emerald-50 border-emerald-200" :
                                    e.type === "REVISION_REQUEST" ? "bg-red-50 border-red-200" :
                                    e.side === "CLIENT" ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200"
                                }`}>
                                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                        {e.side === "CLIENT" ? <Building2 className="w-3.5 h-3.5 text-blue-600" /> : <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />}
                                        <b className="text-slate-800">{e.authorName}</b>
                                        <span className="text-slate-400">({e.side === "CLIENT" ? "Cliente" : "Equipe interna"})</span>
                                        <span className="font-bold text-slate-600">· {EVENT_LABEL[e.type] || e.type}</span>
                                        <span className="text-slate-400 ml-auto">{fmtDateTime(e.createdAt)}</span>
                                    </div>
                                    {e.message && <p className="text-xs text-slate-700 whitespace-pre-wrap">{e.message}</p>}
                                    {e.attachments?.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {e.attachments.map((a: any) => (
                                                <button
                                                    key={a.id}
                                                    onClick={() => download(a.id)}
                                                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 hover:bg-slate-100"
                                                    title="Baixar anexo"
                                                >
                                                    <FileText className="w-3 h-3 text-indigo-600" /> {a.fileName}
                                                    <Download className="w-3 h-3 text-slate-400" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

            </div>
                    </TabsContent>
                </div>
            </Tabs>
            <div className="shrink-0 border-t border-slate-200 bg-white">
                {/* Barra de ação (sempre visível) */}
                {approved ? (
                    <div className="px-6 py-3 bg-emerald-50 text-xs text-emerald-700 font-semibold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Medição aprovada pelo cliente. O histórico está encerrado.
                    </div>
                ) : (
                    <div className="px-6 py-3 space-y-2">
                        <Textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder={side === "CLIENT"
                                ? "Descreva sua análise: o que está divergente? (obrigatório para solicitar revisão)"
                                : "Escreva a resposta para o cliente sobre esta medição..."}
                            className="min-h-[56px] max-h-[96px] text-xs bg-white"
                        />
                        {files.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {files.map((f, i) => (
                                    <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1">
                                        <FileText className="w-3 h-3 text-indigo-600" /> {f.name}
                                        <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} title="Remover">
                                            <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 justify-between">
                            <div className="flex items-center gap-2">
                                <input ref={fileInput} type="file" multiple className="hidden" onChange={e => onPickFiles(e.target.files)} />
                                <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => fileInput.current?.click()} disabled={sending}>
                                    <Paperclip className="w-3.5 h-3.5 mr-1.5" /> Anexar evidências
                                </Button>
                                <span className="text-[10px] text-slate-400">até 5 arquivos, 4 MB cada</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" variant="outline" size="sm" className="h-9 text-xs" disabled={sending} onClick={() => submit("COMMENT")}>
                                    <Send className="w-3.5 h-3.5 mr-1.5" /> Apenas comentar
                                </Button>
                                {side === "CLIENT" ? (
                                    <>
                                        <Button type="button" size="sm" disabled={sending || !hasData} onClick={() => submit("REVISION_REQUEST")}
                                            className="h-9 text-xs font-bold bg-red-600 hover:bg-red-700 text-white">
                                            <Undo2 className="w-3.5 h-3.5 mr-1.5" /> Solicitar revisão
                                        </Button>
                                        <Button type="button" size="sm" disabled={sending || !hasData} onClick={() => submit("APPROVAL")}
                                            className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Aprovar medição
                                        </Button>
                                    </>
                                ) : (
                                    <Button type="button" size="sm" disabled={sending} onClick={() => submit("RESPONSE")}
                                        className="h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white">
                                        <Send className="w-3.5 h-3.5 mr-1.5" /> Responder ao cliente
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
