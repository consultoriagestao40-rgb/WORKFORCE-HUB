"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Loader2, Calendar, Zap, Bot, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { confirmOnvio, getEmployeeFormData, extractDataFromDocumentImages } from "@/actions/recruitment";
import { sendCandidateToOnvioRpa } from "@/actions/onvio-rpa";
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
    roleId?: string;
    salary?: string | number;
    startDate?: string;
    companyName?: string;
    companyId?: string;
    postoId?: string;
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
    roleId = "",
    salary = "",
    startDate = "",
    companyName = "",
    companyId = "",
    postoId = "",
    extraFields = {},
    onvioLaunched,
    onvioConfirmedAt,
    onUpdate,
}: OnvioPanelProps) {
    const [confirming, setConfirming] = useState(false);
    const [sendingRpa, setSendingRpa] = useState(false);

    function handleOpenOnvioForm() {
        const onvioUrl = "https://onvio.com.br/clientcenter";
        window.open(onvioUrl, "_blank", "noreferrer,noopener");

        const cpfDigits = (cpf || extraFields?.cpf || "").replace(/\D/g, "");
        const ctpsNum = cpfDigits.length >= 7 ? cpfDigits.slice(0, 7) : "";
        const ctpsSerie = cpfDigits.length >= 11 ? cpfDigits.slice(7, 11) : (cpfDigits.length >= 4 ? cpfDigits.slice(-4) : "");

        const summaryText = `--- DADOS DE ADMISSÃO PARA PREENCHIMENTO ONVIO ---
Nome: ${candidateName || ""}
CPF: ${cpf || extraFields?.cpf || ""}
RG: ${rg || extraFields?.rg || extraFields?.rgNumero || ""}
PIS/PASEP: ${extraFields?.pisNumero || extraFields?.pis || cpf || ""}
CTPS Número: ${ctpsNum} | Série: ${ctpsSerie}
Data Nascimento: ${birthDate || extraFields?.birthDate || ""}
Gênero: ${gender || extraFields?.gender || ""}
Nome da Mãe: ${extraFields?.nomeMae || ""}
Nome do Pai: ${extraFields?.nomePai || ""}
Endereço: ${address || extraFields?.address || ""}
Cargo: ${roleTitle || ""}
Salário Base: R$ ${salary || "0"}
Escala: ${extraFields?.escalaHorario || "12x36"}
Jornada: ${extraFields?.jornadaHoras || "10:00 às 22:00"}
Empresa: ${companyName || ""}
--------------------------------------------------`;

        navigator.clipboard.writeText(summaryText);
        toast.success("Formulário do Onvio aberto em nova aba! Dados do candidato copiados para área de transferência.");
    }

    async function handleRpaTransmit() {
        setSendingRpa(true);
        try {
            // 1. Tentar comunicar primeiro com o Robô Local no computador do usuário (portas 3000 ou ponte configurada)
            const bridgeUrl = process.env.NEXT_PUBLIC_RPA_BRIDGE_URL || "http://localhost:3000/api/rpa/onvio";
            
            let localBridgeSuccess = false;
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3500);

                const localBridgeRes = await fetch(bridgeUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        candidateId,
                        payload: wizardInitialData
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (localBridgeRes.ok) {
                    const localData = await localBridgeRes.json();
                    if (localData.success) {
                        localBridgeSuccess = true;
                        toast.success(localData.message || "Robô RPA abriu o Chrome na sua tela com todas as 6 abas preenchidas!");
                        onUpdate();
                        return;
                    }
                }
            } catch (localErr) {
                // Robô local não atendeu no localhost:3000
            }

            // 2. Se não houver robô local ativo no PC, executa no servidor de nuvem Vercel
            if (!localBridgeSuccess) {
                const res = await sendCandidateToOnvioRpa(candidateId);
                if (res.success) {
                    toast.success(res.message || "Robô RPA executou com sucesso no portal Onvio!");
                    onUpdate();
                } else {
                    toast.error(res.error || "Erro ao executar o robô RPA no Onvio.");
                }
            }
        } catch (e: any) {
            toast.error(e.message || "Erro durante o disparo do robô RPA.");
        } finally {
            setSendingRpa(false);
        }
    }
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

    // Auto-extração por IA Gemini caso o candidato tenha documentos anexados mas CPF/RG ainda não tenham sido extraídos
    useEffect(() => {
        if ((!extraFields?.cpf || !extraFields?.rgNumero) && candidateId) {
            extractDataFromDocumentImages(candidateId).then(res => {
                if (res.success && onUpdate) {
                    toast.success("IA Gemini leu os documentos anexados e preencheu a ficha de admissão!");
                    onUpdate();
                }
            }).catch(() => {});
        }
    }, [candidateId, extraFields?.cpf, extraFields?.rgNumero]);

    const sanitizeCpf = (c?: string) => {
        if (!c || c.includes("000.000.000")) return "";
        return c;
    };

    const sanitizePhone = (p?: string) => {
        if (!p || p.includes("(00)")) return "";
        return p;
    };

    const wizardInitialData = {
        name: candidateName || "",
        email: email || extraFields?.email || "",
        phone: sanitizePhone(phone || extraFields?.phone || extraFields?.whatsapp),
        cpf: sanitizeCpf(cpf || extraFields?.cpf || extraFields?.cpfNumero || extraFields?.cpf_numero),
        birthDate: birthDate || extraFields?.birthDate || extraFields?.dataNascimento || extraFields?.birth_date || "",
        gender: gender || extraFields?.gender || extraFields?.genero || "",
        address: address || extraFields?.address || extraFields?.endereco || "",
        rg: rg || extraFields?.rg || extraFields?.rgNumero || extraFields?.rg_numero || "",
        roleId: roleId || extraFields?.roleId || "",
        salary: salary ? String(salary) : (extraFields?.salary || "0"),
        admissionDate: startDate || extraFields?.startDate || new Date().toISOString().split('T')[0],
        companyId: companyId || extraFields?.companyId || "",
        companyName: companyName || extraFields?.companyName || "",
        postoId: postoId || extraFields?.postoId || "",
        extraFields: {
            ...extraFields,
            roleId: roleId || extraFields?.roleId,
            companyId: companyId || extraFields?.companyId,
            companyName: companyName || extraFields?.companyName,
            cpf: sanitizeCpf(cpf || extraFields?.cpf || extraFields?.cpfNumero || extraFields?.cpf_numero),
            rg: rg || extraFields?.rg || extraFields?.rgNumero || extraFields?.rg_numero,
            rgNumero: rg || extraFields?.rgNumero || extraFields?.rg || extraFields?.rg_numero,
            birthDate: birthDate || extraFields?.birthDate || extraFields?.dataNascimento || extraFields?.birth_date,
            gender: gender || extraFields?.gender || extraFields?.genero,
            address: address || extraFields?.address || extraFields?.endereco,
            phone: sanitizePhone(phone || extraFields?.phone || extraFields?.whatsapp),
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
            {onvioLaunched && (
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
            )}

            {/* Renderização do Formulario Completo de 6 Abas e Sub-abas (EmployeeOnvioWizard) */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <EmployeeOnvioWizard
                    initialData={wizardInitialData}
                    selectedPostoId={postoId || extraFields?.postoId}
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

            {/* Ações: Robô RPA Onvio, Executável Windows e Confirmação */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                        type="button"
                        onClick={handleRpaTransmit}
                        disabled={sendingRpa}
                        className="flex-1 bg-gradient-to-r from-teal-700 via-teal-800 to-[#042d36] hover:from-teal-800 hover:to-[#032229] text-white font-bold text-xs sm:text-sm h-11 rounded-xl flex items-center justify-center gap-2 shadow"
                    >
                        {sendingRpa ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin text-teal-200" />
                                <span>Robô RPA Conectando ao Onvio...</span>
                            </>
                        ) : (
                            <>
                                <Bot className="w-4 h-4 text-teal-300" />
                                <span>🤖 Transmitir via Robô RPA Onvio</span>
                            </>
                        )}
                    </Button>

                    <a
                        href="/downloads/Robo-Onvio-RH.exe"
                        download="Robo-Onvio-RH.exe"
                        className="flex-1 border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm h-11 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm bg-white"
                    >
                        <span>💻 Baixar Executável Windows (Robo-Onvio-RH.exe)</span>
                    </a>

                    {!onvioLaunched && (
                        <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm h-11 rounded-xl flex items-center justify-center gap-2 shadow"
                            onClick={handleConfirm}
                            disabled={confirming}
                        >
                            {confirming ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-4 h-4" />
                            )}
                            <span>Confirmar Lançamento</span>
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
