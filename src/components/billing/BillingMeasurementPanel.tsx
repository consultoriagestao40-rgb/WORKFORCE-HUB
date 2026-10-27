"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
    CheckCircle2, AlertTriangle, Paperclip, Send, MessageSquare, Download,
    X, FileText, RefreshCw, Undo2, ShieldCheck, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    getMeasurementDetail,
    postMeasurementEvent,
    getMeasurementAttachment,
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

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getMeasurementDetail(clientId, year, month);
            if (res.success) setDetail(res);
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
            return <Badge className="bg-red-50 text-red-700 border-red-100 hover:bg-red-50 font-black">▲ Posto Vago (Glosa)</Badge>;
        }
        if (r.status === "FOLGA") return <Badge className="bg-slate-100 text-slate-500 border-slate-200/50 hover:bg-slate-100 font-semibold">○ Folga</Badge>;
        return <Badge className="bg-slate-100 text-slate-600 border-none hover:bg-slate-100">○ Aguardando</Badge>;
    };

    return (
        <div className="space-y-5 p-5 bg-slate-50/60 border-t border-slate-200/70">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                    { label: "Faturamento previsto", value: brl(s.expected), cls: "text-slate-800" },
                    { label: "Glosas", value: s.glosaTotal > 0 ? `-${brl(s.glosaTotal)}` : brl(0), cls: s.glosaTotal > 0 ? "text-red-600" : "text-slate-500" },
                    { label: "Líquido a faturar", value: brl(s.net), cls: "text-emerald-600" },
                ].map(c => (
                    <div key={c.label} className="bg-white rounded-xl border border-slate-200/60 p-3 shadow-sm">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{c.label}</div>
                        <div className={`text-base font-black mt-1 ${c.cls}`}>{c.value}</div>
                    </div>
                ))}
            </div>

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
                    <div className="max-h-[560px] overflow-auto border border-slate-200/60 rounded-xl">
                        <Table>
                            <TableHeader className="bg-slate-50 sticky top-0">
                                <TableRow>
                                    <TableHead className="text-xs font-bold text-slate-800">Data</TableHead>
                                    <TableHead className="text-xs font-bold text-slate-800">Unidade</TableHead>
                                    <TableHead className="text-xs font-bold text-slate-800">Cargo / Função</TableHead>
                                    <TableHead className="text-xs font-bold text-slate-800">Colaborador</TableHead>
                                    <TableHead className="text-xs font-bold text-slate-800 text-center">Status</TableHead>
                                    <TableHead className="text-xs font-bold text-slate-800">Notas Operacionais</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {detail.rows.map((r: any) => (
                                    <TableRow key={r.id} className={r.glosa > 0 ? "bg-red-50/20" : r.status === "FOLGA" ? "opacity-75 bg-slate-100/40" : ""}>
                                        <TableCell className="text-xs font-bold">{fmtDate(r.date)}</TableCell>
                                        <TableCell className="text-xs font-semibold truncate max-w-[150px]">{r.clientName}</TableCell>
                                        <TableCell className="text-xs font-semibold">{r.roleName}</TableCell>
                                        <TableCell className="text-xs font-bold text-slate-800">{r.employeeName}</TableCell>
                                        <TableCell className="text-center">{statusBadge(r)}</TableCell>
                                        <TableCell className="text-xs text-slate-500">{r.notes || "-"}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {/* Glosas */}
            <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-xs font-bold text-slate-700">
                    <AlertTriangle className="w-4 h-4 text-red-500" /> Glosas do mês (faltas não cobertas)
                </div>
                {detail.glosaRows.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 italic font-semibold">Nenhuma glosa neste mês.</div>
                ) : (
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="text-xs font-bold text-slate-800 pl-4">Data</TableHead>
                                <TableHead className="text-xs font-bold text-slate-800">Função</TableHead>
                                <TableHead className="text-xs font-bold text-slate-800">Colaborador</TableHead>
                                <TableHead className="text-xs font-bold text-slate-800">Observação</TableHead>
                                <TableHead className="text-xs font-bold text-slate-800 text-right pr-4">Valor da glosa</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {detail.glosaRows.map((r: any) => (
                                <TableRow key={r.id}>
                                    <TableCell className="text-xs font-bold pl-4">{fmtDate(r.date)}</TableCell>
                                    <TableCell className="text-xs font-semibold">{r.roleName}</TableCell>
                                    <TableCell className="text-xs font-semibold">{r.employeeName}</TableCell>
                                    <TableCell className="text-xs text-slate-500">{r.notes || "-"}</TableCell>
                                    <TableCell className="text-xs font-bold text-red-600 text-right pr-4">-{brl(r.glosa)}</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-red-50/40">
                                <TableCell colSpan={4} className="text-xs font-black text-slate-700 pl-4">Total de glosas</TableCell>
                                <TableCell className="text-xs font-black text-red-600 text-right pr-4">-{brl(s.glosaTotal)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                )}
            </div>

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

                {/* Composer */}
                {approved ? (
                    <div className="px-4 py-3 border-t border-slate-100 bg-emerald-50/40 text-xs text-emerald-700 font-semibold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Medição aprovada pelo cliente. O histórico está encerrado.
                    </div>
                ) : (
                    <div className="px-4 py-4 border-t border-slate-100 space-y-3 bg-slate-50/50">
                        <Textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder={side === "CLIENT"
                                ? "Descreva sua análise: o que está divergente? (obrigatório para solicitar revisão)"
                                : "Escreva a resposta para o cliente sobre esta medição..."}
                            className="min-h-[80px] text-xs bg-white"
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
