"use client";
import { useState } from "react";

import { KanbanBoard } from "@/components/admin/recruitment/KanbanBoard";
import { NotificationCenter } from "@/components/admin/notifications/NotificationCenter";
import { VacancyModal } from "@/components/admin/recruitment/VacancyModal";
import { CandidateModal } from "@/components/admin/recruitment/CandidateModal";
import { CandidateDetailsModal } from "@/components/admin/recruitment/CandidateDetailsModal";
import { WhatsAppChatModal } from "@/components/admin/recruitment/WhatsAppChatModal";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, Search, User, Filter, AlertCircle, FileText, CheckCircle2, XCircle, Briefcase, Globe, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    const [viewMode, setViewMode] = useState<"stages" | "clients" | "list">("stages");
    const [isVacancyModalOpen, setIsVacancyModalOpen] = useState(false);
    const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);

    // Banco de Talentos filters state
    const [talentSearch, setTalentSearch] = useState("");
    const [selectedStageFilter, setSelectedStageFilter] = useState<string>("ALL");
    const [selectedAdherenceFilter, setSelectedAdherenceFilter] = useState<string>("ALL");

    // Modal state for Banco de Talentos candidates
    const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    // WhatsApp Chat Modal State
    const [waCandidate, setWaCandidate] = useState<any | null>(null);
    const [waModalOpen, setWaModalOpen] = useState(false);

    function handleOpenWhatsAppChat(cand: any) {
        setWaCandidate({
            id: cand.id,
            name: cand.name,
            phone: cand.phone || cand.extraFields?.phone || cand.extraFields?.whatsapp || "",
            email: cand.email,
            vacancyTitle: cand.vacancy?.title || cand.vacancy?.role?.name || "",
            companyName: cand.vacancy?.company?.name || "",
            extraFields: cand.extraFields
        });
        setWaModalOpen(true);
    }

    // Vacation Filter state
    const [vacationFilter, setVacationFilter] = useState<"ALL" | "VACATION" | "NO_VACATION">("ALL");

    // Helper: Check if card is associated with a vacation vacancy
    const checkIsVacationCard = (c: any) => {
        const reason = c.vacancy?.openingReason || "";
        const title = c.vacancy?.title || "";
        const desc = c.vacancy?.description || "";
        return (
            reason === 'FERIAS' ||
            /férias|ferias/i.test(reason) ||
            /férias|ferias/i.test(title) ||
            /férias|ferias/i.test(desc)
        );
    };

    // Filter Logic for Kanban View
    const filteredStages = stages.map(stage => ({
        ...stage,
        candidates: stage.candidates.filter((c: any) => {
            const clientName = c.vacancy?.posto?.client?.name || "";
            if (clientName === 'ROTATIVO') return false;

            const isVacation = checkIsVacationCard(c);
            if (vacationFilter === 'VACATION' && !isVacation) return false;
            if (vacationFilter === 'NO_VACATION' && isVacation) return false;

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
    const handleOpenVacancyDetails = (card: any) => {
        setSelectedCandidate(card);
        setIsDetailsModalOpen(true);
    };

    // Gather all vacancy cards from stages to build clients and list views
    const allFilteredCards = filteredStages.flatMap(s => 
        s.candidates.map((c: any) => ({
            ...c,
            currentStageName: s.name,
            currentStageId: s.id
        }))
    );

    // Group by client name
    const clientGroups: Record<string, any[]> = {};
    allFilteredCards.forEach(card => {
        const clientName = card.vacancy?.posto?.client?.name || card.vacancy?.company?.name || "Sem Cliente / Geral";
        if (!clientGroups[clientName]) {
            clientGroups[clientName] = [];
        }
        clientGroups[clientName].push(card);
    });

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
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="border-indigo-200 bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 font-bold"
                                onClick={() => {
                                    const portalUrl = `${window.location.origin}/vagas`;
                                    navigator.clipboard.writeText(portalUrl);
                                    toast.success("Link do Portal Público de Vagas copiado!");
                                    window.open(portalUrl, "_blank");
                                }}
                                title="Abrir e copiar link do Portal Público de Vagas Abertas"
                            >
                                <Globe className="w-4 h-4 mr-2 text-indigo-600" />
                                Portal de Vagas
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
                    {/* Barra de controle de visão e barra de busca */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-3 rounded-xl border shadow-sm">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setViewMode("stages")}
                                    className={`px-3 py-1.5 rounded-md font-bold transition-all flex items-center gap-1.5 ${viewMode === "stages" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                                >
                                    📋 Por Fases
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode("clients")}
                                    className={`px-3 py-1.5 rounded-md font-bold transition-all flex items-center gap-1.5 ${viewMode === "clients" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                                >
                                    🏢 Por Cliente
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode("list")}
                                    className={`px-3 py-1.5 rounded-md font-bold transition-all flex items-center gap-1.5 ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                                >
                                    📝 Lista de Vagas
                                </button>
                            </div>

                            {/* Filtro por Origem da Vaga (Férias vs Operacional) */}
                            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setVacationFilter("ALL")}
                                    className={`px-2.5 py-1.5 rounded-md font-bold transition-all ${vacationFilter === "ALL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                                >
                                    Todas as Vagas
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setVacationFilter("VACATION")}
                                    className={`px-2.5 py-1.5 rounded-md font-bold transition-all flex items-center gap-1 ${vacationFilter === "VACATION" ? "bg-cyan-600 text-white shadow-sm font-black" : "text-cyan-700 hover:text-cyan-900"}`}
                                    title="Exibir apenas vagas provenientes de Férias"
                                >
                                    🏖️ Vagas de Férias
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setVacationFilter("NO_VACATION")}
                                    className={`px-2.5 py-1.5 rounded-md font-bold transition-all flex items-center gap-1 ${vacationFilter === "NO_VACATION" ? "bg-slate-800 text-white shadow-sm font-black" : "text-slate-600 hover:text-slate-900"}`}
                                    title="Exibir apenas vagas operacionais (sem férias)"
                                >
                                    💼 Sem Férias
                                </button>
                            </div>
                        </div>

                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar vaga, cliente ou empresa..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-9 text-xs"
                            />
                        </div>
                    </div>

                    <div className="min-h-[calc(100vh-250px)]">
                        {viewMode === "stages" && (
                            <KanbanBoard initialStages={filteredStages} currentUser={currentUser} recruiters={recruiters} />
                        )}

                        {viewMode === "clients" && (
                            <div className="flex gap-4 overflow-x-auto pb-4 items-start select-none">
                                {Object.keys(clientGroups).length === 0 ? (
                                    <div className="bg-white rounded-xl border shadow-sm w-full p-12 text-center flex flex-col items-center justify-center space-y-3">
                                        <Briefcase className="w-12 h-12 text-slate-300" />
                                        <h3 className="font-bold text-slate-700 text-sm">Nenhuma vaga encontrada</h3>
                                        <p className="text-xs text-slate-400 max-w-sm">Tente limpar os filtros de busca para visualizar as vagas.</p>
                                    </div>
                                ) : (
                                    Object.entries(clientGroups).map(([clientName, cards]) => (
                                        <div key={clientName} className="w-72 bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col shrink-0 max-h-[calc(100vh-280px)]">
                                            {/* Column Header */}
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="font-bold text-slate-800 text-xs truncate max-w-[200px]" title={clientName}>{clientName}</span>
                                                <span className="bg-slate-200 text-slate-700 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                                                    {cards.length}
                                                </span>
                                            </div>
                                            
                                            {/* Cards List */}
                                            <div className="space-y-2 overflow-y-auto pr-0.5 flex-1 min-h-[50px]">
                                                {cards.map(card => (
                                                    <div
                                                        key={card.id}
                                                        className="bg-white p-3 rounded shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer space-y-2"
                                                        onClick={() => handleOpenVacancyDetails(card)}
                                                    >
                                                        <div className="flex justify-between items-start gap-2">
                                                            <span className="font-bold text-slate-800 line-clamp-2 leading-tight text-xs flex-1">
                                                                {card.vacancy.title}
                                                            </span>
                                                            <Badge variant={card.vacancy.priority === 'URGENT' ? 'destructive' : 'secondary'} className="text-[9px] px-1 py-0 h-4 shrink-0 font-bold">
                                                                {card.vacancy.priority === 'URGENT' ? 'Urg' : card.vacancy.priority === 'HIGH' ? 'Alta' : 'Nor'}
                                                            </Badge>
                                                        </div>

                                                        {card.vacancy.plannedStartDate && (
                                                            <div className="text-[9px] text-indigo-500 font-semibold">
                                                                Início: {new Date(card.vacancy.plannedStartDate).toLocaleDateString('pt-BR')}
                                                            </div>
                                                        )}

                                                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                                            <Briefcase className="w-3 h-3 text-slate-400" />
                                                            <span className="truncate">{card.vacancy.role?.name || "Sem Cargo"}</span>
                                                        </div>

                                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 text-[8px] font-black uppercase tracking-wider">
                                                                {card.currentStageName}
                                                            </span>
                                                            {card.vacancy.recruiter?.name && (
                                                                <span className="text-[9px] text-slate-400 truncate max-w-[100px]" title={`Recrutador: ${card.vacancy.recruiter.name}`}>
                                                                    👤 {card.vacancy.recruiter.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {viewMode === "list" && (
                            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                                {allFilteredCards.length === 0 ? (
                                    <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                                        <Briefcase className="w-12 h-12 text-slate-300" />
                                        <h3 className="font-bold text-slate-700 text-sm">Nenhuma vaga encontrada</h3>
                                        <p className="text-xs text-slate-400 max-w-sm">Tente limpar os filtros de busca para visualizar as vagas.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                                    <th className="py-3.5 px-4">Vaga</th>
                                                    <th className="py-3.5 px-4">Cargo / Função</th>
                                                    <th className="py-3.5 px-4">Cliente / Contrato</th>
                                                    <th className="py-3.5 px-4">Recrutador</th>
                                                    <th className="py-3.5 px-4">Fase Atual</th>
                                                    <th className="py-3.5 px-4 text-center">Candidatos</th>
                                                    <th className="py-3.5 px-4">Prioridade</th>
                                                    <th className="py-3.5 px-4 text-right">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                                                {allFilteredCards.map((card) => {
                                                    const clientName = card.vacancy?.posto?.client?.name || card.vacancy?.company?.name || "Geral / Interno";
                                                    const match = card.name.match(/\((\d+)\)/) || card.name.match(/\((\d+)\s+candidato/);
                                                    const totalCands = match ? parseInt(match[1]) : 0;
                                                    
                                                    return (
                                                        <tr key={card.id} className="hover:bg-slate-50/70 transition-colors">
                                                            <td className="py-4 px-4">
                                                                <span className="font-bold text-slate-900 text-sm block">{card.vacancy.title}</span>
                                                                {card.vacancy.plannedStartDate && (
                                                                    <span className="text-[10px] text-indigo-500 font-semibold block mt-0.5">Início Planejado: {new Date(card.vacancy.plannedStartDate).toLocaleDateString('pt-BR')}</span>
                                                                )}
                                                            </td>
                                                            <td className="py-4 px-4">
                                                                <span>{card.vacancy.role?.name || "Sem Cargo"}</span>
                                                            </td>
                                                            <td className="py-4 px-4">
                                                                <span className="font-bold text-slate-800">{clientName}</span>
                                                            </td>
                                                            <td className="py-4 px-4">
                                                                <span>{card.vacancy.recruiter?.name || "Não atribuído"}</span>
                                                            </td>
                                                            <td className="py-4 px-4">
                                                                <span className="px-2.5 py-1 rounded bg-slate-100 border border-slate-200/50 text-[10px] uppercase font-black tracking-wide text-slate-600">
                                                                    {card.currentStageName}
                                                                </span>
                                                            </td>
                                                            <td className="py-4 px-4 text-center">
                                                                <span className="bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-full text-xs border border-indigo-100">
                                                                    {totalCands}
                                                                </span>
                                                            </td>
                                                            <td className="py-4 px-4">
                                                                <Badge variant={card.vacancy.priority === 'URGENT' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0.5">
                                                                    {card.vacancy.priority === 'URGENT' ? 'Urgente' : card.vacancy.priority === 'HIGH' ? 'Alta' : 'Normal'}
                                                                </Badge>
                                                            </td>
                                                            <td className="py-4 px-4 text-right">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-8 text-xs font-semibold"
                                                                    onClick={() => handleOpenVacancyDetails(card)}
                                                                >
                                                                    Gerenciar Vaga
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
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
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-900 text-sm">{cand.name}</span>
                                                                {(() => {
                                                                    const rawPhone = cand.phone || (cand as any).extraFields?.phone || (cand as any).extraFields?.whatsapp || "";
                                                                    if (!rawPhone) return null;
                                                                    const phoneDigits = rawPhone.replace(/\D/g, "");
                                                                    if (!phoneDigits) return null;
                                                                    return (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleOpenWhatsAppChat(cand);
                                                                            }}
                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] shadow-2xs hover:shadow transition-all shrink-0 cursor-pointer"
                                                                            title={`Abrir Chat WhatsApp de ${cand.name}`}
                                                                        >
                                                                            <MessageSquare className="w-3 h-3 fill-current" />
                                                                            <span>WhatsApp</span>
                                                                        </button>
                                                                    );
                                                                })()}
                                                            </div>
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

            <WhatsAppChatModal
                open={waModalOpen}
                onClose={() => setWaModalOpen(false)}
                candidate={waCandidate}
            />
        </div>
    );
}
