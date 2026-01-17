"use client";

import { useState } from "react";
import { KanbanBoard } from "@/components/admin/recruitment/KanbanBoard";
import { VacancyModal } from "@/components/admin/recruitment/VacancyModal";
import { CandidateModal } from "@/components/admin/recruitment/CandidateModal";
import { VacancyList } from "@/components/admin/recruitment/VacancyList";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface RecruitmentClientPageProps {
    stages: any[];
    vacancies: any[];
    roles: any[];
    postos: any[];
    companies: any[];
    backlogs: any[];
    recruiters: any[];
}

export function RecruitmentClientPage({ stages, vacancies, roles, postos, companies, backlogs, recruiters }: RecruitmentClientPageProps) {
    const [isVacancyModalOpen, setIsVacancyModalOpen] = useState(false);
    const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Recrutamento e Seleção</h1>
                    <p className="text-slate-500">Gerencie suas vagas e pipeline de candidatos.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsCandidateModalOpen(true)}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Novo Candidato
                    </Button>
                    <Button onClick={() => setIsVacancyModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Vaga
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {/* Stats */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vagas Abertas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{vacancies.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Backlog (Gaps)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{backlogs.length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* <VacancyList /> removed as it is now integrated into Kanban R&S column */}

            <div className="h-[calc(100vh-280px)]">
                <KanbanBoard initialStages={stages} />
            </div>

            <VacancyModal
                open={isVacancyModalOpen}
                onOpenChange={setIsVacancyModalOpen}
                roles={roles}
                postos={postos}
                companies={companies}
                backlogs={backlogs}
                recruiters={recruiters}
            />

            <CandidateModal
                open={isCandidateModalOpen}
                onOpenChange={setIsCandidateModalOpen}
                vacancies={vacancies}
            />
        </div>
    );
}
