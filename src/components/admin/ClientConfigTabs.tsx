"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientPostosTable } from "./ClientPostosTable";
import { NewPostoSheet } from "./NewPostoSheet";
import { ClientVacantPostosDialog } from "./ClientVacantPostosDialog";
import { saveNpsQuestions, saveSlaConfig, saveSlaMonthlyValueWithClient } from "@/app/admin/requests/actions";
import { 
    Plus, Trash2, Save, Calendar, CheckCircle2, 
    ClipboardList, Award, Smile, Info 
} from "lucide-react";
import { toast } from "sonner";

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
    const [activeSubTab, setActiveSubTab] = useState<"postos" | "sla" | "nps">("postos");

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

    const monthNames = [
        "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
        "Jul", "Ago", "Set", "Out", "Nov", "Dez"
    ];

    return (
        <div className="space-y-6">
            {/* TABS SELECTOR */}
            <div className="flex gap-2 bg-slate-200/60 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveSubTab("postos")}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
                        activeSubTab === "postos"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                    <ClipboardList className="w-4 h-4" />
                    Postos Contratados
                </button>
                <button
                    onClick={() => setActiveSubTab("sla")}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
                        activeSubTab === "sla"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                    <Award className="w-4 h-4" />
                    Configuração de SLA
                </button>
                <button
                    onClick={() => setActiveSubTab("nps")}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
                        activeSubTab === "nps"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                    <Smile className="w-4 h-4" />
                    Configuração do NPS
                </button>
            </div>

            {/* TAB CONTENTS */}
            {activeSubTab === "postos" && (
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
                </div>
            )}

            {activeSubTab === "sla" && (
                <div className="space-y-6">
                    <Card className="shadow-sm border-slate-200/60">
                        <CardHeader>
                            <CardTitle>Configuração dos Indicadores de SLA</CardTitle>
                            <CardDescription>
                                Defina os pesos e as metas de conformidade que calculam a nota consolidada do contrato de cada mês.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                {slaConfigs.map((item, index) => (
                                    <div key={item.id} className="flex flex-col md:flex-row items-end gap-3 p-4 rounded-xl border border-slate-200/60 bg-slate-50/50">
                                        <div className="flex-1 space-y-1">
                                            <Label className="text-xs font-bold text-slate-600">Nome do Indicador</Label>
                                            <Input
                                                value={item.name}
                                                onChange={(e) => {
                                                    const updated = [...slaConfigs];
                                                    updated[index].name = e.target.value;
                                                    setSlaConfigs(updated);
                                                }}
                                                placeholder="Ex: Auditoria Interna"
                                                className="bg-white"
                                            />
                                        </div>

                                        <div className="w-full md:w-56 space-y-1">
                                            <Label className="text-xs font-bold text-slate-600">Tipo de Mapeamento</Label>
                                            <select
                                                value={item.metricType}
                                                onChange={(e) => {
                                                    const updated = [...slaConfigs];
                                                    updated[index].metricType = e.target.value;
                                                    setSlaConfigs(updated);
                                                }}
                                                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs outline-none focus:border-primary"
                                            >
                                                <option value="EFETIVIDADE">Efetividade Operacional (Automático)</option>
                                                <option value="SLA_CHAMADOS">SLA de Chamados (Automático)</option>
                                                <option value="NPS">Satisfação NPS (Automático)</option>
                                                <option value="RECLAMACOES">Índice de Reclamações (Automático)</option>
                                                <option value="MANUAL">Lançamento Mensal (Manual)</option>
                                            </select>
                                        </div>

                                        <div className="w-24 space-y-1">
                                            <Label className="text-xs font-bold text-slate-600">Peso (1 a 10)</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={item.weight}
                                                onChange={(e) => {
                                                    const updated = [...slaConfigs];
                                                    updated[index].weight = parseFloat(e.target.value) || 1.0;
                                                    setSlaConfigs(updated);
                                                }}
                                                className="bg-white"
                                            />
                                        </div>

                                        <div className="w-24 space-y-1">
                                            <Label className="text-xs font-bold text-slate-600">Meta (%)</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={item.targetValue}
                                                onChange={(e) => {
                                                    const updated = [...slaConfigs];
                                                    updated[index].targetValue = parseFloat(e.target.value) || 90.0;
                                                    setSlaConfigs(updated);
                                                }}
                                                className="bg-white"
                                            />
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveSlaItem(item.id)}
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 h-10 w-10 shrink-0"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between items-center pt-2">
                                <Button variant="outline" size="sm" onClick={handleAddSlaItem} className="gap-1.5 border-dashed">
                                    <Plus className="w-4 h-4" /> Adicionar Indicador
                                </Button>
                                <Button size="sm" onClick={handleSaveSlaConfig} disabled={savingSla} className="gap-1.5 bg-primary text-slate-900 hover:bg-primary/90 font-bold">
                                    <Save className="w-4 h-4" /> {savingSla ? "Salvando..." : "Salvar Configurações"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* MANUAL SLA MONTHLY ENTRY SECTION */}
                    {slaConfigs.some(c => c.metricType === "MANUAL") && (
                        <Card className="shadow-sm border-slate-200/60">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Lançamento de Indicadores Manuais</CardTitle>
                                    <CardDescription>
                                        Insira a pontuação (0 a 100) atingida pelas auditorias e vistorias manuais de cada mês.
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-slate-505" />
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs outline-none"
                                    >
                                        <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                                        <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                                    </select>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {slaConfigs.filter(c => c.metricType === "MANUAL").map((item) => (
                                    <div key={item.id} className="space-y-2 p-4 rounded-xl border border-slate-100 bg-slate-50/20">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-sm text-slate-800">{item.name}</span>
                                            <span className="text-xs font-semibold text-slate-400">Meta: {item.targetValue}%</span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2.5">
                                            {monthNames.map((monthName, mIndex) => {
                                                const currentVal = monthlyValues[item.id]?.[mIndex] ?? "";
                                                const isSaving = savingMonthly === `${item.id}-${mIndex}`;
                                                return (
                                                    <div key={mIndex} className="flex flex-col gap-1 text-center bg-white p-2 rounded-lg border border-slate-150">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{monthName}</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            value={currentVal}
                                                            onChange={(e) => handleMonthlyValueChange(item.id, mIndex, e.target.value)}
                                                            className="h-8 w-full border border-slate-200 rounded text-center text-xs font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                                                            placeholder="-"
                                                        />
                                                        <button
                                                            onClick={() => handleSaveMonthlyValue(item.id, mIndex)}
                                                            disabled={isSaving}
                                                            className="text-[9px] font-bold text-primary hover:underline mt-1 focus:outline-none"
                                                        >
                                                            {isSaving ? "..." : "Salvar"}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {activeSubTab === "nps" && (
                <>
                    <Card className="shadow-sm border-slate-200/60">
                    <CardHeader>
                        <CardTitle>Configuração de Perguntas do NPS</CardTitle>
                        <CardDescription>
                            Configure as perguntas do NPS com pesos individuais para medir a satisfação do cliente de forma detalhada.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            {npsQuestions.map((q, index) => (
                                <div key={q.id} className="flex items-end gap-3 p-4 rounded-xl border border-slate-200/60 bg-slate-50/50">
                                    <div className="flex-1 space-y-1">
                                        <Label className="text-xs font-bold text-slate-600">Texto da Pergunta</Label>
                                        <Input
                                            value={q.text}
                                            onChange={(e) => {
                                                const updated = [...npsQuestions];
                                                updated[index].text = e.target.value;
                                                setNpsQuestions(updated);
                                            }}
                                            placeholder="Ex: Como você avalia a postura e apresentação pessoal da equipe?"
                                            className="bg-white"
                                        />
                                    </div>

                                    <div className="w-32 space-y-1">
                                        <Label className="text-xs font-bold text-slate-600">Peso da Pergunta</Label>
                                        <Input
                                            type="number"
                                            min="0.1"
                                            step="0.1"
                                            value={q.weight}
                                            onChange={(e) => {
                                                const updated = [...npsQuestions];
                                                updated[index].weight = parseFloat(e.target.value) || 1.0;
                                                setNpsQuestions(updated);
                                            }}
                                            className="bg-white"
                                        />
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveNpsQuestion(q.id)}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50 h-10 w-10 shrink-0"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <Button variant="outline" size="sm" onClick={handleAddNpsQuestion} className="gap-1.5 border-dashed">
                                <Plus className="w-4 h-4" /> Adicionar Pergunta
                            </Button>
                            <Button size="sm" onClick={handleSaveNpsQuestions} disabled={savingNps} className="gap-1.5 bg-primary text-slate-900 hover:bg-primary/90 font-bold">
                                <Save className="w-4 h-4" /> {savingNps ? "Salvando..." : "Salvar Perguntas"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200/60 mt-6">
                    <CardHeader>
                        <CardTitle>Histórico de Avaliações NPS Recebidas</CardTitle>
                        <CardDescription>
                            Veja os feedbacks qualitativos e pontuações consolidadas enviados pelo cliente.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {initialNpsResponses && initialNpsResponses.length > 0 ? (
                            <div className="space-y-4">
                                {initialNpsResponses.map((resp: any) => {
                                    let totalScore = 0;
                                    let totalWeight = 0;
                                    resp.answers.forEach((ans: any) => {
                                        const qWeight = ans.question?.weight || 1.0;
                                        totalScore += ans.score * qWeight;
                                        totalWeight += qWeight;
                                    });
                                    const finalRating = totalWeight > 0 ? (totalScore / totalWeight).toFixed(1) : "10.0";
                                    
                                    const numericRating = parseFloat(finalRating);
                                    let badgeColor = "bg-red-50 text-red-700 border-red-100";
                                    let ratingLabel = "Detrator";
                                    if (numericRating >= 9) {
                                        badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                                        ratingLabel = "Promotor";
                                    } else if (numericRating >= 7) {
                                        badgeColor = "bg-amber-50 text-amber-700 border-amber-100";
                                        ratingLabel = "Neutro";
                                    }

                                    return (
                                        <div key={resp.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
                                            <div className="flex justify-between items-center flex-wrap gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black text-slate-700">
                                                        {new Date(resp.createdAt).toLocaleDateString('pt-BR')} às {new Date(resp.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${badgeColor}`}>
                                                        {ratingLabel} ({finalRating}/10)
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3">
                                                {resp.answers.map((ans: any) => (
                                                    <div key={ans.id} className="flex justify-between items-center py-1 border-b border-slate-50">
                                                        <span className="text-slate-550 font-medium truncate max-w-[280px]" title={ans.question?.text}>
                                                            {ans.question?.text || "Pergunta Geral"}
                                                        </span>
                                                        <span className={`font-black px-2 py-0.5 rounded text-[11px] ${
                                                            ans.score >= 9 ? "bg-emerald-50 text-emerald-600" :
                                                            ans.score >= 7 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                                                        }`}>
                                                            {ans.score}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>

                                            {resp.feedback && (
                                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2">
                                                    <span className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase">Comentário do Cliente</span>
                                                    <p className="text-xs text-slate-700 font-medium mt-1 leading-relaxed">{resp.feedback}</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500 font-semibold italic text-xs">
                                Nenhuma avaliação NPS recebida para este contrato até o momento.
                            </div>
                        )}
                    </CardContent>
                </Card>
                </>
            )}
        </div>
    );
}
