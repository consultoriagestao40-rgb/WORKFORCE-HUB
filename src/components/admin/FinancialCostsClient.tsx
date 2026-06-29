"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, DollarSign, Users, AlertTriangle, TrendingUp, TrendingDown, Info, Search, ShieldAlert, Award, ExternalLink, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
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
    company?: { id: string; name: string } | null;
    insalubridade?: number;
    periculosidade?: number;
    gratificacao?: number;
    outrosAdicionais?: number;
    valeAlimentacao?: number;
    valeTransporte?: number;
    assignments?: {
        id: string;
        posto: {
            id: string;
            client: {
                id: string;
                name: string;
            } | null;
        } | null;
    }[];
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
const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
export function FinancialCostsClient({
    employees,
    averageStayMonths,
    userRole
}: FinancialCostsClientProps) {
    const [activeTab, setActiveTab] = useState("ferias");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedContract, setSelectedContract] = useState<string>("ALL");
    const [viewMode, setViewMode] = useState<"colaborador" | "contrato" | "empresa">("colaborador");
    const [sortField, setSortField] = useState<string>("name");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
    };
    
    const contractOptions = useMemo(() => {
        const contracts = new Set<string>();
        employees.forEach(emp => {
            const clientName = emp.assignments?.[0]?.posto?.client?.name;
            if (clientName) {
                contracts.add(clientName);
            }
        });
        const hasReserva = employees.some(emp => !emp.assignments || emp.assignments.length === 0 || !emp.assignments[0]?.posto?.client);
        const options = Array.from(contracts).sort();
        if (hasReserva) {
            options.push("Reserva Técnica");
        }
        return options;
    }, [employees]);
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

            const clientName = emp.assignments?.[0]?.posto?.client?.name || "Reserva Técnica";

            const companyName = emp.company?.name || "Sem Empresa";

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
                type: emp.type,
                contractName: clientName,
                companyName
            };
        }).filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.role.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesContract = selectedContract === "ALL" || item.contractName === selectedContract;
            return matchesSearch && matchesContract;
        }).sort((a, b) => {
            let valA = a[sortField as keyof typeof a];
            let valB = b[sortField as keyof typeof b];

            if (valA === undefined || valA === null) valA = "" as any;
            if (valB === undefined || valB === null) valB = "" as any;

            if (typeof valA === "string" && typeof valB === "string") {
                return sortDirection === "asc" 
                    ? valA.localeCompare(valB) 
                    : valB.localeCompare(valA);
            }

            if ((valA as any) instanceof Date && (valB as any) instanceof Date) {
                return sortDirection === "asc"
                    ? (valA as any).getTime() - (valB as any).getTime()
                    : (valB as any).getTime() - (valA as any).getTime();
            }

            return sortDirection === "asc"
                ? (valA as number) - (valB as number)
                : (valB as number) - (valA as number);
        });
    }, [employees, taxRate, today, searchTerm, selectedContract, sortField, sortDirection]);

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

            const clientName = emp.assignments?.[0]?.posto?.client?.name || "Reserva Técnica";

            const companyName = emp.company?.name || "Sem Empresa";

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
                type: emp.type,
                contractName: clientName,
                companyName,
                salary: emp.salary
            };
        }).filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.role.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesContract = selectedContract === "ALL" || item.contractName === selectedContract;
            return matchesSearch && matchesContract;
        }).sort((a, b) => {
            let valA = a[sortField as keyof typeof a];
            let valB = b[sortField as keyof typeof b];

            if (valA === undefined || valA === null) valA = "" as any;
            if (valB === undefined || valB === null) valB = "" as any;

            if (typeof valA === "string" && typeof valB === "string") {
                return sortDirection === "asc" 
                    ? valA.localeCompare(valB) 
                    : valB.localeCompare(valA);
            }

            if ((valA as any) instanceof Date && (valB as any) instanceof Date) {
                return sortDirection === "asc"
                    ? (valA as any).getTime() - (valB as any).getTime()
                    : (valB as any).getTime() - (valA as any).getTime();
            }

            return sortDirection === "asc"
                ? (valA as number) - (valB as number)
                : (valB as number) - (valA as number);
        });
    }, [employees, firstDayOfCurrentYear, today, currentYear, averageStayMonths, searchTerm, selectedContract, sortField, sortDirection]);

    const decimoTerceiroTotals = useMemo(() => {
        return decimoTerceiroData.reduce(
            (acc, item) => {
                acc.totalSalary += item.salary;
                acc.totalAcumulado += item.valorAcumulado;
                acc.totalAcumuladoLiquido += item.valorAcumuladoLiquido;
                acc.totalPrimeira += item.primeiraParcela;
                acc.totalSegunda += item.segundaParcela;
                acc.totalEncargos += item.totalAnualBruto * (taxRate / 100);
                acc.totalEncargosAcumulado += item.valorAcumulado * (taxRate / 100);
                return acc;
            },
            { 
                totalSalary: 0,
                totalAcumulado: 0, 
                totalAcumuladoLiquido: 0, 
                totalPrimeira: 0, 
                totalSegunda: 0, 
                totalEncargos: 0, 
                totalEncargosAcumulado: 0 
            }
        );
    }, [decimoTerceiroData, taxRate]);

    // Lógica e Cálculos de Folha de Pagamento
    const folhaData = useMemo(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

        return employees.map(emp => {
            const admission = new Date(emp.admissionDate);
            let salary = emp.salary || 0;
            let insalubridade = emp.insalubridade || 0;
            let periculosidade = emp.periculosidade || 0;
            let gratificacao = emp.gratificacao || 0;
            let outrosAdicionais = emp.outrosAdicionais || 0;

            // Check if admitted in the current month & year
            const isAdmittedThisMonth = admission.getFullYear() === today.getFullYear() && admission.getMonth() === today.getMonth();
            
            let daysWorked = totalDaysInMonth;
            let vtDays = 22;

            if (isAdmittedThisMonth) {
                daysWorked = totalDaysInMonth - admission.getDate() + 1;
                salary = (salary / totalDaysInMonth) * daysWorked;
                insalubridade = (insalubridade / totalDaysInMonth) * daysWorked;
                periculosidade = (periculosidade / totalDaysInMonth) * daysWorked;
                gratificacao = (gratificacao / totalDaysInMonth) * daysWorked;
                outrosAdicionais = (outrosAdicionais / totalDaysInMonth) * daysWorked;
                
                // Pro-rata of 22 days worked
                vtDays = Math.round((daysWorked / totalDaysInMonth) * 22);
            }

            const totalAdicionais = insalubridade + periculosidade + gratificacao + outrosAdicionais;
            const remuneracaoTotal = salary + totalAdicionais;

            // VT Intelligent Calculation (Daily vs Monthly detection)
            let vtDiario = 12;
            let vtMensal = 264; // Default: 12 * 22

            if (emp.valeTransporte !== undefined && emp.valeTransporte !== null && emp.valeTransporte > 0) {
                if (emp.valeTransporte <= 100) {
                    vtDiario = emp.valeTransporte;
                    vtMensal = vtDiario * vtDays;
                } else {
                    // It is already a monthly value registered
                    vtMensal = isAdmittedThisMonth ? (emp.valeTransporte / totalDaysInMonth) * daysWorked : emp.valeTransporte;
                    vtDiario = emp.valeTransporte / 22;
                }
            } else {
                // Default R$ 12 per day worked
                vtMensal = vtDiario * vtDays;
            }

            // VA Intelligent Calculation (Daily vs Monthly detection)
            let vaDiario = 0;
            let vaMensal = 0;

            if (emp.valeAlimentacao !== undefined && emp.valeAlimentacao !== null && emp.valeAlimentacao > 0) {
                if (emp.valeAlimentacao <= 100) {
                    vaDiario = emp.valeAlimentacao;
                    vaMensal = vaDiario * (isAdmittedThisMonth ? vtDays : 22);
                } else {
                    // It is a monthly value registered
                    vaMensal = isAdmittedThisMonth ? (emp.valeAlimentacao / totalDaysInMonth) * daysWorked : emp.valeAlimentacao;
                    vaDiario = emp.valeAlimentacao / 22;
                }
            }

            // Custo Total Sem encargos sociais
            const totalCustoMensal = remuneracaoTotal + vtMensal + vaMensal;

            const clientName = emp.assignments?.[0]?.posto?.client?.name || "Reserva Técnica";
            const companyName = emp.company?.name || "Sem Empresa";

            return {
                id: emp.id,
                name: emp.name,
                role: emp.role?.name || "-",
                salary,
                insalubridade,
                periculosidade,
                gratificacao,
                outrosAdicionais,
                totalAdicionais,
                remuneracaoTotal,
                vtDiario,
                vtMensal,
                vaDiario,
                vaMensal,
                totalCustoMensal,
                contractName: clientName,
                companyName
            };
        }).filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.role.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesContract = selectedContract === "ALL" || item.contractName === selectedContract;
            return matchesSearch && matchesContract;
        }).sort((a, b) => {
            let valA = a[sortField as keyof typeof a];
            let valB = b[sortField as keyof typeof b];

            if (valA === undefined || valA === null) valA = "" as any;
            if (valB === undefined || valB === null) valB = "" as any;

            if (typeof valA === "string" && typeof valB === "string") {
                return sortDirection === "asc" 
                    ? valA.localeCompare(valB) 
                    : valB.localeCompare(valA);
            }

            if ((valA as any) instanceof Date && (valB as any) instanceof Date) {
                return sortDirection === "asc"
                    ? (valA as any).getTime() - (valB as any).getTime()
                    : (valB as any).getTime() - (valA as any).getTime();
            }

            return sortDirection === "asc"
                ? (valA as number) - (valB as number)
                : (valB as number) - (valA as number);
        });
    }, [employees, searchTerm, selectedContract, sortField, sortDirection]);

    const folhaTotals = useMemo(() => {
        return folhaData.reduce(
            (acc, item) => {
                acc.totalSalary += item.salary;
                acc.totalAdicionais += item.totalAdicionais;
                acc.totalRemuneracao += item.remuneracaoTotal;
                acc.totalVT += item.vtMensal;
                acc.totalVA += item.vaMensal;
                acc.totalCusto += item.totalCustoMensal;
                return acc;
            },
            {
                totalSalary: 0,
                totalAdicionais: 0,
                totalRemuneracao: 0,
                totalVT: 0,
                totalVA: 0,
                totalCusto: 0
            }
        );
    }, [folhaData]);

    // Agrupamento por Contrato - Folha
    const folhaGroupedByContract = useMemo(() => {
        const groups: Record<string, {
            type: string;
            count: number;
            totalSalary: number;
            totalAdicionais: number;
            totalRemuneracao: number;
            totalVT: number;
            totalVA: number;
            totalCusto: number;
        }> = {};

        folhaData.forEach(item => {
            const contractKey = item.contractName || "Reserva Técnica";
            if (!groups[contractKey]) {
                groups[contractKey] = {
                    type: contractKey,
                    count: 0,
                    totalSalary: 0,
                    totalAdicionais: 0,
                    totalRemuneracao: 0,
                    totalVT: 0,
                    totalVA: 0,
                    totalCusto: 0
                };
            }
            groups[contractKey].count += 1;
            groups[contractKey].totalSalary += item.salary;
            groups[contractKey].totalAdicionais += item.totalAdicionais;
            groups[contractKey].totalRemuneracao += item.remuneracaoTotal;
            groups[contractKey].totalVT += item.vtMensal;
            groups[contractKey].totalVA += item.vaMensal;
            groups[contractKey].totalCusto += item.totalCustoMensal;
        });

        return Object.values(groups).sort((a, b) => a.type.localeCompare(b.type));
    }, [folhaData]);

    // Agrupamento por Empresa - Folha
    const folhaGroupedByCompany = useMemo(() => {
        const groups: Record<string, {
            type: string;
            count: number;
            totalSalary: number;
            totalAdicionais: number;
            totalRemuneracao: number;
            totalVT: number;
            totalVA: number;
            totalCusto: number;
        }> = {};

        folhaData.forEach(item => {
            const companyKey = item.companyName || "Sem Empresa";
            if (!groups[companyKey]) {
                groups[companyKey] = {
                    type: companyKey,
                    count: 0,
                    totalSalary: 0,
                    totalAdicionais: 0,
                    totalRemuneracao: 0,
                    totalVT: 0,
                    totalVA: 0,
                    totalCusto: 0
                };
            }
            groups[companyKey].count += 1;
            groups[companyKey].totalSalary += item.salary;
            groups[companyKey].totalAdicionais += item.totalAdicionais;
            groups[companyKey].totalRemuneracao += item.remuneracaoTotal;
            groups[companyKey].totalVT += item.vtMensal;
            groups[companyKey].totalVA += item.vaMensal;
            groups[companyKey].totalCusto += item.totalCustoMensal;
        });

        return Object.values(groups).sort((a, b) => a.type.localeCompare(b.type));
    }, [folhaData]);

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
            const contractKey = item.contractName || "Reserva Técnica";
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

        return Object.values(groups).sort((a, b) => a.type.localeCompare(b.type));
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
            const contractKey = item.contractName || "Reserva Técnica";
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

        return Object.values(groups).sort((a, b) => a.type.localeCompare(b.type));
    }, [decimoTerceiroData, taxRate]);

    // Agrupamento por Empresa - Férias
    const feriasGroupedByCompany = useMemo(() => {
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
            const companyKey = item.companyName || "Sem Empresa";
            if (!groups[companyKey]) {
                groups[companyKey] = {
                    type: companyKey,
                    count: 0,
                    totalDays: 0,
                    proporcionalVal: 0,
                    thirdConstitucional: 0,
                    incidentesLegais: 0,
                    totalVal: 0
                };
            }
            groups[companyKey].count += 1;
            groups[companyKey].totalDays += item.daysAccrued;
            groups[companyKey].proporcionalVal += item.proporcionalVal;
            groups[companyKey].thirdConstitucional += item.thirdConstitucional;
            groups[companyKey].incidentesLegais += item.incidentesLegais;
            groups[companyKey].totalVal += item.totalVal;
        });

        return Object.values(groups).sort((a, b) => a.type.localeCompare(b.type));
    }, [feriasData]);

    // Agrupamento por Empresa - 13º
    const decimoGroupedByCompany = useMemo(() => {
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
            const companyKey = item.companyName || "Sem Empresa";
            if (!groups[companyKey]) {
                groups[companyKey] = {
                    type: companyKey,
                    count: 0,
                    totalAcumuladoLiquido: 0,
                    totalEncargos: 0,
                    totalEncargosAcumulado: 0,
                    totalPrimeira: 0,
                    totalSegunda: 0
                };
            }
            groups[companyKey].count += 1;
            groups[companyKey].totalAcumuladoLiquido += item.valorAcumuladoLiquido;
            groups[companyKey].totalEncargos += item.totalAnualBruto * (taxRate / 100);
            groups[companyKey].totalEncargosAcumulado += item.valorAcumulado * (taxRate / 100);
            groups[companyKey].totalPrimeira += item.primeiraParcela;
            groups[companyKey].totalSegunda += item.segundaParcela;
        });

        return Object.values(groups).sort((a, b) => a.type.localeCompare(b.type));
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
                            <SelectItem value="contrato">Por Cliente / Contrato</SelectItem>
                            <SelectItem value="empresa">Por Empresa (Minhas Empresas)</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={selectedContract} onValueChange={setSelectedContract}>
                        <SelectTrigger className="w-[200px] h-10 text-xs font-semibold bg-white border-slate-200 text-slate-700">
                            <SelectValue placeholder="Filtrar por Contrato" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos os Contratos</SelectItem>
                            {contractOptions.map(name => (
                                <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
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
                        <TabsTrigger value="folha" className="px-4 py-2 text-xs font-bold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            Folha de Pagamento
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

                    <Card className="border-none shadow-premium bg-white overflow-hidden">
                        <div className="w-full overflow-x-auto">
                            {viewMode === "contrato" && (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-800">Cliente / Contrato</TableHead>
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
                                                    {formatCurrency(group.proporcionalVal)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    {formatCurrency(group.thirdConstitucional)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-600 italic">
                                                    {formatCurrency(group.incidentesLegais)}
                                                </TableCell>
                                                <TableCell className="text-right font-extrabold text-slate-900 text-sm">
                                                    {formatCurrency(group.totalVal)}
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
                                                    {formatCurrency(feriasGroupedByContract.reduce((s, g) => s + g.proporcionalVal, 0))}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(feriasGroupedByContract.reduce((s, g) => s + g.thirdConstitucional, 0))}
                                                </TableCell>
                                                <TableCell className="text-right italic">
                                                    {formatCurrency(feriasGroupedByContract.reduce((s, g) => s + g.incidentesLegais, 0))}
                                                </TableCell>
                                                <TableCell className="text-right text-emerald-700">
                                                    {formatCurrency(feriasTotals.totalValue)}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}

                            {viewMode === "empresa" && (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-800">Empresa</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Colaboradores Ativos</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Total Dias Acum.</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Férias Prop. (Total)</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">1/3 Const. (Total)</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Encargos ({taxRate}%)</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Total Provisionado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {feriasGroupedByCompany.map((group) => (
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
                                                    {formatCurrency(group.proporcionalVal)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    {formatCurrency(group.thirdConstitucional)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-600 italic">
                                                    {formatCurrency(group.incidentesLegais)}
                                                </TableCell>
                                                <TableCell className="text-right font-extrabold text-slate-900 text-sm">
                                                    {formatCurrency(group.totalVal)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {feriasGroupedByCompany.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center text-slate-500 py-10 font-semibold">
                                                    Nenhuma empresa encontrada.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {/* Grouped Totals Row */}
                                        {feriasGroupedByCompany.length > 0 && (
                                            <TableRow className="bg-slate-100 font-black border-t-2 border-slate-200">
                                                <TableCell>Total Geral</TableCell>
                                                <TableCell className="text-center">{feriasData.length} colaboradores</TableCell>
                                                <TableCell className="text-center">{feriasTotals.totalDays.toFixed(1)} dias</TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(feriasGroupedByCompany.reduce((s, g) => s + g.proporcionalVal, 0))}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(feriasGroupedByCompany.reduce((s, g) => s + g.thirdConstitucional, 0))}
                                                </TableCell>
                                                <TableCell className="text-right italic">
                                                    {formatCurrency(feriasGroupedByCompany.reduce((s, g) => s + g.incidentesLegais, 0))}
                                                </TableCell>
                                                <TableCell className="text-right text-emerald-700">
                                                    {formatCurrency(feriasTotals.totalValue)}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}

                            {viewMode === "colaborador" && (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead 
                                                className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                                                onClick={() => handleSort("name")}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Colaborador
                                                    {sortField === "name" && (
                                                        sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead className="font-bold text-slate-800">Admissão</TableHead>
                                            <TableHead 
                                                className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-colors select-none text-right"
                                                onClick={() => handleSort("salary")}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Salário Base
                                                    {sortField === "salary" && (
                                                        sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead className="font-bold text-slate-800">Início Período Aquis.</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Meses Acum.</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Dias Devidos</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Férias Prop.</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">1/3 Const.</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Encargos ({taxRate}%)</TableHead>
                                            <TableHead 
                                                className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-colors select-none text-right"
                                                onClick={() => handleSort("totalVal")}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Total Acumulado
                                                    {sortField === "totalVal" && (
                                                        sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                                    )}
                                                </div>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {feriasData.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <Link href={`/admin/employees/${item.id}?backTo=/admin/financial-costs`} className="hover:text-primary transition-colors flex items-center gap-1.5 group w-fit">
                                                            <span className="font-bold text-slate-900 group-hover:text-primary transition-colors">{item.name}</span>
                                                            <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-primary transition-colors shrink-0" />
                                                        </Link>
                                                        <span className="text-[10px] text-slate-400">{item.role}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-slate-600 text-xs">
                                                    {item.admissionDate.toLocaleDateString("pt-BR")}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700 font-semibold">
                                                    {formatCurrency(item.salary)}
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
                                                    {formatCurrency(item.proporcionalVal)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    {formatCurrency(item.thirdConstitucional)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-600 italic">
                                                    {formatCurrency(item.incidentesLegais)}
                                                </TableCell>
                                                <TableCell className="text-right font-extrabold text-slate-900 text-xs">
                                                    {formatCurrency(item.totalVal)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {feriasData.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={10} className="text-center text-slate-500 py-10 font-semibold">
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

                    <Card className="border-none shadow-premium bg-white overflow-hidden">
                        <div className="w-full overflow-x-auto">
                            {viewMode === "contrato" && (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-800">Cliente / Contrato</TableHead>
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
                                                    {formatCurrency(group.totalAcumuladoLiquido)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-600 italic">
                                                    {formatCurrency(group.totalEncargos)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-blue-600 font-bold">
                                                    {formatCurrency(group.totalPrimeira)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-800 font-bold">
                                                    {formatCurrency(group.totalSegunda)}
                                                </TableCell>
                                                <TableCell className="text-right font-extrabold text-emerald-700 text-sm">
                                                    {formatCurrency(group.totalPrimeira + group.totalSegunda + group.totalEncargos)}
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
                                                    {formatCurrency(decimoTerceiroTotals.totalAcumuladoLiquido)}
                                                </TableCell>
                                                <TableCell className="text-right italic">
                                                    {formatCurrency(decimoTerceiroTotals.totalEncargos)}
                                                </TableCell>
                                                <TableCell className="text-right text-blue-600">
                                                    {formatCurrency(decimoTerceiroTotals.totalPrimeira)}
                                                </TableCell>
                                                <TableCell className="text-right text-slate-950">
                                                    {formatCurrency(decimoTerceiroTotals.totalSegunda)}
                                                </TableCell>
                                                <TableCell className="text-right text-emerald-700">
                                                    {formatCurrency(decimoTerceiroTotals.totalPrimeira + decimoTerceiroTotals.totalSegunda + decimoTerceiroTotals.totalEncargos)}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}

                            {viewMode === "empresa" && (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-800">Empresa</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Colaboradores Ativos</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">13º Líquido Acum.</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Encargos s/ 13º ({taxRate}%)</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">1ª Parcela (50% Bruto)</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">2ª Parcela (Est. Líquida)</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Custo Total Previsto</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {decimoGroupedByCompany.map((group) => (
                                            <TableRow key={group.type} className="hover:bg-slate-50/50 font-medium">
                                                <TableCell className="font-bold text-slate-900 text-sm">
                                                    {group.type}
                                                </TableCell>
                                                <TableCell className="text-center text-xs text-slate-800">
                                                    {group.count} colaboradores
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    {formatCurrency(group.totalAcumuladoLiquido)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-600 italic">
                                                    {formatCurrency(group.totalEncargos)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-blue-600 font-bold">
                                                    {formatCurrency(group.totalPrimeira)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-800 font-bold">
                                                    {formatCurrency(group.totalSegunda)}
                                                </TableCell>
                                                <TableCell className="text-right font-extrabold text-emerald-700 text-sm">
                                                    {formatCurrency(group.totalPrimeira + group.totalSegunda + group.totalEncargos)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {decimoGroupedByCompany.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center text-slate-500 py-10 font-semibold">
                                                    Nenhuma empresa encontrada.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {/* Grouped Totals Row */}
                                        {decimoGroupedByCompany.length > 0 && (
                                            <TableRow className="bg-slate-100 font-black border-t-2 border-slate-200">
                                                <TableCell>Total Geral</TableCell>
                                                <TableCell className="text-center">{decimoTerceiroData.length} colaboradores</TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(decimoTerceiroTotals.totalAcumuladoLiquido)}
                                                </TableCell>
                                                <TableCell className="text-right italic">
                                                    {formatCurrency(decimoTerceiroTotals.totalEncargos)}
                                                </TableCell>
                                                <TableCell className="text-right text-blue-600">
                                                    {formatCurrency(decimoTerceiroTotals.totalPrimeira)}
                                                </TableCell>
                                                <TableCell className="text-right text-slate-950">
                                                    {formatCurrency(decimoTerceiroTotals.totalSegunda)}
                                                </TableCell>
                                                <TableCell className="text-right text-emerald-700">
                                                    {formatCurrency(decimoTerceiroTotals.totalPrimeira + decimoTerceiroTotals.totalSegunda + decimoTerceiroTotals.totalEncargos)}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}

                            {viewMode === "colaborador" && (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead 
                                                className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                                                onClick={() => handleSort("name")}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Colaborador
                                                    {sortField === "name" && (
                                                        sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead className="font-bold text-slate-800">Admissão</TableHead>
                                            <TableHead 
                                                className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-colors select-none text-right"
                                                onClick={() => handleSort("salary")}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Salário Base
                                                    {sortField === "salary" && (
                                                        sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Meses Trabalhados</TableHead>
                                            <TableHead 
                                                className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-colors select-none text-right"
                                                onClick={() => handleSort("valorAcumuladoLiquido")}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    13º Líquido Acum.
                                                    {sortField === "valorAcumuladoLiquido" && (
                                                        sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                                    )}
                                                </div>
                                            </TableHead>
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
                                                            <Link href={`/admin/employees/${item.id}?backTo=/admin/financial-costs`} className="hover:text-primary transition-colors flex items-center gap-1.5 group w-fit">
                                                                <span className="font-bold text-slate-900 group-hover:text-primary transition-colors">{item.name}</span>
                                                                <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-primary transition-colors shrink-0" />
                                                            </Link>
                                                            <span className="text-[10px] text-slate-400">{item.role}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-slate-600 text-xs">
                                                        {item.admissionDate.toLocaleDateString("pt-BR")}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-slate-700 font-semibold">
                                                        {formatCurrency(item.salary)}
                                                    </TableCell>
                                                    <TableCell className="text-center font-semibold text-slate-800 text-xs">
                                                        {item.monthsInYear} / 12
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs font-semibold text-slate-700">
                                                        {formatCurrency(item.valorAcumuladoLiquido)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-slate-600 italic">
                                                        {formatCurrency(item.totalAnualBruto * (taxRate / 100))}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-blue-600 font-bold">
                                                        {formatCurrency(item.primeiraParcela)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-slate-800 font-bold">
                                                        {formatCurrency(item.segundaParcela)}
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
                                                <TableCell colSpan={9} className="text-center text-slate-500 py-10 font-semibold">
                                                    Nenhum colaborador encontrado.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {/* Summary Row */}
                                        {decimoTerceiroData.length > 0 && (
                                            <TableRow className="bg-slate-50 font-bold hover:bg-slate-50 border-t-2 border-slate-200">
                                                <TableCell colSpan={2} className="text-slate-900">Total</TableCell>
                                                <TableCell className="text-right text-slate-950">{formatCurrency(decimoTerceiroTotals.totalSalary)}</TableCell>
                                                <TableCell className="text-center"></TableCell>
                                                <TableCell className="text-right text-slate-950">
                                                    {formatCurrency(decimoTerceiroTotals.totalAcumuladoLiquido)}
                                                </TableCell>
                                                <TableCell className="text-right text-slate-600 italic">
                                                    {formatCurrency(decimoTerceiroTotals.totalEncargos)}
                                                </TableCell>
                                                <TableCell className="text-right text-blue-600">
                                                    {formatCurrency(decimoTerceiroTotals.totalPrimeira)}
                                                </TableCell>
                                                <TableCell className="text-right text-slate-950">
                                                    {formatCurrency(decimoTerceiroTotals.totalSegunda)}
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

                <TabsContent value="folha" className="space-y-6 pt-4">
                    <div className="space-y-4">
                        {/* Linha 1: Destaques (Custo Total e Ativos) */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <Card className="lg:col-span-2 border-none shadow-premium bg-gradient-to-br from-indigo-600 to-blue-700 text-white">
                                <CardHeader className="pb-2">
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Custo Mensal Total da Operação (Massa + Benefícios)</CardDescription>
                                    <CardTitle className="text-3xl font-black flex items-center justify-between">
                                        <span>{formatCurrency(folhaTotals.totalCusto)}</span>
                                        <DollarSign className="w-8 h-8 text-indigo-200" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-wider">
                                        Salários + Adicionais (Pro-rata de admissão se aplicável) + VT (Previsão 22 dias) + VA (Mensal do cadastro)
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50">
                                <CardHeader className="pb-2">
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Colaboradores Ativos</CardDescription>
                                    <CardTitle className="text-3xl font-black text-slate-900 flex items-center justify-between">
                                        <span>{folhaData.length} ativos</span>
                                        <Users className="w-6 h-6 text-indigo-500" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
                                        Base de cálculo da folha
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Linha 2: Detalhamento por categoria */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50">
                                <CardHeader className="pb-2">
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Massa Salarial Base</CardDescription>
                                    <CardTitle className="text-xl font-extrabold text-slate-900 flex items-center justify-between">
                                        <span>{formatCurrency(folhaTotals.totalSalary)}</span>
                                        <Calendar className="w-5 h-5 text-blue-500" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
                                        Salários contratuais (pro-rata no mês de admissão)
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50">
                                <CardHeader className="pb-2">
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adicionais Salariais</CardDescription>
                                    <CardTitle className="text-xl font-extrabold text-slate-900 flex items-center justify-between">
                                        <span>{formatCurrency(folhaTotals.totalAdicionais)}</span>
                                        <DollarSign className="w-5 h-5 text-slate-400" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
                                        Insalubridade, Periculosidade e Gratificações
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50">
                                <CardHeader className="pb-2">
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Previsão Mensal VT</CardDescription>
                                    <CardTitle className="text-xl font-extrabold text-blue-600 flex items-center justify-between">
                                        <span>{formatCurrency(folhaTotals.totalVT)}</span>
                                        <DollarSign className="w-5 h-5" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
                                        VT no cadastro (ou padrão R$ 12/dia)
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50">
                                <CardHeader className="pb-2">
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Previsão Mensal VA</CardDescription>
                                    <CardTitle className="text-xl font-extrabold text-slate-900 flex items-center justify-between">
                                        <span>{formatCurrency(folhaTotals.totalVA)}</span>
                                        <TrendingDown className="w-5 h-5 text-red-500" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
                                        VA real cadastrado nos colaboradores
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-premium bg-gradient-to-br from-white to-slate-50/50">
                                <CardHeader className="pb-2">
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">Média por Colaborador</CardDescription>
                                    <CardTitle className="text-xl font-extrabold text-slate-900 flex items-center justify-between">
                                        <span>{formatCurrency(folhaTotals.totalCusto / (folhaData.length || 1))}</span>
                                        <Users className="w-5 h-5 text-indigo-500" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
                                        Custo médio mensal por cabeça
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <Card className="border-none shadow-premium bg-white overflow-hidden">
                        <div className="w-full overflow-x-auto">
                            {viewMode === "contrato" && (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-800">Cliente / Contrato</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Colaboradores</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Salários Base</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Adicionais</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Remuneração Total</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Previsão VT</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Previsão VA</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Custo Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {folhaGroupedByContract.map((group) => (
                                            <TableRow key={group.type} className="hover:bg-slate-50/50 font-medium">
                                                <TableCell className="font-bold text-slate-900 text-sm">
                                                    {group.type}
                                                </TableCell>
                                                <TableCell className="text-center text-xs text-slate-800">
                                                    {group.count} colaboradores
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    {formatCurrency(group.totalSalary)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    {formatCurrency(group.totalAdicionais)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-900 font-bold">
                                                    {formatCurrency(group.totalRemuneracao)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    {formatCurrency(group.totalVT)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    {formatCurrency(group.totalVA)}
                                                </TableCell>
                                                <TableCell className="text-right font-extrabold text-emerald-700 text-sm">
                                                    {formatCurrency(group.totalCusto)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {folhaGroupedByContract.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center text-slate-500 py-10 font-semibold">
                                                    Nenhum contrato encontrado.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {folhaGroupedByContract.length > 0 && (
                                            <TableRow className="bg-slate-100 font-black border-t-2 border-slate-200">
                                                <TableCell>Total Geral</TableCell>
                                                <TableCell className="text-center">{folhaData.length} colaboradores</TableCell>
                                                <TableCell className="text-right">{formatCurrency(folhaTotals.totalSalary)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(folhaTotals.totalAdicionais)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(folhaTotals.totalRemuneracao)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(folhaTotals.totalVT)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(folhaTotals.totalVA)}</TableCell>
                                                <TableCell className="text-right text-emerald-700">{formatCurrency(folhaTotals.totalCusto)}</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}

                            {viewMode === "empresa" && (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-800">Empresa</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-center">Colaboradores</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Salários Base</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Adicionais</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Remuneração Total</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Previsão VT</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Previsão VA</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Custo Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {folhaGroupedByCompany.map((group) => (
                                            <TableRow key={group.type} className="hover:bg-slate-50/50 font-medium">
                                                <TableCell className="font-bold text-slate-900 text-sm">
                                                    {group.type}
                                                </TableCell>
                                                <TableCell className="text-center text-xs text-slate-800">
                                                    {group.count} colaboradores
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    {formatCurrency(group.totalSalary)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    {formatCurrency(group.totalAdicionais)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-900 font-bold">
                                                    {formatCurrency(group.totalRemuneracao)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    {formatCurrency(group.totalVT)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    {formatCurrency(group.totalVA)}
                                                </TableCell>
                                                <TableCell className="text-right font-extrabold text-emerald-700 text-sm">
                                                    {formatCurrency(group.totalCusto)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {folhaGroupedByCompany.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center text-slate-500 py-10 font-semibold">
                                                    Nenhuma empresa encontrada.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {folhaGroupedByCompany.length > 0 && (
                                            <TableRow className="bg-slate-100 font-black border-t-2 border-slate-200">
                                                <TableCell>Total Geral</TableCell>
                                                <TableCell className="text-center">{folhaData.length} colaboradores</TableCell>
                                                <TableCell className="text-right">{formatCurrency(folhaTotals.totalSalary)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(folhaTotals.totalAdicionais)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(folhaTotals.totalRemuneracao)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(folhaTotals.totalVT)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(folhaTotals.totalVA)}</TableCell>
                                                <TableCell className="text-right text-emerald-700">{formatCurrency(folhaTotals.totalCusto)}</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}

                            {viewMode === "colaborador" && (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead 
                                                className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                                                onClick={() => handleSort("name")}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Colaborador
                                                    {sortField === "name" && (
                                                        sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead 
                                                className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-colors select-none text-right"
                                                onClick={() => handleSort("salary")}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Salário Base
                                                    {sortField === "salary" && (
                                                        sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Adicionais</TableHead>
                                            <TableHead className="font-bold text-slate-800 text-right">Remuneração Total</TableHead>
                                            <TableHead 
                                                className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-colors select-none text-center"
                                                onClick={() => handleSort("vtMensal")}
                                            >
                                                <div className="flex items-center justify-center gap-1">
                                                    Vale Transporte (VT)
                                                    {sortField === "vtMensal" && (
                                                        sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead 
                                                className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-colors select-none text-center"
                                                onClick={() => handleSort("vaMensal")}
                                            >
                                                <div className="flex items-center justify-center gap-1">
                                                    Vale Alimentação (VA)
                                                    {sortField === "vaMensal" && (
                                                        sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead 
                                                className="font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-colors select-none text-right"
                                                onClick={() => handleSort("totalCustoMensal")}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Custo Mensal
                                                    {sortField === "totalCustoMensal" && (
                                                        sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                                    )}
                                                </div>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {folhaData.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                         <Link href={`/admin/employees/${item.id}?backTo=/admin/financial-costs`} className="hover:text-primary transition-colors flex items-center gap-1.5 group w-fit">
                                                             <span className="font-bold text-slate-900 group-hover:text-primary transition-colors">{item.name}</span>
                                                             <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-primary transition-colors shrink-0" />
                                                         </Link>
                                                        <span className="text-[10px] text-slate-400">{item.role}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-700">
                                                    {formatCurrency(item.salary)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-slate-800 font-medium">{formatCurrency(item.totalAdicionais)}</span>
                                                        {item.totalAdicionais > 0 && (
                                                            <span className="text-[9px] text-slate-400">
                                                                {[
                                                                    item.insalubridade > 0 && `Insal.: ${formatCurrency(item.insalubridade)}`,
                                                                    item.periculosidade > 0 && `Peric.: ${formatCurrency(item.periculosidade)}`,
                                                                    item.gratificacao > 0 && `Gratif.: ${formatCurrency(item.gratificacao)}`,
                                                                    item.outrosAdicionais > 0 && `Outros: ${formatCurrency(item.outrosAdicionais)}`
                                                                ].filter(Boolean).join(" | ")}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-slate-900 font-bold">
                                                    {formatCurrency(item.remuneracaoTotal)}
                                                </TableCell>
                                                <TableCell className="text-center text-xs">
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-800 font-medium">{formatCurrency(item.vtMensal)}</span>
                                                        <span className="text-[9px] text-slate-400">({formatCurrency(item.vtDiario)}/dia)</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center text-xs">
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-800 font-medium">{formatCurrency(item.vaMensal)}</span>
                                                        <span className="text-[9px] text-slate-400">({formatCurrency(item.vaDiario)}/dia)</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-extrabold text-slate-900 text-xs">
                                                    {formatCurrency(item.totalCustoMensal)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {folhaData.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center text-slate-500 py-10 font-semibold">
                                                    Nenhum colaborador encontrado.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {folhaData.length > 0 && (
                                            <TableRow className="bg-slate-50 font-bold hover:bg-slate-50 border-t-2 border-slate-200">
                                                <TableCell className="text-slate-900">Total</TableCell>
                                                <TableCell className="text-right text-slate-950">{formatCurrency(folhaTotals.totalSalary)}</TableCell>
                                                <TableCell className="text-right text-slate-950">{formatCurrency(folhaTotals.totalAdicionais)}</TableCell>
                                                <TableCell className="text-right text-slate-950">{formatCurrency(folhaTotals.totalRemuneracao)}</TableCell>
                                                <TableCell className="text-center text-slate-950">{formatCurrency(folhaTotals.totalVT)}</TableCell>
                                                <TableCell className="text-center text-slate-950">{formatCurrency(folhaTotals.totalVA)}</TableCell>
                                                <TableCell className="text-right text-emerald-700">{formatCurrency(folhaTotals.totalCusto)}</TableCell>
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
