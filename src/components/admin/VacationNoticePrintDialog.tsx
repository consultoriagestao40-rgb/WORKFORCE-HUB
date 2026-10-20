"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileText } from "lucide-react";
import { getVacationNoticePrintData } from "@/actions/vacation-workflow";

interface VacationNoticePrintDialogProps {
    vacationId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

export function VacationNoticePrintDialog({
    vacationId,
    isOpen,
    onClose
}: VacationNoticePrintDialogProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && vacationId) {
            setLoading(true);
            getVacationNoticePrintData(vacationId)
                .then(res => setData(res))
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        } else {
            setData(null);
        }
    }, [isOpen, vacationId]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 bg-white">
                <DialogHeader className="print:hidden flex flex-row items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600" />
                        <DialogTitle className="text-lg font-bold text-slate-800">
                            Aviso Formal de Concessão de Férias (Art. 135 CLT)
                        </DialogTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="default" 
                            size="sm" 
                            onClick={handlePrint}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimir Aviso
                        </Button>
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="py-12 text-center text-slate-500 text-sm">Carregando dados do comunicado...</div>
                ) : data ? (
                    <div className="print:m-0 print:p-0 text-slate-900 font-sans space-y-6 text-sm p-4 bg-slate-50/50 rounded-xl border border-slate-200 print:bg-white print:border-none">
                        {/* Cabeçalho */}
                        <div className="text-center border-b pb-4 space-y-1">
                            <h2 className="text-xl font-bold uppercase tracking-wider text-slate-900">
                                {data.company.name}
                            </h2>
                            <p className="text-xs text-slate-500 font-mono">
                                CNPJ: {data.company.cnpj} • {data.company.address}
                            </p>
                            <h3 className="text-base font-bold uppercase tracking-wide text-indigo-900 mt-3 pt-2">
                                COMUNICAÇÃO DE AVISO DE FÉRIAS
                            </h3>
                            <p className="text-xs text-slate-500">
                                (Em cumprimento ao Art. 135 da Consolidação das Leis do Trabalho - CLT)
                            </p>
                        </div>

                        {/* Dados do Empregado */}
                        <div className="bg-white p-4 rounded-lg border border-slate-200 text-xs space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <div><strong className="text-slate-500">Empregado(a):</strong> <span className="font-bold text-slate-900">{data.employee.name}</span></div>
                                <div><strong className="text-slate-500">CPF:</strong> <span className="font-mono text-slate-900">{data.employee.cpf}</span></div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><strong className="text-slate-500">Cargo / Função:</strong> <span className="text-slate-900">{data.employee.role}</span></div>
                                <div><strong className="text-slate-500">Posto / Local:</strong> <span className="text-slate-900">{data.employee.client}</span></div>
                            </div>
                            <div>
                                <strong className="text-slate-500">Data de Admissão:</strong> <span className="text-slate-900">{data.employee.admissionDate}</span>
                            </div>
                        </div>

                        {/* Corpo do Aviso */}
                        <div className="space-y-4 text-justify leading-relaxed text-slate-700 text-xs">
                            <p>
                                Vimos por meio desta comunicar-lhe que, nos termos da legislação trabalhista vigente (Art. 135 da CLT), 
                                ser-lhe-ão concedidas férias relativas ao seu período aquisitivo de direito, a serem usufruídas conforme o seguinte cronograma:
                            </p>

                            <div className="bg-indigo-50/60 p-4 rounded-lg border border-indigo-100 text-center space-y-2">
                                <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider block">
                                    Período de Gozo das Férias:
                                </span>
                                <div className="text-base font-bold text-indigo-700">
                                    De {data.vacation.startDateFormatted} até {data.vacation.endDateFormatted}
                                </div>
                                <div className="text-xs text-slate-600">
                                    Duração: <strong>{data.vacation.daysTaken} dias corridos</strong>
                                    {data.vacation.daysSold > 0 && ` + ${data.vacation.daysSold} dias de Abono Pecuniário (venda)`}
                                </div>
                                <div className="text-xs text-emerald-700 font-semibold pt-1">
                                    Data Prevista de Retorno ao Trabalho: {data.vacation.returnDateFormatted}
                                </div>
                            </div>

                            <p>
                                Informamos que a remuneração relativa a este período de férias, acrescida do terço constitucional 
                                (Art. 7º, XVII da CF/88), estará à sua disposição para pagamento até o dia <strong>{data.vacation.paymentDeadlineFormatted}</strong> 
                                (Art. 145 da CLT).
                            </p>

                            <p>
                                Solicitamos a gentileza de apor o seu ciente na 2ª via deste comunicado e devolvê-la devidamente assinada ao Departamento Pessoal.
                            </p>
                        </div>

                        {/* Local, Data e Assinaturas */}
                        <div className="pt-6 space-y-12">
                            <div className="text-right text-xs text-slate-600">
                                Curitiba - PR, {data.vacation.noticeDateFormatted}.
                            </div>

                            <div className="grid grid-cols-2 gap-8 pt-4">
                                <div className="text-center space-y-1 border-t border-slate-400 pt-2">
                                    <div className="text-xs font-bold text-slate-800">{data.company.name}</div>
                                    <div className="text-[10px] text-slate-500 uppercase">Empregador</div>
                                </div>
                                <div className="text-center space-y-1 border-t border-slate-400 pt-2">
                                    <div className="text-xs font-bold text-slate-800">{data.employee.name}</div>
                                    <div className="text-[10px] text-slate-500 uppercase">Ciente do Empregado em: ___/___/______</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
