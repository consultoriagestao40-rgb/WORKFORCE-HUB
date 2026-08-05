"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, FileText, Stethoscope, UserPlus, Upload, ShieldCheck, FileCheck2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import actions later

export function AdmissionWorkflow({ candidate, onComplete }: { candidate: any, onComplete: () => void }) {
    const [currentStep, setCurrentStep] = useState<"docs" | "aso" | "allocate">("docs");
    const [isExtracting, setIsExtracting] = useState(false);

    // Mock states for now
    const [docsValid, setDocsValid] = useState(candidate.admissionStatus === 'PENDING_ASO' || candidate.admissionStatus === 'READY_TO_HIRE');
    const [asoValid, setAsoValid] = useState(candidate.admissionStatus === 'READY_TO_HIRE');

    const handleExtractData = async () => {
        setIsExtracting(true);
        // Fake AI extraction delay
        setTimeout(() => {
            toast.success("Dados extraídos com sucesso via IA OCR!");
            setDocsValid(true);
            setCurrentStep("aso");
            setIsExtracting(false);
        }, 2000);
    };

    const handleAsoValidation = () => {
        toast.success("ASO Validado como APTO!");
        setAsoValid(true);
        setCurrentStep("allocate");
    };

    return (
        <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 border-b border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-500" />
                    Fluxo de Admissão Obrigatório
                </h3>
                <p className="text-sm text-slate-500 mt-1">Conclua as etapas abaixo para liberar a contratação.</p>
            </div>

            <div className="p-4">
                <Tabs value={currentStep} onValueChange={(v: any) => setCurrentStep(v)} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-6 bg-slate-100/50">
                        <TabsTrigger value="docs" className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200">
                            <div className="flex items-center gap-2">
                                {docsValid ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <FileText className="w-4 h-4" />}
                                1. Documentos
                            </div>
                        </TabsTrigger>
                        <TabsTrigger value="aso" disabled={!docsValid} className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200">
                            <div className="flex items-center gap-2">
                                {asoValid ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Stethoscope className="w-4 h-4" />}
                                2. Exame Médico
                            </div>
                        </TabsTrigger>
                        <TabsTrigger value="allocate" disabled={!asoValid} className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200">
                            <div className="flex items-center gap-2">
                                <UserPlus className="w-4 h-4" />
                                3. Alocação
                            </div>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="docs" className="space-y-4 animate-in fade-in-50">
                        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 flex gap-3">
                            <ScanSearch className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-blue-900 text-sm">Leitura Inteligente de Documentos</h4>
                                <p className="text-sm text-blue-700/80 mt-1">Faça o upload dos documentos e clique em Extrair. Nossa inteligência artificial preencherá a ficha admissional automaticamente.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-4">
                                <div className="border border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                                    <span className="font-medium text-slate-700">Fazer Upload de Arquivos</span>
                                    <span className="text-xs text-slate-500 mt-1">Arraste PDFs ou Imagens (RG, CPF, CNH, Comprovante de Endereço)</span>
                                </div>
                                
                                <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg space-y-3">
                                    <h4 className="font-medium text-slate-700 text-sm border-b pb-2">Informações Complementares</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">E-mail</Label>
                                            <Input type="email" placeholder="candidato@email.com" className="h-8 text-xs" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Chave PIX</Label>
                                            <Input placeholder="CPF, Celular ou E-mail" className="h-8 text-xs" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Tamanho Sapato</Label>
                                            <Input placeholder="Ex: 40" className="h-8 text-xs" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Tamanho Calça</Label>
                                            <Input placeholder="Ex: M / 42" className="h-8 text-xs" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Tamanho Camisa</Label>
                                            <Input placeholder="Ex: G / 44" className="h-8 text-xs" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Documentos Identificados</Label>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-2 rounded-md bg-slate-50 border border-slate-100">
                                        <div className="flex items-center gap-2 text-sm"><FileCheck2 className="w-4 h-4 text-slate-400" /> RG / CPF</div>
                                        <Badge variant="outline" className="text-[10px]">Pendente</Badge>
                                    </div>
                                    <div className="flex items-center justify-between p-2 rounded-md bg-slate-50 border border-slate-100">
                                        <div className="flex items-center gap-2 text-sm"><FileCheck2 className="w-4 h-4 text-slate-400" /> Carteira de Trabalho</div>
                                        <Badge variant="outline" className="text-[10px]">Pendente</Badge>
                                    </div>
                                    <div className="flex items-center justify-between p-2 rounded-md bg-slate-50 border border-slate-100">
                                        <div className="flex items-center gap-2 text-sm"><FileCheck2 className="w-4 h-4 text-slate-400" /> Comprovante de Endereço</div>
                                        <Badge variant="outline" className="text-[10px]">Pendente</Badge>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button onClick={handleExtractData} disabled={isExtracting}>
                                {isExtracting ? "Analisando com IA..." : "Validar e Extrair Dados"}
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="aso" className="space-y-4 animate-in fade-in-50">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <Label>Upload do Atestado Médico (ASO)</Label>
                                    <div className="mt-2 border border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                                        <Upload className="w-6 h-6 text-slate-400 mb-2" />
                                        <span className="font-medium text-slate-700 text-sm">Selecionar Arquivo PDF</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Parecer Médico</Label>
                                    <Select>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o parecer" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="APTO">Apto para a função</SelectItem>
                                            <SelectItem value="APTO_RESTRICOES">Apto com Restrições</SelectItem>
                                            <SelectItem value="INAPTO">Inapto</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                <h4 className="font-medium text-slate-800 mb-2 text-sm">Resumo da Admissão</h4>
                                <ul className="space-y-2 text-sm text-slate-600">
                                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Documentos validados</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Extração concluída</li>
                                    <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border border-slate-300 border-dashed" /> Exame pendente</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div className="pt-4 flex justify-end">
                            <Button onClick={handleAsoValidation} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Confirmar Apto e Liberar Admissão
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="allocate" className="space-y-4 animate-in fade-in-50">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                            <h4 className="font-medium text-emerald-800 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5" />
                                Tudo certo! Candidato liberado para contratação.
                            </h4>
                            <p className="text-sm text-emerald-700 mt-1">Os documentos e exames foram validados. Prossiga com o preenchimento dos dados contratuais.</p>
                        </div>
                        
                        <div className="flex justify-center p-8 border border-slate-200 border-dashed rounded-lg bg-slate-50">
                            <Button onClick={onComplete} size="lg">
                                Ir para Formulário de Alocação Final
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
