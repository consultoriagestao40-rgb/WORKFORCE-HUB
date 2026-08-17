import { NextRequest, NextResponse } from "next/server";
import { transmitCandidateToOnvio, OnvioCandidatePayload } from "@/lib/rpa/onvio";
import { prisma } from "@/lib/db";
import { syncCandidateToEmployeeAndPosto } from "@/actions/recruitment";

export const maxDuration = 60; // 60 segundos para execução na nuvem Vercel
export const dynamic = 'force-dynamic';

// Permitir requisições CORS de origens confiáveis (ex: Vercel app) para disparar o robô localmente
function getCorsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: getCorsHeaders() });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { candidateId, payload: providedPayload } = body;

        let payload: OnvioCandidatePayload = providedPayload;

        // Se passar candidatoId em vez de payload completo, busca no banco local
        if (!payload && candidateId) {
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
                return NextResponse.json(
                    { success: false, error: "Candidato não encontrado." },
                    { status: 404, headers: getCorsHeaders() }
                );
            }

            const extra = (candidate.extraFields as Record<string, any>) || {};
            const cpfRaw = extra.cpf || (candidate as any).cpf || "";
            const cpfDigits = cpfRaw.replace(/\D/g, "");
            const ctpsNum = cpfDigits.length >= 7 ? cpfDigits.slice(0, 7) : "";
            const ctpsSerie = cpfDigits.length >= 11 ? cpfDigits.slice(7, 11) : (cpfDigits.length >= 4 ? cpfDigits.slice(-4) : "");

            payload = {
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
                tituloEleitorNumero: extra.tituloEleitorNumero || "",
                tituloEleitorZona: extra.tituloEleitorZona || "",
                tituloEleitorSecao: extra.tituloEleitorSecao || "",
                cnhNumero: extra.cnhNumero || "",
                cnhCategoria: extra.cnhCategoria || "",
                cnhValidade: extra.cnhValidade || "",
                reservistaNumero: extra.reservistaNumero || "",
                reservistaCategoria: extra.reservistaCategoria || "",
                dependentes: Array.isArray(extra.dependents) ? extra.dependents.map((d: any) => ({
                    nome: d.nome || d.name || "",
                    cpf: d.cpf || "",
                    dataNascimento: d.dataNascimento || d.birthDate || "",
                    parentesco: d.parentesco || "",
                    salarioFamilia: d.salarioFamilia || "Não",
                    irrf: d.irrf || "Não",
                })) : [],
                observacoes: extra.observacoes || "",
                pixKey: extra.uniformData?.pixKey || extra.pixKey || cpfRaw || "",
                pixTipoChave: extra.pixTipoChave || (extra.uniformData?.pixKey ? "Outro" : "CPF"),
            };
        }

        if (!payload) {
            return NextResponse.json(
                { success: false, error: "Payload do candidato não informado." },
                { status: 400, headers: getCorsHeaders() }
            );
        }

        const result = await transmitCandidateToOnvio(payload);

        // Se for disparado com sucesso e tiver candidatoId, marca no banco local
        if (result.success && candidateId) {
            try {
                await prisma.recruitmentCandidate.update({
                    where: { id: candidateId },
                    data: {
                        onvioLaunched: true,
                        onvioConfirmedAt: new Date()
                    }
                });

                // Auto-create/sync Employee and Posto Assignment
                await syncCandidateToEmployeeAndPosto(candidateId, payload).catch(e => console.warn("[API RPA Onvio] Sync warning:", e));
            } catch (e) {
                console.warn("Aviso ao atualizar candidato localmente:", e);
            }
        }

        return NextResponse.json(result, { headers: getCorsHeaders() });
    } catch (error: any) {
        console.error("[API RPA ONVIO Error]:", error);
        return NextResponse.json(
            { success: false, error: error?.message || "Erro no processamento do robô RPA." },
            { status: 500, headers: getCorsHeaders() }
        );
    }
}
