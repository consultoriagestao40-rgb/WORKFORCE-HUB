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
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { importEmployeesBatch } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ImportEmployeesDialog() {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [file, setFile] = useState<File | null>(null);

    const handleDownloadTemplate = () => {
        const headers = [
            "Nome Completo",
            "CPF",
            "Cargo",
            "Situação",
            "Data Admissão (DD/MM/AAAA)",
            "Salário Base",
            "Carga Horária",
            "Tipo (CLT)",
            "Email",
            "Telefone"
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);

        // Add some column widths
        ws['!cols'] = [
            { wch: 30 }, // Nome
            { wch: 15 }, // CPF
            { wch: 20 }, // Cargo
            { wch: 15 }, // Situação
            { wch: 15 }, // Admissão
            { wch: 12 }, // Salário
            { wch: 10 }, // Carga
            { wch: 10 }, // Tipo
            { wch: 25 }, // Email
            { wch: 15 }  // Telefone
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Modelo");
        XLSX.writeFile(wb, "Modelo_Importacao_Colaboradores.xlsx");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setIsLoading(true);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                // Basic validation and parsing
                if (data.length < 2) {
                    toast.error("O arquivo parece estar vazio.");
                    setPreviewData([]);
                    setIsLoading(false);
                    return;
                }

                // Helper to parse currency (R$ 1.200,50 -> 1200.50)
                const parseCurrency = (val: any) => {
                    if (typeof val === 'number') return val;
                    if (!val) return 0;

                    const strStr = String(val).trim();
                    // Remove R$, spaces, and thousands separators (points) if comma exists as decimal
                    // Brazilian format: 1.200,50
                    // US format: 1,200.50

                    // Simple heuristic for BR: if contains comma, it's decimal separator
                    if (strStr.includes(',')) {
                        const normalized = strStr.replace(/[^\d,-]/g, '').replace(',', '.');
                        return parseFloat(normalized);
                    }

                    // If no comma, remove non-numeric chars except dot
                    return parseFloat(strStr.replace(/[^\d.]/g, ''));
                };

                // Skip header row
                const parsedData = data.slice(1).map((row: any) => ({
                    name: row[0],
                    cpf: row[1],
                    role: row[2],
                    situation: row[3],
                    admissionDate: row[4],
                    salary: parseCurrency(row[5]),
                    workload: row[6],
                    type: row[7],
                    email: row[8],
                    phone: row[9]
                })).filter((row: any) => row.name && row.cpf); // Filter empty rows

                setPreviewData(parsedData);
            } catch (error) {
                console.error("Error parsing Excel:", error);
                toast.error("Erro ao ler o arquivo. Verifique o formato.");
            } finally {
                setIsLoading(false);
            }
        };
        reader.readAsBinaryString(selectedFile);
    };

    const handleImport = async () => {
        if (previewData.length === 0) return;

        setIsLoading(true);
        try {
            const result = await importEmployeesBatch(previewData);

            if (result?.error) {
                toast.error(result.error);
            } else {
                // TS workaround: result can be { count, skipped } here
                const successResult = result as { count: number; skipped?: number };

                if (successResult.count > 0) {
                    toast.success(`${successResult.count} colaboradores importados com sucesso!`);
                }

                if (successResult.skipped && successResult.skipped > 0) {
                    toast.warning(`${successResult.skipped} ignorados (CPF já existente ou erro).`);
                }

                if (successResult.count === 0 && (!successResult.skipped || successResult.skipped === 0)) {
                    toast.info("Nenhuma importação realizada.");
                }

                setOpen(false);
                setPreviewData([]);
                setFile(null);
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro desconhecido ao importar.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 border-slate-200 text-slate-600 hover:text-primary hover:bg-slate-50">
                    <FileSpreadsheet className="w-4 h-4" />
                    Importar Excel
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Importação em Lote de Colaboradores</DialogTitle>
                    <DialogDescription>
                        Baixe o modelo, preencha as informações e faça o upload para cadastrar múltiplos colaboradores de uma vez.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 flex-1 overflow-hidden flex flex-col">
                    {!previewData.length ? (
                        <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center gap-4 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                                <Upload className="w-6 h-6 text-slate-400" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-semibold text-slate-900">Clique para selecionar o arquivo</h3>
                                <p className="text-sm text-slate-500">Suporta arquivos .xlsx ou .xls</p>
                            </div>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                className="hidden"
                                id="file-upload"
                                onChange={handleFileUpload}
                            />
                            <Button variant="secondary" onClick={() => document.getElementById('file-upload')?.click()}>
                                Selecionar Planilha
                            </Button>

                            <div className="pt-4 border-t border-slate-200 w-full mt-4">
                                <Button variant="ghost" size="sm" className="gap-2 text-primary" onClick={handleDownloadTemplate}>
                                    <Download className="w-4 h-4" />
                                    Baixar Modelo Padrão
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                                    <span className="font-medium text-slate-700">{previewData.length} registros encontrados</span>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => { setPreviewData([]); setFile(null); }}>
                                    Trocar Arquivo
                                </Button>
                            </div>

                            <div className="flex-1 border rounded-md overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>CPF</TableHead>
                                            <TableHead>Cargo</TableHead>
                                            <TableHead>Salário</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewData.map((row, i) => (
                                            <TableRow key={i}>
                                                <TableCell>{row.name}</TableCell>
                                                <TableCell>{row.cpf}</TableCell>
                                                <TableCell>{row.role}</TableCell>
                                                <TableCell>
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.salary)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <Alert variant="default" className="bg-amber-50 border-amber-200">
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                                <AlertTitle className="text-amber-800">Atenção</AlertTitle>
                                <AlertDescription className="text-amber-700">
                                    O sistema tentará vincular Cargos e Situações automaticamente pelo nome. Verifique se a grafia está correta.
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleImport} disabled={previewData.length === 0 || isLoading}>
                        {isLoading ? "Importando..." : "Confirmar Importação"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
