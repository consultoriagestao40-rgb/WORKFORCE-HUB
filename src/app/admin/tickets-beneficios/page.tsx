"use client";

import { useState, useEffect } from "react";
import { 
    Ticket, 
    Clock, 
    CheckCircle2, 
    AlertTriangle, 
    Search, 
    Filter, 
    Settings, 
    RefreshCw, 
    User, 
    Building, 
    Calendar, 
    MessageSquare, 
    ArrowUpRight,
    TrendingUp,
    ExternalLink,
    Building2,
    PieChart,
    Timer,
    FileSpreadsheet,
    MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    getBenefitTickets, 
    getBenefitTicketTypes, 
    getBenefitTicketStatusList,
    BenefitTicketItem, 
    BenefitTicketTypeItem 
} from "@/actions/benefit-tickets";
import { BenefitTicketDetailsModal } from "@/components/admin/BenefitTicketDetailsModal";
import { BenefitTicketTypesConfigModal } from "@/components/admin/BenefitTicketTypesConfigModal";
import { toast } from "sonner";

export default function BenefitTicketsPage() {
    const [tickets, setTickets] = useState<BenefitTicketItem[]>([]);
    const [types, setTypes] = useState<BenefitTicketTypeItem[]>([]);
    const [statusList, setStatusList] = useState<any[]>([]);
    const [kpis, setKpis] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Filtros
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [viewMode, setViewMode] = useState<"ACTIVE" | "RESOLVED">("ACTIVE");

    // Modais
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [configModalOpen, setConfigModalOpen] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const effectiveStatus = viewMode === "RESOLVED" 
                ? "RESOLVED" 
                : (statusFilter !== "ALL" ? statusFilter : undefined);

            const [ticketsRes, typesRes, statusesRes] = await Promise.all([
                getBenefitTickets({
                    status: effectiveStatus,
                    category: categoryFilter,
                    search: search.trim() || undefined
                }),
                getBenefitTicketTypes(),
                getBenefitTicketStatusList()
            ]);

            // Se estiver na aba ATIVOS e o usuário não filtrou por status específico, esconde os RESOLVED da visualização ativa
            let displayedTickets = ticketsRes.tickets;
            if (viewMode === "ACTIVE" && statusFilter === "ALL") {
                displayedTickets = displayedTickets.filter(t => t.status !== "RESOLVED");
            } else if (viewMode === "RESOLVED") {
                displayedTickets = displayedTickets.filter(t => t.status === "RESOLVED");
            }

            setTickets(displayedTickets);
            setKpis(ticketsRes.kpis);
            setTypes(typesRes);
            setStatusList(statusesRes);
        } catch (err: any) {
            toast.error(err.message || "Erro ao carregar chamados de benefícios");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [statusFilter, categoryFilter, viewMode]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        loadData();
    };

    return (
        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
            {/* CABEÇALHO */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                            <Ticket className="w-6 h-6" />
                        </span>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                                Central de Chamados de Benefícios (Help Desk)
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Abertura automática via Grupo do WhatsApp com controle rigoroso de SLA, Anti-Duplicidade e Devolutivas
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        onClick={loadData}
                        disabled={loading}
                        className="rounded-xl text-xs font-bold gap-1.5 h-9"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
                        Atualizar
                    </Button>
                    <Button 
                        onClick={() => setConfigModalOpen(true)}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs gap-1.5 h-9"
                    >
                        <Settings className="w-3.5 h-3.5" />
                        Tipos & SLA
                    </Button>
                </div>
            </div>

            {/* CARDS DE INDICADORES (BI & MÉTRICAS DE SLA) */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                {/* Total */}
                <div className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[11px] font-black uppercase tracking-wider">Total Geral</span>
                        <Ticket className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-2xl font-black text-slate-900">{kpis?.totalTickets || 0}</p>
                    <span className="text-[10px] text-slate-400 font-bold block">Registrados pelo Grupo</span>
                </div>

                {/* Pendentes / Em Fila */}
                <div className="p-4 bg-blue-50/60 rounded-3xl border border-blue-100 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-blue-500">
                        <span className="text-[11px] font-black uppercase tracking-wider text-blue-900">Em Aberto</span>
                        <Clock className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-2xl font-black text-blue-700">{kpis?.totalOpen || 0}</p>
                    <span className="text-[10px] text-blue-600/80 font-bold block">Aguardando atendimento</span>
                </div>

                {/* Em Andamento */}
                <div className="p-4 bg-amber-50/60 rounded-3xl border border-amber-100 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-amber-500">
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-900">Em Análise DP</span>
                        <TrendingUp className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-2xl font-black text-amber-700">{kpis?.totalInProgress || 0}</p>
                    <span className="text-[10px] text-amber-700 font-bold block">Em resolução técnica</span>
                </div>

                {/* SLA Estourado */}
                <div className="p-4 bg-rose-50/70 rounded-3xl border border-rose-100 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-rose-500">
                        <span className="text-[11px] font-black uppercase tracking-wider text-rose-900">SLA Vencido</span>
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                    </div>
                    <p className="text-2xl font-black text-rose-700">{kpis?.totalOverdue || 0}</p>
                    <span className="text-[10px] text-rose-600/80 font-bold block">Fora do prazo limite</span>
                </div>

                {/* Tempo Médio de Resolução */}
                <div className="p-4 bg-emerald-50/70 rounded-3xl border border-emerald-100 shadow-2xs space-y-1 col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between text-emerald-600">
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-950">Tempo Médio Real</span>
                        <Timer className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-2xl font-black text-emerald-700">
                        {kpis?.avgResolutionHours || 0}<span className="text-sm font-bold ml-1">h</span>
                    </p>
                    <span className="text-[10px] text-emerald-700 font-bold block">Entre abertura e baixa</span>
                </div>
            </div>

            {/* SEÇÃO DE RECORRÊNCIA POR POSTO / TIPO */}
            {kpis && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Recorrência por Categoria */}
                    <div className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                <PieChart className="w-3.5 h-3.5 text-indigo-600" /> Demandas por Tipo de Benefício
                            </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Object.entries(kpis.categoryCounts || {}).map(([cat, count]: any) => (
                                <div key={cat} className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700">{cat}</span>
                                    <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-indigo-100 text-indigo-800">
                                        {count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recorrência por Cliente / Posto */}
                    <div className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Postos com Maior Volume de Demandas
                            </span>
                        </div>
                        <div className="space-y-1.5">
                            {kpis.clientRecurrence?.length === 0 ? (
                                <p className="text-xs text-slate-400 py-2">Nenhum contrato recorrente registrado.</p>
                            ) : (
                                kpis.clientRecurrence?.map((c: any) => (
                                    <div key={c.name} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100/80 text-xs">
                                        <span className="font-bold text-slate-800 truncate max-w-[260px]">{c.name}</span>
                                        <span className="font-black text-indigo-600">{c.count} chamado(s)</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ABAS: TICKETS ATIVOS vs ATENDIDOS / CONCLUÍDOS */}
            <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                <button
                    onClick={() => { setViewMode("ACTIVE"); setStatusFilter("ALL"); }}
                    className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                        viewMode === "ACTIVE"
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                >
                    <Clock className="w-3.5 h-3.5" />
                    Chamados em Aberto / Em Andamento
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${viewMode === "ACTIVE" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>
                        {tickets.filter(t => t.status !== "RESOLVED").length || (viewMode === "ACTIVE" ? tickets.length : 0)}
                    </span>
                </button>

                <button
                    onClick={() => { setViewMode("RESOLVED"); setStatusFilter("ALL"); }}
                    className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                        viewMode === "RESOLVED"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Chamados Atendidos / Histórico
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${viewMode === "RESOLVED" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>
                        {kpis?.resolvedTickets || 0}
                    </span>
                </button>
            </div>

            {/* BARRA DE FILTROS E BUSCA */}
            <div className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
                    <div className="relative w-full">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input 
                            placeholder="Buscar por colaborador, CPF, ticket..." 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 text-xs rounded-xl h-9"
                        />
                    </div>
                    <Button type="submit" size="sm" className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs h-9 font-bold px-3">
                        Filtrar
                    </Button>
                </form>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Filtro Status */}
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="text-xs rounded-xl h-9 w-44">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos os Status</SelectItem>
                            {statusList.map((s: any) => (
                                <SelectItem key={s.id || s.code} value={s.code}>
                                    {s.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Filtro Categoria */}
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="text-xs rounded-xl h-9 w-40">
                            <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todas Categorias</SelectItem>
                            <SelectItem value="VT">Vale Transporte</SelectItem>
                            <SelectItem value="VA">Vale Alimentação</SelectItem>
                            <SelectItem value="ASSIDUIDADE">Assiduidade</SelectItem>
                            <SelectItem value="AJUDA_CUSTO">Ajuda Custo</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* TABELA DE TICKETS */}
            <div className="border border-slate-200/80 rounded-3xl overflow-hidden bg-white shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr className="font-extrabold text-slate-500 uppercase tracking-wider text-[11px]">
                            <th className="py-3 px-4">Ticket</th>
                            <th className="py-3 px-4">Colaborador / CPF</th>
                            <th className="py-3 px-4">Posto / Cliente</th>
                            <th className="py-3 px-4">Tipo / Assunto</th>
                            <th className="py-3 px-4">Responsável</th>
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4 text-center">SLA / Vencimento</th>
                            <th className="py-3 px-4 text-right">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                        {loading && tickets.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-12 text-slate-400">
                                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                                    Carregando chamados...
                                </td>
                            </tr>
                        ) : tickets.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-12 text-slate-400">
                                    Nenhum chamado de benefícios encontrado com os filtros atuais.
                                </td>
                            </tr>
                        ) : (
                            tickets.map(t => (
                                <tr 
                                    key={t.id} 
                                    onClick={() => {
                                        setSelectedTicketId(t.id);
                                        setDetailsModalOpen(true);
                                    }}
                                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                                >
                                    {/* Número do Ticket */}
                                    <td className="py-3.5 px-4 font-black text-indigo-600">
                                        #{t.ticketNumber}
                                    </td>

                                    {/* Colaborador */}
                                    <td className="py-3.5 px-4">
                                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                            {t.employeeName}
                                        </div>
                                        <div className="text-[11px] text-slate-400">
                                            CPF: {t.employeeCpf || "—"} {t.employeePhone ? `• Tel: ${t.employeePhone}` : ""}
                                        </div>
                                    </td>

                                    {/* Posto */}
                                    <td className="py-3.5 px-4 text-slate-600">
                                        <div className="font-semibold text-slate-800">{t.postoName || "—"}</div>
                                        <div className="text-[10px] text-slate-400">{t.clientName || "Geral"}</div>
                                    </td>

                                    {/* Categoria / Tipo */}
                                    <td className="py-3.5 px-4">
                                        <span 
                                            className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black text-white"
                                            style={{ backgroundColor: t.typeColor || "#3b82f6" }}
                                        >
                                            {t.typeName}
                                        </span>
                                        <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]" title={t.description || ""}>
                                            {t.description || "Sem detalhes"}
                                        </div>
                                    </td>

                                    {/* Responsável Atual / Etapa */}
                                    <td className="py-3.5 px-4">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                                                {(t.assigneeName || "Késia Miranda").slice(0, 1)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 text-xs truncate max-w-[130px]">
                                                    {t.assigneeName || "Késia Miranda"}
                                                </div>
                                                <span className="text-[9px] font-semibold text-indigo-600 uppercase">
                                                    {t.stage === "AGUARDANDO_FINANCEIRO" ? "Financeiro" : "Coord. DP"}
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Status */}
                                    <td className="py-3.5 px-4 text-center">
                                        {(() => {
                                            const stConfig = statusList.find(s => s.code === t.status);
                                            const color = stConfig?.color || (
                                                t.status === "RESOLVED" ? "#10b981" :
                                                t.status === "WAITING_PAYMENT" ? "#8b5cf6" :
                                                t.status === "IN_PROGRESS" ? "#f59e0b" : "#3b82f6"
                                            );
                                            const label = stConfig?.name || (
                                                t.status === "RESOLVED" ? "CONCLUÍDO" :
                                                t.status === "WAITING_PAYMENT" ? "AGUARDANDO PAGAMENTO" :
                                                t.status === "IN_PROGRESS" ? "EM ANDAMENTO" : "ABERTO"
                                            );
                                            return (
                                                <span 
                                                    className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black text-white"
                                                    style={{ backgroundColor: color }}
                                                >
                                                    {label}
                                                </span>
                                            );
                                        })()}
                                    </td>

                                    {/* SLA / Vencimento */}
                                    <td className="py-3.5 px-4 text-center">
                                        {t.status === "RESOLVED" ? (
                                            <span className="text-[11px] text-slate-400 font-semibold">
                                                Resolvido {new Date(t.resolvedAt!).toLocaleDateString("pt-BR")}
                                            </span>
                                        ) : t.isOverdue ? (
                                            <div className="inline-flex flex-col items-center">
                                                <span className="px-2 py-0.5 rounded-lg bg-red-100 text-red-800 font-black text-[10px] border border-red-300 animate-pulse">
                                                    VENCIDO
                                                </span>
                                                <span className="text-[9px] text-red-600 font-bold mt-0.5">
                                                    {new Date(t.dueAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="inline-flex flex-col items-center">
                                                <span className="text-[11px] font-bold text-slate-700">
                                                    {new Date(t.dueAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                                                </span>
                                                <span className="text-[9px] text-indigo-600 font-bold">
                                                    restam ~{t.remainingHours}h
                                                </span>
                                            </div>
                                        )}
                                    </td>

                                    {/* Ação */}
                                    <td className="py-3.5 px-4 text-right">
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-8 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 gap-1 rounded-xl"
                                        >
                                            Ver Card <ArrowUpRight className="w-3.5 h-3.5" />
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAIS */}
            <BenefitTicketDetailsModal
                ticketId={selectedTicketId}
                open={detailsModalOpen}
                onClose={() => {
                    setDetailsModalOpen(false);
                    setSelectedTicketId(null);
                }}
                onUpdated={loadData}
            />

            <BenefitTicketTypesConfigModal
                types={types}
                open={configModalOpen}
                onClose={() => setConfigModalOpen(false)}
                onUpdated={loadData}
            />
        </div>
    );
}
