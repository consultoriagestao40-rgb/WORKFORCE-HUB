"use client";

import { useState, useRef, useEffect } from "react";
import Script from "next/script";
import { 
    FileText, 
    Upload, 
    Download, 
    Sparkles, 
    CheckCircle2, 
    AlertCircle, 
    Search, 
    RefreshCw, 
    Eye, 
    Scissors, 
    FolderArchive, 
    FolderTree, 
    Settings2, 
    Edit3, 
    Check, 
    X,
    Users,
    Calendar,
    Building2,
    Layers,
    FileCheck
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
    const [namingPattern, setNamingPattern] = useState<NamingPattern>("holerite-nome-comp");
    const [customTemplate, setCustomTemplate] = useState("{tipo}_{nome}_{competencia}");
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
            toast.error("O motor de leitura de PDF ainda está inicializando. Tente em 3 segundos.");
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
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8">
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

            {/* Top Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        Automação de Departamento Pessoal
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                        <Scissors className="w-8 h-8 text-teal-400" />
                        Separador Inteligente de Holerites
                    </h1>
                    <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                        Faça o upload do arquivo PDF único da contabilidade. O sistema lê cada página, identifica o colaborador, renomeia automaticamente e entrega tudo separado em um arquivo ZIP.
                    </p>
                </div>

                {items.length > 0 && (
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="outline" 
                            onClick={() => {
                                setItems([]);
                                setSourceFile(null);
                                setSelectedIds(new Set());
                                if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Novo Arquivo
                        </Button>
                        <Button 
                            onClick={handleDownloadZip}
                            disabled={isGeneratingZip || selectedIds.size === 0}
                            className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold shadow-lg shadow-teal-500/20"
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
                    className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 cursor-pointer flex flex-col items-center justify-center min-h-[380px] group ${
                        isDragging 
                            ? "border-teal-400 bg-teal-500/10 scale-[1.01]" 
                            : "border-slate-800 bg-slate-900/50 hover:border-teal-500/50 hover:bg-slate-900/80"
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

                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 border border-teal-500/30 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-teal-400 transition-all duration-300 shadow-xl shadow-teal-950/50">
                        <Upload className="w-10 h-10 text-teal-400 group-hover:text-teal-300 transition-colors" />
                    </div>

                    <h2 className="text-xl font-bold text-white mb-2">
                        Arraste e solte o PDF da contabilidade aqui
                    </h2>
                    <p className="text-sm text-slate-400 max-w-md mb-6">
                        Suporta arquivos de qualquer sistema contábil (Domínio, Onvio, Questor, Totvs, Alterdata, etc.) com dezenas ou centenas de páginas.
                    </p>

                    <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/25 group-hover:bg-teal-400 transition-colors">
                        <FileText className="w-4 h-4" />
                        Selecionar Arquivo PDF
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left w-full max-w-3xl border-t border-white/5 pt-6 text-xs text-slate-500">
                        <div className="flex items-center gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                            <span>100% Processado no Navegador (Privacidade Total)</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                            <span>Leitura Automática de Nome, CPF e Mês</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                            <span>Download em .ZIP com Arquivos Padronizados</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Processing Progress Bar */}
            {isProcessing && (
                <div className="bg-slate-900 border border-teal-500/30 rounded-2xl p-6 space-y-4 animate-in fade-in shadow-2xl">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-teal-400 flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
                            {progressText}
                        </span>
                        <span className="font-mono text-slate-300 font-bold">{progressPercent}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                        <div 
                            className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Processed Results Dashboard */}
            {items.length > 0 && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Holerites Encontrados</span>
                                <Users className="w-5 h-5 text-teal-400" />
                            </div>
                            <div className="text-3xl font-black text-white">{items.length}</div>
                            <p className="text-xs text-slate-500 mt-1">Páginas separadas com sucesso</p>
                        </div>

                        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Competência</span>
                                <Calendar className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div className="text-2xl font-bold text-white truncate">
                                {detectedCompetences.length > 0 ? detectedCompetences.join(", ") : "Não identificada"}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Mês de referência detectado</p>
                        </div>

                        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Empresa / Razão Social</span>
                                <Building2 className="w-5 h-5 text-amber-400" />
                            </div>
                            <div className="text-base font-bold text-white truncate" title={detectedCompanies.join(", ")}>
                                {detectedCompanies.length > 0 ? detectedCompanies[0] : "Identificada no cabeçalho"}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Empresa extraída do PDF</p>
                        </div>

                        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Arquivo de Origem</span>
                                <Layers className="w-5 h-5 text-rose-400" />
                            </div>
                            <div className="text-sm font-bold text-white truncate" title={sourceFile?.name}>
                                {sourceFile?.name || "Arquivo.pdf"}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                {sourceFile ? `${(sourceFile.size / (1024 * 1024)).toFixed(2)} MB` : ""}
                            </p>
                        </div>
                    </div>

                    {/* Configuration / Toolbar Bar */}
                    <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 space-y-6">
                        <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-white/10 pb-4">
                            <Settings2 className="w-4 h-4 text-teal-400" />
                            Configurações de Nomenclatura e Organização
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Pattern selection */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-300">Padrão de Nome do Arquivo</Label>
                                <Select 
                                    value={namingPattern} 
                                    onValueChange={(val: NamingPattern) => setNamingPattern(val)}
                                >
                                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                                        <SelectValue placeholder="Selecione um padrão" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                        <SelectItem value="holerite-nome-comp">Holerite_[Nome]_[Competência].pdf</SelectItem>
                                        <SelectItem value="comp-nome-cpf">[Competência] - [Nome] - [CPF].pdf</SelectItem>
                                        <SelectItem value="nome-comp">[Nome] - [Competência].pdf</SelectItem>
                                        <SelectItem value="empresa-nome-comp">[Empresa] - [Nome] - [Competência].pdf</SelectItem>
                                        <SelectItem value="matricula-nome-comp">[Matrícula] - [Nome] - [Competência].pdf</SelectItem>
                                        <SelectItem value="custom">Personalizado (Fórmula)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Organization inside ZIP */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-300">Organização no arquivo .ZIP</Label>
                                <Select 
                                    value={folderStructure} 
                                    onValueChange={(val: any) => setFolderStructure(val)}
                                >
                                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                                        <SelectValue placeholder="Como organizar o ZIP" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                        <SelectItem value="flat">Todos os PDFs na pasta raiz</SelectItem>
                                        <SelectItem value="by-company">Separar em Subpasta por Empresa</SelectItem>
                                        <SelectItem value="by-competence">Separar em Subpasta por Competência</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Search */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-300">Buscar Colaborador ou CPF</Label>
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                                    <Input 
                                        type="text" 
                                        placeholder="Ex: João, 123.456, etc..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="bg-slate-950 border-slate-800 text-slate-200 pl-9"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Custom Template builder if custom selected */}
                        {namingPattern === "custom" && (
                            <div className="p-4 bg-slate-950/80 rounded-xl border border-teal-500/20 space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold text-teal-400">Template Customizado</Label>
                                    <span className="text-[11px] text-slate-500">Clique nas tags abaixo para inserir na fórmula</span>
                                </div>
                                <Input 
                                    value={customTemplate}
                                    onChange={(e) => setCustomTemplate(e.target.value)}
                                    placeholder="Ex: {empresa}_{competencia}_{nome}"
                                    className="bg-slate-900 border-slate-700 text-white font-mono text-sm"
                                />
                                <div className="flex flex-wrap gap-2">
                                    {["{nome}", "{cpf}", "{competencia}", "{empresa}", "{matricula}", "{tipo}", "{pagina}"].map(tag => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => setCustomTemplate(prev => `${prev}_${tag}`)}
                                            className="px-2.5 py-1 bg-slate-800 hover:bg-teal-500/20 hover:text-teal-300 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 transition-colors"
                                        >
                                            + {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Table of Items */}
                    <div className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-4 bg-slate-900 border-b border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <input 
                                    type="checkbox"
                                    checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-teal-500 focus:ring-teal-500 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    {selectedIds.size} de {filteredItems.length} selecionados
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button 
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedIds(new Set(filteredItems.map(i => i.id)))}
                                    className="border-slate-800 bg-slate-950 text-xs text-slate-300 hover:text-white"
                                >
                                    Selecionar Todos
                                </Button>
                                <Button 
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedIds(new Set())}
                                    className="border-slate-800 bg-slate-950 text-xs text-slate-300 hover:text-white"
                                >
                                    Desmarcar
                                </Button>
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-white/5 sticky top-0 backdrop-blur-md z-10">
                                    <tr>
                                        <th className="p-4 w-12 text-center">#</th>
                                        <th className="p-4">Pág.</th>
                                        <th className="p-4">Colaborador</th>
                                        <th className="p-4">CPF / Matrícula</th>
                                        <th className="p-4">Competência</th>
                                        <th className="p-4">Nome do Arquivo Gerado</th>
                                        <th className="p-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-slate-500">
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
                                                    className={`hover:bg-white/[0.02] transition-colors ${
                                                        isSelected ? "bg-teal-500/[0.03]" : ""
                                                    }`}
                                                >
                                                    <td className="p-4 text-center">
                                                        <input 
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectItem(item.id)}
                                                            className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-teal-500 focus:ring-teal-500 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="p-4 font-mono text-slate-400 font-bold">
                                                        {item.pageNumbersDisplay}
                                                    </td>
                                                    <td className="p-4">
                                                        {isEditing ? (
                                                            <div className="flex items-center gap-2">
                                                                <Input 
                                                                    value={editNameValue}
                                                                    onChange={(e) => setEditNameValue(e.target.value)}
                                                                    className="h-8 text-xs bg-slate-950 border-teal-500 text-white w-64"
                                                                    autoFocus
                                                                />
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    onClick={() => handleSaveNameEdit(item.id)}
                                                                    className="h-8 w-8 text-teal-400 hover:text-teal-300 hover:bg-teal-500/10"
                                                                >
                                                                    <Check className="w-4 h-4" />
                                                                </Button>
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    onClick={() => setEditingId(null)}
                                                                    className="h-8 w-8 text-slate-500 hover:text-slate-400"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 group">
                                                                <span className="font-bold text-white text-sm">
                                                                    {item.employeeName}
                                                                </span>
                                                                <button 
                                                                    onClick={() => {
                                                                        setEditingId(item.id);
                                                                        setEditNameValue(item.employeeName);
                                                                    }}
                                                                    title="Editar nome"
                                                                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-teal-400 transition-opacity"
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
                                                        <div className="font-mono text-slate-300">
                                                            {item.cpf ? formatCPF(item.cpf) : <span className="text-slate-600">-</span>}
                                                        </div>
                                                        {item.registrationCode && (
                                                            <div className="text-[10px] text-slate-500">
                                                                Cód: {item.registrationCode}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-[11px] font-semibold border border-white/5">
                                                            {item.competence || "N/D"}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-mono text-slate-400 text-xs truncate max-w-[280px]" title={item.customFileName}>
                                                        <div className="flex items-center gap-2">
                                                            <FileCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                                            <span className="truncate">{item.customFileName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button 
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => {
                                                                    setPreviewItem(item);
                                                                    setPreviewModalOpen(true);
                                                                }}
                                                                className="h-8 text-xs text-slate-400 hover:text-white hover:bg-slate-800"
                                                            >
                                                                <Eye className="w-3.5 h-3.5 mr-1" />
                                                                Ver
                                                            </Button>
                                                            <Button 
                                                                size="sm"
                                                                onClick={() => handleDownloadSingle(item)}
                                                                className="h-8 text-xs bg-slate-800 hover:bg-teal-600 text-white font-medium transition-colors"
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
                <DialogContent className="max-w-4xl h-[85vh] bg-slate-900 border-slate-800 text-white flex flex-col p-6">
                    <DialogHeader className="border-b border-white/10 pb-4">
                        <DialogTitle className="text-lg font-bold flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-teal-400" />
                                <span>Pré-visualização: {previewItem?.employeeName}</span>
                            </div>
                            {previewItem && (
                                <Button 
                                    size="sm"
                                    onClick={() => handleDownloadSingle(previewItem)}
                                    className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs"
                                >
                                    <Download className="w-3.5 h-3.5 mr-1" />
                                    Baixar PDF
                                </Button>
                            )}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            Página {previewItem?.pageNumbersDisplay} • Competência: {previewItem?.competence || "N/D"} • CPF: {previewItem?.cpf ? formatCPF(previewItem.cpf) : "N/D"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 bg-slate-950 rounded-xl overflow-hidden border border-white/10 mt-4 relative">
                        {previewItem?.pdfBlobUrl ? (
                            <iframe 
                                src={previewItem.pdfBlobUrl} 
                                className="w-full h-full border-none"
                                title="Visualização do Holerite"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                                Não foi possível carregar a pré-visualização.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
