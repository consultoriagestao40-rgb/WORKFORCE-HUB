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
    FileCheck2,
    Filter,
    Loader2,
    RotateCcw,
    Search,
    Send,
    ShieldAlert,
    Sparkles,
    User,
    UserX,
    PlusCircle,
    Users,
    Repeat,
    X
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
    listLaunchJustifications,
    launchDirectJustification,
    resendPunchAdjustmentToManager,
    type InconsistencyRow,
    type EmployeeTimecard,
    type EmployeeDay
} from "@/actions/punch-inconsistencies";
import { approveAndSyncPunchAdjustment } from "@/actions/punch-adjustments";
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
    const [statusFilter, setStatusFilter] = useState<"NOVO" | "ENVIADO" | "IGNORADO" | "ALL">("ALL");
    const [trafficFilter, setTrafficFilter] = useState<"ALL" | "RED" | "YELLOW" | "GREEN">("ALL");
    const [employees, setEmployees] = useState<EmployeeTimecard[]>([]);
    const [openEmployeeId, setOpenEmployeeId] = useState<string | null>(null);
    const [resendingKeys, setResendingKeys] = useState<Set<string>>(new Set());
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

    // Justificar / abonar / feriado direto no cartão (RH)
    const [justDay, setJustDay] = useState<{ employeeId: string; employeeName: string; date: string; groups: number[] } | null>(null);
    const [justList, setJustList] = useState<Array<{ codigo: string; descricao: string; abonar: boolean }>>([]);
    const [justCode, setJustCode] = useState("");
    const [justObs, setJustObs] = useState("");
    const [isJustSaving, setIsJustSaving] = useState(false);

    const openJustify = async (card: EmployeeTimecard, day: EmployeeDay) => {
        const groups = [1, 2, 3].filter(g => day.expected[`Entrada${g}` as PunchColumn] || day.expected[`Saida${g}` as PunchColumn]);
        setJustDay({ employeeId: card.employeeId, employeeName: card.employeeName, date: day.date, groups });
        setJustObs("");
        setJustCode("");
        if (justList.length === 0) {
            const res = await listLaunchJustifications();
            if (res.success) setJustList(res.items);
            else toast.error(res.message || "Erro ao carregar justificativas.");
        }
    };

    const doJustify = async () => {
        const sel = justList.find(j => j.codigo === justCode);
        if (!justDay || !sel) return;
        setIsJustSaving(true);
        try {
            const res = await launchDirectJustification({
                employeeId: justDay.employeeId,
                date: justDay.date,
                codigo: sel.codigo,
                abonar: sel.abonar,
                observacao: justObs || undefined,
                expectedGroups: justDay.groups
            });
            if (res.success) {
                toast.success(res.message);
                setJustDay(null);
                await runScan();
            } else {
                toast.error(`Erro ao lançar no Secullum: ${res.message}`);
            }
        } catch (e: any) {
            toast.error(e.message || "Erro ao lançar justificativa.");
        } finally {
            setIsJustSaving(false);
        }
    };

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
                    pending: false,
                    pendingKind: null,
                    adjustment: {
                        id: "",
                        code: "DIRETO",
                        status: "APPROVED_SYNCED",
                        secullumStatus: "SUCESSO",
                        sendCount: 0,
                        lastSentAt: null,
                        requestedByName: "RH (lançamento direto)",
                        requestedAt: new Date().toISOString(),
                        reasonName: directPunchReason || "SEM REGISTRO DE PONTO (ESQUECIMENTO)",
                        requestedTime: `${COLUMN_LABEL[directPunchCol] || directPunchCol} ${directPunchTime}`
                    }
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
            setEmployees(res.employees || []);
            setUnmatched(res.unmatched);
            setHasScanned(true);
            toast.success(`${(res.employees || []).length} colaborador(es) lidos no Secullum, ${res.rows.filter(r => r.pending).length} pendência(s) de ponto.`);
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
                return {
                    ...r,
                    status: "ENVIADO",
                    pending: true,
                    pendingKind: "AGUARDANDO_GESTOR",
                    adjustment: {
                        id: out.adjustmentId || "",
                        code: out.code,
                        status: "PENDING_RESPONSE",
                        secullumStatus: null,
                        sendCount: out.ok ? 1 : 0,
                        lastSentAt: out.ok ? new Date().toISOString() : null,
                        requestedByName: null,
                        requestedAt: null,
                        reasonName: null,
                        requestedTime: null
                    }
                };
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
        setRows(prev => prev.map(r => (r.key === row.key ? { ...r, status: "IGNORADO", pending: false, pendingKind: null, ignored: { reason: ignoreReason, userName: null } } : r)));
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
        setRows(prev => prev.map(r => (r.key === row.key ? { ...r, status: "NOVO", pending: true, pendingKind: "NOVO", ignored: null } : r)));
        toast.success("Inconsistência reativada.");
    };

    const selectedRows = rows.filter(r => selected.has(r.key));
    const selectedWithoutManager = selectedRows.filter(r => !r.managerHasPhone).length;

    const [approvingKeys, setApprovingKeys] = useState<Set<string>>(new Set());
    const doApprove = async (r: InconsistencyRow) => {
        if (!r.adjustment?.id) return toast.error("Ajuste sem identificador. Atualize a busca e tente novamente.");
        setApprovingKeys(prev => new Set(prev).add(r.key));
        try {
            const res = await approveAndSyncPunchAdjustment(r.adjustment.id);
            if (!res.success) return toast.error(res.message || "Erro ao lançar no Secullum.");
            toast.success(res.message || "Lançado no Secullum com sucesso!");
            setRows(prev => prev.map(x => (x.key === r.key && x.adjustment ? {
                ...x,
                pending: false,
                pendingKind: null,
                adjustment: { ...x.adjustment, status: "APPROVED_SYNCED", secullumStatus: "SUCESSO" }
            } : x)));
        } catch (e: any) {
            toast.error(e.message || "Erro ao aprovar.");
        } finally {
            setApprovingKeys(prev => {
                const next = new Set(prev);
                next.delete(r.key);
                return next;
            });
        }
    };

    const fmtDateTime = (iso: string | null | undefined) =>
        iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", " às") : null;

    const doResend = async (r: InconsistencyRow) => {
        if (!r.adjustment?.id) return toast.error("Ajuste sem identificador. Atualize a busca e tente novamente.");
        setResendingKeys(prev => new Set(prev).add(r.key));
        try {
            const res = await resendPunchAdjustmentToManager(r.adjustment.id);
            if (!res.success) return toast.error(res.message);
            toast.success(res.message);
            setRows(prev => prev.map(x => (x.key === r.key && x.adjustment ? {
                ...x,
                adjustment: {
                    ...x.adjustment,
                    sendCount: res.sendCount ?? x.adjustment.sendCount + 1,
                    lastSentAt: res.lastSentAt ?? new Date().toISOString()
                }
            } : x)));
        } catch (e: any) {
            toast.error(e.message || "Erro ao reenviar.");
        } finally {
            setResendingKeys(prev => {
                const next = new Set(prev);
                next.delete(r.key);
                return next;
            });
        }
    };

    // ---- Visão por colaborador (semáforo) ----
    const rowsByEmployee = useMemo(() => {
        const map = new Map<string, InconsistencyRow[]>();
        rows.forEach(r => {
            const list = map.get(r.employeeId) || [];
            list.push(r);
            map.set(r.employeeId, list);
        });
        return map;
    }, [rows]);

    const rowByKey = useMemo(() => new Map(rows.map(r => [r.key, r])), [rows]);

    type Level = "RED" | "YELLOW" | "GREEN" | "GRAY";
    const employeeViews = useMemo(() => {
        const q = search.trim().toLowerCase();
        const order: Record<Level, number> = { RED: 0, YELLOW: 1, GREEN: 2, GRAY: 3 };
        const views = employees
            .filter(c => {
                if (managerFilter === "NONE" && c.managerId) return false;
                if (managerFilter !== "ALL" && managerFilter !== "NONE" && c.managerId !== managerFilter) return false;
                if (clientFilter !== "ALL" && c.clientId !== clientFilter) return false;
                if (q && !c.employeeName.toLowerCase().includes(q) && !(c.clientName || "").toLowerCase().includes(q) && !(c.folha || "").includes(q)) return false;
                return true;
            })
            .map(card => {
                const empRows = rowsByEmployee.get(card.employeeId) || [];
                const pendingRows = empRows.filter(r => r.pending);
                const level: Level = card.semPonto ? "GRAY" : pendingRows.length === 0 ? "GREEN" : pendingRows.length === 1 ? "YELLOW" : "RED";
                return { card, empRows, pendingRows, level };
            });
        return { all: views, order, q };
    }, [employees, rowsByEmployee, managerFilter, clientFilter, search]);

    const trafficCounts = useMemo(() => ({
        RED: employeeViews.all.filter(v => v.level === "RED").length,
        YELLOW: employeeViews.all.filter(v => v.level === "YELLOW").length,
        GREEN: employeeViews.all.filter(v => v.level === "GREEN").length,
        GRAY: employeeViews.all.filter(v => v.level === "GRAY").length
    }), [employeeViews]);

    const visibleEmployees = useMemo(() => {
        const { all, order } = employeeViews;
        return all
            .filter(v => {
                if (trafficFilter !== "ALL" && v.level !== trafficFilter) return false;
                // Cards superiores: restringem aos colaboradores que têm dias naquele grupo
                if (statusFilter !== "ALL" || kindFilter !== "ALL") {
                    return v.empRows.some(r => (statusFilter === "ALL" || r.status === statusFilter) && (kindFilter === "ALL" || r.kind === kindFilter));
                }
                return true;
            })
            .sort((a, b) => {
                if (order[a.level] !== order[b.level]) return order[a.level] - order[b.level];
                if (b.pendingRows.length !== a.pendingRows.length) return b.pendingRows.length - a.pendingRows.length;
                return a.card.employeeName.localeCompare(b.card.employeeName);
            });
    }, [employeeViews, trafficFilter, statusFilter, kindFilter]);

    const openView = openEmployeeId ? employeeViews.all.find(v => v.card.employeeId === openEmployeeId) || null : null;

    const LEVEL_STYLE: Record<"RED" | "YELLOW" | "GREEN" | "GRAY", { dot: string; badge: string; label: (n: number) => string }> = {
        RED: { dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700 border-rose-200", label: n => `${n} pendências` },
        YELLOW: { dot: "bg-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200", label: () => "1 pendência" },
        GREEN: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: () => "Em dia" },
        GRAY: { dot: "bg-slate-300", badge: "bg-slate-100 text-slate-600 border-slate-200", label: () => "Sem cartão no Secullum" }
    };

    const nth = (n: number) => `${n}º`;

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
                            Ponto dos Colaboradores
                        </h1>
                        <p className="text-sm text-slate-500 font-medium mt-1">
                            Todos os colaboradores ativos no ponto x WFH com semáforo de pendências. Clique no colaborador para ver o cartão de ponto.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <CalendarX2 className="w-5 h-5 text-rose-500" />
                            Ponto dos Colaboradores x Secullum
                        </h2>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Todos os colaboradores ativos com semáforo de pendências de ponto. Clique em um colaborador para tratar os dias.
                        </p>
                    </div>
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
                        Buscar
                    </Button>
                </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard title="Para analisar" value={stats.novos} hint="Ainda não enviadas" icon={AlertTriangle}
                    tone={{ text: "text-rose-700", bg: "bg-rose-100 text-rose-700", ring: "ring-rose-100", border: "border-rose-300" }}
                    active={statusFilter === "NOVO" && kindFilter === "ALL"} onClick={() => { const on = statusFilter === "NOVO" && kindFilter === "ALL"; setStatusFilter(on ? "ALL" : "NOVO"); setKindFilter("ALL"); }} />
                <StatCard title="Sem nenhuma batida" value={stats.semBatidas} hint="Dia de trabalho vazio" icon={CalendarX2}
                    tone={{ text: "text-red-700", bg: "bg-red-100 text-red-700", ring: "ring-red-100", border: "border-red-300" }}
                    active={statusFilter === "NOVO" && kindFilter === "SEM_BATIDAS"} onClick={() => { const on = statusFilter === "NOVO" && kindFilter === "SEM_BATIDAS"; setStatusFilter(on ? "ALL" : "NOVO"); setKindFilter(on ? "ALL" : "SEM_BATIDAS"); }} />
                <StatCard title="Batidas faltando" value={stats.incompletas} hint="Dia incompleto" icon={Clock}
                    tone={{ text: "text-amber-700", bg: "bg-amber-100 text-amber-700", ring: "ring-amber-100", border: "border-amber-300" }}
                    active={statusFilter === "NOVO" && kindFilter === "INCOMPLETA"} onClick={() => { const on = statusFilter === "NOVO" && kindFilter === "INCOMPLETA"; setStatusFilter(on ? "ALL" : "NOVO"); setKindFilter(on ? "ALL" : "INCOMPLETA"); }} />
                <StatCard title="Enviadas ao gestor" value={stats.enviados} hint="Com ajuste em andamento" icon={CheckCircle2}
                    tone={{ text: "text-emerald-700", bg: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-100", border: "border-emerald-300" }}
                    active={statusFilter === "ENVIADO"} onClick={() => { setStatusFilter(statusFilter === "ENVIADO" ? "ALL" : "ENVIADO"); setKindFilter("ALL"); }} />
                <StatCard title="Ignoradas" value={stats.ignorados} hint="Marcadas para não tratar" icon={EyeOff}
                    tone={{ text: "text-slate-600", bg: "bg-slate-100 text-slate-600", ring: "ring-slate-100", border: "border-slate-300" }}
                    active={statusFilter === "IGNORADO"} onClick={() => { setStatusFilter(statusFilter === "IGNORADO" ? "ALL" : "IGNORADO"); setKindFilter("ALL"); }} />
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

            {/* Semáforo: resumo por colaborador */}
            <div className="flex flex-wrap items-center gap-2">
                {([
                    { id: "ALL", label: "Todos", count: employeeViews.all.length, cls: "bg-slate-100 text-slate-700 border-slate-300", dot: "bg-slate-400" },
                    { id: "RED", label: "Vermelho (2+ pendências)", count: trafficCounts.RED, cls: "bg-rose-50 text-rose-700 border-rose-300", dot: "bg-rose-500" },
                    { id: "YELLOW", label: "Amarelo (1 pendência)", count: trafficCounts.YELLOW, cls: "bg-amber-50 text-amber-700 border-amber-300", dot: "bg-amber-400" },
                    { id: "GREEN", label: "Verde (em dia)", count: trafficCounts.GREEN, cls: "bg-emerald-50 text-emerald-700 border-emerald-300", dot: "bg-emerald-500" }
                ] as const).map(t => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTrafficFilter(t.id)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer ${t.cls} ${trafficFilter === t.id ? "ring-2 ring-offset-1 ring-slate-300 shadow-sm" : "opacity-80 hover:opacity-100"}`}
                    >
                        <span className={`w-2.5 h-2.5 rounded-full ${t.dot}`} />
                        {t.label}
                        <span className="font-black">{t.count}</span>
                    </button>
                ))}
                {trafficCounts.GRAY > 0 && (
                    <span className="text-[11px] text-slate-400 font-medium ml-1">+ {trafficCounts.GRAY} ativo(s) no WFH sem cartão no Secullum</span>
                )}
            </div>

            {/* Lista de colaboradores (pendências no topo) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden relative">
                <div className="w-full overflow-x-auto relative">
                    <Table className="w-full border-collapse border-spacing-0 min-w-[900px]">
                        <TableHeader>
                            <TableRow className="bg-slate-50/90 border-b border-slate-200/80">
                                <TableHead className="w-44 font-bold text-slate-700 text-xs uppercase tracking-wider px-4">Status do ponto</TableHead>
                                <TableHead className="min-w-[210px] font-bold text-slate-700 text-xs uppercase tracking-wider px-3">Colaborador</TableHead>
                                <TableHead className="min-w-[180px] font-bold text-slate-700 text-xs uppercase tracking-wider px-3">Contrato / Posto</TableHead>
                                <TableHead className="min-w-[150px] font-bold text-slate-700 text-xs uppercase tracking-wider px-3">Gestor</TableHead>
                                <TableHead className="min-w-[260px] font-bold text-slate-700 text-xs uppercase tracking-wider px-3">Dias pendentes</TableHead>
                                <TableHead className="w-28 text-right font-bold text-slate-700 text-xs uppercase tracking-wider pr-4">Cartão</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-16 text-slate-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-600" />
                                        Lendo cartões de ponto no Secullum...
                                    </TableCell>
                                </TableRow>
                            )}
                            {!loading && visibleEmployees.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-16 text-slate-500">
                                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                                        {hasScanned ? "Nenhum colaborador com esses filtros." : "Clique em Buscar para ler os cartões."}
                                    </TableCell>
                                </TableRow>
                            )}
                            {!loading && visibleEmployees.map(v => {
                                const st = LEVEL_STYLE[v.level];
                                const sortedPending = [...v.pendingRows].sort((a, b) => (a.date < b.date ? 1 : -1));
                                return (
                                    <TableRow
                                        key={v.card.employeeId}
                                        onClick={() => setOpenEmployeeId(v.card.employeeId)}
                                        className="group cursor-pointer border-b border-slate-100 hover:bg-slate-50/70 transition-colors"
                                    >
                                        <TableCell className="px-4">
                                            <div className="flex items-center gap-2.5">
                                                <span className={`w-3.5 h-3.5 rounded-full shrink-0 shadow-sm ${st.dot}`} />
                                                <Badge variant="outline" className={`text-[10px] font-black py-0.5 px-2 whitespace-nowrap ${st.badge}`}>
                                                    {st.label(v.pendingRows.length)}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-3">
                                            <div className="font-extrabold text-slate-900 text-xs leading-tight truncate max-w-[240px]" title={v.card.employeeName}>
                                                {v.card.employeeName}
                                            </div>
                                            {v.card.folha && <div className="text-[10px] text-slate-400 font-mono font-medium mt-0.5">Folha {v.card.folha}</div>}
                                        </TableCell>
                                        <TableCell className="px-3">
                                            <div className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[210px]" title={v.card.clientName || "Sem alocação"}>
                                                {v.card.clientName || <span className="text-slate-400 font-normal">Sem alocação</span>}
                                            </div>
                                            {v.card.postoName && <div className="text-[11px] text-slate-500 font-medium truncate max-w-[210px] mt-0.5">{v.card.postoName}</div>}
                                        </TableCell>
                                        <TableCell className="px-3">
                                            {v.card.managerName ? (
                                                <div className="text-xs text-slate-700 font-semibold truncate max-w-[180px]" title={v.card.managerName}>
                                                    {v.card.managerName}
                                                    {!v.card.managerHasPhone && <span className="block text-[10px] text-amber-600 font-bold">⚠️ sem WhatsApp</span>}
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">Sem gestor</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-3">
                                            {sortedPending.length === 0 ? (
                                                <span className="text-[11px] text-slate-400 font-medium">—</span>
                                            ) : (
                                                <div className="flex flex-wrap gap-1">
                                                    {sortedPending.slice(0, 5).map(r => {
                                                        const cls = r.pendingKind === "AGUARDANDO_GESTOR" ? "bg-amber-50 text-amber-800 border-amber-200"
                                                            : r.pendingKind === "AGUARDANDO_RH" ? "bg-sky-50 text-sky-800 border-sky-200"
                                                                : "bg-rose-50 text-rose-700 border-rose-200";
                                                        const sends = r.adjustment?.sendCount || 0;
                                                        return (
                                                            <span key={r.key} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${cls}`}>
                                                                {fmtDate(r.date).slice(0, 5)}
                                                                {r.pendingKind === "AGUARDANDO_GESTOR" && sends > 0 && <span className="opacity-70">· {nth(sends)} envio</span>}
                                                                {r.pendingKind === "AGUARDANDO_RH" && <span className="opacity-70">· RH</span>}
                                                            </span>
                                                        );
                                                    })}
                                                    {sortedPending.length > 5 && <span className="text-[10px] text-slate-400 font-bold self-center">+{sortedPending.length - 5}</span>}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-4">
                                            <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs font-bold border-slate-200 text-slate-700 group-hover:border-sky-300 group-hover:text-sky-700 cursor-pointer">
                                                Ver cartão
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Modal: cartão de ponto do colaborador (visão semelhante ao Secullum) */}
            <Dialog open={!!openView} onOpenChange={o => !o && setOpenEmployeeId(null)}>
                <DialogContent className="sm:max-w-6xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl">
                    {openView && (() => {
                        const { card, pendingRows, level } = openView;
                        const st = LEVEL_STYLE[level];
                        const useCols3 = card.days.some(d => d.actual.Entrada3 || d.actual.Saida3 || d.expected.Entrada3 || d.expected.Saida3);
                        const cols = useCols3 ? COLS : COLS.slice(0, 4);
                        const unsent = pendingRows.filter(r => r.pendingKind === "NOVO");
                        return (
                            <>
                                <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-100 space-y-1">
                                    <DialogTitle className="flex items-center gap-2.5 text-slate-900 font-black text-lg">
                                        <span className={`w-3.5 h-3.5 rounded-full ${st.dot}`} />
                                        {card.employeeName}
                                        <Badge variant="outline" className={`text-[10px] font-black py-0.5 px-2 ${st.badge}`}>{st.label(pendingRows.length)}</Badge>
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-slate-500">
                                        {card.clientName || "Sem alocação"}{card.postoName ? ` · ${card.postoName}` : ""}
                                        {card.folha ? ` · Folha ${card.folha}` : ""}
                                        {" · Gestor: "}<b>{card.managerName || "não definido"}</b>
                                        {" · Período "}{fmtDate(startDate)} a {fmtDate(endDate)}
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="flex-1 overflow-auto px-6 py-3">
                                    {card.days.length === 0 ? (
                                        <div className="text-center py-12 text-slate-500 text-sm">
                                            <UserX className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                                            Nenhum cartão de ponto deste colaborador foi encontrado no Secullum no período.
                                        </div>
                                    ) : (
                                        <Table className="w-full border-collapse text-xs">
                                            <TableHeader>
                                                <TableRow className="bg-slate-50 border-b border-slate-200">
                                                    <TableHead className="w-28 font-bold text-slate-700 text-[11px] uppercase px-2">Data</TableHead>
                                                    {cols.map(c => (
                                                        <TableHead key={c} className="text-center font-bold text-slate-700 text-[11px] uppercase px-1 w-20">{COLUMN_LABEL[c]}</TableHead>
                                                    ))}
                                                    <TableHead className="min-w-[280px] font-bold text-slate-700 text-[11px] uppercase px-2">Situação</TableHead>
                                                    <TableHead className="min-w-[230px] text-right font-bold text-slate-700 text-[11px] uppercase px-2">Ações</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {[...card.days].sort((a, b) => (a.date < b.date ? -1 : 1)).map((day: EmployeeDay) => {
                                                    const r = day.rowKey ? rowByKey.get(day.rowKey) || null : null;
                                                    const isPending = !!r?.pending;
                                                    const isSending = r ? sendingKeys.has(r.key) : false;
                                                    const isResending = r ? resendingKeys.has(r.key) : false;
                                                    const sends = r?.adjustment?.sendCount || 0;
                                                    const adjBadge = r?.adjustment ? ADJ_STATUS_LABEL[r.adjustment.status] : null;
                                                    return (
                                                        <TableRow
                                                            key={day.date}
                                                            className={`border-b border-slate-100 ${isPending ? (r?.pendingKind === "NOVO" ? "bg-rose-50/40" : "bg-amber-50/40") : ""}`}
                                                        >
                                                            <TableCell className="px-2 py-2 whitespace-nowrap">
                                                                <div className={`font-black ${day.weekday === 0 ? "text-rose-600" : "text-slate-800"}`}>{fmtDate(day.date)}</div>
                                                                <div className="text-[10px] text-slate-400 font-semibold">{WEEKDAYS[day.weekday]}</div>
                                                            </TableCell>
                                                            {cols.map(c => {
                                                                const val = day.actual[c];
                                                                const missing = !!r && r.missing.includes(c);
                                                                const isText = val && !/^\d{1,2}:\d{2}$/.test(val);
                                                                const isFolgaDay = day.dayOff && Object.keys(day.actual).length === 0 && !day.leaveNote;
                                                                const folgaCell = isFolgaDay && cols.indexOf(c) < 4;
                                                                const textCls = (t: string) => /falta/i.test(t)
                                                                    ? "bg-rose-600 text-white"
                                                                    : /folga/i.test(t) ? "bg-emerald-600 text-white" : "bg-orange-500 text-white";
                                                                return (
                                                                    <TableCell key={c} className="px-1 py-2 text-center">
                                                                        {missing ? (
                                                                            <div className="inline-flex flex-col items-center px-1.5 py-0.5 rounded-md border border-dashed border-rose-300 bg-rose-50 text-rose-700 font-bold leading-tight">
                                                                                <span className="text-[10px]">falta</span>
                                                                                <span className="text-[9px] opacity-60 font-mono">{day.expected[c] || "—"}</span>
                                                                            </div>
                                                                        ) : val ? (
                                                                            <span className={`font-mono font-bold ${isText ? `px-1.5 py-0.5 rounded text-[10px] ${textCls(val)}` : "text-slate-800"}`}>{val}</span>
                                                                        ) : folgaCell ? (
                                                                            <span className="font-mono font-bold px-1.5 py-0.5 rounded text-[10px] bg-emerald-600 text-white">FOLGA</span>
                                                                        ) : (
                                                                            <span className="text-slate-300">{day.dayOff ? "" : "·"}</span>
                                                                        )}
                                                                    </TableCell>
                                                                );
                                                            })}
                                                            <TableCell className="px-2 py-2">
                                                                {day.leaveNote ? (
                                                                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300 text-[10px] font-bold">{day.leaveNote}</Badge>
                                                                ) : !r ? (
                                                                    day.dayOff && Object.keys(day.actual).length === 0
                                                                        ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-bold">Folga</Badge>
                                                                        : <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> OK</span>
                                                                ) : r.status === "IGNORADO" ? (
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] w-fit">Ignorada</Badge>
                                                                        {r.ignored?.reason && <span className="text-[10px] text-slate-400 max-w-[160px] truncate" title={r.ignored.reason}>{r.ignored.reason}</span>}
                                                                    </div>
                                                                ) : r.pendingKind === "NOVO" ? (
                                                                    <div className="flex flex-col gap-0.5 text-[11px] leading-snug">
                                                                        <Badge variant="outline" className={`text-[10px] font-black w-fit ${r.kind === "SEM_BATIDAS" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                                                                            {r.kind === "SEM_BATIDAS" ? "Sem batidas" : `Falta ${r.missing.length}`} · não enviada
                                                                        </Badge>
                                                                        <div className="text-slate-600"><span className="text-slate-400 font-semibold">Solicitante: </span><span className="font-semibold">—</span></div>
                                                                        <div className="text-slate-600"><span className="text-slate-400 font-semibold">Motivo: </span><span className="font-semibold">—</span></div>
                                                                        <div className="text-slate-600"><span className="text-slate-400 font-semibold">Solicitado em: </span><span className="font-semibold">—</span></div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col gap-0.5 text-[11px] leading-snug">
                                                                        <div className="flex flex-wrap items-center gap-1">
                                                                            <span className="font-mono font-bold text-indigo-700">#{r.adjustment?.code}</span>
                                                                            {adjBadge && <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${adjBadge.cls}`}>{adjBadge.label}</Badge>}
                                                                            {r.pendingKind === "AGUARDANDO_GESTOR" && sends > 0 && (
                                                                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-indigo-50 text-indigo-700 border-indigo-200">{nth(sends)} envio</Badge>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-slate-600">
                                                                            <span className="text-slate-400 font-semibold">Solicitante: </span>
                                                                            <span className="font-semibold">{r.adjustment?.requestedByName || (r.pendingKind === "AGUARDANDO_GESTOR" ? `aguardando ${r.managerName || "gestor"}` : "—")}</span>
                                                                        </div>
                                                                        <div className="text-slate-600">
                                                                            <span className="text-slate-400 font-semibold">Motivo: </span>
                                                                            <span className="font-semibold">{r.adjustment?.reasonName || (r.pendingKind === "AGUARDANDO_GESTOR" ? "ainda não informado" : "—")}</span>
                                                                            {r.adjustment?.requestedTime && r.adjustment.reasonName !== "FALTA CONFIRMADA PELO GESTOR" && (
                                                                                <span className="text-slate-400"> · {r.adjustment.requestedTime}</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-slate-600">
                                                                            <span className="text-slate-400 font-semibold">{r.adjustment?.requestedAt ? "Solicitado em: " : "Enviado ao gestor em: "}</span>
                                                                            <span className="font-semibold">{fmtDateTime(r.adjustment?.requestedAt || r.adjustment?.lastSentAt) || "—"}</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="px-2 py-2 text-right whitespace-nowrap">
                                                                {!(day.dayOff && Object.keys(day.actual).length === 0) && !day.leaveNote && (
                                                                    <Button size="sm" variant="outline" onClick={() => openJustify(card, day)}
                                                                        className="h-8 mr-1.5 rounded-xl border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-800 font-extrabold text-xs px-2.5 gap-1 cursor-pointer"
                                                                        title="Lançar abono, feriado ou outra justificativa no cartão do Secullum">
                                                                        <FileCheck2 className="w-3.5 h-3.5" /> Abonar / Feriado
                                                                    </Button>
                                                                )}
                                                                {r && r.pendingKind === "NOVO" && (
                                                                    <div className="flex items-center justify-end gap-1.5">
                                                                        <Button size="sm" variant="outline" disabled={isSending} onClick={() => openDirectPunch(r)}
                                                                            className="h-8 rounded-xl border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs px-2.5 gap-1 cursor-pointer"
                                                                            title="Lançar batida manual direto no Secullum (Esquecimento)">
                                                                            <PlusCircle className="w-3.5 h-3.5 text-emerald-600" /> Lançar
                                                                        </Button>
                                                                        <Button size="sm" disabled={isSending} onClick={() => setConfirmItems([r])}
                                                                            className="h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3 gap-1 cursor-pointer">
                                                                            {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-indigo-100" />} Enviar ao líder
                                                                        </Button>
                                                                        <Button size="sm" variant="ghost" disabled={isSending} onClick={() => { setIgnoreRow(r); setIgnoreReason(IGNORE_REASONS[0]); }}
                                                                            className="h-8 w-8 p-0 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                                                                            title="Ignorar esta inconsistência">
                                                                            <EyeOff className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                                {r && r.pendingKind === "AGUARDANDO_GESTOR" && (
                                                                    <div className="flex items-center justify-end gap-1.5">
                                                                        <Button size="sm" variant="outline" onClick={() => openDirectPunch(r)}
                                                                            className="h-8 rounded-xl border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs px-2.5 gap-1 cursor-pointer"
                                                                            title="Lançar batida manual direto no Secullum">
                                                                            <PlusCircle className="w-3.5 h-3.5 text-emerald-600" /> Lançar
                                                                        </Button>
                                                                        <Button size="sm" disabled={isResending} onClick={() => doResend(r)}
                                                                            className="h-8 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs px-3 gap-1 cursor-pointer"
                                                                            title="Reenviar ao gestor (fica registrado o nº do envio)">
                                                                            {isResending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Repeat className="w-3.5 h-3.5" />} Reenviar ({nth(sends + 1)})
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                                {r && r.pendingKind === "AGUARDANDO_RH" && (
                                                                    <Button size="sm" disabled={approvingKeys.has(r.key)} onClick={() => doApprove(r)}
                                                                        className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3 gap-1 cursor-pointer"
                                                                        title="Lançar no cartão do Secullum">
                                                                        {approvingKeys.has(r.key) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                                                        {r.adjustment?.reasonName === "FALTA CONFIRMADA PELO GESTOR" ? "Lançar falta no Secullum" : "Aprovar no Secullum"}
                                                                    </Button>
                                                                )}
                                                                {r && r.status === "IGNORADO" && (
                                                                    <Button size="sm" variant="outline" onClick={() => doUnignore(r)} className="h-8 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 cursor-pointer">
                                                                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reativar
                                                                    </Button>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>

                                <DialogFooter className="px-6 py-3 border-t border-slate-100 sm:justify-between gap-2">
                                    <span className="text-[11px] text-slate-500 self-center">
                                        {pendingRows.length === 0 ? "Sem pendências de ponto no período." : `${pendingRows.length} dia(s) pendente(s) · ${unsent.length} ainda não enviado(s) ao líder.`}
                                    </span>
                                    <div className="flex gap-2">
                                        {unsent.length > 0 && (
                                            <Button size="sm" onClick={() => setConfirmItems(unsent)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl gap-1.5 cursor-pointer">
                                                <Send className="w-3.5 h-3.5" /> Enviar todas ao líder ({unsent.length})
                                            </Button>
                                        )}
                                        <Button size="sm" variant="outline" onClick={() => setOpenEmployeeId(null)} className="rounded-xl text-xs cursor-pointer">
                                            <X className="w-3.5 h-3.5 mr-1" /> Fechar
                                        </Button>
                                    </div>
                                </DialogFooter>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

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

            {/* Modal Justificar / Abonar / Feriado direto no Secullum */}
            <Dialog open={!!justDay} onOpenChange={o => !o && !isJustSaving && setJustDay(null)}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-900 font-black">
                            <FileCheck2 className="w-5 h-5 text-orange-600" /> Abonar / Feriado / Justificar
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            {justDay && <><b>{justDay.employeeName}</b> — {fmtDate(justDay.date)}. Lançado direto no cartão do Secullum nas jornadas sem batida.</>}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3.5 py-2">
                        <div>
                            <Label className="text-xs font-bold text-slate-700 mb-1 block">Justificativa</Label>
                            <Select value={justCode} onValueChange={setJustCode}>
                                <SelectTrigger className="w-full rounded-xl"><SelectValue placeholder={justList.length ? "Selecione..." : "Carregando..."} /></SelectTrigger>
                                <SelectContent>
                                    {justList.map(j => (
                                        <SelectItem key={j.codigo} value={j.codigo}>{j.descricao} ({j.codigo}){j.abonar ? " · abona" : ""}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs font-bold text-slate-700 mb-1 block">Observação</Label>
                            <Input value={justObs} onChange={e => setJustObs(e.target.value)} placeholder="Ex: feriado, abono autorizado pelo gestor" className="h-10 rounded-xl text-xs" />
                        </div>
                    </div>
                    <DialogFooter className="pt-2 border-t border-slate-100">
                        <Button variant="outline" onClick={() => setJustDay(null)} disabled={isJustSaving} className="rounded-xl text-xs">Cancelar</Button>
                        <Button onClick={doJustify} disabled={isJustSaving || !justCode}
                            className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-xl px-5 gap-1.5 cursor-pointer">
                            {isJustSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Gravar no Secullum
                        </Button>
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
