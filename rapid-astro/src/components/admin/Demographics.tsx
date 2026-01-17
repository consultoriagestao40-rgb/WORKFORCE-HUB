"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, XAxis, YAxis, Bar, Legend, CartesianGrid } from "recharts";
import { format, differenceInYears } from "date-fns";

interface Employee {
    id: string;
    birthDate: Date | string | null;
    admissionDate: Date | string;
    gender: string | null;
}

interface DemographicsProps {
    employees: Employee[];
}

const COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#64748b'];

export function Demographics({ employees }: DemographicsProps) {
    const stats = useMemo(() => {
        const now = new Date();

        // Gender Distribution
        const genderCounts: Record<string, number> = {};
        let genderTotal = 0;

        // Age Distribution
        const ageRanges = {
            "18-25": 0,
            "26-35": 0,
            "36-45": 0,
            "46-60": 0,
            "60+": 0
        };

        // Tenure Distribution
        const tenureRanges = {
            "< 1 Ano": 0,
            "1-3 Anos": 0,
            "3-5 Anos": 0,
            "5+ Anos": 0
        };

        employees.forEach(emp => {
            // Gender
            const g = emp.gender || "Não Informado";
            genderCounts[g] = (genderCounts[g] || 0) + 1;
            genderTotal++;

            // Age
            if (emp.birthDate) {
                const age = differenceInYears(now, new Date(emp.birthDate));
                if (age >= 18 && age <= 25) ageRanges["18-25"]++;
                else if (age >= 26 && age <= 35) ageRanges["26-35"]++;
                else if (age >= 36 && age <= 45) ageRanges["36-45"]++;
                else if (age >= 46 && age <= 60) ageRanges["46-60"]++;
                else if (age > 60) ageRanges["60+"]++;
            }

            // Tenure
            const tenure = differenceInYears(now, new Date(emp.admissionDate));
            if (tenure < 1) tenureRanges["< 1 Ano"]++;
            else if (tenure >= 1 && tenure < 3) tenureRanges["1-3 Anos"]++;
            else if (tenure >= 3 && tenure < 5) tenureRanges["3-5 Anos"]++;
            else tenureRanges["5+ Anos"]++;
        });

        return {
            genderArgs: Object.entries(genderCounts).map(([name, value]) => ({ name, value })),
            ageArgs: Object.entries(ageRanges).map(([name, value]) => ({ name, value })),
            tenureArgs: Object.entries(tenureRanges).map(([name, value]) => ({ name, value }))
        };
    }, [employees]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Gender Chart */}
            <Card className="border-none shadow-premium bg-white/50 backdrop-blur-md">
                <CardHeader>
                    <CardTitle className="text-lg font-black text-slate-800">Gênero</CardTitle>
                    <CardDescription className="text-xs font-bold uppercase tracking-widest text-slate-400">Distribuição da Equipe</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.genderArgs}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.genderArgs.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}
                                />
                                <Legend
                                    layout="horizontal"
                                    verticalAlign="bottom"
                                    align="center"
                                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Age Chart */}
            <Card className="border-none shadow-premium bg-white/50 backdrop-blur-md">
                <CardHeader>
                    <CardTitle className="text-lg font-black text-slate-800">Faixa Etária</CardTitle>
                    <CardDescription className="text-xs font-bold uppercase tracking-widest text-slate-400">Idade dos Colaboradores</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.ageArgs} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Tenure Chart */}
            <Card className="border-none shadow-premium bg-white/50 backdrop-blur-md">
                <CardHeader>
                    <CardTitle className="text-lg font-black text-slate-800">Tempo de Casa</CardTitle>
                    <CardDescription className="text-xs font-bold uppercase tracking-widest text-slate-400">Fidelidade e Retenção</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.tenureArgs} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }}
                                    width={70}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
