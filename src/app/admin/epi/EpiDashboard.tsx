"use client";

import { useState } from "react";
import { 
    Shirt, 
    Plus, 
    Trash2, 
    Printer, 
    FileText, 
    Save, 
    Edit, 
    Package, 
    Search,
    AlertCircle,
    UserCheck,
    CheckCircle,
    XCircle,
    Send,
    ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter 
} from "@/components/ui/dialog";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { 
    createEpiItem, 
    updateEpiItem, 
    deleteEpiItem, 
    getEmployeeEpiDeliveries, 
    createEpiDelivery, 
    deleteEpiDelivery,
    updateEmployeeSizes,
    toggleDeliverySignature,
    getAllDeliveries,
    sendEpiFichaToAutentique
} from "@/actions/epi";

interface EmployeeItem {
    id: string;
    name: string;
    cpf: string | null;
    phone: string | null;
    admissionDate: Date | string | null;
    extraFields: any;
    company: { name: string } | null;
    role: { name: string } | null;
    assignments: Array<{
        posto: {
            role: { name: string } | null;
        } | null;
    }>;
    epiDeliveries?: any[];
}

interface EpiItem {
    id: string;
    name: string;
    type: string;
    caNumber: string | null;
    unit: string;
    stockQuantity: number;
    minStockQuantity: number;
    size: string | null;
}

interface EpiDashboardProps {
    initialEmployees: EmployeeItem[];
    initialEpiItems: EpiItem[];
    initialDeliveries: any[];
}

export function EpiDashboard({ initialEmployees, initialEpiItems, initialDeliveries }: EpiDashboardProps) {
    const [employees, setEmployees] = useState<EmployeeItem[]>(initialEmployees);
    const [epiItems, setEpiItems] = useState<EpiItem[]>(initialEpiItems);
    const [deliveries, setDeliveries] = useState<any[]>(initialDeliveries);
    
    // Active main tab: "estoque" or "deliveries"
    const [activeTab, setActiveTab] = useState("estoque");

    // Search inputs
    const [searchStock, setSearchStock] = useState("");
    const [searchDelivery, setSearchDelivery] = useState("");

    // Modal Control
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);

    // Stock item form states
    const [editingItem, setEditingItem] = useState<EpiItem | null>(null);
    const [itemName, setItemName] = useState("");
    const [itemType, setItemType] = useState("EPI");
    const [itemCa, setItemCa] = useState("");
    const [itemUnit, setItemUnit] = useState("unidade");
    const [itemStock, setItemStock] = useState("0");
    const [itemMinStock, setItemMinStock] = useState("0");
    const [itemSize, setItemSize] = useState("");

    // Delivery Modal variables
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
    const [searchEmp, setSearchEmp] = useState("");
    const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
    
    // Employee details & sizes inside modal
    const [camiseta, setCamiseta] = useState("");
    const [calca, setCalca] = useState("");
    const [luvas, setLuvas] = useState("");
    const [sapato, setSapato] = useState("");

    // List of deliveries loaded from DB for selected employee inside modal
    const [savedDeliveries, setSavedDeliveries] = useState<any[]>([]);
    
    // Temporary list of new deliveries drafted locally in the modal
    const [draftDeliveries, setDraftDeliveries] = useState<any[]>([]);

    // Form inputs for new item inside delivery modal
    const [deliveryItemId, setDeliveryItemId] = useState("");
    const [deliveryQty, setDeliveryQty] = useState("1");
    const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
    const [deliveryMer, setDeliveryMer] = useState("1");
    const [deliveryNotes, setDeliveryNotes] = useState("");
    
    const [isSavingAll, setIsSavingAll] = useState(false);
    const [sendingAutentique, setSendingAutentique] = useState(false);

    // Filter stock list
    const filteredStockItems = epiItems.filter(item => 
        item.name.toLowerCase().includes(searchStock.toLowerCase()) ||
        (item.caNumber && item.caNumber.includes(searchStock))
    );

    // Filter flat deliveries list in Tab 2
    const filteredDeliveries = deliveries.filter(d => 
        d.employee?.name.toLowerCase().includes(searchDelivery.toLowerCase()) ||
        (d.employee?.cpf && d.employee.cpf.includes(searchDelivery)) ||
        d.epiItem?.name.toLowerCase().includes(searchDelivery.toLowerCase())
    );

    // Filter employees in the modal dropdown search
    const filteredEmployees = employees.filter(e => 
        e.name.toLowerCase().includes(searchEmp.toLowerCase()) || 
        (e.cpf && e.cpf.includes(searchEmp))
    );

    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

    // Triggered when an employee is selected from the dropdown inside modal
    const handleSelectEmployee = async (empId: string) => {
        setSelectedEmployeeId(empId);
        setDraftDeliveries([]); // clear drafts
        if (!empId) {
            setSavedDeliveries([]);
            return;
        }

        try {
            const list = await getEmployeeEpiDeliveries(empId);
            setSavedDeliveries(list);

            const emp = employees.find(e => e.id === empId);
            const extra = emp?.extraFields || {};
            setCamiseta(extra.camisetaTamanho || "");
            setCalca(extra.calcaTamanho || "");
            setLuvas(extra.luvasTamanho || "");
            setSapato(extra.sapatoTamanho || "");
        } catch (e: any) {
            toast.error(e.message || "Erro ao carregar dados do colaborador.");
        }
    };

    // Open delivery modal
    const handleOpenDeliveryModal = () => {
        setSelectedEmployeeId("");
        setSearchEmp("");
        setSavedDeliveries([]);
        setDraftDeliveries([]);
        setDeliveryItemId("");
        setDeliveryQty("1");
        setDeliveryNotes("");
        setIsEmpDropdownOpen(false);
        setIsDeliveryModalOpen(true);
    };

    // Open delivery modal preloaded with specific employee (triggered from list)
    const handleOpenDeliveryModalForEmployee = async (empId: string) => {
        await handleSelectEmployee(empId);
        setSearchEmp("");
        setIsEmpDropdownOpen(false);
        setIsDeliveryModalOpen(true);
    };

    // Add delivery draft to local array
    const handleAddDraftDelivery = () => {
        if (!deliveryItemId) {
            toast.error("Por favor, selecione o item do estoque.");
            return;
        }

        const item = epiItems.find(i => i.id === deliveryItemId);
        if (!item) return;

        const qty = parseInt(deliveryQty) || 1;
        // Validate stock locally
        const totalDraftedQty = draftDeliveries
            .filter(d => d.epiItemId === deliveryItemId)
            .reduce((sum, d) => sum + d.quantity, 0);

        if (item.stockQuantity < (totalDraftedQty + qty)) {
            toast.error(`Estoque insuficiente! Saldo atual: ${item.stockQuantity}. Quantidade já na fila: ${totalDraftedQty}.`);
            return;
        }

        const draft = {
            id: `draft-${Date.now()}`,
            epiItemId: item.id,
            epiItem: item,
            quantity: qty,
            deliveryDate,
            merCode: parseInt(deliveryMer) || 1,
            notes: deliveryNotes
        };

        setDraftDeliveries(prev => [...prev, draft]);
        toast.success(`${item.name} adicionado à fila de entrega!`);

        // Reset item inputs
        setDeliveryItemId("");
        setDeliveryQty("1");
        setDeliveryNotes("");
    };

    // Remove draft from local array
    const handleRemoveDraftDelivery = (draftId: string) => {
        setDraftDeliveries(prev => prev.filter(d => d.id !== draftId));
    };

    // Save sizes and all drafts to the database
    const handleSaveAllDeliveries = async () => {
        if (!selectedEmployeeId) return;
        setIsSavingAll(true);

        try {
            // 1. Update Sizes
            await updateEmployeeSizes(selectedEmployeeId, {
                camiseta,
                calca,
                luvas,
                sapato
            });

            // Update local state with edited sizes
            setEmployees(prev => prev.map(emp => {
                if (emp.id === selectedEmployeeId) {
                    const extra = emp.extraFields || {};
                    return {
                        ...emp,
                        extraFields: {
                            ...extra,
                            camisetaTamanho: camiseta,
                            calcaTamanho: calca,
                            luvasTamanho: luvas,
                            sapatoTamanho: sapato
                        }
                    };
                }
                return emp;
            }));

            // 2. Save Deliveries
            for (const draft of draftDeliveries) {
                await createEpiDelivery({
                    employeeId: selectedEmployeeId,
                    epiItemId: draft.epiItemId,
                    quantity: draft.quantity,
                    deliveryDate: draft.deliveryDate,
                    merCode: draft.merCode,
                    notes: draft.notes
                });

                // Update local stock list quantity
                setEpiItems(prev => prev.map(i => {
                    if (i.id === draft.epiItemId) {
                        return { ...i, stockQuantity: i.stockQuantity - draft.quantity };
                    }
                    return i;
                }));
            }

            // 3. Clear drafts and refresh saved list from DB
            setDraftDeliveries([]);
            const list = await getEmployeeEpiDeliveries(selectedEmployeeId);
            setSavedDeliveries(list);

            // 4. Reload flat list of all deliveries
            const freshDeliveries = await getAllDeliveries();
            setDeliveries(freshDeliveries);

            toast.success("Todos os lançamentos salvos no banco de dados!");
        } catch (e: any) {
            toast.error(e.message || "Erro ao salvar lançamentos.");
        } finally {
            setIsSavingAll(false);
        }
    };

    // Toggle signature status directly
    const handleToggleSignature = async (id: string) => {
        try {
            const updated = await toggleDeliverySignature(id);
            setDeliveries(prev => prev.map(d => d.id === id ? updated : d));
            toast.success("Status de assinatura atualizado com sucesso!");
        } catch (e: any) {
            toast.error(e.message || "Erro ao alternar status da assinatura.");
        }
    };

    // Send EPI Ficha PDF to Autentique via WhatsApp
    const handleSendToAutentique = async (empId: string) => {
        setSendingAutentique(true);
        try {
            const res = await sendEpiFichaToAutentique(empId);
            
            if (!res.success) {
                toast.error(res.error || "Erro ao disparar assinatura no WhatsApp.");
                return;
            }

            // Reload all deliveries to update status badges
            const fresh = await getAllDeliveries();
            setDeliveries(fresh);

            if (selectedEmployeeId === empId) {
                const list = await getEmployeeEpiDeliveries(empId);
                setSavedDeliveries(list);
            }

            toast.success(`Ficha enviada com sucesso! Link para assinar: ${res.shortLink}`);
        } catch (e: any) {
            toast.error(e.message || "Erro ao disparar assinatura no WhatsApp.");
        } finally {
            setSendingAutentique(false);
        }
    };

    // Delete a saved delivery directly from database (called from modal or main table)
    const handleDeleteSavedDelivery = async (id: string) => {
        if (!confirm("Tem certeza que deseja cancelar e excluir esta entrega? O item retornará ao estoque.")) return;
        try {
            const target = deliveries.find(d => d.id === id);
            await deleteEpiDelivery(id);

            // Restore local stock quantity
            if (target) {
                setEpiItems(prev => prev.map(i => {
                    if (i.id === target.epiItemId) {
                        return { ...i, stockQuantity: i.stockQuantity + target.quantity };
                    }
                    return i;
                }));
            }

            // Remove from local states
            setDeliveries(prev => prev.filter(d => d.id !== id));
            setSavedDeliveries(prev => prev.filter(d => d.id !== id));

            toast.success("Entrega removida e estoque estornado!");
        } catch (e: any) {
            toast.error(e.message || "Erro ao excluir entrega.");
        }
    };

    // Open item create modal
    const handleOpenCreateItem = () => {
        setEditingItem(null);
        setItemName("");
        setItemType("EPI");
        setItemCa("");
        setItemUnit("unidade");
        setItemStock("0");
        setItemMinStock("0");
        setItemSize("");
        setIsItemModalOpen(true);
    };

    // Open item edit modal
    const handleOpenEditItem = (item: EpiItem) => {
        setEditingItem(item);
        setItemName(item.name);
        setItemType(item.type);
        setItemCa(item.caNumber || "");
        setItemUnit(item.unit);
        setItemStock(String(item.stockQuantity));
        setItemMinStock(String(item.minStockQuantity));
        setItemSize(item.size || "");
        setIsItemModalOpen(true);
    };

    // Delete stock item
    const handleDeleteItem = async (id: string) => {
        if (!confirm("Tem certeza que deseja remover este item do estoque?")) return;
        try {
            await deleteEpiItem(id);
            setEpiItems(prev => prev.filter(i => i.id !== id));
            toast.success("Item removido do estoque.");
        } catch (e: any) {
            toast.error(e.message || "Erro ao remover item.");
        }
    };

    // Save stock item
    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemName) {
            toast.error("O nome do item é obrigatório.");
            return;
        }

        try {
            const payload = {
                name: itemName,
                type: itemType,
                caNumber: itemType === "EPI" ? (itemCa || null) : null,
                unit: itemUnit,
                stockQuantity: parseInt(itemStock) || 0,
                minStockQuantity: parseInt(itemMinStock) || 0,
                size: itemSize || null
            };

            if (editingItem) {
                const res = await updateEpiItem(editingItem.id, payload);
                setEpiItems(prev => prev.map(i => i.id === editingItem.id ? (res as any) : i));
                toast.success("Item atualizado no estoque!");
            } else {
                const res = await createEpiItem(payload);
                setEpiItems(prev => [...prev, (res as any)].sort((a,b) => a.name.localeCompare(b.name)));
                toast.success("Item cadastrado no estoque!");
            }
            setIsItemModalOpen(false);
        } catch (e: any) {
            toast.error(e.message || "Erro ao salvar item.");
        }
    };

    return (
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100/80 px-8 py-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Shirt className="w-5 h-5 text-amber-500" /> Controle de EPIs & Uniformes
                        </CardTitle>
                        <CardDescription className="text-xs font-medium text-slate-500 mt-1">
                            Acompanhe as quantidades em estoque e a assinatura dos termos de responsabilidade de entrega
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid grid-cols-2 max-w-[420px] bg-slate-100 rounded-xl p-1">
                        <TabsTrigger value="estoque" className="rounded-lg text-xs font-bold py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <Package className="w-4 h-4 mr-1.5" /> Estoque de EPIs & Uniformes
                        </TabsTrigger>
                        <TabsTrigger value="deliveries" className="rounded-lg text-xs font-bold py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <FileText className="w-4 h-4 mr-1.5" /> Lançamentos & Assinaturas
                        </TabsTrigger>
                    </TabsList>

                    {/* TAB 1: ESTOQUE */}
                    <TabsContent value="estoque" className="space-y-6 border-none p-0 outline-none">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-2 max-w-[320px] w-full">
                                <div className="relative flex-1">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                    <Input 
                                        placeholder="Buscar item ou C.A..." 
                                        value={searchStock} 
                                        onChange={(e) => setSearchStock(e.target.value)} 
                                        className="pl-9 h-9 text-xs rounded-xl border-slate-200"
                                    />
                                </div>
                            </div>
                            <Button 
                                onClick={handleOpenCreateItem}
                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-10 px-4 rounded-xl text-xs gap-1.5"
                            >
                                <Plus className="w-4 h-4" /> Cadastrar Novo Item
                            </Button>
                        </div>

                        {/* Stock Table */}
                        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-700 text-xs">Tipo</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs">Item</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs">C.A. (Certificado)</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs">Tamanho</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs">Unidade</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs text-center">Qtd. Estoque</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs text-center">Qtd. Mínima</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs">Status</TableHead>
                                        <TableHead className="text-right"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredStockItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center text-slate-400 text-xs py-8">
                                                Nenhum item cadastrado no estoque de EPIs & Uniformes.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredStockItems.map(item => {
                                            const isLow = item.stockQuantity <= item.minStockQuantity;
                                            return (
                                                <TableRow key={item.id} className="hover:bg-slate-50/40 text-xs">
                                                    <TableCell className="font-semibold">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                            item.type === "EPI" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                                                        }`}>
                                                            {item.type}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="font-bold text-slate-800">{item.name}</TableCell>
                                                    <TableCell className="font-semibold text-slate-600">{item.caNumber || "-"}</TableCell>
                                                    <TableCell className="font-bold text-slate-800">{item.size || "-"}</TableCell>
                                                    <TableCell className="text-slate-500 font-medium">{item.unit}</TableCell>
                                                    <TableCell className={`font-black text-center text-sm ${isLow ? "text-red-600" : "text-slate-800"}`}>
                                                        {item.stockQuantity}
                                                    </TableCell>
                                                    <TableCell className="text-slate-500 text-center font-medium">{item.minStockQuantity}</TableCell>
                                                    <TableCell>
                                                        {item.stockQuantity <= 0 ? (
                                                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-100 text-red-800">Sem Estoque</span>
                                                        ) : isLow ? (
                                                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-orange-100 text-orange-800">Estoque Crítico</span>
                                                        ) : (
                                                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-green-100 text-green-800">Normal</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1.5">
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                onClick={() => handleOpenEditItem(item)}
                                                                className="h-8 w-8 text-slate-400 hover:text-slate-800 rounded-lg"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                onClick={() => handleDeleteItem(item.id)}
                                                                className="h-8 w-8 text-slate-400 hover:text-red-500 rounded-lg"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    {/* TAB 2: LANÇAMENTOS E ASSINATURAS */}
                    <TabsContent value="deliveries" className="space-y-6 border-none p-0 outline-none">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-2 max-w-[320px] w-full">
                                <div className="relative flex-1">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                    <Input 
                                        placeholder="Buscar por nome, CPF ou item..." 
                                        value={searchDelivery} 
                                        onChange={(e) => setSearchDelivery(e.target.value)} 
                                        className="pl-9 h-9 text-xs rounded-xl border-slate-200"
                                    />
                                </div>
                            </div>
                            <Button 
                                onClick={handleOpenDeliveryModal}
                                className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-10 px-4 rounded-xl text-xs gap-1.5 shadow-sm"
                            >
                                <Plus className="w-4 h-4" /> Registrar Lançamentos & Ficha de EPI
                            </Button>
                        </div>

                        {/* Flat list of all deliveries */}
                        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-700 text-xs">Data Entrega</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs">Colaborador</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs">Empresa</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs">Cargo</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs">Item</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs">C.A.</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs text-center">Qtd</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-xs">Status Assinatura</TableHead>
                                        <TableHead className="text-right"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredDeliveries.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center text-slate-400 text-xs py-8">
                                                Nenhum registro de entrega encontrado.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredDeliveries.map(d => {
                                            const isSigned = d.recipientSignature === "ASSINADO" || (d.recipientSignature && d.recipientSignature.startsWith("ASSINADO_AUTENTIQUE_"));
                                            const isSentAutentique = d.recipientSignature && d.recipientSignature.startsWith("ENVIADO_AUTENTIQUE_");
                                            const autentiqueDocId = d.recipientSignature && d.recipientSignature.includes("_AUTENTIQUE_")
                                                ? d.recipientSignature.split("_AUTENTIQUE_")[1]
                                                : null;
                                            
                                            return (
                                                <TableRow key={d.id} className="hover:bg-slate-50/40 text-xs">
                                                    <TableCell className="font-semibold text-slate-600">
                                                        {new Date(d.deliveryDate).getUTCDate().toString().padStart(2, '0') + '/' + 
                                                          (new Date(d.deliveryDate).getUTCMonth() + 1).toString().padStart(2, '0') + '/' + 
                                                          new Date(d.deliveryDate).getUTCFullYear()}
                                                    </TableCell>
                                                    <TableCell className="font-bold text-slate-800">
                                                        <div>{d.employee?.name}</div>
                                                        <div className="text-[9px] font-medium text-slate-400">CPF: {d.employee?.cpf}</div>
                                                    </TableCell>
                                                    <TableCell className="text-slate-600 font-medium">{d.employee?.company?.name || "SPOT Facilities"}</TableCell>
                                                    <TableCell className="text-slate-500 font-medium">{d.employee?.role?.name || "Auxiliar"}</TableCell>
                                                    <TableCell className="font-bold text-slate-850">
                                                        {d.epiItem?.name} {d.epiItem?.size ? `(${d.epiItem.size})` : ""}
                                                    </TableCell>
                                                    <TableCell className="text-slate-500 font-medium">{d.epiItem?.caNumber || "-"}</TableCell>
                                                    <TableCell className="font-black text-center text-slate-800">{d.quantity} {d.epiItem?.unit}</TableCell>
                                                    <TableCell>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (autentiqueDocId) {
                                                                    window.open(`https://painel.autentique.com.br/documentos/${autentiqueDocId}`, "_blank");
                                                                } else {
                                                                    handleToggleSignature(d.id);
                                                                }
                                                            }}
                                                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black transition-all ${
                                                                isSigned 
                                                                    ? "bg-green-100 text-green-800 hover:bg-green-200" 
                                                                    : isSentAutentique
                                                                        ? "bg-amber-100 text-amber-800 hover:bg-amber-200 animate-pulse"
                                                                        : "bg-red-100 text-red-800 hover:bg-red-200"
                                                            }`}
                                                            title={autentiqueDocId ? "Clique para abrir o Documento Assinado Oficial na Autentique" : "Clique para alterar o status da assinatura"}
                                                        >
                                                            {isSigned ? (
                                                                <>
                                                                    <CheckCircle className="w-3 h-3 text-green-600" /> Assinado
                                                                </>
                                                            ) : isSentAutentique ? (
                                                                <>
                                                                    <AlertCircle className="w-3 h-3 text-amber-600" /> Enviado WhatsApp
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <XCircle className="w-3 h-3 text-red-600" /> Pendente Assinatura
                                                                </>
                                                            )}
                                                        </button>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            {/* Autentique direct link button */}
                                                            {autentiqueDocId && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => window.open(`https://painel.autentique.com.br/documentos/${autentiqueDocId}`, "_blank")}
                                                                    className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border-emerald-300"
                                                                    title="Abrir Documento Oficial Assinado no Autentique (Com Folha de Auditoria e Validade Jurídica)"
                                                                >
                                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                                </Button>
                                                            )}
                                                            {/* Send to Autentique quick button */}
                                                            {(!isSigned) && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleSendToAutentique(d.employeeId)}
                                                                    disabled={sendingAutentique}
                                                                    className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-850 hover:bg-emerald-50 rounded-lg border-slate-200"
                                                                    title="Enviar Ficha Completa para o WhatsApp (Assinatura Digital)"
                                                                >
                                                                    <Send className="w-3.5 h-3.5" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleOpenDeliveryModalForEmployee(d.employeeId)}
                                                                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800 rounded-lg border-slate-200"
                                                                title="Abrir Ficha do Funcionário"
                                                            >
                                                                <FileText className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => window.open(`/admin/epi/print/${d.employeeId}`, "_blank")}
                                                                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800 rounded-lg border-slate-200"
                                                                title="Imprimir Ficha Local (Modelo de Balcão)"
                                                            >
                                                                <Printer className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleDeleteSavedDelivery(d.id)}
                                                                className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 rounded-lg border-slate-200"
                                                                title="Excluir Lançamento"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>

            {/* UNIFIED MODAL: REGISTRAR LANÇAMENTOS & FICHA DE EPI */}
            <Dialog open={isDeliveryModalOpen} onOpenChange={setIsDeliveryModalOpen}>
                <DialogContent className="sm:max-w-[1000px] w-[95vw] rounded-3xl max-h-[95vh] overflow-y-auto p-6">
                    <DialogHeader className="border-b pb-3 mb-4">
                        <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                            <FileText className="w-5 h-5 text-amber-500" /> Registrar Lançamentos & Ficha de EPI
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-5">
                        
                        {/* 1. Searchable Combobox for Employee Selection */}
                        <div className="space-y-1.5 relative">
                            <Label className="font-bold text-slate-700 text-xs">Pesquisar Colaborador</Label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsEmpDropdownOpen(!isEmpDropdownOpen)}
                                    className="w-full text-left px-3 py-2 border border-slate-200 rounded-xl text-xs flex justify-between items-center bg-white hover:bg-slate-50 focus:ring-2 focus:ring-amber-500/20"
                                >
                                    <span className="font-semibold text-slate-700">
                                        {selectedEmployeeId 
                                            ? `${selectedEmployee?.name} (${selectedEmployee?.cpf || "Sem CPF"})` 
                                            : "Selecione o Colaborador..."}
                                    </span>
                                    <span className="text-slate-400 text-[10px]">▼</span>
                                </button>
                                
                                {isEmpDropdownOpen && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2.5 space-y-2 animate-in fade-in duration-100">
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                                            <Input
                                                placeholder="Digite o nome ou CPF para filtrar..."
                                                value={searchEmp}
                                                onChange={(e) => setSearchEmp(e.target.value)}
                                                className="pl-8 h-8 text-[11px] rounded-lg border-slate-200 bg-white"
                                            />
                                        </div>
                                        <div className="max-h-[160px] overflow-y-auto space-y-0.5">
                                            {filteredEmployees.length === 0 ? (
                                                <div className="text-slate-400 text-[10px] p-2 text-center">Nenhum colaborador encontrado</div>
                                            ) : (
                                                filteredEmployees.map(emp => (
                                                    <button
                                                        key={emp.id}
                                                        type="button"
                                                        onClick={() => {
                                                            handleSelectEmployee(emp.id);
                                                            setIsEmpDropdownOpen(false);
                                                            setSearchEmp("");
                                                        }}
                                                        className={`w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded-lg text-xs transition-all flex flex-col ${
                                                            selectedEmployeeId === emp.id ? "bg-amber-50/55 text-amber-900 font-bold" : "text-slate-700"
                                                        }`}
                                                    >
                                                        <span>{emp.name}</span>
                                                        <span className="text-[9px] text-slate-400">CPF: {emp.cpf || "Sem CPF"} | {emp.company?.name || "Sem Empresa"}</span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedEmployeeId && (
                            <>
                                {/* 2. Employee Details Header Info */}
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-slate-600">
                                    <div><strong>Empresa:</strong> <span className="text-slate-800 font-bold">{selectedEmployee?.company?.name || "SPOT Facilities"}</span></div>
                                    <div><strong>Nome do Trabalhador:</strong> <span className="text-slate-800 font-bold">{selectedEmployee?.name}</span></div>
                                    <div><strong>CPF:</strong> <span className="text-slate-800 font-bold">{selectedEmployee?.cpf}</span></div>
                                    <div><strong>Função (Cargo):</strong> <span className="text-slate-800 font-bold">{selectedEmployee?.role?.name || selectedEmployee?.assignments?.[0]?.posto?.role?.name || "Sem Cargo"}</span></div>
                                    <div className="col-span-4 mt-1 border-t border-slate-200/50 pt-2 flex justify-between items-center">
                                        <div>
                                            <strong>Data de Admissão:</strong> <span className="text-slate-800 font-bold">{selectedEmployee?.admissionDate 
                                                ? new Date(selectedEmployee.admissionDate).getUTCDate().toString().padStart(2, '0') + '/' + 
                                                  (new Date(selectedEmployee.admissionDate).getUTCMonth() + 1).toString().padStart(2, '0') + '/' + 
                                                  new Date(selectedEmployee.admissionDate).getUTCFullYear()
                                                : "-"}</span>
                                        </div>
                                        <div className="text-[11px]">
                                            <strong>Celular/WhatsApp:</strong> <span className="text-slate-800 font-black">{selectedEmployee?.phone || selectedEmployee?.extraFields?.celularWhatsApp || selectedEmployee?.extraFields?.telefone || selectedEmployee?.extraFields?.phone || "Não cadastrado"}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Employee Sizes pre-fill section */}
                                <div className="space-y-1.5 p-4 border border-slate-100 rounded-2xl">
                                    <Label className="font-bold text-slate-800 text-xs block">Grade de Tamanhos (Salvos no Cadastro)</Label>
                                    <div className="grid grid-cols-4 gap-2">
                                        <div>
                                            <Label className="text-[9px] text-slate-500 font-medium">Camiseta</Label>
                                            <Input value={camiseta} onChange={e => setCamiseta(e.target.value)} placeholder="Ex: G, GG" className="h-8 text-xs rounded-lg border-slate-200 bg-white" />
                                        </div>
                                        <div>
                                            <Label className="text-[9px] text-slate-500 font-medium">Calça</Label>
                                            <Input value={calca} onChange={e => setCalca(e.target.value)} placeholder="Ex: 42" className="h-8 text-xs rounded-lg border-slate-200 bg-white" />
                                        </div>
                                        <div>
                                            <Label className="text-[9px] text-slate-500 font-medium">Luvas</Label>
                                            <Input value={luvas} onChange={e => setLuvas(e.target.value)} placeholder="Ex: M" className="h-8 text-xs rounded-lg border-slate-200 bg-white" />
                                        </div>
                                        <div>
                                            <Label className="text-[9px] text-slate-500 font-medium">Calçado (Sapato)</Label>
                                            <Input value={sapato} onChange={e => setSapato(e.target.value)} placeholder="Ex: 40" className="h-8 text-xs rounded-lg border-slate-200 bg-white" />
                                        </div>
                                    </div>
                                </div>

                                {/* 4. Delivery Form fields (Middle - Prominent add item panel) */}
                                <div className="p-4 border border-amber-200 rounded-2xl bg-amber-50/10 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider">Lançar Novo EPI / Uniforme na Ficha</h4>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label htmlFor="deliveryItem" className="text-[10px] font-bold text-slate-700">Item do Estoque</Label>
                                            <Select value={deliveryItemId} onValueChange={setDeliveryItemId}>
                                                <SelectTrigger id="deliveryItem" className="h-9 text-xs bg-white border-slate-200 rounded-xl">
                                                    <SelectValue placeholder="Selecione o EPI/Uniforme..." />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[180px]">
                                                    {epiItems.map(item => (
                                                        <SelectItem key={item.id} value={item.id} disabled={item.stockQuantity <= 0}>
                                                            {item.name} {item.size ? `(${item.size})` : ""} - Tipo: {item.type} | Saldo: {item.stockQuantity}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <Label htmlFor="deliveryQty" className="text-[10px] font-bold text-slate-700">Quantidade</Label>
                                                <Input 
                                                    id="deliveryQty" 
                                                    type="number" 
                                                    min="1" 
                                                    value={deliveryQty} 
                                                    onChange={e => setDeliveryQty(e.target.value)} 
                                                    className="h-9 text-xs rounded-xl border-slate-200 bg-white"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="deliveryDate" className="text-[10px] font-bold text-slate-700">Data da Entrega</Label>
                                                <Input 
                                                    id="deliveryDate" 
                                                    type="date" 
                                                    value={deliveryDate} 
                                                    onChange={e => setDeliveryDate(e.target.value)} 
                                                    className="h-9 text-xs rounded-xl border-slate-200 bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label htmlFor="deliveryMer" className="text-[10px] font-bold text-slate-700">M.E.R (Motivo da Entrega)</Label>
                                            <Select value={deliveryMer} onValueChange={setDeliveryMer}>
                                                <SelectTrigger id="deliveryMer" className="h-9 text-xs bg-white border-slate-200 rounded-xl">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1">1 - Recebimento de rotina ou EPI descartável</SelectItem>
                                                    <SelectItem value="2">2 - Substituição por dano justificado</SelectItem>
                                                    <SelectItem value="3">3 - Substituição por dano próprio ou perda</SelectItem>
                                                    <SelectItem value="4">4 - Devolução, demissão / mudança de função</SelectItem>
                                                    <SelectItem value="5">5 - Primeira entrega</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="deliveryNotes" className="text-[10px] font-bold text-slate-700">Observações (opcional)</Label>
                                            <Input 
                                                id="deliveryNotes" 
                                                value={deliveryNotes} 
                                                onChange={e => setDeliveryNotes(e.target.value)} 
                                                placeholder="Ex: Tamanho ajustado, etc."
                                                className="h-9 text-xs rounded-xl border-slate-200 bg-white"
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        onClick={handleAddDraftDelivery}
                                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-9 text-xs gap-1 rounded-xl shadow-sm"
                                    >
                                        <Plus className="w-4 h-4 text-amber-400" /> Adicionar na Fila de Entrega
                                    </Button>
                                </div>

                                {/* 5. Deliveries table: Unsaved drafts vs Saved history (Bottom) */}
                                <div className="space-y-4 pt-2">
                                    
                                    {/* Fila de novos lançamentos (Drafts) */}
                                    {draftDeliveries.length > 0 && (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-1.5 text-amber-700 font-extrabold text-[11px] uppercase tracking-wider">
                                                <AlertCircle className="w-4 h-4 text-amber-500" /> Novos itens aguardando gravação no banco
                                            </div>
                                            <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/5">
                                                <Table>
                                                    <TableHeader className="bg-amber-50/20">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-amber-900 text-xs">Data</TableHead>
                                                            <TableHead className="font-bold text-amber-900 text-xs">Item</TableHead>
                                                            <TableHead className="font-bold text-amber-900 text-xs">CA</TableHead>
                                                            <TableHead className="font-bold text-amber-900 text-xs text-center">Qtd</TableHead>
                                                            <TableHead className="font-bold text-amber-900 text-xs">Und</TableHead>
                                                            <TableHead className="font-bold text-amber-900 text-xs">M.E.R.</TableHead>
                                                            <TableHead className="text-right"></TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {draftDeliveries.map(d => (
                                                            <TableRow key={d.id} className="text-xs hover:bg-amber-50/10">
                                                                <TableCell className="font-bold text-slate-700">
                                                                    {d.deliveryDate.split("-").reverse().join("/")}
                                                                </TableCell>
                                                                <TableCell className="font-bold text-slate-800">
                                                                    {d.epiItem.name} {d.epiItem.size ? `(${d.epiItem.size})` : ""}
                                                                </TableCell>
                                                                <TableCell className="font-semibold text-slate-600">{d.epiItem.caNumber || "-"}</TableCell>
                                                                <TableCell className="font-black text-center text-slate-800">{d.quantity}</TableCell>
                                                                <TableCell className="text-slate-400">{d.epiItem.unit}</TableCell>
                                                                <TableCell className="font-medium text-slate-700">Cód. {d.merCode}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button
                                                                        type="button"
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        onClick={() => handleRemoveDraftDelivery(d.id)}
                                                                        className="h-7 w-7 text-amber-600 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Histórico existente (Saved) */}
                                    <div className="space-y-1.5">
                                        <Label className="font-black text-slate-800 text-xs block uppercase tracking-wider">Histórico de EPIs já Entregues</Label>
                                        <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                                            <Table>
                                                <TableHeader className="bg-slate-50/50">
                                                    <TableRow>
                                                        <TableHead className="font-bold text-slate-700 text-xs">Data</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-xs">Item</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-xs">CA</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-xs text-center">Qtd</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-xs">Und</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-xs">M.E.R.</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-xs">Entregue Por</TableHead>
                                                        <TableHead className="text-right"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {savedDeliveries.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={8} className="text-center text-slate-400 text-xs py-6">
                                                                Nenhum histórico de entrega cadastrado para este colaborador.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        savedDeliveries.map(d => {
                                                            const isSigned = d.recipientSignature === "ASSINADO" || (d.recipientSignature && d.recipientSignature.startsWith("ASSINADO_AUTENTIQUE_"));
                                                            const isSentAutentique = d.recipientSignature && d.recipientSignature.startsWith("ENVIADO_AUTENTIQUE_");
                                                            
                                                            return (
                                                                <TableRow key={d.id} className="hover:bg-slate-50/40 text-xs">
                                                                    <TableCell className="font-semibold text-slate-600">
                                                                        {new Date(d.deliveryDate).getUTCDate().toString().padStart(2, '0') + '/' + 
                                                                          (new Date(d.deliveryDate).getUTCMonth() + 1).toString().padStart(2, '0') + '/' + 
                                                                          new Date(d.deliveryDate).getUTCFullYear()}
                                                                    </TableCell>
                                                                    <TableCell className="font-bold text-slate-800">
                                                                        {d.epiItem.name} {d.epiItem.size ? `(${d.epiItem.size})` : ""}
                                                                    </TableCell>
                                                                    <TableCell className="font-semibold text-slate-600">{d.epiItem.caNumber || "-"}</TableCell>
                                                                    <TableCell className="font-black text-center text-slate-800">{d.quantity}</TableCell>
                                                                    <TableCell className="text-slate-400">{d.epiItem.unit}</TableCell>
                                                                    <TableCell className="font-medium">Cód. {d.merCode}</TableCell>
                                                                    <TableCell className="text-slate-500">
                                                                        {d.deliveredBy?.name || "Mesa"}
                                                                        {isSigned ? (
                                                                            <span className="ml-1 text-[8px] font-bold text-green-700 bg-green-50 px-1 rounded">Assinado</span>
                                                                        ) : isSentAutentique ? (
                                                                            <span className="ml-1 text-[8px] font-bold text-amber-700 bg-amber-50 px-1 rounded">Enviado</span>
                                                                        ) : (
                                                                            <span className="ml-1 text-[8px] font-bold text-red-700 bg-red-50 px-1 rounded">Pendente</span>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Button
                                                                            type="button"
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            onClick={() => handleDeleteSavedDelivery(d.id)}
                                                                            className="h-7 w-7 text-slate-400 hover:text-red-500 rounded-lg"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter className="border-t pt-4 mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
                        <div className="flex gap-2 w-full sm:w-auto">
                            {selectedEmployeeId && (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => window.open(`/admin/epi/print/${selectedEmployeeId}`, "_blank")}
                                        className="border-slate-200 hover:bg-slate-50 font-bold h-10 text-xs gap-1.5 flex-1 sm:flex-initial"
                                    >
                                        <Printer className="w-4 h-4 text-slate-500" /> Gerar Ficha / Imprimir
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => handleSendToAutentique(selectedEmployeeId)}
                                        disabled={sendingAutentique || savedDeliveries.length === 0}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 text-xs gap-1.5 flex-1 sm:flex-initial"
                                    >
                                        <Send className="w-4 h-4" /> Enviar p/ Assinatura (WhatsApp)
                                    </Button>
                                </>
                            )}
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto justify-end">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setIsDeliveryModalOpen(false)}
                                className="h-10 text-xs font-bold rounded-xl"
                            >
                                Fechar
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSaveAllDeliveries}
                                disabled={isSavingAll || !selectedEmployeeId || draftDeliveries.length === 0}
                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-10 text-xs gap-1.5 rounded-xl px-4"
                            >
                                <Save className="w-4 h-4" /> Salvar Lançamentos
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DIALOG FOR CREATING / EDITING STOCK ITEM */}
            <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
                <DialogContent className="max-w-[480px] rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-1">
                            <Package className="w-5 h-5 text-amber-500" /> {editingItem ? "Editar Item do Estoque" : "Cadastrar Novo Item no Estoque"}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveItem} className="space-y-4 mt-2">
                        <div className="space-y-1">
                            <Label htmlFor="itemName">Nome do Item / Descrição</Label>
                            <Input 
                                id="itemName" 
                                value={itemName} 
                                onChange={e => setItemName(e.target.value)} 
                                placeholder="Ex: Luva de Raspa, Camiseta Uniforme, etc." 
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="itemType">Tipo de Item</Label>
                                <Select value={itemType} onValueChange={setItemType}>
                                    <SelectTrigger id="itemType">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="EPI">EPI (Segurança)</SelectItem>
                                        <SelectItem value="UNIFORME">Uniforme</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="itemSize">Tamanho / Grade</Label>
                                <Input 
                                    id="itemSize" 
                                    value={itemSize} 
                                    onChange={e => setItemSize(e.target.value)} 
                                    placeholder="Ex: M, GG, 40 (opcional)" 
                                />
                            </div>
                        </div>
                        {itemType === "EPI" && (
                            <div className="space-y-1">
                                <Label htmlFor="itemCa">Certificado de Aprovação (C.A.)</Label>
                                <Input 
                                    id="itemCa" 
                                    value={itemCa} 
                                    onChange={e => setItemCa(e.target.value)} 
                                    placeholder="Ex: 45321 (Obrigatório para EPI)" 
                                />
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="itemUnit">Unidade de Medida</Label>
                                <Input 
                                    id="itemUnit" 
                                    value={itemUnit} 
                                    onChange={e => setItemUnit(e.target.value)} 
                                    placeholder="Ex: par, peça, un" 
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="itemStock">Estoque Atual</Label>
                                <Input 
                                    id="itemStock" 
                                    type="number" 
                                    min="0"
                                    value={itemStock} 
                                    onChange={e => setItemStock(e.target.value)} 
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="itemMinStock">Estoque Mínimo</Label>
                                <Input 
                                    id="itemMinStock" 
                                    type="number" 
                                    min="0"
                                    value={itemMinStock} 
                                    onChange={e => setItemMinStock(e.target.value)} 
                                />
                            </div>
                        </div>
                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsItemModalOpen(false)}>Cancelar</Button>
                            <Button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-bold">
                                {editingItem ? "Salvar Alterações" : "Cadastrar Item"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
