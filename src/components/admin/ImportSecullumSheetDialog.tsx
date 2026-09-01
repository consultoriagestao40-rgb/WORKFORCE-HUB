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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Upload, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { importPayrollSecullumCalculations, SecullumImportRow } from "@/actions/payroll";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ImportSecullumSheetDialogProps {
    year: number;
    month: number;
    companies?: string[];
    defaultCompany?: string;
    onSuccess: () => void;
}

export function ImportSecullumSheetDialog({ 
    year, 
    month, 
    companies = [], 
    defaultCompany = "all", 
    onSuccess 
}: ImportSecullumSheetDialogProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Selectors state
    const [targetCompany, setTargetCompany] = useState<string>(defaultCompany || "all");
    const [targetMonth, setTargetMonth] = useState<number>(month);
    const [targetYear, setTargetYear] = useState<number>(year);

    const [parsedRows, setParsedRows] = useState<SecullumImportRow[]>([]);
    const [rawRowsPreview, setRawRowsPreview] = useState<any[]>([]);
    const [fileName, setFileName] = useState<string>("");

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const parseTimeToHours = (val: any): number => {
        if (typeof val === "number") return val;
        if (!val) return 0;
        const str = String(val).trim();
        if (str === "0" || str === "00:00" || str === "0:00") return 0;

        if (str.includes(":")) {
            const isNeg = str.startsWith("-");
            const clean = isNeg ? str.substring(1) : str;
            const parts = clean.split(":");
            if (parts.length >= 2) {
                const h = parseInt(parts[0], 10) || 0;
                const m = parseInt(parts[1], 10) || 0;
                const dec = h + (m / 60);
                return isNeg ? -dec : dec;
            }
        }

        const num = parseFloat(str.replace(",", "."));
        return isNaN(num) ? 0 : num;
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setIsLoading(true);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

                if (!data || data.length < 2) {
                    toast.error("O arquivo selecionado parece estar vazio.");
                    setIsLoading(false);
                    return;
                }

                // 1. Find Header Row index
                let headerIdx = -1;
                for (let i = 0; i < Math.min(data.length, 15); i++) {
                    const row = data[i];
                    if (Array.isArray(row)) {
                        const rowStr = row.map(c => String(c || "").toLowerCase()).join(" ");
                        if (rowStr.includes("nome") || rowStr.includes("folha") || rowStr.includes("colaborador") || rowStr.includes("cpf") || rowStr.includes("not")) {
                            headerIdx = i;
                            break;
                        }
                    }
                }

                if (headerIdx === -1) {
                    headerIdx = 0;
                }

                const headers: string[] = (data[headerIdx] || []).map(h => String(h || "").trim());

                // Find column indices
                const nameIdx = headers.findIndex(h => /nome/i.test(h) || /colaborador/i.test(h) || /funcionario/i.test(h));
                const cpfIdx = headers.findIndex(h => /cpf/i.test(h) || /documento/i.test(h));
                const folhaIdx = headers.findIndex(h => /n[oº]?\s*folha/i.test(h) || /c[oó]digo/i.test(h) || /^folha$/i.test(h) || /^re\b/i.test(h));
                
                // Night hours: Not., Not.Tot., Noturnas, Adicional Noturno
                let notIdx = headers.findIndex(h => /not\.tot/i.test(h));
                if (notIdx === -1) notIdx = headers.findIndex(h => /^not\./i.test(h) || /noturn/i.test(h) || /adic.*not/i.test(h));

                // Extras: Extras, H. Extras, Extras 50%
                const extrasIdx = headers.findIndex(h => /extra.*50/i.test(h) || /^extras?$/i.test(h) || /h\.?\s*extra/i.test(h));
                const extras100Idx = headers.findIndex(h => /extra.*100/i.test(h) || /extra.*dom/i.test(h));

                // Atrasos / Faltas
                const atrasIdx = headers.findIndex(h => /atras/i.test(h) || /falta/i.test(h));

                const rowsToImport: SecullumImportRow[] = [];
                const previewRows: any[] = [];

                for (let r = headerIdx + 1; r < data.length; r++) {
                    const row = data[r];
                    if (!row || !Array.isArray(row) || row.length === 0) continue;

                    const nameVal = nameIdx !== -1 ? String(row[nameIdx] || "").trim() : "";
                    const cpfVal = cpfIdx !== -1 ? String(row[cpfIdx] || "").trim() : "";
                    const folhaVal = folhaIdx !== -1 ? String(row[folhaIdx] || "").trim() : "";

                    const identifier = cpfVal || nameVal || folhaVal;
                    if (!identifier || identifier.toLowerCase().includes("total") || identifier.toLowerCase().includes("empresa")) continue;

                    const notHours = notIdx !== -1 ? parseTimeToHours(row[notIdx]) : 0;
                    const extrasHours = extrasIdx !== -1 ? parseTimeToHours(row[extrasIdx]) : 0;
                    const extras100Hours = extras100Idx !== -1 ? parseTimeToHours(row[extras100Idx]) : 0;
                    const atrasosHours = atrasIdx !== -1 ? parseTimeToHours(row[atrasIdx]) : 0;

                    rowsToImport.push({
                        employeeIdentifier: identifier,
                        adicionalNoturnoHours: Math.round(notHours * 100) / 100,
                        extras50Hours: Math.round(extrasHours * 100) / 100,
                        extras100Hours: Math.round(extras100Hours * 100) / 100,
                        atrasosHours: Math.round(atrasosHours * 100) / 100
                    });

                    previewRows.push({
                        name: nameVal || identifier,
                        cpf: cpfVal || "-",
                        folha: folhaVal || "-",
                        notHours,
                        extrasHours,
                        atrasosHours
                    });
                }

                if (rowsToImport.length === 0) {
                    toast.error("Nenhuma linha de colaborador válida foi identificada na planilha.");
                } else {
                    setParsedRows(rowsToImport);
                    setRawRowsPreview(previewRows);
                    toast.success(`${rowsToImport.length} colaboradores detectados na planilha!`);
                }
            } catch (err: any) {
                toast.error("Erro ao processar o arquivo Excel: " + (err.message || "Formato inválido"));
            } finally {
                setIsLoading(false);
            }
        };

        reader.readAsBinaryString(file);
    };

    const handleConfirmImport = async () => {
        if (parsedRows.length === 0) {
            toast.error("Nenhum dado para importar.");
            return;
        }

        setIsSaving(true);
        try {
            const comp = targetCompany !== "all" ? targetCompany : undefined;
            const res = await importPayrollSecullumCalculations(targetYear, targetMonth, parsedRows, comp);
            if (res.success) {
                toast.success(`${res.updatedCount} de ${res.totalProcessed} colaboradores foram atualizados com sucesso na folha!`);
                setOpen(false);
                setParsedRows([]);
                setRawRowsPreview([]);
                setFileName("");
                onSuccess();
            } else {
                toast.error("Erro ao salvar os cálculos no sistema.");
            }
        } catch (err: any) {
            toast.error(err.message || "Erro ao importar dados.");
        } finally {
            setIsSaving(false);
        }
    };

    const totalNoturnoPreview = rawRowsPreview.reduce((acc, r) => acc + r.notHours, 0);
    const totalExtrasPreview = rawRowsPreview.reduce((acc, r) => acc + r.extrasHours, 0);

    return (
        <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (o) {
                setTargetCompany(defaultCompany || "all");
                setTargetMonth(month);
                setTargetYear(year);
            }
        }}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline" 
                    className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm font-medium gap-2 h-11 px-4 rounded-2xl"
                >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Importar Planilha Secullum</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6 rounded-2xl bg-white">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                            <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-slate-900">
                                Importar Planilha de Ponto (Secullum)
                            </DialogTitle>
                            <DialogDescription className="text-sm text-slate-500">
                                Selecione a empresa e competência de destino para os cálculos importados
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-2">
                    {/* Selectors: Empresa, Mês, Ano */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
                        {/* Empresa */}
                        <div className="space-y-1 sm:col-span-1">
                            <Label className="text-xs font-bold text-slate-700">Empresa de Destino</Label>
                            <Combobox
                                options={[
                                    { value: "all", label: "Todas as Empresas" },
                                    ...companies.map(c => ({ value: c, label: c }))
                                ]}
                                value={targetCompany}
                                onChange={setTargetCompany}
                                placeholder="Todas as Empresas"
                                searchPlaceholder="Buscar empresa..."
                                className="h-9 text-xs"
                            />
                        </div>

                        {/* Mês */}
                        <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-700">Mês de Competência</Label>
                            <Select value={String(targetMonth)} onValueChange={v => setTargetMonth(Number(v))}>
                                <SelectTrigger className="h-9 text-xs rounded-xl bg-white border-slate-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200 text-xs">
                                    {monthNames.map((name, idx) => (
                                        <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Ano */}
                        <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-700">Ano</Label>
                            <Select value={String(targetYear)} onValueChange={v => setTargetYear(Number(v))}>
                                <SelectTrigger className="h-9 text-xs rounded-xl bg-white border-slate-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200 text-xs">
                                    <SelectItem value="2025">2025</SelectItem>
                                    <SelectItem value="2026">2026</SelectItem>
                                    <SelectItem value="2027">2027</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Upload Box */}
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-emerald-500 transition-colors bg-slate-50/50">
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="secullum-sheet-upload"
                            disabled={isLoading || isSaving}
                        />
                        <label
                            htmlFor="secullum-sheet-upload"
                            className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                        >
                            <div className="p-3 bg-white shadow-sm border border-slate-200 rounded-full text-emerald-600">
                                <Upload className="w-6 h-6" />
                            </div>
                            <span className="font-semibold text-slate-700 text-base">
                                {fileName || "Clique para selecionar a Planilha de Cálculos do Secullum"}
                            </span>
                            <span className="text-xs text-slate-400">
                                Formatos aceitos: .XLSX, .XLS ou .CSV (Exportado direto da tela de Cálculos do Secullum)
                            </span>
                        </label>
                    </div>

                    {/* Summary Cards */}
                    {rawRowsPreview.length > 0 && (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                                <div className="text-xs text-slate-500 font-medium">Colaboradores Detectados</div>
                                <div className="text-lg font-bold text-slate-800">{rawRowsPreview.length}</div>
                            </div>
                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
                                <div className="text-xs text-indigo-600 font-medium">Total Horas Noturnas</div>
                                <div className="text-lg font-bold text-indigo-700">{totalNoturnoPreview.toFixed(2)}h</div>
                            </div>
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                                <div className="text-xs text-amber-600 font-medium">Total Horas Extras</div>
                                <div className="text-lg font-bold text-amber-700">{totalExtrasPreview.toFixed(2)}h</div>
                            </div>
                        </div>
                    )}

                    {/* Preview Table */}
                    {rawRowsPreview.length > 0 && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 sticky top-0">
                                    <TableRow>
                                        <TableHead className="font-semibold text-xs">Colaborador / CPF</TableHead>
                                        <TableHead className="font-semibold text-xs text-center">Adic. Noturno</TableHead>
                                        <TableHead className="font-semibold text-xs text-center">H. Extras</TableHead>
                                        <TableHead className="font-semibold text-xs text-center">Faltas/Atrasos</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rawRowsPreview.slice(0, 50).map((r, idx) => (
                                        <TableRow key={idx} className="hover:bg-slate-50/80 text-xs">
                                            <TableCell className="font-medium text-slate-800">
                                                <div>{r.name}</div>
                                                <div className="text-[10px] text-slate-400">CPF: {r.cpf} | Folha: {r.folha}</div>
                                            </TableCell>
                                            <TableCell className="text-center font-semibold text-indigo-600">
                                                {r.notHours > 0 ? `${r.notHours.toFixed(2)}h` : "-"}
                                            </TableCell>
                                            <TableCell className="text-center font-semibold text-amber-600">
                                                {r.extrasHours > 0 ? `${r.extrasHours.toFixed(2)}h` : "-"}
                                            </TableCell>
                                            <TableCell className="text-center font-medium text-rose-600">
                                                {r.atrasosHours > 0 ? `${r.atrasosHours.toFixed(2)}h` : "-"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t border-slate-100 pt-4 flex justify-between items-center">
                    <Button 
                        variant="ghost" 
                        onClick={() => setOpen(false)}
                        disabled={isSaving}
                        className="text-slate-500"
                    >
                        Cancelar
                    </Button>
                    <Button 
                        onClick={handleConfirmImport} 
                        disabled={parsedRows.length === 0 || isSaving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 rounded-xl shadow-sm gap-2"
                    >
                        {isSaving ? "Aplicando na Folha..." : `Confirmar Importação (${parsedRows.length} colaboradores)`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
