"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientPostosTable } from "./ClientPostosTable";
import { NewPostoSheet } from "./NewPostoSheet";
import { ClientVacantPostosDialog } from "./ClientVacantPostosDialog";
import { saveNpsQuestions, saveSlaConfig, saveSlaMonthlyValueWithClient } from "@/app/admin/requests/actions";
import { 
    Plus, Trash2, Save, Calendar, CheckCircle2, 
    ClipboardList, Award, Smile, Info, TrendingUp, UserPlus, UserMinus, Download, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from "recharts";
import * as XLSX from "xlsx";

interface ClientConfigTabsProps {
    client: any;
    employees: any[];
    schedules: any[];
    roles: any[];
    situations: any[];
    userRole: string;
    initialNpsQuestions: any[];
    initialSlaConfigs: any[];
    initialNpsResponses: any[];
}

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function ClientConfigTabs({
    client,
    employees,
    schedules,
    roles,
    situations,
    userRole,
    initialNpsQuestions,
    initialSlaConfigs,
    initialNpsResponses
}: ClientConfigTabsProps) {
    const [activeSubTab, setActiveSubTab] = useState<"postos" | "sla" | "nps" | "turnover">("postos");

    // Turnover States
    const [turnoverStartDate, setTurnoverStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1); // Primeiro dia do mês atual
        return d.toISOString().split('T')[0];
    });
    const [turnoverEndDate, setTurnoverEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });
    const [turnoverData, setTurnoverData] = useState<any>(null);
    const [turnoverLoading, setTurnoverLoading] = useState(false);
    const [exportingTurnover, setExportingTurnover] = useState(false);

    const fetchTurnover = async () => {
        setTurnoverLoading(true);
        try {
            const res = await fetch(`/api/admin/clients/${client.id}/turnover?startDate=${turnoverStartDate}&endDate=${turnoverEndDate}`);
            const data = await res.json();
            if (data.success) {
                setTurnoverData(data.turnover);
            } else {
                toast.error(data.error || "Erro ao carregar dados de turnover.");
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setTurnoverLoading(false);
        }
    };

    useEffect(() => {
        if (activeSubTab === "turnover") {
            fetchTurnover();
        }
    }, [activeSubTab, turnoverStartDate, turnoverEndDate]);

    const handleExportTurnover = () => {
        if (!turnoverData) return;
        setExportingTurnover(true);
        try {
            const wb = XLSX.utils.book_new();

            // 1. Aba de Admissões
            const admissionsExport = turnoverData.admissions.map((a: any, idx: number) => ({
                "Nº": idx + 1,
                "Nome Colaborador": a.employeeName,
                "CPF": a.employeeCpf,
                "Cargo/Função": a.roleName,
                "Escala": a.schedule,
                "Data de Início": new Date(a.startDate).toLocaleDateString('pt-BR'),
                "Salário Base (R$)": a.salary
            }));
            const wsAdmissions = XLSX.utils.json_to_sheet(admissionsExport);
            XLSX.utils.book_append_sheet(wb, wsAdmissions, "Admissões no Período");

            // 2. Aba de Saídas
            const departuresExport = turnoverData.departures.map((d: any, idx: number) => ({
                "Nº": idx + 1,
                "Nome Colaborador": d.employeeName,
                "CPF": d.employeeCpf,
                "Cargo/Função": d.roleName,
                "Escala": d.schedule,
                "Data de Saída": new Date(d.endDate).toLocaleDateString('pt-BR'),
                "Salário Base (R$)": d.salary,
                "Motivo/Detalhes": d.dismissalReason
            }));
            const wsDepartures = XLSX.utils.json_to_sheet(departuresExport);
            XLSX.utils.book_append_sheet(wb, wsDepartures, "Saídas no Período");

            // 3. Aba de Histórico Geral (todos que já passaram no posto)
            const historyExport = turnoverData.historyList.map((h: any, idx: number) => ({
                "Nº": idx + 1,
                "Nome": h.employeeName,
                "CPF": h.employeeCpf,
                "Cargo": h.roleName,
                "Escala": h.schedule,
                "Data Entrada": new Date(h.startDate).toLocaleDateString('pt-BR'),
                "Data Saída": h.endDate ? new Date(h.endDate).toLocaleDateString('pt-BR') : "-",
                "Situação": h.endDate ? "Ex-colaborador" : "Ativo",
                "Motivo Saída": h.reason || "-",
                "Observações": h.notes || "-"
            }));
            const wsHistory = XLSX.utils.json_to_sheet(historyExport);
            XLSX.utils.book_append_sheet(wb, wsHistory, "Histórico Geral do Posto");

            XLSX.writeFile(wb, `Relatorio_Turnover_${client.name}_${turnoverStartDate}_a_${turnoverEndDate}.xlsx`);
            toast.success("Relatório de Turnover exportado!");
        } catch (error: any) {
            toast.error("Erro ao exportar: " + error.message);
        } finally {
            setExportingTurnover(false);
        }
    };

    const activeQuestionsForEvolution = initialNpsQuestions && initialNpsQuestions.length > 0 ? initialNpsQuestions : [
        { id: "def-1", text: "Como você avalia a pontualidade e assiduidade dos colaboradores?" },
        { id: "def-2", text: "Como você avalia a qualidade da execução dos serviços e rotinas?" },
        { id: "def-3", text: "Como você avalia o atendimento da nossa mesa de operações?" },
        { id: "def-4", text: "Como você avalia a postura e apresentação pessoal da equipe?" },
        { id: "def-5", text: "Qual a probabilidade de recomendar nossos serviços a um parceiro?" }
    ];

    const npsEvolution = activeQuestionsForEvolution.map(q => {
        const monthlyScores = monthNames.map((_, index) => {
            const monthResponses = (initialNpsResponses || []).filter(resp => new Date(resp.createdAt).getMonth() === index);
            const answers = monthResponses.flatMap(resp => (resp.answers || []).filter((a: any) => a.questionId === q.id));
            if (answers.length > 0) {
                return parseFloat((answers.reduce((sum: number, a: any) => sum + a.score, 0) / answers.length).toFixed(1));
            }
            return null;
        });
        return {
            id: q.id,
            text: q.text,
            monthlyScores
        };
    });

    // NPS States
    const [npsQuestions, setNpsQuestions] = useState<any[]>(
        initialNpsQuestions && initialNpsQuestions.length > 0 
            ? initialNpsQuestions.map(q => ({ ...q }))
            : [
                { id: "def-1", text: "Como você avalia a pontualidade e assiduidade dos colaboradores?", weight: 2.0 },
                { id: "def-2", text: "Como você avalia a qualidade da execução dos serviços e rotinas?", weight: 3.0 },
                { id: "def-3", text: "Como você avalia o atendimento da nossa mesa de operações?", weight: 2.0 },
                { id: "def-4", text: "Como você avalia a postura e apresentação pessoal da equipe?", weight: 1.0 },
                { id: "def-5", text: "Qual a probabilidade de recomendar nossos serviços a um parceiro?", weight: 2.0 }
            ]
    );
    const [savingNps, setSavingNps] = useState(false);

    // SLA States
    const [slaConfigs, setSlaConfigs] = useState<any[]>(
        initialSlaConfigs && initialSlaConfigs.length > 0
            ? initialSlaConfigs.map(c => ({ ...c }))
            : [
                { id: "sla-def-1", name: "Efetividade Operacional", metricType: "EFETIVIDADE", weight: 3.0, targetValue: 95.0, monthlyValues: [] },
                { id: "sla-def-2", name: "Cumprimento de SLA de Chamados", metricType: "SLA_CHAMADOS", weight: 2.0, targetValue: 90.0, monthlyValues: [] },
                { id: "sla-def-3", name: "Satisfação NPS (Média)", metricType: "NPS", weight: 2.0, targetValue: 9.0, monthlyValues: [] },
                { id: "sla-def-4", name: "Auditoria / Uso de EPIs", metricType: "MANUAL", weight: 1.0, targetValue: 100.0, monthlyValues: [] }
            ]
    );
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [savingSla, setSavingSla] = useState(false);
    const [savingMonthly, setSavingMonthly] = useState<string | null>(null);

    // Dynamic Monthly Values
    const [monthlyValues, setMonthlyValues] = useState<Record<string, Record<number, number>>>(() => {
        const initialMap: Record<string, Record<number, number>> = {};
        initialSlaConfigs.forEach(item => {
            initialMap[item.id] = {};
            (item.monthlyValues || []).forEach((val: any) => {
                if (val.year === selectedYear) {
                    initialMap[item.id][val.month] = val.value;
                }
            });
        });
        return initialMap;
    });

    const handleAddNpsQuestion = () => {
        setNpsQuestions([
            ...npsQuestions,
            { id: `new-${Date.now()}`, text: "", weight: 1.0 }
        ]);
    };

    const handleRemoveNpsQuestion = (id: string) => {
        setNpsQuestions(npsQuestions.filter(q => q.id !== id));
    };

    const handleSaveNpsQuestions = async () => {
        if (npsQuestions.some(q => !q.text.trim())) {
            toast.error("Preencha o texto de todas as perguntas.");
            return;
        }
        setSavingNps(true);
        try {
            const res = await saveNpsQuestions(client.id, npsQuestions);
            if (res.success) {
                toast.success("Perguntas de NPS salvas com sucesso!");
            } else {
                toast.error(res.error || "Erro ao salvar perguntas.");
            }
        } catch (error) {
            toast.error("Erro na comunicação com o servidor.");
        } finally {
            setSavingNps(false);
        }
    };

    // SLA Functions
    const handleAddSlaItem = () => {
        setSlaConfigs([
            ...slaConfigs,
            { id: `new-sla-${Date.now()}`, name: "", metricType: "MANUAL", weight: 1.0, targetValue: 90.0, monthlyValues: [] }
        ]);
    };

    const handleRemoveSlaItem = (id: string) => {
        setSlaConfigs(slaConfigs.filter(c => c.id !== id));
    };

    const handleSaveSlaConfig = async () => {
        if (slaConfigs.some(c => !c.name.trim())) {
            toast.error("Preencha o nome de todos os indicadores de SLA.");
            return;
        }
        setSavingSla(true);
        try {
            const res = await saveSlaConfig(client.id, slaConfigs);
            if (res.success) {
                toast.success("Configuração de SLA salva com sucesso!");
            } else {
                toast.error(res.error || "Erro ao salvar configuração.");
            }
        } catch (error) {
            toast.error("Erro ao salvar SLA.");
        } finally {
            setSavingSla(false);
        }
    };

    const handleMonthlyValueChange = (itemId: string, month: number, val: string) => {
        const numericVal = parseFloat(val) || 0;
        setMonthlyValues(prev => ({
            ...prev,
            [itemId]: {
                ...(prev[itemId] || {}),
                [month]: Math.min(100, Math.max(0, numericVal))
            }
        }));
    };

    const handleSaveMonthlyValue = async (itemId: string, month: number) => {
        const val = monthlyValues[itemId]?.[month] ?? 0;
        setSavingMonthly(`${itemId}-${month}`);
        try {
            const res = await saveSlaMonthlyValueWithClient(client.id, itemId, month, selectedYear, val);
            if (res.success) {
                toast.success("Nota mensal registrada!");
            } else {
                toast.error(res.error || "Erro ao registrar nota.");
            }
        } catch (error) {
            toast.error("Erro de comunicação.");
        } finally {
            setSavingMonthly(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* TOTALIZERS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="shadow-sm border-slate-200/60">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Total de Postos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{client.postos.length}</div>
                        <p className="text-xs text-slate-500 mt-1">
                            {client.postos.filter((p: any) => p.assignments.some((a: any) => !a.endDate)).length} Ocupados
                        </p>
                    </CardContent>
                </Card>

                <ClientVacantPostosDialog postos={client.postos} />

                <Card className="shadow-sm border-slate-200/60">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Receita Mensal (Faturamento)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                client.postos.reduce((acc: number, p: any) => acc + p.billingValue, 0)
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-200/60">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Custo Salarial Estimado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                client.postos.reduce((acc: number, p: any) => acc + (p.baseSalary || 0) + (p.insalubridade || 0) + (p.periculosidade || 0) + (p.gratificacao || 0) + (p.outrosAdicionais || 0), 0)
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 italic">
                            Salário Base + Adicionais
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Subtab Navigation */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveSubTab("postos")}
                    className={`pb-3 text-sm font-black transition-colors px-4 border-b-2 -mb-[2px] ${
                        activeSubTab === "postos" 
                        ? "border-primary text-primary" 
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                >
                    Postos & Alocações
                </button>
                <button
                    onClick={() => setActiveSubTab("turnover")}
                    className={`pb-3 text-sm font-black transition-colors px-4 border-b-2 -mb-[2px] ${
                        activeSubTab === "turnover" 
                        ? "border-primary text-primary" 
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                >
                    Relatório de Turnover
                </button>
            </div>

            {activeSubTab === "postos" && (
                <Card className="shadow-sm border-slate-200/60">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Postos Contratados</CardTitle>
                            <CardDescription>Veja todos os postos de trabalho e profissionais vinculados.</CardDescription>
                        </div>
                        <NewPostoSheet clientId={client.id} schedules={schedules} roles={roles} />
                    </CardHeader>
                    <CardContent>
                        <ClientPostosTable
                            postos={client.postos}
                            employees={employees}
                            schedules={schedules}
                            roles={roles}
                            situations={situations}
                            userRole={userRole || ""}
                        />
                    </CardContent>
                </Card>
            )}

            {activeSubTab === "turnover" && (
                <div className="space-y-6">
                    {/* Period filters card */}
                    <Card className="shadow-sm border-slate-200/60 p-4">
                        <div className="flex flex-col sm:flex-row items-end justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Início do Período</Label>
                                    <Input
                                        type="date"
                                        value={turnoverStartDate}
                                        onChange={(e) => setTurnoverStartDate(e.target.value)}
                                        className="h-9 text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Fim do Período</Label>
                                    <Input
                                        type="date"
                                        value={turnoverEndDate}
                                        onChange={(e) => setTurnoverEndDate(e.target.value)}
                                        className="h-9 text-xs"
                                    />
                                </div>
                                <Button 
                                    onClick={fetchTurnover} 
                                    disabled={turnoverLoading}
                                    variant="outline"
                                    size="sm"
                                    className="h-9 gap-1.5 self-end"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${turnoverLoading ? "animate-spin" : ""}`} />
                                    Filtrar
                                </Button>
                            </div>

                            <Button 
                                onClick={handleExportTurnover} 
                                disabled={exportingTurnover || !turnoverData}
                                className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs rounded-xl shadow-sm"
                            >
                                <Download className="w-4 h-4" />
                                {exportingTurnover ? "Exportando..." : "Exportar Planilha de Turnover"}
                            </Button>
                        </div>
                    </Card>

                    {turnoverLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                            <span className="text-xs text-slate-500 font-semibold">Buscando histórico e calculando turnover...</span>
                        </div>
                    ) : turnoverData ? (
                        <div className="space-y-6">
                            {/* KPI Metrics Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Card className="shadow-sm border-slate-200/60 p-4 flex flex-col justify-between h-[100px]">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taxa de Turnover</span>
                                    <span className="text-2xl font-black text-blue-600">{turnoverData.turnoverRate.toFixed(1)}%</span>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase">Média proporcional do período</span>
                                </Card>
                                <Card className="shadow-sm border-slate-200/60 p-4 flex flex-col justify-between h-[100px]">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Novas Entradas (Admissões)</span>
                                    <span className="text-2xl font-black text-emerald-600">{turnoverData.totalAdmissions}</span>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase">Novas alocações no período</span>
                                </Card>
                                <Card className="shadow-sm border-slate-200/60 p-4 flex flex-col justify-between h-[100px]">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saídas do Contrato</span>
                                    <span className="text-2xl font-black text-red-600">{turnoverData.totalDepartures}</span>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase">Desvinculações no período</span>
                                </Card>
                            </div>

                            {/* Chart Card */}
                            <Card className="shadow-sm border-slate-200/60 p-5 space-y-4">
                                <div>
                                    <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                                        <TrendingUp className="w-5 h-5 text-blue-500" /> Fluxo Diário de Entradas e Saídas
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium">Histórico de admissões vs saídas nos postos deste contrato</p>
                                </div>
                                <div className="h-64 w-full pt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={turnoverData.dailyTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} />
                                            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} allowDecimals={false} />
                                            <RechartsTooltip
                                                contentStyle={{ 
                                                    backgroundColor: '#ffffff', 
                                                    borderRadius: '12px', 
                                                    border: 'none', 
                                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' 
                                                }}
                                                labelStyle={{ fontWeight: 'bold', fontSize: '12px', color: '#1e293b' }}
                                            />
                                            <Legend verticalAlign="top" height={36} iconType="circle" />
                                            <Bar dataKey="admissoes" fill="#10b981" name="Admissões / Entradas" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="demissoes" fill="#ef4444" name="Saídas / Desalocações" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            {/* Tables details grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Admissions List */}
                                <Card className="shadow-sm border-slate-200/60 p-4">
                                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b pb-2">
                                        <UserPlus className="w-4 h-4 text-emerald-500" /> Admissões no Período ({turnoverData.totalAdmissions})
                                    </h4>
                                    <div className="max-h-[300px] overflow-y-auto pr-1">
                                        {turnoverData.admissions.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic text-center py-6">Nenhuma nova alocação registrada.</p>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="text-[10px] font-bold">Colaborador</TableHead>
                                                        <TableHead className="text-[10px] font-bold">Função</TableHead>
                                                        <TableHead className="text-[10px] font-bold">Data</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {turnoverData.admissions.map((a: any) => (
                                                        <TableRow key={a.id}>
                                                            <TableCell className="text-xs font-semibold text-slate-700">{a.employeeName}</TableCell>
                                                            <TableCell className="text-[11px] text-slate-500">{a.roleName}</TableCell>
                                                            <TableCell className="text-[11px] text-slate-500">{new Date(a.startDate).toLocaleDateString('pt-BR')}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </div>
                                </Card>

                                {/* Departures List */}
                                <Card className="shadow-sm border-slate-200/60 p-4">
                                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b pb-2">
                                        <UserMinus className="w-4 h-4 text-red-500" /> Saídas no Período ({turnoverData.totalDepartures})
                                    </h4>
                                    <div className="max-h-[300px] overflow-y-auto pr-1">
                                        {turnoverData.departures.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic text-center py-6">Nenhuma saída ou desalocação registrada.</p>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="text-[10px] font-bold">Colaborador</TableHead>
                                                        <TableHead className="text-[10px] font-bold">Função</TableHead>
                                                        <TableHead className="text-[10px] font-bold">Motivo/Detalhes</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {turnoverData.departures.map((d: any) => (
                                                        <TableRow key={d.id}>
                                                            <TableCell className="text-xs font-semibold text-slate-700">{d.employeeName}</TableCell>
                                                            <TableCell className="text-[11px] text-slate-500">{d.roleName}</TableCell>
                                                            <TableCell className="text-[11px] text-slate-500 italic max-w-[150px] truncate" title={d.dismissalReason}>{d.dismissalReason}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </div>
                                </Card>
                            </div>

                            {/* General History (Everyone who ever worked on this client/contract) */}
                            <Card className="shadow-sm border-slate-200/60 p-5">
                                <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-1.5 border-b pb-3">
                                    <ClipboardList className="w-5 h-5 text-indigo-500" /> Histórico Completo de Profissionais (Passaram no Posto)
                                </h3>
                                <div className="max-h-[350px] overflow-y-auto pr-1">
                                    {turnoverData.historyList.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic text-center py-8">Nenhum histórico disponível para este contrato.</p>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Colaborador</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">CPF</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Função</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Escala</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Data Entrada</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Data Saída</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Situação no Posto</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Motivo Saída</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Observações</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {turnoverData.historyList.map((h: any) => (
                                                    <TableRow key={h.id}>
                                                        <TableCell className="text-xs font-semibold text-slate-700">{h.employeeName}</TableCell>
                                                        <TableCell className="text-[11px] text-slate-500">{h.employeeCpf}</TableCell>
                                                        <TableCell className="text-[11px] text-slate-500">{h.roleName}</TableCell>
                                                        <TableCell className="text-[11px] text-slate-500">{h.schedule}</TableCell>
                                                        <TableCell className="text-[11px] text-slate-500">{new Date(h.startDate).toLocaleDateString('pt-BR')}</TableCell>
                                                        <TableCell className="text-[11px] text-slate-500">{h.endDate ? new Date(h.endDate).toLocaleDateString('pt-BR') : "-"}</TableCell>
                                                        <TableCell className="text-[11px]">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                                h.endDate 
                                                                ? "bg-slate-100 text-slate-600" 
                                                                : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                                            }`}>
                                                                {h.endDate ? "Ex-colaborador" : "Ativo"}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-[11px] text-slate-600">{h.reason || "-"}</TableCell>
                                                        <TableCell className="text-[11px] text-slate-600 max-w-[200px] truncate" title={h.notes}>{h.notes || "-"}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                            </Card>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}
