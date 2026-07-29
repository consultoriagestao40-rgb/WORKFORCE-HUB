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
    UserCheck,
    Search,
    AlertCircle
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { 
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
    
    // Main search for Stock items
    const [searchStock, setSearchStock] = useState("");

    // Employee Selection (Modals)
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
    const [searchEmp, setSearchEmp] = useState("");
    const [deliveries, setDeliveries] = useState<any[]>([]);
    
    // Sizes
    const [camiseta, setCamiseta] = useState("");
    const [calca, setCalca] = useState("");
    const [luvas, setLuvas] = useState("");
    const [sapato, setSapato] = useState("");
    const [savingSizes, setSavingSizes] = useState(false);

    // Modals Control
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
    const [isFichaModalOpen, setIsFichaModalOpen] = useState(false);

    // Stock item form states
    const [editingItem, setEditingItem] = useState<EpiItem | null>(null);
    const [itemName, setItemName] = useState("");
    const [itemType, setItemType] = useState("EPI");
    const [itemCa, setItemCa] = useState("");
    const [itemUnit, setItemUnit] = useState("unidade");
    const [itemStock, setItemStock] = useState("0");
    const [itemMinStock, setItemMinStock] = useState("0");
    const [itemSize, setItemSize] = useState("");

    // Delivery Form states
    const [deliveryItemId, setDeliveryItemId] = useState("");
    const [deliveryQty, setDeliveryQty] = useState("1");
    const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
    const [deliveryMer, setDeliveryMer] = useState("1");
    const [deliveryNotes, setDeliveryNotes] = useState("");
    const [registeringDelivery, setRegisteringDelivery] = useState(false);

    // Filter employees based on modal search
    const filteredEmployees = employees.filter(e => 
        e.name.toLowerCase().includes(searchEmp.toLowerCase()) || 
        (e.cpf && e.cpf.includes(searchEmp))
    );

    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

    // Filter stock items in main screen
    const filteredStockItems = epiItems.filter(item => 
        item.name.toLowerCase().includes(searchStock.toLowerCase()) ||
        (item.caNumber && item.caNumber.includes(searchStock))
    );

    // Load deliveries and sizes when employee is selected in any modal
    const handleSelectEmployee = async (empId: string) => {
        setSelectedEmployeeId(empId);
        if (!empId) {
            setDeliveries([]);
            return;
        }

        try {
            const list = await getEmployeeEpiDeliveries(empId);
            setDeliveries(list);

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

            toast.success("Tamanhos do colaborador atualizados com sucesso!");
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

    // Open delivery modal
    const handleOpenDeliveryModal = () => {
        setSelectedEmployeeId("");
        setSearchEmp("");
        setDeliveryItemId("");
        setDeliveryQty("1");
        setDeliveryNotes("");
        setIsDeliveryModalOpen(true);
    };

    // Open Ficha Modal
    const handleOpenFichaModal = () => {
        setSelectedEmployeeId("");
        setSearchEmp("");
        setDeliveries([]);
        setIsFichaModalOpen(true);
    };

    // Save delivery (runs within modal)
    const handleRegisterDelivery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployeeId) {
            toast.error("Por favor, selecione um colaborador.");
            return;
        }
        if (!deliveryItemId) {
            toast.error("Por favor, selecione o item de EPI/Uniforme.");
            return;
        }

        setRegisteringDelivery(true);
        try {
            // Save employee sizes first if edited
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

            // Register delivery
            await createEpiDelivery({
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

            toast.success("EPI entregue e lançado com sucesso!");
            setIsDeliveryModalOpen(false);
        } catch (e: any) {
            toast.error(e.message || "Erro ao registrar entrega.");
        } finally {
            setRegisteringDelivery(false);
        }
    };

    // Delete delivery (runs within Ficha modal)
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
                            <Shirt className="w-5 h-5 text-amber-500" /> Controle de Estoque (EPIs & Uniformes)
                        </CardTitle>
                        <CardDescription className="text-xs font-medium text-slate-500 mt-1">
                            Gerencie as quantidades do estoque de segurança de proteção individual e uniformes
                        </CardDescription>
                    </div>
                    
                    {/* Top Right Action Buttons */}
                    <div className="flex gap-2 flex-wrap">
                        <Button 
                            onClick={handleOpenFichaModal}
                            variant="outline"
                            className="border-slate-200 hover:bg-slate-50 font-bold h-10 px-4 rounded-xl text-xs gap-1.5"
                        >
                            <FileText className="w-4 h-4 text-slate-500" /> Visualizar Fichas de Entrega
                        </Button>
                        <Button 
                            onClick={handleOpenDeliveryModal}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-10 px-4 rounded-xl text-xs gap-1.5 shadow-sm"
                        >
                            <Plus className="w-4 h-4" /> Registrar Entrega
                        </Button>
                        <Button 
                            onClick={handleOpenCreateItem}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-10 px-4 rounded-xl text-xs gap-1.5"
                        >
                            <Plus className="w-4 h-4" /> Cadastrar Novo Item
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
                
                {/* Search Stock Filter */}
                <div className="flex items-center gap-2 max-w-[320px]">
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

                {/* Main Stock Table */}
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
                                        Nenhum item encontrado no estoque.
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
            </CardContent>

            {/* MODAL 1: REGISTRAR NOVA ENTREGA */}
            <Dialog open={isDeliveryModalOpen} onOpenChange={setIsDeliveryModalOpen}>
                <DialogContent className="max-w-[550px] rounded-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                            <Plus className="w-5 h-5 text-amber-500" /> Registrar Lançamento de Entrega
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleRegisterDelivery} className="space-y-4 mt-2">
                        
                        {/* Employee Search & Selection inside Modal */}
                        <div className="space-y-2">
                            <Label className="font-bold text-slate-700">Pesquisar Colaborador</Label>
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                <Input
                                    placeholder="Digite o nome ou CPF para filtrar..."
                                    value={searchEmp}
                                    onChange={(e) => setSearchEmp(e.target.value)}
                                    className="pl-9 h-9 text-xs rounded-xl border-slate-200"
                                />
                            </div>
                            <div className="border border-slate-100 rounded-xl max-h-[140px] overflow-y-auto p-1.5 bg-slate-50 space-y-1">
                                {filteredEmployees.length === 0 ? (
                                    <div className="text-slate-400 text-[10px] p-2 text-center">Nenhum colaborador encontrado</div>
                                ) : (
                                    filteredEmployees.map(emp => (
                                        <button
                                            key={emp.id}
                                            type="button"
                                            onClick={() => handleSelectEmployee(emp.id)}
                                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all ${
                                                selectedEmployeeId === emp.id 
                                                    ? "bg-slate-900 text-white font-bold shadow-sm" 
                                                    : "hover:bg-slate-200 text-slate-700"
                                            }`}
                                        >
                                            {emp.name} ({emp.cpf || "Sem CPF"}) | {emp.company?.name || "Sem Empresa"}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {selectedEmployeeId && (
                            <>
                                {/* Loaded employee Details */}
                                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] grid grid-cols-2 gap-2 text-slate-600">
                                    <div><strong>Empresa:</strong> {selectedEmployee?.company?.name || "SPOT Facilities"}</div>
                                    <div><strong>Cargo:</strong> {selectedEmployee?.assignments?.[0]?.posto?.role?.name || "Sem Posto"}</div>
                                    <div><strong>CPF:</strong> {selectedEmployee?.cpf}</div>
                                    <div>
                                        <strong>Admissão:</strong> {selectedEmployee?.admissionDate 
                                            ? new Date(selectedEmployee.admissionDate).getUTCDate().toString().padStart(2, '0') + '/' + 
                                              (new Date(selectedEmployee.admissionDate).getUTCMonth() + 1).toString().padStart(2, '0') + '/' + 
                                              new Date(selectedEmployee.admissionDate).getUTCFullYear()
                                            : "-"}
                                    </div>
                                </div>

                                {/* Sizes inputs in case they are missing or need updating */}
                                <div className="space-y-1.5">
                                    <Label className="font-bold text-slate-700 text-xs">Grade de Tamanhos (EPI / Uniforme)</Label>
                                    <div className="grid grid-cols-4 gap-2">
                                        <div>
                                            <Label className="text-[9px] text-slate-500">Camiseta</Label>
                                            <Input value={camiseta} onChange={e => setCamiseta(e.target.value)} placeholder="Ex: G" className="h-8 text-xs rounded-lg border-slate-200" />
                                        </div>
                                        <div>
                                            <Label className="text-[9px] text-slate-500">Calça</Label>
                                            <Input value={calca} onChange={e => setCalca(e.target.value)} placeholder="Ex: 42" className="h-8 text-xs rounded-lg border-slate-200" />
                                        </div>
                                        <div>
                                            <Label className="text-[9px] text-slate-500">Luvas</Label>
                                            <Input value={luvas} onChange={e => setLuvas(e.target.value)} placeholder="Ex: M" className="h-8 text-xs rounded-lg border-slate-200" />
                                        </div>
                                        <div>
                                            <Label className="text-[9px] text-slate-500">Calçado</Label>
                                            <Input value={sapato} onChange={e => setSapato(e.target.value)} placeholder="Ex: 40" className="h-8 text-xs rounded-lg border-slate-200" />
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px bg-slate-100 my-1" />

                                {/* Delivery Info */}
                                <div className="space-y-1">
                                    <Label htmlFor="deliveryItem">Selecionar Item do Estoque</Label>
                                    <Select value={deliveryItemId} onValueChange={setDeliveryItemId}>
                                        <SelectTrigger id="deliveryItem">
                                            <SelectValue placeholder="Selecione o EPI/Uniforme" />
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
                            </>
                        )}
                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsDeliveryModalOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={registeringDelivery || !selectedEmployeeId} className="bg-amber-500 hover:bg-amber-600 text-white font-bold">
                                Confirmar Lançamento & Salvar
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL 2: VISUALIZAR FICHAS DE ENTREGA */}
            <Dialog open={isFichaModalOpen} onOpenChange={setIsFichaModalOpen}>
                <DialogContent className="max-w-[700px] rounded-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                            <FileText className="w-5 h-5 text-amber-500" /> Consultar / Imprimir Ficha de EPI
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 mt-2">
                        {/* Search Employee inside Ficha Modal */}
                        <div className="space-y-2">
                            <Label className="font-bold text-slate-700">Pesquisar Colaborador</Label>
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                <Input
                                    placeholder="Digite o nome ou CPF..."
                                    value={searchEmp}
                                    onChange={(e) => setSearchEmp(e.target.value)}
                                    className="pl-9 h-9 text-xs rounded-xl border-slate-200"
                                />
                            </div>
                            <div className="border border-slate-100 rounded-xl max-h-[120px] overflow-y-auto p-1.5 bg-slate-50 space-y-1">
                                {filteredEmployees.length === 0 ? (
                                    <div className="text-slate-400 text-[10px] p-2 text-center">Nenhum colaborador encontrado</div>
                                ) : (
                                    filteredEmployees.map(emp => (
                                        <button
                                            key={emp.id}
                                            type="button"
                                            onClick={() => handleSelectEmployee(emp.id)}
                                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all ${
                                                selectedEmployeeId === emp.id 
                                                    ? "bg-slate-900 text-white font-bold" 
                                                    : "hover:bg-slate-200 text-slate-700"
                                            }`}
                                        >
                                            {emp.name} ({emp.cpf || "Sem CPF"})
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {selectedEmployeeId && (
                            <>
                                {/* Loaded Profile info */}
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl grid grid-cols-2 gap-3 text-xs text-slate-700">
                                    <div><strong>Nome do Trabalhador:</strong> {selectedEmployee?.name}</div>
                                    <div><strong>CPF:</strong> {selectedEmployee?.cpf}</div>
                                    <div><strong>Empresa:</strong> {selectedEmployee?.company?.name || "SPOT Facilities"}</div>
                                    <div>
                                        <strong>Tamanhos:</strong> Camiseta ({camiseta || "-"}) | Calça ({calca || "-"}) | Luvas ({luvas || "-"}) | Sapato ({sapato || "-"})
                                    </div>
                                    <div className="col-span-2 flex justify-end gap-2 pt-2">
                                        {/* Print Action */}
                                        <Button
                                            onClick={() => window.open(`/admin/epi/print/${selectedEmployeeId}`, "_blank")}
                                            variant="outline"
                                            size="sm"
                                            className="border-slate-200 rounded-lg text-[11px] font-bold h-8 gap-1"
                                        >
                                            <Printer className="w-3.5 h-3.5 text-slate-500" /> Imprimir Ficha Oficial
                                        </Button>
                                    </div>
                                </div>

                                {/* Employee Deliveries Table */}
                                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white mt-4">
                                    <Table>
                                        <TableHeader className="bg-slate-50/50">
                                            <TableRow>
                                                <TableHead className="font-bold text-slate-700 text-xs">Data</TableHead>
                                                <TableHead className="font-bold text-slate-700 text-xs">Item</TableHead>
                                                <TableHead className="font-bold text-slate-700 text-xs">CA</TableHead>
                                                <TableHead className="font-bold text-slate-700 text-xs text-center">Qtd</TableHead>
                                                <TableHead className="font-bold text-slate-700 text-xs">Und</TableHead>
                                                <TableHead className="font-bold text-slate-700 text-xs">MER</TableHead>
                                                <TableHead className="text-right"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {deliveries.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center text-slate-400 text-xs py-6">
                                                        Nenhuma entrega registrada para este colaborador.
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
                                                        <TableCell className="font-bold text-slate-850">
                                                            {d.epiItem.name} {d.epiItem.size ? `(${d.epiItem.size})` : ""}
                                                        </TableCell>
                                                        <TableCell className="text-slate-500 font-medium">{d.epiItem.caNumber || "-"}</TableCell>
                                                        <TableCell className="font-black text-center text-slate-800">{d.quantity}</TableCell>
                                                        <TableCell className="text-slate-400">{d.epiItem.unit}</TableCell>
                                                        <TableCell className="font-medium">Cód. {d.merCode}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                onClick={() => handleDeleteDelivery(d.id)}
                                                                className="h-7 w-7 text-slate-400 hover:text-red-500 rounded-lg"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
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
