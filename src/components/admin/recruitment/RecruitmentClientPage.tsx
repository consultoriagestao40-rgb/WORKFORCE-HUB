"use client";
import { useState } from "react";

import { KanbanBoard } from "@/components/admin/recruitment/KanbanBoard";
import { NotificationCenter } from "@/components/admin/notifications/NotificationCenter";
import { VacancyModal } from "@/components/admin/recruitment/VacancyModal";
import { CandidateModal } from "@/components/admin/recruitment/CandidateModal";
import { CandidateDetailsModal } from "@/components/admin/recruitment/CandidateDetailsModal";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, Search, User, Filter, AlertCircle, FileText, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface RecruitmentClientPageProps {
    stages: any[];
    vacancies: any[];
    roles: any[];
    postos: any[];
    companies: any[];
    backlogs: any[];
    recruiters: any[];
    candidates: any[];
    currentUser?: any;
}

export function RecruitmentClientPage({ stages, vacancies, roles, postos, companies, backlogs, recruiters, candidates = [], currentUser }: RecruitmentClientPageProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<"kanban" | "talents">("kanban");
    const [isVacancyModalOpen, setIsVacancyModalOpen] = useState(false);
    const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);

    // Banco de Talentos filters state
    const [talentSearch, setTalentSearch] = useState("");
    const [selectedStageFilter, setSelectedStageFilter] = useState<string>("ALL");
    const [selectedAdherenceFilter, setSelectedAdherenceFilter] = useState<string>("ALL");

    // Modal state for Banco de Talentos candidates
    const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    // Filter Logic for Kanban View
    const filteredStages = stages.map(stage => ({
        ...stage,
        candidates: stage.candidates.filter((c: any) => {
            const clientName = c.vacancy?.posto?.client?.name || "";
            if (clientName === 'ROTATIVO') return false;

            if (!searchTerm) return true;

            const searchLower = searchTerm.toLowerCase();
            const title = c.type === 'VACANCY' ? c.vacancy.title : c.name;
            const roleName = c.vacancy?.role?.name || "";
            const companyName = c.vacancy?.company?.name || "";

            return (
                (title && title.toLowerCase().includes(searchLower)) ||
                (roleName && roleName.toLowerCase().includes(searchLower)) ||
                (companyName && companyName.toLowerCase().includes(searchLower)) ||
                (clientName && clientName.toLowerCase().includes(searchLower))
            );
        })
    }));

    // Filter Logic for Banco de Talentos View
    const filteredTalents = candidates.filter((c: any) => {
        // Exclude ROTATIVO
        const clientName = c.vacancy?.posto?.client?.name || "";
        if (clientName === 'ROTATIVO') return false;

        // Search Filter
        if (talentSearch) {
            const searchLower = talentSearch.toLowerCase();
            const nameMatch = c.name?.toLowerCase().includes(searchLower);
            const emailMatch = c.email?.toLowerCase().includes(searchLower);
            const phoneMatch = c.phone?.toLowerCase().includes(searchLower);
            const vacancyTitle = c.vacancy?.title?.toLowerCase().includes(searchLower);
            if (!nameMatch && !emailMatch && !phoneMatch && !vacancyTitle) return false;
        }

        // Stage Filter
        if (selectedStageFilter !== "ALL" && c.stageId !== selectedStageFilter) {
            return false;
        }

        // Adherence / Disqualification Filter
        const evaluation = (c.requirementsEvaluation as any) || {};
        const isDisqualified = !!evaluation.isDisqualified;
        const score = evaluation.adherenceScore || 0;

        if (selectedAdherenceFilter === "DISQUALIFIED" && !isDisqualified) return false;
        if (selectedAdherenceFilter === "APPROVED" && (isDisqualified || score < 75)) return false;
        if (selectedAdherenceFilter === "AVERAGE" && (isDisqualified || score < 50 || score >= 75)) return false;
        if (selectedAdherenceFilter === "LOW" && (isDisqualified || score >= 50 || score === 0)) return false;

        return true;
    });

    const safeVacancies = vacancies.filter(v => v.posto?.client?.name !== 'ROTATIVO');

    // Extract stages for filter dropdown
    const stageFilters = stages.map(s => ({ id: s.id, name: s.name }));

    const handleOpenCandidateDetails = (candidate: any) => {
        // Standardize the candidate shape to match details modal expectations
        const formatted = {
            ...candidate,
            type: 'CANDIDATE' as const
        };
        setSelectedCandidate(formatted);
        setIsDetailsModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border">
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
                    <div className="text-right pl-4">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Candidatos Totais</div>
                        <div className="text-2xl font-black text-slate-800">{candidates.length}</div>
                    </div>
                    <div className="text-right border-l pl-4 ml-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vagas Abertas</div>
                        <div className="text-2xl font-black text-slate-800">{safeVacancies.length}</div>
                    </div>
                </div>
            </div>

            {/* Abas de Navegação */}
            <div className="flex border-b border-slate-200 gap-6">
                <button
                    onClick={() => setActiveTab("kanban")}
                    className={`pb-3 px-1 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${activeTab === "kanban" ? "border-pink-600 text-pink-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                >
                    📋 Quadro de Vagas (Kanban)
                </button>
                <button
                    onClick={() => setActiveTab("talents")}
                    className={`pb-3 px-1 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${activeTab === "talents" ? "border-pink-600 text-pink-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                >
                    👥 Banco de Talentos ({candidates.length})
                </button>
            </div>

            {/* Renderizar aba ativa */}
            {activeTab === "kanban" ? (
                <div className="space-y-4">
                    {/* Search Bar for Kanban */}
                    <div className="flex justify-end">
                        <div className="relative w-80">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar vaga, cliente ou empresa..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-9 text-xs"
                            />
                        </div>
                    </div>

                    <div className="min-h-[calc(100vh-200px)]">
                        <KanbanBoard initialStages={filteredStages} currentUser={currentUser} recruiters={recruiters} />
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Filters Bar for Talents Database */}
                    <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row md:items-center gap-4 justify-between">
                        <div className="flex flex-1 flex-col md:flex-row gap-3">
                            {/* Search */}
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Buscar por nome, e-mail, telefone ou vaga..."
                                    value={talentSearch}
                                    onChange={(e) => setTalentSearch(e.target.value)}
                                    className="pl-9 h-9 text-xs"
                                />
                            </div>

                            {/* Stage Filter */}
                            <div className="w-48">
                                <Select value={selectedStageFilter} onValueChange={setSelectedStageFilter}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <Filter className="w-3.5 h-3.5 text-slate-400" />
                                            <SelectValue placeholder="Etapa" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL" className="text-xs">Todas as Etapas</SelectItem>
                                        {stageFilters.map(sf => (
                                            <SelectItem key={sf.id} value={sf.id} className="text-xs">{sf.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Adherence Filter */}
                            <div className="w-48">
                                <Select value={selectedAdherenceFilter} onValueChange={setSelectedAdherenceFilter}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <Filter className="w-3.5 h-3.5 text-slate-400" />
                                            <SelectValue placeholder="Aderência" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL" className="text-xs">Qualquer Aderência</SelectItem>
                                        <SelectItem value="DISQUALIFIED" className="text-xs text-red-600 font-medium">🔴 Desclassificados</SelectItem>
                                        <SelectItem value="APPROVED" className="text-xs text-emerald-600 font-medium">🟢 Excelente (&gt;= 75%)</SelectItem>
                                        <SelectItem value="AVERAGE" className="text-xs text-amber-600 font-medium">🟡 Médio (50% - 74%)</SelectItem>
                                        <SelectItem value="LOW" className="text-xs text-red-500 font-medium">🟠 Baixo (&lt; 50%)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="text-xs text-slate-500 font-medium">
                            Mostrando <strong className="text-slate-800">{filteredTalents.length}</strong> de <strong className="text-slate-800">{candidates.length}</strong> candidatos
                        </div>
                    </div>

                    {/* Talents Table */}
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                        {filteredTalents.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                                <User className="w-12 h-12 text-slate-300" />
                                <h3 className="font-bold text-slate-700 text-sm">Nenhum candidato encontrado</h3>
                                <p className="text-xs text-slate-400 max-w-sm">Tente limpar os filtros ou realizar outra busca para localizar o candidato desejado.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                            <th className="py-3.5 px-4">Candidato</th>
                                            <th className="py-3.5 px-4">Vaga Pretendida</th>
                                            <th className="py-3.5 px-4">Origem</th>
                                            <th className="py-3.5 px-4">Etapa Atual</th>
                                            <th className="py-3.5 px-4">Avaliação IA</th>
                                            <th className="py-3.5 px-4">Data Inscrição</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                                        {filteredTalents.map((cand: any) => {
                                            const evaluation = (cand.requirementsEvaluation as any) || {};
                                            const isDisqualified = !!evaluation.isDisqualified;
                                            const score = evaluation.adherenceScore || 0;
                                            
                                            return (
                                                <tr
                                                    key={cand.id}
                                                    onClick={() => handleOpenCandidateDetails(cand)}
                                                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                                                >
                                                    {/* Candidato Name & Contact */}
                                                    <td className="py-4 px-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-900 text-sm">{cand.name}</span>
                                                            <span className="text-[10px] text-slate-400 mt-0.5">{cand.email || "Sem e-mail"} | {cand.phone || "Sem telefone"}</span>
                                                        </div>
                                                    </td>

                                                    {/* Vaga Pretendida */}
                                                    <td className="py-4 px-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-800">{cand.vacancy?.title || "Vaga Excluída"}</span>
                                                            <span className="text-[10px] text-slate-400 mt-0.5">{cand.vacancy?.posto?.client?.name || "Sem Cliente"}</span>
                                                        </div>
                                                    </td>

                                                    {/* Origem */}
                                                    <td className="py-4 px-4">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cand.appliedFromPublicForm ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                                            {cand.appliedFromPublicForm ? "📣 Tráfego Pago" : "📎 Cadastro Manual"}
                                                        </span>
                                                    </td>

                                                    {/* Etapa Atual */}
                                                    <td className="py-4 px-4">
                                                        <span className="px-2.5 py-1 rounded bg-slate-100 border border-slate-200/50 text-[10px] uppercase font-black tracking-wide text-slate-600">
                                                            {cand.stage?.name || "Inscrição"}
                                                        </span>
                                                    </td>

                                                    {/* Avaliação IA */}
                                                    <td className="py-4 px-4">
                                                        {isDisqualified ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 border border-red-200 text-red-800 text-[10px] font-black uppercase">
                                                                <XCircle className="w-3 h-3 text-red-600" />
                                                                Desclassificado
                                                            </span>
                                                        ) : score > 0 ? (
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase ${score >= 75 ? 'bg-emerald-100 border border-emerald-200 text-emerald-800' : score >= 50 ? 'bg-amber-100 border border-amber-200 text-amber-800' : 'bg-red-50 border border-red-150 text-red-700'}`}>
                                                                <CheckCircle2 className={`w-3 h-3 ${score >= 75 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-500'}`} />
                                                                {score}% Aderência
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-250 text-slate-500 text-[10px] font-bold">
                                                                Sem Avaliação
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Data Inscrição */}
                                                    <td className="py-4 px-4 text-slate-400 text-[10px]">
                                                        {new Date(cand.createdAt).toLocaleDateString('pt-BR', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Detalhes do Candidato para a aba Banco de Talentos */}
            <CandidateDetailsModal
                open={isDetailsModalOpen}
                onOpenChange={setIsDetailsModalOpen}
                candidate={selectedCandidate}
            />

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
