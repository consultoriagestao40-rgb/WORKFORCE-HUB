"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    FileText,
    Plus,
    Save,
    RotateCcw,
    Trash2,
    Sparkles,
    Check,
    Copy,
    Info,
    Layers,
    BookOpen
} from "lucide-react";
import {
    DismissalTemplateItem,
    DISMISSAL_TEMPLATE_TAGS
} from "@/lib/dismissal-templates";
import {
    getDismissalTemplates,
    saveDismissalTemplate,
    resetDismissalTemplateToDefault,
    deleteDismissalTemplate
} from "@/actions/dismissal-templates";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function DismissalTemplatesModal() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [templates, setTemplates] = useState<DismissalTemplateItem[]>([]);
    const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("AVISO_TRABALHADO");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formTitle, setFormTitle] = useState("");
    const [formCategory, setFormCategory] = useState<string>("DISPENSA_COM_AVISO");
    const [formDescription, setFormDescription] = useState("");
    const [formBodyText, setFormBodyText] = useState("");
    const [isCreatingNew, setIsCreatingNew] = useState(false);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const list = await getDismissalTemplates();
            setTemplates(list);
            if (list.length > 0 && !selectedTemplateKey) {
                setSelectedTemplateKey(list[0].key);
            }
        } catch (e: any) {
            toast.error(e.message || "Erro ao carregar templates.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadTemplates();
        }
    }, [open]);

    useEffect(() => {
        if (!isCreatingNew && templates.length > 0) {
            const current = templates.find(t => t.key === selectedTemplateKey) || templates[0];
            if (current) {
                setFormTitle(current.title);
                setFormCategory(current.category);
                setFormDescription(current.description || "");
                setFormBodyText(current.bodyText);
            }
        }
    }, [selectedTemplateKey, templates, isCreatingNew]);

    const handleSelectTemplate = (key: string) => {
        setIsCreatingNew(false);
        setSelectedTemplateKey(key);
    };

    const handleStartNewTemplate = () => {
        setIsCreatingNew(true);
        setFormTitle("Novo Modelo de Notificação");
        setFormCategory("DISPENSA_COM_AVISO");
        setFormDescription("Descrição personalizada do modelo...");
        setFormBodyText(`NOTIFICAÇÃO DE DESLIGAMENTO

{{EMPRESA_NOME}}
CNPJ: {{EMPRESA_CNPJ}}

Ao
Sr(a). {{COLABORADOR_NOME}}
CPF: {{CPF}}

Pelo presente notificamos que os seus serviços não mais serão utilizados pela nossa empresa.

{{CIDADE_UF}}, {{DATA_EXTENSO}}.

__________________________                __________________________
       Empregador                                 Empregado        `);
    };

    const handleSave = async () => {
        if (!formTitle.trim() || !formBodyText.trim()) {
            toast.error("Preencha o título e o texto do modelo.");
            return;
        }

        setSaving(true);
        try {
            const current = templates.find(t => t.key === selectedTemplateKey);
            await saveDismissalTemplate({
                id: isCreatingNew ? undefined : current?.id,
                key: isCreatingNew ? undefined : current?.key,
                title: formTitle.trim(),
                category: formCategory as any,
                description: formDescription.trim(),
                bodyText: formBodyText
            });

            toast.success("Modelo de aviso salvo com sucesso!");
            setIsCreatingNew(false);
            await loadTemplates();
            router.refresh();
        } catch (e: any) {
            toast.error(e.message || "Erro ao salvar modelo.");
        } finally {
            setSaving(false);
        }
    };

    const handleResetDefault = async (key: string) => {
        if (!confirm("Deseja restaurar este modelo para o texto padrão oficial da CLT?")) return;
        setSaving(true);
        try {
            await resetDismissalTemplateToDefault(key);
            toast.success("Modelo restaurado para o padrão oficial!");
            await loadTemplates();
            router.refresh();
        } catch (e: any) {
            toast.error(e.message || "Erro ao restaurar template.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id?: string) => {
        if (!id) return;
        if (!confirm("Deseja realmente excluir este modelo customizado?")) return;
        setSaving(true);
        try {
            await deleteDismissalTemplate(id);
            toast.success("Modelo excluído com sucesso!");
            setIsCreatingNew(false);
            await loadTemplates();
            router.refresh();
        } catch (e: any) {
            toast.error(e.message || "Erro ao excluir template.");
        } finally {
            setSaving(false);
        }
    };

    const copyTag = (tag: string) => {
        navigator.clipboard.writeText(tag);
        toast.info(`Tag ${tag} copiada! Cole no texto onde desejar.`);
    };

    const currentSelected = templates.find(t => t.key === selectedTemplateKey);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="gap-1.5 border-slate-200 text-slate-700 hover:text-indigo-600 font-bold h-9 px-3.5 rounded-xl shadow-xs text-xs bg-white shrink-0"
                >
                    <BookOpen className="w-4 h-4 text-indigo-500" />
                    <span>Modelos de Avisos & Rescisão</span>
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white rounded-3xl shadow-2xl">
                <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-[0.3em] mb-1">
                            <Sparkles className="w-3.5 h-3.5" /> Segurança Jurídica & CLT
                        </div>
                        <DialogTitle className="text-xl font-black text-slate-900">
                            Modelos de Avisos Prévios & Notificações de Rescisão
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Edite os textos oficiais dos avisos ou crie novos modelos para utilizar na dispensa de colaboradores.
                        </DialogDescription>
                    </div>

                    <Button
                        size="sm"
                        onClick={handleStartNewTemplate}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-9 px-3.5 rounded-xl shadow-xs"
                    >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Novo Modelo
                    </Button>
                </DialogHeader>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
                    {/* Lista Lateral de Modelos */}
                    <div className="md:col-span-4 border-r border-slate-100 p-4 space-y-2 overflow-y-auto bg-slate-50/40">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-2 mb-2">
                            Modelos Cadastrados ({templates.length})
                        </span>

                        {templates.map((t) => {
                            const isSelected = !isCreatingNew && selectedTemplateKey === t.key;
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => handleSelectTemplate(t.key)}
                                    className={`w-full text-left p-3 rounded-2xl border transition-all ${
                                        isSelected
                                            ? 'bg-white border-indigo-300 shadow-sm ring-1 ring-indigo-200'
                                            : 'bg-white/60 border-slate-200/80 hover:bg-white hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-1 mb-1">
                                        <h4 className="font-extrabold text-xs text-slate-800 line-clamp-1">{t.title}</h4>
                                        {t.isDefault && (
                                            <Badge variant="secondary" className="text-[9px] font-black px-1.5 py-0 uppercase">
                                                Oficial
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{t.description}</p>
                                </button>
                            );
                        })}

                        {isCreatingNew && (
                            <div className="w-full text-left p-3 rounded-2xl border bg-indigo-50/50 border-indigo-300 shadow-sm">
                                <Badge className="bg-indigo-600 text-white text-[9px] font-bold uppercase mb-1">
                                    Criando Novo
                                </Badge>
                                <h4 className="font-black text-xs text-indigo-900">{formTitle}</h4>
                            </div>
                        )}
                    </div>

                    {/* Editor do Modelo */}
                    <div className="md:col-span-8 flex flex-col overflow-hidden p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-700">Título do Modelo</Label>
                                <Input
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    placeholder="Ex: Aviso Prévio Trabalhado"
                                    className="h-9 text-xs bg-white rounded-xl"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-700">Modalidade / Categoria</Label>
                                <Select value={formCategory} onValueChange={(val: any) => setFormCategory(val)}>
                                    <SelectTrigger className="h-9 text-xs bg-white rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DISPENSA_COM_AVISO">Dispensa com Aviso Trabalhado</SelectItem>
                                        <SelectItem value="DISPENSA_SEM_AVISO">Dispensa com Aviso Indenizado</SelectItem>
                                        <SelectItem value="TERMINO_EXP_ANTECIPADO">Término de Experiência (Antecipado)</SelectItem>
                                        <SelectItem value="TERMINO_EXP_PRAZO">Término de Experiência (No Prazo)</SelectItem>
                                        <SelectItem value="OUTROS">Outros Modelos</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-700">Descrição / Finalidade</Label>
                            <Input
                                value={formDescription}
                                onChange={e => setFormDescription(e.target.value)}
                                placeholder="Breve resumo da utilização deste modelo..."
                                className="h-9 text-xs bg-white rounded-xl"
                            />
                        </div>

                        {/* Tags dinâmicas */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                    <Info className="w-3.5 h-3.5 text-indigo-500" /> Tags Dinâmicas (Clique para copiar)
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                                {DISMISSAL_TEMPLATE_TAGS.map((t) => (
                                    <button
                                        key={t.tag}
                                        type="button"
                                        onClick={() => copyTag(t.tag)}
                                        className="text-[10px] font-mono bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 px-2 py-0.5 rounded-md transition-colors"
                                        title={t.desc}
                                    >
                                        {t.tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Texto do Documento */}
                        <div className="flex-1 flex flex-col space-y-1 overflow-hidden min-h-[220px]">
                            <Label className="text-xs font-bold text-slate-700">Texto Completo da Notificação</Label>
                            <Textarea
                                value={formBodyText}
                                onChange={e => setFormBodyText(e.target.value)}
                                placeholder="Digite ou cole o texto do modelo de aviso..."
                                className="flex-1 font-mono text-xs bg-white rounded-xl p-3 border-slate-200 resize-none leading-relaxed"
                            />
                        </div>

                        {/* Rodapé de Ações */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {!isCreatingNew && currentSelected?.isDefault && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleResetDefault(currentSelected.key)}
                                        disabled={saving}
                                        className="text-xs text-slate-600 hover:text-amber-600 h-9"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                        Restaurar Padrão Oficial
                                    </Button>
                                )}

                                {!isCreatingNew && !currentSelected?.isDefault && currentSelected?.id && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDelete(currentSelected.id)}
                                        disabled={saving}
                                        className="text-xs text-red-600 hover:bg-red-50 h-9"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                                        Excluir Modelo
                                    </Button>
                                )}
                            </div>

                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs"
                            >
                                <Save className="w-3.5 h-3.5 mr-1.5" />
                                Salvar Modelo
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
