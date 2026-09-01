"use client";

import { useState, useRef, useEffect } from "react";
import Script from "next/script";
import { 
    FileText, 
    Upload, 
    Download, 
    Sparkles, 
    CheckCircle2, 
    Search, 
    RefreshCw, 
    Eye, 
    Scissors, 
    FolderTree, 
    Settings2, 
    Edit3, 
    Check, 
    X,
    Users,
    Calendar,
    Building2,
    Layers,
    FileCheck,
    HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
    ExtractedHoleriteItem, 
    NamingPattern, 
    extractDataFromPageText, 
    generateFileName, 
    createSingleEmployeePdf, 
    createHoleritesZip, 
    sanitizeFileName, 
    formatCPF 
} from "@/lib/holerite-processor";
import { PDFDocument } from "pdf-lib";

export default function HoleritesPage() {
    const [pdfJsLoaded, setPdfJsLoaded] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressPercent, setProgressPercent] = useState(0);
    const [progressText, setProgressText] = useState("");
    
    // File state
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [items, setItems] = useState<ExtractedHoleriteItem[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [namingPattern, setNamingPattern] = useState<NamingPattern>("nome-re");
    const [customTemplate, setCustomTemplate] = useState("{nome} - RE {re}");
    const [folderStructure, setFolderStructure] = useState<'flat' | 'by-company' | 'by-competence'>('flat');
    
    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Inline edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editNameValue, setEditNameValue] = useState("");

    // Preview modal
    const [previewItem, setPreviewItem] = useState<ExtractedHoleriteItem | null>(null);
    const [previewModalOpen, setPreviewModalOpen] = useState(false);

    // ZIP downloading state
    const [isGeneratingZip, setIsGeneratingZip] = useState(false);
    const [zipProgress, setZipProgress] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize PDF.js worker if script is loaded
    useEffect(() => {
        if (typeof window !== "undefined" && (window as any).pdfjsLib) {
            (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            setPdfJsLoaded(true);
        }
    }, []);

    // Recalculate file names whenever naming pattern or template changes
    useEffect(() => {
        if (items.length === 0) return;
        setItems(prev => prev.map(item => ({
            ...item,
            customFileName: generateFileName(item, namingPattern, customTemplate)
        })));
    }, [namingPattern, customTemplate]);

    // Handle File Drop or Upload
    const handleFileUpload = async (file: File) => {
        if (!file.name.toLowerCase().endsWith(".pdf")) {
            toast.error("Por favor, selecione um arquivo PDF válido.");
            return;
        }

        if (!(window as any).pdfjsLib) {
            toast.error("O motor de leitura de PDF ainda está inicializando. Aguarde 3 segundos e tente novamente.");
            return;
        }

        try {
            setIsProcessing(true);
            setProgressPercent(5);
            setProgressText("Carregando arquivo PDF...");
            setSourceFile(file);
            setItems([]);
            setSelectedIds(new Set());

            const arrayBuffer = await file.arrayBuffer();

            // Load via PDF.js for text extraction
            setProgressText("Lendo estrutura de páginas...");
            const pdfjsDoc = await (window as any).pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
            const numPages = pdfjsDoc.numPages;

            if (numPages === 0) {
                toast.error("O PDF está vazio ou não possui páginas legíveis.");
                setIsProcessing(false);
                return;
            }

            // Load via pdf-lib for fast splitting
            setProgressText("Preparando motor de recorte...");
            const pdfLibDoc = await PDFDocument.load(arrayBuffer);

            const extractedList: ExtractedHoleriteItem[] = [];

            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                const currentPercent = Math.round(10 + (pageNum / numPages) * 75);
                setProgressPercent(currentPercent);
                setProgressText(`Processando página ${pageNum} de ${numPages}...`);

                // 1. Extract text from page
                const page = await pdfjsDoc.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(" ");

                const parsed = extractDataFromPageText(pageText, pageNum);

                // 2. Generate isolated single-page PDF
                const pageIndex = pageNum - 1;
                const pdfBytes = await createSingleEmployeePdf(pdfLibDoc, [pageIndex]);
                
                // Create a blob URL for quick client-side preview
                const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
                const pdfBlobUrl = URL.createObjectURL(blob);

                const itemData: ExtractedHoleriteItem = {
                    id: `page-${pageNum}-${Date.now()}`,
                    pageIndices: [pageIndex],
                    pageNumbersDisplay: `${pageNum}`,
                    employeeName: parsed.employeeName,
                    cpf: parsed.cpf,
                    registrationCode: parsed.registrationCode,
                    companyName: parsed.companyName,
                    cnpj: parsed.cnpj,
                    competence: parsed.competence,
                    payrollType: parsed.payrollType,
                    pdfBytes: pdfBytes,
                    pdfBlobUrl: pdfBlobUrl
                };

                itemData.customFileName = generateFileName(itemData, namingPattern, customTemplate);
                extractedList.push(itemData);
            }

            setProgressPercent(100);
            setProgressText("Concluído com sucesso!");
            setItems(extractedList);
            setSelectedIds(new Set(extractedList.map(i => i.id)));
            toast.success(`${extractedList.length} holerites identificados e preparados com sucesso!`);
        } catch (error: any) {
            console.error("Erro ao processar PDF:", error);
            toast.error(`Falha ao ler o PDF: ${error.message || "Formato incompatível"}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Download Single PDF
    const handleDownloadSingle = (item: ExtractedHoleriteItem) => {
        if (!item.pdfBytes) return;
        const blob = new Blob([item.pdfBytes as any], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = item.customFileName || `Holerite_${item.employeeName}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Download de ${item.employeeName} iniciado!`);
    };

    // Download All as ZIP
    const handleDownloadZip = async () => {
        const targetItems = items.filter(i => selectedIds.has(i.id));
        if (targetItems.length === 0) {
            toast.error("Nenhum holerite selecionado para download.");
            return;
        }

        try {
            setIsGeneratingZip(true);
            setZipProgress(0);

            const zipBlob = await createHoleritesZip(targetItems, {
                folderStructure,
                onProgress: (current, total) => {
                    setZipProgress(Math.round((current / total) * 100));
                }
            });

            // Trigger ZIP download
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement("a");
            a.href = url;
            const competenceLabel = items[0]?.competence ? items[0].competence.replace("/", "-") : "Folha";
            const companyLabel = items[0]?.companyName ? `_${sanitizeFileName(items[0].companyName)}` : "";
            a.download = `Holerites_${competenceLabel}${companyLabel}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`Arquivo .ZIP gerado com ${targetItems.length} holerites!`);
        } catch (error: any) {
            console.error("Erro ao gerar ZIP:", error);
            toast.error("Falha ao gerar o arquivo ZIP.");
        } finally {
            setIsGeneratingZip(false);
        }
    };

    // Toggle selection
    const toggleSelectAll = () => {
        if (selectedIds.size === filteredItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredItems.map(i => i.id)));
        }
    };

    const toggleSelectItem = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    // Inline Edit Name
    const handleSaveNameEdit = (id: string) => {
        if (!editNameValue.trim()) return;
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const updated = { ...item, employeeName: editNameValue.trim().toUpperCase() };
                updated.customFileName = generateFileName(updated, namingPattern, customTemplate);
                return updated;
            }
            return item;
        }));
        setEditingId(null);
        toast.success("Nome atualizado com sucesso!");
    };

    // Filter items
    const filteredItems = items.filter(item => {
        const matchSearch = searchTerm.toLowerCase();
        return (
            item.employeeName.toLowerCase().includes(matchSearch) ||
            item.cpf.includes(matchSearch) ||
            (item.companyName && item.companyName.toLowerCase().includes(matchSearch)) ||
            (item.registrationCode && item.registrationCode.includes(matchSearch))
        );
    });

    // Statistics
    const detectedCompanies = Array.from(new Set(items.map(i => i.companyName).filter(Boolean)));
    const detectedCompetences = Array.from(new Set(items.map(i => i.competence).filter(Boolean)));

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto min-h-screen">
            {/* Load PDF.js from reliable CDN */}
            <Script 
                src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" 
                strategy="lazyOnload"
                onLoad={() => {
                    if ((window as any).pdfjsLib) {
                        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 
                            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
                        setPdfJsLoaded(true);
                    }
                }}
            />

            {/* Header Section (Light theme matching other pages) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-teal-500/10 text-teal-600 rounded-2xl">
                            <Scissors className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">
                                    Separador Inteligente de Holerites
                                </h1>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-[11px] font-bold">
                                    <Sparkles className="w-3 h-3 text-teal-500" />
                                    Automação DP
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                                Envie o PDF único da contabilidade com todos os holerites. O sistema lê cada página, identifica o colaborador, renomeia automaticamente e entrega tudo em um arquivo ZIP.
                            </p>
                        </div>
                    </div>
                </div>

                {items.length > 0 && (
                    <div className="flex items-center gap-3 shrink-0">
                        <Button 
                            variant="outline" 
                            onClick={() => {
                                setItems([]);
                                setSourceFile(null);
                                setSelectedIds(new Set());
                                if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="border-slate-200 text-slate-700 hover:bg-slate-100 rounded-2xl h-11"
                        >
                            <RefreshCw className="w-4 h-4 mr-2 text-slate-500" />
                            Novo Arquivo
                        </Button>
                        <Button 
                            onClick={handleDownloadZip}
                            disabled={isGeneratingZip || selectedIds.size === 0}
                            className="bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl h-11 shadow-md shadow-teal-600/20"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            {isGeneratingZip ? `Compactando (${zipProgress}%)...` : `Baixar Selecionados (${selectedIds.size}) em .ZIP`}
                        </Button>
                    </div>
                )}
            </div>

            {/* Drop Zone Area */}
            {items.length === 0 && (
                <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const files = e.dataTransfer.files;
                        if (files && files[0]) handleFileUpload(files[0]);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 cursor-pointer flex flex-col items-center justify-center min-h-[380px] group bg-white ${
                        isDragging 
                            ? "border-teal-500 bg-teal-50/50 scale-[1.01]" 
                            : "border-slate-300 hover:border-teal-500 hover:bg-slate-50/60 shadow-sm"
                    }`}
                >
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="application/pdf" 
                        className="hidden" 
                        onChange={(e) => {
                            const files = e.target.files;
                            if (files && files[0]) handleFileUpload(files[0]);
                        }} 
                    />

                    <div className="w-20 h-20 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-teal-400 transition-all duration-300 shadow-sm">
                        <Upload className="w-10 h-10 text-teal-600" />
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 mb-2">
                        Arraste e solte o PDF da contabilidade aqui
                    </h2>
                    <p className="text-sm text-slate-500 max-w-md mb-6">
                        Suporta arquivos de qualquer sistema contábil (Domínio, Onvio, Questor, Totvs, Alterdata, etc.) com dezenas ou centenas de páginas.
                    </p>

                    <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-teal-600 text-white font-bold text-sm shadow-md shadow-teal-600/20 group-hover:bg-teal-700 transition-colors">
                        <FileText className="w-4 h-4" />
                        Selecionar Arquivo PDF
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left w-full max-w-3xl border-t border-slate-100 pt-6 text-xs text-slate-600">
                        <div className="flex items-center gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                            <span>100% Processado no Navegador (Privacidade Total)</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                            <span>Leitura Automática de Nome, CPF e Mês</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                            <span>Download em .ZIP com Arquivos Padronizados</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Processing Progress Bar */}
            {isProcessing && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-teal-700 flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                            {progressText}
                        </span>
                        <span className="font-mono text-slate-800 font-bold">{progressPercent}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div 
                            className="h-full bg-teal-500 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Processed Results Dashboard */}
            {items.length > 0 && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Holerites Encontrados</span>
                                <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                                    <Users className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="text-3xl font-black text-slate-900">{items.length}</div>
                            <p className="text-xs text-slate-500 mt-1">Páginas separadas com sucesso</p>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Competência</span>
                                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                                    <Calendar className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-slate-900 truncate">
                                {detectedCompetences.length > 0 ? detectedCompetences.join(", ") : "Não identificada"}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Mês de referência detectado</p>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Empresa / Razão Social</span>
                                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                                    <Building2 className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="text-base font-bold text-slate-900 truncate" title={detectedCompanies.join(", ")}>
                                {detectedCompanies.length > 0 ? detectedCompanies[0] : "Identificada no cabeçalho"}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Empresa extraída do PDF</p>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Arquivo de Origem</span>
                                <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                                    <Layers className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="text-sm font-bold text-slate-900 truncate" title={sourceFile?.name}>
                                {sourceFile?.name || "Arquivo.pdf"}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                {sourceFile ? `${(sourceFile.size / (1024 * 1024)).toFixed(2)} MB` : ""}
                            </p>
                        </div>
                    </div>

                    {/* Configuration / Toolbar Bar */}
                    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-4">
                            <Settings2 className="w-4 h-4 text-teal-600" />
                            Configurações de Nomenclatura e Organização
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Pattern selection */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-700">Padrão de Nome do Arquivo</Label>
                                <Select 
                                    value={namingPattern} 
                                    onValueChange={(val: NamingPattern) => setNamingPattern(val)}
                                >
                                    <SelectTrigger className="bg-slate-50 border-slate-200 text-slate-800 rounded-xl">
                                        <SelectValue placeholder="Selecione um padrão" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200 text-slate-800">
                                        <SelectItem value="nome-re">[Nome Completo] - RE [RE].pdf</SelectItem>
                                        <SelectItem value="re-nome">RE [RE] - [Nome Completo].pdf</SelectItem>
                                        <SelectItem value="nome-re-comp">[Nome Completo] - RE [RE] - [Competência].pdf</SelectItem>
                                        <SelectItem value="comp-nome-re">[Competência] - [Nome Completo] - RE [RE].pdf</SelectItem>
                                        <SelectItem value="holerite-nome-comp">Holerite_[Nome]_[Competência].pdf</SelectItem>
                                        <SelectItem value="comp-nome-cpf">[Competência] - [Nome] - [CPF].pdf</SelectItem>
                                        <SelectItem value="custom">Personalizado (Fórmula)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Organization inside ZIP */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-700">Organização no arquivo .ZIP</Label>
                                <Select 
                                    value={folderStructure} 
                                    onValueChange={(val: any) => setFolderStructure(val)}
                                >
                                    <SelectTrigger className="bg-slate-50 border-slate-200 text-slate-800 rounded-xl">
                                        <SelectValue placeholder="Como organizar o ZIP" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200 text-slate-800">
                                        <SelectItem value="flat">Todos os PDFs na pasta raiz</SelectItem>
                                        <SelectItem value="by-company">Separar em Subpasta por Empresa</SelectItem>
                                        <SelectItem value="by-competence">Separar em Subpasta por Competência</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Search */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-700">Buscar Colaborador, RE ou CPF</Label>
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                                    <Input 
                                        type="text" 
                                        placeholder="Ex: João Silva, RE 123, 123.456, etc..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="bg-slate-50 border-slate-200 text-slate-800 pl-9 rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Custom Template builder if custom selected */}
                        {namingPattern === "custom" && (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-teal-200 space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold text-teal-800">Template Customizado</Label>
                                    <span className="text-[11px] text-slate-500">Clique nas tags abaixo para inserir na fórmula</span>
                                </div>
                                <Input 
                                    value={customTemplate}
                                    onChange={(e) => setCustomTemplate(e.target.value)}
                                    placeholder="Ex: {nome} - RE {re}"
                                    className="bg-white border-slate-300 text-slate-900 font-mono text-sm rounded-xl"
                                />
                                <div className="flex flex-wrap gap-2">
                                    {["{nome}", "{re}", "{matricula}", "{cpf}", "{competencia}", "{empresa}", "{tipo}", "{pagina}"].map(tag => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => setCustomTemplate(prev => `${prev} - ${tag}`)}
                                            className="px-2.5 py-1 bg-white hover:bg-teal-50 hover:text-teal-700 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 transition-colors shadow-2xs"
                                        >
                                            + {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Table of Items */}
                    <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
                        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <input 
                                    type="checkbox"
                                    checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-slate-300 bg-white text-teal-600 focus:ring-teal-500 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    {selectedIds.size} de {filteredItems.length} selecionados
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button 
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedIds(new Set(filteredItems.map(i => i.id)))}
                                    className="border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-100 rounded-xl"
                                >
                                    Selecionar Todos
                                </Button>
                                <Button 
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedIds(new Set())}
                                    className="border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-100 rounded-xl"
                                >
                                    Desmarcar
                                </Button>
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 sticky top-0 backdrop-blur-md z-10">
                                    <tr>
                                        <th className="p-4 w-12 text-center">#</th>
                                        <th className="p-4">Pág.</th>
                                        <th className="p-4">Nome Completo do Colaborador</th>
                                        <th className="p-4">RE / Matrícula</th>
                                        <th className="p-4">CPF</th>
                                        <th className="p-4">Competência</th>
                                        <th className="p-4">Nome do Arquivo Gerado</th>
                                        <th className="p-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-slate-500">
                                                Nenhum holerite encontrado com o filtro aplicado.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredItems.map((item, idx) => {
                                            const isSelected = selectedIds.has(item.id);
                                            const isEditing = editingId === item.id;

                                            return (
                                                <tr 
                                                    key={item.id}
                                                    className={`hover:bg-slate-50/80 transition-colors ${
                                                        isSelected ? "bg-teal-50/40" : ""
                                                    }`}
                                                >
                                                    <td className="p-4 text-center">
                                                        <input 
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectItem(item.id)}
                                                            className="w-4 h-4 rounded border-slate-300 bg-white text-teal-600 focus:ring-teal-500 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="p-4 font-mono text-slate-500 font-bold">
                                                        {item.pageNumbersDisplay}
                                                    </td>
                                                    <td className="p-4">
                                                        {isEditing ? (
                                                            <div className="flex items-center gap-2">
                                                                <Input 
                                                                    value={editNameValue}
                                                                    onChange={(e) => setEditNameValue(e.target.value)}
                                                                    className="h-8 text-xs bg-white border-teal-500 text-slate-900 w-64 rounded-lg"
                                                                    autoFocus
                                                                />
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    onClick={() => handleSaveNameEdit(item.id)}
                                                                    className="h-8 w-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                                                                >
                                                                    <Check className="w-4 h-4" />
                                                                </Button>
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    onClick={() => setEditingId(null)}
                                                                    className="h-8 w-8 text-slate-400 hover:text-slate-600"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 group">
                                                                <span className="font-bold text-slate-900 text-sm">
                                                                    {item.employeeName}
                                                                </span>
                                                                <button 
                                                                    onClick={() => {
                                                                        setEditingId(item.id);
                                                                        setEditNameValue(item.employeeName);
                                                                    }}
                                                                    title="Editar nome"
                                                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-teal-600 transition-opacity"
                                                                >
                                                                    <Edit3 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        )}
                                                        {item.companyName && (
                                                            <span className="text-[11px] text-slate-500 block truncate max-w-xs">
                                                                {item.companyName}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 text-xs font-mono font-bold border border-teal-200 inline-block">
                                                            {item.registrationCode ? `RE ${item.registrationCode}` : "Sem RE"}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-mono text-slate-800 font-medium">
                                                            {item.cpf ? formatCPF(item.cpf) : <span className="text-slate-400">-</span>}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200">
                                                            {item.competence || "N/D"}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-mono text-slate-600 text-xs truncate max-w-[280px]" title={item.customFileName}>
                                                        <div className="flex items-center gap-2">
                                                            <FileCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                                            <span className="truncate">{item.customFileName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button 
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setPreviewItem(item);
                                                                    setPreviewModalOpen(true);
                                                                }}
                                                                className="h-8 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
                                                            >
                                                                <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />
                                                                Ver
                                                            </Button>
                                                            <Button 
                                                                size="sm"
                                                                onClick={() => handleDownloadSingle(item)}
                                                                className="h-8 text-xs bg-slate-900 hover:bg-teal-600 text-white font-medium transition-colors rounded-xl"
                                                            >
                                                                <Download className="w-3.5 h-3.5 mr-1" />
                                                                Baixar
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
                <DialogContent className="max-w-4xl h-[85vh] bg-white border-slate-200 text-slate-900 flex flex-col p-6 rounded-3xl">
                    <DialogHeader className="border-b border-slate-100 pb-4">
                        <DialogTitle className="text-lg font-bold flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-teal-600" />
                                <span>Pré-visualização: {previewItem?.employeeName}</span>
                            </div>
                            {previewItem && (
                                <Button 
                                    size="sm"
                                    onClick={() => handleDownloadSingle(previewItem)}
                                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl"
                                >
                                    <Download className="w-3.5 h-3.5 mr-1" />
                                    Baixar PDF
                                </Button>
                            )}
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 text-xs">
                            Página {previewItem?.pageNumbersDisplay} • Competência: {previewItem?.competence || "N/D"} • CPF: {previewItem?.cpf ? formatCPF(previewItem.cpf) : "N/D"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 mt-4 relative">
                        {previewItem?.pdfBlobUrl ? (
                            <iframe 
                                src={previewItem.pdfBlobUrl} 
                                className="w-full h-full border-none"
                                title="Visualização do Holerite"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                                Não foi possível carregar a pré-visualização.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
