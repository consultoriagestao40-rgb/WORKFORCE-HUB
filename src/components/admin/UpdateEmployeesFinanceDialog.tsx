"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, HelpCircle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { updateEmployeesFinanceBatch } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function UpdateEmployeesFinanceDialog() {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [simulationResults, setSimulationResults] = useState<any[] | null>(null);
    const [summary, setSummary] = useState<any | null>(null);
    const [fileName, setFileName] = useState<string>("");

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFileName(selectedFile.name);
        setIsLoading(true);
        setSimulationResults(null);
        setSummary(null);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                
                // Read sheet as array of arrays (AOA) to process headers cleanly
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                if (data.length < 2) {
                    toast.error("O arquivo parece estar vazio.");
                    setIsLoading(false);
                    return;
                }

                // Helper to normalize strings for header matching
                const normalize = (str: any) => 
                    String(str || "")
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .trim();

                const headers = data[0].map(h => normalize(h));

                // Find column indexes
                const idx = {
                    name: headers.indexOf("nome"),
                    cpf: headers.indexOf("cpf"),
                    salary: headers.findIndex(h => h.includes("salario") || h === "salario base"),
                    insalubridade: headers.indexOf("insalubridade"),
                    periculosidade: headers.indexOf("periculosidade"),
                    gratificacao: headers.findIndex(h => h.includes("gratificacao")),
                    outrosAdicionais: headers.findIndex(h => h.includes("outros adicionais")),
                    valeAlimentacao: headers.findIndex(h => h.includes("vale alimentacao") || h.includes("va")),
                    valeTransporte: headers.findIndex(h => h.includes("vale trans") || h.includes("vt"))
                };

                if (idx.cpf === -1) {
                    toast.error("Coluna 'CPF' não foi encontrada na planilha.");
                    setIsLoading(false);
                    return;
                }

                // Helper to parse numbers safely (handles R$ values and formatting)
                const parseVal = (val: any) => {
                    if (typeof val === 'number') return val;
                    if (!val) return 0;
                    const str = String(val).trim();
                    if (str.includes(',')) {
                        return parseFloat(str.replace(/[^\d,-]/g, '').replace(',', '.'));
                    }
                    return parseFloat(str.replace(/[^\d.]/g, '')) || 0;
                };

                // Map data rows
                const rows = data.slice(1).map((row: any) => {
                    return {
                        name: idx.name !== -1 ? String(row[idx.name] || "").trim() : "",
                        cpf: String(row[idx.cpf] || "").trim(),
                        salary: idx.salary !== -1 ? parseVal(row[idx.salary]) : 0,
                        insalubridade: idx.insalubridade !== -1 ? parseVal(row[idx.insalubridade]) : 0,
                        periculosidade: idx.periculosidade !== -1 ? parseVal(row[idx.periculosidade]) : 0,
                        gratificacao: idx.gratificacao !== -1 ? parseVal(row[idx.gratificacao]) : 0,
                        outrosAdicionais: idx.outrosAdicionais !== -1 ? parseVal(row[idx.outrosAdicionais]) : 0,
                        valeAlimentacao: idx.valeAlimentacao !== -1 ? parseVal(row[idx.valeAlimentacao]) : 0,
                        valeTransporte: idx.valeTransporte !== -1 ? parseVal(row[idx.valeTransporte]) : 0
                    };
                }).filter(r => r.cpf);

                setPreviewData(rows);

                // Run simulation (Dry Run) automatically
                const response = await updateEmployeesFinanceBatch(rows, false);
                if (response.error) {
                    toast.error(response.error);
                } else {
                    setSimulationResults(response.results || []);
                    setSummary(response.summary || null);
                    toast.success("Simulação concluída! Veja o relatório de alterações abaixo.");
                }
            } catch (error) {
                console.error("Error reading spreadsheet:", error);
                toast.error("Erro ao ler o arquivo. Verifique o formato.");
            } finally {
                setIsLoading(false);
            }
        };

        reader.readAsBinaryString(selectedFile);
    };

    const handleConfirmUpdate = async () => {
        if (previewData.length === 0) return;

        setIsLoading(true);
        try {
            const response = await updateEmployeesFinanceBatch(previewData, true);
            if (response.error) {
                toast.error(response.error);
            } else {
                const updated = response.summary?.updated || 0;
                toast.success(`${updated} colaboradores atualizados no banco de dados com sucesso!`);
                setOpen(false);
                setPreviewData([]);
                setSimulationResults(null);
                setSummary(null);
                setFileName("");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar atualizações.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 border-slate-200 text-slate-600 hover:text-primary hover:bg-slate-50">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Atualizar Salários/Benefícios
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl font-black text-slate-800 tracking-tight">
                        <FileSpreadsheet className="w-6 h-6 text-emerald-600 animate-pulse" />
                        Atualizar Salários e Benefícios (Somente Zerados)
                    </DialogTitle>
                    <DialogDescription className="text-slate-500">
                        Selecione a sua planilha de colaboradores ativos. O sistema irá preencher **apenas** as informações financeiras que estiverem zeradas ou em branco no banco de dados, garantindo a integridade total do histórico de férias, admissão e afastamentos.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 flex-1 overflow-hidden flex flex-col py-4">
                    {!simulationResults ? (
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-16 flex flex-col items-center justify-center gap-4 text-center bg-slate-50/50 hover:bg-slate-50 transition-all">
                            {isLoading ? (
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                    <p className="font-semibold text-slate-700">Analisando planilha e simulando atualizações...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center shadow-inner">
                                        <Upload className="w-7 h-7 text-emerald-600" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-lg text-slate-900">Importe sua planilha de Colaboradores</h3>
                                        <p className="text-sm text-slate-400 max-w-sm">Suporta arquivos Excel (.xlsx, .xls) ou formato CSV.</p>
                                    </div>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls, .csv"
                                        className="hidden"
                                        id="finance-upload"
                                        onChange={handleFileUpload}
                                    />
                                    <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 rounded-xl shadow-md" onClick={() => document.getElementById('finance-upload')?.click()}>
                                        Selecionar Planilha
                                    </Button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col justify-center">
                                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-600 mb-1">Elegíveis para Atualização</span>
                                    <span className="text-3xl font-black text-emerald-700">{summary?.updated || 0}</span>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col justify-center">
                                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 mb-1">Ignorados (Já Preenchidos)</span>
                                    <span className="text-3xl font-black text-slate-600">{summary?.skipped || 0}</span>
                                </div>
                                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col justify-center">
                                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-red-600 mb-1">Não Encontrados no Banco (Avisos)</span>
                                    <span className="text-3xl font-black text-red-700">{summary?.notFound || 0}</span>
                                </div>
                            </div>

                            {/* Details Table */}
                            <div className="flex-1 border border-slate-150 rounded-xl overflow-auto bg-white shadow-inner">
                                <Table>
                                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                        <TableRow>
                                            <TableHead className="font-extrabold text-slate-700">Colaborador</TableHead>
                                            <TableHead className="font-extrabold text-slate-700">CPF</TableHead>
                                            <TableHead className="font-extrabold text-slate-700">Status da Simulação</TableHead>
                                            <TableHead className="font-extrabold text-slate-700">Alterações Propostas</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {simulationResults.map((row, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50/50">
                                                <TableCell className="font-semibold text-slate-800">{row.name}</TableCell>
                                                <TableCell className="text-slate-500 font-mono">{row.cpf}</TableCell>
                                                <TableCell>
                                                    {row.status === "UPDATED" && (
                                                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-bold border border-emerald-200">
                                                            Elegível
                                                        </Badge>
                                                    )}
                                                    {row.status === "SKIPPED" && (
                                                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 hover:bg-slate-100 font-medium">
                                                            Ignorado
                                                        </Badge>
                                                    )}
                                                    {row.status === "NOT_FOUND" && (
                                                        <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 font-bold border border-red-200">
                                                            Não Localizado
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-600">
                                                    {row.status === "UPDATED" && row.changes && (
                                                        <div className="space-y-1">
                                                            {row.changes.map((c: string, idx: number) => (
                                                                <div key={idx} className="flex items-center gap-1.5 font-medium text-emerald-600">
                                                                    <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                                                                    {c}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {row.status === "SKIPPED" && (
                                                        <span className="text-slate-400 italic font-medium">{row.reason}</span>
                                                    )}
                                                    {row.status === "NOT_FOUND" && (
                                                        <span className="text-red-500 font-medium">{row.reason}</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
                                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-amber-800 font-bold text-sm">Importante: Validação de Dados</h4>
                                    <p className="text-amber-700 text-xs mt-1">
                                        Os colaboradores sinalizados como <strong className="text-emerald-700">Elegível</strong> terão apenas os valores mostrados atualizados. A data de admissão, férias, e demais dados não listados acima serão **permanentemente preservados**.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-4 border-t pt-4 border-slate-100">
                    <Button variant="outline" className="rounded-xl font-medium" onClick={() => {
                        setOpen(false);
                        setPreviewData([]);
                        setSimulationResults(null);
                        setSummary(null);
                        setFileName("");
                    }}>
                        Cancelar
                    </Button>
                    {simulationResults && (
                        <Button 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 rounded-xl shadow-md gap-2" 
                            onClick={handleConfirmUpdate} 
                            disabled={summary?.updated === 0 || isLoading}
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isLoading ? "Salvando..." : `Confirmar Atualização de ${summary?.updated || 0} Colaboradores`}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
