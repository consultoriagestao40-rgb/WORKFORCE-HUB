"use client";

import { useState } from "react";
import { 
    Shirt, 
    Plus, 
    Trash2, 
    Printer, 
    Scale, 
    Settings, 
    FileText, 
    Save, 
    Edit, 
    Package, 
    UserCheck,
    Search
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
    DialogTrigger, 
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
    getEpiItems, 
    createEpiItem, 
    updateEpiItem, 
    deleteEpiItem, 
    getEmployeeEpiDeliveries, 
    createEpiDelivery, 
    deleteEpiDelivery,
    updateEmployeeSizes
} from "@/actions/epi";

interface EmployeeItem {
    id: string;
    name: string;
    cpf: string | null;
    admissionDate: Date | string | null;
    extraFields: any;
    company: { name: string } | null;
    assignments: Array<{
        posto: {
            role: { name: string } | null;
        } | null;
    }>;
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
}

export function EpiDashboard({ initialEmployees, initialEpiItems }: EpiDashboardProps) {
    const [employees, setEmployees] = useState<EmployeeItem[]>(initialEmployees);
    const [epiItems, setEpiItems] = useState<EpiItem[]>(initialEpiItems);
    
    // Active tabs: "ficha" or "estoque"
    const [activeTab, setActiveTab] = useState("ficha");

    // Employee Selection
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
    const [searchEmp, setSearchEmp] = useState("");
    const [deliveries, setDeliveries] = useState<any[]>([]);
    
    // Sizes
    const [camiseta, setCamiseta] = useState("");
    const [calca, setCalca] = useState("");
    const [luvas, setLuvas] = useState("");
    const [sapato, setSapato] = useState("");
    const [savingSizes, setSavingSizes] = useState(false);

    // Modal forms states
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<EpiItem | null>(null);
    const [itemName, setItemName] = useState("");
    const [itemType, setItemType] = useState("EPI");
    const [itemCa, setItemCa] = useState("");
    const [itemUnit, setItemUnit] = useState("unidade");
    const [itemStock, setItemStock] = useState("0");
    const [itemMinStock, setItemMinStock] = useState("0");
    const [itemSize, setItemSize] = useState("");

    // Delivery Modal form states
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
    const [deliveryItemId, setDeliveryItemId] = useState("");
    const [deliveryQty, setDeliveryQty] = useState("1");
    const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
    const [deliveryMer, setDeliveryMer] = useState("1");
    const [deliveryNotes, setDeliveryNotes] = useState("");
    const [registeringDelivery, setRegisteringDelivery] = useState(false);

    // Filter employees based on search
    const filteredEmployees = employees.filter(e => 
        e.name.toLowerCase().includes(searchEmp.toLowerCase()) || 
        (e.cpf && e.cpf.includes(searchEmp))
    );

    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

    // Load deliveries and sizes when employee is selected
    const handleSelectEmployee = async (empId: string) => {
        setSelectedEmployeeId(empId);
        if (!empId) {
            setDeliveries([]);
            return;
        }

        try {
            const list = await getEmployeeEpiDeliveries(empId);
            setDeliveries(list);

            // Populate sizes
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

    // Save sizes to db
    const handleSaveSizes = async () => {
        if (!selectedEmployeeId) return;
        setSavingSizes(true);
        try {
            await updateEmployeeSizes(selectedEmployeeId, {
                camiseta,
                calca,
                luvas,
                sapato
            });
            
            // Update local state
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

            toast.success("Tamanhos atualizados com sucesso!");
        } catch (e: any) {
            toast.error(e.message || "Erro ao salvar tamanhos.");
        } finally {
            setSavingSizes(false);
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

    // Save delivery
    const handleRegisterDelivery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deliveryItemId) {
            toast.error("Selecione o item de EPI/Uniforme.");
            return;
        }

        setRegisteringDelivery(true);
        try {
            const res = await createEpiDelivery({
                employeeId: selectedEmployeeId,
                epiItemId: deliveryItemId,
                quantity: parseInt(deliveryQty) || 1,
                deliveryDate,
                merCode: parseInt(deliveryMer) || 1,
                notes: deliveryNotes
            });

            // Update local stock list quantity
            setEpiItems(prev => prev.map(i => {
                if (i.id === deliveryItemId) {
                    return { ...i, stockQuantity: i.stockQuantity - (parseInt(deliveryQty) || 1) };
                }
                return i;
            }));

            // Refresh deliveries
            const list = await getEmployeeEpiDeliveries(selectedEmployeeId);
            setDeliveries(list);

            toast.success("EPI entregue e lançado na ficha!");
            setIsDeliveryModalOpen(false);
            setDeliveryItemId("");
            setDeliveryQty("1");
            setDeliveryNotes("");
        } catch (e: any) {
            toast.error(e.message || "Erro ao registrar entrega.");
        } finally {
            setRegisteringDelivery(false);
        }
    };

    // Delete delivery
    const handleDeleteDelivery = async (id: string) => {
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

            setDeliveries(prev => prev.filter(d => d.id !== id));
            toast.success("Entrega cancelada e estoque estornado!");
        } catch (e: any) {
            toast.error(e.message || "Erro ao cancelar entrega.");
        }
    };

    return (
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100/80 px-8 py-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Shirt className="w-5 h-5 text-amber-500" /> Movimentação de EPI & Uniformes
                        </CardTitle>
                        <CardDescription className="text-xs font-medium text-slate-500 mt-1">
                            Monitore a ficha de EPIs assinada por colaborador e o controle do estoque de segurança
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid grid-cols-2 max-w-[400px] bg-slate-100 rounded-xl p-1">
                        <TabsTrigger value="ficha" className="rounded-lg text-xs font-bold py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <UserCheck className="w-4 h-4 mr-1.5" /> Ficha de Entrega
                        </TabsTrigger>
                        <TabsTrigger value="estoque" className="rounded-lg text-xs font-bold py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <Package className="w-4 h-4 mr-1.5" /> Estoque (EPI/Uniforme)
                        </TabsTrigger>
                    </TabsList>

                    {/* TAB: FICHA DE ENTREGA */}
                    <TabsContent value="ficha" className="space-y-6 border-none p-0 outline-none">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            
                            {/* Left panel: Employee selector */}
                            <div className="lg:col-span-1 space-y-4">
                                <Label className="font-bold text-slate-700 block">Selecionar Colaborador</Label>
                                <div className="relative">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                    <Input 
                                        placeholder="Pesquisar por nome/CPF..." 
                                        value={searchEmp} 
                                        onChange={(e) => setSearchEmp(e.target.value)} 
                                        className="pl-9 h-9 text-xs rounded-xl border-slate-200"
                                    />
                                </div>
                                <div className="border border-slate-100 rounded-2xl max-h-[350px] overflow-y-auto bg-slate-50/50 p-2 space-y-1">
                                    {filteredEmployees.length === 0 ? (
                                        <div className="text-slate-400 text-[11px] p-4 text-center">Nenhum colaborador encontrado</div>
                                    ) : (
                                        filteredEmployees.map(emp => (
                                            <button
                                                key={emp.id}
                                                type="button"
                                                onClick={() => handleSelectEmployee(emp.id)}
                                                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex flex-col gap-0.5 ${
                                                    selectedEmployeeId === emp.id 
                                                        ? "bg-slate-900 text-white font-bold" 
                                                        : "hover:bg-slate-100 text-slate-700"
                                                }`}
                                            >
                                                <span className="font-bold truncate">{emp.name}</span>
                                                <span className={`text-[10px] ${selectedEmployeeId === emp.id ? "text-slate-400" : "text-slate-500"}`}>
                                                    CPF: {emp.cpf || "Sem CPF"} | {emp.company?.name || "Sem Empresa"}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Right panel: Employee file Details & assigned list */}
                            <div className="lg:col-span-3 space-y-6">
                                {!selectedEmployeeId ? (
                                    <div className="h-[300px] border border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 gap-2">
                                        <UserCheck className="w-10 h-10 text-slate-300" />
                                        <span className="text-xs font-semibold">Selecione um colaborador na barra lateral para carregar a ficha</span>
                                    </div>
                                ) : (
                                    <>
                                        {/* Profile Card */}
                                        <Card className="border border-slate-100 shadow-none rounded-2xl bg-slate-50/30">
                                            <CardContent className="p-6">
                                                <h3 className="font-bold text-slate-800 text-[15px] mb-4 flex items-center gap-1.5">
                                                    <FileText className="w-4 h-4 text-amber-500" /> Ficha Cadastral (Dados de Vínculo)
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                                    <div>
                                                        <span className="text-slate-400 block mb-0.5">Empresa</span>
                                                        <strong className="text-slate-700 font-bold">{selectedEmployee?.company?.name || "Sem Empresa"}</strong>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 block mb-0.5">Nome do Trabalhador</span>
                                                        <strong className="text-slate-700 font-bold">{selectedEmployee?.name}</strong>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 block mb-0.5">CPF</span>
                                                        <strong className="text-slate-700 font-bold">{selectedEmployee?.cpf || "Não informado"}</strong>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 block mb-0.5">Função (Cargo)</span>
                                                        <strong className="text-slate-700 font-bold">
                                                            {selectedEmployee?.assignments?.[0]?.posto?.role?.name || "Sem Posto"}
                                                        </strong>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 block mb-0.5">Data de Admissão</span>
                                                        <strong className="text-slate-700 font-bold">
                                                            {selectedEmployee?.admissionDate 
                                                                ? new Date(selectedEmployee.admissionDate).getUTCDate().toString().padStart(2, '0') + '/' + 
                                                                  (new Date(selectedEmployee.admissionDate).getUTCMonth() + 1).toString().padStart(2, '0') + '/' + 
                                                                  new Date(selectedEmployee.admissionDate).getUTCFullYear()
                                                                : "Não informada"}
                                                        </strong>
                                                    </div>
                                                </div>

                                                <div className="h-px bg-slate-100 my-4" />

                                                <h4 className="font-bold text-slate-800 text-xs mb-3">Grade de Tamanhos (EPI / Uniformes)</h4>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-slate-500 font-medium text-[10px]">Camiseta</Label>
                                                        <Input value={camiseta} onChange={e => setCamiseta(e.target.value)} placeholder="Ex: G, GG" className="h-8 text-xs rounded-lg border-slate-200" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-slate-500 font-medium text-[10px]">Calça</Label>
                                                        <Input value={calca} onChange={e => setCalca(e.target.value)} placeholder="Ex: 42" className="h-8 text-xs rounded-lg border-slate-200" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-slate-500 font-medium text-[10px]">Luvas</Label>
                                                        <Input value={luvas} onChange={e => setLuvas(e.target.value)} placeholder="Ex: M" className="h-8 text-xs rounded-lg border-slate-200" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-slate-500 font-medium text-[10px]">Calçado (Sapato)</Label>
                                                        <Input value={sapato} onChange={e => setSapato(e.target.value)} placeholder="Ex: 40" className="h-8 text-xs rounded-lg border-slate-200" />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end mt-3">
                                                    <Button 
                                                        onClick={handleSaveSizes} 
                                                        disabled={savingSizes}
                                                        size="sm" 
                                                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold gap-1 rounded-xl h-8 text-[11px]"
                                                    >
                                                        <Save className="w-3.5 h-3.5" /> Salvar Grade de Tamanhos
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* List and Actions */}
                                        <div className="flex items-center justify-between gap-4">
                                            <h3 className="font-black text-slate-800 text-base">EPIs & Uniformes Entregues</h3>
                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={() => window.open(`/admin/epi/print/${selectedEmployeeId}`, "_blank")}
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-slate-200 rounded-xl h-9 font-bold text-xs gap-1.5 hover:bg-slate-50"
                                                >
                                                    <Printer className="w-4 h-4 text-slate-500" /> Visualizar Ficha de Entrega
                                                </Button>
                                                
                                                <Dialog open={isDeliveryModalOpen} onOpenChange={setIsDeliveryModalOpen}>
                                                    <DialogTrigger asChild>
                                                        <Button 
                                                            size="sm" 
                                                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl h-9 text-xs gap-1.5"
                                                        >
                                                            <Plus className="w-4 h-4" /> Registrar Nova Entrega
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-[480px] rounded-3xl">
                                                        <DialogHeader>
                                                            <DialogTitle className="text-base font-bold text-slate-800">
                                                                Entregar Equipamento / Uniforme
                                                            </DialogTitle>
                                                        </DialogHeader>
                                                        <form onSubmit={handleRegisterDelivery} className="space-y-4 mt-2">
                                                            <div className="space-y-1">
                                                                <Label htmlFor="deliveryItem">Selecionar Item do Estoque</Label>
                                                                <Select value={deliveryItemId} onValueChange={setDeliveryItemId}>
                                                                    <SelectTrigger id="deliveryItem">
                                                                        <SelectValue placeholder="Selecione o EPI/Uniforme" />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="max-h-[220px]">
                                                                        {epiItems.map(item => (
                                                                            <SelectItem key={item.id} value={item.id} disabled={item.stockQuantity <= 0}>
                                                                                {item.name} {item.size ? `(${item.size})` : ""} - Tipo: {item.type} | Saldo: {item.stockQuantity}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-1">
                                                                    <Label htmlFor="deliveryQty">Quantidade</Label>
                                                                    <Input 
                                                                        id="deliveryQty" 
                                                                        type="number" 
                                                                        min="1" 
                                                                        value={deliveryQty} 
                                                                        onChange={e => setDeliveryQty(e.target.value)} 
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Label htmlFor="deliveryDate">Data da Entrega</Label>
                                                                    <Input 
                                                                        id="deliveryDate" 
                                                                        type="date" 
                                                                        value={deliveryDate} 
                                                                        onChange={e => setDeliveryDate(e.target.value)} 
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label htmlFor="deliveryMer">M.E.R (Motivo da Entrega/Recebimento)</Label>
                                                                <Select value={deliveryMer} onValueChange={setDeliveryMer}>
                                                                    <SelectTrigger id="deliveryMer">
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
                                                                <Label htmlFor="deliveryNotes">Observações (opcional)</Label>
                                                                <Input 
                                                                    id="deliveryNotes" 
                                                                    value={deliveryNotes} 
                                                                    onChange={e => setDeliveryNotes(e.target.value)} 
                                                                    placeholder="Ex: Tamanho ajustado, dano verificado, etc."
                                                                />
                                                            </div>
                                                            <DialogFooter className="pt-2">
                                                                <Button type="button" variant="outline" onClick={() => setIsDeliveryModalOpen(false)}>Cancelar</Button>
                                                                <Button type="submit" disabled={registeringDelivery} className="bg-amber-500 hover:bg-amber-600 text-white font-bold">
                                                                    Confirmar Entrega
                                                                </Button>
                                                            </DialogFooter>
                                                        </form>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>

                                        {/* Table of deliveries */}
                                        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                                            <Table>
                                                <TableHeader className="bg-slate-50/50">
                                                    <TableRow>
                                                        <TableHead className="font-bold text-slate-700 text-xs">Data da Entrega</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-xs">Tipo</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-xs">Item</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-xs">CA</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-xs text-center">Quant.</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-xs">Unidade</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-xs">M.E.R</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-xs">Entregue Por</TableHead>
                                                        <TableHead className="text-right"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {deliveries.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={9} className="text-center text-slate-400 text-xs py-8">
                                                                Nenhum EPI ou uniforme entregue para este colaborador.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        deliveries.map(d => (
                                                            <TableRow key={d.id} className="hover:bg-slate-50/40 text-xs">
                                                                <TableCell className="font-semibold text-slate-600">
                                                                    {new Date(d.deliveryDate).getUTCDate().toString().padStart(2, '0') + '/' + 
                                                                      (new Date(d.deliveryDate).getUTCMonth() + 1).toString().padStart(2, '0') + '/' + 
                                                                      new Date(d.deliveryDate).getUTCFullYear()}
                                                                </TableCell>
                                                                <TableCell className="font-medium">
                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                                        d.epiItem.type === "EPI" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                                                                    }`}>
                                                                        {d.epiItem.type}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="font-bold text-slate-800">
                                                                    {d.epiItem.name} {d.epiItem.size ? `(${d.epiItem.size})` : ""}
                                                                </TableCell>
                                                                <TableCell className="font-medium text-slate-500">
                                                                    {d.epiItem.caNumber || "-"}
                                                                </TableCell>
                                                                <TableCell className="font-black text-center text-slate-800">
                                                                    {d.quantity}
                                                                </TableCell>
                                                                <TableCell className="text-slate-500 font-medium">{d.epiItem.unit}</TableCell>
                                                                <TableCell className="font-semibold text-slate-700">
                                                                    Código {d.merCode}
                                                                </TableCell>
                                                                <TableCell className="text-slate-600 font-medium">
                                                                    {d.deliveredBy?.name || "Desconhecido"}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button
                                                                        type="button"
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        onClick={() => handleDeleteDelivery(d.id)}
                                                                        className="h-8 w-8 text-slate-400 hover:text-red-500 rounded-lg"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* TAB: ESTOQUE */}
                    <TabsContent value="estoque" className="space-y-6 border-none p-0 outline-none">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Catálogo & Controle de Estoque</h3>
                                <p className="text-slate-400 text-xs mt-0.5">Cadastre os equipamentos, tamanhos, números CA de segurança e gerencie as quantidades em posse</p>
                            </div>
                            <Button 
                                onClick={handleOpenCreateItem}
                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold gap-1.5 rounded-xl h-9 text-xs"
                            >
                                <Plus className="w-4 h-4" /> Cadastrar Novo Item
                            </Button>
                        </div>

                        {/* Inventory Table */}
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
                                    {epiItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center text-slate-400 text-xs py-8">
                                                Nenhum item cadastrado no estoque de EPIs & Uniformes.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        epiItems.map(item => {
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
                </Tabs>
            </CardContent>

            {/* DIALOG FOR CREATING / EDITING STOCK ITEM */}
            <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
                <DialogContent className="max-w-[480px] rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-slate-800">
                            {editingItem ? "Editar Item do Estoque" : "Cadastrar Item no Estoque"}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveItem} className="space-y-4 mt-2">
                        <div className="space-y-1">
                            <Label htmlFor="itemName">Nome do Item / Descrição</Label>
                            <Input 
                                id="itemName" 
                                value={itemName} 
                                onChange={e => setItemName(e.target.value)} 
                                placeholder="Ex: Luva de Raspa, Camiseta Uniforme M, etc." 
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
                                    placeholder="Ex: M, GG, 40, etc. (opcional)" 
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
