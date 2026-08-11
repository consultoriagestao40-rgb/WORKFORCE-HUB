"use server";

import { prisma } from "@/lib/db";
import { transmitCandidateToOnvio, OnvioCandidatePayload } from "@/lib/rpa/onvio";
import { revalidatePath } from "next/cache";


export async function sendCandidateToOnvioRpa(candidateId: string) {
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

        const extra = (candidate.extraFields as Record<string, any>) || {};
        const cpfRaw = extra.cpf || (candidate as any).cpf || "";
        const cpfDigits = cpfRaw.replace(/\D/g, "");
        const ctpsNum = cpfDigits.length >= 7 ? cpfDigits.slice(0, 7) : "";
        const ctpsSerie = cpfDigits.length >= 11 ? cpfDigits.slice(7, 11) : (cpfDigits.length >= 4 ? cpfDigits.slice(-4) : "");

        const payload: OnvioCandidatePayload = {
            candidateId: candidate.id,
            candidateName: candidate.name,
            candidateCpf: cpfRaw,
            candidateEmail: candidate.email || extra.email || undefined,
            candidatePhone: candidate.phone || extra.phone || undefined,
            vacancyTitle: candidate.vacancy?.role?.name || candidate.vacancy?.title || "Vaga Operacional",
            companyName: candidate.vacancy?.company?.name || "Grupo JVS Serviços",
            clientName: candidate.vacancy?.posto?.client?.name || "",
            baseSalary: candidate.vacancy?.posto?.baseSalary || 1900,
            rgNumero: extra.rgNumero || extra.rg || "",
            rgOrgaoEmissor: extra.rgOrgaoEmissor || extra.rgOrgao || "SSP",
            rgUf: extra.rgUf || "PR",
            rgDataEmissao: extra.rgDataEmissao || "",
            ctpsNumero: extra.ctpsNumero || ctpsNum,
            ctpsSerie: extra.ctpsSerie || ctpsSerie,
            ctpsDataEmissao: extra.ctpsDataEmissao || "",
            pisNumero: extra.pisNumero || extra.pis || cpfRaw,
            birthDate: extra.birthDate || "",
            gender: extra.gender || "",
            nomeMae: extra.nomeMae || "",
            nomePai: extra.nomePai || "",
            address: extra.address || "",
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
            // Dependentes (extraídos via OCR de documentos dos filhos)
            dependentes: Array.isArray(extra.dependents) ? extra.dependents.map((d: any) => ({
                nome: d.nome || d.name || "",
                cpf: d.cpf || "",
                dataNascimento: d.dataNascimento || d.birthDate || "",
                parentesco: d.parentesco || "",
                salarioFamilia: d.salarioFamilia || "Não",
                irrf: d.irrf || "Não",
            })) : [],
            // Observações automáticas
            observacoes: extra.observacoes || "",
            // PIX - chave do uniformData, fallback para CPF
            pixKey: extra.uniformData?.pixKey || extra.pixKey || cpfRaw || "",
            pixTipoChave: extra.pixTipoChave || (extra.uniformData?.pixKey ? "Outro" : "CPF"),
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

                revalidatePath("/admin/recrutamento");
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
