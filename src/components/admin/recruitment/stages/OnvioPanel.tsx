"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Loader2, Calendar, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { confirmOnvio, getEmployeeFormData } from "@/actions/recruitment";
import { getWizardDropdowns } from "@/app/actions";
import { EmployeeOnvioWizard } from "@/components/admin/EmployeeOnvioWizard";

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
    const [dropdowns, setDropdowns] = useState<{
        situations: any[];
        roles: any[];
        companies: any[];
        departments: any[];
        costCenters: any[];
        unions: any[];
        jobFunctions: any[];
        postos: any[];
    }>({
        situations: [],
        roles: [],
        companies: [],
        departments: [],
        costCenters: [],
        unions: [],
        jobFunctions: [],
        postos: [],
    });

    useEffect(() => {
        Promise.all([
            getEmployeeFormData(),
            getWizardDropdowns()
        ]).then(([empData, wizData]) => {
            setDropdowns({
                situations: empData.situations || [],
                roles: empData.roles || [],
                companies: empData.companies || [],
                postos: empData.postos || [],
                departments: wizData.departments || [],
                costCenters: wizData.costCenters || [],
                unions: wizData.unions || [],
                jobFunctions: wizData.jobFunctions || [],
            });
        });
    }, []);

    const wizardInitialData = {
        name: candidateName || "",
        email: email || extraFields?.email || "",
        phone: phone || extraFields?.phone || "",
        cpf: cpf || extraFields?.cpf || "",
        birthDate: birthDate || extraFields?.birthDate || "",
        gender: gender || extraFields?.gender || "",
        address: address || extraFields?.address || "",
        rg: rg || extraFields?.rg || "",
        salary: salary ? String(salary) : (extraFields?.salary || "0"),
        admissionDate: startDate || extraFields?.startDate || new Date().toISOString().split('T')[0],
        extraFields: {
            ...extraFields,
            cpf: cpf || extraFields?.cpf,
            rg: rg || extraFields?.rg,
            birthDate: birthDate || extraFields?.birthDate,
            gender: gender || extraFields?.gender,
            address: address || extraFields?.address,
            phone: phone || extraFields?.phone,
            email: email || extraFields?.email,
        }
    };

    const handleSendToExtension = () => {
        const event = new CustomEvent("workforceRpaCapture", {
            detail: {
                name: candidateName,
                cpf: cpf || extraFields?.cpf,
                phone: phone || extraFields?.phone,
                email: email || extraFields?.email,
                role: roleTitle || extraFields?.role,
                salary: salary || extraFields?.salary,
                company: companyName || extraFields?.company,
                startDate: startDate || extraFields?.startDate,
                birthDate: birthDate || extraFields?.birthDate,
                gender: gender || extraFields?.gender,
                address: address || extraFields?.address,
                rg: rg || extraFields?.rg,
                ...extraFields,
            }
        });
        document.dispatchEvent(event);
        toast.success("Dados completos de Admissão capturados pela extensão ONvio! Vá para o portal Onvio e clique em Preencher.");
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
                        <span className="block text-xs text-amber-700">Formulário completo de Admissão Onvio com 6 etapas e sub-abas.</span>
                    </div>
                </div>
            )}

            {/* Renderização do Formulario Completo de 6 Abas e Sub-abas (EmployeeOnvioWizard) */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <EmployeeOnvioWizard
                    initialData={wizardInitialData}
                    situations={dropdowns.situations}
                    roles={dropdowns.roles}
                    companies={dropdowns.companies}
                    postos={dropdowns.postos}
                    departments={dropdowns.departments}
                    costCenters={dropdowns.costCenters}
                    unions={dropdowns.unions}
                    jobFunctions={dropdowns.jobFunctions}
                />
            </div>

            {/* Ações e Envio para Extensão */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                        type="button"
                        onClick={handleSendToExtension}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 shadow"
                    >
                        <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                        ⚡ Preencher na Thomson Reuters (Extensão ONvio)
                    </Button>

                    {!onvioLaunched && (
                        <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 shadow"
                            onClick={handleConfirm}
                            disabled={confirming}
                        >
                            {confirming ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-4 h-4" />
                            )}
                            Confirmar Lançamento no Onvio e Avançar para Benefícios
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
