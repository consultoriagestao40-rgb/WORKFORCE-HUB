"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, Calendar, Bot, X, FileText, User, Building, Building2, CreditCard, ArrowLeft, Send, AlertTriangle, ShieldCheck, Briefcase, FileCheck, Check, Lock } from "lucide-react";
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
    const [mounted, setMounted] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [sendingRpa, setSendingRpa] = useState(false);
    const [liveWizardData, setLiveWizardData] = useState<any>(null);
    const [showReviewModal, setShowReviewModal] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

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

    async function handleRpaTransmit() {
        const dataToTransmit = liveWizardData || wizardInitialData;
        if (!checkPixRequirement(dataToTransmit)) return;

        setShowReviewModal(false);
        setSendingRpa(true);
        try {
            const res = await sendCandidateToOnvioRpa(candidateId, dataToTransmit);
            if (res.success) {
                toast.success(res.message || "✅ Ficha transmitida com sucesso para o Onvio!");
                onUpdate();
            } else {
                toast.error(res.error || "Erro ao executar a transmissão para o Onvio.");
            }
        } catch (e: any) {
            toast.error(e.message || "Erro durante o disparo para o Onvio.");
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

    const reviewData = liveWizardData || wizardInitialData;
    const reviewExtra = reviewData.extraFields || {};

    async function handleConfirm() {
        setConfirming(true);
        try {
            const dataToTransmit = liveWizardData || wizardInitialData;
            await confirmOnvio(candidateId, dataToTransmit);
            toast.success("✅ Colaborador admitido com sucesso e alocado no Posto de Trabalho!");
            onUpdate();
        } catch (e: any) {
            toast.error(e.message || "Erro ao alocar no posto / confirmar admissão");
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

    const isAllocated = !!onvioLaunched && (!!extraFields?.isAllocated || !!extraFields?.allocatedAt);

    return (
        <div className="space-y-4">
            {/* Banner de Ação Primária: Alocar no Posto */}
            <div className={`rounded-2xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border ${
                isAllocated 
                    ? 'bg-gradient-to-r from-emerald-800 via-teal-800 to-[#04343f] text-white border-emerald-600/40'
                    : onvioLaunched 
                        ? 'bg-gradient-to-r from-emerald-700 via-teal-700 to-[#04343f] text-white border-emerald-500/50'
                        : 'bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900 text-slate-200 border-slate-700'
            }`}>
                <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Building2 className={`w-5 h-5 ${isAllocated ? 'text-emerald-300' : onvioLaunched ? 'text-emerald-300' : 'text-slate-400'}`} />
                        <span className="font-extrabold text-base tracking-tight">
                            {isAllocated ? "Colaborador Admitido & Alocado" : onvioLaunched ? "Pronto para Alocação no Posto" : "Admissão Pendente de Envio ao Onvio"}
                        </span>
                        {isAllocated ? (
                            <span className="bg-emerald-400/30 border border-emerald-300/40 text-emerald-100 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3" /> ✓ Alocado no Posto
                            </span>
                        ) : onvioLaunched ? (
                            <span className="bg-emerald-400/20 border border-emerald-300/40 text-emerald-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                                Pronto para Alocação
                            </span>
                        ) : (
                            <span className="bg-amber-400/20 border border-amber-300/40 text-amber-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                                🔒 Transmita para o Onvio Primeiro
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed max-w-xl">
                        {isAllocated 
                            ? "O colaborador já foi admitido e vinculado ativamente à escala deste posto de trabalho."
                            : onvioLaunched 
                                ? "Processo concluído e transmitido ao Onvio! Clique no botão ao lado para cadastrar o colaborador como Ativo e vinculá-lo à escala do posto."
                                : "Preencha a ficha cadastral abaixo e transmita para a contabilidade (Onvio) para liberar a alocação no posto."
                        }
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {isAllocated ? (
                        <>
                            <Button
                                type="button"
                                disabled={true}
                                variant="outline"
                                className="bg-emerald-100 border-emerald-300 text-emerald-900 font-black text-xs sm:text-sm h-11 px-5 rounded-xl flex items-center justify-center gap-2 cursor-default opacity-90"
                            >
                                <Check className="w-4 h-4 text-emerald-700" />
                                <span>✓ Alocado no Posto</span>
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleConfirm}
                                disabled={confirming}
                                className="text-xs h-11 bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold px-3 rounded-xl"
                                title="Re-sincronizar dados do colaborador e alocação"
                            >
                                {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "🔄"}
                            </Button>
                        </>
                    ) : onvioLaunched ? (
                        <Button
                            type="button"
                            onClick={handleConfirm}
                            disabled={confirming}
                            className="bg-emerald-400 hover:bg-emerald-300 text-emerald-950 hover:text-emerald-950 font-black text-xs sm:text-sm h-11 px-6 rounded-xl flex items-center justify-center gap-2.5 shadow-lg shrink-0 transition-transform active:scale-95 cursor-pointer border border-emerald-300"
                        >
                            {confirming ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-emerald-900" />
                                    <span>Alocando no Posto...</span>
                                </>
                            ) : (
                                <>
                                    <Building2 className="w-4 h-4 text-emerald-900" />
                                    <span>🏢 Alocar no Posto de Trabalho</span>
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            disabled={true}
                            variant="outline"
                            className="bg-slate-800 border-slate-700 text-slate-400 font-bold text-xs sm:text-sm h-11 px-5 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed opacity-70"
                        >
                            <Lock className="w-4 h-4" />
                            <span>🔒 Transmita para o Onvio Primeiro</span>
                        </Button>
                    )}
                </div>
            </div>

            {onvioLaunched && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3.5 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800 text-sm font-medium shadow-sm">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                            <span className="font-bold">Lançamento Confirmado no Onvio</span>
                            <span className="block text-xs text-emerald-700">Colaborador ativo cadastrado e alocado no Posto de Trabalho correspondente.</span>
                        </div>
                    </div>
                    {confirmedDate && (
                        <span className="text-xs font-normal opacity-80 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 self-end sm:self-auto">
                            <Calendar className="w-3 h-3" />
                            {confirmedDate}
                        </span>
                    )}
                </div>
            )}

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

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Ao clicar em enviar, você poderá conferir a ficha consolidada em 6 seções antes da transmissão final.</span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <Button
                        type="button"
                        onClick={handleRpaTransmit}
                        disabled={sendingRpa}
                        className="bg-gradient-to-r from-teal-700 via-teal-800 to-[#042d36] hover:from-teal-800 hover:to-[#032229] text-white font-bold text-xs sm:text-sm h-11 px-6 rounded-xl flex items-center justify-center gap-2 shadow cursor-pointer active:scale-95 transition-transform"
                    >
                        {sendingRpa ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin text-teal-200" />
                                <span>Transmitindo para o Onvio...</span>
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4 text-teal-300" />
                                <span>🚀 Enviar para Contabilidade (Onvio)</span>
                            </>
                        )}
                    </Button>

                    {isAllocated ? (
                        <Button
                            disabled={true}
                            variant="outline"
                            className="bg-emerald-50 border-emerald-300 text-emerald-800 font-bold text-xs sm:text-sm h-11 px-5 rounded-xl flex items-center justify-center gap-2 cursor-default opacity-90"
                        >
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>✓ Alocado no Posto</span>
                        </Button>
                    ) : onvioLaunched ? (
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm h-11 px-5 rounded-xl flex items-center justify-center gap-2 shadow cursor-pointer"
                            onClick={handleConfirm}
                            disabled={confirming}
                        >
                            {confirming ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Building2 className="w-4 h-4" />
                            )}
                            <span>🏢 Alocar no Posto</span>
                        </Button>
                    ) : (
                        <Button
                            disabled={true}
                            variant="outline"
                            className="bg-slate-100 border-slate-200 text-slate-400 font-bold text-xs sm:text-sm h-11 px-5 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed opacity-60"
                        >
                            <Lock className="w-4 h-4" />
                            <span>🔒 Alocar no Posto</span>
                        </Button>
                    )}
                </div>
            </div>

            {mounted && showReviewModal && createPortal(
                <div 
                    className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 md:p-6 animate-in fade-in duration-200 pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                >
                    <div 
                        className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] max-h-[900px] shadow-2xl flex flex-col overflow-hidden border border-slate-300 pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold shrink-0">
                                    <FileCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                        Ficha de Conferência de Admissão — Onvio
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Revise todos os dados consolidados das 6 abas antes do envio. Caso precise alterar algo, clique em <span className="font-semibold text-slate-700">"Voltar e Editar"</span>.
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowReviewModal(false)}
                                className="rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-slate-50/70 space-y-5 text-xs text-slate-700 overscroll-contain [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100">
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                                <div className="flex items-center gap-2 text-teal-800 font-bold text-sm border-b border-slate-100 pb-2">
                                    <Building className="w-4 h-4" />
                                    <span>1. Dados Contratuais (Aba 1)</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    <div>
                                        <span className="text-slate-400 font-medium block">Empresa Alvo:</span>
                                        <span className="font-bold text-teal-900">{reviewData.companyName || companyName || "JVS FACILITIES LTDA"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Cargo / Função:</span>
                                        <span className="font-bold text-slate-800">{reviewData.roleTitle || roleTitle || "---"} ({reviewExtra.funcao || "Geral"})</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Salário Base:</span>
                                        <span className="font-bold text-slate-800">R$ {reviewData.salary || salary || "0"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Data de Admissão:</span>
                                        <span className="font-semibold text-slate-800">{reviewData.admissionDate || startDate || "Hoje"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Tipo / Vínculo:</span>
                                        <span className="font-semibold text-slate-800">{reviewData.type || "CLT"} — {reviewExtra.vinculoEmpregaticio || "Celetista"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Categoria:</span>
                                        <span className="font-semibold text-slate-800">{reviewExtra.categoriaAdmissao || "Mensalista"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Escala de Trabalho:</span>
                                        <span className="font-semibold text-slate-800">{reviewExtra.escalaHorario || "12x36"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Jornada de Trabalho:</span>
                                        <span className="font-semibold text-slate-800">{reviewExtra.jornadaHoras || "---"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Departamento / Centro de Custo:</span>
                                        <span className="font-semibold text-slate-800">{reviewExtra.departamento || "Geral"} / {reviewExtra.centroCusto || "Geral"}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                                <div className="flex items-center gap-2 text-teal-800 font-bold text-sm border-b border-slate-100 pb-2">
                                    <Briefcase className="w-4 h-4" />
                                    <span>2. Dados Profissionais, Benefícios & Pagamento (Aba 2)</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    <div>
                                        <span className="text-slate-400 font-medium block">CTPS (Número / Série / UF):</span>
                                        <span className="font-bold text-slate-800">
                                            {reviewExtra.ctpsNumero || "---"} — Série: {reviewExtra.ctpsSerie || "---"} ({reviewExtra.ctpsUf || "PR"})
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">PIS / PASEP:</span>
                                        <span className="font-bold text-slate-800">{reviewExtra.pisNumero || "---"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Opção FGTS:</span>
                                        <span className="font-semibold text-slate-800">{reviewExtra.fgtsOpcao || "Sim"} ({reviewExtra.fgtsDataOpcao || "Data Admissão"})</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Vale Alimentação:</span>
                                        <span className="font-semibold text-slate-800">R$ {reviewExtra.valeAlimentacao || "0"} ({reviewExtra.vaTipo || "Cartão Caju"})</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Vale Transporte:</span>
                                        <span className="font-semibold text-slate-800">R$ {reviewExtra.valeTransporte || "0"} ({reviewExtra.vtMeio || "Metrocard/Urbs"})</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Forma de Pagamento:</span>
                                        <span className="font-bold text-emerald-700">
                                            {reviewExtra.formaPagamento || "PIX"} — {reviewExtra.tipoChavePix || "Chave"}: {reviewExtra.chavePix || (reviewExtra.pixOverrideApproved ? `[DELIBERAÇÃO: ${reviewExtra.pixApprovalBy}]` : "---")}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                                <div className="flex items-center gap-2 text-teal-800 font-bold text-sm border-b border-slate-100 pb-2">
                                    <User className="w-4 h-4" />
                                    <span>3. Dados Pessoais & Filiação (Aba 3)</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    <div>
                                        <span className="text-slate-400 font-medium block">Nome Completo:</span>
                                        <span className="font-bold text-slate-900 text-sm">{reviewData.name || candidateName}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Cidadania / Nacionalidade:</span>
                                        <span className="font-bold text-slate-800">
                                            {reviewExtra.isEstrangeiro 
                                                ? `🌐 Estrangeira (${reviewExtra.paisOrigem || "Outro"})` 
                                                : `🇧🇷 Brasileira (${reviewExtra.naturalidadeCidade || "---"}/${reviewExtra.naturalidadeUf || "---"})`}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Data de Nascimento / Gênero:</span>
                                        <span className="font-semibold text-slate-800">{reviewData.birthDate || "---"} — {reviewData.gender || "---"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Estado Civil / Escolaridade:</span>
                                        <span className="font-semibold text-slate-800">{reviewExtra.estadoCivil || "Solteiro(a)"} — {reviewExtra.grauInstrucao || "Ensino Médio"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Nome da Mãe:</span>
                                        <span className="font-semibold text-slate-800">{reviewExtra.nomeMae || "---"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Nome do Pai:</span>
                                        <span className="font-semibold text-slate-800">{reviewExtra.nomePai || "---"}</span>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <span className="text-slate-400 font-medium block">Endereço Residencial:</span>
                                        <span className="font-semibold text-slate-800">{reviewData.address || "---"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Contato:</span>
                                        <span className="font-semibold text-slate-800">{reviewData.phone || "---"} | {reviewData.email || "---"}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                                <div className="flex items-center gap-2 text-teal-800 font-bold text-sm border-b border-slate-100 pb-2">
                                    <ShieldCheck className="w-4 h-4" />
                                    <span>4. Documentos de Identificação (Aba 4)</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    <div>
                                        <span className="text-slate-400 font-medium block">CPF:</span>
                                        <span className="font-bold text-slate-900 font-mono">{reviewData.cpf || "---"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">{reviewExtra.isEstrangeiro ? "RNM / RNE (Polícia Federal):" : "RG (Documento de Identidade):"}</span>
                                        <span className="font-bold text-slate-900">
                                            {reviewExtra.isEstrangeiro 
                                                ? `${reviewExtra.rnmNumero || "---"} (${reviewExtra.rnmOrgaoEmissor || "DPF"} - Val: ${reviewExtra.rnmDataValidade || "---"})` 
                                                : `${reviewExtra.rgNumero || reviewData.rg || "---"} (${reviewExtra.rgOrgaoEmissor || "SSP"}/${reviewExtra.rgUf || "PR"})`}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">CNH (se houver):</span>
                                        <span className="font-semibold text-slate-800">{reviewExtra.cnhNumero ? `${reviewExtra.cnhNumero} (Cat. ${reviewExtra.cnhCategoria || "B"})` : "Não informada"}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Título de Eleitor:</span>
                                        <span className="font-semibold text-slate-800">
                                            {reviewExtra.isEstrangeiro 
                                                ? "✅ Dispensado por Lei (Estrangeiro)" 
                                                : (reviewExtra.tituloEleitorNumero ? `${reviewExtra.tituloEleitorNumero} (Z: ${reviewExtra.tituloEleitorZona || "-"} / S: ${reviewExtra.tituloEleitorSecao || "-"})` : "Não informado")}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Certificado de Reservista:</span>
                                        <span className="font-semibold text-slate-800">
                                            {reviewExtra.isEstrangeiro 
                                                ? "✅ Dispensado por Lei (Estrangeiro)" 
                                                : (reviewExtra.reservistaNumero || "Não informado / Feminino")}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                                <div className="flex items-center gap-2 text-teal-800 font-bold text-sm border-b border-slate-100 pb-2">
                                    <User className="w-4 h-4" />
                                    <span>5. Dependentes (Aba 5)</span>
                                </div>
                                {reviewExtra.dependentes && reviewExtra.dependentes.length > 0 && reviewExtra.dependentes.some((d: any) => d.nome?.trim()) ? (
                                    <div className="divide-y divide-slate-100">
                                        {reviewExtra.dependentes.filter((d: any) => d.nome?.trim()).map((d: any, idx: number) => (
                                            <div key={idx} className="py-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                <div><span className="text-slate-400 font-medium block">Nome:</span><span className="font-bold text-slate-800">{d.nome}</span></div>
                                                <div><span className="text-slate-400 font-medium block">Parentesco:</span><span className="font-semibold text-slate-700">{d.parentesco || "Filho(a)"}</span></div>
                                                <div><span className="text-slate-400 font-medium block">CPF / Nasc:</span><span className="font-semibold text-slate-700">{d.cpf || "---"} ({d.dataNascimento || "---"})</span></div>
                                                <div><span className="text-slate-400 font-medium block">Sal. Família / IRRF:</span><span className="font-semibold text-slate-700">{d.salarioFamilia === "Sim" ? "Sim" : "Não"} / {d.irrf === "Sim" ? "Sim" : "Não"}</span></div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-slate-400 italic">Nenhum dependente informado para esta admissão.</p>
                                )}
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                                <div className="flex items-center gap-2 text-teal-800 font-bold text-sm border-b border-slate-100 pb-2">
                                    <FileText className="w-4 h-4" />
                                    <span>6. Observações para a Contabilidade (Aba 6)</span>
                                </div>
                                <p className="font-medium text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    {reviewExtra.observacoes || "Nenhuma observação adicional cadastrada."}
                                </p>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowReviewModal(false)}
                                className="rounded-xl text-xs sm:text-sm h-11 px-5 flex items-center gap-2 font-semibold text-slate-700"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Voltar e Editar</span>
                            </Button>

                            <Button
                                type="button"
                                onClick={handleRpaTransmit}
                                disabled={sendingRpa}
                                className="bg-gradient-to-r from-teal-700 via-teal-800 to-[#042d36] hover:from-teal-800 hover:to-[#032229] text-white font-bold text-xs sm:text-sm h-11 px-7 rounded-xl flex items-center justify-center gap-2 shadow"
                            >
                                <Send className="w-4 h-4 text-teal-300" />
                                <span>🚀 Confirmar e Transmitir para o Onvio Agora</span>
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal de Alerta Centralizado de Envio para o Onvio */}
            {mounted && sendingRpa && createPortal(
                <div 
                    className="fixed inset-0 z-[9999999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200 flex flex-col items-center text-center space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-xl shadow-teal-500/20">
                                <Send className="w-9 h-9 animate-bounce" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-md">
                                <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Transmitindo para o Onvio</h3>
                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                Conectando diretamente ao portal Thomson Reuters da contabilidade e preenchendo a ficha de admissão...
                            </p>
                        </div>

                        <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-xs text-left space-y-3">
                            <div className="flex items-center gap-2.5 text-slate-800 font-semibold">
                                <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-ping shrink-0" />
                                <span>Acessando ambiente seguro da JVS Facilities</span>
                            </div>
                            <div className="flex items-center gap-2.5 text-slate-600 text-[11px]">
                                <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                                <span>Preenchendo automaticamente as 6 seções</span>
                            </div>
                            <div className="flex items-center gap-2.5 text-slate-600 text-[11px]">
                                <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                                <span>Salvando e enviando para o escritório</span>
                            </div>
                        </div>

                        <p className="text-[11px] text-slate-400 font-medium animate-pulse">
                            Aguarde a confirmação em instantes. Não feche a página.
                        </p>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
