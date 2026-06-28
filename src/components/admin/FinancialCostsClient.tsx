"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, DollarSign, Users, AlertTriangle, TrendingUp, TrendingDown, Info, Search, ShieldAlert, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Employee {
    id: string;
    name: string;
    salary: number;
    admissionDate: string | Date;
    lastVacationStart: string | Date | null;
    lastVacationEnd: string | Date | null;
    role: { name: string } | null;
    situation: { name: string } | null;
    type: string;
    vacations: { id: string; startDate: string | Date; endDate: string | Date }[];
}

interface FinancialCostsClientProps {
    employees: Employee[];
    averageStayMonths: number;
    userRole: string;
}

// Funções de Cálculo Auxiliares (Padrão CLT Brasil)
function calculateMonthsBetween(start: Date, end: Date): number {
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) {
        months--;
    }
    
    // Fração de mês: 15 dias ou mais conta como mês cheio
    const tempStart = new Date(start);
    tempStart.setMonth(tempStart.getMonth() + months);
    const diffTime = Math.abs(end.getTime() - tempStart.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= 15) {
        months++;
    }
    return Math.max(0, months);
}

// INSS Progressivo 2026/CLT
function calculateINSS(salary: number): number {
    const limits = [1412.00, 2666.68, 4000.03, 7786.02];
    const rates = [0.075, 0.09, 0.12, 0.14];
    let inss = 0;
    let base = salary;
    
    if (base > 7786.02) {
        base = 7786.02; // Teto do INSS
    }
    
    let previousLimit = 0;
    for (let i = 0; i < limits.length; i++) {
        if (base > limits[i]) {
            inss += (limits[i] - previousLimit) * rates[i];
            previousLimit = limits[i];
        } else {
            inss += (base - previousLimit) * rates[i];
            break;
        }
    }
    return inss;
}

// IRRF Progressivo 2026/CLT (Sem dependentes para simplificação)
function calculateIRRF(salary: number, inss: number): number {
    const base = salary - inss;
    if (base <= 2259.20) return 0;
    if (base <= 2826.65) return (base * 0.075) - 169.44;
    if (base <= 3751.05) return (base * 0.15) - 381.44;
    if (base <= 4664.68) return (base * 0.225) - 662.77;
    return (base * 0.275) - 896.00;
}

export function FinancialCostsClient({
    employees,
    averageStayMonths,
    userRole
}: FinancialCostsClientProps) {
    const [activeTab, setActiveTab] = useState("ferias");
    const [searchTerm, setSearchTerm] = useState("");
    const [contractType, setContractType] = useState<string>("ALL");
    const [viewMode, setViewMode] = useState<"colaborador" | "contrato">("colaborador");
    const [taxRate, setTaxRate] = useState<number>(27.8);
    const [taxRateInput, setTaxRateInput] = useState<string>("27.8");

    useEffect(() => {
        const saved = localStorage.getItem("workforce_hub_tax_rate");
        if (saved) {
            setTaxRate(Number(saved));
            setTaxRateInput(saved);
        }
    }, []);

    const handleSaveTaxRate = () => {
        const rate = parseFloat(taxRateInput);
        if (isNaN(rate) || rate < 0) {
            toast.error("Por favor, insira uma alíquota válida.");
            return;
        }
        setTaxRate(rate);
        localStorage.setItem("workforce_hub_tax_rate", String(rate));
        toast.success(`Alíquota de encargos salva em ${rate}% com sucesso!`);
    };

    const today = useMemo(() => new Date(), []);
    const currentYear = today.getFullYear();
    const firstDayOfCurrentYear = useMemo(() => new Date(currentYear, 0, 1), [currentYear]);

    // Lógica e Cálculos de Férias
    const feriasData = useMemo(() => {
        return employees.map(emp => {
            const admission = new Date(emp.admissionDate);
            
            // Início do Período Aquisitivo Atual
            // Se já tirou férias, conta do fim da última. Se não, da admissão.
            let startOfPeriod = admission;
            if (emp.vacations && emp.vacations.length > 0) {
                startOfPeriod = new Date(emp.vacations[0].endDate);
            } else if (emp.lastVacationEnd) {
                startOfPeriod = new Date(emp.lastVacationEnd);
            }

            const monthsAcrued = calculateMonthsBetween(startOfPeriod, today);
            const daysAccrued = monthsAcrued * 2.5;

            const proporcionalVal = (emp.salary / 12) * monthsAcrued;
            const thirdConstitucional = proporcionalVal / 3;
            const incidentesLegais = (proporcionalVal + thirdConstitucional) * (taxRate / 100);
            const totalVal = proporcionalVal + thirdConstitucional + incidentesLegais;

            return {
                id: emp.id,
                name: emp.name,
                role: emp.role?.name || "-",
                admissionDate: admission,
                startOfPeriod,
                monthsAcrued,
                daysAccrued,
                proporcionalVal,
                thirdConstitucional,
                incidentesLegais,
                totalVal,
                salary: emp.salary,
                type: emp.type
            };
        }).filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.role.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesContract = contractType === "ALL" || item.type === contractType;
            return matchesSearch && matchesContract;
        });
    }, [employees, taxRate, today, searchTerm, contractType]);

    const feriasTotals = useMemo(() => {
        return feriasData.reduce(
            (acc, item) => {
                acc.totalDays += item.daysAccrued;
                acc.totalValue += item.totalVal;
                return acc;
            },
            { totalDays: 0, totalValue: 0 }
        );
    }, [feriasData]);

    // Lógica e Cálculos de 13º Salário
    const decimoTerceiroData = useMemo(() => {
        return employees.map(emp => {
            const admission = new Date(emp.admissionDate);
            
            // Meses trabalhados no ano corrente
            const startFor13 = admission < firstDayOfCurrentYear ? firstDayOfCurrentYear : admission;
            const monthsInYear = calculateMonthsBetween(startFor13, today);
            const fullMonthsInYear = calculateMonthsBetween(startFor13, new Date(currentYear, 11, 31)); // Meses totais que trabalhará no ano

            const valorAcumulado = (emp.salary / 12) * monthsInYear;

            // Descontos Progressivos sobre o Acumulado (Para obter o Líquido Acumulado)
            const inssAcumulado = calculateINSS(valorAcumulado);
            const irrfAcumulado = calculateIRRF(valorAcumulado, inssAcumulado);
            const valorAcumuladoLiquido = Math.max(0, valorAcumulado - inssAcumulado - irrfAcumulado);
            
            // Provisões Finais do Ano (Primeira e Segunda Parcela)
            const totalAnualBruto = (emp.salary / 12) * fullMonthsInYear;
            const primeiraParcela = totalAnualBruto * 0.5;

            const inss = calculateINSS(totalAnualBruto);
            const irrf = calculateIRRF(totalAnualBruto, inss);
            
            // Segunda Parcela = Total Anual - Deduções - Primeira Parcela
            const segundaParcela = Math.max(0, totalAnualBruto - inss - irrf - primeiraParcela);

            // Fator Turnover / Risco de Desligamento com base no TMP
            const monthsOfService = calculateMonthsBetween(admission, today);
            let riskStatus: "Estável" | "Alerta" | "Crítico" = "Estável";
            let riskPercentage = 10; // Probabilidade padrão de desligamento (turnover baixo)

            if (monthsOfService > averageStayMonths) {
                riskStatus = "Crítico";
                riskPercentage = Math.min(90, Math.round((monthsOfService / averageStayMonths) * 50));
            } else if (monthsOfService >= averageStayMonths * 0.8) {
                riskStatus = "Alerta";
                riskPercentage = 45;
            }

            return {
                id: emp.id,
                name: emp.name,
                role: emp.role?.name || "-",
                admissionDate: admission,
                monthsInYear,
                valorAcumulado,
                valorAcumuladoLiquido,
                primeiraParcela,
                segundaParcela,
                totalAnualBruto,
                monthsOfService,
                riskStatus,
                riskPercentage,
                type: emp.type
            };
        }).filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.role.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesContract = contractType === "ALL" || item.type === contractType;
            return matchesSearch && matchesContract;
        });
    }, [employees, firstDayOfCurrentYear, today, currentYear, averageStayMonths, searchTerm, contractType]);

    const decimoTerceiroTotals = useMemo(() => {
        return decimoTerceiroData.reduce(
            (acc, item) => {
                acc.totalAcumulado += item.valorAcumulado;
                acc.totalAcumuladoLiquido += item.valorAcumuladoLiquido;
                acc.totalPrimeira += item.primeiraParcela;
                acc.totalSegunda += item.segundaParcela;
                acc.totalEncargos += item.totalAnualBruto * (taxRate / 100);
                acc.totalEncargosAcumulado += item.valorAcumulado * (taxRate / 100);
                return acc;
            },
            { 
                totalAcumulado: 0, 
                totalAcumuladoLiquido: 0, 
                totalPrimeira: 0, 
                totalSegunda: 0, 
                totalEncargos: 0, 
                totalEncargosAcumulado: 0 
            }
        );
    }, [decimoTerceiroData, taxRate]);

    // Agrupamento por Contrato - Férias
    const feriasGroupedByContract = useMemo(() => {
        const groups: Record<string, {
            type: string;
            count: number;
            totalDays: number;
            proporcionalVal: number;
            thirdConstitucional: number;
            incidentesLegais: number;
            totalVal: number;
        }> = {};

        feriasData.forEach(item => {
            const contractKey = item.type || "Reserva Técnica";
            if (!groups[contractKey]) {
                groups[contractKey] = {
                    type: contractKey,
                    count: 0,
                    totalDays: 0,
                    proporcionalVal: 0,
                    thirdConstitucional: 0,
                    incidentesLegais: 0,
                    totalVal: 0
                };
            }
            groups[contractKey].count += 1;
            groups[contractKey].totalDays += item.daysAccrued;
            groups[contractKey].proporcionalVal += item.proporcionalVal;
            groups[contractKey].thirdConstitucional += item.thirdConstitucional;
            groups[contractKey].incidentesLegais += item.incidentesLegais;
            groups[contractKey].totalVal += item.totalVal;
        });

        return Object.values(groups);
    }, [feriasData]);

    // Agrupamento por Contrato - 13º
    const decimoGroupedByContract = useMemo(() => {
        const groups: Record<string, {
            type: string;
            count: number;
            totalAcumuladoLiquido: number;
            totalEncargos: number;
            totalEncargosAcumulado: number;
            totalPrimeira: number;
            totalSegunda: number;
        }> = {};

        decimoTerceiroData.forEach(item => {
            const contractKey = item.type || "Reserva Técnica";
            if (!groups[contractKey]) {
                groups[contractKey] = {
                    type: contractKey,
                    count: 0,
                    totalAcumuladoLiquido: 0,
                    totalEncargos: 0,
                    totalEncargosAcumulado: 0,
                    totalPrimeira: 0,
                    totalSegunda: 0
                };
            }
            groups[contractKey].count += 1;
            groups[contractKey].totalAcumuladoLiquido += item.valorAcumuladoLiquido;
            groups[contractKey].totalEncargos += item.totalAnualBruto * (taxRate / 100);
            groups[contractKey].totalEncargosAcumulado += item.valorAcumulado * (taxRate / 100);
            groups[contractKey].totalPrimeira += item.primeiraParcela;
            groups[contractKey].totalSegunda += item.segundaParcela;
        });

        return Object.values(groups);
    }, [decimoTerceiroData, taxRate]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Custos de Férias & 13º</h1>
                    <p className="text-sm text-slate-500 font-medium">Provisionamento de passivos trabalhistas dos colaboradores ativos</p>
                </div>

                <div className="flex items-center gap-3">
                    <Select value={viewMode} onValueChange={(val) => setViewMode(val as any)}>
                        <SelectTrigger className="w-[180px] h-10 text-xs font-semibold bg-white border-slate-200 text-slate-700">
                            <SelectValue placeholder="Visualização" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="colaborador">Por Colaborador</SelectItem>
                            <SelectItem value="contrato">Por Tipo de Contrato</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={contractType} onValueChange={setContractType}>
                        <SelectTrigger className="w-[180px] h-10 text-xs font-semibold bg-white border-slate-200 text-slate-700">
                            <SelectValue placeholder="Tipo de Contrato" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos os Contratos</SelectItem>
                            <SelectItem value="CLT">CLT (Efetivo)</SelectItem>
                            <SelectItem value="Reserva Técnica">Reserva Técnica</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar colaborador..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 w-[240px] h-10 text-xs"
                        />
                    </div>
                </div>
            </div>

            {/* TAB PRINCIPAL */}
            <Tabs defaultValue="ferias" className="w-full" onValueChange={setActiveTab}>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <TabsList className="bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <TabsTrigger value="ferias" className="px-4 py-2 text-xs font-bold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            Férias Proporcionais
                        </TabsTrigger>
                        <TabsTrigger value="decimo" className="px-4 py-2 text-xs font-bold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            13º Salário Proporcional
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-3 text-xs">
                        <span className="font-semibold text-slate-500">Incidentes Legais (FGTS + Impostos):</span>
                        <div className="flex items-center gap-1">
                            <Input
                                type="text"
                                value={taxRateInput}
                                onChange={(e) => setTaxRateInput(e.target.value)}
                                className="w-16 h-8 text-center font-bold text-slate-800 text-xs px-1"
                            />
                            <span className="font-bold text-slate-700">%</span>
                        </div>
                        <Button 
                            onClick={handleSaveTaxRate}
                            className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-all"
                        >
                            Salvar
                        </Button>
                    </div>
                </div>

                {/* TAB CONTENT: FÉRIAS */}
                <TabsContent value="ferias" className="space-y-6 pt-4">
                    {/* CARDS TOTALIZADORES */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Colaboradores Ativos</CardDescription>
                                <CardTitle className="text-3xl font-black text-slate-900 flex items-center justify-between">
                                    <span>{feriasData.length} ativos</span>
                                    <Users className="w-6 h-6 text-indigo-500" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
                                    Sem demitidos ou afastados
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total de Dias Acumulados</CardDescription>
                                <CardTitle className="text-3xl font-black text-slate-900 flex items-center justify-between">
                                    <span>{feriasTotals.totalDays.toFixed(0)} dias</span>
                                    <Calendar className="w-6 h-6 text-emerald-500" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
                                    Média por colaborador: {(feriasTotals.totalDays / (employees.length || 1)).toFixed(1)} dias
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Provisionado em Valores</CardDescription>
                                <CardTitle className="text-3xl font-black text-emerald-600 flex items-center justify-between">
                                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(feriasTotals.totalValue)}</span>
                                    <DollarSign className="w-6 h-6" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
                                    Férias Proporcional + 1/3 + {taxRate}% Encargos
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tempo Médio de Casa (TMP)</CardDescription>
                                <CardTitle className="text-3xl font-black text-slate-900 flex items-center justify-between">
                                    <span>{averageStayMonths.toFixed(1)} meses</span>
                                    <TrendingUp className="w-6 h-6 text-emerald-500" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
                                    Considerando apenas colaboradores ativos
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* TABELA DE FÉRIAS */}
                    <Card className="border-none shadow-premium bg-white overflow-hidden">
                                      {viewMode === "contrato" ? (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-800">Tipo de Contrato</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Colaboradores Ativos</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Total Dias Acum.</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Férias Prop. (Total)</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">1/3 Const. (Total)</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Encargos ({taxRate}%)</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Total Provisionado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {feriasGroupedByContract.map((group) => (
                                            <TableRow key={group.type} className="hover:bg-slate-50/50 font-medium">
                                                <TableCell className="font-bold text-slate-900 text-sm">
                                                    {group.type}
                                                </TableCell>
                                                <TableCell className="text-center text-xs text-slate-800">
                                                    {group.count} colaboradores
                                                </TableCell>
                                                <TableCell className="text-center text-xs">
                                                    <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                                                        {group.totalDays.toFixed(1)} dias
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    R$ {group.proporcionalVal.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    R$ {group.thirdConstitucional.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-600 italic">
                                                    R$ {group.incidentesLegais.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right font-extrabold text-slate-900 text-sm">
                                                    R$ {group.totalVal.toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {feriasGroupedByContract.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center text-slate-500 py-10 font-semibold">
                                                    Nenhum contrato encontrado.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {/* Grouped Totals Row */}
                                        {feriasGroupedByContract.length > 0 && (
                                            <TableRow className="bg-slate-100 font-black border-t-2 border-slate-200">
                                                <TableCell>Total Geral</TableCell>
                                                <TableCell className="text-center">{feriasData.length} colaboradores</TableCell>
                                                <TableCell className="text-center">{feriasTotals.totalDays.toFixed(1)} dias</TableCell>
                                                <TableCell className="text-right">
                                                    R$ {feriasGroupedByContract.reduce((s, g) => s + g.proporcionalVal, 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    R$ {feriasGroupedByContract.reduce((s, g) => s + g.thirdConstitucional, 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right italic">
                                                    R$ {feriasGroupedByContract.reduce((s, g) => s + g.incidentesLegais, 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-emerald-700">
                                                    R$ {feriasTotals.totalValue.toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-800">Colaborador</TableHead>
                                            <TableHead className="font-bold text-slate-800">Admissão</TableHead>
                                            <TableHead className="font-bold text-slate-800">Início Período Aquis.</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Meses Acum.</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Dias Devidos</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Férias Prop.</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">1/3 Const.</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Encargos ({taxRate}%)</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Total Acumulado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {feriasData.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900">{item.name}</span>
                                                        <span className="text-[10px] text-slate-400">{item.role}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-slate-600 text-xs">
                                                    {item.admissionDate.toLocaleDateString("pt-BR")}
                                                </TableCell>
                                                <TableCell className="text-slate-600 text-xs">
                                                    {item.startOfPeriod.toLocaleDateString("pt-BR")}
                                                </TableCell>
                                                <TableCell className="text-center font-semibold text-slate-800 text-xs">
                                                    {item.monthsAcrued} {item.monthsAcrued === 1 ? 'mês' : 'meses'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold text-xs">
                                                        {item.daysAccrued.toFixed(1)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    R$ {item.proporcionalVal.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    R$ {item.thirdConstitucional.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-600 italic">
                                                    R$ {item.incidentesLegais.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right font-extrabold text-slate-900 text-xs">
                                                    R$ {item.totalVal.toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {feriasData.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={9} className="text-center text-slate-500 py-10 font-semibold">
                                                    Nenhum colaborador encontrado.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </Card>
                </TabsContent>

                {/* TAB CONTENT: 13º SALÁRIO */}
                <TabsContent value="decimo" className="space-y-6 pt-4">
                    {/* CARDS TOTALIZADORES 13º */}
                    {/* CARDS TOTALIZADORES 13º EM LAYOUT AGRUPADO */}
                    <div className="space-y-4">
                        {/* Linha 1: Destaques (Custo Total e Ativos) */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <Card className="lg:col-span-2 border-none shadow-premium bg-gradient-to-br from-emerald-600 to-teal-700 text-white">
                                <CardHeader className="pb-2">
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Custo Total Previsto (Projeção Anual)</CardDescription>
                                    <CardTitle className="text-3xl font-black flex items-center justify-between">
                                        <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(decimoTerceiroTotals.totalPrimeira + decimoTerceiroTotals.totalSegunda + decimoTerceiroTotals.totalEncargos)}</span>
                                        <DollarSign className="w-8 h-8 text-emerald-200" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-wider">
                                        Soma das Projeções: Parcela 1 (Bruto) + Parcela 2 (Est. Líquida) + Encargos Patronais ({taxRate}%)
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50">
                                <CardHeader className="pb-2">
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Colaboradores Ativos</CardDescription>
                                    <CardTitle className="text-3xl font-black text-slate-900 flex items-center justify-between">
                                        <span>{decimoTerceiroData.length} ativos</span>
                                        <Users className="w-6 h-6 text-indigo-500" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
                                        Sem demitidos ou afastados
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Linha 2: Detalhamento das parcelas e acumulado */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50">
                                <CardHeader className="pb-2">
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">13º Líquido Acumulado</CardDescription>
                                    <CardTitle className="text-xl font-extrabold text-slate-900 flex items-center justify-between">
                                        <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(decimoTerceiroTotals.totalAcumuladoLiquido)}</span>
                                        <Calendar className="w-5 h-5 text-blue-500" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
                                        Líquido acumulado até hoje
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50">
                                <CardHeader className="pb-2">
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Encargos s/ 13º (Anual) ({taxRate}%)</CardDescription>
                                    <CardTitle className="text-xl font-extrabold text-slate-900 flex items-center justify-between">
                                        <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(decimoTerceiroTotals.totalEncargos)}</span>
                                        <DollarSign className="w-5 h-5 text-slate-400" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
                                        FGTS + Outros Encargos do Ano
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50">
                                <CardHeader className="pb-2">
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estimativa 1ª Parcela (Bruto)</CardDescription>
                                    <CardTitle className="text-xl font-extrabold text-blue-600 flex items-center justify-between">
                                        <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(decimoTerceiroTotals.totalPrimeira)}</span>
                                        <DollarSign className="w-5 h-5" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
                                        Pago sem descontos legais
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50">
                                <CardHeader className="pb-2">
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estimativa 2ª Parcela (Líquido)</CardDescription>
                                    <CardTitle className="text-xl font-extrabold text-slate-900 flex items-center justify-between">
                                        <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(decimoTerceiroTotals.totalSegunda)}</span>
                                        <TrendingDown className="w-5 h-5 text-red-500" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
                                        Deduções de INSS/IRRF retidos
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* TABELA DE 13º SALÁRIO */}
                    <Card className="border-none shadow-premium bg-white o                            {viewMode === "contrato" ? (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-800">Tipo de Contrato</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Colaboradores Ativos</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">13º Líquido Acum.</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Encargos s/ 13º ({taxRate}%)</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">1ª Parcela (50% Bruto)</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">2ª Parcela (Est. Líquida)</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Custo Total Previsto</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {decimoGroupedByContract.map((group) => (
                                            <TableRow key={group.type} className="hover:bg-slate-50/50 font-medium">
                                                <TableCell className="font-bold text-slate-900 text-sm">
                                                    {group.type}
                                                </TableCell>
                                                <TableCell className="text-center text-xs text-slate-800">
                                                    {group.count} colaboradores
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    R$ {group.totalAcumuladoLiquido.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-600 italic">
                                                    R$ {group.totalEncargos.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-blue-600 font-bold">
                                                    R$ {group.totalPrimeira.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-800 font-bold">
                                                    R$ {group.totalSegunda.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right font-extrabold text-emerald-700 text-sm">
                                                    R$ {(group.totalPrimeira + group.totalSegunda + group.totalEncargos).toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {decimoGroupedByContract.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center text-slate-500 py-10 font-semibold">
                                                    Nenhum contrato encontrado.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {/* Grouped Totals Row */}
                                        {decimoGroupedByContract.length > 0 && (
                                            <TableRow className="bg-slate-100 font-black border-t-2 border-slate-200">
                                                <TableCell>Total Geral</TableCell>
                                                <TableCell className="text-center">{decimoTerceiroData.length} colaboradores</TableCell>
                                                <TableCell className="text-right">
                                                    R$ {decimoTerceiroTotals.totalAcumuladoLiquido.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right italic">
                                                    R$ {decimoTerceiroTotals.totalEncargos.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-blue-600">
                                                    R$ {decimoTerceiroTotals.totalPrimeira.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-slate-950">
                                                    R$ {decimoTerceiroTotals.totalSegunda.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-emerald-700">
                                                    R$ {(decimoTerceiroTotals.totalPrimeira + decimoTerceiroTotals.totalSegunda + decimoTerceiroTotals.totalEncargos).toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-800">Colaborador</TableHead>
                                            <TableHead className="font-bold text-slate-800">Admissão</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Meses Trabalhados</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">13º Líquido Acum.</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Encargos s/ 13º ({taxRate}%)</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">1ª Parcela (50% Bruto)</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">2ª Parcela (Est. Líquida)</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Risco Demissional / Turnover</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {decimoTerceiroData.map((item) => {
                                            let badgeColor = "bg-green-50 text-green-700 border-green-100";
                                            if (item.riskStatus === "Crítico") {
                                                badgeColor = "bg-red-50 text-red-700 border-red-100 font-bold";
                                            } else if (item.riskStatus === "Alerta") {
                                                badgeColor = "bg-amber-50 text-amber-700 border-amber-100 font-semibold";
                                            }

                                            return (
                                                <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-900">{item.name}</span>
                                                            <span className="text-[10px] text-slate-400">{item.role}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-slate-600 text-xs">
                                                        {item.admissionDate.toLocaleDateString("pt-BR")}
                                                    </TableCell>
                                                    <TableCell className="text-center font-semibold text-slate-800 text-xs">
                                                        {item.monthsInYear} / 12
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs font-semibold text-slate-700">
                                                        R$ {item.valorAcumuladoLiquido.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-slate-600 italic">
                                                        R$ {(item.totalAnualBruto * (taxRate / 100)).toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-blue-600 font-bold">
                                                        R$ {item.primeiraParcela.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-slate-800 font-bold">
                                                        R$ {item.segundaParcela.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${badgeColor}`}>
                                                                {item.riskStatus === "Crítico" ? `Excede TMP (${item.monthsOfService.toFixed(0)}m)` : item.riskStatus}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-medium">({item.riskPercentage}% risco)</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {decimoTerceiroData.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center text-slate-500 py-10 font-semibold">
                                                    Nenhum colaborador encontrado.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {/* Summary Row */}
                                        {decimoTerceiroData.length > 0 && (
                                            <TableRow className="bg-slate-50 font-bold hover:bg-slate-50 border-t-2 border-slate-200">
                                                <TableCell colSpan={2} className="text-slate-900">Total</TableCell>
                                                <TableCell className="text-center"></TableCell>
                                                <TableCell className="text-right text-slate-950">
                                                    R$ {decimoTerceiroTotals.totalAcumuladoLiquido.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-slate-600 italic">
                                                    R$ {decimoTerceiroTotals.totalEncargos.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-blue-600">
                                                    R$ {decimoTerceiroTotals.totalPrimeira.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-slate-950">
                                                    R$ {decimoTerceiroTotals.totalSegunda.toFixed(2)}
                                                </TableCell>
                                                <TableCell></TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
