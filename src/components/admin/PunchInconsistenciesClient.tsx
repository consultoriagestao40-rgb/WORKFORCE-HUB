"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    Building2,
    Calendar,
    CalendarX2,
    CheckCircle2,
    Clock,
    EyeOff,
    Filter,
    Loader2,
    RotateCcw,
    Search,
    Send,
    ShieldAlert,
    Sparkles,
    User,
    UserX,
    PlusCircle
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
    launchDirectManualPunch,
    type InconsistencyRow
} from "@/actions/punch-inconsistencies";
import { COLUMN_LABEL, type PunchColumn } from "@/lib/punch-inconsistency";

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

    // Lançamento Direto de Batida Manual pelo RH (Esquecimento sem incomodar gestor)
    const [directPunchRow, setDirectPunchRow] = useState<InconsistencyRow | null>(null);
    const [directPunchCol, setDirectPunchCol] = useState<PunchColumn>("Saida2");
    const [directPunchTime, setDirectPunchTime] = useState("");
    const [directPunchReason, setDirectPunchReason] = useState("SEM REGISTRO DE PONTO (ESQUECIMENTO)");
    const [isDirectPunching, setIsDirectPunching] = useState(false);

    const openDirectPunch = (r: InconsistencyRow) => {
        setDirectPunchRow(r);
        const firstMissing = (r.missing[0] || "Saida2") as PunchColumn;
        setDirectPunchCol(firstMissing);
        setDirectPunchTime(r.expected[firstMissing] || "08:00");
        setDirectPunchReason("SEM REGISTRO DE PONTO (ESQUECIMENTO)");
    };

    const doDirectPunch = async () => {
        if (!directPunchRow || !directPunchCol || !directPunchTime) return;
        setIsDirectPunching(true);
        try {
            const res = await launchDirectManualPunch({
                employeeId: directPunchRow.employeeId,
                date: directPunchRow.date,
                coluna: directPunchCol,
                hora: directPunchTime,
                motivo: directPunchReason
            });
            if (res.success) {
                toast.success(res.message);
                setRows(prev => prev.map(r => r.key === directPunchRow.key ? {
                    ...r,
                    status: "ENVIADO",
                    adjustment: { id: "", code: "DIRETO", status: "APPROVED_SYNCED", secullumStatus: "SUCESSO" }
                } : r));
                setDirectPunchRow(null);
            } else {
                toast.error(`Erro ao lançar no Secullum: ${res.message}`);
            }
        } catch (err: any) {
            toast.error(err.message || "Erro ao lançar batida manual.");
        } finally {
            setIsDirectPunching(false);
        }
    };

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
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-sm space-y-4">
                {/* Linha 1: Seletores principais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* Período */}
                    <div className="min-w-0">
                        <Label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Período (Início e Fim)</span>
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Input 
                                id="filter-start" 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)} 
                                className="h-10 rounded-xl text-xs font-medium bg-slate-50/60 border-slate-200 px-2" 
                            />
                            <Input 
                                id="filter-end" 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)} 
                                className="h-10 rounded-xl text-xs font-medium bg-slate-50/60 border-slate-200 px-2" 
                            />
                        </div>
                    </div>

                    {/* Gestor */}
                    <div className="min-w-0">
                        <Label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>Gestor</span>
                        </Label>
                        <Select value={managerFilter} onValueChange={setManagerFilter}>
                            <SelectTrigger id="filter-manager" className="w-full h-10 rounded-xl text-xs font-medium bg-slate-50/60 border-slate-200 min-w-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                                <SelectItem value="ALL">Todos os gestores</SelectItem>
                                <SelectItem value="NONE">⚠️ Sem gestor</SelectItem>
                                {managers.map(m => (
                                    <SelectItem key={m.id} value={m.id}>{m.name}{m.hasPhone ? "" : " (sem telefone)"}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Contrato */}
                    <div className="min-w-0">
                        <Label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>Contrato</span>
                        </Label>
                        <Select value={clientFilter} onValueChange={setClientFilter}>
                            <SelectTrigger id="filter-client" className="w-full h-10 rounded-xl text-xs font-medium bg-slate-50/60 border-slate-200 min-w-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                                <SelectItem value="ALL">Todos os contratos</SelectItem>
                                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Tipo */}
                    <div className="min-w-0">
                        <Label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                            <Filter className="w-3.5 h-3.5 text-slate-400" />
                            <span>Tipo de Inconsistência</span>
                        </Label>
                        <Select value={kindFilter} onValueChange={v => setKindFilter(v as any)}>
                            <SelectTrigger id="filter-kind" className="w-full h-10 rounded-xl text-xs font-medium bg-slate-50/60 border-slate-200 min-w-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos os tipos</SelectItem>
                                <SelectItem value="SEM_BATIDAS">Sem nenhuma batida</SelectItem>
                                <SelectItem value="INCOMPLETA">Batidas faltando</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Linha 2: Busca rápida + Botão de busca */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2.5 border-t border-slate-100">
                    <div className="relative flex-1 w-full min-w-0">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <Input 
                            id="filter-search" 
                            placeholder="Buscar rapidamente por nome do colaborador, contrato ou matrícula..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)} 
                            className="h-10 rounded-xl pl-9 pr-8 text-xs font-medium bg-slate-50/60 border-slate-200 w-full" 
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1 cursor-pointer"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    <Button 
                        id="btn-scan" 
                        onClick={runScan} 
                        disabled={loading} 
                        className="w-full sm:w-auto h-10 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs px-5 shadow-sm shrink-0 flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                        {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
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

            {/* Tabela com Colunas Fixas (Data/Colaborador à esquerda e Botão de Envio SEMPRE VISÍVEL à direita) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden relative">
                <div className="w-full overflow-x-auto relative">
                    <Table className="w-full border-collapse border-spacing-0 min-w-[1050px]">
                        <TableHeader>
                            <TableRow className="bg-slate-50/90 border-b border-slate-200/80">
                                <TableHead className="w-10 sticky left-0 z-30 bg-slate-50 pl-4 pr-1 text-center">
                                    <input 
                                        id="chk-all" 
                                        type="checkbox" 
                                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer" 
                                        checked={allSelected} 
                                        onChange={toggleAll} 
                                        disabled={selectable.length === 0} 
                                    />
                                </TableHead>
                                <TableHead className="w-24 sticky left-10 z-30 bg-slate-50 font-bold text-slate-700 text-xs uppercase tracking-wider px-3 whitespace-nowrap">
                                    Data
                                </TableHead>
                                <TableHead className="min-w-[190px] max-w-[240px] sticky left-[136px] z-30 bg-slate-50 font-bold text-slate-700 text-xs uppercase tracking-wider px-3 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                                    Colaborador
                                </TableHead>
                                <TableHead className="min-w-[180px] max-w-[220px] font-bold text-slate-700 text-xs uppercase tracking-wider px-3">
                                    Contrato / Posto
                                </TableHead>
                                <TableHead className="min-w-[150px] max-w-[190px] font-bold text-slate-700 text-xs uppercase tracking-wider px-3">
                                    Gestor
                                </TableHead>
                                <TableHead className="min-w-[270px] font-bold text-slate-700 text-xs uppercase tracking-wider px-3">
                                    Marcações (real × previsto)
                                </TableHead>
                                <TableHead className="w-32 font-bold text-slate-700 text-xs uppercase tracking-wider px-3">
                                    Situação
                                </TableHead>
                                <TableHead className="w-36 sticky right-0 z-30 bg-slate-50 font-bold text-slate-700 text-xs uppercase tracking-wider text-right pr-4 pl-2 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)]">
                                    Ações
                                </TableHead>
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
                                const isSelected = selected.has(r.key);
                                const stickyBg = isSelected ? "bg-indigo-50/95" : "bg-white group-hover:bg-slate-50/95";

                                return (
                                    <TableRow 
                                        key={r.key} 
                                        className={`group transition-colors border-b border-slate-100 ${isSelected ? "bg-indigo-50/50" : "hover:bg-slate-50/60"}`}
                                    >
                                        {/* 1. Checkbox Sticky */}
                                        <TableCell className={`w-10 sticky left-0 z-20 transition-colors pl-4 pr-1 text-center ${stickyBg}`}>
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer" 
                                                disabled={r.status !== "NOVO"} 
                                                checked={isSelected} 
                                                onChange={() => toggleOne(r.key)} 
                                            />
                                        </TableCell>

                                        {/* 2. Data Sticky */}
                                        <TableCell className={`w-24 sticky left-10 z-20 transition-colors px-3 whitespace-nowrap ${stickyBg}`}>
                                            <div className={`font-black text-xs ${r.weekday === 0 ? "text-rose-600" : "text-slate-800"}`}>
                                                {fmtDate(r.date)}
                                            </div>
                                            <div className="text-[11px] text-slate-400 font-semibold">{WEEKDAYS[r.weekday]}</div>
                                        </TableCell>

                                        {/* 3. Colaborador Sticky */}
                                        <TableCell className={`min-w-[190px] max-w-[240px] sticky left-[136px] z-20 transition-colors px-3 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] ${stickyBg}`}>
                                            <div className="font-extrabold text-slate-900 text-xs leading-tight truncate" title={r.employeeName}>
                                                {r.employeeName}
                                            </div>
                                            {r.folha && (
                                                <div className="text-[10px] text-slate-400 font-mono font-medium mt-0.5">
                                                    Folha {r.folha}
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* 4. Contrato / Posto */}
                                        <TableCell className="min-w-[180px] max-w-[220px] px-3">
                                            <div className="text-xs font-bold text-slate-800 leading-tight truncate" title={r.clientName || "Sem alocação"}>
                                                {r.clientName || <span className="text-slate-400 font-normal">Sem alocação</span>}
                                            </div>
                                            {r.postoName && (
                                                <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5" title={r.postoName}>
                                                    {r.postoName}
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* 5. Gestor */}
                                        <TableCell className="min-w-[150px] max-w-[190px] px-3">
                                            {r.managerName ? (
                                                <div className="text-xs text-slate-700 font-medium truncate" title={r.managerName}>
                                                    <span className="font-semibold text-slate-800">{r.managerName}</span>
                                                    {!r.managerHasPhone && (
                                                        <span className="block text-[10px] text-amber-600 font-bold">⚠️ sem WhatsApp</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">
                                                    Sem gestor
                                                </Badge>
                                            )}
                                        </TableCell>

                                        {/* 6. Marcações (real × previsto) */}
                                        <TableCell className="min-w-[270px] px-3">
                                            <div className="flex flex-wrap gap-1">
                                                {usedCols.map(c => {
                                                    const isMissing = r.missing.includes(c);
                                                    const val = r.actual[c];
                                                    const isText = val && !/^\d{1,2}:\d{2}$/.test(val);
                                                    return (
                                                        <div
                                                            key={c}
                                                            title={`${c} — Previsto: ${r.expected[c] || "—"}`}
                                                            className={`flex flex-col items-center min-w-[48px] px-1.5 py-0.5 rounded-md border text-[10px] leading-tight transition-all ${
                                                                isMissing
                                                                    ? "bg-rose-50 border-rose-200 text-rose-700 border-dashed font-bold"
                                                                    : isText
                                                                        ? "bg-slate-700 border-slate-700 text-white font-semibold"
                                                                        : "bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold"
                                                            }`}
                                                        >
                                                            <span className="font-extrabold opacity-75">{COL_SHORT[c]}</span>
                                                            <span className="font-mono">{isMissing ? "faltou" : val}</span>
                                                            <span className="opacity-60 text-[9px]">{r.expected[c] || "—"}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {r.workedOnDayOff && (
                                                <div className="text-[10px] text-violet-600 font-bold mt-1">
                                                    ✦ Batidas em folga
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* 7. Situação */}
                                        <TableCell className="w-32 whitespace-nowrap px-3">
                                            {r.status === "NOVO" && (
                                                <Badge 
                                                    variant="outline" 
                                                    className={`text-[10px] font-black py-0.5 px-2 ${
                                                        r.kind === "SEM_BATIDAS" 
                                                            ? "bg-red-50 text-red-700 border-red-200" 
                                                            : "bg-amber-50 text-amber-700 border-amber-200"
                                                    }`}
                                                >
                                                    {r.kind === "SEM_BATIDAS" ? "Sem batidas" : `Falta ${r.missing.length}`}
                                                </Badge>
                                            )}
                                            {r.status === "ENVIADO" && r.adjustment && (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-mono text-[11px] font-bold text-indigo-700">#{r.adjustment.code}</span>
                                                    {adjBadge && <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${adjBadge.cls}`}>{adjBadge.label}</Badge>}
                                                </div>
                                            )}
                                            {r.status === "IGNORADO" && (
                                                <div className="flex flex-col gap-0.5">
                                                    <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">Ignorada</Badge>
                                                    {r.ignored?.reason && (
                                                        <span className="text-[10px] text-slate-400 max-w-[140px] truncate" title={r.ignored.reason}>
                                                            {r.ignored.reason}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* 8. Ações STICKY RIGHT (SEMPRE VISÍVEL!) */}
                                        <TableCell className={`w-44 sticky right-0 z-20 transition-colors text-right whitespace-nowrap pr-4 pl-2 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] ${stickyBg}`}>
                                            {r.status === "NOVO" && (
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* Botão de Lançar Batida Direta (Esquecimento) */}
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={isSending}
                                                        onClick={() => openDirectPunch(r)}
                                                        className="h-8 rounded-xl border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs px-2.5 shadow-2xs flex items-center gap-1 cursor-pointer transition-all hover:scale-105"
                                                        title="Lançar batida manual direto no Secullum (Esquecimento)"
                                                    >
                                                        <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                                                        <span>Lançar</span>
                                                    </Button>

                                                    <Button 
                                                        size="sm" 
                                                        disabled={isSending} 
                                                        onClick={() => setConfirmItems([r])}
                                                        className="h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3 shadow-xs flex items-center gap-1 cursor-pointer transition-all hover:scale-105"
                                                    >
                                                        {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-0.5 text-indigo-100" />}
                                                        {!isSending && "Enviar"}
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        disabled={isSending} 
                                                        onClick={() => { setIgnoreRow(r); setIgnoreReason(IGNORE_REASONS[0]); }}
                                                        className="h-8 w-8 p-0 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 cursor-pointer" 
                                                        title="Ignorar esta inconsistência"
                                                    >
                                                        <EyeOff className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            )}
                                            {r.status === "IGNORADO" && (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    onClick={() => doUnignore(r)} 
                                                    className="h-8 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reativar
                                                </Button>
                                            )}
                                            {r.status === "ENVIADO" && (
                                                <a href="/admin/punch-adjustments" className="text-xs font-bold text-sky-700 hover:underline inline-flex items-center gap-1">
                                                    Ver ajuste →
                                                </a>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Barra Flutuante de Ação em Lote quando há itens selecionados */}
            {selectedRows.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3.5 animate-in fade-in slide-in-from-bottom-5 duration-200">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                        <span className="text-xs font-semibold text-slate-300">
                            <strong className="text-white font-black text-sm">{selectedRows.length}</strong> {selectedRows.length === 1 ? "selecionado" : "selecionados"}
                        </span>
                    </div>
                    <div className="h-4 w-px bg-slate-700" />
                    <Button
                        id="btn-floating-send"
                        size="sm"
                        onClick={() => setConfirmItems(selectedRows)}
                        disabled={sendingKeys.size > 0}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs h-9 px-4 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
                    >
                        {sendingKeys.size > 0 ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Send className="w-3.5 h-3.5 text-indigo-200" />
                        )}
                        <span>Enviar ao Gestor Agora</span>
                    </Button>
                    <button
                        type="button"
                        onClick={() => setSelected(new Set())}
                        className="text-xs text-slate-400 hover:text-white underline font-semibold cursor-pointer ml-1"
                    >
                        Desmarcar
                    </button>
                </div>
            )}

            {/* Confirmar envio */}
            <Dialog open={!!confirmItems} onOpenChange={o => !o && setConfirmItems(null)}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-6 overflow-hidden rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-900 font-black">
                            <Send className="w-5 h-5 text-indigo-600" /> 
                            Confirmar Envio ao Gestor
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Será criado <b>um ajuste por colaborador/dia</b> e o gestor do contrato recebe no WhatsApp privado o menu para <b>Ajustar Ponto</b> ou <b>Confirmar Falta</b>.
                        </DialogDescription>
                    </DialogHeader>
                    {confirmItems && (
                        <div className="space-y-3 text-sm flex-1 overflow-y-auto py-2">
                            <div className="max-h-64 overflow-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/50">
                                {confirmItems.map(i => (
                                    <div key={i.key} className="px-3.5 py-2.5 flex justify-between items-center gap-2 text-xs">
                                        <div className="min-w-0">
                                            <span className="font-bold text-slate-800 block truncate">{i.employeeName}</span>
                                            <span className="text-[10px] text-slate-400">{i.clientName || "Sem contrato"}</span>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="text-slate-700 font-semibold block">{fmtDate(i.date)}</span>
                                            <span className="text-[10px] text-slate-400">{i.managerName || "sem gestor"}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {confirmItems.some(i => !i.managerHasPhone) && (
                                <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs font-medium">
                                    ⚠️ {confirmItems === selectedRows ? selectedWithoutManager : confirmItems.filter(i => !i.managerHasPhone).length} item(ns) sem gestor com telefone: irão como aviso em texto para o grupo "Ajuste de ponto".
                                </p>
                            )}
                        </div>
                    )}
                    <DialogFooter className="pt-2 border-t border-slate-100">
                        <Button variant="outline" onClick={() => setConfirmItems(null)} className="rounded-xl text-xs">Cancelar</Button>
                        <Button 
                            id="btn-confirm-send" 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl px-5" 
                            onClick={() => confirmItems && doDispatch(confirmItems)}
                        >
                            Confirmar e Enviar ({confirmItems?.length || 0})
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Ignorar */}
            <Dialog open={!!ignoreRow} onOpenChange={o => !o && setIgnoreRow(null)}>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-900 font-black">
                            <EyeOff className="w-5 h-5 text-slate-600" /> 
                            Ignorar inconsistência
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            {ignoreRow && <>{ignoreRow.employeeName} — {fmtDate(ignoreRow.date)}. Ela deixará de aparecer em "Para analisar".</>}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label className="text-xs font-bold text-slate-700">Motivo</Label>
                        <Select value={ignoreReason} onValueChange={setIgnoreReason}>
                            <SelectTrigger id="ignore-reason" className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {IGNORE_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter className="pt-2 border-t border-slate-100">
                        <Button variant="outline" onClick={() => setIgnoreRow(null)} className="rounded-xl text-xs">Cancelar</Button>
                        <Button id="btn-confirm-ignore" onClick={doIgnore} className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl px-5">Ignorar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Lançar Batida Manual Direto no Secullum (Esquecimento) */}
            <Dialog open={!!directPunchRow} onOpenChange={o => !o && !isDirectPunching && setDirectPunchRow(null)}>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-900 font-black">
                            <PlusCircle className="w-5 h-5 text-emerald-600" />
                            Lançar Batida Direto no Secullum
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            {directPunchRow && (
                                <>
                                    <b>{directPunchRow.employeeName}</b> ({directPunchRow.clientName || "Posto"}) — {fmtDate(directPunchRow.date)}
                                    <span className="block mt-1 text-slate-600">
                                        Esta batida será incluída imediatamente no cartão de ponto com o motivo <b>Esquecimento</b>, sem incomodar o gestor no WhatsApp.
                                    </span>
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {directPunchRow && (
                        <div className="space-y-3.5 py-2">
                            <div>
                                <Label className="text-xs font-bold text-slate-700 mb-1 block">Marcação a Incluir</Label>
                                <Select value={directPunchCol} onValueChange={v => {
                                    setDirectPunchCol(v as PunchColumn);
                                    if (directPunchRow.expected[v as PunchColumn]) {
                                        setDirectPunchTime(directPunchRow.expected[v as PunchColumn]!);
                                    }
                                }}>
                                    <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {directPunchRow.missing.map(col => (
                                            <SelectItem key={col} value={col}>
                                                {COLUMN_LABEL[col] || col} (Previsto: {directPunchRow.expected[col] || "—"})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-xs font-bold text-slate-700 mb-1 block">Horário da Batida (HH:mm)</Label>
                                <Input
                                    value={directPunchTime}
                                    onChange={e => setDirectPunchTime(e.target.value)}
                                    placeholder="HH:mm"
                                    className="h-10 rounded-xl font-mono text-xs font-bold"
                                />
                                <span className="text-[11px] text-slate-400 mt-1 block">
                                    Horário sugerido: <b>{directPunchRow.expected[directPunchCol] || "—"}</b>
                                </span>
                            </div>

                            <div>
                                <Label className="text-xs font-bold text-slate-700 mb-1 block">Motivo</Label>
                                <Input
                                    value={directPunchReason}
                                    onChange={e => setDirectPunchReason(e.target.value)}
                                    className="h-10 rounded-xl text-xs"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-2 border-t border-slate-100">
                        <Button variant="outline" onClick={() => setDirectPunchRow(null)} disabled={isDirectPunching} className="rounded-xl text-xs">
                            Cancelar
                        </Button>
                        <Button
                            onClick={doDirectPunch}
                            disabled={isDirectPunching}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl px-5 gap-1.5 cursor-pointer shadow-sm"
                        >
                            {isDirectPunching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Gravar no Secullum Agora
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
