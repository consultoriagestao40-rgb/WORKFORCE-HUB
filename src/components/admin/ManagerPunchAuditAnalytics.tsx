"use client";

import React, { useState, useEffect } from "react";
import {
    BarChart3,
    TrendingUp,
    Award,
    AlertOctagon,
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    User,
    Building2,
    Calendar,
    ShieldAlert,
    FileSpreadsheet,
    Zap,
    ThumbsDown,
    ArrowUpRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getManagerAuditMetrics } from "@/actions/punch-adjustments";
import { toast } from "sonner";

export default function ManagerPunchAuditAnalytics() {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<any>(null);
    const [activeSubTab, setActiveSubTab] = useState<"RANKING_ABONOS" | "RANKING_ERROS" | "MOTIVOS" | "HISTORICO_ERROS" | "REENVIOS">("RANKING_ABONOS");

    const loadMetrics = async () => {
        setLoading(true);
        try {
            const res = await getManagerAuditMetrics();
            if (res.success) {
                setMetrics(res);
            } else {
                toast.error(res.message || "Erro ao carregar indicadores de gestores.");
            }
        } catch {
            toast.error("Falha de conexão ao carregar indicadores.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMetrics();
    }, []);

    const formatData = (d: any) => {
        if (!d) return "-";
        try {
            const parsed = typeof d === "string" ? parseISO(d) : new Date(d);
            return format(parsed, "dd/MM/yyyy", { locale: ptBR });
        } catch {
            return String(d).split("T")[0];
        }
    };

    if (loading && !metrics) {
        return (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-sky-600" />
                <p className="text-sm font-semibold text-slate-600">Calculando indicadores de gestores e auditoria de ajustes...</p>
            </div>
        );
    }

    const {
        totalAdjustments = 0,
        totalAbonos = 0,
        totalErros = 0,
        rankingAbonos = [],
        rankingErros = [],
        rankingGeralGestores = [],
        rankingMotivos = [],
        evolutivoMensal = [],
        todosErrosDetalhados = [],
        rankingReenvios = [],
        reenviosDetalhados = []
    } = metrics || {};

    const maxAbonos = rankingAbonos.length > 0 ? rankingAbonos[0].abonos : 1;
    const maxErros = rankingErros.length > 0 ? rankingErros[0].erros : 1;
    const maxTotal = rankingGeralGestores.length > 0 ? rankingGeralGestores[0].total : 1;

    return (
        <div className="space-y-6">
            {/* Header com Ação de Atualização */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl text-white shadow-md">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                            Auditoria & Governança
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/30 text-rose-300 border border-rose-400/30">
                            Prevenção de Passivo Trabalhista
                        </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-indigo-400" />
                        Indicadores & Auditoria de Gestores
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">
                        Ranking de abonos concedidos, divergências de apontamento e evolução mensal de inconsistências.
                    </p>
                </div>
                <Button
                    onClick={loadMetrics}
                    disabled={loading}
                    variant="outline"
                    className="h-9 px-3 bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold text-xs gap-1.5 cursor-pointer rounded-xl self-start sm:self-auto"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    Atualizar Dados
                </Button>
            </div>

            {/* Cards KPI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total de Ajustes */}
                <Card className="border-slate-200 shadow-sm bg-white">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Total de Ajustes
                            </span>
                            <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
                                <FileSpreadsheet className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-3xl font-black text-slate-900">{totalAdjustments}</div>
                            <p className="text-xs text-slate-500 font-medium mt-1">Ocorrências tratadas no Hub</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Ranking de Abonos */}
                <Card className="border-amber-200 shadow-sm bg-gradient-to-br from-amber-50/40 to-white">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                                Total de Abonos
                            </span>
                            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                                <Clock className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-3xl font-black text-amber-900">{totalAbonos}</div>
                            <p className="text-xs text-amber-700 font-medium mt-1">
                                {totalAdjustments > 0 ? `${((totalAbonos / totalAdjustments) * 100).toFixed(1)}% dos ajustes são abonos` : "Horas não trabalhadas abonadas"}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Ajustes Errados / Divergências de Gestores */}
                <Card className="border-rose-200 shadow-sm bg-gradient-to-br from-rose-50/40 to-white">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                                Erros do Gestor Detectados
                            </span>
                            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
                                <AlertOctagon className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-3xl font-black text-rose-900">{totalErros}</div>
                            <p className="text-xs text-rose-700 font-medium mt-1">Faltas indevidas ou divergências evitadas</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Gestores Auditados */}
                <Card className="border-indigo-200 shadow-sm bg-gradient-to-br from-indigo-50/40 to-white">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">
                                Gestores no Radar
                            </span>
                            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                                <Award className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-3xl font-black text-indigo-900">{rankingGeralGestores.length}</div>
                            <p className="text-xs text-indigo-700 font-medium mt-1">Líderes interagindo no WhatsApp</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Sub-Abas de Navegação */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/80 w-fit">
                    <button
                        onClick={() => setActiveSubTab("RANKING_ABONOS")}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeSubTab === "RANKING_ABONOS"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        <span>Ranking de Abonos por Gestor</span>
                        <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                            {rankingAbonos.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveSubTab("RANKING_ERROS")}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeSubTab === "RANKING_ERROS"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
                        <span>Ranking de Erros por Gestor</span>
                        <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                            {rankingErros.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveSubTab("HISTORICO_ERROS")}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeSubTab === "HISTORICO_ERROS"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                        <span>Ocorrências com Erro do Gestor</span>
                        <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                            {todosErrosDetalhados.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveSubTab("REENVIOS")}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeSubTab === "REENVIOS"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-orange-500" />
                        <span>Reenvios sem Resposta</span>
                        <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-orange-100 text-orange-800">
                            {reenviosDetalhados.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveSubTab("MOTIVOS")}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeSubTab === "MOTIVOS"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Ranking de Motivos & Mensal</span>
                    </button>
                </div>

                {/* Conteúdo da Aba 1: Ranking de Abonos por Gestor */}
                {activeSubTab === "RANKING_ABONOS" && (
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-amber-600" />
                                    Gestores que Mais Concedem Abonos (Horas Não Trabalhadas)
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Indicador para controle de custos e absenteísmo por liderança de equipe.
                                </p>
                            </div>
                        </div>

                        {rankingAbonos.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 text-sm">
                                Nenhum abono registrado até o momento.
                            </div>
                        ) : (
                            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead className="w-16 text-center font-bold text-slate-700 text-xs">Posição</TableHead>
                                            <TableHead className="font-bold text-slate-700 text-xs">Gestor / Supervisor</TableHead>
                                            <TableHead className="w-64 font-bold text-slate-700 text-xs">Volume de Abonos</TableHead>
                                            <TableHead className="text-center font-bold text-slate-700 text-xs w-32">Total de Abonos</TableHead>
                                            <TableHead className="text-center font-bold text-slate-700 text-xs w-32">Total Ajustes</TableHead>
                                            <TableHead className="text-center font-bold text-slate-700 text-xs w-28">Taxa Abono</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rankingAbonos.map((g: any, idx: number) => {
                                            const pct = ((g.abonos / maxAbonos) * 100).toFixed(0);
                                            const taxaAbono = g.total > 0 ? ((g.abonos / g.total) * 100).toFixed(1) : "0";
                                            return (
                                                <TableRow key={g.name} className="hover:bg-slate-50/70 border-b border-slate-100">
                                                    <TableCell className="text-center font-black text-slate-700 text-xs">
                                                        {idx === 0 ? (
                                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-black">1º</span>
                                                        ) : idx === 1 ? (
                                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-800 text-xs font-black">2º</span>
                                                        ) : idx === 2 ? (
                                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-800 text-xs font-black">3º</span>
                                                        ) : (
                                                            `${idx + 1}º`
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-bold text-slate-900 text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <User className="w-4 h-4 text-indigo-500" />
                                                            {g.name}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                                            <div
                                                                className="bg-gradient-to-r from-amber-400 to-amber-600 h-full rounded-full transition-all duration-500"
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono font-black text-amber-700 text-sm">
                                                        {g.abonos}
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-slate-600 text-xs">
                                                        {g.total}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="outline" className={`font-bold text-xs ${Number(taxaAbono) > 50 ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                                                            {taxaAbono}%
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                )}

                {/* Conteúdo da Aba 2: Ranking de Erros por Gestor */}
                {activeSubTab === "RANKING_ERROS" && (
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                    <AlertOctagon className="w-4 h-4 text-rose-600" />
                                    Ranking de Gestores com Apontamentos Errados / Divergências
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Casos onde o gestor confirmou falta, mas o colaborador trabalhou e possuía batidas no Secullum.
                                </p>
                            </div>
                        </div>

                        {rankingErros.length === 0 ? (
                            <div className="text-center py-10 text-emerald-600 font-semibold text-sm bg-emerald-50/50 rounded-xl border border-emerald-100">
                                🎉 Parabéns! Nenhum erro de apontamento ou falta indevida detectada nos gestores.
                            </div>
                        ) : (
                            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead className="w-16 text-center font-bold text-slate-700 text-xs">Posição</TableHead>
                                            <TableHead className="font-bold text-slate-700 text-xs">Gestor Responsável</TableHead>
                                            <TableHead className="w-64 font-bold text-slate-700 text-xs">Proporção de Erros</TableHead>
                                            <TableHead className="text-center font-bold text-slate-700 text-xs w-32">Faltas Indevidas</TableHead>
                                            <TableHead className="text-center font-bold text-slate-700 text-xs w-32">Total de Apontamentos</TableHead>
                                            <TableHead className="text-center font-bold text-slate-700 text-xs w-28">Taxa de Erro</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rankingErros.map((g: any, idx: number) => {
                                            const pct = ((g.erros / maxErros) * 100).toFixed(0);
                                            const taxaErro = g.total > 0 ? ((g.erros / g.total) * 100).toFixed(1) : "0";
                                            return (
                                                <TableRow key={g.name} className="hover:bg-slate-50/70 border-b border-slate-100">
                                                    <TableCell className="text-center font-black text-slate-700 text-xs">
                                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-800 text-xs font-black">
                                                            {idx + 1}º
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="font-bold text-slate-900 text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <User className="w-4 h-4 text-rose-500" />
                                                            {g.name}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                                            <div
                                                                className="bg-gradient-to-r from-rose-400 to-rose-600 h-full rounded-full transition-all duration-500"
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono font-black text-rose-700 text-sm">
                                                        {g.erros}
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-slate-600 text-xs">
                                                        {g.total}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="outline" className="font-black text-xs bg-rose-50 text-rose-700 border-rose-300">
                                                            {taxaErro}%
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                )}

                {/* Conteúdo da Aba 3: Histórico de Ocorrências com Erro do Gestor */}
                {activeSubTab === "HISTORICO_ERROS" && (
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                                    Auditoria de Faltas Indevidas e Divergências de Apontamento
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Evidências catalogadas onde o gestor apontou falta em colaborador presente.
                                </p>
                            </div>
                        </div>

                        {todosErrosDetalhados.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 text-sm">
                                Nenhuma ocorrência de divergência registrada.
                            </div>
                        ) : (
                            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead className="font-bold text-slate-700 text-xs">Código / Data</TableHead>
                                            <TableHead className="font-bold text-slate-700 text-xs">Colaborador</TableHead>
                                            <TableHead className="font-bold text-slate-700 text-xs">Gestor que Apontou Erro</TableHead>
                                            <TableHead className="font-bold text-slate-700 text-xs">O que o Gestor Informou</TableHead>
                                            <TableHead className="font-bold text-slate-700 text-xs">O que o Secullum Constatou</TableHead>
                                            <TableHead className="font-bold text-slate-700 text-xs text-right">Auditoria RH</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {todosErrosDetalhados.map((err: any) => (
                                            <TableRow key={err.id} className="hover:bg-slate-50/70 border-b border-slate-100">
                                                <TableCell className="font-mono text-xs font-bold text-indigo-700">
                                                    <div>#{err.code}</div>
                                                    <div className="text-slate-500 font-normal">{formatData(err.date)}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-slate-900 text-xs">{err.employeeName}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">CPF: {err.employeeCpf}</div>
                                                    <div className="text-[10px] text-slate-500">{err.clientName}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                                        <User className="w-3.5 h-3.5 text-rose-500" />
                                                        {err.managerName}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="bg-rose-50 text-rose-800 border-rose-300 font-black text-[10px]">
                                                        {err.requestedReason}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1">
                                                        {err.detectedPunches || err.details}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {err.resolvedByName ? (
                                                        <div className="text-[11px] text-emerald-700 font-bold">
                                                            Auditado por {err.resolvedByName}
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] font-bold">
                                                            Pendente Correção
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                )}

                {/* Aba: Ranking de Reenvios (gestor cobrado várias vezes) */}
                {activeSubTab === "REENVIOS" && (
                    <div className="space-y-5 pt-2">
                        <div>
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-orange-600" />
                                Ranking de Gestores por Reenvios de Ajustes
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Ajustes enviados ao gestor 2 ou mais vezes (ex.: enviou, não respondeu, reenviou, não respondeu…).
                            </p>
                        </div>

                        {rankingReenvios.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 text-sm">Nenhum ajuste foi reenviado até o momento.</div>
                        ) : (
                            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead className="w-16 text-center font-bold text-slate-700 text-xs">Posição</TableHead>
                                            <TableHead className="font-bold text-slate-700 text-xs">Gestor</TableHead>
                                            <TableHead className="text-center font-bold text-slate-700 text-xs">Ajustes Reenviados</TableHead>
                                            <TableHead className="text-center font-bold text-slate-700 text-xs">Total de Envios</TableHead>
                                            <TableHead className="text-center font-bold text-slate-700 text-xs">Maior nº de Envios</TableHead>
                                            <TableHead className="text-center font-bold text-slate-700 text-xs">Ainda sem Resposta</TableHead>
                                            <TableHead className="text-center font-bold text-slate-700 text-xs">Último Envio</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rankingReenvios.map((g: any, idx: number) => (
                                            <TableRow key={g.name} className="hover:bg-slate-50/70 border-b border-slate-100">
                                                <TableCell className="text-center font-black text-slate-700 text-xs">{idx + 1}º</TableCell>
                                                <TableCell className="font-bold text-slate-900 text-sm">
                                                    <div className="flex items-center gap-2"><User className="w-4 h-4 text-indigo-500" />{g.name}</div>
                                                </TableCell>
                                                <TableCell className="text-center font-mono font-black text-orange-700 text-sm">{g.ajustes}</TableCell>
                                                <TableCell className="text-center font-mono font-bold text-slate-800">{g.totalEnvios}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className="font-black text-xs bg-orange-50 text-orange-700 border-orange-200">{g.maxEnvios}x</Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className={`font-black text-xs ${g.semResposta > 0 ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{g.semResposta}</Badge>
                                                </TableCell>
                                                <TableCell className="text-center text-xs text-slate-600">{formatData(g.ultimoEnvio)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {reenviosDetalhados.length > 0 && (
                            <div>
                                <h4 className="text-sm font-extrabold text-slate-900 mb-2">Ajustes mais cobrados</h4>
                                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead className="text-xs font-bold text-slate-700">Código</TableHead>
                                                <TableHead className="text-xs font-bold text-slate-700">Colaborador</TableHead>
                                                <TableHead className="text-xs font-bold text-slate-700">Contrato</TableHead>
                                                <TableHead className="text-xs font-bold text-slate-700">Gestor</TableHead>
                                                <TableHead className="text-xs font-bold text-slate-700 text-center">Data</TableHead>
                                                <TableHead className="text-xs font-bold text-slate-700 text-center">Envios</TableHead>
                                                <TableHead className="text-xs font-bold text-slate-700 text-center">Situação</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {reenviosDetalhados.slice(0, 100).map((r: any) => (
                                                <TableRow key={r.id} className="hover:bg-slate-50/70 border-b border-slate-100">
                                                    <TableCell className="font-mono font-bold text-indigo-700 text-xs">#{r.code}</TableCell>
                                                    <TableCell className="text-xs font-semibold text-slate-800">{r.employeeName}</TableCell>
                                                    <TableCell className="text-xs text-slate-600">{r.clientName}</TableCell>
                                                    <TableCell className="text-xs text-slate-700">{r.managerName}</TableCell>
                                                    <TableCell className="text-center text-xs text-slate-600">{formatData(r.date)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="outline" className="font-black text-xs bg-orange-50 text-orange-700 border-orange-200">{r.sendCount}x</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {r.semResposta ? (
                                                            <Badge variant="outline" className="text-[10px] font-bold bg-rose-50 text-rose-700 border-rose-200">Sem resposta</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">Respondido</Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Conteúdo da Aba 4: Ranking de Motivos e Gráfico Mensal */}
                {activeSubTab === "MOTIVOS" && (
                    <div className="space-y-6 pt-2">
                        {/* Distribuição por Motivo */}
                        <div>
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 mb-3">
                                <BarChart3 className="w-4 h-4 text-indigo-600" />
                                Ranking dos Motivos Solicitados
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {rankingMotivos.map((m: any) => (
                                    <div key={m.motivo} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                                        <div className="text-xs font-bold text-slate-800 max-w-[200px] truncate" title={m.motivo}>
                                            {m.motivo}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-black text-indigo-700 text-sm">{m.count}</span>
                                            <span className="text-[10px] text-slate-400">
                                                ({((m.count / totalAdjustments) * 100).toFixed(0)}%)
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Evolutivo Mensal */}
                        <div className="pt-2">
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 mb-3">
                                <TrendingUp className="w-4 h-4 text-emerald-600" />
                                Evolução Mensal dos Ajustes de Ponto
                            </h3>
                            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead className="font-bold text-slate-700 text-xs">Mês / Competência</TableHead>
                                            <TableHead className="text-center font-bold text-slate-700 text-xs">Total Ajustes</TableHead>
                                            <TableHead className="text-center font-bold text-slate-700 text-xs">Abonos Concedidos</TableHead>
                                            <TableHead className="text-center font-bold text-slate-700 text-xs">Faltas Confirmadas</TableHead>
                                            <TableHead className="text-center font-bold text-slate-700 text-xs">Batidas Offline Resgatadas</TableHead>
                                            <TableHead className="text-center font-bold text-slate-700 text-xs">Erros do Gestor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {evolutivoMensal.map((em: any) => (
                                            <TableRow key={em.mes} className="hover:bg-slate-50 border-b border-slate-100">
                                                <TableCell className="font-bold text-slate-800 text-sm">
                                                    {em.mes}
                                                </TableCell>
                                                <TableCell className="text-center font-mono font-bold text-slate-900">
                                                    {em.total}
                                                </TableCell>
                                                <TableCell className="text-center font-mono font-bold text-amber-700">
                                                    {em.abonos}
                                                </TableCell>
                                                <TableCell className="text-center font-mono font-bold text-rose-700">
                                                    {em.faltas}
                                                </TableCell>
                                                <TableCell className="text-center font-mono font-bold text-purple-700">
                                                    {em.offline}
                                                </TableCell>
                                                <TableCell className="text-center font-mono font-bold text-rose-800">
                                                    {em.erros}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
