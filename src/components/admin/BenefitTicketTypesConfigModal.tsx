"use client";

import { useState } from "react";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BenefitTicketTypeItem, saveBenefitTicketType } from "@/actions/benefit-tickets";
import { toast } from "sonner";
import { Settings, Plus, Check, Edit, Trash2, RefreshCw } from "lucide-react";

interface Props {
    types: BenefitTicketTypeItem[];
    open: boolean;
    onClose: () => void;
    onUpdated: () => void;
}

export function BenefitTicketTypesConfigModal({ types, open, onClose, onUpdated }: Props) {
    const [editingType, setEditingType] = useState<Partial<BenefitTicketTypeItem> | null>(null);
    const [name, setName] = useState("");
    const [category, setCategory] = useState("VT");
    const [slaHours, setSlaHours] = useState<number>(24);
    const [color, setColor] = useState("#3b82f6");
    const [keywordsStr, setKeywordsStr] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const handleStartEdit = (t?: BenefitTicketTypeItem) => {
        if (t) {
            setEditingType(t);
            setName(t.name);
            setCategory(t.category);
            setSlaHours(t.slaHours);
            setColor(t.color);
            setKeywordsStr(t.keywords.join(", "));
        } else {
            setEditingType({});
            setName("");
            setCategory("VT");
            setSlaHours(24);
            setColor("#3b82f6");
            setKeywordsStr("");
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error("Informe o nome do tipo de chamado.");
            return;
        }

        setIsSaving(true);
        try {
            const keywords = keywordsStr
                .split(",")
                .map(k => k.trim())
                .filter(Boolean);

            await saveBenefitTicketType({
                id: editingType?.id,
                name: name.trim(),
                category,
                slaHours: Number(slaHours) || 24,
                color,
                keywords,
                isActive: true
            });

            toast.success("Tipo de chamado salvo com sucesso!");
            setEditingType(null);
            onUpdated();
        } catch (err: any) {
            toast.error(err.message || "Erro ao salvar tipo de chamado");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl">
                <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/80">
                    <DialogTitle className="flex items-center justify-between text-base font-extrabold text-slate-900">
                        <span className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-indigo-600" /> Configuração de Tipos de Chamado & SLA
                        </span>
                        {!editingType && (
                            <Button 
                                size="sm" 
                                onClick={() => handleStartEdit()} 
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs gap-1.5 h-8"
                            >
                                <Plus className="w-3.5 h-3.5" /> Novo Tipo
                            </Button>
                        )}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Defina o tempo de SLA (horas úteis) e as palavras-chave que o robô do WhatsApp usará para classificar os pedidos no grupo.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {editingType ? (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                            <h4 className="text-xs font-black uppercase text-indigo-900 tracking-wider">
                                {editingType.id ? "Editar Tipo de Chamado" : "Cadastrar Novo Tipo de Chamado"}
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs font-bold text-slate-700">Nome do Tipo</Label>
                                    <Input 
                                        placeholder="Ex: Falta de Saldo Cartão Caju" 
                                        value={name} 
                                        onChange={e => setName(e.target.value)}
                                        className="text-xs rounded-xl h-9 mt-1"
                                    />
                                </div>

                                <div>
                                    <Label className="text-xs font-bold text-slate-700">Categoria Geral</Label>
                                    <Select value={category} onValueChange={setCategory}>
                                        <SelectTrigger className="text-xs rounded-xl h-9 mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="VT">Vale Transporte (VT)</SelectItem>
                                            <SelectItem value="VA">Vale Alimentação / Caju (VA)</SelectItem>
                                            <SelectItem value="ASSIDUIDADE">Prêmio de Assiduidade</SelectItem>
                                            <SelectItem value="AJUDA_CUSTO">Ajuda de Custo / Combustível</SelectItem>
                                            <SelectItem value="OUTROS">Outros Benefícios</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label className="text-xs font-bold text-slate-700">Prazo de Resolução / SLA (Horas)</Label>
                                    <Input 
                                        type="number"
                                        min={1}
                                        value={slaHours} 
                                        onChange={e => setSlaHours(Number(e.target.value))}
                                        className="text-xs rounded-xl h-9 mt-1"
                                    />
                                </div>

                                <div>
                                    <Label className="text-xs font-bold text-slate-700">Cor de Identificação</Label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <input 
                                            type="color" 
                                            value={color} 
                                            onChange={e => setColor(e.target.value)}
                                            className="w-9 h-9 rounded-xl border border-slate-200 cursor-pointer"
                                        />
                                        <Input 
                                            value={color} 
                                            onChange={e => setColor(e.target.value)}
                                            className="text-xs rounded-xl h-9 uppercase font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <Label className="text-xs font-bold text-slate-700">Palavras-chave para Detecção Automática (separadas por vírgula)</Label>
                                <Input 
                                    placeholder="Ex: caju, saldo va, refeicao, alimentacao, sem credito..."
                                    value={keywordsStr}
                                    onChange={e => setKeywordsStr(e.target.value)}
                                    className="text-xs rounded-xl h-9 mt-1"
                                />
                                <span className="text-[10px] text-slate-400 block mt-1">
                                    Quando o líder mandar qualquer uma dessas palavras no grupo, o chamado receberá este SLA.
                                </span>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setEditingType(null)}
                                    className="text-xs rounded-xl"
                                >
                                    Cancelar
                                </Button>
                                <Button 
                                    size="sm" 
                                    onClick={handleSave} 
                                    disabled={isSaving}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs gap-1.5"
                                >
                                    {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    Salvar Tipo
                                </Button>
                            </div>
                        </div>
                    ) : null}

                    {/* LISTA DE TIPOS CADASTRADOS */}
                    <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr className="font-bold text-slate-500">
                                    <th className="py-2.5 px-3">Tipo de Chamado</th>
                                    <th className="py-2.5 px-3">Categoria</th>
                                    <th className="py-2.5 px-3 text-center">SLA (Prazo)</th>
                                    <th className="py-2.5 px-3">Gatilhos / Palavras-chave</th>
                                    <th className="py-2.5 px-3 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {types.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50/50">
                                        <td className="py-3 px-3 font-bold text-slate-800">
                                            <span 
                                                className="w-2.5 h-2.5 rounded-full inline-block mr-2"
                                                style={{ backgroundColor: t.color }}
                                            />
                                            {t.name}
                                        </td>
                                        <td className="py-3 px-3">
                                            <Badge variant="outline" className="text-[10px] font-extrabold uppercase">
                                                {t.category}
                                            </Badge>
                                        </td>
                                        <td className="py-3 px-3 text-center font-black text-indigo-700">
                                            {t.slaHours}h úteis
                                        </td>
                                        <td className="py-3 px-3 text-slate-500 text-[11px]">
                                            {t.keywords.length ? t.keywords.join(", ") : "Geral"}
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                onClick={() => handleStartEdit(t)}
                                                className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600"
                                            >
                                                <Edit className="w-3.5 h-3.5" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <Button variant="outline" onClick={onClose} className="rounded-xl text-xs font-bold">
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
