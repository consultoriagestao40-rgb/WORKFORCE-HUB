import { getEpiPrintData } from "@/actions/epi";
import { PrintFichaClient } from "@/components/admin/PrintFichaClient";

interface PrintPageProps {
    params: Promise<{ id: string }>;
}

export default async function EpiPrintPage({ params }: PrintPageProps) {
    const resolvedParams = await params;
    const employee = await getEpiPrintData(resolvedParams.id);

    const extra = (employee.extraFields as any) || {};
    const camisetaSize = extra.camisetaTamanho || "";
    const calcaSize = extra.calcaTamanho || "";
    const luvasSize = extra.luvasTamanho || "";
    const sapatoSize = extra.sapatoTamanho || "";

    const activeAssignment = employee.assignments?.[0];
    const roleName = employee.role?.name || activeAssignment?.posto?.role?.name || "Auxiliar de Limpeza";
    const companyName = employee.company?.name || "SPOT SERVIÇOS FACILITIES LTDA";

    const formattedAdmission = employee.admissionDate
        ? new Date(employee.admissionDate).getUTCDate().toString().padStart(2, '0') + '/' + 
          (new Date(employee.admissionDate).getUTCMonth() + 1).toString().padStart(2, '0') + '/' + 
          new Date(employee.admissionDate).getUTCFullYear()
        : "__/__/____";

    const formattedDismissal = employee.dismissalReason
        ? "__/__/____" // If they have some indicator but no date
        : "__/__/____";

    // Pad the table with empty rows to make it look like a physical sheet
    const maxRows = 16;
    const filledDeliveries = employee.epiDeliveries || [];
    const emptyRowsCount = Math.max(0, maxRows - filledDeliveries.length);
    const emptyRowsArray = Array.from({ length: emptyRowsCount });

    return (
        <div className="min-h-screen bg-white text-black p-4 font-mono text-[11px] leading-tight">
            {/* Top Helper Print Bar */}
            <PrintFichaClient />

            {/* Ficha Container */}
            <div className="max-w-[800px] mx-auto border border-black p-4 space-y-4">
                
                {/* 1. Header Box */}
                <div className="border-b border-black pb-2 text-center">
                    <h1 className="font-extrabold text-sm uppercase tracking-wider mb-2">
                        FICHA DE ENTREGA DE EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL (EPI)
                    </h1>
                </div>

                {/* 2. Employee and Company Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-black pb-3">
                    <div>
                        <span className="font-extrabold uppercase">Empresa:</span> {companyName}
                    </div>
                    <div>
                        <span className="font-extrabold uppercase">Função:</span> {roleName}
                    </div>
                    <div>
                        <span className="font-extrabold uppercase">Nome do Trabalhador:</span> {employee.name}
                    </div>
                    <div>
                        <span className="font-extrabold uppercase">CPF:</span> {employee.cpf || "___________________"}
                    </div>
                    <div>
                        <span className="font-extrabold uppercase">Data de Admissão:</span> {formattedAdmission}
                    </div>
                    <div>
                        <span className="font-extrabold uppercase">Data de Demissão:</span> {formattedDismissal}
                    </div>
                </div>

                {/* 3. Motivos e Legenda Box */}
                <div className="grid grid-cols-2 gap-4 border-b border-black pb-3 text-[10px]">
                    <div className="space-y-1">
                        <strong className="block uppercase font-extrabold text-[10px] mb-0.5">M.E.R - Motivos para Entrega/Recebimento:</strong>
                        <div className="grid grid-cols-1 gap-0.5">
                            <div>1 - Recebimento de rotina ou EPI descartável</div>
                            <div>2 - Substituição por dano justificado</div>
                            <div>3 - Substituição por dano próprio ou perda</div>
                            <div>4 - Devolução, demissão / mudança de função</div>
                            <div>5 - Primeira entrega</div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <strong className="block uppercase font-extrabold text-[10px] mb-0.5">Legenda / Informações:</strong>
                        <div><strong>CA:</strong> Certificado de Aprovação (Ministério do Trabalho)</div>
                        <div><strong>M.E.R:</strong> Motivos para Entrega e Recebimento de EPI</div>
                    </div>
                </div>

                {/* 4. Termo de Responsabilidade */}
                <div className="space-y-3">
                    <h2 className="text-center font-extrabold uppercase tracking-wide text-xs">
                        TERMO DE RESPONSABILIDADE
                    </h2>
                    <p className="text-justify text-[10px] leading-relaxed">
                        Declaro para os devidos fins que recebi os E.P.I's (Equipamento de Proteção Individual) abaixo descritos e me comprometo: Usá-los apenas para as finalidades a que se destinam; Responsabilizar-me por sua guarda e conservação; Comunicar ao empregador qualquer modificação que os tornem impróprios para o uso; Responsabilizar-me pela danificação do E.P.I devido ao uso inadequado ou fora das atividades a que se destinam, bem como pelo seu extravio. Declaro ainda estar ciente de que o uso é obrigatório sob pena de ser punido conforme LEI nº 6.514, de 22/12/77, artigo 158, que diz: recusa injustificada ao uso de EPI ou vestimenta fornecido pelo serviço de saúde constitui ato faltoso, autorizador de despedida por "Justa Causa". Declaro que recebi treinamento referente ao uso e conservação do E.P.I segundo as Normas de Segurança do Trabalho.
                    </p>

                    {/* Sizes Row */}
                    <div className="flex gap-6 justify-center font-bold text-xs">
                        <span>Camiseta: <span className="border-b border-black px-3 font-extrabold">{camisetaSize || "___"}</span></span>
                        <span>Calça: <span className="border-b border-black px-3 font-extrabold">{calcaSize || "___"}</span></span>
                        <span>Luvas: <span className="border-b border-black px-3 font-extrabold">{luvasSize || "___"}</span></span>
                        <span>Calçado: <span className="border-b border-black px-3 font-extrabold">{sapatoSize || "___"}</span></span>
                    </div>

                    {/* Location and Signature */}
                    <div className="flex justify-between items-end pt-4 pb-2 text-xs">
                        <div>
                            Curitiba, ______/______/__________
                        </div>
                        <div className="text-center w-[300px]">
                            <div className="border-b border-black w-full h-4 mb-1"></div>
                            <span className="font-extrabold">ASSINATURA DO TRABALHADOR</span>
                        </div>
                    </div>
                </div>

                {/* 5. Items Grid Table */}
                <div>
                    <table className="w-full border-collapse border border-black text-center text-[10px]">
                        <thead>
                            <tr className="bg-slate-100 font-extrabold uppercase">
                                <th className="border border-black p-1 w-[80px]">Data Entrega</th>
                                <th className="border border-black p-1 w-[40px]">Qtd.</th>
                                <th className="border border-black p-1 w-[45px]">Und.</th>
                                <th className="border border-black p-1 w-[70px]">C.A.</th>
                                <th className="border border-black p-1">Item / Descrição</th>
                                <th className="border border-black p-1 w-[60px]">M.E.R.</th>
                                <th className="border border-black p-1 w-[160px]">Assinatura Trabalhador</th>
                                <th className="border border-black p-1 w-[110px]">Responsável Entrega</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Render assigned deliveries */}
                            {filledDeliveries.map((d: any) => {
                                const deliveryDateObj = new Date(d.deliveryDate);
                                const dateFormatted = `${deliveryDateObj.getUTCDate().toString().padStart(2, '0')}/${(deliveryDateObj.getUTCMonth() + 1).toString().padStart(2, '0')}/${deliveryDateObj.getUTCFullYear()}`;
                                return (
                                    <tr key={d.id}>
                                        <td className="border border-black p-1 font-bold">{dateFormatted}</td>
                                        <td className="border border-black p-1 font-extrabold">{d.quantity}</td>
                                        <td className="border border-black p-1">{d.epiItem.unit}</td>
                                        <td className="border border-black p-1 font-bold">{d.epiItem.caNumber || "-"}</td>
                                        <td className="border border-black p-1 text-left px-2 font-bold">
                                            {d.epiItem.name} {d.epiItem.size ? `(${d.epiItem.size})` : ""}
                                        </td>
                                        <td className="border border-black p-1">{d.merCode}</td>
                                        <td className="border border-black p-1 text-slate-400 italic">Ciente / Assinado</td>
                                        <td className="border border-black p-1 truncate max-w-[110px]">
                                            {d.deliveredBy?.name || "Mesa"}
                                        </td>
                                    </tr>
                                );
                            })}
                            {/* Render empty rows for padding */}
                            {emptyRowsArray.map((_, idx) => (
                                <tr key={`empty-${idx}`} className="h-[22px]">
                                    <td className="border border-black p-1"></td>
                                    <td className="border border-black p-1"></td>
                                    <td className="border border-black p-1"></td>
                                    <td className="border border-black p-1"></td>
                                    <td className="border border-black p-1"></td>
                                    <td className="border border-black p-1"></td>
                                    <td className="border border-black p-1"></td>
                                    <td className="border border-black p-1"></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
}
