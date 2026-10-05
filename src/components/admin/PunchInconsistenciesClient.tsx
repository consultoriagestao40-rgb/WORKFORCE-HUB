"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    CalendarX2,
    CheckCircle2,
    Clock,
    EyeOff,
    Loader2,
    RotateCcw,
    Search,
    Send,
    ShieldAlert,
    Sparkles,
    UserX
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
    scanPunchInconsistencies,
    dispatchInconsistencies,
    ignoreInconsistency,
    unignoreInconsistency,
    type InconsistencyRow
} from "@/actions/punch-inconsistencies";

type Props = {
    clients: Array<{ id: string; name: string }>;
    managers: Array<{ id: string; name: string; hasPhone: boolean }>;
    hideHeader?: boolean;
};

const COLS = ["Entrada1", "Saida1", "Entrada2", "Saida2", "Entrada3", "Saida3"] as const;
const COL_SHORT: Record<string, string> = { Entrada1: "E1", Saida1: "S1", Entrada2: "E2", Saida2: "S2", Entrada3: "E3", Saida3: "S3" };
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const ADJ_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    PENDING_RESPONSE: { label: "Aguardando Gestor", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    PENDING_REASON: { label: "Aguardando Gestor", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    PENDING_SCOPE: { label: "Aguardando Gestor", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    PENDING_AUDIT: { label: "Pendente RH", cls: "bg-sky-50 text-sky-700 border-sky-200" },
    APPROVED_SYNCED: { label: "Lançado no Secullum", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    CONFIRMED_ABSENCE: { label: "Falta Confirmada", cls: "bg-rose-50 text-rose-700 border-rose-200" },
    REJECTED: { label: "Rejeitado", cls: "bg-slate-100 text-slate-600 border-slate-200" },
    DISCARDED_OFFLINE_FOUND: { label: "Descartado", cls: "bg-slate-100 text-slate-600 border-slate-200" }
};

const IGNORE_REASONS = [
    "Folga / troca de escala",
    "Férias ou afastamento",
    "Já tratado diretamente no Secullum",
    "Colaborador desligado / transferido",
    "Outro"
];

function spToday(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Ciclo da folha (26 a 25) que contém o dia de ontem; fim limitado a ontem */
function defaultPeriod(): { start: string; end: string } {
    const today = new Date(`${spToday()}T12:00:00Z`);
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const y = yesterday.getUTCFullYear();
    const m = yesterday.getUTCMonth();
    const startDate = yesterday.getUTCDate() >= 26 ? new Date(Date.UTC(y, m, 26, 12)) : new Date(Date.UTC(y, m - 1, 26, 12));
    const cycleEnd = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 25, 12));
    const end = cycleEnd < yesterday ? cycleEnd : yesterday;
    return { start: startDate.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function fmtDate(d: string) {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
}

export default function PunchInconsistenciesClient({ clients, managers, hideHeader = false }: Props) {
    const period = useMemo(defaultPeriod, []);
    const [startDate, setStartDate] = useState(period.start);
    const [endDate, setEndDate] = useState(period.end);
    const [managerFilter, setManagerFilter] = useState("ALL");
    const [clientFilter, setClientFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState<"NOVO" | "ENVIADO" | "IGNORADO" | "ALL">("NOVO");
    const [kindFilter, setKindFilter] = useState<"ALL" | "SEM_BATIDAS" | "INCOMPLETA">("ALL");
    const [search, setSearch] = useState("");

    const [rows, setRows] = useState<InconsistencyRow[]>([]);
    const [unmatched, setUnmatched] = useState(0);
    const [loading, setLoading] = useState(false);
    const [hasScanned, setHasScanned] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [sendingKeys, setSendingKeys] = useState<Set<string>>(new Set());

    const [confirmItems, setConfirmItems] = useState<InconsistencyRow[] | null>(null);
    const [ignoreRow, setIgnoreRow] = useState<InconsistencyRow | null>(null);
    const [ignoreReason, setIgnoreReason] = useState(IGNORE_REASONS[0]);

    const runScan = async () => {
        setLoading(true);
        setSelected(new Set());
        try {
            const res = await scanPunchInconsistencies({ startDate, endDate });
            if (!res.success) {
                toast.error(res.message || "Erro ao buscar inconsistências.");
                return;
            }
            setRows(res.rows);
            setUnmatched(res.unmatched);
            setHasScanned(true);
            toast.success(`${res.rows.length} inconsistência(s) encontradas no Secullum.`);
        } catch (e: any) {
            toast.error(e.message || "Erro ao buscar inconsistências.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        runScan();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Filtros (exceto status) — base para os cards
    const baseFiltered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter(r => {
            if (managerFilter === "NONE" && r.managerId) return false;
            if (managerFilter !== "ALL" && managerFilter !== "NONE" && r.managerId !== managerFilter) return false;
            if (clientFilter !== "ALL" && r.clientId !== clientFilter) return false;
            if (kindFilter !== "ALL" && r.kind !== kindFilter) return false;
            if (q && !r.employeeName.toLowerCase().includes(q) && !(r.clientName || "").toLowerCase().includes(q) && !(r.folha || "").includes(q)) return false;
            return true;
        });
    }, [rows, managerFilter, clientFilter, kindFilter, search]);

    const filtered = useMemo(
        () => baseFiltered.filter(r => statusFilter === "ALL" || r.status === statusFilter),
        [baseFiltered, statusFilter]
    );

    const stats = useMemo(() => ({
        novos: baseFiltered.filter(r => r.status === "NOVO").length,
        semBatidas: baseFiltered.filter(r => r.status === "NOVO" && r.kind === "SEM_BATIDAS").length,
        incompletas: baseFiltered.filter(r => r.status === "NOVO" && r.kind === "INCOMPLETA").length,
        enviados: baseFiltered.filter(r => r.status === "ENVIADO").length,
        semGestor: baseFiltered.filter(r => r.status === "NOVO" && !r.managerHasPhone).length,
        ignorados: baseFiltered.filter(r => r.status === "IGNORADO").length
    }), [baseFiltered]);

    const selectable = filtered.filter(r => r.status === "NOVO");
    const allSelected = selectable.length > 0 && selectable.every(r => selected.has(r.key));

    const toggleAll = () => {
        setSelected(prev => {
            const next = new Set(prev);
            if (allSelected) selectable.forEach(r => next.delete(r.key));
            else selectable.forEach(r => next.add(r.key));
            return next;
        });
    };

    const toggleOne = (key: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const doDispatch = async (items: InconsistencyRow[]) => {
        setConfirmItems(null);
        const keys = new Set(items.map(i => i.key));
        setSendingKeys(keys);
        try {
            const res = await dispatchInconsistencies(items.map(i => ({
                employeeId: i.employeeId,
                date: i.date,
                missing: i.missing,
                expected: i.expected,
                kind: i.kind
            })));
            const byKey = new Map(res.results.map(r => [r.key, r]));
            setRows(prev => prev.map(r => {
                const out = byKey.get(r.key);
                if (!out?.code) return r;
                return { ...r, status: "ENVIADO", adjustment: { id: "", code: out.code, status: "PENDING_RESPONSE", secullumStatus: null } };
            }));
            setSelected(prev => {
                const next = new Set(prev);
                keys.forEach(k => next.delete(k));
                return next;
            });
            const ok = res.results.filter(r => r.ok).length;
            const fails = res.results.filter(r => !r.ok);
            if (ok) toast.success(`${ok} solicitação(ões) enviada(s) aos gestores.`);
            fails.slice(0, 3).forEach(f => toast.error(f.message || "Falha ao enviar."));
            if (fails.length > 3) toast.error(`+${fails.length - 3} falha(s).`);
        } catch (e: any) {
            toast.error(e.message || "Erro ao enviar.");
        } finally {
            setSendingKeys(new Set());
        }
    };

    const doIgnore = async () => {
        if (!ignoreRow) return;
        const row = ignoreRow;
        setIgnoreRow(null);
        const res = await ignoreInconsistency(row.employeeId, row.date, ignoreReason);
        if (!res.success) return toast.error(res.message || "Erro ao ignorar.");
        setRows(prev => prev.map(r => (r.key === row.key ? { ...r, status: "IGNORADO", ignored: { reason: ignoreReason, userName: null } } : r)));
        setSelected(prev => {
            const next = new Set(prev);
            next.delete(row.key);
            return next;
        });
        toast.success("Inconsistência ignorada.");
    };

    const doUnignore = async (row: InconsistencyRow) => {
        const res = await unignoreInconsistency(row.employeeId, row.date);
        if (!res.success) return toast.error(res.message || "Erro.");
        setRows(prev => prev.map(r => (r.key === row.key ? { ...r, status: "NOVO", ignored: null } : r)));
        toast.success("Inconsistência reativada.");
    };

    const selectedRows = rows.filter(r => selected.has(r.key));
    const selectedWithoutManager = selectedRows.filter(r => !r.managerHasPhone).length;

    const StatCard = ({ title, value, hint, icon: Icon, tone, onClick, active }: any) => (
        <button
            type="button"
            onClick={onClick}
            className={`text-left bg-white rounded-xl border p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${active ? `ring-2 ${tone.ring} ${tone.border}` : "border-slate-200 hover:border-slate-300"}`}
        >
            <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${tone.text}`}>{title}</span>
                <div className={`p-2 rounded-xl ${tone.bg}`}><Icon className="w-4 h-4" /></div>
            </div>
            <div className="mt-2 text-3xl font-black text-slate-900">{value}</div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{hint}</p>
        </button>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            {!hideHeader ? (
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-2 border-b border-slate-200">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
                                <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                                Leitura ao vivo do Secullum Ponto Web
                            </span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
                            <CalendarX2 className="w-8 h-8 text-rose-500" />
                            Inconsistências de Ponto
                        </h1>
                        <p className="text-sm text-slate-500 font-medium mt-1">
                            Dias com batidas faltando ou sem nenhuma batida. Analise e envie ao gestor do contrato para ajustar ou confirmar falta.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            id="btn-send-selected"
                            disabled={selectedRows.length === 0 || sendingKeys.size > 0}
                            onClick={() => setConfirmItems(selectedRows)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm rounded-xl px-4 h-10 flex items-center gap-2"
                        >
                            {sendingKeys.size > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-indigo-200" />}
                            Enviar selecionados ({selectedRows.length})
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <CalendarX2 className="w-5 h-5 text-rose-500" />
                            Inconsistências Detectadas no Secullum
                        </h2>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Dias com batidas faltando ou em branco. Selecione e dispare o menu de tratativa ao gestor do contrato.
                        </p>
                    </div>
                    <Button
                        id="btn-send-selected-tab"
                        disabled={selectedRows.length === 0 || sendingKeys.size > 0}
                        onClick={() => setConfirmItems(selectedRows)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm rounded-xl px-4 h-9 text-xs flex items-center gap-2"
                    >
                        {sendingKeys.size > 0 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-indigo-200" />}
                        Enviar selecionados ({selectedRows.length})
                    </Button>
                </div>
            )}

            {/* Filtros */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3 items-end">
                    <div>
                        <Label className="text-xs font-semibold text-slate-600">Início</Label>
                        <Input id="filter-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 rounded-lg" />
                    </div>
                    <div>
                        <Label className="text-xs font-semibold text-slate-600">Fim</Label>
                        <Input id="filter-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 rounded-lg" />
                    </div>
                    <div>
                        <Label className="text-xs font-semibold text-slate-600">Gestor</Label>
                        <Select value={managerFilter} onValueChange={setManagerFilter}>
                            <SelectTrigger id="filter-manager" className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos os gestores</SelectItem>
                                <SelectItem value="NONE">⚠️ Sem gestor</SelectItem>
                                {managers.map(m => (
                                    <SelectItem key={m.id} value={m.id}>{m.name}{m.hasPhone ? "" : " (sem telefone)"}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-xs font-semibold text-slate-600">Contrato</Label>
                        <Select value={clientFilter} onValueChange={setClientFilter}>
                            <SelectTrigger id="filter-client" className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos os contratos</SelectItem>
                                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-xs font-semibold text-slate-600">Tipo</Label>
                        <Select value={kindFilter} onValueChange={v => setKindFilter(v as any)}>
                            <SelectTrigger id="filter-kind" className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos</SelectItem>
                                <SelectItem value="SEM_BATIDAS">Sem nenhuma batida</SelectItem>
                                <SelectItem value="INCOMPLETA">Batidas faltando</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-xs font-semibold text-slate-600">Buscar</Label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                            <Input id="filter-search" placeholder="Nome, contrato, folha" value={search} onChange={e => setSearch(e.target.value)} className="h-10 rounded-lg pl-9" />
                        </div>
                    </div>
                    <Button id="btn-scan" onClick={runScan} disabled={loading} className="h-10 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold">
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                        Buscar inconsistências
                    </Button>
                </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard title="Para analisar" value={stats.novos} hint="Ainda não enviadas" icon={AlertTriangle}
                    tone={{ text: "text-rose-700", bg: "bg-rose-100 text-rose-700", ring: "ring-rose-100", border: "border-rose-300" }}
                    active={statusFilter === "NOVO" && kindFilter === "ALL"} onClick={() => { setStatusFilter("NOVO"); setKindFilter("ALL"); }} />
                <StatCard title="Sem nenhuma batida" value={stats.semBatidas} hint="Dia de trabalho vazio" icon={CalendarX2}
                    tone={{ text: "text-red-700", bg: "bg-red-100 text-red-700", ring: "ring-red-100", border: "border-red-300" }}
                    active={statusFilter === "NOVO" && kindFilter === "SEM_BATIDAS"} onClick={() => { setStatusFilter("NOVO"); setKindFilter("SEM_BATIDAS"); }} />
                <StatCard title="Batidas faltando" value={stats.incompletas} hint="Dia incompleto" icon={Clock}
                    tone={{ text: "text-amber-700", bg: "bg-amber-100 text-amber-700", ring: "ring-amber-100", border: "border-amber-300" }}
                    active={statusFilter === "NOVO" && kindFilter === "INCOMPLETA"} onClick={() => { setStatusFilter("NOVO"); setKindFilter("INCOMPLETA"); }} />
                <StatCard title="Enviadas ao gestor" value={stats.enviados} hint="Com ajuste em andamento" icon={CheckCircle2}
                    tone={{ text: "text-emerald-700", bg: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-100", border: "border-emerald-300" }}
                    active={statusFilter === "ENVIADO"} onClick={() => { setStatusFilter("ENVIADO"); setKindFilter("ALL"); }} />
                <StatCard title="Ignoradas" value={stats.ignorados} hint="Marcadas para não tratar" icon={EyeOff}
                    tone={{ text: "text-slate-600", bg: "bg-slate-100 text-slate-600", ring: "ring-slate-100", border: "border-slate-300" }}
                    active={statusFilter === "IGNORADO"} onClick={() => { setStatusFilter("IGNORADO"); setKindFilter("ALL"); }} />
            </div>

            {(stats.semGestor > 0 || unmatched > 0) && (
                <div className="flex flex-col gap-2">
                    {stats.semGestor > 0 && (
                        <div className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2.5">
                            <UserX className="w-4 h-4 shrink-0" />
                            <span>
                                <b>{stats.semGestor}</b> inconsistência(s) em contratos <b>sem gestor com telefone</b>. Se enviadas, vão como aviso em texto para o grupo "Ajuste de ponto".
                                <button className="underline ml-1 font-semibold" onClick={() => { setManagerFilter("NONE"); setStatusFilter("NOVO"); }}>Ver contratos sem gestor</button>
                            </span>
                        </div>
                    )}
                    {unmatched > 0 && (
                        <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 text-slate-600 rounded-lg px-4 py-2">
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                            {unmatched} colaborador(es) do Secullum com inconsistência não foram encontrados no Hub (CPF não cadastrado) e não aparecem na lista.
                        </div>
                    )}
                </div>
            )}

            {/* Tabela */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/80">
                            <TableHead className="w-10">
                                <input id="chk-all" type="checkbox" className="w-4 h-4 accent-indigo-600 cursor-pointer" checked={allSelected} onChange={toggleAll} disabled={selectable.length === 0} />
                            </TableHead>
                            <TableHead className="font-bold text-slate-700">Data</TableHead>
                            <TableHead className="font-bold text-slate-700">Colaborador</TableHead>
                            <TableHead className="font-bold text-slate-700">Contrato / Posto</TableHead>
                            <TableHead className="font-bold text-slate-700">Gestor</TableHead>
                            <TableHead className="font-bold text-slate-700">Marcações (real × previsto)</TableHead>
                            <TableHead className="font-bold text-slate-700">Situação</TableHead>
                            <TableHead className="font-bold text-slate-700 text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-16 text-slate-500">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-600" />
                                    Lendo cartões de ponto no Secullum...
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-16 text-slate-500">
                                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                                    {hasScanned ? "Nenhuma inconsistência com esses filtros." : "Clique em Buscar inconsistências."}
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && filtered.map(r => {
                            const isSending = sendingKeys.has(r.key);
                            const adjBadge = r.adjustment ? ADJ_STATUS_LABEL[r.adjustment.status] : null;
                            const usedCols = COLS.filter(c => r.expected[c] || r.actual[c] || r.missing.includes(c));
                            return (
                                <TableRow key={r.key} className={`transition-colors ${selected.has(r.key) ? "bg-indigo-50/50" : "hover:bg-slate-50/60"}`}>
                                    <TableCell>
                                        <input type="checkbox" className="w-4 h-4 accent-indigo-600 cursor-pointer" disabled={r.status !== "NOVO"} checked={selected.has(r.key)} onChange={() => toggleOne(r.key)} />
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        <div className={`font-bold ${r.weekday === 0 ? "text-rose-600" : "text-slate-800"}`}>{fmtDate(r.date)}</div>
                                        <div className="text-xs text-slate-500">{WEEKDAYS[r.weekday]}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-semibold text-slate-800 leading-tight">{r.employeeName}</div>
                                        {r.folha && <div className="text-xs text-slate-500">Folha {r.folha}</div>}
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm font-medium text-slate-700 leading-tight">{r.clientName || <span className="text-slate-400">Sem alocação</span>}</div>
                                        {r.postoName && <div className="text-xs text-slate-500">{r.postoName}</div>}
                                    </TableCell>
                                    <TableCell>
                                        {r.managerName ? (
                                            <div className="text-sm text-slate-700">
                                                {r.managerName}
                                                {!r.managerHasPhone && <div className="text-[11px] text-amber-600 font-semibold">sem telefone</div>}
                                            </div>
                                        ) : (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Sem gestor</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {usedCols.map(c => {
                                                const isMissing = r.missing.includes(c);
                                                const val = r.actual[c];
                                                const isText = val && !/^\d{1,2}:\d{2}$/.test(val);
                                                return (
                                                    <div
                                                        key={c}
                                                        title={`${c} — previsto ${r.expected[c] || "—"}`}
                                                        className={`flex flex-col items-center min-w-[52px] px-1.5 py-1 rounded-md border text-[11px] leading-tight ${isMissing
                                                            ? "bg-rose-50 border-rose-200 text-rose-700 border-dashed"
                                                            : isText
                                                                ? "bg-slate-700 border-slate-700 text-white"
                                                                : "bg-emerald-50 border-emerald-200 text-emerald-800"
                                                            }`}
                                                    >
                                                        <span className="font-bold opacity-70">{COL_SHORT[c]}</span>
                                                        <span className="font-mono font-semibold">{isMissing ? "faltou" : val}</span>
                                                        <span className="opacity-60">{r.expected[c] || "—"}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {r.workedOnDayOff && <div className="text-[11px] text-violet-600 font-semibold mt-1">Batidas em dia de folga</div>}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {r.status === "NOVO" && (
                                            <Badge variant="outline" className={r.kind === "SEM_BATIDAS" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
                                                {r.kind === "SEM_BATIDAS" ? "Sem batidas" : `Faltam ${r.missing.length}`}
                                            </Badge>
                                        )}
                                        {r.status === "ENVIADO" && r.adjustment && (
                                            <div className="flex flex-col gap-1">
                                                <span className="font-mono text-xs font-bold text-indigo-700">#{r.adjustment.code}</span>
                                                {adjBadge && <Badge variant="outline" className={adjBadge.cls}>{adjBadge.label}</Badge>}
                                            </div>
                                        )}
                                        {r.status === "IGNORADO" && (
                                            <div className="flex flex-col gap-0.5">
                                                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">Ignorada</Badge>
                                                {r.ignored?.reason && <span className="text-[11px] text-slate-500 max-w-[160px] truncate" title={r.ignored.reason}>{r.ignored.reason}</span>}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                        {r.status === "NOVO" && (
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Button size="sm" disabled={isSending} onClick={() => setConfirmItems([r])}
                                                    className="h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                                                    {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                                                    {!isSending && "Enviar"}
                                                </Button>
                                                <Button size="sm" variant="outline" disabled={isSending} onClick={() => { setIgnoreRow(r); setIgnoreReason(IGNORE_REASONS[0]); }}
                                                    className="h-8 rounded-lg text-slate-600" title="Ignorar">
                                                    <EyeOff className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        )}
                                        {r.status === "IGNORADO" && (
                                            <Button size="sm" variant="outline" onClick={() => doUnignore(r)} className="h-8 rounded-lg text-slate-600">
                                                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reativar
                                            </Button>
                                        )}
                                        {r.status === "ENVIADO" && (
                                            <a href="/admin/punch-adjustments" className="text-xs font-semibold text-sky-700 hover:underline">Ver ajuste →</a>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Confirmar envio */}
            <Dialog open={!!confirmItems} onOpenChange={o => !o && setConfirmItems(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Send className="w-5 h-5 text-indigo-600" /> Enviar ao gestor</DialogTitle>
                        <DialogDescription>
                            Será criado <b>um ajuste por colaborador/dia</b> e o gestor do contrato recebe no WhatsApp privado o menu para <b>Ajustar Ponto</b> ou <b>Confirmar Falta</b>.
                        </DialogDescription>
                    </DialogHeader>
                    {confirmItems && (
                        <div className="space-y-2 text-sm">
                            <div className="max-h-56 overflow-auto rounded-lg border border-slate-200 divide-y">
                                {confirmItems.map(i => (
                                    <div key={i.key} className="px-3 py-2 flex justify-between gap-2">
                                        <span className="font-medium text-slate-700 truncate">{i.employeeName}</span>
                                        <span className="text-slate-500 whitespace-nowrap">{fmtDate(i.date)} · {i.managerName || "sem gestor"}</span>
                                    </div>
                                ))}
                            </div>
                            {confirmItems.some(i => !i.managerHasPhone) && (
                                <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                                    {confirmItems === selectedRows ? selectedWithoutManager : confirmItems.filter(i => !i.managerHasPhone).length} item(ns) sem gestor com telefone: irão como aviso em texto para o grupo "Ajuste de ponto".
                                </p>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmItems(null)}>Cancelar</Button>
                        <Button id="btn-confirm-send" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold" onClick={() => confirmItems && doDispatch(confirmItems)}>
                            Enviar {confirmItems?.length || 0}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Ignorar */}
            <Dialog open={!!ignoreRow} onOpenChange={o => !o && setIgnoreRow(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><EyeOff className="w-5 h-5 text-slate-600" /> Ignorar inconsistência</DialogTitle>
                        <DialogDescription>
                            {ignoreRow && <>{ignoreRow.employeeName} — {fmtDate(ignoreRow.date)}. Ela deixa de aparecer em "Para analisar".</>}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-600">Motivo</Label>
                        <Select value={ignoreReason} onValueChange={setIgnoreReason}>
                            <SelectTrigger id="ignore-reason"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {IGNORE_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIgnoreRow(null)}>Cancelar</Button>
                        <Button id="btn-confirm-ignore" onClick={doIgnore} className="bg-slate-800 hover:bg-slate-900 text-white">Ignorar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
