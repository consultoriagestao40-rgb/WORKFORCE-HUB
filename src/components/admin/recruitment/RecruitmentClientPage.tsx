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
    currentUser?: any;
}

export function RecruitmentClientPage({ stages, vacancies, roles, postos, companies, backlogs, recruiters, currentUser }: RecruitmentClientPageProps) {
    const [isVacancyModalOpen, setIsVacancyModalOpen] = useState(false);
    const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border mb-6">
                <div className="flex-1">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Recrutamento e Seleção</h1>
                        <div className="flex gap-2">
                            <Button onClick={() => setIsVacancyModalOpen(true)} size="sm" className="bg-pink-600 hover:bg-pink-700 text-white">
                                <Plus className="w-4 h-4 mr-2" />
                                Nova Vaga
                            </Button>
                            <Button variant="outline" onClick={() => setIsCandidateModalOpen(true)} size="sm">
                                <UserPlus className="w-4 h-4 mr-2" />
                                Novo Candidato
                            </Button>
                        </div>
                    </div>
                    <p className="text-slate-500 mt-1">Gerencie suas vagas e pipeline de candidatos.</p>
                </div>

                {/* Stats Mini */}
                <div className="flex gap-4">
                    <div className="text-right">
                        <div className="text-sm font-medium text-slate-500 uppercase">Vagas Abertas</div>
                        <div className="text-2xl font-bold text-slate-900">{vacancies.length}</div>
                    </div>
                </div>
            </div>

            {/* <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"> REMOVED CARDS GRID
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
            </div> */ }

            {/* <VacancyList /> removed as it is now integrated into Kanban R&S column */}

            <div className="min-h-[calc(100vh-200px)]">
                <KanbanBoard initialStages={stages} currentUser={currentUser} recruiters={recruiters} />
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
