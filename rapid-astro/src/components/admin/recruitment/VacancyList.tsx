"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface Vacancy {
    id: string;
    title: string;
    status: string;
    priority: string;
    candidates: { id: string }[];
    role?: { name: string };
    posto?: { client: { name: string } };
    createdAt: Date;
}

interface VacancyListProps {
    vacancies: Vacancy[];
    onOpenCandidateModal: () => void;
}

export function VacancyList({ vacancies, onOpenCandidateModal }: VacancyListProps) {
    if (vacancies.length === 0) return null;

    return (
        <Card className="mb-6 border-l-4 border-l-indigo-500">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex justify-between items-center">
                    <span>Minhas Vagas Ativas</span>
                    <Button variant="ghost" size="sm" onClick={onOpenCandidateModal}>
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Candidato
                    </Button>
                </CardTitle>
                <CardDescription>Gerencie as vagas para as quais você está recrutando.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {vacancies.map((vacancy) => (
                        <div key={vacancy.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div>
                                <div className="font-semibold text-slate-800">{vacancy.title}</div>
                                <div className="text-sm text-slate-500">
                                    {vacancy.posto?.client?.name || "Sem cliente vinculado"} • {vacancy.role?.name || "Sem cargo"}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge variant={vacancy.priority === 'URGENT' ? 'destructive' : 'secondary'}>
                                    {vacancy.priority === 'URGENT' ? 'Urgente' : vacancy.priority === 'HIGH' ? 'Alta' : 'Normal'}
                                </Badge>
                                <div className="text-sm font-medium text-slate-600">
                                    {vacancy.candidates.length} candidatos
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
