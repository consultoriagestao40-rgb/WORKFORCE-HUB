"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Calendar, Zap, FileText, User, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { confirmOnvio } from "@/actions/recruitment";

interface OnvioPanelProps {
    candidateId: string;
    candidateName: string;
    email?: string;
    phone?: string;
    cpf?: string;
    birthDate?: string;
    gender?: string;
    address?: string;
    rg?: string;
    roleTitle?: string;
    salary?: string | number;
    startDate?: string;
    companyName?: string;
    extraFields?: any;
    onvioLaunched?: boolean;
    onvioConfirmedAt?: Date | string | null;
    onUpdate: () => void;
}

export function OnvioPanel({
    candidateId,
    candidateName,
    email = "",
    phone = "",
    cpf = "",
    birthDate = "",
    gender = "",
    address = "",
    rg = "",
    roleTitle = "",
    salary = "",
    startDate = "",
    companyName = "",
    extraFields = {},
    onvioLaunched,
    onvioConfirmedAt,
    onUpdate,
}: OnvioPanelProps) {
    const [confirming, setConfirming] = useState(false);

    // Form fields prefilled from props & extraFields
    const [formData, setFormData] = useState({
        name: candidateName || "",
        cpf: cpf || extraFields?.cpf || "",
        email: email || extraFields?.email || "",
        phone: phone || extraFields?.phone || "",
        birthDate: birthDate || extraFields?.birthDate || "",
        gender: gender || extraFields?.gender || "Não informado",
        address: address || extraFields?.address || "",
        rg: rg || extraFields?.rg || "",
        role: roleTitle || extraFields?.role || "",
        salary: salary ? String(salary) : (extraFields?.salary || ""),
        startDate: startDate || extraFields?.startDate || "",
        company: companyName || extraFields?.company || "",
    });

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSendToExtension = () => {
        const event = new CustomEvent("workforceRpaCapture", {
            detail: {
                name: formData.name,
                cpf: formData.cpf,
                phone: formData.phone,
                email: formData.email,
                role: formData.role,
                salary: formData.salary,
                company: formData.company,
                startDate: formData.startDate,
                birthDate: formData.birthDate,
                gender: formData.gender,
                address: formData.address,
                rg: formData.rg,
                ...extraFields,
            }
        });
        document.dispatchEvent(event);
        toast.success("Dados de Admissão capturados pela extensão! Vá para o portal Onvio/Thomson Reuters e clique em Preencher.");
    };

    async function handleConfirm() {
        setConfirming(true);
        try {
            await confirmOnvio(candidateId);
            toast.success("Admissão confirmada no Onvio! Candidato avançado para Cadastro de Benefícios.");
            onUpdate();
        } catch (e: any) {
            toast.error(e.message || "Erro ao confirmar Onvio");
        } finally {
            setConfirming(false);
        }
    }

    const confirmedDate = onvioConfirmedAt
        ? new Date(onvioConfirmedAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
          })
        : null;

    return (
        <div className="space-y-6">
            {/* Header / Status Banner */}
            {onvioLaunched ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800 text-sm font-medium shadow-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                        <span className="font-bold">Lançamento Confirmado no Onvio</span>
                        <span className="block text-xs text-emerald-700">O cadastro do colaborador foi concluído no portal de contabilidade.</span>
                    </div>
                    {confirmedDate && (
                        <span className="ml-auto text-xs font-normal opacity-80 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
                            <Calendar className="w-3 h-3" />
                            {confirmedDate}
                        </span>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-amber-50 border-amber-200 text-amber-900 text-sm font-medium shadow-sm">
                    <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                    <div>
                        <span className="font-bold">Etapa de Admissão Ativa (Onvio)</span>
                        <span className="block text-xs text-amber-700">Confira o formulário abaixo preenchido com a IA e envie para o portal Thomson Reuters via extensão Chrome.</span>
                    </div>
                </div>
            )}

            {/* Formulário de Dados de Admissão Preenchido com IA */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600" />
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm">Formulário de Cadastro de Admissão</h3>
                            <p className="text-xs text-slate-500">Dados extraídos via IA OCR e currículo prontos para envio ao Onvio</p>
                        </div>
                    </div>
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                        Extraído pela IA
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">Nome Completo</Label>
                        <Input
                            value={formData.name}
                            onChange={(e) => handleChange("name", e.target.value)}
                            className="h-8 text-xs bg-slate-50 focus:bg-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">CPF</Label>
                        <Input
                            value={formData.cpf}
                            onChange={(e) => handleChange("cpf", e.target.value)}
                            placeholder="000.000.000-00"
                            className="h-8 text-xs bg-slate-50 focus:bg-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">E-mail</Label>
                        <Input
                            value={formData.email}
                            onChange={(e) => handleChange("email", e.target.value)}
                            className="h-8 text-xs bg-slate-50 focus:bg-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">Telefone / WhatsApp</Label>
                        <Input
                            value={formData.phone}
                            onChange={(e) => handleChange("phone", e.target.value)}
                            className="h-8 text-xs bg-slate-50 focus:bg-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">Cargo / Função</Label>
                        <Input
                            value={formData.role}
                            onChange={(e) => handleChange("role", e.target.value)}
                            className="h-8 text-xs bg-slate-50 focus:bg-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">Salário (R$)</Label>
                        <Input
                            value={formData.salary}
                            onChange={(e) => handleChange("salary", e.target.value)}
                            className="h-8 text-xs bg-slate-50 focus:bg-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">Data de Nascimento</Label>
                        <Input
                            value={formData.birthDate}
                            onChange={(e) => handleChange("birthDate", e.target.value)}
                            placeholder="DD/MM/AAAA"
                            className="h-8 text-xs bg-slate-50 focus:bg-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">Gênero</Label>
                        <Input
                            value={formData.gender}
                            onChange={(e) => handleChange("gender", e.target.value)}
                            className="h-8 text-xs bg-slate-50 focus:bg-white"
                        />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                        <Label className="text-[11px] font-semibold text-slate-600">Endereço Completo</Label>
                        <Input
                            value={formData.address}
                            onChange={(e) => handleChange("address", e.target.value)}
                            className="h-8 text-xs bg-slate-50 focus:bg-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">RG / Órgão Emissor</Label>
                        <Input
                            value={formData.rg}
                            onChange={(e) => handleChange("rg", e.target.value)}
                            className="h-8 text-xs bg-slate-50 focus:bg-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">Data de Admissão Prevista</Label>
                        <Input
                            value={formData.startDate}
                            onChange={(e) => handleChange("startDate", e.target.value)}
                            className="h-8 text-xs bg-slate-50 focus:bg-white"
                        />
                    </div>
                </div>

                {/* Botão de Disparo para a Extensão Chrome ONvio */}
                <div className="pt-3 border-t flex flex-col sm:flex-row gap-2">
                    <Button
                        type="button"
                        onClick={handleSendToExtension}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 shadow"
                    >
                        <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                        ⚡ Preencher na Thomson Reuters (Extensão ONvio)
                    </Button>
                </div>
            </div>

            {/* Checklist Onvio & Confirmação */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Passo a Passo de Admissão Onvio</p>
                <ul className="text-xs text-slate-600 space-y-1.5">
                    <li className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${formData.name ? 'bg-emerald-500 text-white' : 'bg-slate-300'}`}>1</span>
                        <span>Formulário de admissão conferido acima</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                        <span>Clique no botão acima "⚡ Preencher na Thomson Reuters"</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${onvioLaunched ? 'bg-emerald-500 text-white' : 'bg-slate-300'}`}>3</span>
                        <span>No portal Onvio/Thomson Reuters, clique em Preencher no assistente da extensão Chrome</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${onvioLaunched ? 'bg-emerald-500 text-white' : 'bg-slate-300'}`}>4</span>
                        <span>Clique no botão de confirmação abaixo para avançar para Cadastro de Benefícios</span>
                    </li>
                </ul>

                {!onvioLaunched && (
                    <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 mt-2"
                        onClick={handleConfirm}
                        disabled={confirming}
                    >
                        {confirming ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        Confirmar Lançamento no Onvio e Avançar para Benefícios
                    </Button>
                )}
            </div>
        </div>
    );
}
