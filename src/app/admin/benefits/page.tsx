"use client";

import { useState, useEffect } from "react";
import { 
    DollarSign, 
    CreditCard, 
    Bus, 
    Utensils, 
    AlertCircle, 
    Download, 
    Settings, 
    Search, 
    Calendar, 
    CheckCircle2, 
    XCircle,
    UserCheck,
    Clock,
    RefreshCw,
    FileSpreadsheet,
    Info,
    Check,
    AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { getBenefitsCalculation, updateBenefitsConfig, markBenefitAsPaid, getSystemUsers, markMultipleBenefitsAsPaid, BenefitsCalculationItem } from "@/actions/benefits";
import { syncSecullumOccurrences, testSecullumConnectionAction } from "@/actions/secullum";

export default function BenefitsPage() {
    const today = new Date();
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);

    const [isLoading, setIsLoading] = useState(true);
    const [isSyncingSecullum, setIsSyncingSecullum] = useState(false);
    const [isTestingSecullum, setIsTestingSecullum] = useState(false);

    const [items, setItems] = useState<BenefitsCalculationItem[]>([]);
    const [config, setConfig] = useState<any>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterOption, setFilterOption] = useState<"ALL" | "VT_ONLY" | "VA_ONLY" | "NON_VT" | "PAID" | "PENDING">("ALL");
    const [activeTab, setActiveTab] = useState<"BUY" | "ALERTS" | "CONFIG">("BUY");

    // Config Modal State
    const [configModalOpen, setConfigModalOpen] = useState(false);
    const [configFormData, setConfigFormData] = useState({
        payrollCutoffStartDay: 26,
        payrollCutoffEndDay: 25,
        payrollPaymentDay: 5,
        vtFractionDays: 5,
        vaFractionDays: 10,
        vaCardDeliveryEstimateDays: 10,
        secullumApiUrl: "https://pontowebintegracaoexterna.secullum.com.br",
        secullumEmail: "",
        secullumPassword: "",
        secullumCompanyId: "",
        alertUserId: ""
    });

    // Payment Modal State
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedItemForPayment, setSelectedItemForPayment] = useState<BenefitsCalculationItem | null>(null);
    const [paymentNotes, setPaymentNotes] = useState("");
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

    // Occurrences List Modal State
    const [occurrencesModalOpen, setOccurrencesModalOpen] = useState(false);

    // System Users & Alert States
    const [systemUsers, setSystemUsers] = useState<{ id: string; name: string; email: string | null }[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [fractionedAlertModalOpen, setFractionedAlertModalOpen] = useState(false);

    // Batch Payment & Selection States
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [batchPaymentModalOpen, setBatchPaymentModalOpen] = useState(false);
    const [batchPaymentNotes, setBatchPaymentNotes] = useState("");
    const [isSubmittingBatchPayment, setIsSubmittingBatchPayment] = useState(false);

    useEffect(() => {
        setSelectedEmployeeIds([]);
    }, [activeTab, filterOption, searchTerm, selectedMonth, selectedYear]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await getBenefitsCalculation(selectedYear, selectedMonth);
            setItems(res.items || []);
            setConfig(res.config);
            setCurrentUserId(res.currentUserId || null);

            // Fetch system users for selection dropdown
            const users = await getSystemUsers();
            setSystemUsers(users || []);

            if (res.config) {
                let emailVal = "";
                let pwdVal = "";
                const tokenVal = res.config.secullumApiToken || "";
                if (tokenVal.includes(":")) {
                    const idx = tokenVal.lastIndexOf(":");
                    emailVal = tokenVal.substring(0, idx);
                    pwdVal = tokenVal.substring(idx + 1);
                } else {
                    emailVal = tokenVal;
                }

                setConfigFormData({
                    payrollCutoffStartDay: res.config.payrollCutoffStartDay,
                    payrollCutoffEndDay: res.config.payrollCutoffEndDay,
                    payrollPaymentDay: res.config.payrollPaymentDay,
                    vtFractionDays: res.config.vtFractionDays,
                    vaFractionDays: res.config.vaFractionDays,
                    vaCardDeliveryEstimateDays: res.config.vaCardDeliveryEstimateDays,
                    secullumApiUrl: res.config.secullumApiUrl || "https://pontowebintegracaoexterna.secullum.com.br",
                    secullumEmail: emailVal,
                    secullumPassword: pwdVal,
                    secullumCompanyId: res.config.secullumCompanyId || "",
                    alertUserId: res.config.alertUserId || ""
                });
            }
        } catch (err: any) {
            toast.error("Erro ao carregar cálculos de benefícios.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedYear, selectedMonth]);

    const [hasCheckedAutoAlert, setHasCheckedAutoAlert] = useState(false);

    useEffect(() => {
        if (!isLoading && items.length > 0 && config && currentUserId && !hasCheckedAutoAlert) {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const parseDdmmyyyy = (str: string | undefined): Date | null => {
                if (!str) return null;
                const parts = str.split('/');
                if (parts.length !== 3) return null;
                return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            };

            const dueTodayCount = items.filter(item => {
                if (item.isPaid) return false;
                if (!item.vtNeedsAlert && !item.vaNeedsAlert) return false;
                const dueDate = parseDdmmyyyy(item.nextPaymentDueDate);
                return dueDate !== null && dueDate <= todayStart;
            }).length;

            if (dueTodayCount > 0 && config.alertUserId === currentUserId) {
                setFractionedAlertModalOpen(true);
            }
            setHasCheckedAutoAlert(true);
        }
    }, [isLoading, items, config, currentUserId, hasCheckedAutoAlert]);

    const exportFractionedDueTodayToExcel = () => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const parseDdmmyyyy = (str: string | undefined): Date | null => {
            if (!str) return null;
            const parts = str.split('/');
            if (parts.length !== 3) return null;
            return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        };

        const dueToday = items.filter(item => {
            if (item.isPaid) return false;
            if (!item.vtNeedsAlert && !item.vaNeedsAlert) return false;
            const dueDate = parseDdmmyyyy(item.nextPaymentDueDate);
            return dueDate !== null && dueDate <= todayStart;
        });

        if (dueToday.length === 0) {
            toast.error("Nenhum pagamento pendente para hoje.");
            return;
        }

        let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#EF4444" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Currency">
   <NumberFormat ss:Format="R$#,##0.00"/>
  </Style>
  <Style ss:ID="Center">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
 </Styles>
  <Worksheet ss:Name="Lotes para Hoje">
   <Table>
    <Row ss:Height="24" ss:StyleID="Header">
     <Cell><Data ss:Type="String">Colaborador</Data></Cell>
     <Cell><Data ss:Type="String">CPF</Data></Cell>
     <Cell><Data ss:Type="String">Posto</Data></Cell>
     <Cell><Data ss:Type="String">Cliente</Data></Cell>
     <Cell><Data ss:Type="String">Próximo Vencimento</Data></Cell>
     <Cell><Data ss:Type="String">VT Lote (R$)</Data></Cell>
     <Cell><Data ss:Type="String">Destino VT</Data></Cell>
     <Cell><Data ss:Type="String">VA Lote (R$)</Data></Cell>
     <Cell><Data ss:Type="String">Destino VA</Data></Cell>
    </Row>`;

        dueToday.forEach(item => {
            xml += `
    <Row>
     <Cell><Data ss:Type="String">${item.employeeName}</Data></Cell>
     <Cell><Data ss:Type="String">${item.employeeCpf}</Data></Cell>
     <Cell><Data ss:Type="String">${item.postoName}</Data></Cell>
     <Cell><Data ss:Type="String">${item.clientName}</Data></Cell>
     <Cell ss:StyleID="Center"><Data ss:Type="String">${item.nextPaymentDueDate}</Data></Cell>
     <Cell ss:StyleID="Currency"><Data ss:Type="Number">${item.vtNeedsAlert ? item.vtTotalValue : 0}</Data></Cell>
     <Cell><Data ss:Type="String">${item.vtDestination}</Data></Cell>
     <Cell ss:StyleID="Currency"><Data ss:Type="Number">${item.vaNeedsAlert ? item.vaTotalValue : 0}</Data></Cell>
     <Cell><Data ss:Type="String">${item.vaDestination}</Data></Cell>
    </Row>`;
        });

        xml += `
   </Table>
  </Worksheet>
</Workbook>`;

        const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `pagamentos_fracionados_hoje_${selectedYear}_${selectedMonth}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Relação de pagamentos de hoje exportada com sucesso!");
    };

    const handleConfigSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const tokenValue = `${configFormData.secullumEmail.trim()}:${configFormData.secullumPassword}`;
            const res = await updateBenefitsConfig({
                payrollCutoffStartDay: configFormData.payrollCutoffStartDay,
                payrollCutoffEndDay: configFormData.payrollCutoffEndDay,
                payrollPaymentDay: configFormData.payrollPaymentDay,
                vtFractionDays: configFormData.vtFractionDays,
                vaFractionDays: configFormData.vaFractionDays,
                vaCardDeliveryEstimateDays: configFormData.vaCardDeliveryEstimateDays,
                secullumApiUrl: configFormData.secullumApiUrl,
                secullumApiToken: tokenValue,
                secullumCompanyId: configFormData.secullumCompanyId,
                alertUserId: configFormData.alertUserId
            });
            if (res.success) {
                toast.success("Configurações de benefícios salvas com sucesso!");
                setConfigModalOpen(false);
                loadData();
            }
        } catch (err: any) {
            toast.error(err.message || "Erro ao salvar configurações.");
        }
    };

    const handleSyncSecullum = async () => {
        setIsSyncingSecullum(true);
        try {
            const res = await syncSecullumOccurrences(selectedYear, selectedMonth);
            if (res.success) {
                toast.success(res.message);
                loadData();
            } else {
                toast.error(res.message);
            }
        } catch (err: any) {
            toast.error(err.message || "Erro ao sincronizar com o Secullum.");
        } finally {
            setIsSyncingSecullum(false);
        }
    };

    const handleTestSecullum = async () => {
        setIsTestingSecullum(true);
        try {
            const tokenValue = `${configFormData.secullumEmail.trim()}:${configFormData.secullumPassword}`;
            const res = await testSecullumConnectionAction(
                configFormData.secullumApiUrl,
                tokenValue,
                configFormData.secullumCompanyId
            );
            if (res.success) {
                toast.success(res.message);
            } else {
                toast.error(res.message);
            }
        } catch (err: any) {
            toast.error(err.message || "Falha ao testar conexão.");
        } finally {
            setIsTestingSecullum(false);
        }
    };

    const handleMarkAsPaid = async () => {
        if (!selectedItemForPayment) return;
        setIsSubmittingPayment(true);
        try {
            await markBenefitAsPaid({
                employeeId: selectedItemForPayment.employeeId,
                month: selectedMonth,
                year: selectedYear,
                benefitType: "AMBOS",
                vtAmount: selectedItemForPayment.vtOptIn ? selectedItemForPayment.vtTotalValue : 0,
                vaAmount: selectedItemForPayment.vaTotalValue,
                notes: paymentNotes
            });
            toast.success(`Benefício de ${selectedItemForPayment.employeeName} marcado como PAGO!`);
            setPaymentModalOpen(false);
            setSelectedItemForPayment(null);
            setPaymentNotes("");
            loadData();
        } catch (err: any) {
            toast.error(err.message || "Erro ao registrar pagamento.");
        } finally {
            setIsSubmittingPayment(false);
        }
    };

    const handleBatchPaymentSubmit = async () => {
        if (selectedEmployeeIds.length === 0) return;
        setIsSubmittingBatchPayment(true);
        try {
            const targetItems = items.filter(item => 
                selectedEmployeeIds.includes(item.employeeId) && !item.isPaid
            );

            if (targetItems.length === 0) {
                toast.error("Nenhum lote pendente de pagamento selecionado.");
                setIsSubmittingBatchPayment(false);
                return;
            }

            const paymentItems = targetItems.map(item => {
                let benefitType: "VT" | "VA" | "AMBOS" = "AMBOS";
                if (activeTab === "BUY") {
                    benefitType = item.vtOptIn ? "AMBOS" : "VA";
                } else if (activeTab === "ALERTS") {
                    if (item.vtNeedsAlert && item.vaNeedsAlert) benefitType = "AMBOS";
                    else if (item.vtNeedsAlert) benefitType = "VT";
                    else benefitType = "VA";
                }

                return {
                    employeeId: item.employeeId,
                    benefitType,
                    vtAmount: item.vtOptIn ? item.vtTotalValue : 0,
                    vaAmount: item.vaTotalValue
                };
            });

            const res = await markMultipleBenefitsAsPaid({
                items: paymentItems,
                month: selectedMonth,
                year: selectedYear,
                notes: batchPaymentNotes
            });

            if (res.success) {
                toast.success(`Pagamento de ${targetItems.length} lote(s) confirmado com sucesso!`);
                setBatchPaymentModalOpen(false);
                setBatchPaymentNotes("");
                setSelectedEmployeeIds([]);
                loadData();
            }
        } catch (err: any) {
            toast.error(err.message || "Erro ao realizar pagamento em lote.");
        } finally {
            setIsSubmittingBatchPayment(false);
        }
    };

    // Export Excel (.xls / .xlsx formatted Spreadsheet XML)
    const exportToExcel = () => {
        if (items.length === 0) {
            toast.error("Nenhum dado disponível para exportar.");
            return;
        }

        const monthName = monthNames[selectedMonth - 1];

        let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#EA580C" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Currency">
   <NumberFormat ss:Format="R$#,##0.00"/>
  </Style>
  <Style ss:ID="Center">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Compra de Beneficios">
  <Table>
   <Row ss:Height="24" ss:StyleID="Header">
    <Cell><Data ss:Type="String">Colaborador</Data></Cell>
    <Cell><Data ss:Type="String">CPF</Data></Cell>
    <Cell><Data ss:Type="String">Posto</Data></Cell>
    <Cell><Data ss:Type="String">Cliente</Data></Cell>
    <Cell><Data ss:Type="String">Data Admissao</Data></Cell>
    <Cell><Data ss:Type="String">Optante VT</Data></Cell>
    <Cell><Data ss:Type="String">VT R$/Dia</Data></Cell>
    <Cell><Data ss:Type="String">Faltas/Atestados (26-25)</Data></Cell>
    <Cell><Data ss:Type="String">VT Base (R$)</Data></Cell>
    <Cell><Data ss:Type="String">VT Desconto (R$)</Data></Cell>
    <Cell><Data ss:Type="String">VT Valor Líquido (R$)</Data></Cell>
    <Cell><Data ss:Type="String">Destino VT</Data></Cell>
    <Cell><Data ss:Type="String">VA Base (R$)</Data></Cell>
    <Cell><Data ss:Type="String">VA Desconto (R$)</Data></Cell>
    <Cell><Data ss:Type="String">VA Valor Líquido (R$)</Data></Cell>
    <Cell><Data ss:Type="String">Destino VA</Data></Cell>
    <Cell><Data ss:Type="String">Status Pagamento</Data></Cell>
    <Cell><Data ss:Type="String">Data Pagamento</Data></Cell>
    <Cell><Data ss:Type="String">Observacao / Lote</Data></Cell>
   </Row>`;

        filteredItems.forEach(item => {
            xml += `
   <Row>
    <Cell><Data ss:Type="String">${item.employeeName}</Data></Cell>
    <Cell><Data ss:Type="String">${item.employeeCpf}</Data></Cell>
    <Cell><Data ss:Type="String">${item.postoName}</Data></Cell>
    <Cell><Data ss:Type="String">${item.clientName}</Data></Cell>
    <Cell ss:StyleID="Center"><Data ss:Type="String">${item.admissionDate}</Data></Cell>
    <Cell ss:StyleID="Center"><Data ss:Type="String">${item.vtOptIn ? 'Sim' : 'Não'}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${item.vtDailyValue}</Data></Cell>
    <Cell ss:StyleID="Center"><Data ss:Type="Number">${item.vtOccurrencesDeducted}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${item.vtOptIn ? item.vtBaseValue : 0}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${item.vtOptIn ? item.vtDeductionValue : 0}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${item.vtOptIn ? item.vtTotalValue : 0}</Data></Cell>
    <Cell><Data ss:Type="String">${item.vtDestination}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${item.vaBaseValue}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${item.vaDeductionValue}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${item.vaTotalValue}</Data></Cell>
    <Cell><Data ss:Type="String">${item.vaDestination}</Data></Cell>
    <Cell ss:StyleID="Center"><Data ss:Type="String">${item.isPaid ? 'PAGO' : 'PENDENTE'}</Data></Cell>
    <Cell ss:StyleID="Center"><Data ss:Type="String">${item.paidAt || '-'}</Data></Cell>
    <Cell><Data ss:Type="String">${item.vtBatchNote || item.vaBatchNote || ''}</Data></Cell>
   </Row>`;
        });

        xml += `
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `compra_beneficios_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Planilha Excel baixada com sucesso!");
    };

    const exportOccurrencesToExcel = () => {
        const occurrencesItems = items.filter(item => item.vtOccurrencesDeducted > 0);
        if (occurrencesItems.length === 0) {
            toast.error("Nenhum dado de ocorrência disponível para exportar.");
            return;
        }

        let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#EF4444" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Currency">
   <NumberFormat ss:Format="R$#,##0.00"/>
  </Style>
  <Style ss:ID="Center">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
 </Styles>
  <Worksheet ss:Name="Relatorio de Abatimentos">
   <Table>
    <Row ss:Height="24" ss:StyleID="Header">
     <Cell><Data ss:Type="String">Colaborador</Data></Cell>
     <Cell><Data ss:Type="String">CPF</Data></Cell>
     <Cell><Data ss:Type="String">Posto</Data></Cell>
     <Cell><Data ss:Type="String">Cliente</Data></Cell>
     <Cell><Data ss:Type="String">Faltas/Ocorrências</Data></Cell>
     <Cell><Data ss:Type="String">Desconto VT (R$)</Data></Cell>
     <Cell><Data ss:Type="String">Desconto VA (R$)</Data></Cell>
     <Cell><Data ss:Type="String">Datas das Ocorrências</Data></Cell>
    </Row>`;

        occurrencesItems.forEach(item => {
            const datesStr = item.occurrencesList.map(o => o.date).join(', ');
            xml += `
    <Row>
     <Cell><Data ss:Type="String">${item.employeeName}</Data></Cell>
     <Cell><Data ss:Type="String">${item.employeeCpf}</Data></Cell>
     <Cell><Data ss:Type="String">${item.postoName}</Data></Cell>
     <Cell><Data ss:Type="String">${item.clientName}</Data></Cell>
     <Cell ss:StyleID="Center"><Data ss:Type="Number">${item.vtOccurrencesDeducted}</Data></Cell>
     <Cell ss:StyleID="Currency"><Data ss:Type="Number">${item.vtDeductionValue}</Data></Cell>
     <Cell ss:StyleID="Currency"><Data ss:Type="Number">${item.vaDeductionValue}</Data></Cell>
     <Cell><Data ss:Type="String">${datesStr}</Data></Cell>
    </Row>`;
        });

        xml += `
   </Table>
  </Worksheet>
</Workbook>`;

        const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_abatimentos_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Relatório de abatimentos baixado com sucesso!");
    };

    const getDueTodayItems = () => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const parseDdmmyyyy = (str: string | undefined): Date | null => {
            if (!str) return null;
            const parts = str.split('/');
            if (parts.length !== 3) return null;
            return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        };

        return items.filter(item => {
            if (item.isPaid) return false;
            if (!item.vtNeedsAlert && !item.vaNeedsAlert) return false;
            const dueDate = parseDdmmyyyy(item.nextPaymentDueDate);
            return dueDate !== null && dueDate <= todayStart;
        });
    };

    // Filter Items
    const filteredItems = items.filter(item => {
        const matchesSearch = 
            item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.employeeCpf.includes(searchTerm) ||
            item.postoName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.clientName.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        if (filterOption === "VT_ONLY") return item.vtOptIn && item.vtTotalValue > 0;
        if (filterOption === "VA_ONLY") return item.vaTotalValue > 0;
        if (filterOption === "NON_VT") return !item.vtOptIn;
        if (filterOption === "PAID") return item.isPaid;
        if (filterOption === "PENDING") return !item.isPaid;

        return true;
    });

    // Batch Selection Variables & Handlers
    const unpaidFilteredItems = (activeTab === "BUY" 
        ? filteredItems 
        : items.filter(i => i.vtNeedsAlert || i.vaNeedsAlert || i.isNewHire)
    ).filter(i => !i.isPaid);
    
    const isAllSelected = unpaidFilteredItems.length > 0 && unpaidFilteredItems.every(i => selectedEmployeeIds.includes(i.employeeId));
    const isSomeSelected = unpaidFilteredItems.length > 0 && unpaidFilteredItems.some(i => selectedEmployeeIds.includes(i.employeeId)) && !isAllSelected;

    const handleSelectAllToggle = () => {
        if (isAllSelected) {
            setSelectedEmployeeIds(prev => prev.filter(id => !unpaidFilteredItems.map(i => i.employeeId).includes(id)));
        } else {
            const newSelected = [...selectedEmployeeIds];
            unpaidFilteredItems.forEach(i => {
                if (!newSelected.includes(i.employeeId)) {
                    newSelected.push(i.employeeId);
                }
            });
            setSelectedEmployeeIds(newSelected);
        }
    };

    const handleSelectItemToggle = (employeeId: string) => {
        setSelectedEmployeeIds(prev => {
            if (prev.includes(employeeId)) {
                return prev.filter(id => id !== employeeId);
            } else {
                return [...prev, employeeId];
            }
        });
    };

    // Totals
    const totalVT = items.reduce((acc, curr) => acc + (curr.vtOptIn ? curr.vtTotalValue : 0), 0);
    const totalVA = items.reduce((acc, curr) => acc + curr.vaTotalValue, 0);
    const vtOptInCount = items.filter(i => i.vtOptIn).length;
    const alertCount = items.filter(i => i.vtNeedsAlert || i.vaNeedsAlert).length;
    const paidCount = items.filter(i => i.isPaid).length;
    const totalOccurrencesDeducted = items.reduce((acc, curr) => acc + curr.vtOccurrencesDeducted, 0);
    const totalVtDeduction = items.reduce((acc, curr) => acc + (curr.vtOptIn ? curr.vtDeductionValue : 0), 0);
    const totalVaDeduction = items.reduce((acc, curr) => acc + curr.vaDeductionValue, 0);

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto min-h-screen">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-orange-500/10 text-orange-600 rounded-2xl">
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900">Compra de Benefícios (VT e VA)</h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Gestão mensal de compra de vales. Fechamento de faltas de {config?.payrollCutoffStartDay || 26} a {config?.payrollCutoffEndDay || 25}, pagamento no {config?.payrollPaymentDay || 5}º dia útil.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Month/Year Selector */}
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                        <Select value={String(selectedMonth)} onValueChange={val => setSelectedMonth(Number(val))}>
                            <SelectTrigger className="w-[110px] h-8 text-xs font-bold border-none bg-transparent shadow-none">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {monthNames.map((m, idx) => (
                                    <SelectItem key={idx + 1} value={String(idx + 1)}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={String(selectedYear)} onValueChange={val => setSelectedYear(Number(val))}>
                            <SelectTrigger className="w-[80px] h-8 text-xs font-bold border-none bg-transparent shadow-none">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2025">2025</SelectItem>
                                <SelectItem value="2026">2026</SelectItem>
                                <SelectItem value="2027">2027</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button 
                        onClick={handleSyncSecullum}
                        disabled={isSyncingSecullum}
                        title="Sincronizar Ponto Secullum"
                        size="icon"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-md h-9 w-9 shrink-0"
                    >
                        <RefreshCw className={`w-4 h-4 ${isSyncingSecullum ? "animate-spin" : "text-indigo-200"}`} />
                    </Button>

                    <Button 
                        onClick={exportToExcel}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 rounded-2xl shadow-md h-9 px-4 shrink-0"
                    >
                        <FileSpreadsheet className="w-4 h-4" /> Exportar XLSX
                    </Button>

                    <Button 
                        variant="outline" 
                        onClick={() => setConfigModalOpen(true)}
                        title="Configurações"
                        size="icon"
                        className="rounded-2xl h-9 w-9 border-slate-200 shrink-0"
                    >
                        <Settings className="w-4 h-4 text-slate-600" />
                    </Button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
                {/* Total VT */}
                <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-5 rounded-3xl text-white shadow-md relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                        <Bus className="w-32 h-32" />
                    </div>
                    <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
                        <Bus className="w-4 h-4" /> Total Vale Transporte (VT)
                    </div>
                    <div className="text-2xl font-black whitespace-nowrap"><span className="text-base font-bold mr-1">R$</span>{totalVT.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="text-[11px] text-indigo-200 mt-2 font-medium flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> {vtOptInCount} colaboradores optantes ({items.length - vtOptInCount} dispensados)
                    </div>
                </div>

                {/* Total VA */}
                <div className="bg-gradient-to-br from-orange-600 to-amber-600 p-5 rounded-3xl text-white shadow-md relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                        <Utensils className="w-32 h-32" />
                    </div>
                    <div className="flex items-center gap-2 text-orange-100 text-xs font-bold uppercase tracking-wider mb-2">
                        <Utensils className="w-4 h-4" /> Total Vale Alimentação (VA)
                    </div>
                    <div className="text-2xl font-black whitespace-nowrap"><span className="text-base font-bold mr-1">R$</span>{totalVA.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="text-[11px] text-orange-100 mt-2 font-medium">
                        Mês de referência: {monthNames[selectedMonth - 1]} / {selectedYear}
                    </div>
                </div>

                {/* Faltas / Abatimentos */}
                <div 
                    onClick={() => {
                        if (totalOccurrencesDeducted > 0) {
                            setOccurrencesModalOpen(true);
                        }
                    }}
                    className={`bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-2 select-none ${totalOccurrencesDeducted > 0 ? 'cursor-pointer hover:bg-slate-50/80 transition-all active:scale-[0.98]' : ''}`}
                >
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        <AlertCircle className="w-4 h-4 text-red-500" /> Abatimentos Ocorrências
                    </div>
                    <div className="text-2xl font-black text-slate-800 whitespace-nowrap">{totalOccurrencesDeducted}</div>
                    <div className="text-[10px] text-slate-400 font-bold flex flex-wrap gap-x-1.5 whitespace-nowrap">
                        <span>Desc. VT: <strong className="text-indigo-600">R$ {totalVtDeduction.toFixed(2)}</strong></span>
                        <span className="text-slate-350">|</span>
                        <span>Desc. VA: <strong className="text-orange-600">R$ {totalVaDeduction.toFixed(2)}</strong></span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium pt-1">
                        Janela {config?.payrollCutoffStartDay || 26} a {config?.payrollCutoffEndDay || 25} (clique para detalhes).
                    </div>
                </div>

                {/* Status de Pagamentos */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
                    <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Compras Pagas
                    </div>
                    <div className="text-2xl font-black text-emerald-600 whitespace-nowrap">{paidCount} <span className="text-xs font-bold text-slate-400">/ {items.length}</span></div>
                    <div className="text-[11px] text-slate-500 font-medium">
                        {items.length - paidCount} compras pendentes de marcação.
                    </div>
                </div>

                {/* Lotes Fracionados */}
                <div 
                    onClick={() => {
                        if (alertCount > 0) {
                            setActiveTab("ALERTS");
                        }
                    }}
                    className={`bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-2 select-none ${alertCount > 0 ? 'cursor-pointer hover:bg-slate-50/80 transition-all active:scale-[0.98]' : ''}`}
                >
                    <div className="flex items-center gap-2 text-amber-650 text-xs font-bold uppercase tracking-wider">
                        <Clock className="w-4 h-4 text-amber-500" /> Pagamentos Fracionados
                    </div>
                    <div className="text-2xl font-black text-amber-600 whitespace-nowrap">{alertCount}</div>
                    <div className="text-[11px] text-slate-500 font-medium">
                        Colaboradores em período de parcelas fracionadas.
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 gap-6">
                <button
                    onClick={() => setActiveTab("BUY")}
                    className={`pb-3 text-sm font-bold tracking-tight transition-all relative ${
                        activeTab === "BUY" ? "text-orange-600 border-b-2 border-orange-500 font-black" : "text-slate-400 hover:text-slate-600"
                    }`}
                >
                    <CreditCard className="w-4 h-4 inline mr-2" /> Quadro de Compra ({filteredItems.length})
                </button>

                <button
                    onClick={() => setActiveTab("ALERTS")}
                    className={`pb-3 text-sm font-bold tracking-tight transition-all relative ${
                        activeTab === "ALERTS" ? "text-orange-600 border-b-2 border-orange-500 font-black" : "text-slate-400 hover:text-slate-600"
                    }`}
                >
                    <Clock className="w-4 h-4 inline mr-2" /> Alertas de Admissão &amp; Lotes ({alertCount})
                </button>
            </div>

            {/* TAB 1: QUADRO DE COMPRA */}
            {activeTab === "BUY" && (
                <div className="space-y-4">
                    {/* Filters & Search */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                        <div className="relative w-full md:w-96">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                            <Input
                                placeholder="Buscar por nome, CPF, posto ou cliente..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 text-xs rounded-xl bg-slate-50 border-slate-200"
                            />
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Filtrar por:</span>
                            <Select value={filterOption} onValueChange={(val: any) => setFilterOption(val)}>
                                <SelectTrigger className="w-[220px] h-9 text-xs font-bold rounded-xl border-slate-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Todos os Colaboradores</SelectItem>
                                    <SelectItem value="PENDING">Apenas Pendentes de Pagamento</SelectItem>
                                    <SelectItem value="PAID">Apenas Já Pagos</SelectItem>
                                    <SelectItem value="VT_ONLY">Apenas com VT &gt; R$0</SelectItem>
                                    <SelectItem value="VA_ONLY">Apenas com VA &gt; R$0</SelectItem>
                                    <SelectItem value="NON_VT">Não Optantes pelo VT</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                        <th className="py-4 px-4 w-10 text-center">
                                            <input 
                                                type="checkbox"
                                                checked={isAllSelected}
                                                ref={el => {
                                                    if (el) {
                                                        el.indeterminate = isSomeSelected;
                                                    }
                                                }}
                                                onChange={handleSelectAllToggle}
                                                className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                            />
                                        </th>
                                        <th className="py-4 px-4">Colaborador / CPF</th>
                                        <th className="py-4 px-4">Posto &amp; Cliente</th>
                                        <th className="py-4 px-4">Optante VT?</th>
                                        <th className="py-4 px-4 text-center">Faltas / Ocorrências</th>
                                        <th className="py-4 px-4 text-right">VT a Comprar</th>
                                        <th className="py-4 px-4">Destino VT</th>
                                        <th className="py-4 px-4 text-right">VA a Comprar</th>
                                        <th className="py-4 px-4">Destino VA</th>
                                        <th className="py-4 px-4 text-center">Status / Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={10} className="text-center py-12 text-slate-400 font-medium">
                                                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
                                                Calculando benefícios do mês...
                                            </td>
                                        </tr>
                                    ) : filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="text-center py-12 text-slate-400 font-medium">
                                                Nenhum colaborador encontrado com os filtros aplicados.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredItems.map(item => (
                                            <tr key={item.employeeId} className={`hover:bg-slate-50/60 transition-colors ${selectedEmployeeIds.includes(item.employeeId) ? 'bg-orange-50/20' : ''}`}>
                                                <td className="py-3.5 px-4 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedEmployeeIds.includes(item.employeeId)}
                                                        onChange={() => handleSelectItemToggle(item.employeeId)}
                                                        disabled={item.isPaid}
                                                        className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                    />
                                                </td>
                                                <td className="py-3.5 px-4 font-bold text-slate-900">
                                                    <div>{item.employeeName}</div>
                                                    <div className="text-[10px] font-mono text-slate-400">{item.employeeCpf}</div>
                                                </td>

                                                <td className="py-3.5 px-4">
                                                    <div className="font-semibold text-slate-800">{item.postoName}</div>
                                                    <div className="text-[10px] text-slate-400 font-medium">{item.clientName}</div>
                                                </td>

                                                <td className="py-3.5 px-4">
                                                    {item.vtOptIn ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                                            <CheckCircle2 className="w-3 h-3 mr-1" /> Sim (Optante)
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500">
                                                            <XCircle className="w-3 h-3 mr-1" /> Não Optante
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Ocorrências com Popover detalhado */}
                                                <td className="py-3.5 px-4 text-center">
                                                    {item.vtOccurrencesDeducted > 0 ? (
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <button className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700 hover:bg-red-200 transition-colors cursor-pointer gap-1">
                                                                    <AlertCircle className="w-3 h-3 text-red-600" />
                                                                    -{item.vtOccurrencesDeducted} dia(s) <Info className="w-3 h-3 ml-0.5 opacity-60" />
                                                                </button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-72 p-3 text-xs space-y-2">
                                                                <div className="font-bold text-slate-900 border-b pb-1 text-[11px]">
                                                                    Faltas / Atestados na Janela (26-25)
                                                                </div>
                                                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                                                    {item.occurrencesList.map(occ => (
                                                                        <div key={occ.id} className="p-2 bg-slate-50 rounded-xl border border-slate-200/60 text-[11px] space-y-1">
                                                                            <div className="font-bold text-red-600 flex justify-between">
                                                                                <span>{occ.type}</span>
                                                                                <span>{occ.date}</span>
                                                                            </div>
                                                                            {occ.notes && <div className="text-[10px] text-slate-500 italic">{occ.notes}</div>}
                                                                            <div className="flex justify-between pt-1.5 border-t border-dashed border-slate-200 text-[9px] text-slate-500 font-bold">
                                                                                <span>Desc. VT: -R$ {item.vtDailyValue.toFixed(2)}</span>
                                                                                <span>Desc. VA: -R$ {(item.vaBaseValue / 30).toFixed(2)}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    ) : (
                                                        <span className="text-emerald-600 font-semibold text-[11px] flex items-center justify-center gap-1">
                                                            <Check className="w-3 h-3" /> Nenhuma
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-4 text-right font-black text-indigo-700">
                                                    {item.vtOptIn ? `R$ ${item.vtTotalValue.toFixed(2)}` : "R$ 0,00"}
                                                </td>

                                                <td className="py-3.5 px-4">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                                                        {item.vtDestination}
                                                    </span>
                                                </td>

                                                <td className="py-3.5 px-4 text-right font-black text-orange-600">
                                                    R$ {item.vaTotalValue.toFixed(2)}
                                                </td>

                                                <td className="py-3.5 px-4">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200/60">
                                                        {item.vaDestination}
                                                    </span>
                                                </td>

                                                {/* Status / Ação de Pagamento */}
                                                <td className="py-3.5 px-4 text-center">
                                                    {item.isPaid ? (
                                                        <div className="space-y-0.5">
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                                <CheckCircle2 className="w-3 h-3 mr-1" /> PAGO
                                                            </span>
                                                            <div className="text-[9px] text-slate-400 font-medium">{item.paidAt}</div>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setSelectedItemForPayment(item);
                                                                setPaymentModalOpen(true);
                                                            }}
                                                            className="text-[10px] font-bold h-7 px-3 rounded-xl border-orange-300 text-orange-600 hover:bg-orange-50 hover:border-orange-400"
                                                        >
                                                            Marcar como Pago
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: ALERTAS DE ADMISSÃO RECENTE E PROXIMAS COMPRAS */}
            {activeTab === "ALERTS" && (
                <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 p-5 rounded-3xl text-amber-900 space-y-1">
                        <h3 className="font-black text-sm flex items-center gap-2">
                            <Clock className="w-5 h-5 text-amber-600" /> Acompanhamento de Fracionamentos &amp; Vencimentos
                        </h3>
                        <p className="text-xs text-amber-700 font-medium">
                            Para novos admitidos no mês, o VT é liberado em lotes de <strong>{config?.vtFractionDays || 5} em {config?.vtFractionDays || 5} dias</strong>. Aqui você acompanha a <strong>data do último pagamento</strong> e a <strong>data prevista do próximo pagamento</strong>.
                        </p>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="font-bold text-slate-500 uppercase text-[10px]">
                                        <th className="py-3 px-4 w-10 text-center">
                                            <input 
                                                type="checkbox"
                                                checked={isAllSelected}
                                                ref={el => {
                                                    if (el) {
                                                        el.indeterminate = isSomeSelected;
                                                    }
                                                }}
                                                onChange={handleSelectAllToggle}
                                                className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                            />
                                        </th>
                                        <th className="py-3 px-4">Colaborador</th>
                                        <th className="py-3 px-4">Posto / Cliente</th>
                                        <th className="py-3 px-4 text-center">Admissão</th>
                                        <th className="py-3 px-4 text-center">Último Pgto.</th>
                                        <th className="py-3 px-4 text-center">Próximo Vecto.</th>
                                        <th className="py-3 px-4 text-right">Lote VT</th>
                                        <th className="py-3 px-4 text-right">Lote VA</th>
                                        <th className="py-3 px-4 text-center">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {items.filter(i => i.vtNeedsAlert || i.vaNeedsAlert || i.isNewHire).length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                                                Nenhum alerta de lote fracionado pendente para o mês selecionado.
                                            </td>
                                        </tr>
                                    ) : (
                                        items.filter(i => i.vtNeedsAlert || i.vaNeedsAlert || i.isNewHire).map(item => (
                                            <tr key={item.employeeId} className={`hover:bg-slate-50/50 ${selectedEmployeeIds.includes(item.employeeId) ? 'bg-orange-50/20' : ''}`}>
                                                <td className="py-3 px-4 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedEmployeeIds.includes(item.employeeId)}
                                                        onChange={() => handleSelectItemToggle(item.employeeId)}
                                                        disabled={item.isPaid}
                                                        className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                    />
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-bold text-slate-800">{item.employeeName}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold">{item.employeeCpf}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="text-slate-600 font-bold">{item.postoName}</div>
                                                    <div className="text-[10px] text-slate-400">{item.clientName}</div>
                                                </td>
                                                <td className="py-3 px-4 text-center text-[10px] text-slate-500">
                                                    {item.admissionDate}
                                                </td>
                                                <td className="py-3 px-4 text-center text-[10px] text-slate-500">
                                                    {item.lastPaymentDate || "Nenhum"}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${item.isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                                        {item.nextPaymentDueDate || "A calcular"}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right font-bold">
                                                    {item.vtNeedsAlert ? (
                                                        <div className="space-y-0.5">
                                                            <div className="text-indigo-600">R$ {item.vtTotalValue.toFixed(2)}</div>
                                                            <div className="text-[9px] text-indigo-400 font-semibold">{item.vtDestination}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 font-semibold">-</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right font-bold">
                                                    {item.vaNeedsAlert ? (
                                                        <div className="space-y-0.5">
                                                            <div className="text-orange-600">R$ {item.vaTotalValue.toFixed(2)}</div>
                                                            <div className="text-[9px] text-orange-400 font-semibold">{item.vaDestination}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 font-semibold">-</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {item.isPaid ? (
                                                        <span className="inline-flex items-center text-emerald-600 text-[10px] font-black">
                                                            <Check className="w-3.5 h-3.5 mr-0.5" /> PAGO
                                                        </span>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setSelectedItemForPayment(item);
                                                                setPaymentModalOpen(true);
                                                            }}
                                                            className="text-[10px] font-extrabold h-6 px-2.5 rounded-lg border-amber-300 text-amber-600 hover:bg-amber-50 hover:border-amber-400"
                                                        >
                                                            Pagar Lote
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MARCAR COMO PAGO MODAL */}
            <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-black text-emerald-700">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Confirmar Pagamento de Benefícios
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Registra a compra como paga e agenda a data do próximo lote (+5 dias para VT / +10 dias para VA).
                        </DialogDescription>
                    </DialogHeader>

                    {selectedItemForPayment && (
                        <div className="space-y-4 py-2 text-xs">
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                                <div className="font-bold text-slate-900">{selectedItemForPayment.employeeName}</div>
                                <div className="text-[11px] text-slate-500">{selectedItemForPayment.postoName} ({selectedItemForPayment.clientName})</div>
                            </div>

                            <div className="space-y-2">
                                <div className="p-3 bg-indigo-50/70 border border-indigo-100/80 rounded-2xl space-y-1 text-indigo-950">
                                    <div className="flex justify-between font-black text-indigo-900">
                                        <span>Vale Transporte (VT) Líquido:</span>
                                        <span>R$ {selectedItemForPayment.vtOptIn ? selectedItemForPayment.vtTotalValue.toFixed(2) : "0,00"}</span>
                                    </div>
                                    {selectedItemForPayment.vtOptIn && (
                                        <div className="flex justify-between text-[10px] text-indigo-700/90 font-medium">
                                            <span>Base: R$ {selectedItemForPayment.vtBaseValue.toFixed(2)} | Faltas: -R$ {selectedItemForPayment.vtDeductionValue.toFixed(2)} ({selectedItemForPayment.vtOccurrencesDeducted}d)</span>
                                            <span>Destino: {selectedItemForPayment.vtDestination}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="p-3 bg-orange-50/70 border border-orange-100/80 rounded-2xl space-y-1 text-orange-950">
                                    <div className="flex justify-between font-black text-orange-900">
                                        <span>Vale Alimentação (VA) Líquido:</span>
                                        <span>R$ {selectedItemForPayment.vaTotalValue.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-orange-700/90 font-medium">
                                        <span>Base: R$ {selectedItemForPayment.vaBaseValue.toFixed(2)} | Faltas: -R$ {selectedItemForPayment.vaDeductionValue.toFixed(2)} ({selectedItemForPayment.vaOccurrencesDeducted}d)</span>
                                        <span>Destino: {selectedItemForPayment.vaDestination}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="font-bold text-slate-700">Observação / Comprovante (Opcional)</Label>
                                <Input
                                    placeholder="Ex: Pago via Pix pelo lote 1..."
                                    value={paymentNotes}
                                    onChange={e => setPaymentNotes(e.target.value)}
                                />
                            </div>

                            <DialogFooter className="pt-4 border-t border-slate-100">
                                <Button type="button" variant="outline" onClick={() => setPaymentModalOpen(false)}>Cancelar</Button>
                                <Button 
                                    onClick={handleMarkAsPaid} 
                                    disabled={isSubmittingPayment}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
                                >
                                    {isSubmittingPayment ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirmar Pagamento
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* AUTO FRACTIONED PAYMENTS ALERT MODAL */}
            <Dialog open={fractionedAlertModalOpen} onOpenChange={setFractionedAlertModalOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden rounded-3xl">
                    <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-amber-50/50">
                        <DialogTitle className="flex items-center gap-2 text-lg font-black text-amber-700">
                            <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse" /> Pagamentos de VT/VA para hoje
                        </DialogTitle>
                        <DialogDescription className="text-xs text-amber-800">
                            Prezado responsável, há pagamentos fracionados com vencimento para o dia de hoje ou datas anteriores que necessitam de atenção.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-white">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="font-bold text-slate-500">
                                        <th className="py-2.5 px-3">Colaborador</th>
                                        <th className="py-2.5 px-3">Posto</th>
                                        <th className="py-2.5 px-3 text-center">Vencimento</th>
                                        <th className="py-2.5 px-3 text-right">Lote VT</th>
                                        <th className="py-2.5 px-3 text-right">Lote VA</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {getDueTodayItems().map(item => (
                                        <tr key={item.employeeId} className="hover:bg-slate-50/50 text-xs font-semibold">
                                            <td className="py-3 px-3">
                                                <div className="font-bold text-slate-800">{item.employeeName}</div>
                                                <div className="text-[10px] text-slate-400 font-medium">{item.employeeCpf}</div>
                                            </td>
                                            <td className="py-3 px-3 text-slate-600 font-medium">
                                                {item.postoName}
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold text-[10px] border border-red-200">
                                                    {item.nextPaymentDueDate}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-right font-extrabold text-indigo-600">
                                                {item.vtNeedsAlert ? `R$ ${item.vtTotalValue.toFixed(2)}` : "-"}
                                            </td>
                                            <td className="py-3 px-3 text-right font-extrabold text-orange-600">
                                                {item.vaNeedsAlert ? `R$ ${item.vaTotalValue.toFixed(2)}` : "-"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <Button 
                            onClick={exportFractionedDueTodayToExcel}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs gap-1.5 h-9"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Exportar Relação de Hoje
                        </Button>
                        <Button onClick={() => setFractionedAlertModalOpen(false)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs h-9">
                            Fechar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* OCCURRENCES DETAILS MODAL */}
            <Dialog open={occurrencesModalOpen} onOpenChange={setOccurrencesModalOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-3xl">
                    <DialogHeader className="p-6 pb-4 border-b border-slate-100">
                        <DialogTitle className="flex items-center gap-2 text-lg font-black text-red-700">
                            <AlertCircle className="w-5 h-5 text-red-600" /> Relatório de Ocorrências e Abatimentos ({selectedMonth}/{selectedYear})
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Lista de colaboradores com faltas ou atestados registrados no período de {config?.payrollCutoffStartDay || 26} a {config?.payrollCutoffEndDay || 25}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs font-bold text-slate-700">
                            <div>Total Faltas/Ocorrências: <span className="text-slate-900 font-extrabold">{totalOccurrencesDeducted}</span></div>
                            <div className="w-px bg-slate-300"></div>
                            <div>Total Desconto VT: <span className="text-indigo-600 font-extrabold">R$ {totalVtDeduction.toFixed(2)}</span></div>
                            <div className="w-px bg-slate-300"></div>
                            <div>Total Desconto VA: <span className="text-orange-600 font-extrabold">R$ {totalVaDeduction.toFixed(2)}</span></div>
                        </div>

                        <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-white">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="font-bold text-slate-500">
                                        <th className="py-2.5 px-3">Colaborador</th>
                                        <th className="py-2.5 px-3">Posto / Cliente</th>
                                        <th className="py-2.5 px-3 text-center">Faltas</th>
                                        <th className="py-2.5 px-3 text-right">Desc. VT</th>
                                        <th className="py-2.5 px-3 text-right">Desc. VA</th>
                                        <th className="py-2.5 px-3">Datas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.filter(item => item.vtOccurrencesDeducted > 0).map(item => (
                                        <tr key={item.employeeId} className="hover:bg-slate-50/50">
                                            <td className="py-3 px-3">
                                                <div className="font-semibold text-slate-800">{item.employeeName}</div>
                                                <div className="text-[10px] text-slate-400 font-medium">{item.employeeCpf}</div>
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="text-slate-600 font-medium">{item.postoName}</div>
                                                <div className="text-[10px] text-slate-400">{item.clientName}</div>
                                            </td>
                                            <td className="py-3 px-3 text-center font-bold text-red-600">
                                                {item.vtOccurrencesDeducted}
                                            </td>
                                            <td className="py-3 px-3 text-right font-semibold text-indigo-600">
                                                R$ {item.vtDeductionValue.toFixed(2)}
                                            </td>
                                            <td className="py-3 px-3 text-right font-semibold text-orange-600">
                                                R$ {item.vaDeductionValue.toFixed(2)}
                                            </td>
                                            <td className="py-3 px-3 text-[10px] text-slate-500 max-w-[150px] truncate" title={item.occurrencesList.map(o => o.notes || o.type).join(', ')}>
                                                {item.occurrencesList.map(o => o.date.substring(0, 5)).join(', ')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <Button 
                            onClick={exportOccurrencesToExcel}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs gap-1.5 h-9"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Exportar Relatório (Excel)
                        </Button>
                        <Button onClick={() => setOccurrencesModalOpen(false)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs h-9">
                            Fechar Relatório
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* CONFIG MODAL */}
            <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
                <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl">
                    <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
                        <DialogTitle className="flex items-center gap-2 text-lg font-black">
                            <Settings className="w-5 h-5 text-orange-500" /> Configurações Globais de Benefícios
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Defina as datas de corte de ocorrências, fracionamentos e prazos padrão de liberação.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleConfigSubmit} className="flex-1 flex flex-col overflow-hidden text-xs">
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Dia Início Janela de Folha (Anterior)</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={31}
                                        value={configFormData.payrollCutoffStartDay}
                                        onChange={e => setConfigFormData({ ...configFormData, payrollCutoffStartDay: Number(e.target.value) })}
                                    />
                                    <span className="text-[10px] text-slate-400">Padrão: 26</span>
                                </div>

                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Dia Fim Janela de Folha (Atual)</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={31}
                                        value={configFormData.payrollCutoffEndDay}
                                        onChange={e => setConfigFormData({ ...configFormData, payrollCutoffEndDay: Number(e.target.value) })}
                                    />
                                    <span className="text-[10px] text-slate-400">Padrão: 25</span>
                                </div>

                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Dia do Pagamento da Folha</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={31}
                                        value={configFormData.payrollPaymentDay}
                                        onChange={e => setConfigFormData({ ...configFormData, payrollPaymentDay: Number(e.target.value) })}
                                    />
                                    <span className="text-[10px] text-slate-400">Padrão: 5º dia útil</span>
                                </div>

                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Lote VT Admissão (Dias)</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={configFormData.vtFractionDays}
                                        onChange={e => setConfigFormData({ ...configFormData, vtFractionDays: Number(e.target.value) })}
                                    />
                                    <span className="text-[10px] text-slate-400">Padrão: 5 dias</span>
                                </div>

                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Lote VA Admissão (Dias)</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={configFormData.vaFractionDays}
                                        onChange={e => setConfigFormData({ ...configFormData, vaFractionDays: Number(e.target.value) })}
                                    />
                                    <span className="text-[10px] text-slate-400">Padrão: 10 dias</span>
                                </div>

                                <div className="space-y-1">
                                    <Label className="font-bold text-slate-700">Estimativa Entrega Cartão VA (Dias)</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={configFormData.vaCardDeliveryEstimateDays}
                                        onChange={e => setConfigFormData({ ...configFormData, vaCardDeliveryEstimateDays: Number(e.target.value) })}
                                    />
                                    <span className="text-[10px] text-slate-400">Padrão: 10 dias</span>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 space-y-1">
                                <Label className="font-bold text-slate-700">Usuário Responsável pelos Alertas de Lote</Label>
                                <Select
                                    value={configFormData.alertUserId || "none"}
                                    onValueChange={val => setConfigFormData(prev => ({ ...prev, alertUserId: val === "none" ? "" : val }))}
                                >
                                    <SelectTrigger className="rounded-xl border-slate-200 text-xs font-semibold h-9">
                                        <SelectValue placeholder="Selecione o usuário..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Nenhum (Desativar alertas automáticos)</SelectItem>
                                        {systemUsers.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <span className="text-[10px] text-slate-400 block font-medium">Este usuário verá o modal de alerta automaticamente caso haja lotes vencendo hoje.</span>
                            </div>

                            <div className="pt-4 border-t border-slate-100 space-y-3">
                                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                    <RefreshCw className="w-4 h-4 text-orange-500" /> API Integração Secullum Ponto Web
                                </h4>
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <Label className="font-bold text-slate-700">URL da API Secullum</Label>
                                        <Input
                                            value={configFormData.secullumApiUrl}
                                            onChange={e => setConfigFormData({ ...configFormData, secullumApiUrl: e.target.value })}
                                            placeholder="https://pontowebintegracaoexterna.secullum.com.br"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label className="font-bold text-slate-700">E-mail do Secullum</Label>
                                            <Input
                                                value={configFormData.secullumEmail}
                                                onChange={e => setConfigFormData({ ...configFormData, secullumEmail: e.target.value })}
                                                placeholder="cristiano@grupojvsserv.com.br"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="font-bold text-slate-700">Senha do Secullum</Label>
                                            <Input
                                                type="password"
                                                value={configFormData.secullumPassword}
                                                onChange={e => setConfigFormData({ ...configFormData, secullumPassword: e.target.value })}
                                                placeholder="Sua senha do Ponto Web..."
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label className="font-bold text-slate-700">ID do Banco Selecionado</Label>
                                            <Input
                                                value={configFormData.secullumCompanyId}
                                                onChange={e => setConfigFormData({ ...configFormData, secullumCompanyId: e.target.value })}
                                                placeholder="Ex: 85740"
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleTestSecullum}
                                        disabled={isTestingSecullum}
                                        className="w-full text-xs font-bold gap-2 border-slate-300"
                                    >
                                        {isTestingSecullum ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                                        Testar Conexão com Secullum Ponto Web
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setConfigModalOpen(false)}>Cancelar</Button>
                            <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white font-bold">Salvar Configurações</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* BATCH PAYMENT CONFIRMATION MODAL */}
            <Dialog open={batchPaymentModalOpen} onOpenChange={setBatchPaymentModalOpen}>
                <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-3xl">
                    <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-orange-50/50">
                        <DialogTitle className="flex items-center gap-2 text-lg font-black text-orange-700">
                            <CheckCircle2 className="w-5 h-5 text-orange-600" /> Confirmar Pagamento em Lote
                        </DialogTitle>
                        <DialogDescription className="text-xs text-orange-850">
                            Você está registrando o pagamento para <span className="font-extrabold">{selectedEmployeeIds.length}</span> colaborador(es) selecionados de uma só vez.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 font-bold text-slate-700">
                            Previsão de pagamento em lote:
                            <ul className="list-disc list-inside font-medium text-slate-600 mt-2 space-y-1">
                                <li>Lançamentos criados: <strong className="text-slate-800">{selectedEmployeeIds.length}</strong></li>
                                <li>Referência de data de pagamento: <strong className="text-slate-800">Hoje ({new Date().toLocaleDateString('pt-BR')})</strong></li>
                                <li>Janela de corte ativa: <strong className="text-slate-800">{config?.payrollCutoffStartDay || 26} a {config?.payrollCutoffEndDay || 25}</strong></li>
                            </ul>
                        </div>

                        <div className="space-y-1">
                            <Label className="font-bold text-slate-700">Observação / Nota do Lote (Opcional)</Label>
                            <Input
                                placeholder="Ex: Pago via lote Pix financeiro #04..."
                                value={batchPaymentNotes}
                                onChange={e => setBatchPaymentNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setBatchPaymentModalOpen(false)}>Cancelar</Button>
                        <Button 
                            onClick={handleBatchPaymentSubmit} 
                            disabled={isSubmittingBatchPayment}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold gap-2"
                        >
                            {isSubmittingBatchPayment ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirmar Lote
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Floating Batch Payment Action Bar */}
            {selectedEmployeeIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-3xl shadow-xl flex items-center gap-6 z-50 border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="text-xs font-bold">
                        <span className="text-orange-400 font-extrabold">{selectedEmployeeIds.length}</span> colaborador(es) selecionado(s) para pagamento.
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            onClick={() => setBatchPaymentModalOpen(true)}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs h-9 px-4 gap-1.5"
                        >
                            <Check className="w-4 h-4" /> Dar Baixa em Lote
                        </Button>
                        <Button 
                            variant="ghost" 
                            onClick={() => setSelectedEmployeeIds([])}
                            className="text-slate-400 hover:text-white font-bold text-xs h-9 px-3"
                        >
                            Cancelar
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
