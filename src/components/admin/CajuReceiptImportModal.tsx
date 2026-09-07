"use client";

import { useState } from "react";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
    UploadCloud, 
    FileText, 
    CheckCircle2, 
    AlertCircle, 
    AlertTriangle, 
    XCircle, 
    Check, 
    CreditCard, 
    RefreshCw, 
    Search,
    Building2,
    Download
} from "lucide-react";
import { toast } from "sonner";
import { previewCajuReconciliation, executeCajuBatchPayment, CajuReconciliationPreviewItem } from "@/actions/caju-reconciliation";

interface CajuReceiptImportModalProps {
    open?: boolean;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    onClose?: () => void;
    month?: number;
    year?: number;
    selectedCompany?: string;
    companies?: string[];
    onPaymentSuccess?: () => void;
}

export function CajuReceiptImportModal({
    open,
    isOpen,
    onOpenChange,
    onClose,
    month = new Date().getMonth() + 1,
    year = new Date().getFullYear(),
    selectedCompany = "all",
    companies = [],
    onPaymentSuccess
}: CajuReceiptImportModalProps) {
    const isModalOpen = open ?? isOpen ?? false;
    const handleModalOpenChange = (newVal: boolean) => {
        if (!newVal) {
            onClose?.();
        }
        onOpenChange?.(newVal);
    };

    const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>(selectedCompany || "all");
    const [detectedCompany, setDetectedCompany] = useState<string | null>(null);
    const [detectedCnpj, setDetectedCnpj] = useState<string | null>(null);
    const [rawParsedItems, setRawParsedItems] = useState<any[]>([]);

    const [isDragging, setIsDragging] = useState(false);
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [fileName, setFileName] = useState<string>("");
    const [previewItems, setPreviewItems] = useState<CajuReconciliationPreviewItem[]>([]);
    const [summary, setSummary] = useState<{
        totalFileItems: number;
        readyToPayCount: number;
        alreadyPaidCount: number;
        mismatchCount: number;
        notFoundCount: number;
        totalCajuAmount: number;
    } | null>(null);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const [filterTab, setFilterTab] = useState<"ALL" | "READY" | "MISMATCH" | "ALREADY_PAID" | "NOT_FOUND">("ALL");
    const [isExecutingPayment, setIsExecutingPayment] = useState(false);

    const runPreview = async (items: any[], comp: string) => {
        const prevRes = await previewCajuReconciliation({
            items,
            month,
            year,
            companyName: comp
        });

        setPreviewItems(prevRes.previewItems);
        setSummary(prevRes.summary);

        // Pre-select items that are READY or VALUE_MISMATCH (valid employees)
        const preSelect = new Set<string>();
        for (const item of prevRes.previewItems) {
            if ((item.status === "READY" || item.status === "VALUE_MISMATCH") && item.employeeId) {
                preSelect.add(item.employeeId);
            }
        }
        setSelectedIds(preSelect);
    };

    const handleCompanyChange = async (newComp: string) => {
        setSelectedCompanyFilter(newComp);
        if (rawParsedItems.length > 0) {
            setIsProcessingFile(true);
            try {
                await runPreview(rawParsedItems, newComp);
            } catch (err: any) {
                toast.error("Erro ao conciliar por empresa: " + (err.message || ""));
            } finally {
                setIsProcessingFile(false);
            }
        }
    };

    const handleFile = async (file: File) => {
        const lowerName = file.name.toLowerCase();
        if (!lowerName.endsWith(".pdf") && !lowerName.endsWith(".csv") && !lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls")) {
            toast.error("Formato inválido. Envie o comprovante em PDF, CSV ou Excel (.xlsx / .xls).");
            return;
        }

        setFileName(file.name);
        setIsProcessingFile(true);
        const toastId = toast.loading("Lendo comprovante do Caju e cruzando com o WFH...");

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/admin/parse-caju", {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Falha ao processar o arquivo.");
            }

            const parsedItems = data.items || [];
            if (parsedItems.length === 0) {
                toast.error("Nenhum colaborador ou valor identificado no comprovante enviado.", { id: toastId });
                setIsProcessingFile(false);
                return;
            }

            setRawParsedItems(parsedItems);

            let activeComp = selectedCompanyFilter;
            if (data.detectedCompanyName) {
                setDetectedCompany(data.detectedCompanyName);
                if (data.detectedCnpj) setDetectedCnpj(data.detectedCnpj);

                if (companies && companies.length > 0) {
                    const normDet = data.detectedCompanyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                    const matched = companies.find(c => {
                        const normC = c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                        return normDet.includes(normC) || normC.includes(normDet);
                    });
                    if (matched) {
                        activeComp = matched;
                        setSelectedCompanyFilter(matched);
                    }
                }
            }

            await runPreview(parsedItems, activeComp);

            toast.success(`${parsedItems.length} registros identificados no comprovante!`, { id: toastId });
        } catch (err: any) {
            console.error("Error processing Caju file:", err);
            toast.error(err.message || "Ocorreu um erro ao ler o comprovante.", { id: toastId });
        } finally {
            setIsProcessingFile(false);
        }
    };

    const handleConfirmPayment = async () => {
        const itemsToPay = previewItems
            .filter(p => p.employeeId && selectedIds.has(p.employeeId))
            .map(p => ({
                employeeId: p.employeeId!,
                amount: p.cajuAmount,
                cpf: p.cpf,
                employeeName: p.wfhName || p.cajuName
            }));

        if (itemsToPay.length === 0) {
            toast.error("Nenhum colaborador selecionado para baixa.");
            return;
        }

        setIsExecutingPayment(true);
        const toastId = toast.loading(`Efetivando baixa de ${itemsToPay.length} pagamentos de VA...`);

        try {
            const res = await executeCajuBatchPayment({
                month,
                year,
                fileName,
                items: itemsToPay
            });

            if (res.success) {
                toast.success(`Baixa concluída! ${res.paidCount} colaboradores marcados como PAGOS (R$ ${res.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`, { id: toastId });
                if (onPaymentSuccess) onPaymentSuccess();
                handleModalOpenChange(false);
                // Reset state
                setPreviewItems([]);
                setSummary(null);
                setFileName("");
            } else {
                toast.error(res.error || "Erro ao efetivar baixas.", { id: toastId });
            }
        } catch (err: any) {
            toast.error(err.message || "Erro de conexão ao salvar pagamentos.", { id: toastId });
        } finally {
            setIsExecutingPayment(false);
        }
    };

    const toggleSelectAll = () => {
        const eligible = previewItems.filter(p => (p.status === "READY" || p.status === "VALUE_MISMATCH") && p.employeeId);
        if (selectedIds.size === eligible.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(eligible.map(e => e.employeeId!)));
        }
    };

    const toggleSelectItem = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const filteredItems = previewItems.filter(item => {
        const matchesSearch = 
            item.cajuName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.wfhName && item.wfhName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            item.cpf.includes(searchTerm);

        if (!matchesSearch) return false;
        if (filterTab === "READY") return item.status === "READY";
        if (filterTab === "MISMATCH") return item.status === "VALUE_MISMATCH";
        if (filterTab === "ALREADY_PAID") return item.status === "ALREADY_PAID";
        if (filterTab === "NOT_FOUND") return item.status === "NOT_FOUND";
        return true;
    });

    const totalSelectedAmount = previewItems
        .filter(p => p.employeeId && selectedIds.has(p.employeeId))
        .reduce((acc, curr) => acc + curr.cajuAmount, 0);

    return (
        <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-slate-200">
                <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-gradient-to-r from-orange-50/80 via-amber-50/50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black text-slate-900">
                                Baixa de Compra Caju via Comprovante
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">
                                Suba o comprovante oficial do pedido Caju (PDF, CSV ou Excel) para dar baixa automática nos pagamentos do mês {String(month).padStart(2, '0')}/{year}.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Dropzone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                handleFile(e.dataTransfer.files[0]);
                            }
                        }}
                        className={`relative border-2 border-dashed rounded-3xl p-6 text-center transition-all ${
                            isDragging 
                                ? "border-orange-500 bg-orange-50/60 scale-[0.99]" 
                                : fileName 
                                    ? "border-emerald-300 bg-emerald-50/30" 
                                    : "border-slate-200 hover:border-orange-400 bg-slate-50/50 hover:bg-orange-50/20"
                        }`}
                    >
                        <input
                            type="file"
                            id="caju-receipt-file-input"
                            accept=".pdf,.csv,.xlsx,.xls"
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    handleFile(e.target.files[0]);
                                }
                            }}
                        />
                        <label htmlFor="caju-receipt-file-input" className="cursor-pointer flex flex-col items-center gap-2.5">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                fileName ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-600"
                            }`}>
                                {isProcessingFile ? (
                                    <RefreshCw className="w-6 h-6 animate-spin" />
                                ) : fileName ? (
                                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                ) : (
                                    <UploadCloud className="w-6 h-6 text-orange-600" />
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">
                                    {fileName ? fileName : "Clique para selecionar ou arraste o comprovante Caju"}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    Formatos aceitos: <strong>PDF (Comprovante / Extrato)</strong>, <strong>CSV</strong> ou <strong>Excel (.xlsx / .xls)</strong>
                                </p>
                            </div>
                            {fileName && (
                                <span className="text-[11px] text-orange-600 font-bold hover:underline">
                                    Trocar de arquivo
                                </span>
                            )}
                        </label>
                    </div>

                    {/* Empresa Selector & Detected Banner */}
                    <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                                <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    Empresa da Baixa:
                                    {selectedCompanyFilter !== "all" ? (
                                        <span className="text-orange-600 font-extrabold">{selectedCompanyFilter}</span>
                                    ) : (
                                        <span className="text-slate-500 font-medium">Todas as Empresas</span>
                                    )}
                                </div>
                                {detectedCompany && (
                                    <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                        <span>Identificada no comprovante: <strong>{detectedCompany}</strong>{detectedCnpj ? ` (${detectedCnpj})` : ""}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {companies.length > 0 && (
                            <div className="w-full sm:w-64">
                                <select
                                    value={selectedCompanyFilter}
                                    onChange={(e) => handleCompanyChange(e.target.value)}
                                    className="w-full text-xs font-bold py-1.5 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 shadow-xs cursor-pointer"
                                >
                                    <option value="all">🏢 Todas as Empresas (Geral)</option>
                                    {companies.map((c) => (
                                        <option key={c} value={c}>🏢 {c}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Summary Cards */}
                    {summary && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            <div 
                                onClick={() => setFilterTab("ALL")} 
                                className={`p-3 rounded-2xl border cursor-pointer transition-all ${filterTab === "ALL" ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}
                            >
                                <span className={`text-[10px] font-black uppercase tracking-wider block ${filterTab === "ALL" ? "text-slate-300" : "text-slate-400"}`}>Total Lido</span>
                                <span className="text-xl font-black mt-0.5 block">{summary.totalFileItems}</span>
                            </div>

                            <div 
                                onClick={() => setFilterTab("READY")} 
                                className={`p-3 rounded-2xl border cursor-pointer transition-all ${filterTab === "READY" ? "border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20" : "border-emerald-200 bg-emerald-50/50 hover:border-emerald-400"}`}
                            >
                                <span className={`text-[10px] font-black uppercase tracking-wider block ${filterTab === "READY" ? "text-emerald-100" : "text-emerald-700"}`}>Prontos p/ Baixa</span>
                                <span className={`text-xl font-black mt-0.5 block ${filterTab === "READY" ? "text-white" : "text-emerald-700"}`}>{summary.readyToPayCount}</span>
                            </div>

                            <div 
                                onClick={() => setFilterTab("MISMATCH")} 
                                className={`p-3 rounded-2xl border cursor-pointer transition-all ${filterTab === "MISMATCH" ? "border-amber-600 bg-amber-600 text-white shadow-sm shadow-amber-600/20" : "border-amber-200 bg-amber-50/50 hover:border-amber-400"}`}
                            >
                                <span className={`text-[10px] font-black uppercase tracking-wider block ${filterTab === "MISMATCH" ? "text-amber-100" : "text-amber-700"}`}>Divergência</span>
                                <span className={`text-xl font-black mt-0.5 block ${filterTab === "MISMATCH" ? "text-white" : "text-amber-700"}`}>{summary.mismatchCount}</span>
                            </div>

                            <div 
                                onClick={() => setFilterTab("ALREADY_PAID")} 
                                className={`p-3 rounded-2xl border cursor-pointer transition-all ${filterTab === "ALREADY_PAID" ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20" : "border-blue-200 bg-blue-50/50 hover:border-blue-400"}`}
                            >
                                <span className={`text-[10px] font-black uppercase tracking-wider block ${filterTab === "ALREADY_PAID" ? "text-blue-100" : "text-blue-700"}`}>Já Pagos</span>
                                <span className={`text-xl font-black mt-0.5 block ${filterTab === "ALREADY_PAID" ? "text-white" : "text-blue-700"}`}>{summary.alreadyPaidCount}</span>
                            </div>

                            <div 
                                onClick={() => setFilterTab("NOT_FOUND")} 
                                className={`p-3 rounded-2xl border cursor-pointer transition-all ${filterTab === "NOT_FOUND" ? "border-red-600 bg-red-600 text-white shadow-sm shadow-red-600/20" : "border-red-200 bg-red-50/50 hover:border-red-400"}`}
                            >
                                <span className={`text-[10px] font-black uppercase tracking-wider block ${filterTab === "NOT_FOUND" ? "text-red-100" : "text-red-700"}`}>Não no WFH</span>
                                <span className={`text-xl font-black mt-0.5 block ${filterTab === "NOT_FOUND" ? "text-white" : "text-red-700"}`}>{summary.notFoundCount}</span>
                            </div>
                        </div>
                    )}

                    {/* Table of items */}
                    {previewItems.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="relative flex-1 max-w-xs">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por colaborador ou CPF..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={toggleSelectAll}
                                        className="h-8 text-[11px] rounded-xl font-bold"
                                    >
                                        {selectedIds.size === previewItems.filter(p => (p.status === "READY" || p.status === "VALUE_MISMATCH") && p.employeeId).length
                                            ? "Desmarcar Todos"
                                            : "Selecionar Aptos"}
                                    </Button>
                                    <span className="text-xs font-bold text-slate-500">
                                        {selectedIds.size} selecionado(s)
                                    </span>
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs max-h-[340px] overflow-y-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-500 sticky top-0 z-10">
                                        <tr>
                                            <th className="py-3 px-3 w-10 text-center">Sel.</th>
                                            <th className="py-3 px-3">Colaborador / CPF</th>
                                            <th className="py-3 px-3">Cliente / Posto</th>
                                            <th className="py-3 px-3 text-right">Comprovante Caju</th>
                                            <th className="py-3 px-3 text-right">Previsto WFH</th>
                                            <th className="py-3 px-3 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredItems.map((item) => {
                                            const isSelectable = (item.status === "READY" || item.status === "VALUE_MISMATCH") && !!item.employeeId;
                                            const isSelected = item.employeeId ? selectedIds.has(item.employeeId) : false;

                                            return (
                                                <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? "bg-orange-50/20" : ""}`}>
                                                    <td className="py-2.5 px-3 text-center">
                                                        {isSelectable && (
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleSelectItem(item.employeeId!)}
                                                                className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <div className="font-bold text-slate-800">{item.wfhName || item.cajuName}</div>
                                                        <div className="text-[10px] font-mono text-slate-400">{item.cpf}</div>
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <div className="text-slate-600 truncate max-w-[160px]">{item.clientName || "-"}</div>
                                                        <div className="text-[10px] text-slate-400 truncate max-w-[160px]">{item.postoName || ""}</div>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                                        R$ {item.cajuAmount.toFixed(2)}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-semibold text-slate-600">
                                                        R$ {item.wfhExpectedAmount.toFixed(2)}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        {item.status === "READY" && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                <CheckCircle2 className="w-3 h-3" /> Apto p/ Baixa
                                                            </span>
                                                        )}
                                                        {item.status === "ALREADY_PAID" && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                                <Check className="w-3 h-3" /> Já Pago
                                                            </span>
                                                        )}
                                                        {item.status === "VALUE_MISMATCH" && (
                                                            <span 
                                                                title={item.statusMessage}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 cursor-help"
                                                            >
                                                                <AlertTriangle className="w-3 h-3" /> Dif. R$ {item.difference.toFixed(2)}
                                                            </span>
                                                        )}
                                                        {item.status === "NOT_FOUND" && (
                                                            <span 
                                                                title={item.statusMessage}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 cursor-help"
                                                            >
                                                                <XCircle className="w-3 h-3" /> Não Cadastrado
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 pt-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                        {selectedIds.size > 0 && (
                            <span>
                                Total Selecionado: <strong className="text-slate-900 text-sm">R$ {totalSelectedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> ({selectedIds.size} colaboradores)
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleModalOpenChange(false)}
                            className="rounded-xl font-bold text-xs"
                        >
                            Cancelar
                        </Button>
                        <Button
                            size="sm"
                            disabled={selectedIds.size === 0 || isExecutingPayment}
                            onClick={handleConfirmPayment}
                            className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-md shadow-orange-600/20 gap-2 h-9 px-4"
                        >
                            {isExecutingPayment ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" /> Efetivando Baixa...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" /> Baixar {selectedIds.size} Pagamento(s) {selectedCompanyFilter !== "all" ? `(${selectedCompanyFilter})` : ""}
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
