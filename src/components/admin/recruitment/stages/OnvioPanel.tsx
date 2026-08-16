"use client";

import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, Loader2, Calendar, Zap, Bot, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { confirmOnvio, getEmployeeFormData, extractDataFromDocumentImages } from "@/actions/recruitment";
import { sendCandidateToOnvioRpa, createRpaJobAction, checkRpaJobStatusAction } from "@/actions/onvio-rpa";
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
    const [liveWizardData, setLiveWizardData] = useState<any>(null);
    const [showTransmitModal, setShowTransmitModal] = useState(false);

    function checkPixRequirement(data: any) {
        const extra = data?.extraFields || {};
        const chave = extra.chavePix || data?.chavePix;
        const approved = extra.pixOverrideApproved;
        if (!chave && !approved) {
            toast.error("⚠️ A Chave PIX é requisito obrigatório para a contratação! Preencha a Chave PIX na Aba Pagamento ou registre uma Deliberação de Aprovação Superior.");
            return false;
        }
        return true;
    }

    function handleStartTransmission() {
        const dataToTransmit = liveWizardData || wizardInitialData;
        if (!checkPixRequirement(dataToTransmit)) return;
        setShowTransmitModal(true);
    }

    function handleOpenOnvioForm() {
        const onvioUrl = "https://onvio.com.br/clientcenter";
        window.open(onvioUrl, "_blank", "noreferrer,noopener");

        const data = liveWizardData || wizardInitialData;
        const extra = data.extraFields || {};
        const isEstr = extra.isEstrangeiro;
        const cpfDigits = (data.cpf || extra?.cpf || "").replace(/\D/g, "");
        const ctpsNum = extra?.ctpsNumero || (cpfDigits.length >= 7 ? cpfDigits.slice(0, 7) : "");
        const ctpsSerie = extra?.ctpsSerie || (cpfDigits.length >= 11 ? cpfDigits.slice(7, 11) : (cpfDigits.length >= 4 ? cpfDigits.slice(-4) : ""));

        const summaryText = `--- DADOS DE ADMISSÃO PARA PREENCHIMENTO ONVIO ---
Nome: ${data.name || candidateName || ""}
${isEstr ? `Nacionalidade: ${extra.paisOrigem || extra.nacionalidade || "Estrangeira"}\nRNM/RNE: ${extra.rnmNumero || extra.rgNumero || ""}` : `CPF: ${data.cpf || extra?.cpf || ""}\nRG: ${extra?.rgNumero || data.rg || ""}`}
PIS/PASEP: ${extra?.pisNumero || cpfDigits || ""}
CTPS Número: ${ctpsNum} | Série: ${ctpsSerie}
Data Nascimento: ${data.birthDate || extra?.birthDate || ""}
Gênero: ${data.gender || extra?.gender || ""}
Nome da Mãe: ${extra?.nomeMae || ""}
Nome do Pai: ${extra?.nomePai || ""}
Endereço: ${data.address || extra?.address || ""}
Cargo: ${data.roleTitle || roleTitle || ""}
Salário Base: R$ ${data.salary || salary || "0"}
Escala: ${extra?.escalaHorario || "12x36"}
Jornada: ${extra?.jornadaHoras || "10:00 às 22:00"}
Empresa: ${data.companyName || companyName || "JVS FACILITIES LTDA"}
Chave PIX: ${extra?.chavePix || extra?.pixKey || (extra.pixOverrideApproved ? `[LIBERAÇÃO SUPERIOR: ${extra.pixApprovalBy || "Aprovado"}]` : "---")}
--------------------------------------------------`;

        navigator.clipboard.writeText(summaryText);
        toast.success("Formulário do Onvio aberto em nova aba! Dados do candidato copiados para área de transferência.");
    }

    async function handleRpaTransmit() {
        setShowTransmitModal(false);
        setSendingRpa(true);
        try {
            const dataToTransmit = liveWizardData || wizardInitialData;

            toast.info("Iniciando transmissão de dados de admissão para o Onvio...");
            
            // 1. Criar Job na fila de comunicacao segura em nuvem (Vercel -> Windows)
            const jobRes = await createRpaJobAction(candidateId, dataToTransmit);
            
            if (jobRes.success && jobRes.jobId) {
                const jobId = jobRes.jobId;
                let isHandledByWindows = false;

                // Aguarda ate 10 segundos pelo polling do Robo-Onvio-RH.exe
                for (let i = 0; i < 10; i++) {
                    await new Promise(r => setTimeout(r, 1000));
                    const statusRes = await checkRpaJobStatusAction(jobId);
                    if (statusRes.success && (statusRes.status === "PROCESSING" || statusRes.status === "COMPLETED")) {
                        isHandledByWindows = true;
                        toast.success("🤖 O Robô no seu Windows recebeu a solicitação e abriu a janela do Chrome na sua tela! Faça a conferência e clique em Salvar no Onvio.");
                        onUpdate();
                        break;
                    }
                }

                if (isHandledByWindows) return;
            }

            // 2. Fallback caso o Robo-Onvio-RH.exe nao esteja rodando no Windows
            toast.info("Executando automação direta no portal Onvio...");
            const res = await sendCandidateToOnvioRpa(candidateId, dataToTransmit);
            if (res.success) {
                toast.success(res.message || "Robô RPA executou com sucesso no portal Onvio!");
                onUpdate();
            } else {
                toast.error(res.error || "Erro ao executar o robô RPA no Onvio.");
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

    const wizardInitialData = useMemo(() => ({
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
    }), [candidateId, candidateName, email, phone, cpf, birthDate, gender, address, rg, roleId, salary, startDate, companyId, companyName, postoId]);

    const currentDataForModal = liveWizardData || wizardInitialData;
    const currentExtra = currentDataForModal.extraFields || {};

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
                    onDataChange={setLiveWizardData}
                />
            </div>

            {/* Ações: Envio Direto Onvio e Confirmação de Etapa */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Os dados preenchidos serão transmitidos diretamente para o portal Onvio da contabilidade.</span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <Button
                        type="button"
                        onClick={handleStartTransmission}
                        disabled={sendingRpa}
                        className="bg-gradient-to-r from-teal-700 via-teal-800 to-[#042d36] hover:from-teal-800 hover:to-[#032229] text-white font-bold text-xs sm:text-sm h-11 px-5 rounded-xl flex items-center justify-center gap-2 shadow shrink-0"
                    >
                        {sendingRpa ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin text-teal-200" />
                                <span>Transmitindo para o Onvio...</span>
                            </>
                        ) : (
                            <>
                                <Bot className="w-4 h-4 text-teal-300" />
                                <span>🚀 Enviar para Contabilidade (Onvio)</span>
                            </>
                        )}
                    </Button>

                    {!onvioLaunched && (
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm h-11 px-5 rounded-xl flex items-center justify-center gap-2 shadow shrink-0"
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

            {/* Modal de Confirmação Pré-Envio para Contabilidade */}
            {showTransmitModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                                <Bot className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Confirmar Envio para Contabilidade</h3>
                                <p className="text-xs text-slate-500">Deseja transmitir os dados da admissão para o portal Onvio agora?</p>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700">
                            <div className="flex justify-between py-1 border-b border-slate-200">
                                <span className="font-semibold text-slate-500">Colaborador:</span>
                                <span className="font-bold text-slate-900">{currentDataForModal.name || candidateName}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200">
                                <span className="font-semibold text-slate-500">{currentExtra.isEstrangeiro ? "Nacionalidade / RNM:" : "CPF / RG:"}</span>
                                <span className="font-bold text-slate-900">
                                    {currentExtra.isEstrangeiro 
                                        ? `${currentExtra.paisOrigem || "Estrangeiro"} (${currentExtra.rnmNumero || "Sem RNM"})`
                                        : `${currentDataForModal.cpf || "---"} (${currentExtra.rgNumero || "---"})`
                                    }
                                </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200">
                                <span className="font-semibold text-slate-500">Empresa Alvo (Onvio):</span>
                                <span className="font-bold text-teal-800">{currentDataForModal.companyName || companyName || "JVS FACILITIES LTDA"}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200">
                                <span className="font-semibold text-slate-500">Cargo / Salário:</span>
                                <span className="font-bold text-slate-900">{currentDataForModal.roleTitle || roleTitle} — R$ {currentDataForModal.salary || salary || "0"}</span>
                            </div>
                            <div className="flex justify-between py-1">
                                <span className="font-semibold text-slate-500">Chave PIX:</span>
                                <span className="font-bold text-slate-900">
                                    {currentExtra.chavePix 
                                        ? `✅ ${currentExtra.chavePix}` 
                                        : currentExtra.pixOverrideApproved 
                                            ? `🔓 Deliberação Superior (${currentExtra.pixApprovalBy || "Aprovado"})` 
                                            : "❌ Ausente"
                                    }
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowTransmitModal(false)}
                                className="rounded-xl text-xs h-10 px-4"
                            >
                                Cancelar e Revisar
                            </Button>
                            <Button
                                type="button"
                                onClick={handleRpaTransmit}
                                className="bg-gradient-to-r from-teal-700 to-[#042d36] hover:from-teal-800 hover:to-[#032229] text-white font-bold text-xs h-10 px-5 rounded-xl shadow flex items-center gap-2"
                            >
                                <Bot className="w-4 h-4 text-teal-300" />
                                <span>Sim, Transmitir Agora</span>
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
