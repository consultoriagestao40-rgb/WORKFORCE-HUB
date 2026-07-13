"use client";

import React, { useState } from "react";
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
    const [activeSubTab, setActiveSubTab] = useState<"postos" | "sla" | "nps">("postos");

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
    );
}
