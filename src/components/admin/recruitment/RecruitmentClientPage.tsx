"use client";

import { useState } from "react";
import { KanbanBoard } from "@/components/admin/recruitment/KanbanBoard";
import { NotificationCenter } from "@/components/admin/notifications/NotificationCenter";
import { VacancyModal } from "@/components/admin/recruitment/VacancyModal";
import { CandidateModal } from "@/components/admin/recruitment/CandidateModal";
import { VacancyList } from "@/components/admin/recruitment/VacancyList";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, Bug, Search } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { sendDebugNotification } from "@/actions/notifications";
import { toast } from "sonner";

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
    const [searchTerm, setSearchTerm] = useState("");
    const [isVacancyModalOpen, setIsVacancyModalOpen] = useState(false);
    const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);

    // Filter Logic
    const filteredStages = stages.map(stage => ({
        ...stage,
        candidates: stage.candidates.filter((c: any) => {
            // 1. Mandatory Filter: Remove ROTATIVO (Nuclear Option)
            const clientName = c.vacancy?.posto?.client?.name || "";
            if (clientName === 'ROTATIVO') return false;

            // 2. Search Filter
            if (!searchTerm) return true;

            const searchLower = searchTerm.toLowerCase();
            const title = c.type === 'VACANCY' ? c.vacancy.title : c.name;
            const roleName = c.vacancy?.role?.name || "";
            const companyName = c.vacancy?.company?.name || "";
            // clientName already defined above

            return (
                (title && title.toLowerCase().includes(searchLower)) ||
                (roleName && roleName.toLowerCase().includes(searchLower)) ||
                (companyName && companyName.toLowerCase().includes(searchLower)) ||
                (clientName && clientName.toLowerCase().includes(searchLower))
            );
        })
    }));

    const safeVacancies = vacancies.filter(v => v.posto?.client?.name !== 'ROTATIVO');

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border mb-6">
                <div className="flex-1">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Recrutamento e Seleção</h1>
                        <div className="flex gap-2 items-center">
                            <NotificationCenter />
                            <div className="w-px h-6 bg-slate-200 mx-2" />
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
                <div className="flex gap-4 items-center">
                    <div className="relative w-72">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por cargo, empresa, cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <div className="text-right border-l pl-4 ml-2">
                        <div className="text-sm font-medium text-slate-500 uppercase">Vagas Abertas</div>
                        <div className="text-2xl font-bold text-slate-900">{safeVacancies.length}</div>
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
                <KanbanBoard initialStages={filteredStages} currentUser={currentUser} recruiters={recruiters} />
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
