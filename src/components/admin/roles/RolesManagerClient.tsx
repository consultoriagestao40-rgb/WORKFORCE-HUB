"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
    Briefcase,
    Users,
    Trash2,
    Plus,
    Pencil,
    FileText,
    Sparkles,
    Upload,
    Eye,
    CheckCircle2,
    AlertTriangle,
    ShieldCheck,
    Search,
    Download,
    Layers,
    BookOpen
} from "lucide-react";
import { RoleOsModal } from "./RoleOsModal";
import { OS_TEMPLATES, OsTemplate } from "@/lib/os-templates";
import { applyTemplateToRole, createRoleFromTemplate, generateRolePreviewPdfBase64, generateTemplatePreviewPdfBase64 } from "@/actions/role-templates";
import { deleteRole } from "@/app/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface RolesManagerClientProps {
    roles: any[];
}

export function RolesManagerClient({ roles }: RolesManagerClientProps) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<"roles" | "templates" | "upload">("roles");
    const [selectedRoleForModal, setSelectedRoleForModal] = useState<any | null>(null);
    const [isOsModalOpen, setIsOsModalOpen] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [pdfPreviewTitle, setPdfPreviewTitle] = useState("");
    const [loadingPdf, setLoadingPdf] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    // Contadores de status
    const totalRoles = roles.length;
    const configuredRoles = roles.filter(r => r.atividadeDescricao || r.ordemServicoText).length;
    const pendingRoles = totalRoles - configuredRoles;

    // Filtro de busca
    const filteredRoles = roles.filter(r => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
            r.name.toLowerCase().includes(q) ||
            (r.cbo && r.cbo.toLowerCase().includes(q)) ||
            (r.description && r.description.toLowerCase().includes(q))
        );
    });

    const handleOpenCreateModal = () => {
        setSelectedRoleForModal(null);
        setIsOsModalOpen(true);
    };

    const handleOpenEditModal = (role: any) => {
        setSelectedRoleForModal(role);
        setIsOsModalOpen(true);
    };

    const handleQuickApplyTemplate = async (roleId: string, templateKey: string) => {
        setActionLoadingId(roleId);
        try {
            await applyTemplateToRole(roleId, templateKey);
            toast.success("Template de Ordem de Serviço aplicado ao cargo com sucesso!");
            router.refresh();
        } catch (e: any) {
            toast.error(e.message || "Erro ao aplicar template");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleCreateFromTemplate = async (templateKey: string) => {
        setActionLoadingId(templateKey);
        try {
            await createRoleFromTemplate(templateKey);
            toast.success("Novo cargo criado com sucesso a partir do modelo oficial!");
            router.refresh();
        } catch (e: any) {
            toast.error(e.message || "Erro ao criar cargo do template");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handlePreviewRolePdf = async (role: any) => {
        setLoadingPdf(true);
        setPdfPreviewTitle(`Ordem de Serviço (NR-1) - ${role.name}`);
        try {
            const pdfBase64 = await generateRolePreviewPdfBase64(role.id);
            setPdfPreviewUrl(pdfBase64);
        } catch (e: any) {
            toast.error(e.message || "Erro ao gerar PDF");
        } finally {
            setLoadingPdf(false);
        }
    };

    const handlePreviewTemplatePdf = async (template: OsTemplate) => {
        setLoadingPdf(true);
        setPdfPreviewTitle(`Modelo Oficial (NR-1) - ${template.name}`);
        try {
            const pdfBase64 = await generateTemplatePreviewPdfBase64(template.key);
            setPdfPreviewUrl(pdfBase64);
        } catch (e: any) {
            toast.error(e.message || "Erro ao gerar PDF do modelo");
        } finally {
            setLoadingPdf(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            {/* Header da Página */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-[0.3em] mb-1.5">
                        <Briefcase className="fill-current w-3.5 h-3.5" /> Gestão de Funções & Segurança do Trabalho
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Cargos & Ordens de Serviço (NR-1)</h1>
                    <p className="text-slate-500 text-sm font-medium">
                        Gerencie as funções, riscos ocupacionais e os templates oficiais de Ordens de Serviço utilizados na admissão.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <Button
                        onClick={handleOpenCreateModal}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-xs"
                    >
                        <Plus className="w-4 h-4 mr-1.5" /> Novo Cargo & Ordem de Serviço
                    </Button>
                </div>
            </div>

            {/* Cards de Métricas e Ações Rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Cargos</span>
                        <h3 className="text-2xl font-black text-slate-900">{totalRoles}</h3>
                        <p className="text-[11px] text-slate-500">Cargos cadastrados no sistema</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                        <Briefcase className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">OS Configurada (NR-1)</span>
                        <h3 className="text-2xl font-black text-emerald-700">{configuredRoles}</h3>
                        <p className="text-[11px] text-emerald-600 font-semibold">Prontos para admissão automática</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Modelos Oficiais Disponíveis</span>
                        <h3 className="text-2xl font-black text-slate-900">{OS_TEMPLATES.length}</h3>
                        <p className="text-[11px] text-slate-500">Templates NR-1 prontos para aplicar</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                        <Sparkles className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Navegação por Abas */}
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <TabsList className="bg-slate-100 p-1 rounded-xl">
                        <TabsTrigger value="roles" className="text-xs font-bold px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-xs">
                            <Layers className="w-3.5 h-3.5 mr-1.5" />
                            Cargos & Ordens de Serviço ({totalRoles})
                        </TabsTrigger>
                        <TabsTrigger value="templates" className="text-xs font-bold px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-xs">
                            <BookOpen className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                            Catálogo de Modelos NR-1 ({OS_TEMPLATES.length})
                        </TabsTrigger>
                    </TabsList>

                    {activeTab === "roles" && (
                        <div className="relative w-full sm:w-72">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar cargo, CBO..."
                                className="pl-9 h-9 text-xs bg-white rounded-xl"
                            />
                        </div>
                    )}
                </div>

                {/* TAB 1: LISTA DE CARGOS */}
                <TabsContent value="roles" className="space-y-4 pt-2">
                    <Card className="border border-slate-200/80 shadow-xs rounded-2xl overflow-hidden">
                        <CardHeader className="bg-slate-50/70 border-b border-slate-100 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm font-black text-slate-800">Cargos Cadastrados</CardTitle>
                                    <CardDescription className="text-xs">
                                        Clique no botão de editar para alterar as atividades e riscos ocupacionais de qualquer função.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="p-0">
                            <table className="w-full">
                                <thead className="bg-slate-50/50 border-b border-slate-100">
                                    <tr>
                                        <th className="text-left p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Cargo & CBO</th>
                                        <th className="text-left p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Status da OS (NR-1)</th>
                                        <th className="text-left p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Riscos Ocupacionais</th>
                                        <th className="text-center p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Colaboradores</th>
                                        <th className="text-right p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredRoles.map((role) => {
                                        const hasOs = !!(role.atividadeDescricao || role.ordemServicoText);
                                        return (
                                            <tr key={role.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="p-4">
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <Briefcase className="w-4 h-4 text-indigo-600 shrink-0" />
                                                            <span className="font-black text-slate-900 text-sm">{role.name}</span>
                                                        </div>
                                                        {role.cbo && (
                                                            <span className="text-[11px] font-mono font-bold text-slate-400 ml-6 block">
                                                                CBO: {role.cbo}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="p-4">
                                                    {hasOs ? (
                                                        <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-black uppercase tracking-wider">
                                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                                            OS Configurada
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-black uppercase tracking-wider">
                                                            <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
                                                            Sem OS
                                                        </Badge>
                                                    )}
                                                </td>

                                                <td className="p-4">
                                                    <div className="text-xs text-slate-600 max-w-xs truncate" title={role.riscoQuimico || role.riscoAcidentes || "Padrão de segurança"}>
                                                        {role.riscoQuimico ? `Químico: ${role.riscoQuimico}` : role.riscoAcidentes ? `Acidentes: ${role.riscoAcidentes}` : '-'}
                                                    </div>
                                                </td>

                                                <td className="p-4 text-center">
                                                    <Badge variant="secondary" className="font-bold text-xs">
                                                        <Users className="w-3 h-3 mr-1" />
                                                        {role._count?.employees || 0}
                                                    </Badge>
                                                </td>

                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {/* Botão de Ver PDF */}
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handlePreviewRolePdf(role)}
                                                            disabled={loadingPdf}
                                                            className="h-8 px-2.5 text-xs font-bold text-slate-700 hover:text-indigo-600 hover:border-indigo-200"
                                                            title="Visualizar PDF da Ordem de Serviço"
                                                        >
                                                            <Eye className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                                                            Ver PDF
                                                        </Button>

                                                        {/* Botão de Editar */}
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleOpenEditModal(role)}
                                                            className="h-8 px-2.5 text-xs font-bold text-slate-700 hover:text-blue-600"
                                                            title="Editar Cargo e Ordem de Serviço"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5 mr-1" />
                                                            Editar
                                                        </Button>

                                                        {/* Botão de Excluir */}
                                                        <form action={deleteRole} className="inline">
                                                            <input type="hidden" name="id" value={role.id} />
                                                            <Button
                                                                type="submit"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                                disabled={(role._count?.employees || 0) > 0}
                                                                title={(role._count?.employees || 0) > 0 ? "Cargo em uso por colaboradores." : "Deletar cargo"}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </form>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {filteredRoles.length === 0 && (
                                <div className="p-12 text-center">
                                    <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-500 font-bold text-sm">Nenhum cargo encontrado.</p>
                                    <p className="text-xs text-slate-400 mt-1">Crie um novo cargo ou utilize um dos modelos oficiais.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: CATÁLOGO DE MODELOS OFICIAIS */}
                <TabsContent value="templates" className="space-y-4 pt-2">
                    <div className="bg-gradient-to-r from-indigo-50 via-teal-50 to-emerald-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-indigo-600" />
                                Modelos Oficiais de Segurança do Trabalho (NR-1, NR-6, NR-9 e NR-17)
                            </h3>
                            <p className="text-xs text-slate-500">
                                Modelos completos com CBO oficial, descrição técnica das atividades, mapeamento de riscos e EPIs obrigatórios prontos para uso.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {OS_TEMPLATES.map((t) => (
                            <Card key={t.key} className="border border-slate-200 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden bg-white">
                                <CardHeader className="p-4 bg-slate-50/50 border-b border-slate-100">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                                {t.category}
                                            </span>
                                            <h4 className="font-extrabold text-slate-900 text-sm leading-snug">{t.name}</h4>
                                            <span className="text-[11px] font-mono text-slate-400 font-bold block">CBO: {t.cbo}</span>
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="p-4 space-y-3 flex-1">
                                    <p className="text-xs text-slate-500 line-clamp-2">{t.description}</p>

                                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px]">
                                        <div>
                                            <span className="font-bold text-slate-700 block">Riscos Principais:</span>
                                            <span className="text-slate-500 line-clamp-1">{t.riscoQuimico || t.riscoAcidentes}</span>
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-700 block">EPIs Recomendados:</span>
                                            <span className="text-slate-500 line-clamp-1">{t.episNecessarios}</span>
                                        </div>
                                    </div>
                                </CardContent>

                                <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handlePreviewTemplatePdf(t)}
                                        className="text-xs font-bold text-slate-600 hover:text-indigo-600 h-8"
                                    >
                                        <Eye className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                                        Ver Modelo
                                    </Button>

                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => handleCreateFromTemplate(t.key)}
                                        disabled={actionLoadingId === t.key}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-3 rounded-lg shadow-xs"
                                    >
                                        <Plus className="w-3.5 h-3.5 mr-1" />
                                        Criar Cargo
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Modal de Criação / Edição de Cargo & OS */}
            <RoleOsModal
                role={selectedRoleForModal}
                open={isOsModalOpen}
                onOpenChange={setIsOsModalOpen}
                onSuccess={() => {
                    router.refresh();
                }}
            />

            {/* Modal de Pré-visualização do PDF */}
            {pdfPreviewUrl && (
                <Dialog open={!!pdfPreviewUrl} onOpenChange={() => setPdfPreviewUrl(null)}>
                    <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col rounded-2xl">
                        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-emerald-400" />
                                <span className="font-bold text-sm">{pdfPreviewTitle}</span>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                className="bg-slate-800 text-xs text-white"
                                onClick={() => {
                                    const link = document.createElement("a");
                                    link.href = pdfPreviewUrl;
                                    link.download = `${pdfPreviewTitle.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
                                    link.click();
                                }}
                            >
                                <Download className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                                Baixar PDF
                            </Button>
                        </div>
                        <iframe src={pdfPreviewUrl} className="w-full flex-1 border-0" title="PDF Preview" />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
