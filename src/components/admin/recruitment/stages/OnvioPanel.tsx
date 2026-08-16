"use client";

import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, Loader2, Calendar, Bot, X, FileText, User, Building, CreditCard } from "lucide-react";
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
    const [isWizardModalOpen, setIsWizardModalOpen] = useState(false);

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

    async function handleRpaTransmit() {
        setShowTransmitModal(false);
        setSendingRpa(true);
        try {
            const dataToTransmit = liveWizardData || wizardInitialData;

            toast.info("Iniciando transmissão de dados de admissão para o Onvio...");
            
            const jobRes = await createRpaJobAction(candidateId, dataToTransmit);
            
            if (jobRes.success && jobRes.jobId) {
                const jobId = jobRes.jobId;
                let isHandledByWindows = false;

                for (let i = 0; i < 10; i++) {
                    await new Promise(r => setTimeout(r, 1000));
                    const statusRes = await checkRpaJobStatusAction(jobId);
                    if (statusRes.success && (statusRes.status === "PROCESSING" || statusRes.status === "COMPLETED")) {
                        isHandledByWindows = true;
                        toast.success("🤖 O Robô recebeu a solicitação e preencheu as 6 abas no Onvio!");
                        setIsWizardModalOpen(false);
                        onUpdate();
                        break;
                    }
                }

                if (isHandledByWindows) return;
            }

            toast.info("Executando automação direta no portal Onvio...");
            const res = await sendCandidateToOnvioRpa(candidateId, dataToTransmit);
            if (res.success) {
                toast.success(res.message || "Robô RPA executou com sucesso no portal Onvio!");
                setIsWizardModalOpen(false);
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
            rg: rg || extraFields?.rg || extraFields?.rgNumero || extraFields?.rg || extraFields?.rg_numero,
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
        <div className="space-y-4">
            {onvioLaunched ? (
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800 text-sm font-medium shadow-sm">
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
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-teal-50/70 border-teal-200 text-teal-900 text-xs shadow-xs">
                    <Bot className="w-5 h-5 text-teal-700 shrink-0" />
                    <div>
                        <span className="font-bold text-sm block">Etapa de Admissão Contábil (Onvio)</span>
                        <span className="text-teal-700">Preencha e confira as 6 abas padronizadas do Onvio antes de transmitir para a contabilidade.</span>
                    </div>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-teal-700" />
                        <h3 className="text-sm font-bold text-slate-900">Resumo da Ficha de Admissão</h3>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        6 Abas Mapeadas
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <span className="text-slate-400 font-medium flex items-center gap-1">
                            <User className="w-3.5 h-3.5" /> Colaborador
                        </span>
                        <p className="font-bold text-slate-800 text-sm truncate">{candidateName || "---"}</p>
                        <p className="text-slate-500 font-mono">
                            {currentExtra.isEstrangeiro 
                                ? `🌐 RNM: ${currentExtra.rnmNumero || "---"}` 
                                : `🇧🇷 CPF: ${cpf || currentExtra.cpfNumero || "---"}`}
                        </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <span className="text-slate-400 font-medium flex items-center gap-1">
                            <Building className="w-3.5 h-3.5" /> Empresa & Cargo
                        </span>
                        <p className="font-bold text-teal-800 text-sm truncate">{companyName || "JVS FACILITIES LTDA"}</p>
                        <p className="text-slate-600 font-medium">{roleTitle || "---"} — R$ {salary || "0"}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <span className="text-slate-400 font-medium flex items-center gap-1">
                            <CreditCard className="w-3.5 h-3.5" /> Chave PIX (Obrigatória)
                        </span>
                        <p className="font-bold text-slate-800 text-sm">
                            {currentExtra.chavePix ? (
                                <span className="text-emerald-700 flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4" /> {currentExtra.chavePix}
                                </span>
                            ) : currentExtra.pixOverrideApproved ? (
                                <span className="text-amber-700">🔓 Deliberação Superior</span>
                            ) : (
                                <span className="text-rose-600">⚠️ Pendente de Preenchimento</span>
                            )}
                        </p>
                        <p className="text-slate-500 text-[11px]">Requisito formal de contratação</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <Button
                        type="button"
                        onClick={() => setIsWizardModalOpen(true)}
                        className="w-full sm:w-auto bg-gradient-to-r from-teal-700 via-teal-800 to-[#042d36] hover:from-teal-800 hover:to-[#032229] text-white font-bold text-xs sm:text-sm h-11 px-6 rounded-xl flex items-center justify-center gap-2 shadow"
                    >
                        <FileText className="w-4 h-4 text-teal-300" />
                        <span>📝 Abrir Ficha de Admissão Onvio (6 Abas)</span>
                    </Button>

                    {!onvioLaunched && (
                        <Button
                            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm h-11 px-5 rounded-xl flex items-center justify-center gap-2 shadow"
                            onClick={handleConfirm}
                            disabled={confirming}
                        >
                            {confirming ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-4 h-4" />
                            )}
                            <span>Confirmar Lançamento Manualmente</span>
                        </Button>
                    )}
                </div>
            </div>

            {isWizardModalOpen && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-6xl h-[92vh] max-h-[950px] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                                    <Bot className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                        Ficha de Admissão Onvio — {candidateName}
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Empresa Alvo: <span className="font-semibold text-teal-800">{companyName || "JVS FACILITIES LTDA"}</span> | Cargo: <span className="font-semibold text-slate-700">{roleTitle}</span>
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsWizardModalOpen(false)}
                                className="rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
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
                        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                <Bot className="w-4 h-4 text-teal-600 shrink-0" />
                                <span>Os dados preenchidos serão transmitidos diretamente para o portal Onvio da contabilidade.</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsWizardModalOpen(false)}
                                    className="rounded-xl text-xs sm:text-sm h-11 px-4"
                                >
                                    Fechar
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleStartTransmission}
                                    disabled={sendingRpa}
                                    className="bg-gradient-to-r from-teal-700 via-teal-800 to-[#042d36] hover:from-teal-800 hover:to-[#032229] text-white font-bold text-xs sm:text-sm h-11 px-6 rounded-xl flex items-center justify-center gap-2 shadow"
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
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showTransmitModal && (
                <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
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
