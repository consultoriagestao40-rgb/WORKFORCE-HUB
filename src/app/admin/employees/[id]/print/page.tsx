export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { notFound } from "next/navigation";
import { PrintFichaClient } from "@/components/admin/PrintFichaClient";
import { Metadata } from "next";

export async function generateMetadata(
    props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
    const params = await props.params;
    const employee = await prisma.employee.findUnique({
        where: { id: params.id },
        select: { name: true }
    });
    return {
        title: employee ? employee.name.toUpperCase() : "FICHA DE REGISTRO"
    };
}

async function getEmployeePrintData(id: string) {
    return await prisma.employee.findUnique({
        where: { id },
        include: {
            role: true,
            situation: true,
            company: true,
            assignments: {
                where: { endDate: null },
                include: {
                    posto: {
                        include: { client: true }
                    }
                }
            }
        }
    });
}

export default async function PrintEmployeeProfilePage(props: {
    params: Promise<{ id: string }>
}) {
    const params = await props.params;
    const employee = await getEmployeePrintData(params.id);

    if (!employee) {
        return notFound();
    }

    const currentAssignment = employee.assignments?.[0];
    const extra = (employee.extraFields as any) || {};
    const dependents = (extra.dependentes as any[]) || [];
    const admissionDate = new Date(employee.admissionDate);
    const birthDate = employee.birthDate ? new Date(employee.birthDate) : null;

    // Formatting Helpers
    const formatDate = (date: Date | null) => {
        if (!date) return "---";
        return format(date, "dd/MM/yyyy");
    };

    const formatCurrency = (val: number) => {
        return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    return (
        <div className="p-10 max-w-[800px] mx-auto bg-white text-slate-900 font-sans text-xs space-y-6 print-container">
            {/* Print control banner */}
            <PrintFichaClient />

            {/* Title / Header */}
            <div className="border-2 border-slate-950 p-4 flex justify-between items-center bg-slate-50">
                <div className="space-y-1">
                    <h1 className="text-xl font-black tracking-tight text-slate-950">FICHA DE REGISTRO DE EMPREGADO</h1>
                    <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Work Force Hub - Gestão de Equipe</p>
                </div>
                <div className="text-right space-y-0.5">
                    <div className="font-extrabold text-[10px] uppercase text-slate-800">{employee.company?.name || "Sem Empresa Vinculada"}</div>
                    <div className="text-[9px] font-bold text-slate-400">CPF: {employee.cpf}</div>
                </div>
            </div>

            {/* SEÇÃO 1: DADOS PESSOAIS */}
            <div className="space-y-1.5">
                <h3 className="font-black text-[10px] uppercase tracking-wider text-slate-950 border-b-2 border-slate-950 pb-0.5">1. Dados Pessoais</h3>
                <table className="w-full border-collapse border border-slate-300 text-left">
                    <tbody>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50 w-1/4">Nome Completo:</td>
                            <td className="p-2 w-1/4 font-medium">{employee.name}</td>
                            <td className="p-2 border-r border-slate-300 border-l font-bold bg-slate-50 w-1/4">Nome Social:</td>
                            <td className="p-2 w-1/4 font-medium">{extra.nomeSocial || "---"}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">CPF:</td>
                            <td className="p-2 font-medium">{employee.cpf}</td>
                            <td className="p-2 border-r border-slate-300 border-l font-bold bg-slate-50">Data de Nascimento:</td>
                            <td className="p-2 font-medium">{formatDate(birthDate)}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">Gênero:</td>
                            <td className="p-2 font-medium">{employee.gender || "---"}</td>
                            <td className="p-2 border-r border-slate-300 border-l font-bold bg-slate-50">Estado Civil:</td>
                            <td className="p-2 font-medium">{extra.estadoCivil || "---"}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">Grau de Instrução:</td>
                            <td className="p-2 font-medium">{extra.grauInstrucao || "---"}</td>
                            <td className="p-2 border-r border-slate-300 border-l font-bold bg-slate-50">Nacionalidade:</td>
                            <td className="p-2 font-medium">{extra.nacionalidade || "---"}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">Naturalidade:</td>
                            <td className="p-2 font-medium" colSpan={3}>{extra.naturalidadeCidade || "---"} {extra.naturalidadeUf ? `/ ${extra.naturalidadeUf}` : ""}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">Nome do Pai:</td>
                            <td className="p-2 font-medium" colSpan={3}>{extra.nomePai || "---"}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">Nome da Mãe:</td>
                            <td className="p-2 font-medium" colSpan={3}>{extra.nomeMae || "---"}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">Endereço Completo:</td>
                            <td className="p-2 font-medium" colSpan={3}>{employee.address || "---"}</td>
                        </tr>
                        <tr>
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">Telefone:</td>
                            <td className="p-2 font-medium">{employee.phone || "---"}</td>
                            <td className="p-2 border-r border-slate-300 border-l font-bold bg-slate-50">Email Pessoal:</td>
                            <td className="p-2 font-medium">{employee.email || "---"}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* SEÇÃO 2: DOCUMENTOS DE IDENTIFICAÇÃO */}
            <div className="space-y-1.5">
                <h3 className="font-black text-[10px] uppercase tracking-wider text-slate-950 border-b-2 border-slate-950 pb-0.5">2. Documentos de Identificação</h3>
                <table className="w-full border-collapse border border-slate-300 text-left">
                    <tbody>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50 w-1/4">RG Número:</td>
                            <td className="p-2 w-1/4 font-medium">{extra.rgNumero || "---"}</td>
                            <td className="p-2 border-r border-slate-300 border-l font-bold bg-slate-50 w-1/4">RG Emissor/UF:</td>
                            <td className="p-2 w-1/4 font-medium">{extra.rgOrgaoEmissor || "---"} {extra.rgUf ? `/ ${extra.rgUf}` : ""}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">RG Emissão:</td>
                            <td className="p-2 font-medium" colSpan={3}>{extra.rgDataEmissao ? format(new Date(extra.rgDataEmissao), "dd/MM/yyyy") : "---"}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">CNH Número:</td>
                            <td className="p-2 font-medium">{extra.cnhNumero || "---"}</td>
                            <td className="p-2 border-r border-slate-300 border-l font-bold bg-slate-50">CNH Cat./Validade:</td>
                            <td className="p-2 font-medium">
                                {extra.cnhCategoria ? `CAT: ${extra.cnhCategoria}` : ""} {extra.cnhValidade ? `| VAL: ${format(new Date(extra.cnhValidade), "dd/MM/yyyy")}` : "---"}
                            </td>
                        </tr>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">Título Eleitor:</td>
                            <td className="p-2 font-medium" colSpan={3}>
                                {extra.tituloEleitorNumero ? `${extra.tituloEleitorNumero} (ZONA: ${extra.tituloEleitorZona || "---"}, SEÇÃO: ${extra.tituloEleitorSecao || "---"})` : "---"}
                            </td>
                        </tr>
                        <tr>
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">Cert. Reservista:</td>
                            <td className="p-2 font-medium" colSpan={3}>
                                {extra.reservistaNumero ? `${extra.reservistaNumero} (CAT: ${extra.reservistaCategoria || "---"})` : "---"}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* SEÇÃO 3: DADOS CONTRATUAIS */}
            <div className="space-y-1.5">
                <h3 className="font-black text-[10px] uppercase tracking-wider text-slate-950 border-b-2 border-slate-950 pb-0.5">3. Contrato de Trabalho & Posto</h3>
                <table className="w-full border-collapse border border-slate-300 text-left">
                    <tbody>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50 w-1/4">Matrícula:</td>
                            <td className="p-2 w-1/4 font-medium">{extra.matricula || "---"}</td>
                            <td className="p-2 border-r border-slate-300 border-l font-bold bg-slate-50 w-1/4">Função / Cargo:</td>
                            <td className="p-2 w-1/4 font-medium">{employee.role?.name || "---"}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">Data Admissão:</td>
                            <td className="p-2 font-medium">{formatDate(admissionDate)}</td>
                            <td className="p-2 border-r border-slate-300 border-l font-bold bg-slate-50">Tipo de Contrato:</td>
                            <td className="p-2 font-medium">{employee.type}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">Carga Horária:</td>
                            <td className="p-2 font-medium">{employee.workload}h/mês</td>
                            <td className="p-2 border-r border-slate-300 border-l font-bold bg-slate-50">Posto / Cliente Ativo:</td>
                            <td className="p-2 font-medium">{currentAssignment?.posto?.client?.name || "RESERVA TÉCNICA"}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">Salário Base:</td>
                            <td className="p-2 font-medium">{formatCurrency(employee.salary)}</td>
                            <td className="p-2 border-r border-slate-300 border-l font-bold bg-slate-50">Insalubridade:</td>
                            <td className="p-2 font-medium">{formatCurrency(employee.insalubridade)}</td>
                        </tr>
                        <tr>
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">Periculosidade:</td>
                            <td className="p-2 font-medium">{formatCurrency(employee.periculosidade)}</td>
                            <td className="p-2 border-r border-slate-300 border-l font-bold bg-slate-50">Gratificação CCT:</td>
                            <td className="p-2 font-medium">{formatCurrency(employee.gratificacao)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* SEÇÃO 4: CTPS, PIS & FGTS */}
            <div className="space-y-1.5">
                <h3 className="font-black text-[10px] uppercase tracking-wider text-slate-950 border-b-2 border-slate-950 pb-0.5">4. Documentos Profissionais (Onvio/Thomson)</h3>
                <table className="w-full border-collapse border border-slate-300 text-left">
                    <tbody>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50 w-1/4">CTPS Número/Série:</td>
                            <td className="p-2 w-1/4 font-medium">{extra.ctpsNumero ? `${extra.ctpsNumero} / ${extra.ctpsSerie || "---"}` : "---"}</td>
                            <td className="p-2 border-r border-slate-300 border-l font-bold bg-slate-50 w-1/4">CTPS UF / Emissão:</td>
                            <td className="p-2 w-1/4 font-medium">
                                {extra.ctpsUf || "---"} {extra.ctpsDataEmissao ? `| ${format(new Date(extra.ctpsDataEmissao), "dd/MM/yyyy")}` : ""}
                            </td>
                        </tr>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">PIS (Número):</td>
                            <td className="p-2 font-medium" colSpan={3}>{extra.pisNumero || "---"}</td>
                        </tr>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">FGTS Opção / Data:</td>
                            <td className="p-2 font-medium">
                                {extra.fgtsOpcao || "---"} {extra.fgtsDataOpcao ? `| ${format(new Date(extra.fgtsDataOpcao), "dd/MM/yyyy")}` : ""}
                            </td>
                            <td className="p-2 border-r border-slate-300 border-l font-bold bg-slate-50">FGTS Banco Depositário:</td>
                            <td className="p-2 font-medium">{extra.fgtsBanco || "---"}</td>
                        </tr>
                        <tr>
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">Conselho de Classe:</td>
                            <td className="p-2 font-medium" colSpan={3}>
                                {extra.conselhoNome ? `${extra.conselhoNome} (REGISTRO: ${extra.conselhoNumero || "---"}, UF: ${extra.conselhoUf || "---"})` : "---"}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* SEÇÃO 5: BENEFÍCIOS */}
            <div className="space-y-1.5">
                <h3 className="font-black text-[10px] uppercase tracking-wider text-slate-950 border-b-2 border-slate-950 pb-0.5">5. Integração de Benefícios (VT e VA)</h3>
                <table className="w-full border-collapse border border-slate-300 text-left">
                    <tbody>
                        <tr className="border-b border-slate-300">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50 w-1/4">Optante VT:</td>
                            <td className="p-2 w-1/4 font-medium">{employee.vtOptIn ? "Sim (Optante pelo VT)" : "Não (Não Optante)"}</td>
                            <td className="p-2 border-r border-slate-300 border-l font-bold bg-slate-50 w-1/4">Destino VT:</td>
                            <td className="p-2 w-1/4 font-medium">
                                {employee.vtOptIn ? (employee.vtPaymentMethod === "Outro" ? employee.vtCustomPaymentDetails : employee.vtPaymentMethod) : "---"}
                            </td>
                        </tr>
                        <tr>
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50">Valor VA Módulo:</td>
                            <td className="p-2 font-medium">{formatCurrency(employee.valeAlimentacao)}</td>
                            <td className="p-2 border-r border-slate-300 border-l font-bold bg-slate-50">Destino VA:</td>
                            <td className="p-2 font-medium">
                                {employee.vaPaymentMethod === "Outro" ? employee.vaCustomPaymentDetails : employee.vaPaymentMethod}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* SEÇÃO 6: DEPENDENTES */}
            <div className="space-y-1.5">
                <h3 className="font-black text-[10px] uppercase tracking-wider text-slate-950 border-b-2 border-slate-950 pb-0.5">6. Dependentes</h3>
                {dependents.length === 0 ? (
                    <div className="p-3 border border-slate-300 text-center font-medium text-slate-500">Nenhum dependente declarado.</div>
                ) : (
                    <table className="w-full border-collapse border border-slate-300 text-left text-[10px]">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-300 font-bold">
                                <th className="p-2 border-r border-slate-300">Nome</th>
                                <th className="p-2 border-r border-slate-300">CPF</th>
                                <th className="p-2 border-r border-slate-300">Nascimento</th>
                                <th className="p-2 border-r border-slate-300">Parentesco</th>
                                <th className="p-2 border-r border-slate-300 text-center">Sal. Família</th>
                                <th className="p-2 text-center">IRRF</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300">
                            {dependents.map((dep, i) => (
                                <tr key={i} className="font-medium">
                                    <td className="p-2 border-r border-slate-300">{dep.nome}</td>
                                    <td className="p-2 border-r border-slate-300">{dep.cpf || "---"}</td>
                                    <td className="p-2 border-r border-slate-300">{dep.dataNascimento ? format(new Date(dep.dataNascimento), "dd/MM/yyyy") : "---"}</td>
                                    <td className="p-2 border-r border-slate-300">{dep.parentesco}</td>
                                    <td className="p-2 border-r border-slate-300 text-center">{dep.salarioFamilia}</td>
                                    <td className="p-2 text-center">{dep.irrf}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* SEÇÃO 7: TERMO DE COMPROMISSO E ASSINATURA */}
            <div className="pt-8 space-y-12">
                <p className="text-center font-bold text-[10px] leading-relaxed text-slate-700">
                    Declaro, sob as penas da lei, que todas as informações prestadas nesta ficha cadastral são verdadeiras, completas e exatas.
                </p>
                <div className="flex justify-between items-end pt-4">
                    <div className="w-1/2">
                        <span className="font-bold text-slate-500">Local e Data:</span>
                        <div className="border-b border-slate-400 w-3/4 pt-4 text-slate-400">Curitiba, ______ de ____________________ de 20____</div>
                    </div>
                    <div className="w-1/2 flex flex-col items-center">
                        <div className="border-t border-slate-400 w-3/4 text-center pt-1.5 font-bold text-[10px] uppercase text-slate-700">
                            Assinatura do Colaborador
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        margin: 15mm 20mm !important;
                    }
                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .print-container {
                        padding: 0 !important;
                        max-width: 100% !important;
                        width: 100% !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    tr, table {
                        page-break-inside: avoid;
                    }
                }
            `}} />
        </div>
    );
}
