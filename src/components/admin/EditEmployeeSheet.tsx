"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    Edit, Plus, Trash2, Download, UploadCloud, FileText, CheckCircle2, 
    User, Briefcase, CreditCard, ShieldAlert, Users, Paperclip,
    Pencil, X, Check, Loader2, Scale, Sparkles, Layers, BookOpen, Clock, Calendar
} from "lucide-react";
import { 
    updateEmployee, 
    createAdHocDisciplinaryMeasure, 
    deleteDisciplinaryMeasure,
    resendDisciplinaryWhatsApp,
    getWizardDropdowns
} from "@/app/actions";
import { EmployeeOnvioWizard } from "./EmployeeOnvioWizard";
import { VacationHistory } from "./VacationHistory";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface EditEmployeeSheetProps {
    employee: any;
    situations: { id: string, name: string }[];
    roles: { id: string, name: string }[];
    companies?: { id: string, name: string }[];
    postos?: any[];
}

export function EditEmployeeSheet({ 
    employee, 
    situations, 
    roles, 
    companies = [],
    postos = []
}: EditEmployeeSheetProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"onvio" | "vacations" | "disciplinary">("onvio");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Dynamic Dropdowns
    const [departments, setDepartments] = useState<{ id: string, name: string }[]>([]);
    const [costCenters, setCostCenters] = useState<{ id: string, name: string }[]>([]);
    const [unions, setUnions] = useState<{ id: string, name: string }[]>([]);
    const [jobFunctions, setJobFunctions] = useState<{ id: string, name: string }[]>([]);

    // Ad-hoc Disciplinary Measures states
    const [openAdHocDialog, setOpenAdHocDialog] = useState(false);
    const [adHocType, setAdHocType] = useState("ADVERTENCIA");
    const [adHocCltArticle, setAdHocCltArticle] = useState("Artigo 482, alínea e - Desídia (Faltas/Atrasos)");
    const [adHocOccurrenceDate, setAdHocOccurrenceDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [adHocDescription, setAdHocDescription] = useState("");
    const [adHocFileName, setAdHocFileName] = useState("");
    const [adHocFileData, setAdHocFileData] = useState("");
    const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);
    const [isSubmittingAdHoc, setIsSubmittingAdHoc] = useState(false);

    useEffect(() => {
        if (open) {
            getWizardDropdowns().then(res => {
                setDepartments(res.departments || []);
                setCostCenters(res.costCenters || []);
                setUnions(res.unions || []);
                setJobFunctions(res.jobFunctions || []);
            });
        }
    }, [open]);

    const handleAdHocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setAdHocFileName(file.name);
        
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            setAdHocFileData(reader.result as string);
        };

        setIsAnalyzingDoc(true);
        const toastId = toast.loading("Inteligência Artificial analisando o documento...");
        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/extract-disciplinary", {
                method: "POST",
                body: formData
            });

            const result = await response.json();
            if (result.success && result.data) {
                toast.success("Documento analisado! Campos preenchidos automaticamente.", { id: toastId });
                const extracted = result.data;
                if (extracted.type) setAdHocType(extracted.type);
                if (extracted.occurrenceDate) setAdHocOccurrenceDate(extracted.occurrenceDate);
                if (extracted.cltArticle) setAdHocCltArticle(extracted.cltArticle);
                if (extracted.description) setAdHocDescription(extracted.description);
            } else {
                toast.error(result.error || "A IA não conseguiu ler o documento, insira os dados manualmente.", { id: toastId });
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao conectar com a IA, insira os dados manualmente.", { id: toastId });
        } finally {
            setIsAnalyzingDoc(false);
        }
    };

    const handleSaveAdHoc = async () => {
        if (!adHocFileData) {
            toast.error("Por favor, anexe o documento assinado.");
            return;
        }
        setIsSubmittingAdHoc(true);
        try {
            const res = await createAdHocDisciplinaryMeasure({
                employeeId: employee.id,
                type: adHocType,
                cltArticle: adHocCltArticle,
                occurrenceDate: adHocOccurrenceDate,
                description: adHocDescription,
                fileName: adHocFileName,
                fileData: adHocFileData
            });

            if (res.success) {
                toast.success("Medida disciplinar registrada com sucesso!");
                setOpenAdHocDialog(false);
                setAdHocDescription("");
                setAdHocFileData("");
                setAdHocFileName("");
                router.refresh();
            } else {
                toast.error(res.error || "Erro ao salvar medida disciplinar.");
            }
        } catch (error: any) {
            toast.error(error.message || "Erro de conexão ao salvar.");
        } finally {
            setIsSubmittingAdHoc(false);
        }
    };

    const handleDeleteDisciplinary = async (measureId: string) => {
        if (!confirm("Deseja realmente excluir este registro de medida disciplinar?")) return;
        try {
            const res = await deleteDisciplinaryMeasure(measureId);
            if (res.success) {
                toast.success("Registro excluído com sucesso!");
                router.refresh();
            } else {
                toast.error(res.error || "Erro ao excluir registro.");
            }
        } catch (e: any) {
            toast.error(e.message || "Erro ao excluir.");
        }
    };

    const handleResendWhatsApp = async (measureId: string) => {
        try {
            const res = await resendDisciplinaryWhatsApp(measureId);
            if (res.success) {
                toast.success("Notificação enviada ao WhatsApp do colaborador!");
            } else {
                toast.error(res.error || "Erro ao enviar notificação.");
            }
        } catch (e: any) {
            toast.error(e.message || "Erro ao disparar mensagem.");
        }
    };

    async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const rawFormData = new FormData(e.currentTarget);
            rawFormData.set("id", employee.id);

            const result = await updateEmployee(rawFormData);
            if (result?.error) {
                toast.error(result.error);
                setIsSubmitting(false);
                return;
            }

            setOpen(false);
            toast.success("Cadastro do colaborador atualizado com sucesso!");
            router.refresh();
            window.location.reload();
        } catch (error: any) {
            toast.error(error.message || "Erro ao atualizar colaborador");
            setIsSubmitting(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold border-none h-9 px-4 rounded-xl shadow-xs text-xs uppercase tracking-wider">
                    <Edit className="w-4 h-4" /> Editar Colaborador
                </Button>
            </SheetTrigger>
            <SheetContent className="px-8 sm:max-w-5xl w-full flex flex-col h-full bg-white">
                <SheetHeader className="pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-[0.3em] mb-0.5">
                        <User className="w-3.5 h-3.5 fill-current" /> Gestão de Pessoal & Ficha Cadastral
                    </div>
                    <SheetTitle className="text-2xl font-black text-slate-900">
                        Editar Cadastro de {employee.name}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-slate-500">
                        Atualize todos os dados cadastrais, profissionais, eSocial/Onvio, benefícios, dependentes e anexos.
                    </SheetDescription>

                    {/* Abas Superiores de Manutenção */}
                    <div className="pt-2">
                        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
                            <TabsList className="bg-slate-100 p-1 rounded-xl">
                                <TabsTrigger value="onvio" className="text-xs font-bold px-4 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-xs">
                                    <Layers className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                                    Ficha Cadastral Completa
                                </TabsTrigger>
                                <TabsTrigger value="vacations" className="text-xs font-bold px-4 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-xs">
                                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                                    Histórico de Férias
                                </TabsTrigger>
                                <TabsTrigger value="disciplinary" className="text-xs font-bold px-4 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-xs">
                                    <Scale className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
                                    Medidas Disciplinares ({employee.disciplinaryMeasures?.length || 0})
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </SheetHeader>

                {/* CONTEÚDO PRINCIPAL */}
                <div className="flex-1 overflow-hidden pt-2">
                    {/* ABA 1: FICHA COMPLETA (ONVIO WIZARD) */}
                    {activeTab === "onvio" && (
                        <form onSubmit={handleFormSubmit} className="flex flex-col h-full overflow-hidden">
                            <input type="hidden" name="id" value={employee.id} />
                            
                            <div className="flex-1 overflow-y-auto pr-3 space-y-4">
                                <EmployeeOnvioWizard
                                    initialData={employee}
                                    situations={situations}
                                    roles={roles}
                                    companies={companies}
                                    postos={postos}
                                    departments={departments}
                                    costCenters={costCenters}
                                    unions={unions}
                                    jobFunctions={jobFunctions}
                                />
                            </div>

                            {/* Rodapé com botão de salvar */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 bg-white">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setOpen(false)}
                                    className="h-10 text-xs font-bold rounded-xl"
                                >
                                    Cancelar
                                </Button>

                                <div className="flex items-center gap-2">
                                    <Button 
                                        type="button" 
                                        variant="outline"
                                        onClick={() => {
                                            const extraFieldsInput = document.querySelector('input[name="extraFields"]') as HTMLInputElement;
                                            const extraFields = extraFieldsInput ? JSON.parse(extraFieldsInput.value) : {};

                                            const event = new CustomEvent("workforceRpaCapture", {
                                                detail: {
                                                    name: employee.name,
                                                    cpf: employee.cpf,
                                                    phone: employee.phone,
                                                    email: employee.email,
                                                    role: employee.role?.name,
                                                    salary: employee.salary,
                                                    company: employee.company?.name,
                                                    startDate: employee.admissionDate ? new Date(employee.admissionDate).toLocaleDateString('pt-BR') : "",
                                                    birthDate: employee.birthDate ? new Date(employee.birthDate).toLocaleDateString('pt-BR') : "",
                                                    gender: employee.gender,
                                                    address: employee.address,
                                                    ...extraFields
                                                }
                                            });
                                            document.dispatchEvent(event);
                                            toast.success("Dados copiados para a extensão da Thomson Reuters!");
                                        }}
                                        className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 text-xs font-bold h-10 rounded-xl"
                                    >
                                        ⚡ Preencher Onvio / Thomson
                                    </Button>

                                    <Button 
                                        type="submit" 
                                        disabled={isSubmitting} 
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-6 rounded-xl shadow-xs text-xs"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                <span>Salvando Alterações...</span>
                                            </>
                                        ) : (
                                            <span>Salvar Alterações</span>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    )}

                    {/* ABA 2: HISTÓRICO DE FÉRIAS */}
                    {activeTab === "vacations" && (
                        <div className="h-full overflow-y-auto pr-2 space-y-4">
                            <VacationHistory 
                                employeeId={employee.id} 
                                vacations={employee.vacations || []} 
                                hasActivePosto={employee.assignments?.some((a: any) => !a.endDate)}
                            />
                        </div>
                    )}

                    {/* ABA 3: MEDIDAS DISCIPLINARES */}
                    {activeTab === "disciplinary" && (
                        <div className="h-full overflow-y-auto pr-2 space-y-4">
                            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <div>
                                    <h4 className="font-extrabold text-sm text-slate-900">Medidas Disciplinares Registradas</h4>
                                    <p className="text-xs text-slate-500">Histórico de advertências e suspensões aplicadas ao colaborador.</p>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => setOpenAdHocDialog(true)}
                                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-9 px-3 rounded-xl shadow-xs"
                                >
                                    <Plus className="w-4 h-4 mr-1.5" /> Registrar Medida com IA
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {(!employee.disciplinaryMeasures || employee.disciplinaryMeasures.length === 0) ? (
                                    <div className="p-8 text-center bg-white border border-dashed rounded-2xl">
                                        <Scale className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-slate-500">Nenhuma medida disciplinar registrada para este colaborador.</p>
                                    </div>
                                ) : (
                                    employee.disciplinaryMeasures.map((m: any) => (
                                        <div key={m.id} className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex items-center justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                                        m.type === 'SUSPENSAO' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {m.type}
                                                    </span>
                                                    <span className="text-xs text-slate-400 font-medium">
                                                        Data: {new Date(m.occurrenceDate || m.createdAt).toLocaleDateString('pt-BR')}
                                                    </span>
                                                </div>
                                                <h5 className="font-bold text-xs text-slate-800">{m.cltArticle || "Motivo disciplinar"}</h5>
                                                {m.description && <p className="text-xs text-slate-500 line-clamp-2">{m.description}</p>}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                {m.fileData && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            const link = document.createElement("a");
                                                            link.href = m.fileData;
                                                            link.download = m.fileName || `Medida_${m.type}.pdf`;
                                                            link.click();
                                                        }}
                                                        className="h-8 px-2 text-xs font-bold text-slate-700"
                                                    >
                                                        <Download className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                                                        Documento
                                                    </Button>
                                                )}
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteDisciplinary(m.id)}
                                                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Dialog para Anexar / Registrar Medida Disciplinar com IA */}
                <Dialog open={openAdHocDialog} onOpenChange={setOpenAdHocDialog}>
                    <DialogContent className="max-w-lg rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <Scale className="w-5 h-5 text-rose-600" /> Registrar Medida Disciplinar
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">
                                Envie o documento assinado para extração automática via Inteligência Artificial ou preencha manualmente.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 text-xs">
                            {/* Upload com IA */}
                            <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50 text-center space-y-2">
                                <UploadCloud className="w-8 h-8 text-indigo-500 mx-auto" />
                                <div>
                                    <span className="font-bold text-slate-700 block">Anexe o documento assinado (PDF/Foto)</span>
                                    <span className="text-[11px] text-slate-400">A IA lerá o tipo, artigo da CLT e data automaticamente.</span>
                                </div>
                                <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg"
                                    onChange={handleAdHocFileChange}
                                    disabled={isAnalyzingDoc}
                                    className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold">Tipo da Medida</Label>
                                    <Select value={adHocType} onValueChange={setAdHocType}>
                                        <SelectTrigger className="h-9 text-xs rounded-xl bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ADVERTENCIA">Advertência Escrita</SelectItem>
                                            <SelectItem value="SUSPENSAO">Suspensão Disciplinar</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs font-bold">Data da Ocorrência</Label>
                                    <Input
                                        type="date"
                                        value={adHocOccurrenceDate}
                                        onChange={e => setAdHocOccurrenceDate(e.target.value)}
                                        className="h-9 text-xs rounded-xl bg-white"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Enquadramento Legal / Artigo CLT</Label>
                                <Input
                                    value={adHocCltArticle}
                                    onChange={e => setAdHocCltArticle(e.target.value)}
                                    className="h-9 text-xs rounded-xl bg-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Descrição dos Fatos</Label>
                                <Textarea
                                    value={adHocDescription}
                                    onChange={e => setAdHocDescription(e.target.value)}
                                    placeholder="Detalhes da conduta e aplicação da penalidade..."
                                    rows={3}
                                    className="text-xs rounded-xl bg-white"
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-2 pt-2 border-t">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpenAdHocDialog(false)}
                                className="h-9 text-xs font-bold rounded-xl"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSaveAdHoc}
                                disabled={isSubmittingAdHoc}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-9 text-xs rounded-xl shadow-xs"
                            >
                                {isSubmittingAdHoc ? "Salvando..." : "Salvar Medida"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </SheetContent>
        </Sheet>
    );
}
