"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Loader2, Sparkles, Upload, FileText, Eye, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { createRole, updateRole } from "@/app/actions";
import { parseDocxOrdemServico, generateRolePreviewPdfBase64, generateTemplatePreviewPdfBase64 } from "@/actions/role-templates";
import { OS_TEMPLATES, OsTemplate } from "@/lib/os-templates";
import { toast } from "sonner";

interface RoleOsModalProps {
    role?: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function RoleOsModal({ role, open, onOpenChange, onSuccess }: RoleOsModalProps) {
    const [loading, setLoading] = useState(false);
    const [parsingDocx, setParsingDocx] = useState(false);
    const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Form fields state
    const [name, setName] = useState(role?.name || "");
    const [cbo, setCbo] = useState(role?.cbo || "");
    const [description, setDescription] = useState(role?.description || "");
    const [atividadeDescricao, setAtividadeDescricao] = useState(role?.atividadeDescricao || "");
    const [riscoFisico, setRiscoFisico] = useState(role?.riscoFisico || "");
    const [riscoQuimico, setRiscoQuimico] = useState(role?.riscoQuimico || "");
    const [riscoBiologico, setRiscoBiologico] = useState(role?.riscoBiologico || "");
    const [riscoErgonomico, setRiscoErgonomico] = useState(role?.riscoErgonomico || "");
    const [riscoAcidentes, setRiscoAcidentes] = useState(role?.riscoAcidentes || "");
    const [episNecessarios, setEpisNecessarios] = useState(role?.episNecessarios || "");
    const [ordemServicoName, setOrdemServicoName] = useState(role?.ordemServicoName || "");

    // Quando abrir para um cargo específico, sincroniza os estados
    useState(() => {
        if (role) {
            setName(role.name || "");
            setCbo(role.cbo || "");
            setDescription(role.description || "");
            setAtividadeDescricao(role.atividadeDescricao || "");
            setRiscoFisico(role.riscoFisico || "");
            setRiscoQuimico(role.riscoQuimico || "");
            setRiscoBiologico(role.riscoBiologico || "");
            setRiscoErgonomico(role.riscoErgonomico || "");
            setRiscoAcidentes(role.riscoAcidentes || "");
            setEpisNecessarios(role.episNecessarios || "");
            setOrdemServicoName(role.ordemServicoName || "");
        }
    });

    const handleApplyTemplate = (templateKey: string) => {
        const template = OS_TEMPLATES.find(t => t.key === templateKey);
        if (!template) return;

        if (!name) setName(template.name);
        setCbo(template.cbo);
        if (!description) setDescription(template.description);
        setAtividadeDescricao(template.atividadeDescricao);
        setRiscoFisico(template.riscoFisico);
        setRiscoQuimico(template.riscoQuimico);
        setRiscoBiologico(template.riscoBiologico);
        setRiscoErgonomico(template.riscoErgonomico);
        setRiscoAcidentes(template.riscoAcidentes);
        setEpisNecessarios(template.episNecessarios);
        setOrdemServicoName(`Template_${template.key}.docx`);
        toast.success(`Campos preenchidos com o modelo oficial: "${template.name}"!`);
    };

    const handleDocxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith(".docx")) {
            toast.error("Por favor, selecione um arquivo no formato Word (.docx)");
            return;
        }

        setParsingDocx(true);
        toast.info("Processando arquivo Word com IA...");

        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = reader.result as string;
                const res = await parseDocxOrdemServico(base64, file.name);

                if (res.success && res.extracted) {
                    const ext = res.extracted;
                    if (ext.name && !name) setName(ext.name);
                    if (ext.cbo) setCbo(ext.cbo);
                    if (ext.description && !description) setDescription(ext.description);
                    if (ext.atividadeDescricao) setAtividadeDescricao(ext.atividadeDescricao);
                    if (ext.riscoFisico) setRiscoFisico(ext.riscoFisico);
                    if (ext.riscoQuimico) setRiscoQuimico(ext.riscoQuimico);
                    if (ext.riscoBiologico) setRiscoBiologico(ext.riscoBiologico);
                    if (ext.riscoErgonomico) setRiscoErgonomico(ext.riscoErgonomico);
                    if (ext.riscoAcidentes) setRiscoAcidentes(ext.riscoAcidentes);
                    if (ext.episNecessarios) setEpisNecessarios(ext.episNecessarios);
                    setOrdemServicoName(file.name);
                    toast.success("Dados da Ordem de Serviço extraídos com sucesso do arquivo Word!");
                } else {
                    toast.error(res.error || "Erro ao processar arquivo Word");
                }
                setParsingDocx(false);
            };
            reader.readAsDataURL(file);
        } catch (err: any) {
            console.error(err);
            toast.error("Falha ao ler arquivo");
            setParsingDocx(false);
        }
    };

    const handlePreviewPdf = async () => {
        if (!name.trim()) {
            toast.error("Preencha ao menos o nome do cargo para gerar pré-visualização.");
            return;
        }
        setLoadingPreview(true);
        try {
            if (role?.id) {
                const pdfData = await generateRolePreviewPdfBase64(role.id);
                setPreviewPdfUrl(pdfData);
            } else {
                const pdfData = await generateTemplatePreviewPdfBase64("auxiliar-limpeza");
                setPreviewPdfUrl(pdfData);
            }
        } catch (e: any) {
            toast.error(e.message || "Erro ao gerar PDF de visualização");
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("O nome do cargo é obrigatório.");
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            if (role?.id) formData.append("id", role.id);
            formData.append("name", name);
            formData.append("cbo", cbo);
            formData.append("description", description);
            formData.append("atividadeDescricao", atividadeDescricao);
            formData.append("riscoFisico", riscoFisico);
            formData.append("riscoQuimico", riscoQuimico);
            formData.append("riscoBiologico", riscoBiologico);
            formData.append("riscoErgonomico", riscoErgonomico);
            formData.append("riscoAcidentes", riscoAcidentes);
            formData.append("episNecessarios", episNecessarios);

            if (role?.id) {
                await updateRole(formData);
                toast.success("Cargo e Ordem de Serviço atualizados com sucesso!");
            } else {
                await createRole(formData);
                toast.success("Novo cargo cadastrado com sucesso!");
            }

            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Erro ao salvar cargo");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl">
                <div className="p-6 bg-slate-900 text-white rounded-t-2xl flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider mb-1">
                            <ShieldCheck className="w-4 h-4" />
                            {role ? 'Editar Cargo & Ordem de Serviço (NR-1)' : 'Cadastrar Novo Cargo & Ordem de Serviço (NR-1)'}
                        </div>
                        <DialogTitle className="text-xl font-black text-white">
                            {role ? role.name : 'Novo Cargo / Função'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-300 mt-0.5">
                            Configure as atividades, riscos ocupacionais e EPIs que compõem o documento oficial de admissão.
                        </DialogDescription>
                    </div>

                    <div className="flex items-center gap-2">
                        {role?.id && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handlePreviewPdf}
                                disabled={loadingPreview}
                                className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 text-xs font-bold"
                            >
                                <Eye className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                                {loadingPreview ? 'Gerando...' : 'Ver PDF da OS'}
                            </Button>
                        )}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Ações Rápidas: Modelos Prontos ou Upload Word */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-gradient-to-r from-indigo-50/70 to-emerald-50/70 border border-indigo-100 rounded-xl">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                Aplicar Modelo Padrão Pronto (1 Clique)
                            </Label>
                            <Select onValueChange={handleApplyTemplate}>
                                <SelectTrigger className="h-9 bg-white text-xs font-semibold border-indigo-200">
                                    <SelectValue placeholder="Selecione um modelo oficial (ex: Limpeza, Portaria...)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {OS_TEMPLATES.map(t => (
                                        <SelectItem key={t.key} value={t.key} className="text-xs">
                                            <span className="font-bold">{t.name}</span> <span className="text-slate-400 font-mono">(CBO: {t.cbo})</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                                Subir Ordem de Serviço em Word (.docx)
                            </Label>
                            <label className={`w-full h-9 flex items-center justify-center gap-2 border border-dashed border-emerald-400 rounded-lg bg-white hover:bg-emerald-50/50 cursor-pointer text-xs font-bold text-emerald-700 transition-all ${parsingDocx ? 'opacity-50 pointer-events-none' : ''}`}>
                                <FileText className="w-3.5 h-3.5" />
                                {parsingDocx ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Lendo Word com IA...</span>
                                    </>
                                ) : (
                                    <span>{ordemServicoName ? `Arquivo: ${ordemServicoName}` : "Anexar Arquivo Word (.docx)"}</span>
                                )}
                                <input type="file" accept=".docx" onChange={handleDocxUpload} disabled={parsingDocx} className="hidden" />
                            </label>
                        </div>
                    </div>

                    {/* Dados Básicos */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2 space-y-1.5">
                            <Label htmlFor="name" className="text-xs font-bold text-slate-700">Nome do Cargo / Função *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Ex: Auxiliar de Serviços Gerais"
                                required
                                className="h-9 text-xs"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="cbo" className="text-xs font-bold text-slate-700">CBO (Código Brasileiro de Ocupações)</Label>
                            <Input
                                id="cbo"
                                value={cbo}
                                onChange={e => setCbo(e.target.value)}
                                placeholder="5143-20"
                                className="h-9 text-xs font-mono"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="description" className="text-xs font-bold text-slate-700">Descrição Geral da Função (Opcional)</Label>
                        <Input
                            id="description"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Higienização, limpeza e conservação de ambientes..."
                            className="h-9 text-xs"
                        />
                    </div>

                    {/* Descrição Detalhada da Atividade */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="atividadeDescricao" className="text-xs font-bold text-slate-800">
                                Descrição Detalhada das Atividades (Relato Conforme Observação Técnica)
                            </Label>
                            <span className="text-[10px] text-slate-400">Sai no Box 2 da Ordem de Serviço</span>
                        </div>
                        <Textarea
                            id="atividadeDescricao"
                            value={atividadeDescricao}
                            onChange={e => setAtividadeDescricao(e.target.value)}
                            rows={3}
                            placeholder="(RELATO DO FUNCIONÁRIO) Realizam a higienização de superfícies variadas. Utilizam produtos químicos e água sanitária..."
                            className="text-xs leading-relaxed"
                        />
                    </div>

                    {/* Riscos Ocupacionais */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                        <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">Riscos Ocupacionais (NR-9)</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-slate-600">Riscos Químicos</Label>
                                <Input
                                    value={riscoQuimico}
                                    onChange={e => setRiscoQuimico(e.target.value)}
                                    placeholder="Água Sanitária, detergente líquido, desinfetantes..."
                                    className="h-8 text-xs bg-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-slate-600">Riscos de Acidentes</Label>
                                <Input
                                    value={riscoAcidentes}
                                    onChange={e => setRiscoAcidentes(e.target.value)}
                                    placeholder="Quedas de mesmo nível, piso escorregadio, choque elétrico..."
                                    className="h-8 text-xs bg-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-slate-600">Riscos Físicos</Label>
                                <Input
                                    value={riscoFisico}
                                    onChange={e => setRiscoFisico(e.target.value)}
                                    placeholder="Ruído contínuo, umidade em áreas molhadas, calor..."
                                    className="h-8 text-xs bg-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-slate-600">Riscos Ergonômicos</Label>
                                <Input
                                    value={riscoErgonomico}
                                    onChange={e => setRiscoErgonomico(e.target.value)}
                                    placeholder="Postura inadequada, esforço repetitivo, transporte de peso..."
                                    className="h-8 text-xs bg-white"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px] font-bold text-slate-600">Riscos Biológicos</Label>
                            <Input
                                value={riscoBiologico}
                                onChange={e => setRiscoBiologico(e.target.value)}
                                placeholder="Vírus, bactérias e fungos em sanitários e depósitos de lixo..."
                                className="h-8 text-xs bg-white"
                            />
                        </div>
                    </div>

                    {/* EPIs Obrigatórios */}
                    <div className="space-y-1.5">
                        <Label htmlFor="episNecessarios" className="text-xs font-bold text-slate-800">
                            EPIs - Equipamentos de Proteção Individual de Uso Obrigatório (NR-6)
                        </Label>
                        <Input
                            id="episNecessarios"
                            value={episNecessarios}
                            onChange={e => setEpisNecessarios(e.target.value)}
                            placeholder="Sapato de segurança antiderrapante, Luva de Látex/Nitrílica, Óculos de segurança, Avental e Uniforme"
                            className="h-9 text-xs"
                        />
                    </div>

                    {/* Botões do Rodapé */}
                    <div className="flex items-center justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-bold" disabled={loading}>
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {role ? 'Salvar Alterações da Ordem de Serviço' : 'Cadastrar Cargo & Ordem de Serviço'}
                        </Button>
                    </div>
                </form>

                {/* Modal de Pré-visualização do PDF */}
                {previewPdfUrl && (
                    <Dialog open={!!previewPdfUrl} onOpenChange={() => setPreviewPdfUrl(null)}>
                        <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col rounded-2xl">
                            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-emerald-400" />
                                    <span className="font-bold text-sm">Pré-visualização da Ordem de Serviço (NR-1) - {name}</span>
                                </div>
                                <Button size="sm" variant="outline" className="bg-slate-800 text-xs text-white" onClick={() => {
                                    const link = document.createElement("a");
                                    link.href = previewPdfUrl;
                                    link.download = `Ordem_Servico_${name.replace(/\s+/g, "_")}.pdf`;
                                    link.click();
                                }}>
                                    Baixar PDF
                                </Button>
                            </div>
                            <iframe src={previewPdfUrl} className="w-full flex-1 border-0" title="PDF Preview" />
                        </DialogContent>
                    </Dialog>
                )}
            </DialogContent>
        </Dialog>
    );
}
