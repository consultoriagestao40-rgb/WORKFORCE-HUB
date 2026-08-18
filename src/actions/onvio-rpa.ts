"use server";

import { prisma } from "@/lib/db";
import { transmitCandidateToOnvio, OnvioCandidatePayload } from "@/lib/rpa/onvio";
import { revalidatePath } from "next/cache";
import { syncCandidateToEmployeeAndPosto } from "@/actions/recruitment";


export async function sendCandidateToOnvioRpa(candidateId: string, customPayload?: any) {
    try {
        const candidate = await prisma.recruitmentCandidate.findUnique({
            where: { id: candidateId },
            include: {
                vacancy: {
                    include: {
                        company: true,
                        role: true,
                        posto: { include: { client: true } }
                    }
                }
            }
        });

        if (!candidate) {
            return { success: false, error: "Candidato não encontrado." };
        }

        // Se veio payload customizado da tela, mescla e persiste no banco
        const existingExtra = (candidate.extraFields as Record<string, any>) || {};
        const incomingExtra = customPayload?.extraFields || {};
        const mergedExtra = { ...existingExtra, ...incomingExtra };

        if (customPayload) {
            await prisma.recruitmentCandidate.update({
                where: { id: candidateId },
                data: {
                    extraFields: mergedExtra,
                    email: customPayload.email || candidate.email,
                    phone: customPayload.phone || candidate.phone
                }
            });
        }

        const extra = mergedExtra;
        const cpfRaw = customPayload?.cpf || extra.cpf || (candidate as any).cpf || "";
        const cpfDigits = cpfRaw.replace(/\D/g, "");
        const ctpsNum = extra.ctpsNumero || extra.ctps || (cpfDigits.length >= 7 ? cpfDigits.slice(0, 7) : "");
        const ctpsSerie = extra.ctpsSerie || extra.serie || (cpfDigits.length >= 11 ? cpfDigits.slice(7, 11) : (cpfDigits.length >= 4 ? cpfDigits.slice(-4) : ""));

        const payload: OnvioCandidatePayload = {
            candidateId: candidate.id,
            candidateName: customPayload?.name || candidate.name,
            candidateCpf: cpfRaw,
            candidateEmail: customPayload?.email || candidate.email || extra.email || undefined,
            candidatePhone: customPayload?.phone || candidate.phone || extra.phone || undefined,
            vacancyTitle: customPayload?.roleTitle || candidate.vacancy?.role?.name || candidate.vacancy?.title || "Vaga Operacional",
            companyName: customPayload?.companyName || candidate.vacancy?.company?.name || "JVS FACILITIES LTDA",
            clientName: candidate.vacancy?.posto?.client?.name || "",
            baseSalary: customPayload?.salary ? Number(customPayload.salary) : (candidate.vacancy?.posto?.baseSalary || 1900),
            admissionDate: customPayload?.admissionDate || extra.admissionDate || new Date().toISOString().split('T')[0],
            rgNumero: extra.rgNumero || extra.rg || customPayload?.rg || "",
            rgOrgaoEmissor: extra.rgOrgaoEmissor || extra.rgOrgao || "SSP",
            rgUf: extra.rgUf || "PR",
            rgDataEmissao: extra.rgDataEmissao || "",
            ctpsNumero: ctpsNum,
            ctpsSerie: ctpsSerie,
            ctpsDataEmissao: extra.ctpsDataEmissao || "",
            pisNumero: extra.pisNumero || extra.pis || cpfRaw,
            birthDate: customPayload?.birthDate || extra.birthDate || "",
            gender: customPayload?.gender || extra.gender || "",
            nomeMae: extra.nomeMae || extra.mae || "",
            nomePai: extra.nomePai || extra.pai || "",
            address: customPayload?.address || extra.address || "",
            escalaHorario: extra.escalaHorario || "12x36",
            jornadaHoras: extra.jornadaHoras || "10:00 às 22:00",
            // Documentos complementares
            tituloEleitorNumero: extra.tituloEleitorNumero || "",
            tituloEleitorZona: extra.tituloEleitorZona || "",
            tituloEleitorSecao: extra.tituloEleitorSecao || "",
            cnhNumero: extra.cnhNumero || "",
            cnhCategoria: extra.cnhCategoria || "",
            cnhValidade: extra.cnhValidade || "",
            reservistaNumero: extra.reservistaNumero || "",
            reservistaCategoria: extra.reservistaCategoria || "",
            // Dependentes (extraídos via OCR ou editados no Wizard)
            dependentes: Array.isArray(extra.dependentes) ? extra.dependentes : (Array.isArray(extra.dependents) ? extra.dependents.map((d: any) => ({
                nome: d.nome || d.name || "",
                cpf: d.cpf || "",
                dataNascimento: d.dataNascimento || d.birthDate || "",
                parentesco: d.parentesco || "",
                salarioFamilia: d.salarioFamilia || "Não",
                irrf: d.irrf || "Não",
            })) : []),
            // Observações
            observacoes: extra.observacoes || "",
            // PIX
            pixKey: extra.chavePix || extra.uniformData?.pixKey || extra.pixKey || cpfRaw || "",
            pixTipoChave: extra.tipoChavePix || extra.pixTipoChave || (extra.uniformData?.pixKey ? "Outro" : "CPF"),
        };

        try {
            const result = await transmitCandidateToOnvio(payload);
            if (result.success) {
                await prisma.recruitmentCandidate.update({
                    where: { id: candidateId },
                    data: {
                        onvioLaunched: true,
                        onvioConfirmedAt: new Date()
                    }
                });

                // Auto-create/sync Employee and Posto Assignment
                await syncCandidateToEmployeeAndPosto(candidateId, customPayload).catch(e => console.warn("[sendCandidateToOnvioRpa] Sync warning:", e));

                revalidatePath("/admin/recrutamento");
                revalidatePath("/admin/employees");
                revalidatePath("/admin");
                return { success: true, message: result.message };
            } else {
                return { success: false, error: result.error };
            }
        } catch (rpaErr: any) {
            console.error("[RPA Server Action Error]:", rpaErr);
            return { success: false, error: rpaErr.message || "Falha na comunicação com o robô Onvio." };
        }
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function createRpaJobAction(candidateId: string, payload: any) {
    try {
        // Persistir dados atualizados na ficha do candidato
        if (payload?.extraFields) {
            const candidate = await prisma.recruitmentCandidate.findUnique({ where: { id: candidateId } });
            if (candidate) {
                const existing = (candidate.extraFields as Record<string, any>) || {};
                await prisma.recruitmentCandidate.update({
                    where: { id: candidateId },
                    data: {
                        extraFields: { ...existing, ...payload.extraFields },
                        email: payload.email || candidate.email,
                        phone: payload.phone || candidate.phone
                    }
                });
            }
        }

        const job = await prisma.rpaJob.create({
            data: {
                candidateId,
                status: "PENDING",
                payload: payload || {}
            }
        });
        return { success: true, jobId: job.id };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function checkRpaJobStatusAction(jobId: string) {
    try {
        const job = await prisma.rpaJob.findUnique({
            where: { id: jobId }
        });
        return { success: true, status: job?.status, result: job?.result };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
